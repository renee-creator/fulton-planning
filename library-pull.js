'use strict';
/* The library check, run by TREE itself (November 21, 2026).
   TREE signs in to the director's Sonoma County Library account with her card number and PIN, kept only in Render,
   places the holds for the books in the book bag with pickup at the Northwest BiblioBox, and reads her holds and
   checkouts so each book in the bag takes the step the library shows. It is the same check the scheduled run in her
   Chrome made, done by the server, so the library never needs to stay signed in on her computer.

   Sonoma County Library uses BiblioCommons, which has no published way for programs to connect. TREE talks to the
   same address the library's own catalog pages use, gateway.bibliocommons.com, the way a browser would. If the library
   changes how its site works, the check stops with the reason, the bag says so, and nothing in the bag is lost.

   It runs three times a day, around 7 in the morning, 1 in the afternoon and 7 in the evening, Pacific time, and the
   director can run it now from the bag with Check the library now. It never cancels a hold, renews, pays a fee or
   changes the account.

   Render settings
     LIBRARY_CARD     the director's library card number, typed in Render by the director and never written anywhere else
     LIBRARY_PIN      its PIN, typed in Render the same way
     LIBRARY_PICKUP   optional, the pickup place by its name at the library. Northwest BiblioBox to start
   Records
     staff/library/bookbag.json   the bag, with what the last check found under sync and how it went under check */

const LIB_ID = 'sonoma';
const PRINT = /^(BK|BOOK|BOARD_?BK|BOARD_?BOOK|PICTURE_?BK|PICTURE_?BOOK|LPRINT|LARGEPRINT|LARGE_PRINT)$/i;
const NOT_PRINT = /E_?BOOK|EBK|AUDIO|^AB$|_AB$|EAUDIO|DVD|BLURAY|VIDEO|MUSIC|^CD$|KIT|GAME|MAG|SERIAL|EQUIPMENT/i;
const WITH_AUDIO = /BK_?CD|BOOK_?CD|BK_?AB|READALONG|BOOK_?PLUS|BOOK_WITH/i;

