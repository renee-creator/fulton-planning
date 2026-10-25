'use strict';
/* The Garden and the yards, kept in the records beside the educator records, in staff/garden/setup.json for the plants,
   beds, year plan, animals, agreements and who tends what, and staff/garden/log.json for what happens, tasks done,
   harvests, compost, seeds, greenhouse trays, wildlife seen, plant photos and the year's carry forward.

   The director plans and changes everything. Educators read their Class's beds and the shared spaces and mark tasks
   done. The kitchen reads and records harvests. Families read only the garden agreements and the children's plant guide,
   on the Family page, once the director marks the Garden ready. The spaces are the Spaces list in Settings, never a
   second copy, so a bed names the space it sits in. Fulton uses no herbicides or pesticides, and nothing here suggests
   one. A Look, don't eat plant never appears as something children gather or taste. */
module.exports = function garden(o) {
  const { get, put, log, isDirector, isKitchen, nameKey, roomOf, today, addDays, mondayOf, staffNames } = o;
  const SETUP = 'staff/garden/setup.json', LOG = 'staff/garden/log.json';
  const setup = () => get(SETUP) || null;
  const glog = () => Object.assign({ done: [], harvests: [], preserves: [], compost: [], seeds: [], trays: [], wildlife: [], photos: [], offered: [], years: [] }, get(LOG) || {});
  const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const txt = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n || 300);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const USES = ['Food', 'Dye', 'Art materials', 'Pollinator', 'Look, don\'t eat'];
  const PRESERVE = ['dry', 'herbs', 'tea', 'freeze', 'pickle', 'salt', 'seed'];
  const STAGES = ['plan', 'plant', 'tend', 'harvest', 'preserve', 'seeds', 'compost', 'rest'];
  /* The garden year in four seasons, which organize the garden's work only and never belong on plans, threads or
     projects. Fall is September to November, winter December to February, spring March to May and summer June to
     August. Each season's own words, such as what we preserve and that season's gathering, are a page in the records,
     staff/library/garden/season-<season>.md, beside the monthly iGrow Sonoma summaries, the permaculture premises and
     preserving, which the director edits in place. */
  const SEASONS = [['fall', 'Fall', ['09', '10', '11']], ['winter', 'Winter', ['12', '01', '02']], ['spring', 'Spring', ['03', '04', '05']], ['summer', 'Summer', ['06', '07', '08']]];
  const seasonOf = mm => (SEASONS.find(x => x[2].includes(mm)) || SEASONS[0])[0];
  const WD = require('./wording.js');
  const LIB = 'staff/library/garden/';
  function library() { const out = {}; for (const p of (o.libraryPaths ? o.libraryPaths(LIB) : [])) { const m = p.match(/^staff\/library\/garden\/([a-z0-9-]+)\.md$/); if (m) out[m[1]] = Object.assign(WD.parse(o.getText(p)), { path: p }); } return out; }
  const WEEKDAYS = [1, 2, 3, 4, 5];
  // the Classes, from Program settings, the one list
  const ROOMS = () => (o.classrooms ? o.classrooms() : []);
  // words that suggest a chemical, which no task, tip or plan here may carry
  const CHEM = /\b(herbicides?|pesticides?|insecticides?|fungicides?|roundup|glyphosate|weed ?killer|bug ?spray|spray(ed|ing)? (for|with) (bugs|pests|weeds)|neem|copper spray|sevin|malathion|diazinon)\b/i;
  const clean = s => CHEM.test(String(s || '')) ? '' : s;
  const isFood = p => !!p && p.eat === 'food';

  /* ---------- who tends what ---------- */
  // a bed is tended by its home Class all year, or by the Classes and small groups a rotation names, turn by turn
  function tenderOf(s, bed, day) {
    if (!bed) return null; const home = (s.tending || {}).home || {};
    if (home[bed.id]) return { room: home[bed.id], group: '' };
    const rot = ((s.tending || {}).rotations || []).find(r => (r.beds || []).includes(bed.id));
    if (!rot || !(rot.who || []).length) return null;
    const startD = ISO.test(rot.start || '') ? rot.start : (day.slice(0, 4) + '-08-01');
    const span = rot.every === 'month' ? null : 7 * (rot.weeks || 1);
    let turn = 0;
    if (span) turn = Math.max(0, Math.floor((Date.parse(day) - Date.parse(startD)) / (span * 864e5)));
    else turn = Math.max(0, (+day.slice(0, 4) - +startD.slice(0, 4)) * 12 + (+day.slice(5, 7) - +startD.slice(5, 7)));
    const w = rot.who[turn % rot.who.length]; const [room, group] = String(w).split('|');
    return { room: room || '', group: group || '', rotation: rot.id };
  }
  const bedOf = (s, id) => (s.beds || []).find(b => b.id === id) || null;
  const plantOf = (s, id) => (s.plants || []).find(p => p.id === id) || null;

  /* ---------- the tasks for a day ---------- */
  // a month's tasks from the year plan, the repeating ones on their weekday, each plant's care that month, the animals'
  // daily and weekly care, and a greenhouse tray ready to plant out, each with its bed and whoever tends that bed
  function tasksFor(day, s) {
    s = s || setup(); if (!s) return [];
    const mm = day.slice(5, 7), dow = new Date(day + 'T12:00:00Z').getUTCDay(), L = glog(), out = [];
    const doneKey = (id, d) => L.done.find(x => x.task === id && x.day === d);
    const push = (t, key) => { const bed = bedOf(s, t.bed); const who = t.who || tenderOf(s, bed, day) || {}; const d = doneKey(t.id, key);
      out.push(Object.assign({}, t, { key, bedName: bed ? bed.name : t.bedName || '', room: who.room || t.room || '', group: who.group || '', done: d ? { by: d.by, at: d.at, room: d.room || '' } : null })); };
    for (const t of (((s.plan || {}).months || {})[mm] || {}).tasks || []) {
      if (!clean(t.text)) continue;
      if (t.repeat && t.repeat.weekday) { if (t.repeat.weekday === dow) push(Object.assign({ kind: 'repeat' }, t), day); continue; }
      push(Object.assign({ kind: 'month' }, t), day.slice(0, 7));
    }
    for (const p of s.plants || []) for (const c of p.care || []) if (c.month === mm && clean(c.text)) push({ id: 'care-' + p.id + '-' + mm + '-' + (c.id || ''), kind: 'care', text: c.text, stage: c.stage || 'tend', bed: p.bed, plant: p.id }, day.slice(0, 7));
    for (const a of s.animals || []) for (const c of a.care || []) {
      const every = c.every || 'day'; if (every === 'day' && !WEEKDAYS.includes(dow)) continue; if (every === 'week' && (c.weekday || 1) !== dow) continue;
      const who = tenderOf({ tending: { rotations: [Object.assign({ beds: ['animal-' + a.id] }, a.rotation || {})] } }, { id: 'animal-' + a.id }, day);
      push({ id: 'animal-' + a.id + '-' + c.id, kind: 'animal', text: c.text, stage: 'tend', animal: a.id, bedName: a.name, who: who || { room: '' } }, day);
    }
    for (const tr of L.trays) if (tr.ready && !tr.plantedOn && tr.bed) push({ id: 'tray-' + tr.id, kind: 'tray', text: `Plant out the ${tr.seedName || 'greenhouse'} starts`, stage: 'plant', bed: tr.bed }, day.slice(0, 7));
    return out;
  }
  // what one person sees, their Class's tasks and the shared ones not yet given to a Class, or every task for the director
  const mine = (list, me) => isDirector(me) || isKitchen(me) ? list : list.filter(t => !t.room || t.room === roomOf(me));

  /* ---------- what a reader receives ---------- */
  const forFamily = () => { const s = setup(); if (!s || !s.ready) return null;
    return { agreements: (s.agreements || {}).families || null, guiding: (s.agreements || {}).guiding || [], guide: (s.plants || []).filter(p => !p.hidden).map(p => ({ id: p.id, common: p.common, eat: p.eat, gather: !!p.gather, words: (p.words || {}).child || '', photo: ((glog().photos || []).find(x => x.plant === p.id && x.ok) || {}).id || '' })) }; };
  function view(me) {
    const s = setup(); if (!s) return null; const dir = isDirector(me), L = glog(), d = today();
    const out = { ready: !!s.ready, plants: s.plants || [], beds: s.beds || [], uses: USES, stages: STAGES, agreements: s.agreements || {}, animals: s.animals || [], plan: s.plan || {}, tending: s.tending || {}, sources: s.sources || [], mapPhoto: s.mapPhoto || '', mapSpots: s.mapSpots || {}, mapReady: !!s.mapReady, wanted: s.wantedSpaces || [],
      today: mine(tasksFor(d, s), me), week: [], harvests: L.harvests.slice(-60), preserves: (L.preserves || []).slice(-80), compost: L.compost.slice(-60), seeds: L.seeds, trays: L.trays, wildlife: L.wildlife, photos: L.photos.filter(x => x.ok), years: L.years, handwash: s.handwash || null };
    for (let i = 1; i <= 6; i++) { const day = addDays(d, i); const dow = new Date(day + 'T12:00:00Z').getUTCDay(); if (dow === 0 || dow === 6) continue; out.week.push({ day, tasks: mine(tasksFor(day, s), me).filter(t => t.kind === 'repeat' || t.kind === 'animal') }); }
    out.materials = materials(); out.seasons = SEASONS.map(([key, name, months]) => ({ key, name, months })); out.season = seasonOf(d.slice(5, 7)); out.library = library();
    if (dir) Object.assign(out, { offered: L.offered, note: s.note || '', evidence: evidence((+d.slice(5, 7) >= 8 ? +d.slice(0, 4) : +d.slice(0, 4) - 1) + '-08-01', d) });
    if (isKitchen(me)) { for (const k of ['seeds', 'trays', 'compost', 'wildlife', 'animals', 'plan', 'tending']) delete out[k]; }
    return out;
  }

  /* ---------- requests, through /api/staff/garden ---------- */
  async function handle(P, body, me, req, res, { json, err }) {
    const s = setup(); if (!s) { err(req, res, 404, 'The Garden is not in the records yet.'); return; }
    const dir = isDirector(me), kit = isKitchen(me);
    if (!dir && !s.ready) { err(req, res, 403, 'The Garden opens once the director marks it ready.'); return; }
    const saveS = next => { put(SETUP, Object.assign({}, s, next, { updatedAt: Date.now(), updatedBy: me })); };
    const saveL = fn => { const L = glog(); fn(L); put(LOG, Object.assign(L, { updatedAt: Date.now(), updatedBy: me })); };
    const back = () => json(req, res, 200, view(me));
    if (P === 'garden') return back();
    // marking a task done, one tap, keeps who did it and when
    if (P === 'garden/done') {
      if (kit) { err(req, res, 403, 'The kitchen records harvests.'); return; }
      const day = ISO.test(body.day || '') ? body.day : today(); const t = tasksFor(day, s).find(x => x.id === body.task); if (!t) { err(req, res, 404, 'That task is not here.'); return; }
      if (!dir && t.room && t.room !== roomOf(me)) { err(req, res, 403, 'That task belongs to another Class.'); return; }
      saveL(L => { const i = L.done.findIndex(x => x.task === t.id && x.day === t.key); if (body.undo) { if (i >= 0) L.done.splice(i, 1); }
        else if (i < 0) L.done.push({ task: t.id, day: t.key, by: me, at: Date.now(), room: t.room || roomOf(me) || '', group: t.group || txt(body.group, 40), stage: t.stage || '', text: t.text, bed: t.bed || '', kind: t.kind }); });
      return back();
    }
    // a harvest, from the kitchen, an educator or the director. A Look, don't eat plant is never harvested.
    if (P === 'garden/harvest') {
      const p = plantOf(s, body.plant); if (!p) { err(req, res, 400, 'Choose the plant.'); return; }
      if (!isFood(p)) { err(req, res, 400, `${p.common} is Look, don't eat, so it is never harvested for food.`); return; }
      const h = { id: rid('h'), plant: p.id, plantName: p.common, amount: txt(body.amount, 60), bed: bedOf(s, body.bed) ? body.bed : p.bed || '', date: ISO.test(body.date || '') ? body.date : today(), children: !!body.children, room: ROOMS().includes(body.room) ? body.room : '', by: me, at: Date.now() };
      saveL(L => { L.harvests.push(h); }); log('Garden harvest recorded by', me); return back();
    }
    // what we preserved from a harvest, by drying, herb drying and tea, freezing, quick refrigerator pickles, herb salt
    // or seed saving. We do not can for storage, so canning is never a way here.
    if (P === 'garden/preserve') {
      const h = (glog().harvests || []).find(x => x.id === body.harvest) || null; const p = plantOf(s, body.plant || (h && h.plant));
      if (!p && !txt(body.what, 80)) { err(req, res, 400, 'Choose the harvest or say what was preserved.'); return; }
      if (p && !isFood(p) && body.method !== 'seed') { err(req, res, 400, `${p.common} is Look, don't eat, so it is only ever saved as seed.`); return; }
      if (!PRESERVE.includes(body.method)) { err(req, res, 400, 'Choose how it was preserved.'); return; }
      const x = { id: rid('pv'), harvest: h ? h.id : '', plant: p ? p.id : '', what: txt(body.what, 80) || (p ? p.common : ''), method: body.method, note: txt(body.note, 200), date: ISO.test(body.date || '') ? body.date : today(), children: !!body.children, room: ROOMS().includes(body.room) ? body.room : '', by: me, at: Date.now() };
      saveL(L => { L.preserves = [...(L.preserves || []), x]; }); log('Garden preserving recorded by', me); return back();
    }
    if (P === 'garden/harvest/remove') { if (!dir) { err(req, res, 403, 'Only the director removes a harvest.'); return; } saveL(L => { L.harvests = L.harvests.filter(x => x.id !== body.id); }); return back(); }
    if (kit) { err(req, res, 403, 'The kitchen records harvests.'); return; }
    // a wildlife sighting, listed once by species with every sighting beneath it
    if (P === 'garden/wildlife') {
      const common = txt(body.common, 80), bot = txt(body.botanical, 80); if (!common) { err(req, res, 400, 'Name what you saw.'); return; }
      const link = /^https:\/\/(www\.)?(inaturalist\.org|merlin\.allaboutbirds\.org|ebird\.org|macaulaylibrary\.org)\//.test(body.link || '') ? String(body.link).slice(0, 300) : '';
      saveL(L => { let w = L.wildlife.find(x => nameKey(x.common) === nameKey(common)); if (!w) { w = { id: rid('w'), common, botanical: bot, plants: [], sightings: [] }; L.wildlife.push(w); } if (bot && !w.botanical) w.botanical = bot;
        w.sightings.push({ date: ISO.test(body.date || '') ? body.date : today(), where: txt(body.where, 80), room: ROOMS().includes(body.room) ? body.room : roomOf(me) || '', link, by: me, at: Date.now() }); });
      return back();
    }
    // a plant photo, kept only after the face check found no face, never showing children
    if (P === 'garden/photo') {
      const p = plantOf(s, body.plant); if (!p || !/^[a-z0-9-]+\.(jpe?g|png)$/i.test(body.id || '')) { err(req, res, 400, 'Choose the plant and the photo.'); return; }
      if (body.noFace !== true) { err(req, res, 400, 'A plant photo is kept only once the face check finds no face.'); return; }
      saveL(L => { L.photos.push({ id: body.id, plant: p.id, season: txt(body.season, 40), at: Date.now(), by: me, ok: true }); }); return back();
    }
    if (P === 'garden/compost') {
      const what = txt(body.what, 160); if (!what) { err(req, res, 400, 'Say what went in, or that it was turned or used.'); return; }
      saveL(L => { L.compost.push({ id: rid('c'), kind: ['in', 'turned', 'used'].includes(body.kind) ? body.kind : 'in', what, date: ISO.test(body.date || '') ? body.date : today(), by: me, at: Date.now() }); }); return back();
    }
    if (P === 'garden/tray') {
      saveL(L => { let t = L.trays.find(x => x.id === body.id); if (!t) { t = { id: rid('t'), sown: today(), by: me }; L.trays.push(t); }
        const seed = L.seeds.find(x => x.id === body.seed); if (seed) { t.seed = seed.id; t.seedName = seed.name; }
        for (const k of ['sown', 'plantedOn']) if (ISO.test(body[k] || '')) t[k] = body[k];
        if (body.up !== undefined) t.up = Math.max(0, Math.min(999, +body.up || 0)); if (body.ready !== undefined) t.ready = !!body.ready; if (bedOf(s, body.bed)) t.bed = body.bed; });
      return back();
    }
    if (!dir) { err(req, res, 403, 'Only the director changes the Garden.'); return; }
    if (P === 'garden/ready') { saveS({ ready: !!body.on }); return back(); }
    // the site map shows beyond the Garden, on sign-ups, plans, New Educator, the Family page and handouts, once ready
    if (P === 'garden/mapready') { saveS({ mapReady: !!body.on }); return back(); }
    if (P === 'garden/seed') {
      saveL(L => { let x = L.seeds.find(y => y.id === body.id); if (body.remove) { L.seeds = L.seeds.filter(y => y.id !== body.id); return; } if (!x) { x = { id: rid('s') }; L.seeds.push(x); }
        Object.assign(x, { name: txt(body.name, 80) || x.name || '', variety: txt(body.variety, 80), from: body.from === 'bought' ? 'bought' : 'saved', source: txt(body.source, 80), link: /^https:\/\//.test(body.link || '') ? String(body.link).slice(0, 300) : '', plant: plantOf(s, body.plant) ? body.plant : '', bed: bedOf(s, body.bed) ? body.bed : '', savedOn: ISO.test(body.savedOn || '') ? body.savedOn : '', left: txt(body.left, 60), stored: txt(body.stored, 80), months: (Array.isArray(body.months) ? body.months : []).filter(m => /^(0[1-9]|1[0-2])$/.test(m)), grow: !!body.grow }); });
      return back();
    }
    // a plant, a bed, an animal group, a task, the agreements, who tends what and the map, each set by the director
    if (P === 'garden/plant') {
      const list = [...(s.plants || [])]; let p = list.find(x => x.id === body.id); if (body.remove) { saveS({ plants: list.filter(x => x.id !== body.id) }); return back(); }
      if (!p) { p = { id: rid('p'), care: [] }; list.push(p); }
      const b = body.plant || {};
      if ('common' in b) p.common = txt(b.common, 80); if ('botanical' in b) p.botanical = txt(b.botanical, 120); if ('bed' in b) p.bed = bedOf(s, b.bed) ? b.bed : '';
      if (Array.isArray(b.uses)) p.uses = b.uses.filter(u => USES.includes(u)); if ('eat' in b) p.eat = b.eat === 'food' ? 'food' : 'look';
      if ('gather' in b) p.gather = !!b.gather; if ('permanent' in b) p.permanent = !!b.permanent;
      if (Array.isArray(b.ready)) p.ready = b.ready.filter(m => /^(0[1-9]|1[0-2])$/.test(m));
      if (b.words && typeof b.words === 'object') p.words = { child: txt(b.words.child, 400), adult: txt(b.words.adult, 1200) };
      if (Array.isArray(b.care)) p.care = b.care.filter(c => c && /^(0[1-9]|1[0-2])$/.test(c.month) && clean(c.text)).map(c => ({ id: c.id || rid('k'), month: c.month, text: txt(c.text, 160), stage: STAGES.includes(c.stage) ? c.stage : 'tend' }));
      if (Array.isArray(b.wildlife)) p.wildlife = b.wildlife.map(x => txt(x, 80)).filter(Boolean);
      if (p.eat !== 'food') p.uses = (p.uses || []).filter(u => u !== 'Food');
      saveS({ plants: list }); return back();
    }
    if (P === 'garden/bed') {
      const list = [...(s.beds || [])]; let b = list.find(x => x.id === body.id); if (body.remove) { saveS({ beds: list.filter(x => x.id !== body.id) }); return back(); }
      if (!b) { b = { id: rid('b'), history: [] }; list.push(b); }
      const v = body.bed || {}; if ('name' in v) b.name = txt(v.name, 80); if ('space' in v) b.space = txt(v.space, 60); if ('permanent' in v) b.permanent = !!v.permanent; if ('note' in v) b.note = txt(v.note, 300);
      if (v.planted && v.planted.what) b.history = [...(b.history || []), { what: txt(v.planted.what, 120), date: ISO.test(v.planted.date || '') ? v.planted.date : today(), by: me }];
      saveS({ beds: list }); return back();
    }
    if (P === 'garden/task') {
      const mm = String(body.month || ''); if (!/^(0[1-9]|1[0-2])$/.test(mm)) { err(req, res, 400, 'Choose the month.'); return; }
      const plan = JSON.parse(JSON.stringify(s.plan || { months: {} })); plan.months = plan.months || {}; const m = plan.months[mm] = plan.months[mm] || { tasks: [] };
      if (body.remove) m.tasks = m.tasks.filter(t => t.id !== body.id);
      else { const text = txt(body.text, 200); if (!text || !clean(text)) { err(req, res, 400, text ? 'We use no herbicides or pesticides, so that task cannot be added.' : 'Write the task.'); return; }
        let t = m.tasks.find(x => x.id === body.id); if (!t) { t = { id: rid('k') }; m.tasks.push(t); }
        Object.assign(t, { text, stage: STAGES.includes(body.stage) ? body.stage : 'tend', bed: bedOf(s, body.bed) ? body.bed : '', repeat: +body.weekday >= 1 && +body.weekday <= 5 ? { weekday: +body.weekday } : null }); }
      saveS({ plan }); return back();
    }
    if (P === 'garden/tending') {
      const t = { home: {}, rotations: [] };
      for (const [bed, room] of Object.entries((body.tending || {}).home || {})) if (bedOf(s, bed) && ROOMS().includes(room)) t.home[bed] = room;
      for (const r of ((body.tending || {}).rotations || [])) if (r && Array.isArray(r.beds)) t.rotations.push({ id: r.id || rid('r'), beds: r.beds.filter(b => bedOf(s, b)), who: (r.who || []).map(String).filter(w => ROOMS().includes(w.split('|')[0])).slice(0, 12), every: r.every === 'month' ? 'month' : 'week', weeks: Math.max(1, Math.min(8, +r.weeks || 1)), start: ISO.test(r.start || '') ? r.start : today() });
      saveS({ tending: t }); return back();
    }
    if (P === 'garden/animal') {
      const list = JSON.parse(JSON.stringify(s.animals || [])); let a = list.find(x => x.id === body.id); if (!a) { err(req, res, 404, 'That animal group is not here.'); return; }
      const v = body.animal || {}; if (Array.isArray(v.names)) a.names = v.names.map(x => txt(x, 40)).filter(Boolean).slice(0, 40);
      if (Array.isArray(v.care)) a.care = v.care.filter(c => c && txt(c.text, 120)).map(c => ({ id: c.id || rid('a'), text: txt(c.text, 120), every: c.every === 'week' ? 'week' : 'day', weekday: Math.max(1, Math.min(5, +c.weekday || 1)) }));
      if (v.rotation) a.rotation = { who: (v.rotation.who || []).map(String).filter(w => ROOMS().includes(w.split('|')[0])), every: v.rotation.every === 'month' ? 'month' : 'week', weeks: Math.max(1, Math.min(8, +v.rotation.weeks || 1)), start: ISO.test(v.rotation.start || '') ? v.rotation.start : today() };
      saveS({ animals: list }); return back();
    }
    if (P === 'garden/agreements') { const a = Object.assign({}, s.agreements || {}); for (const k of ['children', 'families']) if (body[k] && Array.isArray(body[k].items)) a[k] = Object.assign({}, a[k] || {}, { items: body[k].items.map(x => txt(x, 200)).filter(Boolean) }); saveS({ agreements: a }); return back(); }
    if (P === 'garden/map') { const spots = Object.assign({}, s.mapSpots || {}); if (body.space && body.x >= 0 && body.x <= 1 && body.y >= 0 && body.y <= 1) spots[String(body.space).slice(0, 60)] = { x: +body.x, y: +body.y }; const next = { mapSpots: spots }; if (/^[a-z0-9-]+\.(jpe?g|png)$/i.test(body.photo || '')) next.mapPhoto = body.photo; saveS(next); return back(); }
    if (P === 'garden/offer') { saveL(L => { L.offered.push({ id: rid('f'), date: ISO.test(body.date || '') ? body.date : today(), text: txt(body.text, 300), by: me, at: Date.now() }); }); return back(); }
    if (P === 'garden/offer/done') { saveL(L => { L.offered = L.offered.filter(x => x.id !== body.id); }); return back(); }
    // the end of a year carries the plan, the beds, the seeds saved and what worked into the next
    if (P === 'garden/carry') {
      const y = String(body.year || today().slice(0, 4)); const L = glog(); if (L.years.some(x => x.year === y)) { err(req, res, 409, 'That year is already carried forward.'); return; }
      saveL(L2 => { L2.years.push({ year: y, worked: txt(body.worked, 2000), plan: JSON.parse(JSON.stringify(s.plan || {})), beds: (s.beds || []).map(b => ({ id: b.id, name: b.name, history: b.history || [] })), seeds: L.seeds.filter(x => x.from === 'saved').map(x => ({ name: x.name, plant: x.plant, savedOn: x.savedOn })), at: Date.now(), by: me }); });
      return back();
    }
    err(req, res, 404, 'Not found');
  }

  /* ---------- for the rest of TREE ---------- */
  // possible Farm to School evidence, for the director's one-tap confirm list. Nothing counts until she confirms it.
  function evidence(from, to) {
    const s = setup(); if (!s || !s.ready) return []; const L = glog(); const out = [];
    for (const h of L.harvests) if (h.children && h.date >= from && h.date <= to) { const p = plantOf(s, h.plant); if (!isFood(p)) continue; out.push({ id: 'h-' + h.id, n: 5, date: h.date, text: `Children${h.room ? ' of ' + h.room + ' Class' : ''} gathered ${h.amount ? h.amount + ' of ' : ''}${h.plantName} from the garden.` }); }
    for (const d of L.done) { const day = String(d.day).length === 7 ? d.day + '-01' : d.day; if (!d.group || day < from || day > to || !['plant', 'harvest', 'tend', 'seeds'].includes(d.stage)) continue; if (!/water|plant|harvest|measur|sow|seed/i.test(d.text || '')) continue;
      out.push({ id: 'd-' + d.task + '-' + d.day, n: 7, date: day, text: `The ${d.group} small group${d.room ? ', ' + d.room + ' Class,' : ''} ${String(d.text || '').replace(/^./, c => c.toLowerCase()).replace(/\.$/, '')}.` }); }
    return out;
  }
  // the harvests for the Kitchen page, food only
  const harvestsFor = (from, to) => { const s = setup(); if (!s || !s.ready) return []; return glog().harvests.filter(h => h.date >= from && h.date <= to && isFood(plantOf(s, h.plant))).map(h => ({ date: h.date, plant: h.plantName, amount: h.amount, children: h.children, room: h.room })); };
  // the materials ready to gather this month for the Atelier, never food
  const materials = () => { const s = setup(); if (!s || !s.ready) return []; const mm = today().slice(5, 7);
    return (s.plants || []).filter(p => !isFood(p) && (p.uses || []).some(u => u === 'Dye' || u === 'Art materials') && (!(p.ready || []).length || p.ready.includes(mm))).map(p => p.common + ((p.uses || []).includes('Dye') ? ' for dye' : '')); };
  // the calendar's garden entries, the repeating tasks and the animals' care, for the reader's Class or for the director
  function calendar(from, to, me) {
    const s = setup(); if (!s || !s.ready || !me) return []; const name = typeof me === 'string' ? me : me.name || ''; const out = [];
    for (let d = from; d <= to; d = addDays(d, 1)) { const dow = new Date(d + 'T12:00:00Z').getUTCDay(); if (dow === 0 || dow === 6) continue;
      for (const t of mine(tasksFor(d, s), name)) if (t.kind === 'repeat' || t.kind === 'animal' || (t.kind === 'month' && d.slice(8) === '01'))
        out.push({ id: 'tgarden.' + t.id + '.' + d, cal: 'tgarden', title: 'Garden, ' + t.text + (t.room ? ', ' + t.room : ''), desc: (t.bedName ? t.bedName + '. ' : '') + 'Mark it done on the Garden page or Today.', allDay: true, start: d, end: d }); }
    return out;
  }
  // the site map's photo and where each space sits, one place for every page that shows it. Off until the director
  // marks it ready, and never anything but the map photo, the spaces and their names.
  const siteMap = (names, dir) => { const s = setup(); if (!s || !s.mapPhoto || (!dir && !s.mapReady)) return null;
    const pos = s.mapSpots || {}; return { ready: !!s.mapReady, photo: s.mapPhoto, spots: names.map(x => Object.assign({ id: x.id, name: x.name }, pos[x.id] ? { x: pos[x.id].x, y: pos[x.id].y } : {})) }; };
  return { handle, view, forFamily, siteMap, evidence, harvestsFor, materials, calendar, tasksFor, CHEM };
};
