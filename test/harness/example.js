'use strict';
// Self-test / usage example for dom-stub.js. Run with:
//   node test/harness/example.js
// Exits non-zero on any failed assertion (CI/pre-approval friendly).
//
// Stubs /api/catalog and /api/character-classes with empty fixtures so this runs
// offline and fast. For a real end-to-end check against a live server, pass routes
// like: { '/api/catalog': () => execSync('curl -s https://.../api/catalog').toString() }
// or just let dom-stub.js's default handler fetch a full https:// URL for you.

const { loadPage } = require('./dom-stub');

let failures = 0;
function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log((pass ? 'PASS' : 'FAIL') + ' - ' + label +
    (pass ? '' : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`));
}

const page = loadPage({
  routes: {
    '/api/catalog': () => '[]',
    '/api/character-classes': () => '[]',
  },
  exposeSrc: 'global.__c = charData; global.__isDirty = function () { return isDirty(); };',
});

// initialize() already ran synchronously during the eval inside loadPage() - same as a real
// page load - so by this point the page should be in its normal just-loaded state.
check('real element id resolves', !!page.document.getElementById('characterName'), true);
check('unknown element id returns null (catches stale getElementById refs)',
  page.document.getElementById('definitelyNotARealId'), null);
check('charData exposed via exposeSrc', typeof page.global.__c, 'object');
check('charData.saveFile.classNames starts empty', page.global.__c.saveFile.classNames, []);
check('fresh page load is not dirty (markSaved baseline)', page.global.__isDirty(), false);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
