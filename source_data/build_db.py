"""
Builds equipDDO.sqlite from the recovered MySQL CSV exports.
Source of truth going forward - re-run this fresh each time (it deletes and rebuilds).
"""
import csv
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "equipDDO.sqlite")

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.executescript("""
CREATE TABLE enchantment (
  enchantmentID INTEGER PRIMARY KEY,
  enchSortOrder INTEGER,
  enchGroup TEXT,
  enchName TEXT NOT NULL UNIQUE,
  enchShortName TEXT,
  enchBonusType TEXT,
  enchEffect TEXT,
  enchCannithMinLevel INTEGER,
  enchAugmentMinLevel INTEGER,
  enchDesc TEXT,
  enchSupercededBy TEXT,
  dataStatus TEXT,
  allEnch INTEGER,
  basic INTEGER,
  nonscaling INTEGER,
  forMeleeDmg INTEGER,
  forRangedDmg INTEGER,
  forACDefence INTEGER,
  forResistDefence INTEGER,
  forHitPoints INTEGER,
  forAlchemist INTEGER,
  forArtificer INTEGER,
  forBarbarian INTEGER,
  forBard INTEGER,
  forCleric INTEGER,
  forDruid INTEGER,
  forFavoredSoul INTEGER,
  forFighter INTEGER,
  forMonk INTEGER,
  forPaladin INTEGER,
  forRanger INTEGER,
  forRogue INTEGER,
  forSorcerer INTEGER,
  forWarlock INTEGER,
  forWizard INTEGER,
  enchNotes TEXT
);

CREATE TABLE itemOption (
  itemOptionID INTEGER PRIMARY KEY,
  itemOptionSortOrder INTEGER,
  itemOptionItem TEXT NOT NULL DEFAULT 'Untitled',
  itemOptionSlot TEXT NOT NULL DEFAULT 'Untitled',
  itemOptionEnchantment TEXT NOT NULL DEFAULT 'Untitled'
);
-- Note: no UNIQUE constraint on load - the recovered schema's original uniqueness was scoped
-- per-category (itemOptionItem here, before the step-3 rename), which only worked because there
-- was exactly one item per category. apply_corrections.py adds the correctly-scoped constraint
-- once the category/item split exists (see step 3).
""")

def clean(v):
    return None if v in ("", "NULL") else v

with open(os.path.join(HERE, "DDOCraft_enchantment.csv"), encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    cols = ["enchantmentID","enchSortOrder","enchGroup","enchName","enchShortName","enchBonusType",
            "enchEffect","enchCannithMinLevel","enchAugmentMinLevel","enchDesc","enchSupercededBy",
            "allEnch","basic","nonscaling","forMeleeDmg","forRangedDmg","forACDefence","forResistDefence",
            "forHitPoints","forAlchemist","forArtificer","forBarbarian","forBard","forCleric","forDruid",
            "forFavoredSoul","forFighter","forMonk","forPaladin","forRanger","forRogue","forSorcerer",
            "forWarlock","forWizard","enchNotes"]
    placeholders = ",".join(["?"] * len(cols))
    rows = [tuple(clean(r.get(c)) for c in cols) for r in reader]
    cur.executemany(f"INSERT INTO enchantment ({','.join(cols)}) VALUES ({placeholders})", rows)
print(f"Loaded {len(rows)} enchantment rows")

with open(os.path.join(HERE, "DDOCraft_itemOption.csv"), encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    cols = ["itemOptionID","itemOptionSortOrder","itemOptionItem","itemOptionSlot","itemOptionEnchantment"]
    placeholders = ",".join(["?"] * len(cols))
    rows = [tuple(clean(r.get(c)) for c in cols) for r in reader]
    cur.executemany(f"INSERT INTO itemOption ({','.join(cols)}) VALUES ({placeholders})", rows)
print(f"Loaded {len(rows)} itemOption rows")

cur.executescript("""
CREATE VIEW vAugmentOption AS
select W2.itemOptionID AS itemOptionID,
       W1.itemOptionSortOrder AS itemOptionSortOrder,
       W1.itemOptionItem AS itemOptionItem,
       W1.itemOptionSlot AS itemOptionSlot,
       W2.augmentColor AS augmentColor,
       W2.itemOptionEnchantment AS itemOptionEnchantment
from (select itemOptionSortOrder, itemOptionItem, itemOptionSlot, itemOptionEnchantment AS colorLink
      from itemOption where itemOptionSlot like 'Augment%') W1
left join (select itemOptionID, itemOptionSlot AS augmentColor, itemOptionEnchantment
           from itemOption where itemOptionItem = 'Augment') W2
on (W1.colorLink = W2.augmentColor);

CREATE VIEW vItemOption AS
select itemOptionID, itemOptionSortOrder, itemOptionItem, itemOptionSlot, '' AS augmentColor, itemOptionEnchantment
from itemOption
where itemOptionItem <> 'Augment' and itemOptionSlot not like 'Augment%'
union
select itemOptionID, itemOptionSortOrder, itemOptionItem, itemOptionSlot, augmentColor, itemOptionEnchantment
from vAugmentOption;

CREATE VIEW vAllEnchantment AS
select combined.itemOptionSortOrder AS itemOptionSortOrder,
       enchantment.enchSortOrder AS enchSortOrder,
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
    select itemOptionID, itemOptionSortOrder, itemOptionItem, itemOptionSlot, augmentColor, itemOptionEnchantment from vItemOption
    union
    select itemOptionID, itemOptionSortOrder, itemOptionItem, itemOptionSlot, augmentColor, itemOptionEnchantment from vAugmentOption
) combined
on combined.itemOptionEnchantment = enchantment.enchName
where combined.itemOptionSortOrder is not null
  and (enchantment.dataStatus is null or enchantment.dataStatus <> 'questionable')
order by combined.itemOptionSortOrder, combined.itemOptionSlot, combined.augmentColor, enchantment.enchSortOrder;
""")

cur.execute("SELECT COUNT(*) FROM vAllEnchantment")
print(f"vAllEnchantment: {cur.fetchone()[0]} rows")

conn.commit()
conn.close()
print(f"Wrote {DB_PATH}")
