/*
  TREE Kaymbu inbox, a Google Apps Script for the school's Google Workspace mailbox.

  Moments shared from Kaymbu to the TREE address arrive in this mailbox, and so do class newsletters, Kaymbu Storyboards,
  sent by Kaymbu or forwarded by anyone at the school. Every ten minutes this script finds the new ones
  and sends each email to the TREE server, which turns every Moment in it into a TREE moment. An email the server could
  not finish is tried again next time, and a Moment already in TREE is never added twice.

  Setup, once
  1. Go to script.google.com while signed in as tree@childfamilycommunity.com, the TREE mailbox, choose New project, and paste this whole file.
  2. Fill in the three settings below. The key is the same one saved on Render as KAYMBU_INBOX_KEY.
  3. Choose the function setup in the toolbar and press Run. Allow the access Google asks for. This turns on the
     ten minute check.
  4. To test, share a Moment from Kaymbu to the TREE address, then run checkKaymbu and read the log.
*/

const TREE_ADDRESS = 'tree@childfamilycommunity.com';   // the address Kaymbu Moments are sent to
const TREE_SERVER = 'https://fulton-planning.onrender.com/inbound/kaymbu';
const TREE_KEY = 'PASTE THE KEY HERE';

function setup() {
  for (const t of ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === 'checkKaymbu') ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('checkKaymbu').timeBased().everyMinutes(10).create();
  checkKaymbu();
}

function checkKaymbu() {
  const props = PropertiesService.getScriptProperties();
  let done = []; try { done = JSON.parse(props.getProperty('done') || '[]'); } catch (e) {}
  const label = GmailApp.getUserLabelByName('TREE kept') || GmailApp.createLabel('TREE kept');
  // Moments and class newsletters from Kaymbu, and a newsletter someone at the school forwards to the TREE address
  const threads = GmailApp.search('to:' + TREE_ADDRESS + ' newer_than:7d {from:kaymbu.com "Kaymbu for Families"}', 0, 50);
  for (const thread of threads) {
    let all = true;
    for (const msg of thread.getMessages()) {
      const id = msg.getId();
      if (done.indexOf(id) >= 0) continue;
      if ((msg.getTo() + ',' + msg.getCc()).toLowerCase().indexOf(TREE_ADDRESS.toLowerCase()) < 0) continue;
      const fromKaymbu = /kaymbu\.com/i.test(msg.getFrom());
      if (!fromKaymbu && !(/childfamilycommunity\.com/i.test(msg.getFrom()) && /block (subtitle|paragraph|banner)Block/.test(msg.getBody()))) continue;
      // a slow or restarting server is tried again on the next check, and the other emails still go this time
      try {
        const res = UrlFetchApp.fetch(TREE_SERVER, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'X-Tree-Key': TREE_KEY },
          payload: JSON.stringify({ key: TREE_KEY, from: msg.getFrom(), subject: msg.getSubject(), date: msg.getDate().toISOString(), html: msg.getBody() })
        });
        const code = res.getResponseCode();
        console.log(msg.getSubject() + ', TREE answered ' + code + ', ' + res.getContentText().slice(0, 300));
        if (code === 200) done.push(id); else all = false;
      } catch (e) { console.log(msg.getSubject() + ', TREE did not answer in time, trying again next check'); all = false; }
    }
    if (all) thread.addLabel(label);
  }
  props.setProperty('done', JSON.stringify(done.slice(-300)));
  checkFeedOrders();
  checkKitchenDigest();
}

/*
  The Monthly Kitchen Digest, with the month's lunch and snack menus.
  When a digest reaches this mailbox, from Kaymbu, by the admin routing rule, or forwarded by anyone at the school,
  TREE opens its two menu PDFs, puts the month on the calendar and keeps the PDFs for educators to print. Days already
  written in TREE are kept. TREE itself decides what is a menu, so anything else sent on is left alone.
*/
function checkKitchenDigest() {
  const props = PropertiesService.getScriptProperties();
  let done = []; try { done = JSON.parse(props.getProperty('digestDone') || '[]'); } catch (e) {}
  // found by the subject, or by the kitchen's own Kaymbu sender so a new subject line still comes through
  const threads = GmailApp.search('{subject:"Kitchen Digest" subject:menu subject:menus from:usr607e05143ce31e01151a4305@inbox.kaymbu.com} newer_than:30d', 0, 20);
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const id = msg.getId();
      if (done.indexOf(id) >= 0) continue;
      try {
        const res = UrlFetchApp.fetch(TREE_SERVER, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'X-Tree-Key': TREE_KEY },
          payload: JSON.stringify({ key: TREE_KEY, from: msg.getFrom(), subject: msg.getSubject(), date: msg.getDate().toISOString(), html: msg.getBody() }) });
        const code = res.getResponseCode();
        console.log(msg.getSubject() + ', TREE answered ' + code + ', ' + res.getContentText().slice(0, 200));
        if (code === 200) done.push(id);
      } catch (e) { console.log(msg.getSubject() + ', TREE did not answer in time, trying again next check'); }
    }
  }
  props.setProperty('digestDone', JSON.stringify(done.slice(-100)));
}

