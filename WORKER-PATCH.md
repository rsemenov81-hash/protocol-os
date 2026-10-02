# Cloudflare worker patch — schedule rules

The deployed `protocol-sync` worker is newer than `protocol-sync-worker.js` in this repo, so do **not** replace the whole file. Add the block below and point the "scheduled today" logic at it.

## What it fixes

Without it Claude's tools (`get_today`, `get_adherence`, `get_protocol`) only read `schedule.days`, so they

- count an **every-other-day** compound as due on every weekday it hit this week,
- keep counting a compound after **Finish cycle** (the app flips it inactive the next day, so this is a one-day lag),
- ignore **dated plan changes** when scoring adherence for past days.

The app mirrors today's plan into the old fields, so `get_today` stays right either way. This patch makes the history scoring right too.

## Step 1 — paste the block

Cloudflare dashboard → **Workers & Pages → protocol-sync → Edit code**. Scroll to the very **end** of the file and paste everything between `SCHEDULE-RULES-BEGIN` and `SCHEDULE-RULES-END` from `protocol-sync-worker.js` (the whole `const SCHED = (() => { … })();` block). It defines a single name, `SCHED`, so it cannot collide with anything already there, and it is fine at the end of the file.

## Step 2 — use it

Wherever the worker decides whether a protocol is scheduled on a day, replace the `days.includes(...)` test with the one call:

```js
// today's scheduled list (get_today)
const scheduled = SCHED.scheduledOn(state.protocols || [], today);

// adherence: expected doses for a past day `dk` ('YYYY-MM-DD')
const expectedOn = SCHED.scheduledOn(state.protocols || [], dk);
```

Pass the **unfiltered** `state.protocols` (not the `active !== false` subset): `scheduledOn` applies start/end dates and dated revisions itself, so a cycle finished on Sep 28 still counts as expected on Sep 10.

Optional, for nicer `get_protocol` output: `SCHED.schedLabel(p.schedule)` returns "Every other day" / "Daily" / "Mon/Wed/Fri".

`SCHED.todayIn("America/New_York")` gives the local calendar day if the worker does not already compute it.

## Step 3 — Deploy

Click **Deploy** (top right). Then, in Claude, run `get_today` once and check the list matches the app.
