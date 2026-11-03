'use strict';
// The book collection: Find the book fills in only a book the writing help is sure exists, Vet this book drafts the vetting
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
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port },
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
  await s.p.waitForFunction(() => document.getElementById('bk-a') && document.getElementById('bk-a').value === 'Ada Plum', null, { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#bk-t'), 'The Garden Book'); assert.strictEqual(await s.p.inputValue('#bk-y'), '1999');
  assert.match(await s.p.inputValue('#bk-u'), /^https:\/\/search\.worldcat\.org\/search\?q=The%20Garden%20Book%20Ada%20Plum$/);
  assert.ok(await s.p.isChecked('[data-bkkind="story"]'));
  assert.strictEqual(await s.p.inputValue('#bk-c'), '', 'a connection not in our lists is left out');
  assert.strictEqual(await s.p.inputValue('#bk-g'), '- I notice the seeds\n- I wonder what grows');
  assert.ok(!(await s.p.isChecked('#bk-o')), 'a new book is not ours until the box is ticked');
  assert.strictEqual(await s.p.evaluate(() => (libData.books || []).length), 0, 'nothing saves before Add');
  await s.p.fill('#bk-c', '- Sunflower'); await s.p.check('#bk-o'); await s.p.click('[data-booksave]');
  await s.p.waitForFunction(() => (libData.books || []).some(x => x.title === 'The Garden Book'), null, { timeout: 15000 });
  const book = await s.p.evaluate(() => { const x = libData.books.find(x => x.title === 'The Garden Book'); return { parts: x.parts.map(p => p.key), meta: x.meta, id: x.id }; });
  assert.strictEqual(book.meta.owned, 'yes'); assert.ok(book.parts.includes('Reading guide') && book.parts.includes('Connections'));

  // a book the writing help is not sure of keeps only its title
  await s.p.click('[data-bookadd="1"]'); await s.p.fill('#bk-t', 'Not A Real Book'); await s.p.fill('#bk-a', 'Someone'); await s.p.click('[data-bookfind]');
  await s.p.waitForSelector('text=could not be sure this book exists', { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#bk-t'), 'Not A Real Book'); assert.strictEqual(await s.p.inputValue('#bk-w'), '');
  await s.p.click('[data-bookadd="0"]');

  // Suggest books marks the one already ours, and Find the book opens the form for another
  await s.p.fill('#bk-sq', 'gardens'); await s.p.click('[data-booksug]');
  await s.p.waitForSelector('text=In our collection', { timeout: 15000 });
  assert.strictEqual(await s.p.$$eval('[data-booksugfind]', xs => xs.length), 1, 'only the book we do not have offers Find the book');
  await s.p.click('[data-booksugfind]'); await s.p.waitForSelector('#bk-t', { timeout: 15000 });
  await s.p.click('[data-bookadd="0"]');

  // the filter, Ours and To find
  await s.p.click('[data-bookown="find"]'); assert.strictEqual(await s.p.$$eval('[data-readrow]', xs => xs.length), 0);
  await s.p.click('[data-bookown="ours"]'); assert.strictEqual(await s.p.$$eval('[data-readrow]', xs => xs.length), 1);

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
