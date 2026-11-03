'use strict';
// The Weekly bin page shows where the class's week stands, names our bin and the kitchen's produce apart, folds the farms
// into Our farms, and starts a question from a food new in the bin this year. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('the weekly bin page, its steps, its two lists, our farms and wondering from a new food', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const txt = await s.p.evaluate(async () => {
    const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
    const mk = (n, items) => ({ id: day(n), date: day(n), tuesday: true, items: items.map(x => ({ name: x, farms: ['A Farm'] })) });
    for (const w of [mk(28, ['Carrots']), mk(21, ['Carrots']), mk(14, ['Carrots']), mk(1, ['Carrots', 'Fennel'])]) bins.set(w.id, w);
    binFeed.at = Date.now(); binWeek = day(1); binRoom = 'West'; goView('bin'); await new Promise(r => setTimeout(r, 800));
    return document.getElementById('main').innerText;
  });
  assert.match(txt, /West class this week[\s\S]*Done\. See what is coming in the bin[\s\S]*Next\. Choose a question or two to hold[\s\S]*Then\. Print the bin sheet/);
  assert.match(txt, /In our bin, /);
  assert.match(txt, /New in the bin this year[\s\S]*Wonder about Fennel/); assert.doesNotMatch(txt, /Wonder about Carrots/);
  await s.p.click('[data-binact="wonder"]');
  assert.strictEqual(await s.p.inputValue('#bin-idea'), 'I wonder ');
  assert.ok(await s.p.evaluate(() => document.querySelector('[data-binpk="fennel"]') && document.querySelector('[data-binpk="fennel"]').getAttribute('aria-pressed') === 'true'), 'the food is already chosen');
  assert.deepStrictEqual(s.errors, []);
});
