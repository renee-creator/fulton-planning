'use strict';
// The demonstration sheets, November 8, 2026. A food shows as the recipe changes it, quarters, then chunks, then cooked,
// and a step that means it without naming it shows it as it is right then. Amounts follow the number of children chosen
// on the recipe, a line for each child is counted out for the group, and the sheets left unticked stay out of the print.
// The last sheet asks who we will share it with. Made-up recipes only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const SAUCE = `<!--\nlibrary: recipe\nkind: food\n-->\n# Pear sauce\n\nA made-up sauce.\n\n## Makes enough for\n\n6 children\n\n## Ingredients\n\n- 6 pears\n- 1/2 cup water\n- 1 teaspoon butter for each child\n\n## Tools\n\n- a soup pot\n\n## Steps\n\n- Wash our hands with soap and water.\n- An adult cuts each pear into quarters.\n- Cut the quarters into chunks.\n- An adult cooks the pears for 20 minutes.\n- Stir them.\n`;

test('a food follows the recipe, amounts follow the children, and chosen sheets print alone', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => put('staff/library/recipes/pear-sauce.md', SAUCE) }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('recipes')); await s.p.waitForFunction(() => libData, null, { timeout: 15000 });
  const r = await s.p.evaluate(async () => {
    const x = libRecipe('pear-sauce');
    const walk = demoFoodWalk(['6 pears', '1/2 cup water'], ['An adult cuts each pear into quarters.', 'Cut the quarters into chunks.', 'An adult cooks the pears for 20 minutes.', 'Stir them.'], x.title).map(w => w.show);
    demoKidsFor['pear-sauce'] = 18;
    const P = await demoPlan(x);
    demoSkipFor['pear-sauce'] = new Set([3, 'done']);
    const L = demoSheetList(x).map(i => i.id);
    return { walk, ings: P.overview.ings.map(i => i.text), kids: P.overview.kids, done: P.done.text + ' ' + P.done.ask, L, can: demoCanCount(x),
      line: demoScaleLine('1 large bunch cilantro', 4.5), tsp: demoScaleLine('1/4 teaspoon salt', 4.5) };
  });
  assert.deepStrictEqual(r.walk, [{ pear: '' }, { pear: 'quarters' }, { pear: 'chunks' }, { pear: 'cooked' }]);
  assert.deepStrictEqual(r.ings, ['18 pears', '1 1/2 cups water', '6 tablespoons butter']);
  assert.strictEqual(r.kids, 'For 18 children');
  assert.strictEqual(r.done, 'We made it. Who will we share it with?');
  assert.deepStrictEqual(r.L, ['need', 1, 2, 3, 4, 5, 'done']);
  assert.ok(r.can);
  assert.strictEqual(r.line, '5 large bunches cilantro');
  assert.strictEqual(r.tsp, '1 1/4 teaspoons salt');
  assert.deepStrictEqual(s.errors, []);
});
