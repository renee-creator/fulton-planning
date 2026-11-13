'use strict';
// Kaymbu Moments brought in straight from Kaymbu. The children tagged in Kaymbu, a photo already in TREE, the screener and
// one post as one observation, checked with made-up records and made-up photos. Nothing here reaches Kaymbu.
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');

const recs = () => ({ notices: new Map(), children: new Map(), settings: new Map(), drafts: new Map(), clips: new Map(), kaymbu: new Map() });
function setup(extra) {
  const store = { ready: true, recs: recs() };
  const kid = (id, first, last, classroom, group) => store.recs.children.set(id, { doc: { first, last, classroom, group } });
  kid('c1', 'Wren', 'Alder', 'North', 'Marigold'); kid('c2', 'Pip', 'Birch', 'North', 'Marigold'); kid('c3', 'Pip', 'Cedar', 'South', 'Iris');
  store.recs.settings.set('main', { doc: { classrooms: ['West', 'North', 'South'], groups: [{ name: 'Marigold', room: 'North', educator: 'Dee' }, { name: 'Iris', room: 'South', educator: 'Ann' }] } });
  const photos = new Map(); let kept = 0; const posts = [];
  const kaymbu = {
    laDay: t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)),
    mondayOf: d => d, postGroup: (t, r, d) => 'g-' + t.slice(0, 5) + r + d,
    getBuf: async url => ({ status: 200, type: 'image/jpeg', buf: photos.get(url.split('/').pop()) }),
    bestPhoto: async url => ({ buf: Buffer.from('x'), url, w: 2000, h: 1500 }), keepPhoto: async () => 'p' + (++kept), size: () => ({ w: 400, h: 300 }),
    kidsPlace: ids => { const ks = ids.map(i => store.recs.children.get(i).doc); if (!ks.length) return {}; const one = a => a.every(x => x === a[0]) ? a[0] : '';
      const g = one(ks.map(k => k.group)); return { room: one(ks.map(k => k.classroom)), group: g ? { name: g, room: one(ks.map(k => k.classroom)) } : null }; },
    groupLead: (g, r) => ({ 'Marigold|North': 'Dee', 'Iris|South': 'Ann' })[g + '|' + r] || '',
  };
  const pull = require('../kaymbu-pull.js')({ store, log: () => {}, kaymbu, noteChange: () => {}, scheduleSave: () => {}, askClaude: async () => ({ status: 200, text: JSON.stringify({ content: [{ text: '{"keep":false,"why":"A menu for families"}' }] }) }),
    video: { fromKaymbu: async () => 'v1' }, onPost: (ids, o) => posts.push([ids, o]) });
  return Object.assign({ store, pull, photos, posts }, extra || {});
}
// a busy photo with plenty of edges, a near copy of it, and a dark one
async function img(seed, dark) {
  const w = 120, h = 90, px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = Math.floor(i / w); const v = dark ? 8 : ((((x >> 3) + (y >> 3) + seed) & 1) ? 230 : 20) + ((x * 7 + y * 13 + seed * 31) % 17); px.fill(v, i * 3, i * 3 + 3); }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}
const T = '2026-10-21T17:00:00.000Z';
const mom = (id, o) => Object.assign({ _id: id, type: 'image', students: [], studentInfo: {}, classroomName: 'North', caption: '', annotation: '', dateCaptured: T, creationDate: T,
  pictureThumb: `/media/x/${id}-aaaa_bbbb_thumb.jpg`, isPrivate: false }, o);
const tag = (...names) => ({ students: names.map((n, i) => 's' + i), studentInfo: Object.fromEntries(names.map((n, i) => ['s' + i, { firstName: n.split(' ')[0], lastName: n.split(' ')[1] || '' }])) });

test('the photo name matches a Moment shared by email', () => {
  const { pull } = setup();
  assert.strictEqual(pull.keyOf({ pictureThumb: '/media/57b/2026/moments/8/f/7/f/8f7f-uu_322b_thumb.jpg' }), '8f7f-uu_322b.jpg');
  assert.strictEqual(pull.keyOf({ pictureThumb: '/moments/53/videos/28fd_a92e_thumb.jpg' }), '28fd_a92e.jpg');
  assert.strictEqual(pull.keyOf({ _id: 'abc' }), 'km-abc');
});

test('children are matched by first and last name, and a first name one child has', () => {
  const { pull } = setup();
  assert.deepStrictEqual(pull.matchChildren([{ first: 'Pip', last: 'Cedar' }, { first: 'Wren', last: '' }]), { ids: ['c3', 'c1'], unmatched: [] });
  assert.deepStrictEqual(pull.matchChildren([{ first: 'Pip', last: '' }, { first: 'Juno', last: 'Fir' }]), { ids: [], unmatched: ['Pip', 'Juno Fir'] }, 'two children named Pip and a child TREE does not have are left for an educator');
});

