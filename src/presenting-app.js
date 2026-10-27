/* ---------- Presenting in TREE ----------
   Every talk, PD session or module presented at our school or for other schools, one entry each, under Educators, PD and
   Licensing. The director starts an entry and adds presenters, who see and work on it from their own Presenting page.
   The server sends an entry to no other educator until it is presented, and then only what is safe for all staff. It
   sits after the growth pages in tree-staff.js, loaded only when opened, and shares their helpers. */
(function(){
"use strict";
const T=window.TreeStaff,X=T._;const Pr={};window.TreePres=Pr;
const {api,fail,H,card,chip,head,report,out,fd,fms,today,meName,D}=X;
const pa=(p,b)=>api("pres/"+p,b||{});
const st={list:null,sel:"",e:null,ev:null,evFor:"",evGroup:"",pickQ:"",pickLens:"",help:null,helping:false};
Pr.st=st;
const dur=n=>!n?"":n===90?"an hour and a half":n===60?"an hour":n%60===0?(n/60)+" hours":n>60?Math.floor(n/60)+" hours and "+(n%60)+" minutes":n+" minutes";
const clip=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n).replace(/\s+\S*$/,"")+"…":s};
// the same, keeping the lines as they were written
const clipL=(s,n)=>{s=String(s||"").trim();return s.length>n?s.slice(0,n).replace(/\s+\S*$/,"")+"…":s};
const E=()=>st.e||{};
const edit=()=>!!E().edit&&!VIEW_AS;
const NM={first:"First names",full:"First name and last initial",initials:"Initials",none:"No names"};

/* ---------- looks ---------- */
if(!document.getElementById("prescss")){const c=document.createElement("style");c.id="prescss";c.textContent=`
.prmom{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border-top:1px solid var(--line);padding:10px 0}.prmom:first-child{border-top:0}
.prmom img{width:84px;height:84px;object-fit:cover;border-radius:8px;display:block}.prmom.nophoto{grid-template-columns:1fr}
.prdrag{touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;border:1px solid var(--line);border-radius:8px;padding:6px 10px;background:var(--paper);font-size:13px;color:var(--muted)}
.prmom.dragging{opacity:.55;background:var(--sun-wash)}
.prwhy{border-left:3px solid var(--marigold);padding-left:10px;font-size:14px;line-height:1.45}
.prsec{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--paper);display:grid;gap:6px;margin-top:8px}
@media (max-width:640px){.prmom img{width:64px;height:64px}}
`;document.head.appendChild(c)}
// each part of an entry folds into a closed dropdown, the same way long pages fold elsewhere in TREE
const fold=(k,title,side,body)=>{const id="pres:"+k;return `<details class="card fold" data-fold="${id}" ${foldOpen.has(id)?"open":""}><summary class="foldhead"><span class="lbl" style="margin:0">${H(title)}</span><span class="cnt">${side||""}</span></summary><div class="foldbody">${body}</div></details>`};
const empty=t=>`<div class="cnt">${t}</div>`;
// a photo from the observation itself where the page has it, and otherwise from the copy the record keeps
function picOf(x,full){const id=String(x.from||"").startsWith("obs:")?x.from.slice(4):x.kind==="obs"?x.id:"";const n=id&&typeof notices!=="undefined"?notices.get(id):null;
  if(n&&n.photo)return full?photoSrc(n):photoThumb(n);if(x.photo&&window.FP_ORIGINAL_URL)return window.FP_ORIGINAL_URL(full?x.photo.id:(x.photo.thumb||x.photo.id));return ""}
const where=x=>[x.date?fd(x.date):"",x.room?(/,/.test(x.room)?x.room+" Classes":x.room+" Class"):"",x.language||""].filter(Boolean).join(", ");

/* ---------- pages ---------- */
Pr.render=async function(my){if(VIEW_AS){X.draw(my,head("Presenting","Presenting")+card("Presenting",empty("Presenting shows only in your own view.")));return}
  if(st.sel){try{await loadEntry(st.sel)}catch(e){st.sel="";st.e=null}}
  return st.sel&&st.e?entryPage(my):listPage(my)};
Pr.open=id=>{st.sel=id;st.e=null;st.ev=null;st.help=null};
async function loadEntry(id){st.e=await pa("get",{id});return st.e}
async function listPage(my){const r=await pa("list");st.list=r.list;const dir=D();
  const row=x=>`<div class="prow"><span><b>${H(x.title)}</b>${x.subtitle?`<div class="cnt">${H(x.subtitle)}</div>`:""}<div class="cnt">${H([x.audience||"Audience not yet set",PR_AUD[x.audienceType]||"audience type not yet set",PR_MODE[x.mode]||"",x.date?fd(x.date):"",dur(x.minutes)].filter(Boolean).join(", "))}${x.presenters.length?`. Presented by ${H(kList(x.presenters))}`:""}</div></span>
    <span class="actions" style="margin:0">${x.status==="presented"?chip("ok","Presented "+fd(x.presentedOn)):""}<button class="btn small ghost" data-prsel="${H(x.id)}">${x.edit?"Open":"Read"}</button></span></div>`;
  // the list filters and sorts by internal, external or both
  const aud=st.aud||"";const fit=x=>!aud||(aud==="unset"?!x.audienceType:x.audienceType===aud);const AO={internal:0,external:1,both:2};
  const sorted=st.audSort?r.list.slice().sort((a,b)=>(AO[a.audienceType]??3)-(AO[b.audienceType]??3)):r.list;
  const filt=`<div class="chips" role="group" aria-label="Audience type">${[["","All"],["internal","Internal"],["external","External"],["both","Both"],["unset","Not yet set"]].map(([k,l])=>`<button class="chip ${aud===k?"on":""}" type="button" data-praud="${k}" aria-pressed="${aud===k}">${l}</button>`).join("")}<button class="chip ${st.audSort?"on":""}" type="button" data-praudsort="1" aria-pressed="${!!st.audSort}">Sort by audience type</button></div>`;
  const now=sorted.filter(x=>x.status!=="presented"&&fit(x)),done=sorted.filter(x=>x.status==="presented"&&fit(x));
  X.draw(my,head("PD and Licensing","Presenting",dir?"Every talk, PD session or module presented at our school or for other schools, each its own entry. Add educators as presenters and they work on the entry with you. Other educators see an entry once it is presented.":"The talks and PD sessions you present, and the ones we have presented. You see an entry when you are one of its presenters, and every entry once it is presented.")+
    filt+card("Being planned",now.length?now.map(row).join(""):empty(dir?"Start an entry below for a talk, a PD session or a module.":"An entry shows here when the director adds you as a presenter."))+
    card("Presented",done.length?done.map(row).join(""):empty("Entries move here once they are presented."))+
    (dir?card("Start an entry",`<div class="kfields"><label style="grid-column:span 2">Title<input type="text" id="prn-title" placeholder="The talk or session's title"></label></div><div class="actions"><button class="btn small" data-prnew="1">Start the entry</button><button class="btn small ghost" data-prnew="template">Start from our PD template</button></div>`):""))}

