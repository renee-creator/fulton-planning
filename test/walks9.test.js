'use strict';
// Walk safety. Hidden until the director marks it ready, the backpack list read from the Policies and Procedures,
// proposed sections that change nothing until she accepts them, and families invited to a walk through the participation
// sign-ups, with the walk agreements on the Family page and the invitation on the calendar. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

const WALKS = { id: 'walks', ready: false, checklist: ['Every child wears a safety vest.'], agreements: ['Find your partner.', 'We stay safe.'], rule: ['Safety comes first.'], families: ['Families are welcome to join our walks.'], handbook: 'walks-off-campus', backpack: 'pack', photos: [] };

test('walk safety', async t => {
  const day = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const fx = await start({ more: put => {
    put('staff/walks.json', WALKS);
    put('staff/policies/teacher/pack.json', { id: 'pack', title: 'Pack list', body: '- First Aid Kit\n- Roster' });
    put('staff/proposals/walk-safety.json', { id: 'walk-safety', doc: 'teacher', part: 'a-part', title: 'Walk Safety', body: 'Words.', status: 'proposed', at: '2026-10-25' });
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const family = async email => { const c = await fx.as('', '/family/code', { email }); return (await fx.as('', '/family/login', { email, code: c.body.code })).body.token; };

  await t.test('nothing shows to educators or families until it is ready', async () => {
    assert.strictEqual((await fx.as(ann, '/api/staff/walks', {})).status, 403);
    const w = (await fx.as(dee, '/api/staff/walks', {})).body;
    assert.deepStrictEqual(w.backpack.items, ['First Aid Kit', 'Roster']);
    assert.strictEqual((await fx.as(ann, '/api/staff/proposals', {})).status, 403);
    assert.strictEqual((await fx.as(dee, '/api/staff/proposals', {})).body.list[0].status, 'proposed');
  });

  await t.test('a walk invitation shows on the calendar and, once ready, carries the agreements to the family', async () => {
    const r = await fx.as(dee, '/api/write', { op: 'create', kind: 'participation', id: 'it-walk1', data: { kind: 'item', type: 'event', walk: true, onCalendar: true, title: 'Creek walk', date: day, start: '09:30', end: '11:00', spots: 4, classroom: '', signups: [], open: true, test: true } });
    assert.strictEqual(r.status, 200); await new Promise(r => setTimeout(r, 1200));
    const v = await fx.as(ann, '/api/view', { from: day, to: day });
    assert.ok((v.body.events || []).some(e => e.cal === 'tfam' && /Families invited, Creek walk/.test(e.title)));
    const tok = await family('pip.family@example.test');
    let d = (await fx.as(tok, '/family/data', {})).body;
    assert.ok(d.open.some(it => it.walk && it.title === 'Creek walk')); assert.strictEqual(d.walkInfo, null);
    await fx.as(dee, '/api/staff/walks/ready', { on: true });
    d = (await fx.as(tok, '/family/data', {})).body;
    assert.deepStrictEqual(d.walkInfo.agreements, ['Find your partner.', 'We stay safe.']);
    assert.strictEqual((await fx.as(ann, '/api/staff/walks', {})).status, 200);
  });
});
