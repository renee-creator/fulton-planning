'use strict';
// Presenting, under Educators. Who receives each entry, the starting entries, evidence from the records and a presenter's
// credit. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');
const fx = require('./fixture.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }, { name: 'Kit', kitchen: true, role: 'staff' }, { name: 'Neo', newHire: true }, { name: 'Shared', renderOnly: true }];
async function school() {
  const h = await loaded(LIST);
  const day = ms => Date.now() - ms * 864e5;
  h.store.recs.notices = new Map([
    ['n1', { doc: { noticed: 'Two children drew with chalk on the path. The next day they returned to the drawing and added more lines.', wonder: 'What did the lines mean to them?', classroom: 'West', by: 'Ann', at: day(2), children: ['k1'] } }],
    ['n2', { doc: { noticed: 'A group built a tall tower of blocks.', wonder: '', classroom: 'North', by: 'Bea', at: day(1), children: ['k2'] } }]]);
  h.store.recs.children.set('k1', { doc: { first: 'Zed', dob: '2024-05-01', classroom: 'West', status: 'active' } });
  h.store.recs.children.set('k2', { doc: { first: 'Yul', dob: '2021-05-01', classroom: 'North', status: 'active' } });
  const list = (await call(h.staff, 'Dir', 'pres/list')).body.list;
  return { h, trace: list.find(x => x.title === 'Leaving a Trace'), twos: list.find(x => x.title === 'Serving Two-Year-Olds') };
}

test('the two starting entries are made once, and stay once after TREE starts again', async () => {
  const { h, trace, twos } = await school();
  assert.ok(trace && twos);
  const t = (await call(h.staff, 'Dir', 'pres/get', { id: trace.id })).body;
  assert.strictEqual(t.subtitle, 'Ephemeral Encounters, Enduring Possibilities'); assert.strictEqual(t.date, '2027-05-22'); assert.strictEqual(t.minutes, 180);
  assert.strictEqual(t.question, 'What is the child trying to make happen?'); assert.strictEqual(t.names, 'none');
  assert.ok(!/Graphic/.test(t.title), 'the lens is not in the title');
  await h.staff.load(); await h.staff.load();
  assert.strictEqual((await call(h.staff, 'Dir', 'pres/list')).body.list.length, 2);
});

test('an educator receives an entry only as a presenter, until it is presented, and then only what is safe', async () => {
  const { h, trace } = await school();
  for (const n of ['Ann', 'Bea']) { assert.deepStrictEqual((await call(h.staff, n, 'pres/list')).body.list, []); assert.strictEqual((await call(h.staff, n, 'pres/get', { id: trace.id })).status, 404); }
  assert.strictEqual((await call(h.staff, 'Ann', 'pres/new', { title: 'Mine' })).status, 403, 'only the director starts an entry');
  await call(h.staff, 'Dir', 'pres/save', { id: trace.id, fields: { presenters: ['Ann', 'Kit', 'Neo'] } });
  const e = (await call(h.staff, 'Dir', 'pres/get', { id: trace.id })).body;
  assert.deepStrictEqual(e.presenters, ['Ann'], 'the kitchen and a new educator are not presenters');
  assert.strictEqual((await call(h.staff, 'Ann', 'pres/get', { id: trace.id })).status, 200);
  assert.strictEqual((await call(h.staff, 'Ann', 'boot')).body.can.presenting, true);
  assert.strictEqual((await call(h.staff, 'Bea', 'boot')).body.can.presenting, false);
  for (const p of ['get', 'evidence', 'item']) assert.strictEqual((await call(h.staff, 'Bea', 'pres/' + p, { id: trace.id, list: 'notes', item: { text: 'x' } })).status, 404, p);
  assert.strictEqual((await call(h.staff, 'Kit', 'pres/list')).status, 403);
  assert.strictEqual((await call(h.staff, 'Shared', 'pres/list')).status, 403);
  // a presenter works on the entry, and leaves the presenters and names to the director
  assert.strictEqual((await call(h.staff, 'Ann', 'pres/item', { id: trace.id, list: 'notes', item: { text: 'PRIVATE note' } })).status, 200);
  await call(h.staff, 'Ann', 'pres/item', { id: trace.id, list: 'readings', item: { kind: 'drive', url: 'https://drive.google.com/file/d/x', title: 'PRIVATE guide' } });
  await call(h.staff, 'Ann', 'pres/item', { id: trace.id, list: 'plan', item: { title: 'Opening', minutes: 20, do: 'Look at the panels in pairs.' } });
  assert.strictEqual((await call(h.staff, 'Ann', 'pres/save', { id: trace.id, fields: { presenters: ['Ann', 'Bea'] } })).status, 403);
  assert.strictEqual((await call(h.staff, 'Ann', 'pres/presented', { id: trace.id })).status, 403);
  // presented: Bea reads it, without the notes, meetings, evidence or Drive files
  assert.strictEqual((await call(h.staff, 'Dir', 'pres/presented', { id: trace.id })).status, 200);
  const r = await call(h.staff, 'Bea', 'pres/get', { id: trace.id });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.edit, false);
  assert.ok(!/PRIVATE/.test(JSON.stringify(r.body))); assert.ok(!('notes' in r.body) && !('meetings' in r.body) && !('evidence' in r.body) && !('look' in r.body));
  assert.strictEqual(r.body.plan[0].title, 'Opening');
  assert.strictEqual((await call(h.staff, 'Bea', 'pres/item', { id: trace.id, list: 'notes', item: { text: 'x' } })).status, 403);
  assert.strictEqual((await call(h.staff, 'Neo', 'pres/get', { id: trace.id })).status, 403, 'a new educator before full access');
});

