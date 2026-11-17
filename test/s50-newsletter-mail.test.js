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
  put('notices/m1.json', { id: 'm1', at: Date.now() - 3600e3, classroom: 'North', noticed: 'The goats climbed the hay.', photo: { id: 'p-m1', w: 800, h: 600 } });
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

test('With Email families on, every parent gets the email while the Family page stays in test mode', async t => {
  const drive = await require('./mock-drive.js').start(); t.after(() => drive.close());
  const fx = await start({ env: { DRIVE_PHOTOS_URL: drive.url, KAYMBU_INBOX_KEY: drive.key, BOOK_CATALOG_TEST_BASE: 'http://127.0.0.1:9' }, more: put => { kids(put);
    put('participation/config.json', { id: 'config', test: true, mailFamilies: true, testers: [{ email: 'pip.family@example.test', children: ['k1'] }] }); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const r = await fx.as(dee, '/api/staff/newsletter/recipients', {});
  assert.deepStrictEqual([r.body.test, r.body.pageTest, r.body.count], [false, true, 8], 'three families, the three classroom inboxes, mentor and studio');
});

test('Once the Family page is open, every parent address gets one email, or one class', async t => {
  const { fx, drive } = await setup(t, false);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  assert.strictEqual((await fx.as(dee, '/api/staff/newsletter/recipients', {})).body.count, 8, 'each address once, a child who left is left out, the three classroom inboxes, mentor and studio');
  assert.strictEqual((await fx.as(dee, '/api/staff/newsletter/recipients', { classroom: 'North' })).body.count, 5, 'with the North classroom inbox, mentor and studio');
  const img = Buffer.from('a small picture').toString('base64');
  const s = await fx.as(dee, '/api/staff/newsletter/send', { classroom: 'West', subject: 'West news', html: '<img src="cid:p1">', text: 'x', images: [{ cid: 'p1', data: img }] });
  assert.strictEqual(s.body.sent, 5);
  assert.deepStrictEqual(drive.mails.map(m => m.to).sort(), ['ada@example.test', 'cy@example.test', 'mentor@childfamilycommunity.com', 'studio@childfamilycommunity.com', 'west@childfamilycommunity.com']);
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
  await s.p.click('[data-nlmph="m1"]'); await s.p.waitForSelector('[data-nlf="photos.0.cap"]', { timeout: 15000 });
  await s.p.click('[data-nlmopen]');
  await s.p.fill('#nlm-me', 'me@example.test'); await s.p.click('[data-nlmme]');
  await s.p.waitForFunction(n => n, null, { timeout: 2000 }).catch(() => {});
  for (let i = 0; i < 60 && !drive.mails.length; i++) await new Promise(r => setTimeout(r, 250));
  assert.deepStrictEqual(drive.mails.map(m => m.to), ['me@example.test']); assert.match(drive.mails[0].subject, /^Test\. /);
  await s.p.click('[data-nlmprev]');
  await s.p.waitForSelector('iframe[title="Preview of the email"]', { timeout: 20000 });
  const html = await s.p.$eval('iframe[title="Preview of the email"]', f => f.srcdoc);
  assert.match(html, /Mid-month note, /); assert.match(html, /Goats in the Hay/); assert.match(html, /Ada Plum/);
  assert.match(html, /bookshop\.org\/a\/131071\/9780000000002/); assert.match(html, /sonoma\.bibliocommons\.com/);
  assert.match(await s.p.textContent('#main'), /test mode, so this goes only to your 1 tester/);
  await s.p.click('[data-nlmsend]');
  await s.p.waitForFunction(() => [...newsletters.values()].some(x => x.kind === 'mid' && (x.emails || []).length === 1), null, { timeout: 20000 });
  assert.strictEqual(drive.mails.length, 2); assert.match(drive.mails[1].subject, /^A note from school, mid-/);
  assert.match(html, /From the last two weeks/);
  assert.match(await s.p.textContent('#main'), /Test email .* to 1 tester/);
  assert.deepStrictEqual(s.errors, []);
});

test('The mid-month note drafts highlights, why each book fits, a note and a home idea, and checks each article', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const http = require('http');
  const reply = (r, o) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(o) }], stop_reason: 'end_turn' })); };
  const ai = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => { const body = Buffer.concat(c).toString();
    if (/choose 2 to 4 highlights/.test(body)) return reply(r, { items: [{ text: 'The goats climbed the hay all week.', obs: 'o1' }] });
    if (/why this book fits right now/.test(body)) return reply(r, { fits: [{ book: 'b1', text: 'The children have been feeding the goats.' }] });
    if (/one simple idea families can try/.test(body)) return reply(r, { title: 'Watch an animal together', text: 'Find a bird or a cat and notice it together.' });
    if (/Find 3 articles/.test(body)) return reply(r, { items: [{ title: 'Animals and children', url: 'https://www.zerotothree.org/animals', source: 'Zero to Three' }, { title: 'A broken page', url: 'https://www.naeyc.org/broken', source: 'NAEYC' }, { title: 'Elsewhere', url: 'https://example.com/x', source: 'Somewhere' }] });
    if (/Strengthen it and keep it hers/.test(body)) return reply(r, { note: 'We have had two full weeks with the goats.' });
    if (/from her own words below/.test(body) && /Goats all week/.test(body)) return reply(r, { note: 'We have had a busy two weeks with the goats.' });
    return reply(r, {}); }); });
  await new Promise(ok => ai.listen(0, '127.0.0.1', ok)); t.after(() => ai.close());
  const drive = await require('./mock-drive.js').start(); t.after(() => drive.close());
  const fx = await start({ env: { DRIVE_PHOTOS_URL: drive.url, KAYMBU_INBOX_KEY: drive.key, BOOK_CATALOG_TEST_BASE: 'http://127.0.0.1:9', ANTHROPIC_API_KEY: 'sk-ant-test', ANTHROPIC_API_BASE: 'http://127.0.0.1:' + ai.address().port, LINKCHECK_TEST: '1' },
    more: put => { kids(put); put('participation/config.json', { id: 'config', test: true, testers: [{ email: 'pip.family@example.test', children: ['k1'] }] });
      put('newsletters/nl-' + new Date().toISOString().slice(0, 7) + '.json', { id: 'nl-' + new Date().toISOString().slice(0, 7), month: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 7), status: 'sent', topics: [{ id: 't1', title: 'Big feelings at pickup' }], books: [{ path: 'staff/library/books/goats-in-the-hay.md', title: 'Goats in the Hay' }] }); } });
  t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  s.p.on('dialog', d => d.accept());
  await s.p.evaluate(() => { nlMode = 'mid'; goView('newsletter'); });
  await s.p.waitForSelector('[data-nlstartmid]', { timeout: 15000 }); await s.p.click('[data-nlstartmid]');
  await s.p.click('[data-nlmhigh]'); await s.p.waitForSelector('[data-nlf="highlights.0.text"]', { timeout: 20000 });
  assert.strictEqual(await s.p.inputValue('[data-nlf="highlights.0.text"]'), 'The goats climbed the hay all week.');
  assert.ok(await s.p.evaluate(() => [...newsletters.values()].find(x => x.kind === 'mid').photos.length === 1), 'the highlight brings its photo');
  await s.p.waitForSelector('#nlbk option[value="staff/library/books/goats-in-the-hay.md"]', { timeout: 15000, state: 'attached' });
  assert.match(await s.p.textContent('#nlbk option[value="staff/library/books/goats-in-the-hay.md"]'), /shared in /, 'a book from this month\'s newsletter says so');
  await s.p.selectOption('#nlbk', 'staff/library/books/goats-in-the-hay.md'); await s.p.click('[data-nlbookadd]');
  await s.p.click('[data-nlfits]'); await s.p.waitForFunction(() => document.querySelector('[data-nlf="books.0.fits"]') && /feeding/.test(document.querySelector('[data-nlf="books.0.fits"]').value), null, { timeout: 20000 });
  await s.p.click('[data-nlhomedraft]'); await s.p.waitForSelector('[data-nlf="home.text"]', { timeout: 20000 });
  await s.p.click('[data-nlhomeread]'); await s.p.waitForSelector('[data-nlhomeart]', { timeout: 20000 });
  const offers = await s.p.$$eval('[data-nlhomeart]', xs => xs.map(x => x.closest('.nlres').textContent));
  assert.strictEqual(offers.length, 2, 'only trusted sites are offered');
  assert.match(offers[0], /Checked/); assert.match(offers[1], /Not checked/);
  await s.p.click('[data-nlhomeart]');
  await s.p.fill('[data-nlf="noteIdea"]', 'Goats all week');
  await s.p.click('[data-nlmnote]'); await s.p.waitForFunction(() => /busy two weeks/.test(document.querySelector('[data-nlf="note"]').value), null, { timeout: 20000 });
  await s.p.click('[data-nlstrong]'); await s.p.waitForSelector('#nl-strong', { timeout: 20000 });
  assert.match(await s.p.textContent('.nlsbox'), /busy two weeks/, 'her own words sit beside the stronger version');
  await s.p.click('[data-nlstrongok]');
  assert.strictEqual(await s.p.inputValue('[data-nlf="note"]'), 'We have had two full weeks with the goats.');
  const food = await s.p.evaluate(() => { notices.set('f1', { id: 'f1', at: Date.now() - 60e3, classroom: 'North', noticed: 'The children peeled apples for snack.', photo: { id: 'p-f1', w: 800, h: 600 } });
    notices.set('f2', { id: 'f2', at: Date.now() - 20 * 864e5, classroom: 'North', noticed: 'We baked bread.', photo: { id: 'p-f2', w: 800, h: 600 } });
    const x = [...newsletters.values()].find(x => x.kind === 'mid'); const r = nlRange(x); return { offer: nlFoodOffer(x), days: (parseIso(r.to) - parseIso(r.from)) / 864e5 }; });
  assert.deepStrictEqual(food.offer, ['f1'], 'only food photos from the two weeks are offered');
  assert.strictEqual(food.days, 13, 'two weeks, counting both ends');
  const x = await s.p.evaluate(() => { const x = [...newsletters.values()].find(x => x.kind === 'mid'); return nlBlocks(x).map(b => b.h); });
  assert.deepStrictEqual(x, ['A note from Renee', 'From the last two weeks', 'Books to share', 'Try at home']);
  await s.p.click('[data-nlmopen]'); await s.p.click('[data-nlmprev]');
  await s.p.waitForSelector('iframe[title="Preview of the email"]', { timeout: 20000 });
  const html = await s.p.$eval('iframe[title="Preview of the email"]', f => f.srcdoc);
  assert.match(html, /feeding the goats/); assert.match(html, /Warmly,<br>Renee/); assert.match(html, /Watch an animal together/); assert.match(html, /zerotothree\.org/);
  assert.deepStrictEqual(s.errors, []);
});

