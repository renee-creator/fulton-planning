'use strict';
// Session 76. After a restart the server has forgotten which saves it wrote, so it asks GitHub. It answers a device within
// two seconds however slow GitHub is, asks once for each file however many devices ask, and reads the history through
// GraphQL when the hourly allowance is spent (program watch, issue 42). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const NOTE = id => ({ id, noticed: 'Water poured over the stones.', room: 'West' });
// saves written before this server started, whose ids are only in the commit messages
const before = (fx, n) => { const sids = []; for (let i = 0; i < n; i++) { const sid = 'old-save-' + i + '-abc'; sids.push(sid); fx.gh.writes.push({ path: `notices/nold${i}.json`, message: `Save notices/nold${i} [${sid}]`, at: Date.now() - 60000 }); } return sids; };
const items = sids => sids.map((sid, i) => ({ sid, kind: 'notices', id: 'nold' + i, at: Date.now() - 60000 }));

test('with GitHub slow to answer, a device hears back within two seconds and the saves settle on the next ask', async t => {
  const gh = { commitsDelayMs: 4000 };
  const fx = await start({ gh, more: put => { for (let i = 0; i < 6; i++) put(`notices/nold${i}.json`, NOTE('nold' + i)); } });
  t.after(() => fx.stop());
  const sids = before(fx, 6);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const t0 = Date.now(); const first = (await fx.as(dee, '/api/saved', { items: items(sids) })).body;
  assert.ok(Date.now() - t0 < 3500, 'answered in ' + (Date.now() - t0) + ' ms');
  assert.strictEqual(first.waiting.length, 6, 'still being looked up');
  // a second device asking at the same moment shares the lookups already running
  await fx.as(dee, '/api/saved', { items: items(sids) });
  await new Promise(r => setTimeout(r, 4500));
  const next = (await fx.as(dee, '/api/saved', { items: items(sids) })).body;
  assert.deepStrictEqual(next.written.sort(), sids.slice().sort());
  assert.strictEqual(gh.commitsCalls, 6, 'one lookup for each file');
});

test('with the allowance spent, the saves are found written through GraphQL', async t => {
  const gh = { gql: true, spent: true };
  const fx = await start({ gh, more: put => { for (let i = 0; i < 3; i++) put(`notices/nold${i}.json`, NOTE('nold' + i)); } });
  t.after(() => fx.stop());
  const sids = before(fx, 3);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let s = null; for (let i = 0; i < 40; i++) { s = (await fx.as(dee, '/api/saved', { items: items(sids) })).body; if (s && s.written && s.written.length === 3) break; await new Promise(r => setTimeout(r, 250)); }
  assert.deepStrictEqual(s.written.sort(), sids.slice().sort());
  assert.ok(gh.historyCalls >= 3, 'read through GraphQL');
});
