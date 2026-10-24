'use strict';
// the Teacher Policies and Procedures and the Family Handbook, section by section. Made-up names and words only.
const test = require('node:test');
const assert = require('node:assert');
const { make, call } = require('./harness.js');
const { PolicyMd } = require('../policy-md.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }, { name: 'Bea', room: 'North' }, { name: 'Kit', kitchen: true, role: 'staff' },
  { name: 'Neo', newHire: true, startDate: '2099-01-04' }, { name: 'Gia', role: 'staff', office: true }];

function withPolicies(h) {
  const f = h.files; const put = (p, doc) => f.set(p, { doc, sha: 'x' });
  put('staff/handbook/how-it-works.json', { id: 'how-it-works', title: 'How It Works', body: 'TREE words.' });
  f.set('staff/pd/licensing/16-sun.md', { text: '<!--\nlist: procedure\n-->\n## Sun\n\nFulton procedure\n\n### How Fulton does it\n\nHats on.\n\n### One question\n\nWhat do you do?\n', sha: 'x' });
  put('staff/policies/teacher.json', { title: 'Teacher Policies and Procedures', edition: '2025', mustRead: ['contacts'], parts: [
    { id: 'contacts', title: 'Contacts', sections: [{ id: 'contacts' }] }, { id: 'codes', title: 'Codes', sections: [{ id: 'codes' }] },
    { id: 'how-it-works', title: 'How It Works', sections: [{ id: 'how-it-works', ref: 'staff/handbook/how-it-works.json' }] }, { id: 'sun', title: 'Sun', sections: [{ id: 'sun', ref: 'staff/pd/licensing/16-sun.md' }] }] });
  put('staff/policies/teacher/contacts.json', { id: 'contacts', title: 'Contacts', body: 'Call the office.', history: [] });
  put('staff/policies/teacher/codes.json', { id: 'codes', title: 'Codes', body: 'The door code is SECRET.', history: [], directorOnly: true });
  put('staff/policies/teacher/how-it-works.json', { id: 'how-it-works', ref: 'staff/handbook/how-it-works.json', history: [] });
  put('staff/policies/teacher/sun.json', { id: 'sun', ref: 'staff/pd/licensing/16-sun.md', history: [{ title: 'Sun', body: 'Old doc words.', at: 1, by: 'Google Doc', note: 'The doc' }] });
  put('family/handbook/2026/edition.json', { year: '2026', title: 'Family Handbook', published: true, parts: [{ id: 'about', title: 'About', sections: ['hours', 'behavior'] }] });
  put('family/handbook/2026/hours.json', { id: 'hours', title: 'Hours', body: 'Open at 8. Call 555-201-3344 or ask Ann.', history: [] });
  put('family/handbook/2026/behavior.json', { id: 'behavior', title: 'Behavior', body: 'We guide children.', history: [] });
  put('family/handbook/2027/edition.json', { year: '2027', from: '2026', publishOn: '', parts: [{ id: 'about', title: 'About', sections: ['hours', 'behavior'] }] });
  h.store.recs.children.set('k1', { doc: { first: 'Tamsin', last: 'Quill', classroom: 'West', parents: [{ name: 'Rowan Quill', email: 'r@x.test' }], familyChecks: { handbook: '2026-08-20T10:00:00Z' } } });
  h.store.recs.children.set('k2', { doc: { first: 'Odo', last: 'Vale', classroom: 'North' } });
  return h;
}
async function ready(opt) { const h = withPolicies(make(LIST, opt)); await h.staff.load(); return h; }
const all = d => d.parts.flatMap(p => p.sections);

test('the Teacher Policies and Procedures go to staff sign-ins only, and a section only the director sees stays with her', async () => {
  const h = await ready();
  const dir = await call(h.staff, 'Dir', 'policies/doc', { doc: 'teacher' });
  assert.deepStrictEqual(all(dir.body).map(s => s.id), ['contacts', 'codes', 'how-it-works', 'sun']);
  const ann = await call(h.staff, 'Ann', 'policies/doc', { doc: 'teacher' });
  assert.strictEqual(ann.status, 200); assert.ok(!JSON.stringify(ann.body).includes('SECRET'));
  assert.ok(!JSON.stringify(ann.body).includes('Old doc words'), 'an educator never receives earlier versions');
  assert.strictEqual(all(ann.body).find(s => s.id === 'how-it-works').body, 'TREE words.', 'a section TREE already kept is shown from where it is kept');
  assert.ok(!all(ann.body).find(s => s.id === 'sun').body.includes('One question'), 'a piece\'s question stays with the PD library');
  assert.strictEqual((await call(h.staff, 'Kit', 'policies/doc', { doc: 'teacher' })).status, 403);
  assert.strictEqual((await call(h.staff, 'Kit', 'policies/doc', { doc: 'family' })).status, 403);
  assert.strictEqual((await call(h.staff, 'Neo', 'policies/doc', { doc: 'teacher' })).status, 200, 'a new hire reads them in the New Educator section');
  assert.strictEqual((await call(h.staff, 'Ann', 'policies/save', { doc: 'teacher', id: 'contacts', title: 'x', body: 'y', note: 'z' })).status, 403);
});

