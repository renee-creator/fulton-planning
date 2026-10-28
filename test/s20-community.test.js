'use strict';
// The museums and the plants on our site for the whole community. Each part waits for the director's switch, the plants
// wait for the Garden to be ready, and the public page holds nothing else of TREE. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const GARDEN = { ready: true, beds: [{ id: 'b1', name: 'North bed' }],
  plants: [{ id: 'p1', common: 'Calendula', botanical: 'Calendula officinalis', eat: 'partly', taste: 'We taste only the petals.', words: { child: 'Bright orange flowers.', adult: 'It sows itself' }, bed: 'b1', uses: ['dye'], ready: ['05'] },
    { id: 'p2', common: 'A plant still planned', planned: true }],
  wild: [{ id: 'w1', kind: 'wildlife', name: 'Western fence lizard', know: 'Basks on warm rocks.', photo: { url: 'https://example.test/lizard.jpg', by: 'A. Observer', license: 'CC BY' } }],
  fieldGuides: [{ space: 'north-yard', title: 'North yard', entries: ['p1', 'w1'] }] };
const more = put => {
  put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog' });
};
async function setup(t) {
  const fx = await start({ more }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  for (let i = 0; i < 100; i++) { const l = (await fx.as(dee, '/api/staff/library', {})).body; if (l && l.places) break; await wait(200); }
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  const sw = async (key, on) => (await fx.as(dee, '/api/staff/library/places/switch', { key, on })).body;
  return { fx, dee, ann, fam, sw, data: async () => (await fx.as(fam, '/family/data', {})).body, pub: () => fx.as('', '/public/community', {}) };
}

test('each part waits for its switch, and the public page holds only the museums and the plants', async t => {
  const { fx, dee, ann, sw, data, pub } = await setup(t);
  assert.deepStrictEqual((await fx.as(dee, '/api/staff/library', {})).body.places.switches, { show: false, family: false, plantsFamily: false, public: false });
  assert.strictEqual((await data()).community, null, 'families see nothing yet');
  assert.strictEqual((await pub()).status, 403); assert.match((await pub()).body.error, /not open yet/);
  assert.strictEqual((await fx.as(ann, '/api/staff/library/places/switch', { key: 'public', on: true })).status, 403, 'only the director');
  assert.strictEqual((await fx.as(ann, '/api/staff/library', {})).body.places, null);
  await sw('show', true); assert.ok((await fx.as(ann, '/api/staff/library', {})).body.places, 'every educator once shown');
  await sw('family', true);
  let c = (await data()).community; assert.ok(c.places && c.places.parts.length === 9); assert.strictEqual(c.plants, null, 'the plants wait for their own switch');
  await sw('plantsFamily', true);
  c = (await data()).community;
  assert.deepStrictEqual(c.plants.plants.map(p => p.common), ['Calendula'], 'a planned plant stays with the staff');
  const p = c.plants.plants[0];
  assert.strictEqual(p.child, 'Bright orange flowers.'); assert.match(p.page, /Grows in North bed\. Uses, dye\. Harvest or gather in May\. It sows itself\./);
  assert.deepStrictEqual(c.plants.fieldGuides.map(f => [f.title, f.entries.map(e => e.name)]), [['North yard', ['Calendula', 'Western fence lizard']]]);
  assert.match(c.plants.fieldGuides[0].entries[1].photo.credit, /Photo by A\. Observer, CC BY/);
  // the public page
  await sw('public', true);
  const r = await pub(); assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(Object.keys(r.body).sort(), ['places', 'plants']);
  assert.doesNotMatch(JSON.stringify(r.body), /\bPip\b|pip\.family|\bAnn\b|\bDee\b/, 'no child, family or educator');
  // the plants wait for the Garden to be ready, wherever they show
  const g = (await fx.as(dee, '/api/staff/garden', {})).body; assert.ok(g.ready);
  await sw('family', false); await sw('plantsFamily', false);
  assert.strictEqual((await data()).community, null);
});

test('a family opens Places and plants, and anyone opens the public page', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, fam, sw } = await setup(t);
  await sw('family', true); await sw('plantsFamily', true); await sw('public', true);
  const br = await b.launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('text=Places and plants', { timeout: 10000 }); await p.click('button[data-tab="places"]');
  await p.waitForSelector('text=Places to visit near us');
  assert.strictEqual(await p.evaluate(() => [...document.querySelectorAll('#main details')].some(d => d.open)), false, 'every part starts folded');
  await p.click('summary:has-text("Places to visit near us")'); await p.click('[data-cmarea="Napa County"]'); await p.click('[data-cmtag="Native"]');
  assert.match(await p.innerText('#main'), /1 of 198 places/); assert.match(await p.innerText('#main'), /Bothe-Napa Valley State Park/);
  await p.click('summary:has-text("Plants on our site")'); await p.click('summary:has-text("Calendula")');
  assert.match(await p.innerText('#main'), /Bright orange flowers\.[\s\S]*Partly edible\. We taste only the petals\./);
  assert.doesNotMatch(await p.innerText('body'), /[—–]|\bteacher|\bClaude\b/);
  assert.deepStrictEqual(errors, []);
  // the public page, with no sign-in
  const q = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const qe = []; q.on('pageerror', e => qe.push(e.message));
  await q.goto(`http://localhost:${fx.web}/places.html?server=${fx.api}`); await q.waitForSelector('text=Places to visit near us', { timeout: 10000 });
  await q.click('summary:has-text("Plants on our site")'); await q.click('summary:has-text("North yard")');
  assert.match(await q.innerText('body'), /Western fence lizard[\s\S]*Photo by A\. Observer/);
  assert.deepStrictEqual(qe, []);
  // turned off, the public page says so
  await sw('public', false); await q.reload(); await q.waitForSelector('text=This page is not open yet');
});

test('the director turns each part on in Settings, Releases', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx } = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('settings')); await s.p.waitForTimeout(1500);
  await s.p.evaluate(() => { const b = [...document.querySelectorAll('summary,button,b,.lbl')].find(x => /^Releases$/.test(x.textContent.trim())); if (b) b.click(); });
  await s.p.waitForSelector('[data-commsw="public"]', { timeout: 15000, state: 'attached' });
  await s.p.evaluate(() => { const x = document.querySelector('[data-commsw="public"]'); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); });
  await s.p.waitForFunction(() => libData && libData.places && libData.places.switches.public, null, { timeout: 10000 });
  assert.deepStrictEqual(s.errors, []);
});
