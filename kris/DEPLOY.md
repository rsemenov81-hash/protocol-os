# Kris Protocol — one-time setup

The app is `kris/index.html`. GitHub Pages serves it at
**https://rsemenov81-hash.github.io/protocol-os/kris/** once this branch is merged to `main`.

It talks to its own Cloudflare Worker, `kris-protocol`, at `https://kris-protocol.rsemenov81.workers.dev`.
That worker does not exist yet. These steps create it. It takes about five minutes, all in the
Cloudflare dashboard in Chrome.

## 1. Create the storage

Dashboard → **Storage & Databases → KV → Create a namespace**. Name it `kris-protocol`, then click **Add**.

## 2. Create the worker

1. Dashboard → **Workers & Pages → Create → Create Worker** (the "Hello World" starter).
2. Name it exactly **`kris-protocol`**. The name sets the address the app calls.
3. Click **Deploy**, then **Edit code**.
4. Open `kris/worker.js` on GitHub, click the **copy** icon at the top of the file.
5. Back in the editor, click inside the code, press **Cmd + A**, then **Cmd + V**, then **Deploy**.

## 3. Connect the storage

**Workers & Pages → kris-protocol → Settings → Bindings → Add → KV namespace**.

- Variable name: **`KRIS_KV`** (exactly this).
- KV namespace: `kris-protocol`.

Save. Cloudflare redeploys the worker.

## 4. Set the two access codes

**Workers & Pages → kris-protocol → Settings → Variables and Secrets → Add**, twice, both of type *Secret*:

| Name | Who uses it | What it allows |
| --- | --- | --- |
| `ADMIN_CODE` | You | Edit compounds, blood panels and InBody scans. Log or remove any dose. |
| `MEMBER_CODE` | Kris | Log his own doses. |

Pick long codes that are hard to guess, and make the two different. Click **Deploy** to apply them.

## 5. Check it

- Open `https://kris-protocol.rsemenov81.workers.dev/health` in a browser. It answers `{"ok":true,"version":"1.0.0"}`.
- Open the app link above and enter your `ADMIN_CODE`. The header shows **ADMIN**, and on a Saturday the
  Today tab shows Retatrutide, HCG, Nandrolone and KLOW.
- Send Kris the app link and his `MEMBER_CODE`. On iPhone he opens it in Safari, taps **Share → Add to Home Screen**,
  and it appears as **Kris** with a blue dot icon.

## What is preloaded

The worker starts with this protocol the first time it runs. After that, edit it in the app with the pencil on each card.

| Compound | Dose | Days | Draw |
| --- | --- | --- | --- |
| Retatrutide | 2 mg | Saturday | 10 mg vial + 2 mL BAC = 50 mcg per unit, so 40 units (0.4 mL). One vial lasts 5 weeks. |
| HCG | 250 IU | Tuesday, Saturday | Logged by IU. Add the vial size and water in the app to get syringe units. |
| KLOW | 2.67 mg | Daily, evening | 80 mg in a 3 mL pen cartridge = 26.7 mg/mL, so 10 units (0.1 mL). One cartridge lasts 30 days. |
| Nandrolone | 100 mg | Saturday | Logged by mg. Add the strength (mg/mL) in the app to get syringe units. |

## Codes and safety

- The codes live only in Cloudflare secrets, never in the code or the repo.
- To lock someone out, change their secret. Their phone asks for a code again on its next sync.
- The dose gate runs on the worker as well as in the app: a dose at 5× or more of the set dose is refused.
