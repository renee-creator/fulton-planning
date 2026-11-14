'use strict';
// Two accepted pieces satisfy a level of a DRDP measure for a child, across all their years and both views. A satisfied
// level takes no more, the current level stays open for two fresh pieces each conference period, the child's page shows
// each measure's levels in order, the director has a page of open levels, and the earlier years are read for the
// director alone (November 13, 2026). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const DAY = 864e5, OLD = Date.now() - 400 * DAY, NOW = Date.now() - DAY;
const it = (code, level, status, at, src, more) => Object.assign({ code, level, view: 'ptk', status, at, evidence: 'Stacked the blocks and tried again when they fell.', src: { kind: 'notices', id: src, title: 'Block tower ' + src, at } }, status === 'accepted' ? { reviewedBy: 'Ann', reviewedAt: at } : {}, more || {});
const more = put => {
  // Pip, every piece from an earlier year. One accepted at Building Earlier and three waiting there.
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', dob: '2022-03-01', drdp: { items: {
    a0: it('ATL 1', 'Building Earlier', 'accepted', OLD, 'n0'), w1: it('ATL 1', 'Building Earlier', 'suggested', OLD + 3, 'n1'), w2: it('ATL 1', 'Building Earlier', 'suggested', OLD + 2, 'n2'), w3: it('ATL 1', 'Building Earlier', 'suggested', OLD + 1, 'n3'),
    // a level accepted while Pip was under three, in the other view
    e1: Object.assign(it('ATL 1', 'Exploring Later', 'accepted', OLD - 300 * DAY, 'n9'), { view: 'it' }),
    // read from the earlier years, for the director alone
    y1: Object.assign(it('SED 4', 'Exploring Later', 'suggested', OLD - 200 * DAY, 'km1', { early: true, view: 'it' }), { src: { kind: 'book', id: 'km1', title: 'Passing the watering can', at: OLD - 200 * DAY, photo: 'p-early.jpg', words: 'Pip passed the watering can to a friend.' } }) } } });
  // Ivy, two levels with two old pieces each. Building Middle is where she is now, Building Earlier is behind her.
  put('children/ivy.json', { first: 'Ivy', last: 'Test', classroom: 'West', status: 'active', dob: '2022-05-01', drdp: { items: {
    b1: it('ATL 2', 'Building Earlier', 'accepted', OLD, 'm1'), b2: it('ATL 2', 'Building Earlier', 'accepted', OLD, 'm2'),
    c1: it('ATL 2', 'Building Middle', 'accepted', OLD, 'm3'), c2: it('ATL 2', 'Building Middle', 'accepted', OLD, 'm4'),
    f1: it('ATL 2', 'Building Middle', 'suggested', NOW, 'm5'), f2: it('ATL 2', 'Building Middle', 'suggested', NOW - 1, 'm6'), f3: it('ATL 2', 'Building Middle', 'suggested', NOW - 2, 'm7'),
    g1: it('ATL 2', 'Building Earlier', 'suggested', NOW, 'm8') } } });
};
const items = (fx, id) => JSON.parse(fs.readFileSync(path.join(fx.dir, `children/${id}.json`), 'utf8')).drdp.items;

