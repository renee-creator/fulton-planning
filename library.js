'use strict';
/* The libraries for plans, kept in the private records as one Markdown page each under staff/library, and edited with
   the one editor and its history: the recipe library (staff/library/recipes), food and sensory kept apart, the song book
   (staff/library/songs), the read-alouds (staff/library/readalouds) and the bank of provocations and curiosity prompts
   (staff/library/prompts/provocations.md) and the Artists page (staff/library/prompts/artists.md), one card for each artist
   with what the work sits beside on our site, its wondering and a note for the educator. Each page opens with a note of its own, such as kind: sensory or
   copyright: yes, and its parts are its sections, such as Ingredients and Steps, or a song's Words.

   A song marked copyright shows the mark beside its title, its songwriter, a link to a recording and the words the
   director adds from our own song books. Recipes come from the director and the kitchen, and drafts from educators and families wait for the director. */
module.exports = function library(o) {
  const { S, get, put, putText, log, isDirector, isKitchen } = o; const isOffice = typeof o.isOffice === 'function' ? o.isOffice : () => false; const pdShown = typeof o.pdShown === 'function' ? o.pdShown : () => false;
  /* The picture library for the demonstration sheets, realistic pictures named by ingredient or tool, one consistent
     style on white, kept in the records under staff/library/images, such as banana.png or whole_wheat_flour.png. A
     photo from the piazza, kept once the face check on the device finds no face, stands for an item with no picture, or
     in place of one when the director chooses, and every sheet using it updates. staff/library/pictures.json keeps them. */
  const PICS = 'staff/library/pictures.json';
  /* the director's own photo for an artist card, such as a page of a book or a postcard, kept as a photo and shown and
     printed in place of any other picture of the work. staff/library/artist-photos.json keeps them by card (November 1, 2026) */
  const ART_PHOTOS = 'staff/library/artist-photos.json';
  const artSlug = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'artist';
  // the address an artist card's Shown from line names, read from the Artists page itself, so no other address is read
  const artShownSrc = id => { const ar = item('staff/library/prompts/artists.md'); const pt = ar && (ar.parts || []).find(x => artSlug(x.key) === id); if (!pt) return '';
    const m = String(pt.text || '').match(/^\*\*Shown from\.\*\*[ \t]*\[[^\]]+\]\((https:\/\/[^)\s"<>]+)\)/mi); return m ? m[1] : ''; };
  // the museums and cultural places near us, one page with a part for each area, and the director's switch that shows it
  // to educators
  const PLACES = 'staff/library/places/museums.md', PARKS = 'staff/library/places/parks.md', PLACES_SET = 'staff/library/places/settings.json';
  // the director's switches, each off until she turns it on. show is the page for educators, family the museums on the
  // Family page, plantsFamily the plants on our site there, and public the public page with both.
  const SWITCHES = ['show', 'family', 'plantsFamily', 'public'];
  const placeSwitches = () => { const d = get(PLACES_SET) || {}; return Object.fromEntries(SWITCHES.map(k => [k, !!d[k]])); };
  // the museum list as families and the public read it, the title, the opening lines and each area's lines
  const placesOut = (path = PLACES) => { const pl = item(path); return pl ? { title: pl.title, lead: pl.lead, parts: pl.parts.map(x => ({ key: x.key, text: x.text })) } : null; };
  // the parks near us, the same kind of list, shown wherever the museums are
  const parksOut = () => placesOut(PARKS);
  const pictures = () => { const out = {};
    for (const p of S.imgs.keys()) { const m = p.match(/^staff\/library\/images\/([a-z0-9_]+)\.(png|jpe?g|webp)$/i); if (m) out[m[1].toLowerCase()] = { from: 'library', path: p }; }
    for (const [k, v] of Object.entries((get(PICS) || {}).list || {})) if (v && v.id) out[k] = { from: 'photo', id: v.id, by: v.by || '', at: v.at || 0 };
      else if (v && v.url) out[k] = { from: 'web', url: v.url, credit: v.credit || '', link: v.link || '' };
    return out; };
  const WD = require('./wording.js');
  // finding a book in Open Library and the Sonoma County Library catalog, and what the library holds (November 3, 2026)
  const BF = require('./book-find.js')({ log });
  const crypto = require('crypto');
  // a copy of a book's cover, from the catalog it was found in, kept in TREE's Drive like our photos so it never breaks
  async function saveCover(path, url) {
    if (typeof o.keepOriginal !== 'function') throw new Error('Covers cannot be kept here.');
    const c = await BF.coverBytes(url); const id = crypto.randomBytes(6).toString('hex') + '-book-cover.' + c.ext;
    await o.keepOriginal(id, c.buf, c.type, 'Add a book cover'); setMeta(path, 'cover', id); return id;
  }
  const DIRS = { recipes: 'recipe', songs: 'song', readalouds: 'readaloud', explorations: 'exploration', books: 'book' };
  const META = text => { const m = String(text || '').match(/^\s*<!--([\s\S]*?)-->/); const out = {}; if (m) for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.*?)\s*$/i); if (kv) out[kv[1].toLowerCase()] = kv[2]; } return out; };
  const slug = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  const isCopyright = meta => /^(yes|true|©)$/i.test(String(meta.copyright || ''));
  // a song marked copyright keeps the words the director adds from our own song books, with the mark beside its title
  // (November 1, 2026). Nothing is taken out on saving any more.
  function guard(path, text) { return text; }
  function item(path) {
    const r = S.files.get(path); if (!r || typeof r.text !== 'string') return null;
    const meta = META(r.text), doc = WD.parse(r.text); const m = path.match(/^staff\/library\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/);
    const x = { id: m[2], path, kind: DIRS[m[1]] || m[1], title: doc.title || m[2], lead: doc.lead || '', meta, parts: doc.parts, draft: /^draft$/i.test(meta.status || ''), removed: String(meta.removed || '') };
    return x;
  }
  const paths = dir => [...S.files.keys()].filter(p => p.startsWith('staff/library/' + dir + '/') && /\.md$/.test(p)).sort();
  // who sees a draft: the director, the kitchen for a recipe, and the person who wrote it
  const sees = (x, me) => !x.draft || isDirector(me) || (x.kind === 'recipe' && isKitchen(me)) || (x.meta.by && x.meta.by === me);
  // the book collection, our vetted books, each with why we chose it, its reading guide and its vetting notes. Anyone on
  // staff suggests a book, and a suggestion waits as a draft until the director approves it after vetting.
  function list(me) {
    // a card the director removed is left out for everyone, and waits in her own Removed list to be put back
    const all = dir => paths(dir).map(item).filter(x => x && !x.removed && sees(x, me));
    const removed = isDirector(me) ? Object.fromEntries(Object.keys(DIRS).map(d => [DIRS[d], paths(d).map(item).filter(x => x && x.removed).map(x => ({ id: x.id, path: x.path, kind: x.kind, title: x.title, removed: x.removed }))])) : null;
    const pr = item('staff/library/prompts/provocations.md');
    const ar = item('staff/library/prompts/artists.md');
    // the museums and cultural places, the director's alone until she shows the page to educators
    const pk = item(PARKS); const pl = item(PLACES), plShown = !!(get(PLACES_SET) || {}).show, plSees = isDirector(me) || (plShown && !isKitchen(me));
    const fm = get('staff/library/farms.json');
    // the food explorations, guided tastings shown on the Weekly bin beside the produce each explores, and our list of local farms
    // the words of a read-aloud are for educators only, so the kitchen's sign-in reads its guide without them
    const ra = all('readalouds').map(x => isKitchen(me) ? Object.assign({}, x, { parts: (x.parts || []).filter(p => !/^text$/i.test(p.key || '')) }) : x);
    return { recipes: all('recipes'), songs: all('songs'), readalouds: ra, books: isKitchen(me) ? [] : all('books'), explorations: all('explorations'), farms: fm && Array.isArray(fm.list) ? fm.list : [], provocations: pr ? { title: pr.title, lead: pr.lead, parts: pr.parts, path: pr.path } : null, artists: ar ? { title: ar.title, lead: ar.lead, parts: ar.parts, path: ar.path } : null, places: pl && plSees ? Object.assign({ title: pl.title, lead: pl.lead, parts: pl.parts, path: pl.path, shown: plShown }, isDirector(me) ? { switches: placeSwitches() } : {}) : null,
      parks: pk && plSees ? { title: pk.title, lead: pk.lead, parts: pk.parts, path: pk.path, shown: plShown } : null, pictures: pictures(), artPhotos: (get(ART_PHOTOS) || {}).list || {}, modules: { 'looking-together': pdShown('looking-together') }, removed };
  }
  // a new page in a library. The director and the kitchen add a recipe that is ready. An educator's recipe and a family's
  // wait as drafts for the director. Only the director adds a song or a read-aloud.
const NUTS = /\b(peanuts?|almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|macadamias?|brazil nuts?|pine nuts?|nut butters?|peanut butter|almond (?:milk|flour|butter))\b/i;
  function add(me, b, from) {
    const kind = b.kind; const dir = kind === 'exploration' ? '' : Object.keys(DIRS).find(k => DIRS[k] === kind); if (!dir) return { error: 'Choose what to add.' };
    const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!title) return { error: 'Give it a name.' };
    const boss = from !== 'family' && isDirector(me), kit = from !== 'family' && isKitchen(me);
    if (kind !== 'recipe' && kind !== 'book' && !boss) return { error: 'Only the director adds to the song book and the read-alouds.' };
    if (kind === 'book' && !boss && from !== 'family' && kit) return { error: 'Books are suggested by educators, families and the director.' };
    // we are a nut free school, so a recipe never names a nut, whoever adds it
    if (kind === 'recipe' && NUTS.test([title, b.ingredients, b.tools, b.steps, b.dairyFree, b.glutenFree, b.notes, b.lead].join(' '))) return { error: 'We are nut free, so a recipe never uses nuts.' };
    let id = slug(title); while (S.files.has(`staff/library/${dir}/${id}.md`)) id += '-2';
    const draft = (kind === 'recipe' && !boss && !kit) || (kind === 'book' && !boss);
    const meta = [`library: ${kind}`];
    if (kind === 'recipe') meta.push(`kind: ${b.sensory ? 'sensory' : 'food'}`, `source: ${String(b.source || (from === 'family' ? 'A family' : 'Ours')).replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`);
    if (kind === 'song') { meta.push(`copyright: ${b.copyright ? 'yes' : 'no'}`, `songwriter: ${String(b.songwriter || '').replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`); if (/^https:\/\//.test(b.link || '')) meta.push(`link: ${String(b.link).slice(0, 400)}`); const lang = String(b.language || '').replace(/[\n\r]|-->/g, ' ').trim().slice(0, 40); if (lang && !/^english$/i.test(lang)) meta.push(`language: ${lang}`); }
    // a family's draft names no one, since every staff member reads the library. An educator's names the educator.
    if (draft) meta.push('status: draft', `by: ${from === 'family' ? 'a family' : String(me).replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`);
    if (from === 'family') meta.push('from: family');
    const sec = (h, v) => { const t = String(v || '').replace(/\r/g, '').trim().slice(0, 8000); return t ? `## ${h}\n\n${t}\n\n` : `## ${h}\n\n`; };
    let body = '';
    if (kind === 'recipe') body = sec('Ingredients', b.ingredients) + sec('Tools', b.tools) + sec('Steps', b.steps) + (b.dairyFree ? sec('Dairy free', b.dairyFree) : '') + (b.glutenFree ? sec('Gluten free', b.glutenFree) : '') + (b.notes ? sec('Notes', b.notes) : '');
    // a song found by Find the song keeps the parts it drafted, each only when it has words, then its words
    if (kind === 'song') body = [['Why we sing it', b.why], ['When we sing it', b.when], ['Movement or game', b.movement], ['I wonder', b.wonder], ['Connections', b.connections]].filter(([, v]) => String(v || '').trim()).map(([k, v]) => sec(k, v)).join('') + sec('Words', b.words) + (String(b.english || '').trim() ? sec('In English', b.english) : '');
    if (kind === 'readaloud') body = sec('About', b.about);
    if (kind === 'book') {
      const one = v => String(v || '').replace(/[\n\r]|-->/g, ' ').trim().slice(0, 160);
      for (const k of ['author', 'illustrator', 'year', 'languages', 'publisher', 'pages', 'isbn']) if (one(b[k])) meta.push(`${k}: ${one(b[k])}`); meta.push(`owned: ${b.owned === true ? 'yes' : 'no'}`);
      if (/^https:\/\//.test(b.link || '')) meta.push(`link: ${String(b.link).slice(0, 400)}`);
      const KINDS = { story: 'Reading for the story', understand: 'Reading to understand', information: 'Reading for information', wordless: 'A wordless book', reference: 'A reference book', coffee: 'A coffee table book', childmade: 'A book children made' };
      body = sec('Why we chose it', b.why) + sec('Kind of reading', (Array.isArray(b.kinds) ? b.kinds : [b.kinds]).map(k => KINDS[k]).filter(Boolean).join('\n')) +
        sec('Reading guide', b.guide || '- I notice\n- I wonder') + sec('Vetting notes', b.vetting) + sec('Where it lives', b.where) + sec('Connections', b.connections);
    }
    const path = `staff/library/${dir}/${id}.md`;
    putText(path, guard(path, `<!--\n${meta.join('\n')}\n-->\n# ${title}\n\n${String(b.lead || '').trim() ? String(b.lead).trim().slice(0, 600) + '\n\n' : ''}${body}`.trimEnd() + '\n'));
    log('Library page added', path, 'by', from === 'family' ? 'a family' : me);
    return { ok: true, id, path, draft };
  }
  function setMeta(path, key, value) {
    const r = S.files.get(path); if (!r || typeof r.text !== 'string') return false;
    const m = r.text.match(/^\s*<!--([\s\S]*?)-->/); if (!m) return false;
    const lines = m[1].split('\n').filter(l => !new RegExp('^\\s*' + key + '\\s*:', 'i').test(l));
    if (value !== null) lines.splice(lines.length - (lines[lines.length - 1] === '' ? 1 : 0), 0, `${key}: ${value}`);
    putText(path, guard(path, r.text.replace(m[0], `<!--${lines.join('\n')}-->`))); return true;
  }
  async function handle(P, body, me, req, res, { json, err, send }) {
    const dir = isDirector(me), kit = isKitchen(me);
    if (P === 'library') { json(req, res, 200, list(me)); return; }
    if (P === 'library/places/switch') { if (!dir) { err(req, res, 403, 'The director turns these on and off.'); return; }
      const k = String(body.key || ''); if (!SWITCHES.includes(k)) { err(req, res, 400, 'That switch is not here.'); return; }
      put(PLACES_SET, Object.assign({}, get(PLACES_SET) || {}, { [k]: !!body.on, at: Date.now(), by: me })); log('Community switch', k, body.on ? 'on' : 'off', 'by', me); json(req, res, 200, list(me)); return; }
    if (P === 'library/places/show') { if (!dir) { err(req, res, 403, 'The director shows this page to educators.'); return; }
      put(PLACES_SET, Object.assign({}, get(PLACES_SET) || {}, { show: !!body.on, at: Date.now(), by: me })); log('Museums and cultural places', body.on ? 'shown to educators' : 'kept with the director', 'by', me); json(req, res, 200, list(me)); return; }
    // a picture from the picture library, read from the records the first time it is asked for
    if (P === 'library/img') { const k = String(body.name || '').toLowerCase(); const x = pictures()[k]; if (!x || x.from !== 'library') { err(req, res, 404, 'That picture is not here.'); return; }
      try { const buf = await o.readImage(x.path); send(req, res, 200, { 'Content-Type': /\.png$/i.test(x.path) ? 'image/png' : /\.webp$/i.test(x.path) ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'private, max-age=86400' }, buf); } catch (e) { err(req, res, 404, 'That picture is not here.'); } return; }
    // a photo from the piazza for an item, kept once the face check on the device found no face. An educator adds one for an
    // item with no picture, and only the director replaces a picture already there.
    if (P === 'library/picture') { const k = String(body.name || body.key || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); const id = String(body.id || '');
      if (!k) { err(req, res, 400, 'Name the ingredient or tool.'); return; }
      if (body.remove) { if (!isDirector(me)) { err(req, res, 403, 'The director takes a picture away.'); return; } const all = Object.assign({ list: {} }, get(PICS) || {}); delete all.list[k]; put(PICS, all); json(req, res, 200, list(me)); return; }
      // a picture from Wikimedia Commons, free to share, chosen by the director, shown with its credit
      if (body.url) { if (!isDirector(me)) { err(req, res, 403, 'The director chooses a picture from the web.'); return; }
        const url = String(body.url); if (!/^https:\/\/upload\.wikimedia\.org\/[^\s"<>]+$/.test(url)) { err(req, res, 400, 'Only a picture from Wikimedia Commons is kept.'); return; }
        const one = v => String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 300); const link = /^https:\/\/commons\.wikimedia\.org\/[^\s"<>]+$/.test(String(body.link || '')) ? String(body.link) : '';
        const all = Object.assign({ list: {} }, get(PICS) || {}); all.list = Object.assign({}, all.list, { [k]: { url: url.slice(0, 600), credit: one(body.credit), link: link.slice(0, 600), by: me, at: Date.now() } }); put(PICS, all); json(req, res, 200, list(me)); return; }
      // only a photo kept from this page, never an observation's photo, which may show a child
      if (!/^[a-z0-9]{12}-recipe-picture\.(jpe?g|png)$/i.test(id) || body.noFace !== true) { err(req, res, 400, 'A photo is kept only once the face check finds no face.'); return; }
      if (pictures()[k] && !isDirector(me)) { err(req, res, 403, 'This item has a picture. The director chooses to replace it.'); return; }
      const all = Object.assign({ list: {} }, get(PICS) || {}); all.list = Object.assign({}, all.list, { [k]: { id, by: me, at: Date.now() } }); put(PICS, all); log('Recipe picture kept for', k, 'by', me); json(req, res, 200, list(me)); return; }
    if (P === 'library/artphoto') { if (!isDirector(me)) { err(req, res, 403, 'The director chooses the photos on the artist cards.'); return; }
      const id = String(body.card || ''); if (!/^[a-z0-9-]{1,60}$/.test(id)) { err(req, res, 400, 'That card is not here.'); return; }
      const all = Object.assign({ list: {} }, get(ART_PHOTOS) || {}); all.list = Object.assign({}, all.list);
      if (body.remove) delete all.list[id];
      else { const ph = String(body.photo || ''); if (!/^[a-z0-9]{12}-artist-photo\.(jpe?g|png)$/i.test(ph)) { err(req, res, 400, 'Choose a photo for the card.'); return; }
        all.list[id] = { id: ph, w: Math.max(0, Math.round(+body.w || 0)), h: Math.max(0, Math.round(+body.h || 0)), at: Date.now() }; }
      put(ART_PHOTOS, all); json(req, res, 200, list(me)); return; }
    // the image a card shows from a museum or an artist's site, read here for a printed card, since the site does not hand it to the page
    if (P === 'library/artshown') { const src = artShownSrc(String(body.card || '')); if (!src) { err(req, res, 404, 'That card shows no image from another site.'); return; }
      try { const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 15000); const r = await fetch(src, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (TREE, Fulton Community School)', Accept: 'image/*' } }); clearTimeout(tm);
        const type = String(r.headers.get('content-type') || ''); if (!r.ok || !/^image\/(jpeg|png|webp|gif)/i.test(type)) throw new Error('not an image');
        const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 15e6) throw new Error('too large');
        send(req, res, 200, { 'Content-Type': type.split(';')[0], 'Cache-Control': 'private, max-age=86400' }, buf); }
      catch (e) { err(req, res, 502, 'The site did not hand over its image.'); } return; }
    // a book found in a catalog keeps a copy of its cover. A cover that cannot be copied leaves the book as it is.
    if (P === 'library/add') { const r = add(me, body || {}); if (r.error) { err(req, res, 400, r.error); return; }
      if (r.path && body.kind === 'book' && body.cover) { try { await saveCover(r.path, String(body.cover)); } catch (e) { log('Book cover not kept,', r.path, e.message); r.coverMissed = true; } }
      json(req, res, 200, Object.assign(list(me), r)); return; }
    // Find the book. Up to five matches from the catalogs, each with its cover and what the library holds
    if (P === 'library/bookfind') { if (kit) { err(req, res, 403, 'The book collection is for educators.'); return; }
      try { json(req, res, 200, await BF.find(body.title, body.author)); } catch (e) { log('Find the book failed,', e.message); err(req, res, 502, 'The library catalogs did not answer just now.'); } return; }
    // what the Sonoma County Library holds of each book in the collection, checked at most once a day
    if (P === 'library/bookavail') { if (kit) { json(req, res, 200, { list: {} }); return; }
      const books = list(me).books.map(x => ({ path: x.path, title: x.title, author: String(x.meta.author || '') }));
      try { json(req, res, 200, { list: await BF.availability(books) }); } catch (e) { json(req, res, 200, { list: {}, off: true }); } return; }
    const x = item(String(body.path || '')); if (!x) { err(req, res, 404, 'That is not in the library.'); return; }
    // the director marks a draft recipe ready, or takes it out
    if (P === 'library/ready') { if (!dir && !(kit && x.kind === 'recipe')) { err(req, res, 403, 'The director decides on a draft.'); return; } setMeta(x.path, 'status', body.on ? null : 'draft'); if (body.on && x.meta.by) setMeta(x.path, 'by', null); json(req, res, 200, list(me)); return; }
    // marking a song copyright removes its words, and taking the mark off lets words be added
    // a song's words, and its words in English when it is sung in another language, saved by the director after she checks them
    if (P === 'library/words') { if (!dir || x.kind !== 'song') { err(req, res, 403, 'Only the director adds the words.'); return; }
      const clean = v => String(v || '').replace(/\r/g, '').replace(/^##/gm, '').trim().slice(0, 8000); const words = clean(body.words), english = clean(body.english);
      if (!words) { err(req, res, 400, 'Add the words first.'); return; }
      const r = S.files.get(x.path); let t = String(r.text || '').replace(/\n## (Words|In English)\s*\n[\s\S]*?(?=\n## |$)/g, '').trimEnd();
      t += '\n\n## Words\n\n' + words + '\n' + (english ? '\n## In English\n\n' + english + '\n' : '');
      putText(x.path, t); const lang = String(body.language || '').replace(/[\n\r]|-->/g, ' ').trim().slice(0, 40); if (lang && !/^english$/i.test(lang)) setMeta(x.path, 'language', lang); json(req, res, 200, list(me)); return; }
    // the director's vetting notes on a book, drafted with the Book Vetting Tool and saved after she reads them through
    if (P === 'library/vetting') { if (!dir || x.kind !== 'book') { err(req, res, 403, 'Only the director saves the vetting notes.'); return; }
      const notes = String(body.text || '').replace(/\r/g, '').replace(/^##/gm, '').trim().slice(0, 8000);
      const r = S.files.get(x.path); let t = String(r.text || '').replace(/\n## Vetting notes\s*\n[\s\S]*?(?=\n## |$)/g, '').trimEnd();
      if (notes) t += '\n\n## Vetting notes\n\n' + notes + '\n';
      putText(x.path, t); log('Book vetting notes saved', x.path, 'by', me); json(req, res, 200, list(me)); return; }
    /* the facts from a catalog match, put on a book already in the collection by the director, from the review list or
       Fix. The cover is copied and kept, and each fact replaces the one there. */
    if (P === 'library/bookfacts') { if (!dir || x.kind !== 'book') { err(req, res, 403, 'The director puts the catalog facts on a book.'); return; }
      const m = body.match || {}; const one = v => String(v || '').replace(/[\n\r]|-->/g, ' ').trim().slice(0, 160);
      if (body.none) { setMeta(x.path, 'catalog', 'none'); json(req, res, 200, list(me)); return; }
      for (const k of ['author', 'illustrator', 'year', 'languages', 'publisher', 'pages', 'isbn']) { const v = one(m[k]); setMeta(x.path, k, v || null); }
      if (/^https:\/\//.test(m.link || '')) setMeta(x.path, 'link', String(m.link).slice(0, 400));
      setMeta(x.path, 'catalog', 'yes');
      let missed = false; if (m.cover) { try { await saveCover(x.path, String(m.cover)); } catch (e) { missed = true; log('Book cover not kept,', x.path, e.message); } }
      log('Catalog facts put on', x.path, 'by', me); json(req, res, 200, Object.assign(list(me), { coverMissed: missed })); return; }
    // whether we own a book, marked by the director or the office
    if (P === 'library/owned') { if ((!dir && !isOffice(me)) || x.kind !== 'book') { err(req, res, 403, 'The director or the office marks the books we own.'); return; }
      setMeta(x.path, 'owned', body.on ? 'yes' : 'no'); log('Book', body.on ? 'marked ours' : 'marked to find', x.path, 'by', me); json(req, res, 200, list(me)); return; }
    // the director removes a card from TREE, and it waits in her Removed list, or she puts it back
    if (P === 'library/remove') { if (!dir) { err(req, res, 403, 'Only the director removes a card.'); return; }
      setMeta(x.path, 'removed', body.on === false ? null : new Date().toISOString().slice(0, 10)); log('Library card', body.on === false ? 'put back' : 'removed', x.path, 'by', me); json(req, res, 200, list(me)); return; }
    if (P === 'library/copyright') { if (!dir || x.kind !== 'song') { err(req, res, 403, 'Only the director marks a song.'); return; } if (!body.place) setMeta(x.path, 'copyright', body.on ? 'yes' : 'no');
      // a song has a place for its words, ready for the director to add them, with the mark or without it
      if (!body.on || body.place) { const r = S.files.get(x.path); if (r && !/^##\s+Words\s*$/m.test(r.text)) putText(x.path, r.text.trimEnd() + '\n\n## Words\n\n'); }
      json(req, res, 200, list(me)); return; }
    // a photo from our own observations on a step of the demonstration set, chosen by the director or the kitchen once
    // the face check on the device found no faces
    if (P === 'library/photo') { if (!dir && !kit) { err(req, res, 403, 'The director chooses the photos.'); return; } const step = Math.round(+body.step); const id = String(body.photo || '');
      if (!(step >= 2 && step <= 40) || !/^[a-z0-9][a-z0-9._-]{0,150}$/i.test(id)) { err(req, res, 400, 'Choose a step and a photo.'); return; }
      const cur = String(x.meta.photos || '').split(/[;,]\s*/).filter(p => p && !p.startsWith(step + '=')); cur.push(step + '=' + id); setMeta(x.path, 'photos', cur.join('; ')); json(req, res, 200, list(me)); return; }
    err(req, res, 404, 'Not found');
  }
  return { list, add, guard, handle, item, isCopyright, META, placeSwitches, placesOut, parksOut };
};
