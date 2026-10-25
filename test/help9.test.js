'use strict';
// Help inside TREE. Hidden until the director marks it ready, each person receives only the answers for what they can do,
// educators never a director-only answer, the kitchen its own, and Help shows at the top of Search with cards to print.
// Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const HELP = { id: 'help', source: 'A test source', list: [
  { id: 'h01', q: 'How do I keep an observation?', a: ['Open Observations.', 'Tap New observation.'], go: 'moments', label: 'Observations', roles: ['educator', 'director'], quick: true, words: 'notice wonder' },
  { id: 'h02', q: 'How do I add a new educator?', a: ['Open Educators.', 'Tap Add a new educator.'], go: 'stteam', label: 'Educators', roles: ['director'], words: 'hire' },
  { id: 'h03', q: 'How do I record a harvest?', a: ['Open Kitchen.', 'Tap Record a harvest.'], go: 'kitchen', label: 'Kitchen', roles: ['kitchen'], quick: true, words: 'garden' }] };

test('Help inside TREE', async t => {
  const fx = await start({ more: put => put('staff/help.json', HELP) }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token, kit = (await fx.login('Kit', '1357')).token;
  const H = (tok, p, b) => fx.as(tok, '/api/staff/help' + (p ? '/' + p : ''), b || {}).then(r => r.body);
  assert.deepStrictEqual((await H(ann)).list, []); assert.ok((await H(dee)).waiting);
  assert.strictEqual((await fx.as(ann, '/api/staff/help/ready', { on: true })).status, 403);
  await H(dee, 'ready', { on: true });
  assert.deepStrictEqual((await H(ann)).list.map(x => x.id), ['h01'], 'never a director-only answer');
  assert.deepStrictEqual((await H(kit)).list.map(x => x.id), ['h03']);
  assert.strictEqual((await H(dee)).list.length, 3);
  assert.strictEqual((await H(ann)).source, undefined);
  const b = await (await browser()).launch(); t.after(() => b.close());
  const s = await signedIn(fx, b, 'Ann', '1357');
  await s.p.evaluate(() => { gs.q = 'keep an observation'; goView('search'); }); await s.p.waitForFunction(() => /Tap New observation/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
  assert.ok(await s.p.evaluate(() => !!document.querySelector('[data-print="helpcard"][data-word="1"]')));
  assert.deepStrictEqual(s.errors, []); await s.close();
  const k = await signedIn(fx, b, 'Kit', '1357');
  await k.p.evaluate(() => { gs.q = 'harvest'; goView('search'); }); await k.p.waitForFunction(() => /Record a harvest/.test(document.querySelector('#main').innerText), null, { timeout: 15000 });
  const kt = await k.p.evaluate(() => document.querySelector('#main').innerText); assert.match(kt, /^Help/m); assert.doesNotMatch(kt, /Any child|observation/i);
  assert.deepStrictEqual(k.errors, []); await k.close();
});
