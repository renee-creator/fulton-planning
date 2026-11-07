"""Reads the ASQ-3 and ASQ:SE-2 questionnaires the director keeps in the private records and writes where every answer,
total and summary mark goes on each page, so TREE can fill the original form. The forms themselves and what this writes
stay in the records, never in this public code.

Run with  python3 -I tools/asq_layout.py <folder of PDFs named asq3-36.pdf, asqse2-36.pdf ...> <out.json>
Needs pdfplumber, Pillow and pdftoppm (poppler)."""
import sys, re, json, glob, os, subprocess, tempfile
import pdfplumber
from PIL import Image

AREAS3 = [('C', 'COMMUNICATION', 'Communication'), ('GM', 'GROSS MOTOR', 'Gross Motor'), ('FM', 'FINE MOTOR', 'Fine Motor'),
          ('PS', 'PROBLEM SOLVING', 'Problem Solving'), ('PSo', 'PERSONAL-SOCIAL', 'Personal-Social')]
R = lambda v: round(v, 1)


def words(p, **k):
    return p.extract_words(keep_blank_chars=True, x_tolerance=1.5, **k)


def lines_of(p):
    out = {}
    for w in words(p):
        out.setdefault(round(w['top']), []).append(w)
    return [sorted(out[t], key=lambda w: w['x0']) for t in sorted(out)]


def find(p, pat, after=None):
    """the first word matching pat, as (x0, x1, top, bottom)"""
    for w in words(p):
        if re.search(pat, w['text']) and (after is None or w['top'] > after):
            return w
    return None


def window(text):
    m = re.search(r'(\d+) months? (\d+) days? through (\d+) months? (\d+) days?', text)
    return {'from': [int(m.group(1)), int(m.group(2))], 'to': [int(m.group(3)), int(m.group(4))]} if m else None


def circles(p, size=(11, 13)):
    cs = [c for c in p.curves if size[0] < c['x1'] - c['x0'] < size[1] and abs((c['x1'] - c['x0']) - (c['bottom'] - c['top'])) < 1]
    return [((c['x0'] + c['x1']) / 2, (c['top'] + c['bottom']) / 2) for c in cs]


def rows(points, tol=2.5):
    out = []
    for x, y in sorted(points, key=lambda q: (q[1], q[0])):
        if out and abs(out[-1][0][1] - y) < tol:
            out[-1].append((x, y))
        else:
            out.append([(x, y)])
    return [sorted(r) for r in out]


def text_between(p, top, bottom, x_max, x_min=30):
    ws = [w for w in words(p) if top - 3 <= w['top'] < bottom - 3 and x_min <= w['x0'] < x_max and not re.match(r'^\s*_{12,}\s*$', w['text'])]
    ls = {}
    for w in ws:
        ls.setdefault(round(w['top'] / 3), []).append(w)
    t = ' '.join(' '.join(w['text'].strip() for w in sorted(ls[k], key=lambda w: w['x0'])) for k in sorted(ls))
    # a word broken across two printed lines is joined again, as dif- ferent to different
    # and a hyphen that belongs, as bye-bye, or four- and five-word, stays
    t = re.sub(r'\bbye- bye', 'bye-bye', t)
    t = re.sub(r'(\w)- (?!(?:to|and|or)\b)(?=[a-z])', r'\1', t)
    t = re.sub(r'Count as\s*["“]?(yes|not yet)["”]?', '', t)
    t = re.sub(r'^\d+\.\s*', '', t.strip())
    return re.sub(r'\s+', ' ', t).strip()


def score_line(p, y, x_min=540):
    for l in p.lines:
        if l['x0'] >= x_min and abs(l['top'] - (y + 3)) < 7 and l['x1'] - l['x0'] > 12:
            return [R(l['x0'] + 2), R(l['top'] - 2)]
    return None


def label_at(p, pat, gap=4):
    """where to write after a label such as Child's first name:, as the label's end and baseline. When the label and its
    line are one piece of text, the writing starts where the line starts."""
    w = find(p, pat)
    if not w: return None
    if '_' in w['text']:
        u = [c for c in p.chars if c['text'] == '_' and w['x0'] <= c['x0'] <= w['x1'] and abs(c['top'] - w['top']) < 4]
        if u: return [R(min(c['x0'] for c in u) + gap), R(w['bottom'] - 1.5)]
    return [R(w['x1'] + gap), R(w['bottom'] - 1.5)]