test('a level takes two pieces, and the current level two fresh ones each conference period', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('[data-tview="drdpreview"]', { timeout: 15000 });
  // the earlier years' suggestion is not Ann's to review, 3 of Pip's and 4 of Ivy's
  assert.match(await s.p.innerText('#main'), /7 DRDP suggestions to review/);
  const state = await s.p.evaluate(() => { const c = children.get('ivy'), st = drdpLevelState(c), now = Date.now(), old = now - 400 * 864e5;
    return [drdpLevelOpen(st, 'ATL 2', 'Building Earlier', now), drdpLevelOpen(st, 'ATL 2', 'Building Middle', now), drdpLevelOpen(st, 'ATL 2', 'Building Middle', old), drdpLevelOpen(st, 'ATL 2', 'Building Later', now), drdpLadder('ATL 1').length, drdpLadder('COG 1').length]; });
  assert.deepStrictEqual(state, [false, true, false, true, 10, 5], 'a level behind her is closed, where she is now is open to fresh evidence only, the next level is open');
  await s.p.click('button:has-text("Review")[data-tview="drdpreview"]'); await s.p.waitForSelector('[data-drpall="pip"]');
  // Accept all for Pip. The first fills the level, and the other two are set aside.
  await s.p.click('[data-drpall="pip"]'); await s.p.waitForFunction(() => !document.querySelector('[data-drkid="pip"]'), null, { timeout: 15000 });
  // Accept all for Ivy. Two fresh pieces where she is now, the third set aside, and the one for a level behind her too.
  await s.p.click('[data-drpall="ivy"]'); await s.p.waitForFunction(() => !document.querySelector('[data-drkid="ivy"]'), null, { timeout: 15000 });
  assert.deepStrictEqual(s.errors, []);
  await new Promise(r => setTimeout(r, 2500));
  const pip = items(fx, 'pip'), ivy = items(fx, 'ivy');
  assert.deepStrictEqual([pip.w1.status, pip.w2.status, pip.w3.status], ['accepted', 'aside', 'aside']);
  assert.deepStrictEqual([pip.w2.asideWhy, pip.w2.reviewedBy, ivy.f3.asideWhy, ivy.g1.asideWhy], ['level', 'TREE', 'level', 'behind']);
  assert.strictEqual(pip.y1.status, 'suggested', 'the earlier years wait for the director');
  assert.deepStrictEqual([ivy.f1.status, ivy.f2.status, ivy.f3.status, ivy.g1.status], ['accepted', 'accepted', 'aside', 'aside']);
  // one set aside can be brought back and accepted, as the educator chooses
  await s.p.evaluate(() => { kidOpen = 'pip'; kidTab = 'drdp'; goView('child'); }); await s.p.waitForSelector('[data-drrow="ATL 1"]', { state: 'attached', timeout: 15000 });
  await s.p.click('summary:has-text("Set aside")'); assert.match(await s.p.innerText('#main'), /since its level already has two pieces/);
  await s.p.click('[data-drback="w2"]'); await s.p.waitForSelector('[data-draccept="w2"]'); await s.p.click('[data-draccept="w2"]');
  await s.p.waitForFunction(() => children.get('pip').drdp.items.w2.status === 'accepted');
  assert.deepStrictEqual(s.errors, []);
});

test('a child\'s page shows each measure\'s levels in order, across both views', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => s.close());
  await s.p.evaluate(() => { kidOpen = 'pip'; kidTab = 'drdp'; goView('child'); }); await s.p.waitForSelector('[data-drrow="dom:ATL"] summary', { timeout: 15000 }); await s.p.click('[data-drrow="dom:ATL"] > summary'); await s.p.waitForSelector('[data-drrow="ATL 1"] [data-drstep]');
  const steps = await s.p.evaluate(() => [...document.querySelectorAll('[data-drrow="ATL 1"] [data-drstep]')].map(x => [x.dataset.drstep, x.className.replace('drstep ', ''), x.querySelector('.drsteph .cnt').textContent]));
  assert.strictEqual(steps.length, 10, 'every level of the measure');
  assert.deepStrictEqual(steps[0], ['Responding Earlier', 'open', 'Open']);
  assert.deepStrictEqual(steps[3].slice(0, 2), ['Exploring Later', 'part now'], 'the level from the Infant and Toddler View sits in the same line, and two pieces at it or later make it where Pip is');
  assert.match(steps[3][2], /1 of 2 pieces, where Pip is now/);
  assert.deepStrictEqual(steps[4].slice(0, 2), ['Building Earlier', 'part']); assert.match(steps[4][2], /1 of 2 pieces, 3 waiting/);
  assert.match(await s.p.innerText('[data-drrow="ATL 1"] summary'), /Solid at Exploring Later, beginning to show Building Earlier · 2 pieces of evidence/);
  // an educator never sees the earlier years waiting
  assert.doesNotMatch(await s.p.innerText('#main'), /Passing the watering can/);
  assert.deepStrictEqual(s.errors, []);
  // the director does, with its photo and words kept with the suggestion
  const d = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => d.close());
  await d.p.evaluate(() => { kidOpen = 'pip'; kidTab = 'drdp'; goView('child'); }); await d.p.waitForSelector('#dr-y1', { timeout: 15000 });
  const row = await d.p.innerText('#dr-y1'); assert.match(row, /Pip passed the watering can to a friend/); assert.match(row, /From Passing the watering can/);
  assert.ok(await d.p.$('#dr-y1 img[data-drzoomu]'), 'the earlier photo shows');
  assert.deepStrictEqual(d.errors.filter(e => !/p-early\.jpg|404|Failed to load/.test(e)), []);
});

