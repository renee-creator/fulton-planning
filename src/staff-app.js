/* ---------- Educators in TREE ----------
   Each educator's records page, the director's view of every educator, October 1, 2027, the drill log, paper personnel
   files, the New Educator section, the PD library with Licensing at Fulton Community School and the TREE How To guides, and the Teacher
   Policies and Procedures, the Family Handbook, and Presenting. TREE loads this file only when someone opens one of these pages, and the server sends each
   record only to the educator it belongs to and the director. It uses TREE's own helpers, $, esc, toast, the PDF and
   Word makers, and the sign-in. */
(function(){
"use strict";
const T={};window.TreeStaff=T;
let B=null;
const st={who:"",doc:null,people:null,drills:null,pd:null,pol:{},polSec:"",polEdit:false,polHist:-1,fhYear:"",polAcks:null,piece:"",mod:"",newWho:"",adding:false,group:false,busy:"",viewer:null};
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
// seeing TREE as an educator shows that educator's own pages
const meName=()=>VIEW_AS?VIEW_AS.name:(B&&B.me&&B.me.name)||me();

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
.strow a,.stmd a,.pmd a{color:var(--moss)}
/* the policies, read in full */
.pmd{max-width:72ch}.pmd h4{font-size:16px;margin:16px 0 6px}.pmd h5{font-size:14.5px;margin:12px 0 4px}.pmd p{margin:0 0 9px;line-height:1.55}.pmd ul,.pmd ol{margin:0 0 10px;padding-left:22px}.pmd li{margin:3px 0;line-height:1.5}.pmd li.pmnest{list-style:none}
.pmd blockquote{margin:0 0 9px;padding-left:14px;border-left:3px solid var(--line)}.pmd table{border-collapse:collapse;width:100%;font-size:13.5px;margin:6px 0 12px}.pmd td,.pmd th{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.pmd .tw{max-width:100%;overflow-x:auto}.pmd figure{margin:8px 0}
details.stpart{border-top:1px solid var(--line);padding:8px 0}details.stpart>summary{cursor:pointer;padding:4px 0}details.stpart .prow{padding-left:12px}
.stgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.stmod{border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--paper);display:grid;gap:6px;align-content:start}
@media (max-width:760px){.stview{padding:0}.stview>div{height:100vh;border-radius:0}}
/* links and small buttons in lists are easy to tap on a phone */
@media (max-width:760px){body[data-sec="staff"] #main :is(.prow,.stfiles,.strow,.actions) :is(.linkbtn,a:not(.btn)){display:inline-block;padding-top:8px;padding-bottom:8px}}
`;document.head.appendChild(c)}
const chip=(s,t)=>`<span class="stchip ${s}">${H(t)}</span>`;
// the director's Edit on a page of school writing, opening the one editor with its history
const peBtn=(path,label,item)=>D()&&!(typeof VIEW_AS!=="undefined"&&VIEW_AS)?`<button class="btn small ghost" data-pageedit="${H(path)}"${item?` data-pageitem="${H(item)}"`:""}>${H(label||"Edit")}</button>`:"";
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
const ITEMS=()=>B.defs.items,PAPERS=()=>B.defs.papers;
// Fulton's own trainings are for everyone who cares for children, so the office and the kitchen do not see them
const careFor=p=>!["Office","Kitchen","Staff","Director"].includes(p.role||whoRole(p))&&!((p.profile||{}).role==="staff");
// an office member who also works as an educator supervises children, so Fulton's own training is hers too
const itemsFor=p=>ITEMS().filter(i=>(!i.fulton||careFor(p)||!!(p.profile||{}).supervises)&&(!i.chosen||!!((p.profile||{}).needs||{})[i.k]));
// each training links to the regulation it meets and to where it is taken. A link still to be checked says so to the director.
const toCheck=x=>x&&x.check&&D()?` <span class="warnline">Link to check.</span> <button class="linkbtn" data-stlinkok="${H(x.url)}">Confirmed</button>`:x&&x.confirmed&&D()?` <span class="cnt">Confirmed ${H(x.confirmed)}</span>`:"";
// the director opens a link, sees it is right and confirms it, and it stops saying Link to check
document.addEventListener("click",async e=>{const t=e.target.closest("[data-stlinkok]");if(!t||!D())return;e.preventDefault();e.stopPropagation();try{const r=await api("links/ok",{url:t.dataset.stlinkok});if(B&&B.defs)B.defs.items=r.items;toast("Confirmed.");redraw()}catch(er){toast(er&&er.message||"That did not save.")}},true);
const itemLinks=it=>[it.law?`<a href="${H(it.law.url)}" target="_blank" rel="noopener">The regulation, ${H(it.law.text)}</a>${toCheck(it.law)}`:"",it.course?`<a href="${H(it.course.url)}" target="_blank" rel="noopener">Take the training, ${H(it.course.text)}</a>${toCheck(it.course)}`:""].filter(Boolean).join(`<br>`);
// on the Official trainings piece, every training on the records list with its regulation and where it is taken
const trainingsCard=()=>{const its=((B.defs||{}).items||[]).filter(i=>i.course||i.law&&i.fulton);if(!its.length)return "";
  return card("Each training, its regulation and where it is taken",its.map(i=>`<div class="strow"><div class="sttop"><b>${H(i.label)}</b></div><div class="cnt">${i.note?H(i.note)+". ":""}${itemLinks(i)}</div></div>`).join(""))};
// the director marks the trainings she chooses for each person, such as the Red Cross water safety course
const chosenHtml=p=>{const ch=ITEMS().filter(i=>i.chosen);if(!ch.length)return "";const n=(p.profile||{}).needs||{};
  return `<div class="strow"><div class="sttop"><b>Trainings you choose for ${H(p.name)}</b></div>${ch.map(i=>`<div class="kfields"><label>${H(i.label)}<select data-stprof="${H(p.name)}|need:${H(i.k)}"><option value="0" ${n[i.k]?"":"selected"}>Not needed</option><option value="1" ${n[i.k]?"selected":""}>Needed</option></select></label></div>`).join("")}</div>`};
// the CCLD video and the active supervision handouts from the school's Google Drive
const asLinks=()=>{const a=B.activeSupervision;if(!a)return "";return `<div class="stfiles">${a.video?`<a class="linkbtn" href="${H(a.video.url)}" target="_blank" rel="noopener">Watch ${H(a.video.title)}</a>`:""}${(a.handouts||[]).map(x=>`<a class="linkbtn" href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>`).join("")}</div>`};
function itemState(it,rec){if(!rec||!rec.date)return it.fulton?{s:"soon",t:"Due",ex:""}:{s:"missing",t:"Not on file yet",ex:""};
  const ex=rec.expires||(it.months?addMonths(rec.date,it.months):"");if(!ex)return {s:"ok",t:"In place",ex:""};
  const left=daysTo(today(),ex),lead=B.school.remindDays||30;
  return left<0?{s:"out",t:"Expired "+fd(ex),ex}:left<=lead?{s:"soon",t:"Renew by "+fd(ex),ex}:{s:"ok",t:"Current to "+fd(ex),ex}}
function fluState(doc){const s=fluSeason(),f=(doc.flu||{})[s];const stt=(doc.profile||{}).startDate||"";
  if(f&&f.status)return {s:"ok",t:{vaccinated:"Flu shot on file",declined:"Declined in writing",medical:"Medical exemption on file"}[f.status]||"On file",season:s};
  if(stt&&stt>s+"-12-01"&&stt<(+s+1)+"-08-01")return {s:"ok",t:"Not needed in the first year",season:s};
  // from December 1 until the next season begins, a flu shot not on file is past due
  const t=today();return t>=s+"-12-01"?{s:"out",t:"Past due, it was due by December 1",season:s}:{s:"missing",t:"Due between August 1 and December 1",season:s}}
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
    if(v==="stnotices")return await pageNotices(my);
    if(v==="sthb"||v==="stfh")return await pagePol(my,POLV[v]);
    if(v==="st27")return await page27(my);
    if(v==="stdrill")return await pageDrills(my);
    if(v==="stfiles")return await pageFiles(my);
    if(v==="stformer")return await pageFormer(my);
    // growth, the journal, check-ins, Proud Moments and PD days live in the second half of this file
    if(window.TreeGrowth&&TreeGrowth.views.includes(v))return await TreeGrowth.render(v,my);
    // Presenting lives at the end of this file, after the growth pages
    if(v==="stpres"&&window.TreePres)return await TreePres.render(my);
  }catch(e){
    // a part the director has not opened yet says so plainly, never as an error
    if(e&&e.code==="not_allowed"&&/not open yet/i.test(e.message||"")){m.innerHTML=head("Educators","Educators")+card("Not open yet",`<div class="hint">${typeof isNewHire==="function"&&isNewHire()?"The director opens this before your first day.":"The director opens this part when it is ready."}</div>`);return}
    m.innerHTML=head("Educators","Educators")+card("This page could not open",`<div class="hint warnline">${H(e.message||"Check the connection, then try again.")}</div>`)}};
// only the page opened last draws, so a slow page never covers the one the educator moved to
let RT=0;
const draw=(my,h)=>{if(my!==RT)return;const m=$("#main");if(!m)return;const y=window.scrollY;m.innerHTML=h;restoreDrafts(m);if(T._keep){window.scrollTo(0,y);T._keep=false}};
/* typing is kept while someone moves to another page and back, until it is saved. Each box is known by the page, the
   person it is about and its own name. A box drawn again with the words already in it, because they were saved, lets
   the kept words go. Passcodes are never kept. */
const DRAFTS=new Map();
// the boxes that start something new are empty again once it is added. An agenda's blocks are kept by the agenda itself.
const CREATE=["sth-title","sth-hours","std-note","stn-name","gm-text","gpd-title","stpol-note","prn-title","prn-note","prr-url","prr-title","prr-note","prr-libnote","prd-url","prd-title","prd-note","prf-prompts","prf-checks"];
const draftKey=el=>{const own=el.id||Object.entries(el.dataset).map(([a,b])=>a+"="+b).join("&");if(!own||el.type==="password"||"gbk" in el.dataset)return "";
  const G=window.TreeGrowth&&TreeGrowth.st||{};const recs=view==="strec"||view==="stnew";
  return [view,recs?(view==="stnew"?st.newWho:st.who)||meName():"",view==="stpd"?st.piece+"/"+st.mod:"",POLV[view]?st.polSec+"@"+(view==="stfh"?st.fhYear:""):"",D()?G.sel:"",view==="stci"?G.ciWho:"",view==="stpdd"?G.pdSel:"",view==="stpres"?(window.TreePres&&TreePres.st.sel)||"":"",own].join("|")};
const typed=el=>el&&el.closest&&el.closest("#main")&&(el.tagName==="TEXTAREA"||(el.tagName==="INPUT"&&/^(text|search|url|number|)$/.test(el.type)));
document.addEventListener("input",e=>{if(typeof view==="undefined"||!STAFF_VIEWS.includes(view)||!typed(e.target)||VIEW_AS)return;const k=draftKey(e.target);if(k)DRAFTS.set(k,e.target.value)},true);
function restoreDrafts(m){if(!DRAFTS.size)return;m.querySelectorAll("textarea,input").forEach(el=>{if(!typed(el))return;const k=draftKey(el);if(!k||!DRAFTS.has(k))return;const v=DRAFTS.get(k);
  if(String(v).trim()===String(el.value).trim())DRAFTS.delete(k);else el.value=v})}
const redraw=()=>{T._keep=true;T.render(view)};
// what the growth pages share with these
T._={tapOnce:(t,f)=>tapOnce(t,f),api,fail,H,card,chip,head,md,mdBlocks,plain,report,out,draw:(my,h)=>draw(my,h),isCur:my=>my===RT,redraw,boot:()=>B,reboot:()=>boot(true),st,fd,fms,today,meName,D,P,loadPerson,loadPd,pickFile,b64,addMonths,addDays,daysTo,hourText:h=>hourText(h),yearStart};

/* the director's list of every educator */
async function pageTeam(my){if(!D())return pageRecords(my);await loadPeople();const ps=st.people;
  // a Fulton training not done yet is due, never to renew
  const rows=ps.map(p=>{const st0=itemsFor(p).map(it=>({it,s:itemState(it,(p.items||{})[it.k]).s,none:!((p.items||{})[it.k]||{}).date}));const sts=st0.map(x=>x.s);
    const ok=sts.filter(s=>s==="ok").length,due=st0.filter(x=>x.it.fulton&&x.none).length,soon=st0.filter(x=>x.s==="soon"&&!(x.it.fulton&&x.none)).length,outn=sts.filter(s=>s==="out").length;
    return `<tr data-stperson="${H(p.name)}" style="cursor:pointer"><td><b>${H(p.name)}</b>${p.newHire?` ${chip("soonish","New, New Educator section only")}`:p.newEd?` ${chip("soonish","New educator")}`:""}</td><td>${H(p.role)}</td><td>${H(p.room?p.room+" Class":"")}</td>
      <td>${ok} of ${itemsFor(p).length} in place${due?` ${chip("soon",due+" due")}`:""}${soon?` ${chip("soon",soon+" to renew")}`:""}${outn?` ${chip("out",outn+" expired")}`:""}</td><td>${H(fluState(p).t)}</td></tr>`}).join("");
  const opened=Object.entries(B.open).filter(([,v])=>v).map(([k])=>({records:"records pages",pd:"the PD library",handbook:"the Policies and Procedures",newed:"the New Educator section",family:"the Family Handbook"}[k])).filter(Boolean);
  draw(my,head("Educators","Educators",`Each educator's records and certificates, dates only and never health details. ${opened.length?"Open to educators, "+H(kList(opened))+".":"Only you see these pages until you turn them on in Settings."}`)+
    card("Every educator",`${ps.length?`<div class="tablewrap"><table class="grid2" style="min-width:620px"><thead><tr><th>Educator</th><th>Role</th><th>Class</th><th>Records</th><th>Flu shot this season</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty">No educator has a sign-in yet.</div>`}
      <div class="hint" style="margin-top:6px">Tap an educator to open their records page.</div>`,printBar("team"))+
    addNewHtml()+groupHtml())}
// the onboarding path a new educator receives, First weeks unless the director chooses another onboarding path
const onbSelect=(id,cur,attr)=>{const L=((pa.data||{}).paths||[]).filter(p=>p.onboarding);return L.length>1?`<label>Onboarding path<select ${attr||`id="${id}"`}>${L.map(p=>`<option value="${p.id==="firstweeks"?"":H(p.id)}" ${(cur||"")===(p.id==="firstweeks"?"":p.id)?"selected":""}>${H(p.title)}</option>`).join("")}</select></label>`:""};
function addNewHtml(){const names=B.people||[];
  return card("Add a new educator",st.adding?`<div class="hint">They sign in with their first name before their first day and reach only the New Educator section. You turn on full access once their clearances are in.</div>
    <div class="kfields"><label>First name<input type="text" id="stn-name" placeholder="First name"></label><label>Class<select id="stn-room"><option value="">No Class</option>${CLASSROOMS.map(r=>`<option>${H(r)}</option>`).join("")}</select></label>
      <label>Role<select id="stn-role"><option value="educator">Educator</option><option value="apprentice">Apprentice</option></select></label><label>Start date<input type="date" id="stn-start"></label><label class="radio" style="grid-column:span 2"><input type="checkbox" id="stn-exp"><span>An experienced educator, who also reads the part for experienced educators</span></label>
      ${onbSelect("stn-onb","")}</div><div class="hint">${B.goTo?H(B.goTo)+" is the go-to person for every new educator.":"Name the go-to person for new educators in Settings."}</div>
    <div class="actions"><button class="btn small" data-stnew="add">Add</button><button class="linkbtn" data-stnew="cancel">Cancel</button></div>`:`<div class="actions" style="margin:0"><button class="btn small ghost" data-stnew="open">Add a new educator</button></div>`)}
function groupHtml(){const names=B.people||[];
  return card("Record a training for a group",st.group?`<div class="hint">For an in-house Pediatric First Aid and CPR class, or the yearly emergency and disaster plan training. Everyone chosen gets the same date, and the class roster is kept with each record.</div>
    <div class="kfields"><label>Training<select id="stg-item">${ITEMS().filter(i=>["cpr","eplan","hsa","hs16","mandated","water","rcwater","activesup"].includes(i.k)).map(i=>`<option value="${i.k}">${H(i.label)}</option>`).join("")}</select></label><label>Date<input type="date" id="stg-date" value="${today()}"></label></div>
    <div class="chips" style="margin-top:8px">${names.map(n=>`<button class="chip on" type="button" data-stgname="${H(n)}">${H(n)}</button>`).join("")}</div>
    <div class="actions"><span class="cnt" id="stg-roster">No roster yet</span><button class="btn small ghost" data-stgroup="roster">Upload the roster</button><button class="btn small" data-stgroup="save">Record for everyone chosen</button><button class="linkbtn" data-stgroup="cancel">Cancel</button></div>`:
    `<div class="actions" style="margin:0"><button class="btn small ghost" data-stgroup="open">Record a group training</button></div>`)}

/* educators who have left Fulton, for the director only. Their records page, Growth Plan, journal, check-ins, Proud
   Moments and evaluations are kept here, and their observations, plans and documentation keep their name as written. */
async function pageFormer(my){if(!D())return pageRecords(my);const r=await api("former");st.former=r.people||[];const ps=st.former;const p=ps.find(x=>x.name===st.formerWho);
  const about=x=>[x.role,x.room?x.room+" Class":"",x.leftOn?"Last day "+fd(x.leftOn):""].filter(Boolean).join(", ");
  if(!p){draw(my,head("Educators","Former educators","Educators who have left our school. Each one's records page, Growth Plan, journal, check-ins, Proud Moments and evaluations wait here, and only you open them.")+
    card("Former educators",ps.length?ps.map(x=>`<div class="prow"><div><b>${H(x.name)}</b><div class="cnt">${H(about(x))}</div></div><button class="btn small ghost" data-stformer="${H(x.name)}">Open</button></div>`).join(""):`<div class="empty">No one has left our school yet. When an educator leaves, choose Leaving our school beside their name in Settings, under Sign-ins, and their records wait here.</div>`));return}
  const g=window.TreeGrowth&&TreeGrowth.formerHtml?await TreeGrowth.formerHtml(p.name).catch(e=>card("Growth",`<div class="hint warnline">${H(e.message||"This part could not open.")}</div>`)):"";
  if(my!==RT)return;
  draw(my,head("Former educators",p.name,`${H(about(p))}. Only you see these records.`)+`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stformer="">‹ Former educators</button></div>`+
    card("Records page",`<div class="cnt">Records and certificates, immunizations, units and continuing hours, kept as they were.</div><div class="actions"><button class="btn small ghost" data-stperson="${H(p.name)}">Open the records page</button></div>`)+g+
    card("Bring back",`<div class="hint">Bringing ${H(p.name)} back keeps all their history. They choose a new code at their next sign-in.</div><div class="actions" id="stbackrow"><button class="btn small ghost" data-stback="${H(p.name)}">Bring ${H(p.name)} back</button></div>`))}
const isFormerName=n=>(st.former||[]).some(x=>x.name===n);

/* a records page, the educator's own or, for the director, anyone's */
async function pageRecords(my){const who=D()&&st.who?st.who:meName();if(!st.doc||st.doc.name!==who||!T._keep)await loadPerson(who);const p=P(),dir=D(),mine=who===meName();
  const pr=p.profile||{};const lead=B.school.remindDays||30;
  const itemsHtml=itemsFor(p).map(it=>{const r=(p.items||{})[it.k]||{};const s=itemState(it,r);
    return `<div class="strow"><div class="sttop"><b>${H(it.label)}</b>${chip(s.s,s.t)}</div><div class="cnt">${it.note?H(it.note)+". ":""}${it.fulton?"A Fulton Community School training. ":""}${it.law||it.course?itemLinks(it):`<a href="${REGS}" target="_blank" rel="noopener">${H(it.reg)}</a>`}</div>${it.fulton?asLinks():""}
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
  const hours=`<div class="hint">Only courses from Department-approved sources count toward the 12 continuing hours required each year from October 1, 2027. Licensing at Fulton Community School, PD modules and PD days count toward our own professional development hours.</div>
    <div class="actions"><span class="stchip ${hy.approved>=12?"ok":"missing"}">${r1(hy.approved)} of 12 approved hours this school year</span><span class="stchip missing">${r1(hy.fulton)} hours of our own PD</span></div>
    ${hy.list.length?`<div class="tablewrap"><table class="grid2" style="min-width:520px"><thead><tr><th>Date</th><th>Course</th><th>Hours</th><th>Counts toward</th><th></th></tr></thead><tbody>${[...hy.list].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(h=>`<tr><td>${H(fd(h.date))}</td><td>${H(h.title)}<div class="stfiles">${fileList(p,h.files,who)}${h.by==="TREE"?"":`<button class="linkbtn" data-stup="hours|${H(h.id)}">Upload proof</button>`}</div></td><td>${H(h.hours)}</td><td>${h.approved?"The 12 approved hours":"Our PD hours"}</td><td>${h.by==="TREE"?"":`<button class="linkbtn" data-sthdel="${H(h.id)}">Remove</button>`}</td></tr>`).join("")}</tbody></table></div>`:""}
    <div class="kfields" style="margin-top:8px"><label>Course<input type="text" id="sth-title" placeholder="Name of the course"></label><label>Date<input type="date" id="sth-date" value="${today()}"></label><label>Hours<input type="number" id="sth-hours" min="0.25" step="0.25" value="1"></label></div>
    <label class="radio" style="margin-top:6px"><input type="checkbox" id="sth-ok"><span>From a Department-approved source</span></label>
    <div class="actions"><button class="btn small ghost" data-sthadd="1">Add the hours</button><span class="cnt">Then upload the certificate from the course's line.</span></div>`;
  const pcs=careFor(p)?((await loadPd().catch(()=>({licensing:[]}))).licensing||[]):[];const doneN=pcs.filter(x=>(p.pd&&p.pd.done||{})[x.id]).length;
  const focus=(p.focus||[]).filter(f=>!(f.educatorOk&&f.directorOk)).concat((p.focus||[]).filter(f=>f.educatorOk&&f.directorOk));
  const goTo=p.goTo||"",paired=p.paired||[];
  draw(my,`${head(mine?"My records":"Records",mine?"My records":p.name+"'s records",`Dates and certificates only, never health details. Only ${mine?"you":H(p.name)} and the director see this page. TREE reminds ${mine?"you":"them"} and the director ${H(lead)} days before anything expires.`)}
    ${!mine&&dir?`<div class="actions" style="margin:0 0 10px">${isFormerName(p.name)?`<button class="chip-btn back" data-tview="stformer">‹ ${H(p.name)}, a former educator</button>`:`<button class="chip-btn back" data-tview="stteam">‹ All educators</button>`}</div>`:""}
    ${card("About",`<div class="cnt">${H([whoRole(p),roomName(p),pr.startDate?"Started "+fd(pr.startDate):"",pr.planHour?"Monday planning hour at "+hourText(pr.planHour):""].filter(Boolean).join(", "))}</div>
      ${goTo?`<div style="margin-top:6px">Go-to person, <b>${H(goTo)}</b></div>`:""}${paired.length?paired.map(n=>`<div style="margin-top:6px">You are <b>${H(n.name)}</b>'s go-to person. <button class="btn small ghost" data-stgoto="${H(n.name)}">Note this week's check-in</button> <span class="cnt">${(n.checkins||[]).length?`Check-ins noted ${H((n.checkins||[]).map(c=>fd(c.week)).join(", "))}`:"No check-in noted yet"}</span></div>`).join(""):""}
      ${dir&&!mine?`<div class="actions">${(st.people||[]).find(x=>x.name===p.name&&x.newHire)?`<button class="btn small" data-staccess="full">Turn on full access to the school, the children and their work</button>`:""}<button class="btn small ghost" data-stfile="all">Print the file</button></div>`:""}`,printBar("record"))}
    ${card("Records and certificates",itemsHtml+(dir?chosenHtml(p):""))}
    ${await noticesRecCard(who,dir,mine)}
    ${await noticesNewCard(who,dir)}
    ${card("Immunizations",`<div class="hint">California requires everyone who works at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995. Records and exemptions are seen only by ${mine?"you":"the educator"} and the director.</div>${imm}`)}
    ${card("Early childhood units",units)}
    ${card("Continuing hours, this school year",hours)}
    ${p.policy?polRecordCard(p.policy,mine):""}
    ${careFor(p)?card("Licensing at Fulton Community School",`<div class="actions" style="margin:0"><span class="stchip ${doneN===pcs.length&&pcs.length?"ok":"missing"}">${doneN} of ${pcs.length} pieces read</span><button class="btn small ghost" data-tview="stpd" data-stmod="licensing">Open the pieces</button></div>`):""}
    ${dir&&!mine?licensingListHtml(p,pcs):""}
    ${focus.length?card("Suggested Focus Until Next Time",`<div class="hint">A licensing item marked Let's review together becomes a suggested focus, which ${mine?"you":"the educator"} and the director confirm together.</div>${focus.map(f=>`<div class="strow"><div class="sttop"><b>${H(f.label)}</b>${f.educatorOk&&f.directorOk?chip("ok","Confirmed together"):chip("soonish","Suggested")}</div>
      <div class="actions" style="margin:0">${(mine||!dir)?(!f.educatorOk?`<button class="btn small ghost" data-stfocus="${H(f.id)}">Confirm</button>`:`<span class="cnt">You confirmed ${H(fms(f.educatorOk))}</span>`):`<span class="cnt">${f.educatorOk?"Educator confirmed":"Waiting for the educator"}</span>`}${dir?`<button class="btn small ghost" data-stfocus="${H(f.id)}">${f.directorOk?"Undo your confirmation":"Confirm as director"}</button>`:""}</div></div>`).join("")}${B.can&&B.can.growth?`<div class="actions" style="margin-top:6px"><button class="btn small ghost" data-tview="stci">Focus Until Next Time and check-ins</button></div>`:""}`):""}`)}
const whoRole=p=>p.role||(B.whosWho.find(w=>w.name===p.name)||{}).role||"Educator";
const roomName=p=>{const r=p.room||(B.whosWho.find(w=>w.name===p.name)||{}).room||(p.name===meName()?B.me.room:"");return r?r+" Class":""};
const hourText=h=>clockTime(h);
function licensingListHtml(p,pcs){const L=pcs.filter(x=>x.list==="title22"||x.list==="procedure");const rv=p.review||{};
  const row=x=>{const r=rv[x.id];const done=(p.pd&&p.pd.done||{})[x.id];
    return `<div class="strow"><div class="sttop"><b>${H(x.title)}</b><span class="actions" style="margin:0">${done?chip("ok","Read "+fms(done.at)):chip("missing","Not read yet")}</span></div><div class="cnt">${H(x.source)}</div>
      <div class="tseg" role="group" aria-label="${H(x.title)}"><button data-streview="${H(x.id)}|inplace" aria-pressed="${!!(r&&r.mark==="inplace")}">In place</button><button data-streview="${H(x.id)}|review" aria-pressed="${!!(r&&r.mark==="review")}">Let's review together</button></div>
      ${done&&done.answer?`<details><summary class="cnt">Their answer to the one question</summary><div class="stq" style="margin-top:6px;white-space:pre-line">${H(done.answer)}</div></details>`:""}</div>`};
  const marked=L.filter(x=>rv[x.id]).length;
  return card("Licensing and Safety",`<div class="hint">Go over the list together at the August PD day and when a new educator starts. Let's review together adds a suggested Focus Until Next Time, which you confirm together.</div>
    <h4 style="margin:10px 0 0">Title 22 requirements</h4>${L.filter(x=>x.list==="title22").map(row).join("")}<h4 style="margin:12px 0 0">Our own procedures</h4>${L.filter(x=>x.list==="procedure").map(row).join("")}`,`${marked} of ${L.length} marked`)}

/* October 1, 2027 */
async function page27(my){if(!D())return pageRecords(my);await loadPeople();const ps=st.people.filter(p=>p.role!=="Kitchen"&&p.role!=="Office");
  const cpr=ITEMS().find(i=>i.k==="cpr");
  const rows=ps.map(p=>{const c=itemState(cpr,(p.items||{}).cpr),h=(p.items||{}).hs16||{},hy=hoursYear(p);return {p,c,h,hy}});
  const ready=rows.filter(r=>r.c.s!=="out"&&r.c.s!=="missing"&&r.h.date).length;
  draw(my,head("Educators","Coming October 1, 2027",`According to CDSS PIN 26-11-CCP, AB 150 and AB 190 require every staff member who provides care to have current pediatric first aid and CPR and 16 hours of health and safety training, 15 hours plus 1 hour of nutrition, by October 1, 2027. From that day each of them completes at least 12 hours of continuing education every year from Department-approved sources.`)+
    card("Who is ready",`<div class="actions" style="margin:0 0 8px"><span class="stchip ${ready===rows.length?"ok":"soon"}">${ready} of ${rows.length} have both today</span></div>
      <div class="tablewrap"><table class="grid2" style="min-width:640px"><thead><tr><th>Educator</th><th>Pediatric first aid and CPR</th><th>16 hours of health and safety</th><th>Approved hours this year</th><th>Our PD hours</th></tr></thead><tbody>
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
/* ---------- Required notices ----------
   Kept with the Policies and Procedures, for staff once the director marks them ready. Each notice links to its
   official agency page and its text is never copied. The new hire acknowledges the notices they receive, the yearly
   Workplace Know Your Rights notice is given in each person's language with the record kept here, and each person may
   name an emergency contact. The acknowledgments, the language and the emergency contact are seen only by that person
   and the director, and stay out of prints, readable copies, the staff room display, reminders and the Family page. */
const ntc={data:null,at:0,who:""};
async function loadNotices(who,force){if(force||!ntc.data||ntc.who!==who||Date.now()-ntc.at>60000){ntc.data=await api("notices",{name:who});ntc.who=who;ntc.at=Date.now()}return ntc.data}
const ntcStatus=x=>x.status==="unconfirmed"?`<span class="warnline">Unconfirmed. Open the official page to confirm. Checked ${H(fd(x.checked))}.</span>`:`<span class="cnt">Confirmed ${H(fd(x.checked))}.</span>`;
const ntcRow=x=>`<div class="strow"><div class="sttop"><b>${H(x.title)}</b></div><div class="cnt">${H(x.agency)}. ${H(x.when)}.</div><div class="cnt"><a href="${H(x.url)}" target="_blank" rel="noopener">The official page</a> ${ntcStatus(x)}</div></div>`;
const ntcLang=(who,cur,langs)=>`<label>Language for the Workplace Know Your Rights notice<select data-ntclang="${H(who)}">${langs.map(l=>`<option ${l===cur?"selected":""}>${H(l)}</option>`).join("")}</select></label>`;
function ntcEmergency(who,e,rules){e=e||{};return `<div class="strow"><div class="sttop"><b>Emergency contact</b>${e.at?chip("ok","Named "+fms(e.at)):chip("soon","Not named")}</div><div class="cnt">${H(rules.emergency)}.</div>
  <div class="kfields"><label>Name<input type="text" data-ntcem="name" value="${H(e.name||"")}"></label><label>Phone<input type="tel" data-ntcem="phone" value="${H(e.phone||"")}"></label><label>How they know you<input type="text" data-ntcem="relation" value="${H(e.relation||"")}"></label>
  <label>Tell them if you are arrested or detained at work<select data-ntcem="notify"><option value="" ${!e.notify?"selected":""}>Not chosen</option><option value="yes" ${e.notify==="yes"?"selected":""}>Yes</option><option value="no" ${e.notify==="no"?"selected":""}>No</option></select></label></div>
  <div class="actions"><button class="btn small" data-ntcemsave="${H(who)}">Save the emergency contact</button></div><div class="cnt">Seen only by you and the director.</div></div>`}
// the New Educator section lists what a new hire receives
async function noticesNewCard(who,dir){let d;try{d=await loadNotices(who)}catch(e){return ""}const mine=who===meName();
  const rows=d.defs.newhire.map(x=>{const a=(d.mine.acks||{})[x.id];
    return `<div class="strow"><div class="sttop"><b>${H(x.title)}</b>${x.how==="packet"?chip("ok","In the hiring packet"):a?chip("ok","Received "+fd(a.day)):chip("missing","Not yet")}</div><div class="cnt">${H(x.agency)}. ${H(x.when)}.</div>
      <div class="stfiles"><a class="linkbtn" href="${H(x.id==="kyr"?d.link:x.url)}" target="_blank" rel="noopener">The official page</a>${x.how==="packet"?`<span class="cnt">This is a filled-in form. It stays in the paper and QuickBooks Workforce hiring packet.</span>`:mine&&!a?`<button class="btn small" data-ntcack="${H(x.id)}">I have received this notice</button>`:""}${dir?" "+ntcStatus(x):""}</div></div>`}).join("");
  return card("Notices for a new educator",`${!d.ready?`<div class="hint warnline">A draft. Only you see it until you mark Required notices ready.</div>`:""}<div class="hint">Each notice comes from the agency that publishes it. Read it on the official page, or on the copy the director gives you, then say you have received it.</div>${rows}
    <div class="kfields" style="margin-top:8px">${ntcLang(who,d.mine.lang,d.defs.langs)}</div>${ntcEmergency(who,d.mine.emergency,d.defs.rules)}`)}
// the records page shows the dates, the language and the emergency contact
async function noticesRecCard(who,dir,mine){let d;try{d=await loadNotices(who)}catch(e){return ""}
  const acks=d.defs.newhire.filter(x=>x.how==="ack").map(x=>{const a=(d.mine.acks||{})[x.id];return `<div class="sttop"><span>${H(x.title)}</span>${a?chip("ok","Received "+fd(a.day)):chip("missing","Not yet")}</div>`}).join("");
  const yrs=Object.keys(d.mine.kyr||{}).sort().reverse().map(y=>{const k=d.mine.kyr[y];return `<div class="sttop"><span>Workplace Know Your Rights notice, ${H(y)}</span>${chip("ok",k.outside?"On file outside TREE":"Given "+fd(k.date))}</div>`}).join("")||`<div class="cnt">No yearly notice recorded yet.</div>`;
  return card("Required notices",`${!d.ready?`<div class="hint warnline">A draft. Only you see it until you mark Required notices ready.</div>`:""}<div class="strow">${acks}</div><div class="strow">${yrs}</div>
    <div class="kfields">${ntcLang(who,d.mine.lang,d.defs.langs)}</div>${ntcEmergency(who,d.mine.emergency,d.defs.rules)}`)}
async function pageNotices(my){const dir=D();const d=await loadNotices(meName(),true);if(my!==RT)return;const r=d.defs.rules;
  const y=String(new Date().getFullYear()+(new Date().getMonth()>=1?1:0)),cur=String(new Date().getFullYear());
  const people=d.people||[];
  const give=dir?card("The yearly Workplace Know Your Rights notice",`<div class="hint">${H(r.due)}. ${H(r.languages)}. ${H(r.ways)}. TREE keeps the record of who received it, when and how. A reminder or a page in TREE is never the notice itself. ${ntcStatus(r)}</div>
    <div class="tablewrap"><table class="grid2" style="min-width:420px"><thead><tr><th>Name</th><th>Language</th><th>Notice</th>${[y,cur].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<th>${H(v)}</th>`).join("")}</tr></thead><tbody>${people.map(p=>`<tr><td><label class="radio"><input type="checkbox" data-ntcgive="${H(p.name)}"><span>${H(p.name)}</span></label></td><td>${H(p.lang)}</td><td><a href="${H(p.link)}" target="_blank" rel="noopener">Open in ${H(p.lang)}</a></td>${[y,cur].filter((v,i,a)=>a.indexOf(v)===i).map(v=>{const k=(p.kyr||{})[v];return `<td>${k?(k.outside?"On file outside TREE":H(fd(k.date))):"Not yet"}</td>`}).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="kfields"><label>Year<select id="ntc-year">${[y,cur].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option>${H(v)}</option>`).join("")}</select></label><label>How it was given<select id="ntc-way">${d.defs.ways.map(([k,l])=>`<option value="${k}">${H(l)}</option>`).join("")}</select></label><label>Date<input type="date" id="ntc-date" value="${today()}"></label></div>
    <div class="actions"><button class="btn small" data-ntcgivesave="1">Record it for the people ticked</button></div>
    <div class="cnt">Each January a reminder asks you to check the posters and give this notice by February 1. <a href="${H(r.notice)}" target="_blank" rel="noopener">The Know Your Rights notice</a>, <a href="${H(r.url)}" target="_blank" rel="noopener">the Labor Commissioner's letter</a> and <a href="${H(r.postings)}" target="_blank" rel="noopener">Workplace Postings</a>, where each other language is listed.</div>`):"";
  draw(my,head("Policies and Procedures","Required notices","The notices and posters the official agency pages ask of an employer of our size, each linked to its official page. Notice text is never copied here.")+
    (dir?card("For staff",`<div class="actions" style="margin:0">${d.ready?chip("ok","Ready, staff see it"):chip("soon","A draft, only you see it")}<button class="btn small ghost" data-ntcready="${d.ready?"0":"1"}">${d.ready?"Back to draft":"Mark it ready"}</button></div>`):"")+
    card("Workplace posters",`<div class="hint">The posters still hang in the staff area. This list is for finding and replacing them.</div>${d.defs.posters.map(ntcRow).join("")}`)+
    card("New hire notices",`<div class="hint">Shown in the New Educator section. A filled-in form stays in the paper and QuickBooks Workforce hiring packet.</div>${d.defs.newhire.map(ntcRow).join("")}`)+give)}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-ntcack],[data-ntcemsave],[data-ntcgivesave],[data-ntcready]");if(!t)return;
  if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  try{
    if(t.dataset.ntcack){await api("notices/ack",{id:t.dataset.ntcack});toast("Saved.")}
    else if(t.dataset.ntcemsave){const box=t.closest(".strow");const v=k=>(box.querySelector(`[data-ntcem="${k}"]`)||{}).value||"";await api("notices/emergency",{name:t.dataset.ntcemsave,contact:{name:v("name"),phone:v("phone"),relation:v("relation"),notify:v("notify")}});toast("Saved.")}
    else if(t.dataset.ntcgivesave){const names=[...document.querySelectorAll("[data-ntcgive]:checked")].map(x=>x.dataset.ntcgive);if(!names.length)return toast("Tick the people who received it.");
      const r=await api("notices/give",{names,year:$("#ntc-year").value,way:$("#ntc-way").value,date:$("#ntc-date").value});toast(`Recorded for ${r.given}.`)}
    else if(t.dataset.ntcready){await api("notices/ready",{on:t.dataset.ntcready==="1"});toast("Saved.")}
    ntc.data=null;redraw()}catch(er){fail(er)}});
