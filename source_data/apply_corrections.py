"""
Applies deliberate corrections/decisions on top of the raw recovered data in equipDDO.sqlite.
Run build_db.py first (it rebuilds from CSV and wipes prior corrections), then this script.
Kept separate from build_db.py so "what we recovered" and "what we've since decided" stay distinct.
"""
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "equipDDO.sqlite")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# --- Step 2: flag questionable rows (believed not to exist in-game / not as augments) ---
# The 6 "Insightful Ability" rows were REMOVED from this list 2026-07-28 (Jeff, after noticing
# Insightful Ability (Constitution)/(Dexterity) missing from Belt's Extra options): three lines of
# evidence now say they're real, not questionable - (1) the original hand-curated flat file
# (obsolete/ddocraft_hand-patched-flat-file_last-version-2026-07-27.json) already offered
# Insightful Ability (Constitution)/(Strength) on Belt, so this isn't data lost in migration;
# (2) source_data/Effects.csv has a real, populated per-level curve for "Ins. Ability" starting at
# level 10, same shape as every genuine Insightful effect; (3) Jeff's own recollection. Reversed
# here rather than just noted, per his direct request. (Insightful Ability (Dexterity) specifically
# was never linked to Belt in ANY version of the data, old or new - that's not a loss, Belt just
# never offered it.)
QUESTIONABLE = [
    "Resist (Light)", "Resist (Negative)", "Resist (Poison)",
    "Insightful Resist (Light)", "Insightful Resist (Negative)", "Insightful Resist (Poison)",
]
cur.executemany(
    "UPDATE enchantment SET dataStatus = 'questionable' WHERE enchName = ?",
    [(n,) for n in QUESTIONABLE]
)
print(f"Flagged {cur.rowcount if cur.rowcount != -1 else len(QUESTIONABLE)} rows via loop "
      f"(executemany doesn't report cumulative rowcount reliably - verifying by count below)")

cur.execute("SELECT COUNT(*) FROM enchantment WHERE dataStatus = 'questionable'")
count = cur.fetchone()[0]
print(f"Verification: {count} rows now flagged 'questionable' (expect 6)")
if count != len(QUESTIONABLE):
    raise SystemExit(f"MISMATCH: expected {len(QUESTIONABLE)}, got {count}")

cur.execute("SELECT enchName FROM enchantment WHERE dataStatus = 'questionable' ORDER BY enchName")
for row in cur.fetchall():
    print(f"  - {row[0]}")

# --- Step 3: move the Cannith/category split into the schema itself ---
# itemOption.itemOptionItem currently holds the equipment category ("Armor", "Goggles", etc,
# plus the special 'Augment' pseudo-item used as an internal color->enchantment lookup by
# vAugmentOption). Rename it to itemOptionCategory, and add a new itemOptionItem column holding
# the concrete choice - 'Cannith <Category>' for every real row. The 'Augment' pseudo-item rows
# aren't a real browsable item, so their itemOptionItem stays NULL - not applicable to them.
# Drop the views first - SQLite's automatic view-SQL rewrite during a column rename doesn't
# reliably follow through a subquery alias, so do it explicitly instead of relying on that.
cur.executescript("DROP VIEW vAllEnchantment; DROP VIEW vItemOption; DROP VIEW vAugmentOption;")
cur.execute("ALTER TABLE itemOption RENAME COLUMN itemOptionItem TO itemOptionCategory")
cur.execute("ALTER TABLE itemOption ADD COLUMN itemOptionItem TEXT")
cur.execute("""
    UPDATE itemOption SET itemOptionItem = 'Cannith ' || itemOptionCategory
    WHERE itemOptionCategory <> 'Augment'
""")
cur.execute("SELECT COUNT(*) FROM itemOption WHERE itemOptionItem IS NOT NULL")
populated = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM itemOption WHERE itemOptionCategory = 'Augment'")
pseudo = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM itemOption")
total = cur.fetchone()[0]
print(f"itemOptionItem populated on {populated} rows; {pseudo} pseudo-item rows left NULL; "
      f"total {total} (expect populated + pseudo == total: {populated + pseudo == total})")
