// TO DO:
// Do a better job of highlighting collapsed items? (Standard chevrons?)
// Examine and clean up the 12 excluded/flagged data-discrepancy rows (see PHASE 1 below) - very
//   low priority, current dataset is believed correct, but it should stay on the list to check.

// TO DO: Full staged plan, three merged streams (SQLite migration, render/state architecture
//   rewrite, named item feature). One continuous numbering - delete each step as it's completed,
//   and renumber the rest if a step is removed so the order never has gaps or collisions.
//
// PHASE 1 (done): equipDDO.sqlite (source_data/) is now the real source of truth - built from
//   the recovered CSVs, questionable rows flagged and excluded, Cannith/category split moved
//   into the schema, Tourney Armor re-added as normalized rows referencing shared definitions,
//   level defaults bumped to 36.
//
// TEST (done, 2026-07-27): ddocraft.json is now generated FROM equipDDO.sqlite
//   (source_data/export_ddocraft_json.py, still the old flat/duplicated shape - this was a
//   narrow test of "does the app work correctly sourced from the new data" without doing any of
//   Phase 2's rendering/state rewrite. The old hand-patched flat file is preserved in
//   obsolete/ddocraft_hand-patched-flat-file_last-version-2026-07-27.json for reference; nobody
//   should hand-edit ddocraft.json again, ever - edit equipDDO.sqlite and re-run build_db.py ->
//   apply_corrections.py -> export_ddocraft_json.py instead.

// DONE (2026-07-27): Duplicate-effect handling redesigned from "block the second selection" to
//   "allow it, flag it" - selecting an effect already selected elsewhere no longer disables the
//   click; both instances render as a warning (rose "duplicate") instead of plain selected
//   (green), since a redundant effect is sometimes worth the dead weight to also get a named
//   item's other unique effect. New button-state palette (dark theme, WCAG-checked): green
//   selected, rose duplicate warning, muted "discouraged" for an effect taken elsewhere or a slot
//   already occupied (clickable now, not disabled), blue gradient for filter-recommended effects
//   (suppressed once anything is selected for that effect, anywhere). Clicking a different effect
//   in an occupied slot now swaps it in directly instead of being blocked. Committed in ebaba8b.

// PIVOT (2026-07-27): The named-item plan changed from "hand-curate ~10-20 popular items as data"
//   to "let the user define any named/custom item at point of use" - full replacement, not a
//   hybrid. A named/custom item decomposes into two independently-rendered pieces: real augment
//   slots (identical to Cannith augment rendering - color-eligibility rules are UNCHANGED) and a
//   flat, unscoped pool of inherent/fixed effects (no slot, no mutual exclusivity - deliberately
//   NOT filtered by category, since a named item's whole appeal can be an effect normal Cannith
//   crafting could never produce for that category). Both pieces become ordinary entries in the
//   same selections/duplicate system - nothing about them is locked or non-removable.

// FUTURE (2026-07-27, updated 2026-07-27): Longer-term direction is a real backend - MariaDB
//   (switched from the originally-discussed Postgres: same relational design goals, but included
//   in Jeff's existing Hostinger plan rather than requiring an upgrade) + Node.js, likely on the
//   same infrastructure being consolidated for GateIron. Motivation beyond "it's a better
//   architecture": crowd-sourced named-item data-mining (if several unrelated users independently
//   enter the same effect set for a named item, that agreement is itself evidence, and can seed a
//   prepopulated dropdown without hand-curation) and real user accounts/saved characters/builds -
//   none of which are possible with a static-file client. Not started; schema will be designed
//   directly in MariaDB when that begins, rather than continuing to normalize equipDDO.sqlite
//   further (PHASE 2 steps 1-2 below are effectively superseded by this, not abandoned - the
//   relational design work still needs doing, just against MariaDB instead of SQLite). The
//   client-side rewrite below does NOT wait on this: it's built against the existing ddocraft.json
//   with the loading step isolated, specifically so the eventual swap to a live API is a small,
//   contained change instead of another full rewrite.

// DONE (2026-07-27): PHASE 2 steps 3-9 (client-side render/state rewrite) complete, against the
//   existing ddocraft.json (steps 1-2, normalizing the export itself, deferred - see FUTURE note).
//   loadEnchantmentOptions() now builds two structures once at load: charData.enchantments (one
//   deduped record per enchantment, keyed by name) and charData.catalog (category -> item -> slot
//   -> color -> ordered list of candidate enchantment names), replacing initEnchStates()'s flat-
//   array boundary-flag computation entirely. A new charData.selections store (positional, keyed
//   by item/slot: what occupies this exact slot right now; inherent, keyed by category/item: a
//   set of fixed effects with no slot - reserved, unused until named/custom items land) replaced
//   per-row enchState mutation - selection state and catalog data are no longer the same object.
//   renderEnchantmentOptions()/getButton() are now a data-driven walk over categories, computing
//   selected/duplicate/discouraged-but-clickable/blocked/gradient fresh from the selections store
//   on every render via one pass (computeSelectionIndex()) instead of scanning ~4000+ rows.
//   enchClick() collapsed to a handful of lines: since a slot's occupant is a single dict entry,
//   "swap" is just overwriting it - no more explicit deselect-then-select loop, and no more
//   toggled "blocked" flag to drift out of sync (blocked/duplicate/handled are recomputed, never
//   stored). Collapse state moved from a per-row scalar to three explicit key sets (item/slot/
//   color), toggled directly instead of via boundary-relative priority rules. Save/load rewritten
//   against the selections store directly (version bumped to 2.0 - NOT backward compatible with
//   older save files; explicitly not carrying forward the old format's 3-branch legacy parsing,
//   flagged here rather than silently dropped). Verified in-browser: rendering, cross-item
//   duplicate warning and revert, same-slot swap (including while the outgoing selection was
//   itself a duplicate elsewhere), three-level collapse, filter gradient, level-gating confirm
//   dialog, save/load round-trip, category dropdown (still cosmetic-only pending PHASE 3 step 11).

// PHASE 2 (remaining): schema/export normalization - see FUTURE note above; likely superseded by
//   a Postgres schema rather than continued SQLite work.
//
// 1. Normalize the schema: an item-category table, and a Cannith-options linking table (category
//    + slot + color -> effect) so "is Sheltering a valid Helm/Prefix option" is explicit
//    relational data, not implied by row presence in a flat table. Augment color-eligibility
//    rules must keep behaving exactly as they do today.
// 2. Export normalized JSON (or a live API, if the MariaDB backend is underway by then) instead
//    of one flattened file - charData.enchantments/charData.catalog's *shape* doesn't change,
//    only loadEnchantmentOptions()'s fetch mechanism does.

