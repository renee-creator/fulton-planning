'use strict';
/* Play schemas, November 17, 2026. Positioning and orientation join the Idea bank needs with a card each, The Study of
   Play gains a visual of the nine schemas, the Readings gain three pieces on schemas, and the PD library gains the
   Resource shelf that gathers every printable and reading in one place. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const fx = require('./fixture.js');
const ROOT = path.join(__dirname, '..');
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'once', 's73-play-schemas.json'), 'utf8'));
const NEW = ['Lining up and arranging (positioning schema)', 'Seeing from new angles (orientation schema)'];

test('the needs list and the inquiry words hold positioning and orientation', () => {
  const ib = fs.readFileSync(path.join(ROOT, 'ideabank.js'), 'utf8'), sv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  for (const n of NEW) { assert.ok(ib.includes(`'${n}'`), n); assert.ok(sv.includes(`'${n}': [`), n); }
});

test('the new cards feed only known needs and keep our writing rules', () => {
  const ib = fs.readFileSync(path.join(ROOT, 'ideabank.js'), 'utf8');
  const needs = eval(ib.match(/const NEEDS = (\[[^\]]*\]);/)[1]), sup = eval(ib.match(/const SUPPORTS = (\[[^\]]*\]);/)[1]);
  const cards = LIST.changes.filter(c => c.add === 'cards').map(c => c.value);
  assert.strictEqual(cards.length, 2);
  for (const c of cards) {
    for (const n of c.feeds) assert.ok(needs.includes(n), n);
    for (const s of c.supports) assert.ok(sup.includes(s), s);
    const words = JSON.stringify(c);
    assert.doesNotMatch(words, /—|Claude|Fulton/);
  }
  const vis = LIST.changes.find(c => c.path.endsWith('printables/play.md'));
  assert.strictEqual((vis.to.match(/^### /mg) || []).length, 9);
  assert.match(vis.to, /^kind: visual$/m);
  assert.match(vis.to, /Footer\. Adapted from Chris Athey/);
});

test('s73PlaySchemas adds the cards, the visual and the readings once', async () => {
  const anchor = LIST.changes.find(c => c.from).from;
  const f = await fx.start({ env: { ONCE_SKIP: '', ONCE_ONLY: 's73PlaySchemas' }, more: put => {
    put('staff/library/ideabank/cards.json', JSON.stringify({ id: 'ideabank-cards', cards: [], removed: [], sources: [] }));
    put('staff/readings.json', JSON.stringify({ list: [] }));
    put('staff/pd/printables/play.md', '<!--\nmodule: play\n-->\n# Printables for The Study of Play\n\n' + anchor + '\n\nkind: card\nWords.\n');
  } });
  try {
    let ok = false;
    const at = p => path.join(f.dir, p);
    for (let i = 0; i < 60 && !ok; i++) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const c = JSON.parse(fs.readFileSync(at('staff/library/ideabank/cards.json'), 'utf8')), r = JSON.parse(fs.readFileSync(at('staff/readings.json'), 'utf8'));
        ok = c.cards.length === 2 && r.list.length === 3 && fs.readFileSync(at('staff/pd/printables/play.md'), 'utf8').includes('## Play schemas, the patterns children repeat');
      } catch (e) {}
    }
    assert.ok(ok, 'the two cards, the three readings and the visual are in place');
    assert.strictEqual(fs.readFileSync(at('staff/pd/printables/play.md'), 'utf8').split('## Play schemas').length, 2);
  } finally { await f.stop(); }
});

test('the PD library shows the Resource shelf above the Readings', () => {
  const g = fs.readFileSync(path.join(ROOT, 'src', 'growth-app.js'), 'utf8'), s = fs.readFileSync(path.join(ROOT, 'src', 'staff-app.js'), 'utf8');
  assert.match(g, /Gr\.shelfHtml=async function/);
  assert.match(s, /TreeGrowth\.shelfHtml\(\):""\)\+\(window\.TreeGrowth&&TreeGrowth\.readingsHtml/);
  assert.ok(fs.readFileSync(path.join(ROOT, 'tree-staff.js'), 'utf8').includes('Resource shelf'), 'the built file holds the shelf');
});
