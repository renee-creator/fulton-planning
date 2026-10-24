'use strict';
// who receives what from the Educators and growth requests. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West', planHour: '09:00', checkin: 'slot' }, { name: 'Bea', room: 'North', planHour: '09:00', checkin: 'slot' },
  { name: 'Gia', role: 'staff', office: true }, { name: 'Kit', kitchen: true, role: 'staff' }, { name: 'Neo', newHire: true, startDate: '2026-11-02' }, { name: 'Shared', renderOnly: true }];

test('the go-to person receives only the new educator\'s check-ins, never the rest of the record', async () => {
  const h = await loaded(LIST, { school: { goTo: 'Gia' } });
  await call(h.staff, 'Dir', 'save', { name: 'Neo', doc: { flu: { 2026: { status: 'medical' } }, items: { tb: { date: '2026-10-01' } } } });
  const r = await call(h.staff, 'Gia', 'goto', { newName: 'Neo' });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(Object.keys(r.body).sort(), ['gotoCheckins', 'name']);
  assert.strictEqual(JSON.stringify(r.body).includes('medical'), false);
  const own = await call(h.staff, 'Neo', 'goto', {});
  assert.ok(own.body.flu, 'the new educator still receives their own record');
});

test('an educator never receives another educator\'s records or growth', async () => {
  const h = await loaded(LIST);
  await call(h.staff, 'Dir', 'g/checkin/save', { name: 'Ann', checkin: { date: '2026-10-05', work: 'PRIVATE', temp: { self: 3, words: 'PRIVATE' }, focus: { settled: 'shared focus', seen: 'PRIVATE' } } });
  await call(h.staff, 'Dir', 'g/plan', { name: 'Ann', plan: { challenges: 'PRIVATE', reflection: { difficult: 'PRIVATE' } } });
  for (const p of ['person', 'g/mine', 'g/journal/open']) assert.strictEqual((await call(h.staff, 'Bea', p, { name: 'Ann', passcode: '1357' })).status, 403, p);
  for (const p of ['people', 'g/all']) assert.strictEqual((await call(h.staff, 'Bea', p, {})).status, 403, p);
  const mine = await call(h.staff, 'Ann', 'g/mine', {});
  assert.strictEqual(JSON.stringify(mine.body.checkins).includes('PRIVATE'), false, 'the educator sees only the focus and follow-up of a check-in');
  assert.strictEqual(mine.body.checkins[0].focus.settled, 'shared focus');
});

test('a shared sign-in has no growth pages and never starts a record', async () => {
  const h = await loaded(LIST);
  assert.strictEqual((await call(h.staff, 'Shared', 'g/boot', {})).status, 403);
  assert.strictEqual((await call(h.staff, 'Shared', 'g/moments/add', { moment: { text: 'x' } })).status, 403);
  assert.strictEqual((await call(h.staff, 'Shared', 'upload', { filename: 'a.pdf', data: 'AA==' })).status, 403);
  assert.strictEqual((await call(h.staff, 'Shared', 'read', { what: 'welcome' })).status, 403);
  assert.ok(![...h.files.keys()].some(p => /shared/.test(p)));
});

test('a new hire before full access hears no PD day reminder and reaches only their own growth', async () => {
  const h = await loaded(LIST);
  assert.strictEqual((await call(h.staff, 'Neo', 'g/pd/list', {})).status, 403);
  assert.strictEqual((await call(h.staff, 'Neo', 'g/moments', {})).status, 403);
  assert.strictEqual((await call(h.staff, 'Neo', 'g/mine', {})).status, 200);
});

test('the kitchen reaches its own records page and nothing else', async () => {
  const h = await loaded(LIST);
  assert.strictEqual((await call(h.staff, 'Kit', 'person', {})).status, 200);
  for (const p of ['person', 'g/boot', 'pd', 'handbook']) assert.strictEqual((await call(h.staff, 'Kit', p, { name: p === 'person' ? 'Ann' : undefined })).status, 403, p);
});

test('an educator\'s save keeps the hours TREE logged', async () => {
  const h = await loaded(LIST);
  await call(h.staff, 'Dir', 'save', { name: 'Ann', doc: { hours: [{ id: 'h1', by: 'TREE', hours: 1.5, title: 'PD day', approved: false }] } });
  const r = await call(h.staff, 'Ann', 'save', { doc: { hours: [{ id: 'h1', by: 'TREE', hours: 40, title: 'PD day', approved: true }, { id: 'h2', by: 'Ann', hours: 2, title: 'A course', approved: true }] } });
  assert.deepStrictEqual(r.body.hours.map(x => [x.id, x.hours, x.approved]), [['h1', 1.5, false], ['h2', 2, true]]);
});
