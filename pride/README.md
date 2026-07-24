# Pride Planner — Amsterdam WorldPride 2026

A single-file party planner for Amsterdam Pride / WorldPride 2026, built from the
community [party guide spreadsheet](https://docs.google.com/spreadsheets/d/1jR8WFLPGAxa01kddB1rK95OXJ04hO9-avqHNU33F0Yc/edit)
by @theonlylovebird (see also [amspride.com](https://amspride.com)).

Open `index.html` — no build, no server, works offline after first load.

## What it does
- **Events** — all 91 parties grouped by day: time, venue, vibe, price, sold-out warnings,
  ticket / website / Instagram links. Filter by phase (Pre-Pride / Pride Weekend /
  WorldPride Week / Post-Pride), vibe, price bucket, search; sort by date, price, or name.
- **My Plan** — tap ★ (interested) or ✓ (booked) on any event. Booked events record what
  you paid, when you booked, and a note. The plan shows a per-day itinerary, spend totals,
  and warns about same-day time clashes. Saved in localStorage on your device.
- **Friends** — share your plan as a link/code; import friends' plans to see who's going
  where, badge their picks on every card, and list events friends are going to that you
  haven't picked yet.

## Refreshing data when the sheet updates
From this directory:
1. Export the Google Sheet as plain text (Drive "download as" or MCP `read_file_content`)
   into `tools/sheet_raw.txt` (markdown-table format, one row per line).
2. `cd tools && python3 parse_sheet.py` → rewrites `data/events.json` (check the QA
   warnings it prints for unparsed dates/prices).
3. `python3 build_site.py` → rebuilds `../index.html` (bump `SHEET_UPDATED` in the script).