/*
  Orders and invoices, for the Farm to School grant records.
  Forward order emails and invoices to tree@childfamilycommunity.com, from any vendor and from any time in the grant.
  An email can also carry other emails or PDF invoices as attachments. On each check this script sends them to TREE.
  FEED's are read exactly. Any other vendor's waits on the grant page for the director to check it. Shipping notices,
  newsletters and other mail are recognised and left out. An order sent twice is kept once.

  Setup, once
  1. Paste this updated file over the old one in the script project. Nothing else changes.
*/
function checkFeedOrders() {
  const server = TREE_SERVER.replace(/\/inbound\/kaymbu$/, '/inbound/feed-order');
  const label = GmailApp.getUserLabelByName('TREE order kept') || GmailApp.createLabel('TREE order kept');
  // other mail is marked once, so each check only looks at what is new
  const other = GmailApp.getUserLabelByName('TREE not an order') || GmailApp.createLabel('TREE not an order');
  const threads = GmailApp.search('-from:kaymbu.com -label:"TREE order kept" -label:"TREE not an order" -label:"TREE kept" -in:spam -in:trash', 0, 40);
  for (const thread of threads) {
    let all = true, any = false;
    for (const msg of thread.getMessages()) {
      if (/kaymbu\.com/i.test(msg.getFrom())) continue;
      const parts = [];
      for (const a of msg.getAttachments({ includeInlineImages: false })) {
        const type = a.getContentType() || '', name = a.getName() || 'attachment';
        if (/message\/rfc822/i.test(type) || /\.eml$/i.test(name)) parts.push({ name: name, type: 'message/rfc822', raw: a.getDataAsString() });
        else if (/pdf/i.test(type) || /\.pdf$/i.test(name)) parts.push({ name: name, type: 'application/pdf', data: Utilities.base64Encode(a.getBytes()) });
      }
      const subject = msg.getSubject() || '';
      // only orders and invoices go to TREE, and emails that carry them as attachments
      if (!parts.length && !/feed cooperative|invoice|order|receipt/i.test(subject)) continue;
      any = true;
      try {
        const res = UrlFetchApp.fetch(server, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'X-Tree-Key': TREE_KEY },
          payload: JSON.stringify({ key: TREE_KEY, from: msg.getFrom(), subject: subject, date: msg.getDate().toISOString(), html: parts.length && !/feed cooperative|invoice|order|receipt/i.test(subject) ? '' : msg.getBody(), parts: parts }) });
        const code = res.getResponseCode();
        console.log((subject || '(no subject)') + ', ' + parts.length + ' attached, TREE answered ' + code + ', ' + res.getContentText().slice(0, 200));
        if (code !== 200 && code !== 400) all = false;
      } catch (e) { console.log((subject || '(no subject)') + ', TREE did not answer in time, trying again next check'); all = false; }
    }
    if (all && any) thread.addLabel(label); else if (!any) thread.addLabel(other);
  }
}

/*
  TREE photos in Google Drive.
  The same script also keeps TREE's photos in a folder called TREE photos in this account's Drive, so photos use the
  school's Google storage. TREE's server sends each photo here and asks for it again when a page shows it.

  Setup, once, after the Kaymbu setup above
  1. Choose Deploy, then New deployment. Choose the gear beside Select type and choose Web app.
  2. Execute as Me. Who has access, Anyone. Press Deploy and allow the access Google asks for.
  3. Copy the Web app URL and send it to be saved on Render as DRIVE_PHOTOS_URL.
  Anyone with the address still needs the key above, so no one else can read or add photos.
  The same web app also keeps the weekly readable copies, through the readable-copies script file. Its setup is at the
  top of tools/readable-copies.gs in the planning app. After doPost changes, deploy the web app again as a new version.
*/
const PHOTO_FOLDER = 'TREE photos';

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('photoFolder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const found = DriveApp.getFoldersByName(PHOTO_FOLDER);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(PHOTO_FOLDER);
  props.setProperty('photoFolder', folder.getId());
  return folder;
}

