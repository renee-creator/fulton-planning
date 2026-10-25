'use strict';
// Session 10's one-time steps, schoolName first. The changes come from a list in the private records. A Teacher Policies and
// Procedures section keeps its earlier wording in its history, a record's own history is never rewritten, a record in
// the main records changes through the server's save queue, and running it again changes nothing. Made-up words only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { make } = require('./harness.js');

test('naming the school, once', async () => {
  const h = make([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }]);
  h.files.set('staff/pd/licensing/16-sun.md', { text: '<!--\nlist: procedure\n-->\n## Sun\n\nOakvale procedure\n\n### How Oakvale does it\n\nOakvale keeps hats.\n\n### One question\n\nWhere is the shade at Oakvale?\n', sha: 'x' });
  h.files.set('staff/policies/teacher.json', { doc: { title: 'Teacher Policies and Procedures', parts: [{ id: 'health', title: 'Health', sections: [{ id: 'sun', ref: 'staff/pd/licensing/16-sun.md' }] }] }, sha: 'x' });
  h.files.set('staff/help.json', { doc: { answers: [{ label: 'Welcome to Oakvale', steps: ['Open Welcome to Oakvale.'] }, { label: 'Welcome to Oakvale' }], history: ['Welcome to Oakvale'] }, sha: 'x' });
  h.files.set('staff/naming-2026.json', { doc: { changes: [
    { path: 'staff/pd/licensing/16-sun.md', from: 'Oakvale procedure', to: 'Our own procedure' },
    { path: 'staff/pd/licensing/16-sun.md', from: '### How Oakvale does it', to: '### How we do it' },
    { path: 'staff/pd/licensing/16-sun.md', from: 'Oakvale keeps hats.', to: 'We keep hats.' },
    { path: 'staff/pd/licensing/16-sun.md', from: 'Where is the shade at Oakvale?', to: 'Where is the shade at our school?' },
    { path: 'staff/help.json', from: 'Welcome to Oakvale', to: 'Welcome to Oakvale Community School', all: true },
    { path: 'staff/help.json', from: 'Open Welcome to Oakvale.', to: 'Open Welcome to Oakvale Community School.' },
    { path: 'children/kit-test.json', from: 'Left Oakvale', to: 'Left our school', all: true },
    { path: 'staff/help.json', from: 'Not anywhere', to: 'Nothing' }] }, sha: 'x' });
  await h.staff.load();
  const main = { 'children/kit-test.json': { first: 'Kit', treeHistory: [{ what: 'Left Oakvale' }] } };
  const saved = [];
  const recs = (p, fn) => { if (!main[p]) return false; const n = fn(main[p]); if (JSON.stringify(n) === JSON.stringify(main[p])) return false; main[p] = n; saved.push(p); return true; };
  h.staff.once.edits('schoolName', recs);
  const d = h.staff.dump();
  const piece = d['staff/pd/licensing/16-sun.md'];
  assert.match(piece, /^Our own procedure$/m); assert.match(piece, /^### How we do it$/m); assert.match(piece, /We keep hats\./); assert.match(piece, /shade at our school\?/);
  assert.match(piece, /^<!--\nlist: procedure\n-->/, 'the piece keeps its settings');
  const sec = d['staff/policies/teacher/sun.json'];
  assert.ok(sec && sec.history.length === 1 && /Oakvale keeps hats/.test(sec.history[0].body), 'the section keeps its earlier wording');
  assert.match(sec.note, /Naming the school/);
  assert.deepStrictEqual(d['staff/help.json'].answers.map(a => a.label), ['Welcome to Oakvale Community School', 'Welcome to Oakvale Community School']);
  assert.deepStrictEqual(d['staff/help.json'].answers[0].steps, ['Open Welcome to Oakvale Community School.']);
  assert.deepStrictEqual(d['staff/help.json'].history, ['Welcome to Oakvale'], 'a record\'s own history keeps its words');
  assert.deepStrictEqual(saved, ['children/kit-test.json']); assert.strictEqual(main['children/kit-test.json'].treeHistory[0].what, 'Left our school');
  // a second run finds nothing left to change
  const again = JSON.stringify(h.staff.dump()); h.staff.once.edits('schoolName', recs);
  assert.strictEqual(JSON.stringify(h.staff.dump()), again); assert.deepStrictEqual(saved, ['children/kit-test.json']);
  // the step waits until its list is in the records
  const h2 = make([{ name: 'Dir', director: true }]); await h2.staff.load();
  assert.strictEqual(h2.staff.once.edits('schoolName', recs), false);
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /for \(const name of \['schoolName', 'helpCurrent'/);
});

test('a one-time step sets a value only while it is still what the change expects', async () => {
  const h = make([{ name: 'Dir', director: true }]);
  h.files.set('staff/readings-library.json', { doc: { list: [{ id: 'rl1', cite: 'Old.', check: true }, { id: 'rl2', cite: 'Keep.' }] }, sha: 'x' });
  h.files.set('staff/naming-2026.json', { doc: { changes: [
    { path: 'staff/readings-library.json', set: 'list[id=rl1].cite', value: 'New.' },
    { path: 'staff/readings-library.json', set: 'list[id=rl1].check', value: false, expect: true },
    { path: 'staff/readings-library.json', set: 'list[id=rl2].cite', value: 'Not this.', expect: 'Something else.' },
    { path: 'plans/p1.json', set: 'fields.remarks', value: 'Our words.', expect: '' },
    { path: 'plans/p2.json', set: 'fields.remarks', value: 'Our words.', expect: '' }] }, sha: 'x' });
  await h.staff.load();
  const main = { 'plans/p1.json': { fields: { remarks: '' } }, 'plans/p2.json': { fields: { remarks: 'Written since.' } } };
  const recs = (p, fn) => { const n = fn(main[p]); if (JSON.stringify(n) === JSON.stringify(main[p])) return false; main[p] = n; return true; };
  h.staff.once.edits('schoolName', recs);
  const l = h.staff.dump()['staff/readings-library.json'].list;
  assert.deepStrictEqual(l[0], { id: 'rl1', cite: 'New.', check: false }); assert.strictEqual(l[1].cite, 'Keep.');
  assert.strictEqual(main['plans/p1.json'].fields.remarks, 'Our words.'); assert.strictEqual(main['plans/p2.json'].fields.remarks, 'Written since.', 'newer words are never replaced');
});

test('TREE names the school as we and our, or Fulton Community School', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const app = read('src/app.html'), staff = read('src/staff-app.js'), growth = read('src/growth-app.js'), pres = read('src/presenting-app.js');
  for (const w of ['"At Fulton"', '"Left Fulton"', 'Staying at Fulton', '`Fulton plans week of', '"Food at Fulton"', 'Fulton does not celebrate']) assert.ok(!app.includes(w), w);
  assert.ok(app.includes('`Fulton Community School plans week of ${week}'));
  for (const w of ['"Licensing at Fulton"', 'Fulton PD hours', '"Welcome to Fulton"']) assert.ok(!staff.includes(w), w);
  assert.ok(!growth.includes('Everyone at Fulton') && growth.includes('Everyone at our school'));
  assert.ok(pres.includes('Start from our PD template'));
  assert.match(read('server.js'), /Never call it Fulton on its own, and never Community School on its own/);
});

