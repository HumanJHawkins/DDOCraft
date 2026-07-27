"""
Applies deliberate corrections/decisions on top of the raw recovered data in equipDDO.sqlite.
Run build_db.py first (it rebuilds from CSV and wipes prior corrections), then this script.
Kept separate from build_db.py so "what we recovered" and "what we've since decided" stay distinct.
"""
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "equipDDO.sqlite")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# --- Step 2: flag questionable rows (believed not to exist in-game / not as augments) ---
QUESTIONABLE = [
    "Resist (Light)", "Resist (Negative)", "Resist (Poison)",
    "Insightful Resist (Light)", "Insightful Resist (Negative)", "Insightful Resist (Poison)",
    "Insightful Ability (Charisma)", "Insightful Ability (Constitution)",
    "Insightful Ability (Dexterity)", "Insightful Ability (Intelligence)",
    "Insightful Ability (Strength)", "Insightful Ability (Wisdom)",
]
cur.executemany(
    "UPDATE enchantment SET dataStatus = 'questionable' WHERE enchName = ?",
    [(n,) for n in QUESTIONABLE]
)
print(f"Flagged {cur.rowcount if cur.rowcount != -1 else len(QUESTIONABLE)} rows via loop "
      f"(executemany doesn't report cumulative rowcount reliably - verifying by count below)")

cur.execute("SELECT COUNT(*) FROM enchantment WHERE dataStatus = 'questionable'")
count = cur.fetchone()[0]
print(f"Verification: {count} rows now flagged 'questionable' (expect 12)")
if count != len(QUESTIONABLE):
    raise SystemExit(f"MISMATCH: expected {len(QUESTIONABLE)}, got {count}")

cur.execute("SELECT enchName FROM enchantment WHERE dataStatus = 'questionable' ORDER BY enchName")
for row in cur.fetchall():
    print(f"  - {row[0]}")

conn.commit()
conn.close()
print("Corrections applied.")
