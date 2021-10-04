// Author: J. Hawkins
// Copyright 2021. GNU General Public License v3.0
// Permissions of this strong copyleft license are conditioned on making available complete source code of
// licensed works and modifications, which include larger works using a licensed work, under the same license.
// Copyright and license notices must be preserved. Contributors provide an express grant of patent rights.

let dialogPreferences;
let buttonPreferences;
let buttonClosePreferences;
let dialogHelp;
let buttonHelp;
let buttonCloseHelp;
let dialogAbout;
let buttonAbout;
let buttonCloseAbout;

let charData = {version: 1.1, dirty: false, itemOptions: {}, enchFilter: { allEnch: true }, reportOut: ""};
initialize();

function initialize() {
    loadEnchantmentOptions();
    initEnchStates();
    initFilter();

    dialogPreferences = document.getElementById('preferences');
    buttonPreferences = document.getElementById("btnPreferences");
    buttonClosePreferences = document.getElementById("btnClosePreferences");
    dialogHelp = document.getElementById('help');
    buttonHelp = document.getElementById("btnHelp");
    buttonCloseHelp = document.getElementById("btnCloseHelp");
    dialogAbout = document.getElementById('about');
    buttonAbout = document.getElementById("btnAbout");
    buttonCloseAbout = document.getElementById("btnCloseAbout");

    renderScreen();
    showPreferences();
}

function loadEnchantmentOptions() {
    // WARNING: Requires JSON file ordered by item then slot.
    let itemOptionsRequest                = new XMLHttpRequest();
    itemOptionsRequest.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            charData.itemOptions = JSON.parse(this.responseText);
        }
    };

    // TO DO: Consider convert to asynchronous? Is there something we can do while it loads?
    itemOptionsRequest.open("GET", "ddocraft.json", false);
    itemOptionsRequest.send();
}

function initEnchStates() {
    let current, next;
    let last = new ItemOption("", "", "", "", "", "");
    for (let i = 0; i < charData.itemOptions.length; i++) {
        current = charData.itemOptions[i];
        if (i > 0) { last = charData.itemOptions[i - 1]; }
        if (i < charData.itemOptions.length - 1) { next = charData.itemOptions[i + 1]; } else { next = new ItemOption("", "", "", "", "", ""); }

        current.enchState                = new EnchState();
        current.enchNum                  = i;
        current.enchState.collapsed      = 0;   //  0 == Not. 1 == Color. 2 == slot. 3 == Item
        current.enchState.selected       = false;
        current.enchState.blocked        = false;
        current.enchState.handledBy      = -1;
        current.enchState.newItemType    = current.itemOptionItem !== last.itemOptionItem;
        current.enchState.newSlot        = current.itemOptionSlot !== last.itemOptionSlot;
        current.enchState.isAugmentSlot  = current.itemOptionSlot.substring(0, 3) === "Aug";
        current.enchState.newAugSlot     = current.enchState.newSlot && current.enchState.isAugmentSlot;

        // For newAugColor, it is a new color (instance) if the color is in a new augment slot, even if the
        //   actual color is the same.
        current.enchState.newAugColor    = current.enchState.isAugmentSlot && current.augmentColor !== last.augmentColor
                                            || current.enchState.isAugmentSlot && current.enchState.newAugSlot;

        current.enchState.newEnchSet     = current.enchState.newAugColor || current.enchState.newSlot;
        current.enchState.lastOfSet      = current.augmentColor !== next.augmentColor || current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfColor    = current.enchState.isAugmentSlot && current.augmentColor !== next.augmentColor;
        current.enchState.lastOfAugSlot  = current.enchState.isAugmentSlot && current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfSlot     = current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfItemType = current.itemOptionItem !== next.itemOptionItem;
        current.enchState.lastOfAll      = i === charData.itemOptions.length - 1;
    }
}

