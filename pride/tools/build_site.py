"""Rebuild pride/index.html from data/events.json + tools/template.html.

Refresh flow when the community sheet gets a new update:
  1. Export the Google Sheet as text (Drive export / read_file_content) to sheet_raw.txt
  2. python3 tools/parse_sheet.py   (reads sheet_raw.txt, writes data/events.json)
  3. python3 tools/build_site.py    (embeds events + font into index.html)
Run both from the pride/ directory.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET_URL = 'https://docs.google.com/spreadsheets/d/1jR8WFLPGAxa01kddB1rK95OXJ04hO9-avqHNU33F0Yc/edit'
SHEET_UPDATED = '5 Jul 2026'

events = json.loads((ROOT / 'data' / 'events.json').read_text())
keep = ['name','status','genre','dateText','start','end','time','venue','priceText',
        'priceMin','priceMax','free','avail','desc','web','insta','tickets','tags','img','section']
slim = [{k: e[k] for k in keep} for e in events]
payload = json.dumps(slim, ensure_ascii=False, separators=(',',':')).replace('</', '<\\/')

font = (ROOT / 'tools' / 'anton_b64.txt').read_text().strip()
tpl = (ROOT / 'tools' / 'template.html').read_text()
out = (tpl.replace('__FONT_B64__', font)
          .replace('__EVENTS_JSON__', payload)
          .replace('__SHEET_URL__', SHEET_URL)
          .replace('__SHEET_UPDATED__', SHEET_UPDATED))
(ROOT / 'index.html').write_text(out)
print('wrote', ROOT / 'index.html', len(out), 'bytes,', len(slim), 'events')
