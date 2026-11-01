'use strict';
// A module's slide deck, presented in TREE and as a PowerPoint (November 1, 2026). The slides follow the entry's plan,
// the guiding question opens and closes, chosen photos fill the title and the slides, and an entry's photos are kept
// only in the shapes the deck can use. Made-up names and words only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loaded, call } = require('./harness.js');

const H = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function deckKit() {
  const win = { TreeStaff: { _: { H } } };
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'deck-app.js'), 'utf8'))(win);
  return win.TreeDeck;
}
const MOD = { title: 'Seeds and Stories', sections: [
  { heading: 'Why it matters', body: 'Children plant seeds to learn patience. They watch what grows.\n\nFor educators, the garden is a place to slow down.\n\nThis module is about seeds.' },
  { heading: 'Reading', body: '### Roots first\n\n**Roots grow down.** They hold the plant.\n\n**Shoots grow up.** They reach for light.\n\n### Watching closely\n\nChildren notice small changes. Then they draw them.\n\n![A seedling in a cup.](staff/pd/images/seedling.png)\n\n### Talking together\n\nWe wonder aloud with children.' },
  { heading: 'Try this week', body: 'Plant one seed with a child and draw it each day.' },
  { heading: 'Reflect', body: '- What did a child notice first?\n- What surprised you?' }] };

test('the deck follows the plan, opens and closes with the question, and places the photos', () => {
  const Dk = deckKit();
  const photos = ['a', 'b', 'c', 'd'].map(x => ({ key: 'obs:' + x, cap: 'Photo ' + x }));
  const d = Dk.slidesFor(MOD, { question: 'What is the seed asking of us?', photos, title: 'Seeds and Stories' });
  const k = d.slides.map(s => s.k);
  assert.strictEqual(k[0], 'title'); assert.strictEqual(d.slides[0].photo.key, 'obs:a', 'the first photo fills the title slide');
  assert.strictEqual(d.slides.filter(s => s.k === 'part').length, 7, 'one opener for each part of the template');
  assert.strictEqual(d.slides.filter(s => s.k === 'q').length, 2, 'the question opens and closes');
  assert.strictEqual(k[k.length - 1], 'plus');
  const roots = d.slides.find(s => s.label === 'Roots first');
  assert.deepStrictEqual(roots.points, ['Roots grow down', 'Shoots grow up'], 'bold leads become points that appear one at a time');
  assert.ok(d.slides.some(s => s.k === 'pw' && s.photo.key === 'obs:b'), 'a photo sits beside a key idea');
  assert.deepStrictEqual(d.slides.filter(s => s.k === 'photo').map(s => s.photo.key), ['obs:c', 'obs:d'], 'the rest fill the experience');
  assert.deepStrictEqual(d.slides.filter(s => s.k === 'reflect').map(s => s.text), ['What did a child notice first?', 'What surprised you?'], 'one reflection question per slide');
  assert.ok(!d.slides.some(s => /This module is about/.test(s.phrase || '')), 'the scope line stays off the slides');
  assert.strictEqual(d.credit, 'Fulton Community School');
});

test('an outside deck carries the full name, and a deck with no chosen photos uses the module pictures', () => {
  const Dk = deckKit();
  const d = Dk.slidesFor(MOD, { outside: true, plan: [{ title: 'Key ideas', minutes: 20, do: '' }, { title: 'The experience', minutes: 30, do: 'Walk the garden.' }] });
  assert.strictEqual(d.credit, 'Fulton Community School & Farm');
  assert.ok(!d.slides[0].photo, 'with no chosen photo the title slide is a color');
  assert.ok(d.slides.some(s => s.photo && s.photo.key === 'pic:staff/pd/images/seedling.png'), 'the module picture is used');
  assert.strictEqual(d.slides.filter(s => s.k === 'part').length, 2);
  assert.strictEqual(d.slides[d.slides.length - 1].k, 'plus', 'a plus and delta closes even when the plan has none');
  for (const s of d.slides) assert.ok(Dk._draw(s, d).includes('dk-s'), 'every design draws');
  assert.ok(!Dk._draw(d.slides[0], d).includes('<script'), 'words are escaped');
});

test('an entry keeps its deck photos only in the shapes the deck can use', async () => {
  const h = await loaded([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }]);
  const list = (await call(h.staff, 'Dir', 'pres/list')).body.list; const e = list[0];
  const r = await call(h.staff, 'Dir', 'pres/save', { id: e.id, fields: { deck: { photos: [
    { key: 'obs:p1', thumb: 't1', cap: 'Chalk on the path', w: 1200, h: 800 }, { key: 'obs:p1', cap: 'twice' }, { key: 'pic:staff/pd/images/x.png', cap: 'A picture' },
    { key: 'pic:../secret.png' }, { key: 'https://example.com/a.jpg' }, { key: 'obs:p2', thumb: '../bad', cap: 'x'.repeat(400) }] } } });
  assert.strictEqual(r.status, 200);
  const ph = r.body.deck.photos;
  assert.deepStrictEqual(ph.map(p => p.key), ['obs:p1', 'pic:staff/pd/images/x.png', 'obs:p2'], 'each once, and only a record picture or an observation photo');
  assert.strictEqual(ph[2].thumb, ''); assert.strictEqual(ph[2].cap.length, 200);
});