async function entryPage(my){const e=E(),dir=D(),ed=edit();
  if(ed&&foldOpen.has("pres:evidence")&&st.evFor!==e.id){try{st.ev=await pa("evidence",{id:e.id});st.evFor=e.id}catch(er){st.ev=null}}
  const back=`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-prsel="">‹ Presenting</button>${e.status==="presented"?chip("ok","Presented "+fd(e.presentedOn)):chip("soonish","Being planned")}</div>`;
  // an entry made from a PD module carries that module's original materials, for the director and the presenters
  let origs=[];if(ed&&e.module){try{const r=await fetch(window.FP_SERVER+"/api/staff/pd/originals",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({slug:e.module})});if(r.ok)origs=(await r.json()).list||[]}catch(er){}}
  const origFold=origs.length?fold("originals","Original materials",origs.length+(origs.length===1?" file":" files"),`<div class="hint">The original decks, guides, agendas and handouts from the module this entry was made from. Each opens in its own program to present or print.</div>${origs.map(x=>`<div class="prow"><span>${H(x.title)}</span><button class="btn small ghost" data-gmorig="${H(e.module)}|${H(x.id)}">Download</button></div>`).join("")}`):"";
  const h=head("Presenting",e.title||"Presenting",H(e.subtitle||""))+back+(dir?`<div class="actions" style="margin:0 0 10px"><button class="btn small ghost" data-pageedit="staff/presenting/${H(e.id)}.json">Edit the wording, with its history</button></div>`:"")+aboutCard(e)+creditCard(e)+
    (ed?notesFold(e)+meetingsFold(e)+evidenceFold(e):"")+chosenFold(e)+origFold+readingsFold(e)+planFold(e)+followFold(e)+(ed?printsFold(e):"")+(dir?doneCard(e):"");
  X.draw(my,h)}

/* the entry's own details, which every reader sees. The day reads with its times, such as Saturday, May 22, 2027,
   9:00 am to 12:00 pm, and a day still to be settled says so. */
// how an entry is offered, and who it is for
const PR_MODE={inperson:"In person",virtual:"Virtual",both:"In person and virtual"};
const PR_AUD={internal:"Internal, our own staff",external:"External, other schools and groups",both:"Internal and external"};
const prAudLine=e=>[e.audience?"For "+e.audience:"Audience not yet set",PR_AUD[e.audienceType]||"Audience type not yet set"].join(". ");
const prWhen=e=>e.date?[fd(e.date)+(e.start?", "+clockTime(e.start)+(e.end?" to "+clockTime(e.end):""):""),e.dateNote||""].filter(Boolean).join(". "):"";
function aboutCard(e){const ed=edit(),dir=D();
  const ag=(e.agendas||[]).map(a=>`${a.kind==="meeting"?"PD staff meeting":"PD day"}, ${fd(a.date)}${a.title?", "+a.title:""}`);
  const agLine=ag.length?`<div class="cnt" style="margin-top:6px">On the agenda of ${H(kList(ag))}. ${typeof staffSubOk==="function"&&staffSubOk("stpdd")?(e.agendas||[]).map(a=>`<button class="linkbtn" data-pragenda="${H(a.date)}">Open the agenda for ${H(fd(a.date))}</button>`).join(" "):""}</div>`:`<div class="cnt" style="margin-top:6px">No PD day or staff meeting agenda uses this entry yet.${dir?" A block on any agenda can open it.":""}</div>`;
  if(!ed)return card("About this entry",`${e.question?`<div class="prwhy"><b>Guiding question.</b> ${H(e.question)}</div>`:""}<div class="cnt" style="margin-top:6px">${H([prAudLine(e),PR_MODE[e.mode]||"",prWhen(e),e.place?"At "+e.place:"",dur(e.minutes),e.format].filter(Boolean).join(". "))}</div>${(e.presenters||[]).length?`<div class="cnt">Presented by ${H(kList(e.presenters))}</div>`:""}${agLine}`);
  const f=(k,l,ph,span)=>`<label${span?' style="grid-column:span 2"':""}>${l}<input type="text" data-prf="${k}" value="${H(e[k]||"")}" placeholder="${H(ph||"")}"></label>`;
  const pres=dir?`<div class="chiprow-label" style="margin-top:10px">Presenters</div><div class="chips">${[...new Set([...(e.choices||[]),...(e.presenters||[])])].map(n=>`<button class="chip ${(e.presenters||[]).includes(n)?"on":""}" type="button" data-prpres="${H(n)}" aria-pressed="${(e.presenters||[]).includes(n)}">${H(n)}</button>`).join("")||`<span class="cnt">No educator to add yet.</span>`}</div><div class="cnt">Each presenter sees this entry and works on it from their own Presenting page.</div>`
    :`<div class="cnt" style="margin-top:8px">${(e.presenters||[]).length?"Presented by "+H(kList(e.presenters))+".":""} The director chooses the presenters.</div>`;
  return card("About this entry",`<div class="kfields">${f("title","Title","",1)}${f("subtitle","Subtitle","",1)}</div>
    <label class="fld-label">Guiding question<input type="text" data-prf="question" value="${H(e.question||"")}" placeholder="The question the session follows"></label>
    <div class="kfields">${f("audience","Audience","Who it is for",1)}<label>Date<input type="date" data-prf="date" value="${H(e.date||"")}"></label><label>Length, in minutes<input type="number" min="0" step="15" data-prf="minutes" value="${H(e.minutes||"")}"></label>
      <label>Starts<input type="time" data-prf="start" value="${H(e.start||"")}"></label><label>Ends<input type="time" data-prf="end" value="${H(e.end||"")}"></label>${f("place","Place","Where it is held",1)}${f("dateNote","About the date","Such as to be confirmed with the host",1)}</div>
    ${dir?`<div class="kfields"><label>Audience type<select data-prf="audienceType"><option value="">Not yet set</option>${Object.entries(PR_AUD).map(([v,t])=>`<option value="${v}" ${e.audienceType===v?"selected":""}>${t}</option>`).join("")}</select></label><label>In person or virtual<select data-prf="mode"><option value="">Not yet set</option>${Object.entries(PR_MODE).map(([v,t])=>`<option value="${v}" ${e.mode===v?"selected":""}>${t}</option>`).join("")}</select></label></div>`:`<div class="cnt">${H([PR_AUD[e.audienceType]||"Audience type not yet set",PR_MODE[e.mode]||"",dur(e.minutes)].filter(Boolean).join(". "))}. The director sets these and the length.</div>`}
    <label class="fld-label">How it is offered<input type="text" data-prf="format" value="${H(e.format||"")}" placeholder="Such as a facilitated session with a self-paced follow-up"></label>
    <div class="cnt" id="pr-saved">${e.minutes?H(dur(e.minutes))+". ":""}Changes save as you go.</div>${pres}${agLine}`)}

/* the presenter's own credit, once the entry is presented */
function creditCard(e){if(!e.mine||e.status!=="presented")return "";const hrs=Math.round((+e.minutes||0)/6)/10;const growth=!!(X.boot().can&&X.boot().can.growth);
  const m=e.mine.moment;
  return card("You led this",`<div class="cnt">${hrs?`${H(hrs)} hours are on your records page as our PD hours.`:"Add the length to log the hours."} It is listed on your growth page, under What I led.</div>
    ${m==="shared"?`<div class="cnt" style="margin-top:6px">Shared as a Proud Moment.</div>`:growth?`<div class="actions"><button class="btn small" data-prmoment="1">Share it as a Proud Moment</button>${m==="no"?`<span class="cnt">You chose not now.</span>`:`<button class="linkbtn" data-prmomentno="1">Not now</button>`}</div><div class="cnt">You choose who sees it, as with every Proud Moment.</div>`:""}`)}

/* the director's marks: presented, copied, removed */
function doneCard(e){const cr=Object.keys(e.credit||{}).length;
  if(e.status!=="presented")return card("When it is presented",`<div class="cnt">Marking it presented logs the time as our PD hours on each presenter's records page, lists it on their growth page, and offers them to share it as a Proud Moment. Other educators can then read it.</div>
    <div class="actions"><button class="btn small" data-prdone="1">Mark as presented</button><button class="linkbtn" data-prrm="1">Remove this entry</button></div>`);
  return card("Presented",`<div class="cnt">Presented ${H(fd(e.presentedOn))}.${cr?` Hours logged for ${H(kList(e.presenters||[]))}.`:""}</div>
    <div class="kfields" style="margin-top:8px"><label style="grid-column:span 2">Title for the new entry<input type="text" id="prc-title" value="${H(e.title)}"></label></div>
    <div class="actions"><button class="btn small" data-prcopy="1">Copy to start a new entry</button><button class="linkbtn" data-prundo="1">Mark as not presented</button></div>
    <div class="cnt">A copy keeps the plan, the chosen moments, readings and files, and the follow-up, with a new date and presenters.</div>`)}

