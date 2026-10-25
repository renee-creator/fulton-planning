'use strict';
// PD library modules written as drafts. Only the director sees a draft module, its library entry and its source note,
// until she marks it ready. A reflection prompt carries into the weekly journal, and a module opens as a Presenting
// entry built on the Fulton template. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { make, call } = require('./harness.js');

const LIST = [{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }];
const MOD = `<!--
minutes: 100
serves: env, img
status: draft
desc: Spaces that invite play.
order: 2
source: A test deck, March 20, 2026
folds: Another test file, April 2026
-->
# Spaces for Play, for Educators

## Why it matters

Children read a room before an educator speaks.

## Reading

### Paths and edges

Words.

### Loose parts

More words.

## Try this week

Move one thing in your Class.

## Reflect

- What did the children do first?
- What surprised you?

## Readings

- A reading
`;
const TPL = { id: 'template', sections: ['Opening', 'Framing', 'Key ideas', 'The experience', 'Reflection', 'Commitment', 'Plus and delta'].map(t => ({ title: t, minutes: 10, do: 'Do', script: 'Say', handout: 'Line' })), source: 'x' };

async function school() {
  const h = make(LIST);
  h.files.set('staff/pd/modules/12-play.md', { text: MOD, sha: 'm' });
  h.files.set('staff/pd/template.json', { doc: TPL, sha: 't' });
  await h.staff.load(); return h;
}

test('a draft module shows only to the director until she marks it ready', async () => {
  const h = await school();
  const G = (n, p, b) => call(h.staff, n, 'g/' + p, Object.assign({ name: n }, b || {}));
  let dir = (await G('Dir', 'modules')).body.modules.play;
  assert.ok(dir && dir.waiting && dir.source === 'A test deck, March 20, 2026');
  assert.deepStrictEqual(dir.sources, ['Another test file, April 2026']);
  assert.strictEqual((await G('Ann', 'modules')).body.modules.play, undefined);
  const lib = n => G(n, 'boot').then(r => r.body.modules.find(m => m.slug === 'play'));
  assert.strictEqual(await lib('Ann'), undefined, 'no library entry for an educator');
  assert.ok((await lib('Dir')).waiting);
  assert.strictEqual((await G('Ann', 'module/progress', { slug: 'play', progress: { reflection: 'x' } })).status, 404);
  assert.strictEqual((await G('Ann', 'module/ready', { slug: 'play', on: true })).status, 403);
  await G('Dir', 'module/ready', { slug: 'play', on: true });
  const ann = (await G('Ann', 'modules')).body.modules.play;
  assert.strictEqual(ann.title, 'Spaces for Play, for Educators'); assert.strictEqual(ann.source, undefined); assert.strictEqual(ann.sources, undefined);
  assert.strictEqual((await lib('Ann')).desc, 'Spaces that invite play.');
  // hidden again
  await G('Dir', 'module/ready', { slug: 'play', on: false });
  assert.strictEqual((await G('Ann', 'modules')).body.modules.play, undefined);
});

test('a reflection prompt carries into the journal, and the module opens as a Presenting entry', async () => {
  const h = await school();
  const G = (n, p, b) => call(h.staff, n, 'g/' + p, Object.assign({ name: n }, b || {}));
  await G('Dir', 'module/ready', { slug: 'play', on: true });
  assert.strictEqual((await G('Ann', 'module/carry', { slug: 'play', prompt: 'What surprised you?' })).body.carry.prompt, 'What surprised you?');
  const doc = h.files.get('staff/growth/' + 'ann' + '.json');
  const e = (await call(h.staff, 'Dir', 'pres/new', { title: 'Spaces for Play, for Educators', template: true, module: 'play' })).body;
  const part = t => e.plan.find(s => s.title === t).do;
  assert.match(part('Key ideas'), /Paths and edges\. Loose parts\./);
  assert.match(part('Framing'), /read a room/); assert.match(part('Reflection'), /surprised/); assert.match(part('Commitment'), /Move one thing/);
  assert.strictEqual(e.module, 'play');
  assert.strictEqual((await call(h.staff, 'Dir', 'pres/new', { title: 'x', template: true, module: 'nope' })).status, 404);
  void doc;
});
