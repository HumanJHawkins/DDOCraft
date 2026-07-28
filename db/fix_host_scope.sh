#!/usr/bin/env bash
# One-time correction: recreates ddocraft_admin/ddocraft_web scoped to 'localhost' instead of '%'
# (any host). MariaDB is bound to 127.0.0.1 - the only way in is an SSH tunnel terminating on this
# same box, so every legitimate connection will always appear to originate from localhost anyway.
# '%' worked (it's a superset that includes localhost) but was more permissive than the real
# architecture calls for, for no benefit.
#
# Regenerates both passwords rather than trying to preserve the old ones, since the old '%'
# accounts are being dropped regardless. Run as the same admin account used for provision_user.sh.
set -euo pipefail

DB_NAME="ddocraft"
ADMIN_USER="ddocraft_admin"
WEB_USER="ddocraft_web"
OLD_HOST="%"
NEW_HOST="localhost"

MYSQL_CMD="mysql -u root -p"
# If the unix-socket default works instead on this box, use this line instead:
# MYSQL_CMD="sudo mysql"

ADMIN_PASSWORD="$(openssl rand -base64 24)"
WEB_PASSWORD="$(openssl rand -base64 24)"

$MYSQL_CMD <<SQL
CREATE USER '${ADMIN_USER}'@'${NEW_HOST}' IDENTIFIED BY '${ADMIN_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${ADMIN_USER}'@'${NEW_HOST}' WITH GRANT OPTION;
GRANT SELECT ON mysql.user TO '${ADMIN_USER}'@'${NEW_HOST}';
GRANT SELECT ON mysql.db TO '${ADMIN_USER}'@'${NEW_HOST}';
GRANT SELECT ON mysql.tables_priv TO '${ADMIN_USER}'@'${NEW_HOST}';
GRANT SELECT ON mysql.columns_priv TO '${ADMIN_USER}'@'${NEW_HOST}';
DROP USER '${ADMIN_USER}'@'${OLD_HOST}';

CREATE USER '${WEB_USER}'@'${NEW_HOST}' IDENTIFIED BY '${WEB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${WEB_USER}'@'${NEW_HOST}';
DROP USER '${WEB_USER}'@'${OLD_HOST}';

FLUSH PRIVILEGES;
SQL

echo ""
echo "Re-scoped both accounts to '${NEW_HOST}'. New passwords (save now, printed only here):"
echo "  ${ADMIN_USER}@${NEW_HOST} password: ${ADMIN_PASSWORD}"
echo "  ${WEB_USER}@${NEW_HOST} password: ${WEB_PASSWORD}"
