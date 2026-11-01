'use strict';
// The director's own photo on an artist card, and the image a card shows from another site, read through our server
// only from the card's own Shown from line (November 1, 2026). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { loaded, call } = require('./harness.js');

test('only the director adds or takes out a card photo, and only a kept artist photo', async () => {
  const h = await loaded([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }]);
  assert.strictEqual((await call(h.staff, 'Ann', 'library/artphoto', { card: 'a-painter', photo: 'abcdefabcdef-artist-photo.jpg' })).status, 403);
  assert.strictEqual((await call(h.staff, 'Dir', 'library/artphoto', { card: 'a-painter', photo: 'abcdefabcdef-recipe-picture.jpg' })).status, 400);
  assert.strictEqual((await call(h.staff, 'Dir', 'library/artphoto', { card: '../x', photo: 'abcdefabcdef-artist-photo.jpg' })).status, 400);
  const r = await call(h.staff, 'Dir', 'library/artphoto', { card: 'a-painter', photo: 'abcdefabcdef-artist-photo.jpg', w: 800, h: 600 });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.artPhotos['a-painter'].id, 'abcdefabcdef-artist-photo.jpg');
  const a = await call(h.staff, 'Ann', 'library', {}); assert.strictEqual(a.body.artPhotos['a-painter'].w, 800, 'every educator sees the photo on the card');
  const g = await call(h.staff, 'Dir', 'library/artphoto', { card: 'a-painter', remove: true });
  assert.deepStrictEqual(g.body.artPhotos, {});
});

test('a card with no Shown from line has no image to read from another site', async () => {
  const h = await loaded([{ name: 'Dir', director: true }, { name: 'Ann', room: 'West' }]);
  assert.strictEqual((await call(h.staff, 'Ann', 'library/artshown', { card: 'nobody-here' })).status, 404);
});