test('evidence comes from the records, says why it fits by quoting them, and a kept moment joins Chosen moments', async () => {
  const { h, trace, twos } = await school();
  const ev = (await call(h.staff, 'Dir', 'pres/evidence', { id: trace.id })).body;
  assert.strictEqual(ev.items.length, 1); const x = ev.items[0];
  assert.strictEqual(x.key, 'obs:n1'); assert.strictEqual(x.room, 'West');
  assert.match(x.why, /Traces that may not last\. It names chalk, “Two children drew with chalk on the path\.”/);
  assert.match(x.why, /Traces that endure\. It names returned/);
  assert.doesNotMatch(x.why, /[—–]/);
  const tw = (await call(h.staff, 'Dir', 'pres/evidence', { id: twos.id })).body;
  assert.deepStrictEqual(tw.items.map(i => i.key), ['obs:n1'], 'the youngest children, under three that day');
  assert.strictEqual(tw.youngClass, 'West');
  let e = (await call(h.staff, 'Dir', 'pres/decide', { id: trace.id, key: 'obs:n1', keep: true })).body;
  assert.strictEqual(e.chosen.length, 1); assert.strictEqual(e.chosen[0].text.slice(0, 12), 'Two children');
  e = (await call(h.staff, 'Dir', 'pres/choose', { id: trace.id, obs: 'n2' })).body; assert.strictEqual(e.chosen.length, 2);
  e = (await call(h.staff, 'Dir', 'pres/order', { id: trace.id, list: 'chosen', ids: [e.chosen[1].id, e.chosen[0].id] })).body;
  assert.strictEqual(e.chosen[0].from, 'obs:n2');
  e = (await call(h.staff, 'Dir', 'pres/decide', { id: trace.id, key: 'obs:n1', keep: false })).body;
  assert.strictEqual(e.chosen.length, 1); assert.strictEqual((await call(h.staff, 'Dir', 'pres/evidence', { id: trace.id })).body.items[0].state, 'aside');
  // licensing references come only from CCLD or CDSS
  assert.strictEqual((await call(h.staff, 'Dir', 'pres/item', { id: trace.id, list: 'readings', item: { kind: 'licensing', url: 'https://example.com/title22', title: 'x' } })).status, 400);
  assert.strictEqual((await call(h.staff, 'Dir', 'pres/item', { id: trace.id, list: 'readings', item: { kind: 'licensing', url: 'https://www.cdss.ca.gov/x.pdf', title: 'Title 22' } })).status, 200);
});

test('a presenter is credited once with Fulton PD hours, a line on the growth page and a Proud Moment offer', async () => {
  const { h, trace } = await school();
  await call(h.staff, 'Dir', 'pres/save', { id: trace.id, fields: { presenters: ['Ann'] } });
  await call(h.staff, 'Dir', 'pres/presented', { id: trace.id }); await call(h.staff, 'Dir', 'pres/save', { id: trace.id, fields: { presenters: ['Ann'] } });
  const hrs = (await call(h.staff, 'Ann', 'person', {})).body.hours.filter(x => x.kind === 'presenting');
  assert.strictEqual(hrs.length, 1); assert.strictEqual(hrs[0].hours, 3); assert.strictEqual(hrs[0].by, 'TREE'); assert.strictEqual(hrs[0].approved, false);
  assert.strictEqual((await call(h.staff, 'Ann', 'g/mine', {})).body.led[0].title, 'Leaving a Trace');
  assert.deepStrictEqual((await call(h.staff, 'Ann', 'pres/get', { id: trace.id })).body.mine, { hours: true, moment: '' });
  await call(h.staff, 'Ann', 'g/moments/add', { moment: { text: 'I led it.', audience: 'class', link: { kind: 'presenting', id: trace.id, label: 'Presenting, Leaving a Trace' } } });
  assert.strictEqual((await call(h.staff, 'Ann', 'pres/get', { id: trace.id })).body.mine.moment, 'shared');
  // a copy starts a new entry with nothing of the day itself
  const c = (await call(h.staff, 'Dir', 'pres/copy', { id: trace.id, title: 'Leaving a Trace again' })).body;
  assert.strictEqual(c.status, 'planning'); assert.deepStrictEqual(c.presenters, []); assert.strictEqual(c.date, '');
  // marking it not presented takes the hours it logged away
  await call(h.staff, 'Dir', 'pres/presented', { id: trace.id, undo: true });
  assert.strictEqual((await call(h.staff, 'Ann', 'person', {})).body.hours.filter(x => x.kind === 'presenting').length, 0);
});

