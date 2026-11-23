'use strict';
// November 23, 2026. Organize a Swap joins the job cards beside Sort the Lost and Found, and Sort the Lost and Found ends
// by leaving the front tidy, its words before kept in its history. The step runs once and never adds a second card.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

test('Organize a Swap is added once, and Sort the Lost and Found leaves the front tidy', async t => {
  const fx = await start({ env: { ONCE_SKIP: '' } }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let v; for (let i = 0; i < 100; i++) { v = (await fx.as(dee, '/api/staff/volunteer', {})).body; if (v && v.jobs && v.jobs.some(j => j.title === 'Organize a Swap')) break; await wait(200); }
  const swaps = v.jobs.filter(j => j.title === 'Organize a Swap'); assert.strictEqual(swaps.length, 1);
  const sw = swaps[0], lf = v.jobs.find(j => j.title === 'Sort the Lost and Found');
  assert.strictEqual(sw.group, lf.group, 'beside Sort the Lost and Found'); assert.strictEqual(sw.type, 'scheduled'); assert.strictEqual(sw.status, 'active');
  assert.strictEqual(sw.directions.length, 7); assert.match(sw.directions[0], /clothing, books or materials/);
  assert.match(sw.done_when, /ready to donate/);
  assert.strictEqual(lf.directions.slice(-1)[0], 'Leave the front lost and found tidy, with clothing folded and in view so families can find it.');
  const h = (await fx.as(dee, '/api/staff/page', { path: v.paths.jobs, item: lf.id })).body;
  assert.strictEqual(h.history.length, 1); assert.doesNotMatch(h.history[0].text, /front lost and found tidy/, 'the words before are kept');
  assert.doesNotMatch(JSON.stringify([sw, lf.directions]), /[—–]|\bteacher|\bClaude\b/);
});