if populated + pseudo != total:
    raise SystemExit("MISMATCH: population + pseudo-item count doesn't equal total row count")

# Rebuild the views against the new column shape (carrying both itemOptionCategory and
# itemOptionItem through to the final output). Already dropped above.
cur.executescript("""
CREATE VIEW vAugmentOption AS
select W2.itemOptionID AS itemOptionID,
       W1.itemOptionSortOrder AS itemOptionSortOrder,
       W1.itemOptionCategory AS itemOptionCategory,
       W1.itemOptionItem AS itemOptionItem,
       W1.itemOptionSlot AS itemOptionSlot,
       W2.augmentColor AS augmentColor,
       W2.itemOptionEnchantment AS itemOptionEnchantment
from (select itemOptionSortOrder, itemOptionCategory, itemOptionItem, itemOptionSlot,
             itemOptionEnchantment AS colorLink
      from itemOption where itemOptionSlot like 'Augment%') W1
left join (select itemOptionID, itemOptionSlot AS augmentColor, itemOptionEnchantment
           from itemOption where itemOptionCategory = 'Augment') W2
on (W1.colorLink = W2.augmentColor);

CREATE VIEW vItemOption AS
select itemOptionID, itemOptionSortOrder, itemOptionCategory, itemOptionItem, itemOptionSlot,
       '' AS augmentColor, itemOptionEnchantment
from itemOption
where itemOptionCategory <> 'Augment' and itemOptionSlot not like 'Augment%'
union
select itemOptionID, itemOptionSortOrder, itemOptionCategory, itemOptionItem, itemOptionSlot,
       augmentColor, itemOptionEnchantment
from vAugmentOption;

CREATE VIEW vAllEnchantment AS
select combined.itemOptionSortOrder AS itemOptionSortOrder,
       enchantment.enchSortOrder AS enchSortOrder,
       combined.itemOptionCategory AS itemOptionCategory,
       combined.itemOptionItem AS itemOptionItem,
       combined.itemOptionSlot AS itemOptionSlot,
       combined.augmentColor AS augmentColor,
       combined.itemOptionEnchantment AS itemOptionEnchantment,
       enchantment.enchName AS enchName,
       enchantment.enchBonusType || '-' || enchantment.enchEffect AS enchEffectType,
       enchantment.enchCannithMinLevel AS enchCannithMinLevel,
       enchantment.enchAugmentMinLevel AS enchAugmentMinLevel,
       enchantment.enchDesc AS enchDesc,
       enchantment.enchSupercededBy AS enchSupercededBy,
       enchantment.allEnch AS allEnch,
       enchantment.basic AS basic,
       enchantment.nonscaling AS nonscaling,
       enchantment.forMeleeDmg AS forMeleeDmg,
       enchantment.forRangedDmg AS forRangedDmg,
       enchantment.forACDefence AS forACDefence,
       enchantment.forResistDefence AS forResistDefence,
       enchantment.forHitPoints AS forHitPoints,
       enchantment.forAlchemist AS forAlchemist,
       enchantment.forArtificer AS forArtificer,
       enchantment.forBarbarian AS forBarbarian,
       enchantment.forBard AS forBard,
       enchantment.forCleric AS forCleric,
       enchantment.forDruid AS forDruid,
       enchantment.forFavoredSoul AS forFavoredSoul,
       enchantment.forFighter AS forFighter,
       enchantment.forMonk AS forMonk,
       enchantment.forPaladin AS forPaladin,
       enchantment.forRanger AS forRanger,
       enchantment.forRogue AS forRogue,
       enchantment.forSorcerer AS forSorcerer,
       enchantment.forWarlock AS forWarlock,
       enchantment.forWizard AS forWizard
from enchantment
left join (
    select itemOptionID, itemOptionSortOrder, itemOptionCategory, itemOptionItem, itemOptionSlot, augmentColor, itemOptionEnchantment from vItemOption
    union
    select itemOptionID, itemOptionSortOrder, itemOptionCategory, itemOptionItem, itemOptionSlot, augmentColor, itemOptionEnchantment from vAugmentOption
) combined
on combined.itemOptionEnchantment = enchantment.enchName
where (enchantment.dataStatus is null or enchantment.dataStatus <> 'questionable')
order by (combined.itemOptionSortOrder is null), combined.itemOptionSortOrder,
    combined.itemOptionSlot, combined.augmentColor, enchantment.enchSortOrder;
""")

