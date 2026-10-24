'use strict';
// the first sign-in needs the six number start code the director hands out. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('a sign-in with no passcode yet is claimed only with its start code', async t => {
  const fx = await start({ more: put => put('access/accounts.json', { accounts: [{ name: 'Ann', room: 'West', code: '1357', v: 1 }, { name: 'Cy', code: '', start: '246813', v: 0 }] }) });
  t.after(() => fx.stop());
  const post = async body => (await fetch(fx.api + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web }, body: JSON.stringify(body) }));
  assert.strictEqual((await post({ name: 'Cy', passcode: '' })).status, 403, 'an empty passcode no longer starts the setup');
  assert.strictEqual((await post({ name: 'Cy', passcode: '' , newCode: '5829', again: '5829' })).status, 403, 'nor sets a passcode');
  assert.strictEqual((await post({ name: 'Cy', passcode: '111111', newCode: '5829', again: '5829', start: '111111' })).status, 403, 'a wrong start code is refused');
  const r = await post({ name: 'Cy', passcode: '246813' }); assert.strictEqual(r.status, 200); assert.strictEqual((await r.json()).setup, true);
  assert.strictEqual((await post({ name: 'Cy', start: '000000', newCode: '5829', again: '5829' })).status, 403, 'the start code is checked again when the passcode is saved');
  const ok = await (await post({ name: 'Cy', start: '246813', newCode: '5829', again: '5829' })).json(); assert.ok(ok.token);
  assert.strictEqual((await post({ name: 'Cy', passcode: '5829' })).status, 200, 'then the new passcode signs in');
  assert.strictEqual((await post({ name: 'Cy', passcode: '246813' })).status, 403, 'and the start code no longer does');
});