test('A closure that runs a week shows once with its first and last day, with the holiday inside it folded in', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fx = await start({}); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1000); t.after(() => s.close());
  await s.p.evaluate(() => goView('newsletter')); await s.p.waitForFunction(() => typeof nlTidyEvents === 'function', null, { timeout: 15000 });
  const r = await s.p.evaluate(() => { const L = nlTidyEvents([{ date: '2026-11-23', end: '2026-11-27', text: 'Thanksgiving Break, school closed' }, { date: '2026-11-26', text: 'Thanksgiving Day Holiday' },
    { date: '2026-12-21', text: 'Winter Break, school closed' }, { date: '2026-12-22', text: 'Winter Break, school closed' }, { date: '2026-12-23', text: 'Winter Break, school closed' }, { date: '2026-11-09', text: 'Family conferences' }]);
    return L.map(e => nlWhen(e) + '. ' + e.text); });
  const em = await s.p.evaluate(async () => { const e = await nlEmail({ id: 'nlmid-x', kind: 'mid', month: '2026-11', note: '', coming: [{ date: '2026-11-23', end: '2026-11-27', text: 'Thanksgiving Break, school closed' }] }, false); return { html: e.html, text: e.text }; });
  assert.match(em.html, /See the whole school calendar/); assert.match(em.html, /calendar\.google\.com\/calendar\/embed/); assert.match(em.text, /See the whole school calendar\.\nhttps:\/\/calendar\.google\.com/);
  assert.deepStrictEqual(r, ['Monday, November 9. Family conferences', 'Monday, November 23 to Friday, November 27. Thanksgiving Break, school closed', 'Monday, December 21 to Wednesday, December 23. Winter Break, school closed']);
  assert.deepStrictEqual(s.errors, []);
});

