'use strict';
/* November 7, 2026. Each plant can hold stage photos, blossom, fruit, leaf, and seed or bark, beside its main photo. The
   one-time step s54PlantStages fills them once for a plant that has none, saving a plant keeps them and refuses a list
   that breaks the rules, and the children's plant card carries the row with its words. Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 's54-plant-stages.json'), 'utf8'));
const SKIP = 'starterBooks,s13Review,s14Wording,s15Materials,s17Ages,s18Sensory,s19Pd1,s20Pd2,s21Pd3,s22Pd4,s23Pd5,s24PdFix,s25Training,s26Anchors,s27Visual,s28Never,s29Credit,s30Visuals,s31IndoorPiazza,s32Identity,s33OurLibrary,s34ShelfChecks,s35OnCampus,s36FireVisit,s37FamilyEvenings,s38Toolkits,s39UnicornCafe,s40Piazza,s41PiazzaCafe,s42SimpleInvitations,s43SensoryRecipes,s44FoodRecipes,s45CloseSupervision,s46DriedRecipes,s47Pictures,s48Books,s49PdRefresh,s50PdScreens,s51Citations,s52Wording,s53Paths';
const PH = n => ({ url: `https://example.test/${n}/medium.jpg`, large: `https://example.test/${n}/large.jpg`, by: 'A. Observer', license: 'CC BY', link: `https://example.test/p/${n}`, source: 'iNaturalist' });
const KEPT = [{ stage: 'leaf', label: 'Leaf', photo: PH('kept') }];
const SETUP = { id: 'garden', ready: true, beds: [], plan: { months: {} }, tending: { home: {}, rotations: [] }, agreements: {},
  plants: [{ id: 'p-plum', common: 'Plum', eat: 'food', care: [] }, { id: 'p-fig', common: 'Fig', eat: 'food', care: [], stages: KEPT }, { id: 'p-other', common: 'Mint', eat: 'food', care: [] }] };

test('the step lists plain one-word labels, up to four photos each, every address https, and only fills a plant with none', () => {
  assert.strictEqual(LIST.name, 's54PlantStages'); assert.ok(LIST.changes.length > 30);
  for (const c of LIST.changes) {
    assert.strictEqual(c.path, 'staff/garden/setup.json'); assert.match(c.set, /^plants\[id=p-[a-z0-9-]+\]\.stages$/); assert.strictEqual(c.expect, null);
    assert.ok(c.value.length >= 1 && c.value.length <= 4);
    for (const s of c.value) { assert.match(s.label, /^[A-Z][a-z]+$/); assert.ok(['blossom', 'fruit', 'leaf', 'seed', 'bark'].includes(s.stage));
      for (const k of ['url', 'large', 'link']) assert.match(s.photo[k], /^https:\/\//); assert.ok(s.photo.license); }
  }
  assert.ok(LIST.changes.some(c => c.set === 'plants[id=p-plum].stages'));
  assert.doesNotMatch(LIST.note, /—|Claude/);
});

test('s54PlantStages fills stages once, leaves an edited plant alone, and saving a plant keeps them', async t => {
  const fx = await start({ env: { ONCE_SKIP: SKIP }, more: put => { put('staff/garden/setup.json', SETUP); put('staff/garden/log.json', { id: 'gardenlog' }); } });
  let up = true; t.after(() => up && fx.stop());
  const read = p => JSON.parse(fs.readFileSync(path.join(fx.dir, p), 'utf8'));
  let ok = false; for (let i = 0; i < 80 && !ok; i++) { await wait(250); try { const o = read('settings/once.json'); ok = !!(o.done && o.done.s54PlantStages); } catch (e) {} }
  assert.ok(ok, 'the step ran and was recorded');
  for (let i = 0; i < 40 && !read('staff/garden/setup.json').plants[0].stages; i++) await wait(250);

  await t.test('a plant with no stages is filled, and one the director already changed is left as it was', () => {
    const P = read('staff/garden/setup.json').plants; const plum = P.find(p => p.id === 'p-plum'), fig = P.find(p => p.id === 'p-fig');
    const want = LIST.changes.find(c => c.set === 'plants[id=p-plum].stages').value;
    assert.deepStrictEqual(plum.stages, want);
    assert.deepStrictEqual(fig.stages, KEPT, 'the fig keeps the director\'s own stage photo');
    assert.ok(!P.find(p => p.id === 'p-other').stages, 'a plant not on the list gains nothing');
    assert.strictEqual(P.length, 3, 'a plant on the list that is not here is never made');
  });

  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const G = (p, b) => fx.as(dee, '/api/staff/garden/' + p, b);
  await t.test('saving a plant keeps its stages, and changes them only when sent', async () => {
    let r = await G('plant', { id: 'p-plum', plant: { common: 'Plum', taste: 'Ripe fruit only.' } });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.plants.find(p => p.id === 'p-plum').stages.length, 3, 'a save without stages keeps them');
    const two = [{ stage: 'fruit', label: 'Fruit', photo: PH('b') }, { stage: 'blossom', label: 'Blossom', photo: PH('a') }];
    r = await G('plant', { id: 'p-plum', plant: { stages: two } });
    assert.deepStrictEqual(r.body.plants.find(p => p.id === 'p-plum').stages, two, 'kept in the order sent');
    r = await G('plant', { id: 'p-plum', plant: { stages: [] } }); assert.deepStrictEqual(r.body.plants.find(p => p.id === 'p-plum').stages, []);
  });

  await t.test('more than four, a plain http address, or a long label is refused and changes nothing', async () => {
    await G('plant', { id: 'p-fig', plant: { stages: KEPT } });
    const five = Array.from({ length: 5 }, (_, i) => ({ stage: 'leaf', label: 'Leaf', photo: PH('f' + i) }));
    let r = await G('plant', { id: 'p-fig', plant: { stages: five, common: 'Changed' } }); assert.strictEqual(r.status, 400); assert.match(r.body.error || JSON.stringify(r.body), /four/);
    r = await G('plant', { id: 'p-fig', plant: { stages: [{ stage: 'leaf', label: 'Leaf', photo: Object.assign(PH('x'), { url: 'http://example.test/x.jpg' }) }] } }); assert.strictEqual(r.status, 400); assert.match(JSON.stringify(r.body), /https/);
    r = await G('plant', { id: 'p-fig', plant: { stages: [{ stage: 'leaf', label: 'A very long label for a stage', photo: PH('y') }] } }); assert.strictEqual(r.status, 400);
    const fig = (await fx.as(dee, '/api/staff/garden', {})).body.plants.find(p => p.id === 'p-fig');
    assert.strictEqual(fig.common, 'Fig', 'a refused save changes nothing'); assert.deepStrictEqual(fig.stages, KEPT);
    assert.strictEqual((await fx.as((await fx.login('Ann', '1357')).token, '/api/staff/garden/plant', { id: 'p-fig', plant: { stages: [] } })).status, 403, 'only the director');
  });

  await t.test('a second start changes nothing', async () => {
    await wait(1500); const before = fs.readFileSync(path.join(fx.dir, 'staff/garden/setup.json'), 'utf8');
    assert.match(before, /"stages": \[\]/, 'the plum the director cleared'); await fx.stop(); up = false;
    const again = await start({ dir: fx.dir, env: { ONCE_SKIP: SKIP } });
    try { await wait(3500); assert.ok(!again.gh.writes.some(w => /staff\/garden\/setup\.json/.test(w.path || ''))); assert.strictEqual(fs.readFileSync(path.join(fx.dir, 'staff/garden/setup.json'), 'utf8'), before); }
    finally { await again.stop(); }
  });
});

test('the children\'s plant card and the full plant page carry the stage photos with their words', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(async () => {
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf');
    const ph = (n, by) => ({ url: 'https://example.test/' + n + '/medium.jpg', large: 'https://example.test/' + n + '/large.jpg', by, license: 'CC BY-SA', link: 'https://example.test/p', source: 'iNaturalist' });
    gdn = Object.assign({}, gdn || {}, { photos: [], plants: [{ id: 'p1', common: 'Plum', botanical: 'Prunus domestica', eat: 'food', words: { child: 'Plums grow on this tree in summer.', adult: 'A plum tree.' }, photo: ph('main', 'Ввласенко'),
      stages: [{ stage: 'blossom', label: 'Blossom', photo: ph('a', 'A. Observer') }, { stage: 'fruit', label: 'Fruit', photo: ph('b', 'Георгий Виноградов (Georgy Vinogradov)') }, { stage: 'leaf', label: 'Leaf', photo: ph('c', '葉子') }] }] });
    const card = gdnGuideDoc('children', 'p1')[0], full = gdnGuideDoc('adults', 'p1')[0];
    // the layout, with squares standing in for the photos
    const sq = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(...new Uint8Array(await (await new Promise(ok => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30); c.toBlob(ok, 'image/jpeg'); })).arrayBuffer())));
    for (const k of [card.photos[0].key, ...card.blocks.find(x => x.t === 'stages').tiles.map(x => x.key)]) photoCache.set(k, { url: sq, w: 400, h: 300, bytes: new ArrayBuffer(0) });
    const doc = planDoc({ unit: 'pt', format: 'letter' }); const F = cFlow(doc, cReady(card), accOf(card.acc) || ACC.story);
    return { plantCard: !!card.plantCard, main: card.photos.map(x => x.src), stages: card.blocks.find(x => x.t === 'stages').tiles.map(x => [x.label, x.src]),
      credits: card.blocks.find(x => x.t === 'credits').lines, pages: F.pages.length, over: F.over, lay: F.pages[0].plant,
      fullTypes: full.blocks.map(x => x.t), fullStages: (full.blocks.find(x => x.t === 'stagegrid') || {}).tiles.map(x => x.label) };
  });
  assert.ok(r.plantCard); assert.deepStrictEqual(r.main, ['https://example.test/main/large.jpg'], 'the large photo prints');
  assert.deepStrictEqual(r.stages, [['Blossom', 'https://example.test/a/large.jpg'], ['Fruit', 'https://example.test/b/large.jpg'], ['Leaf', 'https://example.test/c/large.jpg']]);
  assert.deepStrictEqual(r.credits, ['Plum, photo from iNaturalist, CC BY-SA', 'Blossom, photo by A. Observer, CC BY-SA, iNaturalist', 'Fruit, photo by Georgy Vinogradov, CC BY-SA, iNaturalist', 'Leaf, photo from iNaturalist, CC BY-SA']);
  assert.ok(r.credits.every(l => !/by ,|by$/.test(l)), 'no empty by');
  assert.strictEqual(r.pages, 1); assert.strictEqual(r.over, false); assert.strictEqual(r.lay.wordsSize, 20); assert.strictEqual(r.lay.n, 3);
  assert.ok(r.lay.bottom <= r.lay.credTop, 'the words end above the credits');
  assert.ok(r.fullTypes.indexOf('stagegrid') > r.fullTypes.indexOf('photo')); assert.deepStrictEqual(r.fullStages, ['Blossom', 'Fruit', 'Leaf']);
  assert.deepStrictEqual(s.errors, []);
});
