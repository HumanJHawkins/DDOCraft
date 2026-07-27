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

// FUTURE (2026-07-27): Longer-term direction is a real backend - Postgres + Node.js, likely on
//   the same infrastructure being consolidated for GateIron. Motivation beyond "it's a better
//   architecture": crowd-sourced named-item data-mining (if several unrelated users independently
//   enter the same effect set for a named item, that agreement is itself evidence, and can seed a
//   prepopulated dropdown without hand-curation) and real user accounts/saved characters/builds -
//   none of which are possible with a static-file client. Not started; schema will be designed
//   directly in Postgres when that begins, rather than continuing to normalize equipDDO.sqlite
//   further (PHASE 2 steps 1-2 below are effectively superseded by this, not abandoned - the
//   relational design work still needs doing, just against Postgres instead of SQLite). The
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
// 2. Export normalized JSON (or a live API, if the Postgres backend is underway by then) instead
//    of one flattened file - charData.enchantments/charData.catalog's *shape* doesn't change,
//    only loadEnchantmentOptions()'s fetch mechanism does.

// PHASE 3: Named/Custom item feature, built on the new architecture (see PIVOT note above).
//
// 3. Replace the Cannith-vs-named-item dropdown with a "Named or Custom Item" toggle per
//    category. Off = existing Cannith rendering, unchanged. On = name field + inline augment
//    editor.
// 4. Inline augment editor: a "+ Add Augment" control (color picker) in the category header bar;
//    each added slot gets a "-" remove control in its own slot-name cell; each slot renders the
//    full color-eligible option grid exactly like a normal augment slot (no new rendering logic
//    - same machinery as Cannith augments). Cap at 7 slots. Each slot needs a stable ID, not a
//    positional index, so removing one doesn't renumber/orphan the others.
// 5. Universal inherent-effects picker: one unscoped multiselect over every enchantment in the
//    master table (not filtered by category - see PIVOT note). No slot, no mutual exclusivity
//    between choices; relies on browser search for usability at scale, same as today's ~1500-row
//    lists. Feeds charData.selections.inherent - ordinary selected/duplicate rules apply via the
//    same computeSelectionIndex() pass, nothing locked or non-removable.
// 6. Open question to resolve before/during step 5: does the current enchantment schema
//    accommodate intrinsic body-type properties (e.g. Mithril, Superior Nimbleness)? Already
//    answered for the general case - the legacy Tourney Armor data (enchGroup='Named Item')
//    proves the pattern works - but re-check once that legacy data is removed (see step 8).
// 7. Toggling Named/Custom on for a category fully replaces that category's Cannith rows while
//    active (hidden, not blacked out).
// 8. Remove the legacy Tourney Armor / "Named Item Effects" rows from the dataset - under the new
//    plan the app has no knowledge of any specific named item, so this per-item curated data is
//    pure dead weight, not a reference worth keeping.
// 9. Confirm-before-clearing when turning Named/Custom off, or when changing the name/augment
//    config, since either would discard configured slots and inherent-effect selections.
// 10. Magnitude/description lookup table, keyed by Character Level and itemOptionItem; migrate
//     description display to pull from it instead of a static enchDesc.
// 11. Persist the custom item definition (name, augment config, chosen inherent effects) and
//     per-category toggle state in the save file.
// 12. (Future, explicitly out of scope for this phase) Optional prepopulated dropdown of popular
//     named items layered on top of the custom-item mechanism, for convenience - full manual
//     entry is the complete solution for now.

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
    saveFile: {version: 2.0, dirty: false, charName: "", charLevel: 36, positional: [], inherent: [], collapsed: {item: [], slot: [], color: []}}
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
    //   for a live API later (normalized export or Postgres-backed) means rewriting this function
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

        if (!(category in charData.catalog)) {
            charData.catalog[category] = {};
            charData.categoryOrder.push(category);
        }
        if (!(item in charData.catalog[category])) { charData.catalog[category][item] = {}; }
        if (!(slot in charData.catalog[category][item])) { charData.catalog[category][item][slot] = {}; }
        if (!(color in charData.catalog[category][item][slot])) { charData.catalog[category][item][slot][color] = []; }
        charData.catalog[category][item][slot][color].push(row.enchName);
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
        for (let slot of Object.keys(charData.selections.positional[item])) {
            account(item, charData.selections.positional[item][slot].enchName);
        }
    }
    for (let category of Object.keys(charData.selections.inherent)) {
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
        let item = charData.categoryChoice[category];
        if (!item) { continue; }
        let itemNode = charData.catalog[category][item];

        if (charData.collapsed.item.has(category)) {
            html += "<table><caption class='itemheader collapsed' onclick=\"toggleCollapsed('item','" +
                escJs(category) + "')\">&#9655; " + escHtml(category) + "</caption></table>";
            continue;
        }

        html += "<table><caption class='itemheader' onclick=\"toggleCollapsed('item','" + escJs(category) +
            "')\">&#9661; " + escHtml(category) + " " + getCategoryDropdownHtml(category) + "</caption>";

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

    charData.saveFile.positional = positional;
    charData.saveFile.inherent   = inherent;
    charData.saveFile.collapsed  = {
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
    charData.collapsed.item.clear();
    charData.collapsed.slot.clear();
    charData.collapsed.color.clear();

    document.getElementById('characterName').value = incomingFile.charName;
    handleRename(true);
    document.getElementById("characterLevel").value = incomingFile.charLevel;
    charData.saveFile.charLevel                     = incomingFile.charLevel;

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
