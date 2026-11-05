/* How a lens finds a sentence in the school's own writing, read the same way on the server and in TREE's pages. A lens
   has a list of words. A sentence that holds one is a candidate, and the night's reading says whether the sentence
   shows the lens or only shares a word with it, so "wait in line" never lands under Graphic Languages. The key a
   passage is kept under is made here too, so the server and the page agree on it. */
(function (root) {
  'use strict';
  const LENS_DEFAULT = { name: 'Graphic Languages',
    description: 'The many visible forms children give their thinking, such as drawing, marks, maps, paint, clay, wire, construction, and arrangements. We read each one for the thinking it carries, together with the words, tools, and materials that shaped it.',
    languages: ['Drawing and mark-making', 'Mapping', 'Painting', 'Clay and sculpture', 'Building and construction', 'Loose parts arrangement', 'Emergent writing', 'Recording and comparing'],
    words: ['draw', 'drew', 'drawn', 'sketch', 'mark', 'line', 'trace', 'map', 'paint', 'clay', 'wire', 'charcoal', 'chalk', 'pencil', 'pen', 'marker', 'crayon', 'ink', 'paper', 'collage', 'sculpt', 'sculpture', 'build', 'built', 'construct', 'construction', 'arrange', 'arrangement', 'symbol', 'sign', 'write', 'wrote', 'written', 'letter', 'print', 'stamp', 'represent', 'representation', 'diagram', 'blueprint', 'model'],
    questions: ['What idea was the child giving form to?', 'With what tool, material, and surface?', 'What words, story, or gesture came with it?', 'Did the child return to it, or rework it in another language?', 'How did educators respond?'] };
  // verbs that name a graphic act without a listed word. They widen the net for the Graphic Languages lens only, so a
  // sentence such as "stacked the stones into a tower" reaches the night's reading. Another lens keeps to its own words.
  const GRAPHIC_VERBS = ['built', 'stacked', 'laid', 'lined up', 'traced', 'scratched', 'carved', 'assembled', 'mapped'];
  const isGraphic = L => /graphic/i.test(String((L && L.name) || ''));
  function widenWords(L) { if (!isGraphic(L)) return []; const have = new Set((L.words || []).map(w => String(w).toLowerCase().trim())); return GRAPHIC_VERBS.filter(v => !have.has(v)); }
  // one word, with the usual endings (maps, mapped, mapping, painted, writing)
  const clean = w => String(w || '').toLowerCase().replace(/[^a-z' -]/g, '');
  function wordPart(c) { const last = c.slice(-1), stem = c.endsWith('e') ? c.slice(0, -1) : c; return `${c}(?:s|es|d|ed|er|ers|ing|${last}ed|${last}ing)?` + (stem !== c ? `|${stem}(?:ing|ed)` : ''); }
  // every word of a list as one whole-word pattern. With widen, the graphic verbs join the Graphic Languages words.
  function lensRegex(L, widen) {
    const words = [...((L && L.words) || []), ...(widen ? widenWords(L) : [])].map(clean).filter(w => w.length > 1);
    return words.length ? new RegExp('\\b(?:' + words.map(wordPart).join('|') + ')\\b', 'gi') : null;
  }
  function wordRegex(w) { const c = clean(w); if (c.length < 2) return null; return new RegExp('\\b(?:' + wordPart(c) + ')\\b', 'i'); }
  // a sentence cut inside a quotation, or a line that begins with a bullet, loses its stray marks
  function tidy(t) { let v = String(t || '').replace(/^[\s"“”‘’'•·\-–*]+/, '').replace(/[\s"“”‘’'•·\-–*]+$/, '').trim();
    const opens = (v.match(/[“"]/g) || []).length, closes = (v.match(/[”]/g) || []).length; if (opens > closes && /^[“"]/.test(v)) v = v.slice(1); return v; }
  // the sentences of one part of a plan, tidied, the very short ones left out
  function sentences(text) { return (String(text || '').match(/[^.!?\n]+[.!?]*["”’]?/g) || []).map(tidy).filter(s => s.length >= 12); }
  // the same split, with each sentence kept as written and the space or line break that came before it, so sentences can
  // be sorted between two boxes whole, with no word changed. Joined back in order, the pieces give the text again.
  function sentenceSpans(text) {
    const t = String(text || ''), re = /[^.!?\n]+[.!?]*["”’]?/g, out = []; let m, end = 0;
    while ((m = re.exec(t))) { const raw = m[0], lead = t.slice(end, m.index) + (raw.match(/^\s*/) || [''])[0], s = raw.trim(); end = m.index + raw.length; if (s) out.push({ text: s, lead }); }
    return out;
  }
  // the pieces of one box put back together, the first with no space before it
  const joinSpans = spans => spans.map((p, i) => (i ? (p.lead || ' ') : '') + p.text).join('').trim();
  // the parts of a plan that carry writing, by label, the same sections TREE's forms show
  const PARTS = {
    classroom: [['observation', 'Observation'], ['intentions', 'Intentions and questions for the week'], ['meeting', 'Meeting time questions, concepts and ideas'], ['interests', 'Expressed interests of individual and small group'], ['indoor', 'Provocations and environmental changes, indoor'], ['outdoor', 'Provocations and environmental changes, outdoor'], ['brainstorm', 'Curriculum brainstorm'], ['remarks', 'Final remarks']],
    individual: [['area', 'Area exploration'], ['dates', 'Anticipated dates'], ['observation', 'Observation rationale'], ['intent', 'Intent'], ['materials', 'Possible activities and materials'], ['questions', 'Questions and languages'], ['remarks', 'Final remarks']],
    smallgroup: [['thread', 'The thread we are following'], ['intention', 'My intention'], ['questions', 'Guiding questions'], ['graphic', 'Graphic languages invitation'], ['materials', 'Materials'], ['reflection', 'After the week']],
    notice: [['noticed', 'What I noticed'], ['wonder', 'What I wonder']] };
  function planParts(p) {
    const parts = (PARTS[p && p.type] || []).map(([k, label]) => [label, String((p.fields && p.fields[k]) || ''), k]);
    if (p && p.web) parts.push(['Curriculum web', [p.web.focus, ...(p.web.branches || []).map(b => [b.name, b.materials].filter(Boolean).join(', ')), p.web.questions, p.web.environment].filter(Boolean).join('. '), 'web']);
    return parts.filter(([, t]) => t.trim());
  }
  // a short hash of a sentence, the same on the server and on the page, so one sentence has one key
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
  const passageKey = (lensId, planId, sent) => `${lensId}.${planId}.${hash(String(sent || '').toLowerCase())}`;
  const api = { LENS_DEFAULT, GRAPHIC_VERBS, isGraphic, widenWords, lensRegex, wordRegex, tidy, sentences, sentenceSpans, joinSpans, planParts, hash, passageKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TREE_LENS = api;
})(typeof window !== 'undefined' ? window : this);
