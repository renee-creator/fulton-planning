'use strict';
// Kitchen TREE on the real server. The pantry records never reach a TREE page, a shopper sign-in reaches Kitchen TREE
// only, and an educator marks an item and asks for something without being able to change a store.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('Kitchen TREE on the server', async t => {
  const fx = await start({});
  t.after(async () => { await fx.stop(); });
  const dee = await fx.login('Dee', 'director-pass-1'), ann = await fx.login('Ann', '1357');
  let r = await fx.as(ann.token, '/api/pantry/boot'); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.role, 'educator'); assert.ok(r.body.items.length > 40);
  const salt = r.body.items.find(i => i.name === 'Salt' && i.section === 'sensory');
  r = await fx.as(ann.token, '/api/pantry/mark', { id: salt.id, status: 'low' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.lines.length, 1);
  r = await fx.as(ann.token, '/api/pantry/item', { id: salt.id, name: 'Salt', store: 'tj' }); assert.strictEqual(r.status, 403);
  r = await fx.as(dee.token, '/api/pantry/shopper', { name: 'Kai' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.shopperAccounts[0].name, 'Kai');
  // the pantry records stay out of what TREE's own pages receive, the educator's and the director's alike
  r = await fx.as(ann.token, '/api/data'); assert.ok(!Object.keys(r.body.data.settings).some(k => k.startsWith('pantry')));
  // the shopper chooses four numbers, then reaches Kitchen TREE and nothing else
  const res = await fetch(fx.api + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web }, body: JSON.stringify({ name: 'Kai', newCode: '2468', again: '2468' }) }); const kai = await res.json(); assert.ok(kai.token, JSON.stringify(kai));
  r = await fx.as(kai.token, '/api/pantry/boot'); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.role, 'shopper'); assert.ok(Array.isArray(r.body.tasks));
  for (const p of ['/api/data', '/api/changes', '/api/observe/boot', '/api/accounts']) { r = await fx.as(kai.token, p); assert.strictEqual(r.status, 403, p); }
});
