// TREE server (grew out of Fulton Planning Studio)
// Runs on Render. Signs educators in with personal passcodes, keeps every curriculum plan,
// thread and program setting as a file in a private GitHub repository, and passes Claude
// requests (drafting, strengthening, transcribing plans) to Anthropic. Every failure returns a clear message.
//
// Render settings (Environment)
//   TEACHER_PASSCODES   Name=passcode pairs separated by commas, like  FirstName=a long passcode,OtherName=another long passcode
//   GITHUB_TOKEN        fine-grained token with Contents read and write on the records repository only
//   RECORDS_REPO        owner/name of the private records repository (default renee-creator/fulton-planning-records)
//   DIRECTOR_NAMES      names from TEACHER_PASSCODES who may change Program settings and delete plans, as a list of first names
//   ANTHROPIC_API_KEY   the same key TREE uses
//   ALLOWED_ORIGINS     extra websites allowed to use this server, separated by commas (optional)
//   KAYMBU_INBOX_KEY    a long secret shared with the Kaymbu Apps Script, which turns on the Kaymbu inbox (optional)
//
// Open this service's address in a browser to see a status page.

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const MAX_BODY_BYTES = 30 * 1024 * 1024;
const INBOUND_MAX_BYTES = 20 * 1024 * 1024;   // an email from the mailbox script, read before its key can be checked
const LOGIN_MAX_BYTES = 64 * 1024;            // a sign-in is a name and a few numbers
const FLUSH_DELAY_MS = Number(process.env.FLUSH_DELAY_MS) || 15000;   // typing is gathered into one GitHub save
const UPSTREAM_TIMEOUT_MS = 300000;
const READS_PER_HOUR = Number(process.env.READS_PER_HOUR) || 800;      // whole-school scans send one request per plan
const CAREFUL_PER_HOUR = Number(process.env.CAREFUL_PER_HOUR) || 400;
const READS_AT_ONCE = 6;
const RECORDS_REPO = (process.env.RECORDS_REPO || 'renee-creator/fulton-planning-records').trim();
const GITHUB_API = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/+$/, '');
const ANTHROPIC_BASE = new URL(process.env.ANTHROPIC_API_BASE || 'https://api.anthropic.com');
const KINDS = ['plans', 'threads', 'scans', 'settings', 'projects', 'notices', 'children', 'conferences', 'slides', 'inquiries', 'newsletters', 'bins', 'menus', 'grant', 'stories', 'posts', 'participation'];
// records only the director sees and changes. The monthly family newsletter is made in the director's view.
const DIRECTOR_KINDS = ['newsletters', 'grant', 'posts'];
const DIRECTOR_FIELDS = ['feedback', 'feedbackBy', 'feedbackAt', 'reviewedAt', 'reviewedBy'];
// every box on the Individual and Classroom plans has writing before a plan is sent to the director, except Final remarks
const SEND_NEED = { individual: ['area', 'dates', 'observation', 'intent', 'materials', 'questions'], classroom: ['observation', 'intentions', 'meeting', 'interests', 'indoor', 'outdoor', 'brainstorm'] };
// an educator sends a plan only once its boxes are written. Once sent or reviewed it stays so, and only the director
// marks it reviewed or sends it back to draft. The older Small Group plan keeps its own status row, never reviewed by an educator.
function planStatusFor(cur, next) {
  const was = cur && !cur.deleted && cur.doc ? cur.doc.status || 'draft' : 'draft', want = next.status || 'draft';
  const need = SEND_NEED[next.type];
  if (!need) return want === 'reviewed' && was !== 'reviewed' ? was : want;
  if (was === 'ready' || was === 'reviewed') return was;
  if (want === 'ready' && need.every(k => String((next.fields || {})[k] || '').trim())) return 'ready';
  return 'draft';
}
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,150}$/i;
// a phone's client id for one save of a draft, so a save sent twice is kept once. The last few thousand are remembered.
const CID_RE = /^[a-z0-9][a-z0-9._:-]{0,120}$/i;
const writeCids = new Map(), originalsComing = new Map();
function cidSeen(k) { writeCids.set(k, Date.now()); if (writeCids.size > 5000) writeCids.delete(writeCids.keys().next().value); }

/* ---------- helpers ---------- */
const log = (...a) => console.log(new Date().toISOString(), ...a);
function cleanKey(raw) { return String(raw || '').replace(/[\s"'​-‍﻿]/g, ''); }
function githubToken() { return cleanKey(process.env.GITHUB_TOKEN); }
function anthropicKey() {
  const env = process.env;
  if (cleanKey(env.ANTHROPIC_API_KEY).startsWith('sk-ant-')) return cleanKey(env.ANTHROPIC_API_KEY);
  for (const n of Object.keys(env)) if (cleanKey(env[n]).startsWith('sk-ant-')) return cleanKey(env[n]);
  return '';
}

/* ---------- teacher passcodes and sessions ---------- */
function normCode(s) { return String(s == null ? '' : s).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase(); }
function sha(s) { return crypto.createHash('sha256').update(String(s), 'utf8').digest(); }
const PASS_RAW = String(process.env.TEACHER_PASSCODES || process.env.SCHOOL_PASSCODES || '');
const TEACHERS = PASS_RAW.split(',').map(e => e.trim()).filter(Boolean).map(e => {
  const cut = e.indexOf('=');
  const name = cut > 0 ? e.slice(0, cut).trim() : '';
  const code = normCode(cut > 0 ? e.slice(cut + 1) : e);
  return { name: /^[A-Za-z0-9 _.&'-]{1,40}$/.test(name) ? name : (cut > 0 ? '' : 'Staff'), code, hash: sha(code) };
}).filter(t => t.name && t.code.length >= 6 && t.name !== 'Staff');   // the shared Staff passcode is retired, so every educator signs in with their own name
// the director's and the office's names are kept in the private records, access/roles.json, or set on Render, never in this file
const DIRECTORS = String(process.env.DIRECTOR_NAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const roles = { directors: [], office: [] };
const inRole = (list, name) => list.some(n => String(n || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());
function isDirector(name) { if (DIRECTORS.includes(String(name || '').toLowerCase()) || inRole(roles.directors, name)) return true; const a = accountFor(name); return !!(a && a.director); }
const SKIPPED_PASSCODES = PASS_RAW.split(',').filter(e => e.trim() && !/^staff=/i.test(e.trim()) && e.includes('=')).length - TEACHERS.length;
const SECRET = sha('fulton-planning|' + (process.env.SESSION_SECRET || '') + '|' + githubToken() + '|' + PASS_RAW);
const SESSION_DAYS = 60;

function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign(body) { return b64u(crypto.createHmac('sha256', SECRET).update(body).digest()); }
function makeSession(name, v) { const body = b64u(JSON.stringify(Object.assign({ n: name, e: Date.now() + SESSION_DAYS * 864e5 }, v != null ? { v } : {}))); return body + '.' + sign(body); }
/* A photo's address carries a key for that photo alone. A signed-in page holds a twelve-hour secret and makes each
   photo's key from it and the photo's id, so an address copied out of TREE opens only that one photo, and only until
   the key runs out. Pages the server builds, the Family page and the staff room display, get each photo's key made here. */
function photoSecret(e) { return b64u(crypto.createHmac('sha256', SECRET).update('photos|' + e).digest()); }
function makeFileKey() { const e = Date.now() + 12 * 36e5; return e.toString(36) + '.' + photoSecret(e); }
function photoMac(secret, id) { return b64u(crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(String(id), 'utf8').digest()).slice(0, 32); }
function photoKey(id) { const e = Date.now() + 12 * 36e5; return e.toString(36) + '.' + photoMac(photoSecret(e), id); }
function photoSrc(id) { return '/original/' + encodeURIComponent(id) + '?t=' + encodeURIComponent(photoKey(id)); }
function checkPhotoKey(tok, id) {
  if (!tok || tok.length > 120 || !id) return false;
  const [e36, mac] = tok.split('.'); const e = parseInt(e36, 36);
  if (!mac || !(e > Date.now()) || e > Date.now() + 13 * 36e5) return false;
  const want = photoMac(photoSecret(e), id);
  return want.length === mac.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac));
}
function readSession(req) {
  const h = String(req.headers.authorization || '');
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  return checkSession(tok);
}
function checkSession(tok) {
  if (!tok || tok.length > 600) return null;
  const [body, mac] = tok.split('.');
  if (!body || !mac) return null;
  const want = sign(body);
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  let s; try { s = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
  if (!s || typeof s.n !== 'string' || !(s.e > Date.now())) return null;
  // an educator removed on Render, or whose TREE sign-in was removed, had its code cleared or has left Fulton, is signed out
  if (s.v != null) { const a = accountFor(s.n); if (!a || (a.v || 0) !== s.v || !a.code || isFormerAccount(a)) return null; return { name: a.name }; }
  if (!TEACHERS.some(t => t.name === s.n)) return null;
  return { name: s.n };
}
// why a sign-in was turned down, for the log only, so a surprise sign-out can be traced to its cause
function sessionWhy(req) {
  const h = String(req.headers.authorization || ''); const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!tok) return 'no sign-in sent';
  const [body, mac] = tok.split('.'); let s = null;
  try { s = JSON.parse(Buffer.from(String(body).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) {}
  if (!s || typeof s.n !== 'string') return 'unreadable sign-in';
  const who = s.n.slice(0, 40);
  if (!mac || sign(body).length !== mac.length || !crypto.timingSafeEqual(Buffer.from(sign(body)), Buffer.from(mac))) return who + ', signature does not match (the server key changed)';
  if (!(s.e > Date.now())) return who + ', sign-in older than ' + SESSION_DAYS + ' days';
  if (s.v != null) { const a = accountFor(s.n); if (!a) return who + ', sign-in removed'; if (isFormerAccount(a)) return who + ', left Fulton ' + a.leaveOn; if (!a.code) return who + ', passcode cleared'; if ((a.v || 0) !== s.v) return who + ', passcode changed or reset since (' + s.v + ' then, ' + (a.v || 0) + ' now)'; }
  else if (!TEACHERS.some(t => t.name === s.n)) return who + ', no longer set on Render';
  return who + ', reason unknown';
}
function matchPasscode(given) {
  if (typeof given !== 'string' || !given || given.length > 200) return null;
  const h = sha(normCode(given));
  let hit = null;
  for (const t of TEACHERS) if (crypto.timingSafeEqual(h, t.hash)) hit = t;
  return hit;
}
const wrongTries = new Map(); let wrongAll = [];
// Render adds the visitor's real address as the last entry, and earlier entries can be made up by the sender
function who(req) { const parts = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean); return parts[parts.length - 1] || (req.socket && req.socket.remoteAddress) || 'unknown'; }
function blocked(ip) { const now = Date.now(); const t = wrongTries.get(ip); return !!t && t.until > now && t.count >= 40; }
function noteWrong(ip) { const now = Date.now(); if (wrongTries.size > 5000) for (const [k, v] of wrongTries) if (v.until <= now) wrongTries.delete(k); const t = wrongTries.get(ip); if (!t || t.until <= now) wrongTries.set(ip, { count: 1, until: now + 600000 }); else t.count++; }

/* ---------- TREE sign-ins. Each educator signs in with their first name and a 4-digit passcode they set the first time.
   The director adds educators, can see their codes, and can clear a code so it is set again. The file lives under access/
   in the records, never in what is sent to a browser, and only the director's Settings asks for it. ---------- */
const ACCOUNTS_PATH = 'access/accounts.json', ROLES_PATH = 'access/roles.json';
function takeRoles(text) { try { const d = JSON.parse(text || '{}'); roles.directors = Array.isArray(d.directors) ? d.directors.map(String) : []; roles.office = Array.isArray(d.office) ? d.office.map(String) : []; } catch (e) { log('The roles file could not be read'); } }
const accounts = { list: [], sha: null, loaded: false, saving: Promise.resolve() };
const nameKey = n => String(n || '').normalize('NFKC').replace(/\./g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
function accountFor(name) { const k = nameKey(name); return k ? accounts.list.find(a => nameKey(a.name) === k) : null; }
async function loadAccounts() {
  const r = await gh('GET', `/repos/${RECORDS_REPO}/contents/${ACCOUNTS_PATH}?ref=${encodeURIComponent(store.branch)}`);
  if (r.status === 200) { accounts.sha = r.json.sha; try { const d = JSON.parse(Buffer.from(r.json.content || '', 'base64').toString('utf8')); if (Array.isArray(d.accounts)) accounts.list = d.accounts.filter(a => a && a.name); } catch (e) { log('The sign-ins file could not be read'); } let gave = false; for (const a of accounts.list) if (!a.code && !a.start) { a.start = newStart(); gave = true; } if (gave) saveAccounts('TREE'); }
  else if (r.status !== 404) throw new Error('GitHub answered ' + r.status + ' when reading the sign-ins.');
  const rr = await gh('GET', `/repos/${RECORDS_REPO}/contents/${ROLES_PATH}?ref=${encodeURIComponent(store.branch)}`);
  if (rr.status === 200) takeRoles(Buffer.from(rr.json.content || '', 'base64').toString('utf8'));
  accounts.loaded = true;
}
function saveAccounts(by) {
  accounts.saving = accounts.saving.then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const content = Buffer.from(JSON.stringify({ note: 'TREE sign-ins. Keep this file private.', accounts: accounts.list }, null, 2) + '\n', 'utf8').toString('base64');
      const r = await gh('PUT', `/repos/${RECORDS_REPO}/contents/${ACCOUNTS_PATH}`, { message: 'Update sign-ins by ' + by, content, branch: store.branch, ...(accounts.sha ? { sha: accounts.sha } : {}) });
      if (r.status === 200 || r.status === 201) { accounts.sha = r.json.content.sha; return true; }
      if (r.status === 409 || r.status === 422) { const g = await gh('GET', `/repos/${RECORDS_REPO}/contents/${ACCOUNTS_PATH}?ref=${encodeURIComponent(store.branch)}`); accounts.sha = g.status === 200 ? g.json.sha : null; continue; }
      log('Could not save the sign-ins', r.status); return false;
    }
    return false;
  }).catch(e => { log('Could not save the sign-ins', e.message); return false; });
  return accounts.saving;
}
// a name that keeps getting the code wrong is held for fifteen minutes
// a name that keeps getting the code wrong waits fifteen minutes, then twice as long after each further run of five, up to a day
const nameTries = new Map();
function nameBlocked(n) { const t = nameTries.get(nameKey(n)); return !!t && t.until > Date.now(); }
function nameWrong(n) { const k = nameKey(n), now = Date.now(); if (!k) return; if (nameTries.size > 5000) for (const [x, v] of nameTries) if (v.until <= now && now - v.last > 864e5) nameTries.delete(x);
  const t = nameTries.get(k) || { count: 0, locks: 0, until: 0, last: 0 }; if (now - t.last > 864e5) { t.count = 0; t.locks = 0; }
  t.count++; t.last = now; if (t.count >= 5) { t.until = now + Math.min(15 * 60000 * Math.pow(2, t.locks), 864e5); t.locks++; t.count = 0; } nameTries.set(k, t); }
function waitWords(n) { const t = nameTries.get(nameKey(n)); const m = t ? Math.ceil((t.until - Date.now()) / 60000) : 15; return m >= 90 ? Math.round(m / 60) + ' hours' : m + ' minute' + (m === 1 ? '' : 's'); }
// a new sign-in, or one whose code was cleared, starts with a six-number code the director hands to the educator
const newStart = () => String(crypto.randomInt(100000, 1000000));
const sameText = (a, b) => { a = String(a || ''); b = String(b || ''); return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); };
const cleanName = n => String(n || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 30);
const okName = n => /^[A-Za-z][A-Za-z .'-]{0,29}$/.test(n);
// the names offered on plans leave out an educator who has left Fulton
function teacherNames() { return [...new Set([...TEACHERS.map(x => x.name), ...accounts.list.filter(a => !isFormerAccount(a)).map(a => a.name)])]; }
/* An educator leaving Fulton keeps their account with their last day, leaveOn. Sign-in ends at the end of that day, in
   California. From the day after they are a former educator. They cannot sign in, hear no reminders, leave the check-in
   schedule, the small group leads and the names offered on plans, and their private records wait in Former educators for
   the director. What they wrote in observations, plans and documentation keeps their name as written. */
const laDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const isFormerAccount = a => !!(a && /^\d{4}-\d{2}-\d{2}$/.test(a.leaveOn || '') && a.leaveOn < laDay());
function isFormerEducator(name) { return isFormerAccount(accountFor(name)); }
// someone with records, any file under staff/ for them or any observation, plan or documentation they wrote, leaves
// Fulton rather than being removed. Remove is kept for a sign-in added by mistake.
function wroteAnything(name) {
  const k = nameKey(name); if (!k) return false;
  const named = v => String(v || '').split(/,|&|\band\b|\//i).some(x => nameKey(x) === k);
  for (const [kind, f] of [['notices', 'by'], ['plans', 'educator'], ['slides', 'by'], ['stories', 'by']]) for (const r of store.recs[kind].values()) if (r && !r.deleted && r.doc && named(r.doc[f])) return true;
  return false;
}
const hasRecords = name => wroteAnything(name) || (typeof staff !== 'undefined' && staff.hasFiles(name));
// a kitchen sign-in reaches the Kitchen page, Today and the calendar, and nothing about children or money
// the office, named in access/roles.json in the records, works with the director on families, enrollment and participation
const OFFICE_NAMES = String(process.env.OFFICE_NAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const isOffice = name => { if (isDirector(name)) return true; if (OFFICE_NAMES.includes(String(name || '').toLowerCase()) || inRole(roles.office, name)) return true; const a = accountFor(name); return !!(a && a.office); };
// what only the director and the office see, the families' participation
const OFFICE_KINDS = ['participation'];
const isKitchen = name => { if (isDirector(name)) return false; const a = accountFor(name); return !!(a && a.kitchen); };
const kitchenSees = (kind, id) => kind === 'menus' || (kind === 'settings' && id === 'staples');
function accountView(a) { return { name: a.name, room: a.room || '', director: !!a.director, kitchen: !!a.kitchen, newHire: !!a.newHire, code: a.code || '', start: a.code ? '' : (a.start || ''), setAt: a.setAt || 0, addedBy: a.addedBy || '', lastAt: a.lastAt || 0,
  leaveOn: a.leaveOn || '', former: isFormerAccount(a), records: hasRecords(a.name),
  // who is not set up yet. Never signed in is a sign-in still on its start code that never chose a passcode, and
  // reminders are off when no phone takes them now, since a phone that stops taking them is dropped
  never: !a.code && !a.setAt && !a.lastAt, phones: (a.push || []).length }; }

/* ---------- GitHub storage ---------- */
/* Every change to the records goes through one queue, one at a time. GitHub makes each change a commit on the same
   branch, and two commits made in the same moment refuse each other, so a dozen saves that arrived together used to
   fail together. Reading is never queued. GitHub asks for a pause of about a second between changes, and while the
   server is stopping for an update the pause is shorter, so what is waiting is written before it stops. */
let ghWrites = Promise.resolve(), ghWroteAt = 0, ghWaiting = 0, ghHurry = false;
const WRITE_GAP_MS = /^\d+$/.test(process.env.WRITE_GAP_MS || '') ? Number(process.env.WRITE_GAP_MS) : 1000;
function gh(method, path, body) {
  if (method === 'GET' || path === '/graphql') return ghNow(method, path, body);
  ghWaiting++;
  const job = ghWrites.then(async () => {
    const gap = ghHurry ? Math.min(WRITE_GAP_MS, 150) : WRITE_GAP_MS;
    const wait = ghWroteAt + gap - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    try { return await ghNow(method, path, body); } finally { ghWroteAt = Date.now(); ghWaiting--; }
  });
  ghWrites = job.catch(() => {});
  return job;
}
function ghNow(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(GITHUB_API + path);
    const data = body ? JSON.stringify(body) : null;
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request({ method, hostname: url.hostname, port: url.port || undefined, path: url.pathname + url.search, headers: {
      'Authorization': 'Bearer ' + githubToken(), 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'fulton-planning', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (e) {} resolve({ status: res.statusCode, json, text, headers: res.headers }); });
      res.on('error', reject);
    });
    req.setTimeout(60000, () => req.destroy(new Error('GitHub did not answer in time')));
    req.on('error', reject);
    req.end(data || undefined);
  });
}
/* When GitHub's hourly allowance for ordinary requests is spent, records are read through GitHub's GraphQL door instead,
   which has its own allowance and reads a hundred files in one request. A restart then costs a handful of requests. */
async function gql(query) { const r = await gh('POST', '/graphql', { query }); if (r.status !== 200 || !r.json || r.json.errors) throw new Error('GitHub GraphQL answered ' + r.status + (r.json && r.json.errors ? ' ' + JSON.stringify(r.json.errors).slice(0, 200) : '')); return r.json.data; }
const gqlRepo = () => { const [o, n] = RECORDS_REPO.split('/'); return `repository(owner:${JSON.stringify(o)},name:${JSON.stringify(n)})`; };
// every file the loader needs, listed folder by folder, in the same shape the tree listing gives
async function gqlFiles(branch) {
  const dirs = [...KINDS, 'originals', 'photos', 'drdp', 'access'];
  const d = await gql(`query{${gqlRepo()}{${dirs.map((k, i) => `d${i}:object(expression:${JSON.stringify(branch + ':' + k)}){...on Tree{entries{name oid type}}}`).join(' ')}}}`);
  const repo = d.repository || {}, files = [];
  dirs.forEach((k, i) => { for (const e of ((repo['d' + i] || {}).entries || [])) if (e.type === 'blob') files.push({ type: 'blob', path: k + '/' + e.name, sha: e.oid }); });
  return files;
}
// the text of many files at once, by their ids
async function gqlTexts(shas) {
  const out = new Map();
  for (let i = 0; i < shas.length; i += 90) {
    const part = shas.slice(i, i + 90);
    const d = await gql(`query{${gqlRepo()}{${part.map((s, j) => `b${j}:object(oid:${JSON.stringify(s)}){...on Blob{text isTruncated}}`).join(' ')}}}`);
    part.forEach((s, j) => { const b = (d.repository || {})['b' + j]; if (b && typeof b.text === 'string' && !b.isTruncated) out.set(s, b.text); });
  }
  return out;
}
const restSpent = r => r && (r.status === 403 || r.status === 429);
// a photo read from GitHub as raw bytes, which takes a quarter of the memory of reading it as text. At most four are read
// at once, and a photo asked for by several cards at the same moment is read only once.
function ghRaw(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(GITHUB_API + path);
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request({ method: 'GET', hostname: url.hostname, port: url.port || undefined, path: url.pathname + url.search, headers: {
      'Authorization': 'Bearer ' + githubToken(), 'Accept': 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'fulton-planning' } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { let buf = Buffer.concat(chunks);
        // should GitHub ever answer with the usual wrapped form, the photo is unwrapped from it
        if (buf[0] === 0x7b) { try { const j = JSON.parse(buf.toString('utf8')); if (j && j.content) buf = Buffer.from(j.content, 'base64'); } catch (e) {} }
        resolve({ status: res.statusCode, buf }); });
      res.on('error', reject);
    });
    req.setTimeout(60000, () => req.destroy(new Error('GitHub did not answer in time')));
    req.on('error', reject);
    req.end();
  });
}
const photoReads = new Map(); let photoRunning = 0; const photoQueue = [];
function readPhoto(sha) {
  if (photoReads.has(sha)) return photoReads.get(sha);
  const job = new Promise((resolve, reject) => {
    const go = () => { photoRunning++; ghRaw(`/repos/${RECORDS_REPO}/git/blobs/${sha}`).then(resolve, reject).finally(() => { photoRunning--; photoReads.delete(sha); const next = photoQueue.shift(); if (next) next(); }); };
    if (photoRunning < 4) go(); else photoQueue.push(go);
  });
  photoReads.set(sha, job);
  return job;
}
// the calendar keeps its own part of the records, under calendar/
const calendar = require('./calendar.js')({ gh, log, repo: RECORDS_REPO, token: githubToken, extraEvents: conferenceEvents, extraRev: () => rev + '.' + (typeof staff !== 'undefined' ? staff.rev() : 0) });
// each family conference with a day, as an entry on the calendar. Only the child's first name is shown.
function conferenceEvents(from, to, me) {
  const events = []; const plus = (t, m) => { const [h, mm] = t.split(':').map(Number); const v = h * 60 + mm + m; return String(Math.floor(v / 60) % 24).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
  // a calendar entry's id never carries a child's record id, which holds their full name and birthday
  const hid = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
  // the kitchen sees birthdays and meals, never family conferences
  if (!(me && isKitchen(me.name))) for (const [id, r] of store.recs.conferences) {
    const c = r.doc; if (r.deleted || !c || !c.confDate || c.confDate < from || c.confDate > to) continue;
    const k = store.recs.children.get(c.childId); const first = k && !k.deleted && k.doc.first ? k.doc.first : 'A child', room = k && !k.deleted && k.doc.classroom ? String(k.doc.classroom) : '';
    // a child who has left keeps their past conferences, and nothing after their last day shows as coming up
    if (k && !k.deleted && k.doc.status === 'withdrawn' && c.confDate > (k.doc.leftOn || String(k.doc.withdrawnAt || '').slice(0, 10) || '0000')) continue;
    const t = /^\d{2}:\d{2}$/.test(c.confTime || '') ? c.confTime : '';
    // a conference reads only Conference, the child's name and Class, such as Conference, Wren, North
    events.push(Object.assign({ id: 'tconf.' + hid(id), cal: 'tconf', conf: true, title: 'Conference, ' + first + (room ? ', ' + room : ''), desc: '' }, t ? { allDay: false, start: c.confDate + 'T' + t, end: c.confDate + 'T' + plus(t, 20) } : { allDay: true, start: c.confDate, end: c.confDate }));
  }
  // every child at Fulton has a birthday on the calendar each year, from the birthday on the roster
  const y0 = +from.slice(0, 4), y1 = +to.slice(0, 4);
  for (const [id, r] of store.recs.children) {
    const k = r.doc; if (r.deleted || !k || !k.first || k.status === 'withdrawn' || !/^\d{4}-\d{2}-\d{2}$/.test(String(k.dob || '').slice(0, 10))) continue;
    const dob = String(k.dob).slice(0, 10), by = +dob.slice(0, 4), md = dob.slice(5);
    for (let y = y0; y <= y1; y++) {
      if (y <= by) continue;
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const day = y + '-' + (md === '02-29' && !leap ? '02-28' : md);
      if (day < from || day > to) continue;
      events.push({ id: 'tbday.' + hid(id) + '.' + y, cal: 'tbday', title: `${k.first}'s birthday`, desc: `${k.first} turns ${y - by}${k.classroom ? ', ' + k.classroom + ' class' : ''}`, allDay: true, start: day, end: day });
    }
  }
  // staff birthdays, kept by the director in Settings with the month and day only, so no age is shown
  const sb = store.recs.settings.get('staffbirthdays'), MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (const p of (sb && !sb.deleted && sb.doc && Array.isArray(sb.doc.people) ? sb.doc.people : [])) {
    const name = String((p && p.name) || '').trim(), md = String((p && p.date) || '');
    const mm = +md.slice(0, 2), dd = +md.slice(3);
    if (!name || !/^\d{2}-\d{2}$/.test(md) || mm < 1 || mm > 12 || dd < 1 || dd > MONTH_DAYS[mm - 1]) continue;
    for (let y = y0; y <= y1; y++) {
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const day = y + '-' + (md === '02-29' && !leap ? '02-28' : md);
      if (day < from || day > to) continue;
      events.push({ id: 'tbday.staff.' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + y, cal: 'tbday', title: `${name}'s birthday`, desc: 'Staff birthday', allDay: true, start: day, end: day });
    }
  }
  // the month's snack and lunch, from the menus the director adds in TREE
  for (const [, r] of store.recs.menus) {
    const m = r.doc; if (r.deleted || !m || !m.days) continue;
    for (const [day, d] of Object.entries(m.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < from || day > to || !d || d.closed) continue;
      // a morning snack, lunch, and an afternoon snack after lunch, each at the time kept with the month's menu.
      // Monday has the morning snack only. A meal without a time shows across the day.
      const am = String(d.am || '').trim(), pm = new Date(day + 'T12:00:00Z').getUTCDay() === 1 ? '' : String(d.pm || '').trim(), lunch = String(d.lunch || '').trim();
      const times = m.times || {}, note = m.notes || {};
      const meal = (key, title, desc) => { const t = /^\d{2}:\d{2}$/.test(times[key] || '') ? times[key] : ''; events.push(Object.assign({ id: 'tmenu.' + day + '.' + key, cal: 'tmenu', title, desc: desc || '' }, t ? { allDay: false, start: day + 'T' + t, end: day + 'T' + plus(t, 30) } : { allDay: true, start: day, end: day })); };
      if (am) meal('am', 'Morning snack, ' + am, note.snack);
      if (lunch) meal('lunch', 'Lunch, ' + lunch, note.lunch);
      if (pm) meal('pm', 'Afternoon snack, ' + pm, note.snack);
    }
  }
  // check-in Mondays with each educator's own time, and PD days set in TREE, from staff.js. Each educator sees their own.
  if (me && typeof staff !== 'undefined') for (const e of staff.calendarExtra(from, to, me)) events.push(e);
  return { events, status: { tconf: { connected: true, ok: true }, tbday: { connected: true, ok: true }, tmenu: { connected: true, ok: true }, tgrow: { connected: true, ok: true } } };
}
const store = { ready: false, error: '', branch: 'main', recs: { plans: new Map(), threads: new Map(), scans: new Map(), settings: new Map(), projects: new Map(), notices: new Map(), children: new Map(), conferences: new Map(), slides: new Map(), stories: new Map(), inquiries: new Map(), newsletters: new Map(), bins: new Map(), menus: new Map(), grant: new Map(), posts: new Map(), participation: new Map() }, originals: new Map(), loadedAt: 0, saveError: '' };
// Moments shared from Kaymbu by email arrive here through the school's Google Workspace mailbox
// photos kept in the school's Google Drive, through the TREE mailbox's Apps Script, when DRIVE_PHOTOS_URL is set on Render
const photosDrive = require('./photos-drive.js')({ store, log, gh, repo: RECORDS_REPO, readPhoto: sha => readPhoto(sha), cacheFile: (id, b) => cacheFile(id, b) });
const readable = require('./readable.js')({ drive: photosDrive, store, log, noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id) });
const reminders = require('./reminders.js')({ store, accounts, accountFor, isFormer: n => isFormerEducator(n), saveAccounts: n => saveAccounts(n), isDirector, isKitchen, log, noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id) });
const signupSync = require('./signup-sync.js')({ store, log, readFeed: l => readSignupFeed(l, true), noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id) });
// a family's sign-in code goes out through the school's Google Workspace mailbox script, set as FAMILY_MAIL_URL and FAMILY_MAIL_KEY
async function mailCode(to, code) {
  const url = process.env.FAMILY_MAIL_URL, key = process.env.FAMILY_MAIL_KEY; if (!url || !key) throw new Error('Family email is not set up yet');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, to, subject: 'Your Fulton family page code', body: `Your code for the Fulton family page is ${code}. It works for 15 minutes.\n\nFulton Community School & Farm` }), redirect: 'follow' });
  if (!r.ok) throw new Error('The mailbox answered ' + r.status);
}
const familyPage = require('./family.js')({ store, log, sign, photoSrc: id => photoSrc(id), noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id), mailCode, keepPhoto: (id, buf) => keepOriginal(id, buf, 'image/jpeg', 'All About Me photo from the Family page'), handbook: () => staff.handbook });
const feedBin = require('./feed-bin.js')({ store, log, noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id) });
const kaymbuInbox = require('./kaymbu.js')({ digest: b => menuIntake.fromDigest(b), store, log, gh, repo: RECORDS_REPO, noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id), cacheFile: (id, b) => cacheFile(id, b), accountFor: n => accountFor(n), educatorNames: () => teacherNames(), keepInDrive: (id, b, t) => photosDrive.keep(id, b, t), onNotice: id => queueThreadSuggest(id) });
// the month's menus, opened from the links in the Kitchen Digest and read by Claude
// a file TREE keeps, such as a menu PDF, goes to Google Drive like the photos, or to the records when Drive is not set up
async function keepOriginal(id, buf, type, message) {
  if (photosDrive.on() && await photosDrive.keep(id, buf, type)) return id;
  let r;
  for (let k = 0; k < 4; k++) {
    if (k) await new Promise(ok => setTimeout(ok, 1500 * k));
    r = await gh('PUT', `/repos/${RECORDS_REPO}/contents/originals/${id}`, { message: message || 'Add a file', content: buf.toString('base64'), branch: store.branch });
    if (r.status !== 409 && r.status !== 422 && r.status < 500) break;
  }
  if (r.status !== 201 && r.status !== 200) throw new Error('GitHub answered ' + r.status);
  store.originals.set(id, { path: `originals/${id}`, sha: r.json.content.sha, size: buf.length }); cacheFile(id, buf);
  return id;
}
// a file kept with keepOriginal, read back as bytes for a request that has already checked who may see it
async function readOriginal(id) {
  let o = store.originals.get(id);
  if (!o && ID_RE.test(id)) { const r = await gh('GET', `/repos/${RECORDS_REPO}/contents/originals/${encodeURIComponent(id)}?ref=${encodeURIComponent(store.branch)}&fresh=${Date.now()}`); if (r.status === 200 && r.json && r.json.sha) { o = { path: `originals/${id}`, sha: r.json.sha, size: r.json.size }; store.originals.set(id, o); } }
  if (!o) throw new Error('It is not in the records.');
  if (o.drive) return photosDrive.read(o);
  const b = await readPhoto(o.sha); if (b.status !== 200) throw new Error('GitHub answered ' + b.status); return b.buf;
}
// educator records, the New Educator section, the PD library pieces and the Teacher Policies and Procedures, in staff.js
function lensNow() { const r = store.recs.settings.get('program'); const v = r && !r.deleted && r.doc ? r.doc : {}; const ls = Array.isArray(v.lenses) && v.lenses.length ? v.lenses : v.lens ? [Object.assign({ year: true }, v.lens)] : [];
  const l = ls.find(x => x && x.year) || ls[0]; return l ? { name: String(l.name || ''), description: String(l.description || '') } : null; }
