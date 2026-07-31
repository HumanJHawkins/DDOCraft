'use strict';
// Verifies the 2026-07-30 Filter/Highlight split (see getFilterValue()/getHighlightValue() in
// ddocraft.js): Filter (All/Basics/Non-scaling) alone controls visibility, Highlight (Melee/Ranged/
// AC/Resist/HP) alone controls brightness on top of whatever's already visible - previously a single
// combined score did both together. Run with: node test/harness/filter-highlight.js

const { loadPage } = require('./dom-stub');

let failures = 0;
function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log((pass ? 'PASS' : 'FAIL') + ' - ' + label +
    (pass ? '' : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`));
}

const catalogFixture = [
  {
    enchName: 'Basic Only', enchEffectType: 'typeA', enchDesc: '', enchSupercededBy: null,
    enchCannithMinLevel: 1, enchAugmentMinLevel: 1, allEnch: 1, basic: 1, nonscaling: 0,
    forMeleeDmg: 0, forRangedDmg: 0, forACDefence: 0, forResistDefence: 0, forHitPoints: 0,
    itemOptionCategory: null, itemOptionItem: null, itemOptionSlot: null, augmentColor: null
  },
  {
    enchName: 'Melee Only', enchEffectType: 'typeB', enchDesc: '', enchSupercededBy: null,
    enchCannithMinLevel: 1, enchAugmentMinLevel: 1, allEnch: 1, basic: 0, nonscaling: 0,
    forMeleeDmg: 1, forRangedDmg: 0, forACDefence: 0, forResistDefence: 0, forHitPoints: 0,
    itemOptionCategory: null, itemOptionItem: null, itemOptionSlot: null, augmentColor: null
  }
];

const page = loadPage({
  routes: {
    '/api/catalog': () => JSON.stringify(catalogFixture),
    '/api/character-classes': () => '[]',
    '/api/named-items?userId=1': () => '[]',
  },
  exposeSrc: 'global.__c = charData;',
});

// Only "Basics" checked - filters by ench.basic, matches "Basic Only" but not "Melee Only"
page.global.__c.enchFilter = {
  allEnch: false, basic: true, nonscaling: false,
  forMeleeDmg: false, forRangedDmg: false, forACDefence: false, forResistDefence: false, forHitPoints: false
};
check('Basics filter passes an enchantment flagged basic', page.global.getFilterValue('Basic Only') >= 1, true);
check('Basics filter excludes an enchantment not flagged basic', page.global.getFilterValue('Melee Only') >= 1, false);
check('highlight value is 0 with no Highlight boxes checked', page.global.getHighlightValue('Basic Only'), 0);
check('highlight value is 0 even for the excluded item', page.global.getHighlightValue('Melee Only'), 0);

// Checking a Highlight box (Melee Damage) must NOT act as a filter - "Melee Only" still hidden
// since no Filter box matches it, but its highlight value should now be nonzero.
page.global.__c.enchFilter.forMeleeDmg = true;
check('highlight box alone does not un-hide a filtered-out item', page.global.getFilterValue('Melee Only') >= 1, false);
check('highlight value now nonzero for the matching item', page.global.getHighlightValue('Melee Only') >= 1, true);
check('highlight value still 0 for the non-matching item', page.global.getHighlightValue('Basic Only'), 0);

// "All" is a flat pass, independent of any per-enchantment flag - both items pass Filter once
// checked, regardless of their basic/nonscaling flags.
page.global.__c.enchFilter = {
  allEnch: true, basic: false, nonscaling: false,
  forMeleeDmg: false, forRangedDmg: false, forACDefence: false, forResistDefence: false, forHitPoints: false
};
check('"All" filter passes every enchantment regardless of its flags (1/2)', page.global.getFilterValue('Basic Only') >= 1, true);
check('"All" filter passes every enchantment regardless of its flags (2/2)', page.global.getFilterValue('Melee Only') >= 1, true);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