cur.execute("SELECT COUNT(*) FROM vAllEnchantment")
row_count = cur.fetchone()[0]
print(f"vAllEnchantment after category split: {row_count} rows "
      f"(expect 3830 - 3827 bound rows, unchanged, plus 3 pre-existing enchantment rows with no "
      f"itemOption binding at all, newly surfaced by removing vAllEnchantment's IS NOT NULL filter "
      f"- see PHASE 3 note below)")
cur.execute("SELECT itemOptionCategory, itemOptionItem FROM vAllEnchantment LIMIT 1")
print("Sample row itemOptionCategory/itemOptionItem:", cur.fetchone())

# Discovered while fixing the PHASE 3 export gap (removing the old WHERE combined.itemOptionSortOrder
# IS NOT NULL filter below, which used to hide any enchantment row with zero itemOption bindings):
# three enchantment rows already existed in the recovered data with no binding at all - Adamantine
# (Armor), Mithril, and Insightful Skill (Use Magic Device). These were completely invisible in the
# app before this session, unrelated to the Tourney Armor removal - just orphaned since whatever
# process originally recovered this data. Left as-is (not removed, not bound to anything) - they're
# real effect types, exactly the kind of thing the PHASE 3 inherent-effects picker needs to be able
# to surface, so their newfound visibility is a fix, not a regression to chase down.
cur.execute("""
    SELECT enchName FROM enchantment
    WHERE enchName NOT IN (SELECT itemOptionEnchantment FROM itemOption)
      AND enchGroup <> 'Named Item'
""")
print("Pre-existing unbound enchantment rows (expect 3):", [r[0] for r in cur.fetchall()])

# Now that itemOptionItem exists and distinguishes concrete items within a category, add the
# correctly-scoped uniqueness: one row per (item, slot, enchantment) - not per (category, slot,
# enchantment), which would incorrectly forbid two different items in the same category from
# both declaring, say, an Augment 1 Blue slot.
cur.execute("CREATE UNIQUE INDEX idx_itemOption_unique ON itemOption(itemOptionItem, itemOptionSlot, itemOptionEnchantment)")

# --- Step 4: add named-item-only enchantment types to the master pool ---
# Originally this step also re-added Tourney Armor itself as curated itemOption rows (a specific
# item, with a specific augment config, with these effects bound to it). That's gone - PHASE 3's
# pivot (see ddocraft.js header) replaced hand-curated named items with user-defined custom items,
# which have no backing data at all beyond whatever the user types at point of use. What's left of
# this step: three effect types that exist on named items in-game but aren't currently produced by
# Cannith crafting, so they weren't anywhere in the recovered catalog. They stay in the enchantment
# table - a generic master pool, not tied to any item - because a user building a custom item that
# has one of these effects needs to be able to pick it from PHASE 3's universal effects list.
#
# KNOWN GAP (2026-07-27): with no itemOption row binding them to anything, these three rows are
# currently unreachable in the exported JSON - vAllEnchantment only emits enchantment rows joined
# to at least one itemOption (WHERE combined.itemOptionSortOrder IS NOT NULL). Nothing in today's
# UI depends on them being visible (their only prior binding was the now-removed Tourney Armor
# rows), so this is inert, not a regression - but it means PHASE 3 step 5 (the universal
# inherent-effects picker) can't just consume ddocraft.json as-is; it needs the export/loader to
# surface all enchantment rows regardless of itemOption binding, not only the joined ones.
weight_fields = ["allEnch","basic","nonscaling","forMeleeDmg","forRangedDmg","forACDefence",
    "forResistDefence","forHitPoints","forAlchemist","forArtificer","forBarbarian","forBard",
    "forCleric","forDruid","forFavoredSoul","forFighter","forMonk","forPaladin","forRanger",
    "forRogue","forSorcerer","forWarlock","forWizard"]

