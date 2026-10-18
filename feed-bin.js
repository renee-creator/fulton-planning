// The weekly FEED Sonoma bin. FEED posts each week's produce a few days ahead at feedsonoma.com/weekly-bin,
// with the farm for every item. The server reads that page, keeps each week as a record under bins/ in the
// records repository, and hands the weeks to TREE. A week stays as FEED last listed it before delivery, so the
// record grows into the year's history of what came, which the page uses to show what is new and what returns.
// Nothing here is written by Claude.

const https = require('https');

const FEED_URL = 'https://www.feedsonoma.com/weekly-bin';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function getPage(url, hops = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !/(^|\.)feedsonoma\.com$/i.test(u.hostname)) { reject(new Error('Only the FEED Sonoma site is read.')); return; }
    const req = https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (fulton-tree)', 'Accept': 'text/html,*/*' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) { res.resume(); resolve(getPage(new URL(res.headers.location, u).toString(), hops + 1)); return; }
      const chunks = []; let n = 0;
      res.on('data', c => { n += c.length; if (n > 4e6) { req.destroy(new Error('The FEED page is too large.')); return; } chunks.push(c); });
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.setTimeout(20000, () => req.destroy(new Error('FEED Sonoma did not answer in time.')));
    req.on('error', reject);
  });
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
function decode(s) {
  return String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(c) ? String.fromCodePoint(c) : m; }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
}
const plain = s => decode(String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\*+/g, '').replace(/\s+/g, ' ').trim();

// "Little gems, speckled OR green OR red (1 ea) - Seven Moons Farm // Paul's Produce (not in Keiki Bin)"
function parseItem(text) {
  let t = plain(text); if (!t) return null;
  const notKeiki = /not in keiki/i.test(t);
  t = t.replace(/\(\s*not in keiki bin\s*\)/ig, '').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s+[-–—]\s+/);
  const left = parts.length > 1 ? parts.slice(0, -1).join(' - ') : t;
  const farms = parts.length > 1 ? parts[parts.length - 1].split(/\s*\/\/\s*|\s+or\s+/i).map(s => s.trim()).filter(Boolean) : [];
  const qtys = [];
  let name = left.replace(/\(([^()]*)\)/g, (m, q) => { if (/\d|\bea\b|\bbu\b|\blb\b|\boz\b|pint|bag|bunch|half/i.test(q)) { qtys.push(q.trim()); return ''; } return m; });
  name = name.replace(/\s+OR\s+/g, ' or ').replace(/\s+,/g, ',').replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();
  if (!name) return null;
  return { name, qty: qtys.join(' or '), farms, notKeiki };
}

// "tues-wed October 20th-21st Deliveries"
function parseHeading(text, now) {
  const t = plain(text); if (!/deliver/i.test(t)) return null;
  const m = t.toLowerCase().match(new RegExp('(' + MONTHS.join('|') + ')\\s+(\\d{1,2})'));
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1]), day = Number(m[2]);
  const ref = now || new Date();
  let best = null;
  for (const y of [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]) {
    const d = new Date(Date.UTC(y, mon, day));
    if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d;
  }
  const date = best.toISOString().slice(0, 10);
  const days = (t.match(/^([a-z]+(?:\s*-\s*[a-z]+)?)/i) || [, ''])[1].toLowerCase().replace(/\s+/g, '');
  return { date, days, label: t.replace(/\s*deliveries?\s*$/i, '').trim(), tuesday: /^tue/.test(days) };
}

// every week listed on the page, in the order FEED lists them
function parseBinPage(html, now) {
  const body = String(html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const re = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  const weeks = []; let cur = null; let m;
  while ((m = re.exec(body))) {
    if (m[1]) { const h = parseHeading(m[2], now); if (h) { cur = Object.assign(h, { items: [] }); weeks.push(cur); } else if (cur && plain(m[2])) cur = null; continue; }
    if (!cur) continue;
    const it = parseItem(m[3]); if (it) cur.items.push(it);
  }
  return weeks.filter(w => w.items.length);
}

// a list typed or pasted by hand, one item to a line, in the same form FEED uses
function parsePasted(text) {
  return String(text || '').split(/\r?\n/).map(l => l.replace(/^\s*[-•*]\s*/, '')).map(parseItem).filter(Boolean);
}

