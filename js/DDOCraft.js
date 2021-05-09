// Load DDO item options
// WARNING: Requires JSON file ordered by item then slot.
let itemOptionsRequest = new XMLHttpRequest();
itemOptionsRequest.onreadystatechange = function () {
    if (this.readyState === 4 && this.status === 200) {
        itemOptions = JSON.parse(this.responseText);
    }
};

itemOptionsRequest.open("GET", "../data/equipDDO_vCompiledOptions.json", false);
itemOptionsRequest.send();

let currentItem;
let currentSlot;
let currentAugmentColor;
let theHTML = "";
let addHTML;
let newSlot = false;

for (let i = 0; i < itemOptions.length; i++) {
    addHTML = "";

    // If we're on a new type of item, label it and start a new paragraph.
    if (itemOptions[i].itemOptionItem !== currentItem) {
        currentItem = itemOptions[i].itemOptionItem;
        currentSlot = "";
        currentAugmentColor = "";
        addHTML = addHTML + "<h6>" + currentItem + ":</h6> <div class='item'> ";
    }

    // If we're on a new slot in an item, label it.
    if (itemOptions[i].itemOptionSlot !== currentSlot) {
        currentSlot = itemOptions[i].itemOptionSlot;
        newSlot = true;
        currentAugmentColor = "";
        addHTML = addHTML + "<div class='slot'> " + currentSlot + ": ";
    } else {
        newSlot = false;
    }

    // If the new slot is an augment slot, add structure to group the colors..
    if (newSlot && currentSlot.substring(0, 3) === "Aug") {
        addHTML = addHTML + "<div class='augment'> ";
    }

    // If we're dealing with a new augment slot color, label it.
    if (currentSlot.substring(0, 3) === "Aug" && itemOptions[i].AugmentColor !== currentAugmentColor) {
        currentAugmentColor = itemOptions[i].AugmentColor;
        addHTML = addHTML + "<div class='color'> " + currentAugmentColor + ": ";
    }

    // If we're dealing with a new set of enchantments (in new color or slot), label it.
    if (i === 0 ||  (
        (itemOptions[i].AugmentColor !== itemOptions[i-1].AugmentColor) ||
        (itemOptions[i].itemOptionSlot !== itemOptions[i-1].itemOptionSlot)
    )) {        addHTML = addHTML + "<div class='ench'> ";
    }

    // Make a button for the current enchantment option.
    addHTML = addHTML + "<button>" + itemOptions[i].enchName + "</button> ";

    // If last enchantment of a set
    if (i < itemOptions.length - 1 && (
        (itemOptions[i].AugmentColor !== itemOptions[i+1].AugmentColor) ||
        (itemOptions[i].itemOptionSlot !== itemOptions[i+1].itemOptionSlot)
    )) {
        addHTML = addHTML + "</div> ";
    }

    // NOTE: Neither augments nor augment colors can have the last enchantments of an item or the whole thing.

    // If last enchantment of an augment color
    if (i < itemOptions.length - 1 &&  currentSlot.substring(0, 3) === "Aug" && itemOptions[i].AugmentColor !== itemOptions[i+1].AugmentColor) {
        addHTML = addHTML + "</div>  <!-- Last of augment color --> ";
    }


    // ***** NOT Detecting last of augment slot when the next is a second augment slot. *****
    // ***** NOT Detecting last of augment slot when the next is a second augment slot. *****
    // ***** NOT Detecting last of augment slot when the next is a second augment slot. *****
    // ***** NOT Detecting last of augment slot when the next is a second augment slot. *****
    // If last enchantment of an augment slot.
    // If so, current color will always be something. Next will not.
    if (i < itemOptions.length - 1 &&  currentSlot.substring(0, 3) === "Aug" && currentSlot !== itemOptions[i+1].itemOptionSlot) {
        addHTML = addHTML + "</div> <!-- Last of augment slot --> ";
    }

    // If last enchantment of an item slot (need even if last of augment also was true).
    // Last of slot will always be "Extra" and last of last will be from item type "Orb".
    if (i < itemOptions.length - 1 &&  itemOptions[i].itemOptionSlot !== itemOptions[i+1].itemOptionSlot) {
        addHTML = addHTML + "</div>  <!-- Last of item slot --> ";
    }

    // If last of the whole item.
    if (i < itemOptions.length - 1 &&  itemOptions[i].itemOptionItem !== itemOptions[i+1].itemOptionItem) {
        addHTML = addHTML + "</div> ";
    }

    // If last item of entire set of options.
    if (i === itemOptions.length - 1)
    {
        // TO DO: Handle 3 of the below closing div tags by improving the tests above so that they
        //   have already been placed by the time we get here.
        addHTML = addHTML + "</div> </div> </div> ";
    }


    // Add this row to the HTML we are about to output.
    theHTML = theHTML + addHTML;
}

console.log(theHTML);
document.getElementById("theShiz").innerHTML = theHTML;


    // itemOptionItem,
    // itemOptionSlot,
    // enchName,
    // enchEffectType,
    // enchDesc,
    // AugmentColor,
    // enchSupercededBy,
    // itemOptionSortOrder,
    // enchSortOrder




