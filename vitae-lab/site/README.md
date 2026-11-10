# Vitae Lab storefront prototype

Status on 9 Nov 2026: **prototype complete. Storefront not implemented in Shopify. Not launch-ready.**

This folder is a working, tested static prototype of the Vitae Lab storefront: one continuous water
scene, the centered "Your goals / Your solution" opening, six product stories, label comparison,
research notes, About, FAQ, product views and a preview cart. It was built from the handoff brief of
9 Nov 2026 because the latest site source could not be reached (see "What exists" below). It does not
replace that source. It sits beside the Ledger label system in `vitae-lab/labels/` and changes nothing
there.

Supporting documents are in `docs/`:

| File | What it is |
|---|---|
| `docs/SOURCE-MANIFEST.md` | Every source, asset, product record and deployment, with owner, freshness and approval status. Asset manifest and the Higgsfield shot list with real cost estimates. |
| `docs/COPY-DECK.md` | Before and after copy for every visible string, with the purpose of each section. |
| `docs/CLAIMS-REGISTER.md` | Product facts and every claim, with evidence, limits, source and approval status. |
| `docs/QA-REPORT.md` | What was tested, how, and what was not. Screenshots in `docs/qa/`. |
| `docs/LAUNCH-CHECKLIST.md` | Passed / Failed / Unverified for every launch gate, the blocker list, the decisions needed and the rollback plan. |
| `docs/SHOPIFY.md` | How this maps onto the Shopify theme, what Shopify must own, and the names of any settings needed. |

## What exists, and which build is canonical

| Thing | Where | State on 9 Nov 2026 | Could I open it? |
|---|---|---|---|
| Latest site source with the water and hero edits | `/Users/romansemenov/Documents/Codex/Vitae-Lab-Higgsfield` on Roman's Mac | **Canonical by the handoff's account.** Not in any repository I can reach. | No. The Mac offers only a "Desktop" folder to Remote Control, and not to cloud sessions. |
| Shopify theme "Water Cinematic Draft" (id 186959724767) | store `wh7315-e9` | Unpublished draft with a static poster. Horizon is the live theme. | No. The Shopify connector needs to be signed in again. |
| Live storefront | `wh7315-e9.myshopify.com` | Horizon theme, no products published (per handoff). | No (same reason; also outside the network allowlist). |
| `vitae-lab.pages.dev` | Cloudflare Pages | An **older peptide-clinic landing page** (Manrope type, molecular film, "COA-tested peptides", DMV delivery). It is a visual reference only. None of its copy or claims belong on the supplement store. | Yes. |
| Ledger label system | `vitae-lab/labels/` in this repo, commit `c51d68f` | Identity reference. Its quantities are old placeholders and are not used here. | Yes. |
| This prototype | `vitae-lab/site/` on branch `claude/nice-mccarthy-5a6lgl` (base `f4bd5bc`) | New. Tested in Chromium. | Yes. |

So there are three different things: a **visual prototype** (this folder), a **Shopify implementation**
(the unpublished draft theme, which I could not inspect) and the **live storefront** (Horizon, nothing on
sale). Nothing in this branch touches the second or third.

To reconcile: push the Mac folder to a branch of this repo (without `.env` files or credentials) and I
will diff it against this prototype and merge whichever parts are newer. Until then, treat the Mac
folder as the owner of the hero and water edits and this folder as a proposal.

## Run it

No build step and no dependencies. Any static file server works:

```
python3 -m http.server 4173        # from the repo root
open http://127.0.0.1:4173/vitae-lab/site/
```

Tests (Chromium, all local, no network):

```
npm ci
npx playwright install chromium     # CI already does this
npm run e2e:vitae                   # 12 checks; screenshots land in .playwright/vitae-site/
```

`npm run ci` and `.github/workflows/ci.yml` now include `e2e:vitae`.

## Deployment, and keeping it private

- **Private preview:** a private Claude artifact (link in the pull request). Only the owner can open it.
- **GitHub Pages:** this repo's Pages site serves `main`. **Merging this branch publishes the prototype at
  `rsemenov81-hash.github.io/protocol-os/vitae-lab/site/`.** The page carries `noindex, nofollow` and a
  "Private preview" bar, but the URL would be public. Keep the pull request as a draft until that is
  acceptable, or move the folder out of the Pages tree first.
- **Shopify:** not deployed. See `docs/SHOPIFY.md`.

## Files

| File | Role |
|---|---|
| `index.html` | All static copy and structure. One page; product views are opened by a plain `#handle`. |
| `site.css` | Tokens, scene, layout, the Ledger label drawing, cart. |
| `site.js` | Renders products and research from data, rotators, motion control, hash views, cart. No dependencies. |
| `products.js` | Product facts and research notes. The only place a product fact is written. |
| `media/` | Water loop (two sizes), poster, logo masks. See the asset manifest. |
| `../../tests/vitae-site-e2e.mjs` | The checks. |