test('the director has a page of open levels for each child and class', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const d = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => d.close());
  await d.p.evaluate(() => goView('children')); await d.p.waitForSelector('[data-tview="drdpopen"]', { timeout: 15000 });
  await d.p.click('[data-tview="drdpopen"]'); await d.p.waitForSelector('[data-drokid="ivy"]');
  const txt = await d.p.innerText('#main'); assert.match(txt, /DRDP open levels/); assert.match(txt, /West class/);
  // Ivy has two levels filled, and her span starts at the first of them, so nothing earlier counts as open, and the one level past where she is now does
  assert.match(await d.p.innerText('[data-drokid="ivy"] summary'), /1 open in Ivy's span · \d+ of \d+ measures with no evidence · 2 levels filled/);
  await d.p.click('[data-drokid="ivy"] summary'); await d.p.waitForSelector('[data-drokid="ivy"] .dol');
  const marks = await d.p.evaluate(() => { const r = [...document.querySelectorAll('[data-drokid="ivy"] .dol')].find(x => /ATL 2/.test(x.textContent)); return [...r.querySelectorAll('.dc')].map(x => x.textContent + (x.classList.contains('full') ? '*' : '') + (x.classList.contains('now') ? '!' : '')); });
  assert.deepStrictEqual(marks, ['RE', 'RL', 'EE', 'EL', 'BE*', 'BM*!', 'BL', 'IE', 'IM', 'IL']);
  assert.match(await d.p.innerText('[data-drokid="ivy"] .dol:has-text("ATL 2")'), /Solid at Building Middle/);
  await d.p.click('[data-droopen="ivy"]'); await d.p.waitForSelector('[data-drrow="ATL 2"]', { state: 'attached' });
  assert.deepStrictEqual(d.errors, []);
  // an educator who reaches the page goes to Children
  const s = await signedIn(fx, br, 'Ann', '1357', 390); t.after(() => s.close());
  await s.p.evaluate(() => goView('drdpopen')); assert.strictEqual(await s.p.evaluate(() => view), 'children');
});

