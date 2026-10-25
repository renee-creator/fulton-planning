'use strict';
// The Garden. Hidden until the director marks it ready, a Look, don't eat plant never harvested, no chemical ever in a
// task, one tap to mark a task done, harvests for the kitchen, and possible Farm to School evidence that counts only once
// the director confirms it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const SETUP = { id: 'garden', ready: false, beds: [{ id: 'b1', name: 'Bed one', space: 'garden', history: [] }],
  plants: [{ id: 'p1', common: 'Strawberry', botanical: 'Fragaria', bed: 'b1', uses: ['Food'], eat: 'food', care: [] }, { id: 'p2', common: 'Comfrey', bed: 'b1', uses: ['Look, don\'t eat'], eat: 'look', care: [] }],
  animals: [], plan: { months: {} }, tending: { home: { b1: 'West' }, rotations: [] }, agreements: { guiding: ['Pick with purpose and leave some for others.'], families: { items: ['We close the gates.'] } } };

test('the garden', async t => {
  const fx = await start({ more: put => { put('staff/garden/setup.json', SETUP); put('staff/garden/log.json', { id: 'gardenlog' }); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const G = (tok, p, b) => fx.as(tok, '/api/staff/garden' + (p ? '/' + p : ''), b || {});
  assert.strictEqual((await G(ann)).status, 403); assert.strictEqual((await G(kit)).status, 403);
  await G(dee, 'ready', { on: true });
  assert.strictEqual((await G(kit, 'harvest', { plant: 'p2' })).status, 400);
  const h = await G(kit, 'harvest', { plant: 'p1', amount: 'a basket', children: true, room: 'West' }); assert.strictEqual(h.status, 200);
  assert.strictEqual((await G(kit, 'compost', { what: 'scraps' })).status, 403);
  assert.strictEqual((await G(dee, 'task', { month: '03', text: 'Use weed killer on the paths' })).status, 400);
  const mm = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(5, 7);
  const v = (await G(dee, 'task', { month: mm, text: 'Plant garlic in bed one', stage: 'plant', bed: 'b1' })).body;
  const task = v.today.find(x => /garlic/.test(x.text)); assert.strictEqual(task.room, 'West');
  assert.strictEqual((await G(bea, 'done', { task: task.id })).status, 403, 'another Class cannot mark it');
  const d = await G(ann, 'done', { task: task.id, group: 'Marigold' }); assert.strictEqual(d.body.today.find(x => x.id === task.id).done.by, 'Ann');
  const ev = (await G(dee)).body.evidence; assert.ok(ev.some(x => x.n === 5)); assert.ok(ev.some(x => x.n === 7));
  assert.strictEqual((await G(ann)).body.evidence, undefined, 'only the director sees the evidence to confirm');
  assert.strictEqual((await G(ann, 'photo', { plant: 'p1', id: 'abc-garden-plant.jpg', noFace: false })).status, 400, 'a photo is kept only after the face check');
});