function reply_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (x) { return reply_({ error: 'The request could not be read' }); }
  if (!body.key || body.key !== TREE_KEY) return reply_({ error: 'Not allowed' });
  // the weekly readable copies, kept by the readable-copies script file beside this one
  if (/^readable-/.test(String(body.op || ''))) return reply_(readableCopies_(body));
  const folder = photoFolder_();
  if (body.op === 'ping') return reply_({ ok: true, folder: folder.getName() });
  if (body.op === 'put') {
    const blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.type || 'image/jpeg', String(body.name || 'photo.jpg'));
    const file = folder.createFile(blob);
    return reply_({ id: file.getId(), size: file.getSize() });
  }
  if (body.op === 'get') {
    let file; try { file = DriveApp.getFileById(String(body.id || '')); } catch (x) { return reply_({ error: 'That photo is not in Drive' }); }
    // only photos in the TREE photos folder are ever handed back
    const parents = file.getParents(); let inFolder = false;
    while (parents.hasNext()) if (parents.next().getId() === folder.getId()) inFolder = true;
    if (!inFolder) return reply_({ error: 'That file is not a TREE photo' });
    return reply_({ data: Utilities.base64Encode(file.getBlob().getBytes()), type: file.getMimeType() });
  }
  // video clips, read by TREE in pieces, their Drive thumbnail, and their sharing for signed-in school accounts
  if (/^video-/.test(String(body.op || ''))) return reply_(videoOp_(body));
  return reply_({ error: 'Unknown request' });
}

/*
  Video clips for observations.
  An educator records a clip of up to three minutes on the class phone and either drops it in the Video folder of this
  account's Drive, named with the class and their first name, such as North Ann, or emails it to the TREE address with
  the class and their first name in the subject, the way a Kaymbu moment is sent. An email can carry the clip as an
  attachment or hold a Drive link to it. Every ten minutes this script finds the new ones, saves an emailed clip into
  the Video folder, lets anyone signed in to a school Google account watch the file from its link, and tells TREE
  about it. TREE then reads the clip and leaves the educator a draft observation. The clip itself stays here in Drive.
  A clip is told to TREE once, kept in the script's own list, and its Drive description says when it was sent.

  Setup, once, after the photos web app above
  1. Paste this whole file over the old one and save.
  2. Choose Deploy, then Manage deployments, the pencil, New version, Deploy. The address does not change.
  3. Choose setupVideoClips in the toolbar and press Run, and allow the access Google asks for. It makes the Video
     folder, named in the log, and sets the ten minute check.
  4. In TREE, Settings, turn on Video clips.
*/
const VIDEO_FOLDER = 'Video';
const VIDEO_TYPES = /^video\/(mp4|quicktime|x-m4v|webm|3gpp|mpeg|x-msvideo)$/i;
const VIDEO_NAMES = /\.(mp4|mov|m4v|webm|3gp|mpeg|mpg|avi)$/i;
const VIDEO_PIECE = 4 * 1024 * 1024;

function setupVideoClips() {
  for (const t of ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === 'checkVideoClips') ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('checkVideoClips').timeBased().everyMinutes(10).create();
  const folder = videoFolder_();
  Logger.log('The Video folder is ' + folder.getName() + ', id ' + folder.getId() + '. Clips are checked every ten minutes.');
  checkVideoClips();
}

function videoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('videoFolder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const found = DriveApp.getFoldersByName(VIDEO_FOLDER);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(VIDEO_FOLDER);
  props.setProperty('videoFolder', folder.getId());
  return folder;
}

function isVideoFile_(file) { return VIDEO_TYPES.test(file.getMimeType() || '') || VIDEO_NAMES.test(file.getName() || ''); }

// anyone signed in to a school Google account can watch the clip from its link. Nothing is made public.
function shareVideo_(file) {
  try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); return true; }
  catch (e) { Logger.log('The clip ' + file.getName() + ' could not be shared with the school domain. ' + e); return false; }
}