function initFilter() {
    charData.enchFilter['characterLevel'] = document.getElementById('characterLevel').value;
    charData.enchFilter['allEnch'] = document.getElementById('allEnch').checked;
    charData.enchFilter['basic'] = document.getElementById('basic').checked;
    charData.enchFilter['nonscaling'] = document.getElementById('nonscaling').checked;
    charData.enchFilter['forMeleeDmg'] = document.getElementById('forMeleeDmg').checked;
    charData.enchFilter['forRangedDmg'] = document.getElementById('forRangedDmg').checked;
    charData.enchFilter['forACDefence'] = document.getElementById('forACDefence').checked;
    charData.enchFilter['forResistDefence'] = document.getElementById('forResistDefence').checked;
    charData.enchFilter['forHitPoints'] = document.getElementById('forHitPoints').checked;
    charData.enchFilter['forBarbarian'] = document.getElementById('forBarbarian').checked;
    charData.enchFilter['forFighter'] = document.getElementById('forFighter').checked;
    charData.enchFilter['forPaladin'] = document.getElementById('forPaladin').checked;
    charData.enchFilter['forRanger'] = document.getElementById('forRanger').checked;
    charData.enchFilter['forAlchemist'] = document.getElementById('forAlchemist').checked;
    charData.enchFilter['forArtificer'] = document.getElementById('forArtificer').checked;
    charData.enchFilter['forBard'] = document.getElementById('forBard').checked;
    charData.enchFilter['forRogue'] = document.getElementById('forRogue').checked;
    charData.enchFilter['forMonk'] = document.getElementById('forMonk').checked;
    charData.enchFilter['forCleric'] = document.getElementById('forCleric').checked;
    charData.enchFilter['forDruid'] = document.getElementById('forDruid').checked;
    charData.enchFilter['forFavoredSoul'] = document.getElementById('forFavoredSoul').checked;
    charData.enchFilter['forSorcerer'] = document.getElementById('forSorcerer').checked;
    charData.enchFilter['forWarlock'] = document.getElementById('forWarlock').checked;
    charData.enchFilter['forWizard'] = document.getElementById('forWizard').checked;
}


// || charData.itemOptions[ench].enchCannithMinLevel < charData.enchFilter.characterLevel
// || charData.itemOptions[ench].enchAugmentMinLevel < charData.enchFilter.characterLevel


function renderScreen() {
    let html = "";
    for (let i = 0; i < charData.itemOptions.length; i++) {
        if (charData.itemOptions[i].enchState.newItemType) {
            if (charData.itemOptions[i].enchState.collapsed === 3) {
                html += "<table><caption class='itemheader collapsed' onclick='toggleCollapsed(" + i + ", 3)'>" +
                    charData.itemOptions[i].itemOptionItem + "</caption>";
                i = getLastOfItem(i);
                continue;
            } else {
                html += "<table><caption class='itemheader' onclick='toggleCollapsed(" + i + ", 3)'>" +
                    charData.itemOptions[i].itemOptionItem + " </caption>";
            }
        }

        if (charData.itemOptions[i].enchState.newSlot) {
            if (charData.itemOptions[i].enchState.collapsed === 2) {
                html += "<tr class='collapsed'><td class='slot' onclick='toggleCollapsed(" + i + ", 2)'>" + charData.itemOptions[i].itemOptionSlot + "<td>&nbsp;</td></tr>";
                i = getLastOfSlot(i);
                continue;
            } else {
                html += "<tr><td class='slot' onclick='toggleCollapsed(" + i + ", 2)'>" + charData.itemOptions[i].itemOptionSlot + "</td><td>";
            }
        }

//TEMP!!!  Before 20211003, this was commented out and everything worked.
        if (charData.itemOptions[i].enchState.newAugSlot) {
            html += "<div class='augment'> ";       // <--- Get rid of this?
        }

        if (charData.itemOptions[i].enchState.newAugColor) {
            if (charData.itemOptions[i].enchState.collapsed === 1) {
                html += " <div class='color collapsed' onclick='toggleCollapsed(" + i + ", 1)'>&nbsp;" + charData.itemOptions[i].augmentColor + "&nbsp;</div>&nbsp;";
                i = getLastOfColor(i);
                continue;
            } else {
                if (i > 1 && charData.itemOptions[i - 1].enchState.lastOfColor && !charData.itemOptions[i - 1].enchState.lastOfSlot) { html += "<br />" }
                html += " <div class='color' onclick='toggleCollapsed(" + i + ", 1)'>&nbsp;" + charData.itemOptions[i].augmentColor + ":</div>&nbsp;";
            }
        }

        if (charData.itemOptions[i].enchState.newEnchSet) {
            html += "<div class='ench'> ";
        }

        if (charData.itemOptions[i].enchState.collapsed) {
            continue;
        } else {
            if((!charData.itemOptions[i].enchState.isAugmentSlot && charData.enchFilter.characterLevel >= charData.itemOptions[i].enchCannithMinLevel)
                || charData.itemOptions[i].enchState.isAugmentSlot && charData.enchFilter.characterLevel >= charData.itemOptions[i].enchAugmentMinLevel) {
                html += getButton(i);
            }
        }

        if (charData.itemOptions[i].enchState.lastOfSet) {
            html += "</div><!-- Last of section -->";
        }


        if (charData.itemOptions[i].enchState.lastOfColor) {
// Before 20211003, this was commented out and everything worked.
            html += "</div><!-- Last of augment color -->";
        }
// TEMP!!!  Before 20211003, this was commented out and everything worked.
        if (charData.itemOptions[i].enchState.lastOfAugSlot) {
            html += "</div><!-- Last of augment slot -->";
        }

        if (charData.itemOptions[i].enchState.lastOfSlot) {
            html += "</td></tr><!-- Last of item slot -->";
        }

        if (charData.itemOptions[i].enchState.lastOfItemType) {
            html += "</table><!-- Last of item type -->";
        }

    }

    // html += "</table><!-- Last of everything -->";

    // console.log(html);
    document.getElementById("enchantmentOptions").innerHTML = html;
    document.getElementById("result").innerHTML             = charData.reportOut;
// handleCollapse();

    console.log(charData.enchFilter);
}

