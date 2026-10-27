'use strict';
// Session 14. PD paths and assignments, with First weeks built in from the first-weeks parts. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const part = (order, title, more) => `<!--\norder: ${order}\naudience: ${(more || {}).audience || 'all'}\nplace: ${(more || {}).place || 'newed'}\n${(more || {}).draft ? 'status: draft\n' : ''}-->\n# ${title}\n\nA few words. Ask {goTo}.\n`;
const day = n => { const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test('PD paths and assignments', async t => {
  const fx = await start({ more: put => {
    put('staff/newed/01-first.md', part(1, 'Your first day')); put('staff/newed/02-second.md', part(2, 'Your first week'));
    put('staff/newed/03-later.md', part(3, 'A part still a draft', { draft: true })); put('staff/newed/experienced.md', part(4, 'For experienced educators', { audience: 'experienced' }));
    put('staff/newed/welcome.md', part(0, 'A letter', { place: 'pdlibrary' }));
    put('staff/pd/modules/05-garden.md', '<!--\nstatus: draft\nminutes: 30\n-->\n# The Garden as Educator\n\nLead.\n\n## Why it matters\n\nWords.\n\n## Reflect\n\nA question.\n');
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
  const neo = (await fx.login('Neo', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const S = (tok, p, b) => fx.as(tok, '/api/staff/' + p, b || {});
  const mine = async tok => (await S(tok, 'paths/mine')).body.list || [];

  await t.test('only the director creates and assigns', async () => {
    assert.strictEqual((await S(ann, 'paths')).status, 403);
    assert.strictEqual((await S(ann, 'paths/save', { path: { title: 'Mine', steps: [{ kind: 'module', slug: 'documentation' }] } })).status, 403);
    assert.strictEqual((await S(ann, 'paths/assign', { kind: 'module', slug: 'documentation', people: ['Ann'] })).status, 403);
    assert.strictEqual((await S(ann, 'paths/copy', { id: 'firstweeks' })).status, 403);
    // the kitchen never receives any of it
    assert.strictEqual((await S(kit, 'paths/mine')).status, 403);
    const r = await S(dee, 'paths/save', { path: { title: 'Garden series', desc: 'Our garden year.', steps: [{ kind: 'module', slug: 'documentation' }, { kind: 'module', slug: 'garden' }, { kind: 'module', slug: 'nothing-here' }] } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body)); const p = r.body.paths.find(x => x.id === r.body.id);
    assert.deepStrictEqual(p.steps.map(s => s.slug), ['documentation', 'garden']); assert.ok(p.steps[1].waiting);
    assert.strictEqual((await S(dee, 'paths/save', { path: { title: '', steps: [{ kind: 'module', slug: 'documentation' }] } })).status, 400);
  });

  await t.test('First weeks lists the first-weeks parts and reaches a new hire by itself', async () => {
    const r = (await S(dee, 'paths')).body; const fw = r.paths[0];
    assert.strictEqual(fw.id, 'firstweeks'); assert.ok(fw.builtin && fw.onboarding);
    assert.deepStrictEqual(fw.steps.map(s => s.slug), ['01-first', '02-second', '03-later', 'experienced']);
    assert.ok(fw.steps[2].waiting); assert.ok(!fw.steps[0].waiting);
    const auto = r.assignments.find(a => a.id === 'auto-firstweeks'); assert.ok(auto); assert.deepStrictEqual(auto.progress.map(p => p.name), ['Neo']);
    const m = await mine(neo); const a = m.find(x => x.id === 'auto-firstweeks'); assert.ok(a);
    // the draft part and the part for experienced educators stay with the director
    assert.deepStrictEqual(a.steps.map(s => s.slug), ['01-first', '02-second']); assert.strictEqual(a.state, 'none');
    assert.ok(!(await mine(ann)).some(x => x.auto));
    // opening a part counts it as done
    assert.strictEqual((await S(neo, 'paths/opened', { slug: '03-later' })).status, 404);
    assert.strictEqual((await S(neo, 'paths/opened', { slug: '01-first' })).status, 200);
    const b = (await mine(neo)).find(x => x.id === 'auto-firstweeks'); assert.ok(b.steps[0].done); assert.strictEqual(b.state, 'progress');
    assert.strictEqual((await S(dee, 'paths/remove', { id: 'firstweeks' })).status, 400);
    assert.strictEqual((await S(dee, 'paths/unassign', { id: 'auto-firstweeks' })).status, 400);
  });

  await t.test('changing the order of First weeks changes the New Educator order', async () => {
    const bad = await S(dee, 'paths/save', { path: { id: 'firstweeks', steps: [{ kind: 'newed', slug: '01-first' }] } }); assert.strictEqual(bad.status, 400);
    const r = await S(dee, 'paths/save', { path: { id: 'firstweeks', steps: ['02-second', '01-first', '03-later', 'experienced'].map(slug => ({ kind: 'newed', slug })) } });
    assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.body.paths[0].steps.map(s => s.slug), ['02-second', '01-first', '03-later', 'experienced']);
    const ne = (await S(neo, 'newed')).body.list.filter(x => x.place === 'newed').map(x => x.slug); assert.deepStrictEqual(ne, ['02-second', '01-first']);
  });

  let copy = '';
  await t.test('copying a path, and choosing an onboarding path for a new educator', async () => {
    const c = await S(dee, 'paths/copy', { id: 'firstweeks' }); assert.strictEqual(c.status, 200); copy = c.body.id;
    const p = c.body.paths.find(x => x.id === copy); assert.strictEqual(p.title, 'Copy of First weeks'); assert.ok(p.onboarding && !p.builtin);
    assert.deepStrictEqual(p.steps.map(s => s.slug), ['02-second', '01-first', '03-later', 'experienced']);
    // a new onboarding path mixes parts of the first weeks and modules
    const s = await S(dee, 'paths/save', { path: { id: copy, title: 'Serving Two-Year-Olds team', desc: '', onboarding: true, steps: [{ kind: 'newed', slug: '01-first' }, { kind: 'module', slug: 'documentation' }] } });
    assert.strictEqual(s.status, 200); assert.strictEqual(s.body.paths.length, 3);
    assert.strictEqual((await S(dee, 'profile', { name: 'Neo', profile: { onboarding: copy } })).status, 200);
    const m = await mine(neo); assert.ok(m.some(x => x.id === 'auto-' + copy && x.title === 'Serving Two-Year-Olds team')); assert.ok(!m.some(x => x.id === 'auto-firstweeks'));
    assert.deepStrictEqual((await S(neo, 'newed')).body.list.filter(x => x.place === 'newed').map(x => x.slug), ['01-first']);
    await S(dee, 'profile', { name: 'Neo', profile: { onboarding: '' } });
    assert.ok((await mine(neo)).some(x => x.id === 'auto-firstweeks'));
  });

  await t.test('a class assignment reaches every educator in that class, and each sees only their own', async () => {
    const r = await S(dee, 'paths/assign', { kind: 'path', id: copy, classes: ['North'], ways: { documentation: 'meeting' }, due: day(5), note: 'Before our team meeting.' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body)); const a = r.body.assignments.find(x => x.id === r.body.id);
    assert.deepStrictEqual(a.progress.map(p => p.name), ['Bea']); assert.strictEqual(a.steps.find(s => s.slug === 'documentation').way, 'meeting');
    const b = (await mine(bea)).find(x => x.id === r.body.id); assert.ok(b); assert.strictEqual(b.note, 'Before our team meeting.'); assert.strictEqual(b.due, day(5));
    assert.deepStrictEqual(b.steps.map(s => [s.slug, s.way || '']), [['01-first', ''], ['documentation', 'meeting']]);
    assert.ok(!(await mine(ann)).some(x => x.id === r.body.id));
    const one = await S(dee, 'paths/assign', { kind: 'module', slug: 'documentation', people: ['Ann'] }); assert.strictEqual(one.status, 200);
    assert.ok((await mine(ann)).some(x => x.id === one.body.id)); assert.ok(!(await mine(bea)).some(x => x.id === one.body.id));
    assert.strictEqual((await S(dee, 'paths/assign', { kind: 'module', slug: 'documentation' })).status, 400);
  });

  await t.test('a draft module stays hidden until it is marked ready', async () => {
    const r = await S(dee, 'paths/assign', { kind: 'module', slug: 'garden', people: ['Ann'] }); assert.strictEqual(r.status, 200);
    const a = r.body.assignments.find(x => x.id === r.body.id); assert.ok(a.steps[0].waiting);
    assert.ok(!(await mine(ann)).some(x => x.id === r.body.id));
    assert.strictEqual((await S(dee, 'g/module/ready', { slug: 'garden', on: true })).status, 200);
    assert.ok((await mine(ann)).some(x => x.id === r.body.id));
    await S(dee, 'g/module/ready', { slug: 'garden', on: false });
    assert.ok(!(await mine(ann)).some(x => x.id === r.body.id));
  });

  await t.test('progress comes from the layers in the growth record', async () => {
    const own = await S(dee, 'paths/assign', { kind: 'module', slug: 'documentation', people: ['Ann'], ways: { documentation: 'own' }, due: day(-1) });
    const pdd = await S(dee, 'paths/assign', { kind: 'module', slug: 'documentation', people: ['Ann'], ways: { documentation: 'pdday' } });
    const st = async id => ((await S(dee, 'paths')).body.assignments.find(x => x.id === id).progress.find(p => p.name === 'Ann'));
    let p = await st(own.body.id); assert.strictEqual(p.state, 'none'); assert.ok(p.overdue);
    assert.strictEqual((await S(ann, 'g/module/progress', { slug: 'documentation', progress: { reflection: 'It went well.', finish: true } })).status, 200);
    p = await st(own.body.id); assert.strictEqual(p.state, 'done'); assert.ok(!p.overdue);
    p = await st(pdd.body.id); assert.strictEqual(p.state, 'progress');
    const m = (await mine(ann)).find(x => x.id === pdd.body.id); assert.ok(!m.steps[0].done && m.steps[0].started);
    assert.strictEqual((await S(dee, 'paths/unassign', { id: pdd.body.id })).status, 200);
    assert.ok(!(await mine(ann)).some(x => x.id === pdd.body.id));
  });

  await t.test('a finish-by date shows on the TREE calendar, for the person and the director', async () => {
    const ev = async tok => ((await fx.as(tok, '/api/view', { from: day(0), to: day(10) })).body.events || []).filter(e => /^tgrow\.pdue\./.test(e.id));
    const b = await ev(bea); assert.ok(b.some(e => e.start === day(5) && e.title === 'PD due, Serving Two-Year-Olds team' && e.cal === 'tgrow'));
    assert.ok(!(await ev(ann)).some(e => /Serving/.test(e.title)));
    assert.ok((await ev(dee)).some(e => /Serving/.test(e.title) && /0 of 1 finished/.test(e.desc)));
  });

  await t.test('deleting a path takes its assignments with it', async () => {
    const r = await S(dee, 'paths/remove', { id: copy }); assert.strictEqual(r.status, 200);
    assert.ok(!r.body.paths.some(p => p.id === copy)); assert.ok(!r.body.assignments.some(a => a.path === copy));
    assert.ok(!(await mine(bea)).length);
    // a path to keep for the browser check
    const g = await S(dee, 'paths/assign', { kind: 'path', id: 'firstweeks', people: ['Ann'], note: 'Read these again this fall.' }); assert.strictEqual(g.status, 200);
    await wait(1500);
  });

  await t.test('Assigned to you shows for an educator, and Paths for the director', async () => {
    const chromium = await browser(); if (!chromium) return;
    const b = await chromium.launch(); t.after(() => b.close());
    const s = await signedIn(fx, b, 'Ann', '1357', 390);
    await s.p.evaluate(() => goView('stpd')); await s.p.waitForFunction(() => /Assigned to you/.test(document.getElementById('main').innerText), null, { timeout: 15000 });
    const txt = await s.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(txt, /Read these again this fall/); assert.match(txt, /Documentation at Fulton/); assert.doesNotMatch(txt, /Assigned PD/);
    assert.ok(txt.indexOf('Assigned to you') < txt.indexOf('Modules'));
    const d = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
    await d.p.evaluate(() => goView('stpd')); await d.p.waitForFunction(() => /Assigned PD/.test(document.getElementById('main').innerText), null, { timeout: 15000 });
    const dt = await d.p.evaluate(() => document.getElementById('main').innerText);
    assert.match(dt, /Paths/); assert.match(dt, /First weeks/); assert.match(dt, /New path/); assert.match(dt, /Draft, not visible yet/);
    await d.p.evaluate(() => document.querySelector('[data-panew]').click()); await wait(800);
    assert.ok(await d.p.evaluate(() => !!document.getElementById('pa-title')));
    assert.deepStrictEqual(s.errors, []); assert.deepStrictEqual(d.errors, []);
  });
});
