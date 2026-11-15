'use strict';
// Email to families from the newsletter and the mid-month note. In test mode only the testers get it, otherwise every
// parent address once, or one class. The mid-month note carries books to share with library and Bookshop.org links,
// and the director sees a preview before it is sent. Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const { start, browser, signedIn } = require('./fixture.js');

const kids = put => {
  put('children/k1.json', { first: 'Wren', last: 'Hale', classroom: 'North', status: 'active', parents: [{ name: 'Ada', email: 'ada@example.test' }, { name: 'Bo', email: 'bo@example.test' }] });
  put('children/k2.json', { first: 'Lark', last: 'One', classroom: 'West', status: 'active', parents: [{ name: 'Ada', email: 'ADA@example.test' }, { name: 'Cy', email: 'cy@example.test' }] });
  put('children/k3.json', { first: 'Moss', last: 'Gone', classroom: 'West', status: 'withdrawn', parents: [{ name: 'Di', email: 'di@example.test' }] });
  put('staff/library/books/goats-in-the-hay.md', '<!--\nlibrary: book\nauthor: Plum, Ada\nisbn: 9780000000002\nowned: no\n-->\n# Goats in the Hay\n\n## Why we chose it\n\nGoats eat hay and climb on everything. A second sentence. A third one.\n\n## Reading guide\n\n- I notice the goats\n- I wonder where the goats sleep\n');
};
async function setup(t, testMode) {
  const drive = await require('./mock-drive.js').start(); t.after(() => drive.close());
  const fx = await start({ env: { DRIVE_PHOTOS_URL: drive.url, KAYMBU_INBOX_KEY: drive.key, BOOK_CATALOG_TEST_BASE: 'http://127.0.0.1:9' }, more: put => { kids(put);
    put('participation/config.json', { id: 'config', test: testMode, testers: [{ email: 'pip.family@example.test', children: ['k1'] }] }); } });
  t.after(() => fx.stop());
  return { fx, drive };
}

test('In test mode only the testers get the email, and only the director sends it', async t => {
  const { fx, drive } = await setup(t, true);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.strictEqual((await fx.as(ann, '/api/staff/newsletter/recipients', {})).status, 403);
  const r = await fx.as(dee, '/api/staff/newsletter/recipients', {});
  assert.deepStrictEqual([r.body.test, r.body.count], [true, 1]);
  const s = await fx.as(dee, '/api/staff/newsletter/send', { subject: 'Our note', html: '<p>Hello</p>', text: 'Hello', replyTo: 'dee@example.test' });
  assert.strictEqual(s.status, 200); assert.deepStrictEqual([s.body.sent, s.body.test], [1, true]);
  assert.deepStrictEqual(drive.mails.map(m => m.to), ['pip.family@example.test']);
  assert.strictEqual(drive.mails[0].replyTo, 'dee@example.test'); assert.strictEqual(drive.mails[0].name, 'Fulton Community School');
});

test('Once the Family page is open, every parent address gets one email, or one class', async t => {
  const { fx, drive } = await setup(t, false);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  assert.strictEqual((await fx.as(dee, '/api/staff/newsletter/recipients', {})).body.count, 3, 'each address once, and a child who left is left out');
  assert.strictEqual((await fx.as(dee, '/api/staff/newsletter/recipients', { classroom: 'North' })).body.count, 2);
  const img = Buffer.from('a small picture').toString('base64');
  const s = await fx.as(dee, '/api/staff/newsletter/send', { classroom: 'West', subject: 'West news', html: '<img src="cid:p1">', text: 'x', images: [{ cid: 'p1', data: img }] });
  assert.strictEqual(s.body.sent, 2);
  assert.deepStrictEqual(drive.mails.map(m => m.to).sort(), ['ada@example.test', 'cy@example.test']);
  assert.ok(drive.mails.every(m => m.images.includes('p1')));
  assert.strictEqual((await fx.as(dee, '/api/staff/newsletter/send', { subject: '', html: '<p>x</p>' })).status, 400);
});

test('The mid-month note carries books with library and bookshop links, previewed before it goes', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const { fx, drive } = await setup(t, true);
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  s.p.on('dialog', d => d.accept());
  await s.p.evaluate(() => { nlMode = 'mid'; goView('newsletter'); });
  await s.p.waitForSelector('[data-nlstartmid]', { timeout: 15000 }); await s.p.click('[data-nlstartmid]');
  await s.p.waitForSelector('#nlbk option[value="staff/library/books/goats-in-the-hay.md"]', { timeout: 15000, state: 'attached' });
  assert.strictEqual(await s.p.$$eval('[data-nlfind]', xs => xs.length), 0, 'the note has no topics step');
  await s.p.selectOption('#nlbk', 'staff/library/books/goats-in-the-hay.md'); await s.p.click('[data-nlbookadd]');
  await s.p.waitForSelector('[data-nlf="books.0.why"]', { timeout: 15000 });
  assert.strictEqual(await s.p.inputValue('[data-nlf="books.0.why"]'), 'Goats eat hay and climb on everything. A second sentence.');
  assert.strictEqual(await s.p.inputValue('[data-nlf="books.0.wonder"]'), 'I wonder where the goats sleep');
  await s.p.click('[data-nlmopen]'); await s.p.click('[data-nlmprev]');
  await s.p.waitForSelector('iframe[title="Preview of the email"]', { timeout: 20000 });
  const html = await s.p.$eval('iframe[title="Preview of the email"]', f => f.srcdoc);
  assert.match(html, /Mid-month note, /); assert.match(html, /Goats in the Hay/); assert.match(html, /Ada Plum/);
  assert.match(html, /bookshop\.org\/a\/131071\/9780000000002/); assert.match(html, /sonoma\.bibliocommons\.com/);
  assert.match(await s.p.textContent('#main'), /test mode, so this goes only to your 1 tester/);
  await s.p.click('[data-nlmsend]');
  await s.p.waitForFunction(() => [...newsletters.values()].some(x => x.kind === 'mid' && (x.emails || []).length === 1), null, { timeout: 20000 });
  assert.strictEqual(drive.mails.length, 1); assert.match(drive.mails[0].subject, /mid-/);
  assert.match(await s.p.textContent('#main'), /Test email .* to 1 tester/);
  assert.deepStrictEqual(s.errors, []);
});
