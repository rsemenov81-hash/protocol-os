# Scott Protocol — one-time setup

The app is `scott/index.html`. GitHub Pages serves it at
**https://rsemenov81-hash.github.io/protocol-os/scott/** once this branch is merged to `main`.

It talks to its own Cloudflare Worker, `scott-protocol`, at `https://scott-protocol.rsemenov81.workers.dev`.
The `scott-protocol` Worker and its KV namespace were observed in the live account on
October 14, 2026. The steps below are a setup/recovery reference; do not recreate the
existing resources. The private record archive requires Worker version 1.1.0 or later;
deploy the Worker before the frontend.

## Frontend design update (October 14, 2026)

Deploy `index.html`, `refinement.css`, `motion.js`, `insights.js` and `assets/` together
through the existing GitHub Pages main-branch pipeline. The HTML uses content-versioned
CSS/module URLs; update those versions when changing these files so returning devices
receive matching code. The service worker has no fetch handler or page cache.

The persistent shell contains five destinations: Today, Stacks, Labs, Progress and More.
Navigation is a sibling of the changing page, so a short page or collapsing stack cannot
remove its fixed-position host. More contains medication/library views, searchable real
dose history, reminder preferences and private CSV exports. Exports are created on-device
from authenticated data and exclude credentials and private download URLs.

The two photo stack covers and six-second water loop were generated with Higgsfield from
generic environment briefs. No profile, protocol, access code, screenshot or health data
was sent to Higgsfield:

- Morning photograph: `gpt_image_2_5`, job `5a288f7c-1b86-45d9-a04c-cb405694d4b2`.
- Night photograph: `gpt_image_2_5`, job `05d31e23-195f-4188-8a05-39f558ee2185`.
- Water motion: `seedance_2_5`, job `e0f649fe-846d-4b19-a507-3e935190fd6c`.

Photo covers are WebP (75 KB and 39 KB). The silent H.264 loop is 706 KB, 960×540 at 24 fps,
loaded after page load/idle. It pauses when hidden and honors the persistent pause choice,
reduced motion, data saving and slow connections. The matching 37 KB still is the fallback.
No backdrop blur or JavaScript per-frame animation is used. Performance measurements in
Chrome emulation do not establish physical iPhone performance.

Lab filters use source flags and existing numeric reference bounds; bounded/text results
remain text. InBody comparisons identify both measurement dates/times and only offer earlier
baselines. No new clinical interpretation or regimen change is introduced.

To roll back the design, revert the frontend commit. Worker state and dose rules are separate.

## Motion and private record archive (October 14, 2026)

The original motion implementation loaded a 120 KB H.264 background after page load/idle; the redesigned assets above replace it. Reduced motion,
data saving and slow connections use the still background. The pause preference persists,
and playback stops while the document is hidden. The original five-second visual was made
with Higgsfield, job `dd17e098-6d7b-4d33-922d-bf355372ce3b`, from the generic forest artwork.

Deploy `worker.js` version 1.1.0 to the existing Worker, preserving `SCOTT_KV`, both access
secrets, VAPID data, subscriptions, and the existing cron. The authenticated `GET /document?id=…`
route returns an original PDF or CSV from `document:doc_<20 hex characters>` in KV. Each
object contains `name`, `mime`, `base64`, and `sha256`; the response is never cached. Keep
originals and imports out of this public repository. No credential belongs in a URL.

Blood records may include `sources` and marker-level `sourceId`, `reference`, `flag`, and
`note`. Keep text and bounded results as strings; trend only numeric values with matching
marker name and unit. Historical values printed in later reports keep their original draw
date, without borrowing a later reference interval. Prefer final reports over partial reports
for values, while retaining both originals. Scans preserve `measuredAt` for same-day readings,
`metrics` for every supplied field, and `source` for the original CSV.

Before replacing state, save a private backup, re-read and check its revision, merge by
stable record IDs, and preserve dose logs. Upload and checksum originals before publishing
their references. Validate the imported state and each original through the authenticated API.

## 1. Create the storage

Dashboard → **Storage & Databases → KV → Create a namespace**. Name it `scott-protocol`, then click **Add**.

## 2. Create the worker

1. Dashboard → **Workers & Pages → Create → Create Worker** (the "Hello World" starter).
2. Name it exactly **`scott-protocol`**. The name sets the address the app calls.
3. Click **Deploy**, then **Edit code**.
4. Open `scott/worker.js` on GitHub, click the **copy** icon at the top of the file.
5. Back in the editor, click inside the code, press **Cmd + A**, then **Cmd + V**, then **Deploy**.

## 3. Connect the storage

**Workers & Pages → scott-protocol → Settings → Bindings → Add → KV namespace**.

