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

  await t.test('Share tapped twice keeps one proud moment', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stmom')); await s.p.waitForSelector('#gm-text');
    await s.p.fill('#gm-text', 'We planted the garlic together');
    await s.p.evaluate(() => { const x = document.querySelector('[data-gmshare]'); x.click(); x.click(); });
    await s.p.waitForFunction(() => /We planted the garlic together/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const n = await s.p.evaluate(() => (document.querySelector('#main').innerText.match(/We planted the garlic together/g) || []).length);
    assert.strictEqual(n, 1);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('words typed in the Growth Plan are still there after opening another page and coming back', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stplan')); await s.p.waitForSelector('#gp-ch');
    await s.p.fill('#gp-ch', 'Rain days indoors');
    await s.p.click('#tsubnav [data-tview="strec"]').catch(async () => { await s.p.evaluate(() => goView('strec')); });
    await s.p.waitForFunction(() => /My records/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    await s.p.evaluate(() => goView('stplan')); await s.p.waitForSelector('#gp-ch');
    assert.strictEqual(await s.p.inputValue('#gp-ch'), 'Rain days indoors');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('a flu shot not on file shows as past due after December 1, in words and not only in color', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.route('**/api/staff/boot', async r => { const res = await r.fetch(); const j = await res.json(); j.today = '2026-12-15'; await r.fulfill({ response: res, json: j }); });
    await s.p.evaluate(() => goView('strec')); await s.p.waitForFunction(() => /Flu vaccine/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Past due, it was due by December 1/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the PD library holds no coming soon line, and the go-to person is named rather than called she', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /Modules/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /Written next|coming soon/i);
    await s.close();
    const n = await signedIn(fx, b, 'Neo', '1357');
    await n.p.evaluate(() => goView('stnew')); await n.p.waitForFunction(() => /Your first two months/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const text = await n.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /Gia answers your questions/);
    assert.deepStrictEqual(n.errors, []); await n.close();
  });

  await t.test('the director\'s list says a Fulton training not done yet is due, not to renew', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('stteam')); await s.p.waitForFunction(() => /Every educator/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const row = await s.p.evaluate(() => [...document.querySelectorAll('[data-stperson]')].find(r => /Ann/.test(r.innerText)).innerText);
    assert.match(row, /1 due/); assert.doesNotMatch(row, /to renew/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('every choice in the Educators settings has a name a screen reader can read', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => goView('settings')); await s.p.waitForSelector('[data-stprof]', { timeout: 15000 });
    const bare = await s.p.evaluate(() => [...document.querySelectorAll('#main select,#main input:not([type=hidden]),#main textarea')].filter(el => !el.getAttribute('aria-label') && !el.closest('label') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.title && !el.placeholder).map(el => el.outerHTML.slice(0, 80)));
    assert.deepStrictEqual(bare, []);
    await s.close();
  });

  await t.test('on a phone muted lines are muted by colour, so a chip inside keeps its contrast', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 360);
    await s.p.evaluate(() => goView('strec')); await s.p.waitForSelector('#main .cnt');
    const ops = await s.p.evaluate(() => [...new Set([...document.querySelectorAll('#main .cnt')].map(e => getComputedStyle(e).opacity))]);
    assert.deepStrictEqual(ops, ['1']);
    await s.close();
  });
});
