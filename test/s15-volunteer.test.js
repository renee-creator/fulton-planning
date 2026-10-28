'use strict';
// The Volunteer Jobs library. The director's job cards come in once from once/volunteer-jobs.json, word for word, and
// every card that said staff says your point person as its second version. The director and the office read and edit
// them, and Future Ideas stay the director's alone.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const ROOT = path.join(__dirname, '..');
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'once', 'volunteer-jobs.json'), 'utf8'));
const KEYS = ['title', 'where', 'time', 'who', 'supplies', 'directions', 'take_care', 'done_when'];
const lines = j => KEYS.flatMap(k => Array.isArray(j[k]) ? j[k].map((s, i) => k + i + '|' + s) : [k + '|' + j[k]]);

test('the file holds 103 active cards in 8 groups, one Future Idea and Before You Start', () => {
  const cats = SRC.categories; assert.strictEqual(cats.length, 9);
  assert.strictEqual(cats.filter(c => c.category !== 'Future Ideas').reduce((a, c) => a + c.jobs.length, 0), 103);
  assert.strictEqual(cats.find(c => c.category === 'Future Ideas').jobs.length, 1);
  assert.strictEqual(SRC.intro.title, 'Before You Start'); assert.strictEqual(SRC.intro.guidelines.length, 14);
});

test('point person in place of staff changes 41 lines and nothing else', () => {
  const V = require(path.join(ROOT, 'volunteer.js'))({ get: () => null, put: () => {}, S: { files: new Map() }, log: () => {}, isDirector: () => false, isOffice: () => false, saveRecord: () => ({}) });
  let changed = 0;
  for (const c of SRC.categories) for (const j of c.jobs) for (const k of KEYS) for (const s of [].concat(j[k])) { const n = V.pointPerson(s); if (n !== s) { changed++; assert.doesNotMatch(n, /\bstaff\b/i); } }
  assert.strictEqual(changed, 41);
  assert.strictEqual(V.pointPerson('Load only items staff have set aside.'), 'Load only items your point person has set aside.');
  assert.strictEqual(V.pointPerson('New sand, if staff have it'), 'New sand, if your point person has it');
  assert.strictEqual(V.pointPerson('Do not remove any part. Staff will handle replacements.'), 'Do not remove any part. Your point person will handle replacements.');
  assert.strictEqual(V.pointPerson('Unload where staff ask.'), 'Unload where your point person asks.');
});

