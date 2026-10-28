'use strict';
// Session 13, the Garden's field guide card. It prints as a grid of photos, two across, each tile the entry's own Garden
// photo with its name beneath, the title at the top and the closing line under the grid. Six fit on a page and more go on
// to a page marked continued. An entry with no photo has a soft tile with its name in it. The PDF, the preview and the
// Word copy are drawn from the same layout. Made-up creatures and made-up addresses only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const JPG = fs.readFileSync(path.join(__dirname, 'fixtures-standin.jpg'));

test('a field guide card prints a photo grid, two across, six to a page, with soft tiles for entries with no photo', async t => {
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
    const L1 = lay(docs[0]), L2 = lay(docs[1]), LS = lay(small[0]);
    const imgs = L => L.ops.filter(o => o.t === 'img' && o.grid), soft = L => L.ops.filter(o => o.t === 'rect' && o.r === 8);
    const texts = L => L.ops.filter(o => o.t === 'text').map(o => o.txt);
    const inPage = L => L.ops.every(o => (o.y === undefined || (o.y >= 0 && o.y + (o.h || 0) <= L.PH - 44)));
    const blob = await makeDocx(docs, 'Field guide.docx', 'quiet');
    return {
      titles: docs.map(d => d.title), n: docs.map(d => d.blocks.find(x => x.t === 'grid').tiles.length), card: docs.every(d => d.centered && d.card),
      imgs1: imgs(L1).length, tileH: Math.round((imgs(L1)[0] || {}).h || 0), soft1: soft(L1).length, cols1: [...new Set(imgs(L1).map(o => Math.round(o.x)))].length,
      sameFrame: new Set(imgs(L1).map(o => Math.round(o.w) + 'x' + Math.round(o.h))).size,
      texts1: texts(L1), textsS: texts(LS), in1: inPage(L1), in2: inPage(L2), over1: L1.over,
      imgs2: imgs(L2).length, soft2: soft(L2).length,
      preview: cPreview(cReady(docs[0])), word: blob ? blob.size : 0,
      sets: gdnSetDocs ? true : false
    };
  });
  assert.deepStrictEqual(r.titles, ['Who we might see in the log yard', 'Who we might see in the log yard, continued']);
  assert.deepStrictEqual(r.n, [6, 6]);
  assert.ok(r.card, 'the pages are centred cards');
  // six tiles on the first page, two across, every photo in the same frame, and the entry without a photo as a soft tile
  assert.strictEqual(r.imgs1 + r.soft1, 6); assert.strictEqual(r.soft1, 1); assert.strictEqual(r.cols1, 2); assert.strictEqual(r.sameFrame, 1);
  assert.strictEqual(r.imgs2 + r.soft2, 6);
  for (let i = 1; i <= 6; i++) assert.ok(r.texts1.includes('Creature ' + i), 'each tile names its entry');
  assert.ok(r.texts1.includes('We look with our eyes and leave them be.'));
  // each credit sits under its photo, and the photos are taller than a wide strip
  assert.ok(r.texts1.some(x => /^Photo by An observer/.test(x)) && !r.texts1.some(x => /^Photos\. /.test(x)));
  assert.ok(r.tileH >= 120, 'the photos are tall enough to see the whole creature, ' + r.tileH);
  assert.ok(r.textsS.some(x => /^Photo by An observer, CC BY, iNaturalist$/.test(x)));
  assert.ok(r.in1 && r.in2, 'everything stays above the footer'); assert.strictEqual(r.over1, false);
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