// PHASE 3: Named/Custom item feature, built on the new architecture (see PIVOT note above).
//
// 3. Magnitude/description lookup table, keyed by Character Level and itemOptionItem; migrate
//    description display to pull from it instead of a static enchDesc.
// 4. (Future, explicitly out of scope for this phase) Optional prepopulated dropdown of popular
//    named items layered on top of the custom-item mechanism, for convenience - full manual
//    entry is the complete solution for now.

// FIXED (2026-07-27): Two bugs Jeff found testing the custom-item feature.
//   (1) There was no way back to Cannith mode once a category switched to custom - the old
//   confirm-then-delete toggle handler is gone. Toggling either direction is now purely a mode
//   flip: nothing is ever deleted just for being hidden. A hidden custom item's selections stay
//   exactly as left and are excluded from duplicate-warning accounting while inactive (new
//   categoryOfCustomItemKey() helper, checked in computeSelectionIndex()) - so a duplicate that
//   existed only because of a now-hidden custom pick correctly clears, and reappears if the
//   category is switched back to custom. No confirm dialog needed anywhere in this flow anymore,
//   since nothing is ever lost.
//   (2) The augment slot's "x" remove control looked wired but didn't reliably work - per
//   instruction, replaced the confirm-then-maybe-delete version with an unconditional delete,
//   matching how an ordinary re-selection elsewhere in the app already never confirms. Re-verified
//   removing from the middle of a multi-slot stack: the stable per-slot id (not array position)
//   means the slots on either side keep their own selections untouched, and displayed numbering
//   ("Augment 1", "Augment 2", ...) recomputes cleanly with no gap.

// DONE (2026-07-27): Old PHASE 3 steps 3, 4, and 6 - the universal inherent-effects picker, plus
//   persistence for the whole custom-item feature. Fixed the export gap first: vAllEnchantment's
//   WHERE combined.itemOptionSortOrder IS NOT NULL filter used to silently drop any enchantment
//   with zero itemOption bindings - removed it (apply_corrections.py), which surfaced not just the
//   3 named-item-only rows from the Tourney Armor removal but 3 more pre-existing orphaned rows
//   nobody had noticed (Adamantine (Armor), Mithril, Insightful Skill (Use Magic Device)) - all
//   now real, pickable master-pool entries. buildCatalog() skips catalog-building for rows with no
//   itemOptionCategory (nothing to catalog) but still adds them to charData.enchantments.
//   The picker itself: one flat, alphabetically-sorted list of every enchantment, deliberately not
//   filtered by category (a named item's whole appeal can be an effect Cannith crafting could never
//   produce there) and deliberately not specially searchable (relies on the browser's own search,
//   same precedent as the existing ~1500-row Cannith lists). No level gating (an item's inherent
//   effect isn't crafted at a threshold) and no "blocked" state (no slot to occupy) - otherwise the
//   same selected/duplicate/discouraged rules as everything else, via computeSelectionIndex().
//   Turning a category back to Cannith mode now also clears any inherent selections, same reasoning
//   as the positional cleanup from the augment-editor commit.
//   Persistence: turned out to be most of the way there already (charData.saveFile.inherent and
//   its handleLoad restoration were scaffolded, unused, back in the original rewrite) - just needed
//   categoryMode and customItems added, and critically, restored BEFORE positional/inherent
//   selections on load, since a "custom:Category" selection is meaningless without the config that
//   makes that category render in custom mode with the matching augment slots. Save version bumped
//   to 2.1 (additive - a 2.0 file still loads fine, it just won't have had a custom item to restore).
//   Verified: unbound enchantments load and render; inherent selection participates in cross-item
//   duplicate detection against both Cannith and augment picks; full save/load round-trip restores
//   categoryMode, customItems (name, augments with correct ids/colors), positional, and inherent
//   selections, and everything re-renders correctly from that alone.

// DONE (2026-07-27): Old PHASE 3 steps 3 and 6 - the inline augment editor. A "+ Add Augment"
//   select in the custom item's row list (color picker; resets itself after each pick) appends a
//   slot with a stable numeric ID (charData.customItems[category].augments, nextAugmentId never
//   reused) - capped at 7. Each slot renders via the exact same getButton() every Cannith augment
//   slot uses, sourced from a new charData.augmentOptionsByColor[color] lookup (every enchantment
//   eligible for that color, harvested once from the same rows the catalog is built from - color
//   eligibility is global, not item-specific, so this needed no new data). A "x" control removes a
//   slot, confirming first only if it holds a selection. Turning the whole category back to
//   Cannith mode now also deletes any lingering selections keyed to the custom pseudo-item
//   ("custom:"+category) - otherwise they'd sit invisibly in the selections store and keep
//   skewing duplicate-warning counts elsewhere even after being "discarded." Verified: candidates
//   render correctly per color, selection participates in cross-item duplicate detection exactly
//   like a Cannith pick, cap enforced, remove-with-confirm and remove-without-confirm both correct,
//   toggle-off cleanup leaves no orphaned selection.

// DONE (2026-07-27): Old PHASE 3 steps 3 and 7 - the "Named or Custom Item" toggle. Each category
//   header now has a checkbox (charData.categoryMode[category], default 'cannith'); switching it
//   to 'custom' hides that category's Cannith rows entirely (not blacked out) and renders a name
//   field instead, backed by charData.customItems[category] = {name}. Turning it back off prompts
//   a confirm if a name has been entered (discarding it otherwise silently would lose real user
//   input), and reverts the checkbox visually on cancel. Augment editor and inherent-effects
//   picker (old steps 4-5, renumbered 3-4 above) are still ahead - this is name-field-only so far.

// DONE (2026-07-27): Legacy Tourney Armor data removed from the pipeline (old PHASE 3 step 8) -
//   apply_corrections.py no longer creates itemOption rows binding "Tourney Armor" to anything;
//   the three named-item-only enchantment rows it introduced stay in the master enchantment table
//   (still useful, unrelated to any specific item now) but are currently unreachable in the export
//   until PHASE 3 step 5 addresses that. equipDDO.sqlite and ddocraft.json regenerated through the
//   normal pipeline (build_db.py -> apply_corrections.py -> export_ddocraft_json.py); diffed
//   against the prior ddocraft.json first to confirm the only change was the 59 Tourney Armor rows
//   disappearing (3886 -> 3827), everything else byte-identical.

let dialogPreferences;
let buttonPreferences;
let buttonClosePreferences;
let dialogHelp;
let buttonHelp;
let buttonCloseHelp;
let dialogAbout;
let buttonAbout;
let buttonCloseAbout;

let extraSlotMinLevel = 10;

