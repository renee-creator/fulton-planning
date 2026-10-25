'use strict';
/* Play Garden, open to anyone, families from outside the school included, with a parent or caregiver staying with each
   child. Its application is a public page, playgarden.html, which the director turns on and off the way the Family
   Handbook's public link works. The questions are the school's own wording in the private records,
   staff/wording/play-garden-application.md, one part for each question, so they are changed in place with their
   history and never sit in the public code. Each application is kept in the private records under staff/playgarden,
   read only by the director. An applicant sees the application and our garden family agreements, and nothing else. */
module.exports = function playgarden(o) {
  const { S, get, put, log, wordingDoc, agreements } = o;
  const SET = 'staff/playgarden/settings.json';
  const settings = () => Object.assign({ on: false }, get(SET) || {});
  const rid = () => 'pg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // each question, from its part in the wording page. A heading ending in "optional" may be left empty, and one starting
  // "agree" is a box to tick.
  function questions() {
    const doc = wordingDoc('play-garden-application');
    return (doc.parts || []).map(p => { const k = p.key.toLowerCase(); return { key: p.key.replace(/\b(optional|long)\b/gi, ' ').trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase(), label: p.text.split('\n')[0].trim(), note: p.text.split('\n').slice(1).join(' ').trim(), optional: /\boptional\b/.test(k), agree: /^agree/.test(k), long: /\blong\b/.test(k) }; }).filter(q => q.label)
      // two headings that read the same once optional and long are set aside keep apart answers
      .map((q, i, all) => all.findIndex(x => x.key === q.key) === i ? q : Object.assign(q, { key: q.key + '-' + (i + 1) }));
  }
  function lead() { return wordingDoc('play-garden-application').lead || ''; }
  // what the public page receives
  function forPublic() { const s = settings(); if (!s.on) return { open: false }; return { open: true, title: 'Play Garden', lead: lead(), questions: questions(), agreements: agreements() }; }
  const tries = new Map();
  function apply(b, ip) {
    if (!settings().on) return { error: 'The Play Garden application is not open just now.' };
    const now = Date.now(); const t = (tries.get(ip) || []).filter(x => now - x < 3600e3); if (t.length >= 5) return { error: 'Please try again later.' }; t.push(now); tries.set(ip, t);
    // the tries kept are an hour's, and the applications a day are capped, so a flood never fills the records
    if (tries.size > 2000) for (const [k, v] of tries) if (!v.some(x => now - x < 3600e3)) tries.delete(k);
    if (list().filter(a => now - Date.parse(a.at) < 864e5).length >= 60) return { error: 'Please try again tomorrow.' };
    const qs = questions(); const answers = {}; b = b || {};
    for (const q of qs) { const v = q.agree ? !!b[q.key] : String(b[q.key] == null ? '' : b[q.key]).replace(/\r/g, '').trim().slice(0, q.long ? 3000 : 300);
      if (!q.optional && !v) return { error: 'Please answer the question ' + q.label + '.' };
      answers[q.key] = v; }
    const id = rid(); put(`staff/playgarden/${id}.json`, { id, at: new Date().toISOString(), questions: qs.map(q => ({ key: q.key, label: q.label })), answers, status: 'new' });
    log('A Play Garden application arrived'); return { ok: true };
  }
  const list = () => [...S.files.keys()].filter(p => /^staff\/playgarden\/pg[a-z0-9]+\.json$/.test(p)).map(p => get(p)).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  async function handle(P, body, me, dir, req, res, { json, err }) {
    if (!dir) { err(req, res, 403, 'Only the director reads the Play Garden applications.'); return; }
    if (P === 'playgarden') { json(req, res, 200, { settings: settings(), applications: list(), questions: questions() }); return; }
    if (P === 'playgarden/switch') { put(SET, Object.assign(settings(), { on: !!body.on, at: Date.now(), by: me })); log('Play Garden application turned', body.on ? 'on' : 'off', 'by', me); json(req, res, 200, { settings: settings(), applications: list(), questions: questions() }); return; }
    if (P === 'playgarden/status') { const id = String(body.id || ''); if (!/^pg[a-z0-9]+$/.test(id)) { err(req, res, 404, 'That application is not here.'); return; } const p = `staff/playgarden/${id}.json`; const a = get(p); if (!a) { err(req, res, 404, 'That application is not here.'); return; }
      put(p, Object.assign({}, a, { status: ['new', 'welcomed', 'declined'].includes(body.status) ? body.status : 'new', note: String(body.note == null ? a.note || '' : body.note).slice(0, 600), by: me, updatedAt: Date.now() })); json(req, res, 200, { settings: settings(), applications: list(), questions: questions() }); return; }
    err(req, res, 404, 'Not found');
  }
  return { forPublic, apply, handle, settings };
};
