'use strict';
// Every block of writing TREE shows for information is the director's to edit, with its history and Restore, through the
// one Edit. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

async function dee(t, more) {
  const b = await browser(); if (!b) return null;
  const fx = await start({ more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  return { fx, s };
}

test('the food rule, the conference steps and each food exploration open in Edit', async t => {
  const r = await dee(t, put => { put('staff/wording/food-rule.md', '# Our food rule\n\n## Rule\n\nWe taste only what an adult has named edible.\n'); put('staff/wording/conference-prep.md', '# Conference steps\n\n## dates\n\nDates offered\n'); }); if (!r) { t.skip('Playwright is not installed here'); return; }
  const { fx, s } = r;
  const html = await s.p.evaluate(() => releasesHtml());
  assert.match(html, /data-pageedit="staff\/wording\/food-rule\.md"/); assert.match(html, /data-pageedit="staff\/wording\/conference-prep\.md"/);
  const card = await s.p.evaluate(() => recipeCard({ id: 'r1', path: 'staff/library/recipes/r1.md', kind: 'recipe', title: 'Soup', meta: { kind: 'food' }, parts: [] }));
  assert.match(card, /data-pageedit="staff\/wording\/food-rule\.md"/);
  // the server opens each of them in the one Edit
  const tok = (await fx.login('Dee', 'director-pass-1')).token;
  for (const p of ['staff/wording/food-rule.md', 'staff/wording/conference-prep.md']) {
    const o = await fx.as(tok, '/api/staff/page', { path: p });
    assert.strictEqual(o.status, 200, p + ' ' + JSON.stringify(o.body)); assert.ok(JSON.stringify(o.body).includes('food') || JSON.stringify(o.body).includes('onference'), p + ' ' + JSON.stringify(o.body).slice(0, 300));
  }
  assert.deepStrictEqual(s.errors, []);
});
