'use strict';
// October 31, 2026. Educators on a phone. Final remarks wait only for the last three weeks. Grouped Observations list every
// group of the chosen class at once, folded with its count. An educator deletes her own draft after a question. The
// Growth pages stay as buttons, and Enter opens the journal. Floating buttons stand in one column, and typing hides the
// bottom menu. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const monday = n => { const x = new Date(); x.setDate(x.getDate() - (x.getDay() + 6) % 7 - 7 * n); return x.toISOString().slice(0, 10); };
const plan = (id, wk) => ({ id, type: 'individual', weekOf: wk, classroom: 'North', educator: 'Bea', focus: 'smallgroup', fields: { rationale: 'Written.' }, status: 'draft', createdAt: 1, updatedAt: 1 });
const more = put => {
  put('settings/main.json', { id: 'main', groups: [{ name: 'Marigold', room: 'North', educator: 'Bea' }, { name: 'Poppy', room: 'North', educator: 'Bea' }, { name: 'Zinnia', room: 'West', educator: 'Ann' }] });
  put('children/c1.json', { first: 'Lark', last: 'One', classroom: 'North', group: 'Marigold', status: 'active' });
  put('children/c2.json', { first: 'Moss', last: 'Two', classroom: 'North', group: 'Poppy', status: 'active' });
  put('children/c3.json', { first: 'Wren', last: 'Three', classroom: 'West', group: 'Zinnia', status: 'active' });
  for (const [id, n] of [['w1', 1], ['w2', 2], ['w3', 3], ['w5', 5]]) put(`plans/${id}.json`, plan(id, monday(n)));
  const at = Date.now() - 36e5;
  for (let i = 0; i < 40; i++) put(`notices/m${i}.json`, { id: 'm' + i, noticed: 'Marigold moment ' + i, at: at - i * 1000, classroom: 'North', by: 'Bea', children: ['c1'] });
  put('notices/p1.json', { id: 'p1', noticed: 'Poppy moment.', at: at - 99000, classroom: 'North', by: 'Bea', children: ['c2'] });
  put('notices/x1.json', { id: 'x1', noticed: 'Lark and Wren together.', at: at - 99500, classroom: 'North', by: 'Bea', children: ['c1', 'c3'] });
  put('drafts/dmine.json', { id: 'dmine', by: 'Bea', startedAt: Date.now(), form: { id: 'nd1', noticed: '' } });
};

test('educators on a phone', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const wait = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 200; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };

  await t.test('Final remarks wait for the last three weeks only', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    await s.p.waitForFunction(() => plans.get('w5'), null, { timeout: 15000 });
    assert.deepStrictEqual(await s.p.evaluate(() => dueList().list.map(p => p.id)), ['w1', 'w2', 'w3']);
    await s.close();
  });

  await t.test('By small group lists every group of the class at once, folded', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    await s.p.evaluate(() => { nRoom = 'North'; mGroup = 'group'; goView('moments'); });
    await s.p.waitForSelector('[data-mgkey]', { timeout: 15000 });
    const heads = await s.p.evaluate(() => [...document.querySelectorAll('[data-mgkey] summary')].map(x => x.innerText.replace(/\s+/g, ' ')));
    assert.ok(heads.some(h => /Marigold group.*41 observations/.test(h)), heads.join(' / '));
    assert.ok(heads.some(h => /Poppy group.*1 observation/.test(h)));
    assert.ok(!heads.some(h => /Zinnia/.test(h)), 'a West group is not listed in North');
    await s.p.click('[data-mgkey*="Marigold"] summary'); await s.p.waitForSelector('[data-mgmore]');
    assert.strictEqual(await s.p.evaluate(() => document.querySelectorAll('[data-mgkey*="Marigold"] [id^="nw-"]').length >= 12), true);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('she deletes her own draft after a question', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    await s.p.evaluate(() => goView('moments')); await s.p.waitForSelector('[data-draftdel="dmine"]', { timeout: 15000 });
    let asked = 0; s.p.once('dialog', d => { asked++; d.accept(); });
    await s.p.evaluate(() => document.querySelector('[data-draftdel="dmine"]').click());
    assert.ok(await wait(() => !fs.existsSync(path.join(fx.dir, 'drafts/dmine.json')) || JSON.parse(fs.readFileSync(path.join(fx.dir, 'drafts/dmine.json'), 'utf8')).deleted), 'the draft leaves the records');
    assert.strictEqual(asked, 1);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('the Growth pages stay as buttons and Enter opens the journal', async () => {
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('stjour')); await s.p.waitForSelector('#gj-pass', { timeout: 15000 });
    assert.strictEqual(await s.p.evaluate(() => !!document.querySelector('.subrow.stpages [data-tview="stjour"]')), true, 'Journal is a button');
    assert.match(await s.p.evaluate(() => (document.querySelector('.tabdrop.stgroups summary') || {}).innerText || ''), /Educators, Growth/);
    await s.p.fill('#gj-pass', '1357'); await s.p.press('#gj-pass', 'Enter');
    await s.p.waitForFunction(() => !document.querySelector('#gj-pass'), null, { timeout: 10000 });
    assert.deepStrictEqual(s.errors, []); await s.close();
  });

  await t.test('typing hides the bottom menu, and the floating buttons never sit on one another', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 390);
    await s.p.evaluate(() => document.querySelector('#newnotice').click()); await s.p.waitForSelector('#nf-noticed');
    await s.p.focus('#nf-noticed'); await s.p.waitForTimeout(200);
    assert.strictEqual(await s.p.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display), 'none');
    await s.p.evaluate(() => document.activeElement.blur()); await s.p.waitForTimeout(300);
    assert.notStrictEqual(await s.p.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display), 'none');
    await s.p.evaluate(() => { const x = document.createElement('button'); x.dataset.open = 'w1'; document.body.append(x); x.click(); x.remove(); });
    await s.p.waitForTimeout(800);
    const boxes = await s.p.evaluate(() => ['.fab', '#tproof', '#evbtn'].map(q => document.querySelector(q)).filter(e => e && !e.hidden && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).opacity !== '0').map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const [a, c] = [boxes[i], boxes[j]]; assert.ok(a[2] <= c[0] || c[2] <= a[0] || a[3] <= c[1] || c[3] <= a[1], 'buttons overlap ' + JSON.stringify(boxes)); }
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
