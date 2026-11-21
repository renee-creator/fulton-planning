'use strict';
// TREE's own library check. It signs in to a stand-in for the library with a made-up card, places the holds for the
// books in the bag at the pickup place, reads the card, and moves each book along. Made-up names and books only.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { start } = require('./fixture.js');

const book = (title, author) => `<!--\nlibrary: book\nauthor: ${author}\nowned: no\n-->\n# ${title}\n\n## Why we chose it\n\nA made-up book.\n`;

function fakeLibrary() {
  const seen = { holdsPlaced: [], signIns: 0, badPin: false };
  const bibs = {
    B1: { id: 'B1', briefInfo: { title: 'Goats in the Hay', format: 'EBOOK', superFormats: ['BOOKS'] }, policy: { materialType: 'DIGITAL', holdable: true } },
    B2: { id: 'B2', briefInfo: { title: 'Goats in the Hay', subtitle: 'A Farm Story', format: 'BK', superFormats: ['BOOKS'] }, policy: { materialType: 'PHYSICAL', holdable: true } },
    B3: { id: 'B3', briefInfo: { title: 'Rain Again', format: 'DVD', superFormats: ['MOVIES'] }, policy: { materialType: 'PHYSICAL', holdable: true } },
    B4: { id: 'B4', briefInfo: { title: 'Some Other Book', format: 'BK', superFormats: ['BOOKS'] }, policy: { materialType: 'PHYSICAL', holdable: true } } };
  const holds = { H9: { id: 'H9', metadataId: 'B4', status: 'READY_FOR_PICKUP' } };
  const out = { C1: { id: 'C1', metadataId: 'B4', dueDate: '2026-12-08' } };
  const srv = http.createServer((req, res) => { let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname.replace('/v2/libraries/sonoma', '');
    const send = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    const authed = req.headers['x-session-id'] === 'S1' && req.headers['x-access-token'] === 'T1';
    if (p === '/sessions' && req.method === 'POST') { seen.signIns++; const b = JSON.parse(body);
      if (seen.badPin || b.username !== '21234000000000' || b.password !== '4321') return send(401, { failures: [{ errorResponseDTO: { message: 'Invalid' } }] });
      return send(200, { auth: { sessionId: 'S1', authToken: 'T1', currentUserId: 'U1' }, entities: { users: { U1: { id: 'U1', accounts: ['A7'] } } } }); }
    if (p === '/locations') return send(200, { entities: { locations: { 1: { code: '17', name: 'Northwest Santa Rosa Library' }, 2: { code: '18', name: 'Northwest BiblioBox' } } } });
    if (p === '/bibs/search') { const q = (u.searchParams.get('query') || '').toLowerCase();
      const hit = Object.values(bibs).filter(b => q.includes(b.briefInfo.title.toLowerCase().split(' ')[0]));
      return send(200, { catalogSearch: { results: hit.map(b => ({ representative: b.id })) }, entities: { bibs: Object.fromEntries(hit.map(b => [b.id, b])) } }); }
    if (!authed) return send(401, {});
    if (p === '/holds' && req.method === 'GET') { assert.strictEqual(u.searchParams.get('accountId'), 'A7'); return send(200, { entities: { holds, bibs } }); }
    if (p === '/holds' && req.method === 'POST') { const b = JSON.parse(body); seen.holdsPlaced.push(b); holds['H' + b.metadataId] = { id: 'H' + b.metadataId, metadataId: b.metadataId, status: 'NOT_YET_AVAILABLE' }; return send(200, { entities: {} }); }
    if (p === '/checkouts') return send(200, { entities: { checkouts: out, bibs } });
    send(404, {}); }); });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, seen })));
}

test('TREE places the holds itself, at the BiblioBox, in print only, and reads the card', async t => {
  const lib = await fakeLibrary(); t.after(() => lib.srv.close());
  const fx = await start({ env: { BOOKBAG_TODAY: '2026-11-17', BOOKBAG_GRACE_MS: '0', BOOK_CATALOG_TEST_BASE: 'http://127.0.0.1:9', LIBRARY_CHECK_OFF: '1',
    LIBRARY_CARD: '21234000000000', LIBRARY_PIN: '4321', LIBRARY_GATEWAY: 'http://127.0.0.1:' + lib.port, LIBRARY_CATALOG: 'http://127.0.0.1:9' }, more: put => {
    put('staff/library/books/goats-in-the-hay.md', book('Goats in the Hay', 'Ada Plum'));
    put('staff/library/books/rain-again.md', book('Rain Again', 'Bo Fern'));
    put('staff/library/books/some-other-book.md', book('Some Other Book', 'Cy Moss')); } });
  t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
  const L = (await fx.as(ann, '/api/staff/library', {})).body;
  for (const ti of ['Goats in the Hay', 'Rain Again']) await fx.as(ann, '/api/staff/library/bag/add', { path: L.books.find(x => x.title === ti).path });
  assert.strictEqual((await fx.as(ann, '/api/staff/library/bag/check', {})).status, 403, 'the check is the director\'s');
  assert.ok(!('checker' in (await fx.as(ann, '/api/staff/library', {})).body.bag));
  const r = await fx.as(dee, '/api/staff/library/bag/check', {});
  assert.strictEqual(r.status, 200);
  const bag = r.body.bag, by = ti => bag.items.find(x => x.title === ti && x.status !== 'returned');
  assert.strictEqual(bag.checker, true);
  assert.strictEqual(lib.seen.holdsPlaced.length, 1, 'one hold placed');
  assert.deepStrictEqual(lib.seen.holdsPlaced[0], { metadataId: 'B2', materialType: 'PHYSICAL', accountId: 'A7', enableSingleClickHolds: false, materialParams: { branchId: '18', errorMessageLocale: 'en-US' } }, 'the print copy, picked up at the Northwest BiblioBox');
  assert.strictEqual(by('Goats in the Hay').status, 'requested');
  assert.strictEqual(by('Rain Again').status, 'bag', 'no print copy, so it stays in the bag');
  assert.deepStrictEqual(bag.sync.missed, ['Rain Again (no print copy found)']);
  assert.strictEqual(by('Some Other Book').status, 'out', 'a book of ours on the card joins the bag');
  assert.strictEqual(by('Some Other Book').due, '2026-12-08');
  assert.strictEqual(bag.check.ok, true); assert.deepStrictEqual(bag.check.placed, ['Goats in the Hay']);
  // a second check finds the hold already there and places nothing again
  await fx.as(dee, '/api/staff/library/bag/check', {});
  assert.strictEqual(lib.seen.holdsPlaced.length, 1);
  // a PIN the library does not take stops the check with the reason, and nothing is lost
  lib.seen.badPin = true;
  const s = (await fx.as(dee, '/api/staff/library/bag/check', {})).body.bag;
  assert.strictEqual(s.check.ok, false); assert.match(s.check.error, /LIBRARY_CARD and LIBRARY_PIN/);
  assert.strictEqual(s.items.find(x => x.title === 'Goats in the Hay').status, 'requested');
});
