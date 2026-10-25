'use strict';
// The site map, one map with the same space names on sign-ups, plans, New Educator, the Family page and handouts. It
// stays on the Garden page until the director marks it ready, and it carries only the map photo, the spaces and their
// names. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { start, browser } = require('./fixture.js');

const SETUP = { id: 'garden', ready: true, beds: [], plants: [], animals: [], plan: { months: {} }, tending: {}, agreements: {}, mapPhoto: 'abc123abc123-garden-map.jpg', mapSpots: { garden: { x: 0.25, y: 0.4 } } };

test('the site map waits for the director, then every page reads the same map', async t => {
  const fx = await start({ more: put => {
    put('staff/garden/setup.json', SETUP); put('staff/garden/log.json', { id: 'gardenlog' });
    put('calendar/settings/program.json', { calendars: [], spaces: [{ id: 'garden', name: 'The garden' }, { id: 'piazza', name: 'The piazza' }, { id: 'old', name: 'Old room', hidden: true }], dayStart: 420, dayEnd: 1080, weekends: false });
  } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const M = tok => fx.as(tok, '/api/staff/sitemap', {});
  let r = await M(dee); assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.map, { ready: false, photo: 'abc123abc123-garden-map.jpg', spots: [{ id: 'garden', name: 'The garden', x: 0.25, y: 0.4 }, { id: 'piazza', name: 'The piazza' }] });
  assert.strictEqual((await M(ann)).body.map, null, 'an educator sees nothing until it is ready');
  await fx.as(dee, '/api/staff/garden/mapready', { on: true });
  r = await M(ann); assert.strictEqual(r.body.map.ready, true); assert.deepStrictEqual(r.body.map.spots.map(s => s.name), ['The garden', 'The piazza']);
  // the Family page reads the same map, through the signed photo link and never a child's photo or name
  const fam = fs.readFileSync(path.join(__dirname, '..', 'family.js'), 'utf8');
  assert.match(fam, /mapInfo = \{ src: photoSrc\(m\.photo\), spots: m\.spots \}/);
});

test('the map zooms, keeps its names readable and chooses a space', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const b = await chromium.launch(); t.after(() => b.close());
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.setContent('<div id="m"></div>'); await p.addScriptTag({ path: path.join(__dirname, '..', 'sitemap.js') });
  const img = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#9c9"/></svg>');
  await p.evaluate(src => { window.picked = ''; window.SiteMap.mount(document.getElementById('m'), { src, spots: [{ id: 'garden', name: 'The garden', x: 0.25, y: 0.4 }, { id: 'piazza', name: 'The piazza' }] }, { onPick: id => { window.picked = id; } }); }, img);
  await p.waitForTimeout(300);
  const w0 = await p.evaluate(() => document.querySelector('.smap-spot').getBoundingClientRect().width);
  await p.click('[data-z="1"]'); await p.click('[data-z="1"]'); await p.waitForTimeout(100);
  const w1 = await p.evaluate(() => document.querySelector('.smap-spot').getBoundingClientRect().width);
  assert.ok(Math.abs(w1 - w0) < 2, 'a space name keeps its size when the map zooms in');
  assert.match(await p.evaluate(() => document.querySelector('.smap-in').style.transform), /scale\(2\.5/);
  await p.click('.smap-list [data-spot="piazza"]'); assert.strictEqual(await p.evaluate(() => window.picked), 'piazza', 'a space without a place on the map is still chosen from the list');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scrolling on a phone');
});
