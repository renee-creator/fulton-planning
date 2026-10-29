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

test('walk safety opens in Edit, and a licensing line keeps the rule it comes from', async t => {
  const r = await dee(t, put => put('staff/walks.json', { id: 'walks', ready: true, checklist: ['Every child wears a vest.'], agreements: ['Find your partner.'], rule: ['Safety comes first.'], families: ['Families are welcome.'],
    licensing: [{ text: 'One adult for every six children near water.', source: 'Title 22' }], photos: [] })); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const tok = (await fx.login('Dee', 'director-pass-1')).token;
  const o = (await fx.as(tok, '/api/staff/page', { path: 'staff/walks.json' })).body;
  assert.deepStrictEqual(o.parts.map(p => p.heading), ['Before we leave, one on each line', 'The children\'s walk agreements, one on each line', 'Safety comes first, one on each line', 'Families on walks, one on each line', 'What licensing asks, one on each line']);
  const parts = o.parts.map((p, i) => ({ body: i === 0 ? 'Every child wears a vest.\nCount the children.' : i === 4 ? 'One adult for every six children near any water.' : p.body }));
  const sv = await fx.as(tok, '/api/staff/page/save', { path: 'staff/walks.json', stamp: o.stamp, parts, note: 'Count first', keep: true });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body));
  const w = (await fx.as(tok, '/api/staff/walks', {})).body;
  assert.deepStrictEqual(w.checklist, ['Every child wears a vest.', 'Count the children.']);
  assert.deepStrictEqual(w.licensing.map(l => [l.text, l.source]), [['One adult for every six children near any water.', 'Title 22']]);
  await s.p.evaluate(() => goView('walks')); await s.p.waitForSelector('[data-pageedit="staff/walks.json"]', { timeout: 15000, state: 'attached' });
  assert.deepStrictEqual(s.errors, []);
});

test('the Family page\'s own words start as they read and change when the director writes them', async t => {
  const fam0 = put => { put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] }); };
  const r = await dee(t, fam0); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  let d = (await fx.as(fam, '/family/data', {})).body;
  assert.match(d.texts['Participation hours'], /takes part for \{goal\} hours a year/);
  assert.match(d.texts['Toilet learning at our school'], /very individual[\s\S]*\n\nPower struggles/);
  // the first time the director opens the page it starts from the words as they read
  const tok = (await fx.login('Dee', 'director-pass-1')).token;
  const P = 'staff/wording/family-page-text.md';
  const o = (await fx.as(tok, '/api/staff/page', { path: P })).body;
  assert.strictEqual(o.parts.length, 47); assert.strictEqual(o.parts.find(p => p.heading === 'Our wish list').body, 'Things the school would love, from fruit trees to art materials. Bringing one counts toward your hours.');
  const parts = o.parts.map(p => ({ body: p.heading === 'Our wish list' ? 'Things the school would love. Bringing one counts toward your hours.' : p.body }));
  const sv = await fx.as(tok, '/api/staff/page/save', { path: P, title: o.title, parts, note: 'Shorter', stamp: o.stamp, keep: true });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body));
  d = (await fx.as(fam, '/family/data', {})).body;
  assert.strictEqual(d.texts['Our wish list'], 'Things the school would love. Bringing one counts toward your hours.');
  // a family's page fills in the names and numbers
  const br = await (await require('./fixture.js').browser()).launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('text=Taking part', { timeout: 10000 }); await p.click('text=Taking part'); await p.waitForTimeout(800);
  const txt = await p.evaluate(() => document.body.innerText);
  assert.match(txt, /Each child takes part for \d+ hours a year\./);
  assert.doesNotMatch(txt, /\{[a-z]+\}/, 'every fill-in is filled');
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(s.errors, []);
});

