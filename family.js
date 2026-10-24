'use strict';
/* The Family page. Families sign in with an email on file and a six-digit code, and see only their own children.
   They find ways to take part, log what they did, choose which child it counts for, and see each child's hours.
   Records live under participation/ in the school's records. config holds test mode and the testers.
   While test mode is on, only a tester's email signs in, linked by the director to real children, nothing is emailed,
   the code shows on the page, and everything made is marked test so it can be cleared before going live.
   A family's sign-in is signed differently from a staff sign-in, so it never opens anything on the staff side. */
const crypto = require('crypto');

// the questions on Fulton's Family Questionnaire, as the school gives it at enrollment
const QUESTIONS = ['Are there any nicknames or a name that your child prefers to be called by?', 'Does your child have siblings? Do they live in the same residence? If so, please list names and ages.', 'Who lives in your home?', "Who do you prefer we talk to regarding your child's daily activities or if concerns should arise?", 'What kinds of activities and interests does your child have?', "What are your child's strengths?", 'Where does your child struggle?', 'What are your hopes and goals for your child in our program?', 'As a family, what do you do for fun?', "Who are the important people in your child's life? Please list their names and their relationship to your child.", 'Do you have any pets? If so, names and type?', 'How is discipline handled in your home?', 'How does your child behave at home when they are happy?', 'Sad?', 'Angry?', 'Tired?', 'What is the primary language spoken in your home? Please write down some words in your home language that may be important to your child.', "What are your goals in relation to your child's development?", "Do you have questions or concerns regarding your child's development or behavior?", 'What is mealtime like in your home? Do you have any special mealtime routines?', "What time is your child's bedtime? What time does your child wake up in the morning?", 'Are there any food likes, dislikes, allergies or dietary restrictions due to religious or cultural traditions that we should be aware of?', 'Are there any health concerns that we should be aware of?', 'How do you prefer to be contacted for events, scheduled meetings, or information?', 'Is there anything else that you would like us to know about you or your child?'];
// the Family Reflections on the conference form, which a family can answer before the conference
const REFLECTIONS = [['r1', 'What are you noticing about your child at home right now?'], ['r2', 'What are they especially interested in or talking about outside of school?'], ['r3', 'Are there any changes, new developments, or challenges you have noticed?'], ['r4', 'Which friends, educators, or small group projects does your child mention?'], ['r5', 'Looking back at the hopes and goals you shared at enrollment, what feels most important to you now?'], ['r6', 'Is there anything you are wondering about or would like us to think about together?']];
// the sections of the conference form a family sees once the director shares the notes
const CONF_FIELDS = [['interests', 'Main Interests'], ['friends', 'Friends'], ['smallGroup', 'Small Group Work and Current Inquiry'], ['favoriteAreas', 'Favorite Areas and Activities'], ['nature', 'Connection to Nature and the Farm'], ['approaches', 'Approaches to Learning and Self-Regulation'], ['social', 'Social and Emotional Development'], ['language', 'Language and Literacy'], ['cognition', 'Cognition (math and science)'], ['physical', 'Physical Development and Health'], ['expressive', 'Expressive Languages'], ['strengths', 'Strengths'], ['goals', 'Shared Goals (school and home)'], ['nextSteps', 'Next Steps']];
// the enrollment information the state forms ask for, LIC 700, 702, 627 and the sunscreen consent on LIC 9221, typed once
// by the family. Office staff print the filled forms for the family to sign at the pre-start visit.
const enrollMissing = require('./enroll-rules.js');
// the All About Me book, four pages the family makes with photos and words. The school prints and laminates it.
const CHECKS = [['onecore', 'Install the 1Core Family app', 'Turn on camera and location access, and use your existing portal login.', [['Google Play', 'https://play.google.com/store/apps/details?id=com.onecore.parent'], ['App Store', 'https://apps.apple.com/us/app/1core-family/id1503487259']]],
  ['kaymbu', 'Install Kaymbu for Families', 'We use it for classroom photos and updates.', [['Google Play', 'https://play.google.com/store/apps/details?id=com.kaymbu.androidapp'], ['App Store', 'https://apps.apple.com/us/app/kaymbu-for-families/id1238915455']]],
  ['pickup', 'List everyone who drops off or picks up', 'In the 1Core parent portal. Each person signs your child in or out with the app or their own 4-digit code. Educators cannot sign children in or out.', [['1Core parent portal', 'https://family.1core.com/']]],
  ['portal', 'Finish your parent portal profile', 'On a computer, add all family, child and contact information and set up your payment method.', [['1Core parent portal', 'https://family.1core.com/']]]];
