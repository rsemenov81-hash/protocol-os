# Vitae Lab storefront prototype (v5, "The Scoop")

> **v5 note, "The Scoop" (11 Nov 2026).** The homepage was rebuilt on a new concept the owner approved: a bright studio, and one short film per serving that scrolling plays forward and back (`.scrub` sections, `placeFrames` in `site.js`). The fixed mountain scene, the goal themes and the home research section are gone; research stays on product pages. Sections now: opening, five film chapters (the two wheys share the shaker film), comparison table, "How muscle is built", questions. Everything below this note describes v4 and is kept for history where it differs. Product pages still open on the older mountain jar films.

Status on 10 Nov 2026: **prototype complete. Storefront not implemented in Shopify. Not launch-ready.**

v2 is a rebuild on top of the owner's own draft
(`https://vitae-lab-storefront-review.rsemenov81.chatgpt.site/`), not a replacement for it. It keeps that
draft's world (warm mist, pale terraces, alpine stone), its six label visualizations and its palette, and
changes three things: the design, the filmed motion, and the writing. The first version of this folder
(dark river stones, drawn jars) is gone.

Private preview: https://claude.ai/artifact/7vj3FS7Ypi37Ntbr4mhyWr

Supporting documents are in `docs/`: `SOURCE-MANIFEST.md` (sources, assets, Higgsfield jobs and cost),
`COPY-DECK.md`, `CLAIMS-REGISTER.md`, `QA-REPORT.md` (+ `qa/` screenshots), `LAUNCH-CHECKLIST.md`,
`SHOPIFY.md`.

## The idea: one place, one scroll

The owner's notes on v3: the mountain scenes, cream sections and repeated product films broke the page
into pieces; the writing was defensive; the homepage was long; one line contradicted the chocolate page;
and the artwork disclosure was too prominent. v4 answers each.

1. **One scene.** The terraces at first light stay fixed behind the whole page. Nothing has its own
   background; only a veil deepens as you leave the opening so text stays readable.
2. **Jars that come to you.** Each product is a frame taller than the screen. Its contents pin, and
   scrolling moves the jar from far and low to close and level, turning slightly, the way Apple's product
   pages do. It is plain scrolling: nothing is captured or delayed, and with motion paused or reduced the
   frames are ordinary static sections. On phones the jar scales in normal flow without pinning.
3. **Short homepage.** Opening, the comparison table (differences up front), six product frames, goals,
   research folded into six expandable notes, questions. The water stage, material films, quality and
   about sections are gone or reduced to a line.
4. **Product films live on product pages**, one per product, where the full research notes also sit.

## What exists, and which build is canonical

| Thing | Where | State on 10 Nov 2026 | Opened this session? |
|---|---|---|---|
| Owner's current draft | `vitae-lab-storefront-review.rsemenov81.chatgpt.site` | **Canonical draft.** Static page, one 8 s hero loop, six pack images with hand-drawn cut-out paths. | Yes; fully downloaded and studied |
| This prototype (v2) | `vitae-lab/site/` on branch `claude/nice-mccarthy-5a6lgl` | Built from that draft's assets plus four new Higgsfield shots | Yes |
| Latest local source | `Vitae-Lab-Higgsfield` on Roman's Mac | Presumably the source of the draft above | No |
| Shopify draft theme `186959724767` and live store `wh7315-e9` | Shopify | Store is behind the "Opening soon" password page; live theme is Horizon 4.4.0 | Password page only; connector needs sign-in |
| `vitae-lab.pages.dev` | Cloudflare Pages | Older peptide-clinic page. Not the supplement store. | Yes |
| Ledger label system | `vitae-lab/labels/` | Identity reference; its quantities are old placeholders | Yes |

## Run it

No build step and no dependencies.

```
python3 -m http.server 4173        # from the repo root
open http://127.0.0.1:4173/vitae-lab/site/
npm ci && npx playwright install chromium && npm run e2e:vitae     # 13 checks
```

## Keeping it private

