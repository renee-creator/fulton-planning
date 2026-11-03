'use strict';
// The book collection: Find the book shows matches from the library catalogs and fills in the one chosen, with its cover
// and what the library holds, then the writing help drafts our own parts. Vet this book drafts the vetting
// notes from the Book Vetting Tool, Suggest books marks the ones already ours, We own it is kept on each book, and a book
// whose Connections name a card, a plant or a thread shows beside it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start, browser, signedIn } = require('./fixture.js');

const reply = (r, o) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(o) }], stop_reason: 'end_turn' })); };
async function setup(t) {
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString();
    if (/using our Book Vetting Tool below/.test(body)) return reply(r, { lines: [{ question: 'True to the children', answer: 'looks right', note: 'The families look like ours.' }, { question: 'Real images of nature', answer: 'Maybe', note: 'Read it through.' }] });
    if (/Name up to five/.test(body)) return reply(r, { books: [{ title: 'The Garden Book', author: 'Ada Plum', year: '1999', why: 'Seeds and soil.' }, { title: 'Rain Again', author: 'Bo Reed', year: '2004', why: 'Puddles.' }] });
    if (/Not A Real Book/.test(body)) return reply(r, { found: false });
    return reply(r, { found: true, title: 'The Garden Book', author: 'Ada Plum', illustrator: '', year: '1999', languages: 'English', kinds: ['story', 'made-up'], why: 'Seeds grow.', where: 'The garden basket',
      guide: 'I notice the seeds\nI wonder what grows', connections: ['A Card We Do Not Have', 'Planting'] }); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  // a stand-in for Open Library, the Sonoma County Library catalog and a cover
  const cat = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); const q1 = (u.searchParams.get('title') || u.searchParams.get('query') || '').toLowerCase();
    const send = o => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };
    if (u.pathname === '/cover/garden.jpg') { r.writeHead(200, { 'Content-Type': 'image/jpeg' }); r.end(Buffer.alloc(4000, 7)); return; }
    if (u.pathname === '/ol/search.json') return send({ docs: /garden/.test(q1) ? [{ key: '/works/OL1W', title: 'The Garden Book', author_name: ['Ada Plum', 'Lee Fern'], first_publish_year: 1999, isbn: ['9780000000001'], language: ['eng'], number_of_pages_median: 32 }]
      : /rain/.test(q1) ? [{ key: '/works/OL2W', title: 'Rain Again', author_name: ['Bo Reed'], first_publish_year: 2004 }] : [] });
    if (u.pathname === '/lib/search') return send({ entities: { bibs: /garden/.test(q1) ? { S1: { briefInfo: { metadataId: 'S1', title: 'The Garden Book', authors: ['Plum, Ada'], format: 'BK', primaryLanguage: 'eng', isbns: ['9780000000002'], jacket: { large: 'http://' + q.headers.host + '/cover/garden.jpg' } }, availability: { availableCopies: 2, totalCopies: 3 } } } : {} } });
    r.writeHead(404); r.end(); });
  await new Promise(ok => cat.listen(0, '127.0.0.1', ok)); t.after(() => cat.close());
  const base = 'http://127.0.0.1:' + cat.address().port;
  // the stand-in's Open Library answer points its cover at the stand-in
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port, BOOK_CATALOG_TEST_BASE: base, ONCE_SKIP: '' },
    more: put => put('staff/pd/modules/09-book-vetting-tool.md', '<!--\nminutes: 30\nserves: obs\n-->\n# The Book Vetting Tool\n\nLead.\n\n## Questions\n\n- Is it true to the children?\n- Are the images of nature real?\n') });
  t.after(() => fx.stop());
  return fx;
}

