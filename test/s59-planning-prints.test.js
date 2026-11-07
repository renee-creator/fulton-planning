'use strict';
// The planning resources prints, November 7, 2026. A full plant page is one plant to a page with its year in short labeled
// lines; an animal card keeps to one page with its words in columns and the health rule once; a tracks card prints Tracks
// and Scat once; a sign with no photo prints in large type; the season sheet groups plants that share one action and reads
// as sentences; an Idea bank home card fits one page and its ways to try it carry bullets; a long read-aloud is set large
// with its pages as paragraphs; a food exploration has a short one-page version; an artist card with no picture keeps
// its words near the top; a reading guide never prints "I notice" alone; places print short link text; and the
// demonstration sheets break only between whole words. Made-up plants, animals and places only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('the planning resources prints keep to their pages and read as sentences', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(async () => {
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf'); await loadPrintFonts();
    const care = (id, m, text, stage) => ({ id, month: m, text, stage });
    gdn = Object.assign({}, gdn || {}, { photos: [], seeds: [], beds: [{ id: 'b1', name: 'The raised beds' }],
      plants: [
        { id: 'p1', common: 'Plum', botanical: 'Prunus domestica', bed: 'b1', photo: { url: 'https://photos.example.org/p.jpg', by: 'A. Observer', license: 'CC BY', source: 'iNaturalist' }, eat: 'food', uses: ['Food'], ready: ['07'], words: { child: 'Plums grow here.', adult: 'A plum tree.. To confirm.' },
          care: [care('a', '01', 'Prune while the tree is bare', 'tend'), care('b', '06', 'Water deeply in dry weeks', 'tend'), care('c', '09', 'Water deeply in dry weeks', 'tend'), care('d', '07', 'Harvest the ripe fruit', 'harvest')] },
        { id: 'p2', common: 'Apricot', eat: 'food', uses: ['Food'], ready: ['09'], care: [care('e', '09', 'Water deeply in dry weeks', 'tend')] },
        { id: 'p3', common: 'Carrots', eat: 'food', uses: ['Food'], ready: [], care: [care('f', '09', 'Sow carrot seed', 'plant')] },
        { id: 'p4', common: 'Beets', eat: 'food', uses: ['Food'], ready: [], care: [care('g', '10', 'Sow beet seed', 'plant')] },
        { id: 'p5', common: 'Mullein', eat: 'look', uses: ['Pollinator', "Look, don't eat"], ready: ['10'], care: [] },
        { id: 'p6', common: 'Roses', eat: 'partly', uses: ['Pollinator', 'Partly edible'], ready: ['10'], care: [] }],
      animals: [{ id: 'a1', name: 'Our tortoise', vocab: ['shell', 'scute', 'reptile', 'burrow', 'claw', 'hatchling', 'carapace', 'plastron', 'brumation'], health: 'We feed him and never touch him.',
        card: { title: 'Tortoise', know: 'Tortoises have claws.', wonder: 'How many claws?', family: 'male · female · hatchling', rule: 'We feed and watch him, and we do not touch him.' } }],
      wild: [{ id: 'w1', kind: 'track', name: 'Raccoon', know: 'Tracks. Five long toes. Scat. Tube shaped.', tracks: 'Five long toes.', scat: 'Tube shaped.', sign: { warning: 'We look from far away.' } }],
      signs: [{ id: 's1', kind: 'shoes', title: 'Shoes on, Hall', place: 'The hallway', question: 'Where are your feet taking you next?' }],
      library: { 'season-fall': { lead: '', parts: [{ key: 'What we preserve', text: '- Lemon balm, dried. California sage is Look, don\'t eat, so it stays out of the tea.' }] } },
      plan: { months: {} }, seasons: [{ key: 'fall', name: 'Fall', months: ['09', '10', '11'] }] });
    const full = gdnGuideDoc('adults', 'p1,p2');
    const plum = full[0], rows = plum.blocks.find(x => x.t === 'table');
    const animal = gdnEntryDoc(gdn.animals[0]), track = gdnEntryDoc(gdn.wild[0]), shoes = gdnEntryDoc(gdn.signs[0]);
    const doc = planDoc({ unit: 'pt', format: 'letter' }), F = d => cFlow(doc, cReady(d), accOf(d.acc) || ACC.story);
    const animalF = F(animal), shoesF = F(shoes);
    const season = Object.fromEntries(gdnSeason(gdn.seasons[0]).sections);
    // the read-aloud, the exploration, a book, a place
    const long = Array.from({ length: 14 }, (_, i) => '### Page ' + (i + 1) + '\n\n' + 'The little fox walked along the long path by the creek and looked at every stone. '.repeat(4)).join('\n\n');
    const ra = readTextDoc({ title: 'A long walk', parts: [{ key: 'Text', text: long }] });
    const expl = { id: 'e1', title: 'Which part might we eat?', parts: [{ key: 'What we wonder', text: '- I wonder one.\n- I wonder two.\n- I wonder three.\n- I wonder four.' }, { key: 'How we explore it', text: Array.from({ length: 10 }, (_, i) => '- Step ' + (i + 1) + ' is here. It has more words after.').join('\n') }] };
    const short = explShortDoc(expl), bookG = bookGuideLines('- I notice\n- I wonder how the dog feels.'), bookG2 = bookGuideLines('- I notice\n- the red ball.');
    return {
      perPlant: full.map(d => d.title), onePage: full.every(d => d.onePage), rows: rows.rows, noDouble: !JSON.stringify(plum).includes('..'),
      photoW: (plum.blocks.find(x => x.t === 'photo') || {}).maxW || 0,
      animalPages: animalF.pages.length, animalHealth: JSON.stringify(animal).split('do not touch').length - 1 + JSON.stringify(animal).split('never touch').length - 1,
      wordsCols: (animal.blocks.find(x => x.label === 'Words') || {}).cols, family: animal.blocks.some(x => x.t === 'small' && /hatchling/.test((x.lines || []).join())),
      trackText: JSON.stringify(track.blocks), shoesBig: !!shoes.bigType, shoesScale: shoesF.pages[0].s,
      season, ra: { big: ra.blocks.every(x => x.big && x.para), n: ra.blocks.length, pages: (() => { const d = planDoc({ unit: 'pt', format: 'letter' }); drawAny(d, ra, {}); return d.getNumberOfPages(); })() },
      short: { one: short.onePage, steps: short.blocks.find(x => x.label === 'How we explore it').items.length }, bookG, bookG2,
      url: mqShortUrl('https://parks.ca.gov/?lang=en&page_id=479')
    };
  });
  assert.deepStrictEqual(r.perPlant, ['Plum', 'Apricot'], 'one full plant page for each plant');
  assert.ok(r.onePage); assert.ok(r.noDouble, 'no double periods'); assert.ok(r.photoW >= 260, 'the photo is about 260 points wide');
  assert.deepStrictEqual(r.rows, [['Grows in', 'The raised beds'], ['Uses', 'Food'], ['Tend', 'Prune while the tree is bare, January\nWater deeply in dry weeks, June and September'], ['Harvest', 'Harvest the ripe fruit, July']]);
  assert.strictEqual(r.animalPages, 1, 'an animal card keeps to one page');
  assert.strictEqual(r.animalHealth, 1, 'the health rule prints once'); assert.strictEqual(r.wordsCols, 3); assert.ok(r.family, 'the family words are a small line');
  assert.doesNotMatch(r.trackText, /Tracks\. Five/, 'the run-on paragraph is left out'); assert.match(r.trackText, /"Tracks"/); assert.match(r.trackText, /far away/);
  assert.ok(r.shoesBig); assert.ok(r.shoesScale >= 2, 'a sign with no photo is set large, ' + r.shoesScale);
  assert.ok(r.season['What we plant'].includes('Sow seed of carrots and beets'));
  assert.ok(r.season['What we tend'].includes('Water deeply in dry weeks for the plum and apricot'));
  assert.ok(r.season['What we harvest'].includes('Apricot'));
  assert.ok(r.season['What we harvest'].includes('Mullein, in flower for the pollinators'));
  assert.ok(r.season['What we harvest'].includes('Roses, partly edible, the part an adult names'));
  assert.ok(!JSON.stringify(r.season).includes('to gather for'), 'no "to gather for pollinator"');
  assert.ok(r.season['What we preserve'].some(x => /is for looking only/.test(x)));
  assert.ok(r.ra.big && r.ra.n === 14 && r.ra.pages >= 2, 'a long story is set large, its pages as paragraphs');
  assert.ok(r.short.one && r.short.steps === 6);
  assert.deepStrictEqual(r.bookG, ['I wonder how the dog feels.'], 'a bare I notice is left out');
  assert.deepStrictEqual(r.bookG2, ['I notice the red ball.'], 'a bare I notice joins the line after');
  assert.strictEqual(r.url, 'parks.ca.gov');
  assert.deepStrictEqual(s.errors, []);
});

