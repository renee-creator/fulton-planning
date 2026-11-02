'use strict';
// The weekly reading on the team meeting agenda. A class's report starts its team meeting's agenda, with where the
// threads are, the threads to look at again and the ways to support. The whole school's report is offered for the
// director's all-staff meeting. A class team reads only its own class. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');
const monday = () => { const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

test('the weekly reading starts the team meeting agenda', async t => {
  const wk = monday();
  const rep = room => ({ id: wk + '-' + room, week: wk, room, emerging: 'Shadows are just appearing.', growing: 'Bridges, perhaps, as children return to them.', deepening: '', resting: 'Nothing has stepped away.', support: ['Could we leave the bridge standing for a week?', 'What might the shadow play need?'], lookAgain: [{ thread: 'Bridges', why: 'Observations rose each week while it is marked Emerging.' }] });
  const fx = await start({ more: put => { put('reports/' + wk + '-West.json', rep('West')); put('reports/' + wk + '-All.json', rep('All')); put('reports/' + wk + '-North.json', rep('North')); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const g = (tok, p, b) => fx.as(tok, '/api/staff/g/' + p, b || {});
  const date = new Date(Date.parse(wk + 'T12:00:00Z') + 7 * 864e5).toISOString().slice(0, 10);
  const r = (await g(ann, 'pd/team', { room: 'West', date })).body;
  assert.deepStrictEqual(r.start.slice(0, 3).map(b => b.title), ['From the reading of the week of ' + new Date(wk + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }), 'Threads to look at again', 'Ways the team might support']);
  assert.match(r.start[0].why, /^Emerging\. Shadows[\s\S]*Growing\. Bridges[\s\S]*Resting\./); assert.doesNotMatch(r.start[0].why, /Deepening/);
  assert.match(r.start[1].why, /Bridges\. Observations rose[\s\S]*Threads page, under More/);
  assert.strictEqual(r.start[2].ideas.length, 2); assert.strictEqual(r.reading.length, 3);
  // the ways to support survive a save
  const saved = (await g(ann, 'pd/save', { agenda: { date, kind: 'team', room: 'West', blocks: r.start, steps: [{ text: r.start[2].ideas[0], who: 'Ann' }] } })).body;
  assert.deepStrictEqual(saved.agenda.blocks[2].ideas, r.start[2].ideas); assert.ok(saved.agenda.blocks[0].reading);
  // a class team reads only its own class, and the whole school is the director's
  assert.strictEqual((await g(ann, 'pd/reading', { room: 'North', date })).status, 403);
  assert.strictEqual((await g(ann, 'pd/reading', { room: 'All', date })).status, 403);
  assert.strictEqual((await g(dee, 'pd/reading', { room: 'All', date: wk })).body.blocks[0].title, "From this week's reading");
  assert.deepStrictEqual((await g(dee, 'pd/reading', { room: 'All', date: '2020-01-06' })).body.blocks, [], 'no reading before the first one');
});

test('on the page, a way to support becomes a next step', async t => {
  const { browser, signedIn } = require('./fixture.js');
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const wk = monday();
  const fx = await start({ more: put => { put('reports/' + wk + '-West.json', { id: wk + '-West', week: wk, room: 'West', emerging: 'Shadows are just appearing.', growing: '', deepening: '', resting: '', support: ['Could we leave the bridge standing for a week?'], lookAgain: [] }); } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 390); const errors = []; s.p.on('pageerror', e => errors.push(e.message));
  await s.p.evaluate(() => goView('stpdd')); await s.p.waitForSelector('text=West class team meeting', { timeout: 15000 });
  await s.p.evaluate(() => { const x = [...document.querySelectorAll('[data-gpd]')].find(b => /team/.test(b.dataset.gpd)); x.click(); });
  await s.p.waitForSelector('[data-gpdedit="1"]', { timeout: 15000 }); await s.p.click('[data-gpdedit="1"]');
  await s.p.waitForSelector('[data-gidea="0|0"], [data-gidea]', { timeout: 15000, state: 'attached' });
  await s.p.evaluate(() => document.querySelector('[data-gidea]').click());
  await s.p.waitForFunction(() => [...document.querySelectorAll('[data-gstp$="|text"]')].some(x => /bridge standing/.test(x.value)), null, { timeout: 10000 });
  assert.deepStrictEqual(errors, []);
});
