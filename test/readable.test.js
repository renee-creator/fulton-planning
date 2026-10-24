'use strict';
// the weekly readable copies, through the real server to the real mailbox script run by mock-drive.js, and the
// director's TREE collecting the set, against the made-up school in fixture.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { start, browser, signedIn } = require('./fixture.js');
const drive = require('./mock-drive.js');

const B64 = s => Buffer.from(s).toString('base64');
function more(put) {
  put('children/kit-a.json', { id: 'kit-a', first: 'Pip', last: 'Test', classroom: 'North', dob: '2022-03-01', status: 'enrolled' });
  put('children/kit-b.json', { id: 'kit-b', first: 'Rue', last: 'Test', classroom: 'West', dob: '2021-06-01', status: 'withdrawn', leftAs: 'left', leftOn: '2026-09-30' });
  put('children/kit-c.json', { id: 'kit-c', first: 'Oak', last: 'Test', classroom: 'South', dob: '2022-08-01', status: 'enrolled' });
  const at = Date.parse('2026-10-14T17:00:00Z');
  put('notices/n1.json', { id: 'n1', at, classroom: 'North', noticed: 'Pip stacked the stones by size', children: ['kit-a'], by: 'Bea' });
  put('notices/n2.json', { id: 'n2', at, classroom: 'West', noticed: 'Rue sang to the goats', children: ['kit-b'], by: 'Ann' });
  put('plans/p1.json', { id: 'p1', type: 'classroom', classroom: 'North', weekOf: '2026-10-12', educator: 'Bea', fields: { intentions: 'Stones and weight' } });
  put('plans/p2.json', { id: 'p2', type: 'classroom', classroom: 'West', weekOf: '2026-10-12', educator: 'Ann', fields: { intentions: 'Songs for the goats' } });
  put('plans/p3.json', { id: 'p3', type: 'classroom', classroom: 'North', weekOf: '2025-10-13', educator: 'Bea', fields: { intentions: 'A plan from last year' } });
  put('threads/t1.json', { id: 't1', name: 'Heavy and light', classroom: 'North', question: 'What makes a stone heavy?', evidence: [] });
  put('projects/x1.json', { id: 'x1', name: 'The goat path', home: '', status: 'active', classrooms: [], threads: [] });
  put('inquiries/q1.json', { id: 'q1', name: 'Rest time', room: 'South', status: 'open', see: 'Waking early', hyps: [{ text: 'Tired after lunch', at, by: 'Ann' }], tries: [{ text: 'A quiet corner', at, by: 'Ann', result: 'A longer rest', resultAt: at + 864e5 }] });
  put('conferences/cf1.json', { id: 'cf1', childId: 'kit-a', term: 'Fall', schoolYear: '2026-27', fields: { strengths: 'Pip builds' } });
  // the director's alone, and never in a readable copy
  put('staff/journal/bea.json', { entries: [{ id: 'j1', date: '2026-10-02', joy: 'A private joy in the journal' }] });
}

