"""Builds index.html from src/app.html (Planning Studio) and src/shim.html (sign-in and server connection).
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
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="robots" content="noindex,nofollow">\n'
        '<link rel="icon" href="favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#2f5a43">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="Planning">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n' + headbits +
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n')
out = head + body.replace(marker, shim + "\n" + marker) + "\n</body>\n</html>\n"
(root / "index.html").write_text(out)
print("index.html", len(out), "bytes")
