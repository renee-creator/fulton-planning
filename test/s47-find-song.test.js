'use strict';
// Find the song drafts a new song from its title. The words come only for a traditional song, a © song leaves them for
// the director, and nothing saves until she adds it. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start, browser, signedIn } = require('./fixture.js');

async function setup(t) {
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString();
    const trad = /A Made Up Round/.test(body);
    const text = JSON.stringify(trad ? { title: 'A Made Up Round', songwriter: 'Traditional', copyright: false, words: 'Line one\nLine two', why: 'It is a round.', when: 'At meeting time.', movement: '', wonder: 'What do you hear?', connections: 'Birds' }
      : { title: 'A Newer Song', songwriter: 'A Writer', copyright: true, words: 'Should not appear', why: 'It moves.', when: 'After snack.', movement: 'March.', wonder: 'Where are we going?', connections: 'Wheels' });
    r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const fx = await start({ env: { ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port } }); t.after(() => fx.stop());
  return fx;
}

test('Find the song fills in a new song, with words only for a traditional one', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await setup(t);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('songs')); await s.p.waitForSelector('[data-songadd="1"]', { timeout: 15000 });
  await s.p.click('[data-songadd="1"]'); await s.p.fill('#sg-t', 'a newer song'); await s.p.click('[data-songfind]');
  await s.p.waitForSelector('#sg-why', { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#sg-w'), 'A Writer'); assert.ok(await s.p.isChecked('#sg-c'));
  assert.strictEqual(await s.p.inputValue('#sg-words'), '', 'a © song leaves the words for the director');
  await s.p.fill('#sg-t', 'A Made Up Round'); await s.p.click('[data-songfind]');
  await s.p.waitForFunction(() => document.getElementById('sg-w') && document.getElementById('sg-w').value === 'Traditional', null, { timeout: 15000 });
  assert.ok(!(await s.p.isChecked('#sg-c'))); assert.strictEqual(await s.p.inputValue('#sg-words'), 'Line one\nLine two');
  await s.p.click('[data-songsave]'); await s.p.waitForFunction(() => (libData.songs || []).some(x => x.title === 'A Made Up Round'), null, { timeout: 15000 });
  const song = await s.p.evaluate(() => { const x = libData.songs.find(x => x.title === 'A Made Up Round'); return { parts: x.parts.map(p => p.key), words: songWords(x), meta: x.meta }; });
  assert.deepStrictEqual(song.parts, ['Why we sing it', 'When we sing it', 'I wonder', 'Connections', 'Words']);
  assert.strictEqual(song.words.trim(), 'Line one\nLine two'); assert.strictEqual(song.meta.copyright, 'no'); assert.strictEqual(song.meta.songwriter, 'Traditional');
  assert.deepStrictEqual(s.errors, []);
});
