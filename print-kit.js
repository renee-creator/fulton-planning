/* One builder for every print TREE makes, PDF and Word, and one reader for each kind of file someone uploads.
   TREE, the Educators pages and the Conferences page all make their files here. The kit loads each library from one
   address, keeps the one typeface, Andika, for every sheet, names the page sizes a print can use, letter, half letter
   and a larger poster, and reads an uploaded PDF or Word file the same way wherever it is uploaded. What each print
   holds and how it is laid out stays with the print, so every print looks as it did.

   Two layouts live here as well, placeSheet and childHeight, each returning a jsPDF document the caller previews or
   saves. Both take plain data, never a record, so the page that calls them chooses the words and the photos.

   TREE_KIT.placeSheet(input) -> Promise<jsPDF>. One centred letter page.
     input = {
       title: 'Our place this week',            // the sheet's title, set large
       sub: 'Week of November 2, 2026',        // optional, a small line under the title
       groups: [                                // three short groups, in this order, each a few lines
         { heading: 'What is growing',  lines: ['Fava beans in the north bed', 'Calendula'], photo: PHOTO },
         { heading: 'Our animals this week', lines: ['The goats moved to the orchard'], photo: PHOTO },
         { heading: "This week's bin", lines: ['Delicata squash, Bernier Farms, Healdsburg'], photo: PHOTO }
       ],
       foot: 'Fulton Community School',        // optional, a small line at the foot
       school: true                             // optional, puts Fulton Community School & Farm above the title
     }
     PHOTO = { url: 'data:image/jpeg;base64,...', w: 1600, h: 1200 }   // a real photo as a data URL with its size, or omitted
     A group with no photo takes the full width for its lines. Lines are cut to what fits so the sheet stays one page.

   TREE_KIT.childHeight(input) -> Promise<jsPDF>. The wall's sheet with children's words, half letter, two to a letter page.
     input = {
       title: 'How tall am I?',                 // optional, a small heading on every sheet
       sheets: [                                // one half-letter sheet each, printed two to a letter page, side by side
         { photo: PHOTO,                        // first on the sheet, taking most of it, optional
           words: 'I am as tall as the sunflower.',   // the child's words, set large
           name: 'Wren',                        // optional, the child's name as the caller chose it, so names follow the printing setting
           line: 'November 2, 2026, North class' }     // optional, a small line under the words
       ],
       foot: 'Fulton Community School'          // optional
     }
     Photos come to both layouts already loaded by the caller, so the kit never fetches. The caller softens faces or
     chooses names before calling. Each sheet is cut on the dotted line down the middle of the page.

   Every print also passes through the kit on its way out (November 7, 2026).
   TREE_KIT.guard(docs, quiet) -> the pages worth printing, or null. A print with nothing in it, such as an agenda with
     no blocks, an evaluation with nothing scored or a slide with no title and no photo, shows Nothing to print yet and
     no file is made. TREE_KIT.isEmpty(doc) checks one page, TREE_KIT.printable(docs) keeps the ones that hold something.
   TREE_KIT.cardsPerHtml() and TREE_KIT.signSizeHtml() are the small choices shown beside a card set's print buttons,
     Cards per page 1, 2 or 4 and Sign size Letter, Half letter or 18 by 24. Each device remembers its last choice.
   TREE_KIT.takeArmed() gives, once, the choice made with the card set's button just tapped, and TREE_KIT.pagePlan(doc,
     armed) how each of that doc's pages is set. TREE_KIT.repage(blob, plan) -> Promise<Blob> sets the finished PDF two
     or four cards to a letter page with dotted cut lines, and a sign on half letter or the poster, scaled whole. */
