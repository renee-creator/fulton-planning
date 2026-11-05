'use strict';
// The Idea bank's records. Seeded once from the approved file, edited by the director with history and Restore this
// version, suggestions from educators approved or set aside, highlights, removing and putting back, the Family page's
// home side only, and the materials guides no longer read. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { make, loaded, call, wait } = require('./harness.js');
const SEED = require('../once/ideabank.json');

const PEOPLE = [{ name: 'Dee', director: true }, { name: 'Ann', room: 'West' }, { name: 'Bo', room: 'North' }, { name: 'Kit', kitchen: true }];
const GUIDE = '<!--\nstatus: draft\ngroup: Sculpture\narea: Art\nsource: A test guide\n-->\n# Educators and Clay\n\nA block.\n';

test('the records are seeded once from the approved file', async () => {
  const h = await loaded(PEOPLE);
  const r = await call(h.staff, 'Ann', 'ideabank');
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.cards.length, SEED.cards.length); assert.strictEqual(r.body.behaviors.length, 49);
  assert.strictEqual(r.body.needs.length, 13); assert.strictEqual(r.body.supports.length, 13); assert.strictEqual(r.body.levels.length, 5);
  await wait(1500); assert.ok(h.writes.some(w => /staff\/library\/ideabank\/cards\.json$/.test(w)) && h.writes.some(w => /behaviors\.json$/.test(w)), 'both are written to the records');
  assert.strictEqual((await call(h.staff, 'Kit', 'ideabank')).status, 403, 'the kitchen does not receive it');
  // records already there are read as they are, and nothing is seeded over them
  const h2 = make(PEOPLE); h2.files.set('staff/library/ideabank/cards.json', { doc: { cards: [{ id: 'only', type: 'ready', group: 'Ready for today', title: 'Only one', sections: [] }] }, sha: 'c' });
  h2.files.set('staff/library/ideabank/behaviors.json', { doc: { behaviors: [] }, sha: 'b' }); await h2.staff.load();
  assert.deepStrictEqual((await call(h2.staff, 'Ann', 'ideabank')).body.cards.map(c => c.id), ['only']);
});

test('the seed folds in the seven materials guides and holds no meat as food', () => {
  const by = id => SEED.cards.find(c => c.id === id); const txt = c => JSON.stringify(c);
  assert.match(txt(by('studio-and-class-ateliers')), /black hollyhock/);
  assert.match(txt(by('clay')), /Clay is for our hands/);
  assert.match(txt(by('home-and-dramatic-play-area')), /beside the block area/);
  assert.match(txt(by('photography')), /obscured location/);
  assert.match(txt(by('magnifiers-and-microscopes')), /obscured location/);
  assert.match(txt(by('water')), /dye garden frozen into ice cubes/);
  assert.match(txt(by('writing-center')), /Offer markers rarely/);
  const pz = by('piazza-and-culinary-atelier'); const good = pz.sections.find(s => s.h === 'Good to know').text; const role = pz.sections.find(s => s.h === 'The child\'s role').items;
  assert.match(good, /The educator leading the piazza is responsible for cleaning every tool/); assert.match(good, /bridge grip/);
  assert.ok(role.some(x => /tortilla press/.test(x)));
  assert.doesNotMatch(JSON.stringify(SEED), /raw chicken|\bmeat\b(?!, dairy and oily foods stay out of our compost)/i);
  assert.doesNotMatch(JSON.stringify(SEED.cards.map(c => [c.sections, c.home])), /[—–;]|\bClaude\b(?! Monet)/);
});

