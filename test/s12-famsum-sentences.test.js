'use strict';
// Session 12. The Family Summary reads in complete sentences. The quick model rewrites the educators' notes, and what
// it gives back is cleaned again, so no other child's name or rating reaches the family. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start } = require('./fixture.js');

test('the Family Summary draft is set in complete sentences, cleaned again', async t => {
  let asked = '';
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { asked = Buffer.concat(c).toString();
    const text = JSON.stringify({ returns: 'Fern returns to stories again and again; she loves the creek.', area_social: 'Fern shows care for her friends, and she is Building Middle with Bruno.' });
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok));
  const today = new Date().toISOString().slice(0, 10);
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more: put => {
    put('children/fern.json', { first: 'Fern', last: 'Test', classroom: 'West', status: 'active', enrollDate: today });
    put('children/bruno.json', { first: 'Bruno', last: 'Other', classroom: 'West', status: 'active', enrollDate: today });
    put('conferences/fern--2026-27-fall.json', { childId: 'fern', schoolYear: '2026-27', term: 'Fall', confDate: '2099-01-01', fields: { interests: 'Stories. Creek.', social: 'Caring with friends.' } });
  } });
  t.after(async () => { await fx.stop(); ai.close(); });
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let r = null; for (let i = 0; i < 40; i++) { r = await fx.as(dee, '/api/conf/summary/draft', { id: 'fern--2026-27-fall' }); if (r.status === 200) break; await new Promise(ok => setTimeout(ok, 250)); }
  const p = r.body.familySummary.parts;
  assert.match(asked, /complete, warm, plain sentences/);
  assert.strictEqual(p.returns, 'Fern returns to stories again and again. She loves the creek.');
  assert.ok(!/Bruno/.test(p.areas.social), 'no other child named');
  assert.ok(/Building Middle/.test(p.areas.social), "the educators' DRDP words stay, since they make learning visible");
});

test('a reply with no closing brace leaves the draft as it is and is asked for only once', async t => {
  let calls = 0;
  const ai = http.createServer((q, r) => { q.resume(); q.on('end', () => { calls++;
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text: '{"returns": "Fern returns to stories' }], stop_reason: 'max_tokens' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok));
  const today = new Date().toISOString().slice(0, 10);
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more: put => {
    put('children/fern.json', { first: 'Fern', last: 'Test', classroom: 'West', status: 'active', enrollDate: today });
    put('conferences/fern--2026-27-fall.json', { childId: 'fern', schoolYear: '2026-27', term: 'Fall', confDate: '2099-01-01', fields: { interests: 'Fern loves stories. She visits the creek.' } });
  } });
  t.after(async () => { await fx.stop(); ai.close(); });
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  let r = null; for (let i = 0; i < 40; i++) { r = await fx.as(dee, '/api/conf/summary/draft', { id: 'fern--2026-27-fall' }); if (r.status === 200) break; await new Promise(ok => setTimeout(ok, 250)); }
  assert.strictEqual(r.status, 200);
  assert.ok(!r.body.familySummary.sentences, 'the draft stays in note form for the educator to finish');
  assert.match(r.body.familySummary.parts.returns, /loves stories/);
  assert.strictEqual(calls, 1, 'a reply that cannot be read is not asked for again');
});
