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
    put('staff/policies/teacher.json', { title: 'Policies and Procedures', edition: '2025', parts: [{ id: 'about', title: 'About', sections: [{ id: 'talk' }] }] });
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
  assert.strictEqual(r.status, 200, JSON.stringify(r.body)); await wait(4000);
  const talk = read('staff/policies/teacher/talk.json');
  assert.strictEqual(talk.body, 'We kneel down.\n\nWords are sounds and a bridge.\n\nWe listen.');
  assert.strictEqual(talk.history.length, 1); assert.match(talk.history[0].body, /not just sounds/);
  assert.strictEqual(read('staff/proposals/rewrite-talk.json').status, 'accepted');
  // the Family Handbook draft takes the rewrite into its own copy, and the published edition keeps its wording
  assert.strictEqual((await fx.as(dee, '/api/staff/proposals/accept', { id: 'rewrite-2027-play' })).status, 200); await wait(4000);
  assert.strictEqual(read('family/handbook/2027/play.json').body, 'Play is fun and it is work.');
  assert.strictEqual(read('family/handbook/2026/play.json').body, 'Play is not only fun but also work.');
  // the writing rule finds what the rewrites replace
  const writing = require('../writing.js');
  for (const s of ['Language is not just a way to give instructions; it is a tool.', 'We are not here to feed children information, but to create a space where they can find it.', 'It is not a test, it is a conversation.', 'We are not here to teach. We are here to learn.'])
    assert.ok(writing.notThisButThat(s), s);
  for (const s of ['Children may not bring toys from home.', 'If you are not sure, ask.', 'Pick-up is no later than 5:30.']) assert.ok(!writing.notThisButThat(s), s);
});

test('Records to tidy, for the director only, each fixed only when she chooses, and no photo deleted', async t => {
  const chromium = await browser();
  const now = Date.now();
  // a photo picked on the observation form carries a name made from the observation and who kept it
  const pid = (who, nid) => require('crypto').createHash('sha256').update(who.toLowerCase() + '|' + nid + '.photo').digest('hex').slice(0, 12) + '-moment-photo.jpg';
  const A = pid('Ann', 'n2'), R = pid('Ann', 'n3');
  const fx = await start({ more: put => {
    put('children/pip-test.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active' });
    put('children/rue-test.json', { first: 'Rue', last: 'Test', classroom: 'West', status: 'active' });
    put('notices/n1.json', { id: 'n1', noticed: 'Pip stacked blocks.', wonder: '', classroom: 'West', children: ['pip-test'], by: 'Ann', at: now - 864e5,
      drdp: { items: [{ id: 'd1', code: 'ATL 3', childId: 'pip-test' }, { id: 'd2', code: 'SED 4', childId: 'rue-test' }, { id: 'd3', code: 'HLTH 1', childId: 'oak-test' }] } });
    put('notices/n2.json', { id: 'n2', noticed: 'A walk to the creek.', wonder: '', classroom: 'West', children: [], by: 'Ann', at: now - 2 * 864e5 });
    put('plans/p1.json', { id: 'p1', type: 'classroom', classroom: 'West', week: '2026-10-12', fields: {} });
    put('threads/t1.json', { id: 't1', name: 'Worms', classroom: 'West', evidence: [{ planId: 'p1', week: '2026-10-12', text: 'Kept' }, { planId: 'pgone', week: '2026-10-12', text: 'Gone' }] });
    put(`photos/${A}~1abcdefghijklmnop~5000.ref`, 'x');
    put(`photos/${R}~1dbcdefghijklmnop~5000.ref`, 'x');
    put('photos/bbbbbbbbbbbb-moment-photo.jpg~1bbcdefghijklmnop~6000.ref', 'x');
    put('photos/cccccccccccc-moment-photo.jpg~1cbcdefghijklmnop~7000.ref', 'x');
    put('notices/n3.json', { id: 'n3', noticed: 'Linked photo.', wonder: '', classroom: 'West', children: [], by: 'Ann', at: now, photo: { id: 'cccccccccccc-moment-photo.jpg' } });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const read = p => JSON.parse(fs.readFileSync(path.join(fx.dir, p), 'utf8'));
  assert.strictEqual((await fx.as(ann, '/api/tidy', {})).status, 403);
  let T = (await fx.as(dee, '/api/tidy', {})).body;
  assert.deepStrictEqual(T.drdp.map(x => x.item), ['d2', 'd3']); assert.strictEqual(T.drdp[0].childName, 'Rue Test');
  assert.deepStrictEqual(T.threads.map(x => x.planId), ['pgone']);
  // only the photo missing from an observation TREE can name, n2. A leftover from a form never kept (bbbb) and a photo
  // replaced on n3 stay off the list.
  assert.deepStrictEqual(T.photos.map(x => x.id), [A]); assert.strictEqual(T.photos[0].notice, 'n2'); assert.strictEqual(T.photos[0].by, 'Ann');
  if (chromium) {
    const b = await chromium.launch(); const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 390);
    await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('#tidytoday', { timeout: 10000 });
    const text = await s.p.evaluate(() => document.querySelector('#tidytoday').innerText);
    assert.match(text, /DRDP SED 4 names Rue Test/); assert.match(text, /points to a plan that is gone/); assert.match(text, /may be missing from an observation/i); assert.match(text, /kept by Ann/);
    assert.deepStrictEqual(s.errors, []); await s.close();
    const e = await signedIn(fx, b, 'Ann', '1357', 390); await e.p.evaluate(() => goView('today')); await e.p.waitForTimeout(800);
    assert.strictEqual(await e.p.$('#tidytoday'), null); await e.close(); await b.close();
  }
  // nothing changed on its own
  assert.strictEqual(read('notices/n1.json').drdp.items.length, 3); assert.strictEqual(read('threads/t1.json').evidence.length, 2);
  // one tap each
  T = (await fx.as(dee, '/api/tidy/fix', { kind: 'drdp', notice: 'n1', item: 'd2', how: 'add' })).body;
  T = (await fx.as(dee, '/api/tidy/fix', { kind: 'drdp', notice: 'n1', item: 'd3', how: 'remove' })).body;
  assert.strictEqual(T.drdp.length, 0);
  T = (await fx.as(dee, '/api/tidy/fix', { kind: 'thread', thread: 't1', planId: 'pgone' })).body; assert.strictEqual(T.threads.length, 0);
  T = (await fx.as(dee, '/api/tidy/fix', { kind: 'photo', id: A, how: 'attach', notice: 'n2' })).body; assert.strictEqual(T.photos.length, 0);
  assert.strictEqual((await fx.as(dee, '/api/tidy/fix', { kind: 'photo', id: 'bbbbbbbbbbbb-moment-photo.jpg', how: 'keep' })).status, 404);
  await wait(1500);
  assert.deepStrictEqual(read('notices/n1.json').children, ['pip-test', 'rue-test']); assert.deepStrictEqual(read('notices/n1.json').drdp.items.map(x => x.id), ['d1', 'd2']);
  assert.deepStrictEqual(read('threads/t1.json').evidence.map(x => x.planId), ['p1']);
  assert.strictEqual(read('notices/n2.json').photo.id, A);
  // every photo marker is still in the records
  assert.strictEqual(fs.readdirSync(path.join(fx.dir, 'photos')).length, 4);
});