/* ideas and notes */
function notesFold(e){const L=[...(e.notes||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.at||0)-(a.at||0));
  return fold("notes","Ideas and notes",L.length?L.length+(L.length===1?" note":" notes"):"",(L.length?L.map(n=>`<div class="strow"><div class="sttop"><b>${H(fd(n.date))}</b><span class="cnt">${H(n.by||"")}</span></div><div style="white-space:pre-line">${H(n.text)}</div><div><button class="linkbtn" data-prrmi="notes|${H(n.id)}">Take it out</button></div></div>`).join("")
    :empty("Quick dated notes, ideas as they come, added any time."))+
    `<label class="fld-label" style="margin-top:8px">A note<textarea rows="2" id="prn-note"></textarea></label><div class="actions"><input type="date" id="prn-date" value="${H(today())}" aria-label="Date"><button class="btn small" data-pradd="notes">Add the note</button></div>`)}

/* meetings */
function meetingsFold(e){const L=e.meetings||[];
  const m=x=>`<div class="prsec"><div class="kfields"><label>Date<input type="date" data-pri="meetings|${H(x.id)}|date" value="${H(x.date||"")}"></label></div>
    <label class="fld-label">What we brought<textarea rows="2" data-pri="meetings|${H(x.id)}|fulton">${H(x.fulton||"")}</textarea></label>
    <label class="fld-label">What others brought<textarea rows="2" data-pri="meetings|${H(x.id)}|others">${H(x.others||"")}</textarea></label>
    <label class="fld-label">Questions carried forward<textarea rows="2" data-pri="meetings|${H(x.id)}|questions">${H(x.questions||"")}</textarea></label>
    <div><button class="linkbtn" data-prrmi="meetings|${H(x.id)}">Take it out</button></div></div>`;
  return fold("meetings","Meetings",L.length?L.length+(L.length===1?" meeting":" meetings"):"",(e.meetingsNote?`<div class="hint">${H(e.meetingsNote)}</div>`:"")+(L.length?L.map(m).join(""):empty("One entry for each planning or group meeting, with the date, what we brought, what others brought, and the questions carried forward."))+
    `<div class="actions"><button class="btn small ghost" data-pradd="meetings">Add a meeting</button><span class="cnt">Each meeting saves as you type and leave a box.</span></div>`)}

/* evidence, read by the server from Fulton's own records */
function evidenceFold(e){const v=st.evFor===e.id?st.ev:null;const dir=D();
  if(!v)return fold("evidence","Evidence","",empty("TREE reads our observations, plans, threads, projects, lenses and team inquiries for moments that fit this entry's topic and guiding question. Open this to read them."));
  const look=v.look||[];const items=v.items||[];const g=st.evGroup;
  const shown=items.filter(x=>x.state!=="aside"&&(!g||x.groups.includes(g))),aside=items.filter(x=>x.state==="aside");
  const groups=[...look.map(l=>[l.k,l.label]),...(v.youngest?[["youngest","With our youngest children"]]:[])];
  const it=x=>{const src=picOf(x);return `<div class="prmom ${src?"":"nophoto"}">${src?`<img src="${H(src)}" alt="" loading="lazy">`:""}<div style="min-width:0;display:grid;gap:4px">
    <div class="cnt"><b>${H(x.label)}</b>${x.by?", "+H(x.by):""}${where(x)?". "+H(where(x)):""}</div><div style="white-space:pre-line">${H(clipL(x.text,420))}</div>${x.wonder?`<div class="cnt">${H(clip(x.wonder,200))}</div>`:""}
    <div class="prwhy">${H(x.why)}${x.lens?" "+H(x.lens):""}</div>
    <div class="actions" style="margin:0">${x.state==="kept"?`${chip("ok","Kept, in Chosen moments")}<button class="linkbtn" data-prkeep="${H(x.key)}|">Undo</button>`:x.state==="aside"?`${chip("missing","Set aside")}<button class="linkbtn" data-prkeep="${H(x.key)}|">Bring it back</button>`:`<button class="btn small" data-prkeep="${H(x.key)}|1">Keep</button><button class="btn small ghost" data-prkeep="${H(x.key)}|0">Set aside</button>`}</div></div></div>`};
  const lookHtml=`<details style="margin-top:6px"><summary class="cnt" style="cursor:pointer">What TREE looks for</summary><div style="display:grid;gap:8px;margin-top:6px">
    ${look.map((l,i)=>dir?`<div class="prsec"><label class="fld-label">Name<input type="text" data-prlook="${i}|label" value="${H(l.label)}"></label><label class="fld-label">Words, separated by commas<textarea rows="2" data-prlook="${i}|words">${H((l.words||[]).join(", "))}</textarea></label><label class="fld-label">Only together with one of these words, if any<input type="text" data-prlook="${i}|with" value="${H((l.with||[]).join(", "))}"></label></div>`:`<div class="cnt"><b>${H(l.label)}.</b> ${H((l.words||[]).join(", "))}${(l.with||[]).length?". Together with "+H(l.with.join(", ")):""}</div>`).join("")||empty("No words yet. TREE reads the title, subtitle and guiding question.")}
    ${dir?`<div class="prsec"><label class="fld-label">Another group of words, separated by commas<textarea rows="2" data-prlook="${look.length}|words"></textarea></label><label class="fld-label">Its name<input type="text" data-prlook="${look.length}|label"></label></div>
      <label class="radio"><input type="checkbox" id="pr-young" ${v.youngest?"checked":""}><span>Moments with our youngest children, under three${v.youngClass?", and in "+H(v.youngClass)+" Class":""}</span></label>
      <label class="fld-label">A lens to read through<select id="pr-lens"><option value="">None</option>${(v.lenses||[]).map(n=>`<option ${n===v.lens?"selected":""}>${H(n)}</option>`).join("")}</select></label>
      <div class="actions"><button class="btn small ghost" data-prlooksave="1">Save what TREE looks for</button></div>`:`<div class="cnt">${v.youngest?"Also moments with our youngest children, under three. ":""}${v.lens?"Read through the lens "+H(v.lens)+".":""}</div>`}</div></details>`;
  return fold("evidence","Evidence",shown.length?shown.length+" moments":"",`<div class="hint">From our own records only. Each moment shows the educators' words, the date, the Class and a line on why it fits, quoting the record. Keep one and it joins Chosen moments.</div>${lookHtml}
    ${groups.length>1?`<div class="actions" style="margin:6px 0 0;flex-wrap:wrap"><button class="pill" aria-pressed="${!g}" data-prevg="">All</button>${groups.map(([k,l])=>`<button class="pill" aria-pressed="${g===k}" data-prevg="${H(k)}">${H(l)}</button>`).join("")}</div>`:""}
    <div style="margin-top:6px">${shown.length?shown.map(it).join(""):empty("Nothing in our records fits yet. Moments that fit show here as they are kept in TREE.")}</div>${v.more?`<div class="cnt">${v.more} more fit less closely.</div>`:""}
    ${aside.length?`<details style="margin-top:8px"><summary class="cnt" style="cursor:pointer">Set aside, ${aside.length}</summary>${aside.map(it).join("")}</details>`:""}`)}

