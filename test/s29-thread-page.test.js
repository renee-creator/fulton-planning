'use strict';
// A followed thread's page holds what its print holds, in the same order, with its photos, and prints on its own from
// the top of the thread. A lens passage from a photo observation shows the photo, as the lens print does. Made-up names.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const more = put => {
  put('threads/t1.json', { id: 't1', name: 'Water and mud', classroom: 'West', question: 'Where does the water go?', status: 'growing', evidence: [], next: ['Offer pipes and funnels', 'Walk the creek after rain', 'Bring buckets', 'Try ice', 'Try sand'], languages: ['Pouring', 'Drawing'], notes: 'Watch who pours first.', createdAt: Date.now() - 30 * day });
  for (let i = 0; i < 3; i++) put(`notices/p${i}.json`, { id: 'p' + i, noticed: 'Poured water down the hill and watched it pool ' + i, at: Date.now() - (i + 1) * 3 * day, threadId: 't1', classroom: 'West', by: 'Ann', photo: { id: 'ph-' + i, w: 800, h: 600 } });
};

test('a thread\'s page shows its photos and the parts its print shows, with Print this thread at the top', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('threads')); await s.p.waitForSelector('#th-t1', { timeout: 15000, state: 'attached' });
  const card = await s.p.$eval('#th-t1', el => ({ text: el.innerText, imgs: el.querySelectorAll('.tmoments img').length, print: !!el.querySelector('.secthead [data-print="thread"],.secthead button') }));
  assert.strictEqual(card.imgs, 3, 'its photos');
  assert.ok(card.print, 'Print this thread at the top');
  assert.match(card.text, /Moments along the way[\s\S]*Languages children are using[\s\S]*What we might offer next[\s\S]*Offer pipes and funnels[\s\S]*Team notes/i);
  assert.match(card.text, /Print this thread/);
  // a lens passage from a photo observation shows its photo
  assert.match(await s.p.evaluate(() => lensMomentHtml({ planId: 'p0', text: 'Poured water down the hill', section: 'noticed' })), /<img/);
  assert.deepStrictEqual(s.errors, []);
});