let charData = {
    // enchantments[enchName] = { enchName, enchEffectType, enchDesc, enchSupercededBy,
    //   enchCannithMinLevel, enchAugmentMinLevel, allEnch, basic, nonscaling, for<Role>... }
    enchantments: {},

    // catalog[category][item][slot][color] = [enchName, ...] in catalog order. color is "" for
    //   non-augment slots (matches the source data's own convention).
    catalog: {},

    // Stable category walk order (first-appearance order in the source data).
    categoryOrder: [],

    // augmentOptionsByColor[color] = [enchName, ...] - every enchantment eligible for that augment
    //   color, independent of any specific item (augment color-eligibility is global in the source
    //   data - every item's same-colored augment slot offers the identical candidate list). Built
    //   once from the same rows as the catalog above. Drives PHASE 3's custom-item augment slots,
    //   which have no backing catalog entry of their own to walk.
    augmentOptionsByColor: {},

    // What's actually been picked - the single source of truth for rendering state. Catalog data
    //   above never mutates once loaded.
    selections: {
        // positional[item][slot] = { enchName, color } - one occupant per item+slot, spanning all
        //   colors of that slot (matches the real-world "one augment per slot" constraint).
        positional: {},
        // inherent[category][item] = Set(enchName) - fixed effects with no slot. Reserved for
        //   PHASE 3 named/custom items; unused and unreachable through the UI until then.
        inherent: {}
    },

    // Three independent collapse levels, each a Set of path keys. A collapsed node's children are
    //   simply never walked, so there's no need to encode a single per-row priority scalar - a
    //   node is exactly as collapsed as whichever of these sets contains its key.
    collapsed: {
        item: new Set(),   // key: category
        slot: new Set(),   // key: item|slot
        color: new Set()   // key: item|slot|color
    },

    enchFilter: {allEnch: true},
    reportOut: "",
    categoryChoice: {},

    // categoryMode[category] = 'cannith' (default, implicit) | 'custom'. When custom, that
    //   category's Cannith rows are hidden and customItems[category] drives rendering instead.
    categoryMode: {},

    // customItems[category] = { name } - only present while categoryMode[category] === 'custom'.
    //   Purely in-memory, user-typed data; the app has no knowledge of any specific named item (see
    //   PIVOT note above) - "Tourney Armor" here would be indistinguishable from "Bob's Vest".
    //   Augment config and inherent-effect selections land here in later PHASE 3 steps.
    customItems: {},

    saveFile: {version: 2.1, dirty: false, charName: "", charLevel: 36, positional: [], inherent: [],
        categoryMode: {}, customItems: {}, collapsed: {item: [], slot: [], color: []}}
};

initialize();

function initialize() {
    loadEnchantmentOptions();
    initCategoryChoice();
    initFilter();
    dialogPreferences      = document.getElementById('preferences');
    buttonPreferences      = document.getElementById("btnPreferences");
    buttonClosePreferences = document.getElementById("btnClosePreferences");
    dialogHelp             = document.getElementById('help');
    buttonHelp             = document.getElementById("btnHelp");
    buttonCloseHelp        = document.getElementById("btnCloseHelp");
    dialogAbout            = document.getElementById('about');
    buttonAbout            = document.getElementById("btnAbout");
    buttonCloseAbout       = document.getElementById("btnCloseAbout");

    renderEnchantmentOptions();
    renderResult();
    handleRename(); // Sets to "Unnamed" if not invalid.
    showPreferences();
}

function loadEnchantmentOptions() {
    // WARNING: Requires JSON file ordered by category then item then slot then color.
    // This is the one function that knows about the flat/duplicated ddocraft.json shape - the
    //   rest of the app only ever sees charData.enchantments / charData.catalog. Swapping this
    //   for a live API later (normalized export or MariaDB-backed) means rewriting this function
    //   only, as long as it still produces the same two structures.
    let itemOptionsRequest                = new XMLHttpRequest();
    itemOptionsRequest.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            buildCatalog(JSON.parse(this.responseText));
        }
    };

    // TO DO: Consider convert to asynchronous? Is there something we can do while it loads?
    itemOptionsRequest.open("GET", "ddocraft.json", false);
    itemOptionsRequest.send();
}

function buildCatalog(flatRows) {
    for (let row of flatRows) {
        if (!(row.enchName in charData.enchantments)) {
            charData.enchantments[row.enchName] = {
                enchName: row.enchName,
                enchEffectType: row.enchEffectType,
                enchDesc: row.enchDesc,
                enchSupercededBy: row.enchSupercededBy,
                enchCannithMinLevel: row.enchCannithMinLevel,
                enchAugmentMinLevel: row.enchAugmentMinLevel,
                allEnch: row.allEnch, basic: row.basic, nonscaling: row.nonscaling,
                forMeleeDmg: row.forMeleeDmg, forRangedDmg: row.forRangedDmg,
                forACDefence: row.forACDefence, forResistDefence: row.forResistDefence,
                forHitPoints: row.forHitPoints, forAlchemist: row.forAlchemist,
                forArtificer: row.forArtificer, forBarbarian: row.forBarbarian,
                forBard: row.forBard, forCleric: row.forCleric, forDruid: row.forDruid,
                forFavoredSoul: row.forFavoredSoul, forFighter: row.forFighter,
                forMonk: row.forMonk, forPaladin: row.forPaladin, forRanger: row.forRanger,
                forRogue: row.forRogue, forSorcerer: row.forSorcerer, forWarlock: row.forWarlock,
                forWizard: row.forWizard
            };
        }

        let category = row.itemOptionCategory, item = row.itemOptionItem,
            slot = row.itemOptionSlot, color = row.augmentColor || "";

        // Some enchantment rows have no itemOption binding at all (the master pool needed for
        //   PHASE 3's inherent-effects picker includes them - see apply_corrections.py) - they're
        //   already in charData.enchantments from above, but there's no slot/color to catalog them
        //   under, so there's nothing further to do here.
        if (!category) { continue; }

        if (!(category in charData.catalog)) {
            charData.catalog[category] = {};
            charData.categoryOrder.push(category);
        }
        if (!(item in charData.catalog[category])) { charData.catalog[category][item] = {}; }
        if (!(slot in charData.catalog[category][item])) { charData.catalog[category][item][slot] = {}; }
        if (!(color in charData.catalog[category][item][slot])) { charData.catalog[category][item][slot][color] = []; }
        charData.catalog[category][item][slot][color].push(row.enchName);

        if (slot.substring(0, 3) === "Aug" && color) {
            if (!(color in charData.augmentOptionsByColor)) { charData.augmentOptionsByColor[color] = []; }
            if (!charData.augmentOptionsByColor[color].includes(row.enchName)) {
                charData.augmentOptionsByColor[color].push(row.enchName);
            }
        }
    }
}

