# Vitae Lab storefront prototype (v3)

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

## The idea: one morning on the mountain, filmed

v2 put still jar cut-outs on a filmed ledge. The owner's verdict was that it copied the draft and did not
move. v3 films the products.

1. **Arrival.** The opening is a flight through mist down to the terraces. "Your goals" rotates four
   words; "Your solution" rotates the six product names, and the jar for the name on screen stands below
   it and leans a few degrees toward the pointer.
2. **Mist.** The reading sections are plain warm paper. Each filmed stage dissolves into it.
3. **Six product films.** Each product is a title card: the real jar on a stone ledge, the camera arcing
   around it with real parallax, mist passing in front and behind, light moving over the label. The words
   sit on the shadowed side of the valley. The hour runs from dawn (creatine) to dusk (magnesium).
4. **What's inside.** Two slow-motion material films, powder pouring and a softgel beside a capsule,
   above the comparison table. A drop of water on slate carries the labels heading.
5. **After dark.** The footer.

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
| `media/` | Eleven filmed loops (MP4 + WebM), their posters, six jar cut-outs, logo masks. See the asset manifest. |
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

- **Stage.** A filmed plate: poster image first, then one muted loop faded in on top. An
  IntersectionObserver picks the stage with the most pixels on screen; only that one's video has a source
  and plays. Loops start after page load, never under reduced motion or Save-Data, and stop when the tab
  is hidden. Loops are 250 to 900 KB; the opening flight is 1.2 MB.
- **Product film.** `media/jar-<handle>.mp4`: generated from a first frame that is the real jar on the
  ledge, then every frame has the exact label re-applied (see the asset manifest for the method and its
  limits). The poster is that first frame.
- **Product frame.** Film + words. On wide screens the words sit right of the jar over a dark wash; on
  phones they sit on paper under the film. The hour of day is a CSS filter (`data-time`).
- **Jar cut-out.** `media/pack-<handle>.webp`, used in the opening under the rotating name. It tilts up
  to 7 degrees toward the pointer (not on touch, not when motion is paused).
- **Scroll-linked motion.** Text blocks rise 16 px as they arrive. Nothing is dimmed, hidden or pinned,
  and scrolling is never taken over.
- **Rotators.** All items share one grid cell, so the longest reserves the space. Goals and products run
  on different intervals so no goal is paired with a product. With motion off, all words and names list.
- **Motion control.** "Pause motion" stops every loop, the rotators and the scroll-linked motion, and is
  remembered.
- **Cart.** Native `<dialog>`. `local` adapter for the preview (never takes an order); `shopify` adapter
  for the Ajax Cart API, written but not yet run against the store.
- **Preview-only parts.** `.preview` bar, `.preview-note` blocks, the "simulate products on sale" switch.

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
