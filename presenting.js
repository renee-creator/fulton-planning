'use strict';
/* Presenting, under Educators, PD and Licensing. Every talk, PD session or module presented at Fulton or for other
   schools, one entry each, kept in the records under staff/presenting/<id>.json, beside the other educator records.

   Only the director starts an entry. She adds educators as presenters, and they see and work on that entry. No other
   educator receives an entry until it is marked presented, and then only what is safe for all staff, read only. The
   server decides all of this, never the page. Evidence is read here from Fulton's own records only, by words and
   patterns anyone can check, and each moment says why it fits by quoting the record. Names live in the records, never
   in this file. */
const crypto = require('crypto');

module.exports = function presentingModule(c) {
  const { get, put, S, log, person, profileOf, pPath, pidOf, staffNames, isDirector, nameKey, school, today, store, accountFor, takesPart, isNewHire, moduleOf, readingsFor } = c;
  const rid = p => p + crypto.randomBytes(5).toString('hex');
  const txt = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, n || 4000);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const ID = /^pr[a-f0-9]{10}$/;
  const prPath = id => `staff/presenting/${id}.json`;
  const NAMES = ['first', 'full', 'initials', 'none'];
  const LISTS = { notes: 200, meetings: 60, chosen: 60, readings: 60, plan: 40, prompts: 20, checks: 20 };

  /* ---------- the entries ---------- */
  const all = () => [...S.files].filter(([p, r]) => p.startsWith('staff/presenting/') && r && r.doc && r.doc.id && !r.doc.removed).map(([, r]) => r.doc);
  const one = id => { const d = ID.test(String(id || '')) ? get(prPath(id)) : null; return d && !d.removed ? d : null; };
  const blank = (title, by) => ({ id: rid('pr'), title: txt(title, 160), subtitle: '', question: '', audience: '', date: '', start: '', end: '', place: '', dateNote: '', minutes: 0, format: '', presenters: [], status: 'planning', names: 'none',
    look: [], youngest: false, lens: '', meetingsNote: '', notes: [], meetings: [], evidence: { kept: {}, aside: {} }, chosen: [], readings: [], plan: [], followup: { on: false, reads: [], prompts: [], checks: [] }, credit: {}, createdAt: Date.now(), createdBy: by });
  const save = (d, me) => { d.updatedAt = Date.now(); d.updatedBy = me; put(prPath(d.id), d); return d; };

  // an educator who has left, by the account's last day or the profile's, is never offered as a presenter
  const former = n => { const t = today(), a = accountFor(n) || {}, l = profileOf(n).leftOn || ''; return !!((a.leaveOn && a.leaveOn < t) || (l && l < t)); };
  const choices = () => staffNames().filter(n => takesPart(n) && !isNewHire(n) && !former(n)).sort();
  const presents = (e, me) => (e.presenters || []).some(n => nameKey(n) === nameKey(me));
  const canEdit = (me, e) => !!e && (isDirector(me) || presents(e, me));
  const canRead = (me, e) => !!e && (canEdit(me, e) || (e.status === 'presented' && takesPart(me) && !isNewHire(me)));
  const anyFor = me => isDirector(me) || (takesPart(me) && !isNewHire(me) && all().some(e => canRead(me, e)));

  /* ---------- the two starting entries, made once ---------- */
  // titles and words from the director's own request, nothing personal. A school that already has them is left alone.
  const LOOK_TRACE = [
    { k: 'passing', label: 'Traces that may not last', words: ['chalk', 'sand', 'water', 'puddle', 'puddles', 'mud', 'light', 'shadow', 'shadows', 'sunlight', 'reflection', 'arrangement', 'arrangements', 'arranged', 'arranging', 'lined up', 'pattern', 'patterns', 'movement', 'dance', 'danced', 'dancing', 'twirled', 'spun', 'song', 'sang', 'singing', 'chant', 'chanted', 'rhyme', 'whispered', 'footprints', 'bubbles', 'ice'] },
    { k: 'lasting', label: 'Traces that endure', words: ['returned', 'came back', 'again', 'next day', 'next morning', 'rebuilt', 'reworked', 'redrew', 'remade', 'added to', 'still there', 'carried', 'continued', 'revisited', 'remembered'],
      with: ['mark', 'marks', 'drawing', 'drawings', 'drew', 'map', 'maps', 'structure', 'tower', 'building', 'built', 'sculpture', 'clay', 'line', 'lines', 'painting', 'painted', 'chalk', 'sand', 'blocks', 'construction', 'writing', 'wrote'] }];
  function seed() {
    const sc = school(); if ((sc.seeded || {}).presenting) return false;
    const a = Object.assign(blank('Leaving a Trace', 'TREE'), { subtitle: 'Ephemeral Encounters, Enduring Possibilities', question: 'What is the child trying to make happen?', audience: '', date: '2027-05-22', minutes: 180,
      format: 'A facilitated session', look: LOOK_TRACE, lens: 'Graphic Languages', meetingsNote: '', seed: 'trace' });
    const b = Object.assign(blank('Serving Two-Year-Olds', 'TREE'), { audience: 'The director\'s group', format: 'A facilitated session with a self-paced follow-up', youngest: true, followup: { on: true, reads: [], prompts: [], checks: [] }, seed: 'twos' });
    for (const e of [a, b]) if (!all().some(x => x.seed === e.seed)) save(e, 'TREE');
    put('staff/school.json', Object.assign({}, school(), { seeded: Object.assign({}, school().seeded, { presenting: today() }) }));
    log('Presenting entries started'); return true;
  }

  /* ---------- what an entry shows to whom ---------- */
  const PD = () => (get('staff/pddays.json') || {}).agendas || {};
  const agendasUsing = id => Object.values(PD()).filter(a => (a.blocks || []).some(b => b.presenting === id)).map(a => ({ id: a.id, date: a.date, kind: a.kind, title: a.title || '' })).sort((x, y) => x.date.localeCompare(y.date));
  const sharedFor = (e, me) => { const m = ((get('staff/moments.json') || {}).list || []).find(x => nameKey(x.by) === nameKey(me) && x.link && x.link.kind === 'presenting' && x.link.id === e.id); return m ? 'shared' : ((e.credit || {})[pidOf(me)] || {}).moment === 'no' ? 'no' : ''; };
  const summary = (e, me) => ({ id: e.id, title: e.title, subtitle: e.subtitle, audience: e.audience, date: e.date, minutes: e.minutes, mode: e.mode || '', audienceType: e.audienceType || '', status: e.status, presentedOn: e.presentedOn || '', presenters: e.presenters || [], edit: canEdit(me, e), copiedFrom: e.copiedFrom || '' });
  // a reader who is not a presenter receives what is safe for all staff. Notes, meetings, evidence and Drive files stay out.
  function forViewer(e, me) {
    const out = JSON.parse(JSON.stringify(e)); out.agendas = agendasUsing(e.id); out.edit = canEdit(me, e);
    if (presents(e, me) && e.status === 'presented') out.mine = { hours: !!(e.credit || {})[pidOf(me)], moment: sharedFor(e, me) };
    if (out.edit) { out.library = readingsFor ? readingsFor(me) : (get('staff/readings.json') || {}).list || []; if (isDirector(me)) { out.choices = choices(); if (e.template) out.templateSource = (get('staff/pd/template.json') || {}).source || ''; } else delete out.credit; return out; }
    const keep = ['id', 'title', 'subtitle', 'question', 'audience', 'date', 'start', 'end', 'place', 'dateNote', 'minutes', 'mode', 'audienceType', 'format', 'presenters', 'status', 'presentedOn', 'plan', 'chosen', 'followup', 'agendas', 'edit', 'mine'];
    const safe = Object.fromEntries(keep.map(k => [k, out[k]]));
    safe.readings = (e.readings || []).filter(r => r.kind !== 'drive').map(r => ({ id: r.id, kind: r.kind, title: r.title, url: r.url, source: r.source || '', note: r.note || '' }));
    // the facilitator script is only for the presenters and the director (October 31, 2026)
    safe.plan = (e.plan || []).map(s => { const o = Object.assign({}, s, { readings: (s.readings || []).filter(id => safe.readings.some(r => r.id === id)) }); delete o.script; return o; });
    return safe;
  }

  /* ---------- evidence, read from Fulton's own records ---------- */
  const live = k => [...((store.recs || {})[k] || new Map())].filter(([, r]) => r && !r.deleted && r.doc).map(([id, r]) => Object.assign({ id }, r.doc));
  const dayOf = ms => ms ? new Date(+ms).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) : '';
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // a word matches as a whole word with the usual endings, chalks, arranged, returning
  const wordRe = w => new RegExp('\\b' + esc(w).replace(/ /g, '\\s+') + (/ /.test(w) ? '' : '(?:s|es|d|ed|ing)?') + '\\b', 'i');
  const STOP = new Set('about after again also among around because before being could every from have into just more most other over really should some such than that their them there these they this those through under very what when where which while will with would your child children trying make happen'.split(' '));
  // a new entry looks for the words of its own title, subtitle and guiding question until the director changes them
  const ownWords = e => [...new Set(`${e.title} ${e.subtitle} ${e.question}`.toLowerCase().split(/[^a-z'-]+/).filter(w => w.length > 4 && !STOP.has(w)))].slice(0, 12);
  const lookOf = e => (e.look || []).length ? e.look : ownWords(e).length ? [{ k: 'own', label: 'Words from the title and guiding question', words: ownWords(e) }] : [];
  // the sentence of the record that holds the word, quoted as it was written
  const sentence = (text, w) => { const ss = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/); const q = ss.find(x => wordRe(w).test(x)) || ''; if (q.length <= 200) return q; const i = q.search(wordRe(w)); return (i > 90 ? '…' : '') + q.slice(Math.max(0, i - 90), i + 110).replace(/^\S*\s/, i > 90 ? '' : '$&').replace(/\s\S*$/, '') + '…'; };
  const join = ws => ws.length < 2 ? ws.join('') : ws.slice(0, -1).join(', ') + ' and ' + ws[ws.length - 1];
  // the class that holds Fulton's two-year-olds is the one with the most children under three today
  const underThree = (kid, day) => !!(kid && ISO.test(String(kid.dob || '').slice(0, 10)) && day && (+day.slice(0, 4) - 3) + day.slice(4) < String(kid.dob).slice(0, 10));
  function youngClass(kids) { const n = {}; for (const k of kids) if (k.status !== 'withdrawn' && underThree(k, today())) n[k.classroom] = (n[k.classroom] || 0) + 1; return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || ''; }
  function lenses() { const r = store.recs && store.recs.settings && store.recs.settings.get('program'); const v = r && !r.deleted && r.doc ? r.doc : {}; return (Array.isArray(v.lenses) ? v.lenses : []).filter(l => l && l.name); }
  function sources() {
    const out = []; const add = (kind, label, r, fields, date, room, by, extra) => out.push(Object.assign({ key: kind + ':' + r.id, kind, label, id: r.id, fields: fields.filter(f => String(f[1] || '').trim()), date, room: room || '', by: by || '' }, extra || {}));
    const seenGroup = new Set();
    for (const n of live('notices').sort((a, b) => (+b.at || 0) - (+a.at || 0))) {
      // the photos of one post share their words, so the post is read once
      const same = String(n.noticed || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if ((n.group && seenGroup.has(n.group)) || (same.length > 30 && seenGroup.has(same))) continue; if (n.group) seenGroup.add(n.group); if (same.length > 30) seenGroup.add(same);
      add('obs', 'Observation', n, [['noticed', n.noticed], ['wonder', n.wonder], ['languages', (n.languages || []).join(', ')]], dayOf(n.at), n.classroom, n.by, { children: n.children || [], photo: n.photo && n.photo.id ? { id: n.photo.id, thumb: n.photo.thumb || '', w: n.photo.w || 0, h: n.photo.h || 0 } : null, languages: n.languages || [] });
    }
    for (const p of live('plans')) if (!p.blank && p.id !== 'example') add('plan', 'Plan', p, Object.entries(p.fields || {}).filter(([, v]) => typeof v === 'string'), p.weekOf || dayOf(p.updatedAt), p.classroom, p.educator);
    for (const t of live('threads')) add('thread', 'Thread', t, [['question', t.question], ['name', t.name], ...(t.evidence || []).map((x, i) => ['evidence' + i, x && x.text]), ...(t.next || []).map((x, i) => ['next' + i, x])], t.lastWeek || dayOf(t.updatedAt), t.classroom || t.room, t.followedBy);
    for (const p of live('projects')) add('project', 'Project', p, [['experience', p.experience], ['underneath', p.underneath], ['intent', p.intent], ['returns', p.returns]], dayOf(p.updatedAt || p.createdAt), p.home || ((p.classrooms || []).map(x => x.room).join(', ')), p.createdBy);
    for (const q of live('inquiries')) add('inquiry', 'Team inquiry', q, [['see', q.see], ['whenwhere', q.whenwhere], ['watch', q.watch], ['lookAgain', q.lookAgain], ...(q.tries || []).map((x, i) => ['try' + i, x && x.text])], dayOf(q.updatedAt || q.createdAt), q.room, q.createdBy);
    return out;
  }
  // each record is read against the entry's groups of words. A group with "with" words fits only when both are there.
  function evidence(e) {
    const look = lookOf(e), kids = new Map(live('children').map(k => [k.id, k])), young = e.youngest ? youngClass([...kids.values()]) : '';
    const ls = lenses(); const lens = ls.find(l => l.name === e.lens || l.id === e.lens);
    const lensWords = lens ? [...(lens.words || []), ...(lens.languages || [])].map(String).filter(Boolean) : [];
    const kept = (e.evidence || {}).kept || {}, aside = (e.evidence || {}).aside || {};
    const items = [];
    for (const r of sources()) {
      const why = [], groups = []; let score = 0, words = '', field = '';
      for (const g of look) {
        const hit = []; let f0 = '';
        // each word is named once, as it is written in the record
        for (const w of g.words || []) for (const [k, v] of r.fields) { const m = String(v).match(wordRe(w)); if (m) { const said = m[0].toLowerCase().replace(/\s+/g, ' '); if (!hit.includes(said)) hit.push(said); if (!f0) f0 = k; break; } }
        if (!hit.length) continue;
        let also = [];
        if ((g.with || []).length) { for (const w of g.with) for (const [, v] of r.fields) { const m = String(v).match(wordRe(w)); if (m) { const said = m[0].toLowerCase(); if (!also.includes(said)) also.push(said); break; } } if (!also.length) continue; }
        const f = r.fields.find(x => x[0] === f0); const q = sentence(f[1], (g.words || []).find(w => wordRe(w).test(f[1])) || hit[0]);
        groups.push(g.k); score += hit.length + also.length; field = field || f0; words = words || f[1];
        const base = `${g.label}. It names ${join([...hit, ...also.filter(w => !hit.includes(w))].slice(0, 4))}`;
        why.push(q ? `${base}, “${q.replace(/[.!?…]+$/, '')}.”` : base + '.');
      }
      if (e.youngest) {
        const small = r.kind === 'obs' && (r.children || []).some(id => underThree(kids.get(id), r.date));
        if (small) { groups.push('youngest'); score += 2; why.push('With our youngest children. A child in it was under three that day.'); }
        else if (young && r.room === young && ['obs', 'plan', 'thread'].includes(r.kind)) { groups.push('youngest'); score += 1; why.push(`With our youngest children. Kept in ${young} class, where our two-year-olds are.`); }
      }
      if (!groups.length) continue;
      let lensLine = '';
      if (lens) { const lh = []; for (const w of lensWords) for (const [, v] of r.fields) { const m = String(v).match(wordRe(w)); if (m) { const said = m[0].toLowerCase(); if (!lh.includes(said)) lh.push(said); break; } }
        if (lh.length) { lensLine = `Through the lens ${lens.name}, it names ${join(lh.slice(0, 3))}.`; score += 1; } }
      const f = r.fields.find(x => x[0] === field) || r.fields[0] || ['', ''];
      items.push({ key: r.key, kind: r.kind, label: r.label, id: r.id, text: txt(f[1], 900), wonder: r.kind === 'obs' && field !== 'wonder' ? txt((r.fields.find(x => x[0] === 'wonder') || [])[1], 600) : '', date: r.date, room: r.room, by: r.by, photo: r.photo || null,
        groups, why: why.join(' '), lens: lensLine, score: score + (r.photo ? 1 : 0), state: kept[r.key] ? 'kept' : aside[r.key] ? 'aside' : '' });
    }
    items.sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)));
    const show = items.filter(x => x.state !== 'aside').slice(0, 60);
    return { look, youngest: !!e.youngest, youngClass: young, lens: lens ? lens.name : '', lenses: ls.map(l => l.name), items: [...show, ...items.filter(x => x.state === 'aside')], more: Math.max(0, items.filter(x => x.state !== 'aside').length - show.length) };
  }
  // a chosen moment is made from the record itself, with the educators' words, date, class and language as written there
  function momentFrom(key, by, e) {
    const r = sources().find(x => x.key === key); if (!r) return null;
    const ev = e && r.kind !== 'obs' ? evidence(e).items.find(x => x.key === key) : null;
    const main = r.fields.find(f => f[0] !== 'languages') || ['', ''];
    return { id: rid('m'), from: r.key, kind: r.kind, label: r.label, text: ev ? ev.text : txt(main[1], 2000), wonder: r.kind === 'obs' ? txt((r.fields.find(f => f[0] === 'wonder') || [])[1], 1200) : '', date: r.date, room: r.room, by: r.by, language: (r.languages || []).join(', '), photo: r.photo || null, at: Date.now(), chosenBy: by };
  }

  /* ---------- a presenter's credit, once each: Fulton PD hours, a line on their growth page and a Proud Moment offer ---------- */
  function credit(e, me) {
    e.credit = Object.assign({}, e.credit); const hrs = Math.round((+e.minutes || 0) / 6) / 10; let n = 0;
    for (const nm of e.presenters || []) { const k = pidOf(nm); if (e.credit[k] && e.credit[k].hid) continue;
      const hid = rid('h'); const doc = person(nm);
      if (hrs > 0) { doc.hours = [...(doc.hours || []), { id: hid, date: e.presentedOn || today(), title: 'Presenting, ' + e.title, hours: hrs, kind: 'presenting', approved: false, by: 'TREE' }]; put(pPath(nm), doc); }
      e.credit[k] = Object.assign({}, e.credit[k], { hid: hrs > 0 ? hid : '', at: Date.now(), by: me }); n++; }
    return n;
  }
  function uncredit(e) { for (const [k, cr] of Object.entries(e.credit || {})) { const nm = staffNames().find(x => pidOf(x) === k); if (nm && cr.hid) { const doc = person(nm); doc.hours = (doc.hours || []).filter(h => h.id !== cr.hid); put(pPath(nm), doc); } } e.credit = {}; }
  const ledBy = name => all().filter(e => e.status === 'presented' && presents(e, name)).map(e => ({ id: e.id, title: e.title, audience: e.audience, date: e.presentedOn || e.date, minutes: e.minutes })).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  /* ---------- one item of a list, kept by its own id so two people working on different items never undo each other ---------- */
  const okUrl = u => /^https:\/\/[^\s]+$/i.test(String(u || ''));
  const host = u => { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } };
  const isDrive = u => /^(drive|docs)\.google\.com$/.test(host(u));
  const isLicensingSite = u => /(^|\.)cdss\.ca\.gov$|(^|\.)ccld\.dss\.ca\.gov$|(^|\.)dss\.ca\.gov$/.test(host(u));
  function clean(list, x, was, me) {
    const id = String(x.id || '').slice(0, 20) || rid(list[0]);
    if (list === 'notes') return { id, date: ISO.test(x.date || '') ? x.date : today(), text: txt(x.text, 4000), by: x.by || me, at: x.at || Date.now() };
    if (list === 'meetings') return { id, date: ISO.test(x.date || '') ? x.date : today(), fulton: txt(x.fulton, 6000), others: txt(x.others, 6000), questions: txt(x.questions, 4000), by: x.by || me };
    // a chosen moment keeps the record's own words. Only its language can be named.
    // the director clears a moment for outside audiences. Prints made for outside audiences carry only cleared moments.
    if (list === 'chosen') return Object.assign({}, was, { language: txt(x.language, 160), outside: isDirector(me) ? !!x.outside : !!(was && was.outside) });
    if (list === 'plan') return { id, title: txt(x.title, 200), minutes: Math.max(0, Math.min(600, Math.round(+x.minutes || 0))), do: txt(x.do, 6000), script: txt(x.script, 6000), handout: txt(x.handout, 1200), moments: (Array.isArray(x.moments) ? x.moments : []).map(String).slice(0, 12), readings: (Array.isArray(x.readings) ? x.readings : []).map(String).slice(0, 12) };
    if (list === 'prompts' || list === 'checks') return { id, text: txt(x.text, 1200) };
    if (list === 'readings') {
      const kind = ['library', 'link', 'drive', 'licensing'].includes(x.kind) ? x.kind : 'link';
      if (kind === 'library') { const r = ((get('staff/readings.json') || {}).list || []).find(y => y.id === x.ref); if (!r) throw new Error('Choose a reading from the library.'); if (!r.url) throw new Error('That reading has no link yet. Add its link in the PD library first, so everyone can open it.'); return { id, kind, ref: r.id, title: r.title, url: r.url || '', source: r.source || '', note: txt(x.note, 600) }; }
      if (!okUrl(x.url)) throw new Error('Paste a link starting with https.');
      if (kind === 'drive' && !isDrive(x.url)) throw new Error('Paste a Google Drive link.');
      // licensing references come only from CCLD or CDSS
      if (kind === 'licensing' && !isLicensingSite(x.url)) throw new Error('Licensing references come only from CCLD or CDSS. Paste a link from cdss.ca.gov or ccld.dss.ca.gov.');
      return { id, kind, title: txt(x.title, 240) || txt(x.url, 240), url: String(x.url).slice(0, 800), source: kind === 'licensing' ? 'CDSS' : kind === 'drive' ? 'Google Drive' : txt(x.source, 160), note: txt(x.note, 600) };
    }
    return null;
  }

  /* ---------- requests, /api/staff/pres/... ---------- */
  async function handle(P, body, me, req, res, { json, err }) {
    const dir = isDirector(me); const deny = m => err(req, res, 403, m || 'Only the director does this.');
    const nope = () => err(req, res, 404, 'That entry is not here.');
    if (!dir && (!takesPart(me) || isNewHire(me))) return deny('Presenting is for educators.');
    if (P === 'list') {
      if (dir) seed();
      json(req, res, 200, { list: all().filter(e => canRead(me, e)).map(e => summary(e, me)).sort((a, b) => (a.status === 'presented') - (b.status === 'presented') || String(a.date || '9999').localeCompare(String(b.date || '9999')) || a.title.localeCompare(b.title)), start: dir, today: today() }); return;
    }
    if (P === 'new') {
      if (!dir) return deny('Only the director starts an entry.'); const t = txt(body.title, 160).trim(); if (!t) return err(req, res, 400, 'Give the entry a title.');
      // Start from the Fulton template gives the entry its seven parts, each with its time, what participants do, a
      // facilitator script and what goes on the one-page handout, from the template kept in the records
      const e0 = blank(t, me); const tpl = body.template ? get('staff/pd/template.json') : null;
      if (body.template && !tpl) return err(req, res, 404, 'The Fulton Community School PD template is not in the records yet.');
      // a PD library module opened to lead at a staff meeting fills the template's parts from the module's own words
      const mod = body.module && moduleOf ? moduleOf(String(body.module)) : null;
      if (body.module && !mod) return err(req, res, 404, 'That module is not here.');
      if (tpl) { e0.plan = (tpl.sections || []).slice(0, LISTS.plan).map(x => ({ id: rid('s'), title: txt(x.title, 200), minutes: Math.round(+x.minutes || 0), do: txt(x.do, 6000), script: txt(x.script, 6000), handout: txt(x.handout, 1200), moments: [], readings: [] })); /* the entry's own length waits for the director, so none is set from the parts */ e0.minutes = 0; e0.template = true; }
      if (tpl && mod) {
        const sec = h => (mod.sections.find(x => x.heading.toLowerCase().startsWith(h)) || {}).body || '';
        const plain = t => String(t).replace(/^#+\s*/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').trim();
        const subs = (sec('reading').match(/^###\s+(.+)$/gm) || []).map(x => x.replace(/^###\s+/, '').trim());
        const fill = { 'Framing': plain(sec('why it matters')).slice(0, 1200), 'Key ideas': subs.join('. ') + (subs.length ? '.' : ''), 'Reflection': plain(sec('reflect')).slice(0, 1200), 'Commitment': plain(sec('try this week')).slice(0, 1200) };
        for (const p of e0.plan) if (fill[p.title]) p.do = txt(fill[p.title], 6000);
        e0.question = ''; e0.module = mod.slug; e0.audienceType = 'internal';
      }
      const e = save(e0, me); json(req, res, 200, forViewer(e, me)); return;
    }
    const e = one(body.id);
    if (!e || !canRead(me, e)) return nope();
    if (P === 'get') { json(req, res, 200, forViewer(e, me)); return; }
    if (P === 'credit') {
      // the presenter chooses whether to share it as a Proud Moment. Not now is kept so the offer rests.
      if (!presents(e, me) || e.status !== 'presented') return deny('Only a presenter answers this.');
      const k = pidOf(me); e.credit = Object.assign({}, e.credit, { [k]: Object.assign({}, (e.credit || {})[k], { moment: body.moment === 'no' ? 'no' : '' }) }); save(e, me); json(req, res, 200, forViewer(e, me)); return;
    }
    if (!canEdit(me, e)) return deny('Only the director and the presenters change this entry.');
    if (P === 'evidence') { json(req, res, 200, evidence(e)); return; }
    if (P === 'save') {
      const b = body.fields || {};
      for (const k of ['title', 'subtitle', 'question', 'audience', 'format', 'meetingsNote', 'place', 'dateNote']) if (k in b) e[k] = txt(b[k], k === 'meetingsNote' ? 600 : 300);
      for (const k of ['start', 'end']) if (k in b) e[k] = /^([01]\d|2[0-3]):[0-5]\d$/.test(b[k] || '') ? b[k] : '';
      if ('title' in b && !e.title.trim()) return err(req, res, 400, 'Give the entry a title.');
      if ('date' in b) e.date = ISO.test(b.date || '') ? b.date : '';
      // the length, which sets PD hours, how it is offered and who it is for are the director's
      if (!dir && ['minutes', 'mode', 'audienceType'].some(k => k in b)) return deny('The director sets the length, how it is offered and who it is for.');
      if ('minutes' in b) { const was = +e.minutes || 0; e.minutes = Math.max(0, Math.min(2400, Math.round(+b.minutes || 0)));
        // a presented entry logs its hours once the director sets its length, and a changed length replaces the hours logged
        if (e.status === 'presented' && e.minutes !== was) { uncredit(e); if (e.minutes) credit(e, me); } }
      // in person, virtual or both, and who it is for, our own staff, other schools and groups, or both
      if ('mode' in b) e.mode = ['inperson', 'virtual', 'both'].includes(b.mode) ? b.mode : '';
      if ('audienceType' in b) e.audienceType = ['internal', 'external', 'both'].includes(b.audienceType) ? b.audienceType : '';
      // the photos the deck uses, in order. The first is the title slide's. A photo is a picture kept in the records or an
      // observation photo, each with a short caption (November 1, 2026)
      if ('deck' in b) { const d = b.deck && typeof b.deck === 'object' ? b.deck : {};
        const KEY = /^(pic:staff\/[A-Za-z0-9/_.-]+\.(png|jpe?g|webp|gif)|obs:[A-Za-z0-9_.-]{1,80})$/i, seen = new Set();
        e.deck = { photos: (Array.isArray(d.photos) ? d.photos : []).filter(p => p && KEY.test(String(p.key || '')) && !seen.has(p.key) && seen.add(p.key)).slice(0, 40)
          .map(p => ({ key: String(p.key), thumb: /^[A-Za-z0-9_.-]{1,80}$/.test(String(p.thumb || '')) ? String(p.thumb) : '', cap: txt(p.cap, 200).replace(/\n/g, ' ').trim(), w: Math.max(0, Math.round(+p.w || 0)), h: Math.max(0, Math.round(+p.h || 0)) })) }; }
      if ('followupOn' in b) e.followup = Object.assign({ reads: [], prompts: [], checks: [] }, e.followup, { on: !!b.followupOn });
      if ('followupReads' in b) e.followup = Object.assign({ reads: [], prompts: [], checks: [] }, e.followup, { reads: (Array.isArray(b.followupReads) ? b.followupReads : []).map(String).filter(id => (e.readings || []).some(r => r.id === id)).slice(0, 12) });
      // the presenters, the names on prints and what TREE looks for are the director's
      if (dir) {
        if ('presenters' in b) { const ok = choices(); e.presenters = (Array.isArray(b.presenters) ? b.presenters : []).map(String).filter(n => ok.some(x => nameKey(x) === nameKey(n)) || (e.presenters || []).some(x => nameKey(x) === nameKey(n))).slice(0, 12); if (e.status === 'presented') credit(e, me); }
        if ('names' in b) e.names = NAMES.includes(b.names) ? b.names : 'none';
        if ('youngest' in b) e.youngest = !!b.youngest;
        if ('lens' in b) e.lens = txt(b.lens, 120);
        if (Array.isArray(b.look)) e.look = b.look.slice(0, 4).map((g, i) => ({ k: String(g.k || 'g' + i).slice(0, 12), label: txt(g.label, 120) || 'Words to look for', words: (Array.isArray(g.words) ? g.words : []).map(w => txt(w, 40).trim().toLowerCase()).filter(Boolean).slice(0, 60), with: (Array.isArray(g.with) ? g.with : []).map(w => txt(w, 40).trim().toLowerCase()).filter(Boolean).slice(0, 60) })).filter(g => g.words.length);
      } else if (['presenters', 'names', 'youngest', 'lens', 'look'].some(k => k in b)) return deny('The director chooses the presenters, the names on prints and what TREE looks for.');
      save(e, me); json(req, res, 200, forViewer(e, me)); return;
    }
    if (P === 'item') {
      const list = String(body.list || ''); if (!LISTS[list]) return err(req, res, 400, 'Not a part of the entry.');
      const at = list === 'prompts' || list === 'checks' ? e.followup = Object.assign({ on: false, reads: [], prompts: [], checks: [] }, e.followup) : e;
      const cur = at[list] || [];
      if (body.remove) { at[list] = cur.filter(x => x.id !== body.remove);
        if (list === 'chosen') { const gone = cur.find(x => x.id === body.remove); if (gone && gone.from && (e.evidence || {}).kept) delete e.evidence.kept[gone.from]; e.plan = (e.plan || []).map(s => Object.assign({}, s, { moments: (s.moments || []).filter(id => id !== body.remove) })); }
        if (list === 'readings') { e.plan = (e.plan || []).map(s => Object.assign({}, s, { readings: (s.readings || []).filter(id => id !== body.remove) })); e.followup = Object.assign({}, e.followup, { reads: ((e.followup || {}).reads || []).filter(id => id !== body.remove) }); }
        save(e, me); json(req, res, 200, forViewer(e, me)); return; }
      const x = body.item && typeof body.item === 'object' ? body.item : {};
      const was = cur.find(y => y.id === x.id);
      if (list === 'chosen' && !was) return err(req, res, 400, 'Choose a moment from Evidence, a lens or an observation.');
      let item; try { item = clean(list, Object.assign({}, was || {}, x), was, me); } catch (er) { return err(req, res, 400, er.message); }
      if (!was && cur.length >= LISTS[list]) return err(req, res, 400, 'This part is full. Take one out first.');
      at[list] = was ? cur.map(y => y.id === item.id ? item : y) : [...cur, item];
      save(e, me); json(req, res, 200, Object.assign(forViewer(e, me), { item })); return;
    }
    if (P === 'order') {
      const list = String(body.list || ''); if (!['chosen', 'plan', 'readings', 'meetings'].includes(list)) return err(req, res, 400, 'Not a part of the entry.');
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String); const cur = e[list] || [];
      // anything added since the page was drawn keeps its place at the end
      e[list] = [...ids.map(id => cur.find(x => x.id === id)).filter(Boolean), ...cur.filter(x => !ids.includes(x.id))];
      save(e, me); json(req, res, 200, forViewer(e, me)); return;
    }
    if (P === 'decide') {
      // keep or set aside a moment from Evidence. A kept one joins Chosen moments.
      const key = String(body.key || ''); if (!/^(obs|plan|thread|project|inquiry):[A-Za-z0-9_-]+$/.test(key)) return err(req, res, 400, 'That moment is not here.');
      e.evidence = { kept: Object.assign({}, (e.evidence || {}).kept), aside: Object.assign({}, (e.evidence || {}).aside) };
      delete e.evidence.kept[key]; delete e.evidence.aside[key];
      if (body.keep === true) { e.evidence.kept[key] = Date.now(); if (!(e.chosen || []).some(x => x.from === key)) { const m = momentFrom(key, me, e); if (!m) return err(req, res, 404, 'That moment is no longer in the records.'); if ((e.chosen || []).length >= LISTS.chosen) return err(req, res, 400, 'Chosen moments is full. Take one out first.'); e.chosen = [...(e.chosen || []), m]; } }
      else if (body.keep === false) { e.evidence.aside[key] = Date.now(); e.chosen = (e.chosen || []).filter(x => x.from !== key); }
      else e.chosen = (e.chosen || []).filter(x => x.from !== key);
      save(e, me); json(req, res, 200, forViewer(e, me)); return;
    }
    if (P === 'choose') {
      // any observation, or one read through a lens, joins Chosen moments
      const key = 'obs:' + String(body.obs || ''); if ((e.chosen || []).some(x => x.from === key)) { json(req, res, 200, forViewer(e, me)); return; }
      const m = momentFrom(key, me); if (!m) return err(req, res, 404, 'That observation is not here.');
      if ((e.chosen || []).length >= LISTS.chosen) return err(req, res, 400, 'Chosen moments is full. Take one out first.');
      e.chosen = [...(e.chosen || []), m]; save(e, me); json(req, res, 200, forViewer(e, me)); return;
    }
    if (P === 'presented') {
      if (!dir) return deny('Only the director marks an entry presented.');
      if (body.undo) { uncredit(e); e.status = 'planning'; e.presentedOn = ''; save(e, me); json(req, res, 200, forViewer(e, me)); return; }
      if (!(e.presenters || []).length && !body.alone) return err(req, res, 400, 'Add the presenters first, so their hours are logged.');
      e.status = 'presented'; e.presentedOn = ISO.test(body.date || '') ? body.date : e.date && e.date <= today() ? e.date : today();
      const n = credit(e, me); save(e, me); log('Presenting entry marked presented', e.id, 'by', me, n, 'presenters credited');
      json(req, res, 200, Object.assign(forViewer(e, me), { credited: n })); return;
    }
    if (P === 'copy') {
      // a finished entry starts a new one, with its plan, moments, readings and follow-up, and nothing of the day itself
      if (!dir) return deny('Only the director starts an entry.');
      const c2 = JSON.parse(JSON.stringify(e)); Object.assign(c2, { id: rid('pr'), title: txt(body.title, 160).trim() || e.title, date: '', status: 'planning', presentedOn: '', credit: {}, meetings: [], presenters: [], copiedFrom: e.id, createdAt: Date.now(), createdBy: me });
      delete c2.seed; save(c2, me); json(req, res, 200, forViewer(c2, me)); return;
    }
    if (P === 'remove') {
      if (!dir) return deny('Only the director removes an entry.'); if (e.status === 'presented') return err(req, res, 400, 'A presented entry stays, so its hours keep their record.');
      e.removed = true; save(e, me); json(req, res, 200, { ok: true }); return;
    }
    err(req, res, 404, 'Not found');
  }
  // what a PD day agenda block may carry, and what a reader of that agenda learns about the entry it opens
  const visibleTitle = (me, id) => { const e = one(id); return e && canRead(me, e) ? e.title : ''; };
  /* The presenting details the director gave in October 2026, the times, places, dates and notes of the two starting
     entries, were written into the records once on October 25, 2026 and live only there now, so no copy stays here. */
  // a presenter on an entry made from a module may open that module's original materials, as the director can
  const presentsModule = (me, slug) => !!slug && all().some(e => e.module === slug && presents(e, me));
  return { handle, seed, anyFor, ledBy, visibleTitle, agendasUsing, evidence, ID, presentsModule };
};
