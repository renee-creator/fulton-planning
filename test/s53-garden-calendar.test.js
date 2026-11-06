// the director chooses which garden tasks reach educators' calendars, all, the weekly and monthly ones, or none
const test = require('node:test'); const assert = require('node:assert'); const { start } = require('./fixture.js');
test('garden tasks on educators\' calendars follow the director\'s choice, and the director always sees every task', async t => {
  const fx = await start({ more: put => { put('staff/garden/setup.json', { id: 'garden', ready: true, beds: [], plants: [],
    animals: [{ id: 'a-goats', name: 'Goats', kind: 'goat', care: [{ id: 'g1', text: 'Feed the goats hay', every: 'day', weekday: 1 }] }],
    plan: { months: { '11': { tasks: [{ id: 'w1', text: 'Water the beds', repeat: { weekday: 3 } }, { id: 'm1', text: 'Mulch the beds' }] } } }, tending: { home: {}, rotations: [] }, agreements: {} });
    put('staff/garden/log.json', { id: 'gardenlog' }); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const evs = async tok => { const r = await fx.as(tok, '/api/view', { from: '2026-11-02', to: '2026-11-06' }); return ((r.body && r.body.events) || []).filter(e => e.cal === 'tgarden').map(e => e.title); };
  let a = await evs(ann); assert.ok(a.some(x => /Water/.test(x)) && a.some(x => /Mulch/.test(x)), 'weekly and monthly tasks show at first'); assert.ok(!a.some(x => /goats/.test(x)), 'the daily animal care stays off at first');
  assert.ok((await evs(dee)).some(x => /goats/.test(x)), 'the director sees the animal care');
  assert.equal((await fx.as(ann, '/api/staff/garden/educal', { mode: 'all' })).status, 403);
  assert.equal((await fx.as(dee, '/api/staff/garden/educal', { mode: 'all' })).status, 200);
  assert.ok((await evs(ann)).some(x => /goats/.test(x)), 'all tasks shows the animal care');
  await fx.as(dee, '/api/staff/garden/educal', { mode: 'off' }); assert.deepEqual(await evs(ann), [], 'off leaves the calendar clear');
  assert.ok((await evs(dee)).length > 0, 'the director still sees every task');
});
test('off means an educator sees no garden tasks anywhere, on Today, the Garden page, the calendar or the place sheet', async t => {
  const fx = await start({ more: put => { put('staff/garden/setup.json', { id: 'garden', ready: true, eduCal: 'off', beds: [], plants: [],
    animals: [{ id: 'a-goats', name: 'Goats', kind: 'goat', care: [{ id: 'g1', text: 'Feed the goats hay', every: 'day', weekday: 1 }] }],
    plan: { months: {} }, tending: { home: {}, rotations: [] }, agreements: {} }); put('staff/garden/log.json', { id: 'gardenlog' }); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const g = (await fx.as(ann, '/api/staff/garden', {})).body; assert.equal(g.tasksOff, true); assert.deepEqual(g.today, []); assert.deepEqual(g.week, []);
  const sheet = (await fx.as(ann, '/api/place-sheet', {})).body; assert.deepEqual(sheet.tasks || [], []);
  const gd = (await fx.as(dee, '/api/staff/garden', {})).body; assert.ok(!gd.tasksOff);
});
