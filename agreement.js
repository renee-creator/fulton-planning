/* Fulton's Admission Agreement. One source for the Family page (the family completes, initials and signs it online),
   the server (checks every part is complete) and the printed agreement in the enrollment packet. Its wording, the
   programs with their tuition, the care added to a day, the boxes, the terms and the statements, is kept in the private
   records as staff/wording/agreement.md, which the director edits in place. Each page passes it in with use(). The term
   the licensing agency requires stays here as it is, locked. */
(function (root) {
  const W = (typeof module !== 'undefined' && module.exports) ? require('./wording.js') : root.TREE_WORDS;
  // the licensing term, word for word, which is never edited
  const LICENSING = 'The Department of licensing agency shall have the authority to interview children, or staff, and to inspect and audit child or facility records without prior consent. The licensee shall make provisions for private interviews with child(ren), or any staff member; and for the examination of all records relating to the operation of the facility. B) The Department or licensing agency shall have the authority to observe the physical condition of the child(ren), including conditions which could indicate abuse, neglect, or inappropriate placement, and have to have a licensed medical professional physically examine the child(ren). NOTE. Authority cited, Section 1596.81, Health and Safety Code. Reference, Sections 1596.72, 1596.73, 1596.81, 1596.852 and 1596.853, Health and Safety Code.';
  let PROGRAMS = [], ADDONS = [], FIELDS = [], PAGE1 = [], PAGE2 = [], STATEMENT = '', ESIGN = '';
  // the yearly tuition and the monthly payment are the first and last amounts a program's words name
  const amounts = t => { const a = [...String(t).matchAll(/\$\s?([\d,]+)/g)].map(m => +m[1].replace(/,/g, '')); return [a[0] || 0, a[a.length - 1] || 0]; };
  function use(doc) {
    const d = doc && doc.parts ? doc : W.parse(String(doc || ''));
    PROGRAMS = W.list(d, 'program').map(([k, t]) => [k, t, ...amounts(t)]);
    ADDONS = W.list(d, 'addon').map(([k, t]) => [k, t]);
    FIELDS = W.list(d, 'field').map(([k, t]) => [k, t]);
    PAGE1 = W.list(d, 'page1').map(([, t]) => t);
    // the licensing term keeps its place, second on page two
    const p2 = W.list(d, 'page2'); PAGE2 = []; for (const [k, t] of p2) { if (+k === 2 || (+k > 2 && PAGE2.length === 1)) PAGE2.push(LICENSING); PAGE2.push(t); } if (PAGE2.length < 2) PAGE2.splice(1, 0, LICENSING);
    const m = W.map(d); STATEMENT = m.statement || ''; ESIGN = m.esign || '';
    Object.assign(api, { PROGRAMS, ADDONS, FIELDS, STATEMENT, ESIGN });
    return api;
  }
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const md = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '________________'; };
  // the office's schedule for the child, as a program on the agreement
  const programFor = sched => { const s = String(sched || '').replace(/\s/g, ''); return { 'M,W,F': 'mwf', 'Tu,Th': 'tth', 'Tu,W,Th,F': 'full', 'M,Tu,W,Th,F': 'mf' }[s] || ''; };
  // the terms, page one then page two, each initialed by the family, with the dates and the tuition filled in
  function terms(aa, program) {
    aa = aa || {}; const p = PROGRAMS.find(x => x[0] === program);
    const fill = t => String(t).replace(/\{start\}/g, md(aa.start)).replace(/\{end\}/g, md(aa.end)).replace(/\{fee\}/g, md(aa.fee)).replace(/\{year\}/g, p ? money(p[2]) : '$________').replace(/\{month\}/g, p ? money(p[3]) : '$________');
    return { page1: PAGE1.map(fill), page2: PAGE2.map(fill) };
  }
  const count = () => { const t = terms({}, ''); return t.page1.length + t.page2.length; };
  // what is still missing, in the order of the form
  function missing(ag) {
    ag = ag || {}; const out = []; const f = ag.fields || {};
    FIELDS.forEach(([k, l]) => { if (!String(f[k] || '').trim()) out.push(l); });
    if (!PROGRAMS.some(p => p[0] === ag.program)) out.push('the program');
    if (!String(ag.initials || '').trim()) out.push('your initials');
    const n = count(), t = ag.ticks || []; let left = 0; for (let i = 0; i < n; i++) if (!t[i]) left++;
    if (left) out.push(left === 1 ? 'one term to initial' : left + ' terms to initial');
    const s = ag.sign1 || {}; if (!String(s.name || '').trim()) out.push('your signature');
    if (!ag.esign) out.push('the electronic signature agreement');
    return out;
  }
  const api = { use, PROGRAMS, ADDONS, FIELDS, STATEMENT, ESIGN, LICENSING, terms, missing, count, programFor, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FultonAgreement = api;
})(typeof window !== 'undefined' ? window : this);
