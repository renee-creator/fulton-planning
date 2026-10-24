'use strict';
// Faces in Presenting. Anything people take away is made with children's faces softened by the same check Share uses,
// and when faces cannot be checked on the device, the photos are left out. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const PHOTO = fs.readFileSync(path.join(__dirname, '..', 'post_photo.jpg')).toString('base64');

test('takeaway files soften faces, or leave photos out', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const fx = await start(); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); });
  const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280);
  const run = found => s.p.evaluate(async ([data, found]) => {
    const url = 'data:image/jpeg;base64,' + data;
    photoCache.set('pr:x', { url, bytes: new ArrayBuffer(8), w: 1080, h: 720 });
    const docs = [{ title: 'Panel', photos: [{ key: 'pr:x', src: 'x', w: 1080, h: 720 }], blocks: [{ t: 'photo', key: 'pr:x', src: 'x' }, { t: 'para', text: 'Words' }] }];
    if (found === 'fail') window.shFaceModel = async () => { throw new Error('no model'); };
    else { window.shFaceModel = async () => ({}); window.shFindFaces = async () => found; }
    const ok = await softenDocPhotos(docs);
    const soft = photoCache.get('soft:pr:x');
    return { ok, photos: docs[0].photos.map(x => x.key), blocks: docs[0].blocks.map(x => x.key || x.t), changed: !!soft && soft.url !== url };
  }, [PHOTO, found]);
  const one = await run([{ x: 0.5, y: 0.4, r: 0.12 }]);
  assert.strictEqual(one.ok, true); assert.deepStrictEqual(one.photos, ['soft:pr:x']); assert.deepStrictEqual(one.blocks, ['soft:pr:x', 'para']);
  assert.strictEqual(one.changed, true, 'the softened photo differs from the one loaded');
  const none = await run('fail');
  assert.strictEqual(none.ok, false); assert.deepStrictEqual(none.photos, []); assert.deepStrictEqual(none.blocks, ['para']);
  // the Presenting prints always pass through it, and only the slide set to show keeps faces
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'presenting-app.js'), 'utf8');
  assert.match(src, /if\(!\(toShow&&k==="slides"&&!word\)\)await softenDocPhotos\(docs\)/);
  await s.close();
});
