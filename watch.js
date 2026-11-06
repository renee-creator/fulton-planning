'use strict';
/* Program watch. TREE keeps an eye on itself all day and tells the director what needs correcting, with a plan.

   It notices five things, each counted, never stored as a person's words or a child's record:
   - Glitches. An error on the server, an error in a page on someone's phone or computer, or a part of the server
     status that has turned red.
   - User errors. A request TREE refused with a message, such as a form sent without what it needs, and the messages a
     page shows when something could not be done. The same one many times, or for several people, means the screen
     could make it clearer or prevent it.
   - Efficiency. A page or a save that took longer than three seconds, again and again.
   - Challenges. A background job, such as reading the Kaymbu inbox or the menus, that could not run, and a day with
     far more trouble than the week before it.
   - Sign-ins that end too often.

   Once a day, at 7 in the morning in California, what was found in the last day becomes findings, each with a plan of
   correction, sent to the director's phone and, when WATCH_EMAIL is set, by email. Something urgent, a save that is
   failing or the server erroring again and again, is sent straight away, at most once every six hours for the same
   thing. The director sees every finding in Settings, Program watch, and marks one handled when it is done. A handled
   finding comes back only if the trouble happens again afterwards.

   The counts are kept in the records as settings/watch, so a server that sleeps or restarts keeps what it had seen. */

const TZ = 'America/Los_Angeles';
const HOUR = 3600e3;
const KINDS = {
  error: 'Glitch', client: 'Glitch', status: 'Challenge', job: 'Challenge', user: 'User error', trouble: 'User error',
  slow: 'Efficiency', signin: 'Improvement', trend: 'Challenge',
};
const RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
const MAX_KEYS = 400, HISTORY_DAYS = 28;

function dayOf(t) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); }
function hourOf(t) { return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date(t))); }

// an address or a message with its ids, numbers and keys taken out, so the same trouble is counted as one
function norm(s, max) {
  return String(s == null ? '' : s)
    .replace(/\b[0-9a-f]{8,}\b/gi, '…').replace(/\b[A-Za-z0-9_-]{24,}\b/g, '…').replace(/\d+/g, '#')
    .replace(/\s+/g, ' ').trim().slice(0, max || 160);
}
function pathOf(p) { return norm(String(p || '').split('?')[0], 80).replace(/\/(photo|original)\/.*$/, '/$1/…'); }

// a log line that tells of trouble. Routine lines, a backup sent or a photo found, are left alone.
const JOB_RE = /could not|couldn't|failed|failing|not be (read|saved|sent|made|loaded)|unexpected/i;
const ERROR_RE = /^(Request error|Unexpected (error|rejection))/;
// a message shown on a page that tells of trouble rather than of something done
const TROUBLE_RE = /could not|couldn't|did not|didn't|try again|not allowed|too (large|long|big)|first\b|needs? |missing|no longer|has expired|isn't|is not|can't|cannot|choose |pick |fill in|add (a|an|the|at least) /i;
const DONE_RE = /^(saved|copied|sent|added|kept|removed|done|deleted|moved|updated|marked|printed|shared|signed)\b/i;

