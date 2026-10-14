"""Brings the Family Conferences and Fulton Calendar records into the TREE records.
Run with the three record repositories cloned side by side:
  python3 tools/sync_records.py CONFERENCE_RECORDS CALENDAR_RECORDS TREE_RECORDS
A record changed more recently in TREE is kept. Children keep anything TREE added, such as who left and when.
Nothing is deleted from the TREE records except the first roster copy TREE made, whose files are named c and ten letters."""
import json, pathlib, re, shutil, sys

conf, cal, tree = (pathlib.Path(p) for p in sys.argv[1:4])

def load(p):
    try:
        return json.loads(p.read_text())
    except Exception:
        return None

def newer(a, b):
    # updatedAt is a date string in the Conferences records and a number in TREE's
    def key(d):
        v = (d or {}).get("updatedAt") or ""
        return str(v) if isinstance(v, str) else ""
    return key(a) > key(b)

n = {"children": 0, "conferences": 0, "originals": 0, "calendar": 0, "removed": 0}
# the first roster copy, made before the full records came in
for f in (tree / "children").glob("c*.json"):
    if re.fullmatch(r"c[0-9a-f]{10}\.json", f.name):
        f.unlink(); n["removed"] += 1
for kind in ("children", "conferences"):
    (tree / kind).mkdir(exist_ok=True)
    for f in sorted((conf / kind).glob("*.json")):
        src, dst = load(f), load(tree / kind / f.name)
        if src is None:
            continue
        if dst is not None and not newer(src, dst):
            continue
        if kind == "children" and dst:
            for k in ("treeHistory", "leftAs", "leftOn"):
                if k in dst:
                    src[k] = dst[k]
        (tree / kind / f.name).write_text(json.dumps(src, indent=2, ensure_ascii=False) + "\n")
        n[kind] += 1
(tree / "settings").mkdir(exist_ok=True)
if (conf / "settings/main.json").exists() and not (tree / "settings/main.json").exists():
    shutil.copy(conf / "settings/main.json", tree / "settings/main.json")
(tree / "originals").mkdir(exist_ok=True)
for f in (conf / "originals").iterdir():
    if f.is_file() and not (tree / "originals" / f.name).exists():
        shutil.copy(f, tree / "originals" / f.name); n["originals"] += 1
# calendar settings come from the Fulton Calendar. Sign-ups are joined, so one made in TREE is never lost.
for sub in ("bookings", "settings"):
    (tree / "calendar" / sub).mkdir(parents=True, exist_ok=True)
    for f in (cal / sub).glob("*.json"):
        dst = tree / "calendar" / sub / f.name
        if sub == "bookings" and dst.exists():
            a, b = load(f) or {}, load(dst) or {}
            items = dict((b.get("items") or {})); items.update(a.get("items") or {})
            a["items"] = items; dst.write_text(json.dumps(a, indent=2, ensure_ascii=False) + "\n")
        else:
            shutil.copy(f, dst)
        n["calendar"] += 1
print(n)
