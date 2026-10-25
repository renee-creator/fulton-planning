// The calendar inside TREE. Reads the school's Google calendars and SignUpGenius feeds (reading only, nothing is
// ever sent back), and keeps space sign-ups and the calendar's settings under calendar/ in the TREE records.
// This came from the Fulton Calendar server, so the sign-up rules and the feeds work exactly as they did there.
'use strict';
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const ICAL = require('./vendor/ical.cjs');
const Core = require('./calendar-core.js');
const { fail, text } = Core;

module.exports = function createCalendar(opts) {
const { gh, log } = opts;
const RECORDS_REPO = opts.repo;
const FLUSH_DELAY_MS = Number(process.env.FLUSH_DELAY_MS) || 4000;
const FEED_TTL_MS = Number(process.env.FEED_TTL_MS) || 10 * 60 * 1000;
const FEED_MAX_BYTES = 8 * 1024 * 1024;
const FEED_TEST_BASE = (process.env.FEED_TEST_BASE || '').replace(/\/+$/, '');
const SCHOOL_TZ = (() => { const z = (process.env.SCHOOL_TIMEZONE || 'America/Los_Angeles').trim(); try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return z; } catch (e) { return 'America/Los_Angeles'; } })();
const wallFmt = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function wallParts(date, fmt) { const o = {}; for (const p of (fmt || wallFmt).formatToParts(date)) o[p.type] = p.value; return o; }
function schoolWall(date) { const o = wallParts(date); return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`; }
function schoolToday() { return schoolWall(new Date()).slice(0, 10); }
const pad = (n, w) => String(n).padStart(w || 2, '0');
function githubToken() { return opts.token(); }
function isRateLimit(r) { return r.status === 429 || (r.status === 403 && (/rate limit|abuse/i.test((r.json && r.json.message) || '') || !!(r.headers && (r.headers['retry-after'] || r.headers['x-ratelimit-remaining'] === '0')))); }
const BOOT_ID = crypto.randomBytes(6).toString('hex');
const PROGRAM_PATH = 'calendar/settings/program.json', FEEDS_PATH = 'calendar/settings/feeds.json';
const store = { ready: false, error: '', branch: 'main', shas: new Map(), saveError: '' };   // the calendar's own part of the records
let core = null;                 // spaces, settings and sign-ups, made once records are loaded
let feedAddresses = {};          // calendar id to its Google address. Never sent to a browser.
const lastBy = new Map();
const KEY_NO_WRITE = 'GitHub will not let the access key save changes. On GitHub, edit the Calendar records token and set Contents to Read and write.';
const KEY_PROBLEM = 'GitHub rejected the access key, so changes cannot be saved. The GitHub token on Render has probably expired. Renew it on GitHub and paste the new one into GITHUB_TOKEN on Render.';
const SAVE_WAIT = 'Changes are taking longer than usual to reach GitHub. They are kept on the server and saving keeps trying, so keep working.';
function isRateLimit(r) { return r.status === 429 || (r.status === 403 && (/rate limit|abuse/i.test((r.json && r.json.message) || '') || !!(r.headers && (r.headers['retry-after'] || r.headers['x-ratelimit-remaining'] === '0')))); }
let rev = 0;
const newId = () => crypto.randomBytes(5).toString('hex');

let loading = null;
function loadAll() { if (!loading) loading = doLoad().finally(() => { loading = null; if (!store.ready && githubToken()) setTimeout(loadAll, 60000).unref(); }); return loading; }
async function doLoad() {
  if (!githubToken()) { store.error = 'No GITHUB_TOKEN is saved on Render. Add it under Environment.'; log(store.error); return; }
  try {
    const repo = await gh('GET', `/repos/${RECORDS_REPO}`);
    if (repo.status === 404) throw new Error(`The records repository ${RECORDS_REPO} was not found, or the GitHub token cannot see it. Check RECORDS_REPO and give the token access to that repository.`);
    if (repo.status === 401) throw new Error('GitHub rejected the token. Make a new fine-grained token with Contents read and write on the records repository.');
    if (repo.status !== 200) throw new Error('GitHub answered ' + repo.status + ' when opening the records repository.');
    store.branch = repo.json.default_branch || 'main';
    const tree = await gh('GET', `/repos/${RECORDS_REPO}/git/trees/${encodeURIComponent(store.branch)}?recursive=1`);
    let files = [];
    if (tree.status === 200) files = (tree.json.tree || []).filter(t => t.type === 'blob');
    else if (tree.status !== 409 && tree.status !== 404) throw new Error('GitHub answered ' + tree.status + ' when listing records.');   // 409 and 404 mean the repository is still empty
    const docs = new Map(); const jobs = files.filter(f => f.path === PROGRAM_PATH || f.path === FEEDS_PATH || /^calendar\/bookings\/\d{4}-\d{2}\.json$/.test(f.path));
    let i = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const j = jobs[i++];
        const b = await gh('GET', `/repos/${RECORDS_REPO}/git/blobs/${j.sha}`);
        if (b.status !== 200) throw new Error('GitHub answered ' + b.status + ' when reading ' + j.path);
        store.shas.set(j.path, j.sha);
        try { docs.set(j.path, JSON.parse(Buffer.from(b.json.content, 'base64').toString('utf8'))); } catch (e) { log('Skipped unreadable record', j.path); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    const bookings = [];
    for (const [p, d] of docs) if (p.startsWith('calendar/bookings/') && d && d.items) for (const b of Object.values(d.items)) bookings.push(b);
    const f = docs.get(FEEDS_PATH); feedAddresses = {};
    if (f && f.addresses && typeof f.addresses === 'object') for (const [k, v] of Object.entries(f.addresses)) if (typeof v === 'string' && v) feedAddresses[k] = v;
    core = Core.createCore({ program: docs.get(PROGRAM_PATH), bookings, newId, today: schoolToday,
      onBooking: (month, by) => { rev++; lastBy.set(`calendar/bookings/${month}.json`, by); scheduleSave(`calendar/bookings/${month}.json`); },
      onProgram: (by, goneCalendars) => { rev++; lastBy.set(PROGRAM_PATH, by); scheduleSave(PROGRAM_PATH); let changed = false; for (const id of goneCalendars || []) if (feedAddresses[id]) { delete feedAddresses[id]; feeds.delete(id); changed = true; } if (changed) { lastBy.set(FEEDS_PATH, by); scheduleSave(FEEDS_PATH); } } });
    store.ready = true; store.error = '';
    log(`Loaded ${core.count()} sign-ups, ${core.program.spaces.length} spaces, ${Object.keys(feedAddresses).length} calendar addresses`);
  } catch (e) { store.error = e.message; log('Could not load records.', e.message); }
}
function docFor(path) {
  if (path === PROGRAM_PATH) return core.program;
  if (path === FEEDS_PATH) return { note: 'Addresses of the Google calendars shown in Fulton Calendar. Keep this file private.', addresses: feedAddresses };
  const m = path.match(/^calendar\/bookings\/(\d{4}-\d{2})\.json$/);
  const items = {}; for (const b of core.view(m[1] + '-01', m[1] + '-31').sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start - b.start)) items[b.id] = b;
  return { month: m[1], items };
}

// Saving to GitHub. Each file is saved by one chain at a time, and quick changes are gathered.
const chains = new Map(); const timers = new Map(); const dirtyPaths = new Set(); const failingSince = new Map();
let stopping = false;
function saveWarn() { const now = Date.now(); for (const t of failingSince.values()) if (now - t > 90000) return SAVE_WAIT; return ''; }
function scheduleSave(path) { dirtyPaths.add(path); clearTimeout(timers.get(path)); timers.set(path, setTimeout(() => flushPath(path), FLUSH_DELAY_MS)); }
function flushPath(path) {
  clearTimeout(timers.get(path)); timers.delete(path);
  if (!dirtyPaths.has(path)) return chains.get(path) || Promise.resolve();
  dirtyPaths.delete(path);
  const run = (chains.get(path) || Promise.resolve()).then(() => writeFile(path)).then(() => { failingSince.delete(path); }, e => {
    log('Save failed', path, e.message); if (!failingSince.has(path)) failingSince.set(path, Date.now());
    dirtyPaths.add(path);
    if (!stopping) { clearTimeout(timers.get(path)); timers.set(path, setTimeout(() => flushPath(path), 30000)); } });
  chains.set(path, run);
  return run;
}
async function flushEverything() { await Promise.all([...dirtyPaths].map(flushPath)); await Promise.all([...chains.values()]); return dirtyPaths.size === 0; }
async function currentSha(path) { const r = await gh('GET', `/repos/${RECORDS_REPO}/contents/${path}?ref=${encodeURIComponent(store.branch)}`); return r.status === 200 ? r.json.sha : null; }
async function writeFile(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = Buffer.from(JSON.stringify(docFor(path), null, 2) + '\n', 'utf8').toString('base64');
    const by = lastBy.get(path) ? ` by ${lastBy.get(path)}` : '';
    const label = path === PROGRAM_PATH ? 'Update settings' : path === FEEDS_PATH ? 'Update calendar addresses' : 'Update sign-ups for ' + path.slice(18, 25);
    const known = store.shas.get(path);
    const r = await gh('PUT', `/repos/${RECORDS_REPO}/contents/${path}`, { message: label + by, content, branch: store.branch, ...(known ? { sha: known } : {}) });
    if (r.status === 200 || r.status === 201) { store.shas.set(path, r.json.content.sha); store.saveError = ''; return; }
    if (r.status === 409 || r.status === 422) { const s = await currentSha(path); if (s) store.shas.set(path, s); else store.shas.delete(path); continue; }   // changed on GitHub directly, keep the app's copy
    if (isRateLimit(r)) { log('GitHub asked to slow down'); throw new Error('GitHub rate limit, trying again shortly'); }
    if (r.status === 401) { store.saveError = KEY_PROBLEM; log('GitHub rejected the token'); }
    if (r.status === 403) { store.saveError = KEY_NO_WRITE; log('GitHub key cannot write'); }
    throw new Error('GitHub answered ' + r.status + ' ' + ((r.json && r.json.message) || ''));
  }
  throw new Error('GitHub kept refusing the save');
}

/* ---------- Google calendars, read only ---------- */
const NOT_GOOGLE = 'Only Google Calendar and SignUpGenius addresses can be connected. For a Google calendar, open its Settings and sharing page and copy the Secret address in iCal format. For SignUpGenius, open the calendar feed, choose Calendar Help, and copy the webcal link.';
const isGenius = host => /(^|\.)signupgenius\.com$/i.test(host);
function publicAddress(calendarId) { return 'https://calendar.google.com/calendar/ical/' + encodeURIComponent(calendarId) + '/public/basic.ics'; }
// Accepts the secret or public iCal address, a calendar ID, or an embed or share link, and returns the address to read
function normalizeFeed(raw) {
  let s = String(raw || '').trim().replace(/^<|>$/g, '');
  if (!s) return '';
  if (s.length > 600) throw fail(400, NOT_GOOGLE);
  s = s.replace(/^webcals?:\/\//i, 'https://');
  if (/^[^\s\/@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return publicAddress(s);
  let u; try { u = new URL(s); } catch (e) { throw fail(400, NOT_GOOGLE); }
  if (FEED_TEST_BASE && s.startsWith(FEED_TEST_BASE + '/')) return s;
  if (u.protocol === 'https:' && isGenius(u.hostname) && !u.username && !u.port) return u.href;   // a SignUpGenius calendar feed, read the same way
  if (u.protocol !== 'https:' || !/^(calendar\.google\.com|www\.google\.com)$/i.test(u.hostname)) throw fail(400, NOT_GOOGLE);
  const m = u.pathname.match(/^\/calendar\/ical\/([^/]+)\/(public|private-[a-z0-9]+)\/(basic|full)\.ics$/i);
  if (m) return 'https://calendar.google.com' + u.pathname;
  let id = u.searchParams.get('src') || u.searchParams.get('cid') || '';
  if (id && !id.includes('@')) { try { const d = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); if (/^[\x20-\x7e]+@[\x20-\x7e]+$/.test(d)) id = d; } catch (e) {} }
  if (/^[^\s\/@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(id)) return publicAddress(id);
  throw fail(400, NOT_GOOGLE);
}
function okFeedHost(u) { return (u.protocol === 'https:' && (/(^|\.)(google\.com|googleusercontent\.com)$/i.test(u.hostname) || isGenius(u.hostname))) || (!!FEED_TEST_BASE && u.href.startsWith(FEED_TEST_BASE + '/')); }
function fetchText(address, hops) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(address); } catch (e) { reject(new Error('bad address')); return; }
    if (!okFeedHost(u)) { reject(new Error('The calendar address pointed somewhere other than Google or SignUpGenius.')); return; }
    const req = (u.protocol === 'http:' ? http : https).get(u, { headers: { 'User-Agent': 'fulton-calendar', 'Accept': 'text/calendar, text/plain' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if ((hops || 0) >= 3) { reject(new Error('The calendar address redirected too many times.')); return; }
        let next; try { next = new URL(res.headers.location, u).href; } catch (e) { reject(new Error('bad redirect')); return; }
        fetchText(next, (hops || 0) + 1).then(resolve, reject); return;
      }
      const chunks = []; let size = 0;
      res.on('data', c => { size += c.length; if (size > FEED_MAX_BYTES) { req.destroy(new Error('That calendar is too large to load.')); } else chunks.push(c); });
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(20000, () => req.destroy(new Error('The calendar did not answer in time.')));
    req.on('error', reject);
  });
}
function stripHtml(s) { return String(s || '').replace(/<br\s*\/?>(\r?\n)?/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]{0,400}>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
function longText(v, max) { return stripHtml(v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max); }
function parseFeed(body) {
  if (!/BEGIN:VCALENDAR/i.test(body.slice(0, 2000))) throw new Error('not a calendar');
  const comp = new ICAL.Component(ICAL.parse(body));
  for (const tz of comp.getAllSubcomponents('vtimezone')) { try { ICAL.TimezoneService.register(tz); } catch (e) {} }
  const all = comp.getAllSubcomponents('vevent').map(v => new ICAL.Event(v));
  const masters = new Map(); const events = [];
  for (const e of all) if (!e.isRecurrenceException()) { masters.set(e.uid, e); events.push(e); }
  for (const e of all) if (e.isRecurrenceException()) { const m = masters.get(e.uid); if (m) { try { m.relateException(e); } catch (x) {} } else events.push(e); }
  return { name: text(comp.getFirstPropertyValue('x-wr-calname'), 60), events, raw: (body.match(/^BEGIN:VEVENT/gmi) || []).length };
}
// For the log, how a small feed's entries spread over dates. Counts only, never titles or names.
function feedShape(parsed) {
  if (parsed.events.length > 80) return '';
  const days = new Map(); let repeating = 0;
  for (const e of parsed.events) { try { if (e.isRecurring()) repeating++; const d = wall(e.startDate).day; days.set(d, (days.get(d) || 0) + 1); } catch (x) {} }
  return ' By start date ' + [...days].sort().map(([d, n]) => d + ' x' + n).join(', ') + (repeating ? '. Repeating entries ' + repeating : '');
}
// A time from the feed, as the date and clock time people at the school would see
function wall(t) {
  if (t.isDate) return { allDay: true, day: `${pad(t.year, 4)}-${pad(t.month)}-${pad(t.day)}` };
  const asIs = `${pad(t.year, 4)}-${pad(t.month)}-${pad(t.day)}T${pad(t.hour)}:${pad(t.minute)}`;
  const tzid = t.zone && t.zone.tzid;
  if (!tzid || tzid === 'floating') return { allDay: false, at: asIs, day: asIs.slice(0, 10) };
  const at = schoolWall(t.toJSDate());
  return { allDay: false, at, day: at.slice(0, 10) };
}
function occurrence(calId, item, start, end, from, to) {
  if (!start) return null;
  const s = wall(start); const e = end ? wall(end) : s;
  let out;
  if (s.allDay) {
    let last = e.allDay && e.day > s.day ? Core.addDays(e.day, -1) : s.day;   // the feed's end date is the day after the last day
    out = { allDay: true, start: s.day, end: last };
  } else {
    let endAt = e.allDay ? s.at : e.at; if (endAt < s.at) endAt = s.at;
    out = { allDay: false, start: s.at, end: endAt };
  }
  if (out.start.slice(0, 10) > to || out.end.slice(0, 10) < from) return null;
  const c = item.component;
  out.id = calId + '.' + crypto.createHash('sha1').update(String(item.uid) + '|' + out.start).digest('hex').slice(0, 12);
  out.cal = calId; out.title = text(item.summary, 140) || 'Busy';
  const loc = text(item.location, 200); if (loc) out.location = loc;
  const desc = longText(item.description, 800); if (desc) out.desc = desc;
  if (String(c.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return null;
  return out;
}
function expand(calId, parsed, from, to) {
  const out = [];
  for (const e of parsed.events) {
    try {
      if (!e.isRecurring()) { const o = occurrence(calId, e, e.startDate, e.endDate, from, to); if (o) out.push(o); continue; }
      const it = e.iterator(); let next, guard = 0;
      while (guard++ < 4000 && (next = it.next())) {
        const d = e.getOccurrenceDetails(next);
        const startDay = wall(d.startDate).day;
        if (startDay > to) break;
        const o = occurrence(calId, d.item, d.startDate, d.endDate, from, to); if (o) out.push(o);
      }
    } catch (x) { /* one unreadable event should not hide the rest */ }
  }
  return out;
}
// A calendar still carrying a starter name takes the name Google gives it. A name the director typed is left alone.
const STARTER_NAMES = new Set(['School calendar', 'Second calendar', 'Calendar', 'New calendar']);
function adoptName(calId, name) {
  if (!name || !core) return;
  const p = core.program; const cal = p.calendars.find(c => c.id === calId);
  if (!cal || !STARTER_NAMES.has(cal.name) || p.calendars.some(c => c.name === name)) return;
  try { core.setProgram({ director: true, name: 'the server' }, Object.assign({}, p, { calendars: p.calendars.map(c => c.id === calId ? Object.assign({}, c, { name }) : c) })); log('Calendar', calId, 'named from Google'); } catch (e) {}
}
// Feeds stamp every entry with the moment they were sent, so that line is left out when checking whether anything changed
const feedHash = body => crypto.createHash('sha1').update(body.replace(/^DTSTAMP[^\r\n]*\r?\n/gm, '')).digest('hex');
const feeds = new Map();   // calendar id to { address, fetchedAt, parsed, error, hash, running }
let feedRev = 0;
function unreachable(address) { let genius = false; try { genius = isGenius(new URL(address).hostname); } catch (e) {} return (genius ? 'SignUpGenius' : 'Google Calendar') + ' could not be reached just now. TREE tries again in a few minutes.'; }
function feedError(status, address) {
  let genius = false; try { genius = isGenius(new URL(address).hostname); } catch (e) {}
  if (genius) return status === 404 || status === 403 || status === 401 ? 'SignUpGenius would not share this calendar feed. Open the feed in SignUpGenius, choose Calendar Help, copy the webcal link again and paste it here.' : 'SignUpGenius answered ' + status + ' for this calendar feed. It will be tried again shortly.';
  if (status === 404 || status === 403 || status === 401) return 'Google would not share this calendar. Paste the Secret address in iCal format from the calendar\'s Settings and sharing page, or make the calendar public.';
  return 'Google answered ' + status + ' for this calendar. It will be tried again shortly.';
}
function loadFeed(calId) {
  const address = feedAddresses[calId]; if (!address) { feeds.delete(calId); return Promise.resolve(null); }
  let f = feeds.get(calId);
  if (!f || f.address !== address) { f = { address, fetchedAt: 0, parsed: null, error: '', hash: '', running: null }; feeds.set(calId, f); }
  if (f.running) return f.running;
  f.running = (async () => {
    let error = '', parsed = null, hash = '';
    try {
      const r = await fetchText(address);
      if (r.status !== 200) error = feedError(r.status, address);
      else { hash = feedHash(r.text); if (hash === f.hash && f.parsed) parsed = f.parsed; else parsed = parseFeed(r.text); }
    } catch (e) { if (e.message !== 'not a calendar') log('Calendar', calId, 'could not be reached,', e.message || e.code || 'no answer');
      // the technical reason stays in the server log, and staff read a plain sentence
      error = e.message === 'not a calendar' ? 'That address did not return a calendar. Copy the address again and paste it here.' : unreachable(address); }
    if (feeds.get(calId) !== f) return f;   // disconnected or replaced while loading
    const before = f.hash + '|' + f.error;
    f.fetchedAt = Date.now(); f.error = error;
    if (parsed) { if (hash !== f.hash) log('Calendar', calId, 'read,', parsed.events.length, 'entries kept of', parsed.raw, 'in the feed.' + feedShape(parsed)); f.parsed = parsed; f.hash = hash; adoptName(calId, parsed.name); }
    if (f.hash + '|' + f.error !== before) { feedRev++; viewCache.clear(); }
    if (error) log('Calendar', calId, 'problem.', error);
    return f;
  })().finally(() => { f.running = null; });
  return f.running;
}
const viewCache = new Map();
async function eventsFor(from, to, me) {
  const out = []; const status = {};
  await Promise.all(core.program.calendars.map(async c => {
    if (!feedAddresses[c.id]) { status[c.id] = { connected: false }; return; }
    let f = feeds.get(c.id);
    if (!f || f.address !== feedAddresses[c.id] || (!f.parsed && !f.error)) f = await Promise.race([loadFeed(c.id), new Promise(r => setTimeout(() => r(feeds.get(c.id)), 12000))]);
    else if (Date.now() - f.fetchedAt > (f.error ? 60000 : FEED_TTL_MS)) loadFeed(c.id);   // refresh in the background, show what is known now
    status[c.id] = { connected: true, ok: !!(f && f.parsed && !f.error), error: (f && f.error) || undefined, loading: !f || (!f.parsed && !f.error) || undefined, readAt: (f && f.fetchedAt) || undefined };
    if (f && f.parsed) {
      const key = c.id + '|' + f.hash + '|' + from + '|' + to; let list = viewCache.get(key);
      if (!list) { list = expand(c.id, f.parsed, from, to); if (viewCache.size > 60) viewCache.clear(); viewCache.set(key, list); }
      out.push(...list);
    }
  }));
  // family conferences from TREE's own records, on the same week as everything else
  // when the conference sign-up sheet is also a school calendar, the two show as one calendar, and a conference on both is shown once
  if (opts.extraEvents) { try { const x = opts.extraEvents(from, to, me); const into = confCalId();
    Object.assign(status, x.status);
    const confs = x.events.filter(e => e.cal === 'tconf'), rest = x.events.filter(e => e.cal !== 'tconf'); out.push(...rest);
    if (into) { delete status.tconf; const left = slotsNamed(out, into, confs);
      for (const e of left) out.push(Object.assign({}, e, { cal: into })); }
    else out.push(...confs); } catch (e) { log('Could not add conferences to the calendar', e.message); } }
  return { events: out, status };
}
// Each timed slot on the conference calendar reads as the conference booked in TREE for it, Conference, the child's
// name and Class, and a slot nobody has booked reads Open conference time. The slot's own title and notes are left out.
// A conference is matched to the slot that starts at its time, or else the slot its time falls inside, and to one slot
// only. Returns the conferences no slot holds, so they still show. The cached feed entries are copied, never changed.
function slotsNamed(out, calId, confs) {
  const left = confs.slice();
  const at = e => String(e.start).slice(0, 16);
  const take = test => { const i = left.findIndex(test); return i < 0 ? null : left.splice(i, 1)[0]; };
  const idx = out.map((e, i) => i).filter(i => out[i].cal === calId && !out[i].allDay).sort((a, b) => at(out[a]).localeCompare(at(out[b])));
  const pick = new Map();
  for (const i of idx) { const c = take(c => !c.allDay && at(c) === at(out[i])); if (c) pick.set(i, c); }
  for (const i of idx) { if (pick.has(i)) continue; const s = out[i]; const c = take(c => !c.allDay && at(c) > at(s) && at(c) < String(s.end).slice(0, 16)); if (c) pick.set(i, c); }
  for (const i of idx) { const c = pick.get(i);
    out[i] = Object.assign({}, out[i], { conf: true, title: c ? c.title : 'Open conference time', desc: '', location: '' }, c ? {} : { open: true }); }
  return left;
}


const EXTRA_CALS = [{ id: 'tconf', name: 'Family conferences', color: 'marigold' }, { id: 'tbday', name: 'Birthdays', color: 'rose' }, { id: 'tmenu', name: 'Snack and lunch', color: 'moss' }, { id: 'tgrow', name: 'Check-ins and PD', color: 'sky' }, { id: 'tfam', name: 'Families invited', color: 'teal' }, { id: 'tgarden', name: 'Garden', color: 'moss' }];
// the school calendar that is the family conference sign-up sheet, if there is one
function confCalId() { const c = core.program.calendars.find(c => /signupgenius\.com/i.test(feedAddresses[c.id] || '') || (/conference/i.test(c.name || '') && feedAddresses[c.id])); return c ? c.id : ''; }
function settingsFor(me) {
  const p0 = core.program; const p = opts.extraEvents ? Object.assign({}, p0, { calendars: p0.calendars.concat(EXTRA_CALS.filter(c => c.id !== 'tconf' || !confCalId())) }) : p0;
  if (!me.director) return p;
  return Object.assign({}, p, { calendars: p.calendars.map(c => Object.assign({}, c, { hasAddress: !!feedAddresses[c.id], publicAddress: /\/public\/(basic|full)\.ics$/.test(feedAddresses[c.id] || '') })) });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// the calendar's requests. Returns false when the path is not the calendar's, so the TREE server carries on.
async function handle(path, me, body, reply) {
  const CAL_PATHS = ['/api/view', '/api/book', '/api/booking/update', '/api/booking/remove', '/api/settings', '/api/calendar/connect', '/api/calendar/refresh'];
  if (!CAL_PATHS.includes(path)) return false;
  if (!store.ready) { await loadAll(); if (!store.ready) { reply(503, { error: store.error || 'The calendar is still loading. Try again in a moment.' }); return true; } }
  const writing = path !== '/api/view';
  if (writing && store.saveError) { reply(503, { error: store.saveError + ' Your change was not saved.' }); return true; }
  try {
    if (path === '/api/view') {
      const { from, to } = body;
      if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '') || !Core.validDate(from) || !Core.validDate(to) || to < from || Core.dayNum(to) - Core.dayNum(from) > 100) { reply(400, { error: 'That date range is not valid.' }); return true; }
      const ev = await eventsFor(from, to, me);
      const who = me.shared ? text(body.who, 40) : '';
      const stamp = [BOOT_ID, rev, feedRev, opts.extraRev ? opts.extraRev() : 0, from, to, schoolToday(), crypto.createHash('sha1').update(who).digest('hex').slice(0, 8)].join('.');
      const base = { stamp, saveError: store.saveError || undefined, saveWarn: saveWarn() || undefined, calendarStatus: ev.status };
      if (body.stamp === stamp) { reply(200, Object.assign(base, { unchanged: true })); return true; }
      reply(200, Object.assign(base, { me: me.name, director: me.director, today: schoolToday(), settings: settingsFor(me), bookings: core.view(from, to), events: ev.events, shared: me.shared || undefined, mine: me.shared ? (who ? core.mine(me.name, 8, who) : []) : core.mine(me.name, 8) }));
      return true;
    }
    if (path === '/api/book') { reply(200, core.book(me, body)); return true; }
    if (path === '/api/booking/update') { reply(200, core.update(me, String(body.id || ''), body.patch)); return true; }
    if (path === '/api/booking/remove') { reply(200, core.remove(me, String(body.id || ''), body.scope)); return true; }
    if (path === '/api/settings') { if (body.program && Array.isArray(body.program.calendars)) body.program.calendars = body.program.calendars.filter(c => !EXTRA_CALS.some(x => x.id === (c && c.id))); core.setProgram(me, body.program); reply(200, { settings: settingsFor(me) }); return true; }
    if (path === '/api/calendar/connect') {
      if (!me.director) { reply(403, { error: 'Only the director can connect calendars.' }); return true; }
      const cal = core.program.calendars.find(c => c.id === body.id);
      if (!cal) { reply(404, { error: 'Save the settings first, then connect this calendar.' }); return true; }
      const address = normalizeFeed(body.address);
      if (!address) { delete feedAddresses[cal.id]; feeds.delete(cal.id); }
      else {
        const r = await fetchText(address).catch(e => ({ status: 0, message: e.message }));
        if (r.status !== 200) { if (!r.status) log('Calendar could not be reached while connecting,', r.message || 'no answer'); reply(422, { error: r.status ? feedError(r.status, address) : unreachable(address).replace('TREE tries again in a few minutes.', 'Try again in a minute.') }); return true; }
        let parsed; try { parsed = parseFeed(r.text); } catch (e) { reply(422, { error: 'That address did not return a calendar. Copy the address again and paste it here.' }); return true; }
        feedAddresses[cal.id] = address;
        feeds.set(cal.id, { address, fetchedAt: Date.now(), parsed, error: '', hash: feedHash(r.text), running: null });
        body.found = { name: parsed.name, events: parsed.events.length };
        adoptName(cal.id, parsed.name);
      }
      feedRev++; viewCache.clear(); lastBy.set(FEEDS_PATH, me.name); scheduleSave(FEEDS_PATH);
      reply(200, { settings: settingsFor(me), found: body.found || null });
      return true;
    }
    if (path === '/api/calendar/refresh') {
      await Promise.all(core.program.calendars.map(c => { const f = feeds.get(c.id); return feedAddresses[c.id] && (!f || Date.now() - f.fetchedAt > 30000) ? loadFeed(c.id) : null; }));
      reply(200, { ok: true }); return true;
    }
  } catch (e) { if (e && e.expose && e.status) { reply(e.status, { error: e.message }); return true; } throw e; }
  return false;
}
// what the TREE server needs to see. Today's entries for the Today screen come from here too.
async function today(me, from, to) { if (!store.ready) await loadAll(); if (!store.ready) return null; const ev = await eventsFor(from, to, me); return { bookings: core.view(from, to), events: ev.events, settings: settingsFor({ director: false }) }; }
function statusLine() { if (!store.ready) return [false, store.error || 'The calendar is still loading.']; const connected = core.program.calendars.filter(c => feedAddresses[c.id]).length; return [true, `The calendar holds ${core.count()} sign-ups and ${core.program.spaces.length} spaces, with ${connected} school calendar${connected === 1 ? '' : 's'} connected.`]; }
// every calendar file as the records keep it, for the nightly backup
function dump() { const out = {}; if (!store.ready) return out; for (const p of new Set([PROGRAM_PATH, FEEDS_PATH, ...store.shas.keys(), ...dirtyPaths])) { if (p === PROGRAM_PATH || p === FEEDS_PATH || /^calendar\/bookings\/\d{4}-\d{2}\.json$/.test(p)) out[p] = docFor(p); } return out; }
return { loadAll, handle, today, events: (f, t) => eventsFor(f, t, null), flushEverything, statusLine, dump, get ready() { return store.ready; }, stop() { stopping = true; for (const t of timers.values()) clearTimeout(t); }, get saveError() { return store.saveError; } };
};
