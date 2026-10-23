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
async function fillEnrollForms(data,o){o=o||{};const ef={data:data||{}};const base=o.base||"";
  if(!window.PDFLib)await new Promise((ok,no)=>{const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";sc.onload=ok;sc.onerror=()=>no(new Error("The forms could not be opened."));document.head.appendChild(sc)});
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
  if(d.sun===true||d.sun==="true")await fill("LIC9221",T=>{T("Text Field 12",FAC.name);T("Text Field 13",FAC.license);T("Text Field 15",nm("c_"));T("Text Field 16",mdy(v("c_dob")));T("Text Field 17","School provided sunscreen");T("Text Field 18","Apply as directed on the label");T("Text Field 22","Before outdoor play and as needed")});
  return await out.save()}
window.fillEnrollForms=fillEnrollForms;window.ENROLL_LICO=LICO;window.ENROLL_FAC=FAC;
})();
