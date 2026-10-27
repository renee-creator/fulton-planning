'use strict';
/* The libraries for plans, kept in the private records as one Markdown page each under staff/library, and edited with
   the one editor and its history: the recipe library (staff/library/recipes), food and sensory kept apart, the song book
   (staff/library/songs), the read-alouds (staff/library/readalouds) and the bank of provocations and curiosity prompts
   (staff/library/prompts/provocations.md) and the Artists page (staff/library/prompts/artists.md), one card for each artist
   with what the work sits beside on our site, its wondering and a note for the educator. Each page opens with a note of its own, such as kind: sensory or
   copyright: yes, and its parts are its sections, such as Ingredients and Steps, or a song's Words.

   A song marked copyright shows its title, its songwriter and a link to a recording, and its words are never kept or
   sent. Recipes come from the director and the kitchen, and drafts from educators and families wait for the director. */
module.exports = function library(o) {
  const { S, get, put, putText, log, isDirector, isKitchen } = o;
  /* The picture library for the demonstration sheets, realistic pictures named by ingredient or tool, one consistent
     style on white, kept in the records under staff/library/images, such as banana.png or whole_wheat_flour.png. A
     photo from the piazza, kept once the face check on the device finds no face, stands for an item with no picture, or
     in place of one when the director chooses, and every sheet using it updates. staff/library/pictures.json keeps them. */
  const PICS = 'staff/library/pictures.json';
  const pictures = () => { const out = {};
    for (const p of S.imgs.keys()) { const m = p.match(/^staff\/library\/images\/([a-z0-9_]+)\.(png|jpe?g|webp)$/i); if (m) out[m[1].toLowerCase()] = { from: 'library', path: p }; }
    for (const [k, v] of Object.entries((get(PICS) || {}).list || {})) if (v && v.id) out[k] = { from: 'photo', id: v.id, by: v.by || '', at: v.at || 0 };
    return out; };
  const WD = require('./wording.js');
  const DIRS = { recipes: 'recipe', songs: 'song', readalouds: 'readaloud', explorations: 'exploration', books: 'book' };
  const META = text => { const m = String(text || '').match(/^\s*<!--([\s\S]*?)-->/); const out = {}; if (m) for (const l of m[1].split('\n')) { const kv = l.match(/^\s*([a-z]+)\s*:\s*(.*?)\s*$/i); if (kv) out[kv[1].toLowerCase()] = kv[2]; } return out; };
  const slug = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  const isCopyright = meta => /^(yes|true|©)$/i.test(String(meta.copyright || ''));
  // a song marked copyright keeps no words, whatever was written
  function guard(path, text) {
    if (!/^staff\/library\/songs\//.test(path) || !isCopyright(META(text))) return text;
    return String(text).replace(/^##\s+Words\s*\n[\s\S]*?(?=^##\s|(?![\s\S]))/m, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }
  function item(path) {
    const r = S.files.get(path); if (!r || typeof r.text !== 'string') return null;
    const meta = META(r.text), doc = WD.parse(r.text); const m = path.match(/^staff\/library\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/);
    const x = { id: m[2], path, kind: DIRS[m[1]] || m[1], title: doc.title || m[2], lead: doc.lead || '', meta, parts: doc.parts, draft: /^draft$/i.test(meta.status || '') };
    if (x.kind === 'song' && isCopyright(meta)) x.parts = [];
    return x;
  }
  const paths = dir => [...S.files.keys()].filter(p => p.startsWith('staff/library/' + dir + '/') && /\.md$/.test(p)).sort();
  // who sees a draft: the director, the kitchen for a recipe, and the person who wrote it
  const sees = (x, me) => !x.draft || isDirector(me) || (x.kind === 'recipe' && isKitchen(me)) || (x.meta.by && x.meta.by === me);
  // the book collection, our vetted books, each with why we chose it, its reading guide and its vetting notes. Anyone on
  // staff suggests a book, and a suggestion waits as a draft until the director approves it after vetting.
  function list(me) {
    const all = dir => paths(dir).map(item).filter(x => x && sees(x, me));
    const pr = item('staff/library/prompts/provocations.md');
    const ar = item('staff/library/prompts/artists.md');
    const fm = get('staff/library/farms.json');
    // the food explorations, guided tastings shown on the Weekly bin beside the produce each explores, and our list of local farms
    // the words of a read-aloud are for educators only, so the kitchen's sign-in reads its guide without them
    const ra = all('readalouds').map(x => isKitchen(me) ? Object.assign({}, x, { parts: (x.parts || []).filter(p => !/^text$/i.test(p.key || '')) }) : x);
    return { recipes: all('recipes'), songs: all('songs'), readalouds: ra, books: isKitchen(me) ? [] : all('books'), explorations: all('explorations'), farms: fm && Array.isArray(fm.list) ? fm.list : [], provocations: pr ? { title: pr.title, lead: pr.lead, parts: pr.parts, path: pr.path } : null, artists: ar ? { title: ar.title, lead: ar.lead, parts: ar.parts, path: ar.path } : null, pictures: pictures() };
  }
  // a new page in a library. The director and the kitchen add a recipe that is ready. An educator's recipe and a family's
  // wait as drafts for the director. Only the director adds a song or a read-aloud.
  function add(me, b, from) {
    const kind = b.kind; const dir = kind === 'exploration' ? '' : Object.keys(DIRS).find(k => DIRS[k] === kind); if (!dir) return { error: 'Choose what to add.' };
    const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!title) return { error: 'Give it a name.' };
    const boss = from !== 'family' && isDirector(me), kit = from !== 'family' && isKitchen(me);
    if (kind !== 'recipe' && kind !== 'book' && !boss) return { error: 'Only the director adds to the song book and the read-alouds.' };
    if (kind === 'book' && !boss && from !== 'family' && kit) return { error: 'Books are suggested by educators, families and the director.' };
    let id = slug(title); while (S.files.has(`staff/library/${dir}/${id}.md`)) id += '-2';
    const draft = (kind === 'recipe' && !boss && !kit) || (kind === 'book' && !boss);
    const meta = [`library: ${kind}`];
    if (kind === 'recipe') meta.push(`kind: ${b.sensory ? 'sensory' : 'food'}`, `source: ${String(b.source || (from === 'family' ? 'A family' : 'Ours')).replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`);
    if (kind === 'song') { meta.push(`copyright: ${b.copyright ? 'yes' : 'no'}`, `songwriter: ${String(b.songwriter || '').replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`); if (/^https:\/\//.test(b.link || '')) meta.push(`link: ${String(b.link).slice(0, 400)}`); }
    // a family's draft names no one, since every staff member reads the library. An educator's names the educator.
    if (draft) meta.push('status: draft', `by: ${from === 'family' ? 'a family' : String(me).replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`);
    if (from === 'family') meta.push('from: family');
    const sec = (h, v) => { const t = String(v || '').replace(/\r/g, '').trim().slice(0, 8000); return t ? `## ${h}\n\n${t}\n\n` : `## ${h}\n\n`; };
    let body = '';
    if (kind === 'recipe') body = sec('Ingredients', b.ingredients) + sec('Tools', b.tools) + sec('Steps', b.steps) + (b.dairyFree ? sec('Dairy free', b.dairyFree) : '') + (b.glutenFree ? sec('Gluten free', b.glutenFree) : '') + (b.notes ? sec('Notes', b.notes) : '');
    if (kind === 'song' && !b.copyright) body = sec('Words', b.words);
    if (kind === 'readaloud') body = sec('About', b.about);
    if (kind === 'book') {
      const one = v => String(v || '').replace(/[\n\r]|-->/g, ' ').trim().slice(0, 160);
      for (const k of ['author', 'illustrator', 'year', 'languages']) if (one(b[k])) meta.push(`${k}: ${one(b[k])}`);
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
    // a picture from the picture library, read from the records the first time it is asked for
    if (P === 'library/img') { const k = String(body.name || '').toLowerCase(); const x = pictures()[k]; if (!x || x.from !== 'library') { err(req, res, 404, 'That picture is not here.'); return; }
      try { const buf = await o.readImage(x.path); send(req, res, 200, { 'Content-Type': /\.png$/i.test(x.path) ? 'image/png' : /\.webp$/i.test(x.path) ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'private, max-age=86400' }, buf); } catch (e) { err(req, res, 404, 'That picture is not here.'); } return; }
    // a photo from the piazza for an item, kept once the face check on the device found no face. An educator adds one for an
    // item with no picture, and only the director replaces a picture already there.
    if (P === 'library/picture') { const k = String(body.name || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); const id = String(body.id || '');
      if (!k) { err(req, res, 400, 'Name the ingredient or tool.'); return; }
      if (body.remove) { if (!isDirector(me)) { err(req, res, 403, 'The director takes a picture away.'); return; } const all = Object.assign({ list: {} }, get(PICS) || {}); delete all.list[k]; put(PICS, all); json(req, res, 200, list(me)); return; }
      // only a photo kept from this page, never an observation's photo, which may show a child
      if (!/^[a-z0-9]{12}-recipe-picture\.(jpe?g|png)$/i.test(id) || body.noFace !== true) { err(req, res, 400, 'A photo is kept only once the face check finds no face.'); return; }
      if (pictures()[k] && !isDirector(me)) { err(req, res, 403, 'This item has a picture. The director chooses to replace it.'); return; }
      const all = Object.assign({ list: {} }, get(PICS) || {}); all.list = Object.assign({}, all.list, { [k]: { id, by: me, at: Date.now() } }); put(PICS, all); log('Recipe picture kept for', k, 'by', me); json(req, res, 200, list(me)); return; }
    if (P === 'library/add') { const r = add(me, body || {}); if (r.error) { err(req, res, 400, r.error); return; } json(req, res, 200, Object.assign(list(me), r)); return; }
    const x = item(String(body.path || '')); if (!x) { err(req, res, 404, 'That is not in the library.'); return; }
    // the director marks a draft recipe ready, or takes it out
    if (P === 'library/ready') { if (!dir && !(kit && x.kind === 'recipe')) { err(req, res, 403, 'The director decides on a draft.'); return; } setMeta(x.path, 'status', body.on ? null : 'draft'); if (body.on && x.meta.by) setMeta(x.path, 'by', null); json(req, res, 200, list(me)); return; }
    // marking a song copyright removes its words, and taking the mark off lets words be added
    if (P === 'library/copyright') { if (!dir || x.kind !== 'song') { err(req, res, 403, 'Only the director marks a song.'); return; } setMeta(x.path, 'copyright', body.on ? 'yes' : 'no');
      // a song without the mark has a place for its words, ready for the director to add them
      if (!body.on) { const r = S.files.get(x.path); if (r && !/^##\s+Words\s*$/m.test(r.text)) putText(x.path, r.text.trimEnd() + '\n\n## Words\n\n'); }
      json(req, res, 200, list(me)); return; }
    // a photo from our own observations on a step of the demonstration set, chosen by the director or the kitchen once
    // the face check on the device found no faces
    if (P === 'library/photo') { if (!dir && !kit) { err(req, res, 403, 'The director chooses the photos.'); return; } const step = Math.round(+body.step); const id = String(body.photo || '');
      if (!(step >= 2 && step <= 40) || !/^[a-z0-9][a-z0-9._-]{0,150}$/i.test(id)) { err(req, res, 400, 'Choose a step and a photo.'); return; }
      const cur = String(x.meta.photos || '').split(/[;,]\s*/).filter(p => p && !p.startsWith(step + '=')); cur.push(step + '=' + id); setMeta(x.path, 'photos', cur.join('; ')); json(req, res, 200, list(me)); return; }
    err(req, res, 404, 'Not found');
  }
  return { list, add, guard, handle, item, isCopyright, META };
};
