let collapseState = {};
let itemOptions = {};
let enchFilter = {};
let reportOut     = "";
let charData = { version: 1.1, dirty: false };
charData.collapseState = collapseState;
charData.itemOptions = itemOptions;
charData.enchFilter = enchFilter;

initialize();

function initialize() {
    loadEnchantmentOptions();
    initEnchStates();
    renderScreen();
}


function handleCollapse() {
    let items = document.getElementsByClassName("itemheader");
    for (let i = 0; i < items.length; i++) {
        if (typeof charData.collapseState[items[i].innerHTML] === 'undefined') { charData.collapseState[items[i].innerHTML] = true; }
        items[i].addEventListener("click", function () {
            charData.collapseState[items[i].innerHTML] = !charData.collapseState[items[i].innerHTML];
            handleCollapseState(this);
        });
        handleCollapseState(items[i]);
    }
    console.log(charData.collapseState);
}

function handleCollapseState(element) {
    var content = element.nextElementSibling;
    if (charData.collapseState[element.innerHTML]) {
        element.classList.remove("active");
        content.style.display = "none";
    } else {
        element.classList.add("active");
        content.style.display = "block";
    }
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
    itemOptionsRequest.open("GET", "ddoCraft.json", false);
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
        current.enchState.selected       = false;
        current.enchState.handledBy      = -1;
        current.enchState.blocked        = false;
        current.enchState.newItemType    = current.itemOptionItem !== last.itemOptionItem;
        current.enchState.newSlot        = current.itemOptionSlot !== last.itemOptionSlot;
        current.enchState.isAugmentSlot  = current.itemOptionSlot.substring(0, 3) === "Aug";
        current.enchState.newAugSlot     = current.enchState.newSlot && current.enchState.isAugmentSlot;
        current.enchState.newAugColor    = current.enchState.isAugmentSlot && current.augmentColor !== last.augmentColor;
        current.enchState.newEnchSet     = current.enchState.newAugColor || current.enchState.newSlot;
        current.enchState.lastOfSet      = current.augmentColor !== next.augmentColor || current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfColor    = current.enchState.isAugmentSlot && current.augmentColor !== next.augmentColor;
        current.enchState.lastOfAugSlot  = current.enchState.isAugmentSlot && current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfSlot     = current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfItemType = current.itemOptionItem !== next.itemOptionItem;
        current.enchState.lastOfAll      = i === charData.itemOptions.length - 1;

        // selected, offBecauseOf
        // TBD
    }
}

function renderScreen() {
    let html = "";
    for (let i = 0; i < charData.itemOptions.length; i++) {
        if (charData.itemOptions[i].enchState.newItemType) {
            html += "<h6 class='itemheader'>" + charData.itemOptions[i].itemOptionItem + ":</h6> <div class='item'> ";
        }
        if (charData.itemOptions[i].enchState.newSlot) {
            html += "<div class='slot'> " + charData.itemOptions[i].itemOptionSlot + ": ";
        }
        if (charData.itemOptions[i].enchState.newAugSlot) {
            html += "<div class='augment'> ";
        }
        if (charData.itemOptions[i].enchState.newAugColor) {
            html += "<div class='color'> " + charData.itemOptions[i].augmentColor + ": ";
        }
        if (charData.itemOptions[i].enchState.newEnchSet) {
            html += "<div class='ench'> ";
        }

        html += getButton(i);

        if (charData.itemOptions[i].enchState.lastOfSet) {
            html += "</div> ";
        }
        if (charData.itemOptions[i].enchState.lastOfColor) {
            html += "</div>  <!-- Last of augment color --> ";
        }
        if (charData.itemOptions[i].enchState.lastOfAugSlot) {
            html += "</div> <!-- Last of augment slot --> ";
        }
        if (charData.itemOptions[i].enchState.lastOfSlot) {
            html += "</div>  <!-- Last of item slot --> ";
        }
        if (charData.itemOptions[i].enchState.lastOfItemType) {
            html += "</div> ";
        }
        if (charData.itemOptions[i].enchState.lastOfAll) {
            html += "</div> ";
        }
    }

    // console.log(html);
    document.getElementById("enchantmentOptions").innerHTML = html;
    document.getElementById("result").innerHTML             = reportOut;
    handleCollapse();
}

