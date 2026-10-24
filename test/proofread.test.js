'use strict';
// Proofread observations, the director's page: oldest first, side by side, nothing saved until approved, the educator stays
// the author, a child's name and quoted words are never changed, and a proofread that cannot be reached keeps the list
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

test('Proofread observations', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const day = 864e5, now = Date.now();
  const fx = await start({ more: put => {
    put('children/juno.json', { first: 'Juno', last: 'Test', classroom: 'North', dob: '2022-01-05', status: 'enrolled' });
    put('notices/n1.json', { id: 'n1', noticed: 'Juno sayed "I sees a worm" by the North garden bed.', wonder: 'what do the worms eat', classroom: 'North', by: 'Ann', at: now - 30 * day, week: '2026-09-21' });
    put('notices/n2.json', { id: 'n2', noticed: 'The childs plantd garlic.', wonder: '', classroom: 'West', by: 'Bea', at: now - 10 * day, week: '2026-10-12' });
    put('notices/n3.json', { id: 'n3', noticed: 'Already read and fine.', wonder: '', classroom: 'West', by: 'Bea', at: now - 40 * day, week: '2026-09-14', proofread: { at: 1, by: 'Dee' } });
  } });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  // the proofread service, standing in for the real one. It also tries to change a child's quoted words and name, which TREE leaves out.
  const answer = { n1: [['Juno sayed', 'Juno said'], ['"I sees a worm"', '"I see a worm"'], ['Juno sayed "I', 'June said "I'], ['what do', 'What do'], ['worms eat', 'worms eat?']], n2: [['childs plantd', "children planted"]] };
  const serve = async route => { const prompt = JSON.parse(route.request().postData()).content.map(c => c.text || '').join('');
    const ids = [...prompt.matchAll(/<text id="([^"]+)">/g)].map(m => m[1]);
    const fixes = []; for (const id of ids) { const [nid, k] = id.split('|'); for (const [from, to] of answer[nid] || []) if ((k === 'n') === !/^(what|worms)/.test(from)) fixes.push({ id, from, to, why: 'Spelling' }); }
    await route.fulfill({ json: { text: JSON.stringify({ fixes }) } }); };
  const rec = id => JSON.parse(fs.readFileSync(path.join(fx.dir, 'notices', id + '.json'), 'utf8'));

  await t.test('only the director finds the page', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357');
    await s.p.evaluate(() => goView('moments')); await s.p.waitForTimeout(1000);
    assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /Proofread observations/);
    await s.p.evaluate(() => goView('proofobs')); await s.p.waitForTimeout(800);
    assert.notStrictEqual(await s.p.evaluate(() => view), 'proofobs');
    await s.close();
  });

  for (const w of [360, 1280]) await t.test('oldest first, side by side with changes marked, and saved only when approved, at ' + w, async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', w);
    await s.p.route('**/api/read', serve);
    await s.p.evaluate(() => goView('moments')); await s.p.waitForSelector('[data-tview="proofobs"]');
    assert.match(await s.p.textContent('[data-tview="proofobs"]'), w === 360 ? /2 left/ : /1 left/);
    await s.p.click('[data-tview="proofobs"]');
    await s.p.waitForSelector('[data-pfok]', { timeout: 15000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    if (w === 360) {
      assert.match(text, /2 observations left to proofread/);
      const order = await s.p.$$eval('.pfitem', xs => xs.map(x => x.dataset.pfid)); assert.deepStrictEqual(order, ['n1', 'n2']);
      assert.strictEqual(await s.p.$$eval('.pfitem[data-pfid="n1"] del', x => x.map(e => e.textContent).join(' ')), 'sayed what eat');
      assert.match(await s.p.$$eval('.pfitem[data-pfid="n1"] ins', x => x.map(e => e.textContent).join(' ')), /said/);
      assert.match(text, /"I sees a worm"/); assert.doesNotMatch(text, /June/);
      // nothing is saved before approving
      assert.strictEqual(rec('n1').noticed, 'Juno sayed "I sees a worm" by the North garden bed.');
      await s.p.click('[data-pfok="n1"]'); await s.p.waitForTimeout(2500);
      const n1 = rec('n1');
      assert.strictEqual(n1.noticed, 'Juno said "I sees a worm" by the North garden bed.'); assert.strictEqual(n1.wonder, 'What do the worms eat?');
      assert.strictEqual(n1.by, 'Ann'); assert.ok(n1.proofread && n1.proofread.at);
      assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /1 observation left to proofread/);
      assert.strictEqual(await s.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    } else {
      // the proofread words can be changed before approving
      await s.p.click('[data-pfedit1="n2"]'); await s.p.fill('[data-pfedit="n2|noticed"]', 'The children planted garlic cloves.');
      await s.p.click('[data-pfok="n2"]'); await s.p.waitForTimeout(2500);
      assert.strictEqual(rec('n2').noticed, 'The children planted garlic cloves.'); assert.strictEqual(rec('n2').by, 'Bea');
      assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /Every observation has been proofread/);
    }
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('when the proofread cannot be reached, the page says so and keeps the list, and Approve all saves the rest', async () => {
    answer.n4 = [['carryed', 'carried']]; answer.n5 = [['snale', 'snail']];
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    // two more observations, kept the way TREE keeps one
    await s.p.evaluate(now => { for (const [id, w, d] of [['n4', 'Pip carryed the hose.', 5], ['n5', 'Rue found a snale.', 4]]) saveNotice({ id, noticed: w, wonder: '', classroom: 'West', by: 'Ann', at: now - d * 864e5 }); }, now);
    await s.p.waitForTimeout(1500);
    await s.p.route('**/api/read', r => r.abort());
    await s.p.evaluate(() => goView('proofobs'));
    await s.p.waitForFunction(() => /could not be reached/.test(document.querySelector('#main').innerText), null, { timeout: 30000 });
    const text = await s.p.evaluate(() => document.querySelector('#main').innerText);
    assert.match(text, /2 observations left to proofread/); assert.match(text, /Pip carryed the hose/);
    await s.p.unroute('**/api/read'); await s.p.route('**/api/read', serve);
    await s.p.click('[data-pfgo]'); await s.p.waitForSelector('[data-pfall]', { timeout: 15000 });
    await s.p.click('[data-pfall]'); await s.p.waitForTimeout(2500);
    assert.strictEqual(rec('n4').noticed, 'Pip carried the hose.'); assert.strictEqual(rec('n5').noticed, 'Rue found a snail.');
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
