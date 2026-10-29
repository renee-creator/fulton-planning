/* The museums and the plants on our site, for the whole community. The Family page and the public page places.html both
   draw them here, from what the server sends once the director turns each part on. The museum list is the director's
   own page, each place one line with its name linked to its own site, its town, a few words and its tags. The plants are
   each plant's card in the children's words, its full plant page and the field guide for each yard, with our own photo
   or a stand-in and its credit. Every part starts folded. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LINE = /^- \[(.+?)\]\((https?:\/\/[^)\s]+)\),\s*(.+?)(?<!\bSt)\.\s+(.*?)\s*\*([^*]+?)\.\*\s*$/;
  const tagOf = t => { const m = String(t).trim().match(/^([^(]+?)\s*(?:\((.+)\))?$/); return m ? { tag: m[1].trim(), note: (m[2] || '').trim() } : { tag: String(t).trim(), note: '' }; };
  function places(P) {
    const out = [];
    for (const part of (P && P.parts) || []) { let kind = '';
      for (const l of String(part.text || '').split('\n')) { const h = l.match(/^###\s+(.+)$/); if (h) { kind = h[1].trim(); continue; }
        const m = l.match(LINE); if (m) out.push({ area: part.key, kind, name: m[1], url: m[2], town: m[3], about: m[4], tags: m[5].split(/,\s*(?![^()]*\))/).map(tagOf).filter(x => x.tag) }); } }
    return out;
  }
  const tagText = x => x.tags.map(t => t.note ? t.tag + ' (' + t.note + ')' : t.tag).join(', ');
  const src = (base, p) => !p || !p.src ? '' : /^https?:/.test(p.src) ? p.src : base + p.src;
  // st holds what the reader chose, the area, the tag and the words searched for
  function html(c, st, base) {
    let h = '';
    if (c && c.places) {
      const all = places(c.places), areas = (c.places.parts || []).map(p => p.key);
      const n = new Map(); for (const x of all) for (const t of x.tags) n.set(t.tag, (n.get(t.tag) || 0) + 1);
      const tags = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0]);
      const q = String(st.q || '').trim().toLowerCase();
      const shown = all.filter(x => (st.area === 'All' || x.area === st.area) && (st.tag === 'All' || x.tags.some(t => t.tag === st.tag)) && (!q || [x.name, x.town, x.about, tagText(x)].join(' ').toLowerCase().includes(q)));
      const chip = (k, v, cur) => `<button type="button" class="cm-chip${cur === v ? ' on' : ''}" data-cm${k}="${esc(v)}" aria-pressed="${cur === v}">${esc(v)}</button>`;
      const filtered = st.area !== 'All' || st.tag !== 'All' || !!q;
      h += `<section class="card cm"><details ${st.placesOpen ? 'open' : ''} data-cmfold="places"><summary><h2 style="display:inline">Places to visit near us</h2></summary>
        ${c.places.lead ? `<p class="small muted">${esc(c.places.lead)}</p>` : ''}
        <div class="small" style="font-weight:700">Area</div><div class="cm-chips">${['All', ...areas].map(a => chip('area', a, st.area)).join('')}</div>
        <div class="small" style="font-weight:700">What it holds</div><div class="cm-chips">${['All', ...tags].map(t => chip('tag', t, st.tag)).join('')}</div>
        <label class="small">Find a place<input type="search" id="cm-q" value="${esc(st.q || '')}" placeholder="A place, a town or what it holds"></label>
        <p class="small muted">${shown.length} of ${all.length} places.</p>
        ${areas.map(a => { const xs = shown.filter(x => x.area === a); if (!xs.length) return ''; let kind = '';
          return `<details class="cm-area" ${filtered ? 'open' : ''}><summary><b>${esc(a)}</b> <span class="small muted">${xs.length}</span></summary>${xs.map(x => { const k = x.kind && x.kind !== kind ? `<div class="small" style="font-weight:700;margin-top:8px">${esc(x.kind)}</div>` : ''; kind = x.kind;
            return k + `<div class="cm-place"><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b></a> <span class="small muted">${esc(x.town)}</span><div class="small">${esc(x.about)}</div><div class="small muted">${esc(tagText(x))}</div></div>`; }).join('')}</details>`; }).join('') || '<p class="small muted">No place matches.</p>'}
      </details></section>`;
    }
    if (c && c.plants && ((c.plants.plants || []).length || (c.plants.fieldGuides || []).length)) {
      const img = (p, alt) => src(base, p) ? `<img src="${esc(src(base, p))}" alt="${esc(alt)}" loading="lazy" class="cm-img">${p.credit ? `<div class="small muted">${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.credit)}</a>` : esc(p.credit)}</div>` : ''}` : '';
      const eat = p => p.eat === 'food' ? 'Food' : p.eat === 'partly' ? 'Partly edible. ' + (p.taste || 'We taste only the part an adult names.') : 'Look, don\'t eat';
      h += `<section class="card cm"><details ${st.plantsOpen ? 'open' : ''} data-cmfold="plants"><summary><h2 style="display:inline">Plants on our site</h2></summary>
        ${(c.plants.plants || []).length ? `<div class="small" style="font-weight:700;margin-top:8px">Plant cards and full plant pages</div>${c.plants.plants.map(p => `<details class="cm-area"><summary><b>${esc(p.common)}</b>${p.botanical ? ` <i class="small muted">${esc(p.botanical)}</i>` : ''}</summary>
          ${img(p.photo, p.common)}${p.child ? `<p>${esc(p.child)}</p>` : ''}<p class="small"><b>${esc(eat(p))}</b>${p.gather ? '. Gather with an educator.' : ''}</p>${p.page && p.page !== '.' ? `<p class="small">${esc(p.page)}</p>` : ''}</details>`).join('')}` : ''}
        ${(c.plants.fieldGuides || []).length ? `<div class="small" style="font-weight:700;margin-top:10px">Who we might see in each yard</div>${c.plants.fieldGuides.map(f => `<details class="cm-area"><summary><b>${esc(f.title)}</b> <span class="small muted">${f.entries.length}</span></summary>
          <div class="cm-grid">${f.entries.map(e => `<div class="cm-tile">${src(base, e.photo) ? `<img src="${esc(src(base, e.photo))}" alt="${esc(e.name)}" loading="lazy">` : '<div class="cm-soft"></div>'}<b class="small">${esc(e.name)}</b>${e.line ? `<div class="small">${esc(e.line)}</div>` : ''}${e.photo && e.photo.credit ? `<div class="small muted">${esc(e.photo.credit)}</div>` : ''}</div>`).join('')}</div>
          <p class="small muted">${esc(f.intro || 'We look with our eyes and leave them be.')}</p></details>`).join('')}` : ''}
      </details></section>`;
    }
    return h;
  }
  const CSS = '.cm-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.cm-chip{border:1px solid #c9c1ad;background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:14px;cursor:pointer}.cm-chip.on{background:#2f5d46;color:#fff;border-color:#2f5d46}'
    + '.cm-area{border-top:1px solid #e3dccb;padding:6px 0}.cm-area>summary{cursor:pointer}.cm-place{padding:6px 0;border-bottom:1px dashed #e3dccb}.cm-img{width:100%;max-width:420px;border-radius:10px;display:block;margin:6px 0}'
    + '.cm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:6px}.cm-tile{min-width:0}.cm-tile img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px}.cm-soft{width:100%;aspect-ratio:4/3;border-radius:10px;background:#efe9da}'
    + '.cm input[type=search]{display:block;width:100%;box-sizing:border-box;margin:4px 0;padding:8px;border:1px solid #c9c1ad;border-radius:8px;font:inherit}';
  // the chips, the search and the folds, with draw to draw again after a choice
  function bind(el, st, draw) {
    el.addEventListener('click', e => { const b = e.target.closest('[data-cmarea],[data-cmtag]'); if (!b) return; if (b.dataset.cmarea) st.area = b.dataset.cmarea; else st.tag = b.dataset.cmtag; draw(); });
    el.addEventListener('input', e => { if (e.target.id !== 'cm-q') return; st.q = e.target.value; const at = e.target.selectionStart; draw(); const i = el.querySelector('#cm-q'); if (i) { i.focus(); try { i.setSelectionRange(at, at); } catch (er) {} } });
    el.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.cmfold) st[d.dataset.cmfold + 'Open'] = d.open; }, true);
  }
  root.TREE_COMMUNITY = { html, bind, places, CSS, state: () => ({ area: 'All', tag: 'All', q: '', placesOpen: false, plantsOpen: false }) };
})(typeof window !== 'undefined' ? window : this);
