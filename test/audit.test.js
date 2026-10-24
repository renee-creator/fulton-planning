'use strict';
// fixes from the Session 7 audit, in a browser against the made-up school in fixture.js
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('audit fixes in the browser', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });

  await t.test('leaving the journal any way closes it, so it asks for the passcode again', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stjour')); await s.p.waitForSelector('#gj-pass'); await s.p.fill('#gj-pass', '1357');
    await s.p.click('[data-gjopen]'); await s.p.waitForFunction(() => !document.querySelector('#gj-pass'), null, { timeout: 10000 });
    await s.p.evaluate(() => goView('today')); await s.p.waitForTimeout(600); await s.p.evaluate(() => goView('stjour'));
    await s.p.waitForSelector('#gj-pass', { timeout: 10000 });
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a new hire who reaches a page not open to them lands in Educators, never on Today', async () => {
    const s = await signedIn(fx, b, 'Neo', '1357');
    await s.p.evaluate(() => goView('plans')); await s.p.waitForTimeout(800);
    assert.ok(await s.p.evaluate(() => STAFF_VIEWS.includes(view)), 'the new hire stays in Educators');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
