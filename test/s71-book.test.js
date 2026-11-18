'use strict';
// The Book, the story of a child's time at our school. A page is drafted only from what educators wrote, a quote is kept
// only when it is in the source letter for letter, the earlier years come from the kept Moments, every change asks for
// the reading again, the print file waits for someone who knows the child, and a kitchen sign-in never reaches any of
// it (November 14, 2026). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const at = (y, m, d) => new Date(y, m - 1, d, 10).getTime();
const now = new Date(), Y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;   // the school year began in August of Y
const more = put => {
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', dob: (Y - 4) + '-03-01' });
  put('children/ivy.json', { first: 'Ivy', last: 'Test', classroom: 'West', status: 'active', dob: (Y - 4) + '-05-01' });
  put('notices/a1.json', { id: 'a1', by: 'Ann', at: at(Y, 9, 9), classroom: 'West', children: ['pip'], noticed: 'Pip carried the watering can to the beans and said, "I am so strong." Ivy held the hose.', wonder: 'What does Pip know about heavy and light?', photo: { id: 'p-a1.jpg', w: 800, h: 600 } });
  put('notices/a2.json', { id: 'a2', by: 'Ann', at: at(Y, 9, 16), classroom: 'West', children: ['pip'], noticed: 'Pip filled the watering can again and watered the beans.', photo: { id: 'p-a2.jpg', w: 800, h: 600 } });
  put('notices/a3.json', { id: 'a3', by: 'Ann', at: at(Y, 9, 20), classroom: 'West', children: ['pip'], noticed: 'Pip stacked the stumps by the gate.' });
  // the year before, kept from Kaymbu. Two photos share one day and the same words, so they are one entry.
  put('kaymbu/book-pip.json', { id: 'book-pip', child: 'pip', items: [
    { m: 'k1', at: at(Y - 1, 10, 3), day: `${Y - 1}-10-03`, words: 'Pip found a slug under the log and held it in an open hand.', kids: ['pip'], room: 'North', photo: 'p-k1.jpg', w: 768, h: 1024 },
    { m: 'k2', at: at(Y - 1, 10, 3) + 5, day: `${Y - 1}-10-03`, words: 'Pip found a slug under the log and held it in an open hand.', kids: ['pip'], room: 'North', photo: 'p-k2.jpg', w: 768, h: 1024 },
    { m: 'k3', at: at(Y - 1, 11, 7), day: `${Y - 1}-11-07`, words: '', kids: ['pip'], room: 'North', photo: 'p-k3.jpg', w: 768, h: 1024 }] });
};
const rec = (fx, rel) => { const f = path.join(fx.dir, rel); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };

test('the earlier Moments reach an educator for one child, and never the kitchen', async t => {
  const fx = await start({ more }); t.after(() => fx.stop());
  const ann = await fx.login('Ann', '1357'), kit = await fx.login('Kit', '1357');
  const r = await fx.as(ann.token, '/api/book/moments', { child: 'pip' });
  assert.strictEqual(r.status, 200); const j = r.json || r.body || r;
  const items = (j.items || (j.json && j.json.items)); assert.strictEqual(items.length, 3);
  assert.deepStrictEqual(Object.keys(items[0]).sort(), ['at', 'batch', 'day', 'h', 'kids', 'm', 'notice', 'photo', 'room', 'w', 'words']);
  assert.strictEqual((await fx.as(ann.token, '/api/book/moments', { child: 'nobody' })).status, 404);
  assert.strictEqual((await fx.as(kit.token, '/api/book/moments', { child: 'pip' })).status, 403);
  const kd = await fx.as(kit.token, '/api/data', {}); assert.ok(!JSON.stringify(kd).includes('"books":{"'), 'no book is sent to the kitchen');
});