test('the director edits a card with history and Restore this version', async () => {
  const h = await loaded(PEOPLE);
  const P = 'staff/library/ideabank/cards.json';
  let r = await call(h.staff, 'Dee', 'page', { path: P, item: 'clay' });
  assert.strictEqual(r.status, 200); const heads = r.body.parts.map(p => p.heading);
  for (const want of ['Title', 'Summary', 'Invitations, one on each line', 'Good to know', 'Setting, why', 'What it feeds, one on each line', 'What it supports, one on each line', 'For a child who seeks more', 'For a child who finds it too much', 'Connected to, one on each line', 'At home, the title', 'At home, Ways to try it, one on each line']) assert.ok(heads.includes(want), want);
  assert.strictEqual((await call(h.staff, 'Ann', 'page', { path: P, item: 'clay' })).status, 403, 'an educator does not open the editor');
  const parts = r.body.parts.map(p => ({ body: p.body })); const was = parts[1].body; parts[1].body = 'A block of clay for many hands.';
  r = await call(h.staff, 'Dee', 'page/save', { path: P, item: 'clay', parts, note: 'Shorter', stamp: r.body.stamp });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.page.history.length, 1);
  assert.strictEqual((await call(h.staff, 'Ann', 'ideabank')).body.cards.find(c => c.id === 'clay').summary, 'A block of clay for many hands.');
  // what a card feeds keeps to the thirteen needs
  const bad = r.body.page.parts.map(p => ({ body: p.body })); bad[r.body.page.parts.findIndex(p => /^What it feeds/.test(p.heading))].body = 'Being loud';
  const no = await call(h.staff, 'Dee', 'page/save', { path: P, item: 'clay', parts: bad, note: 'x', stamp: r.body.page.stamp });
  assert.strictEqual(no.status, 400); assert.match(no.body.error, /does not know/);
  r = await call(h.staff, 'Dee', 'page/restore', { path: P, item: 'clay', index: 0, stamp: r.body.page.stamp });
  assert.strictEqual(r.status, 200); assert.strictEqual((await call(h.staff, 'Ann', 'ideabank')).body.cards.find(c => c.id === 'clay').summary, was);
});

test('a blank card of each kind, removing and putting back, and highlights', async () => {
  const h = await loaded(PEOPLE);
  for (const [type, group] of [['medium', 'Paint'], ['area', 'Outdoor spaces'], ['interest', 'Children\'s interests'], ['year', 'Across the year on our site'], ['ready', 'Ready for today']]) {
    const r = await call(h.staff, 'Dee', 'ideabank/add', { type, group, title: 'New ' + type });
    assert.strictEqual(r.status, 200); const c = r.body.cards.find(x => x.id === r.body.id);
    assert.strictEqual(c.group, group); assert.ok(c.sections.length >= 5); assert.strictEqual(!!c.home, type !== 'ready');
  }
  assert.strictEqual((await call(h.staff, 'Ann', 'ideabank/add', { type: 'medium', title: 'X' })).status, 403);
  let r = await call(h.staff, 'Dee', 'ideabank/remove', { id: 'chalk' });
  assert.ok(!r.body.cards.some(c => c.id === 'chalk')); assert.deepStrictEqual(r.body.removed.map(x => x.id), ['chalk']);
  r = await call(h.staff, 'Dee', 'ideabank/restore', { id: 'chalk' }); assert.ok(r.body.cards.some(c => c.id === 'chalk'));
  r = await call(h.staff, 'Dee', 'ideabank/highlight', { id: 'clay', on: true }); assert.deepStrictEqual(r.body.highlights, ['clay']);
  assert.strictEqual((await call(h.staff, 'Dee', 'ideabank/highlight', { id: 'painting-with-water', on: true })).status, 400, 'a card with no home side never reaches families');
  assert.strictEqual((await call(h.staff, 'Ann', 'ideabank/highlight', { id: 'clay', on: false })).status, 403);
});

test('educators suggest, and the director approves or sets aside', async () => {
  const h = await loaded(PEOPLE);
  let r = await call(h.staff, 'Ann', 'ideabank/suggest', { kind: 'change', card: 'water', field: 'summary', text: 'Water for pouring, floating and painting.', note: 'Shorter' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.suggestions.length, 1);
  r = await call(h.staff, 'Ann', 'ideabank/suggest', { kind: 'new', type: 'ready', group: 'Ready for today', title: 'Leaf boats', text: 'Leaves floated in a tub.\nA tub of water and fallen leaves.' });
  r = await call(h.staff, 'Bo', 'ideabank/suggest', { kind: 'inquiry', behavior: 'throwing-objects', room: 'North' });
  assert.strictEqual((await call(h.staff, 'Bo', 'ideabank')).body.suggestions.length, 1, 'each educator sees only their own');
  const all = (await call(h.staff, 'Dee', 'ideabank')).body.suggestions; assert.strictEqual(all.length, 3);
  assert.strictEqual((await call(h.staff, 'Ann', 'ideabank/decide', { id: all[0].id, approve: true })).status, 403);
  r = await call(h.staff, 'Dee', 'ideabank/decide', { id: all[0].id, approve: true });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.cards.find(c => c.id === 'water').summary, 'Water for pouring, floating and painting.');
  const ed = await call(h.staff, 'Dee', 'page', { path: 'staff/library/ideabank/cards.json', item: 'water' }); assert.strictEqual(ed.body.history.length, 1, 'the wording before it is kept'); assert.match(ed.body.note, /A suggestion from Ann/);
  r = await call(h.staff, 'Dee', 'ideabank/decide', { id: all[1].id, approve: true });
  const nc = r.body.cards.find(c => c.id === r.body.card); assert.strictEqual(nc.title, 'Leaf boats'); assert.strictEqual(nc.summary, 'Leaves floated in a tub.');
  r = await call(h.staff, 'Dee', 'ideabank/decide', { id: all[2].id, approve: false });
  assert.strictEqual(r.body.suggestions.length, 0);
  const bo = (await call(h.staff, 'Bo', 'ideabank')).body; assert.strictEqual(bo.decided[0].status, 'aside');
  assert.deepStrictEqual(all[2].needs, SEED.behaviors.find(b => b.id === 'throwing-objects').needs);
});

