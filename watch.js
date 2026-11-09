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
  // how TREE feels to use, from the pages themselves. obsopen is only counted, to weigh how often the form is left.
  pageload: 'Efficiency', render: 'Efficiency', lost: 'User experience', abandon: 'User experience', stuck: 'Glitch',
  unused: 'Improvement', obsopen: 'Usage',
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

const secs = ms => Math.round((ms || 0) / 100) / 10;
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
    case 'pageload': return [
      `TREE took ${secs(f.avg)} seconds on average to open, ${f.count} times, the longest ${secs(f.max)} seconds.`,
      'Check whether the slow openings come just after the server wakes from sleep on Render. A paid instance that stays awake removes that wait.',
      'Otherwise make the first page lighter. Move a section used rarely into a page loaded when opened, in tools/lazy.py, and send fewer records when TREE opens.',
      'Watch the next report for the opening time to come down.'];
    case 'render': return [
      `${f.where.join(', ') || 'A page'} took ${secs(f.avg)} seconds on average to draw on people's phones and computers, ${f.count} times.`,
      'Open that page with many records, as the director sees it, and time what it builds.',
      'Build only what shows first, and the rest when it is opened, or keep what it works out instead of working it out on every draw.'];
    case 'lost': return [
      `${f.count} times${f.people > 1 ? `, by ${f.people} people` : ''}, someone moved through six or more pages within a minute without writing anything, starting ${f.where.join(', ') || 'from one page'}.`,
      'That usually means looking for something. Ask an educator what they were looking for from that page.',
      'Add a link or a button for it on that page, or name it the way educators say it so Search finds it.',
      'Watch the next reports for this to happen less.'];
    case 'abandon': return [
      `The Keep an observation form was opened ${f.opened} times and left without keeping ${f.count} times${f.people > 1 ? `, by ${f.people} people` : ''}.`,
      'Some of these are a tap by mistake. Ask one or two educators whether the form asks for something they do not have at that moment.',
      'Make the form shorter to start, with only what is needed, and the rest under More. Check the round button is not easy to tap by mistake.',
      'Watch the share of observations kept go up.'];
    case 'stuck': return [
      `An observation kept on a phone waited ${Math.round(f.max / 60000)} minutes to be sent while the phone had a connection, ${f.count} times${f.people > 1 ? `, on ${f.people} people's phones` : ''}.`,
      'Ask the educator to open TREE with a connection and keep it open a minute, so the observation sends.',
      'If it still waits, look for errors from that phone in the Program watch and in the server log, near draftSend in src/app.html.'];
    case 'unused': return [
      `No one has opened ${f.where.join(', ')} in the last two weeks, though people did before.`,
      'Ask whether it is still needed, or whether educators cannot find it.',
      'If it is needed, link it from the page educators use around it, or mention it in Help. If not, it can be folded away to make TREE simpler.'];
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

  let st = { day: dayOf(now()), items: {}, history: [], handled: {}, sentAt: {}, digestDay: '', plan: null, visits: {} };
  let dirty = false, loaded = false;

  function rollover() {
    const d = dayOf(now()); if (d === st.day) return;
    const items = Object.values(st.items);
    const totals = {}; for (const it of items) totals[it.kind] = (totals[it.kind] || 0) + it.count;
    st.history.unshift({ day: st.day, totals, items: items.sort((a, b) => b.count - a.count).slice(0, 60), visits: st.visits || {} });
    st.visits = {};
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
    // the same trouble reported again, an observation still waiting, raises how long it lasted without counting it twice
    if (detail.again) { it.last = t; if (detail.ms) it.max = Math.max(it.max, detail.ms); dirty = true; return; }
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
    // a save that fails once is tried again 30 seconds later. Only a retry that also fails is trouble (November 9, 2026).
    if (/^Save written after earlier failures/.test(first)) { saveFails.delete(String(args[1] || '')); return; }
    if (/^Save failed/.test(first)) { const p = String(args[1] || ''), n = (saveFails.get(p) || 0) + 1; saveFails.set(p, n);
      if (saveFails.size > 500) saveFails.delete(saveFails.keys().next().value);
      if (n >= 2) note('job', 'Save failed, and the retry did not work either'); return; }
    if (JOB_RE.test(first)) note('job', first);
  }
  const saveFails = new Map();
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

  /* what a page tells of how TREE felt to use, sent every few minutes in one small batch. Only counts and times come,
     with page names. Nothing anyone wrote is in it. */
  const VIEW_RE = /^[a-z][a-z0-9-]{0,30}$/;
  function usage(b, who) {
    if (!b || typeof b !== 'object') return;
    rollover();
    const num = (x, max) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
    for (const [v, n] of Object.entries(b.views && typeof b.views === 'object' ? b.views : {}).slice(0, 60)) if (VIEW_RE.test(v)) { st.visits[v] = (st.visits[v] || 0) + Math.round(num(n, 500)); dirty = true; }
    const load = num(b.load, 600000); if (load) note('pageload', 'Opening TREE', { ms: load, who });
    for (const r of (Array.isArray(b.renders) ? b.renders : []).slice(0, 20)) if (r && VIEW_RE.test(r.view) && num(r.ms, 600000) > 1500) note('render', 'Slow to draw the ' + r.view + ' page', { where: 'the ' + r.view + ' page', ms: num(r.ms, 600000), who });
    for (const l of (Array.isArray(b.lost) ? b.lost : []).slice(0, 5)) if (l && VIEW_RE.test(l.from)) note('lost', 'Moving through many pages without writing', { where: 'from the ' + l.from + ' page', who });
    const o = b.obs && typeof b.obs === 'object' ? b.obs : {};
    for (let i = 0; i < Math.round(num(o.opened, 50)); i++) note('obsopen', 'Keep an observation opened', { who });
    for (let i = 0; i < Math.round(num(o.left, 50)); i++) note('abandon', 'Keep an observation left without keeping', { who });
    // a number is an observation first found waiting half an hour, and { ms, again } the same one still waiting later
    for (const m of (Array.isArray(b.stuck) ? b.stuck : []).slice(0, 10)) { const again = !!(m && typeof m === 'object' && m.again), ms = num(m && typeof m === 'object' ? m.ms : m, 864e5);
      if (ms >= 30 * 60000) note('stuck', 'An observation waited on a phone with a connection', { ms, who, again }); }
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
      const f = { key: it.key, kind: it.kind, type: KINDS[it.kind], severity, title, text: it.text, where: it.where, count: it.count, people: it.people.length, first: it.first, last: it.last, avg: it.count ? it.ms / it.count : 0, max: it.max, opened: it.opened || 0, lastText: timeText(it.last) };
      // a red status line, and the same set of unused pages, stays handled while it stays so. Anything else comes back when it happens again.
      const h = st.handled[it.key];
      if (h && (it.kind === 'status' || it.kind === 'unused' || h.at >= it.last)) return;
      f.plan = planFor(f); list.push(f);
    };
    const all = recent(), opens = all.filter(i => i.kind === 'obsopen');
    for (const it of all) {
      const n = it.count, ppl = it.people.length;
      if (it.kind === 'error') push(it, n >= 5 ? 'urgent' : 'high', 'An error on the server');
      else if (it.kind === 'client' && (n >= 2 || ppl >= 2)) push(it, n >= 10 ? 'high' : 'medium', 'An error in a page');
      else if (it.kind === 'job') { if (/backup|save/i.test(it.text)) push(it, 'high', 'A job that keeps records safe could not run'); else if (n >= 3) push(it, 'medium', 'A background job could not run'); }
      else if ((it.kind === 'user' || it.kind === 'trouble') && (n >= 5 || ppl >= 3)) push(it, n >= 20 || ppl >= 5 ? 'medium' : 'low', 'The same problem for people again and again');
      else if (it.kind === 'slow' && n >= 3) push(it, it.ms / n > 10000 ? 'medium' : 'low', 'Slow for people');
      else if (it.kind === 'signin' && n >= 10 && ppl >= 3) push(it, 'low', 'Sign-ins ending often');
      else if (it.kind === 'pageload' && n >= 5 && it.ms / n > 6000) push(it, it.ms / n > 12000 ? 'medium' : 'low', 'TREE is slow to open');
      else if (it.kind === 'render' && n >= 3 && it.ms / n > 2000) push(it, 'low', 'A page is slow to draw');
      else if (it.kind === 'lost' && (n >= 3 || ppl >= 2)) push(it, 'low', 'People hunting for something');
      else if (it.kind === 'abandon') { const op = opens.reduce((m, o) => m + o.count, 0); if (n >= 5 && op && n / op >= 0.4) { it.opened = op; push(it, n / op >= 0.6 ? 'medium' : 'low', 'Observations started and not kept'); } }
      else if (it.kind === 'stuck' && (n >= 2 || it.max >= 2 * HOUR)) push(it, 'high', 'An observation waited on a phone');
    }
    // a page people opened before and no one has opened in the last two weeks
    if (st.history.length >= 21) {
      const seen = (from, to) => { const v = {}; for (const h of st.history.slice(from, to)) for (const [k, n] of Object.entries(h.visits || {})) v[k] = (v[k] || 0) + n; return v; };
      const lately = seen(0, 14); for (const [k, n] of Object.entries(st.visits || {})) lately[k] = (lately[k] || 0) + n;
      const before = seen(14, 28);
      const gone = Object.keys(before).filter(k => before[k] >= 3 && !lately[k]).sort().slice(0, 6);
      if (gone.length) push({ key: 'unused|' + gone.join(','), kind: 'unused', text: 'Pages no one has opened in two weeks: ' + gone.join(', ') + '.', where: gone.map(g => 'the ' + g + ' page'), count: gone.length, people: [], first: now(), last: now(), ms: 0, max: 0 }, 'low', 'Parts of TREE no one is using');
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

  function snapshot() { return { day: st.day, items: Object.values(st.items), history: st.history, handled: st.handled, sentAt: st.sentAt, digestDay: st.digestDay, plan: st.plan, visits: st.visits }; }
  function load(doc) {
    if (doc && typeof doc === 'object') {
      const pending = st.items;
      const items = {}; for (const it of Array.isArray(doc.items) ? doc.items : []) if (it && it.key) items[it.key] = it;
      st = { day: doc.day || st.day, items, history: Array.isArray(doc.history) ? doc.history : [], handled: doc.handled || {}, sentAt: doc.sentAt || {}, digestDay: doc.digestDay || '', plan: doc.plan || null, visits: doc.visits && typeof doc.visits === 'object' ? doc.visits : {} };
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

  return { note, fromLog, refused, slow, fromPage, usage, findings, tick, load, handle, reopen, view, letter, snapshot, isLoaded: () => loaded, _norm: norm };
};
module.exports.dayOf = dayOf;
