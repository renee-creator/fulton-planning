'use strict';
// A garden task ticked on Today leaves Today, and stays on the Garden page to undo. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const mm = String(new Date().getMonth() + 1).padStart(2, '0');
const more = put => {
  put('staff/garden/setup.json', { ready: true, beds: [], plants: [], plan: { months: { [mm]: { tasks: [{ id: 't1', text: 'Turn the compost' }, { id: 't2', text: 'Water the seed trays' }] } } } });
  put('staff/garden/log.json', { id: 'gardenlog' });
};

test('a ticked garden task leaves Today, and all done says so', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 390); t.after(() => s.close());
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('text=In the garden today', { timeout: 15000 });
  await s.p.waitForSelector('text=2 to do');
  await s.p.click('#main .gtask:has-text("Turn the compost") button.gdone');
  await s.p.waitForSelector('text=1 to do', { timeout: 15000 });
  assert.doesNotMatch(await s.p.innerText('#main'), /Turn the compost/);
  await s.p.click('#main .gtask:has-text("Water the seed trays") [data-passed]');
  await s.p.waitForSelector('text=All done', { timeout: 15000 });
  assert.doesNotMatch(await s.p.innerText('#main'), /Water the seed trays/);
  // the Garden page keeps both, to undo
  await s.p.evaluate(() => goView('garden')); await s.p.waitForSelector('text=Turn the compost', { timeout: 15000 });
  assert.match(await s.p.innerText('#main'), /Water the seed trays/);
  assert.deepStrictEqual(s.errors, []);
});
