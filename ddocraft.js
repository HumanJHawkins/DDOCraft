// Planned work, known issues, and change history now live in TO DO.md and Done.md.

let dialogHelp;
let buttonHelp;
let buttonCloseHelp;
let dialogAbout;
let buttonAbout;
let buttonCloseAbout;
let dialogOpenBuild;
let dialogBuildHistory;

// Manual preference for the Character Info section - forced to false (edit mode) regardless
//   whenever there's no valid level yet, since there's nothing worth presenting (see
//   updateCharacterInfoDisplay()). Defaults to false so entering a valid level doesn't
//   immediately snap the form shut mid-edit - collapsing to the presentation title is an
//   explicit click.
let characterInfoCollapsed = false;

let extraSlotMinLevel = 10;

// Unsaved-changes baseline (see isDirty()/markSaved() below) - declared up here, not next to
//   those functions, because initialize() sets a baseline via markSaved() as part of its own
//   synchronous run. A `let` declared further down wouldn't be initialized yet at that point (still
//   in its temporal dead zone) and would throw - which would also abort the rest of the script's
//   top-level execution, permanently breaking every `let` declared after it in the file.
let lastSavedSnapshot = null;

// The server characterBuildId of whatever's currently loaded in the editor, or null if it's never
//   been saved/loaded from the server this session (a brand-new build, or one loaded from a local
//   file). Lets the Open/History dialogs recognize "this row is what you already have open" and
//   adjust their Open link instead of offering a redundant/confusing plain re-open.
let currentServerBuildId = null;

// Every remaining top-level const/let in the file lives here too, not near the code that actually
//   uses each one, for the same temporal-dead-zone reason as lastSavedSnapshot above:
//   loadCharacterBuildFromUrl() (called at the end of initialize(), itself called synchronously
//   below) reaches CHARACTER_BUILD_API_BASE whenever the page loads with a shared build's
//   ?openBuild=<guid> in the URL - a real crash this session, not just a theoretical one, and an
//   uncaught crash here permanently breaks every `let`/`const` declared after it in the file, for
//   the rest of the page's life. Consolidating everything up here removes the class of bug instead
//   of patching one variable at a time as each reachable path is discovered.
let AUGMENT_SLOT_CAP = 7;
let AUGMENT_COMBO_COLORS = {
    "Green": ["Blue", "Yellow"],
    "Orange": ["Red", "Yellow"],
    "Purple": ["Red", "Blue"]
};
let WEAPON_CATEGORIES = ["Melee1", "Melee2", "Ranged"];
const CHARACTER_BUILD_API_BASE = "/api/character-builds";
let openBuildList       = [];
let openBuildSortColumn = "updateDate";
let openBuildSortAsc    = false;
let buildHistoryList    = [];

// Added 2026-07-30 - a per-user library of saved Named/Custom items (see loadNamedItems() and
//   db/ddocraft_schema.sql's namedItem comment). Same TDZ reasoning as everything else in this
//   block: loaded during initialize()'s own synchronous run.
const NAMED_ITEM_API_BASE = "/api/named-items";
let allNamedItems = [];

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

    // customItems[category] = { name, minLevel, augments, nextAugmentId, description } - only
    //   present while categoryMode[category] === 'custom'. Not deleted just for the category being
    //   switched back to 'cannith' (see handleCategoryModeToggle()'s comment) - the data quietly
    //   survives, both across a toggle and across level changes that fall below minLevel (see
    //   handleCharLevelChange()). Added 2026-07-30: minLevel, and allNamedItems - a per-user library
    //   of these objects a user can save to and reload from by name (see loadNamedItems()) so a
    //   named item doesn't have to be rebuilt by hand for every build that uses it.
    customItems: {},

    // classNames replaced the old single className 2026-07-30 - DDO supports up to 3 classes at
    //   once (multi-classing). description is new the same day, optional, free text.
    saveFile: {version: 2.1, dirty: false, charName: "", charLevel: "", classNames: [], description: "",
        positional: [], inherent: [], categoryMode: {}, customItems: {},
        collapsed: {item: [], slot: [], color: []}}
};

// All classes fetched from /api/character-classes, once - the picker renders from this rather
//   than a <select>'s own DOM state, so it can show buttons instead. Loaded synchronously in
//   initialize() same as before, just stored instead of populating a dropdown.
let allCharacterClasses = [];
let classPickerExpanded = false;
const MAX_CLASSES = 3;  // DDO's own multi-classing cap

initialize();

function initialize() {
    loadEnchantmentOptions();
    loadCharacterClasses();
    loadNamedItems();
    initCategoryChoice();
    initFilter();
    dialogHelp             = document.getElementById('help');
    buttonHelp             = document.getElementById("btnHelp");
    buttonCloseHelp        = document.getElementById("btnCloseHelp");
    dialogAbout            = document.getElementById('about');
    buttonAbout            = document.getElementById("btnAbout");
    buttonCloseAbout       = document.getElementById("btnCloseAbout");
    dialogOpenBuild        = document.getElementById('openBuild');
    dialogBuildHistory     = document.getElementById('buildHistory');

    renderEnchantmentOptions();
    renderResult();
    handleRename(); // Sets to "Unnamed" if not invalid.
    markSaved(); // Baseline for isDirty(): a fresh, untouched page is never "unsaved changes" -
                 //   loadCharacterBuildFromUrl() below overwrites this with its own baseline if a
                 //   shared link loads something real.
    loadCharacterBuildFromUrl();
}

function loadEnchantmentOptions() {
    // WARNING: Requires the response ordered by category then item then slot then color (the
    //   server-side view this hits is ORDER BY'd to match - see db/create_catalog_views.sql).
    // This is the one function that knows about the flat/duplicated catalog row shape - the rest
    //   of the app only ever sees charData.enchantments/charData.catalog. Was ddocraft.json (a
    //   static export) until 2026-07-30, now /api/catalog (live from MariaDB) - buildCatalog()
    //   itself needed zero changes, since the endpoint was built to match the exact row shape the
    //   static export already produced.
    let itemOptionsRequest                = new XMLHttpRequest();
    itemOptionsRequest.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            buildCatalog(JSON.parse(this.responseText));
        }
    };

    // TO DO: Consider convert to asynchronous? Is there something we can do while it loads?
    itemOptionsRequest.open("GET", "/api/catalog", false);
    itemOptionsRequest.send();
}

// Same synchronous-load pattern as the catalog above, so the picker's already populated by the
//   time the first render happens. Tolerates the API being unreachable: allCharacterClasses just
//   stays empty rather than breaking the rest of the page.
function loadCharacterClasses() {
    let request                = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            allCharacterClasses = JSON.parse(this.responseText);
        }
    };
    request.open("GET", "/api/character-classes", false);
    request.send();
}

// Same synchronous-load pattern again, for the current user's Named Item library (see
//   NAMED_ITEM_API_BASE's comment near the top of the file) - populates the combo box's datalist
//   before the first render, same reasoning as the two loaders above. Tolerates the API being
//   unreachable the same way: allNamedItems just stays empty.
function loadNamedItems() {
    let request                = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            allNamedItems = JSON.parse(this.responseText);
            updateNamedItemDatalist();
        }
    };
    request.open("GET", NAMED_ITEM_API_BASE + "?userId=" + getUserId(), false);
    request.send();
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
                forHitPoints: row.forHitPoints
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

