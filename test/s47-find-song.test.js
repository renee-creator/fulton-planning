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
    if (/Give its usual words only/.test(body)) { const text = JSON.stringify(/Una Canción/.test(body) ? { words: 'Línea uno', english: 'Line one', language: 'Spanish', free: true } : { words: '', english: '', free: false }); r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })); return; }
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

test('Look up the words fills a traditional song for the director to check, with its English, and offers a search for any other', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await setup(t);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  await fx.as(dee, '/api/staff/library/add', { kind: 'song', title: 'Una Canción', songwriter: 'Traditional', copyright: false });
  await fx.as(dee, '/api/staff/library/add', { kind: 'song', title: 'A Later Song', songwriter: 'Traditional', copyright: false });
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('songs')); await s.p.waitForSelector('[data-songlook]', { timeout: 15000, state: 'attached' });
  const id = await s.p.evaluate(() => libData.songs.find(x => x.title === 'Una Canción').id);
  await s.p.evaluate(id => { const d = document.querySelector(`[data-songrow="${id}"]`); d.open = true; d.querySelector('[data-songlook]').click(); }, id);
  await s.p.waitForSelector('#sl-w', { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('#sl-w'), 'Línea uno'); assert.strictEqual(await s.p.inputValue('#sl-e'), 'Line one');
  await s.p.click('[data-songlooksave]'); await s.p.waitForFunction(() => { const x = libData.songs.find(x => x.title === 'Una Canción'); return x && songWords(x); }, null, { timeout: 15000 });
  const parts = await s.p.evaluate(() => libData.songs.find(x => x.title === 'Una Canción').parts.map(p => p.key)); assert.deepStrictEqual(parts, ['Words', 'In English']);
  assert.strictEqual(await s.p.evaluate(() => libData.songs.find(x => x.title === 'Una Canción').meta.language), 'Spanish');
  await s.p.waitForSelector('[data-songlang="Spanish"]', { timeout: 15000 }); await s.p.click('[data-songlang="Spanish"]');
  const rows = await s.p.$$eval('[data-songrow]', xs => xs.length); assert.strictEqual(rows, 1, 'the Spanish filter shows the Spanish song');
  const doc = await s.p.evaluate(() => songDoc(libData.songs.find(x => x.title === 'Una Canción')).blocks.map(b => b.label || ''));
  assert.deepStrictEqual(doc.slice(0, 2), ['Spanish', 'In English']);
  await s.p.click('[data-songlang="All"]');
  const id2 = await s.p.evaluate(() => libData.songs.find(x => x.title === 'A Later Song').id);
  await s.p.evaluate(id => { const d = document.querySelector(`[data-songrow="${id}"]`); d.open = true; d.querySelector('[data-songlook]').click(); }, id2);
  await s.p.waitForSelector('text=Search for the words', { timeout: 15000 });
  assert.match(await s.p.getAttribute('a:has-text("Search for the words")', 'href'), /google\.com\/search\?q=A%20Later%20Song%20song%20lyrics/);
  assert.deepStrictEqual(s.errors, []);
});