/* chosen moments, in an order the director can drag, or move with a tap */
function chosenFold(e){const ed=edit();const L=e.chosen||[];
  const m=(x,i)=>{const src=picOf(x);return `<div class="prmom ${src?"":"nophoto"}" data-prchosen="${H(x.id)}">${src?`<img src="${H(src)}" alt="" loading="lazy">`:""}<div style="min-width:0;display:grid;gap:4px">
    <div class="cnt"><b>${i+1}.</b> ${H(where(x)||x.label||"")}${x.by?", "+H(x.by):""}</div><div style="white-space:pre-line">${H(clipL(x.text,600))}</div>${x.wonder?`<div class="cnt">${H(clip(x.wonder,240))}</div>`:""}
    ${ed?`<div class="actions" style="margin:0;flex-wrap:wrap"><span class="prdrag" data-prdrag="${H(x.id)}" aria-hidden="true">Drag</span><button class="linkbtn" data-prmv="chosen|${H(x.id)}|-1" ${i===0?"disabled":""}>Move up</button><button class="linkbtn" data-prmv="chosen|${H(x.id)}|1" ${i===L.length-1?"disabled":""}>Move down</button>
      ${D()?`<label class="radio cnt"><input type="checkbox" data-proutside="${H(x.id)}" ${x.outside?"checked":""}><span>Cleared for outside audiences</span></label>`:x.outside?`<span class="cnt">Cleared for outside audiences</span>`:""}
      <label class="cnt">Language <select data-prlang="${H(x.id)}"><option value="">Not named</option>${[...new Set([...LANGUAGES,...(x.language?[x.language]:[])])].map(l=>`<option ${l===x.language?"selected":""}>${H(l)}</option>`).join("")}</select></label><button class="linkbtn" data-prrmi="chosen|${H(x.id)}">Take it out</button></div>`:""}</div></div>`};
  return fold("chosen","Chosen moments",L.length?L.length+(L.length===1?" moment":" moments"):"",`<div data-prlist="chosen">${L.length?L.map(m).join(""):empty("Photos and educators' words chosen from Evidence, a lens or any observation, each with its date, Class and language."+(ed?" Drag them, or move them up and down, into the order you want.":""))}</div>${ed?pickHtml(e):""}`)}
// any observation, or the ones a lens finds, can be chosen
function pickHtml(e){const q=st.pickQ.trim().toLowerCase(),lens=(typeof LENSES!=="undefined"?LENSES:[]).find(l=>l.id===st.pickLens);
  let hits=[];if(q||lens){const re=lens?lensRegex(lens):null;const have=new Set((e.chosen||[]).map(x=>x.from));const grp=new Set();
    hits=[...notices.values()].filter(n=>n&&!n.deleted&&!have.has("obs:"+n.id)).sort((a,b)=>(b.at||0)-(a.at||0)).filter(n=>{const t=[n.noticed,n.wonder].join(" ");if(q&&!t.toLowerCase().includes(q))return false;if(lens){if(re){re.lastIndex=0;if(re.test(t))return true}return (n.languages||[]).some(x=>lens.languages.includes(x))}return true}).filter(n=>!n.group||(grp.has(n.group)?false:(grp.add(n.group),true))).slice(0,12)}
  return `<details style="margin-top:10px" ${q||lens?"open":""}><summary class="cnt" style="cursor:pointer">Choose from a lens or any observation</summary><div style="display:grid;gap:6px;margin-top:6px">
    <div class="actions" style="margin:0"><input type="search" id="prp-q" value="${H(st.pickQ)}" placeholder="Words in the observation" style="flex:1 1 180px"><button class="btn small ghost" data-prfind="1">Find</button></div>
    ${(typeof LENSES!=="undefined"?LENSES:[]).length?`<div class="actions" style="margin:0;flex-wrap:wrap">${LENSES.map(l=>`<button class="pill" aria-pressed="${st.pickLens===l.id}" data-prlens="${H(l.id)}">Through ${H(l.name)}</button>`).join("")}</div>`:""}
    ${hits.map(n=>`<div class="prmom ${n.photo?"":"nophoto"}">${n.photo?`<img src="${H(photoThumb(n))}" alt="" loading="lazy">`:""}<div style="min-width:0"><div class="cnt">${H([fd(iso(new Date(n.at||0))),n.classroom?n.classroom+" Class":"",n.by].filter(Boolean).join(", "))}</div><div>${H(clip(n.noticed,220))}</div><button class="btn small ghost" data-prchoose="${H(n.id)}">Choose</button></div></div>`).join("")||(q||lens?empty("No observation found. Try other words."):"")}</div></details>`}

/* readings and files */
const KIND={library:"From the library",link:"A link",drive:"From Google Drive",licensing:"Licensing reference"};
function readingsFold(e){const ed=edit();const L=e.readings||[];const lib=e.library||[];
  const r=x=>`<div class="strow"><div class="sttop"><b>${x.url?treeReadLink(x.url,x.title):H(x.title)}</b><span class="cnt">${H(KIND[x.kind]||"")}</span></div>${x.source&&x.kind!=="drive"?`<div class="cnt">${H(x.source)}</div>`:""}${x.note?`<div class="cnt" style="white-space:pre-line">${H(x.note)}</div>`:""}${ed?`<div><button class="linkbtn" data-prrmi="readings|${H(x.id)}">Take it out</button></div>`:""}</div>`;
  return fold("readings","Readings and files",L.length?L.length+(L.length===1?" piece":" pieces"):"",(L.length?L.map(r).join(""):empty("Readings from the shared library, a link with a short note, or a file from the director's Google Drive, such as a past facilitator guide or slide deck. Licensing references come only from CCLD or CDSS."))+
    (ed?`<details style="margin-top:8px"><summary class="cnt" style="cursor:pointer">From the library</summary><div class="kfields" style="margin-top:6px"><label style="grid-column:span 2">Reading<select id="prr-lib"><option value="">Choose</option>${lib.filter(x=>!L.some(y=>y.ref===x.id)).map(x=>`<option value="${H(x.id)}">${H(x.title)}${x.source?", "+H(x.source):""}</option>`).join("")}</select></label></div><label class="fld-label">A short note<input type="text" id="prr-libnote"></label><div class="actions"><button class="btn small ghost" data-pradd="library">Add it</button></div></details>
    <details style="margin-top:6px"><summary class="cnt" style="cursor:pointer">A link with a short note</summary><div class="kfields" style="margin-top:6px"><label>Link<input type="url" id="prr-url" placeholder="https://"></label><label>Title<input type="text" id="prr-title"></label></div><label class="fld-label">A short note<input type="text" id="prr-note"></label><label class="radio"><input type="checkbox" id="prr-lic"><span>A licensing reference, from CCLD or CDSS only</span></label><div class="actions"><button class="btn small ghost" data-pradd="link">Add it</button></div></details>
    <details style="margin-top:6px"><summary class="cnt" style="cursor:pointer">A file from Google Drive</summary><div class="hint" style="margin-top:6px">Use a file kept in the tree@childfamilycommunity.com Drive, never a personal Drive. Open it there, choose Share, then Copy link, and paste it here.</div><div class="kfields"><label>Drive link<input type="url" id="prd-url" placeholder="https://drive.google.com/"></label><label>Title<input type="text" id="prd-title" placeholder="Such as the facilitator guide from last year"></label></div><label class="fld-label">A short note<input type="text" id="prd-note"></label><div class="actions"><button class="btn small ghost" data-pradd="drive">Add it</button></div></details>`:""))}

