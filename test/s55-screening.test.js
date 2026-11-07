// an ASQ-3 or ASQ:SE-2 screening is for the director and the educators of the child's class, every result is kept, and
// the questionnaires reach signed-in staff only. The scoring follows the form and the publisher's guidance.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'), path = require('path'), vm = require('vm');
const { start } = require('./fixture.js');

// a made-up questionnaire layout, the shape tools/asq_layout.py writes, with one PDF page standing in for the form
const A3 = { id: 'asq3-36', tool: 'asq3', months: 36, pages: 2, size: [612, 792], window: { from: [34, 16], to: [38, 30] },
  areas: ['C', 'GM', 'FM', 'PS', 'PSo'].map((k, i) => ({ key: k, name: k, cutoff: [30.5, 36.5, 18.5, 30.5, 35.5][i], monitor: [41.5, 45.6, 32.5, 41.5, 44.5][i], monitorNear: k === 'GM' ? 45 : null })),
  items: [].concat(...['C', 'GM', 'FM', 'PS', 'PSo'].map(k => [1, 2, 3, 4, 5, 6].map(n => ({ id: k + n, area: k, n, page: 2, text: 'Item', marks: { y: [1, 1], s: [2, 2], n: [3, 3] } })))),
  rules: [{ if: 'GM6', then: 'GM2' }], totals: {}, overall: [{ n: 1, page: 2, marks: { yes: [1, 1], no: [2, 2] } }, { n: 6, page: 2, marks: { yes: [1, 1], no: [2, 2] } }],
  summary: { page: 2, areas: {}, overall: { 1: { flag: 'no' }, 6: { flag: 'yes' } }, follow: [] } };
const SE = { id: 'asqse2-36', tool: 'asqse2', months: 36, pages: 2, size: [612, 792], window: { from: [33, 0], to: [41, 30] }, cutoff: 100, monitor: 70,
  items: Array.from({ length: 35 }, (_, i) => ({ id: 'Q' + (i + 1), n: i + 1, page: 2, pageN: i < 7 ? 1 : 2, text: 'Item', marks: {}, points: i % 2 ? { often: 10, some: 5, rarely: 0 } : { often: 0, some: 5, rarely: 10 } })),
  overall: [{ n: 36, page: 2, marks: { yes: [1, 1], no: [2, 2] } }], summary: { page: 2, overall: {}, follow: [] } };

function scoring() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/screening-ui.js'), 'utf8');
  const doc = { addEventListener() {}, querySelectorAll: () => [] };
  const ctx = vm.createContext({ document: doc, window: {}, Map, Set, Date, Math, JSON, String, Object, Array, Number, parseIso: s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); } });
  vm.runInContext(src + '\n;this.scrScore=scrScore;this.scrAge=scrAge;this.scrFit=scrFit;this.SCR=SCR;this.scrSuggest=scrSuggest;', ctx);
  return ctx;
}

