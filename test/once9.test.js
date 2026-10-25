'use strict';
// Session 9's one-time steps. The mandated reporter link points to the California page, and each current employee with a
// sign-in, the kitchen included and the director left out, has the 2026 Know Your Rights notice on file outside TREE,
// with no date. Running a step again changes nothing. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { make } = require('./harness.js');

test('the one-time steps', async () => {
  const h = make([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }, { name: 'Kit', kitchen: true, role: 'staff' }]);
  h.files.set('staff/pd/licensing/22-official-trainings.md', { text: '## Official trainings\n\n[Mandated reporter](https://mandatedreportertraining.com)\n', sha: 'x' });
  await h.staff.load();
  h.staff.once.trainingLinks(); h.staff.once.kyr2026(); h.staff.once.kyr2026();
  const d = h.staff.dump();
  assert.match(d['staff/pd/licensing/22-official-trainings.md'], /\(https:\/\/mandatedreportertraining\.com\/california\/\)/);
  const k = n => (d['staff/people/' + n + '.json'] || {}).notices;
  assert.deepStrictEqual(k('ann').kyr['2026'], { outside: true }); assert.deepStrictEqual(k('kit').kyr['2026'], { outside: true });
  assert.ok(!(k('dir') && k('dir').kyr && k('dir').kyr['2026']), 'the director is left out');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(src, /ONCE\.push\(\['trainingLinks'/); assert.match(src, /ONCE\.push\(\['kyr2026'/);
});