test('a reading leaves out a level that has its evidence and offers the next measure', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const d = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => d.close());
  await d.p.evaluate(() => goView('children')); await d.p.waitForFunction(() => children.get('ivy'), null, { timeout: 15000 });
  const r = await d.p.evaluate(async () => { let asked = '';
    askRead = async prompt => { asked = prompt; return { measures: [
      { code: 'ATL 2', child: 'ivy', level: 'Building Earlier', evidence: 'A level behind her that is full.' },
      { code: 'ATL 2', child: 'ivy', level: 'Building Later', evidence: 'Never reached, since a measure is given once.' },
      { code: 'ATL 1', child: 'ivy', level: 'Building Middle', evidence: 'Stayed with the ramp for a long time.' },
      { code: 'SED 4', child: 'ivy', level: 'Building Earlier', evidence: 'Built beside a friend.' }], photo: '', summary: 'Ramps.' }; };
    const c = children.get('ivy'); const S = { text: 'Ivy built a ramp.', photos: [], kids: [c], title: 'Ramps' };
    const old = Date.now() - 400 * 864e5;
    const now = await drdpRead('ptk', [c], S, 'nx', { kind: 'notices', at: Date.now() });
    // the earlier years count what is waiting too. Ivy has three waiting at Building Middle of ATL 2.
    askRead = async prompt => ({ measures: [{ code: 'ATL 2', child: 'ivy', level: 'Building Middle', evidence: 'Full, with the waiting ones.' }, { code: 'ATL 3', child: 'ivy', level: 'Exploring Later', evidence: 'Tried another way.' }] });
    const early = await drdpRead('ptk', [c], S, 'km9', { kind: 'book', at: old, early: true });
    return { asked, now: now.items.map(x => x.code + ' ' + x.level), early: early.items.map(x => x.code + ' ' + x.level), view: [kidViewAt(c, Date.parse('2024-10-01')), kidViewAt(c, Date.parse('2025-06-01'))] }; });
  assert.deepStrictEqual(r.now, ['ATL 1 Building Middle', 'SED 4 Building Earlier']);
  assert.match(r.asked, /Levels to leave out\. For Ivy, ATL 2 at every level before Building Middle\. These levels already have their evidence, or the child had moved past them/);
  assert.match(r.asked, /leave that measure out for that child and give the next clearest measure/);
  assert.doesNotMatch(r.asked, /and at Building Middle/, 'where she is now is still open to fresh evidence');
  assert.deepStrictEqual(r.early, ['ATL 3 Exploring Later']);
  assert.deepStrictEqual(r.view, ['it', 'ptk'], 'an earlier photo is read against the view the child was in that day');
  assert.deepStrictEqual(d.errors, []);
});

// the server's side of the earlier years, which photos are chosen and in what order
const recs = () => ({ notices: new Map(), children: new Map(), settings: new Map(), drafts: new Map(), clips: new Map(), kaymbu: new Map() });
test('the earlier years choose a few photos for each child for each month, oldest first', () => {
  const store = { ready: true, recs: recs() };
  store.recs.children.set('c1', { doc: { first: 'Wren', last: 'Alder', classroom: 'North' } }); store.recs.children.set('c2', { doc: { first: 'Pip', last: 'Birch', classroom: 'North' } });
  store.recs.children.set('c3', { doc: { first: 'Gone', last: 'Away', classroom: 'North', status: 'left' } });
  const pull = require('../kaymbu-pull.js')({ store, log: () => {}, kaymbu: {}, noteChange: () => {}, scheduleSave: () => {}, askClaude: async () => ({}), video: {}, onPost: () => {} });
  const T = d => Date.parse(d + 'T18:00:00Z');
  const item = (m, day, words, kids, o) => Object.assign({ m, at: T(day), day, words, kids, room: 'North', photo: 'ph-' + m }, o || {});
  const c1 = [item('a1', '2025-03-03', '', ['c1']), item('a2', '2025-03-05', 'Wren carried the watering can across the garden.', ['c1', 'c2']), item('a3', '2025-03-07', 'Short', ['c1']),
    item('a4', '2025-03-09', 'Wren and a friend built a long road of blocks together.', ['c1'], { batch: 'b1' }), item('a5', '2025-03-09', 'Wren and a friend built a long road of blocks together.', ['c1'], { batch: 'b1' }),
    item('a6', '2025-03-20', 'Wren counted the eggs in the basket, one at a time.', ['c1', 'c3']), item('a7', '2024-11-02', 'Wren poured water into the mud kitchen pot.', ['c1']),
    Object.assign(item('a8', '2024-11-03', 'Already an observation in TREE.', ['c1']), { photo: undefined, notice: 'n77' })];
  store.recs.kaymbu.set('book-c1', { doc: { id: 'book-c1', child: 'c1', items: c1 } });
  store.recs.kaymbu.set('book-c2', { doc: { id: 'book-c2', child: 'c2', items: [c1[1]] } });
  const plan = pull.earlyPlan();
  assert.deepStrictEqual(plan.map(p => p.m), ['a7', 'a2', 'a4', 'a6'], 'oldest first, three for March, the ones with words, one photo of a post, and never one already in TREE');
  assert.deepStrictEqual(plan.find(p => p.m === 'a2').kids, ['c1', 'c2'], 'read once for both children'); assert.deepStrictEqual(plan.find(p => p.m === 'a6').kids, ['c1'], 'only children enrolled now');
  let v = pull.earlyView(); assert.deepStrictEqual([v.status, v.photos, v.left, v.children, v.oldest, v.newest], ['none', 4, 4, 2, '2024-11-02', '2025-03-20']);
  assert.deepStrictEqual(pull.earlyNext(), { status: 'none' }, 'nothing is read until the director starts it');
  pull.earlyStart('Dee'); assert.strictEqual(pull.earlyNext().pick.m, 'a7');
  pull.earlyMark('a7', true, 2); assert.strictEqual(pull.earlyNext().pick.m, 'a2');
  // one that cannot be read is tried three times, then passed
  pull.earlyMark('a2', false); pull.earlyMark('a2', false); assert.strictEqual(pull.earlyNext().pick.m, 'a2'); pull.earlyMark('a2', false); assert.strictEqual(pull.earlyNext().pick.m, 'a4');
  pull.earlyPause(true); assert.deepStrictEqual(pull.earlyNext(), { status: 'paused' }); pull.earlyPause(false);
  pull.earlyMark('a4', true, 1); pull.earlyMark('a6', true, 0);
  assert.deepStrictEqual(pull.earlyNext(), { status: 'done' }); v = pull.earlyView(); assert.deepStrictEqual([v.status, v.left, v.done, v.found], ['done', 0, 4, 3]);
});

