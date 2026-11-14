'use strict';
// November 14, 2026. A clip kept as an observation takes its turn on the staff room display. It plays in a video element,
// silent, with what was noticed beneath, and the screen moves on when the clip ends or will not play. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser } = require('./fixture.js');

test('the staff room display plays a clip and moves on when it ends', async t => {
  const at = Date.now() - 3600e3;
  const fx = await start({ more: put => {
    put('settings/program.json', { id: 'program', videoClipsOn: true });
    put('clips/vclip01.json', { id: 'vclip01', fileId: 'abcdefghij0123456789', name: 'West clip.mp4', mimeType: 'video/mp4', status: 'done', at });
    put('notices/c1.json', { id: 'c1', at, classroom: 'West', by: 'Ann', noticed: 'A child pours water. "A mixer!"', wonder: '', children: [], clip: { id: 'vclip01', fileId: 'abcdefghij0123456789', name: 'West clip.mp4', seconds: 12 } });
  } });
  t.after(() => fx.stop());
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(() => b.close());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  await fx.as(dee, '/api/display', { action: 'new' });
  const key = (await fx.as(dee, '/api/display', {})).body.key;
  const feed = (await fx.as('', '/display/feed', { key })).body;
  assert.strictEqual(feed.clips.length, 1); assert.match(feed.clips[0].src, /^\/clip\/vclip01\?t=/); assert.strictEqual(feed.clips[0].sound, false);
  assert.ok(!feed.words.some(w => w.id === 'c1'), 'a clip never shows as words alone');
  const api = fx.page.split('server=')[1];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); t.after(() => ctx.close());
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  // the clip cannot be fetched here, so the video reports an error and the screen gives way
  await p.route(api + '/clip/**', route => route.fulfill({ status: 404, body: 'no' }));
  await p.goto(fx.page.replace(/tree\.html.*$/, 'display.html?server=' + api + '#k=' + key + '&preview=1'));
  await p.waitForSelector('.slide video', { timeout: 15000 });
  const v = await p.$eval('.slide video', el => ({ muted: el.muted, src: el.getAttribute('src'), text: el.closest('.slide').innerText }));
  assert.strictEqual(v.muted, true); assert.match(v.src, /\/clip\/vclip01\?t=/); assert.match(v.text, /A child pours water/);
  // the clip's slide gives way to the next one well before its full time is up
  await p.evaluate(() => { const el = document.querySelector('.slide video'); el.dataset.first = '1'; });
  await p.waitForFunction(() => !document.querySelector('.slide video[data-first]'), null, { timeout: 20000 });
  assert.deepStrictEqual(errors, []);
});
