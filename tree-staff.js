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
    if(v==="sthb")return await pageHb(my);
    if(v==="st27")return await page27(my);
    if(v==="stdrill")return await pageDrills(my);
    if(v==="stfiles")return await pageFiles(my);
    // growth, the journal, check-ins, Proud Moments and PD days live in the second half of this file
    if(window.TreeGrowth&&TreeGrowth.views.includes(v))return await TreeGrowth.render(v,my);
  }catch(e){m.innerHTML=head("Educators","Educators")+card("This page could not open",`<div class="hint warnline">${H(e.message||"Check the connection, then try again.")}</div>`)}};
// only the page opened last draws, so a slow page never covers the one the educator moved to
let RT=0;
const draw=(my,h)=>{if(my!==RT)return;const m=$("#main");if(!m)return;const y=window.scrollY;m.innerHTML=h;restoreDrafts(m);if(T._keep){window.scrollTo(0,y);T._keep=false}};
/* typing is kept while someone moves to another page and back, until it is saved. Each box is known by the page, the
   person it is about and its own name. A box drawn again with the words already in it, because they were saved, lets
   the kept words go. Passcodes are never kept. */
const DRAFTS=new Map();
// the boxes that start something new are empty again once it is added. An agenda's blocks are kept by the agenda itself.
const CREATE=["sth-title","sth-hours","std-note","stn-name","gm-text","gpd-title"];
const draftKey=el=>{const own=el.id||Object.entries(el.dataset).map(([a,b])=>a+"="+b).join("&");if(!own||el.type==="password"||"gbk" in el.dataset)return "";
  const G=window.TreeGrowth&&TreeGrowth.st||{};const recs=view==="strec"||view==="stnew";
  return [view,recs?(view==="stnew"?st.newWho:st.who)||meName():"",view==="stpd"?st.piece+"/"+st.mod:"",view==="sthb"?st.hbSec:"",D()?G.sel:"",view==="stci"?G.ciWho:"",view==="stpdd"?G.pdSel:"",own].join("|")};
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
      ${goTo?`<div style="margin-top:6px"><b>${H(goTo)}</b> is the go-to person for every new educator. ${dir?H(goTo)+" answers their questions, walks them through paperwork and routines, and checks in briefly at the end of each of their first weeks. The educators on their Class team help on the floor every day.":`${H(goTo)} answers your questions, walks you through paperwork and routines, and checks in with you briefly at the end of each of your first weeks. The educators on your Class team help you on the floor every day. You can bring ${H(goTo)} into your starting-point conversation if you like.`}</div>`:`<div class="cnt" style="margin-top:6px">The director names the go-to person in Settings.</div>`}
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
// a button tapped twice while its first tap is still working does its work once. The tap's work starts at once, so
// anything it does before waiting happens before the rest of the page hears the tap.
const INFLIGHT=new Set();
function tapOnce(t,f){const k=Object.entries(t.dataset).map(([a,b])=>a+"="+b).join("&");if(INFLIGHT.has(k))return;
  let r;try{r=f()}catch(er){fail(er);return}
  if(!r||typeof r.then!=="function")return;INFLIGHT.add(k);t.setAttribute("aria-busy","true");
  r.then(()=>{for(const x of [...DRAFTS.keys()])if(CREATE.some(id=>x.endsWith("|"+id)))DRAFTS.delete(x)},()=>{}).catch(()=>{});
  r.catch(fail).finally(()=>{INFLIGHT.delete(k);t.removeAttribute("aria-busy")})}
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;st.who="";st.doc=null;st.mod="";st.piece="";st.hbSec="";st.hbEdit=false},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-stperson],[data-stnew],[data-stgroup],[data-stgname],[data-stup],[data-stlink],[data-stopen][data-who],[data-sthadd],[data-sthdel],[data-streview],[data-stfocus],[data-stgoto],[data-staccess],[data-stfile],[data-stdrill],[data-stnewwho],[data-stdirpaper],[data-stck],[data-stread],[data-stwsave],[data-stmod],[data-stmodback],[data-stpiece],[data-stdone],[data-sthb],[data-sthbedit],[data-sthbsave],[data-sthbcancel],[data-sthbrm],[data-stprint],[data-stword],[data-stremind],[data-stforms],[data-streload],[data-stsw]");
  if(!t)return;tapOnce(t,()=>stTap(e,t))},true);
async function stTap(e,t){const d=t.dataset;
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
}
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

/* ---------- Educator growth in TREE ----------
   The growth continuum and scores, the end of year evaluation, the self-assessment and the starting-point conversation,
   the Educator Reflection and Growth Plan, the reflective journal, the monthly check-ins, Proud Moments and Kudos, the
   PD library's modules and PD days. It sits after the Educators pages in tree-staff.js, loaded only when opened, and
   shares their helpers. The server decides who receives each record. It never shows counts or tallies. */
