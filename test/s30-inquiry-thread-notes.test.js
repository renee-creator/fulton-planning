'use strict';
// A team inquiry shows the team notes of each thread it follows, under the thread, one note kept on the thread, and TREE
// reads them with the inquiry and prints them with it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const more = put => {
  put('threads/t1.json', { id: 't1', name: 'Running away when asked to go', classroom: 'North', question: 'Perhaps leaving play is hard.', status: 'growing', evidence: [], notes: 'Two warnings before lunch help. Running starts at the gate.', createdAt: Date.now() - 20 * 864e5 });
  put('inquiries/q1.json', { id: 'q1', name: 'Running when asked to go to lunch', room: 'North', status: 'open', threads: ['t1'], fromThread: 't1', createdAt: Date.now() - 864e5 });
};

test('an inquiry shows, prints and reads the team notes of its threads', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => openInquiry('q1')); await s.p.waitForSelector('.iqtnotes', { timeout: 15000, state: 'attached' });
  assert.match(await s.p.$eval('.iqtnotes', el => el.textContent), /Two warnings before lunch help\. Running starts at the gate\.[\s\S]*Edit on the thread/);
  assert.match(await s.p.evaluate(() => inqDigest(inquiries.get('q1'))), /The team's notes on it\. Two warnings before lunch help/);
  assert.ok(await s.p.evaluate(() => JSON.stringify(inquiryDoc(inquiries.get('q1'), true).blocks).includes('Team notes from the thread Running away when asked to go')));
  // one note, kept on the thread, so a change shows on the inquiry
  await s.p.evaluate(() => { const th = threads.get('t1'); th.notes = 'Changed on the thread.'; openInquiry('q1'); });
  await s.p.waitForFunction(() => /Changed on the thread\./.test((document.querySelector('.iqtnotes') || {}).textContent || ''));
  assert.deepStrictEqual(s.errors, []);
});