test('one post comes in as one observation, and the screener sets aside without deleting', async () => {
  const x = setup();
  x.photos.set('m1-aaaa_bbbb_thumb.jpg', await img(1)); x.photos.set('m2-aaaa_bbbb_thumb.jpg', await img(1)); x.photos.set('m3-aaaa_bbbb_thumb.jpg', await img(0, true));
  x.photos.set('m4-aaaa_bbbb_thumb.jpg', await img(2)); x.photos.set('m5-aaaa_bbbb_thumb.jpg', await img(3));
  const post = [mom('m1', Object.assign({ batchId: 'b1', caption: 'Corn grinding', annotation: 'Wren grinds the corn while Pip pours.' }, tag('Wren Alder', 'Pip Birch'))),
    mom('m2', Object.assign({ batchId: 'b1' }, tag('Wren Alder'))), mom('m3', Object.assign({ batchId: 'b1' }, tag('Pip Birch'))), mom('m4', Object.assign({ batchId: 'b1' }, tag('Pip Birch')))];
  const r = await x.pull.takePost(post, {});
  assert.strictEqual(r.kept, 2, 'the clearest of two near copies and one other photo');
  assert.deepStrictEqual(r.reasons, { dark: 1, similar: 1 });
  const ns = [...x.store.recs.notices.values()].map(v => v.doc);
  assert.ok(ns.every(n => n.noticed === 'Corn grinding\nWren grinds the corn while Pip pours.'), 'a photo with no words takes its post\'s words');
  assert.strictEqual(new Set(ns.map(n => n.group)).size, 1, 'one observation with several photos');
  assert.ok(ns.every(n => n.by === 'Dee' && n.smallGroup === 'Marigold' && n.classroom === 'North'));
  assert.ok(ns.every(n => n.kaymbu.pull === 1 && n.kaymbu.batch === 'b1' && n.kaymbu.check === false));
  const aside = [...x.store.recs.kaymbu.values()].map(v => v.doc);
  assert.strictEqual(aside.length, 2); assert.ok(aside.every(a => a.why)); assert.ok(aside.every(a => a.status === (a.reason === 'similar' ? 'accepted' : 'aside')), 'a near copy is left out by itself');
  assert.strictEqual(x.posts.length, 1, 'the caption is sorted once for the post');
  // the same post read again changes nothing
  const again = await x.pull.takePost(post, {});
  assert.deepStrictEqual([again.kept, again.aside], [0, 0]);
  // no words and no children, and a menu photo with words and no children
  const r2 = await x.pull.takePost([mom('m5', { caption: 'Lunch this week' })], {});
  const r3 = await x.pull.takePost([mom('m6', { pictureThumb: '' })], {});
  assert.deepStrictEqual([r2.reasons, r3.reasons], [{ notlearning: 1 }, { nowords: 1 }]);
  // taken before the school year
  const r4 = await x.pull.takePost([mom('m7', Object.assign({ dateCaptured: '2025-09-26T17:00:00.000Z', caption: 'Volcano' }, tag('Wren Alder')))], {});
  assert.deepStrictEqual(r4.reasons, { before: 1 });
});

test('a photo already in TREE keeps what educators did, and is offered the children tagged in Kaymbu', async () => {
  const x = setup();
  x.store.recs.notices.set('n1', { doc: { id: 'n1', noticed: 'Sand', children: [], kaymbu: { v: 3, key: 'e1-aaaa_bbbb.jpg', check: true } } });
  x.store.recs.notices.set('n2', { doc: { id: 'n2', noticed: 'Water', children: ['c1'], editedBy: 'Dee', kaymbu: { v: 3, key: 'e2-aaaa_bbbb.jpg' } } });
  const r = await x.pull.takePost([mom('e1', tag('Wren Alder')), mom('e2', tag('Wren Alder', 'Pip Cedar'))], {});
  assert.deepStrictEqual([r.kept, r.merged], [0, 2]);
  const n1 = x.store.recs.notices.get('n1').doc, n2 = x.store.recs.notices.get('n2').doc;
  assert.deepStrictEqual([n1.children, n1.kaymbu.check], [['c1'], false], 'nobody had tagged it, so Kaymbu\'s children are taken');
  assert.deepStrictEqual([n2.children, n2.kaymbu.suggest, n2.kaymbu.check], [['c1'], ['c3'], true], 'an educator tagged it, so the other child is offered');
});

