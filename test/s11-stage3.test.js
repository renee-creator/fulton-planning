'use strict';
// Session 11, Stage 3. Follow ups to Session 10. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

test('Add educator in Settings adds a new hire, the same way as adding from Educators', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => put('settings/educators.json', { id: 'educators', names: [{ name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }, { name: 'Cora', room: 'South' }, { name: 'Dot', room: '' }] }) });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const accounts = () => JSON.parse(fs.readFileSync(path.join(fx.dir, 'access/accounts.json'), 'utf8')).accounts;
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => { setOpen = 'Sign-ins'; goView('settings'); }); await s.p.waitForSelector('#sg-add');
  await s.p.fill('#sg-new', 'Ivy'); await s.p.selectOption('#sg-newroom', 'South'); await s.p.click('#sg-add');
  await s.p.waitForFunction(() => signins.list && signins.list.some(a => a.name === 'Ivy'), null, { timeout: 10000 });
  await wait(1500);
  const ivy = accounts().find(a => a.name === 'Ivy');
  assert.strictEqual(ivy.newHire, true); assert.strictEqual(ivy.room, 'South'); assert.ok(ivy.start);
  const rec = JSON.parse(fs.readFileSync(path.join(fx.dir, 'staff/people/ivy.json'), 'utf8'));
  assert.strictEqual(rec.profile.role, 'educator');
  // everyone on the educators list without a sign-in is added as a new hire too
  await s.p.waitForSelector('#sg-addall'); await s.p.click('#sg-addall');
  await s.p.waitForFunction(() => signins.list && ['Cora', 'Dot'].every(n => signins.list.some(a => a.name === n)), null, { timeout: 10000 });
  await wait(1500);
  for (const n of ['Cora', 'Dot']) { const a = accounts().find(x => x.name === n); assert.strictEqual(a.newHire, true, n); assert.ok(fs.existsSync(path.join(fx.dir, 'staff/people/' + n.toLowerCase() + '.json')), n); }
  assert.strictEqual(accounts().find(a => a.name === 'Cora').room, 'South');
  // the start code lets them choose a passcode
  const ivyIn = await fx.login('Ivy', ivy.start);
  assert.strictEqual(ivyIn.setup, true);
  assert.deepStrictEqual(s.errors, []); await s.close();
});
