# Cloudflare worker — how to deploy `protocol-sync-worker.js` (v1.6.0)

`protocol-sync-worker.js` in this repo is the **complete** worker (v1.6.0): the v1.5.0 build plus the changes listed below. Deploying it is still a copy-paste. The existing secrets (`SYNC_TOKEN`, `READ_TOKEN`) and the KV binding (`PROTOCOL_KV`) live in the worker settings, not in the code, so the paste never touches them. v1.6.0 needs **three new secrets and one Cron Trigger** (steps 6–7) for the reminders; everything else works without them.

1. Open `protocol-sync-worker.js` on GitHub and click the **copy** icon at the top of the file (or open the raw file, press Cmd + A, then Cmd + C).
2. In Chrome, Cloudflare dashboard → **Workers & Pages → protocol-sync → Edit code**.
3. Click once inside the code editor, press **Cmd + A**, then **Cmd + V** so the whole file is replaced.
4. Click the blue **Deploy** button (top right). Confirm if asked.
5. Check: in the Claude app, ask Claude to call `get_protocol`. The reply must show `"workerVersion": "1.6.0"`.
6. **Reminder secrets.** On your Mac run `node tools/vapid-keys.mjs` once (prints two keys, nothing is sent anywhere). Then dashboard → **Workers & Pages → protocol-sync → Settings → Variables and Secrets → Add**, three times:
   - `VAPID_PUBLIC_KEY` — type *Secret* — the public key the script printed.
   - `VAPID_PRIVATE_KEY` — type *Secret* — the private key the script printed. Paste it here and nowhere else.
   - `VAPID_SUBJECT` — type *Text* — `mailto:your@email` (the address push services may contact; any real address of yours).
   Click **Deploy** to apply them. Keep the printed keys somewhere safe: if you ever generate a new pair, every phone has to enable reminders again.
7. **Cron Trigger.** Dashboard → **Workers & Pages → protocol-sync → Settings → Triggers → Cron Triggers → Add Cron Trigger**, enter `*/15 * * * *`, save. This runs the worker's reminder check every 15 minutes (free plan is fine).
8. Verify reminders: in the app on your phone, **Data & sync → Reminders → Enable on this device** (the browser asks for notification permission; on iPhone the app must be installed to the Home Screen first), then **Send test**. A test notification arrives within a few seconds. `GET /push/config` with the write token answers `"enabled": true` once step 6 is complete.

## What changed in v1.6.0 (plain words)

- **Push reminders for due doses.** Each phone that enables reminders registers itself with the worker (`/push/subscribe`) with its own times per block — AM, Pre-workout, PM — a time zone and an optional nudge. Every 15 minutes the worker checks, for each registered phone, which blocks' times just passed, works out the doses that are still due for that block **the same way `get_today` does** (schedule rules, every-other-day, dated plan changes, finished cycles; PRN never), leaves out anything already logged **or skipped** today, and sends one notification per block: *"Morning doses — 2 doses due: Testosterone Cypionate 20 mg, HCG 500 IU. Tap to open and log."* With a nudge of e.g. 30 minutes, a second *"Still due: …"* follows if something is still open. Nothing is sent when everything is handled, and the same reminder is never sent twice (a two-day marker per phone, day and block). A phone that has turned notifications off is dropped automatically (the push service answers 404/410). Encryption and signing (VAPID, RFC 8291) are done inside the worker with the browser's own `crypto.subtle`; no library, no third-party service. Only the push services ever see the encrypted payload; the worker stores each phone's subscription in KV under `push:<id>` and never returns the keys or the full endpoint to the app.
- **Claude can propose protocol changes — the app decides.** Two new MCP tools: `propose_change` (Claude files a change for a profile: dose, unit, days / timing / every-N-days, end date or a note, with a rationale and a start date) and `get_proposals` (lists them with status). A proposal changes **nothing** by itself; it sits in KV under `proposals:<profile>` (newest first, at most 20 per profile) until you open the app's inbox and tap Approve or Dismiss (`GET /proposals`, `POST /proposals/<id>`). Claude's read-only connector token may file proposals; approving needs the app's write token. Every `GET /sync` answer now carries `_proposalsPending` (all profiles for `?profile=all`, that profile's count otherwise), so the app sees a new proposal on its normal pull without extra calls.
- **Version** is 1.6.0 in `/health`, `initialize` and `get_protocol`.

