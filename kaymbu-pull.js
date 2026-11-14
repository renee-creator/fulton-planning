'use strict';
/* Kaymbu Moments, brought in straight from Kaymbu.
   TREE signs in to Kaymbu with the school's own TREE login and reads the Moments educators publish, the same list the
   Moments page in Kaymbu shows. Each Moment comes into TREE as an observation with its photo, title and note, its class,
   the day the photo was taken, and the children tagged in it in Kaymbu, matched to TREE's children by first and last name.
   The photos of one Kaymbu post become one observation with several photos, the way a post shared by email does.

   Every hour TREE reads the Moments published since its last look, and a few days before that, so a child tagged in
   Kaymbu after the post went out still reaches TREE. A photo TREE already holds, from an email or an earlier look, is
   never brought in twice. It is matched by the photo's own name, keeps everything an educator wrote or changed in TREE,
   and only fills in children where nobody has tagged any yet. A child tagged only in Kaymbu is offered to add with a tap.

   Before a Moment comes in, the screener looks at it. Nothing is deleted. A Moment the screener holds back is set aside
   with the reason, for the director to look over in Settings and bring back with Put it back. The screener sets aside
     a photo with no words and no children tagged,
     a photo taken before the school year,
     a photo too dark or too blurred to read,
     a photo nearly the same as another in its post, keeping the clearest,
     and, only for a photo with words but no children tagged, one TREE's quick lane reads as a sign, a menu, a flyer, a
     calendar, a sign-up sheet, a screenshot or a picture from outside school.
   A photo with no words of its own joins its post's observation when another photo of that post has words.

   The look back reads the Moments published since the start of the school year. It first counts what it would bring in
   and what that would cost, and runs only after the director says yes, in small parts in the evening, at night and on
   weekends, so TREE stays quick during the school day. Its observations come in quietly, never as Just shared from
   Kaymbu on Today, and threads are left for the week's reading. Videos go to Video clips and become draft observations.

   Render settings
     KAYMBU_EMAIL      the TREE login for Kaymbu, tree@childfamilycommunity.com
     KAYMBU_PASSWORD   its password, typed in Render by the director and never written anywhere else
   Records
     kaymbu/state.json      where the hourly look and the look back have reached
     kaymbu/a<id>.json      a Moment the screener set aside */
const https = require('https');
const crypto = require('crypto');

