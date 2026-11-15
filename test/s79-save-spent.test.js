'use strict';
/* A save GitHub refuses because the file changed there is written on the newest version, even while the hourly allowance
   for ordinary reads is spent, by reading the version through GraphQL. Before, the version was forgotten and the save was
   refused again and again (program watch, issue 39). Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await wait(200); } return false; }

test('with the allowance spent, a save on a file changed on GitHub is written on the newest version', async t => {
  const gh = { gql: true, spent: true };
  const fx = await start({ gh, more: put => put('notices/nsp1.json', { id: 'nsp1', noticed: 'Wren filled the bucket.', wonder: '', classroom: 'West', by: 'Ann', at: Date.now() }) });
  t.after(() => fx.stop());
  const ann = (await fx.login('Ann', '1357')).token;
  let d = null; for (let i = 0; i < 80; i++) { d = (await fx.as(ann, '/api/data', {})).body; if (d && d.notices && d.notices.nsp1) break; await wait(250); }
  // the file changes on GitHub after the server read it, so the server's version is old
  const f = path.join(fx.dir, 'notices/nsp1.json');
  fs.writeFileSync(f, JSON.stringify({ id: 'nsp1', noticed: 'Wren filled the bucket.', wonder: '', classroom: 'West', by: 'Ann', at: Date.now(), place: 'Garden' }, null, 2) + '\n');
  const w = await fx.as(ann, '/api/write', { op: 'update', kind: 'notices', id: 'nsp1', patch: { wonder: 'Maybe she will pour it on the stones.' } });
  assert.strictEqual(w.status, 200);
  assert.ok(await until(() => /pour it on the stones/.test(fs.readFileSync(f, 'utf8')), 20000), 'the save reached GitHub');
  const mine = fx.gh.writes.filter(x => x.path === 'notices/nsp1.json');
  assert.ok(mine.filter(x => x.refused).length <= 2, 'refused at most once or twice, not again and again: ' + mine.filter(x => x.refused).length);
});
