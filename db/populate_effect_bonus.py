"""
Generates a SQL script that populates effectBonusByLevel from Jeff's two reference CSVs:
  source_data/Effects.csv - Cannith-crafting min-level -> bonus chart, levels 1-30, one row
    per effect. Confirmed (by cross-checking against Aug_Cannith_Effects.csv's Cannith columns at
    every level they share, see RECONCILE note below) to be the Cannith deliveryType chart.
  source_data/Aug_Cannith_Effects.csv - Augment vs Cannith comparison at levels 0,4,8,12,16,20,24,
    28,34 for a smaller set of effects. Its "Cannith" rows are a sparse subset of Effects.csv (plus
    level 34, beyond Effects.csv's range) - not new data except at 34. Its "Augment" rows ARE new
    data: Effects.csv has no augment-delivery chart at all.

RECONCILE: cross-checked every (effect, level) pair where both files give a Cannith-delivery value
for the same effect - 47 pairs, zero mismatches, as of 2026-07-28. If you add new mappings, rerun
that cross-check (see the reconcile step at the bottom of this docstring's sibling script history
in scratchpad, or just re-derive it) before trusting new Cannith rows blindly.

Name mapping (CSV label -> effectName rows) is deliberately explicit rather than fuzzy-matched -
many CSV rows are generic categories covering several effectName rows sharing one curve (e.g.
"Ability" -> the 6 per-stat Ability (X) rows), and a few are outright NOT the same effect despite
matching text (see the Stunning / "Vertigo/Stunning/Shatter" comment below - a real bonus-curve
conflict, not a naming coincidence).

Known NOT mapped (no destination effect, or destination is excluded/conflicting - see Known Issues
in TO DO.md for the two flagged as open questions):
  Enhance bonus*, Weapon dice mult*, Spellcasting implement* - describe underlying crafting-system
    scaling formulas, not a specific listed effect.
  Ins. Ability / Ability (Insightful) - target is Insightful Ability (X), excluded from `effect` as
    dataStatus='questionable'. CSV has real per-level data for it - flagged in TO DO.md as
    evidence worth weighing against that exclusion.
  Ability (Exceptional - All), Ability (Festive Int/Wis/Dex/Cha), All Experience, PRR and MRR -
    no corresponding effect exists in the recovered catalog at all.
  Vertigo/Stunning/Shatter, Ins. Vertigo/Stunning/Shatter - "Stunning" is a real effectName, but its
    real Combat-Tactics-DC curve (max 11 at level 30, matches Combat Mastery/Sunder/Trip) does NOT
    match this CSV row's curve (max 15) - a genuine conflict, not the same effect. "Vertigo" and
    "Shatter" don't exist as effectName rows at all.
  Boolean Y-flag augment rows (Silver, Bysh/Byeshk, Adamantine, Cold Iron, Ghost Touch, Chaotic/
    Lawful/Evil, Good, Feather Fall, Blindness Immunity, Death Ward, Underwater Action, Fear
    Immunity) - these are level-gating facts already captured by minLevelAugment, not a scaling
    bonus. Cross-checked against minLevelAugment separately (all matched except Fear Immunity -
    see Known Issues in TO DO.md) rather than inserted here.

Dice-based effects (Bashing d6, Bane d10, Damage(X)/"Effect (dmg)" d6, Shield Spikes d6, Vampirism
d2) store only the numeric die COUNT - effectBonusByLevel has no die-type column. See Known Issues
in TO DO.md.

Usage:
    python db/populate_effect_bonus.py <effect_ids.tsv> > /tmp/insert_bonus.sql
    ssh -i ~/.ssh/ddocraft_claude claude@192.168.1.153 \\
        "mysql -u ddocraft_admin -p'<password>' -h 127.0.0.1 --default-character-set=utf8mb4 ddocraft" \\
        < /tmp/insert_bonus.sql
Requires the live `effect` table to already be populated (db/populate_effect.py) and an up-to-date
effectId lookup - this script queries the CSVs only, so it needs the effectId values passed in via
the tsv argument (a `SELECT effectId, effectName FROM effect` dump, tab-separated with header).
"""
import csv
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EFFECTS_CSV = os.path.join(HERE, "..", "source_data", "Effects.csv")
AUG_CANNITH_CSV = os.path.join(HERE, "..", "source_data", "Aug_Cannith_Effects.csv")