// A level behind the child takes no new evidence, an earlier photo still fills its own level, and one that cannot be
// accepted yet is never ticked (November 14, 2026).
const more2 = put => {
  const ago = d => Date.now() - d * DAY;
  put('children/max.json', { first: 'Max', last: 'Test', classroom: 'West', status: 'active', dob: '2022-03-01', drdp: { items: {
    // solid at Building Later, with two pieces a month ago
    h1: it('SCI 1', 'Building Later', 'accepted', ago(30), 's1'), h2: it('SCI 1', 'Building Later', 'accepted', ago(40), 's0'),
    // one piece alone at a later level holds nothing back
    j1: it('ATL 3', 'Building Later', 'accepted', ago(30), 's5'), j2: it('ATL 3', 'Building Earlier', 'suggested', ago(5), 's6'),
    // from six months ago, before he reached it, an earlier level. It stays.
    lo1: it('SCI 1', 'Building Earlier', 'suggested', ago(180), 's2'),
    // from last week and still lower. It is left out.
    lo2: it('SCI 1', 'Building Earlier', 'suggested', ago(5), 's3'),
    // an observation that already counts for two measures, with a third waiting
    t1: it('ATL 1', 'Exploring Later', 'accepted', ago(3), 'q1'), t2: it('ATL 3', 'Exploring Later', 'accepted', ago(3), 'q1'), t3: it('SED 1', 'Exploring Later', 'suggested', ago(3), 'q1') } } });
};
test('a level behind the child takes no new evidence, and an earlier photo still fills its own level', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: more2 }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('today')); await s.p.waitForFunction(() => children.get('max'), null, { timeout: 15000 });
  const r = await s.p.evaluate(async () => { const c = children.get('max'), now = Date.now(), D = 864e5, st = drdpLevelState(c);
    const why = [drdpLevelWhy(st, 'SCI 1', 'Building Earlier', now - 5 * D), drdpLevelWhy(st, 'SCI 1', 'Building Earlier', now - 180 * D), drdpLevelWhy(st, 'SCI 1', 'Building Later', now), drdpLevelWhy(st, 'SCI 1', 'Integrating Earlier', now)];
    let asked = ''; askRead = async prompt => { asked = prompt; return { measures: [{ code: 'SCI 1', child: 'max', level: 'Building Middle', evidence: 'Lower than where he is.' }, { code: 'SCI 2', child: 'max', level: 'Building Earlier', evidence: 'Looked closely at the leaf.' }] }; };
    const S = { text: 'Max looked at a leaf.', photos: [], kids: [c], title: 'Leaf' };
    const read = await drdpRead('ptk', [c], S, 'nz', { kind: 'notices', at: now });
    const swept = drdpLevelSweep(c);
    why.push(drdpLevelWhy(st, 'ATL 3', 'Building Earlier', now - 5 * D));
    return { why, asked, read: read.items.map(x => x.code + ' ' + x.level), swept, lo: [c.drdp.items.lo1.status, c.drdp.items.lo2.status, c.drdp.items.lo2.asideWhy] }; });
  assert.strictEqual(r.why[2] === 'level' || r.why[2] === '', true, 'where he is now takes two fresh pieces a period');
  assert.deepStrictEqual([r.why[0], r.why[1], r.why[3], r.why[4]], ['behind', '', '', ''], 'newer and lower is behind, older and lower fills its own level, a later level is open, and one piece alone holds nothing back');
  assert.deepStrictEqual(r.read, ['SCI 2 Building Earlier'], 'the next clearest measure takes its place');
  assert.match(r.asked, /For Max, [^.]*SCI 1 at every level before Building Later/);
  assert.deepStrictEqual([r.swept, r.lo], [1, ['suggested', 'aside', 'behind']]);
  // on review, the earlier one reads plainly, with no warning
  await s.p.evaluate(() => { drpKid = ''; goView('drdpreview'); }); await s.p.waitForSelector('#dr-lo1', { timeout: 15000 });
  const row = await s.p.innerText('#dr-lo1'); assert.match(row, /An earlier level, from before Max reached Building Later\./); assert.doesNotMatch(row, /Lower than what is already accepted/);
  // the one whose observation already counts for two measures is not ticked and not counted
  assert.ok(await s.p.$('[data-drpheld="max|t3"]')); assert.strictEqual(await s.p.$('[data-drpoff="max|t3"]'), null);
  assert.match(await s.p.innerText('#dr-j2'), /Lower than Building Later, which has one piece so far\./);
  assert.match(await s.p.innerText('[data-drpacc]'), /Accept the 2 ticked/);
  await s.p.click('[data-drpacc] >> nth=0'); await s.p.waitForFunction(() => children.get('max').drdp.items.lo1.status === 'accepted');
  assert.strictEqual(await s.p.evaluate(() => children.get('max').drdp.items.t3.status), 'suggested');
  // the child's page says why the other one was set aside
  await s.p.evaluate(() => { kidOpen = 'max'; kidTab = 'drdp'; goView('child'); }); await s.p.waitForSelector('summary:has-text("Set aside")', { timeout: 15000 });
  await s.p.click('summary:has-text("Set aside")'); assert.match(await s.p.innerText('#main'), /since Max was already past that level/);
  assert.deepStrictEqual(s.errors, []);
});

