'use strict';
/* Email from TREE to families (November 15, 2026). The director's newsletter or mid-month note goes out through the
   TREE mailbox's web app, the same one that keeps TREE's photos (DRIVE_PHOTOS_URL with KAYMBU_INBOX_KEY), which sends
   one email to each address so no family sees another's. The page builds the email and its photos, and the server
   decides who gets it, from the Family page's list, so while the Family page is in test mode only the testers do.
   The page keeps each send on the newsletter, with when it went, to how many, and whether it was a test. */
module.exports = function newsMail(o) {
  const { familyPage, drive, isDirector, log } = o;
  const one = (v, n) => String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, n);
  async function handle(P, body, me, req, res, { json, err }) {
    if (!isDirector(me)) { err(req, res, 403, 'Only the director sends email to families.'); return; }
    const classroom = one(body.classroom, 40).trim();
    const who = () => familyPage.mailList(classroom || '');
    if (P === 'newsletter/recipients') { const w = who(); json(req, res, 200, { test: w.test, count: w.list.length, kids: w.list.reduce((a, x) => a + x.kids.length, 0), mailOn: drive.on() }); return; }
    if (P === 'newsletter/send') {
      if (!drive.on()) { err(req, res, 400, 'The TREE mailbox is not connected, so email cannot go out yet.'); return; }
      const subject = one(body.subject, 200).replace(/\s+/g, ' ').trim(), html = one(body.html, 2e6), text = one(body.text, 2e5);
      if (!subject || !html) { err(req, res, 400, 'Add a subject first.'); return; }
      const images = (Array.isArray(body.images) ? body.images : []).slice(0, 24).filter(i => i && /^[a-z0-9]{1,20}$/.test(String(i.cid || '')) && /^[A-Za-z0-9+/=]+$/.test(String(i.data || '')) && String(i.data).length < 1.5e6)
        .map(i => ({ cid: String(i.cid), type: 'image/jpeg', data: String(i.data) }));
      const replyTo = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i.test(String(body.replyTo || '').trim()) ? String(body.replyTo).trim() : '';
      const w = who(); if (!w.list.length) { err(req, res, 400, w.test ? 'The Family page is in test mode and no tester is listed for this.' : 'No family email is on file for this.'); return; }
      let r; try { r = await drive.ask({ op: 'mail', to: w.list.map(x => x.email), subject, html, text, images, name: 'Fulton Community School', replyTo }, 300000); }
      catch (e) { log('Family email did not go out,', e.message); err(req, res, 502, /Unknown request/.test(e.message) ? 'The TREE mailbox script needs its update before it can send email.' : 'The TREE mailbox did not send it. ' + e.message); return; }
      log('Family email sent', subject, 'to', r.sent, 'of', w.list.length, w.test ? '(test mode)' : '', 'by', me);
      json(req, res, 200, { sent: Number(r.sent) || 0, failed: Array.isArray(r.failed) ? r.failed.length : 0, test: w.test, count: w.list.length, at: Date.now() }); return;
    }
    err(req, res, 404, 'Not found');
  }
  return { handle };
};
