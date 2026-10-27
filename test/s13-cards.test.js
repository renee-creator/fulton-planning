'use strict';
// Session 13. One-page cards print centred. An artist card, a PD printables card and the Garden's cards and signs keep
// the school's name, the title, a second line under it, a short rule and each part with a small spaced label, in the
// middle of the page. Longer pages keep the full page layout. Made-up names and a made-up page only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const ARTISTS = `<!--
library: artists
-->
# Artists

We look together before anyone speaks.

## A Sculptor, mobiles and wire figures

**Set.** Garden and materials
**Known as.** A Sculptor
**Print or link.** Link
**Link.** [The Sculptor Foundation](https://example.org/sculptor)
**Pairs with.** Wire, sticks, string and found objects.
**Wondering.** We wonder how the children find the balance point.
**For the educator.** This note stays on the screen.

## A Painter, water study

**Set.** Garden and materials
**Known as.** A Painter
**Print or link.** Print
**Picture.** https://example.org/water.jpg
**Pairs with.** Water play.
**Wondering.** What shapes do the children see in moving water?
`;

test('cards print centred, with their parts labelled, and longer pages keep the full page', async t => {
  const fx = await start({ more: put => put('staff/library/prompts/artists.md', ARTISTS) });
  t.after(() => fx.stop());
  const b = await browser(); if (!b) return t.skip("Playwright is not installed here"); const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100);
  await s.p.evaluate(() => goView('artists')); await s.p.waitForSelector('[data-artrow]');
  const r = await s.p.evaluate(() => {
    const [link, pic] = artCards().map(artistDoc);
    const doc = TREE_KIT.pdf({ unit: 'pt', format: 'letter' });
    const L = cLayout(doc, link, ACC.story);
    const texts = L.ops.filter(o => o.t === 'text').map(o => o.txt);
    const labels = L.ops.filter(o => o.t === 'text' && o.cs).map(o => o.txt);
    const wide = L.ops.filter(o => o.t === 'line' && o.x2 - o.x1 > 100).length;
    const words = L.ops.filter(o => o.t === 'text' && o.y > 160);
    // a table keeps the full page, and a page of parts becomes a card
    const table = asCard({ display: true, type: 'report', title: 'A table', meta: [], blocks: [{ t: 'table', head: ['a'], rows: [['b']] }] });
    const plain = asCard({ display: true, type: 'report', title: 'Shoes on', meta: ['The garden'], blocks: [dText('', 'Shoes stay on in the garden.'), dList('Where', ['The garden', 'The piazza'])] });
    return { link, pic, texts, labels, wide, top: Math.min(...words.map(o => o.y)), bottom: Math.max(...words.map(o => o.y)), table, plain, preview: cPreview(link) };
  });
  // the artist's name is the title, the work its second line, and "Connected to" names what the work sits beside
  assert.strictEqual(r.link.title, 'A Sculptor'); assert.strictEqual(r.link.sub, 'Mobiles and wire figures');
  assert.ok(r.link.centered && r.link.card);
  assert.deepStrictEqual(r.labels, ['CONNECTED TO', 'OUR WONDERING', 'OUR ROUTINE', 'SEE THE WORK']);
  assert.ok(!r.texts.some(x => /Beside/.test(x)));
  // the routine prints each question on its own line, and the link names where to see the work
  for (const q of ['I notice.', 'I wonder.', 'It reminds me of.', 'What do you see that makes you say that?']) assert.ok(r.texts.includes(q), q);
  assert.ok(r.texts.includes('The Sculptor Foundation, example.org'));
  assert.ok(!r.texts.some(x => /stays on the screen/.test(x)), 'the note for the educator never prints');
  // a short rule under the title, no rules across the page, and the words in the middle of the page
  assert.strictEqual(r.wide, 0);
  assert.ok(r.top > 230 && r.bottom < 640, `words from ${r.top} to ${r.bottom}`);
  // the picture card prints the work large with the routine in two short lines
  assert.strictEqual(r.pic.photos.length, 1); assert.strictEqual(r.pic.blocks.length, 1); assert.strictEqual(r.pic.blocks[0].lines.length, 2);
  assert.ok(r.table.centered !== true, 'a table keeps the full page');
  assert.ok(r.plain.centered && r.plain.sub === 'The garden'); assert.deepStrictEqual(r.plain.blocks.map(x => x.t), ['sect', 'sect']);
  assert.match(r.preview, /letter-spacing/);
  assert.deepStrictEqual(s.errors, []);
  await s.close();
});

test('a Garden warning sign prints its own words, and a PD card prints its labelled parts', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', 'src', 'garden-ui.js'), 'utf8');
  assert.match(g, /function gdnEntryDoc\(x\)\{return asCard\(gdnEntryDoc0\(x\)\)\}/);
  assert.match(g, /sg\.description/, 'a warning sign reads its description, rule and line');
  const gr = fs.readFileSync(path.join(__dirname, '..', 'src', 'growth-app.js'), 'utf8');
  assert.match(gr, /function cardBlocks\(body\)/);
  assert.match(gr, /x\.kind==="sheet"\?/, 'a sheet keeps the full page, and a card or a sign is centred');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  assert.ok(src.indexOf('function asCard(d,o)') > 0);
  assert.doesNotMatch(src, />\s*Beside\.?\s*</, 'what a work sits beside is called Connected to');
});
