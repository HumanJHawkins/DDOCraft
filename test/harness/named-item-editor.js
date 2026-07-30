'use strict';
// Verifies the 2026-07-30 Named Item editor revamp: dirty tracking (blank/loaded/edited/saved),
// the Save button's disabled state (always labeled "Save"), the name+minLevel setup gate, the
// rename-vs-fresh-start combo box behavior, the dirty-aware Save/Discard/Cancel guard on both
// switching library items and switching back to Cannith, the overwrite confirmation, category
// scoping, and the Delete button. Run with: node test/harness/named-item-editor.js

const { loadPage } = require('./dom-stub');

let failures = 0;
function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log((pass ? 'PASS' : 'FAIL') + ' - ' + label +
    (pass ? '' : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`));
}

const catalogFixture = [{
  enchName: 'Test Enchant', enchEffectType: 'typeA', enchDesc: 'desc', enchSupercededBy: null,
  enchCannithMinLevel: 1, enchAugmentMinLevel: 1, allEnch: true, basic: true, nonscaling: false,
  forMeleeDmg: false, forRangedDmg: false, forACDefence: false, forResistDefence: false, forHitPoints: false,
  itemOptionCategory: null, itemOptionItem: null, itemOptionSlot: null, augmentColor: null
}];

let confirmScript = [];
let savedPayloads = [];
let deleteCalls = [];

// confirmReturns indexes by page.calls.confirm.length, which accumulates for the whole page's
// lifetime - truncate it whenever a sub-test wants its own confirmScript to count from 0 again.
// Still used for the couple of spots that still use a real native confirm() (handleSaveNamedItem's
// own overwrite check) - the three-way Save/Discard/Cancel guards now use the real modal instead
// (see clickModal() below), after Jeff reported the old chained-confirm() version as confusing.
function setConfirmScript(script) {
  confirmScript = script;
  page.calls.confirm.length = 0;
}

function clickModal(choice) {
  page.document.getElementById('saveDiscardCancel' + choice).click();
}

const page = loadPage({
  routes: {
    '/api/catalog': () => JSON.stringify(catalogFixture),
    '/api/character-classes': () => '[]',
    '/api/named-items?userId=1': () => JSON.stringify([{
      namedItemId: 1, category: 'Melee1', itemName: 'Tourney Armor',
      itemData: {
        name: 'Tourney Armor', minLevel: 20, augments: [{ id: 1, color: 'Red' }], nextAugmentId: 2,
        description: '', inherentSelections: []
      }
    }]),
  },
  confirmReturns: (msg, i) => (confirmScript[i] !== undefined ? confirmScript[i] : true),
  fetch: (url, options) => {
    if (options && options.method === 'DELETE') {
      deleteCalls.push(url);
      return Promise.resolve({ ok: true, status: 204 });
    }
    savedPayloads.push(JSON.parse(options.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ namedItemId: 2 }) });
  },
  // allNamedItems is reassigned (not just mutated) in several places (loadNamedItems, save, delete),
  // so a plain `global.__x = allNamedItems;` snapshot at eval time would go stale - expose a live
  // accessor instead.
  exposeSrc: 'global.__c = charData; global.__getNamedItems = function () { return allNamedItems; };',
});

page.document.getElementById('characterLevel').value = '20';
page.global.__c.saveFile.charLevel = 20;

async function runAsyncChecks() {
  // --- Fresh category: blank baseline, needs setup, Save disabled but always labeled "Save" ---
  page.global.applyCategoryModeSwitch('Melee1', true);
  check('fresh custom item is not dirty', page.global.isNamedItemDirty('Melee1'), false);
  check('fresh custom item needs setup', page.global.namedItemNeedsSetup('Melee1'), true);
  check('Save button disabled when clean, always labeled "Save"',
    page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('disabled') > -1 &&
    page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('>Save<') > -1, true);

  // --- Typing a name (still no minLevel): dirty, still needs setup ---
  page.global.__c.customItems.Melee1.name = 'Brand New Item';
  check('typed name alone is dirty', page.global.isNamedItemDirty('Melee1'), true);
  check('still needs setup without minLevel', page.global.namedItemNeedsSetup('Melee1'), true);

  // Fill minLevel too - setup unlocks
  page.global.__c.customItems.Melee1.minLevel = 15;
  check('setup unlocked once name+minLevel both set', page.global.namedItemNeedsSetup('Melee1'), false);
  check('Save button enabled once dirty, still labeled "Save"',
    page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('disabled') === -1 &&
    page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('>Save<') > -1, true);

  // --- handleCustomItemName: switching to an existing library item while CLEAN switches easily ---
  page.global.__c.customItems.Melee1 = { name: '', augments: [], nextAugmentId: 1, description: '', minLevel: '' };
  page.global.markNamedItemSaved('Melee1'); // re-baseline clean at blank
  setConfirmScript([]); // no confirm should fire at all
  page.global.handleCustomItemName({ value: 'Tourney Armor' }, 'Melee1');
  check('switching to a library item while clean needs no confirm', page.calls.confirm.length, 0);
  check('loaded library item is clean', page.global.isNamedItemDirty('Melee1'), false);
  check('loaded library item name', page.global.__c.customItems.Melee1.name, 'Tourney Armor');
  check('loaded library item augment SLOT present', page.global.__c.customItems.Melee1.augments.length, 1);
  check('augment slot has no selection (library never saves those)',
    page.global.__c.selections.positional['custom:Melee1'], undefined);

  // --- Editing after load makes it dirty again ---
  page.global.__c.customItems.Melee1.description = 'edited after load';
  check('editing a loaded item makes it dirty', page.global.isNamedItemDirty('Melee1'), true);

  // --- handleCustomItemName: renaming a DIRTY item to an unmatched name preserves its data ---
  page.global.handleCustomItemName({ value: 'Tourney Armor (renamed mid-edit)' }, 'Melee1');
  check('rename mid-edit keeps augments (not wiped)', page.global.__c.customItems.Melee1.augments.length, 1);
  check('rename mid-edit keeps description', page.global.__c.customItems.Melee1.description, 'edited after load');

  // --- handleCustomItemName: switching a DIRTY item to another library item - Cancel (via the modal) ---
  page.global.handleCustomItemName({ value: 'Tourney Armor' }, 'Melee1');
  check('modal actually opened', page.document.getElementById('saveDiscardCancel').style.display, 'block');
  check('modal message names the item', page.document.getElementById('saveDiscardCancelMessage').textContent
    .indexOf('Tourney Armor (renamed mid-edit)') > -1, true);
  clickModal('Cancel');
  check('modal closed after a choice', page.document.getElementById('saveDiscardCancel').style.display, 'none');
  check('Cancel path: name reverted', page.global.__c.customItems.Melee1.name, 'Tourney Armor (renamed mid-edit)');
  check('Cancel path: still dirty, data untouched', page.global.__c.customItems.Melee1.description, 'edited after load');

  // --- handleCustomItemName: switching a DIRTY item to another library item - Discard (via the modal) ---
  page.global.handleCustomItemName({ value: 'Tourney Armor' }, 'Melee1');
  clickModal('Discard');
  check('Discard path: switched to the library item', page.global.__c.customItems.Melee1.name, 'Tourney Armor');
  check('Discard path: clean after switching (matches library)', page.global.isNamedItemDirty('Melee1'), false);
  check('Discard path: did not POST', savedPayloads.length, 0);

  // --- handleCustomItemName: switching a CLEAN loaded item to a new unmatched name wipes it ---
  check('clean before blank-switch test', page.global.isNamedItemDirty('Melee1'), false);
  setConfirmScript([]);
  page.global.handleCustomItemName({ value: 'A Totally New Item' }, 'Melee1');
  check('no confirm needed for an unmatched name', page.calls.confirm.length, 0);
  check('switching a clean item to a new name wipes augments', page.global.__c.customItems.Melee1.augments.length, 0);
  check('switching a clean item to a new name wipes description', page.global.__c.customItems.Melee1.description, '');
  check('switching a clean item to a new name keeps the typed name', page.global.__c.customItems.Melee1.name, 'A Totally New Item');

  // --- handleCustomItemName: switching a DIRTY item to another library item - Save ---
  // Current name ('Some Other Name') isn't itself in the library, so saving it hits no
  //   overwrite-confirm of its own - just the one "Save before switching?" confirm.
  page.global.__c.customItems.Melee1.name = 'Some Other Name';
  page.global.__c.customItems.Melee1.minLevel = 20;
  page.global.markNamedItemSaved('Melee1');
  page.global.__c.customItems.Melee1.description = 'dirty before Save-switch';
  check('dirty before Save-switch test', page.global.isNamedItemDirty('Melee1'), true);
  savedPayloads = [];
  page.global.handleCustomItemName({ value: 'Tourney Armor' }, 'Melee1');
  clickModal('Save'); // Save the current one under its own name (no overwrite-confirm - name is new)
  await new Promise((r) => setTimeout(r, 20));
  check('Save-switch: POSTed under the OLD name first', savedPayloads.length, 1);
  check('Save-switch: POST saved the old name, not the new one', savedPayloads[0].itemName, 'Some Other Name');
  check('Save-switch: switched to the new item after saving', page.global.__c.customItems.Melee1.name, 'Tourney Armor');

  // --- handleSaveNamedItem: overwrite confirmation ---
  page.global.applyCategoryModeSwitch('Melee1', true);
  page.global.__c.customItems.Melee1.name = 'Tourney Armor';
  page.global.__c.customItems.Melee1.minLevel = 20;
  setConfirmScript([false]); // decline the overwrite confirm
  savedPayloads = [];
  page.global.handleSaveNamedItem(null, 'Melee1');
  check('declining overwrite confirm does not POST', savedPayloads.length, 0);

  setConfirmScript([true]); // accept the overwrite confirm
  page.global.handleSaveNamedItem(null, 'Melee1');
  await new Promise((r) => setTimeout(r, 20));
  check('accepting overwrite confirm POSTs', savedPayloads.length, 1);
  check('POST payload itemName', savedPayloads[0].itemName, 'Tourney Armor');
  check('POST payload category', savedPayloads[0].category, 'Melee1');
  check('item is clean immediately after save', page.global.isNamedItemDirty('Melee1'), false);

  // --- handleCategoryModeToggle: Save/Discard/Cancel chain when switching away from a dirty item ---
  page.global.__c.customItems.Melee1.description = 'dirty again for toggle test';
  check('dirty before toggle-away test', page.global.isNamedItemDirty('Melee1'), true);

  // Cancel via the modal - stays in custom mode
  page.global.handleCategoryModeToggle({ checked: false }, 'Melee1');
  clickModal('Cancel');
  check('Cancel path: categoryMode still custom', page.global.__c.categoryMode.Melee1, 'custom');

  // Discard via the modal - switches to cannith, no POST
  savedPayloads = [];
  page.global.handleCategoryModeToggle({ checked: false }, 'Melee1');
  clickModal('Discard');
  check('Discard path: categoryMode reverted to cannith', page.global.__c.categoryMode.Melee1, 'cannith');
  check('Discard path: no POST made', savedPayloads.length, 0);

  // Reset back to custom+dirty for the Save path
  page.global.applyCategoryModeSwitch('Melee1', true);
  page.global.__c.customItems.Melee1.name = 'Tourney Armor';
  page.global.__c.customItems.Melee1.minLevel = 20;
  page.global.__c.customItems.Melee1.description = 'dirty once more';
  check('dirty before Save-path toggle test', page.global.isNamedItemDirty('Melee1'), true);

  // Save via the modal, then accept handleSaveNamedItem's own (still native-confirm) overwrite check
  setConfirmScript([true]);
  savedPayloads = [];
  page.global.handleCategoryModeToggle({ checked: false }, 'Melee1');
  clickModal('Save');
  await new Promise((r) => setTimeout(r, 20));
  check('Save path: POST made before switching', savedPayloads.length, 1);
  check('Save path: categoryMode reverted to cannith after save', page.global.__c.categoryMode.Melee1, 'cannith');

  // --- Delete button: disabled unless the combo box names an already-saved item in THIS category ---
  page.global.applyCategoryModeSwitch('Melee1', true);
  page.global.__c.customItems.Melee1 =
    { name: 'Not In Library Yet', augments: [], nextAugmentId: 1, description: '', minLevel: 20 };
  page.global.markNamedItemSaved('Melee1'); // clean baseline - the switch below must not need a confirm
  check('Delete disabled for a name not in the library',
    page.global.getDeleteNamedItemButtonHtml('Melee1').indexOf('disabled') > -1, true);

  setConfirmScript([]);
  page.global.handleCustomItemName({ value: 'Tourney Armor' }, 'Melee1'); // clean switch, loads it
  check('switching to load it needed no confirm', page.calls.confirm.length, 0);
  check('Delete enabled for a name that is in the library',
    page.global.getDeleteNamedItemButtonHtml('Melee1').indexOf('disabled') === -1, true);

  // Decline the delete confirm - nothing happens
  setConfirmScript([false]);
  deleteCalls = [];
  page.global.handleDeleteNamedItem(null, 'Melee1');
  check('declining delete confirm does not call DELETE', deleteCalls.length, 0);

  // Accept - DELETEs by namedItemId, removes it from the library cache, and re-dirties the item
  setConfirmScript([true]);
  page.global.handleDeleteNamedItem(null, 'Melee1');
  await new Promise((r) => setTimeout(r, 20));
  check('accepting delete confirm calls DELETE with the right id', deleteCalls[0], '/api/named-items/1?userId=1');
  check('deleted item removed from allNamedItems cache',
    page.global.__getNamedItems().some((n) => n.itemName === 'Tourney Armor'), false);
  check('Delete now disabled - no longer in the library',
    page.global.getDeleteNamedItemButtonHtml('Melee1').indexOf('disabled') > -1, true);
  check('editor content untouched by delete (still "Tourney Armor")', page.global.__c.customItems.Melee1.name, 'Tourney Armor');
  check('item is dirty again after its library copy was deleted', page.global.isNamedItemDirty('Melee1'), true);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

runAsyncChecks();
