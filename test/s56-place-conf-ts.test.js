// a place chosen by hand stays, a new family sees conference times once sign-ups open, the director removes a transition
// summary made by mistake, and one observation counts for two DRDP measures at most (November 6, 2026)
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const ROOT = path.join(__dirname, '..');

test('the educator who kept an observation, or the director, chooses its place, and TREE keeps that choice', async t => {
  const fx = await start({ more: put => {
    put('settings/program.json', { id: 'program', classrooms: ['West', 'North', 'South'], groups: [], places: ['Goat yard', 'Garden', 'Tire swing yard'] });
    put('calendar/settings/program.json', { calendars: [], spaces: [{ id: 'lg', name: 'Large group, Tire swing yard' }, { id: 'ts', name: 'Tire swing yard' }], dayStart: 420, dayEnd: 1080 });
    put('notices/n1.json', { by: 'Ann', at: Date.now() - 864e5, classroom: 'West', noticed: 'We fed the goats in the goat yard.', place: ['Goat yard'] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
  const list = (await fx.as(ann, '/api/notices/place', {})).body.places;
  assert.ok(list.includes('Tire swing yard') && list.includes('Garden'));
  assert.ok(!list.some(x => /^large group/i.test(x)), 'a large group booking reads as the place itself');
  assert.equal((await fx.as(bea, '/api/notices/place', { id: 'n1', place: ['Garden'] })).status, 403, 'another educator does not change it');
  const r = await fx.as(ann, '/api/notices/place', { id: 'n1', place: ['Garden', 'Nowhere real', 'Large group, Tire swing yard'] });
  assert.equal(r.status, 200); assert.deepEqual(r.body.place, ['Garden', 'Tire swing yard'], 'only the site\'s places, tidied');
  // a later save from a phone with the words changed keeps the place as chosen
  assert.equal((await fx.as(ann, '/api/write', { kind: 'notices', id: 'n1', op: 'update', patch: { noticed: 'We fed the goats in the goat yard again.', place: ['Goat yard'] } })).status, 200);
  await new Promise(z => setTimeout(z, 2500));
  const seen = async () => { const j = await (await fetch(fx.api + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + dee }, body: '{}' })).json(); return (j.data || j).notices.n1; };
  const n = await seen(); assert.deepEqual(n.place, ['Garden', 'Tire swing yard']); assert.equal(n.placeSet.by, 'Ann');
  assert.equal((await fx.as(dee, '/api/notices/place', { id: 'n1', place: [] })).status, 200, 'the director may clear it');
  assert.deepEqual((await seen()).place, []);
});

test('a new family sees conference times beside the visit, once conference sign-ups are open', async t => {
  const fx = await start({ more: put => {
    put('settings/main.json', { id: 'main', classrooms: ['South'], years: ['2026-27'], conferenceBooking: 'tree' });
    put('participation/config.json', { id: 'config', test: true, confOpen: true, testers: [{ email: 'zee.family@example.test', children: ['zee'] }] });
    put('children/zee.json', { first: 'Zee', last: 'Test', classroom: 'South', status: 'active', enrollDate: '2020-01-01', welcomeOn: true, parents: [{ email: 'zee.family@example.test' }] });
    put('participation/v1.json', { id: 'v1', kind: 'slot', purpose: 'visit', test: true, date: '2099-11-16', time: '12:30', minutes: 30 });
    put('participation/c1.json', { id: 'c1', kind: 'slot', purpose: 'conference', test: true, date: '2099-11-09', time: '09:00', minutes: 20, classroom: 'South' });
    put('participation/c2.json', { id: 'c2', kind: 'slot', purpose: 'conference', test: true, date: '2099-11-09', time: '09:20', minutes: 20, classroom: 'West' });
  } });
  t.after(() => fx.stop());
  const c = await fx.as('', '/family/code', { email: 'zee.family@example.test' }); const fam = (await fx.as('', '/family/login', { email: 'zee.family@example.test', code: c.body.code })).body.token;
  const k = (await fx.as(fam, '/family/data', {})).body.children[0];
  assert.equal(k.slotPurpose, 'visit'); assert.deepEqual(k.slots.map(s => s.id), ['v1']);
  assert.deepEqual(k.confSlots.map(s => s.id), ['c1'], 'their own class\'s conference times');
  assert.equal((await fx.as(fam, '/family/book', { slotId: 'c1', childId: 'zee', on: true })).status, 200);
  assert.match(fs.readFileSync(path.join(ROOT, 'family.html'), 'utf8'), /slotList\(k,k\.confSlots\)/);
});

test('the director removes a transition summary made by mistake, and an educator does not', async t => {
  const fx = await start({ more: put => put('children/art.json', { first: 'Art', last: 'Hod', classroom: 'South', status: 'active', transitionSummary: { '2026-27': { sections: { who: 'Words' }, status: 'draft' } } }) });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const doc = async () => { const j = await (await fetch(fx.api + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + dee }, body: '{}' })).json(); return (j.data || j).children.art; };
  await fx.as(ann, '/api/write', { kind: 'children', id: 'art', op: 'update', patch: { transitionSummary: { '2026-27': { __delete__: true } } } });
  assert.ok((await doc()).transitionSummary['2026-27'], 'an educator\'s save never removes it');
  assert.equal((await fx.as(dee, '/api/write', { kind: 'children', id: 'art', op: 'update', patch: { transitionSummary: { '2026-27': { __delete__: true } } } })).status, 200);
  assert.equal(((await doc()).transitionSummary || {})['2026-27'], undefined);
  const tree = fs.readFileSync(path.join(ROOT, 'tree.html'), 'utf8');
  assert.match(tree, /data-tsremove/); assert.match(tree, /transition:"transition summary",screen:"screening"/);
});

test('one observation counts for two DRDP measures at most, and the printed DRDP keeps only the level seen', () => {
  const tree = fs.readFileSync(path.join(ROOT, 'tree.html'), 'utf8');
  assert.match(tree, /const DRDP_PER_OBS=2;/);
  const src = tree.match(/const drdpSrcKey=[\s\S]*?return \{items:out,held\}\}/)[0];
  const { drdpFull, drdpKeepTwo } = new Function('DRDP_PER_OBS', src + '\nreturn {drdpFull,drdpKeepTwo};')(2);
  const o = { kind: 'notices', id: 'n1' };
  const c = { first: 'Ash', drdp: { items: { a: { src: o, status: 'accepted' }, b: { src: o, status: 'changed' }, c: { src: o, status: 'suggested' }, d: { src: o, status: 'suggested' }, e: { src: { kind: 'notices', id: 'n2' }, status: 'suggested' } } } };
  assert.ok(drdpFull(c, c.drdp.items.c, 'c'), 'a third from the same observation waits');
  assert.ok(!drdpFull(c, c.drdp.items.e, 'e'));
  const c2 = { first: 'Ash', drdp: { items: { c: { src: o, status: 'suggested' }, d: { src: o, status: 'suggested' }, f: { src: o, status: 'suggested' }, e: { src: { kind: 'notices', id: 'n2' }, status: 'suggested' } } } };
  const r = drdpKeepTwo(c2, { c: 1, d: 1, f: 1, e: 1 }); assert.deepEqual(Object.keys(r.items), ['c', 'd', 'e']); assert.equal(r.held, 1);
  assert.doesNotMatch(tree, /label:"Compare every level"/);
  assert.match(tree, /Compare every level of/, 'it stays on screen');
});

test('forty more books arrive as drafts for the director to vet, each a new page with its reading guide', () => {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'once/s48-more-books.json'), 'utf8'));
  assert.equal(d.changes.length, 40);
  const paths = new Set();
  for (const c of d.changes) {
    assert.match(c.path, /^staff\/library\/books\/[a-z0-9-]+\.md$/); assert.ok(!paths.has(c.path)); paths.add(c.path);
    assert.match(c.create, /^<!--\nlibrary: book\nauthor: .+\nowned: no\nstatus: draft\n/); assert.match(c.create, /\n## Why we chose it\n\n.+\n\n## Kind of reading\n/); assert.match(c.create, /- I wonder .+\./);
    assert.doesNotMatch(c.create, /[—–]/, 'no dashes');
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), /ONCE\.push\(\['s48Books'/);
});