// tells TREE about one clip. Answers true when TREE kept it, so it is never told twice.
function postVideo_(file, by, subject) {
  const url = TREE_SERVER.replace(/\/inbound\/kaymbu$/, '/inbound/video');
  const payload = { key: TREE_KEY, fileId: file.getId(), name: file.getName(), mimeType: file.getMimeType(), size: file.getSize(), by: by || '', subject: subject || '', createdAt: file.getDateCreated().toISOString() };
  try {
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'X-Tree-Key': TREE_KEY }, payload: JSON.stringify(payload) });
    const code = res.getResponseCode();
    console.log('Clip ' + file.getName() + ', TREE answered ' + code + ', ' + res.getContentText().slice(0, 200));
    // 200 kept it, 400 means TREE will never take it (not a video, or too large), so neither is sent again
    return code === 200 || code === 400;
  } catch (e) { console.log('Clip ' + file.getName() + ', TREE did not answer in time, trying again next check'); return false; }
}

function checkVideoClips() {
  const props = PropertiesService.getScriptProperties();
  let done = []; try { done = JSON.parse(props.getProperty('videoDone') || '[]'); } catch (e) {}
  const folder = videoFolder_();
  const stamp = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'MMMM d, yyyy h:mm a');
  const sent = (file, by, subject) => { if (done.indexOf(file.getId()) >= 0) return; shareVideo_(file);
    if (postVideo_(file, by, subject)) { done.push(file.getId()); try { file.setDescription('Sent to TREE ' + stamp); } catch (e) {} } };
  // clips dropped in the Video folder. The file's name carries the class and the educator's first name.
  const files = folder.getFiles();
  while (files.hasNext()) { const f = files.next(); if (isVideoFile_(f)) sent(f, '', f.getName().replace(/\.[a-z0-9]+$/i, '')); }
  // clips emailed to the TREE address, as an attachment or as a Drive link, with the class and the educator's first name in the subject
  const label = GmailApp.getUserLabelByName('TREE clip kept') || GmailApp.createLabel('TREE clip kept');
  const threads = GmailApp.search('to:' + TREE_ADDRESS + ' newer_than:7d -from:kaymbu.com -label:"TREE clip kept" {has:attachment "drive.google.com" "Click to Download"}', 0, 30);
  for (const thread of threads) {
    let all = true, any = false;
    for (const msg of thread.getMessages()) {
      const from = msg.getFrom() || '', subject = msg.getSubject() || '';
      const by = from.replace(/<[^>]*>/, '').trim().replace(/^"|"$/g, '').split(/\s+/)[0] || from.replace(/^.*<|>.*$/g, '').split('@')[0];
      for (const a of msg.getAttachments({ includeInlineImages: false })) {
        if (!(VIDEO_TYPES.test(a.getContentType() || '') || VIDEO_NAMES.test(a.getName() || ''))) continue;
        any = true;
        // the attachment is kept in the Video folder, so the clip has one home in Drive
        const same = folder.getFilesByName(a.getName()); let file = null;
        while (same.hasNext()) { const f = same.next(); if (f.getSize() === a.getBytes().length) file = f; }
        if (!file) file = folder.createFile(a.copyBlob().setName(a.getName()));
        if (done.indexOf(file.getId()) < 0) { sent(file, by, subject); if (done.indexOf(file.getId()) < 0) all = false; }
      }
      const links = (msg.getPlainBody() + ' ' + msg.getBody()).match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]{10,})/g) || [];
      const ids = []; links.forEach(l => { const id = l.replace(/^.*(?:\/d\/|id=)/, ''); if (ids.indexOf(id) < 0) ids.push(id); });
      for (const id of ids) {
        let file; try { file = DriveApp.getFileById(id); } catch (e) { continue; }
        if (!isVideoFile_(file)) continue;
        any = true;
        if (done.indexOf(id) < 0) { sent(file, by, subject); if (done.indexOf(id) < 0) all = false; }
      }
      // a clip sent from an iPhone comes as a Mail Drop link once it is more than a few megabytes. The link carries the
      // download address with the file name and key left to fill in. The clip is fetched and kept in the Video folder.
      const drops = (msg.getBody() + ' ' + msg.getPlainBody()).match(/https:\/\/www\.icloud\.com\/attachment\/\?[^"'\s<]+/g) || [];
      const names = [];
      for (let raw of drops) {
        const q = {};
        raw.replace(/&amp;/g, '&').split('?')[1].split('&').forEach(p => { const i = p.indexOf('='); if (i > 0) q[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' ')); });
        if (!q.u || !q.f || names.indexOf(q.f) >= 0 || !VIDEO_NAMES.test(q.f)) continue;
        names.push(q.f);
        any = true;
        const same = folder.getFilesByName(q.f); let file = null;
        while (same.hasNext()) { const f = same.next(); if (!q.sz || String(f.getSize()) === String(q.sz)) file = f; }
        if (!file) {
          if (Number(q.sz) > 45 * 1024 * 1024) { all = false; continue; }
          const url = q.u.split('${f}').join(encodeURIComponent(q.f)).split('${uk}').join(encodeURIComponent(q.uk || ''));
          let res; try { res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true }); } catch (e) { all = false; continue; }
          if (res.getResponseCode() !== 200) { all = false; continue; }
          file = folder.createFile(res.getBlob().setName(q.f));
        }
        if (done.indexOf(file.getId()) < 0) { sent(file, by, subject); if (done.indexOf(file.getId()) < 0) all = false; }
      }
    }
    if (any && all) thread.addLabel(label);
  }
  props.setProperty('videoDone', JSON.stringify(done.slice(-500)));
}

