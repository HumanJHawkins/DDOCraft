-- Builds the two views behind GET /api/catalog (server/src/routes/catalog.ts), which replaces the
-- static ddocraft.json export as the client's source for its whole item/slot/color/effect catalog.
-- Reconstructs the exact flat row shape ddocraft.json already produced (see
-- source_data/export_ddocraft_json.py's FIELD_ORDER and ddocraft.js's buildCatalog()) from the
-- normalized tables, so the client needs no changes beyond which URL it fetches from. Added
-- 2026-07-30 as part of retiring the SQLite/JSON export pipeline (see TO DO.md item 1/2).
--
-- Design notes:
--   - A Cannith item is always "Cannith " + itemCategoryName (formulaic, see itemCategory's own
--     comment) - no item table exists or is needed.
--   - Augment slot COUNT (always exactly 2 per category, 0 for Rune Arm/Trinket) is an app-layer
--     assumption the schema deliberately doesn't own (see itemCategory's comment) - confirmed by
--     inspecting the live ddocraft.json directly rather than guessing: every category with any of
--     allowsBlue/allowsYellow/allowsRed offers exactly "Augment 1" and "Augment 2". Synthesized here
--     via a literal 2-row (1, 2) derived table crossed with each category's eligible colors.
--   - Colors are NOT uniformly identical between the two numbered slots for Melee1/Melee2/Ranged/
--     Orb specifically - a real DDO rule (per Jeff, correcting an initial wrong assumption here that
--     this was a data gap to "fix"): a weapon/orb always has exactly one Red-eligible slot, never
--     Blue and Yellow both offered together. Augment 1 for these 4 categories is Colorless+Red only
--     (Orb: Colorless only, since it was never Red-eligible at all); Augment 2 gets the full set.
--     Every other category is genuinely uniform between its two slots (verified by diffing this
--     view's full output against ddocraft.json row-for-row - zero discrepancies once this exception
--     was added). Encoded as a literal exception below, not a derived/generalized rule, specifically
--     because getting the general case wrong once already is reason enough not to guess further at
--     the underlying game mechanic.
--   - Colorless is universally available once a category has ANY augment slot, matching
--     augmentColor's own comment ("every category is eligible for it").
--   - Green/Orange/Purple never appear as real augmentColor values for Cannith rendering - verified
--     against ddocraft.json directly (every category's augment rows only ever use Blue/Yellow/Red/
--     Colorless). They're purely a custom-item-only combo concept handled client-side
--     (AUGMENT_COMBO_COLORS in ddocraft.js), never a real color a Cannith slot exposes.
--   - enchSupercededBy is reconstructed from effectEquivalencyGroup/Member (populated for the first
--     time 2026-07-30 - see db/populate_effect_equivalency.sql) rather than the retired flat
--     column: a member's supersededBy is the name of any other same-group member with a strictly
--     higher qualityScore, matching the "universal option is usually strictly better" relationship
--     that table was designed around. Groups/members not yet populated for a given effect simply
--     leave it NULL, same as an effect that was never in a supersedence relationship at all.
--   - Effects with no binding anywhere (a handful of PHASE 3-only rows - Adamantine (Armor),
--     Mithril, Insightful Skill (Use Magic Device), Damage Reduction, Superior Nimbleness, Tourney
--     Armor Extras) still need to appear once, with null category/item/slot/color - buildCatalog()
--     needs every effect in charData.enchantments regardless of catalog binding, for the PHASE 3
--     custom-item inherent-effects picker (a flat, unfiltered-by-category list). The second UNION
--     ALL branch below covers exactly this.

DROP VIEW IF EXISTS vw_catalogFlat;
DROP VIEW IF EXISTS vw_catalogBinding;

CREATE VIEW vw_catalogBinding AS
    -- Non-augment slots: Prefix/Suffix/Extra, one row per (category, slot, effect).
    SELECT
        ic.itemCategoryName                    AS itemOptionCategory,
        CONCAT('Cannith ', ic.itemCategoryName) AS itemOptionItem,
        cco.slotType                           AS itemOptionSlot,
        ''                                      AS augmentColor,
        cco.effectId                           AS effectId,
        cco.cannithCategoryOptionSortOrder     AS itemOptionSortOrder,
        -- Matches the real row order already in ddocraft.json (Augment 1, Augment 2, Prefix,
        --   Suffix, Extra) - see the comment above; JS object key insertion order is what actually
        --   drives render order client-side, not just cosmetic.
        CASE cco.slotType WHEN 'Prefix' THEN 3 WHEN 'Suffix' THEN 4 WHEN 'Extra' THEN 5 END AS slotOrderRank
    FROM cannithCategoryOption cco
    JOIN itemCategory ic ON ic.itemCategoryId = cco.itemCategoryId

    UNION ALL

    -- Augment slots: synthesized "Augment 1"/"Augment 2", one row per (category, slot number,
    --   color, effect) - candidates are identical between the two numbered slots since the
    --   underlying augmentOption pool is per-color, not per-slot.
    SELECT
        ic.itemCategoryName                    AS itemOptionCategory,
        CONCAT('Cannith ', ic.itemCategoryName) AS itemOptionItem,
        CONCAT('Augment ', slotNum.n)           AS itemOptionSlot,
        ac.augmentColorName                    AS augmentColor,
        ao.effectId                            AS effectId,
        ao.augmentOptionSortOrder              AS itemOptionSortOrder,
        slotNum.n                              AS slotOrderRank  -- 1 or 2, sorts before Prefix(3)
    FROM itemCategory ic
    CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2) slotNum
    JOIN augmentColor ac
        ON ac.augmentColorName = 'Colorless'
        OR (ac.augmentColorName = 'Red' AND ic.allowsRed)
        OR (ac.augmentColorName = 'Blue' AND ic.allowsBlue
            AND NOT (slotNum.n = 1 AND ic.itemCategoryName IN ('Melee1', 'Melee2', 'Ranged', 'Orb')))
        OR (ac.augmentColorName = 'Yellow' AND ic.allowsYellow
            AND NOT (slotNum.n = 1 AND ic.itemCategoryName IN ('Melee1', 'Melee2', 'Ranged', 'Orb')))
    JOIN augmentOption ao ON ao.augmentColorId = ac.augmentColorId
    WHERE ic.allowsBlue OR ic.allowsYellow OR ic.allowsRed;

