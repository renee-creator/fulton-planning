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
   to start a team inquiry with it, which waits with the suggestions. Educators record the first steps they tried for a
   behavior and what happened, and once their class has, an educator there can open a team inquiry with it when it keeps
   happening. One hard moment is never an inquiry.

   Families reach only the home side of a card, its title and its sections, through the Family page. They never receive
   the educator sections, what a card feeds or supports, its setting or the behaviors. */
const fs = require('fs'), path = require('path');
module.exports = function ideabank(o) {
  const { S, get, put, log, isDirector, isKitchen, nameKey } = o;
  const CARDS = 'staff/library/ideabank/cards.json', BEH = 'staff/library/ideabank/behaviors.json';
  const SET = 'staff/library/ideabank/settings.json', SUG = 'staff/library/ideabank/suggestions.json', TRIED = 'staff/library/ideabank/tried.json';
  const SEED = path.join(__dirname, 'once', 'ideabank.json');
  // the thirteen needs a card can feed, the thirteen senses and body systems it can support, and the five settings
  const NEEDS = ['Moving things through the air (trajectory schema)', 'Knocking down and changing things (transformation schema)', 'Heavy work and strong force (proprioceptive input)', 'Enclosing and hiding (enclosure and enveloping schemas)', 'Carrying and moving things (transporting schema)', 'Joining and separating (connecting schema)', 'Spinning and rolling (rotation schema)', 'Height and risk (risky play)', 'Power and being capable (competence)', 'Belonging and having a place (attachment and belonging)', 'Seeking sensation (sensory seeking)', 'Avoiding sensation (sensory sensitivity)', 'Calm and grounding (self-regulation)'];
  const SUPPORTS = ['Touch (tactile)', 'Body pressure and heavy work (proprioception)', 'Movement and balance (vestibular)', 'Noticing body signals (interoception)', 'Listening and sound (auditory)', 'Smell (olfactory)', 'Seeing and judging space (visual-spatial)', 'Both hands working together (bilateral coordination)', 'Crossing the middle of the body (midline crossing)', 'Hand strength and grasp (fine motor)', 'Whole-body strength and coordination (gross motor)', 'Planning a new movement (motor planning)', 'Calming and alerting (self-regulation)'];
  // what a child might need from us, the third question of a team inquiry, each with what it can look like
  const FROM_US = [
    ['To be seen and noticed (attunement)', 'Notice the child before anything goes wrong. Greet the child by name, sit near the play and say what you see. A child who is seen often has less need to be seen in a hard way.'],
    ['Connection with a trusted adult (attachment)', 'One educator stays close for a while. Small moments every day add up. A warm hello, time side by side, a shared joke.'],
    ['A calm adult to borrow from (co-regulation)', 'A child\'s nervous system settles alongside a steady adult before it can settle alone. Come close, slow your breath and your voice, lower your body and use few words. Stay until the child\'s body tells you they are ready. Your calm comes first, the talking comes later.'],
    ['Acknowledgment of effort (encouragement)', 'Describe what the child did and how hard they worked. "You kept turning the lid until it opened." Specific words about effort take the place of good job and great, which judge the result and end the conversation.'],
    ['To be heard (child voice)', 'Ask for the child\'s idea and take it seriously. Write it down, try it, bring it to meeting time. A child whose ideas count has less to push against.'],
    ['Choices and a say (autonomy)', 'Offer two real choices the child can live with. Let the child decide what can be theirs to decide, such as which cup, which path or who carries the basket. Sharing power often settles a power struggle.'],
    ['Doing it myself (independence)', 'Slow down and let the child do the zipper, the pouring or the carrying. Set things where the child can reach them. Step in only when the child asks.'],
    ['A real job that matters (contribution)', 'Give the child work the group truly needs, such as feeding the chickens, carrying the water or setting the table. Real responsibility tells a child they are capable.'],
    ['Knowing what comes next (predictability)', 'Keep the rhythm of the day steady and show it. A picture schedule, a word about what comes next, the same song before cleanup. Tell the child early when something will be different.'],
    ['Help with transitions (transition supports)', 'Give a short warning before a change and a job to carry through it. The child can bring something along, carry the basket or ring the bell. Walk beside the child through it.'],
    ['More time (slower pacing)', 'Let the work go on longer. Save it on a shelf to return to tomorrow. Some children need a long stretch before they can go deep.'],
    ['A faster pace (quicker pacing)', 'Keep waiting short. Move to the next part sooner, offer the next step as soon as the child is ready and keep meeting time brief. Long waits are hard for a quick mind and a busy body.'],
    ['More to think about (cognitive challenge)', 'Offer real complexity. A harder problem, a new tool, a question with no easy answer, a book with more to it, a project that lasts. A child who is bored may be asking to be stretched.'],
    ['Simpler steps (scaffolding)', 'Make it smaller. Fewer materials, one step at a time, a picture of what comes first. Simplify the words too, with short sentences and time to answer.'],
    ['Words for big feelings (emotion coaching)', 'Name the feeling simply and calmly. "You are so angry the tower fell." Stay close while it passes. Talking about it comes later, once the body is calm.'],
    ['A skill to practice (social and emotional skills)', 'Teach the words or the move the child is missing, such as asking for a turn, saying stop or joining a game. Practice in calm moments, in play and with puppets, then help in the real moment.'],
    ['A way into play with friends (peer entry)', 'Help the child find a role in play that is already happening. Join in together, offer a job inside the game, then step back as friends take over.'],
    ['A smaller group', 'Offer time with one or two friends in place of the whole class. A small group is easier to read and easier to join.'],
    ['Space to be alone', 'Keep a cozy corner, a tent or a sitting spot where a child can be apart and still be seen. Time alone is a choice, offered with warmth.'],
    ['Room to move (movement breaks)', 'Offer big movement before stillness is asked for. Carrying, climbing, pushing a wheelbarrow, running in the yard. Let the child stand, kneel or move at meeting time.'],
    ['Less noise, light or crowding (lower sensory load)', 'Look at the room through the child\'s senses. Lower the voices and the lights, open more space, move the play away from the busiest path, offer ear muffs.'],
    ['Rest, food, water or a body break (basic needs)', 'Check the body first. Offer water, snack, a rest on a cushion or heavy work outside. Many hard moments ease once the body has what it needs.'],
    ['Clear and steady limits (consistent boundaries)', 'Keep a few simple agreements and hold them the same way every time, calmly and kindly. Every adult on the team says the same words. Steady limits help a child feel safe.'],
    ['Help to repair (restorative repair)', 'After a hard moment, help the child make it right, such as rebuilding the tower, bringing a cold cloth or checking on a friend. Repair keeps the child\'s place in the group.'],
    ['Their interests in the room (interest-based learning)', 'Bring what the child loves into the space, such as trucks, bugs, a favorite story or a song. A child who finds their interests here has a reason to settle and stay.'],
    ['Home and family in the room (cultural belonging)', 'Bring the child\'s home in, such as a family photo, words from the home language or a song from home. Belonging grows when a child sees their family here.'],
    ['Time to settle after a change (adjustment)', 'A new sibling, a move, a new class or a change at home can unsettle a child for weeks. Talk with the family, keep routines steady and stay close. Patience is part of the plan.']];
  const US = FROM_US.map(x => x[0]);
  const LEVELS = ['Open to all', 'Educator nearby', 'Adult at the table', 'Small group only', 'One adult with one or two children'];
  // each kind of card, the groups it can belong to, and the sections a blank card of that kind starts with, in order
  const TYPES = {
    medium: { groups: ['Paint', 'Drawing', 'Color and print', 'Shaping', 'Building', 'Paper and joining', 'Textiles', 'Elements and mixing', 'Light and looking', 'Sound and movement', 'Story and play', 'Living things', 'Movement and risky play'],
      sections: [['Invitations', 'bullets'], ['Together or alone', 'text'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Closing it together', 'text'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Ways it can grow', 'numbered']] },
    area: { groups: ['Indoor spaces', 'Shared spaces', 'Outdoor spaces'],
      sections: [['A starting point', 'bullets'], ['Together or alone', 'text'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Closing it together', 'text'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Adding over time', 'numbered'], ['Signs it needs more', 'bullets'], ['Toward meaningful', 'text']] },
    interest: { groups: ['Children\'s interests'],
      sections: [['What it might look like', 'text'], ['Invitations', 'bullets'], ['Together or alone', 'text'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Closing it together', 'text'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Ways it can grow', 'numbered']] },
    year: { groups: ['Across the year on our site'],
      sections: [['Through the year', 'bullets'], ['Invitations', 'bullets'], ['Good to know', 'text'], ['The child\'s role', 'bullets'], ['Closing it together', 'text'], ['Your presence', 'text'], ['Wondering alongside', 'lines'], ['Ways it can grow', 'numbered']] },
    ready: { groups: ['Ready for today'],
      sections: [['What you need', 'text'], ['Set it up', 'text'], ['Closing it together', 'text'], ['Your presence', 'text'], ['Why it works on hard days', 'text'], ['If it takes off', 'text']] } };
  const HOME = [['What you need', 'text'], ['Ways to try it', 'bullets'], ['Your child\'s role', 'text'], ['Wonder together', 'lines'], ['What your child is learning', 'text'], ['Bring it to school', 'text'], ['Good to know', 'text']];
  const blankSec = ([h, style]) => style === 'text' ? { h, style, text: '' } : { h, style, items: [] };
  const slug = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'idea';
  const one = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n || 200);

  /* ---------- the records ---------- */
  const doc = () => get(CARDS) || { cards: [] };
  const cards = () => (doc().cards || []).filter(c => c && c.id);
  const behaviors = () => ((get(BEH) || {}).behaviors || []).filter(b => b && b.id);
  const settings = () => Object.assign({ highlights: {}, familyOn: false }, get(SET) || {});
  const sugs = () => Object.assign({ list: [] }, get(SUG) || {});
  const triedAll = () => ((get(TRIED) || {}).list || []).filter(t => t && t.behavior);
  // the day a try happened, on our clock
  const dayOf = at => new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  // the tries a class wrote for a behavior, with what happened. The whole school counts as its own place.
  const triedOf = (behavior, room) => triedAll().filter(t => t.behavior === behavior && (t.room || '') === (room || '') && String(t.happened || '').trim());
  // an educator opens a team inquiry from a behavior once the class has written what it tried and what happened
  const canOpen = (behavior, room) => !!behaviors().find(b => b.id === behavior) && triedOf(behavior, room).length > 0;
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
      removed: dir ? (doc().removed || []).map(r => ({ id: r.card.id, title: r.card.title, at: r.at, by: r.by })) : [], familyOn: !!st.familyOn, director: dir,
      fromUs: FROM_US.map(([name, look]) => ({ name, look })), tried: triedAll().filter(t => Date.now() - t.at < 180 * 864e5) };
  }
  // the home side of every card that has one, and the director's highlights, for the Family page
  function forFamily() {
    const st = settings(); if (!st.familyOn) return { off: true, highlights: [], cards: [] };
    const all = cards().filter(c => c.home && Array.isArray(c.home.sections));
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
  // families see Ideas to try at home only once the director turns it on
  function familySwitch(me, on) {
    const st = settings(); put(SET, Object.assign({}, st, { id: 'ideabank-settings', familyOn: !!on, familyBy: me, familyAt: Date.now() }));
    log('Ideas to try at home', on ? 'turned on' : 'turned off', 'by', me); return { ok: true };
  }
  const familyOn = () => !!settings().familyOn;
  function highlight(me, id, on) {
    const c = cards().find(x => x.id === id); if (!c) return { error: 'That card is not here.' };
    if (on && !c.home) return { error: 'Only a card with an At home side reaches families.' };
    const st = settings(); const h = Object.assign({}, st.highlights); if (on) h[id] = { on: Date.now(), by: me }; else delete h[id];
    put(SET, Object.assign({}, st, { id: 'ideabank-settings', highlights: h })); return { ok: true };
  }

  /* ---------- what the team tried ---------- */
  // an educator records a first step tried for a behavior and what happened. No child is named. Once the class has
  // written what it tried, an educator there can open a team inquiry with it, so one hard moment never becomes one.
  function tried(me, b) {
    const bh = behaviors().find(y => y.id === b.behavior); if (!bh) return { error: 'Choose what you are seeing first.' };
    const step = one(b.step, 400), happened = one(b.happened, 1200); if (!step) return { error: 'Choose or write what you tried.' }; if (!happened) return { error: 'Write what happened when you tried it.' };
    const x = { id: 'tr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), behavior: bh.id, room: one(b.room, 40), step, happened, by: one(me, 80), at: Date.now() };
    x.day = dayOf(x.at);
    const t = get(TRIED) || {}; put(TRIED, Object.assign({}, t, { id: 'ideabank-tried', list: [...(t.list || []).slice(-1500), x] }));
    log('Idea bank try recorded for', bh.id, 'by', me); return { ok: true, id: x.id };
  }
  function untried(me, id) {
    const t = get(TRIED) || {}; const L = (t.list || []).slice(); const i = L.findIndex(x => x && x.id === id); if (i < 0) return { error: 'That try is not here.' };
    if (!isDirector(me) && nameKey(L[i].by) !== nameKey(me)) return { error: 'Only the educator who wrote it, or the director, removes it.' };
    L.splice(i, 1); put(TRIED, Object.assign({}, t, { list: L })); return { ok: true };
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
    if (P === 'ideabank/tried') { done(tried(me, body || {})); return; }
    if (P === 'ideabank/untried') { done(untried(me, String((body || {}).id || ''))); return; }
    if (!dir) { err(req, res, 403, 'The director makes this change. You can suggest it instead.'); return; }
    if (P === 'ideabank/add') { done(addCard(me, body || {})); return; }
    if (P === 'ideabank/remove') { done(removeCard(me, String(body.id || ''))); return; }
    if (P === 'ideabank/restore') { done(restoreCard(me, String(body.id || ''))); return; }
    if (P === 'ideabank/family') { done(familySwitch(me, !!body.on)); return; }
    if (P === 'ideabank/highlight') { done(highlight(me, String(body.id || ''), !!body.on)); return; }
    if (P === 'ideabank/decide') { done(decide(me, body || {}, saveRecord)); return; }
    err(req, res, 404, 'Not found');
  }
  return { seed, list, forFamily, familyOn, canOpen, handle, SPEC, NEEDS, SUPPORTS, LEVELS, US, CARDS, BEH };
};
