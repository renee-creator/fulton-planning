'use strict';
// moving one month's check-ins, or one educator's, without touching any other month or anyone else. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Wa', room: 'West', planHour: '09:00', checkin: 'slot' }, { name: 'Na', room: 'North', planHour: '09:00', checkin: 'slot' },
  { name: 'Sa', room: 'South', planHour: '10:00', checkin: 'slot' }, { name: 'El', checkin: 'second' }];
const S = (h, who, ym) => call(h.staff, who, 'g/schedule', { month: ym }).then(r => r.body);
const M = (h, who, b) => call(h.staff, who, 'g/checkin/move', b);

test('a whole month moves to a new day, other months stay, and it can be put back', async () => {
  const h = await loaded(LIST, {});
  const nov0 = await S(h, 'Dir', '2026-11'); const dec0 = await S(h, 'Dir', '2026-12');
  assert.strictEqual(nov0.day1, '2026-11-02');
  const r = await M(h, 'Dir', { month: '2026-11', date: '2026-11-16' }); assert.strictEqual(r.status, 200);
  const nov = await S(h, 'Dir', '2026-11');
  assert.strictEqual(nov.day1, '2026-11-16'); assert.strictEqual(nov.day2, '2026-11-23');
  assert.deepStrictEqual(nov.list.filter(x => x.kind === 'slot').map(x => [x.date, x.time]), nov0.list.filter(x => x.kind === 'slot').map(x => ['2026-11-16', x.time]));
  assert.strictEqual(nov.monthMove.from, '2026-11-02');
  assert.deepStrictEqual((await S(h, 'Dir', '2026-12')).day1, dec0.day1, 'December is untouched');
  await M(h, 'Dir', { month: '2026-11', undo: true });
  assert.strictEqual((await S(h, 'Dir', '2026-11')).day1, '2026-11-02');
});

test('a month moved with a start time shifts everyone together, keeping their order and spacing', async () => {
  const h = await loaded(LIST, {});
  await M(h, 'Dir', { month: '2026-11', date: '2026-11-16', time: '13:00' });
  const slot = (await S(h, 'Dir', '2026-11')).list.filter(x => x.kind === 'slot').map(x => x.time);
  assert.deepStrictEqual(slot, ['13:00', '13:20', '14:00']);
});

test('one check-in moves on its own, everyone else keeps their day and time, and it can be put back', async () => {
  const h = await loaded(LIST, {});
  const before = (await S(h, 'Dir', '2026-11')).list;
  await M(h, 'Dir', { month: '2026-11', name: 'Sa', date: '2026-11-10', time: '15:00' });
  const after = (await S(h, 'Dir', '2026-11')).list;
  const sa = after.find(x => x.name === 'Sa');
  assert.deepStrictEqual([sa.date, sa.time, sa.single, sa.from.date], ['2026-11-10', '15:00', true, '2026-11-02']);
  for (const n of ['Wa', 'Na', 'El']) { const a = before.find(x => x.name === n), b = after.find(x => x.name === n); assert.deepStrictEqual([b.date, b.time], [a.date, a.time], n); }
  // the educator sees the new day
  assert.deepStrictEqual((await S(h, 'Sa', '2026-11')).list.map(x => x.date), ['2026-11-10']);
  await M(h, 'Dir', { month: '2026-11', name: 'Sa', undo: true });
  assert.strictEqual((await S(h, 'Dir', '2026-11')).list.find(x => x.name === 'Sa').date, '2026-11-02');
});

test('only the director moves check-ins', async () => {
  const h = await loaded(LIST, {});
  assert.strictEqual((await M(h, 'Wa', { month: '2026-11', date: '2026-11-16' })).status, 403);
});
