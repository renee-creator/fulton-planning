'use strict';
// The Fulton PD template in Presenting. Only the director starts from it, the entry gets its seven parts with times,
// what participants do, a facilitator script and the handout line, and the source note shows to her only. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const PARTS = ['Opening', 'Framing', 'Key ideas', 'The experience', 'Reflection', 'Commitment', 'Plus and delta'];
const T = { id: 'template', sections: PARTS.map((t, i) => ({ title: t, minutes: 10 + i, do: 'Do ' + t, script: 'Say ' + t, handout: 'Line ' + t })), source: 'From a test source.' };

test('the Fulton PD template', async t => {
  const fx = await start({ more: put => put('staff/pd/template.json', T) });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const P = (tok, p, b) => fx.as(tok, '/api/staff/pres/' + p, b || {});
  assert.strictEqual((await P(ann, 'new', { title: 'Mine', template: true })).status, 403);
  const e = (await P(dee, 'new', { title: 'Seeing the garden', template: true })).body;
  assert.deepStrictEqual(e.plan.map(s => s.title), PARTS);
  assert.strictEqual(e.plan[3].script, 'Say The experience'); assert.strictEqual(e.plan[6].handout, 'Line Plus and delta');
  assert.strictEqual(e.minutes, T.sections.reduce((a, s) => a + s.minutes, 0));
  assert.strictEqual(e.templateSource, 'From a test source.');
  // a plan saved keeps the script and the handout line
  await P(dee, 'item', { id: e.id, list: 'plan', item: Object.assign({}, e.plan[0], { script: 'Say Opening again' }) });
  const s2 = (await P(dee, 'get', { id: e.id })).body;
  assert.strictEqual(s2.plan[0].script, 'Say Opening again'); assert.strictEqual(s2.plan[0].handout, 'Line Opening');
  // a presenter sees the plan but never the source note
  await P(dee, 'save', { id: e.id, fields: { presenters: ['Ann'] } });
  const a = (await P(ann, 'get', { id: e.id })).body;
  assert.strictEqual(a.plan.length, 7); assert.strictEqual(a.templateSource, undefined);
  // a plain entry is unchanged
  assert.deepStrictEqual((await P(dee, 'new', { title: 'Plain' })).body.plan, []);
});