document.addEventListener("change",async e=>{const t=e.target;if(!t.dataset||!t.dataset.ntclang)return;if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  try{await api("notices/lang",{name:t.dataset.ntclang,lang:t.value});ntc.data=null;toast("Saved.")}catch(er){fail(er)}});
async function pageNew(my){const dir=D();let who=meName();
  if(dir){await loadPeople();const news=st.people.filter(p=>p.newHire||p.newEd);if(!st.newWho||!news.some(p=>p.name===st.newWho))st.newWho=(news[0]||{}).name||"";who=st.newWho;
    if(!who){draw(my,head("Educators","New Educator","A new educator gets into TREE before their first day, with access only to the New Educator section. Add one from Educators.")+addNewHtml()+welcomeEditHtml());return}}
  if(!st.doc||st.doc.name!==who||!T._keep)await loadPerson(who);const p=P(),pr=p.profile||{};const pcs=await loadPd().catch(()=>({licensing:[],howto:[]}));
  if(dir)await loadPaths().catch(()=>null);
  const start=pr.startDate||"",wk=start?Math.max(1,Math.floor(daysTo(start,today())/7)+1):0;const starting=start?addMonths(start,2):"";
  const papers=PAPERS();const pw=p.paperwork||{};const links=B.school.formLinks||{};
  const paperRow=x=>{const r=pw[x.k]||{};const blank=links[x.k]||x.blank;
    const ackAt=r.ack||(p.policy&&p.policy.yearAt)||0;
    const state=x.director?(r.done?chip("ok","Complete"):chip("missing","Not yet")):x.ack?((ackAt||(r.files||[]).length)?chip("ok",ackAt?"Read "+fms(ackAt):"Uploaded"):chip("missing","Not yet")):((r.files||[]).length?chip("ok","Uploaded"):chip("missing","Not yet"));
    return `<div class="strow"><div class="sttop"><b>${H(x.form)}</b><span class="actions" style="margin:0"><span class="cnt">${H(x.num)}</span>${state}</span></div><div class="cnt">${H(x.why)}</div>
      <div class="stfiles">${blank?`<a class="linkbtn" href="${H(blank)}" target="_blank" rel="noopener">Blank form</a>`:""}${x.director?(dir?`<label class="radio"><input type="checkbox" data-stdirpaper="${x.k}" ${r.done?"checked":""}><span>The invitation is complete</span></label>`:`<span class="cnt">The director marks this once your invitation is complete. Payroll and tax forms stay in QuickBooks.</span>`)
        :x.ack?`<span class="cnt">${dir?"Done":"You do this"} under Policies and Procedures, before the first day, on this page. It counts here too.</span>${(r.files||[]).length?fileList(p,r.files,who):""}`
        :`${fileList(p,r.files,who)}<button class="btn small ghost" data-stup="paper|${x.k}">Upload the completed form</button>${!blank&&!x.director&&x.k!=="immun"?`<span class="cnt">${x.k==="livescan"?"The director arranges Live Scan.":"Ask the director for this form."}</span>`:""}`}</div></div>`};
  const idr=pw.idseen||{};
  const ck=checklist(p,pcs,start);const goTo=p.goTo||B.goTo||"";
  draw(my,`${head("New Educator",dir?who+", New Educator":"Welcome to Fulton Community School",dir?`What ${H(who)} sees in their New Educator section, with your marks.`:"Onboarding is designed so you arrive on your first day knowing what to expect, with your paperwork in order and a colleague ready to support you. Everything you complete here lands on your records page, so nothing is entered twice.")}
    ${dir?`<div class="actions" style="margin:0 0 10px">${st.people.filter(x=>x.newHire||x.newEd).map(x=>`<button class="pill" aria-pressed="${x.name===who}" data-stnewwho="${H(x.name)}">${H(x.name)}</button>`).join("")}</div>`:""}
    ${card("Your first two months",`<div class="cnt">${H([start?"Start date "+fd(start):"The director adds your start date",starting?"Starting-point conversation with the director around "+fd(starting):""].filter(Boolean).join(". "))}${start?".":""}</div>
      ${goTo?`<div style="margin-top:6px"><b>${H(goTo)}</b> is the go-to person for every new educator. ${dir?H(goTo)+" answers their questions, walks them through paperwork and routines, and checks in briefly at the end of each of their first weeks. The educators on their Class team help on the floor every day.":`${H(goTo)} answers your questions, walks you through paperwork and routines, and checks in with you briefly at the end of each of your first weeks. The educators on your Class team help you on the floor every day. You can bring ${H(goTo)} into your starting-point conversation if you like.`}</div>`:`<div class="cnt" style="margin-top:6px">The director names the go-to person in Settings.</div>`}
      ${dir?`<div class="kfields" style="margin-top:6px">${onbSelect("",pr.onboarding,`data-stprof="${H(who)}|onboarding"`)}</div>`:""}
      ${dir?`<div class="actions">${(st.people.find(x=>x.name===who)||{}).newHire?`<button class="btn small" data-staccess="full" data-who="${H(who)}">Turn on full access to the school, the children and their work</button>`:`<span class="cnt">Full access is on.</span><button class="linkbtn" data-staccess="limit" data-who="${H(who)}">Limit to the New Educator section</button>`}</div>`:""}`)}
    ${await neCard(who,dir)}
    ${card("First weeks checklist",`<ol style="margin:0;padding-left:22px">${ck.map(c=>`<li style="margin:6px 0"><span class="actions" style="margin:0;justify-content:space-between;display:flex;flex-wrap:wrap;gap:4px 10px"><span>${H(c.label)}</span>${c.done?chip("ok",c.note||"Done"):chip(c.note==="Due"?"soon":"missing",c.note||"Not yet")}</span>${c.dirTick&&dir?`<label class="radio"><input type="checkbox" data-stck="${c.key}" ${c.done?"checked":""}><span>Done</span></label>`:""}${c.goto&&!dir?"":c.goto?`<button class="linkbtn" data-stgoto="${H(who)}">Note this week's check-in</button>`:""}${c.links?asLinks():""}${c.view&&B.can&&B.can.growth?`<button class="linkbtn" data-tview="${c.view}">Open</button>`:""}</li>`).join("")}</ol>`,printBar("checklist"))}
    ${welcomeHtml(p,dir)}
    ${await newPolCard(p,dir)}
    ${(()=>{const f=window.TREE_SMAP_FOLD?window.TREE_SMAP_FOLD("smap-ne",{open:true,label:"The site map"}):"";return f?card("Our site",`<div class="hint">The Classes, the yards, the garden and the farm, from above. Tap a space to find its name, and pinch or use the zoom buttons to look closer.</div>${f}`):""})()}
    ${card("Who's who",`<div class="tablewrap"><table class="grid2" style="min-width:360px"><thead><tr><th>Name</th><th>Role</th><th>Class</th></tr></thead><tbody>${B.whosWho.map(w=>`<tr><td><b>${H(w.name)}</b></td><td>${H(w.role)}</td><td>${H(w.room?w.room+" Class":"")}</td></tr>`).join("")}</tbody></table></div>
      ${!dir?`<div class="actions">${(p.pd&&p.pd.read||{}).whoswho?chip("ok","Read"):`<button class="btn small ghost" data-stread="whoswho">I have read Who's who</button>`}</div>`:""}`)}
    ${card("Paperwork",`<div class="hint">Each form has a blank copy to download and print, and a place to upload the completed form as a photo or PDF. Uploads save to the school's Google Drive. Payroll and tax forms are completed in QuickBooks Workforce.</div>${papers.map(paperRow).join("")}
      <div class="strow"><div class="sttop"><b>Social Security card and driver's license</b>${idr.done?chip("ok","Seen and filed"):chip("missing","Not yet")}</div><div class="cnt">Shown to the director in person and copied for the paper personnel file only. They are never uploaded to TREE.</div>
        ${dir?`<label class="radio"><input type="checkbox" data-stdirpaper="idseen" ${idr.done?"checked":""}><span>Seen and filed</span></label>`:""}</div>`,printBar("paperwork"))}
    ${card("Immunizations",`<div class="hint">California requires everyone who works or volunteers at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995.</div>
      <ul style="margin:6px 0;padding-left:20px"><li>The flu vaccine is due each year between August 1 and December 1.</li><li>Someone still gathering records can work for up to 30 days after signing a written statement that they are immunized.</li><li>A physician's written statement can exempt someone for medical reasons or show existing immunity.</li><li>Someone can decline the flu vaccine in writing. This applies to the flu vaccine only.</li><li>Someone hired after December 1 and before August 1 does not need the flu vaccine in their first year.</li></ul>
      <div class="cnt">Records or exemptions are kept in the personnel file. In TREE they are seen only by you and the director.</div><div class="actions"><button class="btn small ghost" data-tview="strec">Add them on ${dir?"the":"your"} records page</button></div>`)}
    ${card("Trainings",`<ul style="margin:0;padding-left:20px"><li>Mandated reporter training within 90 days of hire, renewed every two years</li><li>Pediatric First Aid and CPR, which we run in house</li><li>Health and safety training, 16 hours, needed by every caregiving educator by October 1, 2027</li><li>Emergency and disaster plan training, before the first day of work</li><li>Healthy Schools Act training each year, for anyone who uses sanitizers or disinfectants</li><li>Water safety certificate, required of every educator because of creek walks</li><li>Licensing at Fulton Community School, in the PD library, done in short pieces during nap</li></ul>
      <div class="actions"><button class="btn small ghost" data-tview="strec">Upload certificates</button><button class="btn small ghost" data-tview="stpd" data-stmod="licensing">Licensing at Fulton Community School</button></div>`)}
    ${card("The New Educator sequence",seqHtml(wk,pcs,p),start?`Week ${Math.min(wk,8)} of 8`:"")}`)}
/* the first-weeks sequence and the welcome letter, from staff/newed in the records. A draft shows only to the director. */
let NE=null;
async function loadNewed(who,force){if(force||!NE||NE.who!==who){try{NE=Object.assign(await api("newed",{name:who}),{who})}catch(e){NE={list:[],who,goTo:""}}}return NE}
const neFill=(t,g)=>String(t||"").replace(/\{goTo\}/g,g||"your go-to person");
function nePart(x,ne,dir){return `<details class="strow"${dir?"":` data-paopen="${H(x.slug)}"`}><summary style="cursor:pointer"><b>${H(x.title)}</b>${x.waiting?" "+chip("soonish","Draft, only you see it"):""}${dir&&x.audience==="experienced"?` <span class="cnt">For experienced educators</span>`:""}</summary>
  <div class="stmd" style="margin-top:6px">${md(neFill(x.body,ne.goTo))}</div>
  ${dir?`<div class="actions">${x.draft?`<button class="btn small${x.waiting?"":" ghost"}" data-neready="${H(x.slug)}|${x.waiting?1:0}">${x.waiting?"Mark it ready":"Hide it again"}</button>`:""}${peBtn("staff/newed/"+x.slug+".md")}</div>`:""}
  ${dir&&x.source?`<div class="cnt">Source, seen only by you. ${H(x.source)}</div>`:""}</details>`}
async function neCard(who,dir){const ne=await loadNewed(who);const L=(ne.list||[]).filter(x=>x.place==="newed"&&(x.audience==="all"||ne.experienced||dir));
  const exp=dir?`<label class="radio" style="margin-top:6px"><input type="checkbox" data-neexp="${H(who)}" ${ne.experienced?"checked":""}><span>${H(who)} is an experienced educator, who also reads the part for experienced educators</span></label>`:"";
  if(!L.length&&!dir)return "";return card("Your first weeks",`<div class="hint">${dir?"The first-weeks sequence, in order. Parts marked Draft show only to you.":"Read these in order through your first weeks. Each one is short."}</div>${L.map(x=>nePart(x,ne,dir)).join("")||`<div class="cnt">No parts yet.</div>`}${exp}`)}
async function neWelcome(){const ne=await loadNewed(meName());const w=(ne.list||[]).find(x=>x.place==="pdlibrary");if(!w)return "";const dir=D();
  return card(w.title,`${w.waiting?`<div class="actions" style="margin:0 0 6px">${chip("soonish","Draft, only you see it")}</div>`:""}<div class="stmd">${md(neFill(w.body,ne.goTo))}</div>
    ${dir?`<div class="actions">${w.draft?`<button class="btn small${w.waiting?"":" ghost"}" data-neready="${H(w.slug)}|${w.waiting?1:0}">${w.waiting?"Mark it ready":"Hide it again"}</button>`:""}${w.slug==="welcome"?`<button class="btn small ghost" data-stletteredit="1">Edit</button>`:""}</div>`:""}${dir&&w.source?`<div class="cnt">Source, seen only by you. ${H(w.source)}</div>`:""}`)}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-neready]");if(!t)return;if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  const [slug,on]=t.dataset.neready.split("|");try{NE=Object.assign(await api("newed/ready",{name:NE&&NE.who,slug,on:on==="1"}),{who:NE&&NE.who});toast(on==="1"?"Marked ready.":"Hidden again. Only you see it.");redraw()}catch(er){fail(er)}});
document.addEventListener("change",async e=>{const t=e.target;if(!t.dataset||t.dataset.neexp==null)return;if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  try{NE=Object.assign(await api("newed/experienced",{name:t.dataset.neexp,on:t.checked}),{who:t.dataset.neexp});toast("Saved.");redraw()}catch(er){fail(er)}});
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
  const W=[[1,"Week one","Welcome and philosophy, Who's who, the TREE How To guides, and the first Licensing at Fulton Community School pieces on supervision, with the CCLD active supervision video, ratios and emergencies.",[["stnew","Welcome"],["stpd|howto","TREE How To"],["stpd|licensing","Licensing at Fulton Community School"]]],
    [2,"Week two","The rest of Licensing at Fulton Community School, and keeping your first observations in TREE alongside your Class team.",[["stpd|licensing","Licensing at Fulton Community School"]]],
    [3,"Weeks three and four","The Language of Learning, then the reflective journal, written weekly from here on.",[["stpd|m:language","The Language of Learning"],g?["stjour","Journal"]:null]],
    [5,"Weeks five and six","Documentation, and writing your first curriculum plan with your team.",[["stpd|m:documentation","Documentation"],["plans","Plans"]]],
    [7,"Weeks seven and eight","Beyond Discipline, the Educator Reflection and Growth Plan, and the starting-point conversation with the director at two months.",[["stpd|m:beyond","Beyond Discipline"],g?["stplan","Growth Plan"]:null,g?["stgrow","Starting point"]:null]]].map(w=>[w[0],w[1],w[2],w[3].filter(Boolean)]);
  const now=wk>0?W.filter(w=>w[0]<=wk).pop():null;
  return `<div class="hint">One short step at a time, mostly during nap.</div><div class="stseq" style="margin-top:8px">${W.map(w=>`<div class="${w===now?"now":""}"><div class="sttop" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${H(w[1])}</b>${w===now?chip("soonish","Now"):""}</div><div class="cnt">${H(w[2])}</div>
    <div class="actions" style="margin:4px 0 0">${w[3].map(([v,l])=>`<button class="btn small ghost" data-tview="${v.split("|")[0]}" ${v.includes("|")?`data-stmod="${v.split("|")[1]}"`:""}>${H(l)}</button>`).join("")}</div></div>`).join("")}</div>${g?"":`<div class="hint" style="margin-top:6px">The journal and the Growth Plan open once the director turns on growth in Settings.</div>`}`}

/* the PD library */
const MODULES=[["The Educator as Researcher","Our project cycle from informal observation to reflection, and writing plans that grow from observation.",""],["Documentation","Writing observations that separate noticing from wondering, and documentation that makes children's thinking visible.",""],
  ["The Language of Learning","Our language parameters and the Effective Responses guide, describing and narrating in place of praise.",""],["Beyond Discipline","Relationship-based positive discipline, looking for the reason behind a behavior, and staying regulated so children can regulate.",""],
  ["The Home and School Partnership","Daily communication, conferences, and difficult conversations.",""],["Developmental Deep Dive","Development in the Twos and Threes and in the Fours and Fives, in a mixed-age community.",""],
  ["Spaces That Teach","The atelier, the outdoor classroom and the farm as spaces that teach.",""],["The Art of the Meeting","Meeting time as a place for listening and making space for others' words and bodies.",""],
  ["TREE How To","Short guides for keeping observations, writing plans and making documentation.","howto"],["Licensing at Fulton Community School","Each Title 22 requirement and our own procedures in short pieces for nap time, with the official trainings linked.","licensing"]];
async function pagePd(my){if(window.TreeGrowth)await TreeGrowth.ready().catch(()=>{});const pcs=await loadPd();const mine=meName();if(!st.doc||st.doc.name!==mine)await loadPerson(mine);const p=P();const dn=(p.pd&&p.pd.done)||{};
  const pending=LS.get("tree.stmod","");if(pending){st.mod=pending;st.piece="";LS.set("tree.stmod",null)}
  if(st.piece){const x=[...pcs.licensing,...pcs.howto].find(y=>y.id===st.piece);if(x)return pieceHtml(my,x,dn)}
  if(st.mod&&st.mod.startsWith("m:")&&window.TreeGrowth)return TreeGrowth.module(my,st.mod.slice(2));
  if(st.mod){const list=pcs[st.mod]||[];const isLic=st.mod==="licensing";const nd=list.filter(x=>dn[x.id]).length;
    const grp=(t,f)=>{const g=list.filter(f);return g.length?`<h4 style="margin:10px 0 2px">${H(t)}</h4>${g.map(x=>`<div class="prow"><button class="linkbtn" style="font-size:15px;text-align:left" data-stpiece="${H(x.id)}">${H(x.title)}</button><span class="actions" style="margin:0">${dn[x.id]?chip("ok","Read"):""}</span></div>`).join("")}`:""};
    draw(my,head("PD library",isLic?"Licensing at Fulton Community School":"TREE How To",isLic?"Each Title 22 requirement and our own procedures in short pieces for nap time, about five to ten minutes each. Each piece gives a plain summary linked to the regulation, how we carry it out, and one question answered in your own words, never scored. A finished piece shows as read on the licensing list, and its minutes count toward your yearly hours.":"Short guides for keeping observations, writing plans and making documentation. A finished guide counts toward your yearly hours.")+
      `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stmodback="1">‹ PD library</button></div>`+
      card(isLic?"The pieces":"The guides",isLic?grp("Title 22 requirements",x=>x.list==="title22")+grp("Our own procedures",x=>x.list==="procedure")+grp("Official trainings",x=>x.list!=="title22"&&x.list!=="procedure"):grp("",()=>true),`${nd} of ${list.length} read`)+
      `<div class="actions">${printBar("pieces:"+st.mod)}</div>`);return}
  const sec=B.me.newEd||D();
  // what is assigned comes first, and for the director the paths and everyone's progress
  let paths="";if(D()){try{const r=await loadPaths(!T._keep);paths=pathsDirCard(r)+assignedDirCard(r)}catch(e){paths=""}}else paths=await assignedCard();
  draw(my,head("PD library","PD library","Each module holds a short reading, examples from our own documentation, a practice to try in your own Class that week, and one reflection on what happened when you tried it. You choose the order. Finishing a module logs its hours on your records page.")+
    paths+(await neWelcome())+(sec?card("The New Educator sequence",seqHtml(B.me.newEd&&B.me.profile&&B.me.profile.startDate?Math.max(1,Math.floor(daysTo(B.me.profile.startDate,today())/7)+1):0,pcs,p),B.me.newEd?"Your first two months":"For new educators, their first two months"):"")+
    (window.TreeGrowth?await TreeGrowth.libraryHtml(pcs,dn):card("Modules",`<div class="stgrid">${MODULES.filter(m=>m[2]).map(([t,d,k])=>`<div class="stmod"><b>${H(t)}</b><div class="cnt">${H(d)}</div><div class="actions" style="margin:4px 0 0"><button class="btn small ghost" data-stmod="${k}">Open</button></div></div>`).join("")}</div>`))+(window.TreeGrowth&&TreeGrowth.readingsHtml?await TreeGrowth.readingsHtml():""))}
function pieceHtml(my,x,dn){const d=dn[x.id];const list=st.pd[x.dir]||[];const i=list.indexOf(x),nx=list[i+1];
  const sec=h=>x.sections.find(s=>s.heading.toLowerCase().startsWith(h));const q=sec("one question");
  const hbs=x.handbook||[];
  draw(my,`<div class="head"><div><span class="eyebrow">${x.dir==="licensing"?"Licensing at Fulton Community School":"TREE How To"}</span><h2 style="margin-top:4px">${H(x.title)}</h2><div class="sub">${H(x.source)}</div></div></div>
    <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stpiece="">‹ ${x.dir==="licensing"?"Licensing at Fulton Community School":"TREE How To"}</button></div>
    ${D()&&x.draft?`<div class="actions" style="margin:0 0 10px">${x.waiting?chip("soon","A draft, only you see it"):chip("ok","Ready, everyone sees it")}<button class="btn small ghost" data-stpieceready="${H(x.id)}|${x.waiting?1:0}">${x.waiting?"Mark it ready":"Back to draft"}</button></div>`:""}
    ${D()&&(x.dir==="howto"||x.dir==="licensing")?`<div class="actions" style="margin:0 0 10px"><button class="btn small ghost" data-stpieceedit="${H(x.id)}">Edit</button></div>`:""}
    <section class="card"><div class="actions" style="margin:0 0 6px">${x.links.filter(l=>!l.minor).map(l=>`<a class="btn small ghost" href="${H(l.url)}" target="_blank" rel="noopener">${H(l.text)}</a>`).join("")}${d?chip("ok","Read "+fms(d.at)):""}</div>${x.links.some(l=>l.minor)||(x.checked&&D())?`<div class="actions" style="margin:0 0 6px">${x.links.filter(l=>l.minor).map(l=>`<a class="linkbtn" href="${H(l.url)}" target="_blank" rel="noopener">${H(l.text)}</a>`).join("")}${x.checked&&D()?`<span class="cnt">Links confirmed ${H(fd(x.checked))}</span>`:""}</div>`:""}
      ${x.sections.filter(s=>s!==q).map(s=>`<h3 style="font-size:16px;margin:14px 0 6px">${H(s.heading)}</h3>${md(s.body)}`).join("")}
      ${hbs.length?`<div class="actions">${hbs.map(id=>`<button class="btn small ghost" data-hbopen="${H(id)}">In the Policies and Procedures, ${H(hbTitle(id))}</button>`).join("")}</div>`:""}</section>
    ${x.list==="training"?trainingsCard():""}
    ${q?`<section class="card"><h3 style="font-size:17px">${H(q.heading)}</h3><div class="stq" style="margin:6px 0 10px">${md(q.body)}</div>
      <label class="fld-label">In your own words<textarea id="stp-answer" rows="4" placeholder="Never scored. Only you and the director read it.">${H(d?d.answer:"")}</textarea></label>
      <div class="actions"><button class="btn" data-stdone="${H(x.id)}">${d?"Save my answer":"Finish this piece"}</button>${nx?`<button class="btn small ghost" data-stpiece="${H(nx.id)}">Next, ${H(nx.title)}</button>`:""}</div></section>`:
      `<section class="card"><div class="actions" style="margin:0"><button class="btn" data-stdone="${H(x.id)}">${d?"Read":"Finish this guide"}</button>${nx?`<button class="btn small ghost" data-stpiece="${H(nx.id)}">Next, ${H(nx.title)}</button>`:""}</div></section>`}`);
  jumpTop()}
const hbTitle=id=>{const d=st.pol.teacher;const s=d&&d.parts.flatMap(p=>p.sections).find(x=>x.id===id);return s?s.title:id.replace(/-/g," ").replace(/^./,c=>c.toUpperCase())};

/* ---------- PD paths and assignments ----------
   A path is a set of steps in order, PD modules and parts of the first weeks. The director makes, copies, changes and
   assigns paths at the top of the PD library and sees each person's progress there. Each educator sees Assigned to you
   at the top of the PD library, with the director's note, the finish-by date and each step in order. The server sends
   each educator only their own assignments, and only the steps they can open. */
const pa={data:null,mine:null,edit:null,assign:null};
const WAYS=[["own","On my own"],["meeting","Staff meeting"],["pdday","PD day"]];const wayName=k=>(WAYS.find(w=>w[0]===k)||WAYS[0])[1];
const PSTATE={done:["ok","Done"],progress:["soonish","In progress"],none:["missing","Not started"]};
const stateChip=s=>chip(...(PSTATE[s]||PSTATE.none));
const draftChip=()=>chip("soonish","Draft, not visible yet");
async function loadPaths(force){if(D()){if(!pa.data||force)pa.data=await api("paths");return pa.data}if(!pa.mine||force)pa.mine=await api("paths/mine");return pa.mine}
// what the director assigned to this educator, each step tapped to open it
async function assignedCard(){let r;try{r=await loadPaths(true)}catch(e){return ""}const L=r.list||[];if(!L.length)return "";
  const step=s=>s.kind==="module"?`<li style="margin:6px 0"><button class="linkbtn" style="text-align:left" data-stmod="m:${H(s.slug)}">${H(s.title)}</button> <span class="cnt">${H(wayName(s.way))}</span> ${s.done?chip("ok","Done"):s.started?chip("soonish","Started"):chip("missing","Not yet")}</li>`
    :`<li style="margin:6px 0"><details data-paopen="${H(s.slug)}"><summary style="cursor:pointer"><span class="linkbtn">${H(s.title)}</span> <span class="cnt">First weeks</span> ${s.done?chip("ok","Opened"):chip("missing","Not yet")}</summary><div style="margin-top:6px">${md(neFill(s.body,r.goTo))}</div></details></li>`;
  return card("Assigned to you",`<div class="hint">From the director, in order. Tap a step to open it.</div>${L.map(a=>`<div class="strow"><div class="sttop"><b>${H(a.title)}</b><span class="actions" style="margin:0">${a.due?chip(a.overdue?"out":"soonish",(a.overdue?"Past due, ":"Finish by ")+fd(a.due)):""}${stateChip(a.state)}</span></div>
    ${a.note?`<div class="stq">${H(a.note)}</div>`:a.desc?`<div class="cnt">${H(a.desc)}</div>`:""}<ol style="margin:4px 0 0;padding-left:22px">${a.steps.map(step).join("")}</ol></div>`).join("")}`)}
// a part of the first weeks counts as done once it is opened, here or on the New Educator page
document.addEventListener("toggle",async e=>{const t=e.target;if(!t||!t.dataset||t.dataset.paopen==null||!t.open||D()||(typeof VIEW_AS!=="undefined"&&VIEW_AS))return;
  try{await api("paths/opened",{slug:t.dataset.paopen});pa.mine=null;const c=t.querySelector("summary .stchip.missing");if(c){c.className="stchip ok";c.textContent="Opened"}}catch(er){}},true);
// the director's paths, each with Edit, Copy, Assign and Delete, and the form to make, change or assign one
function pathsDirCard(r){const E=pa.edit,A=pa.assign;
  const row=p=>E&&E.id===p.id?paEditHtml(r):`<div class="strow"><div class="sttop"><b>${H(p.title)}</b><span class="actions" style="margin:0">${p.builtin?chip("ok","Built in"):""}${p.onboarding?chip("soonish","Onboarding"):""}</span></div>${p.desc?`<div class="cnt">${H(p.desc)}</div>`:""}${p.steps.some(s=>s.waiting)?`<div class="cnt">${draftChip()} ${H(p.steps.filter(s=>s.waiting).map(s=>s.title).join(", "))}</div>`:""}
    <details><summary class="cnt" style="cursor:pointer">${p.steps.length===1?"One step":p.steps.length+" steps"}</summary><ol style="margin:4px 0;padding-left:22px">${p.steps.map(s=>`<li style="margin:3px 0">${H(s.title)} <span class="cnt">${s.kind==="module"?"PD module":"First weeks"}</span>${s.waiting?" "+draftChip():""}${s.missing?" "+chip("out","No longer in the library"):""}</li>`).join("")}</ol></details>
    <div class="actions" style="margin:0"><button class="btn small ghost" data-paedit="${H(p.id)}">Edit</button><button class="btn small ghost" data-pacopy="${H(p.id)}">Copy</button><button class="btn small ghost" data-paassign="p:${H(p.id)}">Assign</button>${p.builtin?"":`<button class="linkbtn" data-padel="${H(p.id)}">Delete</button>`}</div></div>`;
  return card("Paths",`<div class="hint">A path is a set of steps in order, PD modules and parts of the first weeks. First weeks reaches every new educator by itself. Assign a path or a single module to people, to a class or both.</div>
    ${E&&!E.id?paEditHtml(r):""}${r.paths.map(row).join("")}
    ${E||A?"":`<div class="actions"><button class="btn small" data-panew="1">New path</button><button class="btn small ghost" data-paassign="1">Assign</button></div>`}${A?paAssignHtml(r):""}`)}
const paTitle=(r,s)=>((s.kind==="module"?r.modules.find(m=>m.slug===s.slug):r.newed.find(n=>n.slug===s.slug))||{}).title||s.slug;
const paWaits=(r,s)=>!!((s.kind==="module"?r.modules.find(m=>m.slug===s.slug):r.newed.find(n=>n.slug===s.slug))||{}).waiting;
function paEditHtml(r){const E=pa.edit;const fw=E.id==="firstweeks";
  return `<div class="strow" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:6px 0"><b>${fw?"First weeks":E.id?"Edit the path":"New path"}</b>
    ${fw?`<div class="hint">First weeks keeps its own parts. The order here is the order on the New Educator page. Copy it to make a path with other steps.</div>`:`<label class="fld-label">Title<input type="text" id="pa-title" value="${H(E.title)}" placeholder="Such as Garden series"></label><label class="fld-label">Description<textarea id="pa-desc" rows="2">${H(E.desc)}</textarea></label><label class="radio"><input type="checkbox" id="pa-onb" ${E.onboarding?"checked":""}><span>An onboarding path, offered when you add a new educator</span></label>`}
    ${E.steps.length?`<ol style="margin:6px 0;padding-left:22px">${E.steps.map((s,i)=>`<li style="margin:4px 0">${H(paTitle(r,s))} <span class="cnt">${s.kind==="module"?"PD module":"First weeks"}</span>${paWaits(r,s)?" "+draftChip():""}<span class="actions" style="margin:0 0 0 8px;display:inline-flex"><button class="linkbtn" data-pamove="${i}|-1" ${i?"":"disabled"}>Up</button><button class="linkbtn" data-pamove="${i}|1" ${i<E.steps.length-1?"":"disabled"}>Down</button>${fw?"":`<button class="linkbtn" data-parm="${i}">Remove</button>`}</span></li>`).join("")}</ol>`:`<div class="cnt" style="margin:6px 0">No steps yet.</div>`}
    ${fw?"":`<div class="kfields"><label>Add a step<select id="pa-add"><optgroup label="PD modules">${r.modules.map(m=>`<option value="module|${H(m.slug)}">${H(m.title)}${m.waiting?", a draft":""}</option>`).join("")}</optgroup><optgroup label="First weeks">${r.newed.map(n=>`<option value="newed|${H(n.slug)}">${H(n.title)}${n.waiting?", a draft":""}</option>`).join("")}</optgroup></select></label></div><div class="actions" style="margin:4px 0"><button class="btn small ghost" data-paadd="1">Add the step</button></div>`}
    <div class="actions"><button class="btn small" data-pasave="1">Save</button><button class="linkbtn" data-pacancel="1">Cancel</button></div></div>`}
function paAssignHtml(r){const A=pa.assign;const w=A.what;
  const steps=w.startsWith("p:")?((r.paths.find(p=>p.id===w.slice(2))||{}).steps||[]):w.startsWith("m:")?[{kind:"module",slug:w.slice(2),title:paTitle(r,{kind:"module",slug:w.slice(2)})}]:[];const mods=steps.filter(s=>s.kind==="module");
  return `<div class="strow" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:8px"><b>Assign</b>
    <div class="kfields"><label>A path or a module<select id="pa-what"><option value="">Choose</option><optgroup label="Paths">${r.paths.map(p=>`<option value="p:${H(p.id)}" ${w==="p:"+p.id?"selected":""}>${H(p.title)}</option>`).join("")}</optgroup><optgroup label="PD modules">${r.modules.map(m=>`<option value="m:${H(m.slug)}" ${w==="m:"+m.slug?"selected":""}>${H(m.title)}${m.waiting?", a draft":""}</option>`).join("")}</optgroup></select></label></div>
    ${steps.some(s=>s.waiting||paWaits(r,s))?`<div class="cnt">${draftChip()} A draft step stays hidden from educators until you mark it ready.</div>`:""}
    <div class="lbl" style="margin-top:8px">Classes</div><div class="chips">${r.classes.map(c=>`<button class="chip${A.classes.includes(c)?" on":""}" type="button" data-paclass="${H(c)}">${H(c)} class</button>`).join("")}</div>
    <div class="hint">A class means every educator whose class is that class, now and later.</div>
    <div class="lbl" style="margin-top:8px">People</div><div class="chips">${r.people.map(p=>`<button class="chip${A.people.includes(p.name)?" on":""}" type="button" data-paperson="${H(p.name)}">${H(p.name)}</button>`).join("")}</div>
    ${mods.length?`<div class="lbl" style="margin-top:8px">The way in for each module</div><div class="kfields">${mods.map(s=>`<label>${H(s.title)}<select data-paway="${H(s.slug)}">${WAYS.map(([k,l])=>`<option value="${k}" ${(A.ways[s.slug]||"own")===k?"selected":""}>${l}</option>`).join("")}</select></label>`).join("")}</div>`:""}
    <div class="kfields"><label>Finish by, if you like<input type="date" id="pa-due" value="${H(A.due)}"></label></div>
    <label class="fld-label">A note, if you like<textarea id="pa-note" rows="2" placeholder="Such as Read this before our garden day">${H(A.note)}</textarea></label>
    <div class="hint">A few days before the date, each person who has not finished hears a reminder. The date shows on their TREE calendar.</div>
    <div class="actions"><button class="btn small" data-pago="1">Assign</button><button class="linkbtn" data-pacancel="1">Cancel</button></div></div>`}
// every assignment with each person's progress, done, in progress or not started, and overdue past the date
function assignedDirCard(r){const L=r.assignments||[];
  const forWho=a=>a.auto?"every new educator in the New Educator section, by itself":[...a.classes.map(c=>c+" class"),...a.people].join(", ");
  return card("Assigned PD",L.length?L.map(a=>`<div class="strow"><div class="sttop"><b>${H(a.title)}</b><span class="actions" style="margin:0">${a.due?chip(a.progress.some(p=>p.overdue)?"out":"soonish","Finish by "+fd(a.due)):""}</span></div>
    <div class="cnt">For ${H(forWho(a))}.</div>${a.steps.some(s=>s.waiting)?`<div class="cnt">${draftChip()} ${H(a.steps.filter(s=>s.waiting).map(s=>s.title).join(", "))}</div>`:""}${a.note?`<div class="stq">${H(a.note)}</div>`:""}
    <details><summary class="cnt" style="cursor:pointer">${a.steps.length===1?"One step":a.steps.length+" steps"}</summary><ol style="margin:4px 0;padding-left:22px">${a.steps.map(s=>`<li style="margin:3px 0">${H(s.title)} <span class="cnt">${s.kind==="module"?H(wayName(s.way)):"First weeks"}</span>${s.waiting?" "+draftChip():""}</li>`).join("")}</ol></details>
    ${a.progress.length?`<div class="tablewrap"><table class="grid2" style="min-width:300px"><tbody>${a.progress.map(p=>`<tr><td><b>${H(p.name)}</b>${p.room?` <span class="cnt">${H(p.room)} class</span>`:""}</td><td>${stateChip(p.state)}${p.overdue?" "+chip("out","Overdue"):""}</td><td class="cnt">${p.open?`${p.done} of ${p.open} step${p.open===1?"":"s"}`:"Nothing open to them yet"}</td></tr>`).join("")}</tbody></table></div>`:`<div class="cnt">No one yet.</div>`}
    ${a.auto?"":`<div class="actions" style="margin:0"><button class="linkbtn" data-paunassign="${H(a.id)}">Remove assignment</button></div>`}</div>`).join(""):`<div class="empty">Nothing assigned yet. Choose Assign under Paths.</div>`)}
// what the director typed is kept while the form is drawn again
function paKeep(){const E=pa.edit;if(E){if($("#pa-title"))E.title=$("#pa-title").value;if($("#pa-desc"))E.desc=$("#pa-desc").value;if($("#pa-onb"))E.onboarding=$("#pa-onb").checked}
  const A=pa.assign;if(A){if($("#pa-due"))A.due=$("#pa-due").value;if($("#pa-note"))A.note=$("#pa-note").value;document.querySelectorAll("[data-paway]").forEach(x=>A.ways[x.dataset.paway]=x.value)}}
const paForm=p=>({id:p.id,title:p.title,desc:p.desc||"",onboarding:!!p.onboarding,steps:p.steps.map(s=>({kind:s.kind,slug:s.slug}))});
document.addEventListener("click",e=>{const t=e.target.closest("[data-panew],[data-paedit],[data-pacopy],[data-padel],[data-paassign],[data-pamove],[data-parm],[data-paadd],[data-pasave],[data-pacancel],[data-paclass],[data-paperson],[data-pago],[data-paunassign]");if(!t||!D())return;e.preventDefault();e.stopPropagation();tapOnce(t,()=>paTap(t))},true);
document.addEventListener("change",e=>{const t=e.target;if(!t||t.id!=="pa-what"||!pa.assign)return;paKeep();pa.assign.what=t.value;redraw()});
async function paTap(t){const d=t.dataset,r=pa.data;paKeep();
  if(d.panew){pa.edit={id:"",title:"",desc:"",onboarding:false,steps:[]};pa.assign=null;redraw();return}
  if(d.paedit){const p=r.paths.find(x=>x.id===d.paedit);if(!p)return;pa.edit=paForm(p);pa.assign=null;redraw();return}
  if(d.pacancel){pa.edit=null;pa.assign=null;redraw();return}
  if(d.pamove){const [i,dx]=d.pamove.split("|").map(Number);const L=pa.edit.steps,j=i+dx;if(j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];redraw();return}
  if(d.parm!=null){pa.edit.steps.splice(+d.parm,1);redraw();return}
  if(d.paadd){const [kind,slug]=(($("#pa-add")||{}).value||"").split("|");if(!slug)return;if(pa.edit.steps.some(s=>s.kind===kind&&s.slug===slug)){toast("That step is in the path already.");return}pa.edit.steps.push({kind,slug});redraw();return}
  if(d.pasave){const E=pa.edit;if(E.id!=="firstweeks"&&!String(E.title).trim()){toast("Give the path a title.");return}pa.data=await api("paths/save",{path:E});pa.edit=null;if(E.id==="firstweeks")NE=null;toast(E.id==="firstweeks"?"Saved. The New Educator page follows this order.":"Saved.");redraw();return}
  if(d.pacopy){pa.data=await api("paths/copy",{id:d.pacopy});const p=pa.data.paths.find(x=>x.id===pa.data.id);pa.edit=p?paForm(p):null;pa.assign=null;toast("Copied. Change it, then Save.");redraw();return}
  if(d.padel){const p=r.paths.find(x=>x.id===d.padel);if(!p||!confirm(`Delete ${p.title}?${p.assigned?` ${p.assigned===1?"Its assignment goes":"Its "+p.assigned+" assignments go"} with it.`:""}`))return;pa.data=await api("paths/remove",{id:p.id});toast("Deleted.");redraw();return}
  if(d.paassign){pa.edit=null;pa.assign={what:d.paassign==="1"?"":d.paassign,people:[],classes:[],ways:{},due:"",note:""};redraw();return}
  if(d.paclass){const A=pa.assign;A.classes=A.classes.includes(d.paclass)?A.classes.filter(x=>x!==d.paclass):[...A.classes,d.paclass];t.classList.toggle("on");return}
  if(d.paperson){const A=pa.assign;A.people=A.people.includes(d.paperson)?A.people.filter(x=>x!==d.paperson):[...A.people,d.paperson];t.classList.toggle("on");return}
  if(d.pago){const A=pa.assign,w=A.what;if(!w){toast("Choose a path or a module.");return}if(!A.people.length&&!A.classes.length){toast("Choose the people, a class or both.");return}
    pa.data=await api("paths/assign",{kind:w.startsWith("m:")?"module":"path",id:w.startsWith("p:")?w.slice(2):"",slug:w.startsWith("m:")?w.slice(2):"",people:A.people,classes:A.classes,ways:A.ways,due:A.due,note:A.note});pa.assign=null;toast("Assigned.");redraw();return}
  if(d.paunassign){if(!confirm("Remove this assignment? Nothing anyone has done is lost."))return;pa.data=await api("paths/unassign",{id:d.paunassign});toast("Removed.");redraw();return}}

/* ---------- the Policies and Procedures and the Family Handbook ----------
   Both are read section by section from the records, in the Markdown policy-md.js reads. The director edits any section
   on its own, each change is kept with its day, who and a short note, and an earlier version can be read or restored. */
const PM=()=>window.PolicyMd;
const POLV={sthb:"teacher",stfh:"family"};
const polName=k=>k==="family"?"Family Handbook":"Policies and Procedures";
const polKey=k=>k==="family"?"family:"+(st.fhYear||""):"teacher";
async function loadPol(k,force){const key=polKey(k);if(!st.pol[key]||force){const d=await api("policies/doc",{doc:k,edition:k==="family"?st.fhYear||undefined:undefined});st.pol[key]=d;if(k==="family"&&!st.fhYear)st.pol["family:"+d.edition]=d}return st.pol[key]}
const polSecs=d=>(d.parts||[]).flatMap(p=>p.sections.map(s=>Object.assign({partId:p.id,partTitle:p.title,partSize:p.sections.length},s)));
// the whole book prints only what every reader may read, never a section kept for the director alone or one removed
const polBook=d=>(d.parts||[]).map(p=>Object.assign({},p,{sections:p.sections.filter(s=>!s.directorOnly&&!s.removed)})).filter(p=>p.sections.length);
// a picture in a section is read through the server with the sign-in, then kept for the visit
const PICS=new Map();
async function picBlob(p){if(PICS.has(p))return PICS.get(p);const r=await fetch(window.FP_SERVER+"/api/staff/policies/img",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({path:p})});
  if(!r.ok)throw new Error("The picture could not be read.");const b=await r.blob();PICS.set(p,b);return b}
const PICURL=new Map();
async function picUrl(p){if(!PICURL.has(p))PICURL.set(p,URL.createObjectURL(await picBlob(p)));return PICURL.get(p)}
function fillPics(){document.querySelectorAll("#main img[data-pimg]").forEach(async im=>{try{im.src=await picUrl(im.dataset.pimg)}catch(e){im.replaceWith(Object.assign(document.createElement("span"),{className:"cnt",textContent:im.alt||"The picture could not be shown."}))}})}
const pic=(src,alt)=>`<img data-pimg="${H(src)}" alt="${H(alt||"A picture from the policies")}" style="max-width:100%;height:auto;display:block;margin:8px auto">`;
const polHtml=b=>String(b||"").trim()?PM().html(b,pic):`<div class="empty">This section has no words yet. Edit it to write what belongs here.</div>`;
const yearSpan=y=>y?y+" to "+(+y+1):"";

/* proposed sections wait here for the director, and nothing changes in the document until she accepts one. Accepting
   adds it as a new section, which keeps its own earlier versions from then on like every other section. */
/* pieces for the Family page, each a draft only the director sees until she marks it ready */
async function fpiecesCard(){let r;try{r=await api("familypieces")}catch(e){return ""}const L=r.list||[];if(!L.length)return "";
  return card("Family page pieces",`<div class="hint">Pieces for families, read on the Family page under For families. The TK and kindergarten guide shows only to families of children going to TK or kindergarten next year, beside the transition summary. A draft reaches no family until you mark it ready.</div>
    ${L.map(x=>`<details class="strow"><summary style="cursor:pointer"><b>${H(x.title)}</b> ${x.waiting?chip("soonish","Draft"):chip("ok","On the Family page")}${x.audience==="tk"?` <span class="cnt">For TK and kindergarten families</span>`:""}</summary>
      <div class="stmd" style="margin-top:6px">${md(x.body)}</div><div class="actions">${x.draft?`<button class="btn small${x.waiting?"":" ghost"}" data-fpready="${H(x.slug)}|${x.waiting?1:0}">${x.waiting?"Mark it ready":"Take it off the Family page"}</button>`:""}${peBtn("staff/familypieces/"+x.slug+".md")}</div>
      ${x.source?`<div class="cnt">Source, seen only by you. ${H(x.source)}</div>`:""}</details>`).join("")}`,`${L.filter(x=>x.waiting).length} waiting`)}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-fpready]");if(!t)return;if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  const [slug,on]=t.dataset.fpready.split("|");try{await api("familypieces/ready",{slug,on:on==="1"});toast(on==="1"?"Marked ready. Families see it now.":"Taken off the Family page.");redraw()}catch(er){fail(er)}});
async function proposalsCard(k,ed){let r;try{r=await api("proposals")}catch(e){return ""}
  const all=(r.list||[]).filter(x=>x.doc===k&&(k!=="family"||x.edition===ed));
  // rewrites of a passage in a plan, the idea bank or one of our pages, such as one that would have children collect
  // creatures, show with the Policies and Procedures
  const recs=k==="teacher"?(r.list||[]).filter(x=>x.doc==="record"&&x.kind==="replace"):[];
  const recCard=recs.length?card("Proposed rewrites to our plans and pages",`<div class="hint">Leave them be. Children observe creatures where they live, so each rewrite takes out a suggestion to collect, keep or feed a creature. Nothing changes until you accept one, and accepting replaces only that passage.</div>`+recs.map(x=>`<details class="stpart"><summary><b>${H(x.sectionTitle||x.path)}</b> ${x.status==="accepted"?chip("ok","Accepted"):x.status==="aside"?chip("soon","Kept as it is"):chip("soonish","Waiting for you")}</summary>
    <div class="cnt">${H(x.note||"")}</div><div class="lbl" style="margin-top:6px">Now</div><div class="stmd">${md(x.from||"")}</div>
    <div class="lbl" style="margin-top:6px">${x.status==="accepted"?"Accepted":"Rewrite"}</div>${x.status==="accepted"?`<div class="stmd">${md(x.accepted||x.to||"")}</div>`:`<textarea rows="3" data-propto="${H(x.id)}" aria-label="Rewrite for ${H(x.sectionTitle||x.path)}">${H(x.to||"")}</textarea>`}
    ${x.status==="accepted"?"":`<div class="actions"><button class="btn small" data-propaccept="${H(x.id)}" data-replace="1">Accept the rewrite</button>${x.status==="aside"?`<button class="linkbtn" data-propback="${H(x.id)}">Back to waiting</button>`:`<button class="linkbtn" data-propaside="${H(x.id)}">Keep the wording as it is</button>`}</div>`}</details>`).join(""),`${recs.filter(x=>!x.status||x.status==="proposed").length} waiting`):"";
  if(!all.length)return recCard;
  const st2=x=>x.status==="accepted"?chip("ok","Accepted"):x.status==="aside"?chip("soon","Kept as it is"):chip("soonish","Waiting for you");
  const mine=all.filter(x=>x.kind!=="replace"),rw=all.filter(x=>x.kind==="replace");
  // a rewrite replaces one passage in a section already there. She accepts it, changes the new wording first, or keeps
  // the wording as it is.
  const rewrites=rw.length?card("Proposed rewrites",`<div class="hint">Each rewrite says the same thing directly, without first saying what something is not. Nothing changes in ${k==="family"?"the "+H(ed)+" draft":"the Policies and Procedures"} until you accept one. Accepting replaces only that passage, and the section keeps its earlier wording in its history.</div>`+rw.map(x=>`<details class="stpart"><summary><b>${H(x.sectionTitle||x.section)}</b>${x.title&&x.title!==x.sectionTitle?` <span class="cnt">${H(String(x.title).replace(/^A direct rewrite in .*$/,""))}</span>`:""} ${st2(x)}</summary>
    <div class="lbl" style="margin-top:6px">Now</div><div class="stmd">${md(x.from||"")}</div>
    <div class="lbl" style="margin-top:6px">${x.status==="accepted"?"Accepted":"Rewrite"}</div>${x.status==="accepted"?`<div class="stmd">${md(x.accepted||x.to||"")}</div>`:`<div class="stmd">${md(x.to||"")}</div><details><summary class="linkbtn">Change the new wording first</summary><textarea rows="6" data-propto="${H(x.id)}" aria-label="Rewrite for ${H(x.sectionTitle||x.section)}">${H(x.to||"")}</textarea></details>`}
    <div class="actions">${x.status==="accepted"?`<button class="linkbtn" data-stpol="${H(x.section||"")}">Open the section</button>`:`<button class="btn small" data-propaccept="${H(x.id)}" data-replace="1">Accept the rewrite</button>${x.status==="aside"?`<button class="linkbtn" data-propback="${H(x.id)}">Back to waiting</button>`:`<button class="linkbtn" data-propaside="${H(x.id)}">Keep the wording as it is</button>`}`}</div></details>`).join(""),`${rw.filter(x=>!x.status||x.status==="proposed").length} waiting`):"";
  if(!mine.length)return rewrites+recCard;
  return rewrites+recCard+card("Proposed sections",`<div class="hint">Each proposal waits for you. Nothing changes in ${k==="family"?"the "+H(ed)+" draft":"the Policies and Procedures"} until you accept it, and accepting adds it as a new section.</div>`+mine.map(x=>`<details class="stpart"><summary><b>${H(x.title)}</b> ${st2(x)}</summary>
    <div class="cnt">${H(x.note||"")}</div>${md(x.body||"")}
    ${(x.links||[]).length?`<div class="actions">${x.links.map(l=>`<button class="btn small ghost" data-${l.doc==="family"?"fhopen":"hbopen"}="${H(l.id)}">${H(l.label)}</button>`).join("")}</div>`:""}
    ${(x.differences||[]).length?`<div class="lbl" style="margin-top:8px">Differences for you to decide</div><ul style="margin:4px 0;padding-left:20px">${x.differences.map(t=>`<li>${H(t)}</li>`).join("")}</ul>`:""}
    <div class="actions">${x.status==="accepted"?`<button class="linkbtn" data-stpol="${H(x.section||"")}">Open the section</button>`:`<button class="btn small" data-propaccept="${H(x.id)}">Accept it as a new section</button>${x.status==="aside"?`<button class="linkbtn" data-propback="${H(x.id)}">Back to waiting</button>`:`<button class="linkbtn" data-propaside="${H(x.id)}">Set it aside</button>`}`}</div></details>`).join(""))}
document.addEventListener("click",async e=>{const t=e.target.closest("[data-propaccept],[data-propaside],[data-propback]");if(!t)return;
  if(typeof VIEW_AS!=="undefined"&&VIEW_AS)return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  try{if(t.dataset.propaccept&&t.dataset.replace){const ta=document.querySelector(`[data-propto="${CSS.escape(t.dataset.propaccept)}"]`);if(!confirm("Replace this passage?"))return;await api("proposals/accept",{id:t.dataset.propaccept,to:ta?ta.value:undefined});toast("Replaced. The earlier wording is kept in its history.")}
    else if(t.dataset.propaccept){if(!confirm("Add this as a new section?"))return;await api("proposals/accept",{id:t.dataset.propaccept});toast("Added as a new section.")}
    else await api("proposals/aside",{id:t.dataset.propaside||t.dataset.propback,back:!!t.dataset.propback});
    st.pol={};redraw()}catch(er){fail(er)}});
async function pagePol(my,k){const dir=D();const want=LS.get(k==="family"?"tree.fh":"tree.hb","");if(want){st.polSec=want==="__contents"?"":want;st.polEdit=false;st.polHist=-1;LS.set(k==="family"?"tree.fh":"tree.hb",null)}
  const d=await loadPol(k);if(my!==RT)return;const secs=polSecs(d);const name=polName(k);const ed=k==="family"?d.edition:d.edition;
  if(st.polSec==="__new"&&dir)return draw(my,head(name,"A new section")+`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stpol="">‹ Contents</button></div>`+card("New section",polEditor(k,d,{id:"",title:"",body:""},true)));
  const s=secs.find(x=>x.id===st.polSec);
  if(s)return polSectionPage(my,k,d,secs,s);
  st.polSec="";
  const ack=d.ack;const mine=k==="teacher"&&!dir&&ack;
  const draft=k==="family"&&!d.live;
  const sub=k==="teacher"?`How we work, for every educator. The ${H(ed)} edition, every section in TREE. Open a section to read it, and print the whole book or any one section.`
    :draft?`The ${H(ed)} draft. Families keep reading the ${H(d.current)} edition until the publish date you choose.`:`For families and staff. The ${H(ed)} edition${d.current&&d.current!==ed?", an earlier edition":""}. Families read it on the Family page and acknowledge it at enrollment.`;
  const edPills=k==="family"&&(d.editions||[]).length>1?`<div class="actions" style="margin:0 0 10px">${d.editions.map(e=>`<button class="pill" aria-pressed="${e.year===ed}" data-stfhed="${H(e.year)}">${H(e.year)}${e.current?", current":!e.live?", draft":", earlier"}</button>`).join("")}</div>`:"";
  const list=d.parts.map(p=>{const one=p.sections.length===1&&p.sections[0].title===p.title;
    const row=x=>`<div class="prow"><button class="linkbtn" style="font-size:15px;text-align:left" data-stpol="${H(x.id)}">${H(x.title)}</button><span class="actions" style="margin:0">${polChips(k,d,x)}</span></div>`;
    return one?row(p.sections[0]):`<details class="stpart"><summary><b>${H(p.title)}</b> <span class="cnt">${p.sections.length===1?"1 section":p.sections.length+" sections"}</span></summary>${p.sections.map(row).join("")}</details>`}).join("");
  draw(my,head(name,k==="family"?`Family Handbook, ${H(ed)}`:name,sub)+edPills+
    (mine?ackCard(ack):"")+
    (k==="teacher"&&(B.me.newHire||B.me.newEd)&&!dir?mustReadCard(d):"")+
    card("Contents",`${list}${dir?`<div class="actions"><button class="btn small ghost" data-stpol="__new">Add a section</button></div>`:""}`,printBar("pol:"+k))+
    (dir&&k==="family"?fhDirCards(d):"")+
    (dir?await proposalsCard(k,ed):"")+(dir&&k==="family"?await fpiecesCard():"")+
    (dir?`<div id="stpolacks">${card(k==="family"?"Families who have read it":"Who has acknowledged it",`<div class="empty"><span class="spin"></span> Opening</div>`)}</div>`:""));
  if(dir)polAcksCard(k,d,my)}
// what a section shows beside its title in the contents
function polChips(k,d,x){const out=[];const ack=d.ack;
  if(ack&&(ack.changed||[]).some(c=>c.id===x.id))out.push(chip("soon","Changed, read again"));
  if(x.directorOnly)out.push(chip("missing","Only you"));if(x.removed)out.push(chip("out","Removed"));
  if(k==="family"&&!d.live&&D())out.push(x.same?chip("missing","As in "+(x.from||d.from)):chip("soonish","Changed for "+d.edition));
  if(k==="teacher"&&D()&&(d.mustRead||[]).includes(x.id))out.push(chip("soonish","Before the first day"));
  return out.join("")}
function ackCard(a){if(!a)return "";
  if(!a.due)return card("Your acknowledgment",`<div class="actions" style="margin:0">${chip("ok","Acknowledged for "+yearSpan(a.year)+", "+fms(a.yearAt))}</div>`);
  const ch=a.yearAt&&(a.changed||[]).length;
  return card("Your acknowledgment",ch?`<div class="hint">The director marked ${a.changed.length===1?"a section":"these sections"} as a significant change. Read ${a.changed.length===1?"it":"them"}, then say so.</div>${a.changed.map(c=>`<div class="prow"><button class="linkbtn" data-stpol="${H(c.id)}">${H(c.title)}</button><span class="cnt">Changed ${H(fms(c.changedAt))}</span></div>`).join("")}<div class="actions"><button class="btn small" data-stpolack="1">I have read the changes</button></div>`
    // a new educator says so in one place, the New Educator section, so this page points there
    :a.newHire||a.start>today()?`<div class="hint">A new educator reads the sections chosen for them before their first day and says so in the New Educator section.</div><div class="actions"><button class="btn small" data-tview="stnew">Open the New Educator section</button></div>`
    :`<div class="hint">Each school year, every educator reads the Policies and Procedures and says so. This is for the ${H(yearSpan(a.year))} school year.</div><div class="actions"><button class="btn small" data-stpolack="1">I have read the Policies and Procedures</button></div>`)}
function mustReadCard(d){const secs=polSecs(d).filter(s=>(d.mustRead||[]).includes(s.id));if(!secs.length)return "";
  return card("Before your first day",`<div class="hint">Begin with these sections. The rest are here whenever you need them.</div>${secs.map(s=>`<div class="prow"><button class="linkbtn" style="text-align:left" data-stpol="${H(s.id)}">${H(s.title)}</button></div>`).join("")}`)}
function fhDirCards(d){const draft=!d.live;const pb=d.public||{};const cur=d.current;
  return (draft?card("Publishing the "+d.edition+" edition",`<div class="hint">Families keep reading the ${H(cur)} edition. On the publish date the ${H(d.edition)} edition becomes current, and each family acknowledges it at their next enrollment or re-enrollment. The ${H(cur)} edition stays readable as an earlier edition.</div>
      <div class="kfields"><label>Publish date<input type="date" id="stfh-pub" value="${H(d.publishOn||"")}"></label></div><div class="actions"><button class="btn small" data-stfhpub="${H(d.edition)}">Save the date</button>${d.publishOn?`<span class="cnt">Becomes current ${H(fd(d.publishOn))}</span>`:`<span class="cnt">No date chosen yet</span>`}</div>`)
    :(d.edition===cur&&!(d.editions||[]).some(e=>!e.live)?card("Next year's edition",`<div class="hint">Start a draft of the ${+cur+1} edition from this one. Edit it section by section while families keep reading ${H(cur)}.</div><div class="actions"><button class="btn small ghost" data-stfhnew="1">Start the ${+cur+1} draft</button></div>`):""))+
    (d.edition===cur?card("The public link",`<div class="hint">A read-only page of the current Family Handbook for prospective families and the website, with no sign-in. It stays off until you read the list of names and private details TREE finds in the handbook and turn it on.</div>
      <div class="actions"><span class="stchip ${pb.open?"ok":"missing"}">${pb.open?"On":"Off"}</span>${pb.on&&!pb.open?`<span class="cnt">The ${H(cur)} edition's list has not been read yet, so the link is closed.</span>`:""}<button class="btn small ghost" data-stfhreview="1">Read the list</button>${pb.on?`<button class="linkbtn" data-stfhpublic="0">Turn it off</button>`:""}</div>
      ${pb.open?`<div class="cnt" style="margin-top:6px">The link, <a href="${H(publicLink())}" target="_blank" rel="noopener">${H(publicLink())}</a></div>`:""}<div id="stfhrev"></div>`):"")}
const publicLink=()=>new URL("handbook.html",location.href.split("#")[0].replace(/[^/]*$/,"")).href.split("?")[0];
async function polAcksCard(k,d,my){let r;try{r=st.polAcks||(st.polAcks=await api("policies/acks"))}catch(e){return}if(my!==RT)return;const el=$("#stpolacks");if(!el)return;
  if(k==="teacher"){const L=r.teacher||[];const n=L.filter(x=>!x.due).length;
    el.innerHTML=card("Who has acknowledged it",L.length?`<div class="tablewrap"><table class="grid2" style="min-width:460px"><thead><tr><th>Educator</th><th>This school year</th><th>Changed sections</th></tr></thead><tbody>${L.map(x=>`<tr data-stperson="${H(x.name)}" style="cursor:pointer"><td><b>${H(x.name)}</b>${x.newHire?` ${chip("soonish","New")}`:""}</td><td>${x.yearAt?chip("ok",fms(x.yearAt)):chip("soon","Not yet")}</td><td>${x.changed.length?chip("soon",x.changed.length+" to read"):x.yearAt?chip("ok","Up to date"):""}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No educator reads it yet.</div>`,`${n} of ${L.length}`);return}
  const F=r.family||{list:[]};const n=F.list.filter(x=>x.at).length;
  el.innerHTML=card("Families who have read it",`<div class="hint">Each family acknowledges the current edition, the ${H(F.edition)} edition, on the Family page. A new family does it at enrollment. When a new edition becomes current, a returning family sees one Read and acknowledge step at the top of the Family page.</div>${F.list.length?`<details><summary class="linkbtn">${n} of ${F.list.length} children's families</summary><div class="tablewrap"><table class="grid2" style="min-width:420px"><thead><tr><th>Child</th><th>Class</th><th>${H(F.edition)} edition</th></tr></thead><tbody>${F.list.map(x=>`<tr><td><b>${H(x.first)} ${H(x.last)}</b></td><td>${H(x.classroom)}</td><td>${x.at?chip("ok",fd(String(x.at).slice(0,10))):chip("missing",x.earlier?"Read "+x.earlier+", not yet "+F.edition:"Not yet")}</td></tr>`).join("")}</tbody></table></div></details>`:`<div class="empty">No children at our school yet.</div>`}`,`${n} of ${F.list.length}`)}

function polSectionPage(my,k,d,secs,s){const dir=D();const keep=T._keep;const i=secs.indexOf(s),pv=secs[i-1],nx=secs[i+1];const name=polName(k);
  const meta=[s.updatedAt?"Updated "+fms(s.updatedAt)+(s.updatedBy&&s.updatedBy!=="TREE"&&dir?" by "+s.updatedBy:""):"",s.partTitle!==s.title?"In "+s.partTitle:""].filter(Boolean).join(". ");
  const hist=dir?(s.history||[]):[];
  const edit=st.polEdit&&dir;
  draw(my,`${head(k==="family"?"Family Handbook, "+d.edition:name,s.title,H(meta)+(meta?".":""))}
    <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stpol="">‹ Contents</button>${polChips(k,d,s)}</div>
    ${edit?card("Edit",polEditor(k,d,s)):`<section class="card">${polHtml(s.body)}${s.kind==="piece"?`<div class="actions"><button class="btn small ghost" data-stpolpiece="${H(s.piece)}">In the PD library, Licensing at Fulton Community School</button></div>`:""}
      <div class="actions">${printBar("polsec:"+k)}${dir?`<button class="btn small ghost" data-stpoledit="1">Edit</button>`:""}${d.ack&&(d.ack.changed||[]).some(c=>c.id===s.id)?`<button class="btn small" data-stpolack="1">I have read the changes</button>`:""}</div></section>`}
    ${dir&&!edit?polDirCard(k,d,s):""}
    ${dir&&hist.length&&!edit?card("Earlier versions",`<details ${st.polHist>=0?"open":""}><summary class="linkbtn">${hist.length} earlier version${hist.length===1?"":"s"}</summary>${hist.map((h,j)=>({h,j})).reverse().map(({h,j})=>`<div class="strow"><div class="sttop"><b>${H(h.at?fms(h.at):"Before TREE")}</b><span class="cnt">${H(h.by||"")}</span></div>${h.note?`<div class="cnt">${H(h.note)}</div>`:""}
        <div class="actions" style="margin:0"><button class="btn small ghost" data-stpolhist="${j}">${st.polHist===j?"Close":"Read it"}</button><button class="linkbtn" data-stpolrestore="${j}">Restore this version</button></div>${st.polHist===j?`<div class="stq" style="margin-top:6px"><b>${H(h.title)}</b>${polHtml(h.body)}</div>`:""}</div>`).join("")}</details>`):""}
    <div class="actions">${pv?`<button class="btn small ghost" data-stpol="${H(pv.id)}">‹ ${H(pv.title)}</button>`:""}${nx?`<button class="btn small ghost" data-stpol="${H(nx.id)}">${H(nx.title)} ›</button>`:""}</div>`);
  fillPics();if(!keep)jumpTop()}
function polDirCard(k,d,s){const out=[];
  if(k==="teacher"){out.push(`<label class="radio"><input type="checkbox" data-stpolmust="${H(s.id)}" ${(d.mustRead||[]).includes(s.id)?"checked":""}><span>A new educator reads this before their first day</span></label>`);
    if(s.kind==="own")out.push(`<label class="radio"><input type="checkbox" data-stpolonly="${H(s.id)}" ${s.directorOnly?"checked":""}><span>Only you see this section</span></label>`);}
  if(s.note)out.push(`<div class="cnt">The last change, ${H(s.note)}</div>`);
  if(s.changedAt)out.push(`<div class="cnt">Marked as a significant change ${H(fms(s.changedAt))}. Every educator acknowledges it again.</div>`);
  if(s.kind==="handbook"||s.kind==="piece")out.push(`<div class="cnt">TREE keeps this section ${s.kind==="piece"?"as a Licensing at Fulton Community School piece in the PD library":"with the Educators pages"}, and it is the same words in both places.</div>`);
  out.push(`<div class="actions" style="margin:4px 0 0"><button class="linkbtn" data-stpolrm="${H(s.id)}|${s.removed?0:1}">${s.removed?"Put this section back":"Remove this section"}</button></div>`);
  return card("For you",out.join(""))}
function polEditor(k,d,s,isNew){return `<div class="hint">Write in plain text. A line starting with ### is a heading. A dash starts a list item, a number and a full stop a numbered item, and two spaces in front put an item inside the one above. A line starting with &gt; is set in. **Words** are bold, and [words](link) is a link. A line ending in two spaces breaks there.</div>
  ${isNew?`<label class="fld-label">Part<select id="stpol-part"><option value="">A new part at the end</option>${d.parts.map(p=>`<option value="${H(p.id)}">${H(p.title)}</option>`).join("")}</select></label>`:""}
  <label class="fld-label">Title<input type="text" id="stpol-title" value="${H(s.title)}"></label><label class="fld-label">Text<textarea id="stpol-body" rows="20">${H(s.body)}</textarea></label>
  <label class="fld-label">A short note about this change<input type="text" id="stpol-note" placeholder="Such as Updated the pickup time" maxlength="300"></label>
  ${k==="teacher"&&!isNew?`<label class="radio"><input type="checkbox" id="stpol-sig"><span>A significant change. Every educator reads this section again and says so.</span></label>`:""}
  <div class="actions"><button class="btn" data-stpolsave="${H(s.id)}">Save</button><button class="linkbtn" data-stpolcancel="1">Cancel</button></div>`}
// the director's list of names and private details in the Family Handbook, read before the public link opens
async function fhReview(){const el=$("#stfhrev");if(!el)return;el.innerHTML=`<div class="empty"><span class="spin"></span> Reading the handbook</div>`;
  try{const r=await api("policies/review");const pb=r.public||{};const hide=pb.hide||{};const by={};for(const f of r.findings)(by[f.section]=by[f.section]||{title:f.title,part:f.part,list:[]}).list.push(f);
    el.innerHTML=`<h4 style="margin:12px 0 4px">What TREE found in the ${H(r.edition)} edition</h4><div class="hint">Staff names, children's and family members' names, phone numbers, email addresses and street addresses other than the school's own. Choose any section to leave out of the public link, then turn it on.</div>
      ${Object.keys(by).length?Object.entries(by).map(([id,x])=>`<div class="strow"><div class="sttop"><b>${H(x.title)}</b><label class="radio" style="margin:0"><input type="checkbox" data-stfhhide="${H(id)}" ${hide[id]?"checked":""}><span>Leave out of the public link</span></label></div>${x.list.map(f=>`<div class="cnt">${H(f.kind)}, <b>${H(f.what)}</b>. <span>${H(f.near)}</span></div>`).join("")}</div>`).join(""):`<div class="empty">Nothing was found.</div>`}
      <div class="actions"><button class="btn small" data-stfhpublic="1">I have read the list. Turn the public link on</button></div>`}catch(e){el.innerHTML=`<div class="hint warnline">${H(e.message||"The list could not be read.")}</div>`}}

// an educator's acknowledgment, on their records page and the director's view of it
function polRecordCard(a,mine){const who=mine?"you":"they";
  return card("Policies and Procedures",`<div class="actions" style="margin:0">${a.yearAt?chip("ok","Acknowledged for "+yearSpan(a.year)+", "+fms(a.yearAt)):chip("soon","Not acknowledged for "+yearSpan(a.year)+" yet")}${(a.changed||[]).length?chip("soon",a.changed.length+" changed section"+(a.changed.length===1?"":"s")+" to read"):""}<button class="btn small ghost" data-tview="sthb">Open them</button></div>
    <div class="hint" style="margin-top:6px">Each school year ${who} read${mine?"":"s"} the Policies and Procedures and say${mine?"":"s"} so, and again for any section the director marks as a significant change.</div>`)}
// the policies a new educator reads before their first day, in the New Educator section
async function newPolCard(p,dir){let d=null;try{d=await loadPol("teacher")}catch(e){return ""}const a=p.policy;const secs=polSecs(d).filter(s=>(d.mustRead||[]).includes(s.id));
  const mine=!dir&&p.name===meName();
  return card("Policies and Procedures, before the first day",`<div class="hint">${dir?"What "+H(p.name)+" reads before their first day. You choose these sections in the Policies and Procedures.":"Read these sections before your first day, then say so. The rest are there whenever you need them."}</div>
    ${secs.map(s=>`<div class="prow"><button class="linkbtn" style="text-align:left" data-hbopen="${H(s.id)}">${H(s.title)}</button></div>`).join("")}
    <div class="actions">${a&&a.yearAt?chip("ok","Acknowledged "+fms(a.yearAt)):mine?`<button class="btn small" data-stpolack="1">I have read the Policies and Procedures</button>`:chip("missing","Not acknowledged yet")}<button class="btn small ghost" data-tview="sthb">All of them</button></div>`)}
async function polTap(d,t){const pk=POLV[view]||"teacher";
  if(d.stpol!=null){st.polSec=d.stpol;st.polEdit=false;st.polHist=-1;if(!POLV[view])goView("sthb");else T.render(view);return true}
  if(d.stfhed){st.fhYear=d.stfhed;st.polSec="";redraw();return true}
  if(d.stpolhist!=null){const j=+d.stpolhist;st.polHist=st.polHist===j?-1:j;redraw();return true}
  if(d.stpolpiece){st.mod="licensing";st.piece=d.stpolpiece;goView("stpd");return true}
  if(d.stpolack){try{const r=await api("policies/ack");st.pol={};st.doc=null;toast(r.ack&&!r.ack.due?"Thank you. It is on your records.":"Thank you.");redraw()}catch(er){fail(er)}return true}
  if(d.stpoledit){st.polEdit=true;redraw();return true}
  if(d.stpolcancel){st.polEdit=false;if(st.polSec==="__new")st.polSec="";redraw();return true}
  if(d.stpolsave!=null){const title=($("#stpol-title")?.value||"").trim(),body=$("#stpol-body")?.value||"",note=($("#stpol-note")?.value||"").trim();
    if(!title){toast("Give the section a title.");return true}if(!note&&d.stpolsave){toast("Write a short note about this change.");$("#stpol-note")?.focus();return true}
    try{const dd=st.pol[polKey(pk)];const r=await api("policies/save",{doc:pk,edition:pk==="family"?dd.edition:undefined,id:d.stpolsave,part:$("#stpol-part")?.value||"",title,body,note,significant:!!$("#stpol-sig")?.checked});
      st.polSec=r.id;st.polEdit=false;st.polAcks=null;await loadPol(pk,true);toast(r.same?"Nothing changed.":"Saved, with the earlier wording kept.");T.render(view)}catch(er){fail(er)}return true}
  if(d.stpolrm){const [id,on]=d.stpolrm.split("|");if(on==="1"&&!confirm("Remove this section? It stays in the records, and you can put it back."))return true;
    try{const dd=st.pol[polKey(pk)];await api("policies/save",{doc:pk,edition:pk==="family"?dd.edition:undefined,id,remove:on==="1"});await loadPol(pk,true);redraw()}catch(er){fail(er)}return true}
  if(d.stpolrestore!=null){const dd=st.pol[polKey(pk)];if(!confirm("Restore this version? The wording there now is kept as an earlier version."))return true;
    try{await api("policies/restore",{doc:pk,edition:pk==="family"?dd.edition:undefined,id:st.polSec,index:+d.stpolrestore});st.polHist=-1;st.polAcks=null;await loadPol(pk,true);toast("Restored.");redraw()}catch(er){fail(er)}return true}
  if(d.stfhpub){const v=$("#stfh-pub")?.value||"";if(v&&v<=today()&&!confirm(`Publish the ${d.stfhpub} edition today? Families read it from now on.`))return true;
    try{await api("policies/settings",{doc:"family",edition:d.stfhpub,publishOn:v});st.pol={};toast(v?"Saved. It becomes current on "+fd(v)+".":"The publish date is cleared.");redraw()}catch(er){fail(er)}return true}
  if(d.stfhnew){try{const r=await api("policies/settings",{doc:"family",newDraft:true});st.pol={};st.fhYear=r.edition;toast(`The ${r.edition} draft is started from the current edition.`);redraw()}catch(er){fail(er)}return true}
  if(d.stfhreview){await fhReview();return true}
  if(d.stfhpublic){const on=d.stfhpublic==="1";try{await api("policies/public",{on,reviewed:on});st.pol={};toast(on?"The public link is on.":"The public link is off.");redraw()}catch(er){fail(er)}return true}
  return false}
async function polChange(t,d){
  if(d.stpolmust){const dd=st.pol.teacher;const set=new Set(dd.mustRead||[]);if(t.checked)set.add(d.stpolmust);else set.delete(d.stpolmust);
    try{await api("policies/settings",{doc:"teacher",mustRead:[...set]});dd.mustRead=[...set];toast("Saved.")}catch(er){t.checked=!t.checked;fail(er)}return}
  if(d.stpolonly){try{await api("policies/save",{doc:"teacher",id:d.stpolonly,directorOnly:t.checked});await loadPol("teacher",true);toast(t.checked?"Only you see it now.":"Every educator sees it.");redraw()}catch(er){t.checked=!t.checked;fail(er)}return}
  if(d.stfhhide){try{await api("policies/public",{hide:{[d.stfhhide]:t.checked}});toast("Saved.")}catch(er){t.checked=!t.checked;fail(er)}}}

/* ---------- the policies in print, the whole book or one section, as a PDF and a Word file ----------
   The whole book has a cover with the edition year, a table of contents with page numbers, a page number on every
   page, and each part starting on a new page. The Family Handbook ends with a page for a family to sign on paper. */
const PAGE={w:612,h:792,l:60,r:60,t:64,b:78};
const INK=[34,51,42],MOSS=[47,90,67],MUTED=[93,110,99],RULE=[200,210,202];
// a character Andika cannot draw becomes the nearest one it can, so no word is lost on paper
const pdfText=s=>{s=String(s||"").replace(/→/g,"->").replace(/◊/g,"•");return (typeof PF!=="undefined"&&PF.b64)?s:clean(s)};
async function picData(p){const b=await picBlob(p);const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(b)});
  const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});return {url,w:im.naturalWidth,h:im.naturalHeight,type:/png/.test(b.type)?"PNG":"JPEG",buf:await b.arrayBuffer()}}
async function polPictures(d,list){const want=new Set();if(d.image)want.add(d.image);for(const s of list)for(const b of PM().blocks(s.body))if(b.t==="img")want.add(b.src);
  const out={};for(const p of want){try{out[p]=await picData(p)}catch(e){}}return out}
function pdfWriter(doc,pics){let y=PAGE.t;const W=PAGE.w-PAGE.l-PAGE.r;const marks=[];
  const newPage=()=>{doc.addPage("letter","portrait");y=PAGE.t};
  const room=h=>{if(y+h>PAGE.h-PAGE.b){newPage();return true}return false};
  const font=(r,size)=>{doc.setFont("helvetica",r&&r.b?"bold":"normal");doc.setFontSize(size)};
  // words laid out a line at a time, each keeping its own bold and link
  function words(rs,size,x,w,lh,color){const toks=[];for(const r of rs){if(r.br){toks.push({br:true});continue}for(const p of pdfText(r.text).split(/(\s+)/))if(p)toks.push({text:p,r,sp:/^\s+$/.test(p)})}
    const lines=[];let line=[],lw=0;
    for(const t of toks){if(t.br){lines.push(line);line=[];lw=0;continue}font(t.r,size);const tw=doc.getTextWidth(t.sp?" ":t.text);
      if(t.sp){if(line.length){line.push({text:" ",r:t.r,w:tw,sp:true});lw+=tw}continue}
      if(lw+tw>w&&line.length){while(line.length&&line[line.length-1].sp)line.pop();lines.push(line);line=[];lw=0}
      if(tw>w){let cur="";for(const ch of t.text){font(t.r,size);if(doc.getTextWidth(cur+ch)>w&&cur){lines.push([{text:cur,r:t.r,w:doc.getTextWidth(cur)}]);cur=""}cur+=ch}t.text=cur;font(t.r,size)}
      line.push({text:t.text,r:t.r,w:doc.getTextWidth(t.text)});lw+=line[line.length-1].w}
    if(line.length)lines.push(line);
    for(const ln of lines){room(lh);let cx=x;for(const t of ln){font(t.r,size);doc.setTextColor(...(t.r.link?MOSS:color||INK));if(!t.sp){if(t.r.link)doc.textWithLink(t.text,cx,y,{url:t.r.link});else doc.text(t.text,cx,y);
      if(t.r.u||t.r.link){doc.setDrawColor(...(t.r.link?MOSS:color||INK));doc.setLineWidth(.4);doc.line(cx,y+1.6,cx+t.w,y+1.6)}}cx+=t.w}y+=lh}
    if(!lines.length)y+=lh}
  function table(rows){if(!rows.length)return;const n=Math.max(...rows.map(r=>r.length));const cw=W/n,pad=4,size=9,lh=12;
    for(let ri=0;ri<rows.length;ri++){const row=rows[ri];
      const hts=row.map(c=>{const t=pdfText(c.map(r=>r.br?"\n":r.text).join(""));font({b:ri===0},size);return Math.max(1,doc.splitTextToSize(t||" ",cw-2*pad).length)*lh+2*pad});const h=Math.max(...hts,lh+2*pad);
      room(h);for(let ci=0;ci<n;ci++){const c=row[ci]||[];doc.setDrawColor(...RULE);doc.setLineWidth(.6);doc.rect(PAGE.l+ci*cw,y-lh+2,cw,h);font({b:ri===0||c.some(r=>r.b)},size);doc.setTextColor(...INK);
        const t=pdfText(c.map(r=>r.br?"\n":r.text).join(""));doc.splitTextToSize(t||"",cw-2*pad).forEach((l,k)=>doc.text(l,PAGE.l+ci*cw+pad,y+pad+k*lh))}
      y+=h}y+=6}
  function image(src,alt){const p=pics[src];if(!p){words([{text:alt||"A picture"}],9,PAGE.l,W,12,MUTED);return}
    const maxH=PAGE.h-PAGE.t-PAGE.b-20;let w=Math.min(W,p.w*.6),h=w*p.h/p.w;if(h>maxH){h=maxH;w=h*p.w/p.h}if(h>300&&y>PAGE.t+40)room(h+8);else room(h+8);
    doc.addImage(p.url,p.type,PAGE.l+(W-w)/2,y-8,w,h);y+=h+6}
  function body(text){for(const b of PM().blocks(text)){const ind=b.quote?18:0;
    if(b.t==="h"){const size=b.level<=2?13.5:b.level===3?12:11;room(size*3);y+=6;words(b.runs.map(r=>Object.assign({},r,{b:true})),size,PAGE.l+ind,W-ind,size*1.35,MOSS);y+=2}
    else if(b.t==="p"){words(b.runs,10.5,PAGE.l+ind,W-ind,14.5);y+=5}
    else if(b.t==="list"){for(const it of b.items){const x=PAGE.l+ind+it.level*16;room(14.5);font({},10.5);doc.setTextColor(...INK);doc.text(it.ordered?it.n+".":"•",x,y);words(it.runs,10.5,x+16,W-ind-it.level*16-16,14.5);y+=2}y+=4}
    else if(b.t==="table")table(b.rows);
    else if(b.t==="img")image(b.src,b.alt)}}
  return {get y(){return y},set y(v){y=v},newPage,room,words,body,W,marks,page:()=>doc.getNumberOfPages()}}
// the parts and sections, each part on a new page. It returns the page each part and section starts on.
function polBody(doc,pics,d,parts,opt){const P=pdfWriter(doc,pics);const starts=[];let first=true;
  for(const p of parts){if(!first||opt.newFirst)P.newPage();first=false;starts.push({title:p.title,page:P.page(),level:1});
    P.words([{text:p.title,b:true}],20,PAGE.l,P.W,25,MOSS);P.y+=6;
    for(const s of p.sections){const own=p.sections.length>1||s.title!==p.title;if(own){P.room(60);P.y+=6;starts.push({title:s.title,page:P.page(),level:2});P.words([{text:s.title,b:true}],15,PAGE.l,P.W,19,INK);P.y+=4}
      P.body(s.body);P.y+=8}}
  return {starts,P}}
function polCover(doc,pics,d,name){const W=PAGE.w;doc.setTextColor(...MOSS);doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text("FULTON COMMUNITY SCHOOL & FARM",W/2,110,{align:"center"});
  doc.setFontSize(32);doc.setTextColor(...INK);doc.splitTextToSize(name,W-140).forEach((l,i)=>doc.text(l,W/2,170+i*38,{align:"center"}));
  doc.setFontSize(54);doc.setTextColor(...MOSS);doc.text(String(d.edition||""),W/2,300,{align:"center"});
  const p=pics[d.image];if(p){const h=340,w=h*p.w/p.h;doc.addImage(p.url,p.type,(W-w)/2,340,w,h)}}
function polToc(doc,starts,offset,perPage){let i=0;for(const e of starts){if(i%perPage===0){if(i)doc.addPage("letter","portrait");doc.setFont("helvetica","bold");doc.setFontSize(20);doc.setTextColor(...MOSS);doc.text(i?"Contents, continued":"Contents",PAGE.l,PAGE.t+10)}
    const y=PAGE.t+46+(i%perPage)*17;const x=PAGE.l+(e.level===2?18:0);doc.setFont("helvetica",e.level===1?"bold":"normal");doc.setFontSize(e.level===1?11:10);doc.setTextColor(...INK);
    const t=doc.splitTextToSize(pdfText(e.title),PAGE.w-PAGE.r-x-50)[0];doc.text(t,x,y);const tw=doc.getTextWidth(t);const pg=String(e.page+offset);
    doc.setTextColor(...MUTED);const dots=x+tw+6;const end=PAGE.w-PAGE.r-doc.getTextWidth(pg)-6;if(end>dots){doc.setLineDashPattern([1,3],0);doc.setDrawColor(...RULE);doc.line(dots,y,end,y);doc.setLineDashPattern([],0)}
    doc.text(pg,PAGE.w-PAGE.r,y,{align:"right"});doc.link(PAGE.l,y-10,PAGE.w-PAGE.l-PAGE.r,14,{pageNumber:e.page+offset});i++}}
function polAckPage(doc,d,P){P.newPage();P.words([{text:"Family Handbook Acknowledgment",b:true}],20,PAGE.l,P.W,25,MOSS);P.y+=10;
  P.words(PM().runs(`I have received and read the Fulton Community School & Farm Family Handbook, ${d.edition} edition. I understand its policies and agree to follow them.`),11.5,PAGE.l,P.W,16);P.y+=24;
  const line=(label)=>{P.room(44);doc.setDrawColor(...INK);doc.setLineWidth(.7);doc.line(PAGE.l,P.y,PAGE.w-PAGE.r,P.y);doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(...MUTED);doc.text(label,PAGE.l,P.y+12);P.y+=42};
  line("Child's name");line("Parent or guardian's name");line("Signature");line("Date");P.y+=10;line("Second parent or guardian's name");line("Signature");line("Date");
  P.words(PM().runs("Please return this page to the office. It is kept in your child's file."),10,PAGE.l,P.W,14,MUTED)}
function polFooters(doc,d,cover){const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setDrawColor(...RULE);doc.setLineWidth(.6);doc.line(PAGE.l,PAGE.h-50,PAGE.w-PAGE.r,PAGE.h-50);
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(...MUTED);doc.text(pdfText(d.footer||"Fulton Community School & Farm"),PAGE.l,PAGE.h-36);doc.text(`Page ${i} of ${n}`,PAGE.w-PAGE.r,PAGE.h-36,{align:"right"})}}
async function polPdf(k,d,which){await loadPrintFonts();const name=polName(k);const sec=which==="sec"?polSecs(d).find(s=>s.id===st.polSec):null;
  const parts=sec?[{title:sec.title,sections:[sec]}]:polBook(d);const pics=await polPictures(d,parts.flatMap(p=>p.sections));
  const file=sec?`${name} ${d.edition}, ${sec.title}`:`${name} ${d.edition}`;
  if(sec){const doc=planDoc({unit:"pt",format:"letter"});doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...MOSS);doc.text(pdfText(`${name.toUpperCase()}, ${d.edition}`),PAGE.l,PAGE.t-24);
    polBody(doc,pics,d,parts,{});polFooters(doc,d);await saveFile(doc.output("blob"),safeFile(file)+".pdf");return}
  // a first pass finds the page each part starts on, then the book is made with its contents ahead of it
  const scratch=planDoc({unit:"pt",format:"letter"});const {starts}=polBody(scratch,pics,d,parts,{});
  const per=38,tocPages=Math.ceil(starts.length/per);const doc=planDoc({unit:"pt",format:"letter"});polCover(doc,pics,d,name);doc.addPage("letter","portrait");polToc(doc,starts,1+tocPages,per);
  const {P}=polBody(doc,pics,d,parts,{newFirst:true});if(k==="family")polAckPage(doc,d,P);polFooters(doc,d);await saveFile(doc.output("blob"),safeFile(file)+".pdf")}
