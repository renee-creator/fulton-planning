/*
  Kitchen's Monthly Kitchen Digest, with the month's lunch and snack menus.
  When a digest reaches this mailbox, from Kaymbu, by the admin routing rule, or forwarded by anyone at the school,
  TREE opens its two menu PDFs and puts the month on the calendar. Days already written in TREE are kept.
*/
function checkKitchenDigest() {
  const props = PropertiesService.getScriptProperties();
  let done = []; try { done = JSON.parse(props.getProperty('digestDone') || '[]'); } catch (e) {}
  const threads = GmailApp.search('subject:"Kitchen Digest" newer_than:30d', 0, 20);
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const id = msg.getId();
      if (done.indexOf(id) >= 0 || !/kitchen digest/i.test(msg.getSubject() || '')) continue;
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