/* the plan, in sections */
function planFold(e){const ed=edit();const L=e.plan||[];const C=e.chosen||[],R=e.readings||[];const tot=L.reduce((a,s)=>a+(+s.minutes||0),0);
  const uses=s=>[...(s.moments||[]).map(id=>C.findIndex(x=>x.id===id)).filter(i=>i>=0).map(i=>"Moment "+(i+1)),...(s.readings||[]).map(id=>(R.find(x=>x.id===id)||{}).title).filter(Boolean)];
  const sec=(s,i)=>ed?`<div class="prsec"><div class="kfields"><label style="grid-column:span 2">Section<input type="text" data-prpl="${H(s.id)}|title" value="${H(s.title||"")}"></label><label>Minutes<input type="number" min="0" step="5" data-prpl="${H(s.id)}|minutes" value="${H(s.minutes||"")}"></label></div>
      <label class="fld-label">What participants do<textarea rows="3" data-prpl="${H(s.id)}|do">${H(s.do||"")}</textarea></label>
      <label class="fld-label">Facilitator script<textarea rows="3" data-prpl="${H(s.id)}|script">${H(s.script||"")}</textarea></label>
      <label class="fld-label">On the one-page handout<textarea rows="2" data-prpl="${H(s.id)}|handout">${H(s.handout||"")}</textarea></label>
      ${C.length?`<div class="cnt">Moments it uses</div><div class="chips">${C.map((x,j)=>`<button class="chip ${(s.moments||[]).includes(x.id)?"on":""}" type="button" data-pruse="${H(s.id)}|moments|${H(x.id)}" aria-pressed="${(s.moments||[]).includes(x.id)}">Moment ${j+1}</button>`).join("")}</div>`:""}
      ${R.length?`<div class="cnt">Readings and files it uses</div><div class="chips">${R.map(x=>`<button class="chip ${(s.readings||[]).includes(x.id)?"on":""}" type="button" data-pruse="${H(s.id)}|readings|${H(x.id)}" aria-pressed="${(s.readings||[]).includes(x.id)}">${H(clip(x.title,40))}</button>`).join("")}</div>`:""}
      <div class="actions" style="margin:0"><button class="linkbtn" data-prmv="plan|${H(s.id)}|-1" ${i===0?"disabled":""}>Move up</button><button class="linkbtn" data-prmv="plan|${H(s.id)}|1" ${i===L.length-1?"disabled":""}>Move down</button><button class="linkbtn" data-prrmi="plan|${H(s.id)}">Take it out</button></div></div>`
    :`<div class="prsec"><b>${H(s.title||"Section "+(i+1))}</b>${s.minutes?`<div class="cnt">${H(dur(+s.minutes))}</div>`:""}${s.do?`<div style="white-space:pre-line">${H(s.do)}</div>`:""}${s.script?`<div class="cnt" style="white-space:pre-line">Facilitator script. ${H(s.script)}</div>`:""}${uses(s).length?`<div class="cnt">Uses ${H(kList(uses(s)))}</div>`:""}</div>`;
  const help=st.help&&st.help.id===e.id?`<div class="prsec"><b>A draft from writing help</b><div class="cnt">Drawn only from the notes, chosen moments and attached files. Nothing changes until you add it.</div>${st.help.sections.map(s=>`<div class="gq"><b>${H(s.title)}</b>${s.minutes?`, ${H(dur(s.minutes))}`:""}<div style="white-space:pre-line">${H(s.do)}</div></div>`).join("")}<div class="actions"><button class="btn small" data-prhelpuse="1">Add these sections</button><button class="linkbtn" data-prhelpno="1">Not these</button></div></div>`:"";
  return fold("plan","The plan",L.length?`${L.length} section${L.length===1?"":"s"}${tot?", "+dur(tot):""}`:"",(L.length?`${e.minutes?`<div class="cnt">${H(dur(tot))} planned of ${H(dur(e.minutes))}.</div>`:""}`+L.map(sec).join(""):empty("The session plan, built in sections, each with its time, what participants do, and the moments, readings and files it uses."))+
    (e.templateSource?`<div class="cnt" style="margin-top:8px">Source, seen only by you. ${H(e.templateSource)}</div>`:"")+
    (ed?`<div class="actions"><button class="btn small ghost" data-pradd="plan">Add a section</button><button class="btn small ghost" data-prhelp="1">${st.helping?"Drafting":"Draft the plan with writing help"}</button></div>${help}`:""))}

/* the self-paced follow-up */
function followFold(e){const ed=edit();const f=Object.assign({on:false,reads:[],prompts:[],checks:[]},e.followup);const R=e.readings||[];
  if(!ed&&!f.on)return "";
  const list=(k,label,ph)=>`<div class="cnt" style="margin-top:8px"><b>${label}</b></div>${(f[k]||[]).map(x=>`<div class="strow"><div style="white-space:pre-line">${H(x.text)}</div>${ed?`<div><button class="linkbtn" data-prrmi="${k}|${H(x.id)}">Take it out</button></div>`:""}</div>`).join("")||empty("None yet.")}
    ${ed?`<div class="actions"><input type="text" id="prf-${k}" placeholder="${H(ph)}" style="flex:1 1 220px"><button class="btn small ghost" data-pradd="${k}">Add</button></div>`:""}`;
  const body=(ed?`<label class="radio"><input type="checkbox" id="pr-fu" ${f.on?"checked":""}><span>Offer a self-paced follow-up</span></label>`:"")+(f.on?`<div class="cnt" style="margin-top:8px"><b>Short readings</b></div>${R.length?`<div class="chips">${R.map(x=>ed?`<button class="chip ${f.reads.includes(x.id)?"on":""}" type="button" data-prfur="${H(x.id)}" aria-pressed="${f.reads.includes(x.id)}">${H(clip(x.title,50))}</button>`:f.reads.includes(x.id)?`<span class="chip on">${H(clip(x.title,50))}</span>`:"").join("")}</div>`:empty("Add readings under Readings and files, then choose the short ones here.")}
    ${list("prompts","Reflection prompts","A question to reflect on")}${list("checks","A brief check","A short question to answer")}`:empty("Optional. Short readings, reflection prompts and a brief check participants complete on their own."));
  return fold("follow","Self-paced follow-up",f.on?"Offered":"",body)}

/* prints */
function printsFold(e){const dir=D();const nm=e.names||"none";
  const row=(k,l,d)=>`<div class="prow"><span><b>${l}</b><div class="cnt">${d}</div></span><span class="actions" style="margin:0"><button class="btn small ghost" data-prprint="${k}">PDF</button><button class="linkbtn" data-prword="${k}">Word</button></span></div>`;
  return fold("prints","Prints",NM[nm]||"No names",`<div class="prow" style="border-top:none;padding-top:0"><span class="cnt">Children's names on these prints</span>${dir?`<div class="tseg" role="group" aria-label="Children's names on these prints">${NAME_MODES.map(([k,l])=>`<button data-prnames="${k}" aria-pressed="${nm===k}">${l}</button>`).join("")}</div>`:`<b>${H(NM[nm]||"No names")}</b>`}</div>
    <div class="cnt">No names unless the director changes it for this entry, since many audiences are from other schools.</div>
    <div class="prow"><span class="cnt">Who these prints are for</span><div class="tseg" role="group" aria-label="Who these prints are for"><button data-proutsidep="0" aria-pressed="${!outsideOn(e)}">Our team</button><button data-proutsidep="1" aria-pressed="${outsideOn(e)}">Outside audiences</button></div></div>
    <div class="cnt">${outsideOn(e)?`For outside audiences, prints carry only the moments cleared for outside audiences, ${(e.chosen||[]).filter(x=>x.outside).length} of ${(e.chosen||[]).length}, with no names, and name Fulton Community School & Farm as the source.`:"For our team, prints carry every chosen moment."}</div>
    ${row("guide","Facilitator guide","The session plan, section by section, with its moments, readings and files.")}${row("panels","Panels","Printed panels, one idea to a page, clean and uncrowded.")}${row("handout","Handout","For participants, with the guiding question, readings, reflection prompts and the brief check.")}${row("slides","Slide set","A large photo and the words, one moment to a slide. Faces are softened, so it can be shared.")}
    <div class="prow"><span><b>Slide set to show</b><div class="cnt">For showing on the screen during the session only. Children's faces are kept, so it is never handed out or shared.</div></span><span class="actions" style="margin:0"><button class="btn small ghost" data-prprint="slides" data-prshow="1">PDF</button></span></div>
    <div class="cnt">Every print and Word file people take away is made with children's faces softened, checked on this device.</div>`)}

