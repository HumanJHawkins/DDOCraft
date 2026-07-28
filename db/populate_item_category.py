"""
Generates a SQL script that populates itemCategory from equipDDO.sqlite's itemOption table.

Each real category (everything except the 'Augment' pseudo-item) declares its augment slots as
rows with itemOptionSlot LIKE 'Augment%' and itemOptionEnchantment holding a COLOR NAME (not an
effect) - e.g. ('Melee1', 'Augment 1', 'Red') means Melee1 has a Red-eligible augment slot. This
is exactly the allowsBlue/allowsYellow/allowsRed data itemCategory needs - derived here, not
guessed, so it resolves the WEAPON_CATEGORIES question in TO DO.md's Known Issues once the client
is rewritten to use it: Melee1/Melee2/Ranged/Orb get Red, Shield does not, Rune Arm/Trinket have no
augment slots at all (both flags false, correctly - they use only Prefix/Suffix/Extra).

Usage:
    python db/populate_item_category.py > /tmp/insert_item_category.sql
    ssh -i ~/.ssh/ddocraft_claude claude@192.168.1.153 \\
        "mysql -u ddocraft_admin -p'<password>' -h 127.0.0.1 --default-character-set=utf8mb4 ddocraft" \\
        < /tmp/insert_item_category.sql
"""
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "..", "source_data", "equipDDO.sqlite")


def esc_str(v):
    return "'" + v.replace("\\", "\\\\").replace("'", "''") + "'"


def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("SELECT DISTINCT itemOptionCategory FROM itemOption WHERE itemOptionCategory <> 'Augment'")
    categories = sorted(r[0] for r in cur.fetchall())

    cur.execute("""
        SELECT DISTINCT itemOptionCategory, itemOptionEnchantment
        FROM itemOption
        WHERE itemOptionCategory <> 'Augment' AND itemOptionSlot LIKE 'Augment%'
    """)
    colors_by_category = {}
    for category, color in cur.fetchall():
        colors_by_category.setdefault(category, set()).add(color)

    lines = []
    for category in categories:
        colors = colors_by_category.get(category, set())
        allows_blue = "Blue" in colors
        allows_yellow = "Yellow" in colors
        allows_red = "Red" in colors
        lines.append(
            f"({esc_str(category)},{int(allows_blue)},{int(allows_yellow)},{int(allows_red)},"
            f"'claude-migration','claude-migration')"
        )

    print(f"-- {len(lines)} rows generated from equipDDO.sqlite's itemOption table")
    print("INSERT INTO itemCategory (itemCategoryName, allowsBlue, allowsYellow, allowsRed, createBy, updateBy) VALUES")
    print(",\n".join(lines) + ";")


if __name__ == "__main__":
    main()
