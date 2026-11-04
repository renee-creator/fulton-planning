'use strict';
// The staff room display asks for each photo through /photo/<id>?w=1920, sized for the screen, and falls back to the
// original when that address answers with an error. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser } = require('./fixture.js');

test('the display loads photos resized for the screen and falls back to the original on error', async t => {
  const at = Date.now() - 3600e3;
  const fx = await start({ more: put => {
    for (let i = 0; i < 3; i++) put(`notices/m${i}.json`, { id: 'm' + i, at: at - i * 1000, classroom: ['West', 'North', 'South'][i], noticed: 'Moment ' + i, photo: { id: 'p-m' + i, w: 800, h: 600 } });
  } });
  t.after(() => fx.stop());
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(() => b.close());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  await fx.as(dee, '/api/display', { action: 'new' });
  const key = (await fx.as(dee, '/api/display', {})).body.key;
  const feed = (await fx.as('', '/display/feed', { key })).body;
  assert.ok(feed.moments.length >= 3 && feed.moments.every(m => /^\/original\//.test(m.photo.src)), 'the feed still gives the original address');
  const api = fx.page.split('server=')[1];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); t.after(() => ctx.close());
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const asked = [];
  // a one-pixel picture for the resized address of the first photo, an error for the second, so it falls back
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await p.route(api + '/photo/**', async route => { const u = new URL(route.request().url()); asked.push(u.pathname + u.search);
    if (/p-m1/.test(u.pathname)) await route.fulfill({ status: 500, body: 'no' }); else await route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await p.route(api + '/original/**', async route => { const u = new URL(route.request().url()); asked.push(u.pathname); await route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await p.goto(fx.page.replace(/tree\.html.*$/, 'display.html?server=' + api + '#k=' + key + '&preview=1'));
  await p.waitForFunction(() => document.querySelectorAll('.slide').length > 0, null, { timeout: 15000 });
  // let the first slide show and the next be fetched ahead
  await p.waitForTimeout(2500);
  const big = asked.filter(x => /^\/photo\//.test(x));
  assert.ok(big.length >= 1, 'photos are asked for through /photo/');
  assert.ok(big.every(x => /\?w=1920&t=/.test(x)), 'each sized to 1920 with the photo\'s key kept, ' + big.join(' '));
  assert.ok(!asked.some(x => /^\/original\/p-m0/.test(x)), 'the first photo never needed its original');
  // the second photo's resized address failed, so its original was asked for
  await p.waitForFunction(() => [...document.querySelectorAll('img')].some(i => i.dataset.fell === '1' && /\/original\//.test(i.src)) || [...document.querySelectorAll('.slide')].length > 1, null, { timeout: 25000 }).catch(() => {});
  const fell = await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.dataset.fell).map(i => i.src));
  assert.ok(asked.some(x => /^\/original\/p-m1/.test(x)) || fell.some(s => /p-m1/.test(s)), 'the original stands in for the second photo, asked ' + asked.join(' '));
  assert.deepStrictEqual(errors, []);
});