function initCategoryChoice() {
    // Defaults every category to its Cannith-sourced item. Tracked separately from selection
    //   state so PHASE 3 can extend it to a "Named or Custom" toggle without disturbing this.
    for (let category of charData.categoryOrder) {
        for (let item of Object.keys(charData.catalog[category])) {
            if (item.startsWith("Cannith ")) {
                charData.categoryChoice[category] = item;
                break;
            }
        }
    }
}

function handleCategoryChange(selectElement, category) {
    charData.categoryChoice[category] = selectElement.value;
    // Cosmetic only until PHASE 3 step 3 wires this to actually swap rendered rows.
}

function initFilter() {
    charData.saveFile.charLevel             = document.getElementById('characterLevel').value;
    charData.enchFilter['allEnch']          = document.getElementById('allEnch').checked;
    charData.enchFilter['basic']            = document.getElementById('basic').checked;
    charData.enchFilter['nonscaling']       = document.getElementById('nonscaling').checked;
    charData.enchFilter['forMeleeDmg']      = document.getElementById('forMeleeDmg').checked;
    charData.enchFilter['forRangedDmg']     = document.getElementById('forRangedDmg').checked;
    charData.enchFilter['forACDefence']     = document.getElementById('forACDefence').checked;
    charData.enchFilter['forResistDefence'] = document.getElementById('forResistDefence').checked;
    charData.enchFilter['forHitPoints']     = document.getElementById('forHitPoints').checked;
    charData.enchFilter['forBarbarian']     = document.getElementById('forBarbarian').checked;
    charData.enchFilter['forFighter']       = document.getElementById('forFighter').checked;
    charData.enchFilter['forPaladin']       = document.getElementById('forPaladin').checked;
    charData.enchFilter['forRanger']        = document.getElementById('forRanger').checked;
    charData.enchFilter['forAlchemist']     = document.getElementById('forAlchemist').checked;
    charData.enchFilter['forArtificer']     = document.getElementById('forArtificer').checked;
    charData.enchFilter['forBard']          = document.getElementById('forBard').checked;
    charData.enchFilter['forRogue']         = document.getElementById('forRogue').checked;
    charData.enchFilter['forMonk']          = document.getElementById('forMonk').checked;
    charData.enchFilter['forCleric']        = document.getElementById('forCleric').checked;
    charData.enchFilter['forDruid']         = document.getElementById('forDruid').checked;
    charData.enchFilter['forFavoredSoul']   = document.getElementById('forFavoredSoul').checked;
    charData.enchFilter['forSorcerer']      = document.getElementById('forSorcerer').checked;
    charData.enchFilter['forWarlock']       = document.getElementById('forWarlock').checked;
    charData.enchFilter['forWizard']        = document.getElementById('forWizard').checked;
}

// ---- Selections store accessors ----

function getOccupant(item, slot) {
    return (charData.selections.positional[item] || {})[slot];
}

function setOccupant(item, slot, enchName, color) {
    if (!(item in charData.selections.positional)) { charData.selections.positional[item] = {}; }
    charData.selections.positional[item][slot] = {enchName: enchName, color: color};
}

function clearOccupant(item, slot) {
    if (charData.selections.positional[item]) { delete charData.selections.positional[item][slot]; }
}

function categoryOfCustomItemKey(item) {
    // Returns the owning category if `item` is a custom pseudo-item key, else null. Lets
    //   computeSelectionIndex() tell "a real Cannith item's selection" apart from "a custom item's
    //   selection that's currently hidden because its category is toggled back to Cannith mode."
    return item.indexOf("custom:") === 0 ? item.slice(7) : null;
}

// One pass over current selections, computing everything getButton() needs to decide every
//   candidate's appearance without re-scanning the selections store per-button.
function computeSelectionIndex() {
    let effectTypeCounts   = {};   // enchEffectType -> how many selections share it
    let selectedNamesByItem = {};  // item -> Set(enchName) - for enchSupercededBy wildcard matches

    function account(item, enchName) {
        let ench = charData.enchantments[enchName];
        if (!ench) { return; }
        effectTypeCounts[ench.enchEffectType] = (effectTypeCounts[ench.enchEffectType] || 0) + 1;
        if (!(item in selectedNamesByItem)) { selectedNamesByItem[item] = new Set(); }
        selectedNamesByItem[item].add(enchName);
    }

    for (let item of Object.keys(charData.selections.positional)) {
        // A custom item's selections are preserved when its category is switched back to Cannith
        //   mode (nothing is ever deleted just for being hidden - see handleCategoryModeToggle),
        //   but they must not count here while hidden, or a duplicate warning could persist on a
        //   Cannith pick even though the thing it was supposedly duplicating isn't visible anywhere.
        let owningCategory = categoryOfCustomItemKey(item);
        if (owningCategory && (charData.categoryMode[owningCategory] || "cannith") !== "custom") { continue; }

        for (let slot of Object.keys(charData.selections.positional[item])) {
            account(item, charData.selections.positional[item][slot].enchName);
        }
    }
    for (let category of Object.keys(charData.selections.inherent)) {
        if ((charData.categoryMode[category] || "cannith") !== "custom") { continue; }
        for (let item of Object.keys(charData.selections.inherent[category])) {
            for (let enchName of charData.selections.inherent[category][item]) {
                account(item, enchName);
            }
        }
    }

    return {effectTypeCounts: effectTypeCounts, selectedNamesByItem: selectedNamesByItem};
}

