'use strict';
// The farm animals on the Family page's Our school, each a fold with its card and each named animal with its own
// photo beside its name. The public page keeps only the plants. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const GARDEN = { ready: true, beds: [], plants: [{ id: 'p1', common: 'Calendula', eat: 'food', words: { child: 'Bright flowers.' } }],
  animals: [{ id: 'a-goats', name: 'Goats', vocab: ['kid'], health: 'Wash hands after.', card: { know: 'Goats chew cud.', wonder: 'What do you notice when a goat rests?', rule: 'Gentle hands.', family: 'A kid, a doe and a buck.' },
    names: [{ name: 'Ivy', breed: 'Saanen' }, { name: 'Ribbit', breed: 'LaMancha' }], breeds: [{ breed: 'Saanen', goats: ['Ivy'], notice: 'Upright ears.' }] },
    { id: 'a-hidden', name: 'Kept with the staff', hidden: true }] };
const more = put => {
  put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  put('staff/garden/setup.json', GARDEN);
  put('staff/garden/log.json', { id: 'gardenlog', photos: [{ id: 'ph-herd', plant: 'a-goats', ok: true, at: 1 }, { id: 'ph-ivy', plant: 'a-goats', name: 'Ivy', ok: true, at: 2 }] });
};

test('a family sees each animal, its card and each named animal with its photo, and the public page does not', async t => {
  const fx = await start({ more }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  for (let i = 0; i < 100; i++) { const l = (await fx.as(dee, '/api/staff/library', {})).body; if (l && l.places) break; await wait(200); }
  for (const key of ['family', 'plantsFamily', 'public']) await fx.as(dee, '/api/staff/library/places/switch', { key, on: true });
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  const a = (await fx.as(fam, '/family/data', {})).body.community.plants.animals;
  assert.deepStrictEqual(a.map(x => x.name), ['Goats'], 'a hidden animal stays with the staff');
  assert.deepStrictEqual([a[0].know, a[0].rule, a[0].words], ['Goats chew cud.', 'Gentle hands.', ['kid']]);
  assert.deepStrictEqual(a[0].names.map(n => [n.name, n.breed, !!(n.photo && /ph-ivy/.test(n.photo.src))]), [['Ivy', 'Saanen', true], ['Ribbit', 'LaMancha', false]]);
  assert.match(a[0].photo.src, /ph-herd/, 'the herd photo is not a named one');
  assert.deepStrictEqual((await fx.as('', '/public/community', {})).body.plants.animals, [], 'the public page keeps only the plants');

  const b = await browser(); if (!b) return;
  const br = await b.launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('button[data-tab="school"]', { timeout: 10000 }); await p.click('button[data-tab="school"]');
  await p.waitForSelector('text=Our animals');
  assert.strictEqual(await p.evaluate(() => [...document.querySelectorAll('#main details')].some(d => d.open)), false, 'every part starts folded');
  await p.click('summary:has-text("Our animals")'); await p.click('summary:has-text("Goats")');
  const txt = await p.innerText('#main');
  assert.match(txt, /Goats chew cud\.[\s\S]*Gentle hands\.[\s\S]*Saanen\. Upright ears\.[\s\S]*Ivy[\s\S]*Ribbit/);
  assert.strictEqual(await p.$$eval('.cm-name img', xs => xs.map(x => x.alt)).then(x => x.join()), 'Ivy');
  assert.doesNotMatch(await p.innerText('body'), /[—–]|\bteacher|\bClaude\b/);
  assert.deepStrictEqual(errors, []);
});
