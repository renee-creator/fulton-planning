/* ---------- Developmental screening with the ASQ-3 and ASQ:SE-2 ----------
   The director was given the ASQ-3 and ASQ:SE-2 questionnaires at a training to use in our program. They are kept in the
   private records, never on the public site, with where each answer goes on each page (tools/asq_layout.py reads them).
   A screening is offered when a question comes up, from a child's page or from a team inquiry. We do not screen every
   child. TREE picks the questionnaire from the child's birthday and the form's own age range. The educator completes one
   copy and the family completes one, which an educator enters from the family's paper copy exactly as the family marked
   it. Each is scored on its own against the form's cutoffs. The ASQ-3 copies may be joined into one final screen the team
   agrees on together, and the ASQ:SE-2 copies are always kept separate, as the publisher's guidance says. Every result is
   kept. TREE prints the original form filled in, with its summary, and a side by side page for the family meeting or a
   specialist. A screening is for the director and the educators of the child's class. */
let screenings=new Map(),scrBase=new Map(),scrOpen="",scrEdit="",scrPg=1,scrStartDate="",scrStartInq="",scrBusy=false;
const SCR={list:null,listing:null,lay:new Map(),layP:new Map(),pdf:new Map(),doc:new Map(),img:new Map(),imgP:new Map(),err:""};
const SCR_NAME={asq3:"ASQ-3",asqse2:"ASQ:SE-2"};
const SCR_ABOUT={asq3:"Communication, gross motor, fine motor, problem solving and personal-social development",asqse2:"Social-emotional development, such as self-regulation, relating to others and communicating feelings"};
const SCR_CITE={asq3:"Ages & Stages Questionnaires, Third Edition (ASQ-3), Squires & Bricker. Paul H. Brookes Publishing Co.",asqse2:"Ages & Stages Questionnaires: Social-Emotional, Second Edition (ASQ:SE-2), Squires, Bricker & Twombly. Paul H. Brookes Publishing Co."};
const SCR_COPY={educator:"Educator's questionnaire",family:"Family's questionnaire",final:"Final screen"};
const SCR_REL=[["teacher","Teacher"],["provider","Child care provider"],["parent","Parent"],["guardian","Guardian"],["grand","Grandparent or other relative"],["foster","Foster parent"],["other","Other"]];
const SCR_A3={y:"Yes",s:"Sometimes",n:"Not yet"},SCR_SE={often:"Often or always",some:"Sometimes",rarely:"Rarely or never"};
const SCR_ZONE={asq3:{above:"Above the cutoff",close:"Close to the cutoff, in the monitoring zone",below:"Below the cutoff",unscored:"Not scored"},asqse2:{below:"Below the cutoff",close:"Close to the cutoff, in the monitoring zone",above:"Above the cutoff",unscored:"Not scored"}};
const scrCan=c=>!(typeof isKitchenUser==="function"&&isKitchenUser())&&(isDirector()||(!!c&&!!myRoom()&&c.classroom===myRoom()));
const scrOf=c=>[...screenings.values()].filter(x=>x&&x.child===c.id).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||(b.createdAt||0)-(a.createdAt||0));
function saveScreening(x){x.updatedAt=Date.now();x.updatedBy=whoAmI();screenings.set(x.id,x);if(db)savePart("screenings",scrBase,x,"screening")}
const scrTimers={};
function saveScreeningSoon(x){screenings.set(x.id,x);clearTimeout(scrTimers[x.id]);scrTimers[x.id]=setTimeout(()=>saveScreening(x),700)}

/* ---------- age and which questionnaire ---------- */
// the child's age on the day of the screening in months and days, as the ASQ counts it
function scrAge(dob,on){if(!dob||!on)return null;const b=parseIso(String(dob).slice(0,10)),n=parseIso(String(on).slice(0,10));let m=(n.getFullYear()-b.getFullYear())*12+n.getMonth()-b.getMonth(),d=n.getDate()-b.getDate();
  if(d<0){m--;d+=new Date(n.getFullYear(),n.getMonth(),0).getDate()}return m<0?null:{m,d}}
const scrAgeText=a=>a?`${a.m} month${a.m===1?"":"s"} ${a.d} day${a.d===1?"":"s"}`:"";
const scrWin=f=>f&&f.window?`${f.window.from[0]} months ${f.window.from[1]} days through ${f.window.to[0]} months ${f.window.to[1]} days`:"";
function scrFit(tool,a){if(!a)return null;const v=a.m*100+a.d;return (SCR.list||[]).filter(f=>f.tool===tool&&f.window).find(f=>v>=f.window.from[0]*100+f.window.from[1]&&v<=f.window.to[0]*100+f.window.to[1])||null}
const scrFormName=f=>f?`${SCR_NAME[f.tool]} ${f.months} month questionnaire`:"";
// a suggestion from what the team wrote in the inquiry. The team chooses.
function scrSuggest(text){const t=String(text||"").toLowerCase();
  const se=(t.match(/\b(behavio\w*|feel\w*|emotion\w*|social\w*|friend\w*|play\w* with|hit\w*|bit\w*|bite|push\w*|calm\w*|regulat\w*|tantrum\w*|cry\w*|upset|angry|anger|worr\w*|fear\w*|separat\w*|attach\w*|kindness|share|sharing|turns?|destroy\w*|aggress\w*|withdraw\w*|shy|transition\w*)\b/g)||[]).length;
  const a3=(t.match(/\b(speech|speak\w*|talk\w*|word\w*|language|sentence\w*|understand\w*|communicat\w*|walk\w*|run\w*|climb\w*|jump\w*|balance|motor|scissors|pencil|crayon|draw\w*|grasp\w*|puzzle\w*|problem solving|count\w*|delay\w*|develop\w*|toilet\w*|dress\w*|hearing|vision)\b/g)||[]).length;
  return !se&&!a3?"":se>a3*1.5?"asqse2":a3>se*1.5?"asq3":"both"}

/* ---------- the forms and their pages, read once from the server ---------- */
const scrAuth=()=>({"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")});
function scrLoadList(){if(SCR.list)return Promise.resolve(SCR.list);if(!SCR.listing)SCR.listing=window.FP_API("/api/staff/screening/forms",{}).then(j=>{SCR.list=j.forms||[];SCR.err="";return SCR.list}).catch(e=>{SCR.listing=null;SCR.err=(e&&e.message)||"The questionnaires could not be opened.";throw e});return SCR.listing}
function scrLayout(id){if(SCR.lay.has(id))return Promise.resolve(SCR.lay.get(id));if(!SCR.layP.has(id))SCR.layP.set(id,window.FP_API("/api/staff/screening/layout",{id}).then(j=>{SCR.lay.set(id,j.form);return j.form}).catch(e=>{SCR.layP.delete(id);throw e}));return SCR.layP.get(id)}
async function scrPdf(id){if(SCR.pdf.has(id))return SCR.pdf.get(id);const r=await fetch(window.FP_SERVER+"/api/staff/screening/form",{method:"POST",headers:scrAuth(),body:JSON.stringify({id})});
  if(!r.ok)throw new Error("The questionnaire could not be opened.");const b=new Uint8Array(await r.arrayBuffer());SCR.pdf.set(id,b);return b}
function scrImg(id,p){const k=id+"|"+p;if(SCR.img.has(k))return Promise.resolve(SCR.img.get(k));
  if(!SCR.imgP.has(k))SCR.imgP.set(k,(async()=>{const lib=await TREE_KIT.pdfjs();let doc=SCR.doc.get(id);if(!doc){doc=await lib.getDocument({data:(await scrPdf(id)).slice()}).promise;SCR.doc.set(id,doc)}
    const b=await TREE_KIT.pageImage(doc,p,{width:1100,white:true,quality:.82});const u=URL.createObjectURL(b);SCR.img.set(k,u);return u})().catch(e=>{SCR.imgP.delete(k);throw e}));return SCR.imgP.get(k)}