function getButton(ench) {
    let btn;
    if (charData.itemOptions[ench].enchState.selected) {
        btn = "<button class='selected' ";
    } else if (charData.itemOptions[ench].enchState.handledBy > -1) {
        btn = "<button disabled class='handled' ";
    } else if (charData.itemOptions[ench].enchState.blocked) {
        btn = "<button disabled class='blocked' ";
    } else {
        btn = "<button ";
    }

    btn += "onclick='enchClick(" + ench + ")'>" + charData.itemOptions[ench].enchName + "</button> ";

    return btn;
}


function enchClick(ench) {
    charData.itemOptions[ench].enchState.selected = !charData.itemOptions[ench].enchState.selected;
    reportOut                            = "<h3>Result</h3>";

    for (let i = 0; i < charData.itemOptions.length; i++) {
        // console.log("enchNum: " + charData.itemOptions[i].enchNum + ": enchName: " + charData.itemOptions[i].enchName + ": effectType:
        // " + charData.itemOptions[i].enchEffectType + ": selected: " + charData.itemOptions[i].enchState.selected + ": offBy: " +
        // charData.itemOptions[i].enchState.offBy);
        if (i !== ench) {
            if (charData.itemOptions[ench].enchState.selected === true) {
                if (charData.itemOptions[i].enchEffectType === charData.itemOptions[ench].enchEffectType) {
                    charData.itemOptions[i].enchState.handledBy = ench;
                }
            } else {

                // console.log("enchClick offBy_i: " + i + " " + charData.itemOptions[i].enchState.offBy);
                // console.log("enchClick offBy_ench: " + ench + " " + charData.itemOptions[ench].enchState.offBy);
                if (charData.itemOptions[i].enchState.handledBy === ench) {
                    charData.itemOptions[i].enchState.handledBy = -1;
                }
            }

            // Regardless of whether we are selecting or deselecting, the blocked state odf other
            //   enchantments for this slot flips.
            if ((charData.itemOptions[i].itemOptionItem === charData.itemOptions[ench].itemOptionItem) &&
                (charData.itemOptions[i].itemOptionSlot === charData.itemOptions[ench].itemOptionSlot)) {
                charData.itemOptions[i].enchState.blocked = !charData.itemOptions[i].enchState.blocked;
            }
        }

        if (charData.itemOptions[i].enchState.selected) {
            reportOut += "<strong>" + charData.itemOptions[i].itemOptionItem + ": </strong><em>" +
                charData.itemOptions[i].itemOptionSlot + ": </em>";

            if (charData.itemOptions[i].enchState.isAugmentSlot) {
                reportOut += charData.itemOptions[i].augmentColor + ": ";
            }
            reportOut += "<strong>" + charData.itemOptions[i].enchName + "</strong> (" + charData.itemOptions[i].enchEffectType + ")</br>";
        }
    }

    renderScreen();
}


function ItemOption(itemOptionItem, itemOptionSlot, enchName, enchEffectType, enchDesc, augmentColor,
                    enchSupercededBy, itemOptionSortOrder, enchSortOrder, enchState, enchNum) {
    this.itemOptionItem      = itemOptionItem;
    this.itemOptionSlot      = itemOptionSlot;
    this.enchName            = enchName;
    this.enchEffectType      = enchEffectType;
    this.enchDesc         = enchDesc;
    this.augmentColor     = augmentColor;
    this.enchSupercededBy = enchSupercededBy;
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
    if(characterName.trim().length < 1) { characterName = "ddoCraft_build"; }
    downloadJSON(JSON.stringify(charData), characterName + ".json", 'text/plain')
}


function downloadJSON(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}


document.getElementById('loadFile').onchange = function() {
    var files = document.getElementById('loadFile').files;
    if (files.length <= 0) { return false; }

    var fr = new FileReader();
    fr.onload = function(e) {
        charData = JSON.parse(e.target.result);
        renderScreen();
    }
    fr.readAsText(files.item(0));
}