def label_above(p, pat, below=0):
    """a field whose label sits under its line, as on the ASQ-3 cover: write just above the label"""
    w = find(p, pat, below)
    return [R(w['x0'] + 2), R(w['top'] - 4)] if w else None


def chart_zones(pdf_path, page_no, p):
    """the ASQ-3 summary chart's shading, read from the drawing. Each row's black shape ends at the cutoff and its gray
    shape, the monitoring zone, ends at 1 standard deviation below the mean. A score is read off the row's own circles."""
    cs = [c for c in p.curves if 10.8 < c['x1'] - c['x0'] < 11.6 and abs((c['x1'] - c['x0']) - (c['bottom'] - c['top'])) < 1]
    rws = [r for r in rows([((c['x0'] + c['x1']) / 2, c['top']) for c in cs], 3) if len(r) == 13]
    fills = [r for r in p.rects if r.get('fill') and r['x1'] - r['x0'] > 20]
    out = []
    for r in rws:
        xs = [x for x, _ in r]; top = r[0][1]
        def score(X):
            for i in range(12):
                if xs[i] <= X <= xs[i + 1]: return 5 * i + 5 * (X - xs[i]) / (xs[i + 1] - xs[i])
            return None
        band = [f for f in fills if f['top'] - 2 < top < f['bottom']]
        col = lambda f: f.get('non_stroking_color'); val = lambda c: c[0] if isinstance(c, (list, tuple)) else c
        blk = [f for f in band if val(col(f)) is not None and val(col(f)) < .2]
        gry = [f for f in band if val(col(f)) is not None and .2 <= val(col(f)) < .95]
        g = score(max(f['x1'] for f in blk)) if blk else None
        w = score(max(f['x1'] for f in gry)) if gry else None
        out.append({'dots': [[R(x), R(top + 5.6)] for x in xs], 'gray': R(g) if g is not None else None, 'white': R(w) if w is not None else None})
    return out


def blank_in_row(p, top, x_from, below=0):
    """the first run of underscores in a printed line, as where to write on it, or on the line under it"""
    for dy in ([0] + ([12, 13, 11] if below else [])):
        u = sorted([c for c in p.chars if c['text'] == '_' and abs(c['top'] - (top + dy)) < 3 and c['x0'] > x_from], key=lambda c: c['x0'])
        if u: return [R(u[0]['x0'] + 3), R(u[0]['bottom'] - 2)]
    return None