test('the server passes readable copies to the mailbox script for the director only, and a whole set replaces the last', async () => {
  const d = await drive.start({});
  const fx = await start({ more, env: { DRIVE_PHOTOS_URL: d.url, KAYMBU_INBOX_KEY: d.key } });
  try {
    const dee = (await fx.login('Dee', 'director-pass-1')).token, ann = (await fx.login('Ann', '1357')).token;
    let r; for (let i = 0; i < 40; i++) { r = await fx.as(dee, '/api/readable', { action: 'start', device: 'one' }); if (r.status !== 503) break; await new Promise(ok => setTimeout(ok, 250)); }
    assert.strictEqual(r.status, 200); const run = r.body.run; assert.match(run, /^\d{4}-\d{2}-\d{2}$/); assert.deepStrictEqual(r.body.have, []);
    assert.strictEqual((await fx.as(ann, '/api/readable', { action: 'start', device: 'two' })).status, 403);
    // a second device waits while the first is making the set
    assert.strictEqual((await fx.as(dee, '/api/readable', { action: 'start', device: 'two' })).body.busy, true);
    assert.strictEqual((await fx.as(dee, '/api/readable', { action: 'put', device: 'two', run, folder: 'School', name: 'a.pdf', data: B64('%PDF') })).status, 409);
    const put = (folder, name, data, more2) => fx.as(dee, '/api/readable', Object.assign({ action: 'put', device: 'one', run, folder, name, data }, more2 || {}));
    assert.strictEqual((await put('North Class', 'Portfolio Pip Test.pdf', B64('%PDF-1.3 small'))).status, 200);
    assert.strictEqual((await put('North Class', 'Portfolio Pip Test.docx', B64('PK small'))).status, 200);
    // only PDF and Word files, in the set's own folders
    assert.strictEqual((await put('../photos', 'x.pdf', B64('x'))).status, 400);
    assert.strictEqual((await put('School', 'notes.txt', B64('x'))).status, 400);
    assert.strictEqual((await put('School', '../x.pdf', B64('x'))).status, 400);
    // a large file goes in pieces of 4 MB and arrives whole
    const big = Buffer.alloc(9 * 1024 * 1024 + 5, 3); big.write('%PDF-1.3', 0); const C = 4 * 1024 * 1024;
    for (let k = 0; k < 3; k++) assert.strictEqual((await put('Former children', 'Portfolio Rue Test.pdf', big.subarray(k * C, (k + 1) * C).toString('base64'), { part: k, parts: 3, total: big.length, start: k * C, upload: 'u1' })).status, 200);
    assert.ok(d.file(`TREE readable copies/${run}/Former children/Portfolio Rue Test.pdf`).equals(big));
    // a set that is not whole keeps the last one
    const short = await fx.as(dee, '/api/readable', { action: 'finish', device: 'one', run, files: 9 });
    assert.strictEqual(short.status, 502); assert.match(short.body.error, /Only 3 of the 9 files/);
    // starting again the same week carries on with what is there
    const again = await fx.as(dee, '/api/readable', { action: 'start', device: 'one' });
    assert.strictEqual(again.body.run, run); assert.strictEqual(again.body.have.length, 3);
    const fin = await fx.as(dee, '/api/readable', { action: 'finish', device: 'one', run, files: 3, bytes: big.length });
    assert.strictEqual(fin.status, 200); assert.strictEqual(fin.body.kept, 3);
    await new Promise(ok => setTimeout(ok, 1500));
    const rec = JSON.parse(fs.readFileSync(path.join(fx.dir, 'settings/readable.json'), 'utf8'));
    assert.strictEqual(rec.run, run); assert.strictEqual(rec.files, 3); assert.ok(rec.lastAt > Date.now() - 60000); assert.strictEqual(rec.pending, null);
    assert.strictEqual((await fx.as(dee, '/api/readable', { action: 'fail', device: 'one', run, why: 'stopped' })).status, 409, 'the device let go of the set when it finished');
    // a new set the same day goes in its own folder, and the last one goes to the trash only once the new one is whole
    const n2 = await fx.as(dee, '/api/readable', { action: 'start', device: 'one' });
    assert.strictEqual(n2.body.run, run + ' 2'); assert.deepStrictEqual(n2.body.have, []);
    assert.strictEqual((await fx.as(dee, '/api/readable', { action: 'put', device: 'one', run: n2.body.run, folder: 'School', name: 'Gia records.pdf', data: B64('%PDF-1.3 new') })).status, 200);
    assert.strictEqual(d.tree().length, 4, 'the last set is still there while the new one arrives');
    assert.strictEqual((await fx.as(dee, '/api/readable', { action: 'finish', device: 'one', run: n2.body.run, files: 1 })).body.trashed, 1);
    assert.deepStrictEqual(d.tree(), [`TREE readable copies/${run} 2/School/Gia records.pdf`]);
    assert.deepStrictEqual(d.trashed(), [`TREE readable copies/${run}`]);
  } finally { await fx.stop(); await d.close(); }
});

