'use strict';
// an educator leaving Fulton, and the Former educators list only the director opens. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loaded, call } = require('./harness.js');
const { start } = require('./fixture.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West', planHour: '09:00', checkin: 'slot' }, { name: 'Bea', room: 'North', planHour: '09:00', checkin: 'slot' }];
const laDay = n => { const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test('a former educator leaves the check-ins and the Educators list, and their growth waits for the director', async () => {
  const h = await loaded(LIST);
  await call(h.staff, 'Dir', 'g/plan', { name: 'Ann', plan: { challenges: 'Rain days' } });
  await call(h.staff, 'Ann', 'g/moments/add', { moment: { text: 'The bean tunnel grew', audience: 'everyone' } });
  h.accounts.list.find(a => a.name === 'Ann').leaveOn = laDay(-1);
  assert.strictEqual(h.staff.isFormerEducator('Ann'), true);
  assert.strictEqual(h.staff.isFormerEducator('Bea'), false);
  const people = await call(h.staff, 'Dir', 'people', {});
  assert.deepStrictEqual(people.body.people.map(p => p.name).sort(), ['Bea', 'Dir']);
  const boot = await call(h.staff, 'Dir', 'g/boot', {});
  assert.ok(!boot.body.people.some(p => p.name === 'Ann'), 'not offered on the growth pages');
  assert.ok(!JSON.stringify(boot.body.schedule).includes('Ann'), 'not in the check-in schedule');
  const former = await call(h.staff, 'Dir', 'former', {});
  assert.deepStrictEqual(former.body.people.map(p => [p.name, p.leftOn]), [['Ann', laDay(-1)]]);
  const g = await call(h.staff, 'Dir', 'g/former', { name: 'Ann' });
  assert.strictEqual(g.body.growth.plans[Object.keys(g.body.growth.plans)[0]].challenges, 'Rain days');
  assert.strictEqual(g.body.moments.length, 1);
  assert.strictEqual((await call(h.staff, 'Bea', 'former', {})).status, 403);
  assert.strictEqual((await call(h.staff, 'Bea', 'g/former', { name: 'Ann' })).status, 403);
  const ms = await call(h.staff, 'Dir', 'g/moments', {});
  assert.strictEqual(ms.body.list.length, 0, 'their Proud Moments move with them');
  assert.strictEqual(h.staff.displayMoments().length, 0, 'and leave the staff room display');
  assert.ok(h.staff.hasFiles('Ann'));
});

test('an educator with a last day still to come is still at Fulton', async () => {
  const h = await loaded(LIST);
  h.accounts.list.find(a => a.name === 'Ann').leaveOn = laDay(0);
  assert.strictEqual(h.staff.isFormerEducator('Ann'), false);
  assert.ok((await call(h.staff, 'Dir', 'people', {})).body.people.some(p => p.name === 'Ann'));
});

test('Leaving Fulton ends the sign-in after the last day, and Bring back keeps the history', async () => {
  const fx = await start({ more: put => {
    put('notices/n1.json', { id: 'n1', by: 'Ann', noticed: 'Water in the trough', at: 1 });
    put('settings/program.json', { id: 'program', groups: [{ name: 'Fern', room: 'West', educator: 'Ann' }] });
    put('access/accounts.json', { accounts: [{ name: 'Ann', room: 'West', code: '1357', v: 1 }, { name: 'Bea', room: 'North', code: '1357', v: 1 }, { name: 'Gia', code: '1357', v: 1 }, { name: 'Kit', kitchen: true, code: '1357', v: 1 }, { name: 'Neo', newHire: true, code: '1357', v: 1 }, { name: 'Oops', code: '', start: '123456', v: 0 }] });
  } });
  try {
    const dt = (await fx.login('Dee', 'director-pass-1')).token, at = (await fx.login('Ann', '1357')).token;
    let r = await fx.as(dt, '/api/accounts');
    const acc = n => r.body.accounts.find(a => a.name === n);
    assert.strictEqual(acc('Ann').records, true);
    assert.strictEqual(acc('Oops').records, false);
    assert.strictEqual((await fx.as(dt, '/api/accounts/remove', { name: 'Ann' })).status, 400, 'someone with records is never removed');
    r = await fx.as(dt, '/api/accounts/remove', { name: 'Oops' }); assert.strictEqual(r.status, 200, 'a sign-in added by mistake is removed');
    r = await fx.as(dt, '/api/accounts/leave', { name: 'Ann', leaveOn: laDay(0) });
    assert.strictEqual(acc('Ann').leaveOn, laDay(0)); assert.strictEqual(acc('Ann').former, false);
    assert.strictEqual((await fx.as(at, '/api/data')).status, 200, 'sign-in lasts to the end of the last day');
    r = await fx.as(dt, '/api/accounts/return', { name: 'Ann' }); assert.strictEqual(acc('Ann').leaveOn, ''); assert.ok(acc('Ann').code, 'staying keeps the code');
    r = await fx.as(dt, '/api/accounts/leave', { name: 'Ann', leaveOn: laDay(-1) }); assert.strictEqual(acc('Ann').former, true);
    assert.strictEqual((await fx.as(at, '/api/data')).status, 401);
    assert.ok(!(await fx.login('Ann', '1357')).token);
    const d = (await fx.as(dt, '/api/data')).body;
    assert.ok(!d.data.settings.educators.names.some(x => x.name === 'Ann'), 'off the names offered on plans');
    assert.strictEqual(d.data.settings.program.groups[0].educator, '', 'off the small group leads');
    assert.ok(!d.teachers.includes('Ann'));
    assert.strictEqual(d.data.notices.n1.by, 'Ann', 'what they wrote keeps their name');
    r = await fx.as(dt, '/api/accounts/return', { name: 'Ann' });
    assert.strictEqual(acc('Ann').former, false); assert.strictEqual(acc('Ann').code, ''); assert.ok(acc('Ann').start, 'back with a new start code');
    const d2 = (await fx.as(dt, '/api/data')).body;
    assert.strictEqual(d2.data.settings.program.groups[0].educator, 'Ann', 'back as the small group lead');
    assert.ok(d2.data.settings.educators.names.some(x => x.name === 'Ann'));
    await new Promise(ok => setTimeout(ok, 2000));
    const saved = JSON.parse(fs.readFileSync(path.join(fx.dir, 'access/accounts.json'), 'utf8')).accounts.find(a => a.name === 'Ann');
    assert.ok(!saved.leaveOn && !saved.leftFrom);
  } finally { await fx.stop(); }
});
