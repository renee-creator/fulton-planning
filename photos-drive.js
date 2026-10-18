'use strict';
// Photos kept in the school's Google Drive.
// The TREE mailbox's Apps Script, the one that already reads Kaymbu emails, also answers as a small web app that keeps
// photos in a TREE photos folder in that account's Drive and hands them back. No other service is involved.
// Each photo kept there leaves a small marker in the records, photos/<id>~<drive id>~<size>.ref, so TREE knows where it
// is without asking Drive. Photos already in the records are moved to Drive a few at a time, and a photo is only taken
// out of the records once Drive has it. If Drive cannot be reached, a new photo is kept in the records as before.
const https = require('https');
const http = require('http');

module.exports = function ({ store, log, gh, repo, readPhoto, cacheFile }) {
  const URL_ = () => String(process.env.DRIVE_PHOTOS_URL || '').trim();
  const KEY = () => String(process.env.KAYMBU_INBOX_KEY || '').trim();
  const on = () => !!(URL_() && KEY());
  const REF = /^photos\/([a-z0-9][a-z0-9._-]{0,150})~([A-Za-z0-9_-]{10,})~(\d+)\.ref$/i;

  // Apps Script answers a POST with a redirect to the reply, which is then read with a GET
  function call(body, timeout = 90000) {
    return new Promise((resolve, reject) => {
      const go = (url, method, data, hops) => {
        const u = new URL(url);
        const req = (u.protocol === 'http:' ? http : https).request({ method, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, res => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 5) { res.resume(); go(new URL(res.headers.location, url).toString(), res.statusCode === 307 || res.statusCode === 308 ? method : 'GET', res.statusCode === 307 || res.statusCode === 308 ? data : null, hops + 1); return; }
          const chunks = []; res.on('data', c => chunks.push(c));
          res.on('end', () => { const t = Buffer.concat(chunks).toString('utf8'); let j = null; try { j = JSON.parse(t); } catch (e) {}
            if (!j) { reject(new Error('Drive answered ' + res.statusCode + ' without a reply TREE can read')); return; }
            if (j.error) { reject(new Error('Drive said ' + j.error)); return; }
            resolve(j); });
          res.on('error', reject);
        });
        req.setTimeout(timeout, () => req.destroy(new Error('Drive did not answer in time')));
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
      };
      go(URL_(), 'POST', JSON.stringify(Object.assign({ key: KEY() }, body)), 0);
    });
  }

  function seen(path) { const m = path.match(REF); if (!m) return false; store.originals.set(m[1], { drive: m[2], size: Number(m[3]) || 0, ref: path }); return true; }

  async function mark(id, driveId, size) {
    const path = `photos/${id}~${driveId}~${size}.ref`;
    for (let k = 0; k < 4; k++) {
      if (k) await new Promise(ok => setTimeout(ok, 1500 * k));
      const r = await gh('PUT', `/repos/${repo}/contents/${path}`, { message: `Photo ${id} kept in Google Drive`, content: Buffer.from(driveId).toString('base64'), branch: store.branch });
      if (r.status === 201 || r.status === 200) return path;
      if (r.status === 422 && /already exists|sha/i.test((r.json && r.json.message) || '')) return path;
      if (r.status !== 409 && r.status !== 422 && r.status < 500) break;
    }
    throw new Error('the records would not keep the marker for ' + id);
  }

  // keeps a new photo in Drive. Returns false when Drive is not set up or could not take it, so the caller keeps it in the records.
  async function keep(id, buf, type) {
    if (!on()) return false;
    try {
      const j = await call({ op: 'put', name: id, type: type || 'image/jpeg', data: buf.toString('base64') });
      if (!j.id) throw new Error('no file id came back');
      const ref = await mark(id, j.id, buf.length);
      store.originals.set(id, { drive: j.id, size: buf.length, ref }); cacheFile(id, buf);
      return true;
    } catch (e) { log('Photo could not be kept in Google Drive, kept in the records instead', id.slice(0, 60), e.message); return false; }
  }

  async function read(o) {
    const j = await call({ op: 'get', id: o.drive });
    if (!j.data) throw new Error('Drive sent no photo');
    return Buffer.from(j.data, 'base64');
  }

  // photos still in the records move to Drive, one at a time, and leave the records once Drive has them
  let moving = false;
  async function moveAll() {
    if (!on() || moving || !store.ready) return; moving = true;
    let n = 0, failed = 0;
    try {
      const left = [...store.originals.entries()].filter(([, o]) => o.sha && !o.drive);
      if (left.length) log(`Moving ${left.length} photos from the records to Google Drive`);
      for (const [id, o] of left) {
        try {
          const b = await readPhoto(o.sha); if (b.status !== 200) throw new Error('the records answered ' + b.status);
          const ext = id.split('.').pop().toLowerCase();
          const type = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || 'application/octet-stream';
          const j = await call({ op: 'put', name: id, type, data: b.buf.toString('base64') });
          if (!j.id) throw new Error('no file id came back');
          const ref = await mark(id, j.id, b.buf.length);
          store.originals.set(id, { drive: j.id, size: b.buf.length, ref });
          // only now that Drive holds it and the marker is saved does the photo leave the records
          const d = await gh('DELETE', `/repos/${repo}/contents/${o.path}`, { message: `Photo ${id} moved to Google Drive`, sha: o.sha, branch: store.branch });
          if (d.status !== 200 && d.status !== 404) log('A moved photo stays in the records for now', id.slice(0, 60), d.status);
          n++;
        } catch (e) { failed++; log('A photo could not move to Google Drive yet', id.slice(0, 60), e.message); if (failed > 5) break; }
      }
      if (n || failed) log(`${n} photos moved to Google Drive${failed ? `, ${failed} wait for the next try` : ''}`);
    } finally { moving = false; }
    if (failed) setTimeout(moveAll, 30 * 60e3).unref();
  }

  async function ping() { if (!on()) return 'Google Drive photos are not set up'; try { const j = await call({ op: 'ping' }, 30000); return 'Google Drive photos answer, folder ' + (j.folder || ''); } catch (e) { return 'Google Drive photos did not answer. ' + e.message; } }

  return { on, seen, keep, read, moveAll, ping };
};