test('a PD day block opens a Presenting entry, and its title reaches only those who may read it', async () => {
  const { h, trace } = await school();
  const date = new Date(Date.now() + 5 * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  await call(h.staff, 'Dir', 'g/pd/add', { date, kind: 'pdday' });
  await call(h.staff, 'Dir', 'g/pd/save', { agenda: { date, kind: 'pdday', blocks: [{ title: 'Leaving a Trace', presenting: trace.id }] } });
  assert.strictEqual((await call(h.staff, 'Dir', 'pres/get', { id: trace.id })).body.agendas[0].date, date);
  const blk = l => l.body.list.find(x => x.date === date).agenda.blocks[0];
  assert.strictEqual(blk(await call(h.staff, 'Dir', 'g/pd/list', {})).presTitle, 'Leaving a Trace');
  assert.ok(!('presenting' in blk(await call(h.staff, 'Bea', 'g/pd/list', {}))), 'not sent to an educator who cannot read the entry');
  await call(h.staff, 'Dir', 'pres/save', { id: trace.id, fields: { presenters: ['Bea'] } });
  assert.strictEqual(blk(await call(h.staff, 'Bea', 'g/pd/list', {})).presTitle, 'Leaving a Trace');
});

test('Presenting opens for the director and for a presenter on a phone, with no page errors', async t => {
  const chromium = await fx.browser(); if (!chromium) return t.skip('Playwright is not installed here');
  const f = await fx.start(); const b = await chromium.launch();
  try {
    const dt = (await f.login('Dee', 'director-pass-1')).token;
    const list = (await f.as(dt, '/api/staff/pres/list')).body.list; const trace = list.find(x => x.title === 'Leaving a Trace');
    await f.as(dt, '/api/staff/pres/save', { id: trace.id, fields: { presenters: ['Ann'] } });
    const d = await fx.signedIn(f, b, 'Dee', 'director-pass-1', 1280);
    await d.p.evaluate(() => goView('stpres')); await d.p.waitForSelector(`[data-prsel="${trace.id}"]`, { timeout: 15000 });
    assert.ok(await d.p.evaluate(() => [...document.querySelectorAll('#tsubnav .stpages .sub')].some(x => x.textContent === 'Presenting')), 'Presenting sits under PD and Licensing');
    await d.p.click(`[data-prsel="${trace.id}"]`); await d.p.waitForSelector('details[data-fold="pres:notes"]');
    assert.strictEqual(await d.p.evaluate(() => [...document.querySelectorAll('details.fold')].every(x => !x.open)), true, 'each part opens closed');
    await d.p.click('details[data-fold="pres:notes"] summary');
    await d.p.fill('#prn-note', 'A first idea'); await d.p.click('[data-pradd="notes"]'); await d.p.waitForFunction(() => document.querySelector('#main').innerText.includes('A first idea'));
    assert.deepStrictEqual(d.errors, []); await d.close();
    const a = await fx.signedIn(f, b, 'Ann', '1357', 390);
    await a.p.evaluate(() => goView('stpres')); await a.p.waitForSelector(`[data-prsel="${trace.id}"]`, { timeout: 15000 });
    await a.p.click(`[data-prsel="${trace.id}"]`); await a.p.waitForSelector('details[data-fold="pres:plan"]');
    assert.strictEqual(await a.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepStrictEqual(a.errors, []); await a.close();
    const bt = (await f.login('Bea', '1357')).token;
    assert.strictEqual((await f.as(bt, '/api/staff/pres/get', { id: trace.id })).status, 404);
  } finally { await b.close(); await f.stop(); }
});

test('the presenting details live only in the records, with no copy in the public code', () => {
  const fs = require('fs'), path = require('path');
  const src = ['presenting.js', 'staff.js', 'server.js', 'src/presenting-app.js'].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  // the step that wrote them has run, so nothing is left to write them again
  assert.doesNotMatch(src, /details2027|presentingDetails/);
  assert.doesNotMatch(src, /eventbrite\.com|dateNote: 'To be|meetingsNote = \[/i);
  assert.doesNotMatch(src, /Fulton Road/);
});
