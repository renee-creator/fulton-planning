'use strict';
// Cutting repeat API use (November 17, 2026). The DRDP wording goes first in a DRDP reading, marked for the prompt cache,
// and the nightly passes wait until the records have been read again after a start. Made-up wording only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start } = require('./fixture.js');

const WORDING = { ptk: { 'ATL 1': { def: 'A made-up definition.', levels: { 'Exploring Later': 'A made-up level.' } } }, it: { 'ATL 1': { def: 'A made-up definition.', levels: {} } } };

test('a DRDP reading sends the official wording first, marked for the prompt cache, then the photo and the rest', async t => {
  const asked = [];
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { asked.push(JSON.parse(Buffer.concat(c).toString()));
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ model: 'm', content: [{ type: 'text', text: '{"measures":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 900 } })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port }, more: put => put('drdp/descriptors.json', WORDING) });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const img = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('x').toString('base64') } };
  const r = await fx.as(dee, '/api/read', { content: [img, { type: 'text', text: 'Read this DRDP view.\n\n[[DRDP_DESCRIPTORS]]\n\nMeasures to consider. ATL 1' }], careful: true, purpose: 'drdp', drdp: { view: 'ptk', codes: ['ATL 1'] } });
  assert.strictEqual(r.status, 200);
  const sent = asked[asked.length - 1].messages[0].content;
  assert.strictEqual(sent[0].type, 'text');
  assert.deepStrictEqual(sent[0].cache_control, { type: 'ephemeral' });
  assert.match(sent[0].text, /^Read this DRDP view\.[\s\S]*A made-up definition\.[\s\S]*A made-up level\./);
  assert.strictEqual(sent[1].type, 'image', 'the photo follows the wording');
  assert.strictEqual(sent[2].text, 'Measures to consider. ATL 1');
  assert.ok(!JSON.stringify(sent).includes('[[DRDP_DESCRIPTORS]]'));
  assert.ok(!('cache_control' in sent[2]));
});

test('the careful lane stays on Sonnet with no end date', async t => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(!/SAVE_UNTIL/.test(src), 'no date switches the careful lane back by itself');
  assert.match(src, /CAREFUL_USE_OPUS/);
});

test('the nightly passes wait until the records have been read again after a start', async t => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  const due = src.slice(src.indexOf('function nightlyDue'), src.indexOf('function nightlyDue') + 700);
  assert.match(due, /if \(!store\.settledAt\) return false;/);
  assert.match(src, /saveLensPassages\(Object\.assign\(\{\}, next\)\); flushPath\('lens\/passages\.json'\)/, 'the lens pass saves each batch as it goes');
  assert.match(src, /flushPath\('settings\/nightly\.json'\)/, 'the night is marked done on GitHub right away');
});
