'use strict';
// The Participation page's starting ideas. The director and the office change an idea's words, hide it or put it back
// as it was, and a hidden idea is never offered as a starting point. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

test('an idea is changed, hidden and put back, and the office can do the same', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => { ptForm = { type: 'task' }; goView('participation'); }); await s.p.waitForSelector('details.ptbank', { timeout: 15000 });
  await s.p.click('details.ptbank > summary'); await s.p.click('[data-ptbedit]');
  const garden = await s.p.evaluate(() => ptStarterKey({ title: 'Garden workday' })), dough = await s.p.evaluate(() => ptStarterKey({ title: 'Make playdough' }));
  await s.p.fill(`#ptb-n-${garden}`, 'Weeding and planting with the children\'s small groups.');
  await s.p.click(`[data-ptbsave="${garden}"]`); await s.p.waitForTimeout(800);
  await s.p.check(`#ptb-x-${dough}`); await s.p.click(`[data-ptbsave="${dough}"]`); await s.p.waitForTimeout(800);
  await s.p.click('[data-ptbedit]');
  const chips = await s.p.evaluate(() => [...document.querySelectorAll('details.ptbank [data-ptbank]')].map(x => x.textContent));
  assert.ok(chips.includes('Garden workday')); assert.ok(!chips.includes('Make playdough'), 'a hidden idea is not offered');
  await s.p.click('details.ptbank [data-ptbank]:text-is("Garden workday")');
  assert.strictEqual(await s.p.evaluate(() => ptForm.note), 'Weeding and planting with the children\'s small groups.');
  // kept in the records
  await new Promise(r => setTimeout(r, 2500));
  const kept = JSON.parse(fs.readFileSync(path.join(fx.dir, 'participation/starters.json'), 'utf8'));
  assert.strictEqual(kept.edits[dough].hidden, true); assert.match(kept.edits[garden].note, /^Weeding and planting/);
  assert.deepStrictEqual(s.errors, []);
  // the office puts the playdough idea back as it was
  const o = await signedIn(fx, br, 'Gia', '1357', 1100); t.after(() => o.close());
  await o.p.evaluate(() => { ptForm = { type: 'task' }; goView('participation'); }); await o.p.waitForSelector('details.ptbank', { timeout: 15000 });
  await o.p.click('details.ptbank > summary'); await o.p.click('[data-ptbedit]'); await o.p.click(`[data-ptbreset="${dough}"]`); await o.p.waitForTimeout(800); await o.p.click('[data-ptbedit]');
  assert.ok(await o.p.evaluate(() => [...document.querySelectorAll('details.ptbank [data-ptbank]')].some(x => x.textContent === 'Make playdough')));
  assert.deepStrictEqual(o.errors, []);
});
