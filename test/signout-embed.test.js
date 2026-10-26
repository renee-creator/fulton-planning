'use strict';
/* Signing out while Conferences or Calendar is open leaves the sign-in screen still. Before, the page inside TREE found
   no sign-in and reloaded TREE, which opened the same page again, over and over. */
const test = require('node:test'), assert = require('assert');
const fx = require('./fixture.js');
test('signing out from Conferences or Calendar does not reload TREE over and over', async t => {
  const chromium = await fx.browser(); if (!chromium) return t.skip('Playwright is not installed');
  const f = await fx.start(); const b = await chromium.launch();
  try {
    for (const v of ['conferences', 'calendar']) {
      const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } }); const p = await ctx.newPage();
      await p.goto(f.page); await p.waitForSelector('#gate-name');
      await p.fill('#gate-name', 'Ann'); await p.fill('#gate-code', '1357'); await p.click('#gate-btn');
      await p.waitForFunction(() => window.FP_NAME && window.FP_NAME() === 'Ann' && typeof goView === 'function', null, { timeout: 15000 });
      await p.evaluate(v => goView(v), v); await p.waitForSelector('iframe.embed'); await p.waitForTimeout(3000);
      let loads = 0; p.on('framenavigated', fr => { if (fr === p.mainFrame()) loads++; });
      await p.click('.who-chip button'); await p.waitForTimeout(8000);
      assert.ok(loads <= 1, v + ': TREE loaded ' + loads + ' times after signing out');
      assert.equal(await p.evaluate(() => document.getElementById('gate').hidden), false);
      // a computer signed out with the page still remembered from before stays on the sign-in screen
      await p.evaluate(v => localStorage.setItem('fps.view', JSON.stringify(v)), v);
      loads = 0; await p.reload(); await p.waitForTimeout(8000);
      assert.ok(loads <= 1, v + ': TREE loaded ' + loads + ' times while signed out');
      await ctx.close();
    }
  } finally { await b.close(); await f.stop(); }
});