function getButton(ench) {
    let enchValue = getEnchFilterValue(ench);
    let btn;

    if (charData.itemOptions[ench].enchState.selected) {
        btn = "<button class='selected' title='" + charData.itemOptions[ench].enchDesc + "' ";
        enchValue = 1;  // Display all selected enchantments
    } else if (charData.itemOptions[ench].enchState.handledBy > -1) {
        btn = "<button disabled class='handled' ";
    } else if (charData.itemOptions[ench].enchState.blocked) {
        btn = "<button disabled class='blocked' ";
    } else if (enchValue > 1) {
        btn = "<button style='background-color: " + getHighlight(enchValue) + "; color: black;' ";
        btn += "title='" + charData.itemOptions[ench].enchDesc + "' ";
    } else {
        btn = "<button title='" + charData.itemOptions[ench].enchDesc + "' ";
    }

    btn += "onclick='enchClick(" + ench + ")'>" + charData.itemOptions[ench].enchName + "</button> ";

    if(enchValue < 1)
    { return ""; }
    else { return btn; }
}

function addTooltip(btn) {
    btn += "title='" + charData.itemOptions[ench].enchDesc + "' ";
    return btn;
}

function getHighlight(num) {
    // Set intensity of highlight color based on incoming value relative to max range of 20.
    // Base color is #444 (68, 68, 68).
    let midValue = 68;
    let maxVal = 32;
    let rAndGFactor = (255 - midValue) / maxVal;
    let bFactor = midValue / maxVal;

    let rAndG = (num * rAndGFactor) + midValue;
    let b = midValue - (num * bFactor);
    if(rAndG > 255) { rAndG = 255; }
    if(b < 0) { b = 0; }
    return rgb(rAndG, rAndG, b);
}

function rgb(r, g, b){
    return "rgb("+r+","+g+","+b+")";
}


