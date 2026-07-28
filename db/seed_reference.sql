-- Seeds the two small, fixed reference tables. bonusType values are the real distinct values
-- from the recovered SQLite data, with 'Competance'/'Competancy' merged into the correctly-spelled
-- 'Competence' (confirmed as the same bonus type, just inconsistently typed across different rows
-- - not a judgment call about game mechanics, a spelling fix). augmentColor is the four real base
-- colors only - Green/Orange/Purple are derived combinations, never stored as rows.
--
-- 'Adamantine', 'Material', 'Blindness', 'Regeneration', and 'Unknown' were dropped per Jeff
-- (2026-07-28): 'Material'/'Adamantine' were placeholder guesses for material-based DR-bypass
-- properties (Adamantine, Byeshk, Cold Iron, Metalline, Silver, Mithril, Everbright) that don't
-- actually carry a real bonus type in DDO's system - their historical bonuses are non-numerical
-- or, where numeric (DR), untyped - so those rows should use 'Untyped' instead. 'Blindness' and
-- 'Regeneration' were effect-name leakage (see KNOWN ISSUES in ddocraft.js) - Blindness Immunity
-- has no stacking possibility so no real type, Regeneration is untyped. The two rows that already
-- used the literal 'Unknown' placeholder (Bashing, Shield Spikes) fold into 'Untyped' too - same
-- "no real numeric-stacking type" situation, just a different placeholder string for it.
-- 'Equipment', 'Feat', and 'Vitality' are confirmed real, distinct DDO bonus types - kept as-is.

INSERT INTO bonusType (bonusTypeName, createBy, updateBy) VALUES
('Competence', 'claude-seed', 'claude-seed'),
('Deflection', 'claude-seed', 'claude-seed'),
('Dodge', 'claude-seed', 'claude-seed'),
('Enhancement', 'claude-seed', 'claude-seed'),
('Equipment', 'claude-seed', 'claude-seed'),
('Exceptional', 'claude-seed', 'claude-seed'),
('Feat', 'claude-seed', 'claude-seed'),
('Insight', 'claude-seed', 'claude-seed'),
('Luck', 'claude-seed', 'claude-seed'),
('Natural Armor', 'claude-seed', 'claude-seed'),
('Resistance', 'claude-seed', 'claude-seed'),
('Sacred', 'claude-seed', 'claude-seed'),
('Untyped', 'claude-seed', 'claude-seed'),
('Vitality', 'claude-seed', 'claude-seed');

INSERT INTO augmentColor (augmentColorName, createBy, updateBy) VALUES
('Yellow', 'claude-seed', 'claude-seed'),
('Blue', 'claude-seed', 'claude-seed'),
('Colorless', 'claude-seed', 'claude-seed'),
('Red', 'claude-seed', 'claude-seed');
