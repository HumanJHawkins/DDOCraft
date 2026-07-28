"""
Generates a SQL script that populates augmentOption and cannithCategoryOption from
equipDDO.sqlite's itemOption table.

augmentOption comes from the 'Augment' pseudo-item rows (itemOptionSlot = color name,
itemOptionEnchantment = the real effect eligible for that color) - global and item-independent,
exactly matching the schema's design.

cannithCategoryOption comes from real-category rows where itemOptionSlot is Prefix/Suffix/Extra
(itemOptionEnchantment = the real effect craftable in that slot for that category).

Both skip any row whose effect isn't in the effectId lookup - these are the 12 rows excluded from
`effect` as dataStatus='questionable' (9 augmentOption rows, 72 cannithCategoryOption rows
reference them - counts printed to stderr, not silently lost).

Usage:
    python db/populate_category_options.py <effect_ids.tsv> <item_category_ids.tsv> <augment_color_ids.tsv> > /tmp/insert_options.sql
    ssh -i ~/.ssh/ddocraft_claude claude@192.168.1.153 \\
        "mysql -u ddocraft_admin -p'<password>' -h 127.0.0.1 --default-character-set=utf8mb4 ddocraft" \\
        < /tmp/insert_options.sql
Requires itemCategory (db/populate_item_category.py) and effect (db/populate_effect.py) to already
be populated - this script queries equipDDO.sqlite only, so it needs the id lookups passed in via
tab-separated `SELECT id, name FROM ...` dumps, each with a header row.
"""
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "..", "source_data", "equipDDO.sqlite")


def load_id_map(tsv_path):
    ids = {}
    with open(tsv_path, encoding="utf-8") as f:
        next(f)
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            id_, name = line.split("\t", 1)
            ids[name] = int(id_)
    return ids


def main():
    if len(sys.argv) != 4:
        print("Usage: python populate_category_options.py <effect_ids.tsv> <item_category_ids.tsv> <augment_color_ids.tsv>", file=sys.stderr)
        sys.exit(1)
    effect_ids = load_id_map(sys.argv[1])
    item_category_ids = load_id_map(sys.argv[2])
    augment_color_ids = load_id_map(sys.argv[3])

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # --- augmentOption ---
    cur.execute("SELECT DISTINCT itemOptionSlot, itemOptionEnchantment FROM itemOption WHERE itemOptionCategory = 'Augment'")
    augment_option_lines = []
    augment_option_skipped = 0
    for color, effect_name in cur.fetchall():
        effect_id = effect_ids.get(effect_name)
        if effect_id is None:
            augment_option_skipped += 1
            continue
        color_id = augment_color_ids[color]
        augment_option_lines.append(f"({effect_id},{color_id},'claude-migration','claude-migration')")

    # --- cannithCategoryOption ---
    cur.execute("""
        SELECT DISTINCT itemOptionCategory, itemOptionSlot, itemOptionEnchantment
        FROM itemOption
        WHERE itemOptionCategory <> 'Augment' AND itemOptionSlot IN ('Prefix', 'Suffix', 'Extra')
    """)
    cco_lines = []
    cco_skipped = 0
    for category, slot, effect_name in cur.fetchall():
        effect_id = effect_ids.get(effect_name)
        if effect_id is None:
            cco_skipped += 1
            continue
        category_id = item_category_ids[category]
        cco_lines.append(f"({category_id},'{slot}',{effect_id},'claude-migration','claude-migration')")

    print(f"-- augmentOption: {len(augment_option_lines)} rows ({augment_option_skipped} skipped - "
          f"questionable-excluded effect)", file=sys.stderr)
    print(f"-- cannithCategoryOption: {len(cco_lines)} rows ({cco_skipped} skipped - "
          f"questionable-excluded effect)", file=sys.stderr)

    print(f"-- {len(augment_option_lines)} rows generated from equipDDO.sqlite's itemOption table ('Augment' pseudo-item)")
    print("INSERT INTO augmentOption (effectId, augmentColorId, createBy, updateBy) VALUES")
    print(",\n".join(augment_option_lines) + ";")
    print()
    print(f"-- {len(cco_lines)} rows generated from equipDDO.sqlite's itemOption table (Prefix/Suffix/Extra)")
    print("INSERT INTO cannithCategoryOption (itemCategoryId, slotType, effectId, createBy, updateBy) VALUES")
    print(",\n".join(cco_lines) + ";")


if __name__ == "__main__":
    main()
