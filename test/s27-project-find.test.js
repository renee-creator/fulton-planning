'use strict';
// Find observations for this project reads the last eight weeks now, and what may belong waits under Observations TREE
// found until the director adds it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const more = put => {
  put('projects/x1.json', { id: 'x1', name: 'Creek walks', experience: 'Walks along the creek.', underneath: 'Perhaps children are investigating how water moves.', intent: 'We wonder what keeps their attention.', home: 'West', status: 'active', createdAt: Date.now() - 20 * day, classrooms: [{ room: 'West' }], threads: [] });
  put('notices/n1.json', { id: 'n1', noticed: 'Threw sticks in the creek and ran along the bank to see where they went.', at: Date.now() - 3 * day, classroom: 'West', by: 'Ann' });
  put('notices/n2.json', { id: 'n2', noticed: 'Sang the goodbye song together at pickup by the gate.', at: Date.now() - 2 * day, classroom: 'West', by: 'Ann' });
};

test('Find observations for this project lists what may belong, and nothing joins without a tap', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    const text = /may belong to a project/.test(body) ? JSON.stringify({ found: [{ id: 'n1', why: 'Perhaps they are following where the water carries things.' }] }) : '{}';
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('[data-pfind="x1"]', { timeout: 15000, state: 'attached' });
  await s.p.evaluate(() => document.querySelector('[data-pfind="x1"]').click());
  await s.p.waitForFunction(() => projWaiting(projects.get('x1')).length === 1, null, { timeout: 15000 });
  assert.ok(asked.some(b => /may belong to a project/.test(b) && /Threw sticks in the creek/.test(b)), 'TREE read the recent observations');
  assert.deepStrictEqual(await s.p.evaluate(() => projNotices(projects.get('x1')).map(n => n.id)), [], 'nothing joined yet');
  await s.p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; }));
  assert.match(await s.p.innerText('#main'), /From the week's reading\. Perhaps they are following where the water carries things\./);
  await s.p.click('[data-projadd="x1|n1"]'); await s.p.waitForTimeout(300);
  assert.deepStrictEqual(await s.p.evaluate(() => projNotices(projects.get('x1')).map(n => n.id)), ['n1']);
  assert.deepStrictEqual(s.errors, []);
});
