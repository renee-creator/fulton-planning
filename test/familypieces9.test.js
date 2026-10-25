'use strict';
// Pieces for the Family page. A draft reaches no family until the director marks it ready, the TK and kindergarten guide
// reaches only a family whose child goes to TK or kindergarten next year, and no source note leaves the server for a
// family. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

const piece = (title, aud) => `<!--\nstatus: draft\norder: 1\naudience: ${aud}\nsource: A test file, May 1, 2025\n-->\n# ${title}\n\n## A heading\n\n- One thing\n`;
const nyKey = (() => { const d = new Date(); const a = (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1) + 1; return a + '-' + String(a + 1).slice(2); })();

test('Family page pieces', async t => {
  const fx = await start({ more: put => {
    put('staff/familypieces/arc.md', piece('Three Years with Your Child\'s Educators', 'all'));
    put('staff/familypieces/tk.md', piece('Choosing TK or Kindergarten with Your Child\'s Educators', 'tk'));
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }, { email: 'rue.family@example.test', children: ['rue'] }] });
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'South', status: 'active', parents: [{ email: 'pip.family@example.test' }], transition: { [nyKey]: { plan: 'tk' } } });
    put('children/rue.json', { first: 'Rue', last: 'Test', classroom: 'West', status: 'active', parents: [{ email: 'rue.family@example.test' }] });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const family = async email => { const c = await fx.as('', '/family/code', { email }); return (await fx.as('', '/family/login', { email, code: c.body.code })).body.token; };
  const pip = await family('pip.family@example.test'), rue = await family('rue.family@example.test');
  const data = tok => fx.as(tok, '/family/data', {}).then(r => r.body);
  assert.strictEqual((await fx.as(ann, '/api/staff/familypieces', {})).status, 403);
  assert.ok((await fx.as(dee, '/api/staff/familypieces', {})).body.list.every(x => x.waiting));
  let d = await data(pip); assert.deepStrictEqual(d.pieces, []); assert.strictEqual(d.children[0].tkGuide, null);
  await fx.as(dee, '/api/staff/familypieces/ready', { slug: 'arc', on: true }); await fx.as(dee, '/api/staff/familypieces/ready', { slug: 'tk', on: true });
  d = await data(pip); assert.deepStrictEqual(d.pieces.map(p => p.slug), ['arc']); assert.strictEqual(d.pieces[0].source, undefined);
  assert.strictEqual(d.children[0].tkGuide.slug, 'tk');
  const r = await data(rue); assert.strictEqual(r.children[0].tkGuide, null, 'a child staying at Fulton gets no TK guide');
  assert.doesNotMatch(JSON.stringify(d) + JSON.stringify(r), /A test file/);
});
