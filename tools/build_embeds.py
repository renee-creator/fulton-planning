"""Builds the Family Conferences and Calendar pages that sit inside TREE, tree-conferences.html and tree-calendar.html.
They are the same apps the school used before, copied into src/embed, now signed in with TREE's sign-in, saving to the
TREE server, and dressed in TREE's typefaces and colours. Run by tools/build.py."""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
E = root / "src/embed"

def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:80], s.count(a))
    return s.replace(a, b)

def head(title, extra=""):
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="robots" content="noindex,nofollow">\n'
            f'<title>{title}</title>\n' + extra +
            '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n')

# the server address, the same rule TREE's own page uses
SERVER_JS = ('const DEFAULT_SERVER="https://fulton-planning.onrender.com";\n'
             '  const want=(qs.get("server")||"").replace(/\\/+$/,"");\n'
             '  const local=/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) && /^http:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(want);\n'
             '  const SERVER= local? want : DEFAULT_SERVER;')
# what TREE tells a page inside it. A route is remembered, so going back to the section returns to the same place.
TELL = '<script>window.TREE_TELL=m=>{try{if(window.parent!==window)window.parent.postMessage(Object.assign({},m),location.origin)}catch(e){}};</script>\n'

# ---------- Family Conferences ----------
app = (E / "conferences-app.html").read_text()
shim = (E / "conferences-shim.html").read_text()
shim = rep(shim, '''  const DEFAULT_SERVER="https://fulton-conferences.onrender.com";
  const want=(qs.get("server")||"").replace(/\\/+$/,"");
  const local=/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) && /^http:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(want);
  const SERVER= local? want : DEFAULT_SERVER;''', "  " + SERVER_JS)