test('the look back credits a Moment with no small group to its class team, and comes in quietly', async () => {
  const x = setup(); x.photos.set('w1-aaaa_bbbb_thumb.jpg', await img(2));
  const r = await x.pull.takePost([mom('w1', Object.assign({ classroomName: 'South', caption: 'Ramps', annotation: 'Two friends tilt the ramp.' }, tag('Wren Alder', 'Pip Cedar')))], { back: true });
  assert.strictEqual(r.kept, 1);
  const n = [...x.store.recs.notices.values()][0].doc;
  assert.deepStrictEqual([n.by, n.kaymbu.back, n.kaymbu.keptAt === n.at], ['South class team', 1, true]);
  assert.strictEqual(x.posts[0][1].back, true);
});

test('quiet hours are evenings, nights and weekends in Los Angeles', () => {
  const { pull } = setup();
  assert.strictEqual(pull.quietHours(Date.parse('2026-11-11T20:00:00Z')), false, 'noon on a Wednesday');
  assert.strictEqual(pull.quietHours(Date.parse('2026-11-12T04:00:00Z')), true, '8 pm on a Wednesday');
  assert.strictEqual(pull.quietHours(Date.parse('2026-11-14T20:00:00Z')), true, 'Saturday');
});

test('Settings shows Kaymbu Moments to the director, with what was set aside and Put it back', async t => {
  const { start, browser, signedIn } = require('./fixture.js');
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const more = put => { put('kaymbu/state.json', { id: 'state', lastRun: Date.now(), lastCounts: { read: 4, kept: 2, merged: 1, aside: 1, videos: 0 }, lookback: { since: '2026-08-15', status: 'ready', estimate: { at: Date.now(), moments: 3190, posts: 741, newPosts: 600, kept: 2400, merged: 300, aside: 120, reasons: { nowords: 100, before: 20 }, videos: 63, asked: 10, dollars: 9, nights: 1 } } });
    put('kaymbu/akm1.json', { id: 'akm1', kid: 'km1', key: 'km1.jpg', reason: 'nowords', why: 'No words and no children tagged', thumb: '', room: 'North', kaymbuClass: 'North', words: '', students: [], day: '2026-10-21', published: Date.now(), status: 'aside' }); };
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => { setOpen = 'Kaymbu Moments'; goView('settings'); });
  await s.p.waitForFunction(() => /Set aside, 1/.test((document.querySelector('#kpcard') || {}).innerText || ''), null, { timeout: 15000 });
  const text = await s.p.evaluate(() => document.querySelector('#kpcard').innerText);
  assert.match(text, /KAYMBU_EMAIL and KAYMBU_PASSWORD/, 'not turned on without the login on Render');
  assert.doesNotMatch(text, /Start the look back/, 'the look back waits for the login');
  assert.match(await s.p.evaluate(() => document.querySelector('#kpcard summary').innerText), /Not turned on/);
  assert.doesNotMatch(text, /[—–]/, 'no dashes');
  const dee = (await fx.login('Dee', 'director-pass-1')).token, shared = (await fx.login('Shared', 'shared-pass-1')).token;
  const view = (await fx.as(dee, '/api/kaymbu/pull')).body;
  assert.strictEqual(view.aside.length, 1);
  assert.strictEqual((await fx.as(shared, '/api/kaymbu/pull')).status, 403, 'only the director');
  assert.strictEqual((await fx.as(dee, '/api/write', { op: 'put', kind: 'kaymbu', id: 'state', data: {} })).status, 403, 'TREE keeps these records itself');
  assert.deepStrictEqual(s.errors, []);
});

test('the weekly reading report offers Read this week again to the director', async t => {
  const { start, browser, signedIn } = require('./fixture.js');
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({}); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('wreport'));
  await s.p.waitForFunction(() => /Read this week again/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
  assert.match(await s.p.evaluate(() => document.querySelector('[data-readagain]').textContent), /Read this week again/);
  assert.deepStrictEqual(s.errors, []);
});

