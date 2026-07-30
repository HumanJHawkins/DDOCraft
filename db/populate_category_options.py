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

augmentOptionSortOrder/cannithCategoryOptionSortOrder are NOT copied from the recovered data's
itemOptionSortOrder - that column turns out to be a coarse block-level constant here (e.g. every
row in Armor/Prefix shares the same value), not a real per-row order. The actual curated display
order survives instead in itemOptionID's insertion sequence (verified by eye - e.g. Yellow's
augment list groups Resist(X) together, then immunities, then Spell Focus(X) in a sensible
curated order, clearly not alphabetical or random) - ranked here into clean 10/20/30... values per
group.

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
# equipDDO.sqlite moved to obsolete/ 2026-07-30 once MariaDB became the live source of truth (see
#   TO DO.md/Done.md) - this script is historical record of how augmentOption/cannithCategoryOption
#   were originally populated, not something meant to run again, but the path is kept correct in
#   case it ever needs to.
DB_PATH = os.path.join(HERE, "..", "obsolete", "equipDDO_source-of-truth-until-2026-07-30.sqlite")


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

    # --- augmentOption --- ordered by itemOptionID (the real curated order) within each color
    cur.execute("""
        SELECT itemOptionSlot, itemOptionEnchantment, itemOptionID
        FROM itemOption WHERE itemOptionCategory = 'Augment'
        ORDER BY itemOptionSlot, itemOptionID
    """)
    augment_option_lines = []
    augment_option_skipped = 0
    rank_by_color = {}
    for color, effect_name, _item_option_id in cur.fetchall():
        effect_id = effect_ids.get(effect_name)
        if effect_id is None:
            augment_option_skipped += 1
            continue
        rank_by_color[color] = rank_by_color.get(color, 0) + 1
        sort_order = rank_by_color[color] * 10
        color_id = augment_color_ids[color]
        augment_option_lines.append(f"({effect_id},{color_id},{sort_order},'claude-migration','claude-migration')")

    # --- cannithCategoryOption --- ordered by itemOptionID within each (category, slot)
    cur.execute("""
        SELECT itemOptionCategory, itemOptionSlot, itemOptionEnchantment, itemOptionID
        FROM itemOption
        WHERE itemOptionCategory <> 'Augment' AND itemOptionSlot IN ('Prefix', 'Suffix', 'Extra')
        ORDER BY itemOptionCategory, itemOptionSlot, itemOptionID
    """)
    cco_lines = []
    cco_skipped = 0
    rank_by_category_slot = {}
    for category, slot, effect_name, _item_option_id in cur.fetchall():
        effect_id = effect_ids.get(effect_name)
        if effect_id is None:
            cco_skipped += 1
            continue
        key = (category, slot)
        rank_by_category_slot[key] = rank_by_category_slot.get(key, 0) + 1
        sort_order = rank_by_category_slot[key] * 10
        category_id = item_category_ids[category]
        cco_lines.append(f"({category_id},'{slot}',{effect_id},{sort_order},'claude-migration','claude-migration')")

    print(f"-- augmentOption: {len(augment_option_lines)} rows ({augment_option_skipped} skipped - "
          f"questionable-excluded effect)", file=sys.stderr)
    print(f"-- cannithCategoryOption: {len(cco_lines)} rows ({cco_skipped} skipped - "
          f"questionable-excluded effect)", file=sys.stderr)

    print(f"-- {len(augment_option_lines)} rows generated from equipDDO.sqlite's itemOption table ('Augment' pseudo-item)")
    print("INSERT INTO augmentOption (effectId, augmentColorId, augmentOptionSortOrder, createBy, updateBy) VALUES")
    print(",\n".join(augment_option_lines) + ";")
    print()
    print(f"-- {len(cco_lines)} rows generated from equipDDO.sqlite's itemOption table (Prefix/Suffix/Extra)")
    print("INSERT INTO cannithCategoryOption (itemCategoryId, slotType, effectId, cannithCategoryOptionSortOrder, createBy, updateBy) VALUES")
    print(",\n".join(cco_lines) + ";")


if __name__ == "__main__":
    main()
