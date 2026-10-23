/* Which enrollment boxes are still empty. Every box is needed, with a few that follow from an answer: a second parent,
   a person responsible, and emergency or pickup people after the first, are needed only once any of their boxes is
   started; an address is not needed when the parent lives at the child's address; an "if yes" box only after a yes.
   Used by the Family page before a family marks the form complete, and by the server to check it. */
(function(root){
  function enrollMissing(data, ENROLL){
    const d = data || {}; const v = k => String(d[k] == null ? '' : d[k]).trim(); const yes = k => /^yes/i.test(v(k));
    const filled = keys => keys.some(k => k !== undefined && !/_(state|same)$/.test(k) && v(k) && d[k] !== true);
    const skip = new Set(['sun']);
    // groups that are needed only once started
    const group = (pre) => (k => k.startsWith(pre));
    const optional = [group('p2_'), group('r_'), group('e2_'), group('e3_'), group('e4_'), group('a2_'), group('a3_'), group('a4_'), group('a5_')];
    const all = ENROLL.flatMap(s => s.fields);
    const out = [];
    for (const f of all) {
      const k = f.k; if (skip.has(k) || f.type === 'check' || f.type === 'illness') continue;
      const og = optional.find(g => g(k)); if (og && !filled(all.map(x => x.k).filter(og))) continue;
      const p = (k.match(/^(p1_|p2_)/) || [])[1]; if (p && /(street|city|state|zip)$/.test(k) && (d[p + 'same'] === true || d[p + 'same'] === 'true')) continue;
      const when = { noreach_other: v('noreach') === 'Other', d_stage: yes('d_toilet'), d_bmtime: yes('d_bm'), d_napwhen: v('d_nap') && !/^no/i.test(v('d_nap')), d_naplong: v('d_nap') && !/^no/i.test(v('d_nap')),
        h_coldsn: yes('h_colds'), fa_food: yes('fa_has'), fa_reaction: yes('fa_has'), fa_reason: yes('fa_has'), fa_medical: yes('fa_has'), v_doctorname: yes('v_doctor'), v_medswhat: yes('v_meds'), v_devicewhat: yes('v_device'), v_devhomewhat: yes('v_devhome') };
      if (k in when && !when[k]) continue;
      if (!v(k)) out.push(f);
    }
    return out;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = enrollMissing; else root.enrollMissing = enrollMissing;
})(typeof window !== 'undefined' ? window : this);
