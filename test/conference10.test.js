'use strict';
// Shared conference notes on the Family page never carry DRDP rating language, and the educators' words around it stay.
// Made-up words only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('rating sentences are left out of family text, and conference notes are never shared', () => {
  const F = require('../family.js')({ store: { recs: { children: new Map(), conferences: new Map(), settings: new Map() }, branch: 'main' }, log() {}, sign() {}, noteChange() {}, scheduleSave() {} });
  const t = 'Pip loves the goats.\nCause and Effect, Building Earlier, emerging to the next level. Pip chose a stick for its length.\nOn the DRDP this counts for ATL 3. Pip waits for a turn.';
  assert.strictEqual(F.withoutRatings(t), 'Pip loves the goats.\nPip chose a stick for its length.\nPip waits for a turn.');
  assert.strictEqual(F.withoutRatings('Building blocks and magnetiles'), 'Building blocks and magnetiles', 'everyday words stay');
  // conference notes are no longer shared with families at all, so nothing reaches the Family page from them
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'family.js'), 'utf8'), /const shared = \[\];/);
});