// TREE asks for a clip's bytes in pieces of 4 MB through Drive's own download, since a whole clip is larger than a script
// may hold at once. It also asks for the Drive thumbnail when no still frame can be taken, and for the sharing to be set again.
function videoOp_(body) {
  let file; try { file = DriveApp.getFileById(String(body.id || '')); } catch (x) { return { error: 'That clip is not in Drive' }; }
  if (!isVideoFile_(file)) return { error: 'That file is not a video' };
  if (body.op === 'video-info') return { id: file.getId(), name: file.getName(), type: file.getMimeType(), size: file.getSize(), parts: Math.ceil(file.getSize() / VIDEO_PIECE) };
  if (body.op === 'video-share') return { ok: shareVideo_(file) };
  if (body.op === 'video-thumb') { const t = file.getThumbnail(); if (!t) return { error: 'Drive has no thumbnail for this clip yet' }; return { data: Utilities.base64Encode(t.getBytes()), type: t.getContentType() }; }
  if (body.op === 'video-get') {
    const size = file.getSize(), part = Math.max(0, Math.floor(Number(body.part) || 0)), from = part * VIDEO_PIECE;
    if (from >= size) return { error: 'That piece is past the end of the clip' };
    const to = Math.min(size, from + VIDEO_PIECE) - 1;
    const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(file.getId()) + '?alt=media&supportsAllDrives=true', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + from + '-' + to }, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code !== 200 && code !== 206) return { error: 'Drive answered ' + code + ' for the clip' };
    const bytes = res.getContent();
    return { part, parts: Math.ceil(size / VIDEO_PIECE), size, type: file.getMimeType(), name: file.getName(), data: Utilities.base64Encode(code === 206 ? bytes : bytes.slice(from, to + 1)) };
  }
  return { error: 'Unknown video request' };
}

/*
  Nightly backup of TREE to Google Drive

  Every night at 10 pm, Pacific time, this asks the TREE server for every record it keeps, as one file, and saves it in
  the TREE backups folder of this mailbox's Google Drive as TREE backup YYYY-MM-DD.json.gz. The newest 30 nightly
  backups are kept. Before any older one leaves, one from each past week, the newest of that week, is kept as that
  week's backup, renamed TREE weekly backup YYYY-MM-DD.json.gz, and the newest 26 weekly backups are kept, so the
  backups reach back about six months. The rest go to the Drive trash. The Monday backups made before are named the
  same way as the nightly ones, so the first run keeps one from each of their weeks too. Sign-ins are not in a backup,
  since they hold passcodes.
  The pictures in the Policies and Procedures, the Family Handbook and the libraries come next, in their own file, TREE
  pictures YYYY-MM-DD.json.gz, holding only the pictures new or changed since the last one. These are all kept, since
  each holds only what changed. To ask for every picture once, run fullPictureBackup.
  The server may be restarting when the time comes, so the script asks again.

  The backup key
  The backup has its own key, BACKUP_KEY on Render. Put the same key in this project's Script properties as
  BACKUP_KEY (Project Settings, Script properties, Add script property). Until it is there, the script uses TREE_KEY.

  Setup, once, also when changing from the Monday backup
  1. Paste this whole file over the old one and save.
  2. Choose setupNightlyBackup in the toolbar and press Run. Allow the access Google asks for. It sets the nightly
     10 pm time and removes the old Monday time. setupWeeklyBackup does the same, for anyone used to that name.
  3. To test, run nightlyBackup and read the log. A new file appears in TREE backups.
  The web app needs no new deployment for this part, since it does not change doPost.
  To put a backup back, see Restore in the README of the planning app.
*/
const BACKUP_FOLDER = 'TREE backups';
const BACKUP_KEEP = 30, BACKUP_WEEKS = 26;
// UrlFetchApp takes answers up to 50 MB. The server stops at 40 MB, and a file over 45 MB is never saved half made.
const BACKUP_MAX = 45 * 1024 * 1024;

