'use strict';
// Verifies the 2026-07-30 Named Item work: loadNamedItemInto() correctly restores a library
// item's augment/inherent selections (not just its name), and handleCharLevelChange() reverts a
// Named/Custom category back to Cannith when its minLevel exceeds a newly-lowered level.
// Run with: node test/harness/named-item.js

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

const namedItemFixture = [{
  namedItemId: 1,
  itemName: 'Tourney Armor',
  itemData: {
    name: 'Tourney Armor', minLevel: 20, augments: [{ id: 1, color: 'Red' }], nextAugmentId: 2,
    description: 'test item',
    augmentSelections: { 'Augment#1': { enchName: 'Test Enchant', color: 'Red' } },
    inherentSelections: ['Test Enchant']
  }
}];

const page = loadPage({
  routes: {
    '/api/catalog': () => JSON.stringify(catalogFixture),
    '/api/character-classes': () => '[]',
    '/api/named-items?userId=1': () => JSON.stringify(namedItemFixture),
  },
  exposeSrc: 'global.__c = charData;',
});

check('library fetched into allNamedItems datalist',
  page.document.getElementById('namedItemNames').innerHTML.indexOf('Tourney Armor') > -1, true);

// --- loadNamedItemInto: full round trip, not just the name ---
page.global.loadNamedItemInto('Melee1', namedItemFixture[0].itemData);
check('name restored', page.global.__c.customItems.Melee1.name, 'Tourney Armor');
check('minLevel restored', page.global.__c.customItems.Melee1.minLevel, 20);
check('augment selection restored',
  page.global.__c.selections.positional['custom:Melee1']['Augment#1'].enchName, 'Test Enchant');
check('inherent selection restored',
  page.global.__c.selections.inherent.Melee1['custom:Melee1'].has('Test Enchant'), true);

// --- handleCharLevelChange(): minLevel cascade reverts Named/Custom back to Cannith ---
page.global.__c.categoryMode.Melee1 = 'custom';
page.global.__c.saveFile.charLevel = 25;
page.document.getElementById('characterLevel').value = '5';
page.global.handleCharLevelChange();

check('confirm() was shown', page.calls.confirm.length, 1);
check('confirm message names the category/item', page.calls.confirm[0].indexOf('Melee1 (Tourney Armor)') > -1, true);
check('categoryMode reverted to cannith', page.global.__c.categoryMode.Melee1, 'cannith');
check('customItems data preserved (non-destructive)', page.global.__c.customItems.Melee1.name, 'Tourney Armor');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