/* One-time steps. A change the server makes to records already there, such as a setting moved out of TREE's public
   code, is a step run once at start, through the save queue. settings/once records each step that has run, so none runs
   twice, and until a step has run TREE reads the old values. A step that is not ready yet, because what it needs has not
   loaded, says so and is tried again at the next start of that part. */
const ONCE = [];
function onceDone(id) { const r = store.recs.settings.get('once'); return !!(r && !r.deleted && r.doc && r.doc.done && r.doc.done[id]); }
function runOnce() {
  if (!store.ready) return;
  for (const [id, fn] of ONCE) {
    if (onceDone(id)) continue;
    try {
      if (fn() === false) continue;
      const r = store.recs.settings.get('once'); const doc = r && !r.deleted && r.doc ? r.doc : { done: {} };
      setSetting('once', Object.assign({}, doc, { done: Object.assign({}, doc.done || {}, { [id]: new Date().toISOString() }) }));
      log('One-time step done,', id);
    } catch (e) { log('One-time step could not run,', id, e.message); }
  }
}
// the educator names are one list, settings/educators. Conference settings keep the names by Class, made from that list.
function syncEducators() {
  const ed = store.recs.settings.get('educators'), mn = store.recs.settings.get('main');
  if (!ed || ed.deleted || !ed.doc || !Array.isArray(ed.doc.names) || !mn || mn.deleted || !mn.doc) return;
  const by = {}; for (const r of (Array.isArray(mn.doc.classrooms) ? mn.doc.classrooms : [])) by[r] = [];
  for (const x of ed.doc.names) { if (!x || !x.name || !x.room || isFormerEducator(x.name)) continue; (by[x.room] = by[x.room] || []).push(String(x.name)); }
  if (JSON.stringify(by) === JSON.stringify(mn.doc.educators || {})) return;
  mn.doc.educators = by; mn.local = true; noteChange('settings', 'main'); scheduleSave('settings', 'main'); log('Educators by Class copied from the educator list');
}
ONCE.push(['educatorList', () => { syncEducators(); }]);
// how often four educators plan was kept in TREE's public code. It moves into the reminder settings once, from a file
// added to the private records for this step, which then leaves the records.
ONCE.push(['planDefaults', () => {
  const pd = store.recs.settings.get('plandefaults'); if (!pd || pd.deleted || !pd.doc || !pd.doc.people) return false;
  const nf = store.recs.settings.get('notify'); const doc = nf && !nf.deleted && nf.doc ? nf.doc : {};
  const people = Object.assign({}, doc.people || {}); const first = n => nameKey(n).split(' ')[0];
  const names = [...accounts.list.map(a => a.name), ...rosterNames()];
  for (const [f, plans] of Object.entries(pd.doc.people)) {
    if (!['weekly', 'monthly', 'none'].includes(plans)) continue;
    const known = Object.keys(people).find(n => first(n) === first(f));
    if (known) { if (!people[known].plans) people[known] = Object.assign({}, people[known], { plans }); continue; }
    const full = names.find(n => first(n) === first(f)) || f;
    people[full] = { plans };
  }
  setSetting('notify', Object.assign({}, doc, { people }));
  pd.deleted = true; noteChange('settings', 'plandefaults'); scheduleSave('settings', 'plandefaults');
}]);
function rosterNames() { const r = store.recs.settings.get('educators'); return ((r && !r.deleted && r.doc && r.doc.names) || []).filter(x => x && x.name).map(x => String(x.name)); }
// the journal opens with the reader's own passcode each time, checked here as at sign-in
function checkPasscode(name, given) {
  given = String(given || ''); const a = accountFor(name); let ok = false;
  if (a && a.code) ok = sameText(given, a.code); else { const t = matchPasscode(given); ok = !!t && nameKey(t.name) === nameKey(name); }
  if (!ok) nameWrong(name); return ok;
}
/* once an educator's last day has passed, they come off the names offered on plans, the Class lists and the small group
   leads. What was taken is kept on the account, so bringing them back puts it back where nothing else took its place. */
function settleFormer() {
  if (!store.ready || !accounts.loaded) return; let changed = false;
  for (const a of accounts.list) {
    if (!isFormerAccount(a) || a.settled === a.leaveOn) continue;
    const k = nameKey(a.name), took = { roster: null, rooms: [], groups: [] };
    const ed = store.recs.settings.get('educators');
    if (ed && !ed.deleted && ed.doc && Array.isArray(ed.doc.names)) { const r = ed.doc.names.find(x => x && nameKey(x.name) === k); if (r) { took.roster = r; setSetting('educators', Object.assign({}, ed.doc, { names: ed.doc.names.filter(x => x !== r) })); } }
    const mn = store.recs.settings.get('main');
    if (mn && !mn.deleted && mn.doc && mn.doc.educators && typeof mn.doc.educators === 'object') {
      const eds = {}; for (const [room, ns] of Object.entries(mn.doc.educators)) { const l = Array.isArray(ns) ? ns : []; if (l.some(n => nameKey(n) === k)) took.rooms.push(room); eds[room] = l.filter(n => nameKey(n) !== k); }
      if (took.rooms.length) setSetting('main', Object.assign({}, mn.doc, { educators: eds })); }
    const pg = store.recs.settings.get('program');
    if (pg && !pg.deleted && pg.doc && Array.isArray(pg.doc.groups)) {
      const gs = pg.doc.groups.map(g => { if (g && g.educator && nameKey(g.educator) === k) { took.groups.push(g.name); return Object.assign({}, g, { educator: '' }); } return g; });
      if (took.groups.length) { setSetting('program', Object.assign({}, pg.doc, { groups: gs })); syncGroups('program'); } }
    // a phone that took reminders hears nothing more
    a.leftFrom = took; a.settled = a.leaveOn; delete a.push; changed = true;
    if (typeof staff !== 'undefined') staff.markLeft(a.name, a.leaveOn).catch(() => {});
    log('Left Fulton,', a.name, 'last day', a.leaveOn, '. Off the educators list and', took.groups.length, 'small groups');
  }
  if (changed) saveAccounts('TREE');
}
function restoreFormer(a) {
  const took = a.leftFrom || {}, k = nameKey(a.name);
  if (took.roster) { const ed = store.recs.settings.get('educators'); const doc = ed && !ed.deleted && ed.doc ? ed.doc : { names: [] }; const names = Array.isArray(doc.names) ? doc.names : [];
    if (!names.some(x => x && nameKey(x.name) === k)) setSetting('educators', Object.assign({}, doc, { names: [...names, took.roster] })); }
  const mn = store.recs.settings.get('main');
  if ((took.rooms || []).length && mn && !mn.deleted && mn.doc) { const eds = Object.assign({}, mn.doc.educators || {}); let put = false;
    for (const room of took.rooms) { const l = Array.isArray(eds[room]) ? eds[room] : []; if (!l.some(n => nameKey(n) === k)) { eds[room] = [...l, a.name]; put = true; } }
    if (put) setSetting('main', Object.assign({}, mn.doc, { educators: eds })); }
  const pg = store.recs.settings.get('program');
  if ((took.groups || []).length && pg && !pg.deleted && pg.doc && Array.isArray(pg.doc.groups)) { let put = false;
    const gs = pg.doc.groups.map(g => g && took.groups.includes(g.name) && !g.educator ? (put = true, Object.assign({}, g, { educator: a.name })) : g);
    if (put) { setSetting('program', Object.assign({}, pg.doc, { groups: gs })); syncGroups('program'); } }
  delete a.leftFrom;
}
/* ---------- Keeping records. How long a former child's and a former educator's records are kept, from Title 22 as the
   Department of Social Services publishes it, and the director's choice for each one once the period is reached.
   Nothing is removed until she chooses Remove and confirms it. A period that cannot be confirmed there is left blank
   for her to set. The removed files stay in the records' history on GitHub and in the nightly backups made before. ---------- */
const KEEP_SOURCES = {
  child: { years: 3, reg: 'Title 22, section 101221(g), Children\'s Records', words: 'Originals or photocopies of all children\'s records shall be kept for at least three years following termination of service to the child.', url: 'https://www.cdss.ca.gov/ord/entres/getinfo/pdf/ccc5.pdf' },
  staff: { years: 3, reg: 'Title 22, section 101217(d), Personnel Records', words: 'All personnel records shall be retained for at least three years following termination of employment.', url: 'https://www.cdss.ca.gov/ord/entres/getinfo/pdf/ccc4.pdf' } };
