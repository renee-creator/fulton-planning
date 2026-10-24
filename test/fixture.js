'use strict';
/* A small made-up school for the tests, written to a fresh folder, with the mock GitHub and the real server started on
   it, and the page served from this repository. Every name here is invented. */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { spawn } = require('child_process');
const mock = require('./mock-github.js');
const ROOT = path.join(__dirname, '..');

function records() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-fx-'));
  const put = (rel, doc, indent) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof doc === 'string' ? doc : JSON.stringify(doc, null, indent || 2) + '\n'); };
  put('access/accounts.json', { accounts: [
    { name: 'Ann', room: 'West', code: '1357', v: 1 }, { name: 'Bea', room: 'North', code: '1357', v: 1 }, { name: 'Gia', code: '1357', v: 1 },
    { name: 'Kit', kitchen: true, code: '1357', v: 1 }, { name: 'Neo', newHire: true, code: '1357', v: 1 }] });
  put('access/roles.json', { directors: ['Dee'], office: ['Gia'] });
  put('settings/educators.json', { id: 'educators', names: [{ name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }] });
  put('settings/program.json', { id: 'program', groups: [] });
  put('staff/school.json', { open: { records: true, pd: true, handbook: true, newed: true, growth: true }, goTo: 'Gia', checkin: { week: 1, secondTime: '13:00', minutes: 20 }, meeting: { start: '13:15', end: '14:30' }, philosophy: '### A heading\n\nWords.' }, 1);
  for (const [n, pr] of [['Ann', { role: 'educator', planHour: '09:00', checkin: 'slot', startDate: '2020-01-01' }], ['Bea', { role: 'educator', planHour: '10:15', checkin: 'slot', startDate: '2020-01-01' }], ['Gia', { role: 'staff' }], ['Kit', { role: 'staff' }], ['Neo', { role: 'educator', startDate: '2026-11-02' }]])
    put(`staff/people/${n.toLowerCase()}.json`, { name: n, profile: pr }, 1);
  put('staff/handbook/a-section.json', { id: 'a-section', title: 'A section', group: 'new', order: 1, body: 'Some words.' }, 1);
  put('staff/pd/licensing/01-a-piece.md', '<!--\nlist: title22\nweek: 1\n-->\n## A piece\n\nTitle 22\n\n### What it says\n\nWords.\n\n### One question\n\nWhat do you do?\n');
  put('staff/pd/modules/02-documentation.md', '<!--\nminutes: 90\nserves: obs\n-->\n# Documentation at Fulton\n\nLead.\n\n## Why it matters\n\nWords.\n\n## Reflect\n\nA question.\n');
  return dir;
}

async function start() {
  const dir = records();
  const gh = await mock.start(dir, 0);
  const port = 5000 + Math.floor(Math.random() * 400), web = port + 500;
  const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: Object.assign({}, process.env, { GITHUB_API: 'http://127.0.0.1:' + gh.port, GITHUB_TOKEN: 't', PORT: String(port),
    TEACHER_PASSCODES: 'Dee=director-pass-1,Shared=shared-pass-1', ALLOWED_ORIGINS: 'http://localhost:' + web, FLUSH_DELAY_MS: '500' }), stdio: 'ignore' });
  const files = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'tree.html');
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': /\.html$/.test(f) ? 'text/html' : /\.js$/.test(f) ? 'text/javascript' : /\.png$/.test(f) ? 'image/png' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(ok => files.listen(web, '127.0.0.1', ok));
  const api = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 80; i++) { try { await fetch(api + '/'); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const login = async (name, passcode) => (await fetch(api + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + web }, body: JSON.stringify({ name, passcode }) })).json();
  return { dir, gh, api, web, page: `http://localhost:${web}/tree.html?server=${api}`, login, stop: async () => { srv.kill(); files.close(); await gh.close(); } };
}

// a browser page signed in as someone, or null when Playwright is not installed here
async function browser() { try { return require('playwright').chromium; } catch (e) { return null; } }
async function signedIn(fx, b, name, passcode, width) {
  const j = await fx.login(name, passcode);
  const ctx = await b.newContext({ viewport: { width: width || 360, height: 800 } }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(([t, n, d]) => { localStorage.setItem('fp-token', t); localStorage.setItem('fp-name', n); localStorage.setItem('fp-director', d ? '1' : ''); }, [j.token, j.name, j.director]);
  await p.goto(fx.page); await p.waitForFunction(() => typeof goView === 'function' && window.FP_NAME && window.FP_NAME(), null, { timeout: 15000 }); await p.waitForTimeout(1500);
  return { p, errors, close: () => ctx.close() };
}
module.exports = { start, browser, signedIn, records };
