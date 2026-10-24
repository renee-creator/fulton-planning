/* ---------- Educators in TREE ----------
   Each educator's records page, the director's view of every educator, October 1, 2027, the drill log, paper personnel
   files, the New Educator section, the PD library with Licensing at Fulton and the TREE How To guides, and the Teacher
   Policies and Procedures. TREE loads this file only when someone opens one of these pages, and the server sends each
   record only to the educator it belongs to and the director. It uses TREE's own helpers, $, esc, toast, the PDF and
   Word makers, and the sign-in. */
(function(){
"use strict";
const T={};window.TreeStaff=T;
let B=null;
const st={who:"",doc:null,people:null,drills:null,pd:null,hb:null,piece:"",mod:"",hbSec:"",hbEdit:false,newWho:"",adding:false,group:false,busy:"",viewer:null};
const api=(p,b)=>window.FP_API("/api/staff/"+p,b||{});
const fail=e=>toast((e&&(e.message||e.error))||"That did not work. Check the connection and try again.");
const H=s=>esc(String(s==null?"":s));
const DAY=864e5;
// each record links to the current regulations on the CDSS website, one tap away
const REGS="https://cdss.ca.gov/inforesources/Rules-Regulations/Legislation-and-Regulations/Community-Care-Licensing-Regulations/Child-Care";
const addMonths=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCMonth(x.getUTCMonth()+n);return x.toISOString().slice(0,10)};
const addDays=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const daysTo=(a,b)=>Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/DAY);
const fd=s=>s&&/^\d{4}-\d{2}-\d{2}/.test(s)?fmtDate(String(s).slice(0,10)):"";
const fms=ms=>ms?shortDate(ms):"";
const today=()=>(B&&B.today)||iso(new Date());
const yearStart=()=>{const t=today(),y=+t.slice(0,4);return (+t.slice(5,7)>=8?y:y-1)+"-08-01"};
const fluSeason=()=>{const t=today(),y=+t.slice(0,4),md=t.slice(5);return String(md>="07-15"&&md<"08-01"?y:(+t.slice(5,7)>=8?y:y-1))};
const semester=()=>{const t=today(),y=t.slice(0,4),m=+t.slice(5,7);return m>=8?y+"-fall":m<=5?y+"-spring":""};
const semLabel=k=>k?(k.endsWith("fall")?"Fall ":"Spring ")+k.slice(0,4):"";
const D=()=>isDirector()&&!VIEW_AS;
const P=()=>st.doc||{};
const meName=()=>(B&&B.me&&B.me.name)||me();

/* ---------- looks ---------- */
if(!document.getElementById("staffcss")){const c=document.createElement("style");c.id="staffcss";c.textContent=`
.stchip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:600;white-space:nowrap;border:1px solid var(--line)}
.stchip.ok{background:#e7f1ea;color:#2f5a43;border-color:#c9dccf}.stchip.soon{background:var(--sun-wash);color:#8a5a06;border-color:var(--sun-line)}
.stchip.out{background:#f8e6e1;color:#9a3f2c;border-color:#e8c7bd}.stchip.missing{background:transparent;color:var(--muted)}.stchip.soonish{background:#eef1f7;color:#41506e}
.strow{display:grid;gap:6px;border-top:1px solid var(--line);padding:12px 0}.strow:first-of-type{border-top:0}
.strow .sttop{display:flex;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;align-items:baseline}
.stfiles{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}
.stmd h3{font-size:16px;margin:14px 0 6px}.stmd h4{font-size:14.5px;margin:12px 0 4px}.stmd p{margin:0 0 9px;line-height:1.55}.stmd ul,.stmd ol{margin:0 0 10px;padding-left:22px}.stmd li{margin:3px 0;line-height:1.5}
.stmd table{border-collapse:collapse;width:100%;font-size:13.5px;margin:6px 0 12px}.stmd td,.stmd th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.stmd .tw{max-width:100%;overflow-x:auto}
.stseq{display:grid;gap:8px}.stseq>div{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--paper)}.stseq>div.now{border-color:var(--moss);box-shadow:0 0 0 1px var(--moss)}
.stview{position:fixed;inset:0;z-index:80;background:rgba(20,30,24,.55);display:grid;place-items:center;padding:16px}
.stview>div{background:var(--paper);border-radius:12px;width:min(900px,100%);height:min(86vh,1000px);display:grid;grid-template-rows:auto 1fr;overflow:hidden}
.stview .bar{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line)}
.stview iframe,.stview img{width:100%;height:100%;border:0;object-fit:contain;background:#f4f4f2}
.stq{border-left:3px solid var(--marigold);padding-left:10px}
.strow a,.stmd a{color:var(--moss)}
.stgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.stmod{border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--paper);display:grid;gap:6px;align-content:start}
@media (max-width:760px){.stview{padding:0}.stview>div{height:100vh;border-radius:0}}
`;document.head.appendChild(c)}
const chip=(s,t)=>`<span class="stchip ${s}">${H(t)}</span>`;
const card=(title,inner,side)=>`<section class="card"><div class="secthead" style="margin-bottom:6px"><h3 style="font-size:17px">${H(title)}</h3>${side?`<span class="cnt">${side}</span>`:""}</div>${inner}</section>`;
const printBar=k=>`<div class="actions" style="margin:0"><button class="btn small ghost" data-stprint="${k}">Print</button><button class="linkbtn" data-stword="${k}">Word</button></div>`;
const head=(eyebrow,title,sub)=>`<div class="head"><div><span class="eyebrow">${H(eyebrow)}</span><h2 style="margin-top:4px">${H(title)}</h2>${sub?`<div class="sub" style="max-width:76ch">${sub}</div>`:""}</div></div>`;

