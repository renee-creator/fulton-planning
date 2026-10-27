'use strict';
/* PD paths and assignments. A path is a named order of steps, each a PD module from the library or a part of the first
   weeks in staff/newed, such as Garden series or Serving Two-Year-Olds team. The director makes, copies, changes and
   removes paths, and assigns a path or a single module to people, to a whole class or both, with the way in for each
   module, an optional finish-by date and an optional note.

   First weeks is built in. It is read from staff/newed each time and never stored as a copy, and it reaches everyone in
   the New Educator section by itself, or the onboarding path the director chose when adding them. Changing its order
   rewrites the order line of each part, so the New Educator page shows the same order.

   Paths are kept in staff/pd/paths.json and assignments in staff/pd/assignments.json. Only the director creates, changes
   or assigns, and the server refuses it from anyone else. An educator receives only their own assignments, and only the
   steps they can already open, so a draft module stays hidden until it is marked ready. The kitchen and families never
   reach these requests. */
const crypto = require('crypto');

module.exports = function pathsModule(c) {
  const { get, put, log, isDirector, isKitchen, nameKey, staffNames, roomOf, classrooms, today, daysBetween, pidOf, profileOf, inNewEd, G, newedParts, newedFor, newedReady, newedOrder, goToName, reminders, S } = c;
  const PATHS = 'staff/pd/paths.json', ASSIGN = 'staff/pd/assignments.json', FIRST = 'firstweeks';
  const WAYS = ['own', 'meeting', 'pdday'];
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const rid = p => p + crypto.randomBytes(5).toString('hex');
  const txt = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n || 600);
  const longDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });

  /* ---------- the paths ---------- */
  const stored = () => ((get(PATHS) || {}).list || []).filter(p => p && p.id && p.id !== FIRST);
  // the parts of the first weeks in their own order, the welcome letter for the PD library left out
  const firstWeeks = () => ({ id: FIRST, title: 'First weeks', desc: 'The first-weeks sequence for every new educator, in order, as the New Educator page shows it.', onboarding: true, builtin: true,
    steps: newedParts().filter(p => p.place === 'newed').map(p => ({ kind: 'newed', slug: p.slug })) });
  const allPaths = () => [firstWeeks(), ...stored()];
  const pathOf = id => allPaths().find(p => p.id === id) || null;
  // the onboarding path a new educator receives, First weeks unless the director chose another onboarding path
  const onboardingOf = name => { const id = profileOf(name).onboarding; const p = id && pathOf(id); return p && p.onboarding ? p : firstWeeks(); };
  const onboardingId = id => { const p = id && pathOf(String(id)); return p && p.onboarding && p.id !== FIRST ? p.id : ''; };

  /* ---------- who can open each step ---------- */
  const partOf = slug => newedParts().find(p => p.slug === slug) || null;
  const expOf = n => !!profileOf(n).experienced;
  // a module opens once it is published, for someone the growth pages are open to. A part of the first weeks opens once it
  // is ready, and a part for experienced educators only for someone marked experienced.
  const canOpen = (n, s) => s.kind === 'module' ? !!G.modules()[s.slug] && (isDirector(n) || (G.published(s.slug) && G.allowed(n))) : newedFor(n, expOf(n)).some(p => p.slug === s.slug);
  const stepTitle = s => s.kind === 'module' ? ((G.modules()[s.slug] || {}).title || s.slug) : ((partOf(s.slug) || {}).title || s.slug);
  // a step the director sees with a chip, a draft module or part not visible to educators yet
  const waiting = s => s.kind === 'module' ? !!G.modules()[s.slug] && !G.published(s.slug) : !!(partOf(s.slug) || {}).draft && !newedReady(s.slug);
  const missing = s => s.kind === 'module' ? !G.modules()[s.slug] : !partOf(s.slug);
  const stepOut = s => ({ kind: s.kind, slug: s.slug, title: stepTitle(s), waiting: waiting(s), missing: missing(s) });

  /* ---------- assignments ---------- */
  const assignAll = () => ((get(ASSIGN) || {}).list || []).filter(a => a && a.id);
  // a person can be assigned PD when they have their own sign-in and are not the director or the kitchen
  const eligible = () => staffNames().filter(n => !isDirector(n) && !isKitchen(n));
  // a class means every current educator whose class is that class, read each time, so someone who joins it later has it too
  const classPeople = cls => eligible().filter(n => G.takesPart(n) && roomOf(n) === cls);
  function assignees(a) {
    const out = new Map();
    for (const n of eligible()) if ((a.people || []).some(x => nameKey(x) === nameKey(n))) out.set(nameKey(n), n);
    for (const cls of a.classes || []) for (const n of classPeople(cls)) out.set(nameKey(n), n);
    return [...out.values()].sort();
  }
  // the onboarding paths, given by themselves to everyone in the New Educator section
  function autoAssignments() {
    const by = new Map();
    for (const n of eligible()) { if (!inNewEd(n)) continue; const p = onboardingOf(n); if (!by.has(p.id)) by.set(p.id, []); by.get(p.id).push(n); }
    return [...by].map(([id, people]) => ({ id: 'auto-' + id, auto: true, kind: 'path', path: id, people, classes: [], ways: {}, due: '', note: '' }));
  }
  const targetOf = a => a.kind === 'module' ? { title: stepTitle({ kind: 'module', slug: a.slug }), desc: '', steps: [{ kind: 'module', slug: a.slug }] } : pathOf(a.path);
  const whoOf = a => a.auto ? a.people : assignees(a);
  const wayOf = (a, s) => WAYS.includes((a.ways || {})[s.slug]) ? a.ways[s.slug] : 'own';
  // one step for one person. A module step is done when their growth record holds the layer for the way in. A part of the
  // first weeks is done once they opened it.
  function stepState(n, a, s) {
    const g = G.growth(n);
    if (s.kind === 'module') { const m = (g.modules || {})[s.slug] || {}; const L = m.layers || {}; return { done: !!L[wayOf(a, s)], started: !!m.opened || Object.keys(L).length > 0 }; }
    const at = (g.newed || {})[s.slug]; return { done: !!at, started: !!at };
  }
  function progressOf(n, a) {
    const t = targetOf(a); const steps = ((t && t.steps) || []).filter(s => canOpen(n, s)); const st = steps.map(s => stepState(n, a, s));
    const state = steps.length && st.every(x => x.done) ? 'done' : st.some(x => x.done || x.started) ? 'progress' : 'none';
    return { name: n, room: roomOf(n), state, overdue: !!a.due && a.due < today() && state !== 'done', open: steps.length, done: st.filter(x => x.done).length };
  }
  // what the director sees of each assignment, everyone's progress included
  const forDirector = a => { const t = targetOf(a); return { id: a.id, auto: !!a.auto, kind: a.kind, path: a.path || '', slug: a.slug || '', title: t ? t.title : 'A path removed', people: (a.people || []).slice(), classes: (a.classes || []).slice(), due: a.due || '', note: a.note || '', at: a.at || 0, by: a.by || '',
    steps: ((t && t.steps) || []).map(s => Object.assign(stepOut(s), s.kind === 'module' ? { way: wayOf(a, s) } : {})), progress: whoOf(a).map(n => progressOf(n, a)) }; };
  // what one educator receives, their own assignments with the steps they can open, each with its way in and whether it is done
  function mine(n) {
    const out = [];
    for (const a of [...autoAssignments(), ...assignAll()]) {
      if (!whoOf(a).some(x => nameKey(x) === nameKey(n))) continue; const t = targetOf(a); if (!t) continue;
      const steps = t.steps.filter(s => canOpen(n, s)); if (!steps.length) continue;
      const pr = progressOf(n, a);
      out.push({ id: a.id, auto: !!a.auto, title: t.title, desc: t.desc || '', note: a.note || '', due: a.due || '', overdue: pr.overdue, state: pr.state,
        steps: steps.map(s => { const x = stepState(n, a, s); const p = s.kind === 'newed' ? partOf(s.slug) : null;
          return Object.assign({ kind: s.kind, slug: s.slug, title: stepTitle(s), done: x.done, started: x.started }, s.kind === 'module' ? { way: wayOf(a, s) } : { body: p ? p.body : '' }); }) });
    }
    return out;
  }

  /* ---------- the calendar and the reminder before a due date ---------- */
  // the calendar asks again once anything here changes
  let rev = 0;
  // each finish-by date shows on the TREE calendar, Check-ins and PD, for the director and for each person it is for,
  // until they finish. Nothing goes to Google.
  function calendar(from, to, me) {
    const name = typeof me === 'string' ? me : (me && me.name) || ''; if (!name || isKitchen(name)) return []; const dir = isDirector(name); const out = [];
    for (const a of assignAll()) { if (!ISO.test(a.due || '') || a.due < from || a.due > to) continue; const t = targetOf(a); if (!t) continue;
      if (dir) { const ps = whoOf(a).map(n => progressOf(n, a)); out.push({ id: 'tgrow.pdue.' + a.id, cal: 'tgrow', title: 'PD due, ' + t.title, desc: `${ps.filter(p => p.state === 'done').length} of ${ps.length} finished. The progress is in TREE, under Educators, PD library.`, allDay: true, start: a.due, end: a.due }); continue; }
      if (!whoOf(a).some(n => nameKey(n) === nameKey(name)) || !t.steps.some(s => canOpen(name, s)) || progressOf(name, a).state === 'done') continue;
      out.push({ id: 'tgrow.pdue.' + a.id, cal: 'tgrow', title: 'PD due, ' + t.title, desc: (a.note ? a.note + ' ' : '') + 'Open it in TREE, under Educators, PD library, Assigned to you.', allDay: true, start: a.due, end: a.due });
    }
    return out;
  }
  // three days before a finish-by date, each person not finished hears once, through TREE's own reminders
  const sentKey = 'staff/sent.json';
  const once = k => { const s = get(sentKey) || {}; if (s[k]) return false; put(sentKey, Object.assign({}, s, { [k]: today() })); return true; };
  let busy = false;
  async function tick() {
    if (busy || !S.ready || !reminders.keys()) return; busy = true;
    try {
      const hr = +new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }) % 24; if (hr < 8 || hr >= 11) return;
      for (const a of assignAll()) { if (!ISO.test(a.due || '') || daysBetween(today(), a.due) !== 3) continue; const t = targetOf(a); if (!t) continue;
        for (const n of whoOf(a)) { const p = progressOf(n, a); if (!p.open || p.state === 'done') continue; if (!once(`pdue|${a.id}|${pidOf(n)}|${a.due}`)) continue;
          await reminders.sendTo(n, { title: 'TREE, PD due in three days', body: `${t.title}, by ${longDay(a.due)}.${a.note ? ' ' + a.note.slice(0, 200) : ''}`, url: 'tree.html?go=pdlibrary', tag: 'tree-pdue' }); } }
    } catch (e) { log('PD due reminders failed,', e.message); } finally { busy = false; }
  }
  setInterval(tick, 5 * 60e3).unref(); setTimeout(tick, 30e3).unref();

  /* ---------- requests ---------- */
  const steps = list => { const out = []; for (const s of (Array.isArray(list) ? list : []).slice(0, 40)) { const kind = s && s.kind === 'newed' ? 'newed' : 'module', slug = String((s && s.slug) || '');
    if (kind === 'module' ? !G.modules()[slug] : !partOf(slug)) continue; if (!out.some(x => x.kind === kind && x.slug === slug)) out.push({ kind, slug }); } return out; };
  const directorView = () => ({ paths: allPaths().map(p => Object.assign({}, p, { steps: p.steps.map(stepOut), assigned: assignAll().filter(a => a.kind === 'path' && a.path === p.id).length })),
    assignments: [...autoAssignments(), ...assignAll()].map(forDirector),
    modules: Object.values(G.modules()).map(m => ({ slug: m.slug, title: m.title, waiting: !G.published(m.slug) })).sort((a, b) => a.title.localeCompare(b.title)),
    newed: newedParts().filter(p => p.place === 'newed').map(p => ({ slug: p.slug, title: p.title, waiting: waiting({ kind: 'newed', slug: p.slug }), audience: p.audience })),
    people: eligible().sort().map(n => ({ name: n, room: roomOf(n), educator: G.takesPart(n) })), classes: classrooms(), today: today() });

  async function handle(P, body, me, req, res, { json, err }) {
    const dir = isDirector(me); if (P !== 'paths' && P !== 'paths/mine') rev++;
    const deny = m => err(req, res, 403, m || 'Only the director makes and assigns paths.');
    // every person reads their own assignments, the director included
    if (P === 'paths/mine') { json(req, res, 200, { list: mine(me), goTo: goToName() || '' }); return; }
    // a part of the first weeks counts as done once it is opened
    if (P === 'paths/opened') {
      const slug = String(body.slug || ''); if (!canOpen(me, { kind: 'newed', slug })) return err(req, res, 404, 'That part is not here.');
      const g = G.growth(me); if (!(g.newed || {})[slug]) { g.newed = Object.assign({}, g.newed, { [slug]: today() }); put(G.gPath(me), g); }
      json(req, res, 200, { ok: true }); return;
    }
    if (!dir) return deny();
    if (P === 'paths') { json(req, res, 200, directorView()); return; }
    if (P === 'paths/save') {
      const b = body.path || {};
      // First weeks keeps its own parts. Its order is the order on the New Educator page.
      if (b.id === FIRST) { const cur = firstWeeks().steps.map(s => s.slug); const next = (Array.isArray(b.steps) ? b.steps : []).map(s => String((s && s.slug) || ''));
        if (next.length !== cur.length || cur.some(s => !next.includes(s))) return err(req, res, 400, 'First weeks keeps its own parts. Copy it to make a path with other steps.');
        newedOrder(next, me); log('First weeks order changed by', me); json(req, res, 200, directorView()); return; }
      const title = txt(b.title, 120).replace(/\s+/g, ' '); if (!title) return err(req, res, 400, 'Give the path a title.');
      const st = steps(b.steps); if (!st.length) return err(req, res, 400, 'Add at least one step.');
      const all = stored(); const was = b.id ? all.find(p => p.id === b.id) : null; if (b.id && !was) return err(req, res, 404, 'That path is not here.');
      const p = Object.assign({}, was || { id: rid('pa'), at: Date.now(), by: me }, { title, desc: txt(b.desc, 600), onboarding: !!b.onboarding, steps: st, updatedAt: Date.now(), updatedBy: me });
      put(PATHS, { list: was ? all.map(x => x.id === p.id ? p : x) : [...all, p] }); json(req, res, 200, Object.assign(directorView(), { id: p.id })); return;
    }
    if (P === 'paths/copy') {
      const src = pathOf(String(body.id || '')); if (!src) return err(req, res, 404, 'That path is not here.');
      const p = { id: rid('pa'), title: ('Copy of ' + src.title).slice(0, 120), desc: src.builtin ? '' : src.desc || '', onboarding: !!src.onboarding, steps: src.steps.map(s => ({ kind: s.kind, slug: s.slug })), at: Date.now(), by: me, from: src.id };
      put(PATHS, { list: [...stored(), p] }); json(req, res, 200, Object.assign(directorView(), { id: p.id })); return;
    }
    if (P === 'paths/remove') {
      const id = String(body.id || ''); if (id === FIRST) return err(req, res, 400, 'First weeks stays. It is the path every new educator receives.');
      if (!stored().some(p => p.id === id)) return err(req, res, 404, 'That path is not here.');
      put(PATHS, { list: stored().filter(p => p.id !== id) }); const keep = assignAll().filter(a => !(a.kind === 'path' && a.path === id)); if (keep.length !== assignAll().length) put(ASSIGN, { list: keep });
      log('PD path removed', id, 'by', me); json(req, res, 200, directorView()); return;
    }
    if (P === 'paths/assign') {
      const kind = body.kind === 'module' ? 'module' : 'path'; const id = String(body.id || ''), slug = String(body.slug || '');
      if (kind === 'path' ? !pathOf(id) : !G.modules()[slug]) return err(req, res, 400, 'Choose a path or a module.');
      const people = eligible().filter(n => (Array.isArray(body.people) ? body.people : []).some(x => nameKey(x) === nameKey(n)));
      const cls = classrooms().filter(r => (Array.isArray(body.classes) ? body.classes : []).includes(r));
      if (!people.length && !cls.length) return err(req, res, 400, 'Choose the people, a class or both.');
      if (body.due && !ISO.test(body.due)) return err(req, res, 400, 'Choose the finish-by date.');
      const t = kind === 'path' ? pathOf(id) : { steps: [{ kind: 'module', slug }] }; const ways = {};
      for (const s of t.steps) if (s.kind === 'module') ways[s.slug] = WAYS.includes((body.ways || {})[s.slug]) ? body.ways[s.slug] : 'own';
      const a = Object.assign({ id: rid('as'), kind }, kind === 'path' ? { path: id } : { slug }, { people, classes: cls, ways, due: body.due || '', note: txt(body.note, 600), at: Date.now(), by: me });
      put(ASSIGN, { list: [...assignAll(), a] }); log('PD assigned', kind === 'path' ? id : slug, 'by', me); json(req, res, 200, Object.assign(directorView(), { id: a.id })); return;
    }
    if (P === 'paths/unassign') {
      const id = String(body.id || ''); if (/^auto-/.test(id)) return err(req, res, 400, 'Every new educator receives their onboarding path by itself.');
      if (!assignAll().some(a => a.id === id)) return err(req, res, 404, 'That assignment is not here.');
      put(ASSIGN, { list: assignAll().filter(a => a.id !== id) }); json(req, res, 200, directorView()); return;
    }
    err(req, res, 404, 'Not found');
  }

  return { handle, calendar, tick, rev: () => rev, mine, onboardingId, onboardingOf, firstWeeks, FIRST };
};