## Design tokens

All colour and type tokens are the Ledger label tokens, declared once at the top of `site.css`.

| Token | Value | Use |
|---|---|---|
| `--stock` | `#F1EDE4` | Text on water; cart sheet; label stock |
| `--ink` | `#14231D` | Text on stock; label ink |
| `--ink60` | `#5E6661` | Secondary text on stock |
| `--rule` | `#C9C3B6` | Hairlines on stock |
| `--teal` | `#2DB5A1` | Helix in the logo, focus ring, link underline. Never text on stock (2.2:1). |
| `--surface`, `--page` | `#D9D5CC`, `#E7E3DA` | Reserved; not used on the water pages |
| `--deep` | `#0B1512` | **Derived**, one step darker than ink: the deepest water, header and footer ground |
| `--dim`, `--hair` | stock at 80% and 22% | Secondary text and hairlines over water |
| Product accents | creatine `#4B6480`, vanilla whey `#B8923D`, collagen `#6E8A6A`, magnesium `#4E3A5A`, D3 `#C65A2E` | Label chip and cap disc only |
| Chocolate accent | `#5E6661` (neutral) | **Provisional.** The corrected chocolate proof was not available, so no accent was invented. |

Type: Newsreader 400 (names, headings, rotators), IBM Plex Sans 400/500 (body, buttons), IBM Plex Mono
400/500 (facts, labels, notes). All three are SIL Open Font License families served from Google Fonts
with `display=swap` and system fallbacks. Scale: rotator `clamp(2.9rem, 11vw, 6.5rem)`, h2
`clamp(1.9rem, 5vw, 3.1rem)`, body `1.0625rem/1.6`, facts `.875rem` mono.

Spacing: one section rhythm, `--section: clamp(4.5rem, 12vw, 9rem)`. Gutter 20 px minimum with
safe-area insets. Breakpoint at `52rem`; everything below is one column.

## Component notes

- **Scene.** One `position: fixed` layer behind the whole page: poster image, then a single muted loop
  on top, then a veil. The veil deepens with scroll (CSS `animation-timeline: scroll()`), so the water
  reads as getting deeper as you go down. Browsers without scroll timelines get a fixed veil. Text
  contrast is guaranteed by the veil and by a highlight roll-off baked into the encode, not by boxes.
- **Rotators.** Every item sits in the same grid cell, so the longest one reserves the space and nothing
  shifts. Goals and products rotate on different intervals (2.9 s and 3.7 s) so a goal is never shown as
  paired with a product. Rotation stops on hover and focus. With motion off, all four goals and all six
  product names are listed.
- **Pack art.** The Ledger front label is drawn in HTML and CSS on an illustrative tub or bottle, using
  the corrected working facts. It is a stand-in for approved packshots: swap `packHTML()` for an `<img>`
  per product when those exist. Each drawing is one `role="img"` with a text alternative; the same facts
  are real text beside it.
- **Facts.** Ruled mono rows directly on the water. No cards, no boxes under products.
- **Motion control.** "Pause motion" in the header stops the loop, the rotators and the ripple rings and
  is remembered. `prefers-reduced-motion` and Save-Data visitors never download the video.
- **Product view.** Name, summary, price and buy controls first; then serving facts, who might consider
  it, directions, ingredients, allergens and warnings, evidence and limits, and the FDA disclaimer.
- **Cart.** A native `<dialog>` drawn as a sheet of label stock. Two adapters behind one interface:
  `local` (this preview; never takes an order) and `shopify` (Ajax Cart API and Shopify checkout; written
  but not yet run against the store).
- **Preview-only parts.** `.preview` bar, `.preview-note` blocks and the "simulate products on sale"
  switch. Delete all three at launch.

## Proposed shopping navigation

The removed "Explore collection" hero button, the old quote and the retired copy are not restored (a
test fails if they come back). Shopping is reached four ways instead, proposed here for approval:

1. "Products" in the header, and a cart button that is always visible.
2. Each rotating product name in the opening is a link to that product.
3. Product names under each goal, in "The range", and in the comparison table are links.
4. "Read the label" and the buy button on every product story.

## Rollback

Nothing live was changed, so there is nothing to roll back in production.

- **This branch:** close the draft pull request, or `git revert` the commit. The change is additive:
  one new folder, one new test, one line each in `package.json` and `ci.yml`.
- **Artifact preview:** delete the artifact from claude.ai; the link stops working.
- **Environment:** three hosts were added to the `protocol-os` cloud environment's network allowlist for
  this work (`vitae-lab.pages.dev`, `d8j0ntlcm91z4.cloudfront.net`, `supliful.com`). Remove them in the
  environment settings if they are not wanted.
- **Shopify, at launch:** publish is a theme switch. Rolling back is re-publishing Horizon from
  Online Store → Themes; keep Horizon untouched and duplicate the draft before each edit.
