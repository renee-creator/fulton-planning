'use strict';
// a conference on the calendar reads Conference, the child's name and Class, matched to the slot it was booked in
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const laDay = add => new Date(Date.now() + add * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

test('conference slots read as the family booked in them, and an open slot reads Open conference time', async t => {
  const day = laDay(3), ymd = day.replace(/-/g, '');
  const ev = (uid, a, b) => `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260101T000000Z\r\nDTSTART:${ymd}T${a}00\r\nDTEND:${ymd}T${b}00\r\nSUMMARY:Fulton Fall Conferences\r\nDESCRIPTION:A parent name\r\nEND:VEVENT\r\n`;
  const feed = () => 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:test\r\nX-WR-CALNAME:Conferences\r\n' + ev('a', '1300', '1320') + ev('b', '1300', '1320') + ev('c', '1320', '1340') + ev('d', '1340', '1400') + 'END:VCALENDAR\r\n';
  const kid = (put, id, first, room, dob) => put(`children/${id}.json`, { first, last: 'Test', classroom: room, dob, status: 'enrolled' });
  const conf = (put, id, time) => put(`conferences/${id}--c.json`, { childId: id, schoolYear: '2026-27', term: 'Fall', status: 'open', fields: {}, reflections: {}, prep: {}, attachments: [], confDate: day, confTime: time, signup: 'signedup', teacher: 'Ann' });
  const fx = await start({ feed, more: put => {
    kid(put, 'juno', 'Juno', 'North', '2022-01-05'); kid(put, 'pip', 'Pip', 'West', '2022-02-05'); kid(put, 'rue', 'Rue', 'South', '2022-03-05'); kid(put, 'ivy', 'Ivy', 'North', '2022-' + day.slice(5));
    conf(put, 'juno', '13:00'); conf(put, 'pip', '13:00'); conf(put, 'rue', '13:45'); } });
  t.after(() => fx.stop());
  const view = async (name, pass) => { const j = await fx.login(name, pass); const r = await fx.as(j.token, '/api/view', { from: day, to: day }); assert.strictEqual(r.status, 200, name); return r.body.events; };

  const dir = await view('Dee', 'director-pass-1');
  const confs = dir.filter(e => e.conf).map(e => e.start.slice(11) + ' ' + e.title).sort();
  assert.deepStrictEqual(confs, ['13:00 Conference, Juno, North', '13:00 Conference, Pip, West', '13:20 Open conference time', '13:40 Conference, Rue, South']);
  for (const e of dir.filter(e => e.conf)) { assert.strictEqual(e.desc, ''); assert.strictEqual(e.cal, 'cal3'); }
  assert.ok(!dir.some(e => /Fulton Fall Conferences|'s family/.test(e.title)));

  const ann = await view('Ann', '1357');
  assert.ok(ann.some(e => e.title === 'Conference, Juno, North'));
  const kit = await view('Kit', '1357');
  assert.ok(kit.some(e => e.title === "Ivy's birthday"), 'the kitchen keeps children\'s birthdays');
  assert.ok(kit.filter(e => e.conf).every(e => e.title === 'Open conference time'), 'the kitchen never sees whose conference it is');
  // no calendar entry carries a child's record id, which holds their full name and birthday
  for (const list of [dir, ann, kit]) for (const e of list) assert.ok(!/(juno|pip|rue|ivy)/.test(String(e.id) + String(e.confId || '')), 'no child record id in ' + e.id);
});
