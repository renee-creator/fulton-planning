'use strict';
/* Printing a book with Lulu (November 15, 2026).

   The page makes a book's two print files, the inside pages and the one-piece cover, and sends them here in parts.
   They are kept on this server's disk for a week at an address only Lulu is given, a key for that file alone in the
   address. Lulu downloads them from there to check them and to print them.

   The keys come from Render, never from the records. LULU_CLIENT_KEY and LULU_CLIENT_SECRET are the live keys.
   LULU_SANDBOX_KEY and LULU_SANDBOX_SECRET are the sandbox's, where nothing is printed or charged. When both are set,
   LULU_MODE chooses, sandbox unless it says live.

   An order is made by the director, after TREE has shown her the price. Lulu keeps an order unpaid until it is paid in
   her Lulu account, unless a card is saved there, and an unpaid order can be cancelled. Nothing here takes a payment. */
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = process.env.LULU_FILES_DIR || path.join(os.tmpdir(), 'tree-lulu');
const KEEP_MS = 7 * 864e5;
const PART_MAX = 12 * 1024 * 1024, FILE_MAX = 300 * 1024 * 1024;
const LEVELS = ['MAIL', 'PRIORITY_MAIL', 'GROUND_HD', 'GROUND_BUS', 'GROUND', 'EXPEDITED', 'EXPRESS'];
const ID_RE = /^[a-z0-9]{8,40}$/;
const POD_RE = /^\d{4}X\d{4}\.(FC|BW)\.(PRE|STD)\.[A-Z]{2}\.\d{3}[A-Z]{2}\d{3}\.[GM][A-Z][A-Z]$/;

