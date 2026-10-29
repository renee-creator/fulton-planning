'use strict';
// On a phone, Observations shows the first of a long list with Show all. Tapping an observation in Search opens
// Observations at that observation, with the list unfolded around it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const more = put => { for (let i = 0; i < 80; i++) put(`notices/n${i}.json`, { id: 'n' + i, noticed: i === 57 ? 'Zebra puzzle finished at last by the window' : 'Played in the sand ' + i, at: Date.now() - i * 864e5 / 3, classroom: i % 2 ? 'West' : 'North', by: 'Ann' }); };

test('a search result opens Observations at that observation, on a phone', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 390); t.after(() => s.close());
  await s.p.evaluate(() => goView('search')); await s.p.waitForTimeout(1000);
  await s.p.fill('#main input[type=search], #main input[type=text]', 'zebra'); await s.p.waitForSelector('[data-mjump="n57"]');
  await s.p.click('[data-mjump="n57"]');
  await s.p.waitForFunction(() => { const el = document.getElementById('nw-n57'); if (!el) return false; const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; }, null, { timeout: 10000 });
  assert.strictEqual(await s.p.evaluate(() => view), 'moments');
  assert.ok(await s.p.evaluate(() => scrollY > 0), 'the page moved to it');
  assert.deepStrictEqual(s.errors, []);
});
