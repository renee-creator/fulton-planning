/* Fulton's Admission Agreement, as the school wrote it. One source for the Family page (the family completes, initials
   and signs it online), the server (checks every part is complete) and the printed agreement in the enrollment packet. */
(function (root) {
  const PROGRAMS = [
    ['mf', 'Morning Program 8:30-12:30 M-F, $17,500 per year, to be paid in 10 monthly payments of $1750', 17500, 1750],
    ['mwf', 'Morning Program 8:30-12:30 MWF, $9,500 per school year, or 10 monthly payments of $950', 9500, 950],
    ['tth', 'Morning Program 8:30-12:30 T TH, $11,500 per school year, or 10 monthly payments of $1150', 11500, 1150],
    ['full', 'Full Day 8:30 to 4:00 Tuesday-Friday, $18,500 per year, to be paid in 10 monthly payments of $1850', 18500, 1850],
    ['four', '4 1/2 days, Monday 8:30-12:30 and T-F 8:30am-4:00pm, $20,000 per year, 10 monthly payments of $2000', 20000, 2000]];
  const ADDONS = [['early5', 'Early Care 7:30-8:30 M-F, $200 per month'], ['early4', 'Early Care 7:30-8:30 T-F, $180 per month'], ['after', 'After Care 4:00-5:00, $180 per month']];
  const FIELDS = [['child', "Child's name"], ['sex', 'Sex'], ['dob', 'DOB'], ['parents', 'Parent(s) name(s)'], ['address', 'Address'], ['city', 'City'], ['zip', 'Zip'], ['email', 'Email'], ['home', 'Home'], ['cell', 'Cell']];
  const money = n => '$' + Number(n).toLocaleString('en-US');
  const md = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '________________'; };
  // the office's schedule for the child, as a program on the agreement
  const programFor = sched => { const s = String(sched || '').replace(/\s/g, ''); return { 'M,W,F': 'mwf', 'Tu,Th': 'tth', 'Tu,W,Th,F': 'full', 'M,Tu,W,Th,F': 'mf' }[s] || ''; };
  // the terms, page one then page two, each initialed by the family
  function terms(aa, program) {
    aa = aa || {}; const p = PROGRAMS.find(x => x[0] === program);
    return { page1: [`I accept admission for the school year beginning ${md(aa.start)}, ending ${md(aa.end)}.`, 'I have received, read and agree to all items and terms outlined in the Parent Handbook including tuition rate listed.', `A non-refundable program fee of $450 is due by ${md(aa.fee)}.`, 'I understand that no refunds or credits will be granted.', 'In the event of school closure of more than 30 days subsequent tuition charges will be suspended until the program resumes.', 'I understand that if I do not fulfill 10 Parent participation hours, I will be charged $200 in lieu of participating.', 'I understand that the tuition is based on a yearly rate and payable monthly for convenience.', `I undertake the annual tuition of ${p ? money(p[2]) : '$________'} in 10 monthly installments (Aug. to May) of ${p ? money(p[3]) : '$________'}.`, 'I understand that there will be an annual tuition increase.', 'Tuition is due in advance on the 1st of each month. There is a $45 late fee for tuition paid after the 5th of the month.', 'Payment may be made with cash, credit card, check or online.', 'Should a check be returned a fee of $50 plus the late fee will be charged.', '$1 per minute late fee is charged for all late pickups.', 'Tuition that is past due may result in termination of enrollment.', 'In case of withdrawal, I agree to notify the school 30 days in advance.'],
      page2: ['This agreement may be terminated by the administration without notice at any time if the health and safety of any person cannot be maintained.', 'The Department of licensing agency shall have the authority to interview children, or staff, and to inspect and audit child or facility records without prior consent. The licensee shall make provisions for private interviews with child(ren), or any staff member; and for the examination of all records relating to the operation of the facility. B) The Department or licensing agency shall have the authority to observe the physical condition of the child(ren), including conditions which could indicate abuse, neglect, or inappropriate placement, and have to have a licensed medical professional physically examine the child(ren). NOTE. Authority cited, Section 1596.81, Health and Safety Code. Reference, Sections 1596.72, 1596.73, 1596.81, 1596.852 and 1596.853, Health and Safety Code.', 'All forms required by Community Care Licensing, including proof of immunizations must be submitted before a child is enrolled, children will not be admitted without submission of required forms.', 'In case of any changes to this agreement, any changes will be signed as a new agreement by all parties.'] };
  }
  const STATEMENT = 'I have read, understand, and agree to the terms of this Admission Tuition Agreement and the Parent Handbook and hereby enroll my child for attendance at Fulton Community School & Farm.';
  const ESIGN = 'I agree that typing my full name below is my legal signature on this Admission Agreement.';
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
  const api = { PROGRAMS, ADDONS, FIELDS, STATEMENT, ESIGN, terms, missing, count, programFor, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FultonAgreement = api;
})(typeof window !== 'undefined' ? window : this);
