'use strict';
// TREE in a browser, at phone width and on a desktop, against the made-up school in fixture.js
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('TREE in the browser', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const h2 = p => p.evaluate(() => (document.querySelector('#main h2') || {}).textContent || '');

  await t.test('another page opens even while a box on the page has focus', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1');
    await s.p.evaluate(() => goView('stjour')); await s.p.waitForSelector('#gj-pass'); await s.p.focus('#gj-pass'); await s.p.waitForTimeout(1200);
    await s.p.evaluate(() => goView('today')); await s.p.waitForTimeout(800);
    assert.match(await h2(s.p), /Good (morning|afternoon|evening)/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a check-in reads its day in full and its time in words', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357');
    await s.p.evaluate(() => goView('stci')); await s.p.waitForFunction(() => /My next check-in/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /quarter past ten/);
    assert.doesNotMatch(text, /\d:\d\d/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
