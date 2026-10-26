'use strict';
// Session 12. The educator records are read through GraphQL in batches, so a start spends little of GitHub's hourly
// allowance. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('educator records are read in batches through GraphQL', async t => {
  const gh = { gql: true };
  const fx = await start({ gh, more: put => { for (let i = 0; i < 12; i++) put(`staff/library/recipes/r${i}.md`, `<!--\nlibrary: recipe\nkind: food\nsource: Ours\n-->\n# Recipe ${i}\n\n## Steps\n\n- Wash our hands.\n`); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let L = null; for (let i = 0; i < 40; i++) { L = (await fx.as(dee, '/api/staff/library', {})).body; if (L && (L.recipes || []).length) break; await new Promise(r => setTimeout(r, 250)); }
  assert.strictEqual(L.recipes.length, 12);
  assert.ok(gh.gqlCalls >= 1, 'read through GraphQL');
});

test('with the allowance spent, the calendar and the educator records still load through GraphQL', async t => {
  const gh = { gql: true, spent: true };
  const fx = await start({ gh, more: put => {
    put('calendar/settings/program.json', { calendars: [{ id: 'cal1', name: 'School', color: 'clay' }], spaces: [{ id: 'sp1', name: 'Garden' }], dayStart: 420, dayEnd: 1080, weekends: true });
    put('staff/library/recipes/r0.md', '<!--\nlibrary: recipe\nkind: food\nsource: Ours\n-->\n# Recipe zero\n');
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let L = null; for (let i = 0; i < 40; i++) { L = (await fx.as(dee, '/api/staff/library', {})).body; if (L && (L.recipes || []).length) break; await new Promise(r => setTimeout(r, 250)); }
  assert.strictEqual(L.recipes.length, 1);
});
