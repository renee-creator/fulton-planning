'use strict';
// October 31, 2026. An observation can belong to more than one class and more than one small group, and one that came in
// from Kaymbu with no educator named carries the lead of each of its groups. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const more = put => {
  put('settings/main.json', { id: 'main', groups: [{ name: 'Marigold', room: 'North', educator: 'Bea' }, { name: 'Zinnia', room: 'West', educator: 'Ann' }] });
  put('notices/k1.json', { id: 'k1', noticed: 'Carried the long plank together.', at: Date.now() - 864e5, classroom: 'North', classrooms: ['North', 'West'], smallGroup: 'Marigold', smallGroups: ['Marigold', 'Zinnia'], by: '', kaymbu: { v: 3, key: 'kk1', subject: '.', mail: '1700000000009', dated: 'photo', keptAt: Date.now() } });
};

test('Observations in more than one class and small group', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const read = id => JSON.parse(fs.readFileSync(path.join(fx.dir, 'notices', id + '.json'), 'utf8'));
  await new Promise(r => setTimeout(r, 2500));
  assert.strictEqual(read('k1').by, 'Bea and Ann', 'a Kaymbu observation in two small groups carries both leads');

  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => { GROUPS = [{ name: 'Marigold', room: 'North', educator: 'Bea' }, { name: 'Zinnia', room: 'West', educator: 'Ann' }]; document.querySelector('#newnotice').click(); }); await s.p.waitForSelector('#nf-noticed');
  await s.p.fill('#nf-noticed', 'Built one long road from the North yard to the West yard.');
  await s.p.check('[data-nfroomck="North"]'); await s.p.check('[data-nfroomck="West"]');
  await s.p.evaluate(() => { const d = document.querySelector('details.nfmore'); if (d) d.open = true; });
  await s.p.check('[data-nfsgck="Marigold"]'); await s.p.check('[data-nfsgck="Zinnia"]');
  await s.p.click('#nf-save'); await s.p.waitForTimeout(2500);
  const n = await s.p.evaluate(() => [...notices.values()].find(x => /long road/.test(x.noticed || '')));
  assert.deepStrictEqual(n.classrooms, ['West', 'North'], 'in the order of the classes'); assert.strictEqual(n.classroom, 'West');
  assert.deepStrictEqual(n.smallGroups, ['Marigold', 'Zinnia']);
  assert.deepStrictEqual(await s.p.evaluate(id => momentRooms(notices.get(id)), n.id), ['West', 'North']);
  assert.ok(await s.p.evaluate(id => momentIn(notices.get(id), 'West') && momentIn(notices.get(id), 'North') && !momentIn(notices.get(id), 'South'), n.id));
  assert.strictEqual(await s.p.evaluate(id => obsRoomText(notices.get(id)), n.id), 'West and North class');
  assert.deepStrictEqual(s.errors, []); await s.close();
});
