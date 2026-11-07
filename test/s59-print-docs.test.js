'use strict';
// Documentation and family prints. Wall sheets hold about three quotes at a readable size and carry the rest on, with no
// doubled quote marks, no quote twice and no titles made from a date. An empty slide does not print. A curriculum web's
// branches keep their whole names, with the three boxes under the web, and the blank form's hint is not an answer. The
// newsletter's calendar titles read plainly, the impact story says twice, a farm card thanks a bin for the bins, a cut
// never ends on a child's initial, a moment does not repeat its title, near-duplicate portfolio pieces share a page and
// TREE's story titles write class in lowercase. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('documentation and family prints', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(async () => {
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf');
    await lazyLoad('newsletter', 'test');
    const q = (name, words) => ({ name, words });
    const x = { id: 'px', name: 'Pond Days', home: 'West', wall: { names: 'first', sheets: [
      { id: 's1', kind: 'moment', title: 'The October 28', include: true, photos: [], text: '',
        quotes: [q('Wren', '“Once upon a time a frog sat down!”'), q('Ada', '"The frog jumped."'), q('Wren', 'Once upon a time a frog sat down!'), q('Bo', 'It was green'), q('Cy', 'It hopped away'), q('Di', 'Bye frog')] }] } };
    const docs = wallDocs(x); const ready = await wallReadyDocs(x);
    const quotes = docs.flatMap(d => d.blocks.filter(b => b.t === 'quote').map(b => b.words));
    const slide = { id: 'sl', title: '', text: '', quotes: [], photos: [], momentIds: [] };
    const web = { focus: 'Water', branches: [{ name: 'Working together and discussing things in small groups', materials: 'cups' }, { name: 'Pouring', materials: '' }, { name: 'Floating', materials: '' }], connections: [], languages: ['Clay'], questions: 'What floats?', environment: '' };
    const plan = { type: 'classroom', weekOf: '2026-11-02', classroom: 'West', fields: { observation: 'Words.' }, web };
    const pb = planBlocks(plan).map(b => b.t);
    const doc = planDoc({ unit: 'pt', format: 'letter' }); const wl = webBranchLines(doc, web.branches[0], false, 150);
    const blank = planBlocks0({ type: 'individual', blank: true })[0].cols[0];
    const mom = momentDoc({ id: 'n1', at: Date.now(), classroom: 'West', noticed: 'Frog songs\nFrog songs\nWe sang about frogs.', photo: { w: 4, h: 3 } }, 'first');
    return {
      n: docs.length, titles: docs.map(d => d.title), perSheet: docs.map(d => d.blocks.filter(b => b.t === 'quote').length), quotes,
      readyOver: ready.docs.length >= docs.length, bare: slideBare(slide),
      pb, nameLines: wl.nl.join(' '), hint: blank.hint, text: blank.text,
      coming: nlComing('Thanksgiving Break-School Closed') + '|' + nlComing('Professional Development Day-School Closed') + '|' + nlComing('Back-to-school night'),
      twice: timesWord(2), once: timesWord(1), seven: timesWord(7),
      bin: thanksFood("FEED Bin - 'Ohana / Large"), star: thanksFood('maitake frondosa * hen of the woods'),
      cut: sentCut('Adeline and P. sang about frogs and then P.', 200),
      momFirst: mom.blocks[0].text, cls: classCase('Ellie and the North Class'), poster: !!TREE_KIT.SIZES.poster
    };
  });
  assert.strictEqual(r.titles[0], 'Pond Days', 'a date title gives way to a real one');
  assert.ok(r.titles.slice(1).every(x => /, continued$/.test(x)));
  assert.ok(r.perSheet.every(k => k <= 3), 'about three quotes a sheet');
  assert.strictEqual(r.quotes.length, 5, 'the same quote is not printed twice');
  assert.ok(r.quotes.every(w => !/^["“]|["”]$/.test(w)), 'no doubled quote marks');
  assert.ok(r.readyOver); assert.strictEqual(r.bare, true);
  assert.deepStrictEqual(r.pb.slice(-2), ['web', 'cols'], 'the three boxes sit under the web');
  assert.match(r.nameLines, /small groups$/, 'the branch keeps its whole name');
  assert.strictEqual(r.text, ''); assert.strictEqual(r.hint, 'Small group or classroom area');
  assert.strictEqual(r.coming, 'Thanksgiving Break, school closed|Professional Development Day, school closed|Back-to-school night');
  assert.strictEqual(r.twice, 'twice'); assert.strictEqual(r.once, 'once'); assert.strictEqual(r.seven, '7 times');
  assert.strictEqual(r.bin, 'weekly produce bins'); assert.strictEqual(r.star, 'maitake frondosas');
  assert.ok(!/ P\.$/.test(r.cut), 'a cut never ends on an initial');
  assert.strictEqual(r.momFirst, 'We sang about frogs.', 'the title is not printed again');
  assert.strictEqual(r.cls, 'Ellie and the North class'); assert.ok(r.poster);
  assert.deepStrictEqual(s.errors, []);
});
