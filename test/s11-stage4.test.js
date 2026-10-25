'use strict';
// Session 11, Stage 4. New work. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

test('walls are the director\'s, and an educator\'s project save keeps the wall', async t => {
  const chromium = await browser();
  const wall = { sheets: [{ id: 'w1', kind: 'moment', title: 'Worms', text: 'The team wrote this.', include: true }] };
  const fx = await start({ more: put => {
    put('projects/pr1.json', { id: 'pr1', name: 'Worms', home: 'West', threads: [], classrooms: [{ room: 'West' }], wall, reading: 'What lies under', status: 'open' });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const read = () => JSON.parse(fs.readFileSync(path.join(fx.dir, 'projects/pr1.json'), 'utf8'));
  // an educator receives the project without its wall, and the director with it
  assert.strictEqual((await fx.as(ann, '/api/data', {})).body.data.projects.pr1.wall, undefined);
  assert.deepStrictEqual((await fx.as(dee, '/api/data', {})).body.data.projects.pr1.wall, wall);
  // a save of the whole project from an educator, without the wall, is taken and the wall stays
  const mine = Object.assign({}, read()); delete mine.wall; mine.classrooms = [{ room: 'West' }, { room: 'North' }];
  const r1 = await fx.as(ann, '/api/write', { op: 'set', kind: 'projects', id: 'pr1', data: mine });
  assert.strictEqual(r1.status, 200, JSON.stringify(r1.body)); assert.strictEqual(r1.body.doc.wall, undefined);
  // and a patch carrying a wall changes nothing on the wall
  const r2 = await fx.as(ann, '/api/write', { op: 'update', kind: 'projects', id: 'pr1', patch: { threads: [{ id: 'th1' }], wall: { sheets: [] } } });
  assert.strictEqual(r2.status, 200, JSON.stringify(r2.body));
  await wait(1500);
  assert.deepStrictEqual(read().wall, wall); assert.strictEqual(read().classrooms.length, 2); assert.deepStrictEqual(read().threads, [{ id: 'th1' }]);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Ann', '1357', 390);
  await s.p.evaluate(() => goView('walls')); await wait(400);
  assert.strictEqual(await s.p.evaluate(() => view), 'today');
  await s.p.evaluate(() => goView('slides')); await wait(400);
  assert.doesNotMatch(await s.p.evaluate(() => (document.querySelector('#subnav,#tsubnav,nav') || document.body).innerText), /\bWalls\b/);
  assert.ok(!(await s.p.evaluate(() => GS_KINDS.filter(([k]) => k !== 'wall' || isDirector()).some(([k]) => k === 'wall'))));
  // the educator's own save from the page sends only what changed
  await s.p.evaluate(() => { const x = projects.get('pr1'); x.classrooms = [...x.classrooms, { room: 'South' }]; saveProject(x); });
  await wait(2500);
  assert.deepStrictEqual(read().wall, wall); assert.strictEqual(read().classrooms.length, 3);
  assert.deepStrictEqual(s.errors, []); await s.close();
  const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await d.p.evaluate(() => goView('walls')); await wait(400); assert.strictEqual(await d.p.evaluate(() => view), 'walls');
  assert.deepStrictEqual(d.errors, []); await d.close();
});

test('Children and Conferences open on the educator\'s own Class each visit', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => {
    put('settings/educators.json', { id: 'educators', names: [{ name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }, { name: 'Gia', room: '' }] });
    put('children/pip-test.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active' });
    put('children/rue-test.json', { first: 'Rue', last: 'Test', classroom: 'North', status: 'active' });
  } });
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const kroom = p => p.evaluate(() => kRoom);
  const s = await signedIn(fx, b, 'Bea', '1357', 390);
  await s.p.evaluate(() => goView('children')); await s.p.waitForFunction(() => kVisit, null, { timeout: 8000 });
  assert.strictEqual(await kroom(s.p), 'North');
  // another Class holds for this visit, and a child's page and back is the same visit
  await s.p.click('[data-kroom="West"]'); assert.strictEqual(await kroom(s.p), 'West');
  await s.p.evaluate(() => { kidOpen = 'pip-test'; goView('child'); }); await s.p.evaluate(() => goView('children'));
  assert.strictEqual(await kroom(s.p), 'West');
  // the next visit opens on her own Class again
  await s.p.evaluate(() => goView('today')); await s.p.evaluate(() => goView('children'));
  assert.strictEqual(await kroom(s.p), 'North');
  // a page reload opens on her Class too
  await s.p.reload(); await s.p.waitForFunction(() => typeof kVisit !== 'undefined' && view === 'children' && kVisit, null, { timeout: 15000 });
  assert.strictEqual(await kroom(s.p), 'North');
  // the Conferences page opens on her Class
  await s.p.evaluate(() => goView('conferences'));
  const fr = await (await s.p.waitForSelector('#tembed-conferences')).contentFrame();
  await fr.waitForFunction(() => typeof S !== 'undefined' && S.filters, null, { timeout: 15000 });
  assert.strictEqual(await fr.evaluate(() => S.filters.room), 'North');
  assert.deepStrictEqual(s.errors, []); await s.close();
  // an educator with no Class, and the director, see every Class
  for (const [n, pc] of [['Gia', '1357'], ['Dee', 'director-pass-1']]) {
    const x = await signedIn(fx, b, n, pc, 1280);
    await x.p.evaluate(() => goView('children')); await x.p.waitForFunction(() => kVisit, null, { timeout: 8000 });
    assert.strictEqual(await kroom(x.p), 'All', n); await x.close();
  }
});

