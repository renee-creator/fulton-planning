'use strict';
// A plant looked up once it is added (November 1, 2026). What the director wrote stays, a plant marked for looking is
// never made edible by the lookup, everything filled in is marked to confirm, and only the director looks plants up.
// Made-up answers only; iNaturalist is not reached here.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');

const ANSWER = { common: 'Mullein', botanical: 'Verbascum thapsus', uses: ['Pollinator', 'Food'], eat: 'food', taste: 'The leaves are not for eating.', ready: ['6', '07'],
  opens: 'It grows a tall spike — yellow flowers: in summer.', wonder: ['I wonder how tall it grows.', 'I wonder who visits it.'], words: { child: 'Fuzzy leaves.', adult: 'The hairs can bother skin.' },
  care: [{ month: '3', text: 'Leave the rosette to grow', stage: 'tend' }, { month: '09', text: 'Spray with herbicide', stage: 'tend' }], wildlife: ['Bees'], permanent: false };
const ask = async () => ({ status: 200, text: JSON.stringify({ content: [{ type: 'text', text: 'Here it is. ' + JSON.stringify(ANSWER) }] }) });
const SETUP = { id: 'garden', beds: [{ id: 'b-garden', name: 'Garden plantings' }], plants: [{ id: 'p1', common: 'Mullen', botanical: '', bed: 'b-garden', uses: ["Look, don't eat"], eat: 'look', taste: '', care: [], words: { child: 'We look gently.', adult: '' } }] };

test('a plant fills in, keeps what the director wrote, stays for looking and is marked to confirm', async () => {
  global.fetch = async () => { throw new Error('offline'); };
  const h = await loaded([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }], { ask, files: { 'staff/garden/setup.json': SETUP } });
  assert.strictEqual((await call(h.staff, 'Ann', 'garden/fill', { id: 'p1' })).status, 403);
  const r = await call(h.staff, 'Dir', 'garden/fill', { id: 'p1' }); assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const p = (r.body.plants || (r.body.setup || {}).plants || []).find(x => x.id === 'p1');
  assert.ok(p, 'the plant comes back');
  assert.strictEqual(p.botanical, 'Verbascum thapsus'); assert.strictEqual(p.confirm, true);
  assert.strictEqual(p.eat, 'look', 'the lookup never makes a plant edible'); assert.ok(!p.uses.includes('Food')); assert.ok(p.uses.includes("Look, don't eat")); assert.ok(p.uses.includes('Pollinator'));
  assert.strictEqual(p.words.child, 'We look gently.', 'what the director wrote stays');
  assert.match(p.words.adult, /stays for looking until the director confirms/);
  assert.deepStrictEqual(p.ready, ['06', '07']);
  assert.ok(!/[—:]/.test(p.opens), 'no dashes or colons'); assert.deepStrictEqual(p.care.map(c => c.text), ['Leave the rosette to grow'], 'no chemical care');
  assert.strictEqual(p.commonSays, 'Mullein'); assert.ok(p.filled);
  const c = await call(h.staff, 'Dir', 'garden/plant', { id: 'p1', plant: { checked: true } });
  const q = (c.body.plants || (c.body.setup || {}).plants || []).find(x => x.id === 'p1'); assert.ok(!q.filled && q.confirm === false && !q.commonSays);
});