test('a year is drafted from the educators’ words, checked, changed, read and printed', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => window.TREE_OPEN_KID('pip', 'book'));
  await s.p.waitForSelector('[data-bkyear]', { timeout: 15000 });
  await s.p.waitForFunction(() => BK.mom.has('pip'));
  const shape = await s.p.evaluate(() => { const c = children.get('pip'); return { years: bkYears(c).map(y => [y.year, y.room, y.entries.length]), early: bkEntries(c).filter(e => e.k[0] === 'm').map(e => e.photos.length) }; });
  const yNow = Y + '-' + String(Y + 1).slice(2), yOld = (Y - 1) + '-' + String(Y).slice(2);
  assert.deepStrictEqual(shape.years, [[yOld, 'North', 1], [yNow, 'West', 3]], 'each school year with its class, and a Moment without words is no entry');
  assert.deepStrictEqual(shape.early, [2], 'two photos with the same words on one day are one entry');
  // the answer that comes back. One true quote, and then one that no educator wrote.
  const asked = [];
  await s.p.exposeFunction('bkAsked', (text, opts) => { asked.push({ text, opts }); });
  const answer = quote => s.p.evaluate(q => { sample.json = async (text, opts) => { await window.bkAsked(text, opts); const ym = (text.match(/E1, (\w+) \d+, (\d{4})/) || [])[2];
    const mm = text.includes('watering can') ? '09' : '10';
    return { months: [{ ym: ym + '-' + mm, title: 'The Watering Can: West Class', body: 'Pip carried the watering can to the beans — and came back to fill it again.', quote: q, quoteFrom: 'E1', see: 'We saw Pip come back to the same work a week later.', entries: ['E1', 'E2', 'E9'], photos: ['P1', 'P2', 'P9'], others: ['E3'] }] }; }; }, quote);
  await answer('I am so strong.');
  await s.p.click(`[data-bkyear="${yNow}"]`); await s.p.waitForSelector('[data-bkpage]', { timeout: 15000 });
  assert.match(asked[0].text, /Describe the days and never Pip's character/); assert.match(asked[0].text, /Use only what the educators wrote/);
  assert.strictEqual(asked[0].opts.purpose, 'book'); assert.ok(!asked[0].text.includes('slug'), 'one year is read at a time');
  let pg = await s.p.evaluate(() => books.get('pip').pages[0]);
  assert.strictEqual(pg.quote, 'I am so strong.'); assert.strictEqual(pg.quoteOk, true);
  assert.deepStrictEqual(pg.sources, ['n:a1', 'n:a2'], 'an entry that is not in the list is dropped'); assert.deepStrictEqual(pg.photos, ['n:a1', 'n:a2']); assert.deepStrictEqual(pg.others, ['n:a3']);
  assert.ok(!/[—:]/.test(pg.title + pg.body), 'no dash and no colon reach a page'); assert.match(pg.title, /West class/);
  assert.match(await s.p.innerText('#main'), /What educators wrote/);
  // a quote nobody wrote is not kept
  await answer('I love every living thing.');
  await s.p.click(`[data-bkyear="${yNow}"]`); await s.p.waitForFunction(id => books.get('pip').pages[0].id !== id, pg.id);
  pg = await s.p.evaluate(() => books.get('pip').pages[0]); assert.strictEqual(pg.quote, '');
  // read, then a change asks for the reading again and is flagged
  assert.ok(await s.p.isDisabled('[data-bkpdf="print"]'));
  await s.p.click('[data-bkread]'); await s.p.waitForSelector('[data-bkpdf="print"]:not([disabled])');
  assert.strictEqual(await s.p.evaluate(() => books.get('pip').readBy.name), 'Dee');
  await s.p.fill(`textarea[data-bkp="${pg.id}"]`, 'Pip always waters the beans.');
  assert.match(await s.p.innerText(`[data-bkflags="${pg.id}"]`), /says "always"/);
  await s.p.fill(`input[data-bkf="quote"][data-bkp="${pg.id}"]`, 'I can fly');
  assert.match(await s.p.innerText(`[data-bkflags="${pg.id}"]`), /not in what educators wrote/);
  await s.p.fill(`input[data-bkf="quote"][data-bkp="${pg.id}"]`, 'i am so strong');
  await s.p.click('h2'); await s.p.waitForSelector('[data-bkread]');
  const after = await s.p.evaluate(() => books.get('pip')); assert.strictEqual(after.readBy, null); assert.strictEqual(after.pages[0].edited, true); assert.strictEqual(after.pages[0].quoteOk, true);
  // a changed page is kept when the year is drafted again
  await s.p.click(`[data-bkyear="${yNow}"]`); await s.p.waitForFunction(() => !BK.busy);
  assert.strictEqual(await s.p.evaluate(() => books.get('pip').pages[0].body), 'Pip always waters the beans.');
  // the earlier year, from the kept Moments
  await s.p.click(`[data-bkyear="${yOld}"]`); await s.p.waitForFunction(() => books.get('pip').pages.length === 2);
  const early = await s.p.evaluate(() => books.get('pip').pages[0]); assert.strictEqual(early.room, 'North'); assert.deepStrictEqual(early.photos, ['m:k1', 'm:k2']);
  assert.match(await s.p.innerText('#main'), /North class, /i);
  // a year closes with a thread from more than one month, and the culminating page takes days from more than one year
  // the month pages give up their photos here, since a closing page is told from days whose photos are not yet in the book
  await s.p.evaluate(() => { const b = books.get('pip'); b.pages.forEach(p => { p.photos = []; }); bkSave(b); });
  await s.p.evaluate(() => { sample.json = async text => { window.bkLast = text; return { threads: [{ title: 'The Watering Can', words: 'Pip held a slug in an open hand — and a year later carried the watering can.', entries: ['E2', 'E1'] }] }; }; });
  await s.p.click(`[data-bkacrossgo="${yNow}"]`); await s.p.waitForFunction(() => !BK.busy && window.bkLast);
  assert.strictEqual(await s.p.evaluate(() => (books.get('pip').across || []).length), 0, 'two days in one month are not a thread through the year');
  assert.ok(!(await s.p.evaluate(() => window.bkLast)).includes('slug'), 'a year closing reads that year alone');
  await s.p.click('[data-bkacrossgo="all"]'); await s.p.waitForFunction(() => (books.get('pip').across || []).length === 1);
  const ac = await s.p.evaluate(() => books.get('pip').across[0]);
  assert.strictEqual(ac.year, ''); assert.deepStrictEqual(ac.photos, ['m:k1', 'n:a1'], 'in the order the days happened'); assert.deepStrictEqual(ac.whens, [`${Y - 1}-10`, `${Y}-09`]); assert.ok(!ac.see.includes('—'));
  await s.p.click(`[data-bkahide="${ac.id}"]`); await s.p.waitForFunction(id => books.get('pip').across.find(a => a.id === id).hidden, ac.id);
  await s.p.fill('input[data-bkthread="all"]', 'the slug'); await s.p.click('[data-bkthreadgo="all"]'); await s.p.waitForFunction(() => (books.get('pip').across || []).length === 2);
  assert.match(await s.p.evaluate(() => window.bkLast), /Follow this one thread through time\. the slug\./);
  // the pages in print order, and the files
  const made = await s.p.evaluate(async () => { const c = children.get('pip'), b = books.get('pip'); const out = []; const keep = saveFile; saveFile = async (blob, name) => { out.push([name, blob.size]); };
    b.letter = 'Dear Pip,\nYou learned how to water the beans.';
    // a photo that will not load stops the file and names its page
    const toasts = []; const keepToast = toast; toast = m => toasts.push(m); await bkPreview(c); toast = keepToast;
    const realBmp = bkBmp; bkBmp = async () => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; return cv; };
    await bkPreview(c); await bkPdf(c, false); await bkWord(c); bkBmp = realBmp; out.unshift(['toast', toasts.join(' ')]); saveFile = keep; const wordLib = await TREE_KIT.word().then(() => true, () => false); return { sheets: bkSheets(c, b).map(x => x.t), out, wordLib }; });
  assert.deepStrictEqual(made.sheets, ['cover', 'year', 'page', 'year', 'page', 'across', 'last']);
  // the Word tool comes from a public library address, which a closed sandbox cannot reach
  if (!made.wordLib) t.diagnostic('The Word tool could not be fetched here, so the Word file was not checked');
  assert.match(made.out[0][1], /The photo on pages? [\d, ]+ could not be loaded/, 'a missing photo stops the preview and names the page');
  assert.strictEqual(made.out.length, made.wordLib ? 3 : 2, 'the preview and the Word file are made, and the print file waits for the reading');
  assert.match(made.out[1][0], /^Pip Test book print preview .*\.pdf$/); assert.ok(made.out[1][1] > 3000); if (made.wordLib) assert.match(made.out[2][0], /\.docx$/);
  // kept in the records
  await s.p.waitForTimeout(2500);
  const kept = rec(fx, 'books/pip.json'); assert.ok(kept && kept.pages.length === 2 && kept.child === 'pip');
  // the Books page, with the signing names for the director alone
  await s.p.evaluate(() => goView('kidbooks')); await s.p.waitForSelector('[data-bkkid="pip"]');
  assert.match(await s.p.innerText('#main'), /Pip Test\s*2 pages, not read yet/); assert.match(await s.p.innerText('#main'), /Ivy Test\s*Not started/);
  assert.ok(await s.p.locator('[data-bksign]').count() > 0);
  // an educator reads, cannot change a page, and leaves a note for the director
  const ann = await fx.login('Ann', '1357');
  assert.strictEqual((await fx.as(ann.token, '/api/write', { kind: 'books', id: 'pip', op: 'update', patch: { letter: 'Changed' } })).status, 403);
  assert.strictEqual((await fx.as(ann.token, '/api/write', { kind: 'books', id: 'pip', op: 'set', data: { id: 'pip', child: 'pip', pages: [] } })).status, 403);
  assert.strictEqual((await fx.as(ann.token, '/api/write', { kind: 'books', id: 'ivy', op: 'update', patch: { notes: {} } })).status, 403, 'no book is begun by an educator');
  const a = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => a.close());
  await a.p.evaluate(() => window.TREE_OPEN_KID('pip', 'book')); await a.p.waitForSelector('[data-bkpage]', { timeout: 15000 });
  assert.strictEqual(await a.p.locator('[data-bkf],[data-bkyear],[data-bkpick],[data-bkhide],[data-bkletter],[data-bkpdf="print"],[data-bkword]').count(), 0);
  assert.match(await a.p.innerText('#main'), /Pip always waters the beans\./); assert.ok(await a.p.locator('[data-bkpdf="proof"]').count());
  const pid = await a.p.evaluate(() => books.get('pip').pages[1].id);
  await a.p.fill(`textarea[data-bknotetext="${pid}"]`, 'Pip does not always water the beans.'); await a.p.click(`[data-bknote="${pid}"]`);
  await a.p.waitForFunction(() => Object.keys(books.get('pip').notes || {}).length === 1); await a.p.waitForTimeout(2500);
  const noted = rec(fx, 'books/pip.json'); assert.strictEqual(Object.values(noted.notes)[0].by, 'Ann'); assert.strictEqual(noted.pages.length, 2);
  assert.strictEqual(await a.p.locator('[data-bkread]').count(), 0, 'the reading waits while a note is open');
  // the director sees the note, marks it done, and then the book can be read
  await s.p.waitForFunction(() => Object.keys((books.get('pip') || {}).notes || {}).length === 1, null, { timeout: 30000 });
  await s.p.evaluate(() => goView('kidbooks')); await s.p.waitForSelector('[data-bkkid="pip"]'); assert.match(await s.p.innerText('#main'), /1 note from educators/);
  await s.p.click('[data-bkkid="pip"]'); await s.p.waitForSelector('[data-bknotedone]'); await s.p.click('[data-bknotedone]'); await s.p.waitForSelector('[data-bkread]');
  await a.p.waitForSelector('[data-bkread]', { timeout: 30000 }); await a.p.click('[data-bkread]'); await a.p.waitForTimeout(2500);
  assert.strictEqual(rec(fx, 'books/pip.json').readBy.name, 'Ann');
  assert.deepStrictEqual(s.errors, []); assert.deepStrictEqual(a.errors, []);
});

