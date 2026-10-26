'use strict';
// Session 12. Leave them be is a writing rule, quiet in a sentence that says never to do it, and a suggestion in a plan
// or one of our pages that would have children collect, keep or feed a creature is offered as a proposed rewrite that
// the director accepts or keeps as it is. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const W = require('../writing.js');
const { make, call } = require('./harness.js');

test('leave them be is a writing rule', () => {
  const hit = l => W.lineFindings(l).some(x => /Leave them be/.test(x));
  assert.ok(hit('We collect bugs in a jar.'));
  assert.ok(hit('A bug box sits on the shelf.'));
  assert.ok(hit('Keep the caterpillars in a container.'));
  assert.ok(!hit('We never collect creatures in jars, bug boxes or containers.'));
  assert.ok(!hit('We watch the worms in the compost.'));
  assert.ok(!hit('The children gather eggs.'));
});

test('a rewrite to a plan or a page is accepted by the director only', async () => {
  const h = make([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }]);
  h.files.set('staff/library/garden/a-page.md', { text: '# A page\n\nCatch the beetles and keep them.\n', sha: 'x' });
  h.files.set('staff/proposals/rewrite-s12-plan.json', { doc: { id: 'rewrite-s12-plan', kind: 'replace', doc: 'record', path: 'plans/p1.json', field: 'fields.materials', title: 'A plan', status: 'proposed', at: '2026-10-26', from: 'provide food for the squirrel', to: 'watch the squirrel where it lives' }, sha: 'x' });
  h.files.set('staff/proposals/rewrite-s12-page.json', { doc: { id: 'rewrite-s12-page', kind: 'replace', doc: 'record', path: 'staff/library/garden/a-page.md', title: 'A page', status: 'proposed', at: '2026-10-26', from: 'Catch the beetles and keep them.', to: 'Watch the beetles where they live.' }, sha: 'x' });
  await h.staff.load();
  const plan = { id: 'p1', fields: { materials: 'paper, provide food for the squirrel, clipboards' } };
  const edits = [];
  h.staff.useRecsEdit((p, fn) => { const next = fn(plan); if (next === plan) return false; edits.push(p); Object.assign(plan, next); return true; });
  assert.strictEqual((await call(h.staff, 'Ann', 'proposals/accept', { id: 'rewrite-s12-plan' })).status, 403);
  assert.strictEqual((await call(h.staff, 'Dir', 'proposals/accept', { id: 'rewrite-s12-plan' })).status, 200);
  assert.strictEqual(plan.fields.materials, 'paper, watch the squirrel where it lives, clipboards');
  assert.deepStrictEqual(edits, ['plans/p1.json']);
  assert.strictEqual((await call(h.staff, 'Dir', 'proposals/accept', { id: 'rewrite-s12-page', to: 'Watch the beetles where they live, and leave them be.' })).status, 200);
  const d = h.staff.dump();
  assert.match(d['staff/library/garden/a-page.md'], /Watch the beetles where they live, and leave them be\./);
  assert.strictEqual(d['staff/proposals/rewrite-s12-page.json'].status, 'accepted');
  // a rewrite already accepted answers as accepted and changes nothing more
  h.staff.useRecsEdit(() => false);
  const r = await call(h.staff, 'Dir', 'proposals/accept', { id: 'rewrite-s12-plan' });
  assert.strictEqual(r.status, 200, 'an accepted rewrite answers as accepted');
});