def new_enchantment_row(enchSortOrder, enchName, enchBonusType, enchEffect, enchCannithMinLevel,
                         enchAugmentMinLevel, enchDesc, weights):
    row = dict.fromkeys(weight_fields, 0)
    row.update(weights)
    assert set(row.keys()) == set(weight_fields), f"unexpected weight key in {weights}"
    return (enchSortOrder, "Named Item", enchName, enchBonusType, enchEffect, enchCannithMinLevel,
            enchAugmentMinLevel, enchDesc, *[row[w] for w in weight_fields])

new_enchantments = [
    new_enchantment_row(90000, "Damage Reduction", "Untyped", "Damage Reduction",
        4, 0, "TEMP/TEST DATA - real min level TBD. Damage Reduction 5, bypassed by the "
        "appropriate material. Renamed from 'Damage Reduction (Adamantine)' 2026-07-28 - Adamantine "
        "is just one delivery mechanism for this effect, not part of the effect's identity (per "
        "Jeff: 'Adamantine' on armor is best thought of as granting the DR effect - the material "
        "itself is the middleman, not relevant to what gets selected).",
        {"allEnch": 1, "nonscaling": 1, "forHitPoints": 5}),
    new_enchantment_row(90001, "Superior Nimbleness", "Untyped", "Nimbleness",
        4, 0, "TEMP/TEST DATA - real min level TBD. Superior Nimbleness. "
        "New effect type, not currently offered by Cannith crafting.",
        {"allEnch": 1, "nonscaling": 1, "forACDefence": 4}),
    new_enchantment_row(90002, "Tourney Armor Extras", None, None,
        4, 0, "Plate mail as light armor, mithril, increased max dex bonus, decreased spell failure.",
        {"allEnch": 1}),
]
cur.executemany(
    "INSERT INTO enchantment (enchSortOrder, enchGroup, enchName, enchBonusType, enchEffect, "
    "enchCannithMinLevel, enchAugmentMinLevel, enchDesc, " + ",".join(weight_fields) + ") VALUES "
    "(" + ",".join(["?"] * (8 + len(weight_fields))) + ")",
    new_enchantments
)

cur.execute("SELECT enchName, enchGroup FROM enchantment WHERE enchGroup = 'Named Item' ORDER BY enchName")
named_item_effects = cur.fetchall()
print(f"Named-item-only effect types in master pool: {len(named_item_effects)} (expect 3)")
for row in named_item_effects:
    print("   ", row)
if len(named_item_effects) != 3:
    raise SystemExit(f"MISMATCH: expected 3 named-item-only enchantment rows, got {len(named_item_effects)}")

# --- Step 5: fix enchBonusType values that are effect-name leakage or invented placeholders,
# not real DDO bonus types (Jeff, 2026-07-28 - see KNOWN ISSUES in ddocraft.js for the general
# pattern). All of these become 'Untyped' - a real bonus type meaning "no type, always stacks" -
# rather than the effect's own name or a made-up bucket:
#   - Blindness Immunity: no stacking possibility at all, so no real type applies.
#   - Regeneration, and the two rows already using the literal placeholder 'Unknown' (Bashing,
#     Shield Spikes): genuinely untyped effects, not specifically identified as such originally.
#   - Adamantine (Armor), and the whole 'Material' bucket (Adamantine (Weapon), Byeshk, Cold Iron,
#     Metalline, Silver, Mithril, Everbright): material-based DR-bypass properties. Their
#     historical bonuses are non-numerical, or where numeric (DR), untyped in DDO's system -
#     'Adamantine'/'Material' were placeholder guesses, not real bonus types.
UNTYPED_CORRECTIONS = [
    "Blindness Immunity", "Regeneration", "Bashing", "Shield Spikes",
    "Adamantine (Armor)", "Adamantine (Weapon)", "Byeshk", "Cold Iron", "Metalline",
    "Silver", "Mithril", "Everbright",
]
cur.executemany(
    "UPDATE enchantment SET enchBonusType = 'Untyped' WHERE enchName = ?",
    [(n,) for n in UNTYPED_CORRECTIONS]
)
cur.execute(
    "SELECT COUNT(*) FROM enchantment WHERE enchName IN (" +
    ",".join(["?"] * len(UNTYPED_CORRECTIONS)) + ") AND enchBonusType = 'Untyped'",
    UNTYPED_CORRECTIONS
)
untyped_count = cur.fetchone()[0]
print(f"Corrected {untyped_count} rows to bonusType 'Untyped' (expect {len(UNTYPED_CORRECTIONS)})")
if untyped_count != len(UNTYPED_CORRECTIONS):
    raise SystemExit(f"MISMATCH: expected {len(UNTYPED_CORRECTIONS)} rows corrected to Untyped, got {untyped_count}")