async function polWord(k,d,which){let X;try{X=await TREE_KIT.word()}catch(e){toast("The Word tool did not load. Check your connection and reload.");return}
  await loadPrintFonts();const {Document,Packer,Paragraph,TextRun,ExternalHyperlink,Table,TableRow,TableCell,WidthType,ImageRun,Footer,PageNumber,HeadingLevel,AlignmentType,TableOfContents,PageBreak,BorderStyle}=X;
  const name=polName(k);const sec=which==="sec"?polSecs(d).find(s=>s.id===st.polSec):null;const parts=sec?[{title:sec.title,sections:[sec]}]:polBook(d);const pics=await polPictures(d,parts.flatMap(p=>p.sections));
  const F=PF.buf?PF.word.fr:"Arial";let listNo=0;
  const run=(r,o)=>r.br?new TextRun({break:1}):new TextRun(Object.assign({text:r.text,bold:!!r.b,italics:!!r.i,underline:r.u||r.link?{}:undefined,font:F,color:r.link?"2F5A43":undefined},o||{}));
  const inl=(rs,o)=>rs.map(r=>r.link&&!r.br?new ExternalHyperlink({link:r.link,children:[run(r,o)]}):run(r,o));
  const img=(src,alt)=>{const p=pics[src];if(!p)return new Paragraph({children:[new TextRun({text:alt||"A picture",italics:true,font:F})]});let w=Math.min(600,p.w*.8),h=w*p.h/p.w;if(h>760){h=760;w=h*p.w/p.h}
    return new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:80,after:120},children:[new ImageRun({type:p.type==="PNG"?"png":"jpg",data:p.buf,transformation:{width:Math.round(w),height:Math.round(h)}})]})};
  const bodyOf=text=>{const out=[];for(const b of PM().blocks(text)){const ind=b.quote?{left:440}:undefined;
    if(b.t==="h")out.push(new Paragraph({heading:b.level<=3?HeadingLevel.HEADING_3:HeadingLevel.HEADING_4,keepNext:true,spacing:{before:160,after:60},children:inl(b.runs,{bold:true,color:"2F5A43"})}));
    else if(b.t==="p")out.push(new Paragraph({indent:ind,spacing:{after:120},children:inl(b.runs,{size:21})}));
    else if(b.t==="list"){listNo++;for(const it of b.items)out.push(it.ordered?new Paragraph({numbering:{reference:"pnum",level:Math.min(3,it.level),instance:listNo},spacing:{after:60},children:inl(it.runs,{size:21})}):new Paragraph({bullet:{level:Math.min(3,it.level)},spacing:{after:60},children:inl(it.runs,{size:21})}))}
    else if(b.t==="table"){const n=Math.max(...b.rows.map(r=>r.length));const bd={style:BorderStyle.SINGLE,size:4,color:"C8D2CA"};
      out.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:b.rows.map((r,ri)=>new TableRow({tableHeader:ri===0,children:Array.from({length:n},(_,ci)=>new TableCell({width:{size:Math.floor(100/n),type:WidthType.PERCENTAGE},borders:{top:bd,bottom:bd,left:bd,right:bd},margins:{top:60,bottom:60,left:100,right:100},children:[new Paragraph({children:inl(r[ci]||[],{size:19,bold:ri===0?true:undefined})})]}))}))}));out.push(new Paragraph({children:[]}))}
    else if(b.t==="img")out.push(img(b.src,b.alt))}return out};
  const ch=[];
  if(!sec){ch.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:600,after:200},children:[new TextRun({text:"FULTON COMMUNITY SCHOOL & FARM",bold:true,size:24,color:"2F5A43",font:F})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:name,bold:true,size:64,font:F})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:300},children:[new TextRun({text:String(d.edition||""),bold:true,size:108,color:"2F5A43",font:F})]}));
    if(pics[d.image])ch.push(img(d.image,""));
    ch.push(new Paragraph({children:[new PageBreak()]}),new Paragraph({heading:HeadingLevel.TITLE,children:[new TextRun({text:"Contents",bold:true,font:F,color:"2F5A43"})]}),new TableOfContents("Contents",{hyperlink:true,headingStyleRange:"1-2"}))}
  else ch.push(new Paragraph({children:[new TextRun({text:`${name.toUpperCase()}, ${d.edition}`,bold:true,size:16,color:"2F5A43",font:F})]}));
  for(const p of parts){ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,pageBreakBefore:!sec,spacing:{after:160},children:[new TextRun({text:p.title,bold:true,size:40,color:"2F5A43",font:F})]}));
    for(const s of p.sections){if(p.sections.length>1||s.title!==p.title)ch.push(new Paragraph({heading:HeadingLevel.HEADING_2,keepNext:true,spacing:{before:240,after:100},children:[new TextRun({text:s.title,bold:true,size:30,font:F})]}));ch.push(...bodyOf(s.body))}}
  if(k==="family"&&!sec){ch.push(new Paragraph({heading:HeadingLevel.HEADING_1,pageBreakBefore:true,spacing:{after:200},children:[new TextRun({text:"Family Handbook Acknowledgment",bold:true,size:40,color:"2F5A43",font:F})]}),
      new Paragraph({spacing:{after:480},children:[new TextRun({text:`I have received and read the Fulton Community School & Farm Family Handbook, ${d.edition} edition. I understand its policies and agree to follow them.`,size:23,font:F})]}));
    for(const l of ["Child's name","Parent or guardian's name","Signature","Date","Second parent or guardian's name","Signature","Date"])ch.push(new Paragraph({spacing:{before:420},border:{top:{style:BorderStyle.SINGLE,size:6,color:"22302A",space:2}},children:[new TextRun({text:l,size:18,color:"5D6E63",font:F})]}));
    ch.push(new Paragraph({spacing:{before:360},children:[new TextRun({text:"Please return this page to the office. It is kept in your child's file.",size:20,color:"5D6E63",font:F})]}))}
  const foot=new Footer({children:[new Paragraph({border:{top:{style:BorderStyle.SINGLE,size:4,color:"C8D2CA",space:6}},children:[new TextRun({text:(d.footer||"Fulton Community School & Farm")+"     ",size:15,color:"5D6E63",font:F}),new TextRun({children:["Page ",PageNumber.CURRENT," of ",PageNumber.TOTAL_PAGES],size:15,color:"5D6E63",font:F})]})]});
  const wf=wordFonts();
  const docx=TREE_KIT.wordFile(X,Object.assign({creator:"TREE, Fulton Community School",title:sec?`${name}, ${sec.title}`:name,features:{updateFields:true},
    numbering:{config:[{reference:"pnum",levels:[0,1,2,3].map(l=>({level:l,format:"decimal",text:`%${l+1}.`,alignment:AlignmentType.START,style:{paragraph:{indent:{left:440*(l+1),hanging:300}}}}))}]},
    styles:{default:{document:{run:{font:F}}}},sections:[{properties:{page:{margin:{top:1000,bottom:1000,left:1100,right:1100}}},footers:{default:foot},children:ch}]},wf.length?{fonts:wf}:{}));
  const blob=await TREE_KIT.wordBlob(X,docx);await saveFile(blob,safeFile(sec?`${name} ${d.edition}, ${sec.title}`:`${name} ${d.edition}`)+".docx")}

