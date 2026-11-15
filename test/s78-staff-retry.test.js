'use strict';
/* When the educator records cannot be read at a start, the server tries again by itself when the wait is over, with no
   request to start it, so /ready turns to ready and a deploy finishes (program watch, issue 39). Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start } = require('./fixture.js');

const ready = api => new Promise(ok => http.get(api + '/ready', r => { r.resume(); ok(r.statusCode); }).on('error', () => ok(0)));

test('the educator records are read again by themselves after a failed start, and /ready turns to ready', async t => {
  const gh = { gql: true, spent: true, gqlFailStaffOnce: true };
  const fx = await start({ gh, env: { STAFF_RETRY_MS: '1500' } });
  t.after(() => fx.stop());
  let st = 0; for (let i = 0; i < 80; i++) { st = await ready(fx.api); if (st === 200) break; await new Promise(r => setTimeout(r, 250)); }
  assert.ok(gh.staffFailed, 'the first read was refused');
  assert.strictEqual(st, 200, '/ready turned to 200 with only /ready asked');
});
