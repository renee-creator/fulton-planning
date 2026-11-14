'use strict';
// Kaymbu photos waiting to be checked, put right once. A photo a person checked comes off the Waiting list as they left
// it, a photo waiting only on Kaymbu's other children comes off and keeps the names offered, and a true question stays
// (November 14, 2026). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

test('only true questions stay on the Waiting list', async t => {
  const k = o => Object.assign({ v: 3, key: 'k.jpg', check: true }, o);
  const fx = await start({ more: put => {
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active' });
    put('notices/w1.json', { id: 'w1', at: 1, classroom: 'West', noticed: 'Sand', children: ['pip'], kaymbu: k({ checkedBy: 'Dee', checkedAt: 5, suggest: ['ivy'] }) });
    put('notices/w2.json', { id: 'w2', at: 2, classroom: 'West', noticed: 'Water', children: ['pip'], kaymbu: k({ suggest: ['ivy'] }) });
    put('notices/w3.json', { id: 'w3', at: 3, classroom: 'West', noticed: 'Mud', children: [], kaymbu: k({ suggest: ['pip'] }) });
    put('notices/w4.json', { id: 'w4', at: 4, classroom: 'West', noticed: 'Clay', children: ['pip'], kaymbu: k({ unsure: ['Pip'] }) });
    put('notices/w5.json', { id: 'w5', at: 5, classroom: 'West', noticed: 'Sticks', children: ['pip'], kaymbu: k({ maybe: true, suggest: ['ivy'] }) });
  } }); t.after(() => fx.stop());
  const rec = id => JSON.parse(fs.readFileSync(path.join(fx.dir, `notices/${id}.json`), 'utf8')).kaymbu;
  for (let i = 0; i < 60 && rec('w2').check; i++) await new Promise(r => setTimeout(r, 250));
  assert.deepStrictEqual([rec('w1').check, rec('w1').suggest, rec('w1').checkedBy], [false, undefined, 'Dee'], 'checked by a person, so off the list as they left it');
  assert.deepStrictEqual([rec('w2').check, rec('w2').suggest], [false, ['ivy']], 'children are tagged, so Kaymbu\'s other child is offered without waiting');
  assert.strictEqual(rec('w3').check, true, 'no child is tagged');
  assert.strictEqual(rec('w4').check, true, 'two children share the name');
  assert.strictEqual(rec('w5').check, true, 'the note may mean a child');
});