function getEnchFilterValue(ench) {
    let enchValue = 0;
    if(charData.enchFilter.allEnch) { enchValue += 1; }
    if(charData.enchFilter.basic) { enchValue += charData.itemOptions[ench].basic; }
    if(charData.enchFilter.nonscaling) { enchValue += charData.itemOptions[ench].nonscaling; }
    if(charData.enchFilter.forMeleeDmg) { enchValue += charData.itemOptions[ench].forMeleeDmg; }
    if(charData.enchFilter.forRangedDmg) { enchValue += charData.itemOptions[ench].forRangedDmg; }
    if(charData.enchFilter.forACDefence) { enchValue += charData.itemOptions[ench].forACDefence; }
    if(charData.enchFilter.forResistDefence) { enchValue += charData.itemOptions[ench].forResistDefence; }
    if(charData.enchFilter.forHitPoints) { enchValue += charData.itemOptions[ench].forHitPoints; }
    if(charData.enchFilter.forAlchemist) { enchValue += charData.itemOptions[ench].forAlchemist; }
    if(charData.enchFilter.forArtificer) { enchValue += charData.itemOptions[ench].forArtificer; }
    if(charData.enchFilter.forBarbarian) { enchValue += charData.itemOptions[ench].forBarbarian; }
    if(charData.enchFilter.forBard) { enchValue += charData.itemOptions[ench].forBard; }
    if(charData.enchFilter.forCleric) { enchValue += charData.itemOptions[ench].forCleric; }
    if(charData.enchFilter.forDruid) { enchValue += charData.itemOptions[ench].forDruid; }
    if(charData.enchFilter.forFavoredSoul) { enchValue += charData.itemOptions[ench].forFavoredSoul; }
    if(charData.enchFilter.forFighter) { enchValue += charData.itemOptions[ench].forFighter; }
    if(charData.enchFilter.forMonk) { enchValue += charData.itemOptions[ench].forMonk; }
    if(charData.enchFilter.forPaladin) { enchValue += charData.itemOptions[ench].forPaladin; }
    if(charData.enchFilter.forRanger) { enchValue += charData.itemOptions[ench].forRanger; }
    if(charData.enchFilter.forRogue) { enchValue += charData.itemOptions[ench].forRogue; }
    if(charData.enchFilter.forSorcerer) { enchValue += charData.itemOptions[ench].forSorcerer; }
    if(charData.enchFilter.forWarlock) { enchValue += charData.itemOptions[ench].forWarlock; }
    if(charData.enchFilter.forWizard) { enchValue += charData.itemOptions[ench].forWizard; }

    // if(charData.itemOptions[ench].enchName == "Ability (Charisma)"
    //     || charData.itemOptions[ench].enchName == "Ability (Intelligence)"
    //     || charData.itemOptions[ench].enchName == "Ability (Constitution)") {
    //     console.log(charData.itemOptions[ench]);
    //     console.log(enchValue);
    // }

    return enchValue;
}


function enchClick(ench) {
    charData.itemOptions[ench].enchState.selected = !charData.itemOptions[ench].enchState.selected;
    charData.reportOut   = "<h3>Result</h3><table>";
    charData.reportOut  += "<table><tr><th>Item</th><th>Slot</th><th>Color</th><th>Enchantment</th><th>Effect</th></tr>";

    for (let i = 0; i < charData.itemOptions.length; i++) {
        if (i !== ench) {
            if (charData.itemOptions[ench].enchState.selected === true) {
                if (charData.itemOptions[i].enchEffectType === charData.itemOptions[ench].enchEffectType) {
                    charData.itemOptions[i].enchState.handledBy = ench;
                }
            } else {
                if (charData.itemOptions[i].enchState.handledBy === ench) {
                    charData.itemOptions[i].enchState.handledBy = -1;
                }
            }

            // Regardless of whether we are selecting or deselecting, the blocked state of other
            //   enchantments for this slot flips.
            if ((charData.itemOptions[i].itemOptionItem === charData.itemOptions[ench].itemOptionItem) &&
                (charData.itemOptions[i].itemOptionSlot === charData.itemOptions[ench].itemOptionSlot)) {
                charData.itemOptions[i].enchState.blocked = !charData.itemOptions[i].enchState.blocked;
            }
        }

        if (charData.itemOptions[i].enchState.selected) {
            charData.reportOut += "<tr><td>" + charData.itemOptions[i].itemOptionItem + "</td><td>" +
                charData.itemOptions[i].itemOptionSlot + "</td><td>";

            if (charData.itemOptions[i].enchState.isAugmentSlot) {
                charData.reportOut += charData.itemOptions[i].augmentColor + "</td><td>";
            } else {
                charData.reportOut += "</td><td>";
            }
            charData.reportOut += charData.itemOptions[i].enchName + "</td><td>" + charData.itemOptions[i].enchEffectType + "</td></tr>";
        }
    }

    charData.reportOut  += "</table>";
    renderScreen();
}

