let itemOptions;
initialize();

function initialize() {
    loadEnchantmentOptions();
    initEnchStates();
    renderScreen();
}

function loadEnchantmentOptions() {
    // WARNING: Requires JSON file ordered by item then slot.
    let itemOptionsRequest                = new XMLHttpRequest();
    itemOptionsRequest.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            itemOptions = JSON.parse(this.responseText);
        }
    };

    // TO DO: Consider convert to asynchronous? Is there something we can do while it loads?
    itemOptionsRequest.open("GET", "../data/equipDDO_vCompiledOptions.json", false);
    itemOptionsRequest.send();
}

function initEnchStates() {
    let current, next;
    let last = new ItemOption("", "", "", "", "", "");
    for (let i = 0; i < itemOptions.length; i++) {
        current = itemOptions[i];
        if (i > 0) { last = itemOptions[i - 1]; }
        if (i < itemOptions.length - 1) { next = itemOptions[i + 1]; }
        else { next = new ItemOption("", "", "", "", "", ""); }

        current.enchState                = new EnchState();
        current.enchState.newItemType    = current.itemOptionItem !== last.itemOptionItem;
        current.enchState.newSlot        = current.itemOptionSlot !== last.itemOptionSlot;
        current.enchState.isAugmentSlot  = current.itemOptionSlot.substring(0, 3) === "Aug";
        current.enchState.newAugSlot     = current.enchState.newSlot && current.enchState.isAugmentSlot;
        current.enchState.newAugColor    = current.enchState.isAugmentSlot && current.AugmentColor !== last.AugmentColor;
        current.enchState.newEnchSet     = current.enchState.newAugColor || current.enchState.newSlot;
        current.enchState.lastOfSet      = current.AugmentColor !== next.AugmentColor || current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfColor    = current.enchState.isAugmentSlot && current.AugmentColor !== next.AugmentColor;
        current.enchState.lastOfAugSlot  = current.enchState.isAugmentSlot && current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfSlot     = current.itemOptionSlot !== next.itemOptionSlot;
        current.enchState.lastOfItemType = current.itemOptionItem !== next.itemOptionItem;
        current.enchState.lastOfAll      = i === itemOptions.length -1;

        // selected, offBecauseOf
        // TBD
    }
}

function renderScreen() {
    let addHTML = "";
    for (let i = 0; i < itemOptions.length; i++) {
        if (itemOptions[i].enchState.newItemType) {
            addHTML += "<h6>" + itemOptions[i].itemOptionItem + ":</h6> <div class='item'> "; }
        if (itemOptions[i].enchState.newSlot) {
            addHTML += "<div class='slot'> " + itemOptions[i].itemOptionSlot + ": "; }
        if (itemOptions[i].enchState.newAugSlot) {
            addHTML += "<div class='augment'> "; }
        if (itemOptions[i].enchState.newAugColor) {
            addHTML += "<div class='color'> " + itemOptions[i].AugmentColor + ": "; }
        if (itemOptions[i].enchState.newEnchSet) {
            addHTML += "<div class='ench'> "; }

        addHTML += "<button>" + itemOptions[i].enchName + "</button> ";

        if (itemOptions[i].enchState.lastOfSet) {
            addHTML += "</div> "; }
        if (itemOptions[i].enchState.lastOfColor) {
            addHTML += "</div>  <!-- Last of augment color --> "; }
        if (itemOptions[i].enchState.lastOfAugSlot) {
            addHTML += "</div> <!-- Last of augment slot --> "; }
        if (itemOptions[i].enchState.lastOfSlot) {
            addHTML += "</div>  <!-- Last of item slot --> "; }
        if (itemOptions[i].enchState.lastOfItemType) {
            addHTML += "</div> "; }
        if (itemOptions[i].enchState.lastOfAll) {
            addHTML += "</div> "; }
    }

    document.getElementById("theShiz").innerHTML = addHTML;
}


function ItemOption(itemOptionItem, itemOptionSlot, enchName, enchEffectType, enchDesc, AugmentColor,
                    enchSupercededBy, itemOptionSortOrder, enchSortOrder, enchState) {
    this.itemOptionItem      = itemOptionItem;
    this.itemOptionSlot      = itemOptionSlot;
    this.enchName            = enchName;
    this.enchEffectType      = enchEffectType;
    this.enchDesc            = enchDesc;
    this.AugmentColor        = AugmentColor;
    this.enchSupercededBy    = enchSupercededBy;
    this.itemOptionSortOrder = itemOptionSortOrder;
    this.enchSortOrder       = enchSortOrder;
    this.enchState           = enchState;
}


function EnchState(newItemType, newSlot, newAugSlot, newAugColor, newEnchSet, lastOfSet,
                   lastOfColor, lastOfAugSlot, lastOfSlot, lastOfItemType, lastOfAll,
                   selected, offBecauseOf, isAugmentSlot) {
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

    this.selected = selected;
    this.offBy    = offBecauseOf;

    this.isAugmentSlot = isAugmentSlot;
}




