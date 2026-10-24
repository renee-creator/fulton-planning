'use strict';
// Saves are never lost. Every change to the records goes through one queue on the server, one at a time, so saves that
// arrive together never refuse each other. A save carries a save id, the commit names it, and a device keeps its own
// copy until the server says it is written, sending it again if the server lost it.
//
// With TREE_REAL_COPY set to a folder holding a copy of the records, the twenty saves run against a fresh copy of it,
// made in the system's temporary folder, and never against the records repository itself.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const NOTE = 'Saved on this phone, it will send when you are connected';
const REAL = process.env.TREE_REAL_COPY || '';
function freshCopy() {
  if (!REAL) return undefined;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-real-'));
  fs.cpSync(REAL, dir, { recursive: true, filter: f => !/[\\/]\.git([\\/]|$)/.test(f) });
  return dir;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(200); } return false; }

test('Twenty saves at the same moment each arrive once', async t => {
  // GitHub refuses a commit that arrives while another is being made, as it did on October 22
  const fx = await start({ dir: freshCopy(), gh: { branchRace: 40 }, env: Object.assign({ WRITE_GAP_MS: '30' }, REAL ? { TEACHER_PASSCODES: 'Renee=director-pass-1,Dee=director-pass-2' } : {}) });
  t.after(() => fx.stop());
  const me = await fx.login(REAL ? 'Renee' : 'Dee', 'director-pass-1');
  assert.ok(me.token, 'signed in');
  const before = fx.gh.writes.length;
  const sids = [], ids = [];
  const jobs = [];
  for (let i = 0; i < 20; i++) {
    const id = 'nsavetest' + String(i).padStart(2, '0'), sid = 'sTest' + i + 'x' + Date.now().toString(36);
    ids.push(id); sids.push(sid);
    jobs.push(fx.as(me.token, '/api/write', { op: 'set', kind: 'notices', id, sid, data: { id, noticed: 'Save number ' + i + ' arrived.', at: Date.now(), by: 'Dee' } }));
  }
  const res = await Promise.all(jobs);
  for (const r of res) { assert.strictEqual(r.status, 200); assert.strictEqual(r.body.written, false); }
  // the same save sent again, as a phone does after its answer was lost, is not made twice
  const again = await fx.as(me.token, '/api/write', { op: 'set', kind: 'notices', id: ids[3], sid: sids[3], data: { id: ids[3], noticed: 'Save number 3 arrived.' } });
  assert.strictEqual(again.body.again, true);
  assert.ok(await until(async () => { const s = await fx.as(me.token, '/api/saved', { items: ids.map((id, i) => ({ sid: sids[i], kind: 'notices', id })) }); return s.body.written.length === 20; }, 30000), 'every save is written');
  for (let i = 0; i < 20; i++) {
    const f = path.join(fx.dir, 'notices', ids[i] + '.json');
    assert.ok(fs.existsSync(f), ids[i] + ' is in the records');
    assert.match(fs.readFileSync(f, 'utf8'), new RegExp('Save number ' + i + ' arrived'));
  }
  const mine = fx.gh.writes.slice(before).filter(w => w.path && w.path.startsWith('notices/nsavetest'));
  // one commit for each, nothing doubled, and the queue meant GitHub never refused one
  assert.strictEqual(mine.filter(w => !w.refused).length, 20);
  assert.strictEqual(mine.filter(w => w.refused).length, 0);
  for (const sid of sids) assert.strictEqual(fx.gh.writes.filter(w => (w.message || '').includes(sid)).length, 1, sid + ' named once');
  assert.strictEqual(fs.readdirSync(path.join(fx.dir, 'notices')).filter(f => f.startsWith('nsavetest')).length, 20);
});

test('A save the server cannot take, or takes and loses, is kept on the phone and sent again', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start();
  const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Ann', '1357', 390);
  const noteShown = () => s.p.evaluate(() => { const el = document.getElementById('draftnote'); return !!el && !el.hidden ? el.textContent : ''; });
  const save = (id, words) => s.p.evaluate(async ([id, words]) => { const db = await window.claude.use('db'); return db.doc('threads/' + id).set({ id, name: words, room: 'West' }).then(d => d && d.name); }, [id, words]);
  const threads = words => { const d = path.join(fx.dir, 'threads'); return fs.existsSync(d) ? fs.readdirSync(d).map(f => fs.readFileSync(path.join(d, f), 'utf8')).filter(x => x.includes(words)).length : 0; };

  // the server cannot be reached. The change shows at once, the quiet note says it is not saved yet, and it sends itself
  let block = true;
  await s.p.route('**/api/write', r => block ? r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'The server is restarting.' }) }) : r.continue());
  assert.strictEqual(await save('tsave1', 'Water moving downhill'), 'Water moving downhill');
  await s.p.waitForTimeout(400);
  assert.strictEqual(await noteShown(), NOTE);
  assert.strictEqual(threads('Water moving downhill'), 0);
  block = false;
  await s.p.evaluate(() => window.TREE_SAVES_SEND());
  assert.ok(await until(() => threads('Water moving downhill') === 1, 15000), 'sent once the server answers');
  assert.ok(await until(async () => (await noteShown()) === '', 20000), 'the note goes once it is written');

  // the server takes a save and then loses it, as one waiting during an update would be. The phone hears it is not in
  // the records and sends it again, once.
  let lost = 0;
  await s.p.unroute('**/api/write');
  await s.p.route('**/api/write', async r => { const body = JSON.parse(r.request().postData() || '{}');
    if (body.kind === 'threads' && body.id === 'tsave2' && lost++ === 0) { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rev: 1, doc: body.data, sid: body.sid, written: false }) }); return; }
    await r.continue(); });
  assert.strictEqual(await save('tsave2', 'Shadows at noon'), 'Shadows at noon');
  assert.strictEqual(threads('Shadows at noon'), 0);
  await s.p.evaluate(() => window.TREE_SAVES_SEND());
  assert.ok(await until(async () => { await s.p.evaluate(() => window.TREE_SAVES_SEND()); return threads('Shadows at noon') === 1; }, 20000), 'sent again after the server lost it');
  assert.ok(await until(async () => (await s.p.evaluate(() => window.TREE_SAVES_WAITING())) === 0 && (await noteShown()) === '', 20000));
  const commits = fx.gh.writes.filter(w => w.path === 'threads/tsave2.json' && !w.refused);
  assert.strictEqual(commits.length, 1, 'written once');
  // a save refused for a reason is let go, never sent forever
  const refused = await s.p.evaluate(async () => { const db = await window.claude.use('db'); try { await db.doc('settings/program').set({ id: 'program', groups: [] }); return 'saved'; } catch (e) { return e.code; } });
  assert.strictEqual(refused, 'not_allowed');
  assert.strictEqual(await s.p.evaluate(() => window.TREE_SAVES_WAITING()), 0);
  assert.deepStrictEqual(s.errors, []); await s.close();
});
