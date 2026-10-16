import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { benutzer } from '../../db/schema.js';
import type { DbZugriff } from '../../db/zugriff.js';
import { benutzernameSchema, emailSchema, kuerzelSchema } from '../../shared/schemas/benutzer.js';
import { erzeugeEinmalpasswort } from '../anmeldung/einmalpasswort.js';
import { hashePasswort } from '../anmeldung/passwort-hash.js';
import { protokolliere } from '../anmeldung/sicherheitsprotokoll.js';

// Legt den ersten Administrator an (Ausbaustufe 1, Teilschritt 8). Aufgerufen nur vom
// Kommandozeilenskript src/kommandos/erster-administrator.ts.
//
// Es gibt kein festes Demo-Passwort (anders als im Prototyp). Der Administrator bekommt
// ein zufälliges Einmalpasswort und muss bei der ersten Anmeldung ein eigenes festlegen.
//
// Gibt es schon einen aktiven Administrator, wird nichts angelegt. Weitere Benutzer legt
// ein Administrator in der Benutzerverwaltung an. So ist das Skript keine Hintertür für
// alle, die Zugang zum Server haben.

/** Fehler mit einer Meldung, die ohne technische Einzelheiten ausgegeben werden kann. */
export class Kommandofehler extends Error {}

const eingabeSchema = z.object({ kuerzel: kuerzelSchema, name: benutzernameSchema, email: emailSchema });

export async function legeErstenAdministratorAn(
  db: DbZugriff,
  eingabe: { kuerzel: string; name: string; email: string },
  jetzt: Date,
): Promise<{ kuerzel: string; einmalpasswort: string }> {
  const geprueft = eingabeSchema.safeParse(eingabe);
  if (!geprueft.success) {
    throw new Kommandofehler(geprueft.error.issues.map((i) => i.message).join('\n'));
  }
  const { kuerzel, name, email } = geprueft.data;

  const einmalpasswort = erzeugeEinmalpasswort();
  const passwortHash = await hashePasswort(einmalpasswort);

  await db.transaction(async (tx) => {
    const [vorhanden] = await tx
      .select({ anzahl: count() })
      .from(benutzer)
      .where(and(eq(benutzer.berechtigung, 'administrator'), eq(benutzer.aktiv, true)));
    if ((vorhanden?.anzahl ?? 0) > 0) {
      throw new Kommandofehler(
        'Es gibt bereits einen aktiven Administrator. Weitere Benutzer legt ein Administrator in der Benutzerverwaltung an.',
      );
    }

    const [doppelt] = await tx
      .select({ kuerzel: benutzer.kuerzel, email: benutzer.email })
      .from(benutzer)
      .where(eq(benutzer.kuerzel, kuerzel))
      .union(tx.select({ kuerzel: benutzer.kuerzel, email: benutzer.email }).from(benutzer).where(eq(benutzer.email, email)));
    if (doppelt) {
      throw new Kommandofehler(
        doppelt.kuerzel === kuerzel
          ? `Das Kürzel ${kuerzel} ist bereits vergeben.`
          : `Die E-Mail-Adresse ${email} ist bereits vergeben.`,
      );
    }

    const [angelegt] = await tx
      .insert(benutzer)
      .values({ kuerzel, name, email, passwortHash, berechtigung: 'administrator', passwortWechselNoetig: true })
      .$returningId();
    if (!angelegt) throw new Error('Administrator wurde nicht angelegt');

    await protokolliere(tx, {
      ereignis: 'einmalpasswort_vergeben',
      zeitpunkt: jetzt,
      benutzerId: angelegt.id,
      grund: 'erster Administrator per Kommandozeile',
    });
  });

  return { kuerzel, einmalpasswort };
}
