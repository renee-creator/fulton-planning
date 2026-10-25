'use strict';
/* TREE's writing rules as a check on new wording, the same rules the README lists. It reads only the lines a change adds
   or rewrites, so wording already there, such as the title of a cited outside source, never stops a save. */
const RULES = [
  [/[—–]/, 'A dash. Use a comma or a full stop.'],
  [/\btoddlers?\b/i, 'Say Class.'],
  [/\b(Claude|Anthropic|ChatGPT|OpenAI|GPT-\d)\b/, 'No AI model or its maker is named.'],
  [/\b(sorry|apologi[sz]e|apologies)\b/i, 'No apologies.'],
  [/\b(Responding|Exploring|Building|Integrating) (Earlier|Middle|Later)\b/, 'No DRDP rating language.'],
  [/(^|[^\d])[a-z)\]]: [A-Z]/, 'A colon joins two sentences. Use a full stop.'],
];
// words that may say teacher, from the README
const TEACHER_OK = /Role of the Teacher|Environment as the Third Teacher|Teacher Policies and Procedures|Teacher's Role|\bLIC\s*\d+[A-Z]?[^.\n]*/g;
function lineFindings(l) {
  const out = [];
  for (const [re, why] of RULES) if (re.test(l)) out.push(why);
  // a link's words and a quoted or set-off title stay as their source wrote them
  const plain = l.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/\*[^*]+\*/g, '').replace(/"[^"]*"/g, '').replace(TEACHER_OK, '');
  if (/\bteachers?\b/i.test(plain)) out.push('Say educator.');
  if (/\bFulton\b(?! Community School| Road)/.test(plain.replace(/1225Fulton/g, ''))) out.push('Say we or our, or Fulton Community School.');
  if (/Community School/.test(plain.replace(/Fulton Community School/g, ''))) out.push('Say Fulton Community School, never Community School on its own.');
  return out;
}
// the findings in the lines of after that were not already in before
function check(before, after) {
  const was = new Set(String(before || '').split('\n').map(s => s.trim()));
  const out = [];
  for (const l of String(after || '').split('\n')) { const t = l.trim(); if (!t || was.has(t)) continue;
    for (const why of lineFindings(t)) out.push({ why, line: t.length > 140 ? t.slice(0, 137) + '...' : t }); }
  return out;
}
module.exports = { check, lineFindings };
