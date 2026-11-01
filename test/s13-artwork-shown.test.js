'use strict';
// Session 13, the artwork on the Artists page. A public domain work has a Picture line and prints large. A work still
// under copyright may have a Shown from line, the museum's or the artist's own image, which shows on the screen straight
// from that site with no referrer and hides itself if the site will not show it. A print reads it only through our server
// (November 1, 2026), and the page never fetches it for a print. Made-up names and made-up addresses only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

const SHOWN = 'https://shown.example.org/work.jpg';
const BLOCKED = 'https://blocked.example.org/work.jpg';
const PIC = 'https://open.example.org/water.jpg';
const ARTISTS = `<!--
library: artists
-->
# Artists

We look together before anyone speaks.

## A painter, Water Study

**Set.** Garden and materials
**Known as.** water study
**Print or link.** Print
**Picture.** ${PIC}
**Link.** [Water Study at a museum](https://open.example.org/water)
**Pairs with.** Water play.
**Wondering.** What shapes do the children see in moving water?
**For the educator.** A note that never prints.

## A sculptor, Wire Forms

**Set.** Garden and materials
**Known as.** wire forms
**Print or link.** Link
**Link.** [Wire Forms at a museum](https://shown.example.org/wire)
**Shown from.** [a museum's site](${SHOWN})
**Pairs with.** Wire and string.
**Wondering.** We wonder how the children find the balance point.
**For the educator.** Another note that never prints.

## A weaver, Quilts

**Set.** Seeing ourselves
**Known as.** quilts
**Print or link.** Link
**Link.** [Quilts at a museum](https://blocked.example.org/quilts)
**Shown from.** [another museum's site](${BLOCKED})
**Pairs with.** Fabric scraps.
**Wondering.** We wonder what pictures the children sew together.
`;

async function page(fx, br, who, pass) {
  const s = await signedIn(fx, br, who, pass, 1100);
  const hits = [];
  await s.p.context().route(/example\.org\//, r => {
    const u = r.request().url(); hits.push({ u, ref: r.request().headers().referer || '' });
    if (u.startsWith('https://blocked.')) return r.fulfill({ status: 403, body: 'no' });
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64') });
  });
  return { s, hits };
}

test('a Shown from image shows on the screen with no referrer, and hides itself when the site will not show it', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => put('staff/library/prompts/artists.md', ARTISTS) });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const { s, hits } = await page(fx, br, 'Ann', '1357');
  await s.p.evaluate(() => goView('artists')); await s.p.waitForSelector('[data-artrow]');
  const cards = await s.p.evaluate(() => artCards().map(c => ({ id: c.id, picture: c.picture, shown: c.shown })));
  assert.deepStrictEqual(cards.find(c => c.id === 'a-sculptor-wire-forms').shown, { from: "a museum's site", src: 'https://shown.example.org/work.jpg' });
  assert.strictEqual(cards.find(c => c.id === 'a-painter-water-study').shown, null, 'a card with a Picture shows its Picture');
  for (const id of ['a-sculptor-wire-forms', 'a-weaver-quilts']) { await s.p.click(`[data-artrow="${id}"] summary`); await wait(300); }
  await wait(1200);
  const shown = await s.p.evaluate(() => [...document.querySelectorAll('figure.art-shown')].map(f => ({ src: f.querySelector('img').getAttribute('src'), ref: f.querySelector('img').getAttribute('referrerpolicy'), hidden: f.hidden, cap: f.textContent })));
  const ok = shown.find(x => x.src === 'https://shown.example.org/work.jpg'), no = shown.find(x => x.src === 'https://blocked.example.org/work.jpg');
  assert.ok(ok && no, JSON.stringify(shown));
  assert.strictEqual(ok.ref, 'no-referrer'); assert.strictEqual(ok.hidden, false);
  assert.match(ok.cap, /Shown from a museum's site\./); assert.doesNotMatch(ok.cap, /never printed/);
  assert.strictEqual(no.hidden, true, 'an image the site will not show hides itself');
  // the link to the exact work stays on the card whose image hid itself
  assert.strictEqual(await s.p.locator('[data-artrow="a-weaver-quilts"] a[href="https://blocked.example.org/quilts"]').count(), 1);
  assert.ok(hits.filter(h => h.u === 'https://shown.example.org/work.jpg').every(h => h.ref === ''), 'no referrer goes to the museum');
  assert.match(await s.p.textContent('[data-artrow="a-sculptor-wire-forms"] summary'), /Prints large, shown from a museum's site/);
  assert.deepStrictEqual(s.errors.filter(e => !/403|Failed to load resource/.test(e)), []);
  await s.close();
});

