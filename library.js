'use strict';
/* The libraries for plans, kept in the private records as one Markdown page each under staff/library, and edited with
   the one editor and its history: the recipe library (staff/library/recipes), food and sensory kept apart, the song book
   (staff/library/songs), the read-alouds (staff/library/readalouds) and the bank of provocations and curiosity prompts
   (staff/library/prompts/provocations.md). Each page opens with a note of its own, such as kind: sensory or
   copyright: yes, and its parts are its sections, such as Ingredients and Steps, or a song's Words.

   A song marked copyright shows its title, its songwriter and a link to a recording, and its words are never kept or
   sent. Recipes come from the director and the kitchen, and drafts from educators and families wait for the director. */
module.exports = function library(o) {
  const { S, get, putText, log, isDirector, isKitchen } = o;
  const WD = require('./wording.js');
  const DIRS = { recipes: 'recipe', songs: 'song', readalouds: 'readaloud' };
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
  function list(me) {
    const all = dir => paths(dir).map(item).filter(x => x && sees(x, me));
    const pr = item('staff/library/prompts/provocations.md');
    return { recipes: all('recipes'), songs: all('songs'), readalouds: all('readalouds'), provocations: pr ? { title: pr.title, lead: pr.lead, parts: pr.parts, path: pr.path } : null };
  }
  // a new page in a library. The director and the kitchen add a recipe that is ready. An educator's recipe and a family's
  // wait as drafts for the director. Only the director adds a song or a read-aloud.
  function add(me, b, from) {
    const kind = b.kind; const dir = Object.keys(DIRS).find(k => DIRS[k] === kind); if (!dir) return { error: 'Choose what to add.' };
    const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!title) return { error: 'Give it a name.' };
    const boss = from !== 'family' && isDirector(me), kit = from !== 'family' && isKitchen(me);
    if (kind !== 'recipe' && !boss) return { error: 'Only the director adds to the song book and the read-alouds.' };
    let id = slug(title); while (S.files.has(`staff/library/${dir}/${id}.md`)) id += '-2';
    const draft = kind === 'recipe' && !boss && !kit;
    const meta = [`library: ${kind}`];
    if (kind === 'recipe') meta.push(`kind: ${b.sensory ? 'sensory' : 'food'}`, `source: ${String(b.source || (from === 'family' ? 'A family' : 'Ours')).replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`);
    if (kind === 'song') { meta.push(`copyright: ${b.copyright ? 'yes' : 'no'}`, `songwriter: ${String(b.songwriter || '').replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`); if (/^https:\/\//.test(b.link || '')) meta.push(`link: ${String(b.link).slice(0, 400)}`); }
    if (draft) meta.push('status: draft', `by: ${String(me).replace(/[\n\r]|-->/g, ' ').slice(0, 120)}`);
    if (from === 'family') meta.push('from: family');
    const sec = (h, v) => { const t = String(v || '').replace(/\r/g, '').trim().slice(0, 8000); return t ? `## ${h}\n\n${t}\n\n` : `## ${h}\n\n`; };
    let body = '';
    if (kind === 'recipe') body = sec('Ingredients', b.ingredients) + sec('Tools', b.tools) + sec('Steps', b.steps) + (b.dairyFree ? sec('Dairy free', b.dairyFree) : '') + (b.glutenFree ? sec('Gluten free', b.glutenFree) : '') + (b.notes ? sec('Notes', b.notes) : '');
    if (kind === 'song' && !b.copyright) body = sec('Words', b.words);
    if (kind === 'readaloud') body = sec('About', b.about);
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
  async function handle(P, body, me, req, res, { json, err }) {
    const dir = isDirector(me), kit = isKitchen(me);
    if (P === 'library') { json(req, res, 200, list(me)); return; }
    if (P === 'library/add') { const r = add(me, body || {}); if (r.error) { err(req, res, 400, r.error); return; } json(req, res, 200, Object.assign(list(me), r)); return; }
    const x = item(String(body.path || '')); if (!x) { err(req, res, 404, 'That is not in the library.'); return; }
    // the director marks a draft recipe ready, or takes it out
    if (P === 'library/ready') { if (!dir && !(kit && x.kind === 'recipe')) { err(req, res, 403, 'The director decides on a draft.'); return; } setMeta(x.path, 'status', body.on ? null : 'draft'); json(req, res, 200, list(me)); return; }
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
