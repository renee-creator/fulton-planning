"""Builds tree.html, TREE, from src/app.html and src/shim.html (sign-in and server connection), and the Conferences and
Calendar pages that sit inside it. With --switch it also writes index.html, so the old Planning Studio link opens TREE.
Run from the repository folder with  python3 tools/build.py"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
app = (root / "src/app.html").read_text()
shim = (root / "src/shim.html").read_text()
marker = '<script>\n/* ---------- Program data'
assert app.count(marker) == 1, "app script marker not found"
# move the page title, fonts and the PDF library into the head
cut = app.index("<style>")
headbits, body = app[:cut], app[cut:]
head = ('<!doctype html>\n<html lang="en" data-theme="light">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="robots" content="noindex,nofollow">\n'
        '<link rel="icon" href="tree-icons/favicon-32.png" type="image/png">\n<link rel="apple-touch-icon" href="tree-icons/apple-touch-icon.png">\n'
        '<link rel="manifest" href="tree.webmanifest">\n<meta name="theme-color" content="#fbf7ec">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="TREE">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n' + headbits +
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n')
out = head + body.replace(marker, shim + "\n" + marker) + "\n</body>\n</html>\n"
import sys
(root / "tree.html").write_text(out)
print("tree.html", len(out), "bytes")
# TREE is the main address. The old Planning Studio is kept as planning-studio.html.
(root / "index.html").write_text(out)
print("index.html is TREE")
import subprocess
subprocess.run([sys.executable, str(root / "tools/build_embeds.py")], check=True)
# the public menu page for families and the website, with the farm towns and distances TREE keeps
pub = (root / "src/public.html").read_text()
def grab(name):
    m = re.search(r"^const " + name + r"=.*$", app, re.M)
    assert m, name
    return m.group(0)
pub = pub.replace("/*TOWNS*/", "\n".join(grab(n) for n in ["FARM_TOWNS", "G_TOWN_LL", "G_SCHOOL_LL"]))
(root / "public.html").write_text(pub)
print("public.html", len(pub), "bytes")
