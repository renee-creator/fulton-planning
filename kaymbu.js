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

module.exports = function kaymbu({ store, log, gh, repo, noteChange, scheduleSave, cacheFile, accountFor }) {
  const KEY = () => String(process.env.KAYMBU_INBOX_KEY || '').trim();
  const PHOTO_HOST = /^d[a-z0-9]+\.cloudfront\.net$/i;
  const seen = new Set();   // Moments being kept right now, so a second copy of the same email waits its turn

  const decode = s => String(s || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').trim();

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

  function getBuf(url, hops = 0) {
    return new Promise((resolve, reject) => {
      let u; try { u = new URL(url); } catch (e) { reject(new Error('bad address')); return; }
      if (u.protocol !== 'https:' || !PHOTO_HOST.test(u.hostname)) { reject(new Error('not a Kaymbu photo address')); return; }
      const req = https.get(u, { headers: { 'User-Agent': 'TREE' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) { res.resume(); resolve(getBuf(new URL(res.headers.location, u).href, hops + 1)); return; }
        const chunks = []; let size = 0;
        res.on('data', c => { size += c.length; if (size > 15 * 1024 * 1024) req.destroy(new Error('too large')); else chunks.push(c); });
        res.on('end', () => resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), buf: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      req.setTimeout(30000, () => req.destroy(new Error('Kaymbu did not answer in time')));
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
      try { const r = await getBuf(t); const d = r.status === 200 && /^image\//.test(r.type) ? size(r.buf) : null; if (d && (!best || d.w * d.h > best.w * best.h)) best = Object.assign({ buf: r.buf, url: t }, d); }
      catch (e) {}
    }
    return best;
  }

  async function keepPhoto(buf, by) {
    const id = crypto.randomBytes(6).toString('hex') + '-moment-kaymbu.jpg';
    const r = await gh('PUT', `/repos/${repo}/contents/originals/${id}`, { message: `Add moment photo from Kaymbu shared by ${by}`, content: buf.toString('base64'), branch: store.branch });
    if (r.status !== 201 && r.status !== 200) throw new Error('GitHub answered ' + r.status + ' when keeping a Kaymbu photo');
    store.originals.set(id, { path: `originals/${id}`, sha: r.json.content.sha, size: buf.length }); cacheFile(id, buf);
    return id;
  }

  const laDay = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  function mondayOf(day) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
  const live = kind => [...store.recs[kind].values()].filter(r => !r.deleted).map(r => r.doc);
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();

  // the subject names the classroom, and can also name a project or a thread the moments belong to
  function readSubject(subject) {
    const set = (store.recs.settings.get('main') || {}).doc || {};
    const rooms = Array.isArray(set.classrooms) && set.classrooms.length ? set.classrooms.map(String) : ['West', 'North', 'South'];
    const s = ' ' + words(subject) + ' ';
    const room = rooms.find(r => s.includes(' ' + words(r) + ' ')) || '';
    const named = (list, key) => list.filter(x => x[key] && words(x[key]).length > 2 && s.includes(' ' + words(x[key]) + ' ')).sort((a, b) => String(b[key]).length - String(a[key]).length)[0];
    const project = named(live('projects').filter(p => p.status !== 'closed'), 'name');
    const thread = named(live('threads').filter(t => t.status !== 'stopped'), 'name');
    return { room, projectId: project ? project.id : '', threadId: thread ? thread.id : '' };
  }

  // the children a note names, read the same way Tag the children named does on the page. A first name shared by two
  // children in the classroom is left for an educator.
  function findChildren(text, room) {
    const kids = live('children').filter(c => c.first && (c.status || 'active') !== 'withdrawn');
    const pool = room ? kids.filter(c => c.classroom === room) : kids;
    const found = [], unsure = [];
    for (const c of pool) {
      const re = new RegExp('(^|[^A-Za-z])' + String(c.first).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])');
      if (!re.test(text)) continue;
      if (pool.filter(k => k.first === c.first).length > 1) unsure.push(c.first); else found.push(c.id);
    }
    return { ids: found, unsure: [...new Set(unsure)] };
  }

  // the educator who shared it from Kaymbu, matched to their TREE sign-in by first name
  function sharedBy(name, email) {
    const n = String(name || '').trim().replace(/^"|"$/g, '');
    const first = n.split(/\s+/)[0] || '';
    const a = (n && accountFor(n)) || (first && accountFor(first));
    return a ? a.name : (first || String(email || '').split('@')[0] || 'Kaymbu');
  }

  async function handle(req, res, url, body, reply) {
    const key = KEY();
    if (!key) { reply(503, { error: 'The Kaymbu inbox is not turned on. Add KAYMBU_INBOX_KEY on Render.' }); return; }
    const given = String(body.key || url.searchParams.get('key') || '');
    if (!(given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key)))) { log('Kaymbu email refused, the key is not right'); reply(403, { error: 'Not allowed' }); return; }
    const from = String(body.from || ''); const email = (from.match(/<([^>]+)>/) || [, from])[1].trim().toLowerCase();
    if (!/@([a-z0-9-]+\.)*kaymbu\.com$/.test(email)) { log('Kaymbu inbox skipped an email that did not come from Kaymbu', email.replace(/^[^@]+/, '…')); reply(200, { ok: true, kept: 0, skipped: 'not from Kaymbu' }); return; }
    if (!store.ready) { reply(503, { error: 'Records are still loading. The email will be tried again.' }); return; }
    const moments = parseMoments(body.html);
    if (!moments.length) { log('Kaymbu email held no Moments'); reply(200, { ok: true, kept: 0 }); return; }
    const name = from.replace(/<[^>]*>/, '').trim(), by = sharedBy(name, email);
    const when = Date.parse(body.date) || Date.now(), day = laDay(when);
    const sub = readSubject(body.subject);
    const have = new Set(live('notices').map(n => n.kaymbu && n.kaymbu.key).filter(Boolean));
    let kept = 0, again = 0, check = 0; const problems = [];
    for (const [i, m] of moments.entries()) {
      const k = m.photo ? (m.photo.split('/').pop().split('?')[0].replace(/_display(\.\w+)$/i, '$1')) : crypto.createHash('sha1').update(m.title + '\n' + m.note).digest('hex').slice(0, 16);
      if (have.has(k) || seen.has(k)) { again++; continue; }
      seen.add(k);
      try {
        let photo;
        if (m.photo) { const p = await bestPhoto(m.photo); if (!p) throw new Error('Kaymbu would not send the photo for "' + (m.title || 'a Moment').slice(0, 40) + '"'); photo = { id: await keepPhoto(p.buf, by), w: p.w, h: p.h }; }
        const noticed = [m.title, m.note].filter(Boolean).join('\n');
        const kids = findChildren(noticed, sub.room);
        const needs = !sub.room || !kids.ids.length || kids.unsure.length > 0;
        const id = 'n' + (when + i).toString(36) + crypto.randomBytes(3).toString('hex');
        const doc = { id, noticed, wonder: '', classroom: sub.room, by, at: when + i, week: mondayOf(day), projectId: sub.projectId, threadId: sub.threadId, children: kids.ids,
          ...(photo ? { photo } : {}),
          kaymbu: { key: k, subject: String(body.subject || '').slice(0, 200), keptAt: Date.now(), check: needs, ...(kids.unsure.length ? { unsure: kids.unsure } : {}) },
          updatedByName: by };
        store.recs.notices.set(id, { doc, path: `notices/${id}.json`, local: true });
        noteChange('notices', id); scheduleSave('notices', id);
        kept++; if (needs) check++; have.add(k);
      } catch (e) { problems.push(e.message); log('A Kaymbu Moment could not be kept', e.message); }
      finally { seen.delete(k); }
    }
    log(`Kaymbu email from ${by}: ${kept} moments kept${again ? `, ${again} already in TREE` : ''}${check ? `, ${check} waiting for children to be tagged` : ''}${sub.room ? ', classroom ' + sub.room : ', no classroom in the subject'}`);
    // a Moment that could not be kept leaves the email waiting, so the Apps Script sends it again later and only that Moment is added
    if (problems.length) { reply(502, { error: (kept ? `${kept} moments were kept. ` : '') + 'Some could not be kept yet. ' + problems[0], kept }); return; }
    reply(200, { ok: true, kept, again, check, classroom: sub.room, problems });
  }

  return { handle, parseMoments, size, readSubject, findChildren, statusLine: () => [!!KEY(), KEY() ? 'The Kaymbu inbox is on, so Moments shared from Kaymbu to the TREE address arrive as moments.' : 'The Kaymbu inbox is off. Add KAYMBU_INBOX_KEY under Environment to bring Kaymbu Moments into TREE.'] };
};