function renderEnchantmentOptions() {
    let idx  = computeSelectionIndex();
    let html = "";

    for (let category of charData.categoryOrder) {
        let mode = charData.categoryMode[category] || "cannith";

        if (charData.collapsed.item.has(category)) {
            html += "<table><caption class='itemheader collapsed' onclick=\"toggleCollapsed('item','" +
                escJs(category) + "')\">&#9655; " + escHtml(category) + "</caption></table>";
            continue;
        }

        html += "<table><caption class='itemheader' onclick=\"toggleCollapsed('item','" + escJs(category) +
            "')\">&#9661; " + escHtml(category) + " " + getCategoryModeToggleHtml(category);

        if (mode === "custom") {
            html += "</caption>" + renderCustomItemBody(category, idx) + "</table>";
            continue;
        }

        let item = charData.categoryChoice[category];
        if (!item) { html += "</caption></table>"; continue; }
        let itemNode = charData.catalog[category][item];

        html += " " + getCategoryDropdownHtml(category) + "</caption>";

        for (let slot of Object.keys(itemNode)) {
            if (slot === "Extra" && charData.saveFile.charLevel < extraSlotMinLevel) { continue; }

            let slotKey = item + "|" + slot;
            if (charData.collapsed.slot.has(slotKey)) {
                html += "<tr class='collapsed'><td class='slot' onclick=\"toggleCollapsed('slot','" +
                    escJs(slotKey) + "')\">" + escHtml(slot) + "<td>&nbsp;</td></tr>";
                continue;
            }

            html += "<tr><td class='slot' onclick=\"toggleCollapsed('slot','" + escJs(slotKey) +
                "')\">" + escHtml(slot) + "</td><td class='options'>";

            let isAugment = slot.substring(0, 3) === "Aug";
            let colors    = Object.keys(itemNode[slot]);
            for (let c = 0; c < colors.length; c++) {
                let color    = colors[c];
                let colorKey = slotKey + "|" + color;

                if (isAugment) {
                    if (c > 0) { html += "<br />"; }
                    if (charData.collapsed.color.has(colorKey)) {
                        html += "<div class='color collapsed' onclick=\"toggleCollapsed('color','" +
                            escJs(colorKey) + "')\">&nbsp;" + escHtml(color) + "&nbsp;</div>&nbsp;";
                        continue;
                    }
                    html += "<div class='color' onclick=\"toggleCollapsed('color','" + escJs(colorKey) +
                        "')\">&nbsp;" + escHtml(color) + ":</div>&nbsp;";
                }

                html += "<div class='ench'> ";
                for (let enchName of itemNode[slot][color]) {
                    html += getButton(item, slot, color, enchName, idx);
                }
                html += "</div>";
            }

            html += "</td></tr>";
        }

        html += "</table>";
    }

    document.getElementById("enchantmentOptions").innerHTML = html;
}

function getCategoryModeToggleHtml(category) {
    let checked = charData.categoryMode[category] === "custom" ? " checked" : "";
    return "<label class='customToggle' onclick='event.stopPropagation()'>" +
        "<input type='checkbox' onclick='event.stopPropagation()' onchange=\"handleCategoryModeToggle(this,'" +
        escJs(category) + "')\"" + checked + " /> Named or Custom Item</label>";
}

function customItemKey(category) {
    // Stable pseudo-item name for the selections store - opaque to enchClick/getButton, which
    //   never distinguish a real catalog item from a custom one. Category alone is a sufficient
    //   key since only one custom item can be active per category at a time.
    return "custom:" + category;
}

let AUGMENT_SLOT_CAP = 7;

function renderCustomItemBody(category, idx) {
    let custom = charData.customItems[category] || {name: "", augments: [], nextAugmentId: 1};
    let item   = customItemKey(category);
    let html   = "<tr><td class='slot'>Name</td><td class='options'>" +
        "<input type='text' class='customItemName' value=\"" + escHtml(custom.name) +
        "\" placeholder='e.g. Tourney Armor' onchange=\"handleCustomItemName(this,'" + escJs(category) + "')\" />" +
        "</td></tr>";

    custom.augments.forEach(function (aug, position) {
        let slot         = "Augment#" + aug.id;  // stable key - "Aug" prefix reuses getButton's
                                                  //   existing augment-vs-cannith min-level check.
        let displayLabel = "Augment " + (position + 1) + " (" + aug.color + ")";
        let slotKey      = item + "|" + slot;

        html += "<tr><td class='slot'>" +
            "<span onclick=\"toggleCollapsed('slot','" + escJs(slotKey) + "')\">" + escHtml(displayLabel) + "</span> " +
            "<span class='removeAugment' title='Remove this augment slot' onclick=\"handleRemoveCustomAugment('" +
            escJs(category) + "'," + aug.id + ")\">&#10005;</span></td><td class='options'>";

        if (charData.collapsed.slot.has(slotKey)) {
            html += "&nbsp;";
        } else {
            html += "<div class='ench'> ";
            for (let enchName of (charData.augmentOptionsByColor[aug.color] || [])) {
                html += getButton(item, slot, aug.color, enchName, idx);
            }
            html += "</div>";
        }

        html += "</td></tr>";
    });

    html += "<tr><td class='slot'></td><td class='options'>";
    if (custom.augments.length < AUGMENT_SLOT_CAP) {
        let colorOptions = Object.keys(charData.augmentOptionsByColor).map(function (c) {
            return "<option value=\"" + escHtml(c) + "\">" + escHtml(c) + "</option>";
        }).join("");
        html += "<select class='addAugmentSelect' onchange=\"handleAddAugmentSelect(this,'" + escJs(category) + "')\">" +
            "<option value=''>+ Add Augment...</option>" + colorOptions + "</select>";
    } else {
        html += "<em>Maximum " + AUGMENT_SLOT_CAP + " augment slots</em>";
    }
    html += "</td></tr>";

    html += renderInherentPicker(category, idx);

    return html;
}

function renderInherentPicker(category, idx) {
    // Deliberately unscoped by category (see PIVOT note) - a named item's whole appeal can be an
    //   effect normal Cannith crafting could never produce for that category. Deliberately flat and
    //   alphabetical rather than grouped/filtered - relies on the browser's own search, same as the
    //   existing ~1500-row Cannith lists already do.
    let item    = customItemKey(category);
    let slotKey = item + "|InherentEffects";

    if (charData.collapsed.slot.has(slotKey)) {
        return "<tr class='collapsed'><td class='slot' onclick=\"toggleCollapsed('slot','" +
            escJs(slotKey) + "')\">Inherent Effects<td>&nbsp;</td></tr>";
    }

    let html = "<tr><td class='slot' onclick=\"toggleCollapsed('slot','" + escJs(slotKey) +
        "')\">Inherent Effects</td><td class='options'><div class='ench'> ";
    for (let enchName of Object.keys(charData.enchantments).sort()) {
        html += getInherentButton(category, item, enchName, idx);
    }
    html += "</div></td></tr>";

    return html;
}

function getInherentButton(category, item, enchName, idx) {
    // No level gating (an item's inherent effect isn't being crafted at a level threshold - it's
    //   just a property the item already has) and no "blocked" state (no slot to occupy).
    let ench = charData.enchantments[enchName];

    let selectedSet = (charData.selections.inherent[category] || {})[item];
    let isSelected  = !!selectedSet && selectedSet.has(enchName);
    let effectCount = idx.effectTypeCounts[ench.enchEffectType] || 0;
    let isDuplicate = isSelected && effectCount > 1;
    let isHandled   = !isSelected && (
        effectCount > 0 ||
        (idx.selectedNamesByItem[item] && idx.selectedNamesByItem[item].has(ench.enchSupercededBy))
    );

    let enchValue = getEnchFilterValue(enchName);
    let onclick   = "enchClickInherent('" + escJs(category) + "','" + escJs(item) + "','" + escJs(enchName) + "')";
    let title     = escHtml(ench.enchDesc);
    let btn;

    if (isSelected) {
        btn = "<button class='" + (isDuplicate ? "duplicate" : "selected") + "' title=\"" + title + "\" ";
        enchValue = 1;
    } else if (isHandled) {
        btn = "<button class='handled' title=\"" + title + "\" ";
    } else if (enchValue > 1) {
        btn = "<button style='background-color: " + getHighlight(enchValue) + "; color: black;' title=\"" + title + "\" ";
    } else {
        btn = "<button title=\"" + title + "\" ";
    }

    btn += "onclick=\"" + onclick + "\">" + escHtml(enchName) + "</button> ";

    return enchValue < 1 ? "" : btn;
}

