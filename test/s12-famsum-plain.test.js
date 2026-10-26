'use strict';
// The Family Summary reads as plain sentences. Bullets in the educators' notes become sentences, and TREE's own evidence
// notes, such as (a friend took..., Oct 14, 2026), stay with the educators, so no stop is followed by a comma. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('the Family Summary draft has no stop followed by a comma and no evidence notes', async t => {
  const today = new Date().toISOString().slice(0, 10);
  const fx = await start({ more: put => {
    put('children/fern.json', { first: 'Fern', last: 'Test', classroom: 'West', status: 'active', enrollDate: today });
    put('conferences/fern--2026-27-fall.json', { childId: 'fern', schoolYear: '2026-27', term: 'Fall', confDate: '2099-01-01',
      fields: { approaches: 'Very direct.\n- Curious about new things.\n- Persistent', language: 'She shares what she noticed. (Fern found seeds by the creek...., Oct 14, 2026)\nShe tells long stories.' } });
  } });
  t.after(async () => { await fx.stop(); });
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let r = null; for (let i = 0; i < 40; i++) { r = await fx.as(dee, '/api/conf/summary/draft', { id: 'fern--2026-27-fall' }); if (r.status === 200) break; await new Promise(ok => setTimeout(ok, 250)); }
  const A = r.body.familySummary.parts.areas;
  assert.strictEqual(A.approaches, 'Very direct. Curious about new things.');
  assert.strictEqual(A.language, 'She shares what she noticed. She tells long stories.');
  assert.ok(!/[.!?],/.test(JSON.stringify(r.body.familySummary.parts)));
});