function initFilter() {
    charData.saveFile.charLevel             = Number(document.getElementById('characterLevel').value);
    charData.enchFilter['allEnch']          = document.getElementById('allEnch').checked;
    charData.enchFilter['basic']            = document.getElementById('basic').checked;
    charData.enchFilter['nonscaling']       = document.getElementById('nonscaling').checked;
    charData.enchFilter['forMeleeDmg']      = document.getElementById('forMeleeDmg').checked;
    charData.enchFilter['forRangedDmg']     = document.getElementById('forRangedDmg').checked;
    charData.enchFilter['forACDefence']     = document.getElementById('forACDefence').checked;
    charData.enchFilter['forResistDefence'] = document.getElementById('forResistDefence').checked;
    charData.enchFilter['forHitPoints']     = document.getElementById('forHitPoints').checked;
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
    let effectTypeCounts    = {};   // enchEffectType -> how many selections share it
    let selectedNamesByItem = {};   // item -> Set(enchName) - for enchSupercededBy wildcard matches
    let allSelectedNames    = new Set();  // every enchName currently active anywhere, across ALL
                                     //   items - drives the GLOBAL supersedes check below. A
                                     //   superseding effect (True Sight) and what it supersedes
                                     //   (Blindness Immunity) are typically on different items
                                     //   entirely (e.g. Goggles vs. wherever else Blindness
                                     //   Immunity shows up), so this can't be item-scoped.
    let activeInherent      = [];   // {category, enchName} for every active INHERENT selection only -
                                     //   augments are a live, changeable choice even on a named item
                                     //   (you still pick what goes in the slot), so they keep the
                                     //   ordinary individual rose treatment via getButton() and don't
                                     //   feed the category-level warning below. Only an item's fixed,
                                     //   non-slot effects (inherent) get that treatment.

    function account(item, enchName) {
        let ench = charData.enchantments[enchName];
        if (!ench) { return; }
        effectTypeCounts[ench.enchEffectType] = (effectTypeCounts[ench.enchEffectType] || 0) + 1;
        if (!(item in selectedNamesByItem)) { selectedNamesByItem[item] = new Set(); }
        selectedNamesByItem[item].add(enchName);
        allSelectedNames.add(enchName);
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
                activeInherent.push({category: category, enchName: enchName});
            }
        }
    }

    // Global supersedes overlap: selecting only the superior effect (True Sight) marks the lesser
    //   one it supersedes (Blindness Immunity) as already-covered/"handled" wherever it appears -
    //   see the isHandled checks below - but that alone isn't a real conflict, so neither gets rose.
    //   Selecting only the lesser effect leaves the superior one completely normal - nothing here
    //   marks IT as handled, since the relationship only runs one direction. Only when BOTH are
    //   independently selected is it a genuine redundancy, worth flagging on both.
    let supersedeDuplicate = new Set();
    for (let name of allSelectedNames) {
        let ench = charData.enchantments[name];
        if (ench && ench.enchSupercededBy && allSelectedNames.has(ench.enchSupercededBy)) {
            supersedeDuplicate.add(name);
            supersedeDuplicate.add(ench.enchSupercededBy);
        }
    }

    // An item's inherent effects are treated as fixed once picked - they never get the individual
    //   rose "duplicate" treatment (see getInherentButton()). Instead, the category as a whole gets
    //   one text warning if ANY of its inherent selections overlap with anything - a second pass,
    //   since it needs effectTypeCounts fully totalled first.
    let customCategoryOverlap = {};
    for (let entry of activeInherent) {
        let ench = charData.enchantments[entry.enchName];
        if (ench && ((effectTypeCounts[ench.enchEffectType] || 0) > 1 || supersedeDuplicate.has(entry.enchName))) {
            customCategoryOverlap[entry.category] = true;
        }
    }

    return {effectTypeCounts: effectTypeCounts, selectedNamesByItem: selectedNamesByItem,
        allSelectedNames: allSelectedNames, supersedeDuplicate: supersedeDuplicate,
        customCategoryOverlap: customCategoryOverlap};
}

// ---- Collapse/prune helpers ----
//
// Collapse is a real, independently-tracked flag on every node (category, slot, color) - not
//   just an inherited render-time effect. "Collapse or expand of a thing collapses or expands
//   everything inside it": toggling a category sets/clears every one of its slots (and their
//   colors) to match; toggling a slot sets/clears its own colors to match. That cascade runs the
//   moment you click, via setCategoryCollapsed()/setSlotCollapsed() below - rendering itself just
//   checks each node's own flag, no inheritance needed.
//
// The reverse also holds, one level at a time: manually collapsing (or expanding) EVERY slot in a
//   category syncs the category's own flag to match (syncCategoryFromSlots()); manually collapsing
//   (or expanding) every color in a slot syncs the slot's flag the same way (syncSlotFromColors()),
//   which can then cascade its own sync up to the category. Deliberately NOT done: toggling a
//   single child doesn't touch the parent's flag at all - only full agreement across every child
//   does. A mixed state just leaves the parent's flag as whatever it last was.
//
// Whatever a node's own flag says, rendering is the same everywhere: a collapsed node with nothing
//   selected inside it still shows its own header (as a button to re-expand) - a SLOT (Cannith or
//   custom, plus Inherent Effects) shows a count of what's still pickable there instead of the
//   option list; a COLOR shows just its own name as a small button. A collapsed node WITH a
//   selection shows only the selected option(s), hiding the rest.

function slotHasSelection(item, slot) {
    return !!getOccupant(item, slot);
}

function colorHasSelection(item, slot, color) {
    let occupant = getOccupant(item, slot);
    return !!occupant && occupant.color === color;
}

function inherentHasSelection(category, item) {
    let set = (charData.selections.inherent[category] || {})[item];
    return !!set && set.size > 0;
}

function itemHasAnySelection(item) {
    let slots = charData.selections.positional[item];
    return !!slots && Object.keys(slots).length > 0;
}

// Is this candidate a genuinely good pick right now - level-gated in, passes the active filter,
//   AND wouldn't immediately show up as a discouraged "handled" duplicate (same effect type - or
//   whatever it supersedes - already selected elsewhere)? Mirrors getButton()'s own suppression
//   and isHandled checks, factored out so "N unused options available" only counts options that
//   wouldn't trigger that warning, not merely whatever would render as a button at all.
function isOptionGood(slot, enchName, idx) {
    let ench      = charData.enchantments[enchName];
    let isAugment = slot.substring(0, 3) === "Aug";
    let minLevel  = isAugment ? ench.enchAugmentMinLevel : ench.enchCannithMinLevel;
    if (charData.saveFile.charLevel < minLevel) { return false; }
    if (getEnchFilterValue(enchName) < 1) { return false; }
    let effectCount = idx.effectTypeCounts[ench.enchEffectType] || 0;
    if (effectCount > 0) { return false; }
    if (idx.allSelectedNames.has(ench.enchSupercededBy)) { return false; }
    return true;
}

function countAvailableInSlot(slot, colorMap, idx) {
    let count = 0;
    for (let color of Object.keys(colorMap)) {
        for (let enchName of colorMap[color]) {
            if (isOptionGood(slot, enchName, idx)) { count++; }
        }
    }
    return count;
}

function describeAvailableCount(count) {
    if (count === 0) { return "No unused options available."; }
    if (count === 1) { return "1 unused option available."; }
    return count + " unused options available.";
}

// ---- Collapse cascade: category <-> its slots <-> their colors ----

function getSlotsForCategory(category) {
    let mode = charData.categoryMode[category] || "cannith";
    let item = mode === "custom" ? customItemKey(category) : charData.categoryChoice[category];
    if (!item) { return []; }
    if (mode === "custom") {
        let custom = charData.customItems[category];
        let slots  = ["InherentEffects"];
        if (custom) {
            custom.augments.forEach(function (aug) { slots.push("Augment#" + aug.id); });
        }
        return slots;
    }
    let itemNode = charData.catalog[category] && charData.catalog[category][item];
    return itemNode ? Object.keys(itemNode) : [];
}

function getColorsForSlot(category, slot) {
    let mode = charData.categoryMode[category] || "cannith";
    if (mode === "custom") {
        if (slot === "InherentEffects") { return []; }
        let custom = charData.customItems[category];
        if (!custom) { return []; }
        let augId = parseInt(slot.slice("Augment#".length), 10);
        let aug    = custom.augments.find(function (a) { return a.id === augId; });
        return aug ? realColorsForSlot(aug.color) : [];
    }
    let item     = charData.categoryChoice[category];
    let itemNode = item && charData.catalog[category] && charData.catalog[category][item];
    let colorMap = itemNode && itemNode[slot];
    return colorMap ? Object.keys(colorMap) : [];
}

function setSlotCollapsed(category, item, slot, collapsed) {
    let slotKey = item + "|" + slot;
    if (collapsed) { charData.collapsed.slot.add(slotKey); } else { charData.collapsed.slot.delete(slotKey); }
    for (let color of getColorsForSlot(category, slot)) {
        let colorKey = slotKey + "|" + color;
        if (collapsed) { charData.collapsed.color.add(colorKey); } else { charData.collapsed.color.delete(colorKey); }
    }
}

function setCategoryCollapsed(category, collapsed) {
    if (collapsed) { charData.collapsed.item.add(category); } else { charData.collapsed.item.delete(category); }
    let mode = charData.categoryMode[category] || "cannith";
    let item = mode === "custom" ? customItemKey(category) : charData.categoryChoice[category];
    if (!item) { return; }
    for (let slot of getSlotsForCategory(category)) {
        setSlotCollapsed(category, item, slot, collapsed);
    }
}

function syncCategoryFromSlots(category) {
    let mode = charData.categoryMode[category] || "cannith";
    let item = mode === "custom" ? customItemKey(category) : charData.categoryChoice[category];
    if (!item) { return; }
    let slots = getSlotsForCategory(category);
    if (slots.length === 0) { return; }
    let slotKeys     = slots.map(function (s) { return item + "|" + s; });
    let allCollapsed = slotKeys.every(function (k) { return charData.collapsed.slot.has(k); });
    let allExpanded  = slotKeys.every(function (k) { return !charData.collapsed.slot.has(k); });
    if (allCollapsed) { charData.collapsed.item.add(category); }
    else if (allExpanded) { charData.collapsed.item.delete(category); }
    // else mixed - leave the category's own flag as whatever it last was
}