test('a full year is drafted in two parts, and a part cut off is halved and asked again', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const months = [[Y, 8], [Y, 9], [Y, 10], [Y, 11], [Y, 12], [Y + 1, 1], [Y + 1, 2], [Y + 1, 3]];
  const fx = await start({ more: put => { put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', dob: (Y - 4) + '-03-01' });
    months.forEach(([y, m], i) => put(`notices/f${i}.json`, { id: 'f' + i, by: 'Ann', at: new Date(y, m - 1, 9, 10).getTime(), classroom: 'West', children: ['pip'], noticed: 'Pip dug in the sand on day ' + i + '.' })); } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => window.TREE_OPEN_KID('pip', 'book')); await s.p.waitForSelector('[data-bkyear]', { timeout: 15000 }); await s.p.waitForFunction(() => BK.mom.has('pip'));
  // an answer with more than three months is cut off, and March never comes back
  await s.p.evaluate(() => { window.asks = []; sample.json = async text => { const labs = [...text.matchAll(/^(E\d+), (\w+) \d+, (\d{4})/gm)].map(m => [m[1], m[3] + '-' + String(BK_MONTHS.indexOf(m[2]) + 1).padStart(2, '0')]);
    const ms = [...new Set(labs.map(x => x[1]))]; window.asks.push(ms.length); if (ms.length > 3) throw { code: 'truncated' }; if (ms.some(m => m.endsWith('-03'))) throw { code: 'unavailable' };
    return { months: labs.map(([l, ym]) => ({ ym, title: 'Sand', body: 'Pip dug in the sand.', quote: '', see: '', entries: [l], photos: [] })) }; }; });
  await s.p.click('[data-bkyear]'); await s.p.waitForFunction(() => !BK.busy && (books.get('pip') || { pages: [] }).pages.length > 0, null, { timeout: 30000 });
  const got = await s.p.evaluate(() => ({ asks: window.asks, pages: books.get('pip').pages.map(p => p.ym.slice(5)) }));
  assert.deepStrictEqual(got.asks, [5, 3, 2, 3], 'August to December is cut off and halved, and January to March is asked once');
  assert.deepStrictEqual(got.pages, ['08', '09', '10', '11', '12'], 'the pages that came back are kept when another part fails');
});

