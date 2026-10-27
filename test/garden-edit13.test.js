'use strict';
// Garden tasks marked Done or Passed and edited where they show, beds, plants and animal yards placed on the site map
// with the director choosing which labels the shared map shows, one Plants section with three views, and read-aloud
// page headings kept out of the story. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { start } = require('./fixture.js');

const SETUP = { id: 'garden', ready: true, mapPhoto: 'abc-garden-map.jpg', mapReady: true, beds: [{ id: 'b1', name: 'Bed one', space: 'garden', history: [] }],
  plants: [{ id: 'p1', common: 'Fig', bed: 'b1', uses: ['Food'], eat: 'food', care: [{ id: 'c1', month: '01', text: 'Prune the fig', stage: 'tend' }] }],
  animals: [{ id: 'a1', name: 'Goats', care: [{ id: 'g1', text: 'Fresh water', every: 'day' }] }], plan: { months: {} }, tending: { home: { b1: 'West' }, rotations: [] }, agreements: {} };

test('garden tasks and the map', async t => {
  const fx = await start({ more: put => { put('staff/garden/setup.json', SETUP); put('staff/garden/log.json', { id: 'gardenlog' }); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const G = (tok, p, b) => fx.as(tok, '/api/staff/garden' + (p ? '/' + p : ''), b || {});
  const mm = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(5, 7);
  const v = (await G(dee, 'task', { month: mm, text: 'Sow peas', stage: 'plant', bed: 'b1' })).body;
  const task = v.today.find(x => x.text === 'Sow peas');

  await t.test('Passed keeps who passed it, never counts as done work, and Done replaces it', async () => {
    const p = (await G(ann, 'done', { task: task.id, passed: true })).body.today.find(x => x.id === task.id);
    assert.strictEqual(p.done.by, 'Ann'); assert.strictEqual(p.done.passed, true);
    const d = (await G(ann, 'done', { task: task.id })).body.today.find(x => x.id === task.id);
    assert.strictEqual(d.done.passed, false);
  });

  await t.test('the director edits a task in place and the words change', async () => {
    const e = (await G(dee, 'task', { month: mm, id: task.id, text: 'Sow snap peas', stage: 'plant', bed: 'b1' })).body;
    assert.strictEqual(e.plan.months[mm].tasks.length, 1); assert.strictEqual(e.plan.months[mm].tasks[0].text, 'Sow snap peas');
    assert.strictEqual((await G(ann, 'task', { month: mm, id: task.id, text: 'x' })).status, 403, 'only the director edits');
  });

  await t.test('beds, plants and animal yards are placed and taken off, and the director chooses their labels', async () => {
    for (const k of ['bed:b1', 'plant:p1', 'animal:a1']) assert.strictEqual((await G(dee, 'map', { space: k, x: 0.3, y: 0.4 })).status, 200);
    let m = (await fx.as(ann, '/api/staff/sitemap', {})).body.map;
    assert.deepStrictEqual(m.spots.filter(s => s.detail).map(s => s.name).sort(), ['Bed one', 'Fig', 'Goats']);
    await G(dee, 'maplabels', { labels: { plant: false } });
    m = (await fx.as(ann, '/api/staff/sitemap', {})).body.map;
    assert.ok(!m.spots.some(s => s.name === 'Fig'), 'plant labels are off');
    const off = (await G(dee, 'map', { space: 'bed:b1', remove: true })).body;
    assert.ok(!off.mapSpots['bed:b1']);
  });
});

test('the page code', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', 'src', 'garden-ui.js'), 'utf8');
  const a = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  assert.match(g, /data-passed="1">Passed</);
  assert.match(g, /data-gtedit=/);
  assert.doesNotMatch(g, /The Fulton Community School plant guide/, 'the plant guide is a view of Plants');
  assert.match(g, />The list<\/button>.*>Plant cards<\/button>.*>Full plant pages<\/button>/s);
  assert.match(a, /pg=\/\^page\\s\*\\d\+\\s\*\$\/i/, 'Page 1 and the like never show in a story');
});