module.exports = function feedBin({ store, log, noteChange, scheduleSave }) {
  const cache = { at: 0, weeks: null, error: '', checkedAt: 0 };
  const todayLA = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

  // a week is kept as FEED lists it until the day it is delivered, so a substitution posted late is caught,
  // and after that the record holds what came
  function keep(weeks, by) {
    const map = store.recs.bins; if (!map) return 0;
    const today = todayLA(); let n = 0;
    for (const w of weeks) {
      const id = w.date; const cur = map.get(id);
      const fields = { id, date: w.date, days: w.days, label: w.label, tuesday: !!w.tuesday, items: w.items, fetchedAt: Date.now(), source: by === 'FEED' ? 'feed' : 'hand' };
      if (cur && !cur.deleted) {
        if (w.date < today && cur.doc.items && cur.doc.items.length) continue;
        if (JSON.stringify(cur.doc.items) === JSON.stringify(w.items) && cur.doc.label === w.label) continue;
        Object.assign(cur.doc, fields, { updatedByName: by }); cur.local = true;
      } else map.set(id, { doc: Object.assign(fields, { updatedByName: by }), sha: cur && cur.sha, path: `bins/${id}.json`, local: true });
      noteChange('bins', id); scheduleSave('bins', id); n++;
    }
    return n;
  }

  async function check(force) {
    if (!force && cache.weeks && Date.now() - cache.at < 30 * 60000) return cache;
    if (cache.running) return cache.running;
    log('Reading the FEED bin page');
    cache.running = (async () => {
    try {
      // the whole read has 30 seconds, however FEED's server answers
      const r = await Promise.race([getPage(FEED_URL), new Promise((_, no) => setTimeout(() => no(new Error('FEED Sonoma did not answer in 30 seconds.')), 30000))]);
      log('FEED bin page answered', r.status, r.text.length + ' characters');
      if (r.status !== 200) throw new Error('FEED Sonoma answered ' + r.status + '.');
      const weeks = parseBinPage(r.text, new Date());
      if (!weeks.length) throw new Error('The FEED page was read, but no week of produce was found on it. FEED may have changed its page. The list can be added by hand.');
      cache.weeks = weeks; cache.at = Date.now(); cache.error = '';
      if (store.ready) { const n = keep(weeks, 'FEED'); if (n) log('FEED bin weeks kept or updated,', n); }
      log('FEED bin page read,', weeks.length, 'weeks listed');
    } catch (e) { log('Could not read the FEED bin', e.message);
      // a network failure reads as a plain sentence for staff, and the technical reason stays in the server log
      cache.error = /^(FEED Sonoma (answered|did not answer)|The FEED page was read)/.test(e.message) ? e.message : 'The FEED Sonoma page could not be reached just now. TREE tries again in a few hours, and the list can be added by hand.'; }
    cache.checkedAt = Date.now();
    return cache;
    })().finally(() => { cache.running = null; });
    return cache.running;
  }

  // read again every six hours, so the year's record fills in even on a week nobody opens the page
  setInterval(() => { if (store.ready) check(true).catch(() => {}); }, 6 * 3600e3).unref();
  // the first read waits until the records have loaded, however long that takes after a restart
  const first = () => { if (store.ready) check(true).catch(() => {}); else setTimeout(first, 60000).unref(); };
  setTimeout(first, 60000).unref();

  async function handle(path, me, body, reply) {
    if (path !== '/api/feed-bin') return false;
    if (body && typeof body.paste === 'string') {
      const date = String(body.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { reply(400, { error: 'Choose the day the bin arrives.' }); return true; }
      const items = parsePasted(body.paste);
      if (!items.length) { reply(400, { error: 'No produce was found. Put one item on each line.' }); return true; }
      const d = new Date(date + 'T12:00:00Z'); const tue = d.getUTCDay() === 2;
      keep([{ date, days: tue ? 'tues-wed' : '', label: d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' }), tuesday: tue, items }], me.name);
      log('FEED bin list added by hand by', me.name, date);
      reply(200, { ok: true, date }); return true;
    }
    const c = await check(!!(body && body.fresh));
    reply(200, { weeks: c.weeks || [], error: c.error || undefined, checkedAt: c.checkedAt ? new Date(c.checkedAt).toISOString() : undefined });
    return true;
  }

  return { handle, check, statusLine: () => [!cache.error, cache.error ? 'The FEED bin page could not be read. ' + cache.error : cache.weeks ? `The FEED bin page was read, ${cache.weeks.length} weeks listed.` : 'The FEED bin page has not been read yet.'] };
};
module.exports.parseBinPage = parseBinPage;
module.exports.parseItem = parseItem;
module.exports.parsePasted = parsePasted;