test('the Educators pages\' own words, each training\'s note, the checklist and the Growth questions open in Edit', async t => {
  const r = await dee(t); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const tok = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  let b = (await fx.as(ann, '/api/staff/boot', {})).body;
  assert.match(b.defs.texts['Paperwork'], /^Each form has a blank copy/);
  const P = 'staff/wording/educator-pages-text.md';
  assert.notStrictEqual((await fx.as(ann, '/api/staff/page', { path: P })).status, 200, 'only the director');
  const o = (await fx.as(tok, '/api/staff/page', { path: P })).body;
  const heads = o.parts.map(p => p.heading);
  for (const h of ['Paperwork', 'Training, Pediatric First Aid and CPR', 'Paper, Personnel Record', 'New Educator checklist, item 1', 'PD library, Documentation', 'Journal prompt, joy', 'Check-in, plus delta']) assert.ok(heads.includes(h), h);
  const change = { 'Paperwork': 'Each form has a blank copy. Upload the completed form.', 'Training, Pediatric First Aid and CPR': 'We run it here each spring', 'New Educator checklist, item 3': 'Welcome and philosophy read together', 'Journal prompt, joy': 'A moment of joy\n\nA moment this week that made me smile.' };
  const parts = o.parts.map(p => ({ body: change[p.heading] != null ? change[p.heading] : p.body }));
  const sv = await fx.as(tok, '/api/staff/page/save', { path: P, title: o.title, parts, note: 'Our words', stamp: o.stamp, keep: true });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body));
  b = (await fx.as(ann, '/api/staff/boot', {})).body;
  assert.strictEqual(b.defs.texts['Paperwork'], 'Each form has a blank copy. Upload the completed form.');
  assert.strictEqual(b.defs.items.find(i => i.k === 'cpr').note, 'We run it here each spring');
  assert.strictEqual(b.defs.checklist[2], 'Welcome and philosophy read together'); assert.strictEqual(b.defs.checklist.length, 11);
  assert.strictEqual(b.defs.papers.find(x => x.k === 'lic501').why, 'Gives Licensing your work history and contact information', 'an unchanged part reads as before');
  // the Growth questions take the new words on the page
  const br = await (await require('./fixture.js').browser()).launch(); t.after(() => br.close());
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  await a.p.evaluate(() => goView('stjour')); await a.p.waitForSelector('#main input[type=password]', { timeout: 15000 }); await a.p.fill('#main input[type=password]', '1357'); await a.p.click('#main button:has-text("Open")');
  await a.p.waitForSelector('text=A moment of joy', { timeout: 15000 });
  assert.match(await a.p.innerText('#main'), /A moment this week that made me smile\./);
  assert.deepStrictEqual(a.errors, []);
  assert.deepStrictEqual(s.errors, []);
});

test('a new Help answer, the welcome and philosophy and each reading open in Edit with history', async t => {
  const r = await dee(t, put => { put('staff/help.json', { id: 'help', list: [{ id: 'h01', q: 'How do I keep an observation?', a: ['Tap Keep.'], roles: ['educator', 'director'] }] });
    put('staff/readings.json', { list: [{ id: 'r02', title: 'The Pedagogy of Listening', source: 'Carlina Rinaldi', why: 'Listening is where documentation starts.', url: 'https://example.test/r' }] }); }); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const tok = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  // a new Help answer
  assert.strictEqual((await fx.as(ann, '/api/staff/help/add', { q: 'How do I print?' })).status, 403);
  const a = (await fx.as(tok, '/api/staff/help/add', { q: 'How do I print a thread?' })).body;
  assert.ok(a.added); const h = (await fx.as(tok, '/api/staff/page', { path: 'staff/help.json', item: a.added })).body;
  assert.strictEqual(h.parts[0].body, 'How do I print a thread?');
  const sv = await fx.as(tok, '/api/staff/page/save', { path: 'staff/help.json', item: a.added, stamp: h.stamp, parts: [{ body: 'How do I print a thread?' }, { body: 'Open Threads.\nTap Print this thread.' }], note: 'New answer', keep: true });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body));
  assert.deepStrictEqual((await fx.as(tok, '/api/staff/help', {})).body.list.find(x => x.id === a.added).a, ['Open Threads.', 'Tap Print this thread.']);
  // the welcome and philosophy, with history
  const w = (await fx.as(tok, '/api/staff/page', { path: 'staff/school.json' })).body;
  assert.deepStrictEqual(w.parts.map(p => p.heading), ['Your welcome', 'Our philosophy, drawn from the Program Philosophy']);
  const ws = await fx.as(tok, '/api/staff/page/save', { path: 'staff/school.json', stamp: w.stamp, parts: [{ body: 'Welcome to our school.' }, { body: w.parts[1].body }], note: 'Welcome', keep: true });
  assert.strictEqual(ws.status, 200, JSON.stringify(ws.body));
  assert.strictEqual((await fx.as(ann, '/api/staff/boot', {})).body.school.welcome, 'Welcome to our school.');
  assert.strictEqual((await fx.as(tok, '/api/staff/page', { path: 'staff/school.json' })).body.history.length, 1);
  // a reading's words
  const rd = (await fx.as(tok, '/api/staff/page', { path: 'staff/readings.json', item: 'r02' })).body;
  assert.ok(rd.parts.some(p => p.heading === 'Why we read it'));
  const rs = await fx.as(tok, '/api/staff/page/save', { path: 'staff/readings.json', item: 'r02', stamp: rd.stamp, parts: rd.parts.map(p => ({ body: p.heading === 'Why we read it' ? 'Listening is where all our documentation starts.' : p.body })), note: 'Why', keep: true });
  assert.strictEqual(rs.status, 200, JSON.stringify(rs.body));
  const list = (await fx.as(tok, '/api/staff/g/readings', {})).body.list;
  assert.deepStrictEqual([list.find(x => x.id === 'r02').why, list.find(x => x.id === 'r02').url], ['Listening is where all our documentation starts.', 'https://example.test/r'], 'its link stays');
  // the buttons
  assert.match(await s.p.evaluate(() => { helpData = null; return new Promise(ok => { loadHelp(true); setTimeout(() => ok(helpHtml('')), 1500); }); }), /data-helpadd/);
  assert.deepStrictEqual(s.errors, []);
});
