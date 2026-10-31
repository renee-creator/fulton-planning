'use strict';
/* The Idea bank, invitations and provocations for every material, space, interest and season, and ideas ready for a
   hard day, with the behaviors educators look up under What are you seeing?

   The cards are kept in the private records as one record, staff/library/ideabank/cards.json, and the behaviors as
   staff/library/ideabank/behaviors.json, read and written through the signed-in server like the other libraries for
   plans. The first time the records hold neither, they are seeded once from the approved file kept with the server,
   once/ideabank.json, which the page never loads. The director edits any card with the one editor and its history,
   adds a card from a blank template of its type, removes one, which stays under removed to put back, and marks cards
   highlighted for families. Educators suggest a new idea or a change to a card, and a suggestion waits for the director,
   who approves it or sets it aside, as a book suggestion does. An educator who looks up a behavior can ask the director
   to start a team inquiry with it, which waits with the suggestions.

   Families reach only the home side of a card, its title and its sections, through the Family page. They never receive
   the educator sections, what a card feeds or supports, its setting or the behaviors. */
const fs = require('fs'), path = require('path');
module.exports = function ideabank(o) {
  const { S, get, put, log, isDirector, isKitchen, nameKey } = o;
  const CARDS = 'staff/library/ideabank/cards.json', BEH = 'staff/library/ideabank/behaviors.json';
  const SET = 'staff/library/ideabank/settings.json', SUG = 'staff/library/ideabank/suggestions.json';
  const SEED = path.join(__dirname, 'once', 'ideabank.json');
  // the thirteen needs a card can feed, the thirteen senses and body systems it can support, and the five settings
  const NEEDS = ['Moving things through the air', 'Knocking down and changing things', 'Heavy work and strong force', 'Enclosing and hiding', 'Carrying and moving things', 'Joining and separating', 'Spinning and rolling', 'Height and risk', 'Power and being capable', 'Belonging and having a place', 'Seeking sensation', 'Avoiding sensation', 'Calm and grounding'];
  const SUPPORTS = ['Touch (tactile)', 'Body pressure and heavy work (proprioception)', 'Movement and balance (vestibular)', 'Noticing body signals (interoception)', 'Listening and sound (auditory)', 'Smell (olfactory)', 'Seeing and judging space (visual-spatial)', 'Both hands working together (bilateral coordination)', 'Crossing the middle of the body (midline crossing)', 'Hand strength and grasp (fine motor)', 'Whole-body strength and coordination (gross motor)', 'Planning a new movement (motor planning)', 'Calming and alerting (self-regulation)'];
  const LEVELS = ['Open to all', 'Educator nearby', 'Adult at the table', 'Small group only', 'One adult with one or two children'];
  // each kind of card, the groups it can belong to, and the sections a blank card of that kind starts with, in order
  const TYPES = {
    medium: { groups: ['Paint', 'Drawing', 'Color and print', 'Shaping', 'Building', 'Paper and joining', 'Textiles', 'Elements and mixing', 'Light and looking', 'Sound and movement', 'Story and play', 'Living things', 'Movement and risky play'],
      sections: [['Invitations', 'bullets'], ['Together or alone', 'text'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Ways it can grow', 'numbered']] },
    area: { groups: ['Indoor spaces', 'Shared spaces', 'Outdoor spaces'],
      sections: [['A starting point', 'bullets'], ['Together or alone', 'text'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Adding over time', 'numbered'], ['Signs it needs more', 'bullets'], ['Toward meaningful', 'text']] },
    interest: { groups: ['Children\'s interests'],
      sections: [['What it might look like', 'text'], ['Invitations', 'bullets'], ['Together or alone', 'text'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Ways it can grow', 'numbered']] },
    year: { groups: ['Across the year on our site'],
      sections: [['Through the year', 'bullets'], ['Invitations', 'bullets'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Ways it can grow', 'numbered']] },
    ready: { groups: ['Ready for today'],
      sections: [['What you need', 'text'], ['Set it up', 'text'], ['Your presence', 'text'], ['Why it works on hard days', 'text'], ['If it takes off', 'text']] } };
  const HOME = [['What you need', 'text'], ['Ways to try it', 'bullets'], ['Your child\'s role', 'text'], ['Wonder together', 'lines'], ['What your child is learning', 'text'], ['Bring it to school', 'text'], ['Good to know', 'text']];
  const blankSec = ([h, style]) => style === 'text' ? { h, style, text: '' } : { h, style, items: [] };
  const slug = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'idea';
  const one = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n || 200);

  /* ---------- the records ---------- */
  const doc = () => get(CARDS) || { cards: [] };
  const cards = () => (doc().cards || []).filter(c => c && c.id);
  const behaviors = () => ((get(BEH) || {}).behaviors || []).filter(b => b && b.id);
  const settings = () => Object.assign({ highlights: {} }, get(SET) || {});
  const sugs = () => Object.assign({ list: [] }, get(SUG) || {});
  // the approved cards and behaviors, written into the records the first time they hold none, and never again
  function seed() {
    if (S.files.has(CARDS) && S.files.has(BEH)) return false;
    let d; try { d = JSON.parse(fs.readFileSync(SEED, 'utf8')); } catch (e) { log('The Idea bank seed could not be read', e.message); return false; }
    if (!S.files.has(CARDS)) put(CARDS, { id: 'ideabank-cards', seeded: d.version || '', seededAt: Date.now(), cards: d.cards || [], removed: [], sources: d.sources || [] });
    if (!S.files.has(BEH)) put(BEH, { id: 'ideabank-behaviors', seeded: d.version || '', seededAt: Date.now(), behaviors: d.behaviors || [] });
    log('Idea bank seeded with', (d.cards || []).length, 'cards and', (d.behaviors || []).length, 'behaviors');
    return true;
  }

  /* ---------- the one editor ---------- */
  // every part of a card the director can change, in the card's own order, then its setting, what it feeds and
  // supports, the seeks and avoids lines, what it is connected to and the home card
  const secField = (pre, s, i, label) => s.style === 'text' ? [`${pre}.${i}.text`, label + s.h] : [`${pre}.${i}.items`, label + s.h + ', one on each line', 'lines'];
  function fields(c) {
    const out = [['title', 'Title'], ['summary', 'Summary']];
    (c.sections || []).forEach((s, i) => out.push(secField('sections', s, i, '')));
    out.push(['setting.level', 'Setting, one of ' + LEVELS.join(', ')], ['setting.why', 'Setting, why'], ['feeds', 'What it feeds, one on each line', 'lines'], ['supports', 'What it supports, one on each line', 'lines'],
      ['seeks', 'For a child who seeks more'], ['avoids', 'For a child who finds it too much'], ['connected', 'Connected to, one on each line', 'lines']);
    if (c.home) { out.push(['home.title', 'At home, the title']); (c.home.sections || []).forEach((s, i) => out.push(secField('home.sections', s, i, 'At home, '))); }
    return out;
  }
  // a save keeps the needs, systems and settings to the names TREE knows, so the filters and matches keep working
  function check(vals) {
    const bad = (k, list) => (vals[k] || []).filter(v => !list.includes(v));
    const n = bad('feeds', NEEDS), s = bad('supports', SUPPORTS);
    if (n.length) return 'What it feeds holds a name TREE does not know, ' + n[0] + '. Use one of ' + NEEDS.join(', ') + '.';
    if (s.length) return 'What it supports holds a name TREE does not know, ' + s[0] + '. Use one of ' + SUPPORTS.join(', ') + '.';
    if (vals['setting.level'] && !LEVELS.includes(vals['setting.level'])) return 'The setting is one of ' + LEVELS.join(', ') + '.';
    if (vals.title != null && !String(vals.title).trim()) return 'Give the card a title.';
    return '';
  }
  const SPEC = { re: /^staff\/library\/ideabank\/cards\.json$/, list: 'cards', name: 'this Idea bank card', title: x => x.title, fields, check };

  /* ---------- what each person receives ---------- */
  function list(me) {
    const dir = isDirector(me), st = settings(), sg = sugs();
    const mine = x => dir || nameKey(x.by) === nameKey(me);
    return { cards: cards(), behaviors: behaviors(), highlights: Object.keys(st.highlights || {}).filter(id => st.highlights[id]),
      needs: NEEDS, supports: SUPPORTS, levels: LEVELS, types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.groups])),
      suggestions: (sg.list || []).filter(x => x && x.status === 'waiting' && mine(x)),
      decided: dir ? [] : (sg.list || []).filter(x => x && x.status !== 'waiting' && mine(x) && x.decidedAt && Date.now() - x.decidedAt < 30 * 864e5),
      removed: dir ? (doc().removed || []).map(r => ({ id: r.card.id, title: r.card.title, at: r.at, by: r.by })) : [], director: dir };
  }
  // the home side of every card that has one, and the director's highlights, for the Family page
  function forFamily() {
    const st = settings(), all = cards().filter(c => c.home && Array.isArray(c.home.sections));
    const clean = s => s.style === 'text' ? { h: s.h, style: 'text', text: String(s.text || '') } : { h: s.h, style: s.style, items: (s.items || []).map(String) };
    return { highlights: all.filter(c => (st.highlights || {})[c.id]).map(c => c.id),
      cards: all.map(c => ({ id: c.id, group: c.group, title: c.home.title || c.title, sections: c.home.sections.map(clean) })) };
  }

  /* ---------- the director's changes ---------- */
  function blank(type, title, group) {
    const T = TYPES[type]; if (!T) return null;
    const c = { id: '', type, group: T.groups.includes(group) ? group : T.groups[0], title, summary: '', sections: T.sections.map(blankSec), feeds: [], setting: { level: 'Open to all', why: '' }, supports: [], seeks: '', avoids: '', connected: [] };
    if (type !== 'ready') c.home = { title: title + ' at Home', sections: HOME.map(blankSec) };
    return c;
  }
  function addCard(me, b) {
    const title = one(b.title, 120); if (!title) return { error: 'Give the card a title.' };
    const c = blank(String(b.type || ''), title, String(b.group || '')); if (!c) return { error: 'Choose what kind of card it is.' };
    const d = JSON.parse(JSON.stringify(doc())); d.cards = d.cards || [];
    let id = slug(title); while (d.cards.some(x => x.id === id) || (d.removed || []).some(r => r.card && r.card.id === id)) id += '-2';
    c.id = id; if (b.summary) c.summary = one(b.summary, 600);
    d.cards.push(c); d.updatedAt = Date.now(); d.updatedBy = me; put(CARDS, d); log('Idea bank card added', id, 'by', me);
    return { ok: true, id };
  }
  function removeCard(me, id) {
    const d = JSON.parse(JSON.stringify(doc())); const i = (d.cards || []).findIndex(c => c.id === id); if (i < 0) return { error: 'That card is not here.' };
    const [c] = d.cards.splice(i, 1); d.removed = [...(d.removed || []), { card: c, at: Date.now(), by: me }];
    d.updatedAt = Date.now(); d.updatedBy = me; put(CARDS, d); log('Idea bank card removed', id, 'by', me); return { ok: true };
  }
  function restoreCard(me, id) {
    const d = JSON.parse(JSON.stringify(doc())); const i = (d.removed || []).findIndex(r => r.card && r.card.id === id); if (i < 0) return { error: 'That card is not here.' };
    const [r] = d.removed.splice(i, 1); d.cards.push(r.card); d.updatedAt = Date.now(); d.updatedBy = me; put(CARDS, d); log('Idea bank card put back', id, 'by', me); return { ok: true };
  }
  function highlight(me, id, on) {
    const c = cards().find(x => x.id === id); if (!c) return { error: 'That card is not here.' };
    if (on && !c.home) return { error: 'Only a card with an At home side reaches families.' };
    const st = settings(); const h = Object.assign({}, st.highlights); if (on) h[id] = { on: Date.now(), by: me }; else delete h[id];
    put(SET, Object.assign({}, st, { id: 'ideabank-settings', highlights: h })); return { ok: true };
  }

  /* ---------- suggestions ---------- */
  // an educator's new idea, a change to one part of a card, or a behavior the team might take up as a team inquiry
  function suggest(me, b) {
    const kind = ['new', 'change', 'inquiry'].includes(b.kind) ? b.kind : ''; if (!kind) return { error: 'Choose what you are suggesting.' };
    const x = { id: 'sg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, by: one(me, 80), at: Date.now(), status: 'waiting', note: one(b.note, 1200) };
    if (kind === 'new') { x.title = one(b.title, 120); x.type = TYPES[b.type] ? b.type : 'medium'; x.group = TYPES[x.type].groups.includes(b.group) ? b.group : TYPES[x.type].groups[0]; x.text = String(b.text || '').replace(/\r/g, '').trim().slice(0, 4000); if (!x.title || !x.text) return { error: 'Give the idea a title and a few lines about it.' }; }
    if (kind === 'change') { const c = cards().find(y => y.id === b.card); if (!c) return { error: 'That card is not here.' };
      const f = fields(c).find(([k]) => k === b.field); if (!f) return { error: 'Choose the part of the card to change.' };
      x.card = c.id; x.cardTitle = c.title; x.field = f[0]; x.label = f[1]; x.lines = f[2] === 'lines'; x.text = String(b.text || '').replace(/\r/g, '').trim().slice(0, 8000); if (!x.text) return { error: 'Write the new wording.' }; }
    if (kind === 'inquiry') { const bh = behaviors().find(y => y.id === b.behavior); if (!bh) return { error: 'Choose what you are seeing first.' }; x.behavior = bh.id; x.title = bh.label;
      x.needs = (b.needs || bh.needs || []).filter(n => NEEDS.includes(n)); x.supports = (b.supports || bh.supports || []).filter(n => SUPPORTS.includes(n)); x.mode = ['seek', 'avoid', 'both'].includes(bh.mode) ? bh.mode : 'seek'; x.room = one(b.room, 40); }
    const sg = sugs(); put(SUG, Object.assign({}, sg, { id: 'ideabank-suggestions', list: [...(sg.list || []).slice(-400), x] }));
    log('Idea bank suggestion', kind, 'from', me); return { ok: true, id: x.id };
  }
  // the director approves or sets aside a suggestion. An approved change goes through the one editor's save, so the
  // card keeps the wording before it. An approved new idea becomes a card from the blank template of its kind.
  function decide(me, b, saveRecord) {
    const sg = sugs(); const L = (sg.list || []).slice(); const i = L.findIndex(x => x && x.id === b.id && x.status === 'waiting'); if (i < 0) return { error: 'That suggestion is not waiting.' };
    const x = Object.assign({}, L[i]); let out = { ok: true };
    if (b.approve) {
      if (x.kind === 'new') { const r = addCard(me, { type: x.type, title: x.title, group: x.group, summary: String(x.text).split('\n')[0] }); if (r.error) return r;
        const d = JSON.parse(JSON.stringify(doc())); const c = d.cards.find(y => y.id === r.id); const lines = String(x.text).split('\n').map(l => l.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
        const inv = c.sections.find(s => s.style !== 'text'); if (inv && lines.length > 1) inv.items = lines.slice(1);
        put(CARDS, d); out = { ok: true, card: r.id }; x.card = r.id; }
      else if (x.kind === 'change') { const c = cards().find(y => y.id === x.card); if (!c) return { error: 'That card is no longer here.' };
        const fl = fields(c); const at = fl.findIndex(([k]) => k === x.field); if (at < 0) return { error: 'That part of the card is no longer here.' };
        const parts = fl.map((f, j) => ({ body: j === at ? x.text : null }));
        const r = saveRecord(me, CARDS, c.id, { parts, note: ('A suggestion from ' + x.by + (x.note ? ', ' + x.note : '')).slice(0, 300), keep: true });
        if (r.error) return r; out = { ok: true, card: c.id }; }
    }
    L[i] = Object.assign(x, { status: b.approve ? 'approved' : 'aside', decidedAt: Date.now(), decidedBy: me });
    put(SUG, Object.assign({}, sg, { list: L })); log('Idea bank suggestion', b.approve ? 'approved' : 'set aside', x.id, 'by', me);
    return out;
  }

  async function handle(P, body, me, req, res, { json, err }, saveRecord) {
    if (isKitchen(me)) { err(req, res, 403, 'The Idea bank is for educators.'); return; }
    const dir = isDirector(me);
    const done = r => { if (r.error) { err(req, res, 400, r.error); return; } json(req, res, 200, Object.assign(list(me), r)); };
    if (P === 'ideabank') { json(req, res, 200, list(me)); return; }
    if (P === 'ideabank/suggest') { done(suggest(me, body || {})); return; }
    if (!dir) { err(req, res, 403, 'The director makes this change. You can suggest it instead.'); return; }
    if (P === 'ideabank/add') { done(addCard(me, body || {})); return; }
    if (P === 'ideabank/remove') { done(removeCard(me, String(body.id || ''))); return; }
    if (P === 'ideabank/restore') { done(restoreCard(me, String(body.id || ''))); return; }
    if (P === 'ideabank/highlight') { done(highlight(me, String(body.id || ''), !!body.on)); return; }
    if (P === 'ideabank/decide') { done(decide(me, body || {}, saveRecord)); return; }
    err(req, res, 404, 'Not found');
  }
  return { seed, list, forFamily, handle, SPEC, NEEDS, SUPPORTS, LEVELS, CARDS, BEH };
};