test('an edit keeps the earlier wording with its day, who and note, and an earlier version can be restored', async () => {
  const h = await ready();
  assert.strictEqual((await call(h.staff, 'Dir', 'policies/save', { doc: 'teacher', id: 'contacts', title: 'Contacts', body: 'New words.' })).status, 400, 'a change needs a note');
  await call(h.staff, 'Dir', 'policies/save', { doc: 'teacher', id: 'contacts', title: 'Contacts', body: 'New words.', note: 'A new number' });
  let s = all((await call(h.staff, 'Dir', 'policies/doc', { doc: 'teacher' })).body).find(x => x.id === 'contacts');
  assert.strictEqual(s.body, 'New words.'); assert.strictEqual(s.note, 'A new number'); assert.strictEqual(s.history[0].body, 'Call the office.');
  await call(h.staff, 'Dir', 'policies/restore', { doc: 'teacher', id: 'contacts', index: 0 });
  s = all((await call(h.staff, 'Dir', 'policies/doc', { doc: 'teacher' })).body).find(x => x.id === 'contacts');
  assert.strictEqual(s.body, 'Call the office.'); assert.strictEqual(s.history.length, 2); assert.match(s.note, /^Restored the version of/);
  // a section kept elsewhere is changed where it is kept, never copied
  await call(h.staff, 'Dir', 'policies/save', { doc: 'teacher', id: 'how-it-works', title: 'How It Works', body: 'Better words.', note: 'Clearer' });
  assert.strictEqual((await call(h.staff, 'Dir', 'handbook', {})).body.sections.find(x => x.id === 'how-it-works').body, 'Better words.');
  assert.ok(!h.staff.policies.tpSection({ id: 'how-it-works' }).history.some(x => x.body === 'Better words.'));
  await call(h.staff, 'Dir', 'policies/save', { doc: 'teacher', id: 'sun', title: 'Sun', body: 'Fulton procedure\n\n### How Fulton does it\n\nHats and shade.', note: 'Shade' });
  const pd = await call(h.staff, 'Dir', 'pd', {});
  assert.deepStrictEqual(pd.body.licensing[0].sections.map(x => x.heading), ['How Fulton does it', 'One question'], 'the piece keeps its question');
  assert.strictEqual(pd.body.licensing[0].list, 'procedure', 'and its settings');
  assert.ok(pd.body.licensing[0].sections.some(x => x.body === 'Hats and shade.'), 'the PD library reads the same words');
});

test('each educator acknowledges once a year and again for a section marked as a significant change', async () => {
  const h = await ready();
  let a = (await call(h.staff, 'Ann', 'policies/doc', { doc: 'teacher' })).body.ack;
  assert.strictEqual(a.due, true); assert.strictEqual(a.yearAt, 0);
  a = (await call(h.staff, 'Ann', 'policies/ack', {})).body.ack; assert.strictEqual(a.due, false);
  assert.ok((await call(h.staff, 'Ann', 'person', {})).body.tpAck.years[a.year], 'kept on the educator\'s own record');
  await call(h.staff, 'Dir', 'policies/save', { doc: 'teacher', id: 'contacts', title: 'Contacts', body: 'Changed.', note: 'Small fix' });
  assert.strictEqual((await call(h.staff, 'Ann', 'policies/doc', { doc: 'teacher' })).body.ack.due, false, 'a change not marked significant asks nothing');
  await call(h.staff, 'Dir', 'policies/save', { doc: 'teacher', id: 'contacts', title: 'Contacts', body: 'Changed again.', note: 'New rule', significant: true });
  a = (await call(h.staff, 'Ann', 'policies/doc', { doc: 'teacher' })).body.ack;
  assert.strictEqual(a.due, true); assert.deepStrictEqual(a.changed.map(c => c.id), ['contacts']);
  await call(h.staff, 'Ann', 'policies/ack', {});
  const acks = (await call(h.staff, 'Dir', 'policies/acks', {})).body;
  assert.deepStrictEqual(acks.teacher.map(x => [x.name, x.due]), [['Ann', false], ['Bea', true], ['Neo', true]], 'the kitchen, the office and the director are not asked');
  const rec = await call(h.staff, 'Dir', 'person', { name: 'Ann' }); assert.strictEqual(rec.body.policy.due, false, 'it shows on the educator\'s records');
});

