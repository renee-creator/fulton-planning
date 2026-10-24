/* The Markdown the policies are kept in, read the same way on the Educators pages, the Family page and the public
   Family Handbook page, and for their prints. It is plain text. A line starting with ### is a heading, a dash a list
   item, a number and a full stop a numbered item, two spaces in front for each level inside a list, > an indented
   paragraph, | a table row, and ![words](picture) a picture. **bold**, *italic*, <u>underline</u> and [words](link) work
   inside a line, a line ending in two spaces breaks there, and a backslash keeps the next character as written. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LINK = /^\[((?:\\.|[^\]\\])*)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/;
  // a line of words as runs of text, each bold, italic, underlined or a link as it says
  function runs(s, base) {
    s = String(s || ''); base = base || {}; const out = []; let cur = '', b = !!base.b, i = !!base.i, u = !!base.u;
    const push = () => { if (cur) out.push({ text: cur, b, i, u, link: base.link || '' }); cur = ''; };
    for (let k = 0; k < s.length; k++) {
      const c = s[k], rest = s.slice(k);
      if (c === '\\' && k + 1 < s.length && /[\\*\[\]#>|\-.+_()!`<]/.test(s[k + 1])) { cur += s[k + 1]; k++; continue; }
      if (c === '\n') { push(); out.push({ br: true }); continue; }
      if (rest.startsWith('**') && (b || s.indexOf('**', k + 2) > k + 2)) { push(); b = !b; k++; continue; }
      if (c === '*' && !rest.startsWith('**') && (i || /^\*\S/.test(rest) && /[^\s*]\*(?!\*)/.test(s.slice(k + 1)))) { push(); i = !i; continue; }
      if (rest.startsWith('<u>') && s.indexOf('</u>', k) > 0) { push(); u = true; k += 2; continue; }
      if (rest.startsWith('</u>') && u) { push(); u = false; k += 3; continue; }
      if (c === '[' && !base.link) { const m = rest.match(LINK); if (m) { push(); out.push(...runs(m[1], { b, i, u, link: m[2] })); k += m[0].length - 1; continue; } }
      cur += c;
    }
    push(); return out;
  }
  const runsHtml = rs => rs.map(r => { if (r.br) return '<br>'; let h = esc(r.text); if (r.u) h = '<u>' + h + '</u>'; if (r.i) h = '<i>' + h + '</i>'; if (r.b) h = '<b>' + h + '</b>';
    return r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${h}</a>` : h; }).join('');
  const plain = rs => rs.map(r => r.br ? '\n' : r.text).join('');
  const LI = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
  const IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
  // a paragraph's lines, with a break wherever a line ends in two spaces
  const joinLines = ls => ls.map((l, n) => n < ls.length - 1 ? (/ {2,}$/.test(l) ? l.replace(/\s+$/, '') + '\n' : l.replace(/\s+$/, '') + ' ') : l.trim()).join('').replace(/^\s+/, '');
  function blocks(text) {
    const L = String(text || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
    const starts = l => /^#{1,4}\s/.test(l) || /^\s*\|/.test(l) || IMG.test(l.trim()) || /^>/.test(l) || LI.test(l);
    while (i < L.length) {
      const l = L[i];
      if (!l.trim()) { i++; continue; }
      let m = l.match(/^(#{1,4})\s+(.*)$/); if (m) { out.push({ t: 'h', level: m[1].length, runs: runs(m[2].trim()) }); i++; continue; }
      m = l.trim().match(IMG); if (m) { out.push({ t: 'img', alt: m[1], src: m[2] }); i++; continue; }
      if (/^\s*\|/.test(l)) { const rows = []; while (i < L.length && /^\s*\|/.test(L[i])) { rows.push(L[i]); i++; }
        const cells = r => { const x = r.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, ''); return x.split(/(?<!\\)\|/).map(c => runs(c.trim())); };
        out.push({ t: 'table', rows: rows.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(cells) }); continue; }
      if (/^>/.test(l)) { const q = []; while (i < L.length && /^>/.test(L[i])) { q.push(L[i].replace(/^>\s?/, '')); i++; } for (const b of blocks(q.join('\n'))) { b.quote = true; out.push(b); } continue; }
      if (LI.test(l)) {
        const items = [];
        while (i < L.length) {
          const x = L[i]; const lm = x.match(LI);
          if (lm) { items.push({ level: Math.floor(lm[1].replace(/\t/g, '  ').length / 2), ordered: /\d/.test(lm[2]), lines: [lm[3]] }); i++; continue; }
          // a line indented under an item carries the item on
          if (x.trim() && /^\s/.test(x) && items.length && !/^\s*\|/.test(x)) { items[items.length - 1].lines.push(x.trim() + (/ {2,}$/.test(x) ? '  ' : '')); i++; continue; }
          break;
        }
        // numbered items count from one within each list and level
        const count = {}; let prev = -1;
        for (const it of items) { if (it.level < prev) for (const k of Object.keys(count)) if (+k > it.level) delete count[k]; if (it.level > prev) count[it.level] = 0; prev = it.level;
          it.n = it.ordered ? (count[it.level] = (count[it.level] || 0) + 1) : 0; it.runs = runs(joinLines(it.lines)); delete it.lines; }
        out.push({ t: 'list', items }); continue;
      }
      const p = []; while (i < L.length && L[i].trim() && !(p.length && starts(L[i]))) { p.push(L[i]); i++; }
      out.push({ t: 'p', runs: runs(joinLines(p)) });
    }
    return out;
  }
  // the blocks as a page. pic(src, alt) gives a picture's tag, so each page fetches pictures its own way.
  function html(text, pic) {
    let h = ''; const B = blocks(text); let q = false;
    for (const b of B) {
      if (!!b.quote !== q) { h += q ? '</blockquote>' : '<blockquote>'; q = !!b.quote; }
      if (b.t === 'h') h += `<h${Math.min(5, b.level + 1)}>${runsHtml(b.runs)}</h${Math.min(5, b.level + 1)}>`;
      else if (b.t === 'img') h += `<figure class="pmimg">${pic ? pic(b.src, b.alt) : `<span class="muted">${esc(b.alt || 'A picture')}</span>`}</figure>`;
      else if (b.t === 'table') h += `<div class="tw"><table>${b.rows.map((r, k) => `<tr>${r.map(c => k === 0 ? `<th>${runsHtml(c)}</th>` : `<td>${runsHtml(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
      else if (b.t === 'list') {
        let lv = -1; const open = [];
        for (const it of b.items) {
          while (lv > it.level) { h += `</li></${open.pop()}>`; lv--; }
          // a numbered list straight after a bulleted one at the same level starts its own list
          if (lv === it.level && open[lv] !== (it.ordered ? 'ol' : 'ul')) { h += `</li></${open.pop()}>`; lv--; }
          if (lv === it.level) h += '</li>';
          while (lv < it.level) { const tag = it.ordered ? 'ol' : 'ul'; h += `<${tag}>`; open.push(tag); lv++; if (lv < it.level) h += '<li class="pmnest">'; }
          h += `<li>${runsHtml(it.runs)}`;
        }
        while (open.length) h += `</li></${open.pop()}>`;
      } else h += `<p>${runsHtml(b.runs)}</p>`;
    }
    if (q) h += '</blockquote>';
    return `<div class="pmd">${h}</div>`;
  }
  root.PolicyMd = { blocks, html, runs, plain, esc };
})(typeof window !== 'undefined' ? window : module.exports);