function syncSlotFromColors(category, item, slot) {
    let colors = getColorsForSlot(category, slot);
    if (colors.length === 0) { return; }
    let slotKey      = item + "|" + slot;
    let colorKeys    = colors.map(function (c) { return slotKey + "|" + c; });
    let allCollapsed = colorKeys.every(function (k) { return charData.collapsed.color.has(k); });
    let allExpanded  = colorKeys.every(function (k) { return !charData.collapsed.color.has(k); });
    if (allCollapsed) { charData.collapsed.slot.add(slotKey); }
    else if (allExpanded) { charData.collapsed.slot.delete(slotKey); }
    else { return; }  // mixed - don't touch the slot's flag, and nothing uniform to bubble up further
    syncCategoryFromSlots(category);
}

function toggleCategory(category) {
    setCategoryCollapsed(category, !charData.collapsed.item.has(category));
    renderEnchantmentOptions();
    renderResult();
}

function toggleSlot(category, item, slot) {
    let slotKey = item + "|" + slot;
    setSlotCollapsed(category, item, slot, !charData.collapsed.slot.has(slotKey));
    syncCategoryFromSlots(category);
    renderEnchantmentOptions();
    renderResult();
}

function toggleColor(category, item, slot, color) {
    let colorKey = item + "|" + slot + "|" + color;
    if (charData.collapsed.color.has(colorKey)) { charData.collapsed.color.delete(colorKey); }
    else { charData.collapsed.color.add(colorKey); }
    syncSlotFromColors(category, item, slot);
    renderEnchantmentOptions();
    renderResult();
}

function renderEnchantmentOptions() {
    let idx  = computeSelectionIndex();
    let html = "";

    let levelIsSet = hasValidCharLevel();

    for (let category of charData.categoryOrder) {
        let mode              = charData.categoryMode[category] || "cannith";
        // No valid level yet: force every category collapsed, regardless of its own stored flag
        //   (which is left untouched, so whatever the user had expanded/collapsed comes back once
        //   a valid level is set again).
        let categoryCollapsed = !levelIsSet || charData.collapsed.item.has(category);

        let item, categoryHasSelection;
        if (mode === "custom") {
            item = customItemKey(category);
            categoryHasSelection = itemHasAnySelection(item) || inherentHasSelection(category, item);
        } else {
            item = charData.categoryChoice[category];
            categoryHasSelection = item ? itemHasAnySelection(item) : false;
        }

        if (categoryCollapsed && !categoryHasSelection) {
            html += "<table><caption class='itemheader collapsed' onclick=\"toggleCategory('" +
                escJs(category) + "')\">&#9655; " + escHtml(category) + "</caption></table>";
            continue;
        }

        let triangle = categoryCollapsed ? "&#9655;" : "&#9661;";
        html += "<table><caption class='itemheader" + (categoryCollapsed ? " collapsed" : "") +
            "' onclick=\"toggleCategory('" + escJs(category) + "')\">" + triangle + " " +
            escHtml(category) + " " + getCategoryModeToggleHtml(category);

        if (mode === "custom") {
            if (idx.customCategoryOverlap[category]) {
                html += " <span class='overlapWarning'>Effect overlaps detected</span>";
            }
            html += "</caption>" + renderCustomItemBody(category, idx) + "</table>";
            continue;
        }

        if (!item) { html += "</caption></table>"; continue; }
        let itemNode = charData.catalog[category][item];

        html += "</caption>";
        for (let slot of Object.keys(itemNode)) {
            if (slot === "Extra" && charData.saveFile.charLevel < extraSlotMinLevel) { continue; }
            html += renderSlotRow(category, item, slot, itemNode[slot], idx);
        }
        html += "</table>";
    }

    document.getElementById("enchantmentOptions").innerHTML = html;
    updateSaveDownloadEnabled();
    updateCharacterInfoDisplay();
}

function updateSaveDownloadEnabled() {
    let levelValid = hasValidCharLevel();
    document.getElementById("iconSave").classList.toggle("disabled", !levelValid || !isDirty());
    document.getElementById("iconDownload").classList.toggle("disabled", !levelValid);
}

// ---- Unsaved-changes tracking ----
//
// lastSavedSnapshot (declared near the top of the file - see the comment there) always holds a
//   real baseline - initialize() sets one for a blank page before any user interaction is
//   possible, and every save/load moves it - so dirty always means "really differs from the last
//   known-saved-or-loaded state," never "nothing to compare against yet." That matters beyond the
//   Save button: confirmDiscardUnsavedChanges() below also relies on isDirty(), and a false
//   positive there would nag on every single Open click on a fresh page.

function computeContentSnapshot() {
    updateSave();
    let sf = charData.saveFile;
    return JSON.stringify({
        charName: sf.charName, charLevel: sf.charLevel, classNames: sf.classNames,
        description: sf.description, positional: sf.positional, inherent: sf.inherent,
        categoryMode: sf.categoryMode, customItems: sf.customItems
    });
}

function isDirty() {
    return computeContentSnapshot() !== lastSavedSnapshot;
}

function markSaved() {
    lastSavedSnapshot = computeContentSnapshot();
}

function renderSlotRow(category, item, slot, colorMap, idx) {
    let slotKey      = item + "|" + slot;
    let collapsed    = charData.collapsed.slot.has(slotKey);
    let hasSelection = slotHasSelection(item, slot);
    let onclickAttr  = "onclick=\"toggleSlot('" + escJs(category) + "','" + escJs(item) + "','" + escJs(slot) + "')\"";

    if (collapsed && !hasSelection) {
        // Stays visible even when empty - a slot fully disappearing risks hiding something still
        //   worth filling in - showing how many options are still pickable instead of the list.
        return "<tr class='collapsed'><td class='slot' " + onclickAttr + ">" + escHtml(slot) +
            "</td><td class='options'>" + describeAvailableCount(countAvailableInSlot(slot, colorMap, idx)) + "</td></tr>";
    }

    let trClass = collapsed ? " class='collapsed'" : "";
    let html    = "<tr" + trClass + "><td class='slot' " + onclickAttr + ">" + escHtml(slot) + "</td><td class='options'>";

    let isAugment  = slot.substring(0, 3) === "Aug";
    let firstShown = true;
    for (let color of Object.keys(colorMap)) {
        let colorHtml = renderColorGroup(category, item, slot, color, colorMap[color], isAugment, idx);
        if (!colorHtml) { continue; }
        if (!firstShown && isAugment) { html += "<br />"; }
        html += colorHtml;
        firstShown = false;
    }

    html += "</td></tr>";
    return html;
}

function renderColorGroup(category, item, slot, color, enchNames, isAugment, idx) {
    let slotKey      = item + "|" + slot;
    let colorKey     = slotKey + "|" + color;
    // Not gated on isAugment - a non-augment slot has exactly one virtual color (""), and
    //   setSlotCollapsed() already keeps it in lockstep with the slot's own flag, same as every
    //   augment color. Gating this on isAugment used to make that virtual color always read as
    //   expanded, so a collapsed Prefix/Suffix/Extra slot with something selected in it still
    //   rendered every option instead of just the selected one.
    let collapsed    = charData.collapsed.color.has(colorKey);
    let hasSelection = colorHasSelection(item, slot, color);
    let onclickAttr  = "onclick=\"toggleColor('" + escJs(category) + "','" + escJs(item) + "','" +
        escJs(slot) + "','" + escJs(color) + "')\"";

    // A collapsed color with nothing selected in it disappears entirely, rather than showing a
    //   collapsed placeholder label - only one color can ever hold a selection in a given slot, so
    //   a collapsed augment slot showing all 3 color headers regardless was misleading: it implied
    //   more than one could matter at once.
    if (collapsed && !hasSelection) { return ""; }

    let html = "";
    if (isAugment) {
        let collapsedClass = collapsed ? " collapsed" : "";
        html += "<div class='color" + collapsedClass + "' " + onclickAttr + ">&nbsp;" + escHtml(color) + ":</div>&nbsp;";
    }

    let occupant = getOccupant(item, slot);
    html += "<div class='ench'> ";
    for (let enchName of enchNames) {
        let isSelectedHere = !!occupant && occupant.enchName === enchName && occupant.color === color;
        if (collapsed && !isSelectedHere) { continue; }
        html += getButton(item, slot, color, enchName, idx);
    }
    html += "</div>";
    return html;
}

function getCategoryModeToggleHtml(category) {
    let checked = charData.categoryMode[category] === "custom" ? " checked" : "";
    return "<label class='customToggle' onclick='event.stopPropagation()'>" +
        "<input type='checkbox' onclick='event.stopPropagation()' onchange=\"handleCategoryModeToggle(this,'" +
        escJs(category) + "')\"" + checked + " /> Named/Custom</label>";
}