Everything else is unchanged: the v1.5.0 skip handling, the shared record with per-profile fallback, snapshots, Bearer-first auth, CORS allow-list, `no-store`, the schedule rules (`scheduleRules: "v1"`), `endsOn` / `nextChange`, `backdated`, revisions with `If-Match` → 409, the `prev` copy, recovery from an empty KV.

## New endpoints (for reference)

All need the **write token** (`SYNC_TOKEN`) unless noted; the read token gets 403. Same CORS and `Cache-Control: no-store` rules as `/sync`.

| Call | Body | Answer |
| --- | --- | --- |
| `GET /push/config` | — | `{publicKey, enabled, subject, version}` — `publicKey` is `VAPID_PUBLIC_KEY` or `null`; `enabled` only when both VAPID keys are set |
| `POST /push/subscribe` | `{profile, subscription:{endpoint, keys:{p256dh, auth}}, settings:{blocks:{am,pre,pm}, times:{am:'08:00',pre:'06:00',pm:'19:00'}, nudgeMinutes:0}, tz:'America/New_York', device:'iPhone'}` | `{ok:true, id, updated, subscription}` — re-posting the same endpoint updates the record in place |
| `DELETE /push/subscribe` | `{endpoint}` (or `{id}`) | `{ok:true, id, removed}` |
| `GET /push/subscriptions?profile=X` | — | `{profile, subscriptions:[{id, profile, settings, tz, device, createdAt, updatedAt, endpointHost}]}` (`?profile=all` lists everyone; keys and endpoints are never returned) |
| `POST /push/test` | `{profile}` | `{profile, sent, failed, results:[{id, status, error?, removed?}]}` — 503 while the VAPID secrets are missing |
| `POST /push/run` | — | runs the 15-minute reminder check right now and returns its summary `{at, subscriptions, windows, sent, failed, deduped, errors}` (handy to verify the cron logic) |
| `GET /proposals?profile=X[&status=pending\|approved\|dismissed\|all]` | — | `{profile, status, pendingCount, proposals:[…pending first, newest first…]}` (`?profile=all` spans profiles) |
| `POST /proposals/<id>` | `{status:'approved'\|'dismissed', note?}` | `{ok:true, proposal}` with `status`, `resolvedAt`, `resolution` (the note) set |
| `GET /sync?…` (read or write token) | — | as before, plus `_proposalsPending: <n>` |

MCP (read or write token, `/mcp?profile=…` as before): `propose_change {profile, protocolId | peptideName, change:{doseMcg?, doseUnit?, schedule?:{days?, timeOfDay?, every?}, endDate?, note?}, rationale, effectiveFrom?}` → `{ok, id, summary, proposal}`; `get_proposals {profile, status?}` → `{profile, status, count, pendingCount, proposals}`.

A proposal record: `{id:'pr_…', profile, protocolId, peptideName, change, rationale, effectiveFrom, status:'pending'|'approved'|'dismissed', createdAt, createdBy:'mcp', resolvedAt, resolution, summary}`.

## Optional: rate-limit bad tokens

Rate limiting cannot be done in the worker code; in the Cloudflare dashboard go to **Security → WAF → Rate limiting rules** and add a rule for the worker's hostname that counts requests whose response status equals 401 (for example more than 20 in 1 minute per IP) and blocks for 10 minutes.

## Tests

`node --test tests/worker.test.mjs tests/worker-push.test.mjs tests/worker-proposals.test.mjs` (Node 22, no dependencies) covers everything above against a fake KV — the push tests generate a real VAPID keypair, capture the worker's push requests with a mocked `fetch`, verify the JWT against the public key and decrypt the `aes128gcm` body with an independent RFC 8291 receiver. `node --check protocol-sync-worker.js` confirms the file still parses as pasted.
