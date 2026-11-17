'use strict';
// The director's look at the Family page as one family. It opens that family's page with no code, reads it, and saves
// nothing. Only the director can open one. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const more = put => {
  put('participation/config.json', { id: 'config', test: false, testers: [] });
  put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', parents: [{ name: 'Rosa Rep', email: 'pip.family@example.test' }] });
  put('children/nomail.json', { first: 'Nel', last: 'Test', classroom: 'West', status: 'active', parents: [{ name: 'No Mail', email: '' }] });
};
test('the director sees a family page as that family, and nothing there is saved', async t => {
  const fx = await start({ more }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, shared = (await fx.login('Shared', 'shared-pass-1')).token;
  assert.strictEqual((await fx.as(shared, '/api/family/viewas', { childId: 'pip' })).status, 403, 'an educator cannot open one');
  assert.strictEqual((await fx.as(dee, '/api/family/viewas', { childId: 'nomail' })).status, 400, 'a child with no parent email has no page to see');
  const r = await fx.as(dee, '/api/family/viewas', { childId: 'pip' }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.name, 'Pip Test');
  const d = await fx.as(r.body.token, '/family/data', {}); assert.strictEqual(d.status, 200); assert.ok(d.body.children.some(k => k.first === 'Pip'));
  const w = await fx.as(r.body.token, '/family/log', { what: 'Peeled crayons', date: today, minutes: 20, childId: 'pip', type: 'job' });
  assert.strictEqual(w.status, 403); assert.match(w.body.error, /Nothing is saved/);
  assert.strictEqual((await fx.as(r.body.token, '/family/strengths', { text: 'x' })).status, 403);
});