test('ASQ-3 scoring follows the form, with missing items made up and the form\'s notes applied', () => {
  const S = scoring(); const all = v => Object.fromEntries(A3.items.map(i => [i.id, v]));
  let r = S.scrScore(A3, { answers: all('y') }); assert.deepEqual(r.areas.map(a => a.total), [60, 60, 60, 60, 60]); assert.ok(r.areas.every(a => a.zone === 'above'));
  // one unanswered item is made up from the average of the rest, 5 answered at 10 make 60
  const a1 = all('y'); delete a1.C1; r = S.scrScore(A3, { answers: a1 }); assert.equal(r.areas[0].total, 60); assert.ok(r.areas[0].adjusted);
  // two unanswered, four answered with 20 points, make 30, which is below the 30.5 cutoff
  const a2 = all('y'); delete a2.C1; delete a2.C2; a2.C3 = 'y'; a2.C4 = 'y'; a2.C5 = 'n'; a2.C6 = 'n'; r = S.scrScore(A3, { answers: a2 }); assert.equal(r.areas[0].total, 30); assert.equal(r.areas[0].zone, 'below');
  // three unanswered and the area is not scored
  const a3 = all('y'); delete a3.C1; delete a3.C2; delete a3.C3; r = S.scrScore(A3, { answers: a3 }); assert.equal(r.areas[0].total, null); assert.equal(r.areas[0].zone, 'unscored');
  // 40 in communication sits between the cutoff 30.5 and the monitoring edge 41.5
  const m = all('y'); m.C1 = 'n'; m.C2 = 'n'; r = S.scrScore(A3, { answers: m }); assert.equal(r.areas[0].total, 40); assert.equal(r.areas[0].zone, 'close');
  // gross motor 45 sits at the edge the chart draws, and is read as the monitoring zone with a note
  const g = all('y'); g.GM1 = 's'; g.GM3 = 'n'; r = S.scrScore(A3, { answers: g }); assert.equal(r.areas[1].total, 45); assert.equal(r.areas[1].zone, 'close'); assert.ok(r.areas[1].edge);
  // the form's note marks gross motor 2 yes when 6 is yes or sometimes
  const n = all('y'); n.GM2 = 'n'; n.GM6 = 's'; r = S.scrScore(A3, { answers: n }); assert.equal(r.ans.GM2, 'y'); assert.equal(r.areas[1].total, 55); assert.equal(r.notes.length, 1);
  // an overall answer in bold capitals on the summary needs follow-up
  r = S.scrScore(A3, { answers: all('y'), overall: { 1: { a: 'no' }, 6: { a: 'no' } } }); assert.deepEqual(r.overall.map(o => o.follow), [true, false]);
});

test('ASQ:SE-2 scoring reads each box\'s points from the form, adds 5 for a concern and reads higher as more concern', () => {
  const S = scoring(); const ans = Object.fromEntries(SE.items.map(i => [i.id, i.n % 2 ? 'often' : 'rarely']));
  let r = S.scrScore(SE, { answers: ans }); assert.equal(r.total, 0); assert.equal(r.zone, 'below');
  r = S.scrScore(SE, { answers: Object.assign({}, ans, { Q1: 'rarely', Q2: 'often' }), concern: { Q1: true } }); assert.equal(r.total, 25); assert.equal(r.concerns, 1); assert.deepEqual(r.high, [1, 2]);
  const many = Object.fromEntries(SE.items.map(i => [i.id, i.n % 2 ? 'rarely' : 'often'])); r = S.scrScore(SE, { answers: many }); assert.equal(r.total, 350); assert.equal(r.zone, 'above');
  const mid = Object.assign({}, ans); for (let i = 1; i <= 15; i += 2) mid['Q' + i] = 'some'; r = S.scrScore(SE, { answers: mid }); assert.equal(r.total, 40);
  for (let i = 2; i <= 8; i += 2) mid['Q' + i] = 'often'; r = S.scrScore(SE, { answers: mid }); assert.equal(r.total, 80); assert.equal(r.zone, 'close');
  // three unanswered still totals, but needs an adjusted score, and four is not scored
  const m3 = Object.assign({}, ans); delete m3.Q1; delete m3.Q2; delete m3.Q3; r = S.scrScore(SE, { answers: m3 }); assert.ok(r.needsAdjust); assert.equal(r.total, 0);
  delete m3.Q4; r = S.scrScore(SE, { answers: m3 }); assert.equal(r.total, null);
  assert.deepEqual(r.pages.length, 2);
});

