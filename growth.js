'use strict';
/* Educator growth at Fulton. The growth continuum and scores, the reflective journal, the monthly check-ins and their
   schedule, the self-assessment and the end of year evaluation, the Educator Reflection and Growth Plan, Proud Moments
   and Kudos, the PD library's modules and PD days with their agendas, readings and plus delta.

   Everything here is kept in the records under staff/, beside the records pages, and travels only through the
   /api/staff/g/ requests below. The server decides who receives each part. An educator's evaluation, journal and
   check-in notes are sent to that educator and the director and to no one else. The journal opens only with the
   reader's own TREE passcode, each time. The go-to person sees the pairing and the first weeks check-ins, never these.

   The director keeps all of it visible only to her until she turns it on for educators in Settings. Names, dates and
   the year's settings live in the records, never in this file, which anyone can read. */
const crypto = require('crypto');

module.exports = function growthModule(c) {
  const { get, put, S, log, person, profileOf, pPath, pidOf, staffNames, isDirector, isKitchen, nameKey, school, opened, today, addMonths, daysBetween,
    mondayOf, roomOf, pieces, checkPasscode, nameBlocked, calendarEvents, reminders, store, lensNow, isNewHire, inNewEd } = c;
  const isFormer = n => !!n && !!c.isFormerEducator && c.isFormerEducator(n);
  const DAY = 864e5;
  const rid = p => p + crypto.randomBytes(5).toString('hex');
  const txt = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, n || 4000);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;

  /* ---------- the eight areas, the four points and the modules ---------- */
  const AREAS = [['img', 'Image of the Child'], ['env', 'Environment as the Third Teacher (Aesthetics)'], ['lang', 'Role of the Teacher (Language and Affect)'],
    ['obs', 'Observation and Documentation'], ['cur', 'Curriculum Planning and Inquiry'], ['fam', 'Relationships with Families'],
    ['team', 'Team Collaboration and Community'], ['refl', 'Reflective Practice and Professional Growth']];
  const AREA_KEYS = AREAS.map(a => a[0]);
  const POINTS = ['Beginning', 'Developing', 'Established', 'Mentoring'];
  // the PD library's modules in the design's order. A module with its file in staff/pd/modules opens, the rest are still being written.
  const MODULE_LIST = [
    ['researcher', 'The Educator as Researcher', 'Our project cycle from informal observation to reflection, and writing plans that grow from observation.', ['cur', 'obs']],
    ['documentation', 'Documentation', 'Writing observations that separate noticing from wondering, and documentation that makes children\'s thinking visible.', ['obs']],
    ['language', 'The Language of Learning', 'Our language parameters and the Effective Responses guide, describing and narrating in place of praise.', ['lang']],
    ['beyond', 'Beyond Discipline', 'Relationship-based positive discipline, looking for the reason behind a behavior, and staying regulated so children can regulate.', ['lang', 'img']],
    ['families', 'The Home and School Partnership', 'Daily communication, conferences, and difficult conversations.', ['fam']],
    ['development', 'Developmental Deep Dive', 'Development in the Twos and Threes and in the Fours and Fives, in a mixed-age community.', ['img', 'cur']],
    ['spaces', 'Spaces That Teach', 'The outdoor classroom, the garden, the farm and the neighborhood as spaces that teach.', ['env']],
    ['meeting', 'The Art of the Meeting', 'Meeting time as a place for listening and making space for others\' words and bodies.', ['lang', 'team']],
    ['howto', 'TREE How To', 'Short guides for keeping observations, writing plans and making documentation.', ['obs']],
    ['licensing', 'Licensing at Fulton Community School', 'Each Title 22 requirement and our own procedures in short pieces for nap time, with the official trainings linked.', []]];
  const FEEDBACK = ['scores', 'continuum', 'narrative', 'conversation', 'notes'];
  const AUDIENCE = ['everyone', 'class', 'director'];

  const yearOf = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return String(m >= 8 ? y : y - 1); };
  const thisYear = () => yearOf(today());
  const gPath = n => `staff/growth/${pidOf(n)}.json`, jPath = n => `staff/journal/${pidOf(n)}.json`;
  const MOMENTS = 'staff/moments.json', MODS = 'staff/modules.json', READ = 'staff/readings.json', PDD = 'staff/pddays.json', CONT = 'staff/continuum.json';
  const blankG = name => ({ name, plans: {}, checkins: [], pre: {}, evals: {}, starting: null, modules: {} });
  const growth = name => Object.assign(blankG(name), get(gPath(name)) || {}, { name });

  /* ---------- who takes part ---------- */
  // every educator and apprentice takes part. The office and the kitchen have records pages only, and the director leads it.
  const roleOf = n => (profileOf(n).role || 'educator');
  // a shared sign-in, with no TREE sign-in of its own, has no growth pages
  const takesPart = n => !!n && !isDirector(n) && !isKitchen(n) && roleOf(n) !== 'staff' && staffNames().some(x => nameKey(x) === nameKey(n));
  const people = () => staffNames().filter(takesPart).sort();
  const canSee = (me, who) => isDirector(me) || nameKey(me) === nameKey(who);
  function allowed(me) { if (isDirector(me)) return true; if (!takesPart(me)) return false; if (isNewHire(me)) return !!opened().growth && !!opened().newed; return !!opened().growth; }
  const lighter = n => !!profileOf(n).lighter;

  /* ---------- the continuum, one set of words for each school year, edited by the director after the August PD day ---------- */
  function continuum(year) {
    const all = (get(CONT) || {}).years || {}; const ys = Object.keys(all).sort();
    const y = all[year] ? year : ys.filter(k => k <= year).pop() || ys[ys.length - 1];
    return y ? Object.assign({ year: y }, all[y]) : null;
  }

  /* ---------- the PD library's modules, one Markdown file each, as written ---------- */
  let modCache = null;
  function modules() {
    if (modCache) return modCache;
    const pre = 'staff/pd/modules/'; const out = {};
    for (const p of [...S.files.keys()].filter(p => p.startsWith(pre) && /\.md$/.test(p)).sort()) {
      let text = (S.files.get(p) || {}).text || ''; const meta = {}; const m = text.match(/^\s*<!--([\s\S]*?)-->/);
      if (m) { for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i); if (kv) meta[kv[1].toLowerCase()] = kv[2]; } text = text.slice(m[0].length); }
      const slug = p.slice(pre.length).replace(/^\d+-/, '').replace(/\.md$/, '');
      const t = text.match(/^#\s+(.+)$/m); if (!t) continue;
      const parts = text.slice(t.index + t[0].length).split(/^##\s+/m);
      const lead = parts.shift().split('\n').map(s => s.trim()).filter(Boolean);
      const sections = parts.map(s => { const i = s.indexOf('\n'); return { heading: s.slice(0, i).trim(), body: s.slice(i + 1).trim() }; });
      // an adapted module written as a draft says status draft, and waits for the director to mark it ready. Its source
      // note, its library description and its place in the list come from the same comment, so no new title is in this file
      out[slug] = { slug, title: t[1].trim(), lead, minutes: Number(meta.minutes) || 0, serves: String(meta.serves || '').split(',').map(s => s.trim()).filter(Boolean), sections,
        draft: /^draft$/i.test(meta.status || ''), source: meta.source || '', desc: meta.desc || '', order: Number(meta.order) || 0, sources: (meta.folds || '').split(';').map(s => s.trim()).filter(Boolean) };
    }
    modCache = out; return out;
  }
  const READY = 'staff/pd/ready.json';
  // the readings library, the shared list and the library added since in its own file, which waits for the director
  const LIB = 'staff/readings-library.json';
  const libReady = () => !!((get(READY) || {}).library);
  // Session 12 made one list, staff/readings.json. An entry with a citation or a kind is a library entry, a book or an
  // article, and still waits for the director's Ready, as the library did when it was its own file.
  const isLibEntry = x => !!x && (!!x.cite || x.kind === 'book' || x.kind === 'article');
  const readingsFor = me => { const dir = isDirector(me); const all = (get(READ) || {}).list || [];
    const base = all.filter(x => x && !isLibEntry(x));
    const lib = [...all.filter(isLibEntry), ...((get(LIB) || {}).list || [])]; const on = libReady();
    const more = dir || on ? lib.filter(x => x && x.id && x.title).map(x => { const o = Object.assign({}, x, { library: true, kind: x.kind === 'article' ? 'article' : 'book', onSite: !!x.onSite }); if (dir) o.waiting = !on; else delete o.check; return o; }) : [];
    return [...base, ...more.filter(x => !base.some(b => b.url && b.url === x.url))]; };
  // the file that holds a library entry, the one list or the library file kept before it
  const libFile = id => { const r = (get(READ) || {}).list || []; return r.some(y => y && y.id === id && isLibEntry(y)) ? READ : LIB; };
  const hasLib = () => !!get(LIB) || ((get(READ) || {}).list || []).some(isLibEntry);
  const readyOn = slug => !!(((get(READY) || {}).modules || {})[slug]);
  const published = slug => { const m = modules()[slug]; return !!m && (!m.draft || readyOn(slug)); };
  // what a reader receives. The director sees every module, drafts marked, with the source note. Others see published ones only.
  const modulesFor = me => { const dir = isDirector(me); const out = {};
    for (const [k, m] of Object.entries(modules())) { if (dir) out[k] = Object.assign({}, m, { waiting: m.draft && !readyOn(k) }); else if (published(k)) { const c = Object.assign({}, m); delete c.source; delete c.sources; delete c.draft; out[k] = c; } }
    return out; };
  // the library's list, the design's modules in order, then modules written since, in their own order
  const libraryList = me => { const dir = isDirector(me); const m = modules();
    const base = MODULE_LIST.map(([k, t, d, a]) => ({ slug: k, title: m[k] && (dir || published(k)) ? m[k].title : t, desc: m[k] && m[k].desc && (dir || published(k)) ? m[k].desc : d, areas: a, ready: k === 'licensing' || k === 'howto' || (dir ? !!m[k] : published(k)), waiting: !!(dir && m[k] && m[k].draft && !readyOn(k)), minutes: (m[k] || {}).minutes || 0 }));
    const more = Object.values(m).filter(x => !MODULE_LIST.some(l => l[0] === x.slug) && (dir || published(x.slug))).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .map(x => ({ slug: x.slug, title: x.title, desc: x.desc, areas: x.serves, ready: true, waiting: !!(dir && x.draft && !readyOn(x.slug)), minutes: x.minutes }));
    return [...base, ...more]; };
  // a published module's own title, as the director last wrote it, then the list's
  const moduleTitle = slug => (published(slug) && (modules()[slug] || {}).title) || (MODULE_LIST.find(m => m[0] === slug) || [])[1] || (modules()[slug] || {}).title || slug;
  const moduleFor = area => { const m = modules(); const ready = MODULE_LIST.filter(x => published(x[0]) && x[3].includes(area)); return ready.length ? ready[0][0] : ''; };

  /* ---------- check-in schedule ---------- */
  // school closures from the calendar's all-day events, the same words the kitchen reads to leave a day empty
  const CLOSED = /no school|closed|closure|holiday|break|in.?service|staff development|thanksgiving/i;
  const PD_RE = /\bP\.?D\.?\b|professional development|staff development|in.?service/i;
  const MEET_RE = /staff meeting/i;
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const hhmm = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const cal = { months: new Map(), events: new Map(), at: 0, loading: new Set() };
  async function loadMonth(ym, force) {
    const hit = cal.months.get(ym); if (hit && !force && Date.now() - hit.at < 30 * 60e3) return hit;
    const from = addDays(ym + '-01', -14), last = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);
    let ev = []; try { ev = (await calendarEvents(from, last)).events || []; } catch (e) { log('Calendar could not be read for check-ins', e.message); }
    const closed = new Set(), pd = [];
    for (const e of ev) {
      const s = String(e.start || '').slice(0, 10), en = String(e.end || e.start || '').slice(0, 10); if (!ISO.test(s)) continue;
      if (e.allDay !== false && CLOSED.test(e.title || '')) for (let d = s; d && d <= en; d = addDays(d, 1)) closed.add(d);
      if (String(e.id || '').startsWith('tgrow.')) continue;
      if (PD_RE.test(e.title || '') || MEET_RE.test(e.title || '')) pd.push({ date: s, kind: MEET_RE.test(e.title || '') && !PD_RE.test(e.title || '') ? 'meeting' : 'pdday', title: e.title || '', start: e.allDay === false ? String(e.start).slice(11, 16) : '', end: e.allDay === false ? String(e.end).slice(11, 16) : '' });
    }
    const out = { ym, closed, pd, at: Date.now() }; cal.months.set(ym, out); return out;
  }
  // a Monday is open when the school is open that day and it is not the Monday after a long break, three or more school days closed
  function openMonday(d, closed) {
    if (dow(d) !== 1 || closed.has(d)) return false;
    let shut = 0; for (let i = 1; i <= 5; i++) { const x = addDays(d, -i - 2); if (closed.has(x)) shut++; }
    return shut < 3;
  }
  function nextOpenMonday(d, closed) { for (let i = 0; i < 6; i++) { const x = addDays(d, i * 7); if (openMonday(x, closed)) return x; } return d; }
  function scheduleFor(ym) {
    const mon = cal.months.get(ym); if (!mon) return null;
    const sc = Object.assign({ week: 1, secondTime: '13:00', minutes: 20 }, school().checkin || {});
    let first = ym + '-01'; while (dow(first) !== 1) first = addDays(first, 1);
    const target = addDays(first, 7 * Math.max(0, Math.min(3, (+sc.week || 1) - 1)));
    const day1 = nextOpenMonday(target, mon.closed); const day2 = nextOpenMonday(addDays(day1, 7), mon.closed);
    const k = +ym.slice(0, 4) * 12 + +ym.slice(5, 7);
    const list = []; const ps = people();
    const slots = new Map();
    for (const n of ps) { const pr = profileOf(n); const mode = pr.checkin || (pr.planHour ? 'slot' : 'asneeded'); if (mode === 'slot' && pr.planHour) { if (!slots.has(pr.planHour)) slots.set(pr.planHour, []); slots.get(pr.planHour).push(n); } }
    for (const [hr, ns] of [...slots].sort()) {
      // one from each Class steps off, and the order rotates from month to month so the same person is never always last
      const sorted = ns.sort((a, b) => ROOMS().indexOf(roomOf(a)) - ROOMS().indexOf(roomOf(b)) || a.localeCompare(b));
      const r = k % sorted.length; const order = sorted.slice(r).concat(sorted.slice(0, r));
      order.forEach((n, i) => list.push({ name: n, date: day1, time: hhmm(toMin(hr) + i * (+sc.minutes || 20)), minutes: +sc.minutes || 20, kind: 'slot' }));
    }
    const second = ps.filter(n => (profileOf(n).checkin || '') === 'second').sort();
    if (second.length) { const r = k % second.length; second.slice(r).concat(second.slice(0, r)).forEach((n, i) => list.push({ name: n, date: day2, time: sc.secondTime ? hhmm(toMin(sc.secondTime) + i * (+sc.minutes || 20)) : '', minutes: +sc.minutes || 20, kind: 'second' })); }
    // a check-in set by hand, for someone met as needed or a moved conversation, is kept on the educator's record
    for (const n of ps) for (const x of (growth(n).booked || [])) if (x.date && x.date.slice(0, 7) === ym) list.push({ name: n, date: x.date, time: x.time || '', minutes: +sc.minutes || 20, kind: 'booked', id: x.id });
    return { ym, day1, day2, list: list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), moved: target !== day1 ? target : '' };
  }
  async function schedule(ym) { await loadMonth(ym); return scheduleFor(ym); }

  /* ---------- the calendar's entries from here, check-ins and PD days set in TREE ---------- */
  let rev = 0; const bump = () => { rev++; };
  function calendarExtra(from, to, me) {
    const out = []; if (!me) return out; const name = typeof me === 'string' ? me : me.name || ''; const dir = !!name && isDirector(name);
    // a month not read yet is read now, and shows the next time the calendar asks
    for (let d = from.slice(0, 7) + '-01'; d <= to; d = addMonths(d, 1)) { const ym = d.slice(0, 7); if (!cal.months.has(ym) && !cal.loading.has(ym)) { cal.loading.add(ym); loadMonth(ym).then(bump, () => {}).finally(() => cal.loading.delete(ym)); } }
    for (const [ym] of cal.months) { const s = scheduleFor(ym); if (!s) continue;
      for (const x of s.list) { if (x.date < from || x.date > to) continue; if (!name || (!dir && nameKey(x.name) !== nameKey(name))) continue; if (!dir && !allowed(name)) continue;
        out.push(Object.assign({ id: `tgrow.ci.${pidOf(x.name)}.${x.date}`, cal: 'tgrow', title: dir ? `Check-in, ${x.name}` : 'Check-in with the director', desc: dir ? 'Monthly check-in, about twenty minutes' : 'Your monthly check-in, about twenty minutes. Nothing needs to be prepared.' },
          x.time ? { allDay: false, start: x.date + 'T' + x.time, end: x.date + 'T' + hhmm(toMin(x.time) + x.minutes) } : { allDay: true, start: x.date, end: x.date })); } }
    // the monthly PD staff meeting on its first Monday, or the day the director chose, for everyone, and each Class's team
    // meetings for the director and that Class's educators
    for (const [ym] of cal.months) {
      const all = allStaffDay(ym); const [ms, me2] = meetTimes();
      if (all.kind === 'meeting' && all.auto && all.date && all.date >= from && all.date <= to && !((get(PDD) || {}).manual || []).some(m => m.date === all.date && m.kind === 'meeting'))
        out.push({ id: 'tgrow.pdm.' + all.date, cal: 'tgrow', title: 'PD staff meeting', desc: (all.moved ? 'The whole staff and PD meeting, moved to this day.' : 'The whole staff and PD meeting, the first Monday of the month.') + ' The agenda is in TREE, under Educators, PD days.', agenda: all.date, allDay: false, start: all.date + 'T' + ms, end: all.date + 'T' + me2 });
      const last = addDays(addMonths(ym + '-01', 1).slice(0, 7) + '-01', -1);
      for (const d of teamDays(ym + '-01' > from ? ym + '-01' : from, last < to ? last : to)) for (const room of roomsFor(name)) {
        const [ts, te] = teamTimes(room);
        out.push(Object.assign({ id: `tgrow.tm.${room}.${d}`, cal: 'tgrow', title: room + ' Class team meeting', desc: 'For the ' + room + ' Class team. The agenda is in TREE, under Educators, PD days.', agenda: teamId(d, room) },
          ts ? { allDay: false, start: d + 'T' + ts, end: d + 'T' + (te || hhmm(toMin(ts) + 60)) } : { allDay: true, start: d, end: d }));
      }
    }
    for (const m of ((get(PDD) || {}).manual || [])) { if (m.date < from || m.date > to) continue;
      out.push(Object.assign({ id: 'tgrow.pd.' + m.id, cal: 'tgrow', title: m.title || (m.kind === 'meeting' ? 'PD staff meeting' : 'PD day'), desc: 'The agenda is in TREE, under Educators, PD days.', agenda: m.date }, m.start ? { allDay: false, start: m.date + 'T' + m.start, end: m.date + 'T' + (m.end || m.start) } : { allDay: true, start: m.date, end: m.date })); }
    return out;
  }

  // the Reflection part of the Growth Plan, the August form's other answers
  const REFLECTION = ['difficult', 'proud', 'natural', 'drains', 'pattern', 'why'];

  /* ---------- what an educator receives of their own growth ---------- */
  function forViewer(name, me) {
    const g = growth(name), dir = isDirector(me), y = thisYear(); const out = JSON.parse(JSON.stringify(g));
    // what they led, from Presenting entries marked presented
    out.led = c.ledBy ? c.ledBy(name) : [];
    out.profile = { role: roleOf(name), room: roomOf(name), lighter: lighter(name), curriculumFrom: profileOf(name).curriculumFrom || '', startDate: profileOf(name).startDate || '', partTime: !!profileOf(name).partTime, journalEvery: +profileOf(name).journalEvery || 1, checkin: profileOf(name).checkin || '' };
    if (dir) {
      out.trend = (g.checkins || []).filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date)).map(x => ({ date: x.date, self: (x.temp || {}).self || 0, dir: (x.temp || {}).dir || 0, align: (x.align || {}).rating || 0, effect: x.effect || 0 }));
      return out;
    }
    // the educator sees only the Focus Until Next Time and follow-up notes from each check-in
    out.checkins = (g.checkins || []).map(x => ({ id: x.id, date: x.date, focus: x.focus ? { settled: x.focus.settled || '', area: x.focus.area || '', module: x.focus.module || '', mine: x.focus.mine || '' } : null, followup: x.followup || '', followed: x.followed || null }));
    delete out.booked;
    // the director's placements are first seen during the meeting, side by side
    for (const [yr, ev] of Object.entries(out.evals || {})) { if (yr === y && !(ev.meeting && ev.meeting.at)) { delete ev.dir; } }
    if (out.starting && !out.starting.shared) { out.starting = { scheduled: out.starting.scheduled || '' }; }
    return out;
  }

  /* ---------- the journal, opened with the reader's own passcode each time ---------- */
  const keys = new Map();
  function openKey(me, who) { const k = crypto.randomBytes(18).toString('hex'); keys.set(k, { me: nameKey(me), who: nameKey(who), until: Date.now() + 30 * 60e3 }); for (const [x, v] of keys) if (v.until < Date.now()) keys.delete(x); return k; }
  const keyOk = (k, me, who) => { const v = keys.get(String(k || '')); return !!v && v.until > Date.now() && v.me === nameKey(me) && v.who === nameKey(who); };
  // the period a journal entry belongs to, a week, or two weeks for those who write every other week
  function periodOf(name, iso) {
    const every = +profileOf(name).journalEvery === 2 ? 2 : 1; const mon = mondayOf(iso);
    if (every === 1) return { start: mon, end: addDays(mon, 6), every };
    const y = yearOf(iso); let anchor = mondayOf(y + '-08-01'); const k = Math.floor(daysBetween(anchor, mon) / 14);
    const start = addDays(anchor, k * 14); return { start, end: addDays(start, 13), every };
  }
  const journal = name => Object.assign({ entries: [] }, get(jPath(name)) || {});
  const wroteIn = (name, p) => journal(name).entries.some(e => e.date >= p.start && e.date <= p.end);

  /* ---------- Proud Moments and Kudos, each seen by the audience chosen for it ---------- */
  const momentsAll = () => ((get(MOMENTS) || {}).list || []);
  // a moment by or for an educator who has left Fulton moves with their records to Former educators
  const momentsOf = name => momentsAll().filter(m => nameKey(m.by) === nameKey(name) || (m.to && nameKey(m.to) === nameKey(name)));
  const momentsNow = () => momentsAll().filter(m => !isFormer(m.by) && !(m.to && isFormer(m.to)));
  function seesMoment(me, m) {
    if (isDirector(me)) return true; if (nameKey(m.by) === nameKey(me) || (m.to && nameKey(m.to) === nameKey(me))) return true;
    if (!allowed(me)) return false;
    if (m.audience === 'everyone') return true;
    if (m.audience === 'class') return !!m.room && m.room === roomOf(me);
    return false;
  }

  /* ---------- PD days ---------- */
  const pdd = () => Object.assign({ agendas: {}, manual: [] }, get(PDD) || {});
  async function pdDates(fromIso, toIso) {
    const out = new Map(); const ms = []; for (let d = fromIso.slice(0, 7) + '-01'; d <= toIso; d = addDays(addMonths(d, 1).slice(0, 7) + '-01', 0)) ms.push(d.slice(0, 7));
    for (const ym of ms) { const mo = await loadMonth(ym); for (const p of mo.pd) if (p.date >= fromIso && p.date <= toIso) { const id = p.date + '-' + p.kind; if (!out.has(id)) out.set(id, Object.assign({ id, from: 'calendar' }, p)); } }
    for (const m of pdd().manual) if (m.date >= fromIso && m.date <= toIso) { const id = m.date + '-' + m.kind; out.set(id, Object.assign({ from: 'tree' }, m, { id, manualId: m.id })); }
    // one all-staff meeting a month. A weekly staff meeting on the school's calendar is not a PD staff meeting, and an
    // agenda kept for one still shows to the director. A meeting the director adds in TREE always shows.
    for (const ym of ms) { const all = allStaffDay(ym);
      for (const [id, x] of [...out]) if (x.kind === 'meeting' && !x.manualId && x.date.slice(0, 7) === ym && x.date !== all.date) out.delete(id);
      if (all.kind === 'meeting' && all.date && all.date >= fromIso && all.date <= toIso && !out.has(all.date + '-meeting')) { const [st, en] = meetTimes(); out.set(all.date + '-meeting', { id: all.date + '-meeting', date: all.date, kind: 'meeting', from: 'tree', auto: true, title: 'PD staff meeting', start: st, end: en }); } }
    return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  /* Mondays. The whole staff and PD meeting is the first Monday of each month. In any month with a full-day PD day on the
     calendar, the PD day is that month's all-staff meeting, no first Monday meeting is held, and that Monday is a team
     meeting day. December and February have no all-staff meeting unless they have a PD day, and nor does any month the
     director marks. When the first Monday is a school closure, the director's Today asks once for another day. The
     director can move any month's meeting to another day, and the agenda, the reminders and Today follow it. Each Class
     team meets on every other open Monday, never on the all-staff meeting's day. Check-ins are unchanged. */
  // the Classes, from Program settings, the one list
  const ROOMS = () => (c.classrooms ? c.classrooms() : []);
  const quietMonth = ym => ['12', '02'].includes(ym.slice(5, 7)) || ((school().quietMonths || []).includes(ym));
  const firstMonday = ym => { let d = ym + '-01'; while (dow(d) !== 1) d = addDays(d, 1); return d; };
  function allStaffDay(ym) {
    const mo = cal.months.get(ym); if (!mo) return { date: '', kind: '' };
    // the director's own choice for the month comes first, a day she moved the meeting to or no meeting at all
    const moved = (pdd().moved || {})[ym]; if (moved === 'none') return { date: '', kind: '' }; if (moved) return { date: moved, kind: 'meeting', auto: true, moved: true };
    // a full-day PD day, one with no start time, on the calendar or added in TREE
    const pd = mo.pd.find(x => x.kind === 'pdday' && !x.start) || pdd().manual.find(x => x.kind === 'pdday' && x.date.slice(0, 7) === ym);
    if (pd) return { date: pd.date, kind: 'pdday' };
    if (quietMonth(ym)) return { date: '', kind: '' };
    const set = pdd().manual.find(x => x.kind === 'meeting' && x.date.slice(0, 7) === ym); if (set) return { date: set.date, kind: 'meeting' };
    const fm = firstMonday(ym); const onCal = mo.pd.find(x => x.kind === 'meeting' && x.date === fm) || mo.pd.find(x => x.kind === 'meeting');
    if (mo.closed.has(fm)) return onCal && !mo.closed.has(onCal.date) ? { date: onCal.date, kind: 'meeting' } : { date: '', kind: 'meeting', needsDate: true, firstMonday: fm };
    return { date: fm, kind: 'meeting', auto: !onCal || onCal.date !== fm };
  }
  const meetTimes = () => [(school().meeting || {}).start || '13:15', (school().meeting || {}).end || '14:30'];
  const teamTimes = room => { const t = (school().teamMeetings || {})[room] || {}; return [t.start || '', t.end || '']; };
  // every team meeting of a Class in a stretch of days, open Mondays other than the all-staff meeting's
  function teamDays(fromIso, toIso) {
    const out = [];
    for (let d = fromIso; d <= toIso; d = addDays(d, 1)) { if (dow(d) !== 1) continue; const ym = d.slice(0, 7); const mo = cal.months.get(ym); if (!mo || mo.closed.has(d)) continue;
      const all = allStaffDay(ym); if (all.date === d) continue; out.push(d); }
    return out;
  }
  const teamId = (date, room) => date + '-team-' + room;
  // the director sees every Class's team meetings, and an educator who takes part, past their first weeks, their own
  const roomsFor = me => isDirector(me) ? ROOMS().slice() : takesPart(me) && !isNewHire(me) ? ROOMS().filter(r => r === roomOf(me)) : [];
  // the next steps from a Class's team meetings not yet marked done, carried to its next team meeting
  function openSteps(room, beforeDate) {
    const out = []; for (const a of Object.values(pdd().agendas)) if (a.kind === 'team' && a.room === room && a.date < beforeDate) for (const st of a.steps || []) if (!st.done) out.push(Object.assign({ from: a.id, fromDate: a.date }, st));
    return out.sort((x, y) => x.fromDate.localeCompare(y.fromDate));
  }
  function teamItem(date, room) { const a = pdd().agendas[teamId(date, room)] || null; const [st, en] = teamTimes(room);
    return { id: teamId(date, room), date, kind: 'team', room, title: room + ' Class team meeting', start: (a && a.start) || st, end: (a && a.end) || en, agenda: a ? withPres(a, '') : null, carried: openSteps(room, date) }; }
  // a team meeting's agenda starts from the Class's own week, and the team removes or adds what it wants
  function teamStart(room, date) {
    const live = k => [...(store.recs[k] || new Map()).values()].filter(r => r && !r.deleted && r.doc).map(r => r.doc);
    const mon = mondayOf(date), last = addDays(mon, -7); const blocks = []; const id = () => rid('k');
    const plans = live('plans').filter(x => x.classroom === room && (x.weekOf === mon || x.weekOf === last) && !['ready', 'reviewed'].includes(x.status) && x.type !== 'notice');
    // each kind of plan named once with how many, and each list ends its sentences once
    const longDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
    const sentences = a => a.map(x => String(x).trim().replace(/[.?!]?$/, m => m || '.')).join(' ');
    if (plans.length) { const n = new Map(); for (const x of plans) { const k = (x.type === 'classroom' ? 'The Classroom plan' : (x.educator || 'An educator') + "'s " + (x.type === 'individual' ? 'Individual' : 'Small Group') + ' plan') + ', week of ' + longDay(x.weekOf); n.set(k, (n.get(k) || 0) + 1); }
      blocks.push({ id: id(), title: 'Plans waiting to be finished', why: sentences([...n].map(([k, c]) => c > 1 ? k.replace(' plan,', ' plans (' + c + '),') : k)) }); }
    const threads = live('threads').filter(t => t.classroom === room && !t.unfollowed && !['closed', 'resting'].includes(t.status));
    const projects = live('projects').filter(x => x.status !== 'closed' && (x.home === room || (x.classrooms || []).some(c => c && c.room === room)));
    if (threads.length || projects.length) blocks.push({ id: id(), title: 'Threads and projects we are following', why: sentences([...projects.map(x => 'Project, ' + x.name), ...threads.map(t => 'Thread, ' + t.name)]) });
    const inq = live('inquiries').filter(x => x.room === room && x.status !== 'closed' && x.status !== 'resting');
    if (inq.length) blocks.push({ id: id(), title: 'Open team inquiries', why: sentences(inq.map(x => x.name)) });
    const obs = live('notices').filter(n => n.classroom === room && String(n.noticed || '').trim() && Date.now() - (n.at || 0) < 10 * 864e5).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3);
    if (obs.length) blocks.push({ id: id(), title: 'A few recent observations to talk about', why: obs.map(n => { const t = String(n.noticed).replace(/\s+/g, ' ').trim(); return '\u2022 ' + (t.length > 160 ? t.slice(0, 160).replace(/\s+\S*$/, '') + '\u2026' : t); }).join('\n') });
    return blocks;
  }
  const DEFAULT_TIMES = { meeting: ['13:15', '14:30'], pdday: ['08:30', '15:30'] };
  function agendaHours(a) { const t = a.kind === 'meeting' ? [(school().meeting || {}).start || '13:15', (school().meeting || {}).end || '14:30'] : DEFAULT_TIMES.pdday; const s = a.start || t[0], e = a.end || t[1]; return Math.max(0.25, Math.round((toMin(e) - toMin(s)) / 15) / 4); }
  const visibleToStaff = a => !!a && (a.blocks || []).length > 0 && daysBetween(today(), a.date) <= 14;
  // a block can open a Presenting entry. Its title travels only to someone who may read that entry.
  const withPres = (a, me) => a && Object.assign({}, a, { blocks: (a.blocks || []).map(b => { if (!b.presenting) return b; const t = c.presTitle ? c.presTitle(me, b.presenting) : ''; const x = Object.assign({}, b, { presTitle: t }); if (!t) { delete x.presenting; delete x.presTitle; } return x; }) });

  // topics TREE suggests for a PD day, each with the reasons it noticed. Nothing from an individual check-in, journal or
  // evaluation is shown with a name, and areas and modules many share are named without saying who.
  function suggestions() {
    const out = []; const now = Date.now(); const live = k => [...(store.recs[k] || new Map()).values()].filter(r => r && !r.deleted && r.doc).map(r => r.doc);
    const firsts = new Set(live('children').map(k => String(k.first || '').trim()).filter(s => s.length > 2));
    const noKids = s => String(s || '').split(/(\s+)/).map(w => firsts.has(w.replace(/[^A-Za-z'-]/g, '')) ? 'a child' : w).join('');
    const threads = live('threads').filter(t => t.status !== 'closed' && t.status !== 'resting' && !t.unfollowed && t.name).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3);
    for (const t of threads) out.push({ topic: noKids(t.name), kind: 'thread', area: 'cur', module: 'documentation', why: [`A thread the team is following${t.classroom || t.room ? ' in ' + (t.classroom || t.room) + ' Class' : ''}.`, t.question ? 'Its question. ' + noKids(String(t.question).split('\n')[0]).slice(0, 180) : ''].filter(Boolean) });
    const projects = live('projects').filter(p => p.status !== 'closed' && p.name).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 2);
    for (const p of projects) out.push({ topic: noKids(p.name), kind: 'project', area: 'cur', module: 'documentation', why: ['A project children are working on now.'] });
    const lens = lensNow && lensNow(); if (lens && lens.name) out.push({ topic: 'This year\'s lens, ' + lens.name, kind: 'lens', area: 'img', module: '', why: ['Where the lens shows up in observations and plans this year.'] });
    const inq = live('inquiries').filter(x => x.status !== 'closed' && x.status !== 'resting'); const rooms = new Set(inq.map(x => x.room || 'School-wide'));
    if (inq.length > 1 && rooms.size > 1) out.push({ topic: 'Looking for the reason behind a behavior', kind: 'inquiries', area: 'lang', module: 'beyond', why: [`Team inquiries are open in ${[...rooms].map(r => r === 'School-wide' ? 'the whole school' : r + ' Class').join(' and ')}, so several Classes are working through hard moments at once.`] });
    // themes across the staff's Focus Until Next Time and Growth Plan goals, never with a name
    const theme = {}; const y = thisYear();
    for (const n of people()) { const g = growth(n); const seen = new Set();
      for (const x of (g.checkins || []).filter(x => x.date && daysBetween(x.date, today()) < 120)) if (x.focus && x.focus.area) seen.add(x.focus.area);
      for (const gl of (((g.plans || {})[y] || {}).goals || [])) if (gl.area) seen.add(gl.area);
      for (const a of seen) theme[a] = (theme[a] || 0) + 1; }
    for (const [a, n] of Object.entries(theme).sort((p, q) => q[1] - p[1]).slice(0, 2)) if (n >= 2) out.push({ topic: (AREAS.find(x => x[0] === a) || [])[1], kind: 'theme', area: a, module: moduleFor(a), why: ['Several educators named this area in their Focus Until Next Time or Growth Plan goals this year. Shown without names.'] });
    const mods = {}; for (const n of people()) for (const [slug, m] of Object.entries(growth(n).modules || {})) if (m && (m.opened || m.done)) mods[slug] = (mods[slug] || 0) + 1;
    for (const [slug, n] of Object.entries(mods).sort((p, q) => q[1] - p[1]).slice(0, 2)) if (n >= 2) out.push({ topic: 'Deepening ' + moduleTitle(slug) + ' together', kind: 'module', area: (MODULE_LIST.find(m => m[0] === slug) || [, , , ['refl']])[3][0] || 'refl', module: slug, why: ['Several educators are taking this module now, so the day can build on what they tried.'] });
    const rv = {}; for (const n of people()) for (const [id, r] of Object.entries(person(n).review || {})) if (r && r.mark === 'review') rv[id] = (rv[id] || 0) + 1;
    const lic = (pieces().licensing || []);
    for (const [id, n] of Object.entries(rv).sort((p, q) => q[1] - p[1]).slice(0, 2)) if (n > 1) { const pc = lic.find(x => x.id === id); if (pc) out.push({ topic: pc.title, kind: 'licensing', area: '', module: 'licensing', why: ['Marked Let\'s review together for more than one educator on the Licensing and Safety list.'] }); }
    const last = Object.values(pdd().agendas).filter(a => a.date < today() && Object.keys(a.plusDelta || {}).length).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last) { const ds = Object.values(last.plusDelta).map(x => String(x.delta || '').trim()).filter(Boolean).slice(0, 3);
      if (ds.length) out.push({ topic: 'What the last PD day asked for', kind: 'plusdelta', area: 'refl', module: '', why: ds.map(d => 'From the plus delta. ' + d.slice(0, 160)) }); }
    return out;
  }

  /* ---------- reminders, through TREE's own reminders ---------- */
  const sentKey = 'staff/sent.json';
  const once = k => { const s = get(sentKey) || {}; if (s[k]) return false; put(sentKey, Object.assign({}, s, { [k]: today() })); return true; };
  let busy = false;
  async function tick() {
    if (busy || !S.ready) return; busy = true;
    try {
      const day = today(); const hr = +new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }) % 24;
      // keep this month's and next month's check-ins on the calendar
      for (const ym of [day.slice(0, 7), addMonths(day.slice(0, 7) + '-01', 1).slice(0, 7)]) { const had = cal.months.get(ym); await loadMonth(ym); if (!had) bump(); }
      if (!opened().growth || !reminders.keys()) return;
      // the end of week journal reminder comes only when the educator has not yet written in their period, with no count shown
      if (dow(day) === 5 && hr >= 14 && hr < 18) for (const n of people()) {
        if (isNewHire(n)) continue; const p = periodOf(n, day); if (p.end !== addDays(day, 2)) continue;
        if (wroteIn(n, p)) continue; if (!once(`${pidOf(n)}|journal|${p.start}`)) continue;
        await reminders.sendTo(n, { title: 'TREE, your journal', body: p.every === 2 ? 'A few honest sentences in your journal, about ten minutes, before the two weeks end.' : 'A few honest sentences in your journal, about ten minutes, before the week ends.', url: 'tree.html?go=journal', tag: 'tree-journal' });
      }
      // a few days before a PD day, a reminder about anything to read or bring
      if (hr >= 8 && hr < 11) for (const a of Object.values(pdd().agendas)) {
        const left = daysBetween(day, a.date); if (a.kind === 'team' || left !== 3 || !(a.blocks || []).length) continue; if (!once(`pdday|${a.id}|remind`)) continue;
        const prep = (a.blocks || []).map(b => String(b.prepare || '').trim()).filter(Boolean);
        // a new hire before full access cannot open the PD days, so hears nothing about them
        for (const n of people().filter(n => !isNewHire(n))) await reminders.sendTo(n, { title: 'TREE, ' + (a.kind === 'meeting' ? 'PD staff meeting' : 'PD day') + ' in three days', body: prep.length ? 'To prepare. ' + prep.join(' ').slice(0, 300) : 'The agenda is ready to read in TREE.', url: 'tree.html?go=pdday', tag: 'tree-pdday' });
      }
    } catch (e) { log('Growth reminders failed,', e.message); } finally { busy = false; }
  }
  setInterval(tick, 5 * 60e3).unref(); setTimeout(tick, 20e3).unref();

  /* ---------- the year's settings, applied once ---------- */
  async function applySeed(saveAccounts, accountFor, setSetting) {
    const sc = school(); const done = sc.seeded || {};
    for (const p of [...S.files.keys()].filter(p => /^staff\/seed-\d{4}\.json$/.test(p)).sort()) {
      const sd = get(p); if (!sd || !sd.id || done[sd.id]) continue;
      let rooms = false;
      for (const [n, pr] of Object.entries(sd.people || {})) {
        const doc = person(n); doc.profile = Object.assign({}, doc.profile);
        for (const k of ['role', 'planHour', 'startDate', 'checkin', 'partTime', 'noMondays', 'journalEvery', 'lighter', 'curriculumFrom', 'neverGoTo', 'supervises']) if (k in pr) doc.profile[k] = pr[k];
        if (pr.room) { const a = accountFor(n); if (a && a.room !== pr.room) { a.room = pr.room; rooms = true; } }
        put(pPath(n), doc);
        if (pr.blankPlan) { const g = growth(n); const y = sd.id; if (!g.plans[y]) { g.plans[y] = { source: 'tree', goals: [], wentWell: { choice: 'last', text: '' }, challenges: '', need: { director: '', team: '', training: '' }, feedback: '', at: Date.now(), by: 'TREE' }; put(gPath(n), g); } }
      }
      for (const [n, date] of Object.entries(sd.activeSupervision || {})) { const doc = person(n); doc.items = Object.assign({}, doc.items); if (!(doc.items.activesup || {}).date) { doc.items.activesup = { date, note: 'Fulton Community School training', by: 'TREE', at: Date.now() }; put(pPath(n), doc); } }
      for (const [n, pl] of Object.entries(sd.plans || {})) { const g = growth(n); g.plans[sd.id] = Object.assign({ source: 'august', at: Date.now(), by: 'TREE' }, pl); put(gPath(n), g); }
      if (rooms) { await saveAccounts('TREE'); const ed = store.recs.settings.get('educators'); if (ed && ed.doc && Array.isArray(ed.doc.names)) { const names = ed.doc.names.map(x => { const r = (sd.people[x.name] || {}).room; return r ? Object.assign({}, x, { room: r }) : x; }); setSetting('educators', Object.assign({}, ed.doc, { names })); } }
      const s2 = Object.assign({}, school()); const add = sd.school || {};
      for (const [k, v] of Object.entries(add)) { if (k === 'philosophy' && s2.philosophy) continue; if (k === 'formLinks') s2.formLinks = Object.assign({}, v, s2.formLinks || {}); else s2[k] = v; }
      s2.seeded = Object.assign({}, s2.seeded, { [sd.id]: today() }); put('staff/school.json', s2);
      log('Educator settings for', sd.id, 'applied');
    }
  }

  /* ---------- requests ---------- */
  async function handle(P, body, me, req, res, { json, err }) {
    const dir = isDirector(me); const who = String(body.name || me);
    const deny = m => err(req, res, 403, m || 'This is not open yet.');
    // a Class team reaches its own team meetings whether or not the growth pages are open yet
    const teamOnly = !allowed(me);
    if (teamOnly && !(['pd/list', 'pd/team', 'pd/step', 'pd/today', 'pd/save'].includes(P) && takesPart(me) && !isNewHire(me))) return deny('This part of TREE is not open yet.');
    // a new hire before full access reaches only their own growth, never other staff's moments or the PD days
    const OWN = ['boot', 'mine', 'plan', 'journal/open', 'journal/save', 'journal/bring', 'checkin/pre', 'checkin/followed', 'eval/self', 'eval/goals', 'modules', 'module/progress', 'schedule'];
    if (isNewHire(me) && !OWN.includes(P)) return deny('This opens once the director turns on full access.');
    const y = thisYear();

    if (P === 'boot') {
      const ym = today().slice(0, 7); const s = await schedule(ym); const nx = await schedule(addMonths(ym + '-01', 1).slice(0, 7));
      const mineOnly = l => dir ? l : l.filter(x => nameKey(x.name) === nameKey(me));
      json(req, res, 200, { year: y, areas: AREAS, points: POINTS, continuum: continuum(y), modules: libraryList(me),
        feedback: FEEDBACK, audience: AUDIENCE, me: { name: me, director: dir, takesPart: takesPart(me), room: roomOf(me), lighter: lighter(me), journalEvery: +profileOf(me).journalEvery || 1, curriculumFrom: profileOf(me).curriculumFrom || '', role: roleOf(me) },
        people: dir ? people().map(n => ({ name: n, room: roomOf(n), role: roleOf(n), lighter: lighter(n), checkin: profileOf(n).checkin || '', planHour: profileOf(n).planHour || '', startDate: profileOf(n).startDate || '', curriculumFrom: profileOf(n).curriculumFrom || '' })) : [],
        team: isNewHire(me) ? [] : people().map(n => ({ name: n, room: roomOf(n) })), schedule: { now: s && Object.assign({}, s, { list: mineOnly(s.list) }), next: nx && Object.assign({}, nx, { list: mineOnly(nx.list) }) },
        settings: { checkin: Object.assign({ week: 1, secondTime: '13:00', minutes: 20 }, school().checkin || {}), meeting: Object.assign({ start: '13:15', end: '14:30' }, school().meeting || {}) }, today: today() });
      return;
    }
    // a former educator's Growth Plan, check-ins, evaluations and Proud Moments, for the director only, from Former educators
    if (P === 'former') { if (!dir) return deny(); if (!isFormer(who)) return err(req, res, 404, 'That educator is not with Former educators.'); json(req, res, 200, { growth: forViewer(who, me), moments: momentsOf(who) }); return; }
    if (P === 'mine') { if (!canSee(me, who)) return deny('Only you and the director see your growth.'); json(req, res, 200, forViewer(who, me)); return; }
    if (P === 'all') { if (!dir) return deny(); json(req, res, 200, { people: people().map(n => forViewer(n, me)) }); return; }

    /* the Educator Reflection and Growth Plan */
    if (P === 'plan') {
      if (!canSee(me, who)) return deny('Only you and the director change your Growth Plan.');
      const yr = /^\d{4}$/.test(body.year || '') ? body.year : y; const g = growth(who); const cur = g.plans[yr] || { goals: [] }; const b = body.plan || {};
      const plan = Object.assign({}, cur);
      if (b.wentWell) plan.wentWell = { choice: b.wentWell.choice === 'new' ? 'new' : 'last', text: txt(b.wentWell.text, 6000) };
      if (Array.isArray(b.goals)) plan.goals = b.goals.slice(0, 3).map(x => ({ id: String(x.id || rid('g')).slice(0, 20), text: txt(x.text, 2000), area: AREA_KEYS.includes(x.area) ? x.area : '', areaOk: !!x.areaOk && AREA_KEYS.includes(x.area), from: x.from ? String(x.from).slice(0, 20) : undefined }));
      if ('challenges' in b) plan.challenges = txt(b.challenges, 6000);
      // the rest of the August form's answers, kept as written
      if (b.reflection) plan.reflection = Object.fromEntries(REFLECTION.map(k => [k, txt(b.reflection[k], 6000)]));
      if (b.need) plan.need = { director: txt(b.need.director, 3000), team: txt(b.need.team, 3000), training: txt(b.need.training, 3000) };
      if ('feedback' in b) plan.feedback = FEEDBACK.includes(b.feedback) ? b.feedback : '';
      // an answer to the meeting frequency or check-in plan question stays as a note only, since check-ins are set monthly
      if (dir && 'note' in b) plan.note = txt(b.note, 2000);
      if (dir && b.source) plan.source = b.source === 'august' ? 'august' : 'tree';
      plan.at = Date.now(); plan.by = me; g.plans[yr] = plan; put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }

    /* the journal */
    if (P === 'journal/open') {
      if (!canSee(me, who)) return deny('The journal is seen only by the educator and the director.');
      if (nameBlocked(me)) return err(req, res, 429, 'Wait a little before trying your passcode again.');
      if (!checkPasscode(me, body.passcode)) return err(req, res, 403, 'That passcode is not right. Use the four numbers you sign in to TREE with.');
      const j = journal(who); const p = periodOf(who, today());
      json(req, res, 200, { key: openKey(me, who), entries: j.entries.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0)), period: p, wrote: wroteIn(who, p), carry: growth(who).carry || null }); return;
    }
    if (P === 'journal/save') {
      if (!canSee(me, who) || !keyOk(body.key, me, who)) return err(req, res, 401, 'Open the journal again with your passcode.');
      if (nameKey(me) !== nameKey(who)) return deny('Only the educator writes in their journal.');
      const j = journal(who); const e = body.entry || {}; const id = String(e.id || '') || rid('j');
      const was = j.entries.find(x => x.id === id);
      const carry = growth(who).carry || null;
      const entry = Object.assign({}, was || { id, date: today(), at: Date.now() }, { joy: txt(e.joy), challenge: txt(e.challenge), connection: txt(e.connection), language: txt(e.language), updatedAt: Date.now() });
      if ('module' in e) { entry.module = txt(e.module); if (entry.module && carry && !(was && was.modulePrompt)) entry.modulePrompt = txt(carry.prompt, 600); }
      j.entries = [entry, ...j.entries.filter(x => x.id !== id)]; put(jPath(who), j);
      json(req, res, 200, { entries: j.entries.slice().sort((a, b) => b.date.localeCompare(a.date)), period: periodOf(who, today()), wrote: wroteIn(who, periodOf(who, today())) }); return;
    }
    if (P === 'journal/bring') {
      // the educator chooses an entry to bring into a check-in or the self-assessment
      if (nameKey(me) !== nameKey(who) || !keyOk(body.key, me, who)) return err(req, res, 401, 'Open the journal again with your passcode.');
      const j = journal(who); const e = j.entries.find(x => x.id === body.id); if (!e) return err(req, res, 404, 'That entry is not here.');
      const to = body.to === 'self' ? 'self' : 'checkin'; e.bring = Object.assign({}, e.bring, { [to]: e.bring && e.bring[to] ? 0 : Date.now() }); put(jPath(who), j);
      json(req, res, 200, { entries: j.entries.slice().sort((a, b) => b.date.localeCompare(a.date)) }); return;
    }

    /* the monthly check-in */
    if (P === 'checkin/pre') {
      // the educator names their own focus first, before the conversation if they like
      if (nameKey(me) !== nameKey(who)) return deny();
      const g = growth(who); const ym = /^\d{4}-\d{2}$/.test(body.month || '') ? body.month : today().slice(0, 7);
      g.pre = Object.assign({}, g.pre, { [ym]: { focus: txt(body.focus, 1500), at: Date.now() } }); put(gPath(who), g); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'checkin/save') {
      if (!dir) return deny('The director keeps the check-in notes.');
      const g = growth(who); const b = body.checkin || {}; const id = String(b.id || '') || rid('c'); const was = (g.checkins || []).find(x => x.id === id) || {};
      const r15 = v => { const n = Math.round(+v); return n >= 1 && n <= 5 ? n : 0; };
      const ci = Object.assign({}, was, { id, date: ISO.test(b.date || '') ? b.date : was.date || today(),
        temp: { self: r15((b.temp || {}).self), dir: r15((b.temp || {}).dir), words: txt((b.temp || {}).words) },
        // the check-in has five parts now. Answers kept before, to questions no longer asked, stay as they were written.
        align: { rating: r15((b.align || {}).rating), note: 'note' in (b.align || {}) ? txt(b.align.note) : txt((was.align || {}).note) },
        work: 'work' in b ? txt(b.work) : txt(was.work), challenge: 'challenge' in b ? txt(b.challenge) : txt(was.challenge), support: txt(b.support), plus: txt(b.plus), delta: txt(b.delta), goalsLine: txt(b.goalsLine, 600),
        goals: Object.fromEntries(Object.entries(b.goals || was.goals || {}).slice(0, 4).map(([k, v]) => [String(k).slice(0, 20), txt(v, 2000)])),
        focus: { mine: txt((b.focus || {}).mine, 1500), seen: txt((b.focus || {}).seen, 1500), settled: txt((b.focus || {}).settled, 1500), area: AREA_KEYS.includes((b.focus || {}).area) ? b.focus.area : '', module: MODULE_LIST.some(m => m[0] === (b.focus || {}).module) ? b.focus.module : '' },
        followup: txt(b.followup), effect: r15(b.effect), at: was.at || Date.now(), updatedAt: Date.now(), by: me });
      g.checkins = [ci, ...(g.checkins || []).filter(x => x.id !== id)].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'checkin/followed') {
      // the educator marks a focus as tried, which shows their follow-through
      if (nameKey(me) !== nameKey(who)) return deny();
      const g = growth(who); const ci = (g.checkins || []).find(x => x.id === body.id); if (!ci) return err(req, res, 404, 'That check-in is not here.');
      ci.followed = ci.followed ? null : { at: Date.now(), note: txt(body.note, 1500) }; put(gPath(who), g); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'checkin/book') {
      if (!dir) return deny(); const g = growth(who);
      if (body.remove) g.booked = (g.booked || []).filter(x => x.id !== body.remove);
      else { if (!ISO.test(body.date || '')) return err(req, res, 400, 'Choose the day.'); g.booked = [...(g.booked || []), { id: rid('b'), date: body.date, time: /^\d{2}:\d{2}$/.test(body.time || '') ? body.time : '' }]; }
      put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'schedule') { const ym = /^\d{4}-\d{2}$/.test(body.month || '') ? body.month : today().slice(0, 7); const s = await schedule(ym); if (s && !dir) s.list = s.list.filter(x => nameKey(x.name) === nameKey(me)); json(req, res, 200, s || {}); return; }

    /* the self-assessment, the director's placements, the meeting and the end of year evaluation */
    if (P === 'eval/self') {
      if (nameKey(me) !== nameKey(who)) return deny('Only you place yourself on the continuum.');
      const yr = /^\d{4}$/.test(body.year || '') ? body.year : y; const g = growth(who); const ev = Object.assign({}, g.evals[yr]); const b = body.self || {};
      const pl = Object.fromEntries(Object.entries(b.placements || {}).filter(([k, v]) => AREA_KEYS.includes(k) && [1, 2, 3, 4].includes(+v)).map(([k, v]) => [k, +v]));
      ev.self = Object.assign({}, ev.self, { placements: pl, writes: Object.fromEntries(Object.entries(b.writes || {}).filter(([k]) => AREA_KEYS.includes(k)).slice(0, 3).map(([k, v]) => [k, txt(v)])),
        examples: Object.fromEntries(Object.entries(b.examples || {}).filter(([k]) => AREA_KEYS.includes(k)).map(([k, v]) => [k, (Array.isArray(v) ? v : []).slice(0, 4).map(x => ({ kind: String(x.kind || '').slice(0, 12), id: String(x.id || '').slice(0, 60), label: txt(x.label, 200) }))])),
        closing: txt(b.closing), at: Date.now(), done: b.done ? (ev.self && ev.self.done) || Date.now() : (ev.self || {}).done || 0 });
      g.evals[yr] = ev; put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'eval/director') {
      if (!dir) return deny(); const yr = /^\d{4}$/.test(body.year || '') ? body.year : y; const g = growth(who); const ev = Object.assign({}, g.evals[yr]); const b = body.dir || {};
      const pl = Object.fromEntries(Object.entries(b.placements || {}).filter(([k, v]) => AREA_KEYS.includes(k) && ([1, 2, 3, 4].includes(+v) || v === 'nys')).map(([k, v]) => [k, v === 'nys' ? 'nys' : +v]));
      ev.dir = Object.assign({}, ev.dir, { placements: pl, notes: Object.fromEntries(Object.entries(b.notes || {}).filter(([k]) => AREA_KEYS.includes(k)).map(([k, v]) => [k, txt(v, 3000)])), narrative: txt(b.narrative, 12000), strengths: txt(b.strengths, 6000), at: Date.now(), done: b.done ? (ev.dir && ev.dir.done) || Date.now() : (ev.dir || {}).done || 0 });
      g.evals[yr] = ev; put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'eval/meeting') {
      // the director opens the meeting view, and from then the educator sees both placements side by side
      if (!dir) return deny(); const yr = /^\d{4}$/.test(body.year || '') ? body.year : y; const g = growth(who); const ev = Object.assign({}, g.evals[yr]);
      if (!lighter(who) && !(ev.dir && ev.dir.done)) return err(req, res, 400, 'Finish your own placements first.');
      ev.meeting = body.undo ? null : { at: Date.now(), by: me }; g.evals[yr] = ev; put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'eval/goals') {
      // the educator names two or three goals for next year, and they carry into the next Growth Plan
      if (!canSee(me, who)) return deny(); const yr = /^\d{4}$/.test(body.year || '') ? body.year : y; const g = growth(who); const ev = Object.assign({}, g.evals[yr]);
      if (!dir && nameKey(me) !== nameKey(who)) return deny();
      ev.goals = (Array.isArray(body.goals) ? body.goals : []).slice(0, 3).map(x => ({ id: String(x.id || rid('n')).slice(0, 20), text: txt(x.text, 2000), area: AREA_KEYS.includes(x.area) ? x.area : '' })).filter(x => x.text.trim());
      g.evals[yr] = ev; const nx = String(+yr + 1); const plan = Object.assign({ goals: [], source: 'tree' }, g.plans[nx]);
      const kept = (plan.goals || []).filter(x => !x.from); plan.goals = [...ev.goals.map(x => ({ id: rid('g'), text: x.text, area: x.area, areaOk: !!x.area, from: 'eval' + yr })), ...kept].slice(0, 3);
      g.plans[nx] = plan; put(gPath(who), g); bump(); json(req, res, 200, forViewer(who, me)); return;
    }
    if (P === 'starting') {
      // the starting-point conversation two months after a new educator starts, placed together, with no scores
      if (!dir) return deny(); const g = growth(who); const b = body.starting || {};
      g.starting = Object.assign({}, g.starting, { placements: Object.fromEntries(Object.entries(b.placements || {}).filter(([k, v]) => AREA_KEYS.includes(k) && [1, 2, 3, 4].includes(+v)).map(([k, v]) => [k, +v])), notes: txt(b.notes, 6000), at: Date.now(), shared: !!b.shared, done: b.done ? Date.now() : (g.starting || {}).done || 0 });
      put(gPath(who), g);
      if (b.done) { const doc = person(who); doc.checklist = Object.assign({}, doc.checklist, { starting: { at: Date.now(), by: me } }); put(pPath(who), doc); }
      bump(); json(req, res, 200, forViewer(who, me)); return;
    }

    /* Proud Moments and Kudos */
    if (P === 'moments') { json(req, res, 200, { list: momentsNow().filter(m => seesMoment(me, m)).map(m => Object.assign({}, m, { mine: nameKey(m.by) === nameKey(me) })) }); return; }
    if (P === 'moments/add') {
      const b = body.moment || {}; const kind = b.kind === 'kudos' ? 'kudos' : 'moment';
      const text = txt(b.text, 1200).trim(); if (!text) return err(req, res, 400, kind === 'kudos' ? 'Say what they did that made a difference.' : 'Write a sentence or two about it.');
      const to = kind === 'kudos' ? String(b.to || '') : ''; if (kind === 'kudos' && !staffNames().some(n => nameKey(n) === nameKey(to))) return err(req, res, 400, 'Choose the colleague.');
      const m = { id: rid('m'), kind, by: me, at: Date.now(), text, to, audience: AUDIENCE.includes(b.audience) ? b.audience : 'everyone', room: roomOf(me), area: kind === 'kudos' ? 'team' : (AREA_KEYS.includes(b.area) ? b.area : ''),
        link: b.link && b.link.id ? { kind: String(b.link.kind || '').slice(0, 12), id: String(b.link.id).slice(0, 60), label: txt(b.link.label, 200) } : null, photo: b.photo && /^staff-[a-f0-9]+\.[a-z]+$/.test(b.photo) ? b.photo : '' };
      put(MOMENTS, { list: [m, ...momentsAll()] }); json(req, res, 200, { ok: true, moment: m }); return;
    }
    if (P === 'moments/remove') { const m = momentsAll().find(x => x.id === body.id); if (!m) return err(req, res, 404, 'That moment is not here.'); if (!dir && nameKey(m.by) !== nameKey(me)) return deny(); put(MOMENTS, { list: momentsAll().filter(x => x.id !== m.id) }); json(req, res, 200, { ok: true }); return; }

    /* the PD library's modules */
    if (P === 'modules') { json(req, res, 200, { modules: modulesFor(me), examples: Object.fromEntries(Object.entries(get(MODS) || {}).map(([k, v]) => [k, dir ? v : { examples: ((v && v.examples) || []).filter(x => x && (x.kept || (v.shown && x.kept === undefined))).map(x => ({ kind: x.kind, text: x.text, why: x.why || '' })), shown: true }])) }); return; }
    if (P === 'module/progress') {
      const slug = String(body.slug || ''); const md = modules()[slug]; if (!md || (!dir && !published(slug))) return err(req, res, 404, 'That module is not here.');
      const g = growth(me); const cur = Object.assign({}, (g.modules || {})[slug]); const b = body.progress || {};
      if (!cur.opened) cur.opened = Date.now();
      if ('tried' in b) cur.tried = b.tried ? cur.tried || Date.now() : 0;
      if ('reflection' in b) cur.reflection = txt(b.reflection, 6000);
      if ('share' in b) cur.share = txt(b.share, 3000);
      let logged = false;
      if (b.finish && !cur.done) { if (!String(cur.reflection || '').trim()) return err(req, res, 400, 'Write your reflection on what happened when you tried it first.'); cur.done = Date.now(); logged = true; }
      g.modules = Object.assign({}, g.modules, { [slug]: cur }); put(gPath(me), g);
      // a finished module logs its hours on the records page, as Fulton PD hours
      if (logged) { const doc = person(me); doc.hours = [...(doc.hours || []), { id: rid('h'), date: today(), title: 'PD module, ' + md.title, hours: md.minutes ? Math.round(md.minutes / 6) / 10 : 0, kind: 'module', approved: false, by: 'TREE' }]; put(pPath(me), doc); }
      json(req, res, 200, forViewer(me, me)); return;
    }
    if (P === 'module/ready') {
      if (!dir) return deny('The director marks a module ready.'); const slug = String(body.slug || ''); if (!modules()[slug]) return err(req, res, 404, 'That module is not here.');
      const all = Object.assign({ modules: {} }, get(READY) || {}); all.modules = Object.assign({}, all.modules); if (body.on) all.modules[slug] = { on: today(), by: me }; else delete all.modules[slug];
      put(READY, all); json(req, res, 200, { modules: modulesFor(me), list: libraryList(me) }); return;
    }
    // a reflection prompt the educator chooses to carry into the weekly journal, one at a time
    if (P === 'module/carry') {
      const slug = String(body.slug || ''); const md = modules()[slug]; if (!md || (!dir && !published(slug))) return err(req, res, 404, 'That module is not here.');
      const g = growth(me); const prompt = txt(body.prompt, 600).trim(); g.carry = prompt ? { slug, title: md.title, prompt, at: Date.now() } : null; put(gPath(me), g);
      json(req, res, 200, { carry: g.carry }); return;
    }
    if (P === 'module/examples') {
      // a module's examples, or a DRDP measure's in the DRDP reference, drdp: and the measure. Each example the director keeps
      // shows to educators, and one she takes out is never suggested again for that module or measure.
      if (!dir) return deny('The director chooses the examples.'); const slug = String(body.slug || ''); if (!modules()[slug] && !/^drdp:[A-Z]{2,5} ?\d{1,2}$/.test(slug)) return err(req, res, 404, 'That module is not here.');
      const all = Object.assign({}, get(MODS) || {}); const was = all[slug] || {};
      all[slug] = { examples: (Array.isArray(body.examples) ? body.examples : []).slice(0, 5).map(x => ({ kind: String(x.kind || '').slice(0, 12), id: String(x.id || '').slice(0, 80), text: txt(x.text, 900), why: txt(x.why, 300), label: txt(x.label, 200), kept: x.kept !== false, photo: '' })),
        out: Array.isArray(body.out) ? body.out.map(x => String(x).slice(0, 80)).slice(-300) : (was.out || []), shown: true, at: Date.now() };
      put(MODS, all); json(req, res, 200, { ok: true }); return;
    }

    /* the continuum's words for the year */
    if (P === 'continuum/save') {
      if (!dir) return deny('The director approves the continuum\'s words.'); const yr = /^\d{4}$/.test(body.year || '') ? body.year : y; const cur = continuum(yr); if (!cur) return err(req, res, 400, 'The continuum is not in the records yet.');
      const b = body.areas || {}; const next = JSON.parse(JSON.stringify(cur)); delete next.year;
      for (const a of next.areas) { const x = b[a.k]; if (!x) continue; a.points = a.points.map((p, i) => ({ text: txt((x[i] || {}).text || p.text, 1200), mine: txt((x[i] || {}).mine || p.mine, 1200) })); }
      next.approvedBy = me; next.at = today(); const all = Object.assign({ years: {} }, get(CONT) || {}); all.years = Object.assign({}, all.years, { [yr]: next }); put(CONT, all);
      json(req, res, 200, { continuum: continuum(yr) }); return;
    }

    /* readings */
    if (P === 'readings') { json(req, res, 200, { list: readingsFor(me), library: hasLib(), libraryReady: libReady() }); return; }
    if (P === 'readings/ready') {
      if (!dir) return deny('The director marks the readings ready.'); if (!hasLib()) return err(req, res, 404, 'The readings library is not in the records yet.');
      put(READY, Object.assign({ modules: {} }, get(READY) || {}, { library: body.on ? { on: today(), by: me } : null }));
      json(req, res, 200, { list: readingsFor(me), library: true, libraryReady: libReady() }); return;
    }
    // the Readings library's own entries, books and articles to read online, each added, changed or removed by the
    // director the same way. A book can be marked In our library on site, which is off until the director turns it on.
    if (P === 'readings/onsite') {
      if (!dir) return deny(); const F = libFile(String(body.id || '')); const all = Object.assign({ list: [] }, get(F) || {}); const x = (all.list || []).find(y => y && y.id === String(body.id || ''));
      if (!x) return err(req, res, 404, 'That reading is not in the library.'); if (x.kind === 'article') return err(req, res, 400, 'Only a book can be in our library on site.');
      x.onSite = !!body.on; put(F, all); json(req, res, 200, { list: readingsFor(me), library: true, libraryReady: libReady() }); return;
    }
    if (P === 'readings/lib/save') {
      if (!dir) return deny(); const b = body.entry || {}; const F = b.id ? libFile(String(b.id)) : (get(LIB) && ((get(LIB) || {}).list || []).length ? LIB : READ); const all = Object.assign({ list: [] }, get(F) || {}); all.list = (all.list || []).slice();
      const kind = b.kind === 'article' ? 'article' : 'book', url = String(b.url || '').trim();
      // every reading carries a link, a web reading to its source, a book to its publisher or a catalog page, a Drive file
      // to the file, and one of our own pieces to its place in TREE, written tree: and the place
      if (!url) return err(req, res, 400, kind === 'article' ? 'Add the article\'s web address, starting with https, so everyone can open it.' : 'Add a link so everyone can find it, the publisher\'s page or a library catalog page for a book.');
      if (!/^(https:\/\/|tree:[a-z0-9]+(\/[a-z0-9-]+)?$)/.test(url)) return err(req, res, 400, 'A link starts with https, or tree: for a place in TREE.');
      const title = txt(b.title, 300).trim(); if (!title) return err(req, res, 400, 'Give it a title.');
      const fields = { kind, title, author: txt(b.author, 300).trim(), source: txt(b.source, 200).trim(), year: txt(b.year, 12).trim(), url: url.slice(0, 600), note: txt(b.note, 600).trim(), cite: txt(b.cite, 600).trim(),
        modules: (Array.isArray(b.modules) ? b.modules : []).map(String).filter(m => /^[a-z0-9-]{1,40}$/.test(m)), areas: (Array.isArray(b.areas) ? b.areas : []).filter(a => AREA_KEYS.includes(a)) };
      let x = b.id ? all.list.find(y => y && y.id === String(b.id)) : null;
      if (x) Object.assign(x, fields, kind === 'article' ? { onSite: false } : {}, x.url !== fields.url ? { check: false, confirmed: '' } : {});
      else { x = Object.assign({ id: rid(kind === 'article' ? 'ra' : 'rl'), by: me, check: false }, fields); all.list.push(x); }
      put(F, all); json(req, res, 200, { list: readingsFor(me), library: true, libraryReady: libReady(), id: x.id }); return;
    }
    if (P === 'readings/lib/remove') {
      if (!dir) return deny(); const F = libFile(String(body.id || '')); const all = Object.assign({ list: [] }, get(F) || {}); const n = (all.list || []).length;
      all.list = (all.list || []).filter(y => !(y && y.id === String(body.id || ''))); if (all.list.length === n) return err(req, res, 404, 'That reading is not in the library.');
      put(F, all); json(req, res, 200, { list: readingsFor(me), library: true, libraryReady: libReady() }); return;
    }
    if (P === 'readings/add') {
      if (!dir) return deny(); const b = body.reading || {}; if (!/^https:\/\//.test(b.url || '')) return err(req, res, 400, 'Add the reading\'s web address, starting with https.');
      const r = { id: rid('r'), title: txt(b.title, 240) || b.url, url: String(b.url).slice(0, 600), source: txt(b.source, 160), supports: txt(b.supports, 160), areas: (b.areas || []).filter(a => AREA_KEYS.includes(a)), modules: (b.modules || []).filter(m => MODULE_LIST.some(x => x[0] === m)), by: me, at: Date.now() };
      const all = Object.assign({ list: [] }, get(READ) || {}); all.list = [...all.list.filter(x => x.url !== r.url), r]; put(READ, all); json(req, res, 200, { list: all.list }); return;
    }

    /* PD days and monthly PD staff meetings */
    if (P === 'pd/list') {
      const from = addDays(today(), -75), to = addDays(today(), 150); const dates = teamOnly ? [] : await pdDates(from, to); const ag = pdd().agendas;
      const list = dates.map(d => { const a = ag[d.id]; const base = Object.assign({}, d, { hours: agendaHours(Object.assign({}, d, a || {})) });
        if (dir) return Object.assign(base, { agenda: a ? Object.assign({}, withPres(a, me), { plusDelta: undefined, plusDeltaList: Object.values(a.plusDelta || {}).map(x => ({ plus: x.plus, delta: x.delta })), plusDeltaCount: undefined }) : null });
        if (!visibleToStaff(a)) return null;
        const mine = (a.plusDelta || {})[pidOf(me)] || null; return Object.assign(base, { agenda: Object.assign({}, withPres(a, me), { plusDelta: undefined, logged: undefined }), mine });
      }).filter(Boolean);
      // an agenda kept for a day no longer on the calendar still shows to the director
      if (dir) for (const a of Object.values(ag)) if (a.kind !== 'team' && !list.some(x => x.id === a.id) && a.date >= from) list.push({ id: a.id, date: a.date, kind: a.kind, title: a.title || '', from: 'tree', hours: agendaHours(a), agenda: Object.assign({}, withPres(a, me), { plusDelta: undefined, plusDeltaList: Object.values(a.plusDelta || {}).map(x => ({ plus: x.plus, delta: x.delta })) }) });
      // the team meetings of the director's Classes, or the educator's own Class, from two weeks back to four ahead
      const team = []; const tFrom = addDays(today(), -14), tTo = addDays(today(), 28);
      for (let d = tFrom.slice(0, 7) + '-01'; d <= tTo; d = addMonths(d, 1)) await loadMonth(d.slice(0, 7));
      for (const date of teamDays(tFrom, tTo)) for (const room of roomsFor(me)) team.push(teamItem(date, room));
      for (const a of Object.values(ag)) if (a.kind === 'team' && roomsFor(me).includes(a.room) && !team.some(x => x.id === a.id) && a.date >= from) team.push(teamItem(a.date, a.room));
      json(req, res, 200, { list: list.sort((a, b) => a.date.localeCompare(b.date)), team: team.sort((a, b) => a.date.localeCompare(b.date) || ROOMS().indexOf(a.room) - ROOMS().indexOf(b.room)), readings: readingsFor(me) }); return;
    }
    // a Class's team meeting opens with its agenda, started from the Class's week until the team saves its own
    if (P === 'pd/team') {
      const room = String(body.room || ''), date = String(body.date || ''); if (!ROOMS().includes(room) || !ISO.test(date)) return err(req, res, 400, 'Choose the team meeting.');
      if (!roomsFor(me).includes(room)) return deny('Each Class team sees its own team meetings.');
      json(req, res, 200, Object.assign(teamItem(date, room), { start: teamStart(room, date) })); return;
    }
    if (P === 'pd/step') {
      const d = pdd(); const a = d.agendas[String(body.id || '')]; if (!a || a.kind !== 'team') return err(req, res, 404, 'That team meeting is not here.');
      if (!roomsFor(me).includes(a.room)) return deny('Each Class team sees its own team meetings.');
      const st = (a.steps || []).find(x => x.id === body.step); if (!st) return err(req, res, 404, 'That next step is not here.');
      st.done = !!body.done; st.doneAt = st.done ? Date.now() : 0; st.doneBy = st.done ? me : ''; put(PDD, d); bump(); json(req, res, 200, { ok: true }); return;
    }
    // Today. The team meetings today for the director or the educator's Class, and for the director a month whose first
    // Monday is a closure, asked once
    if (P === 'pd/today') {
      const t = today(); for (const ym of [t.slice(0, 7), addMonths(t.slice(0, 7) + '-01', 1).slice(0, 7)]) await loadMonth(ym);
      const team = teamDays(t, t).flatMap(date => roomsFor(me).map(room => teamItem(date, room)));
      const ask = []; if (dir) for (const ym of [t.slice(0, 7), addMonths(t.slice(0, 7) + '-01', 1).slice(0, 7)]) { const all = allStaffDay(ym); if (all.needsDate && all.firstMonday >= t) ask.push({ ym, firstMonday: all.firstMonday }); }
      json(req, res, 200, { team, ask }); return;
    }
    if (P === 'pd/move') {
      if (!dir) return deny(); const ym = String(body.ym || ''); if (!/^\d{4}-\d{2}$/.test(ym)) return err(req, res, 400, 'Choose the month.');
      const v = body.date === 'none' ? 'none' : ISO.test(body.date || '') && body.date.slice(0, 7) === ym ? body.date : ''; if (!v) return err(req, res, 400, 'Choose a day in that month.');
      // the agenda already written for the meeting moves with it
      await loadMonth(ym); const was = allStaffDay(ym); const d = pdd();
      if (was.kind === 'meeting' && was.date && v !== 'none' && was.date !== v) { const from = was.date + '-meeting', to = v + '-meeting'; if (d.agendas[from] && !d.agendas[to]) { d.agendas = Object.assign({}, d.agendas, { [to]: Object.assign({}, d.agendas[from], { id: to, date: v, movedFrom: was.date }) }); delete d.agendas[from]; } }
      d.moved = Object.assign({}, d.moved, { [ym]: v }); put(PDD, d); bump(); json(req, res, 200, { ok: true }); return;
    }
    if (P === 'pd/add') {
      if (!dir) return deny(); if (!ISO.test(body.date || '')) return err(req, res, 400, 'Choose the day.');
      const kind = body.kind === 'meeting' ? 'meeting' : 'pdday'; const d = pdd(); const t = kind === 'meeting' ? [(school().meeting || {}).start || '13:15', (school().meeting || {}).end || '14:30'] : ['', ''];
      d.manual = [...d.manual.filter(x => !(x.date === body.date && x.kind === kind)), { id: rid('p'), date: body.date, kind, title: txt(body.title, 120) || (kind === 'meeting' ? 'PD staff meeting' : 'PD day'), start: /^\d{2}:\d{2}$/.test(body.start || '') ? body.start : t[0], end: /^\d{2}:\d{2}$/.test(body.end || '') ? body.end : t[1] }];
      put(PDD, d); bump(); json(req, res, 200, { ok: true }); return;
    }
    if (P === 'pd/save') {
      const b = body.agenda || {}; if (!ISO.test(b.date || '')) return err(req, res, 400, 'Choose the day.');
      // a Class team builds its own team meeting's agenda, with its notes and next steps. Other agendas are the director's.
      const isTeam = b.kind === 'team' && ROOMS().includes(b.room);
      if (isTeam ? !roomsFor(me).includes(b.room) : !dir) return deny(isTeam ? 'Each Class team builds its own team meeting agenda.' : 'The director builds each agenda.');
      const kind = isTeam ? 'team' : b.kind === 'meeting' ? 'meeting' : 'pdday'; const id = isTeam ? teamId(b.date, b.room) : b.date + '-' + kind; const d = pdd(); const was = d.agendas[id] || {};
      const blocks = (Array.isArray(b.blocks) ? b.blocks : []).slice(0, 24).map(x => ({ id: String(x.id || rid('k')).slice(0, 20), time: /^\d{2}:\d{2}$/.test(x.time || '') ? x.time : '', title: txt(x.title, 200), why: txt(x.why, 600), how: ['whole', 'class', 'pairs', 'quiet', ''].includes(x.how) ? x.how : '', prepare: txt(x.prepare, 600), readings: (x.readings || []).slice(0, 8).map(String), module: MODULE_LIST.some(m => m[0] === x.module) ? x.module : '', area: AREA_KEYS.includes(x.area) ? x.area : '', closing: !!x.closing, presenting: /^pr[a-f0-9]{10}$/.test(x.presenting || '') ? x.presenting : '',
        // a guest session, training our team receives from outside presenters, with its presenters, their organization,
        // its length, its link and any handout
        guest: !!x.guest && x.guest !== 'no', guestBy: txt(x.guestBy, 200), guestOrg: txt(x.guestOrg, 200), guestMinutes: Math.max(0, Math.min(600, Math.round(+x.guestMinutes || 0))), guestLink: /^https:\/\//.test(x.guestLink || '') ? String(x.guestLink).slice(0, 600) : '', guestHandout: /^https:\/\//.test(x.guestHandout || '') ? String(x.guestHandout).slice(0, 600) : '', guestPeople: Math.max(0, Math.min(200, Math.round(+x.guestPeople || 0))) }))
        .map(x => x.guest ? x : Object.assign(x, { guestBy: '', guestOrg: '', guestMinutes: 0, guestLink: '', guestHandout: '', guestPeople: 0 }));
      const noLink = blocks.find(x => x.guest && !x.guestLink);
      if (noLink) return err(req, res, 400, 'A guest session needs a link, such as the presenters\' page, so everyone can find it. Add the link to ' + (noLink.title || 'the guest session') + '.');
      // every agenda ends with plus delta
      const body0 = blocks.filter(x => !x.closing && x.title.trim());
      const close = blocks.find(x => x.closing) || { id: rid('k'), closing: true, title: 'Plus delta', why: 'Each educator writes what went well and what to change in TREE on their phone, and a few are shared aloud before leaving.', how: 'quiet', prepare: '', readings: [], time: '' };
      const teamPart = isTeam ? { room: b.room, notes: txt(b.notes, 8000),
        steps: (Array.isArray(b.steps) ? b.steps : []).slice(0, 40).filter(x => x && String(x.text || '').trim()).map(x => { const old = (was.steps || []).find(y => y.id === x.id) || {};
          return { id: String(x.id || rid('s')).slice(0, 20), text: txt(x.text, 400), who: staffNames().find(n => nameKey(n) === nameKey(x.who)) || '', done: !!x.done, doneAt: x.done ? old.doneAt || Date.now() : 0 }; }) } : {};
      d.agendas[id] = Object.assign({}, was, { id, date: b.date, kind, mode: isTeam ? 'light' : b.mode === 'light' ? 'light' : 'full', title: txt(b.title, 160), start: /^\d{2}:\d{2}$/.test(b.start || '') ? b.start : was.start || '', end: /^\d{2}:\d{2}$/.test(b.end || '') ? b.end : was.end || '', blocks: isTeam ? body0 : [...body0, Object.assign(close, { title: 'Plus delta', closing: true })], updatedAt: Date.now(), by: me }, teamPart);
      put(PDD, d); bump(); json(req, res, 200, { ok: true, agenda: d.agendas[id] }); return;
    }
    if (P === 'pd/suggest') { if (!dir) return deny(); json(req, res, 200, { topics: suggestions() }); return; }
    if (P === 'pd/plusdelta') {
      const d = pdd(); const a = d.agendas[String(body.id || '')]; if (!a || (!dir && !visibleToStaff(a))) return err(req, res, 404, 'That agenda is not here.');
      if (a.kind === 'team' && !roomsFor(me).includes(a.room)) return deny('Each Class team sees its own team meetings.');
      a.plusDelta = Object.assign({}, a.plusDelta, { [pidOf(me)]: { plus: txt(body.plus, 2000), delta: txt(body.delta, 2000), at: Date.now() } }); put(PDD, d); json(req, res, 200, { ok: true }); return;
    }
    if (P === 'pd/hours') {
      // the time is logged on each attendee's records page as Fulton PD hours
      if (!dir) return deny(); const d = pdd(); const a = d.agendas[String(body.id || '')]; if (!a) return err(req, res, 404, 'Save the agenda first.');
      if (a.kind === 'team') return err(req, res, 400, 'Team meetings are not logged as PD hours.');
      const names = (Array.isArray(body.names) ? body.names : []).filter(n => staffNames().some(x => nameKey(x) === nameKey(n)));
      // the guest sessions count within the day's hours, and a day that is only a longer guest session counts its length
      const guests = (a.blocks || []).filter(x => x.guest && x.title);
      const hrs = Math.max(agendaHours(a), Math.round(guests.reduce((t, x) => t + (+x.guestMinutes || 0), 0) / 15) / 4); const already = new Set((a.logged && a.logged.names || []).map(nameKey)); let n = 0;
      for (const nm of names) { if (already.has(nameKey(nm))) continue; const doc = person(nm); doc.hours = [...(doc.hours || []), { id: rid('h'), date: a.date, title: (a.kind === 'meeting' ? 'PD staff meeting, ' : 'PD day, ') + (a.title || a.date) + (guests.length ? ', with ' + guests.map(x => x.title + (x.guestOrg ? ' (' + x.guestOrg + ')' : '')).join(' and ') : ''), hours: hrs, kind: a.kind === 'meeting' ? 'meeting' : 'pdday', approved: false, by: 'TREE' }]; put(pPath(nm), doc); n++; }
      a.logged = { at: Date.now(), names: [...new Set([...(a.logged && a.logged.names || []), ...names])] }; put(PDD, d); json(req, res, 200, { ok: true, n, hours: hrs }); return;
    }
    err(req, res, 404, 'Not found');
  }

  /* ---------- the staff room display and the photo of a proud moment ---------- */
  // moments and Kudos shared with everyone rotate on the staff room display, with first names only
  const displayMoments = () => (S.ready && opened().growth ? momentsNow().filter(m => m.audience === 'everyone').slice(0, 20).map(m => ({ id: m.id, kind: m.kind, text: m.text, by: String(m.by || '').split(/\s+/)[0], to: String(m.to || '').split(/\s+/)[0], at: m.at })) : []);
  const momentFile = (me, fid) => (isDirector(me) ? momentsAll() : momentsNow()).find(m => m.photo === fid && seesMoment(me, m));

  const planStarted = name => { const pl = (growth(name).plans || {})[thisYear()]; return !!pl && !!(String(((pl.wentWell || {}).text) || '').trim() || (pl.goals || []).some(g => String(g.text || '').trim()) || pl.feedback); };
  const hasGrowth = name => !!get(gPath(name)) || !!get(jPath(name));
  return { planStarted, momentsOf, hasGrowth, handle, calendarExtra, tick, applySeed, displayMoments, momentFile, takesPart, people, growth, gPath, jPath, modules, published, readingsFor, rev: () => rev, invalidate() { modCache = null; }, AREAS, schedule, periodOf };
};
