'use strict';
// The book bag. Educators add vetted books through Monday for the week after, the director adds a draft to read it for
// vetting, places the holds, and keeps track of each book to its return. When the bag is empty, TREE suggests books
// from the coming week's plans, and the report says why each book was chosen and how it connects. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const book = (title, why, con, draft) => `<!--\nlibrary: book\nauthor: Ada Plum\nowned: no\n${draft ? 'status: draft\nby: Ann\n' : ''}-->\n# ${title}\n\n## Why we chose it\n\n${why}\n\n## Connections\n\n${con}\n`;
async function setup(t, today) {
  const fx = await start({ env: { BOOKBAG_TODAY: today, BOOK_CATALOG_TEST_BASE: 'http://127.0.0.1:9' }, more: put => {
    put('staff/library/books/goats-in-the-hay.md', book('Goats in the Hay', 'Goats eat hay and climb on everything.', '- The goat pen'));
    put('staff/library/books/rain-again.md', book('Rain Again', 'Puddles and rain boots.', '- Weather'));
    put('staff/library/books/a-draft-book.md', book('A Draft Book', 'Goats and hay again.', '- The goat pen', true)); } });
  t.after(() => fx.stop());
  return fx;
}

test('Educators add through Monday, the director tracks each book, and drafts wait for her', async t => {
  // Tuesday, November 17, so the bag closes Monday, November 23 and holds books for the week of November 30
  const fx = await setup(t, '2026-11-17');
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const lib = (await fx.as(ann, '/api/staff/library', {})).body;
  assert.deepStrictEqual(lib.bag.open, { today: '2026-11-17', close: '2026-11-23', week: '2026-11-30' });
  const goats = lib.books.find(x => x.title === 'Goats in the Hay');
  let r = await fx.as(ann, '/api/staff/library/bag/add', { path: goats.path, for: 'West, the goat thread' });
  assert.strictEqual(r.status, 200); const it = r.body.bag.items[0];
  assert.strictEqual(it.week, '2026-11-30'); assert.strictEqual(it.for, 'West, the goat thread'); assert.strictEqual(it.status, 'bag'); assert.ok(!('by' in it), 'who added it is never sent');
  assert.strictEqual((await fx.as(bea, '/api/staff/library/bag/add', { path: goats.path })).status, 400, 'a book is in the bag once');
  assert.strictEqual((await fx.as(bea, '/api/staff/library/bag/remove', { id: it.id })).status, 403, 'only the educator who added it or the director takes it out');
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bag/add', { path: 'staff/library/books/a-draft-book.md' })).status, 403, 'a draft waits for the director');
  assert.strictEqual((await fx.as(dee, '/api/staff/library/bag/add', { path: 'staff/library/books/a-draft-book.md', for: 'To vet' })).status, 200);
  assert.strictEqual((await fx.as(kit, '/api/staff/library/bag/add', { path: goats.path })).status, 403);
  assert.ok(!('bag' in (await fx.as(kit, '/api/staff/library', {})).body));
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bag/status', { id: it.id, status: 'requested' })).status, 403);
  r = await fx.as(dee, '/api/staff/library/bag/status', { ids: (await fx.as(dee, '/api/staff/library', {})).body.bag.items.map(x => x.id), status: 'requested' });
  assert.ok(r.body.bag.items.every(x => x.status === 'requested'));
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bag/remove', { id: it.id })).status, 400, 'a placed hold stays');
  await fx.as(dee, '/api/staff/library/bag/status', { id: it.id, status: 'ready' });
  r = await fx.as(dee, '/api/staff/library/bag/status', { id: it.id, status: 'out', due: '2026-12-08' });
  assert.strictEqual(r.body.bag.items.find(x => x.id === it.id).due, '2026-12-08');
  r = await fx.as(dee, '/api/staff/library/bag/status', { id: it.id, status: 'returned' });
  assert.ok(!(await fx.as(ann, '/api/staff/library', {})).body.bag.items.some(x => x.id === it.id), 'a returned book leaves the educators\' view');
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bag/add', { path: goats.path })).status, 200, 'a returned book can go in the bag again');
  // the library check, from the director's library account
  const rain = lib.books.find(x => x.title === 'Rain Again');
  await fx.as(ann, '/api/staff/library/bag/add', { path: rain.path });
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bag/sync', {})).status, 403);
  r = await fx.as(dee, '/api/staff/library/bag/sync', { holds: [{ title: 'Goats in the hay : a farm story', ready: true }, { title: 'Some Other Book' }], out: [{ title: 'Rain again', due: '2026-12-10' }], missed: ['A Draft Book'] });
  const by = t => r.body.bag.items.filter(x => x.title === t && x.status !== 'returned');
  assert.strictEqual(by('Goats in the Hay')[0].status, 'ready'); assert.strictEqual(by('Rain Again')[0].status, 'out'); assert.strictEqual(by('Rain Again')[0].due, '2026-12-10');
  assert.deepStrictEqual(r.body.bag.sync.others, [{ title: 'Some Other Book', step: 'requested', due: '' }]); assert.deepStrictEqual(r.body.bag.sync.missed, ['A Draft Book']);
  assert.ok(!('sync' in (await fx.as(ann, '/api/staff/library', {})).body.bag), 'the library check is the director\'s');
  // the next check finds Rain Again gone from the card, so it was returned, and the sync survives a later add
  r = await fx.as(dee, '/api/staff/library/bag/sync', { holds: [{ title: 'Goats in the Hay', ready: true }], out: [] });
  assert.ok(!r.body.bag.items.some(x => x.title === 'Rain Again' && x.status !== 'returned'));
  await fx.as(dee, '/api/staff/library/bag/add', { path: rain.path });
  assert.ok((await fx.as(dee, '/api/staff/library', {})).body.bag.sync.at);
});

