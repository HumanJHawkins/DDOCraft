-- Adds Flametouched Iron, Crystal, and Transmuting to MariaDB's effect table, plus their
-- augmentOption/cannithCategoryOption bindings. Same gap as db/populate_effect_equivalency.sql and
-- db/populate_insightful_ability.sql: these 3 weapon materials were added to equipDDO.sqlite
-- 2026-07-28 (see TO DO.md's Known Issues - "new weapon materials added 2026-07-28... placeholder/
-- TBD enchAugmentMinLevel values, same caveat as the other TEMP/TEST DATA rows") after MariaDB's
-- effect table was already populated, and never got synced. Found 2026-07-30 the same way as the
-- other two gaps - diffing /api/catalog's output against ddocraft.json row-for-row.

INSERT INTO effect
    (effectName, effectKey, bonusTypeId, effectGroup, effectDescription, effectSortOrder,
     minLevelCannith, minLevelAugment, allEnch, basic, nonscaling, forMeleeDmg, forRangedDmg,
     forACDefence, forResistDefence, forHitPoints, createBy, updateBy)
SELECT 'Flametouched Iron', 'Bypass Flametouched Iron', bt.bonusTypeId, 'Damage (Bypass Defense)',
       'TEMP/TEST DATA - real min level TBD. Material flag to Bypass Flametouched Iron', 90003,
       1, 4, 1, 0, 1, 1, 1, 0, 0, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Untyped'
UNION ALL
SELECT 'Crystal', 'Bypass Crystal', bt.bonusTypeId, 'Damage (Bypass Defense)',
       'TEMP/TEST DATA - real min level TBD. Material flag to Bypass Crystal', 90004,
       1, 20, 1, 0, 1, 1, 1, 0, 0, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Untyped'
UNION ALL
SELECT 'Transmuting', 'Bypass All DR', bt.bonusTypeId, 'Damage (Bypass Defense)',
       'TEMP/TEST DATA - real min level TBD. Untyped flag to bypass any/all damage reduction - material, alignment, or otherwise. Metalline note: acts as one of the specific metal types for bypass purposes, NOT as a Crystal-bypass substitute.',
       90005, 1, 100, 1, 0, 1, 3, 1, 0, 0, 0, 'ddocraft_migration', 'ddocraft_migration'
FROM bonusType bt WHERE bt.bonusTypeName = 'Untyped';

-- Flametouched Iron / Crystal: Red augment, Melee1/Melee2/Ranged only.
INSERT INTO augmentOption (effectId, augmentColorId, createBy, updateBy)
SELECT e.effectId, ac.augmentColorId, 'ddocraft_migration', 'ddocraft_migration'
FROM effect e
CROSS JOIN augmentColor ac
WHERE e.effectName IN ('Flametouched Iron', 'Crystal')
  AND ac.augmentColorName = 'Red';

-- Transmuting: Suffix, Melee1/Melee2/Ranged only.
INSERT INTO cannithCategoryOption (itemCategoryId, slotType, effectId, createBy, updateBy)
SELECT ic.itemCategoryId, 'Suffix', e.effectId, 'ddocraft_migration', 'ddocraft_migration'
FROM effect e
CROSS JOIN itemCategory ic
WHERE e.effectName = 'Transmuting'
  AND ic.itemCategoryName IN ('Melee1', 'Melee2', 'Ranged');
