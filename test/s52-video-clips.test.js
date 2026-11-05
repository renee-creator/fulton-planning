'use strict';
/* Video clips into draft observations. A clip the mailbox script finds is posted to /inbound/video with the key. While
   the director's Video clips switch is off it waits. Turning the switch on fetches the clip from the mock Drive in
   pieces, uploads it to a fake Gemini Files API, waits for ACTIVE, asks generateContent, deletes the file and leaves
   the named educator a draft with the words as lines, [unclear] kept, What I wonder empty, the clip on it and stills as
   its photos. A failed generateContent still leaves a draft that says so. The page shows Watch the clip on the draft
   and on a Presenting agenda block. Made-up names only. */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { start, browser, signedIn } = require('./fixture.js');

const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await wait(250); } return false; }
const KEY = 'kaymbu-test-key';

// a two second clip with sound, made by ffmpeg when it is here, else a few bytes that only look like a file
function ffmpegBin() { try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch (e) {} for (const p of ['/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']) if (fs.existsSync(p)) return p; return ''; }
function makeClip() {
  const bin = ffmpegBin(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-clip-')); const f = path.join(dir, 'clip.mp4');
  if (bin) { const r = spawnSync(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-shortest', '-pix_fmt', 'yuv420p', f]); if (r.status === 0 && fs.existsSync(f)) return { bytes: fs.readFileSync(f), real: true }; }
  return { bytes: Buffer.alloc(5 * 1024 * 1024 + 123, 7), real: false };
}
// a tiny JPEG for the Drive thumbnail fallback
const THUMB = fs.readFileSync(path.join(__dirname, 'fixtures-standin.jpg'));

// the fake Gemini Files API and generateContent. Answers can be made to fail for one clip by its display name.
function fakeGemini(opt) {
  const seen = { uploads: [], polls: 0, gens: [], deletes: [] }; const files = new Map(); let n = 0;
  const srv = http.createServer((q, r) => { const c = []; q.on('data', d => c.push(d)); q.on('end', () => {
    const body = Buffer.concat(c); const u = new URL(q.url, 'http://x'); const key = q.headers['x-goog-api-key'];
    const out = (code, j, h) => { r.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, h || {})); r.end(JSON.stringify(j)); };
    if (key !== 'gem-test-key') return out(403, { error: 'bad key' });
    if (u.pathname === '/upload/v1beta/files' && q.headers['x-goog-upload-command'] === 'start') { const meta = JSON.parse(body.toString()); const id = 'f' + (++n); files.set(id, { name: meta.file.display_name, size: +q.headers['x-goog-upload-header-content-length'], type: q.headers['x-goog-upload-header-content-type'], state: 'PROCESSING', polls: 0 });
      return out(200, {}, { 'x-goog-upload-url': 'http://127.0.0.1:' + srv.address().port + '/upload/session/' + id }); }
    if (u.pathname.startsWith('/upload/session/')) { const id = u.pathname.split('/').pop(); const f = files.get(id); if (!f) return out(404, {}); f.got = body.length; seen.uploads.push({ id, name: f.name, size: f.size, got: body.length, type: f.type });
      return out(200, { file: { name: 'files/' + id, uri: 'http://127.0.0.1:' + srv.address().port + '/v1beta/files/' + id, mimeType: f.type, state: 'PROCESSING' } }); }
    if (q.method === 'GET' && u.pathname.startsWith('/v1beta/files/')) { const id = u.pathname.split('/').pop(); const f = files.get(id); if (!f) return out(404, {}); seen.polls++; f.polls++; if (f.polls >= 2) f.state = 'ACTIVE';
      return out(200, { name: 'files/' + id, uri: 'http://127.0.0.1:' + srv.address().port + '/v1beta/files/' + id, mimeType: f.type, state: f.state }); }
    if (q.method === 'DELETE' && u.pathname.startsWith('/v1beta/files/')) { const id = u.pathname.split('/').pop(); seen.deletes.push(id); files.delete(id); return out(200, {}); }
    if (/:generateContent$/.test(u.pathname)) { const j = JSON.parse(body.toString()); const fd = j.contents[0].parts[0].file_data; const id = String(fd.file_uri).split('/').pop(); const f = files.get(id) || {};
      seen.gens.push({ model: decodeURIComponent(u.pathname.split('/models/')[1].replace(/:generateContent$/, '')), uri: fd.file_uri, mime: fd.mime_type, meta: j.contents[0].parts[0].video_metadata || null, prompt: j.contents[0].parts[1].text, name: f.name });
      if (opt.failFor && f.name && f.name.includes(opt.failFor)) return out(500, { error: { message: 'the fake model is down' } });
      const text = JSON.stringify({ transcript: [{ t: 1, who: 'a child', words: 'Look, it is [unclear] sinking' }, { t: 1.6, who: 'the educator', words: 'What do you notice?' }], actions: [{ t: 0.5, what: 'A child pushes the long block under the water.' }, { t: 1.8, what: 'Another child holds a cup over the tub.' }], place: 'water table', stills: [0.5, 1.5] });
      return out(200, { candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 777, candidatesTokenCount: 55 } }); }
    out(404, { error: 'not in the fake' }); }); });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ seen, port: srv.address().port, close: () => new Promise(r => srv.close(r)) })));
}

