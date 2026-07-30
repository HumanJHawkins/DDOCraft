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

# The 15 per-class fields (forBarbarian..forWizard) were dropped from this export 2026-07-30 -
#   rating an effect's usefulness "for Barbarian" etc. baked in an assumption about how that class
#   is supposed to be played, which doesn't hold (DDO players build the same class many different
#   ways). The build-purpose fields below (forACDefence, forMeleeDmg, ...) are what's actually
#   useful - pick your playstyle goal directly. The raw recovered SQLite data still carries these
#   columns internally (source_data/equipDDO.sqlite), just unused - nothing is lost, this export
#   just stops emitting them.
FIELD_ORDER = ["itemOptionSortOrder", "enchSortOrder", "itemOptionItem", "itemOptionCategory",
    "itemOptionSlot", "augmentColor", "itemOptionEnchantment", "enchName", "enchEffectType",
    "enchCannithMinLevel", "enchAugmentMinLevel", "enchDesc", "enchSupercededBy", "allEnch",
    "basic", "nonscaling", "forMeleeDmg", "forRangedDmg", "forACDefence", "forResistDefence",
    "forHitPoints"]

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM vAllEnchantment")
rows = [dict(row) for row in cur.fetchall()]

out = [{f: r.get(f) for f in FIELD_ORDER} for r in rows]

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)

print(f"Wrote {len(out)} rows to {OUT_PATH}")
