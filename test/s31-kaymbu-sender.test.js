'use strict';
// The director sends educators' Kaymbu moments over from her own account. A moment named only because she sent it keeps
// her name on its card, and TREE's readings never write her as the one who saw or said it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const k = subject => ({ v: 3, key: 'k-' + subject, subject, dated: 'photo', keptAt: Date.now() });
const more = put => {
  put('notices/a1.json', { id: 'a1', noticed: 'Carried water in both hands to the sand.', at: Date.now() - 864e5, classroom: 'North', by: 'Dee', kaymbu: k('North') });
  put('notices/a2.json', { id: 'a2', noticed: 'Read the cloud book with friends.', at: Date.now() - 864e5, classroom: 'North', by: 'Dee', kaymbu: k('North Dee') });
  put('notices/a3.json', { id: 'a3', noticed: 'Sorted acorns by size.', at: Date.now() - 864e5, classroom: 'West', by: 'Ann', kaymbu: k('West') });
};

test('a moment the director only sent keeps her name on the card, and readings leave it out', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const read = id => JSON.parse(fs.readFileSync(path.join(fx.dir, `notices/${id}.json`), 'utf8'));
  for (let i = 0; i < 60 && !read('a1').kaymbu.sentBy; i++) await new Promise(r => setTimeout(r, 250));
  assert.strictEqual(read('a1').kaymbu.sentBy, 1, 'named only because the director sent it');
  assert.strictEqual(read('a2').kaymbu.sentBy, undefined, 'the subject named her, so it is hers');
  assert.strictEqual(read('a3').kaymbu.sentBy, undefined, 'an educator who sent her own');
  assert.deepStrictEqual([read('a1').by, read('a2').by], ['Dee', 'Dee'], 'the name stays on the moment');
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.waitForFunction(() => notices.get('a1') && notices.get('a1').kaymbu && notices.get('a1').kaymbu.sentBy, null, { timeout: 15000 });
  assert.deepStrictEqual(await s.p.evaluate(() => ['a1', 'a2', 'a3'].map(id => noticeAsPlan(notices.get(id)).educator)), ['', 'Dee', 'Ann']);
  assert.match(await s.p.evaluate(() => noticeCard(notices.get('a1'))), /Dee/, 'the card keeps her name');
  assert.deepStrictEqual(s.errors, []);
});
