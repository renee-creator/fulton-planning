'use strict';
/* Monthly menus from Kitchen's Kitchen Digest.
   Kitchen sends each month's lunch and snack menus as PDFs inside her Kaymbu Kitchen Digest. A menus record that holds
   only the digest's two links, under "intake", is filled in here. The server opens each PDF, Claude reads it into
   days with the same instructions the Settings page uses, and the month is saved. Days the director already wrote
   are never replaced. The director checks the month in Settings, under Monthly menus, like any other. */
const https = require('https');

const HOSTS = /(^|\.)(kaymbu\.com|cloudfront\.net|amazonaws\.com|sendgrid\.net)$/i;

const MENU_PROMPT = `This is a preschool's monthly menu, either the snack menu or the lunch menu. Read every school day on it.
Use the weekday column headings and the day numbers to give each day its full date. Copy what is served exactly as the menu says, only putting it in sentence case. When a day's lunch is written on two or three lines, join them into one with "and" or commas, such as "Pinto beans, brown rice and cheese". On the snack menu, "Am" is the morning snack and "Pm" is the afternoon snack. Monday has a morning snack only. A day marked No School is closed. Leave a field empty when the menu shows nothing for it. Never add an item that is not on the menu.
Copy the note at the top of the menu, about what is served with every meal, in plain sentences.
Do not use colons or dashes in what you write.

Return a JSON object with "kind", either "snack" or "lunch", "month" as YYYY-MM, "note", and "days", an array of objects with "date" as YYYY-MM-DD, "am", "pm", "lunch" and "closed", true or false. Return only the JSON.`;

