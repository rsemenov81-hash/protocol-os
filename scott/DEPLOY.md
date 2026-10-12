# Scott Protocol — one-time setup

The app is `scott/index.html`. GitHub Pages serves it at
**https://rsemenov81-hash.github.io/protocol-os/scott/** once this branch is merged to `main`.

It talks to its own Cloudflare Worker, `scott-protocol`, at `https://scott-protocol.rsemenov81.workers.dev`.
That worker does not exist yet. These steps create it. It takes about five minutes, all in the
Cloudflare dashboard in Chrome.

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

- Open `https://scott-protocol.rsemenov81.workers.dev/health` in a browser. It answers `{"ok":true,"version":"1.0.0"}`.
- Open the app link above and enter your `ADMIN_CODE`. The header shows **ADMIN**. The protocol starts
  empty: add injections on **Protocol**, supplements on **Supps**, medications on **Meds**.
- Send Scott the app link and his `MEMBER_CODE`. On iPhone he opens it in Safari, taps
  **Share → Add to Home Screen**, and it appears as **Scott** with a violet dot icon.
- Reminders: in the Home Screen app, tap the **bell** at the top, pick a morning and evening time, then
  **Turn on** and allow notifications. **Test** sends one straight away. On iPhone this only works from the
  Home Screen app, not from a Safari tab (an Apple rule).

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