function toggleCollapsed(enchNum, level) {
    // Toggle everything at the same heirarchy level and lower.

    // TO DO: Use bitwise logic to allow multiple levels of collapse to be stored.
    //   i.e. Prevent collapse of item to wipe out collapse of augment slots.
    if (charData.itemOptions[enchNum].enchState.newItemType
        && charData.itemOptions[enchNum].enchState.collapsed !== 3
        && level === 3) {
        charData.itemOptions[enchNum].enchState.collapsed = 3;
    } else if (charData.itemOptions[enchNum].enchState.newSlot
        && charData.itemOptions[enchNum].enchState.collapsed < 2
        && level === 2) {
        charData.itemOptions[enchNum].enchState.collapsed = 2;
    } else if (charData.itemOptions[enchNum].enchState.newAugColor
        && charData.itemOptions[enchNum].enchState.collapsed < 1
        && level === 1) {
        charData.itemOptions[enchNum].enchState.collapsed = 1;
    } else {
        charData.itemOptions[enchNum].enchState.collapsed = 0;
    }

    renderScreen();
}

function getLastOfItem(ench) {
    while (!charData.itemOptions[ench].enchState.lastOfItemType) {
        ench++;
    }
    return ench;
}

function getLastOfSlot(ench) {
    while (!charData.itemOptions[ench].enchState.lastOfSlot) {
        ench++;
    }
    return ench;
}

function getLastOfColor(ench) {
    while (!charData.itemOptions[ench].enchState.lastOfColor) {
        ench++;
    }
    return ench;
}


function ItemOption(itemOptionItem, itemOptionSlot, enchName, enchEffectType, enchDesc, enchCannithMinLevel,
                    enchAugmentMinLevel, augmentColor, enchSupercededBy, itemOptionSortOrder, enchSortOrder,
                    enchState, enchNum) {
    this.itemOptionItem      = itemOptionItem;
    this.itemOptionSlot      = itemOptionSlot;
    this.enchName            = enchName;
    this.enchEffectType      = enchEffectType;
    this.enchDesc            = enchDesc;
    this.enchCannithMinLevel = enchCannithMinLevel;
    this.enchAugmentMinLevel = enchAugmentMinLevel;
    this.augmentColor        = augmentColor;
    this.enchSupercededBy    = enchSupercededBy;
    this.itemOptionSortOrder = itemOptionSortOrder;
    this.enchSortOrder       = enchSortOrder;
    this.enchState           = enchState;
    this.enchNum             = enchNum;
}


function EnchState(newItemType, newSlot, newAugSlot, newAugColor, newEnchSet,
                   lastOfSet, lastOfColor, lastOfAugSlot, lastOfSlot, lastOfItemType, lastOfAll,
                   selected, handledBy, blocked, important, isAugmentSlot) {
    this.newItemType = newItemType;
    this.newSlot     = newSlot;
    this.newAugSlot  = newAugSlot;
    this.newAugColor = newAugColor;
    this.newEnchSet  = newEnchSet;

    this.lastOfSet      = lastOfSet;
    this.lastOfColor    = lastOfColor;
    this.lastOfAugSlot  = lastOfAugSlot;
    this.lastOfSlot     = lastOfSlot;
    this.lastOfItemType = lastOfItemType;
    this.lastOfAll      = lastOfAll;

    this.selected  = selected;          // In use.
    this.handledBy = handledBy;         // Non-stacking enchant already handled.
    this.blocked   = blocked;           // Slot already in use, so unavailable
    this.important = important;

    this.isAugmentSlot = isAugmentSlot;
}


function handleSave() {
    let characterName = document.getElementById("characterName").value;
    if (characterName.trim().length < 1) { characterName = "ddoCraft_build"; }
    downloadJSON(JSON.stringify(charData), characterName + ".json", 'text/plain')
}

function zeroPad(num, digits){
    return String(num).padStart(digits, '0');
}

function getTimestamp() {
    let time = new Date();
    return time.getFullYear() + time.getMonth() + time.getDay() + '_' +
        time.getHours() + time.getMinutes() + time.getSeconds();
}


function downloadJSON(content, fileName, contentType) {
    let a      = document.createElement("a");
    let file   = new Blob([content], {type: contentType});
    a.href     = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}


document.getElementById('loadFile').onchange = function () {
    let files = document.getElementById('loadFile').files;
    if (files.length <= 0) { return false; }

    document.getElementById('characterName').value = String(files[0].name).slice(0, -5);

    let fr    = new FileReader();
    fr.onload = function (e) {
        charData = JSON.parse(e.target.result);
        renderScreen();
    }
    fr.readAsText(files.item(0));
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
    renderScreen();
}

function handleFilterLevel() {
    charData.enchFilter.characterLevel = document.getElementById("characterLevel").value;
    renderScreen();
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


