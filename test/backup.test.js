'use strict';
// the weekly backup, through the real server against a small made-up set of records, and the restore that reads it back
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
