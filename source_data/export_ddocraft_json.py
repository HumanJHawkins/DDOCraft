"""
Generates ddocraft.json from equipDDO.sqlite's vAllEnchantment view - the "first test" of
using the new SQLite source of truth to drive the live app, keeping the existing flat-array
JSON shape and the existing (unmodified) render loop.
Run build_db.py + apply_corrections.py first.
"""
import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "equipDDO.sqlite")
OUT_PATH = os.path.join(HERE, "..", "ddocraft_from_sqlite.json")

FIELD_ORDER = ["itemOptionSortOrder", "enchSortOrder", "itemOptionItem", "itemOptionCategory",
    "itemOptionSlot", "augmentColor", "itemOptionEnchantment", "enchName", "enchEffectType",
    "enchCannithMinLevel", "enchAugmentMinLevel", "enchDesc", "enchSupercededBy", "allEnch",
    "basic", "nonscaling", "forMeleeDmg", "forRangedDmg", "forACDefence", "forResistDefence",
    "forHitPoints", "forAlchemist", "forArtificer", "forBarbarian", "forBard", "forCleric",
    "forDruid", "forFavoredSoul", "forFighter", "forMonk", "forPaladin", "forRanger", "forRogue",
    "forSorcerer", "forWarlock", "forWizard"]

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM vAllEnchantment")
rows = [dict(row) for row in cur.fetchall()]

out = [{f: r.get(f) for f in FIELD_ORDER} for r in rows]

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)

print(f"Wrote {len(out)} rows to {OUT_PATH}")