function keepDoc() { const r = store.recs.settings.get('keeping'); return r && !r.deleted && r.doc ? r.doc : {}; }
const KEEP_FIELD = { child: 'childYears', staff: 'staffYears' };
const keepYears = kind => { const d = keepDoc(), f = KEEP_FIELD[kind]; if (!(f in d)) return KEEP_SOURCES[kind].years || 0; return +d[f] > 0 ? +d[f] : 0; };
function setKeep(fields, by) { const cur = store.recs.settings.get('keeping'); store.recs.settings.set('keeping', { doc: Object.assign({ id: 'keeping' }, keepDoc(), fields, { updatedByName: by, savedAt: Date.now() }), sha: cur && cur.sha, path: 'settings/keeping.json', local: true }); noteChange('settings', 'keeping'); scheduleSave('settings', 'keeping'); }
const addYears = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString().slice(0, 10); };
// the former children and former educators whose keeping period has passed, waiting for the director's choice
function keepingDue() {
  const t = laDay(), dec = keepDoc().decisions || {}, out = [], ISO_D = /^\d{4}-\d{2}-\d{2}$/;
  const waits = (key, due) => { const until = (dec[key] || {}).until || ''; return due <= t && (!until || until <= t); };
  const cy = keepYears('child'), sy = keepYears('staff');
  if (cy) for (const [id, r] of store.recs.children) { const k = r && !r.deleted && r.doc; if (!k || k.status !== 'withdrawn') continue; const left = k.leftOn || String(k.withdrawnAt || '').slice(0, 10); if (!ISO_D.test(left)) continue;
    const due = addYears(left, cy); if (waits('child:' + id, due)) out.push({ kind: 'child', id, name: [k.first, k.last].filter(Boolean).join(' ') || 'A child', left, due, years: cy, kept: (dec['child:' + id] || {}).until || '' }); }
  if (sy) for (const a of accounts.list) { if (!isFormerAccount(a)) continue; const due = addYears(a.leaveOn, sy), key = 'staff:' + nameKey(a.name);
    if (waits(key, due)) out.push({ kind: 'staff', id: a.name, name: a.name, left: a.leaveOn, due, years: sy, kept: (dec[key] || {}).until || '' }); }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
const keepKey = it => it.kind + ':' + (it.kind === 'staff' ? nameKey(it.id) : it.id);
function dropRecord(kind, id) { const r = store.recs[kind].get(id); if (!r || r.deleted) return 0; r.deleted = true; r.local = true; noteChange(kind, id); scheduleSave(kind, id); return 1; }
function setSetting(id, doc) { const cur = store.recs.settings.get(id); store.recs.settings.set(id, { doc: Object.assign({}, doc, { id, updatedByName: 'TREE', savedAt: Date.now() }), sha: cur && cur.sha, path: `settings/${id}.json`, local: true }); noteChange('settings', id); scheduleSave('settings', id); }
const staff = require('./staff.js')({ gh, repo: RECORDS_REPO, store, log, accounts, accountFor, saveAccounts: n => saveAccounts(n), isDirector, isKitchen, isOffice, nameKey, keepOriginal: (id, b, t, m) => keepOriginal(id, b, t, m), readOriginal, reminders, lensNow, rosterNames,
  checkPasscode, nameBlocked, calendarEvents: (f, t) => calendar.events(f, t), setSetting, roleNames: () => [...roles.directors, ...roles.office, ...DIRECTORS] });
setInterval(() => { try { settleFormer(); } catch (e) { log('Former educators could not be settled', e.message); } }, 10 * 60e3).unref();
const menuIntake = require('./menu-intake.js')({ keepFile: (id, b, t, m) => keepOriginal(id, b, t, m), store, log, askClaude, anthropicKey, noteChange: (k, id) => noteChange(k, id), scheduleSave: (k, id) => scheduleSave(k, id) });
setInterval(() => menuIntake.run().catch(e => log('Menus from the Kitchen Digest could not be read', e.message)), 30 * 60000).unref();
const KEY_NO_WRITE = 'GitHub will not let the access key save changes. On GitHub, edit the Planning records token and set Contents to Read and write.';
const KEY_PROBLEM = 'GitHub rejected the access key, so changes cannot be saved. The GitHub token on Render has probably expired. Renew it on GitHub and paste the new one into GITHUB_TOKEN on Render.';
const SAVE_WAIT = 'Changes are taking longer than usual to reach GitHub. They are kept on the server and saving keeps trying, so keep working, and avoid closing the app for a few minutes.';
function isRateLimit(r) { return r.status === 429 || (r.status === 403 && (/rate limit|abuse/i.test((r.json && r.json.message) || '') || !!(r.headers && (r.headers['retry-after'] || r.headers['x-ratelimit-remaining'] === '0')))); }
let rev = 0; const changeLog = []; const BOOT_ID = crypto.randomBytes(6).toString('hex');
function noteChange(kind, id) { rev++; changeLog.push({ rev, kind, id }); if (changeLog.length > 5000) changeLog.splice(0, 1000); }

let loading = null;
// how much room the records use. GitHub asks for under 1 GB and strongly recommends under 5 GB. Its own count includes
// the history, so a deleted photo still counts. It is read again every six hours.
async function readRepoSize() { try { const r = await gh('GET', `/repos/${RECORDS_REPO}?fresh=${Date.now()}`); if (r.status === 200) { store.repoKb = Number(r.json.size) || 0; store.repoKbAt = Date.now(); } } catch (e) {} }
setInterval(readRepoSize, 6 * 3600e3).unref();
function storageNow() { let photos = 0, bytes = 0, inDrive = 0; for (const o of store.originals.values()) { if (o.drive) { inDrive++; continue; } photos++; bytes += Number(o.size) || 0; } return { photos, photoBytes: bytes, inDrive, driveOn: photosDrive.on(), repoBytes: Math.max((store.repoKb || 0) * 1024, bytes), at: store.repoKbAt || 0 }; }
function loadAll() { if (!loading) loading = doLoad().finally(() => { loading = null; if (!store.ready && githubToken()) setTimeout(loadAll, 60000); }); return loading; }
async function doLoadGraph() {
  log('GitHub allowance spent, reading the records through GraphQL');
  const d = await gql(`query{${gqlRepo()}{defaultBranchRef{name}}}`);
  store.branch = ((d.repository || {}).defaultBranchRef || {}).name || 'main';
  const files = await gqlFiles(store.branch);
  const jobs = [];let accSha = '', rolesSha = '';
  for (const f of files) {
    const m = f.path.match(/^(plans|threads|scans|settings|projects|notices|children|conferences|slides|inquiries|newsletters|bins|menus|grant|stories|posts|participation)\/([^/]+)\.json$/);
    if (m) jobs.push({ kind: m[1], id: m[2], path: f.path, sha: f.sha });
    if (f.path === DRDP_PATH) drdpSha = f.sha;
    if (f.path === ACCOUNTS_PATH) accSha = f.sha;
    if (f.path === ROLES_PATH) rolesSha = f.sha;
    const o = f.path.match(/^originals\/([^/]+)$/);
    if (o) { const cur = store.originals.get(o[1]); if (cur && cur.drive) cur.leftover = { path: f.path, sha: f.sha }; else store.originals.set(o[1], { path: f.path, sha: f.sha, size: 0 }); }
    if (f.path.startsWith('photos/')) photosDrive.seen(f.path);
  }
  const texts = await gqlTexts([...jobs.map(j => j.sha), ...(accSha ? [accSha] : []), ...(rolesSha ? [rolesSha] : []), ...(drdpSha ? [drdpSha] : [])]);
  if (rolesSha) takeRoles(texts.get(rolesSha));
  if (accSha) { accounts.sha = accSha; try { const a = JSON.parse(texts.get(accSha) || '{}'); if (Array.isArray(a.accounts)) accounts.list = a.accounts.filter(x => x && x.name); } catch (e) { log('The sign-ins file could not be read'); } }
  accounts.loaded = true;
  for (const j of jobs) { const tx = texts.get(j.sha); if (tx == null) { log('Skipped unreadable record', j.path); continue; } try { store.recs[j.kind].set(j.id, { doc: JSON.parse(tx), sha: j.sha, path: j.path }); } catch (e) { log('Skipped unreadable record', j.path); } }
  if (drdpSha) { try { DRDP_DESC = JSON.parse(texts.get(drdpSha)); } catch (e) { DRDP_DESC = null; } }
  if (!store.recheckSet) { store.recheckSet = true; setTimeout(() => recheckRecords().catch(e => log('Could not read the records again', e.message)), 15 * 60000); }
  store.ready = true; store.error = ''; store.loadedAt = Date.now();
  try { linkPlansToObservations(); syncGroups('program'); } catch (e) { log('Plans could not be linked to their observations', e.message); }
  try { settleFormer(); } catch (e) { log('Former educators could not be settled', e.message); }
  runOnce();
  log(`Loaded through GraphQL ${store.recs.plans.size} plans, ${store.recs.notices.size} notices, ${store.recs.posts.size} posts`);
}
async function doLoad() {
  if (!githubToken()) { store.error = 'No GITHUB_TOKEN is saved on Render. Add it under Environment.'; log(store.error); return; }
  try {
    const repo = await gh('GET', `/repos/${RECORDS_REPO}`);
    if (restSpent(repo)) { await doLoadGraph(); return; }
    if (repo.status === 404) throw new Error(`The records repository ${RECORDS_REPO} was not found, or the GitHub token cannot see it. Check RECORDS_REPO and give the token access to that repository.`);
    if (repo.status === 401) throw new Error('GitHub rejected the token. Make a new fine-grained token with Contents read and write on the records repository.');
    if (repo.status !== 200) throw new Error('GitHub answered ' + repo.status + ' when opening the records repository.');
    store.branch = repo.json.default_branch || 'main';
    store.repoKb = Number(repo.json.size) || 0; store.repoKbAt = Date.now();
    await loadAccounts();
    const tree = await gh('GET', `/repos/${RECORDS_REPO}/git/trees/${encodeURIComponent(store.branch)}?recursive=1&fresh=${Date.now()}`);
    if (tree.json && tree.json.truncated) log('GitHub listed only part of the records');
    if (tree.status === 409) { store.ready = true; store.loadedAt = Date.now(); return; }   // empty repository
    if (tree.status !== 200) throw new Error('GitHub answered ' + tree.status + ' when listing records.');
    const files = (tree.json.tree || []).filter(t => t.type === 'blob');
    const jobs = [];
    for (const f of files) {
      const m = f.path.match(/^(plans|threads|scans|settings|projects|notices|children|conferences|slides|inquiries|newsletters|bins|menus|grant|stories|posts|participation)\/([^/]+)\.json$/);
      if (m) jobs.push({ kind: m[1], id: m[2], path: f.path, sha: f.sha });
      if (f.path === DRDP_PATH) drdpSha = f.sha;
      const o = f.path.match(/^originals\/([^/]+)$/);
      if (o) { const cur = store.originals.get(o[1]); if (cur && cur.drive) cur.leftover = { path: f.path, sha: f.sha }; else store.originals.set(o[1], { path: f.path, sha: f.sha, size: f.size }); }
      if (f.path.startsWith('photos/')) photosDrive.seen(f.path);
    }
    let i = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const j = jobs[i++];
        const b = await gh('GET', `/repos/${RECORDS_REPO}/git/blobs/${j.sha}`);
        if (restSpent(b)) { const e = new Error('spent'); e.spent = true; throw e; }
        if (b.status !== 200) throw new Error('GitHub answered ' + b.status + ' when reading ' + j.path);
        try { const doc = JSON.parse(Buffer.from(b.json.content, 'base64').toString('utf8')); store.recs[j.kind].set(j.id, { doc, sha: j.sha, path: j.path }); }
        catch (e) { log('Skipped unreadable record', j.path); }
      }
    };
    try { await Promise.all(Array.from({ length: 8 }, worker)); }
    catch (e) { if (!e.spent) throw e; log('GitHub allowance spent while reading records, reading the rest through GraphQL');
      const left = jobs.filter(j => !store.recs[j.kind].has(j.id)); const texts = await gqlTexts(left.map(j => j.sha));
      for (const j of left) { const tx = texts.get(j.sha); if (tx == null) { log('Skipped unreadable record', j.path); continue; } try { store.recs[j.kind].set(j.id, { doc: JSON.parse(tx), sha: j.sha, path: j.path }); } catch (er) { log('Skipped unreadable record', j.path); } } }
    await loadDrdp();
    if (!store.recheckSet) { store.recheckSet = true; setTimeout(() => recheckRecords().catch(e => log('Could not read the records again', e.message)), 75000); }
    store.ready = true; store.error = ''; store.loadedAt = Date.now();
    // a former educator comes off the lists as soon as the records are read, as the GraphQL path does
    try { settleFormer(); } catch (e) { log('Former educators could not be settled', e.message); }
    runOnce();
    staff.load().then(() => runOnce(), e => log('Educator records could not be read', e.message));
    kaymbuInbox.repair().catch(e => log('Kaymbu moments could not be put right', e.message)).finally(() => { try { linkPlansToObservations(); syncGroups('program'); } catch (e) { log('Plans could not be linked to their observations', e.message); } });
    setTimeout(() => menuIntake.run().catch(e => log('Menus from the Kitchen Digest could not be read', e.message)), 20000).unref();
    if (photosDrive.on()) setTimeout(() => photosDrive.moveAll().catch(e => log('Photos could not move to Google Drive', e.message)), 60000).unref();
    log(`Loaded ${store.recs.plans.size} plans, ${store.recs.notices.size} notices, ${store.recs.threads.size} threads, ${store.recs.projects.size} projects, ${store.recs.children.size} children, ${store.recs.conferences.size} conferences, ${store.recs.slides.size} slides, ${store.recs.settings.size} settings`);
  } catch (e) { store.error = e.message; log('Could not load records.', e.message); }
}

// a plan that holds an observation's words, written or pasted in before plans kept the observation's id, keeps the id
// now, once, so a plan and its observations are found by id and never by matching words
// the small groups are one list. Program settings (plans, Today, stories) and Conference settings (the primary educator)
// each keep a copy, and a change saved in either is copied to the other, so the two never drift apart
const groupsKey = g => JSON.stringify((Array.isArray(g) ? g : []).filter(x => x && x.name).map(x => ({ name: String(x.name), room: String(x.room || ''), educator: String(x.educator || '') })));
function syncGroups(from) {
  const to = from === 'program' ? 'main' : 'program';
  const a = store.recs.settings.get(from), b = store.recs.settings.get(to);
  if (!a || a.deleted || !a.doc || !Array.isArray(a.doc.groups) || !b || b.deleted || !b.doc) return;
  if (groupsKey(a.doc.groups) === groupsKey(b.doc.groups)) return;
  b.doc.groups = JSON.parse(groupsKey(a.doc.groups)); b.local = true;
  noteChange('settings', to); scheduleSave('settings', to); log('Small groups copied from', from === 'program' ? 'Program settings to Conference settings' : 'Conference settings to Program settings');
}
const PLAN_KINDS = ['classroom', 'individual', 'smallgroup'];
function linkPlansToObservations() {
  const ns = []; for (const [id, r] of store.recs.notices) { const d = r && !r.deleted && r.doc; if (!d) continue; const bit = String(d.noticed || '').replace(/\s+/g, ' ').trim().slice(0, 50); if (bit.length >= 20) ns.push([id, bit]); }
  let n = 0;
  for (const [pid, r] of store.recs.plans) {
    const p = r && !r.deleted && r.doc; if (!p || p.id === 'example' || !PLAN_KINDS.includes(p.type)) continue;
    const text = Object.values(p.fields || {}).map(v => String(v || '').replace(/\s+/g, ' ')).join('\n'); if (!text.trim()) continue;
    const have = new Set(p.noticeAdded || []); const add = ns.filter(([id, bit]) => !have.has(id) && text.includes(bit)).map(([id]) => id);
    if (!add.length) continue;
    p.noticeAdded = [...have, ...add]; p.noticeUsed = [...new Set([...(p.noticeUsed || []), ...add])];
    noteChange('plans', pid); scheduleSave('plans', pid); n++;
  }
  if (n) log('Plans linked to the observations written in them,', n);
}

// one bundle of every record, built once from what the server holds. Each file keeps its path in the records repository,
// so tools/restore-backup.js can write the set back as it was.
let lastBackup = null;
function backupBundle(saved) {
  const files = {}, counts = {};
  for (const [kind, m] of Object.entries(store.recs)) { let n = 0; for (const [id, r] of m) { if (!r || r.deleted || !r.doc) continue; files[`${kind}/${id}.json`] = r.doc; n++; } counts[kind] = n; }
  let cal = 0; try { for (const [p, d] of Object.entries(calendar.dump())) { files[p] = d; cal++; } } catch (e) { log('The calendar could not be added to the backup', e.message); }
  counts.calendar = cal;
  let st = 0; try { for (const [p, d] of Object.entries(staff.dump())) { files[p] = d; st++; } } catch (e) { log('Educator records could not be added to the backup', e.message); }
  counts.staff = st;
  if (DRDP_DESC) { files[DRDP_PATH] = DRDP_DESC; counts.drdp = 1; }
  // who is the director and the office holds names only, never a passcode, so it comes back with a restore
  if (roles.directors.length || roles.office.length) { files[ROLES_PATH] = { note: 'Who TREE treats as the director and as the office. Kept here in the private records so no name is in TREE\'s public code.', directors: roles.directors, office: roles.office }; counts.roles = 1; }
  const photos = [...store.originals.entries()].map(([id, o]) => Object.assign({ id, size: Number(o.size) || 0 }, o.drive ? { drive: o.drive, ref: o.ref } : { path: o.path }));
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  return { manifest: { kind: 'TREE backup', date: day, at: new Date().toISOString(), version: process.env.RENDER_GIT_COMMIT || 'unknown', repo: RECORDS_REPO, branch: store.branch, files: Object.keys(files).length, counts, savedFirst: saved,
      photos: { total: photos.length, inDrive: photos.filter(p => p.drive).length, list: photos },
      left: 'Sign-ins, access/accounts.json, are not in the backup because they hold passcodes. The director and office names, access/roles.json, are. Photos are listed by id and Drive id, and the photo files stay in Google Drive and the records.' }, files };
}
async function recheckRecords() {
  const tree = await gh('GET', `/repos/${RECORDS_REPO}/git/trees/${encodeURIComponent(store.branch)}?recursive=1&fresh=${Date.now()}`);
  if (tree.status !== 200) return;
  let n = 0;
  for (const f of (tree.json.tree || [])) {
    const m = f.type === 'blob' && f.path.match(/^(plans|threads|scans|settings|projects|notices|children|conferences|slides|inquiries|newsletters|bins|menus|grant|stories|posts|participation)\/([^/]+)\.json$/); if (!m) continue;
    const rec = store.recs[m[1]].get(m[2]);
    if (rec && (rec.local || rec.sha === f.sha || rec.deleted)) continue;   // changed here since the start, or already the same
    const b = await gh('GET', `/repos/${RECORDS_REPO}/git/blobs/${f.sha}`); if (b.status !== 200) continue;
    // a change made here while GitHub was answering is newer than what GitHub holds, so it stays
    const now = store.recs[m[1]].get(m[2]); if (now && (now.local || now.deleted || now !== rec)) continue;
    try { const doc = JSON.parse(Buffer.from(b.json.content, 'base64').toString('utf8')); store.recs[m[1]].set(m[2], { doc, sha: f.sha, path: f.path }); noteChange(m[1], m[2]); n++; } catch (e) {}
  }
  if (n) log('Read', n, 'records again that changed while the server was starting');
}

/* ---------- FEED orders, for the Farm to School grant ----------
   Each confirmation becomes a record under grant/, one per order, with every item, its producer, unit, price and
   quantity. Bins are counted as food for student education and everything else as food for meals, which the director
   can change line by line. An order kept again keeps those choices. */
