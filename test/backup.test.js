'use strict';
// the nightly backup, through the real server against a small made-up set of records, and the restore that reads it back
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const { spawn, execFileSync } = require('child_process');
const mock = require('./mock-github.js');

const put = (dir, rel, doc, indent) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof doc === 'string' ? doc : JSON.stringify(doc, null, indent == null ? 2 : indent) + '\n'); };
async function server(dir) {
  const gh = await mock.start(dir, 0, { treeDelay: 1500 });
  const port = 4600 + Math.floor(Math.random() * 300);
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { GITHUB_API: 'http://127.0.0.1:' + gh.port, GITHUB_TOKEN: 't', PORT: String(port), KAYMBU_INBOX_KEY: 'test-key', TEACHER_PASSCODES: 'Dee=director-pass-1' }), stdio: 'ignore' });
  const url = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 60; i++) { try { await fetch(url + '/nothing'); break; } catch (e) { await new Promise(r => setTimeout(r, 200)); } }
  return { url, stop: async () => { p.kill(); await gh.close(); } };
}

test('the backup holds every staff folder and the director and office names, never a passcode, and restores as the server writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-rec-'));
  put(dir, 'access/accounts.json', { accounts: [{ name: 'Ann', code: '8642', v: 1 }] });
  put(dir, 'access/roles.json', { directors: ['Dee'], office: ['Gia'] });
  put(dir, 'plans/p1.json', { id: 'p1', type: 'classroom', fields: {} });
  put(dir, 'staff/people/ann.json', { name: 'Ann', profile: { role: 'educator' } }, 1);
  put(dir, 'staff/journal/ann.json', { entries: [{ id: 'j1', date: '2026-10-02', joy: 'a moment' }] }, 1);
  put(dir, 'staff/pd/licensing/01-a.md', '## A piece\n\nAbout 5 minutes\n');
  const s = await server(dir);
  try {
    let r; for (let i = 0; i < 40; i++) { r = await fetch(s.url + '/inbound/backup', { method: 'POST', headers: { 'x-tree-key': 'test-key', 'Content-Type': 'application/json' }, body: '{}' }); if (r.status === 200) break; await new Promise(ok => setTimeout(ok, 250)); }
    assert.strictEqual(r.status, 200);
    const buf = Buffer.from(await r.arrayBuffer()); const text = (buf[0] === 0x1f ? zlib.gunzipSync(buf) : buf).toString('utf8');
    const b = JSON.parse(text);
    for (const k of ['access/roles.json', 'staff/people/ann.json', 'staff/journal/ann.json', 'staff/pd/licensing/01-a.md', 'plans/p1.json']) assert.ok(b.files[k], k);
    assert.ok(!b.files['access/accounts.json']);
    assert.ok(!text.includes('8642'), 'no passcode in the backup');
    const file = path.join(dir, 'b.json.gz'); fs.writeFileSync(file, buf);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-out-'));
    execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'restore-backup.js'), file, out], { stdio: 'ignore' });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(out, 'access/roles.json'), 'utf8')).office, ['Gia']);
    assert.ok(!fs.existsSync(path.join(out, 'access/accounts.json')));
    assert.strictEqual(fs.readFileSync(path.join(out, 'staff/journal/ann.json'), 'utf8'), fs.readFileSync(path.join(dir, 'staff/journal/ann.json'), 'utf8'));
  } finally { await s.stop(); }
});