function planFor(f) {
  const where = f.where && f.where.length ? f.where.join(', ') : '';
  switch (f.kind) {
    case 'error': return [
      `Open the server's log on Render around ${f.lastText} and find "${f.text}".`,
      where ? `Try ${where} again the way an educator would, to see the error happen.` : 'Find which page was in use at that time and try it again.',
      'Correct the cause in the code and add a test that shows it working.',
      'Watch the next day\'s report. The finding stays handled only if the error does not come back.'];
    case 'client': return [
      `The error was "${f.text}"${where ? `, on ${where}` : ''}. It came from a page on someone's phone or computer, not the server.`,
      'Open that page in TREE on the same kind of device and do what an educator would there.',
      'Correct the page in src and build again with python3 tools/build.py, and add a test where one fits.',
      'Ask the educators who saw it to reload TREE once the correction is up.'];
    case 'status': return [
      `Settings, Server status says: "${f.text}"`,
      /key|passcode|Environment|set up/i.test(f.text) ? 'Add or correct that setting under Environment on Render, then restart the server.' : 'Check the service it names, GitHub, Google Drive or the mailbox script, is reachable and its key has not expired.',
      'Open the server status page again to see it turn green.'];
    case 'job': return [
      `A job the server runs by itself said "${f.text}".`,
      /drive|google/i.test(f.text) ? 'Check the Google Drive connection and that the service account still has the folder shared with it.'
        : /github|records|save/i.test(f.text) ? 'Check the GitHub token on Render has not expired and the records repository is reachable.'
        : /claude|writing help|anthropic/i.test(f.text) ? 'Check the writing help key and its spending limit.'
        : /mail|inbox|kaymbu|digest|menu/i.test(f.text) ? 'Check the school\'s mailbox script is running and its key matches the one on Render.'
        : 'Read the lines around it in the server log on Render to see what it needed.',
      'Once corrected, the job runs again by itself. Check the next day\'s report shows it gone.'];
    case 'user': case 'trouble': return [
      `People saw "${f.text}" ${f.count} times${f.people > 1 ? `, ${f.people} different people` : ''}${where ? `, on ${where}` : ''}.`,
      'Ask one or two of them what they were trying to do when it showed.',
      'Change the screen so it cannot happen, by asking for what is needed before the button is pressed or by setting a sensible default.',
      'Where it still can happen, make the message say exactly what to do next in plain words.'];
    case 'slow': return [
      `${where || f.text} took ${Math.round(f.avg / 100) / 10} seconds on average, ${f.count} times, the longest ${Math.round(f.max / 100) / 10} seconds.`,
      'Check whether it happens just after the server wakes from sleep on Render. If so, a paid instance that stays awake removes the wait.',
      'Otherwise look at what that request reads or writes, and keep what it builds for a while instead of building it each time, or send less.',
      'Watch the next report for the time to come down.'];
    case 'signin': return [
      `Sign-ins ended ${f.count} times for ${f.people} people.`,
      'Ask whether those people were on a shared Class computer or a phone that clears its browser.',
      'If not, check the sign-in length on the server and that SESSION_SECRET on Render has not changed.'];
    case 'trend': return [
      `${f.text}`,
      'Look at the other findings today first, one of them is likely the cause.',
      'Check whether anything changed yesterday, a new version of TREE, a key on Render or a service it uses.'];
    default: return ['Look at the server log on Render around ' + f.lastText + '.'];
  }
}