/* ---------- printouts and Word files ---------- */
const nmOf=e=>e.names||"none";
const words=(x,e)=>displayText(x.text||"",nmOf(e),x.wonder||"");
const photoOf=x=>{const s=picOf(x,true);return s&&x.photo&&x.photo.w?[{key:"pr:"+x.id,src:s,w:x.photo.w,h:x.photo.h}]:[]};
const metaOf=e=>[["Audience",e.audience||"Not yet set"],["Audience type",PR_AUD[e.audienceType]||"Not yet set"],["Offered",PR_MODE[e.mode]||""],["Date",e.date?fd(e.date):""],["Length",dur(e.minutes)],...(e._outside?[]:[["Presenters",kList(e.presenters||[])]])];
function guideDoc(e){const C=e.chosen||[],R=e.readings||[];const rd=x=>x.title+(x.url?" ("+treeReadPlace(x.url)+")":"")+(x.note?". "+x.note:"");
  return report(e.title+", facilitator guide",metaOf(e),[e.subtitle?{t:"text",text:e.subtitle}:null,e.question?{t:"text",label:"Guiding question",text:e.question}:null,e.format?{t:"text",label:"How it is offered",text:e.format}:null,
    ...(e.plan||[]).map((s,i)=>({t:"text",label:(s.title||"Section "+(i+1))+(s.minutes?", "+dur(+s.minutes):""),text:[s.do,s.script?"Facilitator script. "+s.script:"",...(s.moments||[]).map(id=>C.find(x=>x.id===id)).filter(Boolean).map(x=>"Moment "+(C.indexOf(x)+1)+". "+clip(words(x,e),400)+(where(x)?" ("+where(x)+")":"")),...(s.readings||[]).map(id=>R.find(x=>x.id===id)).filter(Boolean).map(rd)].filter(Boolean).join("\n\n")})),
    !(e.plan||[]).length?{t:"text",text:"The plan has no sections yet."}:null,
    C.length?{t:"list",label:"Chosen moments",numbered:true,items:C.map(x=>clip(words(x,e),500)+(where(x)?" ("+where(x)+")":""))}:null,
    R.length?{t:"list",label:"Readings and files",items:R.map(rd)}:null,followBlocks(e)].flat().filter(Boolean))}
function followBlocks(e){const f=Object.assign({on:false,reads:[],prompts:[],checks:[]},e.followup);if(!f.on)return [];const R=e.readings||[];
  return [{t:"sub",text:"Self-paced follow-up"},f.reads.length?{t:"list",label:"Short readings",items:f.reads.map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>x.title+(x.url?" ("+treeReadPlace(x.url)+")":""))}:null,
    f.prompts.length?{t:"list",label:"Reflection prompts",items:f.prompts.map(x=>x.text)}:null,f.checks.length?{t:"list",label:"A brief check",numbered:true,items:f.checks.map(x=>x.text)}:null]}
function handoutDoc(e){const R=e.readings||[];return report(e.title,[["Audience",e.audience],["Offered",PR_MODE[e.mode]||""],["Date",prWhen(e)],["Place",e.place||""]],[e.subtitle?{t:"text",text:e.subtitle}:null,e.question?{t:"text",label:"Guiding question",text:e.question}:null,
  (e.plan||[]).some(s=>s.handout)?{t:"list",label:"For today",items:(e.plan||[]).filter(s=>s.handout).map(s=>(s.title?s.title+". ":"")+s.handout)}:null,
  R.filter(x=>x.kind!=="drive").length?{t:"list",label:"Readings",items:R.filter(x=>x.kind!=="drive").map(x=>x.title+(x.url?" ("+treeReadPlace(x.url)+")":"")+(x.note?". "+x.note:""))}:null,
  ...(e._map?[{t:"photo",key:"sitemap",full:true,maxH:420},{t:"list",label:"The site map",items:e._map}]:[]),...followBlocks(e)].filter(Boolean))}
// the site map for visitors, numbered, once the director marks it ready. Never a child's photo or name.
async function handoutMap(){try{const m=window.TREE_SITEMAP?await window.TREE_SITEMAP():null;if(!m||!m.ready||!m.src||!window.SiteMap||!m.spots.some(x=>x.x!=null))return null;
  const blob=await (await fetchPhoto(m.src)).blob();const pic=await window.SiteMap.picture(blob,m.spots);photoCache.set("sitemap",{url:pic.url,bytes:pic.bytes,w:pic.w,h:pic.h});return pic.names}catch(e){return null}}
// panels, one idea to a page. The opening, the guiding question, each moment, and the question again to close.
function sheet(o){return Object.assign({centered:true,display:true,type:"report",acc:"story",title:"",details:[],photos:[],blocks:[]},o)}
// a moment's own heading, as its sheet in TREE would have it, or its first words
const titleOf=(x,e)=>{const n=String(x.from||"").startsWith("obs:")&&typeof notices!=="undefined"?notices.get(x.from.slice(4)):null;return n&&typeof momentTitle==="function"?displayText(momentTitle(n),nmOf(e)):displayText(clip(String(x.text||"").split(/[.!?\n]/)[0],44),nmOf(e))};
function panelDocs(e){const C=e.chosen||[];return [sheet({title:e.title,details:[e.subtitle||"",e.audience||"",e.date?fd(e.date):""],blocks:e.question?[{t:"box",text:e.question}]:[]}),
  ...C.map(x=>sheet({title:titleOf(x,e),details:[where(x)],photos:photoOf(x).slice(0,1),blocks:[{t:"para",text:clip(words(x,e),520)}]})),
  ...(e.question?[sheet({bare:true,blocks:[{t:"quote",words:e.question,by:""}]})]:[])]}
// a slide set, landscape, with the photo large beside the words
function slideDocs(e){const C=e.chosen||[];const land=(o,ph)=>ph.length?sheet(Object.assign({pos:"left",land:true,tsize:"l",photos:ph},o)):sheet(o);
  const first=C.map(photoOf).find(p=>p.length)||[],last=[...C].reverse().map(photoOf).find(p=>p.length)||[];
  return [land({title:e.title,details:[e.subtitle||"",e.date?fd(e.date):""],blocks:e.question?[{t:"box",text:e.question}]:[]},first),
    ...C.map(x=>land({title:titleOf(x,e),details:[where(x)],blocks:[{t:"para",text:clip(words(x,e),360)}]},photoOf(x))),
    ...(e.question?[land({title:"",bare:true,blocks:[{t:"quote",words:e.question,by:""}]},last)]:[])]}
// slides shown during the presentation itself may keep children's faces. Everything participants take away, and every
// Word file, is made with faces softened.
// prints for outside audiences, the default for an entry marked external, carry only cleared moments and name the school
const outsideOn=e=>st.outsideP&&e.id in st.outsideP?st.outsideP[e.id]:(e.audienceType==="external"||e.audienceType==="both");
// outside prints carry no names at all, no presenters, no names in the plan's own words and no Drive files
const forOutside=e=>{const ok=new Set((e.chosen||[]).filter(x=>x.outside).map(x=>x.id));const nn=t=>t?displayText(String(t),"none"):t;
  return Object.assign({},e,{_outside:true,names:"none",subtitle:nn(e.subtitle),question:nn(e.question),format:nn(e.format),readings:(e.readings||[]).filter(x=>x.kind!=="drive"),chosen:(e.chosen||[]).filter(x=>ok.has(x.id)),
    plan:(e.plan||[]).map(s=>Object.assign({},s,{title:nn(s.title),do:nn(s.do),script:nn(s.script),handout:nn(s.handout),moments:(s.moments||[]).filter(id=>ok.has(id)),readings:(s.readings||[]).filter(id=>(e.readings||[]).some(r=>r.id===id&&r.kind!=="drive"))}))})};
