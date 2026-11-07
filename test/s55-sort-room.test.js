'use strict';
/* The nightly sort pass gives the quick model room to think before its short answer, so an answer is not cut off before
   the JSON. An observation whose answer cannot be read twice is left as it is, so the same ones are not asked every night.
   Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path');
const { start } = require('./fixture.js');

const day = 864e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await wait(200); } return false; }

test('the night reads the sort with enough room, and gives up on an unreadable answer after two tries', async t => {
  // the fake model thinks first, so with little room its answer is cut off. The observation that names Odd always gets an answer that cannot be read.
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = JSON.parse(Buffer.concat(c).toString());
    const prompt = (((body.messages || [])[0] || {}).content || [{}])[0].text || '';
    let out = { content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' };
    if (/box What I noticed/.test(prompt)) {
      asked.push({ odd: /Odd/.test(prompt), max: body.max_tokens });
      if (/Odd/.test(prompt)) out = { content: [{ type: 'text', text: 'Thinking about it' }], stop_reason: 'end_turn' };
      else if (body.max_tokens < 1000) out = { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: '{"wonder":[' }], stop_reason: 'max_tokens' };
      else out = { content: [{ type: 'text', text: JSON.stringify({ wonder: [2], why: 'The second sentence wonders why.' }) }], stop_reason: 'end_turn' };
    }
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(out)); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const more = put => {
    put('notices/sr1.json', { id: 'sr1', noticed: 'Leo stacked three blocks on the stump. Perhaps he is testing how high they balance.', wonder: '', at: Date.now() - 9 * day, classroom: 'West', by: 'Ann' });
    put('notices/sr2.json', { id: 'sr2', noticed: 'Odd carried the bucket to the sand. Maybe the sand needed water.', wonder: '', at: Date.now() - 10 * day, classroom: 'West', by: 'Ann' });
  };
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port, SORT_DELAY_MS: '300', SUGGEST_DELAY_MS: '600' }, more }); t.after(() => fx.stop());
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  await until(() => fs.existsSync(path.join(fx.dir, 'settings/once.json')), 20000);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;

  // the first night, the readable answer comes through whole and is offered, and the unreadable one is tried once
  let r = (await fx.as(dee, '/api/nightly', {})).body; assert.ok(r.ok, JSON.stringify(r));
  assert.ok(asked.every(a => a.max >= 1000), 'the sort asks with room for thinking and the answer');
  assert.deepStrictEqual([r.sort.looked, r.sort.offered, r.sort.failed, r.sort.given], [2, 1, 1, 0]);
  assert.ok(await until(() => read('notices/sr1.json') && read('notices/sr1.json').sortOffer, 10000), 'the readable answer is offered');
  // the second night it is tried once more and given up on, and the third night it is not asked at all
  r = (await fx.as(dee, '/api/nightly', {})).body;
  assert.deepStrictEqual([r.sort.looked, r.sort.failed, r.sort.given], [1, 1, 1]);
  assert.ok(await until(() => read('notices/sr2.json') && read('notices/sr2.json').sortChecked, 10000), 'given up after two tries');
  const before = asked.filter(a => a.odd).length;
  r = (await fx.as(dee, '/api/nightly', {})).body;
  assert.strictEqual(r.sort.looked, 0); assert.strictEqual(asked.filter(a => a.odd).length, before, 'not asked again');
  assert.strictEqual(read('notices/sr2.json').noticed.startsWith('Odd carried'), true, 'the words never change');
});