# --- Step 6: normalize the 'Competance'/'Competancy' misspellings to 'Competence' in the raw
# data itself (previously this merge only existed in the MariaDB bonusType seed list, which was
# an oversight - the underlying enchBonusType values here still had the misspellings).
cur.execute("UPDATE enchantment SET enchBonusType = 'Competence' WHERE enchBonusType IN ('Competance', 'Competancy')")
cur.execute("SELECT COUNT(*) FROM enchantment WHERE enchBonusType = 'Competence'")
competence_count = cur.fetchone()[0]
print(f"Normalized to bonusType 'Competence': {competence_count} rows (expect 4)")
if competence_count != 4:
    raise SystemExit(f"MISMATCH: expected 4 rows with bonusType 'Competence', got {competence_count}")

# --- Step 7: remove Orb's Red augment-slot declaration (Jeff, 2026-07-28 - real-game knowledge:
# Orbs don't get a Red/weapon-style augment slot, contrary to what the recovered itemOption data
# said). The two rows were internally well-formed (not an obvious copy-paste artifact - Orb's own
# Prefix/Suffix/Extra options are all genuinely caster-implement-flavored), so this looks like an
# error made by whoever originally curated the source Access DB, not a data-recovery bug.
cur.execute("""
    DELETE FROM itemOption
    WHERE itemOptionCategory = 'Orb' AND itemOptionSlot LIKE 'Augment%' AND itemOptionEnchantment = 'Red'
""")
cur.execute("""
    SELECT COUNT(*) FROM itemOption
    WHERE itemOptionCategory = 'Orb' AND itemOptionSlot LIKE 'Augment%' AND itemOptionEnchantment = 'Red'
""")
orb_red_remaining = cur.fetchone()[0]
print(f"Orb Red augment-slot rows removed (expect 0 remaining): {orb_red_remaining}")
if orb_red_remaining != 0:
    raise SystemExit(f"MISMATCH: expected 0 Orb/Red augment rows remaining, got {orb_red_remaining}")

# --- Step 8: True Sight supersedes Blindness Immunity (Jeff, 2026-07-28) - True Sight grants
# Blindness Immunity as a bonus, so selecting True Sight should also mark Blindness Immunity as
# already covered, without blocking Blindness Immunity from being freely selected on its own.
# This is the same enchSupercededBy mechanism already used for Chaos/Evil/Good/Law Aligned ->
# Aligned - NOT the same thing as effectEquivalencyGroup/true equivalence (a truly equivalent
# effect, e.g. a "Magma Damage" that's mechanically identical to standard Fire Damage at the same
# level, would just be selected AS "Fire Damage" - no second record at all. Supersedes is for two
# genuinely distinct effects where having the better one means you also have the lesser one.)
cur.execute("UPDATE enchantment SET enchSupercededBy = 'True Sight' WHERE enchName = 'Blindness Immunity'")
cur.execute("SELECT enchSupercededBy FROM enchantment WHERE enchName = 'Blindness Immunity'")
result = cur.fetchone()
if result != ('True Sight',):
    raise SystemExit(f"MISMATCH: expected Blindness Immunity.enchSupercededBy = 'True Sight', got {result}")
print("Blindness Immunity now superseded by True Sight")

