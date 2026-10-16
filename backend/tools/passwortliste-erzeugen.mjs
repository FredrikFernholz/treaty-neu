// Erzeugt die beiden Listen häufiger Passwörter für Treaty (Entscheidung 16.10.2026).
//
// Aufruf (braucht Internetzugang zu raw.githubusercontent.com):
//   node /home/treaty-neu/backend/tools/passwortliste-erzeugen.mjs
//
// Ergebnis, beide im Repository eingecheckt:
//   backend/src/modules/anmeldung/daten/haeufige-passwoerter-seclists.txt
//   backend/src/modules/anmeldung/daten/haeufige-passwoerter-eigene.txt
//
// Die Quelldatei mit 1 Million Einträgen wird nur in den Speicher geladen und nicht
// gespeichert. Ihre Prüfsumme ist unten fest hinterlegt. Weicht sie ab, bricht das
// Skript ab, damit die Liste nicht unbemerkt aus anderen Daten entsteht. Zweimal
// ausgeführt ergibt das Skript byteweise dieselben Dateien.

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const REPOSITORY = 'https://github.com/danielmiessler/SecLists';
const COMMIT = 'f1196104c5594a19d78b486c52c0794b9d947993';
const COMMIT_DATUM = '2026-10-15';
const PFAD = 'Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt';
const SHA256_QUELLE = '424a3e03a17df0a2bc2b3ca749d81b04e79d59cb7aeec8876a5a3f308d0caf51';
const SHA256_LIZENZ = '3dbdc93d5f8829de0941744841730a09c106d0732e5ae0e98ca1d77be7ded66c';

const ANZAHL = 10000;
const MINDESTLAENGE = 12; // wie PASSWORT_MINDESTLAENGE in shared/schemas/passwort.ts

const ZIEL = new URL('../src/modules/anmeldung/daten/', import.meta.url);

const sha256 = (daten) => createHash('sha256').update(daten).digest('hex');
const zeichen = (text) => [...text].length;

async function lade(pfad, erwartet) {
  const url = `https://raw.githubusercontent.com/danielmiessler/SecLists/${COMMIT}/${pfad}`;
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`${url}: HTTP ${antwort.status}`);
  const daten = Buffer.from(await antwort.arrayBuffer());
  const ist = sha256(daten);
  if (ist !== erwartet) throw new Error(`${pfad}: SHA-256 ${ist}, erwartet ${erwartet}`);
  return daten.toString('utf8');
}

/** Schreibt eine Liste mit Kommentarkopf. Gibt die Prüfsumme des Inhalts unter dem Kopf zurück. */
function schreibe(dateiname, kopf, eintraege) {
  const inhalt = eintraege.map((e) => `${e}\n`).join('');
  const shaInhalt = sha256(inhalt);
  const kopfText = kopf
    .map((zeile) => zeile.replace('{SHA_INHALT}', shaInhalt))
    .map((zeile) => (zeile === '' ? '#\n' : `# ${zeile}\n`))
    .join('');
  writeFileSync(new URL(dateiname, ZIEL), `${kopfText}# Ende des Kopfs\n${inhalt}`);
  return shaInhalt;
}

// ---------------------------------------------------------------------------
// 1. Liste aus SecLists
// ---------------------------------------------------------------------------
//
// Filterregel, in dieser Reihenfolge über die nach Häufigkeit sortierte Quelle:
//  - Leerzeilen überspringen
//  - Zeilen mit # am Anfang überspringen, weil # in unseren Dateien Kommentare einleitet
//  - Zeilen mit Steuerzeichen (Codepunkt unter 32 oder 127) überspringen
//  - Zeilen mit weniger als 12 Zeichen überspringen
//  - Zeilen überspringen, die sich von einem früheren Eintrag nur in Groß- und
//    Kleinschreibung unterscheiden, weil Treaty ohnehin ohne Beachtung der Groß- und
//    Kleinschreibung vergleicht
//  - nach 10.000 Einträgen aufhören
// Die Einträge bleiben sonst unverändert und in der Reihenfolge der Quelle.

const quelle = await lade(PFAD, SHA256_QUELLE);
const lizenz = (await lade('LICENSE', SHA256_LIZENZ)).trimEnd().split('\n');

const auswahl = [];
const gesehen = new Set();
let letzteQuellzeile = 0;
for (const [index, zeile] of quelle.split('\n').entries()) {
  if (auswahl.length === ANZAHL) break;
  if (zeile === '' || zeile.startsWith('#')) continue;
  if (/[\u0000-\u001f\u007f]/.test(zeile)) continue;
  if (zeichen(zeile) < MINDESTLAENGE) continue;
  const schluessel = zeile.toLowerCase();
  if (gesehen.has(schluessel)) continue;
  gesehen.add(schluessel);
  auswahl.push(zeile);
  letzteQuellzeile = index + 1;
}
if (auswahl.length !== ANZAHL) throw new Error(`Nur ${auswahl.length} Einträge gefunden`);

