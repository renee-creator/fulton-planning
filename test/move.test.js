'use strict';
// Move children, the director's, on the Children page. Children picked by Class, small group or next year, ticked, and moved
// to a new Class and small group after one review. Each child keeps their id, so their records stay with them, and each
// move is noted on the child the way moving one child from the Details tab notes it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

test('Move children', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => {
    put('settings/program.json', { id: 'program', classrooms: ['West', 'North', 'South'], groups: [{ name: 'Fern', room: 'North', educator: 'Bea' }, { name: 'Moss', room: 'North', educator: 'Bea' }, { name: 'Clover', room: 'West', educator: 'Ann' }] });
    put('children/pip-test.json', { first: 'Pip', last: 'Test', classroom: 'North', group: 'Fern', dob: '2022-03-01', status: 'active', transition: { '2027-28': { plan: 'k' } } });
    put('children/rue-test.json', { first: 'Rue', last: 'Test', classroom: 'North', group: 'Fern', dob: '2022-05-01', status: 'active' });
    put('children/tam-test.json', { first: 'Tam', last: 'Test', classroom: 'North', group: 'Moss', dob: '2022-07-01', status: 'active' });
    put('children/oli-test.json', { first: 'Oli', last: 'Test', classroom: 'West', group: 'Clover', dob: '2021-11-01', status: 'active', transition: { '2027-28': { plan: 'k' } } });
    put('notices/m1.json', { id: 'm1', noticed: 'Pip and Rue dug for worms.', wonder: '', classroom: 'North', children: ['pip-test', 'rue-test'], by: 'Bea', at: Date.now() - 864e5 });
    put('conferences/pip-test--2026-27-fall.json', { childId: 'pip-test', schoolYear: '2026-27', term: 'Fall', fields: { interests: 'Worms' } });
  } });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const kid = id => JSON.parse(fs.readFileSync(path.join(fx.dir, 'children', id + '.json'), 'utf8'));
  const main = p => p.evaluate(() => document.querySelector('#main').innerText);

  await t.test('educators do not see Move children', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    await s.p.evaluate(() => goView('children')); await s.p.waitForTimeout(800);
    assert.strictEqual(await s.p.$('[data-kmvopen]'), null);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  for (const w of [390, 1280]) await t.test('the director picks, ticks, reviews and moves, at ' + w, async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', w);
    await s.p.evaluate(() => goView('children')); await s.p.waitForSelector('[data-kmvopen]');
    await s.p.click('[data-kmvopen]'); await s.p.waitForSelector('#kmove');
    if (w === 390) {
      // by small group, Fern, both ticked, then Oli by next year, all moved to West's Clover group
      await s.p.click('[data-kmvby="group"]'); await s.p.selectOption('[data-kmvval]', 'Fern');
      await s.p.click('[data-kmvall]');
      assert.match(await main(s.p), /2 children ticked/);
      await s.p.click('[data-kmvby="next"]'); await s.p.selectOption('[data-kmvval]', 'k');
      await s.p.check('[data-kmvtick="oli-test"]');
      await s.p.selectOption('[data-kmvroom]', 'West'); await s.p.selectOption('[data-kmvgroup]', 'Clover');
      await s.p.click('[data-kmvreview]'); await s.p.waitForSelector('[data-kmvsave]');
      const text = await main(s.p);
      assert.match(text, /Review the moves/); assert.match(text, /2 children move to West class, Clover group/);
      assert.match(text, /Pip Test\s+From North class, Fern group\s+To West class, Clover group/);
      assert.match(text, /Oli Test\s+Stays as it is/);
      // nothing is saved before the moves are saved
      assert.strictEqual(kid('pip-test').classroom, 'North');
      assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await s.p.click('[data-kmvsave]'); await s.p.waitForTimeout(2500);
      for (const id of ['pip-test', 'rue-test']) {
        const c = kid(id);
        assert.strictEqual(c.classroom, 'West'); assert.strictEqual(c.group, 'Clover');
        const notes = c.treeHistory.map(h => h.what);
        assert.deepStrictEqual(notes.slice(-2), ['Moved from North to West', 'Joined Clover']);
        assert.strictEqual(c.treeHistory.slice(-1)[0].by, 'Dee');
      }
      assert.strictEqual(kid('pip-test').dob, '2022-03-01'); assert.strictEqual(kid('pip-test').transition['2027-28'].plan, 'k');
      assert.strictEqual(kid('oli-test').treeHistory, undefined);
      assert.strictEqual(kid('tam-test').classroom, 'North');
      // the child's records stay with them
      await s.p.evaluate(() => { kidOpen = 'pip-test'; kidTab = 'docs'; goView('child'); }); await s.p.waitForTimeout(600);
      assert.match(await main(s.p), /dug for worms/);
    } else {
      // within a Class, Tam moves to another small group, and the review shows only that change
      await s.p.selectOption('[data-kmvval]', 'North');
      await s.p.check('[data-kmvtick="tam-test"]');
      await s.p.selectOption('[data-kmvroom]', 'North'); await s.p.selectOption('[data-kmvgroup]', 'Fern');
      await s.p.click('[data-kmvreview]'); await s.p.waitForSelector('[data-kmvsave]');
      assert.match(await main(s.p), /Tam Test\s+From North class, Moss group\s+To North class, Fern group/);
      await s.p.click('[data-kmvback]'); await s.p.waitForSelector('[data-kmvreview]');
      await s.p.click('[data-kmvreview]'); await s.p.click('[data-kmvsave]'); await s.p.waitForTimeout(2500);
      const c = kid('tam-test'); assert.strictEqual(c.classroom, 'North'); assert.strictEqual(c.group, 'Fern');
      assert.deepStrictEqual(c.treeHistory.map(h => h.what), ['Joined Fern']);
    }
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('moving one child from the Details tab notes it the same way as before', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await s.p.evaluate(() => { kidOpen = 'oli-test'; kidTab = 'details'; goView('child'); }); await s.p.waitForSelector('[data-kroomset="oli-test"]');
    if (await s.p.$('[data-unlock]')) await s.p.click('[data-unlock]');
    await s.p.selectOption('[data-kroomset="oli-test"]', 'North'); await s.p.waitForTimeout(2500);
    const c = kid('oli-test'); assert.strictEqual(c.classroom, 'North'); assert.strictEqual(c.group, '');
    assert.deepStrictEqual(c.treeHistory.map(h => h.what), ['Moved from West to North']);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
