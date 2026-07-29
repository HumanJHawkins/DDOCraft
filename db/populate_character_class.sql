-- Seeds characterClass with DDO's 15 base classes, taken directly from the existing forBarbarian-
--   style filter checkboxes in ddocraft.php (the authoritative source for this project - see the
--   characterClass table comment in db/ddocraft_schema.sql). Alphabetical sort order; no Iconic
--   Hero rows yet, pending confirmation of the current roster.

INSERT INTO characterClass (className, parentClassId, characterClassSortOrder, createBy, updateBy) VALUES
    ('Alchemist',    NULL, 10, 'ddocraft_admin', 'ddocraft_admin'),
    ('Artificer',    NULL, 20, 'ddocraft_admin', 'ddocraft_admin'),
    ('Barbarian',    NULL, 30, 'ddocraft_admin', 'ddocraft_admin'),
    ('Bard',         NULL, 40, 'ddocraft_admin', 'ddocraft_admin'),
    ('Cleric',       NULL, 50, 'ddocraft_admin', 'ddocraft_admin'),
    ('Druid',        NULL, 60, 'ddocraft_admin', 'ddocraft_admin'),
    ('Favored Soul', NULL, 70, 'ddocraft_admin', 'ddocraft_admin'),
    ('Fighter',      NULL, 80, 'ddocraft_admin', 'ddocraft_admin'),
    ('Monk',         NULL, 90, 'ddocraft_admin', 'ddocraft_admin'),
    ('Paladin',      NULL, 100, 'ddocraft_admin', 'ddocraft_admin'),
    ('Ranger',       NULL, 110, 'ddocraft_admin', 'ddocraft_admin'),
    ('Rogue',        NULL, 120, 'ddocraft_admin', 'ddocraft_admin'),
    ('Sorcerer',     NULL, 130, 'ddocraft_admin', 'ddocraft_admin'),
    ('Warlock',      NULL, 140, 'ddocraft_admin', 'ddocraft_admin'),
    ('Wizard',       NULL, 150, 'ddocraft_admin', 'ddocraft_admin');
