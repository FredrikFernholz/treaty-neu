import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { benutzer } from '../../db/schema.js';
import { db } from '../../db/zugriff.js';
import { anmeldungSchema, passwortAendernSchema, type Ich } from '../../shared/schemas/anmeldung.js';
import { Fehlversuchssperre, IP_REGEL, KONTO_IP_REGEL } from './fehlversuchssperre.js';
import { hashePasswort, pruefePasswort } from './passwort-hash.js';
import { pruefeNeuesPasswort } from './passwortpruefung.js';
import { protokolliere } from './sicherheitsprotokoll.js';
import { beendeAlleSitzungen, beendeSitzung, erzeugeSitzung, pruefeSitzung, type Angemeldet } from './sitzungen.js';
import { fehler, loescheSitzungscookie, setzeSitzungscookie, sitzungstoken } from './zugriffspruefung.js';

// Anmelderouten (Konzeption 9, Entscheidungen 16.10.2026):
//   POST /api/v1/anmeldung        anmelden mit Kürzel und Passwort
//   POST /api/v1/abmeldung        abmelden
//   GET  /api/v1/ich              wer bin ich, welche Rechte habe ich
//   POST /api/v1/ich/passwort     eigenes Passwort ändern, auch der Pflichtwechsel

// Fester argon2id-Hash eines zufälligen, unbekannten Werts, mit denselben Parametern wie
// ARGON2_PARAMETER. Bei unbekanntem Kürzel wird das Passwort trotzdem gegen diesen Hash
// geprüft. So dauert die Antwort gleich lang wie bei einem bekannten Kürzel und verrät
// nicht, ob es das Kürzel gibt. Kein Passwort passt zu diesem Hash, der zugrunde liegende
// Wert wurde nach dem Erzeugen verworfen.
export const PLATZHALTER_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$uimowbLEEVt9hM1S6XIzqA$C8NNlPMVv3VZV6jnejYgpGVUy52yDbkX3WHyV30svJg';

const ANMELDUNG_FEHLGESCHLAGEN = 'Kürzel oder Passwort ist nicht korrekt.';

export type Sperren = { kontoIp: Fehlversuchssperre; ip: Fehlversuchssperre };

export function neueSperren(): Sperren {
  return { kontoIp: new Fehlversuchssperre(KONTO_IP_REGEL), ip: new Fehlversuchssperre(IP_REGEL) };
}

/** Antwort mit den Angaben zur angemeldeten Person. */
function alsIch(person: Pick<Angemeldet, 'kuerzel' | 'name' | 'berechtigung' | 'zusatzrechte' | 'passwortWechselNoetig'>): Ich {
  return {
    kuerzel: person.kuerzel,
    name: person.name,
    berechtigung: person.berechtigung,
    zusatzrechte: person.zusatzrechte,
    passwortWechselNoetig: person.passwortWechselNoetig,
  };
}

function herkunft(anfrage: FastifyRequest) {
  return { ip: anfrage.ip, userAgent: anfrage.headers['user-agent'] ?? null };
}

/** Schlüssel für den Zähler je Konto und IP. Das Kürzel ohne Beachtung der Groß- und Kleinschreibung. */
function kontoIpSchluessel(kuerzel: string, ip: string): string {
  return `${kuerzel.toUpperCase()}|${ip}`;
}

/** Antwort 429 mit Retry-After in ganzen Sekunden, aufgerundet. */
function zuVieleVersuche(antwort: FastifyReply, nochMs: number): FastifyReply {
  antwort.header('Retry-After', String(Math.ceil(nochMs / 1000)));
  return fehler(antwort, 429, {
    fehler: 'zu_viele_versuche',
    meldung: 'Zu viele Fehlversuche. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
  });
}

