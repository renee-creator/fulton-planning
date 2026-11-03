'use strict';
// Produce coming names the dish a food goes into only when the menu names the food or the kitchen chooses the dish, so a
// guess never puts a lemon in apple muffins. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('a dish is named only when the menu names the food or the kitchen chose it', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const r = await s.p.evaluate(() => {
    menus.set('2026-11', { month: '2026-11', days: { '2026-11-03': { am: 'apple cinnamon muffins', lunch: 'beans, brown rice and cheese' }, '2026-11-05': { lunch: 'minestrone soup with potatoes' } } });
    const lemon = { name: 'Meyer lemon', food: 'meyer lemon', farm: 'A Farm' }, onion = { name: 'Yellow onion', food: 'onion', farm: 'A Farm' }, potato = { name: 'Masquerade potato', food: 'potato', farm: 'A Farm' };
    return { lemonNote: kitchenNotes(lemon, '2026-11-02')[0] || '', lemonCooked: kServeText(Object.assign({ serve: { cooked: true } }, lemon), '2026-11-02'),
      onionCooked: kServeText(Object.assign({ serve: { cooked: true } }, onion), '2026-11-02'), potatoCooked: kServeText(Object.assign({ serve: { cooked: true } }, potato), '2026-11-02'),
      chosen: kServeText(Object.assign({ serve: { cooked: true, dish: 'Tue snack apple cinnamon muffins' } }, lemon), '2026-11-02'),
      pick: kDishPick(Object.assign({ serve: { cooked: true } }, lemon), '2026-11-02') };
  });
  assert.doesNotMatch(r.lemonNote, /muffin/i); assert.strictEqual(r.lemonCooked, 'Cooked in'); assert.strictEqual(r.onionCooked, 'Cooked in');
  assert.match(r.potatoCooked, /^Cooked in, Thu lunch minestrone soup/i, 'the menu names potatoes');
  assert.strictEqual(r.chosen, 'Cooked in, Tue snack apple cinnamon muffins');
  assert.match(r.pick, /Which dish/); assert.match(r.pick, /Tue snack apple cinnamon muffins/); assert.match(r.pick, /Tue lunch beans/);
  assert.deepStrictEqual(s.errors, []);
});
