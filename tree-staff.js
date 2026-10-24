/* The Markdown the policies are kept in, read the same way on the Educators pages, the Family page and the public
   Family Handbook page, and for their prints. It is plain text. A line starting with ### is a heading, a dash a list
   item, a number and a full stop a numbered item, two spaces in front for each level inside a list, > an indented
   paragraph, | a table row, and ![words](picture) a picture. **bold**, *italic*, <u>underline</u> and [words](link) work
   inside a line, a line ending in two spaces breaks there, and a backslash keeps the next character as written. */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LINK = /^\[((?:\\.|[^\]\\])*)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/;
  // a line of words as runs of text, each bold, italic, underlined or a link as it says
  function runs(s, base) {
    s = String(s || ''); base = base || {}; const out = []; let cur = '', b = !!base.b, i = !!base.i, u = !!base.u;
    const push = () => { if (cur) out.push({ text: cur, b, i, u, link: base.link || '' }); cur = ''; };
    for (let k = 0; k < s.length; k++) {
      const c = s[k], rest = s.slice(k);
      if (c === '\\' && k + 1 < s.length && /[\\*\[\]#>|\-.+_()!`<]/.test(s[k + 1])) { cur += s[k + 1]; k++; continue; }
      if (c === '\n') { push(); out.push({ br: true }); continue; }
      if (rest.startsWith('**') && (b || s.indexOf('**', k + 2) > k + 2)) { push(); b = !b; k++; continue; }
      if (c === '*' && !rest.startsWith('**') && (i || /^\*\S/.test(rest) && /[^\s*]\*(?!\*)/.test(s.slice(k + 1)))) { push(); i = !i; continue; }
      if (rest.startsWith('<u>') && s.indexOf('</u>', k) > 0) { push(); u = true; k += 2; continue; }
      if (rest.startsWith('</u>') && u) { push(); u = false; k += 3; continue; }
      if (c === '[' && !base.link) { const m = rest.match(LINK); if (m) { push(); out.push(...runs(m[1], { b, i, u, link: m[2] })); k += m[0].length - 1; continue; } }
      cur += c;
    }
    push(); return out;
  }
  const runsHtml = rs => rs.map(r => { if (r.br) return '<br>'; let h = esc(r.text); if (r.u) h = '<u>' + h + '</u>'; if (r.i) h = '<i>' + h + '</i>'; if (r.b) h = '<b>' + h + '</b>';
    return r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${h}</a>` : h; }).join('');
  const plain = rs => rs.map(r => r.br ? '\n' : r.text).join('');
  const LI = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;
  const IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
  // a paragraph's lines, with a break wherever a line ends in two spaces
  const joinLines = ls => ls.map((l, n) => n < ls.length - 1 ? (/ {2,}$/.test(l) ? l.replace(/\s+$/, '') + '\n' : l.replace(/\s+$/, '') + ' ') : l.trim()).join('').replace(/^\s+/, '');
  function blocks(text) {
    const L = String(text || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
    const starts = l => /^#{1,4}\s/.test(l) || /^\s*\|/.test(l) || IMG.test(l.trim()) || /^>/.test(l) || LI.test(l);
    while (i < L.length) {
      const l = L[i];
      if (!l.trim()) { i++; continue; }
      let m = l.match(/^(#{1,4})\s+(.*)$/); if (m) { out.push({ t: 'h', level: m[1].length, runs: runs(m[2].trim()) }); i++; continue; }
      m = l.trim().match(IMG); if (m) { out.push({ t: 'img', alt: m[1], src: m[2] }); i++; continue; }
      if (/^\s*\|/.test(l)) { const rows = []; while (i < L.length && /^\s*\|/.test(L[i])) { rows.push(L[i]); i++; }
        const cells = r => { const x = r.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, ''); return x.split(/(?<!\\)\|/).map(c => runs(c.trim())); };
        out.push({ t: 'table', rows: rows.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(cells) }); continue; }
      if (/^>/.test(l)) { const q = []; while (i < L.length && /^>/.test(L[i])) { q.push(L[i].replace(/^>\s?/, '')); i++; } for (const b of blocks(q.join('\n'))) { b.quote = true; out.push(b); } continue; }
      if (LI.test(l)) {
        const items = [];
        while (i < L.length) {
          const x = L[i]; const lm = x.match(LI);
          if (lm) { items.push({ level: Math.floor(lm[1].replace(/\t/g, '  ').length / 2), ordered: /\d/.test(lm[2]), lines: [lm[3]] }); i++; continue; }
          // a line indented under an item carries the item on
          if (x.trim() && /^\s/.test(x) && items.length && !/^\s*\|/.test(x)) { items[items.length - 1].lines.push(x.trim() + (/ {2,}$/.test(x) ? '  ' : '')); i++; continue; }
          break;
        }
        // numbered items count from one within each list and level
        const count = {}; let prev = -1;
        for (const it of items) { if (it.level < prev) for (const k of Object.keys(count)) if (+k > it.level) delete count[k]; if (it.level > prev) count[it.level] = 0; prev = it.level;
          it.n = it.ordered ? (count[it.level] = (count[it.level] || 0) + 1) : 0; it.runs = runs(joinLines(it.lines)); delete it.lines; }
        out.push({ t: 'list', items }); continue;
      }
      const p = []; while (i < L.length && L[i].trim() && !(p.length && starts(L[i]))) { p.push(L[i]); i++; }
      out.push({ t: 'p', runs: runs(joinLines(p)) });
    }
    return out;
  }
  // the blocks as a page. pic(src, alt) gives a picture's tag, so each page fetches pictures its own way.
  function html(text, pic) {
    let h = ''; const B = blocks(text); let q = false;
    for (const b of B) {
      if (!!b.quote !== q) { h += q ? '</blockquote>' : '<blockquote>'; q = !!b.quote; }
      if (b.t === 'h') h += `<h${Math.min(5, b.level + 1)}>${runsHtml(b.runs)}</h${Math.min(5, b.level + 1)}>`;
      else if (b.t === 'img') h += `<figure class="pmimg">${pic ? pic(b.src, b.alt) : `<span class="muted">${esc(b.alt || 'A picture')}</span>`}</figure>`;
      else if (b.t === 'table') h += `<div class="tw"><table>${b.rows.map((r, k) => `<tr>${r.map(c => k === 0 ? `<th>${runsHtml(c)}</th>` : `<td>${runsHtml(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
      else if (b.t === 'list') {
        let lv = -1; const open = [];
        for (const it of b.items) {
          while (lv > it.level) { h += `</li></${open.pop()}>`; lv--; }
          // a numbered list straight after a bulleted one at the same level starts its own list
          if (lv === it.level && open[lv] !== (it.ordered ? 'ol' : 'ul')) { h += `</li></${open.pop()}>`; lv--; }
          if (lv === it.level) h += '</li>';
          while (lv < it.level) { const tag = it.ordered ? 'ol' : 'ul'; h += `<${tag}>`; open.push(tag); lv++; if (lv < it.level) h += '<li class="pmnest">'; }
          h += `<li>${runsHtml(it.runs)}`;
        }
        while (open.length) h += `</li></${open.pop()}>`;
      } else h += `<p>${runsHtml(b.runs)}</p>`;
    }
    if (q) h += '</blockquote>';
    return `<div class="pmd">${h}</div>`;
  }
  root.PolicyMd = { blocks, html, runs, plain, esc };
})(typeof window !== 'undefined' ? window : module.exports);

/* ---------- Educators in TREE ----------
   Each educator's records page, the director's view of every educator, October 1, 2027, the drill log, paper personnel
   files, the New Educator section, the PD library with Licensing at Fulton and the TREE How To guides, and the Teacher
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
  const opened=Object.entries(B.open).filter(([,v])=>v).map(([k])=>({records:"records pages",pd:"the PD library",handbook:"the Teacher Policies and Procedures",newed:"the New Educator section",family:"the Family Handbook"}[k])).filter(Boolean);
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

/* educators who have left Fulton, for the director only. Their records page, Growth Plan, journal, check-ins, Proud
   Moments and evaluations are kept here, and their observations, plans and documentation keep their name as written. */
async function pageFormer(my){if(!D())return pageRecords(my);const r=await api("former");st.former=r.people||[];const ps=st.former;const p=ps.find(x=>x.name===st.formerWho);
  const about=x=>[x.role,x.room?x.room+" Class":"",x.leftOn?"Last day "+fd(x.leftOn):""].filter(Boolean).join(", ");
  if(!p){draw(my,head("Educators","Former educators","Educators who have left Fulton. Each one's records page, Growth Plan, journal, check-ins, Proud Moments and evaluations wait here, and only you open them.")+
    card("Former educators",ps.length?ps.map(x=>`<div class="prow"><div><b>${H(x.name)}</b><div class="cnt">${H(about(x))}</div></div><button class="btn small ghost" data-stformer="${H(x.name)}">Open</button></div>`).join(""):`<div class="empty">No one has left Fulton yet. When an educator leaves, choose Leaving Fulton beside their name in Settings, under Sign-ins, and their records wait here.</div>`));return}
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
    ${!mine&&dir?`<div class="actions" style="margin:0 0 10px">${isFormerName(p.name)?`<button class="chip-btn back" data-tview="stformer">‹ ${H(p.name)}, a former educator</button>`:`<button class="chip-btn back" data-tview="stteam">‹ All educators</button>`}</div>`:""}
    ${card("About",`<div class="cnt">${H([whoRole(p),roomName(p),pr.startDate?"Started "+fd(pr.startDate):"",pr.planHour?"Monday planning hour at "+hourText(pr.planHour):""].filter(Boolean).join(", "))}</div>
      ${goTo?`<div style="margin-top:6px">Go-to person, <b>${H(goTo)}</b></div>`:""}${paired.length?paired.map(n=>`<div style="margin-top:6px">You are <b>${H(n.name)}</b>'s go-to person. <button class="btn small ghost" data-stgoto="${H(n.name)}">Note this week's check-in</button> <span class="cnt">${(n.checkins||[]).length?`Check-ins noted ${H((n.checkins||[]).map(c=>fd(c.week)).join(", "))}`:"No check-in noted yet"}</span></div>`).join(""):""}
      ${dir&&!mine?`<div class="actions">${(st.people||[]).find(x=>x.name===p.name&&x.newHire)?`<button class="btn small" data-staccess="full">Turn on full access to the school, the children and their work</button>`:""}<button class="btn small ghost" data-stfile="all">Print the file</button></div>`:""}`,printBar("record"))}
    ${card("Records and certificates",itemsHtml)}
    ${card("Immunizations",`<div class="hint">California requires everyone who works at a child care center to be immunized against influenza, pertussis and measles, under Health and Safety Code 1596.7995. Records and exemptions are seen only by ${mine?"you":"the educator"} and the director.</div>${imm}`)}
    ${card("Early childhood units",units)}
    ${card("Continuing hours, this school year",hours)}
    ${p.policy?polRecordCard(p.policy,mine):""}
    ${careFor(p)?card("Licensing at Fulton",`<div class="actions" style="margin:0"><span class="stchip ${doneN===pcs.length&&pcs.length?"ok":"missing"}">${doneN} of ${pcs.length} pieces read</span><button class="btn small ghost" data-tview="stpd" data-stmod="licensing">Open the pieces</button></div>`):""}
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
    <h4 style="margin:10px 0 0">Title 22 requirements</h4>${L.filter(x=>x.list==="title22").map(row).join("")}<h4 style="margin:12px 0 0">Fulton procedures</h4>${L.filter(x=>x.list==="procedure").map(row).join("")}`,`${marked} of ${L.length} marked`)}

/* October 1, 2027 */
async function page27(my){if(!D())return pageRecords(my);await loadPeople();const ps=st.people.filter(p=>p.role!=="Kitchen"&&p.role!=="Office");
  const cpr=ITEMS().find(i=>i.k==="cpr");
  const rows=ps.map(p=>{const c=itemState(cpr,(p.items||{}).cpr),h=(p.items||{}).hs16||{},hy=hoursYear(p);return {p,c,h,hy}});
  const ready=rows.filter(r=>r.c.s!=="out"&&r.c.s!=="missing"&&r.h.date).length;
  draw(my,head("Educators","Coming October 1, 2027",`According to CDSS PIN 26-11-CCP, AB 150 and AB 190 require every staff member who provides care to have current pediatric first aid and CPR and 16 hours of health and safety training, 15 hours plus 1 hour of nutrition, by October 1, 2027. From that day each of them completes at least 12 hours of continuing education every year from Department-approved sources.`)+
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
    ${await newPolCard(p,dir)}
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
const hbTitle=id=>{const d=st.pol.teacher;const s=d&&d.parts.flatMap(p=>p.sections).find(x=>x.id===id);return s?s.title:id.replace(/-/g," ").replace(/^./,c=>c.toUpperCase())};

/* ---------- the Teacher Policies and Procedures and the Family Handbook ----------
   Both are read section by section from the records, in the Markdown policy-md.js reads. The director edits any section
   on its own, each change is kept with its day, who and a short note, and an earlier version can be read or restored. */
const PM=()=>window.PolicyMd;
const POLV={sthb:"teacher",stfh:"family"};
const polName=k=>k==="family"?"Family Handbook":"Teacher Policies and Procedures";
const polKey=k=>k==="family"?"family:"+(st.fhYear||""):"teacher";
async function loadPol(k,force){const key=polKey(k);if(!st.pol[key]||force){const d=await api("policies/doc",{doc:k,edition:k==="family"?st.fhYear||undefined:undefined});st.pol[key]=d;if(k==="family"&&!st.fhYear)st.pol["family:"+d.edition]=d}return st.pol[key]}
const polSecs=d=>(d.parts||[]).flatMap(p=>p.sections.map(s=>Object.assign({partId:p.id,partTitle:p.title,partSize:p.sections.length},s)));
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

async function pagePol(my,k){const dir=D();const want=LS.get(k==="family"?"tree.fh":"tree.hb","");if(want){st.polSec=want==="__contents"?"":want;st.polEdit=false;st.polHist=-1;LS.set(k==="family"?"tree.fh":"tree.hb",null)}
  const d=await loadPol(k);if(my!==RT)return;const secs=polSecs(d);const name=polName(k);const ed=k==="family"?d.edition:d.edition;
  if(st.polSec==="__new"&&dir)return draw(my,head(name,"A new section")+`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stpol="">‹ Contents</button></div>`+card("New section",polEditor(k,d,{id:"",title:"",body:""},true)));
  const s=secs.find(x=>x.id===st.polSec);
  if(s)return polSectionPage(my,k,d,secs,s);
  st.polSec="";
  const ack=d.ack;const mine=k==="teacher"&&!dir&&ack;
  const draft=k==="family"&&!d.live;
  const sub=k==="teacher"?`How Fulton works, for every educator. The ${H(ed)} edition, every section in TREE. Open a section to read it, and print the whole book or any one section.`
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
    :`<div class="hint">Each school year, every educator reads the Teacher Policies and Procedures and says so. ${a.newHire||a.start>today()?"A new educator does this before their first day.":"This is for the "+H(yearSpan(a.year))+" school year."}</div><div class="actions"><button class="btn small" data-stpolack="1">I have read the Teacher Policies and Procedures</button></div>`)}
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
  el.innerHTML=card("Families who have read it",`<div class="hint">Each family acknowledges the current edition, the ${H(F.edition)} edition, on the Family page at enrollment and re-enrollment.</div>${F.list.length?`<details><summary class="linkbtn">${n} of ${F.list.length} children's families</summary><div class="tablewrap"><table class="grid2" style="min-width:420px"><thead><tr><th>Child</th><th>Class</th><th>${H(F.edition)} edition</th></tr></thead><tbody>${F.list.map(x=>`<tr><td><b>${H(x.first)} ${H(x.last)}</b></td><td>${H(x.classroom)}</td><td>${x.at?chip("ok",fd(String(x.at).slice(0,10))):chip("missing",x.earlier?"Read "+x.earlier+", not yet "+F.edition:"Not yet")}</td></tr>`).join("")}</tbody></table></div></details>`:`<div class="empty">No children at Fulton yet.</div>`}`,`${n} of ${F.list.length}`)}

function polSectionPage(my,k,d,secs,s){const dir=D();const keep=T._keep;const i=secs.indexOf(s),pv=secs[i-1],nx=secs[i+1];const name=polName(k);
  const meta=[s.updatedAt?"Updated "+fms(s.updatedAt)+(s.updatedBy&&s.updatedBy!=="TREE"&&dir?" by "+s.updatedBy:""):"",s.partTitle!==s.title?"In "+s.partTitle:""].filter(Boolean).join(". ");
  const hist=dir?(s.history||[]):[];
  const edit=st.polEdit&&dir;
  draw(my,`${head(k==="family"?"Family Handbook, "+d.edition:name,s.title,H(meta)+(meta?".":""))}
    <div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-stpol="">‹ Contents</button>${polChips(k,d,s)}</div>
    ${edit?card("Edit",polEditor(k,d,s)):`<section class="card">${polHtml(s.body)}${s.kind==="piece"?`<div class="actions"><button class="btn small ghost" data-stpolpiece="${H(s.piece)}">In the PD library, Licensing at Fulton</button></div>`:""}
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
  if(s.kind==="handbook"||s.kind==="piece")out.push(`<div class="cnt">TREE keeps this section ${s.kind==="piece"?"as a Licensing at Fulton piece in the PD library":"with the Educators pages"}, and it is the same words in both places.</div>`);
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
  return card("Teacher Policies and Procedures",`<div class="actions" style="margin:0">${a.yearAt?chip("ok","Acknowledged for "+yearSpan(a.year)+", "+fms(a.yearAt)):chip("soon","Not acknowledged for "+yearSpan(a.year)+" yet")}${(a.changed||[]).length?chip("soon",a.changed.length+" changed section"+(a.changed.length===1?"":"s")+" to read"):""}<button class="btn small ghost" data-tview="sthb">Open them</button></div>
    <div class="hint" style="margin-top:6px">Each school year ${who} read${mine?"":"s"} the Teacher Policies and Procedures and say${mine?"":"s"} so, and again for any section the director marks as a significant change.</div>`)}
// the policies a new educator reads before their first day, in the New Educator section
async function newPolCard(p,dir){let d=null;try{d=await loadPol("teacher")}catch(e){return ""}const a=p.policy;const secs=polSecs(d).filter(s=>(d.mustRead||[]).includes(s.id));
  const mine=!dir&&p.name===meName();
  return card("Teacher Policies and Procedures, before the first day",`<div class="hint">${dir?"What "+H(p.name)+" reads before their first day. You choose these sections in the Teacher Policies and Procedures.":"Read these sections before your first day, then say so. The rest are there whenever you need them."}</div>
    ${secs.map(s=>`<div class="prow"><button class="linkbtn" style="text-align:left" data-hbopen="${H(s.id)}">${H(s.title)}</button></div>`).join("")}
    <div class="actions">${a&&a.yearAt?chip("ok","Acknowledged "+fms(a.yearAt)):mine?`<button class="btn small" data-stpolack="1">I have read the Teacher Policies and Procedures</button>`:chip("missing","Not acknowledged yet")}<button class="btn small ghost" data-tview="sthb">All of them</button></div>`)}
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
  const parts=sec?[{title:sec.title,sections:[sec]}]:d.parts;const pics=await polPictures(d,parts.flatMap(p=>p.sections));
  const file=sec?`${name} ${d.edition}, ${sec.title}`:`${name} ${d.edition}`;
  if(sec){const doc=planDoc({unit:"pt",format:"letter"});doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(...MOSS);doc.text(pdfText(`${name.toUpperCase()}, ${d.edition}`),PAGE.l,PAGE.t-24);
    polBody(doc,pics,d,parts,{});polFooters(doc,d);await saveFile(doc.output("blob"),safeFile(file)+".pdf");return}
  // a first pass finds the page each part starts on, then the book is made with its contents ahead of it
  const scratch=planDoc({unit:"pt",format:"letter"});const {starts}=polBody(scratch,pics,d,parts,{});
  const per=38,tocPages=Math.ceil(starts.length/per);const doc=planDoc({unit:"pt",format:"letter"});polCover(doc,pics,d,name);doc.addPage("letter","portrait");polToc(doc,starts,1+tocPages,per);
  const {P}=polBody(doc,pics,d,parts,{newFirst:true});if(k==="family")polAckPage(doc,d,P);polFooters(doc,d);await saveFile(doc.output("blob"),safeFile(file)+".pdf")}
async function polWord(k,d,which){let X;try{X=await loadScript("https://cdn.jsdelivr.net/npm/docx@9.8.1/dist/index.iife.js","docx")}catch(e){toast("The Word tool did not load. Check your connection and reload.");return}
  await loadPrintFonts();const {Document,Packer,Paragraph,TextRun,ExternalHyperlink,Table,TableRow,TableCell,WidthType,ImageRun,Footer,PageNumber,HeadingLevel,AlignmentType,TableOfContents,PageBreak,BorderStyle}=X;
  const name=polName(k);const sec=which==="sec"?polSecs(d).find(s=>s.id===st.polSec):null;const parts=sec?[{title:sec.title,sections:[sec]}]:d.parts;const pics=await polPictures(d,parts.flatMap(p=>p.sections));
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
  const docx=new Document(Object.assign({creator:"TREE, Fulton Community School & Farm",title:sec?`${name}, ${sec.title}`:name,features:{updateFields:true},
    numbering:{config:[{reference:"pnum",levels:[0,1,2,3].map(l=>({level:l,format:"decimal",text:`%${l+1}.`,alignment:AlignmentType.START,style:{paragraph:{indent:{left:440*(l+1),hanging:300}}}}))}]},
    styles:{default:{document:{run:{font:F}}}},sections:[{properties:{page:{margin:{top:1000,bottom:1000,left:1100,right:1100}}},footers:{default:foot},children:ch}]},wf.length?{fonts:wf}:{}));
  const blob=await Packer.toBlob(docx);await saveFile(blob,safeFile(sec?`${name} ${d.edition}, ${sec.title}`:`${name} ${d.edition}`)+".docx")}

/* ---------- Settings, the director's ---------- */
T.settings=async function(el){try{await boot(true);await loadPeople();if(window.TreeGrowth)await TreeGrowth.ready().catch(()=>{})}catch(e){el.innerHTML=`<div class="lbl">Educators</div><div class="hint warnline">${H(e.message||"This part could not open.")}</div>`;return}
  const o=B.open,ps=st.people;const names=ps.map(p=>p.name);
  const sw=(k,l,d)=>`<div class="prow"><div><b>${H(l)}</b><div class="cnt">${H(d)}</div></div><div class="seg" role="group" aria-label="${H(l)}"><button data-stsw="${k}|1" aria-pressed="${!!o[k]}">On</button><button data-stsw="${k}|0" aria-pressed="${!o[k]}">Off</button></div></div>`;
  const rm=B.school.remind||{};
  el.innerHTML=`<div class="lbl">Educators</div><div class="hint">Each part shows only to you until you turn it on for educators. A new educator reaches only the New Educator section until you turn on full access.</div>
    ${sw("records","Records pages","Each educator's own dates, certificates, immunizations, units and hours")}${sw("pd","PD library","The modules, Licensing at Fulton and the TREE How To guides")}${sw("handbook","Teacher Policies and Procedures","The new and revised sections, readable by every signed-in educator")}${sw("newed","New Educator section","For new educators, from before their first day through their first two months")}${sw("family","Family Handbook","The current edition, readable by every staff sign-in but the kitchen")}${sw("growth","Growth","The continuum and evaluation, the journal, check-ins, the Growth Plan, Proud Moments and PD days, for educators and apprentices")}
    <div class="prow"><div><b>Go-to person</b><div class="cnt">One go-to person for every new educator. The Class team still helps on the floor.</div></div><select id="sts-goto" aria-label="Go-to person"><option value="">None</option>${ps.filter(p=>p.role!=="Director"&&p.role!=="Kitchen"&&!(p.profile||{}).neverGoTo).map(p=>`<option ${B.school.goTo===p.name?"selected":""}>${H(p.name)}</option>`).join("")}</select></div>
    <div class="prow"><div><b>Records reminders</b><div class="cnt">Always on for every educator. Only you change them.</div></div><label class="cnt">Days ahead <input type="number" id="sts-days" min="7" max="120" value="${H(B.school.remindDays||30)}" style="width:70px"></label></div>
    <div class="chips" style="margin-top:6px">${Object.entries(B.defs.remind).map(([k,l])=>`<button class="chip ${rm[k]!==false?"on":""}" type="button" data-stremind="${k}">${H(l)}</button>`).join("")}</div>
    <div class="tablewrap" style="margin-top:12px"><table class="grid2" style="min-width:980px"><thead><tr><th>Educator</th><th>Role</th><th>Class</th><th>Monday planning hour</th><th>Check-ins</th><th>Journal</th><th>Start date</th></tr></thead><tbody>
    ${ps.map(p=>{const pr=p.profile||{};const staffRole=pr.role==="staff"||p.role==="Kitchen"||p.role==="Director";return `<tr><td><b>${H(p.name)}</b>${p.newHire?`<div class="cnt">New Educator section only</div>`:""}</td><td>${p.role==="Director"?"Director":`<select data-stprof="${H(p.name)}|role" aria-label="${H(p.name)}, role">${[["educator","Educator"],["apprentice","Apprentice"],["staff","Staff, records only"]].map(([v,l])=>`<option value="${v}" ${(pr.role||"educator")===v||(v==="educator"&&pr.role==="atelierista")?"selected":""}>${l}</option>`).join("")}</select>`}</td>
      <td><select data-stprof="${H(p.name)}|room" aria-label="${H(p.name)}, Class"><option value="">None</option>${CLASSROOMS.map(r=>`<option value="${H(r)}" ${p.room===r?"selected":""}>${H(r)} Class</option>`).join("")}</select></td>
      <td>${staffRole?"":`<select data-stprof="${H(p.name)}|planHour" aria-label="${H(p.name)}, monday planning hour"><option value="">Not set</option>${["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","14:00","15:00","16:00"].map(h=>`<option value="${h}" ${pr.planHour===h?"selected":""}>${hourText(h)}</option>`).join("")}</select>`}</td>
      <td>${staffRole?`<span class="cnt">Records only</span>`:`<select data-stprof="${H(p.name)}|checkin" aria-label="${H(p.name)}, check-ins">${[["","From the planning hour"],["slot","In the planning hour"],["second","Short second Monday"],["asneeded","As needed"]].map(([v,l])=>`<option value="${v}" ${(pr.checkin||"")===v?"selected":""}>${l}</option>`).join("")}</select>`}</td>
      <td>${staffRole?"":`<select data-stprof="${H(p.name)}|journalEvery" aria-label="${H(p.name)}, journal"><option value="1" ${+pr.journalEvery!==2?"selected":""}>Each week</option><option value="2" ${+pr.journalEvery===2?"selected":""}>Every other week, part time</option></select>`}</td>
      <td><input type="date" data-stprof="${H(p.name)}|startDate" value="${H(pr.startDate||"")}" aria-label="${H(p.name)}, start date"></td></tr>`}).join("")}</tbody></table></div>
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
async function printFile(name,mode){progress("Making the file");await loadPeople();let p=(st.people||[]).find(x=>x.name===name);
  // a former educator's file prints from their own record
  if(!p&&isFormerName(name))p=await api("person",{name}).catch(()=>null);if(!p){toast("That educator is not here.");return}
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
  if(k==="oct27"){await loadPeople();const cpr=ITEMS().find(i=>i.k==="cpr");return out(kind,[report("Coming October 1, 2027",[["Printed",fd(today())]],[{t:"text",text:"Current pediatric first aid and CPR and 16 hours of health and safety training by October 1, 2027, then at least 12 hours a year of continuing education from Department-approved sources."},{t:"table",label:"",noRule:true,head:["Educator","First aid and CPR","16 hours","Approved hours","Fulton PD hours"],rows:st.people.filter(p=>p.role!=="Kitchen"&&p.role!=="Office").map(p=>{const hy=hoursYear(p);const h=(p.items||{}).hs16||{};return [p.name,itemState(cpr,(p.items||{}).cpr).t,h.date?"Done "+fd(h.date):"Not yet",r1(hy.approved)+" of 12",String(r1(hy.fulton))]}),widths:[.2,.26,.2,.17,.17]}])],"October 1 2027")}
  if(k==="drills"){await loadPeople();return out(kind,[report("Drill log",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Date","Time","Type","Note","Logged by"],rows:(st.drills||[]).map(d=>[fd(d.date),d.time?hourText(d.time):"",d.type,d.note||"",d.by||""]),widths:[.18,.12,.18,.36,.16]}])],"Drill log")}
  if(k==="files"){await loadPeople();return out(kind,[report("Paper files",[["Printed",fd(today())]],[{t:"table",label:"",noRule:true,head:["Educator","Last printed","New pages"],rows:st.people.map(p=>[p.name,printedAt(p)?fms(p.printed.at):"Not yet",String(newPages(p).length)])}])],"Paper files")}
  if(k==="checklist"||k==="paperwork"){const p=P();const pcs=await loadPd();
    if(k==="checklist"){const ck=checklist(p,pcs,(p.profile||{}).startDate||"");return out(kind,[report("First weeks checklist, "+p.name,[["Start date",fd((p.profile||{}).startDate)]],[{t:"table",label:"",noRule:true,head:["","Step",""],rows:ck.map((c,i)=>[String(i+1),c.label,c.done?"Done":(c.note||"Not yet")]),widths:[.06,.66,.28]}])],"First weeks checklist "+p.name)}
    return out(kind,[report("New Educator paperwork",[["Educator",p.name]],[{t:"table",label:"",noRule:true,head:["Form","Number","Why it matters","Uploaded"],rows:PAPERS().map(x=>{const r=(p.paperwork||{})[x.k]||{};return [x.form,x.num,x.why,(r.files||[]).length||r.done||r.ack?"Yes":"Not yet"]}),widths:[.3,.14,.42,.14]},{t:"text",text:"Payroll and tax forms are completed in QuickBooks Workforce. Social Security cards and driver's licenses are shown in person and copied for the paper personnel file only."}])],"New Educator paperwork "+p.name)}
  if(k.startsWith("pieces:")){const d=k.slice(7);const pcs=await loadPd();const dn=((P().pd||{}).done)||{};return out(kind,[report(d==="licensing"?"Licensing at Fulton":"TREE How To",[["Educator",meName()]],[{t:"table",label:"",noRule:true,head:["Piece","Regulation","Minutes","Read"],rows:(pcs[d]||[]).map(x=>[x.title,x.source,String(x.minutes),dn[x.id]?fms(dn[x.id].at):""]),widths:[.4,.36,.1,.14]}])],d==="licensing"?"Licensing at Fulton":"TREE How To")}
  // the policies print as a book, or one section on its own
  if(k.startsWith("pol:")||k.startsWith("polsec:")){const pk=k.split(":")[1];const d=await loadPol(pk);const which=k.startsWith("polsec:")?"sec":"all";try{return word?await polWord(pk,d,which):await polPdf(pk,d,which)}catch(e){fail(e)}}}
// each educator's records page as it prints, for the director's weekly readable copies. Records only, never growth.
// An educator whose last day has passed is a former educator.
T.readable=async function(){await boot(true);await loadPeople();const t=today(),past=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")&&d<t;
  const now=(st.people||[]).map(p=>({name:p.name,room:p.room||"",former:past(p.leaveOn)||past((p.profile||{}).leftOn),doc:recordDocs(p)}));
  // educators who have left are no longer in the people list, so their records are read one by one from Former educators
  const gone=((await api("former").catch(()=>({}))).people||[]).filter(x=>!now.some(n=>n.name===x.name));
  for(const x of gone){const p=await api("person",{name:x.name}).catch(()=>null);if(p)now.push({name:x.name,room:x.room||"",former:true,doc:recordDocs(p)})}
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
document.addEventListener("click",e=>{const t=e.target.closest("[data-stperson],[data-stnew],[data-stgroup],[data-stgname],[data-stup],[data-stlink],[data-stopen][data-who],[data-sthadd],[data-sthdel],[data-streview],[data-stfocus],[data-stgoto],[data-staccess],[data-stfile],[data-stdrill],[data-stnewwho],[data-stdirpaper],[data-stck],[data-stread],[data-stwsave],[data-stmod],[data-stmodback],[data-stpiece],[data-stdone],[data-stpol],[data-stpoledit],[data-stpolsave],[data-stpolcancel],[data-stpolrm],[data-stpolhist],[data-stpolrestore],[data-stpolack],[data-stpolpiece],[data-stfhed],[data-stfhpub],[data-stfhnew],[data-stfhreview],[data-stfhpublic],[data-stprint],[data-stword],[data-stremind],[data-stforms],[data-streload],[data-stsw],[data-stformer],[data-stback]");
  if(!t)return;tapOnce(t,()=>stTap(e,t))},true);
async function stTap(e,t){const d=t.dataset;
  if(d.stprint||d.stword){e.preventDefault();progress("Making the file");await printKind(d.stprint||d.stword,!!d.stword);return}
  if(d.stmod!=null&&d.tview){LS.set("tree.stmod",d.stmod);return}
  if(VIEW_AS&&!d.stmod&&!d.stmodback&&!d.stpiece&&d.stpol==null&&!d.stpolhist&&!d.stfhed&&!d.stpolpiece){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.stperson){st.who=d.stperson;st.doc=null;goView("strec");return}
  if(d.stformer!=null){st.formerWho=d.stformer;redraw();jumpTop();return}
  if(d.stback){const n=d.stback,w=$("#stbackrow");if(!t.dataset.sure){if(w)w.innerHTML=`<span class="confirm">Bring ${H(n)} back with their history? <button class="btn small" data-stback="${H(n)}" data-sure="1">Bring back</button><button class="linkbtn" data-stformer="${H(n)}">Cancel</button></span>`;return}
    try{await window.FP_API("/api/accounts/return",{name:n});if(typeof signins!=="undefined")signins.list=null;st.formerWho="";toast(`${n} is back, with their history. They choose a new code at their next sign-in.`);await boot(true);redraw()}catch(er){fail(er)}return}
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
  if(d.stprof){const [name,k]=d.stprof.split("|");try{await api("profile",{name,profile:{[k]:t.value}});toast("Saved.")}catch(er){fail(er)}return}
  if(d.stpolmust||d.stpolonly||d.stfhhide){if(VIEW_AS)return;await polChange(t,d);return}
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
  // the talks and sessions led, from Presenting entries marked presented
  if((d.led||[]).length)h+=card(dir?"What they led":"What I led",d.led.map(x=>`<div class="cnt"><b>${H(x.title)}</b>${x.audience?", for "+H(x.audience):""}${x.date?", "+H(fd(x.date)):""}${x.minutes?", "+H(dur(+x.minutes)):""}</div>`).join(""));
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
// each check-in page links to How Check-Ins Work, in the Teacher Policies and Procedures
const ciLink=()=>staffSubOk("sthb")?` Read <button class="linkbtn" data-hbopen="how-check-ins-work">How Check-Ins Work</button> in the Teacher Policies and Procedures.`:"";
// five parts in about twenty minutes, in this order, then what the director writes on her own after the educator leaves
const Q=[["temp","Professional temperature, about 2 minutes","How has the last month felt? The educator gives their own number from 1 to 5, and you add yours beside it."],
  ["plusdelta","Plus delta, about 7 minutes","What went well this month, and what they would change, side by side. This is the place for strong moments, stretches and challenges."],
  ["goals","Growth Plan check, about 3 minutes","A line on where they are with their Growth Plan goals."],
  ["support","One support, about 2 minutes","One support they need from you or their teammates."],
  ["focus","Focus Until Next Time, about 5 minutes","The educator names what they want to focus on first. You add what you have seen, and the two of you settle on one focus together."]];
const AFTER=[["followup","Follow-up notes","Specific actions, agreements and timelines, with any leadership follow-up."],["align","Team alignment","How aligned the team is in routines, expectations and communication, from 1 to 5."],["effect","Check-in effectiveness","How well the check-in served them, from 1 to 5."]];
const rate=(attr,v)=>`<div class="tseg" role="group">${[1,2,3,4,5].map(n=>`<button data-${attr}="${n}" aria-pressed="${+v===n}">${n}</button>`).join("")}</div>`;
const tm=t=>t?X.hourText(t):"";
const dur=n=>n===90?"an hour and a half":n===60?"an hour":n%60===0?(n/60)+" hours":n>60?Math.floor(n/60)+" hours and "+(n%60)+" minutes":n+" minutes";
async function checkinPage(my){const dir=isDir();const b=B();
  if(!dir){const d=await doc(meName(),true);const s=[b.schedule.now,b.schedule.next].filter(Boolean).flatMap(x=>x.list).filter(x=>x.date>=today()&&x.name===meName());const nxt=s[0];const mode=d.profile.checkin;
    const ym=today().slice(0,7);const pre=(d.pre||{})[ym]||{};const cis=d.checkins||[];const last=cis.find(c=>c.focus&&c.focus.settled);
    draw(my,head("Check-ins","My check-ins","A regular, supportive space to talk about your practice, your Class and the children, and to agree together on what comes next. Nothing needs to be prepared beforehand."+ciLink())+
      card("My next check-in",nxt?`<div><b>${H(new Date(nxt.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}))}</b>${nxt.time?", "+H(tm(nxt.time)):""}, about twenty minutes${nxt.kind==="second"?", on the short second Monday":nxt.kind==="slot"?", during your Monday planning hour":""}.</div><div class="cnt">It is on the TREE calendar too.</div>`:`<div class="cnt">${mode==="asneeded"?"Your check-ins happen as needed. The director sets a time with you.":"The next check-in appears here once it is on the calendar."}</div>`)+
      card("Before we meet",`<div class="hint">You name what you want to focus on first, if you like. You are always welcome to bring a journal entry, a proud moment, a question or a piece of documentation.</div><label class="fld-label">What I want to focus on<textarea rows="3" id="gc-pre">${H(pre.focus||"")}</textarea></label><div class="actions"><button class="btn small" data-gcpre="1">Save</button>${pre.at?`<span class="cnt">Saved ${H(fms(pre.at))}</span>`:""}</div>`)+
      card("Focus Until Next Time",last?`<div class="gq">${md(last.focus.settled)}</div><div class="cnt">${last.focus.area?"Linked to "+H(areaName(last.focus.area))+". ":""}From the check-in on ${H(fd(last.date))}.</div>${last.focus.module&&modReady(last.focus.module)?`<div class="actions"><button class="btn small ghost" data-tview="stpd" data-stmod="m:${H(last.focus.module)}">${H(modTitle(last.focus.module))}</button></div>`:""}
        <div class="actions"><button class="pill" aria-pressed="${!!last.followed}" data-gcfollow="${H(last.id)}">I have tried it</button><span class="cnt">Your focus and your follow-through count toward Reflective Practice and Professional Growth.</span></div>`:`<div class="cnt">Settled together at your next check-in.</div>`)+
      card("Follow-up notes",cis.filter(c=>c.followup||c.focus&&c.focus.settled).map(c=>`<div class="garea"><b>${H(fd(c.date))}</b>${c.focus&&c.focus.settled?`<div class="cnt">Focus Until Next Time. ${H(c.focus.settled)}</div>`:""}${c.followup?`<div style="white-space:pre-line;margin-top:4px">${H(c.followup)}</div>`:""}</div>`).join("")||`<div class="cnt">Notes from your check-ins appear here, to read whenever you like.</div>`));return}
  // the director's month, and one check-in
  if(st.ciWho){return checkinForm(my,st.ciWho)}
  const S2=[b.schedule.now,b.schedule.next].filter(Boolean);const asNeeded=b.people.filter(p=>p.checkin==="asneeded");
  draw(my,head("Check-ins","Check-ins","Each educator has one check-in a month in their Monday planning slot, about twenty minutes. TREE lays out each month from the planning hours in Settings, moving a holiday or the Monday after a long break to the next open Monday, and rotating the order within each slot."+ciLink())+
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
  draw(my,head("Check-ins","Check-in with "+name,`About twenty minutes. Nothing needs to be prepared beforehand. You ask the questions in the conversation and capture the answers.`+ciLink())+
    `<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-gciback="1">‹ Check-ins</button><label class="cnt">Day <input type="date" id="gc-date" value="${H(c.date||today())}"></label></div>`+
    card("Their last month",prep.length?exHtml(prep):`<div class="cnt">Nothing kept in TREE in the last month yet.</div>`,"")+
    card(Q[0][1],`<div class="cnt gq">${H(Q[0][2])}</div><div class="gcols"><div><div class="cnt">Their number, from 1 to 5</div>${rate("gctemps",c.temp.self)}</div><div><div class="cnt">Your number beside it</div>${rate("gctempd",c.temp.dir)}</div></div><textarea rows="2" data-gcf="temp.words" style="width:100%;margin-top:6px" aria-label="Their words">${H(c.temp.words||"")}</textarea>`)+
    card(Q[1][1],`<div class="cnt gq">${H(Q[1][2])}</div><div class="gcols"><label class="fld-label">Plus, what went well<textarea rows="4" data-gcf="plus">${H(c.plus||"")}</textarea></label><label class="fld-label">Delta, what to change<textarea rows="4" data-gcf="delta">${H(c.delta||"")}</textarea></label></div>`)+
    card(Q[2][1],`<div class="cnt gq">${H(Q[2][2])}</div>${goals.length?`<ul class="cnt" style="margin:4px 0 6px;padding-left:20px">${goals.map(x=>`<li>${H(x.text)}${x.area?", "+H(areaName(x.area)):""}</li>`).join("")}</ul>`:`<div class="cnt">No Growth Plan goals entered yet.</div>`}<input type="text" data-gcf="goalsLine" value="${H(c.goalsLine||"")}" style="width:100%" aria-label="Where they are with their goals">${Object.values(c.goals||{}).some(v=>String(v||"").trim())?`<div class="cnt" style="margin-top:6px">Written earlier, goal by goal.</div>${goals.concat(Object.keys(c.goals).filter(k=>!goals.some(x=>x.id===k)).map(k=>({id:k,text:"A goal no longer in the plan"}))).filter(x=>String((c.goals||{})[x.id]||"").trim()).map(x=>`<div class="garea"><b>${H(x.text)}</b><div style="white-space:pre-line">${H(c.goals[x.id])}</div></div>`).join("")}`:""}`)+
    card(Q[3][1],`<div class="cnt gq">${H(Q[3][2])}</div>${fld("support",2)}`)+
    card(Q[4][1],`<div class="cnt gq">${H(Q[4][2])}</div><label class="fld-label">What they want to focus on<textarea rows="2" data-gcf="focus.mine">${H(c.focus.mine||"")}</textarea></label><label class="fld-label">What you have seen<textarea rows="2" data-gcf="focus.seen">${H(c.focus.seen||"")}</textarea></label><label class="fld-label">The focus you settled on together<textarea rows="2" data-gcf="focus.settled">${H(c.focus.settled||"")}</textarea></label>
      <div class="kfields"><label>Area<select id="gc-area"><option value="">Choose</option>${AK().map(k=>`<option value="${k}" ${sugArea===k?"selected":""}>${H(areaName(k))}</option>`).join("")}</select></label><label>PD module, where one fits<select id="gc-mod"><option value="">None</option>${B().modules.filter(m=>m.ready&&m.slug!=="howto").map(m=>`<option value="${m.slug}" ${sugMod===m.slug?"selected":""}>${H(m.title)}</option>`).join("")}</select></label></div>`)+
    (String(c.work||"").trim()||String(c.challenge||"").trim()||String(c.align&&c.align.note||"").trim()?card("Earlier answers",`<div class="hint">Kept from this check-in as it was written before the check-in had five parts.</div>${[["work","Curriculum, environment and child goals"],["challenge","One challenge"]].filter(([k])=>String(c[k]||"").trim()).map(([k,l])=>`<div class="garea"><b>${l}</b><div style="white-space:pre-line">${H(c[k])}</div></div>`).join("")}${String(c.align&&c.align.note||"").trim()?`<div class="garea"><b>How leadership can support alignment</b><div style="white-space:pre-line">${H(c.align.note)}</div></div>`:""}`):"")+
    card("After the check-in",`<div class="hint">On your own, after ${H(name)} leaves. Only you see the two ratings.</div>
      <div class="garea"><b>${AFTER[0][1]}</b><div class="cnt gq">${H(AFTER[0][2])}</div>${fld("followup",4)}</div>
      <div class="garea"><b>${AFTER[1][1]}</b><div class="cnt gq">${H(AFTER[1][2])}</div>${rate("gcalign",c.align.rating)}</div>
      <div class="garea"><b>${AFTER[2][1]}</b><div class="cnt gq">${H(AFTER[2][2])}</div>${rate("gceffect",c.effect)}</div>`)+
    `<div class="actions"><button class="btn" data-gcsave="1">Save the check-in</button><span class="cnt">${H(name)} sees only the Focus Until Next Time and follow-up notes.</span></div>`+
    ((d.trend||[]).length?card("Support trend",`<div class="gtrend">${trendSvg(d.trend)}</div><div class="cnt">Their temperature in green, yours in gold and team alignment in grey. A dip shows early, and these never touch evaluation scores.</div>`):"")+
    (past.length?card("Earlier check-ins",past.map(x=>`<div class="prow"><span><b>${H(fd(x.date))}</b> <span class="cnt">${H(clip(x.focus&&x.focus.settled,90))}</span></span><button class="btn small ghost" data-gciopen="${H(x.id)}">Open</button></div>`).join("")):""))}

/* ---------- Proud Moments and Kudos ---------- */
async function momentsPage(my){st.moments=(await ga("moments")).list;const f=st.mform;const team=B().team.filter(t=>t.name!==meName());
  const mine=workOf(meName(),Date.now()-120*864e5);const links=[...(f.link&&f.link.kind==="presenting"?[f.link]:[]),...mine.obs.slice(0,8).map(exObs),...mine.pl.slice(0,5).map(p=>exPlan(p)),...mine.sl.slice(0,5).map(exSlide)];
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
  // the director's Presenting entries, which a block can open
  if(dir){try{st.presList=(await api("pres/list")).list}catch(e){st.presList=[]}}
  {const want=Gr._wantDate||LS.get("tree.pdwant","");if(want){LS.set("tree.pdwant",null);Gr._wantDate="";const it=st.pd.find(x=>x.date===want);if(it){st.pdSel=it.id;st.pdEdit=null}}}
  if(st.pdSel){const it=st.pd.find(x=>x.id===st.pdSel);if(it)return dir&&st.pdEdit?agendaBuilder(my,it):agendaView(my,it)}
  const up=st.pd.filter(x=>x.date>=today()),past=st.pd.filter(x=>x.date<today()).reverse();
  const row=x=>`<div class="prow"><span><b>${H(new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"}))}</b> ${H(x.title||(x.kind==="meeting"?"PD staff meeting":"PD day"))} <span class="cnt">${x.kind==="meeting"?"Monthly PD staff meeting":"PD day"}</span></span><span class="actions" style="margin:0">${dir?(x.agenda&&(x.agenda.blocks||[]).length?chip("ok",x.agenda.mode==="light"?"Light agenda":"Agenda ready"):chip("missing","No agenda yet")):""}<button class="btn small ghost" data-gpd="${H(x.id)}">${dir?"Open":"Read the agenda"}</button></span></div>`;
  draw(my,head("PD days","PD days and PD staff meetings",dir?"Each PD day and monthly PD staff meeting on the TREE calendar opens an agenda builder. Staff see an agenda two weeks before the day, hear a reminder a few days before, and every agenda ends with plus delta.":"PD days are the shared work, and each one builds on the individual work in the PD library. You can see each agenda two weeks before the day, with readings one tap away.")+
    card("Coming up",up.length?up.map(row).join(""):`<div class="cnt">${dir?"No PD day or PD staff meeting is on the calendar in the next months. Add one below.":"Agendas appear here two weeks before the day."}</div>`)+
    (past.length?card("Recent",past.slice(0,6).map(row).join("")):"")+
    (dir?card("Add a day",`<div class="hint">PD days and staff meetings already on the calendar appear by themselves. Add one here when it is not.</div><div class="kfields"><label>Day<input type="date" id="gpd-date"></label><label>Kind<select id="gpd-kind"><option value="pdday">PD day</option><option value="meeting">Monthly PD staff meeting, ${H(tm(B().settings.meeting.start))} to ${H(tm(B().settings.meeting.end))}</option></select></label><label>Title<input type="text" id="gpd-title" placeholder="Optional"></label></div><div class="actions"><button class="btn small" data-gpdadd="1">Add to the calendar</button></div>`):""))}
function agendaBlocksHtml(a){const R=st.readings||[];return (a.blocks||[]).map(b=>`<div class="gblock"><div class="sttop" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${b.time?H(tm(b.time))+", ":""}${H(b.title)}</b>${b.how?`<span class="cnt">${H(HOW[b.how]||"")}</span>`:""}</div>${b.why?`<div class="cnt">${H(b.why)}</div>`:""}${b.prepare?`<div class="cnt"><b>To prepare.</b> ${H(b.prepare)}</div>`:""}
  ${(b.readings||[]).length?`<div class="cnt">${b.readings.map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>x.url?`<a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>, ${H(x.source)}`:`${H(x.title)}, ${H(x.source)}`).join("<br>")}</div>`:""}${b.module&&modReady(b.module)?`<div><button class="linkbtn" data-tview="stpd" data-stmod="${b.module==="licensing"||b.module==="howto"?b.module:"m:"+b.module}">${H(modTitle(b.module))}</button></div>`:""}${b.presenting&&b.presTitle?`<div><button class="linkbtn" data-gpres="${H(b.presenting)}">Presenting, ${H(b.presTitle)}</button></div>`:""}</div>`).join("")}
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
    <label class="fld-label">Opens a Presenting entry<select data-gbk="${i}|presenting"><option value="">None</option>${(st.presList||[]).map(x=>`<option value="${H(x.id)}" ${b.presenting===x.id?"selected":""}>${H(x.title)}${x.date?", "+H(fd(x.date)):""}</option>`).join("")}</select></label>
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

/* ---------- a former educator's growth, read only, for the director in Former educators ---------- */
const fold=(k,title,side,inner)=>`<details class="card fold" data-fold="sf:${H(k)}" ${typeof foldOpen!=="undefined"&&foldOpen.has("sf:"+k)?"open":""}><summary class="foldhead"><span class="lbl" style="margin:0">${H(title)}</span>${side?`<span class="cnt">${H(side)}</span>`:""}</summary><div class="foldbody" style="display:grid;gap:8px">${inner}</div></details>`;
const said=(l,v)=>String(v||"").trim()?`<div class="gq"><div class="cnt">${H(l)}</div><div style="white-space:pre-line">${H(v)}</div></div>`:"";
const placed=pl=>AK().filter(k=>pl&&pl[k]).map(k=>`<div class="cnt">${H(areaName(k))}, ${pl[k]==="nys"?"Not yet seen":H(PN[+pl[k]]||"")}</div>`).join("");
Gr.formerHtml=async function(name){await Gr.ready();if(!B())return "";const r=await ga("former",{name});const d=r.growth||{};const k=name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
  const years=o=>Object.keys(o||{}).sort().reverse();
  const plans=years(d.plans).map(y=>{const p=d.plans[y]||{};return `<div class="garea"><b>${H(yrLabel(y))}</b>${said("What went well",(p.wentWell||{}).text)}${REFL.map(([x,l])=>said(l,(p.reflection||{})[x])).join("")}
    ${(p.goals||[]).filter(g=>String(g.text||"").trim()).map((g,i)=>said(`Goal ${i+1}${g.area?", "+areaName(g.area):""}`,g.text)).join("")}${said("Challenges I'm anticipating",p.challenges)}${said("What I need from the director",(p.need||{}).director)}${said("From my team",(p.need||{}).team)}${said("From training",(p.need||{}).training)}${said("A note",p.note)}</div>`}).join("");
  const cis=(d.checkins||[]).map(c=>`<div class="garea"><b>${H(fd(c.date))}</b>${(c.temp||{}).self||(c.temp||{}).dir?`<div class="cnt">Professional temperature, ${H((c.temp||{}).self||"not given")} and the director's ${H((c.temp||{}).dir||"not given")}</div>`:""}${said("Temperature in their words",(c.temp||{}).words)}${said("Plus",c.plus)}${said("Delta",c.delta)}${said("Growth Plan check",c.goalsLine)}${said("One support",c.support)}
    ${said("Focus Until Next Time",(c.focus||{}).settled)}${said("Follow-up notes",c.followup)}${said("Earlier answer, the work",c.work)}${said("Earlier answer, a challenge",c.challenge)}</div>`).join("");
  const evs=years(d.evals).map(y=>{const ev=d.evals[y]||{},s=ev.self||{},v=ev.dir||{};return `<div class="garea"><b>${H(yrLabel(y))}</b>${placed(s.placements)?`<div class="cnt" style="margin-top:6px"><b>Their own placements</b></div>${placed(s.placements)}`:""}${Object.entries(s.writes||{}).map(([a,t])=>said(areaName(a),t)).join("")}${said("Closing",s.closing)}
    ${placed(v.placements)?`<div class="cnt" style="margin-top:6px"><b>Your placements</b></div>${placed(v.placements)}`:""}${said("Strengths",v.strengths)}${said("Narrative",v.narrative)}${(ev.goals||[]).map((g,i)=>said(`Next year's goal ${i+1}${g.area?", "+areaName(g.area):""}`,g.text)).join("")}</div>`}).join("")+
    (d.starting&&(d.starting.notes||placed(d.starting.placements))?`<div class="garea"><b>Starting-point conversation</b>${placed(d.starting.placements)}${said("Notes",d.starting.notes)}</div>`:"");
  const ms=(r.moments||[]).map(m=>`<div class="gmom"><div class="cnt">${H(m.kind==="kudos"?`Kudos from ${m.by} to ${m.to}`:`A proud moment by ${m.by}`)}, ${H(fms(m.at))}</div><div style="white-space:pre-line">${H(m.text)}</div></div>`).join("");
  const J=st.fj&&st.fj.who===name?st.fj:null;
  const jr=J?(J.entries.length?J.entries.map(e=>`<div class="garea"><b>${H(fd(e.date))}</b>${PROMPTS.filter(([x])=>e[x]).map(([x,l])=>said(l,e[x])).join("")}</div>`).join(""):`<div class="cnt">No journal entries.</div>`)
    :`<div class="hint">The journal asks for your TREE passcode each time it opens.</div><div class="kfields"><label>Your TREE passcode<input type="password" inputmode="numeric" autocomplete="current-password" id="gfj-pass" maxlength="40"></label></div><div class="actions"><button class="btn small" data-gfjopen="${H(name)}">Open the journal</button></div>`;
  return fold(k+":plan","Growth Plan",years(d.plans).length?years(d.plans).map(yrLabel).join(", "):"",plans||`<div class="cnt">No Growth Plan was kept.</div>`)+
    fold(k+":ci","Check-ins",(d.checkins||[]).length?String(d.checkins.length):"",cis||`<div class="cnt">No check-ins were kept.</div>`)+
    fold(k+":eval","Evaluations",years(d.evals).map(yrLabel).join(", "),evs||`<div class="cnt">No evaluation was kept.</div>`)+
    fold(k+":jour","Journal",J?String(J.entries.length):"",jr)+
    fold(k+":mom","Proud Moments",(r.moments||[]).length?String(r.moments.length):"",ms||`<div class="cnt">No Proud Moments or Kudos.</div>`)};

/* ---------- taps ---------- */
const val=s=>{const e=$(s);return e?e.value:""};
Gr.leave=()=>{st.jr=null;st.fj=null;st.jDraft=null};
document.addEventListener("click",e=>{const t=e.target.closest("#tsubnav [data-tview],#ttab [data-tsec],#tnav [data-tsec]");if(!t)return;
  // leaving a page closes the journal, so it asks for the passcode again
  // the typing in an agenda being built is kept for that day, and opens again with Build the agenda
  try{collectAgenda()}catch(er){}if(st.pdEdit&&st.pdEdit.blocks&&st.pdSel)st.pdStash={id:st.pdSel,edit:st.pdEdit};
  st.jr=null;st.fj=null;st.jDraft=null;st.self=false;st.selfDraft=null;st.starting=false;st.startDraft=null;st.tab="";st.ci=null;st.ciWho="";st.pdSel="";st.pdEdit=null;st.editCont=false;st.planDraft=null;st.examplesPick=null},true);
document.addEventListener("click",e=>{const t=e.target.closest("[data-gsel],[data-gtab],[data-gself],[data-gselfback],[data-gselfpt],[data-gwrite],[data-gselfsave],[data-gdir],[data-gdirsave],[data-gmeet],[data-gnextsave],[data-gstart],[data-gstartback],[data-gstartpt],[data-gstartsave],[data-gcont],[data-gcontsave],[data-gpww],[data-gpok],[data-gpadd],[data-gpsave],[data-gjopen],[data-gjclose],[data-gjsave],[data-gjbring],[data-gcpre],[data-gcfollow],[data-gci],[data-gciback],[data-gciopen],[data-gctemps],[data-gctempd],[data-gcalign],[data-gceffect],[data-gcsave],[data-gbook],[data-gmkind],[data-gmaud],[data-gmshare],[data-gmphoto],[data-gmview],[data-gmrm],[data-gexrm],[data-gexsave],[data-gmodsave],[data-gmodfinish],[data-gpd],[data-gpdedit],[data-gpdadd],[data-gpdmode],[data-gsugload],[data-gsugadd],[data-gbkadd],[data-gbkrm],[data-gbkmv],[data-gbkrd],[data-gbksearch],[data-gbkfound],[data-gpdsave],[data-gpdname],[data-gpdhours],[data-gpddsave],[data-gprint],[data-gword],[data-gsset],[data-gfjopen],[data-gpres]");
  if(!t)return;X.tapOnce(t,()=>gTap(e,t))},true);
async function gTap(e,t){const d=t.dataset;
  if(d.gpres){if(window.TreePres){TreePres.open(d.gpres);goView("stpres")}return}
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
  if(d.gfjopen){const pass=val("#gfj-pass");if(!pass){toast("Type your TREE passcode.");return}const r=await ga("journal/open",{name:d.gfjopen,passcode:pass});st.fj={who:d.gfjopen,entries:r.entries||[]};if(typeof foldOpen!=="undefined")foldOpen.add("sf:"+d.gfjopen.toLowerCase().replace(/[^a-z0-9]+/g,"-")+":jour");redraw();return}
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

/* ---------- Presenting in TREE ----------
   Every talk, PD session or module presented at Fulton or for other schools, one entry each, under Educators, PD and
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
  const row=x=>`<div class="prow"><span><b>${H(x.title)}</b>${x.subtitle?`<div class="cnt">${H(x.subtitle)}</div>`:""}<div class="cnt">${H([x.audience,x.date?fd(x.date):"",dur(x.minutes)].filter(Boolean).join(", "))}${x.presenters.length?`. Presented by ${H(kList(x.presenters))}`:""}</div></span>
    <span class="actions" style="margin:0">${x.status==="presented"?chip("ok","Presented "+fd(x.presentedOn)):""}<button class="btn small ghost" data-prsel="${H(x.id)}">${x.edit?"Open":"Read"}</button></span></div>`;
  const now=r.list.filter(x=>x.status!=="presented"),done=r.list.filter(x=>x.status==="presented");
  X.draw(my,head("PD and Licensing","Presenting",dir?"Every talk, PD session or module presented at Fulton or for other schools, each its own entry. Add educators as presenters and they work on the entry with you. Other educators see an entry once it is presented.":"The talks and PD sessions you present, and the ones Fulton has presented. You see an entry when you are one of its presenters, and every entry once it is presented.")+
    card("Being planned",now.length?now.map(row).join(""):empty(dir?"Start an entry below for a talk, a PD session or a module.":"An entry shows here when the director adds you as a presenter."))+
    card("Presented",done.length?done.map(row).join(""):empty("Entries move here once they are presented."))+
    (dir?card("Start an entry",`<div class="kfields"><label style="grid-column:span 2">Title<input type="text" id="prn-title" placeholder="The talk or session's title"></label></div><div class="actions"><button class="btn small" data-prnew="1">Start the entry</button></div>`):""))}

async function entryPage(my){const e=E(),dir=D(),ed=edit();
  if(ed&&foldOpen.has("pres:evidence")&&st.evFor!==e.id){try{st.ev=await pa("evidence",{id:e.id});st.evFor=e.id}catch(er){st.ev=null}}
  const back=`<div class="actions" style="margin:0 0 10px"><button class="chip-btn back" data-prsel="">‹ Presenting</button>${e.status==="presented"?chip("ok","Presented "+fd(e.presentedOn)):chip("soonish","Being planned")}</div>`;
  const h=head("Presenting",e.title||"Presenting",H(e.subtitle||""))+back+aboutCard(e)+creditCard(e)+
    (ed?notesFold(e)+meetingsFold(e)+evidenceFold(e):"")+chosenFold(e)+readingsFold(e)+planFold(e)+followFold(e)+(ed?printsFold(e):"")+(dir?doneCard(e):"");
  X.draw(my,h)}

/* the entry's own details, which every reader sees */
function aboutCard(e){const ed=edit(),dir=D();
  const ag=(e.agendas||[]).map(a=>`${a.kind==="meeting"?"PD staff meeting":"PD day"}, ${fd(a.date)}${a.title?", "+a.title:""}`);
  const agLine=ag.length?`<div class="cnt" style="margin-top:6px">On the agenda of ${H(kList(ag))}. ${typeof staffSubOk==="function"&&staffSubOk("stpdd")?(e.agendas||[]).map(a=>`<button class="linkbtn" data-pragenda="${H(a.date)}">Open the agenda for ${H(fd(a.date))}</button>`).join(" "):""}</div>`:`<div class="cnt" style="margin-top:6px">No PD day or staff meeting agenda uses this entry yet.${dir?" A block on any agenda can open it.":""}</div>`;
  if(!ed)return card("About this entry",`${e.question?`<div class="prwhy"><b>Guiding question.</b> ${H(e.question)}</div>`:""}<div class="cnt" style="margin-top:6px">${H([e.audience?"For "+e.audience:"",e.date?fd(e.date):"",dur(e.minutes),e.format].filter(Boolean).join(". "))}</div>${(e.presenters||[]).length?`<div class="cnt">Presented by ${H(kList(e.presenters))}</div>`:""}${agLine}`);
  const f=(k,l,ph,span)=>`<label${span?' style="grid-column:span 2"':""}>${l}<input type="text" data-prf="${k}" value="${H(e[k]||"")}" placeholder="${H(ph||"")}"></label>`;
  const pres=dir?`<div class="chiprow-label" style="margin-top:10px">Presenters</div><div class="chips">${[...new Set([...(e.choices||[]),...(e.presenters||[])])].map(n=>`<button class="chip ${(e.presenters||[]).includes(n)?"on":""}" type="button" data-prpres="${H(n)}" aria-pressed="${(e.presenters||[]).includes(n)}">${H(n)}</button>`).join("")||`<span class="cnt">No educator to add yet.</span>`}</div><div class="cnt">Each presenter sees this entry and works on it from their own Presenting page.</div>`
    :`<div class="cnt" style="margin-top:8px">${(e.presenters||[]).length?"Presented by "+H(kList(e.presenters))+".":""} The director chooses the presenters.</div>`;
  return card("About this entry",`<div class="kfields">${f("title","Title","",1)}${f("subtitle","Subtitle","",1)}</div>
    <label class="fld-label">Guiding question<input type="text" data-prf="question" value="${H(e.question||"")}" placeholder="The question the session follows"></label>
    <div class="kfields">${f("audience","Audience","Who it is for")}<label>Date<input type="date" data-prf="date" value="${H(e.date||"")}"></label><label>Length, in minutes<input type="number" min="0" step="15" data-prf="minutes" value="${H(e.minutes||"")}"></label></div>
    <label class="fld-label">How it is offered<input type="text" data-prf="format" value="${H(e.format||"")}" placeholder="Such as a facilitated session with a self-paced follow-up"></label>
    <div class="cnt" id="pr-saved">${e.minutes?H(dur(e.minutes))+". ":""}Changes save as you go.</div>${pres}${agLine}`)}

/* the presenter's own credit, once the entry is presented */
function creditCard(e){if(!e.mine||e.status!=="presented")return "";const hrs=Math.round((+e.minutes||0)/6)/10;const growth=!!(X.boot().can&&X.boot().can.growth);
  const m=e.mine.moment;
  return card("You led this",`<div class="cnt">${hrs?`${H(hrs)} hours are on your records page as Fulton PD hours.`:"Add the length to log the hours."} It is listed on your growth page, under What I led.</div>
    ${m==="shared"?`<div class="cnt" style="margin-top:6px">Shared as a Proud Moment.</div>`:growth?`<div class="actions"><button class="btn small" data-prmoment="1">Share it as a Proud Moment</button>${m==="no"?`<span class="cnt">You chose not now.</span>`:`<button class="linkbtn" data-prmomentno="1">Not now</button>`}</div><div class="cnt">You choose who sees it, as with every Proud Moment.</div>`:""}`)}

/* the director's marks: presented, copied, removed */
function doneCard(e){const cr=Object.keys(e.credit||{}).length;
  if(e.status!=="presented")return card("When it is presented",`<div class="cnt">Marking it presented logs the time as Fulton PD hours on each presenter's records page, lists it on their growth page, and offers them to share it as a Proud Moment. Other educators can then read it.</div>
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
    <label class="fld-label">What Fulton brought<textarea rows="2" data-pri="meetings|${H(x.id)}|fulton">${H(x.fulton||"")}</textarea></label>
    <label class="fld-label">What others brought<textarea rows="2" data-pri="meetings|${H(x.id)}|others">${H(x.others||"")}</textarea></label>
    <label class="fld-label">Questions carried forward<textarea rows="2" data-pri="meetings|${H(x.id)}|questions">${H(x.questions||"")}</textarea></label>
    <div><button class="linkbtn" data-prrmi="meetings|${H(x.id)}">Take it out</button></div></div>`;
  return fold("meetings","Meetings",L.length?L.length+(L.length===1?" meeting":" meetings"):"",(e.meetingsNote?`<div class="hint">${H(e.meetingsNote)}</div>`:"")+(L.length?L.map(m).join(""):empty("One entry for each planning or group meeting, with the date, what Fulton brought, what others brought, and the questions carried forward."))+
    `<div class="actions"><button class="btn small ghost" data-pradd="meetings">Add a meeting</button><span class="cnt">Each meeting saves as you type and leave a box.</span></div>`)}

/* evidence, read by the server from Fulton's own records */
function evidenceFold(e){const v=st.evFor===e.id?st.ev:null;const dir=D();
  if(!v)return fold("evidence","Evidence","",empty("TREE reads Fulton's observations, plans, threads, projects, lenses and team inquiries for moments that fit this entry's topic and guiding question. Open this to read them."));
  const look=v.look||[];const items=v.items||[];const g=st.evGroup;
  const shown=items.filter(x=>x.state!=="aside"&&(!g||x.groups.includes(g))),aside=items.filter(x=>x.state==="aside");
  const groups=[...look.map(l=>[l.k,l.label]),...(v.youngest?[["youngest","With Fulton's youngest children"]]:[])];
  const it=x=>{const src=picOf(x);return `<div class="prmom ${src?"":"nophoto"}">${src?`<img src="${H(src)}" alt="" loading="lazy">`:""}<div style="min-width:0;display:grid;gap:4px">
    <div class="cnt"><b>${H(x.label)}</b>${x.by?", "+H(x.by):""}${where(x)?". "+H(where(x)):""}</div><div style="white-space:pre-line">${H(clipL(x.text,420))}</div>${x.wonder?`<div class="cnt">${H(clip(x.wonder,200))}</div>`:""}
    <div class="prwhy">${H(x.why)}${x.lens?" "+H(x.lens):""}</div>
    <div class="actions" style="margin:0">${x.state==="kept"?`${chip("ok","Kept, in Chosen moments")}<button class="linkbtn" data-prkeep="${H(x.key)}|">Undo</button>`:x.state==="aside"?`${chip("missing","Set aside")}<button class="linkbtn" data-prkeep="${H(x.key)}|">Bring it back</button>`:`<button class="btn small" data-prkeep="${H(x.key)}|1">Keep</button><button class="btn small ghost" data-prkeep="${H(x.key)}|0">Set aside</button>`}</div></div></div>`};
  const lookHtml=`<details style="margin-top:6px"><summary class="cnt" style="cursor:pointer">What TREE looks for</summary><div style="display:grid;gap:8px;margin-top:6px">
    ${look.map((l,i)=>dir?`<div class="prsec"><label class="fld-label">Name<input type="text" data-prlook="${i}|label" value="${H(l.label)}"></label><label class="fld-label">Words, separated by commas<textarea rows="2" data-prlook="${i}|words">${H((l.words||[]).join(", "))}</textarea></label><label class="fld-label">Only together with one of these words, if any<input type="text" data-prlook="${i}|with" value="${H((l.with||[]).join(", "))}"></label></div>`:`<div class="cnt"><b>${H(l.label)}.</b> ${H((l.words||[]).join(", "))}${(l.with||[]).length?". Together with "+H(l.with.join(", ")):""}</div>`).join("")||empty("No words yet. TREE reads the title, subtitle and guiding question.")}
    ${dir?`<div class="prsec"><label class="fld-label">Another group of words, separated by commas<textarea rows="2" data-prlook="${look.length}|words"></textarea></label><label class="fld-label">Its name<input type="text" data-prlook="${look.length}|label"></label></div>
      <label class="radio"><input type="checkbox" id="pr-young" ${v.youngest?"checked":""}><span>Moments with Fulton's youngest children, under three${v.youngClass?", and in "+H(v.youngClass)+" Class":""}</span></label>
      <label class="fld-label">A lens to read through<select id="pr-lens"><option value="">None</option>${(v.lenses||[]).map(n=>`<option ${n===v.lens?"selected":""}>${H(n)}</option>`).join("")}</select></label>
      <div class="actions"><button class="btn small ghost" data-prlooksave="1">Save what TREE looks for</button></div>`:`<div class="cnt">${v.youngest?"Also moments with Fulton's youngest children, under three. ":""}${v.lens?"Read through the lens "+H(v.lens)+".":""}</div>`}</div></details>`;
  return fold("evidence","Evidence",shown.length?shown.length+" moments":"",`<div class="hint">From Fulton's own records only. Each moment shows the educators' words, the date, the Class and a line on why it fits, quoting the record. Keep one and it joins Chosen moments.</div>${lookHtml}
    ${groups.length>1?`<div class="actions" style="margin:6px 0 0;flex-wrap:wrap"><button class="pill" aria-pressed="${!g}" data-prevg="">All</button>${groups.map(([k,l])=>`<button class="pill" aria-pressed="${g===k}" data-prevg="${H(k)}">${H(l)}</button>`).join("")}</div>`:""}
    <div style="margin-top:6px">${shown.length?shown.map(it).join(""):empty("Nothing in Fulton's records fits yet. Moments that fit show here as they are kept in TREE.")}</div>${v.more?`<div class="cnt">${v.more} more fit less closely.</div>`:""}
    ${aside.length?`<details style="margin-top:8px"><summary class="cnt" style="cursor:pointer">Set aside, ${aside.length}</summary>${aside.map(it).join("")}</details>`:""}`)}

/* chosen moments, in an order the director can drag, or move with a tap */
function chosenFold(e){const ed=edit();const L=e.chosen||[];
  const m=(x,i)=>{const src=picOf(x);return `<div class="prmom ${src?"":"nophoto"}" data-prchosen="${H(x.id)}">${src?`<img src="${H(src)}" alt="" loading="lazy">`:""}<div style="min-width:0;display:grid;gap:4px">
    <div class="cnt"><b>${i+1}.</b> ${H(where(x)||x.label||"")}${x.by?", "+H(x.by):""}</div><div style="white-space:pre-line">${H(clipL(x.text,600))}</div>${x.wonder?`<div class="cnt">${H(clip(x.wonder,240))}</div>`:""}
    ${ed?`<div class="actions" style="margin:0;flex-wrap:wrap"><span class="prdrag" data-prdrag="${H(x.id)}" aria-hidden="true">Drag</span><button class="linkbtn" data-prmv="chosen|${H(x.id)}|-1" ${i===0?"disabled":""}>Move up</button><button class="linkbtn" data-prmv="chosen|${H(x.id)}|1" ${i===L.length-1?"disabled":""}>Move down</button>
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
  const r=x=>`<div class="strow"><div class="sttop"><b>${x.url?`<a href="${H(x.url)}" target="_blank" rel="noopener">${H(x.title)}</a>`:H(x.title)}</b><span class="cnt">${H(KIND[x.kind]||"")}</span></div>${x.source&&x.kind!=="drive"?`<div class="cnt">${H(x.source)}</div>`:""}${x.note?`<div class="cnt" style="white-space:pre-line">${H(x.note)}</div>`:""}${ed?`<div><button class="linkbtn" data-prrmi="readings|${H(x.id)}">Take it out</button></div>`:""}</div>`;
  return fold("readings","Readings and files",L.length?L.length+(L.length===1?" piece":" pieces"):"",(L.length?L.map(r).join(""):empty("Readings from the shared library, a link with a short note, or a file from the director's Google Drive, such as a past facilitator guide or slide deck. Licensing references come only from CCLD or CDSS."))+
    (ed?`<details style="margin-top:8px"><summary class="cnt" style="cursor:pointer">From the library</summary><div class="kfields" style="margin-top:6px"><label style="grid-column:span 2">Reading<select id="prr-lib"><option value="">Choose</option>${lib.filter(x=>!L.some(y=>y.ref===x.id)).map(x=>`<option value="${H(x.id)}">${H(x.title)}${x.source?", "+H(x.source):""}</option>`).join("")}</select></label></div><label class="fld-label">A short note<input type="text" id="prr-libnote"></label><div class="actions"><button class="btn small ghost" data-pradd="library">Add it</button></div></details>
    <details style="margin-top:6px"><summary class="cnt" style="cursor:pointer">A link with a short note</summary><div class="kfields" style="margin-top:6px"><label>Link<input type="url" id="prr-url" placeholder="https://"></label><label>Title<input type="text" id="prr-title"></label></div><label class="fld-label">A short note<input type="text" id="prr-note"></label><label class="radio"><input type="checkbox" id="prr-lic"><span>A licensing reference, from CCLD or CDSS only</span></label><div class="actions"><button class="btn small ghost" data-pradd="link">Add it</button></div></details>
    <details style="margin-top:6px"><summary class="cnt" style="cursor:pointer">A file from Google Drive</summary><div class="hint" style="margin-top:6px">Open the file in Google Drive, choose Share, then Copy link, and paste it here.</div><div class="kfields"><label>Drive link<input type="url" id="prd-url" placeholder="https://drive.google.com/"></label><label>Title<input type="text" id="prd-title" placeholder="Such as the facilitator guide from last year"></label></div><label class="fld-label">A short note<input type="text" id="prd-note"></label><div class="actions"><button class="btn small ghost" data-pradd="drive">Add it</button></div></details>`:""))}

/* the plan, in sections */
function planFold(e){const ed=edit();const L=e.plan||[];const C=e.chosen||[],R=e.readings||[];const tot=L.reduce((a,s)=>a+(+s.minutes||0),0);
  const uses=s=>[...(s.moments||[]).map(id=>C.findIndex(x=>x.id===id)).filter(i=>i>=0).map(i=>"Moment "+(i+1)),...(s.readings||[]).map(id=>(R.find(x=>x.id===id)||{}).title).filter(Boolean)];
  const sec=(s,i)=>ed?`<div class="prsec"><div class="kfields"><label style="grid-column:span 2">Section<input type="text" data-prpl="${H(s.id)}|title" value="${H(s.title||"")}"></label><label>Minutes<input type="number" min="0" step="5" data-prpl="${H(s.id)}|minutes" value="${H(s.minutes||"")}"></label></div>
      <label class="fld-label">What participants do<textarea rows="3" data-prpl="${H(s.id)}|do">${H(s.do||"")}</textarea></label>
      ${C.length?`<div class="cnt">Moments it uses</div><div class="chips">${C.map((x,j)=>`<button class="chip ${(s.moments||[]).includes(x.id)?"on":""}" type="button" data-pruse="${H(s.id)}|moments|${H(x.id)}" aria-pressed="${(s.moments||[]).includes(x.id)}">Moment ${j+1}</button>`).join("")}</div>`:""}
      ${R.length?`<div class="cnt">Readings and files it uses</div><div class="chips">${R.map(x=>`<button class="chip ${(s.readings||[]).includes(x.id)?"on":""}" type="button" data-pruse="${H(s.id)}|readings|${H(x.id)}" aria-pressed="${(s.readings||[]).includes(x.id)}">${H(clip(x.title,40))}</button>`).join("")}</div>`:""}
      <div class="actions" style="margin:0"><button class="linkbtn" data-prmv="plan|${H(s.id)}|-1" ${i===0?"disabled":""}>Move up</button><button class="linkbtn" data-prmv="plan|${H(s.id)}|1" ${i===L.length-1?"disabled":""}>Move down</button><button class="linkbtn" data-prrmi="plan|${H(s.id)}">Take it out</button></div></div>`
    :`<div class="prsec"><b>${H(s.title||"Section "+(i+1))}</b>${s.minutes?`<div class="cnt">${H(dur(+s.minutes))}</div>`:""}${s.do?`<div style="white-space:pre-line">${H(s.do)}</div>`:""}${uses(s).length?`<div class="cnt">Uses ${H(kList(uses(s)))}</div>`:""}</div>`;
  const help=st.help&&st.help.id===e.id?`<div class="prsec"><b>A draft from writing help</b><div class="cnt">Drawn only from the notes, chosen moments and attached files. Nothing changes until you add it.</div>${st.help.sections.map(s=>`<div class="gq"><b>${H(s.title)}</b>${s.minutes?`, ${H(dur(s.minutes))}`:""}<div style="white-space:pre-line">${H(s.do)}</div></div>`).join("")}<div class="actions"><button class="btn small" data-prhelpuse="1">Add these sections</button><button class="linkbtn" data-prhelpno="1">Not these</button></div></div>`:"";
  return fold("plan","The plan",L.length?`${L.length} section${L.length===1?"":"s"}${tot?", "+dur(tot):""}`:"",(L.length?`${e.minutes?`<div class="cnt">${H(dur(tot))} planned of ${H(dur(e.minutes))}.</div>`:""}`+L.map(sec).join(""):empty("The session plan, built in sections, each with its time, what participants do, and the moments, readings and files it uses."))+
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
    ${row("guide","Facilitator guide","The session plan, section by section, with its moments, readings and files.")}${row("panels","Panels","Printed panels, one idea to a page, clean and uncrowded.")}${row("handout","Handout","For participants, with the guiding question, readings, reflection prompts and the brief check.")}${row("slides","Slide set","A large photo and the words, one moment to a slide.")}`)}

/* ---------- printouts and Word files ---------- */
const nmOf=e=>e.names||"none";
const words=(x,e)=>displayText(x.text||"",nmOf(e),x.wonder||"");
const photoOf=x=>{const s=picOf(x,true);return s&&x.photo&&x.photo.w?[{key:"pr:"+x.id,src:s,w:x.photo.w,h:x.photo.h}]:[]};
const metaOf=e=>[["Audience",e.audience],["Date",e.date?fd(e.date):""],["Length",dur(e.minutes)],["Presenters",kList(e.presenters||[])]];
function guideDoc(e){const C=e.chosen||[],R=e.readings||[];const rd=x=>x.title+(x.url?" ("+x.url+")":"")+(x.note?". "+x.note:"");
  return report(e.title+", facilitator guide",metaOf(e),[e.subtitle?{t:"text",text:e.subtitle}:null,e.question?{t:"text",label:"Guiding question",text:e.question}:null,e.format?{t:"text",label:"How it is offered",text:e.format}:null,
    ...(e.plan||[]).map((s,i)=>({t:"text",label:(s.title||"Section "+(i+1))+(s.minutes?", "+dur(+s.minutes):""),text:[s.do,...(s.moments||[]).map(id=>C.find(x=>x.id===id)).filter(Boolean).map(x=>"Moment "+(C.indexOf(x)+1)+". "+clip(words(x,e),400)+(where(x)?" ("+where(x)+")":"")),...(s.readings||[]).map(id=>R.find(x=>x.id===id)).filter(Boolean).map(rd)].filter(Boolean).join("\n\n")})),
    !(e.plan||[]).length?{t:"text",text:"The plan has no sections yet."}:null,
    C.length?{t:"list",label:"Chosen moments",numbered:true,items:C.map(x=>clip(words(x,e),500)+(where(x)?" ("+where(x)+")":""))}:null,
    R.length?{t:"list",label:"Readings and files",items:R.map(rd)}:null,followBlocks(e)].flat().filter(Boolean))}
function followBlocks(e){const f=Object.assign({on:false,reads:[],prompts:[],checks:[]},e.followup);if(!f.on)return [];const R=e.readings||[];
  return [{t:"sub",text:"Self-paced follow-up"},f.reads.length?{t:"list",label:"Short readings",items:f.reads.map(id=>R.find(x=>x.id===id)).filter(Boolean).map(x=>x.title+(x.url?" ("+x.url+")":""))}:null,
    f.prompts.length?{t:"list",label:"Reflection prompts",items:f.prompts.map(x=>x.text)}:null,f.checks.length?{t:"list",label:"A brief check",numbered:true,items:f.checks.map(x=>x.text)}:null]}
function handoutDoc(e){const R=e.readings||[];return report(e.title,[["Audience",e.audience],["Date",e.date?fd(e.date):""]],[e.subtitle?{t:"text",text:e.subtitle}:null,e.question?{t:"text",label:"Guiding question",text:e.question}:null,
  R.filter(x=>x.kind!=="drive").length?{t:"list",label:"Readings",items:R.filter(x=>x.kind!=="drive").map(x=>x.title+(x.url?" ("+x.url+")":"")+(x.note?". "+x.note:""))}:null,...followBlocks(e)].filter(Boolean))}
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
async function print(k,word){const e=E();const kind=word?"word":"pdf";progress("Making the file");
  const docs=k==="guide"?[guideDoc(e)]:k==="handout"?[handoutDoc(e)]:k==="panels"?panelDocs(e):slideDocs(e);
  if(docs.some(d=>(d.photos||[]).length))await loadPhotos(docs);
  return out(kind,docs,e.title+" "+{guide:"facilitator guide",handout:"handout",panels:"panels",slides:"slides"}[k])}

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
document.addEventListener("click",e=>{const t=e.target.closest("[data-prsel],[data-prnew],[data-prpres],[data-prnames],[data-prdone],[data-prundo],[data-prcopy],[data-prrm],[data-pradd],[data-prrmi],[data-prmv],[data-prkeep],[data-prevg],[data-prlooksave],[data-prfind],[data-prlens],[data-prchoose],[data-pruse],[data-prfur],[data-prhelp],[data-prhelpuse],[data-prhelpno],[data-prprint],[data-prword],[data-prmoment],[data-prmomentno],[data-pragenda]");
  if(!t)return;X.tapOnce(t,()=>prTap(e,t))},true);
async function prTap(e,t){const d=t.dataset;const en=E();
  if(VIEW_AS&&d.prsel==null){toast("Nothing is saved while you see TREE as "+VIEW_AS.name+".");return}
  if(d.prsel!=null){Pr.open(d.prsel);T.render("stpres");window.scrollTo(0,0);return}
  if(d.pragenda){if(window.TreeGrowth)TreeGrowth.openAgenda(d.pragenda);goView("stpdd");return}
  if(d.prprint||d.prword){return print(d.prprint||d.prword,!!d.prword)}
  if(d.prnew){const title=val("#prn-title").trim();if(!title){toast("Give the entry a title.");return}const r=await pa("new",{title});Pr.open(r.id);toast("Started.");T.render("stpres");return}
  if(d.prpres){const cur=new Set(en.presenters||[]);cur.has(d.prpres)?cur.delete(d.prpres):cur.add(d.prpres);set(await pa("save",{id:en.id,fields:{presenters:[...cur]}}));toast(cur.has(d.prpres)?`${d.prpres} can see and work on this entry now.`:`${d.prpres} is no longer a presenter.`);X.redraw();return}
  if(d.prnames){set(await pa("save",{id:en.id,fields:{names:d.prnames}}));X.redraw();return}
  if(d.prdone){const alone=!(en.presenters||[]).length;if(!confirm(alone?"Mark it presented with no presenters? No hours are logged.":`Mark it presented? ${kList(en.presenters)} ${en.presenters.length===1?"gets":"get"} the time as Fulton PD hours.`))return;
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
