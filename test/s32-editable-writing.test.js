'use strict';
// Every block of writing TREE shows for information is the director's to edit, with its history and Restore, through the
// one Edit. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

async function dee(t, more) {
  const b = await browser(); if (!b) return null;
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  return { fx, s };
}

test('the food rule, the conference steps and each food exploration open in Edit', async t => {
  const r = await dee(t, put => { put('staff/wording/food-rule.md', '# Our food rule\n\n## Rule\n\nWe taste only what an adult has named edible.\n'); put('staff/wording/conference-prep.md', '# Conference steps\n\n## dates\n\nDates offered\n'); }); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const html = await s.p.evaluate(() => releasesHtml());
  assert.match(html, /data-pageedit="staff\/wording\/food-rule\.md"/); assert.match(html, /data-pageedit="staff\/wording\/conference-prep\.md"/);
  const card = await s.p.evaluate(() => recipeCard({ id: 'r1', path: 'staff/library/recipes/r1.md', kind: 'recipe', title: 'Soup', meta: { kind: 'food' }, parts: [] }));
  assert.match(card, /data-pageedit="staff\/wording\/food-rule\.md"/);
  // the server opens each of them in the one Edit
  const tok = (await fx.login('Dee', 'director-pass-1')).token;
  for (const p of ['staff/wording/food-rule.md', 'staff/wording/conference-prep.md']) {
    const o = await fx.as(tok, '/api/staff/page', { path: p });
    assert.strictEqual(o.status, 200, p + ' ' + JSON.stringify(o.body)); assert.ok(JSON.stringify(o.body).includes('food') || JSON.stringify(o.body).includes('onference'), p + ' ' + JSON.stringify(o.body).slice(0, 300));
  }
  assert.deepStrictEqual(s.errors, []);
});

const GARDEN = {
  ready: true, nochemicals: 'We never spray anything on our site.', plan: { year: '2026-27', months: Object.fromEntries(['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => [m, { name: 'Month ' + m, tasks: [] }])) }, beds: [{ id: 'b1', name: 'North bed' }],
  plants: [{ id: 'p1', common: 'Plum', opens: 'Plums belong to the rose family.', wonder: ['I wonder when a plum turns soft.'], where: 'The orchard', ready: ['07', '08'], words: { child: 'Plums grow here.' } }],
  animals: [{ id: 'a-goats', name: 'Goats', opens: 'Goats chew cud.', eats: 'Hay and browse.', never: 'Never avocado.', handling: 'Gentle hands.', health: 'Wash hands.', vocab: ['kid', 'doe'], wonder: ['I wonder why they chew.'],
    herd: 'Four breeds.', family: { male: 'buck', female: 'doe', young: 'kid', group: 'herd' }, breeds: [{ breed: 'Saanen', goats: ['Ivy'], notice: 'Upright ears.' }], card: { title: 'Goat', know: 'Goats chew.' } }],
  wild: [{ id: 'w-hemlock', kind: 'hazard', name: 'Poison hemlock', know: 'Purple spots.', worth: 'Carrot family.', children: 'Never a whistle.', safety: 'Never touch.', wonder: ['I wonder how to tell it from parsley.'], sign: { title: 'Poison Hemlock', rule: 'Look. Do not touch. Tell an adult.' } }],
  signs: [{ id: 's-eye', kind: 'discovery', title: 'Goat Eye', question: 'What shape is a goat\'s eye?', wonder: 'Are all eyes the same?', place: 'Goat yard fence', entry: 'a-goats' }],
  fieldGuides: [{ space: 'logyard', title: 'Log yard', entries: ['w-hemlock'] }],
  safety: { edible: ['We only taste what an adult names.'], checkFirst: { text: ['Check the UC list first.'] }, mushrooms: 'Deathcaps grow near us.' },
  nearUs: { count: 5, note: 'Species seen near us.', groups: { birds: 2 } }
};

test('every part of the Garden\'s writing opens in Edit, keeps its history and can be restored', async t => {
  const r = await dee(t, put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog' }); }); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const tok = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const P = 'staff/garden/setup.json';
  const open = async item => (await fx.as(tok, '/api/staff/page', { path: P, item })).body;
  // an animal shows only the parts it has, its breeds as lines
  const g = await open('animals|a-goats');
  const heads = g.parts.map(x => x.heading);
  assert.ok(heads.includes('What they eat') && heads.includes('Never feed') && heads.includes('Our herd'), heads.join(', '));
  assert.ok(!heads.includes('Our flock') && !heads.includes('Our eggs, one on each line'), 'goats have no flock or eggs');
  const bi = heads.findIndex(h => /^Breeds/.test(h)); assert.strictEqual(g.parts[bi].body, 'Saanen. Upright ears.');
  // change what they eat and a breed's note, the breed keeps its goats
  const parts = g.parts.map(x => ({ body: x.heading === 'What they eat' ? 'Hay, browse and our scraps.' : /^Breeds/.test(x.heading) ? 'Saanen. Tall upright ears.' : x.body }));
  const sv = await fx.as(tok, '/api/staff/page/save', { path: P, item: 'animals|a-goats', stamp: g.stamp, parts, note: 'What they eat', keep: true });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body));
  let d = (await fx.as(tok, '/api/staff/garden', {})).body;
  const goat = d.animals.find(a => a.id === 'a-goats');
  assert.deepStrictEqual([goat.eats, goat.breeds[0].notice, goat.breeds[0].goats, goat.name], ['Hay, browse and our scraps.', 'Tall upright ears.', ['Ivy'], 'Goats']);
  // each of the others opens
  for (const [item, want] of [['wild|w-hemlock', 'Its sign, the rule'], ['signs|s-eye', 'The question'], ['plants|p1', 'Months to harvest or gather, as numbers 1 to 12, one on each line'], ['guides|logyard', 'A line under the title'], ['safety|all', 'Mushrooms'], ['near|all', 'What it says']]) {
    const o = await open(item); assert.ok(o && o.parts && o.parts.some(x => x.heading === want), item + ' ' + JSON.stringify(o).slice(0, 200));
  }
  assert.strictEqual((await open('plants|p1')).parts.find(x => /^Months/.test(x.heading)).body, '7\n8');
  // the earlier words come back with Restore
  const h = await open('animals|a-goats'); assert.strictEqual(h.history.length, 1);
  const rs = await fx.as(tok, '/api/staff/page/restore', { path: P, item: 'animals|a-goats', stamp: h.stamp, index: 0 });
  assert.strictEqual(rs.status, 200, JSON.stringify(rs.body));
  d = (await fx.as(tok, '/api/staff/garden', {})).body; assert.strictEqual(d.animals[0].eats, 'Hay and browse.');
  // only the director
  assert.notStrictEqual((await fx.as(ann, '/api/staff/page', { path: P, item: 'animals|a-goats' })).status, 200);
  // the Change buttons, and the no chemicals line she writes
  await s.p.evaluate(() => goView('garden')); await s.p.waitForSelector('[data-pageitem="animals|a-goats"]', { timeout: 15000, state: 'attached' });
  for (const item of ['wild|w-hemlock', 'signs|s-eye', 'plants|p1', 'guides|logyard', 'safety|all', 'near|all']) assert.ok(await s.p.$(`[data-pageitem="${item}"]`), item);
  await s.p.evaluate(() => { gdnOpen.plan = true; renderMain(); }); await s.p.waitForTimeout(300);
  assert.match(await s.p.$eval('#main', el => el.textContent), /We never spray anything on our site\./);
  assert.deepStrictEqual(s.errors, []);
});
