'use strict';
// the monthly check-ins across a school year, with holidays and long breaks. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');

const ev = (title, start, end) => ({ title, start, end: end || start, allDay: true });
const EVENTS = [ev('Labor Day, no school', '2026-09-07'), ev('PD day, no school', '2026-10-12'), ev('Thanksgiving break', '2026-11-25', '2026-11-27'), ev('Winter break', '2026-12-21', '2027-01-01'),
  ev('MLK Day, no school', '2027-01-18'), ev('Staff development day', '2027-02-01'), ev('Presidents Day, no school', '2027-02-15'), ev('Spring break', '2027-03-29', '2027-04-02')];
const LIST = [{ name: 'Dir', director: true }, { name: 'Wa', room: 'West', planHour: '09:00', checkin: 'slot' }, { name: 'Na', room: 'North', planHour: '09:00', checkin: 'slot' }, { name: 'Sa', room: 'South', planHour: '09:00', checkin: 'slot' },
  { name: 'El', checkin: 'second' }, { name: 'Fe', checkin: 'asneeded' }, { name: 'An', room: 'West', checkin: 'asneeded' }, { name: 'Of', role: 'staff', office: true }, { name: 'Ki', kitchen: true }];

test('check-ins land on the first open Monday, move off holidays and post-break Mondays, rotate monthly and skip those met as needed', async () => {
  const h = await loaded(LIST, { events: EVENTS });
  const want = { '2026-09': ['2026-09-14', '2026-09-21'], '2026-10': ['2026-10-05', '2026-10-19'], '2026-11': ['2026-11-02', '2026-11-09'], '2027-01': ['2027-01-11', '2027-01-25'], '2027-02': ['2027-02-08', '2027-02-22'], '2027-04': ['2027-04-12', '2027-04-19'] };
  const firsts = [];
  for (const [ym, [d1, d2]] of Object.entries(want)) {
    const s = (await call(h.staff, 'Dir', 'g/schedule', { month: ym })).body;
    assert.deepStrictEqual([s.day1, s.day2], [d1, d2], ym);
    const names = s.list.map(x => x.name);
    for (const n of ['Fe', 'An', 'Of', 'Ki']) assert.ok(!names.includes(n), n + ' is not scheduled');
    const slot = s.list.filter(x => x.kind === 'slot');
    assert.deepStrictEqual(slot.map(x => x.time), ['09:00', '09:20', '09:40']);
    assert.strictEqual(new Set(slot.map(x => x.name)).size, 3, 'one from each Class');
    assert.deepStrictEqual(s.list.filter(x => x.kind === 'second').map(x => x.date), [d2]);
    firsts.push(slot[0].name);
  }
  assert.ok(new Set(firsts).size > 1, 'the order rotates from month to month');
});

test('an educator sees only their own check-in', async () => {
  const h = await loaded(LIST, { events: EVENTS });
  const s = (await call(h.staff, 'Wa', 'g/schedule', { month: '2026-11' })).body;
  assert.deepStrictEqual(s.list.map(x => x.name), ['Wa']);
});
