'use strict';
// Fixes from the November review. Only the director and office change a parent's email, a family-hosted gathering takes
// its hours from its times, a second tap of Save logs nothing twice, a long entry is marked for the office, First Friday
// follows new times, wrong passcodes lock the matched sign-in and the lock is kept, and the backup has its own key.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const soon = (() => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 10); return d.toISOString().slice(0, 10); })();
const more = put => {
  put('participation/config.json', { id: 'config', test: true, firstFriday: { on: true, start: '08:30', end: '09:00' },
    testers: [{ email: 'pip.family@example.test', children: ['pip'] }], roles: [{ name: 'Rosa Rep', email: 'pip.family@example.test', role: 'rep', classroom: 'West' }] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ name: 'Rosa Rep', email: 'pip.family@example.test' }, { name: 'Sam Rep', email: 'sam.family@example.test' }] });
};
const readJson = (fx, rel) => { try { return JSON.parse(fs.readFileSync(path.join(fx.dir, rel), 'utf8')); } catch (e) { return null; } };

test('parent emails, gathering times, a second tap, long entries and First Friday times', async t => {
  const fx = await start({ more }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, gia = (await fx.login('Gia', '1357')).token;
  // an educator's save keeps each parent's email, and a parent the educator adds gets none
  await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'pip', patch: { parents: [{ name: 'Rosa Rep', email: 'someone.else@example.test' }, { name: 'Sam Rep', email: 'sam.family@example.test' }, { name: 'New Person', email: 'new@example.test' }] } });
  await wait(1500);
  let k = readJson(fx, 'children/pip.json');
  assert.deepStrictEqual(k.parents.map(p => p.email), ['pip.family@example.test', 'sam.family@example.test', undefined]);
  // the office changes it
  await fx.as(gia, '/api/write', { op: 'update', kind: 'children', id: 'pip', patch: { parents: [{ name: 'Rosa Rep', email: 'pip.family@example.test' }, { name: 'Sam Rep', email: 'sam.new@example.test' }] } });
  await wait(1500); k = readJson(fx, 'children/pip.json');
  assert.deepStrictEqual(k.parents.map(p => p.email), ['pip.family@example.test', 'sam.new@example.test']);

  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const fam = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  const data = async () => (await fx.as(fam, '/family/data', {})).body;
  // a gathering cannot end before it starts, and its hours follow its times
  assert.match((await fx.as(fam, '/family/gather', { title: 'Book talk', date: soon, start: '11:00', end: '10:00' })).body.error || '', /end time comes after/);
  assert.strictEqual((await fx.as(fam, '/family/gather', { title: 'Book talk', date: soon, start: '10:00', end: '11:20', hours: 4 })).status, 200);
  let d = await data(); assert.strictEqual(d.open.find(x => x.title === 'Book talk').hours, 1.5);
  // a second tap of Save logs nothing twice, and minutes typed as hours get a plain answer
  for (let i = 0; i < 2; i++) await fx.as(fam, '/family/log', { what: 'Peeled crayons', date: today, minutes: 60, childId: 'pip', type: 'job' });
  d = await data(); assert.strictEqual(d.entries.filter(e => e.what === 'Peeled crayons').length, 1);
  assert.match((await fx.as(fam, '/family/log', { what: 'Washed smocks', date: today, minutes: 30 * 60, childId: 'pip', type: 'job' })).body.error || '', /box is in hours, so 30 minutes is 0\.5/);
  // a long entry still counts and is marked for the office
  await fx.as(fam, '/family/log', { what: 'Built the garden fence', date: today, minutes: 5 * 60, childId: 'pip', type: 'job' });
  d = await data(); assert.strictEqual(d.children[0].hours, 6);
  await wait(1500);
  const logs = fs.readdirSync(path.join(fx.dir, 'participation')).map(f => readJson(fx, 'participation/' + f)).filter(x => x && x.kind === 'log');
  assert.match(logs.find(x => x.what === 'Built the garden fence').check || '', /four hours/);
  assert.ok(!logs.find(x => x.what === 'Peeled crayons').check);
  // First Friday follows new times, unless one was changed by hand
  let ff = d.open.filter(x => x.title === 'First Friday Morning Coffee, Tea and Chat'); assert.ok(ff.length >= 1); assert.strictEqual(ff[0].start, '08:30');
  const cfg = readJson(fx, 'participation/config.json');
  await fx.as(dee, '/api/write', { op: 'set', kind: 'participation', id: 'config', data: Object.assign({}, cfg, { firstFriday: { on: true, start: '08:15', end: '09:15' } }) });
  await wait(500); d = await data(); ff = d.open.filter(x => x.title === 'First Friday Morning Coffee, Tea and Chat');
  assert.ok(ff.every(x => x.start === '08:15' && x.end === '09:15'), JSON.stringify(ff.map(x => [x.start, x.end])));
});

test('wrong passcodes lock the matched sign-in, and the lock is kept with the sign-ins', async t => {
  const fx = await start({}); t.after(() => fx.stop());
  for (let i = 0; i < 5; i++) await fx.as('', '/login', { name: 'Ann', passcode: '0000' });
  const r = await fx.as('', '/login', { name: 'Ann', passcode: '1357' });
  assert.strictEqual(r.status, 429);
  await wait(1500);
  const acc = readJson(fx, 'access/accounts.json').accounts.find(a => a.name === 'Ann');
  assert.ok(acc.lock && acc.lock.until > Date.now(), 'the lock is saved');
});

test('the backup has its own key once it is set, and a large request is refused before sign-in', async t => {
  const fx = await start({ env: { KAYMBU_INBOX_KEY: 'inbox-key', BACKUP_KEY: 'backup-key' } }); t.after(() => fx.stop());
  const api = fx.api;
  const post = (p, key) => fetch(api + p, { method: 'POST', headers: { 'x-tree-key': key, 'Content-Type': 'application/json' }, body: '{}' });
  assert.strictEqual((await post('/inbound/backup', 'inbox-key')).status, 403);
  let r; for (let i = 0; i < 60; i++) { r = await post('/inbound/backup', 'backup-key'); if (r.status === 200) break; await wait(500); }
  assert.strictEqual(r.status, 200);
  const big = 'x'.repeat(400 * 1024);
  const f = await fetch(api + '/family/recipe', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web }, body: JSON.stringify({ title: big }) });
  assert.strictEqual(f.status, 413);
  const s = await fetch(api + '/api/write', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web }, body: JSON.stringify({ x: big }) });
  assert.strictEqual(s.status, 413);
});
