// FEED Cooperative order confirmations, read into the farm-level purchase records the CDFA food procurement worksheet asks
// for. A confirmation lists each item with its producer, unit, price and quantity. It can arrive as a whole email file
// (.eml), as the email's HTML, or as its plain text.

function decodeQP(s) { return String(s).replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))); }
function utf8(s) { try { return Buffer.from(s, 'latin1').toString('utf8'); } catch (e) { return s; } }
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—' };
const decode = s => String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m));
const plain = s => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const money = s => { const m = String(s || '').replace(/,/g, '').match(/-?\$?\s*(-?\d+(?:\.\d+)?)/); return m ? Math.round(parseFloat(m[1]) * 100) / 100 : null; };

// the HTML part of a whole email, decoded
function htmlOf(raw) {
  const s = String(raw || '');
  if (!/^[\w-]+:\s/m.test(s.slice(0, 400)) || /<table/i.test(s.slice(0, 2000))) return s;
  const parts = s.split(/\r?\n--[^\r\n]+\r?\n/);
  for (const p of parts) {
    if (!/content-type:\s*text\/html/i.test(p)) continue;
    const i = p.search(/\r?\n\r?\n/); let body = i >= 0 ? p.slice(i).trim() : p;
    if (/content-transfer-encoding:\s*quoted-printable/i.test(p)) body = utf8(decodeQP(body));
    else if (/content-transfer-encoding:\s*base64/i.test(p)) body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
    return body;
  }
  return /quoted-printable/i.test(s) ? utf8(decodeQP(s)) : s;
}

function dateOf(text, re) {
  const m = text.match(re); if (!m) return '';
  let [mo, d, y] = m[1].split('/').map(Number); if (y < 100) y += 2000;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseOrder(raw) {
  const html = htmlOf(raw); const text = plain(html);
  const order = (text.match(/(?:Confirmation\/Invoice|Order)\s*#\s*(\d+)/i) || [])[1] || '';
  const fulfilled = dateOf(text, /Fulfillment on [A-Za-z]+,?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const placed = dateOf(text, /placed on\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const items = [];
  for (const row of html.split(/<tr\b[^>]*>/i).slice(1)) {
    const r = row.split(/<\/tr>/i)[0];
    if (/<th\b/i.test(r)) continue;
    const cells = r.split(/<td\b[^>]*>/i).slice(1).map(c => plain(c));
    if (cells.length < 6) continue;
    const [item, producer, unit, price, qty, total] = cells;
    if (!item || money(total) == null) continue;
    items.push({ item, producer, unit, price: money(price), qty: Number(String(qty).replace(/[^\d.]/g, '')) || 0, total: money(total) });
  }
  const after = label => { const m = text.match(new RegExp(label + '\\s*:?\\s*(\\$\\s*[\\d,.]+)', 'i')); return m ? money(m[1]) : null; };
  return { order, placed, fulfilled, items, subtotal: after('Order Subtotal'), delivery: after('Delivery Fee'), total: after('Order Total'), distributor: 'FEED Cooperative' };
}

module.exports = { parseOrder };
