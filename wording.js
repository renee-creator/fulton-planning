/* The school's own wording that the director edits in place, kept in the private records as one page for each piece in
   staff/wording, such as the Family Questionnaire or the Admission Tuition Agreement. Each part of a page is one item,
   its heading the item's name and its words the item. The code keeps only how each item is used. Read the same way on
   the server and in TREE's pages. */
(function (root) {
  'use strict';
  // a wording page, read into its title and its parts in order
  function parse(text) {
    text = String(text || '').replace(/\r/g, '');
    const m = text.match(/^\s*<!--[\s\S]*?-->\n?/); const rest = text.slice(m ? m[0].length : 0);
    const t = rest.match(/^#\s+(.+)$/m); const title = t ? t[1].trim() : '';
    const body = t ? rest.slice(t.index + t[0].length) : rest;
    const parts = body.split(/^##(?!#)\s+/m).slice(1).map(s => { const i = s.indexOf('\n'); return i < 0 ? { key: s.trim(), text: '' } : { key: s.slice(0, i).trim(), text: s.slice(i + 1).trim() }; });
    return { title, parts };
  }
  // the parts as a map from each item's name to its words
  function map(doc) { const out = {}; for (const p of (doc && doc.parts) || []) out[p.key] = p.text; return out; }
  // the items whose name begins with a word, such as every program in the agreement, in their order, without the word
  function list(doc, word) {
    const pre = word ? word + ' ' : '';
    return ((doc && doc.parts) || []).filter(p => !word || p.key.startsWith(pre)).map(p => [p.key.slice(pre.length), p.text]);
  }
  // the paragraphs of an item, and the links written in it as [words](address)
  const paras = text => String(text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const links = text => [...String(text || '').matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map(m => [m[1], m[2]]);
  const api = { parse, map, list, paras, links };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TREE_WORDS = api;
})(typeof window !== 'undefined' ? window : this);
