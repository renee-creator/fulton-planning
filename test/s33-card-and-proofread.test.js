'use strict';
// An animal's card prints its words, never [object Object], and printing proofreads only writing not proofread before.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const GARDEN = { ready: true, plants: [], beds: [], wild: [], signs: [], fieldGuides: [{ space: 'goatyard', title: 'Goat yard', entries: ['a-goats'] }],
  animals: [{ id: 'a-goats', name: 'Goats', vocab: ['kid'], health: 'Wash hands.', card: { title: 'Goat', know: 'Goats chew cud.', wonder: 'What do you notice when a goat rests?', rule: 'Gentle hands.', family: 'A kid, a doe and a buck.' } }] };

test('an animal card prints each part of its card, and so do its other lines', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog' }); } }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('garden')); await s.p.waitForFunction(() => typeof gdnEntryDoc === 'function' && gdn && gdn.animals, null, { timeout: 15000 });
  const doc = JSON.stringify(await s.p.evaluate(() => gdnEntryDoc(gdn.animals[0])));
  assert.doesNotMatch(doc, /object Object/);
  for (const w of ['Goats chew cud.', 'What do you notice when a goat rests?', 'Gentle hands.', 'A kid, a doe and a buck.']) assert.ok(doc.includes(w), w);
  const tok = (await fx.login('Dee', 'director-pass-1')).token;
  assert.doesNotMatch(JSON.stringify((await fx.as(tok, '/api/staff/garden', {})).body.library || {}), /object Object/);
  assert.deepStrictEqual(s.errors, []);
});

test('printing proofreads only writing that is new or changed since it was proofread', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({}); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(() => { const m = document.getElementById('main'); m.innerHTML = '<textarea id="pa">We went to the creek today.</textarea><textarea id="pb">The children counted the ducks.</textarea>';
    const before = proofNew().map(e => e.id); proofRemember(['We went to the creek today.']); const after = proofNew().map(e => e.id);
    document.getElementById('pa').value = 'We went to the creek today and saw a heron.'; const changed = proofNew().map(e => e.id);
    return { before, after, changed, kept: JSON.parse(localStorage.getItem('tree.proofok') || '[]').length > 0 }; });
  assert.deepStrictEqual(r, { before: ['pa', 'pb'], after: ['pb'], changed: ['pa', 'pb'], kept: true });
});