/* ---------- a little Markdown, for the handbook and the pieces ---------- */
function inline(s){return H(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g,"$1<i>$2</i>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,(m,t,u)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`)}
function md(text){const L=String(text||"").replace(/\r/g,"").split("\n");let h="",i=0;
  while(i<L.length){const l=L[i];
    if(!l.trim()){i++;continue}
    let m=l.match(/^(#{1,4})\s+(.*)$/);if(m){const n=Math.min(4,m[1].length+1);h+=`<h${n}>${inline(m[2])}</h${n}>`;i++;continue}
    if(/^\s*\|/.test(l)){const rows=[];while(i<L.length&&/^\s*\|/.test(L[i])){rows.push(L[i]);i++}
      const cells=r=>r.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim());const body=rows.filter(r=>!/^\s*\|?\s*:?-{2,}/.test(r));
      h+=`<div class="tw"><table>${body.map((r,k)=>`<tr>${cells(r).map(c=>k===0?`<th>${inline(c)}</th>`:`<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;continue}
    if(/^\s*[-*]\s+/.test(l)){const it=[];while(i<L.length&&/^\s*[-*]\s+/.test(L[i])){it.push(L[i].replace(/^\s*[-*]\s+/,""));i++}h+=`<ul>${it.map(x=>`<li>${inline(x)}</li>`).join("")}</ul>`;continue}
    if(/^\s*\d+\.\s+/.test(l)){const it=[];while(i<L.length&&/^\s*\d+\.\s+/.test(L[i])){it.push(L[i].replace(/^\s*\d+\.\s+/,""));i++}h+=`<ol>${it.map(x=>`<li>${inline(x)}</li>`).join("")}</ol>`;continue}
    const p=[];while(i<L.length&&L[i].trim()&&!/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(L[i])){p.push(L[i]);i++}h+=`<p>${inline(p.join(" "))}</p>`}
  return `<div class="stmd">${h}</div>`}
// the same Markdown as blocks for a printout and a Word file
const plain=s=>String(s||"").replace(/\*\*(.+?)\*\*/g,"$1").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g,"$1$2").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,"$1 ($2)");
function mdBlocks(text){const L=String(text||"").replace(/\r/g,"").split("\n");const out=[];let i=0;
  while(i<L.length){const l=L[i];if(!l.trim()){i++;continue}
    let m=l.match(/^#{1,4}\s+(.*)$/);if(m){out.push({t:"sub",text:plain(m[1])});i++;continue}
    if(/^\s*\|/.test(l)){const rows=[];while(i<L.length&&/^\s*\|/.test(L[i])){rows.push(L[i]);i++}const cells=r=>r.trim().replace(/^\||\|$/g,"").split("|").map(c=>plain(c.trim()));const body=rows.filter(r=>!/^\s*\|?\s*:?-{2,}/.test(r)).map(cells);
      out.push({t:"table",label:"",noRule:true,head:body[0],rows:body.slice(1)});continue}
    if(/^\s*[-*]\s+/.test(l)){const it=[];while(i<L.length&&/^\s*[-*]\s+/.test(L[i])){it.push(plain(L[i].replace(/^\s*[-*]\s+/,"")));i++}out.push({t:"list",items:it});continue}
    if(/^\s*\d+\.\s+/.test(l)){const it=[];while(i<L.length&&/^\s*\d+\.\s+/.test(L[i])){it.push(plain(L[i].replace(/^\s*\d+\.\s+/,"")));i++}out.push({t:"list",numbered:true,items:it});continue}
    const p=[];while(i<L.length&&L[i].trim()&&!/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(L[i])){p.push(L[i]);i++}out.push({t:"text",text:plain(p.join(" "))})}
  return out}
const report=(title,meta,blocks)=>({display:true,type:"report",acc:"story",title,meta:meta.filter(x=>x&&x[1]),blocks:blocks.filter(Boolean)});
async function out(kind,docs,name){try{if(kind==="word")await makeDocx(docs,safeFile(name)+".docx");else await makePdf(docs,safeFile(name)+".pdf")}catch(e){fail(e)}}

/* ---------- data ---------- */
async function boot(force){if(!B||force){B=await api("boot");}return B}
async function loadPerson(name){st.doc=await api("person",{name});st.who=name;return st.doc}
async function save(doc,msg){try{st.doc=await api("save",{name:doc.name,doc});if(msg)toast(msg);return st.doc}catch(e){fail(e);return null}}
async function loadPeople(){const r=await api("people");st.people=r.people;st.drills=r.drills;return r}
async function loadPd(){if(!st.pd)st.pd=await api("pd");return st.pd}
async function loadHb(force){if(!st.hb||force)st.hb=await api("handbook");return st.hb}
const ITEMS=()=>B.defs.items,PAPERS=()=>B.defs.papers;
// Fulton's own trainings are for everyone who cares for children, so the office and the kitchen do not see them
const careFor=p=>!["Office","Kitchen","Staff","Director"].includes(p.role||whoRole(p))&&!((p.profile||{}).role==="staff");
// an office member who also works as an educator supervises children, so Fulton's own training is hers too
const itemsFor=p=>ITEMS().filter(i=>!i.fulton||careFor(p)||!!(p.profile||{}).supervises);
// the CCLD video and the active supervision handouts from the school's Google Drive
const asLinks=()=>{const a=B.activeSupervision;if(!a)return "";return `<div class="stfiles">${a.video?`<a class="linkbtn" href="${H(a.video.url)}" target="_blank" rel="noopener">Watch ${H(a.video.title)}</a>`:""}${(a.handouts||[]).map(x=>`<a class="linkbtn" href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>`).join("")}</div>`};
function itemState(it,rec){if(!rec||!rec.date)return it.fulton?{s:"soon",t:"Due",ex:""}:{s:"missing",t:"Not on file yet",ex:""};
  const ex=rec.expires||(it.months?addMonths(rec.date,it.months):"");if(!ex)return {s:"ok",t:"In place",ex:""};
  const left=daysTo(today(),ex),lead=B.school.remindDays||30;
  return left<0?{s:"out",t:"Expired "+fd(ex),ex}:left<=lead?{s:"soon",t:"Renew by "+fd(ex),ex}:{s:"ok",t:"Current to "+fd(ex),ex}}
function fluState(doc){const s=fluSeason(),f=(doc.flu||{})[s];const stt=(doc.profile||{}).startDate||"";
  if(f&&f.status)return {s:"ok",t:{vaccinated:"Flu shot on file",declined:"Declined in writing",medical:"Medical exemption on file"}[f.status]||"On file",season:s};
  if(stt&&stt>s+"-12-01"&&stt<(+s+1)+"-08-01")return {s:"ok",t:"Not needed in the first year",season:s};
  const t=today();return {s:t.slice(5)>="12-01"&&t.slice(5)<"08-01"&&t.slice(0,4)>s?"out":"missing",t:"Due between August 1 and December 1",season:s}}
const onceState=r=>r&&r.status?{s:"ok",t:{record:"Record on file",immune:"Immunity shown",medical:"Medical exemption on file",statement:"Written statement, 30 days to gather records"}[r.status]||"On file"}:{s:"missing",t:"Not on file yet"};
function hoursYear(doc){const y=yearStart();const hs=(doc.hours||[]).filter(h=>(h.date||"")>=y);return {approved:hs.filter(h=>h.approved).reduce((a,h)=>a+(+h.hours||0),0),fulton:hs.filter(h=>!h.approved).reduce((a,h)=>a+(+h.hours||0),0),list:hs}}
const r1=n=>Math.round(n*10)/10;
function fileList(doc,fids,name){return (fids||[]).map(f=>{const m=(doc.files||{})[f]||(doc.shared||{})[f];return m?`<button class="linkbtn" data-stopen="${H(f)}" data-who="${H(name||doc.name)}">${H(m.link?"In Drive, "+m.name:m.name||"File")}</button>`:""}).join("")}
// a record's own files, and a shared one it uses, such as an in-house class roster
const allFids=doc=>[...Object.keys(doc.files||{}),...Object.keys(doc.shared||{})];
const fileMeta=(doc,f)=>(doc.files||{})[f]||(doc.shared||{})[f]||{};

/* ---------- files ---------- */
function pickFile(){return new Promise(res=>{const i=document.createElement("input");i.type="file";i.accept="image/*,application/pdf";i.style.display="none";document.body.appendChild(i);i.onchange=()=>{res(i.files[0]||null);i.remove()};i.click()})}
const b64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]||"");r.onerror=()=>no(new Error("The file could not be read."));r.readAsDataURL(f)});
// a certificate or form, kept in the school's Google Drive, then placed where it belongs on the record
async function uploadTo(name,place){const f=await pickFile();if(!f)return null;if(f.size>15e6){toast("That file is larger than 15 MB. Save it smaller or as fewer pages.");return null}
  let fn=f.name||"file.jpg";if(!/\.(pdf|jpe?g|png|webp|heic)$/i.test(fn))fn+=(/pdf/.test(f.type)?".pdf":".jpg");
  progress("Keeping the file");try{const r=await api("upload",{name,filename:fn,data:await b64(f),label:place&&place.label});
    st.doc=r.doc;place.add(st.doc,r.fid);await save(st.doc,"Kept.");return r.fid}catch(e){fail(e);return null}}
async function fileBlob(name,fid){const r=await fetch(window.FP_SERVER+"/api/staff/file",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({name,fid})});
  if(!r.ok){let m="";try{m=(await r.json()).error}catch(e){}throw new Error(m||"The file could not be opened.")}return r.blob()}
async function openFile(name,fid){const doc=st.doc&&st.doc.name===name?st.doc:(st.people||[]).find(p=>p.name===name)||{};const m=(doc.files||{})[fid]||(doc.shared||{})[fid]||{};
  if(m.link){window.open(m.link,"_blank","noopener");return}
  progress("Opening the file");try{const b=await fileBlob(name,fid);showFile(b,m.name||"file")}catch(e){fail(e)}}
function showFile(blob,name){const u=URL.createObjectURL(blob);const v=document.createElement("div");v.className="stview";v.setAttribute("role","dialog");
  v.innerHTML=`<div><div class="bar"><b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${H(name)}</b><span class="actions" style="margin:0"><a class="btn small ghost" href="${u}" download="${H(name)}">Download</a><button class="btn small" data-stclose="1">Close</button></span></div>${/pdf/.test(blob.type)?`<iframe src="${u}" title="${H(name)}"></iframe>`:`<img src="${u}" alt="${H(name)}">`}</div>`;
  document.body.appendChild(v);const t=$("#toast");if(t)t.hidden=true;v.addEventListener("click",e=>{if(e.target===v||e.target.closest("[data-stclose]")){v.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}})}

/* ---------- the pages ---------- */
T.render=async function(v){const m=$("#main");if(!m)return;const my=++RT;
  try{await boot()}catch(e){m.innerHTML=head("Educators","Educators")+card("Not open yet",`<div class="hint">${H(e.message||"This part of TREE is not open yet.")}</div>`);return}
  try{
    if(v==="stteam")return await pageTeam(my);
    if(v==="strec")return await pageRecords(my);
    if(v==="stnew")return await pageNew(my);
    if(v==="stpd")return await pagePd(my);
    if(v==="sthb")return await pageHb(my);
    if(v==="st27")return await page27(my);
    if(v==="stdrill")return await pageDrills(my);
    if(v==="stfiles")return await pageFiles(my);
    // growth, the journal, check-ins, Proud Moments and PD days live in the second half of this file
    if(window.TreeGrowth&&TreeGrowth.views.includes(v))return await TreeGrowth.render(v,my);
  }catch(e){m.innerHTML=head("Educators","Educators")+card("This page could not open",`<div class="hint warnline">${H(e.message||"Check the connection, then try again.")}</div>`)}};
// only the page opened last draws, so a slow page never covers the one the educator moved to
let RT=0;
const draw=(my,h)=>{if(my!==RT)return;const m=$("#main");if(!m)return;const y=window.scrollY;m.innerHTML=h;if(T._keep){window.scrollTo(0,y);T._keep=false}};
const redraw=()=>{T._keep=true;T.render(view)};
// what the growth pages share with these
T._={api,fail,H,card,chip,head,md,mdBlocks,plain,report,out,draw:(my,h)=>draw(my,h),isCur:my=>my===RT,redraw,boot:()=>B,reboot:()=>boot(true),st,fd,fms,today,meName,D,P,loadPerson,loadPd,pickFile,b64,addMonths,addDays,daysTo,hourText:h=>hourText(h),yearStart};

/* the director's list of every educator */
async function pageTeam(my){if(!D())return pageRecords(my);await loadPeople();const ps=st.people;
  const rows=ps.map(p=>{const sts=itemsFor(p).map(it=>itemState(it,(p.items||{})[it.k]).s);const ok=sts.filter(s=>s==="ok").length,soon=sts.filter(s=>s==="soon").length,outn=sts.filter(s=>s==="out").length;
    return `<tr data-stperson="${H(p.name)}" style="cursor:pointer"><td><b>${H(p.name)}</b>${p.newHire?` ${chip("soonish","New, New Educator section only")}`:p.newEd?` ${chip("soonish","New educator")}`:""}</td><td>${H(p.role)}</td><td>${H(p.room?p.room+" Class":"")}</td>
      <td>${ok} of ${itemsFor(p).length} in place${soon?` ${chip("soon",soon+" to renew")}`:""}${outn?` ${chip("out",outn+" expired")}`:""}</td><td>${H(fluState(p).t)}</td></tr>`}).join("");
  const opened=Object.entries(B.open).filter(([,v])=>v).map(([k])=>({records:"records pages",pd:"the PD library",handbook:"the Teacher Policies and Procedures",newed:"the New Educator section"}[k]));
  draw(my,head("Educators","Educators",`Each educator's records and certificates, dates only and never health details. ${opened.length?"Open to educators, "+H(kList(opened))+".":"Only you see these pages until you turn them on in Settings."}`)+
    card("Every educator",`${ps.length?`<div class="tablewrap"><table class="grid2" style="min-width:620px"><thead><tr><th>Educator</th><th>Role</th><th>Class</th><th>Records</th><th>Flu shot this season</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty">No educator has a sign-in yet.</div>`}
      <div class="hint" style="margin-top:6px">Tap an educator to open their records page.</div>`,printBar("team"))+
    addNewHtml()+groupHtml())}
function addNewHtml(){const names=B.people||[];
  return card("Add a new educator",st.adding?`<div class="hint">They sign in with their first name before their first day and reach only the New Educator section. You turn on full access once their clearances are in.</div>
    <div class="kfields"><label>First name<input type="text" id="stn-name" placeholder="First name"></label><label>Class<select id="stn-room"><option value="">No Class</option>${CLASSROOMS.map(r=>`<option>${H(r)}</option>`).join("")}</select></label>
      <label>Role<select id="stn-role"><option value="educator">Educator</option><option value="apprentice">Apprentice</option></select></label><label>Start date<input type="date" id="stn-start"></label>
</div><div class="hint">${B.goTo?H(B.goTo)+" is the go-to person for every new educator.":"Name the go-to person for new educators in Settings."}</div>
    <div class="actions"><button class="btn small" data-stnew="add">Add</button><button class="linkbtn" data-stnew="cancel">Cancel</button></div>`:`<div class="actions" style="margin:0"><button class="btn small ghost" data-stnew="open">Add a new educator</button></div>`)}
function groupHtml(){const names=B.people||[];
  return card("Record a training for a group",st.group?`<div class="hint">For an in-house Pediatric First Aid and CPR class, or the yearly emergency and disaster plan training. Everyone chosen gets the same date, and the class roster is kept with each record.</div>
    <div class="kfields"><label>Training<select id="stg-item">${ITEMS().filter(i=>["cpr","eplan","hsa","hs16","mandated","water","activesup"].includes(i.k)).map(i=>`<option value="${i.k}">${H(i.label)}</option>`).join("")}</select></label><label>Date<input type="date" id="stg-date" value="${today()}"></label></div>
    <div class="chips" style="margin-top:8px">${names.map(n=>`<button class="chip on" type="button" data-stgname="${H(n)}">${H(n)}</button>`).join("")}</div>
    <div class="actions"><span class="cnt" id="stg-roster">No roster yet</span><button class="btn small ghost" data-stgroup="roster">Upload the roster</button><button class="btn small" data-stgroup="save">Record for everyone chosen</button><button class="linkbtn" data-stgroup="cancel">Cancel</button></div>`:
    `<div class="actions" style="margin:0"><button class="btn small ghost" data-stgroup="open">Record a group training</button></div>`)}

/* a records page, the educator's own or, for the director, anyone's */
async function pageRecords(my){const who=D()&&st.who?st.who:meName();if(!st.doc||st.doc.name!==who||!T._keep)await loadPerson(who);const p=P(),dir=D(),mine=who===meName();
  const pr=p.profile||{};const lead=B.school.remindDays||30;
  const itemsHtml=itemsFor(p).map(it=>{const r=(p.items||{})[it.k]||{};const s=itemState(it,r);
    return `<div class="strow"><div class="sttop"><b>${H(it.label)}</b>${chip(s.s,s.t)}</div><div class="cnt">${it.note?H(it.note)+". ":""}${it.fulton?"A Fulton training":`<a href="${REGS}" target="_blank" rel="noopener">${H(it.reg)}</a>`}</div>${it.fulton?asLinks():""}
      <div class="kfields"><label>Date${it.k==="hs16"?" completed":""}<input type="date" data-stitem="${it.k}" data-f="date" value="${H(r.date||"")}"></label>${it.months||it.k==="water"?`<label>Expires, if the card says<input type="date" data-stitem="${it.k}" data-f="expires" value="${H(r.expires||"")}"></label>`:""}</div>
      <div class="stfiles">${fileList(p,r.files,who)}<button class="btn small ghost" data-stup="item|${it.k}">Upload a photo or PDF</button>${dir?`<button class="linkbtn" data-stlink="item|${it.k}">Link one in Drive</button>`:""}</div></div>`}).join("");
  const fl=fluState(p),f=(p.flu||{})[fl.season]||{};
  const imm=`<div class="strow"><div class="sttop"><b>Flu vaccine, ${H(fl.season)} to ${H(+fl.season+1)}</b>${chip(fl.s,fl.t)}</div><div class="cnt">Due each year between August 1 and December 1.</div>
      <div class="kfields"><label>On file<select data-stflu="status"><option value="">Not yet</option>${[["vaccinated","Flu shot"],["declined","Declined in writing"],["medical","Medical exemption"]].map(([k,l])=>`<option value="${k}" ${f.status===k?"selected":""}>${l}</option>`).join("")}</select></label><label>Date<input type="date" data-stflu="date" value="${H(f.date||"")}"></label></div>
      <div class="stfiles">${fileList(p,f.files,who)}<button class="btn small ghost" data-stup="flu|${fl.season}">Upload a photo or PDF</button></div></div>
    ${["pertussis","measles"].map(k=>{const r=(p.once||{})[k]||{};const s=onceState(r);return `<div class="strow"><div class="sttop"><b>${k==="pertussis"?"Pertussis, whooping cough":"Measles"}</b>${chip(s.s,s.t)}</div><div class="cnt">Recorded once.</div>
      <div class="kfields"><label>On file<select data-stonce="${k}" data-f="status"><option value="">Not yet</option>${[["record","Record of immunization"],["immune","Immunity shown"],["medical","Medical exemption"],["statement","Written statement while gathering records"]].map(([v,l])=>`<option value="${v}" ${r.status===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Date<input type="date" data-stonce="${k}" data-f="date" value="${H(r.date||"")}"></label></div>
      <div class="stfiles">${fileList(p,r.files,who)}<button class="btn small ghost" data-stup="once|${k}">Upload a photo or PDF</button></div></div>`}).join("")}`;
  const u=p.units||{},sem=semester(),semRec=((u.semesters||{})[sem])||{};const below=u.completed!==undefined&&u.completed!==""&&Number(u.completed)<12;
  const units=`<div class="kfields"><label>Early childhood units completed<input type="number" min="0" max="200" step="0.5" data-stunits="completed" value="${H(u.completed??"")}"></label></div>
    ${below?`<div class="strow"><div class="sttop"><b>Proof of enrollment, ${H(semLabel(sem)||"this semester")}</b>${(semRec.files||[]).length?chip("ok","On file"):chip(sem?"soon":"missing",sem?"Upload this semester":"Next semester")}</div>
      <div class="cnt">Below twelve units, upload proof of enrollment each semester until you reach twelve.</div>${sem?`<div class="stfiles">${fileList(p,semRec.files,who)}<button class="btn small ghost" data-stup="sem|${sem}">Upload proof of enrollment</button></div>`:""}</div>`:""}
    <div class="stfiles">${fileList(p,u.files,who)}<button class="btn small ghost" data-stup="units|">Upload transcripts</button></div>`;
  const hy=hoursYear(p);
  const hours=`<div class="hint">Only courses from Department-approved sources count toward the 12 continuing hours required each year from October 1, 2027. Licensing at Fulton, PD modules and PD days count toward Fulton's own professional development hours.</div>
    <div class="actions"><span class="stchip ${hy.approved>=12?"ok":"missing"}">${r1(hy.approved)} of 12 approved hours this school year</span><span class="stchip missing">${r1(hy.fulton)} Fulton PD hours</span></div>
    ${hy.list.length?`<div class="tablewrap"><table class="grid2" style="min-width:520px"><thead><tr><th>Date</th><th>Course</th><th>Hours</th><th>Counts toward</th><th></th></tr></thead><tbody>${[...hy.list].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(h=>`<tr><td>${H(fd(h.date))}</td><td>${H(h.title)}<div class="stfiles">${fileList(p,h.files,who)}${h.by==="TREE"?"":`<button class="linkbtn" data-stup="hours|${H(h.id)}">Upload proof</button>`}</div></td><td>${H(h.hours)}</td><td>${h.approved?"The 12 approved hours":"Fulton PD hours"}</td><td>${h.by==="TREE"?"":`<button class="linkbtn" data-sthdel="${H(h.id)}">Remove</button>`}</td></tr>`).join("")}</tbody></table></div>`:""}
    <div class="kfields" style="margin-top:8px"><label>Course<input type="text" id="sth-title" placeholder="Name of the course"></label><label>Date<input type="date" id="sth-date" value="${today()}"></label><label>Hours<input type="number" id="sth-hours" min="0.25" step="0.25" value="1"></label></div>
    <label class="radio" style="margin-top:6px"><input type="checkbox" id="sth-ok"><span>From a Department-approved source</span></label>
    <div class="actions"><button class="btn small ghost" data-sthadd="1">Add the hours</button><span class="cnt">Then upload the certificate from the course's line.</span></div>`;
  const pcs=careFor(p)?((await loadPd().catch(()=>({licensing:[]}))).licensing||[]):[];const doneN=pcs.filter(x=>(p.pd&&p.pd.done||{})[x.id]).length;
  const focus=(p.focus||[]).filter(f=>!(f.educatorOk&&f.directorOk)).concat((p.focus||[]).filter(f=>f.educatorOk&&f.directorOk));
  const goTo=p.goTo||"",paired=p.paired||[];
  draw(my,`${head(mine?"My records":"Records",mine?"My records":p.name+"'s records",`Dates and certificates only, never health details. Only ${mine?"you":H(p.name)} and the director see this page. TREE reminds ${mine?"you":"them"} and the director ${H(lead)} days before anything expires.`)}
    ${!mine&&dir?`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-tview="stteam">‹ All educators</button></div>`:""}
    ${card("About",`<div class="cnt">${H([whoRole(p),roomName(p),pr.startDate?"Started "+fd(pr.startDate):"",pr.planHour?"Monday planning hour at "+hourText(pr.planHour):""].filter(Boolean).join(", "))}</div>
      ${goTo?`<div style="margin-top:6px">Go-to person, <b>${H(goTo)}</b></div>`:""}${paired.length?paired.map(n=>`<div style="margin-top:6px">You are <b>${H(n.name)}</b>'s go-to person. <button class="btn small ghost" data-stgoto="${H(n.name)}">Note this week's check-in</button> <span class="cnt">${(n.checkins||[]).length?`Check-ins noted ${H((n.checkins||[]).map(c=>fd(c.week)).join(", "))}`:"No check-in noted yet"}</span></div>`).join(""):""}
      ${dir&&!mine?`<div class="actions">${(st.people||[]).find(x=>x.name===p.name&&x.newHire)?`<button class="btn small" data-staccess="full">Turn on full access to the school, the children and their work</button>`:""}<button class="btn small ghost" data-stfile="all">Print the file</button></div>`:""}`,printBar("record"))}
    ${card("Records and certificates",itemsHtml)}
    ${card("Immunizations",`<div class="hint">California requires everyone who works at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995. Records and exemptions are seen only by ${mine?"you":"the educator"} and the director.</div>${imm}`)}
    ${card("Early childhood units",units)}
    ${card("Continuing hours, this school year",hours)}
    ${careFor(p)?card("Licensing at Fulton",`<div class="actions" style="margin:0"><span class="stchip ${doneN===pcs.length&&pcs.length?"ok":"missing"}">${doneN} of ${pcs.length} pieces read</span><button class="btn small ghost" data-tview="stpd" data-stmod="licensing">Open the pieces</button></div>`):""}
    ${dir&&!mine?licensingListHtml(p,pcs):""}
    ${focus.length?card("Suggested Focus Until Next Time",`<div class="hint">A licensing item marked Let's review together becomes a suggested focus, which ${mine?"you":"the educator"} and the director confirm together.</div>${focus.map(f=>`<div class="strow"><div class="sttop"><b>${H(f.label)}</b>${f.educatorOk&&f.directorOk?chip("ok","Confirmed together"):chip("soonish","Suggested")}</div>
      <div class="actions" style="margin:0">${(mine||!dir)?(!f.educatorOk?`<button class="btn small ghost" data-stfocus="${H(f.id)}">Confirm</button>`:`<span class="cnt">You confirmed ${H(fms(f.educatorOk))}</span>`):`<span class="cnt">${f.educatorOk?"Educator confirmed":"Waiting for the educator"}</span>`}${dir?`<button class="btn small ghost" data-stfocus="${H(f.id)}">${f.directorOk?"Undo your confirmation":"Confirm as director"}</button>`:""}</div></div>`).join("")}${B.can&&B.can.growth?`<div class="actions" style="margin-top:6px"><button class="btn small ghost" data-tview="stci">Focus Until Next Time and check-ins</button></div>`:""}`):""}`)}
const whoRole=p=>p.role||(B.whosWho.find(w=>w.name===p.name)||{}).role||"Educator";
const roomName=p=>{const r=p.room||(B.whosWho.find(w=>w.name===p.name)||{}).room||(p.name===meName()?B.me.room:"");return r?r+" Class":""};
const hourText=h=>timeWords(h);
function licensingListHtml(p,pcs){const L=pcs.filter(x=>x.list==="title22"||x.list==="procedure");const rv=p.review||{};
  const row=x=>{const r=rv[x.id];const done=(p.pd&&p.pd.done||{})[x.id];
    return `<div class="strow"><div class="sttop"><b>${H(x.title)}</b><span class="actions" style="margin:0">${done?chip("ok","Read "+fms(done.at)):chip("missing","Not read yet")}</span></div><div class="cnt">${H(x.source)}</div>
      <div class="tseg" role="group" aria-label="${H(x.title)}"><button data-streview="${H(x.id)}|inplace" aria-pressed="${!!(r&&r.mark==="inplace")}">In place</button><button data-streview="${H(x.id)}|review" aria-pressed="${!!(r&&r.mark==="review")}">Let's review together</button></div>
      ${done&&done.answer?`<details><summary class="cnt">Their answer to the one question</summary><div class="stq" style="margin-top:6px;white-space:pre-line">${H(done.answer)}</div></details>`:""}</div>`};
  const marked=L.filter(x=>rv[x.id]).length;
  return card("Licensing and Safety",`<div class="hint">Go over the list together at the August PD day and when a new educator starts. Let's review together adds a suggested Focus Until Next Time, which you confirm together.</div>
    <h4 style="margin:10px 0 0">Title 22 requirements</h4>${L.filter(x=>x.list==="title22").map(row).join("")}<h4 style="margin:12px 0 0">Fulton procedures</h4>${L.filter(x=>x.list==="procedure").map(row).join("")}`,`${marked} of ${L.length} marked`)}

/* October 1, 2027 */
async function page27(my){if(!D())return pageRecords(my);await loadPeople();const ps=st.people.filter(p=>p.role!=="Kitchen"&&p.role!=="Office");
  const cpr=ITEMS().find(i=>i.k==="cpr");
  const rows=ps.map(p=>{const c=itemState(cpr,(p.items||{}).cpr),h=(p.items||{}).hs16||{},hy=hoursYear(p);return {p,c,h,hy}});
  const ready=rows.filter(r=>r.c.s!=="out"&&r.c.s!=="missing"&&r.h.date).length;
  draw(my,head("Educators","October 1, 2027",`According to CDSS PIN 26-11-CCP, AB 150 and AB 190 require every staff member who provides care to have current pediatric first aid and CPR and 16 hours of health and safety training, 15 hours plus 1 hour of nutrition, by October 1, 2027. From that day each of them completes at least 12 hours of continuing education every year from Department-approved sources.`)+
    card("Who is ready",`<div class="actions" style="margin:0 0 8px"><span class="stchip ${ready===rows.length?"ok":"soon"}">${ready} of ${rows.length} have both today</span></div>
      <div class="tablewrap"><table class="grid2" style="min-width:640px"><thead><tr><th>Educator</th><th>Pediatric first aid and CPR</th><th>16 hours of health and safety</th><th>Approved hours this year</th><th>Fulton PD hours</th></tr></thead><tbody>
      ${rows.map(r=>`<tr data-stperson="${H(r.p.name)}" style="cursor:pointer"><td><b>${H(r.p.name)}</b><div class="cnt">${H(r.p.role)}</div></td><td>${chip(r.c.s,r.c.t)}</td><td>${r.h.date?chip("ok","Done "+fd(r.h.date)):chip("missing","Not yet")}</td><td>${r1(r.hy.approved)} of 12</td><td>${r1(r.hy.fulton)}</td></tr>`).join("")}</tbody></table></div>
      <div class="hint" style="margin-top:6px">Only courses from Department-approved sources count toward the 12 hours. The required topics are emergency and disaster preparedness, building and premises safety including bodies of water and traffic, safe sleep, prevention of shaken baby syndrome and child maltreatment, transporting children safely, infectious diseases, food and allergy emergencies, hazardous materials and biocontaminants, and giving medication with family consent.</div>`,printBar("oct27")))}

/* the drill log */
async function pageDrills(my){if(!D())return pageRecords(my);await loadPeople();const L=st.drills||[];const last=L.map(d=>d.date).sort().pop();const due=last?addMonths(last,3):"";
  const late=!last||daysTo(due,today())>0;
  draw(my,head("Educators","Drills",`Practice drills happen at least every three months, under Health and Safety Code 1596.868 from January 1, 2027, and records of every drill are kept. TREE reminds you on a Monday when three months pass without one.`)+
    card("Log a drill",`<div class="kfields"><label>Date<input type="date" id="std-date" value="${today()}"></label><label>Time<input type="time" id="std-time"></label><label>Type<select id="std-type">${B.defs.drills.map(t=>`<option>${H(t)}</option>`).join("")}</select></label><label>Note<input type="text" id="std-note" placeholder="Optional, such as the time to evacuate"></label></div>
      <div class="actions"><button class="btn small" data-stdrill="add">Add to the log</button></div>`,last?(late?`<span class="warnline">The next drill was due by ${H(fd(due))}</span>`:`Next drill by ${H(fd(due))}`):"No drill in the log yet")+
    card("The drill log",L.length?`<div class="tablewrap"><table class="grid2" style="min-width:480px"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Logged by</th><th></th></tr></thead><tbody>${L.map(d=>`<tr><td>${H(fd(d.date))}${d.time?` <span class="cnt">${H(hourText(d.time))}</span>`:""}</td><td>${H(d.type)}</td><td>${H(d.note)}</td><td>${H(d.by)}</td><td><button class="linkbtn" data-stdrill="rm|${H(d.id)}">Remove</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No drills logged yet.</div>`,printBar("drills")))}

/* paper personnel files */
const printedAt=p=>p.printed&&p.printed.at;
const filed=p=>new Set((p.printed&&p.printed.files)||[]);
const newPages=p=>allFids(p).filter(f=>!fileMeta(p,f).link&&!filed(p).has(f));
async function pageFiles(my){if(!D())return pageRecords(my);await loadPeople();const need=st.people.filter(p=>newPages(p).length||(!printedAt(p)&&allFids(p).length));
  draw(my,head("Educators","Paper files",`The paper personnel file stays the official record kept at the school. Print the file gives a cover sheet listing every required record in the order of CCLD's records list, LIC 311A, with dates, renewal dates and whether each is in place, followed by every uploaded form and certificate. Social Security cards and driver's licenses stay in the paper file only.`)+
    card("Files that need a new page",need.length?need.map(p=>`<div class="strow"><div class="sttop"><b>${H(p.name)}</b><span class="cnt">${printedAt(p)?`Last printed ${H(fms(p.printed.at))}, ${newPages(p).length} new page${newPages(p).length===1?"":"s"}`:"Never printed from TREE"}</span></div>
      <div class="actions" style="margin:0">${printedAt(p)&&newPages(p).length?`<button class="btn small" data-stfile="new" data-who="${H(p.name)}">Print the new pages and cover sheet</button>`:""}<button class="btn small ghost" data-stfile="all" data-who="${H(p.name)}">Print the whole file</button></div></div>`).join(""):`<div class="empty">Every paper file is up to date.</div>`,printBar("files"))+
    card("Every educator",st.people.map(p=>`<div class="prow"><span><b>${H(p.name)}</b> <span class="cnt">${printedAt(p)?"Printed "+H(fms(p.printed.at)):"Not printed yet"}</span></span><span class="actions" style="margin:0"><button class="btn small ghost" data-stfile="all" data-who="${H(p.name)}">Print the file</button><button class="linkbtn" data-stfile="word" data-who="${H(p.name)}">Cover sheet in Word</button></span></div>`).join("")))}

/* the New Educator section */
async function pageNew(my){const dir=D();let who=meName();
  if(dir){await loadPeople();const news=st.people.filter(p=>p.newHire||p.newEd);if(!st.newWho||!news.some(p=>p.name===st.newWho))st.newWho=(news[0]||{}).name||"";who=st.newWho;
    if(!who){draw(my,head("Educators","New Educator","A new educator gets into TREE before their first day, with access only to the New Educator section. Add one from Educators.")+addNewHtml()+welcomeEditHtml());return}}
  if(!st.doc||st.doc.name!==who||!T._keep)await loadPerson(who);const p=P(),pr=p.profile||{};const pcs=await loadPd().catch(()=>({licensing:[],howto:[]}));
  const start=pr.startDate||"",wk=start?Math.max(1,Math.floor(daysTo(start,today())/7)+1):0;const starting=start?addMonths(start,2):"";
  const papers=PAPERS();const pw=p.paperwork||{};const links=B.school.formLinks||{};
  const paperRow=x=>{const r=pw[x.k]||{};const blank=links[x.k]||x.blank;
    const state=x.director?(r.done?chip("ok","Complete"):chip("missing","Not yet")):x.ack?((r.ack||(r.files||[]).length)?chip("ok",r.ack?"Read "+fms(r.ack):"Uploaded"):chip("missing","Not yet")):((r.files||[]).length?chip("ok","Uploaded"):chip("missing","Not yet"));
    return `<div class="strow"><div class="sttop"><b>${H(x.form)}</b><span class="actions" style="margin:0"><span class="cnt">${H(x.num)}</span>${state}</span></div><div class="cnt">${H(x.why)}</div>
      <div class="stfiles">${blank?`<a class="linkbtn" href="${H(blank)}" target="_blank" rel="noopener">Blank form</a>`:""}${x.director?(dir?`<label class="radio"><input type="checkbox" data-stdirpaper="${x.k}" ${r.done?"checked":""}><span>The invitation is complete</span></label>`:`<span class="cnt">The director marks this once your invitation is complete. Payroll and tax forms stay in QuickBooks.</span>`)
        :x.ack?`<button class="btn small ghost" data-tview="sthb">Read it and say so</button>${fileList(p,r.files,who)}<button class="linkbtn" data-stup="paper|${x.k}">Or upload the signed page</button>`
        :`${fileList(p,r.files,who)}<button class="btn small ghost" data-stup="paper|${x.k}">Upload the completed form</button>${!blank&&!x.director&&x.k!=="immun"?`<span class="cnt">${x.k==="livescan"?"The director arranges Live Scan.":"Ask the director for this form."}</span>`:""}`}</div></div>`};
  const idr=pw.idseen||{};
  const ck=checklist(p,pcs,start);const goTo=p.goTo||B.goTo||"";
  draw(my,`${head("New Educator",dir?who+", New Educator":"Welcome to Fulton",dir?`What ${H(who)} sees in their New Educator section, with your marks.`:"Onboarding is designed so you arrive on your first day knowing what to expect, with your paperwork in order and a colleague ready to support you. Everything you complete here lands on your records page, so nothing is entered twice.")}
    ${dir?`<div class="actions" style="margin:0 0 10px">${st.people.filter(x=>x.newHire||x.newEd).map(x=>`<button class="pill" aria-pressed="${x.name===who}" data-stnewwho="${H(x.name)}">${H(x.name)}</button>`).join("")}</div>`:""}
    ${card("Your first two months",`<div class="cnt">${H([start?"Start date "+fd(start):"The director adds your start date",starting?"Starting-point conversation with the director around "+fd(starting):""].filter(Boolean).join(". "))}${start?".":""}</div>
      ${goTo?`<div style="margin-top:6px"><b>${H(goTo)}</b> is the go-to person for every new educator. ${dir?"She answers their questions, walks them through paperwork and routines, and checks in briefly at the end of each of their first weeks. The educators on their Class team help on the floor every day.":`She answers your questions, walks you through paperwork and routines, and checks in with you briefly at the end of each of your first weeks. The educators on your Class team help you on the floor every day. You can bring ${H(goTo)} into your starting-point conversation if you like.`}</div>`:`<div class="cnt" style="margin-top:6px">The director names the go-to person in Settings.</div>`}
      ${dir?`<div class="actions">${(st.people.find(x=>x.name===who)||{}).newHire?`<button class="btn small" data-staccess="full" data-who="${H(who)}">Turn on full access to the school, the children and their work</button>`:`<span class="cnt">Full access is on.</span><button class="linkbtn" data-staccess="limit" data-who="${H(who)}">Limit to the New Educator section</button>`}</div>`:""}`)}
    ${card("First weeks checklist",`<ol style="margin:0;padding-left:22px">${ck.map(c=>`<li style="margin:6px 0"><span class="actions" style="margin:0;justify-content:space-between;display:flex;flex-wrap:wrap;gap:4px 10px"><span>${H(c.label)}</span>${c.done?chip("ok",c.note||"Done"):chip(c.note==="Due"?"soon":"missing",c.note||"Not yet")}</span>${c.dirTick&&dir?`<label class="radio"><input type="checkbox" data-stck="${c.key}" ${c.done?"checked":""}><span>Done</span></label>`:""}${c.goto&&!dir?"":c.goto?`<button class="linkbtn" data-stgoto="${H(who)}">Note this week's check-in</button>`:""}${c.links?asLinks():""}${c.view&&B.can&&B.can.growth?`<button class="linkbtn" data-tview="${c.view}">Open</button>`:""}</li>`).join("")}</ol>`,printBar("checklist"))}
    ${welcomeHtml(p,dir)}
    ${card("Who's who",`<div class="tablewrap"><table class="grid2" style="min-width:360px"><thead><tr><th>Name</th><th>Role</th><th>Class</th></tr></thead><tbody>${B.whosWho.map(w=>`<tr><td><b>${H(w.name)}</b></td><td>${H(w.role)}</td><td>${H(w.room?w.room+" Class":"")}</td></tr>`).join("")}</tbody></table></div>
      ${!dir?`<div class="actions">${(p.pd&&p.pd.read||{}).whoswho?chip("ok","Read"):`<button class="btn small ghost" data-stread="whoswho">I have read Who's who</button>`}</div>`:""}`)}
    ${card("Paperwork",`<div class="hint">Each form has a blank copy to download and print, and a place to upload the completed form as a photo or PDF. Uploads save to the school's Google Drive. Payroll and tax forms are completed in QuickBooks Workforce.</div>${papers.map(paperRow).join("")}
      <div class="strow"><div class="sttop"><b>Social Security card and driver's license</b>${idr.done?chip("ok","Seen and filed"):chip("missing","Not yet")}</div><div class="cnt">Shown to the director in person and copied for the paper personnel file only. They are never uploaded to TREE.</div>
        ${dir?`<label class="radio"><input type="checkbox" data-stdirpaper="idseen" ${idr.done?"checked":""}><span>Seen and filed</span></label>`:""}</div>`,printBar("paperwork"))}
    ${card("Immunizations",`<div class="hint">California requires everyone who works or volunteers at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995.</div>
      <ul style="margin:6px 0;padding-left:20px"><li>The flu vaccine is due each year between August 1 and December 1.</li><li>Someone still gathering records can work for up to 30 days after signing a written statement that they are immunized.</li><li>A physician's written statement can exempt someone for medical reasons or show existing immunity.</li><li>Someone can decline the flu vaccine in writing. This applies to the flu vaccine only.</li><li>Someone hired after December 1 and before August 1 does not need the flu vaccine in their first year.</li></ul>
      <div class="cnt">Records or exemptions are kept in the personnel file. In TREE they are seen only by you and the director.</div><div class="actions"><button class="btn small ghost" data-tview="strec">Add them on ${dir?"the":"your"} records page</button></div>`)}
    ${card("Trainings",`<ul style="margin:0;padding-left:20px"><li>Mandated reporter training within 90 days of hire, renewed every two years</li><li>Pediatric First Aid and CPR, which Fulton runs in house</li><li>Health and safety training, 16 hours, needed by every caregiving educator by October 1, 2027</li><li>Emergency and disaster plan training, before the first day of work</li><li>Healthy Schools Act training each year, for anyone who uses sanitizers or disinfectants</li><li>Water safety certificate, required of every educator because of creek walks</li><li>Licensing at Fulton, in the PD library, done in short pieces during nap</li></ul>
      <div class="actions"><button class="btn small ghost" data-tview="strec">Upload certificates</button><button class="btn small ghost" data-tview="stpd" data-stmod="licensing">Licensing at Fulton</button></div>`)}
    ${card("The New Educator sequence",seqHtml(wk,pcs,p),start?`Week ${Math.min(wk,8)} of 8`:"")}`)}
function welcomeHtml(p,dir){const sc=B.school;const lens=B.lens;
  return card("Welcome and philosophy",`${sc.welcome?`<div class="stmd" style="white-space:pre-line">${H(sc.welcome)}</div>`:dir?`<div class="hint">Write a short welcome below. Until then the page opens with the philosophy.</div>`:""}
    ${md(sc.philosophy||"")}
    ${lens&&lens.name?`<h4 style="margin:12px 0 4px">This year's lens, ${H(lens.name)}</h4><div class="stmd"><p>${H(lens.description)}</p></div>`:""}
    ${dir?welcomeEditInner():(p.pd&&p.pd.read||{}).welcome?`<div class="actions">${chip("ok","Read")}</div>`:`<div class="actions"><button class="btn small ghost" data-stread="welcome">I have read the welcome and philosophy</button></div>`}`)}
const welcomeEditInner=()=>`<details style="margin-top:10px"><summary class="linkbtn">Edit the welcome and philosophy</summary><label class="fld-label" style="margin-top:8px">Your welcome<textarea id="stw-welcome" rows="4">${H(B.school.welcome)}</textarea></label>
  <label class="fld-label">Philosophy, drawn from the Program Philosophy<textarea id="stw-phil" rows="10">${H(B.school.philosophy)}</textarea></label><div class="actions"><button class="btn small" data-stwsave="1">Save</button></div></details>`;
const welcomeEditHtml=()=>card("Welcome and philosophy",welcomeEditInner());
function checklist(p,pcs,start){const pw=p.paperwork||{},rd=(p.pd&&p.pd.read)||{},dn=(p.pd&&p.pd.done)||{};const lic=pcs.licensing||[],how=pcs.howto||[];
  const papersDone=PAPERS().filter(x=>!x.director&&x.k!=="immun").every(x=>((pw[x.k]||{}).files||[]).length||(x.ack&&(pw[x.k]||{}).ack))&&((p.items||{}).clearance||{}).date;
  const imm=((pw.immun||{}).files||[]).length||(((p.once||{}).pertussis||{}).status&&((p.once||{}).measles||{}).status);
  const licDone=lic.filter(x=>dn[x.id]).length,howDone=how.filter(x=>dn[x.id]).length;
  const L=lic.filter(x=>x.list==="title22"||x.list==="procedure");const marked=L.filter(x=>(p.review||{})[x.id]).length;
  const ci=(p.gotoCheckins||[]).length;const sp=start?addMonths(start,2):"";const C=B.defs.checklist;
  return [{label:C[0],done:!!papersDone},{label:C[1],done:!!imm},{label:C[2],done:!!rd.welcome},{label:C[3],done:!!rd.whoswho},{label:C[4],done:how.length&&howDone===how.length,note:`${howDone} of ${how.length}`},
    {label:C[5],done:!!(((p.items||{}).mandated||{}).files||[]).length},{label:C[6],done:lic.length&&licDone===lic.length,note:`${licDone} of ${lic.length}`},
    {label:"Licensing and safety review with the director",done:(L.length&&marked===L.length)||!!(p.checklist||{}).review8,note:`${marked} of ${L.length} marked`,dirTick:true,key:"review8"},
    {label:"Active Supervision Training",done:!!((p.items||{}).activesup||{}).date,note:((p.items||{}).activesup||{}).date?"Done "+fd(p.items.activesup.date):"Due",links:true},
    {label:"First weeks check-ins with "+(p.goTo||B.goTo||"the go-to person"),done:ci>=4,note:ci?`Noted ${ci===1?"once":ci+" times"}`:"Not yet",goto:true},
    {label:C[9],done:!!p.planStarted,note:p.planStarted?"Started":"Not yet",view:"stplan"},
    {label:C[10].replace(/^Starting-point conversation, scheduled two months from the start date/,"Starting-point conversation"),done:!!(p.checklist||{}).starting,note:sp?(sp<=today()?"Due now, from "+fd(sp):"Scheduled for "+fd(sp)):"Once the start date is set",dirTick:true,key:"starting"}]}
function seqHtml(wk,pcs,p){const dn=(p.pd&&p.pd.done)||{};const first=(pcs.licensing||[]).filter(x=>x.week===1);
  const g=B.can&&B.can.growth;
  const W=[[1,"Week one","Welcome and philosophy, Who's who, the TREE How To guides, and the first Licensing at Fulton pieces on supervision, with the CCLD active supervision video, ratios and emergencies.",[["stnew","Welcome"],["stpd|howto","TREE How To"],["stpd|licensing","Licensing at Fulton"]]],
    [2,"Week two","The rest of Licensing at Fulton, and keeping your first observations in TREE alongside your Class team.",[["stpd|licensing","Licensing at Fulton"]]],
    [3,"Weeks three and four","The Language of Learning, then the reflective journal, written weekly from here on.",[["stpd|m:language","The Language of Learning"],g?["stjour","Journal"]:null]],
    [5,"Weeks five and six","Documentation at Fulton, and writing your first curriculum plan with your team.",[["stpd|m:documentation","Documentation at Fulton"],["plans","Plans"]]],
    [7,"Weeks seven and eight","Beyond Discipline, the Educator Reflection and Growth Plan, and the starting-point conversation with the director at two months.",[["stpd|m:beyond","Beyond Discipline"],g?["stplan","Growth Plan"]:null,g?["stgrow","Starting point"]:null]]].map(w=>[w[0],w[1],w[2],w[3].filter(Boolean)]);
  const now=wk>0?W.filter(w=>w[0]<=wk).pop():null;
  return `<div class="hint">One short step at a time, mostly during nap.</div><div class="stseq" style="margin-top:8px">${W.map(w=>`<div class="${w===now?"now":""}"><div class="sttop" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${H(w[1])}</b>${w===now?chip("soonish","Now"):""}</div><div class="cnt">${H(w[2])}</div>
    <div class="actions" style="margin:4px 0 0">${w[3].map(([v,l])=>`<button class="btn small ghost" data-tview="${v.split("|")[0]}" ${v.includes("|")?`data-stmod="${v.split("|")[1]}"`:""}>${H(l)}</button>`).join("")}</div></div>`).join("")}</div>${g?"":`<div class="hint" style="margin-top:6px">The journal and the Growth Plan open once the director turns on growth in Settings.</div>`}`}

/* the PD library */
const MODULES=[["The Educator as Researcher","Fulton's project cycle from informal observation to reflection, and writing plans that grow from observation.",""],["Documentation at Fulton","Writing observations that separate noticing from wondering, and documentation that makes children's thinking visible.",""],
  ["The Language of Learning","Fulton's language parameters and the Effective Responses guide, describing and narrating in place of praise.",""],["Beyond Discipline","Relationship-based positive discipline, looking for the reason behind a behavior, and staying regulated so children can regulate.",""],
  ["The Home and School Partnership","Daily communication, conferences, and difficult conversations.",""],["Developmental Deep Dive","Development in the Twos and Threes and in the Fours and Fives, in a mixed-age community.",""],
  ["Spaces That Teach","The atelier, the outdoor classroom and the farm as spaces that teach.",""],["The Art of the Meeting","Meeting time as a place for listening and making space for others' words and bodies.",""],
  ["TREE How To","Short guides for keeping observations, writing plans and making documentation.","howto"],["Licensing at Fulton","Each Title 22 requirement and Fulton procedure in short pieces for nap time, with the official trainings linked.","licensing"]];
async function pagePd(my){if(window.TreeGrowth)await TreeGrowth.ready().catch(()=>{});const pcs=await loadPd();const mine=meName();if(!st.doc||st.doc.name!==mine)await loadPerson(mine);const p=P();const dn=(p.pd&&p.pd.done)||{};
  const pending=LS.get("tree.stmod","");if(pending){st.mod=pending;st.piece="";LS.set("tree.stmod",null)}
  if(st.piece){const x=[...pcs.licensing,...pcs.howto].find(y=>y.id===st.piece);if(x)return pieceHtml(my,x,dn)}
  if(st.mod&&st.mod.startsWith("m:")&&window.TreeGrowth)return TreeGrowth.module(my,st.mod.slice(2));
  if(st.mod){const list=pcs[st.mod]||[];const isLic=st.mod==="licensing";const nd=list.filter(x=>dn[x.id]).length;
    const grp=(t,f)=>{const g=list.filter(f);return g.length?`<h4 style="margin:10px 0 2px">${H(t)}</h4>${g.map(x=>`<div class="prow"><button class="linkbtn" style="font-size:15px;text-align:left" data-stpiece="${H(x.id)}">${H(x.title)}</button><span class="actions" style="margin:0"><span class="cnt">About ${x.minutes} minutes</span>${dn[x.id]?chip("ok","Read"):""}</span></div>`).join("")}`:""};
    draw(my,head("PD library",isLic?"Licensing at Fulton":"TREE How To",isLic?"Each Title 22 requirement and Fulton procedure in short pieces for nap time, about five to ten minutes each. Each piece gives a plain summary linked to the regulation, how Fulton carries it out, and one question answered in your own words, never scored. A finished piece shows as read on the licensing list, and its minutes count toward your yearly hours.":"Short guides for keeping observations, writing plans and making documentation. A finished guide counts toward your yearly hours.")+
      `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stmodback="1">‹ PD library</button></div>`+
      card(isLic?"The pieces":"The guides",isLic?grp("Title 22 requirements",x=>x.list==="title22")+grp("Fulton procedures",x=>x.list==="procedure")+grp("Official trainings",x=>x.list!=="title22"&&x.list!=="procedure"):grp("",()=>true),`${nd} of ${list.length} read`)+
      `<div class="actions">${printBar("pieces:"+st.mod)}</div>`);return}
  const sec=B.me.newEd||D();
  draw(my,head("PD library","PD library","Each module holds a short reading, examples from Fulton's own documentation, a practice to try in your own Class that week, and one reflection on what happened when you tried it. You choose the order. Finishing a module logs its hours on your records page.")+
    (sec?card("The New Educator sequence",seqHtml(B.me.newEd&&B.me.profile&&B.me.profile.startDate?Math.max(1,Math.floor(daysTo(B.me.profile.startDate,today())/7)+1):0,pcs,p),B.me.newEd?"Your first two months":"For new educators, their first two months"):"")+
    (window.TreeGrowth?await TreeGrowth.libraryHtml(pcs,dn):card("Modules",`<div class="stgrid">${MODULES.filter(m=>m[2]).map(([t,d,k])=>`<div class="stmod"><b>${H(t)}</b><div class="cnt">${H(d)}</div><div class="actions" style="margin:4px 0 0"><button class="btn small ghost" data-stmod="${k}">Open</button></div></div>`).join("")}</div>`)))}
function pieceHtml(my,x,dn){const d=dn[x.id];const list=st.pd[x.dir]||[];const i=list.indexOf(x),nx=list[i+1];
  const sec=h=>x.sections.find(s=>s.heading.toLowerCase().startsWith(h));const q=sec("one question");
  const hbs=x.handbook||[];
  draw(my,`<div class="head"><div><span class="eyebrow">${x.dir==="licensing"?"Licensing at Fulton":"TREE How To"}</span><h2 style="margin-top:4px">${H(x.title)}</h2><div class="sub">${H(x.source)}</div></div></div>
    <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stpiece="">‹ ${x.dir==="licensing"?"Licensing at Fulton":"TREE How To"}</button></div>
    <section class="card"><div class="actions" style="margin:0 0 6px">${x.links.map(l=>`<a class="btn small ghost" href="${H(l.url)}" target="_blank" rel="noopener">${H(l.text)}</a>`).join("")}<span class="cnt">About ${x.minutes} minutes</span>${d?chip("ok","Read "+fms(d.at)):""}</div>
      ${x.sections.filter(s=>s!==q).map(s=>`<h3 style="font-size:16px;margin:14px 0 6px">${H(s.heading)}</h3>${md(s.body)}`).join("")}
      ${hbs.length?`<div class="actions">${hbs.map(id=>`<button class="btn small ghost" data-hbopen="${H(id)}">In the Teacher Policies and Procedures, ${H(hbTitle(id))}</button>`).join("")}</div>`:""}</section>
    ${q?`<section class="card"><h3 style="font-size:17px">${H(q.heading)}</h3><div class="stq" style="margin:6px 0 10px">${md(q.body)}</div>
      <label class="fld-label">In your own words<textarea id="stp-answer" rows="4" placeholder="Never scored. Only you and the director read it.">${H(d?d.answer:"")}</textarea></label>
      <div class="actions"><button class="btn" data-stdone="${H(x.id)}">${d?"Save my answer":"Finish this piece"}</button>${nx?`<button class="btn small ghost" data-stpiece="${H(nx.id)}">Next, ${H(nx.title)}</button>`:""}</div></section>`:
      `<section class="card"><div class="actions" style="margin:0"><button class="btn" data-stdone="${H(x.id)}">${d?"Read":"Finish this guide"}</button>${nx?`<button class="btn small ghost" data-stpiece="${H(nx.id)}">Next, ${H(nx.title)}</button>`:""}</div></section>`}`);
  jumpTop()}
const HB_TITLES={"positive-discipline-for-educators":"Positive Discipline for Educators","emergency-and-disaster-plan":"Emergency and Disaster Plan","mandated-reporting":"Mandated Reporting","diapering":"Diapering","training-and-certification-requirements":"Training and Certification Requirements","changes-coming-october-1-2027":"Changes Coming October 1, 2027"};
const hbTitle=id=>(st.hb&&(st.hb.sections||[]).find(s=>s.id===id)||{}).title||HB_TITLES[id]||id.replace(/-/g," ");

/* the Teacher Policies and Procedures */
async function pageHb(my){const hb=await loadHb();const want=LS.get("tree.hb","");if(want){st.hbSec=want;st.hbEdit=false;LS.set("tree.hb",null)}const dir=D();const secs=(hb.sections||[]).filter(s=>!s.removed);
  if(!st.doc||st.doc.name!==meName())await loadPerson(meName()).catch(()=>{});
  const ack=((P().paperwork||{}).tppack||{}).ack;
  if(st.hbSec==="__new"&&dir)return draw(my,head("Teacher Policies and Procedures","A new section")+card("New section",hbEditor({id:"",title:"",body:""})));
  const s=secs.find(x=>x.id===st.hbSec);
  if(s){draw(my,`${head("Teacher Policies and Procedures",s.title,s.updatedAt?`Updated ${H(fms(s.updatedAt))}${s.updatedBy&&s.updatedBy!=="TREE"?" by "+H(s.updatedBy):""}.`:"")}
      <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-sthb="">‹ All sections</button></div>
      ${st.hbEdit&&dir?card("Edit",hbEditor(s)):`<section class="card">${md(s.body)}<div class="actions">${printBar("hbsec")}${dir?`<button class="btn small ghost" data-sthbedit="1">Edit</button>`:""}</div></section>`}`);jumpTop();return}
  const grp=(t,g)=>{const L=secs.filter(x=>x.group===g);return L.length?`<h4 style="margin:10px 0 2px">${H(t)}</h4>${L.map(x=>`<div class="prow"><button class="linkbtn" style="font-size:15px;text-align:left" data-sthb="${H(x.id)}">${H(x.title)}</button></div>`).join("")}`:""};
  const doc=hb.doc||{};
  draw(my,head("Teacher Policies and Procedures","Teacher Policies and Procedures","How Fulton works, for every educator. The new and revised sections are here in TREE, and the rest stays in the Google Doc until those sections are updated. The Google Doc stays as the archive.")+
    card("In TREE",grp("New sections","new")+grp("Revised sections","revised")+grp("Notes","note")+(dir?`<div class="actions"><button class="btn small ghost" data-sthb="__new">Add a section</button></div>`:""),printBar("hball"))+
    (doc.doc?card("The rest, in the Google Doc",`<div class="hint">These sections are read in the current Google Doc until they are updated here.</div>${(doc.sections||[]).map(x=>`<div class="prow"><a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a></div>`).join("")}<div class="actions"><a class="btn small ghost" href="${H(doc.doc)}" target="_blank" rel="noopener">Open the whole Google Doc</a></div>`):"")+
    card("Acknowledgment",ack?`<div class="actions" style="margin:0">${chip("ok","You read it "+fms(ack))}</div>`:`<div class="hint">Confirms you have read how Fulton works. It counts as your Teacher Policies and Procedures acknowledgment.</div><div class="actions"><button class="btn small" data-stread="handbook">I have read the Teacher Policies and Procedures</button></div>`))}
const hbEditor=s=>`<div class="hint">Write in plain text. A line starting with ### is a heading, a line starting with a dash is a list, and [words](link) is a link. Colons and dashes in sentences read as commas on screen.</div>
  <label class="fld-label">Title<input type="text" id="sthb-title" value="${H(s.title)}"></label><label class="fld-label">Text<textarea id="sthb-body" rows="18">${H(s.body)}</textarea></label>
  <div class="actions"><button class="btn" data-sthbsave="${H(s.id)}">Save</button><button class="linkbtn" data-sthbcancel="1">Cancel</button>${s.id?`<button class="linkbtn" data-sthbrm="${H(s.id)}">Remove this section</button>`:""}</div>`;

/* ---------- Settings, the director's ---------- */
T.settings=async function(el){try{await boot(true);await loadPeople();if(window.TreeGrowth)await TreeGrowth.ready().catch(()=>{})}catch(e){el.innerHTML=`<div class="lbl">Educators</div><div class="hint warnline">${H(e.message||"This part could not open.")}</div>`;return}
  const o=B.open,ps=st.people;const names=ps.map(p=>p.name);
  const sw=(k,l,d)=>`<div class="prow"><div><b>${H(l)}</b><div class="cnt">${H(d)}</div></div><div class="seg" role="group" aria-label="${H(l)}"><button data-stsw="${k}|1" aria-pressed="${!!o[k]}">On</button><button data-stsw="${k}|0" aria-pressed="${!o[k]}">Off</button></div></div>`;
  const rm=B.school.remind||{};
  el.innerHTML=`<div class="lbl">Educators</div><div class="hint">Each part shows only to you until you turn it on for educators. A new educator reaches only the New Educator section until you turn on full access.</div>
    ${sw("records","Records pages","Each educator's own dates, certificates, immunizations, units and hours")}${sw("pd","PD library","The modules, Licensing at Fulton and the TREE How To guides")}${sw("handbook","Teacher Policies and Procedures","The new and revised sections, readable by every signed-in educator")}${sw("newed","New Educator section","For new educators, from before their first day through their first two months")}${sw("growth","Growth","The continuum and evaluation, the journal, check-ins, the Growth Plan, Proud Moments and PD days, for educators and apprentices")}
    <div class="prow"><div><b>Go-to person</b><div class="cnt">One go-to person for every new educator. The Class team still helps on the floor.</div></div><select id="sts-goto"><option value="">None</option>${ps.filter(p=>p.role!=="Director"&&p.role!=="Kitchen"&&!(p.profile||{}).neverGoTo).map(p=>`<option ${B.school.goTo===p.name?"selected":""}>${H(p.name)}</option>`).join("")}</select></div>
    <div class="prow"><div><b>Records reminders</b><div class="cnt">Always on for every educator. Only you change them.</div></div><label class="cnt">Days ahead <input type="number" id="sts-days" min="7" max="120" value="${H(B.school.remindDays||30)}" style="width:70px"></label></div>
    <div class="chips" style="margin-top:6px">${Object.entries(B.defs.remind).map(([k,l])=>`<button class="chip ${rm[k]!==false?"on":""}" type="button" data-stremind="${k}">${H(l)}</button>`).join("")}</div>
    <div class="tablewrap" style="margin-top:12px"><table class="grid2" style="min-width:980px"><thead><tr><th>Educator</th><th>Role</th><th>Class</th><th>Monday planning hour</th><th>Check-ins</th><th>Journal</th><th>Start date</th></tr></thead><tbody>
    ${ps.map(p=>{const pr=p.profile||{};const staffRole=pr.role==="staff"||p.role==="Kitchen"||p.role==="Director";return `<tr><td><b>${H(p.name)}</b>${p.newHire?`<div class="cnt">New Educator section only</div>`:""}</td><td>${p.role==="Director"?"Director":`<select data-stprof="${H(p.name)}|role">${[["educator","Educator"],["apprentice","Apprentice"],["staff","Staff, records only"]].map(([v,l])=>`<option value="${v}" ${(pr.role||"educator")===v||(v==="educator"&&pr.role==="atelierista")?"selected":""}>${l}</option>`).join("")}</select>`}</td>
      <td><select data-stprof="${H(p.name)}|room"><option value="">None</option>${CLASSROOMS.map(r=>`<option value="${H(r)}" ${p.room===r?"selected":""}>${H(r)} Class</option>`).join("")}</select></td>
      <td>${staffRole?"":`<select data-stprof="${H(p.name)}|planHour"><option value="">Not set</option>${["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","14:00","15:00","16:00"].map(h=>`<option value="${h}" ${pr.planHour===h?"selected":""}>${hourText(h)}</option>`).join("")}</select>`}</td>
      <td>${staffRole?`<span class="cnt">Records only</span>`:`<select data-stprof="${H(p.name)}|checkin">${[["","From the planning hour"],["slot","In the planning hour"],["second","Short second Monday"],["asneeded","As needed"]].map(([v,l])=>`<option value="${v}" ${(pr.checkin||"")===v?"selected":""}>${l}</option>`).join("")}</select>`}</td>
      <td>${staffRole?"":`<select data-stprof="${H(p.name)}|journalEvery"><option value="1" ${+pr.journalEvery!==2?"selected":""}>Each week</option><option value="2" ${+pr.journalEvery===2?"selected":""}>Every other week, part time</option></select>`}</td>
      <td><input type="date" data-stprof="${H(p.name)}|startDate" value="${H(pr.startDate||"")}"></td></tr>`}).join("")}</tbody></table></div>
    ${window.TreeGrowth?TreeGrowth.settingsHtml(B):""}
    <details style="margin-top:10px"><summary class="linkbtn">Blank form links for the New Educator paperwork</summary><div class="hint" style="margin-top:6px">The state forms link to the CDSS forms page. Replace any link with the copy the school uses.</div>
      ${PAPERS().filter(x=>!x.director&&!x.ack&&x.k!=="immun").map(x=>`<label class="fld-label">${H(x.form)}, ${H(x.num)}<input type="url" data-stform="${x.k}" value="${H((B.school.formLinks||{})[x.k]||x.blank||"")}" placeholder="A link to the blank form"></label>`).join("")}
      <div class="actions"><button class="btn small" data-stforms="1">Save the links</button></div></details>
    <div class="actions"><button class="btn small ghost" data-streload="1">Read the PD pieces again</button><span class="cnt">After a new piece is added to the records.</span></div>`};

/* ---------- printouts and Word files ---------- */
function recordDocs(p){const pr=p.profile||{};const it=itemsFor(p).map(i=>{const r=(p.items||{})[i.k]||{};const s=itemState(i,r);return [i.label,fd(r.date),s.ex?fd(s.ex):"",s.t]});
  const fl=fluState(p),f=(p.flu||{})[fl.season]||{};const hy=hoursYear(p);
  return report(p.name+", records",[["Role",whoRole(p)],["Class",roomName(p)],["Start date",fd(pr.startDate)],["Printed",fd(today())]],[
    {t:"table",label:"Records and certificates",head:["Record","Date","Renews","In place"],rows:it,widths:[.42,.18,.18,.22]},
    {t:"table",label:"Immunizations",head:["Immunization","On file","Date"],rows:[["Flu vaccine, "+fl.season,fl.t,fd(f.date)],...["pertussis","measles"].map(k=>{const r=(p.once||{})[k]||{};return [k==="pertussis"?"Pertussis":"Measles",onceState(r).t,fd(r.date)]})]},
    {t:"text",label:"Early childhood units",text:(p.units&&p.units.completed!==undefined&&p.units.completed!=="")?`${p.units.completed} units completed.`:"Not recorded yet."},
    {t:"table",label:"Continuing hours, this school year",head:["Date","Course","Hours","Counts toward"],rows:hy.list.map(h=>[fd(h.date),h.title,String(h.hours),h.approved?"Approved hours":"Fulton PD hours"]),widths:[.16,.5,.1,.24]},
    {t:"text",text:`${r1(hy.approved)} of 12 approved hours and ${r1(hy.fulton)} Fulton PD hours this school year.`}])}
function coverDoc(p,only){const pw=p.paperwork||{};const yes=b=>b?"In place":"Not yet";
  const rows=PAPERS().map(x=>{const r=pw[x.k]||{};const n=(r.files||[]).length;return [x.form,x.num,r.done?fms(r.done):r.ack?fms(r.ack):n?fms(fileMeta(p,r.files[n-1]).at):"","",yes(r.done||r.ack||n)]});
  rows.push(["Social Security card and driver's license, seen and filed","Paper only",(pw.idseen||{}).done?fms(pw.idseen.done):"","",yes((pw.idseen||{}).done)]);
  const items=itemsFor(p).map(i=>{const r=(p.items||{})[i.k]||{};const s=itemState(i,r);return [i.label,i.reg,fd(r.date),s.ex?fd(s.ex):"",s.s==="ok"||s.s==="soon"?"In place":s.s==="out"?"Expired":"Not yet"]});
  const fl=fluState(p),f=(p.flu||{})[fl.season]||{};
  const imm=[["Flu vaccine, "+fl.season+" to "+(+fl.season+1),"H&S Code 1596.7995",fd(f.date),"Each year, August 1 to December 1",fl.s==="ok"?"In place":"Not yet"],...["pertussis","measles"].map(k=>{const r=(p.once||{})[k]||{};return [k==="pertussis"?"Pertussis":"Measles","H&S Code 1596.7995",fd(r.date),"Once",r.status?"In place":"Not yet"]})];
  return report("Personnel file, "+p.name,[["Class",roomName(p)],["Role",whoRole(p)],["Start date",fd((p.profile||{}).startDate)],["Cover sheet",fd(today())],only?["Pages",only]:null],[
    {t:"text",quiet:true,text:"The paper personnel file is the official record kept at the school, under Title 22, 101217. Records are listed in the order of CCLD's Records To Be Maintained at the Facility list, LIC 311A."},
    {t:"table",label:"Hiring forms",head:["Form","Number","Date","Renews","In place"],rows,widths:[.42,.16,.14,.1,.18]},
    {t:"table",label:"Records and certificates",head:["Record","Regulation","Date","Renews","In place"],rows:items,widths:[.36,.22,.13,.13,.16]},
    {t:"table",label:"Immunizations",head:["Immunization","Regulation","Date","Renews","In place"],rows:imm,widths:[.3,.22,.13,.19,.16]},
    {t:"text",label:"Uploaded forms and certificates",text:allFids(p).filter(f=>!fileMeta(p,f).link).map(f=>fileMeta(p,f).name).join(", ")||"None uploaded yet."}])}
// the cover sheet, with every uploaded form and certificate behind it, ready to file
async function printFile(name,mode){progress("Making the file");await loadPeople();const p=(st.people||[]).find(x=>x.name===name);if(!p){toast("That educator is not here.");return}
  if(mode==="word"){await out("word",[coverDoc(p)],"Personnel file cover, "+name);return}
  const fids=(mode==="new"?newPages(p):allFids(p).filter(f=>!fileMeta(p,f).link));
  let PL;try{PL=await loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js","PDFLib")}catch(e){toast("The PDF tool did not load. Check the connection.");return}
  try{const cover=await makePdf([coverDoc(p,mode==="new"?"The cover sheet and the new pages":"")],"cover.pdf",true);
    const doc=await PL.PDFDocument.create();const add=async bytes=>{const src=await PL.PDFDocument.load(bytes,{ignoreEncryption:true});(await doc.copyPages(src,src.getPageIndices())).forEach(pg=>doc.addPage(pg))};
    await add(await cover.arrayBuffer());let skipped=0;
    for(const f of fids){const m=fileMeta(p,f);try{const b=await fileBlob(name,f);const ab=await b.arrayBuffer();
      if(/pdf/.test(m.type||b.type))await add(ab);
      else{let img;if(/png/.test(m.type||b.type))img=await doc.embedPng(ab);else if(/jpe?g/.test(m.type||b.type))img=await doc.embedJpg(ab);else{const bmp=await createImageBitmap(b);const c=document.createElement("canvas");c.width=bmp.width;c.height=bmp.height;c.getContext("2d").drawImage(bmp,0,0);img=await doc.embedJpg(await (await new Promise(r=>c.toBlob(r,"image/jpeg",.9))).arrayBuffer())}
        const pg=doc.addPage([612,792]);const sc=Math.min(540/img.width,700/img.height,1);pg.drawImage(img,{x:(612-img.width*sc)/2,y:(792-img.height*sc)/2,width:img.width*sc,height:img.height*sc})}}
      catch(e){skipped++}}
    const blob=new Blob([await doc.save()],{type:"application/pdf"});
    await api("printed",{name,fids});await saveFile(blob,safeFile(`Personnel file ${name}${mode==="new"?" new pages":""} ${today()}`)+".pdf");
    if(skipped)setTimeout(()=>toast(`${skipped} file${skipped===1?"":"s"} could not be added. Open ${skipped===1?"it":"them"} from the records page to print.`),1500)}
  catch(e){fail(e)}}
async function printKind(k,word){const kind=word?"word":"pdf";
  if(k==="record")return out(kind,[recordDocs(P())],P().name+" records");
  if(k==="team"){await loadPeople();return out(kind,[report("Educators",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Educator","Role","Class","Records in place","Flu shot this season"],rows:st.people.map(p=>[p.name,p.role,p.room?p.room+" Class":"",itemsFor(p).filter(i=>{const s=itemState(i,(p.items||{})[i.k]).s;return s==="ok"}).length+" of "+itemsFor(p).length,fluState(p).t]),widths:[.22,.16,.16,.2,.26]}])],"Educators")}
  if(k==="oct27"){await loadPeople();const cpr=ITEMS().find(i=>i.k==="cpr");return out(kind,[report("October 1, 2027",[["Printed",fd(today())]],[{t:"text",text:"Current pediatric first aid and CPR and 16 hours of health and safety training by October 1, 2027, then at least 12 hours a year of continuing education from Department-approved sources."},{t:"table",label:"",noRule:true,head:["Educator","First aid and CPR","16 hours","Approved hours","Fulton PD hours"],rows:st.people.filter(p=>p.role!=="Kitchen"&&p.role!=="Office").map(p=>{const hy=hoursYear(p);const h=(p.items||{}).hs16||{};return [p.name,itemState(cpr,(p.items||{}).cpr).t,h.date?"Done "+fd(h.date):"Not yet",r1(hy.approved)+" of 12",String(r1(hy.fulton))]}),widths:[.2,.26,.2,.17,.17]}])],"October 1 2027")}
  if(k==="drills"){await loadPeople();return out(kind,[report("Drill log",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Date","Time","Type","Note","Logged by"],rows:(st.drills||[]).map(d=>[fd(d.date),d.time?hourText(d.time):"",d.type,d.note||"",d.by||""]),widths:[.18,.12,.18,.36,.16]}])],"Drill log")}
  if(k==="files"){await loadPeople();return out(kind,[report("Paper files",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Educator","Last printed","New pages"],rows:st.people.map(p=>[p.name,printedAt(p)?fms(p.printed.at):"Not yet",String(newPages(p).length)])}])],"Paper files")}
  if(k==="checklist"||k==="paperwork"){const p=P();const pcs=await loadPd();
    if(k==="checklist"){const ck=checklist(p,pcs,(p.profile||{}).startDate||"");return out(kind,[report("First weeks checklist, "+p.name,[["Start date",fd((p.profile||{}).startDate)]],[{t:"table",label:"",noRule:true,head:["","Step",""],rows:ck.map((c,i)=>[String(i+1),c.label,c.done?"Done":(c.note||"Not yet")]),widths:[.06,.66,.28]}])],"First weeks checklist "+p.name)}
    return out(kind,[report("New Educator paperwork",[["Educator",p.name]],[{t:"table",label:"",noRule:true,head:["Form","Number","Why it matters","Uploaded"],rows:PAPERS().map(x=>{const r=(p.paperwork||{})[x.k]||{};return [x.form,x.num,x.why,(r.files||[]).length||r.done||r.ack?"Yes":"Not yet"]}),widths:[.3,.14,.42,.14]},{t:"text",text:"Payroll and tax forms are completed in QuickBooks Workforce. Social Security cards and driver's licenses are shown in person and copied for the paper personnel file only."}])],"New Educator paperwork "+p.name)}
  if(k.startsWith("pieces:")){const d=k.slice(7);const pcs=await loadPd();const dn=((P().pd||{}).done)||{};return out(kind,[report(d==="licensing"?"Licensing at Fulton":"TREE How To",[["Educator",meName()]],[{t:"table",label:"",noRule:true,head:["Piece","Regulation","Minutes","Read"],rows:(pcs[d]||[]).map(x=>[x.title,x.source,String(x.minutes),dn[x.id]?fms(dn[x.id].at):""]),widths:[.4,.36,.1,.14]}])],d==="licensing"?"Licensing at Fulton":"TREE How To")}
  if(k==="hball"||k==="hbsec"){const hb=await loadHb();const secs=(hb.sections||[]).filter(s=>!s.removed&&(k==="hball"||s.id===st.hbSec));
    return out(kind,secs.map(s=>report(s.title,[["Teacher Policies and Procedures",""]].filter(x=>x[1]),mdBlocks(s.body))),k==="hball"?"Teacher Policies and Procedures":"Teacher Policies and Procedures, "+(secs[0]||{}).title)}}

/* ---------- taps ---------- */
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;st.who="";st.doc=null;st.mod="";st.piece="";st.hbSec="";st.hbEdit=false},true);
document.addEventListener("click",async e=>{const t=e.target.closest("[data-stperson],[data-stnew],[data-stgroup],[data-stgname],[data-stup],[data-stlink],[data-stopen][data-who],[data-sthadd],[data-sthdel],[data-streview],[data-stfocus],[data-stgoto],[data-staccess],[data-stfile],[data-stdrill],[data-stnewwho],[data-stdirpaper],[data-stck],[data-stread],[data-stwsave],[data-stmod],[data-stmodback],[data-stpiece],[data-stdone],[data-sthb],[data-sthbedit],[data-sthbsave],[data-sthbcancel],[data-sthbrm],[data-stprint],[data-stword],[data-stremind],[data-stforms],[data-streload],[data-stsw]");
  if(!t)return;const d=t.dataset;
  if(d.stprint||d.stword){e.preventDefault();progress("Making the file");await printKind(d.stprint||d.stword,!!d.stword);return}
  if(d.stmod!=null&&d.tview){LS.set("tree.stmod",d.stmod);return}
  if(VIEW_AS&&!d.stmod&&!d.stmodback&&!d.stpiece&&d.sthb==null){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.stperson){st.who=d.stperson;st.doc=null;goView("strec");return}
  if(d.stnew==="open"){st.adding=true;redraw();return}if(d.stnew==="cancel"){st.adding=false;redraw();return}
  if(d.stnew==="add"){const b={newName:$("#stn-name")?.value,room:$("#stn-room")?.value,role:$("#stn-role")?.value,startDate:$("#stn-start")?.value};
    try{await api("newhire",b);st.adding=false;toast(`${b.newName} can sign in now with their first name and choose a passcode. They see only the New Educator section.`);await boot(true);st.newWho=b.newName;redraw()}catch(er){fail(er)}return}
  if(d.stgroup==="open"){st.group=true;st.roster="";redraw();return}if(d.stgroup==="cancel"){st.group=false;redraw();return}
  if(d.stgname){t.classList.toggle("on");return}
  if(d.stgroup==="roster"){const f=await pickFile();if(!f)return;progress("Keeping the roster");try{const r=await api("upload",{name:meName(),school:true,filename:f.name||"roster.jpg",data:await b64(f),label:"Class roster"});st.roster=r.fid;const el=$("#stg-roster");if(el)el.textContent="Roster kept, "+(f.name||"roster");toast("Roster kept.")}catch(er){fail(er)}return}
  if(d.stgroup==="save"){const names=[...document.querySelectorAll("[data-stgname].on")].map(x=>x.dataset.stgname);if(!names.length){toast("Choose who took the training.");return}
    try{const r=await api("group",{item:$("#stg-item")?.value,date:$("#stg-date")?.value,names,roster:st.roster||""});st.group=false;toast(`Recorded for ${r.n} educator${r.n===1?"":"s"}.`);redraw()}catch(er){fail(er)}return}
  if(d.stopen&&d.who){openFile(d.who,d.stopen);return}
  if(d.stsw){const [k,v]=d.stsw.split("|");try{await api("school",{school:{open:{[k]:v==="1"}}});await boot(true);window.FP_STAFF&&(window.FP_STAFF.open=B.open);toast(v==="1"?"Turned on for educators.":"Only you see it now.");const el=$("#staffset");if(el)T.settings(el)}catch(er){fail(er)}return}
  if(d.stup){const [kind,key]=d.stup.split("|");const p=P();const who=p.name;
    const place={label:kind,add:(doc,fid)=>{
      if(kind==="item"){doc.items=doc.items||{};const r=doc.items[key]=doc.items[key]||{};r.files=[...(r.files||[]),fid];r.renewed=Date.now()}
      else if(kind==="flu"){doc.flu=doc.flu||{};const r=doc.flu[key]=doc.flu[key]||{};r.files=[...(r.files||[]),fid]}
      else if(kind==="once"){doc.once=doc.once||{};const r=doc.once[key]=doc.once[key]||{};r.files=[...(r.files||[]),fid]}
      else if(kind==="units"){doc.units=doc.units||{};doc.units.files=[...(doc.units.files||[]),fid]}
      else if(kind==="sem"){doc.units=doc.units||{};doc.units.semesters=doc.units.semesters||{};const r=doc.units.semesters[key]=doc.units.semesters[key]||{};r.files=[...(r.files||[]),fid];r.at=Date.now()}
      else if(kind==="paper"){doc.paperwork=doc.paperwork||{};const r=doc.paperwork[key]=doc.paperwork[key]||{};r.files=[...(r.files||[]),fid];r.at=Date.now()}
      else if(kind==="hours"){const h=(doc.hours||[]).find(x=>x.id===key);if(h)h.files=[...(h.files||[]),fid]}}};
    if(await uploadTo(who,place))redraw();return}
  if(d.stlink){const [kind,key]=d.stlink.split("|");const url=prompt("Paste the Google Drive link to the certificate");if(!url)return;
    try{const r=await api("link",{name:P().name,url,label:(ITEMS().find(i=>i.k===key)||{}).label||"Certificate"});st.doc=r.doc;const it=st.doc.items[key]=st.doc.items[key]||{};it.files=[...(it.files||[]),r.fid];await save(st.doc,"Linked.");redraw()}catch(er){fail(er)}return}
  if(d.sthadd){const p=P();const title=($("#sth-title")?.value||"").trim(),hours=+($("#sth-hours")?.value||0),date=$("#sth-date")?.value;if(!title||!(hours>0)){toast("Write the course and its hours.");return}
    p.hours=[...(p.hours||[]),{id:"h"+Date.now().toString(36),date,title,hours,approved:!!$("#sth-ok")?.checked,kind:"course",by:meName()}];await save(p,"Added.");redraw();return}
  if(d.sthdel){const p=P();p.hours=(p.hours||[]).filter(h=>h.id!==d.sthdel);await save(p,"Removed.");redraw();return}
  if(d.streview){const [piece,mark]=d.streview.split("|");const cur=((P().review||{})[piece]||{}).mark;try{st.doc=await api("review",{name:P().name,piece,mark:cur===mark?"":mark});toast(mark==="review"&&cur!==mark?"Marked, and added as a suggested Focus Until Next Time.":"Marked.");redraw()}catch(er){fail(er)}return}
  if(d.stfocus){try{st.doc=await api("focus",{name:P().name,id:d.stfocus});redraw()}catch(er){fail(er)}return}
  if(d.stgoto){try{await api("goto",{newName:d.stgoto});toast("This week's check-in is noted.");st.doc=null;redraw()}catch(er){fail(er)}return}
  if(d.staccess){const who=d.who||P().name;if(d.staccess==="full"&&!confirm(`Turn on full access for ${who}? They will see the school, the children and their work.`))return;try{await api("access",{name:who,full:d.staccess==="full"});toast(d.staccess==="full"?`${who} has full access now.`:`${who} sees only the New Educator section.`);await loadPeople();redraw()}catch(er){fail(er)}return}
  if(d.stfile){printFile(d.who||P().name,d.stfile);return}
  if(d.stdrill==="add"){try{const r=await api("drills",{add:{date:$("#std-date")?.value,time:$("#std-time")?.value,type:$("#std-type")?.value,note:$("#std-note")?.value}});st.drills=r.list;toast("Added to the drill log.");redraw()}catch(er){fail(er)}return}
  if(d.stdrill&&d.stdrill.startsWith("rm|")){if(!confirm("Remove this drill from the log?"))return;try{await api("drills",{remove:d.stdrill.slice(3)});redraw()}catch(er){fail(er)}return}
  if(d.stnewwho){st.newWho=d.stnewwho;st.doc=null;redraw();return}
  if(d.stdirpaper){const p=P();p.paperwork=p.paperwork||{};p.paperwork[d.stdirpaper]=t.checked?{done:Date.now(),by:meName()}:{};await save(p,t.checked?"Marked.":"Unmarked.");return}
  if(d.stck){const p=P();p.checklist=p.checklist||{};if(t.checked)p.checklist[d.stck]={at:Date.now(),by:meName()};else delete p.checklist[d.stck];await save(p);redraw();return}
  if(d.stread){try{st.doc=await api("read",{what:d.stread});toast("Thank you.");redraw()}catch(er){fail(er)}return}
  if(d.stwsave){try{await api("school",{school:{welcome:$("#stw-welcome")?.value||"",philosophy:$("#stw-phil")?.value||""}});await boot(true);toast("Saved.");redraw()}catch(er){fail(er)}return}
  if(d.stmod!=null){st.mod=d.stmod;st.piece="";if(view!=="stpd")goView("stpd");else{redraw();jumpTop()}return}
  if(d.stmodback){st.mod="";st.piece="";redraw();return}
  if(d.stpiece!=null){st.piece=d.stpiece;if(!d.stpiece){redraw()}else T.render("stpd");return}
  if(d.stdone){const a=$("#stp-answer");try{st.doc=await api("pd/done",{id:d.stdone,answer:a?a.value:""});toast("Finished. It shows as read, and its minutes count toward your hours.");redraw()}catch(er){fail(er)}return}
  if(d.sthb!=null){st.hbSec=d.sthb;st.hbEdit=false;T.render("sthb");return}
  if(d.sthbedit){st.hbEdit=true;redraw();return}if(d.sthbcancel){st.hbEdit=false;if(st.hbSec==="__new")st.hbSec="";redraw();return}
  if(d.sthbsave!=null){const title=($("#sthb-title")?.value||"").trim();if(!title){toast("Give the section a title.");return}
    try{const r=await api("handbook/save",{id:d.sthbsave||title,title,body:$("#sthb-body")?.value||""});await loadHb(true);st.hbSec=r.id;st.hbEdit=false;toast("Saved. The Google Doc stays as the archive.");T.render("sthb")}catch(er){fail(er)}return}
  if(d.sthbrm){if(!confirm("Remove this section from TREE? It stays in the backups."))return;try{await api("handbook/save",{id:d.sthbrm,remove:true});await loadHb(true);st.hbSec="";T.render("sthb")}catch(er){fail(er)}return}
  if(d.stremind){const rm=Object.assign({},B.school.remind);rm[d.stremind]=rm[d.stremind]===false;try{await api("school",{school:{remind:rm}});await boot(true);t.classList.toggle("on")}catch(er){fail(er)}return}
  if(d.stforms){const fl={};document.querySelectorAll("[data-stform]").forEach(x=>fl[x.dataset.stform]=x.value.trim());try{await api("school",{school:{formLinks:fl}});await boot(true);toast("Saved.")}catch(er){fail(er)}return}
  if(d.streload){try{const r=await api("reload");st.pd=null;st.hb=null;toast(`Read again, ${r.pieces} pieces.`)}catch(er){fail(er)}return}
},true);
// dates and choices save as they change
document.addEventListener("change",async e=>{const t=e.target;if(!t.closest||!t.closest("#main"))return;const d=t.dataset;
  if(t.id==="sts-goto"&&VIEW_AS)return;
  if(VIEW_AS&&(d.stitem||d.stflu||d.stonce||d.stunits||d.stprof))return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  if(d.stitem){const p=P();p.items=p.items||{};const r=p.items[d.stitem]=Object.assign({},p.items[d.stitem]);if(d.f==="date"&&r.date&&r.date!==t.value)r.renewed=Date.now();r[d.f]=t.value;r.by=meName();r.at=Date.now();await save(p,"Saved.");redraw();return}
  if(d.stflu){const p=P();const s=fluSeason();p.flu=p.flu||{};p.flu[s]=Object.assign({},p.flu[s],{[d.stflu]:t.value});await save(p,"Saved.");redraw();return}
  if(d.stonce){const p=P();p.once=p.once||{};p.once[d.stonce]=Object.assign({},p.once[d.stonce],{[d.f]:t.value});await save(p,"Saved.");redraw();return}
  if(d.stunits){const p=P();p.units=Object.assign({},p.units,{completed:t.value===""?"":Number(t.value)});await save(p,"Saved.");redraw();return}
  if(d.stprof){const [name,k]=d.stprof.split("|");try{await api("profile",{name,profile:{[k]:t.value}});toast("Saved.")}catch(er){fail(er)}return}
  if(t.id==="sts-days"){try{await api("school",{school:{remindDays:+t.value}});await boot(true);toast("Saved.")}catch(er){fail(er)}return}
  if(t.id==="sts-goto"){try{await api("school",{school:{goTo:t.value}});await boot(true);toast("Saved.")}catch(er){fail(er)}return}
});
})();
