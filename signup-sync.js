'use strict';
// Family conference times from SignUpGenius, filled in by the server every hour.
// The server reads the SignUpGenius calendar link saved in the conference Settings, matches each booked slot to a child
// the same way the "Fill in times from SignUpGenius" button does, and sets the conference date, time and Signed up.
// Only clear matches are filled in. A slot that matches no child, more than one child, or a child who has two slots
// is left for an educator to place with the button. A date or time an educator changed by hand is never overwritten,
// since TREE remembers the time it last took from SignUpGenius and only follows changes to that.
const DEFAULT_FEED = 'webcal://www.signupgenius.com/index.cfm?go=t.calendar&record=52b9d3e8d48a36eeafcf25b67ee0ea5a';
const DEFAULT_GROUPS = [
  { name: 'Cosmos', room: 'West', educator: '' }, { name: 'Yarrow', room: 'West', educator: '' }, { name: 'Zinnia', room: 'West', educator: '' }, { name: 'Borage', room: 'West', educator: '' },
  { name: 'Marigold', room: 'North', educator: '' }, { name: 'Morning Glory', room: 'North', educator: '' }, { name: 'Sunflower', room: 'North', educator: '' },
  { name: 'Poppy', room: 'South', educator: '' }, { name: 'Lavender', room: 'South', educator: '' }, { name: 'Iris', room: 'South', educator: '' }];

