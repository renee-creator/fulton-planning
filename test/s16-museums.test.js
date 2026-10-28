'use strict';
// Museums and cultural places. The director's list comes in once from once/museums.json, every place line as she wrote
// it, with an area for each part. Only the director sees the page until she shows it to educators.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'once', 'museums.json'), 'utf8')).changes[0];
const lines = t => t.split('\n').filter(l => l.startsWith('- ['));

test('the list holds 198 places in nine areas, in our own words', () => {
  assert.strictEqual(LIST.path, 'staff/library/places/museums.md');
  assert.strictEqual(lines(LIST.create).length, 198);
  assert.deepStrictEqual(LIST.create.match(/^## .+$/gm), ['## Sonoma County', '## Marin County', '## Napa County', '## Solano County', '## Lake County', '## Mendocino County', '## San Francisco', '## The East Bay', '## The Peninsula']);
  assert.doesNotMatch(LIST.create, /[—–]|\bteacher|\bClaude\b/);
});

test('the list comes in once, and educators see it only once the director shows it', async t => {
  const fx = await start(); t.after(() => fx.stop());
  await new Promise(r => setTimeout(r, 3000));
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  // the one-time step runs once the records have loaded, so wait for it rather than a fixed time
  let d = null; for (let i = 0; i < 100 && !d; i++) { d = (await fx.as(dee, '/api/staff/library', {})).body.places; if (!d) await new Promise(r => setTimeout(r, 200)); }
  assert.ok(d, 'the director sees the list'); assert.strictEqual(d.shown, false);
  assert.deepStrictEqual(lines(d.parts.map(p => p.text).join('\n')), lines(LIST.create), 'every place as written');
  assert.strictEqual((await fx.as(ann, '/api/staff/library', {})).body.places, null, 'an educator waits for the director');
  assert.strictEqual((await fx.as(ann, '/api/staff/library/places/show', { on: true })).status, 403);
  assert.strictEqual((await fx.as(dee, '/api/staff/library/places/show', { on: true })).body.places.shown, true);
  assert.ok((await fx.as(ann, '/api/staff/library', {})).body.places, 'shown to educators');
  assert.strictEqual((await fx.as(kit, '/api/staff/library', {})).body.places, null, 'the kitchen never sees it');
  // the director edits an area with the one editor, and the earlier words are kept
  const pg = (await fx.as(dee, '/api/staff/page', { path: d.path })).body;
  const parts = pg.parts.map(p => ({ body: p.body })); parts[0].body += '\n- [A Test Garden](https://example.test/), Santa Rosa. A garden for a test. *Garden, Free.*';
  assert.strictEqual((await fx.as(dee, '/api/staff/page/save', { path: d.path, stamp: pg.stamp, title: pg.title, parts, note: 'A test place', keep: true })).status, 200);
  assert.strictEqual((await fx.as(ann, '/api/staff/page', { path: d.path })).status, 403, 'only the director edits it');
  const after = (await fx.as(dee, '/api/staff/library', {})).body.places;
  assert.strictEqual(lines(after.parts.map(p => p.text).join('\n')).length, 199);
  assert.strictEqual((await fx.as(dee, '/api/staff/page', { path: d.path })).body.history.length, 1);
});

test('the page filters by area and tag, and prints one place as a card and the rest as lists', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  await new Promise(r => setTimeout(r, 3000));
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('museums')); await s.p.waitForSelector('[data-mqgroup]', { timeout: 15000 });
  const r = await s.p.evaluate(async () => {
    const out = {}; window.makePdf = (docs, n) => { out.pdf = { n, docs }; }; window.makeDocx = (docs, n) => { out.word = { n, docs }; };
    const click = async (sel, key) => { if (key) delete out[key]; document.querySelector(sel).click(); if (key) for (let i = 0; i < 60 && !out[key]; i++) await new Promise(r => setTimeout(r, 100)); return key ? out[key] : null; };
    const first = { places: mqPlaces().length, areas: mqAreas(), tags: mqTags(), open: [...document.querySelectorAll('[data-mqgroup]')].some(d => d.open),
      tab: [...document.querySelectorAll('button,a')].some(x => x.textContent.trim() === 'Museums and cultural places'), text: document.querySelector('#main').innerText };
    await click('[data-mqarea="Napa County"]'); const napa = mqShown().length;
    await click('[data-mqtag="Native"]'); const napaNative = mqShown().map(x => x.name);
    await click('[data-mqarea="All"]'); await click('[data-mqtag="Free"]'); const free = mqShown().length;
    const card = await click('[data-print="mqplace"]', 'pdf');
    const area = await click('[data-print="mqarea"]', 'pdf');
    await click('[data-mqtag="All"]'); const all = await click('[data-mqprint="all"][data-word="1"]', 'word');
    const helena = mqPlaces().find(x => x.name === 'Robert Louis Stevenson Museum'); const angel = mqPlaces().find(x => /^Angel Island/.test(x.town));
    return { first, napa, napaNative, free, card, area, all, helena: helena && [helena.town, helena.about.split(' ')[0]], angel: angel && angel.tags };
  });
  assert.strictEqual(r.first.places, 198); assert.strictEqual(r.first.areas.length, 9); assert.strictEqual(r.first.tags.length, 14);
  assert.strictEqual(r.first.open, false, 'every area starts folded'); assert.ok(r.first.tab);
  assert.doesNotMatch(r.first.text, /[—–]|\bteacher|\bClaude\b/);
  assert.strictEqual(r.napa, 7); assert.deepStrictEqual(r.napaNative, ['Bothe-Napa Valley State Park']);
  assert.strictEqual(r.free, 53, 'Free counts a place free for some, such as children 12 and under');
  assert.ok(r.card.docs[0].centered, 'one place prints as a centred card'); assert.strictEqual(r.card.docs.length, 1);
  assert.ok(r.area.docs.every(d => !d.centered && d.display), 'an area prints as a list');
  assert.strictEqual(r.all.docs.length, 9, 'every place, a sheet for each area'); assert.strictEqual(r.all.n, 'Museums and cultural places.docx');
  assert.doesNotMatch(JSON.stringify([r.card, r.all]), /[a-z]\.\./, 'a sentence ends with one full stop');
  assert.doesNotMatch(r.first.text, /[a-z]\.\./);
  assert.strictEqual(r.all.docs.reduce((a, d) => a + d.blocks.filter(b => b.t === 'item').length, 0), 198);
  assert.deepStrictEqual(r.helena, ['St. Helena', 'A'], 'a town with a full stop in its name reads whole');
  assert.deepStrictEqual(r.angel.map(x => x.tag), ['Asian American', 'History', 'Outdoors']);
  assert.deepStrictEqual(s.errors, []);
  // an educator has no tab and no page until the director shows it
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  await a.p.evaluate(() => goView('museums')); await a.p.waitForTimeout(1500);
  assert.match(await a.p.innerText('#main'), /This page is not open yet/);
});