def parse_bonus(val):
    """Extract the leading numeric bonus from values like '1d6', '3**', '20 (lvl 11)', '15?'."""
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)", val.strip())
    return float(m.group(1)) if m else None


def load_effects_csv():
    with open(EFFECTS_CSV, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    levels = [int(x) for x in rows[0][1:31]]
    effects = {}
    for row in rows[1:]:
        name = row[0].strip()
        if not name:
            continue
        by_level = {}
        for lvl, v in zip(levels, row[1:31]):
            v = v.strip()
            if v:
                by_level[lvl] = v
        effects[name] = by_level
    return effects


def load_aug_cannith_csv():
    with open(AUG_CANNITH_CSV, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    levels = [int(x) for x in rows[2][2:11]]
    entries = []
    current_name = None
    for row in rows[3:]:
        if not any(c.strip() for c in row):
            continue
        name = row[0].strip()
        source = row[1].strip() if len(row) > 1 else ""
        if name:
            current_name = name
        entries.append({
            "name": current_name, "source": source,
            "values": dict(zip(levels, [v.strip() for v in row[2:11]])),
        })
    return entries


# CSV label (Effects.csv, Cannith deliveryType) -> target effectName row(s).
CANNITH_MAP = {
    "Ability": ["Ability (Charisma)", "Ability (Constitution)", "Ability (Dexterity)",
                "Ability (Intelligence)", "Ability (Strength)", "Ability (Wisdom)"],
    "Ability damage effect": ["Ability Damage (Charisma)", "Ability Damage (Constitution)",
                "Ability Damage (Dexterity)", "Ability Damage (Intelligence)",
                "Ability Damage (Strength)", "Ability Damage (Wisdom)"],
    "Absorption": ["Absorption (Acid)", "Absorption (Cold)", "Absorption (Electricity)",
                "Absorption (Fire)", "Absorption (Sonic)"],
    "Accuracy": ["Accuracy"],
    "Ins. Accuracy": ["Insightful Accuracy"],
    "Alacrity Ranged/Melee": ["Melee Alacrity", "Ranged Alacrity"],
    "Amplification": ["Healing Amplification", "Negative Amplification", "Repair Amplification"],
    "Armor-piercing": ["Armor-Piercing"],
    "Assassinate": ["Assassinate"],
    "Ins. Assassinate": ["Insightful Assassinate"],
    "Bashing": ["Bashing"],
    "Bane": ["Bane (Aberration)", "Bane (Animal)", "Bane (Chaotic Outsider)", "Bane (Construct)",
             "Bane (Dragon)", "Bane (Dwarf)", "Bane (Elemental)", "Bane (Elf)",
             "Bane (Evil Outsider)", "Bane (Giant)", "Bane (Gnoll)", "Bane (Goblinoid)",
             "Bane (Halfling)", "Bane (Human)", "Bane (Incorporeal)", "Bane (Lawful Outsider)",
             "Bane (Magical Beast)", "Bane (Monstrous Humanoid)", "Bane (Ooze)", "Bane (Orc)",
             "Bane (Plant)", "Bane (Reptilian)", "Bane (Undead)", "Bane (Unnatural)", "Bane (Vermin)"],
    "Combat mastery": ["Combat Mastery", "Stunning", "Sunder", "Trip"],
    "Ins. Combat mastery": ["Insightful Combat Mastery", "Insightful Stunning", "Insightful Sunder",
                "Insightful Trip"],
    "Deadly": ["Deadly"],
    "Ins. Deadly": ["Insightful Deadly"],
    "Diversion": ["Diversion"],
    "Ins. Diversion": ["Insightful Diversion"],
    "Dodge": ["Dodge"],
    "Ins. Dodge": ["Insightful Dodge"],
    "Doubleshot": ["Doubleshot"],
    "Doublestrike": ["Doublestrike"],
    "Effect (dmg)": ["Damage (Acid)", "Damage (Bludgeon)", "Damage (Chaos)", "Damage (Cold)",
                "Damage (Electricity)", "Damage (Evil)", "Damage (Fire)", "Damage (Force)",
                "Damage (Good)", "Damage (Law)", "Damage (Light)", "Damage (Negative)",
                "Damage (Piercing)", "Damage (Poison)", "Damage (Slashing)", "Damage (Sonic)"],
    "Enchantment/Illusion resistance": ["Enchantment Resistance", "Illusion Resistance"],
    "Ins. Ench/Ill resistance": ["Insightful Enchantment Resistance", "Insightful Illusion Resistance"],
    "False life": ["False Life"],
    "Fortification": ["Fortification"],
    "Ins. Fortification": ["Insightful Fortification"],
    "Incite": ["Incite"],
    "Ins. Incite": ["Insightful Incite"],
    "Lore (all)": ["Spell Lore (Universal)"],
    "Lore (one type)": ["Spell Lore (Acid)", "Spell Lore (Fire)", "Spell Lore (Healing)",
                "Spell Lore (Ice)", "Spell Lore (Laceration)", "Spell Lore (Lightning)",
                "Spell Lore (Radiance)", "Spell Lore (Repair)", "Spell Lore (Sonic)",
                "Spell Lore (Void Lore)"],
    "Natural armor": ["Natural Armor"],
    "Parrying": ["Parrying"],
    "Penetration": ["Spell Penetration"],
    "Ins. Penetration": ["Insightful Spell Penetration"],
    "Poison/Disease ward": ["Poison Ward", "Disease Ward"],
    "Ins. Poi/Dis ward": ["Insightful Poison Ward", "Insightful Disease Ward"],
    "Potency": ["Potency"],
    "Protection": ["Protection"],
    "Reflex/Fortitude/Will": ["Reflex", "Fortitude", "Will"],
    "Resistance": ["Resist (Acid)", "Resist (Cold)", "Resist (Electric)", "Resist (Fire)", "Resist (Sonic)"],
    "Ins. Resistance": ["Insightful Resist (Acid)", "Insightful Resist (Cold)",
                "Insightful Resist (Electric)", "Insightful Resist (Fire)", "Insightful Resist (Sonic)"],
    "Resistance (save)": ["Resistance"],
    "Seeker": ["Seeker"],
    "Ins. Seeker": ["Insightful Seeker"],
    "Sheltering": ["Sheltering"],
    "Ins. Sheltering": ["Insightful Magical Sheltering", "Insightful Physical Sheltering"],
    "Shield bashing": ["Shield Bashing"],
    "Shield spikes": ["Shield Spikes"],
    "Skill": ["Skill (Balance)", "Skill (Bluff)", "Skill (Concentration)", "Skill (Diplomacy)",
                "Skill (Disable Device)", "Skill (Haggle)", "Skill (Heal)", "Skill (Hide)",
                "Skill (Intimidate)", "Skill (Jump)", "Skill (Listen)", "Skill (Move Silently)",
                "Skill (Open Lock)", "Skill (Perform)", "Skill (Repair)", "Skill (Search)",
                "Skill (Spot)", "Skill (Swim)", "Skill (Tumble)", "Skill (Use Magic Device)"],
    "Ins. Skill": ["Insightful Skill (Balance)", "Insightful Skill (Bluff)",
                "Insightful Skill (Concentration)", "Insightful Skill (Diplomacy)",
                "Insightful Skill (Disable Device)", "Insightful Skill (Haggle)",
                "Insightful Skill (Heal)", "Insightful Skill (Hide)", "Insightful Skill (Intimidate)",
                "Insightful Skill (Jump)", "Insightful Skill (Listen)",
                "Insightful Skill (Move Silently)", "Insightful Skill (Open Lock)",
                "Insightful Skill (Perform)", "Insightful Skill (Repair)", "Insightful Skill (Search)",
                "Insightful Skill (Spot)", "Insightful Skill (Swim)", "Insightful Skill (Tumble)",
                "Insightful Skill (Use Magic Device)"],
    "Spell Focus (one type)": ["Spell Focus (Abjuration)", "Spell Focus (Conjuration)",
                "Spell Focus (Divination)", "Spell Focus (Enchantment)", "Spell Focus (Evocation)",
                "Spell Focus (Illusion)", "Spell Focus (Necromancy)", "Spell Focus (Transmutation)"],
    "Ins. Spell focus (one)": ["Insightful Spell Focus (Abjuration)", "Insightful Spell Focus (Conjuration)",
                "Insightful Spell Focus (Divination)", "Insightful Spell Focus (Enchantment)",
                "Insightful Spell Focus (Evocation)", "Insightful Spell Focus (Illusion)",
                "Insightful Spell Focus (Necromancy)", "Insightful Spell Focus (Transmutation)"],
    "Spell focus Mastery": ["Spell Focus Mastery"],
    "Spellpower": ["Spell Power (Combustion)", "Spell Power (Corrosion)", "Spell Power (Devotion)",
                "Spell Power (Glaciation)", "Spell Power (Impulse)", "Spell Power (Magnetism)",
                "Spell Power (Nullification)", "Spell Power (Radiance)", "Spell Power (Reconstruction)",
                "Spell Power (Resonance)"],
    "Ins. Spellpower": ["Insightful Spell Power (Combustion)", "Insightful Spell Power (Corrosion)",
                "Insightful Spell Power (Devotion)", "Insightful Spell Power (Glaciation)",
                "Insightful Spell Power (Impulse)", "Insightful Spell Power (Magnetism)",
                "Insightful Spell Power (Nullification)", "Insightful Spell Power (Radiance)",
                "Insightful Spell Power (Reconstruction)", "Insightful Spell Power (Resonance)"],
    "Spell Resistance (SR)": ["Spell Resistance"],
    "Ins. Spell Resistance": ["Insightful Spell Resistance"],
    "Spell saves": ["Spell Saves"],
    "Ins. Spell saves": ["Insightful Spell Saves"],
    "Striding": ["Striding/Speed"],
    "Tendon slice": ["Tendon Slice"],
    "Ins. Tendon slice": ["Insightful Tendon Slice"],
    "Vampirism": ["Vampirism"],
    "Vitality": ["Vitality"],
    "Wizardry": ["Wizardry"],
    "Ins. Wizardry": ["Insightful Wizardry"],
}

# CSV label (Aug_Cannith_Effects.csv, Augment deliveryType) -> target effectName row(s).
AUGMENT_MAP = {
    "Ability": ["Ability (Charisma)", "Ability (Constitution)", "Ability (Dexterity)",
                "Ability (Intelligence)", "Ability (Strength)", "Ability (Wisdom)"],
    "Ability (Exceptional)": ["Exceptional Ability (Charisma)", "Exceptional Ability (Constitution)",
                "Exceptional Ability (Dexterity)", "Exceptional Ability (Intelligence)",
                "Exceptional Ability (Strength)", "Exceptional Ability (Wisdom)"],
    "Weapon Elemental Damage": ["Damage (Acid)", "Damage (Bludgeon)", "Damage (Chaos)", "Damage (Cold)",
                "Damage (Electricity)", "Damage (Evil)", "Damage (Fire)", "Damage (Force)",
                "Damage (Good)", "Damage (Law)", "Damage (Light)", "Damage (Negative)",
                "Damage (Piercing)", "Damage (Poison)", "Damage (Slashing)", "Damage (Sonic)"],
    "Spell Power (one)": ["Spell Power (Combustion)", "Spell Power (Corrosion)", "Spell Power (Devotion)",
                "Spell Power (Glaciation)", "Spell Power (Impulse)", "Spell Power (Magnetism)",
                "Spell Power (Nullification)", "Spell Power (Radiance)", "Spell Power (Reconstruction)",
                "Spell Power (Resonance)"],
    "Natural Armor": ["Natural Armor"],
    "Protection": ["Protection"],
    "Resistance (Saves)": ["Resistance"],
    "Fortification": ["Fortification"],
    "False Life": ["False Life"],
    "Elem Resistance": ["Resist (Acid)", "Resist (Cold)", "Resist (Electric)", "Resist (Fire)", "Resist (Sonic)"],
    "Wizardry": ["Wizardry"],
    "Striding": ["Striding/Speed"],
    "Proof Disease": ["Disease Ward"],
    "Proof Poison": ["Poison Ward"],
    "Dodge": ["Dodge"],
    "Skill": ["Skill (Balance)", "Skill (Bluff)", "Skill (Concentration)", "Skill (Diplomacy)",
                "Skill (Disable Device)", "Skill (Haggle)", "Skill (Heal)", "Skill (Hide)",
                "Skill (Intimidate)", "Skill (Jump)", "Skill (Listen)", "Skill (Move Silently)",
                "Skill (Open Lock)", "Skill (Perform)", "Skill (Repair)", "Skill (Search)",
                "Skill (Spot)", "Skill (Swim)", "Skill (Tumble)", "Skill (Use Magic Device)"],
    "Arcane Spell Failure": ["Twilight"],
    "Spell Focus (one)": ["Spell Focus (Abjuration)", "Spell Focus (Conjuration)",
                "Spell Focus (Divination)", "Spell Focus (Enchantment)", "Spell Focus (Evocation)",
                "Spell Focus (Illusion)", "Spell Focus (Necromancy)", "Spell Focus (Transmutation)"],
    "Luck": ["Good Luck"],
    "Max Dex": ["Max Dex Bonus"],
    "Tactics DCs (one)": ["Combat Mastery", "Stunning", "Sunder", "Tendon Slice", "Trip"],
}


def load_effect_ids(tsv_path):
    ids = {}
    with open(tsv_path, encoding="utf-8") as f:
        next(f)
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            eid, ename = line.split("\t", 1)
            ids[ename] = int(eid)
    return ids


def esc_str(v):
    return "'" + v.replace("\\", "\\\\").replace("'", "''") + "'"


def main():
    if len(sys.argv) != 2:
        print("Usage: python populate_effect_bonus.py <effect_ids.tsv>", file=sys.stderr)
        print("  (a tab-separated `SELECT effectId, effectName FROM effect` dump, with header)", file=sys.stderr)
        sys.exit(1)
    effect_ids = load_effect_ids(sys.argv[1])

    effects_csv = load_effects_csv()
    aug_entries = load_aug_cannith_csv()
    aug_by_name_source = {}
    for e in aug_entries:
        aug_by_name_source.setdefault((e["name"], e["source"]), e)

    rows = []  # (effectId, deliveryType, level, bonus)
    seen = set()

    for csv_name, targets in CANNITH_MAP.items():
        by_level = effects_csv[csv_name]
        for target in targets:
            eid = effect_ids[target]
            for lvl, val in by_level.items():
                bonus = parse_bonus(val)
                if bonus is None:
                    continue
                key = (eid, "Cannith", lvl)
                if key in seen:
                    continue
                seen.add(key)
                rows.append((eid, "Cannith", lvl, bonus))

    for csv_name, targets in AUGMENT_MAP.items():
        src_entry = None
        for (name, source), e in aug_by_name_source.items():
            if name == csv_name and ("Augment" in source or source == ""):
                src_entry = e
                break
        if src_entry is None:
            continue
        for target in targets:
            eid = effect_ids[target]
            for lvl, val in src_entry["values"].items():
                val = val.strip()
                if val in ("", "-"):
                    continue
                bonus = parse_bonus(val)
                if bonus is None:
                    continue
                key = (eid, "Augment", lvl)
                if key in seen:
                    continue
                seen.add(key)
                rows.append((eid, "Augment", lvl, bonus))

    lines = [f"({eid},{esc_str(dt)},{lvl},{bonus},'claude-migration','claude-migration')"
             for eid, dt, lvl, bonus in rows]
    print(f"-- {len(lines)} rows generated from Effects.csv / Aug_Cannith_Effects.csv")
    print("INSERT INTO effectBonusByLevel (effectId, deliveryType, level, bonus, createBy, updateBy) VALUES")
    print(",\n".join(lines) + ";")


if __name__ == "__main__":
    main()