// the first day, packed and labeled. Rain gear stays at school all season.
const PACK = [['bottle', 'A reusable water bottle with your child\'s name, water only, washed daily'], ['clothes', 'Three full sets of clothes, with shirts, pants, underwear and socks'], ['shoes', 'Close-toed slip-on or Velcro shoes, unless your child ties laces'], ['spare', 'An extra pair of slip-on shoes or slippers for inside'],
  ['rain', 'A waterproof rain suit, or waterproof rain pants and a jacket, waterproof and not only water resistant'], ['boots', 'Rain boots with no fabric lining, easy to pull on and off'], ['wetbag', 'A reusable wet bag for wet or muddy clothes'], ['blanket', 'A thin blanket if your child naps, and a small comfort item if you like'], ['labels', 'Everything labeled with your child\'s name']];
const AGREE = require('./agreement.js');
const AAM_PAGES = [['All About {first}', 'A current photo of {first}, and a few words about {first}.'], ['My family', 'Who lives in my home, and who is important to me.'], ['Things I like', 'Toys, places, songs, books, anything {first} loves.'], ['Foods I like', 'The foods {first} enjoys most.']];
const T = (k, label, extra) => Object.assign({ k, label, type: 'text' }, extra || {});
const person = (p, who) => [T(p + 'first', who + ', first name'), T(p + 'middle', 'Middle name'), T(p + 'last', 'Last name')];
const addr = (p, lead) => [T(p + 'street', lead || 'Street address'), T(p + 'city', 'City'), T(p + 'state', 'State', { value: 'CA' }), T(p + 'zip', 'Zip code')];
const ENROLL = [
  { title: 'Your child', fields: [...person('c_', 'Child'), T('c_sex', 'Sex'), T('c_dob', 'Birthday', { type: 'date' }), T('c_phone', 'Home telephone'), ...addr('c_', 'Home street address')] },
  { title: 'First parent or authorized representative', fields: [...person('p1_', 'Name'), T('p1_home', 'Home telephone'), T('p1_work', 'Work telephone'), T('p1_same', 'Lives at the child\'s home address', { type: 'check', value: true }), ...addr('p1_'), T('p1_lives', 'Lives in the home with the child', { type: 'yn' })] },
  { title: 'Second parent or authorized representative', note: 'Leave empty if there is no second parent.', fields: [...person('p2_', 'Name'), T('p2_home', 'Home telephone'), T('p2_work', 'Work telephone'), T('p2_same', 'Lives at the child\'s home address', { type: 'check', value: true }), ...addr('p2_'), T('p2_lives', 'Lives in the home with the child', { type: 'yn' })] },
  { title: 'Person responsible for the child, if not a parent', note: 'Leave empty if a parent is responsible.', fields: [...person('r_', 'Name'), T('r_home', 'Home telephone'), T('r_work', 'Work telephone')] },
  { title: 'People to call in an emergency', note: 'Up to four, other than the parents.', fields: [1, 2, 3, 4].flatMap(i => [T('e' + i + '_name', 'Person ' + i + ', name'), T('e' + i + '_phone', 'Telephone'), T('e' + i + '_rel', 'Relationship to the child'), T('e' + i + '_addr', 'Address')]) },
  { title: 'Doctor and dentist', fields: [T('doc_name', 'Doctor\'s name'), T('doc_phone', 'Doctor\'s telephone'), T('doc_addr', 'Doctor\'s address'), T('doc_plan', 'Medical plan and number'), T('den_name', 'Dentist\'s name'), T('den_phone', 'Dentist\'s telephone'), T('den_addr', 'Dentist\'s address'), T('den_plan', 'Dental plan and number'),
    T('noreach', 'If the doctor cannot be reached', { type: 'choice', options: ['Call the emergency hospital', 'Other'], value: 'Call the emergency hospital' }), T('noreach_other', 'If other, what should be done'), T('med_allergy', 'Medicines the child is allergic to')] },
  { title: 'People who may take your child from school', note: 'Your child will not be released to anyone else without your written permission. Up to five.', fields: [1, 2, 3, 4, 5].flatMap(i => [T('a' + i + '_name', 'Person ' + i + ', name'), T('a' + i + '_rel', 'Relationship to the child')]).concat([T('pickup_time', 'Usual pickup time')]) },
  { title: 'Health history', fields: [T('h_regular', 'Is or has the child been under the regular care of a doctor?'), T('h_lastexam', 'Date of the last physical exam', { type: 'date' }), T('h_walked', 'Walked at how many months'), T('h_talked', 'Began talking at how many months'), T('h_toilet', 'Toilet training started at how many months'),
    T('h_ill', 'Illnesses the child has had, with about when', { type: 'illness', options: [['chickenpox', 'Chicken pox'], ['asthma', 'Asthma'], ['rheumatic', 'Rheumatic fever'], ['hayfever', 'Hay fever'], ['diabetes', 'Diabetes'], ['epilepsy', 'Epilepsy'], ['whooping', 'Whooping cough'], ['mumps', 'Mumps'], ['polio', 'Polio'], ['rubeola', 'Ten-day measles (rubeola)'], ['rubella', 'Three-day measles (rubella)']] }),
    T('h_other', 'Any other serious illnesses or accidents', { type: 'area' }), T('h_colds', 'Does the child have frequent colds?', { type: 'yn' }), T('h_coldsn', 'How many in the last year'), T('h_allergies', 'Allergies staff should be aware of', { type: 'area' })] },
  { title: 'Daily routines', fields: [T('d_wake', 'What time does your child get up?'), T('d_bed', 'What time does your child go to bed?'), T('d_sleepwell', 'Does your child sleep well?'), T('d_nap', 'Does your child sleep during the day?'), T('d_napwhen', 'When'), T('d_naplong', 'How long'),
    T('d_bfast', 'What does your child usually eat for breakfast?'), T('d_lunch', 'For lunch?'), T('d_dinner', 'For dinner?'), T('d_bfast_t', 'Usual breakfast time'), T('d_lunch_t', 'Usual lunch time'), T('d_dinner_t', 'Usual dinner time'), T('d_dislikes', 'Any food dislikes?'), T('d_eatprob', 'Any eating problems?'),
    T('d_toilet', 'Is your child toilet trained?', { type: 'yn' }), T('d_stage', 'If yes, at what stage'), T('d_bm', 'Are bowel movements regular?', { type: 'yn' }), T('d_bmtime', 'Usual time'), T('d_bmword', 'Word used for bowel movement'), T('d_uword', 'Word used for urination')] },
  { title: 'Your view of your child', fields: [T('v_health', 'How would you describe your child\'s health?', { type: 'area' }), T('v_doctor', 'Is your child under a doctor\'s care now?', { type: 'yn' }), T('v_doctorname', 'If yes, the doctor\'s name'), T('v_meds', 'Does your child take prescribed medicine?', { type: 'yn' }), T('v_medswhat', 'If yes, what kind and any side effects'),
    T('v_device', 'Does your child use any special device?', { type: 'yn' }), T('v_devicewhat', 'If yes, what kind'), T('v_devhome', 'Any special device at home?', { type: 'yn' }), T('v_devhomewhat', 'If yes, what kind'),
    T('v_personality', 'How would you describe your child\'s personality?', { type: 'area' }), T('v_along', 'How does your child get along with parents, brothers, sisters and other children?', { type: 'area' }), T('v_group', 'Has your child had group play experiences?'), T('v_needs', 'Any special problems, fears or needs?', { type: 'area' }), T('v_ill', 'What is the plan for care when your child is ill?'), T('v_reason', 'Reason for requesting child care')] },
  { title: 'Food allergies and dietary needs', note: 'A severe food allergy is a dangerous or life-threatening reaction to a food, by breathing, eating or touching it, that needs medical care right away. Fulton is a nut free school. If the need is medical, please bring a note from your doctor to your visit.', fields: [T('fa_has', 'Does your child have a food allergy, a severe food allergy, or a dietary need?', { type: 'yn' }), T('fa_food', 'If yes, the foods your child is allergic to or must avoid', { type: 'area' }), T('fa_reaction', 'If yes, what happens, the nature of the reaction or sensitivity', { type: 'area' }), T('fa_reason', 'If yes, the reason, such as an allergy, a medical condition, religion or family values'), T('fa_medical', 'If yes, is it because of a medical condition?', { type: 'yn' })] },
  { title: 'Sunscreen', fields: [T('sun', 'I give permission for staff to apply school provided sunscreen to my child.', { type: 'check', value: true })] },
];
// the welcome letter new families see first, from Fulton's Welcome Letter and Logistics. The office can change it on the Participation page.
const DEFAULT_WELCOME = "We are so excited to welcome your family to Fulton Community School & Farm. This is an exciting time for your family and a new adventure to embark upon. Your checklist below walks you through everything to do before the first day, including your [1Core parent portal](https://family.1core.com/). We look forward to seeing you in person soon!\n\n### Arriving each day\nPlease arrive between 8:30 and 8:50 AM so your child can use the bathroom, wash hands, fill their water bottle and have sunscreen on, then meet their educators. Children should be settled by 9:00 AM.\n\n### Every day, rain or shine\nAll children go outside every day, including rainy days. Rain changes our outdoor spaces and offers new possibilities for play and learning, and children know when they are prepared. Your checklist lists the rain gear and clothes to keep at school.\n\n### Using the bathroom at Fulton\nChildren at Fulton use the bathroom independently. Before your child comes to school in underwear, they need to be fully independent in the bathroom and tell us when they need to go. Until then, please send diapers or pull-ups.\n\n### Saying goodbye\nGoodbyes can be hard, and that is normal. Feelings change from day to day and month to month, just like they do for adults. A brief, predictable goodbye of a couple of minutes helps most. Let your child know they are going to school, share a short book or activity, give a hug, say \"Goodbye, I will come back and pick you up,\" and tell an educator you are leaving. Please do not leave without saying goodbye. Educators will comfort your child and call you if your child keeps having a hard time.\n\n### Your visit and the All About Me book\nChoose a visit time on this page. Welcoming children before their first day helps them feel secure and connected. Make the All About Me book here too, and we print and laminate it so your child can share it with friends.\n\n### Important reminders\n- Please tell us in person about any allergies, sensitivities or dietary needs on the school visit day, even if they are on your forms.\n- No outside food. Nuts of any kind are not allowed because of severe allergies.\n- Children must be free of symptoms for 24 hours before returning to school.\n\n### School hours\nMorning program 8:30 AM to 12:00 PM. Full day, Monday 8:30 AM to 12:30 PM and Tuesday to Friday 8:30 AM to 4:00 PM. Early care 7:30 to 8:30 AM and after care Tuesday to Friday 4:00 to 5:00 PM, with advance sign-up. Late pickup is $1 per minute. To change your schedule, email the director.";
const CALENDAR_URL = 'https://calendar.google.com/calendar/embed?src=c_fb2e747462e605bde4e83259ffadf24b98a87617bb24eca797ad223dc34930d2%40group.calendar.google.com&ctz=America%2FLos_Angeles';
const HANDBOOK_URL = 'https://docs.google.com/document/d/1rV5B3qqimv6iAdAL_pCUiOuZ5UU443Gh/edit?usp=sharing';