function getAddAugmentControlHtml(category) {
    let custom = charData.customItems[category];
    if (!custom) { return ""; }

    if (custom.augments.length >= AUGMENT_SLOT_CAP) {
        return " <em>(max " + AUGMENT_SLOT_CAP + " augments)</em>";
    }

    // Green/Orange/Purple are combo slots (see realColorsForSlot()) - which ones are offered
    //   depends on whether the category is a weapon, and base Red is weapon-only too (folded into
    //   Orange/Purple, not offered on its own elsewhere). ASSUMPTION pending confirmation: weapon
    //   categories are exactly Melee1/Melee2/Ranged - everything else (including Shield, Rune Arm,
    //   Orb) is treated as non-weapon. Correct WEAPON_CATEGORIES below if that's wrong.
    let isWeapon   = WEAPON_CATEGORIES.indexOf(category) > -1;
    let baseColors = Object.keys(charData.augmentOptionsByColor).filter(function (c) {
        return c !== "Red" || isWeapon;
    });
    let colors = baseColors.concat(isWeapon ? ["Orange", "Purple"] : ["Green"]);

    let colorOptions = colors.map(function (c) {
        return "<option value=\"" + escHtml(c) + "\">" + escHtml(c) + "</option>";
    }).join("");
    return " <select class='addAugmentSelect' onclick='event.stopPropagation()' onchange=\"handleAddAugmentSelect(this,'" +
        escJs(category) + "')\"><option value=''>+ Add Augment...</option>" + colorOptions + "</select>";
}

function customItemKey(category) {
    // Stable pseudo-item name for the selections store - opaque to enchClick/getButton, which
    //   never distinguish a real catalog item from a custom one. Category alone is a sufficient
    //   key since only one custom item can be active per category at a time.
    return "custom:" + category;
}

// AUGMENT_SLOT_CAP, AUGMENT_COMBO_COLORS, WEAPON_CATEGORIES declared near the top of the file now
//   (see the comment there) - combo augment colors are a single slot/single selection, but
//   candidates drawn from more than one real color pool. Cannith rendering needs none of this: its
//   augment slots are "universal" in the source data already (every color shown together), this
//   only matters for a custom item's slot, which is deliberately restricted to what a real named
//   item's slot would actually take.

function realColorsForSlot(slotColor) {
    // Colorless is special in both directions: a Colorless slot accepts ONLY colorless augments,
    //   but every other slot additionally accepts colorless on top of whatever else it takes
    //   (colorless augments fit any slot color).
    let colors = (AUGMENT_COMBO_COLORS[slotColor] || [slotColor]).slice();
    if (slotColor !== "Colorless" && colors.indexOf("Colorless") === -1) { colors.push("Colorless"); }
    return colors;
}

function renderCustomItemBody(category, idx) {
    let custom = charData.customItems[category] ||
        {name: "", augments: [], nextAugmentId: 1, description: "", minLevel: ""};
    let item   = customItemKey(category);

    let html   = "<tr><td class='slot'>Name</td><td class='options'>" +
        "<input type='text' class='customItemName' list='namedItemNames' value=\"" + escHtml(custom.name) +
        "\" onchange=\"handleCustomItemName(this,'" + escJs(category) + "')\" />" +
        renderCustomItemMinLevel(category, custom) +
        " <button type='button' class='saveNamedItemBtn' onclick=\"handleSaveNamedItem(this,'" +
        escJs(category) + "')\">Save Named Item</button>" +
        getAddAugmentControlHtml(category) +
        "</td></tr>";

    custom.augments.forEach(function (aug, position) {
        html += renderCustomAugmentSlotRow(category, item, aug, position, idx);
    });

    html += renderInherentPicker(category, idx);
    html += renderCustomItemDescription(category, custom);

    return html;
}

// Inline label+input, sitting right next to the Name field in the same row (like Character Info's
//   Name/Level fields sit side by side) rather than its own row - a plain inline label instead of
//   Character Info's stacked label-above-input treatment, which costs more vertical height than a
//   per-category row inside a whole table of them can afford. Mirrors the real character level
//   field's own validation range - lets a level-decrease later trigger the same "will remove this"
//   confirmation flow real Cannith enchantments already get (see handleCharLevelChange()), without
//   needing a min-level field to be filled in at all: blank means "no known level requirement," not
//   "level 0."
function renderCustomItemMinLevel(category, custom) {
    return " <label class='customItemMinLevelLabel'>Min Level</label>" +
        "<input type='number' class='customItemMinLevel' min='1' max='36' value=\"" +
        escHtml(custom.minLevel || "") +
        "\" onchange=\"handleCustomItemMinLevel(this,'" + escJs(category) + "')\" />";
}

function renderCustomAugmentSlotRow(category, item, aug, position, idx) {
    let slot         = "Augment#" + aug.id;  // stable key - "Aug" prefix reuses getButton's
                                              //   existing augment-vs-cannith min-level check.
    let displayLabel = "Augment " + (position + 1);  // matches Cannith's plain "Augment 1"/"Augment 2"
                                                       //   label - the color already shows via the
                                                       //   color sub-header in column 2, so repeating
                                                       //   it here was redundant and made collapsed
                                                       //   rows taller than they needed to be.
    let slotKey      = item + "|" + slot;
    let realColors   = realColorsForSlot(aug.color);
    let collapsed    = charData.collapsed.slot.has(slotKey);
    let hasSelection = slotHasSelection(item, slot);

    // event.stopPropagation() keeps a click on the remove control from also bubbling up into the
    //   td's own toggleSlot() click below - same pattern already used for the category-mode
    //   checkbox in getCategoryModeToggleHtml().
    let removeControl = "<span class='removeAugment' title='Remove this augment slot' onclick=\"event.stopPropagation(); handleRemoveCustomAugment('" +
        escJs(category) + "'," + aug.id + ")\">&#10005;</span>";
    let onclickAttr = "onclick=\"toggleSlot('" + escJs(category) + "','" + escJs(item) + "','" + escJs(slot) + "')\"";
    let labelHtml   = escHtml(displayLabel) + " " + removeControl;

    if (collapsed && !hasSelection) {
        // Stays visible even when empty - a slot fully disappearing risks hiding something still
        //   worth filling in - showing how many options are still pickable instead of the list.
        let colorMap = {};
        for (let realColor of realColors) { colorMap[realColor] = charData.augmentOptionsByColor[realColor] || []; }
        return "<tr class='collapsed'><td class='slot' " + onclickAttr + ">" + labelHtml + "</td><td class='options'>" +
            describeAvailableCount(countAvailableInSlot(slot, colorMap, idx)) + "</td></tr>";
    }

    let trClass = collapsed ? " class='collapsed'" : "";
    let html    = "<tr" + trClass + "><td class='slot' " + onclickAttr + ">" + labelHtml + "</td><td class='options'>";

    let firstShown = true;
    for (let realColor of realColors) {
        let colorHtml = renderCustomColorGroup(category, item, slot, realColor, realColors.length > 1, idx);
        if (!colorHtml) { continue; }
        if (!firstShown) { html += "<br />"; }
        html += colorHtml;
        firstShown = false;
    }

    html += "</td></tr>";
    return html;
}

function renderCustomColorGroup(category, item, slot, realColor, showColorHeader, idx) {
    let slotKey      = item + "|" + slot;
    let colorKey     = slotKey + "|" + realColor;
    let collapsed    = charData.collapsed.color.has(colorKey);
    let hasSelection = colorHasSelection(item, slot, realColor);
    let onclickAttr  = "onclick=\"toggleColor('" + escJs(category) + "','" + escJs(item) + "','" +
        escJs(slot) + "','" + escJs(realColor) + "')\"";

    // See renderColorGroup()'s matching comment - a collapsed color with nothing selected in it
    //   disappears entirely rather than showing a misleading placeholder label.
    if (collapsed && !hasSelection) { return ""; }

    let html = "";
    if (showColorHeader) {
        let collapsedClass = collapsed ? " collapsed" : "";
        html += "<div class='color" + collapsedClass + "' " + onclickAttr + ">&nbsp;" + escHtml(realColor) + ":</div>&nbsp;";
    }

    let occupant = getOccupant(item, slot);
    html += "<div class='ench'> ";
    for (let enchName of (charData.augmentOptionsByColor[realColor] || [])) {
        let isSelectedHere = !!occupant && occupant.enchName === enchName && occupant.color === realColor;
        if (collapsed && !isSelectedHere) { continue; }
        html += getButton(item, slot, realColor, enchName, idx);
    }
    html += "</div>";
    return html;
}

function renderCustomItemDescription(category, custom) {
    // No collapse toggle of its own - it just follows the category's own flag, same as every other
    //   part of the category collapses/expands together when toggled at the category level.
    let collapsed    = charData.collapsed.item.has(category);
    if (collapsed && !custom.description) { return ""; }  // disappears if empty while collapsed
    let disabledAttr = collapsed ? " disabled" : "";
    return "<tr><td class='slot'>Description</td><td class='options'>" +
        "<textarea class='customItemDescription' onchange=\"handleCustomItemDescription(this,'" +
        escJs(category) + "')\"" + disabledAttr + ">" + escHtml(custom.description || "") + "</textarea></td></tr>";
}

