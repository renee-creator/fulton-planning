// Kaymbu Moments into TREE.
// An educator shares Moments from Kaymbu by email to the school's TREE address in Google Workspace. A Google Apps Script
// in that mailbox (tools/kaymbu-apps-script.gs) sends each new Kaymbu email here. Each Moment in the email becomes a
// TREE moment, with the title and the educator's note word for word, the photo kept in the records, the classroom read
// from the subject line, and the children found by the names written in the note. A moment where TREE could not tell
// which children it holds waits on Today for an educator to tag them.
//
// Render setting
//   KAYMBU_INBOX_KEY   a long secret shared with the Apps Script. Without it the inbox is off.

const https = require('https');
const crypto = require('crypto');

module.exports = function kaymbu({ store, log, gh, repo, noteChange, scheduleSave, cacheFile, accountFor, educatorNames, keepInDrive, digest, onNotice, isDirector }) {
  const KEY = () => String(process.env.KAYMBU_INBOX_KEY || '').trim();
  const PHOTO_HOST = /^d[a-z0-9]+\.cloudfront\.net$/i;
  const seen = new Set();   // Moments being kept right now, so a second copy of the same email waits its turn

  const decode = s => String(s || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[\uFFFC\u200B]/g, '').replace(/[ \t]+\n/g, '\n').trim();

  // each Moment in a Kaymbu email is a caption, a note and a photo, in that order
  function parseMoments(html) {
    const out = []; const parts = String(html || '').split(/<tbody[^>]*class="caption-and-notes"[^>]*>/i).slice(1);
    for (const part of parts) {
      const cap = part.match(/<tr[^>]*class="caption"[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const note = part.match(/<tr[^>]*class="notes"[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const img = part.match(/<img[^>]*class="moment-image"[^>]*src="([^"]+)"/i) || part.match(/<img[^>]*src="([^"]+)"[^>]*class="moment-image"/i);
      const m = { title: decode(cap && cap[1]), note: decode(note && note[1]), photo: img ? img[1].replace(/&amp;/g, '&') : '' };
      if (m.title || m.note || m.photo) out.push(m);
    }
    return out;
  }

  // a class newsletter, a Kaymbu Storyboard, is built from blocks. Its title names the class, each subtitle starts a part,
  // usually a small group, and the photos and paragraphs under a subtitle belong to that part. The calendar dates and
  // the words before the first part are for families and are not observations.
  function parseStoryboard(html) {
    html = String(html || '');
    if (!/class="\s*block (?:subtitle|paragraph|banner)Block/i.test(html)) return null;
    const re = /class="\s*block (\w+Block)"/gi, marks = []; let x;
    while ((x = re.exec(html))) marks.push({ type: x[1], at: x.index });
    const text = h => decode(String(h || '').replace(/<\/div>\s*<div[^>]*>/gi, '\n')).replace(/\n{3,}/g, '\n\n').trim();
    const out = { title: '', dates: [], intro: [], sections: [] }; let cur = null;
    marks.forEach((mk, i) => {
      const part = html.slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : html.indexOf('Storyboard Footer') > mk.at ? html.indexOf('Storyboard Footer') : html.length);
      const t = mk.type;
      if (t === 'bannerBlock') { const m = part.match(/class="[^"]*component text bannerTitle"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i); out.title = text(m && m[1]); return; }
      if (/^calendar/i.test(t)) { const g = c => { const m = part.match(new RegExp('class="component-date ' + c + '"[^>]*>([^<]*)<', 'i')); return m ? m[1].trim() : ''; };
        const d = part.match(/class="[^"]*component text description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i); out.dates.push({ month: g('month'), day: g('day'), text: text(d && d[1]) }); return; }
      if (t === 'subtitleBlock') { const m = part.match(/class="[^"]*component text subtitle"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i); cur = { heading: text(m && m[1]), photos: [], text: [] }; out.sections.push(cur); return; }
      if (t === 'paragraphBlock') { const m = part.match(/class="[^"]*component text paragraph"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i); const w = text(m && m[1]); if (!w) return;
        if (cur) cur.text.push(w); else out.intro.push(w); return; }
      if (/image/i.test(t)) { const srcs = [...part.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)].map(m => m[1].replace(/&amp;/g, '&')).filter(u => /\/moments\//.test(u));
        if (!srcs.length) return; if (!cur) { cur = { heading: '', photos: [], text: [] }; out.sections.push(cur); } cur.photos.push(...srcs); }
    });
    // a part is an observation only when an educator wrote about it. Photos with only a heading or names under them,
    // such as The Faces of North class, are left out.
    out.sections = out.sections.filter(sc => sc.text.length);
    return out.sections.length ? out : null;
  }

  // a small group named in a newsletter heading, allowing one letter off, as Lavander for Lavender
  function headingGroup(heading, rooms) {
    const set = (store.recs.settings.get('main') || {}).doc || {};
    const groups = (Array.isArray(set.groups) ? set.groups : []).filter(g => g && g.name && (!rooms.length || !g.room || rooms.includes(g.room)));
    const ws = words(heading).replace(/\b(group|groups|small)\b/g, ' ').trim().split(/\s+/).filter(Boolean);
    const near = (a, b) => { if (a === b) return true; if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
      let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; };
    const hit = groups.filter(g => { const gw = words(g.name); return gw.split(' ').length > 1 ? (' ' + ws.join(' ') + ' ').includes(' ' + gw + ' ') : ws.some(w => near(w, gw)); });
    return hit.length === 1 ? hit[0] : null;
  }

  function getBuf(url, hops = 0) {
    return new Promise((resolve, reject) => {
      let u; try { u = new URL(url); } catch (e) { reject(new Error('bad address')); return; }
      if (u.protocol !== 'https:' || !PHOTO_HOST.test(u.hostname)) { reject(new Error('not a Kaymbu photo address')); return; }
      const req = https.get(u, { headers: { 'User-Agent': 'TREE' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) { res.resume(); resolve(getBuf(new URL(res.headers.location, u).href, hops + 1)); return; }
        const chunks = []; let size = 0;
        res.on('data', c => { size += c.length; if (size > 15 * 1024 * 1024) req.destroy(new Error('too large')); else chunks.push(c); });
        res.on('end', () => resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), modified: Date.parse(res.headers['last-modified'] || '') || 0, buf: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      req.setTimeout(15000, () => req.destroy(new Error('Kaymbu did not answer in time')));
      req.on('error', reject);
    });
  }

  // width and height from a JPEG or PNG, turned when the camera marked the photo as sideways
  function size(buf) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2, turn = false, dims = null;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const mk = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (mk === 0xe1 && buf.toString('ascii', i + 4, i + 8) === 'Exif') {
        const t = i + 10, le = buf.toString('ascii', t, t + 2) === 'II';
        const r16 = o => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o), r32 = o => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
        try { const ifd = t + r32(t + 4), n = r16(ifd); for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (r16(e) === 0x0112) { const v = r16(e + 8); turn = v >= 5 && v <= 8; } } } catch (e) {}
      }
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) { dims = { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; break; }
      i += 2 + len;
    }
    return dims && turn ? { w: dims.h, h: dims.w } : dims;
  }

  // the largest copy Kaymbu will give. The email shows the display copy, and the full one sits beside it under other names.
  async function bestPhoto(url) {
    const tries = [url.replace(/_display(\.\w+)$/i, '$1'), url.replace(/_display(\.\w+)$/i, '_original$1'), url].filter((v, i, a) => a.indexOf(v) === i);
    let best = null;
    for (const t of tries) {
      try { const r = await getBuf(t); const d = r.status === 200 && /^image\//.test(r.type) ? size(r.buf) : null; if (d && (!best || d.w * d.h > best.w * best.h)) best = Object.assign({ buf: r.buf, url: t, modified: r.modified }, d); }
      catch (e) {}
      // a full-size original is as large as Kaymbu keeps, so the smaller copies are not fetched too
      if (best && Math.max(best.w, best.h) >= 2000) break;
    }
    return best;
  }

  async function keepPhoto(buf, by, kind) {
    const id = crypto.randomBytes(6).toString('hex') + (kind === 'thumb' ? '-moment-kaymbu-thumb.jpg' : '-moment-kaymbu.jpg');
    if (keepInDrive && await keepInDrive(id, buf, 'image/jpeg')) return id;
    let r;
    // GitHub refuses a save that lands at the same moment as another, so it is tried again after a short wait
    for (let k = 0; k < 4; k++) {
      if (k) await new Promise(ok => setTimeout(ok, 1500 * k));
      r = await gh('PUT', `/repos/${repo}/contents/originals/${id}`, { message: `Add moment photo from Kaymbu shared by ${by || "a class account"}`, content: buf.toString('base64'), branch: store.branch });
      if (r.status !== 409 && r.status !== 422 && r.status < 500) break;
    }
    if (r.status !== 201 && r.status !== 200) throw new Error('GitHub answered ' + r.status + ' when keeping a Kaymbu photo');
    store.originals.set(id, { path: `originals/${id}`, sha: r.json.content.sha, size: buf.length }); cacheFile(id, buf);
    return id;
  }

  const laDay = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  function mondayOf(day) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
  const live = kind => [...store.recs[kind].values()].filter(r => !r.deleted).map(r => r.doc);
  // Los Angeles wall time as a moment in time, so a day and hour from a subject or a photo land on the right day
  function laTime(y, mo, d, h = 12, mi = 0) {
    let t = Date.UTC(y, mo - 1, d, h, mi);
    for (let k = 0; k < 2; k++) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
      t += Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
    return t;
  }
  // a date written in the subject, like 10/14, 10/14/26 or Oct 14, sets the day for the whole batch
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function subjectDay(subject, sent) {
    const s = String(subject || '').toLowerCase(); let mo, d, y;
    let m = s.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if (m) { mo = +m[1]; d = +m[2]; y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : 0; }
    else if ((m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/))) { mo = MONTHS.indexOf(m[1]) + 1; d = +m[2]; y = 0; }
    if (!mo || mo > 12 || !d || d > 31) return 0;
    const sentYear = +laDay(sent).slice(0, 4);
    let t = laTime(y || sentYear, mo, d);
    if (!y && t > sent + 864e5) t = laTime(sentYear - 1, mo, d);   // a December date sent in January
    return t <= sent + 864e5 ? t : 0;
  }
  // the day a photo reached Kaymbu, which is the day it was taken when the Kaymbu app is used in class. Kaymbu removes
  // the camera's own date from its photos.
  const photoDay = (p, sent) => p && p.modified && p.modified <= sent + 36e5 && p.modified > sent - 400 * 864e5 ? p.modified : 0;
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
  // photos shared in one Kaymbu post carry one group, so TREE treats them as one observation with several photos. The
  // group is worked out from the post's words, its class and its day, so photos of one post that arrive in two emails still meet
  const postGroup = (noticed, room, day) => { const t = String(noticed || '').replace(/\s+/g, ' ').trim().toLowerCase(); return t.length >= 12 ? 'k' + crypto.createHash('sha1').update(t + '|' + (room || '') + '|' + day).digest('hex').slice(0, 14) : ''; };


  // the subject names the class, as North or North class, and can also name a project or a thread the moments belong to
  function readSubject(subject) {
    const set = (store.recs.settings.get('main') || {}).doc || {};
    const rooms = Array.isArray(set.classrooms) && set.classrooms.length ? set.classrooms.map(String) : ['West', 'North', 'South'];
    const s = ' ' + words(subject) + ' ';
    // a subject can name more than one class, since Fulton's classes mix
    let inSubject = rooms.filter(r => s.includes(' ' + words(r) + ' '));
    // a small group in the subject, as in Notes-marigold, places the moments in that group's class and keeps the group
    const groups = (Array.isArray(set.groups) ? set.groups : []).filter(g => g && g.name && words(g.name).length > 2);
    const grp = groups.filter(g => s.includes(' ' + words(g.name) + ' ')).sort((a, b) => String(b.name).length - String(a.name).length)[0];
    if (grp && grp.room && !inSubject.includes(grp.room)) inSubject = [grp.room, ...inSubject];
    const room = inSubject[0] || '';
    const named = (list, key) => list.filter(x => x[key] && words(x[key]).length > 2 && s.includes(' ' + words(x[key]) + ' ')).sort((a, b) => String(b[key]).length - String(a[key]).length)[0];
    const project = named(live('projects').filter(p => p.status !== 'closed'), 'name');
    const thread = named(live('threads').filter(t => t.status !== 'stopped'), 'name');
    // Kaymbu is signed in per class, so the educator who shares writes their first name in the subject, as in North and a first name.
    // The name is matched to the educators who sign in to TREE, and a child's name is never taken for an educator.
    const kidFirsts = new Set(live('children').map(c => words(c.first || '')).filter(Boolean));
    const edus = [...new Set((educatorNames ? educatorNames() : []).map(String).filter(Boolean))];
    const eduHits = edus.filter(n => { const w = words(n); return w.length > 1 && s.includes(' ' + w + ' ') && !(kidFirsts.has(w) && !s.includes(' by ' + w + ' ')); });
    // with no educator named, the small group's educator shared it
    const educator = (eduHits.length === 1 ? eduHits[0] : eduHits.find(n => s.includes(' by ' + words(n) + ' ')) || '') || (grp && !eduHits.length && grp.educator ? String(grp.educator) : '');
    if (eduHits.length > 1 && !educator) log('Kaymbu subject names more than one educator, so none is set', eduHits.join(', '));
    // the word bin keeps the moments with that week's FEED bin, as in South Bin
    return { room, rooms: inSubject, smallGroup: grp ? String(grp.name) : '', educator, projectId: project ? project.id : '', threadId: thread ? thread.id : '', bin: / bins? /.test(s) };
  }

  // the bin that arrived in the week of a day, up to six days before it
  function binFor(day) {
    const add = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const list = live('bins').filter(b => b && /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') && (b.items || []).length && b.date <= day && day <= add(b.date, 6));
    const tue = list.filter(b => b.tuesday); const pick = (tue.length ? tue : list).sort((a, b) => b.date.localeCompare(a.date))[0];
    return pick ? pick.date : '';
  }

  // first names that are also everyday words, which a note can use at the start of a sentence or for the thing itself,
  // such as Wren, Sky or Hope. A child with one of these names is offered for an educator to check, never tagged outright.
  const WORD_NAMES = new Set(('sage river june hunter rose daisy juniper aspen opal peace jack max lily ivy hazel willow rain sky sunny summer autumn ' +
    'winter dawn hope faith joy grace ruby pearl jade iris poppy violet olive clover fern forest brook rowan robin wren jay hawk fox bear birch oak ash ' +
    'cedar coral honey melody star storm ocean sea lake bay chase mark will bill frank art pat dean grant reed rush cliff gale glen april may august ' +
    'love blue berry cherry ginger pepper basil maple meadow sparrow lark dove ray sun moon cloud snow gray grey fall spring ruth hero royal king ' +
    'prince queen bliss harmony echo wolf lion tiger cotton holly heather angel bunny buddy bean penny dusty rusty sandy misty stormy rocky ' +
    'stone flint marsh field fielding sterling page ember journey legend ryder wilder river').split(/\s+/));
  const isWordName = first => WORD_NAMES.has(String(first || '').toLowerCase());
  // the children a note names, read the same way Tag the children named does on the page. A first name shared by two
  // children in the classroom is left for an educator. A name found only in the title, or a name that is also an everyday
  // word, is offered to an educator to check.
  // the class and small group every one of these children shares, if they share one
  function kidsPlace(ids) {
    const ks = [...new Set(ids)].map(id => { const r = store.recs.children.get(id); return r && !r.deleted && r.doc; }).filter(Boolean);
    if (!ks.length) return {};
    const one = a => (a.length && a.every(x => x && x === a[0])) ? a[0] : '';
    const room = one(ks.map(k => k.classroom || '')); const gname = one(ks.map(k => k.group || ''));
    const set = (store.recs.settings.get('main') || {}).doc || {};
    const group = gname ? (Array.isArray(set.groups) ? set.groups : []).find(g => g && g.name === gname && (!g.room || !room || g.room === room)) || { name: gname, room } : null;
    return { room, group };
  }
  function findChildren(text, room, title) {
    // a child's record has no id inside it, so the id is the name of its record
    const kids = [...store.recs.children].filter(([, r]) => !r.deleted && r.doc && r.doc.first && (r.doc.status || 'active') !== 'withdrawn').map(([id, r]) => Object.assign({}, r.doc, { id }));
    // the classes named are looked in first. A child from another class is found too, unless a child in a named class shares the first name
    const rooms = Array.isArray(room) ? room : room ? [room] : [];
    const inRooms = rooms.length ? kids.filter(c => rooms.includes(c.classroom)) : kids;
    const pool = [...inRooms, ...kids.filter(c => !inRooms.includes(c) && !inRooms.some(k => k.first === c.first))];
    const found = [], unsure = [], maybe = [];
    for (const c of pool) {
      const re = new RegExp('(^|[^A-Za-z])' + String(c.first).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])');
      const inNote = re.test(text), inTitle = !!title && re.test(title);
      if (!inNote && !inTitle) continue;
      const same = pool.filter(k => k.first === c.first);
      // two children who could be meant by this first name are left for an educator
      if (same.length > 1) unsure.push(c.first);
      else if (!inNote || isWordName(c.first)) maybe.push(c.id);
      else found.push(c.id);
    }
    return { ids: found, unsure: [...new Set(unsure)], maybe };
  }

  // the educator who shared it from Kaymbu, matched to their TREE sign-in by first name
  // A class's own Kaymbu account, such as West class, names no educator, so the moment carries no educator's name.
  function classNames() { const set = (store.recs.settings.get('main') || {}).doc || {}; return (Array.isArray(set.classrooms) && set.classrooms.length ? set.classrooms.map(String) : ['West', 'North', 'South']).map(words); }
  function isClassName(n) { const w = words(n).replace(/\b(class|classroom|room|fulton|community|school|farm|kaymbu)\b/g, ' ').trim(); return !w || classNames().includes(w); }
  function sharedBy(name, email) {
    const n = String(name || '').trim().replace(/^"|"$/g, '');
    const first = n.split(/\s+/)[0] || '';
    const a = (n && accountFor(n)) || (first && accountFor(first));
    if (a) return a.name;
    if (isClassName(n) || isClassName(first)) return '';
    return first || String(email || '').split('@')[0].replace(/[^A-Za-z]/g, '') || '';
  }

  async function handle(req, res, url, body, reply) {
    const key = KEY();
    if (!key) { reply(503, { error: 'The Kaymbu inbox is not turned on. Add KAYMBU_INBOX_KEY on Render.' }); return; }
    const given = String(body.key || url.searchParams.get('key') || '');
    if (!(given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key)))) { log('Kaymbu email refused, the key is not right'); reply(403, { error: 'Not allowed' }); return; }
    const from = String(body.from || ''); const email = (from.match(/<([^>]+)>/) || [, from])[1].trim().toLowerCase();
    // the kitchen's monthly Kitchen Digest brings the snack and lunch menus, from Kaymbu or forwarded by someone at the school
    if (digest && (/@([a-z0-9-]+\.)*kaymbu\.com$/.test(email) || /@childfamilycommunity\.com$/.test(email))) {
      if (!store.ready) { reply(503, { error: 'Records are still loading. The email will be tried again.' }); return; }
      const r = digest(body); if (r) { reply(200, r); return; }
    }
    const board = parseStoryboard(body.html);
    if (board && (/@([a-z0-9-]+\.)*kaymbu\.com$/.test(email) || (/@childfamilycommunity\.com$/.test(email) && /kaymbu\.com/i.test(body.html)))) {
      if (!store.ready) { reply(503, { error: 'Records are still loading. The email will be tried again.' }); return; }
      return keepMoments(board, body, from, email, reply);
    }
    if (!/@([a-z0-9-]+\.)*kaymbu\.com$/.test(email)) { log('Kaymbu inbox skipped an email that did not come from Kaymbu', email.replace(/^[^@]+/, '…')); reply(200, { ok: true, kept: 0, skipped: 'not from Kaymbu' }); return; }
    if (!store.ready) { reply(503, { error: 'Records are still loading. The email will be tried again.' }); return; }
    return keepMoments(null, body, from, email, reply);
  }

  // Moments, or the parts of a newsletter, become observations the same way
  async function keepMoments(board, body, from, email, reply) {
    const subject = String(body.subject || '').replace(/^\s*((fwd?|fw|re)\s*:\s*)+/i, '');
    let moments;
    if (board) {
      const rooms0 = readSubject(subject + ' ' + board.title).rooms;
      moments = [];
      for (const sc of board.sections) {
        const g = headingGroup(sc.heading, rooms0), note = sc.text.join('\n\n');
        const base = { title: sc.heading, note, newsletter: board.title || subject, ...(g ? { smallGroup: String(g.name), room: g.room || '', by: g.educator ? String(g.educator) : '' } : {}) };
        if (sc.photos.length) for (const ph of sc.photos) moments.push(Object.assign({ photo: ph.replace(/\?.*$/, '') }, base)); else moments.push(Object.assign({ photo: '' }, base));
      }
    } else moments = parseMoments(body.html);
    if (!moments.length) { log('Kaymbu email held no Moments'); reply(200, { ok: true, kept: 0 }); return; }
    const name = from.replace(/<[^>]*>/, '').trim();
    const sent = Date.parse(body.date) || Date.now(), onDay = subjectDay(body.subject, sent);
    const sub = readSubject(board ? subject + ' ' + board.title : body.subject);
    // the educator named in the subject comes first, since the Kaymbu sign-in belongs to the class
    // a newsletter is written by the class, so it carries an educator only from a small group or the subject, never from whoever forwarded it
    const by = sub.educator || (board ? '' : sharedBy(name, email));
    // the director sends educators' moments over from her own account, so a name that came only from her sending it is
    // kept on the moment, and TREE's readings never write it as the one who saw or said it
    const sentBy = !sub.educator && !board && !!by && !!(isDirector && isDirector(by));
    const have = new Set(live('notices').map(n => n.kaymbu && n.kaymbu.key).filter(Boolean));
    // photos sent with the same title and note may each show different children, so the named children are suggested
    // for an educator to choose from, photo by photo, rather than tagged on every photo
    const sameNote = m => (m.title + '\n' + m.note).trim().toLowerCase();
    const many = new Map(); for (const m of moments) many.set(sameNote(m), (many.get(sameNote(m)) || 0) + 1);
    let kept = 0, again = 0, check = 0, more = 0, linked = 0; const problems = []; const t0 = Date.now();
    for (const [i, m] of moments.entries()) {
      // Google waits a minute for an answer, so a large batch is kept in parts and the rest comes on the next check
      if (Date.now() - t0 > 30000) { more = moments.length - i; break; }
      const k = m.photo ? (m.photo.split('/').pop().split('?')[0].replace(/_display(\.\w+)$/i, '$1')) : crypto.createHash('sha1').update(m.title + '\n' + m.note).digest('hex').slice(0, 16);
      if (have.has(k) || seen.has(k)) {
        // a photo already kept from its Moment keeps its own words. The newsletter adds only its small group and that it was shared.
        if (board && have.has(k)) { const hit = [...store.recs.notices].find(([, r]) => !r.deleted && r.doc && r.doc.kaymbu && r.doc.kaymbu.key === k);
          if (hit) { const [nid, r] = hit, d = r.doc; let ch = false;
            if (m.smallGroup && !d.smallGroup && !d.editedBy) { d.smallGroup = m.smallGroup; ch = true; }
            if (!d.kaymbu.newsletter) { d.kaymbu = Object.assign({}, d.kaymbu, { newsletter: m.newsletter }); ch = true; }
            if (ch) { noteChange('notices', nid); scheduleSave('notices', nid); linked++; } } }
        again++; continue; }
      seen.add(k);
      try {
        let photo, p;
        if (m.photo) { p = await bestPhoto(m.photo); if (!p) throw new Error('Kaymbu would not send the photo for "' + (m.title || 'a Moment').slice(0, 40) + '"'); photo = { id: await keepPhoto(p.buf, by), w: p.w, h: p.h };
          // Kaymbu's own smaller copy is kept for cards and lists. The original above is what slides and printouts use.
          if (p.url !== m.photo) { try { const r = await getBuf(m.photo); const d = r.status === 200 && /^image\//.test(r.type) && r.buf.length < 600 * 1024 ? size(r.buf) : null; if (d) photo.thumb = await keepPhoto(r.buf, by, 'thumb'); } catch (e) {} } }
        const noticed = [m.title, m.note].filter(Boolean).join('\n');
        const rooms = m.room ? [m.room, ...sub.rooms.filter(r => r !== m.room)] : sub.rooms;
        const kids = findChildren(m.note || '', rooms, m.title || '');
        // the children named say the class and the small group when they all share one, and the group's educator shared it when nobody was named
        const fromKids = kidsPlace([...kids.ids, ...kids.maybe]);
        const room = m.room || (fromKids.room && (!sub.room || sub.rooms.length > 1 || sub.room === fromKids.room) ? fromKids.room : '') || sub.room;
        const kidGroup = !m.smallGroup && !sub.smallGroup && fromKids.group && (!fromKids.group.room || fromKids.group.room === room) ? fromKids.group : null;
        const mBy = m.by || by || (kidGroup && kidGroup.educator ? String(kidGroup.educator) : '');
        const group = (many.get(sameNote(m)) || 0) > 1 && (kids.ids.length + kids.maybe.length) > 0;
        const needs = group || !kids.ids.length || kids.unsure.length > 0 || kids.maybe.length > 0;
        // children to offer on the form, rather than tag. A group photo offers everyone named. A single photo offers the names to check.
        const offer = group ? [...kids.ids, ...kids.maybe] : kids.maybe;
        const when = onDay || photoDay(p, sent) || sent, day = laDay(when);
        const id = 'n' + (when + i).toString(36) + crypto.randomBytes(3).toString('hex');
        const binId = sub.bin ? binFor(day) : '';
        const pg = photo ? postGroup(noticed, room, day) : '';
        const sg = m.smallGroup || sub.smallGroup || (kidGroup ? String(kidGroup.name) : '');
        const doc = { id, noticed, wonder: '', classroom: room, ...(sg ? { smallGroup: sg } : {}), ...(pg ? { group: pg } : {}), ...(binId ? { bin: binId } : {}), by: mBy, at: when + i, week: mondayOf(day), projectId: sub.projectId, threadId: sub.threadId, children: group ? [] : kids.ids,
          ...(photo ? { photo } : {}),
          kaymbu: { v: 3, ...(sentBy && mBy === by ? { sentBy: 1 } : {}), ...(offer.length ? { suggest: offer } : {}), ...(!group && offer.length ? { maybe: true } : {}), key: k, src: p ? p.url : '', dated: onDay ? 'subject' : photoDay(p, sent) ? 'photo' : 'sent', subject: String(body.subject || '').slice(0, 200), mail: String(sent), keptAt: Date.now(), check: needs, ...(kids.unsure.length ? { unsure: kids.unsure } : {}), ...(m.newsletter ? { newsletter: m.newsletter, ...(m.note ? { words: true } : {}) } : {}) },
          updatedByName: mBy };
        store.recs.notices.set(id, { doc, path: `notices/${id}.json`, local: true });
        noteChange('notices', id); scheduleSave('notices', id);
        // a thread it might belong to is checked once for the whole post, a little after the last photo arrives
        if (onNotice) try { onNotice(id); } catch (e) {}
        kept++; if (needs) check++; have.add(k);
      } catch (e) { problems.push(e.message); log('A Kaymbu Moment could not be kept', e.message); }
      finally { seen.delete(k); }
    }
    if (board) log(`Kaymbu newsletter ${board.title || subject}: ${board.sections.length} parts, ${kept} observations kept${again ? `, ${again} photos already in TREE${linked ? `, ${linked} given their small group or newsletter` : ''}` : ''}${check ? `, ${check} waiting for children to be tagged` : ''}${board.dates.length ? `, ${board.dates.length} dates for families left out` : ''}`);
    else log(`Kaymbu email from ${by || "a class account"}: ${kept} moments kept${again ? `, ${again} already in TREE` : ''}${check ? `, ${check} waiting for children to be tagged` : ''}${sub.rooms.length ? ', class ' + sub.rooms.join(' and ') : ', no class in the subject'}`);
    // a Moment that could not be kept leaves the email waiting, so the Apps Script sends it again later and only that Moment is added
    if (more) { log(`Kaymbu batch from ${by || "a class account"}: ${more} moments wait for the next check`); reply(502, { error: `${kept} moments were kept. ${more} more come on the next check.`, kept, more }); return; }
    if (problems.length) { reply(502, { error: (kept ? `${kept} moments were kept. ` : '') + 'Some could not be kept yet. ' + problems[0], kept }); return; }
    reply(200, { ok: true, kept, again, check, linked, classroom: sub.room, problems, ...(board ? { newsletter: board.title, dates: board.dates } : {}) });
  }

  // moments kept before the children and the date were read properly are put right once, after the records load
  async function repair() {
    let n = 0;
    for (const [id, r] of store.recs.notices) {
      const d0 = r.doc; // a Kept by an educator changed by hand stays as they chose
      // a moment the director sent over, named only because she sent it, is marked so readings never credit her words
      if (!r.deleted && d0 && d0.kaymbu && d0.by && !d0.kaymbu.sentBy && !d0.kaymbu.sentChecked && isDirector && isDirector(d0.by)) {
        const first = String(d0.by).trim().split(/\s+/)[0].replace(/[^A-Za-z'-]/g, '');
        const named = first && new RegExp('(^|[^A-Za-z])' + first + '([^A-Za-z]|$)', 'i').test(String(d0.kaymbu.subject || ''));
        d0.kaymbu = Object.assign({}, d0.kaymbu, named ? { sentChecked: 1 } : { sentBy: 1 }); noteChange('notices', id); scheduleSave('notices', id); n++; }
      if (!r.deleted && d0 && d0.kaymbu && d0.by && !d0.editedBy && !accountFor(d0.by) && isClassName(d0.by)) { d0.by = ''; if (d0.updatedByName && isClassName(d0.updatedByName)) d0.updatedByName = ''; noteChange('notices', id); scheduleSave('notices', id); n++; }
      // a moment whose subject named only a small group was kept with no class, and is placed in that group's class now,
      // with the group's educator when it has none, whoever has edited it since
      // only for a moment nobody has changed by hand, so a small group an educator took off stays off
      if (!r.deleted && d0 && d0.kaymbu && d0.kaymbu.subject && !d0.smallGroup && !d0.editedBy) {
        const rs = readSubject(d0.kaymbu.subject);
        if (rs.smallGroup) { d0.smallGroup = rs.smallGroup; if (!d0.classroom && rs.room) d0.classroom = rs.room; if (!d0.by && rs.educator) d0.by = rs.educator; noteChange('notices', id); scheduleSave('notices', id); n++; }
      }
      // a moment kept before the subject's educator was read takes that educator, once, unless an educator has changed it by hand
      if (!r.deleted && d0 && d0.kaymbu && d0.kaymbu.subject && !d0.kaymbu.byFixed && !d0.editedBy && (!d0.updatedByName || isClassName(d0.updatedByName) || d0.updatedByName === d0.by)) {
        const ed = readSubject(d0.kaymbu.subject).educator;
        if (ed && ed !== d0.by) { d0.by = ed; d0.kaymbu = Object.assign({}, d0.kaymbu, { byFixed: 1 }); noteChange('notices', id); scheduleSave('notices', id); n++; }
      }
      // Photos from a newsletter part with no words, such as The Faces of North class, were removed by an earlier clean up,
      // and a newsletter part with no words is no longer kept at all. That clean up no longer runs, since a Moment kept from
      // its own email and then seen again in a newsletter looks the same and must never be removed.
      const d = r.doc; if (r.deleted || !d || !d.kaymbu || d.kaymbu.v >= 3) continue;
      if (d.kaymbu.v === 2) {
        const twins = live('notices').filter(o => o !== d && o.kaymbu && (o.noticed || '').trim() === (d.noticed || '').trim() && o.classroom === d.classroom).length;
        const ids = (d.children || []).filter(Boolean);
        d.kaymbu = Object.assign({}, d.kaymbu, { v: 3 });
        if (twins && ids.length && !d.kaymbu.checkedBy) { d.kaymbu.suggest = ids; d.children = []; d.kaymbu.check = true; }
        noteChange('notices', id); scheduleSave('notices', id); n++; continue;
      }
      const kids = findChildren(d.noticed || '', d.classroom || '');
      const ids = [...new Set([...(d.children || []).filter(Boolean), ...kids.ids])];
      let at = d.at;
      if (!d.kaymbu.dated && d.kaymbu.key && /^[0-9a-f]{4}/i.test(d.kaymbu.key)) {
        const k = d.kaymbu.key, src = `https://d2k9f6tk478nyp.cloudfront.net/media/57b153851133e182c4001217/${laDay(d.at).slice(0, 4)}/moments/${k[0]}/${k[1]}/${k[2]}/${k[3]}/${k}`;
        try { const res = await new Promise((ok, no) => { const q = https.request(src, { method: 'HEAD' }, x => { x.resume(); ok(x); }); q.setTimeout(20000, () => q.destroy(new Error('timeout'))); q.on('error', no); q.end(); });
          const mod = res.statusCode === 200 ? Date.parse(res.headers['last-modified'] || '') : 0; if (photoDay({ modified: mod }, d.at)) at = mod; } catch (e) {}
      }
      const left = !ids.length || kids.unsure.length > 0;
      const moved = at !== d.at;
      Object.assign(d, { children: ids, at, week: mondayOf(laDay(at)) });
      d.kaymbu = Object.assign({}, d.kaymbu, { v: 3, dated: moved ? 'photo' : (d.kaymbu.dated || 'sent'), check: d.kaymbu.check === false && d.kaymbu.checkedBy ? false : left });
      if (kids.unsure.length) d.kaymbu.unsure = kids.unsure; else delete d.kaymbu.unsure;
      noteChange('notices', id); scheduleSave('notices', id); n++;
    }
    if (n) log('Kaymbu moments put right for their children and the day they were taken,', n);
    // photos of one post kept before posts carried a group are given one now, once, by the same rule
    let g = 0;
    for (const [id, r] of store.recs.notices) {
      const d = r.doc; if (r.deleted || !d || !d.kaymbu || !d.photo || d.group) continue;
      const pg = postGroup(d.noticed, d.classroom, laDay(d.at)); if (!pg) continue;
      d.group = pg; noteChange('notices', id); scheduleSave('notices', id); g++;
    }
    if (g) log('Kaymbu photos given the group of their post,', g);
  }

  return { handle, repair, postGroup, subjectDay, parseMoments, parseStoryboard, headingGroup, size, readSubject, findChildren, statusLine: () => [!!KEY(), KEY() ? 'The Kaymbu inbox is on, so Moments shared from Kaymbu to the TREE address arrive as moments.' : 'The Kaymbu inbox is off. Add KAYMBU_INBOX_KEY under Environment to bring Kaymbu Moments into TREE.'] };
};