test('the server says plainly when Google Drive is not set up', async () => {
  const fx = await start({ more });
  try {
    const dee = (await fx.login('Dee', 'director-pass-1')).token;
    let r; for (let i = 0; i < 40; i++) { r = await fx.as(dee, '/api/readable', { action: 'start', device: 'one' }); if (r.status === 503 && /Google Drive/.test(r.body.error || '')) break; await new Promise(ok => setTimeout(ok, 250)); }
    assert.strictEqual(r.status, 503); assert.match(r.body.error, /Google Drive is not set up/);
  } finally { await fx.stop(); }
});

test('the director\'s TREE makes the set by itself on a computer, never on a phone, with nothing private in it', async t => {
  const chromium = await browser(); if (!chromium) { t.skip('Playwright is not installed here'); return; }
  const d = await drive.start({});
  const fx = await start({ more, env: { DRIVE_PHOTOS_URL: d.url, KAYMBU_INBOX_KEY: d.key } }); const b = await chromium.launch();
  t.after(async () => { await b.close(); await fx.stop(); await d.close(); });
  // the prints themselves come from libraries TREE loads from the web, so here each file holds what it would print
  const stub = p => p.evaluate(() => {
    const text = docs => JSON.stringify(docs, (k, v) => typeof v === 'function' ? undefined : v);
    window.makePdf = async (docs, name, ret) => new Blob(['%PDF-1.3 ' + name + ' ' + text(docs)], { type: 'application/pdf' });
    // a print that fails is left out of the set and named on the card
    window.makeDocx = async (docs, name, ret) => /Rest time/.test(name) ? undefined : new Blob(['PK ' + name + ' ' + text(docs)]);
    window.rcConferences = async each => each([{ id: 'cf1', childId: 'kit-a' }], async () => [{ filename: 'pip-test-conference-fall-2026-27.pdf', blob: new Blob(['%PDF-1.3 conference']) }, { filename: 'pip-test-conference-fall-2026-27.docx', blob: new Blob(['PK conference']) }]);
  });
  await t.test('a phone never starts it, and its card says why', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 390);
    await s.p.evaluate(() => { rcSoon(); clearTimeout(rcTimer); }); await s.p.evaluate(() => { if (!rcNow && readableSeen && rcCan() && rcDue()) rcMake(false); });
    assert.strictEqual(await s.p.evaluate(() => !!rcNow), false);
    await s.p.evaluate(() => goView('settings')); await s.p.waitForTimeout(600);
    const card = await s.p.evaluate(() => [...document.querySelectorAll('#main section.card')].find(x => /Backups/.test(x.querySelector('.lbl')?.textContent || '')).innerText);
    assert.match(card, /No readable copies yet/); assert.match(card, /A phone never makes them/); assert.doesNotMatch(card, /Make readable copies now/);
    assert.ok(!d.calls.some(c => /^readable/.test(c.op || '')));
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
  await t.test('an educator has no readable copies and no card', async () => {
    const s = await signedIn(fx, b, 'Bea', '1357', 1280);
    assert.strictEqual(await s.p.evaluate(() => rcCan()), false);
    await s.p.evaluate(() => goView('settings')); await s.p.waitForTimeout(600);
    assert.doesNotMatch(await s.p.evaluate(() => document.querySelector('#main').innerText), /Readable copies/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
  await t.test('a computer makes the whole set in its folders, and the Backups card shows when', async () => {
    const s = await signedIn(fx, b, 'Dee', 'director-pass-1', 1280); await stub(s.p);
    await s.p.waitForFunction(() => readableSeen && rcCan() && rcDue(), null, { timeout: 15000 });
    await s.p.evaluate(() => { clearTimeout(rcTimer); return rcMake(false); });
    const files = d.tree().map(f => f.replace(/^TREE readable copies\/\d{4}-\d{2}-\d{2}\//, ''));
    const want = ['North Class/Portfolio Pip Test', 'Former children/Portfolio Rue Test', 'North Class/Fulton plans week of 2026-10-12 North', 'West Class/Fulton plans week of 2026-10-12 West',
      'North Class/Thread Heavy and light', 'School/Project The goat path full', 'South Class/Team inquiry Rest time full', 'North Class/pip-test-conference-fall-2026-27',
      'West Class/Ann records', 'North Class/Bea records', 'School/Gia records'];
    for (const w of want) for (const ext of ['.pdf', '.docx']) if (!/Rest time/.test(w) || ext === '.pdf') assert.ok(files.includes(w + ext), w + ext + ' in ' + files.join(', '));
    assert.ok(!files.includes('South Class/Team inquiry Rest time full.docx'));
    // the full print of a team inquiry with its thinking over time keeps each date beside its step, so it can print at all
    assert.ok(await s.p.evaluate(() => { const bl = inquiryDoc(inquiries.get('q1'), true).blocks.filter(x => x.t === 'item'); return bl.length >= 3 && bl.every(x => Array.isArray(x.side)); }));
    // last year's plans and a child with nothing in the portfolio are not among them
    assert.ok(!files.some(f => /2025-10-13|Oak Test/.test(f)));
    for (const f of d.tree()) { const t2 = d.file(f).toString('utf8'); assert.doesNotMatch(t2, /private joy|journal|check-?in|evaluation|1357|director-pass/i, f); }
    assert.strictEqual(await s.p.evaluate(() => rcDue()), false);
    await s.p.evaluate(() => goView('settings')); await s.p.waitForFunction(() => /Last readable copies/.test(document.querySelector('#main').innerText), null, { timeout: 10000 });
    const card = await s.p.evaluate(() => [...document.querySelectorAll('#main section.card')].find(x => /Backups/.test(x.querySelector('.lbl')?.textContent || '')).innerText);
    assert.match(card, new RegExp(`${d.tree().length} files`)); assert.match(card, /Make readable copies now/); assert.doesNotMatch(card, /missed/);
    assert.match(card, /1 file could not be made, so the set leaves it out\. It is Team inquiry Rest time full\.docx\./);
    // Make readable copies now makes a new set the same day, and the last set goes to the trash once it is whole
    const n0 = d.tree().length;
    await s.p.click('[data-rcnow]'); await s.p.waitForFunction(() => !rcNow && /The readable copies are in Google Drive/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 });
    assert.strictEqual(d.trashed().length, 1); assert.strictEqual(d.tree().length, n0); assert.ok(d.tree().every(f => / 2\//.test(f)));
    // the second set copies every file whose records have not changed, inside Drive, and makes only the rest
    const second = d.calls.slice(d.calls.findIndex((c, i) => c.op === 'readable-start' && i > 0 && d.calls.slice(0, i).some(x => x.op === 'readable-finish')));
    assert.ok(second.some(c => c.op === 'readable-copy'), 'files were copied');
    assert.deepStrictEqual(second.filter(c => c.op === 'readable-put').map(c => c.name), ['Team inquiry Rest time full.pdf'], 'only the file that did not finish last time is made again');
    assert.match(await s.p.evaluate(() => { renderSettings(); return document.querySelector('#main').innerText; }), /copied unchanged from the set before/);
    // a week with no set says so
    await s.p.evaluate(() => { readableInfo = Object.assign({}, readableInfo, { lastAt: Date.now() - 16 * 864e5 }); renderSettings(); });
    assert.match(await s.p.evaluate(() => document.querySelector('#main').innerText), /Last week's set was missed/);
    assert.deepStrictEqual(s.errors, []); await s.close();
  });
});