function setupNightlyBackup() {
  // the Monday time ran weeklyBackup, so both names are cleared before the nightly time is set
  for (const t of ScriptApp.getProjectTriggers()) if (['weeklyBackup', 'nightlyBackup'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('nightlyBackup').timeBased().everyDays(1).atHour(22).nearMinute(0).inTimezone('America/Los_Angeles').create();
  Logger.log('The backup is set for every night at 10 pm, Pacific time. The Monday time is gone.');
}
// the name used before, so running either one sets the same nightly time
function setupWeeklyBackup() { setupNightlyBackup(); }

function backupFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('backupFolder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const found = DriveApp.getFoldersByName(BACKUP_FOLDER);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(BACKUP_FOLDER);
  props.setProperty('backupFolder', folder.getId());
  return folder;
}

// a Monday time left from before still runs weeklyBackup, which makes the same backup until setup is run
function weeklyBackup() { nightlyBackup(); }

// the backup's own key from Script properties, sent in the X-Backup-Key header. Until it is set, the inbox key is sent the old way.
function backupAsk_(path, body) {
  const url = TREE_SERVER.replace(/\/inbound\/kaymbu$/, path);
  let own = ''; try { own = String(PropertiesService.getScriptProperties().getProperty('BACKUP_KEY') || '').trim(); } catch (e) {}
  const headers = own ? { 'X-Backup-Key': own } : { 'X-Tree-Key': TREE_KEY };
  const payload = Object.assign({}, body || {}); if (!own) payload.key = TREE_KEY;
  return UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: headers, payload: JSON.stringify(payload) });
}
// a restarting server can take a minute to answer, so the script asks up to three times within about five minutes
function backupFetch_(path, body) {
  let res = null, why = '';
  for (let k = 0; k < 3; k++) {
    if (k) Utilities.sleep(45000);
    try { res = backupAsk_(path, body); } catch (e) { res = null; why = String(e); continue; }
    if (res.getResponseCode() === 200) return { res: res };
    why = 'the server answered ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200);
    if (res.getResponseCode() === 403 || res.getResponseCode() === 507) break;
  }
  return { res: null, why: why };
}
function header_(res, name) { const h = res.getHeaders ? res.getHeaders() || {} : {}; const k = Object.keys(h).find(x => x.toLowerCase() === name.toLowerCase()); return k ? String(h[k]) : ''; }

function nightlyBackup() {
  const got = backupFetch_('/inbound/backup');
  if (!got.res) throw new Error('The nightly backup did not arrive, ' + got.why);
  const res = got.res;
  const gz = res.getBlob().setContentType('application/gzip');
  const size = gz.getBytes().length;
  if (size > BACKUP_MAX) throw new Error('The nightly backup was ' + Math.round(size / 1048576) + ' MB, too large to keep safely, so it was not saved.');
  // the date and counts come in the answer's headers, so the file is never opened just to read them
  const day = header_(res, 'X-Backup-Date') || Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
  const name = 'TREE backup ' + day + '.json.gz';
  const folder = backupFolder_();
  // a second run on the same day replaces that day's file
  const same = folder.getFilesByName(name); while (same.hasNext()) same.next().setTrashed(true);
  folder.createFile(gz.setName(name));
  // the server is told the file is saved, so Settings shows the night as kept
  try { backupAsk_('/inbound/backup/saved', { kind: 'records', name: name, bytes: size }); } catch (e) { Logger.log('The server could not be told the backup is saved. ' + e); }
  let kept = { nightly: '?', weekly: '?' };
  try { kept = keepBackups_(folder); } catch (e) { Logger.log('Older backups could not be sorted this time. ' + e); }
  Logger.log('Saved ' + name + ', ' + Math.round(size / 1024) + ' KB, ' + (header_(res, 'X-Backup-Files') || '?') + ' records. ' +
    header_(res, 'X-Backup-Counts') + '. ' + kept.nightly + ' nightly and ' + kept.weekly + ' weekly backups kept.');
  // the pictures come after, in their own file, so a trouble there never stops the records being kept
  try { pictureBackup_(false); } catch (e) { Logger.log('The picture backup did not finish. It will try again tomorrow. ' + e); }
}