test('the director starts her own plans, marked as hers, ready with no review once every box is written', async t => {
  const chromium = await browser();
  const fx = await start();
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const read = id => JSON.parse(fs.readFileSync(path.join(fx.dir, 'plans/' + id + '.json'), 'utf8'));
  const full = { observation: 'o', intentions: 'i', meeting: 'm', interests: 'n', indoor: 'd', outdoor: 'u', brainstorm: 'b' };
  // a box left empty keeps her plan a draft, on the server
  let r = await fx.as(dee, '/api/write', { op: 'set', kind: 'plans', id: 'dp1', data: { id: 'dp1', type: 'classroom', classroom: 'South', weekOf: '2026-10-19', educator: 'Dee', byDirector: true, status: 'ready', fields: Object.assign({}, full, { brainstorm: '' }) } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.doc.status, 'draft');
  r = await fx.as(dee, '/api/write', { op: 'update', kind: 'plans', id: 'dp1', patch: { status: 'ready', fields: { brainstorm: 'b' } } });
  assert.strictEqual(r.body.doc.status, 'ready');
  // it never waits for a review step
  r = await fx.as(dee, '/api/write', { op: 'update', kind: 'plans', id: 'dp1', patch: { status: 'reviewed' } });
  assert.strictEqual(r.body.doc.status, 'ready');
  // an educator cannot mark a plan as the director's
  r = await fx.as(ann, '/api/write', { op: 'set', kind: 'plans', id: 'ap1', data: { id: 'ap1', type: 'individual', classroom: 'West', weekOf: '2026-10-19', educator: 'Ann', byDirector: true, status: 'draft', fields: {} } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.doc.byDirector, undefined);
  // an educator's edit of her plan keeps it hers
  r = await fx.as(ann, '/api/write', { op: 'update', kind: 'plans', id: 'dp1', patch: { fields: { indoor: 'dd' } } });
  assert.strictEqual(r.body.doc.byDirector, true);
  await wait(1200); assert.strictEqual(read('dp1').byDirector, true);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 390);
  await s.p.evaluate(() => goView('today')); await s.p.click('[data-dirplan]');
  await s.p.selectOption('#dp-room', 'North'); await s.p.click('[data-dirnew="individual"]');
  const np = await s.p.evaluate(() => { const p = plans.get(currentId); return { type: p.type, classroom: p.classroom, byDirector: p.byDirector, view }; });
  assert.deepStrictEqual(np, { type: 'individual', classroom: 'North', byDirector: true, view: 'plans' });
  assert.match(await s.p.evaluate(() => document.querySelector('#sendsec').innerText), /Mark it ready/);
  // her own ready plan is not in her review list
  await s.p.evaluate(() => goView('today'));
  assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /Waiting for your review, South Classroom plan/);
  assert.deepStrictEqual(s.errors, []); await s.close();
});
