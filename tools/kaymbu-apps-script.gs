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
  Sally's Monthly Kitchen Digest, with the month's lunch and snack menus.
  When a digest reaches this mailbox, from Kaymbu, by the admin routing rule, or forwarded by anyone at the school,
  TREE opens its two menu PDFs, puts the month on the calendar and keeps the PDFs for educators to print. Days already
  written in TREE are kept. TREE itself decides what is a menu, so anything else sent on is left alone.
*/
function checkKitchenDigest() {
  const props = PropertiesService.getScriptProperties();
  let done = []; try { done = JSON.parse(props.getProperty('digestDone') || '[]'); } catch (e) {}
  // found by the subject, or by Sally's own Kaymbu sender so a new subject line still comes through
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
  return reply_({ error: 'Unknown request' });
}

/*
  Weekly backup of TREE to Google Drive

  Every Monday at 6 pm, Pacific time, this asks the TREE server for every record it keeps, as one file, and saves it in
  the TREE backups folder of this mailbox's Google Drive as TREE backup YYYY-MM-DD.json.gz. The newest 26 are kept,
  about six months, and older ones go to the Drive trash. Sign-ins are not in a backup, since they hold passcodes.
  The server may be restarting when the time comes, so the script asks again.

  Setup, once
  1. Run setupWeeklyBackup from the toolbar and allow the access Google asks for. It sets the Monday 6 pm time,
     replacing any earlier backup time.
  2. To test, run weeklyBackup and read the log. A new file appears in TREE backups.
  To put a backup back, see Restore in the README of the planning app.
*/
const BACKUP_FOLDER = 'TREE backups';
const BACKUP_KEEP = 26;

function setupWeeklyBackup() {
  for (const t of ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === 'weeklyBackup') ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(18).nearMinute(0).inTimezone('America/Los_Angeles').create();
  Logger.log('The weekly backup is set for Mondays at 6 pm, Pacific time.');
}

function backupFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('backupFolder');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const found = DriveApp.getFoldersByName(BACKUP_FOLDER);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(BACKUP_FOLDER);
  props.setProperty('backupFolder', folder.getId());
  return folder;
}

function weeklyBackup() {
  const url = TREE_SERVER.replace(/\/inbound\/kaymbu$/, '/inbound/backup');
  const ask = () => UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Tree-Key': TREE_KEY }, payload: JSON.stringify({ key: TREE_KEY }) });
  // a restarting server can take a minute to answer, so the script asks up to three times within about five minutes
  let res = null, why = '';
  for (let k = 0; k < 3; k++) {
    if (k) Utilities.sleep(45000);
    try { res = ask(); } catch (e) { res = null; why = String(e); continue; }
    if (res.getResponseCode() === 200) break;
    why = 'the server answered ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200);
    if (res.getResponseCode() === 403) break;
  }
  if (!res || res.getResponseCode() !== 200) throw new Error('The weekly backup did not arrive, ' + why);
  const gz = res.getBlob().setContentType('application/gzip');
  // the backup's own date and counts, read from inside it for the log
  let manifest = {};
  try { manifest = JSON.parse(Utilities.ungzip(gz.copyBlob()).getDataAsString('UTF-8')).manifest || {}; } catch (e) { Logger.log('The backup could not be opened to read its counts. ' + e); }
  const day = manifest.date || Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
  const name = 'TREE backup ' + day + '.json.gz';
  const folder = backupFolder_();
  // a second run on the same day replaces that day's file
  const same = folder.getFilesByName(name); while (same.hasNext()) same.next().setTrashed(true);
  folder.createFile(gz.setName(name));
  // the newest ones stay, and older ones go to the Drive trash
  const all = []; const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^TREE backup \d{4}-\d{2}-\d{2}\.json\.gz$/.test(f.getName())) all.push(f); }
  all.sort((a, b) => b.getName() < a.getName() ? -1 : b.getName() > a.getName() ? 1 : 0);
  all.slice(BACKUP_KEEP).forEach(f => f.setTrashed(true));
  Logger.log('Saved ' + name + ', ' + Math.round(gz.getBytes().length / 1024) + ' KB, ' + (manifest.files || '?') + ' records. ' +
    Object.keys(manifest.counts || {}).map(k => k + ' ' + manifest.counts[k]).join(', ') + '. ' + Math.min(all.length, BACKUP_KEEP) + ' backups kept.');
}
