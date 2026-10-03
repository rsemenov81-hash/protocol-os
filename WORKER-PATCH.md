# Cloudflare worker — how to deploy `protocol-sync-worker.js` (v1.5.0)

`protocol-sync-worker.js` in this repo is the **complete** worker (v1.5.0): the v1.4.0 production build plus the changes listed below. Deploying it is a copy-paste. Nothing else needs to change in Cloudflare: secrets (`SYNC_TOKEN`, `READ_TOKEN`) and the KV binding (`PROTOCOL_KV`) live in the worker settings, not in the code, so a code paste never affects them.

1. Open `protocol-sync-worker.js` on GitHub and click the **copy** icon at the top of the file (or open the raw file, press Cmd + A, then Cmd + C).
2. In Chrome, Cloudflare dashboard → **Workers & Pages → protocol-sync → Edit code**.
3. Click once inside the code editor, press **Cmd + A**, then **Cmd + V** so the whole file is replaced.
4. Click the blue **Deploy** button (top right). Confirm if asked.
5. Check: in the Claude app, ask Claude to call `get_protocol`. The reply must show `"workerVersion": "1.5.0"`. It will also show `"source": "profile"` until the new app has pushed once; after that first push it flips to `"source": "all"` and stays there.

## What changed in v1.5.0 (plain words)

- **A skipped dose is no longer counted as taken.** When you tap "skip" in the app, Claude used to see it as a 0 mcg dose and count it as logged, so a skipped day could score 100% adherence. Now `get_today`, `get_logs_for_date` and `get_adherence` list skips separately (`skipped`), keep them out of the logged/taken counts, and count them as missed days. An IU dose (HCG) still counts as a dose.
- **One shared record for all four profiles.** The new app saves everyone (Roman, Scott, Jamal, Tim) into one record (`?profile=all`). Claude's tools read that record and show only the profile asked for. Until the new app has pushed once, the worker keeps reading the old per-profile records, so nothing breaks in between. `get_protocol` tells you which one answered (`source`).
- **Daily backups.** The first save of each day (New York time) is kept as a snapshot for 30 days, on top of the existing "previous version" copy. To see them: `GET /sync?profile=Roman&snapshots=1` lists the dates, `GET /sync?profile=Roman&snapshot=2026-10-03` returns that day's data (both need the write token).
- **Safer connections.** The token is read from the `Authorization` header first (the `?token=` link style the Claude connector uses still works). Responses are marked "do not cache". Only the app's own address (`rsemenov81-hash.github.io`) and local development addresses are allowed to call the worker from a browser.
- **Adherence around the clock change.** The "last 7 days" window is now built by stepping calendar days, so the spring-forward / fall-back weekend no longer skips or doubles a day.
- Fields the new app adds (`updatedAt` on every item, `meta.tombstones` for deletions) are stored exactly as sent.

Everything else is unchanged: the schedule rules (`scheduleRules: "v1"`, every-other-day, start/end dates, dated plan changes), `endsOn` / `nextChange`, the `backdated` flag, revisions with `If-Match` → 409 on a stale write, the `prev` copy, and recovery from an empty KV.

## Optional: rate-limit bad tokens

Rate limiting cannot be done in the worker code; in the Cloudflare dashboard go to **Security → WAF → Rate limiting rules** and add a rule for the worker's hostname that counts requests whose response status equals 401 (for example more than 20 in 1 minute per IP) and blocks for 10 minutes.

## Tests

`node --test tests/worker.test.mjs` (Node 22, no dependencies) covers every change above against a fake KV; `node --check protocol-sync-worker.js` confirms the file still parses as pasted.