const creditDocs=docs=>{const c="Fulton Community School & Farm";for(const d of docs){if(d.meta)d.meta=[...d.meta,["From",c]];else d.details=[...(d.details||[]),c]}return docs};
async function print(k,word,toShow){const out0=outsideOn(E());const e=out0?forOutside(E()):E();const kind=word?"word":"pdf";progress("Making the file");
  const docs=k==="guide"?[guideDoc(e)]:k==="handout"?[handoutDoc(Object.assign({},e,{_map:await handoutMap()}))]:k==="panels"?panelDocs(e):slideDocs(e);
  if(out0)creditDocs(docs);
  if(docs.some(d=>(d.photos||[]).length)){await loadPhotos(docs);if(!(toShow&&k==="slides"&&!word))await softenDocPhotos(docs)}
  return out(kind,docs,e.title+" "+{guide:"facilitator guide",handout:"handout",panels:"panels",slides:toShow&&!word?"slides to show":"slides"}[k])}

/* ---------- writing help, drawn only from the notes, chosen moments and attached files ---------- */
async function draftPlan(){const e=E();if(!sample){toast("Writing help is not available right now. Write the sections yourself.");return}
  const notes=(e.notes||[]).map(n=>"- "+n.text).join("\n"),moments=(e.chosen||[]).map((x,i)=>`${i+1}. ${clip(x.text,500)}`).join("\n"),files=(e.readings||[]).map(x=>`- ${x.title}${x.note?". "+x.note:""}`).join("\n");
  if(!notes&&!moments&&!files){toast("Add a note, a chosen moment or a reading first. Writing help uses only these.");return}
  st.helping=true;X.redraw();
  try{const r=await sample.json(`Draft a session plan for early childhood educators. Use only the material given below, the director's notes, the chosen moments in educators' own words, and the titles and notes of the attached readings and files. Add no facts, examples, quotes or sources that are not in this material. Write in plain, warm, short sentences. Never use dashes or colons. Say educator, never teacher.\n\nTitle. ${e.title}\nGuiding question. ${e.question||""}\nAudience. ${e.audience||""}\nLength in minutes. ${e.minutes||""}\n\nNotes\n${notes||"None"}\n\nChosen moments\n${moments||"None"}\n\nReadings and files\n${files||"None"}\n\nReturn only a JSON object with one key "sections", an array of 3 to 6 objects with "title" (a few words), "minutes" (a number, adding up to the length if one is given) and "do" (two or three sentences on what participants do).`,{purpose:"presenting",cache:false});
    const fix=s=>String(s||"").replace(/\s*[—–]\s*/g,", ").replace(/:\s*/g,". ").replace(/\bteachers?\b/gi,m=>m[0]==="T"?"Educator"+(m.length>7?"s":""):"educator"+(m.length>7?"s":"")).trim();
    st.help={id:e.id,sections:(Array.isArray(r&&r.sections)?r.sections:[]).slice(0,8).map(s=>({title:fix(s.title).slice(0,200),minutes:Math.max(0,Math.round(+s.minutes||0)),do:fix(s.do).slice(0,2000)})).filter(s=>s.title)};
    if(!st.help.sections.length){st.help=null;toast("Writing help returned nothing to use. Try again, or write the sections yourself.")}}
  catch(er){toast("Writing help is not available right now. Write the sections yourself.")}
  st.helping=false;X.redraw()}

/* ---------- saving ---------- */
const set=r=>{const keepLib=st.e&&st.e.library,keepCh=st.e&&st.e.choices;st.e=Object.assign(r,{library:r.library||keepLib,choices:r.choices||keepCh});if(st.ev&&st.evFor===r.id)st.evFor="";return r};
async function saveItem(list,item){const r=await pa("item",{id:E().id,list,item});set(r);return r.item}
const said=t=>{const s=$("#pr-saved");if(s)s.textContent=t};

/* ---------- taps ---------- */
const val=s=>{const e=$(s);return e?e.value:""};
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;st.help=null},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-proutsidep],[data-praud],[data-praudsort],[data-prsel],[data-prnew],[data-prpres],[data-prnames],[data-prdone],[data-prundo],[data-prcopy],[data-prrm],[data-pradd],[data-prrmi],[data-prmv],[data-prkeep],[data-prevg],[data-prlooksave],[data-prfind],[data-prlens],[data-prchoose],[data-pruse],[data-prfur],[data-prhelp],[data-prhelpuse],[data-prhelpno],[data-prprint],[data-prword],[data-prmoment],[data-prmomentno],[data-pragenda]");
  if(!t)return;X.tapOnce(t,()=>prTap(e,t))},true);
