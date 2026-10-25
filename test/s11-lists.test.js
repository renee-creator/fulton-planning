'use strict';
// Session 11, one source of truth. The Classes and small groups are one list each in Program settings, the spaces are
// the calendar's, and Conferences, the calendar and every page read them from there. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

test('the Classes, small groups and spaces become one list each, and the differences are kept for the director', async t => {
  const fx = await start({ more: put => {
    put('settings/main.json', { id: 'main', classrooms: ['West', 'North'], years: ['2026-27'], groups: [{ name: 'Fern', room: 'West', educator: 'Ann' }] });
    put('settings/program.json', { id: 'program', groups: [{ name: 'Fern', room: 'West', educator: 'Ann' }, { name: 'Moss', room: 'North', educator: 'Bea' }], places: ['Library', 'Classroom', 'Art atelier'] });
    put('calendar/settings/program.json', { calendars: [{ id: 'cal1', name: 'School', color: 'sky' }], spaces: [{ id: 'library', name: 'Library', color: 'moss', note: '', shared: false, hidden: false, byWeek: false }, { id: 'garden', name: 'Garden', color: 'moss', note: '', shared: false, hidden: false, byWeek: false }], dayStart: 420, dayEnd: 1080, weekends: true, classes: ['West', 'North', 'East'], groups: [{ name: 'Fern', room: 'West' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const read = rel => JSON.parse(fs.readFileSync(path.join(fx.dir, rel), 'utf8'));
  for (let i = 0; i < 40 && !fs.existsSync(path.join(fx.dir, 'settings/onelists.json')); i++) await wait(250);
  await wait(1500);
  const pg = read('settings/program.json');
  assert.deepStrictEqual(pg.classrooms, ['West', 'North'], 'the Classes Conference settings kept become Program settings\' list');
  assert.deepStrictEqual(pg.places, ['Library', 'Classroom', 'Art atelier'], 'the old Where it happens list stays as it was');
  const diff = read('settings/onelists.json').differences.join('\n');
  assert.match(diff, /Calendar settings listed the Classes as West, North, East/);
  assert.match(diff, /Conference settings listed the small groups as Fern in West\. Program settings keeps Fern in West, Moss in North/);
  assert.match(diff, /Art atelier joined the spaces, kept off the sign-up list/);
  assert.match(diff, /The calendar's spaces had Garden/);
  const cal = read('calendar/settings/program.json');
  const art = cal.spaces.find(s => s.name === 'Art atelier');
  assert.ok(art && art.hidden, 'a place only Program settings had joins the spaces, off the sign-up list');
  assert.ok(!cal.spaces.some(s => /^classroom$/i.test(s.name)), 'Classroom on its own is each Class\'s classroom space');
  assert.deepStrictEqual(cal.classes, ['West', 'North', 'East'], 'what the calendar kept stays in its record');
  // the calendar reads the one list
  const v = await fx.as(ann, '/api/view', { from: '2026-11-02', to: '2026-11-02' });
  assert.deepStrictEqual(v.body.settings.classes, ['West', 'North']);
  assert.deepStrictEqual(v.body.settings.groups.map(g => g.name), ['Fern', 'Moss']);
  // a Calendar settings save keeps the Classes it holds and never changes the one list
  const prog = JSON.parse(JSON.stringify(v.body.settings)); prog.classes = ['Nowhere']; prog.groups = [];
  const s = await fx.as(dee, '/api/settings', { program: prog });
  assert.strictEqual(s.status, 200, JSON.stringify(s.body));
  await wait(1200);
  assert.deepStrictEqual(read('calendar/settings/program.json').classes, ['West', 'North', 'East']);
  // a new Class in Program settings reaches the calendar
  await fx.as(dee, '/api/write', { op: 'update', kind: 'settings', id: 'program', patch: { classrooms: ['West', 'North', 'South'] } });
  const v2 = await fx.as(ann, '/api/view', { from: '2026-11-03', to: '2026-11-03' });
  assert.deepStrictEqual(v2.body.settings.classes, ['West', 'North', 'South']);
  // the step runs once
  const once = read('settings/once.json').done;
  assert.ok(once.oneLists);
});

test('no page keeps its own list of Classes or small groups', () => {
  const tree = fs.readFileSync(path.join(ROOT, 'tree.html'), 'utf8');
  assert.doesNotMatch(tree, /CLASSROOMS=\["West","North","South"\]/);
  assert.doesNotMatch(tree, /\{name:"Cosmos",room:"West"/);
  assert.doesNotMatch(tree, /let PLACES=\["Library"/);
  const conf = fs.readFileSync(path.join(ROOT, 'tree-conferences.html'), 'utf8');
  assert.doesNotMatch(conf, /classrooms:\["West","North","South"\]/);
  assert.doesNotMatch(conf, /id="s-rooms"|id="s-groups"/);
  const cal = fs.readFileSync(path.join(ROOT, 'tree-calendar.html'), 'utf8');
  assert.doesNotMatch(cal, /id="set-classes"|id="set-groups"/);
  for (const f of ['growth.js', 'staff.js', 'garden.js', 'src/staff-app.js']) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /\[\s*['"]West['"],\s*['"]North['"],\s*['"]South['"]\s*\]/, f);
});
