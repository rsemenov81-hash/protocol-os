import re, json, unicodedata

with open(__import__('pathlib').Path(__file__).resolve().parent.joinpath('sheet_raw.txt').as_posix()) as f:
    lines = [l.rstrip('\n') for l in f if l.strip()]

def split_row(line):
    line = line.strip()
    if line.startswith('|'): line = line[1:]
    if line.endswith('|'): line = line[:-1]
    return [c.strip() for c in re.split(r'(?<!\\)\|', line)]

def clean(cell):
    c = cell.replace('\\[merged\\]', '').strip()
    c = re.sub(r'\\(.)', r'\1', c)          # unescape \_ \! \* \| etc.
    c = c.replace('\xa0', ' ')
    c = re.sub(r'<br\s*/?>', '\n', c)
    c = re.sub(r'[ \t]+', ' ', c).strip()
    return c

rows = [[clean(c) for c in split_row(l)] for l in lines]

MONTHS = {m.lower(): i+1 for i, m in enumerate(
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])}
def month_num(s):
    return MONTHS.get(s[:3].lower())

def parse_date_token(tok, default_year=2026, prev_month=None):
    """Parse '24 Jul', 'Aug 15', 'Sat 25 Jul 2026', '15' -> (y,m,d) or None"""
    tok = tok.strip()
    tok = re.sub(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\.?\s+', '', tok, flags=re.I)
    y = default_year
    ym = re.search(r'(20\d\d)', tok)
    if ym:
        y = int(ym.group(1)); tok = tok.replace(ym.group(1), '').strip()
    m = d = None
    mm = re.match(r'^(\d{1,2})\s+([A-Za-z]+)\.?$', tok)     # 24 Jul
    if mm: d, m = int(mm.group(1)), month_num(mm.group(2))
    else:
        mm = re.match(r'^([A-Za-z]+)\.?\s+(\d{1,2})$', tok) # Aug 15
        if mm: m, d = month_num(mm.group(1)), int(mm.group(2))
        else:
            mm = re.match(r'^(\d{1,2})$', tok)              # bare day
            if mm and prev_month: d, m = int(mm.group(1)), prev_month
    if m and d: return (y, m, d)
    return None

def parse_dates(s):
    """Return (startISO, endISO, ok)"""
    if not s or s in ('TBA','TBD','—','-',''): return (None, None, False)
    t = s.replace('–','-').replace('—','-')
    t = re.sub(r'^(Likely|Probably|Expected|Possible|Possibly)\s+', '', t, flags=re.I)
    t = t.replace(' / ', ' - ')
    parts = [p.strip() for p in re.split(r'\s*-\s*', t) if p.strip()]
    if not parts: return (None, None, False)
    start = parse_date_token(parts[0])
    if len(parts) == 1:
        if not start: return (None, None, False)
        iso = '%04d-%02d-%02d' % start
        return (iso, iso, True)
    end = parse_date_token(parts[-1], prev_month=start[1] if start else None)
    if start and not end: end = start
    if end and not start: start = end
    if not start: return (None, None, False)
    # year-less start inheriting from end (e.g. 'Sat 25 Jul - Sat Aug 15 2026')
    s_iso = '%04d-%02d-%02d' % start
    e_iso = '%04d-%02d-%02d' % end
    if e_iso < s_iso: e_iso = s_iso
    return (s_iso, e_iso, True)

def parse_price(s):
    """Return (minEUR, maxEUR, isFree, ok). Numbers in EUR."""
    if not s: return (None, None, False, False)
    low = s.lower()
    if 'free' in low or 'no cover' in low or 'gratis' in low:
        nums = [float(x.replace(',', '.')) for x in re.findall(r'(?:€|eur\s?)\s*(\d+(?:[.,]\d{1,2})?)', low)]
        if nums: return (0.0, max(nums), True, True)
        return (0.0, 0.0, True, True)
    if low in ('tba','tbd','—','-','?','unknown',''): return (None, None, False, False)
    no_pass = re.sub(r'\([^)]*pass[^)]*\)', ' ', low)
    if re.search(r'\d', no_pass): low = no_pass
    scrub = re.sub(r'\b\d+\s*[-–]?\s*(?:day|hour|hr|night)s?\b', ' ', low)
    scrub = re.sub(r'\b\d+\s*x\b', ' ', scrub)
    nums = [float(x.replace(',', '.')) for x in re.findall(r'(\d+(?:[.,]\d{1,2})?)', scrub)]
    nums = [n for n in nums if n < 3000]   # drop years etc.
    if not nums: return (None, None, False, False)
    return (min(nums), max(nums), False, True)

HEADER = ['Status','Party Name','Genre / Vibe','Date','Time','Venue','Ticket Price',
          'Tickets Available?','Description','Link','Web','Instagram','Tickets','Tags','URL']

events, section, sheet_no, warnings = [], '', 1, []
header_seen = 0
for i, r in enumerate(rows):
    r = (r + ['']*15)[:15]
    if r[0] == 'Status' and r[1] == 'Party Name':
        header_seen += 1
        if header_seen > 1: sheet_no = 2
        continue
    if r[0].startswith('▼'):
        section = r[0].strip('▼ ').strip()
        continue
    if r[0].strip().upper().startswith('TBD') and not r[1]:
        section = 'TBD / Rumored'
        continue
    if not r[1] or r[1] == ':-:':
        continue
    if 'Party Guide' in r[0] or 'AMSPRIDE' in r[0] or 'Created by' in r[0]:
        continue
    (ds, de, dok) = parse_dates(r[3])
    (pmin, pmax, free, pok) = parse_price(r[6])
    if not dok: warnings.append(f'row {i}: unparsed date {r[3]!r} for {r[1]!r}')
    if not pok and r[6] not in ('','—','TBA','TBD'): warnings.append(f'row {i}: unparsed price {r[6]!r} for {r[1]!r}')
    avail = r[7]
    if avail in ('—','-',':-:'): avail = ''
    if avail.lower() == 'on sale': avail = 'On sale'
    insta = r[11] if 'instagram.com' in r[11] else ''
    tickets = r[12]
    if tickets == insta: tickets = ''
    ev = dict(
        name=r[1], status=r[0], genre=r[2], dateText=r[3], start=ds, end=de,
        time=r[4], venue=r[5], priceText=r[6], priceMin=pmin, priceMax=pmax, free=free,
        avail=avail, desc=r[8], link=r[9] or r[10], web=r[10], insta=insta,
        tickets=tickets or r[9] or r[10],
        tags=[t.strip() for t in r[13].split(',') if t.strip()],
        img=r[14] if r[14].startswith('http') else '',
        section=section, sheet=sheet_no,
    )
    events.append(ev)

# dedupe on (name, dateText)
seen, deduped = set(), []
kept_by_key = {}
for e in events:
    k = (e['name'].lower(), e['dateText'])
    if k in seen:
        kept = kept_by_key[k]
        m = re.search(r'NOTE:.*', e['desc'])
        if m and 'not affiliated' in m.group(0).lower() and 'not affiliated' not in kept['desc'].lower():
            kept['desc'] = kept['desc'].rstrip() + '\n\n⚠ ' + m.group(0).strip()
            warnings.append(f"dup dropped but warning merged: {e['name']}")
        else:
            warnings.append(f"dup dropped: {e['name']} {e['dateText']}")
        continue
    seen.add(k); deduped.append(e); kept_by_key[k] = e
events = deduped

from collections import Counter
print('EVENTS:', len(events))
print('statuses:', Counter(e['status'] for e in events))
print('avail:', Counter(e['avail'] for e in events))
print('sections:', Counter(e['section'] for e in events))
print('sheets:', Counter(e['sheet'] for e in events))
print('no-date:', sum(1 for e in events if not e['start']))
print('no-price:', sum(1 for e in events if e['priceMin'] is None))
print('genres:', len(set(e['genre'] for e in events)))
print('--- WARNINGS ---')
for w in warnings: print(' *', w)
with open(__import__('pathlib').Path(__file__).resolve().parent.parent.joinpath('data/events.json').as_posix(),'w') as f:
    json.dump(events, f, ensure_ascii=False, indent=1)
print('wrote events.json')
