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
        const res = UrlFetchApp.fetch(TREE_SERVER, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({ key: TREE_KEY, from: msg.getFrom(), subject: msg.getSubject(), date: msg.getDate().toISOString(), html: msg.getBody() }) });
        const code = res.getResponseCode();
        console.log(msg.getSubject() + ', TREE answered ' + code + ', ' + res.getContentText().slice(0, 200));
        if (code === 200) done.push(id);
      } catch (e) { console.log(msg.getSubject() + ', TREE did not answer in time, trying again next check'); }
    }
  }
  props.setProperty('digestDone', JSON.stringify(done.slice(-100)));
}
