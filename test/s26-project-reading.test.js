'use strict';
// Keep this as an earlier reading asks what changed the team's thinking, keeps it with the earlier reading, and TREE can
// draft the new one from the evidence for the director to use or not. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');

const day = 864e5;
const more = put => {
  put('projects/x1.json', { id: 'x1', name: 'Creek walks', experience: 'Walks along the creek each week.', underneath: 'It may be that children are investigating how water moves.', intent: 'We wonder what keeps their attention.', home: 'West', status: 'active', createdAt: Date.now() - 20 * day, createdBy: 'Ann', classrooms: [{ room: 'West' }], threads: [] });
  put('notices/n1.json', { id: 'n1', noticed: 'Dropped leaves and sticks in the creek to see which ones float away first.', at: Date.now() - 2 * day, projectId: 'x1', classroom: 'West', by: 'Ann' });
};

test('the director keeps a reading with why it changed, and TREE drafts the new one from the evidence', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString(); asked.push(body);
    const text = /write a new \\"What may lie underneath\\"/.test(body) ? 'Perhaps children are testing which things float and which sink.' : '{}';
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('[data-prev="underneath"]', { timeout: 15000, state: 'attached' });
  await s.p.evaluate(() => { const b = document.querySelector('[data-unlock]'); if (b) b.click(); document.querySelectorAll('#main details').forEach(d => { d.open = true; }); });
  // keeping asks why first
  await s.p.click('[data-prev="underneath"]'); await s.p.waitForSelector('#pkw-underneath');
  await s.p.click('[data-pkeepgo="underneath|draft"]');
  assert.strictEqual(await s.p.evaluate(() => projUnder(projects.get('x1'))), 'It may be that children are investigating how water moves.', 'nothing kept without a reason');
  await s.p.fill('#pkw-underneath', 'They test what floats more than where the water goes.');
  await s.p.click('[data-pkeepgo="underneath|draft"]');
  await s.p.waitForSelector('text=Drafted by TREE from the evidence', { timeout: 15000 });
  const q = asked.find(b => /What may lie underneath/.test(b) && /write a new/.test(b));
  assert.ok(q, 'TREE was asked'); assert.match(q, /float away first/); assert.match(q, /They test what floats/); assert.match(q, /investigating how water moves/);
  assert.strictEqual(await s.p.evaluate(() => projUnder(projects.get('x1'))), '', 'nothing goes in until Use this');
  await s.p.click('[data-pstryes="underneath"]'); await s.p.waitForTimeout(400);
  assert.strictEqual(await s.p.evaluate(() => projUnder(projects.get('x1'))), 'Perhaps children are testing which things float and which sink.');
  await s.p.evaluate(() => document.querySelectorAll('#main details').forEach(d => { d.open = true; }));
  assert.match(await s.p.innerText('#main'), /What changed our thinking\. They test what floats more than where the water goes\./);
  assert.deepStrictEqual(s.errors, []);
  await new Promise(r => setTimeout(r, 2500));
  const x = JSON.parse(fs.readFileSync(path.join(fx.dir, 'projects/x1.json'), 'utf8'));
  assert.deepStrictEqual([x.earlier.underneath.map(e => [e.text, e.by, e.why]), x.underneath], [[['It may be that children are investigating how water moves.', 'Dee', 'They test what floats more than where the water goes.']], 'Perhaps children are testing which things float and which sink.']);
});

test('an empty intent offers Draft from the evidence', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({ more: put => { more(put); put('projects/x1.json', { id: 'x1', name: 'Creek walks', underneath: 'Perhaps water.', intent: '', home: 'West', status: 'active', createdAt: Date.now() - 20 * day, classrooms: [{ room: 'West' }], threads: [] }); } }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => openProject('x1')); await s.p.waitForSelector('[data-pdraft="intent"]', { timeout: 15000, state: 'attached' });
  assert.strictEqual(await s.p.$('[data-pdraft="underneath"]'), null, 'a part with words offers Strengthen wording');
  assert.deepStrictEqual(s.errors, []);
});
