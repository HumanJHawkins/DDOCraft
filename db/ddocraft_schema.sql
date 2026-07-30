-- DDOCraft database schema (MariaDB).
--
-- Conventions:
--   - Every table's primary key is <tableName>Id, INT AUTO_INCREMENT.
--   - Every table has createBy/createDate/updateBy/updateDate. createBy/updateBy are plain
--     VARCHAR identifiers for now, not an FK to an accounts table - no account system exists yet.
--   - Table names are singular (itemCategory, not itemCategories) so "<tableName> + Id" reads
--     naturally as the PK name.
--
-- Still provisional: effect.effectKey/bonusTypeId nullability, and the exact 0-5 rating scale on
-- the class/purpose columns, are open until real data forces the question.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- bonusType: DDO's fixed set of bonus types (Enhancement, Insightful, Artifact, Alchemical,
--   Competence, etc.) as a real lookup table, not a free-text column. This matters because "same
--   bonus type doesn't stack, different bonus types do" is the actual DDO rule the app's overlap/
--   duplicate detection is built on - a typo'd or inconsistent bonus type string would silently
--   break that, which a lookup table (referenced by FK, not retyped per row) prevents.
CREATE TABLE bonusType (
    bonusTypeId   INT AUTO_INCREMENT PRIMARY KEY,
    bonusTypeName VARCHAR(50)  NOT NULL UNIQUE,
    createBy      VARCHAR(100) NOT NULL,
    createDate    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy      VARCHAR(100) NOT NULL,
    updateDate    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- effect: the master pool of every effect the app knows about. Not every effect is really an
--   "enchantment" (some are intrinsic material/item properties like Mithril) - hence the rename
--   from the old SQLite schema's "enchantment" table.
--
--   effectKey (nullable) is the canonical/semantic identity used together with bonusTypeId to
--   decide whether two selections stack - distinct from effectName, which is just display text
--   and can be reworded without touching stacking logic. Both are nullable because a handful of
--   old rows (e.g. "Tourney Armor Extras") never had a real bonus type or stacking key at all -
--   they're flavor-only entries, not a bug to fix by forcing a value here.
--
--   basic/nonscaling/forMeleeDmg/forRangedDmg/forACDefence/forResistDefence/forHitPoints are NOT
--   membership flags - per Jeff, they're a manually-curated usefulness rating (a small numeric
--   scale) of the effect from that build-purpose's perspective, likely to stay hand-edited
--   indefinitely rather than backed by empirical usage data. Kept as columns on this table rather
--   than a junction table specifically because they're editorial judgment calls needing easy
--   one-place manual editing, not a relational fact that's simply true or false. nonscaling in
--   particular is an inherent trait of the effect itself, not a rating, but lives here for the
--   same reason. allEnch is effectively always populated/true across real rows - kept only for
--   continuity with the existing "sum of active filter weights" recommendation-highlight
--   mechanism.
--
--   A parallel set of 15 per-class columns (forBarbarian..forWizard) existed here until
--   2026-07-30 and was removed - rating an effect's usefulness "for Barbarian" (etc.) baked in an
--   assumption about how that class is supposed to be played (e.g. treating melee damage as
--   inherently more "for Barbarian" than AC or ranged options), which doesn't hold - DDO players
--   build the same class many different ways. The build-purpose columns above (forACDefence,
--   forMeleeDmg, ...) are what's actually useful: pick your playstyle goal directly instead of
--   inferring it from a class stereotype. The removed data isn't lost - the raw recovered SQLite
--   data (source_data/equipDDO.sqlite) still carries these columns internally, just unused; see
--   Done.md for the full removal.
CREATE TABLE effect (
    effectId          INT AUTO_INCREMENT PRIMARY KEY,
    effectName        VARCHAR(150) NOT NULL UNIQUE,
    effectKey         VARCHAR(150) NULL,
    bonusTypeId       INT NULL,
    effectGroup       VARCHAR(100) NULL,   -- loose classification (Damage, Ability, Skill, ...) - descriptive only, not load-bearing
    effectDescription VARCHAR(500) NULL,
    effectSortOrder   INT NULL,
    minLevelCannith   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    minLevelAugment   TINYINT UNSIGNED NOT NULL DEFAULT 0,

    -- Editorial usefulness ratings (small scale; NULL = not yet rated). All manually curated, all
    --   deliberately flat columns on this table - see note above.
    allEnch           TINYINT UNSIGNED NULL,
    basic             TINYINT UNSIGNED NULL,
    nonscaling        TINYINT UNSIGNED NULL,
    forMeleeDmg       TINYINT UNSIGNED NULL,
    forRangedDmg      TINYINT UNSIGNED NULL,
    forACDefence      TINYINT UNSIGNED NULL,
    forResistDefence  TINYINT UNSIGNED NULL,
    forHitPoints      TINYINT UNSIGNED NULL,

    createBy          VARCHAR(100) NOT NULL,
    createDate        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy          VARCHAR(100) NOT NULL,
    updateDate        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_effect_bonusType FOREIGN KEY (bonusTypeId) REFERENCES bonusType(bonusTypeId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_effect_effectKey ON effect(effectKey);

-- ---------------------------------------------------------------------------------------------
-- effectEquivalencyGroup / effectEquivalencyMember: replaces the old single enchSupercededBy
--   name-pointer (a fragile string match against enchName) with a proper grouping. Several
--   effects can be "the same thing from the same source" (e.g. the specific Alignments vs. the
--   universal "Aligned"), and per Jeff, we eventually want to rank quality within a group (the
--   universal option is usually strictly better than one specific case it covers) rather than
--   just flag them as interchangeable - qualityScore is that hook, left NULL until assessed.
--   Deliberately minimal: supercededBy was barely used in the old data, so most effects will
--   never have a row here at all, and this shouldn't grow more complex than it needs to.
CREATE TABLE effectEquivalencyGroup (
    effectEquivalencyGroupId INT AUTO_INCREMENT PRIMARY KEY,
    groupLabel               VARCHAR(150) NULL,  -- optional human-readable label, e.g. "Alignment"
    createBy                 VARCHAR(100) NOT NULL,
    createDate               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy                 VARCHAR(100) NOT NULL,
    updateDate               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE effectEquivalencyMember (
    effectEquivalencyMemberId INT AUTO_INCREMENT PRIMARY KEY,
    effectEquivalencyGroupId  INT NOT NULL,
    effectId                  INT NOT NULL,
    qualityScore              DECIMAL(6,2) NULL,  -- relative quality within the group, once assessed - not yet populated
    createBy                  VARCHAR(100) NOT NULL,
    createDate                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy                  VARCHAR(100) NOT NULL,
    updateDate                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_eem_group  FOREIGN KEY (effectEquivalencyGroupId) REFERENCES effectEquivalencyGroup(effectEquivalencyGroupId),
    CONSTRAINT fk_eem_effect FOREIGN KEY (effectId) REFERENCES effect(effectId),
    CONSTRAINT uq_eem_group_effect UNIQUE (effectEquivalencyGroupId, effectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- effectBonusByLevel: one row per effect+deliveryType+level, giving the numeric bonus that
--   delivery type grants at that level - "bonus" per the existing bonusType naming (a bonus type
--   applies to a bonus; magnitude wasn't the right word). Populated 2026-07-28 from Jeff's
--   Effects.csv/Aug_Cannith_Effects.csv (see db/populate_effect_bonus.py) - not every effect has
--   data, and not every level is relevant once min-level gating already excludes some.
CREATE TABLE effectBonusByLevel (
    effectBonusByLevelId INT AUTO_INCREMENT PRIMARY KEY,
    effectId             INT NOT NULL,
    deliveryType         ENUM('Cannith','Augment') NOT NULL,
    level                TINYINT UNSIGNED NOT NULL,
    bonus                DECIMAL(10,2) NOT NULL,
    createBy             VARCHAR(100) NOT NULL,
    createDate           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy             VARCHAR(100) NOT NULL,
    updateDate           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ebbl_effect FOREIGN KEY (effectId) REFERENCES effect(effectId),
    CONSTRAINT uq_ebbl_effect_delivery_level UNIQUE (effectId, deliveryType, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- itemCategory: one row per equipment category (Goggles, Helm, Armor, Melee1, ...). No "item"
--   table exists - a Cannith item is always "Cannith " + itemCategoryName, purely formulaic, and
--   a named/custom item has zero DB backing by design (the app has no knowledge of any specific
--   named item - see ddocraft.js's PIVOT note). No augmentSlotCount column either: real Cannith
--   blanks vary 0-2 augment slots per the specific in-game item, not per category, so "up to 2" is
--   an app-level rendering assumption, not data this table can actually own. No allowsColorless
--   either - every augment slot accepts colorless universally, so the flag would carry zero
--   information; that's handled as a constant at the app layer instead.
CREATE TABLE itemCategory (
    itemCategoryId        INT AUTO_INCREMENT PRIMARY KEY,
    itemCategoryName      VARCHAR(50) NOT NULL UNIQUE,
    itemCategorySortOrder INT NULL,  -- display order (Goggles, Helm, Necklace, ... Orb) - matches the original recovered data's implied category order
    allowsBlue            BOOLEAN NOT NULL DEFAULT FALSE,
    allowsYellow          BOOLEAN NOT NULL DEFAULT FALSE,
    allowsRed             BOOLEAN NOT NULL DEFAULT FALSE,  -- also drives Orange/Purple eligibility (Red+Yellow / Red+Blue) at the app layer
    createBy              VARCHAR(100) NOT NULL,
    createDate            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy              VARCHAR(100) NOT NULL,
    updateDate            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- augmentColor: the real base augment colors only. Green/Orange/Purple are NOT rows here - they
--   are derived combinations (Green=Blue+Yellow, Orange=Red+Yellow, Purple=Red+Blue), resolved at
--   the app layer from itemCategory's allowsX flags, never stored as their own entity. Colorless
--   IS a row here even though itemCategory has no matching "allows" flag - effects still need to
--   link to it via augmentOption, it's just that every category is eligible for it, so there's
--   nothing to gate per-category.
CREATE TABLE augmentColor (
    augmentColorId   INT AUTO_INCREMENT PRIMARY KEY,
    augmentColorName VARCHAR(20) NOT NULL UNIQUE,
    createBy         VARCHAR(100) NOT NULL,
    createDate       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy         VARCHAR(100) NOT NULL,
    updateDate       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- augmentOption: links an effect to the augment color(s) it's eligible for. Global and item-
--   independent - the same list applies to every item's augment slot of that color, whether it's
--   a Cannith blank or a user-defined custom item's slot.
CREATE TABLE augmentOption (
    augmentOptionId       INT AUTO_INCREMENT PRIMARY KEY,
    effectId              INT NOT NULL,
    augmentColorId        INT NOT NULL,
    augmentOptionSortOrder INT NULL,  -- display order within a color, inherited from the recovered data's itemOptionSortOrder
    createBy              VARCHAR(100) NOT NULL,
    createDate            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy              VARCHAR(100) NOT NULL,
    updateDate            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_ao_effect       FOREIGN KEY (effectId) REFERENCES effect(effectId),
    CONSTRAINT fk_ao_augmentColor FOREIGN KEY (augmentColorId) REFERENCES augmentColor(augmentColorId),
    CONSTRAINT uq_ao_effect_color UNIQUE (effectId, augmentColorId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- cannithCategoryOption: links a category's non-augment slot (Prefix, Suffix, Extra) to the
--   effects craftable there. Augment slots never appear here - they're handled entirely through
--   itemCategory's allowsX flags plus augmentOption.
CREATE TABLE cannithCategoryOption (
    cannithCategoryOptionId          INT AUTO_INCREMENT PRIMARY KEY,
    itemCategoryId                   INT NOT NULL,
    slotType                         ENUM('Prefix','Suffix','Extra') NOT NULL,
    effectId                         INT NOT NULL,
    cannithCategoryOptionSortOrder   INT NULL,  -- display order within a category+slot, inherited from the recovered data's itemOptionSortOrder
    createBy                         VARCHAR(100) NOT NULL,
    createDate                       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy                         VARCHAR(100) NOT NULL,
    updateDate                       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_cco_itemCategory FOREIGN KEY (itemCategoryId) REFERENCES itemCategory(itemCategoryId),
    CONSTRAINT fk_cco_effect       FOREIGN KEY (effectId) REFERENCES effect(effectId),
    CONSTRAINT uq_cco_category_slot_effect UNIQUE (itemCategoryId, slotType, effectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- characterBuild: a user's saved DDOCraft build (what today's client-side JSON save/load feature
--   downloads to a file). Lives in the ddocraft DB, not a shared GateIron.com DB - accounts are
--   GateIron.com-wide (a separate DB, since MariaDB allows free cross-database joins on the same
--   server - see the design discussion this table came out of), but each app owns its own domain
--   data. userId is deliberately NOT a real FOREIGN KEY - MySQL/MariaDB can't enforce a constraint
--   across two different databases, so this is an app-enforced reference to that other DB's
--   user.id, not a DB-enforced one.
--
--   Phase 1 (this table, now): userId is a placeholder value - no real accounts/OAuth exist yet,
--   so the API trusts whatever caller-supplied value it's given. Phase 2 (later): GateIron.com
--   gets real accounts (Auth.js), and userId starts coming from an authenticated session instead -
--   no schema change needed here, since the column was already shaped to hold a real user.id.
--
--   characterBuildId is an app-generated random UUID (v4), NOT an auto-increment integer - it
--   doubles as the "open a build" URL identifier, and a random 122-bit value is what makes that
--   URL safe to hand to someone else: knowing one build's id only opens that one build, it can't
--   be used to enumerate or guess at anyone else's. A sequential integer here would have made
--   every saved build trivially guessable from any other.
--
--   buildData is the app's full existing save-file payload (positional/inherent selections,
--   categoryMode, customItems, collapsed state) stored as one opaque JSON blob rather than
--   normalized into rows - the server never needs to understand its internal shape, only store and
--   return it, so client-side save-format changes never require a server-side migration. (The
--   recommendation/filter checkboxes are UI-only state that was never part of this payload to
--   begin with - see ddocraft.js's charData.enchFilter vs charData.saveFile.)
--   charName/charLevel/description are pulled out as their own real columns specifically so a
--   future "your saved builds" list view can query/sort/display them without deserializing every
--   row's JSON.
--
--   buildChecksum is a SHA-256 hash over a canonicalized subset of the build - what the build
--   actually IS, independent of who owns it, what it's called, or when it was saved: charLevel
--   plus every item/category field (selections, categoryMode, custom item names/descriptions/
--   augments). Deliberately excluded: characterBuildId/userId/charName/description/appVersion/
--   dates (ownership and history, not the build itself) and collapsed state (UI presentation, not
--   the build). Lets two saves be recognized as "the same build" regardless of who made them or
--   what they called it - e.g. surfacing builds independently arrived at by multiple users as a
--   popularity signal (see TO DO.md), or warning on a redundant re-save.
--
--   effectCount (added 2026-07-31) is `buildData.positional.length + buildData.inherent.length` -
--   a plain count of selected options/effects, computed and stored server-side at save time so the
--   list endpoint can show/sort it without deserializing every row's JSON. Also drives the
--   overwrite-confirmation check in POST /: saving different content under a name that already has
--   an active build compares this against the existing row's effectCount before proceeding.
--
--   deletedDate (added 2026-07-31) is a soft-delete marker, NULL for an active row. Overwriting an
--   existing build (same owner + name, different content) doesn't literally overwrite the old row
--   yet - it soft-deletes it and inserts a new one, so the old version is still recoverable/
--   auditable rather than gone outright. List and single-build GET both filter deletedDate IS NULL.
CREATE TABLE characterBuild (
    characterBuildId CHAR(36)         NOT NULL PRIMARY KEY,  -- app-generated UUID v4, see note above
    userId            INT              NOT NULL,  -- see note above: app-enforced, not a real FK
    charName          VARCHAR(100)     NOT NULL,
    charLevel         TINYINT UNSIGNED NOT NULL,
    description       TEXT             NULL,
    appVersion        VARCHAR(20)      NOT NULL,
    buildData         JSON             NOT NULL,
    buildChecksum     CHAR(64)         NOT NULL,  -- SHA-256 hex digest, see note above
    effectCount       INT UNSIGNED     NOT NULL DEFAULT 0,
    deletedDate       DATETIME         NULL,  -- NULL = active; soft-delete marker, see note above
    createBy          VARCHAR(100)     NOT NULL,
    createDate        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy          VARCHAR(100)     NOT NULL,
    updateDate        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_characterBuild_userId (userId),
    INDEX idx_characterBuild_checksum (buildChecksum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- characterClass: DDO's playable classes, self-referencing so an Iconic Hero (a distinct class
--   variant tied to a specific race/backstory - Bladeforged, Shadar-kai, etc.) can be modeled as
--   its own row with parentClassId pointing at the base class it's a variant of, rather than a
--   second table. NULL parentClassId means a true base class. Chosen over a fully separate
--   "characterIconicHero" table specifically so a future effect-benefit rating (see TO DO.md) can
--   reference either a base class or an Iconic Hero the same way, with no separate join path - an
--   Iconic can get its own distinct ratings that differ from its parent's if/when that data
--   exists, or just fall back to the parent's via a view, without restructuring anything here.
--
--   Seeded with the 15 base classes only, for now - taken directly from the existing forBarbarian-
--   style filter checkboxes already in ddocraft.php/ddocraft.js (the authoritative source, since
--   Jeff built that list from real game knowledge), not independently guessed. Iconic Hero rows
--   are deliberately NOT seeded yet - the current roster needs confirming first (see TO DO.md).
--
--   Immediate use is cosmetic/informational only (2a: shows on the character info section and in
--   the downloadable report) - it doesn't yet drive any filtering or level-gating logic.
CREATE TABLE characterClass (
    characterClassId        INT AUTO_INCREMENT PRIMARY KEY,
    className                VARCHAR(50) NOT NULL UNIQUE,
    parentClassId            INT NULL,  -- NULL = base class; set = an Iconic Hero variant of that class
    characterClassSortOrder  INT NULL,
    createBy                 VARCHAR(100) NOT NULL,
    createDate               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updateBy                 VARCHAR(100) NOT NULL,
    updateDate               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_characterClass_parent FOREIGN KEY (parentClassId) REFERENCES characterClass(characterClassId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- Views.
--
-- Audited every query in server/src/routes/*.ts (2026-07-29) for view candidates. Almost all of
--   them are single-table selects, sometimes parametrized (WHERE userId = ?, WHERE effectId = ?)
--   - a view adds no real value over the table itself when there's no join or computed shape to
--   encapsulate, so those were deliberately left alone. The one clear case was effects.ts's join
--   of effect to bonusType for display - promoted below.
--
-- The one REAL upcoming case is bigger: once the forBarbarian-style per-class rating columns move
--   into a proper normalized table (see TO DO.md's characterClass/effect-benefit item), a view is
--   exactly the right tool to reconstruct the flat forBarbarian/forFighter/... shape the client
--   still expects, so normalizing storage doesn't force a client-side contract change. Not created
--   yet - there's nothing to select from until that table exists.
CREATE VIEW vw_effectDetail AS
    SELECT e.effectId, e.effectName, e.effectKey, e.effectGroup, e.effectDescription,
           e.minLevelCannith, e.minLevelAugment, e.effectSortOrder, bt.bonusTypeName
    FROM effect e
    LEFT JOIN bonusType bt ON bt.bonusTypeId = e.bonusTypeId;