module.exports = function family({ store, log, sign, noteChange, scheduleSave, mailCode, fileKey, keepPhoto }) {
  const KIND = 'participation';
  const recs = () => store.recs[KIND];
  const cfg = () => { const r = recs().get('config'); const d = r && !r.deleted && r.doc ? r.doc : {}; return { test: d.test !== false, goal: Number(d.goal) > 0 ? Number(d.goal) : 10, testers: Array.isArray(d.testers) ? d.testers : [], confOpen: !!d.confOpen, aa: d.aa && typeof d.aa === 'object' ? d.aa : {}, welcome: typeof d.welcome === 'string' ? d.welcome : '' }; };
  const getRec = (kind, id) => { const r = store.recs[kind].get(id); return r && !r.deleted && r.doc ? r.doc : null; };
  function saveRec(kind, id, doc) { const cur = store.recs[kind].get(id); store.recs[kind].set(id, { doc, sha: cur && cur.sha, path: `${kind}/${id}.json`, local: true }); noteChange(kind, id); scheduleSave(kind, id); }
  // in test mode, what a family changes on a real child or conference is remembered once, so Clear test entries can put it back
  function remember(f, kind, id) {
    if (!f.test) return; const uid = 'undo-' + kind + '-' + id; if (recs().get(uid) && !recs().get(uid).deleted) return;
    const prev = getRec(kind, id); save(uid, { id: uid, kind: 'undo', target: kind, tid: id, prev: prev ? JSON.parse(JSON.stringify(prev)) : null, test: true, at: nowIso() });
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
      // test mode emails no one. A tester sees the code here, and anyone else is told plainly the page is not open yet
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
  const items = () => listOf(d => d.kind === 'item');
  const logs = () => listOf(d => d.kind === 'log' && !d.removed);
  const firstOf = k => k.first || 'Your child';
  function familyView(f) {
    const c = cfg(); const ys = yearStart(); const ids = new Set(f.kids.map(k => k.id)); const today = new Date().toISOString().slice(0, 10);
    const mine = logs().filter(l => ids.has(l.childId) && (l.date || '') >= ys && !!l.test === f.test);
    const hours = f.kids.map(k => ({ id: k.id, first: firstOf(k), classroom: k.classroom || '', hours: mine.filter(l => l.childId === k.id).reduce((a, l) => a + (Number(l.hours) || 0), 0), goal: c.goal }));
    const open = items().filter(it => it.open !== false && !!it.test === f.test && (!it.date || it.date >= today) && (!it.classroom || f.kids.some(k => k.classroom === it.classroom)))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
      .map(it => { const ss = it.signups || []; return { id: it.id, type: it.type, title: it.title, note: it.note || '', date: it.date || '', start: it.start || '', end: it.end || '', hours: Number(it.hours) || 0, spots: Number(it.spots) || 0, taken: ss.length, mine: ss.some(s => s.email === f.email), counts: asksCounts(it), question: it.question || '', my: (({ who, adults, children, answer } = {}) => ({ who, adults, children, answer }))(ss.find(s => s.email === f.email)) }; });
    // what this family signed up for that has happened and is not logged yet, so logging it is one tap
    const signed = items().filter(it => !!it.test === f.test && (it.signups || []).some(s => s.email === f.email) && (it.type === 'wish' ? it.status !== 'requested' : (it.date && it.date <= today && it.date >= ys)) && !mine.some(l => l.itemId === it.id))
      .map(it => ({ id: it.id, title: it.title, date: it.date, hours: Number(it.hours) || 0, type: it.type }));
    const kidsOut = hours.map(h => Object.assign(h, childExtras(f, f.kids.find(k => k.id === h.id), c, today)));
    const entries = mine.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(l => ({ id: l.id, what: l.what, date: l.date, hours: l.hours, child: firstOf(f.kids.find(k => k.id === l.childId) || {}), childId: l.childId, mine: l.email === f.email }));
    const anyNew = kidsOut.some(k => k.isNew);
    const pace = (() => { const t = new Date(), y = t.getMonth() >= 7 ? t.getFullYear() : t.getFullYear() - 1; const a = new Date(y, 7, 15).getTime(), b = new Date(y + 1, 4, 31).getTime(); return Math.floor(c.goal * Math.min(1, Math.max(0, (t.getTime() - a) / (b - a)))); })();
    const me = ((f.kids.flatMap(k => k.parents || []).find(p => p && norm(p.email) === f.email) || {}).name) || '';
    return { test: f.test, goal: c.goal, pace, me, kidCount: f.kids.length, children: kidsOut, open, signed, entries, yearFrom: ys, menu: menuWeeks(today), calendarUrl: CALENDAR_URL, handbookUrl: HANDBOOK_URL,
      welcome: anyNew ? (c.welcome || DEFAULT_WELCOME) : '', aa: anyNew ? c.aa : {}, email: f.email, checks: anyNew ? CHECKS : [], pack: anyNew ? PACK : [], questions: anyNew ? QUESTIONS : [], enrollForm: anyNew ? ENROLL : [], reflectionQs: REFLECTIONS, confOpen: c.confOpen };
  }

  function save(id, doc) { const cur = recs().get(id); recs().set(id, { doc, sha: cur && cur.sha, path: `${KIND}/${id}.json`, local: true }); noteChange(KIND, id); scheduleSave(KIND, id); }

  // ---------- conferences, visits, sharing, strengths and the questionnaire ----------
  const slots = () => listOf(d => d.kind === 'slot');
  function childExtras(f, k, c, today) {
    const p = season(); const cf = getRec('conferences', confIdOf(k.id, p));
    const conference = cf && cf.confDate ? { date: cf.confDate, time: cf.confTime || '', with: cf.teacher || '', format: cf.format || '', season: p.term + ' ' + p.year, complete: cf.status === 'complete' } : null;
    const reflections = cf && cf.status !== 'complete' ? Object.fromEntries(REFLECTIONS.map(([key]) => [key, (cf.familyReflections || {})[key] || ''])) : null;
    const shared = []; for (const [id, r] of store.recs.conferences) { const d = r.doc; if (r.deleted || !d || d.childId !== k.id || !d.sharedWithFamily) continue;
      shared.push({ id, label: d.term === 'Historical' ? 'An earlier conference' : `${d.term} ${d.schoolYear}`, date: d.confDate || '', sections: CONF_FIELDS.map(([key, l]) => [l, String((d.fields || {})[key] || '').trim()]).filter(([, v]) => v) }); }
    shared.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const files = (k.sharedFiles || []).filter(x => x && x.id).map(x => ({ id: x.id, title: x.title || 'A document', at: x.at || '' }));
    const visit = k.visit && k.visit.date ? k.visit : null;
    const purpose = isNew(k) ? 'visit' : (c.confOpen ? 'conference' : '');
    const open = purpose ? slots().filter(s => s.purpose === purpose && !!s.test === f.test && s.date >= today && (!s.classroom || s.classroom === k.classroom) && (!s.booked || s.booked.childId === k.id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(s => ({ id: s.id, date: s.date, time: s.time, minutes: s.minutes, with: s.with || '', mine: !!(s.booked && s.booked.childId === k.id) })) : [];
    const q = k.familyQuestionnaire || null;
    const ef = k.enrollForm || null;
    // what TREE already knows fills the form at first, so a family only checks it
    const split = n => { const w = String(n || '').trim().split(/\s+/); return { first: w[0] || '', last: w.length > 1 ? w[w.length - 1] : '' }; };
    const pa = (k.parents || []).filter(Boolean); const p1 = split(pa[0] && pa[0].name), p2 = split(pa[1] && pa[1].name);
    const prefill = { c_first: k.first || '', c_last: k.last || '', c_dob: String(k.dob || '').slice(0, 10), p1_first: p1.first, p1_last: p1.last, p1_home: (pa[0] && pa[0].cell) || '', p2_first: p2.first, p2_last: p2.last, p2_home: (pa[1] && pa[1].cell) || '' };
    return { enroll: isNew(k) ? { prefill, data: ef ? ef.data : null, done: !!(ef && ef.done), at: ef ? ef.at : '' } : null, isNew: isNew(k), conference, reflections, shared, files, visit, slotPurpose: purpose, slots: open, strengths: (k.familyStrengths && k.familyStrengths.text) || '', strengthsAt: (k.familyStrengths && k.familyStrengths.at) || '', reflectedAt: cf && cf.status !== 'complete' ? cf.familyReflectedAt || '' : '', questionnaire: q ? { answers: q.answers || [], at: q.at || '' } : null,
      aboutMe: (() => { const am = k.aboutMe || {}; const fk = fileKey(); const ph = p => (p.photos || []).map(id => ({ id, src: '/original/' + encodeURIComponent(id) + '?t=' + encodeURIComponent(fk) }));
        const fixed = AAM_PAGES.map(([t, pr], i) => { const p = (am.pages || [])[i] || {}; return { title: t.replace(/\{first\}/g, firstOf(k)), prompt: pr.replace(/\{first\}/g, firstOf(k)), text: p.text || '', photos: ph(p) }; });
        return { done: !!am.done, at: am.at || '', pages: fixed.concat((am.pages || []).slice(AAM_PAGES.length).map(p => ({ title: p.title || 'More about me', custom: true, text: p.text || '', photos: ph(p) }))) }; })(),
      checks: isNew(k) ? Object.assign({}, k.familyChecks || {}) : null, agreement: isNew(k) ? (k.familyAgreement || null) : null, schedule: k.schedule || '', classroom: k.classroom || '' };
  }
  function book(f, slotId, childId, on) {
    const s0 = getRec(KIND, slotId), s = s0 && Object.assign(s0, { id: slotId }); const k = f.kids.find(x => x.id === childId);
    if (!s || s.kind !== 'slot' || !!s.test !== f.test || !k) return { error: 'That time is no longer open.' };
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
    const fam = {}; for (const [key] of REFLECTIONS) fam[key] = String((answers || {})[key] || '').trim().slice(0, 3000);
    // the family's words go into the form's Family Reflections where the educator has not written anything yet
    const refl = Object.assign({}, cur.reflections || {}); const before = cur.familyReflections || {};
    for (const [key] of REFLECTIONS) if (!String(refl[key] || '').trim() || refl[key] === before[key]) refl[key] = fam[key];
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
    const a = QUESTIONS.map((q, i) => String((answers || [])[i] || '').trim().slice(0, 3000));
    { const left = a.filter(x => !x).length; if (left) return { error: left === 1 ? 'Please answer every question. One is still empty.' : 'Please answer every question. ' + left + ' are still empty.' }; }
    remember(f, 'children', childId); const kd = getRec('children', childId);
    saveRec('children', childId, Object.assign({}, kd, { familyQuestionnaire: { answers: a, questions: QUESTIONS, at: nowIso(), by: f.email }, onboarding: Object.assign({}, kd.onboarding || {}, { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  function enroll(f, childId, data, done) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    const keys = new Set(ENROLL.flatMap(s => s.fields.map(x => x.k)));
    const clean = {}; for (const [key, v] of Object.entries(data || {})) { if (key.startsWith('h_ill_')) { const b = key.slice(6); if (keys.has('h_ill')) clean[key] = String(v).slice(0, 200); continue; } if (keys.has(key)) clean[key] = typeof v === 'boolean' ? v : String(v == null ? '' : v).slice(0, 2000); }
    // complete means every box the form needs is filled in
    if (done) { const miss = enrollMissing(clean, ENROLL); if (miss.length) return { error: 'Some boxes are still empty, ' + miss.slice(0, 6).map(x => x.label.toLowerCase()).join(', ') + (miss.length > 6 ? ', and ' + (miss.length - 6) + ' more' : '') + '.' }; }
    remember(f, 'children', childId); const kd = getRec('children', childId);
    saveRec('children', childId, Object.assign({}, kd, { enrollForm: { data: clean, at: nowIso(), by: f.email, done: !!done }, onboarding: Object.assign({}, kd.onboarding || {}, { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  // a photo for the All About Me book, kept with the school's photos
  async function photo(f, childId, data) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    const buf = Buffer.from(String(data || ''), 'base64'); if (buf.length < 1000 || buf.length > 6 * 1024 * 1024) return { error: 'That photo could not be used. Choose a smaller one.' };
    if (!(buf[0] === 0xff && buf[1] === 0xd8)) return { error: 'Choose a photo, such as a JPEG.' };
    const id = crypto.randomBytes(6).toString('hex') + '-aboutme.jpg';
    try { await keepPhoto(id, buf); } catch (e) { return { error: 'The photo could not be kept just now. Try again in a minute.' }; }
    return { id, src: '/original/' + encodeURIComponent(id) + '?t=' + encodeURIComponent(fileKey()) };
  }
  function aboutMe(f, childId, pages, done) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    const list = (Array.isArray(pages) ? pages : []).slice(0, 16);
    const one = (p, i) => { p = p || {}; return Object.assign({ text: String(p.text || '').trim().slice(0, 1500), photos: (Array.isArray(p.photos) ? p.photos : []).filter(x => /^[0-9a-f]{12}-aboutme\.jpg$/.test(String(x))).slice(0, 4) }, i >= AAM_PAGES.length ? { title: String(p.title || '').trim().slice(0, 60) || 'More about me' } : {}); };
    const clean = AAM_PAGES.map((_, i) => one(list[i], i)).concat(list.slice(AAM_PAGES.length).map((p, j) => one(p, AAM_PAGES.length + j)).filter(p => p.text || p.photos.length));
    if (done && clean.some(p => !p.text || !p.photos.length)) return { error: 'Each page needs at least one photo and a few words before the book is ready.' };
    remember(f, 'children', childId); const kd = getRec('children', childId);
    saveRec('children', childId, Object.assign({}, kd, { aboutMe: { pages: clean, at: nowIso(), by: f.email, done: !!done }, onboarding: Object.assign({}, kd.onboarding || {}, done ? { started: true, aboutMe: true } : { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  // a step or a packed item the family ticks off on their checklist
  function check(f, childId, key, on) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    if (![...CHECKS.map(c => c[0]), ...PACK.map(c => 'pack_' + c[0]), 'notices', 'handbook'].includes(key)) return { error: 'That step is not on the list.' };
    remember(f, 'children', childId); const kd = getRec('children', childId); const ch = Object.assign({}, kd.familyChecks || {}); if (on) ch[key] = nowIso(); else delete ch[key];
    saveRec('children', childId, Object.assign({}, kd, { familyChecks: ch, updatedAt: nowIso() })); return { ok: true };
  }
  // the Admission Agreement, completed, initialed and signed by the family. Once signed it is kept as it is, and the office reopens it for a change.
  function agreement(f, childId, b, submit) {
    const k = f.kids.find(x => x.id === childId); if (!k) return { error: 'Choose the child.' };
    remember(f, 'children', childId); const kd = getRec('children', childId);
    if (kd.familyAgreement && kd.familyAgreement.done) return { error: 'This agreement is signed. Please contact the office to make a change.' };
    b = b || {}; const str = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 200);
    const fields = {}; AGREE.FIELDS.forEach(([key]) => { fields[key] = str((b.fields || {})[key]); });
    const n = AGREE.count();
    const ag = { fields, program: AGREE.PROGRAMS.some(p => p[0] === b.program) ? b.program : '', addons: AGREE.ADDONS.map(a => a[0]).filter(a => (b.addons || []).includes(a)),
      initials: str(b.initials, 5).replace(/[^A-Za-z.\s]/g, '').toUpperCase(), ticks: Array.from({ length: n }, (_, i) => !!(Array.isArray(b.ticks) && b.ticks[i])),
      sign1: { name: str((b.sign1 || {}).name, 100) }, sign2: { name: str((b.sign2 || {}).name, 100) }, esign: !!b.esign, aa: cfg().aa || {}, at: nowIso(), by: f.email, done: false };
    if (submit) {
      const miss = AGREE.missing(ag); if (miss.length) return { error: 'Please complete ' + miss.slice(0, 5).join(', ') + (miss.length > 5 ? ', and ' + (miss.length - 5) + ' more' : '') + '.' };
      ag.done = true; ag.signedAt = nowIso(); ag.sign1.at = ag.signedAt; if (ag.sign2.name) ag.sign2.at = ag.signedAt;
    }
    saveRec('children', childId, Object.assign({}, kd, { familyAgreement: ag, onboarding: Object.assign({}, kd.onboarding || {}, { started: true }), updatedAt: nowIso() }));
    return { ok: true };
  }
  function file(f, id) {
    for (const k of f.kids) { const kd = getRec('children', k.id); if ((kd.sharedFiles || []).some(x => x && x.id === id)) return { path: '/original/' + encodeURIComponent(id) + '?t=' + encodeURIComponent(fileKey()) }; }
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
    const fk = fileKey(); const news = [];
    for (const [id, r] of store.recs.newsletters || []) { const d = r && !r.deleted && r.doc; if (!d || !d.posted || !Array.isArray(d.posted.blocks)) continue;
      news.push({ month: d.month || '', title: d.posted.title || '', at: d.posted.at || 0, blocks: d.posted.blocks.map(b => ({ h: String(b.h || ''), text: String(b.text || ''), photos: (b.photos || []).filter(x => x && x.id).map(x => ({ src: '/original/' + encodeURIComponent(x.id) + '?t=' + encodeURIComponent(fk), cap: String(x.cap || '') })) })) }); }
    news.sort((a, b) => String(b.month).localeCompare(String(a.month)));
    return { news: news.slice(0, 6), days, closures, binNote: binNote ? binNote.text : '', recipe: mr.recipeCard ? { name: mr.recipe || 'Recipe of the month', text: mr.recipeCard } : null };
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
  function addLog(f, b) {
    const kid = f.kids.find(k => k.id === b.childId); if (!kid) return { error: 'Choose which child this counts for.' };
    let what = String(b.what || '').trim().slice(0, 200), itemId = '', date = String(b.date || '').slice(0, 10), minutes = Number(b.minutes) || 0;
    if (b.itemId) { const r = recs().get(b.itemId); const it = r && !r.deleted && r.doc; if (!it || it.kind !== 'item') return { error: 'That is no longer listed.' }; itemId = b.itemId; what = what || it.title; date = date || (it.date && it.date <= new Date().toISOString().slice(0, 10) ? it.date : new Date().toISOString().slice(0, 10)); if (!minutes) minutes = (Number(it.hours) || 1) * 60; }
    if (!what) return { error: 'Say what you did.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) return { error: 'Choose the day, today or earlier.' };
    if (!(minutes > 0) || minutes > 24 * 60) return { error: 'Say how long it took.' };
    const id = newId('lg');
    save(id, { id, kind: 'log', email: f.email, childId: kid.id, itemId, what, date, minutes, hours: hoursOf(minutes), test: f.test, at: nowIso() });
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
    const now = new Date(); const m = /^\d{4}-\d{2}$/.test(month || '') ? month : now.toISOString().slice(0, 7);
    const mr = store.recs.menus.get(m); const menu = mr && !mr.deleted && mr.doc ? { month: m, days: mr.doc.days || {}, notes: mr.doc.notes || {}, times: mr.doc.times || {} } : null;
    const d = new Date(m + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); const prev = d.toISOString().slice(0, 7);
    const farms = {}; let bins = 0;
    for (const [id, r] of store.recs.bins) { const b = r.doc; if (r.deleted || !b || !/^\d{4}-\d{2}-\d{2}$/.test(id) || id.slice(0, 7) !== prev) continue; bins++;
      for (const it of b.items || []) for (const f of it.farms || []) { const k = String(f).trim(); if (!k) continue; (farms[k] = farms[k] || []).push(it.name); } }
    const fr = store.recs.bins.get('farms'); const towns = fr && !fr.deleted && fr.doc && fr.doc.towns ? fr.doc.towns : {};
    const months = [...store.recs.menus.keys()].filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
    return { menu, prev, bins, farms, towns, months, grantEnd: '2027-06-30' };
  }

  return { agreement, check, photo, aboutMe, sendCode, signIn, readFamily, familyView, signUp, addLog, removeLog, publicMenu, cfg, hoursOf, yearStart, book, reflect, strengths, questionnaire, file, enroll, QUESTIONS, ENROLL, DEFAULT_WELCOME };
};
