'use strict';
// Keeping records. Nothing is removed until the director chooses Remove and confirms it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

test('a former child past the keeping period waits for the director, and Remove asks to be sure', async () => {
  const fx = await start({ more: put => {
    put('children/kit-old.json', { first: 'Pip', last: 'Old', status: 'withdrawn', leftAs: 'left', leftOn: '2020-06-10', classroom: 'West' });
    put('children/kit-new.json', { first: 'Rue', last: 'New', status: 'withdrawn', leftAs: 'moved', leftOn: '2025-06-10', classroom: 'West' });
    put('children/kit-here.json', { first: 'Sol', last: 'Here', status: 'active', classroom: 'West' });
    put('conferences/conf-new.json', { childId: 'kit-new', term: 'Fall 2024' });
    put('notices/n-old.json', { id: 'n-old', by: 'Ann', noticed: 'Pip stacked the stones', children: ['kit-old'], at: 1 });
  } });
  try {
    const dt = (await fx.login('Dee', 'director-pass-1')).token, at = (await fx.login('Ann', '1357')).token;
    assert.strictEqual((await fx.as(at, '/api/keeping')).status, 403);
    assert.strictEqual((await fx.as(at, '/api/data')).body.data.settings.keeping, undefined);
    let r = await fx.as(dt, '/api/keeping');
    assert.strictEqual(r.body.childYears, 3); assert.strictEqual(r.body.staffYears, 3);
    assert.match(r.body.sources.child.reg, /101221/); assert.match(r.body.sources.staff.reg, /101217/);
    assert.deepStrictEqual(r.body.due.map(d => d.id), ['kit-old'], 'only a child past the period, never one still at Fulton');
    assert.strictEqual((await fx.as(dt, '/api/keeping/remove', { kind: 'child', id: 'kit-old' })).status, 400, 'Remove asks once more');
    assert.strictEqual((await fx.as(dt, '/api/keeping/remove', { kind: 'child', id: 'kit-new', sure: true })).status, 404, 'nothing before its period');
    assert.strictEqual((await fx.as(at, '/api/keeping/remove', { kind: 'child', id: 'kit-old', sure: true })).status, 403);
    r = await fx.as(dt, '/api/keeping/keep', { kind: 'child', id: 'kit-old', years: 1 });
    assert.deepStrictEqual(r.body.due, [], 'Keep longer asks again in a year');
    r = await fx.as(dt, '/api/keeping/set', { childYears: '' });
    assert.strictEqual(r.body.childYears, '', 'a period can be left blank for the director to set');
    r = await fx.as(dt, '/api/keeping/set', { childYears: 1 });
    assert.ok(r.body.due.some(d => d.id === 'kit-new') && !r.body.due.some(d => d.id === 'kit-old'));
    r = await fx.as(dt, '/api/keeping/remove', { kind: 'child', id: 'kit-new', sure: true });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.removed[0].name, 'Rue New');
    await new Promise(ok => setTimeout(ok, 2000));
    assert.ok(!fs.existsSync(path.join(fx.dir, 'children/kit-new.json')) && !fs.existsSync(path.join(fx.dir, 'conferences/conf-new.json')));
    assert.ok(fs.existsSync(path.join(fx.dir, 'children/kit-here.json')) && fs.existsSync(path.join(fx.dir, 'children/kit-old.json')) && fs.existsSync(path.join(fx.dir, 'notices/n-old.json')), 'everything else stays');
  } finally { await fx.stop(); }
});
