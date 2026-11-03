'use strict';
// Printed cards never drop words. A card with more than fits continues on a page titled continued, the Idea bank prints
// the whole card, the full plant pages carry each plant's photo, and a recipe's own photo shows and prints. Made-up
// names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('cards continue, whole Idea bank cards, plant photos and recipe photos', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(async () => {
    if (!window.jspdf) await TREE_KIT.loadScript(TREE_KIT.LIB.jspdf, 'jspdf');
    const items = Array.from({ length: 60 }, (_, i) => 'A long line of words for item number ' + (i + 1) + ' so the card fills up and keeps going.');
    const card = asCard({ display: true, type: 'report', acc: 'story', title: 'A Long Card', meta: [], blocks: [dText('', 'Opening words.'), dList('Many things', items)] }, { sub: '' });
    const doc = planDoc({ unit: 'pt', format: 'letter' }); const F = cFlow(doc, cReady(card), accOf(card.acc) || ACC.story);
    const lines = F.sheets.flatMap(sh => sh.blocks.flatMap(b => b.lines || []));
    const c = { id: 'x', type: 'medium', group: 'Paint', title: 'A Test Card', summary: 'Sum.', setting: { level: 'Open to all', why: 'Why.' }, feeds: ['Art'], supports: ['Hands'], connected: ['Clay'],
      sections: [{ h: 'Invitations', style: 'list', items: Array.from({ length: 9 }, (_, i) => 'Invitation ' + (i + 1)) }, { h: 'Set it up', style: 'text', text: 'Words.' }] };
    const full = ibFullDoc(c, 'edu');
    const plantsDoc = (() => { gdn = Object.assign({}, gdn || {}, { plants: [{ id: 'p1', common: 'Calendula', botanical: 'Calendula officinalis', eat: 'partly', words: { child: 'Orange.', adult: 'Sows itself.' }, wonder: ['What color?', 'Who visits?'], photo: { url: 'https://example.test/c.jpg', by: 'A. Observer', license: 'CC BY', link: 'https://example.test/p' } }], photos: [] }); return gdnGuideDoc('full'); })();
    const rec = { id: 'r1', title: 'Apple Bake', meta: { photo: 'https://example.test/apple.jpg | Photo by B. Baker, CC0 | https://example.test/f' }, parts: [] };
    return { pages: F.pages.length, titles: F.sheets.map(x => x.title), n: lines.length, over: F.over,
      full: full.blocks.map(b => b.label || ''), fullItems: (full.blocks.find(b => b.label === 'Invitations') || {}).items.length,
      plant: plantsDoc[0].blocks.map(b => b.t), plantCredit: JSON.stringify(plantsDoc[0].blocks).includes('Photo by A. Observer'),
      recHtml: libPhotoHtml(rec), recBlocks: libPhotoBlocks(rec).map(b => b.t) };
  });
  assert.ok(r.pages >= 2, 'it continues'); assert.strictEqual(r.n, 60, 'no item is dropped'); assert.strictEqual(r.over, false);
  assert.match(r.titles[1], /^A Long Card, continued$/);
  assert.deepStrictEqual(r.full.filter(Boolean), ['Open to all', 'Invitations', 'Set it up', 'Feeds', 'Supports', 'Connected to']); assert.strictEqual(r.fullItems, 9);
  assert.ok(r.plant.includes('photo')); assert.ok(r.plantCredit);
  assert.match(r.recHtml, /apple\.jpg[\s\S]*Photo by B\. Baker, CC0/); assert.deepStrictEqual(r.recBlocks, ['photo', 'text']);
  assert.deepStrictEqual(s.errors, []);
});
