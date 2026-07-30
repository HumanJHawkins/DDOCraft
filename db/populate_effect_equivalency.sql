-- Populates effectEquivalencyGroup/effectEquivalencyMember (db/ddocraft_schema.sql), previously
-- designed but never populated. Carries over the 5 known supersedence relationships that used to
-- live in the old flat enchSupercededBy column (source_data/equipDDO.sqlite's enchantment table,
-- surfaced via ddocraft.json) - migrated 2026-07-30 as part of building the /api/catalog endpoint,
-- which needs a way to reconstruct enchSupercededBy for buildCatalog() without depending on the
-- old SQLite/JSON pipeline at all.
--
-- qualityScore is given real values here rather than left NULL, specifically so direction can be
-- recovered: /api/catalog's view treats a group member's enchSupercededBy as the name of any other
-- same-group member with a strictly higher qualityScore (2 = the broader/superceding effect,
-- 1 = the specific/superceded one) - exactly the "universal option usually strictly better than
-- one specific case it covers" relationship the schema comment on effectEquivalencyMember
-- describes, just populated for the first time here.

INSERT INTO effectEquivalencyGroup (groupLabel, createBy, updateBy)
VALUES ('Alignment', 'ddocraft_migration', 'ddocraft_migration');
SET @alignmentGroup = LAST_INSERT_ID();

INSERT INTO effectEquivalencyGroup (groupLabel, createBy, updateBy)
VALUES ('True Sight vs Blindness Immunity', 'ddocraft_migration', 'ddocraft_migration');
SET @trueSightGroup = LAST_INSERT_ID();

INSERT INTO effectEquivalencyMember (effectEquivalencyGroupId, effectId, qualityScore, createBy, updateBy)
SELECT @alignmentGroup, effectId, CASE effectName WHEN 'Aligned' THEN 2 ELSE 1 END,
       'ddocraft_migration', 'ddocraft_migration'
FROM effect WHERE effectName IN ('Aligned', 'Chaos Aligned', 'Evil Aligned', 'Good Aligned', 'Law Aligned');

INSERT INTO effectEquivalencyMember (effectEquivalencyGroupId, effectId, qualityScore, createBy, updateBy)
SELECT @trueSightGroup, effectId, CASE effectName WHEN 'True Sight' THEN 2 ELSE 1 END,
       'ddocraft_migration', 'ddocraft_migration'
FROM effect WHERE effectName IN ('True Sight', 'Blindness Immunity');
