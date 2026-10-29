'use strict';
/* The Policies and Procedures and the Family Handbook, each in full in the records, section by section.

   The Policies and Procedures live in staff/policies/teacher.json, which holds the order of every part and
   section, with each section in staff/policies/teacher/<id>.json. A section TREE already kept elsewhere, such as How
   Check-Ins Work in staff/handbook or a Licensing at Fulton piece in staff/pd/licensing, is shown and edited where it is
   kept, never copied. Its section file holds only where it lives and its earlier versions.

   The Family Handbook lives in family/handbook/<year>/, one folder for each edition, with edition.json and a file for
   each section. A draft edition reads every section it has not changed from the edition it started from. An edition
   becomes current on its publish date, worked out from the date each time it is asked for, so no job has to run.

   Every change keeps the earlier wording in the section's own record, with the day, who and the note, so the director
   can read or restore it in TREE. The Policies and Procedures go only to staff sign-ins, the Family Handbook to
   staff, to families through the Family page, and to the public link once the director turns it on. */
const path = require('path');

module.exports = function policies(o) {
  const { get, put, putText, S, log, person, pPath, staffNames, isDirector, isKitchen, nameKey, today, allowed, hasOwn, profileOf, accountFor, store, readImage, roleNames, piecesChanged } = o;
  const TP = 'staff/policies/teacher.json', TPS = id => `staff/policies/teacher/${id}.json`;
  const FH = 'family/handbook/', FHE = y => `${FH}${y}/edition.json`, FHS = (y, id) => `${FH}${y}/${id}.json`, PUB = `${FH}public.json`;
  const slug = t => String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const now = () => Date.now();
  const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

  /* ---------- a Licensing at Fulton piece, read and written as a section ---------- */
  // the piece's own settings and title stay as they are. Its One question is the PD library's and stays with the piece.
  function pieceParts(text) {
    const m = String(text || '').match(/^\s*<!--[\s\S]*?-->\s*/); const meta = m ? m[0] : ''; const rest = String(text || '').slice(meta.length);
    const t = rest.match(/^##\s+(.+)$/m); if (!t) return null;
    const after = rest.slice(t.index + t[0].length); const q = after.search(/^###\s+One question\b/mi);
    return { meta, head: rest.slice(0, t.index), title: t[1].trim(), body: (q >= 0 ? after.slice(0, q) : after).trim(), tail: q >= 0 ? after.slice(q).trim() : '' };
  }
  const pieceText = (pp, title, body) => `${pp.meta}${pp.head}## ${title}\n\n${body.trim()}${pp.tail ? '\n\n' + pp.tail : ''}\n`;

  /* ---------- the Policies and Procedures ---------- */
  // records from before the full document came into TREE still read as one, made of the sections in staff/handbook
  const tpDoc = () => get(TP) || (() => { const hs = [...S.files.keys()].filter(p => /^staff\/handbook\/[^/]+\.json$/.test(p)).map(p => Object.assign({ p }, get(p) || {})).filter(h => h.id && h.title).sort((a, b) => (a.order || 0) - (b.order || 0));
    return hs.length ? { title: 'Policies and Procedures', edition: '', mustRead: [], parts: hs.map(h => ({ id: h.id, title: h.title, sections: [{ id: h.id, ref: h.p }] })) } : null; })();
  const entries = () => { const d = tpDoc(); return d ? (d.parts || []).flatMap(p => (p.sections || []).map(s => Object.assign({ part: p.id }, typeof s === 'string' ? { id: s } : s))) : []; };
  function tpSection(e) {
    const rec = get(TPS(e.id)) || { id: e.id, history: [] }; const ref = rec.ref || e.ref || '';
    const base = { id: e.id, part: e.part, history: rec.history || [], note: rec.note || '', removed: !!rec.removed, directorOnly: !!rec.directorOnly, changedAt: rec.changedAt || 0, changeNote: rec.changeNote || '', ref };
    if (/\.json$/.test(ref)) { const h = get(ref) || {}; return Object.assign(base, { title: h.title || '', body: h.body || '', updatedAt: rec.updatedAt || h.updatedAt || 0, updatedBy: rec.updatedBy || h.updatedBy || '', kind: 'handbook', removed: base.removed || !!h.removed }); }
    if (/\.md$/.test(ref)) { const r = S.files.get(ref); const pp = r && typeof r.text === 'string' ? pieceParts(r.text) : null;
      return Object.assign(base, { title: pp ? pp.title : '', body: pp ? pp.body : '', updatedAt: rec.updatedAt || 0, updatedBy: rec.updatedBy || '', kind: 'piece', piece: 'licensing/' + path.basename(ref, '.md') }); }
    return Object.assign(base, { title: rec.title || '', body: rec.body || '', updatedAt: rec.updatedAt || 0, updatedBy: rec.updatedBy || '', kind: 'own' });
  }
  // an image in a section is named from where its record sits, so the page asks for it by its place in the records
  const imgFix = (body, dir) => String(body || '').replace(/!\[([^\]]*)\]\(((?!https?:)[^)\s]+)\)/g, (m, alt, p) => `![${alt}](${path.posix.normalize(dir + '/' + p)})`);

  /* ---------- the Family Handbook's editions ---------- */
  const years = () => [...S.files.keys()].map(p => (p.match(/^family\/handbook\/(\d{4})\/edition\.json$/) || [])[1]).filter(Boolean).sort();
  const edition = y => get(FHE(y)) || null;
  const isLive = y => { const e = edition(y); return !!e && (e.published === true || (/^\d{4}-\d{2}-\d{2}$/.test(e.publishOn || '') && e.publishOn <= today())); };
  const current = () => years().filter(isLive).pop() || '';
  function fhSection(y, id) {
    let yy = y; const seen = new Set();
    while (yy && !seen.has(yy)) { seen.add(yy); const r = get(FHS(yy, id)); if (r) return Object.assign({}, r, { id, edition: yy, same: yy !== y }); yy = (edition(yy) || {}).from || ''; }
    return null;
  }
  function fhOut(y, opt) {
    opt = opt || {}; const e = edition(y); if (!e) return null; const hide = opt.hide || {};
    const parts = (e.parts || []).map(p => ({ id: p.id, title: p.title, sections: (p.sections || []).map(id => fhSection(y, id)).filter(s => s && (opt.director || !s.removed) && !hide[s.id])
      .map(s => Object.assign({ id: s.id, title: s.title || '', body: imgFix(s.body, FH + s.edition), updatedAt: s.updatedAt || 0, removed: !!s.removed }, opt.director ? { updatedBy: s.updatedBy || '', note: s.note || '', history: s.same ? [] : (s.history || []), same: s.same, from: s.edition } : {})) })).filter(p => p.sections.length || opt.director);
    return { doc: 'family', title: e.title || 'Family Handbook', edition: y, current: current(), live: isLive(y), publishOn: e.publishOn || '', from: e.from || '', cover: e.cover || [], image: e.image ? path.posix.normalize(FH + y + '/' + e.image) : '', footer: e.footer || '', parts };
  }

  /* ---------- who may read ---------- */
  const canTeacher = me => isDirector(me) || (!isKitchen(me) && (allowed(me, 'handbook') || allowed(me, 'newed')));
  const canFamily = me => isDirector(me) || (!isKitchen(me) && (allowed(me, 'family') || allowed(me, 'newed')));
  // someone who has left reads nothing new and is no longer asked to acknowledge
  const former = n => { const a = accountFor(n) || {}, t = today(); const pf = profileOf(n) || {}; return !!((a.leaveOn && a.leaveOn < t) || (pf.leftOn && pf.leftOn < t)); };
  const readers = () => staffNames().filter(n => !isDirector(n) && !isKitchen(n) && profileOf(n).role !== 'staff' && !former(n));

  function teacherOut(me, opt) {
    const d = tpDoc(); if (!d) return null; const dir = isDirector(me) && !(opt && opt.asStaff);
    const parts = (d.parts || []).map(p => ({ id: p.id, title: p.title, sections: (p.sections || []).map(s => tpSection(Object.assign({ part: p.id }, typeof s === 'string' ? { id: s } : s)))
      .filter(s => dir || (!s.removed && !s.directorOnly))
      .map(s => Object.assign({ id: s.id, title: s.title, body: imgFix(s.body, 'staff/policies'), updatedAt: s.updatedAt, kind: s.kind, piece: s.piece || '', changedAt: s.changedAt, changeNote: s.changeNote, removed: s.removed, directorOnly: s.directorOnly }, dir ? { updatedBy: s.updatedBy, note: s.note, history: s.history, ref: s.ref } : {})) })).filter(p => p.sections.length);
    return { doc: 'teacher', title: d.title, edition: d.edition || '', cover: d.cover || [], image: d.image ? 'staff/policies/' + d.image : '', footer: d.footer || '', mustRead: d.mustRead || [], parts };
  }

  /* ---------- acknowledgments ---------- */
  // the school year starts in August. An acknowledgment from this school year counts, and a section the director marks as
  // a significant change after it is acknowledged again.
  const yearOf = d => { const y = +d.slice(0, 4); return String(+d.slice(5, 7) >= 8 ? y : y - 1); };
  function ackOf(name) {
    const p = person(name); const a = p.tpAck || {}; const y = yearOf(today()); const ys = y + '-08-01';
    const legacy = ((p.paperwork || {}).tppack || {}).ack || 0;
    const yearAt = (a.years || {})[y] || (legacy && new Date(legacy).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) >= ys ? legacy : 0);
    const changed = entries().map(tpSection).filter(s => !s.removed && !s.directorOnly && s.changedAt && s.changedAt > yearAt && s.changedAt > ((a.sections || {})[s.id] || 0)).map(s => ({ id: s.id, title: s.title, changedAt: s.changedAt, note: s.changeNote }));
    return { year: y, yearAt, changed, due: !yearAt || changed.length > 0, start: profileOf(name).startDate || '', newHire: !!(accountFor(name) || {}).newHire };
  }
  function acknowledge(me) {
    const doc = person(me); const st = ackOf(me); const a = Object.assign({ years: {}, sections: {} }, doc.tpAck || {}); const t = now();
    if (!st.yearAt) a.years = Object.assign({}, a.years, { [st.year]: t });
    a.sections = Object.assign({}, a.sections); for (const c of st.changed) a.sections[c.id] = t;
    doc.tpAck = a;
    // it is also the Policies and Procedures acknowledgment on the New Educator paperwork
    doc.paperwork = Object.assign({}, doc.paperwork, { tppack: Object.assign({}, (doc.paperwork || {}).tppack, { ack: ((doc.paperwork || {}).tppack || {}).ack || t }) });
    doc.updatedAt = t; put(pPath(me), doc); return ackOf(me);
  }
  // the families of every child at Fulton and whether they have acknowledged the current edition
  function familyAcks() {
    const y = current(); const out = [];
    for (const [id, r] of store.recs.children || []) { const k = r && !r.deleted && r.doc; if (!k || k.status === 'withdrawn') continue;
      const a = familyAck(k, y); const past = Object.keys(k.handbookAck || {}).filter(x => x !== y).sort();
      out.push({ id, first: k.first || '', last: k.last || '', classroom: k.classroom || '', at: a ? a.at : '', by: a ? a.by || '' : '', earlier: past.pop() || (k.familyChecks && k.familyChecks.handbook && y !== '2026' ? '2026' : '') }); }
    return { edition: y, list: out.sort((a, b) => (!!a.at - !!b.at) || (a.first + a.last).localeCompare(b.first + b.last)) };
  }
  // the Family page's Read the Family Handbook, ticked before TREE held the handbook, was the 2026 Google Doc
  const familyAck = (k, y) => (k.handbookAck || {})[y] || (y === '2026' && k.familyChecks && k.familyChecks.handbook ? { at: k.familyChecks.handbook, by: '' } : null);

  /* ---------- names and private details, for the director before the public link opens ---------- */
  function findings(y) {
    const out = []; const ed = fhOut(y); if (!ed) return out;
    const names = new Map();
    const add = (n, kind) => { n = String(n || '').trim(); for (const w of n.split(/\s+/)) if (w.length >= 3 && /^[A-Z]/.test(w) && !names.has(w)) names.set(w, kind); };
    for (const n of [...staffNames(), ...roleNames().map(n => String(n).replace(/^./, c => c.toUpperCase()))]) add(n, 'A staff member\'s name');
    for (const p of S.files.keys()) if (/^staff\/people\/.+\.json$/.test(p)) add((get(p) || {}).name, 'A staff member\'s name');
    for (const [, r] of store.recs.children || []) { const k = r && !r.deleted && r.doc; if (!k) continue; add(k.first, 'A child\'s name'); add(k.last, 'A child\'s name'); for (const pa of k.parents || []) if (pa && pa.name) add(pa.name, 'A family member\'s name'); }
    const SCHOOL_PHONE = '7075238035', SCHOOL_BOXES = ['north', 'south', 'west', 'studio', 'office', 'info', 'tree'];
    for (const p of ed.parts) for (const s of p.sections) {
      const text = s.title + '\n' + plainMd(s.body); const seen = new Set();
      const hit = (kind, what, at) => { const k = kind + '|' + what; if (seen.has(k)) return; seen.add(k); const i = Math.max(0, at - 50); out.push({ section: s.id, title: s.title, part: p.title, kind, what, near: (i ? '\u2026' : '') + text.slice(i, at + what.length + 50).replace(/^\S*\s/, i ? '' : '$&').replace(/\s\S*$/, at + what.length + 50 < text.length ? '' : '$&').replace(/\s+/g, ' ').trim() + (at + what.length + 50 < text.length ? '\u2026' : '') }); };
      for (const m of text.matchAll(/\b[A-Z][A-Za-z’'-]{2,}\b/g)) { const w = m[0].replace(/[’']s$/, ''); if (names.has(w)) hit(names.get(w), w, m.index); }
      for (const m of text.matchAll(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g)) if (m[0].replace(/\D/g, '') !== SCHOOL_PHONE) hit('A phone number', m[0], m.index);
      for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) { const [u, dom] = m[0].toLowerCase().split('@'); if (!(dom === 'childfamilycommunity.com' && SCHOOL_BOXES.includes(u))) hit('An email address', m[0], m.index); }
      for (const m of text.matchAll(/\b\d{2,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Drive|Dr|Way|Boulevard|Blvd|Court|Ct|Place|Pl|Highway|Hwy)\b\.?/g)) if (!/^1225 Fulton Road/.test(m[0])) hit('A street address', m[0], m.index);
    }
    return out;
  }
  // the words as a reader sees them, for the list and its snippets
  const plainMd = t => String(t || '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[((?:\\.|[^\]])*)\]\([^)\s]*\)/g, '$1').replace(/<\/?u>/g, '').replace(/\*\*/g, '').replace(/\\(.)/g, '$1');
  const pub = () => Object.assign({ on: false, reviewed: {}, hide: {} }, get(PUB) || {});
  const publicOpen = () => { const p = pub(), y = current(); return !!(p.on && y && p.reviewed[y]); };

  /* ---------- saving a section, with its earlier wording kept ---------- */
  const earlier = s => ({ title: s.title || '', body: s.body || '', at: s.updatedAt || 0, by: s.updatedBy || '', note: s.note || '' });
  function saveTeacher(me, b) {
    const d = tpDoc(); if (!d) return { error: 'The Policies and Procedures are not in the records yet.' }; if (!get(TP)) put(TP, d);
    const title = clip(String(b.title || '').trim(), 160), body = clip(String(b.body == null ? '' : b.body).replace(/\r/g, ''), 120000), note = clip(String(b.note || '').trim(), 300);
    let e = entries().find(x => x.id === b.id);
    if (!e) {
      // a new section joins a part, or begins its own part at the end
      if (!title) return { error: 'Give the section a title.' };
      let id = slug(title) || 'section'; while (entries().some(x => x.id === id) || get(TPS(id))) id += '-2';
      const nd = JSON.parse(JSON.stringify(d)); const part = nd.parts.find(p => p.id === b.part);
      if (part) part.sections.push({ id }); else nd.parts.push({ id, title, sections: [{ id }] });
      nd.updatedAt = now(); nd.updatedBy = me; put(TP, nd);
      put(TPS(id), { id, title, body, history: [], note: note || 'A new section', updatedAt: now(), updatedBy: me });
      return { ok: true, id };
    }
    const cur = tpSection(e); const rec = Object.assign({ id: e.id, history: [] }, get(TPS(e.id)) || {});
    if (b.remove !== undefined || b.directorOnly !== undefined) {
      if (b.remove !== undefined) rec.removed = !!b.remove; if (b.directorOnly !== undefined) rec.directorOnly = !!b.directorOnly;
      put(TPS(e.id), rec); return { ok: true, id: e.id };
    }
    if (!note) return { error: 'Write a short note about this change.' };
    if (!title) return { error: 'Give the section a title.' };
    if (title === cur.title && body.trim() === String(cur.body || '').trim() && !b.significant) return { ok: true, id: e.id, same: true };
    const t = now();
    rec.history = [...(rec.history || []), earlier(cur)].slice(-200);
    rec.note = note; rec.updatedAt = t; rec.updatedBy = me;
    if (b.significant) { rec.changedAt = t; rec.changeNote = note; }
    if (cur.kind === 'handbook') { const h = get(cur.ref) || {}; put(cur.ref, Object.assign({}, h, { title, body, updatedAt: t, updatedBy: me })); }
    else if (cur.kind === 'piece') { const r = S.files.get(cur.ref); const pp = r && pieceParts(r.text); if (!pp) return { error: 'That piece could not be read.' }; putText(cur.ref, pieceText(pp, title, body)); piecesChanged(); }
    else { rec.title = title; rec.body = body; }
    put(TPS(e.id), rec); log('Policies and Procedures section changed', e.id, 'by', me);
    return { ok: true, id: e.id };
  }
  function saveFamily(me, b) {
    const y = String(b.edition || ''); const e = edition(y); if (!e) return { error: 'That edition is not here.' };
    const title = clip(String(b.title || '').trim(), 160), body = clip(String(b.body == null ? '' : b.body).replace(/\r/g, ''), 120000), note = clip(String(b.note || '').trim(), 300);
    const inEd = (e.parts || []).some(p => (p.sections || []).includes(b.id));
    if (!inEd) {
      if (!title) return { error: 'Give the section a title.' };
      let id = slug(title) || 'section'; while ((e.parts || []).some(p => p.sections.includes(id)) || fhSection(y, id)) id += '-2';
      const ne = JSON.parse(JSON.stringify(e)); const part = (ne.parts || []).find(p => p.id === b.part);
      if (part) part.sections.push(id); else (ne.parts = ne.parts || []).push({ id, title, sections: [id] });
      ne.updatedAt = now(); ne.updatedBy = me; put(FHE(y), ne);
      put(FHS(y, id), { id, title, body, history: [], note: note || 'A new section', updatedAt: now(), updatedBy: me });
      return { ok: true, id };
    }
    const cur = fhSection(y, b.id) || { id: b.id, history: [] };
    // a draft's first change to a section it read from the edition before keeps that wording as its earlier version
    const rec = cur.same ? { id: b.id, title: cur.title, body: cur.body, history: [Object.assign(earlier(cur), { note: cur.note ? `The ${cur.edition} edition, ${cur.note}` : `The ${cur.edition} edition` })] } : Object.assign({ history: [] }, get(FHS(y, b.id)) || {});
    delete rec.edition; delete rec.same;
    if (b.remove !== undefined) { rec.removed = !!b.remove; put(FHS(y, b.id), rec); return { ok: true, id: b.id }; }
    if (!note) return { error: 'Write a short note about this change.' };
    if (!title) return { error: 'Give the section a title.' };
    if (!cur.same && title === cur.title && body.trim() === String(cur.body || '').trim()) return { ok: true, id: b.id, same: true };
    if (!cur.same) rec.history = [...(rec.history || []), earlier(cur)].slice(-200);
    Object.assign(rec, { title, body, note, updatedAt: now(), updatedBy: me }); put(FHS(y, b.id), rec);
    log('Family Handbook section changed', y, b.id, 'by', me);
    return { ok: true, id: b.id };
  }
  function restore(me, b) {
    const i = +b.index;
    if (b.doc === 'family') { const s = fhSection(String(b.edition || ''), b.id); const h = s && !s.same && (s.history || [])[i]; if (!h) return { error: 'That version is not here.' };
      return saveFamily(me, { edition: b.edition, id: b.id, title: h.title, body: h.body, note: clip(`Restored the version of ${longDay(h.at)}${b.note ? '. ' + b.note : ''}`, 300) }); }
    const e = entries().find(x => x.id === b.id); const s = e && tpSection(e); const h = s && (s.history || [])[i]; if (!h) return { error: 'That version is not here.' };
    return saveTeacher(me, { id: b.id, title: h.title, body: h.body, note: clip(`Restored the version of ${longDay(h.at)}${b.note ? '. ' + b.note : ''}`, 300), significant: !!b.significant });
  }
  const longDay = ms => ms ? new Date(ms).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' }) : 'an earlier day';

  /* ---------- requests from the Educators pages, /api/staff/policies/... ---------- */
  async function handle(P, body, me, req, res, { json, err, send }) {
    const dir = isDirector(me); const deny = m => err(req, res, 403, m || 'This is not open yet.');
    const docOk = d => d === 'family' ? canFamily(me) : canTeacher(me);
    if (P === 'policies/doc') {
      const d = body.doc === 'family' ? 'family' : 'teacher'; if (!docOk(d)) return deny();
      if (d === 'teacher') { const out = teacherOut(me); if (!out) { err(req, res, 404, 'The Policies and Procedures are not in the records yet.'); return; }
        json(req, res, 200, Object.assign(out, { ack: hasOwn(me) && !dir ? ackOf(me) : null })); return; }
      const ys = years(); const cur = current(); let y = String(body.edition || cur);
      // families and educators read the current edition and the ones before it. Only the director reads a draft.
      if (!ys.includes(y) || (!dir && (!isLive(y) || y > cur))) y = cur;
      const out = fhOut(y, { director: dir }); if (!out) { err(req, res, 404, 'The Family Handbook is not in the records yet.'); return; }
      json(req, res, 200, Object.assign(out, { editions: ys.filter(x => dir || (isLive(x) && x <= cur)).map(x => ({ year: x, live: isLive(x), current: x === cur, publishOn: (edition(x) || {}).publishOn || '' })), public: dir ? Object.assign(pub(), { open: publicOpen() }) : undefined })); return;
    }
    if (P === 'policies/img') {
      const p = path.posix.normalize(String(body.path || ''));
      const okPlace = (p.startsWith('staff/policies/') && docOk('teacher')) || (p.startsWith(FH) && docOk('family')) || p.startsWith('staff/pd/images/');
      if (!okPlace || !/\.(png|jpe?g|gif|webp)$/i.test(p)) { err(req, res, 404, 'That picture is not here.'); return; }
      try { const buf = await readImage(p); send(req, res, 200, { 'Content-Type': /\.png$/i.test(p) ? 'image/png' : /\.gif$/i.test(p) ? 'image/gif' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'private, max-age=86400' }, buf); }
      catch (e) { err(req, res, 404, 'That picture is not here.'); }
      return;
    }
    if (P === 'policies/ack') {
      if (!canTeacher(me) || !hasOwn(me) || dir) return deny();
      json(req, res, 200, { ack: acknowledge(me) }); return;
    }
    if (!dir) return deny('Only the director changes the policies.');
    if (P === 'policies/save') { const r = body.doc === 'family' ? saveFamily(me, body) : saveTeacher(me, body); if (r.error) { err(req, res, 400, r.error); return; } json(req, res, 200, r); return; }
    if (P === 'policies/restore') { const r = restore(me, body); if (r.error) { err(req, res, 400, r.error); return; } json(req, res, 200, r); return; }
    if (P === 'policies/acks') {
      const tp = readers().map(n => Object.assign({ name: n }, ackOf(n)));
      json(req, res, 200, { teacher: tp, family: familyAcks() }); return;
    }
    if (P === 'policies/settings') {
      if (body.doc === 'teacher') {
        const d = tpDoc(); if (!d) { err(req, res, 404, 'Not here.'); return; } const nd = Object.assign({}, d);
        if (Array.isArray(body.mustRead)) { const ids = new Set(entries().map(x => x.id)); nd.mustRead = [...new Set(body.mustRead.map(String).filter(x => ids.has(x)))]; }
        if (/^\d{4}$/.test(String(body.edition || ''))) nd.edition = String(body.edition);
        nd.updatedAt = now(); nd.updatedBy = me; put(TP, nd); json(req, res, 200, { ok: true }); return;
      }
      if (body.newDraft) {
        const ys = years(); const last = ys[ys.length - 1]; if (!last) { err(req, res, 404, 'Not here.'); return; }
        if (!isLive(last)) { err(req, res, 400, `The ${last} draft is still being written.`); return; }
        const y = String(+last + 1); const e = edition(last);
        put(FHE(y), { year: y, title: e.title || 'Family Handbook', from: last, publishOn: '', cover: (e.cover || []).map(c => c === last ? y : c), image: e.image ? path.posix.relative(FH + y, path.posix.normalize(FH + last + '/' + e.image)) : '', footer: e.footer || '', parts: JSON.parse(JSON.stringify(e.parts || [])), updatedAt: now(), updatedBy: me });
        json(req, res, 200, { ok: true, edition: y }); return;
      }
      const y = String(body.edition || ''); const e = edition(y); if (!e) { err(req, res, 404, 'That edition is not here.'); return; }
      if ('publishOn' in body) {
        if (e.published === true || (isLive(y) && y <= current())) { err(req, res, 400, 'This edition is already current.'); return; }
        const d = String(body.publishOn || ''); if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) { err(req, res, 400, 'Choose a day.'); return; }
        put(FHE(y), Object.assign({}, e, { publishOn: d, updatedAt: now(), updatedBy: me })); log('Family Handbook', y, d ? 'publishes on ' + d : 'publish date cleared', 'by', me);
      }
      json(req, res, 200, { ok: true }); return;
    }
    if (P === 'policies/review') { const y = current(); json(req, res, 200, { edition: y, findings: findings(y), public: Object.assign(pub(), { open: publicOpen() }) }); return; }
    if (P === 'policies/public') {
      const p = pub(); const y = current();
      if (body.hide && typeof body.hide === 'object') p.hide = Object.assign({}, p.hide, Object.fromEntries(Object.entries(body.hide).map(([k, v]) => [String(k).slice(0, 60), !!v])));
      if ('on' in body) {
        // the link opens only once the director has read the list of names and private details for the current edition
        if (body.on && !body.reviewed && !p.reviewed[y]) { err(req, res, 400, 'Read the list of names and private details first.'); return; }
        if (body.on && body.reviewed) p.reviewed = Object.assign({}, p.reviewed, { [y]: { at: now(), by: me } });
        p.on = !!body.on;
      }
      p.updatedAt = now(); p.updatedBy = me; put(PUB, p); log('Family Handbook public link', p.on ? 'on' : 'off', 'by', me);
      json(req, res, 200, Object.assign(p, { open: publicOpen() })); return;
    }
    err(req, res, 404, 'Not found');
  }

  /* ---------- for the Family page and the public page ---------- */
  function forFamily(y) {
    const cur = current(); const ys = years().filter(x => isLive(x) && x <= cur); const want = ys.includes(String(y || '')) ? String(y) : cur;
    const out = fhOut(want); if (!out) return null; return Object.assign(out, { editions: ys.map(x => ({ year: x, current: x === cur })) });
  }
  function forPublic() { if (!publicOpen()) return null; const out = fhOut(current(), { hide: pub().hide }); return out && Object.assign(out, { editions: undefined }); }
  // a picture the family or public page may ask for is one in an edition they can read
  function familyImage(p, isPublic) {
    p = path.posix.normalize(String(p || '')); if (!p.startsWith(FH) || !/\.(png|jpe?g|gif|webp)$/i.test(p)) return null;
    const shown = isPublic ? [forPublic()] : years().filter(x => isLive(x) && x <= current()).map(x => fhOut(x));
    return shown.some(d => d && JSON.stringify(d).includes(p)) ? p : null;
  }
  return { handle, current, years, ackOf, readers, familyAck, forFamily, forPublic, familyImage, findings, publicOpen, teacherOut, fhOut, entries, tpSection, pieceParts, saveTeacher, saveFamily, edition, fhSection };
};