test('earlier years are counted by Kaymbu\'s own id for each child enrolled now, and nothing comes in', () => {
  const x = setup();
  x.store.recs.children.set('c4', { doc: { first: 'Moss', last: 'Fen', classroom: 'South', status: 'withdrawn' } });
  x.store.recs.children.get('c3').doc.dob = '2022-04-06';
  const kids = x.pull.enrolledKids(); const hold = x.pull.holding();
  const before = x.pull.laMidnight('2026-08-15');
  const acc = { seen: new Set(), read: 0, names: {}, link: {}, early: [] };
  const old = '2024-10-02T17:00:00.000Z', older = '2023-09-05T17:00:00.000Z', long = '2014-07-18T17:00:00.000Z';
  const who = (pairs) => ({ students: pairs.map(p => p[0]), studentInfo: Object.fromEntries(pairs.map(p => [p[0], { firstName: p[1], lastName: p[2] }])) });
  x.pull.tallyBook(acc, [
    mom('b4', who([['kW', 'Wren', 'Alder']])),                                                       // this year ties kW to Wren
    mom('b5', who([['kP', 'Pip', 'Cedar']])),
    mom('b1', Object.assign({ dateCaptured: old, creationDate: old }, who([['kW', 'Wren', 'Alder'], ['kP', 'Pip', 'Cedar']]))),
    mom('b2', Object.assign({ dateCaptured: older, creationDate: older, video: true }, who([['kP', 'Pip', 'Cedar']]))),
    mom('b3', Object.assign({ dateCaptured: old, creationDate: old }, who([['kM', 'Moss', 'Fen']]))),
    mom('b6', Object.assign({ dateCaptured: long, creationDate: long }, who([['kOld', 'Pip', 'Cedar']]))),   // another Pip Cedar, before this one was born
    mom('b7', Object.assign({ dateCaptured: long, creationDate: long }, who([['kW2', 'Wren', '']]))),        // a first name only, from years ago
    mom('b1', Object.assign({ dateCaptured: old, creationDate: old }, who([['kW', 'Wren', 'Alder']]))),
  ], before, kids, hold);
  const s = x.pull.bookSummary(acc, kids, before);
  assert.deepStrictEqual([s.moments, s.photos, s.videos], [2, 1, 1], 'a withdrawn child, an older child of the same name, a first name only and a repeat are left out');
  assert.strictEqual(s.oldest, '2023-09-05');
  assert.deepStrictEqual(s.rooms.South, { children: 1, withMoments: 1, moments: 2, videos: 1, first: '2023-09-05' });
  assert.deepStrictEqual(s.rooms.North, { children: 2, withMoments: 1, moments: 1, videos: 0, first: '2024-10-02' });
  assert.strictEqual(s.kids.find(k => k.id === 'c2').n, 0);
  assert.strictEqual(x.store.recs.notices.size + x.store.recs.kaymbu.size, 0);
});

test('the earlier years count keeps its place, and what it saved reads back to the same counts', () => {
  const x = setup();
  const kids = x.pull.enrolledKids(); const hold = x.pull.holding(); const before = x.pull.laMidnight('2026-08-15');
  const old = '2024-10-02T17:00:00.000Z', older = '2023-09-05T17:00:00.000Z';
  const who = (pairs) => ({ students: pairs.map(p => p[0]), studentInfo: Object.fromEntries(pairs.map(p => [p[0], { firstName: p[1], lastName: p[2] }])) });
  const pageA = [mom('a1', who([['kW', 'Wren', 'Alder']])), mom('a2', Object.assign({ dateCaptured: old, creationDate: old }, who([['kW', 'Wren', 'Alder'], ['kP', 'Pip', 'Cedar']])))];
  const pageB = [mom('a2', Object.assign({ dateCaptured: old, creationDate: old }, who([['kW', 'Wren', 'Alder']]))), mom('a3', Object.assign({ dateCaptured: older, creationDate: older, video: true }, who([['kP', 'Pip', 'Cedar']])))];
  // all at once
  const one = { seen: new Set(), read: 0, names: {}, link: {}, early: [] };
  x.pull.tallyBook(one, pageA, before, kids, hold); x.pull.tallyBook(one, pageB, before, kids, hold);
  // saved after the first page, read back after a restart, then the second page
  const part = { seen: new Set(), read: 0, names: {}, link: {}, early: [] };
  x.pull.tallyBook(part, pageA, before, kids, hold);
  const saved = JSON.parse(JSON.stringify(x.pull.packAcc(part, before, 'cursor', pageA.map(m => m._id))));
  const back = x.pull.unpackAcc(saved);
  x.pull.tallyBook(back, pageB, before, kids, hold);
  const a = x.pull.bookSummary(one, kids, before), b = x.pull.bookSummary(back, kids, before);
  delete a.at; delete b.at;
  assert.deepStrictEqual(b, a);
  assert.strictEqual(saved.after, 'cursor');
});

test('a near copy of a kept photo is left out by itself and never waits on the Set aside list', () => {
  const x = setup();
  const put = (id, reason) => x.store.recs.kaymbu.set(id, { doc: { id, kid: id.slice(1), reason, status: 'aside' } });
  put('a1', 'similar'); put('a2', 'dark');
  assert.strictEqual(x.pull.leaveNearCopies(), 1);
  const v = x.pull.view();
  assert.deepStrictEqual(v.aside.map(a => a.id), ['a2']);
  assert.strictEqual(v.accepted, 0, 'one TREE left out is not counted as one the director left out');
  assert.strictEqual(x.store.recs.kaymbu.get('a1').doc.status, 'accepted');
});