def asq3(path, fid):
    pdf = pdfplumber.open(path); pages = pdf.pages; N = len(pages)
    cover = pages[0]; ctext = cover.extract_text()
    F = {'id': fid, 'tool': 'asq3', 'months': int(fid.split('-')[1]), 'pages': N, 'size': [R(cover.width), R(cover.height)],
         'window': window(ctext), 'areas': [], 'items': [], 'totals': {}, 'overall': [], 'warn': []}
    # the cover
    rel = {}
    for name, pat in [('parent', r'^Parent$'), ('guardian', r'^Guardian$'), ('teacher', r'^Teacher$'), ('provider', r'^Child care'), ('grand', r'^Grandparent'), ('foster', r'^Foster'), ('other', r'^Other:$')]:
        w = find(cover, pat, 380)
        if w: rel[name] = [R(w['x0'] - 9), R(w['top'] + 3.5)]
    gender = {}
    for name, pat in [('male', r'^Male$'), ('female', r'^Female$')]:
        w = find(cover, pat, 270)
        if w: gender[name] = [R(w['x0'] - 9), R(w['top'] + 3.5)]
    F['cover'] = {'page': 1, 'date': label_at(cover, r'^Date ASQ completed'), 'first': label_above(cover, r'^Child.s first name'),
                  'middle': label_above(cover, r'^Middle\s*$', 240), 'last': label_above(cover, r'^Child.s last name'),
                  'dob': label_above(cover, r'^Child.s date of birth'), 'gender': gender,
                  'pfirst': label_above(cover, r'^First name'), 'plast': label_above(cover, r'^Last name'), 'rel': rel,
                  'program': label_at(cover, r'^Program name'), 'childId': label_at(cover, r'^Child ID')}
    # the address lines, for an educator filling it out, written on the row of each line
    C = F['cover']; C['street'] = label_above(cover, r'^Street address'); C['city'] = label_above(cover, r'^City'); C['country'] = label_above(cover, r'^Country')
    C['email'] = label_above(cover, r'^E-?\s?mail')
    for k, pat in (('state', r'^State/'), ('zip', r'^ZIP/')):
        w = find(cover, pat, 400)
        if w: C[k] = [R(w['x0'] + 2), R(w['top'] - 4)]
    w = find(cover, r'^Other\s*$', 465)
    if w: C['phone'] = [R(w['x0'] + 2), R(w['top'] - 4)]
    # the questions, area by area, page by page
    area = None
    for pi in range(1, N):
        p = pages[pi]; t = p.extract_text() or ''
        if 'Information Summary' in t: continue
        # a page can end one area's questions and begin the overall questions
        ov = find(p, r'^OVERALL'); stop = ov['top'] if ov else p.height
        heads = []; tots = []
        for l in lines_of(p):
            s = ' '.join(w['text'].strip() for w in l)
            for k, U, _ in AREAS3:
                if l[0]['x0'] < 45 and s.startswith(U) and 'TOTAL' not in s: heads.append((l[0]['top'], k))
            m = [w for w in l if w['x0'] > 380]
            ms = ' '.join(w['text'].strip() for w in m)
            k = next((k for k, U, _ in AREAS3 if ms.startswith(U + ' TOTAL')), None)
            if k: tots.append((m[0]['top'], k))
        cr = [r for r in rows(circles(p)) if len(r) == 3 and r[0][1] < stop]
        nums = [w for w in words(p) if re.match(r'^\d+\.$', w['text'].strip()) and w['x0'] < 45 and w['top'] < stop]
        used = set()
        for r in cr:
            y = r[0][1]
            hs = [k for tp, k in heads if tp < y]
            if hs: area = hs[-1]
            cand = [w for w in nums if id(w) not in used and abs(w['top'] + 4 - y) < 14]
            num = min(cand, key=lambda w: abs(w['top'] + 4 - y)) if cand else None
            if num: used.add(id(num))
            n = int(num['text'].strip()[:-1]) if num else None
            top = min(num['top'], y - 6) if num else y - 6
            nxt = [w['top'] for w in nums if w['top'] > (num['top'] if num else y) + 2] + [tp for tp, _ in heads if tp > y] + [stop, p.height - 60]
            F['items'].append({'id': f'{area}{n}', 'area': area, 'n': n, 'page': pi + 1, 'text': text_between(p, top, min(nxt), r[0][0] - 12),
                               'marks': {'y': [R(r[0][0]), R(r[0][1])], 's': [R(r[1][0]), R(r[1][1])], 'n': [R(r[2][0]), R(r[2][1])]},
                               'score': score_line(p, y)})
        for tp, k in tots:
            F['totals'][k] = {'page': pi + 1, 'at': score_line(p, tp - 1.5) or [556, R(tp + 6)]}
        # a box under an item, for the child's own words or an example
        for b in [c for c in p.curves if c['x1'] - c['x0'] > 150 and c['bottom'] - c['top'] > 25 and c['bottom'] < stop and c['x0'] < 60]:
            above = [i for i in F['items'] if i['page'] == pi + 1 and i['marks']['y'][1] < b['top']]
            if above: max(above, key=lambda i: i['marks']['y'][1])['box'] = [R(b['x0']), R(b['top']), R(b['x1']), R(b['bottom'])]
        # a note such as *If Gross Motor Item 6 is marked "yes" or "sometimes," mark Gross Motor Item 2 "yes."
        flat = re.sub(r'\s+', ' ', t)
        for m in re.finditer(r'\*\s*If ([A-Za-z -]+?) Item (\d) is marked \W*yes\W* or \W*sometimes\W*,?\W* mark ([A-Za-z -]+?) Item (\d) \W*yes', flat):
            key = lambda nm: next((k for k, _, L in AREAS3 if L.lower() == nm.strip().lower()), None)
            if key(m.group(1)) and key(m.group(3)): F.setdefault('rules', []).append({'if': key(m.group(1)) + m.group(2), 'then': key(m.group(3)) + m.group(4), 'text': m.group(0).lstrip('* ')})
    # the overall questions, with the box under each for comments
    n_seen = 0
    for pi in range(1, N):
        p = pages[pi]; t = p.extract_text() or ''
        if 'Information Summary' in t: continue
        ov = find(p, r'^OVERALL'); start = ov['top'] if ov else (0 if F['overall'] and F['overall'][-1]['page'] == pi else None)
        if start is None: continue
        cr = [r for r in rows(circles(p)) if len(r) == 2 and r[0][1] > start]
        boxes = sorted([c for c in p.curves if c['x1'] - c['x0'] > 300 and c['bottom'] - c['top'] > 25 and c['top'] > start], key=lambda c: c['top'])
        nums = [w for w in words(p) if re.match(r'^\d+\.$', w['text'].strip()) and w['x0'] < 45 and w['top'] > start]
        for r in cr:
            y = r[0][1]; num = min(nums, key=lambda w: abs(w['top'] + 4 - y))
            bx = next((b for b in boxes if b['top'] > y), None)
            F['overall'].append({'n': int(num['text'].strip()[:-1]), 'page': pi + 1, 'text': text_between(p, num['top'], (bx['top'] if bx else y + 30), 450),
                                 'marks': {'yes': [R(r[0][0]), R(r[0][1])], 'no': [R(r[1][0]), R(r[1][1])]},
                                 'box': [R(bx['x0']), R(bx['top']), R(bx['x1']), R(bx['bottom'])] if bx else None})
    # the summary
    si = next(i for i in range(N) if 'Information Summary' in (pages[i].extract_text() or ''))
    p = pages[si]; st = p.extract_text()
    S = {'page': si + 1, 'name': label_at(p, r'^Child.s name'), 'date': label_at(p, r'^Date ASQ completed'), 'childId': label_at(p, r'^Child.s ID'),
         'dob': label_at(p, r'^Date of birth'), 'program': label_at(p, r'^Administering program'), 'areas': {}, 'overall': {}, 'follow': [], 'grid': {}}
    zones = chart_zones(path, si + 1, p)
    for i, (k, U, label) in enumerate(AREAS3):
        w = find(p, '^' + re.escape(label) + '$'); cut = None; tcell = None
        if w:
            near = [x for x in words(p) if re.match(r'^\d+\.\d\d$', x['text'].strip()) and abs(x['top'] - w['top']) < 5 and x['x0'] < 140]
            if near: cut = float(near[0]['text']); tcell = [R(near[0]['x1'] + 18), R(near[0]['bottom'] - 1.5)]
        z = zones[i] if i < len(zones) else {}
        if cut is not None and z.get('gray') is not None and abs(z['gray'] - cut) > 0.6: F['warn'].append(f'{fid} {k} chart edge {z["gray"]} differs from cutoff {cut}')
        mon = z.get('white'); near = mon is not None and abs(mon - 5 * round(mon / 5)) < 1
        if near: F['warn'].append(f'{fid} {k} monitoring edge {mon} is within a point of {5 * round(mon / 5)}')
        F['areas'].append({'key': k, 'name': label, 'cutoff': cut, 'monitor': mon, 'monitorNear': 5 * round(mon / 5) if near else None})
        S['areas'][k] = {'total': tcell, 'dots': z.get('dots', [])}
    # overall responses on the summary, Yes and No to circle, the bold uppercase one needs follow-up
    ys = [w for w in words(p) if w['text'].strip() in ('Yes', 'YES', 'No', 'NO') and w['top'] > 300 and w['top'] < 500]
    for w in [w for w in words(p) if re.match(r'^\d+\.$', w['text'].strip()) and 320 < w['top'] < 500]:
        n = int(w['text'].strip()[:-1]); side = [x for x in ys if abs(x['top'] - w['top']) < 4 and (x['x0'] > w['x0'])]
        side = sorted(side, key=lambda x: x['x0'])[:2]
        if len(side) == 2:
            yes, no = side
            com = find(p, r'^Comments:', w['top'])
            com = [c for c in words(p) if c['text'].strip() == 'Comments:' and 0 < c['top'] - w['top'] < 16 and abs(c['x0'] - w['x0']) < 30]
            S['overall'][n] = {'yes': [R((yes['x0'] + yes['x1']) / 2), R((yes['top'] + yes['bottom']) / 2)], 'no': [R((no['x0'] + no['x1']) / 2), R((no['top'] + no['bottom']) / 2)],
                               'flag': 'no' if no['text'].strip() == 'NO' else 'yes', 'comment': [R(com[0]['x1'] + 4), R(com[0]['bottom'] - 1.5)] if com else None}
    for w in words(p):
        m = re.match(r'^______\s*$', w['text'])
        if m and w['top'] > 580:
            nxt = [x for x in words(p) if abs(x['top'] - w['top']) < 3 and x['x0'] > w['x1'] and x['x0'] < 90]
            if nxt: S['follow'].append({'text': re.sub(r'\s*\(specify\):?\s*_*\.?$|:?\s*_{3,}\.?$', '', nxt[0]['text'].strip()).strip(), 'at': [R(w['x0'] + 8), R(w['bottom'] - 2)], 'blank': blank_in_row(p, w['top'], 90, 1)})
    # the optional item grid, one row an area, columns 1 to 6
    hdr = [w for w in words(p) if re.match(r'^[1-6]$', w['text'].strip()) and w['top'] > 600 and w['x0'] > 460]
    hdr = sorted(hdr, key=lambda w: w['x0'])[:6]
    for k, U, label in AREAS3:
        w = [x for x in words(p) if x['text'].strip() == label and x['x0'] > 400 and x['top'] > 620]
        if w and len(hdr) == 6: S['grid'][k] = [[R((h['x0'] + h['x1']) / 2), R(w[0]['bottom'] - 1)] for h in hdr]
    F['summary'] = S
    F['program'] = 'asq3'
    # checks: every area has six items and a total
    for k, _, _ in AREAS3:
        its = [i for i in F['items'] if i['area'] == k]
        if len(its) != 6 or sorted(i["n"] or 0 for i in its) != [1, 2, 3, 4, 5, 6]: F['warn'].append(f'{fid} {k} has items {[i["n"] for i in its]}')
        if k not in F['totals']: F['warn'].append(f'{fid} {k} total line missing')
        if any(not i['score'] for i in its): F['warn'].append(f'{fid} {k} an item score line is missing')
    if len(F['overall']) < 6: F['warn'].append(f'{fid} only {len(F["overall"])} overall questions')
    return F


