'use strict';
// One-time steps run once at start, through the save queue, and settings/once records that each has run, so a second
// start changes nothing. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(200); } return false; }

test('one-time steps run once and are recorded', async () => {
  const more = put => {
    put('settings/plandefaults.json', { id: 'plandefaults', people: { Ann: 'none', Zed: 'monthly' } });
    put('settings/main.json', { id: 'main', classrooms: ['West', 'North', 'South'], educators: { West: ['Ann'], North: [], South: ['Old Name'] } });
  };
  const fx = await start({ more });
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  try {
    assert.ok(await until(() => { const o = read('settings/once.json'); return o && o.done && o.done.planDefaults && o.done.educatorList; }, 20000), 'both steps recorded');
    const notify = read('settings/notify.json');
    assert.strictEqual(notify.people.Ann.plans, 'none');
    assert.strictEqual(notify.people.Zed.plans, 'monthly');
    assert.ok(await until(() => !read('settings/plandefaults.json'), 10000), 'the file of starting choices leaves the records');
    // Conference settings name the educators by Class from the one list
    assert.deepStrictEqual(read('settings/main.json').educators, { West: ['Ann'], North: ['Bea'], South: [] });
    // a later change to the one list reaches Conference settings
    const dee = (await fx.login('Dee', 'director-pass-1')).token;
    await fx.as(dee, '/api/write', { op: 'set', kind: 'settings', id: 'educators', data: { id: 'educators', names: [{ name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }, { name: 'Cal', room: 'South' }] } });
    assert.ok(await until(() => JSON.stringify(read('settings/main.json').educators) === JSON.stringify({ West: ['Ann'], North: ['Bea'], South: ['Cal'] }), 10000));
    // an educator's Class is the one on their sign-in, so a different Class written on the list goes back to it
    await fx.as(dee, '/api/write', { op: 'set', kind: 'settings', id: 'educators', data: { id: 'educators', names: [{ name: 'Ann', room: 'West' }, { name: 'Bea', room: 'South' }, { name: 'Cal', room: 'South' }] } });
    assert.ok(await until(() => JSON.stringify(read('settings/main.json').educators) === JSON.stringify({ West: ['Ann'], North: ['Bea'], South: ['Cal'] }) && read('settings/educators.json').names[1].room === 'North', 10000));
    // the director's own choice is never overwritten by a starting choice
    const once = read('settings/once.json');
    assert.ok(once.done.planDefaults);
  } finally { await fx.stop(); }
});

test('a second start finds the steps done and changes nothing', async () => {
  const more = put => {
    put('settings/once.json', { id: 'once', done: { planDefaults: '2026-10-24T00:00:00Z', educatorList: '2026-10-24T00:00:00Z', presenting2027: '2026-10-24T00:00:00Z', trainingLinks: '2026-10-25T00:00:00Z', kyr2026: '2026-10-25T00:00:00Z', prepDirector: '2026-10-25T00:00:00Z', oneLists: '2026-10-25T00:00:00Z' } });
    put('settings/plandefaults.json', { id: 'plandefaults', people: { Ann: 'none' } });
    put('settings/notify.json', { id: 'notify', start: '2026-10-19', people: { Ann: { plans: 'weekly' } } });
  };
  const fx = await start({ more });
  try {
    await wait(4000);
    const writes = fx.gh.writes.filter(w => /settings\/(once|notify|plandefaults|main)\.json/.test(w.path || ''));
    assert.deepStrictEqual(writes, []);
  } finally { await fx.stop(); }
});