async function prTap(e,t){const d=t.dataset;const en=E();
  if(VIEW_AS&&d.prsel==null){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.prsel!=null){Pr.open(d.prsel);T.render("stpres");window.scrollTo(0,0);return}
  if(d.pragenda){if(window.TreeGrowth)TreeGrowth.openAgenda(d.pragenda);goView("stpdd");return}
  if(d.proutsidep!=null){st.outsideP=Object.assign({},st.outsideP,{[E().id]:d.proutsidep==="1"});X.redraw();return}
  if(d.prprint||d.prword){return print(d.prprint||d.prword,!!d.prword,!!d.prshow)}
  if(d.prnew){const title=val("#prn-title").trim();if(!title){toast("Give the entry a title.");return}const r=await pa("new",{title,template:d.prnew==="template"});Pr.open(r.id);toast("Started.");T.render("stpres");return}
  if(d.prpres){const cur=new Set(en.presenters||[]);cur.has(d.prpres)?cur.delete(d.prpres):cur.add(d.prpres);set(await pa("save",{id:en.id,fields:{presenters:[...cur]}}));toast(cur.has(d.prpres)?`${d.prpres} can see and work on this entry now.`:`${d.prpres} is no longer a presenter.`);X.redraw();return}
  if(d.prnames){set(await pa("save",{id:en.id,fields:{names:d.prnames}}));X.redraw();return}
  if(d.prdone){const alone=!(en.presenters||[]).length;if(!confirm(alone?"Mark it presented with no presenters? No hours are logged.":`Mark it presented? ${kList(en.presenters)} ${en.presenters.length===1?"gets":"get"} the time as our PD hours.`))return;
    const r=set(await pa("presented",{id:en.id,alone}));toast(r.credited?"Marked presented. The hours are on each presenter's records page.":"Marked presented.");X.redraw();return}
  if(d.prundo){if(!confirm("Mark it as not presented? The hours it logged come off the presenters' records pages."))return;set(await pa("presented",{id:en.id,undo:true}));toast("Marked as not presented.");X.redraw();return}
  if(d.prcopy){const r=await pa("copy",{id:en.id,title:val("#prc-title")});Pr.open(r.id);toast("Copied. Set the date and presenters for the new entry.");T.render("stpres");window.scrollTo(0,0);return}
  if(d.prrm){if(!confirm("Remove this entry? It stays in the backups."))return;await pa("remove",{id:en.id});Pr.open("");toast("Removed.");T.render("stpres");return}
  if(d.pradd){const k=d.pradd;
    if(k==="notes"){const text=val("#prn-note").trim();if(!text){toast("Write the note first.");return}await saveItem("notes",{text,date:val("#prn-date")});toast("Added.");X.redraw();return}
    if(k==="meetings"){await saveItem("meetings",{date:today()});foldOpen.add("pres:meetings");X.redraw();return}
    if(k==="plan"){await saveItem("plan",{title:"",minutes:0,do:""});foldOpen.add("pres:plan");X.redraw();return}
    if(k==="prompts"||k==="checks"){const text=val("#prf-"+k).trim();if(!text){toast("Write it first.");return}await saveItem(k,{text});X.redraw();return}
    if(k==="library"){const ref=val("#prr-lib");if(!ref){toast("Choose a reading.");return}await saveItem("readings",{kind:"library",ref,note:val("#prr-libnote")});toast("Added.");X.redraw();return}
    if(k==="link"){await saveItem("readings",{kind:$("#prr-lic")&&$("#prr-lic").checked?"licensing":"link",url:val("#prr-url").trim(),title:val("#prr-title"),note:val("#prr-note")});toast("Added.");X.redraw();return}
    if(k==="drive"){await saveItem("readings",{kind:"drive",url:val("#prd-url").trim(),title:val("#prd-title"),note:val("#prd-note")});toast("Added.");X.redraw();return}}
  if(d.prrmi){const [list,id]=d.prrmi.split("|");if(list!=="prompts"&&list!=="checks"&&!confirm("Take this out?"))return;set(await pa("item",{id:en.id,list,remove:id}));X.redraw();return}
  if(d.prmv){const [list,id,dd]=d.prmv.split("|");const ids=(en[list]||[]).map(x=>x.id);const i=ids.indexOf(id),j=i+(+dd);if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];set(await pa("order",{id:en.id,list,ids}));X.redraw();return}
  if(d.prkeep){const [key,v]=d.prkeep.split("|");set(await pa("decide",{id:en.id,key,keep:v==="1"?true:v==="0"?false:null}));st.ev=await pa("evidence",{id:en.id});st.evFor=en.id;toast(v==="1"?"Kept. It is in Chosen moments.":v==="0"?"Set aside.":"Undone.");X.redraw();return}
  if(d.prevg!=null){st.evGroup=d.prevg;X.redraw();return}
  if(d.prlooksave){const look=[];document.querySelectorAll("[data-prlook]").forEach(x=>{const [i,f]=x.dataset.prlook.split("|");const g=look[+i]=look[+i]||{k:((st.ev||{}).look||[])[+i]?.k||"g"+i};g[f]=f==="label"?x.value:x.value.split(",").map(w=>w.trim()).filter(Boolean)});
    set(await pa("save",{id:en.id,fields:{look:look.filter(g=>g&&(g.words||[]).length),youngest:!!($("#pr-young")&&$("#pr-young").checked),lens:val("#pr-lens")}}));st.ev=await pa("evidence",{id:en.id});st.evFor=en.id;toast("Saved. TREE has read the records again.");X.redraw();return}
  if(d.prfind){st.pickQ=val("#prp-q");X.redraw();return}
  if(d.praud!=null){st.aud=d.praud;X.redraw();return}
  if(d.praudsort){st.audSort=!st.audSort;X.redraw();return}
  if(d.prlens){st.pickLens=st.pickLens===d.prlens?"":d.prlens;st.pickQ=val("#prp-q");X.redraw();return}
  if(d.prchoose){set(await pa("choose",{id:en.id,obs:d.prchoose}));toast("Chosen. It is at the end of Chosen moments.");X.redraw();return}
  if(d.pruse){const [sid,k,id]=d.pruse.split("|");const s=(en.plan||[]).find(x=>x.id===sid);if(!s)return;collectPlan(s);const L=new Set(s[k]||[]);L.has(id)?L.delete(id):L.add(id);await saveItem("plan",Object.assign({},s,{[k]:[...L]}));X.redraw();return}
  if(d.prfur){const f=Object.assign({reads:[]},en.followup);const L=new Set(f.reads);L.has(d.prfur)?L.delete(d.prfur):L.add(d.prfur);set(await pa("save",{id:en.id,fields:{followupReads:[...L]}}));X.redraw();return}
  if(d.prhelp){return draftPlan()}
  if(d.prhelpno){st.help=null;X.redraw();return}
  if(d.prhelpuse){const h=st.help;st.help=null;for(const s of h.sections)await saveItem("plan",{title:s.title,minutes:s.minutes,do:s.do,moments:[],readings:[]});toast("Added. Change any section as you like.");X.redraw();return}
  if(d.prmoment){const G=window.TreeGrowth&&TreeGrowth.st;if(!G){toast("Proud Moments are not open yet.");return}
    G.mform={kind:"moment",audience:"everyone",area:"refl",text:`I led ${en.title}${en.audience?" for "+en.audience:""}${en.presentedOn?", "+fd(en.presentedOn):""}.`,link:{kind:"presenting",id:en.id,label:"Presenting, "+en.title}};goView("stmom");return}
  if(d.prmomentno){set(await pa("credit",{id:en.id,moment:"no"}));X.redraw();return}
}
// the words a section holds on the page, so a tap on a chip keeps what was typed
function collectPlan(s){document.querySelectorAll(`[data-prpl^="${CSS.escape(s.id)}|"]`).forEach(x=>{const f=x.dataset.prpl.split("|")[1];s[f]=f==="minutes"?+x.value||0:x.value})}
// details, meetings, plan sections and languages save as they change, without drawing the page again
document.addEventListener("change",async e=>{const t=e.target;if(!t.closest||!t.closest("#main")||typeof view==="undefined"||view!=="stpres"||!st.e)return;const d=t.dataset;
  if(VIEW_AS&&(d.prf||d.pri||d.prpl||d.prlang||t.id==="pr-fu"))return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  try{
    if(d.prf){said("Saving");set(await pa("save",{id:st.e.id,fields:{[d.prf]:t.value}}));said("Saved.");return}
    if(d.pri){const [list,id,f]=d.pri.split("|");const x=(st.e[list]||[]).find(y=>y.id===id);if(!x)return;x[f]=t.value;await saveItem(list,x);return}
    if(d.prpl){const [id]=d.prpl.split("|");const s=(st.e.plan||[]).find(y=>y.id===id);if(!s)return;collectPlan(s);await saveItem("plan",s);return}
    if(d.prlang){const x=(st.e.chosen||[]).find(y=>y.id===d.prlang);if(!x)return;await saveItem("chosen",{id:x.id,language:t.value});X.redraw();return}
    if(d.proutside){const x=(st.e.chosen||[]).find(y=>y.id===d.proutside);if(!x)return;await saveItem("chosen",{id:x.id,language:x.language||"",outside:t.checked});X.redraw();return}
    if(t.id==="pr-fu"){set(await pa("save",{id:st.e.id,fields:{followupOn:t.checked}}));X.redraw();return}
  }catch(er){fail(er)}});
// Evidence is read when its dropdown opens
document.addEventListener("toggle",e=>{const dt=e.target;if(!dt||!dt.matches||!dt.matches('details[data-fold="pres:evidence"]')||!dt.open||!st.e||st.evFor===st.e.id)return;
  pa("evidence",{id:st.e.id}).then(r=>{st.ev=r;st.evFor=st.e.id;X.redraw()}).catch(fail)},true);
// chosen moments drag into order, with a finger on an iPad or iPhone as with a mouse
let drag=null;
document.addEventListener("pointerdown",e=>{const h=e.target.closest&&e.target.closest("[data-prdrag]");if(!h||!edit())return;const row=h.closest("[data-prchosen]");if(!row)return;e.preventDefault();drag={row,list:row.parentNode,id:row.dataset.prchosen,moved:false};row.classList.add("dragging");try{h.setPointerCapture(e.pointerId)}catch(er){}});
document.addEventListener("pointermove",e=>{if(!drag)return;e.preventDefault();const over=document.elementFromPoint(e.clientX,e.clientY);const r=over&&over.closest&&over.closest("[data-prchosen]");if(!r||r===drag.row||r.parentNode!==drag.list)return;
  const b=r.getBoundingClientRect();drag.list.insertBefore(drag.row,e.clientY>b.top+b.height/2?r.nextSibling:r);drag.moved=true},{passive:false});
const endDrag=async()=>{if(!drag)return;const d0=drag;drag=null;d0.row.classList.remove("dragging");if(!d0.moved)return;const ids=[...d0.list.querySelectorAll("[data-prchosen]")].map(x=>x.dataset.prchosen);
  try{set(await pa("order",{id:E().id,list:"chosen",ids}));X.redraw()}catch(er){fail(er);X.redraw()}};
document.addEventListener("pointerup",endDrag);document.addEventListener("pointercancel",endDrag);
})();
