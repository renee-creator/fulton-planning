/* The state licensing forms for a new child, filled with what the family typed once on the Family page.
   TREE prints them for the family to sign at the visit, and the Family page shows them so the family sees what they fill in.
   LIC 700, 702, 627, 995 and 613A, and LIC 9221 when the family agrees to sunscreen. */
(function(){
const FAC={name:"Fulton Community School & Farm",addr:"1225 Fulton Road, Santa Rosa, CA 95401",license:"493009877"};
// the Santa Rosa child care regional office of Community Care Licensing, which covers Sonoma County
const LICO={name:"Community Care Licensing, Santa Rosa Child Care Regional Office",addr:"1450 Neotomas Avenue, Suite 100, Santa Rosa, CA 95405",street:"1450 Neotomas Avenue, Suite 100",city:"Santa Rosa",zip:"95405",phone:"(707) 588-5026"};
const mdy=s=>{const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[2]}/${m[3]}/${m[1]}`:String(s||"")};
const splitStreet=s=>{const m=String(s||"").trim().match(/^(\d+[A-Za-z]?)\s+(.*)$/);return m?[m[1],m[2]]:["",String(s||"").trim()]};
const splitPhone=s=>{const d=String(s||"").replace(/\D/g,"").replace(/^1(?=\d{10}$)/,"");return d.length===10?[d.slice(0,3),d.slice(3,6)+"-"+d.slice(6)]:["",String(s||"")]};
// the admission agreement as a boxed sheet, the same look as the curriculum plan form
async function drawAgreement(out, PDFLib, c) {
  const F = await out.embedFont(PDFLib.StandardFonts.Helvetica), B = await out.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const rgb = (r, g, b) => PDFLib.rgb(r / 255, g / 255, b / 255);
  const ink = rgb(34, 48, 40), green = rgb(47, 90, 67), tint = rgb(234, 242, 236), line = rgb(205, 215, 208), gray = rgb(110, 122, 114);
  const M = 40, W = 532, STRIP = 18, PAD = 10; let pg, y, n = 0; const pages = [];
  const wrap = (t, f, sz, w) => { const o = []; let l = ''; for (const w0 of String(t || '').split(/\s+/).filter(Boolean)) { const tt = l ? l + ' ' + w0 : w0; if (f.widthOfTextAtSize(tt, sz) <= w) l = tt; else { if (l) o.push(l); l = w0; } } if (l) o.push(l); return o; };
  const page = () => { pg = out.addPage([612, 792]); pages.push(pg); n++; y = 752;
    pg.drawText(c.school, { x: M, y, size: n === 1 ? 15 : 11, font: B, color: green });
    const t = 'Admission Tuition Agreement' + (n > 1 ? ', continued' : ''); const yr = c.year ? c.year + ' school year' : '';
    if (n === 1) { y -= 17; pg.drawText(t, { x: M, y, size: 12, font: F, color: ink }); if (yr) pg.drawText(yr, { x: M + W - F.widthOfTextAtSize(yr, 10.5), y, size: 10.5, font: F, color: gray }); }
    else { const s = t + (yr ? ', ' + yr : ''); pg.drawText(s, { x: M + W - F.widthOfTextAtSize(s, 9.5), y, size: 9.5, font: F, color: gray }); }
    y -= 8; pg.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1.2, color: green }); y -= 12; };
  // a box with a label strip. It is drawn as its top, then its rows, then closed, so a long one can run onto the next page.
  let top = 0, label = '';
  const open = (l, note) => { label = l; top = y; pg.drawRectangle({ x: M, y: y - STRIP, width: W, height: STRIP, color: tint });
    pg.drawText(l.toUpperCase(), { x: M + PAD, y: y - 12.3, size: 7.3, font: B, color: green, characterSpacing: .8 });
    if (note) pg.drawText(note, { x: M + W - PAD - F.widthOfTextAtSize(note, 7.5), y: y - 12.3, size: 7.5, font: F, color: gray }); y -= STRIP; };
  const close = () => { pg.drawRectangle({ x: M, y, width: W, height: top - y, borderColor: line, borderWidth: .8 }); y -= 9; };
  const rule = (x0, x1, yy) => pg.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness: .5, color: line });
  const vline = (x, y0, y1) => pg.drawLine({ start: { x, y: y0 }, end: { x, y: y1 }, thickness: .5, color: line });
  // a row of cells, each with a small label and the answer under it
  const cells = (cs, h, first) => { if (!first) rule(M, M + W, y); let x = M; cs.forEach(([l, v, w], i) => { const cw = W * w; if (i) vline(x, y, y - h);
    pg.drawText(l, { x: x + PAD, y: y - 10, size: 7.2, font: F, color: gray }); if (v) { let sz = 10.5; const t = String(v); while (sz > 7 && F.widthOfTextAtSize(t, sz) > cw - 2 * PAD) sz -= .5; pg.drawText(t, { x: x + PAD, y: y - h + 7, size: sz, font: F, color: ink }); } x += cw; }); y -= h; };
  const tick = (x, yy, on) => { pg.drawRectangle({ x, y: yy - 1.5, width: 9, height: 9, borderColor: ink, borderWidth: .8 }); if (on) { pg.drawLine({ start: { x: x + 1.7, y: yy + 3 }, end: { x: x + 3.9, y: yy + .3 }, thickness: 1.2, color: ink }); pg.drawLine({ start: { x: x + 3.9, y: yy + .3 }, end: { x: x + 7.8, y: yy + 6.6 }, thickness: 1.2, color: ink }); } };

  page();
  open('Child and family'); const f = c.fields || {};
  cells([["Child's name", f.child, .56], ['Sex', f.sex, .14], ['Date of birth', f.dob, .30]], 27, true);
  cells([['Parent or guardian names', f.parents, 1]], 27);
  cells([['Address', f.address, .52], ['City', f.city, .30], ['Zip', f.zip, .18]], 27);
  cells([['Email', f.email, .44], ['Home phone', f.home, .28], ['Cell phone', f.cell, .28]], 27); close();
  open('Program', 'Check one'); y -= 5; c.programs.forEach(([l, on]) => { y -= 13; tick(M + PAD, y, on); pg.drawText(l, { x: M + PAD + 16, y, size: 9.5, font: F, color: ink }); }); y -= 8; close();
  if (c.addons.length) { open('Early care and after care', 'Check any that apply'); y -= 5; c.addons.forEach(([l, on]) => { y -= 13; tick(M + PAD, y, on); pg.drawText(l, { x: M + PAD + 16, y, size: 9.5, font: F, color: ink }); }); y -= 8; close(); }
  // the terms, each with a place for initials on the left
  const IW = 46, SZ = 9.3, LH = 11.8; let ai = 0;
  const termsHead = cont => { open('Tuition agreement' + (cont ? ', continued' : ''), 'Please read carefully and initial each line'); };
  termsHead(false); let colTop = y; const endCol = () => vline(M + IW, colTop, y);
  for (const t of c.terms) { const ls = wrap(t, F, SZ, W - IW - 2 * PAD), h = ls.length * LH + 9;
    if (y - h < 54) { endCol(); close(); page(); termsHead(true); colTop = y; } else if (y !== colTop) rule(M, M + W, y);
    const ag = c.ag; if (ag && ag.initials && (ag.ticks || [])[ai]) pg.drawText(String(ag.initials).toUpperCase().slice(0, 4), { x: M + 12, y: y - h / 2 - 3.5, size: 10, font: B, color: ink });
    else rule(M + 9, M + IW - 9, y - h + 8);
    ls.forEach((l, i) => pg.drawText(l, { x: M + IW + PAD, y: y - 13 - i * LH, size: SZ, font: F, color: ink })); y -= h; ai++; }
  endCol(); close();
  // the statement and the signatures stay together
  const st = wrap(c.statement, B, 10, W - 2 * PAD), need = STRIP + st.length * 13.5 + 16 + 9 + STRIP + 2 * 40 + (c.signedNote ? 30 : 0) + 20;
  if (y - need < 40) page();
  open('Agreement'); y -= 6; st.forEach(l => { y -= 13.5; pg.drawText(l, { x: M + PAD, y, size: 10, font: B, color: ink }); }); y -= 10; close();
  open('Signatures'); (c.signs || [{}, {}]).forEach((s, i) => cells([['Signature of parent or guardian', s.sig || '', .44], ['Printed name', s.name || '', .34], ['Date', s.date || '', .22]], 40, i === 0)); close();
  if (c.signedNote) wrap(c.signedNote, F, 8.5, W).forEach(l => { y -= 11; pg.drawText(l, { x: M, y, size: 8.5, font: F, color: gray }); });
  pages.forEach((p, i) => { const s = 'Page ' + (i + 1) + ' of ' + pages.length; p.drawText(s, { x: M + W - F.widthOfTextAtSize(s, 8), y: 28, size: 8, font: F, color: gray }); p.drawText(c.school, { x: M, y: 28, size: 8, font: F, color: gray }); });
}
async function fillEnrollForms(data,o){o=o||{};const ef={data:data||{}};const base=o.base||"";
  // the agreement's wording comes from the records, passed in as o.agreementWords
  if(!window.TREE_WORDS)await new Promise((ok,no)=>{const sc=document.createElement("script");sc.src=base+"wording.js";sc.onload=ok;sc.onerror=()=>no(new Error("The agreement could not be loaded."));document.head.appendChild(sc)});
  if(!window.FultonAgreement)await new Promise((ok,no)=>{const sc=document.createElement("script");sc.src=base+"agreement.js";sc.onload=ok;sc.onerror=()=>no(new Error("The agreement could not be loaded."));document.head.appendChild(sc)});
  // pdf-lib comes from the print kit, print-kit.js, as every print does
  if(!window.PDFLib)await window.TREE_KIT.pdfLib().catch(()=>{throw new Error("The forms could not be opened.")});
  const d=ef.data||{},v=k=>String(d[k]==null?"":d[k]).trim();const yes=k=>/^yes$/i.test(v(k)),no=k=>/^no$/i.test(v(k));
  const nm=p=>[v(p+"first"),v(p+"middle"),v(p+"last")].filter(Boolean).join(" ");
  const addrOf=p=>d[p+"same"]===true||d[p+"same"]==="true"||(!v(p+"street")&&p!=="c_")?["c_street","c_city","c_state","c_zip"].map(v):[v(p+"street"),v(p+"city"),v(p+"state"),v(p+"zip")];
  const out=await PDFLib.PDFDocument.create();
  const fill=async(file,set)=>{const bytes=await fetch(base+"forms/"+file+".pdf").then(r=>{if(!r.ok)throw new Error(file);return r.arrayBuffer()});const doc=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:true});const form=doc.getForm();
    const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    // a phone number sits inside the printed ( ), and long answers shrink to fit their box
    const ph=x=>{const g=String(x).replace(/\D/g,"");return g.length===10?" "+g.slice(0,3)+"   "+g.slice(3,6)+"-"+g.slice(6):x};
    const T=(n,val)=>{if(val==null||val==="")return;try{const f=form.getTextField(n);let t=String(val);if(/^[\s()+.\d-]{10,16}$/.test(t))t=ph(t);const max=f.getMaxLength();if(max)t=t.slice(0,max);
      const w=f.acroField.getWidgets()[0];const r=w&&w.getRectangle();if(r&&!f.isMultiline()){let sz=10;while(sz>6&&font.widthOfTextAtSize(t,sz)>r.width-4)sz-=.5;f.setFontSize(sz)}f.setText(t)}catch(e){}};const C=(n,on)=>{if(!on)return;try{form.getCheckBox(n).check()}catch(e){}};
    set(T,C);try{form.updateFieldAppearances(font)}catch(e){}try{form.flatten()}catch(e){}const pages=await out.copyPages(doc,doc.getPageIndices());pages.forEach(pg=>out.addPage(pg))};
  // o.only "agreement" makes the admission agreement alone. o.blank makes the whole packet with nothing filled in, for printing ahead.
  const justAg=o.only==="agreement";const forms=async()=>{
  const L=n=>"LIC 700 "+n;
  await fill("LIC700",(T,C)=>{const [cn,cs]=splitStreet(v("c_street"));T(L(2),v("c_last"));T(L(3),v("c_middle"));T(L(4),v("c_first"));T(L(5),v("c_sex"));T(L(6),v("c_phone"));T(L(7),cn);T(L(8),cs);T(L(9),v("c_city"));T(L(10),v("c_state"));T(L(11),v("c_zip"));T(L(12),mdy(v("c_dob")));
    [["p1_",13],["p2_",23]].forEach(([p,b])=>{if(!nm(p))return;const a=addrOf(p);const [an,as]=splitStreet(a[0]);T(L(b),v(p+"last"));T(L(b+1),v(p+"middle"));T(L(b+2),v(p+"first"));T(L(b+3),v(p+"work"));T(L(b+4),an);T(L(b+5),as);T(L(b+6),a[1]);T(L(b+7),a[2]);T(L(b+8),a[3]);T(L(b+9),v(p+"home"))});
    T(L(33),v("r_last"));T(L(34),v("r_middle"));T(L(35),v("r_first"));T(L(36),v("r_home"));T(L(37),v("r_work"));
    [1,2,3,4].forEach(i=>{const b=38+(i-1)*4;T(L(b),v("e"+i+"_name"));T(L(b+1),v("e"+i+"_addr"));T(L(b+2),v("e"+i+"_phone"));T(L(b+3),v("e"+i+"_rel"))});
    T(L(54),v("doc_name"));T(L(55),v("doc_addr"));T(L(56),v("doc_plan"));T(L(57),v("doc_phone"));T(L(58),v("den_name"));T(L(59),v("den_addr"));T(L(60),v("den_plan"));T(L(61),v("den_phone"));
    C(L(62),v("noreach")!=="Other");C(L(63),v("noreach")==="Other");T(L(64),v("noreach_other"));
    [1,2,3,4,5].forEach(i=>{T(L(64+i*2),v("a"+i+"_name"));T(L(65+i*2),v("a"+i+"_rel"))});T(L(76),v("pickup_time"));
    T(L(79),o.enrollDate?mdy(o.enrollDate):"")});
  const M=n=>"LIC 702 "+n;
  await fill("LIC702",(T,C)=>{T(M(2),nm("c_"));T(M(3),v("c_sex"));T(M(4),mdy(v("c_dob")));T(M(5),nm("p1_"));T(M(6),v("p1_lives"));T(M(7),nm("p2_"));T(M(8),v("p2_lives"));T(M(9),v("h_regular"));T(M(10),mdy(v("h_lastexam")));T(M(11),v("h_walked"));T(M(12),v("h_talked"));T(M(13),v("h_toilet"));
    ["chickenpox","asthma","rheumatic","hayfever","diabetes","epilepsy","whooping","mumps","polio","rubeola","rubella"].forEach((k,i)=>{const w=v("h_ill_"+k);C(M(14+i*2),!!w);T(M(15+i*2),w)});
    T(M(36),v("h_other"));C(M(37),yes("h_colds"));C(M(38),no("h_colds"));T(M(39),v("h_coldsn"));T(M(40),v("h_allergies"));
    [["d_wake",41],["d_bed",42],["d_sleepwell",43],["d_nap",44],["d_napwhen",45],["d_naplong",46],["d_bfast",47],["d_lunch",48],["d_dinner",49],["d_bfast_t",50],["d_lunch_t",51],["d_dinner_t",52],["d_dislikes",53],["d_eatprob",54]].forEach(([k,n])=>T(M(n),v(k)));
    C(M(55),yes("d_toilet"));C(M(56),no("d_toilet"));T(M(57),v("d_stage"));C(M(58),yes("d_bm"));C(M(59),no("d_bm"));T(M(60),v("d_bmtime"));T(M(61),v("d_bmword"));T(M(62),v("d_uword"));T(M(63),v("v_health"));
    C(M(64),yes("v_doctor"));C(M(65),no("v_doctor"));T(M(66),v("v_doctorname"));C(M(67),yes("v_meds"));C(M(68),no("v_meds"));T(M(69),v("v_medswhat"));C(M(70),yes("v_device"));C(M(71),no("v_device"));T(M(72),v("v_devicewhat"));C(M(73),yes("v_devhome"));C(M(74),no("v_devhome"));T(M(75),v("v_devhomewhat"));
    [["v_personality",76],["v_along",77],["v_group",78],["v_needs",79],["v_ill",80],["v_reason",81]].forEach(([k,n])=>T(M(n),v(k)))});
  await fill("LIC627",T=>{const a=addrOf("p1_");const [ha,hp]=splitPhone(v("p1_home")),[wa,wp]=splitPhone(v("p1_work"));T("Facility Name",FAC.name);T("Name",v("doc_name"));T("Medications",v("med_allergy"));T("Street Address",a[0]);T("City state and zipcode",[a[1],a[2],a[3]].filter(Boolean).join(" "));T("Home area code",ha);T("Home phone",hp);T("work phone area code",wa);T("work phone",wp)});
  await fill("LIC995",T=>{T("LIC 995 1",LICO.name);T("LIC 995 2",LICO.addr);T("LIC 995 3",LICO.phone);T("LIC 995 4",nm("c_"));T("LIC 995 5",FAC.name)});
  await fill("LIC613A",T=>{T("LIC613a_1",LICO.name);T("LIC613a_2",LICO.street);T("LIC613a_3",LICO.city);T("LIC613a_4",LICO.zip);T("LIC613a_5",LICO.phone);T("LIC613a_6",FAC.name);T("LIC613a_7",FAC.addr);T("LIC613a_8",nm("c_"));T("LIC613a_10","Parent")});
  if(o.blank){for(const f of ["LIC701","LIC995E"])await fill(f,()=>{})}
  if(o.blank||d.sun===true||d.sun==="true")await fill("LIC9221",T=>{T("Text Field 12",FAC.name);T("Text Field 13",FAC.license);T("Text Field 15",nm("c_"));T("Text Field 16",mdy(v("c_dob")));T("Text Field 17","School provided sunscreen");T("Text Field 18","Apply as directed on the label");T("Text Field 22","Before outdoor play and as needed")});
  if(o.blank){for(const f of ["PUB515","WaterLead2026"])await fill(f,()=>{})}
  };if(!justAg)await forms();
  // Fulton's admission agreement, as the school wrote it, with what TREE knows filled in. The family initials each line and signs at the visit.
  // It is a boxed sheet, the look of the curriculum plan form, chosen November 17, 2026. The words all come from the records.
  {const yr=o.aa||{};const yearTitle=yr.start?`${yr.start.slice(0,4)}-${Number(yr.start.slice(0,4))+1}`:"";
    const ag=o.agreement||null;const A=window.FultonAgreement;if(o.agreementWords)A.use(o.agreementWords);const g=ag&&ag.fields?ag:null;const gf=g?g.fields:{};
    const prog=g?g.program:o.blank||(justAg&&!o.schedule)?"":A.programFor(o.schedule);const T=A.terms(g&&g.aa&&g.aa.start?g.aa:yr,prog);
    const signed=!!(ag&&ag.done);const sd=signed?new Date(ag.signedAt).toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}):"";
    const signs=[0,1].map(i=>{const sg=signed?(i===0?ag.sign1:ag.sign2)||{}:{};const pn=g?(i===0?(ag.sign1||{}).name:(ag.sign2||{}).name):(i===0?nm("p1_"):nm("p2_"));return {sig:sg.name?"/s/ "+sg.name:"",name:pn||"",date:sg.name?sd:""}});
    await drawAgreement(out,PDFLib,{school:FAC.name,year:yearTitle,
      fields:{child:g?gf.child:nm("c_"),sex:g?gf.sex:v("c_sex"),dob:g?gf.dob:mdy(v("c_dob")),parents:g?gf.parents:[nm("p1_"),nm("p2_")].filter(Boolean).join(" and "),address:g?gf.address:v("c_street"),city:g?gf.city:v("c_city"),zip:g?gf.zip:v("c_zip"),email:g?gf.email:(o.email||""),home:g?gf.home:(v("c_phone")||v("p1_home")),cell:g?gf.cell:""},
      programs:A.PROGRAMS.map(([key,l])=>[l,prog===key]),addons:A.ADDONS.map(([key,l])=>[l,!!(g&&(g.addons||[]).includes(key))]),
      terms:T.page1.concat(T.page2),statement:A.STATEMENT,ag,signs,
      signedNote:signed?`Signed electronically on the Family page on ${sd} by ${[ag.sign1&&ag.sign1.name,ag.sign2&&ag.sign2.name].filter(Boolean).join(" and ")}${ag.by?", "+ag.by:""}.`:""})}
  // the school's own page, the food allergy and dietary information, signed at the visit with the state forms
  if(!justAg){const pg=out.addPage([612,792]);const F=await out.embedFont(PDFLib.StandardFonts.Helvetica),B=await out.embedFont(PDFLib.StandardFonts.HelveticaBold);const ink=PDFLib.rgb(.1,.13,.11),gray=PDFLib.rgb(.4,.43,.41);
    let y=740;const M=60,W=492;
    const wrap=(t,f,sz,w)=>{const out=[];for(const para of String(t||"").split("\n")){let line="";for(const w0 of para.split(/\s+/).filter(Boolean)){const tt=line?line+" "+w0:w0;if(f.widthOfTextAtSize(tt,sz)<=w)line=tt;else{if(line)out.push(line);line=w0}}out.push(line)}return out};
    const text=(t,f,sz,c)=>{for(const l of wrap(t,f,sz,W)){pg.drawText(l,{x:M,y,size:sz,font:f,color:c||ink});y-=sz*1.35}};
    const pair=(l,v)=>{pg.drawText(l,{x:M,y,size:10,font:B,color:ink});pg.drawText(String(v||""),{x:M+150,y,size:10.5,font:F,color:ink});y-=20};
    pg.drawText(FAC.name,{x:M,y,size:9,font:F,color:gray});y-=26;
    text("Food Allergy and Dietary Information",B,18);y-=8;
    pair("Child",nm("c_"));pair("Birthdate",mdy(v("c_dob")));pair("Class",o.classroom||"");pair("Parent or guardian",nm("p1_"));pair("Home telephone",v("p1_home"));pair("Work telephone",v("p1_work"));y-=8;
    const rule=n=>{for(let i=0;i<n;i++){y-=14;pg.drawLine({start:{x:M,y},end:{x:M+W,y},thickness:.5,color:gray});y-=6}y-=6};
    if(o.blank){text("My child has a food allergy, severe food allergy or dietary need.     Yes        No",F,11);y-=8;text("Foods to avoid",B,11);rule(2);text("The nature of the reaction or sensitivity",B,11);rule(2);text("Reason",B,11);rule(1);text("Is this a medical condition? If yes, please bring a note from the doctor.",B,11);rule(1)}
    else if(yes("fa_has")){text("Foods to avoid",B,11);text(v("fa_food"),F,10.5);y-=6;text("The nature of the reaction or sensitivity",B,11);text(v("fa_reaction"),F,10.5);y-=6;
      pair("Reason",v("fa_reason"));pair("Medical condition",v("fa_medical"));if(yes("fa_medical"))text("Please bring a note from the doctor.",F,10,gray)}
    else text("My child has no food allergy, severe food allergy or dietary need.",F,11);
    y-=14;text("We are a nut free school. A severe food allergy is a dangerous or life-threatening reaction to a food, by breathing, eating or touching it, that needs medical care right away.",F,9.5,gray);y-=4;
    text("We keep this information confidential and share it only with the educators and school staff who care for your child.",F,9.5,gray);
    y=Math.min(y-40,170);pg.drawLine({start:{x:M,y},end:{x:M+300,y},thickness:.6,color:gray});pg.drawLine({start:{x:M+340,y},end:{x:M+W,y},thickness:.6,color:gray});
    pg.drawText("Signature of parent or guardian",{x:M,y:y-12,size:8.5,font:F,color:gray});pg.drawText("Date",{x:M+340,y:y-12,size:8.5,font:F,color:gray})}
  return await out.save()}
window.fillEnrollForms=fillEnrollForms;window.ENROLL_LICO=LICO;window.ENROLL_FAC=FAC;
})();