test('On a Monday the bag closes that day, and the director sees suggestions, the report and Today', async t => {
  const fx = await setup(t, '2026-11-16');
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  assert.deepStrictEqual((await fx.as(dee, '/api/staff/library', {})).body.bag.open, { today: '2026-11-16', close: '2026-11-16', week: '2026-11-23' });
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  // an observation about goats this week gives the suggestion something to match
  await s.p.evaluate(() => { const n = newNotice(); n.noticed = 'The goats climbed the hay bales and the children fed the goats hay.'; n.week = '2026-11-16'; notices.set(n.id, n); });
  await s.p.evaluate(() => { goView('books'); });
  await s.p.waitForSelector('#bookbag', { timeout: 15000 });
  assert.match(await s.p.textContent('#bookbag'), /Add books through Monday, November 16/);
  await s.p.waitForSelector('[data-bagtick="s"]', { timeout: 15000 });
  const sug = await s.p.$$eval('[data-bagtick="s"]', xs => xs.map(x => x.closest('.prow').textContent));
  assert.match(sug[0], /Goats in the Hay/); assert.ok(!sug.some(t => /Rain Again/.test(t)), 'a book that shares nothing is not suggested');
  assert.match(sug.find(t => /A Draft Book/.test(t)) || '', /Not vetted yet/);
  await s.p.check('[data-bagtick="s"]'); await s.p.click('[data-bagsugadd="some"]');
  await s.p.waitForFunction(() => libData.bag.items.length === 1, null, { timeout: 15000 });
  assert.match(await s.p.textContent('#bookbag'), /Goats in the Hay/);
  // the report, why it was chosen and how it connects
  const doc = await s.p.evaluate(() => bagReportDoc(libData.bag.items[0].week));
  assert.strictEqual(doc.title, 'Book bag, week of November 23');
  assert.match(JSON.stringify(doc.blocks), /Goats eat hay/); assert.match(JSON.stringify(doc.blocks), /The goat pen/); assert.match(JSON.stringify(doc.blocks), /Shares goat/);
  // a book that has waited in the bag over a day shows on Today
  await s.p.evaluate(() => { libData.bag.items[0].at = Date.now() - 2 * 864e5; goView('today'); });
  await s.p.waitForFunction(() => /Holds still to place/.test(document.body.textContent), null, { timeout: 15000 });
  // tick boxes on the suggestions add the ones ticked
  await s.p.evaluate(() => { goView('books'); bagSugOn = true; renderMain(); });
  await s.p.waitForSelector('[data-bagtick="s"]', { timeout: 15000 });
  await s.p.check('[data-bagtick="s"]'); await s.p.click('[data-bagsugadd="some"]');
  await s.p.waitForFunction(() => libData.bag.items.length === 2, null, { timeout: 15000 });
  // an educator's card shows Add to book bag, and no button on a draft
  const e = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => e.close());
  await e.p.evaluate(() => { goView('books'); });
  await e.p.waitForSelector('[data-readrow="b-rain-again"]', { timeout: 15000 });
  await e.p.click('[data-readrow="b-rain-again"] summary'); await e.p.click('[data-readrow="b-rain-again"] [data-bagadd]');
  await e.p.fill('#bag-for', 'North, puddles'); await e.p.click('[data-bagaddgo]');
  await e.p.waitForFunction(() => libData.bag.items.some(x => x.title === 'Rain Again' && x.mine), null, { timeout: 15000 });
  assert.match(await e.p.textContent('[data-readrow="b-rain-again"] summary'), /In the book bag/);
  assert.strictEqual(await e.p.$$eval('[data-readrow="b-a-draft-book"] [data-bagadd]', xs => xs.length), 0);
  assert.deepStrictEqual(s.errors, []); assert.deepStrictEqual(e.errors, []);
});
