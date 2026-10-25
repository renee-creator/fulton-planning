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
