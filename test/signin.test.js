'use strict';
// the first sign-in is the educator's first name with an empty passcode, then four numbers of their own. There is no
// start code (the director's choice, October 18 and November 7, 2026). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('a sign-in with no passcode yet is set up with the first name and an empty passcode', async t => {
  const fx = await start({ more: put => put('access/accounts.json', { accounts: [{ name: 'Ann', room: 'West', code: '1357', v: 1 }, { name: 'Cy', code: '', start: '246813', v: 0 }] }) });
  t.after(() => fx.stop());
  const post = async body => (await fetch(fx.api + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web }, body: JSON.stringify(body) }));
  const r = await post({ name: 'Cy', passcode: '' }); assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).setup, true, 'an empty passcode starts the setup');
  assert.strictEqual((await post({ name: 'Cy', newCode: '58', again: '58' })).status, 400, 'four numbers are needed');
  assert.strictEqual((await post({ name: 'Cy', newCode: '5829', again: '5828' })).status, 400, 'typed the same twice');
  const ok = await (await post({ name: 'Cy', newCode: '5829', again: '5829' })).json(); assert.ok(ok.token);
  assert.strictEqual((await post({ name: 'Cy', passcode: '5829' })).status, 200, 'then the new passcode signs in');
  assert.strictEqual((await post({ name: 'Cy', passcode: '' })).status, 403, 'and an empty passcode no longer does');
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const list = (await (await fetch(fx.api + '/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + dee }, body: '{}' })).json()).accounts;
  assert.ok(list.every(a => !a.start), 'no start code is shown anywhere');
});
