-- Adds the 6 "Insightful Ability" per-stat effects to MariaDB's effect table, plus their
-- augmentOption/cannithCategoryOption bindings. These were excluded from the original 2026-07-28
-- migration (db/populate_effect.py) because equipDDO.sqlite's enchantment.dataStatus still flagged
-- them 'questionable' at that time - a later correction (reversing that flag, per Done.md/memory)
-- landed in the SQLite source and its ddocraft.json export, but was never re-synced into MariaDB.
-- Discovered 2026-07-30 while building /api/catalog and diffing its output against ddocraft.json
-- row-for-row - found here, not guessed. Field values and binding pattern pulled directly from the
-- corrected source_data/equipDDO.sqlite and the current ddocraft.json (each stat's Extra-slot
-- category list genuinely differs - Strength binds to Belt/Bracers/Gloves/Trinket, Dexterity to
-- Boots/Gloves/Ring1/Ring2/Trinket, etc. - not a uniform pattern, so each is listed explicitly
-- rather than assumed symmetric).

INSERT INTO effect
    (effectName, effectKey, bonusTypeId, effectGroup, effectDescription, effectSortOrder,
     minLevelCannith, minLevelAugment, allEnch, basic, nonscaling, forMeleeDmg, forRangedDmg,
     forACDefence, forResistDefence, forHitPoints, createBy, updateBy)
SELECT 'Insightful Ability (Charisma)', 'CHA', bt.bonusTypeId, 'Ability', 'Insight bonus to CHA', 448,
       10, 24, 1, 0, 0, 0, 0, 0, 0, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Insight'
UNION ALL
SELECT 'Insightful Ability (Constitution)', 'CON', bt.bonusTypeId, 'Ability', 'Insight bonus to CON', 512,
       10, 24, 1, 1, 0, 0, 0, 0, 8, 32, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Insight'
UNION ALL
SELECT 'Insightful Ability (Dexterity)', 'DEX', bt.bonusTypeId, 'Ability', 'Insight bonus to DEX', 576,
       10, 24, 1, 1, 0, 16, 32, 16, 8, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Insight'
UNION ALL
SELECT 'Insightful Ability (Intelligence)', 'INT', bt.bonusTypeId, 'Ability', 'Insight bonus to INT', 640,
       10, 24, 1, 0, 0, 0, 0, 0, 0, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Insight'
UNION ALL
SELECT 'Insightful Ability (Strength)', 'STR', bt.bonusTypeId, 'Ability', 'Insight bonus to STR', 704,
       10, 24, 1, 0, 0, 32, 16, 0, 0, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Insight'
UNION ALL
SELECT 'Insightful Ability (Wisdom)', 'WIS', bt.bonusTypeId, 'Ability', 'Insight bonus to WIS', 768,
       10, 24, 1, 0, 0, 0, 0, 0, 16, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Insight';

-- Colorless augment binding, universal across every category that has augment slots at all - same
-- rule vw_catalogBinding already applies to every other Colorless-eligible effect.
INSERT INTO augmentOption (effectId, augmentColorId, createBy, updateBy)
SELECT e.effectId, ac.augmentColorId, 'ddocraft_migration', 'ddocraft_migration'
FROM effect e
CROSS JOIN augmentColor ac
WHERE e.effectName LIKE 'Insightful Ability (%'
  AND ac.augmentColorName = 'Colorless';

-- Extra-slot bindings - genuinely different category list per stat, taken directly from
-- ddocraft.json rather than assumed uniform.
INSERT INTO cannithCategoryOption (itemCategoryId, slotType, effectId, createBy, updateBy)
SELECT ic.itemCategoryId, 'Extra', e.effectId, 'ddocraft_migration', 'ddocraft_migration'
FROM effect e
JOIN itemCategory ic ON (
    (e.effectName = 'Insightful Ability (Charisma)'    AND ic.itemCategoryName IN ('Cloak','Necklace','Ring1','Ring2','Trinket')) OR
    (e.effectName = 'Insightful Ability (Constitution)' AND ic.itemCategoryName IN ('Belt','Necklace','Ring1','Ring2','Trinket')) OR
    (e.effectName = 'Insightful Ability (Dexterity)'    AND ic.itemCategoryName IN ('Boots','Gloves','Ring1','Ring2','Trinket')) OR
    (e.effectName = 'Insightful Ability (Intelligence)' AND ic.itemCategoryName IN ('Cloak','Goggles','Helm','Trinket')) OR
    (e.effectName = 'Insightful Ability (Strength)'     AND ic.itemCategoryName IN ('Belt','Bracers','Gloves','Trinket')) OR
    (e.effectName = 'Insightful Ability (Wisdom)'       AND ic.itemCategoryName IN ('Cloak','Goggles','Helm','Trinket'))
)
WHERE e.effectName LIKE 'Insightful Ability (%';
