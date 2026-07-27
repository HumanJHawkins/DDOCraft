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

conn.commit()
conn.close()
print("Corrections applied.")
