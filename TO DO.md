# To Do

1. Populate the MariaDB backend's remaining empty tables from the recovered data: `itemCategory`, `augmentOption`, `cannithCategoryOption`.
2. Build the actual backend/API (Node.js) that serves the app from MariaDB, using the `ddocraft_web` account.
3. Rewrite the client to consume the live API instead of the static `ddocraft.json` export. Once `itemCategory`'s real `allowsBlue/allowsYellow/allowsRed` data exists, this also resolves the `WEAPON_CATEGORIES` question (see Known Issues) and lets effect descriptions use `effectBonusByLevel` instead of a static description string.
4. Maybe do: an optional prepopulated dropdown of popular named/custom items, layered on top of manual entry, seeded once real usage data exists to mine (e.g. several independent users entering the same effect set for the same item name).
5. Better visual treatment for collapsed items (standard chevrons?).

## Known Issues

*(tracked, not urgent, not necessarily wrong — revisit when there's reason to)*

- The 12 `enchantment` rows excluded as `dataStatus='questionable'` (6 Resist/Insightful-Resist Light/Negative/Poison, 6 Insightful Ability per-stat) are believed correct but never independently re-verified. One data point cuts against the Insightful Ability exclusion specifically: `source_data/Effects.csv` has a real, populated per-level curve for it, same shape as every other genuine Insightful effect.
- `WEAPON_CATEGORIES` (Melee1/Melee2/Ranged) in `ddocraft.js` decides whether a custom item's augment-color options are weapon-style (Orange/Purple/Red) or not (Green). Shield, Rune Arm, and Orb are unresolved — could go either way pending real per-category augment-color data.
- The recovered enchantment master table was built from Cannith-crafting data, so it may be missing (effect, exotic-bonus-type) combinations that only exist on named items — e.g. an effect that normally stacks via an unusual bonus type when found on a named item might not have that bonus-type variant in the table. No fix proposed; unclear how big a problem this is in practice.
- `effectEquivalencyGroup`/`effectEquivalencyMember` (`db/ddocraft_schema.sql`) — the group+member+qualityScore design isn't clearly right, but no better alternative has surfaced either. Revisit once real supersedence data forces the question.
- `effectBonusByLevel` has no die-type column. Five effects (Bashing, all 24 Bane creature types, all 16 Damage(X) elemental/alignment types via both delivery types, Shield Spikes, Vampirism) are dice-based — the stored bonus is the die *count* only (die size: d6 for all of them except Bane which is d10, and Vampirism which is d2). Matters if the bonus value ever needs to drive real damage math instead of just display/comparison.
- Fear Immunity's `minLevelAugment` is 100 (the "not augmentable" sentinel used on ~181 rows), but the recovered comparison chart shows it augment-available at level 8 — same as its sibling Blindness Immunity, which is correctly set. Looks like a gap in the original recovered data; not corrected yet.
