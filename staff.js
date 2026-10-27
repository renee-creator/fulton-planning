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
   PD library and the handbook, until the director turns on full access.
   The Teacher Policies and Procedures and the Family Handbook, section by section, are in policies.js. */
const crypto = require('crypto');
const NOTICES = require('./notices.js');

module.exports = function staffModule(o) {
  let RECS_EDIT = null;
  // the Classes, from Program settings, the one list
  const classrooms = () => (o.classrooms ? o.classrooms() : []);
  const { gh, repo, store, log, accounts, accountFor, saveAccounts, isDirector, isKitchen, isOffice, nameKey, keepOriginal, readOriginal, reminders, lensNow, rosterNames, checkPasscode, nameBlocked, calendarEvents, setSetting } = o;
  const S = { files: new Map(), timers: new Map(), saving: new Map(), imgs: new Map(), imgCache: new Map(), ready: false, loading: null };
  const DAY = 864e5;

  /* ---------- what a record holds ---------- */
  // records and certificates, in the order of CCLD's records list, LIC 311A, after the hiring forms
  /* Each training has two links, the regulation it meets and the page where the training is taken, from its official
     provider. A link marked check could not be opened when it was set on October 25, 2026, and waits for the director to
     confirm it. The Legislature's own site holds the Health and Safety Code, since CDSS links there for it. */
  const LAW = (code, sec) => ({ text: (code === 'HSC' ? 'Health and Safety Code ' : 'Penal Code ') + sec, url: `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${code}&sectionNum=${sec}`, check: true });
  const T22 = sec => ({ text: 'Title 22, section ' + sec, url: 'https://www.cdss.ca.gov/ord/entres/getinfo/pdf/ccc4.pdf', check: true });
  const EMSA = { text: 'EMSA approved child care training programs', url: 'https://emsa.ca.gov/childcare/', check: true };
  const REDCROSS = { text: 'American Red Cross, Water Safety for Parents and Caregivers', url: 'https://www.redcross.org/take-a-class/classes/water-safety-for-parents-and-caregivers/a6R3o0000012oT8.html' };
  const ITEMS = [
    { k: 'clearance', label: 'Criminal record and Child Abuse Central Index clearance', reg: 'Title 22, 101170 and 101170.2', months: 0, law: T22('101170') },
    { k: 'tb', label: 'TB and health screening', reg: 'LIC 503', months: 0, law: { text: 'LIC 503, Health Screening Report', url: 'https://www.cdss.ca.gov/cdssweb/entres/forms/English/LIC503.pdf', check: true } },
    { k: 'cpr', label: 'Pediatric First Aid and CPR', reg: 'Health and Safety Code 1596.866', months: 24, note: 'We run it in house', law: LAW('HSC', '1596.866'), course: EMSA },
    { k: 'hs16', label: 'Health and safety training, 16 hours including 1 hour of nutrition', reg: 'CDSS PIN 26-11-CCP', months: 0,
      law: { text: 'CDSS PIN 26-11-CCP, in the child care Provider Information Notices', url: 'https://www.cdss.ca.gov/inforesources/community-care-licensing/policy/provider-information-notices/child-care', check: true }, course: EMSA },
    { k: 'eplan', label: 'Emergency and disaster plan training', reg: 'Health and Safety Code 1596.868', months: 12, note: 'Before the first day of work and each year', law: LAW('HSC', '1596.868'),
      course: { text: 'Taken at our school, with the CDSS Disaster Resources page', url: 'https://www.cdss.ca.gov/inforesources/child-care-licensing/public-information-and-resources/disaster-resources', check: true } },
    { k: 'mandated', label: 'Mandated reporter training', reg: 'Health and Safety Code 1596.8662', months: 24, note: 'Within 90 days of hire, renewed every two years', law: LAW('HSC', '1596.8662'),
      course: { text: 'California mandated reporter training. Choose the child care training on that page', url: 'https://mandatedreportertraining.com/california/', check: true } },
    { k: 'hsa', label: 'Healthy Schools Act training', reg: 'Healthy Schools Act', months: 12, note: 'Renewed each year',
      law: { text: 'Healthy Schools Act, California Department of Pesticide Regulation', url: 'https://www.cdpr.ca.gov/healthy-schools-act/', check: true },
      course: { text: 'Healthy Schools Act training, Basic Integrated Germ Management', url: 'https://www.cdpr.ca.gov/healthy-schools-act/healthy-schools-act-training/', check: true } },
    { k: 'water', label: 'Water safety certificate', reg: 'Title 22, 101216.6', months: 24, note: 'Required of every educator because of creek walks', law: T22('101216.6'), course: Object.assign({}, REDCROSS, { check: true }) },
    // a training the director chooses for each person, shown only for those she marks
    { k: 'rcwater', label: 'Water Safety for Parents and Caregivers, American Red Cross', reg: 'Title 22, 101216.6', months: 0, chosen: true, note: 'For those the director chooses', law: T22('101216.6'), course: REDCROSS },
    // Fulton's own training, for everyone who cares for children. It shows as due until it is completed.
    { k: 'activesup', label: 'Active Supervision Training', reg: 'Fulton Community School training', months: 0, fulton: true, note: 'With the CCLD video Supervising Children in Child Care Centers and the active supervision handouts', law: T22('101229') },
  ];
  // a chosen training belongs on a records page only once the director marks it for that person
  const needsItem = (doc, it) => !it.chosen || !!(((doc && doc.profile) || {}).needs || {})[it.k];
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
    { k: 'emergency', form: 'Emergency contact information', num: 'Fulton Community School', why: 'Lets us reach someone for you in an emergency', blank: '' },
    { k: 'mealwaiver', form: 'Meal Break Waiver', num: 'Fulton Community School', why: 'Lets you waive your 30-minute meal break on shifts of six hours or less, as California law allows', blank: '' },
    { k: 'quickbooks', form: 'QuickBooks Workforce invitation, completed', num: 'QuickBooks', why: 'Sets up your pay and tax forms, which stay in QuickBooks', blank: '', director: true },
    { k: 'tppack', form: 'Teacher Policies and Procedures acknowledgment', num: 'Fulton Community School', why: 'Confirms you have read how we work', blank: '', ack: true },
  ];
  // the director's own marks, never an upload
  const DIRECTOR_PAPERS = ['quickbooks', 'idseen'];
  const CHECKLIST = [
    'Paperwork uploaded and clearances received', 'Immunization records or exemptions uploaded', 'Welcome and philosophy read', 'Who\'s who read', 'TREE How To guides read',
    'Mandated reporter certificate uploaded', 'Licensing at Fulton Community School pieces finished', 'Licensing and safety review with you', 'First weeks check-ins with their go-to person',
    'Educator Reflection and Growth Plan started', 'Starting-point conversation, scheduled two months from the start date'];
  const DRILL_TYPES = ['Fire', 'Earthquake', 'Lockdown', 'Evacuation', 'Shelter in place', 'Other'];
  const REMIND_TYPES = { expiry: 'Certificates and trainings before they expire', flu: 'The yearly flu shot', hsa: 'Healthy Schools Act training each year', semester: 'Proof of enrollment each semester, below twelve units', drill: 'A drill when three months pass without one' };

  const pidOf = name => nameKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const pPath = name => `staff/people/${pidOf(name)}.json`;
  const SCHOOL = 'staff/school.json', DRILLS = 'staff/drills.json', SENT = 'staff/sent.json';

  /* ---------- reading and saving ---------- */
  const get = p => { const r = S.files.get(p); return r ? r.doc : null; };
  function put(p, doc) { const r = S.files.get(p); S.files.set(p, { doc, sha: r && r.sha, local: true }); soon(p); return doc; }
  // a Markdown piece is kept as its own text
  function putText(p, text) { const r = S.files.get(p); S.files.set(p, { text, sha: r && r.sha, local: true }); soon(p); return text; }
  function soon(p) { clearTimeout(S.timers.get(p)); const t = setTimeout(() => { S.timers.delete(p); flush(p).catch(e => log('Educator record not saved', p, e.message)); }, 1200); if (t.unref) t.unref(); S.timers.set(p, t); }
  function flush(p) {
    const prev = S.saving.get(p) || Promise.resolve();
    const job = prev.then(async () => {
      const r = S.files.get(p); if (!r || !r.local) return true;
      const doc = r.doc !== undefined ? r.doc : r.text, content = Buffer.from(r.doc !== undefined ? JSON.stringify(doc, null, 1) + '\n' : String(doc), 'utf8').toString('base64');
      for (let k = 0; k < 4; k++) {
        if (k) await new Promise(ok => setTimeout(ok, 1500 * k));
        const res = await gh('PUT', `/repos/${repo}/contents/${p}`, { message: 'Update ' + p.replace(/^staff\//, 'educator records ').replace(/\.json$/, ''), content, branch: store.branch, ...(r.sha ? { sha: r.sha } : {}) });
        if (res.status === 200 || res.status === 201) { r.sha = res.json.content.sha; if ((r.doc !== undefined ? r.doc : r.text) === doc) r.local = false; return true; }
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
      // when the hourly allowance is spent, the list comes through GraphQL, which has an allowance of its own
      let listed = null;
      if ((tree.status === 403 || tree.status === 429) && o.gqlList) { listed = await o.gqlList(); log('Educator records listed through GraphQL'); }
      else if (tree.status !== 200 && tree.status !== 409) throw new Error('GitHub answered ' + tree.status + ' when listing educator records');
      // the records hold the people, the handbook and the school's settings as JSON, and the PD library's pieces as
      // Markdown files, one piece each, so a new piece is added as a file with no change to TREE
      const all = (listed || (tree.json && tree.json.tree) || []).filter(f => f.type === 'blob');
      // the Family Handbook's editions are read here too, beside the Teacher Policies and Procedures
      const want = all.filter(f => /^staff\/[a-z0-9/_.-]+\.(json|md)$/i.test(f.path) || /^family\/handbook\/[a-z0-9/_.-]+\.json$/i.test(f.path));
      // the pictures in the policies are read only when someone opens them
      for (const f of all) if (/^(staff\/policies|family\/handbook|staff\/library\/images)\/[a-z0-9/_.-]+\.(png|jpe?g|gif|webp)$/i.test(f.path)) { if (S.imgs.get(f.path) !== f.sha) S.imgCache.delete(f.path); S.imgs.set(f.path, f.sha); }
      const seen = new Set(want.map(f => f.path));
      for (const p of [...S.files.keys()]) if (/\.md$/.test(p) && !seen.has(p)) S.files.delete(p);
      // a file already read at this version is kept as it is, and the rest are read six at a time
      const todo = want.filter(f => { const cur = S.files.get(f.path); return !(cur && (cur.local || cur.sha === f.sha)); });
      const readOne = async f => {
        const b = await gh('GET', `/repos/${repo}/git/blobs/${f.sha}`); if (b.status !== 200) throw new Error('GitHub answered ' + b.status + ' when reading ' + f.path);
        const cur = S.files.get(f.path); if (cur && cur.local) return;
        const text = Buffer.from(b.json.content, 'base64').toString('utf8');
        if (/\.md$/.test(f.path)) { S.files.set(f.path, { text, sha: f.sha }); return; }
        try { S.files.set(f.path, { doc: JSON.parse(text), sha: f.sha }); } catch (e) { log('Skipped unreadable educator record', f.path); }
      };
      // the files are read through GraphQL, ninety to a request, so a start spends little of the hourly allowance. A
      // file GraphQL cannot give in full is read on its own.
      const put1 = (f, text) => { const cur = S.files.get(f.path); if (cur && cur.local) return; if (/\.md$/.test(f.path)) { S.files.set(f.path, { text, sha: f.sha }); return; } try { S.files.set(f.path, { doc: JSON.parse(text), sha: f.sha }); } catch (e) { log('Skipped unreadable educator record', f.path); } };
      let rest = todo;
      if (o.gqlTexts && todo.length > 6) { try { const tx = await o.gqlTexts(todo.map(f => f.sha)); rest = []; for (const f of todo) { const t = tx.get(f.sha); if (typeof t === 'string') put1(f, t); else rest.push(f); } } catch (e) { log('Educator records could not be read through GraphQL', e.message); } }
      // a one-time list already run, or a page's history, too large for GraphQL waits for the next start when GitHub
      // cannot give it now, so the educator records still load
      const later = f => /^staff\/(once|pd\/history)\//.test(f.path);
      const readOr = async f => { try { await readOne(f); } catch (e) { if (!later(f)) throw e; log('Left for the next start', f.path, e.message); } };
      for (let i = 0; i < rest.length; i += 6) await Promise.all(rest.slice(i, i + 6).map(readOr));
      seed(); pieceCache = null; G.invalidate(); S.ready = true;
      try { await G.applySeed(saveAccounts, accountFor, setSetting); } catch (e) { log('Educator settings could not be applied', e.message); }
      // the two starting Presenting entries, made once
      try { PR.seed(); } catch (e) { log('Presenting entries could not be started', e.message); }
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
  // a link the director has confirmed no longer says Link to check, and shows the day she confirmed it
  const itemsChecked = () => { const ok = school().linksOk || {}; const fix = l => l && l.check && ok[l.url] ? Object.assign({}, l, { check: false, confirmed: ok[l.url].on }) : l; return ITEMS.map(it => Object.assign({}, it, it.law ? { law: fix(it.law) } : {}, it.course ? { course: fix(it.course) } : {})); };
  const opened = () => Object.assign({ records: false, pd: false, handbook: false, newed: false, growth: false, family: false }, school().open || {});

  /* ---------- the New Educator sequence and the welcome letter ---------- */
  const NEWED_READY = 'staff/newed/ready.json';
  function newedParts() {
    return [...S.files.keys()].filter(p => /^staff\/newed\/[a-z0-9-]+\.md$/.test(p)).sort().map(p => {
      let text = (S.files.get(p) || {}).text || ''; const meta = {}; const m = text.match(/^\s*<!--([\s\S]*?)-->/);
      if (m) { for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i); if (kv) meta[kv[1].toLowerCase()] = kv[2]; } text = text.slice(m[0].length); }
      const t = text.match(/^#\s+(.+)$/m); if (!t) return null;
      return { slug: p.slice(12, -3), title: t[1].trim(), body: text.slice(t.index + t[0].length).trim(), order: Number(meta.order) || 0, audience: meta.audience === 'experienced' ? 'experienced' : 'all',
        place: meta.place === 'pdlibrary' ? 'pdlibrary' : 'newed', draft: /^draft$/i.test(meta.status || ''), source: meta.source || '' };
    }).filter(Boolean).sort((a, b) => a.order - b.order);
  }
  const newedReady = slug => !!(((get(NEWED_READY) || {}).parts || {})[slug]);
  const newedFor = (me, experienced) => { const dir = isDirector(me);
    return newedParts().filter(g => dir || ((!g.draft || newedReady(g.slug)) && (g.audience === 'all' || experienced))).map(g => { const o = Object.assign({}, g, { waiting: g.draft && !newedReady(g.slug) }); if (!dir) { delete o.source; delete o.draft; delete o.waiting; } return o; }); };
  // the First weeks path's order is the parts' own order, so changing it rewrites the order line in each part's opening note
  function newedOrder(slugs, me) {
    slugs.forEach((slug, i) => { const p = 'staff/newed/' + slug + '.md'; const r = S.files.get(p); if (!r) return; const t = String(r.text || ''); const m = t.match(/^\s*<!--([\s\S]*?)-->/);
      const next = !m ? '<!--\norder: ' + (i + 1) + '\n-->\n' + t : /^[ \t]*order[ \t]*:/mi.test(m[1]) ? m[0].replace(/^([ \t]*order[ \t]*:).*$/mi, '$1 ' + (i + 1)) + t.slice(m[0].length) : m[0].replace(/-->$/, 'order: ' + (i + 1) + '\n-->') + t.slice(m[0].length);
      if (next !== t) putText(p, next); });
    log('New Educator order changed by', me);
  }
  // a new educator with an onboarding path of their own reads its parts of the first weeks in that path's order
  const newedOwn = (list, name) => { const p = PA.onboardingOf(name); if (p.id === PA.FIRST) return list; const at = new Map(p.steps.filter(s => s.kind === 'newed').map((s, i) => [s.slug, i]));
    return [...list.filter(g => g.place !== 'newed'), ...list.filter(g => g.place === 'newed' && at.has(g.slug)).sort((a, b) => at.get(a.slug) - at.get(b.slug))]; };

  /* ---------- Help inside TREE ---------- */
  // short how-to answers in the records, staff/help.json, each for the roles that can do it. Educators never receive a
  // director-only answer, and the kitchen receives the Kitchen and harvest answers. Families never reach this.
  const HELP = 'staff/help.json', HELP_READY = 'staff/helpready.json';
  const helpRoles = me => isDirector(me) ? null : isKitchen(me) ? ['kitchen'] : isNewHire(me) ? ['newhire'] : isOffice(me) ? ['office', 'educator'] : ['educator'];
  const helpFor = me => { const h = get(HELP) || {}; const on = !!(get(HELP_READY) || {}).on; const roles = helpRoles(me);
    if (roles && !on) return { list: [], ready: false };
    const list = (h.list || []).filter(x => x && x.id && x.q && (!roles || (x.roles || []).some(r => roles.includes(r)))).map(x => ({ id: x.id, q: x.q, a: (x.a || []).slice(0, 8), go: x.go || '', label: x.label || '', words: x.words || '', quick: !!x.quick, roles: roles ? undefined : x.roles }));
    return roles ? { list, ready: true } : { list, ready: on, waiting: !on && list.length > 0, source: h.source || '' }; };

  /* ---------- pieces for the Family page ---------- */
  // one Markdown file each in staff/familypieces, read through the signed-in server. A draft shows only to the director, with
  // its source note, until she marks it ready, and then reaches families on the Family page. The TK and kindergarten guide
  // (audience tk) reaches only families of children going to TK or kindergarten next year, beside the transition summary.
  const FP_READY = 'staff/familypieces/ready.json';
  function familyPieces() {
    return [...S.files.keys()].filter(p => /^staff\/familypieces\/[a-z0-9-]+\.md$/.test(p)).sort().map(p => {
      let text = (S.files.get(p) || {}).text || ''; const meta = {}; const m = text.match(/^\s*<!--([\s\S]*?)-->/);
      if (m) { for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i); if (kv) meta[kv[1].toLowerCase()] = kv[2]; } text = text.slice(m[0].length); }
      const t = text.match(/^#\s+(.+)$/m); if (!t) return null;
      return { slug: p.slice(19, -3), title: t[1].trim(), body: text.slice(t.index + t[0].length).trim(), order: Number(meta.order) || 0, audience: meta.audience === 'tk' ? 'tk' : 'all', draft: /^draft$/i.test(meta.status || ''), source: meta.source || '' };
    }).filter(Boolean).sort((a, b) => a.order - b.order);
  }
  const fpReady = slug => !!(((get(FP_READY) || {}).pieces || {})[slug]);
  const familyPiecesForFamily = () => familyPieces().filter(g => !g.draft || fpReady(g.slug)).map(g => ({ slug: g.slug, title: g.title, body: g.body, audience: g.audience }));

  /* ---------- the materials guides ---------- */
  const GUIDE_READY = 'staff/guides/ready.json';
  function guides() {
    return [...S.files.keys()].filter(p => /^staff\/guides\/[a-z0-9-]+\.md$/.test(p)).sort().map(p => {
      let text = (S.files.get(p) || {}).text || ''; const meta = {}; const m = text.match(/^\s*<!--([\s\S]*?)-->/);
      if (m) { for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i); if (kv) meta[kv[1].toLowerCase()] = kv[2]; } text = text.slice(m[0].length); }
      const t = text.match(/^#\s+(.+)$/m); if (!t) return null;
      return { slug: p.slice(13, -3), title: t[1].trim(), body: text.slice(t.index + t[0].length).trim(), group: meta.group || '', area: meta.area || '', draft: /^draft$/i.test(meta.status || ''), source: meta.source || '' };
    }).filter(Boolean);
  }
  const guideReady = slug => !!(((get(GUIDE_READY) || {}).guides || {})[slug]);
  const guidesFor = me => { const dir = isDirector(me);
    return guides().filter(g => dir || !g.draft || guideReady(g.slug)).map(g => { const o = Object.assign({}, g, { waiting: g.draft && !guideReady(g.slug) }); if (!dir) { delete o.source; delete o.draft; delete o.waiting; } return o; }); };

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
  // a piece marked draft in its opening note, such as a new TREE How To guide, waits for the director to mark it ready
  const PIECE_READY = 'staff/pd/pieceready.json';
  const pieceReady = id => !!(((get(PIECE_READY) || {}).pieces || {})[id]);
  const piecesFor = me => { const dir = isDirector(me), all = pieces(), out = {};
    for (const [k, list] of Object.entries(all)) out[k] = list.filter(x => dir || !x.draft || pieceReady(x.id)).map(x => dir ? Object.assign({}, x, { waiting: !!x.draft && !pieceReady(x.id) }) : x);
    return out; };
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
      // the general CDSS regulations page is a second, smaller link beside the document a piece cites
      if (ls.length) { for (const x of ls) links.push(Object.assign({ text: x[1], url: x[2] }, /^All CDSS child care regulations$/.test(x[1]) ? { minor: true } : {})); }
      const mm = l.match(/About (\d+) minutes/i); if (mm) minutes = +mm[1];
      if (!ls.length && !mm && !source) source = l;
    }
    const sections = (cut >= 0 ? rest.slice(cut) : '').split(/^###\s+/m).filter(s => s.trim()).map(s => { const i = s.indexOf('\n'); return { heading: s.slice(0, i).trim(), body: s.slice(i + 1).trim() }; });
    return { id: dir + '/' + file.replace(/\.md$/, ''), dir, title: t[1].trim(), source, links, checked: /^\d{4}-\d{2}-\d{2}$/.test(meta.linkschecked || '') ? meta.linkschecked : '', minutes: minutes || 5, list: meta.list || '', week: Number(meta.week) || 0,
      handbook: String(meta.handbook || '').split(',').map(s => s.trim()).filter(Boolean), draft: meta.status === 'draft', sections };
  }

  /* ---------- the director's Edit button on a module, a How To guide and the PD library letter ---------- */
  // the page's own file is rewritten section by section, its opening note and its headings kept as they are, and each
  // save keeps the wording before it in staff/pd/history, so any earlier version can be restored
  const W = require('./writing.js');
  // every page of the school's own writing kept in the records as Markdown: PD modules, How To guides, the licensing
  // pieces, the New Educator pieces and letter, the materials guides, the Family page pieces, the wording the director
  // edits in place and the libraries for plans, such as recipes and the song book
  const editable = p => /^staff\/(pd\/(modules|howto|licensing|printables)|newed|guides|familypieces|wording)\/[a-z0-9-]+\.md$/.test(p) || /^staff\/library\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(p);
  // the school's own wording the director edits in place, one page for each piece, such as the Family Questionnaire
  const WD = require('./wording.js');
  function wordingDoc(id) { const r = S.files.get('staff/wording/' + id + '.md'); return WD.parse(r ? r.text : ''); }
  function wordingAll() { const out = {}; for (const [p, r] of S.files) { const m = p.match(/^staff\/wording\/([a-z0-9-]+)\.md$/); if (m && typeof r.text === 'string') out[m[1]] = WD.parse(r.text); } return out; }
  const PAGE_HIST = p => 'staff/pd/history/' + p.slice(6).replace(/\.md$/, '').replace(/\//g, '--') + '.json';
  function pageParts(text) {
    text = String(text || '').replace(/\r/g, ''); const m = text.match(/^\s*<!--[\s\S]*?-->\n?/); const meta = m ? m[0] : ''; let rest = text.slice(meta.length);
    const t = rest.match(/^(#{1,3})\s+(.+)$/m); if (!t) return null;
    const L = t[1].length, pre = rest.slice(0, t.index); rest = rest.slice(t.index + t[0].length);
    const split = rest.split(new RegExp('^#{' + (L + 1) + '}(?!#)\\s+', 'm'));
    const lead = split.shift().trim();
    return { meta, pre, level: L, title: t[2].trim(), lead, parts: split.map(s => { const i = s.indexOf('\n'); return i < 0 ? { heading: s.trim(), body: '' } : { heading: s.slice(0, i).trim(), body: s.slice(i + 1).trim() }; }) };
  }
  const pageText = pp => pp.meta + pp.pre + '#'.repeat(pp.level) + ' ' + pp.title + '\n\n' + (pp.lead ? pp.lead + '\n\n' : '') +
    pp.parts.map(x => '#'.repeat(pp.level + 1) + ' ' + x.heading + '\n\n' + (x.body ? x.body + '\n' : '')).join('\n');
  const pageKind = p => p === 'staff/newed/welcome.md' ? 'letter' : p.includes('/howto/') ? 'howto' : p.startsWith('staff/wording/') ? 'wording' : p.includes('/licensing/') ? 'licensing' :
    p.startsWith('staff/newed/') ? 'newed' : p.startsWith('staff/guides/') ? 'guide' : p.startsWith('staff/familypieces/') ? 'familypiece' : p.startsWith('staff/library/') ? 'library' : p.startsWith('staff/pd/printables/') ? 'printables' : 'module';
  function pageOut(p) {
    const r = S.files.get(p); const pp = r && pageParts(r.text); if (!pp) return null; const h = get(PAGE_HIST(p)) || {};
    return { path: p, stamp: stampOf(r.text), kind: pageKind(p), title: pp.title, lead: pp.lead, parts: pp.parts, note: h.note || '', updatedAt: h.updatedAt || 0, updatedBy: h.updatedBy || '', history: h.history || [] };
  }
  // what the director opened, so a save or a restore never lands on a page that changed since
  const stampOf = text => require('crypto').createHash('sha1').update(String(text || '')).digest('hex').slice(0, 16);
  function savePage(me, p, b, restoring) {
    const r = S.files.get(p); const pp = r && pageParts(r.text); if (!pp) return { error: 'That page could not be read.' };
    if (b.stamp && b.stamp !== stampOf(r.text)) return { error: 'This page changed since you opened it. Close it and open it again.' };
    const note = String(b.note || '').trim().slice(0, 300); if (!note) return { error: 'Write a short note about this change.' };
    let next;
    if (restoring) next = restoring;
    else {
      const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 160); if (!title) return { error: 'Give the page a title.' };
      const given = Array.isArray(b.parts) ? b.parts : [];
      const np = Object.assign({}, pp, { title, lead: String(b.lead == null ? pp.lead : b.lead).replace(/\r/g, '').trim().slice(0, 20000),
        parts: pp.parts.map((x, i) => ({ heading: x.heading, body: given[i] && given[i].body != null ? String(given[i].body).replace(/\r/g, '').trim().slice(0, 60000) : x.body })) });
      next = pageText(np);
      // a sentence that breaks a writing rule gets a gentle note, and she can keep it as written
      const found = b.keep ? [] : W.check(r.text, next); if (found.length) return { error: 'Some new wording may not follow the writing rules.', findings: found, gentle: true };
    }
    next = LIB.guard(p, next);
    if (next.trim() === String(r.text || '').trim() || (!restoring && next === pageText(pp))) return { ok: true, same: true, page: pageOut(p) };
    const h = Object.assign({ path: p, history: [] }, get(PAGE_HIST(p)) || {});
    h.history = [...(h.history || []), { title: pp.title, text: r.text, at: h.updatedAt || 0, by: h.updatedBy || '', note: h.note || '' }].slice(-100);
    Object.assign(h, { note, updatedAt: Date.now(), updatedBy: me });
    put(PAGE_HIST(p), h); putText(p, next); pieceCache = null; G.invalidate(); log('PD library page changed', p, 'by', me);
    return { ok: true, page: pageOut(p) };
  }

  /* The same Edit, history and restore for school writing kept inside a record instead of a page: a Help answer, a
     Presenting entry and the Garden's own words. Each names the words the director can change, and the rest of the
     record stays as it is. Every save keeps the words before it, with who changed them and when, and any earlier
     version can be restored. */
  const RECORD_EDIT = [
    { re: /^staff\/help\.json$/, list: 'list', name: 'this Help answer', title: x => x.q, fields: [['q', 'Question'], ['a', 'Steps, one on each line', 'lines']] },
    { re: /^staff\/presenting\/pr[a-z0-9]+\.json$/, name: 'this Presenting entry', title: d => d.title, fields: [['title', 'Title'], ['subtitle', 'Subtitle'], ['question', 'Question'], ['audience', 'Audience'], ['format', 'Format'], ['place', 'Place'], ['dateNote', 'About the date']] },
    { re: /^staff\/garden\/setup\.json$/, name: 'the Garden\'s own words', title: () => 'The Garden', fields: [['agreements.guiding', 'Our guiding agreements, one on each line', 'lines'], ['agreements.children.title', 'The children\'s agreements, title'], ['agreements.children.items', 'The children\'s agreements, one on each line', 'lines'],
      ['agreements.families.title', 'The families\' agreements, title'], ['agreements.families.intro', 'The families\' agreements, opening line'], ['agreements.families.items', 'The families\' agreements, one on each line', 'lines'], ['nochemicals', 'No chemicals'], ['handwash.text', 'Handwashing']] }
  ];
  const recordSpec = p => RECORD_EDIT.find(x => x.re.test(p)) || null;
  const REC_HIST = (p, item) => 'staff/pd/history/record--' + p.slice(6).replace(/\.json$/, '').replace(/\//g, '--') + (item ? '--' + String(item).replace(/[^a-z0-9-]/gi, '') : '') + '.json';
  const at = (o, k) => k.split('.').reduce((t, x) => (t && typeof t === 'object' ? t[x] : undefined), o);
  function setPath(o, k, v) { const ks = k.split('.'); let t = o; for (const x of ks.slice(0, -1)) { if (!t[x] || typeof t[x] !== 'object') t[x] = {}; t = t[x]; } t[ks[ks.length - 1]] = v; }
  function recordTarget(p, item) { const sp = recordSpec(p), d = get(p); if (!sp || !d) return null; const x = sp.list ? (d[sp.list] || []).find(y => y && y.id === item) : d; return x ? { sp, d, x } : null; }
  const recValues = (sp, x) => Object.fromEntries(sp.fields.map(([k, , t]) => { const v = at(x, k); return [k, t === 'lines' ? (Array.isArray(v) ? v.map(String) : []) : String(v == null ? '' : v)]; }));
  const recText = (sp, vals) => sp.fields.map(([k, label, t]) => label + '\n' + (t === 'lines' ? vals[k].join('\n') : vals[k])).join('\n\n');
  function recordOut(p, item) {
    const T = recordTarget(p, item); if (!T) return null; const vals = recValues(T.sp, T.x); const h = get(REC_HIST(p, item)) || {};
    return { path: p, item: item || '', stamp: stampOf(JSON.stringify(vals)), kind: 'record', name: T.sp.name, title: String(T.sp.title(T.x) || ''), fixedTitle: true,
      parts: T.sp.fields.map(([k, label, t]) => ({ heading: label, body: t === 'lines' ? vals[k].join('\n') : vals[k] })), note: h.note || '', updatedAt: h.updatedAt || 0, updatedBy: h.updatedBy || '',
      history: (h.history || []).map(e => ({ at: e.at, by: e.by, note: e.note, text: e.text })) };
  }
  function saveRecord(me, p, item, b, restoring) {
    const T = recordTarget(p, item); if (!T) return { error: 'That could not be read.' };
    const was = recValues(T.sp, T.x);
    if (b.stamp && b.stamp !== stampOf(JSON.stringify(was))) return { error: 'This changed since you opened it. Close it and open it again.' };
    const note = String(b.note || '').trim().slice(0, 300); if (!note) return { error: 'Write a short note about this change.' };
    let vals;
    if (restoring) vals = restoring;
    else {
      const given = Array.isArray(b.parts) ? b.parts : [];
      vals = Object.fromEntries(T.sp.fields.map(([k, , t], i) => { const g = given[i] && given[i].body != null ? String(given[i].body).replace(/\r/g, '') : null; if (g == null) return [k, was[k]];
        return [k, t === 'lines' ? g.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 60).map(l => l.slice(0, 2000)) : g.trim().slice(0, 20000)]; }));
      const found = b.keep ? [] : W.check(recText(T.sp, was), recText(T.sp, vals)); if (found.length) return { error: 'Some new wording may not follow the writing rules.', findings: found, gentle: true };
    }
    if (JSON.stringify(vals) === JSON.stringify(was)) return { ok: true, same: true, page: recordOut(p, item) };
    const hp = REC_HIST(p, item); const h = Object.assign({ path: p, item: item || '', history: [] }, get(hp) || {});
    h.history = [...(h.history || []), { values: was, text: recText(T.sp, was), at: h.updatedAt || 0, by: h.updatedBy || '', note: h.note || '' }].slice(-100);
    Object.assign(h, { note, updatedAt: Date.now(), updatedBy: me }); put(hp, h);
    const d = JSON.parse(JSON.stringify(T.d)); const x = T.sp.list ? d[T.sp.list].find(y => y && y.id === item) : d;
    for (const [k] of T.sp.fields) setPath(x, k, vals[k]);
    if (!T.sp.list) { d.updatedAt = Date.now(); d.updatedBy = me; }
    put(p, d); pieceCache = null; log('School writing changed', p, item || '', 'by', me);
    return { ok: true, page: recordOut(p, item) };
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
    // what TREE opens for this sign-in, asked again by a page that signed in while the records were still loading
    if (P === 'info') { json(req, res, 200, { staff: bootInfo(me) }); return; }
    // a kitchen sign-in reaches its own records page and nothing else here
    // the kitchen also adds and edits recipes in the recipe library
    const kitRecipe = ['page', 'page/save', 'page/restore'].includes(P) && !body.module && /^staff\/library\/recipes\//.test(String(body.path || ''));
    if (isKitchen(me) && !(['boot', 'person', 'save', 'upload', 'file', 'notices', 'notices/ack', 'notices/lang', 'notices/emergency'].includes(P) && nameKey(who) === nameKey(me)) && !['garden', 'garden/harvest', 'help', 'library', 'library/add', 'library/ready', 'library/photo', 'library/img', 'library/picture'].includes(P) && !kitRecipe) return deny('A kitchen sign-in reaches its own records page.');
    if (P === 'library/picture' && isNewHire(me)) return deny('A new educator reads the libraries.');
    if (P === 'library' || P.startsWith('library/')) { await LIB.handle(P, body, me, req, res, { json, err, send }); return; }
    if (P === 'playgarden' || P.startsWith('playgarden/')) { await PGA.handle(P, body, me, dir, req, res, { json, err }); return; }
    if (P.startsWith('g/')) { await G.handle(P.slice(2), body, me, req, res, { json, err }); return; }
    // PD paths and assignments, in paths.js, for every sign-in with records of its own. The kitchen never reaches them.
    if (P === 'paths' || P.startsWith('paths/')) { if (!hasOwn(me)) return deny(); await PA.handle(P, body, me, req, res, { json, err }); return; }
    // Presenting, in presenting.js, decides itself who receives each entry
    if (P.startsWith('pres/')) { if (!hasOwn(me)) return deny(); await PR.handle(P.slice(5), body, me, req, res, { json, err }); return; }
    if (P === 'moment/file') {
      const fid = String(body.fid || ''); if (!/^staff-[a-f0-9]+\.[a-z]+$/.test(fid) || !G.momentFile(me, fid)) { err(req, res, 404, 'That photo is not here.'); return; }
      try { const buf = await readOriginal(fid); send(req, res, 200, { 'Content-Type': /\.png$/.test(fid) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, no-store' }, buf); } catch (e) { err(req, res, 502, 'The photo could not be read. ' + e.message); }
      return;
    }

    if (P === 'boot') {
      const mine = person(me); const o = opened();
      json(req, res, 200, { me: { name: me, director: dir, newHire: isNewHire(me), newEd: inNewEd(me), room: roomOf(me), role: whoRole(me), profile: mine.profile || {}, takesPart: G.takesPart(me), kitchen: isKitchen(me), goTo: goToOf(me) },
        open: o, can: canFor(me), goTo: goToName(), activeSupervision: school().activeSupervision || null,
        defs: { items: itemsChecked(), papers: PAPERS, checklist: CHECKLIST, drills: DRILL_TYPES, remind: REMIND_TYPES },
        school: { welcome: school().welcome || '', philosophy: school().philosophy || '', formLinks: school().formLinks || {}, remindDays: school().remindDays || 30, remind: school().remind || {}, goTo: goToName(), ...(dir ? { teamMeetings: school().teamMeetings || {}, quietMonths: school().quietMonths || [] } : {}) },
        whosWho: whosWho(), lens: lensNow(), paired: pairedWith(me), today: today(), people: dir ? staffNames().sort() : [] });
      return;
    }
    // a piece added to the records is read without restarting TREE
    // the director confirms a training or regulation link once she has opened it and it is right
    if (P === 'links/ok') { if (!dir) return deny(); const url = String(body.url || ''); const known = ITEMS.some(it => [it.law, it.course].some(l => l && l.url === url)); if (!known) { err(req, res, 400, 'That link is not one TREE keeps.'); return; }
      const sc = school(); put(SCHOOL, Object.assign({}, sc, { linksOk: Object.assign({}, sc.linksOk || {}, { [url]: { on: today(), by: me } }) })); json(req, res, 200, { items: itemsChecked() }); return; }
    if (P === 'reload') { if (!dir) return deny(); S.loading = null; try { await load(); } catch (e) { err(req, res, 502, e.message); return; } json(req, res, 200, { ok: true, pieces: (pieces().licensing || []).length + (pieces().howto || []).length }); return; }
    if (P === 'pd') { if (!allowed(me, 'pd') && !allowed(me, 'newed')) return deny(); json(req, res, 200, piecesFor(me)); return; }
    if (P === 'pd/ready') { if (!dir) return deny(); const id = String(body.id || ''); if (!Object.values(pieces()).some(l => l.some(x => x.id === id))) { err(req, res, 404, 'That piece is not here.'); return; }
      const cur = get(PIECE_READY) || { pieces: {} }; put(PIECE_READY, Object.assign({}, cur, { pieces: Object.assign({}, cur.pieces, { [id]: !!body.on }) })); json(req, res, 200, piecesFor(me)); return; }
    // the school's own wording, read again after the director edits a piece of it
    if (P === 'wording') { if (isKitchen(me)) return deny(); json(req, res, 200, { docs: wordingAll() }); return; }
    if (P === 'page' || P === 'page/save' || P === 'page/restore') {
      // the kitchen edits a recipe and nothing else, so a module named alongside a recipe's path is refused
      if (!dir && !(isKitchen(me) && !body.module && /^staff\/library\/recipes\//.test(String(body.path || '')))) return deny('The director edits this page.');
      const p = body.module ? ([...S.files.keys()].filter(k => k.startsWith('staff/pd/modules/') && k.slice(17).replace(/^\d+-/, '') === String(body.module) + '.md').sort().pop() || '') : String(body.path || '');
      if (recordSpec(p)) {
        const item = String(body.item || ''); if (!recordTarget(p, item)) { err(req, res, 404, 'That is not here.'); return; }
        if (P === 'page') { json(req, res, 200, recordOut(p, item)); return; }
        let r;
        if (P === 'page/restore') { const h = ((get(REC_HIST(p, item)) || {}).history || [])[+body.index]; if (!h || !h.values) { err(req, res, 404, 'That version is not here.'); return; }
          r = saveRecord(me, p, item, { stamp: body.stamp, note: h.at ? `Restored the version of ${new Date(h.at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' })}` : 'Restored the version from before TREE' }, h.values); }
        else r = saveRecord(me, p, item, body);
        if (r.error && !r.findings) { err(req, res, 400, r.error); return; } json(req, res, 200, r); return;
      }
      if (!editable(p) || !S.files.get(p)) { err(req, res, 404, 'That page is not here.'); return; }
      if (P === 'page') { json(req, res, 200, pageOut(p)); return; }
      let r;
      if (P === 'page/restore') { const h = ((get(PAGE_HIST(p)) || {}).history || [])[+body.index]; if (!h) { err(req, res, 404, 'That version is not here.'); return; }
        r = savePage(me, p, { stamp: body.stamp, note: h.at ? `Restored the version of ${new Date(h.at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' })}` : 'Restored the version from before TREE' }, h.text); }
      else r = savePage(me, p, body);
      if (r.error && !r.findings) { err(req, res, 400, r.error); return; } json(req, res, 200, r); return;
    }
    if (P === 'handbook') {
      if (!allowed(me, 'handbook') && !allowed(me, 'newed')) return deny();
      const secs = [...S.files].filter(([p]) => p.startsWith('staff/handbook/')).map(([, r]) => r.doc).filter(Boolean).sort((a, b) => (a.order || 0) - (b.order || 0));
      json(req, res, 200, { sections: secs.filter(x => !x.removed || dir), doc: get('staff/handbook-doc.json') || {} }); return;
    }
    // the Teacher Policies and Procedures and the Family Handbook, each section kept with its earlier versions
    if (P.startsWith('policies/')) { await POL.handle(P, body, me, req, res, { json, err, send }); return; }
    if (P === 'garden' || P.startsWith('garden/')) { await GD.handle(P, body, me, req, res, { json, err }); return; }
    // the site map, for every signed-in page that shows it, a new educator's New Educator section included
    if (P === 'sitemap') { json(req, res, 200, { map: GD.siteMap(o.spaces ? o.spaces() : [], isDirector(me)) }); return; }
    /* ---------- walk safety, for staff once the director marks it ready ---------- */
    // the New Educator first-weeks sequence and the welcome letter that opens the PD library, one Markdown file each in
    // staff/newed. A draft shows only to the director until she marks it ready. A part for experienced educators reaches
    // only a new educator the director marked experienced.
    if (P === 'help' || P === 'help/ready') {
      if (P === 'help/ready') { if (!dir) return deny('The director marks Help ready.'); put(HELP_READY, { id: 'helpready', on: !!body.on, at: today(), by: me }); }
      json(req, res, 200, helpFor(me)); return;
    }
    if (P === 'familypieces' || P === 'familypieces/ready') {
      if (!dir) return deny('Only the director reviews the Family page pieces.');
      if (P === 'familypieces/ready') { const g = familyPieces().find(x => x.slug === String(body.slug || '')); if (!g) return err(req, res, 404, 'That piece is not here.');
        const all = Object.assign({ pieces: {} }, get(FP_READY) || {}); all.pieces = Object.assign({}, all.pieces); if (body.on) all.pieces[g.slug] = { on: today(), by: me }; else delete all.pieces[g.slug]; put(FP_READY, all); }
      json(req, res, 200, { list: familyPieces().map(g => Object.assign({}, g, { waiting: g.draft && !fpReady(g.slug) })) }); return;
    }
    if (P === 'newed' || P === 'newed/ready' || P === 'newed/experienced') {
      if (P === 'newed/experienced') {
        if (!dir) return deny('The director marks a new educator experienced.'); if (!accountFor(who)) return err(req, res, 404, 'That educator is not here.');
        const doc = person(who); doc.profile = Object.assign({}, doc.profile, { experienced: !!body.on }); put(pPath(who), doc);
      }
      if (P === 'newed/ready') {
        if (!dir) return deny('The director marks a part ready.'); const g = newedParts().find(x => x.slug === String(body.slug || '')); if (!g) return err(req, res, 404, 'That part is not here.');
        const all = Object.assign({ parts: {} }, get(NEWED_READY) || {}); all.parts = Object.assign({}, all.parts); if (body.on) all.parts[g.slug] = { on: today(), by: me }; else delete all.parts[g.slug];
        put(NEWED_READY, all);
      }
      const exp = !!profileOf(dir ? who : me).experienced;
      json(req, res, 200, { experienced: exp, goTo: goToName() || '', list: newedOwn(newedFor(me, exp), dir ? who : me), onboarding: PA.onboardingOf(dir ? who : me).id }); return;
    }
    // the one-page materials guides, one Markdown file each in staff/guides. A guide written as a draft shows only to the
    // director, with its source note, until she marks it ready. Each one names the Materials library group and the
    // Classroom area it is linked from.
    if (P === 'guides' || P === 'guides/ready') {

      if (P === 'guides/ready') {
        if (!dir) return deny('The director marks a guide ready.'); const g = guides().find(x => x.slug === String(body.slug || '')); if (!g) return err(req, res, 404, 'That guide is not here.');
        const all = Object.assign({ guides: {} }, get(GUIDE_READY) || {}); all.guides = Object.assign({}, all.guides); if (body.on) all.guides[g.slug] = { on: today(), by: me }; else delete all.guides[g.slug];
        put(GUIDE_READY, all);
      }
      json(req, res, 200, { list: guidesFor(me) }); return;
    }
    if (P === 'walks' || P.startsWith('walks/')) {
      const w = walksDoc(); if (!w) { err(req, res, 404, 'Walk safety is not in the records yet.'); return; }
      if (!dir && !w.ready) return deny('Walk safety opens once the director marks it ready.');
      if (P === 'walks') { json(req, res, 200, walksOut(dir)); return; }
      if (!dir) return deny('Only the director changes walk safety.');
      if (P === 'walks/ready') { put(WALKS, Object.assign({}, w, { ready: !!body.on, readyAt: Date.now(), readyBy: me })); json(req, res, 200, walksOut(dir)); return; }
      if (P === 'walks/photos') {
        // a photo joins the children's card only after the face check on the device found no face and the director said so too
        const list = (Array.isArray(body.photos) ? body.photos : []).filter(x => x && /^[a-z0-9-]+\.(jpe?g|png)$/i.test(x.id || '') && x.noFace === true && x.checked === true).slice(0, 4).map(x => ({ id: x.id, obs: String(x.obs || '').slice(0, 40), at: Date.now(), by: me }));
        put(WALKS, Object.assign({}, w, { photos: list })); json(req, res, 200, walksOut(dir)); return;
      }
      err(req, res, 404, 'Not found'); return;
    }
    /* ---------- proposed sections for the Teacher Policies and Procedures and the Family Handbook draft ----------
       Each waits for the director, and nothing changes in either document until she accepts it. */
    if (P === 'proposals' || P.startsWith('proposals/')) {
      if (!dir) return deny('Only the director reads the proposals.');
      if (P === 'proposals') { json(req, res, 200, { list: proposals() }); return; }
      const pr = proposals().find(x => x.id === body.id); if (!pr) { err(req, res, 404, 'That proposal is not here.'); return; }
      const path = `staff/proposals/${pr.id}.json`;
      if (P === 'proposals/aside') { put(path, Object.assign({}, get(path), { status: body.back ? 'proposed' : 'aside', decidedAt: Date.now(), decidedBy: me })); json(req, res, 200, { list: proposals() }); return; }
      if (P === 'proposals/accept') {
        if (pr.status === 'accepted') { json(req, res, 200, { list: proposals() }); return; }
        // a rewrite replaces one passage in a section already there, saved as any edit is, with the earlier wording in
        // the section's history. The director may change the new wording first.
        /* a rewrite of a passage in a plan, the idea bank or a page of ours (doc "record"), such as a suggestion that would
           have children collect creatures. It replaces the passage in one field of the record, or in the page's words. */
        if (pr.kind === 'replace' && pr.doc === 'record') {
          const from = String(pr.from || ''), to = String(body.to != null ? body.to : pr.to || '').replace(/\r/g, '').trim(), rp = String(pr.path || '');
          if (!from || !to) { err(req, res, 400, 'The new wording is empty.'); return; }
          const swap = v => { const t = String(v == null ? '' : v); const i = t.indexOf(from); return i < 0 ? null : t.slice(0, i) + to + t.slice(i + from.length); };
          let done = false;
          if (/^staff\/(library|guides|garden)\/[a-z0-9/_.-]+\.md$/i.test(rp)) { const r = S.files.get(rp); const next = r && swap(r.text); if (next != null) { const h = Object.assign({ path: rp, history: [] }, get(PAGE_HIST(rp)) || {}); h.history = [...(h.history || []), { text: r.text, at: h.updatedAt || 0, by: h.updatedBy || '', note: h.note || '' }].slice(-100); Object.assign(h, { note: ('Accepted from a proposal, ' + pr.title).slice(0, 300), updatedAt: Date.now(), updatedBy: me }); put(PAGE_HIST(rp), h); putText(rp, next); pieceCache = null; done = true; } }
          else if (/^(plans|bins|threads|projects)\/[a-z0-9_-]+\.json$/i.test(rp) && RECS_EDIT) {
            const keys = String(pr.field || '').split('.').filter(Boolean);
            done = RECS_EDIT(rp, d => { const c = JSON.parse(JSON.stringify(d)); let o = c; for (const k of keys.slice(0, -1)) { o = o && o[k]; } const k = keys[keys.length - 1]; if (!o || !k) return d; const next = swap(o[k]); if (next == null) return d; o[k] = next; c.updatedAt = Date.now(); return c; });
          }
          if (!done) { err(req, res, 409, 'This passage has changed since the rewrite was drafted, so nothing was changed. Open the record to edit it.'); return; }
          put(path, Object.assign({}, get(path), { status: 'accepted', accepted: to, decidedAt: Date.now(), decidedBy: me }));
          log('Proposal accepted', pr.id, 'by', me); json(req, res, 200, { list: proposals() }); return;
        }
        if (pr.kind === 'replace') {
          const cur = pr.doc === 'family' ? POL.fhSection(String(pr.edition || ''), pr.section) : (() => { const e = POL.entries().find(x => x.id === pr.section); return e ? POL.tpSection(e) : null; })();
          if (!cur || cur.removed) { err(req, res, 404, 'That section is not here any more.'); return; }
          const from = String(pr.from || ''), to = String(body.to != null ? body.to : pr.to || '').replace(/\r/g, '').trim();
          if (!from || !to) { err(req, res, 400, 'The new wording is empty.'); return; }
          const was = String(cur.body || ''); const at = was.indexOf(from);
          if (at < 0) { err(req, res, 409, 'This passage has changed since the rewrite was drafted, so nothing was changed. Open the section to edit it.'); return; }
          const note = ('Accepted from a proposal, ' + pr.title).slice(0, 300);
          const next = was.slice(0, at) + to + was.slice(at + from.length);
          const r = pr.doc === 'family' ? POL.saveFamily(me, { edition: pr.edition, id: pr.section, title: cur.title, body: next, note }) : POL.saveTeacher(me, { id: pr.section, title: cur.title, body: next, note });
          if (r.error) { err(req, res, 400, r.error); return; }
          put(path, Object.assign({}, get(path), { status: 'accepted', section: pr.section, accepted: to, decidedAt: Date.now(), decidedBy: me }));
          log('Proposal accepted', pr.id, 'by', me); json(req, res, 200, { list: proposals(), id: pr.section }); return;
        }
        const r = pr.doc === 'family' ? POL.saveFamily(me, { edition: pr.edition, part: pr.part, title: pr.title, body: pr.body, note: 'Accepted from a proposal' }) : POL.saveTeacher(me, { part: pr.part, title: pr.title, body: pr.body, note: 'Accepted from a proposal' });
        if (r.error) { err(req, res, 400, r.error); return; }
        put(path, Object.assign({}, get(path), { status: 'accepted', section: r.id, decidedAt: Date.now(), decidedBy: me }));
        log('Proposal accepted', pr.id, 'by', me); json(req, res, 200, { list: proposals(), id: r.id }); return;
      }
      err(req, res, 404, 'Not found'); return;
    }
    /* ---------- required notices, for staff once the director marks them ready ---------- */
    if (P.startsWith('notices')) {
      const sc = school(), ready = !!(sc.ready || {}).notices;
      if (!dir && !ready) return deny('Required notices open once the director marks them ready.');
      const noticesOf = n => { const d = person(n).notices || {}; return { acks: d.acks || {}, kyr: d.kyr || {}, lang: NOTICES.KYR_LANGS.includes(d.lang) ? d.lang : 'English', emergency: d.emergency || null }; };
      const saveNotices = (n, fn) => { const doc = person(n); const cur = noticesOf(n); const next = fn(Object.assign({}, doc.notices || {}, { acks: cur.acks, kyr: cur.kyr, lang: cur.lang })); doc.notices = next; doc.updatedAt = Date.now(); doc.updatedBy = me; put(pPath(n), doc); return noticesOf(n); };
      const employees = () => staffNames().filter(n => !isDirector(n) && !isFormerEducator(n)).sort();
      const target = String(body.name || me);
      if (P === 'notices') {
        const whom = canSee(me, target) ? target : me;
        const out = { defs: { posters: NOTICES.POSTERS, newhire: NOTICES.NEWHIRE, langs: NOTICES.KYR_LANGS, ways: NOTICES.KYR_WAYS, rules: NOTICES.KYR_RULES }, ready, name: whom, mine: noticesOf(whom), link: NOTICES.kyrLink(noticesOf(whom).lang) };
        if (dir) out.people = employees().map(n => { const x = noticesOf(n); return { name: n, lang: x.lang, link: NOTICES.kyrLink(x.lang), kyr: x.kyr, acks: x.acks, emergency: !!x.emergency }; });
        json(req, res, 200, out); return;
      }
      if (!canSee(me, target)) return deny('Only you and the director change your notices.');
      if (P === 'notices/ack') {
        if (nameKey(target) !== nameKey(me)) return deny('Each person acknowledges their own notices.');
        const it = NOTICES.NEWHIRE.find(x => x.id === body.id && x.how === 'ack'); if (!it) { err(req, res, 400, 'That notice is not on the list.'); return; }
        json(req, res, 200, saveNotices(me, d => Object.assign(d, { acks: Object.assign({}, d.acks, d.acks[it.id] ? {} : { [it.id]: { at: Date.now(), day: today() } }) }))); return;
      }
      if (P === 'notices/lang') {
        if (!NOTICES.KYR_LANGS.includes(body.lang)) { err(req, res, 400, 'Choose a language from the list.'); return; }
        json(req, res, 200, saveNotices(target, d => Object.assign(d, { lang: body.lang }))); return;
      }
      if (P === 'notices/emergency') {
        const c = body.contact && typeof body.contact === 'object' ? body.contact : null; const t = v => String(v || '').trim().slice(0, 120);
        const e = c && (t(c.name) || t(c.phone)) ? { name: t(c.name), phone: t(c.phone), relation: t(c.relation), notify: ['yes', 'no'].includes(c.notify) ? c.notify : '', at: Date.now(), day: today(), by: me } : null;
        json(req, res, 200, saveNotices(target, d => { if (e) d.emergency = e; else delete d.emergency; return d; })); return;
      }
      if (P === 'notices/give') {
        if (!dir) return deny('Only the director records the yearly notice.');
        const y = String(body.year || ''), way = String(body.way || ''), date = String(body.date || '');
        if (!/^\d{4}$/.test(y) || !NOTICES.KYR_WAYS.some(([k]) => k === way) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { err(req, res, 400, 'Choose the year, the way it was given and the date.'); return; }
        const names = (Array.isArray(body.names) ? body.names : []).filter(n => employees().some(x => nameKey(x) === nameKey(n)));
        for (const n of names) saveNotices(n, d => Object.assign(d, { kyr: Object.assign({}, d.kyr, { [y]: { way, date, lang: noticesOf(n).lang, by: me, at: Date.now() } }) }));
        log('Workplace Know Your Rights notice recorded for', names.length, 'people,', y, 'by', me);
        json(req, res, 200, { ok: true, given: names.length }); return;
      }
      if (P === 'notices/ready') {
        if (!dir) return deny();
        put(SCHOOL, Object.assign({}, sc, { ready: Object.assign({}, sc.ready || {}, { notices: !!body.on }), updatedAt: Date.now(), updatedBy: me })); json(req, res, 200, { ok: true, ready: !!body.on }); return;
      }
      err(req, res, 404, 'Not found'); return;
    }
    if (P === 'person') {
      if (!canSee(me, who)) return deny('Only you and the director see your records.');
      if (!dir && !allowed(me, 'records') && !allowed(me, 'newed')) return deny();
      // a shared file on this record, such as a class roster, comes with its name
      const doc0 = person(who), sf = school().files || {}, txt = JSON.stringify(doc0);
      const shared = Object.fromEntries(Object.entries(sf).filter(([f]) => txt.includes(f)));
      json(req, res, 200, Object.assign(doc0, { shared, planStarted: G.planStarted(who), goTo: goToOf(who), policy: S.ready && POL.readers().some(n => nameKey(n) === nameKey(who)) ? POL.ackOf(who) : null, paired: pairedWith(who).map(n => ({ name: n, startDate: profileOf(n).startDate || '', checkins: person(n).gotoCheckins || [] })) })); return;
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
      json(req, res, 200, { people: staffNames().sort().map(n => { const d = person(n); return Object.assign(d, { shared: withShared(d), room: roomOf(n), role: whoRole(n), newHire: isNewHire(n), newEd: inNewEd(n), leaveOn: (accountFor(n) || {}).leaveOn || '' }); }), drills: (get(DRILLS) || {}).list || [] }); return;
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
      for (const k of ['shared', 'paired', 'goTo', 'room', 'role', 'newHire', 'newEd', 'policy', 'planStarted']) delete doc[k];
      // the required notices, acknowledgments, language and emergency contact change only through their own requests
      if (cur.notices) doc.notices = cur.notices; else delete doc.notices;
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
    /* The original materials of a PD module, the director's own decks, guides, agendas and handouts, kept in the tree@
       Drive through the same keeping as photos and listed in staff/pd/originals.json. The director and the presenters
       of an entry made from that module open them. No one else receives the list or a file. */
    /* The director takes a file off a module's Original materials, or puts it back. The file itself stays in the
       tree@ Drive, kept under removed in staff/pd/originals.json, so Put back returns it to the list. */
    if (P === 'pd/original/remove' || P === 'pd/original/restore') {
      if (!dir) return deny('Only the director changes a module\'s original materials.');
      const slug = String(body.slug || ''), id = String(body.id || ''); const o = get('staff/pd/originals.json') || {};
      const mods = Object.assign({}, o.modules), gone = Object.assign({}, o.removed);
      const from = P === 'pd/original/remove' ? mods : gone, to = P === 'pd/original/remove' ? gone : mods;
      const x = (from[slug] || []).find(y => y && y.id === id); if (!x) return err(req, res, 404, 'That file is not here.');
      from[slug] = from[slug].filter(y => y !== x); if (!from[slug].length) delete from[slug];
      to[slug] = [...(to[slug] || []).filter(y => y.id !== id), x];
      put('staff/pd/originals.json', Object.assign({}, o, { modules: mods, removed: gone })); log('Original material', P.endsWith('remove') ? 'removed from' : 'put back on', slug, id, 'by', me);
      json(req, res, 200, { list: (mods[slug] || []).map(y => ({ id: y.id, title: y.title || y.id, kind: y.kind || '', type: y.type || '' })), removed: (gone[slug] || []).map(y => ({ id: y.id, title: y.title || y.id })) }); return;
    }
    if (P === 'pd/originals' || P === 'pd/original') {
      const slug = String(body.slug || ''); const list = (((get('staff/pd/originals.json') || {}).modules || {})[slug] || []).filter(x => x && x.id);
      if (!dir && !PR.presentsModule(me, slug)) return deny('The director and this module\'s presenters open its original materials.');
      if (P === 'pd/originals') { json(req, res, 200, { list: list.map(x => ({ id: x.id, title: x.title || x.id, kind: x.kind || '', type: x.type || '' })), removed: dir ? ((((get('staff/pd/originals.json') || {}).removed || {})[slug]) || []).map(x => ({ id: x.id, title: x.title || x.id })) : undefined }); return; }
      const x = list.find(y => y.id === String(body.id || '')); if (!x) return err(req, res, 404, 'That file is not here.');
      try { const buf = await readOriginal(x.id); send(req, res, 200, { 'Content-Type': x.type || 'application/octet-stream', 'Content-Disposition': 'attachment; filename="' + x.id.replace(/[^a-z0-9._-]/gi, '') + '"', 'Cache-Control': 'private, no-store' }, buf); }
      catch (e) { err(req, res, 502, 'The file could not be read. ' + e.message); }
      return;
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
      if (b.open) sc.open = Object.assign({}, opened(), Object.fromEntries(Object.entries(b.open).filter(([k]) => ['records', 'pd', 'handbook', 'newed', 'growth', 'family'].includes(k)).map(([k, v]) => [k, !!v])));
      // the go-to person for every new educator. Someone marked never to be assigned is refused.
      if ('goTo' in b) { const g = String(b.goTo || '').slice(0, 40); if (g && (!staffNames().some(n => nameKey(n) === nameKey(g)) || profileOf(g).neverGoTo)) { err(req, res, 400, 'Choose someone else as the go-to person.'); return; } sc.goTo = g; }
      if (b.checkin && typeof b.checkin === 'object') sc.checkin = { week: Math.min(4, Math.max(1, Math.round(+b.checkin.week || 1))), secondTime: /^\d{2}:\d{2}$/.test(b.checkin.secondTime || '') ? b.checkin.secondTime : '', minutes: 20 };
      if (b.meeting && typeof b.meeting === 'object') sc.meeting = { start: /^\d{2}:\d{2}$/.test(b.meeting.start || '') ? b.meeting.start : '13:15', end: /^\d{2}:\d{2}$/.test(b.meeting.end || '') ? b.meeting.end : '14:30' };
      // each Class's team meeting time, and the months the director marks with no all-staff meeting, as December and February have none
      const T = x => /^\d{2}:\d{2}$/.test(x || '') ? x : '';
      if (b.teamMeetings && typeof b.teamMeetings === 'object') sc.teamMeetings = Object.fromEntries(classrooms().map(r => [r, { start: T((b.teamMeetings[r] || {}).start), end: T((b.teamMeetings[r] || {}).end) }]));
      if (Array.isArray(b.quietMonths)) sc.quietMonths = [...new Set(b.quietMonths.map(String).filter(x => /^\d{4}-(0[13-9]|1[01])$/.test(x)))].sort().slice(-36);
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
      // Garden educator is held alongside the person's own role, never in place of it
      if ('garden' in b) { if (b.garden && b.garden !== '0') doc.profile.garden = true; else delete doc.profile.garden; }
      if ('planHour' in b) doc.profile.planHour = /^\d{2}:\d{2}$/.test(b.planHour || '') ? b.planHour : '';
      if ('checkin' in b) doc.profile.checkin = ['slot', 'second', 'asneeded'].includes(b.checkin) ? b.checkin : '';
      if ('journalEvery' in b) doc.profile.journalEvery = +b.journalEvery === 2 ? 2 : 1;
      for (const k of ['partTime', 'noMondays', 'lighter']) if (k in b) doc.profile[k] = !!b[k] && b[k] !== '0';
      if ('curriculumFrom' in b) doc.profile.curriculumFrom = b.curriculumFrom === 'smallgroup' ? 'smallgroup' : '';
      if ('startDate' in b) doc.profile.startDate = /^\d{4}-\d{2}-\d{2}$/.test(b.startDate || '') ? b.startDate : '';
      if ('goTo' in b) doc.profile.goTo = String(b.goTo || '').slice(0, 40);
      // the onboarding path a new educator receives, First weeks unless she chooses another
      if ('onboarding' in b) doc.profile.onboarding = PA.onboardingId(b.onboarding);
      // the trainings the director chooses for this person
      for (const it of ITEMS.filter(i => i.chosen)) if (('need:' + it.k) in b) { const n = Object.assign({}, doc.profile.needs || {}); if (b['need:' + it.k] && b['need:' + it.k] !== '0') n[it.k] = true; else delete n[it.k]; doc.profile.needs = n; }
      put(pPath(who), doc);
      if ('room' in b) { const a = accountFor(who); if (a) { a.room = String(b.room || '').slice(0, 20); await saveAccounts(me); } }
      json(req, res, 200, { ok: true, profile: doc.profile }); return;
    }
    if (P === 'newhire') {
      if (!dir) return deny('Only the director adds a new educator.');
      const name = String(body.newName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
      if (!/^[A-Za-z][A-Za-z .'-]{0,29}$/.test(name)) { err(req, res, 400, 'Type the new educator\'s first name, letters only.'); return; }
      if (accountFor(name)) { err(req, res, 409, name + ' already has a sign-in.'); return; }
      accounts.list.push({ name, room: String(body.room || '').slice(0, 20), director: false, newHire: true, addedBy: me, addedAt: Date.now(), code: '', start: String(crypto.randomInt(100000, 1000000)), v: 0 });
      if (!(await saveAccounts(me))) { err(req, res, 502, 'The sign-in could not be saved. Try again.'); return; }
      const doc = person(name); doc.profile = { role: body.role === 'apprentice' ? 'apprentice' : 'educator', startDate: /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '') ? body.startDate : '', planHour: '', experienced: !!body.experienced, onboarding: PA.onboardingId(body.onboarding) };
      put(pPath(name), doc); log('New educator added', name, 'by', me);
      json(req, res, 200, { ok: true, start: (accountFor(name) || {}).start || '' }); return;
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
      if (!was) doc.hours = [...(doc.hours || []), { id: 'h' + crypto.randomBytes(4).toString('hex'), date: today(), title: (pc.dir === 'licensing' ? 'Licensing at Fulton Community School, ' : 'TREE How To, ') + pc.title, hours: Math.round(pc.minutes / 6) / 10, kind: pc.dir === 'licensing' ? 'licensing' : 'pd', approved: false, by: 'TREE' }];
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
  // reminders marked sent before this change never reached anyone, since records pages were closed and the director had no
  // TREE sign-in, so they are freed once to come again when records open
  function freeUnsent() { const s = sentDoc(); if (s.heldV2) return; const o = { heldV2: today() }; if (s.day) o.day = s.day; put(SENT, o); log('Records reminders marked sent before they reached anyone are freed'); }
  const expiryOf = (item, rec) => !rec || !rec.date ? '' : rec.expires || (item.months ? addMonths(rec.date, item.months) : '');
  const longDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
  const fluSeason = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return String(m >= 8 ? y : y - 1); };
  function semesterOf(iso) { const y = iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 8 ? y + '-fall' : m <= 5 ? y + '-spring' : ''; }
  /* What is due for one educator, each item with the key that marks it sent. Nothing is marked here. An item is marked sent
     only once it reaches someone, so a reminder held while records pages are closed, or one no phone received, is not used up. */
  function dueItems(name, day) {
    const sc = school(), on = k => !sc.remind || sc.remind[k] !== false, lead = sc.remindDays || 30, doc = person(name), out = [];
    const sent = sentDoc(); const fresh = k => !sent[k]; const add = (k, text) => out.push({ k, text });
    if (on('expiry') || on('hsa')) for (const it of ITEMS) {
      if (it.k === 'hsa' ? !on('hsa') : !on('expiry')) continue;
      if (!needsItem(doc, it)) continue;
      const ex = expiryOf(it, (doc.items || {})[it.k]); if (!ex) continue; const left = daysBetween(day, ex);
      if (left <= lead && left > 0 && fresh(`${pidOf(name)}|${it.k}|${ex}|soon`)) add(`${pidOf(name)}|${it.k}|${ex}|soon`, `${it.label} expires ${longDay(ex)}`);
      else if (left <= 0 && fresh(`${pidOf(name)}|${it.k}|${ex}|out`)) add(`${pidOf(name)}|${it.k}|${ex}|out`, `${it.label} expired ${longDay(ex)}`);
    }
    if (on('flu')) {
      const st = (doc.profile || {}).startDate || ''; const m = day.slice(5, 7), md = day.slice(5);
      // the flu shot is due each year between August 1 and December 1, with a reminder before August 1
      const season = md >= '07-15' && md < '08-01' ? day.slice(0, 4) : fluSeason(day);
      const firstYear = st && st > season + '-12-01' && st < (+season + 1) + '-08-01';
      const has = (doc.flu || {})[season];
      if (!has && !firstYear && md >= '07-15' && md < '08-01' && fresh(`${pidOf(name)}|flu|${season}|before`)) add(`${pidOf(name)}|flu|${season}|before`, 'The flu shot is due between August 1 and December 1');
      if (!has && !firstYear && (m === '11') && fresh(`${pidOf(name)}|flu|${season}|nov`)) add(`${pidOf(name)}|flu|${season}|nov`, 'The flu shot, or a written exemption, is due by December 1');
    }
    if (on('semester')) {
      const u = doc.units || {}; const sem = semesterOf(day);
      if (sem && Number(u.completed) < 12 && (u.completed !== undefined && u.completed !== '') && !((u.semesters || {})[sem] || {}).files?.length) {
        const start = sem.endsWith('fall') ? day.slice(0, 4) + '-08-20' : day.slice(0, 4) + '-01-20';
        // once each semester, from the day it starts
        if (day >= start && fresh(`${pidOf(name)}|sem|${sem}`)) add(`${pidOf(name)}|sem|${sem}`, 'Proof of enrollment for this semester, until you reach twelve units');
      }
    }
    return out;
  }
  // what is due for one educator as it is heard, each item marked sent as it is, as when it reaches their phone
  function dueFor(name, day) { const items = dueItems(name, day); if (items.length) { const s = Object.assign({}, sentDoc()); for (const i of items) s[i.k] = day; put(SENT, s); } return items.map(i => i.text); }
  let busy = false;
  /* ---------- walk safety and proposals, kept in the records as staff/walks.json and staff/proposals/<id>.json ---------- */
  const WALKS = 'staff/walks.json';
  const walksDoc = () => { const w = get(WALKS); return w && typeof w === 'object' ? w : null; };
  const lines = t => String(t || '').split('\n').map(x => x.replace(/^\s*[-*]\s+/, '').trim()).filter(x => x && !/^#/.test(x));
  function walksOut(dir) {
    const w = walksDoc(); const bp = (get(`staff/policies/teacher/${w.backpack || 'outdoor-wagon-backpack-pack-list'}.json`) || {});
    const out = { ready: !!w.ready, checklist: w.checklist || [], agreements: w.agreements || [], rule: w.rule || [], families: w.families || [], handbook: w.handbook || '', backpack: { id: w.backpack || '', title: bp.title || 'Outdoor Wagon/Backpack Pack List', items: lines(bp.body) }, photos: (w.photos || []).map(x => ({ id: x.id })) };
    if (dir) Object.assign(out, { licensing: w.licensing || [], note: w.note || '', proposals: proposals().filter(x => /walk/.test(x.id)).map(x => ({ id: x.id, title: x.title, doc: x.doc, status: x.status })) });
    return out;
  }
  // what a family reads about walks, once the director has marked walk safety ready
  const walksForFamily = () => { const w = walksDoc(); return w && w.ready ? { agreements: w.agreements || [], rule: w.rule || [], families: w.families || [], handbook: w.handbook || '' } : null; };
  const proposals = () => [...S.files.keys()].filter(p => /^staff\/proposals\/[a-z0-9-]+\.json$/.test(p)).map(p => get(p)).filter(x => x && x.id && x.title).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || a.id.localeCompare(b.id));
  async function tick() {
    if (busy || !S.ready || !accounts.loaded || !reminders.keys()) return; busy = true;
    try {
      freeUnsent();
      const now = new Date(); const day = today(); const hr = +now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }) % 24; const dow = new Date(day + 'T12:00:00Z').getUTCDay();
      if (dow < 1 || dow > 5 || hr < 8 || hr >= 11 || sentDoc().day === day) return;
      put(SENT, Object.assign({}, sentDoc(), { day }));
      const dirs = accounts.list.filter(a => isDirector(a.name)).map(a => a.name); const summary = []; const marks = [];
      const markSent = ks => { if (!ks.length) return; const s = Object.assign({}, sentDoc()); for (const k of ks) s[k] = day; put(SENT, s); };
      for (const n of staffNames()) {
        // while records pages are closed, an educator's reminders wait and nothing is used up, unless they are a new hire
        if (!isDirector(n) && !(opened().records || inNewEd(n))) continue;
        const items = dueItems(n, day); if (!items.length) continue;
        let reached = false;
        if (!isDirector(n)) { const r = await reminders.sendTo(n, { title: 'TREE, your records', body: items.map(i => i.text).join('\n'), url: 'tree.html?go=records', tag: 'tree-records' }); reached = !!(r && r.sent); }
        if (reached) markSent(items.map(i => i.k)); else marks.push(...items.map(i => i.k));
        summary.push(`${n}. ${items.map(i => i.text + (/[.!?]$/.test(i.text) ? '' : '.')).join(' ')}`);
      }
      // each January, from 2027, the director hears once to check the posters for updates and to give the yearly Workplace
      // Know Your Rights notice by February 1. Nothing goes out in any other month.
      { const y = +day.slice(0, 4); if (day.slice(5, 7) === '01' && y >= 2027 && !sentDoc()['notices|jan|' + y]) marks.push('notices|jan|' + y), summary.push(`January. Check the workplace posters for updates, such as the yearly minimum wage poster, and give the California Workplace Know Your Rights notice by February 1, with the chance to name or change an emergency contact. Required notices in TREE lists each person's language and keeps the record.`); }
      const sc = school(); const drills = (get(DRILLS) || {}).list || [];
      if (sc.remind?.drill !== false) { const last = drills.map(d => d.date).sort().pop(); if ((!last || daysBetween(last, day) >= 90) && dow === 1 && !sentDoc()['drill|' + (last || 'none')]) marks.push('drill|' + (last || 'none')), summary.push(last ? `No emergency drill since ${longDay(last)}. Drills happen at least every three months.` : 'No emergency drill is in the log yet. Drills happen at least every three months.'); }
      // what the director hears is marked sent once it reaches her phone, so a summary no phone received comes again
      if (summary.length) { let got = 0; for (const d of dirs) { const r = await reminders.sendTo(d, { title: 'TREE, educator records', body: summary.join('\n'), url: 'tree.html?go=records', tag: 'tree-records-dir' }); got += (r && r.sent) || 0; } if (got) markSent(marks); }
    } catch (e) { log('Educator record reminders failed,', e.message); } finally { busy = false; }
  }
  setInterval(tick, 5 * 60e3).unref(); setTimeout(tick, 60e3).unref();

  /* ---------- for the server ---------- */
  // a shared sign-in reads the PD library and the Teacher Policies and Procedures, and has no records or growth of its own
  // the Family Handbook is for every staff sign-in but the kitchen, once the director turns it on
  function canFor(name) { if (!hasOwn(name)) return { records: false, pd: allowed(name, 'pd'), handbook: allowed(name, 'handbook'), newed: false, growth: false, family: allowed(name, 'family') };
    if (isKitchen(name)) return { records: allowed(name, 'records'), pd: false, handbook: false, newed: false, growth: false, family: false };
    if (profileOf(name).role === 'staff') { const r = allowed(name, 'records'); return { records: r, pd: false, handbook: false, newed: false, growth: false, family: allowed(name, 'family') }; }
    return { notices: isDirector(name) || !!(school().ready || {}).notices, records: allowed(name, 'records'), pd: allowed(name, 'pd'), handbook: allowed(name, 'handbook'), newed: allowed(name, 'newed'), growth: !!S.ready && (isDirector(name) || (G.takesPart(name) && !!opened().growth)), team: !!S.ready && (isDirector(name) || (G.takesPart(name) && !isNewHire(name))), presenting: !!S.ready && PR.anyFor(name), family: allowed(name, 'family') || allowed(name, 'newed') }; }
  function bootInfo(name) { if (!S.ready) return { loading: true, director: isDirector(name) };
    return { director: isDirector(name), newHire: isNewHire(name), newEd: inNewEd(name), open: opened(), can: canFor(name), fh: POL.current() }; }
  // the nightly backup holds every educator record and the handbook. Sign-ins and passcodes stay out, as before.
  // the pictures in the Teacher Policies, the Family Handbook and the recipe library, for the nightly backup
  async function dumpImages() { const out = {}; for (const p of S.imgs.keys()) { try { out[p] = (await readImage(p)).toString('base64'); } catch (e) { log('A picture could not be added to the backup,', p, e.message); } } return out; }
  const dump = () => Object.fromEntries([...S.files].filter(([, r]) => r && (r.doc || typeof r.text === 'string')).map(([p, r]) => [p, r.doc || r.text]));
  // the growth part, kept in growth.js, shares these records and the server's rules
  let PR = null;
  // the Garden and the yards, in garden.js, kept beside the educator records
  const LIB = require('./library.js')({ S, get, put, putText, log, isDirector, isKitchen, readImage: p => readImage(p) });
  const PGA = require('./playgarden.js')({ S, get, put, log, wordingDoc: id => wordingDoc(id), agreements: () => { const A = (get('staff/garden/setup.json') || {}).agreements || {}; return { guiding: A.guiding || [], families: A.families || null }; } });
  const GD = require('./garden.js')({ recipeFor: id => recipeForFamily(id), get, put, getText: p => { const r = S.files.get(p); return r && typeof r.text === 'string' ? r.text : ''; }, libraryPaths: dir => [...S.files.keys()].filter(k => k.startsWith(dir)), log, isDirector, isKitchen, nameKey, roomOf, classrooms, today, mondayOf, staffNames, addDays: (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); } });
  const G = require('./growth.js')({ get, put, S, log, person, profileOf, pPath, pidOf, staffNames, isDirector, isKitchen, nameKey, classrooms, school, opened, today, addMonths, daysBetween,
    mondayOf, roomOf, pieces, checkPasscode, nameBlocked, calendarEvents, reminders, store, lensNow, isNewHire, inNewEd, isFormerEducator, ledBy: n => PR.ledBy(n), presTitle: (me, id) => PR.visibleTitle(me, id), putText, piecesChanged: () => { pieceCache = null; } });
  // PD paths and assignments, beside the PD library's modules
  const PA = require('./paths.js')({ get, put, log, S, isDirector, isKitchen, nameKey, staffNames, roomOf, classrooms, today, daysBetween, pidOf, profileOf, inNewEd, G, newedParts, newedFor, newedReady, newedOrder: (l, me) => newedOrder(l, me), goToName, reminders });
  // any file under staff/ for this person, their record, growth, journal or a Proud Moment by them or for them
  // a records page holding nothing but the 2026 Know Your Rights mark TREE made at start is not records of their own, so a
  // sign-in added by mistake can still be removed
  const empty = v => v == null || v === '' || v === false || (typeof v === 'object' && Object.values(v).every(empty));
  const onlyMarks = d => !!d && Object.entries(d).every(([k, v]) => k === 'name' || (k === 'notices' ? Object.entries(v || {}).every(([n, x]) => n === 'kyr' ? Object.values(x || {}).every(m => m && m.outside && Object.keys(m).length === 1) : empty(x)) : empty(v)));
  function hasFiles(name) { if ([G.gPath(name), G.jPath(name)].some(p => S.files.has(p)) || (S.files.has(pPath(name)) && !onlyMarks(get(pPath(name))))) return true; return G.momentsOf(name).length > 0; }
  // the last day kept on the educator's profile as leftOn, or taken off when they stay or come back
  async function markLeft(name, day) {
    await ready(); const has = S.files.has(pPath(name)); if (!day && !has) return;
    const doc = person(name); doc.profile = Object.assign({}, doc.profile); if (day) doc.profile.leftOn = day; else delete doc.profile.leftOn;
    if (has && (get(pPath(name)).profile || {}).leftOn === doc.profile.leftOn) return; put(pPath(name), doc);
  }
  // a former educator's records, removed once the keeping period has passed and the director confirmed it twice. The
  // files stay in the records' history on GitHub and in earlier nightly backups.
  async function removeFormer(name) {
    await ready(); if (!isFormerEducator(name)) throw new Error('Only a former educator\'s records are removed.'); let n = 0;
    for (const p of [pPath(name), G.gPath(name), G.jPath(name)]) {
      if (!S.files.has(p)) continue; clearTimeout(S.timers.get(p)); S.timers.delete(p); await (S.saving.get(p) || Promise.resolve());
      const r = S.files.get(p);
      if (r && r.sha) { const res = await gh('DELETE', `/repos/${repo}/contents/${p}`, { message: 'Remove ' + p.replace(/^staff\//, 'educator records ').replace(/\.json$/, '') + ' after the keeping period', sha: r.sha, branch: store.branch }); if (res.status !== 200 && res.status !== 404) throw new Error('GitHub answered ' + res.status + ' when removing ' + p); }
      S.files.delete(p); n++;
    }
    const ms = G.momentsOf(name); if (ms.length) { const ids = new Set(ms.map(m => m.id)); put('staff/moments.json', Object.assign({}, get('staff/moments.json'), { list: ((get('staff/moments.json') || {}).list || []).filter(m => !ids.has(m.id)) })); n += ms.length; }
    return n;
  }
  // Presenting, kept in presenting.js, beside the PD days and the growth pages
  PR = require('./presenting.js')({ get, put, S, log, person, profileOf, pPath, pidOf, staffNames, isDirector, nameKey, school, today, store, accountFor, takesPart: n => G.takesPart(n), isNewHire, moduleOf: slug => G.modules()[slug] || null, readingsFor: me => G.readingsFor(me) });
  // a picture in the policies, read from the records the first time it is asked for
  async function readImage(p) {
    if (S.imgCache.has(p)) return S.imgCache.get(p); const sha = S.imgs.get(p); if (!sha) throw new Error('not here');
    const b = await gh('GET', `/repos/${repo}/git/blobs/${sha}`); if (b.status !== 200) throw new Error('GitHub answered ' + b.status);
    const buf = Buffer.from(b.json.content, 'base64'); S.imgCache.set(p, buf); return buf;
  }
  const POL = require('./policies.js')({ get, put, putText, S, log, person, pPath, staffNames, isDirector, isKitchen, nameKey, today, allowed, hasOwn, profileOf, accountFor, store, readImage, roleNames: o.roleNames || (() => []), piecesChanged: () => { pieceCache = null; } });
  // the Family page and the public page read the Family Handbook through these
  const handbook = { ready: async () => { await ready(); }, current: () => POL.current(), forFamily: y => POL.forFamily(y), forPublic: () => POL.forPublic(), image: async (p, isPublic) => { const q = POL.familyImage(p, isPublic); if (!q) throw new Error('not here'); return readImage(q); } };
  /* ---------- one-time steps, run by server.js once each through the save queue ---------- */
  // the mandated reporter link in the Licensing at Fulton piece on official trainings points to the California page
  // School words, a wording page the director edits in place, for lines that were fixed in code
  function onceSchoolWords(defaults) {
    if (!S.ready) return false; const p = 'staff/wording/school-words.md'; if (S.files.get(p)) return;
    putText(p, ['<!-- The school\'s own words for a few lines TREE shows. Change the words under each heading. Keep the headings as they are. -->', '# School words', '',
      '## Nut free line', 'We are a nut free school.', '',
      '## Family welcome letter', defaults.welcome || '', '',
      '## Staff room display rests from', '19:00', '',
      '## Staff room display wakes at', '06:00', '',
      '## Staff room display reloads at', '03:00', ''].join('\n'));
    log('School words page made');
  }
  function onceTrainingLinks() {
    if (!S.ready) return false; const p = 'staff/pd/licensing/22-official-trainings.md'; const r = S.files.get(p); if (!r || typeof r.text !== 'string') return false;
    const next = r.text.replace(/\(https:\/\/mandatedreportertraining\.com\/?\)/g, '(https://mandatedreportertraining.com/california/)');
    if (next !== r.text) { putText(p, next); pieceCache = null; log('Mandated reporter link now points to the California page'); }
  }
  // each current employee with a sign-in, the kitchen included and the director left out, has the 2026 Workplace Know
  // Your Rights notice on file outside TREE. No date is written, since none is known.
  function onceKyr2026() {
    if (!S.ready) return false; let n = 0;
    for (const a of accounts.list) {
      if (!a || !a.name || a.director || isDirector(a.name) || isFormerEducator(a.name) || a.renderOnly) continue;
      // a shared sign-in is no employee, and a new hire who has not started yet receives the notice at hire
      if (!staffNames().some(n => nameKey(n) === nameKey(a.name))) continue; const sd = profileOf(a.name).startDate || ''; if (sd && sd > today()) continue;
      const doc = person(a.name); const nt = Object.assign({}, doc.notices); const kyr = Object.assign({}, nt.kyr);
      if (kyr['2026']) continue; kyr['2026'] = { outside: true }; nt.kyr = kyr; doc.notices = nt; put(pPath(a.name), doc); n++;
    }
    log('Know Your Rights 2026 marked on file outside TREE for', n, 'people');
  }
  /* One-time steps that change records already there from a list of changes kept in the private records, so no
     wording from the records sits in TREE's public code. Each change names a record by its path and either swaps a
     passage, from and to (with all, a whole value equal to from), or sets one value at a place in the record, such as
     fields.remarks or list[id=rl31].cite, only while the value there is still what the change expects. A section of
     the Teacher Policies and Procedures or the Family Handbook changes as any edit does, keeping its earlier wording in
     its history. Every other record keeps its earlier wording in the records' own history. A record in the main
     records is changed through recs, the server's save queue. A record's own history is never changed. */
  // a change can also add an entry to a list, such as a Help answer or a reading, only while no entry has its id
  const ONCE_LISTS = {
    schoolName: ['staff/naming-2026.json', 'Naming the school, we and our, and Fulton Community School where a name is needed'],
    helpCurrent: ['staff/once/help-current.json', 'Help answers brought in line with their buttons'],
    regLinks: ['staff/once/reg-links.json', 'Links to the CDSS regulation documents each page cites, confirmed October 25, 2026'],
    trainingVideos: ['staff/once/training-videos.json', 'Watch the training links to CDSS Community Care Licensing videos, confirmed October 25, 2026'],
    readingLinks: ['staff/once/reading-links.json', 'Readings and policy links corrected and confirmed October 25, 2026'],
    handwash: ['staff/once/handwash.json', 'Handwashing in the Garden as our own practice'],
    restoreStale: ['staff/once/restore-stale.json', 'Restored as saved before an older copy replaced it'],
    plantNames: ['staff/once/plant-names.json', 'Plant card and Full plant page'],
    moduleTitles: ['staff/once/module-titles.json', 'Module titles renamed, each module keeping its place and progress'],
    letterTitle: ['staff/once/letter-title.json', 'A Letter to Our Educators, signed by the director'],
    policyWording: ['staff/once/policy-wording.json', 'Wording brought in line with TREE\'s writing rules'],
    readingArticles: ['staff/once/reading-articles.json', 'Articles to read online, confirmed October 25, 2026'],
    helpNew: ['staff/once/help-new.json', 'Help answers for what Session 10 added'],
    dutiesEmail: ['staff/once/duties-email.json', 'The late pick-up email link reaches the director'],
    lovejoyBooks: ['staff/once/lovejoy-books.json', 'Sharon Lovejoy\'s books on gardening with children'],
    gardenAgreements: ['staff/once/garden-agreements.json', 'One set of garden family agreements for everyone'],
    presentingFixes: ['staff/once/presenting-fixes.json', 'Presenting and PD library fixes, lengths, audience types, links and the November 2 guest session'],
    helpSession11: ['staff/once/help-session11.json', 'Help answers for what Session 11 added and changed'],
    // Session 12, each from its own list in the private records
    s12Library: ['staff/once/s12-library.json', 'The recipe library, the provocations, the read-alouds and the garden pages, interpreted for our school'],
    s12Songs: ['staff/once/s12-songs.json', 'The song book, interpreted for our school'],
    s12Pd: ['staff/once/s12-pd.json', 'PD modules, How To guides, new educator pages, materials guides and presenting outlines brought in line with the director\'s decisions'],
    s12Family: ['staff/once/s12-family.json', 'Family page pieces, story frames and wording brought in line with the director\'s decisions'],
    s12Proposals: ['staff/once/s12-proposals.json', 'Proposed sections and rewrites for the Teacher Policies and Procedures and the 2027 Family Handbook draft'],
    s12Readings: ['staff/once/s12-readings.json', 'One readings list, with a line on why each matters to our practice'],
    s12Garden: ['staff/once/s12-garden.json', 'The Garden\'s plants, animals with Sheldon, wildlife, tracks and scat, mushrooms and plants to keep away from'],
    s12Help: ['staff/once/s12-help.json', 'Help answers for what Session 12 added and changed'],
    s12NoSlowCooker: ['staff/once/s12-no-slow-cooker.json', 'No slow cooker at the piazza, so quinoa porridge cooks on the kitchen stove'],
    freeStories: ['code:once/free-stories.json', 'Free classic stories in their own words that pass our values check'],
    s12ReadAlouds: ['staff/once/s12-read-alouds.json', 'Our own read-alouds and traditional tales in place of the Watch and Wonder books'],
    s12Review: ['staff/once/s12-review.json', 'Fixes from the review of TREE after Session 12'] };
  const placeOf = at => String(at).split('.').map(k => { const m = k.match(/^([^[]+)\[id=([^\]]+)\]$/); return m ? [m[1], m[2]] : [k]; });
  function setAt(doc, at, value, expect) {
    const ks = placeOf(at); let t = doc;
    for (let i = 0; i < ks.length; i++) {
      const [k, id] = ks[i], last = i === ks.length - 1;
      if (id !== undefined) { const arr = t[k]; if (!Array.isArray(arr)) return false; const j = arr.findIndex(x => x && String(x.id) === id); if (j < 0) return false; if (last) return false; t = arr[j]; continue; }
      if (last) {
        if (expect !== undefined && JSON.stringify(t[k] === undefined ? null : t[k]) !== JSON.stringify(expect)) return false;
        if (JSON.stringify(t[k]) === JSON.stringify(value)) return false;
        if (value === null) delete t[k]; else t[k] = value; return true;
      }
      if (!t[k] || typeof t[k] !== 'object') { if (expect !== undefined && expect !== null) return false; t[k] = {}; }
      t = t[k];
    }
    return false;
  }
  async function onceEdits(name, recs) {
    const [listPath, note] = ONCE_LISTS[name] || [];
    if (!S.ready || !listPath) return false;
    // a list kept in the code itself, for words free to share such as classic stories, is read from the code's own folder
    const m = listPath.startsWith('code:') ? (() => { try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, listPath.slice(5)), 'utf8')); } catch (e) { return null; } })() : get(listPath); if (!m || !Array.isArray(m.changes)) return false;
    const by = new Map();
    const hit = new Set(); let failed = 0;
    /* Session 12's lists also make a new page or record, only while nothing is kept at its path (create, the text of a
       Markdown page, or doc, a record), and take away a page merged into another (remove), only while its words are still
       the words the change expects, so a page the director has changed since is left as it is. */
    for (const c of m.changes) {
      if (!c || typeof c.path !== 'string' || !/^staff\/[a-z0-9/_.-]+\.(md|json)$/i.test(c.path)) continue;
      try {
        if (typeof c.create === 'string' && /\.md$/.test(c.path)) { if (!S.files.has(c.path)) putText(c.path, c.create); hit.add(c); continue; }
        if (c.doc && typeof c.doc === 'object' && /\.json$/.test(c.path)) { if (!S.files.has(c.path)) put(c.path, JSON.parse(JSON.stringify(c.doc))); hit.add(c); continue; }
        if (c.remove === true) { const r = S.files.get(c.path); if (!r) { hit.add(c); continue; }
          if (typeof c.expect === 'string' && (typeof r.text === 'string' ? r.text !== c.expect : (() => { try { return JSON.stringify(r.doc) !== JSON.stringify(JSON.parse(c.expect)); } catch (e) { return true; } })())) continue;
          if (r.sha) { const res = await gh('DELETE', `/repos/${repo}/contents/${c.path}`, { message: 'Remove ' + c.path.replace(/^staff\//, 'educator records ') + ', ' + note, sha: r.sha, branch: store.branch }); if (res.status !== 200 && res.status !== 404) throw new Error('GitHub answered ' + res.status); }
          S.files.delete(c.path); hit.add(c); continue; }
      } catch (er) { failed++; log('One-time step', name, 'could not change', c.path, er.message); }
    }
    for (const c of m.changes) if (c && typeof c.path === 'string' && ((typeof c.from === 'string' && c.from && typeof c.to === 'string') || typeof c.set === 'string' || (typeof c.add === 'string' && c.value && c.value.id))) { if (!by.has(c.path)) by.set(c.path, []); by.get(c.path).push(c); }
    // a passage is swapped only where it is not already the new wording, so a step that runs again changes nothing
    const swapAll = (t, from, to) => { const k = to.indexOf(from); if (k < 0) return t.split(from).join(to);
      const pre = to.slice(0, k), post = to.slice(k + from.length); let out = '', i = 0, j;
      while ((j = t.indexOf(from, i)) >= 0) { const done = t.slice(Math.max(0, j - pre.length), j) === pre && t.slice(j + from.length, j + from.length + post.length) === post; out += t.slice(i, j) + (done ? from : to); i = j + from.length; }
      return out + t.slice(i); };
    const swap = (t, cs) => { for (const c of cs) { if (c.set || c.add) continue; if (c.all) { if (t === c.from) { t = c.to; hit.add(c); } } else if (t.includes(c.from)) { const n = swapAll(t, c.from, c.to); if (n !== t) { t = n; hit.add(c); } } } return t; };
    const deep = (v, cs) => typeof v === 'string' ? swap(v, cs) : Array.isArray(v) ? v.map(x => deep(x, cs)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'history' ? x : deep(x, cs)])) : v;
    const sets = (doc, cs) => { const d = JSON.parse(JSON.stringify(doc)); for (const c of cs) { if (c.set && setAt(d, c.set, c.value === undefined ? null : c.value, c.expect)) hit.add(c);
      if (c.add) { const arr = c.add.split('.').reduce((t, k) => t && t[k], d); if (Array.isArray(arr) && !arr.some(x => x && String(x.id) === String(c.value.id))) { arr.push(JSON.parse(JSON.stringify(c.value))); hit.add(c); } } } return d; };
    const both = (doc, cs) => sets(deep(doc, cs), cs);
    const tpFor = p => POL.entries().find(e => { const s = POL.tpSection(e); return s.ref === p || `staff/policies/teacher/${e.id}.json` === p; });
    let n = 0;
    for (const [p, cs] of by) {
      try {
        if (/^(staff|family\/handbook)\//.test(p)) {
          const r = S.files.get(p); if (!r) continue; const e = /^family\/handbook\//.test(p) ? null : tpFor(p);
          if (typeof r.text === 'string') {
            const next = swap(r.text, cs); if (next === r.text) continue;
            if (e) { const pp = POL.pieceParts(next); if (pp) POL.saveTeacher('TREE', { id: e.id, title: pp.title, body: pp.body, note }); }
            // a page with the director's Edit button keeps the wording before the step as its earlier version
            if (editable(p)) { const h = Object.assign({ path: p, history: [] }, get(PAGE_HIST(p)) || {}); const pp = pageParts(r.text);
              h.history = [...(h.history || []), { title: pp ? pp.title : '', text: r.text, at: h.updatedAt || 0, by: h.updatedBy || '', note: h.note || '' }].slice(-100);
              Object.assign(h, { note, updatedAt: Date.now(), updatedBy: 'TREE' }); put(PAGE_HIST(p), h); }
            putText(p, next); n++; continue;
          }
          const fh = p.match(/^family\/handbook\/(\d{4})\/([a-z0-9-]+)\.json$/);
          if (e && p !== 'staff/policies/teacher.json' && !cs.some(c => c.set || c.add)) { const s = POL.tpSection(e); const title = swap(s.title || '', cs), body = swap(s.body || '', cs); if (title !== s.title || body !== s.body) { POL.saveTeacher('TREE', { id: e.id, title, body, note }); n++; } continue; }
          if (fh && fh[2] !== 'edition' && fh[2] !== 'public' && !cs.some(c => c.set || c.add)) { const s = POL.fhSection(fh[1], fh[2]); if (!s || s.same) continue; const title = swap(s.title || '', cs), body = swap(s.body || '', cs); if (title !== s.title || body !== s.body) { POL.saveFamily('TREE', { edition: fh[1], id: fh[2], title, body, note }); n++; } continue; }
          const next = both(r.doc, cs); if (JSON.stringify(next) !== JSON.stringify(r.doc)) { put(p, next); n++; }
          continue;
        }
        if (recs(p, doc => both(doc, cs))) n++;
      } catch (er) { failed++; log('One-time step', name, 'could not change', p, er.message); }
    }
    pieceCache = null; G.invalidate();
    const missed = m.changes.filter(c => c && !hit.has(c)).length;
    log('One-time step', name, 'changed', n, 'records,', m.changes.length - missed, 'of', m.changes.length, 'changes applied');
    // a change that could not be made is tried again at the next start, and the changes already made stay as they are
    if (failed) return false;
  }
  // who holds the Garden educator role. Until someone does, the director holds it, which the pages read as an empty list.
  const gardenEducators = () => S.ready ? staffNames().filter(n => profileOf(n).garden && !isFormerEducator(n)).sort() : [];
  // a recipe from the library as families read it, ingredients, then the steps, then the dairy free and gluten free versions
  function recipeForFamily(id) { const x = LIB.item('staff/library/recipes/' + String(id).replace(/[^a-z0-9-]/g, '') + '.md'); if (!x || x.draft) return null;
    const L = k => ((x.parts.find(p => p.key.toLowerCase() === k.toLowerCase()) || {}).text || '').split('\n').map(l => (l.match(/^\s*[-*]\s+(.*)$/) || [])[1]).filter(Boolean);
    const out = []; if (L('Ingredients').length) out.push('Ingredients\n' + L('Ingredients').join('\n')); if (L('Steps').length) out.push('Steps\n' + L('Steps').map((l, i) => (i + 1) + '. ' + l).join('\n'));
    for (const k of ['Dairy free', 'Gluten free']) if (L(k).length) out.push(k + '\n' + L(k).join('\n'));
    return { id: x.id, title: x.title, kind: /^sensory$/i.test(x.meta.kind || '') ? 'sensory' : 'food', source: x.meta.source || '', text: out.join('\n\n') }; }
  return { dumpImages, useRecsEdit: f => { RECS_EDIT = f; }, playgarden: PGA, recipeForFamily, library: LIB, gardenEducators, wordingDoc, wordingAll, walksForFamily, familyPiecesForFamily, once: { schoolWords: onceSchoolWords, trainingLinks: onceTrainingLinks, kyr2026: onceKyr2026, edits: onceEdits }, load, handle, flushAll, bootInfo, dump, isNewHire, isFormerEducator, formerNames, hasFiles, markLeft, removeFormer, tick, handbook, policies: POL, growthTick: () => G.tick(), pieces, dueFor, calendarExtra: (f, t, me) => { try { return S.ready ? [...G.calendarExtra(f, t, me), ...GD.calendar(f, t, me), ...PA.calendar(f, t, me)] : []; } catch (e) { return []; } }, paths: PA, garden: GD, displayMoments: () => G.displayMoments(), rev: () => G.rev() + '.' + PA.rev() };
};