test('a one-time step on a page with the Edit button keeps the wording before it as an earlier version', async () => {
  const h = make([{ name: 'Dir', director: true }]);
  h.files.set('staff/newed/welcome.md', { text: '<!--\nplace: pdlibrary\n-->\n# A Letter to Oakvale Educators\n\nDear all.\n\n## Why\n\nWords.\n\nThe director\n', sha: 'x' });
  h.files.set('staff/once/letter-title.json', { doc: { changes: [{ path: 'staff/newed/welcome.md', from: '# A Letter to Oakvale Educators', to: '# A Letter to Our Educators' }, { path: 'staff/newed/welcome.md', from: 'Words.\n\nThe director', to: 'Words.\n\nAda Lane, Director' }] }, sha: 'x' });
  await h.staff.load();
  h.staff.once.edits('letterTitle', () => false);
  const d = h.staff.dump();
  assert.match(d['staff/newed/welcome.md'], /^# A Letter to Our Educators$/m); assert.match(d['staff/newed/welcome.md'], /Ada Lane, Director\n$/);
  const hist = d['staff/pd/history/newed--welcome.json'];
  assert.strictEqual(hist.history.length, 1); assert.match(hist.history[0].text, /A Letter to Oakvale Educators/); assert.match(hist.note, /A Letter to Our Educators/);
});
