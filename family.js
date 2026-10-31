'use strict';
/* The Family page. Families sign in with an email on file and a six-digit code, and see only their own children.
   They find ways to take part, log what they did, choose which child it counts for, and see each child's hours.
   Records live under participation/ in the school's records. config holds test mode and the testers.
   While test mode is on, only a tester's email signs in, linked by the director to real children, nothing is emailed,
   the code shows on the page, and everything made is marked test so it can be cleared before going live.
   A family's sign-in is signed differently from a staff sign-in, so it never opens anything on the staff side. */
const crypto = require('crypto');

// the sections of the conference form a family sees once the director shares the notes
const CONF_FIELDS = [['interests', 'Main Interests'], ['friends', 'Friends'], ['smallGroup', 'Small Group Work and Current Inquiry'], ['favoriteAreas', 'Favorite Areas and Activities'], ['nature', 'Connection to Nature and the Farm'], ['approaches', 'Approaches to Learning and Self-Regulation'], ['social', 'Social and Emotional Development'], ['language', 'Language and Literacy'], ['cognition', 'Cognition (math and science)'], ['physical', 'Physical Development and Health'], ['expressive', 'Expressive Languages'], ['strengths', 'Strengths'], ['goals', 'Shared Goals (school and home)'], ['nextSteps', 'Next Steps']];
// the parts of a transition summary for kindergarten or TK, as TREE writes them
const TS_SECTIONS = [['who', 'Who this child is'], ['play', 'How they play and learn'], ['friends', 'Friends and relationships'], ['working', 'What they are working on'], ['helps', 'What helps']];
const TS_NEXT = { k: 'Going to kindergarten next year', tk: 'Going to TK next year' };
// a child's age in years and months today, from the birthday on file
function ageText(dob) { const d = String(dob || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ''; const [y, m, dd] = d.split('-').map(Number); const n = new Date();
  let mo = (n.getFullYear() - y) * 12 + (n.getMonth() + 1 - m); if (n.getDate() < dd) mo--; if (mo < 0) return ''; const yr = Math.floor(mo / 12), r = mo % 12;
  return yr ? `${yr} year${yr === 1 ? '' : 's'}${r ? ` ${r} month${r === 1 ? '' : 's'}` : ''}` : `${r} month${r === 1 ? '' : 's'}`; }
// the enrollment information the state forms ask for, LIC 700, 702, 627 and the sunscreen consent on LIC 9221, typed once
// by the family. Office staff print the filled forms for the family to sign at the pre-start visit.
const enrollMissing = require('./enroll-rules.js');
const AGREE = require('./agreement.js');
const T = (k, label, extra) => Object.assign({ k, label, type: 'text' }, extra || {});
const person = p => [T(p + 'first', ''), T(p + 'middle', ''), T(p + 'last', '')];
const addr = p => [T(p + 'street', ''), T(p + 'city', ''), T(p + 'state', '', { value: 'CA' }), T(p + 'zip', '')];
const ENROLL = [
  { title: '', fields: [...person('c_'), T('c_sex', ''), T('c_dob', '', { type: 'date' }), T('c_phone', ''), ...addr('c_')] },
  { title: '', fields: [...person('p1_'), T('p1_home', ''), T('p1_work', ''), T('p1_same', '', { type: 'check', value: true }), ...addr('p1_'), T('p1_lives', '', { type: 'yn' })] },
  { title: '', fields: [...person('p2_'), T('p2_home', ''), T('p2_work', ''), T('p2_same', '', { type: 'check', value: true }), ...addr('p2_'), T('p2_lives', '', { type: 'yn' })] },
  { title: '', fields: [...person('r_'), T('r_home', ''), T('r_work', '')] },
  { title: '', fields: [1, 2, 3, 4].flatMap(i => [T('e' + i + '_name', ''), T('e' + i + '_phone', ''), T('e' + i + '_rel', ''), T('e' + i + '_addr', '')]) },
  { title: '', fields: [T('doc_name', ''), T('doc_phone', ''), T('doc_addr', ''), T('doc_plan', ''), T('den_name', ''), T('den_phone', ''), T('den_addr', ''), T('den_plan', ''),
    T('noreach', '', { type: 'choice', options: ['Call the emergency hospital', 'Other'], value: 'Call the emergency hospital' }), T('noreach_other', ''), T('med_allergy', '')] },
  { title: '', fields: [1, 2, 3, 4, 5].flatMap(i => [T('a' + i + '_name', ''), T('a' + i + '_rel', '')]).concat([T('pickup_time', '')]) },
  { title: '', fields: [T('h_regular', ''), T('h_lastexam', '', { type: 'date' }), T('h_walked', ''), T('h_talked', ''), T('h_toilet', ''),
    T('h_ill', '', { type: 'illness', options: [['chickenpox', 'Chicken pox'], ['asthma', 'Asthma'], ['rheumatic', 'Rheumatic fever'], ['hayfever', 'Hay fever'], ['diabetes', 'Diabetes'], ['epilepsy', 'Epilepsy'], ['whooping', 'Whooping cough'], ['mumps', 'Mumps'], ['polio', 'Polio'], ['rubeola', 'Ten-day measles (rubeola)'], ['rubella', 'Three-day measles (rubella)']] }),
    T('h_other', '', { type: 'area' }), T('h_colds', '', { type: 'yn' }), T('h_coldsn', ''), T('h_allergies', '', { type: 'area' })] },
  { title: '', fields: [T('d_wake', ''), T('d_bed', ''), T('d_sleepwell', ''), T('d_nap', ''), T('d_napwhen', ''), T('d_naplong', ''),
    T('d_bfast', ''), T('d_lunch', ''), T('d_dinner', ''), T('d_bfast_t', ''), T('d_lunch_t', ''), T('d_dinner_t', ''), T('d_dislikes', ''), T('d_eatprob', ''),
    T('d_toilet', '', { type: 'yn' }), T('d_stage', ''), T('d_bm', '', { type: 'yn' }), T('d_bmtime', ''), T('d_bmword', ''), T('d_uword', '')] },
  { title: '', fields: [T('v_health', '', { type: 'area' }), T('v_doctor', '', { type: 'yn' }), T('v_doctorname', ''), T('v_meds', '', { type: 'yn' }), T('v_medswhat', ''),
    T('v_device', '', { type: 'yn' }), T('v_devicewhat', ''), T('v_devhome', '', { type: 'yn' }), T('v_devhomewhat', ''),
    T('v_personality', '', { type: 'area' }), T('v_along', '', { type: 'area' }), T('v_group', ''), T('v_needs', '', { type: 'area' }), T('v_ill', ''), T('v_reason', '')] },
  { title: '', fields: [T('fa_has', '', { type: 'yn' }), T('fa_food', '', { type: 'area' }), T('fa_reaction', '', { type: 'area' }), T('fa_reason', ''), T('fa_medical', '', { type: 'yn' })] },
  { title: '', fields: [T('sun', '', { type: 'check', value: true })] },
];
// the welcome letter new families see first, from Fulton's Welcome Letter and Logistics. The office can change it on the Participation page.
const DEFAULT_WELCOME = "We are so excited to welcome your family to Fulton Community School. This is an exciting time for your family and a new adventure to embark upon. Your checklist below walks you through everything to do before the first day, including your [1Core parent portal](https://family.1core.com/). We look forward to seeing you in person soon!\n\n### Arriving each day\nPlease arrive between 8:30 and 8:50 AM so your child can use the bathroom, wash hands, fill their water bottle and have sunscreen on, then meet their educators. Children should be settled by 9:00 AM.\n\n### Every day, rain or shine\nAll children go outside every day, including rainy days. Rain changes our outdoor spaces and offers new possibilities for play and learning, and children know when they are prepared. Your checklist lists the rain gear and clothes to keep at school.\n\n### Using the bathroom at our school\nChildren at our school use the bathroom independently. Before your child comes to school in underwear, they need to be fully independent in the bathroom and tell us when they need to go. Until then, please send diapers or pull-ups.\n\n### Saying goodbye\nGoodbyes can be hard, and that is normal. Feelings change from day to day and month to month, just like they do for adults. A brief, predictable goodbye of a couple of minutes helps most. Let your child know they are going to school, share a short book or activity, give a hug, say \"Goodbye, I will come back and pick you up,\" and tell an educator you are leaving. Please do not leave without saying goodbye. Educators will comfort your child and call you if your child keeps having a hard time.\n\n### Your visit and the All About Me book\nChoose a visit time on this page. Welcoming children before their first day helps them feel secure and connected. Make the All About Me book here too, and we print and laminate it so your child can share it with friends.\n\n### Important reminders\n- Please tell us in person about any allergies, sensitivities or dietary needs on the school visit day, even if they are on your forms.\n- No outside food. Nuts of any kind are not allowed because of severe allergies.\n- Children must be free of symptoms for 24 hours before returning to school.\n\n### School hours\nMorning program 8:30 AM to 12:00 PM. Full day, Monday 8:30 AM to 12:30 PM and Tuesday to Friday 8:30 AM to 4:00 PM. Early care 7:30 to 8:30 AM and after care Tuesday to Friday 4:00 to 5:00 PM, with advance sign-up. Late pickup is $1 per minute. To change your schedule, email the director.";
const CALENDAR_URL = 'https://calendar.google.com/calendar/embed?src=c_fb2e747462e605bde4e83259ffadf24b98a87617bb24eca797ad223dc34930d2%40group.calendar.google.com&ctz=America%2FLos_Angeles';

/* The transition summary a family reads never names or shows another child. Other children's first and last names,
   the nicknames their families gave in the Family Questionnaire and their initials, such as R. or R.T., become a friend,
   and the educators' words are otherwise kept. The staff copy stays as written. */
const NOT_NAMES = new Set(['We', 'She', 'He', 'Her', 'His', 'They', 'Them', 'Their', 'No', 'None', 'Yes', 'Our', 'The', 'A', 'An', 'And', 'Or', 'But', 'Sometimes', 'Usually', 'Mostly', 'Just', 'Only', 'Call', 'Calls', 'Called', 'Likes', 'Prefers', 'Goes', 'By', 'Name', 'Nickname', 'Nicknames', 'Family', 'Mom', 'Dad', 'Mama', 'Papa', 'Grandma', 'Grandpa', 'Not', 'Na', 'Also', 'At', 'Home', 'School', 'It', 'Is', 'In', 'Of', 'To', 'For', 'With', 'Sister', 'Brother', 'Baby']);
// names that are also the school's own words are never changed, and names that are also everyday words are changed only
// inside a sentence, so May I help? and Green beans stay as written
const NEVER_NAMES = new Set(['Fulton', 'Farm', 'School', 'Community', 'Class', 'West', 'North', 'South', 'Garden', 'Piazza']);
const NEAR_SKIP = new Set('The They Then There These Those This That When What Where Which While With Will Would Could Should After Before Again Also Another Every Everyone Today Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December'.split(' '));
const EVERYDAY = new Set(('may june april august will grace hope joy rose lily daisy iris ivy sky river rain sunny star green brown white black gray grey bean berry hunter mason taylor cook baker miller wood stone hill rivers summer winter autumn faith bell love max sage olive pearl ruby jade dawn eve art bill frank mark rob sue pat dash').split(' '));
const shareFamily = (a, b) => { const em = c => new Set(((c && c.parents) || []).map(x => String((x && x.email) || '').trim().toLowerCase()).filter(Boolean)); const x = em(a); return [...em(b)].some(e => x.has(e)); };
const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function nicknamesOf(c) { const a = c && c.familyQuestionnaire && Array.isArray(c.familyQuestionnaire.answers) ? String(c.familyQuestionnaire.answers[0] || '') : ''; return (a.match(/\b[A-Z][a-z]{1,20}\b/g) || []).filter(w => !NOT_NAMES.has(w)); }
// a family never reads DRDP rating language. A sentence on shared conference notes that names a DRDP level, a measure
// code or the DRDP is left out of the family's copy, and the educators' own words around it stay.
const RATING = /\bDRDP\b|\b(Responding|Exploring|Building|Integrating) (Earlier|Middle|Later)\b|\b(ATL|SED|LLD|ELD|COG|PD|HLTH|HSS|VPA|SCI|MATH|CS|PH|IN|LOM|SC) ?\d/;
function withoutRatings(text) {
  return String(text || '').split('\n').map(line => line.split(/(?<=[.!?])\s+/).filter(x => !RATING.test(x)).join(' ')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
// words that look like names but are not children: places, languages, seasons and school words. Staff names, classes and
// small groups are added by the caller.
const NOT_CHILDREN = new Set(('English Spanish French Chinese Mandarin Cantonese Vietnamese Tagalog Japanese Korean Arabic Portuguese Russian Hindi ' +
  'Halloween Thanksgiving Christmas Hanukkah Kwanzaa Easter Diwali Lunar Valentine Fall Spring Summer Winter Kindergarten Transitional ' +
  'Santa Rosa Sonoma Sebastopol Petaluma Healdsburg Windsor California Pacific Studio Atelier Kitchen Library Meeting DRDP TK ' +
  'Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December ' +
  'Responding Exploring Building Integrating Earlier Middle Later Emerging').split(/\s+/));
// opt.keep, more words that are never a child, and opt.found, where each name taken out is listed for the director to see
function withoutOthers(text, child, all, opt) {
  opt = opt || {}; const keep = new Set([...(opt.keep || [])].map(x => String(x || '').trim()).filter(Boolean)); const found = Array.isArray(opt.found) ? opt.found : null;
  let t = String(text || ''); if (!t) return t;
  const own = new Set([child.first, child.last, ...nicknamesOf(child)].filter(Boolean).map(x => String(x).toLowerCase()));
  const words = new Set(), inits = new Set();
  for (const c of all) {
    // a brother or sister is the family's own, and keeps their name
    if (!c || c === child || (c.id && c.id === child.id) || shareFamily(c, child)) continue;
    for (const w of [c.first, c.last, ...nicknamesOf(c)]) { const x = String(w || '').trim(); if (x.length >= 2 && !own.has(x.toLowerCase()) && !NEVER_NAMES.has(x)) words.add(x); }
    // only this child's own initials are left as written
    const f = String(c.first || '').trim()[0], l = String(c.last || '').trim()[0];
    const of = String(child.first || ' ').trim()[0] || ' ', ol = String(child.last || ' ').trim()[0] || ' ';
    if (f) { if (f.toUpperCase() !== of.toUpperCase()) inits.add(f.toUpperCase() + '\\.'); if (l && !(f.toUpperCase() === of.toUpperCase() && l.toUpperCase() === ol.toUpperCase())) inits.add(f.toUpperCase() + '\\.\\s?' + l.toUpperCase() + '\\.'); }
  }
  // a name spelled a little differently from the roster, such as Allison for Alisin, reads as a friend too
  const gap = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const tt = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tt; } } return d[b.length]; };
  const roster = [...words].filter(n => n.length >= 4 && /^[A-Z][a-z]+$/.test(n));
  for (const w of new Set(String(t).match(/\b[A-Z][a-z]{3,}\b/g) || [])) { if (words.has(w) || own.has(w.toLowerCase()) || NEVER_NAMES.has(w) || EVERYDAY.has(w.toLowerCase()) || NEAR_SKIP.has(w)) continue;
    if (roster.some(n => n[0] === w[0] && Math.abs(n.length - w.length) <= 2 && gap(n, w) <= (Math.min(n.length, w.length) >= 6 ? 2 : 1))) words.add(w); }
  // full names first, then single names, each with a possessive
  const list = [...words].sort((a, b) => b.length - a.length).map(reEsc);
  if (list.length) t = t.replace(new RegExp('\\b(?:' + list.join('|') + ')(?:\\s+(?:' + list.join('|') + '))?\\b(\'s|’s)?', 'g'), (m, pos, at, all) => {
    const first = m.split(/\s+/)[0].replace(/(\'s|’s)$/, ''); const start = !all.slice(0, at).trim() || /[.!?]["”]?\s*$|\n\s*$/.test(all.slice(0, at));
    if (EVERYDAY.has(first.toLowerCase()) && start) return m; if (found) found.push(m.replace(/(\'s|’s)$/, '')); return 'a friend' + (pos ? '\'s' : ''); });
  // a name not in TREE's records, written in the middle of a sentence, is taken out too, so a child who has left or a
  // name spelled another way never reaches a family. One that starts a sentence is taken out when it also appears mid-sentence.
  // Only for a transition summary's family copy, opt.unknown.
  if (opt.unknown) { const ok = w => own.has(w.toLowerCase()) || keep.has(w) || NEVER_NAMES.has(w) || NEAR_SKIP.has(w) || NOT_CHILDREN.has(w) || NOT_NAMES.has(w) || /^(A|An|I|Our|We|Their|His|Her|Its)$/.test(w);
    const mid = new Set(); t.replace(/(^|[^.!?\n\s]\s+)([A-Z][a-z]{2,})(?=\b)/g, (m, pre, w, at) => { if (pre && at > 0 && !ok(w)) mid.add(w); return m; });
    if (mid.size) { const l = [...mid].sort((a, b) => b.length - a.length).map(reEsc);
      t = t.replace(new RegExp('\\b(?:' + l.join('|') + ')\\b(\'s|’s)?', 'g'), (m, pos) => { if (found) found.push(m.replace(/(\'s|’s)$/, '')); return 'a friend' + (pos ? '\'s' : ''); }); } }
  if (inits.size) t = t.replace(new RegExp('(^|[\\s(,])(?:' + [...inits].sort((a, b) => b.length - a.length).join('|') + ')(?=[\\s,.;!?)]|$)', 'g'), (m, p1, at, all) => {
    if (found) found.push(m.slice(p1.length)); const after = all.slice(at + m.length); const ends = /[.]$/.test(m) && (/^\s*$/.test(after) || /^\s+[A-Z]/.test(after));
    return p1 + 'a friend' + (ends ? '.' : ''); });
  // two friends named together read as friends, and a sentence that starts with one starts with a capital
  t = t.replace(/\ba friend(?:,\s*a friend)*,?\s+and\s+a friend\b/g, 'friends').replace(/\ba friend(?:,\s*a friend)+\b/g, 'friends').replace(/\ba friend\s+and\s+friends\b/g, 'friends');
  t = t.replace(/(^|[.!?]\s+|\n\s*)a friend/g, (m, p1) => p1 + 'A friend').replace(/(^|[.!?]\s+|\n\s*)friends\b/g, (m, p1) => p1 + 'Friends');
  return t;
}

module.exports = function family({ community, store, log, sign, noteChange, scheduleSave, mailCode, photoSrc, keepPhoto, handbook, walks, garden, siteMap, pieces, wording, recipeOf, addRecipe, released, volunteer }) {
  const o = { released };
  /* the Family page's own wording, kept in the private records in staff/wording, which the director edits in place.
     The Family Questionnaire, the Family Reflections, the first steps, the packing list, the All About Me book, the
     enrollment form's words and the Admission Tuition Agreement. */
  const WD = require('./wording.js');
  const words = id => (wording ? wording(id) : { title: '', parts: [] });
  // the Family page's own words, as the director wrote them in staff/wording/family-page-text.md, each part as it first
  // read until she writes it
  const FT = require('./family-text.js');
  const familyTexts = () => { const out = FT.defaults(); const W = WD.map(words('family-page-text')); for (const [k, v] of Object.entries(W)) if (String(v || '').trim() && k in out) out[k] = String(v).trim(); return out; };
  const QUESTIONS = () => WD.list(words('family-questionnaire')).map(([, t]) => t);
  const REFLECTIONS = () => WD.list(words('family-reflections'));
  const CHECKS = () => WD.list(words('family-checklist')).map(([k, t]) => { const ps = WD.paras(t); const ls = WD.links(t); return [k, ps[0] || '', (ps[1] && !WD.links(ps[1]).length) ? ps[1] : '', ls]; });
  const PACK = () => WD.list(words('family-packing'));
  const AAM_PAGES = () => WD.list(words('family-aboutme')).map(([, t]) => { const ps = WD.paras(t); return [ps[0] || '', ps.slice(1).join(' ')]; });
  // the enrollment form, its boxes from the code and its words from the records
  const ENROLL_NOW = () => { const W = WD.map(words('family-enrollment'));
    return ENROLL.map((sec, i) => { const ps = WD.paras(W['section' + (i + 1)]); return Object.assign({}, sec, { title: ps[0] || '', note: ps.slice(1).join(' ') || undefined, fields: sec.fields.map(f => Object.assign({}, f, { label: W[f.k] || '' })) }); }); };
  const AG = () => AGREE.use(words('agreement'));
  // the Family Handbook now lives in TREE. A family acknowledges the edition that is current, at enrollment and at each
  // re-enrollment after a new edition is published. A tick from before TREE held the handbook was the 2026 edition.
  const hbYear = () => { try { return (handbook && handbook() && handbook().current()) || ''; } catch (e) { return ''; } };
  const hbAck = (k, y) => (k.handbookAck || {})[y] || (y === '2026' && k.familyChecks && k.familyChecks.handbook ? { at: k.familyChecks.handbook } : null);
  const KIND = 'participation';
  const recs = () => store.recs[KIND];
  const cfg = () => { const r = recs().get('config'); const d = r && !r.deleted && r.doc ? r.doc : {}; return { test: d.test !== false, goal: Number(d.goal) > 0 ? Number(d.goal) : 10, testers: Array.isArray(d.testers) ? d.testers : [], confOpen: !!d.confOpen, aa: d.aa && typeof d.aa === 'object' ? d.aa : {}, welcome: typeof d.welcome === 'string' ? d.welcome : '' }; };
  const getRec = (kind, id) => { const r = store.recs[kind].get(id); return r && !r.deleted && r.doc ? r.doc : null; };
  // in test mode, each family save notes which parts of the record the tester changed, with what they were before, so
  // Clear test entries puts back only those parts and never anything staff added since
  function saveRec(kind, id, doc) { const cur = store.recs[kind].get(id);
    const u = recs().get('undo-' + kind + '-' + id);
    if (u && !u.deleted && u.doc && u.doc.kind === 'undo' && Array.isArray(u.doc.keys) && cur && cur.doc) {
      const before = cur.doc, keys = new Set(u.doc.keys), was = Object.assign({}, u.doc.was || {});
      for (const k of new Set([...Object.keys(before), ...Object.keys(doc)])) { if (k === 'updatedAt' || k === 'savedAt' || keys.has(k)) continue; if (JSON.stringify(before[k]) !== JSON.stringify(doc[k])) { keys.add(k); was[k] = k in before ? JSON.parse(JSON.stringify(before[k])) : null; } }
      save(u.doc.id, Object.assign({}, u.doc, { keys: [...keys], was }));
    } store.recs[kind].set(id, { doc, sha: cur && cur.sha, path: `${kind}/${id}.json`, local: true }); noteChange(kind, id); scheduleSave(kind, id); }
  // in test mode, what a family changes on a real child or conference is remembered once, so Clear test entries can put it back
  function remember(f, kind, id) {
    if (!f.test) return; const uid = 'undo-' + kind + '-' + id; if (recs().get(uid) && !recs().get(uid).deleted) return;
    const prev = getRec(kind, id); save(uid, { id: uid, kind: 'undo', target: kind, tid: id, existed: !!prev, keys: [], was: {}, test: true, at: nowIso() });
  }
  function season(day) { const t = day ? new Date(day + 'T12:00:00') : new Date(); const y = t.getFullYear(), m = t.getMonth(); return m >= 7 ? { year: `${y}-${String(y + 1).slice(2)}`, term: 'Fall' } : { year: `${y - 1}-${String(y).slice(2)}`, term: 'Spring' }; }
  const confIdOf = (childId, p) => `${childId}--${p.year}-${p.term.toLowerCase()}`;
  // a child is new until the first day, or until the onboarding checklist is finished
  // a child is new from enrollment until three weeks after the first day, or while the office keeps the Welcome steps on
  function isNew(k) { if (k.welcomeOn) return true; const e = k.enrollDate ? new Date(String(k.enrollDate).slice(0, 10) + 'T12:00:00') : null; if (e) return (e - new Date()) > -21 * 864e5; const ob = k.onboarding || {}; return !!ob.started && !ob.firstDay; }
  const norm = e => String(e || '').trim().toLowerCase();
  const okEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);
  const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const nowIso = () => new Date().toISOString();
  // today in California, so after 5 pm the page still shows today's sign-ups, menu and closures
  const laToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const newId = p => p + '-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

  // the school year runs from August, so hours start fresh each August
  function yearStart(d) { const t = d ? new Date(d) : new Date(); const y = t.getMonth() >= 7 ? t.getFullYear() : t.getFullYear() - 1; return y + '-08-01'; }
  const hoursOf = minutes => Math.max(1, Math.ceil((Number(minutes) || 0) / 60));   // each entry rounds up to the next whole hour

  // ---------- who a family is ----------
  function childrenFor(email) {
    const e = norm(email); const c = cfg(); const out = [];
    if (c.test) {
      const t = c.testers.find(x => norm(x.email) === e); if (!t) return { kids: [], test: true };
      for (const id of t.children || []) { const r = store.recs.children.get(id); if (r && !r.deleted && r.doc && r.doc.status !== 'withdrawn') out.push(Object.assign({ id }, r.doc)); }
      return { kids: out, test: true };
    }
    for (const [id, r] of store.recs.children) { const k = r.doc; if (r.deleted || !k || k.status === 'withdrawn') continue; if ((k.parents || []).some(p => norm(p && p.email) === e)) out.push(Object.assign({ id }, k)); }
    return { kids: out, test: false };
  }

  // ---------- codes and sign-in ----------
  const codes = new Map(); const tries = new Map();
  function tooMany(key, max) { const now = Date.now(); const t = tries.get(key) || { n: 0, until: now + 15 * 60000 }; if (t.until < now) { t.n = 0; t.until = now + 15 * 60000; } t.n++; tries.set(key, t); return t.n > max; }
  async function sendCode(email, ip) {
    const e = norm(email); if (!okEmail(e)) return { error: 'Type the email address the school has for you.' };
    if (tooMany('c|' + e, 5) || tooMany('i|' + ip, 30)) return { error: 'Too many codes asked for. Wait fifteen minutes and try again.' };
    const { kids, test } = childrenFor(e);
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    if (kids.length) codes.set(e, { hash: crypto.createHash('sha256').update(code).digest('hex'), until: Date.now() + 15 * 60000, n: 0 });
    if (test) {
      // in test mode only a tester's email gets a code, and it shows right on the page, so the director can test without
      // any email. Anyone else is told plainly the page is not open yet. Families never sign in while test mode is on.
      if (!kids.length) return { error: 'The Family page is not open yet.' };
      return { ok: true, test: true, code };
    }
    if (kids.length) { try { await mailCode(e, code); } catch (er) { log('Family code not sent,', er.message); return { error: 'The code could not be sent just now. Try again in a few minutes.' }; } }
    // the same answer whether or not the email is on file, so the page never tells a stranger who is enrolled
    return { ok: true };
  }
  function signIn(email, code, ip) {
    const e = norm(email); const c = codes.get(e);
    if (tooMany('s|' + ip, 40)) return { error: 'Too many tries. Wait fifteen minutes.' };
    if (!c || c.until < Date.now()) return { error: 'That code has expired. Ask for a new one.' };
    c.n++; if (c.n > 6) { codes.delete(e); return { error: 'Too many wrong codes. Ask for a new one.' }; }
    const h = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (h.length !== c.hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(c.hash))) return { error: 'That code does not match. Check the newest one.' };
    codes.delete(e);
    const body = b64u(JSON.stringify({ fam: e, e: Date.now() + 120 * 864e5, t: cfg().test ? 1 : 0 }));
    log('Family signed in', cfg().test ? '(test mode)' : '');
    return { token: body + '.' + sign('family|' + body) };
  }
  function readFamily(req) {
    const h = String(req.headers.authorization || ''); const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!tok || tok.length > 600) return null; const [body, mac] = tok.split('.'); if (!body || !mac) return null;
    const want = sign('family|' + body); if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
    let s; try { s = JSON.parse(unb(body)); } catch (e) { return null; }
    if (!s || typeof s.fam !== 'string' || !(s.e > Date.now())) return null;
    // a sign-in made in test mode ends when test mode ends, and a family's ends if test mode is turned back on
    if (!!s.t !== cfg().test) return null;
    const { kids, test } = childrenFor(s.fam); if (!kids.length) return null;
    return { email: s.fam, kids, test };
  }

  // ---------- what a family sees ----------
  // every record carries its id, whichever side made it
  const listOf = test => [...recs().entries()].filter(([, r]) => !r.deleted && r.doc && test(r.doc)).map(([id, r]) => (r.doc.id === id ? r.doc : Object.assign(r.doc, { id })));
  // a gathering and its jobs reach families only once the director has released them in Settings, and marked them ready
  // a garden visit, a visiting group in our garden, stays with the staff and never reaches families
  const visits = () => new Set(listOf(d => d.gathering === 'garden-visit').map(d => d.id));
  const items = () => { const gv = visits(); return listOf(d => d.kind === 'item' && d.gathering !== 'garden-visit' && !(d.gatheringId && gv.has(d.gatheringId)) && (!o.released || !(d.gathering || d.gatheringId) || o.released(d))); };
  const logs = () => listOf(d => d.kind === 'log' && !d.removed);
  // what each entry counts as. An entry from before kept no type, so it reads by what it was logged for.
  const LOG_TYPES = ['job', 'event', 'conference', 'donation'];
  const typeOf = l => { if (LOG_TYPES.includes(l.type)) return l.type; const r = l.itemId && recs().get(l.itemId); const it = r && !r.deleted && r.doc; return it && it.type === 'event' ? 'event' : it && it.type === 'wish' ? 'donation' : 'job'; };
  // a conference the class team marks complete counts one hour for that child, entered by TREE once, on the conference day.
  // A conference is real even while the Family page is being tried, so its hour shows in test mode too.
  const isConf = l => l.type === 'conference' && l.auto === true;
  function conferenceHours() {
    let n = 0;
    for (const [cid, r] of store.recs.conferences) {
      const c = r && !r.deleted && r.doc; if (!c || c.status !== 'complete') continue;
      const childId = c.childId || String(cid).split('--')[0];
      const kid = store.recs.children.get(childId); if (!kid || kid.deleted) continue;
      const id = 'lg-conf-' + String(cid).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80); if (recs().get(id)) continue;
      const day = /^\d{4}-\d{2}-\d{2}$/.test(c.confDate || '') && c.confDate <= laToday() ? c.confDate : laToday();
      save(id, { id, kind: 'log', type: 'conference', auto: true, email: '', childId, confId: cid, what: 'Family conference', date: day, minutes: 60, hours: 1, test: false, at: nowIso() }); n++;
    }
    if (n) log('Conference hours added for', n, n === 1 ? 'child' : 'children');
  }
  const firstOf = k => k.first || 'Your child';
  function familyView(f) {
    const c = cfg(); const ys = yearStart(); const ids = new Set(f.kids.map(k => k.id)); const today = laToday();
    const mine = logs().filter(l => ids.has(l.childId) && (l.date || '') >= ys && (isConf(l) || !!l.test === f.test));
    const hours = f.kids.map(k => ({ id: k.id, first: firstOf(k), classroom: k.classroom || '', hours: mine.filter(l => l.childId === k.id).reduce((a, l) => a + (Number(l.hours) || 0), 0), goal: c.goal }));
    const open = items().filter(it => it.open !== false && !!it.test === f.test && (!it.date || it.date >= today) && (!it.classroom || f.kids.some(k => k.classroom === it.classroom)))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
      .map(it => { const ss = it.signups || []; const mineIn = ss.some(s => s.email === f.email); let card = null; try { card = it.jobId && volunteer && volunteer.slotCard ? volunteer.slotCard(it.jobId, mineIn) : null; } catch (e) { card = null; } return { id: it.id, pointPerson: it.pointPerson || '', card, type: it.type, title: it.title, note: it.note || '', walk: !!it.walk, date: it.date || '', start: it.start || '', end: it.end || '', hours: Number(it.hours) || 0, spots: Number(it.spots) || 0, taken: ss.length, mine: ss.some(s => s.email === f.email), counts: asksCounts(it), gathering: it.gathering || '', gatheringId: it.gatheringId || '', gardenDay: !!it.gardenDay, question: it.question || '', my: (({ who, adults, children, answer } = {}) => ({ who, adults, children, answer }))(ss.find(s => s.email === f.email)) }; });
    // what this family signed up for that has happened and is not logged yet, so logging it is one tap
    const signed = items().filter(it => !!it.test === f.test && (it.signups || []).some(s => s.email === f.email) && (it.type === 'wish' ? it.status !== 'requested' : (it.date && it.date <= today && it.date >= ys)) && !mine.some(l => l.itemId === it.id))
      .map(it => ({ id: it.id, title: it.title, date: it.date, hours: Number(it.hours) || 0, type: it.type }));
    const kidsOut = hours.map(h => Object.assign(h, childExtras(f, f.kids.find(k => k.id === h.id), c, today)));
    const entries = mine.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(l => ({ id: l.id, what: l.what, date: l.date, hours: l.hours, type: typeOf(l), child: firstOf(f.kids.find(k => k.id === l.childId) || {}), childId: l.childId, mine: l.email === f.email }));
    const anyNew = kidsOut.some(k => k.isNew);
    const pace = (() => { const t = new Date(), y = t.getMonth() >= 7 ? t.getFullYear() : t.getFullYear() - 1; const a = new Date(y, 7, 15).getTime(), b = new Date(y + 1, 4, 31).getTime(); return Math.floor(c.goal * Math.min(1, Math.max(0, (t.getTime() - a) / (b - a)))); })();
    const me = ((f.kids.flatMap(k => k.parents || []).find(p => p && norm(p.email) === f.email) || {}).name) || '';
    const hy = hbYear();
    // the walk agreements reach a family with a walk invitation, once the director has marked walk safety ready
    let walkInfo = null; try { walkInfo = open.some(it => it.walk) && walks ? walks() : null; } catch (e) { walkInfo = null; }
    // the garden agreements for families and the children's plant guide, once the director marks the Garden ready
    let gardenInfo = null; try { gardenInfo = garden ? garden() : null; if (gardenInfo) gardenInfo = Object.assign({}, gardenInfo, { guide: gardenInfo.guide.map(g => Object.assign({}, g, { photo: g.photo ? photoSrc(g.photo) : '' })) }); } catch (e) { gardenInfo = null; }
    let piecesAll = []; try { piecesAll = pieces ? pieces() || [] : []; } catch (e) { piecesAll = []; }
    // the site map, the photo from above and the names of the spaces, never a child's photo or name
    let mapInfo = null; try { const m = siteMap ? siteMap() : null; if (m && m.ready) mapInfo = { src: photoSrc(m.photo), spots: m.spots }; } catch (e) { mapInfo = null; }
    // the director's job cards a family can do with no sign-up, anytime at school or at home
    let jobs = null; try { jobs = volunteer ? volunteer.forFamily() : null; } catch (e) { jobs = null; }
    // the specialty or passion visits this family offered, and where each one stands
    const visits = listOf(d => d.kind === 'visit' && d.email === f.email && !!d.test === f.test).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      .map(v => { const r = v.itemId && recs().get(v.itemId); const it = r && !r.deleted && r.doc; return { id: v.id, what: v.what, status: v.status || 'new', date: it ? it.date || '' : '', start: it ? it.start || '' : '' }; });
    // the museums and the plants on our site, each part once the director turns it on for families
    let communityInfo = null; try { communityInfo = community ? community() : null; } catch (e) { communityInfo = null; }
    return { community: communityInfo, visits, jobs, pieces: piecesAll.filter(p => p.audience === 'all'), gardenInfo, walkInfo, siteMap: mapInfo, test: f.test, goal: c.goal, pace, me, kidCount: f.kids.length, children: kidsOut, open, signed, entries, yearFrom: ys, menu: menuWeeks(today), calendarUrl: CALENDAR_URL, handbook: hy ? { year: hy } : null,
      texts: familyTexts(), welcome: anyNew ? (c.welcome || (wording && (WD.map(wording('school-words'))['Family welcome letter'] || '').trim()) || DEFAULT_WELCOME) : '', aa: anyNew ? c.aa : {}, email: f.email, checks: anyNew ? CHECKS() : [], pack: anyNew ? PACK() : [], questions: anyNew ? QUESTIONS() : [], enrollForm: anyNew ? ENROLL_NOW() : [], reflectionQs: REFLECTIONS(), confOpen: c.confOpen, agreementWords: anyNew ? words('agreement') : null };
  }

  function save(id, doc) { const cur = recs().get(id); recs().set(id, { doc, sha: cur && cur.sha, path: `${KIND}/${id}.json`, local: true }); noteChange(KIND, id); scheduleSave(KIND, id); }

  // ---------- conferences, visits, sharing, strengths and the questionnaire ----------
  const slots = () => listOf(d => d.kind === 'slot');
  function childExtras(f, k, c, today) {
    const p = season(); const cf = getRec('conferences', confIdOf(k.id, p));
    const conference = cf && cf.confDate ? { date: cf.confDate, time: cf.confTime || '', with: cf.teacher || '', format: cf.format || '', season: p.term + ' ' + p.year, complete: cf.status === 'complete' } : null;
    const reflections = cf && cf.status !== 'complete' ? Object.fromEntries(REFLECTIONS().map(([key]) => [key, (cf.familyReflections || {})[key] || ''])) : null;
    // conference notes are never shared with families. The Family Summary is what goes home from a conference.
    const shared = [];
    const files = (k.sharedFiles || []).filter(x => x && x.id).map(x => ({ id: x.id, title: x.title || 'A document', at: x.at || '' }));
    // a transition summary for kindergarten or TK, only once the director has shared it, as it read when she shared it
    const tsAll = k.transitionSummary && typeof k.transitionSummary === 'object' ? k.transitionSummary : {};
    const tsY = Object.keys(tsAll).filter(y => tsAll[y] && tsAll[y].shared && tsAll[y].shared.sections && typeof tsAll[y].shared.sections === 'object').sort().pop();
    const tsSh = tsY ? tsAll[tsY].shared : null;
    const others = tsSh ? [...store.recs.children.entries()].filter(([, r]) => r && !r.deleted && r.doc).map(([id, r]) => Object.assign({ id }, r.doc)) : [];
    const transition = tsSh ? { at: tsSh.at || '', next: TS_NEXT[tsSh.plan] || '', age: ageText(k.dob), sections: TS_SECTIONS.map(([key, l]) => [l, tsSh.family && typeof tsSh.family === 'object' ? String(tsSh.family[key] || '').trim() : withoutOthers(String(tsSh.sections[key] || '').trim(), Object.assign({ id: k.id }, k), others)]).filter(([, v]) => v) } : null;
    // the TK and kindergarten guide, for a family whose child is going to TK or kindergarten next year
    const nyA = (() => { const d = new Date(); return (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1) + 1; })(); const nyKey = nyA + '-' + String(nyA + 1).slice(2);
    const nextPlan = ((k.transition || {})[nyKey] || {}).plan || '';
    let tkGuide = null; if (nextPlan === 'k' || nextPlan === 'tk') { try { tkGuide = (pieces ? pieces() || [] : []).find(p => p.audience === 'tk') || null; } catch (e) { tkGuide = null; } }
    const visit = k.visit && k.visit.date ? k.visit : null;
    const purpose = isNew(k) ? 'visit' : (c.confOpen && treeBooking() ? 'conference' : '');
    const open = purpose ? slots().filter(s => s.purpose === purpose && !!s.test === f.test && s.date >= today && (!s.classroom || s.classroom === k.classroom) && (!s.booked || s.booked.childId === k.id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(s => ({ id: s.id, date: s.date, time: s.time, minutes: s.minutes, with: s.with || '', mine: !!(s.booked && s.booked.childId === k.id) })) : [];
    const q = k.familyQuestionnaire || null;
    const ef = k.enrollForm || null;
    // what TREE already knows fills the form at first, so a family only checks it
    const split = n => { const w = String(n || '').trim().split(/\s+/); return { first: w[0] || '', last: w.length > 1 ? w[w.length - 1] : '' }; };
    const pa = (k.parents || []).filter(Boolean); const p1 = split(pa[0] && pa[0].name), p2 = split(pa[1] && pa[1].name);
    const prefill = { c_first: k.first || '', c_last: k.last || '', c_dob: String(k.dob || '').slice(0, 10), p1_first: p1.first, p1_last: p1.last, p1_home: (pa[0] && pa[0].cell) || '', p2_first: p2.first, p2_last: p2.last, p2_home: (pa[1] && pa[1].cell) || '' };
    return { enroll: isNew(k) ? { prefill, data: ef ? ef.data : null, done: !!(ef && ef.done), at: ef ? ef.at : '' } : null, isNew: isNew(k), conference, reflections, shared, files, transition, tkGuide, visit, slotPurpose: purpose, slots: open, strengths: (k.familyStrengths && k.familyStrengths.text) || '', strengthsAt: (k.familyStrengths && k.familyStrengths.at) || '', reflectedAt: cf && cf.status !== 'complete' ? cf.familyReflectedAt || '' : '', questionnaire: q ? { answers: q.answers || [], at: q.at || '' } : null,
      aboutMe: (() => { const am = k.aboutMe || {}; const ph = p => (p.photos || []).map(id => ({ id, src: photoSrc(id) }));
        const fixed = AAM_PAGES().map(([t, pr], i) => { const p = (am.pages || [])[i] || {}; return { title: t.replace(/\{first\}/g, firstOf(k)), prompt: pr.replace(/\{first\}/g, firstOf(k)), text: p.text || '', photos: ph(p) }; });
        return { done: !!am.done, at: am.at || '', pages: fixed.concat((am.pages || []).slice(AAM_PAGES().length).map(p => ({ title: p.title || 'More about me', custom: true, text: p.text || '', photos: ph(p) }))) }; })(),
      checks: isNew(k) ? Object.assign({}, k.familyChecks || {}) : null, agreement: isNew(k) ? (k.familyAgreement || null) : null, schedule: k.schedule || '', classroom: k.classroom || '',
      // earlier is the edition before this one that the family read, so a returning family is asked once to read the new one
      handbook: (() => { const y = hbYear(); const a = y && hbAck(k, y); if (!y) return null; const past = Object.keys(k.handbookAck || {}).filter(x => x < y).sort().pop() || (y > '2026' && hbAck(k, '2026') ? '2026' : ''); return { year: y, at: a ? a.at : '', earlier: past }; })() };
  }
  // families book conference times on the Family page only once the director switches booking from SignUpGenius to
  // TREE, in Conference settings. Until then the Family page offers no conference times.
  function treeBooking() { const r = store.recs.settings.get('main'); return !!(r && !r.deleted && r.doc && r.doc.conferenceBooking === 'tree'); }
  function book(f, slotId, childId, on) {
    const s0 = getRec(KIND, slotId), s = s0 && Object.assign(s0, { id: slotId }); const k = f.kids.find(x => x.id === childId);
    if (!s || s.kind !== 'slot' || !!s.test !== f.test || !k) return { error: 'That time is no longer open.' };
    if (s.purpose === 'conference' && !treeBooking()) return { error: 'Conference times are booked through the sign-up link the school sent.' };
    if (on) {
      if (s.booked && s.booked.childId !== childId) return { error: 'Someone just took that time. Choose another.' };
      if (s.classroom && s.classroom !== k.classroom) return { error: 'That time is for another class.' };
      // one time per child for each purpose, so choosing a new time lets the old one go
      for (const o of slots()) if (o.id !== s.id && o.purpose === s.purpose && o.booked && o.booked.childId === childId && !!o.test === f.test) save(o.id, Object.assign({}, o, { booked: null, updatedAt: nowIso() }));
      save(s.id, Object.assign({}, s, { booked: { childId, email: f.email, family: [k.first, k.last].filter(Boolean).join(' '), at: nowIso() }, updatedAt: nowIso() }));
      if (s.purpose === 'conference') {
        const p = season(s.date), id = confIdOf(childId, p); remember(f, 'conferences', id);
        const cur = getRec('conferences', id) || { childId, schoolYear: p.year, term: p.term, status: 'open', fields: {}, reflections: {}, prep: {}, attachments: [], createdAt: nowIso() };
        saveRec('conferences', id, Object.assign({}, cur, { confDate: s.date, confTime: s.time, signup: 'signedup', teacher: cur.teacher || s.with || '', bookedBy: 'family', updatedAt: nowIso(), updatedByName: 'Family page' }));
      } else { remember(f, 'children', childId); const kd = getRec('children', childId); saveRec('children', childId, Object.assign({}, kd, { visit: { date: s.date, time: s.time, with: s.with || '', slotId: s.id }, onboarding: Object.assign({}, kd.onboarding || {}, { started: true, visitScheduled: true }), updatedAt: nowIso() })); }
    } else {
      if (!s.booked || s.booked.childId !== childId) return { error: 'That time is not yours to change.' };
      save(s.id, Object.assign({}, s, { booked: null, updatedAt: nowIso() }));
      if (s.purpose === 'conference') { const p = season(s.date), id = confIdOf(childId, p); const cur = getRec('conferences', id); if (cur && cur.confDate === s.date) { remember(f, 'conferences', id); saveRec('conferences', id, Object.assign({}, cur, { confDate: '', confTime: '', signup: 'rescheduling', updatedAt: nowIso(), updatedByName: 'Family page' })); } }
      else { remember(f, 'children', childId); const kd = getRec('children', childId); const ob = Object.assign({}, kd.onboarding || {}); delete ob.visitScheduled; const nd = Object.assign({}, kd, { onboarding: ob, updatedAt: nowIso() }); delete nd.visit; saveRec('children', childId, nd); }
    }
    return { ok: true };
  }
  function reflect(f, childId, answers) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    const p = season(), id = confIdOf(childId, p); remember(f, 'conferences', id);
    const cur = getRec('conferences', id) || { childId, schoolYear: p.year, term: p.term, status: 'open', fields: {}, reflections: {}, prep: {}, attachments: [], createdAt: nowIso() };
    if (cur.status === 'complete') return { error: 'This conference is already complete.' };
    // the wording comes from the school's records, and a page that reads empty saves nothing
    if (!REFLECTIONS().length) return { error: 'This part of the Family page is being updated. Please try again later.' };
    const fam = {}; for (const [key] of REFLECTIONS()) fam[key] = String((answers || {})[key] || '').trim().slice(0, 3000);
    // the family's words go into the form's Family Reflections where the educator has not written anything yet
    const refl = Object.assign({}, cur.reflections || {}); const before = cur.familyReflections || {};
    for (const [key] of REFLECTIONS()) if (!String(refl[key] || '').trim() || refl[key] === before[key]) refl[key] = fam[key];
    saveRec('conferences', id, Object.assign({}, cur, { familyReflections: fam, reflections: refl, familyReflectedAt: nowIso(), updatedAt: nowIso(), updatedByName: 'Family page' }));
    return { ok: true };
  }
  function strengths(f, text) {
    const t = String(text || '').trim().slice(0, 3000);
    for (const k of f.kids) { remember(f, 'children', k.id); const kd = getRec('children', k.id); saveRec('children', k.id, Object.assign({}, kd, { familyStrengths: { text: t, at: nowIso(), by: f.email }, updatedAt: nowIso() })); }
    return { ok: true };
  }
  function questionnaire(f, childId, answers) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    // the wording comes from the school's records, and a page that reads empty saves nothing
    if (!QUESTIONS().length) return { error: 'This part of the Family page is being updated. Please try again later.' };
    const a = QUESTIONS().map((q, i) => String((answers || [])[i] || '').trim().slice(0, 3000));
    { const left = a.filter(x => !x).length; if (left) return { error: left === 1 ? 'Please answer every question. One is still empty.' : 'Please answer every question. ' + left + ' are still empty.' }; }
    remember(f, 'children', childId); const kd = getRec('children', childId);
    saveRec('children', childId, Object.assign({}, kd, { familyQuestionnaire: { answers: a, questions: QUESTIONS(), at: nowIso(), by: f.email }, onboarding: Object.assign({}, kd.onboarding || {}, { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  // the line from what the family typed, the foods and whether it is medical, kept short for a card or a list
  function dietFrom(d) {
    const v = k => String(d[k] == null ? '' : d[k]).trim(); if (!v('fa_has')) return null;
    if (!/^yes/i.test(v('fa_has'))) return { line: '', none: true };
    const food = v('fa_food').replace(/\s+/g, ' ').replace(/[.\s]+$/, ''); const med = /^yes/i.test(v('fa_medical'));
    let line = food.length > 120 ? food.slice(0, 117).replace(/\s+\S*$/, '') + '…' : food;
    if (med) line += (line ? ', ' : '') + 'medical';
    return { line, none: false, food: v('fa_food').slice(0, 600), reaction: v('fa_reaction').slice(0, 600) };
  }
  function contactsFrom(d) {
    const v = k => String(d[k] == null ? '' : d[k]).replace(/\s+/g, ' ').trim();
    return ['p1_', 'p2_'].map(p => ({ name: [v(p + 'first'), v(p + 'last')].filter(Boolean).join(' ').slice(0, 80), cell: (v(p + 'home') || v(p + 'work')).slice(0, 40) })).filter(x => x.name);
  }
  function enroll(f, childId, data, done) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    // the wording comes from the school's records, and a page that reads empty saves nothing
    if (!ENROLL_NOW().length) return { error: 'This part of the Family page is being updated. Please try again later.' };
    const keys = new Set(ENROLL_NOW().flatMap(s => s.fields.map(x => x.k)));
    const clean = {}; for (const [key, v] of Object.entries(data || {})) { if (key.startsWith('h_ill_')) { const b = key.slice(6); if (keys.has('h_ill')) clean[key] = String(v).slice(0, 200); continue; } if (keys.has(key)) clean[key] = typeof v === 'boolean' ? v : String(v == null ? '' : v).slice(0, 2000); }
    // complete means every box the form needs is filled in
    if (done) { const miss = enrollMissing(clean, ENROLL_NOW()); if (miss.length) return { error: 'Some boxes are still empty, ' + miss.slice(0, 6).map(x => x.label.toLowerCase()).join(', ') + (miss.length > 6 ? ', and ' + (miss.length - 6) + ' more' : '') + '.' }; }
    remember(f, 'children', childId); const kd = getRec('children', childId);
    const next = Object.assign({}, kd, { enrollForm: { data: clean, at: nowIso(), by: f.email, done: !!done }, onboarding: Object.assign({}, kd.onboarding || {}, { started: true }), updatedAt: nowIso() });
    // a submitted form leaves a short allergy and dietary line on the child, waiting for the office to confirm it
    if (done) { const p = dietFrom(clean); const d = Object.assign({}, kd.diet || {});
      if (p && d.at && p.none === !!d.none && p.line === String(d.line || '')) { delete d.pending; next.diet = d; }
      else if (p) next.diet = Object.assign(d, { pending: Object.assign(p, { at: nowIso(), by: f.email }) });
      // the parents' names and telephones the family typed are offered to the child's family contacts, for the office to
      // accept, so they are typed once. A contact already on file just as typed is not offered again.
      const offer = contactsFrom(clean).filter(o => !(kd.parents || []).some(x => x && String(x.name || '').trim().toLowerCase() === o.name.toLowerCase() && (!o.cell || String(x.cell || '').replace(/\D/g, '') === o.cell.replace(/\D/g, ''))));
      if (offer.length) next.contactsOffer = { parents: offer, at: nowIso(), by: f.email }; else delete next.contactsOffer; }
    saveRec('children', childId, next);
    return { ok: true };
  }
  // a photo for the All About Me book, kept with the school's photos
  async function photo(f, childId, data) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    const buf = Buffer.from(String(data || ''), 'base64'); if (buf.length < 1000 || buf.length > 6 * 1024 * 1024) return { error: 'That photo could not be used. Choose a smaller one.' };
    if (!(buf[0] === 0xff && buf[1] === 0xd8)) return { error: 'Choose a photo, such as a JPEG.' };
    const id = crypto.randomBytes(6).toString('hex') + '-aboutme.jpg';
    try { await keepPhoto(id, buf); } catch (e) { return { error: 'The photo could not be kept just now. Try again in a minute.' }; }
    return { id, src: photoSrc(id) };
  }
  function aboutMe(f, childId, pages, done) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    const list = (Array.isArray(pages) ? pages : []).slice(0, 16);
    const one = (p, i) => { p = p || {}; return Object.assign({ text: String(p.text || '').trim().slice(0, 1500), photos: (Array.isArray(p.photos) ? p.photos : []).filter(x => /^[0-9a-f]{12}-aboutme\.jpg$/.test(String(x))).slice(0, 4) }, i >= AAM_PAGES().length ? { title: String(p.title || '').trim().slice(0, 60) || 'More about me' } : {}); };
    const clean = AAM_PAGES().map((_, i) => one(list[i], i)).concat(list.slice(AAM_PAGES().length).map((p, j) => one(p, AAM_PAGES().length + j)).filter(p => p.text || p.photos.length));
    if (done && clean.some(p => !p.text || !p.photos.length)) return { error: 'Each page needs at least one photo and a few words before the book is ready.' };
    remember(f, 'children', childId); const kd = getRec('children', childId);
    saveRec('children', childId, Object.assign({}, kd, { aboutMe: { pages: clean, at: nowIso(), by: f.email, done: !!done }, onboarding: Object.assign({}, kd.onboarding || {}, done ? { started: true, aboutMe: true } : { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  // a step or a packed item the family ticks off on their checklist
  function check(f, childId, key, on) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    // the wording comes from the school's records, and a page that reads empty saves nothing. Reading the Family Handbook
    // and the notices does not depend on that wording, so a family can always tick those.
    if (key !== 'handbook' && key !== 'notices' && !CHECKS().length) return { error: 'This part of the Family page is being updated. Please try again later.' };
    if (![...CHECKS().map(c => c[0]), ...PACK().map(c => 'pack_' + c[0]), 'notices', 'handbook'].includes(key)) return { error: 'That step is not on the list.' };
    remember(f, 'children', childId); const kd = getRec('children', childId); const ch = Object.assign({}, kd.familyChecks || {}); if (on) ch[key] = nowIso(); else delete ch[key];
    const extra = {};
    // reading the Family Handbook is kept for the edition that is current, with who said so
    if (key === 'handbook') { const y = hbYear(); if (y) { const a = Object.assign({}, kd.handbookAck || {}); if (on) a[y] = { at: nowIso(), by: f.email }; else delete a[y]; extra.handbookAck = a; } }
    saveRec('children', childId, Object.assign({}, kd, { familyChecks: ch, updatedAt: nowIso() }, extra)); return { ok: true };
  }
  // the Admission Agreement, completed, initialed and signed by the family. Once signed it is kept as it is, and the office reopens it for a change.
  function agreement(f, childId, b, submit) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    remember(f, 'children', childId); const kd = getRec('children', childId);
    if (kd.familyAgreement && kd.familyAgreement.done) return { error: 'This agreement is signed. Please contact the office to make a change.' };
    b = b || {}; const str = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 200);
    const fields = {}; AG().FIELDS.forEach(([key]) => { fields[key] = str((b.fields || {})[key]); });
    const n = AG().count();
    const ag = { fields, program: AG().PROGRAMS.some(p => p[0] === b.program) ? b.program : '', addons: AG().ADDONS.map(a => a[0]).filter(a => (b.addons || []).includes(a)),
      initials: str(b.initials, 5).replace(/[^A-Za-z.\s]/g, '').toUpperCase(), ticks: Array.from({ length: n }, (_, i) => !!(Array.isArray(b.ticks) && b.ticks[i])),
      sign1: { name: str((b.sign1 || {}).name, 100) }, sign2: { name: str((b.sign2 || {}).name, 100) }, esign: !!b.esign, aa: cfg().aa || {}, at: nowIso(), by: f.email, done: false };
    if (submit) {
      const miss = AG().missing(ag); if (miss.length) return { error: 'Please complete ' + miss.slice(0, 5).join(', ') + (miss.length > 5 ? ', and ' + (miss.length - 5) + ' more' : '') + '.' };
      ag.done = true; ag.signedAt = nowIso(); ag.sign1.at = ag.signedAt; if (ag.sign2.name) ag.sign2.at = ag.signedAt;
    }
    saveRec('children', childId, Object.assign({}, kd, { familyAgreement: ag, onboarding: Object.assign({}, kd.onboarding || {}, { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  function file(f, id) {
    for (const k of f.kids) { const kd = getRec('children', k.id); if ((kd.sharedFiles || []).some(x => x && x.id === id)) return { path: photoSrc(id) }; }
    return { error: 'That document is not shared with you.' };
  }
  // this week's and next week's menu, and the closures coming up, from the menus the kitchen keeps
  function menuWeeks(today) {
    const t = new Date(today + 'T12:00:00'); const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const days = [], closures = [];
    for (let i = 0; i < 14; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); if (d.getDay() === 0 || d.getDay() === 6) continue; const iso = d.toISOString().slice(0, 10);
      const m = getRec('menus', iso.slice(0, 7)); const x = m && m.days ? m.days[iso] || {} : {}; days.push({ date: iso, closed: !!x.closed, am: x.am || '', lunch: x.lunch || '', pm: d.getDay() === 1 ? '' : (x.pm || '') }); }
    for (let i = 0; i < 60; i++) { const d = new Date(t); d.setDate(t.getDate() + i); const iso = d.toISOString().slice(0, 10); const m = getRec('menus', iso.slice(0, 7)); if (m && m.days && m.days[iso] && m.days[iso].closed) closures.push(iso); }
    // the bin note the director posted this week, and the kitchen's recipe of the month
    let binNote = ''; for (const [id, r] of store.recs.grant || []) { const d = r && !r.deleted && r.doc; if (!d || !/^binnote-/.test(id) || d.status !== 'posted') continue; if (String(d.week || '') >= days[0].date.slice(0, 10) && (!binNote || String(d.week) > binNote.week)) binNote = { week: d.week, text: d.text || '' }; }
    const mr = getRec('menus', today.slice(0, 7)) || {};
    // the newsletters the director posted to the Family page, the latest first
    const news = [];
    for (const [id, r] of store.recs.newsletters || []) { const d = r && !r.deleted && r.doc; if (!d || !d.posted || !Array.isArray(d.posted.blocks)) continue;
      news.push({ month: d.month || '', title: d.posted.title || '', at: d.posted.at || 0, blocks: d.posted.blocks.map(b => ({ h: String(b.h || ''), text: String(b.text || ''), photos: (b.photos || []).filter(x => x && x.id).map(x => ({ src: photoSrc(x.id), cap: String(x.cap || '') })) })) }); }
    news.sort((a, b) => String(b.month).localeCompare(String(a.month)));
    // the recipe of the month comes from the recipe library. A month from before the library keeps its own words.
    const lib = mr.recipeId && recipeOf ? recipeOf(mr.recipeId) : null;
    const recipe = lib ? { name: lib.title, text: lib.text } : mr.recipeCard ? { name: mr.recipe || 'Recipe of the month', text: mr.recipeCard } : null;
    return { news: news.slice(0, 6), days, closures, binNote: binNote ? binNote.text : '', recipe };
  }

  // events ask how many adults and children are coming, unless the school turned that off; a task asks who is coming
  const asksCounts = it => it.counts == null ? it.type === 'event' : !!it.counts;
  function signUp(f, itemId, on, b) {
    const r = recs().get(itemId); const it = r && !r.deleted && r.doc; if (!it || it.kind !== 'item' || !!it.test !== f.test) return { error: 'That is no longer open.' };
    const had = (it.signups || []).find(s => s.email === f.email); const ss = (it.signups || []).filter(s => s.email !== f.email);
    if (on) { if (it.open === false) return { error: 'That is no longer open.' }; if (!had && Number(it.spots) > 0 && ss.length >= Number(it.spots)) return { error: 'Every spot is taken.' };
      b = b || {}; const who = String(b.who || '').trim().slice(0, 120); if (!who) return { error: it.type === 'wish' ? 'Say who is bringing it.' : 'Say who is coming.' };
      const n = x => Math.max(0, Math.min(30, Math.round(Number(x) || 0)));
      const names = [...new Set(f.kids.map(k => [k.first, k.last].filter(Boolean).join(' ')))].join(' and ');
      const e = { email: f.email, family: names, who, at: had ? had.at : nowIso() };
      if (asksCounts(it)) { e.adults = n(b.adults); e.children = n(b.children); if (!e.adults) return { error: 'Say how many adults are coming.' }; }
      if (it.question) e.answer = String(b.answer || '').trim().slice(0, 300);
      ss.push(e); }
    save(itemId, Object.assign({}, it, { signups: ss, updatedAt: nowIso() })); return { ok: true };
  }
  // a family's recipe, from the Family page, waits as a draft for the director, in place of the 2022 Google Form. It can
  // count as participation the usual way, by logging the time it took.
  function shareRecipe(f, b) {
    b = b || {}; if (!addRecipe) return { error: 'Recipes cannot be shared just now.' };
    const lines = v => String(v || '').replace(/\r/g, '').split('\n').map(x => x.trim().replace(/^[-*]\s+/, '')).filter(Boolean).slice(0, 60).map(x => '- ' + x.slice(0, 300)).join('\n');
    if (!String(b.title || '').trim()) return { error: 'Give the recipe a name.' };
    if (!lines(b.ingredients) || !lines(b.steps)) return { error: 'Add the ingredients and the steps.' };
    if (/\b(peanuts?|almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|nut butter)\b/i.test([b.ingredients, b.steps].join(' '))) return { error: 'We are nut free, so we cannot use a recipe with nuts.' };
    const last = [...new Set(f.kids.map(k => k.last).filter(Boolean))].join(' and ');
    const r = addRecipe(f.email, { kind: 'recipe', title: b.title, sensory: false, source: 'A family', ingredients: lines(b.ingredients), steps: lines(b.steps), notes: lines(b.story) });
    if (r.error) return r; log('A family shared a recipe'); return { ok: true };
  }
  // a family offers a specialty or passion visit. It goes to the director first, who sends it to a class team and then
  // schedules it. Whether the visitor is a parent, relative or guardian of an enrolled child decides the licensing note.
  function offerVisit(f, b) {
    const what = String(b.what || '').replace(/\s+/g, ' ').trim().slice(0, 600); if (!what) return { error: 'Say what you would like to share.' };
    const who = String(b.who || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!who) return { error: 'Say who would visit.' };
    if (typeof b.isFamily !== 'boolean') return { error: 'Say whether the visitor is a parent, relative or guardian of a child here.' };
    if (listOf(d => d.kind === 'visit' && d.email === f.email && ['new', 'with-team'].includes(d.status)).length >= 5) return { error: 'You have five ideas waiting already. The director will be in touch.' };
    const names = [...new Set(f.kids.map(k => [k.first, k.last].filter(Boolean).join(' ')))].join(' and ');
    const id = newId('vi');
    save(id, { id, kind: 'visit', status: 'new', email: f.email, family: names, childIds: f.kids.map(k => k.id), classrooms: [...new Set(f.kids.map(k => k.classroom).filter(Boolean))], what, who, isFamily: b.isFamily, when: String(b.when || '').trim().slice(0, 300), test: f.test, at: nowIso() });
    log('A family offered a specialty visit'); return { ok: true };
  }
  function addLog(f, b) {
    const kid = f.kids.find(k => k.id === b.childId); if (!kid) return { error: 'Choose which child this counts for.' };
    let what = String(b.what || '').trim().slice(0, 200), itemId = '', jobId = '', date = String(b.date || '').slice(0, 10), minutes = Number(b.minutes) || 0;
    // a family names what an entry counts as. A conference is entered by TREE, never by a family.
    let type = ['job', 'event', 'donation'].includes(b.type) ? b.type : 'job';
    if (b.itemId) { const r = recs().get(b.itemId); const it = r && !r.deleted && r.doc; if (!it || it.kind !== 'item') return { error: 'That is no longer listed.' }; itemId = b.itemId; what = what || it.title; date = date || (it.date && it.date <= laToday() ? it.date : laToday()); if (!minutes) minutes = (Number(it.hours) || 1) * 60; type = it.type === 'event' ? 'event' : it.type === 'wish' ? 'donation' : 'job'; }
    else if (b.jobId) { const j = volunteer && volunteer.job(String(b.jobId)); if (!j) return { error: 'That job is no longer listed.' }; jobId = j.id; what = j.title; type = 'job'; }
    if (!what) return { error: 'Say what you did.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > laToday()) return { error: 'Choose the day, today or earlier.' };
    if (!(minutes > 0) || minutes > 24 * 60) return { error: 'Say how long it took.' };
    const id = newId('lg');
    save(id, { id, kind: 'log', type, email: f.email, childId: kid.id, itemId, ...(jobId ? { jobId } : {}), what, date, minutes, hours: hoursOf(minutes), test: f.test, at: nowIso() });
    return { ok: true };
  }
  function removeLog(f, id) {
    const r = recs().get(id); const l = r && !r.deleted && r.doc; if (!l || l.kind !== 'log' || l.email !== f.email) return { error: 'That entry is not yours to change.' };
    save(id, Object.assign({}, l, { removed: true, removedBy: 'family', removedAt: nowIso() })); return { ok: true };
  }

  // ---------- the public page, no sign-in ----------
  // the month's menu and the month before's Farm to School story, from the menus and FEED bins the staff already keep.
  // Families get the menu before the month starts, so the farms are counted from the month before.
  function publicMenu(month) {
    const now = new Date(); const m = /^\d{4}-\d{2}$/.test(month || '') ? month : laToday().slice(0, 7);
    const mr = store.recs.menus.get(m); const menu = mr && !mr.deleted && mr.doc ? { month: m, days: mr.doc.days || {}, notes: mr.doc.notes || {}, times: mr.doc.times || {} } : null;
    const d = new Date(m + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); const prev = d.toISOString().slice(0, 7);
    // only the bins that came to us, our Tuesday bins and any added by hand, never FEED's other delivery days
    const farms = {}; let bins = 0;
    for (const [id, r] of store.recs.bins) { const b = r.doc; if (r.deleted || !b || !/^\d{4}-\d{2}-\d{2}$/.test(id) || id.slice(0, 7) !== prev || !(b.tuesday || b.source === 'hand')) continue; bins++;
      for (const it of b.items || []) for (const f of it.farms || []) { const k = String(f).trim(); if (!k) continue; (farms[k] = farms[k] || []).push(it.name); } }
    const fr = store.recs.bins.get('farms'); const towns = fr && !fr.deleted && fr.doc && fr.doc.towns ? fr.doc.towns : {};
    const months = [...store.recs.menus.keys()].filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    // our cheese and our beans and grains come from the same producers each time, named only in a month whose menu has them
    const pr = store.recs.menus.get(prev); const ate = pr && !pr.deleted && pr.doc ? Object.values(pr.doc.days || {}).filter(x => x && !x.closed).map(x => [x.lunch, x.am, x.pm].filter(Boolean).join(' ')).join(' ') : '';
    const standing = []; if (/cheese|pizza|quesadilla/i.test(ate)) standing.push('Petaluma Creamery'); if (/\bbeans?\b|lentil|quinoa|farro|barley|\brice\b(?! cakes?)/i.test(ate)) standing.push('Next Generation Foods');
    return { menu, prev, bins, farms, towns, months, standing, grantEnd: '2027-06-30' };
  }

  return { offerVisit, conferenceHours, typeOf, withoutOthers, withoutRatings, agreement, check, photo, aboutMe, sendCode, signIn, readFamily, familyView, signUp, shareRecipe, addLog, removeLog, publicMenu, cfg, hoursOf, yearStart, book, reflect, strengths, questionnaire, file, enroll, QUESTIONS, ENROLL: ENROLL_NOW, DEFAULT_WELCOME };
};
// the family copy's two rules, shared with the Family Summary a conference sends home
module.exports.withoutOthers = withoutOthers;
module.exports.EVERYDAY = EVERYDAY;
module.exports.NEVER_NAMES = NEVER_NAMES;
module.exports.withoutRatings = withoutRatings;
module.exports.DEFAULT_WELCOME = DEFAULT_WELCOME;
