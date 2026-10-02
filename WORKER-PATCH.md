# Cloudflare worker — how to deploy `protocol-sync-worker.js`

`protocol-sync-worker.js` in this repo is the **complete** worker (v1.4.0): the production build that was running in Cloudflare on 2026-10-02 plus the schedule rules. Deploying it is a copy-paste.

1. Open `protocol-sync-worker.js` on GitHub and click the **copy** icon at the top of the file (or open the raw file, press Cmd + A, then Cmd + C).
2. In Chrome, Cloudflare dashboard → **Workers & Pages → protocol-sync → Edit code**.
3. Click once inside the code editor, press **Cmd + A**, then **Cmd + V** so the whole file is replaced.
4. Click the blue **Deploy** button (top right). Confirm if asked.
5. Check: ask Claude "what's scheduled today". The reply now comes from the new worker (`get_protocol` returns `"scheduleRules": "v1"`).

## What changed in v1.4.0

Claude's tools (`get_today`, `get_adherence`, `get_protocol`) now follow the same rules as the app:

- **Every other day** (and every N days) compounds count only their due days.
- **Finish cycle** / start dates: a compound is on the calendar only inside its dates, and adherence still counts a finished cycle's past days.
- **Dated plan changes** apply from their date when scoring past days; `get_protocol` shows the upcoming change (`nextChange`) and end date (`endsOn`).
- Back-dated entries are flagged `backdated: true` in `get_logs_for_date`.

The `/sync` API (revisions, `If-Match`, `prev` snapshot, tokens) is untouched. Secrets (`SYNC_TOKEN`, `READ_TOKEN`) and the KV binding live in the worker settings, not in the code, so a code paste never affects them.