CREATE VIEW vw_catalogFlat AS
    SELECT itemOptionSortOrder, enchSortOrder, itemOptionItem, itemOptionCategory, itemOptionSlot,
           augmentColor, itemOptionEnchantment, enchName, enchEffectType, enchCannithMinLevel,
           enchAugmentMinLevel, enchDesc, enchSupercededBy, allEnch, basic, nonscaling, forMeleeDmg,
           forRangedDmg, forACDefence, forResistDefence, forHitPoints
    FROM (
        SELECT
            cb.itemOptionSortOrder,
            e.effectSortOrder                                          AS enchSortOrder,
            cb.itemOptionItem,
            cb.itemOptionCategory,
            cb.itemOptionSlot,
            cb.augmentColor,
            e.effectName                                                AS itemOptionEnchantment,
            e.effectName                                                AS enchName,
            CONCAT(bt.bonusTypeName, '-', e.effectKey)                  AS enchEffectType,
            e.minLevelCannith                                           AS enchCannithMinLevel,
            e.minLevelAugment                                           AS enchAugmentMinLevel,
            e.effectDescription                                         AS enchDesc,
            (SELECT e2.effectName
             FROM effectEquivalencyMember m1
             JOIN effectEquivalencyMember m2
                 ON m2.effectEquivalencyGroupId = m1.effectEquivalencyGroupId AND m2.effectId <> m1.effectId
             JOIN effect e2 ON e2.effectId = m2.effectId
             WHERE m1.effectId = e.effectId AND m2.qualityScore > m1.qualityScore
             ORDER BY m2.qualityScore DESC LIMIT 1)                      AS enchSupercededBy,
            e.allEnch, e.basic, e.nonscaling,
            e.forMeleeDmg, e.forRangedDmg, e.forACDefence, e.forResistDefence, e.forHitPoints,
            -- Sort-only columns, dropped by the outer SELECT below - not part of the client's
            --   expected shape, just here to drive the final ORDER BY correctly across the UNION.
            ic.itemCategorySortOrder                                    AS sortCategoryOrder,
            cb.slotOrderRank                                            AS sortSlotOrder
        FROM vw_catalogBinding cb
        JOIN effect e ON e.effectId = cb.effectId
        LEFT JOIN bonusType bt ON bt.bonusTypeId = e.bonusTypeId
        JOIN itemCategory ic ON ic.itemCategoryName = cb.itemOptionCategory

        UNION ALL

        -- Effects with no catalog binding at all - see the comment above. Sort position among
        --   themselves/relative to bound rows doesn't matter - buildCatalog() skips them for
        --   catalog purposes entirely (no itemOptionCategory to key off), they only need to exist
        --   somewhere in the array for charData.enchantments.
        SELECT
            NULL, e.effectSortOrder, NULL, NULL, NULL, NULL,
            e.effectName, e.effectName,
            CONCAT(bt.bonusTypeName, '-', e.effectKey),
            e.minLevelCannith, e.minLevelAugment, e.effectDescription,
            (SELECT e2.effectName
             FROM effectEquivalencyMember m1
             JOIN effectEquivalencyMember m2
                 ON m2.effectEquivalencyGroupId = m1.effectEquivalencyGroupId AND m2.effectId <> m1.effectId
             JOIN effect e2 ON e2.effectId = m2.effectId
             WHERE m1.effectId = e.effectId AND m2.qualityScore > m1.qualityScore
             ORDER BY m2.qualityScore DESC LIMIT 1),
            e.allEnch, e.basic, e.nonscaling,
            e.forMeleeDmg, e.forRangedDmg, e.forACDefence, e.forResistDefence, e.forHitPoints,
            NULL, NULL
        FROM effect e
        LEFT JOIN bonusType bt ON bt.bonusTypeId = e.bonusTypeId
        WHERE e.effectId NOT IN (SELECT effectId FROM vw_catalogBinding)
    ) combined
    ORDER BY (sortCategoryOrder IS NULL), sortCategoryOrder, sortSlotOrder, augmentColor, itemOptionSortOrder;