module.exports = function kaymbuPull({ store, log, kaymbu, noteChange, scheduleSave, askClaude, video, onPost }) {
  let sharp = null; try { sharp = require('sharp'); } catch (e) { sharp = null; }
  const HOST = 'my.kaymbu.com';
  const MEDIA = 'https://d2k9f6tk478nyp.cloudfront.net';
  const EMAIL = () => String(process.env.KAYMBU_EMAIL || '').trim();
  const PASSWORD = () => String(process.env.KAYMBU_PASSWORD || '');
  const configured = () => !!(EMAIL() && PASSWORD());
  const SINCE_DEFAULT = String(process.env.KAYMBU_SINCE || '2026-08-15');
  const LOOKBACK_PER_HOUR = Number(process.env.KAYMBU_LOOKBACK_PER_HOUR) || 250;
  const OVERLAP_MS = 3 * 864e5;                 // the hourly look reads three days before its last look, for late tags
  // what the estimate counts each request as, at the quick lane's prices on Render, and a Gemini read of a short video
  const COST = { sort: 0.006, screen: 0.006, video: 0.02 };

  const laDay = kaymbu.laDay, mondayOf = kaymbu.mondayOf;
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const clean = s => String(s || '').replace(/[￼​]/g, '').replace(/[ \t]+\n/g, '\n').trim();
  const live = kind => [...store.recs[kind].values()].filter(r => r && !r.deleted && r.doc).map(r => r.doc);
  // midnight in Los Angeles at the start of a day, as a moment in time
  function laMidnight(day) { const [y, m, d] = day.split('-').map(Number); let t = Date.UTC(y, m - 1, d, 8);
    const h = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric' }).format(new Date(t)); return t - h * 36e5; }

  /* ---------- records ---------- */
  function stateDoc() { const r = store.recs.kaymbu.get('state'); return (r && !r.deleted && r.doc) || { id: 'state' }; }
  function saveState(patch) { const d = Object.assign({}, stateDoc(), patch, { id: 'state', savedAt: Date.now() });
    store.recs.kaymbu.set('state', Object.assign({}, store.recs.kaymbu.get('state') || {}, { doc: d, path: 'kaymbu/state.json', local: true })); noteChange('kaymbu', 'state'); scheduleSave('kaymbu', 'state'); return d; }
  function since() { const s = stateDoc().lookback; return (s && /^\d{4}-\d{2}-\d{2}$/.test(s.since || '') ? s.since : SINCE_DEFAULT); }
  function saveAside(doc) { store.recs.kaymbu.set(doc.id, Object.assign({}, store.recs.kaymbu.get(doc.id) || {}, { doc, path: `kaymbu/${doc.id}.json`, local: true })); noteChange('kaymbu', doc.id); scheduleSave('kaymbu', doc.id); }

  /* ---------- talking with Kaymbu ---------- */
  let cookies = new Map();
  const cookieHeader = () => [...cookies].map(([k, v]) => k + '=' + v).join('; ');
  function request(method, path, body) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? null : JSON.stringify(body);
      const req = https.request({ hostname: HOST, path, method, headers: Object.assign({ 'User-Agent': 'TREE (Fulton Community School)', Accept: 'application/json', headless: '0' },
        data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}, cookies.size ? { Cookie: cookieHeader() } : {}) }, res => {
        for (const c of [].concat(res.headers['set-cookie'] || [])) { const m = String(c).match(/^([^=;\s]+)=([^;]*)/); if (m) { if (/expires=Thu, 01 Jan 1970/i.test(c) || m[2] === '') cookies.delete(m[1]); else cookies.set(m[1], m[2]); } }
        const chunks = []; res.on('data', c => chunks.push(c));
        res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (e) {} resolve({ status: res.statusCode, json, text }); });
        res.on('error', reject);
      });
      req.setTimeout(60000, () => req.destroy(new Error('Kaymbu did not answer in time')));
      req.on('error', reject); if (data) req.write(data); req.end();
    });
  }
  async function login() {
    if (!configured()) throw new Error('KAYMBU_EMAIL and KAYMBU_PASSWORD are not both set on Render');
    cookies = new Map();
    const a = await request('POST', '/api/login/identify', { email: EMAIL() });
    if (a.status !== 200) throw new Error('Kaymbu did not know the TREE login (' + a.status + ')');
    const b = await request('POST', '/api/login/authenticate', { email: EMAIL(), password: PASSWORD() });
    if (b.status !== 200) throw new Error('Kaymbu did not accept the TREE login' + (b.json && b.json.message ? '. ' + String(b.json.message).slice(0, 120) : ' (' + b.status + ')'));
    const s = await request('GET', '/api/session');
    if (!(s.json && s.json.isLoggedIn)) throw new Error('Kaymbu signed in but did not open a session');
    log('Signed in to Kaymbu as the TREE login');
  }
  // a request that signs in first when Kaymbu has forgotten TREE, and once more when the session ran out
  async function api(method, path, body) {
    if (!cookies.size) await login();
    let r = await request(method, path, body);
    if (r.status === 401 || r.status === 403 || (r.status === 200 && r.json === null)) { await login(); r = await request(method, path, body); }
    if (r.status !== 200 || r.json === null) throw new Error('Kaymbu answered ' + r.status + ' for ' + path.replace(/\/[0-9a-f]{24}$/, '/...'));
    return r.json;
  }
  const gridBody = after => ({ after, sortBy: 'published', more: [], tags: [], organizations: [], centers: [], classrooms: [], students: [], internal: false });
  // the Moments published from now back to a moment in time, newest first
  async function walk(stopAt, budgetMs) {
    const out = []; let after = Date.now() + 864e5; const t0 = Date.now();
    for (let page = 0; page < 1000; page++) {
      const list = await api('POST', '/api/moments/grid', gridBody(after));
      if (!Array.isArray(list) || !list.length) break;
      out.push(...list);
      const last = list[list.length - 1]; const at = Date.parse(last.creationDate) || 0;
      if (at < stopAt) break;
      if (!last.searchAfter || last.searchAfter === after) break;
      after = last.searchAfter;
      if (budgetMs && Date.now() - t0 > budgetMs) throw new Error('Reading the list of Moments took too long');
    }
    return out.filter(m => m && m._id && (Date.parse(m.creationDate) || 0) >= stopAt);
  }

  /* ---------- reading one Moment ---------- */
  // the photo's own name, the same mark a Moment shared by email carries, so one photo is never kept twice
  function keyOf(m) {
    const p = String(m.pictureThumb || m.pictureSource || '');
    if (p) return p.split('/').pop().split('?')[0].replace(/_(thumb|display|still_overlay|still)(\.\w+)$/i, '$2');
    return 'km-' + m._id;
  }
  const mediaUrl = p => p ? (/^https?:/.test(p) ? p : MEDIA + p) : '';
  const momentWords = m => [clean(m.caption), clean(m.annotation)].filter(Boolean).join('\n');
  const capturedAt = m => { const c = Date.parse(m.dateCaptured) || 0, p = Date.parse(m.creationDate) || 0; return c && c <= p + 864e5 ? c : p; };
  function kaymbuStudents(m) {
    const info = m.studentInfo || {};
    if (Array.isArray(m.students) && m.students.length && typeof m.students[0] === 'object') return m.students.map(s => ({ first: clean(s.firstName), last: clean(s.lastName) }));
    return (m.students || []).map(id => info[id] || {}).map(s => ({ first: clean(s.firstName), last: clean(s.lastName) })).filter(s => s.first);
  }
  // Kaymbu's children matched to TREE's. A first and last name together, then a first name only one child has.
  function matchChildren(list) {
    const kids = [...store.recs.children].filter(([, r]) => r && !r.deleted && r.doc && r.doc.first && (r.doc.status || 'active') !== 'withdrawn').map(([id, r]) => Object.assign({ id }, r.doc));
    const n = s => words(s).replace(/\s/g, '');
    const ids = [], unmatched = [];
    for (const s of list) {
      const firsts = kids.filter(c => [c.first, c.preferred].some(f => f && n(f) === n(s.first)));
      let hit = s.last ? firsts.filter(c => n(c.last) === n(s.last)) : [];
      if (!hit.length && s.last) hit = kids.filter(c => n(c.last) === n(s.last) && n(c.first).startsWith(n(s.first).slice(0, 3)) && n(s.first).length >= 3);
      if (hit.length !== 1 && firsts.length === 1) hit = firsts;
      if (hit.length === 1) { if (!ids.includes(hit[0].id)) ids.push(hit[0].id); }
      else unmatched.push([s.first, s.last].filter(Boolean).join(' '));
    }
    return { ids, unmatched };
  }
  function roomOf(m) {
    const set = (store.recs.settings.get('main') || {}).doc || {};
    const rooms = Array.isArray(set.classrooms) && set.classrooms.length ? set.classrooms.map(String) : ['West', 'North', 'South'];
    const name = words(m.classroomName || (m.classroom && m.classroom.name) || '');
    return rooms.find(r => words(r) === name) || '';
  }

  /* ---------- the screener ---------- */
  // light, sharpness and a small fingerprint of the photo, read on TREE's own server from Kaymbu's small copy
  async function look(m) {
    if (!sharp || !m.pictureThumb) return null;
    try {
      const r = await kaymbu.getBuf(mediaUrl(m.pictureThumb)); if (r.status !== 200) return null;
      const g = sharp(r.buf, { failOn: 'none' }).rotate().resize(320, 320, { fit: 'inside' }).grayscale();
      const st = await g.clone().stats();
      const lap = await g.clone().convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 }).raw().toBuffer();
      let mean = 0; for (const v of lap) mean += v; mean /= lap.length; let v2 = 0; for (const v of lap) v2 += (v - mean) ** 2; v2 /= lap.length;
      const px = await sharp(r.buf, { failOn: 'none' }).rotate().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
      let hash = ''; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) hash += px[y * 9 + x] < px[y * 9 + x + 1] ? '1' : '0';
      return { light: st.channels[0].mean, sharpness: v2, hash, thumb: r.buf };
    } catch (e) { return null; }
  }
  const apart = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
  const DARK = 28, BLUR = 80, SAME = 6;
  const SCREEN_PROMPT = 'This photo was published by an educator at our preschool, with these words: "{words}". No child is tagged in it. Say whether it belongs in the school\'s documentation of children\'s learning. Keep it when it shows children at play or work, children\'s own work such as drawing, writing, building or art, words an educator wrote down as children said them, materials or a space set up for children, the garden, the animals or nature at school. Set it aside when it is mainly a sign, a menu, a flyer, a calendar, a sign-up sheet, a screenshot, a document for adults, or a picture from outside school with no children\'s learning in it. Answer only with JSON, {"keep": true or false, "why": "a short plain reason, no colons or dashes"}.';
  async function readByQuick(m, buf, text) {
    if (!askClaude || !buf) return null;
    try {
      const r = await askClaude([{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buf.toString('base64') } }, { type: 'text', text: SCREEN_PROMPT.replace('{words}', text.slice(0, 400).replace(/"/g, "'")) }], false, { max_tokens: 300 });
      if (r.status !== 200) return null;
      const j = JSON.parse(r.text); const t = (j.content || []).map(x => x.text || '').join('');
      const a = JSON.parse((t.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      return typeof a.keep === 'boolean' ? { keep: a.keep, why: String(a.why || '').replace(/[:—–]/g, ',').slice(0, 160) } : null;
    } catch (e) { log('A Kaymbu photo could not be screened', e.message); return null; }
  }
  const REASON = { nowords: 'No words and no children tagged', before: 'Taken before the school year', dark: 'Too dark to see', blurry: 'Too blurred to see', similar: 'Nearly the same as another photo in its post', notlearning: 'Not documentation of children\'s learning' };

  /* ---------- one post at a time ---------- */
  // what TREE already holds, by the photo's own name and by Kaymbu's Moment
  function holding() {
    const byKey = new Map(), byKid = new Set(), batchGroup = new Map();
    for (const [id, r] of store.recs.notices) { const d = r && !r.deleted && r.doc; if (!d || !d.kaymbu) continue;
      if (d.kaymbu.key) byKey.set(d.kaymbu.key, id);
      for (const k of [].concat(d.kaymbu.kid || [], d.kaymbu.kids || [])) byKid.add(k);
      if (d.kaymbu.batch && d.group) batchGroup.set(d.kaymbu.batch, d.group); }
    for (const [, r] of store.recs.drafts) { const f = r && !r.deleted && r.doc && r.doc.form; if (f && f.kaymbu && f.kaymbu.key) byKey.set(f.kaymbu.key, ''); }
    for (const [, r] of store.recs.clips) { const c = r && !r.deleted && r.doc; if (c && c.kaymbu) { if (c.kaymbu.key) byKey.set(c.kaymbu.key, ''); if (c.kaymbu.kid) byKid.add(c.kaymbu.kid); } }
    const aside = new Map(); for (const [id, r] of store.recs.kaymbu) { const d = r && !r.deleted && r.doc; if (d && d.kid) aside.set(d.kid, d); }
    return { byKey, byKid, batchGroup, aside };
  }
  // a photo already in TREE takes Kaymbu's children where nobody has tagged any, and offers the rest
  function merge(id, m, kids) {
    const r = store.recs.notices.get(id); const d = r && !r.deleted && r.doc; if (!d) return false;
    const k = Object.assign({}, d.kaymbu); let changed = false;
    const kidsSeen = new Set([].concat(k.kids || [], k.kid || []));
    if (!kidsSeen.has(m._id)) { k.kids = [...kidsSeen, m._id]; changed = true; }
    if (m.batchId && !k.batch) { k.batch = m.batchId; changed = true; }
    const have = (d.children || []).filter(Boolean);
    const handled = !!(d.editedBy || k.checkedBy || k.byHand);
    if (!have.length && !handled && kids.ids.length) { d.children = kids.ids.slice(); if (!kids.unmatched.length) { k.check = false; delete k.suggest; delete k.maybe; delete k.unsure; } changed = true; }
    /* Kaymbu tagging more children than TREE has is no question for the Waiting list. A photo a person has checked stays
       as that person left it, and Kaymbu's tags never reopen it. A photo nobody has checked keeps Kaymbu's other children
       as names offered on its form, without waiting on Today (November 14, 2026). */
    else if (!handled) { const extra = kids.ids.filter(x => !have.includes(x)); const offer = [...new Set([...(k.suggest || []), ...extra])].filter(x => !have.includes(x));
      if (extra.length && JSON.stringify(offer) !== JSON.stringify(k.suggest || [])) { k.suggest = offer; changed = true; } }
    if (kids.unmatched.length && JSON.stringify(kids.unmatched) !== JSON.stringify(k.unmatched || [])) { k.unmatched = kids.unmatched; changed = true; }
    if (!changed) return false;
    d.kaymbu = k; noteChange('notices', id); scheduleSave('notices', id); return true;
  }
  // a near copy of a photo that was kept is left out by itself, since the kept one is in TREE, and never waits on the
  // director's Set aside list (November 12, 2026)
  const leftOut = () => ({ status: 'accepted', acceptedAt: Date.now(), auto: true });
  function leaveNearCopies() { let n = 0;
    for (const [, r] of store.recs.kaymbu) { const d = r && !r.deleted && r.doc; if (d && d.kid && d.status === 'aside' && d.reason === 'similar') { saveAside(Object.assign({}, d, leftOut())); n++; } }
    if (n) log(`Left out ${n} near copies of kept Kaymbu photos`); return n; }
  function aside(m, reason, why, extra) {
    const id = 'a' + m._id;
    const kids = kaymbuStudents(m);
    const doc = Object.assign({ id, kid: m._id, key: keyOf(m), reason, why: why || REASON[reason] || '', thumb: mediaUrl(m.pictureThumb), video: !!m.video,
      room: roomOf(m), kaymbuClass: String(m.classroomName || ''), words: momentWords(m).slice(0, 1200), students: kids.map(s => [s.first, s.last].filter(Boolean).join(' ')),
      day: laDay(capturedAt(m)), published: Date.parse(m.creationDate) || 0, batch: m.batchId || '', internal: !!(m.isPrivate || m.internal), status: 'aside', at: Date.now() }, extra || {});
    saveAside(doc); return id;
  }

  // a post's Moments, screened, then kept or set aside. Answers what happened to each, for the log and the estimate.
  async function takePost(list, opts) {
    const o = Object.assign({ back: false, count: false, chosen: false }, opts);
    const out = { kept: 0, merged: 0, aside: 0, videos: 0, asked: 0, ids: [], reasons: {} };
    const h = o.hold || holding();
    const start = laMidnight(since());
    const batchWords = list.map(momentWords).find(Boolean) || '';
    const todo = [];
    for (const m of list) {
      const key = keyOf(m), kids = matchChildren(kaymbuStudents(m));
      if (h.byKey.has(key) || h.byKid.has(m._id)) { const id = h.byKey.get(key); if (!o.count && id && merge(id, m, kids)) out.merged++; else if (o.count) out.merged++; continue; }
      if (h.aside.has(m._id)) continue;
      todo.push({ m, key, kids, own: momentWords(m) });
    }
    if (!todo.length) return out;
    const put = (t, reason, why) => { out.aside++; out.reasons[reason] = (out.reasons[reason] || 0) + 1; if (!o.count) aside(t.m, reason, why, reason === 'similar' ? leftOut() : null); t.out = true; };
    // the rules that need no photo. A Moment the director put back skips the screener.
    for (const t of todo) {
      if (o.chosen) { t.words = t.own || batchWords; continue; }
      const words0 = t.own || batchWords;
      t.words = words0;
      if (capturedAt(t.m) < start - 864e5) { put(t, 'before', 'Taken on ' + new Date(capturedAt(t.m)).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' }) + ', before the school year'); continue; }
      if (!words0 && !t.kids.ids.length && !t.kids.unmatched.length) { put(t, 'nowords'); continue; }
    }
    // light, sharpness and near repeats, read from Kaymbu's small copies
    const photos = todo.filter(t => !t.out && !t.m.video && t.m.pictureThumb);
    // the count before the look back reads no photos, so it is quick and costs nothing
    if (!o.count) for (const t of photos) t.look = await look(t.m);
    if (!o.chosen) for (const t of photos) { if (!t.look) continue;
      if (t.look.light < DARK) put(t, 'dark'); else if (t.look.sharpness < BLUR) put(t, 'blurry'); }
    const left = o.chosen ? [] : photos.filter(t => !t.out && t.look);
    const seen = [];
    for (const t of left.sort((a, b) => b.look.sharpness - a.look.sharpness)) {
      const twin = seen.find(s => apart(s.look.hash, t.look.hash) <= SAME);
      if (twin) put(t, 'similar', REASON.similar + ', which was kept'); else seen.push(t);
    }
    // a photo with words and no children tagged is read once by the quick lane
    for (const t of todo) {
      if (o.chosen || t.out || t.m.video || t.kids.ids.length || t.kids.unmatched.length || !t.own) continue;
      out.asked++;
      if (o.count) continue;
      const a = await readByQuick(t.m, t.look && t.look.thumb, t.own);
      if (a && !a.keep) put(t, 'notlearning', a.why || REASON.notlearning);
    }
    if (o.count) { for (const t of todo) if (!t.out) { if (t.m.video) out.videos++; else out.kept++; } return out; }
    // kept. Videos go to Video clips, photos and words become observations.
    const room0 = list.map(roomOf).find(Boolean) || '';
    const batchKey = list[0].batchId || ('m' + list[0]._id);
    let group = (list[0].batchId && h.batchGroup.get(list[0].batchId)) || '';
    for (const t of todo) {
      if (t.out) continue;
      const m = t.m;
      try {
        const room = roomOf(m) || room0;
        const place = kaymbu.kidsPlace(t.kids.ids);
        const room2 = room || place.room || '';
        const sg = place.group && (!place.group.room || !room2 || place.group.room === room2) ? String(place.group.name) : '';
        // a small group's lead first. A Moment from the look back with no small group is credited to its class team, as
        // other Kaymbu moments with no educator are, and a new one waits on Today for someone to name who shared it.
        const by = kaymbu.groupLead(sg, room2) || (o.back && room2 ? room2 + ' class team' : '');
        const at = capturedAt(m), day = laDay(at);
        const mark = { v: 3, pull: 1, ...(o.back ? { back: 1 } : {}), key: t.key, kid: m._id, kids: [m._id], ...(m.batchId ? { batch: m.batchId } : {}), mail: 'kb:' + batchKey, src: mediaUrl(m.pictureSource || m.pictureThumb), dated: 'captured',
          subject: '', keptAt: o.back ? at : Date.now(), check: !t.kids.ids.length || t.kids.unmatched.length > 0, ...(t.kids.unmatched.length ? { unmatched: t.kids.unmatched } : {}), ...((m.isPrivate || m.internal) ? { internal: 1 } : {}) };
        if (m.video) {
          const d = m.videoSource || m.videoLowRendition ? m : ((await api('POST', '/api/moments/moment/' + m._id, {})) || {}).moment || m;
          const url = mediaUrl(d.videoLowRendition || d.videoSource);
          if (!url) throw new Error('Kaymbu gave no address for the video');
          await video.fromKaymbu({ url, name: [room2, 'Kaymbu video', day].filter(Boolean).join(' ') + '.mp4', room: room2, by, at, children: t.kids.ids, kaymbu: Object.assign({}, mark, { words: t.words || '' }) });
          out.videos++; h.byKey.set(t.key, ''); continue;
        }
        let photo = null;
        if (m.pictureSource || m.pictureThumb) {
          const display = mediaUrl(m.pictureSource || String(m.pictureThumb).replace(/_thumb(\.\w+)$/i, '_display$1'));
          const p = await kaymbu.bestPhoto(display);
          if (!p) throw new Error('Kaymbu would not send the photo');
          photo = { id: await kaymbu.keepPhoto(p.buf, by), w: p.w, h: p.h };
          if (t.look && t.look.thumb && t.look.thumb.length < 600 * 1024) { try { const d2 = kaymbu.size(t.look.thumb); if (d2) photo.thumb = await kaymbu.keepPhoto(t.look.thumb, by, 'thumb'); } catch (e) {} }
          mark.src = p.url;
        } else if (!t.words) continue;
        const noticed = t.words || '';
        if (!group) group = (noticed.length >= 12 ? kaymbu.postGroup(noticed, room2, day) : '') || ('kb' + crypto.createHash('sha1').update(batchKey).digest('hex').slice(0, 13));
        const id = 'n' + at.toString(36) + crypto.randomBytes(3).toString('hex');
        const doc = { id, noticed, wonder: '', classroom: room2, ...(sg ? { smallGroup: sg } : {}), ...(photo ? { group } : {}), by, at, week: mondayOf(day), projectId: '', threadId: '', children: t.kids.ids.slice(), ...(photo ? { photo } : {}), kaymbu: mark, updatedByName: by };
        store.recs.notices.set(id, { doc, path: `notices/${id}.json`, local: true }); noteChange('notices', id); scheduleSave('notices', id);
        h.byKey.set(t.key, id); h.byKid.add(m._id);
        out.kept++; out.ids.push(id);
      } catch (e) { out.failed = (out.failed || 0) + 1; out.problem = e.message; log('A Kaymbu Moment could not be brought in', e.message); }
    }
    if (out.ids.length && onPost) try { onPost(out.ids, { back: o.back }); } catch (e) { log('A Kaymbu post could not be read for its words', e.message); }
    return out;
  }
  // Moments grouped by their post, oldest post first
  function posts(list) {
    const by = new Map();
    for (const m of list) { const k = m.batchId || ('m' + m._id); if (!by.has(k)) by.set(k, []); by.get(k).push(m); }
    return [...by.values()].map(ms => ms.sort((a, b) => (a.order || 0) - (b.order || 0))).sort((a, b) => (Date.parse(a[0].creationDate) || 0) - (Date.parse(b[0].creationDate) || 0));
  }
  const add = (a, b) => { for (const k of ['kept', 'merged', 'aside', 'videos', 'asked', 'failed']) a[k] = (a[k] || 0) + (b[k] || 0); for (const [k, v] of Object.entries(b.reasons || {})) a.reasons[k] = (a.reasons[k] || 0) + v; if (b.problem) a.problem = b.problem; return a; };
  const blank = () => ({ kept: 0, merged: 0, aside: 0, videos: 0, asked: 0, failed: 0, reasons: {} });

  /* ---------- the hourly look ---------- */
  let busy = '';
  async function hourly(why) {
    if (!configured() || !store.ready || busy) return null;
    busy = 'hourly';
    const st = stateDoc(); const t0 = Date.now();
    try {
      const start = laMidnight(since());
      const from = Math.max(start, (st.lastPublished || Date.now() - 2 * 864e5) - OVERLAP_MS);
      const list = await walk(from, 5 * 60e3);
      const total = blank(); const hold = holding();
      for (const p of posts(list)) add(total, await takePost(p, { hold }));
      const newest = list.reduce((x, m) => Math.max(x, Date.parse(m.creationDate) || 0), st.lastPublished || 0);
      saveState({ lastPublished: newest || st.lastPublished || 0, lastRun: Date.now(), lastCounts: Object.assign({ read: list.length }, total), lastError: '' });
      if (total.kept || total.merged || total.aside || total.videos) log(`Kaymbu look${why ? ' (' + why + ')' : ''}: ${list.length} Moments read, ${total.kept} kept, ${total.merged} already in TREE given their children, ${total.aside} set aside, ${total.videos} videos to Video clips, ${Math.round((Date.now() - t0) / 1000)} s`);
      return total;
    } catch (e) { saveState({ lastRun: Date.now(), lastError: String(e.message || e).slice(0, 300) }); log('The Kaymbu look stopped', e.message); return null; }
    finally { busy = ''; }
  }

  /* ---------- the look back ---------- */
  // counts what the look back would bring in, without keeping anything or asking the quick lane
  // the count runs on its own after the director asks, and the page shows it when it is done
  function startEstimate() {
    if (!configured()) throw new Error('KAYMBU_EMAIL and KAYMBU_PASSWORD are not both set on Render.');
    if (busy) throw new Error('TREE is reading Kaymbu right now. Try again in a few minutes.');
    const lb = stateDoc().lookback || {};
    if (['approved', 'running', 'paused'].includes(lb.status)) throw new Error('The look back has already started.');
    saveState({ lookback: Object.assign({}, lb, { since: lb.since || since(), status: 'counting', lastError: '' }) });
    estimate().catch(e => { saveState({ lookback: Object.assign({}, stateDoc().lookback, { status: 'none', lastError: String(e.message || e).slice(0, 300) }) }); log('The Kaymbu look back could not be counted', e.message); });
  }
  async function estimate() {
    busy = 'estimate';
    try {
      const day = since(); const list = await walk(laMidnight(day), 8 * 60e3);
      const total = blank(); const hold = holding(); const ps = posts(list); let newPosts = 0;
      for (const p of ps) { const r = await takePost(p, { count: true, hold }); add(total, r); if (r.kept) newPosts++; }
      const cost = newPosts * COST.sort + total.asked * COST.screen + total.videos * COST.video;
      const est = { at: Date.now(), moments: list.length, posts: ps.length, newPosts, kept: total.kept, merged: total.merged, aside: total.aside, reasons: total.reasons, videos: total.videos, asked: total.asked,
        dollars: Math.max(1, Math.ceil(cost * 1.5)), nights: Math.max(1, Math.ceil((total.kept + total.videos) / (LOOKBACK_PER_HOUR * 11))) };
      saveState({ lookback: Object.assign({}, stateDoc().lookback || {}, { since: day, status: 'ready', estimate: est }) });
      return est;
    } finally { busy = ''; }
  }
  function approve(by) {
    const lb = stateDoc().lookback || {};
    if (!lb.estimate) throw new Error('Count the look back first.');
    if (lb.status === 'running' || lb.status === 'approved') return stateDoc();
    return saveState({ lookback: Object.assign({}, lb, { status: 'approved', approvedBy: by, approvedAt: Date.now(), done: blank(), cursor: 0 }) });
  }
  function pause(on) { const lb = stateDoc().lookback || {}; if (!['approved', 'running', 'paused'].includes(lb.status)) return stateDoc();
    return saveState({ lookback: Object.assign({}, lb, { status: on ? 'paused' : 'approved' }) }); }
  // evenings, nights and weekends, Los Angeles time
  function quietHours(t = Date.now()) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', weekday: 'short' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return p.weekday === 'Sat' || p.weekday === 'Sun' || +p.hour >= 18 || +p.hour < 6; }
  const backTimes = [];
  async function lookbackTick(force) {
    const lb = stateDoc().lookback || {};
    if (!configured() || !store.ready || busy || !['approved', 'running'].includes(lb.status)) return null;
    if (!force && !quietHours()) return null;
    while (backTimes.length && Date.now() - backTimes[0] > 36e5) backTimes.shift();
    let room = LOOKBACK_PER_HOUR - backTimes.length; if (room <= 0) return null;
    busy = 'lookback'; const t0 = Date.now();
    try {
      const day = lb.since || since();
      const list = await walk(laMidnight(day), 8 * 60e3);
      const hold = holding(); const done = Object.assign(blank(), lb.done || {}); done.reasons = Object.assign({}, (lb.done || {}).reasons || {});
      let left = 0;
      for (const p of posts(list)) {
        if (room <= 0 || Date.now() - t0 > 20 * 60e3) { left++; continue; }
        const r = await takePost(p, { back: true, hold });
        add(done, r); const n = (r.kept || 0) + (r.videos || 0); for (let i = 0; i < n; i++) backTimes.push(Date.now()); room -= n;
      }
      const finished = !left;
      saveState({ lookback: Object.assign({}, stateDoc().lookback, { status: finished ? 'done' : 'running', done, ...(finished ? { finishedAt: Date.now() } : {}), lastAt: Date.now() }) });
      log(`Kaymbu look back ${finished ? 'finished' : 'continues'}: ${done.kept} kept, ${done.merged} already in TREE, ${done.aside} set aside, ${done.videos} videos so far`);
      return done;
    } catch (e) { saveState({ lookback: Object.assign({}, stateDoc().lookback, { lastError: String(e.message || e).slice(0, 300), lastAt: Date.now() }) }); log('The Kaymbu look back stopped for now', e.message); return null; }
    finally { busy = ''; }
  }

  /* ---------- earlier years, for the children's books ---------- */
  // Counts the Moments taken before this school year of every child enrolled now, as far back as Kaymbu holds them. It
  // keeps nothing and reads no photos, so it costs nothing. Its numbers show the director what the books could draw on
  // before anything is brought in. It reads Kaymbu page by page and keeps only the tallies.
  const BOOK_MB = 0.35;                         // about how large one photo is, kept at the size Kaymbu shows it
  function enrolledKids() {
    const out = new Map();
    for (const [id, r] of store.recs.children) { const c = r && !r.deleted && r.doc; if (!c || !c.first) continue;
      if ((c.status || 'active') !== 'active') continue;
      out.set(id, { id, name: [c.first, c.last].filter(Boolean).join(' '), room: c.classroom || '' }); }
    return out;
  }
  // Kaymbu's own record of each child tagged in a Moment, its id with the name
  function kaymbuIds(m) {
    const info = m.studentInfo || {};
    return (m.students || []).map(x => typeof x === 'object' && x ? { sid: String(x._id || x.id || ''), first: clean(x.firstName), last: clean(x.lastName) }
      : { sid: String(x), first: clean((info[x] || {}).firstName), last: clean((info[x] || {}).lastName) }).filter(x => x.sid && x.first);
  }
  // One page of Moments added to the tallies. Each child is followed by Kaymbu's own id for them, so a child from years
  // ago with the same name is never counted as a child here now. This year's Moments tie each Kaymbu id to a child in
  // TREE. Earlier Moments are kept as small lines and counted at the end.
  function tallyBook(acc, list, before, kids, hold) {
    for (const m of list) {
      if (!m || !m._id || acc.seen.has(m._id)) continue; acc.seen.add(m._id); acc.read++;
      const at = capturedAt(m); if (!at) continue;
      const tagged = kaymbuIds(m); if (!tagged.length) continue;
      for (const t of tagged) if (!acc.names[t.sid]) acc.names[t.sid] = [t.first, t.last];
      if (at >= before) {
        for (const t of tagged) { if (acc.link[t.sid]) continue;
          const id = matchChildren([{ first: t.first, last: t.last }]).ids[0]; if (id && kids.has(id)) acc.link[t.sid] = id; }
        continue;
      }
      acc.early.push([at, m.video ? 1 : 0, hold.byKey.has(keyOf(m)) || hold.byKid.has(m._id) ? 1 : 0, tagged.map(t => t.sid)]);
    }
    return acc;
  }
  // the earlier Moments counted for each child enrolled now. A Kaymbu id not seen this year is tied to a child only by
  // first and last name together, and never for a Moment taken before that child was born.
  function bookTotals(acc, kids) {
    const n = s => words(s).replace(/\s/g, '');
    const link = Object.assign({}, acc.link), born = {};
    for (const [id, c] of kids) { const r = store.recs.children.get(id); const dob = r && r.doc && r.doc.dob; born[id] = /^\d{4}-\d{2}-\d{2}$/.test(dob || '') ? laMidnight(dob) : 0; }
    for (const [sid, [first, last]] of Object.entries(acc.names)) { if (link[sid] || !last) continue;
      const hit = [...kids.values()].filter(c => { const d = (store.recs.children.get(c.id) || {}).doc || {}; return [d.first, d.preferred].some(f => f && n(f) === n(first)) && n(d.last) === n(last); });
      if (hit.length === 1) link[sid] = hit[0].id; }
    const out = { moments: 0, photos: 0, videos: 0, held: 0, oldest: 0, kids: {} };
    for (const [at, vid, held, sids] of acc.early) {
      const ids = [...new Set(sids.map(s => link[s]).filter(id => id && at >= born[id]))]; if (!ids.length) continue;
      out.moments++; if (vid) out.videos++; else out.photos++; if (held) out.held++; if (!out.oldest || at < out.oldest) out.oldest = at;
      for (const id of ids) { const k = out.kids[id] || (out.kids[id] = { n: 0, videos: 0, first: at, last: at });
        k.n++; if (vid) k.videos++; if (at < k.first) k.first = at; if (at > k.last) k.last = at; }
    }
    return out;
  }
  function bookSummary(acc, kids, before) {
    const t = bookTotals(acc, kids); const rooms = {};
    for (const [id, c] of kids) { const room = c.room || 'No class'; const r = rooms[room] || (rooms[room] = { children: 0, withMoments: 0, moments: 0, videos: 0, first: 0 });
      r.children++; const k = t.kids[id]; if (!k) continue;
      r.withMoments++; r.moments += k.n; r.videos += k.videos; if (!r.first || k.first < r.first) r.first = k.first; }
    for (const r of Object.values(rooms)) r.first = r.first ? laDay(r.first) : '';
    const list = [...kids.values()].map(c => { const k = t.kids[c.id] || {}; return { id: c.id, name: c.name, room: c.room, n: k.n || 0, videos: k.videos || 0, first: k.first ? laDay(k.first) : '' }; })
      .sort((a, b) => a.room.localeCompare(b.room) || b.n - a.n);
    return { at: Date.now(), before: laDay(before), read: acc.read, oldest: t.oldest ? laDay(t.oldest) : '', moments: t.moments, photos: t.photos, videos: t.videos, held: t.held,
      mb: Math.round(t.photos * BOOK_MB), rooms, kids: list };
  }
  function startBookCount() {
    if (!configured()) throw new Error('KAYMBU_EMAIL and KAYMBU_PASSWORD are not both set on Render.');
    if (busy) throw new Error('TREE is reading Kaymbu right now. Try again in a few minutes.');
    const bk = stateDoc().book || {};
    if (bk.status === 'counting') return stateDoc();
    // Count again starts fresh, so its place from any earlier count is let go
    saveWip(null);
    saveState({ book: Object.assign({}, bk, { status: 'counting', startedAt: Date.now(), lastError: '', progress: 0 }) });
    runBook();
    return stateDoc();
  }
  function runBook() {
    const bk = stateDoc().book || {};
    bookCount().catch(e => { saveState({ book: Object.assign({}, stateDoc().book, { status: bk.estimate ? 'ready' : 'none', lastError: String(e.message || e).slice(0, 300) }) }); log('The earlier years could not be counted', e.message); });
  }
  /* The count keeps its place (November 12, 2026). Every 25 pages it writes how far it has read and what it has tallied, in a
     record of its own, so a restart of the server carries on from there and loses nothing. The tally is kept in columns so the
     record stays small. */
  function wipDoc() { const r = store.recs.kaymbu.get('bookwip'); const d = r && !r.deleted && r.doc; return d && d.after ? d : null; }
  // saved to the records only, never sent to anyone's browser, since nobody needs to see it
  function saveWip(d) { const doc = Object.assign({ id: 'bookwip' }, d || { done: true });
    store.recs.kaymbu.set('bookwip', Object.assign({}, store.recs.kaymbu.get('bookwip') || {}, { doc, path: 'kaymbu/bookwip.json', local: true })); scheduleSave('kaymbu', 'bookwip'); }
  function packAcc(acc, before, after, lastIds) {
    const sidList = [], ix = {}; const at = [], f = [], sx = [];
    for (const [t, vid, held, sids] of acc.early) { at.push(Math.round(t / 60000)); f.push((vid ? 1 : 0) | (held ? 2 : 0));
      sx.push(sids.map(sid => ix[sid] != null ? ix[sid] : (ix[sid] = sidList.push(sid) - 1))); }
    return { before, after, read: acc.read, names: acc.names, link: acc.link, sidList, at, f, s: sx, lastIds, savedAt: Date.now() };
  }
  function unpackAcc(w) {
    const early = (w.at || []).map((t, i) => [t * 60000, w.f[i] & 1, w.f[i] & 2 ? 1 : 0, (w.s[i] || []).map(k => w.sidList[k])]);
    return { seen: new Set(w.lastIds || []), read: w.read || 0, names: w.names || {}, link: w.link || {}, early };
  }
  async function bookCount() {
    busy = 'book'; const t0 = Date.now();
    try {
      const before = laMidnight(since()); const kids = enrolledKids(); const hold = holding();
      const w = wipDoc(); const resume = !!(w && w.before === before);
      const acc = resume ? unpackAcc(w) : { seen: new Set(), read: 0, names: {}, link: {}, early: [] };
      let after = resume ? w.after : Date.now() + 864e5;
      if (resume) log(`The earlier years count carries on from ${acc.read} Moments read`);
      for (let page = 0; page < 20000; page++) {
        const list = await api('POST', '/api/moments/grid', gridBody(after));
        if (!Array.isArray(list) || !list.length) break;
        tallyBook(acc, list, before, kids, hold);
        const last = list[list.length - 1];
        if (!last.searchAfter || last.searchAfter === after) break;
        after = last.searchAfter;
        if (page % 25 === 24) {
          // only the last page's ids are kept to skip repeats, since the next page always starts after it
          const lastIds = list.map(m => m && m._id).filter(Boolean); acc.seen = new Set(lastIds);
          saveWip(packAcc(acc, before, after, lastIds));
          saveState({ book: Object.assign({}, stateDoc().book, { progress: acc.read }) });
        }
      }
      const est = bookSummary(acc, kids, before);
      saveWip(null);
      saveState({ book: Object.assign({}, stateDoc().book, { status: 'ready', estimate: est, lastError: '', progress: 0 }) });
      log(`Earlier years counted: ${acc.read} Moments read, ${est.moments} of enrolled children before ${est.before} back to ${est.oldest}, ${Math.round((Date.now() - t0) / 1000)} s`);
      return est;
    } finally { busy = ''; }
  }
  // a count the server restarted in the middle of carries on by itself once Kaymbu can be read, waiting out any other reading
  function resumeBook(tries) {
    if ((stateDoc().book || {}).status !== 'counting') return;
    if (!configured() || !store.ready || busy) { if ((tries || 0) < 60) setTimeout(() => resumeBook((tries || 0) + 1), 60e3).unref(); return; }
    runBook();
  }

  /* ---------- earlier years brought into Google Drive, for the books ---------- */
  // Once the director says yes, every earlier photo of each child enrolled now is kept in the school's Google Drive at
  // the size Kaymbu shows it, so the school keeps them even without Kaymbu. They go into each child's book collection
  // only, never into observations, threads or the displays. They are read for DRDP evidence only once the director starts
  // that, below (November 13, 2026). Videos stay in Kaymbu. It runs in
  // the quiet hours after this year's look back, a few hundred an hour, and goes on where it stopped.
  const BRING_PER_HOUR = 300;
  const bringTimes = [];
  const bookId = kid => 'book-' + kid;
  function bookDoc(kid) { const r = store.recs.kaymbu.get(bookId(kid)); return (r && !r.deleted && r.doc) || { id: bookId(kid), child: kid, items: [] }; }
  function saveBook(doc) { saveAside(Object.assign(doc, { savedAt: Date.now() })); }
  function startBring() {
    if (!configured()) throw new Error('KAYMBU_EMAIL and KAYMBU_PASSWORD are not both set on Render.');
    const bk = stateDoc().book || {};
    if (!bk.estimate) throw new Error('Count the earlier years first.');
    const br = bk.bring || {};
    if (['approved', 'running'].includes(br.status)) return stateDoc();
    saveState({ book: Object.assign({}, bk, { bring: Object.assign({ done: { kept: 0, inTree: 0, videos: 0, failed: 0 }, link: {}, after: 0 }, br, { status: 'approved', approvedAt: Date.now(), lastError: '' }) }) });
    return stateDoc();
  }
  function pauseBring() { const bk = stateDoc().book || {}; if (!bk.bring) return stateDoc(); saveState({ book: Object.assign({}, bk, { bring: Object.assign({}, bk.bring, { status: 'paused' }) }) }); return stateDoc(); }
  // a Kaymbu id tied to a child enrolled now. This year's Moments tie it first. Otherwise a first and last name together.
  function linkOf(link, t, kids) {
    if (link[t.sid] !== undefined) return link[t.sid];
    if (!t.last) return '';
    const n = s => words(s).replace(/\s/g, '');
    const hit = [...kids.values()].filter(c => { const d = (store.recs.children.get(c.id) || {}).doc || {}; return [d.first, d.preferred].some(f => f && n(f) === n(t.first)) && n(d.last) === n(t.last); });
    return hit.length === 1 ? hit[0].id : '';
  }
  function bornOf(kid) { const d = ((store.recs.children.get(kid) || {}).doc || {}).dob; return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? laMidnight(d) : 0; }
  // one Moment kept for each child it belongs to. Returns 'kept', 'inTree', 'have', 'video' or ''.
  async function bringMoment(m, kids, link, hold, batchWords) {
    const at = capturedAt(m); if (!at) return '';
    const ids = [...new Set(kaymbuIds(m).map(t => linkOf(link, t, kids)).filter(id => id && kids.has(id) && at >= bornOf(id)))];
    if (!ids.length) return '';
    if (m.video) return 'video';
    if (ids.every(id => bookDoc(id).items.some(x => x.m === m._id))) return 'have';
    const base = { m: m._id, at, day: laDay(at), words: momentWords(m) || batchWords || '', kids: ids, room: roomOf(m) || '', ...(m.batchId ? { batch: m.batchId } : {}) };
    const inTree = hold.byKey.get(keyOf(m));
    let item;
    if (inTree) item = Object.assign(base, { notice: inTree });
    else {
      if (!m.pictureSource && !m.pictureThumb) return '';
      const display = mediaUrl(m.pictureSource || String(m.pictureThumb).replace(/_thumb(\.\w+)$/i, '_display$1'));
      const p = await kaymbu.bestPhoto(display);
      if (!p) throw new Error('Kaymbu would not send the photo');
      item = Object.assign(base, { photo: await kaymbu.keepPhoto(p.buf, 'the book look back'), w: p.w, h: p.h, src: p.url });
    }
    for (const id of ids) { const d = bookDoc(id); if (d.items.some(x => x.m === m._id)) continue; d.items.push(item); d.items.sort((a, b) => a.at - b.at); saveBook(d); }
    return inTree ? 'inTree' : 'kept';
  }
  async function bringTick(force) {
    const bk = stateDoc().book || {}, br = bk.bring || {};
    if (!configured() || !store.ready || busy || !['approved', 'running'].includes(br.status)) return null;
    const lb = stateDoc().lookback || {};
    if (['approved', 'running'].includes(lb.status)) return null;          // this year's look back goes first
    if (!force && !quietHours()) return null;
    while (bringTimes.length && Date.now() - bringTimes[0] > 36e5) bringTimes.shift();
    let room = BRING_PER_HOUR - bringTimes.length; if (room <= 0) return null;
    busy = 'book'; const t0 = Date.now();
    const before = laMidnight(since()), kids = enrolledKids(), hold = holding();
    const link = Object.assign({}, br.link || {}), done = Object.assign({ kept: 0, inTree: 0, videos: 0, failed: 0 }, br.done || {});
    let after = br.after || (Date.now() + 864e5), finished = false, failedNow = 0;
    try {
      while (room > 0 && Date.now() - t0 < 8 * 60e3) {
        const list = await api('POST', '/api/moments/grid', gridBody(after));
        if (!Array.isArray(list) || !list.length) { finished = true; break; }
        const batchWords = new Map(); for (const m of list) { const w = momentWords(m); if (m.batchId && w && !batchWords.has(m.batchId)) batchWords.set(m.batchId, w); }
        for (const m of list) {
          const at = capturedAt(m);
          if (at >= before) { for (const t of kaymbuIds(m)) if (link[t.sid] === undefined) { const id = matchChildren([{ first: t.first, last: t.last }]).ids[0]; if (id && kids.has(id)) link[t.sid] = id; } continue; }
          try {
            const r = await bringMoment(m, kids, link, hold, batchWords.get(m.batchId) || '');
            if (r === 'kept') { done.kept++; bringTimes.push(Date.now()); room--; }
            else if (r === 'inTree') done.inTree++;
            else if (r === 'video') done.videos++;
          } catch (e) { done.failed++; failedNow++; if (failedNow > 10) throw e; }
        }
        const last = list[list.length - 1];
        if (!last.searchAfter || last.searchAfter === after) { finished = true; break; }
        after = last.searchAfter;
      }
      saveState({ book: Object.assign({}, stateDoc().book, { bring: Object.assign({}, stateDoc().book.bring, { status: finished ? 'done' : 'running', link, after, done, lastAt: Date.now(), ...(finished ? { finishedAt: Date.now() } : {}) }) }) });
      log(`Earlier years for the books ${finished ? 'finished' : 'continue'}: ${done.kept} photos kept in Drive, ${done.inTree} already in TREE, ${done.failed} could not be kept`);
      return done;
    } catch (e) {
      saveState({ book: Object.assign({}, stateDoc().book, { bring: Object.assign({}, stateDoc().book.bring, { link, after, done, lastError: String(e.message || e).slice(0, 300), lastAt: Date.now() }) }) });
      log('The earlier years stopped for now', e.message); return null;
    } finally { busy = ''; }
  }

  /* ---------- earlier years read for DRDP evidence (November 13, 2026) ----------
     The director chose to have the earlier photos kept for the books also read for DRDP evidence, so a child's levels
     show from their first year with us. Nothing is read until she starts it, after a count. A few photos for each child
     for each month are chosen, the ones with words first and one photo of a post, oldest first. A photo that tags several
     children is read once for all of them. The reading itself runs in TREE on the director's computer, one photo at a
     time, and asks here for the next one. The photos stay in the book collection and never become observations. */
  const EARLY_PER_MONTH = 3;
  function earlyDoc() { const r = store.recs.kaymbu.get('drdpearly'); const d = r && !r.deleted && r.doc; return d || { id: 'drdpearly', status: 'none', read: {} }; }
  function saveEarly(d) { saveAside(Object.assign(d, { savedAt: Date.now() })); return d; }
  function earlyPlan() {
    const kids = enrolledKids(); const picks = new Map();
    for (const id of kids.keys()) {
      const byMonth = new Map();
      for (const it of bookDoc(id).items || []) { if (!it || !it.photo || !it.at || !it.m) continue; const k = String(it.day || '').slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(it); }
      for (const list of byMonth.values()) {
        const len = it => String(it.words || '').trim().length;
        list.sort((a, b) => (len(b) >= 15) - (len(a) >= 15) || len(b) - len(a) || a.at - b.at);
        const posts = new Set(); let n = 0;
        for (const it of list) { if (n >= EARLY_PER_MONTH) break; if (it.batch) { if (posts.has(it.batch)) continue; posts.add(it.batch); } n++;
          if (!picks.has(it.m)) picks.set(it.m, { m: it.m, at: it.at, day: it.day || '', words: String(it.words || '').slice(0, 3000), photo: it.photo, room: it.room || '', kids: (it.kids || []).filter(k => kids.has(k)) }); }
      }
    }
    return [...picks.values()].filter(p => p.kids.length).sort((a, b) => a.at - b.at);
  }
  function earlyView() {
    const d = earlyDoc(); const plan = earlyPlan(); const read = d.read || {}; const left = plan.filter(p => !read[p.m]);
    return { status: d.status || 'none', photos: plan.length, left: left.length, done: plan.length - left.length, children: new Set(plan.flatMap(p => p.kids)).size,
      oldest: plan.length ? plan[0].day : '', newest: plan.length ? plan[plan.length - 1].day : '', perMonth: EARLY_PER_MONTH, startedAt: d.startedAt || 0, finishedAt: d.finishedAt || 0, found: d.found || 0 };
  }
  function earlyStart(who) { const d = earlyDoc(); if (!earlyPlan().length) throw new Error('No earlier photos are kept yet. Keep them in Drive first.'); saveEarly(Object.assign(d, { status: 'reading', startedAt: d.startedAt || Date.now(), by: who || '' })); }
  function earlyPause(on) { const d = earlyDoc(); if (d.status === 'reading' || d.status === 'paused') saveEarly(Object.assign(d, { status: on ? 'paused' : 'reading' })); }
  // the next photo to read, or none once every chosen photo is read
  function earlyNext() {
    const d = earlyDoc(); if (d.status !== 'reading') return { status: d.status || 'none' };
    const read = d.read || {}; const p = earlyPlan().find(x => !read[x.m]);
    if (!p) { saveEarly(Object.assign(d, { status: 'done', finishedAt: Date.now() })); return { status: 'done' }; }
    return { status: 'reading', pick: p };
  }
  // a photo is marked once it is read, or after it could not be read three times, so the reading never stops on one photo
  function earlyMark(m, ok, found) {
    const d = earlyDoc(); const read = Object.assign({}, d.read); const tries = Object.assign({}, d.tries);
    if (ok) { read[m] = 1; delete tries[m]; } else { tries[m] = (tries[m] || 0) + 1; if (tries[m] >= 3) { read[m] = 2; delete tries[m]; } }
    saveEarly(Object.assign(d, { read, tries, found: (d.found || 0) + (ok ? Math.max(0, Number(found) || 0) : 0) }));
  }

  /* ---------- the director's choices on what was set aside ---------- */
  async function putBack(id) {
    const r = store.recs.kaymbu.get(id); const d = r && !r.deleted && r.doc; if (!d || !d.kid) throw new Error('That Moment is no longer set aside.');
    if (busy) throw new Error('TREE is reading Kaymbu right now. Try again in a minute.');
    busy = 'back';
    try {
      const j = await api('POST', '/api/moments/moment/' + d.kid, {}); const m = j && j.moment;
      if (!m) throw new Error('Kaymbu no longer has that Moment.');
      if (Array.isArray(m.students)) m.studentInfo = Object.fromEntries(m.students.map(s => [s._id, s]));
      m.classroomName = m.classroomName || (m.classroom && m.classroom.name) || d.kaymbuClass;
      const hold = holding(); hold.aside.delete(d.kid);
      // a photo put back skips the screener, since the director chose it
      const words0 = momentWords(m);
      if (!words0 && d.batch) { for (const [, x] of store.recs.notices) { const n = x && !x.deleted && x.doc; if (n && n.kaymbu && n.kaymbu.batch === d.batch && n.noticed) { m.annotation = n.noticed; break; } } }
      const out = await takePost([m], { hold, chosen: true });
      saveAside(Object.assign({}, d, { status: 'back', backAt: Date.now() }));
      return out;
    } finally { busy = ''; }
  }
  // Bring all into TREE, for one class. Each is put back in turn, after the call answers, since each photo is fetched from Kaymbu.
  let bringing = '';
  function bringAll(room) {
    if (busy || bringing) throw new Error('TREE is reading Kaymbu right now. Try again in a minute.');
    const ids = []; for (const [id, r] of store.recs.kaymbu) { const d = r && !r.deleted && r.doc; if (d && d.kid && d.status === 'aside' && (!room || (d.room || '') === room)) ids.push(id); }
    if (!ids.length) return 0;
    bringing = room || 'all';
    (async () => { let n = 0; try { for (const id of ids) { for (let k = 0; k < 30 && busy; k++) await new Promise(ok => setTimeout(ok, 10000));
      try { await putBack(id); n++; } catch (e) { log('A set aside Moment could not be brought into TREE', e.message); } } }
      finally { bringing = ''; log(`Brought ${n} set aside Kaymbu Moments into TREE${room ? ' for ' + room + ' class' : ''}`); } })();
    return ids.length;
  }
  function acceptClass(room) {
    let n = 0;
    for (const [id, r] of store.recs.kaymbu) { const d = r && !r.deleted && r.doc; if (!d || !d.kid || d.status !== 'aside') continue;
      if (room && (d.room || '') !== room) continue;
      saveAside(Object.assign({}, d, { status: 'accepted', acceptedAt: Date.now() })); n++; }
    return n;
  }

  function view() {
    const st = stateDoc();
    const list = []; for (const [, r] of store.recs.kaymbu) { const d = r && !r.deleted && r.doc; if (d && d.kid && d.status === 'aside') list.push(d); }
    list.sort((a, b) => (b.published || 0) - (a.published || 0));
    const accepted = [...store.recs.kaymbu.values()].filter(r => r && !r.deleted && r.doc && r.doc.status === 'accepted' && !r.doc.auto).length;
    return { configured: configured(), email: EMAIL(), busy: busy || (bringing ? 'back' : ''), lastRun: st.lastRun || 0, lastError: st.lastError || '', lastCounts: st.lastCounts || null, lookback: st.lookback || { since: since(), status: 'none' }, book: st.book || { status: 'none' }, early: earlyView(),
      quiet: quietHours(), aside: list.map(d => ({ id: d.id, reason: d.reason, why: d.why, thumb: d.thumb, video: d.video, room: d.room, kaymbuClass: d.kaymbuClass, words: d.words, students: d.students, day: d.day })), accepted, reasons: REASON };
  }
  const statusLine = () => [configured(), configured() ? `TREE reads Kaymbu every hour as ${EMAIL()}${stateDoc().lastError ? ', but the last look stopped. ' + stateDoc().lastError : '.'}` : 'TREE does not read Kaymbu yet. Add KAYMBU_EMAIL and KAYMBU_PASSWORD under Environment.'];

  // the hourly look starts a few minutes after the records load, and the look back runs in its quiet hours
  function start() {
    setTimeout(() => { if (store.ready) leaveNearCopies(); }, 60e3).unref();
    // a count cut short by a restart carries on from its saved place
    setTimeout(() => resumeBook(0), 90e3).unref();
    setTimeout(() => hourly('start').catch(() => {}), 4 * 60e3).unref();
    setInterval(() => hourly().catch(() => {}), 60 * 60e3).unref();
    setInterval(() => lookbackTick().catch(() => {}), 10 * 60e3).unref();
    setInterval(() => bringTick().catch(() => {}), 10 * 60e3 + 30e3).unref();
  }

  return { start, hourly, startEstimate, estimate, startBookCount, bookCount, startBring, pauseBring, bringTick, bringMoment, bookDoc, earlyPlan, earlyView, earlyStart, earlyPause, earlyNext, earlyMark, approve, pause, lookbackTick, putBack, bringAll, acceptClass, view, statusLine, configured,
    // for the tests
    keyOf, matchChildren, takePost, posts, tallyBook, bookSummary, packAcc, unpackAcc, leaveNearCopies, kaymbuIds, enrolledKids, holding, quietHours, laMidnight, _setCookies: c => { cookies = new Map(c); } };
};