function handleCustomItemDescription(textarea, category) {
    charData.customItems[category].description = textarea.value;
}

function renderInherentPicker(category, idx) {
    // Deliberately unscoped by category (see PIVOT note) - a named item's whole appeal can be an
    //   effect normal Cannith crafting could never produce for that category. Deliberately flat and
    //   alphabetical rather than grouped/filtered - relies on the browser's own search, same as the
    //   existing ~1500-row Cannith lists already do.
    let item         = customItemKey(category);
    let slotKey      = item + "|InherentEffects";
    let collapsed    = charData.collapsed.slot.has(slotKey);
    let hasSelection = inherentHasSelection(category, item);
    let onclickAttr  = "onclick=\"toggleSlot('" + escJs(category) + "','" + escJs(item) + "','InherentEffects')\"";
    // No onclick of its own - it sits inside the already-clickable slot cell above, so a click
    //   bubbles up to the same toggleSlot() the label itself uses. Label text alone doesn't read as
    //   clickable once a long picker list is open below it, so this gives that same action a
    //   visible, mode-appropriate affordance.
    let toggleBtn    = "<div class='inherentDoneWrap'><button type='button' class='inherentDoneBtn'>" +
        (collapsed ? "Edit" : "Done") + "</button></div>";

    if (collapsed && !hasSelection) {
        // Stays visible even when empty - inherent effects aren't options to pick so much as
        //   properties to identify, hence no count here (contrast with a real slot's "N available").
        return "<tr class='collapsed'><td class='slot' " + onclickAttr +
            ">Inherent Effects" + toggleBtn + "</td><td class='options'>No effects identified.</td></tr>";
    }

    let trClass = collapsed ? " class='collapsed'" : "";
    let html = "<tr" + trClass + "><td class='slot' " + onclickAttr +
        ">Inherent Effects" + toggleBtn + "</td><td class='options'><div class='ench'> ";
    let selectedSet = (charData.selections.inherent[category] || {})[item];
    for (let enchName of Object.keys(charData.enchantments).sort()) {
        let isSelected = !!selectedSet && selectedSet.has(enchName);
        if (collapsed && !isSelected) { continue; }
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
    let isHandled   = !isSelected && (
        effectCount > 0 ||
        idx.allSelectedNames.has(ench.enchSupercededBy)
    );

    let enchValue = getEnchFilterValue(enchName);
    let onclick   = "enchClickInherent('" + escJs(category) + "','" + escJs(item) + "','" + escJs(enchName) + "')";
    let title     = escHtml(ench.enchDesc);
    let btn;

    if (isSelected) {
        // Inherent effects are always a custom item's own - never the individual rose treatment,
        //   same reasoning as getButton(). See computeSelectionIndex()'s customCategoryOverlap.
        btn = "<button class='selected' title=\"" + title + "\" ";
        enchValue = 1;
    } else if (isHandled) {
        btn = "<button class='handled' title=\"" + title + "\" ";
    } else if (enchValue >= 1) {
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
        charData.customItems[category] = {name: "", augments: [], nextAugmentId: 1, description: "", minLevel: ""};
    }

    renderEnchantmentOptions();
    renderResult();
}

// If the typed/picked name exactly matches something already in the user's Named Item library
//   (see allNamedItems/loadNamedItems()), offers to load it - augments, their selected
//   enchantments, inherent effects, description and min level all included, not just the name.
//   Only asks for confirmation when it would actually discard something (an empty/fresh custom
//   item loads silently, matching how opening a real named item pick shouldn't feel like a
//   destructive action).
function handleCustomItemName(input, category) {
    let newName = input.value;
    charData.customItems[category].name = newName;

    let libraryItem = allNamedItems.find(function (n) { return n.itemName === newName; });
    if (!libraryItem) { return; }

    let custom = charData.customItems[category];
    let hasExistingData = custom.augments.length > 0 || !!custom.description;
    if (hasExistingData && !confirm("Load the saved Named Item \"" + newName + "\" here? This will " +
            "replace the augments, selections, and description currently entered for " + category + ".")) {
        return;
    }

    loadNamedItemInto(category, libraryItem.itemData);
    renderEnchantmentOptions();
    renderResult();
}

function loadNamedItemInto(category, data) {
    let item = customItemKey(category);

    charData.customItems[category] = {
        name: data.name || "",
        augments: (data.augments || []).map(function (a) { return {id: a.id, color: a.color}; }),
        nextAugmentId: data.nextAugmentId || 1,
        description: data.description || "",
        minLevel: data.minLevel || ""
    };

    delete charData.selections.positional[item];
    for (let slot of Object.keys(data.augmentSelections || {})) {
        let sel = data.augmentSelections[slot];
        if (sel.enchName in charData.enchantments) { setOccupant(item, slot, sel.enchName, sel.color); }
    }

    if (!(category in charData.selections.inherent)) { charData.selections.inherent[category] = {}; }
    let inherentSet = new Set();
    for (let enchName of (data.inherentSelections || [])) {
        if (enchName in charData.enchantments) { inherentSet.add(enchName); }
    }
    charData.selections.inherent[category][item] = inherentSet;
}

function handleCustomItemMinLevel(input, category) {
    let level = Number(input.value);
    let isValid = input.value !== "" && Number.isInteger(level) && level >= 1 && level <= 36;
    charData.customItems[category].minLevel = isValid ? level : "";
    if (!isValid) { input.value = ""; }
}

// Pushes the category's current Named/Custom item (definition + its actual augment/inherent
//   selections) up to the user's library, overwriting any existing entry with the same name -
//   see db/ddocraft_schema.sql's namedItem comment for why that's intentional, not a bug. A blank
//   name can't be saved (nothing to key the upsert on).
function handleSaveNamedItem(button, category) {
    let custom = charData.customItems[category];
    if (!custom || !custom.name) { alert("Enter a name before saving a Named Item."); return; }

    let item = customItemKey(category);
    let augmentSelections = {};
    for (let slot of Object.keys(charData.selections.positional[item] || {})) {
        augmentSelections[slot] = charData.selections.positional[item][slot];
    }
    let inherentSet = (charData.selections.inherent[category] || {})[item];

    let itemData = {
        name: custom.name,
        minLevel: custom.minLevel,
        augments: custom.augments,
        nextAugmentId: custom.nextAugmentId,
        description: custom.description,
        augmentSelections: augmentSelections,
        inherentSelections: inherentSet ? Array.from(inherentSet) : []
    };

    let originalLabel = button.textContent;
    button.disabled = true;

    fetch(NAMED_ITEM_API_BASE, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userId: getUserId(), itemName: custom.name, itemData: itemData})
    })
        .then(function (r) { return rejectIfNotOk(r); })
        .then(function () {
            let existing = allNamedItems.find(function (n) { return n.itemName === custom.name; });
            if (existing) { existing.itemData = itemData; } else { allNamedItems.push({itemName: custom.name, itemData: itemData}); }
            updateNamedItemDatalist();
            button.textContent = "Saved!";
            setTimeout(function () { button.textContent = originalLabel; button.disabled = false; }, 1500);
        })
        .catch(function (err) {
            alert("Saving Named Item failed: " + err.message);
            button.textContent = originalLabel;
            button.disabled = false;
        });
}