test('the Family Handbook draft is the director\'s until its publish date, and the edition before stays readable', async () => {
  const h = await ready({ school: { open: { family: true, handbook: true } } });
  await call(h.staff, 'Dir', 'policies/save', { doc: 'family', edition: '2027', id: 'hours', title: 'Hours', body: 'Open at 7:30.', note: 'Earlier start' });
  const d = (await call(h.staff, 'Dir', 'policies/doc', { doc: 'family', edition: '2027' })).body;
  const hours = all(d).find(s => s.id === 'hours');
  assert.strictEqual(hours.body, 'Open at 7:30.'); assert.strictEqual(hours.history[0].body.includes('Open at 8'), true);
  assert.strictEqual(all(d).find(s => s.id === 'behavior').same, true);
  assert.ok(all(h.staff.handbook.forFamily()).find(s => s.id === 'hours').body.includes('Open at 8'), 'families still read 2026');
  assert.strictEqual((await call(h.staff, 'Ann', 'policies/doc', { doc: 'family', edition: '2027' })).body.edition, '2026');
  assert.strictEqual(h.staff.handbook.current(), '2026');
  await call(h.staff, 'Dir', 'policies/settings', { doc: 'family', edition: '2027', publishOn: '2020-01-01' });
  assert.strictEqual(h.staff.handbook.current(), '2027', 'the date alone makes it current');
  const fam = h.staff.handbook.forFamily('2026');
  assert.strictEqual(fam.edition, '2026'); assert.deepStrictEqual(fam.editions.map(e => e.year), ['2026', '2027']);
  const acks = (await call(h.staff, 'Dir', 'policies/acks', {})).body.family;
  assert.strictEqual(acks.edition, '2027'); assert.ok(acks.list.every(x => !x.at), 'families acknowledge the new edition at their next enrollment');
});

test('the public link stays closed until the director reads the list of names and private details', async () => {
  const h = await ready();
  assert.strictEqual(h.staff.handbook.forPublic(), null);
  const r = (await call(h.staff, 'Dir', 'policies/review', {})).body;
  const kinds = r.findings.map(f => f.kind + ' ' + f.what);
  assert.ok(kinds.includes('A phone number 555-201-3344')); assert.ok(kinds.some(k => /staff member's name Ann/.test(k)));
  assert.strictEqual((await call(h.staff, 'Dir', 'policies/public', { on: true })).status, 400);
  await call(h.staff, 'Dir', 'policies/public', { on: true, reviewed: true, hide: { hours: true } });
  const p = h.staff.handbook.forPublic();
  assert.deepStrictEqual(all(p).map(s => s.id), ['behavior'], 'a section left out stays out');
  assert.strictEqual((await call(h.staff, 'Ann', 'policies/public', { on: false })).status, 403);
});

test('a family acknowledges the edition that is current', () => {
  const store = { recs: { participation: new Map(), children: new Map([['k1', { doc: { first: 'Tamsin', familyChecks: { handbook: '2026-08-20T10:00:00Z' } } }]]), conferences: new Map(), menus: new Map(), grant: new Map(), newsletters: new Map(), bins: new Map() } };
  let year = '2026';
  const fam = require('../family.js')({ store, log: () => {}, sign: s => s, noteChange: () => {}, scheduleSave: () => {}, mailCode: async () => {}, fileKey: () => 'k', keepPhoto: async () => {}, handbook: () => ({ current: () => year }) });
  const f = { email: 'r@x.test', kids: [Object.assign({ id: 'k1' }, store.recs.children.get('k1').doc)], test: false };
  assert.ok(fam.familyView(f).children[0].handbook.at, 'the tick from before is the 2026 edition');
  year = '2027';
  assert.strictEqual(fam.familyView(f).children[0].handbook.at, '');
  fam.check(f, 'k1', 'handbook', true);
  assert.ok(store.recs.children.get('k1').doc.handbookAck['2027'].at);
});

test('the policies\' Markdown keeps every word, nested lists, quotes, tables and pictures', () => {
  const t = 'A line  \nbroken, \\*1009\\* and **bold**.\n\n- one\n  - inside\n1. first  \n   carried on\n\n> Set in.\n\n| a | b |\n|---|---|\n| c | \\| d |\n\n![The cycle](img/x.png)';
  const h = PolicyMd.html(t, (src, alt) => `<img src="${src}" alt="${alt}">`);
  assert.match(h, /A line<br>broken, \*1009\* and <b>bold<\/b>\./); assert.match(h, /<ul><li>one<ul><li>inside<\/li><\/ul><\/li><\/ul>/);
  assert.match(h, /<ol><li>first<br>carried on<\/li><\/ol>/); assert.match(h, /<blockquote><p>Set in\.<\/p><\/blockquote>/); assert.match(h, /<td>\| d<\/td>/); assert.match(h, /<img src="img\/x.png" alt="The cycle">/);
  assert.match(PolicyMd.html('<script>x</script> [mail](mailto:a@b.test)'), /&lt;script&gt;x&lt;\/script&gt; <a href="mailto:a@b.test"/);
});