shim = shim.replace('"fc-token"', '"fp-token"').replace('"fc-name"', '"fp-name"')
# signed out inside TREE, TREE's own sign-in takes over
shim = rep(shim, 'const write=async(op,extra)=>{ const r=await api("/api/write",{op,kind,id,...extra});', 'const write=async(op,extra)=>{ if(window.TREE_VA){ if(!window.__vaSaid){ window.__vaSaid=1; try{ toast("Nothing is saved while you see TREE as "+window.TREE_VA.name+"."); }catch(e){} } return (extra&&extra.data)||Store.data[kind]?.[id]||null; } const r=await api("/api/write",{op,kind,id,...extra});')
shim = rep(shim, "if(!Auth.token) await showGate();", "if(!Auth.token){ if(window.parent!==window){ window.parent.location.reload(); return new Promise(()=>{}); } await showGate(); }")
shim = shim.replace("Fulton conference server", "TREE server").replace("conference server", "TREE server")
app = rep(app, '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">',
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700&display=swap">')
# TREE's colours and typefaces, and no second header inside TREE
app = rep(app, '</style>\n\n<header class="top">', '''/* inside TREE */
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#edf0e8;--surface:#ffffff;--surface-2:#e6ebe2;--ink:#1b2920;--muted:#46564c;--line:#c6d0c3;--accent:#2b5a40;--accent-soft:#dce9de}}
:root{--f-display:"Bricolage Grotesque","Avenir Next","Segoe UI",system-ui,sans-serif;--f-mono:"Figtree",system-ui,-apple-system,"Segoe UI",sans-serif}
.mono,.date-tile,.qnum,.tl-when{font-variant-numeric:tabular-nums}
.tl-when b{font-weight:700}
h1,h2,h3{font-weight:700}
header.top .brand,.who-chip{display:none!important}
header.top{position:static!important;border-bottom:0!important;background:transparent!important}
@media (max-width:760px){main{padding:12px 10px 80px!important}}
</style>

<header class="top">''')
app = rep(app, 'view:{name:"overview"}', 'view:(()=>{const h=decodeURIComponent(location.hash.slice(1));const m=h.match(/^(child|conf)=(.+)$/);return m?{name:m[1],id:m[2]}:{name:["overview","children","portfolios","nextyear","settings"].includes(h)?h:"overview"}})()')
app = rep(app, 'function go(name, extra={}){ flushAll(); S.view={name,...extra}; window.scrollTo(0,0); render(); }',
          'function go(name, extra={}){ flushAll(); S.view={name,...extra}; window.scrollTo(0,0); render(); if(window.TREE_TELL) window.TREE_TELL({tree:"route",which:"conferences",route:extra.id?name+"="+extra.id:name}); }')
# the monthly checklist is not the child's portfolio, so it is named for what it is, and Settings shows only for the director
app = app.replace('<button data-go="portfolios">Portfolios</button>', '<button data-go="portfolios">Monthly pages</button>')
app = rep(app, '<div class="eyebrow">Advocate educators</div><h1>Portfolios</h1>', '<div class="eyebrow">Advocate educators</div><h1>Monthly portfolio pages</h1>')
# TREE does the reading, so the screens say TREE
import re as _re
app = _re.sub(r"(?<![A-Za-z.])Claude(?![A-Za-z])(?! was not allowed)(?!, which is not available)", "TREE", app.replace("Open this page inside Claude", "Open this page inside TREE"))
# the word for a child who has left, as TREE names it
app = app.replace(">Withdrawn<", ">Left Fulton<").replace('"Withdrawn"', '"Left Fulton"')
marker = '<script>\n"use strict";\n/* ---------- constants'
assert app.count(marker) == 1
# if the records have not arrived after a while, say so and offer to try again, never an endless loading line
WATCH = """<script>setTimeout(()=>{try{if(!(S.loaded.children&&S.loaded.confs)){const a=document.getElementById("app");if(a)a.innerHTML='<div class="empty" style="display:grid;gap:10px;justify-items:center">The conference records are taking longer than usual to load.<button class="btn primary" onclick="location.reload()">Try again</button></div>'}}catch(e){}},25000);</script>\n"""
# a conference record already written opens as saved, with Edit to change it, so nothing is changed by accident
LOCK = """<style>.tree-lockbar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;background:#fffbe8;border:1px solid #f0cf4f;border-radius:10px;padding:10px 14px;margin:0 0 12px;font-size:14.5px}
#conf-editor.tree-locked textarea[readonly],#conf-editor.tree-locked input[readonly]{background:transparent;border-color:transparent;box-shadow:none;resize:none;cursor:default}
#conf-editor.tree-locked select:disabled,#conf-editor.tree-locked input:disabled{opacity:1;color:inherit;background:transparent;border-color:transparent;-webkit-appearance:none;appearance:none}
#conf-editor.tree-locked button:disabled{opacity:.55}</style>
<script>(()=>{let seen="",unlocked="",busy=false;
const keep=b=>/print|pdf|word|download|back|close|open|copy/i.test(b.textContent||"")||b.dataset.go;
function lock(){const ed=document.getElementById("conf-editor");if(!ed){seen="";unlocked="";return}const id=ed.dataset.id;
  if(id!==seen){seen=id;unlocked="";const filled=[...ed.querySelectorAll("textarea,input[type=text],input[type=date],input[type=time]")].some(x=>String(x.value||"").trim());if(!filled)unlocked=id}
  const on=unlocked!==id;ed.classList.toggle("tree-locked",on);
  let bar=ed.querySelector(".tree-lockbar");
  if(!on){if(bar)bar.remove();ed.querySelectorAll("[data-tree-locked]").forEach(x=>{x.readOnly=false;x.disabled=false;delete x.dataset.treeLocked});return}
  ed.querySelectorAll("textarea,input,select,button").forEach(x=>{if(x.dataset.treeLocked||x.closest(".tree-lockbar"))return;
    if(x.tagName==="BUTTON"){if(keep(x)||x.disabled)return;x.disabled=true}else if(x.tagName==="SELECT"||/checkbox|radio|file|date|time/.test(x.type))x.disabled=true;else x.readOnly=true;x.dataset.treeLocked="1"});
  if(!bar){bar=document.createElement("div");bar.className="tree-lockbar";bar.innerHTML='<span>Saved</span><button type="button" class="btn small primary">Edit</button>';
    bar.querySelector("button").onclick=()=>{unlocked=id;lock();const f=ed.querySelector("textarea,input[type=text]");if(f)f.focus({preventScroll:true})};ed.prepend(bar)}}
const go=()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;try{lock()}catch(e){}})};
new MutationObserver(go).observe(document.body,{childList:true,subtree:true});go();})();</script>
"""
# the conference form draws on what TREE already holds for the period, the DRDP levels educators accepted and the
# documentation that tags the child, so an educator adds them with one tap instead of writing them again
BRING = r"""<style>.tree-bring{margin-top:6px;border:1px solid #c6d0c3;border-radius:10px;background:#f6f9f4;padding:8px 10px;font-size:13.5px}
.tree-bring b{font-weight:600}.tree-bring a{color:#2b5a40;text-decoration:underline}.tree-bring ul{margin:4px 0 6px 18px;padding:0}.tree-bring li{margin:2px 0}.tree-bring .muted{color:#46564c}
.tree-bringall{margin:0 0 12px;border:1px solid #f0cf4f;background:#fffbe8;border-radius:10px;padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;font-size:14px}</style>
<script>(()=>{const MAP={approaches:["ATL"],social:["SED"],language:["FLD","ELD"],cognition:["MATH","SCI","COG"],physical:["PD","HLTH"]};
const P=window.parent!==window?window.parent:null;if(!P)return;
const iso=d=>new Date(d).toISOString().slice(0,10);
const long=d=>new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
function windowOf(cf){let from="";try{const pr=priorConf(cf);if(pr&&pr.confDate)from=pr.confDate}catch(e){}
  if(!from){const y=parseInt(cf.schoolYear,10);from=Number.isFinite(y)?y+"-08-01":""}
  const to=cf.confDate||iso(Date.now());return {from,to}}
const line=x=>x.name+", evidence toward "+x.level+(x.emerging?", emerging to the next level":"")+", not a DRDP rating."+(x.evidence?" "+x.evidence:"")+(x.title?" ("+x.title+", "+long(iso(x.at))+")":"");
function addTo(k,lines){const ta=document.querySelector('#conf-editor textarea[data-k="'+k+'"]');if(!ta||ta.readOnly||ta.disabled)return 0;
  const have=ta.value;const add=lines.filter(l=>!have.includes(l));if(!add.length)return 0;ta.value=(have.trim()?have.replace(/\s+$/,"")+"\n":"")+add.join("\n");
  ta.dispatchEvent(new Event("input",{bubbles:true}));ta.dispatchEvent(new FocusEvent("focusout",{bubbles:true}));return add.length}
function draw(){const ed=document.getElementById("conf-editor");if(!ed)return;const id=ed.dataset.id;const cf=S.confs&&S.confs[id];if(!cf||!P.TREE_DRDP_FOR)return;
  // the period follows the conference date, so a new date draws the lists again
  const w=windowOf(cf);const key=id+"|"+w.from+"|"+w.to;
  // an empty section TREE knows about fills itself once, also after Edit is tapped on a saved form
  try{const f0=P.TREE_CONF_FACTS?P.TREE_CONF_FACTS(cf.childId,w.from,w.to)||{}:{};for(const k of Object.keys(f0)){if(!f0[k])continue;const ta=ed.querySelector('textarea[data-k="fields.'+k+'"]');const mark="tree-fill-"+id+"-"+k;let done=false;try{done=localStorage.getItem(mark)==="1"}catch(e){}
    if(ta&&!ta.value.trim()&&!ta.readOnly&&!ta.disabled&&!done){addTo("fields."+k,String(f0[k]).split("\n").filter(Boolean));try{localStorage.setItem(mark,"1")}catch(e){};const bx=ta.closest("[data-wrap]")?.querySelector(".tree-bring");if(bx&&/small group in TREE|From the observations/.test(bx.textContent))bx.remove()}}}catch(e){}
  if(ed.querySelector(".tree-bringall,.tree-bring-none")){if(ed.dataset.bringKey===key)return;ed.querySelectorAll(".tree-bringall,.tree-bring-none,.tree-bring").forEach(x=>x.remove())}
  ed.dataset.bringKey=key;const items=P.TREE_DRDP_FOR(cf.childId,w.from,w.to);const docs=P.TREE_DOCS_FOR?P.TREE_DOCS_FOR(cf.childId,w.from,w.to):[];
  const span="from "+long(w.from)+" to "+long(w.to);
  const per={};for(const [k,doms] of Object.entries(MAP))per[k]=items.filter(x=>doms.includes(x.dom));
  for(const [k,list] of Object.entries(per)){if(!list.length)continue;const wrap=ed.querySelector('[data-wrap="fields.'+k+'"]');if(!wrap||wrap.querySelector(".tree-bring"))continue;
    const box=document.createElement("div");box.className="tree-bring";box.innerHTML="<b>DRDP evidence, "+span+"</b><div class=\"muted\">Evidence from our documentation, not a DRDP rating.</div><ul>"+list.map(x=>"<li>"+x.code+" "+x.name.replace(/</g,"&lt;")+", evidence toward <b>"+x.level+"</b>"+(x.emerging?", emerging":"")+"</li>").join("")+"</ul>";
    const b=document.createElement("button");b.type="button";b.className="btn sm";b.textContent="Add to this section";b.onclick=()=>{const n=addTo("fields."+k,list.map(line));b.textContent=n?"Added":"Already here"};box.append(b);wrap.append(box)}
  if(docs.length){const wrap=ed.querySelector('[data-wrap="fields.documentation"]');if(wrap&&!wrap.querySelector(".tree-bring")){const box=document.createElement("div");box.className="tree-bring";
    const dl=docs.map(d=>d.title+", "+long(iso(d.at)));box.innerHTML="<b>Documentation "+span+"</b><ul>"+docs.map(d=>'<li><a href="#" data-treedoc="'+d.kind+"|"+d.id+'">'+String(d.title).replace(/</g,"&lt;")+"</a>, "+long(iso(d.at))+"</li>").join("")+"</ul><div class=\"muted\">Tap one to open it. Pieces added to this section print after the form, in the PDF and as a second Word file. A piece not listed here does not print.</div>";
    const b=document.createElement("button");b.type="button";b.className="btn sm";b.textContent="Add to this section";b.onclick=()=>{const n=addTo("fields.documentation",dl);b.textContent=n?"Added":"Already here"};box.append(b);wrap.append(box)}}
  // what TREE knows about the child's small group, friends and interests. An empty section fills itself once. A section already written shows it to add.
  const facts=P.TREE_CONF_FACTS?P.TREE_CONF_FACTS(cf.childId,w.from,w.to)||{}:{};const factKeys=Object.keys(facts).filter(k=>facts[k]);
  const LBL={smallGroup:"The small group in TREE",friends:"From the observations",interests:"From the observations"};
  for(const k of factKeys){const lines=String(facts[k]).split("\n").filter(Boolean);const ta=ed.querySelector('#conf-editor textarea[data-k="fields.'+k+'"]');const mark="tree-fill-"+id+"-"+k;let done=false;try{done=localStorage.getItem(mark)==="1"}catch(e){}
    if(ta&&!ta.value.trim()&&!ta.readOnly&&!ta.disabled&&!done){addTo("fields."+k,lines);try{localStorage.setItem(mark,"1")}catch(e){}continue}
    const wrap=ed.querySelector('[data-wrap="fields.'+k+'"]');if(!wrap||wrap.querySelector(".tree-bring")||(ta&&lines.every(l=>ta.value.includes(l))))continue;
    const box=document.createElement("div");box.className="tree-bring";box.innerHTML="<b>"+LBL[k]+"</b><ul>"+lines.map(l=>"<li>"+l.replace(/</g,"&lt;")+"</li>").join("")+"</ul>";
    const b=document.createElement("button");b.type="button";b.className="btn sm";b.textContent="Add to this section";b.onclick=()=>{const n=addTo("fields."+k,lines);b.textContent=n?"Added":"Already here"};box.append(b);wrap.append(box)}
  const sec=[...ed.querySelectorAll(".sheet-sec")].find(x=>/Educator observations/.test(x.querySelector("h2")?.textContent||""));
  const bar=document.createElement("div");
  if(!items.length&&!docs.length&&!factKeys.length){bar.className="tree-bring-none";bar.style.display="none";ed.append(bar);return}
  bar.className="tree-bringall";const what=[facts.smallGroup&&"the small group and its members",facts.friends&&"friends",facts.interests&&"threads and projects"].filter(Boolean);bar.innerHTML="<span>"+(what.length?"TREE brought in "+(what.length>1?what.slice(0,-1).join(", ")+" and "+what[what.length-1]:what[0])+". It also holds ":"TREE holds ")+items.length+" accepted DRDP level"+(items.length===1?"":"s")+" and "+docs.length+" piece"+(docs.length===1?"":"s")+" of documentation "+span+". Each shows under its section.</span>";
  const b=document.createElement("button");b.type="button";b.className="btn sm primary";b.textContent="Add them all";
  b.onclick=()=>{let n=0;for(const [k,list] of Object.entries(per))if(list.length)n+=addTo("fields."+k,list.map(line));if(docs.length)n+=addTo("fields.documentation",docs.map(d=>d.title+", "+long(iso(d.at))));for(const k of factKeys)n+=addTo("fields."+k,String(facts[k]).split("\n").filter(Boolean));b.textContent=n?"Added":"Already here"};
  bar.append(b);if(sec){const t=sec.querySelector(".sheet-title");t?t.after(bar):sec.prepend(bar)}else ed.prepend(bar)}
document.addEventListener("click",e=>{const a=e.target.closest("[data-treedoc]");if(!a)return;e.preventDefault();const [k,i]=a.dataset.treedoc.split("|");if(P.TREE_OPEN_DOC)P.TREE_OPEN_DOC(k,i)});
// a conference's documentation prints after its form, and only the pieces listed in its Documentation Shared section,
// so a line taken out of that section is left out of the printout. The PDF holds both. Word saves the documentation as a
// second file beside the form.
const attached=(cf,id)=>{const text=String((cf&&cf.fields&&cf.fields.documentation)||"");if(!text.trim()||!P.TREE_DOCS_FOR)return [];
  return P.TREE_DOCS_FOR(id,"","").filter(d=>text.includes(d.title+", "+long(iso(d.at)))).map(d=>d.kind+"|"+d.id)};
if(typeof downloadPdf==="function"&&P.TREE_CONF_DOCS_FILE){const pdf0=downloadPdf,docx0=downloadDocx;
  window.downloadPdf=async function(items,filename){if(!items||items.length!==1)return pdf0(items,filename);
    try{toast("Preparing the PDF…");const form=await buildFormsPdf(items);const it=items[0];const w=windowOf(it.cf);const cid=it.cf.childId||(it.child&&it.child.id);const ids=attached(it.cf,cid);const extra=ids.length?await P.TREE_CONF_DOCS_FILE(cid,"","",false,ids):null;
      if(!extra){await saveFile(filename,form);return}
      const L=window.PDFLib;const out=await L.PDFDocument.load(await form.arrayBuffer());const add=await L.PDFDocument.load(new Uint8Array(await extra.arrayBuffer()));
      (await out.copyPages(add,add.getPageIndices())).forEach(pg=>out.addPage(pg));await saveFile(filename,new Blob([await out.save()],{type:"application/pdf"}))}
    catch(e){console.error(e);return pdf0(items,filename)}};
  window.downloadDocx=async function(list,child){await docx0(list,child);if(!list||list.length!==1)return;
    try{const cf=list[0];const w=windowOf(cf);const cid=cf.childId||(child&&child.id);const ids=attached(cf,cid);const extra=ids.length?await P.TREE_CONF_DOCS_FILE(cid,"","",true,ids):null;
      if(extra)await saveFile(slug(childName(child))+"-conference-documentation-"+String(cf.term||"").toLowerCase()+"-"+(cf.schoolYear||"")+".docx",new Blob([new Uint8Array(await extra.arrayBuffer())],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}))}catch(e){console.error(e)}};}
let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;try{draw()}catch(e){}})}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["readonly","disabled"]});})();</script>
"""
# the monthly portfolio checklist now lives in TREE under Children, so the Conferences page leaves out its Portfolios page
NOPF = '<style>[data-go="portfolios"]{display:none!important}</style>\n'
# while the director sees TREE as an educator, these pages follow along and save nothing
VA = '<script>window.TREE_VA=(()=>{try{return window.parent!==window&&window.parent.TREE_VIEW_AS||null}catch(e){return null}})();if(window.TREE_VA){const st=document.createElement("style");st.textContent=\'[data-go="settings"]{display:none!important}\';document.head.appendChild(st)}</script>\n'
NODIR = '<script>try{if(localStorage.getItem("fp-director")!=="1"){const st=document.createElement("style");st.textContent=\'[data-go="settings"]{display:none!important}\';document.head.appendChild(st)}}catch(e){}</script>\n'
out = head("Family Conferences, TREE") + TELL + VA + NODIR + NOPF + app.replace(marker, shim + "\n" + marker) + WATCH + LOCK + BRING + "\n</body>\n</html>\n"
(root / "tree-conferences.html").write_text(out)
print("tree-conferences.html", len(out), "bytes")

# ---------- Calendar ----------
cal = (E / "calendar-app.html").read_text()
cal = rep(cal, '''const DEFAULT_SERVER = "https://fulton-calendar.onrender.com";''', '''const DEFAULT_SERVER = "https://fulton-planning.onrender.com";''')
cal = cal.replace('LS.get("fc-token")', 'LS.get("fp-token")').replace('LS.get("fc-name")', 'LS.get("fp-name")')
cal = cal.replace('LS.set("fc-token"', 'LS.set("fp-token"').replace('LS.set("fc-name"', 'LS.set("fp-name"')
cal = rep(cal, "else if(!Auth.token) await showGate();", "else if(!Auth.token){ if(window.parent!==window){ window.parent.location.reload(); return; } await showGate(); }")
cal = cal.replace("Fulton Calendar server", "TREE server")
cal = rep(cal, '<div class="wrap" id="app">\n  <header class="top">', '''<style>/* inside TREE */
#app>header.top .brand,#app>header.top .spacer,#who-name,#btn-signout{display:none!important}
#app>header.top{border-bottom:0;padding:0;margin:0 0 8px;justify-content:flex-end;min-height:0}
@media (max-width:760px){
  .wrap{padding-inline:10px}
  #app{position:relative}
  #app>header.top{position:absolute;top:12px;right:10px;margin:0;z-index:25}
  #app>header.top #btn-settings{padding:6px 10px;font-size:13px}
  .bar h2{padding-right:96px}
}
.glance{border:2px solid #e6c84f;border-radius:12px;background:#fffbe8;overflow:hidden;margin-bottom:16px}
.glance-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:12px 14px 8px}
.glance-h b{font-family:var(--display);font-size:22px;color:#7a5c00}
.glance-h span{font-size:14px;color:var(--muted)}
.glance-sum{padding:0 14px 10px;font-size:15px}
.rest-h{font-family:var(--display);font-size:17px;font-weight:700;margin:4px 2px 8px}
.glance .ag-row{background:transparent}
@media (prefers-color-scheme: dark){.glance{background:#201e12;border-color:#8a7426}.glance-h b{color:#f3d36b}}
.rest{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--paper)}
.cal:has(.glance){background:transparent;border:0;overflow:visible}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#edf0e8;--paper:#ffffff;--ink:#1b2920;--muted:#46564c;--line:#c6d0c3;--line-soft:#dde4da}}
</style>
<div class="wrap" id="app">
  <header class="top">''')
# inside TREE the calendar opens on today, with the next six days below it, so nothing needs scrolling to find today
cal = rep(cal, 'const S = { view: ["day","week","month"].includes(LS.get("fc-view")) ? LS.get("fc-view") : "week",', 'const S = { view: "next",')
cal = rep(cal, '<button type="button" data-view="day" aria-pressed="false">Day</button>', '<button type="button" data-view="next" aria-pressed="false">From today</button><button type="button" data-view="day" aria-pressed="false">Day</button>')
cal = rep(cal, 'function computeRange(){\n', 'function computeRange(){\n  if(S.view==="next") return {from:S.anchor, to:addDays(S.anchor,6)};\n')
cal = rep(cal, 'function titleText(){\n', 'function titleText(){\n  if(S.view==="next") return S.anchor===today()? "Today and the week ahead" : fmt(S.anchor,{month:"short",day:"numeric"})+" to "+fmt(addDays(S.anchor,6),{month:"short",day:"numeric"});\n')
cal = rep(cal, '  if(S.view==="month") body=renderMonth(idx);\n', '  if(S.view==="next") body=renderNext(idx);\n  else if(S.view==="month") body=renderMonth(idx);\n')
cal = rep(cal, "else { S.data=j; S.stamp=j.stamp; S.me=j.me; S.director=!!j.director; S.shared=!!j.shared; }", "else { S.data=j; S.stamp=j.stamp; S.me=j.me; S.director=!!j.director; S.shared=!!j.shared; if(window.TREE_VA){ S.me=window.TREE_VA.name; S.director=false; S.shared=false; } }")
cal = rep(cal, "async function api(path, body){\n  if(PREVIEW) return PREVIEW.call(path, body||{});", "async function api(path, body){\n  if(PREVIEW) return PREVIEW.call(path, body||{});\n  if(window.TREE_VA && path!=='/api/view'){ const e=new Error('Nothing is saved while you see TREE as '+window.TREE_VA.name+'.'); e.code='view_as'; throw e; }")
cal = rep(cal, 'function step(dir){\n', 'function step(dir){\n  if(S.view==="next"){ go(null,addDays(S.anchor,7*dir)); return; }\n')
cal = rep(cal, 'function renderMonth(idx){', '''// today first, then the six days after it, each with everything on it
function renderNext(idx){
  const t=today(), box=h("div",{});
  let list=box, from=0;
  if(S.anchor===t){
    // today at a glance, everything on it in one card, then the rest of the week below
    const v=idx.get(t)||{allDay:[],timed:[]}, rows=v.allDay.concat(v.timed);
    const g=h("div",{class:"glance"});
    g.append(h("div",{class:"glance-h"}, h("b",{text:"Today"}), h("span",{text:fmt(t,{weekday:"long",month:"long",day:"numeric"})})));
    const timed=v.timed.filter(x=>x.start!=null), now=new Date(), mins=now.getHours()*60+now.getMinutes();
    const next=timed.find(x=>x.end==null?x.start>=mins:x.end>mins);
    g.append(h("div",{class:"glance-sum",text: !rows.length? "Nothing scheduled today." : rows.length+(rows.length>1?" things":" thing")+" today"+(next?". Next is "+(next.kind==="event"?next.ev.title:next.space.name)+" at "+clock(next.start)+".":".")}));
    for(const x of rows) g.append(agRow(x));
    box.append(g);
    box.append(h("div",{class:"rest-h",text:"The rest of the week"}));
    list=h("div",{class:"rest"}); box.append(list); from=1;
  }
  for(let i=from;i<7;i++){
    const d=addDays(S.anchor,i);
    const v=idx.get(d)||{allDay:[],timed:[]};
    const day=h("div",{class:"ag-day"});
    day.append(h("button",{type:"button",class:"ag-h"+(d===t?" today":""),onclick:()=>go("day",d)}, h("span",{text:(d===t?"Today, ":"")+fmt(d,{weekday:"long",month:"short",day:"numeric"})}), h("small",{text:"Open day"})));
    const rows=v.allDay.concat(v.timed);
    if(!rows.length) day.append(h("div",{class:"ag-none",text:"Nothing scheduled"}));
    for(const x of rows) day.append(agRow(x));
    list.append(day);
  }
  return box;
}
function renderMonth(idx){''')
cal = cal.replace("<!--PREVIEW-->", "")
cut = cal.index("<style>")
out = head("Calendar, TREE") + TELL + VA + cal[:cut].replace("<title>Fulton Calendar</title>", "") + cal[cut:] + "\n</body>\n</html>\n"
(root / "tree-calendar.html").write_text(out)
print("tree-calendar.html", len(out), "bytes")
