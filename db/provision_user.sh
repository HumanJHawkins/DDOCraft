#!/usr/bin/env bash
# Creates the ddocraft database and two scoped accounts:
#   ddocraft_admin - developer/migration account (Claude's access): full control of ddocraft.*,
#     can adjust ddocraft_web's privileges later, read-only visibility into server accounts/grants.
#   ddocraft_web - the account the running application actually uses: ordinary data operations
#     only, no schema-change privileges.
#
# Neither account can create new accounts - CREATE USER is unavoidably a server-wide privilege in
# MariaDB, so it's deliberately not granted to either. Both accounts this app currently needs are
# just created directly here instead, while you're already running this as admin.
#
# Generates its own random passwords rather than taking them as arguments, so real credentials
# never have to be typed or pasted anywhere (including a chat transcript) - printed once, to this
# terminal only.
#
# Run as a user who can already administer MariaDB.
set -euo pipefail

DB_NAME="ddocraft"
ADMIN_USER="ddocraft_admin"
WEB_USER="ddocraft_web"
DB_HOST="%"   # '%' = any host. Tighten to the actual connecting IP once known - see chat.

MYSQL_CMD="sudo mysql"
# If root needs a password on this install instead of the unix_socket default, comment the line
#   above out and uncomment this one instead:
# MYSQL_CMD="mysql -u root -p"

ADMIN_PASSWORD="$(openssl rand -base64 24)"
WEB_PASSWORD="$(openssl rand -base64 24)"

$MYSQL_CMD <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE USER IF NOT EXISTS '${ADMIN_USER}'@'${DB_HOST}' IDENTIFIED BY '${ADMIN_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${ADMIN_USER}'@'${DB_HOST}' WITH GRANT OPTION;
GRANT SELECT ON mysql.user TO '${ADMIN_USER}'@'${DB_HOST}';
GRANT SELECT ON mysql.db TO '${ADMIN_USER}'@'${DB_HOST}';
GRANT SELECT ON mysql.tables_priv TO '${ADMIN_USER}'@'${DB_HOST}';
GRANT SELECT ON mysql.columns_priv TO '${ADMIN_USER}'@'${DB_HOST}';

CREATE USER IF NOT EXISTS '${WEB_USER}'@'${DB_HOST}' IDENTIFIED BY '${WEB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${WEB_USER}'@'${DB_HOST}';

FLUSH PRIVILEGES;
SQL

echo ""
echo "Created database '${DB_NAME}'."
echo "  ${ADMIN_USER}@${DB_HOST} password: ${ADMIN_PASSWORD}"
echo "  ${WEB_USER}@${DB_HOST} password: ${WEB_PASSWORD}"
echo "Save both now - neither is stored anywhere else, including this script."
