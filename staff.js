'use strict';
/* Educators at Fulton. Each educator's records page, the New Educator section, the PD library's Licensing at Fulton and
   TREE How To pieces, the drill log and the Teacher Policies and Procedures.

   These are kept in the records under staff/, apart from the records every page of TREE receives, and they travel only
   through the /api/staff/ requests below. An educator's record is sent to that educator and the director and to no one
   else, and the server decides that, never the page. Certificates and forms go to the school's Google Drive the way
   photos do, and are read back only through here, never through a photo link. Health details are never kept, only the
   record or exemption itself, its date and its file.

   The director keeps each part visible only to her until she turns it on for educators in Settings.
   A new hire signs in before their first day and reaches only the New Educator section, with their own records, the
   PD library and the handbook, until the director turns on full access. */
const crypto = require('crypto');

module.exports = function staffModule(o) {
  const { gh, repo, store, log, accounts, accountFor, saveAccounts, isDirector, isKitchen, isOffice, nameKey, keepOriginal, readOriginal, reminders, lensNow, rosterNames, checkPasscode, nameBlocked, calendarEvents, setSetting } = o;
  const S = { files: new Map(), timers: new Map(), saving: new Map(), ready: false, loading: null };
  const DAY = 864e5;

  /* ---------- what a record holds ---------- */
  // records and certificates, in the order of CCLD's records list, LIC 311A, after the hiring forms
  const ITEMS = [
    { k: 'clearance', label: 'Criminal record and Child Abuse Central Index clearance', reg: 'Title 22, 101170 and 101170.2', months: 0 },
    { k: 'tb', label: 'TB and health screening', reg: 'LIC 503', months: 0 },
    { k: 'cpr', label: 'Pediatric First Aid and CPR', reg: 'Health and Safety Code 1596.866', months: 24, note: 'Fulton runs it in house' },
    { k: 'hs16', label: 'Health and safety training, 16 hours including 1 hour of nutrition', reg: 'CDSS PIN 26-11-CCP', months: 0 },
    { k: 'eplan', label: 'Emergency and disaster plan training', reg: 'Health and Safety Code 1596.868', months: 12, note: 'Before the first day of work and each year' },
    { k: 'mandated', label: 'Mandated reporter training', reg: 'Health and Safety Code 1596.8662', months: 24, note: 'Within 90 days of hire, renewed every two years' },
    { k: 'hsa', label: 'Healthy Schools Act training', reg: 'Healthy Schools Act', months: 12, note: 'Renewed each year' },
    { k: 'water', label: 'Water safety certificate', reg: 'Title 22, 101216.6', months: 24, note: 'Required of every educator because of creek walks' },
    // Fulton's own training, for everyone who cares for children. It shows as due until it is completed.
    { k: 'activesup', label: 'Active Supervision Training', reg: 'Fulton training', months: 0, fulton: true, note: 'With the CCLD video Supervising Children in Child Care Centers and the active supervision handouts' },
  ];
  const CDSS_FORM = n => `https://www.cdss.ca.gov/cdssweb/entres/forms/English/${n}.pdf`;
  const PAPERS = [
    { k: 'lic501', form: 'Personnel Record', num: 'LIC 501', why: 'Gives Licensing your work history and contact information', blank: CDSS_FORM('LIC501') },
    { k: 'lic503', form: 'Health Screening Report, with TB clearance', num: 'LIC 503', why: 'Shows you are healthy enough to care for children and free of TB', blank: CDSS_FORM('LIC503'), item: 'tb' },
    { k: 'lic508', form: 'Criminal Record Statement', num: 'LIC 508', why: 'Your own statement about any past convictions, required before fingerprinting', blank: CDSS_FORM('LIC508') },
    { k: 'livescan', form: 'Fingerprint and Child Abuse Central Index clearance', num: 'Live Scan', why: 'Confirms with the state that children are safe in your care', blank: '', item: 'clearance' },
    { k: 'lic9108', form: 'Acknowledgment of the duty to report suspected child abuse', num: 'LIC 9108', why: 'Confirms you know you are a mandated reporter', blank: CDSS_FORM('LIC9108') },
    { k: 'lic9052', form: 'Notice of Employee Rights, a copy given to the educator', num: 'LIC 9052', why: 'Tells you your rights, including how to raise a concern with Licensing', blank: CDSS_FORM('LIC9052') },
    { k: 'lic9095', form: 'Evaluation of Teacher Qualifications, with transcripts or ECE units', num: 'LIC 9095', why: 'Shows your education meets the state\'s requirements for your role', blank: CDSS_FORM('LIC9095') },
    { k: 'immun', form: 'Immunization record or exemption', num: 'H&S Code 1596.7995', why: 'Protects young children, who are most at risk from flu, whooping cough and measles', blank: '' },
    { k: 'emergency', form: 'Emergency contact information', num: 'Fulton', why: 'Lets us reach someone for you in an emergency', blank: '' },
    { k: 'mealwaiver', form: 'Meal Break Waiver', num: 'Fulton', why: 'Lets you waive your 30-minute meal break on shifts of six hours or less, as California law allows', blank: '' },
    { k: 'quickbooks', form: 'QuickBooks Workforce invitation, completed', num: 'QuickBooks', why: 'Sets up your pay and tax forms, which stay in QuickBooks', blank: '', director: true },
    { k: 'tppack', form: 'Teacher Policies and Procedures acknowledgment', num: 'Fulton', why: 'Confirms you have read how Fulton works', blank: '', ack: true },
  ];
  // the director's own marks, never an upload
  const DIRECTOR_PAPERS = ['quickbooks', 'idseen'];
  const CHECKLIST = [
    'Paperwork uploaded and clearances received', 'Immunization records or exemptions uploaded', 'Welcome and philosophy read', 'Who\'s who read', 'TREE How To guides read',
    'Mandated reporter certificate uploaded', 'Licensing at Fulton pieces finished', 'Licensing and safety review with you', 'First weeks check-ins with their go-to person',
    'Educator Reflection and Growth Plan started', 'Starting-point conversation, scheduled two months from the start date'];
  const DRILL_TYPES = ['Fire', 'Earthquake', 'Lockdown', 'Evacuation', 'Shelter in place', 'Other'];
  const REMIND_TYPES = { expiry: 'Certificates and trainings before they expire', flu: 'The yearly flu shot', hsa: 'Healthy Schools Act training each year', semester: 'Proof of enrollment each semester, below twelve units', drill: 'A drill when three months pass without one' };

  const pidOf = name => nameKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const pPath = name => `staff/people/${pidOf(name)}.json`;
  const SCHOOL = 'staff/school.json', DRILLS = 'staff/drills.json', SENT = 'staff/sent.json';
  const hbPath = id => `staff/handbook/${id}.json`;

  /* ---------- reading and saving ---------- */
  const get = p => { const r = S.files.get(p); return r ? r.doc : null; };
  function put(p, doc) { const r = S.files.get(p); S.files.set(p, { doc, sha: r && r.sha, local: true }); soon(p); return doc; }
  function soon(p) { clearTimeout(S.timers.get(p)); const t = setTimeout(() => { S.timers.delete(p); flush(p).catch(e => log('Educator record not saved', p, e.message)); }, 1200); if (t.unref) t.unref(); S.timers.set(p, t); }
  function flush(p) {
    const prev = S.saving.get(p) || Promise.resolve();
    const job = prev.then(async () => {
      const r = S.files.get(p); if (!r || !r.local) return true;
      const doc = r.doc, content = Buffer.from(JSON.stringify(doc, null, 1) + '\n', 'utf8').toString('base64');
      for (let k = 0; k < 4; k++) {
        if (k) await new Promise(ok => setTimeout(ok, 1500 * k));
        const res = await gh('PUT', `/repos/${repo}/contents/${p}`, { message: 'Update ' + p.replace(/^staff\//, 'educator records ').replace(/\.json$/, ''), content, branch: store.branch, ...(r.sha ? { sha: r.sha } : {}) });
        if (res.status === 200 || res.status === 201) { r.sha = res.json.content.sha; if (r.doc === doc) r.local = false; return true; }
        if (res.status === 409 || res.status === 422) { const g = await gh('GET', `/repos/${repo}/contents/${p}?ref=${encodeURIComponent(store.branch)}&fresh=${Date.now()}`); r.sha = g.status === 200 ? g.json.sha : undefined; continue; }
        if (res.status < 500 && res.status !== 429) break;
      }
      log('Educator record could not be saved', p); return false;
    });
    S.saving.set(p, job.catch(() => false)); return job;
  }
  async function flushAll() { for (const [p, t] of S.timers) { clearTimeout(t); S.timers.delete(p); } const ps = [...S.files].filter(([, r]) => r.local).map(([p]) => p); return (await Promise.all(ps.map(p => flush(p).catch(() => false)))).every(Boolean); }

  async function load() {
    if (S.loading) return S.loading;
    S.loading = (async () => {
      const tree = await gh('GET', `/repos/${repo}/git/trees/${encodeURIComponent(store.branch)}?recursive=1&fresh=${Date.now()}`);
      if (tree.status !== 200 && tree.status !== 409) throw new Error('GitHub answered ' + tree.status + ' when listing educator records');
      // the records hold the people, the handbook and the school's settings as JSON, and the PD library's pieces as
      // Markdown files, one piece each, so a new piece is added as a file with no change to TREE
      const want = ((tree.json && tree.json.tree) || []).filter(f => f.type === 'blob' && /^staff\/[a-z0-9/_.-]+\.(json|md)$/i.test(f.path));
      const seen = new Set(want.map(f => f.path));
      for (const p of [...S.files.keys()]) if (/\.md$/.test(p) && !seen.has(p)) S.files.delete(p);
      for (const f of want) {
        const cur = S.files.get(f.path); if (cur && cur.local) continue;
        const b = await gh('GET', `/repos/${repo}/git/blobs/${f.sha}`); if (b.status !== 200) throw new Error('GitHub answered ' + b.status + ' when reading ' + f.path);
        const text = Buffer.from(b.json.content, 'base64').toString('utf8');
        if (/\.md$/.test(f.path)) { S.files.set(f.path, { text, sha: f.sha }); continue; }
        try { S.files.set(f.path, { doc: JSON.parse(text), sha: f.sha }); } catch (e) { log('Skipped unreadable educator record', f.path); }
      }
      seed(); pieceCache = null; G.invalidate(); S.ready = true;
      try { await G.applySeed(saveAccounts, accountFor, setSetting); } catch (e) { log('Educator settings could not be applied', e.message); }
      log(`Loaded educator records, ${[...S.files.keys()].filter(p => p.startsWith('staff/people/')).length} people, ${[...S.files.keys()].filter(p => p.startsWith('staff/handbook/')).length} handbook sections`);
    })().catch(e => { S.loading = null; throw e; });
    return S.loading;
  }
  // the school's settings start with every part closed to educators. The handbook, the welcome and the pieces themselves
  // are kept in the records, never in TREE's own code, which anyone can read.
  function seed() {
    if (!get(SCHOOL)) put(SCHOOL, { open: { records: false, pd: false, handbook: false, newed: false }, welcome: '', philosophy: '', formLinks: {}, remindDays: 30, remind: {}, files: {} });
  }
  async function ready() { if (!S.ready) await load(); }
  const school = () => get(SCHOOL) || {};
  const opened = () => Object.assign({ records: false, pd: false, handbook: false, newed: false, growth: false }, school().open || {});

  /* ---------- the PD library's pieces, one file each in pd/, so a new piece needs no code ---------- */
  let pieceCache = null;
  function pieces() {
    if (pieceCache) return pieceCache;
    const out = {};
    for (const dir of ['licensing', 'howto']) {
      const pre = `staff/pd/${dir}/`;
      const names = [...S.files.keys()].filter(p => p.startsWith(pre) && /^\d+[a-z0-9-]*\.md$/i.test(p.slice(pre.length))).sort();
      out[dir] = names.map(p => parsePiece(dir, p.slice(pre.length), S.files.get(p).text || '')).filter(Boolean);
    }
    pieceCache = out; return out;
  }
  function parsePiece(dir, file, text) {
    const meta = {}; const m = text.match(/^\s*<!--([\s\S]*?)-->/);
    if (m) { for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i); if (kv) meta[kv[1].toLowerCase()] = kv[2]; } text = text.slice(m[0].length); }
    const t = text.match(/^##\s+(.+)$/m); if (!t) return null;
    const rest = text.slice(t.index + t[0].length);
    const cut = rest.search(/^###\s/m); const head = (cut >= 0 ? rest.slice(0, cut) : rest).trim();
    const lines = head.split('\n').map(s => s.trim()).filter(Boolean);
    const links = []; let minutes = Number(meta.minutes) || 0; let source = '';
    for (const l of lines) {
      const ls = [...l.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)];
      if (ls.length) { for (const x of ls) links.push({ text: x[1], url: x[2] }); }
      const mm = l.match(/About (\d+) minutes/i); if (mm) minutes = +mm[1];
      if (!ls.length && !mm && !source) source = l;
    }
    const sections = (cut >= 0 ? rest.slice(cut) : '').split(/^###\s+/m).filter(s => s.trim()).map(s => { const i = s.indexOf('\n'); return { heading: s.slice(0, i).trim(), body: s.slice(i + 1).trim() }; });
    return { id: dir + '/' + file.replace(/\.md$/, ''), dir, title: t[1].trim(), source, links, minutes: minutes || 5, list: meta.list || '', week: Number(meta.week) || 0,
      handbook: String(meta.handbook || '').split(',').map(s => s.trim()).filter(Boolean), sections };
  }

  /* ---------- people ---------- */
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DAY);
  /* an educator who has left Fulton keeps their account with their last day, leaveOn, and their profile keeps it as
     leftOn. From the day after, they are former. Their records page, Growth Plan, journal, check-ins, Proud Moments and
     evaluations wait in Former educators, which only the director opens. */
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function isFormerEducator(name) { const a = accountFor(name), t = today(); if (a && ISO_DAY.test(a.leaveOn || '') && a.leaveOn < t) return true; const l = profileOf(name).leftOn; return ISO_DAY.test(l || '') && l < t; }
  // everyone with a TREE sign-in has a records page, the office and the kitchen included, until they leave Fulton
  const staffNames = () => accounts.list.filter(a => a && a.name && !isFormerEducator(a.name)).map(a => a.name);
  const formerNames = () => accounts.list.filter(a => a && a.name && isFormerEducator(a.name)).map(a => a.name);
  function blankPerson(name) { return { name, profile: {}, items: {}, flu: {}, once: {}, units: {}, hours: [], paperwork: {}, checklist: {}, gotoCheckins: [], pd: { done: {}, read: {} }, review: {}, focus: [], printed: {}, files: {} }; }
  function person(name) { const d = get(pPath(name)); return Object.assign(blankPerson(name), d || {}, { name: (d && d.name) || name }); }
  const profileOf = name => (get(pPath(name)) || {}).profile || {};
  const roomOf = name => { const a = accountFor(name); if (a && a.room) return a.room; const ed = store.recs.settings.get('educators'); const r = ed && !ed.deleted && ed.doc && (ed.doc.names || []).find(x => x && nameKey(x.name) === nameKey(name)); return (r && r.room) || ''; };
  const isNewHire = name => { const a = accountFor(name); return !!(a && a.newHire && !isDirector(name)); };
  // the New Educator section stays with an educator through their first two months, from before their first day, and
  // in their first year until the starting-point conversation is held. The office and the kitchen have records only.
  function inNewEd(name) {
    if (isNewHire(name)) return true; if (profileOf(name).role === 'staff' || isKitchen(name)) return false;
    const st = profileOf(name).startDate; if (!/^\d{4}-\d{2}-\d{2}$/.test(st || '')) return false;
    const d = daysBetween(st, today()); if (d < 0 || d < 63) return true;
    return d < 365 && !((get(pPath(name)) || {}).checklist || {}).starting;
  }
  function allowed(me, sec) {
    if (isDirector(me)) return true; const o = opened();
    if (sec === 'newed') return o.newed && inNewEd(me);
    if (isNewHire(me)) return o.newed;
    return !!o[sec] || (o.newed && inNewEd(me));
  }
  const canSee = (me, name) => isDirector(me) || nameKey(me) === nameKey(name);
  // only someone with their own TREE sign-in has a record. A shared sign-in never starts one.
  const hasOwn = me => isDirector(me) || staffNames().some(n => nameKey(n) === nameKey(me));
  function whoRole(name) {
    if (isDirector(name)) return 'Director'; if (isKitchen(name)) return 'Kitchen'; if (isOffice(name)) return 'Office';
    const r = profileOf(name).role; return r === 'apprentice' ? 'Apprentice' : r === 'atelierista' ? 'Atelierista' : r === 'staff' ? 'Staff' : 'Educator';
  }
  function whosWho() {
    const names = new Map(); for (const n of rosterNames()) names.set(nameKey(n), n); for (const a of accounts.list) if (a && a.name && !names.has(nameKey(a.name))) names.set(nameKey(a.name), a.name);
    return [...names.values()].filter(n => !isFormerEducator(n)).map(n => ({ name: n, role: whoRole(n), room: roomOf(n) })).sort((a, b) => (a.role === 'Director' ? -1 : b.role === 'Director' ? 1 : 0) || a.name.localeCompare(b.name));
  }
  // one go-to person for every new educator, a program setting the director can change. It is shown to both, and the
  // new educator's first weeks check-ins are kept on their record. The go-to person sees only these, never growth.
  const goToName = () => { const g = String(school().goTo || ''); return g && !isFormerEducator(g) ? g : ''; };
  const goToOf = name => inNewEd(name) && goToName() && nameKey(goToName()) !== nameKey(name) ? goToName() : '';
  const pairedWith = name => goToName() && nameKey(goToName()) === nameKey(name) ? staffNames().filter(n => nameKey(n) !== nameKey(name) && inNewEd(n) && !isDirector(n)) : [];

  // what an educator may change on their own record. The rest is the director's.
  const OWN_KEYS = ['items', 'flu', 'once', 'units', 'hours', 'paperwork', 'checklist', 'pd', 'focus'];
  function mergeOwn(cur, next) {
    const out = JSON.parse(JSON.stringify(cur));
    for (const k of OWN_KEYS) if (next[k] !== undefined) out[k] = next[k];
    // the director's marks stay as she left them
    for (const k of DIRECTOR_PAPERS) { if (cur.paperwork && cur.paperwork[k]) out.paperwork[k] = cur.paperwork[k]; else if (out.paperwork) delete out.paperwork[k]; }
    for (const k of ['review8', 'starting']) { if (cur.checklist && cur.checklist[k]) out.checklist[k] = cur.checklist[k]; else if (out.checklist) delete out.checklist[k]; }
    out.focus = (cur.focus || []).map(f => { const n = (next.focus || []).find(x => x && x.id === f.id); return Object.assign({}, f, n && n.educatorOk && !f.educatorOk ? { educatorOk: Date.now() } : {}); });
    out.pd = Object.assign({}, cur.pd, next.pd || {});
    // hours TREE logged, from a finished piece, module or PD day, stay as TREE logged them
    if (next.hours !== undefined) out.hours = [...(cur.hours || []).filter(h => h && h.by === 'TREE'), ...(Array.isArray(next.hours) ? next.hours : []).filter(h => h && h.by !== 'TREE')];
    return out;
  }

  /* ---------- requests ---------- */
  async function handle(path_, body, me, req, res, { json, err, send }) {
    try { await ready(); } catch (e) { err(req, res, 503, 'The educator records are still loading. Try again in a moment.'); return; }
    const dir = isDirector(me), who = String(body.name || me);
    const deny = m => err(req, res, 403, m || 'This is not open yet.');
    const P = path_.slice('/api/staff/'.length);
    // a kitchen sign-in reaches its own records page and nothing else here
    if (isKitchen(me) && !(['boot', 'person', 'save', 'upload', 'file'].includes(P) && nameKey(who) === nameKey(me))) return deny('A kitchen sign-in reaches its own records page.');
    if (P.startsWith('g/')) { await G.handle(P.slice(2), body, me, req, res, { json, err }); return; }
    if (P === 'moment/file') {
      const fid = String(body.fid || ''); if (!/^staff-[a-f0-9]+\.[a-z]+$/.test(fid) || !G.momentFile(me, fid)) { err(req, res, 404, 'That photo is not here.'); return; }
      try { const buf = await readOriginal(fid); send(req, res, 200, { 'Content-Type': /\.png$/.test(fid) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, no-store' }, buf); } catch (e) { err(req, res, 502, 'The photo could not be read. ' + e.message); }
      return;
    }

    if (P === 'boot') {
      const mine = person(me); const o = opened();
      json(req, res, 200, { me: { name: me, director: dir, newHire: isNewHire(me), newEd: inNewEd(me), room: roomOf(me), role: whoRole(me), profile: mine.profile || {}, takesPart: G.takesPart(me), kitchen: isKitchen(me), goTo: goToOf(me) },
        open: o, can: canFor(me), goTo: goToName(), activeSupervision: school().activeSupervision || null,
        defs: { items: ITEMS, papers: PAPERS, checklist: CHECKLIST, drills: DRILL_TYPES, remind: REMIND_TYPES },
        school: { welcome: school().welcome || '', philosophy: school().philosophy || '', formLinks: school().formLinks || {}, remindDays: school().remindDays || 30, remind: school().remind || {}, goTo: goToName() },
        whosWho: whosWho(), lens: lensNow(), paired: pairedWith(me), today: today(), people: dir ? staffNames().sort() : [] });
      return;
    }
    // a piece added to the records is read without restarting TREE
    if (P === 'reload') { if (!dir) return deny(); S.loading = null; try { await load(); } catch (e) { err(req, res, 502, e.message); return; } json(req, res, 200, { ok: true, pieces: (pieces().licensing || []).length + (pieces().howto || []).length }); return; }
    if (P === 'pd') { if (!allowed(me, 'pd') && !allowed(me, 'newed')) return deny(); json(req, res, 200, pieces()); return; }
    if (P === 'handbook') {
      if (!allowed(me, 'handbook') && !allowed(me, 'newed')) return deny();
      const secs = [...S.files].filter(([p]) => p.startsWith('staff/handbook/')).map(([, r]) => r.doc).filter(Boolean).sort((a, b) => (a.order || 0) - (b.order || 0));
      json(req, res, 200, { sections: secs.filter(x => !x.removed || dir), doc: get('staff/handbook-doc.json') || {} }); return;
    }
    if (P === 'handbook/save') {
      if (!dir) return deny('Only the director edits the Teacher Policies and Procedures.');
      const id = String(body.id || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); if (!id) { err(req, res, 400, 'Give the section a title.'); return; }
      if (body.remove) { const r = S.files.get(hbPath(id)); if (r) { put(hbPath(id), Object.assign({}, r.doc, { removed: true, updatedAt: Date.now(), updatedBy: me })); } json(req, res, 200, { ok: true }); return; }
      const cur = get(hbPath(id)) || { id, group: 'new', order: Math.max(0, ...[...S.files].filter(([p]) => p.startsWith('staff/handbook/')).map(([, r]) => r.doc.order || 0)) + 1 };
      const doc = Object.assign({}, cur, { title: String(body.title || cur.title || '').slice(0, 120), body: String(body.body || '').slice(0, 60000), updatedAt: Date.now(), updatedBy: me });
      delete doc.removed; put(hbPath(id), doc); json(req, res, 200, doc); return;
    }
    if (P === 'person') {
      if (!canSee(me, who)) return deny('Only you and the director see your records.');
      if (!dir && !allowed(me, 'records') && !allowed(me, 'newed')) return deny();
      // a shared file on this record, such as a class roster, comes with its name
      const doc0 = person(who), sf = school().files || {}, txt = JSON.stringify(doc0);
      const shared = Object.fromEntries(Object.entries(sf).filter(([f]) => txt.includes(f)));
      json(req, res, 200, Object.assign(doc0, { shared, planStarted: G.planStarted(who), goTo: goToOf(who), paired: pairedWith(who).map(n => ({ name: n, startDate: profileOf(n).startDate || '', checkins: person(n).gotoCheckins || [] })) })); return;
    }
    // the director's list of educators who have left Fulton, with their last day. Each opens to their records and growth.
    if (P === 'former') {
      if (!dir) return deny('Only the director opens Former educators.');
      json(req, res, 200, { people: formerNames().sort().map(n => { const a = accountFor(n) || {}; return { name: n, room: roomOf(n), role: whoRole(n), leftOn: a.leaveOn || profileOf(n).leftOn || '', growth: G.hasGrowth(n) }; }) }); return;
    }
    if (P === 'people') {
      if (!dir) return deny('Only the director sees every educator\'s records.');
      const sf = school().files || {};
      const withShared = d => { const txt = JSON.stringify(d); return Object.fromEntries(Object.entries(sf).filter(([f]) => txt.includes(f))); };
      json(req, res, 200, { people: staffNames().sort().map(n => { const d = person(n); return Object.assign(d, { shared: withShared(d), room: roomOf(n), role: whoRole(n), newHire: isNewHire(n), newEd: inNewEd(n) }); }), drills: (get(DRILLS) || {}).list || [] }); return;
    }
    if (P === 'save') {
      if (!canSee(me, who)) return deny('Only you and the director change your records.');
      if (!dir && !allowed(me, 'records') && !allowed(me, 'newed')) return deny();
      if (!dir && !staffNames().some(n => nameKey(n) === nameKey(who))) return deny();
      const cur = person(who), next = body.doc && typeof body.doc === 'object' ? body.doc : {};
      let doc;
      if (dir) { doc = Object.assign(JSON.parse(JSON.stringify(cur)), next, { name: cur.name, files: cur.files }); }
      else doc = mergeOwn(cur, next);
      // what the page was sent alongside the record is never kept in it
      for (const k of ['shared', 'paired', 'goTo', 'room', 'role', 'newHire', 'newEd']) delete doc[k];
      doc.updatedAt = Date.now(); doc.updatedBy = me;
      put(pPath(who), doc); json(req, res, 200, doc); return;
    }
    if (P === 'upload' && body.moment) {
      // a photo for a proud moment, seen only by the audience chosen for the moment
      if (!G.takesPart(me) && !dir) return deny();
      const ext = (String(body.filename || '').toLowerCase().match(/\.(jpe?g|png)$/) || [])[1]; if (!ext || typeof body.data !== 'string') { err(req, res, 400, 'Choose a photo.'); return; }
      const buf = Buffer.from(body.data, 'base64'); if (buf.length > 8 * 1024 * 1024) { err(req, res, 413, 'That photo is larger than 8 MB.'); return; }
      const fid = 'staff-' + crypto.randomBytes(8).toString('hex') + '.' + (ext === 'png' ? 'png' : 'jpg');
      try { await keepOriginal(fid, buf, ext === 'png' ? 'image/png' : 'image/jpeg', 'Add a proud moment photo'); } catch (e) { err(req, res, 502, 'The photo could not be kept. ' + e.message); return; }
      json(req, res, 200, { fid }); return;
    }
    if (P === 'upload') {
      if (!canSee(me, who) || !hasOwn(who)) return deny('Only you and the director add files to your records.');
      if (!dir && !allowed(me, 'records') && !allowed(me, 'newed')) return deny();
      const name = String(body.filename || 'file').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-60);
      const ext = (name.match(/\.(pdf|jpe?g|png|webp|heic)$/) || [])[1];
      if (!ext || typeof body.data !== 'string') { err(req, res, 400, 'Upload a photo or a PDF.'); return; }
      const buf = Buffer.from(body.data, 'base64');
      if (buf.length > 15 * 1024 * 1024) { err(req, res, 413, 'That file is larger than 15 MB. Save it smaller or as fewer pages.'); return; }
      const fid = 'staff-' + crypto.randomBytes(8).toString('hex') + '.' + (ext === 'jpeg' ? 'jpg' : ext);
      const type = { pdf: 'application/pdf', png: 'image/png', webp: 'image/webp', heic: 'image/heic' }[ext] || 'image/jpeg';
      try { await keepOriginal(fid, buf, type, 'Add an educator record'); } catch (e) { err(req, res, 502, 'The file could not be kept. ' + e.message); return; }
      const shared = !!body.school && dir;
      const meta = { name: String(body.filename || 'file').slice(0, 120), type, size: buf.length, at: Date.now(), by: me, label: String(body.label || '').slice(0, 120) };
      if (shared) { const sc = Object.assign({}, school()); sc.files = Object.assign({}, sc.files, { [fid]: meta }); put(SCHOOL, sc); json(req, res, 200, { fid, meta }); return; }
      const doc = person(who); doc.files = Object.assign({}, doc.files, { [fid]: meta }); doc.updatedAt = Date.now(); put(pPath(who), doc);
      log('Educator record file kept for', who, 'by', me);
      json(req, res, 200, { fid, meta, doc }); return;
    }
    if (P === 'link') {
      if (!dir) return deny('Only the director links certificates already in Drive.');
      const url = String(body.url || '').trim(); if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url)) { err(req, res, 400, 'Paste a Google Drive link.'); return; }
      const fid = 'link-' + crypto.randomBytes(8).toString('hex');
      const doc = person(who); doc.files = Object.assign({}, doc.files, { [fid]: { name: String(body.label || 'Certificate in Drive').slice(0, 120), link: url, at: Date.now(), by: me } }); put(pPath(who), doc);
      json(req, res, 200, { fid, doc }); return;
    }
    if (P === 'file') {
      const fid = String(body.fid || '');
      const mine = person(who), sc = school();
      const known = (mine.files || {})[fid] || (sc.files || {})[fid];
      if (!known || !/^staff-[a-f0-9]+\.[a-z]+$/.test(fid)) { err(req, res, 404, 'That file is not here.'); return; }
      // a shared file, such as a class roster, opens for the director and for anyone whose record uses it
      if (!canSee(me, who) || ((sc.files || {})[fid] && !dir && !JSON.stringify(person(me)).includes(fid))) return deny('Only you and the director open your records.');
      try { const buf = await readOriginal(fid); send(req, res, 200, { 'Content-Type': known.type || 'application/octet-stream', 'Cache-Control': 'private, no-store' }, buf); }
      catch (e) { err(req, res, 502, 'The file could not be read. ' + e.message); }
      return;
    }
    if (P === 'group') {
      if (!dir) return deny('Only the director records a class for everyone.');
      const item = ITEMS.find(i => i.k === body.item); const date = String(body.date || '');
      if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { err(req, res, 400, 'Choose the training and its date.'); return; }
      const names = (Array.isArray(body.names) ? body.names : []).filter(n => staffNames().some(x => nameKey(x) === nameKey(n)));
      for (const n of names) { const doc = person(n); doc.items = Object.assign({}, doc.items); const was = doc.items[item.k] || {};
        doc.items[item.k] = Object.assign({}, was, { date, expires: '', files: [...new Set([...(body.roster ? [String(body.roster)] : [])])], note: body.note ? String(body.note).slice(0, 200) : 'In-house class', by: me, at: Date.now(), renewed: was.date && was.date !== date ? Date.now() : was.renewed });
        put(pPath(n), doc); }
      log('Group training recorded', item.k, date, names.length, 'educators by', me);
      json(req, res, 200, { ok: true, n: names.length }); return;
    }
    if (P === 'school') {
      if (!dir) return deny('Only the director changes these settings.');
      const sc = Object.assign({}, school()); const b = body.school || {};
      if (b.open) sc.open = Object.assign({}, opened(), Object.fromEntries(Object.entries(b.open).filter(([k]) => ['records', 'pd', 'handbook', 'newed', 'growth'].includes(k)).map(([k, v]) => [k, !!v])));
      // the go-to person for every new educator. Someone marked never to be assigned is refused.
      if ('goTo' in b) { const g = String(b.goTo || '').slice(0, 40); if (g && (!staffNames().some(n => nameKey(n) === nameKey(g)) || profileOf(g).neverGoTo)) { err(req, res, 400, 'Choose someone else as the go-to person.'); return; } sc.goTo = g; }
      if (b.checkin && typeof b.checkin === 'object') sc.checkin = { week: Math.min(4, Math.max(1, Math.round(+b.checkin.week || 1))), secondTime: /^\d{2}:\d{2}$/.test(b.checkin.secondTime || '') ? b.checkin.secondTime : '', minutes: 20 };
      if (b.meeting && typeof b.meeting === 'object') sc.meeting = { start: /^\d{2}:\d{2}$/.test(b.meeting.start || '') ? b.meeting.start : '13:15', end: /^\d{2}:\d{2}$/.test(b.meeting.end || '') ? b.meeting.end : '14:30' };
      if (typeof b.welcome === 'string') sc.welcome = b.welcome.slice(0, 8000);
      if (typeof b.philosophy === 'string') sc.philosophy = b.philosophy.slice(0, 30000);
      if (b.formLinks && typeof b.formLinks === 'object') sc.formLinks = Object.fromEntries(Object.entries(b.formLinks).filter(([k, v]) => PAPERS.some(p => p.k === k) && (!v || /^https:\/\//.test(v))).map(([k, v]) => [k, String(v || '').slice(0, 500)]));
      if (b.remindDays > 0) sc.remindDays = Math.min(120, Math.round(b.remindDays));
      if (b.remind && typeof b.remind === 'object') sc.remind = Object.fromEntries(Object.keys(REMIND_TYPES).map(k => [k, b.remind[k] !== false]));
      sc.updatedAt = Date.now(); sc.updatedBy = me; put(SCHOOL, sc); json(req, res, 200, { ok: true }); return;
    }
    if (P === 'profile') {
      if (!dir) return deny('Only the director sets an educator\'s details.');
      const doc = person(who); const b = body.profile || {};
      doc.profile = Object.assign({}, doc.profile);
      if ('role' in b) doc.profile.role = ['educator', 'apprentice', 'atelierista', 'staff'].includes(b.role) ? b.role : 'educator';
      if ('planHour' in b) doc.profile.planHour = /^\d{2}:\d{2}$/.test(b.planHour || '') ? b.planHour : '';
      if ('checkin' in b) doc.profile.checkin = ['slot', 'second', 'asneeded'].includes(b.checkin) ? b.checkin : '';
      if ('journalEvery' in b) doc.profile.journalEvery = +b.journalEvery === 2 ? 2 : 1;
      for (const k of ['partTime', 'noMondays', 'lighter']) if (k in b) doc.profile[k] = !!b[k] && b[k] !== '0';
      if ('curriculumFrom' in b) doc.profile.curriculumFrom = b.curriculumFrom === 'smallgroup' ? 'smallgroup' : '';
      if ('startDate' in b) doc.profile.startDate = /^\d{4}-\d{2}-\d{2}$/.test(b.startDate || '') ? b.startDate : '';
      if ('goTo' in b) doc.profile.goTo = String(b.goTo || '').slice(0, 40);
      put(pPath(who), doc);
      if ('room' in b) { const a = accountFor(who); if (a) { a.room = String(b.room || '').slice(0, 20); await saveAccounts(me); } }
      json(req, res, 200, { ok: true, profile: doc.profile }); return;
    }
    if (P === 'newhire') {
      if (!dir) return deny('Only the director adds a new educator.');
      const name = String(body.newName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
      if (!/^[A-Za-z][A-Za-z .'-]{0,29}$/.test(name)) { err(req, res, 400, 'Type the new educator\'s first name, letters only.'); return; }
      if (accountFor(name)) { err(req, res, 409, name + ' already has a sign-in.'); return; }
      accounts.list.push({ name, room: String(body.room || '').slice(0, 20), director: false, newHire: true, addedBy: me, addedAt: Date.now(), code: '', start: crypto.randomBytes(3).toString('hex'), v: 0 });
      if (!(await saveAccounts(me))) { err(req, res, 502, 'The sign-in could not be saved. Try again.'); return; }
      const doc = person(name); doc.profile = { role: body.role === 'apprentice' ? 'apprentice' : 'educator', startDate: /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '') ? body.startDate : '', planHour: '' };
      put(pPath(name), doc); log('New educator added', name, 'by', me);
      json(req, res, 200, { ok: true }); return;
    }
    if (P === 'access') {
      if (!dir) return deny('Only the director turns on full access.');
      const a = accountFor(who); if (!a) { err(req, res, 404, 'That sign-in is not here.'); return; }
      a.newHire = !body.full; if (!(await saveAccounts(me))) { err(req, res, 502, 'The sign-in could not be saved. Try again.'); return; }
      log(body.full ? 'Full access turned on for' : 'Access limited to the New Educator section for', a.name, 'by', me);
      json(req, res, 200, { ok: true }); return;
    }
    if (P === 'review') {
      if (!dir) return deny('Only the director marks the licensing list.');
      const piece = (pieces().licensing || []).find(x => x.id === body.piece); if (!piece) { err(req, res, 400, 'That item is not on the list.'); return; }
      const doc = person(who); doc.review = Object.assign({}, doc.review);
      if (!body.mark) delete doc.review[piece.id]; else doc.review[piece.id] = { mark: body.mark === 'review' ? 'review' : 'inplace', at: Date.now(), by: me };
      // Let's review together becomes a suggested Focus Until Next Time, which the two confirm together
      doc.focus = (doc.focus || []).filter(f => !(f.piece === piece.id && !f.educatorOk));
      if (body.mark === 'review') doc.focus.push({ id: 'f' + crypto.randomBytes(4).toString('hex'), piece: piece.id, label: piece.title, at: Date.now(), by: me, directorOk: 0, educatorOk: 0 });
      put(pPath(who), doc); json(req, res, 200, doc); return;
    }
    if (P === 'focus') {
      if (!canSee(me, who)) return deny();
      const doc = person(who); const f = (doc.focus || []).find(x => x.id === body.id); if (!f) { err(req, res, 404, 'That focus is not here.'); return; }
      if (dir) f.directorOk = f.directorOk ? 0 : Date.now(); else if (!f.educatorOk) f.educatorOk = Date.now();
      put(pPath(who), doc); json(req, res, 200, doc); return;
    }
    if (P === 'pd/done') {
      if ((!allowed(me, 'pd') && !allowed(me, 'newed')) || !hasOwn(me)) return deny();
      const all = [...(pieces().licensing || []), ...(pieces().howto || [])]; const pc = all.find(x => x.id === body.id); if (!pc) { err(req, res, 404, 'That piece is not here.'); return; }
      const doc = person(me); doc.pd = Object.assign({ done: {}, read: {} }, doc.pd); doc.pd.done = Object.assign({}, doc.pd.done);
      const was = doc.pd.done[pc.id];
      doc.pd.done[pc.id] = { at: (was && was.at) || Date.now(), answer: String(body.answer || '').slice(0, 4000), minutes: pc.minutes };
      // each finished piece logs its minutes toward the year's professional development hours, once
      if (!was) doc.hours = [...(doc.hours || []), { id: 'h' + crypto.randomBytes(4).toString('hex'), date: today(), title: (pc.dir === 'licensing' ? 'Licensing at Fulton, ' : 'TREE How To, ') + pc.title, hours: Math.round(pc.minutes / 6) / 10, kind: pc.dir === 'licensing' ? 'licensing' : 'pd', approved: false, by: 'TREE' }];
      doc.updatedAt = Date.now(); put(pPath(me), doc); json(req, res, 200, doc); return;
    }
    if (P === 'read') {
      if ((!allowed(me, 'newed') && !allowed(me, 'records')) || !hasOwn(me)) return deny();
      const k = ['welcome', 'whoswho', 'handbook'].includes(body.what) ? body.what : ''; if (!k) { err(req, res, 400, 'Not a page.'); return; }
      const doc = person(me); doc.pd = Object.assign({ done: {}, read: {} }, doc.pd); doc.pd.read = Object.assign({}, doc.pd.read, { [k]: doc.pd.read[k] || Date.now() });
      if (k === 'handbook') { doc.paperwork = Object.assign({}, doc.paperwork, { tppack: Object.assign({}, doc.paperwork.tppack, { ack: (doc.paperwork.tppack && doc.paperwork.tppack.ack) || Date.now() }) }); }
      put(pPath(me), doc); json(req, res, 200, doc); return;
    }
    if (P === 'goto') {
      // the go-to team member, or the new educator, notes this week's check-in
      const nb = String(body.newName || me); const isGo = !!goToOf(nb) && nameKey(goToOf(nb)) === nameKey(me);
      if (!(dir || isGo || nameKey(nb) === nameKey(me)) || !hasOwn(nb)) return deny('Only the new educator and their go-to team member note check-ins.');
      if (!allowed(me, 'newed') && !allowed(me, 'records') && !dir) return deny();
      const doc = person(nb); const wk = mondayOf(today());
      doc.gotoCheckins = (doc.gotoCheckins || []).filter(c => c.week !== wk || body.undo !== true);
      if (body.undo !== true && !doc.gotoCheckins.some(c => c.week === wk)) doc.gotoCheckins.push({ week: wk, at: Date.now(), by: me });
      put(pPath(nb), doc);
      // the go-to person sees the pairing and the first weeks check-ins only, never the rest of the record
      json(req, res, 200, dir || nameKey(nb) === nameKey(me) ? doc : { name: doc.name, gotoCheckins: doc.gotoCheckins }); return;
    }
    if (P === 'drills') {
      if (!dir) return deny('Only the director keeps the drill log.');
      const d = Object.assign({ list: [] }, get(DRILLS) || {});
      if (body.add) { const a = body.add; if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '') || !DRILL_TYPES.includes(a.type)) { err(req, res, 400, 'Choose the drill\'s date and type.'); return; }
        d.list = [...d.list, { id: 'd' + crypto.randomBytes(4).toString('hex'), date: a.date, type: a.type, time: /^\d{2}:\d{2}$/.test(a.time || '') ? a.time : '', note: String(a.note || '').slice(0, 300), by: me, at: Date.now() }].sort((x, y) => y.date.localeCompare(x.date)); put(DRILLS, d); }
      if (body.remove) { d.list = d.list.filter(x => x.id !== body.remove); put(DRILLS, d); }
      json(req, res, 200, { list: d.list }); return;
    }
    if (P === 'printed') {
      if (!dir) return deny();
      const doc = person(who); doc.printed = { at: Date.now(), by: me, files: [...new Set([...((doc.printed && doc.printed.files) || []), ...(Array.isArray(body.fids) ? body.fids.map(String) : [])])], cover: today() };
      put(pPath(who), doc); json(req, res, 200, doc); return;
    }
    err(req, res, 404, 'Not found');
  }
  function mondayOf(iso) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }

  /* ---------- reminders, always on, through TREE's own reminders. The director sets how far ahead, and only she ---------- */
  const sentDoc = () => get(SENT) || {};
  const once = (k) => { const s = sentDoc(); if (s[k]) return false; put(SENT, Object.assign({}, s, { [k]: today() })); return true; };
  const expiryOf = (item, rec) => !rec || !rec.date ? '' : rec.expires || (item.months ? addMonths(rec.date, item.months) : '');
  const longDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
  const fluSeason = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return String(m >= 8 ? y : y - 1); };
  function semesterOf(iso) { const y = iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 8 ? y + '-fall' : m <= 5 ? y + '-spring' : ''; }
  function dueFor(name, day) {
    const sc = school(), on = k => !sc.remind || sc.remind[k] !== false, lead = sc.remindDays || 30, doc = person(name), out = [];
    if (on('expiry') || on('hsa')) for (const it of ITEMS) {
      if (it.k === 'hsa' ? !on('hsa') : !on('expiry')) continue;
      const ex = expiryOf(it, (doc.items || {})[it.k]); if (!ex) continue; const left = daysBetween(day, ex);
      if (left <= lead && left > 0 && once(`${pidOf(name)}|${it.k}|${ex}|soon`)) out.push(`${it.label} expires ${longDay(ex)}`);
      else if (left <= 0 && once(`${pidOf(name)}|${it.k}|${ex}|out`)) out.push(`${it.label} expired ${longDay(ex)}`);
    }
    if (on('flu')) {
      const st = (doc.profile || {}).startDate || ''; const m = day.slice(5, 7), md = day.slice(5);
      // the flu shot is due each year between August 1 and December 1, with a reminder before August 1
      const season = md >= '07-15' && md < '08-01' ? day.slice(0, 4) : fluSeason(day);
      const firstYear = st && st > season + '-12-01' && st < (+season + 1) + '-08-01';
      const has = (doc.flu || {})[season];
      if (!has && !firstYear && md >= '07-15' && md < '08-01' && once(`${pidOf(name)}|flu|${season}|before`)) out.push('The flu shot is due between August 1 and December 1');
      if (!has && !firstYear && (m === '11') && once(`${pidOf(name)}|flu|${season}|nov`)) out.push('The flu shot, or a written exemption, is due by December 1');
    }
    if (on('semester')) {
      const u = doc.units || {}; const sem = semesterOf(day);
      if (sem && Number(u.completed) < 12 && (u.completed !== undefined && u.completed !== '') && !((u.semesters || {})[sem] || {}).files?.length) {
        const start = sem.endsWith('fall') ? day.slice(0, 4) + '-08-20' : day.slice(0, 4) + '-01-20';
        // once each semester, from the day it starts
        if (day >= start && once(`${pidOf(name)}|sem|${sem}`)) out.push('Proof of enrollment for this semester, until you reach twelve units');
      }
    }
    return out;
  }
  let busy = false;
  async function tick() {
    if (busy || !S.ready || !accounts.loaded || !reminders.keys()) return; busy = true;
    try {
      const now = new Date(); const day = today(); const hr = +now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }) % 24; const dow = new Date(day + 'T12:00:00Z').getUTCDay();
      if (dow < 1 || dow > 5 || hr < 8 || hr >= 11 || sentDoc().day === day) return;
      put(SENT, Object.assign({}, sentDoc(), { day }));
      const dirs = accounts.list.filter(a => isDirector(a.name)).map(a => a.name); const summary = [];
      for (const n of staffNames()) {
        const items = dueFor(n, day); if (!items.length) continue;
        if (!isDirector(n) && (opened().records || inNewEd(n))) await reminders.sendTo(n, { title: 'TREE, your records', body: items.join('\n'), url: 'tree.html?go=records', tag: 'tree-records' });
        summary.push(`${n}, ${items.join('; ').toLowerCase()}`);
      }
      const sc = school(); const drills = (get(DRILLS) || {}).list || [];
      if (sc.remind?.drill !== false) { const last = drills.map(d => d.date).sort().pop(); if ((!last || daysBetween(last, day) >= 90) && dow === 1 && once('drill|' + (last || 'none'))) summary.push(last ? `No emergency drill since ${longDay(last)}. Drills happen at least every three months.` : 'No emergency drill is in the log yet. Drills happen at least every three months.'); }
      if (summary.length) for (const d of dirs) await reminders.sendTo(d, { title: 'TREE, educator records', body: summary.join('\n'), url: 'tree.html?go=records', tag: 'tree-records-dir' });
    } catch (e) { log('Educator record reminders failed,', e.message); } finally { busy = false; }
  }
  setInterval(tick, 5 * 60e3).unref(); setTimeout(tick, 60e3).unref();

  /* ---------- for the server ---------- */
  // a shared sign-in reads the PD library and the Teacher Policies and Procedures, and has no records or growth of its own
  function canFor(name) { if (!hasOwn(name)) return { records: false, pd: allowed(name, 'pd'), handbook: allowed(name, 'handbook'), newed: false, growth: false };
    if (isKitchen(name) || profileOf(name).role === 'staff') { const r = allowed(name, 'records'); return { records: r, pd: false, handbook: false, newed: false, growth: false }; }
    return { records: allowed(name, 'records'), pd: allowed(name, 'pd'), handbook: allowed(name, 'handbook'), newed: allowed(name, 'newed'), growth: !!S.ready && (isDirector(name) || (G.takesPart(name) && !!opened().growth)) }; }
  function bootInfo(name) { if (!S.ready) return { loading: true, director: isDirector(name) };
    return { director: isDirector(name), newHire: isNewHire(name), newEd: inNewEd(name), open: opened(), can: canFor(name) }; }
  // the weekly backup holds every educator record and the handbook. Sign-ins and passcodes stay out, as before.
  const dump = () => Object.fromEntries([...S.files].filter(([, r]) => r && (r.doc || typeof r.text === 'string')).map(([p, r]) => [p, r.doc || r.text]));
  // the growth part, kept in growth.js, shares these records and the server's rules
  const G = require('./growth.js')({ get, put, S, log, person, profileOf, pPath, pidOf, staffNames, isDirector, isKitchen, nameKey, school, opened, today, addMonths, daysBetween,
    mondayOf, roomOf, pieces, checkPasscode, nameBlocked, calendarEvents, reminders, store, lensNow, isNewHire, inNewEd, isFormerEducator });
  // any file under staff/ for this person, their record, growth, journal or a Proud Moment by them or for them
  function hasFiles(name) { if ([pPath(name), G.gPath(name), G.jPath(name)].some(p => S.files.has(p))) return true; return G.momentsOf(name).length > 0; }
  // the last day kept on the educator's profile as leftOn, or taken off when they stay or come back
  async function markLeft(name, day) {
    await ready(); const has = S.files.has(pPath(name)); if (!day && !has) return;
    const doc = person(name); doc.profile = Object.assign({}, doc.profile); if (day) doc.profile.leftOn = day; else delete doc.profile.leftOn;
    if (has && (get(pPath(name)).profile || {}).leftOn === doc.profile.leftOn) return; put(pPath(name), doc);
  }
  return { load, handle, flushAll, bootInfo, dump, isNewHire, isFormerEducator, formerNames, hasFiles, markLeft, tick, growthTick: () => G.tick(), pieces, dueFor, calendarExtra: (f, t, me) => { try { return S.ready ? G.calendarExtra(f, t, me) : []; } catch (e) { return []; } }, displayMoments: () => G.displayMoments(), rev: () => G.rev() };
};
