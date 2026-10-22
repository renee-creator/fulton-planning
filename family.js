'use strict';
/* The Family page. Families sign in with an email on file and a six-digit code, and see only their own children.
   They find ways to take part, log what they did, choose which child it counts for, and see each child's hours.
   Records live under participation/ in the school's records. config holds test mode and the testers.
   While test mode is on, only a tester's email signs in, linked by the director to real children, nothing is emailed,
   the code shows on the page, and everything made is marked test so it can be cleared before going live.
   A family's sign-in is signed differently from a staff sign-in, so it never opens anything on the staff side. */
const crypto = require('crypto');

module.exports = function family({ store, log, sign, noteChange, scheduleSave, mailCode }) {
  const KIND = 'participation';
  const recs = () => store.recs[KIND];
  const cfg = () => { const r = recs().get('config'); const d = r && !r.deleted && r.doc ? r.doc : {}; return { test: d.test !== false, goal: Number(d.goal) > 0 ? Number(d.goal) : 10, testers: Array.isArray(d.testers) ? d.testers : [] }; };
  const norm = e => String(e || '').trim().toLowerCase();
  const okEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);
  const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const nowIso = () => new Date().toISOString();
  const newId = p => p + '-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

  // the school year runs from August, so hours start fresh each August
  function yearStart(d) { const t = d ? new Date(d) : new Date(); const y = t.getMonth() >= 7 ? t.getFullYear() : t.getFullYear() - 1; return y + '-08-01'; }
  const hoursOf = minutes => Math.max(1, Math.ceil((Number(minutes) || 0) / 60));   // each entry rounds up to the next whole hour

  // ---------- who a family is ----------
  function childrenFor(email) {
    const e = norm(email); const c = cfg(); const out = [];
    if (c.test) {
      const t = c.testers.find(x => norm(x.email) === e); if (!t) return { kids: [], test: true };
      for (const id of t.children || []) { const r = store.recs.children.get(id); if (r && !r.deleted && r.doc && r.doc.status !== 'withdrawn') out.push(Object.assign({ id }, r.doc)); }
      return { kids: out, test: true };
    }
    for (const [id, r] of store.recs.children) { const k = r.doc; if (r.deleted || !k || k.status === 'withdrawn') continue; if ((k.parents || []).some(p => norm(p && p.email) === e)) out.push(Object.assign({ id }, k)); }
    return { kids: out, test: false };
  }

  // ---------- codes and sign-in ----------
  const codes = new Map(); const tries = new Map();
  function tooMany(key, max) { const now = Date.now(); const t = tries.get(key) || { n: 0, until: now + 15 * 60000 }; if (t.until < now) { t.n = 0; t.until = now + 15 * 60000; } t.n++; tries.set(key, t); return t.n > max; }
  async function sendCode(email, ip) {
    const e = norm(email); if (!okEmail(e)) return { error: 'Type the email address the school has for you.' };
    if (tooMany('c|' + e, 5) || tooMany('i|' + ip, 30)) return { error: 'Too many codes asked for. Wait fifteen minutes and try again.' };
    const { kids, test } = childrenFor(e);
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    if (kids.length) codes.set(e, { hash: crypto.createHash('sha256').update(code).digest('hex'), until: Date.now() + 15 * 60000, n: 0 });
    if (test) {
      // test mode emails no one. A tester sees the code here, and anyone else is told plainly the page is not open yet
      if (!kids.length) return { error: 'The Family page is not open yet.' };
      return { ok: true, test: true, code };
    }
    if (kids.length) { try { await mailCode(e, code); } catch (er) { log('Family code not sent,', er.message); return { error: 'The code could not be sent just now. Try again in a few minutes.' }; } }
    // the same answer whether or not the email is on file, so the page never tells a stranger who is enrolled
    return { ok: true };
  }
  function signIn(email, code, ip) {
    const e = norm(email); const c = codes.get(e);
    if (tooMany('s|' + ip, 40)) return { error: 'Too many tries. Wait fifteen minutes.' };
    if (!c || c.until < Date.now()) return { error: 'That code has expired. Ask for a new one.' };
    c.n++; if (c.n > 6) { codes.delete(e); return { error: 'Too many wrong codes. Ask for a new one.' }; }
    const h = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (h.length !== c.hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(c.hash))) return { error: 'That code does not match. Check the newest one.' };
    codes.delete(e);
    const body = b64u(JSON.stringify({ fam: e, e: Date.now() + 120 * 864e5, t: cfg().test ? 1 : 0 }));
    log('Family signed in', cfg().test ? '(test mode)' : '');
    return { token: body + '.' + sign('family|' + body) };
  }
  function readFamily(req) {
    const h = String(req.headers.authorization || ''); const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!tok || tok.length > 600) return null; const [body, mac] = tok.split('.'); if (!body || !mac) return null;
    const want = sign('family|' + body); if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
    let s; try { s = JSON.parse(unb(body)); } catch (e) { return null; }
    if (!s || typeof s.fam !== 'string' || !(s.e > Date.now())) return null;
    // a sign-in made in test mode ends when test mode ends, and a family's ends if test mode is turned back on
    if (!!s.t !== cfg().test) return null;
    const { kids, test } = childrenFor(s.fam); if (!kids.length) return null;
    return { email: s.fam, kids, test };
  }

  // ---------- what a family sees ----------
  const items = () => [...recs().values()].filter(r => !r.deleted && r.doc && r.doc.kind === 'item').map(r => r.doc);
  const logs = () => [...recs().values()].filter(r => !r.deleted && r.doc && r.doc.kind === 'log' && !r.doc.removed).map(r => r.doc);
  const firstOf = k => k.first || 'Your child';
  function familyView(f) {
    const c = cfg(); const ys = yearStart(); const ids = new Set(f.kids.map(k => k.id)); const today = new Date().toISOString().slice(0, 10);
    const mine = logs().filter(l => ids.has(l.childId) && (l.date || '') >= ys && !!l.test === f.test);
    const hours = f.kids.map(k => ({ id: k.id, first: firstOf(k), classroom: k.classroom || '', hours: mine.filter(l => l.childId === k.id).reduce((a, l) => a + (Number(l.hours) || 0), 0), goal: c.goal }));
    const open = items().filter(it => it.open !== false && !!it.test === f.test && (!it.date || it.date >= today) && (!it.classroom || f.kids.some(k => k.classroom === it.classroom)))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
      .map(it => { const ss = it.signups || []; return { id: it.id, type: it.type, title: it.title, note: it.note || '', date: it.date || '', start: it.start || '', end: it.end || '', hours: Number(it.hours) || 0, spots: Number(it.spots) || 0, taken: ss.length, mine: ss.some(s => s.email === f.email) }; });
    // what this family signed up for that has happened and is not logged yet, so logging it is one tap
    const signed = items().filter(it => !!it.test === f.test && (it.signups || []).some(s => s.email === f.email) && it.date && it.date <= today && it.date >= ys && !mine.some(l => l.itemId === it.id))
      .map(it => ({ id: it.id, title: it.title, date: it.date, hours: Number(it.hours) || 0, type: it.type }));
    const entries = mine.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(l => ({ id: l.id, what: l.what, date: l.date, hours: l.hours, child: firstOf(f.kids.find(k => k.id === l.childId) || {}), childId: l.childId, mine: l.email === f.email }));
    return { test: f.test, goal: c.goal, children: hours, open, signed, entries, yearFrom: ys };
  }

  function save(id, doc) { const cur = recs().get(id); recs().set(id, { doc, sha: cur && cur.sha, path: `${KIND}/${id}.json`, local: true }); noteChange(KIND, id); scheduleSave(KIND, id); }

  function signUp(f, itemId, on) {
    const r = recs().get(itemId); const it = r && !r.deleted && r.doc; if (!it || it.kind !== 'item' || !!it.test !== f.test) return { error: 'That is no longer open.' };
    const ss = (it.signups || []).filter(s => s.email !== f.email);
    if (on) { if (it.open === false) return { error: 'That is no longer open.' }; if (Number(it.spots) > 0 && ss.length >= Number(it.spots)) return { error: 'Every spot is taken.' };
      const names = [...new Set(f.kids.map(k => [k.first, k.last].filter(Boolean).join(' ')))].join(' and ');
      ss.push({ email: f.email, family: names, at: nowIso() }); }
    save(itemId, Object.assign({}, it, { signups: ss, updatedAt: nowIso() })); return { ok: true };
  }
  function addLog(f, b) {
    const kid = f.kids.find(k => k.id === b.childId); if (!kid) return { error: 'Choose which child this counts for.' };
    let what = String(b.what || '').trim().slice(0, 200), itemId = '', date = String(b.date || '').slice(0, 10), minutes = Number(b.minutes) || 0;
    if (b.itemId) { const r = recs().get(b.itemId); const it = r && !r.deleted && r.doc; if (!it || it.kind !== 'item') return { error: 'That is no longer listed.' }; itemId = it.id; what = what || it.title; date = date || it.date; if (!minutes) minutes = (Number(it.hours) || 1) * 60; }
    if (!what) return { error: 'Say what you did.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) return { error: 'Choose the day, today or earlier.' };
    if (!(minutes > 0) || minutes > 24 * 60) return { error: 'Say how long it took.' };
    const id = newId('lg');
    save(id, { id, kind: 'log', email: f.email, childId: kid.id, itemId, what, date, minutes, hours: hoursOf(minutes), test: f.test, at: nowIso() });
    return { ok: true };
  }
  function removeLog(f, id) {
    const r = recs().get(id); const l = r && !r.deleted && r.doc; if (!l || l.kind !== 'log' || l.email !== f.email) return { error: 'That entry is not yours to change.' };
    save(id, Object.assign({}, l, { removed: true, removedBy: 'family', removedAt: nowIso() })); return { ok: true };
  }

  // ---------- the public page, no sign-in ----------
  // the month's menu and the month before's Farm to School story, from the menus and FEED bins the staff already keep.
  // Families get the menu before the month starts, so the farms are counted from the month before.
  function publicMenu(month) {
    const now = new Date(); const m = /^\d{4}-\d{2}$/.test(month || '') ? month : now.toISOString().slice(0, 7);
    const mr = store.recs.menus.get(m); const menu = mr && !mr.deleted && mr.doc ? { month: m, days: mr.doc.days || {}, notes: mr.doc.notes || {}, times: mr.doc.times || {} } : null;
    const d = new Date(m + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); const prev = d.toISOString().slice(0, 7);
    const farms = {}; let bins = 0;
    for (const [id, r] of store.recs.bins) { const b = r.doc; if (r.deleted || !b || !/^\d{4}-\d{2}-\d{2}$/.test(id) || id.slice(0, 7) !== prev) continue; bins++;
      for (const it of b.items || []) for (const f of it.farms || []) { const k = String(f).trim(); if (!k) continue; (farms[k] = farms[k] || []).push(it.name); } }
    const fr = store.recs.bins.get('farms'); const towns = fr && !fr.deleted && fr.doc && fr.doc.towns ? fr.doc.towns : {};
    const months = [...store.recs.menus.keys()].filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    return { menu, prev, bins, farms, towns, months, grantEnd: '2027-06-30' };
  }

  return { sendCode, signIn, readFamily, familyView, signUp, addLog, removeLog, publicMenu, cfg, hoursOf, yearStart };
};