/** Zählt einen Fehlversuch in beiden Sperren und protokolliert eine dadurch ausgelöste Sperre. */
async function zaehleFehlversuch(
  sperren: Sperren,
  kuerzel: string,
  benutzerId: number | null,
  anfrage: FastifyRequest,
  jetzt: Date,
): Promise<void> {
  const ausgeloest = [
    ['Konto und IP', sperren.kontoIp.fehlversuch(kontoIpSchluessel(kuerzel, anfrage.ip))],
    ['IP', sperren.ip.fehlversuch(anfrage.ip)],
  ] as const;
  for (const [art, dauer] of ausgeloest) {
    if (dauer === null) continue;
    await protokolliere(db, {
      ereignis: 'sperre',
      zeitpunkt: jetzt,
      benutzerId,
      kuerzelEingabe: kuerzel,
      ...herkunft(anfrage),
      grund: `${art}, ${Math.round(dauer / 1000)}s`,
    });
  }
}

export function registriereAnmelderouten(app: FastifyInstance, sperren: Sperren): void {
  app.post('/api/v1/anmeldung', { config: { zugriff: 'oeffentlich' } }, async (anfrage, antwort) => {
    const eingabe = anmeldungSchema.safeParse(anfrage.body);
    if (!eingabe.success) {
      return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: 'Bitte Kürzel und Passwort angeben.' });
    }
    const { kuerzel, passwort } = eingabe.data;
    const jetzt = new Date();

    // Während einer Sperre wird das Passwort gar nicht erst geprüft. Protokolliert wird
    // höchstens ein Versuch je Sperre und Schlüssel, damit Dauerversuche das
    // Protokoll nicht fluten (Entscheidung 16.10.2026).
    const schluessel = kontoIpSchluessel(kuerzel, anfrage.ip);
    const sperrstaende = [sperren.kontoIp.pruefe(schluessel), sperren.ip.pruefe(anfrage.ip)];
    const nochMs = Math.max(0, ...sperrstaende.map((s) => (s.gesperrt ? s.nochMs : 0)));
    if (nochMs > 0) {
      const erstmals = [
        sperren.kontoIp.ersteMeldungWaehrendSperre(schluessel),
        sperren.ip.ersteMeldungWaehrendSperre(anfrage.ip),
      ];
      if (erstmals.some(Boolean)) {
        await protokolliere(db, {
          ereignis: 'anmeldung_fehlgeschlagen',
          zeitpunkt: jetzt,
          kuerzelEingabe: kuerzel,
          ...herkunft(anfrage),
          grund: 'gesperrt',
        });
      }
      return zuVieleVersuche(antwort, nochMs);
    }

    const [person] = await db.select().from(benutzer).where(eq(benutzer.kuerzel, kuerzel)).limit(1);
    // Immer prüfen, auch ohne Benutzer, damit die Antwortzeit nichts verrät.
    const passwortRichtig = await pruefePasswort(passwort, person?.passwortHash ?? PLATZHALTER_HASH);
    const grund = !person ? 'unbekanntes_kuerzel' : !passwortRichtig ? 'falsches_passwort' : !person.aktiv ? 'konto_deaktiviert' : null;

    if (grund !== null || !person) {
      await protokolliere(db, {
        ereignis: 'anmeldung_fehlgeschlagen',
        zeitpunkt: jetzt,
        benutzerId: person?.id ?? null,
        kuerzelEingabe: kuerzel,
        ...herkunft(anfrage),
        grund,
      });
      await zaehleFehlversuch(sperren, kuerzel, person?.id ?? null, anfrage, jetzt);
      return fehler(antwort, 401, { fehler: 'anmeldung_fehlgeschlagen', meldung: ANMELDUNG_FEHLGESCHLAGEN });
    }

    // Erfolg. Nur der Zähler für Konto und IP wird zurückgesetzt, der reine IP-Zähler
    // nicht, sonst könnte man ihn mit einem eigenen gültigen Konto immer wieder leeren.
    sperren.kontoIp.erfolg(kontoIpSchluessel(kuerzel, anfrage.ip));

    // Eine noch bestehende alte Sitzung aus demselben Browser wird beendet, jede
    // Anmeldung bekommt ein neues Token.
    const altesToken = sitzungstoken(anfrage);
    if (altesToken !== null) await beendeSitzung(db, altesToken, jetzt);

    const { token } = await erzeugeSitzung(db, person.id, herkunft(anfrage), jetzt);
    await protokolliere(db, {
      ereignis: 'anmeldung_erfolgreich',
      zeitpunkt: jetzt,
      benutzerId: person.id,
      kuerzelEingabe: kuerzel,
      ...herkunft(anfrage),
    });
    setzeSitzungscookie(antwort, token);
    const angemeldet = await pruefeSitzung(db, token, jetzt);
    if (!angemeldet) throw new Error('Neue Sitzung ist sofort ungültig');
    return alsIch(angemeldet);
  });

  app.post(
    '/api/v1/abmeldung',
    { config: { zugriff: 'angemeldet', erlaubtBeiPasswortwechsel: true } },
    async (anfrage, antwort) => {
      const token = sitzungstoken(anfrage);
      if (token !== null) await beendeSitzung(db, token, new Date());
      loescheSitzungscookie(antwort);
      return antwort.code(204).send();
    },
  );

  app.get(
    '/api/v1/ich',
    { config: { zugriff: 'angemeldet', erlaubtBeiPasswortwechsel: true } },
    async (anfrage) => alsIch(anfrage.angemeldet!),
  );

  app.post(
    '/api/v1/ich/passwort',
    { config: { zugriff: 'angemeldet', erlaubtBeiPasswortwechsel: true } },
    async (anfrage, antwort) => {
      const ich = anfrage.angemeldet!;
      const eingabe = passwortAendernSchema.safeParse(anfrage.body);
      if (!eingabe.success) {
        return fehler(antwort, 400, {
          fehler: 'ungueltige_eingabe',
          meldung: eingabe.error.issues.map((i) => i.message).join(' '),
        });
      }
      const { altesPasswort, neuesPasswort } = eingabe.data;
      const jetzt = new Date();

      const sperrstand = sperren.kontoIp.pruefe(kontoIpSchluessel(ich.kuerzel, anfrage.ip));
      if (sperrstand.gesperrt) return zuVieleVersuche(antwort, sperrstand.nochMs);

      const [person] = await db.select().from(benutzer).where(eq(benutzer.id, ich.benutzerId)).limit(1);
      if (!person || !(await pruefePasswort(altesPasswort, person.passwortHash))) {
        // Zählt als Fehlversuch, sonst ließe sich hier das Passwort ohne Sperre durchprobieren.
        await protokolliere(db, {
          ereignis: 'anmeldung_fehlgeschlagen',
          zeitpunkt: jetzt,
          benutzerId: ich.benutzerId,
          kuerzelEingabe: ich.kuerzel,
          ...herkunft(anfrage),
          grund: 'passwortwechsel_altes_passwort_falsch',
        });
        await zaehleFehlversuch(sperren, ich.kuerzel, ich.benutzerId, anfrage, jetzt);
        return fehler(antwort, 403, { fehler: 'passwort_falsch', meldung: 'Das bisherige Passwort ist nicht korrekt.' });
      }

      const regelverstoesse = pruefeNeuesPasswort(neuesPasswort);
      if (neuesPasswort === altesPasswort) {
        regelverstoesse.push('Das neue Passwort muss sich vom bisherigen unterscheiden.');
      }
      if (regelverstoesse.length > 0) {
        return fehler(antwort, 400, { fehler: 'ungueltige_eingabe', meldung: regelverstoesse.join(' ') });
      }

      const neuerHash = await hashePasswort(neuesPasswort);
      await db.transaction(async (tx) => {
        await tx
          .update(benutzer)
          .set({ passwortHash: neuerHash, passwortWechselNoetig: false, version: sql`${benutzer.version} + 1` })
          .where(eq(benutzer.id, ich.benutzerId));
        // Alle anderen Sitzungen enden, die aktuelle bleibt (Entscheidung 16.10.2026).
        await beendeAlleSitzungen(tx, ich.benutzerId, 'passwort_geaendert', jetzt, { ausserSitzungId: ich.sitzungId });
        await protokolliere(tx, {
          ereignis: 'passwort_geaendert',
          zeitpunkt: jetzt,
          benutzerId: ich.benutzerId,
          ...herkunft(anfrage),
          grund: ich.passwortWechselNoetig ? 'pflichtwechsel' : null,
        });
      });
      sperren.kontoIp.erfolg(kontoIpSchluessel(ich.kuerzel, anfrage.ip));
      return alsIch({ ...ich, passwortWechselNoetig: false });
    },
  );
}
