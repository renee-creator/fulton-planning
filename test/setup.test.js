'use strict';
// who is not set up yet, on Sign-ins and once on the director's Today. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('Never signed in and Reminders off on this phone show beside each name and once on the director\'s Today', async t => {
  const fx = await start({ more: put => put('access/accounts.json', { accounts: [
    { name: 'Ann', room: 'West', code: '1357', v: 1, setAt: 1, push: [{ endpoint: 'https://push.example/a', keys: { p256dh: 'a', auth: 'b' } }] },
    { name: 'Bea', room: 'North', code: '1357', v: 1, setAt: 1, lastAt: 1 }, { name: 'Cy', code: '', start: '123456', v: 0 },
    { name: 'Gone', code: '1357', v: 1, setAt: 1, leaveOn: '2020-01-01' }, { name: 'Neo', newHire: true, code: '1357', v: 1 }] }) });
  try {
    const dt = (await fx.login('Dee', 'director-pass-1')).token;
    const r = await fx.as(dt, '/api/accounts'); const acc = n => r.body.accounts.find(a => a.name === n);
    assert.strictEqual(acc('Cy').never, true); assert.strictEqual(acc('Bea').never, false);
    assert.strictEqual(acc('Ann').phones, 1); assert.strictEqual(acc('Bea').phones, 0);
    assert.strictEqual(JSON.stringify(r.body).includes('push.example'), false, 'the phone itself is never sent');
    const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
    const b = await chromium.launch();
    try {
      const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 390);
      await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('#setuptoday', { timeout: 15000 });
      assert.strictEqual(await s.p.$eval('#setuptoday details', d => d.open), false, 'the list starts folded');
      await s.p.click('#setuptoday summary');
      const text = await s.p.innerText('#setuptoday');
      assert.match(text, /Bea\s+Reminders off on this phone/); assert.match(text, /Cy\s+Never signed in/);
      assert.doesNotMatch(text, /Ann|Gone|Dee/);
      assert.strictEqual((text.match(/Not set up yet/g) || []).length, 1);
      await s.p.evaluate(() => goView('settings')); await s.p.waitForSelector('#signins table', { timeout: 15000 });
      assert.match(await s.p.innerText('#signins'), /Cy\s+Never signed in/);
      assert.deepStrictEqual(s.errors, []); await s.close();
      const e = await signedIn(fx, b, 'Bea', '1357', 390); await e.p.evaluate(() => goView('today')); await e.p.waitForTimeout(800);
      assert.strictEqual(await e.p.$('#setuptoday'), null, 'only the director sees the list');
      assert.deepStrictEqual(e.errors, []); await e.close();
    } finally { await b.close(); }
  } finally { await fx.stop(); }
});
