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
    if (P === 'newsletter/recipients') { const w = who(); json(req, res, 200, { test: w.test, pageTest: !!w.pageTest, count: w.list.length, kids: w.list.reduce((a, x) => a + x.kids.length, 0), mailOn: drive.on() }); return; }
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
    // a letter to one family about their child, from a team inquiry. It goes to the child's parents and the classroom
    // inbox, with replies to the classroom inbox. A test goes to the director's own address alone (November 16, 2026)
    if (P === 'inquiry/family-mail' || P === 'inquiry/family-recipients') {
      const ids = (Array.isArray(body.children) ? body.children : []).slice(0, 6).map(v => one(v, 80));
      const w = familyPage.childMail(ids);
      if (P === 'inquiry/family-recipients') { json(req, res, 200, { parents: w.parents, count: w.list.length, kids: w.kids, replyTo: w.replyTo, mailOn: drive.on() }); return; }
      if (!drive.on()) { err(req, res, 400, 'The TREE mailbox is not connected, so email cannot go out yet.'); return; }
      const subject = one(body.subject, 200).replace(/\s+/g, ' ').trim(), html = one(body.html, 4e5), text = one(body.text, 1e5);
      if (!subject || !html) { err(req, res, 400, 'Add a subject and the letter first.'); return; }
      const testTo = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i.test(String(body.testTo || '').trim()) ? String(body.testTo).trim().toLowerCase() : '';
      if (!testTo && !w.parents) { err(req, res, 400, 'No parent email is on file for this child.'); return; }
      const to = testTo ? [testTo] : w.list;
      let r; try { r = await drive.ask({ op: 'mail', to, subject, html, text, images: [], name: 'Fulton Community School', replyTo: w.replyTo }, 120000); }
      catch (e) { log('Family letter did not go out,', e.message); err(req, res, 502, 'The TREE mailbox did not send it. ' + e.message); return; }
      log('Family letter sent', subject, 'to', r.sent, 'of', to.length, testTo ? '(test)' : '', 'by', me);
      json(req, res, 200, { sent: Number(r.sent) || 0, failed: Array.isArray(r.failed) ? r.failed.length : 0, test: !!testTo, count: to.length, parents: w.parents, at: Date.now() }); return;
    }
    // each suggested article is opened here before it is offered, so a link that does not open, or opens somewhere
    // else, is never put in front of families. Only the trusted sites the newsletter reads from are fetched.
    if (P === 'newsletter/linkcheck') {
      const urls = (Array.isArray(body.urls) ? body.urls : []).slice(0, 8).map(u => String(u || '').trim());
      const out = await Promise.all(urls.map(u => checkLink(u, !!body.any)));
      json(req, res, 200, { list: out }); return;
    }
    err(req, res, 404, 'Not found');
  }
  const SITES = ['developingchild.harvard.edu', 'earlychildhood.stanford.edu', 'reggiochildren.it', 'reggioalliance.org', 'healthychildren.org', 'aap.org', 'zerotothree.org', 'naeyc.org', 'cdc.gov', 'first5california.com', 'cde.ca.gov', 'extension.psu.edu', 'childmind.org', 'pbs.org', 'kidshealth.org', 'eatright.org', 'myplate.gov', 'janetlansbury.com', 'rie.org', 'understood.org'];
  const siteOk = u => { try { const v = new URL(u); const h = v.hostname.replace(/^www\./, ''); return v.protocol === 'https:' && SITES.some(x => h === x || h.endsWith('.' + x)); } catch (e) { return false; } };
  // a farm's own site can be anywhere, so for farms any public https address is opened, never a local or numbered one
  const publicOk = u => { try { const v = new URL(u); return v.protocol === 'https:' && /\.[a-z]{2,}$/i.test(v.hostname) && !/^(localhost|.*\.local|.*\.internal)$/i.test(v.hostname); } catch (e) { return false; } };
  async function checkLink(url, any) {
    if (!(any ? publicOk(url) : siteOk(url))) return { url, ok: false, why: any ? 'is not a web address' : 'not a trusted site' };
    if (process.env.LINKCHECK_TEST) return { url, ok: !/broken/.test(url), title: 'A test page', why: /broken/.test(url) ? 'did not open' : '' };
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 10000);
    try { const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (TREE, Fulton Community School newsletter link check)', Accept: 'text/html' } });
      const t = r.ok ? (await r.text()).slice(0, 200000) : '';
      const m = t.match(/<title[^>]*>([\s\S]*?)<\/title>/i); const title = m ? m[1].replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").trim().slice(0, 200) : '';
      // a page that redirects off the trusted site, or to a home page, is not the article
      const ok = r.ok && (any ? publicOk(r.url) : siteOk(r.url) && new URL(r.url).pathname.length > 1);
      return { url, ok, status: r.status, title, why: ok ? '' : r.ok ? 'opened somewhere else' : 'answered ' + r.status }; }
    catch (e) { return { url, ok: false, why: 'did not open' }; }
    finally { clearTimeout(tm); }
  }
  return { handle };
};
