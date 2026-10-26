'use strict';
/* TREE's writing rules as a check on new wording, the same rules the README lists. It reads only the lines a change adds
   or rewrites, so wording already there, such as the title of a cited outside source, never stops a save. */
const RULES = [
  [/[—–]/, 'A dash. Use a comma or a full stop.'],
  [/\btoddlers?\b/i, 'Say Class.'],
  [/\b(bug (box|boxes|catchers?|jars?|houses?|viewers?)|insect (cages?|boxes|jars?)|butterfly nets?|critter (cages?|keepers?)|terrariums?)\b|\b(collect|catch|capture|trap|keep|bring)(s|ing|ed)? (the |some |a few )?(bugs|insects|worms|snails|slugs|caterpillars|ladybugs|beetles|spiders|lizards|frogs|tadpoles|butterflies|creatures|critters|roly polies|pill bugs)\b|\b(bugs|insects|worms|snails|caterpillars|ladybugs|creatures|critters|tadpoles) in (a |the )?(jars?|containers?|boxes|cups?)\b/i, 'Leave them be. Children observe creatures where they live.', /\b(never|not|no|without)\b/i],
  [/\b(Claude|Anthropic|ChatGPT|OpenAI|GPT-\d)\b/, 'No AI model or its maker is named.'],
  [/\b(sorry|apologi[sz]e|apologies)\b/i, 'No apologies.'],
  [/\b(Responding|Exploring|Building|Integrating) (Earlier|Middle|Later)\b/, 'No DRDP rating language.'],
  [/(^|[^\d])[a-z)\]]: [A-Z]/, 'A colon joins two sentences. Use a full stop.'],
];
// "not this but that" and "it is not X, it is Y", where a sentence says what something is by first saying what it is
// not. Say what it is.
const BE = "(?:is|are|was|were|'s|'re)";
const WHO = '(?:it|this|that|they|we|he|she|these|those|you|i)';
const NOT_THAT = [
  /\bnot\s+(?:just|only|merely|simply)\b/i,
  /\bnot\b[^.;:!?]{1,90}?,?\s+but\b(?!\s+(?:also\s+)?(?:if|when|only if)\b)/i,
  new RegExp(`\\b(?:${BE}\\s+not|isn't|aren't|wasn't|weren't)\\b[^.;:!?]{1,90}?[,;]\\s*(?:but\\s+)?${WHO}\\s+${BE}\\b`, 'i'),
  new RegExp(`\\b${WHO}\\s+(?:${BE}\\s+not|isn't|aren't|don't|do not)\\b[^.;:!?]{1,90}?[.;]\\s+${WHO}\\s+(?:${BE}|do)\\b`, 'i')
];
function notThisButThat(text) { const t = String(text || ''); return NOT_THAT.some(re => re.test(t)); }
// words that may say teacher, from the README
const TEACHER_OK = /Role of the Teacher|Environment as the Third Teacher|Teacher Policies and Procedures|Teacher's Role|\bLIC\s*\d+[A-Z]?[^.\n]*/g;
function lineFindings(l) {
  const out = [];
  // a rule with an exception, such as leave them be, is quiet in a sentence that says never to do it
  for (const [re, why, unless] of RULES) if (re.test(l) && !(unless && unless.test(l))) out.push(why);
  if (notThisButThat(l)) out.push('Say what it is, without first saying what it is not.');
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
module.exports = { check, lineFindings, notThisButThat };