test('families receive only the home side', async () => {
  const h = await loaded(PEOPLE);
  await call(h.staff, 'Dee', 'ideabank/highlight', { id: 'clay', on: true });
  assert.strictEqual(h.staff.ideabank.forFamily().off, true, 'families see nothing until the director turns it on');
  assert.strictEqual(h.staff.ideabank.familyOn(), false);
  assert.strictEqual((await call(h.staff, 'Ann', 'ideabank/family', { on: true })).status, 403, 'only the director turns it on');
  await call(h.staff, 'Dee', 'ideabank/family', { on: true }); assert.strictEqual(h.staff.ideabank.familyOn(), true);
  const f = h.staff.ideabank.forFamily();
  assert.strictEqual(f.cards.length, SEED.cards.filter(c => c.home).length); assert.deepStrictEqual(f.highlights, ['clay']);
  for (const c of f.cards) assert.deepStrictEqual(Object.keys(c).sort(), ['group', 'id', 'sections', 'title']);
  const s = JSON.stringify(f); assert.doesNotMatch(s, /Steadying the body and feelings|proprioception|Open to all|For a child who seeks more|What the child might be seeking/);
  assert.strictEqual(f.cards.find(c => c.id === 'clay').title, 'Clay at Home');
});

test('the materials guides no longer appear', async () => {
  const h = make(PEOPLE); h.files.set('staff/guides/clay.md', { text: GUIDE, sha: 'g' }); await h.staff.load();
  for (const who of ['Dee', 'Ann']) assert.deepStrictEqual((await call(h.staff, who, 'guides')).body.list, []);
  assert.deepStrictEqual((await call(h.staff, 'Dee', 'guides/ready', { slug: 'clay', on: true })).body.list, []);
  assert.strictEqual((await call(h.staff, 'Dee', 'page', { path: 'staff/guides/clay.md' })).status, 404, 'the guide no longer opens in the editor');
  await wait(1500); assert.ok(!h.writes.some(w => /staff\/guides\//.test(w)), 'its file stays as it is');
});

test('every card closes with the children, and educators write what they tried before an inquiry', async () => {
  assert.ok(SEED.cards.every(c => c.sections.some(s => s.h === 'Closing it together' && s.text.trim())), 'every card has Closing it together');
  assert.ok(SEED.behaviors.every(b => (b.from_us || []).length >= 2), 'every behavior names what the child might need from us');
  const h = await loaded(PEOPLE);
  let r = await call(h.staff, 'Bo', 'ideabank');
  assert.strictEqual(r.body.fromUs.length, 27); assert.ok(r.body.fromUs.some(u => u.name === 'Acknowledgment of effort (encouragement)' && /good job/.test(u.look)));
  assert.ok(r.body.behaviors.every(b => b.from_us.every(n => r.body.fromUs.some(u => u.name === n))), 'behaviors use only names TREE knows, a renamed need read by its new name');
  assert.strictEqual(h.staff.ideabank.canOpen('biting', 'North'), false, 'nothing tried yet');
  assert.strictEqual((await call(h.staff, 'Bo', 'ideabank/tried', { behavior: 'biting', room: 'North', step: 'Offered a chewy tube.' })).status, 400, 'what happened is written too');
  r = await call(h.staff, 'Bo', 'ideabank/tried', { behavior: 'biting', room: 'North', step: 'Offered a chewy tube.', happened: 'Calmer for the morning, then it happened again at lunch.' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.tried.length, 1);
  assert.strictEqual(h.staff.ideabank.canOpen('biting', 'North'), true);
  assert.strictEqual(h.staff.ideabank.canOpen('biting', 'West'), false, 'each class writes its own');
  const id = r.body.tried[0].id;
  assert.strictEqual((await call(h.staff, 'Ann', 'ideabank/untried', { id })).status, 400, 'another educator does not remove it');
  assert.strictEqual((await call(h.staff, 'Dee', 'ideabank/untried', { id })).status, 200);
  assert.strictEqual(h.staff.ideabank.canOpen('biting', 'North'), false);
});

test('the one-time step s14Wording swaps real as emphasis, children under three and dysregulation, and leaves real tools alone', async () => {
  const fs = require('fs'), path = require('path');
  const list = require('../once/s14-wording.json');
  assert.ok(list.changes.length >= 80 && list.changes.every(c => /^staff\/library\/ideabank\/(cards|behaviors)\.json$/.test(c.path) && c.from && c.to), 'every change is a swap on the two Idea bank records');
  assert.ok(list.changes.every(c => !/[—:]/.test(c.to)), 'no em dash or colon in the new wording');
  assert.ok(!list.changes.some(c => /real (tools|photos|objects|dishes|instruments|food|coins)\b/.test(c.from) && !/real (tools|photos|objects|dishes|instruments|food|coins)\b/.test(c.to)), 'real tools, photos, objects, dishes, instruments, food and coins stay');
  const s13 = require('../once/s13-review.json').changes.filter(c => /ideabank/.test(c.path) && c.from).map(c => c.from);
  assert.ok(!list.changes.some(c => s13.some(f => f.includes(c.from) || c.from.includes(f))), 'nothing s13Review already changes');
  // the seed already carries the new words, so a fresh seed matches the records after the step
  const seedText = JSON.stringify(SEED);
  assert.ok(list.changes.every(c => !seedText.includes(c.from) && seedText.includes(c.to)), 'the seed holds the new wording and none of the old');
  // records seeded before the fix hold the old words, and the step brings them in line, outside a record's history
  const back = (v, f, t) => typeof v === 'string' ? v.split(t).join(f) : Array.isArray(v) ? v.map(x => back(x, f, t)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, back(x, f, t)])) : v;
  let cards = JSON.parse(JSON.stringify(SEED.cards)), behaviors = JSON.parse(JSON.stringify(SEED.behaviors));
  for (const c of list.changes) { cards = back(cards, c.from, c.to); behaviors = back(behaviors, c.from, c.to); }
  const h = make(PEOPLE);
  h.files.set('staff/library/ideabank/cards.json', { doc: { id: 'ideabank-cards', cards, removed: [], sources: [], history: [{ note: 'Real jobs give real pride.' }] }, sha: 'c' });
  h.files.set('staff/library/ideabank/behaviors.json', { doc: { id: 'ideabank-behaviors', behaviors }, sha: 'b' });
  await h.staff.load();
  const before = JSON.stringify(h.staff.dump()['staff/library/ideabank/cards.json']);
  assert.match(before, /Real jobs give real pride\./); assert.match(before, /babies and toddlers/); assert.match(before, /helps the body calm down/);
  assert.match(JSON.stringify(h.staff.dump()['staff/library/ideabank/behaviors.json']), /tired, hungry or overwhelmed \(interoception\)/);
  assert.notStrictEqual(await h.staff.once.edits('s14Wording', () => false), false);
  const d = h.staff.dump(); const ct = JSON.stringify(Object.assign({}, d['staff/library/ideabank/cards.json'], { history: [] })), bt = JSON.stringify(d['staff/library/ideabank/behaviors.json']);
  for (const c of list.changes) assert.ok((c.path.endsWith('cards.json') ? ct : bt).includes(c.to), 'applied ' + c.to);
  assert.doesNotMatch(ct, /\breal (job|jobs|work|interest|choices|challenge|loads|load|force|teamwork|problem|reader|pride)\b/, 'real as emphasis is gone from the cards');
  assert.doesNotMatch(ct, /toddler/); assert.match(ct, /babies and children under three/); assert.match(ct, /Jobs that matter give pride\./);
  assert.match(ct, /care for real tools/); assert.match(ct, /Keep real coins away/); assert.ok((ct.match(/real photos/g) || []).length > 20, 'real photos stay');
  assert.match(bt, /out of balance \(dysregulation\)/); assert.match(bt, /a steady adult to borrow calm from \(co-regulation\) while their body settles/); assert.doesNotMatch(bt, /or overwhelmed/, 'overwhelmed stays only as a search keyword');
  assert.match(ct, /slow swaying helps a body find its steady rhythm/);
  assert.strictEqual(d['staff/library/ideabank/cards.json'].history[0].note, 'Real jobs give real pride.', 'a record\'s own history keeps its words');
  // a second run changes nothing, and the step is wired to run once at start, after s13Review
  const again = JSON.stringify(d); await h.staff.once.edits('s14Wording', () => false); assert.strictEqual(JSON.stringify(h.staff.dump()), again);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(src.indexOf("ONCE.push(['s14Wording'") > src.indexOf("ONCE.push(['s13Review'"), 's14Wording runs after s13Review');
});

test('the one-time step s15Materials puts About this material first on both sides of the material cards, once', async () => {
  const fs = require('fs'), path = require('path');
  const list = require('../once/s15-materials.json'); const H = 'About this material';
  const ids = [...new Set(list.changes.map(c => c.insert.match(/^cards\[id=([^\]]+)\]/)[1]))];
  assert.strictEqual(list.changes.length, 156); assert.strictEqual(ids.length, 78);
  assert.ok(list.changes.every(c => c.path === 'staff/library/ideabank/cards.json' && /^cards\[id=[a-z0-9-]+\]\.(sections|home\.sections)$/.test(c.insert) && c.at === 0 && c.value.h === H && c.value.style === 'text' && c.value.text.length > 100), 'every change inserts the section first on one side of a card');
  // every material card and the four areas that are a material, with the same words on both sides
  const media = SEED.cards.filter(c => c.type === 'medium').map(c => c.id);
  assert.deepStrictEqual(ids.filter(i => !media.includes(i)).sort(), ['block-area', 'log-yard', 'mud-kitchen', 'sensory-table']);
  assert.ok(media.every(i => ids.includes(i)), 'every material card');
  for (const id of ids) { const two = list.changes.filter(c => c.insert.startsWith(`cards[id=${id}]`)); assert.strictEqual(two.length, 2); assert.strictEqual(two[0].value.text, two[1].value.text, id + ' says the same at home'); }
  // the words keep to our writing rules, and the seed already carries the same section
  for (const c of list.changes) { const t = c.value.text;
    assert.doesNotMatch(t, /[—–:;]|\bteacher|\btoddler|\bactivit|\bClaude\b|\n/, id(c) + ' keeps the writing rules');
    assert.doesNotMatch(t, /\breal\b(?! (tools|objects|photos|dishes|instruments|food|coins)\b)/, id(c) + ' uses real only for a true object');
    const n = (t.match(/[.!?](\s|$)/g) || []).length; assert.ok(n >= 2 && n <= 4, id(c) + ' is two to four sentences, ' + n);
    const card = SEED.cards.find(x => x.id === id(c)); const side = /home/.test(c.insert) ? card.home.sections : card.sections;
    assert.strictEqual(side[0].h, H); assert.strictEqual(side[0].text, t); assert.strictEqual(side.filter(x => x.h === H).length, 1); }
  assert.strictEqual(SEED.cards.find(c => c.id === 'clay').sections[0].text.slice(0, 45), 'Clay is fine earth that holds water, dug from');
  assert.ok(SEED.cards.filter(c => c.type === 'medium').every(c => c.sections[1].h === 'Invitations' && c.home.sections[1].h === 'What you need'), 'Invitations and What you need follow it');
  assert.ok(SEED.cards.filter(c => !ids.includes(c.id)).every(c => !(c.sections || []).some(s => s.h === H) && !(c.home && c.home.sections.some(s => s.h === H))), 'no other card has it');
  // records seeded before the step hold no such section, and the step puts it in, first on both sides, outside a record's history
  const strip = arr => arr.filter(s => s.h !== H);
  const cards = JSON.parse(JSON.stringify(SEED.cards)).map(c => Object.assign(c, { sections: strip(c.sections || []) }, c.home ? { home: Object.assign(c.home, { sections: strip(c.home.sections) }) } : {}));
  // one card the director already gave the section, in her own words, keeps them
  const mine = cards.find(c => c.id === 'sand'); mine.sections.splice(1, 0, { h: H, style: 'text', text: 'Our sand comes from the river.' });
  const h = make(PEOPLE);
  h.files.set('staff/library/ideabank/cards.json', { doc: { id: 'ideabank-cards', cards, removed: [], sources: [], history: [{ note: 'Before', cards: [{ id: 'clay', sections: [{ h: 'Invitations', style: 'bullets', items: [] }] }] }] }, sha: 'c' });
  h.files.set('staff/library/ideabank/behaviors.json', { doc: { id: 'ideabank-behaviors', behaviors: [] }, sha: 'b' });
  await h.staff.load();
  assert.ok(!JSON.stringify(h.staff.dump()['staff/library/ideabank/cards.json'].cards.find(c => c.id === 'clay')).includes(H));
  assert.notStrictEqual(await h.staff.once.edits('s15Materials', () => false), false);
  const d = h.staff.dump()['staff/library/ideabank/cards.json'];
  for (const id of ids) { const c = d.cards.find(x => x.id === id); const want = list.changes.find(x => x.insert === `cards[id=${id}].sections`).value.text;
    if (id === 'sand') { assert.strictEqual(c.sections[0].h, 'Invitations'); assert.strictEqual(c.sections[1].text, 'Our sand comes from the river.'); assert.strictEqual(c.sections.filter(s => s.h === H).length, 1, 'her own section stays and no second is added'); }
    else { assert.strictEqual(c.sections[0].h, H); assert.strictEqual(c.sections[0].text, want); assert.strictEqual(c.sections[1].h, SEED.cards.find(x => x.id === id).sections[1].h); }
    assert.strictEqual(c.home.sections[0].h, H); assert.strictEqual(c.home.sections[0].text, want); assert.strictEqual(c.home.sections[1].h, 'What you need'); }
  assert.ok(!JSON.stringify(d.cards.find(c => c.id === 'meeting-time')).includes(H), 'a place is not a material');
  assert.strictEqual(d.history.length, 1); assert.ok(!JSON.stringify(d.history).includes(H), 'a record\'s own history keeps its shape');
  // a second run changes nothing, and the step is wired to run once at start, after s14Wording
  const again = JSON.stringify(h.staff.dump()); await h.staff.once.edits('s15Materials', () => false); assert.strictEqual(JSON.stringify(h.staff.dump()), again);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(src.indexOf("ONCE.push(['s15Materials'") > src.indexOf("ONCE.push(['s14Wording'"), 's15Materials runs after s14Wording');
  // the one-page card prints it, on both sides, and the family page's cards carry it
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ideabank-ui.js'), 'utf8');
  assert.match(ui, /const IB_ABOUT="About this material"/); assert.match(ui, /\[IB_ABOUT,"Ways to try it"/); assert.match(ui, /\[by\(IB_ABOUT\),S\.find/);
  await call(h.staff, 'Dee', 'ideabank/family', { on: true });
  const fam = h.staff.ideabank.forFamily(); const clay = fam.cards.find(c => c.id === 'clay');
  assert.strictEqual(clay.sections[0].h, H); assert.strictEqual(clay.sections[0].text, list.changes.find(x => x.insert === 'cards[id=clay].sections').value.text);
  function id(c) { return c.insert.match(/^cards\[id=([^\]]+)\]/)[1]; }
});

// November 4, 2026. Idea bank cards name children by age rather than by class, on both sides of a card and in the seed.
test('the one-time step s17Ages names children by age rather than by class, once', async () => {
  const fs = require('fs'), path = require('path');
  const list = require('../once/s17-ages.json');
  assert.ok(list.changes.every(c => c.path === 'staff/library/ideabank/cards.json' && c.from && c.to && !/(West|North|South) class/.test(c.to)));
  assert.doesNotMatch(JSON.stringify(SEED), /(West|North|South) class/, 'the seed names no class');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'once', 's14-wording.json'), 'utf8'), /(West|North|South) class/);
  // records kept before the step still name the classes, in the shapes the live cards used
  const cards = JSON.parse(JSON.stringify(SEED.cards));
  const clay = cards.find(c => c.id === 'clay');
  clay.sections.push({ h: 'By age', style: 'bullets', items: ['For the West class, a fist-sized ball for each child.', 'For the North class, short coils on boards.', 'For the South class, plan a piece in a drawing.', 'Varnishing is adult work, and the West class paints one rock with an adult beside them.', 'For TK-age children in South class who show readiness, carve a name.', 'Keep small beads to the South class and any South class child who reaches for them.', 'Anything in the Studio can also live in the West, North or South class.'] });
  clay.home.sections.push({ h: 'At home', style: 'text', text: 'Keep small pieces away from the West class.' });
  const h = make(PEOPLE);
  h.files.set('staff/library/ideabank/cards.json', { doc: { id: 'ideabank-cards', cards, removed: [], sources: [], history: [{ note: 'Before', cards: [{ id: 'clay', sections: [{ h: 'By age', style: 'text', text: 'For the West class, clay.' }] }] }] }, sha: 'c' });
  h.files.set('staff/library/ideabank/behaviors.json', { doc: { id: 'ideabank-behaviors', behaviors: [] }, sha: 'b' });
  await h.staff.load();
  assert.notStrictEqual(await h.staff.once.edits('s17Ages', () => false), false);
  const d = h.staff.dump()['staff/library/ideabank/cards.json'];
  const c = d.cards.find(x => x.id === 'clay');
  assert.deepStrictEqual(c.sections[c.sections.length - 1].items, ['For twos and threes, a fist-sized ball for each child.', 'For threes and fours, short coils on boards.', 'For fours, fives and TK, plan a piece in a drawing.', 'Varnishing is adult work, and twos and threes paint one rock with an adult beside them.', 'For TK-age children who show readiness, carve a name.', 'Keep small beads to fours, fives and TK and any of the fours, fives and TK who reach for them.', 'Anything in the Studio can also live in any class.']);
  assert.strictEqual(c.home.sections[c.home.sections.length - 1].text, 'Keep small pieces away from twos and threes.');
  assert.doesNotMatch(JSON.stringify(d.cards), /(West|North|South) class/, 'no card names a class');
  assert.match(JSON.stringify(d.history), /West class/, 'a record\'s own history keeps its words');
  const again = JSON.stringify(h.staff.dump()); await h.staff.once.edits('s17Ages', () => false); assert.strictEqual(JSON.stringify(h.staff.dump()), again);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(src.indexOf("ONCE.push(['s17Ages'") > src.indexOf("ONCE.push(['s15Materials'"), 's17Ages runs after s15Materials');
});

