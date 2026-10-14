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
:root:not([data-theme="dark"]){--bg:#f3f5ef;--surface:#fffffb;--surface-2:#e9eee7;--ink:#22332a;--muted:#5d6e63;--line:#d5ddd2;--accent:#2f5a43;--accent-soft:#e3ece4}
:root{--f-display:"Bricolage Grotesque","Avenir Next","Segoe UI",system-ui,sans-serif}
h1,h2,h3{font-weight:700}
header.top .brand,.who-chip{display:none!important}
header.top{position:static!important;border-bottom:0!important;background:transparent!important}
</style>

<header class="top">''')
app = rep(app, 'view:{name:"overview"}', 'view:(()=>{const h=decodeURIComponent(location.hash.slice(1));const m=h.match(/^(child|conf)=(.+)$/);return m?{name:m[1],id:m[2]}:{name:["overview","children","portfolios","nextyear","settings"].includes(h)?h:"overview"}})()')
app = rep(app, 'function go(name, extra={}){ flushAll(); S.view={name,...extra}; window.scrollTo(0,0); render(); }',
          'function go(name, extra={}){ flushAll(); S.view={name,...extra}; window.scrollTo(0,0); render(); if(window.TREE_TELL) window.TREE_TELL({tree:"route",which:"conferences",route:extra.id?name+"="+extra.id:name}); }')
# the word for a child who has left, as TREE names it
app = app.replace(">Withdrawn<", ">Left Fulton<").replace('"Withdrawn"', '"Left Fulton"')
marker = '<script>\n"use strict";\n/* ---------- constants'
assert app.count(marker) == 1
out = head("Family Conferences, TREE") + TELL + app.replace(marker, shim + "\n" + marker) + "\n</body>\n</html>\n"
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
</style>
<div class="wrap" id="app">
  <header class="top">''')
cal = cal.replace("<!--PREVIEW-->", "")
cut = cal.index("<style>")
out = head("Calendar, TREE") + TELL + cal[:cut].replace("<title>Fulton Calendar</title>", "") + cal[cut:] + "\n</body>\n</html>\n"
(root / "tree-calendar.html").write_text(out)
print("tree-calendar.html", len(out), "bytes")
