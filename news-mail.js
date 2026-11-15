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
      // a test to the director's own address goes there alone, whatever the Family page's mode
      const testTo = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i.test(String(body.testTo || '').trim()) ? String(body.testTo).trim().toLowerCase() : '';
      const w = testTo ? { test: true, list: [{ email: testTo, kids: [] }] } : who(); if (!w.list.length) { err(req, res, 400, w.test ? 'The Family page is in test mode and no tester is listed for this.' : 'No family email is on file for this.'); return; }
      let r; try { r = await drive.ask({ op: 'mail', to: w.list.map(x => x.email), subject, html, text, images, name: 'Fulton Community School', replyTo }, 300000); }
      catch (e) { log('Family email did not go out,', e.message); err(req, res, 502, /Unknown request/.test(e.message) ? 'The TREE mailbox script needs its update before it can send email.' : 'The TREE mailbox did not send it. ' + e.message); return; }
      log('Family email sent', subject, 'to', r.sent, 'of', w.list.length, w.test ? '(test mode)' : '', 'by', me);
      json(req, res, 200, { sent: Number(r.sent) || 0, failed: Array.isArray(r.failed) ? r.failed.length : 0, test: w.test, count: w.list.length, at: Date.now() }); return;
    }
    // each suggested article is opened here before it is offered, so a link that does not open, or opens somewhere
    // else, is never put in front of families. Only the trusted sites the newsletter reads from are fetched.
    if (P === 'newsletter/linkcheck') {
      const urls = (Array.isArray(body.urls) ? body.urls : []).slice(0, 8).map(u => String(u || '').trim());
      const out = await Promise.all(urls.map(u => checkLink(u)));
      json(req, res, 200, { list: out }); return;
    }
    err(req, res, 404, 'Not found');
  }
  const SITES = ['developingchild.harvard.edu', 'earlychildhood.stanford.edu', 'reggiochildren.it', 'reggioalliance.org', 'healthychildren.org', 'aap.org', 'zerotothree.org', 'naeyc.org', 'cdc.gov', 'first5california.com', 'cde.ca.gov', 'extension.psu.edu', 'childmind.org', 'pbs.org', 'kidshealth.org', 'eatright.org', 'myplate.gov', 'janetlansbury.com', 'rie.org', 'understood.org'];
  const siteOk = u => { try { const v = new URL(u); const h = v.hostname.replace(/^www\./, ''); return v.protocol === 'https:' && SITES.some(x => h === x || h.endsWith('.' + x)); } catch (e) { return false; } };
  async function checkLink(url) {
    if (!siteOk(url)) return { url, ok: false, why: 'not a trusted site' };
    if (process.env.LINKCHECK_TEST) return { url, ok: !/broken/.test(url), title: 'A test page', why: /broken/.test(url) ? 'did not open' : '' };
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 10000);
    try { const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (TREE, Fulton Community School newsletter link check)', Accept: 'text/html' } });
      const t = r.ok ? (await r.text()).slice(0, 200000) : '';
      const m = t.match(/<title[^>]*>([\s\S]*?)<\/title>/i); const title = m ? m[1].replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").trim().slice(0, 200) : '';
      // a page that redirects off the trusted site, or to a home page, is not the article
      const ok = r.ok && siteOk(r.url) && new URL(r.url).pathname.length > 1;
      return { url, ok, status: r.status, title, why: ok ? '' : r.ok ? 'opened somewhere else' : 'answered ' + r.status }; }
    catch (e) { return { url, ok: false, why: 'did not open' }; }
    finally { clearTimeout(tm); }
  }
  return { handle };
};