function make({ SECRET, log, request }) {
  const env = () => {
    const live = { key: process.env.LULU_CLIENT_KEY || '', secret: process.env.LULU_CLIENT_SECRET || '' };
    const sand = { key: process.env.LULU_SANDBOX_KEY || '', secret: process.env.LULU_SANDBOX_SECRET || '' };
    const haveLive = !!(live.key && live.secret), haveSand = !!(sand.key && sand.secret);
    const mode = haveLive && haveSand ? (String(process.env.LULU_MODE || '').toLowerCase() === 'live' ? 'live' : 'sandbox') : haveLive ? 'live' : haveSand ? 'sandbox' : '';
    const base = process.env.LULU_API_BASE || (mode === 'live' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com');
    return { mode, base, creds: mode === 'live' ? live : sand };
  };
  // one request to Lulu, with a JSON body, answered with its JSON
  const send = request || ((method, url, headers, body) => new Promise((ok, no) => {
    const u = new URL(url); const data = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const q = (u.protocol === 'http:' ? require('http') : https).request({ method, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, headers: Object.assign({ Accept: 'application/json' }, data ? { 'Content-Length': Buffer.byteLength(data) } : {}, headers) }, r => {
      const c = []; r.on('data', x => c.push(x)); r.on('end', () => { const t = Buffer.concat(c).toString('utf8'); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {} ok({ status: r.statusCode, json: j, text: t }); });
    });
    q.setTimeout(60000, () => q.destroy(new Error('timeout'))); q.on('error', no); if (data) q.write(data); q.end();
  }));
  const reach = async (...a) => { try { return await send(...a); } catch (e) { log('Lulu could not be reached,', e.message); throw Object.assign(new Error('Lulu could not be reached. Try again in a moment.'), { code: 502 }); } };
  let token = { mode: '', value: '', until: 0 };
  async function auth() {
    const e = env(); if (!e.mode) throw Object.assign(new Error('Lulu is not connected. Add the Lulu keys in Render.'), { code: 503 });
    if (token.mode === e.mode && token.until > Date.now() + 60000) return token.value;
    const basic = Buffer.from(e.creds.key + ':' + e.creds.secret).toString('base64');
    const r = await reach('POST', e.base + '/auth/realms/glasstree/protocol/openid-connect/token', { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' }, 'grant_type=client_credentials');
    if (r.status !== 200 || !r.json || !r.json.access_token) { log('Lulu refused the keys,', r.status); throw Object.assign(new Error('Lulu did not accept the keys. Check them in Render.'), { code: 502 }); }
    token = { mode: e.mode, value: r.json.access_token, until: Date.now() + Math.max(60, Number(r.json.expires_in) || 300) * 1000 };
    return token.value;
  }
  async function call(method, p, body) {
    const e = env(); const t = await auth();
    const r = await reach(method, e.base + p, { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body);
    if (r.status >= 400) {
      const why = r.json ? JSON.stringify(r.json).slice(0, 600) : String(r.text || '').slice(0, 300);
      log('Lulu answered', r.status, 'on', p, why);
      throw Object.assign(new Error('Lulu could not do that. ' + why), { code: r.status === 401 || r.status === 403 ? 502 : 400, lulu: r.json });
    }
    return r.json;
  }

  /* the files. A file is kept as <id>.pdf once all its parts have come, and is taken away after a week. */
  const key = (id, e) => crypto.createHmac('sha256', SECRET).update('lulu|' + id + '|' + e).digest('base64url').slice(0, 32);
  const fileUrl = (origin, id) => { const e = (Date.now() + KEEP_MS).toString(36); return origin + '/lulu-file/' + id + '.pdf?t=' + e + '.' + key(id, e); };
  function checkKey(id, t) { const [e36, mac] = String(t || '').split('.'); const e = parseInt(e36, 36);
    if (!mac || !(e > Date.now()) || e > Date.now() + KEEP_MS + 36e5) return false; const want = key(id, e36);
    return want.length === mac.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac)); }
  function tidy() { try { for (const f of fs.readdirSync(DIR)) { const p = path.join(DIR, f); try { if (Date.now() - fs.statSync(p).mtimeMs > KEEP_MS) fs.unlinkSync(p); } catch (e) {} } } catch (e) {} }
  // one part of a file, in order. The last part makes the file whole.
  function part(b) {
    const id = String(b.id || ''), n = Number(b.n), total = Number(b.total);
    if (!ID_RE.test(id) || !(n >= 0) || !(total >= 1) || n >= total || total > 40 || typeof b.data !== 'string') throw Object.assign(new Error('That part of the file could not be read.'), { code: 400 });
    const buf = Buffer.from(b.data, 'base64'); if (!buf.length || buf.length > PART_MAX) throw Object.assign(new Error('That part of the file is too large.'), { code: 413 });
    fs.mkdirSync(DIR, { recursive: true }); if (n === 0) tidy();
    const tmp = path.join(DIR, id + '.part');
    if (n === 0) fs.writeFileSync(tmp, buf); else { if (!fs.existsSync(tmp) || fs.statSync(tmp).size === 0) throw Object.assign(new Error('The file was sent out of order. Try again.'), { code: 409 }); fs.appendFileSync(tmp, buf); }
    if (fs.statSync(tmp).size > FILE_MAX) { fs.unlinkSync(tmp); throw Object.assign(new Error('That file is too large to print.'), { code: 413 }); }
    if (n < total - 1) return { ok: true, done: false };
    const head = Buffer.alloc(5); const fd = fs.openSync(tmp, 'r'); fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd);
    if (head.toString('latin1') !== '%PDF-') { fs.unlinkSync(tmp); throw Object.assign(new Error('That file is not a PDF.'), { code: 400 }); }
    fs.renameSync(tmp, path.join(DIR, id + '.pdf'));
    return { ok: true, done: true, bytes: fs.statSync(path.join(DIR, id + '.pdf')).size };
  }
  const has = id => ID_RE.test(String(id || '')) && fs.existsSync(path.join(DIR, id + '.pdf'));
  // Lulu downloads a file, with the key in its address standing in for a sign-in
  function serve(req, res, p, q) {
    const m = p.match(/^\/lulu-file\/([a-z0-9]{8,40})\.pdf$/); const id = m && m[1];
    if (!id || !checkKey(id, q.get('t'))) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('This link has expired.'); return; }
    const f = path.join(DIR, id + '.pdf'); let size = 0; try { size = fs.statSync(f).size; } catch (e) {}
    if (!size) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': size, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') { res.end(); return; }
    const rs = fs.createReadStream(f); rs.on('error', () => { try { res.destroy(); } catch (e) {} }); rs.pipe(res);
  }

  const pod = v => { const s = String(v || ''); if (!POD_RE.test(s)) throw Object.assign(new Error('That book size and paper is not one TREE knows.'), { code: 400 }); return s; };
  const pages = v => { const n = Number(v); if (!Number.isInteger(n) || n < 24 || n > 800 || n % 2) throw Object.assign(new Error('A hardcover needs an even number of pages, at least 24.'), { code: 400 }); return n; };
  function address(a) { a = a || {}; const s = x => String(x || '').trim().slice(0, 120);
    const out = { name: s(a.name), street1: s(a.street1), street2: s(a.street2), city: s(a.city), state_code: s(a.state_code).toUpperCase().slice(0, 3), postcode: s(a.postcode).slice(0, 12), country_code: (s(a.country_code) || 'US').toUpperCase().slice(0, 2), phone_number: s(a.phone_number).slice(0, 30) };
    if (!out.name || !out.street1 || !out.city || !out.postcode || !out.phone_number) throw Object.assign(new Error('The shipping address needs a name, street, city, ZIP code and phone number.'), { code: 400 });
    if (!out.street2) delete out.street2; return out; }
  const level = v => { const s = String(v || 'GROUND').toUpperCase(); if (!LEVELS.includes(s)) throw Object.assign(new Error('That shipping choice is not one Lulu offers.'), { code: 400 }); return s; };

  // the books of one order, each with its own files and page count, all the same size and paper
  const lines = b => { const list = Array.isArray(b.items) && b.items.length ? b.items : [{ interior: b.interior, cover: b.cover, pages: b.pages, title: b.title, ref: b.ref }];
    if (list.length > 200) throw Object.assign(new Error('That is more books than one order takes.'), { code: 400 }); return list.map(x => Object.assign({}, x, { pages: pages(x.pages) })); };
  // what the page asks for, by its path after /api/lulu/
  async function api(what, b, origin) {
    const e = env();
    if (what === 'status') return { connected: !!e.mode, mode: e.mode };
    if (what === 'has') return { interior: has(b.interior), cover: has(b.cover) };
    if (what === 'part') return part(b);
    if (what === 'cover-size') { const r = await call('POST', '/cover-dimensions/', { pod_package_id: pod(b.pod), interior_page_count: pages(b.pages), unit: 'pt' }); return { width: Number(r.width), height: Number(r.height) }; }
    if (what === 'check') {
      if (!has(b.interior) || !has(b.cover)) throw Object.assign(new Error('The print files are no longer on the server. Make them again.'), { code: 409 });
      const p = pod(b.pod), n = pages(b.pages);
      const i = await call('POST', '/validate-interior/', { source_url: fileUrl(origin, b.interior), pod_package_id: p });
      const c = await call('POST', '/validate-cover/', { source_url: fileUrl(origin, b.cover), pod_package_id: p, interior_page_count: n });
      return { interior: i.id, cover: c.id };
    }
    if (what === 'checked') {
      const i = await call('GET', '/validate-interior/' + Number(b.interior) + '/'), c = await call('GET', '/validate-cover/' + Number(b.cover) + '/');
      return { interior: { status: i.status, errors: i.errors || null, pages: i.page_count }, cover: { status: c.status, errors: c.errors || null } };
    }
    // the shipping choices Lulu offers for this book to this address, each with its days and cost
    if (what === 'shipping') {
      const a = address(b.address);
      const p = pod(b.pod); const r = await call('POST', '/shipping-options/', { currency: 'USD', line_items: lines(b).map(x => ({ page_count: x.pages, pod_package_id: p, quantity: 1 })), shipping_address: { street1: a.street1, city: a.city, state: a.state_code, postcode: a.postcode, country: a.country_code } });
      const list = (Array.isArray(r) ? r : (r && r.results) || []).filter(o => o && LEVELS.includes(o.level));
      return { options: list.map(o => ({ level: o.level, cost: o.cost_excl_tax, from: o.min_delivery_date || '', to: o.max_delivery_date || '', business: !!o.business_only, home: !!o.home_only })) };
    }
    if (what === 'price') {
      const p = pod(b.pod); const r = await call('POST', '/print-job-cost-calculations/', { line_items: lines(b).map(x => ({ page_count: x.pages, pod_package_id: p, quantity: 1 })), shipping_address: address(b.address), shipping_option: level(b.level) });
      const books = (r.line_item_costs || []).reduce((t, x) => t + (Number(x && x.total_cost_incl_tax) || 0), 0);
      return { currency: r.currency, total: r.total_cost_incl_tax, tax: r.total_tax, shipping: r.shipping_cost && r.shipping_cost.total_cost_incl_tax, book: books ? books.toFixed(2) : '', count: (r.line_item_costs || []).length };
    }
    if (what === 'order') {
      const items = lines(b); if (items.some(x => !has(x.interior) || !has(x.cover))) throw Object.assign(new Error('The print files for a book are no longer on the server. Make its print preview again.'), { code: 409 });
      const email = String(b.email || '').trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Lulu needs an email for questions about the order.'), { code: 400 });
      const r = await call('POST', '/print-jobs/', { contact_email: email, external_id: String(b.ref || '').slice(0, 60), production_delay: 120, shipping_level: level(b.level), shipping_address: address(b.address),
        line_items: items.map(x => ({ title: String(x.title || 'Book').slice(0, 200), external_id: String(x.ref || '').slice(0, 60), quantity: 1, printable_normalization: { pod_package_id: pod(b.pod), interior: { source_url: fileUrl(origin, x.interior) }, cover: { source_url: fileUrl(origin, x.cover) } } })) });
      log('Lulu order made,', r.id, 'in', e.mode);
      return { id: r.id, status: r.status && r.status.name, mode: e.mode };
    }
    if (what === 'job') { const r = await call('GET', '/print-jobs/' + Number(b.id) + '/');
      const li = (r.status && r.status.line_item_statuses) || []; const track = li.map(x => x && x.messages && x.messages.tracking_urls).flat().filter(Boolean);
      return { id: r.id, status: r.status && r.status.name, message: r.status && r.status.message, total: r.costs && r.costs.total_cost_incl_tax, arrival: r.estimated_shipping_dates && r.estimated_shipping_dates.arrival_max, track }; }
    if (what === 'cancel') { const r = await call('PUT', '/print-jobs/' + Number(b.id) + '/status/', { name: 'CANCELED' }); return { status: r.name }; }
    throw Object.assign(new Error('Not found'), { code: 404 });
  }
  return { api, serve, env, _dir: DIR };
}
module.exports = { make, POD_RE, LEVELS };
