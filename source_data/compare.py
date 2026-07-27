import json

with open("generated_ddocraft.json", encoding="utf-8") as f:
    generated = json.load(f)

with open(r"C:\Users\jhawk\AppData\Local\Temp\original_ddocraft.json", encoding="utf-8") as f:
    original = json.load(f)

print(f"generated: {len(generated)} rows, original: {len(original)} rows")

field_order = ["itemOptionSortOrder","enchSortOrder","itemOptionItem","itemOptionSlot","augmentColor",
    "itemOptionEnchantment","enchName","enchEffectType","enchCannithMinLevel","enchAugmentMinLevel",
    "enchDesc","enchSupercededBy","allEnch","basic","nonscaling","forMeleeDmg","forRangedDmg",
    "forACDefence","forResistDefence","forHitPoints","forAlchemist","forArtificer","forBarbarian",
    "forBard","forCleric","forDruid","forFavoredSoul","forFighter","forMonk","forPaladin","forRanger",
    "forRogue","forSorcerer","forWarlock","forWizard"]

mismatches = 0
max_report = 15
if len(generated) != len(original):
    print("ROW COUNT MISMATCH")
else:
    for i in range(len(original)):
        o = original[i]
        g = generated[i]
        for field in field_order:
            ov = o.get(field)
            gv = g.get(field)
            # normalize null/None
            if ov is None: ov = None
            if gv is None: gv = None
            # normalize numeric types (sqlite may return int where original had different repr)
            if ov != gv:
                mismatches += 1
                if mismatches <= max_report:
                    print(f"Row {i} field '{field}': original={ov!r} generated={gv!r}")

print(f"\nTotal field mismatches: {mismatches}")
