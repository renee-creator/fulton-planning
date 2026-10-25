'use strict';
// Session 11, wording the director edits in place. The Family page's questions, reflections, first steps, packing
// list, All About Me pages, enrollment words and the Admission Tuition Agreement, the conference preparation steps, the
// new family checklist and the grant's goals live in the private records in staff/wording, and only the director
// edits them, with each earlier version kept. The test wording here is made up.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const ROOT = path.join(__dirname, '..');
const page = (title, parts) => `<!--\nwording: test\n-->\n# ${title}\n\n` + parts.map(([h, b]) => `## ${h}\n\n${b}\n`).join('\n');

const WORDING = {
  'family-questionnaire': page('Questions', [['q1', 'What does your child love to build?'], ['q2', 'Who reads with your child?']]),
  'family-reflections': page('Reflections', [['r1', 'What is new at home?']]),
  'family-checklist': page('First steps', [['kaymbu', 'Install the photo app\n\nWe share photos there.\n\n[App Store](https://example.test/app)']]),
  'family-packing': page('Packing', [['bottle', 'A water bottle with a name on it']]),
  'family-aboutme': page('About Me', [['page1', 'All About {first}\n\nA photo of {first}.']]),
  'family-enrollment': page('Enrollment', [['section1', 'The child\n\nAs on the birth record.'], ['c_first', 'First name']]),
  'agreement': page('Agreement', [['program mf', 'Mornings, $1,000 per year, 10 payments of $100'], ['addon early', 'Early care, $10 per month'], ['field child', 'Child'],
    ['page1 1', 'The year begins {start}.'], ['page1 2', 'Tuition is {year}, paid as {month} a month.'], ['page2 1', 'Either side may end this.'], ['page2 3', 'Changes are signed again.'], ['statement', 'I agree.'], ['esign', 'My typed name is my signature.']]),
  'conference-prep': page('Preparing', [['questionnaire', 'Read the questions'], ['director', 'Invited the director']]),
  'onboarding': page('Checklist', [['office o_link', 'Sent the link'], ['team questionnaire', 'Read the questions']]),
  'grant': page('Grant', [['goal 1', 'More local food.\n\nBuy it.\n\nThe chef.\n\nThe orders.'], ['short 1', 'Local food'], ['objective 5', 'Children gather fruit'], ['description', 'A test grant.']])
};

test('the wording comes from the records, and only the director changes it, keeping each version', async t => {
  const today = new Date().toISOString().slice(0, 10);
  const fx = await start({ more: put => {
    for (const [id, text] of Object.entries(WORDING)) put('staff/wording/' + id + '.md', text);
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'fern.family@example.test', children: ['fern'] }] });
    put('children/fern.json', { first: 'Fern', last: 'Test', classroom: 'West', status: 'active', enrollDate: today, parents: [{ email: 'fern.family@example.test' }] });
    put('conferences/fern--2026-27-fall.json', { childId: 'fern', schoolYear: '2026-27', term: 'Fall', prep: { questionnaire: true, renee: true } });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const c = await fx.as('', '/family/code', { email: 'fern.family@example.test' }); const fam = (await fx.as('', '/family/login', { email: 'fern.family@example.test', code: c.body.code })).body.token;
  const fd = (await fx.as(fam, '/family/data', {})).body;
  assert.deepStrictEqual(fd.questions, ['What does your child love to build?', 'Who reads with your child?']);
  assert.deepStrictEqual(fd.reflectionQs, [['r1', 'What is new at home?']]);
  assert.deepStrictEqual(fd.checks, [['kaymbu', 'Install the photo app', 'We share photos there.', [['App Store', 'https://example.test/app']]]]);
  assert.deepStrictEqual(fd.pack, [['bottle', 'A water bottle with a name on it']]);
  assert.strictEqual(fd.enrollForm[0].title, 'The child'); assert.strictEqual(fd.enrollForm[0].note, 'As on the birth record.');
  assert.strictEqual(fd.enrollForm[0].fields.find(f => f.k === 'c_first').label, 'First name');
  assert.ok(fd.agreementWords && fd.agreementWords.parts.length);
  // the staff pages receive the wording with the records, and the kitchen does not
  const d = (await fx.as(ann, '/api/data', {})).body;
  assert.strictEqual(d.wording.grant.parts.find(p => p.key === 'description').text, 'A test grant.');
  const kit = (await fx.login('Kit', '1357')).token;
  assert.strictEqual((await fx.as(kit, '/api/data', {})).body.wording, undefined);
  // the director edits a piece in place, and the earlier wording is kept
  const pg = await fx.as(dee, '/api/staff/page', { path: 'staff/wording/family-questionnaire.md' });
  assert.strictEqual(pg.status, 200); assert.strictEqual(pg.body.kind, 'wording');
  assert.strictEqual((await fx.as(ann, '/api/staff/page', { path: 'staff/wording/family-questionnaire.md' })).status, 403);
  const parts = pg.body.parts.map(p => ({ body: p.body }));
  parts[1].body = 'Who reads with your child at bedtime?';
  const sv = await fx.as(dee, '/api/staff/page/save', { path: 'staff/wording/family-questionnaire.md', stamp: pg.body.stamp, title: pg.body.title, parts, note: 'Bedtime' });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body)); assert.strictEqual(sv.body.page.history.length, 1);
  assert.deepStrictEqual((await fx.as(fam, '/family/data', {})).body.questions, ['What does your child love to build?', 'Who reads with your child at bedtime?']);
  // a new line that breaks a writing rule is named before it saves
  parts[0].body = 'What does your child love to build — and why?';
  const bad = await fx.as(dee, '/api/staff/page/save', { path: 'staff/wording/family-questionnaire.md', stamp: sv.body.page.stamp, title: pg.body.title, parts, note: 'A dash' });
  assert.ok(bad.body.findings && bad.body.findings.length);
  // the conference preparation step once kept under a person's name is the director's
  await new Promise(r => setTimeout(r, 1200));
  const cf = JSON.parse(fs.readFileSync(path.join(fx.dir, 'conferences/fern--2026-27-fall.json'), 'utf8'));
  assert.deepStrictEqual(cf.prep, { questionnaire: true, director: true });
});

test('the wording that moved is no longer in the public code', () => {
  const all = ['family.js', 'agreement.js', 'tree.html', 'tree-grant.js', 'tree-conferences.html', 'enroll-forms.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  for (const s of ['What are you noticing about your child at home right now?', 'Morning Program 8:30-12:30 M-F', 'Install the 1Core Family app', 'A reusable water bottle with your child',
    'Increase procurement of California grown', 'Children\'s Sustainability Project, Track 3', 'Reviewed the Family Questionnaire', 'Accepted in 1Core, with schedule and first day set',
    'I accept admission for the school year beginning', 'Welcome phone call with the family', '"California food"', 'Children gather, wash and deliver fruit for snack'])
    assert.ok(!all.includes(s), s);
  // the term the licensing agency requires stays in the code, locked
  assert.match(fs.readFileSync(path.join(ROOT, 'agreement.js'), 'utf8'), /The Department of licensing agency shall have the authority/);
  const A = require('../agreement.js'); A.use(WORDING.agreement);
  const tt = A.terms({ start: '2026-08-24' }, 'mf');
  assert.deepStrictEqual(tt.page1, ['The year begins August 24, 2026.', 'Tuition is $1,000, paid as $100 a month.']);
  assert.strictEqual(tt.page2.length, 3); assert.match(tt.page2[1], /licensing agency/);
  assert.deepStrictEqual(A.PROGRAMS, [['mf', 'Mornings, $1,000 per year, 10 payments of $100', 1000, 100]]);
});
