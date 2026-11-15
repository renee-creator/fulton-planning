'use strict';
/* The sorts asked after a save or an import use at most their share of the hourly allowance. When the share is used, the
   queue waits for room and goes on, so every observation is offered its sort in the end and none is dropped (program
   watch, issue 39). The hour is made six seconds long here. Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await wait(200); } return false; }

test('a burst of saves past the sorts\' share waits for room, and every one is offered its sort', async t => {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = JSON.parse(Buffer.concat(c).toString());
    const prompt = (((body.messages || [])[0] || {}).content || [{}])[0].text || '';
    let out = { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' };
    if (/box What I noticed/.test(prompt)) { asked.push(Date.now()); out = { content: [{ type: 'text', text: JSON.stringify({ wonder: [2], why: 'The second sentence wonders.' }) }], stop_reason: 'end_turn' }; }
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(out)); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port,
    SORT_DELAY_MS: '200', SUGGEST_DELAY_MS: '600000', SUGGEST_PER_HOUR: '4', SORT_SHARE: '0.5', SUGGEST_WINDOW_MS: '6000' } });
  t.after(() => fx.stop());
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  await until(() => fs.existsSync(path.join(fx.dir, 'settings/once.json')), 20000);
  const ann = (await fx.login('Ann', '1357')).token;
  const ids = ['sw1', 'sw2', 'sw3', 'sw4', 'sw5'];
  for (const id of ids) {
    const w = await fx.as(ann, '/api/write', { op: 'set', kind: 'notices', id, data: { id, noticed: 'Wren poured water over the stones. Maybe she wants to see them change color.', wonder: '', classroom: 'West', by: 'Ann', at: Date.now(), children: [] } });
    assert.strictEqual(w.status, 200);
  }
  assert.ok(await until(() => ids.every(id => { const d = read(`notices/${id}.json`); return d && d.sortOffer; }), 40000), 'every observation is offered its sort');
  assert.strictEqual(asked.length, 5, 'each asked once');
  // never more than the sorts' share, two, inside any six seconds
  for (const a of asked) assert.ok(asked.filter(b => b >= a && b - a < 6000).length <= 2, 'the share was kept');
});
