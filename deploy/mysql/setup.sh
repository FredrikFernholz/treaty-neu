#!/usr/bin/env bash
# Legt die Datenbanken und MySQL-Benutzer für Treaty 2.0 an.
#
# Aufruf (einmalig, braucht MySQL-Root über den Unix-Socket):
#   sudo bash deploy/mysql/setup.sh
#
# Das Skript verändert nichts Bestehendes. Existiert eine der Datenbanken oder einer
# der Benutzer schon, bricht es ab, bevor etwas angelegt wird.
# Am Ende gibt es die Zeilen für backend/.env aus. Die Passwörter erscheinen nur dieses
# eine Mal und werden nirgends gespeichert.

set -euo pipefail

DB_NAME="treaty_neu"
DB_TEST_NAME="treaty_neu_test"
APP_USER="treaty_neu_app"              # Anwendung: nur Daten lesen und schreiben
MIGRATION_USER="treaty_neu_migration"  # Migrationen: darf das Schema ändern
SOCKET="/var/run/mysqld/mysqld.sock"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte mit sudo aufrufen: sudo bash deploy/mysql/setup.sh" >&2
  exit 1
fi

# Root meldet sich unter Ubuntu ohne Passwort über den Socket an (auth_socket).
sql() { mysql --protocol=socket --socket="$SOCKET" -u root --batch --skip-column-names -e "$1"; }

echo "Prüfe, ob Datenbanken oder Benutzer schon existieren ..."
vorhanden_db=$(sql "SELECT IFNULL(GROUP_CONCAT(SCHEMA_NAME SEPARATOR ', '), '') FROM information_schema.SCHEMATA
                    WHERE SCHEMA_NAME IN ('$DB_NAME', '$DB_TEST_NAME');")
vorhanden_user=$(sql "SELECT IFNULL(GROUP_CONCAT(User, '@', Host SEPARATOR ', '), '') FROM mysql.user
                      WHERE User IN ('$APP_USER', '$MIGRATION_USER');")

if [[ -n "$vorhanden_db" || -n "$vorhanden_user" ]]; then
  echo "Abbruch, folgende Namen sind schon vergeben:" >&2
  [[ -n "$vorhanden_db" ]] && echo "  Datenbank: $vorhanden_db" >&2
  [[ -n "$vorhanden_user" ]] && echo "  Benutzer:  $vorhanden_user" >&2
  echo "Es wurde nichts verändert." >&2
  exit 1
fi

# Zufällige Passwörter, nur Hex-Zeichen, damit sie ohne Anführungszeichen in .env passen.
APP_PASSWORD=$(openssl rand -hex 24)
MIGRATION_PASSWORD=$(openssl rand -hex 24)

# Hinweis zu GRANT: In Datenbanknamen ist "_" ein Platzhalter für ein beliebiges Zeichen.
# Deshalb wird es mit "\_" maskiert, sonst gälte das Recht z. B. auch für "treatyXtest".
DB_GRANT="${DB_NAME//_/\\_}"
DB_TEST_GRANT="${DB_TEST_NAME//_/\\_}"

echo "Lege Datenbanken und Benutzer an ..."
sql "
CREATE DATABASE \`$DB_NAME\`      CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE \`$DB_TEST_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Benutzer nur für Anmeldung über den lokalen Socket ('localhost').
CREATE USER '$APP_USER'@'localhost'       IDENTIFIED BY '$APP_PASSWORD';
CREATE USER '$MIGRATION_USER'@'localhost' IDENTIFIED BY '$MIGRATION_PASSWORD';

-- Anwendung: Daten lesen und ändern, aber keine Tabellen anlegen, ändern oder löschen.
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_GRANT\`.*      TO '$APP_USER'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_TEST_GRANT\`.* TO '$APP_USER'@'localhost';

-- Migrationen: alle Rechte innerhalb der beiden Datenbanken, aber nicht darüber hinaus
-- (keine anderen Datenbanken, keine Benutzerverwaltung, kein GRANT).
GRANT ALL PRIVILEGES ON \`$DB_GRANT\`.*      TO '$MIGRATION_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_TEST_GRANT\`.* TO '$MIGRATION_USER'@'localhost';
"

echo
echo "Fertig. Folgende Zeilen in backend/.env eintragen:"
echo
echo "DB_SOCKET=$SOCKET"
echo "DB_NAME=$DB_NAME"
echo "DB_TEST_NAME=$DB_TEST_NAME"
echo "DB_APP_USER=$APP_USER"
echo "DB_APP_PASSWORD=$APP_PASSWORD"
echo "DB_MIGRATION_USER=$MIGRATION_USER"
echo "DB_MIGRATION_PASSWORD=$MIGRATION_PASSWORD"
