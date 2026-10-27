'use strict';
// The leftovers from the October audit. The old Planning Studio page only sends everyone to TREE, a photo key opens one
// photo, conference notes reach a family only when the director or the office shares them, and an educator cannot
// change a child's Class. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { start } = require('./fixture.js');
const PHOTO = fs.readFileSync(path.join(__dirname, '..', 'post_photo.jpg'));
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const keyFor = (fk, id) => { const i = fk.indexOf('.'); return fk.slice(0, i) + '.' + b64u(crypto.createHmac('sha256', Buffer.from(fk.slice(i + 1), 'utf8')).update(id, 'utf8').digest()).slice(0, 32); };

test('the old Planning Studio page holds no connection to the server', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'planning-studio.html'), 'utf8');
  assert.match(html, /tree\.html/);
  assert.doesNotMatch(html, /onrender|\/api\//);
  assert.ok(html.length < 2000);
});

test('audit leftovers on the server', async t => {
  const fx = await start({ more: put => {
    put('children/lark-1.json', { id: 'lark-1', first: 'Lark', last: 'Test', classroom: 'West', status: 'active' });
    put('conferences/lark-1--2026-27-fall.json', { childId: 'lark-1', term: 'Fall', schoolYear: '2026-27', fields: { strengths: 'Counts ducks' } });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;

  await t.test('a photo key opens that photo alone', async () => {
    const a = await fx.as(ann, '/api/original', { name: 'a.jpg', data: PHOTO.toString('base64') });
    const b = await fx.as(ann, '/api/original', { name: 'b.jpg', data: PHOTO.toString('base64') });
    assert.ok(a.body.id && b.body.id && a.body.id !== b.body.id);
    const fk = (await fx.as(ann, '/api/data', {})).body.fileKey;
    const get = (id, t) => fetch(fx.api + '/original/' + encodeURIComponent(id) + '?t=' + encodeURIComponent(t)).then(r => r.status);
    assert.strictEqual(await get(a.body.id, keyFor(fk, a.body.id)), 200);
    assert.strictEqual(await get(b.body.id, keyFor(fk, a.body.id)), 403, 'the key for one photo does not open another');
    assert.strictEqual(await get(a.body.id, fk), 403, 'the page secret itself is never a key');
    assert.strictEqual(await get(a.body.id, keyFor(fk.replace(/^[^.]+/, (Date.now() - 1000).toString(36)), a.body.id)), 403, 'an expired key opens nothing');
  });

  await t.test('conference notes are never shared with a family, by anyone', async () => {
    const id = 'lark-1--2026-27-fall';
    await fx.as(ann, '/api/write', { op: 'update', kind: 'conferences', id, patch: { sharedWithFamily: true, sharedAt: 'now', fields: { strengths: 'Counts ducks and geese' } } });
    let d = (await fx.as(dee, '/api/data', {})).body.data.conferences[id];
    assert.strictEqual(d.sharedWithFamily, undefined); assert.strictEqual(d.fields.strengths, 'Counts ducks and geese');
    await fx.as(dee, '/api/write', { op: 'update', kind: 'conferences', id, patch: { sharedWithFamily: true } });
    d = (await fx.as(dee, '/api/data', {})).body.data.conferences[id];
    assert.strictEqual(d.sharedWithFamily, undefined, 'the director cannot share them either, the Family Summary is what goes home');
  });

  await t.test('an educator cannot change a child\'s Class', async () => {
    await fx.as(ann, '/api/write', { op: 'update', kind: 'children', id: 'lark-1', patch: { classroom: 'North', gender: 'F' } });
    let c = (await fx.as(dee, '/api/data', {})).body.data.children['lark-1'];
    assert.strictEqual(c.classroom, 'West'); assert.strictEqual(c.gender, 'F');
    await fx.as(ann, '/api/write', { op: 'set', kind: 'children', id: 'lark-1', data: Object.assign({}, c, { classroom: 'South' }) });
    c = (await fx.as(dee, '/api/data', {})).body.data.children['lark-1'];
    assert.strictEqual(c.classroom, 'West');
    await fx.as(dee, '/api/write', { op: 'update', kind: 'children', id: 'lark-1', patch: { classroom: 'North' } });
    assert.strictEqual((await fx.as(dee, '/api/data', {})).body.data.children['lark-1'].classroom, 'North');
  });
});
