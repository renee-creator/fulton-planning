'use strict';
/* The Volunteer Jobs library. Every job card families can do, in the director's own words, kept in the records under
   staff/volunteer. The director and the office read it, edit any card with the same Edit, history and restore as a PD
   module, add cards, choose each card's job type and print one, some or all. Future Ideas, cards on hold, are the
   director's alone, and the server leaves them out of what the office receives. Families see nothing from here yet.

   The cards came from the director's own file, once/volunteer-jobs.json, copied into the records once, word for word,
   by the one-time step volunteerJobs. Her answer that every card says your point person in place of staff is then
   saved as each card's second version, so the words as first loaded stay in its history. */

module.exports = function volunteerModule(c) {
  const { get, put, S, log, isDirector, isOffice, saveRecord } = c;
  const JOBS = 'staff/volunteer/jobs.json', GROUPS = 'staff/volunteer/groups.json', INTRO = 'staff/volunteer/intro.json';
  const FUTURE = 'future-ideas';
  // how a job reaches families, in the order the library lists them
  const TYPES = [['anytime', 'Anytime'], ['scheduled', 'Scheduled'], ['school-day', 'School day'], ['work-day', 'Work day'], ['at-home', 'At home']];
  // each group's starting type, from the director's answer. A group not named here starts as scheduled.
  const START_TYPE = { 'quick-jobs-at-pickup': 'anytime', 'at-home': 'at-home', 'during-the-school-day': 'school-day', 'classes-and-studio': 'school-day' };
  // the Family page's own words for the anytime jobs, used until the director writes her own in Before You Start
  const FAMILY = { title: 'Jobs you can do anytime', lead: 'No sign-up needed. Do one whenever it suits you, then tap I did this to log your time.', anytime: 'Anytime at school', atHome: 'At home' };
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'job';
  const txt = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 200);

  /* ---------- the words the director edits, with their history ---------- */
  const SPECS = [
    { re: /^staff\/volunteer\/jobs\.json$/, list: 'jobs', name: 'this job card', title: x => x.title,
      fields: [['title', 'Job name'], ['where', 'Where'], ['time', 'How long'], ['who', 'Who'], ['supplies', 'Supplies, one on each line', 'lines'],
        ['directions', 'Directions, one step on each line', 'lines'], ['take_care', 'Take care, one on each line', 'lines'], ['done_when', 'Done when, the words that follow it']] },
    { re: /^staff\/volunteer\/groups\.json$/, list: 'groups', name: 'this group', title: x => x.name, fields: [['name', 'Group name'], ['note', 'A note under the group']] },
    { re: /^staff\/volunteer\/intro\.json$/, name: 'Before You Start', title: x => x.title, fields: [['title', 'Title'], ['lead', 'Opening lines'], ['guidelines', 'Guidelines, one on each line', 'lines'],
      ['familyTitle', 'On the Family page, the title of the anytime jobs. Left empty, it reads ' + FAMILY.title], ['familyLead', 'On the Family page, the lines under that title. Left empty, they read ' + FAMILY.lead],
      ['familyAnytime', 'On the Family page, the heading for jobs at school. Left empty, it reads ' + FAMILY.anytime], ['familyAtHome', 'On the Family page, the heading for jobs at home. Left empty, it reads ' + FAMILY.atHome]] }
  ];
  const sees = me => isDirector(me) || isOffice(me);
  const jobs = () => (get(JOBS) || {}).jobs || [];
  const groups = () => (get(GROUPS) || {}).groups || [];
  const isFuture = j => !!j && (j.status === 'future' || j.group === FUTURE);
  // who may open and save a piece of the library in the editor. Future Ideas, and a card kept there, are the director's.
  function mayEdit(me, p, item) {
    if (!/^staff\/volunteer\//.test(String(p || ''))) return false;
    if (isDirector(me)) return true; if (!isOffice(me)) return false;
    if (p === JOBS) return !isFuture(jobs().find(j => j && j.id === item));
    if (p === GROUPS) return item !== FUTURE;
    return p === INTRO;
  }

  /* ---------- loading the director's file once ---------- */
  // every card that said staff says your point person, from the director's answer on October 28, 2026
  function pointPerson(s) {
    return String(s).replace(/staff have it/g, 'your point person has it').replace(/staff have set/g, 'your point person has set').replace(/staff ask\b/g, 'your point person asks')
      .replace(/\bStaff will\b/g, 'Your point person will').replace(/\bAsk staff\b/g, 'Ask your point person').replace(/\bstaff\b/g, 'your point person');
  }
  const flat = j => ['title', 'where', 'time', 'who', 'done_when'].map(k => j[k]).concat(j.supplies, j.directions, j.take_care);
  // what the one-time step reads, the director's file exactly as she gave it
  function fromFile(src) {
    if (!src || !src.intro || !Array.isArray(src.categories)) return null;
    const ids = new Set(); const gs = []; const js = [];
    for (const cat of src.categories) {
      const gid = slug(cat.category); gs.push({ id: gid, name: String(cat.category), note: String(cat.note || '') });
      for (const j of cat.jobs || []) {
        let id = slug(j.title), n = 2; while (ids.has(id)) id = slug(j.title) + '-' + n++; ids.add(id);
        js.push({ id, group: gid, status: gid === FUTURE ? 'future' : 'active', type: START_TYPE[gid] || 'scheduled', title: j.title, where: j.where, time: j.time, who: j.who,
          supplies: [...(j.supplies || [])], directions: [...(j.directions || [])], take_care: [...(j.take_care || [])], done_when: j.done_when });
      }
    }
    return { jobs: { jobs: js, stepsBefore: false, source: 'once/volunteer-jobs.json' }, groups: { groups: gs }, intro: { title: String(src.intro.title), lead: String(src.intro.lead), guidelines: [...(src.intro.guidelines || [])] } };
  }
  // run at start until it has run once. Cards already in the records are never written over.
  function once() {
    if (!S.ready) return false;
    if (S.files.has(JOBS)) return;
    let src; try { src = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'once/volunteer-jobs.json'), 'utf8')); } catch (e) { log('The volunteer job cards could not be read,', e.message); return false; }
    const d = fromFile(src); if (!d) { log('The volunteer job cards file is not in the shape TREE reads'); return false; }
    const at = Date.now();
    put(GROUPS, d.groups); put(INTRO, d.intro); put(JOBS, Object.assign(d.jobs, { loadedAt: at }));
    // the second version of each card that said staff. Every other word stays as loaded.
    const sp = SPECS[0]; let n = 0;
    for (const j of d.jobs.jobs) {
      if (!flat(j).some(s => /\bstaff\b/i.test(s))) continue;
      const parts = sp.fields.map(([k, , t]) => ({ body: t === 'lines' ? j[k].map(pointPerson).join('\n') : pointPerson(j[k]) }));
      const r = saveRecord('TREE', JOBS, j.id, { note: 'Your point person in place of staff, as the director chose', keep: true, parts });
      if (r && r.ok) n++; else log('Volunteer job card not changed,', j.id, r && r.error);
    }
    log('Volunteer job cards loaded,', d.jobs.jobs.length, 'cards in', d.groups.groups.length, 'groups,', n, 'saying your point person');
  }

  /* ---------- what the library page receives ---------- */
  // a playdough card names our recipe in TREE. Until the recipe library has one, the director sees a note on it.
  function hasPlaydough() {
    for (const [p, r] of S.files) { if (!/^staff\/library\/recipes\/[a-z0-9-]+\.md$/.test(p) || typeof r.text !== 'string') continue;
      if (/^\s*status:\s*draft\s*$/m.test(r.text.split('-->')[0] || '')) continue;
      if (/^#{1,3}\s+.*play\s?dough/im.test(r.text)) return true; }
    return false;
  }
  function view(me) {
    const dir = isDirector(me); const all = jobs();
    const out = { loaded: S.files.has(JOBS), director: dir, types: TYPES.map(([key, name]) => ({ key, name })), intro: get(INTRO) || null,
      groups: groups().filter(g => dir || g.id !== FUTURE), jobs: all.filter(j => dir || !isFuture(j)), stepsBefore: !!(get(JOBS) || {}).stepsBefore,
      paths: { jobs: JOBS, groups: GROUPS, intro: INTRO } };
    if (dir) { const pd = hasPlaydough(); out.notes = {}; for (const j of all) if (!pd && flat(j).some(s => /playdough recipe/i.test(s || ''))) out.notes[j.id] = 'No playdough recipe is in the recipe library yet. This note shows only to you.'; }
    return out;
  }
  /* ---------- the Family page ---------- */
  // the cards a family can do with no sign-up, those whose type is anytime or at home, each whole as the library holds it
  const forFamilyJob = j => !!j && !isFuture(j) && (j.type === 'anytime' || j.type === 'at-home');
  const famCard = j => ({ id: j.id, title: j.title, where: j.where, time: j.time, who: j.who, supplies: j.supplies || [], directions: j.directions || [], take_care: j.take_care || [], done_when: j.done_when || '' });
  function forFamily() {
    if (!S.files.has(JOBS)) return null;
    const js = jobs().filter(forFamilyJob); if (!js.length) return null;
    const I = get(INTRO) || {}; const w = k => String(I[k] || '').trim();
    return { title: w('familyTitle') || FAMILY.title, lead: w('familyLead') || FAMILY.lead, intro: { title: I.title || '', lead: I.lead || '', guidelines: I.guidelines || [] },
      groups: [{ key: 'anytime', name: w('familyAnytime') || FAMILY.anytime, jobs: js.filter(j => j.type === 'anytime').map(famCard) }, { key: 'at-home', name: w('familyAtHome') || FAMILY.atHome, jobs: js.filter(j => j.type === 'at-home').map(famCard) }].filter(g => g.jobs.length) };
  }
  const jobForFamily = id => { const j = jobs().find(x => x && x.id === id); return forFamilyJob(j) ? j : null; };
  // the card behind a slot the director posted. The steps show before a family signs up only when she has chosen that.
  function slotCard(id, signed) {
    const j = jobs().find(x => x && x.id === id); if (!j) return null;
    const full = signed || !!(get(JOBS) || {}).stepsBefore; const c = famCard(j);
    return full ? Object.assign(c, { full: true }) : { id: c.id, title: c.title, where: c.where, time: c.time, who: c.who, supplies: c.supplies, full: false };
  }
  function saveJobs(fn) { const d = JSON.parse(JSON.stringify(get(JOBS) || { jobs: [] })); const r = fn(d); if (r && r.error) return r; put(JOBS, d); return null; }

  async function handle(P, body, me, req, res, { json, err }) {
    if (!sees(me)) { err(req, res, 403, 'The director and the office keep the volunteer jobs.'); return; }
    if (P === 'volunteer') { json(req, res, 200, view(me)); return; }
    if (!S.files.has(JOBS)) { err(req, res, 409, 'The job cards are still loading. Try again in a moment.'); return; }
    const dir = isDirector(me);
    const job = id => jobs().find(j => j && j.id === id);
    // a new card, with only its name to start. The editor opens on it for the rest.
    if (P === 'volunteer/add') {
      const title = txt(body.title, 160); if (!title) { err(req, res, 400, 'Give the job a name.'); return; }
      const gid = String(body.group || ''); const g = groups().find(x => x.id === gid);
      if (!g) { err(req, res, 400, 'Choose the group it belongs in.'); return; }
      if (gid === FUTURE && !dir) { err(req, res, 403, 'Future Ideas are the director\'s.'); return; }
      const ids = new Set(jobs().map(j => j.id)); let id = slug(title), n = 2; while (ids.has(id)) id = slug(title) + '-' + n++;
      saveJobs(d => { d.jobs.push({ id, group: gid, status: gid === FUTURE ? 'future' : 'active', type: START_TYPE[gid] || 'scheduled', title, where: '', time: '', who: '', supplies: [], directions: [], take_care: [], done_when: '', addedBy: me, addedAt: Date.now() }); });
      log('Volunteer job card added', id, 'by', me); json(req, res, 200, Object.assign(view(me), { added: id })); return;
    }
    // the job type, which decides where a card reaches families once the Family page shows them
    if (P === 'volunteer/type') {
      const j = job(String(body.id || '')); if (!j || (isFuture(j) && !dir)) { err(req, res, 404, 'That card is not here.'); return; }
      const type = String(body.type || ''); if (!TYPES.some(([k]) => k === type)) { err(req, res, 400, 'Choose a job type.'); return; }
      saveJobs(d => { const x = d.jobs.find(y => y.id === j.id); x.type = type; x.updatedAt = Date.now(); x.updatedBy = me; });
      json(req, res, 200, view(me)); return;
    }
    // moving a card into Future Ideas or back is the director's. A card going back chooses its group if it had none.
    if (P === 'volunteer/move') {
      if (!dir) { err(req, res, 403, 'The director moves cards into and out of Future Ideas.'); return; }
      const j = job(String(body.id || '')); if (!j) { err(req, res, 404, 'That card is not here.'); return; }
      const toFuture = body.to === 'future';
      let gid = j.group;
      if (!toFuture) { if (body.group) gid = String(body.group); if (gid === FUTURE || !groups().some(g => g.id === gid)) { err(req, res, 400, 'Choose the group it goes back to.'); return; } }
      saveJobs(d => { const x = d.jobs.find(y => y.id === j.id); x.status = toFuture ? 'future' : 'active'; x.group = gid; x.updatedAt = Date.now(); x.updatedBy = me; });
      log('Volunteer job card', j.id, toFuture ? 'moved to Future Ideas' : 'made active', 'by', me); json(req, res, 200, view(me)); return;
    }
    // the months a card fits best, which the Garden page and the library use to raise it at the right time of year
    if (P === 'volunteer/months') {
      const j = job(String(body.id || '')); if (!j || (isFuture(j) && !dir)) { err(req, res, 404, 'That card is not here.'); return; }
      const months = [...new Set((Array.isArray(body.months) ? body.months : []).map(String).filter(m => /^(0[1-9]|1[0-2])$/.test(m)))].sort();
      saveJobs(d => { const x = d.jobs.find(y => y.id === j.id); x.months = months; x.updatedAt = Date.now(); x.updatedBy = me; });
      json(req, res, 200, view(me)); return;
    }
    // whether families see a job's full steps before they sign up, the director's switch
    if (P === 'volunteer/settings') {
      if (!dir) { err(req, res, 403, 'The director sets this.'); return; }
      saveJobs(d => { d.stepsBefore = !!body.stepsBefore; }); json(req, res, 200, view(me)); return;
    }
    err(req, res, 404, 'That is not here.');
  }
  return { SPECS, mayEdit, once, handle, fromFile, pointPerson, TYPES, forFamily, jobForFamily, slotCard, paths: { JOBS, GROUPS, INTRO } };
};