// the mailbox script itself, run with small stand-ins for Google's services, as the nightly time would run it
function runGs(file, files, day) {
  const vm = require('vm');
  const triggers = [{ h: 'weeklyBackup' }, { h: 'checkKaymbu' }], made = [], trashed = [], log = [];
  const fileOf = n => ({ getName: () => n, setTrashed: () => { trashed.push(n); files.splice(files.indexOf(n), 1); } });
  const folder = { getId: () => 'f1', getName: () => 'TREE backups', getFilesByName: n => { const l = files.filter(x => x === n).map(fileOf); return { hasNext: () => l.length > 0, next: () => l.shift() }; },
    getFiles: () => { const l = files.slice().map(fileOf); return { hasNext: () => l.length > 0, next: () => l.shift() }; }, createFile: b => { files.push(b.name); return b; } };
  const gz = zlib.gzipSync(JSON.stringify({ manifest: { date: day, files: 3, counts: { plans: 1 } }, files: {} }));
  const blob = bytes => ({ name: '', setContentType() { return this; }, setName(n) { this.name = n; return this; }, copyBlob() { return blob(bytes); }, getBytes: () => bytes });
  const ctx = { TREE_SERVER: 'https://x/inbound/kaymbu', TREE_KEY: 'k', Logger: { log: m => log.push(m) },
    ScriptApp: { getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t.h, t })), deleteTrigger: x => triggers.splice(triggers.indexOf(x.t), 1),
      newTrigger: h => { const o = { h }; const c = { timeBased: () => c, everyDays: n => { o.days = n; return c; }, onWeekDay: d => { o.weekday = d; return c; }, atHour: n => { o.hour = n; return c; }, nearMinute: () => c, inTimezone: z => { o.tz = z; return c; }, create: () => { triggers.push(o); made.push(o); } }; return c; }, WeekDay: { MONDAY: 'MONDAY' } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'f1', setProperty: () => {} }) },
    DriveApp: { getFolderById: () => folder, getFoldersByName: () => ({ hasNext: () => true, next: () => folder }), createFolder: () => folder },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getBlob: () => blob(gz), getContentText: () => '' }) },
    Utilities: { sleep: () => {}, ungzip: b => ({ getDataAsString: () => zlib.gunzipSync(b.getBytes()).toString('utf8') }), formatDate: () => day } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return { ctx, triggers, made, trashed, log };
}
test('the mailbox script backs up every night, replaces the Monday time, and keeps the newest 60 with the Monday files among them', () => {
  const gs = path.join(__dirname, '..', 'tools', 'weekly-backup.gs');
  // 26 Monday backups from before, then 40 nights
  const files = ['notes.txt'];
  for (let i = 0; i < 26; i++) files.push('TREE backup ' + new Date(Date.UTC(2026, 3, 6) + i * 7 * 864e5).toISOString().slice(0, 10) + '.json.gz');
  const g = runGs(gs, files, '2026-10-24');
  g.ctx.setupNightlyBackup();
  assert.deepStrictEqual(g.triggers.map(t => t.h).sort(), ['checkKaymbu', 'nightlyBackup']);
  assert.strictEqual(g.made[0].days, 1); assert.strictEqual(g.made[0].hour, 22); assert.strictEqual(g.made[0].tz, 'America/Los_Angeles'); assert.ok(!g.made[0].weekday);
  // the old name sets the same nightly time, and an old Monday time still makes a backup
  g.ctx.setupWeeklyBackup(); assert.strictEqual(g.triggers.filter(t => t.h === 'nightlyBackup').length, 1);
  for (let i = 0; i < 40; i++) { g.ctx.Utilities.formatDate = () => ''; const d = new Date(Date.UTC(2026, 9, 1) + i * 864e5).toISOString().slice(0, 10);
    g.ctx.UrlFetchApp.fetch = () => ({ getResponseCode: () => 200, getBlob: () => { const gz = zlib.gzipSync(JSON.stringify({ manifest: { date: d } })); return { setContentType() { return this; }, setName(n) { this.name = n; return this; }, copyBlob() { return { getBytes: () => gz }; }, getBytes: () => gz }; }, getContentText: () => '' });
    (i % 2 ? g.ctx.weeklyBackup : g.ctx.nightlyBackup)(); }
  const kept = files.filter(f => /^TREE backup/.test(f)).sort();
  assert.strictEqual(kept.length, 60);
  assert.ok(files.includes('notes.txt'), 'other files stay');
  assert.strictEqual(kept[kept.length - 1], 'TREE backup 2026-11-09.json.gz');
  assert.ok(kept.some(f => f < 'TREE backup 2026-10-01'), 'the newest Monday backups count among the 60');
  assert.ok(!kept.includes('TREE backup 2026-04-06.json.gz'), 'the oldest Monday backup went to the trash');
  // the same part, pasted with the whole mailbox script, is the same code
  const part = s => s.slice(s.indexOf('/*\n  Nightly backup of TREE')).split('\n/*\n  Readable copies')[0].trim();
  assert.strictEqual(part(fs.readFileSync(path.join(__dirname, '..', 'tools', 'kaymbu-apps-script.gs'), 'utf8')), part(fs.readFileSync(gs, 'utf8')));
});
