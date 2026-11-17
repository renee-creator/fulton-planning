'use strict';
// Printing a book with Lulu. A stand-in Lulu answers here, so nothing reaches Lulu. The keys come from the server's own
// settings, the files are kept at an address only a key opens, the director alone reaches it, and an order is made with
// the files Lulu downloads from TREE (November 15, 2026). Made-up names only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start, browser, signedIn } = require('./fixture.js');

function fakeLulu() {
  const seen = [];
  const srv = http.createServer((req, res) => { const c = []; req.on('data', x => c.push(x)); req.on('end', async () => {
    const raw = Buffer.concat(c).toString('utf8'); let body = null; try { body = JSON.parse(raw); } catch (e) { body = raw; }
    seen.push({ method: req.method, path: req.url, auth: req.headers.authorization, body });
    const out = (s, j) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    if (req.url === '/auth/realms/glasstree/protocol/openid-connect/token') return req.headers.authorization === 'Basic ' + Buffer.from('k1:s1').toString('base64') ? out(200, { access_token: 'tok', expires_in: 3600 }) : out(401, {});
    if (req.headers.authorization !== 'Bearer tok') return out(401, {});
    if (req.url === '/cover-dimensions/') return out(201, { width: String(1728 + (body.interior_page_count > 84 ? 18 : 0)), height: '738.000', unit: 'pt' });
    if (req.url === '/validate-interior/' || req.url === '/validate-cover/') {
      // Lulu downloads the file from the address it was given
      const f = await fetch(body.source_url); const head = Buffer.from(await f.arrayBuffer()).slice(0, 5).toString('latin1');
      const bad = await fetch(body.source_url.replace(/t=[^&]+/, 't=0.x'));
      seen.push({ fetched: f.status, head, badKey: bad.status });
      return out(201, { id: req.url.includes('cover') ? 22 : 11, status: 'VALIDATING' });
    }
    if (req.url === '/validate-interior/11/') return out(200, { id: 11, status: 'NORMALIZED', page_count: 24 });
    if (req.url === '/validate-cover/22/') return out(200, { id: 22, status: 'NORMALIZED' });
    if (req.url === '/shipping-options/') return out(200, [{ level: 'MAIL', cost_excl_tax: '4.10', min_delivery_date: '2026-11-25', max_delivery_date: '2026-12-02' }, { level: 'GROUND_HD', cost_excl_tax: '7.00', home_only: true }, { level: 'GROUND_BUS', cost_excl_tax: '7.52', business_only: true, min_delivery_date: '2026-11-21', max_delivery_date: '2026-11-24' }, { level: 'EXPRESS', cost_excl_tax: '31.00' }]);
    if (req.url === '/print-job-cost-calculations/') return out(201, { currency: 'USD', total_cost_incl_tax: '27.40', total_tax: '1.60', shipping_cost: { total_cost_incl_tax: '7.52' }, line_item_costs: [{ total_cost_incl_tax: '18.28' }] });
    if (req.url === '/print-jobs/' && req.method === 'POST') return out(201, { id: 501, status: { name: 'CREATED' } });
    if (req.url === '/print-jobs/501/') return out(200, { id: 501, status: { name: 'UNPAID', message: 'needs to be paid' }, costs: { total_cost_incl_tax: '27.40' }, estimated_shipping_dates: { arrival_max: '2026-11-30' } });
    if (req.url === '/print-jobs/501/status/' && req.method === 'PUT') return out(200, { name: 'CANCELED' });
    out(404, {});
  }); });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ srv, seen, base: 'http://127.0.0.1:' + srv.address().port })));
}
const pdf = n => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n, 32)]).toString('base64');

