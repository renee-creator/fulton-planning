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
  the TREE backups folder of this mailbox's Google Drive as TREE backup YYYY-MM-DD.json.gz. The newest 60 are kept,
  about two months, and older ones go to the Drive trash. The Monday backups made before are named the same way, so
  they count among the 60 and leave in turn. Sign-ins are not in a backup, since they hold passcodes.
  The server may be restarting when the time comes, so the script asks again.

  Setup, once, also when changing from the Monday backup
  1. Paste this whole file over the old one and save.
  2. Choose setupNightlyBackup in the toolbar and press Run. Allow the access Google asks for. It sets the nightly
     10 pm time and removes the old Monday time. setupWeeklyBackup does the same, for anyone used to that name.
  3. To test, run nightlyBackup and read the log. A new file appears in TREE backups.
  The web app needs no new deployment for this part, since it does not change doPost.
  To put a backup back, see Restore in the README of the planning app.
*/
const BACKUP_FOLDER = 'TREE backups';
const BACKUP_KEEP = 60;

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

function nightlyBackup() {
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
  if (!res || res.getResponseCode() !== 200) throw new Error('The nightly backup did not arrive, ' + why);
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
  // the newest 60 stay, the Monday ones from before among them, and older ones go to the Drive trash
  const all = []; const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^TREE backup \d{4}-\d{2}-\d{2}\.json\.gz$/.test(f.getName())) all.push(f); }
  all.sort((a, b) => b.getName() < a.getName() ? -1 : b.getName() > a.getName() ? 1 : 0);
  all.slice(BACKUP_KEEP).forEach(f => f.setTrashed(true));
  Logger.log('Saved ' + name + ', ' + Math.round(gz.getBytes().length / 1024) + ' KB, ' + (manifest.files || '?') + ' records. ' +
    Object.keys(manifest.counts || {}).map(k => k + ' ' + manifest.counts[k]).join(', ') + '. ' + Math.min(all.length, BACKUP_KEEP) + ' backups kept.');
}