// the page pictures fill in once they are drawn
function scrHydrate(){document.querySelectorAll("img[data-scrimg]").forEach(im=>{const [id,p]=im.dataset.scrimg.split("|");if(im.dataset.done)return;
  scrImg(id,+p).then(u=>{im.src=u;im.dataset.done="1";const w=im.closest(".scrpage");if(w)w.classList.remove("loading")}).catch(()=>{const w=im.closest(".scrpage");if(w)w.innerHTML=`<div class="cnt">This page could not be drawn. The questions are below.</div>`})})}
function scrNeed(x){const F=SCR.lay.get(x.form);if(F)return F;scrLayout(x.form).then(()=>{if(view==="child")renderMain()}).catch(e=>{SCR.err=(e&&e.message)||"The questionnaire could not be opened.";if(view==="child")renderMain()});return null}

/* ---------- scoring ---------- */
const A3PTS={y:10,s:5,n:0};
function scrScore(F,cp){cp=cp||{};const ans=Object.assign({},cp.answers||{});const notes=[];
  if(F.tool==="asq3"){
    // a note on the form, such as marking Gross Motor item 2 yes when item 6 is yes or sometimes
    for(const r of F.rules||[])if((ans[r.if]==="y"||ans[r.if]==="s")&&ans[r.then]!=="y"){ans[r.then]="y";notes.push(`${scrItemName(F,r.then)} counts as yes, because ${scrItemName(F,r.if)} is marked ${SCR_A3[cp.answers[r.if]].toLowerCase()}, as the form directs.`)}
    const areas=F.areas.map(a=>{const its=F.items.filter(i=>i.area===a.key);const got=its.filter(i=>ans[i.id]in A3PTS);const miss=its.length-got.length;const raw=got.reduce((t,i)=>t+A3PTS[ans[i.id]],0);
      // one or two items left unanswered are made up from the average of the rest. Three or more and the area is not scored.
      let total=null;if(!miss)total=raw;else if(miss<=2&&got.length)total=Math.round(raw/got.length*its.length*100)/100;
      let zone="unscored",edge=false;if(total!=null){if(total<a.cutoff)zone="below";else if(a.monitor!=null&&(total<a.monitor||total===a.monitorNear)){zone="close";edge=total===a.monitorNear}else zone="above"}
      return {key:a.key,name:a.name,cutoff:a.cutoff,monitor:a.monitor,raw,total,miss,adjusted:!!miss&&total!=null,zone,edge}});
    const ov=(F.overall||[]).map(o=>{const a=((cp.overall||{})[o.n]||{}).a||"";const fl=((F.summary.overall||{})[o.n]||{}).flag||"";return {n:o.n,a,follow:!!a&&a===fl}});
    return {tool:"asq3",ans,areas,overall:ov,notes,answered:Object.keys(ans).length,items:F.items.length}}
  const items=F.items.map(i=>{const a=ans[i.id];const p=a&&i.points?i.points[a]:null;const c=!!(cp.concern||{})[i.id];return {id:i.id,n:i.n,pageN:i.pageN,a:a||"",pts:p==null?null:p+(c?5:0),concern:c}});
  const miss=items.filter(i=>i.pts==null).length;const raw=items.reduce((t,i)=>t+(i.pts||0),0);
  const pages=[...new Set(F.items.map(i=>i.pageN))].map(n=>items.filter(i=>i.pageN===n).reduce((t,i)=>t+(i.pts||0),0));
  // up to two items unanswered leave the result as it is. Three need an adjusted score. More, and it is not scored.
  let total=miss<=3?raw:null,zone="unscored";if(total!=null)zone=total>=F.cutoff?"above":(F.monitor!=null&&total>=F.monitor)?"close":"below";
  const ov=(F.overall||[]).filter(o=>o.marks).map(o=>{const a=((cp.overall||{})[o.n]||{}).a||"";return {n:o.n,a,follow:a==="yes"}});
  return {tool:"asqse2",ans,items,pages,raw,total,miss,needsAdjust:miss===3,zone,cutoff:F.cutoff,monitor:F.monitor,concerns:items.filter(i=>i.concern).length,high:items.filter(i=>i.pts!=null&&i.pts>=10).map(i=>i.n),overall:ov,notes,answered:Object.keys(ans).length,itemsN:F.items.length}}
const AREA_SHORT={C:"Communication",GM:"Gross motor",FM:"Fine motor",PS:"Problem solving",PSo:"Personal-social"};
function scrItemName(F,id){const i=F.items.find(i=>i.id===id);if(!i)return id;return F.tool==="asq3"?`${AREA_SHORT[i.area]} item ${i.n}`:`Item ${i.n}`}
const scrAnsLabel=(F,a)=>(F.tool==="asq3"?SCR_A3:SCR_SE)[a]||"";
function scrResultLine(F,s){if(!s)return "";if(F.tool==="asq3")return s.areas.map(a=>`${AREA_SHORT[a.key]} ${a.total==null?"not scored":fmtPts(a.total)}`).join(", ");
  return s.total==null?"Not scored":`Total ${s.total}, ${SCR_ZONE.asqse2[s.zone].toLowerCase()}`}
const fmtPts=v=>v==null?"":String(Math.round(v*100)/100);
function scrCopyDone(cp){return !!cp&&!!cp.done}

/* ---------- the child's Screening tab ---------- */
function kidScreenTab(c){return scrCan(c)?[["screen",`Screening${scrOf(c).length?" "+scrOf(c).length:""}`]]:[]}
function kidScreenHtml(c){if(!scrCan(c))return `<div class="empty">A screening is kept by the director and the educators of ${esc(c.first)}'s class.</div>`;
  if(!SCR.list){scrLoadList().then(()=>{if(view==="child")renderMain()}).catch(()=>{if(view==="child")renderMain()});
    return SCR.err?`<section class="card"><div class="cnt">${esc(SCR.err)}</div></section>`:`<section class="card"><div class="cnt"><span class="spin"></span> Opening the questionnaires</div></section>`}
  const x=scrOpen&&screenings.get(scrOpen);if(x&&x.child===c.id)return scrEdit?scrCopyHtml(x,scrEdit):scrDetailHtml(x,c);
  const list=scrOf(c);
  return `${scrStartHtml(c)}
    <section class="card"><div class="secthead"><h3 style="font-size:17px">Screenings kept</h3><span class="cnt">${list.length||""}</span></div>
      ${list.length?`<div class="tlist">${list.map(x=>scrRowHtml(x)).join("")}</div>`:`<div class="cnt">None yet. Every screening for ${esc(c.first)} stays here, with each questionnaire and its results.</div>`}</section>`}
function scrRowHtml(x){const F=SCR.lay.get(x.form);const cps=["educator","family","final"].filter(k=>x.copies&&x.copies[k]);
  const st=cps.map(k=>`${SCR_COPY[k].replace("'s questionnaire","")} ${x.copies[k].done?"complete":"started"}`).join(", ");
  return `<button class="titem two press" data-scropen="${esc(x.id)}"><div><b>${esc(SCR_NAME[x.tool]+" "+(x.months||"")+" month")}</b><div class="cnt">${esc([x.date?longDate(x.date):"",x.age?scrAgeText(x.age):"",st].filter(Boolean).join(". "))}</div>
    ${F&&x.copies&&x.copies.educator&&x.copies.educator.done?`<div class="cnt">${esc(scrResultLine(F,scrScore(F,x.copies.educator)))}</div>`:""}</div><span class="cnt">Open</span></button>`}
