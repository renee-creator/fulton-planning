'use strict';
// Session 75. When GitHub gives up on a large GraphQL request with a 504, a start lists each folder on its own and reads
// the records in smaller batches, so the server still becomes ready (program watch, issue 42). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start } = require('./fixture.js');

const ready = api => new Promise(ok => http.get(api + '/ready', r => { r.resume(); ok(r.statusCode); }).on('error', () => ok(0)));

test('with the allowance spent and GitHub refusing large GraphQL requests, the records still load and /ready answers', async t => {
  const gh = { gql: true, spent: true, gqlWideOver: 3, gqlBatchOver: 20 };
  const fx = await start({ gh, more: put => {
    for (let i = 0; i < 30; i++) put(`plans/p${i}.json`, { id: 'p' + i, title: 'Plan ' + i, room: 'West' });
  } });
  t.after(() => fx.stop());
  let st = 0; for (let i = 0; i < 120; i++) { st = await ready(fx.api); if (st === 200) break; await new Promise(r => setTimeout(r, 250)); }
  assert.strictEqual(st, 200, '/ready turned to 200');
  assert.ok(gh.gql504 >= 2, 'the large listing and the large batch were both refused');
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const d = (await fx.as(dee, '/api/data', {})).body;
  const plans = Object.keys((d && (d.plans || (d.data || {}).plans)) || {});
  assert.ok(plans.length >= 30, 'every plan was read, found ' + plans.length);
});