module.exports = function watch(o) {
  const now = o.now || (() => Date.now());
  const statusLines = o.statusLines || (() => []);
  const notify = o.notify || (async () => {});
  const mail = o.mail || null;
  const save = o.save || (() => {});
  const scrub = o.scrub || (s => s);
  const log = o.log || (() => {});

  let st = { day: dayOf(now()), items: {}, history: [], handled: {}, sentAt: {}, digestDay: '', plan: null };
  let dirty = false, loaded = false;

  function rollover() {
    const d = dayOf(now()); if (d === st.day) return;
    const items = Object.values(st.items);
    const totals = {}; for (const it of items) totals[it.kind] = (totals[it.kind] || 0) + it.count;
    st.history.unshift({ day: st.day, totals, items: items.sort((a, b) => b.count - a.count).slice(0, 60) });
    st.history = st.history.slice(0, HISTORY_DAYS);
    st.day = d; st.items = {}; dirty = true;
  }

  // one more of the same trouble. who is a name only to count how many people it reached, and is never kept as written.
  function note(kind, text, detail) {
    if (!KINDS[kind]) return;
    detail = detail || {};
    rollover();
    const t = now();
    const key = kind + '|' + norm(text) + (detail.where ? '|' + detail.where : '');
    let it = st.items[key];
    if (!it) {
      if (Object.keys(st.items).length >= MAX_KEYS) return;
      it = st.items[key] = { key, kind, text: norm(text), where: [], count: 0, people: [], first: t, last: t, ms: 0, max: 0, status: detail.status || 0 };
    }
    it.count++; it.last = t;
    if (detail.where && !it.where.includes(detail.where) && it.where.length < 5) it.where.push(detail.where);
    if (detail.who) { const h = require('crypto').createHash('sha256').update(String(detail.who).toLowerCase()).digest('hex').slice(0, 10); if (!it.people.includes(h) && it.people.length < 50) it.people.push(h); }
    if (detail.ms) { it.ms += detail.ms; it.max = Math.max(it.max, detail.ms); }
    dirty = true;
    // the times of the last five errors, so five within any hour is urgent, whenever in the day they come
    if (kind === 'error') {
      it.hits = (Array.isArray(it.hits) ? it.hits : []).concat(t).slice(-5);
      if (it.hits.length >= 5 && t - it.hits[0] < HOUR) urgent(it, 'The server has had the same error five times within an hour.');
    }
  }

  // what the server's own log says, read as it is written
  function fromLog(args) {
    const first = String(args[0] == null ? '' : args[0]);
    if (/^Slow request/.test(first)) return;
    if (ERROR_RE.test(first)) {
      const e = String(args[1] || '').split('\n'); note('error', first + (e[0] ? ': ' + e[0] : ''), { where: (e.find(l => /server\.js|\.js:\d/.test(l)) || '').trim().replace(/^at /, '').replace(/\(.*\//, '(').slice(0, 80) });
      return;
    }
    if (JOB_RE.test(first)) note('job', first);
  }
  function refused(path, status, message, who) {
    const p = pathOf(path);
    if (!/^\/(api|family|public|login)/.test(p)) return;
    if (status === 401) { note('signin', 'Sign-in ended', { who }); return; }
    if (status >= 500) { note('error', message || ('The server answered ' + status), { where: p }); return; }
    note('user', message || ('The server answered ' + status), { where: p, who, status });
  }
  function slow(path, ms) { note('slow', 'Slow ' + pathOf(path), { where: pathOf(path), ms }); }
  // from a page. kind is error or message, view the page that was open.
  function fromPage(b, who) {
    const view = norm(b && b.view, 40);
    if (b && b.kind === 'message') {
      const m = String(b.text || '');
      if (!TROUBLE_RE.test(m) || DONE_RE.test(m)) return false;
      note('trouble', scrub(m), { where: view ? 'the ' + view + ' page' : '', who }); return true;
    }
    const msg = scrub(String((b && b.text) || 'An error in the page'));
    const src = norm(String((b && b.src) || '').replace(/^.*\//, ''), 60);
    note('client', msg, { where: [view && 'the ' + view + ' page', src].filter(Boolean).join(', '), who }); return true;
  }

  // the items of the last day, today's and yesterday's, the window each report reads
  function recent() {
    rollover();
    const t = now(), out = new Map();
    const add = it => { if (t - it.last > 26 * HOUR) return; const c = out.get(it.key); if (!c) out.set(it.key, Object.assign({}, it, { where: [...it.where], people: [...it.people] })); else { c.count += it.count; c.ms += it.ms; c.max = Math.max(c.max, it.max); c.first = Math.min(c.first, it.first); c.last = Math.max(c.last, it.last); for (const w of it.where) if (!c.where.includes(w)) c.where.push(w); for (const p of it.people) if (!c.people.includes(p)) c.people.push(p); } };
    for (const it of Object.values(st.items)) add(it);
    if (st.history[0]) for (const it of st.history[0].items) add(it);
    return [...out.values()];
  }

  function timeText(t) { return new Date(t).toLocaleString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  // the red lines of the server status, leaving out a part the director has simply not turned on, such as video clips
  const OFF_RE = /\b(is|are) off\b|not set up|turns? (it|them) on|^No [a-z ]+ (key )?is saved|Add [A-Z_]{3,} under Environment/;
  function redLines() { return statusLines().filter(([ok, text]) => !ok && !OFF_RE.test(String(text))); }

  // the findings, each with what was seen and a plan of correction
  function findings() {
    const list = [];
    const push = (it, severity, title) => {
      const f = { key: it.key, kind: it.kind, type: KINDS[it.kind], severity, title, text: it.text, where: it.where, count: it.count, people: it.people.length, first: it.first, last: it.last, avg: it.count ? it.ms / it.count : 0, max: it.max, lastText: timeText(it.last) };
      // a red status line stays handled while it stays red. Anything else comes back when it happens again.
      const h = st.handled[it.key];
      if (h && (it.kind === 'status' || h.at >= it.last)) return;
      f.plan = planFor(f); list.push(f);
    };
    for (const it of recent()) {
      const n = it.count, ppl = it.people.length;
      if (it.kind === 'error') push(it, n >= 5 ? 'urgent' : 'high', 'An error on the server');
      else if (it.kind === 'client' && (n >= 2 || ppl >= 2)) push(it, n >= 10 ? 'high' : 'medium', 'An error in a page');
      else if (it.kind === 'job') { if (/backup|save/i.test(it.text)) push(it, 'high', 'A job that keeps records safe could not run'); else if (n >= 3) push(it, 'medium', 'A background job could not run'); }
      else if ((it.kind === 'user' || it.kind === 'trouble') && (n >= 5 || ppl >= 3)) push(it, n >= 20 || ppl >= 5 ? 'medium' : 'low', 'The same problem for people again and again');
      else if (it.kind === 'slow' && n >= 3) push(it, it.ms / n > 10000 ? 'medium' : 'low', 'Slow for people');
      else if (it.kind === 'signin' && n >= 10 && ppl >= 3) push(it, 'low', 'Sign-ins ending often');
    }
    for (const [ok, text] of redLines()) if (!ok) {
      const it = { key: 'status|' + norm(text), kind: 'status', text: String(text), where: [], count: 1, people: [], first: now(), last: now(), ms: 0, max: 0 };
      push(it, /sav/i.test(text) ? 'urgent' : 'high', 'Server status needs attention');
    }
    // a day with much more trouble than the week before
    const trouble = items => items.filter(i => ['error', 'client', 'job'].includes(i.kind)).reduce((n, i) => n + i.count, 0);
    const week = st.history.slice(0, 7);
    if (week.length >= 3) {
      const avg = week.reduce((n, h) => n + ['error', 'client', 'job'].reduce((m, k) => m + (h.totals[k] || 0), 0), 0) / week.length;
      const today = trouble(recent());
      if (today >= 5 && today > 2 * Math.max(1, avg)) push({ key: 'trend|' + st.day, kind: 'trend', text: `There were ${today} errors in the last day, against about ${Math.round(avg)} a day the week before.`, where: [], count: today, people: [], first: now(), last: now(), ms: 0, max: 0 }, 'medium', 'More trouble than usual');
    }
    return list.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.count - a.count);
  }

  function letter(list) {
    const lines = [`TREE's program watch found ${list.length} thing${list.length === 1 ? '' : 's'} to correct, from the last day.`, ''];
    list.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.title} (${f.type}, ${f.severity})`);
      lines.push(`   Seen ${f.count} time${f.count === 1 ? '' : 's'}${f.people ? `, by ${f.people} ${f.people === 1 ? 'person' : 'people'}` : ''}, last ${f.lastText}.`);
      lines.push('   Plan of correction:');
      f.plan.forEach((s, j) => lines.push(`   ${String.fromCharCode(97 + j)}. ${s}`));
      lines.push('');
    });
    lines.push('Mark each one handled in TREE, Settings, Program watch, once it is done.');
    return lines.join('\n');
  }

  async function send(title, body, list) {
    try { await notify({ title, body, url: 'tree.html?go=watch', tag: 'tree-watch' }); } catch (e) { log('Program watch could not notify the director', e.message); }
    if (mail && list) try { await mail('TREE program watch, ' + title.replace(/^TREE, /, ''), letter(list)); } catch (e) { log('Program watch could not email the plan', e.message); }
  }
  function urgent(it, why) {
    const t = now(); if (st.sentAt[it.key] && t - st.sentAt[it.key] < 6 * HOUR) return;
    st.sentAt[it.key] = t; dirty = true;
    const f = Object.assign({}, it, { type: KINDS[it.kind], severity: 'urgent', title: why, people: it.people.length, lastText: timeText(it.last), avg: 0 }); f.plan = planFor(f);
    send('TREE, something needs attention now', why + ' ' + f.plan[0], [f]);
  }

  // every ten minutes: urgent status at once, and the daily report after 7 in the morning
  async function tick() {
    if (!loaded) return null;
    rollover();
    // a status line handled while red is forgotten once it is no longer red, so it is sent again if it comes back
    const red = new Set(redLines().map(([, text]) => 'status|' + norm(text)));
    for (const k of Object.keys(st.handled)) if (k.startsWith('status|') && !red.has(k)) { delete st.handled[k]; dirty = true; }
    for (const [ok, text] of redLines()) if (!ok && /sav/i.test(text) && !st.handled['status|' + norm(text)]) urgent({ key: 'status|' + norm(text), kind: 'status', text: String(text), where: [], people: [], count: 1, first: now(), last: now(), ms: 0, max: 0 }, 'Saves are not reaching the records.');
    let sent = null;
    if (st.digestDay !== st.day && hourOf(now()) >= 7) {
      const list = findings();
      st.digestDay = st.day; st.plan = { at: now(), day: st.day, findings: list }; dirty = true;
      if (list.length) {
        const top = list[0];
        await send(`TREE, ${list.length} thing${list.length === 1 ? '' : 's'} to correct`, `${top.title}. ${top.plan[0]} Open TREE for the plan of correction.`, list);
        sent = list;
      }
    }
    if (dirty) { dirty = false; try { save(snapshot()); } catch (e) { log('Program watch could not be kept', e.message); } }
    return sent;
  }

  function snapshot() { return { day: st.day, items: Object.values(st.items), history: st.history, handled: st.handled, sentAt: st.sentAt, digestDay: st.digestDay, plan: st.plan }; }
  function load(doc) {
    if (doc && typeof doc === 'object') {
      const pending = st.items;
      const items = {}; for (const it of Array.isArray(doc.items) ? doc.items : []) if (it && it.key) items[it.key] = it;
      st = { day: doc.day || st.day, items, history: Array.isArray(doc.history) ? doc.history : [], handled: doc.handled || {}, sentAt: doc.sentAt || {}, digestDay: doc.digestDay || '', plan: doc.plan || null };
      // a day kept before the server slept moves to the history, and anything counted before the records were read is added
      rollover();
      for (const it of Object.values(pending)) { const c = st.items[it.key]; if (!c) st.items[it.key] = it; else { c.count += it.count; c.last = Math.max(c.last, it.last); c.ms += it.ms; c.max = Math.max(c.max, it.max); for (const p of it.people) if (!c.people.includes(p)) c.people.push(p); } }
    }
    loaded = true;
  }
  function handle(key, by) { st.handled[key] = { at: now(), by: String(by || '') }; dirty = true; }
  function reopen(key) { delete st.handled[key]; dirty = true; }

  // what the director sees in Settings, and what the outside monitoring agent reads, with names taken out for it
  function view(outside) {
    const list = findings();
    // outside TREE a finding's key is an opaque id, since the key is made from the message itself
    const opaque = k => 'f-' + require('crypto').createHash('sha256').update(String(k)).digest('hex').slice(0, 16);
    const clean = f => outside ? Object.assign({}, f, { key: opaque(f.key), text: scrub(f.text), plan: f.plan.map(scrub), where: (f.where || []).map(scrub) }) : f;
    const days = st.history.slice(0, 14).map(h => ({ day: h.day, totals: h.totals }));
    return { at: now(), day: st.day, findings: list.map(clean), handled: Object.keys(st.handled).length, lastReport: st.plan ? { at: st.plan.at, day: st.plan.day, count: (st.plan.findings || []).length } : null, days };
  }

  return { note, fromLog, refused, slow, fromPage, findings, tick, load, handle, reopen, view, letter, snapshot, isLoaded: () => loaded, _norm: norm };
};
module.exports.dayOf = dayOf;