(function (root) {
  'use strict';
  const LIB = {
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    docx: 'https://cdn.jsdelivr.net/npm/docx@9.8.1/dist/index.iife.js',
    pdflib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    fontkit: 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
  };
  // a script is loaded once. With a name, what it sets on the page is handed back.
  function loadScript(src, globalName) {
    return new Promise((res, rej) => {
      if (globalName && root[globalName]) return res(root[globalName]);
      const had = document.querySelector('script[src="' + src + '"]');
      const done = () => globalName ? (root[globalName] ? res(root[globalName]) : rej(new Error('load'))) : res();
      if (had && !globalName) return res();
      // a script tag that is there without what it brings, such as one that failed to load, is tried again
      const fresh = !had || !!globalName; const sc = fresh ? document.createElement('script') : had;
      sc.addEventListener('load', done); sc.addEventListener('error', () => rej(new Error('load')));
      if (fresh) { sc.src = src; document.head.appendChild(sc); }
    });
  }

  // the page sizes a print can use, in points, 72 to the inch
  const SIZES = {
    letter: { w: 612, h: 792, name: 'Letter' },
    half: { w: 396, h: 612, name: 'Half letter' },
    poster: { w: 1296, h: 1728, name: 'Poster, 18 by 24 inches' }
  };

  // Andika, made by SIL for children learning to read, kept unchanged in the fonts folder with its license. Each key is
  // a role a print gives its words, bold or regular.
  const PF = {
    files: { bs: 'Andika-Bold.ttf', bm: 'Andika-Regular.ttf', fr: 'Andika-Regular.ttf', fs: 'Andika-Bold.ttf' },
    pdf: { 'Andika-Bold.ttf': 'pfB', 'Andika-Regular.ttf': 'pfR' },
    word: { bs: 'Andika', bm: 'Andika', fr: 'Andika', fs: 'Andika' }, buf: null, b64: null, wait: null
  };
  function fonts() {
    if (PF.buf) return Promise.resolve(true);
    if (!PF.wait) PF.wait = (async () => {
      try {
        const buf = {}, b64 = {}, got = {};
        await Promise.all([...new Set(Object.values(PF.files))].map(async f => {
          const r = await fetch('fonts/' + f); if (!r.ok) throw new Error('font');
          const u = new Uint8Array(await r.arrayBuffer()); let s = '';
          for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
          got[f] = { u, b: btoa(s) };
        }));
        for (const [k, f] of Object.entries(PF.files)) { buf[k] = got[f].u; b64[k] = got[f].b; }
        PF.buf = buf; PF.b64 = b64;
        try {
          if (typeof FontFace !== 'undefined' && document.fonts) {
            await Promise.all(Object.keys(buf).map(async k => { const f = new FontFace('PF' + k, buf[k].buffer.slice(0)); await f.load(); document.fonts.add(f); }));
            PF.face = true;
          }
        } catch (e) {}
        return true;
      } catch (e) { PF.wait = null; return false; }
    })();
    return PF.wait;
  }
  // each file is added once, so a PDF carries Andika Regular and Andika Bold one time each
  function pdfFonts(doc) {
    if (!PF.b64 || doc.__pf) return;
    const done = new Set();
    for (const [k, f] of Object.entries(PF.files)) { if (done.has(f)) continue; done.add(f); doc.addFileToVFS(f, PF.b64[k]); doc.addFont(f, PF.pdf[f], 'normal'); }
    doc.__pf = true;
  }
  function wordFonts() { return PF.buf ? [{ name: 'Andika', data: PF.buf.fr }] : []; }

  // a new PDF, in points. A named size, letter, half or poster, sets the sheet. Andika is set in it once loaded.
  function pdf(o) {
    o = Object.assign({ unit: 'pt' }, o || {});
    if (o.size) { const s = SIZES[o.size]; if (s) o.format = [s.w, s.h]; delete o.size; }
    const d = new root.jspdf.jsPDF(o); pdfFonts(d); return d;
  }
  // the Word library, and a new Word document made from it. A named size sets the page on each section that has none.
  function word() { return loadScript(LIB.docx, 'docx'); }
  function wordFile(D, o) {
    if (o && o.size) {
      const s = SIZES[o.size]; const rest = Object.assign({}, o); delete rest.size;
      if (s) rest.sections = (rest.sections || []).map(sec => { const p = Object.assign({}, sec.properties || {}); const pg = Object.assign({}, p.page || {});
        if (!pg.size) pg.size = { width: s.w * 20, height: s.h * 20 }; p.page = pg; return Object.assign({}, sec, { properties: p }); });
      return new D.Document(rest);
    }
    return new D.Document(o);
  }
  function wordBlob(D, doc) { return D.Packer.toBlob(doc); }
  // pdf-lib, for putting PDFs together and drawing a form on a sheet, with fontkit when Andika is drawn into it
  async function pdfLib(withFonts) { const L = await loadScript(LIB.pdflib, 'PDFLib'); if (withFonts) await loadScript(LIB.fontkit, 'fontkit'); return L; }

  /* ---------- reading what someone uploads ---------- */
  async function pdfjs() { await loadScript(LIB.pdfjsWorker, 'pdfjsWorker'); return loadScript(LIB.pdfjs, 'pdfjsLib'); }
  // a PDF's words, page by page, with where each line sits and whether the page holds a picture
  async function readPdf(file, o) {
    o = o || {};
    const lib = await pdfjs();
    const data = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const doc = await lib.getDocument({ data }).promise;
    let text = ''; const pages = [], pageTexts = [], pageImgs = [];
    const IMG = new Set([lib.OPS.paintImageXObject, lib.OPS.paintJpegXObject, lib.OPS.paintInlineImageXObject].filter(x => x != null));
    const last = Math.min(doc.numPages, o.maxPages || doc.numPages);
    for (let p = 1; p <= last; p++) {
      const pg = await doc.getPage(p); const vp = pg.getViewport({ scale: 1 }); const tc = await pg.getTextContent();
      if (o.layout !== false) {
        try { const ops = await pg.getOperatorList(); pageImgs.push(ops.fnArray.some(f => IMG.has(f))); } catch (e) { pageImgs.push(false); }
        pages.push({ width: vp.width, items: tc.items.map(i => ({ str: i.str, x: i.transform[4], y: vp.height - i.transform[5] })) });
      }
      const t = o.joined ? tc.items.map(x => x.str).join(' ').trim() : tc.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('');
      pageTexts.push(t); text += t + '\n\n';
      if (!o.keep) { try { pg.cleanup(); } catch (e) {} }
    }
    return { lib, doc, numPages: doc.numPages, text, pages, pageTexts, pageImgs };
  }
  // one page of a PDF as a picture, by a set width, or scaled so its longer side is no more than maxSide
  async function pageImage(doc, p, o) {
    o = o || {};
    const pg = await doc.getPage(p); const vp0 = pg.getViewport({ scale: 1, rotation: ((o.turn || 0) + pg.rotate) % 360 });
    const scale = o.width ? Math.min(o.maxScale || Infinity, o.width / vp0.width) : Math.min(o.maxScale || 2.5, (o.maxSide || 1800) / Math.max(vp0.width, vp0.height));
    const vp = pg.getViewport({ scale, rotation: ((o.turn || 0) + pg.rotate) % 360 });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const g = c.getContext('2d'); if (o.white) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    // the canvas is let go of at once, so a phone keeps its memory
    try { await pg.render({ canvasContext: g, viewport: vp }).promise; return await new Promise(r => c.toBlob(b => r(b), 'image/jpeg', o.quality || 0.9)); }
    finally { if (o.free) { c.width = c.height = 0; try { pg.cleanup(); } catch (e) {} } }
  }
  // a Word file's words. With tables, each cell ends with a bar and each row, paragraph and heading with a new line.
  async function readDocx(file, o) {
    o = o || {};
    const mm = await loadScript(LIB.mammoth, 'mammoth'); const arrayBuffer = await file.arrayBuffer();
    if (!o.tables) return (await mm.extractRawText({ arrayBuffer })).value;
    const r = await mm.convertToHtml({ arrayBuffer });
    const div = document.createElement('div'); div.innerHTML = r.value;
    div.querySelectorAll('td,th').forEach(td => td.append(' | ')); div.querySelectorAll('tr,p,li,h1,h2,h3').forEach(el => el.append('\n'));
    return div.textContent.replace(/\n{3,}/g, '\n\n');
  }

  /* ---------- two layouts, the place sheet and the children's height sheets ---------- */
  const INK = [27, 41, 32], MUTED = [79, 95, 85], MOSS = [43, 90, 64], LINE = [198, 208, 195];
  async function newDoc(o) { await loadScript(LIB.jspdf, 'jspdf'); await fonts(); return pdf(o); }
  const setFont = (d, bold) => { if (PF.b64) d.setFont(bold ? 'pfB' : 'pfR', 'normal'); else d.setFont('helvetica', bold ? 'bold' : 'normal'); };
  const setCol = (d, c) => d.setTextColor(c[0], c[1], c[2]);
  const str = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  // a photo drawn inside a box, kept whole and centred, from a data URL with its size
  function drawPhoto(d, p, x, y, w, h) {
    if (!p || !p.url) return null; const pw = Number(p.w) || 4, ph = Number(p.h) || 3; const k = Math.min(w / pw, h / ph); const iw = pw * k, ih = ph * k;
    const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
    try { d.addImage(p.url, /png/i.test(p.url.slice(0, 20)) ? 'PNG' : 'JPEG', ix, iy, iw, ih, undefined, 'FAST'); } catch (e) { return null; }
    return { x: ix, y: iy, w: iw, h: ih };
  }
  // lines of words set in a width, each line that fits, cut to a number of lines when asked
  function wrap(d, text, w, size, bold, max) { setFont(d, bold); d.setFontSize(size); let out = []; for (const t of [].concat(text)) out = out.concat(d.splitTextToSize(str(t), w)); return max ? out.slice(0, max) : out; }
  function textLines(d, lines, x, y, size, color, align, lh) { setCol(d, color); d.setFontSize(size); for (const l of lines) { d.text(l, x, y, align ? { align } : undefined); y += size * (lh || 1.3); } return y; }

  async function placeSheet(input) {
    const o = input || {}; const d = await newDoc({ size: 'letter' }); const W = 612, H = 792, M = 48; const cw = W - 2 * M;
    let y = M;
    if (o.school) { setFont(d, true); setCol(d, MOSS); d.setFontSize(9.5); d.setCharSpace(.5); d.text('FULTON COMMUNITY SCHOOL & FARM', W / 2, y + 8, { align: 'center' }); d.setCharSpace(0); y += 22; }
    let ts = 30, tl; for (;;) { tl = wrap(d, o.title || 'Our place this week', cw, ts, true); if (tl.length <= 2 || ts <= 20) break; ts -= 2; }
    setFont(d, true); y = textLines(d, tl, W / 2, y + ts * .85, ts, INK, 'center', 1.12) - ts * .12;
    if (o.sub) { setFont(d, false); y = textLines(d, wrap(d, o.sub, cw, 12, false, 1), W / 2, y + 8, 12, MUTED, 'center') + 2; }
    y += 14; d.setDrawColor(LINE[0], LINE[1], LINE[2]); d.setLineWidth(.8); d.line(M, y, W - M, y); y += 14;
    const groups = (Array.isArray(o.groups) ? o.groups : []).slice(0, 3);
    const foot = str(o.foot); const bottom = H - M - (foot ? 18 : 0);
    const gap = 16; const each = groups.length ? (bottom - y - gap * (groups.length - 1)) / groups.length : 0;
    for (const g of groups) {
      const top = y; const hasPhoto = !!(g.photo && g.photo.url); const pw = hasPhoto ? Math.min(cw * .42, each * 1.25) : 0; const tw = cw - (hasPhoto ? pw + 18 : 0);
      setFont(d, true); d.setFontSize(15); setCol(d, MOSS); d.text(str(g.heading), M, top + 15);
      let yy = top + 15 + 12;
      const size = 13.5; const maxLines = Math.max(1, Math.floor((top + each - yy) / (size * 1.38)));
      const ls = wrap(d, (Array.isArray(g.lines) ? g.lines : [g.lines]).map(str).filter(Boolean), tw, size, false, maxLines);
      setFont(d, false); textLines(d, ls, M, yy + size * .9, size, INK, '', 1.38);
      if (hasPhoto) drawPhoto(d, g.photo, W - M - pw, top + 2, pw, each - 4);
      y = top + each + gap;
    }
    if (foot) { setFont(d, false); textLines(d, [foot], W / 2, H - M + 4, 9.5, MUTED, 'center'); }
    return d;
  }

  async function childHeight(input) {
    const o = input || {}; const d = await newDoc({ size: 'letter', orientation: 'landscape' }); const W = 792, H = 612; const sw = W / 2, M = 34;
    const sheets = Array.isArray(o.sheets) ? o.sheets : [];
    const one = (s, ox) => {
      const cw = sw - 2 * M; let y = M;
      if (o.title) { setFont(d, true); d.setFontSize(10); setCol(d, MOSS); d.setCharSpace(.5); d.text(str(o.title).toUpperCase(), ox + sw / 2, y + 6, { align: 'center' }); d.setCharSpace(0); y += 20; }
      const words = str(s.words); const foot = str(o.foot); const bottom = H - M - (foot ? 16 : 0);
      // the words are set as large as the room allows, from 34 points down to 18, in at most four lines
      let size = 34, wl; for (;;) { wl = wrap(d, words, cw, size, true); if (wl.length <= 4 || size <= 18) break; size -= 2; }
      const nameH = s.name ? 18 : 0, lineH = s.line ? 14 : 0; const wordsH = wl.length * size * 1.18 + nameH + lineH + 24;
      const hasPhoto = !!(s.photo && s.photo.url); const ph = hasPhoto ? Math.max(120, bottom - y - wordsH) : 0;
      if (hasPhoto) { drawPhoto(d, s.photo, ox + M, y, cw, ph); y += ph + 16; }
      else y += Math.max(0, (bottom - y - wordsH) / 2);
      setFont(d, true); y = textLines(d, wl, ox + sw / 2, y + size * .85, size, INK, 'center', 1.18) - size * .1;
      if (s.name) { setFont(d, true); y = textLines(d, [str(s.name)], ox + sw / 2, y + 6, 13, MOSS, 'center'); }
      if (s.line) { setFont(d, false); textLines(d, wrap(d, s.line, cw, 10.5, false, 1), ox + sw / 2, y + 4, 10.5, MUTED, 'center'); }
      if (foot) { setFont(d, false); textLines(d, [foot], ox + sw / 2, H - M + 6, 9, MUTED, 'center'); }
    };
    for (let i = 0; i < Math.max(1, sheets.length); i += 2) {
      if (i) d.addPage([W, H], 'landscape');
      const a = sheets[i] || { words: '' }, b = sheets[i + 1];
      one(a, 0); if (b) one(b, sw);
      // the dotted line down the middle, where the page is cut in two
      d.setDrawColor(LINE[0], LINE[1], LINE[2]); d.setLineWidth(.6); d.setLineDashPattern([3, 4], 0); d.line(sw, 18, sw, H - 18); d.setLineDashPattern([], 0);
    }
    return d;
  }

  /* ---------- nothing to print, cards per page and sign sizes ---------- */
  // a print with nothing in it is never made. A page counts when it holds words, a list, a table or a photo. A title and
  // a date alone, such as an agenda with no blocks or a slide with no title and no photo, do not. A set with something
  // in it prints whole, its cover sheet included.
  const filled = v => v == null ? false : typeof v === 'string' ? !!v.replace(/[\s_.…-]+/g, '') : typeof v === 'number' ? true
    : Array.isArray(v) ? v.some(filled) : typeof v === 'object' ? Object.values(v).some(filled) : !!v;
  const CONTENT = ['text', 'words', 'lines', 'items', 'rows', 'cols', 'tiles', 'web', 'q', 'a', 'name', 'materials', 'fields', 'labels'];
  function blockFilled(b) {
    if (!b || typeof b !== 'object') return false;
    if (b.t === 'photo') return !!(b.key || b.src);
    if (b.t === 'fill') return true;
    if (b.t === 'rule' || b.t === 'sub' || b.t === 'label' || b.t === 'break') return false;
    return CONTENT.some(k => filled(b[k]));
  }
  function isEmpty(p) {
    if (!p || typeof p !== 'object') return true;
    // a plan form, or a blank form made to be filled in by hand, always prints
    if (p.blank || (!p.display && !p.centered)) return false;
    if ((p.photos || []).some(x => x && (x.key || x.src))) return false;
    if ((p.blocks || []).some(blockFilled)) return false;
    return true;
  }
  // the first page stays as the set's cover, and any later page with nothing on it is left out
  const printable = list => { const L = (Array.isArray(list) ? list : [list]).filter(Boolean); return L.some(p => !isEmpty(p)) ? L.filter((p, i) => i === 0 || !isEmpty(p)) : []; };
  function nothing() {
    const msg = 'Nothing to print yet';
    if (typeof root.toast === 'function') { root.toast(msg); return; }
    try { const el = document.createElement('div'); el.setAttribute('role', 'status'); el.textContent = msg;
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1b2920;color:#fff;padding:10px 16px;border-radius:10px;font:15px system-ui,sans-serif;z-index:9999';
      document.body.appendChild(el); setTimeout(() => el.remove(), 3200); } catch (e) {}
  }
  // the pages worth printing, or null after the notice when there are none
  function guard(list, quiet) { const L = printable(list); if (L.length) return L; if (!quiet) nothing(); return null; }

  // each device keeps its own last choice
  const keep = { get(k, d) { try { const v = root.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} } };
  function cardsPer() { const n = +keep.get('tree-cards-per', '1'); return [1, 2, 4].includes(n) ? n : 1; }
  function signSize() { const s = keep.get('tree-sign-size', 'letter'); return SIZES[s] ? s : 'letter'; }
  const seg = (label, attr, opts, cur) => `<span class="tkchoice" style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="cnt">${label}</span><span class="tseg" role="group" aria-label="${label}">${opts.map(([v, l]) => `<button type="button" data-${attr}="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</span></span>`;
  // the small choices shown beside a card set's print buttons, and beside a set of signs
  const cardsPerHtml = () => seg('Cards per page', 'tkper', [[1, '1'], [2, '2'], [4, '4']], cardsPer());
  const signSizeHtml = () => seg('Sign size', 'tksign', [['letter', 'Letter'], ['half', 'Half letter'], ['poster', '18 by 24']], signSize());
  /* The print buttons of each card set. A tap on one remembers, for the PDF it makes, how many cards go on a page and
     what size a sign prints at. The PD printables keep sheets and visuals on their own full pages. */
  const CARD_SETS = ['[data-gmprint]', '[data-bookprint]', '[data-artprint]', '[data-volprint]', '[data-tkcards]',
    ...['gguidesel', 'gguidekids', 'gplant', 'gfield', 'gset', 'gentry', 'ibcards', 'recipe', 'frecipe', 'fthanks', 'helpquick', 'helpcard', 'artistcard', 'bookcard', 'voljob'].map(k => `[data-print="${k}"]`)].join(',');
  let armed = null;
  function arm(t) { armed = { n: cardsPer(), sign: signSize(), only: t.hasAttribute('data-gmprint') ? 'cards' : 'all', at: Date.now() }; }
  function takeArmed() { const a = armed; armed = null; return a && Date.now() - a.at < 180000 ? a : null; }
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('button,[data-print],summary') : null; if (!t) return;
    if (t.dataset.tkper || t.dataset.tksign) {
      const per = !!t.dataset.tkper; keep.set(per ? 'tree-cards-per' : 'tree-sign-size', per ? t.dataset.tkper : t.dataset.tksign);
      document.querySelectorAll(per ? '[data-tkper]' : '[data-tksign]').forEach(b => b.setAttribute('aria-pressed', String(b === t || (per ? b.dataset.tkper === t.dataset.tkper : b.dataset.tksign === t.dataset.tksign))));
      e.preventDefault(); return;
    }
    if (t.matches(CARD_SETS) && t.dataset.word !== '1') arm(t); else if (t.tagName === 'BUTTON' && !t.closest('#pview')) armed = null;
  }, true);
  // how one page of a print is set: a card n to a page, a sign at its size, anything else as it is
  function pagePlan(p, a) {
    if (!a) return { n: 1, size: 'letter' };
    if (p && p.sign) return { n: 1, size: a.sign };
    if (a.only === 'cards' && !(p && p.centered && (p.card || p.plantCard))) return { n: 1, size: 'letter' };
    return { n: a.n, size: 'letter' };
  }
  /* The finished PDF laid out again. Pages set n to a letter page, two side by side on a landscape page or four in a
     grid, each cut on a dotted line, the quiet footer left off. A sign is set on a half letter page or an 18 by 24 inch
     poster, scaled whole, so its words stay sharp. plan holds one { n, size } for each page. */
  async function repage(blob, plan) {
    const L = await pdfLib(); const src = await L.PDFDocument.load(blob instanceof Uint8Array ? blob : await blob.arrayBuffer());
    const out = await L.PDFDocument.create(); const pages = src.getPages();
    const box = pg => { const { width: w, height: h } = pg.getSize(); return { left: 26, bottom: 50, right: w - 26, top: h - 22 }; };
    const emb = await out.embedPages(pages, pages.map(box));
    const grey = L.rgb(0.55, 0.58, 0.56);
    const dotted = (sh, x1, y1, x2, y2) => sh.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.6, color: grey, dashArray: [3, 4] });
    const put = (sh, e, x, y, w, h, pad) => { const s = Math.min((w - 2 * pad) / e.width, (h - 2 * pad) / e.height); sh.drawPage(e, { x: x + (w - e.width * s) / 2, y: y + (h - e.height * s) / 2, xScale: s, yScale: s }); };
    let i = 0;
    while (i < pages.length) {
      const pl = plan[i] || { n: 1, size: 'letter' };
      if (pl.n === 2 || pl.n === 4) {
        const run = []; while (i < pages.length && run.length < pl.n && (plan[i] || {}).n === pl.n) { run.push(emb[i]); i++; }
        if (pl.n === 2) { const sh = out.addPage([792, 612]); run.forEach((e, k) => put(sh, e, k * 396, 0, 396, 612, 16)); dotted(sh, 396, 14, 396, 598); }
        else { const sh = out.addPage([612, 792]); run.forEach((e, k) => put(sh, e, (k % 2) * 306, 396 - Math.floor(k / 2) * 396, 306, 396, 12)); dotted(sh, 306, 14, 306, 778); dotted(sh, 14, 396, 598, 396); }
        continue;
      }
      if (pl.size === 'half' || pl.size === 'poster') { const S = SIZES[pl.size]; const sh = out.addPage([S.w, S.h]); put(sh, emb[i], 0, 0, S.w, S.h, pl.size === 'poster' ? 40 : 12); i++; continue; }
      const [cp] = await out.copyPages(src, [i]); out.addPage(cp); i++;
    }
    out.setCreator('Fulton Community School'); out.setProducer('TREE');
    return new Blob([await out.save()], { type: 'application/pdf' });
  }

  root.TREE_KIT = { LIB, SIZES, PF, loadScript, fonts, pdfFonts, wordFonts, pdf, word, wordFile, wordBlob, pdfLib, pdfjs, readPdf, pageImage, readDocx, placeSheet, childHeight,
    isEmpty, printable, nothing, guard, cardsPer, signSize, cardsPerHtml, signSizeHtml, takeArmed, pagePlan, repage };
})(typeof window !== 'undefined' ? window : this);