/* ---------- Settings, the director's ---------- */
T.settings=async function(el){try{await boot(true);await loadPeople();if(window.TreeGrowth)await TreeGrowth.ready().catch(()=>{})}catch(e){el.innerHTML=`<div class="lbl">Educators</div><div class="hint warnline">${H(e.message||"This part could not open.")}</div>`;return}
  const o=B.open,ps=st.people;const names=ps.map(p=>p.name);
  const sw=(k,l,d)=>`<div class="prow"><div><b>${H(l)}</b><div class="cnt">${H(d)}</div></div><div class="seg" role="group" aria-label="${H(l)}"><button data-stsw="${k}|1" aria-pressed="${!!o[k]}">On</button><button data-stsw="${k}|0" aria-pressed="${!o[k]}">Off</button></div></div>`;
  const rm=B.school.remind||{};
  el.innerHTML=`<div class="lbl">Educators</div><div class="hint">Each part shows only to you until you turn it on for educators. A new educator reaches only the New Educator section until you turn on full access.</div>
    ${sw("records","Records pages","Each educator's own dates, certificates, immunizations, units and hours")}${sw("pd","PD library","The modules, Licensing at Fulton Community School and the TREE How To guides")}${sw("handbook","Policies and Procedures","The whole document, readable by every signed-in educator")}${sw("newed","New Educator section","For new educators, from before their first day through their first two months")}${sw("family","Family Handbook","The current edition, readable by every staff sign-in but the kitchen")}${sw("growth","Growth","The continuum and evaluation, the journal, check-ins, the Growth Plan, Proud Moments and PD days, for educators and apprentices")}
    <div class="prow"><div><b>Go-to person</b><div class="cnt">One go-to person for every new educator. The Class team still helps on the floor.</div></div><select id="sts-goto" aria-label="Go-to person"><option value="">None</option>${ps.filter(p=>p.role!=="Director"&&p.role!=="Kitchen"&&!(p.profile||{}).neverGoTo).map(p=>`<option ${B.school.goTo===p.name?"selected":""}>${H(p.name)}</option>`).join("")}</select></div>
    <div class="prow"><div><b>Records reminders</b><div class="cnt">${B.open&&B.open.records?"On for every educator. Only you change them.":"They wait until records pages are open for educators. Nothing is sent or used up before then. New educators hear theirs now."}</div></div><label class="cnt">Days ahead <input type="number" id="sts-days" min="7" max="120" value="${H(B.school.remindDays||30)}" style="width:70px"></label></div>
    <div class="chips" style="margin-top:6px">${Object.entries(B.defs.remind).map(([k,l])=>`<button class="chip ${rm[k]!==false?"on":""}" type="button" data-stremind="${k}">${H(l)}</button>`).join("")}</div>
    <div class="sglist" style="margin-top:12px">
    ${ps.map(p=>{const pr=p.profile||{};const staffRole=pr.role==="staff"||p.role==="Kitchen"||p.role==="Director";const last=typeof signins!=="undefined"&&signins.list?(signins.list.find(a=>a.name===p.name)||{}).lastAt:0;
      return `<details class="sgrow" data-rowkey="ed:${H(p.name)}" ${typeof rowOpen!=="undefined"&&rowOpen==="ed:"+p.name?"open":""}><summary><b>${H(p.name)}</b><span class="cnt">${H(p.room||"No Class")}</span><span class="cnt sglast">${p.newHire?"New Educator section only":last?H(typeof sgDay==="function"?sgDay(last):fd(new Date(last).toISOString().slice(0,10))):"Never signed in"}</span></summary><div class="sgbody"><div class="sgf"><span>Role</span>${p.role==="Director"?"Director":`<select data-stprof="${H(p.name)}|role" aria-label="${H(p.name)}, role">${[["educator","Educator"],["apprentice","Apprentice"],["staff","Staff, records only"]].map(([v,l])=>`<option value="${v}" ${(pr.role||"educator")===v||(v==="educator"&&pr.role==="atelierista")?"selected":""}>${l}</option>`).join("")}</select>`}</div>
      <label class="radio"><input type="checkbox" data-stprof="${H(p.name)}|garden" ${pr.garden?"checked":""}><span>Garden educator, beside their own role</span></label>
      <div class="sgf"><span>Class</span><select data-stprof="${H(p.name)}|room" aria-label="${H(p.name)}, Class"><option value="">None</option>${CLASSROOMS.map(r=>`<option value="${H(r)}" ${p.room===r?"selected":""}>${H(r)} Class</option>`).join("")}</select></div>
      ${staffRole?"":`<div class="sgf"><span>Planning hour</span><select data-stprof="${H(p.name)}|planHour" aria-label="${H(p.name)}, monday planning hour"><option value="">Not set</option>${["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","14:00","15:00","16:00"].map(h=>`<option value="${h}" ${pr.planHour===h?"selected":""}>${hourText(h)}</option>`).join("")}</select></div>`}
      <div class="sgf"><span>Check-ins</span>${staffRole?`<span class="cnt">Records only</span>`:`<select data-stprof="${H(p.name)}|checkin" aria-label="${H(p.name)}, check-ins">${[["","From the planning hour"],["slot","In the planning hour"],["second","Short second Monday"],["asneeded","As needed"]].map(([v,l])=>`<option value="${v}" ${(pr.checkin||"")===v?"selected":""}>${l}</option>`).join("")}</select>`}</div>
      ${staffRole?"":`<div class="sgf"><span>Journal</span><select data-stprof="${H(p.name)}|journalEvery" aria-label="${H(p.name)}, journal"><option value="1" ${+pr.journalEvery!==2?"selected":""}>Each week</option><option value="2" ${+pr.journalEvery===2?"selected":""}>Every other week, part time</option></select></div>`}
      <div class="sgf"><span>Start date</span><input type="date" data-stprof="${H(p.name)}|startDate" value="${H(pr.startDate||"")}" aria-label="${H(p.name)}, start date"></div></div></details>`}).join("")}</div>
    ${window.TreeGrowth?TreeGrowth.settingsHtml(B):""}
    <details style="margin-top:10px"><summary class="linkbtn">Blank form links for the New Educator paperwork</summary><div class="hint" style="margin-top:6px">The state forms link to the CDSS forms page. Replace any link with the copy the school uses.</div>
      ${PAPERS().filter(x=>!x.director&&!x.ack&&x.k!=="immun").map(x=>`<label class="fld-label">${H(x.form)}, ${H(x.num)}<input type="url" data-stform="${x.k}" value="${H((B.school.formLinks||{})[x.k]||x.blank||"")}" placeholder="A link to the blank form"></label>`).join("")}
      <div class="actions"><button class="btn small" data-stforms="1">Save the links</button></div></details>
    <div class="actions"><button class="btn small ghost" data-streload="1">Read the PD pieces again</button><span class="cnt">After a new piece is added to the records.</span></div>`};

