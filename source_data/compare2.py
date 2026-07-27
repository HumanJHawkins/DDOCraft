import json
from collections import Counter

with open("generated_ddocraft.json", encoding="utf-8") as f:
    generated = json.load(f)
with open(r"C:\Users\jhawk\AppData\Local\Temp\original_ddocraft.json", encoding="utf-8") as f:
    original = json.load(f)

field_order = ["itemOptionSortOrder","enchSortOrder","itemOptionItem","itemOptionSlot","augmentColor",
    "itemOptionEnchantment","enchName","enchEffectType","enchCannithMinLevel","enchAugmentMinLevel",
    "enchDesc","enchSupercededBy","allEnch","basic","nonscaling","forMeleeDmg","forRangedDmg",
    "forACDefence","forResistDefence","forHitPoints","forAlchemist","forArtificer","forBarbarian",
    "forBard","forCleric","forDruid","forFavoredSoul","forFighter","forMonk","forPaladin","forRanger",
    "forRogue","forSorcerer","forWarlock","forWizard"]

field_counts = Counter()
affected_enchnames = set()
for i in range(len(original)):
    o, g = original[i], generated[i]
    for field in field_order:
        if o.get(field) != g.get(field):
            field_counts[field] += 1
            affected_enchnames.add(o.get("enchName"))

print("Mismatches by field:")
for f, c in field_counts.most_common():
    print(f"  {f}: {c}")

print(f"\nDistinct enchNames affected: {len(affected_enchnames)}")
for n in sorted(affected_enchnames):
    print(f"  {n}")