module.exports = function menuIntake({ store, log, askClaude, anthropicKey, noteChange, scheduleSave }) {
  let running = false; let last = '';

  function getFile(url, hops = 0) {
    return new Promise((resolve, reject) => {
      let u; try { u = new URL(url); } catch (e) { reject(new Error('bad address')); return; }
      if (!/^https?:$/.test(u.protocol) || !HOSTS.test(u.hostname)) { reject(new Error('the link left Kaymbu, to ' + u.hostname)); return; }
      const lib = u.protocol === 'http:' ? require('http') : https;
      const req = lib.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 TREE' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 6) { res.resume(); resolve(getFile(new URL(res.headers.location, u).href, hops + 1)); return; }
        const chunks = []; let size = 0;
        res.on('data', c => { size += c.length; if (size > 25 * 1024 * 1024) req.destroy(new Error('too large')); else chunks.push(c); });
        res.on('end', () => resolve({ status: res.statusCode, type: String(res.headers['content-type'] || ''), buf: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      req.setTimeout(30000, () => req.destroy(new Error('Kaymbu did not answer in time')));
      req.on('error', reject);
    });
  }

  async function readPdf(buf) {
    const r = await askClaude([{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }, { type: 'text', text: MENU_PROMPT }], true);
    if (r.status !== 200) throw new Error('Claude answered ' + r.status);
    const t = (JSON.parse(r.text).content || []).filter(x => x.type === 'text').map(x => x.text).join('');
    return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  }

  // what Claude read goes into the month, without replacing anything already written for a day
  function merge(doc, o, label) {
    const kind = /lunch/i.test(label) ? 'lunch' : /snack/i.test(label) ? 'snack' : (o.kind === 'lunch' ? 'lunch' : 'snack');
    let n = 0, other = 0;
    for (const d of Array.isArray(o.days) ? o.days : []) {
      const day = String((d && d.date) || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      if (day.slice(0, 7) !== doc.month) { other++; continue; }
      const wd = new Date(day + 'T12:00:00Z').getUTCDay(); if (wd === 0 || wd === 6) continue;
      const x = doc.days[day] || (doc.days[day] = {});
      if (d.closed) { x.closed = true; n++; continue; }
      const put = (k, v) => { v = String(v || '').trim(); if (v && !String(x[k] || '').trim()) { x[k] = v; n++; } };
      if (kind === 'lunch') put('lunch', d.lunch); else { put('am', d.am); if (wd !== 1) put('pm', d.pm); }
    }
    if (o.note && !(doc.notes[kind] || '').trim()) doc.notes[kind] = String(o.note).trim();
    return { kind, n, other };
  }

  async function run() {
    if (running || !store.ready) return; if (!anthropicKey()) { last = 'Claude assist is not set up, so menus from the Kitchen Digest wait.'; return; }
    running = true;
    try {
      for (const [id, r] of store.recs.menus) {
        const doc = r.doc; if (r.deleted || !doc || !doc.intake || doc.intake.done || (doc.intake.tries || 0) >= 3) continue;
        doc.days = doc.days || {}; doc.notes = doc.notes || {}; const errors = [];
        for (const f of doc.intake.files || []) {
          if (f.done) continue;
          try {
            const g = await getFile(f.url);
            if (g.status !== 200) throw new Error('Kaymbu answered ' + g.status);
            if (g.buf.slice(0, 5).toString('latin1') !== '%PDF-') throw new Error('Kaymbu sent ' + (g.type || 'something') + ' rather than a PDF');
            const o = await readPdf(g.buf); const m = merge(doc, o, f.label || '');
            f.done = true; f.kind = m.kind; f.days = m.n;
            if (m.other) errors.push(`${f.label || m.kind} also listed ${m.other} day${m.other === 1 ? '' : 's'} outside ${doc.month}, left out`);
            log('Menu read from the Kitchen Digest,', doc.month, f.label || m.kind + ',', m.n, 'entries');
          } catch (e) { errors.push(`${f.label || 'A menu'} could not be read, ${e.message}`); log('Menu from the Kitchen Digest could not be read,', doc.month, f.label || '', e.message); }
        }
        doc.intake.tries = (doc.intake.tries || 0) + 1;
        doc.intake.notes = errors;
        if ((doc.intake.files || []).every(f => f.done)) doc.intake.done = Date.now();
        doc.updatedByName = doc.updatedByName || 'TREE';
        r.local = true; noteChange('menus', id); scheduleSave('menus', id);
      }
      const all = [...store.recs.menus.values()].filter(r => !r.deleted && r.doc && r.doc.intake);
      const waiting = all.filter(r => !r.doc.intake.done);
      last = all.length ? `Menus from the Kitchen Digest, ${all.length - waiting.length} month${all.length - waiting.length === 1 ? '' : 's'} read` + (waiting.length ? `, ${waiting.length} not yet (${waiting.map(r => r.doc.month).join(', ')}).` : '.') : '';
    } finally { running = false; }
  }

  // Kitchen's Kitchen Digest, arriving in the TREE mailbox from Kaymbu or forwarded by staff. Its file blocks hold the
  // lunch and snack PDFs. The month comes from the digest's own heading, or from when it was sent, since Kitchen sends
  // late in the month before or early in the month itself.
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function isDigest(html, subject) { return /kitchen digest/i.test(String(subject || '') + ' ' + String(html || '').slice(0, 20000)) && /fileAttachmentBlock/i.test(String(html || '')); }
  function fromDigest(body) {
    const html = String(body.html || ''); if (!isDigest(html, body.subject)) return null;
    const files = [];
    for (const part of html.split(/data-block-id="fileAttachmentBlock"/i).slice(1)) {
      const a = part.match(/<a[^>]+href="([^"]+)"/i); if (!a) continue;
      const desc = part.match(/data-id="description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
      const label = desc ? desc[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : '';
      files.push({ label, url: a[1].replace(/&amp;/g, '&') });
      if (files.length >= 4) break;
    }
    if (!files.length) return { ok: true, kept: 0, skipped: 'a Kitchen Digest with no menus attached' };
    const sent = new Date(Date.parse(body.date) || Date.now());
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').slice(0, 4000).toLowerCase();
    let month = '';
    const named = text.match(new RegExp('\\b(' + MONTHS.join('|') + ')\\s+(20\\d\\d)\\b'));
    if (named) month = named[2] + '-' + String(MONTHS.indexOf(named[1]) + 1).padStart(2, '0');
    if (!month) { const la = new Date(sent.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })); let y = la.getFullYear(), m = la.getMonth() + 1; if (la.getDate() >= 20) { m++; if (m > 12) { m = 1; y++; } } month = y + '-' + String(m).padStart(2, '0'); }
    const cur = store.recs.menus.get(month);
    let doc = cur && !cur.deleted ? cur.doc : null;
    if (doc && doc.intake && (doc.intake.files || []).some(f => files.some(g => g.url === f.url))) return { ok: true, kept: 0, again: 'the ' + month + ' menus are already in TREE' };
    if (!doc) doc = { id: month, month, days: {}, notes: {}, files: {}, by: "Kitchen's Kitchen Digest", updatedByName: 'TREE' };
    if (!doc.times) { const last = [...store.recs.menus.values()].map(r => r.doc).filter(d => d && d.times && d.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]; if (last) doc.times = Object.assign({}, last.times); }
    doc.intake = { from: 'Kitchen Digest sent ' + sent.toISOString().slice(0, 10), files };
    store.recs.menus.set(month, { doc, sha: cur && cur.sha, path: `menus/${month}.json`, local: true });
    noteChange('menus', month); scheduleSave('menus', month);
    log('Kitchen Digest arrived for', month + ',', files.length, 'menus to read');
    setTimeout(() => run().catch(e => log('Menus from the Kitchen Digest could not be read', e.message)), 1000).unref();
    return { ok: true, menus: month, files: files.length };
  }

  return { run, fromDigest, isDigest, statusLine: () => [!/not yet|not set up/.test(last), last || 'No menus are waiting from the Kitchen Digest.'] };
};