/* team meetings, under People in Settings. A time for each Class, and the months with no all-staff meeting. December and
   February have none, and the director can mark any other month the same way. */
T.teamSettings=async function(el){try{await boot(true)}catch(e){el.innerHTML=`<div class="lbl">Team meetings</div><div class="hint warnline">${H(e.message||"This part could not open.")}</div>`;return}
  const tm0=B.school.teamMeetings||{},q=B.school.quietMonths||[];const y=+today().slice(0,4)-(+today().slice(5,7)<8?1:0);
  const months=Array.from({length:12},(_,i)=>{const m=(7+i)%12+1,yy=m>=8?y:y+1;return yy+"-"+String(m).padStart(2,"0")});
  el.innerHTML=`<div class="lbl">Team meetings</div><div class="hint">The whole staff and PD meeting is the first Monday of each month. Each Class team meets on the other open Mondays, and on every open Monday of a month with no all-staff meeting. Each shows on the calendar and on Today for that Class team only.</div>
    ${CLASSROOMS.map(r=>`<div class="prow"><b>${H(r)} Class</b><span class="actions" style="margin:0"><input type="time" data-sttm="${r}|start" value="${H((tm0[r]||{}).start||"")}" aria-label="${H(r)} Class team meeting starts"><input type="time" data-sttm="${r}|end" value="${H((tm0[r]||{}).end||"")}" aria-label="${H(r)} Class team meeting ends"></span></div>`).join("")}
    <div class="chiprow-label" style="margin-top:10px">Months with no all-staff meeting</div><div class="hint">December and February have none. A PD day in such a month is that month's all-staff meeting.</div>
    <div class="chips">${months.map(ym=>{const fixed=/-(12|02)$/.test(ym);const on=fixed||q.includes(ym);return `<button class="chip ${on?"on":""}" type="button" data-stquiet="${ym}" ${fixed?"disabled":""} aria-pressed="${on}">${H(new Date(ym+"-15T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"}))}</button>`}).join("")}</div>
    <div class="actions"><button class="btn small" data-stteamsave="1">Save the team meetings</button></div>`};
