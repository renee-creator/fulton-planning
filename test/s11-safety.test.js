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
