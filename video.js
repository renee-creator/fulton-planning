'use strict';
/* Video clips into draft observations.
   An educator records a clip of up to three minutes on the class phone and drops it in the Video folder of the TREE
   mailbox's Drive, or emails it to the TREE address with the class and their first name in the subject. The mailbox's
   Apps Script (tools/kaymbu-apps-script.gs) tells this inbox about each clip once. When the director has turned on
   Video clips in Settings, TREE fetches the clip's bytes from the script in pieces, sends them once to Google's Gemini
   API, which reads video with its sound, and asks for the children's exact words and what each child did with which
   materials, in order, as plain JSON. From that it leaves the educator a draft observation, never a kept one, with the
   words and actions as readable lines in What I noticed, What I wonder empty, two or three still frames as its photos,
   and the clip to watch from Drive. The educator trims, adds the wondering, tags the children and keeps it. The clip
   stays in Drive. TREE keeps no copy of the video, only the draft and the stills. The file sent to Gemini is deleted
   as soon as it has been read.

   Render settings
     GEMINI_API_KEY    a key from Google AI Studio on the paid tier, made under the school's Google account
     GEMINI_MODEL      optional, the model that reads the clip. gemini-3.5-flash-lite unless set.
     GEMINI_API_BASE   optional, for the tests. https://generativelanguage.googleapis.com unless set.
   The clip bytes come through DRIVE_PHOTOS_URL with KAYMBU_INBOX_KEY, the same web app that keeps TREE's photos. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

module.exports = function video({ store, log, drive, keepOriginal, noteChange, scheduleSave, accountFor, readSubject, directors, photoSize, isDirector }) {
  const KEY = () => String(process.env.GEMINI_API_KEY || '').trim();
  const MODEL = () => String(process.env.GEMINI_MODEL || '').trim() || 'gemini-3.5-flash-lite';
  const BASE = () => String(process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const LIMIT_S = 180;                       // only the first three minutes of a clip are read
  const MAX_BYTES = 1536 * 1024 * 1024;      // a clip larger than this is not fetched at all
  const FILE_ID = /^[A-Za-z0-9_-]{10,}$/;
  const TYPES = /^video\/(mp4|quicktime|x-m4v|webm|3gpp|mpeg|x-msvideo)$/i;
  const TMP = path.join(os.tmpdir(), 'tree-clips');
  const nameKey = n => String(n || '').normalize('NFKC').replace(/\./g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
  const laDay = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  const mondayOf = day => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
  const mmss = t => { t = Math.max(0, Math.round(Number(t) || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  // the director's switch in Settings, Video clips. Off until she turns it on.
  const on = () => { const r = store.recs.settings.get('program'); const d = r && !r.deleted && r.doc; return !!(d && d.videoClipsOn); };
  const ready = () => !!(KEY() && drive.on());

  // ffmpeg, from the ffmpeg-static package when npm installed it, or on the path, or nowhere
  let ffmpegBin = null;
  try { ffmpegBin = require('ffmpeg-static'); if (ffmpegBin && !fs.existsSync(ffmpegBin)) ffmpegBin = null; } catch (e) { ffmpegBin = null; }
  if (!ffmpegBin) { for (const p of ['/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']) if (fs.existsSync(p)) { ffmpegBin = p; break; } }
  if (process.env.TREE_NO_FFMPEG) ffmpegBin = null;   // the tests check the Drive thumbnail fallback this way
  function ffmpeg(args, timeout = 60000) {
    return new Promise((resolve, reject) => {
      if (!ffmpegBin) { reject(new Error('ffmpeg is not installed')); return; }
      const p = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] }); const out = [], err = [];
      p.stdout.on('data', c => out.push(c)); p.stderr.on('data', c => { if (err.length < 400) err.push(c); });
      const t = setTimeout(() => p.kill('SIGKILL'), timeout);
      p.on('error', e => { clearTimeout(t); reject(e); });
      p.on('close', code => { clearTimeout(t); resolve({ code, out: Buffer.concat(out), err: Buffer.concat(err).toString('utf8') }); });
    });
  }
  // the clip's length in seconds, read from what ffmpeg prints about it
  async function duration(file) {
    try { const r = await ffmpeg(['-hide_banner', '-i', file], 20000); const m = r.err.match(/Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/); return m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 0; } catch (e) { return 0; }
  }
  async function frameAt(file, t) {
    const r = await ffmpeg(['-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, t)), '-i', file, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', '-f', 'image2', 'pipe:1'], 60000);
    if (r.code !== 0 || r.out.length < 1000) throw new Error('ffmpeg could not take a frame at ' + mmss(t) + (r.err ? '. ' + r.err.trim().split('\n').pop() : ''));
    return r.out;
  }

  /* ---------- the clip's bytes, from the mailbox script in pieces of 4 MB, to a file on disk ---------- */
  async function fetchClip(rec) {
    fs.mkdirSync(TMP, { recursive: true });
    const file = path.join(TMP, rec.id + '.bin');
    const info = await drive.ask({ op: 'video-info', id: rec.fileId }, 60000);
    const size = Number(info.size) || 0; if (!size) throw new Error('Drive says the clip is empty');
    if (size > MAX_BYTES) throw new Error('The clip is ' + Math.round(size / 1048576) + ' MB, more than TREE reads');
    const parts = Number(info.parts) || Math.ceil(size / (4 * 1024 * 1024));
    const fd = fs.openSync(file, 'w'); let got = 0;
    try {
      for (let k = 0; k < parts; k++) {
        let piece = null, last = null;
        for (let tries = 0; tries < 3 && !piece; tries++) {
          if (tries) await new Promise(ok => setTimeout(ok, 1500 * tries));
          try { const j = await drive.ask({ op: 'video-get', id: rec.fileId, part: k }, 120000); if (!j.data) throw new Error('Drive sent no bytes for piece ' + (k + 1)); piece = Buffer.from(j.data, 'base64'); } catch (e) { last = e; }
        }
        if (!piece) throw last;
        fs.writeSync(fd, piece); got += piece.length;
      }
    } finally { fs.closeSync(fd); }
    if (got !== size) throw new Error('The clip came through short, ' + got + ' of ' + size + ' bytes');
    return { file, size, type: String(info.type || rec.mimeType || 'video/mp4'), name: String(info.name || rec.name || '') };
  }

  /* ---------- Gemini's Files API, the resumable upload, the wait until the file is ACTIVE, the reading, the delete ---------- */
  async function gemini(method, url, headers, body) {
    const r = await fetch(url, Object.assign({ method, headers: Object.assign({ 'x-goog-api-key': KEY() }, headers || {}) }, body !== undefined ? { body } : {}, body && typeof body.pipe === 'function' ? { duplex: 'half' } : {}));
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {}
    return { status: r.status, headers: r.headers, json: j, text };
  }
  async function uploadToGemini(file, size, type, name) {
    const start = await gemini('POST', BASE() + '/upload/v1beta/files', { 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(size), 'X-Goog-Upload-Header-Content-Type': type, 'Content-Type': 'application/json' }, JSON.stringify({ file: { display_name: name.slice(0, 80) || 'clip' } }));
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (start.status !== 200 || !uploadUrl) throw new Error('Gemini would not start the upload, ' + start.status + ' ' + start.text.slice(0, 200));
    const up = await gemini('POST', uploadUrl, { 'Content-Length': String(size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, fs.createReadStream(file));
    const f = up.json && up.json.file;
    if (up.status !== 200 || !f || !f.name) throw new Error('Gemini did not take the upload, ' + up.status + ' ' + up.text.slice(0, 200));
    // the file is read by Google for a moment before it can be used
    let state = f.state || 'PROCESSING', uri = f.uri;
    for (let k = 0; k < 90 && state === 'PROCESSING'; k++) {
      await new Promise(ok => setTimeout(ok, k < 5 ? 2000 : 5000));
      const g = await gemini('GET', BASE() + '/v1beta/' + f.name);
      if (g.status !== 200 || !g.json) throw new Error('Gemini lost the upload, ' + g.status);
      state = g.json.state || 'PROCESSING'; uri = g.json.uri || uri;
    }
    if (state !== 'ACTIVE') throw new Error('Gemini could not process the clip, state ' + state);
    return { name: f.name, uri, type: f.mimeType || type };
  }
  async function deleteFromGemini(name) {
    try { const d = await gemini('DELETE', BASE() + '/v1beta/' + name); if (d.status !== 200 && d.status !== 204 && d.status !== 404) log('The clip could not be deleted from Gemini yet', name, d.status); return d.status === 200 || d.status === 204 || d.status === 404; }
    catch (e) { log('The clip could not be deleted from Gemini yet', name, e.message); return false; }
  }

  const PROMPT = (over) => `You are watching a short clip from a Reggio-inspired preschool classroom, with its sound. An educator will use what you give back as the start of an observation, so give back only what the clip makes plain, with no interpretation, no praise and no guessing.
Give back one JSON object and nothing else, in this shape
{"transcript":[{"t":0,"who":"a child","words":"exact words"}],"actions":[{"t":0,"what":"one plain sentence"}],"place":"","stills":[0,0,0]}
Rules
- transcript holds everything said, in order, with t the seconds from the start of the clip, who only as the clip makes plain (a child, another child, the educator, an adult), and words exactly as heard. Mark any word you are not sure of as [unclear], such as "I made a [unclear] bridge". Never write a name unless it is spoken in the clip, and then write it as heard.
- actions holds what each child did with which materials, in order, with t the seconds, one plain sentence each in the present tense, such as "A child pushes the long block under the water". Say what is seen, not why.
- place is one or two words for where this happens if it is plain, such as sand area or the water table, else an empty string.
- stills is two or three moments, in seconds, where a frame would show the children at work with the materials.
- Keep t within the clip. Do not add anything the clip does not hold.${over ? '\n- Only the first three minutes of this clip are being read, so stay within them.' : ''}`;

  // Gemini answers with a JSON object, sometimes wrapped in a code fence
  function parseAnswer(text) {
    let s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('Gemini gave no JSON back');
    const j = JSON.parse(s.slice(a, b + 1));
    const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0; };
    const line = v => String(v || '').replace(/\s+/g, ' ').trim();
    return { transcript: (Array.isArray(j.transcript) ? j.transcript : []).map(x => x && { t: num(x.t), who: line(x.who).toLowerCase() || 'a child', words: line(x.words) }).filter(x => x && x.words).slice(0, 400),
      actions: (Array.isArray(j.actions) ? j.actions : []).map(x => x && { t: num(x.t), what: line(x.what) }).filter(x => x && x.what).slice(0, 200),
      place: line(j.place).slice(0, 60), stills: (Array.isArray(j.stills) ? j.stills : []).map(num).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3) };
  }
  async function readWithGemini(up, over, secs) {
    const part = { file_data: { file_uri: up.uri, mime_type: up.type } };
    if (over) part.video_metadata = { start_offset: '0s', end_offset: LIMIT_S + 's' };
    const body = { contents: [{ role: 'user', parts: [part, { text: PROMPT(over) }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' } };
    const r = await gemini('POST', BASE() + '/v1beta/models/' + encodeURIComponent(MODEL()) + ':generateContent', { 'Content-Type': 'application/json' }, JSON.stringify(body));
    if (r.status !== 200 || !r.json) throw new Error('Gemini answered ' + r.status + ' ' + r.text.slice(0, 200));
    const text = (((r.json.candidates || [])[0] || {}).content || {}).parts ? r.json.candidates[0].content.parts.map(p => p.text || '').join('') : '';
    const used = r.json.usageMetadata || {};
    const out = parseAnswer(text);
    const cap = secs ? Math.min(secs, LIMIT_S) : LIMIT_S;
    out.transcript = out.transcript.filter(x => x.t <= cap + 1); out.actions = out.actions.filter(x => x.t <= cap + 1); out.stills = out.stills.filter(t => t <= cap);
    return Object.assign(out, { tokens: { in: used.promptTokenCount || 0, out: used.candidatesTokenCount || 0 } });
  }

  /* ---------- the draft observation ---------- */
  // the words of What I noticed, one readable line a moment, in the order they happened
  function noticedLines(read, over) {
    const who = w => { w = String(w || 'a child').replace(/^the\s+/, ''); return /^(a |an |another |the )/.test(w) ? w : /educator|adult|teacher/.test(w) ? 'the ' + w.replace(/teacher/g, 'educator') : 'a ' + w; };
    const items = [...read.transcript.map(x => ({ t: x.t, line: `At ${mmss(x.t)} ${who(x.who)} says, "${x.words.replace(/^"|"$/g, '')}"` })), ...read.actions.map(x => ({ t: x.t, line: `At ${mmss(x.t)} ${x.what.replace(/\.$/, '').replace(/^([A-Z])(?=[a-z ])/, c => c.toLowerCase())}.` }))];
    items.sort((a, b) => a.t - b.t);
    const lines = items.map(x => x.line);
    if (over) lines.push('[Only the first three minutes of the clip were read.]');
    return lines.join('\n');
  }
  function educatorFor(rec) {
    const sub = readSubject ? readSubject([rec.subject, String(rec.name || '').replace(/\.[a-z0-9]+$/i, '')].filter(Boolean).join(' ')) : { room: '', rooms: [], smallGroup: '', educator: '', projectId: '', threadId: '' };
    let by = sub.educator || '';
    if (!by && rec.by) { const a = accountFor(String(rec.by).trim().split(/\s+/)[0]); if (a) by = a.name; }
    let fallback = false;
    if (!by) { const ds = directors(); by = ds[0] || ''; fallback = !!by; }
    const acct = by ? accountFor(by) : null;
    const room = sub.room || rec.room || (acct && acct.room ? String(acct.room) : '');
    return { by, room, rooms: sub.rooms || [], smallGroup: sub.smallGroup || '', projectId: sub.projectId || '', threadId: sub.threadId || '', fallback };
  }
  async function keepStill(rec, buf, i) {
    const id = crypto.randomBytes(6).toString('hex') + '-clip-still-' + (i + 1) + '.jpg';
    await keepOriginal(id, buf, 'image/jpeg', 'A still frame from a video clip');
    const d = photoSize ? photoSize(buf) : null;
    return Object.assign({ id }, d && d.w ? { w: d.w, h: d.h } : {});
  }
  // two or three still frames at the moments Gemini chose, else at even steps through the clip, else the Drive thumbnail
  async function stillsFor(rec, clip, read, secs) {
    const out = []; let note = '';
    const cap = secs ? Math.min(secs, LIMIT_S) : LIMIT_S;
    let times = (read ? read.stills : []).filter(t => t >= 0 && t <= cap);
    if (times.length < 2) { const n = Math.max(2, times.length); const span = secs ? Math.min(secs, LIMIT_S) : 60; times = [...new Set([...times, ...[1, 2, 3].slice(0, 3 - times.length).map(k => Math.round(span * k / 4))])].slice(0, 3); }
    if (clip && ffmpegBin) {
      for (const [i, t] of times.entries()) { try { out.push(await keepStill(rec, await frameAt(clip.file, t), i)); } catch (e) { log('A still could not be taken from the clip', rec.id, e.message); } }
    }
    if (!out.length) {
      try { const j = await drive.ask({ op: 'video-thumb', id: rec.fileId }, 60000); if (j.data) { out.push(await keepStill(rec, Buffer.from(j.data, 'base64'), 0)); note = ffmpegBin ? 'The still is the Drive thumbnail, since frames could not be taken from the clip.' : 'The still is the Drive thumbnail, since ffmpeg is not installed on the server.'; } }
      catch (e) { log('The Drive thumbnail could not be fetched for the clip', rec.id, e.message); }
    }
    if (!out.length) note = 'No still frames could be taken from this clip, so the draft has no photos. Add one if you have it.';
    return { stills: out, note };
  }
  function makeDraft(rec, who, noticed, stills, clipNote, read, error) {
    const at = Date.parse(rec.createdAt) || rec.at || Date.now(); const day = laDay(at);
    const nid = 'n' + at.toString(36) + crypto.randomBytes(3).toString('hex');
    const group = stills.length > 1 ? 'v' + rec.id : '';
    const clip = { id: rec.id, fileId: rec.fileId, name: String(rec.name || ''), at, ...(clipNote ? { note: clipNote } : {}), ...(error ? { error } : {}) };
    // a clip from Kaymbu brings the children tagged in it there, and its Kaymbu mark, so it is never brought in twice
    const kids = Array.isArray(rec.children) ? rec.children.filter(Boolean) : [];
    const base = { noticed, wonder: '', ...(kids.length ? { children: kids } : {}), ...(rec.kaymbu ? { kaymbu: rec.kaymbu } : {}), classroom: who.room, ...(who.rooms.length > 1 ? { classrooms: who.rooms } : {}), ...(who.smallGroup ? { smallGroup: who.smallGroup } : {}), by: who.by, at, week: mondayOf(day), projectId: who.projectId, threadId: who.threadId, ...(group ? { group } : {}) };
    const form = Object.assign({ id: nid }, base, stills[0] ? { photo: stills[0] } : {}, { clip });
    if (stills.length > 1) form.siblings = stills.slice(1).map((ph, i) => Object.assign({ id: nid + 's' + (i + 1) }, base, { noticed: '', photo: ph, at: at + i + 1 }));
    const id = 'dv' + rec.id;
    const doc = { id, by: who.by, startedAt: Date.now(), updatedAt: Date.now(), queue: [], form, fromClip: rec.id };
    store.recs.drafts.set(id, { doc, path: `drafts/${id}.json`, local: true }); noteChange('drafts', id); scheduleSave('drafts', id);
    return id;
  }
  function saveRec(rec) { store.recs.clips.set(rec.id, { doc: rec, path: `clips/${rec.id}.json`, local: true }); noteChange('clips', rec.id); scheduleSave('clips', rec.id); }

  /* ---------- reading one clip, start to finish ---------- */
  async function readClip(rec) {
    const t0 = Date.now(); let clip = null, up = null, read = null, secs = 0, who = educatorFor(rec); let draftId = '';
    rec.status = 'reading'; rec.readAt = Date.now(); rec.educator = who.by; saveRec(rec);
    try {
      clip = await fetchClip(rec);
      secs = await duration(clip.file);
      const over = secs > LIMIT_S + 1;
      up = await uploadToGemini(clip.file, clip.size, clip.type, clip.name);
      read = await readWithGemini(up, over, secs);
      const st = await stillsFor(rec, clip, read, secs);
      const noticed = noticedLines(read, over);
      draftId = makeDraft(rec, who, noticed, st.stills, [st.note, who.fallback ? (rec.sent === 'kaymbu' ? 'Kaymbu does not say which educator took this clip, so it waits with the director. Choose the educator in Kept by.' : 'TREE could not tell which educator this clip is for, so it waits with the director. Name the class and the educator in the file name or the email subject next time, such as North Ann.') : ''].filter(Boolean).join(' '), read, '');
      Object.assign(rec, { status: 'done', draftId, doneAt: Date.now(), seconds: Math.round(secs), over, counts: { words: read.transcript.length, actions: read.actions.length, stills: st.stills.length }, tokens: read.tokens }); delete rec.error; saveRec(rec);
      log(`Clip ${rec.name || rec.id} read for ${who.by}: ${read.transcript.length} things said, ${read.actions.length} actions, ${st.stills.length} stills, ${Math.round(secs)} seconds${over ? ', first three minutes only' : ''}, ${read.tokens.in} tokens in and ${read.tokens.out} out, ${Math.round((Date.now() - t0) / 1000)} s`);
    } catch (e) {
      const why = String(e && e.message || e).slice(0, 300);
      log('A clip could not be read', rec.name || rec.id, why);
      // the draft still comes, so the educator can watch the clip and write the observation by hand
      let st = { stills: [], note: '' };
      try { st = await stillsFor(rec, clip, read, secs); } catch (x) {}
      try { draftId = makeDraft(rec, who, '', st.stills, [st.note].filter(Boolean).join(' '), read, 'The clip could not be read, so this draft is empty. Watch the clip and write what you noticed. ' + why); } catch (x) { log('The draft for a failed clip could not be made', rec.id, x.message); }
      Object.assign(rec, { status: 'failed', error: why, failedAt: Date.now(), tries: (rec.tries || 0) + 1, ...(draftId ? { draftId } : {}) }); saveRec(rec);
    } finally {
      if (up) await deleteFromGemini(up.name);
      if (clip) { try { fs.unlinkSync(clip.file); } catch (e) {} }
    }
  }

  // clips wait in the order they came, one read at a time, only while the switch is on
  let busy = false, timer = null;
  const waiting = () => [...store.recs.clips.values()].filter(r => !r.deleted && r.doc && (r.doc.status === 'waiting' || (r.doc.status === 'reading' && Date.now() - (r.doc.readAt || 0) > 30 * 60e3))).map(r => r.doc).sort((a, b) => (a.at || 0) - (b.at || 0));
  async function run() {
    if (busy || !store.ready || !on()) return;
    if (!ready()) { if (waiting().length) log('Clips wait,', !KEY() ? 'GEMINI_API_KEY is not set on Render' : 'DRIVE_PHOTOS_URL is not set on Render'); return; }
    busy = true;
    try { for (const rec of waiting()) { if (!on()) break; await readClip(rec); } }
    finally { busy = false; }
  }
  function kick() { clearTimeout(timer); timer = setTimeout(() => run().catch(e => log('The clip reading stopped', e.message)), 800); timer.unref(); }
  setInterval(() => { if (waiting().length) kick(); }, 10 * 60e3).unref();

  /* ---------- the inbox, called by the mailbox script with the key ---------- */
  function handle(body, reply) {
    const fileId = String(body.fileId || '').trim(), type = String(body.mimeType || '').trim().toLowerCase(), name = String(body.name || '').slice(0, 200);
    if (!FILE_ID.test(fileId)) { reply(400, { error: 'The clip has no Drive file id.' }); return; }
    if (!(TYPES.test(type) || /\.(mp4|mov|m4v|webm|3gp|mpeg|mpg|avi)$/i.test(name))) { log('Clip refused, not a video', name, type); reply(400, { error: 'That file is not a video TREE reads.' }); return; }
    const size = Number(body.size) || 0;
    if (size > MAX_BYTES) { log('Clip refused, too large', name, size); reply(400, { error: 'That clip is larger than TREE reads. Keep clips to three minutes.' }); return; }
    const have = [...store.recs.clips.values()].find(r => !r.deleted && r.doc && r.doc.fileId === fileId);
    if (have) { reply(200, { ok: true, again: true, id: have.doc.id, status: have.doc.status }); return; }
    const rec = { id: 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), fileId, name, mimeType: type, size, by: String(body.by || '').slice(0, 60), subject: String(body.subject || '').slice(0, 200), createdAt: String(body.createdAt || '').slice(0, 40), at: Date.now(), status: 'waiting' };
    // the educator it is for is named now, so her TREE receives the record while it waits
    try { rec.educator = educatorFor(rec).by; } catch (e) { rec.educator = ''; }
    saveRec(rec);
    log(`Clip arrived from the mailbox, ${name || fileId}, ${Math.round(size / 1048576)} MB${on() ? '' : ', waiting until Video clips is turned on'}`);
    if (on()) kick();
    reply(200, { ok: true, id: rec.id, waiting: !on() });
  }

  /* ---------- Send a clip from inside TREE ----------
     An educator picks a clip from the phone's photo library in TREE, and it comes to this server in pieces, with no Google
     sign-in or Drive sharing on the phone. The server makes a smaller copy of the first three minutes, about 480 pixels
     tall, keeps that copy in the TREE Drive through the mailbox script, lets signed-in school accounts watch it, and then
     reads it into a draft observation the same way as a clip from the Video folder or the TREE address. The full clip
     never leaves the phone's library and is deleted from this server as soon as the smaller copy is made. */
  const UP_PIECE = 3 * 1024 * 1024;          // raw bytes in one piece, about 4 MB once written as text
  const UP_DIR = path.join(TMP, 'up');
  const uploads = new Map();                 // id -> { file, size, got, next, by, name, type, at }
  const SMALL_MAX = 30 * 1024 * 1024;        // the largest copy the mailbox script is sent in one request
  setInterval(() => { for (const [id, u] of uploads) if (Date.now() - u.at > 60 * 60e3) { try { fs.unlinkSync(u.file); } catch (e) {} uploads.delete(id); } }, 10 * 60e3).unref();
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
  async function smallCopy(src) {
    const out = src + '.mp4';
    const r = await ffmpeg(['-hide_banner', '-y', '-i', src, '-t', String(LIMIT_S), '-vf', 'scale=-2:min(480\\,ih)', '-c:v', 'libx264', '-preset', 'veryfast',
      '-b:v', '700k', '-maxrate', '900k', '-bufsize', '1400k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart', out], 15 * 60e3);
    if (r.code !== 0 || !fs.existsSync(out)) throw new Error('The smaller copy could not be made. ' + r.err.slice(-200));
    return out;
  }
  async function prepare(u, rec) {
    let small = null;
    try {
      let file = u.file, type = u.type;
      if (ffmpegBin) { small = await smallCopy(u.file); file = small; type = 'video/mp4'; }
      const size = fs.statSync(file).size;
      if (size > SMALL_MAX) throw new Error('The clip is too large to keep in Drive. Keep clips to three minutes.');
      const put = await drive.ask({ op: 'put', name: rec.name, type, data: fs.readFileSync(file).toString('base64') }, 10 * 60e3);
      if (!put || !put.id) throw new Error((put && put.error) || 'Drive did not keep the clip');
      try { await drive.ask({ op: 'video-share', id: put.id }, 60000); } catch (e) { log('A sent clip could not be shared with school accounts', e.message); }
      Object.assign(rec, { fileId: put.id, size, mimeType: type, status: 'waiting', at: Date.now() }); saveRec(rec);
      log(`Clip sent from TREE by ${rec.by}, ${Math.round(u.size / 1048576)} MB, kept in Drive at ${Math.round(size / 1048576)} MB`);
      if (on()) kick();
    } catch (e) {
      const why = String(e && e.message || e).slice(0, 300);
      log('A clip sent from TREE could not be kept', rec.by, why);
      Object.assign(rec, { status: 'failed', error: why, failedAt: Date.now() }); saveRec(rec);
    } finally {
      for (const f of [u.file, small]) if (f) { try { fs.unlinkSync(f); } catch (e) {} }
    }
  }
  // start, piece and done. Answers what the phone needs next.
  function upload(me, body) {
    if (!on()) return { error: 'Video clips are turned off. The director turns them on in Settings.' };
    if (!drive.on()) return { error: 'Google Drive is not set up for TREE yet, so clips cannot be kept.' };
    const step = String(body.step || '');
    if (step === 'start') {
      const size = Number(body.size) || 0, type = String(body.type || '').toLowerCase(), name = String(body.name || '').slice(0, 200);
      if (!(TYPES.test(type) || /\.(mp4|mov|m4v|webm|3gp|mpeg|mpg|avi)$/i.test(name))) return { error: 'That file is not a video.' };
      if (!size) return { error: 'That clip is empty.' };
      if (size > MAX_BYTES) return { error: 'That clip is too large. Keep clips to three minutes.' };
      fs.mkdirSync(UP_DIR, { recursive: true });
      const id = 'u' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
      const file = path.join(UP_DIR, id + '.bin'); fs.writeFileSync(file, Buffer.alloc(0));
      uploads.set(id, { file, size, got: 0, next: 0, by: me, name, type: type || 'video/mp4', at: Date.now() });
      return { id, piece: UP_PIECE, pieces: Math.ceil(size / UP_PIECE) };
    }
    const u = uploads.get(String(body.id || ''));
    if (!u || u.by !== me) return { error: 'That clip is no longer being sent. Try sending it again.' };
    u.at = Date.now();
    if (step === 'piece') {
      const k = Number(body.k);
      if (k < u.next) return { got: u.got, next: u.next };                 // a piece sent twice is kept once
      if (k !== u.next) return { error: 'A piece of the clip came out of order. Try sending it again.' };
      const buf = Buffer.from(String(body.data || ''), 'base64');
      if (!buf.length || buf.length > UP_PIECE || u.got + buf.length > u.size) return { error: 'A piece of the clip did not come through. Try sending it again.' };
      fs.appendFileSync(u.file, buf); u.got += buf.length; u.next++;
      return { got: u.got, next: u.next };
    }
    if (step === 'done') {
      if (u.got !== u.size) return { error: 'Part of the clip is missing. Try sending it again.' };
      uploads.delete(String(body.id));
      const acct = accountFor(me), room = acct && acct.room ? String(acct.room) : '';
      const day = laDay(Date.now());
      const name = [room, firstName(me), 'clip', day].filter(Boolean).join(' ') + '.mp4';
      const rec = { id: 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), fileId: '', name, mimeType: 'video/mp4', size: u.size, by: firstName(me), subject: '', createdAt: new Date().toISOString(), at: Date.now(), status: 'preparing', sent: 'tree', educator: me };
      saveRec(rec);
      prepare(u, rec);
      return { ok: true, id: rec.id };
    }
    return { error: 'Unknown step.' };
  }

  /* ---------- a video Moment brought in straight from Kaymbu ----------
     Kaymbu keeps its own copy of each video. TREE fetches it once, keeps it in the TREE Drive like a clip sent from TREE,
     and reads it into a draft observation with the children tagged in Kaymbu. It waits, like every clip, until Video
     clips is turned on. A video already brought in is never brought in again. */
  const KAYMBU_HOST = /^d[a-z0-9]+\.cloudfront\.net$/i;
  function download(url, file, hops = 0) {
    return new Promise((resolve, reject) => {
      let u; try { u = new URL(url); } catch (e) { reject(new Error('bad address')); return; }
      if (u.protocol !== 'https:' || !KAYMBU_HOST.test(u.hostname)) { reject(new Error('not a Kaymbu address')); return; }
      const req = require('https').get(u, { headers: { 'User-Agent': 'TREE' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) { res.resume(); resolve(download(new URL(res.headers.location, u).href, file, hops + 1)); return; }
        if (res.statusCode !== 200) { res.resume(); reject(new Error('Kaymbu answered ' + res.statusCode + ' for the video')); return; }
        const out = fs.createWriteStream(file); let size = 0;
        res.on('data', c => { size += c.length; if (size > MAX_BYTES) req.destroy(new Error('The video is larger than TREE reads')); });
        res.pipe(out); out.on('finish', () => resolve(size)); out.on('error', reject); res.on('error', reject);
      });
      req.setTimeout(120000, () => req.destroy(new Error('Kaymbu did not send the video in time')));
      req.on('error', reject);
    });
  }
  async function fromKaymbu(v) {
    const key = v && v.kaymbu && v.kaymbu.key;
    if (!key) throw new Error('The video has no Kaymbu mark');
    const have = [...store.recs.clips.values()].find(r => !r.deleted && r.doc && r.doc.kaymbu && r.doc.kaymbu.key === key);
    if (have) return have.doc.id;
    if (!drive.on()) throw new Error('Google Drive is not set up for TREE yet, so videos cannot be kept');
    fs.mkdirSync(UP_DIR, { recursive: true });
    const id = 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const file = path.join(UP_DIR, id + '.bin');
    let size = 0;
    try { size = await download(v.url, file); } catch (e) { try { fs.unlinkSync(file); } catch (x) {} throw e; }
    const at = Number(v.at) || Date.now();
    const rec = { id, fileId: '', name: String(v.name || 'Kaymbu video').slice(0, 200), mimeType: 'video/mp4', size, by: firstName(v.by), subject: String(v.room || ''), room: String(v.room || ''),
      createdAt: new Date(at).toISOString(), at: Date.now(), status: 'preparing', sent: 'kaymbu', educator: String(v.by || ''),
      children: Array.isArray(v.children) ? v.children.filter(Boolean) : [], kaymbu: v.kaymbu };
    saveRec(rec);
    await prepare({ file, size, type: 'video/mp4' }, rec);
    return id;
  }

  // the director's Settings line
  function status() {
    const all = [...store.recs.clips.values()].filter(r => !r.deleted && r.doc).map(r => r.doc);
    return { on: on(), key: !!KEY(), drive: drive.on(), ffmpeg: !!ffmpegBin, model: MODEL(), waiting: all.filter(x => x.status === 'waiting' || x.status === 'reading').length, done: all.filter(x => x.status === 'done').length, failed: all.filter(x => x.status === 'failed').length };
  }
  const statusLine = () => { const s = status(); return [s.on && s.key, !s.on ? 'Video clips are off. The director turns them on in Settings.' : !s.key ? 'Video clips are on, but GEMINI_API_KEY is not set on Render, so clips wait.' : `Video clips are on, read with ${s.model}${s.ffmpeg ? '' : ', without ffmpeg for stills'}.`]; };

  return { handle, upload, fromKaymbu, run, kick, on, status, statusLine, parseAnswer, noticedLines, LIMIT_S };
};
