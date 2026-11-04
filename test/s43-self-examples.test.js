'use strict';
// The self-assessment's examples come from the educator's own work this year, matched to each growth area's key words
// the way module examples are, newest first among the relevant. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

test('the field rules are gone, and each area reads the educator\'s own work through exRank', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', 'src', 'growth-app.js'), 'utf8');
  const a = g.indexOf('function examplesFor('), b = g.indexOf('const exHtml=');
  const fn = g.slice(a, b);
  assert.ok(a > 0 && b > a);
  assert.match(fn, /exRank\(m,mods,pool,areaRes,false\)/);
  assert.doesNotMatch(fn, /if\(area==="img"\)|if\(area==="env"\)|if\(area==="refl"\)/, 'no field rule per area');
  assert.match(fn, /sort\(\(a,b\)=>\(b\.at\|\|0\)-\(a\.at\|\|0\)\)/, 'newest first among the relevant');
  for (const k of ['img', 'env', 'lang', 'obs', 'cur', 'fam', 'team', 'refl']) assert.match(g, new RegExp('\\n  ' + k + ':\\["'), k + ' has its reading');
  assert.doesNotMatch(g.slice(g.indexOf('const AREA_READING'), b), /teacher|[—–]/);
});

test('an educator sees her most relevant work under each area, newest first among those that fit', async t => {
  const at = Date.now() - 2 * 864e5;
  const fx = await start({ more: put => {
    put('notices/e1.json', { id: 'e1', at, classroom: 'West', by: 'Ann', noticed: 'I set out a provocation of natural materials, stones, shells and driftwood, arranged on the light table so the space itself invited the children in.', wonder: '' });
    put('notices/e2.json', { id: 'e2', at: at - 3 * 864e5, classroom: 'West', by: 'Ann', noticed: 'We rearranged the environment and added beautiful loose parts to the atelier shelf, with the materials in baskets at the children\'s height.', wonder: '' });
    put('notices/e3.json', { id: 'e3', at: at - 864e5, classroom: 'West', by: 'Ann', noticed: 'At pick-up a parent and I talked about the family\'s week, and we agreed to keep sharing at the conference.', wonder: 'What would the family like to see more of from home?' });
    put('notices/e4.json', { id: 'e4', at: at - 4 * 864e5, classroom: 'West', by: 'Bea', noticed: 'Bea\'s own provocation with materials and natural things in the environment.', wonder: '' });
  } });
  t.after(() => fx.stop());
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Ann', '1357', 1280);
  await s.p.evaluate(() => goView('stgrow'));
  await s.p.waitForSelector('[data-gtab="continuum"]', { timeout: 15000 });
  await s.p.click('[data-gtab="continuum"]');
  await s.p.waitForSelector('.garea details', { timeout: 15000 });
  const areas = await s.p.evaluate(() => [...document.querySelectorAll('.garea')].map(a => ({ name: a.querySelector('b').innerText, ex: [...a.querySelectorAll(".gex .cnt")].map(x => x.textContent) })));
  const env = areas.find(a => /Environment/.test(a.name)), fam = areas.find(a => /Families/.test(a.name));
  assert.ok(env && env.ex.length >= 2, 'the environment area found Ann\'s environment work');
  assert.match(env.ex[0], /provocation of natural materials/, 'the newest relevant piece first');
  assert.match(env.ex[1], /rearranged the environment/);
  assert.ok(!env.ex.some(x => /pick-up a parent/.test(x)), 'the family observation is not an environment example');
  assert.ok(!areas.some(a => a.ex.some(x => /Bea's own/.test(x))), 'never another educator\'s work');
  assert.ok(fam && fam.ex.some(x => /pick-up a parent|family like to see/.test(x)), 'the family area found the conversation with a parent');
  assert.deepStrictEqual(s.errors, []); await s.close();
});