test('the server reaches Lulu with the keys from its settings, for the director alone', async t => {
  const L = await fakeLulu(); t.after(() => L.srv.close());
  const fx = await start({ env: { LULU_SANDBOX_KEY: 'k1', LULU_SANDBOX_SECRET: 's1', LULU_API_BASE: L.base } }); t.after(() => fx.stop());
  const dee = await fx.login('Dee', 'director-pass-1'), ann = await fx.login('Ann', '1357');
  assert.strictEqual((await fx.as(ann.token, '/api/lulu/status', {})).status, 403);
  assert.deepStrictEqual((await fx.as(dee.token, '/api/lulu/status', {})).body, { connected: true, mode: 'sandbox' });
  const pod = '1100X0850.FC.PRE.CW.080CW444.GXX';
  assert.deepStrictEqual((await fx.as(dee.token, '/api/lulu/cover-size', { pod, pages: 24 })).body, { width: 1728, height: 738 });
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/cover-size', { pod, pages: 23 })).status, 400, 'a hardcover takes an even count of at least 24');
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/cover-size', { pod: 'anything', pages: 24 })).status, 400);
  // a file in two parts, then one that is not a PDF
  assert.deepStrictEqual((await fx.as(dee.token, '/api/lulu/part', { id: 'interior0001', n: 0, total: 2, data: pdf(200) })).body, { ok: true, done: false });
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/part', { id: 'interior0001', n: 1, total: 2, data: pdf(50) })).body.done, true);
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/part', { id: 'notapdf00001', n: 0, total: 1, data: Buffer.from('hello').toString('base64') })).status, 400);
  await fx.as(dee.token, '/api/lulu/part', { id: 'cover0000001', n: 0, total: 1, data: pdf(100) });
  const v = (await fx.as(dee.token, '/api/lulu/check', { interior: 'interior0001', cover: 'cover0000001', pod, pages: 24 })).body;
  assert.deepStrictEqual(v, { interior: 11, cover: 22 });
  const got = L.seen.filter(x => x.fetched); assert.strictEqual(got.length, 2);
  assert.ok(got.every(x => x.fetched === 200 && x.head === '%PDF-' && x.badKey === 403), 'Lulu downloads each file, and a wrong key opens nothing');
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/checked', v)).body.cover.status, 'NORMALIZED');
  const address = { name: 'Our school', street1: '1 Test Road', city: 'Santa Rosa', state_code: 'CA', postcode: '95401', phone_number: '555-0100' };
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/price', { pod, pages: 24, address: Object.assign({}, address, { phone_number: '' }), level: 'GROUND' })).status, 400, 'Lulu needs a phone number');
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/price', { pod, pages: 24, address, level: 'GROUND' })).body.total, '27.40');
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/order', { interior: 'interior0001', cover: 'cover0000001', pod, pages: 24, address, level: 'GROUND', email: '' })).status, 400);
  const o = (await fx.as(dee.token, '/api/lulu/order', { interior: 'interior0001', cover: 'cover0000001', pod, pages: 24, address, level: 'GROUND', email: 'office@example.com', title: 'Pip Test, book', ref: 'tree-pip' })).body;
  assert.deepStrictEqual(o, { id: 501, status: 'CREATED', mode: 'sandbox' });
  const job = L.seen.find(x => x.path === '/print-jobs/' && x.method === 'POST').body;
  assert.strictEqual(job.line_items[0].printable_normalization.pod_package_id, pod); assert.match(job.line_items[0].printable_normalization.interior.source_url, /\/lulu-file\/interior0001\.pdf\?t=/);
  assert.strictEqual(job.shipping_level, 'GROUND'); assert.strictEqual(job.production_delay, 120);
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/job', { id: 501 })).body.status, 'UNPAID');
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/cancel', { id: 501 })).body.status, 'CANCELED');
});

test('without keys in Render, TREE says Lulu is not connected', async t => {
  const fx = await start({ env: { LULU_CLIENT_KEY: '', LULU_CLIENT_SECRET: '', LULU_SANDBOX_KEY: '', LULU_SANDBOX_SECRET: '' } }); t.after(() => fx.stop());
  const dee = await fx.login('Dee', 'director-pass-1');
  assert.deepStrictEqual((await fx.as(dee.token, '/api/lulu/status', {})).body, { connected: false, mode: '' });
  assert.strictEqual((await fx.as(dee.token, '/api/lulu/cover-size', { pod: '1100X0850.FC.PRE.CW.080CW444.GXX', pages: 24 })).status, 503);
});