const { parseOrder, textOf } = require('./feed-order.js');
const orderQueue = []; let ordersRunning = false;
async function runOrders() {
  if (ordersRunning) return; ordersRunning = true;
  try { while (orderQueue.length) { const j = orderQueue.shift(); try { const r = await readOrderPart(j.part, j.by); log(r.doc ? 'Order kept, ' + r.doc.id + (r.doc.review ? ', waiting to be checked' : '') : r.skip ? 'Not an order, ' + j.part.name.slice(0, 80) + '. ' + r.skip : 'Order could not be read, ' + j.part.name.slice(0, 80) + '. ' + r.error); } catch (e) { log('Order could not be read,', e.message); } } }
  finally { ordersRunning = false; }
}
// FEED's confirmations and invoices are read exactly. Any other vendor's order is read by Claude and waits for the
// director to check it on the grant page before it is trusted.
async function readOrderPart(part, by) {
  const raw = typeof part.raw === 'string' ? part.raw : '';
  if (raw && /FEED Cooperative/i.test(raw.slice(0, 200000) + (part.subject || ''))) { const r = keepOrder(raw, by); if (!r.error) return r; }
  if (!anthropicKey()) return { error: 'Reading orders is not set up yet, so only FEED orders can be read.' };
  let content;
  if (part.data && /pdf/i.test(part.type + part.name)) content = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: part.data } }];
  else if (part.data && /^image\//i.test(part.type)) content = [{ type: 'image', source: { type: 'base64', media_type: part.type, data: part.data } }];
  else { const text = textOf(raw).slice(0, 40000); if (text.length < 40) return { skip: 'It was empty.' }; content = [{ type: 'text', text }]; }
  content.push({ type: 'text', text: `The director of a California preschool forwarded this for its Farm to School grant records. If it is an order, invoice or receipt for food the school bought, read it. If it is anything else, such as a shipping notice, a newsletter, a marketing email or a message, return {"order": false, "why": "a few words"}.
For an order, return a JSON object with "order": true, "vendor", who sold it, "number", the order or invoice number, "date", the delivery or invoice date as YYYY-MM-DD, "items", an array of objects with "item", "producer", the farm or company that grew or made it when the document names one, otherwise the vendor, "unit", "qty" as a number, "price" as a number and "total" as a number, and then "subtotal", "delivery" and "total" as numbers.
Copy names and numbers exactly as written. Never invent a number, and use null when one is missing. Leave taxes, delivery and fees out of the items. Return only the JSON.` });
  const r = await askClaude(content, true);
  if (r.status !== 200) { log('Order reading answered', r.status); return { error: 'The order could not be read just now.' }; }
  let o; try { const t = (JSON.parse(r.text).content || []).filter(x => x.type === 'text').map(x => x.text).join(''); o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (e) { return { error: 'The answer could not be read.' }; }
  if (!o || o.order === false) return { skip: String((o && o.why) || '') };
  const items = (Array.isArray(o.items) ? o.items : []).filter(x => x && x.item).map(x => ({ item: String(x.item), producer: String(x.producer || o.vendor || ''), unit: String(x.unit || ''), qty: Number(x.qty) || 0, price: x.price == null ? null : Number(x.price), total: x.total == null ? null : Number(x.total), use: 'meals' }));
  if (!items.length) return { skip: 'No food items were found.' };
  const vendor = String(o.vendor || 'Unknown vendor'); const date = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : '';
  // an order with no date it could read takes the day it was kept, so it still counts, and waits to be checked
  const laToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const slug = vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'vendor';
  const num = String(o.number || '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 30) || crypto.createHash('sha1').update(vendor + date + JSON.stringify(items)).digest('hex').slice(0, 10);
  // a FEED invoice read from a PDF is kept under the same name as its order email, so one order is never counted twice
  const feed = /\bfeed\b/i.test(vendor) && /^\d+$/.test(num);
  const id = feed ? 'order-' + num : 'order-' + slug + '-' + num; const cur = store.recs.grant.get(id); const was = cur && !cur.deleted ? cur.doc : null;
  if (feed && was && was.readBy !== 'Claude') return { doc: was };
  // a line the director already placed, meals or education, keeps that choice when the order is read again
  if (was) { const uses = new Map((was.items || []).map(x => [x.item + '|' + x.unit, x])); items.forEach(x => { const u = uses.get(x.item + '|' + x.unit); if (u) { x.use = u.use || x.use; if (u.useSet) x.useSet = true; if (u.serve) x.serve = u.serve; } }); }
  const fulfilled = date || (was && was.fulfilled) || laToday;
  const reading = { fulfilled, items, subtotal: o.subtotal == null ? null : Number(o.subtotal), delivery: o.delivery == null ? null : Number(o.delivery), total: o.total == null ? null : Number(o.total), distributor: vendor, ...(date ? {} : { noDate: true }) };
  // an order the director already checked keeps its lines, and the new reading waits beside it for the director to choose
  if (was && was.review === false) return keepRevision(id, cur, reading, { order: String(o.number || ''), readBy: 'Claude', from: String(part.name || '').slice(0, 120), by });
  const doc = Object.assign({ id, kind: 'order', order: String(o.number || ''), placed: '' }, reading, { noDate: !date || undefined,
    review: !date || (was ? !!was.review : true), readBy: 'Claude', from: String(part.name || '').slice(0, 120), keptAt: (was && was.keptAt) || Date.now(), keptBy: (was && was.keptBy) || by, updatedByName: by });
  if (!doc.noDate) delete doc.noDate;
  store.recs.grant.set(id, { doc, sha: cur && cur.sha, path: `grant/${id}.json`, local: true });
  noteChange('grant', id); scheduleSave('grant', id);
  return { doc };
}
// the same lines read again change nothing. Different lines are kept as a revision the director uses or sets aside.
const ORDER_FIELDS = ['fulfilled', 'items', 'subtotal', 'delivery', 'total', 'distributor'];
function sameReading(a, b) { const lines = d => JSON.stringify((d.items || []).map(x => [x.item, x.unit, x.producer, Number(x.qty) || 0, x.price == null ? null : Number(x.price), x.total == null ? null : Number(x.total)])); return lines(a) === lines(b) && (a.total == null ? null : Number(a.total)) === (b.total == null ? null : Number(b.total)) && (!b.fulfilled || a.fulfilled === b.fulfilled || b.noDate); }
function keepRevision(id, cur, reading, about) {
  const was = cur.doc;
  if (sameReading(was, reading)) { if (was.revision) { delete was.revision; cur.local = true; noteChange('grant', id); scheduleSave('grant', id); } return { doc: was, same: true }; }
  const revision = {}; for (const k of ORDER_FIELDS) revision[k] = reading[k];
  if (reading.noDate) revision.noDate = true;
  Object.assign(revision, { order: about.order || was.order || '', readBy: about.readBy, from: about.from || '', at: Date.now(), by: about.by });
  was.revision = revision; was.updatedByName = about.by; cur.local = true;
  noteChange('grant', id); scheduleSave('grant', id);
  log('Order', id, 'was already checked, so the new reading waits beside it');
  return { doc: was, revision: true };
}
function keepOrder(raw, by) {
  const o = parseOrder(raw);
  if (!o.order || !o.items.length) return { error: 'This does not look like a FEED order confirmation. No order number or items were found.' };
  const id = 'order-' + o.order; const cur = store.recs.grant.get(id); const was = cur && !cur.deleted ? cur.doc : null;
  const uses = new Map(((was && was.items) || []).map(x => [x.item + '|' + x.unit + '|' + x.producer, x]));
  o.items = o.items.map(x => { const u = uses.get(x.item + '|' + x.unit + '|' + x.producer); return Object.assign(x, { use: (u && u.use) || (/FEED Bin/i.test(x.item) ? 'education' : 'meals') }, u && u.useSet ? { useSet: true } : {}, u && u.serve ? { serve: u.serve } : {}); });
  if (was && was.review === false) { const rd = Object.assign({}, o); if (!rd.fulfilled) rd.fulfilled = was.fulfilled || rd.placed || ''; return keepRevision(id, cur, rd, { order: o.order, readBy: 'FEED', from: '', by }); }
  const doc = Object.assign({ id, kind: 'order' }, o, { keptAt: (was && was.keptAt) || Date.now(), keptBy: (was && was.keptBy) || by, updatedByName: by });
  store.recs.grant.set(id, { doc, sha: cur && cur.sha, path: `grant/${id}.json`, local: true });
  noteChange('grant', id); scheduleSave('grant', id);
  // an older copy of the same order read from its PDF invoice is removed, so the order counts once
  const dup = store.recs.grant.get('order-feed-cooperative-' + o.order);
  if (dup && !dup.deleted) { dup.deleted = true; dup.local = true; noteChange('grant', 'order-feed-cooperative-' + o.order); scheduleSave('grant', 'order-feed-cooperative-' + o.order); log('Removed a second copy of FEED order', o.order); }
  return { doc };
}

/* ---------- the kitchen's week ----------
   Educators see what is coming for lunch and snack, read from the orders kept for the grant, with nothing about money. */
const laDayOf = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const mondayFor = d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return addDay(d, -((w + 6) % 7)); };
// "OG Strawberry, Albion" reads "Albion strawberry", and "Melon, Charentais - Savor" reads "Charentais melon, Savor"
function kitchenName(item) {
  let t = String(item || '').replace(/^\s*OG\b\s*/i, '').replace(/\([^)]*\)/g, '').replace(/\b\d+\s*(#|lb|lbs|oz|ct|ea)\b/gi, '').replace(/\s+/g, ' ').trim();
  const [main, dash] = t.split(/\s+-\s+/);
  const [food, ...vars] = String(main || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!food) return { name: t, food: '' };
  const v = vars.join(' ');
  const name = (v ? v + ' ' + food.toLowerCase() : food) + (dash ? ', ' + dash.trim() : '');
  return { name: name.charAt(0).toUpperCase() + name.slice(1), food: food.toLowerCase() };
}
// a week's produce for the kitchen. One food from one farm is one line, so two lettuces from Longer Table Farm read
// Lettuce, Little Gem Green and Little Gem Red. Food bought for education stays with the classes.
function kitchenItemsFor(mon) {
  const items = [];
  for (const [, r] of store.recs.grant) {
    const o = r && !r.deleted && r.doc; if (!o || o.kind !== 'order') continue;
    const day = o.fulfilled || ''; if (!(day >= mon && day <= addDay(mon, 6))) continue;
    for (const x of o.items || []) {
      if (x.use === 'education' || /FEED\s*Bin/i.test(x.item || '') || /^feed cooperative/i.test(String(x.producer || '').trim()) || /\bbox\b/i.test(x.item || '')) continue;
      const k = kitchenName(x.item); if (!k.name) continue;
      const farm = String(x.producer || '').trim();
      // how the kitchen serves it, a side dish, cooked into a dish, or both, once the director has said
      const serve = x.serve && typeof x.serve === 'object' ? { side: !!x.serve.side, cooked: !!x.serve.cooked } : null;
      const have = items.find(y => y.food === k.food && y.farm === farm);
      if (!have) items.push(Object.assign({ name: k.name, names: [k.name], food: k.food, farm, day }, serve ? { serve } : {}));
      else { if (!have.names.includes(k.name)) have.names.push(k.name); if (serve) have.serve = { side: !!(have.serve && have.serve.side) || serve.side, cooked: !!(have.serve && have.serve.cooked) || serve.cooked }; }
    }
  }
  for (const it of items) if (it.names.length > 1) {
    const re = new RegExp('\\s*\\b' + it.food.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b', 'i');
    const kinds = it.names.map(n => n.replace(re, '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim()).filter(Boolean);
    it.name = it.food[0].toUpperCase() + it.food.slice(1) + (kinds.length ? ', ' + (kinds.length < 2 ? kinds[0] : kinds.slice(0, -1).join(', ') + ' and ' + kinds[kinds.length - 1]) : '');
  }
  items.sort((a, b) => a.food.localeCompare(b.food) || a.name.localeCompare(b.name));
  return items;
}
function kitchenWeeks() {
  const mon = mondayFor(laDayOf(Date.now()));
  return [mon, addDay(mon, 7)].map(m => ({ monday: m, items: kitchenItemsFor(m).map(({ names, ...it }) => it) }));
}

/* ---------- DRDP (2025) definitions and level descriptors ----------
   The official wording of each measure, read from the DRDP (2025) Infant and Toddler View and Preschool Transitional
   Kindergarten View, the editions of August 20, 2026. It is kept in the private records, never in the page, and added to
   a DRDP request here. */
const DRDP_PATH = 'drdp/descriptors.json';
let drdpSha = '', DRDP_DESC = null;
const DRDP_LV = { RE: 'Responding Earlier', RL: 'Responding Later', EE: 'Exploring Earlier', EM: 'Exploring Middle', EL: 'Exploring Later', BE: 'Building Earlier', BM: 'Building Middle', BL: 'Building Later', IE: 'Integrating Earlier', IM: 'Integrating Middle', IL: 'Integrating Later' };
async function loadDrdp() {
  if (!drdpSha) { DRDP_DESC = null; log('No DRDP descriptors in the records, so DRDP requests go without the official wording'); return; }
  try { const b = await gh('GET', `/repos/${RECORDS_REPO}/git/blobs/${drdpSha}`); DRDP_DESC = JSON.parse(Buffer.from(b.json.content, 'base64').toString('utf8')); log('DRDP descriptors loaded,', Object.keys(DRDP_DESC.ptk || {}).length, 'preschool and', Object.keys(DRDP_DESC.it || {}).length, 'infant and toddler measures'); }
  catch (e) { DRDP_DESC = null; log('Could not read the DRDP descriptors', e.message); }
}
function drdpBlock(view, codes) {
  const v = DRDP_DESC && DRDP_DESC[view]; if (!v) return '';
  const want = Array.isArray(codes) && codes.length ? new Set(codes.map(String)) : null;
  const label = view === 'it' ? 'Infant and Toddler View' : 'Preschool Transitional Kindergarten View';
  let out = `Official DRDP (2025) ${label}. For each measure, its definition and the descriptor of each developmental level it uses, earliest to latest, word for word from the instrument.\n`;
  for (const [code, m] of Object.entries(v)) {
    if (want && !want.has(code)) continue;
    out += `\n${code} ${m.name}. ${m.def}\n` + Object.entries(m.levels).map(([k, d]) => `  ${DRDP_LV[k] || k}: ${d}`).join('\n') + '\n';
  }
  return out;
}

// Saving to GitHub. Each file is saved by one chain at a time, and quick edits are gathered.
const chains = new Map(); const timers = new Map(); const dirtyPaths = new Map(); const failingSince = new Map();
function saveWarn() { const now = Date.now(); for (const t of failingSince.values()) if (now - t > 90000) return SAVE_WAIT; return ''; }
function scheduleSave(kind, id) {
  const path = `${kind}/${id}.json`; dirtyPaths.set(path, { kind, id });
  clearTimeout(timers.get(path));
  timers.set(path, setTimeout(() => flushPath(path), FLUSH_DELAY_MS));
}
function flushPath(path) {
  clearTimeout(timers.get(path)); timers.delete(path);
  const item = dirtyPaths.get(path); if (!item) return chains.get(path) || Promise.resolve();
  dirtyPaths.delete(path);
  const run = (chains.get(path) || Promise.resolve()).then(() => writeFile(item.kind, item.id)).then(() => { failingSince.delete(path); }, e => {
    log('Save failed', path, e.message); if (!failingSince.has(path)) failingSince.set(path, Date.now());
    if (!dirtyPaths.has(path)) dirtyPaths.set(path, item);
    if (!stopping) { clearTimeout(timers.get(path)); timers.set(path, setTimeout(() => flushPath(path), 30000)); } });
  chains.set(path, run);
  return run;
}
// true when everything waiting reached GitHub
async function flushEverything() { await Promise.all([...dirtyPaths.keys()].map(flushPath)); await Promise.all([...chains.values()]); return dirtyPaths.size === 0; }
// the address changes each time, so GitHub never hands back a copy from before the last save
// the messages of the latest commits that changed a file, kept a minute, or null when GitHub cannot be asked just now
const commitCache = new Map();
async function commitMessages(path) {
  const c = commitCache.get(path); if (c && Date.now() - c.at < 60000) return c.msgs;
  try { const r = await gh('GET', `/repos/${RECORDS_REPO}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(store.branch)}&per_page=100&fresh=${Date.now()}`);
    if (r.status !== 200 || !Array.isArray(r.json)) return null;
    const msgs = r.json.map(x => String((x.commit && x.commit.message) || '')); commitCache.set(path, { at: Date.now(), msgs }); if (commitCache.size > 500) commitCache.delete(commitCache.keys().next().value); return msgs; }
  catch (e) { return null; }
}
async function currentSha(path) { const r = await gh('GET', `/repos/${RECORDS_REPO}/contents/${path}?ref=${encodeURIComponent(store.branch)}&fresh=${Date.now()}`); return r.status === 200 ? r.json.sha : null; }
/* Each save from a device carries a save id. The id rides in the commit's message, so once GitHub has the commit the
   save is known to be written, even after the server restarts. A device keeps its copy of a save until it hears so. */
const SID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,63}$/;
const sidsWaiting = new Map(), sidsWritten = new Map(), sidsByPath = new Map();   // save id to its file, save id to when it was written, and a file to the save ids it holds
function sidWritten(sid) { sidsWaiting.delete(sid); sidsWritten.set(sid, Date.now()); if (sidsWritten.size > 20000) sidsWritten.delete(sidsWritten.keys().next().value); }
// a save that needed more than three tries is noted for the director's Today, with the record's name
const HARD_TRIES = 3;
function recordLabel(kind, id, doc) {
  doc = doc || {};
  const one = { children: 'Child', notices: 'Observation', plans: 'Plan', threads: 'Thread', projects: 'Project', conferences: 'Conference', participation: 'Participation', settings: 'Settings', slides: 'Slide', stories: 'Story', inquiries: 'Team inquiry', menus: 'Menu', grant: 'Grant record', bins: 'Weekly bin', family: 'Family', scans: 'Scan', newsletters: 'Newsletter', posts: 'Post' }[kind] || kind;
  const kidName = c => c ? [c.first || c.firstName || c.name || '', c.last || c.lastName || ''].join(' ').trim() : '';
  let name = '';
  if (kind === 'children') name = kidName(doc);
  else if (kind === 'conferences') { const c = store.recs.children.get(doc.childId || ''); name = (c && !c.deleted ? kidName(c.doc) : '') || doc.childName || ''; }
  else if (kind === 'notices') name = doc.at ? new Date(doc.at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' }) + (doc.by || doc.createdByName ? ', kept by ' + (doc.by || doc.createdByName) : '') : '';
  else name = doc.title || doc.name || doc.question || '';
  return (one + (name ? ', ' + String(name).slice(0, 80) : '')).trim();
}
function noteHardSave(kind, id, tries) {
  if (kind === 'settings' && id === 'saves') return;
  const rec = store.recs[kind] && store.recs[kind].get(id);
  const cur = store.recs.settings.get('saves'); const doc = cur && !cur.deleted ? cur.doc : { id: 'saves', hard: [] };
  const cut = Date.now() - 30 * 86400e3;
  const hard = (doc.hard || []).filter(h => h.at > cut).slice(-49);
  hard.push({ path: `${kind}/${id}.json`, label: recordLabel(kind, id, rec && rec.doc), tries, at: Date.now() });
  log('Save needed', tries, 'tries', `${kind}/${id}.json`);
  store.recs.settings.set('saves', { doc: Object.assign({}, doc, { id: 'saves', hard, updatedByName: 'TREE' }), sha: cur && cur.sha, path: 'settings/saves.json', local: true });
  noteChange('settings', 'saves'); scheduleSave('settings', 'saves');
}
const ghPause = ms => new Promise(res => setTimeout(res, ms));
async function writeFile(kind, id) {
  const rec = store.recs[kind].get(id); const path = `${kind}/${id}.json`;
  // the save ids this write carries. They count as written only once GitHub has the commit.
  const sids = sidsByPath.get(path) || []; sidsByPath.delete(path);
  const tag = sids.length ? ` (saves ${sids.join(' ')})` : '';
  const done = tries => { for (const s of sids) sidWritten(s); if (tries > HARD_TRIES) noteHardSave(kind, id, tries); };
  let tries = 0;
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      // after a refusal, GitHub is given a moment, and the save is tried again on the newest version of the file
      if (attempt) await ghPause(Math.min(8000, 600 * attempt));
      tries++;
      let r;
      if (!rec || rec.deleted) {
        const shaNow = (rec && rec.sha) || await currentSha(path);
        const forget = () => { const now = store.recs[kind].get(id); if (!now || now === rec) store.recs[kind].delete(id); };   // keep a record made again since the delete
        if (!shaNow) { forget(); done(tries); return; }
        r = await gh('DELETE', `/repos/${RECORDS_REPO}/contents/${path}`, { message: `Remove ${kind} ${id}${tag}`, sha: shaNow, branch: store.branch });
        if (r.status === 200 || r.status === 404) { forget(); done(tries); return; }
      } else {
        const content = Buffer.from(JSON.stringify(rec.doc, null, 2) + '\n', 'utf8').toString('base64');
        const by = rec.doc.updatedByName ? ` by ${rec.doc.updatedByName}` : '';
        r = await gh('PUT', `/repos/${RECORDS_REPO}/contents/${path}`, { message: `Update ${kind} ${id}${by}${tag}`, content, branch: store.branch, ...(rec.sha ? { sha: rec.sha } : {}) });
        if (r.status === 200 || r.status === 201) { rec.sha = r.json.content.sha; store.saveError = ''; done(tries); return; }
      }
      // changed on GitHub since, or the branch moved under it. The app's copy is kept and written on the newest version.
      if (r.status === 409 || r.status === 422) { const s = await currentSha(path); if (rec) rec.sha = s || undefined; continue; }
      if (isRateLimit(r)) { log('GitHub asked to slow down'); await ghPause(Math.min(60000, 1000 * (Number(r.headers && r.headers['retry-after']) || 10))); continue; }
      if (r.status >= 500) continue;   // GitHub could not write it just then, such as Could not create file
      if (r.status === 401) { store.saveError = KEY_PROBLEM; log('GitHub rejected the token'); }
      if (r.status === 403) { store.saveError = KEY_NO_WRITE; log('GitHub key cannot write'); }
      throw new Error('GitHub answered ' + r.status + ' ' + (r.json && r.json.message || ''));
    }
    throw new Error('GitHub kept refusing the save after ' + tries + ' tries');
  } catch (e) {
    // nothing is dropped. The save ids wait with the record for the next try.
    if (sids.length) sidsByPath.set(path, [...sids, ...(sidsByPath.get(path) || [])]);
    throw e;
  }
}

async function probeKey() {
  if (!store.saveError || !store.ready) return;
  try {
    const path = 'server-check.json'; const sha0 = await currentSha(path);
    const r = await gh('PUT', `/repos/${RECORDS_REPO}/contents/${path}`, { message: 'Check that saving works again', content: Buffer.from(JSON.stringify({ checkedAt: new Date().toISOString() }) + '\n').toString('base64'), branch: store.branch, ...(sha0 ? { sha: sha0 } : {}) });
    if (r.status === 200 || r.status === 201) { store.saveError = ''; log('Saving to GitHub works again'); for (const p of dirtyPaths.keys()) flushPath(p); }
  } catch (e) {}
}
setInterval(probeKey, 120000).unref();

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (v && typeof v === 'object' && v.__delete__ === true) { delete target[k]; continue; }
    if (v && typeof v === 'object' && !Array.isArray(v)) { if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {}; deepMerge(target[k], v); }
    else target[k] = v;
  }
  return target;
}

/* ---------- Anthropic ---------- */
const QUICK_MODELS = [process.env.ANTHROPIC_MODEL, 'claude-haiku-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5-5'].map(m => (m || '').trim()).filter((m, i, a) => m && a.indexOf(m) === i);
const CAREFUL_MODELS = [process.env.ANTHROPIC_CAREFUL_MODEL, 'claude-sonnet-5-5', 'claude-sonnet-4-6', 'claude-opus-4-5'].map(m => (m || '').trim()).filter((m, i, a) => m && a.indexOf(m) === i);
const MODEL_SETTINGS = { 'claude-haiku-5-5': { max_tokens: 8000, output_config: { effort: 'low' } } };
const modelAt = { quick: 0, careful: 0 };
function postAnthropic(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const lib = ANTHROPIC_BASE.protocol === 'http:' ? http : https;
    const req = lib.request({ hostname: ANTHROPIC_BASE.hostname, port: ANTHROPIC_BASE.port || undefined, path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-api-key': anthropicKey(), 'anthropic-version': '2023-06-01' } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') })); res.on('error', reject);
    });
    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => req.destroy(new Error('Claude did not answer in time')));
    req.on('error', reject); req.end(body);
  });
}
async function askClaude(content, careful, extra) {
  const lane = careful ? 'careful' : 'quick'; const list = careful ? CAREFUL_MODELS : QUICK_MODELS;
  while (true) {
    const model = list[modelAt[lane]];
    // careful requests (finding threads, project stories, scans) can write long answers, so they get more room
    const payload = Object.assign({ model, max_tokens: careful ? 20000 : 8000, messages: [{ role: 'user', content }] }, MODEL_SETTINGS[model] || {}, extra || {});
    let r = await postAnthropic(payload);
    // a search that pauses part way is asked to carry on, a few times at most
    for (let k = 0; k < 3 && r.status === 200; k++) { let m; try { m = JSON.parse(r.text); } catch (e) { break; } if (m.stop_reason !== 'pause_turn') break;
      payload.messages = [{ role: 'user', content }, { role: 'assistant', content: m.content }]; r = await postAnthropic(payload); }
    let retired = false; try { retired = r.status === 404 && JSON.parse(r.text).error.type === 'not_found_error'; } catch (e) {}
    if (retired && modelAt[lane] < list.length - 1) { log('Model ' + model + ' is not available, switching'); modelAt[lane]++; continue; }
    return r;
  }
}

/* ---------- a thread an observation might belong to ----------
   When an educator keeps an observation, or a Kaymbu post arrives, TREE quietly asks the quick model whether its words
   fit a thread the team is following. The answer is only a suggestion, kept on the observation and every photo of its post,
   for an educator to add with a tap or turn down. Nothing joins a thread without that tap. */
