"""
Generates a SQL script that populates the live MariaDB `effect` table from the recovered
equipDDO.sqlite enchantment master pool. One-time migration (as of 2026-07-28) - `effect` was
empty before this ran. Excludes dataStatus='questionable' rows, same filter vAllEnchantment uses.

effectKey maps from enchEffect (the short mechanical descriptor, e.g. "HP Regen") - this is the
same value enchEffectType is built from for stacking/duplicate detection in the old flat-JSON
model. effectGroup maps from enchGroup (descriptive only, per the schema comment).

bonusTypeId is resolved via the BONUS_TYPE_ID mapping below, which must match the live bonusType
table (see db/seed_reference.sql) - update it if that table's rows ever change.

Usage:
    python db/populate_effect.py > /tmp/insert_effect.sql
    ssh -i ~/.ssh/ddocraft_claude claude@192.168.1.153 \\
        "mysql -u ddocraft_admin -p'<password>' -h 127.0.0.1 --default-character-set=utf8mb4 ddocraft" \\
        < /tmp/insert_effect.sql

Piped over SSH stdin rather than embedded in the ssh command string - embedding large SQL as a
quoted argument has repeatedly caused shell-escaping bugs earlier in this project's history.
"""
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "..", "source_data", "equipDDO.sqlite")

# Must match the live bonusType table's bonusTypeId values (db/seed_reference.sql).
BONUS_TYPE_ID = {
    "Competence": 3, "Deflection": 4, "Dodge": 5, "Enhancement": 6, "Equipment": 7,
    "Exceptional": 8, "Feat": 9, "Insight": 10, "Luck": 11, "Natural Armor": 13,
    "Resistance": 15, "Sacred": 16, "Untyped": 18, "Vitality": 19,
}

WEIGHT_COLS = ["allEnch", "basic", "nonscaling", "forMeleeDmg", "forRangedDmg", "forACDefence",
    "forResistDefence", "forHitPoints", "forAlchemist", "forArtificer", "forBarbarian", "forBard",
    "forCleric", "forDruid", "forFavoredSoul", "forFighter", "forMonk", "forPaladin", "forRanger",
    "forRogue", "forSorcerer", "forWarlock", "forWizard"]


def esc(v):
    if v is None:
        return "NULL"
    if isinstance(v, int):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace("'", "''")
    return "'" + s + "'"


def main():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    cur.execute(f"""
        SELECT enchName, enchEffect, enchBonusType, enchGroup, enchDesc, enchSortOrder,
               enchCannithMinLevel, enchAugmentMinLevel, {", ".join(WEIGHT_COLS)}
        FROM enchantment
        WHERE dataStatus IS NULL OR dataStatus <> 'questionable'
        ORDER BY enchSortOrder
    """)
    rows = cur.fetchall()

    names = [r["enchName"] for r in rows]
    assert len(names) == len(set(names)), "duplicate enchName found - fix the source data first"

    unmapped = {r["enchBonusType"] for r in rows if r["enchBonusType"] is not None} - set(BONUS_TYPE_ID)
    assert not unmapped, f"unmapped bonus types, update BONUS_TYPE_ID: {unmapped}"

    cols = (["effectName", "effectKey", "bonusTypeId", "effectGroup", "effectDescription",
             "effectSortOrder", "minLevelCannith", "minLevelAugment"] + WEIGHT_COLS
            + ["createBy", "updateBy"])

    lines = []
    for r in rows:
        bt = r["enchBonusType"]
        bt_id = BONUS_TYPE_ID.get(bt) if bt is not None else None
        vals = [esc(r["enchName"]), esc(r["enchEffect"]), esc(bt_id), esc(r["enchGroup"]),
                esc(r["enchDesc"]), esc(r["enchSortOrder"]), esc(r["enchCannithMinLevel"]),
                esc(r["enchAugmentMinLevel"])]
        vals += [esc(r[w]) for w in WEIGHT_COLS]
        vals += [esc("claude-migration"), esc("claude-migration")]
        lines.append("(" + ",".join(vals) + ")")

    print(f"-- {len(lines)} rows generated from equipDDO.sqlite's enchantment table")
    print("INSERT INTO effect (" + ",".join(cols) + ") VALUES")
    print(",\n".join(lines) + ";")


if __name__ == "__main__":
    main()
