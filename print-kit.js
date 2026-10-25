/* One builder for every print TREE makes, PDF and Word, and one reader for each kind of file someone uploads.
   TREE, the Educators pages and the Conferences page all make their files here. The kit loads each library from one
   address, keeps the one typeface, Andika, for every sheet, names the page sizes a print can use, letter, half letter
   and a larger poster, and reads an uploaded PDF or Word file the same way wherever it is uploaded. What each print
   holds and how it is laid out stays with the print, so every print looks as it did. */
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

  root.TREE_KIT = { LIB, SIZES, PF, loadScript, fonts, pdfFonts, wordFonts, pdf, word, wordFile, wordBlob, pdfLib, pdfjs, readPdf, pageImage, readDocx };
})(typeof window !== 'undefined' ? window : this);
