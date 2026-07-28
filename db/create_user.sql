-- Run this directly at the MariaDB prompt, connected as an account that can already administer
-- the server (e.g. after `sudo mysql`, or `mysql -u root -p` if root needs a password on this
-- install).
--
-- Creates two accounts:
--   ddocraft_admin - the developer/migration account (Claude's access): full control of the
--     ddocraft database (schema changes, all data operations), can adjust ddocraft_web's
--     privileges later without a new admin session, and has read-only visibility into which
--     accounts/grants already exist on the server.
--   ddocraft_web - the account the running application actually connects with. Deliberately
--     narrower: ordinary data operations only (SELECT/INSERT/UPDATE/DELETE) - no ability to
--     change the schema. Schema changes should go through ddocraft_admin, not the live app.
--
-- Neither account can create new accounts (CREATE USER is unavoidably a server-wide privilege in
-- MariaDB, so it's deliberately not granted here) - both accounts this app currently needs are
-- just created directly below instead, while you're already here as admin.
--
-- Replace both CHANGE_ME_* placeholders with real passwords before running. Safe to keep this
-- file around afterward (CREATE ... IF NOT EXISTS makes it idempotent) - just don't leave real
-- passwords sitting in it once you've run it; swap the lines back to placeholders.

CREATE DATABASE IF NOT EXISTS ddocraft CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Host is '%' (any host) below because the exact connecting address isn't known yet - see chat.
-- Tighten to a specific IP once that's settled (DROP USER and re-run to change it).

-- --- Developer/admin account ---
CREATE USER IF NOT EXISTS 'ddocraft_admin'@'%' IDENTIFIED BY 'CHANGE_ME_ADMIN_PASSWORD';

GRANT ALL PRIVILEGES ON ddocraft.* TO 'ddocraft_admin'@'%' WITH GRANT OPTION;

-- Read-only visibility into what accounts/grants exist on the server - narrowly scoped to just
--   the account/grant tables, not all of mysql.*.
GRANT SELECT ON mysql.user TO 'ddocraft_admin'@'%';
GRANT SELECT ON mysql.db TO 'ddocraft_admin'@'%';
GRANT SELECT ON mysql.tables_priv TO 'ddocraft_admin'@'%';
GRANT SELECT ON mysql.columns_priv TO 'ddocraft_admin'@'%';

-- --- Application/runtime account ---
CREATE USER IF NOT EXISTS 'ddocraft_web'@'%' IDENTIFIED BY 'CHANGE_ME_WEB_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE ON ddocraft.* TO 'ddocraft_web'@'%';

FLUSH PRIVILEGES;

-- Verify scope afterward with:
--   SHOW GRANTS FOR 'ddocraft_admin'@'%';
--   SHOW GRANTS FOR 'ddocraft_web'@'%';
--   SELECT User, Host FROM mysql.user;   -- see everything else already on this server