test('Find the book, Suggest books, We own it and Vet this book', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => { songTab = 'collection'; goView('songs'); }); await s.p.waitForSelector('[data-bookadd="1"]', { timeout: 15000 });
  await s.p.click('[data-bookadd="1"]'); await s.p.fill('#bk-t', 'garden book'); await s.p.click('[data-bookfind]');
  await s.p.waitForSelector('[data-bookpickm="0"]', { timeout: 15000 });
  assert.match(await s.p.textContent('[data-bookpickm="0"]'), /Sonoma County Library · 2 of 3 in now/);
  await s.p.click('[data-bookpickm="0"]');
  await s.p.waitForFunction(() => document.getElementById('bk-a') && document.getElementById('bk-a').value === 'Ada Plum', null, { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#bk-t'), 'The Garden Book'); assert.strictEqual(await s.p.inputValue('#bk-y'), '1999');
  assert.strictEqual(await s.p.inputValue('#bk-i'), 'Lee Fern', 'the second name in the catalog is the illustrator');
  assert.strictEqual(await s.p.inputValue('#bk-u'), 'https://openlibrary.org/works/OL1W');
  await s.p.waitForFunction(() => document.getElementById('bk-g') && /seeds/.test(document.getElementById('bk-g').value), null, { timeout: 15000 });
  assert.ok(await s.p.isChecked('[data-bkkind="story"]'));
  assert.strictEqual(await s.p.inputValue('#bk-c'), '', 'a connection not in our lists is left out');
  assert.strictEqual(await s.p.inputValue('#bk-g'), '- I notice the seeds\n- I wonder what grows');
  assert.ok(!(await s.p.isChecked('#bk-o')), 'a new book is not ours until the box is ticked');
  assert.ok(!(await s.p.evaluate(() => (libData.books || []).some(x => x.title === 'The Garden Book'))), 'nothing saves before Add');
  await s.p.fill('#bk-c', '- Sunflower'); await s.p.check('#bk-o'); await s.p.click('[data-booksave]');
  await s.p.waitForFunction(() => (libData.books || []).some(x => x.title === 'The Garden Book'), null, { timeout: 15000 });
  const book = await s.p.evaluate(() => { const x = libData.books.find(x => x.title === 'The Garden Book'); return { parts: x.parts.map(p => p.key), meta: x.meta, id: x.id }; });
  assert.strictEqual(book.meta.owned, 'yes'); assert.ok(book.parts.includes('Reading guide') && book.parts.includes('Connections'));
  // the library's ISBN for a copy it holds, and a copy of the cover kept in TREE
  assert.strictEqual(book.meta.isbn, '9780000000002'); assert.match(book.meta.cover || '', /^[a-f0-9]{12}-book-cover\.jpg$/);
  await s.p.waitForFunction(id => { const r = document.querySelector(`[data-readrow="b-${id}"]`); return r && /2 of 3 in now/.test(r.textContent) && r.querySelector('img.bkcov'); }, book.id, { timeout: 15000 });

  // a book no catalog has keeps what was typed
  await s.p.click('[data-bookadd="1"]'); await s.p.fill('#bk-t', 'Not A Real Book'); await s.p.fill('#bk-a', 'Someone'); await s.p.click('[data-bookfind]');
  await s.p.waitForSelector('text=No library catalog found this title', { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#bk-t'), 'Not A Real Book'); assert.strictEqual(await s.p.inputValue('#bk-w'), '');
  await s.p.click('[data-bookadd="0"]');

  // Suggest books marks the one already ours, and Find the book opens the form for another
  await s.p.fill('#bk-sq', 'gardens'); await s.p.click('[data-booksug]');
  await s.p.waitForSelector('text=In our collection', { timeout: 15000 });
  assert.strictEqual(await s.p.$$eval('[data-booksugfind]', xs => xs.length), 1, 'only the book we do not have offers Find the book');
  await s.p.click('[data-booksugfind]'); await s.p.waitForSelector('#bk-t', { timeout: 15000 });
  await s.p.click('[data-bookadd="0"]');

  // the filter, Ours and To find
  await s.p.click('[data-bookown="find"]');
  // the starter set waits, every book of it a draft for the director to vet
  const toFind = await s.p.evaluate(() => libData.books.filter(x => !bookOwned(x)).map(x => ({ draft: x.draft, from: x.meta.from })));
  assert.ok(toFind.length >= 70); assert.ok(toFind.every(x => x.draft && /starter set/.test(x.from)));
  assert.strictEqual(await s.p.$$eval('[data-readrow]', xs => xs.length), toFind.length);
  await s.p.click('[data-bookown="ours"]'); assert.strictEqual(await s.p.$$eval('[data-readrow]', xs => xs.length), 1);
  // At our library shows the books we do not own that the library holds, and ours is not one of them
  await s.p.click('[data-bookown="lib"]'); assert.strictEqual(await s.p.$$eval('[data-readrow]', xs => xs.length), 0);
  await s.p.click('[data-bookown="all"]');

  // Vet this book drafts one line for each question, for the director to save
  await s.p.evaluate(id => { const d = document.querySelector(`[data-readrow="b-${id}"]`); d.open = true; d.querySelector('[data-bookvetdraft]').click(); }, book.id);
  await s.p.waitForSelector('#bv-t', { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#bv-t'), '- True to the children: Looks right. The families look like ours.\n- Real images of nature: Check in the book. Read it through.');
  await s.p.click('[data-bookvetsave]');
  await s.p.waitForFunction(() => /Looks right/.test(bookPart(libData.books.find(x => x.title === 'The Garden Book'), 'Vetting notes')), null, { timeout: 15000 });

  // Books from our collection, by its Connections, and never a draft
  const shown = await s.p.evaluate(() => booksFor('Sunflower')); assert.match(shown, /Books from our collection/); assert.match(shown, /The Garden Book, ours/);
  assert.strictEqual(await s.p.evaluate(() => booksFor('Thunder')), '');
  assert.deepStrictEqual(s.errors, []);
});

test('We own it is marked by the director or the office, and the vetting notes by the director', async t => {
  const fx = await setup(t);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, gia = (await fx.login('Gia', '1357')).token, ann = (await fx.login('Ann', '1357')).token;
  const r = await fx.as(ann, '/api/staff/library/add', { kind: 'book', title: 'A Book Ann Likes', connections: '- Sunflower' });
  assert.strictEqual(r.status, 200);
  let x = (await fx.as(dee, '/api/staff/library', {})).body.books.find(x => x.title === 'A Book Ann Likes');
  assert.ok(x.draft); assert.strictEqual(x.meta.owned, 'no');
  assert.strictEqual((await fx.as(ann, '/api/staff/library/owned', { path: x.path, on: true })).status, 403);
  assert.strictEqual((await fx.as(gia, '/api/staff/library/owned', { path: x.path, on: true })).status, 200);
  assert.strictEqual((await fx.as(ann, '/api/staff/library/vetting', { path: x.path, text: 'Fine' })).status, 403);
  const v = await fx.as(dee, '/api/staff/library/vetting', { path: x.path, text: '- One: Looks right.' }); assert.strictEqual(v.status, 200);
  x = v.body.books.find(y => y.title === 'A Book Ann Likes'); assert.strictEqual(x.meta.owned, 'yes');
  assert.strictEqual(x.parts.filter(p => p.key === 'Vetting notes').length, 1);
  const v2 = await fx.as(dee, '/api/staff/library/vetting', { path: x.path, text: '- Two: A concern.' });
  x = v2.body.books.find(y => y.title === 'A Book Ann Likes'); const vn = x.parts.filter(p => p.key === 'Vetting notes');
  assert.strictEqual(vn.length, 1); assert.match(vn[0].text, /Two/); assert.doesNotMatch(vn[0].text, /One/);
});

test('Covers and links go on books already in the collection, by the director', async t => {
  const fx = await setup(t);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  await fx.as(dee, '/api/staff/library/add', { kind: 'book', title: 'garden book' });
  await fx.as(dee, '/api/staff/library/add', { kind: 'book', title: 'A Book No One Has' });
  let L = (await fx.as(dee, '/api/staff/library', {})).body.books; const g = L.find(x => x.title === 'garden book'), n = L.find(x => x.title === 'A Book No One Has');
  const f = await fx.as(ann, '/api/staff/library/bookfind', { title: 'garden book' }); assert.strictEqual(f.status, 200);
  const m = f.body.matches[0]; assert.strictEqual(m.author, 'Ada Plum'); assert.strictEqual(m.library.total, 3);
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bookfacts', { path: g.path, match: m })).status, 403);
  const r = await fx.as(dee, '/api/staff/library/bookfacts', { path: g.path, match: m }); assert.strictEqual(r.status, 200);
  const g2 = r.body.books.find(x => x.path === g.path);
  assert.strictEqual(g2.meta.author, 'Ada Plum'); assert.strictEqual(g2.meta.year, '1999'); assert.strictEqual(g2.meta.catalog, 'yes'); assert.match(g2.meta.cover, /-book-cover\.jpg$/);
  // a cover from anywhere but a library catalog is never fetched
  const bad = await fx.as(dee, '/api/staff/library/bookfacts', { path: n.path, match: { title: 'X', cover: 'https://example.com/a.jpg' } });
  assert.strictEqual(bad.status, 200); assert.strictEqual(bad.body.coverMissed, true);
  const none = await fx.as(dee, '/api/staff/library/bookfacts', { path: n.path, none: true });
  assert.strictEqual(none.body.books.find(x => x.path === n.path).meta.catalog, 'none');
  // what the library holds of each book
  const a = await fx.as(ann, '/api/staff/library/bookavail', {}); assert.strictEqual(a.status, 200);
  assert.strictEqual(a.body.list[g.path].avail, 2); assert.strictEqual(a.body.list[n.path].found, false);
});
