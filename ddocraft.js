// Planned work, known issues, and change history now live in TO DO.md and Done.md.

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
// Collapse no longer just hides a whole subtree - it PRUNES it, everywhere, the same way: only
//   selected options survive; everything unselected disappears. The exact node the user directly
//   collapsed always keeps its own header/label visible (as a button to re-expand), even if
//   there's nothing selected inside it at all - otherwise there'd be no way back in. A deeper
//   node that merely INHERITS pruning from a collapsed ancestor (rather than being the thing
//   directly clicked) disappears completely if it has nothing selected - no header, nothing -
//   since it's not the re-expand target itself.
//
// pruneMode threads down through every render call below: it starts false, becomes true the
//   moment any ancestor (or the node itself) is directly collapsed, and once true stays true for
//   everything nested inside - "slots with options collapse as slots do" applies automatically,
//   without needing their own collapse flag set.

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

function renderEnchantmentOptions() {
    let idx  = computeSelectionIndex();
    let html = "";

    for (let category of charData.categoryOrder) {
        let mode              = charData.categoryMode[category] || "cannith";
        let categoryCollapsed = charData.collapsed.item.has(category);
        let pruneMode         = categoryCollapsed;

        let item, categoryHasSelection;
        if (mode === "custom") {
            item = customItemKey(category);
            categoryHasSelection = itemHasAnySelection(item) || inherentHasSelection(category, item);
        } else {
            item = charData.categoryChoice[category];
            categoryHasSelection = item ? itemHasAnySelection(item) : false;
        }

        if (categoryCollapsed && !categoryHasSelection) {
            html += "<table><caption class='itemheader collapsed' onclick=\"toggleCollapsed('item','" +
                escJs(category) + "')\">&#9655; " + escHtml(category) + "</caption></table>";
            continue;
        }

        let triangle = categoryCollapsed ? "&#9655;" : "&#9661;";
        html += "<table><caption class='itemheader" + (categoryCollapsed ? " collapsed" : "") +
            "' onclick=\"toggleCollapsed('item','" + escJs(category) + "')\">" + triangle + " " +
            escHtml(category) + " " + getCategoryModeToggleHtml(category);

        if (mode === "custom") {
            if (idx.customCategoryOverlap[category]) {
                html += " <span class='overlapWarning'>Effect overlaps detected</span>";
            }
            html += "</caption>" + renderCustomItemBody(category, idx, pruneMode) + "</table>";
            continue;
        }

        if (!item) { html += "</caption></table>"; continue; }
        let itemNode = charData.catalog[category][item];

        html += "</caption>";
        for (let slot of Object.keys(itemNode)) {
            if (slot === "Extra" && charData.saveFile.charLevel < extraSlotMinLevel) { continue; }
            html += renderSlotRow(item, slot, itemNode[slot], pruneMode, idx);
        }
        html += "</table>";
    }

    document.getElementById("enchantmentOptions").innerHTML = html;
}

function renderSlotRow(item, slot, colorMap, pruneModeInherited, idx) {
    let slotKey           = item + "|" + slot;
    let directlyCollapsed = charData.collapsed.slot.has(slotKey);
    let pruneMode         = pruneModeInherited || directlyCollapsed;
    let hasSelection      = slotHasSelection(item, slot);

    if (pruneMode && !hasSelection) {
        if (!directlyCollapsed) { return ""; }  // inherited prune, nothing selected - vanish entirely
        return "<tr class='collapsed'><td class='slot' onclick=\"toggleCollapsed('slot','" +
            escJs(slotKey) + "')\">" + escHtml(slot) + "</td><td>&nbsp;</td></tr>";
    }

    let trClass = directlyCollapsed ? " class='collapsed'" : "";
    let html    = "<tr" + trClass + "><td class='slot' onclick=\"toggleCollapsed('slot','" +
        escJs(slotKey) + "')\">" + escHtml(slot) + "</td><td class='options'>";

    let isAugment  = slot.substring(0, 3) === "Aug";
    let firstShown = true;
    for (let color of Object.keys(colorMap)) {
        let colorHtml = renderColorGroup(item, slot, color, colorMap[color], isAugment, pruneMode, idx);
        if (!colorHtml) { continue; }
        if (!firstShown && isAugment) { html += "<br />"; }
        html += colorHtml;
        firstShown = false;
    }

    html += "</td></tr>";
    return html;
}