const suggestWait = new Map(); const suggestTimes = []; let suggestRunning = false; const suggestQueue = [];
const SUGGEST_PER_HOUR = Number(process.env.SUGGEST_PER_HOUR) || 120;
const SUGGEST_DELAY_MS = Number(process.env.SUGGEST_DELAY_MS) || 45000;
function noticeGroupDocs(doc) {
  const out = [];
  if (doc && doc.group) { for (const [, r] of store.recs.notices) if (!r.deleted && r.doc && r.doc.group === doc.group) out.push(r.doc); }
  else if (doc) out.push(doc);
  return out.sort((a, b) => (a.at || 0) - (b.at || 0));
}
function queueThreadSuggest(id) {
  const r = store.recs.notices.get(id); if (!r || r.deleted || !r.doc) return;
  const key = r.doc.group || id;
  // the words are often typed after the photo is kept, so the check waits until the observation has been quiet for a little while
  clearTimeout(suggestWait.get(key));
  suggestWait.set(key, setTimeout(() => { suggestWait.delete(key); suggestQueue.push(id); runSuggestQueue(); }, SUGGEST_DELAY_MS));
}
async function runSuggestQueue() {
  if (suggestRunning) return; suggestRunning = true;
  try { while (suggestQueue.length) { const id = suggestQueue.shift(); try { await suggestThreadFor(id); } catch (e) { log('Thread suggestion skipped,', e.message); } } }
  finally { suggestRunning = false; }
}
async function suggestThreadFor(id) {
  const r = store.recs.notices.get(id); if (!r || r.deleted || !r.doc) return;
  const docs = noticeGroupDocs(r.doc); const lead = docs[0] || r.doc;
  const words = [...new Set(docs.map(d => [d.noticed, d.wonder].filter(Boolean).join('\n').trim()).filter(Boolean))].join('\n').trim();
  if (words.split(/\s+/).filter(Boolean).length < 6) return;   // never from a photo alone, nor from a word or two
  const ids = new Set(docs.map(d => d.id));
  // an observation a team inquiry holds stays with the inquiry
  for (const [, q] of store.recs.inquiries) if (!q.deleted && q.doc && (q.doc.obs || []).some(x => ids.has(x))) return;
  const declined = new Set(docs.flatMap(d => d.threadNo || []));
  const inThread = t => docs.some(d => d.threadId === t.id) || (t.evidence || []).some(e => e && ids.has(e.planId || e.id));
  const live = [];
  for (const [tid, tr] of store.recs.threads) { const t = tr.doc; if (tr.deleted || !t || t.status === 'closed' || t.unfollowed) continue; if (declined.has(tid) || inThread(t)) continue;
    // what the team already decided for this thread, so the suggestion is weighed against the team's own judgment
    const added = (t.evidence || []).filter(e => e && e.via === 'suggest' && e.why).slice(-3).map(e => ({ words: String(e.text || '').slice(0, 140), why: String(e.why).slice(0, 140) }));
    const no = []; for (const [, nr] of store.recs.notices) { const nd = nr.doc; if (nr.deleted || !nd) continue; for (const w of nd.threadNoWhy || []) if (w && w.id === tid) no.push({ words: [nd.noticed, nd.wonder].filter(Boolean).join(' ').slice(0, 140), why: String(w.why || '').slice(0, 140), at: w.at || 0 }); }
    const turnedDown = no.sort((a, b) => b.at - a.at).slice(0, 3).map(({ words, why }) => ({ words, why }));
    live.push(Object.assign({ id: tid, name: String(t.name || '').slice(0, 80), question: String(t.question || '').slice(0, 200), seen: (t.evidence || []).slice(-3).map(e => String(e && e.text || '').slice(0, 160)).filter(Boolean) }, added.length ? { added } : {}, turnedDown.length ? { turnedDown } : {})); }
  if (!live.length) return;
  const keyNow = sha(words + '|' + live.map(t => t.id).sort().join(',')).toString('hex').slice(0, 16);
  if (docs.some(d => d.threadSuggestKey === keyNow)) return;
  if (!anthropicKey()) return;
  const now = Date.now(); while (suggestTimes.length && now - suggestTimes[0] > 3600e3) suggestTimes.shift();
  if (suggestTimes.length >= SUGGEST_PER_HOUR) return; suggestTimes.push(now);
  const prompt = `An educator at a preschool kept this observation.\n<<<\n${words.slice(0, 1500)}\n>>>\nThese are the threads the team is following. A thread is a question or idea children keep returning to, written as the educators' hypothesis.\n${JSON.stringify(live)}\nSay whether the observation clearly belongs to one or two of these threads, because the children in it are pursuing that same idea. Only when it clearly fits. A shared topic or place alone is not enough. Most observations fit none. Where a thread lists added, those are observations the team placed in it after a suggestion like this one, with the reason given. Where it lists turnedDown, the team said those observations do not belong, so do not suggest that thread for an observation like them.\nFor each fit give the thread id and a short reason of six to fourteen words in plain educator language, about what the children did, using no colons and no dashes.\nReply with only JSON like {"threads":[{"id":"","why":""}]} and an empty list when none fits.`;
  let out = null;
  try { const res = await askClaude([{ type: 'text', text: prompt }], false, { max_tokens: 400 });
    if (res.status !== 200) return;
    const m = JSON.parse(res.text); const txt = (m.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const j = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1); out = JSON.parse(j); } catch (e) { return; }
  const okIds = new Set(live.map(t => t.id));
  const clean = v => String(v || '').replace(/\s*[—–]\s*/g, ', ').replace(/:\s*/g, '. ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const picks = (Array.isArray(out && out.threads) ? out.threads : []).filter(x => x && okIds.has(x.id)).slice(0, 2).map(x => ({ id: x.id, why: clean(x.why), at: now }));
  for (const d of docs) { const rr = store.recs.notices.get(d.id); if (!rr || rr.deleted) continue;
    rr.doc.threadSuggestKey = keyNow; if (picks.length) rr.doc.threadSuggest = picks; else delete rr.doc.threadSuggest;
    noteChange('notices', d.id); scheduleSave('notices', d.id); }
  log(picks.length ? `Thread suggested for ${lead.id}${docs.length > 1 ? ' and ' + (docs.length - 1) + ' more photos' : ''}, ${picks.map(p => (store.recs.threads.get(p.id) || {}).doc.name).join(' and ')}` : `No thread fits ${lead.id}`);
}

// sites the newsletter's suggested reading may come from
const READING_SITES = ['developingchild.harvard.edu', 'earlychildhood.stanford.edu', 'reggiochildren.it', 'reggioalliance.org', 'healthychildren.org', 'aap.org', 'zerotothree.org', 'naeyc.org', 'cdc.gov', 'first5california.com', 'cde.ca.gov', 'extension.psu.edu', 'childmind.org', 'pbs.org', 'kidshealth.org', 'eatright.org', 'myplate.gov', 'janetlansbury.com', 'rie.org', 'understood.org'];

/* ---------- HTTP ---------- */
const ALLOWED_ORIGINS = ['https://renee-creator.github.io'].concat(String(process.env.ALLOWED_ORIGINS || '').split(',')).map(s => s.trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean);
function corsFor(req) {
  const o = String(req.headers.origin || '').replace(/\/+$/, '').toLowerCase();
  return ALLOWED_ORIGINS.includes(o) ? { 'Access-Control-Allow-Origin': req.headers.origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } : {};
}
function send(req, res, status, headers, body) {
  try { if (res.headersSent) { res.end(); return; } res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, corsFor(req), headers)); res.end(body); }
  catch (e) { log('Could not send', e.message); }
}
// a large answer, such as the records TREE loads when it opens, is sent compressed when the browser accepts it, about a quarter of the size
function json(req, res, status, obj) {
  const body = JSON.stringify(obj);
  if (body.length > 16384 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    try { send(req, res, status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' }, zlib.gzipSync(Buffer.from(body, 'utf8'), { level: 6 })); return; } catch (e) {}
  }
  send(req, res, status, { 'Content-Type': 'application/json; charset=utf-8' }, body);
}
function err(req, res, status, message) { json(req, res, status, { error: message }); }
function readBody(req, limit) {
  const max = limit || MAX_BODY_BYTES;
  return new Promise((resolve, reject) => {
    // a body the sender says is too large is refused before any of it is read
    if (Number(req.headers['content-length']) > max) { reject(new Error('too_big')); req.resume(); return; }
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > max) { reject(new Error('too_big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(new Error('bad_json')); } });
    req.on('error', reject);
  });
}
let readTimes = []; let readsRunning = 0; let stopping = false;
const fileCache = new Map(); let fileCacheBytes = 0; const FILE_CACHE_MAX = 60 * 1024 * 1024;
function cacheFile(id, buf) { if (buf.length > 8 * 1024 * 1024) return; fileCache.set(id, buf); fileCacheBytes += buf.length; for (const [k, v] of fileCache) { if (fileCacheBytes <= FILE_CACHE_MAX) break; fileCache.delete(k); fileCacheBytes -= v.length; } }
function snapshot(director, kitchen, office) {
  const out = {}; for (const k of KINDS) { out[k] = {}; if (DIRECTOR_KINDS.includes(k) && !director) continue; if (OFFICE_KINDS.includes(k) && !office) continue; for (const [id, r] of store.recs[k]) if (!r.deleted && (!kitchen || kitchenSees(k, id)) && (director || !(k === 'settings' && (id === 'display' || id === 'keeping' || id === 'saves')))) out[k][id] = r.doc; }
  return out;
}
function statusPage(req, res) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const lines = [
    [store.ready, store.ready ? `Records are connected. ${store.recs.plans.size} plans and ${store.recs.threads.size} followed threads are loaded from ${RECORDS_REPO}.` : (store.error || 'Records are still loading.')],
    [!!anthropicKey(), anthropicKey() ? 'The writing help key is saved, so writing help is available.' : 'No writing help key is saved. Add ANTHROPIC_API_KEY under Environment to turn on writing help.'],
    [TEACHERS.length > 0, TEACHERS.length ? `${TEACHERS.length} educator passcodes are set. ${TEACHERS.some(t => isDirector(t.name)) ? 'The director has access.' : 'No director yet, so set DIRECTOR_NAMES.'}` : 'No educator passcodes are set. Add TEACHER_PASSCODES under Environment, like FirstName=a long passcode.'],
  ];
  lines.push(calendar.statusLine());
  lines.push(kaymbuInbox.statusLine());
  lines.push(feedBin.statusLine());
  lines.push(menuIntake.statusLine());
  { const st = storageNow(); lines.push([true, photosDrive.on() ? `Photos kept in Google Drive, ${st.inDrive}. Still in the records, ${st.photos}.` : 'Photos are kept in the records. Google Drive is not set up.']); }
  if (store.saveError) lines.unshift([false, store.saveError]);
  else if (saveWarn()) lines.unshift([false, saveWarn()]);
  if (SKIPPED_PASSCODES) lines.push([false, `${SKIPPED_PASSCODES} passcode entries were ignored. Each must be a passcode of at least 6 characters, or Name=passcode.`]);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TREE server status</title></head><body style="font-family:system-ui,sans-serif;font-size:18px;line-height:1.5;max-width:680px;margin:32px auto;padding:0 16px"><h1 style="font-size:22px">TREE server</h1><p>The server is running.</p>' +
    lines.map(([ok, t]) => `<p style="font-weight:600;color:${ok ? '#1a7f37' : '#b42318'}">${ok ? 'WORKING.' : 'NEEDS ATTENTION.'} ${t}</p>`).join('') +
    `<p style="color:#555;font-size:15px">Everyday model ${esc(QUICK_MODELS[modelAt.quick])}. Careful model ${esc(CAREFUL_MODELS[modelAt.careful])}.</p></body></html>`;
  send(req, res, 200, { 'Content-Type': 'text/html; charset=utf-8' }, html);
}

/* ---------- Staff room display ----------
   A screen in the staff room shows what is alive in TREE through the day, read only. It opens with its own long key,
   made by the director in Settings, and that key reaches nothing but this one picture of the program. Observations kept
   for a team inquiry stay off it, as they stay off walls, and an inquiry shows only when the director lets it. An inquiry
   whose observations name one child stays off until the director turns it on. */
const displaySeen = { at: 0 };
function displayDoc() { const r = store.recs.settings.get('display'); return r && !r.deleted && r.doc ? r.doc : null; }
function displayKey() { const d = displayDoc(); return d && typeof d.key === 'string' ? d.key : ''; }
function setDisplay(fields, by) {
  const cur = store.recs.settings.get('display');
  store.recs.settings.set('display', { doc: Object.assign({ id: 'display' }, fields, { updatedByName: by, savedAt: Date.now() }), sha: cur && cur.sha, path: 'settings/display.json', local: true });
  noteChange('settings', 'display'); scheduleSave('settings', 'display');
}
function displayView() { const d = displayDoc() || {}; return { key: d.key || '', madeAt: d.madeAt || 0, madeBy: d.madeBy || '', seenAt: displaySeen.at || 0 }; }
// an inquiry's children, read from its own observations and the observations of its threads, the way the inquiry page reads them
function inquiryChildren(x, notices) {
  const own = new Set(x.obs || []), ts = new Set(x.threads || []);
  for (const tid of ts) { const t = store.recs.threads.get(tid); for (const e of (t && !t.deleted && t.doc.evidence) || []) if (e && e.planId) own.add(e.planId); }
  const kids = new Set();
  for (const n of notices) if (own.has(n.id) || (n.threadId && ts.has(n.threadId))) for (const c of n.children || []) kids.add(c);
  return kids;
}
function inquiryShows(x, notices) { if (x.display === true) return true; if (x.display === false) return false; return inquiryChildren(x, notices).size !== 1; }
async function displayFeed() {
  const live = k => { const out = []; for (const [id, r] of store.recs[k]) if (r && !r.deleted && r.doc) out.push(Object.assign({ id }, r.doc)); return out; };
  const trim = (s, n) => { s = String(s || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim(); if (s.length <= n) return s; const cut = s.slice(0, n); const sp = cut.lastIndexOf(' '); return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;.\s]+$/, '') + '…'; };
  const fk = makeFileKey();
  const photoOf = n => (n && n.photo && typeof n.photo.id === 'string' && ID_RE.test(n.photo.id)) ? { src: photoSrc(n.photo.id), w: Number(n.photo.w) || 0, h: Number(n.photo.h) || 0 } : null;
  const kids = new Map(live('children').filter(c => c.status !== 'withdrawn').map(c => [c.id, c]));
  const roomsOf = n => { const r = []; if (n.classroom) r.push(n.classroom); for (const id of n.children || []) { const c = kids.get(id); if (c && c.classroom && !r.includes(c.classroom)) r.push(c.classroom); } return r; };
  const notices = live('notices');
  const inquiries = live('inquiries');
  const held = new Set(); for (const x of inquiries) for (const id of x.obs || []) held.add(id);
  const shown = notices.filter(n => !held.has(n.id) && photoOf(n)).sort((a, b) => (b.at || 0) - (a.at || 0));
  const now = Date.now();
  let recent = shown.filter(n => now - (n.at || 0) < 28 * 864e5);
  if (recent.length < 10) recent = shown.slice(0, 10);
  const moments = recent.slice(0, 36).map(n => ({ id: n.id, at: n.at || 0, photo: photoOf(n), noticed: trim(n.noticed, 300), wonder: trim(n.wonder, 200), rooms: roomsOf(n),
    children: (n.children || []).map(id => kids.get(id)).filter(Boolean).map(c => String(c.first || '').trim()).filter(Boolean).slice(0, 6) }));
  const latestPhoto = test => { const n = shown.find(test); return n ? photoOf(n) : null; };
  const firstName = s => String(s || '').trim().split(/\s+/)[0] || '';
  // observations kept in words alone, over the same recent stretch as the photos. One still waiting for its photo stays off.
  const wordsAll = notices.filter(n => !held.has(n.id) && !n.photo && String(n.noticed || '').trim()).sort((a, b) => (b.at || 0) - (a.at || 0));
  let wordsRecent = wordsAll.filter(n => now - (n.at || 0) < 28 * 864e5);
  if (wordsRecent.length < 4) wordsRecent = wordsAll.slice(0, 4);
  const words = wordsRecent.slice(0, 12).map(n => ({ id: n.id, at: n.at || 0, noticed: trim(n.noticed, 420), wonder: trim(n.wonder, 240), rooms: roomsOf(n), by: firstName(n.by),
    children: (n.children || []).map(id => kids.get(id)).filter(Boolean).map(c => String(c.first || '').trim()).filter(Boolean).slice(0, 6) }));
  // the reflection educators write once a week has passed, Final remarks on an Individual plan and After the week on a Small Group plan
  const sinceWeek = addDay(mondayFor(laDayOf(now)), -21);
  const AFTER = { individual: ['remarks', 'Final remarks'], smallgroup: ['reflection', 'After the week'] };
  const reflections = live('plans').filter(p => p.id !== 'example' && !p.blank && AFTER[p.type] && /^\d{4}-\d{2}-\d{2}$/.test(p.weekOf || '') && p.weekOf >= sinceWeek && String((p.fields || {})[AFTER[p.type][0]] || '').trim())
    .sort((a, b) => b.weekOf.localeCompare(a.weekOf) || (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8)
    .map(p => ({ id: p.id, label: AFTER[p.type][1], text: trim(p.fields[AFTER[p.type][0]], 460), by: firstName(p.educator), room: p.classroom || '', group: p.type === 'smallgroup' ? trim(p.group, 40) : '', week: p.weekOf }));
  // moments the director found through a lens, the plan's or observation's own words, shown only while those words are still there
  const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const PLAN_NAME = { classroom: 'Classroom plan', individual: 'Individual plan', smallgroup: 'Small Group plan' };
  const lensSeen = new Set(); const lensMoments = [];
  for (const sc of live('scans').filter(s => s.kind === 'lens' && Array.isArray(s.moments) && s.moments.length && now - (s.createdAt || 0) < 56 * 864e5).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
    for (const m of sc.moments) {
      if (lensMoments.length >= 6) break;
      const q = String(m && m.quote || '').trim(); if (!q || !m.planId || held.has(m.planId) || lensSeen.has(m.planId + '|' + squash(q))) continue;
      const pr = store.recs.plans.get(m.planId), nr = store.recs.notices.get(m.planId);
      const p = pr && !pr.deleted && pr.doc, n = !p && nr && !nr.deleted && nr.doc; if (!p && !n) continue;
      const src = p ? Object.values(p.fields || {}).join(' ') + ' ' + (p.web ? JSON.stringify(p.web) : '') : [n.noticed, n.wonder].join(' ');
      if (!squash(src).includes(squash(q))) continue;
      lensSeen.add(m.planId + '|' + squash(q));
      lensMoments.push({ id: sc.id + '.' + m.planId + '.' + lensMoments.length, lens: trim(sc.lensName, 80), quote: trim(q, 300), language: trim(m.language, 40),
        found: p ? PLAN_NAME[p.type] || 'plan' : 'observation', by: firstName(p ? p.educator : n.by), room: p ? p.classroom || '' : roomsOf(n)[0] || '', week: p ? p.weekOf || '' : n.week || '', at: n ? n.at || 0 : 0 });
    }
  }
  // threads the school is following now, with the last words that joined them
  const threads = live('threads').filter(t => !t.unfollowed && ['emerging', 'growing', 'deepening'].includes(t.status || 'emerging'))
    .sort((a, b) => String(b.lastWeek || '').localeCompare(String(a.lastWeek || '')) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 10)
    .map(t => { const ev = (t.evidence || []).filter(e => e && String(e.text || '').trim()); const evIds = new Set(ev.map(e => e.planId));
      // the newest words by their week, then by when they joined, and by their place in the list only when both are the same
      const newest = ev.map((e, i) => [e, i]).sort((a, b) => String(b[0].week || '').localeCompare(String(a[0].week || '')) || (Number(b[0].at) || 0) - (Number(a[0].at) || 0) || b[1] - a[1])[0];
      return { id: t.id, name: trim(t.name, 80), question: trim(t.question, 220), room: t.classroom || '', weeks: (t.weeks || []).length, words: newest ? trim(newest[0].text, 220) : '',
        photo: latestPhoto(n => n.threadId === t.id || evIds.has(n.id)) }; });
  const projects = live('projects').filter(x => x.status !== 'closed').sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 8)
    .map(x => { const tids = new Set((x.threads || []).map(t => t && t.id).filter(Boolean));
      // a project's photos include every observation its threads hold, as tagged or as Find threads attached them, as on its page
      const evIds = new Set((x.evidence || []).map(e => e && (e.planId || e.id)).filter(Boolean));
      for (const id of tids) { const d = store.recs.threads.get(id); if (d && !d.deleted && d.doc) for (const e of d.doc.evidence || []) if (e && (e.planId || e.id)) evIds.add(e.planId || e.id); }
      const rooms = [...new Set([x.home, ...(x.classrooms || []).map(c => c && c.room)].filter(Boolean))];
      return { id: x.id, name: trim(x.name, 80), experience: trim(x.experience, 260), underneath: trim(x.underneath, 260), intent: trim(x.intent != null ? x.intent : (x.decision && x.decision.why), 260), rooms,
        threads: (x.threads || []).map(t => { const d = t && store.recs.threads.get(t.id); return d && !d.deleted ? trim(d.doc.name, 60) : ''; }).filter(Boolean).slice(0, 4),
        photo: latestPhoto(n => n.projectId === x.id || (n.threadId && tids.has(n.threadId)) || evIds.has(n.id)) }; });
  const prog = store.recs.settings.get('program'); const pv = prog && !prog.deleted && prog.doc ? prog.doc : {};
  const lensList = Array.isArray(pv.lenses) && pv.lenses.length ? pv.lenses : pv.lens ? [Object.assign({ year: true }, pv.lens)] : [];
  const lenses = lensList.filter(l => l && l.year && String(l.name || '').trim()).map(l => ({ name: trim(l.name, 80), description: trim(l.description, 320), questions: (Array.isArray(l.questions) ? l.questions : []).map(q => trim(q, 140)).filter(Boolean).slice(0, 3) }));
  const inq = inquiries.filter(x => x.status !== 'closed' && x.status !== 'resting' && String(x.name || '').trim() && inquiryShows(x, notices))
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 6)
    .map(x => ({ id: x.id, name: trim(x.name, 120), room: x.room || '', see: trim(x.see, 260), watch: trim(x.watch, 200), lookAgain: /^\d{4}-\d{2}-\d{2}$/.test(x.lookAgain || '') ? x.lookAgain : '',
      tries: (x.tries || []).filter(t => t && String(t.text || '').trim()).slice(-2).map(t => trim(t.text, 160)) }));
  // the week ahead from the school's calendars, with birthdays. Family conferences and meals stay on their own screens.
  const today = laDayOf(now), until = addDay(today, 6);
  let week = [];
  try { const c = await Promise.race([calendar.today({ director: false }, today, until), new Promise(r => setTimeout(() => r(null), 8000))]);
    if (c && Array.isArray(c.events)) { const names = new Map(((c.settings && c.settings.calendars) || []).map(x => [x.id, x.name]));
      week = c.events.filter(e => e && !e.conf && e.cal !== 'tconf' && e.cal !== 'tmenu').map(e => ({ title: trim(e.title, 90), start: String(e.start || ''), end: String(e.end || ''), allDay: !!e.allDay, birthday: e.cal === 'tbday', cal: names.get(e.cal) || '' }))
        .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 14); } } catch (e) { log('The display could not read the calendar', e.message); }
  // today's food, from the month's menu, and this week's FEED bin
  let menu = null;
  for (const m of live('menus')) { const d = m.days && m.days[today]; if (d && !d.closed) { const monday = new Date(today + 'T12:00:00Z').getUTCDay() === 1;
    menu = { am: trim(d.am, 120), lunch: trim(d.lunch, 160), pm: monday ? '' : trim(d.pm, 120) }; if (!menu.am && !menu.lunch && !menu.pm) menu = null; break; } }
  const mon = mondayFor(today), sun = addDay(mon, 6);
  const binDoc = live('bins').filter(b => b.date >= mon && b.date <= sun && Array.isArray(b.items) && b.items.length).sort((a, b) => a.date.localeCompare(b.date))[0];
  const bin = binDoc ? { date: binDoc.date, label: trim(binDoc.label, 60), items: binDoc.items.map(i => ({ name: trim(i && i.name, 50), farm: trim(i && Array.isArray(i.farms) ? i.farms[0] : '', 50) })).filter(i => i.name).slice(0, 14) } : null;
  // DRDP in practice. A level an educator reviewed and accepted from an observation, shown with that observation, the
  // measure's official definition and the official wording of the level, so the team sees what a measure looks like in real
  // play. It is always evidence from our documentation, never a DRDP rating. Observations kept for an inquiry stay out.
  const drdp = []; const byId = new Map(notices.map(n => [n.id, n]));
  const lvName = l => DRDP_LV[l] || String(l || '');
  const lvKey = (levels, l) => { if (!levels) return ''; if (levels[l]) return l; const k = Object.keys(DRDP_LV).find(c => DRDP_LV[c] === l); return k && levels[k] ? k : ''; };
  for (const c of kids.values()) {
    for (const x of Object.values((c.drdp && c.drdp.items) || {})) {
      if (!x || (x.status !== 'accepted' && x.status !== 'changed') || !x.level || !x.code || !x.src || x.src.kind !== 'notices') continue;
      const n = byId.get(x.src.id); if (!n || held.has(n.id) || !photoOf(n)) continue;
      const view = x.view === 'it' ? 'it' : 'ptk'; const m = DRDP_DESC && DRDP_DESC[view] && DRDP_DESC[view][x.code];
      const k = m ? lvKey(m.levels, x.level) : '';
      drdp.push({ id: n.id + '.' + x.code + '.' + crypto.createHash('sha1').update(String(c.id)).digest('hex').slice(0, 10), at: x.reviewedAt || 0, code: x.code, measure: m ? trim(m.name, 90) : '', def: m ? trim(m.def, 260) : '',
        level: lvName(x.level), emerging: !!x.emerging, descriptor: k ? trim(m.levels[k], 260) : '', view: view === 'it' ? 'Infant and Toddler View' : 'Preschool Transitional Kindergarten View',
        child: String(c.first || '').trim(), rooms: roomsOf(n), photo: photoOf(n), noticed: trim(n.noticed, 200), seen: n.at || 0, by: String(x.reviewedBy || '').trim() });
    }
  }
  // the most recently reviewed first, one to a measure, so the screens show a range of the instrument
  const codes = new Set(); const drdpShown = drdp.sort((a, b) => b.at - a.at).filter(d => !codes.has(d.code) && codes.add(d.code)).slice(0, 6);
  // stories the team has made to read with children, the cover and the first pages that have a photo
  const byNote = new Map(notices.map(n => [n.id, n]));
  const stories = live('stories').filter(st => st && st.reviewed && !st.offShare && String(st.title || '').trim() && (st.pages || []).some(p => String(p && p.lines || '').trim()))
    .sort((a, b) => (b.updatedAt || b.at || 0) - (a.updatedAt || a.at || 0)).slice(0, 4)
    .map(st => { const cover = photoOf(byNote.get(st.coverPhoto)) || (st.pages || []).map(p => photoOf(byNote.get(p && p.photo))).find(Boolean) || null;
      const pages = (st.pages || []).filter(p => p && String(p.lines || '').trim()).map(p => ({ heading: trim(p.heading, 60), lines: String(p.lines).split('\n').map(l => trim(l, 120)).filter(Boolean).slice(0, 3), photo: photoOf(byNote.get(p.photo)) }))
        .filter(p => p.photo && !(cover && p.photo.src === cover.src)).slice(0, 2);
      return { id: st.id, title: trim(st.title, 90), cover: trim(st.cover, 90), room: st.classroom || '', group: st.group || '', photo: cover, pages }; })
    .filter(st => st.photo);
  // finished Documentation slides, a title, the team's words and a photo, with children's names as the director chose for display
  const allKids = live('children').filter(c => c && c.first);
  const nameMode = (pv.print && pv.print.names) || 'first';
  const docSlides = live('slides').filter(x => String(x.title || '').trim() && String(x.text || '').trim())
    .map(x => { const ph = (x.photos || []).map(id => byNote.get(id)).find(n => n && !held.has(n.id) && photoOf(n)); return ph ? { x, ph } : null; }).filter(Boolean)
    .sort((a, b) => (b.x.updatedAt || b.x.at || 0) - (a.x.updatedAt || a.x.at || 0)).slice(0, 6)
    .map(({ x, ph }) => { const mode = x.names || nameMode; const extra = (x.quotes || []).map(q => (q && q.name || '') + ' - ' + (q && q.words || '')).join('\n');
      const nm = t => namesForDisplay(t, mode, extra, allKids);
      return { id: x.id, title: trim(nm(x.title), 90), text: trim(nm(x.text), 420), photo: photoOf(ph), rooms: roomsOf(ph).length ? roomsOf(ph) : (x.classroom ? [x.classroom] : []), at: ph.at || x.at || 0,
        quotes: (x.quotes || []).filter(q => q && String(q.words || '').trim()).slice(0, 2).map(q => ({ words: trim(nm(q.words), 160), by: nameCredit(q.name, mode, allKids) })) }; });
  // a recent moment of children with food, from the food words, for the food slide
  const FOODW = /\b(cook|cooking|bake|baking|bread|dough|soup|salad|tast(e|ed|ing)|harvest(ed|ing)?|garden|seeds?|chop|peel|wash(ed|ing)? the|fruit|vegetables?|apples?|pumpkins?|squash|kale|lettuce|carrots?|tomato(es)?|eggs?|feed bin|farm bin|snack)\b/i;
  const fm = shown.find(n => now - (n.at || 0) < 21 * 864e5 && FOODW.test(String(n.noticed || '') + ' ' + String(n.wonder || '')));
  const foodMoment = fm ? { id: fm.id, at: fm.at || 0, photo: photoOf(fm), noticed: trim(fm.noticed, 300), wonder: trim(fm.wonder, 200), rooms: roomsOf(fm), children: [] } : null;
  // Proud Moments and Kudos shared with everyone at Fulton
  let proud = []; try { proud = staff.displayMoments(); } catch (e) {}
  return { at: now, today, moments, words, reflections, lensMoments, threads, projects, lenses, inquiries: inq, week, menu, bin, foodMoment, drdp: drdpShown, stories, slides: docSlides, proud };
}
// children's names on display documentation, the same rule TREE's slides print with. First names, first name and last
// initial, initials, or no names at all. The educators' words never change otherwise.
function shownKidName(first, last, mode) { if (mode === 'none') return ''; if (mode === 'initials') return first[0] + '.'; if (mode === 'full' && last) return first + ' ' + last[0] + '.'; return first; }
function namesForDisplay(text, mode, extra, kidsList) {
  let t = String(text || ''); if (!mode || mode === 'first') return t;
  const named = new Set(kidsList.map(c => String(c.first || '').trim()).filter(n => /^[A-Za-z][A-Za-z'-]*$/.test(n)));
  for (const line of (t + '\n' + (extra || '')).split('\n')) { const m = line.match(/^([A-Z][a-z]+)(?: \[\?\])? - /); if (m) named.add(m[1]); }
  const names = [...named].sort((a, b) => b.length - a.length);
  const lastOf = n => { const c = kidsList.find(x => x.first === n && x.status !== 'withdrawn') || kidsList.find(x => x.first === n); return c ? c.last || '' : ''; };
  t = t.split('\n').map(line => { const m = line.match(/^([A-Z][a-z]+)( \[\?\])? - (.+)$/); if (m && names.includes(m[1])) return mode === 'none' ? '\u201c' + m[3] + '\u201d' : shownKidName(m[1], lastOf(m[1]), mode) + ' - ' + m[3]; return line; }).join('\n');
  for (const n of names) { const re = new RegExp('\\b' + n + '\\b(?!\\s+[Gg]roup)(?:\\s+[A-Z]\\.)?', 'g'); t = t.replace(re, mode === 'none' ? 'a child' : shownKidName(n, lastOf(n), mode)); }
  if (mode === 'none') t = t.replace(/\ba child and a child\b/g, 'two children').replace(/(^|[.!?]\s+|\n)(a child|two children)/g, (m, p, w) => p + w[0].toUpperCase() + w.slice(1));
  return t;
}
function nameCredit(name, mode, kidsList) { if (!name || mode === 'none') return ''; const n = String(name).replace(/ \[\?\]$/, ''); const c = kidsList.find(x => x.first === n); return shownKidName(n, c ? c.last || '' : '', mode || 'first'); }

async function handle(req, res) {
  const url = new URL(req.url || '/', 'http://x'); const path = url.pathname;
  if (req.method === 'OPTIONS') { send(req, res, 204, {}, undefined); return; }
  if (req.method === 'GET' && (path === '/' || path === '/status')) { statusPage(req, res); return; }
  if (req.method === 'GET' && path === '/health') { json(req, res, 200, { ok: true, ready: store.ready, error: store.error || undefined, saveError: store.saveError || undefined, saveWarn: saveWarn() || undefined, bootId: BOOT_ID }); return; }

  // original form files are opened in an img or a new tab, which cannot send a header, so the session rides in the address
  if (req.method === 'GET' && path.startsWith('/original/')) {
    // the key in the address is the permission, so any page of TREE may read the picture, and the answer never depends on who asked
    const open = { 'Access-Control-Allow-Origin': '*', 'Vary': 'Origin', 'Cross-Origin-Resource-Policy': 'cross-origin' };
    let id = ''; try { id = decodeURIComponent(path.slice(10)); } catch (e) {}
    if (!checkPhotoKey(url.searchParams.get('t') || '', id)) { log('Photo refused, the key has expired or is for another photo'); send(req, res, 403, Object.assign({ 'Content-Type': 'text/plain' }, open), 'This link has expired. Open it again from TREE.'); return; }
    // an educator's certificates and forms open only through their records, for them and the director
    if (/^staff-/.test(id)) { log('Educator record file refused through a photo link'); send(req, res, 403, Object.assign({ 'Content-Type': 'text/plain' }, open), 'Open this from the records page in TREE.'); return; }
    let o = store.originals.get(id);
    // a photo saved while the list of records was being read can be missing from it, so the records are asked directly
    if (!o && ID_RE.test(id) && store.ready) {
      const r = await gh('GET', `/repos/${RECORDS_REPO}/contents/originals/${encodeURIComponent(id)}?ref=${encodeURIComponent(store.branch)}&fresh=${Date.now()}`);
      if (r.status === 200 && r.json && r.json.sha) { o = { path: `originals/${id}`, sha: r.json.sha, size: r.json.size }; store.originals.set(id, o); log('Photo found in the records directly', id.slice(0, 60)); }
    }
    if (!o || !ID_RE.test(id)) { log('Photo not found', id.slice(0, 60)); send(req, res, 404, Object.assign({ 'Content-Type': 'text/plain' }, open), 'Not found'); return; }
    // photos kept with moments are shown on every card, so recent ones are held here rather than fetched from GitHub each time
    let buf = fileCache.get(id);
    if (!buf && o.drive) {
      try { buf = await photosDrive.read(o); cacheFile(id, buf); }
      catch (e) { log('Photo could not be read from Google Drive', id.slice(0, 60), e.message); send(req, res, 502, Object.assign({ 'Content-Type': 'text/plain' }, open), 'Could not load the photo from Google Drive.'); return; }
    }
    if (!buf) {
      const b = await readPhoto(o.sha);
      if (b.status !== 200) { log('Photo could not be read from GitHub', id.slice(0, 60), b.status); send(req, res, 502, Object.assign({ 'Content-Type': 'text/plain' }, open), 'Could not load the file from GitHub.'); return; }
      buf = b.buf; cacheFile(id, buf);
    } else { fileCache.delete(id); fileCache.set(id, buf); }
    const ext = id.split('.').pop().toLowerCase();
    const type = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || 'application/octet-stream';
    send(req, res, 200, Object.assign({ 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' }, open), buf);
    return;
  }
  if (req.method !== 'POST') { err(req, res, 405, 'Not allowed'); return; }
  // the mailbox script's key, when it rides in a header or the address, is checked before a large email is read
  if (path.startsWith('/inbound/')) {
    const key = cleanKey(process.env.KAYMBU_INBOX_KEY); const early = cleanKey(req.headers['x-tree-key'] || url.searchParams.get('key') || '');
    // with no key set on Render the inbox is off, so nothing is read at all
    if (!key || (early && !sameText(early, key))) { req.resume(); log('Inbox email refused before reading,', key ? 'the key is not right' : 'the inbox key is not set'); err(req, res, 403, 'Not allowed'); return; }
  }
  // the Kaymbu inbox is called by the school's Apps Script, not a page, so it carries its own key rather than a sign-in
  if (path === '/inbound/kaymbu') {
    let b; try { b = await readBody(req, INBOUND_MAX_BYTES); } catch (e) { err(req, res, 400, 'The email could not be read.'); return; }
    if (!store.ready) await loadAll();
    await kaymbuInbox.handle(req, res, url, b, (status, obj) => json(req, res, status, obj)); return;
  }
  // the nightly backup, asked for by the mailbox script every night. Waiting saves are written first, then every
  // record kind comes back as one gzipped JSON bundle the script keeps in Google Drive. Sign-ins stay out, since they hold passcodes.
  if (path === '/inbound/backup') {
    let b = {}; try { b = await readBody(req, 64 * 1024); } catch (e) { b = {}; }
    const key = cleanKey(process.env.KAYMBU_INBOX_KEY), given = cleanKey(req.headers['x-tree-key'] || url.searchParams.get('key') || (b && b.key) || '');
    if (!key || !given || !sameText(given, key)) { log('Backup refused, the key is missing or wrong'); err(req, res, 403, 'Not allowed'); return; }
    if (!store.ready) await loadAll();
    if (!store.ready) { err(req, res, 503, 'The records could not be loaded, so there is nothing to back up yet.'); return; }
    if (!calendar.ready) { try { await calendar.loadAll(); } catch (e) { log('The calendar could not be loaded for the backup', e.message); } }
    // the educator records load after the rest, so a backup that wakes the server waits for them too
    try { await staff.load(); } catch (e) { log('Educator records could not be loaded for the backup', e.message); }
    const saved = (await Promise.all([flushEverything().catch(() => false), calendar.flushEverything().catch(() => false), staff.flushAll().catch(() => false)])).every(Boolean);
    const bundle = backupBundle(saved);
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'), { level: 9 });
    lastBackup = { at: Date.now(), bytes: gz.length, counts: bundle.manifest.counts };
    // the time is kept in the records too, so the director's Settings shows it after the server has slept
    const cur = store.recs.settings.get('backup');
    store.recs.settings.set('backup', Object.assign({}, cur || {}, { doc: { id: 'backup', lastAt: lastBackup.at, bytes: gz.length, files: bundle.manifest.files, counts: bundle.manifest.counts, updatedByName: 'Nightly backup' } }));
    noteChange('settings', 'backup'); scheduleSave('settings', 'backup');
    log('Backup sent,', bundle.manifest.files, 'files,', Math.round(gz.length / 1024), 'KB');
    send(req, res, 200, { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="TREE backup ${bundle.manifest.date}.json.gz"`, 'Cache-Control': 'no-store' }, gz);
    return;
  }
  if (path === '/inbound/feed-order') {
    let b; try { b = await readBody(req, INBOUND_MAX_BYTES); } catch (e) { err(req, res, 400, 'The email could not be read.'); return; }
    const key = cleanKey(process.env.KAYMBU_INBOX_KEY);
    if (!key || cleanKey(b.key) !== key) { log('Order email refused, the key is missing or wrong'); err(req, res, 403, 'Not allowed'); return; }
    if (!store.ready) await loadAll();
    // an email can carry other emails or PDF invoices forwarded as attachments, and each is read on its own
    const parts = [];
    if (b.html || b.text) parts.push({ name: String(b.subject || 'email'), raw: b.html || b.text, subject: String(b.subject || '') });
    for (const a of Array.isArray(b.parts) ? b.parts.slice(0, 20) : []) if (a && (typeof a.raw === 'string' || typeof a.data === 'string')) parts.push({ name: String(a.name || 'attachment'), raw: a.raw, data: a.data, type: String(a.type || '') });
    log('Order email arrived from the mailbox,', String(b.subject || '').slice(0, 100) + ',', parts.length, 'part' + (parts.length === 1 ? '' : 's'));
    for (const part of parts) orderQueue.push({ part, by: 'mailbox' });
    runOrders();
    json(req, res, 200, { ok: true, queued: parts.length }); return;
  }
  const origin = String(req.headers.origin || '').replace(/\/+$/, '').toLowerCase();
  if (!ALLOWED_ORIGINS.includes(origin)) { req.resume(); err(req, res, 403, 'This website is not allowed to use the TREE server. Origin received ' + (origin || 'none') + '.'); return; }

  let body;
  try { body = await readBody(req, path === '/login' ? LOGIN_MAX_BYTES : MAX_BODY_BYTES); }
  catch (e) { log('Request refused', path, e.message); err(req, res, e.message === 'too_big' ? 413 : 400, e.message === 'too_big' ? 'That upload is too large. Use fewer or smaller pages.' : 'The request could not be read.'); return; }

  // the Family page. A family's sign-in never reaches the staff side, and the staff side never takes one
  if (path.startsWith('/family/') || path === '/public/menu' || path === '/public/handbook' || path === '/public/handbook/img') {
    if (!store.ready) { await loadAll(); if (!store.ready) { err(req, res, 503, 'The school records are still loading. Try again in a moment.'); return; } }
    const ip = who(req);
    if (path === '/public/menu') { json(req, res, 200, familyPage.publicMenu(body.month)); return; }
    // the Family Handbook for prospective families and the website, read only, and only once the director turns it on
    const imgType = p => /\.png$/i.test(p) ? 'image/png' : /\.gif$/i.test(p) ? 'image/gif' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg';
    const hbImage = async isPublic => { try { const buf = await staff.handbook.image(String(body.path || ''), isPublic); send(req, res, 200, { 'Content-Type': imgType(String(body.path || '')), 'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, max-age=86400' }, buf); } catch (e) { err(req, res, 404, 'That picture is not here.'); } };
    if (path.startsWith('/public/handbook')) {
      try { await staff.handbook.ready(); } catch (e) { err(req, res, 503, 'The Family Handbook is still loading. Try again in a moment.'); return; }
      if (path === '/public/handbook/img') { await hbImage(true); return; }
      const hb = staff.handbook.forPublic(); if (!hb) { err(req, res, 403, 'The Family Handbook is not open to the public yet.'); return; }
      json(req, res, 200, hb); return;
    }
    if (path === '/family/code') { const r = await familyPage.sendCode(body.email, ip); if (r.error) { err(req, res, 400, r.error); return; } json(req, res, 200, r); return; }
    if (path === '/family/login') { const r = familyPage.signIn(body.email, body.code, ip); if (r.error) { err(req, res, 403, r.error); return; } json(req, res, 200, r); return; }
    const f = familyPage.readFamily(req); if (!f) { err(req, res, 401, 'Please sign in again.'); return; }
    let r;
    if (path === '/family/data') r = familyPage.familyView(f);
    else if (path === '/family/signup') r = familyPage.signUp(f, String(body.itemId || ''), body.on !== false, { who: body.who, adults: body.adults, children: body.children, answer: body.answer });
    else if (path === '/family/log') r = familyPage.addLog(f, body || {});
    else if (path === '/family/unlog') r = familyPage.removeLog(f, String(body.id || ''));
    else if (path === '/family/book') r = familyPage.book(f, String(body.slotId || ''), String(body.childId || ''), body.on !== false);
    else if (path === '/family/reflect') r = familyPage.reflect(f, String(body.childId || ''), body.answers || {});
    else if (path === '/family/strengths') r = familyPage.strengths(f, body.text);
    else if (path === '/family/enroll') r = familyPage.enroll(f, String(body.childId || ''), body.data || {}, !!body.done);
    else if (path === '/family/questionnaire') r = familyPage.questionnaire(f, String(body.childId || ''), Array.isArray(body.answers) ? body.answers : []);
    else if (path === '/family/photo') { r = await familyPage.photo(f, String(body.childId || ''), body.data); if (!r.error) { json(req, res, 200, r); return; } }
    else if (path === '/family/agree') r = familyPage.agreement(f, String(body.childId || ''), body.agreement, !!body.submit);
    else if (path === '/family/check') r = familyPage.check(f, String(body.childId || ''), String(body.key || ''), body.on !== false);
    else if (path === '/family/aboutme') r = familyPage.aboutMe(f, String(body.childId || ''), body.pages, !!body.done);
    else if (path === '/family/file') { r = familyPage.file(f, String(body.id || '')); if (!r.error) { json(req, res, 200, r); return; } }
    else if (path === '/family/handbook' || path === '/family/handbook/img') {
      try { await staff.handbook.ready(); } catch (e) { err(req, res, 503, 'The Family Handbook is still loading. Try again in a moment.'); return; }
      if (path === '/family/handbook/img') { await hbImage(false); return; }
      const hb = staff.handbook.forFamily(String(body.edition || '')); if (!hb) { err(req, res, 404, 'The Family Handbook is not here yet.'); return; }
      json(req, res, 200, hb); return;
    }
    else { err(req, res, 404, 'Not found'); return; }
    if (r.error) { err(req, res, 400, r.error); return; }
    // the family's children are read again after a change, so the page shows what was just saved
    json(req, res, 200, path === '/family/data' ? r : Object.assign({ ok: true }, familyPage.familyView(familyPage.readFamily(req) || f))); return;
  }
  if (path === '/login') {
    const ip = who(req);
    if (blocked(ip)) { err(req, res, 429, 'Too many wrong passcodes. Wait ten minutes and try again.'); return; }
    const name = cleanName(body.name);
    const NOPE = 'That name and passcode do not match. Check with the director if you have forgotten your passcode.';
    if (name) {
      if (!store.ready) await loadAll();
      if (nameBlocked(name)) { err(req, res, 429, 'Too many wrong passcodes for that name. Wait ' + waitWords(name) + ' and try again, or ask the director.'); return; }
      let a = accountFor(name);
      const given = String(body.passcode || '');
      // two educators can share a first name, so a first name that starts several sign-ins asks for the full name
      if (!a && given.length < 6) {
        const near = accounts.list.filter(x => nameKey(x.name).split(' ')[0] === nameKey(name).split(' ')[0]);
        if (near.length > 1) { err(req, res, 400, 'More than one person is named ' + near[0].name.split(' ')[0] + '. Type ' + near.map(x => x.name).join(' or ') + '.'); return; }
        if (near.length === 1) a = near[0];
      }
      // an educator who has left Fulton gets the same answer as a wrong passcode
      if (a && isFormerAccount(a)) { noteWrong(ip); nameWrong(name); log('Sign-in refused,', a.name, 'left Fulton', a.leaveOn); err(req, res, 403, NOPE); return; }
      if (a) {
        if (!a.code) {
          // the first sign-in sets the educator's own four numbers, as the director wants, and only with the six-number
          // start code she handed them, checked both when it is typed and again when the new passcode is saved
          const startGiven = String(body.newCode == null ? given : body.start || '').trim();
          if (!a.start || !sameText(startGiven, a.start)) { noteWrong(ip); nameWrong(name); err(req, res, 403, 'That name and start code do not match. Type the six numbers the director gave you.'); return; }
          if (body.newCode == null) { json(req, res, 200, { setup: true, name: a.name }); return; }
          const c = String(body.newCode || '');
          if (!/^\d{4}$/.test(c)) { err(req, res, 400, 'Choose four numbers for your passcode.'); return; }
          if (String(body.again || '') !== c) { err(req, res, 400, 'The two passcodes are not the same. Type them again.'); return; }
          if (/^(\d)\1{3}$/.test(c) || ['1234', '4321', '0123', '9876'].includes(c)) { err(req, res, 400, 'That passcode is easy to guess. Choose four other numbers.'); return; }
          a.code = c; delete a.start; a.setAt = Date.now(); a.v = (a.v || 0) + 1; a.lastAt = Date.now(); nameTries.delete(nameKey(a.name));
          await saveAccounts(a.name);
          log('Passcode set by', a.name);
          json(req, res, 200, { token: makeSession(a.name, a.v), name: a.name, director: isDirector(a.name), teachers: teacherNames() }); return;
        }
        if (!sameText(given, a.code)) { noteWrong(ip); nameWrong(name); err(req, res, 403, NOPE); return; }
        a.lastAt = Date.now(); nameTries.delete(nameKey(name)); nameTries.delete(nameKey(a.name)); log('Signed in', a.name);
        json(req, res, 200, { token: makeSession(a.name, a.v || 0), name: a.name, director: isDirector(a.name), teachers: teacherNames() }); return;
      }
      // a name with no TREE sign-in can still use a passcode set on Render
      if (given.length < 6 || !/[^0-9]/.test(given)) { noteWrong(ip); nameWrong(name); err(req, res, 403, NOPE); return; }
    }
    if (!TEACHERS.length) { err(req, res, 503, 'No educator passcodes are set on the server yet.'); return; }
    const t = matchPasscode(body.passcode);
    if (!t) { noteWrong(ip); if (name) nameWrong(name); err(req, res, 403, 'That name and passcode do not match. Check with the director if you have forgotten your passcode.'); return; }
    log('Signed in', t.name);
    json(req, res, 200, { token: makeSession(t.name), name: t.name, director: isDirector(t.name), teachers: teacherNames() });
    return;
  }

  // the staff room display opens with its own key, never a sign-in, and reads only what the display shows
  if (path === '/display/feed') {
    const ip = who(req);
    if (blocked(ip)) { err(req, res, 429, 'Too many tries. Wait ten minutes.'); return; }
    if (!store.ready) await loadAll();
    if (!store.ready) { err(req, res, 503, 'TREE is still starting.'); return; }
    const key = displayKey(), given = String(body.key || '');
    if (!key || !sameText(given, key)) { noteWrong(ip); log('Display refused,', key ? 'the key is not right' : 'the display is turned off'); err(req, res, 403, key ? 'This display link is no longer in use. Open the new link from TREE Settings.' : 'The staff room display is turned off in TREE Settings.'); return; }
    if (!displaySeen.at || Date.now() - displaySeen.at > 6 * 36e5) log('Staff room display checked in');
    displaySeen.at = Date.now();
    json(req, res, 200, await displayFeed()); return;
  }
  // sign-ins are read with the records, so a server just woken never mistakes an educator for a stranger
  if (!accounts.loaded) { await loadAll(); if (!accounts.loaded) { err(req, res, 503, store.error || 'TREE is still starting. Try again in a moment.'); return; } }
  const me = readSession(req);
  if (!me) { log('Sign-in refused,', sessionWhy(req), 'on', path); err(req, res, 401, 'Please sign in again.'); return; }
  if (!store.ready) { await loadAll(); if (!store.ready) { err(req, res, 503, store.error || 'Records are still loading. Try again in a moment.'); return; } }

  // a kitchen sign-in reaches only what the Kitchen page needs, and the server refuses the rest
  const kitchenOnly = isKitchen(me.name);
  if (kitchenOnly) {
    const OPEN = ['/api/data', '/api/changes', '/api/write', '/api/saved', '/api/kitchen-week', '/api/kitchen-serve', '/api/kitchen-month', '/api/me/passcode', '/api/save-now', '/api/original', '/api/read', '/api/view'];
    // the kitchen's own records page goes through /api/staff/, which holds it to that page alone
    const bad = (!OPEN.includes(path) && !path.startsWith('/api/staff/')) || (path === '/api/write' && !kitchenSees(body.kind, body.id)) || (path === '/api/read' && body.purpose !== 'menu');
    if (bad) { log('Kitchen sign-in refused', me.name, path, body.kind || body.purpose || ''); err(req, res, 403, 'A kitchen sign-in reaches the Kitchen page, Today and the calendar.'); return; }
  }
  // a new hire, before the director turns on full access, reaches only the New Educator section. Nothing about children,
  // families or other staff is sent to that sign-in, and every other request is refused here.
  const newHire = staff.isNewHire(me.name);
  if (newHire) {
    const OPEN = ['/api/data', '/api/changes', '/api/me/passcode', '/api/save-now', '/api/push/key', '/api/push/subscribe'];
    if (!OPEN.includes(path) && !path.startsWith('/api/staff/')) { log('New educator sign-in refused', me.name, path); err(req, res, 403, 'This opens once the director turns on full access.'); return; }
    if (path === '/api/data') { json(req, res, 200, { bootId: BOOT_ID, rev, me: me.name, director: false, newHire: true, staff: staff.bootInfo(me.name), data: {} }); return; }
    if (path === '/api/changes') { json(req, res, 200, { bootId: BOOT_ID, rev, changes: {}, newHire: true }); return; }
  }
  if (path.startsWith('/api/staff/')) { await staff.handle(path, body, me.name, req, res, { json, err, send: (q, r, st, h, b) => send(q, r, st, h, b) }); return; }
  // reminders. A phone turns them on once, the director sees who receives them and can send a test
  if (path === '/api/push/key') { const a = accountFor(me.name); json(req, res, 200, { key: reminders.keys() ? reminders.keys().pub : '', phones: ((a && a.push) || []).length }); return; }
  if (path === '/api/push/subscribe') { if (!reminders.subscribe(me.name, body.sub, req.headers['user-agent'])) { err(req, res, 400, 'This phone could not turn reminders on.'); return; } json(req, res, 200, { ok: true }); return; }
  if (path === '/api/notify/status') { if (!isDirector(me.name)) { err(req, res, 403, 'Only the director sees reminders.'); return; } json(req, res, 200, reminders.status()); return; }
  if (path === '/api/notify/test') { if (!isDirector(me.name)) { err(req, res, 403, 'Only the director sends a test.'); return; }
    const r = await reminders.sendTo(String(body.name || me.name), { title: 'TREE', body: 'Reminders from TREE reach this phone.', url: 'tree.html', tag: 'tree-test' }); json(req, res, 200, r); return; }
  // the official wording of each DRDP level, so an educator reads what a level means before confirming it. Signed-in staff only.
  if (path === '/api/drdp-levels') { const pick = v => Object.fromEntries(Object.entries((DRDP_DESC && DRDP_DESC[v]) || {}).map(([k, m]) => [k, { def: m.def || '', levels: m.levels || {} }])); json(req, res, 200, { levels: DRDP_DESC ? { ptk: pick('ptk'), it: pick('it') } : null }); return; }
  if (path === '/api/data') { json(req, res, 200, { staff: staff.bootInfo(me.name), saveError: store.saveError || undefined, saveWarn: saveWarn() || undefined, fileKey: makeFileKey(), bootId: BOOT_ID, rev, me: me.name, director: isDirector(me.name), kitchen: kitchenOnly || undefined, drdpOfficial: !!DRDP_DESC, storage: storageNow(), teachers: teacherNames(), office: isOffice(me.name) || undefined, data: snapshot(isDirector(me.name), kitchenOnly, isOffice(me.name)) }); return; }
  if (path === '/api/changes') {
    if (body.bootId !== BOOT_ID || !(body.since >= 0) || (changeLog.length && body.since < changeLog[0].rev - 1)) { json(req, res, 200, { reload: true }); return; }
    const seeAll = isDirector(me.name); const out = {}; for (const c of changeLog) if (c.rev > body.since && (seeAll || !DIRECTOR_KINDS.includes(c.kind)) && (!OFFICE_KINDS.includes(c.kind) || isOffice(me.name)) && (!kitchenOnly || kitchenSees(c.kind, c.id)) && (seeAll || !(c.kind === 'settings' && (c.id === 'display' || c.id === 'keeping' || c.id === 'saves')))) { out[c.kind] = out[c.kind] || {}; const r = store.recs[c.kind].get(c.id); out[c.kind][c.id] = r && !r.deleted ? r.doc : null; }
    json(req, res, 200, { bootId: BOOT_ID, rev, changes: out, saveError: store.saveError || undefined, saveWarn: saveWarn() || undefined, fileKey: makeFileKey() }); return;
  }
  if (path === '/api/write') {
    if (store.saveError) { err(req, res, 503, store.saveError + ' Your last change was not saved, so keep a copy of it.'); return; }
    if (stopping) { err(req, res, 503, 'The server is restarting. Your change is kept on this device and sends in a minute.'); return; }
    const { op, kind, id } = body;
    if (!KINDS.includes(kind) || typeof id !== 'string' || !ID_RE.test(id)) { err(req, res, 400, 'That record name is not valid.'); return; }
    // a save sent again from a phone, after its answer was lost on the way back, is the same save. It is not made twice.
    const cidKey = typeof body.cid === 'string' && CID_RE.test(body.cid) ? `${nameKey(me.name)}|${kind}/${id}|${body.cid}` : '';
    // every save from a device carries a save id. A save already here is never made twice, and its answer says whether
    // it is written to the records yet, so the device knows when it may let its own copy go.
    const sid = typeof body.sid === 'string' && SID_RE.test(body.sid) ? body.sid : '';
    const fpath = `${kind}/${id}.json`;
    const sidNow = () => { if (!sid) return {}; if (sidsWritten.has(sid)) return { sid, written: true }; if (!sidsWaiting.has(sid)) { if (dirtyPaths.has(fpath) || sidsByPath.has(fpath)) { sidsWaiting.set(sid, fpath); sidsByPath.set(fpath, [...(sidsByPath.get(fpath) || []), sid]); } else sidWritten(sid); } return { sid, written: sidsWritten.has(sid) }; };
    if (sid && (sidsWaiting.has(sid) || sidsWritten.has(sid))) { const r = store.recs[kind].get(id); json(req, res, 200, { ok: true, rev, doc: r && !r.deleted ? r.doc : null, again: true, ...sidNow() }); return; }
    if (cidKey && writeCids.has(cidKey)) { const r = store.recs[kind].get(id); json(req, res, 200, { ok: true, rev, doc: r && !r.deleted ? r.doc : null, again: true, ...sidNow() }); return; }
    // any educator may delete a plan (the page asks twice); removing a followed thread for good stays with the director
    // any educator can keep a child's details current, as they did in Family Conferences. Whether a child is at Fulton,
    // has left, or has moved on is the director's to change, so an educator's save keeps whatever the director last set.
    // a Class team can ask families for help. The request waits for the director, so an educator may only start one, never change or open it
    const askOk = kind === 'participation' && /^rq-/.test(id) && (op === 'create' || op === 'set') && !(store.recs.participation.get(id) && !store.recs.participation.get(id).deleted) && body.data && body.data.kind === 'item' && body.data.status === 'requested' && body.data.open === false;
    if (askOk) body.data = Object.assign({}, body.data, { requestedBy: me.name, test: false });
    if (OFFICE_KINDS.includes(kind) && !isOffice(me.name) && !askOk) { log(kind + ' change refused for', me.name, id); err(req, res, 403, 'Only the director and the office keep family participation.'); return; }
    if (DIRECTOR_KINDS.includes(kind) && !isDirector(me.name)) { log(kind + ' change refused for', me.name, id); err(req, res, 403, kind === 'grant' ? 'Only the director keeps the grant records.' : kind === 'posts' ? 'Only the director makes posts.' : 'Only the director makes the family newsletter.'); return; }
    const map = store.recs[kind]; const cur = map.get(id);
    // conference notes reach a family only when the director or the office shares them, the same check the Family page
    // makes, so an educator's save never shares notes or takes them away
    if (kind === 'conferences' && !isOffice(me.name)) {
      const SH = ['sharedWithFamily', 'sharedAt'];
      if (body.patch && typeof body.patch === 'object') { body.patch = Object.assign({}, body.patch); for (const k of SH) delete body.patch[k]; }
      if (body.data && typeof body.data === 'object') { body.data = Object.assign({}, body.data); for (const k of SH) { if (cur && !cur.deleted && cur.doc[k] !== undefined) body.data[k] = cur.doc[k]; else delete body.data[k]; } }
    }
    if (kind === 'children' && !isDirector(me.name)) {
      // an educator keeps a child's details current. Adding a child to the roster is the director's.
      if (!cur || cur.deleted) { log('New child refused for', me.name, id); err(req, res, 403, 'Only the director adds a child to the roster.'); return; }
      // a child's Class is the director's to change, through Move children, so a save from Conferences or anywhere else keeps it
      const ST = ['status', 'withdrawnAt', 'leftAs', 'leftOn', 'classroom'];
      const keepSt = d => { for (const k of ST) { if (cur && !cur.deleted && cur.doc[k] !== undefined) d[k] = cur.doc[k]; else if (k === 'status') d[k] = 'active'; else delete d[k]; } };
      if (op === 'delete') { err(req, res, 403, 'Only the director can remove a child.'); return; }
      if (body.data && typeof body.data === 'object') { body.data = Object.assign({}, body.data); keepSt(body.data); }
      if (body.patch && typeof body.patch === 'object') { body.patch = Object.assign({}, body.patch); for (const k of ST) delete body.patch[k]; }
      // a transition summary reaches a family only when the director shares it, so an educator's save never shares one or takes one away
      if (body.patch && body.patch.transitionSummary !== undefined) { const ts = body.patch.transitionSummary;
        if (!ts || typeof ts !== 'object' || Array.isArray(ts) || ts.__delete__) delete body.patch.transitionSummary;
        else { const out = {}; for (const [y, v] of Object.entries(ts)) { if (!v || typeof v !== 'object' || Array.isArray(v) || v.__delete__) continue; out[y] = Object.assign({}, v); delete out[y].shared; } body.patch.transitionSummary = out; } }
    }
    if (((kind === 'settings' && id !== 'educators' && id !== 'main' && !(id === 'staples' && kitchenOnly)) || ((kind === 'threads' || kind === 'projects' || kind === 'inquiries') && op === 'delete')) && !isDirector(me.name)) { err(req, res, 403, kind === 'settings' ? 'Only the director can change Program settings.' : kind === 'projects' ? 'Only the director can remove a project. Close it instead, and it stays in the record.' : kind === 'inquiries' ? 'Only the director can remove a team inquiry. Close it instead, and it stays in the record.' : 'Only the director can remove a thread permanently. Ask the director if this needs to be removed.'); return; }
    // the monthly snack and lunch menus are the director's to add and change
    if (kind === 'menus' && !isDirector(me.name) && !kitchenOnly) { err(req, res, 403, 'Only the director and the kitchen add the monthly menus.'); return; }
    if ((kind === 'plans' || kind === 'notices') && op === 'delete') log(kind.slice(0, -1) + ' deleted by', me.name, id);
    // a project is changed by the director. An educator may add a thread to it, which can bring a class in with it.
    // a team inquiry is the director's. Educators add observations and threads to it and write what happened when they tried something.
    if (kind === 'inquiries' && op !== 'delete' && !isDirector(me.name)) {
      // an educator may open a team inquiry from a thread. It carries the thread, its class and project and nothing written yet, and the director leads it from there
      const fromThreadOk = d => { if (!d || typeof d !== 'object') return false; const th = d.fromThread && store.recs.threads.get(d.fromThread); if (!th || th.deleted) return false;
        const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
        const ALLOW = ['id', 'name', 'room', 'status', 'createdAt', 'createdBy', 'startedBy', 'fromThread', 'threads', 'projects', 'obs', 'display', 'updatedAt', 'updatedBy', 'updatedByName', 'savedAt'];
        return Object.keys(d).every(k => ALLOW.includes(k) || empty(d[k])) && Array.isArray(d.threads) && d.threads.includes(d.fromThread) && d.display === false && d.status === 'open' && String(d.startedBy || '').toLowerCase() === String(me.name).toLowerCase(); };
      if ((op === 'create' || op === 'set') && (!cur || cur.deleted) && fromThreadOk(body.data)) { log('Team inquiry opened from a thread by', me.name, id); }
      else if (op === 'create' || !cur || cur.deleted) { log('Inquiry start refused for', me.name, id); err(req, res, 403, 'Only the director starts a team inquiry.'); return; }
      else {
      const OPEN = ['obs', 'threads', 'projects', 'tries', 'updatedAt', 'updatedBy', 'updatedByName', 'savedAt'];
      const next = op === 'set' ? (body.data || {}) : op === 'update' ? Object.assign({}, cur.doc, body.patch || {}) : null;
      const changed = next ? [...new Set([...Object.keys(cur.doc), ...Object.keys(next)])].filter(k => JSON.stringify(cur.doc[k]) !== JSON.stringify(next[k])) : ['all'];
      const keeps = k => (cur.doc[k] || []).every(v => (next[k] || []).includes(v));
      const triesOk = () => { const a = cur.doc.tries || [], b = next.tries || []; return a.length === b.length && a.every((t, i) => b[i] && b[i].id === t.id && b[i].text === t.text && !!b[i].curriculum === !!t.curriculum); };
      const bad = changed.filter(k => !OPEN.includes(k) || ((k === 'obs' || k === 'threads' || k === 'projects') && !keeps(k)) || (k === 'tries' && !triesOk()));
      if (bad.length) { log('Inquiry change refused for', me.name, id, bad.join(',')); err(req, res, 403, 'Only the director changes a team inquiry. You can add observations and threads to it, and write what happened when the team tried something.'); return; }
      }
    }
    // a story is shared beyond the team only once the director has reviewed it. An educator's save never marks it reviewed,
    // and an educator's change to the words of a reviewed story sends it back to draft for the team to look at again
    if (kind === 'stories' && op !== 'delete' && !isDirector(me.name)) {
      const was = cur && !cur.deleted ? cur.doc : {};
      const WORDS = ['title', 'cover', 'coverPhoto', 'pages', 'care', 'words', 'think', 'practice', 'kind', 'ourwords', 'draw', 'community', 'families', 'about'];
      const fix = d => { if (!d || typeof d !== 'object') return d; d = Object.assign({}, d);
        const merged = op === 'update' ? Object.assign({}, was, d) : d;
        const changed = WORDS.some(k => JSON.stringify(merged[k]) !== JSON.stringify(was[k]));
        if (was.reviewed && !changed) { d.reviewed = true; d.reviewedBy = was.reviewedBy; d.reviewedAt = was.reviewedAt; }
        else { if (d.reviewed || was.reviewed) log('Story sent back to draft or kept as draft for', me.name, id); d.reviewed = false; if (was.reviewed) d.changedAfterReview = true; if (op === 'set') { delete d.reviewedBy; delete d.reviewedAt; } }
        return d; };
      if (body.data) body.data = fix(body.data);
      if (body.patch) body.patch = fix(body.patch);
    }
    if (kind === 'projects' && op !== 'create' && cur && !cur.deleted && !isDirector(me.name)) {
      const OPEN = ['threads', 'classrooms', 'updatedAt', 'updatedByName', 'savedAt'];
      const next = op === 'set' ? (body.data || {}) : op === 'update' ? Object.assign({}, cur.doc, body.patch || {}) : null;
      const changed = next ? [...new Set([...Object.keys(cur.doc), ...Object.keys(next)])].filter(k => JSON.stringify(cur.doc[k]) !== JSON.stringify(next[k])) : ['all'];
      const shrank = k => (k === 'threads' || k === 'classrooms') && (next[k] || []).length < (cur.doc[k] || []).length;
      if (changed.some(k => !OPEN.includes(k) || shrank(k))) { log('Project change refused for', me.name, id, changed.join(',')); err(req, res, 403, 'Only the director changes a project. You can add a thread to it and start a plan from its threads.'); return; }
    }
    // director feedback on a plan is written only by the director; an educator's save keeps whatever the director last wrote
    if (kind === 'plans' && !isDirector(me.name)) {
      const keep = d => { for (const k of DIRECTOR_FIELDS) { if (cur && !cur.deleted && cur.doc[k] !== undefined) d[k] = cur.doc[k]; else if (k === 'feedback') d[k] = ''; else delete d[k]; } };
      if (body.data && typeof body.data === 'object') { body.data = Object.assign({}, body.data); keep(body.data); }
      if (body.patch && typeof body.patch === 'object') { body.patch = Object.assign({}, body.patch); for (const k of DIRECTOR_FIELDS) delete body.patch[k]; }
      if (op !== 'delete') {
        const next = op === 'update' ? Object.assign({}, cur && !cur.deleted ? cur.doc : {}, body.patch || {}, { fields: Object.assign({}, cur && !cur.deleted ? cur.doc.fields : {}, (body.patch || {}).fields || {}) }) : (body.data || {});
        const st = planStatusFor(cur, next); const asked = next.status || 'draft';
        if (st !== asked) { log('Plan status kept as', st, 'for', me.name, id, 'asked', asked); if (op === 'update') { body.patch = body.patch || {}; body.patch.status = st; } else if (body.data) body.data.status = st; }
      }
    }
    const planBefore = kind === 'plans' && cur && !cur.deleted && cur.doc ? { status: cur.doc.status, feedback: cur.doc.feedback || '' } : null;
    if (op === 'create') {   // start a record only if nobody else has, and hand back whichever exists
      if (cur && !cur.deleted) { json(req, res, 200, { ok: true, rev, doc: cur.doc, existed: true, ...sidNow() }); return; }
      if (!body.data || typeof body.data !== 'object') { err(req, res, 400, 'Missing data'); return; }
      map.set(id, { doc: Object.assign({}, body.data, ('id' in body.data) ? { id } : {}, { updatedByName: me.name }), sha: cur && cur.sha, path: `${kind}/${id}.json` });
    }
    else if (op === 'set') { if (!body.data || typeof body.data !== 'object') { err(req, res, 400, 'Missing data'); return; }
      if (kind === 'children' && cur && !cur.deleted) { body.data = Object.assign({}, body.data); for (const k of ['drdp', 'portfolio', 'transitionSummary']) { if (cur.doc[k] !== undefined) body.data[k] = cur.doc[k]; else delete body.data[k]; } } map.set(id, { doc: Object.assign({}, body.data, ('id' in body.data) ? { id } : {}, { updatedByName: me.name, savedAt: Date.now() }), sha: cur && cur.sha, path: `${kind}/${id}.json` }); }
    else if (op === 'update') { if (!cur || cur.deleted) { err(req, res, 404, 'That record no longer exists. It may have been deleted by someone else.'); return; } deepMerge(cur.doc, body.patch || {}); if ('id' in cur.doc) cur.doc.id = id; cur.doc.updatedByName = me.name; }
    else if (op === 'delete') { if (cur) cur.deleted = true; else { json(req, res, 200, { ok: true, rev, ...sidNow() }); return; } }
    else { err(req, res, 400, 'Unknown change'); return; }
    { const r0 = map.get(id); if (r0) r0.local = true; }
    noteChange(kind, id); scheduleSave(kind, id); if (cidKey) cidSeen(cidKey);
    if (sid) { sidsWaiting.set(sid, fpath); sidsByPath.set(fpath, [...(sidsByPath.get(fpath) || []), sid]); }
    if (kind === 'plans' && op !== 'delete' && isDirector(me.name)) { const r1 = map.get(id); if (r1 && !r1.deleted) reminders.planReviewed(id, planBefore, r1.doc); }
    if (kind === 'settings' && (id === 'program' || id === 'main')) syncGroups(id);
    if (kind === 'settings' && (id === 'educators' || id === 'main') && onceDone('educatorList')) syncEducators();
    // an observation's words, new or changed, are checked against the threads a little later
    // a proofread fixes spelling and punctuation only, so the thread suggestion is not asked again for it
    if (kind === 'notices' && op !== 'delete' && !kitchenOnly) { const p0 = body.patch || body.data || {}; if (op !== 'update' || (('noticed' in p0 || 'wonder' in p0 || 'group' in p0 || 'threadNo' in p0) && !('proofread' in p0))) queueThreadSuggest(id); }
    const r = map.get(id);
    json(req, res, 200, { ok: true, rev, doc: r && !r.deleted ? r.doc : null, ...(sid ? { sid, written: false } : {}) }); return;
  }
  // a device asks which of the saves it still holds are written to the records. A save this server does not know, such
  // as one sent before an update, is looked for in the records' own history by its save id. One found nowhere is
  // answered unknown, and the device sends it again.
  if (path === '/api/saved') {
    const items = (Array.isArray(body.items) ? body.items : []).filter(x => x && typeof x.sid === 'string' && SID_RE.test(x.sid) && KINDS.includes(x.kind) && typeof x.id === 'string' && ID_RE.test(x.id)).slice(0, 60);
    const out = { written: [], waiting: [], unknown: [] }; const look = new Map();
    for (const x of items) { if (sidsWritten.has(x.sid)) out.written.push(x.sid); else if (sidsWaiting.has(x.sid)) out.waiting.push(x.sid); else { const fp = `${x.kind}/${x.id}.json`; if (!look.has(fp)) look.set(fp, []); look.get(fp).push(x.sid); } }
    for (const [fp, sids] of [...look].slice(0, 20)) { const msgs = await commitMessages(fp); for (const s0 of sids) { if (msgs === null) out.waiting.push(s0); else if (msgs.some(m => m.includes(s0))) { sidWritten(s0); out.written.push(s0); } else out.unknown.push(s0); } }
    for (const [, sids] of [...look].slice(20)) out.waiting.push(...sids);
    json(req, res, 200, Object.assign({ bootId: BOOT_ID }, out)); return;
  }
  // the director makes, renews or turns off the staff room display's link
  if (path === '/api/display') {
    if (!isDirector(me.name)) { err(req, res, 403, 'Only the director sets up the staff room display.'); return; }
    if (body.action === 'new') { setDisplay({ key: b64u(crypto.randomBytes(18)), madeAt: Date.now(), madeBy: me.name }, me.name); log('Display link made by', me.name); }
    else if (body.action === 'off') { setDisplay({ key: '', madeAt: 0, madeBy: '' }, me.name); log('Display turned off by', me.name); }
    json(req, res, 200, displayView()); return;
  }
  // the director's TREE sends the week's readable copies, file by file, on to the mailbox script for Google Drive
  if (path === '/api/readable') {
    if (!isDirector(me.name)) { err(req, res, 403, 'Only the director\'s TREE makes the readable copies.'); return; }
    const r = await readable.handle(body || {}, me.name);
    if (r.error) { err(req, res, r.status || 400, r.error); return; }
    json(req, res, 200, r); return;
  }
  if (path === '/api/save-now') { const ok = (await Promise.all([flushEverything().catch(() => false), calendar.flushEverything().catch(() => false), staff.flushAll().catch(() => false)])).every(Boolean); if (ok) json(req, res, 200, { ok: true }); else err(req, res, 502, 'Some changes have not reached GitHub yet. Saving keeps trying.'); return; }
  if (path === '/api/original') {
    const name = String(body.name || 'file').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-60);
    const ext = (name.match(/\.(pdf|jpe?g|png|webp)$/) || [])[1];
    if (!ext || typeof body.data !== 'string') { err(req, res, 400, 'Only PDF, JPEG, PNG and WebP files can be kept as originals.'); return; }
    const buf = Buffer.from(body.data, 'base64');
    if (buf.length > 15 * 1024 * 1024) { err(req, res, 413, 'That file is larger than 15 MB. Save it smaller or as fewer pages.'); return; }
    // a photo sent again from a phone with the same client id is the photo already kept, never a second copy
    const cid = typeof body.cid === 'string' && CID_RE.test(body.cid) ? body.cid : '';
    const id = (cid ? crypto.createHash('sha256').update(nameKey(me.name) + '|' + cid).digest('hex').slice(0, 12) : crypto.randomBytes(6).toString('hex')) + '-' + name.replace(/^[^a-z0-9]+/, '');
    if (cid && originalsComing.has(id)) await originalsComing.get(id).catch(() => {});
    if (cid && store.originals.has(id)) { json(req, res, 200, { id, sizeBytes: store.originals.get(id).size || buf.length, again: true }); return; }
    let done; if (cid) originalsComing.set(id, new Promise(ok => { done = ok; })); try {
    if (await photosDrive.keep(id, buf, { pdf: 'application/pdf', png: 'image/png', webp: 'image/webp' }[ext] || 'image/jpeg')) { json(req, res, 200, { id, sizeBytes: buf.length }); return; }
    const r = await gh('PUT', `/repos/${RECORDS_REPO}/contents/originals/${id}`, { message: `Add ${/^moment/.test(name) ? 'moment photo' : 'original form'} by ${me.name}`, content: buf.toString('base64'), branch: store.branch });
    if (isRateLimit(r)) { err(req, res, 429, 'GitHub is busy. Wait a minute and try again.'); return; }
    if (r.status === 401 || r.status === 403) { store.saveError = r.status === 401 ? KEY_PROBLEM : KEY_NO_WRITE; err(req, res, 503, store.saveError); return; }
    if (r.status !== 201 && r.status !== 200) { err(req, res, 502, 'GitHub would not store the file. ' + ((r.json && r.json.message) || r.status)); return; }
    store.originals.set(id, { path: `originals/${id}`, sha: r.json.content.sha, size: buf.length }); cacheFile(id, buf);
    json(req, res, 200, { id, sizeBytes: buf.length }); return;
    } finally { if (cid) { originalsComing.delete(id); done(); } }
  }
  if (path === '/api/read') {
    const refuse = (status, message, why) => { log('Claude request refused for', me.name, why || message); err(req, res, status, message); };
    if (body.purpose === 'threads' && !isDirector(me.name)) { refuse(403, 'Only the director can run Find threads.', 'thread search by an educator'); return; }
    if ((body.purpose === 'newsletter' || body.purpose === 'newsletter-reading') && !isDirector(me.name)) { refuse(403, 'Only the director makes the family newsletter.', 'newsletter by an educator'); return; }
    if (body.purpose === 'share' && !isDirector(me.name)) { refuse(403, 'Only the director makes posts.', 'share by an educator'); return; }
    if (body.purpose === 'lens' && !isDirector(me.name)) { refuse(403, 'Only the director can read through the lens.', 'lens reading by an educator'); return; }
    if (!anthropicKey()) { refuse(503, 'TREE\'s writing help is not set up yet. The director adds its key on Render.', 'no key'); return; }
    const content = body.content;
    if (!Array.isArray(content) || !content.length || content.length > 12) { refuse(400, 'Nothing to read', 'empty or too many parts'); return; }
    const okBlock = b => b && ((b.type === 'text' && typeof b.text === 'string') || (b.type === 'image' && b.source && b.source.type === 'base64' && /^image\/(jpeg|png|webp|gif)$/.test(b.source.media_type)));
    if (!content.every(okBlock)) { refuse(400, 'That upload could not be read. Try a smaller photo or fewer pages.', 'unreadable part'); return; }
    const now = Date.now(); readTimes = readTimes.filter(t => t.at > now - 36e5);
    if (readTimes.length >= READS_PER_HOUR || (body.careful && readTimes.filter(t => t.careful).length >= CAREFUL_PER_HOUR)) { refuse(429, 'TREE\'s writing help has been asked many times in the last hour. Wait a little and try again.', 'hourly limit'); return; }
    if (readsRunning >= READS_AT_ONCE) { refuse(429, 'TREE\'s writing help is working on several requests right now. Try again in a moment.', readsRunning + ' already running'); return; }
    readTimes.push({ at: now, careful: !!body.careful }); readsRunning++;
    // a DRDP request carries the official definitions and level descriptors for its view
    let drdpUsed;
    if (body.purpose === 'drdp' && body.drdp && (body.drdp.view === 'ptk' || body.drdp.view === 'it')) {
      const block = drdpBlock(body.drdp.view, body.drdp.codes); drdpUsed = !!block;
      for (const b of content) if (b.type === 'text') b.text = b.text.includes('[[DRDP_DESCRIPTORS]]') ? b.text.replace('[[DRDP_DESCRIPTORS]]', block) : b.text;
    }
    const kb = Math.round(JSON.stringify(content).length / 1024);
    try {
      // suggested reading for families is searched for on the web, only on sites families can trust
      const extra = body.purpose === 'newsletter-reading' || body.purpose === 'pd-reading' ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, allowed_domains: READING_SITES }] } : null;
      const r = await askClaude(content, !!body.careful || !!extra, extra);
      if (r.status !== 200) { log('Claude answered', r.status, 'for', me.name, kb + ' KB sent', r.text.slice(0, 300)); err(req, res, r.status === 429 || r.status === 529 ? 429 : 502, r.status === 429 || r.status === 529 ? 'TREE\'s writing help is busy. Wait a minute and try again.' : 'TREE\'s writing help could not answer just now. Try again in a minute.'); return; }
      const msg = JSON.parse(r.text);
      const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      log('Claude request for', me.name, msg.model, kb + ' KB sent', msg.usage ? `${msg.usage.input_tokens} in, ${msg.usage.output_tokens} out` : '', msg.stop_reason === 'max_tokens' ? 'ANSWER CUT OFF' : '');
      json(req, res, 200, { text, model: msg.model, truncated: msg.stop_reason === 'max_tokens', drdp: drdpUsed });
    } catch (e) { log('Could not reach Claude for', me.name, kb + ' KB sent', e.message); err(req, res, 502, 'TREE\'s writing help could not be reached just now. Check the connection and try again.'); }
    finally { readsRunning--; }
    return;
  }
  // an educator changes their own four numbers, after typing the ones they have now
  if (path === '/api/me/passcode') {
    const a = accountFor(me.name); if (!a || !a.code) { err(req, res, 400, 'This sign-in has no passcode of its own to change.'); return; }
    const old = String(body.current || ''), c = String(body.newCode || '');
    if (!(old.length === a.code.length && crypto.timingSafeEqual(Buffer.from(old), Buffer.from(a.code)))) { nameWrong(a.name); err(req, res, 403, 'The passcode you have now is not right.'); return; }
    if (!/^\d{4}$/.test(c)) { err(req, res, 400, 'Choose four numbers for your new passcode.'); return; }
    if (String(body.again || '') !== c) { err(req, res, 400, 'The two new passcodes are not the same. Type them again.'); return; }
    if (/^(\d)\1{3}$/.test(c) || ['1234', '4321', '0123', '9876'].includes(c)) { err(req, res, 400, 'That passcode is easy to guess. Choose four other numbers.'); return; }
    const was = { code: a.code, v: a.v, setAt: a.setAt };
    a.code = c; a.setAt = Date.now(); a.v = (a.v || 0) + 1;
    if (!(await saveAccounts(a.name))) { Object.assign(a, was); err(req, res, 502, 'The new passcode could not be saved. Try again.'); return; }
    log('Passcode changed by', a.name, 'and other devices signed out'); json(req, res, 200, { ok: true, token: makeSession(a.name, a.v), name: a.name }); return;
  }
  if (path.startsWith('/api/accounts')) {
    if (!isDirector(me.name)) { err(req, res, 403, 'Only the director can see and change sign-ins.'); return; }
    const list = () => json(req, res, 200, { accounts: accounts.list.map(accountView).sort((a, b) => a.name.localeCompare(b.name)), render: TEACHERS.map(t => t.name) });
    if (path === '/api/accounts') { list(); return; }
    if (path === '/api/accounts/save') {
      const name = cleanName(body.name), was = body.was ? accountFor(body.was) : null;
      if (!okName(name)) { err(req, res, 400, 'Type the educator\'s first name, letters only.'); return; }
      const other = accountFor(name); if (other && other !== was) { err(req, res, 409, name + ' already has a sign-in.'); return; }
      const a = was || { name, addedBy: me.name, addedAt: Date.now(), code: '', start: newStart(), v: 0 };
      if (was && a.name !== name) a.v = (a.v || 0) + 1;
      a.name = name; a.room = String(body.room || '').slice(0, 20); a.director = !!body.director; if ('kitchen' in body) a.kitchen = !!body.kitchen && !a.director;
      if (!was) accounts.list.push(a);
      if (!(await saveAccounts(me.name))) { err(req, res, 502, 'The sign-in could not be saved to the records. Try again.'); return; }
      log('Sign-in saved for', a.name, 'by', me.name); list(); return;
    }
    if (path === '/api/accounts/reset') { const a = accountFor(body.name); if (!a) { err(req, res, 404, 'That sign-in is not here.'); return; } a.code = ''; a.start = newStart(); a.v = (a.v || 0) + 1; nameTries.delete(nameKey(a.name)); await saveAccounts(me.name); log('Passcode cleared for', a.name, 'by', me.name); list(); return; }
    // Remove is only for a sign-in added by mistake. Someone with records leaves Fulton instead, so nothing of theirs is lost.
    if (path === '/api/accounts/remove') { const a = accountFor(body.name); if (!a) { err(req, res, 404, 'That sign-in is not here.'); return; } if (nameKey(a.name) === nameKey(me.name)) { err(req, res, 400, 'You cannot remove your own sign-in.'); return; }
      if (hasRecords(a.name)) { err(req, res, 400, a.name + ' has records at Fulton, so choose Leaving Fulton. Their records are kept.'); return; } accounts.list = accounts.list.filter(x => x !== a); await saveAccounts(me.name); log('Sign-in removed for', a.name, 'by', me.name); list(); return; }
    // the director chooses an educator's last day. Sign-in ends at the end of that day.
    if (path === '/api/accounts/leave') {
      const a = accountFor(body.name); if (!a) { err(req, res, 404, 'That sign-in is not here.'); return; }
      if (nameKey(a.name) === nameKey(me.name) || isDirector(a.name)) { err(req, res, 400, 'A director\'s sign-in stays.'); return; }
      if (isFormerAccount(a)) { err(req, res, 400, a.name + ' has already left Fulton.'); return; }
      const day = String(body.leaveOn || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { err(req, res, 400, 'Choose their last day.'); return; }
      const was = a.leaveOn; a.leaveOn = day;
      if (!(await saveAccounts(me.name))) { if (was) a.leaveOn = was; else delete a.leaveOn; err(req, res, 502, 'The last day could not be saved. Try again.'); return; }
      staff.markLeft(a.name, day).catch(e => log('The last day could not be kept on the educator record', a.name, e.message));
      log('Leaving Fulton,', a.name, 'last day', day, 'set by', me.name); settleFormer(); list(); return;
    }
    // bringing an educator back keeps all their history. A former educator gets a new start code, as for a cleared code.
    if (path === '/api/accounts/return') {
      const a = accountFor(body.name); if (!a || !a.leaveOn) { err(req, res, 404, 'That educator has not left Fulton.'); return; }
      const former = isFormerAccount(a);
      if (former) { a.code = ''; a.start = newStart(); a.v = (a.v || 0) + 1; nameTries.delete(nameKey(a.name)); restoreFormer(a); }
      delete a.leaveOn; delete a.settled;
      if (!(await saveAccounts(me.name))) { err(req, res, 502, 'The sign-in could not be saved. Try again.'); return; }
      staff.markLeft(a.name, '').catch(e => log('The educator record could not be updated', a.name, e.message));
      log(former ? 'Brought back to Fulton,' : 'Staying at Fulton,', a.name, 'by', me.name); list(); return;
    }
    err(req, res, 404, 'Not found'); return;
  }
  // Keeping records, the director's alone. The server checks the period has passed before anything is removed.
  if (path.startsWith('/api/keeping')) {
    if (!isDirector(me.name)) { err(req, res, 403, 'Only the director keeps records.'); return; }
    const d0 = keepDoc();
    const view = () => { const d = keepDoc(); json(req, res, 200, { sources: KEEP_SOURCES, childYears: keepYears('child') || '', staffYears: keepYears('staff') || '', due: keepingDue(), removed: (d.removed || []).slice(-30).reverse() }); };
    if (path === '/api/keeping') { view(); return; }
    if (path === '/api/keeping/set') {
      const fields = {};
      for (const f of ['childYears', 'staffYears']) if (f in body) { const v = body[f]; if (v === '' || v == null) { fields[f] = ''; continue; } const n = Math.round(+v); if (!(n >= 1 && n <= 50)) { err(req, res, 400, 'Choose a number of years from 1 to 50.'); return; } fields[f] = n; }
      setKeep(fields, me.name); log('Keeping records periods set by', me.name, JSON.stringify(fields)); view(); return;
    }
    const it = keepingDue().find(x => x.kind === body.kind && (x.kind === 'staff' ? nameKey(x.id) === nameKey(body.id) : x.id === body.id));
    if (path === '/api/keeping/keep') {
      if (!it) { err(req, res, 404, 'That record is not waiting for a choice.'); return; }
      const n = Math.round(+body.years); if (!(n >= 1 && n <= 10)) { err(req, res, 400, 'Choose how many more years to keep it.'); return; }
      const dec = Object.assign({}, d0.decisions || {}); dec[keepKey(it)] = { until: addYears(laDay(), n), years: n, at: Date.now(), by: me.name };
      setKeep({ decisions: dec }, me.name); log('Records kept longer,', it.kind, it.name, n, 'more years, by', me.name); view(); return;
    }
    if (path === '/api/keeping/remove') {
      if (!it) { err(req, res, 404, 'That record is not waiting for a choice.'); return; }
      if (body.sure !== true) { err(req, res, 400, 'Confirm the removal first.'); return; }
      let n = 0;
      if (it.kind === 'child') {
        n += dropRecord('children', it.id);
        for (const [cid, r] of store.recs.conferences) if (r && !r.deleted && r.doc && r.doc.childId === it.id) n += dropRecord('conferences', cid);
      } else {
        const a = accountFor(it.id);
        try { n += await staff.removeFormer(it.id); } catch (e) { log('Former educator records could not be removed', it.id, e.message); err(req, res, 502, 'The records could not be removed just now. Nothing was lost. Try again in a minute.'); return; }
        if (a) { accounts.list = accounts.list.filter(x => x !== a); await saveAccounts(me.name); n++; }
      }
      const dec = Object.assign({}, d0.decisions || {}); delete dec[keepKey(it)];
      setKeep({ decisions: dec, removed: [...(d0.removed || []), { kind: it.kind, name: it.name, left: it.left, at: Date.now(), by: me.name, files: n }].slice(-200) }, me.name);
      log('Records removed after the keeping period,', it.kind === 'child' ? 'a former child' : 'a former educator', it.name, 'left', it.left, n, 'records, by', me.name, 'after confirming twice'); view(); return;
    }
    err(req, res, 404, 'Not found'); return;
  }
  if (path === '/api/signup-feed') {
    const set = store.recs.settings.get('main'); let link = String(body.link || (set && set.doc && set.doc.signupFeed) || '').trim().replace(/^webcal:\/\//i, 'https://');
    if (!link) { err(req, res, 400, 'Add the SignUpGenius calendar link in Settings first.'); return; }
    try {
      await readSignupFeed(link, !!body.fresh);
      json(req, res, 200, { events: feedCache.data, checkedAt: new Date(feedCache.at).toISOString() });
    } catch (e) {
      // a network failure reads as a plain sentence, and the technical reason stays in the log
      const plain = /^(SignUpGenius|That link)/.test(e.message || '');
      if (!plain) log('SignUpGenius could not be reached,', e.message || e.code || 'no answer');
      err(req, res, 502, plain ? e.message : 'SignUpGenius could not be reached just now. Try again in a few minutes.'); }
    return;
  }
  // what the kitchen ordered for lunch and snack this week and next, for every educator. Only the food, its farm and the
  // day it comes. No prices, totals, order numbers or vendor details, and no FEED bin lines, since the bin has its own page.
  if (path === '/api/kitchen-week') { json(req, res, 200, { weeks: kitchenWeeks() }); return; }
  // the director or the kitchen says how a food is served, a side dish, cooked in, or both. Only that one field changes.
  if (path === '/api/kitchen-serve') {
    if (!isDirector(me.name) && !kitchenOnly) { err(req, res, 403, 'Only the director and the kitchen answer this.'); return; }
    // the food is named the way Produce coming names it, its farm and its week, so no order number is ever sent to a page
    const mon = String(body.monday || ''), name = String(body.name || ''), farm = String(body.farm || '').trim(), field = body.field === 'side' ? 'side' : body.field === 'cooked' ? 'cooked' : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mon) || !name || !farm || !field) { err(req, res, 400, 'That answer could not be read.'); return; }
    let n = 0;
    // a line that joins two kinds of one food answers for both
    const line = kitchenItemsFor(mon).find(it => it.farm === farm && (it.name === name || it.names.includes(name))); const names = line ? line.names : [name];
    for (const [id, r] of store.recs.grant) { const o = r && !r.deleted && r.doc; if (!o || o.kind !== 'order') continue; const day = o.fulfilled || ''; if (day < mon || day > addDay(mon, 6)) continue;
      (o.items || []).forEach(x => { if (String(x.producer || '').trim() !== farm || !names.includes(kitchenName(x.item).name)) return; x.serve = Object.assign({ side: false, cooked: false }, x.serve || {}, { [field]: !!body.value }); n++; });
      if (n) { o.updatedByName = me.name; r.local = true; noteChange('grant', id); scheduleSave('grant', id); } }
    if (!n) { err(req, res, 404, 'That food was not found on this week\'s orders.'); return; }
    log('Served as', field, !!body.value, name, 'by', me.name); json(req, res, 200, { ok: true }); return;
  }
  // the month's food lines for the farm sheets, the food, its farm, the day and how it is served, never prices or order numbers
  if (path === '/api/kitchen-month') {
    const from = String(body.from || ''), to = String(body.to || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) { err(req, res, 400, 'That range is not valid.'); return; }
    const lines = [];
    for (const [, r] of store.recs.grant) { const o = r && !r.deleted && r.doc; if (!o) continue;
      if (o.kind === 'order') { const day = o.fulfilled || o.placed || ''; if (day < from || day > to) continue; (o.items || []).forEach(x => { if (x.use === 'education') return; lines.push({ day, item: String(x.item || ''), producer: String(x.producer || ''), ...(x.serve ? { serve: { side: !!x.serve.side, cooked: !!x.serve.cooked } } : {}) }); }); }
      if (o.id === 'purchases' && o.list) for (const p of Object.values(o.list)) { if (!p || !p.date || p.date < from || p.date > to || p.use === 'education') continue; lines.push({ day: p.date, item: String(p.item || ''), producer: String(p.producer || ''), kind: String(p.kind || ''), manual: true }); } }
    json(req, res, 200, { lines }); return;
  }
  if (path === '/api/grant/order') {
    if (!isDirector(me.name)) { err(req, res, 403, 'Only the director keeps the grant records.'); return; }
    const r = await readOrderPart({ name: String(body.name || 'file'), raw: body.raw, data: body.data, type: String(body.type || '') }, me.name);
    if (r.error) { err(req, res, 400, r.error); return; }
    if (r.skip) { err(req, res, 400, 'This does not look like an order or invoice for food. ' + r.skip); return; }
    log('Order kept by', me.name, r.doc.id); json(req, res, 200, { ok: true, doc: r.doc }); return;
  }
  // the weekly FEED bin, read from FEED's page and kept by week
  if (await feedBin.handle(path, { name: me.name, director: isDirector(me.name) }, body, (status, obj) => json(req, res, status, obj))) return;
  if (await calendar.handle(path, { name: me.name, director: isDirector(me.name), shared: me.name === 'Staff' }, body, (status, obj) => json(req, res, status, obj))) return;
  err(req, res, 404, 'Not found');
}

/* ---------- SignUpGenius, read only, for family conference times ---------- */
const feedCache = { url: '', at: 0, data: null };
async function readSignupFeed(link, fresh) {
  link = String(link || '').trim().replace(/^webcal:\/\//i, 'https://');
      if (!(feedCache.url === link && Date.now() - feedCache.at < 5 * 60000 && !fresh)) {
        const r = await getText(link);
        if (r.status !== 200) throw new Error('SignUpGenius answered ' + r.status + '.');
        if (!/BEGIN:VCALENDAR/.test(r.text)) throw new Error(/does not exist/i.test(r.text) ? 'SignUpGenius says this calendar does not exist. In SignUpGenius, open Tools, then Calendar Subscriptions, check the feed is saved with the conference sign up in it, and copy its link again.' : 'That link did not return a calendar.');
        feedCache.url = link; feedCache.at = Date.now(); feedCache.data = parseIcs(r.text);
      }
  return feedCache.data;
}
function getText(url, hops = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(^|\.)signupgenius\.com$/i.test(u.hostname)) { reject(new Error('Only SignUpGenius calendar links can be read.')); return; }
    const req = https.get(u, { headers: { 'User-Agent': 'fulton-tree', 'Accept': 'text/calendar,*/*' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) { res.resume(); resolve(getText(new URL(res.headers.location, u).toString(), hops + 1)); return; }
      const chunks = []; let n = 0;
      res.on('data', c => { n += c.length; if (n > 5e6) { req.destroy(new Error('The calendar is too large.')); return; } chunks.push(c); });
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(20000, () => req.destroy(new Error('SignUpGenius did not answer in time.')));
    req.on('error', reject);
  });
}
function laParts(d) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` };
}
function icsTime(prop) {
  if (!prop) return null;
  const v = prop.value; const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return null;
  if (!m[4]) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
  if (m[7]) return laParts(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])));
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}
function parseIcs(text) {
  const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const unesc = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  const out = []; let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const name = line.slice(0, i).split(';')[0].toUpperCase(); ev[name] = { value: line.slice(i + 1) };
  }
  return out.map(e => { const s = icsTime(e.DTSTART), en = icsTime(e.DTEND);
    return { uid: e.UID ? e.UID.value : '', date: s ? s.date : '', time: s ? s.time : '', end: en ? en.time : '',
      summary: unesc(e.SUMMARY ? e.SUMMARY.value : ''), description: unesc(e.DESCRIPTION ? e.DESCRIPTION.value : ''), location: unesc(e.LOCATION ? e.LOCATION.value : '') }; })
    .filter(e => e.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

const server = http.createServer((req, res) => { const t0 = Date.now(); res.on('finish', () => { const ms = Date.now() - t0; if (ms > 3000) log('Slow request', req.method, String(req.url).split('?')[0], ms + ' ms'); }); handle(req, res).catch(e => { log('Request error', e && e.stack); err(req, res, 500, 'Something went wrong on the server. Try again.'); }); });
server.on('clientError', (e, socket) => { try { socket.destroy(); } catch (x) {} });
process.on('uncaughtException', e => log('Unexpected error, server kept running', e && e.stack));
process.on('unhandledRejection', e => log('Unexpected rejection, server kept running', e));
// Render stops the server when it redeploys or restarts. Save anything waiting first.
async function stop(sig) {
  if (stopping) return; stopping = true; ghHurry = true; log('Stopping on', sig, 'saving waiting changes');
  try { server.close(); } catch (e) {}
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    for (const t of timers.values()) clearTimeout(t);
    const ok = await Promise.race([Promise.all([flushEverything().catch(() => false), calendar.flushEverything().catch(() => false), staff.flushAll().catch(() => false)]).then(([a, b, c]) => a && b && c), new Promise(r => setTimeout(() => r(false), Math.max(1000, until - Date.now())))]);
    if (ok) { log('All changes saved'); break; }
    await new Promise(r => setTimeout(r, 3000));
  }
  if (dirtyPaths.size) log('Stopped with', dirtyPaths.size, 'changes not saved to GitHub');
  process.exit(0);
}
process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));

server.listen(PORT, () => {
  log('TREE server on port', PORT, 'records in', RECORDS_REPO);
  log(TEACHERS.length + ' educator passcodes set');
  log('Sign-ins set on Render for ' + (TEACHERS.map(t => t.name).join(', ') || 'no one'));
  log('GitHub key ' + (githubToken() ? 'saved' : 'MISSING') + ', Anthropic key ' + (anthropicKey() ? 'saved' : 'MISSING'));
  loadAll(); calendar.loadAll();
});
module.exports = { deepMerge, checkSession, makeSession, isFormerEducator };