// One line for each measure, the one time tidy, review by exception and each child's own span (November 14, 2026).
const more3 = put => {
  const ago = d => Date.now() - d * DAY;
  put('notices/big.json', { title: 'Everyone in the garden', kind: 'note', at: ago(4), children: ['kit', 'a1', 'a2', 'a3', 'a4', 'a5'], text: 'The whole class dug together.', author: 'Ann' });
  put('notices/solo.json', { title: 'Kit and the ramp', kind: 'note', at: ago(4), children: ['kit'], text: 'Kit rolled the ball.', author: 'Ann' });
  put('notices/solo2.json', { title: 'Kit and the leaf', kind: 'note', at: ago(4), children: ['kit'], text: 'Kit looked at a leaf.', author: 'Ann' });
  put('notices/other.json', { title: 'Somebody else', kind: 'note', at: ago(4), children: ['a1'], text: 'Not Kit.', author: 'Ann' });
  put('children/kit.json', { first: 'Kit', last: 'Test', classroom: 'West', status: 'active', dob: '2022-03-01', drdp: { items: {
    // solid at Building Earlier, beginning to show Building Later
    k1: it('SCI 1', 'Building Earlier', 'accepted', ago(200), 'o1'), k2: it('SCI 1', 'Building Earlier', 'accepted', ago(190), 'o2'), k3: it('SCI 1', 'Building Later', 'accepted', ago(60), 'o3'),
    // dated after Building Later and reading lower, for the tidy
    k4: it('SCI 1', 'Exploring Later', 'accepted', ago(10), 'o4'),
    // one observation counted twice for one measure, and a piece from an observation that does not tag Kit
    d1: it('ATL 1', 'Building Earlier', 'accepted', ago(20), 'solo'), d2: it('ATL 1', 'Exploring Later', 'accepted', ago(20), 'solo'), u1: it('PD 2', 'Building Earlier', 'accepted', ago(20), 'other'),
    // waiting. One that fits cleanly, one three levels above what is accepted, one from an observation of six children.
    w1: it('SCI 2', 'Building Earlier', 'suggested', ago(4), 'solo2'), w2: it('SCI 1', 'Integrating Later', 'suggested', ago(3), 'o9'), w3: it('SED 4', 'Building Earlier', 'suggested', ago(4), 'big') } } });
};
test('one line for each measure, the one time tidy, review by exception and a child\'s own span', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: more3 }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const d = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => d.close());
  await d.p.evaluate(() => goView('children')); await d.p.waitForFunction(() => children.get('kit') && notices.get('big'), null, { timeout: 15000 });
  const r = await d.p.evaluate(() => { const c = children.get('kit'), st = drdpLevelState(c);
    return { stand: drdpStandText(drdpStand(st, 'SCI 1')), one: drdpStandText(drdpStand(st, 'PD 2')), none: drdpStandText(drdpStand(st, 'MATH 1')),
      plan: drdpTidyPlan(c).map(o => o.x.id + ' ' + o.why).sort(), eye: ['w1', 'w2', 'w3'].map(id => drdpEye(c, c.drdp.items[id], st)) }; });
  assert.deepStrictEqual([r.stand, r.one, r.none], ['Solid at Building Earlier, beginning to show Building Later', 'Beginning to show Building Earlier', '']);
  assert.deepStrictEqual(r.plan, ['d2 twice', 'k4 behind', 'u1 untagged'], 'the lower copy of a double goes, and the higher one stays');
  assert.deepStrictEqual(r.eye, ['', '3 levels above what is accepted for Kit in this measure.', 'From an observation of 6 children. Check that it shows Kit.']);
  // review. The clean one is ticked and counted, the other two say why and start unticked.
  await d.p.evaluate(() => { drpKid = ''; goView('drdpreview'); }); await d.p.waitForSelector('#dr-w2', { timeout: 15000 });
  assert.match(await d.p.innerText('#main'), /2 need your eye\./); assert.match(await d.p.innerText('[data-drpacc]'), /Accept the 1 ticked/);
  assert.match(await d.p.innerText('[data-drpeyewhy="kit|w3"]'), /Needs your eye\. From an observation of 6 children/);
  await d.p.click('[data-drpeye]'); await d.p.waitForFunction(() => !document.querySelector('#dr-w1')); assert.ok(await d.p.$('#dr-w3'));
  await d.p.click('[data-drpeye]'); await d.p.waitForSelector('#dr-w1');
  // ticking one that needs an eye counts it
  await d.p.check('[data-drpoff="kit|w3"]'); await d.p.waitForFunction(() => /Accept the 2 ticked/.test(document.querySelector('[data-drpacc]').textContent));
  // the open levels page shows the tidy with its counts, and Kit's span
  await d.p.evaluate(() => goView('drdpopen')); await d.p.waitForSelector('[data-drotidycard]');
  const card = await d.p.innerText('[data-drotidycard]'); assert.match(card, /3 accepted pieces of 1 child would move to Set aside/); assert.match(card, /1 dated after a later level and reading lower/);
  assert.match(card, /1 counting one observation twice for one measure/); assert.match(card, /1 for a child the observation does not tag/); assert.match(card, /Levels with two pieces now, 1\. After the tidy, 1\./);
  await d.p.click('[data-drokid="kit"] summary'); await d.p.waitForSelector('[data-drokid="kit"] .dol');
  const marks = await d.p.evaluate(() => { const row = [...document.querySelectorAll('[data-drokid="kit"] .dol')].find(x => /SCI 1/.test(x.textContent)); return [...row.querySelectorAll('.dc')].map(x => x.textContent + (x.classList.contains('out') ? '-' : '') + (x.classList.contains('full') ? '*' : '')); });
  assert.deepStrictEqual(marks, ['RE-', 'RL-', 'EE-', 'EL', 'BE*', 'BM', 'BL', 'IE', 'IM-', 'IL-'], 'the span runs from the earliest level with evidence to one past where Kit is');
  await d.p.click('[data-drotidy="run"]'); await d.p.waitForFunction(() => children.get('kit').drdp.items.k4.status === 'aside');
  const after = await d.p.evaluate(() => { const i = children.get('kit').drdp.items; return [i.k4.asideWhy, i.k4.was.status, i.k4.was.by, i.d2.asideWhy, i.d1.status, i.u1.asideWhy, drdpTidyCount().pieces]; });
  assert.deepStrictEqual(after, ['behind', 'accepted', 'Ann', 'twice', 'accepted', 'untagged', 0]);
  // with the tidy done, the span starts at Building Earlier
  await d.p.waitForSelector('[data-drotidy="back"]'); assert.match(await d.p.innerText('[data-drotidycard]'), /3 pieces were tidied on/);
  // Put them back restores each as the educator left it
  await d.p.click('[data-drotidy="back"]'); await d.p.waitForFunction(() => children.get('kit').drdp.items.k4.status === 'accepted');
  assert.deepStrictEqual(await d.p.evaluate(() => { const x = children.get('kit').drdp.items.k4; return [x.reviewedBy, drdpTidyCount().pieces]; }), ['Ann', 0], 'one put back is left alone by the tidy');
  // the child's page says where Kit is in one line
  await d.p.evaluate(() => { kidOpen = 'kit'; kidTab = 'drdp'; goView('child'); }); await d.p.waitForSelector('[data-drrow="dom:SCI"] > summary', { timeout: 15000 });
  await d.p.click('[data-drrow="dom:SCI"] > summary'); assert.match(await d.p.innerText('[data-drstand="SCI 1"]'), /Solid at Building Earlier, beginning to show Building Later/);
  assert.deepStrictEqual(d.errors, []);
});

test('the DRDP links move to the state file of August 20, 2026, and the one line of wording carries its examples', async () => {
  const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's71-drdp-august.json'), 'utf8'));
  assert.strictEqual(LIST.changes.length, 2);
  for (const c of LIST.changes) { assert.match(c.from, /04202026/); assert.match(c.to, /PTK%20View_08202026_ADA\.pdf/); assert.doesNotMatch(c.to, /04202026|April/); }
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8'), /s71DrdpAugust: \['code:once\/s71-drdp-august\.json'/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), /Identifies some characters \(e\.g\., 山; 火\) by meaning/);
});