test('TREE picks the questionnaire by the child\'s age in months and days', () => {
  const S = scoring(); S.SCR.list = [A3, SE, Object.assign({}, A3, { id: 'asq3-33', months: 33, window: { from: [31, 16], to: [34, 15] } })];
  assert.deepEqual(JSON.parse(JSON.stringify(S.scrAge('2023-02-20', '2026-01-05'))), { m: 34, d: 16 });
  assert.equal(S.scrFit('asq3', S.scrAge('2023-02-20', '2026-01-05')).id, 'asq3-36');
  assert.equal(S.scrFit('asq3', S.scrAge('2023-02-21', '2026-01-05')).id, 'asq3-33', '34 months 15 days takes the 33 month questionnaire');
  assert.equal(S.scrFit('asqse2', S.scrAge('2023-02-20', '2026-01-05')).id, 'asqse2-36');
  assert.equal(S.scrSuggest('Hitting friends and big feelings at meeting'), 'asqse2');
  assert.equal(S.scrSuggest('Few words and hard to understand when talking'), 'asq3');
});

test('a screening reaches the director and the child\'s class, every result is kept, and the forms stay with signed-in staff', async t => {
  const pdf = Buffer.from('%PDF-1.4\n% a stand-in questionnaire\n');
  const fx = await start({ more: put => {
    put('children/k1.json', { first: 'Rue', last: 'Tan', classroom: 'West', dob: '2023-02-20', status: 'enrolled' });
    put('staff/screening/asq/layout.json', { forms: { 'asq3-36': A3 } });
    put('staff/screening/asq/asq3-36.pdf', pdf.toString('latin1'));
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, bea = (await fx.login('Bea', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const doc = { child: 'k1', tool: 'asq3', form: 'asq3-36', months: 36, date: '2026-01-05', createdBy: 'Ann', copies: { educator: { who: 'Ann', answers: { C1: 'y' } }, family: { answers: {} } } };
  assert.equal((await fx.as(ann, '/api/write', { kind: 'screenings', id: 'sc1', op: 'set', data: doc })).status, 200, 'the class educator starts one');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'screenings', id: 'sc1', op: 'update', patch: { copies: { family: { who: 'Pat', answers: { C1: 'n' } } } } })).status, 200, 'and enters the family copy');
  assert.equal((await fx.as(bea, '/api/write', { kind: 'screenings', id: 'sc1', op: 'update', patch: { notes: 'x' } })).status, 403, 'another class cannot change it');
  assert.equal((await fx.as(bea, '/api/write', { kind: 'screenings', id: 'sc2', op: 'set', data: Object.assign({}, doc, { createdBy: 'Bea' }) })).status, 403, 'or start one for a child in another class');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'screenings', id: 'sc1', op: 'update', patch: { child: 'k2' } })).status, 403, 'a screening stays with its child');
  assert.equal((await fx.as(ann, '/api/write', { kind: 'screenings', id: 'sc1', op: 'delete' })).status, 403, 'every result is kept');
  const seen = async tok => { const r = await fetch(fx.api + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + tok }, body: '{}' }); const j = await r.json(); return Object.keys((j.data || j).screenings || {}); };
  assert.deepEqual(await seen(ann), ['sc1']); assert.deepEqual(await seen(dee), ['sc1']); assert.deepEqual(await seen(bea), [], 'another class does not see it');
  const list = await fx.as(ann, '/api/staff/screening/forms'); assert.equal(list.status, 200); assert.deepEqual(list.body.forms.map(f => f.id), ['asq3-36']);
  assert.equal((await fx.as(ann, '/api/staff/screening/layout', { id: 'asq3-36' })).body.form.areas.length, 5);
  const r = await fetch(fx.api + '/api/staff/screening/form', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + ann }, body: JSON.stringify({ id: 'asq3-36' }) });
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/pdf'); assert.ok(Buffer.from(await r.arrayBuffer()).equals(pdf));
  assert.equal((await fx.as(kit, '/api/staff/screening/forms')).status, 403, 'the kitchen does not open them');
  assert.equal((await fetch(fx.api + '/api/staff/screening/form', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web }, body: '{"id":"asq3-36"}' })).status, 401, 'nor does anyone not signed in');
  assert.equal((await fx.as(dee, '/api/write', { kind: 'screenings', id: 'sc1', op: 'delete' })).status, 200, 'the director may remove one');
});
