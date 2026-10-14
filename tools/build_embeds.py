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
shim = rep(shim, "if(!Auth.token) await showGate();", "if(!Auth.token){ if(window.parent!==window){ window.parent.location.reload(); return new Promise(()=>{}); } await showGate(); }")
shim = shim.replace("Fulton conference server", "TREE server").replace("conference server", "TREE server")
app = rep(app, '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">',
          '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">')
# TREE's colours and typefaces, and no second header inside TREE
app = rep(app, '</style>\n\n<header class="top">', '''/* inside TREE */
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#edf0e8;--surface:#ffffff;--surface-2:#e6ebe2;--ink:#1b2920;--muted:#46564c;--line:#c6d0c3;--accent:#245b78;--accent-soft:#d9e9f2}}
:root{--f-display:"Bricolage Grotesque","Avenir Next","Segoe UI",system-ui,sans-serif}
h1,h2,h3{font-weight:700}
header.top .brand,.who-chip{display:none!important}
header.top{position:static!important;border-bottom:0!important;background:transparent!important}
@media (max-width:760px){main{padding:12px 10px 80px!important}}
</style>

<header class="top">''')
app = rep(app, 'view:{name:"overview"}', 'view:(()=>{const h=decodeURIComponent(location.hash.slice(1));const m=h.match(/^(child|conf)=(.+)$/);return m?{name:m[1],id:m[2]}:{name:["overview","children","portfolios","nextyear","settings"].includes(h)?h:"overview"}})()')
app = rep(app, 'function go(name, extra={}){ flushAll(); S.view={name,...extra}; window.scrollTo(0,0); render(); }',
          'function go(name, extra={}){ flushAll(); S.view={name,...extra}; window.scrollTo(0,0); render(); if(window.TREE_TELL) window.TREE_TELL({tree:"route",which:"conferences",route:extra.id?name+"="+extra.id:name}); }')
# the word for a child who has left, as TREE names it
app = app.replace(">Withdrawn<", ">Left Fulton<").replace('"Withdrawn"', '"Left Fulton"')
marker = '<script>\n"use strict";\n/* ---------- constants'
assert app.count(marker) == 1
# if the records have not arrived after a while, say so and offer to try again, never an endless loading line
WATCH = """<script>setTimeout(()=>{try{if(!(S.loaded.children&&S.loaded.confs)){const a=document.getElementById("app");if(a)a.innerHTML='<div class="empty" style="display:grid;gap:10px;justify-items:center">The conference records are taking longer than usual to load.<button class="btn primary" onclick="location.reload()">Try again</button></div>'}}catch(e){}},25000);</script>\n"""
out = head("Family Conferences, TREE") + TELL + app.replace(marker, shim + "\n" + marker) + WATCH + "\n</body>\n</html>\n"
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
.glance{border:2px solid var(--marigold);border-radius:12px;background:var(--paper);overflow:hidden;margin-bottom:16px}
.glance-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:12px 14px 8px}
.glance-h b{font-family:var(--display);font-size:22px;color:var(--marigold)}
.glance-h span{font-size:14px;color:var(--muted)}
.glance-sum{padding:0 14px 10px;font-size:15px}
.rest-h{font-family:var(--display);font-size:17px;font-weight:700;margin:4px 2px 8px}
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
out = head("Calendar, TREE") + TELL + cal[:cut].replace("<title>Fulton Calendar</title>", "") + cal[cut:] + "\n</body>\n</html>\n"
(root / "tree-calendar.html").write_text(out)
print("tree-calendar.html", len(out), "bytes")
