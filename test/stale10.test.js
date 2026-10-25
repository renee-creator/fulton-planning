'use strict';
// A page open on another tab or device holds an older copy of a record. Its save never puts back what a newer save from
// another tab changed, and never drops a piece another tab added, as happened to Final remarks on October 9 and a DRDP
// piece of evidence on October 22. The same tab changing its own words back is kept. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('a save from an older copy keeps the newer words', async t => {
  const fx = await start(); t.after(() => fx.stop());
  const me = (await fx.login('Dee', 'director-pass-1')).token;
  const w = (dev, op, extra) => fx.as(me, '/api/write', Object.assign({ op, kind: 'plans', id: 'pstale1', dev }, extra));
  const base = { id: 'pstale1', type: 'individual', educator: 'Ann', weekOf: '2026-09-28', status: 'draft', fields: { focus: 'Water', remarks: '' } };
  assert.strictEqual((await w('tabAAAAAA', 'create', { data: base })).status, 200);
  // tab B writes the Final remarks and adds a section
  await w('tabBBBBBB', 'set', { data: Object.assign({}, base, { fields: { focus: 'Water', remarks: 'The bunnies drank from the bowl.', extra: 'Kept by B' } }) });
  // tab A, still holding the first copy, changes the focus and sends its whole older copy
  let r = await w('tabAAAAAA', 'set', { data: Object.assign({}, base, { fields: { focus: 'Water and soil', remarks: '' } }) });
  assert.strictEqual(r.body.doc.fields.remarks, 'The bunnies drank from the bowl.', 'newer words are kept');
  assert.strictEqual(r.body.doc.fields.extra, 'Kept by B', 'a piece another tab added stays');
  assert.strictEqual(r.body.doc.fields.focus, 'Water and soil', 'the older copy\'s own change is kept');
  // an update from tab A's older copy is held back the same way
  r = await w('tabAAAAAA', 'update', { patch: { fields: { remarks: '' } } });
  assert.strictEqual(r.body.doc.fields.remarks, 'The bunnies drank from the bowl.');
  // tab B changing its own words back is its own choice
  await w('tabBBBBBB', 'update', { patch: { fields: { remarks: 'The bunnies drank.' } } });
  r = await w('tabBBBBBB', 'update', { patch: { fields: { remarks: 'The bunnies drank from the bowl.' } } });
  assert.strictEqual(r.body.doc.fields.remarks, 'The bunnies drank from the bowl.');
  r = await w('tabBBBBBB', 'update', { patch: { fields: { remarks: 'The bunnies drank.' } } });
  assert.strictEqual(r.body.doc.fields.remarks, 'The bunnies drank.', 'the same tab typing back to its own earlier words is kept');
  // a piece removed on purpose stays removed
  r = await w('tabAAAAAA', 'update', { patch: { fields: { extra: { __delete__: true } } } });
  assert.strictEqual(r.body.doc.fields.extra, undefined);
});