function scrStartHtml(c){if(!c.dob)return `<section class="card"><div class="lbl">Offer a screening</div><div class="cnt">Add ${esc(c.first)}'s birthday on the Details tab first, so TREE can choose the right questionnaire.</div></section>`;
  const on=scrStartDate||iso(new Date());const a=scrAge(c.dob,on);const f3=scrFit("asq3",a),fs=scrFit("asqse2",a);
  const inq=scrStartInq&&inquiries.get(scrStartInq);const sug=inq?scrSuggest([inq.name,inq.see,inq.whenwhere,inq.watch,inq.ibDev,(inq.hyps||[]).map(h=>typeof h==="string"?h:JSON.stringify(h)).join(" ")].join(" ")):"";
  const tools=SCR.list||[];const have=t=>tools.some(f=>f.tool===t);
  const miss=t=>{const L=tools.filter(f=>f.tool===t).map(f=>f.months).sort((p,q)=>p-q);return L.length?`No ${SCR_NAME[t]} questionnaire we keep fits ${scrAgeText(a)}. We keep the ${L.join(", ")} month questionnaires.`:`We keep no ${SCR_NAME[t]} questionnaires yet.`};
  const btn=(t,f)=>f?`<button class="btn small${sug===t||sug==="both"?"":" ghost"}" data-scrstart="${esc(c.id)}|${t}">${esc(scrFormName(f))}</button>`:"";
  return `<section class="card"><div class="lbl">Offer a screening</div>
    <div class="hint">A screening is offered when a question comes up about how ${esc(c.first)} is developing. The educator completes one questionnaire and the family completes one. Each takes 10 to 15 minutes.</div>
    ${inq?`<div class="pdir" style="margin-top:8px"><b>From the team inquiry ${esc(inq.name||"")}</b>${sug?`<div class="cnt">${sug==="both"?"The inquiry's words touch on both. The team chooses one or both.":`The inquiry's words point toward the ${esc(SCR_NAME[sug])}, for ${esc(SCR_ABOUT[sug].charAt(0).toLowerCase()+SCR_ABOUT[sug].slice(1))}. The team chooses.`}</div>`:""}</div>`:""}
    <div class="kfields" style="margin-top:8px"><label>Day of the screening<input type="date" data-scrdate="1" value="${esc(on)}"></label></div>
    <div class="cnt">${esc(c.first)} is ${esc(scrAgeText(a))} on that day.</div>
    <div class="kgrid" style="margin-top:8px">
      <div><span class="lbl">ASQ-3</span><div class="cnt">${esc(SCR_ABOUT.asq3)}.</div>${have("asq3")||f3?(f3?`<div class="cnt">${esc(scrWin(f3))}</div>`:`<div class="cnt">${esc(miss("asq3"))}</div>`):`<div class="cnt">${esc(miss("asq3"))}</div>`}</div>
      <div><span class="lbl">ASQ:SE-2</span><div class="cnt">${esc(SCR_ABOUT.asqse2)}.</div>${fs?`<div class="cnt">${esc(scrWin(fs))}</div>`:`<div class="cnt">${esc(miss("asqse2"))}</div>`}</div></div>
    <div class="actions" style="margin-top:8px">${btn("asq3",f3)}${btn("asqse2",fs)}${f3&&fs?`<button class="btn small${sug==="both"?"":" ghost"}" data-scrstart="${esc(c.id)}|both">Both</button>`:""}</div></section>`}
function scrStart(c,tool,on){if(VIEW_AS){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  const a=scrAge(c.dob,on);const made=[];
  for(const t of tool==="both"?["asq3","asqse2"]:[tool]){const F=scrFit(t,a);if(!F)continue;
    const x={id:"s"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)+(t==="asqse2"?"e":""),child:c.id,tool:t,form:F.id,months:F.months,date:on,age:a,inquiry:scrStartInq||"",
      createdBy:whoAmI(),createdAt:Date.now(),copies:{educator:scrNewCopy("educator"),family:scrNewCopy("family")},follow:{checks:[],months:"",text:{}},factors:{},notes:""};
    saveScreening(x);made.push(x)}
  if(!made.length){toast("No questionnaire fits that day.");return}
  scrOpen=made[0].id;scrEdit="";scrStartInq="";renderMain();jumpTop();toast(made.length>1?"Two screenings are started, one for each questionnaire.":"The screening is started.")}
function scrNewCopy(kind){return kind==="educator"?{who:whoAmI(),rel:"teacher",answers:{},concern:{},words:{},overall:{},done:false}:kind==="family"?{who:"",rel:"parent",answers:{},concern:{},words:{},overall:{},done:false,enteredBy:""}:{who:"",rel:"",answers:{},concern:{},words:{},overall:{},done:false}}

/* ---------- one screening ---------- */
function scrDetailHtml(x,c){const F=scrNeed(x);if(!F)return SCR.err?`<section class="card"><div class="cnt">${esc(SCR.err)}</div></section>`:`<section class="card"><div class="cnt"><span class="spin"></span> Opening the questionnaire</div></section>`;
  const E=x.copies.educator,Fm=x.copies.family,Fi=x.copies.final;const se=F.tool==="asqse2";
  const card=(k,cp)=>{const s=scrScore(F,cp);const n=s.answered,of=F.items.length;
    return `<div class="pdir"><b>${esc(SCR_COPY[k])}</b> <span class="cnt">${esc(cp.done?"Complete"+(cp.doneAt?" "+shortDate(cp.doneAt):""):n?`${n} of ${of} items answered`:"Not started")}</span>
      <div class="cnt">${esc([cp.who?"Completed by "+cp.who+(cp.rel?", "+(SCR_REL.find(r=>r[0]===cp.rel)||["",""])[1].toLowerCase():""):"",k==="family"&&cp.enteredBy?"entered by "+cp.enteredBy+" from the family's paper copy":""].filter(Boolean).join(", "))}</div>
      ${cp.done||n?scrResultHtml(F,s):""}
      <div class="actions"><button class="btn small${cp.done?" ghost":""}" data-scredit="${k}">${cp.done?"Look again":n?"Keep going":k==="family"?"Enter the family's answers":"Begin"}</button>
      ${k==="family"&&!n?`<button class="btn small ghost" data-scrblank="1">Print a blank copy for the family</button>`:""}
      ${cp.done||n?`<button class="linkbtn" data-scrprint="${k}">Print this one, filled in</button>`:""}</div></div>`};
  const both=scrCopyDone(E)&&scrCopyDone(Fm);
  return `<section class="card"><div class="secthead"><h3 style="font-size:17px">${esc(scrFormName(F))}</h3><button class="linkbtn" data-scrback="1">All screenings</button></div>
      <div class="cnt">${esc(longDate(x.date))}. ${esc(c.first||"")} was ${esc(scrAgeText(x.age))} that day.</div>${scrWin(F)?`<div class="cnt">This questionnaire is for ${esc(scrWin(F))}.</div>`:""}
      ${x.inquiry&&inquiries.get(x.inquiry)?`<div class="cnt">Offered from the team inquiry <button class="linkbtn" data-iqopen="${esc(x.inquiry)}">${esc(inquiries.get(x.inquiry).name||"the inquiry")}</button>.</div>`:""}
      <div class="hint" style="margin-top:6px">${se?"The educator and the family each complete a questionnaire. The two are kept separate and compared together.":"The educator and the family each complete a questionnaire. They are compared together, and can be joined into one final screen the team agrees on."}</div></section>
    <section class="card">${card("educator",E)}${card("family",Fm)}${Fi?card("final",Fi):""}</section>
    ${both?scrCompareHtml(x,F):""}
    ${scrFollowHtml(x,F)}
    <section class="card"><div class="lbl">Print</div><div class="hint">The original form, filled in, with its summary page${both?", for each questionnaire, then the side by side page":""}.</div>
      <div class="actions"><button class="btn small" data-scrprint="all">${both?"Print both, with the side by side page":"Print the filled questionnaire"}</button><button class="btn small ghost" data-scrblank="1">Print a blank copy</button></div>
      ${isDirector()?`<div class="actions" style="margin-top:10px"><button class="linkbtn" data-scrremove="${esc(x.id)}">Remove this screening</button></div>`:""}</section>`}
function scrResultHtml(F,s){if(F.tool==="asq3")return `<div class="scrres">${s.areas.map(a=>`<div class="scrrow ${a.zone}"><span>${esc(a.name)}</span><b>${a.total==null?"–":esc(fmtPts(a.total))}</b><span class="cnt">${esc(SCR_ZONE.asq3[a.zone])}${a.adjusted?", adjusted for "+a.miss+" unanswered":""}${a.zone==="unscored"&&a.miss?", "+a.miss+" unanswered":""}${a.edge?", at the edge of the zone as the chart draws it":""}</span></div>`).join("")}</div>
    ${s.overall.some(o=>o.follow)?`<div class="cnt">Overall questions needing follow-up ${esc(s.overall.filter(o=>o.follow).map(o=>o.n).join(", "))}.</div>`:""}${s.notes.map(n=>`<div class="cnt">${esc(n)}</div>`).join("")}`;
  return `<div class="scrres"><div class="scrrow ${s.zone}"><span>Total score</span><b>${s.total==null?"–":s.total}</b><span class="cnt">${esc(SCR_ZONE.asqse2[s.zone])}. Cutoff ${s.cutoff}, monitoring from ${s.monitor}.</span></div></div>
    ${s.needsAdjust?`<div class="cnt">Three items are unanswered, so this total needs an adjusted score. The ASQ:SE-2 User's Guide, page 92, and the ASQ Calculator explain how.</div>`:""}${s.miss>3?`<div class="cnt">${s.miss} items are unanswered, so the total is not scored.</div>`:""}
    ${s.concerns?`<div class="cnt">Concern marked on ${s.concerns} item${s.concerns===1?"":"s"}.</div>`:""}${s.high.length?`<div class="cnt">Items scoring 10 or more ${esc(s.high.join(", "))}.</div>`:""}${s.overall.some(o=>o.follow)?`<div class="cnt">Overall questions answered yes ${esc(s.overall.filter(o=>o.follow).map(o=>o.n).join(", "))}.</div>`:""}`}
// the educator's and the family's answers side by side, with where they differ
function scrDiffs(F,x){const E=x.copies.educator,Fm=x.copies.family;return F.items.filter(i=>(E.answers||{})[i.id]!==(Fm.answers||{})[i.id]||!!(E.concern||{})[i.id]!==!!(Fm.concern||{})[i.id])}
function scrCompareHtml(x,F){const E=scrScore(F,x.copies.educator),M=scrScore(F,x.copies.family);const dif=scrDiffs(F,x);const se=F.tool==="asqse2";
  const head=`<div class="scrcmp scrhead"><span></span><b>Educator</b><b>Family</b></div>`;
  const rows=se?`<div class="scrcmp"><span>Total score</span><span class="${E.zone}">${E.total==null?"–":E.total}<small> ${esc(SCR_ZONE.asqse2[E.zone])}</small></span><span class="${M.zone}">${M.total==null?"–":M.total}<small> ${esc(SCR_ZONE.asqse2[M.zone])}</small></span></div>`
    :E.areas.map((a,i)=>{const b=M.areas[i];return `<div class="scrcmp"><span>${esc(a.name)}</span><span class="${a.zone}">${a.total==null?"–":esc(fmtPts(a.total))}<small> ${esc(SCR_ZONE.asq3[a.zone])}</small></span><span class="${b.zone}">${b.total==null?"–":esc(fmtPts(b.total))}<small> ${esc(SCR_ZONE.asq3[b.zone])}</small></span></div>`}).join("");
  const dl=dif.map(i=>{const e=(x.copies.educator.answers||{})[i.id],f=(x.copies.family.answers||{})[i.id];const ce=(x.copies.educator.concern||{})[i.id],cf=(x.copies.family.concern||{})[i.id];
    return `<details class="scrdiff"><summary><b>${esc(scrItemName(F,i.id))}</b> <span class="cnt">Educator ${esc(scrAnsLabel(F,e)||"no answer")}${ce?", concern":""}. Family ${esc(scrAnsLabel(F,f)||"no answer")}${cf?", concern":""}.</span></summary><div class="cnt">${esc(i.text)}</div></details>`}).join("");
  const fin=x.copies.final;
  return `<section class="card"><div class="lbl">Side by side</div>
    <div class="hint">Differences are a starting point for talking together. Children often show different skills and behaviors at home and at school, and there are no right or wrong answers. The family's answers are kept as the family marked them.</div>
    ${head}${rows}
    <div class="lbl" style="margin-top:10px">${dif.length?`Where the answers differ, ${dif.length} item${dif.length===1?"":"s"}`:"The answers are the same on every item."}</div>${dl}
    ${!se?`<div class="actions" style="margin-top:8px">${fin?`<button class="btn small ghost" data-scredit="final">${fin.done?"Look at the final screen":"Keep going on the final screen"}</button>`:`<button class="btn small ghost" data-scrfinal="1">Make one final screen together</button>`}</div>
      <div class="cnt">${fin?"":"The ASQ-3 questionnaires can be joined into one final screen. TREE fills in every item where the two agree, and the team and the family choose each item where they differ, together."}</div>`:`<div class="cnt">ASQ:SE-2 questionnaires are kept separate and never joined.</div>`}</section>`}
// the follow-up the team decides on, written on the summary of each questionnaire
function scrFollowHtml(x,F){const S=F.summary||{};const fo=x.follow||{};const on=new Set(fo.checks||[]);
  const clean=t=>{t=String(t||"").replace(/\s*_{2,}\s*/g," ___ ").replace(/\s+([.,])/g,"$1").replace(/\s*\(specify\s*$/i,"").replace(/[:.\s]+$/,"").trim();return t.charAt(0).toUpperCase()+t.slice(1)};
  const fac=F.tool==="asqse2"?(S.factors||[]):[];
  return `<section class="card"><div class="lbl">Follow-up</div><div class="hint">What the team decides together with the family, after looking at the results and the overall answers. It is written on each questionnaire's summary page.</div>
    ${fac.length?`<div class="lbl" style="margin-top:8px">Referral considerations</div><div class="hint">Mark each yes, no or unsure.</div>${fac.map((f,i)=>`<div class="scrfac"><span>${esc(clean(f.text))}</span><span class="seg" role="group">${["Y","N","U"].map(v=>`<button data-scrfac="${i}|${v}" aria-pressed="${(x.factors||{})[i]===v}">${{Y:"Yes",N:"No",U:"Unsure"}[v]}</button>`).join("")}</span></div>`).join("")}`:""}
    <div class="lbl" style="margin-top:8px">Follow-up action taken</div>
    ${(S.follow||[]).map((f,i)=>`<label class="radio"><input type="checkbox" data-scrfol="${i}" ${on.has(i)?"checked":""}><span>${esc(clean(f.text))}</span></label>${f.blank&&on.has(i)?`<input type="text" data-scrfolt="${i}" value="${esc((fo.text||{})[i]||"")}" placeholder="${/rescreen/i.test(f.text)?"How many months":"Write it here"}" style="margin:2px 0 6px 28px;width:calc(100% - 28px)">`:""}`).join("")}
    <label style="display:block;margin-top:8px"><span class="lbl">Notes for the team</span><textarea data-scrnotes="1" rows="3">${esc(x.notes||"")}</textarea></label></section>`}

/* ---------- completing one questionnaire, page by page ---------- */
function scrPagesOf(F){const ps=new Set([1]);F.items.forEach(i=>ps.add(i.page));(F.overall||[]).forEach(o=>ps.add(o.page));ps.add(F.summary.page);return [...ps].sort((a,b)=>a-b)}
function scrCopyHtml(x,k){const F=scrNeed(x);if(!F)return `<section class="card"><div class="cnt"><span class="spin"></span> Opening the questionnaire</div></section>`;
  const cp=x.copies[k];if(!cp){scrEdit="";return scrDetailHtml(x,children.get(x.child))}
  const pages=scrPagesOf(F);if(!pages.includes(scrPg))scrPg=pages[0];const at=pages.indexOf(scrPg);const s=scrScore(F,cp);const c=children.get(x.child)||{};
  const lock=cp.done;const se=F.tool==="asqse2";
  const items=F.items.filter(i=>i.page===scrPg),ovs=(F.overall||[]).filter(o=>o.page===scrPg);
  const dots=[];const P=(pt,cls)=>pt&&dots.push(`<i class="${cls}" style="left:${(pt[0]/F.size[0]*100).toFixed(2)}%;top:${(pt[1]/F.size[1]*100).toFixed(2)}%"></i>`);
  for(const i of items){const a=s.ans[i.id];if(a&&i.marks[a])P(i.marks[a],se?"chk":"dot");if((cp.concern||{})[i.id])P(i.concern,"chk")}
  for(const o of ovs){const a=((cp.overall||{})[o.n]||{}).a;if(a&&o.marks&&o.marks[a])P(o.marks[a],"dot")}
  let body="";
  if(scrPg===1)body=scrCoverHtml(x,k,cp,F,c,lock);
  if(items.length)body+=`<div class="scritems">${items.map(i=>scrItemHtml(F,cp,i,lock,x,k)).join("")}</div>`;
  if(ovs.length)body+=`<div class="lbl" style="margin-top:10px">Overall</div><div class="scritems">${ovs.map(o=>scrOverallHtml(F,cp,o,lock)).join("")}</div>`;
  if(scrPg===F.summary.page)body+=`<div class="lbl" style="margin-top:6px">Results</div>${scrResultHtml(F,s)}${lock?"":`<div class="actions" style="margin-top:10px"><button class="btn small" data-scrdone="${k}">Mark this questionnaire complete</button></div><div class="cnt">${s.answered<F.items.length?`${F.items.length-s.answered} item${F.items.length-s.answered===1?" is":"s are"} still unanswered. Ask whoever completed it about any left blank before marking it complete.`:"Every item is answered."}</div>`}`;
  const note=k==="family"?`<div class="hint">Enter the family's answers exactly as the family marked them on paper. Their answers are never changed.</div>`:k==="final"?`<div class="hint">Items where the educator and the family agree are filled in. Choose each one where they differ, together with the family.</div>`:"";
  return `<section class="card" data-keep="1"><div class="secthead"><h3 style="font-size:17px">${esc(SCR_COPY[k])}</h3><button class="linkbtn" data-scredit="">Back to the screening</button></div>
      <div class="cnt">${esc(scrFormName(F))} for ${esc(c.first||"")}. Page ${scrPg} of ${F.pages}.</div>${note}
      ${lock?`<div class="cnt">This questionnaire is complete. ${isDirector()||String(cp.doneBy||"").toLowerCase()===String(whoAmI()).toLowerCase()?`<button class="linkbtn" data-scrreopen="${k}">Open it to change</button>`:""}</div>`:""}
      <div class="tseg scrpgs" role="group" aria-label="Pages">${pages.map(p=>`<button data-scrpg="${p}" aria-pressed="${p===scrPg}">${p===1?"Cover":p===F.summary.page?"Summary":"Page "+p}</button>`).join("")}</div></section>
    <div class="scrwrap"><div class="scrpage loading"><img data-scrimg="${esc(x.form)}|${scrPg}" alt="Page ${scrPg} of the questionnaire">${dots.join("")}</div>
      <section class="card scrside">${body}
        <div class="actions" style="margin-top:12px">${at>0?`<button class="btn small ghost" data-scrpg="${pages[at-1]}">Previous page</button>`:""}${at<pages.length-1?`<button class="btn small" data-scrpg="${pages[at+1]}">Next page</button>`:""}</div></section></div>`}
function scrCoverHtml(x,k,cp,F,c,lock){const dis=lock?"disabled":"";
  return `<div class="lbl">Person filling out the questionnaire</div>
    <div class="kfields"><label>Name<input type="text" data-scrf="who" value="${esc(cp.who||"")}" ${dis} autocomplete="off"></label>
    <label>Relationship to ${esc(c.first||"the child")}<select data-scrf="rel" ${dis}>${SCR_REL.map(([v,l])=>`<option value="${v}" ${cp.rel===v?"selected":""}>${l}</option>`).join("")}</select></label>
    <label>Date completed<input type="date" data-scrf="date" value="${esc(cp.date||x.date||"")}" ${dis}></label></div>
    ${k==="family"?`<div class="cnt">${cp.enteredBy?"Entered by "+esc(cp.enteredBy)+".":"Your name is kept as the educator who entered it."}</div>`:""}
    <div class="cnt" style="margin-top:6px">${esc(c.first||"")} ${esc(c.last||"")}, born ${c.dob?esc(longDate(String(c.dob).slice(0,10))):"on a day not on the roster"}. These print on the cover and the summary.</div>`}
function scrItemHtml(F,cp,i,lock,x,k){const se=F.tool==="asqse2";const a=(cp.answers||{})[i.id]||"";const opts=se?SCR_SE:SCR_A3;
  let other="";if(k==="final"){const e=(x.copies.educator.answers||{})[i.id],f=(x.copies.family.answers||{})[i.id];if(e!==f)other=`<div class="cnt">Educator ${esc(scrAnsLabel(F,e)||"no answer")}. Family ${esc(scrAnsLabel(F,f)||"no answer")}.</div>`}
  const rule=(F.rules||[]).find(r=>r.then===i.id);const ruleOn=rule&&((cp.answers||{})[rule.if]==="y"||(cp.answers||{})[rule.if]==="s");
  const wr=se?(i.lines||[]).length>0:!!i.box;
  return `<div class="scritem${a?" done":""}"><div><b>${i.n}.</b> ${esc(i.text)}</div>${other}
    <div class="seg scrseg" role="group" aria-label="Answer for item ${i.n}">${Object.entries(opts).map(([v,l])=>`<button data-scra="${esc(i.id)}|${v}" aria-pressed="${a===v}" ${lock?"disabled":""}>${l}</button>`).join("")}</div>
    ${se?`<label class="radio"><input type="checkbox" data-scrc="${esc(i.id)}" ${(cp.concern||{})[i.id]?"checked":""} ${lock?"disabled":""}><span>This is a concern</span></label>`:""}
    ${ruleOn?`<div class="cnt">This counts as yes, because ${esc(scrItemName(F,rule.if))} is marked ${esc(SCR_A3[(cp.answers||{})[rule.if]].toLowerCase())}.</div>`:""}
    ${wr?`<textarea data-scrw="${esc(i.id)}" rows="2" placeholder="${se?"What was described":"The child's own words or an example"}" ${lock?"disabled":""}>${esc((cp.words||{})[i.id]||"")}</textarea>`:""}</div>`}
function scrOverallHtml(F,cp,o,lock){const v=(cp.overall||{})[o.n]||{};
  return `<div class="scritem${v.a||v.t?" done":""}"><div><b>${o.n}.</b> ${esc(o.text)}</div>
    ${o.marks?`<div class="seg scrseg" role="group">${["yes","no"].map(a=>`<button data-scro="${o.n}|${a}" aria-pressed="${v.a===a}" ${lock?"disabled":""}>${a==="yes"?"Yes":"No"}</button>`).join("")}</div>`:""}
    <textarea data-scrot="${o.n}" rows="2" placeholder="Explain, in their words" ${lock?"disabled":""}>${esc(v.t||"")}</textarea></div>`}

/* ---------- what a tap or a keystroke changes ---------- */
function scrCur(){const x=scrOpen&&screenings.get(scrOpen);return x||null}
function scrBlocked(){if(VIEW_AS){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return true}return false}
document.addEventListener("click",e=>{const t=e.target.closest("[data-scropen],[data-scrback],[data-scrstart],[data-scredit],[data-scrpg],[data-scra],[data-scro],[data-scrdone],[data-scrreopen],[data-scrfinal],[data-scrprint],[data-scrblank],[data-scrfac],[data-scrremove],[data-scroffer]");if(!t)return;const d=t.dataset;
  if(d.scroffer){const [cid,iq]=d.scroffer.split("|");scrOpen="";scrEdit="";scrStartInq=iq||"";window.TREE_OPEN_KID(cid,"screen");return}
  if(d.scropen){scrOpen=d.scropen;scrEdit="";renderMain();jumpTop();return}
  if(d.scrback){scrOpen="";scrEdit="";renderMain();jumpTop();return}
  if(d.scrstart){const [cid,tool]=d.scrstart.split("|");const c=children.get(cid);if(c)scrStart(c,tool,scrStartDate||iso(new Date()));return}
  const x=scrCur();if(!x)return;
  if(d.scredit!==undefined){scrEdit=d.scredit;scrPg=1;if(scrEdit==="family"&&!x.copies.family.enteredBy&&!scrBlocked()){x.copies.family.enteredBy=whoAmI();saveScreeningSoon(x)}renderMain();jumpTop();return}
  if(d.scrpg){scrPg=+d.scrpg;renderMain();jumpTop();return}
  if(d.scrprint){scrPrint(x,d.scrprint);return}
  if(d.scrblank){scrPrint(x,"blank");return}
  if(scrBlocked())return;
  const cp=x.copies[scrEdit];
  if(d.scra&&cp&&!cp.done){const [id,v]=d.scra.split("|");cp.answers=cp.answers||{};if(cp.answers[id]===v)delete cp.answers[id];else cp.answers[id]=v;saveScreeningSoon(x);const y=window.scrollY;renderMain();window.scrollTo(0,y);return}
  if(d.scro&&cp&&!cp.done){const [n,v]=d.scro.split("|");cp.overall=cp.overall||{};const o=cp.overall[n]=Object.assign({},cp.overall[n]);o.a=o.a===v?"":v;saveScreeningSoon(x);const y=window.scrollY;renderMain();window.scrollTo(0,y);return}
  if(d.scrdone&&cp){const F=SCR.lay.get(x.form);cp.done=true;cp.doneAt=Date.now();cp.doneBy=whoAmI();cp.result=scrScore(F,cp);saveScreening(x);scrEdit="";renderMain();jumpTop();toast("Complete. The results are kept with the screening.");return}
  if(d.scrreopen){const c2=x.copies[d.scrreopen];if(c2&&confirm("Open this questionnaire to change it? The results are scored again when it is marked complete.")){c2.done=false;saveScreening(x);renderMain()}return}
  if(d.scrfinal){const F=SCR.lay.get(x.form);if(!F||F.tool!=="asq3")return;const E=x.copies.educator,M=x.copies.family;const ans={};
    for(const i of F.items){const a=(E.answers||{})[i.id],b=(M.answers||{})[i.id];if(a&&a===b)ans[i.id]=a}
    x.copies.final=Object.assign(scrNewCopy("final"),{who:[E.who,M.who].filter(Boolean).join(" and "),rel:"",answers:ans,date:iso(new Date())});saveScreening(x);scrEdit="final";scrPg=1;renderMain();jumpTop();return}
  if(d.scrfac){const [i,v]=d.scrfac.split("|");x.factors=Object.assign({},x.factors);x.factors[i]=x.factors[i]===v?"":v;saveScreeningSoon(x);const y=window.scrollY;renderMain();window.scrollTo(0,y);return}
  if(d.scrremove){if(!isDirector())return;if(!confirm("Remove this screening and every answer in it? It stays in the records' history."))return;db.doc("screenings/"+x.id).delete().then(()=>{screenings.delete(x.id);scrOpen="";renderMain();toast("Removed.")}).catch(e=>toast(e&&e.message||"It could not be removed."));return}
});
document.addEventListener("input",e=>{const t=e.target;if(!t.dataset)return;const d=t.dataset;
  if(d.scrdate!==undefined){scrStartDate=t.value;clearTimeout(scrTimers.date);scrTimers.date=setTimeout(()=>{if(view==="child")renderMain()},500);return}
  if(!(d.scrf||d.scrw||d.scrot||d.scrnotes||d.scrfolt))return;const x=scrCur();if(!x||VIEW_AS)return;const cp=x.copies[scrEdit];
  if(d.scrf&&cp&&!cp.done){cp[d.scrf]=t.value;saveScreeningSoon(x);return}
  if(d.scrw&&cp&&!cp.done){cp.words=Object.assign({},cp.words,{[d.scrw]:t.value});saveScreeningSoon(x);return}
  if(d.scrot&&cp&&!cp.done){cp.overall=cp.overall||{};cp.overall[d.scrot]=Object.assign({},cp.overall[d.scrot],{t:t.value});saveScreeningSoon(x);return}
  if(d.scrnotes){x.notes=t.value;saveScreeningSoon(x);return}
  if(d.scrfolt){x.follow=Object.assign({checks:[],text:{}},x.follow);x.follow.text=Object.assign({},x.follow.text,{[d.scrfolt]:t.value});saveScreeningSoon(x);return}});
document.addEventListener("change",e=>{const t=e.target;if(!t.dataset)return;const d=t.dataset;if(!(d.scrc||d.scrfol!==undefined||d.scrf))return;const x=scrCur();if(!x)return;if(scrBlocked()){t.checked=!t.checked;return}
  const cp=x.copies[scrEdit];
  if(d.scrc&&cp&&!cp.done){cp.concern=Object.assign({},cp.concern);if(t.checked)cp.concern[d.scrc]=true;else delete cp.concern[d.scrc];saveScreeningSoon(x);const y=window.scrollY;renderMain();window.scrollTo(0,y);return}
  if(d.scrf&&cp&&!cp.done){cp[d.scrf]=t.value;saveScreeningSoon(x);return}
  if(d.scrfol!==undefined){x.follow=Object.assign({checks:[],text:{}},x.follow);const i=+d.scrfol;const s=new Set(x.follow.checks||[]);if(t.checked)s.add(i);else s.delete(i);x.follow.checks=[...s].sort((a,b)=>a-b);saveScreeningSoon(x);const y=window.scrollY;renderMain();window.scrollTo(0,y)}});

/* ---------- in a team inquiry, beside age and stage ---------- */
function scrInquiryHtml(x){const kids=(typeof inqChildren==="function"?inqChildren(x):[]).filter(c=>scrCan(c));if(!kids.length||kids.length>4)return "";
  return `<div class="lbl" style="margin-top:10px">A developmental screening</div><div class="hint">When the team wonders about development, the ASQ-3 or ASQ:SE-2 can help, completed by an educator and by the family.</div>
    ${kids.map(c=>{const l=scrOf(c);const last=l[0];return `<div class="pdir"><b>${esc(c.first||"")}</b> ${last?`<span class="cnt">Last screened ${esc(longDate(last.date))} with the ${esc(SCR_NAME[last.tool])}.</span>`:""}
      <div class="actions"><button class="btn small ghost" data-scroffer="${esc(c.id)}|${esc(x.id)}">${l.length?"See or offer a screening":"Offer a screening"}</button></div></div>`}).join("")}`}

/* ---------- printing the original form, filled in ---------- */
const scrSan=s=>String(s==null?"":s).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/[^\x20-\x7E\xA0-\xFF]/g,"");
const scrMdy=s=>{const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[2]}/${m[3]}/${m[1]}`:""};
/* The questionnaires are protected so they can be printed and not changed, so TREE prints each page as a sharp picture,
   the way a printer would, and writes the answers on top, as an educator would by pen. */
const scrJpg=new Map();
async function scrPageJpg(id,p){const k=id+"|"+p;if(scrJpg.has(k))return scrJpg.get(k);const lib=await TREE_KIT.pdfjs();let doc=SCR.doc.get(id);if(!doc){doc=await lib.getDocument({data:(await scrPdf(id)).slice()}).promise;SCR.doc.set(id,doc)}
  const b=await TREE_KIT.pageImage(doc,p,{width:1700,white:true,quality:.88});const u=new Uint8Array(await b.arrayBuffer());scrJpg.set(k,u);return u}
async function scrPrint(x,which){if(scrBusy)return;scrBusy=true;toast("Filling in the questionnaire…");
  try{if(!window.PDFLib)await TREE_KIT.pdfLib();const F=await scrLayout(x.form);const c=children.get(x.child)||{};
    const out=await PDFLib.PDFDocument.create();
    const keys=which==="all"?["educator","family","final"].filter(k=>x.copies[k]&&(x.copies[k].done||Object.keys(x.copies[k].answers||{}).length)):which==="blank"?["blank"]:[which];
    if(!keys.length){toast("Nothing is answered yet.");return}
    const jp=[];for(let n=1;n<=F.pages;n++)jp.push(await out.embedJpg(await scrPageJpg(x.form,n)));
    for(const k of keys){const pages=jp.map(j=>{const pg=out.addPage([F.size[0],F.size[1]]);pg.drawImage(j,{x:0,y:0,width:F.size[0],height:F.size[1]});return pg});await scrFill(out,pages,F,x,k==="blank"?null:x.copies[k],c)}
    if(which==="all"&&scrCopyDone(x.copies.educator)&&scrCopyDone(x.copies.family))await scrComparePage(out,F,x,c);
    const bytes=await out.save();const nm=`${SCR_NAME[F.tool]} ${F.months} month ${kidName(c)} ${x.date}${which==="blank"?" blank":which==="all"?"":" "+SCR_COPY[which].toLowerCase()}`;
    saveFile(new Blob([bytes],{type:"application/pdf"}),scrSan(nm).replace(/[:/]/g," ").replace(/\s+/g," ")+".pdf")}
  catch(e){toast((e&&e.message)||"The questionnaire could not be filled in.")}finally{scrBusy=false}}
async function scrFill(doc,pages,F,x,cp,c){const H=F.size[1];const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),bold=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);const ink=PDFLib.rgb(.05,.1,.35);
  const pg=n=>pages[n-1];
  const T=(n,pt,t,o)=>{t=scrSan(t);if(!pt||!t)return;o=o||{};let sz=o.size||9;const f=o.bold?bold:font;if(o.max)while(sz>5.5&&f.widthOfTextAtSize(t,sz)>o.max)sz-=.5;pg(n).drawText(t,{x:pt[0],y:H-pt[1],size:sz,font:f,color:ink})};
  const dot=(n,pt,r)=>pt&&pg(n).drawCircle({x:pt[0],y:H-pt[1],size:r||4.2,color:ink});
  const tick=(n,pt)=>{if(!pt)return;const [x0,y0]=pt;const p=pg(n);p.drawLine({start:{x:x0-3.2,y:H-y0},end:{x:x0-.8,y:H-y0-2.8},thickness:1.4,color:ink});p.drawLine({start:{x:x0-.8,y:H-y0-2.8},end:{x:x0+4,y:H-y0+4.2},thickness:1.4,color:ink})};
  const ring=(n,pt,w)=>pt&&pg(n).drawEllipse({x:pt[0],y:H-pt[1],xScale:w||10,yScale:6.5,borderColor:ink,borderWidth:1});
  const wrapIn=(n,box,t,sz)=>{t=scrSan(t);if(!box||!t)return;sz=sz||9;const w=box[2]-box[0]-14;const lines=[];let line="";for(const wd of t.split(/\s+/)){const tt=line?line+" "+wd:wd;if(font.widthOfTextAtSize(tt,sz)<=w)line=tt;else{if(line)lines.push(line);line=wd}}if(line)lines.push(line);
    const max=Math.max(1,Math.floor((box[3]-box[1]-8)/(sz+2)));lines.slice(0,max).forEach((l,i)=>pg(n).drawText(l,{x:box[0]+7,y:H-(box[1]+6+sz+i*(sz+2)),size:sz,font,color:ink}))};
  const onLines=(n,lns,t,sz)=>{t=scrSan(t);if(!lns||!lns.length||!t)return;sz=sz||9;let rest=t.split(/\s+/);for(const l of lns){const w=(l[2]||560)-l[0]-6;let line="";while(rest.length){const tt=line?line+" "+rest[0]:rest[0];if(font.widthOfTextAtSize(tt,sz)>w&&line)break;line=tt;rest.shift()}if(line)pg(n).drawText(line,{x:l[0],y:H-l[1],size:sz,font,color:ink});if(!rest.length)break}};
  const cv=F.cover||{};const S=F.summary||{};const prog="Fulton Community School";const full=[c.first,c.last].filter(Boolean).join(" ");const dob=scrMdy(c.dob);
  // the cover and the summary carry the child's name, birthday and our program, on a blank copy too
  T(1,cv.first,c.first);T(1,cv.last,c.last);T(1,cv.dob,dob);T(1,cv.program,prog);
  T(S.page,S.name,full);T(S.page,S.dob,dob);T(S.page,S.program,prog,{max:120});
  if(!cp)return;
  const s=scrScore(F,cp);const day=scrMdy(cp.date||x.date);
  T(1,cv.date,day);T(S.page,S.date,day);
  const who=String(cp.who||"").trim().split(/\s+/);if(who[0]){T(1,cv.pfirst,who.slice(0,-1).join(" ")||who[0]);if(who.length>1)T(1,cv.plast,who[who.length-1])}
  if(cp.rel&&cv.rel&&cv.rel[cp.rel])dot(1,cv.rel[cp.rel],F.tool==="asq3"?3.3:3.6);
  if(cv.age&&x.age)T(1,cv.age,scrAgeText(scrAge(c.dob,cp.date||x.date)||x.age));
  if(S.age&&x.age)T(S.page,S.age,scrAgeText(scrAge(c.dob,cp.date||x.date)||x.age));
  if(S.who)T(S.page,S.who,cp.who,{max:110});
  if(F.tool==="asq3"){
    for(const i of F.items){const a=s.ans[i.id];if(a&&i.marks[a])dot(i.page,i.marks[a]);if(a in A3PTS)T(i.page,i.score,String(A3PTS[a]),{size:9});if(i.box&&(cp.words||{})[i.id])wrapIn(i.page,i.box,cp.words[i.id])}
    for(const a of s.areas){const t=F.totals[a.key];if(t&&a.total!=null)T(t.page,t.at,fmtPts(a.total),{bold:true,size:9.5});const sa=S.areas[a.key];if(!sa)continue;
      if(a.total!=null){T(S.page,sa.total,fmtPts(a.total),{bold:true,size:8.5});const k=Math.max(0,Math.min(12,Math.round(a.total/5)));if(sa.dots[k])dot(S.page,sa.dots[k],4.4)}}
    for(const o of F.overall||[]){const v=(cp.overall||{})[o.n]||{};if(v.a&&o.marks)dot(o.page,o.marks[v.a]);if(v.t)wrapIn(o.page,o.box,v.t);const so=(S.overall||{})[o.n];if(so){if(v.a)ring(S.page,so[v.a],v.a==="yes"?9:8);if(v.t)T(S.page,so.comment,v.t,{size:7,max:180})}}
    for(const [ak,pts] of Object.entries(S.grid||{})){const its=F.items.filter(i=>i.area===ak).sort((p,q)=>p.n-q.n);its.forEach((i,j)=>{const a=s.ans[i.id];if(pts[j])T(S.page,[pts[j][0]-2.6,pts[j][1]-1],a?a.toUpperCase():"X",{size:7.5})})}
  }else{
    for(const i of F.items){const a=s.ans[i.id];if(a&&i.marks[a])tick(i.page,i.marks[a]);if((cp.concern||{})[i.id])tick(i.page,i.concern);const it=s.items.find(q=>q.id===i.id);if(it&&it.pts!=null)T(i.page,i.score,String(it.pts),{size:9});if((cp.words||{})[i.id])onLines(i.page,i.lines,cp.words[i.id])}
    (F.pageTotals||[]).forEach((p,j)=>{if(s.pages[j]!=null)T(p.page,p.at,String(s.pages[j]),{bold:true,size:9.5});if(S.pageTotals&&S.pageTotals[j])T(S.page,S.pageTotals[j],String(s.pages[j]),{size:8.5})});
    if(s.total!=null){T(S.page,S.total,String(s.total),{bold:true,size:9});T(S.page,S.totalCell,String(s.total),{bold:true,size:12});if(S.interp&&S.interp[s.zone])T(S.page,S.interp[s.zone],"X",{bold:true})}
    for(const o of F.overall||[]){const v=(cp.overall||{})[o.n]||{};if(v.a&&o.marks)dot(o.page,o.marks[v.a],3.6);if(v.t)onLines(o.page,o.lines,v.t);const so=(S.overall||{})[String(o.n)];if(so){if(v.a)ring(S.page,so[v.a],9);if(v.t)T(S.page,so.comment,v.t,{size:7,max:180})}}
    const sc=(S.overall||{}).scored;if(sc){ring(S.page,s.concerns?sc.yes:sc.no,9);if(s.concerns)T(S.page,sc.comment,"Concern marked on item"+(s.concerns===1?" ":"s ")+s.items.filter(i=>i.concern).map(i=>i.n).join(", "),{size:7,max:180})}
    (S.factors||[]).forEach((f,i)=>{const v=(x.factors||{})[i];if(v)T(S.page,f.at,v,{bold:true})});
  }
  const fo=x.follow||{};(fo.checks||[]).forEach(i=>{const f=(S.follow||[])[i];if(!f)return;T(S.page,f.at,"X",{bold:true});const t=(fo.text||{})[i];if(t&&f.blank)T(S.page,f.blank,t,{size:8,max:/rescreen/i.test(f.text)?22:300})});
}
// the side by side page, for the family meeting or a specialist
async function scrComparePage(out,F,x,c){const f=await out.embedFont(PDFLib.StandardFonts.Helvetica),b=await out.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const ink=PDFLib.rgb(.1,.13,.11),gray=PDFLib.rgb(.42,.44,.42),line=PDFLib.rgb(.8,.8,.78),tint={below:PDFLib.rgb(.93,.9,.9),close:PDFLib.rgb(.95,.94,.9),above:PDFLib.rgb(.94,.96,.94),unscored:PDFLib.rgb(.96,.96,.96)};
  const M=54,W=504;let p=out.addPage([612,792]),y=742;
  const tx=(t,x0,yy,sz,fo,col)=>p.drawText(scrSan(t),{x:x0,y:yy,size:sz,font:fo||f,color:col||ink});
  const wrap=(t,sz,w,fo)=>{const ls=[];let l="";for(const wd of scrSan(t).split(/\s+/).filter(Boolean)){const tt=l?l+" "+wd:wd;if((fo||f).widthOfTextAtSize(tt,sz)<=w)l=tt;else{if(l)ls.push(l);l=wd}}if(l)ls.push(l);return ls};
  const room=n=>{if(y-n<70){p=out.addPage([612,792]);y=742}};
  const E=x.copies.educator,Fm=x.copies.family,se=F.tool==="asqse2";const sE=scrScore(F,E),sF=scrScore(F,Fm);
  tx("Fulton Community School",M,y,10,b,gray);y-=22;tx(`${SCR_NAME[F.tool]} ${F.months} month questionnaire, side by side`,M,y,16,b);y-=20;
  tx(`${kidName(c)}, ${scrAgeText(x.age)} on ${longDate(x.date)}`,M,y,10.5);y-=26;
  const cols=[M,M+170,M+337];const who=(cp,k)=>`${k}, ${cp.who||"name not given"}${cp.date?", "+scrMdy(cp.date):""}`;
  tx(who(E,"Educator"),cols[1],y,8.5,f,gray);tx(who(Fm,"Family"),cols[2],y,8.5,f,gray);y-=14;
  const row=(label,a,bb,za,zb)=>{room(30);p.drawRectangle({x:cols[1]-6,y:y-10,width:160,height:24,color:tint[za]||tint.unscored});p.drawRectangle({x:cols[2]-6,y:y-10,width:160,height:24,color:tint[zb]||tint.unscored});
    tx(label,M,y,10.5,b);tx(a,cols[1],y+2,11,b);tx(bb,cols[2],y+2,11,b);tx(SCR_ZONE[F.tool][za]||"",cols[1],y-7,7.5,f,gray);tx(SCR_ZONE[F.tool][zb]||"",cols[2],y-7,7.5,f,gray);y-=30};
  if(se)row("Total score",sE.total==null?"-":String(sE.total),sF.total==null?"-":String(sF.total),sE.zone,sF.zone);
  else sE.areas.forEach((a,i)=>{const z=sF.areas[i];row(a.name,a.total==null?"-":fmtPts(a.total),z.total==null?"-":fmtPts(z.total),a.zone,z.zone)});
  y-=4;tx(se?`Cutoff ${F.cutoff}. Monitoring zone from ${F.monitor}. A higher ASQ:SE-2 score means more behaviors of concern.`:`Cutoffs ${F.areas.map(a=>AREA_SHORT[a.key].toLowerCase()+" "+a.cutoff).join(", ")}.`,M,y,8,f,gray);y-=12;
  if(se){tx("ASQ:SE-2 questionnaires are kept separate and never combined.",M,y,8,f,gray);y-=12}
  const fin=x.copies.final;if(!se&&fin&&fin.done){const sx=scrScore(F,fin);y-=8;tx("Final screen, agreed together",M,y,11,b);y-=16;tx(sx.areas.map(a=>`${AREA_SHORT[a.key]} ${a.total==null?"not scored":fmtPts(a.total)}`).join(",  "),M,y,9.5);y-=14}
  y-=12;const dif=scrDiffs(F,x);tx(dif.length?"Where the answers differ":"The answers are the same on every item",M,y,12,b);y-=8;
  p.drawLine({start:{x:M,y},end:{x:M+W,y},thickness:.6,color:line});y-=14;
  for(const i of dif){const e=(E.answers||{})[i.id],m=(Fm.answers||{})[i.id];const ls=wrap(i.text,8,W-8);const h=12+Math.min(3,ls.length)*10+12;room(h);
    tx(scrItemName(F,i.id),M,y,9.5,b);tx(`Educator ${scrAnsLabel(F,e)||"no answer"}${(E.concern||{})[i.id]?", concern":""}`,cols[1]+40,y,9);tx(`Family ${scrAnsLabel(F,m)||"no answer"}${(Fm.concern||{})[i.id]?", concern":""}`,cols[2]+20,y,9);y-=12;
    ls.slice(0,3).forEach((l,j)=>{tx(j===2&&ls.length>3?l.replace(/\s*\S+$/,"")+"...":l,M+8,y,8,f,gray);y-=10});y-=6}
  const ov=(F.overall||[]).filter(o=>{const a=((E.overall||{})[o.n]||{}).a,m=((Fm.overall||{})[o.n]||{}).a;return a!==m||((E.overall||{})[o.n]||{}).t||((Fm.overall||{})[o.n]||{}).t});
  if(ov.length){room(40);y-=6;tx("Overall questions",M,y,12,b);y-=8;p.drawLine({start:{x:M,y},end:{x:M+W,y},thickness:.6,color:line});y-=14;
    for(const o of ov){const e=(E.overall||{})[o.n]||{},m=(Fm.overall||{})[o.n]||{};const q=wrap(o.text,8.5,W);const et=wrap(e.t?"Educator. "+e.t:"",8,W-8),mt=wrap(m.t?"Family. "+m.t:"",8,W-8);room(14+q.length*10+(et.length+mt.length)*10+16);
      q.slice(0,2).forEach(l=>{tx(l,M,y,8.5,b);y-=10});tx(`Educator ${e.a?e.a==="yes"?"yes":"no":"no answer"}.  Family ${m.a?m.a==="yes"?"yes":"no":"no answer"}.`,M+8,y,8.5);y-=11;
      et.slice(0,3).concat(mt.slice(0,3)).forEach(l=>{tx(l,M+8,y,8,f,gray);y-=10});y-=6}}
  room(40);y-=8;wrap("Differences are a starting point for talking together. Children often show different skills and behaviors at home and at school. The family's answers are printed as the family marked them.",8.5,W).forEach(l=>{tx(l,M,y,8.5,f,gray);y-=11});
  p.drawText(scrSan("Results from the "+SCR_CITE[F.tool]),{x:M,y:40,size:7,font:f,color:gray})}
