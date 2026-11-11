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
    else { const extra = kids.ids.filter(x => !have.includes(x)); const offer = [...new Set([...(k.suggest || []), ...extra])].filter(x => !have.includes(x));
      if (extra.length && JSON.stringify(offer) !== JSON.stringify(k.suggest || [])) { k.suggest = offer; k.check = true; delete k.maybe; changed = true; } }
    if (kids.unmatched.length && JSON.stringify(kids.unmatched) !== JSON.stringify(k.unmatched || [])) { k.unmatched = kids.unmatched; changed = true; }
    if (!changed) return false;
    d.kaymbu = k; noteChange('notices', id); scheduleSave('notices', id); return true;
  }
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
    const put = (t, reason, why) => { out.aside++; out.reasons[reason] = (out.reasons[reason] || 0) + 1; if (!o.count) aside(t.m, reason, why); t.out = true; };
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
    const accepted = [...store.recs.kaymbu.values()].filter(r => r && !r.deleted && r.doc && r.doc.status === 'accepted').length;
    return { configured: configured(), email: EMAIL(), busy, lastRun: st.lastRun || 0, lastError: st.lastError || '', lastCounts: st.lastCounts || null, lookback: st.lookback || { since: since(), status: 'none' },
      quiet: quietHours(), aside: list.map(d => ({ id: d.id, reason: d.reason, why: d.why, thumb: d.thumb, video: d.video, room: d.room, kaymbuClass: d.kaymbuClass, words: d.words, students: d.students, day: d.day })), accepted, reasons: REASON };
  }
  const statusLine = () => [configured(), configured() ? `TREE reads Kaymbu every hour as ${EMAIL()}${stateDoc().lastError ? ', but the last look stopped. ' + stateDoc().lastError : '.'}` : 'TREE does not read Kaymbu yet. Add KAYMBU_EMAIL and KAYMBU_PASSWORD under Environment.'];

  // the hourly look starts a few minutes after the records load, and the look back runs in its quiet hours
  function start() {
    setTimeout(() => hourly('start').catch(() => {}), 4 * 60e3).unref();
    setInterval(() => hourly().catch(() => {}), 60 * 60e3).unref();
    setInterval(() => lookbackTick().catch(() => {}), 10 * 60e3).unref();
  }

  return { start, hourly, startEstimate, estimate, approve, pause, lookbackTick, putBack, acceptClass, view, statusLine, configured,
    // for the tests
    keyOf, matchChildren, takePost, posts, quietHours, laMidnight, _setCookies: c => { cookies = new Map(c); } };
};
