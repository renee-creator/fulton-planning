'use strict';
// reminders across a school year, each heard once, at the right time, by the right people. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { make, loaded, call } = require('./harness.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West', planHour: '09:00', checkin: 'slot', startDate: '2020-01-01' },
  { name: 'Pat', journalEvery: 2, startDate: '2020-01-01' }, { name: 'Neo', newHire: true, startDate: '2026-11-02' }, { name: 'Kit', kitchen: true, role: 'staff' }];
const schoolDays = (from, to) => { const out = []; for (let d = new Date(from + 'T12:00:00Z'); d <= new Date(to + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) { const w = d.getUTCDay(); if (w > 0 && w < 6) out.push(d.toISOString().slice(0, 10)); } return out; };
const heard = (h, name, from, to, re) => schoolDays(from, to).filter(day => h.staff.dueFor(name, day).some(x => re.test(x)));
// the server's clock set to a moment in Pacific time
const at = (t, iso) => t.mock.timers.enable({ apis: ['Date'], now: new Date(iso).getTime() });

test('proof of enrollment is asked for once each semester, below twelve units', async () => {
  const h = await loaded(LIST);
  await call(h.staff, 'Dir', 'save', { name: 'Ann', doc: { units: { completed: 6 } } });
  assert.deepStrictEqual(heard(h, 'Ann', '2026-07-01', '2027-07-01', /Proof of enrollment/), ['2026-08-20', '2027-01-20']);
});

test('a certificate is heard about once before it expires and once when it has', async () => {
  const h = await loaded(LIST);
  await call(h.staff, 'Dir', 'save', { name: 'Ann', doc: { items: { cpr: { date: '2024-11-20' } } } });
  assert.deepStrictEqual(heard(h, 'Ann', '2026-07-01', '2027-07-01', /First Aid/), ['2026-10-21', '2026-11-20']);
});

test('the flu shot is heard about once before August 1 and once in November, everyone who works at the school', async () => {
  const h = await loaded(LIST);
  for (const n of ['Ann', 'Kit']) assert.deepStrictEqual(heard(h, n, '2026-07-01', '2027-07-01', /flu shot/), ['2026-07-15', '2026-11-02'], n);
  await call(h.staff, 'Dir', 'save', { name: 'Pat', doc: { flu: { 2026: { status: 'vaccinated' } } } });
  assert.deepStrictEqual(heard(h, 'Pat', '2026-08-01', '2027-07-01', /flu shot/), []);
});

test('the director hears once when three months pass without a drill', async t => {
  at(t, '2026-11-02T17:00:00Z');   // a Monday, 9 in the morning in California
  const h = await loaded(LIST);
  await call(h.staff, 'Dir', 'drills', { add: { date: '2026-07-20', type: 'Fire' } });
  await h.staff.tick();
  t.mock.timers.setTime(new Date('2026-11-09T17:00:00Z').getTime()); await h.staff.tick();
  t.mock.timers.setTime(new Date('2026-11-16T17:00:00Z').getTime()); await h.staff.tick();
  assert.strictEqual(h.sent.filter(s => s.name === 'Dir' && /No emergency drill/.test(s.msg.body)).length, 1);
});

test('the PD day reminder comes three days before, once, and never to a new hire', async t => {
  at(t, '2026-11-13T17:00:00Z');   // Friday, three days before a Monday PD day
  const h = make(LIST);
  h.files.set('staff/pddays.json', { doc: { agendas: { '2026-11-16-pdday': { id: '2026-11-16-pdday', date: '2026-11-16', kind: 'pdday', blocks: [{ title: 'Documentation', prepare: 'Bring one observation' }] } }, manual: [] } });
  await h.staff.load();
  await h.staff.growthTick(); await h.staff.growthTick();
  const to = h.sent.filter(s => /PD day/.test(s.msg.title)).map(s => s.name).sort();
  assert.deepStrictEqual(to, ['Ann', 'Pat']);
});

test('the journal reminder comes on Friday afternoon only to someone who has not written, every other week for part time', async t => {
  at(t, '2026-11-13T23:00:00Z');   // Friday, 3 in the afternoon in California
  const h = await loaded(LIST);
  await h.staff.growthTick(); await h.staff.growthTick();
  const first = h.sent.filter(s => /journal/.test(s.msg.title)).map(s => s.name).sort();
  t.mock.timers.setTime(new Date('2026-11-20T23:00:00Z').getTime()); h.sent.length = 0; await h.staff.growthTick();
  const second = h.sent.filter(s => /journal/.test(s.msg.title)).map(s => s.name).sort();
  // Pat writes every other week, so hears on only one of the two Fridays. Ann hears each week. Neo, before full access, never.
  assert.ok(first.includes('Ann') && second.includes('Ann'));
  assert.strictEqual([first.includes('Pat'), second.includes('Pat')].filter(Boolean).length, 1);
  assert.ok(!first.includes('Neo') && !second.includes('Neo') && !first.includes('Kit'));
});