test('a print reads a Shown from image only through our server, never from the page, and a Picture still prints', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const fx = await start({ more: put => {
    put('staff/library/prompts/artists.md', ARTISTS);
    put('plans/pw.json', { id: 'pw', type: 'individual', weekOf: monday, classroom: 'West', educator: 'Ann', focus: 'area', fields: { area: 'Wire', observation: 'Wire and string.' },
      attached: [{ kind: 'artist', id: 'a-sculptor-wire-forms', title: 'A sculptor, Wire Forms' }, { kind: 'artist', id: 'a-painter-water-study', title: 'A painter, Water Study' }] });
  } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const { s, hits } = await page(fx, br, 'Ann', '1357');
  await s.p.evaluate(() => goView('artists')); await s.p.waitForSelector('[data-artrow]');
  hits.length = 0;
  // every card shown, as a PDF and as a Word copy, with the real photo loading and the file makers caught
  const got = await s.p.evaluate(async () => {
    const out = { pdf: null, word: null };
    window.makePdf = docs => { out.pdf = JSON.stringify(docs); }; window.makeDocx = docs => { out.word = JSON.stringify(docs); };
    for (const w of [false, true]) { const x = document.createElement('button'); x.dataset.artprint = 'all'; if (w) x.dataset.word = '1'; document.body.appendChild(x); x.click(); x.remove();
      for (let i = 0; i < 60 && !(w ? out.word : out.pdf); i++) await new Promise(r => setTimeout(r, 100)); }
    const one = JSON.stringify(artistDoc(artCard('a-sculptor-wire-forms')));
    return Object.assign(out, { one });
  });
  for (const k of ['pdf', 'word', 'one']) {
    assert.ok(got[k], k + ' was made');
    assert.doesNotMatch(got[k], /shown\.example\.org\/work|blocked\.example\.org\/work/, k + ' holds no Shown from image');
    assert.doesNotMatch(got[k], /never prints/, k + ' holds no note for the educator');
  }
  assert.match(got.pdf, /open\.example\.org\/water\.jpg/, 'a Picture still prints');
  assert.ok(!hits.some(h => /shown\.example\.org\/work|blocked\.example\.org\/work/.test(h.u)), 'printing fetched no Shown from image');
  assert.ok(hits.some(h => h.u.startsWith(PIC)), 'printing fetched the Picture');
  // the plan's own print, with both artists attached
  await s.p.evaluate(id => { const x = document.createElement('button'); x.dataset.open = id; document.body.appendChild(x); x.click(); x.remove(); }, 'pw');
  await wait(800); hits.length = 0;
  const plan = await s.p.evaluate(async () => { let got = null; const real = window.loadPhotos;
    window.loadPhotos = async (docs, q) => { got = JSON.stringify(docs); return real(docs, q); }; window.makePdf = () => {};
    const x = document.createElement('button'); x.id = 'dl'; document.body.appendChild(x); x.click(); x.remove();
    for (let i = 0; i < 60 && !got; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 600)); return got; });
  assert.ok(plan, 'the plan print ran');
  assert.doesNotMatch(plan, /shown\.example\.org\/work/);
  assert.match(plan, /open\.example\.org\/water\.jpg/);
  assert.ok(!hits.some(h => /shown\.example\.org\/work/.test(h.u)), 'the plan print fetched no Shown from image');
  await s.close();
});
