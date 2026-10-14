# Jamal Protocol

Frontend: https://rsemenov81-hash.github.io/protocol-os/jamal/

Backend: the existing `jamal-protocol` Worker. Version 2.0.1 adds Scott's
private document archive and optional push reminders while retaining Jamal's
`JAMAL_KV` binding, `ADMIN_TOKEN` / `MEMBER_TOKEN` secrets, `jamal:state` key,
`jamal:state:prev` backup and revision checks. Do not create a new namespace,
change codes, or seed Scott's regimen. An empty namespace stays empty.

Deploy the Worker before the Pages frontend. Preserve existing secrets and
state; add a `* * * * *` cron to run reminder checks every minute. No notifications are
sent without a subscribed device, and empty stacks never send reminders.
On iPhone, notifications require the Home Screen app and permission on that
phone. Device delivery must be tested separately from backend/browser tests.

The frontend reuses the generic Higgsfield photographs and water loop documented
in `../scott/DEPLOY.md`. These assets contain no client information. Deploy
HTML, versioned CSS/modules, icons, manifest, service worker and assets together.
The service worker does not cache private records. Reduced motion, data saving,
slow connections and the saved pause setting suppress background video.

Jamal's existing compound records, schedules, concentrations, active states and
logs remain in private KV. Morning/night stacks start empty and can be populated
later by the administrator. Fractional IU doses remain fractional in both the
UI and API. Members cannot change the regimen or administrator-owned logs.

Original PDFs/CSVs live in authenticated `document:doc_<20 hex>` KV entries
with their SHA-256 digest. Never commit records, import payloads or access codes.
Merge source reports by collection date and scans by their original timestamp;
preserve qualitative and bounded results. Historical values keep their original
date without borrowing later reference intervals. Provider target bands are
explicitly distinguished from laboratory reference intervals.

Before importing, back up live state, verify every source digest, re-read the
revision, and preserve the exact compounds and logs. Upload/checksum original
files before publishing their references. Use `/admin` with `baseRev` for the
state update and verify the result using both member and administrator access.

Validation: `npm test` covers migration, namespace isolation, authentication,
revisions, fractional doses, dose gates and empty reminders. CI runs
`npm run e2e:jamal` in Chromium and WebKit with synthetic data only, including
responsive navigation, logs, filters, comparisons, exports and error recovery.

Rollback: revert the frontend commit and restore the previous Worker version.
The new fields are additive; preserve live dose logs when restoring records.