function enchClickInherent(category, item, enchName, render = true) {
    if (!(category in charData.selections.inherent)) { charData.selections.inherent[category] = {}; }
    if (!(item in charData.selections.inherent[category])) { charData.selections.inherent[category][item] = new Set(); }

    let set = charData.selections.inherent[category][item];
    if (set.has(enchName)) { set.delete(enchName); } else { set.add(enchName); }

    if (render) {
        renderEnchantmentOptions();
        renderResult();
    }
}

function handleCategoryModeToggle(checkbox, category) {
    // Non-destructive both ways: the custom item's name/augments/selections are never deleted just
    //   for being switched away from - they're preserved exactly as left, and excluded from
    //   duplicate-warning accounting while hidden (see computeSelectionIndex()). Switching back to
    //   custom mode picks up right where it was. No confirm needed here, because nothing is lost.
    charData.categoryMode[category] = checkbox.checked ? "custom" : "cannith";
    if (checkbox.checked && !charData.customItems[category]) {
        charData.customItems[category] = {name: "", augments: [], nextAugmentId: 1};
    }

    renderEnchantmentOptions();
    renderResult();
}

function handleCustomItemName(input, category) {
    charData.customItems[category].name = input.value;
}

function handleAddAugmentSelect(select, category) {
    let color = select.value;
    select.value = "";
    if (!color) { return; }

    let custom = charData.customItems[category];
    if (custom.augments.length >= AUGMENT_SLOT_CAP) { return; }
    custom.augments.push({id: custom.nextAugmentId++, color: color});

    renderEnchantmentOptions();
    renderResult();
}

function handleRemoveCustomAugment(category, augId) {
    // Always deletes immediately, no confirm - matches an ordinary augment reselect elsewhere in
    //   the app, which also never confirms. Filters by stable id, not array position, so removing
    //   a slot out of the middle of the list can't misattribute or orphan the ones on either side.
    let custom = charData.customItems[category];
    let slot   = "Augment#" + augId;
    let item   = customItemKey(category);

    clearOccupant(item, slot);
    custom.augments = custom.augments.filter(function (a) { return a.id !== augId; });

    renderEnchantmentOptions();
    renderResult();
}

function getCategoryDropdownHtml(category) {
    // Selection is tracked in charData.categoryChoice, but doesn't yet affect rendering beyond
    //   which item's rows are walked above - see PHASE 3 step 3.
    let items = Object.keys(charData.catalog[category]);

    let html = "<select class='categorySelect' onclick='event.stopPropagation()' onchange=\"handleCategoryChange(this, '" +
        escJs(category) + "')\">";
    for (let item of items) {
        let selected = item === charData.categoryChoice[category] ? " selected" : "";
        html += "<option value=\"" + escHtml(item) + "\"" + selected + ">" + escHtml(item) + "</option>";
    }
    html += "</select>";
    return html;
}

function getButton(item, slot, color, enchName, idx) {
    let ench = charData.enchantments[enchName];
    let isAugment = slot.substring(0, 3) === "Aug";
    let minLevel  = isAugment ? ench.enchAugmentMinLevel : ench.enchCannithMinLevel;
    if (charData.saveFile.charLevel < minLevel) { return ""; }

    let enchValue = getEnchFilterValue(enchName);

    let occupant      = getOccupant(item, slot);
    let isSelectedHere = !!occupant && occupant.enchName === enchName && occupant.color === color;
    let isBlocked      = !!occupant && !isSelectedHere;
    let effectCount    = idx.effectTypeCounts[ench.enchEffectType] || 0;
    let isDuplicate    = isSelectedHere && effectCount > 1;
    let isHandled      = !isSelectedHere && !isBlocked && (
        effectCount > 0 ||
        (idx.selectedNamesByItem[item] && idx.selectedNamesByItem[item].has(ench.enchSupercededBy))
    );

    let onclick = "enchClick('" + escJs(item) + "','" + escJs(slot) + "','" + escJs(color) + "','" + escJs(enchName) + "')";
    let title   = escHtml(ench.enchDesc);
    let btn;

    if (isSelectedHere) {
        btn = "<button class='" + (isDuplicate ? "duplicate" : "selected") + "' title=\"" + title + "\" ";
        enchValue = 1;  // Display all selected enchantments regardless of filter.
    } else if (isHandled) {
        // Discouraged, not disabled: the same effect is already selected elsewhere, but taking
        //   it here too is allowed (see computeSelectionIndex()).
        btn = "<button class='handled' title=\"" + title + "\" ";
    } else if (isBlocked) {
        // Discouraged, not disabled: only one effect may occupy this item+slot at a time, but
        //   clicking a different one here swaps it in rather than being blocked (see enchClick()).
        btn = "<button class='blocked' title=\"" + title + "\" ";
    } else if (enchValue > 1) {
        btn = "<button style='background-color: " + getHighlight(enchValue) + "; color: black;' title=\"" + title + "\" ";
    } else {
        btn = "<button title=\"" + title + "\" ";
    }

    btn += "onclick=\"" + onclick + "\">" + escHtml(enchName) + "</button> ";

    return enchValue < 1 ? "" : btn;
}

