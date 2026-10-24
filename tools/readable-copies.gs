/*
  TREE readable copies, to add to the TREE mailbox's Apps Script project, beside the Kaymbu inbox and the backup.

  Once a week the director's TREE, on a computer or iPad, makes the Word and PDF files TREE already prints and sends
  them through the TREE server to this script's web app, the same one that keeps TREE's photos. Each file is kept in the
  TREE readable copies folder of this mailbox's Google Drive, beside TREE backups, in a folder for the week named by
  its date, such as TREE readable copies / 2026-10-26 / North Class. A second set started the same day is numbered,
  such as 2026-10-26 2. There is one folder for each Class, one for the school, one for former children and one for
  former educators. Only once the whole new set has arrived are the earlier sets moved to the Drive trash, so only the
  newest complete set is kept. A file whose records have not changed since the last whole set is copied from that set
  here, inside Drive, so TREE makes only the files that changed. Evaluations, journals, check-ins and growth are never
  sent here.

  To update from the version before the copy step, paste this whole file over the readable-copies script file, save,
  and do step 4 below, Deploy, Manage deployments, New version. Until then TREE makes every file itself, as before.

  Setup, once
  1. In script.google.com, signed in as the TREE mailbox, open the project that holds the TREE Kaymbu inbox script.
  2. In the Kaymbu inbox script file, find the function doPost. Right below its line
       if (!body.key || body.key !== TREE_KEY) return reply_({ error: 'Not allowed' });
     add this one line, and save.
       if (/^readable-/.test(String(body.op || ''))) return reply_(readableCopies_(body));
     The doPost in tools/kaymbu-apps-script.gs of the planning app already has it, so pasting that whole function over
     the old one does the same.
  3. Choose the plus beside Files, then Script, name it readable-copies, paste this whole file, and save.
  4. Choose Deploy, then Manage deployments. Choose the web app, the pencil to edit it, and under Version choose
     New version. Press Deploy. The web app keeps the same address, so DRIVE_PHOTOS_URL on Render does not change.
  5. Choose setupReadableCopies in the toolbar and press Run. Allow the access Google asks for. It makes the
     TREE readable copies folder and writes the folder's name in the log.
  6. To test, open TREE on a computer as the director, go to Settings, and under Backups press Make readable copies now.
     Keep TREE open until the card shows the time of the new set, then open TREE readable copies in Drive.
*/
const READABLE_FOLDER = 'TREE readable copies';
const READABLE_PLACES = /^(School|Former children|Former educators|[A-Z][A-Za-z]{0,30} Class)$/;

function setupReadableCopies() {
  const root = readableRoot_();
  // asking Drive once here lets Google ask for the access a large file needs, now rather than on the first large file
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + root.getId() + '?fields=id', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  Logger.log('Readable copies are kept in the folder ' + root.getName() + ', in this mailbox\'s Google Drive.');
}

function readableRoot_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('readableFolder');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const found = DriveApp.getFoldersByName(READABLE_FOLDER);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(READABLE_FOLDER);
  props.setProperty('readableFolder', folder.getId());
  return folder;
}
function readableChild_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }

// the server's requests, passed on by doPost after it checks the key. Anything Drive refuses comes back in words.
function readableCopies_(body) {
  try { return readableAsk_(body); } catch (e) { return { error: String((e && e.message) || e).slice(0, 300) }; }
}
function readableAsk_(body) {
  const run = String(body.run || '');
  if (!/^\d{4}-\d{2}-\d{2}( \d{1,2})?$/.test(run)) return { error: 'The week of the readable copies is missing' };
  const root = readableRoot_();
  if (body.op === 'readable-start') {
    // what is already in this week's folder, so a set that stopped carries on where it was
    const week = readableChild_(root, run), have = [];
    const places = week.getFolders();
    while (places.hasNext()) { const p = places.next(); const files = p.getFiles(); while (files.hasNext()) { const f = files.next(); if (!f.isTrashed()) have.push(p.getName() + '/' + f.getName()); } }
    return { ok: true, have: have };
  }
  if (body.op === 'readable-put') {
    const place = String(body.folder || ''), name = String(body.name || '');
    if (!READABLE_PLACES.test(place) || !/^[^\/\\]{1,160}\.(pdf|docx)$/i.test(name)) return { error: 'Only PDF and Word files go in the readable copies' };
    const folder = readableChild_(readableChild_(root, run), place);
    const part = Number(body.part) || 0, parts = Number(body.parts) || 1;
    // a file sent again replaces the one already there
    if (part === 0) { const same = folder.getFilesByName(name); while (same.hasNext()) same.next().setTrashed(true); }
    const bytes = Utilities.base64Decode(String(body.data || ''));
    if (parts === 1) { const f = folder.createFile(Utilities.newBlob(bytes, body.type, name)); return { id: f.getId(), size: f.getSize() }; }
    // a large file arrives in pieces of 4 MB and is put together by Drive itself, so it never has to fit in memory here
    const cache = CacheService.getScriptCache(), key = 'readable-' + String(body.upload || '');
    let session = part === 0 ? '' : cache.get(key);
    if (part === 0) {
      const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', { method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': body.type, 'X-Upload-Content-Length': String(body.total) },
        payload: JSON.stringify({ name: name, parents: [folder.getId()] }) });
      const h = res.getAllHeaders(); session = h.Location || h.location || '';
      if (!session) return { error: 'Drive would not start the upload of ' + name + ', ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200) };
      cache.put(key, session, 21600);
    }
    if (!session) return { error: 'The upload of ' + name + ' had stopped, so it starts again next time' };
    const start = Number(body.start) || 0, end = start + bytes.length - 1;
    const res = UrlFetchApp.fetch(session, { method: 'put', contentType: body.type, payload: bytes, muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes ' + start + '-' + end + '/' + body.total } });
    const code = res.getResponseCode();
    if (code === 308) return { ok: true };
    if (code === 200 || code === 201) { cache.remove(key); let id = ''; try { id = JSON.parse(res.getContentText()).id || ''; } catch (e) {} return { id: id || 'done' }; }
    return { error: 'Drive did not keep a piece of ' + name + ', ' + code + ' ' + res.getContentText().slice(0, 200) };
  }
  if (body.op === 'readable-copy') {
    // a file whose records have not changed since the last whole set is copied from that set, inside Drive, so TREE
    // does not make it again or load its photos again
    const from = String(body.from || '');
    if (!/^\d{4}-\d{2}-\d{2}( \d{1,2})?$/.test(from) || from === run) return { error: 'The week to copy from is missing' };
    const olds = root.getFoldersByName(from); if (!olds.hasNext()) return { ok: true, copied: [] };
    const old = olds.next(), week = readableChild_(root, run), copied = [];
    (Array.isArray(body.files) ? body.files : []).slice(0, 40).forEach(function (path) {
      path = String(path); const i = path.indexOf('/'); if (i < 1) return;
      const place = path.slice(0, i), name = path.slice(i + 1);
      if (!READABLE_PLACES.test(place) || !/^[^\/\\]{1,160}\.(pdf|docx)$/i.test(name)) return;
      const of = old.getFoldersByName(place); if (!of.hasNext()) return;
      const src = of.next().getFilesByName(name); if (!src.hasNext()) return;
      const f = src.next(); if (f.isTrashed()) return;
      const to = readableChild_(week, place);
      const same = to.getFilesByName(name); while (same.hasNext()) same.next().setTrashed(true);
      f.makeCopy(name, to); copied.push(path);
    });
    return { ok: true, copied: copied };
  }
  if (body.op === 'readable-finish') {
    // the new set is counted first, and only a whole set sends earlier weeks to the trash
    const week = readableChild_(root, run); let kept = 0;
    const places = week.getFolders();
    while (places.hasNext()) { const files = places.next().getFiles(); while (files.hasNext()) if (!files.next().isTrashed()) kept++; }
    const expect = Number(body.expect) || 0;
    if (kept < expect) return { error: 'Only ' + kept + ' of the ' + expect + ' files are in the new set, so last week\'s set stays' };
    let trashed = 0; const others = root.getFolders();
    while (others.hasNext()) { const f = others.next(); if (f.getId() !== week.getId() && /^\d{4}-\d{2}-\d{2}( \d{1,2})?$/.test(f.getName())) { f.setTrashed(true); trashed++; } }
    return { ok: true, kept: kept, trashed: trashed };
  }
  return { error: 'Unknown request' };
}