// every picture once, such as after a restore or to start a fresh set. Run it from the toolbar.
function fullPictureBackup() { pictureBackup_(true); }

// pictures new or changed since the last picture backup, as many files as it takes, each saved before the next is asked
function pictureBackup_(full) {
  const folder = backupFolder_();
  for (let part = 1; part <= 10; part++) {
    const got = backupFetch_('/inbound/backup/pictures', part === 1 && full ? { full: true } : {});
    if (!got.res) throw new Error('The pictures did not arrive, ' + got.why);
    const res = got.res, count = Number(header_(res, 'X-Backup-Count')) || 0;
    if (!count) { Logger.log(part === 1 ? 'No new or changed pictures since the last picture backup.' : 'Every picture is kept.'); return; }
    const gz = res.getBlob().setContentType('application/gzip'), size = gz.getBytes().length;
    if (size > BACKUP_MAX) throw new Error('A picture file was ' + Math.round(size / 1048576) + ' MB, too large to keep safely, so it was not saved.');
    const day = header_(res, 'X-Backup-Date') || Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
    const name = 'TREE pictures ' + day + (part > 1 ? ' ' + part : '') + '.json.gz';
    const same = folder.getFilesByName(name); while (same.hasNext()) same.next().setTrashed(true);
    folder.createFile(gz.setName(name));
    backupAsk_('/inbound/backup/saved', { kind: 'pictures', token: header_(res, 'X-Backup-Token'), name: name, bytes: size });
    Logger.log('Saved ' + name + ', ' + Math.round(size / 1024) + ' KB, ' + count + ' pictures.');
    if (header_(res, 'X-Backup-More') !== '1') return;
  }
  Logger.log('More pictures are waiting. They come with the next backup.');
}

// the newest 30 nightly backups stay. Before an older one leaves, the newest of each past week is kept as that week's
// backup, and the newest 26 weekly backups stay. Everything else goes to the Drive trash.
function keepBackups_(folder) {
  const DAY = /^TREE backup (\d{4}-\d{2}-\d{2})\.json\.gz$/, WEEK = /^TREE weekly backup (\d{4}-\d{2}-\d{2})\.json\.gz$/;
  const monday = d => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
  const nightly = [], weekly = []; const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); const n = f.getName(); if (DAY.test(n)) nightly.push(f); else if (WEEK.test(n)) weekly.push(f); }
  const newest = (a, b) => b.getName().slice(-18) < a.getName().slice(-18) ? -1 : b.getName().slice(-18) > a.getName().slice(-18) ? 1 : 0;
  nightly.sort(newest);
  // nights leave one at a time, oldest first, so a later night of the same week takes the place of the one kept before,
  // and each week ends with its newest night
  const weeks = {}; weekly.forEach(f => { weeks[monday(f.getName().match(WEEK)[1])] = f; });
  nightly.slice(BACKUP_KEEP).reverse().forEach(f => {
    const d = f.getName().match(DAY)[1], w = monday(d), was = weeks[w];
    if (was && was.getName().match(WEEK)[1] >= d) { f.setTrashed(true); return; }
    if (was) { was.setTrashed(true); weekly.splice(weekly.indexOf(was), 1); }
    f.setName('TREE weekly backup ' + d + '.json.gz'); weekly.push(f); weeks[w] = f;
  });
  weekly.sort(newest);
  weekly.slice(BACKUP_WEEKS).forEach(f => f.setTrashed(true));
  return { nightly: Math.min(nightly.length, BACKUP_KEEP), weekly: Math.min(weekly.length, BACKUP_WEEKS) };
}