test('the Book tab makes the cover and the pages, has Lulu check them, shows the price and orders', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const L = await fakeLulu(); t.after(() => L.srv.close());
  const at = (m, d) => new Date(2026, m - 1, d, 10).getTime();
  const fx = await start({ env: { LULU_SANDBOX_KEY: 'k1', LULU_SANDBOX_SECRET: 's1', LULU_API_BASE: L.base }, more: put => {
    put('children/pip.json', { first: 'Pip', last: 'Test', classroom: 'West', status: 'active', dob: '2022-03-01' });
    put('books/pip.json', { id: 'pip', child: 'pip', readBy: { name: 'Dee', at: 1 }, letter: 'Dear Pip,\nThis book is for you.', pages: [
      { id: 'p1', ym: '2026-09', year: '2026-27', room: 'West', title: 'The Beans', body: 'Pip watered the beans.', quote: '', see: '', photos: [], sources: [], edited: true, hidden: false }] });
    put('settings/lulu.json', { id: 'lulu', finish: 'M', email: 'office@example.com', address: { name: 'Our school', street1: '1 Test Road', city: 'Santa Rosa', state_code: 'CA', postcode: '95401', country_code: 'US', phone_number: '555-0100' } });
  } }); t.after(() => fx.stop());
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Dee', 'director-pass-1', 1100); t.after(() => s.close());
  await s.p.evaluate(() => { window.bkWait = () => Promise.resolve(); });
  await s.p.evaluate(() => window.TREE_OPEN_KID('pip', 'book'));
  await s.p.waitForSelector('[data-bklfiles]', { timeout: 15000 });
  await s.p.evaluate(() => { bkWait = () => Promise.resolve(); });
  await s.p.click('[data-bklfiles]'); await s.p.waitForSelector('select[data-bkllevel]', { timeout: 60000 });
  assert.strictEqual(await s.p.inputValue('select[data-bkllevel]'), 'GROUND_BUS', 'ground to a business is chosen for the school');
  assert.match(await s.p.innerText('select[data-bkllevel]'), /Ground, to a business, arrives .* \$7\.52/);
  const ship = L.seen.find(x => x.path === '/shipping-options/').body; assert.strictEqual(ship.shipping_address.state, 'CA'); assert.strictEqual(ship.line_items[0].page_count, 24);
  const cov = L.seen.find(x => x.path === '/cover-dimensions/').body;
  assert.deepStrictEqual(cov, { pod_package_id: '1100X0850.FC.PRE.CW.080CW444.MXX', interior_page_count: 24, unit: 'pt' }, 'a matte cover, and the book padded to 24 pages');
  assert.match(await s.p.innerText('#main'), /Lulu checked both files\. 24 pages, matte cover/);
  await s.p.click('[data-bklprice]'); await s.p.waitForSelector('[data-bklorder]');
  assert.match(await s.p.innerText('#main'), /Total \$27\.40/);
  assert.strictEqual(L.seen.find(x => x.path === '/print-job-cost-calculations/').body.shipping_option, 'GROUND_BUS');
  await s.p.click('[data-bklorder]'); await s.p.waitForFunction(() => (books.get('pip').lulu || []).length === 1);
  assert.strictEqual(L.seen.find(x => x.path === '/print-jobs/' && x.method === 'POST').body.shipping_level, 'GROUND_BUS');
  const ord = await s.p.evaluate(() => books.get('pip').lulu[0]); assert.strictEqual(ord.id, 501); assert.strictEqual(ord.mode, 'sandbox');
  await s.p.click('[data-bkljob="501"]'); await s.p.waitForFunction(() => books.get('pip').lulu[0].status === 'UNPAID');
  assert.match(await s.p.innerText('#main'), /Waiting to be paid in your Lulu account, \$27\.40/);
  assert.deepStrictEqual(s.errors, []);
});