test('the cards load once, word for word, then say your point person, and the office edits all but Future Ideas', async t => {
  const fx = await start({ more: put => put('staff/library/recipes/bread.md', '<!--\nkind: recipe\n-->\n# Bread\n\n## Ingredients\n\n- Flour\n') });
  t.after(() => fx.stop());
  await new Promise(r => setTimeout(r, 3000));
  const dee = (await fx.login('Dee', 'director-pass-1')).token, gia = (await fx.login('Gia', '1357')).token, ann = (await fx.login('Ann', '1357')).token;
  const v = (await fx.as(dee, '/api/staff/volunteer', {})).body;
  assert.strictEqual(v.loaded, true);
  assert.strictEqual(v.jobs.length, 104); assert.strictEqual(v.groups.length, 9);
  assert.deepStrictEqual(v.intro, SRC.intro, 'Before You Start is as written');
  assert.strictEqual(v.stepsBefore, false, 'families see the steps after signing up, to start');
  // every card in its group, in order, with its starting type
  const want = SRC.categories.flatMap(c => c.jobs.map(j => [c.category, j]));
  const gname = id => v.groups.find(g => g.id === id).name;
  want.forEach(([cat, j], i) => { const x = v.jobs[i]; assert.strictEqual(gname(x.group), cat); assert.strictEqual(x.title, j.title); });
  const type = cat => v.jobs.filter(x => gname(x.group) === cat).map(x => x.type);
  assert.ok(type('Quick Jobs at Pickup').every(x => x === 'anytime')); assert.ok(type('At Home').every(x => x === 'at-home'));
  assert.ok(type('During the School Day').every(x => x === 'school-day')); assert.ok(type('Classes and Studio').every(x => x === 'school-day'));
  for (const g of ['Garden and Orchard', 'Animal Care', 'Yards and Play Spaces', 'Culinary Atelier and Kitchen']) assert.ok(type(g).every(x => x === 'scheduled'), g);
  assert.strictEqual(v.jobs.filter(x => x.status === 'future').length, 1);
  assert.strictEqual(v.groups.find(g => g.name === 'Quick Jobs at Pickup').note, 'No sign-up needed. Do these anytime and log your time after.');
  // each card now differs from the file only where staff became your point person, and the file's words are its first version
  let diff = 0;
  for (let i = 0; i < want.length; i++) {
    const was = lines(want[i][1]), now = lines(v.jobs[i]); assert.strictEqual(now.length, was.length);
    now.forEach((l, k) => { if (l !== was[k]) { diff++; assert.match(was[k], /\bstaff\b/i); assert.match(l, /your point person/i); } });
    const h = (await fx.as(dee, '/api/staff/page', { path: v.paths.jobs, item: v.jobs[i].id })).body;
    if (now.join() !== was.join()) { assert.strictEqual(h.history.length, 1); assert.strictEqual(h.updatedBy, 'TREE'); const tx = h.history[0].text.split('\n');
      for (const k of KEYS) for (const s of [].concat(want[i][1][k])) assert.ok(tx.includes(s), 'the first version is the file, word for word: ' + s); }
    else assert.strictEqual(h.history.length, 0);
  }
  assert.strictEqual(diff, 41);
  const wood = v.jobs.find(j => j.status === 'future');
  // the two playdough cards carry a note for the director while no playdough recipe is in the library
  assert.deepStrictEqual(Object.keys(v.notes).map(id => v.jobs.find(j => j.id === id).title).sort(), ['Make Playdough at Home', 'Make Playdough with a Small Group']);

  // the office sees every card but Future Ideas, and an educator sees none
  const o = (await fx.as(gia, '/api/staff/volunteer', {})).body;
  assert.strictEqual(o.jobs.length, 103); assert.ok(!o.groups.some(g => g.id === 'future-ideas')); assert.strictEqual(o.notes, undefined);
  assert.strictEqual((await fx.as(ann, '/api/staff/volunteer', {})).status, 403);
  assert.strictEqual((await fx.as(gia, '/api/staff/page', { path: v.paths.jobs, item: wood.id })).status, 403, 'a Future Idea is the director\'s');
  assert.strictEqual((await fx.as(ann, '/api/staff/page', { path: v.paths.jobs, item: v.jobs[0].id })).status, 403);

  // the office edits a card, and its history keeps the words before
  const first = v.jobs[0]; const pg = (await fx.as(gia, '/api/staff/page', { path: v.paths.jobs, item: first.id })).body;
  const parts = pg.parts.map(p => ({ body: p.body })); parts[2].body = '2 to 3 hours';
  const r = await fx.as(gia, '/api/staff/page/save', { path: v.paths.jobs, item: first.id, stamp: pg.stamp, parts, note: 'Longer time', keep: true });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const after = (await fx.as(dee, '/api/staff/volunteer', {})).body.jobs[0];
  assert.strictEqual(after.time, '2 to 3 hours'); assert.deepStrictEqual(after.directions, first.directions);
  assert.strictEqual((await fx.as(dee, '/api/staff/page', { path: v.paths.jobs, item: first.id })).body.history.length, 2);

  // a new card, its type, moving into Future Ideas and back, and the steps switch
  assert.strictEqual((await fx.as(gia, '/api/staff/volunteer/add', { title: 'Wash the Mud Kitchen Pots', group: 'future-ideas' })).status, 403);
  const add = (await fx.as(gia, '/api/staff/volunteer/add', { title: 'Wash the Mud Kitchen Pots', group: 'yards-and-play-spaces' })).body;
  const nj = add.jobs.find(j => j.id === add.added); assert.strictEqual(nj.type, 'scheduled'); assert.strictEqual(nj.status, 'active');
  assert.strictEqual((await fx.as(gia, '/api/staff/volunteer/type', { id: nj.id, type: 'work-day' })).body.jobs.find(j => j.id === nj.id).type, 'work-day');
  assert.strictEqual((await fx.as(gia, '/api/staff/volunteer/move', { id: nj.id, to: 'future' })).status, 403);
  const moved = (await fx.as(dee, '/api/staff/volunteer/move', { id: nj.id, to: 'future' })).body; assert.strictEqual(moved.jobs.find(j => j.id === nj.id).status, 'future');
  assert.ok(!(await fx.as(gia, '/api/staff/volunteer', {})).body.jobs.some(j => j.id === nj.id));
  assert.strictEqual((await fx.as(dee, '/api/staff/volunteer/move', { id: wood.id, to: 'active' })).status, 400, 'a card from Future Ideas chooses its group');
  const back = (await fx.as(dee, '/api/staff/volunteer/move', { id: wood.id, to: 'active', group: 'yards-and-play-spaces' })).body.jobs.find(j => j.id === wood.id);
  assert.strictEqual(back.status, 'active'); assert.strictEqual(back.group, 'yards-and-play-spaces');
  assert.strictEqual((await fx.as(gia, '/api/staff/volunteer/settings', { stepsBefore: true })).status, 403);
  assert.strictEqual((await fx.as(dee, '/api/staff/volunteer/settings', { stepsBefore: true })).body.stepsBefore, true);

  // the cards are written to the records, and a second start never loads them again
  await new Promise(r => setTimeout(r, 2500));
  const kept = JSON.parse(fs.readFileSync(path.join(fx.dir, 'staff/volunteer/jobs.json'), 'utf8'));
  assert.strictEqual(kept.jobs.length, 105); assert.strictEqual(kept.jobs[0].time, '2 to 3 hours');
  assert.ok(fs.existsSync(path.join(fx.dir, 'staff/volunteer/intro.json')) && fs.existsSync(path.join(fx.dir, 'staff/volunteer/groups.json')));
});

