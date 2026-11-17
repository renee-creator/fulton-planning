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
  // readings, for the team and for families, kept on the inquiry
  await s.p.waitForSelector('#iqreadings', { timeout: 15000 });
  assert.match(await s.p.textContent('#iqreadings'), /For the team[\s\S]*For families/);
  await s.p.evaluate(() => { document.querySelector('#iqreadings details').open = true; document.getElementById('iqrd-title').value = 'Taming Transitions'; document.getElementById('iqrd-url').value = 'https://example.org/transitions'; document.getElementById('iqrd-for').value = 'family'; document.querySelector('[data-iqrdadd]').click(); });
  await s.p.waitForFunction(() => (inquiries.get('q1').readings || []).length === 1);
  assert.strictEqual(await s.p.evaluate(() => inquiries.get('q1').readings[0].for), 'family');
  assert.match(await s.p.textContent('#iqreadings'), /Taming Transitions/);
  // what the team has already tried, and a try moved there keeps its words and result
  await s.p.evaluate(() => { const x = inquiries.get('q1'); x.tries = [{ id: 'tr1', text: 'Walk with a friend to lunch.', result: 'Two of three walked.', by: 'Dee', at: Date.now() }]; openInquiry('q1'); });
  await s.p.waitForSelector('[data-iqtmove="tr1"]', { timeout: 15000 }); await s.p.click('[data-iqtmove="tr1"]');
  await s.p.waitForFunction(() => (inquiries.get('q1').tried || []).length === 1 && !(inquiries.get('q1').tries || []).length);
  assert.match(await s.p.textContent('#iqtried'), /What we have already tried/);
  assert.strictEqual(await s.p.evaluate(() => inquiries.get('q1').tried[0].result), 'Two of three walked.');
  assert.ok(await s.p.evaluate(() => JSON.stringify(inquiryDoc(inquiries.get('q1'), true).blocks).includes('What we have already tried')));
  // Who this is about, filled in from a child named in the question, and the printed inquiry in plan order
  const kid = await s.p.evaluate(() => { const c = [...children.values()][0]; if (!c) return null; const x = inquiries.get('q1'); x.name = 'Why is ' + c.first + ' running?'; x.kids = []; delete x.kidsSet; openInquiry('q1'); return c.id; });
  if (kid) { await s.p.waitForFunction(id => (inquiries.get('q1').kids || []).includes(id), kid, { timeout: 15000 }); assert.strictEqual(await s.p.evaluate(() => inquiries.get('q1').kidsSet), 'title'); }
  const order = await s.p.evaluate(() => inquiryDoc(inquiries.get('q1'), true).blocks.filter(b => b.t === 'sub').map(b => b.text || b.label));
  { const nums = order.filter(t => /^\d\. /.test(String(t))).map(t => +String(t)[0]); assert.ok(nums.length >= 3 && nums.every((n, i) => !i || n > nums[i - 1]) && nums.includes(6) && nums.includes(7), JSON.stringify(order)); }
  assert.ok(await s.p.evaluate(() => [...document.querySelectorAll('.iqstep')].length >= 7));
  // asking for readings waits on the director's Today until it is marked filled
  await s.p.evaluate(() => { document.querySelectorAll('#iqreadings details').forEach(d => d.open = true); document.getElementById('iqask-note').value = 'Something for his family'; document.querySelector('[data-iqask]').click(); });
  await s.p.waitForFunction(() => (inquiries.get('q1').readAsk || []).length === 1);
  assert.strictEqual(await s.p.evaluate(() => iqAskWaiting().length), 1);
  await s.p.click('[data-iqaskdone]');
  await s.p.waitForFunction(() => !!inquiries.get('q1').readAsk[0].done);
  assert.strictEqual(await s.p.evaluate(() => iqAskWaiting().length), 0);
  assert.deepStrictEqual(s.errors, []);
});
