/*
  TREE nightly backup, to add to the TREE mailbox's Apps Script project.

  In script.google.com, open the project that already holds the TREE Kaymbu inbox script. If it already has a script
  file named weekly-backup, open it, select everything in it and paste this whole file over it. If not, choose the plus
  beside Files, then Script, name it weekly-backup, and paste this whole file. It uses the TREE_SERVER and TREE_KEY
  already set at the top of that script. If the whole Kaymbu script is pasted again from the planning app, this part is
  already in it, so keep only one of the two.
*/

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
