'use strict';
// Step 2 of volunteering. The director's anytime and at-home job cards reach the Family page whole, I did this logs the
// time, every entry counts as a job, a community event, a conference or a donation, and a conference marked complete adds
// one hour for its child. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'once', 'volunteer-jobs.json'), 'utf8'));
const cat = n => SRC.categories.find(c => c.category === n).jobs;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

const more = put => {
  put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip', 'ivy'] }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  put('children/ivy.json', { first: 'Ivy', last: 'Test', classroom: 'North', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  put('participation/it-wish.json', { id: 'it-wish', kind: 'item', type: 'wish', title: 'Seeds for the season', hours: 1, test: true, signups: [] });
  // a conference already marked complete, and one only scheduled
  put('conferences/pip--2026-27-fall.json', { childId: 'pip', schoolYear: '2026-27', term: 'Fall', status: 'complete', confDate: today });
  put('conferences/ivy--2026-27-fall.json', { childId: 'ivy', schoolYear: '2026-27', term: 'Fall', status: 'open', confDate: today });
};
async function setup(t) {
  const fx = await start({ more }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  for (let i = 0; i < 100; i++) { const v = (await fx.as(dee, '/api/staff/volunteer', {})).body; if (v && v.loaded) break; await wait(200); }
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  return { fx, dee, fam, data: async () => (await fx.as(fam, '/family/data', {})).body };
}

test('the anytime and at-home cards reach the Family page whole, and I did this logs a job', async t => {
  const { fx, dee, fam, data } = await setup(t);
  const d = await data();
  assert.ok(d.jobs, 'the Family page has the job cards');
  assert.strictEqual(d.jobs.title, 'Jobs you can do anytime');
  assert.deepStrictEqual(d.jobs.groups.map(g => [g.name, g.jobs.length]), [['Anytime at school', 6], ['At home', 9]]);
  assert.deepStrictEqual(d.jobs.groups[0].jobs.map(j => j.title), cat('Quick Jobs at Pickup').map(j => j.title));
  const home = cat('At Home')[0], got = d.jobs.groups[1].jobs[0];
  for (const k of ['title', 'where', 'time', 'who', 'supplies', 'directions', 'take_care', 'done_when']) assert.deepStrictEqual(got[k], home[k], k + ' as the director wrote it');
  assert.strictEqual(d.jobs.intro.title, 'Before You Start'); assert.strictEqual(d.jobs.intro.guidelines.length, 14);
  // a school-day card waits for scheduled slots, and a family cannot log one by its id
  const lib = (await fx.as(dee, '/api/staff/volunteer', {})).body; const sd = lib.jobs.find(j => j.type === 'school-day');
  assert.ok(!d.jobs.groups.some(g => g.jobs.some(j => j.id === sd.id)));
  assert.match((await fx.as(fam, '/family/log', { jobId: sd.id, childId: 'pip', minutes: 30 })).body.error || '', /no longer listed/);
  // I did this, 40 minutes rounds up to an hour, for the child the family chooses
  const r = await fx.as(fam, '/family/log', { jobId: got.id, childId: 'ivy', date: today, minutes: 40 });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const e = (await data()).entries.find(x => x.what === home.title);
  assert.deepStrictEqual([e.type, e.hours, e.child], ['job', 1, 'Ivy']);
  // the director changes a card's type, and the Family page follows
  await fx.as(dee, '/api/staff/volunteer/type', { id: sd.id, type: 'anytime' });
  assert.ok((await data()).jobs.groups[0].jobs.some(j => j.id === sd.id));
  // her own words for the section, edited with Before You Start
  const pg = (await fx.as(dee, '/api/staff/page', { path: lib.paths.intro })).body;
  const parts = pg.parts.map(p => ({ body: p.body })); parts[3].body = 'Ways to help anytime';
  assert.strictEqual((await fx.as(dee, '/api/staff/page/save', { path: lib.paths.intro, stamp: pg.stamp, parts, note: 'A title', keep: true })).status, 200);
  assert.strictEqual((await data()).jobs.title, 'Ways to help anytime');
});

test('every entry has a type, and a completed conference adds one hour once', async t => {
  const { fx, dee, fam, data } = await setup(t);
  await fx.as(fam, '/family/log', { what: 'Brought jars', childId: 'pip', date: today, minutes: 30, type: 'donation' });
  await fx.as(fam, '/family/log', { itemId: 'it-wish', childId: 'pip', date: today });
  await fx.as(fam, '/family/log', { what: 'Came to the potluck', childId: 'pip', date: today, minutes: 120, type: 'event' });
  assert.match(JSON.stringify((await fx.as(fam, '/family/log', { what: 'A conference', childId: 'pip', date: today, minutes: 60, type: 'conference' })).body), /ok/);
  let d; for (let i = 0; i < 50; i++) { d = await data(); if (d.entries.some(x => x.type === 'conference')) break; await wait(200); }
  const by = w => d.entries.find(x => x.what === w);
  assert.strictEqual(by('Brought jars').type, 'donation'); assert.strictEqual(by('Seeds for the season').type, 'donation');
  assert.strictEqual(by('Came to the potluck').type, 'event'); assert.strictEqual(by('A conference').type, 'job', 'a family never enters a conference');
  const confs = d.entries.filter(x => x.type === 'conference');
  assert.deepStrictEqual(confs.map(x => [x.what, x.hours, x.child, x.mine]), [['Family conference', 1, 'Pip', false]], 'only the completed one, shown in test mode too');
  assert.strictEqual(d.children.find(k => k.first === 'Pip').hours, 1 + 1 + 2 + 1 + 1);
  assert.match((await fx.as(fam, '/family/unlog', { id: confs[0].id })).body.error || '', /not yours/);
  // the class team marks Ivy's complete, and its hour follows, once however often it is saved
  for (let i = 0; i < 2; i++) await fx.as(dee, '/api/write', { op: 'set', kind: 'conferences', id: 'ivy--2026-27-fall', data: { childId: 'ivy', schoolYear: '2026-27', term: 'Fall', status: 'complete', confDate: today, note: 'x' + i } });
  for (let i = 0; i < 50; i++) { d = await data(); if (d.entries.filter(x => x.type === 'conference').length === 2) break; await wait(200); }
  await wait(2000); d = await data();
  assert.deepStrictEqual(d.entries.filter(x => x.type === 'conference').map(x => x.child).sort(), ['Ivy', 'Pip']);
  // the director's Participation page reads each entry's type
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.html'), 'utf8');
  assert.match(app, /PT_LOGTYPE\[ptLogType\(l\)\]/);
});

test('on a phone, a family opens a card and logs it with I did this', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, fam } = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const p = await (await br.newContext({ viewport: { width: 390, height: 800 } })).newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([k]) => { localStorage.setItem('fam-token', k); }, [fam]);
  await p.goto(`http://localhost:${fx.web}/family.html?server=${fx.api}`); await p.waitForSelector('text=Taking part', { timeout: 10000 }); await p.click('text=Taking part');
  await p.waitForSelector('text=Jobs you can do anytime');
  const first = cat('Quick Jobs at Pickup')[0];
  assert.strictEqual(await p.evaluate(() => [...document.querySelectorAll('details.shared')].some(d => d.open)), false, 'every card starts folded');
  await p.click(`summary:has-text("${first.title}")`);
  const txt = await p.evaluate(() => document.body.innerText);
  assert.ok(txt.includes(first.directions[0])); assert.ok(txt.includes('Done when ' + first.done_when));
  assert.doesNotMatch(txt, /[—–]|\bteacher|\bClaude\b/);
  await p.click('details[open] [data-jobdid]'); await p.fill('details[open] input[type=number]', '0.5'); await p.selectOption('details[open] select', 'pip');
  await p.click('details[open] [data-jobsave]'); await p.waitForSelector(`.entry:has-text("${first.title}")`);
  assert.match(await p.innerText(`.entry:has-text("${first.title}")`), /Job[\s\S]*1 hour/);
  assert.deepStrictEqual(errors, []);
});
