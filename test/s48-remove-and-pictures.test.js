'use strict';
// The director removes a card that no longer fits, and it leaves TREE for everyone until she puts it back. Pictures for
// the demonstration sheets can come from Wikimedia Commons with their credit, and the items the recipes name read as
// clean names. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

test('remove and put back a recipe, and a picture from the web', async t => {
  const fx = await start(); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const L = async tok => (await fx.as(tok, '/api/staff/library', {})).body;
  let d = (await fx.as(dee, '/api/staff/library/add', { kind: 'recipe', title: 'A Test Soup', ingredients: '2 pounds carrots\n1 handful parsley', tools: 'two soup pots\nchild knives and a knife adult', steps: 'Wash the carrots.' })).body;
  const r = d.recipes.find(x => x.title === 'A Test Soup'); assert.ok(r);
  assert.strictEqual((await fx.as(ann, '/api/staff/library/remove', { path: r.path })).status, 403, 'only the director');
  d = (await fx.as(dee, '/api/staff/library/remove', { path: r.path, on: true })).body;
  assert.ok(!d.recipes.some(x => x.title === 'A Test Soup')); assert.ok(d.removed.recipe.some(x => x.title === 'A Test Soup'));
  const a = await L(ann); assert.ok(!a.recipes.some(x => x.title === 'A Test Soup')); assert.strictEqual(a.removed, null);
  d = (await fx.as(dee, '/api/staff/library/remove', { path: r.path, on: false })).body;
  assert.ok(d.recipes.some(x => x.title === 'A Test Soup')); assert.strictEqual(d.removed.recipe.length, 0);
  // a picture from the web, only from Wikimedia Commons and only by the director
  assert.strictEqual((await fx.as(dee, '/api/staff/library/picture', { key: 'carrot', url: 'https://example.test/carrot.jpg' })).status, 400);
  assert.strictEqual((await fx.as(ann, '/api/staff/library/picture', { key: 'carrot', url: 'https://upload.wikimedia.org/a/carrot.jpg' })).status, 403);
  d = (await fx.as(dee, '/api/staff/library/picture', { key: 'carrot', url: 'https://upload.wikimedia.org/a/carrot.jpg', credit: 'Photo by A. Grower, CC BY 4.0', link: 'https://commons.wikimedia.org/wiki/File:Carrot.jpg' })).body;
  assert.deepStrictEqual(d.pictures.carrot, { from: 'web', url: 'https://upload.wikimedia.org/a/carrot.jpg', credit: 'Photo by A. Grower, CC BY 4.0', link: 'https://commons.wikimedia.org/wiki/File:Carrot.jpg' });
  d = (await fx.as(dee, '/api/staff/library/picture', { key: 'carrot', remove: true })).body; assert.ok(!d.pictures.carrot);

  const b = await browser(); if (!b) return;
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  const keys = await s.p.evaluate(() => ['2 pounds carrots', '1 handful parsley', 'two soup pots', 'child knives and a knife adult', 'pound fava pods each child', 'heads of broccoli', 'soup pot with a lid', 'butter or romaine lettuce leaf each child', 'salt and black pepper', 'measuring cups and spoon'].map(demoKey));
  assert.deepStrictEqual(keys, ['carrot', 'parsley', 'soup_pot', 'child_knife', 'fava_pod', 'broccoli', 'soup_pot', 'butter', 'salt_and_black_pepper', 'measuring_cup_and_spoon']);
  await s.p.evaluate(() => goView('recipes')); await s.p.waitForSelector('text=A Test Soup', { timeout: 15000 });
  await s.p.evaluate(() => { const d = [...document.querySelectorAll('details')].find(x => /A Test Soup/.test(x.querySelector('summary') && x.querySelector('summary').textContent || '')); if (d) d.open = true; });
  await s.p.evaluate(() => document.querySelector('[data-libremoveask]').click()); await s.p.waitForSelector('text=It goes to Removed, where you can put it back.');
  await s.p.evaluate(() => document.querySelector('[data-libremove$="|1"]').click()); await s.p.waitForSelector('text=Removed, 1', { timeout: 10000 });
  assert.deepStrictEqual(s.errors, []);
});
