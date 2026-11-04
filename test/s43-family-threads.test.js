'use strict';
// The Family page shows what the child's class is following, each thread by its name, question and status word only,
// with no observation and no other child named. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

test('a family reads the class\'s followed threads by question only', async t => {
  const fx = await start({ more: put => {
    put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['pip'] }] });
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'South', status: 'active', parents: [{ email: 'pip.family@example.test' }] });
    put('children/rue.json', { first: 'Rue', last: 'Test', classroom: 'South', status: 'active', parents: [{ email: 'rue.family@example.test' }] });
    put('threads/t1.json', { id: 't1', name: 'Heavy and light', classroom: 'South', status: 'growing', question: 'What makes a stone heavy? Rue thinks the grey ones are heavier.', lastWeek: '2026-10-19', evidence: [{ planId: 'p1', week: '2026-10-19', text: 'SECRET words from a plan' }], notes: 'PRIVATE team notes' });
    put('threads/t2.json', { id: 't2', name: 'Shadows', classroom: 'South', question: 'Where does a shadow go at noon?', lastWeek: '2026-10-26', evidence: [] });
    put('threads/t3.json', { id: 't3', name: 'Worms', classroom: 'West', question: 'Another class', evidence: [] });
    put('threads/t4.json', { id: 't4', name: 'Set aside', classroom: 'South', unfollowed: true, question: 'Gone', evidence: [] });
    put('threads/t5.json', { id: 't5', name: 'Closed', classroom: 'South', status: 'closed', question: 'Done', evidence: [] });
    put('notices/n1.json', { id: 'n1', at: Date.now() - 864e5, classroom: 'South', by: 'Ann', noticed: 'OBSERVED words that never reach a family', threadId: 't1' });
  } });
  t.after(() => fx.stop());
  const c = await fx.as('', '/family/code', { email: 'pip.family@example.test' });
  const tok = (await fx.as('', '/family/login', { email: 'pip.family@example.test', code: c.body.code })).body.token;
  const d = (await fx.as(tok, '/family/data', {})).body;
  const f = d.children[0].following;
  assert.deepStrictEqual(f, [
    { id: 't2', name: 'Shadows', question: 'Where does a shadow go at noon?', status: 'Emerging' },
    { id: 't1', name: 'Heavy and light', question: 'What makes a stone heavy? A friend thinks the grey ones are heavier.', status: 'Growing' }]);
  const s = JSON.stringify(d);
  assert.doesNotMatch(s, /SECRET|PRIVATE|OBSERVED|Worms|Set aside|Closed|Rue/);
  // the page folds the section under the child's class, with the name, the status word and the question
  const html = fs.readFileSync(path.join(__dirname, '..', 'family.html'), 'utf8');
  assert.match(html, /<details class="shared"><summary>What the \$\{esc\(k\.classroom\?k\.classroom\+" class":"class"\)\} is following<\/summary>/);
  assert.match(html, /k\.following\.map\(t=>/);
});
