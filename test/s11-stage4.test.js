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

test('Edit, history and restore reach every piece of school writing, with a gentle writing note and one tap restore', async t => {
  const chromium = await browser();
  const fx = await start({ more: put => {
    put('staff/guides/sand.md', '<!--\nstatus: draft\n-->\n# Sand\n\nA lead line.\n\n## Setting it up\n\nWet sand holds a shape.\n');
    put('staff/familypieces/rain.md', '<!--\nstatus: draft\n-->\n# Rain days\n\nWe go out in the rain.\n\n## What to pack\n\nBoots.\n');
    put('staff/help.json', { id: 'help', list: [{ id: 'h01', q: 'How do I keep an observation?', a: ['Tap Keep an observation.', 'Write it.'], roles: ['educator', 'director'] }] });
    put('staff/presenting/pr1a.json', { id: 'pr1a', title: 'Mud', subtitle: '', audience: 'Our team', place: 'The yard', status: 'planning' });
    put('staff/wording/story-frames.md', '<!--\nwording: test\n-->\n# Story frames\n\n## puddle\n\nJumping in puddles\n\nRain boots and splashes.\n\n- **I can splash gently.** My friends stay dry.\n');
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const page = (tok, at) => fx.as(tok, '/api/staff/page', at), save = (tok, at, b) => fx.as(tok, '/api/staff/page/save', Object.assign({}, at, b));
  // a materials guide and a Family page piece open in the editor, for the director only
  for (const path of ['staff/guides/sand.md', 'staff/familypieces/rain.md']) {
    assert.strictEqual((await page(ann, { path })).status, 403, path);
    const g = await page(dee, { path }); assert.strictEqual(g.status, 200, path); assert.ok(g.body.parts.length, path);
  }
  // a line that may break a writing rule gets a gentle note, and she can keep it as written
  let g = (await page(dee, { path: 'staff/guides/sand.md' })).body;
  const parts = g.parts.map(p => ({ body: p.body })); parts[0].body = 'Wet sand holds a shape — and dry sand pours.';
  let r = await save(dee, { path: 'staff/guides/sand.md' }, { stamp: g.stamp, title: g.title, parts, note: 'Dry sand' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.gentle, true); assert.ok(r.body.findings.length);
  r = await save(dee, { path: 'staff/guides/sand.md' }, { stamp: g.stamp, title: g.title, parts, note: 'Dry sand', keep: true });
  assert.strictEqual(r.body.ok, true); assert.strictEqual(r.body.page.history.length, 1); assert.strictEqual(r.body.page.updatedBy, 'Dee');
  // restore brings the earlier version back, keeping the one before it
  r = await fx.as(dee, '/api/staff/page/restore', { path: 'staff/guides/sand.md', stamp: r.body.page.stamp, index: 0 });
  assert.strictEqual(r.body.ok, true); assert.match(r.body.page.parts[0].body, /^Wet sand holds a shape\.$/); assert.strictEqual(r.body.page.history.length, 2);
  // the words inside a record: a Help answer, with its own history
  const at = { path: 'staff/help.json', item: 'h01' };
  g = (await page(dee, at)).body; assert.strictEqual(g.kind, 'record'); assert.deepStrictEqual(g.parts.map(p => p.heading), ['Question', 'Steps, one on each line']);
  r = await save(dee, at, { stamp: g.stamp, parts: [{ body: 'How do I keep an observation?' }, { body: 'Tap Keep an observation.\nWrite what happened.' }], note: 'Clearer step' });
  assert.strictEqual(r.body.ok, true, JSON.stringify(r.body));
  await wait(2500);
  const help = JSON.parse(fs.readFileSync(path.join(fx.dir, 'staff/help.json'), 'utf8'));
  assert.deepStrictEqual(help.list[0].a, ['Tap Keep an observation.', 'Write what happened.']); assert.deepStrictEqual(help.list[0].roles, ['educator', 'director']);
  r = await fx.as(dee, '/api/staff/page/restore', Object.assign({ stamp: r.body.page.stamp, index: 0 }, at));
  assert.deepStrictEqual(r.body.page.parts[1].body, 'Tap Keep an observation.\nWrite it.');
  // a Presenting entry's wording
  g = (await page(dee, { path: 'staff/presenting/pr1a.json' })).body;
  const pp = g.parts.map(p => ({ body: p.body })); pp[0].body = 'Mud and water';
  assert.strictEqual((await save(dee, { path: 'staff/presenting/pr1a.json' }, { stamp: g.stamp, parts: pp, note: 'Title' })).body.ok, true);
  await wait(2500); const pr = JSON.parse(fs.readFileSync(path.join(fx.dir, 'staff/presenting/pr1a.json'), 'utf8'));
  assert.strictEqual(pr.title, 'Mud and water'); assert.strictEqual(pr.status, 'planning');
  assert.strictEqual((await save(ann, { path: 'staff/presenting/pr1a.json' }, { stamp: g.stamp, parts: pp, note: 'x' })).status, 403);
  // a state form or notice is never on the list
  assert.strictEqual((await page(dee, { path: 'staff/notices.json' })).status, 404);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  // the story frames come from the records
  assert.deepStrictEqual(await s.p.evaluate(() => stFrames()), [{ k: 'puddle', title: 'Jumping in puddles', line: 'Rain boots and splashes.', words: [{ bold: 'I can splash gently.', plain: 'My friends stay dry.' }] }]);
  // the editor opens from a Help answer, and Restore this version needs one tap
  await s.p.evaluate(() => window.TREE_EDIT_PAGE({ path: 'staff/help.json', item: 'h01' }));
  await s.p.waitForSelector('#stpageedit [data-perestore]', { timeout: 15000 });
  await s.p.click('#stpageedit [data-perestore]'); await s.p.waitForFunction(() => !document.querySelector('#stpageedit'), null, { timeout: 8000 });
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('the director keeps her own reflective journal, behind her passcode, read by her alone', async t => {
  const chromium = await browser();
  const fx = await start();
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.strictEqual((await fx.as(dee, '/api/staff/g/journal/open', { name: 'Dee', passcode: 'wrong' })).status, 403);
  const o = await fx.as(dee, '/api/staff/g/journal/open', { name: 'Dee', passcode: 'director-pass-1' });
  assert.strictEqual(o.status, 200, JSON.stringify(o.body));
  const sv = await fx.as(dee, '/api/staff/g/journal/save', { name: 'Dee', key: o.body.key, entry: { joy: 'The goats met the new class.' } });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body)); assert.strictEqual(sv.body.entries[0].joy, 'The goats met the new class.');
  // nobody else opens it
  assert.strictEqual((await fx.as(ann, '/api/staff/g/journal/open', { name: 'Dee', passcode: '1357' })).status, 403);
  // she never joins the growth counts, check-ins, evaluations or reminders
  const boot = (await fx.as(dee, '/api/staff/g/boot', {})).body;
  assert.ok(!boot.people.some(p => p.name === 'Dee')); assert.strictEqual(boot.me.takesPart, false);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => goView('stjour')); await s.p.waitForSelector('[data-gjself]', { timeout: 15000 });
  await s.p.click('[data-gjself]'); await s.p.fill('#gj-pass', 'director-pass-1'); await s.p.click('[data-gjopen]');
  await s.p.waitForSelector('[data-gjf="joy"]', { timeout: 8000 });
  assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /Only you read it/);
  assert.strictEqual(await s.p.evaluate(() => document.querySelector('[data-gjf="joy"]').value), 'The goats met the new class.');
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('the Garden educator role and the Garden group', async t => {
  const chromium = await browser();
  const fx = await start({ more: put => {
    put('children/pip-test.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active' });
    put('children/rue-test.json', { first: 'Rue', last: 'Test', classroom: 'North', status: 'active' });
    put('calendar/settings/program.json', { calendars: [], spaces: [{ id: 'garden', name: 'The garden' }, { id: 'library', name: 'Library' }], dayStart: 420, dayEnd: 1080 });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  // until someone holds the role, the director does
  assert.deepStrictEqual((await fx.as(dee, '/api/data', {})).body.gardenEducators, []);
  // the director gives Bea the role beside her own, which stays as it was
  assert.strictEqual((await fx.as(ann, '/api/staff/profile', { name: 'Bea', profile: { garden: '1' } })).status, 403);
  const r = await fx.as(dee, '/api/staff/profile', { name: 'Bea', profile: { garden: '1' } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.profile.garden, true); assert.strictEqual(r.body.profile.role, 'educator');
  assert.deepStrictEqual((await fx.as(dee, '/api/data', {})).body.gardenEducators, ['Bea']);
  // a garden plan never counts as the educator's Class plan for reminders
  assert.ok(/p\.focus !== 'garden'/.test(fs.readFileSync(path.join(__dirname, '..', 'reminders.js'), 'utf8')));
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Bea', '1357', 1280);
  const np = await s.p.evaluate(() => { const p = newPlan('individual'); plans.set(p.id, p); currentId = p.id; view = 'plans'; renderMain(); return p.id; });
  await s.p.click('[data-focus="garden"]');
  await s.p.click('[data-gkid="pip-test"]'); await s.p.click('[data-gkid="rue-test"]'); await s.p.click('[data-gspace="The garden"]');
  const p = await s.p.evaluate(id => { const p = plans.get(id); return { focus: p.focus, children: p.children, where: p.where, group: p.gardenGroup }; }, np);
  assert.deepStrictEqual(p, { focus: 'garden', children: ['pip-test', 'rue-test'], where: 'The garden', group: 'Garden' });
  // it shows on each Class whose children are in it
  assert.deepStrictEqual(await s.p.evaluate(id => ['West', 'North', 'South'].map(r => planInRoom(plans.get(id), r)), np), [true, true, false]);
  assert.deepStrictEqual(s.errors, []); await s.close();
  // an educator without the role sees no Garden focus
  const a = await signedIn(fx, b, 'Ann', '1357', 1280);
  await a.p.evaluate(() => { const p = newPlan('individual'); plans.set(p.id, p); currentId = p.id; view = 'plans'; renderMain(); });
  assert.strictEqual(await a.p.$('[data-focus="garden"]'), null); await a.close();
});

const GARDEN = { id: 'garden', ready: true, beds: [{ id: 'b1', name: 'Bed one', space: 'garden' }],
  plants: [{ id: 'p-fig', common: 'Fig', eat: 'food', bed: 'b1', ready: ['09', '10'], uses: ['Food'], care: [{ id: 'c1', month: '10', text: 'Gather fallen figs', stage: 'harvest' }] }],
  animals: [{ id: 'a-goats', name: 'Goats', care: [{ id: 'g1', text: 'Feed the goats', every: 'day' }] }],
  plan: { year: '2026-27', months: { '09': { name: 'September', tasks: [{ id: 't1', text: 'Plant cool season starts', stage: 'plant' }] }, '10': { name: 'October', tasks: [{ id: 't2', text: 'Dry apple rings', stage: 'preserve' }] } } },
  tending: {}, agreements: { guiding: ['Pick with purpose.'] }, sources: [] };
const SEASON_PAGE = '<!--\nlibrary: test\n-->\n# Fall\n\nThe rains return.\n\n## What we preserve\n\n- Figs, frozen.\n\n## The animals\' care\n\n- Dry bedding before the rains.\n\n## Our gathering\n\nThe September garden day.\n';

test('the garden year in four seasons, with a preserve stage, animal care by season and a season sheet', async t => {
  const chromium = await browser();
  const fx = await start({ more: put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog' });
    put('staff/library/garden/season-fall.md', SEASON_PAGE); put('staff/wording/food-rule.md', '<!--\nwording: test\n-->\n# Food rule\n\n## rule\n\nNever on the menu.\n'); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const g = (await fx.as(dee, '/api/staff/garden', {})).body;
  assert.deepStrictEqual(g.seasons.map(x => [x.key, x.months]), [['fall', ['09', '10', '11']], ['winter', ['12', '01', '02']], ['spring', ['03', '04', '05']], ['summer', ['06', '07', '08']]]);
  assert.ok(g.stages.includes('preserve')); assert.strictEqual(g.library['season-fall'].lead, 'The rains return.');
  // the old seasons topic list is gone from plan forms
  const app = fs.readFileSync(path.join(__dirname, '..', 'src/app.html'), 'utf8');
  assert.ok(!/SEASONS|seasonOf|f\.seasons/.test(app));
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 390);
  await s.p.evaluate(() => goView('garden')); await s.p.waitForSelector('[data-gseason="fall"]', { timeout: 15000, state: 'attached' });
  const fall = await s.p.evaluate(() => gdnSeason(gdn.seasons[0]));
  const sec = Object.fromEntries(fall.sections);
  assert.deepStrictEqual(sec['What we plant'], ['Plant cool season starts']);
  assert.deepStrictEqual(sec['What we harvest'], ['Fig']);
  assert.deepStrictEqual(sec['What we preserve'], ['Figs, frozen.', 'Dry apple rings']);
  assert.deepStrictEqual(sec["The animals' care"], ['Feed the goats, each day', 'Dry bedding before the rains.']);
  assert.deepStrictEqual(sec['Our gathering'], ['The September garden day.']);
  const doc = await s.p.evaluate(() => gdnSeasonDoc(gdn.seasons[0]));
  assert.strictEqual(doc.title, 'Fall in our garden'); assert.ok(doc.blocks.some(x => x.label === 'Our food rule' && x.text === 'Never on the menu.'));
  // animal care has a season view
  await s.p.evaluate(() => document.querySelector('[data-gaseason="fall"]').click());
  assert.match(await s.p.evaluate(() => document.querySelector('[data-gfold="animals"]').textContent), /Dry bedding before the rains/);
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('each month shows iGrow Sonoma\'s guidance in our own words, credited and linked', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog' });
    put('staff/library/garden/igrow.md', '<!--\nlibrary: test\n-->\n# iGrow\n\n## 09\n\nSow peas and fava beans.\n'); } });
  const b = await chromium.launch(); t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => goView('garden')); await s.p.waitForSelector('[data-gseason="fall"]', { timeout: 15000, state: 'attached' });
  const txt = await s.p.evaluate(() => document.querySelector('[data-gseason="fall"]').textContent);
  assert.match(txt, /Sow peas and fava beans\.\s*Summarized in our own words from iGrow Sonoma's guidance for September/);
  assert.ok(await s.p.$('[data-pageedit="staff/library/garden/igrow.md"]'));
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('the permaculture premises sit once at the top of the Garden, beside our guiding agreements, with their source', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog' });
    put('staff/library/garden/permaculture.md', '<!--\nlibrary: test\n-->\n# Our permaculture premises\n\nThree ethics.\n\n## The three ethics\n\n- **Earth care.** Be kind.\n\n## Principles we already practice\n\n- **Produce no waste.** Compost.\n\n## Where these come from\n\nFrom [the book](https://example.test/ethics).\n'); } });
  const b = await chromium.launch(); t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Ann', '1357', 1280);
  await s.p.evaluate(() => goView('garden')); await s.p.waitForFunction(() => /Our permaculture premises/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
  const txt = await s.p.evaluate(() => document.querySelector('#main').innerText);
  assert.ok(txt.indexOf('Our permaculture premises') < txt.indexOf('The site map'));
  assert.match(txt, /Pick with purpose\.[\s\S]*Earth care\. Be kind\./);
  assert.strictEqual(await s.p.evaluate(() => document.querySelector('#main a[href="https://example.test/ethics"]').textContent), 'the book');
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('preserving the harvest, with our food rule, and never canning', async t => {
  const chromium = await browser();
  const fx = await start({ more: put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog', harvests: [{ id: 'h1', plant: 'p-fig', plantName: 'Fig', date: '2026-09-20' }] });
    put('staff/library/garden/preserving.md', '<!--\nlibrary: test\n-->\n# Preserving\n\nWe preserve.\n\n## How we preserve\n\n- Drying.\n\n## Herbs, drying and tea\n\n- Hang small bundles.\n');
    put('staff/wording/food-rule.md', '<!--\nwording: test\n-->\n# Food rule\n\n## rule\n\nNever on the menu.\n'); } });
  t.after(() => fx.stop());
  const ann = (await fx.login('Ann', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  let r = await fx.as(ann, '/api/staff/garden/preserve', { harvest: 'h1', method: 'dry', note: 'Two jars', children: true });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.deepStrictEqual(r.body.preserves.map(x => [x.what, x.method, x.children]), [['Fig', 'dry', true]]);
  assert.strictEqual((await fx.as(ann, '/api/staff/garden/preserve', { harvest: 'h1', method: 'can' })).status, 400);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Ann', '1357', 390);
  await s.p.evaluate(() => goView('garden')); await s.p.waitForSelector('[data-gfold="preserve"]', { timeout: 15000, state: 'attached' });
  const txt = await s.p.evaluate(() => document.querySelector('[data-gfold="preserve"]').textContent);
  assert.match(txt, /Our food rule\. Never on the menu\./); assert.match(txt, /Fig, dried, Two jars, with children/); assert.doesNotMatch(txt, /\bcann(ed|ing)\b/i);
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('the family seed library: families offer seed through the wish list, and the director adds a donation', async t => {
  const chromium = await browser();
  const fx = await start({ more: put => { put('staff/garden/setup.json', GARDEN); put('staff/garden/log.json', { id: 'gardenlog', seeds: [{ id: 's1', name: 'Fava bean', from: 'saved' }] });
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'fern.family@example.test', children: ['fern'] }] });
    put('children/fern.json', { first: 'Fern', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'fern.family@example.test' }] });
    put('participation/seeds1.json', { id: 'seeds1', kind: 'item', type: 'wish', title: 'Seeds for the family seed library', seedLibrary: true, question: 'Which seeds are you bringing?', open: true, test: true, hours: 1, signups: [] }); } });
  t.after(() => fx.stop());
  const c = await fx.as('', '/family/code', { email: 'fern.family@example.test' }); const fam = (await fx.as('', '/family/login', { email: 'fern.family@example.test', code: c.body.code })).body.token;
  const su = await fx.as(fam, '/family/signup', { itemId: 'seeds1', on: true, who: 'Fern\'s dad', answer: 'Sunflower seeds' });
  assert.strictEqual(su.status, 200, JSON.stringify(su.body));
  // a family never writes to the garden records
  assert.notStrictEqual((await fx.as(fam, '/api/staff/garden/seed', { name: 'x' })).status, 200);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => goView('garden')); await s.p.waitForSelector('[data-gseedaccept]', { timeout: 15000, state: 'attached' });
  await s.p.evaluate(() => document.querySelector('[data-gseedaccept]').click());
  await s.p.waitForFunction(() => (gdn.seeds || []).some(x => x.name === 'Sunflower seeds'), null, { timeout: 10000 });
  const seed = await s.p.evaluate(() => gdn.seeds.find(x => x.name === 'Sunflower seeds'));
  assert.strictEqual(seed.from, 'donated'); assert.strictEqual(seed.share, true); assert.strictEqual(seed.source, 'Fern\'s dad');
  await wait(2000);
  assert.ok(JSON.parse(fs.readFileSync(path.join(fx.dir, 'participation/seeds1.json'), 'utf8')).signups[0].seedAccepted);
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('one bank of provocations and curiosity prompts, under a plan\'s questions and in Settings', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => put('staff/library/prompts/provocations.md', '<!--\nlibrary: provocations\n-->\n# Provocations and curiosity prompts\n\nWonderings.\n\n## Curiosity cards\n\n- We wonder what the children notice about leaves.\n\n## Fall in the garden\n\n- How might the children sort windfall apples?\n\n## Where the garden set comes from\n\n- [KidsGardening](https://kidsgardening.org/resources/ece-garden-lessons/)\n') });
  const b = await chromium.launch(); t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Ann', '1357', 1280);
  await s.p.evaluate(() => { const p = newPlan('individual'); p.classroom = 'West'; plans.set(p.id, p); currentId = p.id; view = 'plans'; renderMain(); });
  await s.p.waitForFunction(() => /Provocations and curiosity prompts/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
  const chip = await s.p.$('[data-insert="We wonder what the children notice about leaves. "]'); assert.ok(chip);
  assert.ok(await s.p.$('a[href="https://kidsgardening.org/resources/ece-garden-lessons/"]'));
  assert.deepStrictEqual(s.errors, []); await s.close();
  const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await d.p.evaluate(() => { setOpen = 'Provocations and curiosity prompts'; goView('settings'); });
  await d.p.waitForFunction(() => /Curiosity cards, 1\. Fall in the garden, 1\./.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
  assert.ok(await d.p.$('[data-pageedit="staff/library/prompts/provocations.md"]'));
  await d.close();
});

const RECIPE = (title, kind, extra) => `<!--\nlibrary: recipe\nkind: ${kind}\nsource: Ours\n${extra || ''}-->\n# ${title}\n\nA lead.\n\n## Ingredients\n\n- 2 cups flour\n- 1/2 teaspoon salt\n\n## Tools\n\n- a bowl\n\n## Steps\n\n- Mix the flour and salt.\n- An adult bakes it for 20 minutes.\n\n## Dairy free\n\n- Use oat milk.\n`;

test('the recipe library: food and sensory apart, drafts for the director, the kitchen allowed, and the recipe of the month from it', async t => {
  const chromium = await browser();
  const month = new Date().toISOString().slice(0, 7);
  const fx = await start({ more: put => {
    put('staff/library/recipes/flatbread.md', RECIPE('Flatbread', 'food')); put('staff/library/recipes/playdough.md', RECIPE('Playdough', 'sensory'));
    put('staff/wording/food-rule.md', '<!--\nwording: test\n-->\n# Food rule\n\n## rule\n\nNever on the menu.\n');
    put('menus/' + month + '.json', { id: month, recipeId: 'flatbread', recipe: 'Flatbread', days: {} });
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'fern.family@example.test', children: ['fern'] }] });
    put('children/fern.json', { first: 'Fern', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'fern.family@example.test' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const L = (await fx.as(ann, '/api/staff/library', {})).body;
  assert.deepStrictEqual(L.recipes.map(x => [x.id, x.meta.kind]), [['flatbread', 'food'], ['playdough', 'sensory']]);
  // an educator's recipe waits as a draft, which only the director, the kitchen and its writer see
  let r = await fx.as(ann, '/api/staff/library/add', { kind: 'recipe', title: 'Pear crisp', ingredients: '- 4 pears', steps: '- Slice the pears.' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.draft, true);
  assert.ok(!(await fx.as((await fx.login('Bea', '1357')).token, '/api/staff/library', {})).body.recipes.some(x => x.id === 'pear-crisp'));
  // the kitchen adds a recipe that is ready, and edits it with its history
  r = await fx.as(kit, '/api/staff/library/add', { kind: 'recipe', title: 'Soup', ingredients: '- water', steps: '- Heat it.' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.strictEqual(r.body.draft, false);
  const pg = await fx.as(kit, '/api/staff/page', { path: 'staff/library/recipes/soup.md' }); assert.strictEqual(pg.status, 200);
  assert.strictEqual((await fx.as(kit, '/api/staff/page', { path: 'staff/guides/x.md' })).status, 403);
  // the director adds the draft to the library
  r = await fx.as(dee, '/api/staff/library/ready', { path: 'staff/library/recipes/pear-crisp.md', on: true });
  assert.ok(r.body.recipes.find(x => x.id === 'pear-crisp' && !x.draft));
  // a family shares a recipe from the Family page, as a draft, and a recipe with nuts is refused
  const c = await fx.as('', '/family/code', { email: 'fern.family@example.test' }); const fam = (await fx.as('', '/family/login', { email: 'fern.family@example.test', code: c.body.code })).body.token;
  assert.strictEqual((await fx.as(fam, '/family/recipe', { title: 'Nut bars', ingredients: 'almonds', steps: 'mix' })).status, 400);
  r = await fx.as(fam, '/family/recipe', { title: 'Grandma\'s rice', ingredients: 'rice\nwater', steps: 'Cook the rice.' }); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const fr = (await fx.as(dee, '/api/staff/library', {})).body.recipes.find(x => x.id === 'grandma-s-rice');
  assert.ok(fr.draft); assert.strictEqual(fr.meta.source, 'The Test family');
  // the recipe of the month on the Family page comes from the library
  const fd = (await fx.as(fam, '/family/data', {})).body;
  const rec = JSON.stringify(fd).match(/"recipe":\{"name":"Flatbread","text":"Ingredients\\n2 cups flour/); assert.ok(rec, 'recipe of the month from the library');
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Kit', '1357', 390);
  await s.p.evaluate(() => goView('recipes')); await s.p.waitForSelector('[data-reckind="sensory"]', { timeout: 15000 });
  assert.strictEqual(await s.p.evaluate(() => view), 'recipes');
  const food = await s.p.evaluate(() => document.querySelector('#main').textContent);
  assert.match(food, /Flatbread/); assert.doesNotMatch(food, /Playdough/); assert.match(food, /Our food rule\. Never on the menu\. We are nut free\./);
  await s.p.click('[data-reckind="sensory"]');
  const sens = await s.p.evaluate(() => document.querySelector('#main').textContent);
  assert.match(sens, /Playdough/); assert.match(sens, /color with garden plants and use no glitter/);
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('demonstration sheets: handwashing first, a step a sheet, measures drawn, adult steps marked, times shown', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => put('staff/library/recipes/flatbread.md', RECIPE('Flatbread', 'food')) });
  const b = await chromium.launch(); t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  await s.p.evaluate(() => goView('recipes')); await s.p.waitForFunction(() => libData, null, { timeout: 15000 });
  const P = await s.p.evaluate(() => { const P = demoPlan(libData.recipes[0]); return { ings: P.overview.ings.map(x => x.text), sheets: P.sheets.map(x => [x.n, x.text, x.adult, x.pics.map(p => p.cap)]) }; });
  assert.deepStrictEqual(P.ings, ['2 cups flour', '1/2 teaspoon salt']);
  assert.deepStrictEqual(P.sheets[0].slice(0, 3), [1, 'Wash our hands.', false]);
  assert.deepStrictEqual(P.sheets[1], [2, 'Mix the flour and salt.', false, ['1 cup', '1 cup', 'flour', '1/2 teaspoon', 'salt']]);
  assert.deepStrictEqual(P.sheets[2], [3, 'An adult bakes it for 20 minutes.', true, ['20 minutes']]);
  // a measure is drawn to its level, and a teaspoon is drawn smaller than a cup
  assert.ok(await s.p.evaluate(() => DEMO_SCALE.teaspoon < DEMO_SCALE.tablespoon && DEMO_SCALE.tablespoon < DEMO_SCALE.cup && JSON.stringify(demoFills(demoQty('2 1/2 cups milk'))) === '[1,1,0.5]'));
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('the song book: a © song keeps only its title, songwriter and recording, and a traditional song its words', async t => {
  const chromium = await browser();
  const fx = await start({ more: put => {
    put('staff/library/songs/a-song.md', '<!--\nlibrary: song\ncopyright: yes\nsongwriter: A Writer\nlink: https://example.test/listen\n-->\n# A Song\n');
    put('staff/library/songs/old-tune.md', '<!--\nlibrary: song\ncopyright: no\nsongwriter: Traditional\n-->\n# Old Tune\n\n## Words\n\nLa la la\nLa la\n');
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  let L = (await fx.as(ann, '/api/staff/library', {})).body;
  assert.deepStrictEqual(L.songs.find(x => x.id === 'a-song').parts, []);
  assert.strictEqual(L.songs.find(x => x.id === 'old-tune').parts[0].text, 'La la la\nLa la');
  // words written onto a © song are never kept
  const pg = (await fx.as(dee, '/api/staff/page', { path: 'staff/library/songs/a-song.md' })).body;
  assert.strictEqual(pg.parts.length, 0);
  // marking a traditional song © removes its words, and only the director may
  assert.strictEqual((await fx.as(ann, '/api/staff/library/copyright', { path: 'staff/library/songs/old-tune.md', on: true })).status, 403);
  L = (await fx.as(dee, '/api/staff/library/copyright', { path: 'staff/library/songs/old-tune.md', on: true })).body;
  await wait(1500);
  assert.doesNotMatch(fs.readFileSync(path.join(fx.dir, 'staff/library/songs/old-tune.md'), 'utf8'), /La la/);
  // taking the mark off leaves a place for words
  await fx.as(dee, '/api/staff/library/copyright', { path: 'staff/library/songs/old-tune.md', on: false }); await wait(1500);
  assert.match(fs.readFileSync(path.join(fx.dir, 'staff/library/songs/old-tune.md'), 'utf8'), /## Words/);
  // a song added with the mark keeps no words even when some are sent
  const r = await fx.as(dee, '/api/staff/library/add', { kind: 'song', title: 'New Hit', songwriter: 'Someone', copyright: true, words: 'Do not keep me' });
  assert.strictEqual(r.status, 200); await wait(1500);
  assert.doesNotMatch(fs.readFileSync(path.join(fx.dir, 'staff/library/songs/new-hit.md'), 'utf8'), /Do not keep me/);
  if (!chromium) return;
  const b = await chromium.launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Ann', '1357', 390);
  await s.p.evaluate(() => goView('songs')); await s.p.waitForFunction(() => libData, null, { timeout: 15000 });
  const txt = await s.p.evaluate(() => document.querySelector('#main').textContent);
  assert.match(txt, /© A Song A Writer/); assert.ok(await s.p.$('a[href="https://example.test/listen"]'));
  assert.deepStrictEqual(await s.p.evaluate(() => songDoc(libData.songs.find(x => x.id === 'a-song')).blocks), []);
  assert.deepStrictEqual(s.errors, []); await s.close();
});

test('Attach on a plan reaches every library, suggests the best matches instantly, and prints what is attached', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => {
    put('staff/library/songs/five-little-speckled-frogs.md', '<!--\nlibrary: song\ncopyright: no\nsongwriter: Traditional\n-->\n# Five Little Speckled Frogs\n\n## Words\n\nSat on a log\n');
    put('staff/library/songs/a-hit.md', '<!--\nlibrary: song\ncopyright: yes\nsongwriter: A Writer\n-->\n# A Hit About Frogs\n');
    put('staff/library/recipes/pear-crisp.md', RECIPE('Pear crisp', 'food').replace('2 cups flour', '4 pears'));
    put('staff/library/recipes/flatbread.md', RECIPE('Flatbread', 'food'));
  } });
  const b = await chromium.launch(); t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Ann', '1357', 1280);
  await s.p.evaluate(() => goView('songs')); await s.p.waitForFunction(() => libData, null, { timeout: 15000 });
  // a plan that names frogs is offered the frog songs first
  const sug = await s.p.evaluate(() => { const p = newPlan('individual'); p.classroom = 'West'; p.fields.area = 'Frogs at the creek'; return attachSuggest(p).map(x => x.kind + ':' + x.id); });
  assert.deepStrictEqual(sug.slice(0, 2).sort(), ['song:a-hit', 'song:five-little-speckled-frogs']);
  // a piazza plan in a week with pears in the bin is offered the pear recipe
  const pear = await s.p.evaluate(() => { binCurrent = () => ({ items: [{ name: 'Bartlett pears' }] }); const p = newPlan('individual'); p.where = 'The piazza'; return attachSuggest(p).map(x => x.id); });
  assert.strictEqual(pear[0], 'pear-crisp');
  // attaching, and what prints with the plan: a traditional song's words, a © song's title alone, a recipe
  const docs = await s.p.evaluate(async () => { const p = newPlan('individual'); p.attached = [{ kind: 'song', id: 'five-little-speckled-frogs', title: 'x' }, { kind: 'song', id: 'a-hit', title: 'x' }, { kind: 'recipe', id: 'pear-crisp', title: 'x' }];
    const a = await attachDocs(p); return { titles: a.docs.map(d => d.title), blocks: a.docs.map(d => d.blocks.length), recipes: a.recipes.map(r => r.id) }; });
  assert.deepStrictEqual(docs.titles, ['Five Little Speckled Frogs', '© A Hit About Frogs', 'Pear crisp']);
  assert.strictEqual(docs.blocks[1], 0); assert.deepStrictEqual(docs.recipes, ['pear-crisp']);
  // a plan with nothing attached shows only the Attach button
  await s.p.evaluate(() => { const p = newPlan('individual'); p.classroom = 'West'; plans.set(p.id, p); currentId = p.id; view = 'plans'; renderMain(); });
  assert.ok(await s.p.$('[data-attopen]')); assert.strictEqual(await s.p.$('#attachsec'), null);
  assert.deepStrictEqual(s.errors, []); await s.close();
});
