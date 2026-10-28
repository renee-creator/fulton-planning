'use strict';
// The DRDP review queue. Review on Today steps through every waiting suggestion in the class, one at a time, and Accept,
// Change or Set aside opens the next at once, the next child's too. Skip leaves one waiting. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const sug = (code, level, at) => ({ code, level, view: 'ptk', status: 'suggested', at, evidence: 'Built a tall tower and tried again when it fell.', src: { kind: 'notices', id: 'n1', title: 'Block tower', at } });
const more = put => {
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', birthdate: '2022-03-01', drdp: { items: { a1: sug('ATL 1', 'Building Earlier', 3), a2: sug('ATL 2', 'Building Earlier', 2) } } });
  put('children/ivy.json', { first: 'Ivy', last: 'Test', classroom: 'West', status: 'active', birthdate: '2022-05-01', drdp: { items: { b1: sug('ATL 1', 'Building Middle', 1) } } });
  put('children/oak.json', { first: 'Oak', last: 'Test', classroom: 'North', status: 'active', birthdate: '2022-05-01', drdp: { items: { c1: sug('ATL 1', 'Building Middle', 1) } } });
};

test('Review on Today steps through the class one suggestion at a time', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 390); t.after(() => s.close());
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('[data-drqueue="room"]', { timeout: 15000 });
  assert.match(await s.p.innerText('#main'), /3 DRDP suggestions to review/, 'only the West class, Ann\'s own');
  await s.p.click('[data-drqueue="room"]'); await s.p.waitForSelector('text=Reviewing');
  const step = async () => s.p.evaluate(() => ({ head: document.querySelector('#kdrdp h3').textContent, count: document.querySelector('#kdrdp .cnt').textContent, items: document.querySelectorAll('#kdrdp .dritem').length, code: (document.querySelector('#kdrdp .dritem .drtop b') || {}).textContent }));
  // the class in its usual order, Ivy first
  let st = await step(); assert.deepStrictEqual([st.head, st.items, st.code], ["Reviewing Ivy's DRDP", 1, 'ATL 1']); assert.match(st.count, /0 reviewed, 3 to go/);
  // Accept opens the next one at once, the next child's
  await s.p.click('#kdrdp [data-draccept]'); await s.p.waitForFunction(() => /1 reviewed/.test(document.querySelector('#kdrdp .cnt').textContent));
  st = await step(); assert.deepStrictEqual([st.head, st.code], ["Reviewing Pip's DRDP", 'ATL 1']);
  // Change, choose a level and save
  await s.p.click('#kdrdp [data-drchange]'); await s.p.click('#kdrdp label:has(input[value="Building Middle"])'); await s.p.click('#kdrdp [data-drsave]');
  await s.p.waitForFunction(() => /2 reviewed/.test(document.querySelector('#kdrdp .cnt').textContent));
  st = await step(); assert.strictEqual(st.code, 'ATL 2');
  // Skip leaves it waiting, and the queue ends
  await s.p.click('#kdrdp [data-drqskip]'); await s.p.waitForSelector('text=Every suggestion is reviewed');
  assert.match(await s.p.innerText('#kdrdp'), /skipped are still waiting/);
  await s.p.click('#kdrdp [data-drqtoday]'); await s.p.waitForFunction(() => view === 'today');
  assert.match(await s.p.innerText('#main'), /1 DRDP suggestion to review/);
  assert.deepStrictEqual(s.errors, []);
  // kept in the records
  await new Promise(r => setTimeout(r, 2500));
  const pip = JSON.parse(fs.readFileSync(path.join(fx.dir, 'children/pip.json'), 'utf8')).drdp.items;
  assert.deepStrictEqual([pip.a1.status, pip.a1.level, pip.a2.status], ['changed', 'Building Middle', 'suggested']);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(fx.dir, 'children/ivy.json'), 'utf8')).drdp.items.b1.status, 'accepted');
});

test('a child\'s page reviews only that child, and leaving ends the queue', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => { kidOpen = 'pip'; kidTab = 'drdp'; goView('child'); }); await s.p.waitForSelector('[data-drqueue="kid:pip"]', { timeout: 15000 });
  await s.p.click('[data-drqueue="kid:pip"]'); await s.p.waitForSelector('text=Reviewing');
  assert.match(await s.p.innerText('#kdrdp'), /0 reviewed, 2 to go/);
  await s.p.click('#kdrdp [data-draside]'); await s.p.waitForFunction(() => /1 reviewed, 1 to go/.test(document.querySelector('#kdrdp .cnt').textContent));
  await s.p.evaluate(() => goView('plans')); assert.strictEqual(await s.p.evaluate(() => drQ), null);
  await s.p.evaluate(() => { kidOpen = 'pip'; kidTab = 'drdp'; goView('child'); }); await s.p.waitForSelector('text=Waiting for review');
  assert.deepStrictEqual(s.errors, []);
});
