'use strict';
// Review on Today opens the DRDP review page, every suggestion waiting grouped by child and ticked to start, with Accept
// the ticked, Accept all for a child, and Change and Set aside in place. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const sug = (code, level, at) => ({ code, level, view: 'ptk', status: 'suggested', at, evidence: 'Built a tall tower and tried again when it fell.', src: { kind: 'notices', id: 'n1', title: 'Block tower', at } });
const more = put => {
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', birthdate: '2022-03-01', drdp: { items: { a1: sug('ATL 1', 'Building Earlier', 3), a2: sug('ATL 2', 'Building Earlier', 2), a3: sug('ATL 3', 'Building Middle', 1) } } });
  put('children/ivy.json', { first: 'Ivy', last: 'Test', classroom: 'West', status: 'active', birthdate: '2022-05-01', drdp: { items: { b1: sug('ATL 1', 'Building Middle', 1), b2: sug('ATL 2', 'Building Middle', 2) } } });
  put('children/oak.json', { first: 'Oak', last: 'Test', classroom: 'North', status: 'active', birthdate: '2022-05-01', drdp: { items: { c1: sug('ATL 1', 'Building Middle', 1) } } });
};
const items = (fx, id) => JSON.parse(fs.readFileSync(path.join(fx.dir, `children/${id}.json`), 'utf8')).drdp.items;
const tick = (p, key) => p.click(`label:has([data-drpoff="${key}"])`);

test('Review on Today opens every suggestion on one page, and the ticked ones are accepted together', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 390); t.after(() => s.close());
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('text=5 DRDP suggestions to review', { timeout: 15000 });
  await s.p.click('button:has-text("Review")[data-tview="drdpreview"]'); await s.p.waitForSelector('text=DRDP review');
  assert.strictEqual(await s.p.evaluate(() => view), 'drdpreview', 'not a child\'s page');
  const txt = await s.p.innerText('#main');
  assert.match(txt, /Ivy Test[\s\S]*Pip Test/); assert.doesNotMatch(txt, /Oak/, 'only Ann\'s class');
  assert.match(txt, /Accept the 5 ticked/);
  // Change one in place, and set one aside
  await s.p.click('[data-drkid="pip"] [data-drchange="a3"]'); await s.p.click('[data-drkid="pip"] label:has(input[value="Building Later"])'); await s.p.click('[data-drkid="pip"] [data-drsave="a3"]');
  await s.p.waitForSelector('text=Accept the 4 ticked');
  await s.p.click('[data-drkid="ivy"] [data-draside="b2"]'); await s.p.waitForSelector('text=Accept the 3 ticked');
  assert.strictEqual(await s.p.evaluate(() => view), 'drdpreview', 'still on the page');
  // untick one, accept the rest
  await tick(s.p, 'pip|a2'); await s.p.waitForSelector('text=Accept the 2 ticked');
  await s.p.click('[data-drpacc]');
  // the saves land, and the page settles with the unticked one waiting, unticked
  await s.p.waitForFunction(() => JSON.stringify([...document.querySelectorAll('[data-drpoff]')].map(x => [x.dataset.drpoff, x.checked])) === JSON.stringify([['pip|a2', false]]), null, { timeout: 15000 });
  assert.deepStrictEqual(s.errors, []);
  await new Promise(r => setTimeout(r, 2500));
  const pip = items(fx, 'pip'), ivy = items(fx, 'ivy');
  assert.deepStrictEqual([pip.a1.status, pip.a2.status, pip.a3.status, pip.a3.level, ivy.b1.status, ivy.b2.status], ['accepted', 'suggested', 'changed', 'Building Later', 'accepted', 'aside']);
});

test('Accept all for one child, and Tick and accept on a child\'s page opens the page for that child', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('text=6 DRDP suggestions to review', { timeout: 15000 });
  await s.p.click('button:has-text("Review")[data-tview="drdpreview"]'); await s.p.waitForSelector('[data-drpall="ivy"]');
  assert.match(await s.p.innerText('#main'), /Oak Test/, 'every class for the director');
  await s.p.click('[data-drpall="ivy"]'); await s.p.waitForSelector('text=Accept the 4 ticked');
  assert.doesNotMatch(await s.p.innerText('#main'), /Ivy Test/);
  // from Pip's DRDP tab, the page for Pip alone
  await s.p.evaluate(() => { kidOpen = 'pip'; kidTab = 'drdp'; goView('child'); }); await s.p.waitForSelector('text=Tick and accept', { timeout: 15000 });
  await s.p.click('button:has-text("Tick and accept")'); await s.p.waitForSelector('text=Accept the 3 ticked');
  assert.doesNotMatch(await s.p.innerText('#main'), /Oak Test/);
  await s.p.click('[data-drpacc]'); await s.p.waitForSelector('text=Nothing is waiting for review');
  assert.deepStrictEqual(s.errors, []);
  await new Promise(r => setTimeout(r, 2500));
  assert.deepStrictEqual([items(fx, 'ivy').b2.status, items(fx, 'pip').a3.status, items(fx, 'oak').c1.status], ['accepted', 'accepted', 'suggested']);
});