# --- Step 9: add weapon material-bypass effects Jeff identified as missing (2026-07-28). Adamantine
# (Weapon)/Byeshk/Cold Iron/Silver already exist as real Red-augment options; Flametouched Iron and
# Crystal are the same family (specific material, bypassed by matching that material) and get the
# same Red-augment binding. Transmuting is different - it bypasses ANY/ALL DR (material, alignment,
# everything), matching how the universal "Aligned" effect (vs. the four specific alignments) is
# Cannith-only (Suffix on weapon categories), not augment-obtainable - Transmuting gets the same
# treatment; it's the material-bypass analog of "Aligned". Min levels are placeholder/TBD, same
# caveat as the other TEMP/TEST DATA rows above - real values not yet confirmed.
new_materials = [
    ("Flametouched Iron", "Untyped", "Bypass Flametouched Iron", "Damage (Bypass Defense)", 1, 4,
        "TEMP/TEST DATA - real min level TBD. Material flag to Bypass Flametouched Iron",
        {"allEnch": 1, "nonscaling": 1, "forMeleeDmg": 1, "forRangedDmg": 1}),
    ("Crystal", "Untyped", "Bypass Crystal", "Damage (Bypass Defense)", 1, 20,
        "TEMP/TEST DATA - real min level TBD. Material flag to Bypass Crystal",
        {"allEnch": 1, "nonscaling": 1, "forMeleeDmg": 1, "forRangedDmg": 1}),
    ("Transmuting", "Untyped", "Bypass All DR", "Damage (Bypass Defense)", 1, 100,
        "TEMP/TEST DATA - real min level TBD. Untyped flag to bypass any/all damage reduction - "
        "material, alignment, or otherwise. Metalline note: acts as one of the specific metal "
        "types for bypass purposes, NOT as a Crystal-bypass substitute.",
        {"allEnch": 1, "nonscaling": 1, "forMeleeDmg": 3, "forRangedDmg": 1}),
]
next_sort = cur.execute("SELECT MAX(enchSortOrder) FROM enchantment").fetchone()[0] + 1
for i, (name, bonus_type, effect, group, cannith_min, augment_min, desc, weights) in enumerate(new_materials):
    row = dict.fromkeys(weight_fields, 0)
    row.update(weights)
    cur.execute(
        "INSERT INTO enchantment (enchSortOrder, enchGroup, enchName, enchBonusType, enchEffect, "
        "enchCannithMinLevel, enchAugmentMinLevel, enchDesc, " + ",".join(weight_fields) + ") VALUES "
        "(" + ",".join(["?"] * (8 + len(weight_fields))) + ")",
        (next_sort + i, group, name, bonus_type, effect, cannith_min, augment_min, desc,
         *[row[w] for w in weight_fields])
    )

cur.execute("""
    INSERT INTO itemOption (itemOptionSortOrder, itemOptionCategory, itemOptionSlot, itemOptionEnchantment, itemOptionItem)
    VALUES (10000, 'Augment', 'Red', 'Flametouched Iron', NULL),
           (10000, 'Augment', 'Red', 'Crystal', NULL)
""")
cur.execute("""
    INSERT INTO itemOption (itemOptionSortOrder, itemOptionCategory, itemOptionSlot, itemOptionEnchantment, itemOptionItem)
    VALUES (7100, 'Melee1', 'Suffix', 'Transmuting', 'Cannith Melee1'),
           (7100, 'Melee2', 'Suffix', 'Transmuting', 'Cannith Melee2'),
           (7100, 'Ranged', 'Suffix', 'Transmuting', 'Cannith Ranged')
""")
cur.execute("SELECT COUNT(*) FROM enchantment WHERE enchName IN ('Flametouched Iron', 'Crystal', 'Transmuting')")
new_material_count = cur.fetchone()[0]
print(f"New weapon materials added: {new_material_count} (expect 3)")
if new_material_count != 3:
    raise SystemExit(f"MISMATCH: expected 3 new material enchantment rows, got {new_material_count}")

conn.commit()
conn.close()
print("Corrections applied.")
