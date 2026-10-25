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

test('a rewrite proposal replaces one passage in a section, only once the director accepts it', async t => {
  const fx = await start({ more: put => {
    put('staff/policies/teacher.json', { title: 'Teacher Policies and Procedures', edition: '2025', parts: [{ id: 'about', title: 'About', sections: [{ id: 'talk' }] }] });
    put('staff/policies/teacher/talk.json', { id: 'talk', title: 'Talk', body: 'We kneel down.\n\nWords are not just sounds; they are a bridge.\n\nWe listen.', history: [] });
    put('family/handbook/2026/edition.json', { year: '2026', title: 'Family Handbook', published: true, parts: [{ id: 'about', title: 'About', sections: ['play'] }] });
    put('family/handbook/2026/play.json', { id: 'play', title: 'Play', body: 'Play is not only fun but also work.', history: [] });
    put('family/handbook/2027/edition.json', { year: '2027', from: '2026', publishOn: '', parts: [{ id: 'about', title: 'About', sections: ['play'] }] });
    put('staff/proposals/rewrite-talk.json', { id: 'rewrite-talk', kind: 'replace', doc: 'teacher', section: 'talk', sectionTitle: 'Talk', title: 'A direct rewrite in Talk', status: 'proposed', at: '2026-10-25', from: 'Words are not just sounds; they are a bridge.', to: 'Words are sounds, and they are a bridge.' });
    put('staff/proposals/rewrite-2027-play.json', { id: 'rewrite-2027-play', kind: 'replace', doc: 'family', edition: '2027', section: 'play', sectionTitle: 'Play', title: 'A direct rewrite in Play', status: 'proposed', at: '2026-10-25', from: 'Play is not only fun but also work.', to: 'Play is fun and it is work.' });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const read = p => JSON.parse(fs.readFileSync(path.join(fx.dir, p), 'utf8'));
  assert.strictEqual((await fx.as(ann, '/api/staff/proposals/accept', { id: 'rewrite-talk' })).status, 403);
  const list = (await fx.as(dee, '/api/staff/proposals', {})).body.list;
  assert.strictEqual(list.filter(x => x.kind === 'replace').length, 2);
  // nothing changes before she accepts
  assert.match(read('staff/policies/teacher/talk.json').body, /not just sounds/);
  // she changes the wording first, and only the passage is replaced, with the earlier wording in the section's history
  const r = await fx.as(dee, '/api/staff/proposals/accept', { id: 'rewrite-talk', to: 'Words are sounds and a bridge.' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body)); await wait(1500);
  const talk = read('staff/policies/teacher/talk.json');
  assert.strictEqual(talk.body, 'We kneel down.\n\nWords are sounds and a bridge.\n\nWe listen.');
  assert.strictEqual(talk.history.length, 1); assert.match(talk.history[0].body, /not just sounds/);
  assert.strictEqual(read('staff/proposals/rewrite-talk.json').status, 'accepted');
  // the Family Handbook draft takes the rewrite into its own copy, and the published edition keeps its wording
  assert.strictEqual((await fx.as(dee, '/api/staff/proposals/accept', { id: 'rewrite-2027-play' })).status, 200); await wait(1500);
  assert.strictEqual(read('family/handbook/2027/play.json').body, 'Play is fun and it is work.');
  assert.strictEqual(read('family/handbook/2026/play.json').body, 'Play is not only fun but also work.');
  // the writing rule finds what the rewrites replace
  const writing = require('../writing.js');
  for (const s of ['Language is not just a way to give instructions; it is a tool.', 'We are not here to feed children information, but to create a space where they can find it.', 'It is not a test, it is a conversation.', 'We are not here to teach. We are here to learn.'])
    assert.ok(writing.notThisButThat(s), s);
  for (const s of ['Children may not bring toys from home.', 'If you are not sure, ask.', 'Pick-up is no later than 5:30.']) assert.ok(!writing.notThisButThat(s), s);
});
