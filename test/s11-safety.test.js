'use strict';
// Session 11, safety. Settings are the director's on the server, an educator may only add their own name to the
// educators list, and the conference page reads the director flag the server sends. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');
const ROOT = path.join(__dirname, '..');

test('settings are the director\'s on the server', async t => {
  const fx = await start({ more: put => {
    put('settings/main.json', { id: 'main', classrooms: ['West', 'North'], years: ['2026-27'], educators: { West: ['Ann'], North: ['Bea'] }, groups: [] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, gia = (await fx.login('Gia', '1357')).token;
  const read = rel => JSON.parse(fs.readFileSync(path.join(fx.dir, rel), 'utf8'));

  await t.test('an educator cannot save settings/main', async () => {
    const r = await fx.as(ann, '/api/write', { op: 'set', kind: 'settings', id: 'main', data: { id: 'main', classrooms: ['West'], signupUrl: 'x' } });
    assert.strictEqual(r.status, 403);
    const p = await fx.as(ann, '/api/write', { op: 'update', kind: 'settings', id: 'main', patch: { years: ['1999-00'] } });
    assert.strictEqual(p.status, 403);
  });
  await t.test('nor Program settings, nor any other setting', async () => {
    for (const id of ['program', 'notify', 'display', 'once']) assert.strictEqual((await fx.as(ann, '/api/write', { op: 'set', kind: 'settings', id, data: { id } })).status, 403, id);
  });
  await t.test('the director can', async () => {
    const r = await fx.as(dee, '/api/write', { op: 'update', kind: 'settings', id: 'main', patch: { years: ['2026-27', '2027-28'] } });
    assert.strictEqual(r.status, 200);
  });
  await t.test('an educator adds only their own name to the educators list', async () => {
    // Gia is not on the list. A save that also drops Ann and renames Bea keeps the list and adds Gia alone.
    const r = await fx.as(gia, '/api/write', { op: 'set', kind: 'settings', id: 'educators', data: { names: [{ name: 'Bea', room: 'South' }, { name: 'Gia', room: 'West' }, { name: 'Zed', room: 'West' }] } });
    assert.strictEqual(r.status, 200);
    const names = r.body.doc.names.map(x => x.name + ':' + x.room);
    assert.deepStrictEqual(names, ['Ann:West', 'Bea:North', 'Gia:West']);
    // once on the list, nothing more may change
    const again = await fx.as(gia, '/api/write', { op: 'set', kind: 'settings', id: 'educators', data: { names: [{ name: 'Gia', room: 'North' }] } });
    assert.strictEqual(again.status, 403);
    const other = await fx.as(ann, '/api/write', { op: 'set', kind: 'settings', id: 'educators', data: { names: [] } });
    assert.strictEqual(other.status, 403);
    assert.strictEqual((await fx.as(ann, '/api/write', { op: 'delete', kind: 'settings', id: 'educators' })).status, 403);
  });
  await t.test('the director\'s settings never reach an educator', async () => {
    await fx.as(dee, '/api/write', { op: 'set', kind: 'settings', id: 'keeping', data: { id: 'keeping', children: 3 } });
    const d = await fx.as(ann, '/api/data', {});
    assert.strictEqual(d.body.director, false);
    assert.ok(!d.body.data.settings.keeping);
    const ch = await fx.as(ann, '/api/changes', { since: 0 });
    assert.ok(!(ch.body.changes && ch.body.changes.settings && ch.body.changes.settings.keeping));
    assert.strictEqual((await fx.as(dee, '/api/data', {})).body.director, true);
    void read;
  });
});

test('the Conferences page uses the director flag the server sends', () => {
  const html = fs.readFileSync(path.join(ROOT, 'tree-conferences.html'), 'utf8');
  assert.doesNotMatch(html, /localStorage\.getItem\("fp-director"\)/);
  assert.match(html, /Store\.director=!!j\.director/);
  const cal = fs.readFileSync(path.join(ROOT, 'tree-calendar.html'), 'utf8');
  assert.doesNotMatch(cal, /fp-director/);
  // the settings on the server are one list, used for what a page receives and for the changes sent after
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.strictEqual((srv.match(/id === 'staffnotes'/g) || []).length, 0);
  assert.match(srv, /const DIRECTOR_SETTINGS = \[/);
});

test('a family\'s allergy line waits for the office, then reaches the card, the kitchen and the class list', async t => {
  const today = new Date().toISOString().slice(0, 10);
  const fx = await start({ more: put => {
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'wren.family@example.test', children: ['wren'] }] });
    put('children/wren.json', { first: 'Wren', last: 'Test', classroom: 'West', status: 'active', enrollDate: today, parents: [{ email: 'wren.family@example.test' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const c = await fx.as('', '/family/code', { email: 'wren.family@example.test' }); const fam = (await fx.as('', '/family/login', { email: 'wren.family@example.test', code: c.body.code })).body.token;
  const fd = (await fx.as(fam, '/family/data', {})).body;
  const fields = fd.enrollForm.flatMap(s => s.fields);
  const data = {}; for (const f of fields) data[f.k] = f.type === 'yn' ? 'No' : f.type === 'check' ? true : f.type === 'illness' ? '' : 'x';
  Object.assign(data, { fa_has: 'Yes', fa_food: 'Eggs and dairy', fa_reaction: 'Hives', fa_reason: 'An allergy', fa_medical: 'Yes' });
  const sub = await fx.as(fam, '/family/enroll', { childId: 'wren', data, done: true });
  assert.strictEqual(sub.status, 200, JSON.stringify(sub.body));
  const kid = async tok => (await fx.as(tok, '/api/data', {})).body.data.children.wren;
  let w = await kid(dee);
  assert.strictEqual(w.diet.pending.line, 'Eggs and dairy, medical');
  assert.ok(!w.diet.line, 'nothing shows until the office confirms it');
  assert.deepStrictEqual((await fx.as(kit, '/api/kitchen-diets', {})).body.list, []);
  // an educator's save never confirms or changes the line
  await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'wren', patch: { diet: { line: 'Nothing', none: false, at: 'x' } } });
  assert.ok(!(await kid(dee)).diet.line);
  // the office confirms it
  const ok = await fx.as(dee, '/api/write', { op: 'update', kind: 'children', id: 'wren', patch: { diet: { line: 'Eggs and dairy, medical', none: false, at: new Date().toISOString(), by: 'Dee', pending: { __delete__: true } } } });
  assert.strictEqual(ok.status, 200);
  w = await kid(ann); assert.strictEqual(w.diet.line, 'Eggs and dairy, medical'); assert.ok(!w.diet.pending);
  // the kitchen receives the first name, last initial, Class and line, and nothing else of the child
  const k = (await fx.as(kit, '/api/kitchen-diets', {})).body.list;
  assert.deepStrictEqual(k, [{ name: 'Wren T.', room: 'West', line: 'Eggs and dairy, medical' }]);
  assert.ok(!(await fx.as(kit, '/api/data', {})).body.data.children.wren, 'the kitchen still receives no children\'s records');
  // the same answer again leaves nothing waiting, and a change waits for the office
  await fx.as(fam, '/family/enroll', { childId: 'wren', data, done: true });
  assert.ok(!(await kid(dee)).diet.pending);
  await fx.as(fam, '/family/enroll', { childId: 'wren', data: Object.assign({}, data, { fa_food: 'Eggs', fa_medical: 'No' }), done: true });
  w = await kid(dee); assert.strictEqual(w.diet.line, 'Eggs and dairy, medical'); assert.strictEqual(w.diet.pending.line, 'Eggs');
});

test('the card, the Kitchen page and the Class list show the confirmed line', () => {
  const html = fs.readFileSync(path.join(ROOT, 'tree.html'), 'utf8');
  for (const s of ['${kidDietHtml(c)}${kidFamilyHtml(c)}', 'printBtns("classlist",kRoom,"Class list")', '${kGardenHtml()}${kDietHtml()}', 'kitchenCardHtml(wk,false)}${kDietHtml()}', 'data-kdietgo=', 'class="kline kdiet"']) assert.ok(html.includes(s), s);
});
