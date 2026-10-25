'use strict';
// A full-day PD day is its month's all-staff meeting, so no first Monday meeting is held that month and that Monday is a
// team meeting day. December and February still have none unless they have a PD day. The director moves any month's
// meeting, and the agenda, the calendar and the team meetings follow it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const laToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const nextYm = ym => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const firstMonday = ym => { let d = ym + '-01'; while (new Date(d + 'T12:00:00Z').getUTCDay() !== 1) d = addDays(d, 1); return d; };
const quiet = ym => ['12', '02'].includes(ym.slice(5));

test('PD days as the all-staff meeting, and moving a meeting', async t => {
  let ymA = nextYm(laToday().slice(0, 7)); while (quiet(ymA)) ymA = nextYm(ymA);
  let ymB = nextYm(ymA); while (quiet(ymB)) ymB = nextYm(ymB);
  let ymD = laToday().slice(0, 4) + '-12'; if (ymD <= laToday().slice(0, 7)) ymD = (+ymD.slice(0, 4) + 1) + '-12';
  const pdA = addDays(firstMonday(ymA), 9), pdD = addDays(firstMonday(ymD), 2);
  const ev = (uid, d, title) => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:${d.replace(/-/g, '')}\r\nDTEND;VALUE=DATE:${addDays(d, 1).replace(/-/g, '')}\r\nSUMMARY:${title}\r\nEND:VEVENT\r\n`;
  const feed = () => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:test\r\nX-WR-CALNAME:School\r\n' + ev('pda', pdA, 'PD Day, no school for children') + ev('pdd', pdD, 'PD Day') + 'END:VCALENDAR\r\n';
  const fx = await start({ feed }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const g = (p, b) => fx.as(dee, '/api/staff/g/' + p, b || {});
  let list; for (let k = 0; k < 30; k++) { list = (await g('pd/list')).body; if (list.list.some(x => x.date === pdA)) break; await new Promise(r => setTimeout(r, 300)); }

  await t.test('a month with a PD day holds no first Monday meeting, and that Monday is a team meeting', () => {
    assert.ok(list.list.some(x => x.date === pdA && x.kind === 'pdday'));
    assert.ok(!list.list.some(x => x.kind === 'meeting' && x.date.slice(0, 7) === ymA), 'no PD staff meeting in ' + ymA);
    if (firstMonday(ymA) <= addDays(laToday(), 28)) assert.ok(list.team.some(x => x.room === 'West' && x.date === firstMonday(ymA)), 'the first Monday is a team meeting');
    // the other month still meets on its first Monday
    assert.ok(list.list.some(x => x.kind === 'meeting' && x.date === firstMonday(ymB)));
  });

  await t.test('December with a PD day has that PD day, and no first Monday meeting', () => {
    if (!list.list.some(x => x.date.slice(0, 7) === ymD)) return;
    assert.ok(list.list.some(x => x.date === pdD && x.kind === 'pdday'));
    assert.ok(!list.list.some(x => x.kind === 'meeting' && x.date.slice(0, 7) === ymD));
  });

  await t.test('moving a meeting takes its agenda, the calendar and the team meetings with it', async () => {
    const fm = firstMonday(ymB), to = addDays(fm, 7);
    assert.strictEqual((await g('pd/save', { agenda: { date: fm, kind: 'meeting', title: 'Our meeting', blocks: [{ title: 'Garden beds' }] } })).status, 200);
    assert.strictEqual((await g('pd/move', { ym: ymB, date: to })).status, 200);
    const l2 = (await g('pd/list')).body;
    const m = l2.list.find(x => x.kind === 'meeting' && x.date.slice(0, 7) === ymB);
    assert.strictEqual(m.date, to);
    assert.strictEqual(m.agenda && m.agenda.title, 'Our meeting');
    assert.ok(!l2.list.some(x => x.date === fm && x.agenda), 'the agenda left the old day');
    assert.ok(!l2.team.some(x => x.date === to), 'no team meeting on the new day');
    // team meetings are listed four weeks ahead, so the old Monday is checked when it is in reach
    if (fm <= addDays(laToday(), 28)) assert.ok(l2.team.some(x => x.room === 'West' && x.date === fm), 'the old Monday is a team meeting');
    const v = await fx.as(dee, '/api/view', { from: ymB + '-01', to: ymB + '-28' });
    const pdm = (v.body.events || []).filter(e => e.title === 'PD staff meeting');
    assert.deepStrictEqual(pdm.map(e => e.start.slice(0, 10)), [to]); assert.match(pdm[0].desc, /moved to this day/);
  });
});