(function(){
"use strict";
const T=window.TreeStaff,X=T._;const Gr={};window.TreeGrowth=Gr;
const {api,fail,H,card,chip,head,md,report,out,fd,fms,today,meName,D}=X;
Gr.views=["stgrow","stplan","stjour","stci","stmom","stpdd"];
const ga=(p,b)=>api("g/"+p,b||{});
const st={boot:null,docs:{},sel:"",tab:"",view:"",self:false,editCont:false,jr:null,jrWho:"",moments:null,mform:{kind:"moment",audience:"everyone"},pd:null,pdSel:"",pdEdit:null,mods:null,ci:null,ciWho:"",readings:null,starting:false,examplesPick:null,searching:false};
Gr.st=st;
let bootP=null;
Gr.ready=()=>{if(!(X.boot()&&X.boot().can&&X.boot().can.growth))return Promise.resolve(null);bootP=bootP||ga("boot").then(b=>{st.boot=b;return b}).catch(e=>{bootP=null;throw e});return bootP};
const B=()=>st.boot;
const areaName=k=>((B().areas||[]).find(a=>a[0]===k)||[])[1]||"";
const AK=()=>(B().areas||[]).map(a=>a[0]);
const cont=()=>B().continuum||{areas:[],points:[]};
const contArea=k=>(cont().areas||[]).find(a=>a.k===k)||{points:[]};
const PN=["","Beginning","Developing","Established","Mentoring"];
const modTitle=s=>((B().modules||[]).find(m=>m.slug===s)||{}).title||"";
const modReady=s=>((B().modules||[]).find(m=>m.slug===s)||{}).ready;
const yr=()=>B().year;const yrLabel=y=>`${y} to ${+y+1}`;
const isDir=()=>D();
async function doc(name,force){if(!st.docs[name]||force)st.docs[name]=await ga("mine",{name});return st.docs[name]}
const setDoc=(name,d)=>{st.docs[name]=d;return d};
const who=()=>isDir()?st.sel:meName();
const seg=(attr,opts,cur)=>`<div class="tseg" role="group">${opts.map(([v,l])=>`<button ${attr}="${H(v)}" aria-pressed="${String(cur)===String(v)}">${H(l)}</button>`).join("")}</div>`;
const pills=(attr,list,cur)=>`<div class="actions" style="margin:0 0 10px;flex-wrap:wrap">${list.map(n=>`<button class="pill" aria-pressed="${n===cur}" data-${attr}="${H(n)}">${H(n)}</button>`).join("")}</div>`;
const draw=(my,h)=>X.draw(my,h);
const redraw=()=>X.redraw();

/* ---------- looks ---------- */
if(!document.getElementById("growcss")){const c=document.createElement("style");c.id="growcss";c.textContent=`
.gpts{display:grid;gap:6px;grid-template-columns:repeat(4,minmax(0,1fr))}.gpt{border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--paper);font-size:13.5px;line-height:1.45;text-align:left;color:var(--ink);cursor:default}
button.gpt{cursor:pointer;font:inherit;display:flex;flex-direction:column;justify-content:flex-start}.gpt b{display:block;font-size:12.5px;margin-bottom:3px}.gpt.on{border-color:var(--moss);box-shadow:0 0 0 2px var(--moss);background:#eef5f0}.gpt.next{border-style:dashed;border-color:var(--marigold)}
.gpt.dir{box-shadow:inset 0 -4px 0 var(--marigold)}
@media (max-width:760px){.gpts{grid-template-columns:1fr}}
.garea{border-top:1px solid var(--line);padding:12px 0}.garea:first-of-type{border-top:0}
.gex{display:grid;gap:4px;margin-top:6px}.gex .cnt{line-height:1.45}
.gscore{font-size:22px;font-weight:700;color:var(--moss)}.gnys{font-size:13px;color:var(--muted)}
.gcols{display:grid;gap:10px;grid-template-columns:1fr 1fr}@media (max-width:640px){.gcols{grid-template-columns:1fr}}
.gq{border-left:3px solid var(--moss);padding:2px 0 2px 10px;margin:8px 0}
.gblock{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--paper);display:grid;gap:6px}
.gsug{border:1px dashed var(--line);border-radius:10px;padding:8px 10px;display:grid;gap:4px}
.gmom{border-top:1px solid var(--line);padding:10px 0;display:grid;gap:4px}.gmom img{max-width:min(320px,100%);border-radius:8px}
.gtrend svg{width:100%;max-width:420px;height:70px}
.gscroll{max-width:100%;overflow-x:auto}
`;document.head.appendChild(c)}

/* ---------- examples from an educator's own work, never counted ---------- */
const clip=(s,n)=>{s=String(s||"").replace(/\s+/g," ").trim();return s.length>n?s.slice(0,n).replace(/\s+\S*$/,"")+"…":s};
const byIs=(x,n)=>String(x||"").toLowerCase()===String(n||"").toLowerCase();
const tsOf=p=>p.updatedAt||Date.parse((p.weekOf||"")+"T12:00:00")||0;
function workOf(name,since){since=since||0;const room=(st.docs[name]&&st.docs[name].profile||{}).room||"";
  const obs=[...notices.values()].filter(n=>n&&!n.deleted&&byIs(n.by,name)&&(n.at||0)>=since).sort((a,b)=>(b.at||0)-(a.at||0));
  const pl=[...plans.values()].filter(p=>p&&!p.blank&&p.id!=="example"&&byIs(p.educator,name)&&tsOf(p)>=since).sort((a,b)=>tsOf(b)-tsOf(a));
  const sl=[...slides.values()].filter(x=>x&&byIs(x.by,name)&&(x.at||0)>=since).sort((a,b)=>(b.at||0)-(a.at||0));
  const sto=[...stories.values()].filter(x=>x&&byIs(x.by,name)&&(x.at||0)>=since).sort((a,b)=>(b.at||0)-(a.at||0));
  const roomPlans=[...plans.values()].filter(p=>p&&!p.blank&&p.type==="classroom"&&room&&p.classroom===room&&tsOf(p)>=since).sort((a,b)=>tsOf(b)-tsOf(a));
  const roomThreads=[...threads.values()].filter(t=>t&&room&&(t.classroom||t.room)===room&&(t.updatedAt||0)>=since);
  const inq=[...inquiries.values()].filter(x=>x&&JSON.stringify(x).toLowerCase().includes(`"by":"${String(name).toLowerCase()}"`));
  const conf=[...conferences.values()].filter(c=>c&&byIs(c.teacher,name));
  return {obs,pl,sl,sto,roomPlans,roomThreads,inq,conf}}
const exObs=n=>({kind:"obs",id:n.id,label:clip(n.noticed,140),when:n.at?fms(n.at):"",open:`data-obsgo="${H(n.id)}"`});
const planName=p=>({individual:"Individual plan",classroom:"Classroom plan",smallgroup:"Small Group plan"}[p.type]||"Plan");
const exPlan=(p,f)=>({kind:"plan",id:p.id,label:`${planName(p)}${(p.groups||[]).length?", "+p.groups.join(" and "):p.group?", "+p.group:""}, week of ${fd(p.weekOf)}${f?". "+clip((p.fields||{})[f],110):""}`,when:""});
const exSlide=x=>({kind:"slide",id:x.id,label:"Documentation slide, "+clip(x.title||x.text,110),when:x.at?fms(x.at):""});
const exStory=x=>({kind:"story",id:x.id,label:"Story, "+clip(x.title,110),when:x.at?fms(x.at):""});
const exThread=t=>({kind:"thread",id:t.id,label:"Thread, "+clip(t.name,110),when:""});
const exInq=x=>({kind:"inquiry",id:x.id,label:"Team inquiry, "+clip(x.name,110),when:""});
function examplesFor(name,area,since){const w=workOf(name,since);const d=st.docs[name]||{};const pr=d.profile||{};const L=[];const add=(xs,f,n)=>xs.slice(0,n).forEach(x=>L.push(f(x)));
  const moments=(st.moments||[]).filter(m=>(byIs(m.by,name)&&m.kind==="moment"&&m.area===area)||(m.kind==="kudos"&&byIs(m.to,name)&&area==="team")).slice(0,2).map(m=>({kind:"moment",id:m.id,label:(m.kind==="kudos"?"Kudos from "+m.by+", ":"Proud moment, ")+clip(m.text,110),when:fms(m.at)}));
  if(area==="img"){add(w.obs.filter(n=>String(n.wonder||"").trim()),n=>Object.assign(exObs(n),{label:"Wondering. "+clip(n.wonder,130)}),2);add(w.pl.filter(p=>(p.fields||{}).remarks),p=>exPlan(p,"remarks"),1);add(w.inq,exInq,1)}
  if(area==="env"){add(w.pl.filter(p=>(p.fields||{}).materials||(p.fields||{}).provocation),p=>exPlan(p,(p.fields||{}).provocation?"provocation":"materials"),2);add(w.obs.filter(n=>n.photo),exObs,1);add(w.sl,exSlide,1)}
  if(area==="lang"){add(w.obs,exObs,2);add(w.inq,exInq,1);(d.checkins||[]).filter(c=>c.focus&&c.focus.area==="lang").slice(0,1).forEach(c=>L.push({kind:"focus",id:c.id,label:"Focus Until Next Time, "+clip(c.focus.settled,110),when:fd(c.date)}))}
  if(area==="obs"){add(w.obs,exObs,2);add(w.sl,exSlide,1);add(w.sto,exStory,1)}
  if(area==="cur"){const sg=pr.curriculumFrom==="smallgroup";const own=sg?w.pl.filter(p=>p.focus==="smallgroup"||p.type==="smallgroup"||(p.groups||[]).length):w.pl;
    if(own.length)add(own,p=>exPlan(p,p.fields&&p.fields.intent?"intent":"remarks"),3);
    // for roles that do not write plans, this area reads from contributions to the team's plans and threads
    else{add(w.roomPlans,p=>Object.assign(exPlan(p),{label:"The team's "+exPlan(p).label}),2);add(w.roomThreads,exThread,1)}}
  if(area==="fam"){add(w.conf,c=>({kind:"conf",id:c.id||"",label:`Family conference, ${c.term||""} ${c.schoolYear||""}`.trim(),when:c.confDate?fd(c.confDate):""}),2);add(w.inq,exInq,1)}
  if(area==="team"){add(w.roomPlans,p=>Object.assign(exPlan(p),{label:"The team's "+exPlan(p).label}),1);add(w.inq,exInq,1)}
  if(area==="refl"){(d.checkins||[]).filter(c=>c.focus&&c.focus.settled).slice(0,2).forEach(c=>L.push({kind:"focus",id:c.id,label:"Focus Until Next Time, "+clip(c.focus.settled,110)+(c.followed?". Tried":""),when:fd(c.date)}));
    Object.entries(d.modules||{}).filter(([,m])=>m&&m.reflection).slice(0,2).forEach(([k,m])=>L.push({kind:"module",id:k,label:modTitle(k)+", reflection. "+clip(m.reflection,100),when:m.done?fms(m.done):""}))}
  return [...L,...moments].slice(0,5)}
const exHtml=xs=>xs.length?`<div class="gex">${xs.map(x=>`<div class="cnt">${x.open?`<button class="linkbtn" ${x.open} style="text-align:left">${H(x.label)}</button>`:H(x.label)}${x.when?` <span class="muted">${H(x.when)}</span>`:""}</div>`).join("")}</div>`:`<div class="cnt">Examples appear here as work is kept in TREE.</div>`;

/* ---------- the continuum ---------- */
function pointsHtml(k,opts){opts=opts||{};const a=contArea(k);const mine=!!opts.mine;
  return `<div class="gpts">${a.points.map((p,i)=>{const n=i+1;const on=opts.on===n,dirOn=opts.dir===n,next=opts.next===n;const tag=opts.tap?"button":"div";
    return `<${tag} class="gpt ${on?"on":""} ${dirOn?"dir":""} ${next?"next":""}" ${opts.tap?`type="button" ${opts.tap}="${k}|${n}" aria-pressed="${on}"`:""}><b>${n} ${PN[n]}${next?", the next step":""}</b>${H(mine?p.mine:p.text)}</${tag}>`}).join("")}</div>`}

/* ---------- scores ---------- */
const numeric=v=>[1,2,3,4].includes(+v)&&v!=="nys"?+v:0;
function scoresOf(d,y){const ev=(d.evals||{})[y]||{};const lighter=d.profile&&d.profile.lighter;
  // the atelierista's own placements are her scores
  const src=lighter?((ev.self||{}).placements||{}):((ev.dir||{}).placements||{});const out={};
  for(const k of AK()){const v=src[k];out[k]=v==="nys"?"nys":numeric(v)}
  const nums=Object.values(out).filter(v=>v&&v!=="nys");return {by:out,overall:nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*10)/10:0,any:nums.length>0||Object.values(out).includes("nys")}}
const scoreCell=v=>v==="nys"?`<span class="gnys">Not yet seen</span>`:v?`<span class="gscore">${v}</span> <span class="cnt">${PN[v]}</span>`:`<span class="cnt">No score yet</span>`;

/* ---------- pages ---------- */
Gr.render=async function(v,my){await Gr.ready();if(!B()){draw(my,head("Educators","Growth")+card("Not open yet",`<div class="hint">Growth opens once the director turns it on in Settings.</div>`));return}
  st.view=v;
  try{st.moments=st.moments||(X.boot().me&&X.boot().me.newHire?[]:(await ga("moments")).list)}catch(e){st.moments=[]}
  if(v==="stgrow")return isDir()&&!st.sel?growList(my):growPage(my);
  if(v==="stplan")return planPage(my);
  if(v==="stjour")return journalPage(my);
  if(v==="stci")return checkinPage(my);
  if(v==="stmom")return momentsPage(my);
  if(v==="stpdd")return pdPage(my)};

/* the director's view of every educator */
async function growList(my){const all=(await ga("all")).people;all.forEach(d=>setDoc(d.name,d));const y=yr();
  if(st.editCont)return contEditor(my);
  const rows=all.map(d=>{const pl=(d.plans||{})[y];const ev=(d.evals||{})[y]||{};const pr=d.profile||{};const tr=(d.trend||[]).slice(-6);
    const started=pl&&(String(((pl.wentWell||{}).text)||"").trim()||(pl.goals||[]).some(x=>String(x.text||"").trim()));
    const startDue=pr.startDate&&X.daysTo(pr.startDate,today())<365&&!(d.starting&&d.starting.done)?X.addMonths(pr.startDate,2):"";
    return `<tr data-gsel="${H(d.name)}" style="cursor:pointer"><td><b>${H(d.name)}</b><div class="cnt">${H([pr.room?pr.room+" Class":"",pr.role==="apprentice"?"Apprentice":""].filter(Boolean).join(", "))}</div></td>
      <td>${started?chip("ok","Started"):pl?chip("missing","Blank, to fill in TREE"):chip("missing","Not entered yet")}</td>
      <td>${ev.self&&ev.self.done?chip("ok","Self-assessment done"):""} ${ev.dir&&ev.dir.done?chip("ok","Your placements done"):""} ${ev.meeting?chip("ok","Met"):""}</td>
      <td>${startDue?chip(startDue<=today()?"soon":"soonish",(startDue<=today()?"Starting point due ":"Starting point ")+fd(startDue)):""}</td>
      <td class="gtrend">${tr.length?trendSvg(tr,true):`<span class="cnt">No check-in yet</span>`}</td></tr>`}).join("");
  draw(my,head("Educators","Growth",`Each educator's growth, Growth Plan, check-ins and evaluation. ${X.boot().open.growth?"Educators see their own.":"Only you see these pages until you turn on growth in Settings."} Tap an educator to open theirs.`)+
    card("Every educator",`<div class="tablewrap"><table class="grid2" style="min-width:760px"><thead><tr><th>Educator</th><th>Growth Plan</th><th>End of year</th><th>New educator</th><th>Temperature and alignment</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="hint" style="margin-top:6px">The trend shows the educator's temperature in green, yours in gold and team alignment in grey, from monthly check-ins. It is a support trend and never touches scores.</div>`)+
    card("The continuum's words",`<div class="hint">At each August PD day, educators read the descriptions together and suggest changes. You approve the final words, and TREE updates them for the year.</div><div class="actions"><button class="btn small ghost" data-gcont="1">Edit the words for ${H(yrLabel(yr()))}</button></div>`))}
function trendSvg(tr,small){const W=small?160:420,Hh=small?40:70,n=tr.length;const x=i=>n<2?W/2:8+i*(W-16)/(n-1);const y=v=>v?Hh-6-(v-1)*(Hh-12)/4:null;
  const line=(k,c)=>{const pts=tr.map((t,i)=>y(t[k])==null?null:`${x(i)},${y(t[k])}`).filter(Boolean);return pts.length?`<polyline fill="none" stroke="${c}" stroke-width="2" points="${pts.join(" ")}"/>${tr.map((t,i)=>y(t[k])==null?"":`<circle cx="${x(i)}" cy="${y(t[k])}" r="2.5" fill="${c}"/>`).join("")}`:""};
  return `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Temperature and alignment over time" style="max-width:${W}px;height:${Hh}px">${line("align","#9aa19a")}${line("dir","#c8922a")}${line("self","#3d6b4f")}</svg>`}

/* one educator's growth, the educator's own or, for the director, anyone's */
async function growPage(my){const name=who();const d=await doc(name,true);const y=yr();const dir=isDir();const pr=d.profile||{};
  if(st.self&&!dir)return selfPage(my,d);
  if(st.starting&&dir)return startingPage(my,d);
  const pl=(d.plans||{})[y]||{};const ev=(d.evals||{})[y]||{};const met=!!(ev.meeting&&ev.meeting.at);
  const pref=pl.feedback&&pl.feedback!=="conversation"?pl.feedback:"scores";const viewK=st.tab||(pl.feedback==="conversation"?"narrative":pref);
  const tabs=[["scores","Scores"],["continuum","Continuum"],["narrative","Narrative"],["notes","Written notes"]];
  const past=Object.keys(d.evals||{}).filter(k=>k<y).sort();
  const sc=scoresOf(d,y);const showScores=met||pr.lighter;
  const self=(ev.self||{}).placements||{};const dirP=(ev.dir||{}).placements||{};
  const newEd=pr.startDate&&X.daysTo(pr.startDate,today())<365;
  let body="";
  if(viewK==="scores"){
    const cols=[...past.map(p=>[p,yrLabel(p)]),[y,yrLabel(y)]];
    body=`<div class="hint">The score for an area is the number of the continuum point, from 1 to 4. Established is the expectation for an experienced Fulton educator, and Mentoring is not expected of everyone.${newEd?" New educators commonly sit at 1 or 2 in their first year.":""}</div>
      ${showScores||past.length?`<div class="tablewrap"><table class="grid2" style="min-width:${360+cols.length*120}px"><thead><tr><th>Area</th>${cols.map(c=>`<th>${H(c[1])}</th>`).join("")}<th>${dir?"Their":"Your"} own placement</th></tr></thead><tbody>
      ${AK().map(k=>`<tr><td><b>${H(areaName(k))}</b></td>${cols.map(([cy])=>{const s=scoresOf(d,cy);const vis=cy!==y||showScores;return `<td>${vis?scoreCell(s.by[k]):`<span class="cnt">At the end of the year</span>`}</td>`}).join("")}<td>${self[k]?`${self[k]} <span class="cnt">${PN[self[k]]}</span>`:`<span class="cnt">Not placed yet</span>`}</td></tr>`).join("")}
      <tr><td><b>Overall</b><div class="cnt">The average of the areas that were scored</div></td>${cols.map(([cy])=>{const s=scoresOf(d,cy);const vis=cy!==y||showScores;return `<td>${vis&&s.overall?`<span class="gscore">${s.overall}</span>`:""}</td>`}).join("")}<td></td></tr></tbody></table></div>`
      :`<div class="cnt" style="margin-top:6px">Scores come with the end of year evaluation. ${newEd?"In the first year there are no scores until then.":"Until then each area shows the continuum and examples from "+(dir?"their":"your")+" own work."}</div>`}
      ${showScores?`<div class="cnt" style="margin-top:6px">Each score sits beside the narrative and ${dir?"the educator's":"your"} own placement, never alone. When an area shows Not yet seen, there was too little evidence to judge, so a gap in evidence never reads as a low score.</div>`:""}`}
  if(viewK==="continuum")body=`<div class="hint">What each point looks like in daily work at Fulton, so ${dir?"the educator":"you"} can see where ${dir?"they are":"you are"} and what the next step looks like. The points describe practice. They never describe the person.</div>
    ${AK().map(k=>{const cur=showScores&&numeric(sc.by[k])?numeric(sc.by[k]):numeric(self[k]);return `<div class="garea"><b>${H(areaName(k))}</b>${(cont().notes||{})[k]?`<div class="cnt">${H(cont().notes[k])}</div>`:""}
      <div style="margin-top:6px">${pointsHtml(k,{on:cur||0,dir:met&&numeric(dirP[k])&&!pr.lighter?numeric(dirP[k]):0,next:cur&&cur<4?cur+1:0})}</div>
      <details style="margin-top:6px"><summary class="cnt">Examples from ${dir?"their":"your"} own work</summary>${exHtml(examplesFor(name,k))}</details></div>`}).join("")}`;
  if(viewK==="narrative"){const dv=ev.dir||{};body=met||pr.lighter&&met?`${dv.strengths?`<h4 style="margin:4px 0">Strengths</h4>${md(dv.strengths)}`:""}${dv.narrative?`<h4 style="margin:10px 0 4px">Growth across the year</h4>${md(dv.narrative)}`:""}${AK().filter(k=>(dv.notes||{})[k]).map(k=>`<div class="gq"><b>${H(areaName(k))}</b>${md(dv.notes[k])}</div>`).join("")}${!dv.narrative&&!dv.strengths?`<div class="cnt">The narrative is written at the end of the year.</div>`:""}`
      :`<div class="cnt">${dir?"Your narrative is written in the evaluation below and shared during the meeting.":"The director's narrative comes with the end of year evaluation, during your meeting, with story and example."}${pl.feedback==="conversation"?" You said you take in feedback best in conversation, so it is talked through together first.":""}</div>`;
    past.forEach(p=>{const dv2=((d.evals||{})[p]||{}).dir||{};if(dv2.narrative)body+=`<details style="margin-top:10px"><summary class="cnt">${H(yrLabel(p))}</summary>${md(dv2.narrative)}</details>`})}
  if(viewK==="notes"){const cis=(d.checkins||[]).filter(c=>(c.focus&&c.focus.settled)||c.followup);
    body=`<div class="hint">Written notes to read whenever ${dir?"they like":"you like"}, away from the children.</div>${cis.length?cis.map(c=>`<div class="garea"><b>Check-in, ${H(fd(c.date))}</b>${c.focus&&c.focus.settled?`<div class="gq"><div class="cnt">Focus Until Next Time${c.focus.area?", "+H(areaName(c.focus.area)):""}</div>${md(c.focus.settled)}</div>`:""}${c.followup?`<div class="cnt">Follow-up notes</div>${md(c.followup)}`:""}</div>`).join(""):`<div class="cnt">Notes from check-ins appear here.</div>`}`}
  const tabsHtml=`<div class="actions" style="margin:0 0 8px">${seg("data-gtab",tabs,viewK)}</div>${!pl.feedback?`<div class="cnt" style="margin-bottom:6px">${dir?"They have not chosen how they take in feedback best yet, so this opens in the scores view.":"Choose how you take in feedback best in your Growth Plan, and this opens in that view first."} Every view is one tap away.</div>`:`<div class="cnt" style="margin-bottom:6px">Opens in ${H({scores:"the scores view",continuum:"the continuum view",narrative:"the narrative",conversation:"the narrative, talked through together first",notes:"written notes"}[pl.feedback])}, as ${dir?"they":"you"} chose in the Growth Plan. Every view is one tap away.</div>`}`;
  const people=dir?B().people.map(p=>p.name):[];
  let h=head(dir?"Growth":"My growth",dir?name+", growth":"My growth",dir?`Only ${H(name)} and you see this page.`:"Where your practice stands in the eight areas, in the form that makes sense to you. Only you and the director see it.");
  if(dir)h+=`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gsel="">‹ All educators</button></div>`+pills("gsel",people,name);
  // the starting-point conversation for a new educator, with no scores
  if(newEd&&!(d.starting&&d.starting.done)){const due=pr.startDate?X.addMonths(pr.startDate,2):"";h+=card("Starting-point conversation",`<div class="cnt">Two months after ${dir?"a new educator starts":"you start"}, ${dir?"you meet":"you and the director meet"} for a starting-point conversation. ${dir?"You place them":"You place yourself"} on the continuum together and finish ${dir?"their":"your"} Growth Plan goals. There are no scores until the end of the year.${due?` ${due<=today()?"It is due now":"It is scheduled for "+H(fd(due))}${due<=today()?", from the start date "+H(fd(pr.startDate))+".":"."}`:""}</div>${dir?`<div class="actions"><button class="btn small" data-gstart="1">Open the starting-point conversation</button></div>`:""}`,due&&due<=today()?chip("soon","Due now"):"")}
  else if(d.starting&&d.starting.done&&d.starting.shared)h+=card("Starting point",`<div class="cnt">From the starting-point conversation, ${H(fd(new Date(d.starting.done).toISOString().slice(0,10)))}. These are not scores.</div>${AK().filter(k=>(d.starting.placements||{})[k]).map(k=>`<div class="cnt"><b>${H(areaName(k))}</b>, ${PN[d.starting.placements[k]]}</div>`).join("")}`);
  h+=card("Where "+(dir?"they stand":"you stand"),tabsHtml+body,`<span class="actions" style="margin:0"><button class="btn small ghost" data-gprint="eval">Print</button><button class="linkbtn" data-gword="eval">Word</button></span>`);
  // the self-assessment, the director's own placements and the meeting
  h+=evalCards(d,name,ev,met);
  draw(my,h)}

function evalCards(d,name,ev,met){const dir=isDir(),pr=d.profile||{};const self=ev.self||{},dv=ev.dir||{};let h="";
  if(!dir){h+=card("Self-assessment",`<div class="cnt">Before the end of year evaluation, you place yourself on the continuum. It takes about twenty minutes. You tap the point where you see your practice now and write about two or three areas you choose.${pr.lighter?" Your own placements become your scores, and the director adds a short narrative.":""}</div>
    <div class="actions">${self.done?chip("ok","Done "+fms(self.done)):self.at?chip("soonish","Started"):""}<button class="btn small ${self.done?"ghost":""}" data-gself="1">${self.at?"Open my self-assessment":"Place myself on the continuum"}</button></div>`)}
  else{h+=card(pr.lighter?"Her placements and your narrative":"Your placements",`<div class="hint">${pr.lighter?"After thirteen years as atelierista, her evaluation is lighter. She places herself on the continuum, her own placements become her scores, and you add a short narrative.":"Complete your own placements without seeing theirs. Each score is the number of the continuum point, from 1 to 4, or Not yet seen when evidence is thin."}</div>
    ${self.done?`<div class="cnt">${H(name)} finished the self-assessment ${H(fms(self.done))}.${pr.lighter?"":" Their placements stay hidden from you here until the meeting view opens."}</div>`:`<div class="cnt">${H(name)} has not finished the self-assessment yet.</div>`}
    ${pr.lighter?AK().map(k=>`<div class="garea"><b>${H(areaName(k))}</b> ${self.placements&&self.placements[k]?`<span class="cnt">${self.placements[k]}, ${PN[self.placements[k]]}</span>`:`<span class="cnt">Not placed yet</span>`}</div>`).join(""):AK().map(k=>{const v=(dv.placements||{})[k];return `<div class="garea"><b>${H(areaName(k))}</b><div style="margin-top:6px">${pointsHtml(k,{on:numeric(v),tap:"data-gdir"})}</div>
      <div class="actions" style="margin:6px 0 0"><button class="pill" aria-pressed="${v==="nys"}" data-gdir="${k}|nys">Not yet seen</button></div>
      <label class="fld-label">A note for this area, optional<textarea rows="2" data-gdirnote="${k}">${H((dv.notes||{})[k]||"")}</textarea></label>
      <details><summary class="cnt">Examples from their own work</summary>${exHtml(examplesFor(name,k))}</details></div>`}).join("")}
    <label class="fld-label">Strengths${pr.lighter?"":", drawn from their Proud Moments, Kudos and the areas you both placed highest"}<textarea rows="3" id="g-strengths">${H(dv.strengths||strengthsDraft(d))}</textarea></label>
    <label class="fld-label">${pr.lighter?"A short narrative":"Your narrative, growth across the year"}<textarea rows="${pr.lighter?4:7}" id="g-narr">${H(dv.narrative||"")}</textarea></label>
    <div class="actions"><button class="btn small ghost" data-gdirsave="0">Save</button><button class="btn small" data-gdirsave="1">${dv.done?"Save, placements done":"My placements are done"}</button>${met?chip("ok","Meeting view open"):`<button class="btn small ghost" data-gmeet="1">Open the meeting view</button>`}</div>
    <div class="cnt">${met?`${H(name)} sees both placements side by side now.`:`The educator first sees your placements during the meeting, when you open the meeting view.`}</div>`)}
  if(met||(dir&&self.done&&dv.done)){
    h+=card("Side by side",`<div class="hint">The conversation begins where the two views meet and where they differ.</div>${AK().map(k=>{const a=(self.placements||{})[k],b=(dv.placements||{})[k];return `<div class="garea"><b>${H(areaName(k))}</b><div class="gcols" style="margin-top:4px"><div class="cnt">${dir?"Their":"Your"} placement, ${a?`${a} ${PN[a]}`:"not placed"}</div><div class="cnt">${pr.lighter?"":dir?"Your placement, ":"The director's placement, "}${pr.lighter?"":b==="nys"?"Not yet seen":b?`${b} ${PN[b]}`:"not placed"}</div></div>${(self.writes||{})[k]?`<div class="gq">${md(self.writes[k])}</div>`:""}</div>`}).join("")}${self.closing?`<h4 style="margin:10px 0 4px">Where ${dir?"they want":"I want"} to grow next year</h4>${md(self.closing)}`:""}`);
    const goals=ev.goals||[];
    h+=card("Next year's goals",`<div class="hint">${dir?"The educator names":"Name"} two or three goals for next year. They carry into ${dir?"their":"your"} next Educator Reflection and Growth Plan, so each year begins where the last one ended.</div>${[0,1,2].map(i=>`<label class="fld-label">Goal ${i+1}<textarea rows="2" data-gnext="${i}">${H((goals[i]||{}).text||"")}</textarea></label>`).join("")}<div class="actions"><button class="btn small" data-gnextsave="1">Save the goals</button>${goals.length?chip("ok","In next year's Growth Plan"):""}</div>`)}
  return h}
function strengthsDraft(d){const y=yr();const ev=(d.evals||{})[y]||{};const s=(ev.self||{}).placements||{},b=(ev.dir||{}).placements||{};
  const both=AK().filter(k=>numeric(s[k])&&numeric(b[k]));const hi=both.length?Math.max(...both.map(k=>Math.min(s[k],b[k]))):0;
  const top=both.filter(k=>Math.min(s[k],b[k])===hi&&hi>=2).map(areaName);
  const ms=(st.moments||[]).filter(m=>(byIs(m.by,d.name)&&m.kind==="moment")||(m.kind==="kudos"&&byIs(m.to,d.name))).slice(0,3).map(m=>(m.kind==="kudos"?"Kudos from "+m.by+". ":"")+clip(m.text,160));
  return [top.length?"Where we both placed you highest. "+top.join(", ")+".":"",...ms].filter(Boolean).join("\n\n")}

/* the self-assessment, in the first person */
async function selfPage(my,d){const y=yr();const ev=(d.evals||{})[y]||{};const s=Object.assign({placements:{},writes:{},examples:{},closing:""},ev.self||{});st.selfDraft=st.selfDraft||JSON.parse(JSON.stringify(s));const sd=st.selfDraft;
  const chosen=Object.keys(sd.writes||{});
  const opts=k=>examplesFor(d.name,k).filter(x=>x.id);
  let jr="";try{if(st.jr&&st.jrWho===d.name)jr=st.jr.entries.filter(e=>e.bring&&e.bring.self).map(e=>`<div class="gq"><div class="cnt">From your journal, ${H(fd(e.date))}</div>${["joy","challenge","connection","language"].filter(k=>e[k]).map(k=>`<div class="cnt">${H(e[k])}</div>`).join("")}</div>`).join("")}catch(e){}
  draw(my,head("My growth","Self-assessment","About twenty minutes. For each area, tap the point where you see your practice now. Then write about two or three areas you choose, with an example from your own work if you like.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gselfback="1">‹ My growth</button></div>`+
    card("Where I see my practice now",AK().map(k=>`<div class="garea"><b>${H(areaName(k))}</b><div style="margin-top:6px">${pointsHtml(k,{mine:true,on:numeric(sd.placements[k]),tap:"data-gselfpt"})}</div>
      <div class="actions" style="margin:6px 0 0"><label class="radio"><input type="checkbox" data-gwrite="${k}" ${chosen.includes(k)?"checked":""}><span>I will write about this area</span></label></div>
      ${chosen.includes(k)?`<label class="fld-label">In my own words<textarea rows="3" data-gselfw="${k}">${H(sd.writes[k]||"")}</textarea></label>
        ${opts(k).length?`<label class="fld-label">An example from my own work, if I like<select data-gselfex="${k}"><option value="">None</option>${opts(k).map(x=>`<option value="${H(x.kind+"|"+x.id)}" ${((sd.examples||{})[k]||[]).some(e=>e.id===x.id)?"selected":""}>${H(x.label)}</option>`).join("")}</select></label>`:""}`:""}</div>`).join(""),chosen.length>3?`<span class="warnline">Two or three areas is enough</span>`:"")+
    (jr?card("Brought from my journal",jr):"")+
    card("One closing question",`<label class="fld-label">Where do I want to grow next year?<textarea rows="3" id="g-closing">${H(sd.closing||"")}</textarea></label>
      <div class="actions"><button class="btn small ghost" data-gselfsave="0">Save for now</button><button class="btn" data-gselfsave="1">${ev.self&&ev.self.done?"Save":"I am done"}</button></div>
      <div class="cnt">The director completes their own placements without seeing yours, and you first see the director's placements during the meeting, side by side.</div>`));}

/* the starting-point conversation, for the director */
function startingPage(my,d){const s=Object.assign({placements:{},notes:""},d.starting||{});st.startDraft=st.startDraft||JSON.parse(JSON.stringify(s));const sd=st.startDraft;
  draw(my,head("Growth","Starting-point conversation, "+d.name,"You place them on the continuum together and finish their Growth Plan goals. There are no scores until the end of the year. They can bring their go-to person into the conversation if they like.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gstartback="1">‹ ${H(d.name)}, growth</button></div>`+
    card("Placed together",AK().map(k=>`<div class="garea"><b>${H(areaName(k))}</b><div style="margin-top:6px">${pointsHtml(k,{on:numeric(sd.placements[k]),tap:"data-gstartpt"})}</div><details><summary class="cnt">Examples from their own work</summary>${exHtml(examplesFor(d.name,k))}</details></div>`).join(""))+
    card("Notes",`<label class="fld-label">What you talked about<textarea rows="4" id="g-startnotes">${H(sd.notes||"")}</textarea></label>
      <div class="actions"><button class="btn small ghost" data-gstartsave="0">Save</button><button class="btn small" data-gstartsave="1">The conversation is done, share with them</button><button class="btn small ghost" data-tview="stplan">Their Growth Plan goals</button></div>`))}

/* the continuum's words, edited by the director after the August PD day */
function contEditor(my){const c=cont();
  draw(my,head("Growth","The continuum's words, "+yrLabel(yr()),"Educators read the descriptions together at the August PD day and suggest changes. You approve the final words here. The second box for each point is how it reads in the self-assessment, in the first person.")+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gcont="0">‹ Growth</button></div>`+
    (c.areas||[]).map(a=>card(a.name,a.points.map((p,i)=>`<div class="garea"><b>${i+1} ${PN[i+1]}</b><label class="fld-label">As the director reads it<textarea rows="3" data-gct="${a.k}|${i}|text">${H(p.text)}</textarea></label><label class="fld-label">In the self-assessment<textarea rows="3" data-gct="${a.k}|${i}|mine">${H(p.mine)}</textarea></label></div>`).join(""))).join("")+
    `<div class="actions"><button class="btn" data-gcontsave="1">Approve these words for ${H(yrLabel(yr()))}</button></div>`)}

/* ---------- the Educator Reflection and Growth Plan ---------- */
const AREA_WORDS={img:/child|children'?s? (thinking|theor|ideas)|competent|capable|image of the child|trust|co-construct/i,env:/environment|space|material|provocation|aesthetic|beaut|room|outdoor|atelier|garden|wall/i,lang:/language|tone|words|praise|regulat|calm|conflict|voice|behavio|describ|narrat/i,
  obs:/observ|document|photo|notic|wonder|panel|portfolio|slide|stor(y|ies)/i,cur:/plan|curricul|inquir|project|thread|small group|intent|investigat/i,fam:/famil|parent|conference|home/i,team:/team|colleague|collaborat|co-educator|communit|support (each|one)/i,refl:/reflect|feedback|grow|learn|journal|training|course|PD\b|professional/i};
const suggestArea=t=>{let best="",n=0;for(const [k,re] of Object.entries(AREA_WORDS)){const m=(String(t||"").match(new RegExp(re.source,"gi"))||[]).length;if(m>n){n=m;best=k}}return best};
// the August form's other answers, kept as written in the Reflection part
const REFL=[["difficult","What was difficult for me"],["proud","A moment I'm proud of"],["natural","What comes naturally"],["drains","What drains me"],["pattern","A pattern I keep noticing"],["why","Why these goals"]];
async function planPage(my){const dir=isDir();if(dir&&!st.sel)st.sel=(B().people[0]||{}).name||"";const name=who();if(!name){draw(my,head("Educators","Growth Plan")+card("No educator yet",`<div class="hint">Educators appear here once they have a sign-in.</div>`));return}
  const d=await doc(name,true);const y=yr();const pl=Object.assign({wentWell:{choice:"last",text:""},goals:[],challenges:"",need:{director:"",team:"",training:""},feedback:""},(d.plans||{})[y]||{});pl.reflection=Object.assign({},pl.reflection||{});
  st.planDraft=st.planDraft&&st.planDraft.__who===name?st.planDraft:Object.assign(JSON.parse(JSON.stringify(pl)),{__who:name});const p=st.planDraft;
  while((p.goals||[]).length<2)p.goals.push({id:"g"+Math.random().toString(36).slice(2,8),text:"",area:"",areaOk:false});
  const goalHtml=(x,i)=>{const sug=x.area||suggestArea(x.text);const mod=sug&&B().modules.find(m=>m.ready&&m.areas.includes(sug)&&!["howto","licensing"].includes(m.slug));
    return `<div class="gblock"><label class="fld-label" style="margin:0">Goal ${i+1}<textarea rows="2" data-gpgoal="${i}">${H(x.text)}</textarea></label>
    <div class="cnt">${x.areaOk?`Linked to <b>${H(areaName(x.area))}</b>. `:sug?`TREE suggests <b>${H(areaName(sug))}</b> from ${dir?"the":"your"} words. `:"Choose the area this goal belongs to. "}<select data-gparea="${i}" aria-label="Area for goal ${i+1}"><option value="">Choose an area</option>${AK().map(k=>`<option value="${k}" ${(x.area||sug)===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select> ${x.areaOk?chip("ok","Confirmed"):`<button class="btn small ghost" data-gpok="${i}">Confirm</button>`}</div>
    ${mod?`<div class="cnt">A module that supports it, <button class="linkbtn" data-tview="stpd" data-stmod="m:${H(mod.slug)}">${H(mod.title)}</button></div>`:""}</div>`};
  const people=dir?B().people.map(x=>x.name):[];const isNew=d.profile&&d.profile.startDate&&X.daysTo(d.profile.startDate,today())<365;
  draw(my,head(dir?"Growth Plan":"My Growth Plan","Educator Reflection and Growth Plan",`This plan begins ${dir?"their":"your"} year. It shapes ${dir?"their":"your"} check-ins, ${dir?"their":"your"} journal and ${dir?"their":"your"} evaluation, and it is ${dir?"theirs":"yours"} to return to.`)+
    (dir?pills("gsel",people,name)+`<div class="cnt" style="margin:-4px 0 10px">${pl.source==="august"?"Entered from the August plan, exactly as written.":pl.source==="tree"?"Started in TREE.":"Not entered yet. Enter the August plan exactly as written, or leave it for them to start in TREE."}</div>`:"")+
    card("1. What went well",`${seg("data-gpww",[["last","What went well for me last year"],["new","What has gone well in my first weeks at Fulton, or in my work before Fulton"]],p.wentWell.choice||"last")}${isNew&&p.wentWell.choice!=="new"?`<div class="cnt" style="margin-top:4px">New educators can choose the second.</div>`:""}<textarea rows="4" id="gp-ww" style="margin-top:8px;width:100%" aria-label="What went well">${H(p.wentWell.text||"")}</textarea>`)+
    card("2. Reflection",`<div class="hint">Kept as written and seen only by ${dir?"the educator and you":"you and the director"}.</div>${REFL.map(([k,l])=>`<label class="fld-label">${H(l)}<textarea rows="3" data-gprefl="${k}">${H((p.reflection||{})[k]||"")}</textarea></label>`).join("")}`)+
    card("3. My goals for this year, two or three",`<div class="hint">Each goal links to one of the eight areas. TREE suggests the area from the words, and ${dir?"the educator confirms":"you confirm"} it.</div><div style="display:grid;gap:8px">${p.goals.map(goalHtml).join("")}</div>${p.goals.length<3?`<div class="actions"><button class="btn small ghost" data-gpadd="1">Add a third goal</button></div>`:""}`)+
    card("4. Challenges I'm anticipating",`<div class="hint">Kept as written and seen only by ${dir?"the educator and you":"you and the director"}.</div><textarea rows="3" id="gp-ch" style="width:100%" aria-label="Challenges">${H(p.challenges||"")}</textarea>`)+
    card("5. What I need",`<label class="fld-label">From the director<textarea rows="2" id="gp-nd">${H(p.need.director||"")}</textarea></label><label class="fld-label">From my team<textarea rows="2" id="gp-nt">${H(p.need.team||"")}</textarea></label><label class="fld-label">From training<textarea rows="2" id="gp-nr">${H(p.need.training||"")}</textarea></label>`)+
    card("6. How I take in feedback best",`<div class="hint">${dir?"Left for the educator to choose.":"Your evaluation opens in this view first, with every view one tap away."}</div>${[["scores","As scores"],["continuum","As descriptions of what comes next"],["narrative","As a narrative"],["conversation","In conversation"],["notes","Written to read later"]].map(([v,l])=>`<label class="radio"><input type="radio" name="gpfb" value="${v}" ${p.feedback===v?"checked":""} ${dir?"disabled":""}><span>${l}</span></label>`).join("")}${!p.feedback?`<div class="cnt">Not chosen yet, so the evaluation opens in the scores view.</div>`:""}`)+
    (dir?card("For you",`<label class="radio"><input type="checkbox" id="gp-aug" ${pl.source==="august"?"checked":""}><span>Entered from the August plan, exactly as written</span></label><label class="fld-label">An answer to the check-in plan or meeting frequency question, kept as a note only since check-ins are set monthly<textarea rows="2" id="gp-note">${H(pl.note||"")}</textarea></label>`):"")+
    `<div class="actions"><button class="btn" data-gpsave="1">Save the plan</button>${pl.at?`<span class="cnt">Saved ${H(fms(pl.at))}</span>`:""}</div>`)}

/* ---------- the reflective journal ---------- */
const PROMPTS=[["joy","A moment of joy","A moment that brought me joy this week."],["challenge","A challenge I navigated","A challenge I worked through this week, and what I learned from it."],["connection","A connection I made","One meaningful connection I made with a child, a family or a colleague."],["language","My language this week","Something I noticed about my own words or tone this week, and one language strategy I will practice next week."]];
async function journalPage(my){const dir=isDir();if(dir&&!st.sel)st.sel=(B().people[0]||{}).name||"";const name=who();const people=dir?B().people.map(x=>x.name):[];
  const open=st.jr&&st.jrWho===name;const every=dir?((B().people.find(p=>p.name===name)||{}).journalEvery||1):B().me.journalEvery;
  let h=head(dir?"Journal":"My journal",dir?name+"'s journal":"Reflective journal",dir?`Read as a partner in ${H(name)}'s reflection. Only ${H(name)} and you see it, and it is never scored and never used to judge them.`:`The weekly journal is an integral part of Fulton's reflective practice. ${every===2?"Part time educators who do not work Mondays write every other week":"You write once a week"}, in about ten minutes, and a few honest sentences are enough.`);
  if(dir)h+=pills("gsel",people,name);
  if(!open){draw(my,h+card("Open the journal",`<div class="hint">The journal asks for ${dir?"your":"your"} TREE passcode each time it opens, in case ${dir?"you forget":"you forget"} to sign out on a shared computer.</div>
    <div class="kfields"><label>Your TREE passcode<input type="password" inputmode="numeric" autocomplete="current-password" id="gj-pass" maxlength="40"></label></div><div class="actions"><button class="btn" data-gjopen="1">Open</button></div>`));setTimeout(()=>{const i=$("#gj-pass");if(i)i.focus()},50);return}
  const J=st.jr;const p=J.period;const cur=J.entries.find(e=>e.date>=p.start&&e.date<=p.end&&!dir)||null;const draft=st.jDraft||(cur?Object.assign({},cur):{});
  h+=card("A no judgment space",`<div class="cnt">${dir?"What is written here is never scored and never used to judge the educator. They can choose to bring an entry into a check-in or the self-assessment.":"What you write in the journal is never scored and never used in your evaluation. It is seen only by you and the director, never by colleagues. You can choose to bring an entry into a check-in or your self-assessment."}</div><div class="actions"><button class="btn small ghost" data-gjclose="1">Close the journal</button></div>`);
  if(!dir)h+=card(p.every===2?"These two weeks":"This week",`<div class="cnt" style="margin-bottom:6px">${J.wrote?`You have written ${p.every===2?"in these two weeks":"this week"}. You can add to it or change it.`:`${fd(p.start)} to ${fd(p.end)}.`}</div>${PROMPTS.map(([k,l,q])=>`<label class="fld-label"><b>${H(l)}.</b> ${H(q)}<textarea rows="3" data-gjf="${k}">${H(draft[k]||"")}</textarea></label>`).join("")}
    <div class="actions"><button class="btn" data-gjsave="${H(cur?cur.id:"")}">Save</button></div>`);
  const earlier=J.entries.filter(e=>dir||!cur||e.id!==cur.id);
  h+=card(dir?"Entries":"Earlier entries",earlier.length?earlier.map(e=>`<div class="garea"><b>${H(fd(e.date))}</b>${PROMPTS.filter(([k])=>e[k]).map(([k,l])=>`<div class="gq"><div class="cnt">${H(l)}</div><div style="white-space:pre-line">${H(e[k])}</div></div>`).join("")}
    ${dir?(e.bring&&(e.bring.checkin||e.bring.self)?`<div class="cnt">${H(name)} chose to bring this into ${[e.bring.checkin?"a check-in":"",e.bring.self?"the self-assessment":""].filter(Boolean).join(" and ")}.</div>`:""):`<div class="actions" style="margin:4px 0 0"><button class="pill" aria-pressed="${!!(e.bring&&e.bring.checkin)}" data-gjbring="${H(e.id)}|checkin">Bring to my next check-in</button><button class="pill" aria-pressed="${!!(e.bring&&e.bring.self)}" data-gjbring="${H(e.id)}|self">Bring to my self-assessment</button></div>`}</div>`).join(""):`<div class="cnt">${dir?"No entries yet.":"Entries you save appear here."}</div>`);
  draw(my,h)}

/* ---------- the monthly check-in ---------- */
const Q=[["temp","Professional temperature","How has the last month felt? What moments felt strong, and where did you feel stretched?"],["align","Team alignment","Is the team aligned in routines, expectations and communication? Where is there tension?"],
  ["work","Curriculum, environment and child goals","What are you working on in curriculum, the environment or with particular children, and what documentation or planning is underway?"],["challenge","One challenge","What is one challenge you are facing right now, and what have you tried so far?"],
  ["support","One support request","What is one support you need from leadership or teammates?"],["plusdelta","Plus delta","What went well this month, and what you would change."],["goals","Growth Plan goals","Where you are with your Growth Plan goals."],
  ["focus","Focus Until Next Time","The educator names what they want to focus on first. You add what you have seen, and the two of you settle on one focus together."],["followup","Follow-up notes","Specific actions, agreements, timelines and leadership follow-up."],["effect","Check-in effectiveness","Your own 1 to 5 rating of how well the check-in served the educator. Only you see it."]];
const rate=(attr,v)=>`<div class="tseg" role="group">${[1,2,3,4,5].map(n=>`<button data-${attr}="${n}" aria-pressed="${+v===n}">${n}</button>`).join("")}</div>`;
const tm=t=>t?X.hourText(t):"";
const dur=n=>n===90?"an hour and a half":n===60?"an hour":n%60===0?(n/60)+" hours":n>60?Math.floor(n/60)+" hours and "+(n%60)+" minutes":n+" minutes";
async function checkinPage(my){const dir=isDir();const b=B();
  if(!dir){const d=await doc(meName(),true);const s=[b.schedule.now,b.schedule.next].filter(Boolean).flatMap(x=>x.list).filter(x=>x.date>=today());const nxt=s[0];const mode=d.profile.checkin;
    const ym=today().slice(0,7);const pre=(d.pre||{})[ym]||{};const cis=d.checkins||[];const last=cis.find(c=>c.focus&&c.focus.settled);
    draw(my,head("Check-ins","My check-ins","A regular, supportive space to talk about your practice, your Class and the children, and to agree together on what comes next. Nothing needs to be prepared beforehand.")+
      card("My next check-in",nxt?`<div><b>${H(new Date(nxt.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))}</b>${nxt.time?", "+H(tm(nxt.time)):""}, about twenty minutes${nxt.kind==="second"?", on the short second Monday":nxt.kind==="slot"?", during your Monday planning hour":""}.</div><div class="cnt">It is on the TREE calendar too.</div>`:`<div class="cnt">${mode==="asneeded"?"Your check-ins happen as needed. The director sets a time with you.":"The next check-in appears here once it is on the calendar."}</div>`)+
      card("Before we meet",`<div class="hint">You name what you want to focus on first, if you like. You are always welcome to bring a journal entry, a proud moment, a question or a piece of documentation.</div><label class="fld-label">What I want to focus on<textarea rows="3" id="gc-pre">${H(pre.focus||"")}</textarea></label><div class="actions"><button class="btn small" data-gcpre="1">Save</button>${pre.at?`<span class="cnt">Saved ${H(fms(pre.at))}</span>`:""}</div>`)+
      card("Focus Until Next Time",last?`<div class="gq">${md(last.focus.settled)}</div><div class="cnt">${last.focus.area?"Linked to "+H(areaName(last.focus.area))+". ":""}From the check-in on ${H(fd(last.date))}.</div>${last.focus.module&&modReady(last.focus.module)?`<div class="actions"><button class="btn small ghost" data-tview="stpd" data-stmod="m:${H(last.focus.module)}">${H(modTitle(last.focus.module))}</button></div>`:""}
        <div class="actions"><button class="pill" aria-pressed="${!!last.followed}" data-gcfollow="${H(last.id)}">I have tried it</button><span class="cnt">Your focus and your follow-through count toward Reflective Practice and Professional Growth.</span></div>`:`<div class="cnt">Settled together at your next check-in.</div>`)+
      card("Follow-up notes",cis.filter(c=>c.followup||c.focus&&c.focus.settled).map(c=>`<div class="garea"><b>${H(fd(c.date))}</b>${c.focus&&c.focus.settled?`<div class="cnt">Focus Until Next Time. ${H(c.focus.settled)}</div>`:""}${c.followup?`<div style="white-space:pre-line;margin-top:4px">${H(c.followup)}</div>`:""}</div>`).join("")||`<div class="cnt">Notes from your check-ins appear here, to read whenever you like.</div>`));return}
  // the director's month, and one check-in
  if(st.ciWho){return checkinForm(my,st.ciWho)}
  const S2=[b.schedule.now,b.schedule.next].filter(Boolean);const asNeeded=b.people.filter(p=>p.checkin==="asneeded");
  draw(my,head("Check-ins","Check-ins","Each educator has one check-in a month in their Monday planning slot, about twenty minutes. TREE lays out each month from the planning hours in Settings, moving a holiday or the Monday after a long break to the next open Monday, and rotating the order within each slot.")+
    S2.map(s=>card(new Date(s.ym+"-01T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"}),`${s.moved?`<div class="cnt">Moved from ${H(fd(s.moved))}, which is a holiday or the Monday after a long break.</div>`:""}
      ${s.list.length?`<div class="tablewrap"><table class="grid2" style="min-width:420px"><thead><tr><th>Day</th><th>Time</th><th>Educator</th><th></th></tr></thead><tbody>${s.list.map(x=>`<tr><td>${H(fd(x.date))}${x.kind==="second"?` <span class="cnt">short second Monday</span>`:""}</td><td>${H(tm(x.time))}</td><td><b>${H(x.name)}</b></td><td><button class="btn small ghost" data-gci="${H(x.name)}" data-gcidate="${H(x.date)}">Open</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="cnt">No check-ins this month yet.</div>`}`)).join("")+
    card("As needed",`<div class="hint">${asNeeded.length?H(asNeeded.map(p=>p.name).join(" and "))+" have check-ins as needed.":"Everyone meets in a planning slot."} Set a day here and it joins the TREE calendar.</div>
      ${asNeeded.map(p=>`<div class="prow"><b>${H(p.name)}</b><span class="actions" style="margin:0"><input type="date" data-gbookd="${H(p.name)}" aria-label="Day for ${H(p.name)}"><input type="time" data-gbookt="${H(p.name)}" aria-label="Time for ${H(p.name)}"><button class="btn small ghost" data-gbook="${H(p.name)}">Set</button><button class="btn small ghost" data-gci="${H(p.name)}">Open a check-in</button></span></div>`).join("")}`)+
    card("Every educator",`<div class="actions" style="flex-wrap:wrap;margin:0">${b.people.map(p=>`<button class="pill" data-gci="${H(p.name)}">${H(p.name)}</button>`).join("")}</div>`))}
async function checkinForm(my,name){const d=await doc(name,true);const y=yr();const goals=(((d.plans||{})[y]||{}).goals||[]).filter(x=>String(x.text||"").trim());
  if(!st.ci||st.ci.__who!==name){const ym=(st.ciDate||today()).slice(0,7);const existing=(d.checkins||[]).find(c=>String(c.date).slice(0,7)===ym);
    st.ci=Object.assign({temp:{},align:{},goals:{},focus:{}},existing?JSON.parse(JSON.stringify(existing)):{date:st.ciDate||today()},{__who:name});
    const pre=(d.pre||{})[ym];if(pre&&pre.focus&&!st.ci.focus.mine)st.ci.focus.mine=pre.focus}
  const c=st.ci;const since=Date.now()-35*864e5;const w=workOf(name,since);
  const prep=[...w.pl.slice(0,4).map(p=>exPlan(p,"intent")),...w.roomThreads.slice(0,2).map(exThread),...w.obs.slice(0,3).map(exObs),...w.sl.slice(0,2).map(exSlide),...w.sto.slice(0,1).map(exStory)];
  const sugArea=c.focus.area||suggestArea([c.focus.settled,c.focus.mine,c.focus.seen].join(" "));const sugMod=c.focus.module||(B().modules.find(m=>m.ready&&m.areas.includes(sugArea)&&!["howto","licensing"].includes(m.slug))||{}).slug||"";
  const past=(d.checkins||[]).filter(x=>x.id!==c.id);
  const fld=(k,rows)=>`<textarea rows="${rows||3}" data-gcf="${k}" style="width:100%">${H(c[k]||"")}</textarea>`;
  draw(my,head("Check-ins","Check-in with "+name,`About twenty minutes. Nothing needs to be prepared beforehand. You ask the questions in the conversation and capture the answers.`)+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gciback="1">‹ Check-ins</button><label class="cnt">Day <input type="date" id="gc-date" value="${H(c.date||today())}"></label></div>`+
    card("Their last month",prep.length?exHtml(prep):`<div class="cnt">Nothing kept in TREE in the last month yet.</div>`,"")+
    card(Q[0][1],`<div class="cnt gq">${H(Q[0][2])}</div><div class="gcols"><div><div class="cnt">Their number, from 1 to 5</div>${rate("gctemps",c.temp.self)}</div><div><div class="cnt">Your number beside it</div>${rate("gctempd",c.temp.dir)}</div></div><textarea rows="3" data-gcf="temp.words" style="width:100%;margin-top:6px" aria-label="Their words">${H(c.temp.words||"")}</textarea>`)+
    card(Q[1][1],`<div class="cnt gq">${H(Q[1][2])}</div><div class="cnt">You rate it from 1 to 5</div>${rate("gcalign",c.align.rating)}<label class="fld-label">How leadership can support alignment<textarea rows="2" data-gcf="align.note">${H(c.align.note||"")}</textarea></label>`)+
    [2,3,4].map(i=>card(Q[i][1],`<div class="cnt gq">${H(Q[i][2])}</div>${fld(Q[i][0])}`)).join("")+
    card(Q[5][1],`<div class="cnt gq">${H(Q[5][2])}</div><div class="gcols"><label class="fld-label">Plus, what went well<textarea rows="4" data-gcf="plus">${H(c.plus||"")}</textarea></label><label class="fld-label">Delta, what to change<textarea rows="4" data-gcf="delta">${H(c.delta||"")}</textarea></label></div>`)+
    card(Q[6][1],goals.length?goals.map(x=>`<div class="garea"><b>${H(x.text)}</b>${x.area?` <span class="cnt">${H(areaName(x.area))}</span>`:""}<textarea rows="2" data-gcgoal="${H(x.id)}" style="width:100%;margin-top:4px" aria-label="Where they are">${H((c.goals||{})[x.id]||"")}</textarea></div>`).join(""):`<div class="cnt">No Growth Plan goals entered yet.</div>`)+
    card(Q[7][1],`<div class="cnt gq">${H(Q[7][2])}</div><label class="fld-label">What they want to focus on<textarea rows="2" data-gcf="focus.mine">${H(c.focus.mine||"")}</textarea></label><label class="fld-label">What you have seen<textarea rows="2" data-gcf="focus.seen">${H(c.focus.seen||"")}</textarea></label><label class="fld-label">The focus you settled on together<textarea rows="2" data-gcf="focus.settled">${H(c.focus.settled||"")}</textarea></label>
      <div class="kfields"><label>Area<select id="gc-area"><option value="">Choose</option>${AK().map(k=>`<option value="${k}" ${sugArea===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label><label>PD module, where one fits<select id="gc-mod"><option value="">None</option>${B().modules.filter(m=>m.ready&&m.slug!=="howto").map(m=>`<option value="${m.slug}" ${sugMod===m.slug?"selected":""}>${H(m.title)}</option>`).join("")}</select></label></div>`)+
    card(Q[8][1],`<div class="cnt gq">${H(Q[8][2])}</div>${fld("followup",4)}`)+
    card(Q[9][1],`<div class="cnt gq">${H(Q[9][2])}</div>${rate("gceffect",c.effect)}`)+
    `<div class="actions"><button class="btn" data-gcsave="1">Save the check-in</button><span class="cnt">${H(name)} sees only the Focus Until Next Time and follow-up notes.</span></div>`+
    ((d.trend||[]).length?card("Support trend",`<div class="gtrend">${trendSvg(d.trend)}</div><div class="cnt">Their temperature in green, yours in gold and team alignment in grey. A dip shows early, and these never touch evaluation scores.</div>`):"")+
    (past.length?card("Earlier check-ins",past.map(x=>`<div class="prow"><span><b>${H(fd(x.date))}</b> <span class="cnt">${H(clip(x.focus&&x.focus.settled,90))}</span></span><button class="btn small ghost" data-gciopen="${H(x.id)}">Open</button></div>`).join("")):""))}

/* ---------- Proud Moments and Kudos ---------- */
async function momentsPage(my){st.moments=(await ga("moments")).list;const f=st.mform;const team=B().team.filter(t=>t.name!==meName());
  const mine=workOf(meName(),Date.now()-120*864e5);const links=[...mine.obs.slice(0,8).map(exObs),...mine.pl.slice(0,5).map(p=>exPlan(p)),...mine.sl.slice(0,5).map(exSlide)];
  const aud={everyone:"Everyone at Fulton",class:"My Class team",director:"Only the director"};
  draw(my,head("Proud Moments","Proud Moments and Kudos","Keep what you are proud of and recognize one another. Moments and Kudos shared with everyone also rotate on the staff room display. Nothing is counted or tallied.")+
    card(f.kind==="kudos"?"Kudos for a colleague":"My proud moment",`${seg("data-gmkind",[["moment","My proud moment"],["kudos","Kudos for a colleague"]],f.kind)}
      ${f.kind==="kudos"?`<label class="fld-label">Colleague<select id="gm-to"><option value="">Choose</option>${team.map(t=>`<option ${f.to===t.name?"selected":""}>${H(t.name)}</option>`).join("")}</select></label><label class="fld-label">What they did that made a difference<textarea rows="3" id="gm-text">${H(f.text||"")}</textarea></label>`
        :`<label class="fld-label">Something I'm proud of, in a sentence or two<textarea rows="3" id="gm-text">${H(f.text||"")}</textarea></label>
        <div class="kfields"><label>Link one of my observations, plans or documentation pieces<select id="gm-link"><option value="">None</option>${links.map(x=>`<option value="${H(x.kind+"|"+x.id+"|"+x.label)}" ${f.link&&f.link.id===x.id?"selected":""}>${H(x.label)}</option>`).join("")}</select></label>
        <label>The area it fits best<select id="gm-area"><option value="">TREE suggests one</option>${AK().map(k=>`<option value="${k}" ${f.area===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label></div>
        <div class="actions"><button class="btn small ghost" data-gmphoto="1">${f.photo?"Photo added, change it":"Add a photo"}</button></div>`}
      <div class="chiprow-label" style="margin-top:8px">Who sees it${f.kind==="kudos"?". The colleague always sees it.":""}</div>${seg("data-gmaud",Object.entries(aud),f.audience||"everyone")}
      <div class="actions"><button class="btn" data-gmshare="1">Share</button></div>`)+
    card("Moments and Kudos",st.moments.length?st.moments.map(m=>`<div class="gmom"><div class="cnt"><b>${H(m.by)}</b>${m.kind==="kudos"?`, Kudos for <b>${H(m.to)}</b>`:", a proud moment"} <span class="muted">${H(fms(m.at))}, ${H(aud[m.audience]||"")}</span></div><div style="white-space:pre-line">${H(m.text)}</div>
      ${m.link?`<div class="cnt">${m.link.kind==="obs"?`<button class="linkbtn" data-obsgo="${H(m.link.id)}">${H(m.link.label)}</button>`:H(m.link.label)}</div>`:""}${m.photo?`<div><button class="linkbtn" data-gmview="${H(m.photo)}">See the photo</button></div>`:""}
      ${m.mine||isDir()?`<div><button class="linkbtn" data-gmrm="${H(m.id)}">Remove</button></div>`:""}</div>`).join(""):`<div class="cnt">Moments and Kudos you can see appear here.</div>`))}

/* ---------- the PD library's modules ---------- */
async function loadMods(force){if(!st.mods||force)st.mods=await ga("modules");return st.mods}
Gr.libraryHtml=async function(pcs,dn){const b=B();if(!b)return "";const d=await doc(meName()).catch(()=>({modules:{}}));const m=d.modules||{};
  const last=(d.checkins||[]).find(c=>c.focus&&c.focus.area);const fit=last?b.modules.find(x=>x.ready&&x.areas.includes(last.focus.area)&&!["howto","licensing"].includes(x.slug)):null;
  const ready=b.modules.filter(x=>x.ready);
  const stat=x=>x.slug==="licensing"||x.slug==="howto"?((pcs[x.slug]||[]).length&&(pcs[x.slug]||[]).every(p=>dn[p.id])?chip("ok","Finished"):(pcs[x.slug]||[]).some(p=>dn[p.id])?chip("soonish","Started"):""):m[x.slug]&&m[x.slug].done?chip("ok","Finished "+fms(m[x.slug].done)):m[x.slug]&&m[x.slug].opened?chip("soonish","Started"):"";
  return card("Modules",`<div class="hint">You choose the order you take modules in.${fit?` TREE suggests ${H(fit.title)}, which fits your Focus Until Next Time.`:""} Each module ends with a practice to try in your own Class and a few minutes of sharing at a staff meeting.</div>
    <div class="stgrid" style="margin-top:8px">${ready.map(x=>`<div class="stmod"><b>${H(x.title)}</b><div class="cnt">${H(x.desc)}</div>${x.minutes?`<div class="cnt">About ${dur(x.minutes)}</div>`:""}<div class="actions" style="margin:4px 0 0"><button class="btn small ghost" data-stmod="${x.slug==="licensing"||x.slug==="howto"?x.slug:"m:"+x.slug}">Open</button>${stat(x)}${fit&&fit.slug===x.slug?chip("soonish","Fits your focus"):""}</div></div>`).join("")}</div>
`)};
Gr.module=async function(my,slug){await Gr.ready();const ms=await loadMods();const m=ms.modules[slug];if(!m){draw(my,card("Not here",`<div class="hint">This module is not in the PD library yet.</div>`));return}
  const d=await doc(meName(),true);const pr=(d.modules||{})[slug]||{};const dir=isDir();const ex=(ms.examples||{})[slug]||{examples:[]};
  const sec=h=>m.sections.find(s=>s.heading.toLowerCase().startsWith(h));
  const why=sec("why it matters"),reading=sec("reading"),own=sec("from fulton"),tr=sec("try this week"),rf=sec("reflect"),sh=sec("share at"),rd=sec("readings");
  const serves=(m.serves||[]).map(areaName).filter(Boolean);
  let exBody="";
  if(dir){const pick=st.examplesPick&&st.examplesPick.slug===slug?st.examplesPick:{slug,list:(ex.examples||[]).slice(),shown:!!ex.shown};st.examplesPick=pick;
    const pool=[...[...notices.values()].filter(n=>n&&String(n.noticed||"").length>60).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,30).map(n=>({kind:"obs",id:n.id,label:clip(n.noticed,120)+" ("+(n.by||"")+")",text:clip(n.noticed,600)})),...[...slides.values()].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,12).map(x=>({kind:"slide",id:x.id,label:"Slide, "+clip(x.title,80)+" ("+(x.by||"")+")",text:clip([x.title,x.text].filter(Boolean).join(". "),600)}))];
    exBody=`<div class="hint">Choose two or three examples from Fulton's observations and documentation. They stay hidden from educators until you show them.</div>${pick.list.map((x,i)=>`<div class="gq"><div>${H(x.text)}</div><button class="linkbtn" data-gexrm="${i}">Take it out</button></div>`).join("")}
      ${pick.list.length<3?`<label class="fld-label">Add an example<select id="gex-add"><option value="">Choose from recent observations and slides</option>${pool.filter(p=>!pick.list.some(x=>x.id===p.id)).map(p=>`<option value="${H(p.kind+"|"+p.id)}">${H(p.label)}</option>`).join("")}</select></label>`:""}
      <label class="radio"><input type="checkbox" id="gex-shown" ${pick.shown?"checked":""}><span>Show these to educators</span></label><div class="actions"><button class="btn small" data-gexsave="${H(slug)}">Save the examples</button></div>`;
    st._exPool=pool}
  else exBody=ex.shown&&(ex.examples||[]).length?ex.examples.map(x=>`<div class="gq">${H(x.text)}</div>`).join(""):"";
  draw(my,`<div class="head"><div><span class="eyebrow">PD library</span><h2 style="margin-top:4px">${H(m.title)}</h2><div class="sub">About ${dur(m.minutes)}. Serves ${H(serves.join(" and "))}.</div></div></div>
    <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stmodback="1">‹ PD library</button>${pr.done?chip("ok","Finished "+fms(pr.done)):pr.opened?chip("soonish","Started"):""}</div>
    ${why?card("Why it matters",md(why.body)):""}${reading?card("Reading",md(reading.body)):""}
    ${exBody||dir?card("From Fulton's own documentation",exBody):""}
    ${tr?card("Try this week",`${md(tr.body)}<label class="radio"><input type="checkbox" data-gmtried="${H(slug)}" ${pr.tried?"checked":""}><span>I tried it in my Class</span></label>`):""}
    ${rf?card("Reflect",`<div class="stq">${md(rf.body)}</div><label class="fld-label">What happened when I tried it<textarea rows="4" id="gmod-ref">${H(pr.reflection||"")}</textarea></label><div class="cnt">Your reflection counts as evidence for ${H(serves.join(" and "))}. Only you and the director read it.</div>`):""}
    ${sh?card("Share at a staff meeting",`${md(sh.body)}<label class="fld-label">What I will share, if I want a note<textarea rows="2" id="gmod-share">${H(pr.share||"")}</textarea></label>`):""}
    ${rd?card("Readings",md(rd.body)):""}
    <div class="actions"><button class="btn small ghost" data-gmodsave="${H(slug)}">Save</button>${pr.done?"":`<button class="btn" data-gmodfinish="${H(slug)}">Finish the module</button><span class="cnt">Its hours go on your records page as Fulton PD hours.</span>`}</div>`);window.scrollTo(0,0)};

/* ---------- PD days and monthly PD staff meetings ---------- */
const HOW={whole:"Whole group",class:"By Class",pairs:"In pairs",quiet:"Quiet individual time"};
async function pdPage(my){const dir=isDir();const r=await ga("pd/list");st.pd=r.list;st.readings=r.readings;
  {const want=Gr._wantDate||LS.get("tree.pdwant","");if(want){LS.set("tree.pdwant",null);Gr._wantDate="";const it=st.pd.find(x=>x.date===want);if(it){st.pdSel=it.id;st.pdEdit=null}}}
  if(st.pdSel){const it=st.pd.find(x=>x.id===st.pdSel);if(it)return dir&&st.pdEdit?agendaBuilder(my,it):agendaView(my,it)}
  const up=st.pd.filter(x=>x.date>=today()),past=st.pd.filter(x=>x.date<today()).reverse();
  const row=x=>`<div class="prow"><span><b>${H(new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"}))}</b> ${H(x.title||(x.kind==="meeting"?"PD staff meeting":"PD day"))} <span class="cnt">${x.kind==="meeting"?"Monthly PD staff meeting":"PD day"}</span></span><span class="actions" style="margin:0">${dir?(x.agenda&&(x.agenda.blocks||[]).length?chip("ok",x.agenda.mode==="light"?"Light agenda":"Agenda ready"):chip("missing","No agenda yet")):""}<button class="btn small ghost" data-gpd="${H(x.id)}">${dir?"Open":"Read the agenda"}</button></span></div>`;
  draw(my,head("PD days","PD days and PD staff meetings",dir?"Each PD day and monthly PD staff meeting on the TREE calendar opens an agenda builder. Staff see an agenda two weeks before the day, hear a reminder a few days before, and every agenda ends with plus delta.":"PD days are the shared work, and each one builds on the individual work in the PD library. You can see each agenda two weeks before the day, with readings one tap away.")+
    card("Coming up",up.length?up.map(row).join(""):`<div class="cnt">${dir?"No PD day or PD staff meeting is on the calendar in the next months. Add one below.":"Agendas appear here two weeks before the day."}</div>`)+
    (past.length?card("Recent",past.slice(0,6).map(row).join("")):"")+
    (dir?card("Add a day",`<div class="hint">PD days and staff meetings already on the calendar appear by themselves. Add one here when it is not.</div><div class="kfields"><label>Day<input type="date" id="gpd-date"></label><label>Kind<select id="gpd-kind"><option value="pdday">PD day</option><option value="meeting">Monthly PD staff meeting, ${H(tm(B().settings.meeting.start))} to ${H(tm(B().settings.meeting.end))}</option></select></label><label>Title<input type="text" id="gpd-title" placeholder="Optional"></label></div><div class="actions"><button class="btn small" data-gpdadd="1">Add to the calendar</button></div>`):""))}
function agendaBlocksHtml(a){const R=st.readings||[];return (a.blocks||[]).map(b=>`<div class="gblock"><div class="sttop" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${b.time?H(tm(b.time))+", ":""}${H(b.title)}</b>${b.how?`<span class="cnt">${H(HOW[b.how]||"")}</span>`:""}</div>${b.why?`<div class="cnt">${H(b.why)}</div>`:""}${b.prepare?`<div class="cnt"><b>To prepare.</b> ${H(b.prepare)}</div>`:""}
  ${(b.readings||[]).length?`<div class="cnt">${b.readings.map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>x.url?`<a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>, ${H(x.source)}`:`${H(x.title)}, ${H(x.source)}`).join("<br>")}</div>`:""}${b.module&&modReady(b.module)?`<div><button class="linkbtn" data-tview="stpd" data-stmod="${b.module==="licensing"||b.module==="howto"?b.module:"m:"+b.module}">${H(modTitle(b.module))}</button></div>`:""}</div>`).join("")}
function agendaView(my,it){const a=it.agenda||{};const dir=isDir();const closed=it.date<=today();const mine=it.mine||{};
  draw(my,head(it.kind==="meeting"?"PD staff meeting":"PD day",a.title||it.title||(it.kind==="meeting"?"PD staff meeting":"PD day"),H(new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))+(a.start?", "+H(tm(a.start))+(a.end?" to "+H(tm(a.end)):""):""))+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gpd="">‹ PD days</button>${dir?`<button class="btn small" data-gpdedit="1">Build the agenda</button>`:""}<button class="btn small ghost" data-gprint="agenda">Print</button><button class="linkbtn" data-gword="agenda">Word</button></div>`+
    card("The agenda",(a.blocks||[]).length?`<div style="display:grid;gap:8px">${agendaBlocksHtml(a)}</div>`:`<div class="cnt">The director has not built this agenda yet.</div>`)+
    (!dir&&(a.blocks||[]).length?card("My plus delta",closed?`<div class="hint">What went well and what to change. The director reads them together, and they shape the next PD day.</div><div class="gcols"><label class="fld-label">Plus<textarea rows="3" id="gpdd-plus">${H(mine.plus||"")}</textarea></label><label class="fld-label">Delta<textarea rows="3" id="gpdd-delta">${H(mine.delta||"")}</textarea></label></div><div class="actions"><button class="btn" data-gpddsave="${H(it.id)}">Save</button>${mine.at?`<span class="cnt">Saved ${H(fms(mine.at))}</span>`:""}</div>`:`<div class="cnt">Written in TREE on your phone in the last fifteen minutes of the day.</div>`):""))}
function agendaBuilder(my,it){const R=st.readings||[];
  if(!st.pdEdit.blocks){const a=it.agenda||{};st.pdEdit=Object.assign({date:it.date,kind:it.kind,mode:a.mode||"full",title:a.title||it.title||"",start:a.start||it.start||(it.kind==="meeting"?B().settings.meeting.start:""),end:a.end||it.end||(it.kind==="meeting"?B().settings.meeting.end:""),blocks:JSON.parse(JSON.stringify((a.blocks||[]).filter(b=>!b.closing)))},{loaded:true,sug:st.pdEdit.sug||null,found:{}})}
  const E=st.pdEdit;const full=E.mode==="full";const pdl=(it.agenda||{}).plusDeltaList||[];
  const relevant=b=>{const kw=String(b.title+" "+b.why).toLowerCase().split(/[^a-z]+/).filter(w=>w.length>4);return R.filter(x=>!(b.readings||[]).includes(x.id)&&((b.area&&(x.areas||[]).includes(b.area))||(b.module&&(x.modules||[]).includes(b.module))||kw.some(w=>String(x.title+" "+x.supports).toLowerCase().includes(w)))).slice(0,8)};
  const blk=(b,i)=>`<div class="gblock"><div class="kfields"><label>Time<input type="time" data-gbk="${i}|time" value="${H(b.time||"")}"></label><label style="grid-column:span 2">Title<input type="text" data-gbk="${i}|title" value="${H(b.title||"")}"></label></div>
    ${full?`<label class="fld-label">Why it matters for the children<input type="text" data-gbk="${i}|why" value="${H(b.why||"")}"></label>
    <div class="kfields"><label>How the time is spent<select data-gbk="${i}|how"><option value="">Choose</option>${Object.entries(HOW).map(([k,l])=>`<option value="${k}" ${b.how===k?"selected":""}>${l}</option>`).join("")}</select></label><label>Area<select data-gbk="${i}|area"><option value="">None</option>${AK().map(k=>`<option value="${k}" ${b.area===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label><label>PD module it supports<select data-gbk="${i}|module"><option value="">None</option>${B().modules.filter(m=>m.ready).map(m=>`<option value="${m.slug}" ${b.module===m.slug?"selected":""}>${H(m.title)}</option>`).join("")}</select></label></div>
    <label class="fld-label">What to prepare<input type="text" data-gbk="${i}|prepare" value="${H(b.prepare||"")}"></label>
    <div class="cnt">Linked readings</div>${(b.readings||[]).map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>`<div class="cnt">${H(x.title)}, ${H(x.source)} <button class="linkbtn" data-gbkrd="${i}|${H(x.id)}|0">Take it out</button></div>`).join("")||`<div class="cnt muted">None chosen yet</div>`}
    <details><summary class="cnt">Suggested readings for this block</summary><div class="gex">${relevant(b).map(x=>`<div class="cnt">${x.url?`<a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>`:H(x.title)}, ${H(x.source)}${x.supports?` <span class="muted">${H(x.supports)}</span>`:""} <button class="linkbtn" data-gbkrd="${i}|${H(x.id)}|1">Choose</button></div>`).join("")||`<div class="cnt">Give the block an area, a module or a title to see readings.</div>`}
      ${(E.found[i]||[]).map((x,j)=>`<div class="cnt"><a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>, ${H(x.source)} <button class="linkbtn" data-gbkfound="${i}|${j}">Add to the library and choose</button></div>`).join("")}
      <div class="actions"><button class="btn small ghost" data-gbksearch="${i}">${st.searching===i?"Searching trusted sources":"Search trusted sources for new ones"}</button></div></div></details>`:""}
    <div class="actions" style="margin:0"><button class="linkbtn" data-gbkmv="${i}|-1">Move up</button><button class="linkbtn" data-gbkmv="${i}|1">Move down</button><button class="linkbtn" data-gbkrm="${i}">Remove</button></div></div>`;
  draw(my,head(it.kind==="meeting"?"PD staff meeting":"PD day","Build the agenda",H(new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))+`. Staff see it from ${H(fd(X.addDays(it.date,-14)))}, two weeks ahead, and hear a reminder three days before.`)+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gpdedit="0">‹ The agenda</button></div>`+
    card("This time",`${seg("data-gpdmode",[["full","Full, with TREE's suggested topics and readings"],["light","Light, I type the items myself"]],E.mode)}<div class="kfields" style="margin-top:8px"><label style="grid-column:span 2">Title<input type="text" id="gpde-title" value="${H(E.title)}"></label><label>Starts<input type="time" id="gpde-start" value="${H(E.start||"")}"></label><label>Ends<input type="time" id="gpde-end" value="${H(E.end||"")}"></label></div>`)+
    (full?card("Suggestions from TREE",E.sug?`<div class="hint">Each with the reasons TREE noticed. Nothing from an individual check-in, journal or evaluation appears with a name.</div><div style="display:grid;gap:8px">${E.sug.map((s,i)=>`<div class="gsug"><b>${H(s.topic)}</b>${s.why.map(w=>`<div class="cnt">${H(w)}</div>`).join("")}<div><button class="btn small ghost" data-gsugadd="${i}">Add as a block</button></div></div>`).join("")||`<div class="cnt">Nothing stands out right now.</div>`}</div>`:`<div class="actions" style="margin:0"><button class="btn small ghost" data-gsugload="1">Show TREE's suggestions</button></div>`):"")+
    card("Blocks",`<div style="display:grid;gap:8px">${E.blocks.map(blk).join("")}</div><div class="actions"><button class="btn small ghost" data-gbkadd="1">Add a block</button></div><div class="gblock" style="margin-top:8px"><b>Plus delta</b><div class="cnt">Every agenda ends here. In the last fifteen minutes, each educator writes what went well and what to change in TREE on their phone, and the group shares a few aloud before leaving.</div></div>`)+
    `<div class="actions"><button class="btn" data-gpdsave="1">Save the agenda</button></div>`+
    (pdl.length?card("Plus delta from this day",`<div class="hint">Read together. They shape the next PD day's suggestions.</div><div class="gcols"><div><b>Plus</b>${pdl.filter(x=>x.plus).map(x=>`<div class="gq">${H(x.plus)}</div>`).join("")}</div><div><b>Delta</b>${pdl.filter(x=>x.delta).map(x=>`<div class="gq">${H(x.delta)}</div>`).join("")}</div></div>`):"")+
    card("Hours",`<div class="hint">Logged on each attendee's records page as Fulton PD hours, ${H(it.hours)} hours.</div><div class="chips">${B().people.map(p=>`<button class="chip ${((it.agenda||{}).logged||{names:[]}).names.includes(p.name)?"":"on"}" type="button" data-gpdname="${H(p.name)}">${H(p.name)}</button>`).join("")}</div><div class="actions"><button class="btn small" data-gpdhours="${H(it.id)}">Log the hours for everyone chosen</button>${(it.agenda||{}).logged?`<span class="cnt">Logged ${H(fms(it.agenda.logged.at))}</span>`:""}</div>`))}

/* ---------- settings ---------- */
Gr.settingsHtml=function(SB){const b=B();if(!b)return "";const c=b.settings.checkin,m=b.settings.meeting;
  return `<div class="prow" style="margin-top:12px"><div><b>Check-ins</b><div class="cnt">Class educators meet on one Monday a month in their planning slot. Those on the short second Monday meet the next open Monday.</div></div>
    <span class="actions" style="margin:0"><label class="cnt">Monday<select id="gs-week">${[1,2,3,4].map(n=>`<option value="${n}" ${+c.week===n?"selected":""}>${["","First","Second","Third","Fourth"][n]} Monday</option>`).join("")}</select></label><label class="cnt">Short second Monday at<input type="time" id="gs-second" value="${H(c.secondTime||"")}"></label></span></div>
    <div class="prow"><div><b>Monthly PD staff meetings</b><div class="cnt">On the TREE calendar, with the same agenda builder</div></div><span class="actions" style="margin:0"><input type="time" id="gs-mstart" value="${H(m.start)}" aria-label="Starts"><input type="time" id="gs-mend" value="${H(m.end)}" aria-label="Ends"></span></div>
    <div class="actions"><button class="btn small" data-gsset="1">Save the check-in and meeting times</button></div>`};

/* ---------- printouts and Word files ---------- */
function evalDoc(d){const y=yr();const ev=(d.evals||{})[y]||{};const sc=scoresOf(d,y);const past=Object.keys(d.evals||{}).filter(k=>k<y).sort();const dv=ev.dir||{},self=ev.self||{};const pr=d.profile||{};
  const strengths=dv.strengths||strengthsDraft(d);
  return report("End of year evaluation, "+d.name,[["School year",yrLabel(y)],["Class",pr.room?pr.room+" Class":""],["Printed",fd(today())]],[
    {t:"text",label:"Strengths",text:strengths||"Written with the director at the end of the year."},
    {t:"table",label:"Growth across the year",head:["Area",...past.map(yrLabel),yrLabel(y),"Own placement"],rows:[...AK().map(k=>[areaName(k),...past.map(p=>{const v=scoresOf(d,p).by[k];return v==="nys"?"Not yet seen":v?v+" "+PN[v]:""}),sc.by[k]==="nys"?"Not yet seen":sc.by[k]?sc.by[k]+" "+PN[sc.by[k]]:"",(self.placements||{})[k]?self.placements[k]+" "+PN[self.placements[k]]:""]),["Overall, the average of scored areas",...past.map(p=>String(scoresOf(d,p).overall||"")),String(sc.overall||""),""]]},
    ...AK().filter(k=>numeric(sc.by[k])).map(k=>({t:"text",label:areaName(k),text:(contArea(k).points[numeric(sc.by[k])-1]||{}).text||""})),
    dv.narrative?{t:"text",label:"The director's narrative",text:X.plain(dv.narrative)}:null,
    ...AK().filter(k=>(self.writes||{})[k]).map(k=>({t:"text",label:"In "+(d.name)+"'s words, "+areaName(k),text:self.writes[k]})),
    self.closing?{t:"text",label:"Where I want to grow next year",text:self.closing}:null,
    {t:"list",label:"Goals for next year",items:(ev.goals||[]).map(x=>x.text+(x.area?", "+areaName(x.area):""))}])}
function agendaDoc(it){const a=it.agenda||{};const R=st.readings||[];
  return report(a.title||it.title||(it.kind==="meeting"?"PD staff meeting":"PD day"),[["Day",new Date(it.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})],["Time",a.start?tm(a.start)+(a.end?" to "+tm(a.end):""):""]],
    (a.blocks||[]).map(b=>({t:"text",label:(b.time?tm(b.time)+", ":"")+b.title,text:[b.why,b.how?HOW[b.how]+".":"",b.prepare?"To prepare. "+b.prepare:"",(b.readings||[]).map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>x.title+", "+x.source+(x.url?" ("+x.url+")":"")).join(". ")].filter(Boolean).join(" ")})))}

/* ---------- taps ---------- */
const val=s=>{const e=$(s);return e?e.value:""};
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;
  // leaving a page closes the journal, so it asks for the passcode again
  // the typing in an agenda being built is kept for that day, and opens again with Build the agenda
  try{collectAgenda()}catch(er){}if(st.pdEdit&&st.pdEdit.blocks&&st.pdSel)st.pdStash={id:st.pdSel,edit:st.pdEdit};
  st.jr=null;st.jDraft=null;st.self=false;st.selfDraft=null;st.starting=false;st.startDraft=null;st.tab="";st.ci=null;st.ciWho="";st.pdSel="";st.pdEdit=null;st.editCont=false;st.planDraft=null;st.examplesPick=null},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-gsel],[data-gtab],[data-gself],[data-gselfback],[data-gselfpt],[data-gwrite],[data-gselfsave],[data-gdir],[data-gdirsave],[data-gmeet],[data-gnextsave],[data-gstart],[data-gstartback],[data-gstartpt],[data-gstartsave],[data-gcont],[data-gcontsave],[data-gpww],[data-gpok],[data-gpadd],[data-gpsave],[data-gjopen],[data-gjclose],[data-gjsave],[data-gjbring],[data-gcpre],[data-gcfollow],[data-gci],[data-gciback],[data-gciopen],[data-gctemps],[data-gctempd],[data-gcalign],[data-gceffect],[data-gcsave],[data-gbook],[data-gmkind],[data-gmaud],[data-gmshare],[data-gmphoto],[data-gmview],[data-gmrm],[data-gexrm],[data-gexsave],[data-gmodsave],[data-gmodfinish],[data-gpd],[data-gpdedit],[data-gpdadd],[data-gpdmode],[data-gsugload],[data-gsugadd],[data-gbkadd],[data-gbkrm],[data-gbkmv],[data-gbkrd],[data-gbksearch],[data-gbkfound],[data-gpdsave],[data-gpdname],[data-gpdhours],[data-gpddsave],[data-gprint],[data-gword],[data-gsset]");
  if(!t)return;X.tapOnce(t,()=>gTap(e,t))},true);
async function gTap(e,t){const d=t.dataset;
  const ro=VIEW_AS&&!d.gsel&&!d.gtab&&!d.gpd&&!d.gprint&&!d.gword&&!d.gciback&&!d.gselfback;if(ro){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  try{
  if(d.gsel!=null){st.sel=d.gsel;st.tab="";st.planDraft=null;st.jr=null;st.self=false;st.starting=false;redraw();return}
  if(d.gtab){st.tab=d.gtab;redraw();return}
  if(d.gself){st.self=true;st.selfDraft=null;T.render("stgrow");return}
  if(d.gselfback){st.self=false;T.render("stgrow");return}
  if(d.gselfpt){const [k,n]=d.gselfpt.split("|");st.selfDraft.placements[k]=+n;redraw();return}
  if(d.gselfsave!=null){collectSelf();const r=await ga("eval/self",{self:Object.assign({},st.selfDraft,{done:d.gselfsave==="1"})});setDoc(meName(),r);toast(d.gselfsave==="1"?"Thank you. It is ready for the meeting.":"Saved.");if(d.gselfsave==="1"){st.self=false;st.selfDraft=null}T.render("stgrow");return}
  if(d.gdir){const [k,v]=d.gdir.split("|");const dd=st.docs[st.sel];const ev=(dd.evals[yr()]=dd.evals[yr()]||{});ev.dir=ev.dir||{placements:{}};ev.dir.placements=ev.dir.placements||{};collectDir();ev.dir.placements[k]=v==="nys"?"nys":+v;st._dirDirty=true;
    const r=await ga("eval/director",{name:st.sel,dir:Object.assign({},ev.dir,{done:false})});setDoc(st.sel,r);redraw();return}
  if(d.gdirsave!=null){const dd=st.docs[st.sel];const ev=(dd.evals[yr()]=dd.evals[yr()]||{});ev.dir=ev.dir||{placements:{}};collectDir();const r=await ga("eval/director",{name:st.sel,dir:Object.assign({},ev.dir,{done:d.gdirsave==="1"})});setDoc(st.sel,r);toast("Saved.");redraw();return}
  if(d.gmeet){if(!confirm(`Open the meeting view? ${st.sel} will see both placements side by side.`))return;const r=await ga("eval/meeting",{name:st.sel});setDoc(st.sel,r);toast("The meeting view is open.");redraw();return}
  if(d.gnextsave){const goals=[...document.querySelectorAll("[data-gnext]")].map(x=>({text:x.value,area:suggestArea(x.value)}));const r=await ga("eval/goals",{name:who(),goals});setDoc(who(),r);toast("Saved, and carried into next year's Growth Plan.");redraw();return}
  if(d.gstart){st.starting=true;st.startDraft=null;redraw();return}
  if(d.gstartback){st.starting=false;redraw();return}
  if(d.gstartpt){const [k,n]=d.gstartpt.split("|");st.startDraft.placements[k]=+n;redraw();return}
  if(d.gstartsave!=null){st.startDraft.notes=val("#g-startnotes");const done=d.gstartsave==="1";const r=await ga("starting",{name:st.sel,starting:Object.assign({},st.startDraft,{done,shared:done})});setDoc(st.sel,r);toast(done?"Done. It shows on their growth page and their checklist.":"Saved.");if(done){st.starting=false}redraw();return}
  if(d.gcont!=null){st.editCont=d.gcont==="1";redraw();return}
  if(d.gcontsave){const areas={};document.querySelectorAll("[data-gct]").forEach(x=>{const [k,i,f]=x.dataset.gct.split("|");areas[k]=areas[k]||[];areas[k][+i]=areas[k][+i]||{};areas[k][+i][f]=x.value});const r=await ga("continuum/save",{areas});st.boot.continuum=r.continuum;toast("Approved for the year.");st.editCont=false;redraw();return}
  if(d.gpww){collectPlan();st.planDraft.wentWell.choice=d.gpww;redraw();return}
  if(d.gpok!=null){collectPlan();const x=st.planDraft.goals[+d.gpok];x.area=x.area||suggestArea(x.text);if(!x.area){toast("Choose the area first.");return}x.areaOk=true;redraw();return}
  if(d.gpadd){collectPlan();st.planDraft.goals.push({id:"g"+Math.random().toString(36).slice(2,8),text:"",area:"",areaOk:false});redraw();return}
  if(d.gpsave){collectPlan();const p=st.planDraft;const body={wentWell:p.wentWell,goals:p.goals.filter(x=>String(x.text||"").trim()),challenges:p.challenges,need:p.need,reflection:p.reflection};
    if(!isDir())body.feedback=p.feedback||"";else{body.note=val("#gp-note");body.source=$("#gp-aug")&&$("#gp-aug").checked?"august":"tree"}
    const r=await ga("plan",{name:who(),plan:body});setDoc(who(),r);st.planDraft=null;toast("Saved.");redraw();return}
  if(d.gjopen){const pass=val("#gj-pass");if(!pass){toast("Type your TREE passcode.");return}const r=await ga("journal/open",{name:who(),passcode:pass});st.jr=r;st.jrWho=who();st.jDraft=null;redraw();return}
  if(d.gjclose){st.jr=null;st.jDraft=null;redraw();return}
  if(d.gjsave!=null){const entry={id:d.gjsave||""};document.querySelectorAll("[data-gjf]").forEach(x=>entry[x.dataset.gjf]=x.value);if(!PROMPTS.some(([k])=>String(entry[k]||"").trim())){toast("Write a few honest sentences first.");return}
    const r=await ga("journal/save",{name:who(),key:st.jr.key,entry});Object.assign(st.jr,r);st.jDraft=null;toast("Saved. Only you and the director see it.");redraw();return}
  if(d.gjbring){const [id,to]=d.gjbring.split("|");const r=await ga("journal/bring",{name:who(),key:st.jr.key,id,to});st.jr.entries=r.entries;redraw();return}
  if(d.gcpre){const r=await ga("checkin/pre",{focus:val("#gc-pre")});setDoc(meName(),r);toast("Saved. You can talk it through at your check-in.");redraw();return}
  if(d.gcfollow){const r=await ga("checkin/followed",{id:d.gcfollow});setDoc(meName(),r);redraw();return}
  if(d.gci){st.ciWho=d.gci;st.ciDate=d.gcidate||"";st.ci=null;redraw();window.scrollTo(0,0);return}
  if(d.gciback){st.ciWho="";st.ci=null;redraw();return}
  if(d.gciopen){const dd=st.docs[st.ciWho];st.ci=Object.assign({temp:{},align:{},goals:{},focus:{}},JSON.parse(JSON.stringify((dd.checkins||[]).find(c=>c.id===d.gciopen))),{__who:st.ciWho});redraw();window.scrollTo(0,0);return}
  if(d.gctemps||d.gctempd||d.gcalign||d.gceffect){collectCi();const c=st.ci;if(d.gctemps)c.temp.self=+d.gctemps;if(d.gctempd)c.temp.dir=+d.gctempd;if(d.gcalign)c.align.rating=+d.gcalign;if(d.gceffect)c.effect=+d.gceffect;redraw();return}
  if(d.gcsave){collectCi();const r=await ga("checkin/save",{name:st.ciWho,checkin:st.ci});setDoc(st.ciWho,r);st.ci=Object.assign({temp:{},align:{},goals:{},focus:{}},JSON.parse(JSON.stringify((r.checkins||[]).find(c=>c.date===st.ci.date)||st.ci)),{__who:st.ciWho});toast("Saved.");redraw();return}
  if(d.gbook){const day=$(`[data-gbookd="${CSS.escape(d.gbook)}"]`),time=$(`[data-gbookt="${CSS.escape(d.gbook)}"]`);await ga("checkin/book",{name:d.gbook,date:day&&day.value,time:time&&time.value});bootP=null;await Gr.ready();toast("Set, and on the TREE calendar.");redraw();return}
  if(d.gmkind){collectMoment();st.mform.kind=d.gmkind;redraw();return}
  if(d.gmaud){collectMoment();st.mform.audience=d.gmaud;redraw();return}
  if(d.gmphoto){collectMoment();const f=await X.pickFile();if(!f)return;if(!/image\/(jpeg|png)/.test(f.type)){toast("Choose a JPEG or PNG photo.");return}progress("Keeping the photo");const r=await api("upload",{moment:true,filename:f.name||"photo.jpg",data:await X.b64(f)});st.mform.photo=r.fid;toast("Photo added.");redraw();return}
  if(d.gmview){progress("Opening the photo");const r=await fetch(window.FP_SERVER+"/api/staff/moment/file",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(localStorage.getItem("fp-token")||"")},body:JSON.stringify({fid:d.gmview})});if(!r.ok){toast("The photo could not be opened.");return}const u=URL.createObjectURL(await r.blob());window.open(u,"_blank","noopener");return}
  if(d.gmshare){collectMoment();const f=st.mform;if(f.kind!=="kudos"&&!f.area)f.area=suggestArea(f.text);const r=await ga("moments/add",{moment:f});st.mform={kind:f.kind,audience:"everyone"};st.moments=null;toast(r.moment.audience==="everyone"?"Shared with everyone at Fulton.":"Shared.");redraw();return}
  if(d.gmrm){if(!confirm("Remove this?"))return;await ga("moments/remove",{id:d.gmrm});st.moments=null;redraw();return}
  if(d.gexrm!=null){st.examplesPick.list.splice(+d.gexrm,1);redraw();return}
  if(d.gexsave){const p=st.examplesPick;const add=val("#gex-add");if(add){const [k,id]=add.split("|");const x=(st._exPool||[]).find(y=>y.id===id);if(x)p.list.push({kind:k,id,text:x.text,label:x.label})}p.shown=!!($("#gex-shown")&&$("#gex-shown").checked);
    await ga("module/examples",{slug:d.gexsave,examples:p.list,shown:p.shown});st.mods=null;st.examplesPick=null;toast(p.shown?"Saved and shown to educators.":"Saved, hidden from educators.");redraw();return}
  if(d.gmodsave||d.gmodfinish){const slug=d.gmodsave||d.gmodfinish;const r=await ga("module/progress",{slug,progress:{reflection:val("#gmod-ref"),share:val("#gmod-share"),finish:!!d.gmodfinish}});setDoc(meName(),r);toast(d.gmodfinish?"Finished. Its hours are on your records page as Fulton PD hours.":"Saved.");redraw();return}
  if(d.gpd!=null){st.pdSel=d.gpd;st.pdEdit=null;T.render("stpdd");window.scrollTo(0,0);return}
  if(d.gpdedit!=null){st.pdEdit=d.gpdedit==="1"?(st.pdStash&&st.pdStash.id===st.pdSel?st.pdStash.edit:{}):null;st.pdStash=null;redraw();return}
  if(d.gpdadd){await ga("pd/add",{date:val("#gpd-date"),kind:val("#gpd-kind"),title:val("#gpd-title")});toast("Added to the TREE calendar.");redraw();return}
  if(d.gpdmode){collectAgenda();st.pdEdit.mode=d.gpdmode;redraw();return}
  if(d.gsugload){collectAgenda();st.pdEdit.sug=(await ga("pd/suggest")).topics;redraw();return}
  if(d.gsugadd!=null){collectAgenda();const s=st.pdEdit.sug[+d.gsugadd];st.pdEdit.blocks.push({id:"k"+Date.now().toString(36),time:"",title:s.topic,why:"",how:"whole",prepare:"",readings:[],area:s.area||"",module:s.module||""});redraw();return}
  if(d.gbkadd){collectAgenda();st.pdEdit.blocks.push({id:"k"+Date.now().toString(36),time:"",title:"",why:"",how:"",prepare:"",readings:[],area:"",module:""});redraw();return}
  if(d.gbkrm!=null){collectAgenda();st.pdEdit.blocks.splice(+d.gbkrm,1);redraw();return}
  if(d.gbkmv){collectAgenda();const [i,dd]=d.gbkmv.split("|").map(Number);const b=st.pdEdit.blocks;const j=i+dd;if(j<0||j>=b.length)return;[b[i],b[j]]=[b[j],b[i]];redraw();return}
  if(d.gbkrd){collectAgenda();const [i,id,on]=d.gbkrd.split("|");const b=st.pdEdit.blocks[+i];b.readings=(b.readings||[]).filter(x=>x!==id);if(on==="1")b.readings.push(id);redraw();return}
  if(d.gbksearch!=null){collectAgenda();const i=+d.gbksearch;const b=st.pdEdit.blocks[i];if(!b.title){toast("Give the block a title first.");return}if(!sample){toast("Suggested readings are not available right now. Add your own instead.");return}
    st.searching=i;redraw();
    try{const res=await sample.json(`Find 3 or 4 readings for early childhood educators at a Reggio-inspired, nature-based preschool, for a professional development session on this topic. Search the web, and use only pages you actually found in your search results, with their exact web addresses. Weigh every site you can search equally, and choose the best and most current pages.\n\nTopic. ${b.title}. ${b.why||""}\n\nReturn only a JSON object with one key "items", an array of objects with "title" (with any colon replaced by a comma), "url", "source" (the organization) and "why" (one short sentence).`,{modelTier:"complex",cache:false,purpose:"pd-reading"});
      st.pdEdit.found[i]=(Array.isArray(res&&res.items)?res.items:[]).filter(x=>x&&/^https:\/\//.test(x.url||"")).map(x=>({title:String(x.title||"").replace(/[:—–]/g,","),url:String(x.url),source:String(x.source||"").replace(/[:—–]/g,",")})).slice(0,4);
      toast(st.pdEdit.found[i].length?"Found some. Open each one before choosing it.":"Nothing came back from trusted sites. Add your own instead.")}catch(er){toast("Suggested readings are not available right now.")}
    st.searching=false;redraw();return}
  if(d.gbkfound){collectAgenda();const [i,j]=d.gbkfound.split("|").map(Number);const x=st.pdEdit.found[i][j];const b=st.pdEdit.blocks[i];const r=await ga("readings/add",{reading:{title:x.title,url:x.url,source:x.source,areas:b.area?[b.area]:[],modules:b.module?[b.module]:[]}});st.readings=r.list;const got=r.list.find(y=>y.url===x.url);if(got){b.readings=[...(b.readings||[]),got.id]}st.pdEdit.found[i].splice(j,1);redraw();return}
  if(d.gpdsave){collectAgenda();const E=st.pdEdit;st.pdStash=null;await ga("pd/save",{agenda:{date:E.date,kind:E.kind,mode:E.mode,title:E.title,start:E.start,end:E.end,blocks:E.blocks}});toast(`Saved. Staff see it from ${fd(X.addDays(E.date,-14))}.`);st.pdEdit=null;T.render("stpdd");return}
  if(d.gpdname){t.classList.toggle("on");return}
  if(d.gpdhours){const names=[...document.querySelectorAll("[data-gpdname].on")].map(x=>x.dataset.gpdname);if(!names.length){toast("Choose who attended.");return}const r=await ga("pd/hours",{id:d.gpdhours,names});toast(r.n?`Logged ${r.hours} hours for ${names.length===1?names[0]:"everyone chosen"}.`:"Already logged.");T.render("stpdd");return}
  if(d.gpddsave){await ga("pd/plusdelta",{id:d.gpddsave,plus:val("#gpdd-plus"),delta:val("#gpdd-delta")});toast("Saved. Thank you.");T.render("stpdd");return}
  if(d.gprint||d.gword){const k=d.gprint||d.gword;const kind=d.gword?"word":"pdf";progress("Making the file");
    if(k==="eval"){const dd=st.docs[who()];return out(kind,[evalDoc(dd)],"End of year evaluation "+dd.name+" "+yr())}
    if(k==="agenda"){const it=st.pd.find(x=>x.id===st.pdSel);return out(kind,[agendaDoc(it)],(it.kind==="meeting"?"PD staff meeting ":"PD day ")+it.date)}}
  if(d.gsset){await api("school",{school:{checkin:{week:+val("#gs-week"),secondTime:val("#gs-second")},meeting:{start:val("#gs-mstart"),end:val("#gs-mend")}}});bootP=null;await Gr.ready();toast("Saved. The calendar follows.");return}
  }catch(er){fail(er)}
}
document.addEventListener("change",e=>{const t=e.target;if(!t.closest||!t.closest("#main"))return;const d=t.dataset;
  if(d.gwrite){collectSelf();if(t.checked){st.selfDraft.writes[d.gwrite]=st.selfDraft.writes[d.gwrite]||""}else delete st.selfDraft.writes[d.gwrite];redraw();return}
  if(d.gparea!=null){collectPlan();const x=st.planDraft.goals[+d.gparea];x.area=t.value;x.areaOk=false;redraw();return}
  if(t.name==="gpfb"&&st.planDraft){st.planDraft.feedback=t.value;return}
  if(d.gmtried){ga("module/progress",{slug:d.gmtried,progress:{tried:t.checked}}).then(r=>{setDoc(meName(),r);toast(t.checked?"Noted. Write what happened below when you are ready.":"Unmarked.")}).catch(fail);return}
});
function collectSelf(){const s=st.selfDraft;if(!s)return;document.querySelectorAll("[data-gselfw]").forEach(x=>s.writes[x.dataset.gselfw]=x.value);s.examples=s.examples||{};
  document.querySelectorAll("[data-gselfex]").forEach(x=>{const k=x.dataset.gselfex;if(!x.value){delete s.examples[k];return}const [kind,id]=x.value.split("|");s.examples[k]=[{kind,id,label:x.options[x.selectedIndex].text}]});const c=$("#g-closing");if(c)s.closing=c.value}
function collectDir(){const dd=st.docs[st.sel];const ev=dd.evals[yr()];ev.dir=ev.dir||{};ev.dir.notes=ev.dir.notes||{};document.querySelectorAll("[data-gdirnote]").forEach(x=>ev.dir.notes[x.dataset.gdirnote]=x.value);if($("#g-narr"))ev.dir.narrative=val("#g-narr");if($("#g-strengths"))ev.dir.strengths=val("#g-strengths")}
function collectPlan(){const p=st.planDraft;if(!p)return;if($("#gp-ww"))p.wentWell.text=val("#gp-ww");document.querySelectorAll("[data-gpgoal]").forEach(x=>{p.goals[+x.dataset.gpgoal].text=x.value});if($("#gp-ch"))p.challenges=val("#gp-ch");p.reflection=p.reflection||{};document.querySelectorAll("[data-gprefl]").forEach(x=>{p.reflection[x.dataset.gprefl]=x.value});
  p.need={director:val("#gp-nd"),team:val("#gp-nt"),training:val("#gp-nr")};const fb=document.querySelector('input[name="gpfb"]:checked');if(fb&&!isDir())p.feedback=fb.value}
function collectCi(){const c=st.ci;if(!c)return;document.querySelectorAll("[data-gcf]").forEach(x=>{const [a,b]=x.dataset.gcf.split(".");if(b){c[a]=c[a]||{};c[a][b]=x.value}else c[a]=x.value});
  document.querySelectorAll("[data-gcgoal]").forEach(x=>{c.goals=c.goals||{};c.goals[x.dataset.gcgoal]=x.value});const dt=$("#gc-date");if(dt&&dt.value)c.date=dt.value;if($("#gc-area"))c.focus.area=val("#gc-area");if($("#gc-mod"))c.focus.module=val("#gc-mod")}
function collectMoment(){const f=st.mform;if($("#gm-text"))f.text=val("#gm-text");if($("#gm-to"))f.to=val("#gm-to");if($("#gm-area"))f.area=val("#gm-area");const l=val("#gm-link");if($("#gm-link")){if(l){const [kind,id,...rest]=l.split("|");f.link={kind,id,label:rest.join("|")}}else f.link=null}}
function collectAgenda(){const E=st.pdEdit;if(!E||!E.blocks)return;if($("#gpde-title"))E.title=val("#gpde-title");if($("#gpde-start"))E.start=val("#gpde-start");if($("#gpde-end"))E.end=val("#gpde-end");
  document.querySelectorAll("[data-gbk]").forEach(x=>{const [i,f]=x.dataset.gbk.split("|");const b=E.blocks[+i];if(b)b[f]=x.value})}
// the calendar's PD day opens its agenda, and a reminder's link opens the journal or the PD days
Gr.openAgenda=function(date){st.pdSel="";st.pdEdit=null;Gr._wantDate=date};
})();