async function setup(t, opt) {
  opt = opt || {};
  const drive = await require('./mock-drive.js').start({ key: KEY, thumb: THUMB }); t.after(() => drive.close());
  const gem = await fakeGemini(opt); t.after(() => gem.close());
  const fx = await start({ env: Object.assign({ KAYMBU_INBOX_KEY: KEY, DRIVE_PHOTOS_URL: drive.url, GEMINI_API_KEY: 'gem-test-key', GEMINI_API_BASE: 'http://127.0.0.1:' + gem.port, GEMINI_MODEL: 'gemini-test-flash' }, opt.env || {}), more: opt.more }); t.after(() => fx.stop());
  const read = p => { const f = path.join(fx.dir, p); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const inbound = async (b) => { const r = await fetch(fx.api + '/inbound/video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ key: KEY }, b)) }); return { status: r.status, body: await r.json() }; };
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const program = async (patch) => fx.as(dee, '/api/write', { op: 'update', kind: 'settings', id: 'program', patch });
  return { drive, gem, fx, read, inbound, dee, program };
}

test('a clip waits while the switch is off, is read when it turns on, and leaves the named educator a draft', async t => {
  const h = await setup(t); const clip = makeClip();
  const fileId = h.drive.addVideo('North Ann water.mp4', clip.bytes, 'video/mp4');
  // the key is checked, and a file that is not a video is refused for good
  assert.strictEqual((await fetch(h.fx.api + '/inbound/video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'wrong', fileId, name: 'x.mp4', mimeType: 'video/mp4' }) })).status, 403);
  assert.strictEqual((await h.inbound({ fileId: 'abcdefghij1234', name: 'notes.pdf', mimeType: 'application/pdf', size: 10 })).status, 400);
  const r = await h.inbound({ fileId, name: 'North Ann water.mp4', mimeType: 'video/mp4', size: clip.bytes.length, by: '', subject: 'North Ann water', createdAt: new Date().toISOString() });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.waiting, true, 'the switch is off, so it waits');
  const again = await h.inbound({ fileId, name: 'North Ann water.mp4', mimeType: 'video/mp4', size: clip.bytes.length });
  assert.strictEqual(again.body.again, true, 'the same file is kept once');
  const rec = await until(() => { try { const f = fs.readdirSync(path.join(h.fx.dir, 'clips')).find(x => /\.json$/.test(x)); return f && h.read('clips/' + f); } catch (e) { return false; } }, 15000);
  assert.ok(rec && rec.status === 'waiting', 'the clip record is waiting');
  await wait(2500);
  assert.strictEqual(h.gem.seen.uploads.length, 0, 'nothing is sent to Gemini while the switch is off');
  // the educator receives the clip record, another educator does not
  const ann = (await h.fx.login('Ann', '1357')).token, bea = (await h.fx.login('Bea', '1357')).token;
  const dataOf = async tok => { const x = await fetch(h.fx.api + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:' + h.fx.web, Authorization: 'Bearer ' + tok }, body: '{}' }); return (await x.json()).data; };
  assert.ok(Object.keys((await dataOf(ann)).clips || {}).length === 1, 'Ann receives her clip record');
  assert.ok(Object.keys((await dataOf(bea)).clips || {}).length === 0, 'Bea does not');
  // the page may not write a clip record
  assert.strictEqual((await h.fx.as(h.dee, '/api/write', { op: 'set', kind: 'clips', id: 'vx', data: { id: 'vx' } })).status, 403);

  // the director turns Video clips on
  assert.strictEqual((await h.program({ videoClipsOn: true })).status, 200);
  const done = await until(() => { const d = h.read('clips/' + rec.id + '.json'); return d && d.status !== 'waiting' && d.status !== 'reading' && d; }, 60000);
  assert.ok(done, 'the clip was read'); assert.strictEqual(done.status, 'done', done.error || '');
  assert.strictEqual(done.educator, 'Ann');
  // the Gemini path, upload with the right size, polled until ACTIVE, read with the model set on Render, then deleted
  assert.strictEqual(h.gem.seen.uploads.length, 1); assert.strictEqual(h.gem.seen.uploads[0].got, clip.bytes.length); assert.strictEqual(h.gem.seen.uploads[0].type, 'video/mp4');
  assert.ok(h.gem.seen.polls >= 1, 'the file was polled'); assert.strictEqual(h.gem.seen.gens.length, 1); assert.strictEqual(h.gem.seen.gens[0].model, 'gemini-test-flash');
  assert.match(h.gem.seen.gens[0].prompt, /\[unclear\]/); assert.strictEqual(h.gem.seen.gens[0].meta, null, 'a short clip is not clipped');
  assert.deepStrictEqual(h.gem.seen.deletes, ['f1'], 'the upload is deleted from Gemini');
  // the draft
  const d = h.read('drafts/' + done.draftId + '.json'); assert.ok(d, 'the draft is in the records');
  assert.strictEqual(d.by, 'Ann'); assert.strictEqual(d.form.by, 'Ann'); assert.strictEqual(d.form.classroom, 'North');
  assert.strictEqual(d.form.wonder, '');
  const lines = d.form.noticed.split('\n');
  assert.deepStrictEqual(lines, ['At 0:01 a child pushes the long block under the water.', 'At 0:01 a child says, "Look, it is [unclear] sinking"', 'At 0:02 the educator says, "What do you notice?"', 'At 0:02 another child holds a cup over the tub.']);
  assert.deepStrictEqual({ fileId: d.form.clip.fileId, name: d.form.clip.name, id: d.form.clip.id }, { fileId, name: 'North Ann water.mp4', id: rec.id });
  assert.ok(!d.form.clip.error, 'no error on a read clip');
  // the stills, frames from ffmpeg when it is here, else the Drive thumbnail
  assert.ok(d.form.photo && d.form.photo.id, 'the draft has a photo');
  const stills = [d.form.photo, ...(d.form.siblings || []).map(s => s.photo)];
  if (clip.real && ffmpegBin()) { assert.strictEqual(stills.length, 2, 'two stills at the moments Gemini chose'); assert.ok(stills.every(p => /-clip-still-\d\.jpg$/.test(p.id) && p.w > 0), 'stills are kept as photos with their size'); assert.ok(!d.form.clip.note, 'no note when frames were taken'); }
  else { assert.strictEqual(stills.length, 1); assert.match(d.form.clip.note || '', /Drive thumbnail/); }
  assert.ok(h.drive.tree().some(p => /-clip-still-1\.jpg$/.test(p)), 'the still is kept in the TREE photos folder');
  assert.ok(!h.drive.tree().some(p => /\.bin$|clip-copy/.test(p)), 'no copy of the video is kept');
  assert.strictEqual(h.drive.node(fileId).bytes.length, clip.bytes.length, 'the clip stays in Drive as it was');
  if (stills.length > 1) assert.strictEqual(d.form.group, 'v' + rec.id, 'the stills share one group');
});

test('a clip over three minutes is clipped to the first three minutes, and a failed reading still leaves a draft with the clip', async t => {
  const h = await setup(t, { failFor: 'South Bea fall' }); const clip = makeClip();
  await h.program({ videoClipsOn: true });
  // a clip longer than three minutes, by the length the fake ffmpeg reports. ffmpeg is real, so the clip is two seconds and
  // the limit is tested on the reading's own helper instead
  const v = require('../video.js')({ store: { recs: { settings: new Map(), clips: new Map(), drafts: new Map() }, ready: true }, log: () => {}, drive: { on: () => false, ask: async () => ({}) }, keepOriginal: async () => {}, noteChange: () => {}, scheduleSave: () => {}, accountFor: () => null, readSubject: null, directors: () => [], photoSize: null });
  assert.strictEqual(v.LIMIT_S, 180);
  assert.match(v.noticedLines(v.parseAnswer('```json\n{"transcript":[{"t":200,"who":"child","words":"hi"}],"actions":[],"stills":[1]}\n```'), true), /\[Only the first three minutes of the clip were read\.\]$/);
  assert.strictEqual(v.noticedLines(v.parseAnswer('{"transcript":[{"t":5,"who":"Educator","words":"\\"Go on\\""}],"actions":[{"t":2,"what":"A child digs"}]}'), false), 'At 0:02 a child digs.\nAt 0:05 the educator says, "Go on"');
  // the failed reading
  const fileId = h.drive.addVideo('South Bea fall.mov', clip.bytes, 'video/quicktime');
  const r = await h.inbound({ fileId, name: 'South Bea fall.mov', mimeType: 'video/quicktime', size: clip.bytes.length, by: 'bea', subject: '', createdAt: new Date().toISOString() });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.waiting, false);
  const rec = await until(() => { const d = h.read('clips/' + r.body.id + '.json'); return d && d.status === 'failed' && d; }, 60000);
  assert.ok(rec, 'the clip is marked failed'); assert.match(rec.error, /Gemini answered 500/);
  assert.deepStrictEqual(h.gem.seen.deletes, ['f1'], 'the upload is still deleted');
  const d = h.read('drafts/' + rec.draftId + '.json'); assert.ok(d, 'a draft is still left');
  assert.strictEqual(d.by, 'Bea', 'named from the subject and the file name'); assert.strictEqual(d.form.classroom, 'South');
  assert.strictEqual(d.form.noticed, ''); assert.strictEqual(d.form.wonder, '');
  assert.match(d.form.clip.error, /could not be read/); assert.strictEqual(d.form.clip.fileId, fileId);
  assert.ok(d.form.photo && d.form.photo.id, 'stills still come, from the clip or the Drive thumbnail');
  // a clip nobody can be told for waits with the director
  const fileId2 = h.drive.addVideo('IMG_0042.mp4', clip.bytes, 'video/mp4');
  const r2 = await h.inbound({ fileId: fileId2, name: 'IMG_0042.mp4', mimeType: 'video/mp4', size: clip.bytes.length, by: '', subject: '', createdAt: new Date().toISOString() });
  const rec2 = await until(() => { const d = h.read('clips/' + r2.body.id + '.json'); return d && d.status === 'done' && d; }, 60000);
  assert.ok(rec2, 'read'); const d2 = h.read('drafts/' + rec2.draftId + '.json'); assert.strictEqual(d2.by, 'Dee'); assert.match(d2.form.clip.note, /could not tell which educator/);
});

test('without ffmpeg the still is the Drive thumbnail, and the draft says so', async t => {
  const h = await setup(t, { env: { TREE_NO_FFMPEG: '1' } }); const clip = makeClip();
  await h.program({ videoClipsOn: true });
  const fileId = h.drive.addVideo('West Ann blocks.mp4', clip.bytes, 'video/mp4');
  const r = await h.inbound({ fileId, name: 'West Ann blocks.mp4', mimeType: 'video/mp4', size: clip.bytes.length, createdAt: new Date().toISOString() });
  const rec = await until(() => { const d = h.read('clips/' + r.body.id + '.json'); return d && d.status === 'done' && d; }, 60000);
  assert.ok(rec, 'read'); const d = h.read('drafts/' + rec.draftId + '.json');
  assert.ok(d.form.photo && /-clip-still-1\.jpg$/.test(d.form.photo.id), 'one still, the thumbnail'); assert.ok(!d.form.siblings, 'no second still');
  assert.match(d.form.clip.note, /Drive thumbnail, since ffmpeg is not installed/);
  assert.strictEqual(d.form.classroom, 'West'); assert.strictEqual(d.by, 'Ann');
  assert.strictEqual(Buffer.compare(h.drive.file('TREE photos/' + d.form.photo.id), THUMB), 0, 'the thumbnail bytes are kept as the photo');
});

test('the page shows Watch the clip on the draft, the card and a Presenting agenda block, and the sheet plays from Drive', async t => {
  const b = await browser(); if (!b) { t.skip('Playwright is not installed here'); return; }
  const fileId = 'abcdefghij0123456789';
  const more = put => {
    put('drafts/dv1.json', { id: 'dv1', by: 'Ann', startedAt: Date.now(), updatedAt: Date.now(), queue: [], fromClip: 'v1', form: { id: 'nv1', noticed: 'At 0:01 a child says, "Look, it is [unclear] sinking"', wonder: '', classroom: 'North', by: 'Ann', at: Date.now(), week: '2026-11-02', projectId: '', threadId: '', clip: { id: 'v1', fileId, name: 'North Ann water.mp4', at: Date.now() } } });
    put('notices/nk1.json', { id: 'nk1', noticed: 'At 0:02 the educator says, "What do you notice?"', wonder: '', classroom: 'West', by: 'Ann', at: Date.now() - 36e5, week: '2026-11-02', clip: { id: 'v0', fileId, name: 'North Ann sand.mp4', at: Date.now() - 36e5 } });
  };
  const fx = await start({ more, env: { KAYMBU_INBOX_KEY: KEY } }); t.after(() => fx.stop());
  const dee = (await fx.login('Dee', 'director-pass-1')).token;
  const br = await b.launch(); t.after(() => br.close());
  const s = await signedIn(fx, br, 'Ann', '1357', 1100); t.after(() => s.close());
  await s.p.evaluate(() => goView('moments')); await s.p.waitForFunction(() => document.querySelector('[data-draftopen="dv1"]'), null, { timeout: 15000 });
  assert.ok(!(await s.p.$('[data-clipwatch]')), 'with Video clips off, no Watch button shows');
  // the director turns it on
  assert.strictEqual((await fx.as(dee, '/api/write', { op: 'update', kind: 'settings', id: 'program', patch: { videoClipsOn: true } })).status, 200);
  await s.p.waitForFunction(() => clipsOn(), null, { timeout: 20000 }); await s.p.evaluate(() => renderMain());
  await s.p.waitForFunction(() => document.querySelectorAll('[data-clipwatch]').length >= 2, null, { timeout: 15000 });
  const n = await s.p.$$eval('[data-clipwatch]', xs => xs.map(x => x.textContent.trim()));
  assert.ok(n.length >= 2 && n.every(x => x === 'Watch the clip'), 'the draft card and the kept observation card show Watch the clip, ' + JSON.stringify(n));
  // the draft opens with the button and the line about the clip, and the kept notice card has it too
  await s.p.click('[data-draftopen="dv1"]'); await s.p.waitForSelector('#nf-card', { timeout: 15000 });
  assert.match(await s.p.$eval('#nf-card', el => el.innerText), /From the clip North Ann water\.mp4/);
  assert.strictEqual(await s.p.inputValue('#nf-wonder'), '');
  await s.p.click('#nf-card [data-clipwatch]'); await s.p.waitForSelector('#clipsheet iframe', { timeout: 10000 });
  assert.strictEqual(await s.p.$eval('#clipsheet iframe', f => f.getAttribute('src')), 'https://drive.google.com/file/d/' + fileId + '/preview');
  assert.match(await s.p.$eval('#clipsheet', el => el.innerText), /Plays from the school's Drive for signed-in school accounts/);
  await s.p.click('#clipclose'); assert.ok(!(await s.p.$('#clipsheet')), 'the sheet closes');
  // Today carries it on the kept observation
  await s.p.evaluate(() => goView('today')); await s.p.waitForSelector('.todayobs [data-clipwatch]', { timeout: 15000 });
  // an agenda block, here the class team meeting's, with a Drive link that is kept as the file id, shown with Watch. The prints build their text from each block's title and words, so the clip never reaches them
  const list = (await fx.as(dee, '/api/staff/g/pd/list')).body; const tm = (list.team || []).filter(x => x.room === 'West').sort((x, y) => x.date.localeCompare(y.date))[0];
  assert.ok(tm, 'a West team meeting is listed');
  const sv = await fx.as(dee, '/api/staff/g/pd/save', { agenda: { date: tm.date, kind: 'team', room: 'West', title: 'Team meeting', blocks: [{ title: 'Watching the water table', why: 'What children try.', clip: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing' }] } });
  assert.strictEqual(sv.status, 200, JSON.stringify(sv.body)); assert.strictEqual(sv.body.agenda.blocks[0].clip, fileId, 'the Drive link is kept as the file id');
  await s.p.evaluate(() => goView('stpdd')); await s.p.waitForFunction(() => document.querySelector('[data-gpd]'), null, { timeout: 20000 });
  await s.p.evaluate(id => { const x = [...document.querySelectorAll('[data-gpd]')].find(b => b.dataset.gpd === id); if (x) x.click(); }, tm.id);
  await s.p.waitForFunction(() => /Watching the water table/.test(document.getElementById('main').innerText), null, { timeout: 20000 });
  await s.p.waitForSelector('#main [data-clipwatch="' + fileId + '"]', { timeout: 10000 });
  await s.p.click('#main [data-clipwatch="' + fileId + '"]'); await s.p.waitForSelector('#clipsheet iframe', { timeout: 10000 }); await s.p.click('#clipclose');
  assert.deepStrictEqual(s.errors, []);
});

test('Send a clip from inside TREE comes in pieces, is kept in Drive as a smaller copy and leaves the educator a draft', async t => {
  const h = await setup(t); const clip = makeClip();
  const ann = (await h.fx.login('Ann', '1357')).token;
  const send = b => h.fx.as(ann, '/api/clip-send', b);
  // while the switch is off nothing is taken
  assert.strictEqual((await send({ step: 'start', name: 'IMG_1.MOV', type: 'video/quicktime', size: clip.bytes.length })).status, 400);
  await h.program({ videoClipsOn: true });
  assert.strictEqual((await send({ step: 'start', name: 'notes.pdf', type: 'application/pdf', size: 10 })).status, 400, 'only a video is taken');
  const st = (await send({ step: 'start', name: 'IMG_1.MOV', type: 'video/quicktime', size: clip.bytes.length })).body;
  assert.ok(st.id && st.piece > 0);
  for (let k = 0; k < st.pieces; k++) {
    const r = await send({ step: 'piece', id: st.id, k, data: clip.bytes.subarray(k * st.piece, (k + 1) * st.piece).toString('base64') });
    assert.strictEqual(r.status, 200);
    if (k === 0) assert.strictEqual((await send({ step: 'piece', id: st.id, k, data: clip.bytes.subarray(0, st.piece).toString('base64') })).body.next, 1, 'a piece sent twice is kept once');
  }
  const bea = (await h.fx.login('Bea', '1357')).token;
  assert.strictEqual((await h.fx.as(bea, '/api/clip-send', { step: 'done', id: st.id })).status, 400, 'another educator cannot finish it');
  const done = await send({ step: 'done', id: st.id });
  assert.strictEqual(done.status, 200);
  const rec = await until(() => { const r = h.read('clips/' + done.body.id + '.json'); return r && r.status === 'done' && r; }, 60000);
  assert.ok(rec, 'the clip was read');
  assert.ok(rec.fileId, 'the copy is kept in Drive');
  assert.match(rec.name, /Ann clip/);
  const d = h.read('drafts/' + rec.draftId + '.json'); assert.ok(d, 'a draft is left');
  assert.strictEqual(d.by, 'Ann');
});
