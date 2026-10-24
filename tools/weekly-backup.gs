/*
  TREE weekly backup, to add to the TREE mailbox's Apps Script project.

  In script.google.com, open the project that already holds the TREE Kaymbu inbox script, choose the plus beside Files,
  then Script, name it weekly-backup, and paste this whole file. It uses the TREE_SERVER and TREE_KEY already set at the
  top of that script. If the whole Kaymbu script is pasted again from the planning app, this part is already in it, so
  keep only one of the two.
*/

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