- Variable name: **`SCOTT_KV`** (exactly this).
- KV namespace: `scott-protocol`.

Save. Cloudflare redeploys the worker.

## 4. Set the two access codes

**Workers & Pages → scott-protocol → Settings → Variables and Secrets → Add**, twice, both of type *Secret*:

| Name | Who uses it | What it allows |
| --- | --- | --- |
| `ADMIN_CODE` | You | Edit compounds, supplements, meds, blood panels and InBody scans. Log or remove anything. |
| `MEMBER_CODE` | Scott | Log his own doses, supplements and meds. |

Pick long codes that are hard to guess, and make the two different. Click **Deploy** to apply them.

## 5. Turn on the reminder clock

**Workers & Pages → scott-protocol → Settings → Triggers → Cron Triggers → Add Cron Trigger**.
Enter `*/15 * * * *` and click **Add**. Every 15 minutes the worker checks whose reminder time just passed.

There are no push keys to create: the worker makes its own the first time someone turns reminders on,
and keeps them in the `scott-protocol` storage. Don't delete the `vapid` entry there, or every phone
has to turn reminders on again.

## 6. Check it

- Open `https://scott-protocol.rsemenov81.workers.dev/health` in a browser. It answers `{"ok":true,"version":"1.1.0"}`.
- Open the app link above and enter your `ADMIN_CODE`. The header shows **ADMIN**, and on a Monday the
  Protocol tab shows Testosterone Cypionate, Nandrolone Decanoate and Anavar.
- Load the supplement stacks: open the import link Roman was given (see *Supplement stacks* below). The
  **Meds** tab then lists the meds that are in his stacks; add any other daily med there.
- Send Scott the app link and his `MEMBER_CODE`. On iPhone he opens it in Safari, taps
  **Share → Add to Home Screen**, and it appears as **Scott** with a violet dot icon.
- Reminders: in the Home Screen app, tap the **bell** at the top, pick a morning and evening time, then
  **Turn on** and allow notifications. **Test** sends one straight away. On iPhone this only works from the
  Home Screen app, not from a Safari tab (an Apple rule).

## What is preloaded

The worker starts with this protocol the first time it runs. After that, edit it in the app with the pencil on each card.

| Compound | Dose | Days | Draw |
| --- | --- | --- | --- |
| Testosterone Cypionate | 75 mg | Monday, Friday | 250 mg/mL oil = 2.5 mg per unit, so 30 units (0.3 mL). 150 mg a week; a 10 mL vial lasts about 16 weeks. |
| Nandrolone Decanoate | 50 mg | Monday, Friday | 300 mg/mL oil = 3 mg per unit, so 16.7 units (0.17 mL). 100 mg a week; a 10 mL vial lasts 30 weeks. |
| HCG | 500 IU | Tuesday, Saturday | 10,000 IU vial + 2 mL BAC = 50 IU per unit, so 10 units (0.1 mL). 1,000 IU a week; one vial is 20 shots. |
| Anavar | 10 mg | Daily | Oral tablet, no syringe. Logs by amount. |

If the worker was already set up and opened before this protocol was added, it is still empty only until
someone saves something; paste the new `worker.js` and it loads this list on the next sync. Once anything has
been saved, add the compounds in the app instead.

## Supplement stacks

The **Supps** tab shows two stacks, **Morning stack** (10:00 AM) and **Night stack** (9:30 PM). Tap a stack to
see what is in it, and tap an item for how much to take, every ingredient with its amount, what it is for and
its benefits. Stacks are not logged: each stack gets one "time to take it" reminder a day at its time, on every
phone with reminders on. The times live in `STACKS` at the top of `worker.js`.

Scott's stack contents are deliberately **not** in this repository, because the repository is public and the
list includes prescriptions. Roman loads them once with an import link (`…/scott/#import=…`): open it, sign in
with the `ADMIN_CODE` if asked. Empty stacks load straight away; if the stacks already have items it asks
first, then replaces them. Injections and meds outside the stacks are left alone.
After that, edit or add items in the app (pencil → **Edit**, or **+ Add to … stack**).

## How reminders behave

- At the morning time, one notification lists every morning item (injection, supplement or med) that is
  due today and not yet logged. The same at the evening time for evening and nightly items.
- If everything is logged already, nothing is sent. As-needed items are never reminded about.
- "Remind again after" sends one more if something is still unlogged 30 or 60 minutes later.
- Times follow the phone's own time zone. Each phone keeps its own times; turning reminders off on one
  phone leaves the others alone.

## Codes and safety

- The codes live only in Cloudflare secrets, never in the code or the repo.
- To lock someone out, change their secret. Their phone asks for a code again on its next sync.
- The dose gate runs on the worker as well as in the app: an injection at 5× or more of the set dose is refused.
