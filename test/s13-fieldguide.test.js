'use strict';
// Session 13, the Garden's field guide card. It prints as a grid of photos, two across, each tile the entry's own Garden
// photo with its name beneath, the title at the top and the closing line under the grid. A yard's card keeps to one page of
// six, those with a photo chosen first. An entry with no photo has a soft tile with its name in it. The PDF, the preview and the
// Word copy are drawn from the same layout. Made-up creatures and made-up addresses only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const JPG = fs.readFileSync(path.join(__dirname, 'fixtures-standin.jpg'));

test('a field guide card prints a photo grid, two across, six on one page, with soft tiles for entries with no photo', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({});
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100);
  await s.p.context().route(/photos\.example\.org\//, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: JPG }));
  const r = await s.p.evaluate(async () => {
    const wild = Array.from({ length: 12 }, (_, i) => ({ id: 'w' + i, kind: 'wildlife', name: 'Creature ' + (i + 1),
      photo: i % 4 === 3 ? null : { url: 'https://photos.example.org/w' + i + '.jpg', by: 'An observer', license: 'CC BY', source: 'iNaturalist' } }));
    gdn = { ready: true, plants: [], animals: [], signs: [], photos: [], wild,
      fieldGuides: [{ space: 'log', title: 'Log yard', entries: wild.map(w => w.id) }, { space: 'small', title: 'Tire Swing Yard', entries: ['w0', 'w1', 'w3'] }] };
    const docs = gdnFieldDocs('log'), small = gdnFieldDocs('small');
    await loadPhotos([...docs, ...small], true);
    const doc = TREE_KIT.pdf({ unit: 'pt', format: 'letter' });
    const lay = d => cLayout(doc, cReady(d), ACC.story);
    const L1 = lay(docs[0]), LS = lay(small[0]);
    const imgs = L => L.ops.filter(o => o.t === 'img' && o.grid), soft = L => L.ops.filter(o => o.t === 'rect' && o.r === 8);
    const texts = L => L.ops.filter(o => o.t === 'text').map(o => o.txt);
    const inPage = L => L.ops.every(o => (o.y === undefined || (o.y >= 0 && o.y + (o.h || 0) <= L.PH - 44)));
    const blob = await makeDocx(docs, 'Field guide.docx', 'quiet');
    return {
      titles: docs.map(d => d.title), n: docs.map(d => d.blocks.find(x => x.t === 'grid').tiles.length), card: docs.every(d => d.centered && d.card),
      imgs1: imgs(L1).length, tileH: Math.round((imgs(L1)[0] || {}).h || 0), soft1: soft(L1).length, cols1: [...new Set(imgs(L1).map(o => Math.round(o.x)))].length,
      sameFrame: new Set(imgs(L1).map(o => Math.round(o.w) + 'x' + Math.round(o.h))).size,
      texts1: texts(L1), textsS: texts(LS), in1: inPage(L1), over1: L1.over,
      names1: docs[0].blocks.find(x => x.t === 'grid').tiles.map(x => x.name),
      preview: cPreview(cReady(docs[0])), word: blob ? blob.size : 0,
      sets: gdnSetDocs ? true : false
    };
  });
  assert.deepStrictEqual(r.titles, ['Who we might see in the log yard'], 'one page for a yard');
  assert.deepStrictEqual(r.n, [6]);
  // the six with a photo come first, in the guide's own order
  assert.deepStrictEqual(r.names1, ['Creature 1', 'Creature 2', 'Creature 3', 'Creature 5', 'Creature 6', 'Creature 7']);
  assert.ok(r.card, 'the pages are centred cards');
  // six tiles on the page, two across, every photo in the same frame
  assert.strictEqual(r.imgs1 + r.soft1, 6); assert.strictEqual(r.soft1, 0); assert.strictEqual(r.cols1, 2); assert.strictEqual(r.sameFrame, 1);
  for (const n of r.names1) assert.ok(r.texts1.includes(n), 'each tile names its entry');
  // an entry with no photo is a soft tile with its name in it
  assert.ok(r.textsS.includes('Creature 4'));
  assert.ok(r.texts1.includes('We look with our eyes and leave them be.'));
  // each credit sits under its photo, and the photos are taller than a wide strip
  assert.ok(r.texts1.some(x => /^Photo by An observer/.test(x)) && !r.texts1.some(x => /^Photos\. /.test(x)));
  assert.ok(r.tileH >= 120, 'the photos are tall enough to see the whole creature, ' + r.tileH);
  assert.ok(r.textsS.some(x => /^Photo by An observer, CC BY, iNaturalist$/.test(x)));
  assert.ok(r.in1, 'everything stays above the footer'); assert.strictEqual(r.over1, false);
  assert.match(r.preview, /class="csheet"/);
  assert.ok(r.word > 1000, 'the Word copy is made');
  assert.deepStrictEqual(s.errors, []);
  await s.close();
});

test('the field guide set prints one, some or all, each guide its own pages', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', 'src', 'garden-ui.js'), 'utf8');
  assert.match(g, /items\.flatMap\(x=>x\.field\?gdnFieldDocs\(/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  assert.match(src, /kind==="gfield"\)\{if\(!gdnOk\(\)\)return true;const ds=gdnFieldDocs\(/);
});