- **Private preview:** the Claude artifact above. Only the owner can open it.
- **GitHub Pages serves `main`.** Merging this branch publishes the prototype at
  `rsemenov81-hash.github.io/protocol-os/vitae-lab/site/`. It is `noindex, nofollow` and carries a
  "Private preview" bar, but the URL would be public. The pull request stays a draft for that reason.
- **Shopify:** not deployed. See `docs/SHOPIFY.md`.

## Files

| File | Role |
|---|---|
| `index.html` | All static copy and structure. One page; product views open on a plain `#handle`. |
| `site.css` | Tokens, stages, mist sections, product frames, cart. |
| `site.js` | Renders products and research from data, rotators, one-loop-at-a-time video, hash views, cart. No dependencies. |
| `products.js` | Product facts and research notes. The only place a product fact is written. |
| `media/` | The scene loop (wide and tall), six product films, their posters, six jar cut-outs, logo masks. See the asset manifest. |
| `../../tests/vitae-site-e2e.mjs` | The checks. |

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--paper`, `--paper-light` | `#F1EDE4`, `#F8F5EF` | Page ground (the mist); header and cart |
| `--ink` | `#14231D` | Text; buttons; footer ground |
| `--muted` | `#4F5B54` | Secondary text on paper (6.3:1) |
| `--rule`, `--hair` | `#C9C3B6`, ink at 18% | Hairlines |
| `--teal`, `--teal-deep` | `#2DB5A1`, `#147A6C` | Helix in the logo; link underline and focus ring on paper use the deeper tone |
| Product accents | On the label artwork itself | Not repeated in the page chrome |

Type: Newsreader (roman for names and headings, italic for the rotating goal word), IBM Plex Sans for
body, IBM Plex Mono for facts and notes. All SIL Open Font License, from Google Fonts, `display=swap`,
with system fallbacks. The owner's draft fell back to system serifs; loading Newsreader makes the page
match the labels.

## Component notes

- **Scene.** `.scene`, fixed, with `media/world.*` (wide) or `world-tall.*` (phones): poster first, loop
  after load, never under reduced motion or Save-Data.
- **Frame.** `#stories .frame`. `site.js` sets `--p` (0 to 1) from the frame's position on each scroll
  frame; CSS turns it into the jar's translate, scale and turn. Pinned only at 52rem wide and 40rem tall
  or more, and only with motion on.
- **Jar.** `media/pack-<handle>.webp`, the owner's label visualization cut out with the owner's own
  outline paths. No model touched these.
- **Product film.** `media/jar-<handle>.*` on the product page only; see the asset manifest for how the
  label was re-applied to every frame.
- **Research.** One `<details>` per note on the homepage; expanded in full on each product page.
- **Rotators, motion control, cart, preview-only parts:** as before.

## Proposed shopping navigation

The removed "Explore collection" hero button, the old quote and the retired copy are not restored (a test
fails if they return). Shopping is reached from "Products" in the header and the always-visible cart
button; from each rotating product name; from the product names under each goal and in the comparison
table; and from "Read the label" and the buy button in every product frame.

## Rollback

Nothing live was changed.

- **This branch:** close the draft pull request or `git revert`. The change is one folder, one test, and
  one line each in `package.json` and `ci.yml`.
- **Artifact:** delete it from claude.ai.
- **Environment:** seven hosts were added to the `protocol-os` cloud environment's allowlist during this
  work: `vitae-lab.pages.dev`, `d8j0ntlcm91z4.cloudfront.net`, `supliful.com`, `wh7315-e9.myshopify.com`,
  `cdn.shopify.com`, `vitae-lab-storefront-review.rsemenov81.chatgpt.site`,
  `d3u0tzju9qaucj.cloudfront.net`. Remove any you don't want kept.
- **Higgsfield:** thirteen generations were charged, about $38.83 by the published rate (see the manifest). That spend cannot be undone; the
  outputs are deleted from Higgsfield automatically after seven days and are kept here in `media/`.
- **Shopify, at launch:** publish is a theme switch; rollback is re-publishing Horizon.