test('an Idea bank card that fits prints centred, one that does not prints left aligned on one page, with bullets', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(async () => {
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf'); await loadPrintFonts();
    const sec = (h, items) => ({ h, items });
    const mk = n => ({ id: 'x', title: 'Paint', type: 'medium', home: { title: 'Paint at Home', sections: [
      { h: 'About this material', style: 'text', text: 'Paint is pigment in a binder. '.repeat(12) },
      sec('Ways to try it', Array.from({ length: n }, (_, i) => 'Try way number ' + (i + 1) + ' with a brush and water and see what happens on the paper.')),
      sec("Your child's role", ['Your child fills the cups and rinses the brush.']), sec('Wonder together', ['Where will the color go?']),
      { h: 'What your child is learning', style: 'text', text: 'How water and color move, and how to care for tools.' }] } });
    const small = ibDoc(mk(4), 'home'), big = ibDoc(mk(30), 'home');
    const pages = d => { const doc = planDoc({ unit: 'pt', format: 'letter' }); drawAny(doc, d, {}); return doc.getNumberOfPages(); };
    const about = small.blocks.find(x => x.label === 'About this material');
    return { smallCentered: !!small.centered, smallPages: pages(small), bigCentered: !!big.centered, bullets: !!small.blocks.find(x => x.label === 'Ways to try it').bullets,
      aboutLen: String((about && about.text) || '').length };
  });
  assert.ok(r.smallCentered); assert.strictEqual(r.smallPages, 1); assert.ok(r.bullets, 'ways to try it carry bullets');
  assert.ok(r.aboutLen <= 262, 'About this material is kept short on paper, ' + r.aboutLen);
  assert.strictEqual(r.bigCentered, false, 'a card longer than a page prints left aligned');
  assert.deepStrictEqual(s.errors, []);
});

test('a demonstration sheet breaks only between whole words, and can print two steps to a page', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(async () => {
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf'); await loadPrintFonts();
    const doc = TREE_KIT.pdf({ size: 'letter' }); try { doc.setFont('pfB', 'normal'); } catch (e) {}
    const w = demoWrap(doc, '1 teaspoon cinnamon', 110, 34, 12, 3);
    return { lines: w.lines, size: w.size, two: typeof demoTwoPdf === 'function', };
  });
  assert.ok(r.lines.every(l => ['1', 'teaspoon', 'cinnamon', '1 teaspoon'].includes(l.trim())), 'whole words only, ' + JSON.stringify(r.lines));
  assert.ok(r.size < 34, 'the type is set smaller to fit the longest word');
  assert.ok(r.two);
  assert.deepStrictEqual(s.errors, []);
});
