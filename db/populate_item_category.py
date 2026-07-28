"""
Generates a SQL script that populates itemCategory from equipDDO.sqlite's itemOption table.

Each real category (everything except the 'Augment' pseudo-item) declares its augment slots as
rows with itemOptionSlot LIKE 'Augment%' and itemOptionEnchantment holding a COLOR NAME (not an
effect) - e.g. ('Melee1', 'Augment 1', 'Red') means Melee1 has a Red-eligible augment slot. This
is exactly the allowsBlue/allowsYellow/allowsRed data itemCategory needs - derived here, not
guessed, so it resolves the WEAPON_CATEGORIES question in TO DO.md's Known Issues once the client
is rewritten to use it: Melee1/Melee2/Ranged get Red, Shield and Orb do not (Orb's Red row in the
recovered data was itself wrong - corrected in apply_corrections.py, 2026-07-28), Rune Arm/Trinket
have no augment slots at all (both flags false, correctly - they use only Prefix/Suffix/Extra).

itemCategorySortOrder is derived from MIN(itemOptionSortOrder) per category - the recovered data's
implied category display order (Goggles, Helm, Necklace, ... Orb) - assigned as 10, 20, 30, ...
to leave room for future insertions, per the project's <table>SortOrder naming convention
(enchSortOrder, itemOptionSortOrder in the recovered data; effectSortOrder here).

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

    cur.execute("""
        SELECT itemOptionCategory, MIN(itemOptionSortOrder)
        FROM itemOption
        WHERE itemOptionCategory <> 'Augment'
        GROUP BY itemOptionCategory
        ORDER BY MIN(itemOptionSortOrder)
    """)
    categories = [r[0] for r in cur.fetchall()]

    cur.execute("""
        SELECT DISTINCT itemOptionCategory, itemOptionEnchantment
        FROM itemOption
        WHERE itemOptionCategory <> 'Augment' AND itemOptionSlot LIKE 'Augment%'
    """)
    colors_by_category = {}
    for category, color in cur.fetchall():
        colors_by_category.setdefault(category, set()).add(color)

    lines = []
    for i, category in enumerate(categories):
        sort_order = (i + 1) * 10
        colors = colors_by_category.get(category, set())
        allows_blue = "Blue" in colors
        allows_yellow = "Yellow" in colors
        allows_red = "Red" in colors
        lines.append(
            f"({esc_str(category)},{sort_order},{int(allows_blue)},{int(allows_yellow)},{int(allows_red)},"
            f"'claude-migration','claude-migration')"
        )

    print(f"-- {len(lines)} rows generated from equipDDO.sqlite's itemOption table")
    print("INSERT INTO itemCategory (itemCategoryName, itemCategorySortOrder, allowsBlue, allowsYellow, allowsRed, createBy, updateBy) VALUES")
    print(",\n".join(lines) + ";")


if __name__ == "__main__":
    main()
