'use strict';
// Verifies the 2026-07-30 Named Item editor revamp: dirty tracking (blank/loaded/edited/saved),
// the Save button's label/disabled state, the name+minLevel setup gate, the rename-vs-fresh-start
// combo box behavior, the overwrite confirmation, and the Save/Discard/Cancel chain when switching
// a dirty category back to Cannith. Run with: node test/harness/named-item-editor.js

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

// confirmReturns indexes by page.calls.confirm.length, which accumulates for the whole page's
// lifetime - truncate it whenever a sub-test wants its own confirmScript to count from 0 again.
function setConfirmScript(script) {
  confirmScript = script;
  page.calls.confirm.length = 0;
}

const page = loadPage({
  routes: {
    '/api/catalog': () => JSON.stringify(catalogFixture),
    '/api/character-classes': () => '[]',
    '/api/named-items?userId=1': () => JSON.stringify([{
      namedItemId: 1, itemName: 'Tourney Armor',
      itemData: {
        name: 'Tourney Armor', minLevel: 20, augments: [{ id: 1, color: 'Red' }], nextAugmentId: 2,
        description: '', augmentSelections: {}, inherentSelections: []
      }
    }]),
  },
  confirmReturns: (msg, i) => (confirmScript[i] !== undefined ? confirmScript[i] : true),
  fetch: (url, options) => {
    savedPayloads.push(JSON.parse(options.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ namedItemId: 2 }) });
  },
  exposeSrc: 'global.__c = charData;',
});

// --- Fresh category: blank baseline, needs setup, Save disabled ---
page.global.applyCategoryModeSwitch('Melee1', true);
check('fresh custom item is not dirty', page.global.isNamedItemDirty('Melee1'), false);
check('fresh custom item needs setup', page.global.namedItemNeedsSetup('Melee1'), true);
check('Save button disabled + full label when clean',
  page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('disabled') > -1 &&
  page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('>Save Named Item<') > -1, true);

// --- Typing a name (still no minLevel): dirty, still needs setup ---
page.document.getElementById('characterLevel').value = '20'; // harmless; unrelated to this category
page.global.__c.customItems.Melee1.name = 'Brand New Item';
check('typed name alone is dirty', page.global.isNamedItemDirty('Melee1'), true);
check('still needs setup without minLevel', page.global.namedItemNeedsSetup('Melee1'), true);

// Fill minLevel too - setup unlocks
page.global.__c.customItems.Melee1.minLevel = 15;
check('setup unlocked once name+minLevel both set', page.global.namedItemNeedsSetup('Melee1'), false);
check('Save button enabled + short label when dirty',
  page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('disabled') === -1 &&
  page.global.getSaveNamedItemButtonHtml('Melee1').indexOf('>Save<') > -1, true);

// --- handleCustomItemName: switching to an existing library name loads it ---
page.document.getElementById('characterName'); // no-op, just touching a real id for sanity
let nameInput = { value: 'Tourney Armor' };
page.global.handleCustomItemName(nameInput, 'Melee1');
check('loaded library item is clean', page.global.isNamedItemDirty('Melee1'), false);
check('loaded library item name', page.global.__c.customItems.Melee1.name, 'Tourney Armor');
check('loaded library item augments', page.global.__c.customItems.Melee1.augments.length, 1);

// --- Editing after load makes it dirty again ---
page.global.__c.customItems.Melee1.description = 'edited after load';
check('editing a loaded item makes it dirty', page.global.isNamedItemDirty('Melee1'), true);

// --- handleCustomItemName: renaming a DIRTY item to an unmatched name preserves its data ---
let renameInput = { value: 'Tourney Armor (renamed mid-edit)' };
page.global.handleCustomItemName(renameInput, 'Melee1');
check('rename mid-edit keeps augments (not wiped)', page.global.__c.customItems.Melee1.augments.length, 1);
check('rename mid-edit keeps description', page.global.__c.customItems.Melee1.description, 'edited after load');

// --- handleCustomItemName: switching a CLEAN loaded item to a new unmatched name wipes it ---
page.global.handleCustomItemName({ value: 'Tourney Armor' }, 'Melee1'); // reload clean baseline
check('reloaded clean before blank-switch test', page.global.isNamedItemDirty('Melee1'), false);
page.global.handleCustomItemName({ value: 'A Totally New Item' }, 'Melee1');
check('switching a clean item to a new name wipes augments', page.global.__c.customItems.Melee1.augments.length, 0);
check('switching a clean item to a new name wipes description', page.global.__c.customItems.Melee1.description, '');
check('switching a clean item to a new name keeps the typed name', page.global.__c.customItems.Melee1.name, 'A Totally New Item');

async function runAsyncChecks() {
  // --- handleSaveNamedItem: overwrite confirmation ---
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
  check('item is clean immediately after save', page.global.isNamedItemDirty('Melee1'), false);

  // --- handleCategoryModeToggle: Save/Discard/Cancel chain when switching away from a dirty item ---
  page.global.__c.customItems.Melee1.description = 'dirty again for toggle test';
  check('dirty before toggle-away test', page.global.isNamedItemDirty('Melee1'), true);

  // Cancel: decline both confirms - stays in custom mode
  setConfirmScript([false, false]);
  page.global.handleCategoryModeToggle({ checked: false }, 'Melee1');
  check('Cancel path: categoryMode still custom', page.global.__c.categoryMode.Melee1, 'custom');

  // Discard: decline save, accept discard - switches to cannith, no POST
  setConfirmScript([false, true]);
  savedPayloads = [];
  page.global.handleCategoryModeToggle({ checked: false }, 'Melee1');
  check('Discard path: categoryMode reverted to cannith', page.global.__c.categoryMode.Melee1, 'cannith');
  check('Discard path: no POST made', savedPayloads.length, 0);

  // Reset back to custom+dirty for the Save path
  page.global.applyCategoryModeSwitch('Melee1', true);
  page.global.__c.customItems.Melee1.name = 'Tourney Armor';
  page.global.__c.customItems.Melee1.minLevel = 20;
  page.global.__c.customItems.Melee1.description = 'dirty once more';
  check('dirty before Save-path toggle test', page.global.isNamedItemDirty('Melee1'), true);

  // Save: accept save (first confirm), then the save's own overwrite-confirm (second confirm)
  setConfirmScript([true, true]);
  savedPayloads = [];
  page.global.handleCategoryModeToggle({ checked: false }, 'Melee1');
  await new Promise((r) => setTimeout(r, 20));
  check('Save path: POST made before switching', savedPayloads.length, 1);
  check('Save path: categoryMode reverted to cannith after save', page.global.__c.categoryMode.Melee1, 'cannith');

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

runAsyncChecks();
