import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
conn = sqlite3.connect(os.path.join(HERE, "equipDDO.sqlite"))
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM vAllEnchantment")
cols = [d[0] for d in cur.description]
generated = [dict(zip(cols, row)) for row in cur.fetchall()]

with open(r"C:\Users\jhawk\AppData\Local\Temp\original_ddocraft.json", encoding="utf-8") as f:
    original = json.load(f)

field_order = ["itemOptionSortOrder","enchSortOrder","itemOptionItem","itemOptionSlot","augmentColor",
    "itemOptionEnchantment","enchName","enchEffectType","enchCannithMinLevel","enchAugmentMinLevel",
    "enchDesc","enchSupercededBy","allEnch","basic","nonscaling","forMeleeDmg","forRangedDmg",
    "forACDefence","forResistDefence","forHitPoints","forAlchemist","forArtificer","forBarbarian",
    "forBard","forCleric","forDruid","forFavoredSoul","forFighter","forMonk","forPaladin","forRanger",
    "forRogue","forSorcerer","forWarlock","forWizard"]

print(f"generated: {len(generated)} rows, original: {len(original)} rows")
mismatches = 0
if len(generated) == len(original):
    for i in range(len(original)):
        for field in field_order:
            if original[i].get(field) != generated[i].get(field):
                mismatches += 1
print(f"Field mismatches (expect 459, the 12 known Resist/Ability rows x avg 2 fields): {mismatches}")