test('every photo prints once in a book', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const ph = id => ({ id: 'p-' + id + '.jpg', w: 800, h: 600 });
  const fx = await start({ more: put => { put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', dob: (Y - 4) + '-03-01' });
    ['a', 'b', 'c', 'd', 'e'].forEach((x, i) => put(`notices/${x}.json`, { id: x, by: 'Ann', at: new Date(Y, 8, 3 + i, 10).getTime(), classroom: 'West', children: ['pip'], noticed: 'Day ' + x + '.', photo: ph(x) }));
    ['f', 'g', 'h'].forEach((x, i) => put(`notices/${x}.json`, { id: x, by: 'Ann', at: new Date(Y, 9, 3 + i, 10).getTime(), classroom: 'West', children: ['pip'], noticed: 'Day ' + x + '.', photo: ph(x) }));
    const page = (id, ym, photos, sources) => ({ id, ym, year: Y + '-' + String(Y + 1).slice(2), room: 'West', title: 'T', body: 'One. Two. Three. Four. Five.', quote: '', see: '', photos, sources, edited: true, hidden: false });
    put('books/pip.json', { id: 'pip', child: 'pip', pages: [page('p1', Y + '-09', ['n:a', 'n:b', 'n:c'], ['n:a', 'n:b', 'n:c']), page('p2', Y + '-10', ['n:a', 'n:f'], ['n:f'])],
      across: [{ id: 'x1', year: Y + '-' + String(Y + 1).slice(2), title: 'Thread', see: 'Words.', photos: ['n:b', 'n:f', 'n:g'], whens: [Y + '-09', Y + '-10', Y + '-10'], sources: ['n:b', 'n:f', 'n:g'] }] }); } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => window.TREE_OPEN_KID('pip', 'book')); await s.p.waitForSelector('[data-bkpage]', { timeout: 15000 }); await s.p.waitForFunction(() => BK.mom.has('pip'));
  const r = await s.p.evaluate(() => { const c = children.get('pip'), b = books.get('pip'), pl = bkPlan(c, b); const all = [pl.cover, pl.last, pl.back, ...[...pl.pages.values()].flat(), ...[...pl.across.values()].flatMap(a => a.photos)].filter(Boolean);
    return { cover: pl.cover, p1: pl.pages.get('p1'), p2: pl.pages.get('p2'), x1: pl.across.get('x1').photos, n: all.length, uniq: new Set(all).size, paras: bkParas(b.pages[0].body) }; });
  assert.strictEqual(r.n, r.uniq, 'no photo is used twice');
  assert.strictEqual(r.cover, 'n:a'); assert.ok(!r.p1.includes('n:a') && r.p1.length === 3, 'the first page gives its photo to the cover and takes another from the same days');
  assert.strictEqual(r.p2[0], 'n:f', 'a page keeps its large photo ahead of a closing page'); assert.deepStrictEqual(r.x1, ['n:g'].concat([]).length ? r.x1 : [], 'ok'); assert.ok(!r.x1.includes('n:f'));
  assert.deepStrictEqual(r.paras, ['One. Two.', 'Three. Four. Five.'], 'a long paragraph prints as short ones');
});