module.exports = function signupSync({ store, log, readFeed, noteChange, scheduleSave }) {
  const state = { lastRun: '', filled: 0, unmatched: 0, error: '' };
  const settings = () => { const r = store.recs.settings.get('main'); return r && !r.deleted && r.doc ? r.doc : {}; };
  const isoLA = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const period = iso => { const y = +iso.slice(0, 4), mo = +iso.slice(5, 7) - 1; return mo >= 7 ? { year: `${y}-${String(y + 1).slice(2)}`, term: 'Fall' } : { year: `${y - 1}-${String(y).slice(2)}`, term: 'Spring' }; };
  const words = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 1);
  function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }

  function children() { const out = []; for (const [id, r] of store.recs.children) { if (r.deleted || !r.doc || r.doc.status === 'withdrawn') continue; out.push(Object.assign({}, r.doc, { id })); } return out; }

  // one SignUpGenius slot can hold a family from each class, written under a "South Conference" heading
  function split(ev, rooms) {
    const lines = String(ev.description || '').split(/\n/).map(s => s.trim()); const out = []; let room = '', cur = null;
    for (const line of lines) {
      const head = line.match(/^(.+?)\s+conferences?\s*$/i);
      const r = head && rooms.find(x => x.toLowerCase() === head[1].trim().toLowerCase());
      if (r) { room = r; cur = null; continue; }
      const who = line.match(/^(.+?)\s*\(\d+\)\s*$/);
      if (who && room) { cur = Object.assign({}, ev, { room, signer: who[1].trim(), comment: '' }); out.push(cur); continue; }
      if (cur && line) cur.comment = (cur.comment ? cur.comment + ' ' : '') + line;
    }
    if (!out.length) return [Object.assign({}, ev, { room: '' })];
    return out.map(e => Object.assign(e, { description: [e.signer, e.comment].filter(Boolean).join(' · ') }));
  }
  function match(ev, all) {
    const tw = words([ev.summary, ev.description, ev.location].join(' ')); if (!tw.length) return null;
    const close = (a, b) => { if (a === b) return true; if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false; return lev(a, b) <= 1; };
    const has = w => tw.some(t => close(t, w));
    let kids = all; if (ev.room) { const inRoom = all.filter(c => c.classroom === ev.room); if (inRoom.length) kids = inRoom; }
    const count = k => { const m = {}; kids.forEach(c => words(c[k]).forEach(w => { m[w] = (m[w] || 0) + 1; })); return m; };
    const firsts = count('first'), lasts = count('last'); let best = null, score = 0, tie = false;
    for (const c of kids) {
      const f = words(c.first), l = words(c.last), pw = (c.parents || []).map(p => words(p && p.name)).filter(x => x.length);
      const hasF = f.length && f.every(has), hasL = l.length && l.some(has); let s = 0;
      if (hasF && hasL) s = 4;
      else if (pw.some(p => p.length > 1 && p.every(has))) s = 3;
      else if (hasF && pw.some(p => p.slice(1).some(has))) s = 3;
      else if (hasF && f.every(w => firsts[w] === 1)) s = 2;
      else if (hasL && l.every(w => lasts[w] === 1) && pw.some(p => has(p[0]))) s = 2;
      if (s > score) { best = c; score = s; tie = false; } else if (s && s === score && best !== c) tie = true;
    }
    return score && !tie ? best : null;
  }

  async function run() {
    if (!store.ready) return;
    const set = settings(); const link = String(set.signupFeed != null ? set.signupFeed : DEFAULT_FEED).trim();
    if (!link || set.signupAuto === false) return;
    let events;
    try { events = await readFeed(link); state.error = ''; }
    catch (e) { state.error = e.message || 'SignUpGenius could not be read'; log('Conference times could not be read from SignUpGenius,', state.error); return; }
    const rooms = Array.isArray(set.classrooms) && set.classrooms.length ? set.classrooms : ['West', 'North', 'South'];
    const groups = Array.isArray(set.groups) ? set.groups : DEFAULT_GROUPS;
    const kids = children(); const today = isoLA(new Date());
    const since = isoLA(new Date(Date.now() - 60 * 864e5));
    const slots = (events || []).filter(e => e.date >= since).flatMap(e => split(e, rooms)).map(e => ({ e, c: match(e, kids) }));
    const per = {}; slots.forEach(x => { if (x.c) per[x.c.id] = (per[x.c.id] || 0) + 1; });
    let filled = 0, unmatched = 0;
    for (const { e, c } of slots) {
      if (!c) { if (words(e.description).length) unmatched++; continue; }
      if (per[c.id] > 1) { unmatched++; continue; }   // one child, two slots, so an educator chooses
      const p = period(e.date), id = `${c.id}--${p.year}-${p.term.toLowerCase()}`;
      const cur = store.recs.conferences.get(id); const time = /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '';
      if (cur && !cur.deleted) {
        const d = cur.doc;
        if (d.status === 'complete' || ['declined', 'missed'].includes(d.signup || '')) continue;
        // a date set by hand, other than the one last taken from SignUpGenius, stays
        const byHand = d.confDate && !(d.sugDate === d.confDate && (d.sugTime || '') === (d.confTime || ''));
        if (byHand && (d.confDate !== e.date || (time && d.confTime && d.confTime !== time))) continue;
        const patch = {};
        if (d.confDate !== e.date) patch.confDate = e.date;
        if (time && d.confTime !== time) patch.confTime = time;
        if (d.signup !== 'signedup' && d.signup !== 'missed') patch.signup = 'signedup';
        if (!Object.keys(patch).length && d.sugDate === e.date) continue;
        Object.assign(d, patch, { sugDate: e.date, sugTime: time, sugAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedByName: 'SignUpGenius' });
        cur.local = true;
      } else {
        if (e.date < today) continue;   // a past slot with no conference record is left for the educators
        const g = c.group ? groups.find(x => x.name === c.group) : null; const teacher = String(c.primaryEducator || '').trim() || (g && g.educator) || '';
        const now = new Date().toISOString();
        store.recs.conferences.set(id, { doc: Object.assign({ childId: c.id, schoolYear: p.year, term: p.term, status: 'open', fields: {}, reflections: {}, prep: {}, attachments: [], confDate: e.date, confTime: time, signup: 'signedup', sugDate: e.date, sugTime: time, sugAt: now, createdAt: now, updatedAt: now, updatedByName: 'SignUpGenius' }, teacher ? { teacher } : {}), sha: cur && cur.sha, path: `conferences/${id}.json`, local: true });
      }
      noteChange('conferences', id); scheduleSave('conferences', id); filled++;
    }
    state.lastRun = new Date().toISOString(); state.filled = filled; state.unmatched = unmatched;
    if (filled) log(`SignUpGenius filled in ${filled} conference time${filled === 1 ? '' : 's'}${unmatched ? `, ${unmatched} slot${unmatched === 1 ? '' : 's'} left to place` : ''}`);
  }
  let running = null;
  const go = () => { if (!running) running = run().catch(e => log('SignUpGenius sync stopped', e && e.message)).finally(() => { running = null; }); return running; };
  setTimeout(go, 90000).unref();
  setInterval(go, 60 * 60000).unref();
  return { run: go, status: () => Object.assign({}, state) };
};
