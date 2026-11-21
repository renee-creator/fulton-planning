'use strict';
// photos-drive.js on its own, against a small stand-in for the mailbox script that answers slowly and counts how many
// photo reads it holds at once (issue 34)
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

function slowDrive(ms, fail) {
  let now = 0, most = 0, gets = 0;
  const server = http.createServer((req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (b.op !== 'get') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
      gets++; now++; most = Math.max(most, now);
      setTimeout(() => { now--; res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(fail && fail(b) ? { error: 'No item with the given ID could be found' } : { data: Buffer.from('photo ' + b.id).toString('base64') })); }, ms);
    });
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + server.address().port + '/exec', most: () => most, gets: () => gets, close: () => new Promise(r => server.close(r)) })));
}
function photos(url) {
  process.env.DRIVE_PHOTOS_URL = url; process.env.KAYMBU_INBOX_KEY = 'test-key';
  return require('../photos-drive.js')({ store: { originals: new Map() }, log: () => {}, gh: async () => ({}), repo: 'x/y', readPhoto: async () => ({}), cacheFile: () => {} });
}

test('a burst of photo reads reaches Drive at most 4 at a time, and every one comes back', async () => {
  const d = await slowDrive(60);
  try {
    const p = photos(d.url);
    const ids = Array.from({ length: 20 }, (_, i) => 'drive-photo-' + String(i).padStart(4, '0'));
    const got = await Promise.all(ids.map(id => p.read({ drive: id })));
    assert.deepStrictEqual(got.map(b => b.toString()), ids.map(id => 'photo ' + id));
    assert.strictEqual(d.gets(), 20);
    assert.ok(d.most() <= 4, 'at most 4 at once, saw ' + d.most());
    assert.strictEqual(d.most(), 4, 'the reads still go 4 at a time');
  } finally { await d.close(); }
});

test('a read that fails frees its place for the next one', async () => {
  const d = await slowDrive(30, b => /bad/.test(b.id));
  try {
    const p = photos(d.url);
    const ids = Array.from({ length: 12 }, (_, i) => (i < 6 ? 'bad-photo-' : 'good-photo-') + String(i).padStart(4, '0'));
    const out = await Promise.allSettled(ids.map(id => p.read({ drive: id })));
    assert.strictEqual(out.filter(o => o.status === 'rejected').length, 6);
    assert.strictEqual(out.filter(o => o.status === 'fulfilled').length, 6);
    assert.ok(d.most() <= 4);
    // nothing is left holding a place
    const after = await Promise.all([1, 2, 3, 4, 5].map(i => p.read({ drive: 'later-photo-' + i })));
    assert.strictEqual(after.length, 5);
  } finally { await d.close(); }
});

test('a photo someone is waiting for goes ahead of photos asked for by TREE\'s own work', async () => {
  const d = await slowDrive(40);
  try {
    const p = photos(d.url);
    const order = [];
    // ten photos for background work are asked for first, then four that people are looking at
    const low = Array.from({ length: 10 }, (_, i) => p.read({ drive: 'background-photo-' + String(i).padStart(3, '0') }, { low: true }).then(() => order.push('low')));
    const high = Array.from({ length: 4 }, (_, i) => p.read({ drive: 'person-photo-' + String(i).padStart(5, '0') }).then(() => order.push('high')));
    await Promise.all([...low, ...high]);
    assert.strictEqual(d.gets(), 14, 'every photo comes back');
    assert.ok(d.most() <= 4, 'still at most 4 at once, saw ' + d.most());
    // the first two background photos were already on their way. Every photo a person asked for comes before the other eight.
    assert.ok(order.lastIndexOf('high') <= 5, 'people\'s photos finished early, order was ' + order.join(' '));
  } finally { await d.close(); }
});

test('background work alone holds at most 2 places, and all of it still finishes', async () => {
  const d = await slowDrive(30);
  try {
    const p = photos(d.url);
    const got = await Promise.all(Array.from({ length: 8 }, (_, i) => p.read({ drive: 'background-only-' + String(i).padStart(4, '0') }, { low: true })));
    assert.strictEqual(got.length, 8); assert.strictEqual(d.gets(), 8);
    assert.strictEqual(d.most(), 2, 'background reads go 2 at a time, saw ' + d.most());
  } finally { await d.close(); }
});
