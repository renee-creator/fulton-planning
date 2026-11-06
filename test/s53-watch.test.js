'use strict';
// The program watch counts glitches, user errors, slow pages and failing jobs, and each morning turns the last day into
// findings, each with a plan of correction, sent to the director. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const makeWatch = require('../watch.js');

// a clock that starts on a weekday at 6 in the morning in California, and moves on when asked
function clock() { let t = Date.parse('2026-11-04T14:00:00Z'); return { now: () => t, add: ms => { t += ms; } }; }

test('repeated trouble becomes findings with a plan, and the morning report reaches the director once', async () => {
  const c = clock(), sent = [], mailed = [], kept = [];
  let red = [];
  const w = makeWatch({ now: c.now, statusLines: () => red, notify: async m => sent.push(m), mail: async (s, b) => mailed.push({ s, b }), save: d => kept.push(d), scrub: t => t.replace(/\bMia\b/g, '[name]') });
  w.load(null);
  // one server error, a refused form seen by three people, a slow page and a job that could not run three times
  w.fromLog(['Request error', 'TypeError: x is undefined\n    at handle (/srv/server.js:120:5)']);
  for (const who of ['Ann', 'Bea', 'Cal']) w.refused('/api/write?x=1', 400, 'Add a week first.', who);
  for (let i = 0; i < 3; i++) { w.slow('/api/data', 5200); w.fromLog(['Menus from the Kitchen Digest could not be read', 'timeout']); }
  // routine lines and one-offs are not findings
  w.fromLog(['Backup sent,', 4, 'files']);
  w.refused('/api/write', 400, 'A one-off.', 'Ann');
  // a page's trouble message with a child's name, and a message that tells of something done
  for (const who of ['Ann', 'Bea', 'Cal']) assert.ok(w.fromPage({ kind: 'message', text: 'Mia could not be added to the group. Try again.', view: 'plans' }, who));
  assert.ok(!w.fromPage({ kind: 'message', text: 'Saved.', view: 'plans' }, 'Ann'));

  const f = w.findings();
  const kinds = f.map(x => x.kind).sort();
  assert.deepStrictEqual(kinds, ['error', 'job', 'slow', 'trouble', 'user']);
  assert.strictEqual(f[0].kind, 'error', 'the error comes first');
  for (const x of f) { assert.ok(Array.isArray(x.plan) && x.plan.length >= 2, 'each finding carries a plan'); assert.ok(x.type && x.severity && x.title); }
  const user = f.find(x => x.kind === 'user');
  assert.strictEqual(user.people, 3); assert.deepStrictEqual(user.where, ['/api/write']);
  assert.ok(!JSON.stringify(f).includes('Ann'), 'a person is counted, never named');

  // before 7 nothing is sent. After 7, one report, and only one that day
  assert.strictEqual(await w.tick(), null); assert.strictEqual(sent.length, 0);
  c.add(1.5 * 3600e3);
  const out = await w.tick();
  assert.strictEqual(out.length, 5); assert.strictEqual(sent.length, 1); assert.match(sent[0].title, /5 things to correct/);
  assert.strictEqual(mailed.length, 1); assert.match(mailed[0].b, /Plan of correction/);
  assert.strictEqual(await w.tick(), null); assert.strictEqual(sent.length, 1);
  assert.ok(kept.length >= 1, 'the counts are kept in the records');

  // outside TREE the names are taken out
  const outside = w.view(true);
  assert.ok(!JSON.stringify(outside).includes('Mia')); assert.ok(JSON.stringify(outside).includes('[name]'));

  // handled hides a finding until the trouble happens again
  w.handle(user.key, 'Dee');
  assert.ok(!w.findings().some(x => x.key === user.key));
  c.add(60e3); w.refused('/api/write', 400, 'Add a week first.', 'Ann');
  assert.ok(w.findings().some(x => x.key === user.key), 'it comes back when it happens again');

  // a red save line is urgent and goes out at once, at most once in six hours
  red = [[false, 'Saves are waiting to reach the records.']];
  await w.tick(); await w.tick();
  assert.strictEqual(sent.filter(m => /attention now/.test(m.title)).length, 1);
  assert.strictEqual(w.findings()[0].severity, 'urgent');
});

test('what was counted survives a restart, and a new day moves it to the history', () => {
  const c = clock(), kept = [];
  const a = makeWatch({ now: c.now, save: d => kept.push(d) }); a.load(null);
  for (let i = 0; i < 4; i++) a.fromLog(['Photos could not be sent to Google Drive', 'quota']);
  a.tick();
  const doc = kept[kept.length - 1]; assert.strictEqual(doc.items.length, 1);
  // the next day a new server reads what was kept
  c.add(24 * 3600e3);
  const b = makeWatch({ now: c.now }); b.fromLog(['Photos could not be sent to Google Drive', 'quota']); b.load(JSON.parse(JSON.stringify(doc)));
  const snap = b.snapshot();
  assert.strictEqual(snap.history.length, 1); assert.strictEqual(snap.history[0].totals.job, 4);
  assert.strictEqual(snap.items[0].count, 1);
  // yesterday's and today's are read together, so the job shows as five
  assert.strictEqual(b.findings().find(x => x.kind === 'job').count, 5);
});

test('the server gives the director the findings, takes page reports, and gives the outside report only with its key', async t => {
  process.env.WATCH_KEY = 'watch-key-for-tests-1';
  const { start } = require('./fixture.js');
  const fx = await start(); t.after(() => { delete process.env.WATCH_KEY; return fx.stop(); });
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  // a page error reported five times by two people, and an educator who may not read the watch
  for (let i = 0; i < 3; i++) assert.strictEqual((await fx.as(ann, '/api/watch/page', { kind: 'error', text: 'Cannot read properties of undefined', src: 'tree.html:10', view: 'plans' })).status, 200);
  assert.strictEqual((await fx.as(ann, '/api/watch')).status, 403);
  const r = await fx.as(dee, '/api/watch');
  assert.strictEqual(r.status, 200);
  const g = r.body.findings.find(x => x.kind === 'client');
  assert.ok(g, 'the page error is a finding'); assert.ok(g.plan.length >= 3);
  // marking it handled hides it
  const h = await fx.as(dee, '/api/watch/handled', { key: g.key });
  assert.ok(!h.body.findings.some(x => x.key === g.key));
  // the report outside TREE needs the key
  assert.strictEqual((await fetch(fx.api + '/watch/report')).status, 403);
  assert.strictEqual((await fetch(fx.api + '/watch/report', { headers: { 'x-tree-key': 'wrong' } })).status, 403);
  const o = await fetch(fx.api + '/watch/report', { headers: { 'x-tree-key': 'watch-key-for-tests-1' } });
  assert.strictEqual(o.status, 200);
  const j = await o.json(); assert.ok(Array.isArray(j.findings)); assert.ok(Array.isArray(j.status));
});