def glyph_points(p, ch):
    return [((c['x0'] + c['x1']) / 2, c) for c in p.chars if c['text'] == ch]


def asqse2(path, fid):
    pdf = pdfplumber.open(path); pages = pdf.pages; N = len(pages)
    cover = pages[0]
    F = {'id': fid, 'tool': 'asqse2', 'months': int(fid.split('-')[1]), 'pages': N, 'size': [R(cover.width), R(cover.height)],
         'window': window(cover.extract_text()), 'items': [], 'pageTotals': [], 'overall': [], 'warn': []}
    # the cover. Its circles are printed letters, so a mark goes over the letter.
    def circ_after(p, pat, below=0):
        w = find(p, pat, below)
        if not w: return None
        o = [c for c in p.chars if c['text'] == '◯' and abs(c['top'] - w['top']) < 6 and c['x0'] <= w['x0'] + 2]
        o = max(o, key=lambda c: c['x0']) if o else None
        return [R((o['x0'] + o['x1']) / 2), R(o['top'] + (o['bottom'] - o['top']) * 0.15)] if o else None
    rel = {k: circ_after(cover, pat, 490) for k, pat in [('parent', r'Parent'), ('guardian', r'Guardian'), ('teacher', r'Teacher'), ('provider', r'Child care'), ('grand', r'Grandparent'), ('foster', r'Foster'), ('other', r'Other')]}
    F['cover'] = {'page': 1, 'date': label_at(cover, r'^Date asQ'), 'first': label_above(cover, r'^Child.s fi\s?rst name') or label_at(cover, r'^Child.s fi'),
                  'middle': label_above(cover, r'^Child.s middle'), 'last': label_above(cover, r'^Child.s last name'), 'dob': label_at(cover, r'^Child.s date of birth'),
                  'gender': {'male': circ_after(cover, r'Male'), 'female': circ_after(cover, r'Female')}, 'pfirst': label_at(cover, r'^First name'), 'plast': label_at(cover, r'^Last name'),
                  'rel': {k: v for k, v in rel.items() if v}, 'program': label_at(cover, r'^Program name'), 'childId': label_at(cover, r'^Child.s ID'),
                  'age': label_above(cover, r'^Age at administration')}
    # SE-2's cover labels sit beside their lines (first name above, the rest after)
    for k in ('first', 'middle', 'last'):
        w = find(cover, {'first': r'^Child.s fi', 'middle': r'^Child.s middle', 'last': r'^Child.s last'}[k])
        if w: F['cover'][k] = [R(w['x0'] + 2), R(w['top'] + 22)]
    for k, pat in (('pfirst', r'^First name'), ('plast', r'^Last name')):
        w = find(cover, pat, 340)
        if w: F['cover'][k] = [R(w['x0'] + 2), R(w['top'] + 22)]
    # the address lines, written under each label as the names are, and the email after its label
    C = F['cover']
    for k, pat, below in (('street', r'^Street address', 370), ('city', r'^City', 400), ('state', r'^(State/)?province', 400), ('zip', r'^ZIP/postal', 400), ('country', r'^Country', 440), ('phone', r'^(Other telephone )?number:', 445)):
        ws_ = [w for w in words(cover) if re.search(pat, w['text']) and w['top'] > below]
        if k == 'phone': ws_ = [w for w in ws_ if w['x0'] > 380]
        if ws_: C[k] = [R(ws_[0]['x0'] + 2), R(ws_[0]['top'] + 22)]
    C['email'] = label_at(cover, r'^E-?\s?mail')
    pn = 0
    for pi in range(1, N):
        p = pages[pi]; t = p.extract_text() or ''
        if 'information summary' in t.lower(): continue
        bx = [r for r in p.rects if 9.3 < r['x1'] - r['x0'] < 10.2 and abs((r['x1'] - r['x0']) - (r['bottom'] - r['top'])) < 1]
        rw = rows([((r['x0'] + r['x1']) / 2, (r['top'] + r['bottom']) / 2) for r in bx], 3)
        rw = [r for r in rw if len(r) == 3]
        if rw: pn += 1
        letters = [c for c in p.chars if c['text'] in 'zvx' and c['size'] < 9 and c['x0'] > 370]
        ocirc = [c for c in p.chars if c['text'] == '◯' and c['x0'] > 480]
        nums = [w for w in words(p) if re.match(r'^\s*\d+\.\s*$', w['text']) and w['x0'] < 60]
        for r in rw:
            y = r[0][1]
            sc = []
            for x, _ in r:
                l = [c for c in letters if 0 < c['x0'] - x < 20 and abs((c['top'] + c['bottom']) / 2 - y) < 6]
                sc.append({'z': 0, 'v': 5, 'x': 10}[l[0]['text']] if l else None)
            oc = [c for c in ocirc if abs((c['top'] + c['bottom']) / 2 - y) < 8]
            num = min(nums, key=lambda w: abs(w['top'] + 4 - y)) if nums else None
            n = int(re.sub(r'\D', '', num['text'])) if num else None
            nx = [w['top'] for w in nums if w['top'] > num['top'] + 2] + [p.height - 60]
            line = [w for w in words(p) if re.match(r'^_{4,}\s*$', w['text']) and w['x0'] > 530 and abs(w['top'] - y) < 8]
            F['items'].append({'id': f'Q{n}', 'n': n, 'page': pi + 1, 'pageN': pn, 'text': text_between(p, num['top'], min(nx), 370),
                               'marks': {'often': [R(r[0][0]), R(r[0][1])], 'some': [R(r[1][0]), R(r[1][1])], 'rarely': [R(r[2][0]), R(r[2][1])]},
                               'points': {'often': sc[0], 'some': sc[1], 'rarely': sc[2]},
                               'concern': [R((oc[0]['x0'] + oc[0]['x1']) / 2), R(y)] if oc else None,
                               'score': [R(line[0]['x0'] + 4), R(line[0]['bottom'] - 2.5)] if line else None,
                               'describe': bool(re.search(r'describe|explain', text_between(p, num['top'], min(nx), 370), re.I))})
            if None in sc: F['warn'].append(f'{fid} Q{n} a box has no score letter')
            if F['items'][-1]['describe']:
                lns = [x for x in words(p) if re.match(r'^\s*_{20,}', x['text']) and y < x['top'] < min(nx) and x['x0'] < 200]
                F['items'][-1]['lines'] = [[R(x['x0'] + 4), R(x['bottom'] - 3), R(x['x1'])] for x in lns]
        if rw:
            w = find(p, r'TOTAL POINTS ON PAGE')
            ln = [x for x in words(p) if re.match(r'^_{4,}\s*$', x['text']) and w and abs(x['top'] - w['top']) < 6 and x['x0'] > w['x1']]
            F['pageTotals'].append({'page': pi + 1, 'at': [R(ln[0]['x0'] + 4), R(ln[0]['bottom'] - 2.5)] if ln else ([R(w['x1'] + 6), R(w['bottom'] - 1.5)] if w else None)})
        # the overall questions on the last question page
        if not rw and re.search(r'Overall', t, re.I):
            ys = [c for c in p.chars if c['text'] == '◯']
            for w in [w for w in words(p) if re.match(r'^\s*\d+\.', w['text'])]:
                n = int(re.match(r'^\s*(\d+)', w['text']).group(1))
                o = sorted([c for c in ys if 0 <= c['top'] - w['top'] < 18], key=lambda c: c['x0'])
                lns = [x for x in words(p) if re.match(r'^\s*_{20,}', x['text']) and x['top'] > w['top']]
                nxt = [x['top'] for x in words(p) if re.match(r'^\s*\d+\.', x['text']) and x['top'] > w['top'] + 4]
                lns = [x for x in lns if not nxt or x['top'] < min(nxt)]
                F['overall'].append({'n': n, 'page': pi + 1, 'text': re.sub(r'^\s*\d+\.\s*', '', w['text']).strip(),
                                     'marks': {'yes': [R((o[0]['x0'] + o[0]['x1']) / 2), R(o[0]['top'] + (o[0]['bottom'] - o[0]['top']) * .15)], 'no': [R((o[1]['x0'] + o[1]['x1']) / 2), R(o[1]['top'] + (o[1]['bottom'] - o[1]['top']) * .15)]} if len(o) >= 2 else None,
                                     'lines': [[R(x['x0'] + 8), R(x['bottom'] - 3)] for x in lns]})
    # the summary
    si = next(i for i in range(N) if 'information summary' in (pages[i].extract_text() or '').lower())
    p = pages[si]; st = p.extract_text()
    S = {'page': si + 1, 'name': label_at(p, r'^Child.s name'), 'date': label_at(p, r'^Date ASQ:SE'), 'childId': label_at(p, r'^Child.s ID'),
         'dob': label_at(p, r'^Child.s date of birth'), 'who': label_at(p, r'^:\s*_') and [label_at(p, r'^Person who completed')[0] + 4, label_at(p, r'^Person who completed')[1]],
         'age': label_at(p, r'^Child.s age in months'), 'program': label_at(p, r'^Administering program'), 'pageTotals': [], 'interp': {}, 'overall': {}, 'factors': [], 'follow': []}
    S['who'] = None
    w = find(p, r'^Person who completed');
    if w:
        c = [x for x in words(p) if x['text'].startswith(':') and abs(x['top'] - w['top']) < 3]
        S['who'] = [R((c[0]['x0'] if c else w['x1']) + 8), R(w['bottom'] - 1.5)]
    for i in range(1, 6):
        w = find(p, rf'TOTAL POINTS ON PAGE {i}$')
        if w: S['pageTotals'].append([R(w['x1'] + 14), R(w['bottom'] - 1)])
    w = find(p, r'^total score$'); S['total'] = [R(w['x1'] + 12), R(w['bottom'] - 1)] if w else None
    cut = [x for x in words(p) if re.match(r'^\d{2,3}$', x['text'].strip()) and 200 < x['top'] < 225 and x['x0'] > 470]
    F['cutoff'] = int(cut[0]['text']) if cut else None
    S['totalCell'] = [R(cut[0]['x0'] + 60), R(cut[0]['bottom'] - 1)] if cut else None
    mon = [x for x in words(p) if re.match(r'^\d{2,3}$', x['text'].strip()) and 280 < x['top'] < 315 and x['x0'] > 300]
    nums = sorted([int(x['text']) for x in mon if x['text'].strip().isdigit()])
    F['monitor'] = nums[0] if len(nums) >= 2 else None
    if F['cutoff'] and nums and nums[-1] != F['cutoff']: F['warn'].append(f'{fid} graphic {nums} and cutoff {F["cutoff"]}')
    blanks = [x for x in words(p) if re.match(r'^_{4}\s*$', x['text'])]
    for key, pat in (('below', r'below the cutoff'), ('close', r'close to the cutoff'), ('above', r'above the cutoff')):
        w = find(p, pat)
        b = [x for x in blanks if w and abs(x['top'] - w['top']) < 3]
        if b: S['interp'][key] = [R(b[0]['x0'] + 5), R(b[0]['bottom'] - 2)]
    # 1 to the last scored item, then the overall questions by their own numbers
    ovn = [str(o['n']) for o in F['overall'] if o.get('marks')]
    for key, pat in [('scored', r'^1.\s*\d+\.')] + [(n, '^' + n + r'\.') for n in ovn]:
        w = find(p, pat, 330)
        if not w: continue
        yn = [x for x in words(p) if x['text'].strip().lower() in ('yes', 'no') and abs(x['top'] - w['top']) < 3]
        cm = [x for x in words(p) if x['text'].strip() == 'Comments:' and abs(x['top'] - w['top']) < 3]
        if len(yn) >= 2: S['overall'][key] = {'yes': [R((yn[0]['x0'] + yn[0]['x1']) / 2), R((yn[0]['top'] + yn[0]['bottom']) / 2)], 'no': [R((yn[1]['x0'] + yn[1]['x1']) / 2), R((yn[1]['top'] + yn[1]['bottom']) / 2)], 'comment': [R(cm[0]['x1'] + 4), R(cm[0]['bottom'] - 1.5)] if cm else None}
    f4 = find(p, r'referral COnsiDeratiOns|referral considerations', 0) or find(p, r'^\s*4\.\s*fOllOw')
    f5 = find(p, r'^\s*5\.\s*fOllOw')
    for b in blanks:
        nx = [x for x in words(p) if abs(x['top'] - b['top']) < 3 and x['x0'] > b['x1'] and x['x0'] < 80]
        if not nx or not f4 or b['top'] < f4['top']: continue
        target = S['factors'] if (f5 and b['top'] < f5['top']) else S['follow']
        row = ' '.join(x['text'].strip() for x in sorted([x for x in words(p) if abs(x['top'] - b['top']) < 3 and x['x0'] > b['x1']], key=lambda x: x['x0']))
        target.append({'text': re.sub(r'\s*_{3,}.*$', '', re.sub(r'\s+', ' ', row.replace('- ', '-'))).strip(), 'at': [R(b['x0'] + 5), R(b['bottom'] - 2)], 'blank': blank_in_row(p, b['top'], 90)})
    F['summary'] = S
    F['program'] = 'asqse2'
    ns = [i['n'] for i in F['items']]
    if ns != list(range(1, len(ns) + 1)): F['warn'].append(f'{fid} items {ns}')
    return F


def main(folder, out):
    forms = {}
    for f in sorted(glob.glob(os.path.join(folder, '*.pdf'))):
        fid = os.path.basename(f)[:-4]
        forms[fid] = asq3(f, fid) if fid.startswith('asq3-') else asqse2(f, fid)
        for w in forms[fid]['warn']: print('CHECK', w)
    json.dump({'forms': forms}, open(out, 'w'), indent=1, ensure_ascii=False)
    print(len(forms), 'forms written to', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
