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
  const s = JSON.stringify(f); assert.doesNotMatch(s, /Calm and grounding|proprioception|Open to all|For a child who seeks more|What the child might be seeking/);
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
  assert.ok(SEED.behaviors.every(b => b.from_us.every(n => r.body.fromUs.some(u => u.name === n))), 'behaviors use only names TREE knows');
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
