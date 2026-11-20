'use strict';
// November 19, 2026. A setup photographed before the children come is kept as an invitation, with no children tagged.
// Every provocation is an invitation, and only a person marks one a provocation. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const kay = (id, i) => ({ id, noticed: '', at: Date.now() - 864e5 + i, classroom: 'North', smallGroup: 'Marigold', group: 'g1', by: 'Bea', children: [], photo: { id: 'ph' + id, w: 10, h: 10 },
  kaymbu: { v: 3, key: 'kk' + id, subject: '.', mail: '1700000000011', dated: 'photo', check: true } });
const more = put => {
  put('settings/main.json', { id: 'main', groups: [{ name: 'Marigold', room: 'North', educator: 'Bea' }] });
  put('children/c1.json', { id: 'c1', first: 'Wren', last: 'Ash', classroom: 'North', group: 'Marigold', status: 'here' });
  put('notices/i1.json', kay('i1', 1)); put('notices/i2.json', kay('i2', 2));
};

test('An invitation keeps no children', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const read = id => JSON.parse(fs.readFileSync(path.join(fx.dir, 'notices', id + '.json'), 'utf8'));
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);

  // Today's quick Tag panel keeps the whole post as an invitation and takes it off the list
  await s.p.waitForTimeout(1500);
  const q = await s.p.evaluate(() => { const w = todayWaiting().find(w => /^kay\|/.test(w.q || '')); tqOpen = w.q; redrawToday(); return w.q; });
  const btn = `[data-tqsave="${q}|inv"]`;
  assert.ok(await s.p.evaluate(sel => !!document.querySelector(sel), btn), 'the panel offers it');
  await s.p.evaluate(sel => document.querySelector(sel).click(), btn); await s.p.waitForTimeout(2500);
  for (const id of ['i1', 'i2']) { const d = read(id); assert.strictEqual(d.invitation, true); assert.deepStrictEqual(d.children, []); assert.strictEqual(d.kaymbu.check, false); assert.ok(!d.provocation); }
  assert.ok(!(await s.p.evaluate(() => todayWaiting().some(w => /kay\|i[12]/.test(w.q || '')))), 'no longer waits to be tagged');
  assert.strictEqual(await s.p.evaluate(() => setupLabel(notices.get('i1'))), 'Invitation');

  // the full form marks it a provocation by hand, and keeps without words
  await s.p.evaluate(() => { noticeForm = Object.assign(jclone(notices.get('i1')), {}); view = 'moments'; renderMain(); }); await s.p.waitForSelector('#nf-setup');
  assert.ok(await s.p.isVisible('[data-nfsetup="provocation"]'));
  await s.p.click('[data-nfsetup="provocation"]'); await s.p.click('#nf-save'); await s.p.waitForTimeout(2500);
  assert.strictEqual(read('i1').provocation, true); assert.strictEqual(await s.p.evaluate(() => setupLabel(notices.get('i1'))), 'Invitation, provocation');

  // a new observation that is not an invitation still asks for words, and taking the invitation off brings the children back
  await s.p.evaluate(() => document.querySelector('#newnotice').click()); await s.p.waitForSelector('#nf-setup');
  await s.p.click('[data-nfsetup="invitation"]'); assert.ok(await s.p.isVisible('[data-nfsetup="provocation"]'));
  await s.p.click('[data-nfsetup="invitation"]'); assert.ok(!(await s.p.isVisible('[data-nfsetup="provocation"]')));
  assert.deepStrictEqual(s.errors, []); await s.close();
});
