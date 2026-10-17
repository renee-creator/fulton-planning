/*
  TREE Kaymbu inbox, a Google Apps Script for the school's Google Workspace mailbox.

  Moments shared from Kaymbu to the TREE address arrive in this mailbox. Every ten minutes this script finds the new ones
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
  const threads = GmailApp.search('from:kaymbu.com to:' + TREE_ADDRESS + ' newer_than:7d', 0, 50);
  for (const thread of threads) {
    let all = true;
    for (const msg of thread.getMessages()) {
      const id = msg.getId();
      if (done.indexOf(id) >= 0) continue;
      if (!/kaymbu\.com/i.test(msg.getFrom()) || (msg.getTo() + ',' + msg.getCc()).toLowerCase().indexOf(TREE_ADDRESS.toLowerCase()) < 0) continue;
      // a slow or sleeping server is tried again on the next check, and the other emails still go this time
      try {
        const res = UrlFetchApp.fetch(TREE_SERVER, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
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
}
