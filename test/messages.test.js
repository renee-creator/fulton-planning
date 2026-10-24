'use strict';
// what an educator reads when something goes wrong says what happened and what to do, in plain words, and never
// names the AI model or its maker
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./fixture.js');

test('writing help errors read in plain words without naming the AI', async t => {
  const fx = await start(); t.after(() => fx.stop());
  const { token } = await fx.login('Ann', '1357');
  const ask = async body => { const r = await fetch(fx.api + '/api/read', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + fx.web, Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  for (const body of [{ purpose: 'draft', content: [{ type: 'text', text: 'Strengthen this.' }] }, { purpose: 'threads', content: [{ type: 'text', text: 'x' }] }]) {
    const r = await ask(body);
    assert.ok(r.status >= 400);
    assert.doesNotMatch(r.body.error || '', /Claude|Anthropic|Haiku|Sonnet/, JSON.stringify(r.body));
  }
});