function renderColorGroup(item, slot, color, enchNames, isAugment, pruneModeInherited, idx) {
    let slotKey           = item + "|" + slot;
    let colorKey          = slotKey + "|" + color;
    let directlyCollapsed = isAugment && charData.collapsed.color.has(colorKey);
    let pruneMode         = pruneModeInherited || directlyCollapsed;
    let hasSelection      = colorHasSelection(item, slot, color);

    if (pruneMode && !hasSelection) {
        if (!directlyCollapsed) { return ""; }  // inherited prune, nothing selected - vanish entirely
        return "<div class='color collapsed' onclick=\"toggleCollapsed('color','" + escJs(colorKey) +
            "')\">&nbsp;" + escHtml(color) + "&nbsp;</div>&nbsp;";
    }

    let html = "";
    if (isAugment) {
        let collapsedClass = directlyCollapsed ? " collapsed" : "";
        html += "<div class='color" + collapsedClass + "' onclick=\"toggleCollapsed('color','" +
            escJs(colorKey) + "')\">&nbsp;" + escHtml(color) + ":</div>&nbsp;";
    }

    let occupant = getOccupant(item, slot);
    html += "<div class='ench'> ";
    for (let enchName of enchNames) {
        let isSelectedHere = !!occupant && occupant.enchName === enchName && occupant.color === color;
        if (pruneMode && !isSelectedHere) { continue; }
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

let AUGMENT_SLOT_CAP = 7;

// Combo augment colors - a single slot, single selection, but candidates drawn from more than one
//   real color pool. Cannith rendering needs none of this: its augment slots are "universal" in
//   the source data already (every color shown together), this only matters for a custom item's
//   slot, which is deliberately restricted to what a real named item's slot would actually take.
let AUGMENT_COMBO_COLORS = {
    "Green": ["Blue", "Yellow"],
    "Orange": ["Red", "Yellow"],
    "Purple": ["Red", "Blue"]
};

let WEAPON_CATEGORIES = ["Melee1", "Melee2", "Ranged"];

function realColorsForSlot(slotColor) {
    // Colorless is special in both directions: a Colorless slot accepts ONLY colorless augments,
    //   but every other slot additionally accepts colorless on top of whatever else it takes
    //   (colorless augments fit any slot color).
    let colors = (AUGMENT_COMBO_COLORS[slotColor] || [slotColor]).slice();
    if (slotColor !== "Colorless" && colors.indexOf("Colorless") === -1) { colors.push("Colorless"); }
    return colors;
}

function renderCustomItemBody(category, idx, pruneMode) {
    let custom = charData.customItems[category] || {name: "", augments: [], nextAugmentId: 1, description: ""};
    let item   = customItemKey(category);

    let html   = "<tr><td class='slot'>Name</td><td class='options'>" +
        "<input type='text' class='customItemName' value=\"" + escHtml(custom.name) +
        "\" onchange=\"handleCustomItemName(this,'" + escJs(category) + "')\" />" +
        getAddAugmentControlHtml(category) +
        "</td></tr>";

    custom.augments.forEach(function (aug, position) {
        html += renderCustomAugmentSlotRow(category, item, aug, position, pruneMode, idx);
    });

    html += renderInherentPicker(category, idx, pruneMode);
    html += renderCustomItemDescription(category, custom, pruneMode);

    return html;
}

function renderCustomAugmentSlotRow(category, item, aug, position, pruneModeInherited, idx) {
    let slot              = "Augment#" + aug.id;  // stable key - "Aug" prefix reuses getButton's
                                                   //   existing augment-vs-cannith min-level check.
    let displayLabel      = "Augment " + (position + 1);  // matches Cannith's plain "Augment 1"/"Augment 2"
                                                            //   label - the color already shows via the
                                                            //   color sub-header in column 2, so repeating
                                                            //   it here was redundant and made collapsed
                                                            //   rows taller than they needed to be.
    let slotKey           = item + "|" + slot;
    let realColors        = realColorsForSlot(aug.color);
    let directlyCollapsed = charData.collapsed.slot.has(slotKey);
    let pruneMode         = pruneModeInherited || directlyCollapsed;
    let hasSelection      = slotHasSelection(item, slot);

    let removeControl = "<span class='removeAugment' title='Remove this augment slot' onclick=\"handleRemoveCustomAugment('" +
        escJs(category) + "'," + aug.id + ")\">&#10005;</span>";
    let labelHtml = "<span onclick=\"toggleCollapsed('slot','" + escJs(slotKey) + "')\">" +
        escHtml(displayLabel) + "</span> " + removeControl;

    if (pruneMode && !hasSelection) {
        if (!directlyCollapsed) { return ""; }  // inherited prune, nothing selected - vanish entirely
        return "<tr class='collapsed'><td class='slot'>" + labelHtml + "</td><td>&nbsp;</td></tr>";
    }

    let trClass = directlyCollapsed ? " class='collapsed'" : "";
    let html    = "<tr" + trClass + "><td class='slot'>" + labelHtml + "</td><td class='options'>";

    let firstShown = true;
    for (let realColor of realColors) {
        let colorHtml = renderCustomColorGroup(item, slot, realColor, realColors.length > 1, pruneMode, idx);
        if (!colorHtml) { continue; }
        if (!firstShown) { html += "<br />"; }
        html += colorHtml;
        firstShown = false;
    }

    html += "</td></tr>";
    return html;
}

function renderCustomColorGroup(item, slot, realColor, showColorHeader, pruneModeInherited, idx) {
    let slotKey           = item + "|" + slot;
    let colorKey          = slotKey + "|" + realColor;
    let directlyCollapsed = charData.collapsed.color.has(colorKey);
    let pruneMode         = pruneModeInherited || directlyCollapsed;
    let hasSelection      = colorHasSelection(item, slot, realColor);

    if (pruneMode && !hasSelection) {
        if (!directlyCollapsed) { return ""; }  // inherited prune, nothing selected - vanish entirely
        return "<div class='color collapsed' onclick=\"toggleCollapsed('color','" + escJs(colorKey) +
            "')\">&nbsp;" + escHtml(realColor) + "&nbsp;</div>&nbsp;";
    }

    let html = "";
    if (showColorHeader) {
        let collapsedClass = directlyCollapsed ? " collapsed" : "";
        html += "<div class='color" + collapsedClass + "' onclick=\"toggleCollapsed('color','" +
            escJs(colorKey) + "')\">&nbsp;" + escHtml(realColor) + ":</div>&nbsp;";
    }

    let occupant = getOccupant(item, slot);
    html += "<div class='ench'> ";
    for (let enchName of (charData.augmentOptionsByColor[realColor] || [])) {
        let isSelectedHere = !!occupant && occupant.enchName === enchName && occupant.color === realColor;
        if (pruneMode && !isSelectedHere) { continue; }
        html += getButton(item, slot, realColor, enchName, idx);
    }
    html += "</div>";
    return html;
}

function renderCustomItemDescription(category, custom, pruneMode) {
    if (pruneMode && !custom.description) { return ""; }  // disappears if empty while collapsed
    let disabledAttr = pruneMode ? " disabled" : "";
    return "<tr><td class='slot'>Description</td><td class='options'>" +
        "<textarea class='customItemDescription' onchange=\"handleCustomItemDescription(this,'" +
        escJs(category) + "')\"" + disabledAttr + ">" + escHtml(custom.description || "") + "</textarea></td></tr>";
}

function handleCustomItemDescription(textarea, category) {
    charData.customItems[category].description = textarea.value;
}

function renderInherentPicker(category, idx, pruneModeInherited) {
    // Deliberately unscoped by category (see PIVOT note) - a named item's whole appeal can be an
    //   effect normal Cannith crafting could never produce for that category. Deliberately flat and
    //   alphabetical rather than grouped/filtered - relies on the browser's own search, same as the
    //   existing ~1500-row Cannith lists already do.
    let item              = customItemKey(category);
    let slotKey           = item + "|InherentEffects";
    let directlyCollapsed = charData.collapsed.slot.has(slotKey);
    let pruneMode         = pruneModeInherited || directlyCollapsed;
    let hasSelection      = inherentHasSelection(category, item);

    if (pruneMode && !hasSelection) {
        if (!directlyCollapsed) { return ""; }  // inherited prune, nothing selected - vanish entirely
        return "<tr class='collapsed'><td class='slot' onclick=\"toggleCollapsed('slot','" +
            escJs(slotKey) + "')\">Inherent Effects</td><td>&nbsp;</td></tr>";
    }

    let trClass = directlyCollapsed ? " class='collapsed'" : "";
    let html = "<tr" + trClass + "><td class='slot' onclick=\"toggleCollapsed('slot','" + escJs(slotKey) +
        "')\">Inherent Effects</td><td class='options'><div class='ench'> ";
    let selectedSet = (charData.selections.inherent[category] || {})[item];
    for (let enchName of Object.keys(charData.enchantments).sort()) {
        let isSelected = !!selectedSet && selectedSet.has(enchName);
        if (pruneMode && !isSelected) { continue; }
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
        charData.customItems[category] = {name: "", augments: [], nextAugmentId: 1, description: ""};
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
            nextAugmentId: saved.nextAugmentId || 1,
            description: saved.description || ""
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