// November 4, 2026. The senses and the body join Beyond Discipline, the six kinds of risky play and the research join Risky
// Play, the heavy work guidelines and calming tools join the cards, and the sensory patterns join the needs list, once.
test('the one-time step s18Sensory puts the theory in the modules and the practice on the cards, once', async () => {
  const fs = require('fs'), path = require('path');
  const list = require('../once/s18-sensory-risk.json');
  assert.strictEqual(list.changes.length, 35);
  for (const c of list.changes) assert.ok(c.to.startsWith(c.from.split('\n')[0]) || c.to.endsWith(c.from), 'every change keeps the words it hangs on');
  const texts = list.changes.map(c => c.to.replace(/\(https?:[^)]*\)/g, '')).join('\n');
  assert.doesNotMatch(texts, /[—–;]|\bteacher|\btoddler|\bClaude\b|overwhelmed/);
  assert.ok(!/^[^\n]*:[^\n]*$/m.test(texts.replace(/\n/g, '\n')), 'no colons in prose');
  const H = s => ({ text: `<!--\nstatus: draft\n-->\n# Page\n\n## Reading\n\n${s}\n\n## From our own documentation\n\n- a\n\n## Readings\n\n- [Outside Play, Mariana Brussoni, University of British Columbia](https://outsideplay.ca/)\n- [It's OK Not to Share, Heather Shumaker, Penguin](https://www.penguin.com.au/books/its-ok-not-to-share-and-other-renegade-rules-for-raising-competent-and-compassionate-kids-9781101597132)\n\n## For the director, sources\n\n- **Why it matters.** Ours.\n`, sha: 'p' });
  const h = make(PEOPLE);
  h.files.set('staff/pd/modules/04-beyond.md', H('Words.'));
  h.files.set('staff/pd/modules/20-risk.md', H('### Assessing risk with children\n\nWords.'));
  h.files.set('staff/pd/modules/06-development.md', H('Words.'));
  h.files.set('staff/familypieces/together-beyond.md', { text: '<!--\nstatus: draft\n-->\n# When Feelings Run Big\n\n## Repair\n\nWords.\n\n## Partners in understanding\n\nWords.\n', sha: 'f' });
  const cards = JSON.parse(JSON.stringify(SEED.cards));
  h.files.set('staff/library/ideabank/cards.json', { doc: { id: 'ideabank-cards', cards, removed: [], sources: [], history: [] }, sha: 'c' });
  h.files.set('staff/library/ideabank/behaviors.json', { doc: { id: 'ideabank-behaviors', behaviors: JSON.parse(JSON.stringify(SEED.behaviors)) }, sha: 'b' });
  await h.staff.load();
  assert.notStrictEqual(await h.staff.once.edits('s18Sensory', () => false), false);
  const d = h.staff.dump();
  const beyond = d['staff/pd/modules/04-beyond.md'];
  assert.match(beyond, /### The senses and the body \(sensory integration\)[\s\S]*## From our own documentation/);
  assert.match(beyond, /Early Learning Institute, Behavioral Consultation Project/); assert.match(beyond, /\*\*The senses and the body\.\*\*/);
  const risk = d['staff/pd/modules/20-risk.md'];
  assert.match(risk, /### The six kinds of risky play[\s\S]*### What the research tells us[\s\S]*### How risky play grows[\s\S]*### Assessing risk with children/);
  assert.match(risk, /Sandseter and Leif Kennair/); assert.match(risk, /Balanced and Barefoot/);
  assert.match(d['staff/pd/modules/06-development.md'], /### The senses, in brief/);
  assert.match(d['staff/familypieces/together-beyond.md'], /## Every body is different[\s\S]*## Partners in understanding/);
  const c = d['staff/library/ideabank/cards.json'].cards;
  assert.match(JSON.stringify(c.find(x => x.id === 'heavy-work')), /one twentieth of the child's own weight/);
  assert.match(JSON.stringify(c.find(x => x.id === 'calm-body-after-big-movement').home), /weighted lap friend/);
  assert.match(JSON.stringify(c.find(x => x.id === 'quiet-and-cozy-space')), /closed on three sides/);
  const b = d['staff/library/ideabank/behaviors.json'].behaviors;
  assert.match(b.find(x => x.label === 'Crashing into people').might_be_seeking, /active and driving pattern/);
  assert.match(b.find(x => x.label === 'Covering ears').might_be_seeking, /highly sensitive pattern/);
  const again = JSON.stringify(h.staff.dump()); await h.staff.once.edits('s18Sensory', () => false); assert.strictEqual(JSON.stringify(h.staff.dump()), again);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(src.indexOf("ONCE.push(['s18Sensory'") > src.indexOf("ONCE.push(['s17Ages'"));
});

// November 4, 2026. PD modules gain their theory sections through one-time steps built from the live pages. Each change
// keeps the words it hangs on, and the step is idempotent.
test('the PD theory steps keep their anchors and run once', async () => {
  for (const name of ['s19-pd-batch1', 's20-pd-batch2']) {
    const list = require('../once/' + name + '.json');
    assert.ok(list.changes.length > 0);
    for (const c of list.changes) assert.ok(c.to.endsWith(c.from) || c.to.startsWith(c.from.split('\n')[0]), 'keeps its anchor');
    const texts = list.changes.map(c => c.to.replace(/\(https?:[^)]*\)/g, '')).join('\n');
    assert.doesNotMatch(texts, /[—–;]|\btoddler\b|\bClaude\b/);
    const h = make(PEOPLE);
    const files = [...new Set(list.changes.map(c => c.path))];
    for (const p of files) {
      const anchors = list.changes.filter(c => c.path === p).map(c => c.from);
      h.files.set(p, { text: '<!--\nstatus: draft\n-->\n# Page\n\n## Reading\n\nWords.\n\n' + anchors.join('\n\n') + '\n', sha: p });
    }
    await h.staff.load();
    const key = { 's19-pd-batch1': 's19Pd1', 's20-pd-batch2': 's20Pd2' }[name];
    assert.notStrictEqual(await h.staff.once.edits(key, () => false), false);
    const d = h.staff.dump();
    for (const c of list.changes) assert.ok(d[c.path].includes(c.to), 'applied ' + c.path);
    const again = JSON.stringify(h.staff.dump()); await h.staff.once.edits(key, () => false); assert.strictEqual(JSON.stringify(h.staff.dump()), again);
  }
});