const shaSeclists = schreibe(
  'haeufige-passwoerter-seclists.txt',
  [
    `Häufige Passwörter mit mindestens ${MINDESTLAENGE} Zeichen, die ${ANZAHL.toLocaleString('de-DE')} häufigsten aus SecLists`,
    '',
    `Quelle:     ${REPOSITORY}`,
    `Pfad:       ${PFAD}`,
    `Commit:     ${COMMIT} (${COMMIT_DATUM})`,
    `SHA-256 der Quelldatei: ${SHA256_QUELLE}`,
    'Herkunft der Daten laut Passwords/Common-Credentials/README.md in SecLists: Datensatz',
    '"ten million passwords" von Mark Burnett (xato.net, 2015), nach Häufigkeit sortiert.',
    '',
    'Erzeugt mit backend/tools/passwortliste-erzeugen.mjs. Filterregel über die Quelle, in',
    'dieser Reihenfolge: Leerzeilen, Zeilen mit # am Anfang (Kommentarzeichen dieser Datei)',
    `und Zeilen mit Steuerzeichen überspringen, dann nur Einträge mit mindestens ${MINDESTLAENGE} Zeichen,`,
    'ohne Einträge, die sich von einem früheren nur in Groß- und Kleinschreibung',
    `unterscheiden, bis ${ANZAHL.toLocaleString('de-DE')} Einträge erreicht sind (letzter aus Zeile ${letzteQuellzeile.toLocaleString('de-DE')}`,
    'der Quelle). Reihenfolge und Schreibweise wie in der Quelle.',
    'SHA-256 des Inhalts unter dem Kopf: {SHA_INHALT}',
    '',
    'Verwendung: Treaty lehnt ein neues Passwort ab, wenn es ohne Beachtung der Groß- und',
    'Kleinschreibung in dieser Liste steht (Entscheidung 16.10.2026).',
    '',
    'Lizenz von SecLists am genannten Commit (Datei LICENSE), unverändert:',
    '',
    ...lizenz,
    '',
  ],
  auswahl,
);

// ---------------------------------------------------------------------------
// 2. Eigene Ergänzung
// ---------------------------------------------------------------------------
//
// Firmenbegriffe und deutsche Muster, die in englischen Listen fehlen. Alle Einträge
// klein geschrieben, nur Einträge mit mindestens 12 Zeichen, ohne Doppelte.

const JAHRE = Array.from({ length: 11 }, (_, i) => String(2020 + i)); // 2020 bis 2030

const FIRMENBEGRIFFE = [
  'adh', 'treaty', 'adhdeutschland', 'adhgmbh', 'adhdeutschlandgmbh', 'adhtreaty', 'treatyadh',
  'adh deutschland', 'adh-deutschland', 'adh.deutschland', 'adh deutschland gmbh',
  'adh-deutschland-gmbh', 'adh gmbh', 'adh-gmbh', 'treaty2.0', 'treaty 2.0', 'treaty-2.0',
  'adh treaty', 'adh-treaty', 'treaty adh',
];
const DEUTSCHE_WOERTER = [
  'passwort', 'willkommen', 'hallo', 'geheim', 'sommer', 'winter', 'frühling', 'fruehling', 'herbst',
];
// Tastaturfolgen auf der deutschen QWERTZ-Tastatur
const QWERTZ = [
  'qwertzuiopü+', 'qwertzuiop12', 'qwertzuiop123', 'qwertzuiop1234', 'qwertzuiop!!',
  'qwertzqwertz', 'qwertz123456', '123456qwertz', 'qwertzasdfgh', 'qwertzuiopasdfghjkl',
  'asdfghjklöä#', 'qayxswedcvfr', '1qay2wsx3edc', 'yxcvbnmasdfg',
];
// Zahlenfolgen
const ZAHLEN = [
  ...Array.from({ length: 9 }, (_, i) => '12345678901234567890'.slice(0, 12 + i)), // 12 bis 20 Stellen
  '012345678901', '987654321098', '098765432109', '987654321987',
  '121212121212', '123123123123', '123412341234', '112233445566', '123456123456', '123456654321',
  ...Array.from({ length: 10 }, (_, z) => String(z).repeat(12)), // 000000000000 bis 999999999999
];

const eigene = [];
const mitJahr = (begriff) => [begriff, ...JAHRE.flatMap((j) => [`${begriff}${j}`, `${begriff}${j}!`])];
for (const eintrag of [
  ...FIRMENBEGRIFFE.flatMap(mitJahr),
  ...DEUTSCHE_WOERTER.flatMap(mitJahr),
  ...QWERTZ,
  ...ZAHLEN,
]) {
  const klein = eintrag.toLowerCase();
  if (zeichen(klein) >= MINDESTLAENGE && !eigene.includes(klein)) eigene.push(klein);
}

const shaEigene = schreibe(
  'haeufige-passwoerter-eigene.txt',
  [
    'Häufige Passwörter, eigene Ergänzung (Entscheidung 16.10.2026)',
    '',
    'Ergänzt die Liste aus SecLists um Begriffe, die bei ADH naheliegen, und um deutsche',
    'Muster, die in englischen Listen fehlen. Enthalten sind:',
    ' - adh, treaty und der Firmenname ADH Deutschland GmbH in verschiedenen Schreibweisen',
    ' - Passwort, Willkommen, Hallo, Geheim, Sommer, Winter, Frühling (auch fruehling), Herbst',
    ' - diese Begriffe jeweils allein und mit einer Jahreszahl von 2020 bis 2030, ohne und',
    '   mit angehängtem Ausrufezeichen',
    ' - Tastaturfolgen auf der deutschen QWERTZ-Tastatur und Zahlenfolgen',
    `Aufgenommen sind nur Einträge mit mindestens ${MINDESTLAENGE} Zeichen, kürzere fängt schon die`,
    'Mindestlänge ab. Alles klein geschrieben, weil ohne Beachtung der Groß- und',
    'Kleinschreibung verglichen wird.',
    '',
    'Erzeugt mit backend/tools/passwortliste-erzeugen.mjs, Änderungen bitte dort vornehmen.',
    'SHA-256 des Inhalts unter dem Kopf: {SHA_INHALT}',
    '',
  ],
  eigene,
);

console.log(`SecLists: ${auswahl.length} Einträge, letzter aus Zeile ${letzteQuellzeile}, SHA-256 Inhalt ${shaSeclists}`);
console.log(`Eigene Ergänzung: ${eigene.length} Einträge, SHA-256 Inhalt ${shaEigene}`);