module.exports = function libraryPull({ bag, log, fetchImpl }) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const GATEWAY = () => String(process.env.LIBRARY_GATEWAY || 'https://gateway.bibliocommons.com').replace(/\/+$/, '') + '/v2/libraries/' + LIB_ID;
  const CATALOG = () => String(process.env.LIBRARY_CATALOG || `https://${LIB_ID}.bibliocommons.com`).replace(/\/+$/, '');
  const CARD = () => String(process.env.LIBRARY_CARD || '').replace(/\s+/g, '');
  const PIN = () => String(process.env.LIBRARY_PIN || '').trim();
  const PICKUP = () => String(process.env.LIBRARY_PICKUP || 'Northwest BiblioBox').trim();
  const configured = () => !!(CARD() && PIN());
  let running = null;

  // anything inside a reply, looked for by its key, wherever the reply keeps it
  function deep(o, key, seen = new Set()) {
    if (!o || typeof o !== 'object' || seen.has(o)) return undefined; seen.add(o);
    if (Object.prototype.hasOwnProperty.call(o, key) && o[key] !== null && o[key] !== undefined && o[key] !== '') return o[key];
    for (const v of Object.values(o)) { const r = deep(v, key, seen); if (r !== undefined) return r; }
    return undefined;
  }
  const cookiesOf = res => { const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
    const out = {}; for (const line of raw) for (const part of String(line).split(/,(?=\s*[A-Za-z0-9_.-]+=)/)) { const m = part.trim().match(/^([^=;\s]+)=([^;]*)/); if (m) out[m[1]] = m[2]; } return out; };

  async function call(s, method, path, { query, body } = {}) {
    const url = new URL(GATEWAY() + path); for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const headers = { Accept: 'application/json', 'User-Agent': 'TREE, Fulton Community School' };
    if (body) headers['Content-Type'] = 'application/json';
    if (s && s.sessionId && s.authToken) { headers['X-Session-Id'] = s.sessionId; headers['X-Access-Token'] = s.authToken; }
    if (s && s.cookies && Object.keys(s.cookies).length) headers.Cookie = Object.entries(s.cookies).map(([k, v]) => k + '=' + v).join('; ');
    const res = await doFetch(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30e3) });
    let json = null; const text = await res.text(); try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    return { status: res.status, json, res };
  }
  const failText = j => { const f = j && Array.isArray(j.failures) && j.failures[0]; const d = f && (f.errorResponseDTO || f);
    return String((d && (d.message || d.errorMessage || d.code)) || (j && (j.message || j.error && (j.error.message || j.error))) || '').slice(0, 200); };

  // signs in with the card and PIN, and finds the account the holds belong to
  async function signIn() {
    const r = await call(null, 'POST', '/sessions', { body: { username: CARD(), password: PIN(), destination: '' } });
    const cookies = cookiesOf(r.res);
    if (r.status === 401 || r.status === 403) throw new Error('The library did not accept the card number and PIN on Render. Check LIBRARY_CARD and LIBRARY_PIN.');
    let s = r.status < 300 ? { sessionId: String(deep(r.json, 'sessionId') || cookies.session_id || ''), authToken: String(deep(r.json, 'authToken') || deep(r.json, 'accessToken') || cookies.bc_access_token || ''), cookies } : null;
    let first = s && s.sessionId && s.authToken ? r.json : null;
    // the library's own Log In page, the way a browser signs in, when the quicker way does not answer
    if (!first) { s = await formSignIn(); if (!s) throw new Error(`The library would not sign in (${r.status}${failText(r.json) ? ', ' + failText(r.json) : ''}). The library may have changed its site.`); }
    let acct = accountIn(first);
    if (!acct) { const me = await call(s, 'GET', '/sessions/current'); acct = accountIn(me.json); }
    if (!acct) throw new Error('The library signed in, but TREE could not find the account for the holds.');
    s.accountId = acct; return s;
  }
  async function formSignIn() {
    try {
      const page = await doFetch(CATALOG() + '/user/login', { redirect: 'manual', signal: AbortSignal.timeout(30e3) });
      const jar = cookiesOf(page); const html = await page.text();
      const tok = (html.match(/name="authenticity_token"[^>]*value="([^"]+)"/) || [])[1]; if (!tok) return null;
      const form = new URLSearchParams({ utf8: '\u2713', authenticity_token: tok, name: CARD(), user_pin: PIN(), remember_me: 'true', local: 'false' });
      const res = await doFetch(CATALOG() + '/user/login', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30e3),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') }, body: form.toString() });
      Object.assign(jar, cookiesOf(res)); await res.text().catch(() => '');
      if (!jar.session_id || !jar.bc_access_token) { if (res.status < 400 && /login/i.test(String(res.headers.get('location') || ''))) throw new Error('The library did not accept the card number and PIN on Render. Check LIBRARY_CARD and LIBRARY_PIN.'); return null; }
      return { sessionId: jar.session_id, authToken: jar.bc_access_token, cookies: jar };
    } catch (e) { if (/did not accept/.test(e.message)) throw e; return null; }
  }
  function accountIn(j) { if (!j) return '';
    const accts = j.entities && j.entities.accounts; if (accts && typeof accts === 'object') { const k = Object.keys(accts)[0]; if (k) return String((accts[k] && accts[k].id) || k); }
    const users = j.entities && j.entities.users; if (users && typeof users === 'object') for (const u of Object.values(users)) { const a = u && (u.accounts || u.accountIds); if (Array.isArray(a) && a.length) return String(typeof a[0] === 'object' ? a[0].id : a[0]); }
    const a = deep(j, 'accountId') || deep(j, 'currentAccountId'); return a ? String(a) : ''; }

  const titleOf = (j, x) => { const bibs = (j && j.entities && j.entities.bibs) || {}; const id = x.metadataId || (x.bib && (x.bib.id || x.bib.metadataId)) || x.bibId;
    const b = bibs[id]; const t = (b && b.briefInfo && b.briefInfo.title) || (x.bib && x.bib.briefInfo && x.bib.briefInfo.title) || x.bibTitle || x.title || '';
    return { id: String(id || ''), title: String(t) }; };
  const dayOf = v => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : ''; };

  async function pages(s, path, kind, extra) { const all = []; for (let page = 1; page <= 5; page++) {
    const r = await call(s, 'GET', path, { query: Object.assign({ accountId: s.accountId, size: 100, page }, extra || {}) });
    if (r.status === 401 || r.status === 403) throw new Error('The library signed TREE out while it read the ' + kind + '.');
    if (r.status >= 300) throw new Error(`The library would not show the ${kind} (${r.status}).`);
    const ent = (r.json && r.json.entities && r.json.entities[kind]) || {}; const L = Object.values(ent); all.push(...L.map(x => Object.assign({}, x, titleOf(r.json, x))));
    const pg = deep(r.json, 'pagination'); if (!L.length || !pg || !(pg.pages > page)) break; } return all; }

  // what is on the card now. A hold ready to pick up is ready, and the rest are waiting.
  async function readCard(s) {
    const holds = (await pages(s, '/holds', 'holds')).filter(h => !/CANCEL|EXPIRED/i.test(String(h.status || '')))
      .map(h => ({ title: h.title, id: h.id, ready: /READY/i.test(String(h.status || '')) }));
    const out = (await pages(s, '/checkouts', 'checkouts')).filter(c => !/RETURNED|CHECKED_IN/i.test(String(c.status || '')))
      .map(c => ({ title: c.title, id: c.id, due: dayOf(c.dueDate || c.due) }));
    return { holds, out };
  }

  // the pickup place, read from the library's own list by its name, with the Northwest BiblioBox's code to fall back on
  async function pickupCode() {
    try { const r = await call(null, 'GET', '/locations', { query: { limit: 200 } });
      const L = Object.values((r.json && r.json.entities && r.json.entities.locations) || {});
      const hit = L.find(x => String(x.name || '').toLowerCase() === PICKUP().toLowerCase()); if (hit && hit.code) return String(hit.code); } catch (e) { /* the catalog page below */ }
    try { const res = await doFetch(CATALOG() + '/v2/search?query=book&searchType=smart', { signal: AbortSignal.timeout(30e3) }); const h = await res.text();
      const want = PICKUP().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const m = h.match(new RegExp('\\{"code":"([^"]+)","name":"' + want + '"', 'i')); if (m) return m[1]; } catch (e) { /* the code below */ }
    if (/^northwest bibliobox$/i.test(PICKUP())) return '18';
    throw new Error('TREE could not find the pickup place ' + PICKUP() + ' at the library.');
  }

  // the print copy of a book, matched by its title, a Book, Board book or Picture book, and a Book with audio only
  // when it is the only print copy
  async function findPrint(s, title, author) {
    const r = await call(s, 'GET', '/bibs/search', { query: { query: [title, author].filter(Boolean).join(' '), searchType: 'smart' } });
    if (r.status >= 300) throw new Error('The library search did not answer.');
    const bibs = (r.json && r.json.entities && r.json.entities.bibs) || {};
    const order = []; const res = r.json && r.json.catalogSearch && r.json.catalogSearch.results;
    if (Array.isArray(res)) for (const x of res) { const id = x && (x.representative || x.id || x.metadataId); if (id && bibs[id] && !order.includes(id)) order.push(id); }
    for (const id of Object.keys(bibs)) if (!order.includes(id)) order.push(id);
    const ok = order.map(id => bibs[id]).filter(b => b && b.briefInfo && bag.same(b.briefInfo.title, title) && (!b.policy || (b.policy.materialType || 'PHYSICAL') === 'PHYSICAL') && (!b.policy || b.policy.holdable !== false));
    const fmt = b => String(b.briefInfo.format || '');
    return ok.find(b => PRINT.test(fmt(b)) || (!NOT_PRINT.test(fmt(b)) && !WITH_AUDIO.test(fmt(b)) && (b.briefInfo.superFormats || []).includes('BOOKS')))
      || ok.find(b => WITH_AUDIO.test(fmt(b))) || null;
  }

  async function place(s, bib, branch) {
    const r = await call(s, 'POST', '/holds', { body: { metadataId: bib.id || bib.briefInfo.metadataId, materialType: 'PHYSICAL', accountId: s.accountId, enableSingleClickHolds: false,
      materialParams: { branchId: branch, errorMessageLocale: 'en-US' } } });
    const failed = r.json && Array.isArray(r.json.failures) && r.json.failures.length;
    if (r.status >= 300 || failed) return { ok: false, why: failText(r.json) || 'the library said no (' + r.status + ')' };
    return { ok: true };
  }

  async function run(why) {
    if (running) return running;
    running = (async () => {
      const at = Date.now();
      if (!configured()) { bag.checked({ at, ok: false, error: 'LIBRARY_CARD and LIBRARY_PIN are not both set on Render.', why }); return null; }
      try {
        const s = await signIn();
        let card = await readCard(s);
        // a book marked requested with no hold goes back in the bag first, so this check places it
        bag.sync({ holds: card.holds, out: card.out, missed: [] });
        const want = bag.toPlace(); const placed = [], missed = [], ids = [];
        let branch = null;
        for (const b of want) {
          if (card.holds.some(h => bag.same(h.title, b.title)) || card.out.some(h => bag.same(h.title, b.title))) { placed.push(b.title); ids.push(b.id); continue; }
          try { const bib = await findPrint(s, b.title, b.author);
            if (!bib) { missed.push(b.title + ' (no print copy found)'); continue; }
            branch = branch || await pickupCode();
            const r = await place(s, bib, branch);
            if (r.ok) { placed.push(b.title); ids.push(b.id); } else missed.push(b.title + ' (' + r.why + ')');
          } catch (e) { missed.push(b.title + ' (' + e.message + ')'); }
        }
        if (ids.length) bag.mark(ids, 'requested');
        if (want.length) card = await readCard(s);
        bag.sync({ holds: card.holds, out: card.out, missed });
        bag.checked({ at, ok: true, placed, why });
        log('Library check', why, 'placed', placed.length, 'missed', missed.length, 'holds', card.holds.length, 'out', card.out.length);
        return { placed, missed, holds: card.holds.length, out: card.out.length };
      } catch (e) { bag.checked({ at, ok: false, error: String(e.message || e).slice(0, 300), why }); log('Library check could not run', e.message); return null; }
    })();
    try { return await running; } finally { running = null; }
  }

  // three times a day, Pacific time, once in each window
  const laHour = () => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  function tick() { if (!configured() || process.env.LIBRARY_CHECK_OFF || (bag.ready && !bag.ready())) return; const h = laHour(); const slot = h >= 19 ? 3 : h >= 13 ? 2 : h >= 7 ? 1 : 0; if (!slot) return;
    const last = bag.lastCheck(); const lastSlotKey = last && last.slot; const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()) + '-' + slot;
    if (lastSlotKey === key) return; bag.slot(key); run('scheduled').catch(() => {}); }
  function start() { setInterval(tick, 15 * 60e3).unref(); setTimeout(tick, 2 * 60e3).unref(); }

  return { run, start, configured, tick };
};
