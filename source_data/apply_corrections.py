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
QUESTIONABLE = [
    "Resist (Light)", "Resist (Negative)", "Resist (Poison)",
    "Insightful Resist (Light)", "Insightful Resist (Negative)", "Insightful Resist (Poison)",
    "Insightful Ability (Charisma)", "Insightful Ability (Constitution)",
    "Insightful Ability (Dexterity)", "Insightful Ability (Intelligence)",
    "Insightful Ability (Strength)", "Insightful Ability (Wisdom)",
]
cur.executemany(
    "UPDATE enchantment SET dataStatus = 'questionable' WHERE enchName = ?",
    [(n,) for n in QUESTIONABLE]
)
print(f"Flagged {cur.rowcount if cur.rowcount != -1 else len(QUESTIONABLE)} rows via loop "
      f"(executemany doesn't report cumulative rowcount reliably - verifying by count below)")

cur.execute("SELECT COUNT(*) FROM enchantment WHERE dataStatus = 'questionable'")
count = cur.fetchone()[0]
print(f"Verification: {count} rows now flagged 'questionable' (expect 12)")
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
where combined.itemOptionSortOrder is not null
  and (enchantment.dataStatus is null or enchantment.dataStatus <> 'questionable')
order by combined.itemOptionSortOrder, combined.itemOptionSlot, combined.augmentColor, enchantment.enchSortOrder;
""")

cur.execute("SELECT COUNT(*) FROM vAllEnchantment")
print(f"vAllEnchantment after category split: {cur.fetchone()[0]} rows (expect 3827, unchanged)")
cur.execute("SELECT itemOptionCategory, itemOptionItem FROM vAllEnchantment LIMIT 1")
print("Sample row itemOptionCategory/itemOptionItem:", cur.fetchone())

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
    new_enchantment_row(90000, "Damage Reduction (Adamantine)", "Untyped", "Damage Reduction (Adamantine)",
        4, 0, "TEMP/TEST DATA - real min level TBD. Damage Reduction 5, bypassed by Adamantine. "
        "New effect type, not currently offered by Cannith crafting.",
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

conn.commit()
conn.close()
print("Corrections applied.")