test('the Volunteer Jobs page opens folded, prints one, some or all, and keeps Future Ideas with the director', async t => {
  const { browser, signedIn } = require('./fixture.js');
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  await new Promise(r => setTimeout(r, 3000));
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('volunteer')); await s.p.waitForSelector('[data-volrow^="g:"]', { timeout: 15000 });
  const seen = await s.p.evaluate(() => ({ groups: [...document.querySelectorAll('details[data-volrow^="g:"]')].map(d => [d.querySelector('summary b').textContent, d.open]),
    future: !!document.querySelector('details[data-volrow="future"]'), anyOpen: [...document.querySelectorAll('#main details')].some(d => d.open),
    tab: [...document.querySelectorAll('button,a')].some(x => x.textContent.trim() === 'Volunteer Jobs'), text: document.querySelector('#main').innerText }));
  assert.deepStrictEqual(seen.groups.map(g => g[0]), SRC.categories.map(c => c.category).filter(c => c !== 'Future Ideas'));
  assert.strictEqual(seen.anyOpen, false, 'every group and card starts folded');
  assert.ok(seen.future, 'the director sees Future Ideas'); assert.ok(seen.tab, 'Volunteer Jobs sits among the Children tabs');
  assert.doesNotMatch(seen.text, /[—–]|\bteacher|\bClaude\b/, 'the page keeps the writing rules');
  // one, some and all, as PDF and Word. All prints Before You Start first.
  const got = await s.p.evaluate(async () => {
    const out = {}; window.makePdf = (docs, n) => { out.pdf = { n, docs }; }; window.makeDocx = (docs, n) => { out.word = { n, docs }; };
    const click = async (set, key) => { delete out[key]; const x = document.createElement('button'); Object.assign(x.dataset, set); document.body.appendChild(x); x.click(); x.remove(); for (let i = 0; i < 80 && !out[key]; i++) await new Promise(r => setTimeout(r, 100)); return out[key]; };
    const ids = volData.jobs.filter(j => !volFuture(j)).map(j => j.id);
    const one = await click({ print: 'voljob', id: ids[0] }, 'pdf');
    volPick.add(ids[0]); volPick.add(ids[5]); const some = await click({ volprint: 'some', word: '1' }, 'word');
    const all = await click({ volprint: 'all' }, 'pdf');
    return { one, some, all, ids: ids.length };
  });
  assert.strictEqual(got.one.n, 'Spread Wood Chips job card.pdf'); assert.strictEqual(got.one.docs.length, 1);
  const card = got.one.docs[0]; assert.ok(card.centered, 'a one page card prints centred'); assert.strictEqual(card.over, 'Garden and Orchard');
  assert.match(JSON.stringify(card), /Done when no bare soil shows and the fall zones are deep and even\./);
  assert.match(JSON.stringify(card), /1\. Ask your point person which areas need chips first\./);
  assert.strictEqual(got.some.docs.length, 2); assert.strictEqual(got.some.n, 'Volunteer job cards.docx');
  assert.strictEqual(got.all.docs.length, got.ids + 1); assert.strictEqual(got.all.docs[0].title, 'Before You Start');
  assert.ok(got.all.docs.slice(1).every(d => d.centered || d.display), 'each card prints centred, or on full pages when it is longer');
  // the editor opens on a card, with its earlier wording
  await s.p.click('[data-volrow="g:garden-and-orchard"] > summary'); await s.p.click('[data-volrow="j:spread-wood-chips"] > summary');
  await s.p.click('[data-volrow="j:spread-wood-chips"] [data-voledit]'); await s.p.waitForSelector('#stpageedit [data-pepart]', { timeout: 15000 });
  assert.match(await s.p.innerText('#stpageedit'), /Earlier versions/);
  assert.deepStrictEqual(s.errors, []);

  // the office sees the page without Future Ideas, and can open the editor
  const o = await signedIn(fx, br, 'Gia', '1357', 1100); t.after(() => o.close());
  await o.p.evaluate(() => goView('volunteer')); await o.p.waitForSelector('[data-volrow^="g:"]', { timeout: 15000 });
  assert.strictEqual(await o.p.$('details[data-volrow="future"]'), null);
  assert.strictEqual(await o.p.$('[data-volsteps]'), null, 'the steps switch is the director\'s');
  await o.p.click('[data-volrow="g:animal-care"] > summary');
  await o.p.click('[data-volrow="g:animal-care"] [data-voledit]'); await o.p.waitForSelector('#stpageedit [data-pepart]', { timeout: 15000 });
  assert.deepStrictEqual(o.errors, []);
  // an educator never reaches the page
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  assert.strictEqual(await a.p.evaluate(() => { goView('volunteer'); return view; }), 'children');
});
