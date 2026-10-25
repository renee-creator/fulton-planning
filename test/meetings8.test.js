'use strict';
// Mondays. The PD staff meeting is the first Monday of each month, with none in December and February. Each Class team
// meets on the other open Mondays and sees only its own team meetings. A closure on the first Monday asks the director
// for another day. Next steps carry over until done, and team meetings never log PD hours. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const laToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const nextYm = ym => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const firstMonday = ym => { let d = ym + '-01'; while (new Date(d + 'T12:00:00Z').getUTCDay() !== 1) d = addDays(d, 1); return d; };

test('first Mondays, team meetings for each Class, a closure asked once, and next steps carried over', async t => {
  // a month ahead that is neither December nor February, so it has an all-staff meeting
  let ym = nextYm(laToday().slice(0, 7)); if (['12', '02'].includes(ym.slice(5))) ym = nextYm(ym);
  const fm = firstMonday(ym), second = addDays(fm, 7), third = addDays(fm, 14);
  const ymd = fm.replace(/-/g, '');
  const feed = () => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:test\r\nX-WR-CALNAME:School\r\n' +
    `BEGIN:VEVENT\r\nUID:closed1\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:${ymd}\r\nDTEND;VALUE=DATE:${addDays(fm, 1).replace(/-/g, '')}\r\nSUMMARY:No school\r\nEND:VEVENT\r\n` +
    'END:VCALENDAR\r\n';
  const fx = await start({ feed });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token;
  const g = (tok, p, b) => fx.as(tok, '/api/staff/g/' + p, b || {});
  // the calendar feed is read on the first ask
  let list; for (let k = 0; k < 20; k++) { list = (await g(dee, 'pd/list')).body; if (list.list.some(x => x.date.slice(0, 7) === ym) || (await g(dee, 'pd/today')).body.ask.length) break; await new Promise(r => setTimeout(r, 300)); }

  // the closed first Monday has no meeting, and the director is asked for another day, the educator is not
  assert.ok(!list.list.some(x => x.kind === 'meeting' && x.date.slice(0, 7) === ym), 'no meeting on a closed first Monday');
  const asked = (await g(dee, 'pd/today')).body.ask;
  assert.ok(asked.some(a => a.ym === ym && a.firstMonday === fm), 'the director is asked about ' + ym);
  assert.deepStrictEqual((await g(ann, 'pd/today')).body.ask, []);
  assert.strictEqual((await g(ann, 'pd/move', { ym, date: second })).status, 403, 'only the director moves the meeting');
  assert.strictEqual((await g(dee, 'pd/move', { ym, date: second })).status, 200);
  assert.ok(!(await g(dee, 'pd/today')).body.ask.some(a => a.ym === ym), 'asked once');
  list = (await g(dee, 'pd/list')).body;
  assert.ok(list.list.some(x => x.kind === 'meeting' && x.date === second), 'the meeting moves to the chosen day');

  // team meetings fall on open Mondays other than the all-staff day, each Class team sees only its own
  const teamDates = room => list.team.filter(x => x.room === room).map(x => x.date);
  assert.deepStrictEqual([...new Set(list.team.map(x => x.room))].sort(), ['North', 'South', 'West']);
  assert.ok(!teamDates('West').includes(fm), 'not on a closure');
  assert.ok(!teamDates('West').includes(second), 'not on the all-staff Monday');
  assert.ok(teamDates('West').includes(third));
  assert.ok(list.team.every(x => new Date(x.date + 'T12:00:00Z').getUTCDay() === 1), 'only Mondays');
  const annList = (await g(ann, 'pd/list')).body;
  assert.deepStrictEqual([...new Set(annList.team.map(x => x.room))], ['West']);
  assert.strictEqual((await g(ann, 'pd/team', { room: 'North', date: third })).status, 403);

  // December and February have no all-staff meeting, and their open Mondays are all team meetings
  const quiet = list.list.filter(x => x.kind === 'meeting' && ['12', '02'].includes(x.date.slice(5, 7)));
  assert.deepStrictEqual(quiet, []);
  const decMon = list.team.filter(x => x.room === 'West' && x.date.slice(5, 7) === '12').map(x => x.date);
  if (decMon.length) assert.ok(decMon.includes(firstMonday(decMon[0].slice(0, 7))), 'the first Monday of December is a team meeting');

  // the West team saves its meeting with a next step, which carries to its next team meeting until marked done
  const wd = teamDates('West'), d1 = wd[0], d2 = wd[1];
  const saved = await g(ann, 'pd/save', { agenda: { date: d1, kind: 'team', room: 'West', notes: 'We talked about the garden.', blocks: [{ title: 'The garden beds' }], steps: [{ id: 's1', text: 'Move the water table', who: 'Ann' }] } });
  assert.strictEqual(saved.status, 200);
  assert.strictEqual((await g(bea, 'pd/save', { agenda: { date: d1, kind: 'team', room: 'West', blocks: [] } })).status, 403, 'another Class cannot save it');
  let next = (await g(ann, 'pd/team', { room: 'West', date: d2 })).body;
  assert.deepStrictEqual(next.carried.map(x => x.text), ['Move the water table']);
  assert.strictEqual((await g(ann, 'pd/step', { id: d1 + '-team-West', step: 's1', done: true })).status, 200);
  next = (await g(ann, 'pd/team', { room: 'West', date: d2 })).body;
  assert.deepStrictEqual(next.carried, []);
  // a team meeting is not PD time
  assert.notStrictEqual((await g(dee, 'pd/hours', { id: d1 + '-team-West', names: ['Ann'] })).status, 200);
});
