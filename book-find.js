'use strict';
/* Finding a book for the book collection (November 3, 2026). The facts about a book, its title, author, illustrator,
   year, publisher, pages, language, ISBN, cover and link, come only from a library catalog, never from the writing help,
   so they are always true to the book. Open Library is read first, and the Sonoma County Library catalog second, which
   also says whether the library has the book and how many copies are in now.

   The Sonoma County Library check reads the same lookup the catalog's own website uses. The library could change it
   without notice. When it stops answering, the library line hides and nothing else in the collection breaks. */
module.exports = function bookFind(o) {
  const log = o.log || (() => {});
  const UA = 'Mozilla/5.0 (TREE, Fulton Community School book collection)';
  // the tests point both catalogs and the covers at a stand-in with BOOK_CATALOG_TEST_BASE
  const TEST = String(process.env.BOOK_CATALOG_TEST_BASE || '').replace(/\/+$/, '');
  const LIB = TEST ? TEST + '/lib/search' : 'https://gateway.bibliocommons.com/v2/libraries/sonoma/bibs/search';
  const OL = TEST ? TEST + '/ol' : 'https://openlibrary.org';
  const LIB_RECORD = id => 'https://sonoma.bibliocommons.com/v2/record/' + encodeURIComponent(id);
  const LIB_SEARCH = q => 'https://sonoma.bibliocommons.com/v2/search?searchType=smart&query=' + encodeURIComponent(q);
  const LANGS = { eng: 'English', spa: 'Spanish', chi: 'Chinese', zho: 'Chinese', vie: 'Vietnamese', tgl: 'Tagalog', fre: 'French', fra: 'French', ger: 'German', jpn: 'Japanese', kor: 'Korean', por: 'Portuguese', rus: 'Russian', ara: 'Arabic', hin: 'Hindi', ita: 'Italian', hmn: 'Hmong', lao: 'Lao', khm: 'Khmer', mul: 'More than one language' };
  // the hosts a cover may be copied from, so nothing else is ever fetched and kept
  const COVER_HOSTS = { test: u => /^https:\/\/(covers\.openlibrary\.org|secure\.syndetics\.com)\//.test(u) || (!!TEST && u.startsWith(TEST + '/cover/')) };

  async function getJson(url, ms = 12000) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), ms);
    try { const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } }); if (!r.ok) throw new Error('answered ' + r.status); return await r.json(); }
    finally { clearTimeout(tm); }
  }
  const norm = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^(the|a|an|el|la|los|las)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  // a title matches when one holds the other from its start, so "Owl Moon" matches "Owl Moon (Anniversary edition)"
  const sameTitle = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ')); };
  const surnames = s => String(s || '').split(/,| and |&|;/).map(p => p.trim()).filter(Boolean).map(p => norm(p.includes(' ') ? p.split(/\s+/).pop() : p)).filter(Boolean);
  // a catalog writes "Yolen, Jane", and we write "Jane Yolen"
  const turn = a => { const m = String(a || '').match(/^([^,]+),\s*([^,]+?)(?:,.*)?$/); return m ? (m[2] + ' ' + m[1]).replace(/\s+/g, ' ').trim() : String(a || '').trim(); };
  const sameAuthor = (want, names) => { const w = surnames(want); if (!w.length) return true; const have = new Set(names.flatMap(n => surnames(turn(n)))); return w.some(s => have.has(s)); };
  const isbn13 = list => { const L = (list || []).map(x => String(x).replace(/[^0-9X]/gi, '')); return L.find(x => x.length === 13 && /^97[89]/.test(x)) || L.find(x => x.length === 10) || ''; };

  /* ---------- Sonoma County Library ---------- */
  async function libSearch(q) {
    const d = await getJson(`${LIB}?query=${encodeURIComponent(q)}&searchType=smart&limit=25`);
    const bibs = (d && d.entities && d.entities.bibs) || {};
    return Object.values(bibs).map(v => { const b = v.briefInfo || {}, a = v.availability || {};
      return { id: b.metadataId || b.id || '', title: b.title || '', authors: b.authors || [], format: b.format || '', lang: b.primaryLanguage || '', year: String(b.publicationDate || '').replace(/[^0-9]/g, '').slice(0, 4),
        isbn: isbn13(b.isbns), jacket: b.jacket && (b.jacket.large || b.jacket.medium) || '', description: b.description || '', audiences: b.audiences || [],
        avail: +a.availableCopies || 0, total: +a.totalCopies || 0, held: +a.heldCopies || 0 }; }).filter(x => x.id);
  }
  // what the library holds of one book, the print copies added together, and whether it is also an ebook or an audiobook
  function libSummary(bibs, title, author) {
    const mine = bibs.filter(b => sameTitle(b.title, title) && sameAuthor(author, b.authors));
    if (!mine.length) return { found: false, search: LIB_SEARCH([title, author].filter(Boolean).join(' ')), at: Date.now() };
    const print = mine.filter(b => /^(BK|BOARD_BK|PICTURE_BK|LPRINT|BOOK_CD)$/.test(b.format) || /BK$/.test(b.format));
    const best = (print[0] || mine[0]);
    const other = [...new Set(print.map(b => b.lang).filter(l => l && l !== 'eng'))].map(l => LANGS[l] || '').filter(Boolean);
    return { found: true, avail: print.reduce((n, b) => n + b.avail, 0), total: print.reduce((n, b) => n + b.total, 0),
      ebook: mine.some(b => b.format === 'EBOOK'), audio: mine.some(b => /AUDIO/.test(b.format)), languages: other,
      record: LIB_RECORD(best.id), at: Date.now() };
  }
  async function libraryFor(title, author) {
    const bibs = await libSearch([title, surnames(author)[0] || ''].filter(Boolean).join(' '));
    return libSummary(bibs, title, author);
  }

  /* ---------- Open Library ---------- */
  async function olSearch(title, author) {
    const p = new URLSearchParams({ title, limit: '10', fields: 'key,title,subtitle,author_name,first_publish_year,isbn,cover_i,publisher,number_of_pages_median,language' }); if (author) p.set('author', author);
    const d = await getJson(OL + '/search.json?' + p.toString());
    return (d && Array.isArray(d.docs) ? d.docs : []).map(x => ({
      title: String(x.title || '').trim(), names: (x.author_name || []).map(String), year: x.first_publish_year ? String(x.first_publish_year) : '',
      publisher: (x.publisher || [])[0] || '', pages: x.number_of_pages_median ? String(x.number_of_pages_median) : '', isbn: isbn13(x.isbn),
      // Open Library lists the languages of every edition, so a book with an English edition reads as English
      languages: (x.language || []).includes('eng') ? 'English' : (LANGS[(x.language || [])[0]] || ''),
      cover: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg?default=false` : '', link: x.key ? 'https://openlibrary.org' + x.key : '' })).filter(x => x.title);
  }

  /* Up to five matches for a title, or a title and author, each with its cover and what the library holds. A book's first
     name in the catalog is its author, and any other names are its illustrators. */
  async function find(title, author) {
    title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 200); author = String(author || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!title) return { matches: [] };
    let ol = [], bibs = [], olErr = null, libErr = null;
    await Promise.all([
      olSearch(title, author).then(r => { ol = r; }, e => { olErr = e; }),
      libSearch([title, surnames(author)[0] || ''].filter(Boolean).join(' ')).then(r => { bibs = r; }, e => { libErr = e; })]);
    if (olErr) log('Open Library did not answer,', olErr.message);
    if (libErr) log('Sonoma County Library did not answer,', libErr.message);
    const seen = new Set(), matches = [];
    // a title that matches comes first, and a longer title holding ours, such as a collection, only when nothing else matched
    const close = ol.filter(x => sameTitle(x.title, title));
    for (const x of (close.length ? close : ol.filter(x => norm(x.title).includes(norm(title)) && norm(x.title).length <= norm(title).length + 30))) {
      const key = norm(x.title) + '|' + (surnames(x.names[0] || '')[0] || ''); if (seen.has(key)) continue; seen.add(key);
      const a = x.names[0] || '', ill = x.names.slice(1).filter(n => norm(n) !== norm(a)).slice(0, 2).join(' and ');
      const lib = libErr ? null : libSummary(bibs, x.title, a);
      // a book Open Library has no cover for takes the library's
      const libBib = lib && lib.found ? bibs.find(b => sameTitle(b.title, x.title) && sameAuthor(a, b.authors) && b.jacket) : null;
      // the ISBN of a print copy the library holds names a book a family could find, and Open Library's names any edition
      const libIsbn = (bibs.find(b => /BK$/.test(b.format) && b.isbn && sameTitle(b.title, x.title) && sameAuthor(a, b.authors)) || {}).isbn || '';
      matches.push({ title: x.title, author: a, illustrator: ill, year: x.year, publisher: '', pages: x.pages, languages: x.languages || 'English', isbn: libIsbn || x.isbn,
        cover: x.cover || (libBib ? libBib.jacket : ''), link: x.link, library: lib });
      if (matches.length >= 5) break;
    }
    // a book Open Library does not have, but the library does, comes from the library's own record
    if (!matches.length) for (const b of bibs) {
      if (!/BK$/.test(b.format) || !(sameTitle(b.title, title) || norm(b.title).includes(norm(title))) || !sameAuthor(author, b.authors)) continue;
      const key = norm(b.title) + '|' + (surnames(turn(b.authors[0] || ''))[0] || ''); if (seen.has(key)) continue; seen.add(key);
      matches.push({ title: b.title, author: turn(b.authors[0] || ''), illustrator: b.authors.slice(1, 3).map(turn).join(' and '), year: b.year, publisher: '', pages: '',
        languages: LANGS[b.lang] || '', isbn: b.isbn, cover: b.jacket, link: LIB_RECORD(b.id), library: libSummary(bibs, b.title, turn(b.authors[0] || '')) });
      if (matches.length >= 5) break;
    }
    return { matches, catalogs: { openLibrary: !olErr, library: !libErr } };
  }

  /* What the library holds of each book in the collection, checked at most once a day and kept here while the server
     runs. Many books are checked a few at a time, and two asks at once share one check. */
  const avail = new Map(); let running = null;
  const DAY = 20 * 36e5;
  async function availability(books) {
    const stale = books.filter(b => { const c = avail.get(b.path); return !c || Date.now() - c.at > DAY || c.key !== b.title + '|' + b.author; });
    if (stale.length) {
      if (!running) running = (async () => {
        let i = 0, failed = 0;
        const work = async () => { while (i < stale.length) { const b = stale[i++];
          try { avail.set(b.path, Object.assign(await libraryFor(b.title, b.author), { key: b.title + '|' + b.author })); }
          catch (e) { failed++; } } };
        await Promise.all(Array.from({ length: 5 }, work));
        if (failed) log('Sonoma County Library check missed', failed, 'of', stale.length, 'books');
      })().finally(() => { running = null; });
      await running;
    }
    const out = {}; for (const b of books) { const c = avail.get(b.path); if (c) { const { key, ...rest } = c; out[b.path] = rest; } }
    return out;
  }

  // a copy of a cover, read from a catalog's own picture, for TREE to keep in its Drive
  async function coverBytes(url) {
    if (!COVER_HOSTS.test(String(url || ''))) throw new Error('A cover is copied only from a library catalog.');
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'image/*' } });
      const type = String(r.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (!r.ok || !/^image\/(jpeg|png)$/.test(type)) throw new Error('The catalog has no cover for this book.');
      const buf = Buffer.from(await r.arrayBuffer());
      // a catalog with no cover sometimes sends a tiny blank picture
      if (buf.length < 1500) throw new Error('The catalog has no cover for this book.');
      if (buf.length > 8e6) throw new Error('The cover is too large to keep.');
      return { buf, type: type === 'image/png' ? 'image/png' : 'image/jpeg', ext: type === 'image/png' ? 'png' : 'jpg' };
    } finally { clearTimeout(tm); }
  }

  return { find, availability, coverBytes, libraryFor, _test: { norm, sameTitle, sameAuthor, turn, libSummary } };
};