function updateNamedItemDatalist() {
    let el = document.getElementById("namedItemNames");
    if (!el) { return; }
    let names = allNamedItems.map(function (n) { return n.itemName; }).sort();
    el.innerHTML = names.map(function (n) { return "<option value=\"" + escHtml(n) + "\"></option>"; }).join("");
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
    let isDuplicate    = isSelectedHere && (effectCount > 1 || idx.supersedeDuplicate.has(enchName));
    let isHandled      = !isSelectedHere && !isBlocked && (
        effectCount > 0 ||
        idx.allSelectedNames.has(ench.enchSupercededBy)
    );

    let onclick = "enchClick('" + escJs(item) + "','" + escJs(slot) + "','" + escJs(color) + "','" + escJs(enchName) + "')";
    let title   = escHtml(ench.enchDesc);
    let btn;

    if (isSelectedHere) {
        // Augments (custom or Cannith alike) are always a live, changeable choice - even on a
        //   named item, you choose what to socket into its augment slot - so they keep the normal
        //   individual rose "duplicate" treatment. Only an item's INHERENT effects (fixed, can't be
        //   changed short of using a different item) get the suppressed/header-warning treatment -
        //   see getInherentButton() and computeSelectionIndex()'s customCategoryOverlap.
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
    } else if (enchValue >= 1) {
        // Every visible, unselected/unhandled/unblocked button gets a tint now, even at the floor
        //   (enchValue 1) - no more jump between "not specially colored at all" and "highlighted".
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
    // Recommendation-strength tint: a light, faintly blue-tinted background at the low end (an
    //   effect that barely matches, num near 1) diverging to a darker, more saturated blue as more
    //   checked filters match, up toward maxVal. The dark end reuses the exact blue (#3987e5) that
    //   used to sit at the LOW end of the old light-to-brighter-blue scale - already proven to read
    //   fine with black text, so no new "how dark is too dark" guess is needed. Black text (set by
    //   the caller) holds up across the whole range now, unlike a dark-to-light scale, which would
    //   need to switch text color partway through.
    let maxVal = 32;
    let light  = [232, 236, 245];
    let dark   = [57, 135, 229];

    let t = Math.min(Math.max((num - 1) / (maxVal - 1), 0), 1);
    let r = Math.round(light[0] + (dark[0] - light[0]) * t);
    let g = Math.round(light[1] + (dark[1] - light[1]) * t);
    let b = Math.round(light[2] + (dark[2] - light[2]) * t);
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

function displayItemName(item) {
    let category = categoryOfCustomItemKey(item);
    if (!category) { return item; }
    let custom = charData.customItems[category];
    let name   = (custom && custom.name) ? custom.name : "Unnamed";
    return name + " (" + category + ")";
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

            charData.reportOut += "<tr><td>" + escHtml(displayItemName(item)) + "</td><td>";
            charData.reportOut += escHtml(slot) + "</td><td>";
            charData.reportOut += escHtml(augColor + occupant.enchName) + "</td></tr>";
        }
    }

    for (let category of Object.keys(charData.selections.inherent)) {
        for (let item of Object.keys(charData.selections.inherent[category])) {
            for (let enchName of charData.selections.inherent[category][item]) {
                charData.reportOut += "<tr><td>" + escHtml(displayItemName(item)) + "</td><td>";
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



function handleRename(fixBoth = false) {
    charData.saveFile.charName = document.getElementById("characterName").value;
    if(!charData.saveFile.charName) {
        charData.saveFile.charName = "Unnamed";
        if(fixBoth){
            document.getElementById("characterName").value = charData.saveFile.charName;
        }

    }
    updateSaveDownloadEnabled();  // charName is part of isDirty()'s snapshot but nothing else
                                   //   re-checks it - unlike level/selections, this field's own
                                   //   onchange never otherwise triggers a render.
}

// Optional, free text - deliberately not part of computeBuildChecksum() (see server/src/routes/
//   characterBuilds.ts), same as charName/classNames: it describes the character, not the build's
//   equipment/effect choices, so two builds with identical selections but different descriptions
//   should still count as the same build for dedup/overwrite purposes.
function handleDescriptionChange() {
    charData.saveFile.description = document.getElementById("characterDescription").value;
    updateSaveDownloadEnabled();
}

// ---- Class(es) picker ----
//
// Multi-classing: DDO allows up to MAX_CLASSES (3) at once. Same collapsed-summary/Done-Edit
//   pattern as the Inherent Effects picker (renderInherentPicker()) - a click toggles a class
//   in/out of charData.saveFile.classNames, stored by name (not characterClassId) for the same
//   round-trip-robustness reason the old single className was - see Done.md.

function toggleClassPicker() {
    classPickerExpanded = !classPickerExpanded;
    updateClassPickerDisplay();
}

function handleClassButtonClick(className) {
    let names = charData.saveFile.classNames;
    let index = names.indexOf(className);
    if (index > -1) {
        names.splice(index, 1);
    } else if (names.length < MAX_CLASSES) {
        names.push(className);
    }
    // else: already at the cap and this class isn't selected - no-op, not an error state.
    updateClassPickerDisplay();
    updateSaveDownloadEnabled();
}

function updateClassPickerDisplay() {
    let names = charData.saveFile.classNames;

    document.getElementById("classPickerSummary").textContent = names.length > 0 ? names.join("/") : "(none)";

    document.getElementById("classPickerExpanded").style.display = classPickerExpanded ? "block" : "none";
    if (!classPickerExpanded) { return; }

    let atCap = names.length >= MAX_CLASSES;
    let html  = allCharacterClasses.map(function (c) {
        let isSelected = names.indexOf(c.className) > -1;
        let cappedClass = (!isSelected && atCap) ? " handled" : "";
        return "<button type='button' class='classPickerBtn" + (isSelected ? " selected" : cappedClass) +
            "' onclick=\"handleClassButtonClick('" + escJs(c.className) + "')\">" + escHtml(c.className) + "</button>";
    }).join("");
    document.getElementById("classPickerButtons").innerHTML = html;
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
    // Appending to the DOM before clicking, removing right after, and delaying the URL revoke are
    //   all needed to avoid a real browser quirk where a blob: download can get stuck showing as
    //   an unfinished .crdownload even though the file was written completely - revoking (or never
    //   appending) too early can race the browser's own read of the blob.
    let a      = document.createElement("a");
    let file   = new Blob([content], {type: contentType});
    let url    = URL.createObjectURL(file);
    a.href     = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// Download-to-read, not download-to-reopen: a compact, human-readable summary of the current
//   build, distinct from the server save/open above (which is now the real save mechanism) and
//   from the old local-file Save/Open at the bottom of the page (still there for now, untouched).
//   First pass, Markdown only - full layout/format (maybe PDF later) is still an open design
//   question, so this deliberately stays simple rather than guessing at a polish level.
//
// Compact by design: a Cannith item's Prefix/Suffix/Extra collapse into one "X of Y with Z"
//   sentence (how DDO players already describe crafted gear), a named/custom item's inherent
//   effects collapse into one comma list, and augments (either kind of item) get one further
//   "Color: Effect" comma list - never one bullet per effect. Categories with nothing selected at
//   all are skipped entirely.
function buildMarkdownReport() {
    let charName   = charData.saveFile.charName || "Unnamed";
    let charLevel  = charData.saveFile.charLevel;
    let classNames = charData.saveFile.classNames.join("/");
    let description = charData.saveFile.description;

    let md = "# " + charName + ", Level " + charLevel + (classNames ? " " + classNames : "") + "\n";
    if (description) { md += "\n" + description + "\n"; }
    let anySection = false;

    for (let category of charData.categoryOrder) {
        let mode = charData.categoryMode[category] || "cannith";
        let item = mode === "custom" ? customItemKey(category) : charData.categoryChoice[category];
        if (!item) { continue; }

        let lines = mode === "custom" ? buildCustomReportLines(category, item) : buildCannithReportLines(item);
        if (lines.length === 0) { continue; }

        let headerName = mode === "custom" ? ((charData.customItems[category] && charData.customItems[category].name) || "") : "";
        md += "\n## " + category + ": " + headerName + "\n" + lines.join("\n") + "\n";
        anySection = true;
    }

    if (!anySection) { md += "\nNo selections yet.\n"; }

    return md;
}

function reportAugmentLines(positional) {
    let augments = [];
    for (let slot of Object.keys(positional)) {
        if (slot.substring(0, 3) === "Aug") {
            let occupant = positional[slot];
            augments.push(occupant.color + ": " + occupant.enchName);
        }
    }
    return augments.length > 0 ? ["- **Augments**: " + augments.join(", ")] : [];
}

function buildCannithReportLines(item) {
    let positional = charData.selections.positional[item] || {};

    let sentence = "";
    if (positional["Prefix"]) { sentence = positional["Prefix"].enchName; }
    if (positional["Suffix"]) { sentence = sentence ? sentence + " of " + positional["Suffix"].enchName : positional["Suffix"].enchName; }
    if (positional["Extra"]) { sentence = sentence ? sentence + " with " + positional["Extra"].enchName : positional["Extra"].enchName; }

    let lines = sentence ? ["- " + sentence] : [];
    return lines.concat(reportAugmentLines(positional));
}

function buildCustomReportLines(category, item) {
    let inherentSet   = (charData.selections.inherent[category] || {})[item];
    let inherentNames = inherentSet ? Array.from(inherentSet).sort() : [];
    let positional    = charData.selections.positional[item] || {};

    let lines = inherentNames.length > 0 ? ["- " + inherentNames.join(", ")] : [];
    return lines.concat(reportAugmentLines(positional));
}

function handleDownloadReport() {
    handleRename(true);
    let charName = charData.saveFile.charName || "Unnamed";
    downloadJSON(buildMarkdownReport(), charName + "_build.md", "text/markdown");
}

// Guards any action that's about to replace the whole in-memory build (opening a different saved
//   build, rolling back) - calls proceedFn() once it's actually safe to do so: immediately if
//   nothing's unsaved, after a successful save if the user chooses to save first (chained through
//   handleSaveToServer()'s onSaved callback, so the action really does happen once the save
//   finishes rather than needing a second click), or immediately - discarding - if they choose not
//   to save. Does nothing at all, leaving proceedFn() uncalled, if they cancel outright. Two plain
//   confirm()s stand in for the three-way Save/Don't Save/Cancel choice, consistent with every
//   other dialog in this app being a native confirm() rather than a custom modal.
function confirmDiscardUnsavedChanges(proceedFn) {
    if (!isDirty()) { proceedFn(); return; }

    let name = charData.saveFile.charName || "this build";
    if (confirm("Save changes before leaving \"" + name + "\"?")) {
        handleSaveToServer(proceedFn);
        return;
    }
    if (confirm("Discard changes to \"" + name + "\" and leave without saving?")) {
        proceedFn();
    }
}

// Revert's only purpose is to intentionally throw away unsaved changes - offering to save first
//   would contradict the point of clicking it, so this is a plain two-way confirm, not the
//   three-way guard above.
function confirmRevert() {
    return !isDirty() || confirm("Discard changes and revert to last saved copy?");
}

// Catches accidental data loss the app's own discard-guards above can't reach - a refresh, closing
//   the tab, or navigating away entirely (typing a URL, browser back/forward). Deliberately limited
//   compared to those guards: modern browsers show their own fixed-text "leave site?" prompt (no
//   custom message) with only Stay/Leave, no way to hook in "save first" as a third option, since
//   the page unloads immediately once the user chooses to leave. Still worth it as a safety net for
//   exactly the case those guards can't cover. No-ops entirely when nothing's unsaved.
window.addEventListener('beforeunload', function (e) {
    if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

function handleLoad(incomingFile) {
    // Opening a finished build is a different moment than actively building one - show it off
    //   as a title immediately rather than landing back in edit mode.
    characterInfoCollapsed = true;

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
    charData.saveFile.charLevel                     = Number(incomingFile.charLevel);
    // classNames replaced the old single className 2026-07-30 - a build saved before that change
    //   only has className, so fall back to wrapping it as a one-element array.
    charData.saveFile.classNames = incomingFile.classNames ||
        (incomingFile.className ? [incomingFile.className] : []);
    classPickerExpanded = false;
    updateClassPickerDisplay();
    charData.saveFile.description = incomingFile.description || "";
    document.getElementById("characterDescription").value = charData.saveFile.description;

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
            nextAugmentId: saved.nextAugmentId || 1,
            description: saved.description || "",
            // Added 2026-07-30 - a build saved before then simply has no min-level data to restore.
            minLevel: saved.minLevel || ""
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

// ---- Server save/open ----
//
// Phase 1 has no real accounts - there's no session to identify who's saving, so getUserId() is a
//   hardcoded placeholder. Swapped out (not extended) once GateIron.com's real accounts exist and
//   userId comes from an authenticated session instead - see TO DO.md.
// CHARACTER_BUILD_API_BASE declared near the top of the file now (see the comment there).

function getUserId() {
    return 1;
}

// onSaved, if given, is called once the save actually completes - lets a caller chain into
//   whatever the save was blocking (see confirmDiscardUnsavedChanges()) instead of the user
//   needing to retry their original action once the save finishes on its own.
function handleSaveToServer(onSaved) {
    handleRename(true);
    updateSave();

    let payload = {
        userId: getUserId(),
        charName: charData.saveFile.charName,
        charLevel: charData.saveFile.charLevel,
        description: charData.saveFile.description || null,
        appVersion: String(charData.saveFile.version),
        buildData: charData.saveFile
    };

    submitCharacterBuildSave(payload, onSaved);
}

function submitCharacterBuildSave(payload, onSaved) {
    fetch(CHARACTER_BUILD_API_BASE, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    })
        .then(function (r) {
            if (r.status === 409) {
                return r.json().then(function (body) { return handleSaveOverwriteConfirmation(payload, body, onSaved); });
            }
            return rejectIfNotOk(r).then(function (data) {
                currentServerBuildId = data.characterBuildId;
                markSaved();
                updateSaveDownloadEnabled();
                if (onSaved) { onSaved(); }
            });
        })
        .catch(function (err) { alert("Save to server failed: " + err.message); });
}

// The server declines to overwrite an existing build with one that has 5+ fewer selections
//   without an explicit confirm - re-submits the same payload with confirmOverwrite:true on yes,
//   does nothing further on cancel (the existing build is untouched either way, and onSaved never
//   fires - the save didn't actually happen).
function handleSaveOverwriteConfirmation(payload, body, onSaved) {
    if (!body.needsConfirmation) { throw new Error(body.error || "status 409"); }

    let message = "Save over the existing \"" + body.existingCharName + "\", Level " +
        body.existingCharLevel + " that has " + body.existingEffectCount +
        " selections made, with this version that has " + body.newEffectCount + "?";
    if (confirm(message)) {
        submitCharacterBuildSave(Object.assign({}, payload, {confirmOverwrite: true}));
    }
}

function rejectIfNotOk(response) {
    if (response.ok) { return response.json(); }
    return response.json()
        .catch(function () { return {}; })
        .then(function (body) { throw new Error(body.error || ("status " + response.status)); });
}

// ---- Open Build dialog ----
//
// Sortable table of the current test user's server saves. The "Open" control in each row is a
//   real <a href> (not a JS-only button) specifically so the browser's own right-click "open in
//   new tab" / middle-click / ctrl-click behavior works natively - clicking it plainly is
//   intercepted for a fast in-page load, but nothing about that interception is required for the
//   link to work; loadCharacterBuildFromUrl() is what makes a real navigation to that URL (in a
//   new tab, or pasted/bookmarked) load the build on its own.
// openBuildList/openBuildSortColumn/openBuildSortAsc declared near the top of the file now (see
//   the comment there).

function handleLoadFromServer() {
    let userId = getUserId();

    fetch(CHARACTER_BUILD_API_BASE + "?userId=" + userId)
        .then(function (r) { return rejectIfNotOk(r); })
        .then(function (list) {
            openBuildList = list;
            sortOpenBuildList();
            renderOpenBuildTableBody();
            dialogOpenBuild.style.display = 'block';
        })
        .catch(function (err) { alert("Load from server failed: " + err.message); });
}

// Soft delete (see server/src/routes/characterBuilds.ts) - the row survives, but there's currently
//   no UI path back to it once it's the only version under its name: History is only reachable from
//   an active row, and deleting removes the last one. So from the user's perspective this is a
//   one-way action today, hence the blunt warning below rather than a softer "are you sure?".
function handleDeleteBuild(characterBuildId, charName, charLevel) {
    let message = "Delete " + charName + ", Level " + charLevel + "? There is currently no way to " +
        "undo this or recover it once its last active version is gone.";
    if (!confirm(message)) { return; }

    fetch(CHARACTER_BUILD_API_BASE + "/" + characterBuildId + "?userId=" + getUserId(), {method: "DELETE"})
        .then(function (r) {
            if (r.ok) { return; }
            return r.json().catch(function () { return {}; }).then(function (body) {
                throw new Error(body.error || ("status " + r.status));
            });
        })
        .then(function () { handleLoadFromServer(); })
        .catch(function (err) { alert("Delete failed: " + err.message); });
}

function handleSortOpenBuildList(column) {
    openBuildSortAsc    = (openBuildSortColumn === column) ? !openBuildSortAsc : true;
    openBuildSortColumn = column;
    sortOpenBuildList();
    renderOpenBuildTableBody();
}

function sortOpenBuildList() {
    let column = openBuildSortColumn;
    let dir    = openBuildSortAsc ? 1 : -1;
    openBuildList.sort(function (a, b) {
        if (a[column] < b[column]) { return -1 * dir; }
        if (a[column] > b[column]) { return 1 * dir; }
        return 0;
    });
}

// Shared by the Open Build and History dialogs - both need to recognize "this row is what's
//   already loaded in the editor" the same way: no Open control at all if it's the current build
//   and nothing's changed since (there's nothing to open), relabeled to Revert if it's the current
//   build but has since been edited (loading it again really does discard those edits), otherwise
//   a plain Open.
function renderOpenLinkCell(characterBuildId) {
    let isCurrent = characterBuildId === currentServerBuildId;
    if (isCurrent && !isDirty()) { return "<span class='openBuildCurrentLabel'>(current)</span>"; }

    let label = isCurrent ? "Revert" : "Open";
    let url   = "ddocraft.html?openBuild=" + encodeURIComponent(characterBuildId);
    return "<a class='openBuildOpenLink' href=\"" + escHtml(url) +
        "\" onclick=\"return handleOpenBuildLinkClick(event,'" + escJs(characterBuildId) + "'," +
        (isCurrent ? "true" : "false") + ")\">" + label + "</a>";
}

function renderOpenBuildTableBody() {
    document.getElementById("openBuildEmpty").style.display = openBuildList.length === 0 ? "block" : "none";

    let html = "";
    for (let build of openBuildList) {
        html += "<tr><td class='openBuildColOpen'>" + renderOpenLinkCell(build.characterBuildId) +
            " <button class='openBuildOpenLink' onclick=\"handleShowBuildHistory('" +
            escJs(build.charName) + "')\">History</button></td><td>" + escHtml(build.charName) +
            "</td><td>" + build.charLevel + "</td><td>" + build.effectCount + "</td><td>" +
            escHtml(formatBuildDate(build.updateDate)) + "</td><td class='openBuildColDelete'>" +
            "<button class='openBuildOpenLink' onclick=\"handleDeleteBuild('" +
            escJs(build.characterBuildId) + "','" + escJs(build.charName) + "'," + build.charLevel +
            ")\">Delete</button></td></tr>";
    }
    document.getElementById("openBuildTableBody").innerHTML = html;
}

function formatBuildDate(isoString) {
    let date = new Date(isoString);
    return isNaN(date.getTime()) ? isoString : date.toLocaleString();
}

// ---- Build History / Rollback ----
//
// Scoped to one build's own name, not a general "browse everything deleted" list - there's always
//   exactly one active row per (userId, charName), so a rollback is always a plain two-row swap
//   (deactivate whatever's active now, reactivate the target) with no naming conflict to resolve
//   and nothing to rename. Rolling back to what was just deactivated undoes a rollback the same
//   way, for free - no separate "undo" needed.
// buildHistoryList declared near the top of the file now (see the comment there).

function handleShowBuildHistory(charName) {
    let userId = getUserId();
    fetch(CHARACTER_BUILD_API_BASE + "/history?userId=" + userId + "&charName=" + encodeURIComponent(charName))
        .then(function (r) { return rejectIfNotOk(r); })
        .then(function (list) {
            buildHistoryList = list;
            document.getElementById("buildHistoryHeading").textContent = "Build History: " + charName;
            renderBuildHistoryTableBody();
            dialogOpenBuild.style.display    = 'none';
            dialogBuildHistory.style.display = 'block';
        })
        .catch(function (err) { alert("Load history failed: " + err.message); });
}

function handleCloseBuildHistory() {
    dialogBuildHistory.style.display = 'none';
    dialogOpenBuild.style.display    = 'block';
}

function renderBuildHistoryTableBody() {
    let html = "";
    for (let build of buildHistoryList) {
        let actionCell;
        if (build.deletedDate === null) {
            actionCell = renderOpenLinkCell(build.characterBuildId);
        } else {
            actionCell = "<button class='openBuildOpenLink' onclick=\"handleRollback('" +
                escJs(build.characterBuildId) + "','" + escJs(formatBuildDate(build.updateDate)) + "'," +
                build.effectCount + ")\">Roll Back</button>";
        }
        html += "<tr><td class='openBuildColOpen'>" + actionCell + "</td><td>" + build.charLevel +
            "</td><td>" + build.effectCount + "</td><td>" + escHtml(formatBuildDate(build.updateDate)) + "</td></tr>";
    }
    document.getElementById("buildHistoryTableBody").innerHTML = html;
}

function handleRollback(characterBuildId, dateText, effectCount) {
    let message = "Are you sure you want to roll back to the version from " + dateText +
        " with " + effectCount + " effect selections?";
    if (!confirm(message)) { return; }

    confirmDiscardUnsavedChanges(function () {
        fetch(CHARACTER_BUILD_API_BASE + "/" + characterBuildId + "/rollback", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({userId: getUserId()})
        })
            .then(function (r) { return rejectIfNotOk(r); })
            .then(function (data) {
                dialogBuildHistory.style.display = 'none';
                dialogOpenBuild.style.display = 'none';
                loadCharacterBuildFromServer(data.characterBuildId);
            })
            .catch(function (err) { alert("Roll back failed: " + err.message); });
    });
}

function handleOpenBuildLinkClick(event, characterBuildId, isRevert) {
    // Right-click and middle-click never reach this handler at all (the browser handles those
    //   itself, straight off the real href) - only a plain or modified left-click does. A modified
    //   click (ctrl/cmd/shift, opening a new tab/window) should fall through to that same native
    //   navigation too; only a plain click gets the fast in-page path.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) { return true; }
    event.preventDefault();

    let proceed = function () {
        loadCharacterBuildFromServer(characterBuildId);
        dialogOpenBuild.style.display = 'none';
    };
    if (isRevert) {
        if (confirmRevert()) { proceed(); }
    } else {
        confirmDiscardUnsavedChanges(proceed);
    }
    return false;
}

// No userId needed here - characterBuildId is a random, unguessable GUID, and knowing it is
//   itself sufficient to open the build (same mechanism whether it's your own or a link someone
//   shared with you - see server/src/routes/characterBuilds.ts).
function loadCharacterBuildFromServer(characterBuildId) {
    fetch(CHARACTER_BUILD_API_BASE + "/" + characterBuildId)
        .then(function (r) { return rejectIfNotOk(r); })
        .then(function (build) {
            handleLoad(build.buildData);
            currentServerBuildId = build.characterBuildId;
            markSaved();
            renderEnchantmentOptions();
            renderResult();
        })
        .catch(function (err) { alert("Load from server failed: " + err.message); });
}

// Lets a real navigation to ddocraft.html?openBuild=<guid> - a new tab, a bookmark, a pasted link -
//   load that build on its own, without ever having gone through the Open Build dialog.
function loadCharacterBuildFromUrl() {
    let characterBuildId = new URLSearchParams(window.location.search).get("openBuild");
    if (characterBuildId) { loadCharacterBuildFromServer(characterBuildId); }
}


// One toggle for the whole Character Info section now, not a separate one for Highlight -
//   collapsed shows a title-like "presentation" line (only once there's a valid level to show;
//   otherwise it's forced open, same reasoning as the options UI being forced collapsed below),
//   expanded shows the editable fields and the highlight checkboxes together.
function toggleCharacterInfoSection() {
    characterInfoCollapsed = !characterInfoCollapsed;
    updateCharacterInfoDisplay();
}

function getCharacterTitleText() {
    let charName   = charData.saveFile.charName || "Unnamed";
    let charLevel  = charData.saveFile.charLevel;
    let classNames = charData.saveFile.classNames.join("/");
    return charName + ", Level " + charLevel + (classNames ? " " + classNames : "");
}

function updateCharacterInfoDisplay() {
    let showPresentation = characterInfoCollapsed && hasValidCharLevel();
    document.getElementById("characterInfoPresentation").style.display = showPresentation ? "flex" : "none";
    document.getElementById("characterInfoEdit").style.display         = showPresentation ? "none" : "block";
    if (showPresentation) {
        document.getElementById("characterInfoTitle").textContent = getCharacterTitleText();
    }
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

function hasValidCharLevel() {
    let level = charData.saveFile.charLevel;
    return Number.isInteger(level) && level >= 1 && level <= 36;
}

function handleCharLevelChange() {
    let previousLevel = charData.saveFile.charLevel;
    let input         = document.getElementById("characterLevel");
    let level         = Number(input.value);
    let isValid       = input.value !== "" && Number.isInteger(level) && level >= 1 && level <= 36;

    charData.saveFile.charLevel = isValid ? level : "";
    if (!isValid) { input.value = ""; }

    let toDeselect = [];
    for (let item of Object.keys(charData.selections.positional)) {
        for (let slot of Object.keys(charData.selections.positional[item])) {
            let enchName = charData.selections.positional[item][slot].enchName;
            if (!minLevelAllowed(item, slot, enchName)) {
                toDeselect.push({item: item, slot: slot, enchName: enchName});
            }
        }
    }

    // Same idea as the Cannith scan above, but for Named/Custom items with a minLevel set (added
    //   2026-07-30) - a blank minLevel means "no known requirement," so it's never flagged. Reverting
    //   just flips categoryMode back to 'cannith' rather than clearing customItems - non-destructive,
    //   same as the manual checkbox toggle (see handleCategoryModeToggle()), so switching Named/Custom
    //   back on later (or raising the level again) picks up right where it was.
    let toRevertToCannith = [];
    for (let category of Object.keys(charData.categoryMode)) {
        if (charData.categoryMode[category] !== "custom") { continue; }
        let custom = charData.customItems[category];
        if (!custom || custom.minLevel === "" || custom.minLevel === undefined) { continue; }
        if (charData.saveFile.charLevel < custom.minLevel) {
            toRevertToCannith.push({category: category, name: custom.name || "(unnamed)"});
        }
    }

    if (toDeselect.length > 0 || toRevertToCannith.length > 0) {
        let message = "";
        if (toDeselect.length > 0) {
            message += "This will deselect the following enchantments:\n\n" +
                toDeselect.map(e => e.enchName).join(", ");
        }
        if (toRevertToCannith.length > 0) {
            if (message) { message += "\n\n"; }
            message += "This will switch the following categories back from Named/Custom to Cannith " +
                "(their Named Item data is kept and can be reselected later):\n\n" +
                toRevertToCannith.map(r => r.category + " (" + r.name + ")").join(", ");
        }
        message += "\n\nClick OK to proceed.";

        if (confirm(message)) {
            for (let e of toDeselect) { clearOccupant(e.item, e.slot); }
            for (let r of toRevertToCannith) { charData.categoryMode[r.category] = "cannith"; }
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
    // When the user clicks anywhere outside of the help window, close it
    if (event.target === dialogHelp) {
        dialogHelp.style.display = "none";
    }
    // Or about window
    if (event.target === dialogAbout) {
        dialogAbout.style.display = "none";
    }
};
