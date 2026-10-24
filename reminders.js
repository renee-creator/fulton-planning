'use strict';
// Reminders for educators, sent to their phones as notifications from TREE.
// Monday at 8 the week's planning is listed, at 4 whatever is still open, and Tuesday to Friday at 8 whatever is
// still open after that. Thursday and Friday at 8 an educator below the week's observations hears so. The director
// gets a Monday summary at 4. Only work from the week reminders began onward counts, so nothing older ever comes up.
// The director decides which reminders each educator receives. Educators have no switch of their own.
//
// Notifications are Web Push (RFC 8030), with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291),
// written with Node's own crypto so the server installs nothing.
const crypto = require('crypto');

module.exports = function reminders(o) {
  const { store, accounts, accountFor, saveAccounts, isDirector, isKitchen, log, noteChange, scheduleSave } = o;
  const TZ = 'America/Los_Angeles';
  const TYPES = { remarks: 'Final remarks', plan: 'This week\'s plan', classroom: 'Classroom plan', obs: 'Observations', conf: 'Conferences', confform: 'Conference forms', summary: 'Monday summary', review: 'Plans to review, for the director', reviewed: 'The director reviewed a plan' };
  // every box an educator writes before a plan is sent to the director, except Final remarks
  const SEND_NEED = { individual: ['area', 'dates', 'observation', 'intent', 'materials', 'questions'], classroom: ['observation', 'intentions', 'meeting', 'interests', 'indoor', 'outdoor', 'brainstorm'] };
  // the sections an educator prepares before a family conference. Shared goals and next steps are written at the conference
  const CONF_PREP = ['interests', 'friends', 'smallGroup', 'favoriteAreas', 'nature', 'approaches', 'social', 'language', 'cognition', 'physical', 'expressive', 'strengths', 'documentation'];
  const NO_SIGNUP = ['declined', 'noresponse', 'missed'];
  // the preparation steps that also count, checked on the form
  const CONF_STEPS = ['questionnaire', 'drdp', 'coteachers', 'samples'];
  // the sections each plan needs before it is complete. The after-the-week section is due the week after
  const NEED = {
    classroom: ['observation', 'intentions', 'meeting', 'interests', 'indoor', 'outdoor', 'brainstorm'],
    individual: ['area', 'dates', 'observation', 'intent', 'materials', 'questions'],
    smallgroup: ['thread', 'intention', 'questions', 'graphic', 'materials'],
  };
  const AFTER = { individual: 'remarks', smallgroup: 'reflection' };

  // ---------- keys ----------
  const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  let KEY = null;
  function keys() {
    if (KEY) return KEY;
    const pub = process.env.VAPID_PUBLIC, priv = process.env.VAPID_PRIVATE;
    if (!pub || !priv) return null;
    try { KEY = { pub, key: crypto.createPrivateKey({ key: unb64u(priv), format: 'der', type: 'pkcs8' }) }; } catch (e) { log('Reminder keys could not be read,', e.message); return null; }
    return KEY;
  }
  function vapidHeader(endpoint) {
    const k = keys(); const aud = new URL(endpoint).origin;
    const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:tree@childfamilycommunity.com' }));
    const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: k.key, dsaEncoding: 'ieee-p1363' });
    return `vapid t=${head}.${body}.${b64u(sig)}, k=${k.pub}`;
  }
  const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
  function encrypt(sub, text) {
    const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const asPub = ecdh.getPublicKey();
    const shared = ecdh.computeSecret(uaPub);
    const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
    const salt = crypto.randomBytes(16); const prk = hmac(salt, ikm);
    const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
    const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
    const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), c.final(), c.getAuthTag()]);
    const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
    return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
  }
  async function pushOne(sub, msg) {
    const r = await fetch(sub.endpoint, { method: 'POST', headers: { TTL: '86400', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidHeader(sub.endpoint) }, body: encrypt(sub, JSON.stringify(msg)) });
    return r.status;
  }
  // a message reaches every phone the educator turned reminders on with. A phone that no longer takes them is dropped
  async function sendTo(name, msg) {
    const a = accountFor(name); if (!a || !keys()) return { sent: 0, why: !keys() ? 'Reminders are not set up on the server yet.' : 'No sign-in' };
    const subs = a.push || []; if (!subs.length) return { sent: 0, why: 'Reminders are not turned on on this educator\'s phone yet.' };
    let sent = 0, gone = [], fail = '';
    for (const s of subs) {
      try { const st = await pushOne(s, msg); if (st >= 200 && st < 300) sent++; else if (st === 404 || st === 410) gone.push(s.endpoint); else fail = 'The phone service answered ' + st; }
      catch (e) { fail = e.message; }
    }
    if (gone.length) a.push = subs.filter(s => !gone.includes(s.endpoint));
    a.pushLog = Object.assign({}, a.pushLog, sent ? { lastOk: Date.now() } : {}, fail || (gone.length && !sent) ? { lastFail: Date.now(), why: fail || 'The phone stopped taking reminders.' } : {});
    saveAccounts(a.name);
    if (!sent) log('Reminder not delivered to', a.name, fail || 'no phone took it');
    return { sent, why: sent ? '' : (fail || 'The phone stopped taking reminders.') };
  }
  function subscribe(name, sub, ua) {
    const a = accountFor(name); if (!a || !sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return false;
    if (!/^https:\/\//.test(sub.endpoint)) return false;
    const rest = (a.push || []).filter(s => s.endpoint !== sub.endpoint);
    a.push = [...rest, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: Date.now(), ua: String(ua || '').slice(0, 120) }].slice(-3);
    a.pushLog = Object.assign({}, a.pushLog, { onAt: Date.now() }); delete a.pushLog.why;
    saveAccounts(a.name); return true;
  }

  // ---------- time ----------
  function nowLA() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const day = `${p.year}-${p.month}-${p.day}`, dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    return { day, dow, mins: (+p.hour % 24) * 60 + (+p.minute), week: addDays(day, -((dow + 6) % 7)) };
  }
  function addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  const weekStartMs = week => new Date(new Date(week + 'T00:00:00Z').getTime() + 8 * 3600e3).getTime(); // Monday midnight in California, near enough for counting

  // ---------- settings ----------
  const docOf = (kind, id) => { const r = store.recs[kind] && store.recs[kind].get(id); return r && !r.deleted ? r.doc : null; };
  function settings() {
    const s = docOf('settings', 'notify') || {};
    return { start: s.start || '', perWeek: s.perWeek > 0 ? +s.perWeek : 3, types: Object.assign({ remarks: true, plan: true, classroom: true, obs: true, conf: true, confform: true, summary: true, review: true, reviewed: true }, s.types || {}), people: s.people || {} };
  }
  // how often each person plans. Most plan weekly. Some plan monthly, and some keep observations only
  const PLAN_DEFAULTS = {  };
  function personOf(S, name) {
    if (S.people[name]) return S.people[name];
    const f = key(name).split(' ')[0]; const k = Object.keys(S.people).find(n => key(n).split(' ')[0] === f);
    return k ? S.people[k] : {};
  }
  const planEvery = (S, name) => personOf(S, name).plans || PLAN_DEFAULTS[key(name).split(' ')[0]] || 'weekly';
  function ensureStart() {
    const s = docOf('settings', 'notify'); if (s && s.start) return;
    const doc = Object.assign({}, s || {}, { start: nowLA().week, updatedByName: 'TREE' });
    const cur = store.recs.settings.get('notify');
    store.recs.settings.set('notify', { doc, sha: cur && cur.sha, path: 'settings/notify.json', local: true });
    noteChange('settings', 'notify'); scheduleSave('settings', 'notify');
  }
  function runs() { return docOf('settings', 'notifyrun') || {}; }
  function markRun(k, v) {
    const cur = store.recs.settings.get('notifyrun'); const doc = Object.assign({}, cur && !cur.deleted ? cur.doc : {}, { [k]: v });
    store.recs.settings.set('notifyrun', { doc, sha: cur && cur.sha, path: 'settings/notifyrun.json', local: true });
    noteChange('settings', 'notifyrun'); scheduleSave('settings', 'notifyrun');
  }

  // ---------- who and what ----------
  const key = s => String(s || '').trim().toLowerCase();
  function educators() {
    const ed = docOf('settings', 'educators'); const names = (ed && Array.isArray(ed.names) ? ed.names : []).filter(r => r && r.name);
    // a new hire, before full access, hears nothing about planning
    return names.filter(r => !isDirector(r.name) && !isKitchen(r.name) && !(accountFor(r.name) || {}).newHire).map(r => ({ name: r.name.trim(), room: r.room || '' }));
  }
  const nameIn = (field, name) => String(field || '').split(/,|&|\band\b|\//i).map(key).some(k => k && (k === key(name) || k.split(' ')[0] === key(name).split(' ')[0]));
  const filled = v => !!String(v || '').trim();
  const plansAll = () => [...store.recs.plans.values()].filter(r => !r.deleted && r.doc && r.doc.id !== 'example').map(r => r.doc).filter(p => NEED[p.type] && !(p.dupOf && store.recs.plans.has(p.dupOf)));
  const missing = p => NEED[p.type].filter(k => !filled(p.fields && p.fields[k])).length + (p.type === 'classroom' && !(filled(p.web && p.web.focus) || ((p.web && p.web.branches) || []).some(b => filled(b && b.name))) ? 1 : 0);
  const nonEmpty = p => Object.values(p.fields || {}).some(filled);
  const sent = p => p.status === 'ready' || p.status === 'reviewed';
  const writtenToSend = p => !!SEND_NEED[p.type] && SEND_NEED[p.type].every(k => filled(p.fields && p.fields[k]));
  const draftLeft = (p, when) => when.dow >= 2 && !sent(p) && writtenToSend(p);
  function obsCount(name, week) {
    const since = weekStartMs(week); const seen = new Set();
    for (const r of store.recs.notices.values()) { const n = r.doc; if (r.deleted || !n || (n.at || 0) < since || key(n.by) !== key(name)) continue; seen.add(n.group || n.id); }
    return seen.size;
  }
  // ---------- conferences ----------
  function childFirst(id) { const k = store.recs.children.get(id); return k && !k.deleted && k.doc && k.doc.first ? k.doc.first : 'a child'; }
  function confsFor(name) {
    const today = nowLA().day; const out = [];
    for (const r of store.recs.conferences.values()) { const c = r.doc;
      if (r.deleted || !c || !c.confDate || c.confDate < today || c.status === 'complete' || c.term === 'Historical' || NO_SIGNUP.includes(c.signup) || !nameIn(c.teacher, name)) continue;
      const k = store.recs.children.get(c.childId); if (!k || k.deleted || (k.doc && k.doc.status === 'withdrawn')) continue;
      out.push(c); }
    return out.sort((a, b) => (a.confDate + (a.confTime || '')).localeCompare(b.confDate + (b.confTime || '')));
  }
  const calDays = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  function schoolDaysUntil(a, b) { if (b < a) return -1; let n = 0; for (let d = a; d < b; d = addDays(d, 1)) { const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (d !== a && w > 0 && w < 6) n++; } const w = new Date(b + 'T12:00:00Z').getUTCDay(); return a === b ? 0 : n + (w > 0 && w < 6 ? 1 : 0); }
  function addSchoolDays(d, n) { let x = d; while (n < 0) { x = addDays(x, -1); const w = new Date(x + 'T12:00:00Z').getUTCDay(); if (w > 0 && w < 6) n++; } return x; }
  const dayWord = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
  // a time is a plain clock time, such as 1:15 pm
  const timeWord = require('./clock-time.js');
  // what one educator has open now, each with where tapping it should lead
  function openFor(e, when, S) {
    const { week } = when; const start = S.start || week; const off = new Set(personOf(S, e.name).off || []); const on = t => S.types[t] && !off.has(t);
    const out = []; const ps = plansAll(); const every = planEvery(S, e.name);
    const mine = ps.filter(p => (p.type === 'individual' || p.type === 'smallgroup') && nameIn(p.educator, e.name));
    if (every === 'weekly') {
      const last = addDays(week, -7);
      if (on('remarks') && last >= start) for (const p of mine.filter(p => p.weekOf === last && nonEmpty(p) && !filled(p.fields && p.fields[AFTER[p.type]])))
        out.push({ t: 'remarks', text: p.type === 'smallgroup' ? 'After the week on last week\'s Small Group plan' : 'Final remarks on last week\'s plan', plan: p.id });
      if (on('plan') && week >= start) {
        const now = mine.filter(p => p.weekOf === week && nonEmpty(p));
        if (!now.length) out.push({ t: 'plan', text: 'This week\'s Individual or Small Group plan' });
        else if (now.every(p => !sent(p) && missing(p))) out.push({ t: 'plan', text: 'Finish this week\'s plan', plan: now[0].id });
        else { const d = now.find(p => draftLeft(p, when)); if (d && !now.some(sent)) out.push({ t: 'plan', text: 'Your Individual plan for this week is still a draft. Send it to the director when it\'s ready.', plan: d.id }); }
      }
    } else if (every === 'monthly' && week.slice(8) <= '07') {
      // a monthly plan is due the first week of the month, and last month's final remarks with it
      const month = week.slice(0, 7), prev = addDays(month + '-01', -1).slice(0, 7);
      if (on('remarks') && prev + '-31' >= start) for (const p of mine.filter(p => String(p.weekOf).slice(0, 7) === prev && nonEmpty(p) && !filled(p.fields && p.fields[AFTER[p.type]])))
        out.push({ t: 'remarks', text: 'Final remarks on last month\'s plan', plan: p.id });
      if (on('plan') && week >= start) {
        const now = mine.filter(p => String(p.weekOf).slice(0, 7) === month && nonEmpty(p));
        if (!now.length) out.push({ t: 'plan', text: 'This month\'s plan' });
        else if (now.every(p => !sent(p) && missing(p))) out.push({ t: 'plan', text: 'Finish this month\'s plan', plan: now[0].id });
        else { const d = now.find(p => draftLeft(p, when)); if (d && !now.some(sent)) out.push({ t: 'plan', text: 'Your plan for this month is still a draft. Send it to the director when it\'s ready.', plan: d.id }); }
      }
    }
    if (on('classroom') && week >= start && e.room) {
      const cp = ps.filter(p => p.type === 'classroom' && p.classroom === e.room && p.weekOf === week && nonEmpty(p));
      if (!cp.length) out.push({ t: 'classroom', text: `${e.room} Class's Classroom plan` });
      else if (cp.every(p => !sent(p) && missing(p))) out.push({ t: 'classroom', text: `Finish ${e.room} Class's Classroom plan`, plan: cp[0].id });
      else { const d = cp.find(p => draftLeft(p, when)); if (d && !cp.some(sent)) out.push({ t: 'classroom', text: `${e.room} Class's Classroom plan is still a draft. Send it to the director when it's ready.`, plan: d.id }); }
    }
    // family conferences this educator leads. A reminder a week before, the Friday before and that morning, and the form
    // finished two school days ahead, with a reminder each school morning from five school days ahead until it is
    if ((on('conf') || on('confform')) && when.day) for (const c of confsFor(e.name)) {
      const first = childFirst(c.childId), d = c.confDate, wd = schoolDaysUntil(when.day, d), cal = calDays(when.day, d);
      const at = /^\d{2}:\d{2}$/.test(c.confTime || '') ? ' at ' + timeWord(c.confTime) : '';
      if (on('conf') && (cal === 0 || cal === 7 || (when.dow === 5 && cal > 0 && cal < 7))) out.push({ t: 'conf', text: cal === 0 ? `Conference today with ${first}'s family${at}` : `Conference with ${first}'s family ${dayWord(d)}${at}` });
      const left = CONF_PREP.filter(k => !filled(c.fields && c.fields[k])).length, steps = CONF_STEPS.filter(k => !(c.prep && c.prep[k])).length;
      const todo = [left && `${left} section${left > 1 ? 's' : ''}`, steps && `${steps} preparation step${steps > 1 ? 's' : ''}`].filter(Boolean).join(' and ');
      if (on('confform') && todo && wd >= 0 && wd <= 5) out.push({ t: 'confform', text: `${first}'s conference form, ${todo} to finish${wd > 2 ? `, due ${dayWord(addSchoolDays(d, -2))}` : ''}` });
    }
    if (on('obs') && week >= start && (when.dow === 4 || when.dow === 5 || when.force)) {
      const n = obsCount(e.name, week); if (n < S.perWeek) out.push({ t: 'obs', text: `Observations this week, ${n} of ${S.perWeek}` });
    }
    return out;
  }
  function messageFor(items, morning) {
    const one = items.length === 1 && items[0].plan;
    const conf = items.every(i => i.t === 'conf' || i.t === 'confform');
    return { title: morning ? 'TREE, due today' : 'TREE, still open', body: items.map(i => i.text).join('\n'), url: one ? `tree.html?plan=${encodeURIComponent(items[0].plan)}` : conf ? 'tree.html?open=conferences' : (items.every(i => i.t === 'obs') ? 'tree.html?go=moments' : 'tree.html?go=plans'), tag: 'tree-due' };
  }

  // ---------- the schedule ----------
  let busy = false;
  async function sendRound(kind, when) {
    const S = settings(); const res = [];
    for (const e of educators()) {
      if (personOf(S, e.name).paused) continue;
      const items = openFor(e, when, S).filter(i => kind === 'morning' || (i.t !== 'conf' && i.t !== 'confform')); if (!items.length) continue;
      const r = await sendTo(e.name, messageFor(items, kind === 'morning')); res.push({ name: e.name, items, sent: r.sent });
    }
    // each school morning the director hears how many plans wait for review, only when some do
    if (kind === 'morning' && S.types.review) {
      const n = plansAll().filter(p => p.status === 'ready').length;
      if (n) for (const d of [...accounts.list].filter(a => isDirector(a.name)).map(a => a.name)) await sendTo(d, { title: 'TREE, plans to review', body: `${n} plan${n === 1 ? ' is' : 's are'} waiting for your review.`, url: 'tree.html?go=today', tag: 'tree-review' });
    }
    if (kind === 'evening' && when.dow === 1 && S.types.summary) {
      const open = educators().map(e => ({ e, items: openFor(e, when, S).filter(i => i.t !== 'obs' && i.t !== 'conf' && i.t !== 'confform') })).filter(x => x.items.length);
      const body = open.length ? open.map(x => `${x.e.name}, ${x.items.map(i => i.text.replace(/^Finish /, '').replace(/^This week's /, '').toLowerCase()).join('; ')}`).join('\n') : 'Every educator\'s planning is done for this week.';
      const dirs = [...accounts.list].filter(a => isDirector(a.name)).map(a => a.name);
      for (const d of dirs) await sendTo(d, { title: open.length ? `TREE, ${open.length} educator${open.length > 1 ? 's' : ''} still planning` : 'TREE, planning is done', body, url: 'tree.html?go=reminders', tag: 'tree-summary' });
    }
    log('Reminders,', kind, res.length, 'educators reminded');
    return res;
  }
  async function tick() {
    if (busy || !store.ready || !accounts.loaded || !keys()) return; busy = true;
    try {
      ensureStart(); const when = nowLA(); if (when.dow < 1 || when.dow > 5) return; const R = runs();
      if (when.mins >= 8 * 60 && when.mins < 11 * 60 && R.morning !== when.day) { markRun('morning', when.day); await sendRound('morning', when); }
      if (when.dow === 1 && when.mins >= 16 * 60 && when.mins < 19 * 60 && R.evening !== when.day) { markRun('evening', when.day); await sendRound('evening', when); }
    } catch (e) { log('Reminder round failed,', e.message); } finally { busy = false; }
  }
  setInterval(tick, 60e3); setTimeout(tick, 20e3);

  // ---------- when the director reviews a plan or leaves a note ----------
  // the educator hears a few minutes after the director stops typing, once, so a note written over several minutes is one message
  const reviewTimers = new Map();
  function planReviewed(id, before, doc) {
    if (!doc || doc.id === 'example') return;
    const reviewedNow = doc.status === 'reviewed' && (!before || before.status !== 'reviewed');
    const noteNow = filled(doc.feedback) && (!before || String(before.feedback || '') !== String(doc.feedback || ''));
    if (!reviewedNow && !noteNow) return;
    const was = reviewTimers.get(id) || { reviewed: false, note: false };
    clearTimeout(was.t);
    const next = { reviewed: was.reviewed || reviewedNow, note: was.note || noteNow };
    next.t = setTimeout(() => { reviewTimers.delete(id); sendReviewed(id, next).catch(e => log('Review notice not sent,', e.message)); }, 4 * 60000);
    if (next.t.unref) next.t.unref();
    reviewTimers.set(id, next);
  }
  async function sendReviewed(id, what) {
    const S = settings(); if (!S.types.reviewed || !keys()) return;
    const r = store.recs.plans.get(id); const p = r && !r.deleted ? r.doc : null; if (!p) return;
    const kind = p.type === 'classroom' ? 'Classroom' : 'Individual';
    const people = educators().filter(e => nameIn(p.educator, e.name) && !personOf(S, e.name).paused && !(personOf(S, e.name).off || []).includes('reviewed'));
    const reviewed = what.reviewed && p.status === 'reviewed', note = what.note && filled(p.feedback);
    if (!reviewed && !note) return;
    const body = reviewed && note ? `The director reviewed your ${kind} plan and left a note.` : reviewed ? `The director reviewed your ${kind} plan.` : `The director left a note on your ${kind} plan.`;
    for (const e of people) await sendTo(e.name, { title: 'TREE', body, url: `tree.html?plan=${encodeURIComponent(id)}`, tag: 'tree-review-' + id });
  }

  // ---------- for the director's page ----------
  function status() {
    const S = settings(); const when = Object.assign(nowLA(), { force: true });
    return { ready: !!keys(), key: keys() ? keys().pub : '', settings: S, types: TYPES, educators: educators().map(e => {
      const a = accountFor(e.name) || {}; const lg = a.pushLog || {};
      return { name: e.name, room: e.room, plans: planEvery(S, e.name), phones: (a.push || []).length, lastOk: lg.lastOk || 0, lastFail: lg.lastFail || 0, why: lg.why || '', signIn: !!a.name, open: openFor(e, when, S).map(i => i.text) };
    }) };
  }
  return { keys, subscribe, sendTo, status, tick, encrypt, vapidHeader, TYPES, planReviewed };
};