test('A letter about one child goes to that child\'s parents and the classroom inbox, with replies to the classroom inbox', async t => {
  const { fx, drive } = await setup(t, true);
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  assert.strictEqual((await fx.as(ann, '/api/staff/inquiry/family-recipients', { children: ['k1'] })).status, 403);
  const r = await fx.as(dee, '/api/staff/inquiry/family-recipients', { children: ['k1'] });
  assert.deepStrictEqual([r.body.parents, r.body.count, r.body.replyTo], [2, 3, 'north@childfamilycommunity.com']);
  const s = await fx.as(dee, '/api/staff/inquiry/family-mail', { children: ['k1'], subject: 'Supporting Wren', html: '<p>Dear family</p>', text: 'Dear family' });
  assert.strictEqual(s.status, 200);
  assert.deepStrictEqual(drive.mails.map(m => m.to).sort(), ['ada@example.test', 'bo@example.test', 'north@childfamilycommunity.com']);
  assert.ok(drive.mails.every(m => m.replyTo === 'north@childfamilycommunity.com'));
  // a test goes to the director alone
  drive.mails.length = 0;
  const tt = await fx.as(dee, '/api/staff/inquiry/family-mail', { children: ['k1'], subject: 'Supporting Wren', html: '<p>x</p>', text: 'x', testTo: 'dee@example.test' });
  assert.deepStrictEqual([tt.body.test, drive.mails.map(m => m.to)], [true, ['dee@example.test']]);
});

test('Our plan goes with a family letter as a PDF, and only when the mailbox script can attach it', async t => {
  const { fx, drive } = await setup(t, true);
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const s = await fx.as(dee, '/api/staff/inquiry/family-mail', { children: ['k1'], subject: 'Supporting Wren', html: '<p>Dear family</p>', text: 'Dear family', attach: { name: 'Our plan together Wren.pdf', data: pdf } });
  assert.strictEqual(s.status, 200);
  assert.strictEqual(drive.mails.length, 3); assert.ok(drive.mails.every(m => m.files.length === 1 && /Our plan together Wren\.pdf/.test(m.files[0])), JSON.stringify(drive.mails.map(m => m.files)));
  // a file that is not a PDF in base64 is refused and nothing goes out
  drive.mails.length = 0;
  const bad = await fx.as(dee, '/api/staff/inquiry/family-mail', { children: ['k1'], subject: 'Supporting Wren', html: '<p>x</p>', text: 'x', attach: { name: 'x.pdf', data: '<script>' } });
  assert.strictEqual(bad.status, 400); assert.strictEqual(drive.mails.length, 0);
});