document.addEventListener("click",async e=>{const t=e.target.closest&&e.target.closest("[data-stquiet],[data-stteamsave]");if(!t||!D())return;
  if(t.dataset.stquiet){if(t.disabled)return;const on=!t.classList.contains("on");t.classList.toggle("on",on);t.setAttribute("aria-pressed",on);return}
  const tms={};document.querySelectorAll("[data-sttm]").forEach(x=>{const [r,k]=x.dataset.sttm.split("|");(tms[r]=tms[r]||{})[k]=x.value});
  const quiet=[...document.querySelectorAll("[data-stquiet].on:not([disabled])")].map(x=>x.dataset.stquiet);
  try{await api("school",{school:{teamMeetings:tms,quietMonths:quiet}});await boot(true).catch(()=>{});toast("Saved. The calendar follows.")}catch(er){toast(er&&er.message||"That did not save.")}});

/* ---------- printouts and Word files ---------- */
// the readable copies in Drive leave out health details, the flu shot, immunizations, the TB and health screening and
// any medical note, as they leave out evaluations, journals and check-ins. The records page and its own print keep them.
const HEALTH_ITEMS=["tb"];
function recordDocs(p,noHealth){const pr=p.profile||{};const it=itemsFor(p).filter(i=>!(noHealth&&HEALTH_ITEMS.includes(i.k))).map(i=>{const r=(p.items||{})[i.k]||{};const s=itemState(i,r);return [i.label,fd(r.date),s.ex?fd(s.ex):"",s.t]});
  const fl=fluState(p),f=(p.flu||{})[fl.season]||{};const hy=hoursYear(p);
  return report(p.name+", records",[["Role",whoRole(p)],["Class",roomName(p)],["Start date",fd(pr.startDate)],["Printed",fd(today())]],[
    {t:"table",label:"Records and certificates",head:["Record","Date","Renews","In place"],rows:it,widths:[.42,.18,.18,.22]},
    noHealth?null:{t:"table",label:"Immunizations",head:["Immunization","On file","Date"],rows:[["Flu vaccine, "+fl.season,fl.t,fd(f.date)],...["pertussis","measles"].map(k=>{const r=(p.once||{})[k]||{};return [k==="pertussis"?"Pertussis":"Measles",onceState(r).t,fd(r.date)]})]},
    {t:"text",label:"Early childhood units",text:(p.units&&p.units.completed!==undefined&&p.units.completed!=="")?`${p.units.completed} units completed.`:"Not recorded yet."},
    {t:"table",label:"Continuing hours, this school year",head:["Date","Course","Hours","Counts toward"],rows:hy.list.map(h=>[fd(h.date),h.title,String(h.hours),h.approved?"Approved hours":"Our PD hours"]),widths:[.16,.5,.1,.24]},
    {t:"text",text:`${r1(hy.approved)} of 12 approved hours and ${r1(hy.fulton)} hours of our own PD this school year.`}])}
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
async function printFile(name,mode){progress("Making the file");await loadPeople();let p=(st.people||[]).find(x=>x.name===name);
  // a former educator's file prints from their own record
  if(!p&&isFormerName(name))p=await api("person",{name}).catch(()=>null);if(!p){toast("That educator is not here.");return}
  if(mode==="word"){await out("word",[coverDoc(p)],"Personnel file cover, "+name);return}
  const fids=(mode==="new"?newPages(p):allFids(p).filter(f=>!fileMeta(p,f).link));
  let PL;try{PL=await TREE_KIT.pdfLib()}catch(e){toast("The PDF tool did not load. Check the connection.");return}
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
  if(k==="oct27"){await loadPeople();const cpr=ITEMS().find(i=>i.k==="cpr");return out(kind,[report("Coming October 1, 2027",[["Printed",fd(today())]],[{t:"text",text:"Current pediatric first aid and CPR and 16 hours of health and safety training by October 1, 2027, then at least 12 hours a year of continuing education from Department-approved sources."},{t:"table",label:"",noRule:true,head:["Educator","First aid and CPR","16 hours","Approved hours","Our PD hours"],rows:st.people.filter(p=>p.role!=="Kitchen"&&p.role!=="Office").map(p=>{const hy=hoursYear(p);const h=(p.items||{}).hs16||{};return [p.name,itemState(cpr,(p.items||{}).cpr).t,h.date?"Done "+fd(h.date):"Not yet",r1(hy.approved)+" of 12",String(r1(hy.fulton))]}),widths:[.2,.26,.2,.17,.17]}])],"October 1 2027")}
  if(k==="drills"){await loadPeople();return out(kind,[report("Drill log",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Date","Time","Type","Note","Logged by"],rows:(st.drills||[]).map(d=>[fd(d.date),d.time?hourText(d.time):"",d.type,d.note||"",d.by||""]),widths:[.18,.12,.18,.36,.16]}])],"Drill log")}
  if(k==="files"){await loadPeople();return out(kind,[report("Paper files",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Educator","Last printed","New pages"],rows:st.people.map(p=>[p.name,printedAt(p)?fms(p.printed.at):"Not yet",String(newPages(p).length)])}])],"Paper files")}
  if(k==="checklist"||k==="paperwork"){const p=P();const pcs=await loadPd();
    if(k==="checklist"){const ck=checklist(p,pcs,(p.profile||{}).startDate||"");return out(kind,[report("First weeks checklist, "+p.name,[["Start date",fd((p.profile||{}).startDate)]],[{t:"table",label:"",noRule:true,head:["","Step",""],rows:ck.map((c,i)=>[String(i+1),c.label,c.done?"Done":(c.note||"Not yet")]),widths:[.06,.66,.28]}])],"First weeks checklist "+p.name)}
    return out(kind,[report("New Educator paperwork",[["Educator",p.name]],[{t:"table",label:"",noRule:true,head:["Form","Number","Why it matters","Uploaded"],rows:PAPERS().map(x=>{const r=(p.paperwork||{})[x.k]||{};return [x.form,x.num,x.why,(r.files||[]).length||r.done||r.ack?"Yes":"Not yet"]}),widths:[.3,.14,.42,.14]},{t:"text",text:"Payroll and tax forms are completed in QuickBooks Workforce. Social Security cards and driver's licenses are shown in person and copied for the paper personnel file only."}])],"New Educator paperwork "+p.name)}
  if(k.startsWith("pieces:")){const d=k.slice(7);const pcs=await loadPd();const dn=((P().pd||{}).done)||{};return out(kind,[report(d==="licensing"?"Licensing at Fulton Community School":"TREE How To",[["Educator",meName()]],[{t:"table",label:"",noRule:true,head:["Piece","Regulation","Read"],rows:(pcs[d]||[]).map(x=>[x.title,x.source,dn[x.id]?fms(dn[x.id].at):""]),widths:[.44,.4,.16]}])],d==="licensing"?"Licensing at Fulton Community School":"TREE How To")}
  // the policies print as a book, or one section on its own
  if(k.startsWith("pol:")||k.startsWith("polsec:")){const pk=k.split(":")[1];const d=await loadPol(pk);const which=k.startsWith("polsec:")?"sec":"all";try{return word?await polWord(pk,d,which):await polPdf(pk,d,which)}catch(e){fail(e)}}}
// each educator's records page as it prints, for the director's weekly readable copies. Records only, never growth.
// An educator whose last day has passed is a former educator.
T.readable=async function(){await boot(true);await loadPeople();const t=today(),past=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")&&d<t;
  const now=(st.people||[]).map(p=>({name:p.name,room:p.room||"",former:past(p.leaveOn)||past((p.profile||{}).leftOn),doc:recordDocs(p,true)}));
  // educators who have left are no longer in the people list, so their records are read one by one from Former educators
  const gone=((await api("former").catch(()=>({}))).people||[]).filter(x=>!now.some(n=>n.name===x.name));
  for(const x of gone){const p=await api("person",{name:x.name}).catch(()=>null);if(p)now.push({name:x.name,room:x.room||"",former:true,doc:recordDocs(p,true)})}
  return now};

/* ---------- taps ---------- */
// a button tapped twice while its first tap is still working does its work once. The tap's work starts at once, so
// anything it does before waiting happens before the rest of the page hears the tap.
const INFLIGHT=new Set();
function tapOnce(t,f){const k=Object.entries(t.dataset).map(([a,b])=>a+"="+b).join("&");if(INFLIGHT.has(k))return;
  let r;try{r=f()}catch(er){fail(er);return}
  if(!r||typeof r.then!=="function")return;INFLIGHT.add(k);t.setAttribute("aria-busy","true");
  r.then(()=>{for(const x of [...DRAFTS.keys()])if(CREATE.some(id=>x.endsWith("|"+id)))DRAFTS.delete(x)},()=>{}).catch(()=>{});
  r.catch(fail).finally(()=>{INFLIGHT.delete(k);t.removeAttribute("aria-busy")})}
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;st.who="";st.doc=null;st.mod="";st.piece="";st.polSec="";st.polEdit=false;st.polHist=-1},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-stpieceready],[data-stperson],[data-stnew],[data-stgroup],[data-stgname],[data-stup],[data-stlink],[data-stopen][data-who],[data-sthadd],[data-sthdel],[data-streview],[data-stfocus],[data-stgoto],[data-staccess],[data-stfile],[data-stdrill],[data-stnewwho],[data-stdirpaper],[data-stck],[data-stread],[data-stwsave],[data-stmod],[data-stmodback],[data-stpiece],[data-stdone],[data-stpol],[data-stpoledit],[data-stpolsave],[data-stpolcancel],[data-stpolrm],[data-stpolhist],[data-stpolrestore],[data-stpolack],[data-stpolpiece],[data-stfhed],[data-stfhpub],[data-stfhnew],[data-stfhreview],[data-stfhpublic],[data-stprint],[data-stword],[data-stremind],[data-stforms],[data-streload],[data-stsw],[data-stformer],[data-stback]");
  if(!t)return;tapOnce(t,()=>stTap(e,t))},true);
async function stTap(e,t){const d=t.dataset;
  if(d.stprint||d.stword){e.preventDefault();progress("Making the file");await printKind(d.stprint||d.stword,!!d.stword);return}
  if(d.stmod!=null&&d.tview){LS.set("tree.stmod",d.stmod);return}
  if(VIEW_AS&&!d.stmod&&!d.stmodback&&!d.stpiece&&d.stpol==null&&!d.stpolhist&&!d.stfhed&&!d.stpolpiece){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.stperson){st.who=d.stperson;st.doc=null;goView("strec");return}
  if(d.stformer!=null){st.formerWho=d.stformer;redraw();jumpTop();return}
  if(d.stback){const n=d.stback,w=$("#stbackrow");if(!t.dataset.sure){if(w)w.innerHTML=`<span class="confirm">Bring ${H(n)} back with their history? <button class="btn small" data-stback="${H(n)}" data-sure="1">Bring back</button><button class="linkbtn" data-stformer="${H(n)}">Cancel</button></span>`;return}
    try{await window.FP_API("/api/accounts/return",{name:n});if(typeof signins!=="undefined")signins.list=null;st.formerWho="";toast(`${n} is back, with their history. They choose a new code at their next sign-in.`);await boot(true);redraw()}catch(er){fail(er)}return}
  if(d.stnew==="open"){st.adding=true;await loadPaths().catch(()=>null);redraw();return}if(d.stnew==="cancel"){st.adding=false;redraw();return}
  if(d.stnew==="add"){const b={newName:$("#stn-name")?.value,room:$("#stn-room")?.value,role:$("#stn-role")?.value,startDate:$("#stn-start")?.value,experienced:!!$("#stn-exp")?.checked,onboarding:$("#stn-onb")?.value||""};
    try{const r=await api("newhire",b);st.adding=false;toast(`${b.newName} signs in with their first name and the start code ${r&&r.start?r.start:"in Settings, Sign-ins"}, then chooses four numbers. They see only the New Educator section.`);await boot(true);st.newWho=b.newName;redraw()}catch(er){fail(er)}return}
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
  if(d.stpieceready){const [id,on]=d.stpieceready.split("|");try{st.pd=await api("pd/ready",{id,on:on==="1"});toast(on==="1"?"Ready. Everyone who opens the PD library sees it.":"Back to a draft. Only you see it.");redraw()}catch(er){fail(er)}return}
  if(d.stdone){const a=$("#stp-answer");try{st.doc=await api("pd/done",{id:d.stdone,answer:a?a.value:""});toast("Finished. It shows as read, and its minutes count toward your hours.");redraw()}catch(er){fail(er)}return}
  if(await polTap(d,t))return;
  if(d.stremind){const rm=Object.assign({},B.school.remind);rm[d.stremind]=rm[d.stremind]===false;try{await api("school",{school:{remind:rm}});await boot(true);t.classList.toggle("on")}catch(er){fail(er)}return}
  if(d.stforms){const fl={};document.querySelectorAll("[data-stform]").forEach(x=>fl[x.dataset.stform]=x.value.trim());try{await api("school",{school:{formLinks:fl}});await boot(true);toast("Saved.")}catch(er){fail(er)}return}
  if(d.streload){try{const r=await api("reload");st.pd=null;st.pol={};toast(`Read again, ${r.pieces} pieces.`)}catch(er){fail(er)}return}
}
// dates and choices save as they change
document.addEventListener("change",async e=>{const t=e.target;if(!t.closest||!t.closest("#main"))return;const d=t.dataset;
  if(t.id==="sts-goto"&&VIEW_AS)return;
  if(VIEW_AS&&(d.stitem||d.stflu||d.stonce||d.stunits||d.stprof))return toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");
  if(d.stitem){const p=P();p.items=p.items||{};const r=p.items[d.stitem]=Object.assign({},p.items[d.stitem]);if(d.f==="date"&&r.date&&r.date!==t.value)r.renewed=Date.now();r[d.f]=t.value;r.by=meName();r.at=Date.now();await save(p,"Saved.");redraw();return}
  if(d.stflu){const p=P();const s=fluSeason();p.flu=p.flu||{};p.flu[s]=Object.assign({},p.flu[s],{[d.stflu]:t.value});await save(p,"Saved.");redraw();return}
  if(d.stonce){const p=P();p.once=p.once||{};p.once[d.stonce]=Object.assign({},p.once[d.stonce],{[d.f]:t.value});await save(p,"Saved.");redraw();return}
  if(d.stunits){const p=P();p.units=Object.assign({},p.units,{completed:t.value===""?"":Number(t.value)});await save(p,"Saved.");redraw();return}
  if(d.stprof){const [name,k]=d.stprof.split("|");try{const r=await api("profile",{name,profile:{[k]:t.type==="checkbox"?(t.checked?"1":""):t.value}});if(k==="garden"){window.FP_GARDENERS=(window.FP_GARDENERS||[]).filter(n=>n!==name).concat(t.checked?[name]:[])}toast("Saved.");if(k==="onboarding"){NE=null;redraw()}if(/^need:/.test(k)&&st.doc&&st.doc.name===name&&r.profile){st.doc.profile=r.profile;redraw()}}catch(er){fail(er)}return}
  if(d.stpolmust||d.stpolonly||d.stfhhide){if(VIEW_AS)return;await polChange(t,d);return}
  if(t.id==="sts-days"){try{await api("school",{school:{remindDays:+t.value}});await boot(true);toast("Saved.")}catch(er){fail(er)}return}
  if(t.id==="sts-goto"){try{await api("school",{school:{goTo:t.value}});await boot(true);toast("Saved.")}catch(er){fail(er)}return}
});

/* ---------- the director's Edit button on every piece of school writing in the records ----------
   One editor for all of it, the same way a Policies and Procedures section is edited: PD modules, How To
   guides, letters, New Educator and licensing pieces, materials guides, Family page pieces, the wording moved out of the
   code, the libraries for plans, Help answers, Presenting entries and the Garden's own words. Each part has its own box,
   and the headings stay as they are. Save proofreads first, with each fix accepted or kept. A sentence that may break a
   writing rule gets a gentle note she can keep. Every save keeps the earlier wording, with who changed it and when, and
   Restore this version brings any of them back in one tap. */
const pe={at:null,page:null,read:-1,done:null,found:[]};
function peClose(){const o=$("#stpageedit");if(o)o.remove();document.body.style.overflow="";pe.page=null}
const PE_NAMES={letter:"the letter",howto:"this How To guide",wording:"this wording",licensing:"this licensing piece",newed:"this New Educator piece",guide:"this materials guide",familypiece:"this Family page piece",library:"this page",module:"this module"};
function peDraw(){const o=$("#stpageedit");if(!o||!pe.page)return;const g=pe.page;const name=g.name||PE_NAMES[g.kind]||"this page";
  const hist=(g.history||[]).map((h,j)=>({h,j})).reverse();
  o.querySelector(".pebox").innerHTML=`<div class="sttop" style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3 style="margin:0">Edit ${H(name)}</h3><button class="linkbtn" data-pecancel="1">Close</button></div>
    <div class="hint">Write in plain text. A line starting with ### is a heading. A dash starts a list item, a number and a full stop a numbered item. **Words** are bold, and [words](link) is a link. The part headings stay as they are. New wording follows TREE's writing rules, and TREE names anything that does not before it saves.</div>
    ${pe.found.length?`<div class="hint" role="status"><b>A gentle note</b> These lines may not follow TREE's writing rules. Change them, or keep them as written.${pe.found.map(f=>`<div>${H(f.why)} <span class="cnt">${H(f.line)}</span></div>`).join("")}<div class="actions" style="margin:6px 0 0"><button class="btn small ghost" data-pekeep="1">Keep it as written</button></div></div>`:""}
    ${g.fixedTitle?`<div class="lbl">${H(g.title)}</div>`:`<label class="fld-label">Title<input type="text" id="pe-title" value="${H(g.title)}"></label>`}
    ${g.lead!=null?`<label class="fld-label">Opening lines<textarea id="pe-lead" rows="3">${H(g.lead)}</textarea></label>`:""}
    ${g.parts.map((x,i)=>`<label class="fld-label">${H(x.heading)}<textarea data-pepart="${i}" rows="${Math.min(18,Math.max(4,String(x.body).split("\n").length+1))}">${H(x.body)}</textarea></label>`).join("")}
    <label class="fld-label">A short note about this change<input type="text" id="pe-note" maxlength="300" placeholder="Such as Added a question to Reflect"></label>
    <div class="actions"><button class="btn" data-pesave="1">Save</button><button class="linkbtn" data-pecancel="1">Cancel</button>${g.updatedAt?`<span class="cnt">Last changed ${H(fms(g.updatedAt))}${g.note?", "+H(g.note):""}</span>`:""}</div>
    ${hist.length?`<h4 style="margin:14px 0 4px">Earlier versions</h4>${hist.map(({h,j})=>`<div class="strow"><div class="sttop"><b>${H(h.at?fms(h.at):"Before TREE")}</b><span class="cnt">${H(h.by||"")}</span></div>${h.note?`<div class="cnt">${H(h.note)}</div>`:""}
      <div class="actions" style="margin:0"><button class="btn small ghost" data-peread="${j}">${pe.read===j?"Close":"Read it"}</button><button class="linkbtn" data-perestore="${j}">Restore this version</button></div>${pe.read===j?`<div class="stq" style="margin-top:6px;white-space:pre-wrap">${H(h.text.replace(/^\s*<!--[\s\S]*?-->\n?/,""))}</div>`:""}</div>`).join("")}`:""}`}
async function pageEdit(at,done){if(!D()&&!(isOffice()&&!VIEW_AS&&/^staff\/volunteer\//.test(at&&at.path||"")))return;pe.at=at;pe.done=done||null;pe.read=-1;pe.found=[];
  let o=$("#stpageedit");if(!o){o=document.createElement("div");o.id="stpageedit";o.setAttribute("role","dialog");o.setAttribute("aria-label","Edit");
    o.style.cssText="position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.35);overflow:auto;padding:16px";
    o.innerHTML=`<div class="pebox card" style="max-width:760px;margin:0 auto;background:var(--paper);padding:16px 18px;border-radius:12px"><div class="empty"><span class="spin"></span> Opening</div></div>`;document.body.appendChild(o);document.body.style.overflow="hidden"}
  try{pe.page=await api("page",at);peDraw()}catch(e){peClose();fail(e)}}
window.TREE_PAGEEDIT=pageEdit;
document.addEventListener("click",e=>{const t=e.target.closest("[data-stpieceedit],[data-stletteredit]");if(!t||!D())return;e.preventDefault();
  if(t.dataset.stpieceedit)pageEdit({path:"staff/pd/"+t.dataset.stpieceedit+".md"},async()=>{st.pd=await api("pd");redraw()});
  else pageEdit({path:"staff/newed/welcome.md"},async()=>{await loadNewed(meName(),true);redraw()})});
document.addEventListener("click",async e=>{const t=e.target.closest("#stpageedit [data-pecancel],#stpageedit [data-pesave],#stpageedit [data-pekeep],#stpageedit [data-peread],#stpageedit [data-perestore]");if(!t)return;const d=t.dataset;e.preventDefault();
  const finish=async(r,msg)=>{if(r.findings){pe.found=r.findings;peDraw();$("#stpageedit").scrollTop=0;return}pe.page=r.page;pe.found=[];pe.read=-1;toast(r.same?"Nothing changed.":msg);peClose();if(pe.done)await pe.done()};
  if(d.pecancel){peClose();return}
  if(d.peread!=null){const j=+d.peread;pe.read=pe.read===j?-1:j;peDraw();return}
  if(d.pesave||d.pekeep){const note=($("#pe-note")?.value||"").trim(),title=pe.page.fixedTitle?pe.page.title:($("#pe-title")?.value||"").trim();if(!title){toast("Give the page a title.");return}if(!note){toast("Write a short note about this change.");$("#pe-note")?.focus();return}
    const go=async()=>{const parts=[...document.querySelectorAll("#stpageedit [data-pepart]")].map(x=>({body:x.value}));
      try{t.disabled=true;finish(await api("page/save",Object.assign({},pe.at,{stamp:pe.page.stamp,title,lead:$("#pe-lead")?$("#pe-lead").value:undefined,parts,note,keep:!!d.pekeep})),"Saved, with the earlier wording kept.")}catch(er){fail(er)}finally{t.disabled=false}};
    // Save proofreads the writing first, with each fix accepted or kept
    if(d.pesave&&window.TREE_PROOF&&window.TREE_PROOF($("#stpageedit .pebox"),"Save",go))return;
    await go();return}
  if(d.perestore!=null){
    try{finish(await api("page/restore",Object.assign({},pe.at,{stamp:pe.page.stamp,index:+d.perestore})),"Restored. The wording there before is kept as an earlier version.")}catch(er){fail(er)}}});
})();