function escHtml(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escJs(s) {
    // Safe to interpolate into a JS single-quoted string literal that itself sits inside an
    //   HTML double-quoted attribute - escapes for both layers, in order. Needed because catalog
    //   text (item/slot/color/enchantment names) can contain apostrophes (e.g. "Master's Gift").
    return String(s == null ? "" : s)
        .replace(/\\/g, "\\\\").replace(/'/g, "\\'")
        .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getHighlight(num) {
    // Recommendation-strength tint: interpolates from a muted blue (#3987e5) to a
    // bright blue (#cde2fb) as more active filters match this effect, relative to
    // max range of 32. Black text (set by the caller) stays legible across the
    // whole span - both endpoints clear 4.5:1.
    let maxVal = 32;
    let base   = [57, 135, 229];
    let peak   = [205, 226, 251];

    let t = Math.min(num / maxVal, 1);
    let r = Math.round(base[0] + (peak[0] - base[0]) * t);
    let g = Math.round(base[1] + (peak[1] - base[1]) * t);
    let b = Math.round(base[2] + (peak[2] - base[2]) * t);
    return rgb(r, g, b);
}


function rgb(r, g, b) {
    return "rgb(" + r + "," + g + "," + b + ")";
}


function getEnchFilterValue(enchName) {
    let ench      = charData.enchantments[enchName];
    let enchValue = 0;
    if (charData.enchFilter.allEnch) { enchValue += 1; }
    if (charData.enchFilter.basic) { enchValue += ench.basic; }
    if (charData.enchFilter.nonscaling) { enchValue += ench.nonscaling; }
    if (charData.enchFilter.forMeleeDmg) { enchValue += ench.forMeleeDmg; }
    if (charData.enchFilter.forRangedDmg) { enchValue += ench.forRangedDmg; }
    if (charData.enchFilter.forACDefence) { enchValue += ench.forACDefence; }
    if (charData.enchFilter.forResistDefence) { enchValue += ench.forResistDefence; }
    if (charData.enchFilter.forHitPoints) { enchValue += ench.forHitPoints; }
    if (charData.enchFilter.forAlchemist) { enchValue += ench.forAlchemist; }
    if (charData.enchFilter.forArtificer) { enchValue += ench.forArtificer; }
    if (charData.enchFilter.forBarbarian) { enchValue += ench.forBarbarian; }
    if (charData.enchFilter.forBard) { enchValue += ench.forBard; }
    if (charData.enchFilter.forCleric) { enchValue += ench.forCleric; }
    if (charData.enchFilter.forDruid) { enchValue += ench.forDruid; }
    if (charData.enchFilter.forFavoredSoul) { enchValue += ench.forFavoredSoul; }
    if (charData.enchFilter.forFighter) { enchValue += ench.forFighter; }
    if (charData.enchFilter.forMonk) { enchValue += ench.forMonk; }
    if (charData.enchFilter.forPaladin) { enchValue += ench.forPaladin; }
    if (charData.enchFilter.forRanger) { enchValue += ench.forRanger; }
    if (charData.enchFilter.forRogue) { enchValue += ench.forRogue; }
    if (charData.enchFilter.forSorcerer) { enchValue += ench.forSorcerer; }
    if (charData.enchFilter.forWarlock) { enchValue += ench.forWarlock; }
    if (charData.enchFilter.forWizard) { enchValue += ench.forWizard; }

    return enchValue;
}


function enchClick(item, slot, color, enchName, render = true) {
    let occupant = getOccupant(item, slot);

    if (occupant && occupant.enchName === enchName && occupant.color === color) {
        clearOccupant(item, slot);
    } else {
        // Whether the slot was empty or held something else, this just replaces it - "swap" is
        //   free because a slot's occupant is a single dict entry, not a set of toggled flags.
        setOccupant(item, slot, enchName, color);
    }

    if (render) {
        renderEnchantmentOptions();
        renderResult();
    }
}

function renderResult() {
    // Set background of rows to alternate at item level, not row level
    //  (group item enchants together).
    charData.reportOut = "<h3>Result</h3><table>";
    charData.reportOut += "<table><tr><th>Item</th><th>Slot</th><th>Enchantment</th></tr>";

    for (let item of Object.keys(charData.selections.positional)) {
        for (let slot of Object.keys(charData.selections.positional[item])) {
            let occupant = charData.selections.positional[item][slot];
            let isAugment = slot.substring(0, 3) === "Aug";
            let augColor = isAugment && occupant.color ? occupant.color.substring(0, 1) + "-" : "";

            charData.reportOut += "<tr><td>" + escHtml(item) + "</td><td>";
            charData.reportOut += escHtml(slot) + "</td><td>";
            charData.reportOut += escHtml(augColor + occupant.enchName) + "</td></tr>";
        }
    }

    for (let category of Object.keys(charData.selections.inherent)) {
        for (let item of Object.keys(charData.selections.inherent[category])) {
            for (let enchName of charData.selections.inherent[category][item]) {
                charData.reportOut += "<tr><td>" + escHtml(item) + "</td><td>";
                charData.reportOut += "Inherent</td><td>";
                charData.reportOut += escHtml(enchName) + "</td></tr>";
            }
        }
    }

    charData.reportOut += "</table>";
    document.getElementById("result").innerHTML = charData.reportOut;
}

function minLevelAllowed(item, slot, enchName) {
    let ench      = charData.enchantments[enchName];
    let isAugment = slot.substring(0, 3) === "Aug";
    let isExtra   = slot.substring(0, 3) === "Ext";

    if (isExtra) { return charData.saveFile.charLevel >= extraSlotMinLevel; }
    if (isAugment) { return charData.saveFile.charLevel >= ench.enchAugmentMinLevel; }
    return charData.saveFile.charLevel >= ench.enchCannithMinLevel;
}


function toggleCollapsed(level, key) {
    let set = charData.collapsed[level];
    if (set.has(key)) { set.delete(key); } else { set.add(key); }
    renderEnchantmentOptions();
}


function handleRename(fixBoth = false) {
    charData.saveFile.charName = document.getElementById("characterName").value;
    if(!charData.saveFile.charName) {
        charData.saveFile.charName = "Unnamed";
        if(fixBoth){
            document.getElementById("characterName").value = charData.saveFile.charName;
        }

    }
}

function handleSave() {
    handleRename(true);
    updateSave();

    let fileName = charData.saveFile.charName;
    fileName += "_L" + zeroPad(charData.saveFile.charLevel, 2);
    fileName += "_" + getTimestamp();
    downloadJSON(JSON.stringify(charData.saveFile), fileName + ".json", 'text/plain')
}

function zeroPad(num, digits) {
    return String(num).padStart(digits, '0');
}

function updateSave() {
    let positional = [];
    for (let item of Object.keys(charData.selections.positional)) {
        for (let slot of Object.keys(charData.selections.positional[item])) {
            let occupant = charData.selections.positional[item][slot];
            positional.push({item: item, slot: slot, color: occupant.color, enchName: occupant.enchName});
        }
    }

    let inherent = [];
    for (let category of Object.keys(charData.selections.inherent)) {
        for (let item of Object.keys(charData.selections.inherent[category])) {
            for (let enchName of charData.selections.inherent[category][item]) {
                inherent.push({category: category, item: item, enchName: enchName});
            }
        }
    }

    charData.saveFile.positional   = positional;
    charData.saveFile.inherent     = inherent;
    // Custom item config has to be saved alongside its selections, not just the selections alone -
    //   a "custom:Category" positional/inherent entry is meaningless without categoryMode/
    //   customItems to make that category render in custom mode with the matching augment slots.
    charData.saveFile.categoryMode = Object.assign({}, charData.categoryMode);
    charData.saveFile.customItems  = JSON.parse(JSON.stringify(charData.customItems));
    charData.saveFile.collapsed    = {
        item: Array.from(charData.collapsed.item),
        slot: Array.from(charData.collapsed.slot),
        color: Array.from(charData.collapsed.color)
    };
}

function getTimestamp() {
    let time = new Date();
    let timestamp = "" + time.getFullYear() + zeroPad(time.getMonth()+1,2) + zeroPad(time.getDate(),2);
    let hour = time.getHours();
    let AMPM = "AM";
    if(hour > 12) {
        AMPM = "PM";
        hour -= 12;
        if(hour === 0) {
            hour = 12;
        }
    }
    timestamp = timestamp + AMPM + zeroPad(hour, 2) + zeroPad(time.getMinutes(),2)
        + zeroPad(time.getSeconds(),2);
    return timestamp;
}

function downloadJSON(content, fileName, contentType) {
    let a      = document.createElement("a");
    let file   = new Blob([content], {type: contentType});
    a.href     = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

// File Loading
document.getElementById('loadFile').onchange = function () {
    let files = document.getElementById('loadFile').files;
    if (files.length <= 0) { return false; }

    let fr    = new FileReader();
    fr.onload = function (e) {
        let incomingFile = JSON.parse(e.target.result);

        let fileName = String(files[0].name);
        if (!incomingFile.charName) {
            incomingFile.charName = getNameFromOldFilename(fileName);
        }

        if (!incomingFile.charLevel) {
            incomingFile.charLevel = getLevelFromOldFilename(fileName);
        }

        handleLoad(incomingFile);
        renderEnchantmentOptions();
        renderResult();
    }
    fr.readAsText(files.item(0));
}

function getNameFromOldFilename(fileName){
    let likelyName = fileName.slice(0,fileName.indexOf("_L"));
    if(!likelyName) { likelyName = "Unknown"; }
    return likelyName;
}

function getLevelFromOldFilename(fileName){
    let levelStart = fileName.indexOf("_L") + 2;
    let likelyLevel = fileName.substring(levelStart, levelStart+2);
    if(!likelyLevel || likelyLevel < 1 || likelyLevel > 32) { likelyLevel = 32; }
    return likelyLevel;
}


function handleLoad(incomingFile) {
    // Need to start with a clean slate to avoid merging loaded data with whatever is on screen.
    charData.selections.positional = {};
    charData.selections.inherent   = {};
    charData.categoryMode          = {};
    charData.customItems           = {};
    charData.collapsed.item.clear();
    charData.collapsed.slot.clear();
    charData.collapsed.color.clear();

    document.getElementById('characterName').value = incomingFile.charName;
    handleRename(true);
    document.getElementById("characterLevel").value = incomingFile.charLevel;
    charData.saveFile.charLevel                     = incomingFile.charLevel;

    // Custom item config restored BEFORE its selections below - a "custom:Category" positional/
    //   inherent entry only renders anywhere if categoryMode/customItems already put that category
    //   in custom mode with the matching augment slots; restoring selections first would leave them
    //   orphaned in the store, invisible but still counted by computeSelectionIndex().
    for (let category of Object.keys(incomingFile.categoryMode || {})) {
        charData.categoryMode[category] = incomingFile.categoryMode[category];
    }
    for (let category of Object.keys(incomingFile.customItems || {})) {
        let saved = incomingFile.customItems[category];
        charData.customItems[category] = {
            name: saved.name || "",
            augments: (saved.augments || []).map(function (a) { return {id: a.id, color: a.color}; }),
            nextAugmentId: saved.nextAugmentId || 1
        };
    }

    // Save format is not backward compatible with pre-rewrite files (version < 2.0) - the old
    //   format has no equivalent of a flat "enchantments" array to translate from; a save made
    //   before this rewrite will silently load as an empty build rather than erroring.
    for (let entry of (incomingFile.positional || [])) {
        if (entry.enchName in charData.enchantments) {
            setOccupant(entry.item, entry.slot, entry.enchName, entry.color);
        }
    }
    for (let entry of (incomingFile.inherent || [])) {
        if (entry.enchName in charData.enchantments) {
            if (!(entry.category in charData.selections.inherent)) { charData.selections.inherent[entry.category] = {}; }
            if (!(entry.item in charData.selections.inherent[entry.category])) { charData.selections.inherent[entry.category][entry.item] = new Set(); }
            charData.selections.inherent[entry.category][entry.item].add(entry.enchName);
        }
    }

    let incomingCollapsed = incomingFile.collapsed || {item: [], slot: [], color: []};
    charData.collapsed.item  = new Set(incomingCollapsed.item || []);
    charData.collapsed.slot  = new Set(incomingCollapsed.slot || []);
    charData.collapsed.color = new Set(incomingCollapsed.color || []);
}


function showPreferences() {
    dialogPreferences.style.display = 'block';
}

function showHelp() {
    dialogHelp.style.display = 'block';
}

function showAbout() {
    dialogAbout.style.display = 'block';
}

function handleFilterCheckbox(checkbox) {
    charData.enchFilter[checkbox.name] = checkbox.checked;
    renderEnchantmentOptions();
}

function handleFilterLevel() {
    let previousLevel           = charData.saveFile.charLevel;
    charData.saveFile.charLevel = document.getElementById("characterLevel").value;

    let toDeselect = [];
    for (let item of Object.keys(charData.selections.positional)) {
        for (let slot of Object.keys(charData.selections.positional[item])) {
            let enchName = charData.selections.positional[item][slot].enchName;
            if (!minLevelAllowed(item, slot, enchName)) {
                toDeselect.push({item: item, slot: slot, enchName: enchName});
            }
        }
    }

    if (toDeselect.length > 0) {
        let lostEnchantments = toDeselect.map(e => e.enchName).join(", ");
        if (confirm("This will deselect the following enchantments. Click OK to proceed.\n\n" + lostEnchantments)) {
            for (let e of toDeselect) { clearOccupant(e.item, e.slot); }
            renderEnchantmentOptions();
            renderResult();
        } else {
            document.getElementById("characterLevel").value = previousLevel;
            charData.saveFile.charLevel = previousLevel;
        }
    } else {
        renderEnchantmentOptions(); // Going up in level, so show new enhancement options
    }
}

window.onclick = function (event) {
    // When the user clicks anywhere outside of the dialogPreferences, close it
    if (event.target === dialogPreferences) {
        dialogPreferences.style.display = "none";
    }
    // Or help window
    if (event.target === dialogHelp) {
        dialogHelp.style.display = "none";
    }
    // Or about window
    if (event.target === dialogAbout) {
        dialogAbout.style.display = "none";
    }
};
