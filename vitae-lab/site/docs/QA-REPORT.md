# QA report

Run 9 Nov 2026 against `vitae-lab/site/` served from a local static server.

## What this report covers, and what it does not

| Kind of evidence | Done? |
|---|---|
| Automated browser tests of the prototype (simulated cart, no store) | **Yes**, Chromium only |
| Accessibility scan and manual contrast calculation | **Yes** |
| Lab performance measurement | **Yes** (lab only; no field data exists) |
| Safari, iOS Safari, Firefox, Edge, Android Chrome on real engines or devices | **No.** Only Chromium is installed in this environment. |
| Screen reader pass (VoiceOver, NVDA, TalkBack) | **No** |
| Shopify theme, real cart, checkout, shipping, tax, discounts | **No.** Store not reachable; no products exist. |
| Test-mode payment | **No** |
| Supplier routing and fulfillment | **No** |
| A real paid order | **No**, and not authorized |

Everything about commerce below is a **simulated** test of the preview cart. There are no test-mode
orders and no verified real fulfillment.

## 1. Automated checks (`npm run e2e:vitae`, 13 of 13 pass)

Playwright's bundled Chromium (revision 1243), headless. Fonts are blocked in this run so it needs no network.

| # | Check | What it proves |
|---|---|---|
| 1 | No horizontal overflow at 320×568, 390×844, 768×1024, 844×390 (landscape) and 1440×900, on home and a product view; no console or page errors | Narrow mobile, tablet, desktop, portrait and landscape all fit |
| 2 | The opening rotates and the rotators, artwork and the next section do not move by a pixel | Space is reserved for the longest text |
| 3 | The product names in the opening equal the catalog, in order; the artwork on screen always belongs to the product named; only the visible product link is in the tab order | Correct artwork; no hidden focus stops |
| 4 | Retired copy is absent ("Explore collection", "Research-informed essentials", "Everyday, considered", the "Protein, creatine, vitamins and minerals…" paragraph); no button in the opening; the FDA disclaimer text is exact; no `aggregateRating`; `robots` is `noindex, nofollow` | The owner's removals hold; no fake ratings; staging stays out of search |
| 5 | In the real state nothing can be added to a cart: six disabled "Not on sale yet" buttons, and the product view says why | Unavailable-product state |
| 6 | Product view: focus moves to the heading, the title changes, label facts and quoted directions are present, the disclaimer is present, "All products" returns | Product details and focus order |
| 7 | Simulated cart: add from a story, increase quantity (focus stays in the dialog), subtotal says prices are not set, checkout says no order was placed and nothing was charged, Escape closes, the cart survives a reload, product-page quantity adds to the existing line, remove empties the cart and hides the footer | Cart add, quantity, persistence, removal, honest handoff |
| 8 | Forced cart failure: an alert is shown, the count does not change, a retry succeeds and clears the alert | Error state and recovery |
| 9 | Motion on: the loop starts only after page load, is muted, looped and inline, the 640 px file is chosen on a phone; Pause stops it, lists every goal and product, is remembered after reload, and the video is not fetched again | Pause control; no content lost; one loop only |
| 10 | `prefers-reduced-motion`: no video request at all, poster shown, all goals and products listed, button offers "Play motion" | Reduced motion |
| 11 | Save-Data: no video request, poster shown, six stories render | Data saving |
| 12 | Video blocked at the network: poster stays, page works, no errors | Unavailable video |
| 12b | A browser with no H.264 decoder gets the WebM loop, and only one file is requested | The first CI run failed here: GitHub's Chromium cannot play MP4. Fixed by shipping a VP9 copy. |
| 13 | Keyboard: first Tab lands on "Skip to content"; Enter opens the menu; Enter opens the cart; Escape closes it and focus returns to the cart button | Keyboard-only use of menu and dialog |

(Checks 2 and 3 are one test; with 12b that makes 13 tests.)

Bugs this run caught and fixed: ripple rings widened the page by 27 px at 320 px; the cart footer
ignored `hidden`; rotating words re-triggered "largest contentful paint" every few seconds; the opening
jumped when the script drew the artwork; cross-fading words overlapped mid-change.

## 2. Accessibility (target WCAG 2.2 AA)

axe-core, rules `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`, with web fonts loaded:

| State | Violations | Rules passed | Flagged for manual review |
|---|---|---|---|
| Home, 390 px | 0 | 53 | Contrast over the video (axe cannot sample it) |
| Home, 1440 px | 0 | 52 | same |
| Home, reduced motion | 0 | 53 | same |
| Product view | 0 | 46 | same; "−" and "+" quantity buttons (labelled "Decrease / Increase quantity") |
| Cart open with a line | 0 | 22 | same |
| Menu open and an FAQ open | 0 | 53 | same |

Manual contrast, because the tool cannot judge text over moving imagery. The encode caps the brightest
water pixel at sRGB 0.58, and the veil is never lighter than 50% where text sits:

| Pair | Ratio | Needs |
|---|---|---|
| Stock text on the brightest possible pixel under the lightest veil | 6.6:1 | 4.5:1 |
| Secondary (80%) text, same worst case | 4.9:1 | 4.5:1 |
| Stock text on the average scene | above 11:1 | 4.5:1 |
| Ink on stock (cart) | 14.0:1 | 4.5:1 |
| Secondary ink on stock (cart) | 5.1:1 | 4.5:1 |
| Teal focus ring and underline on the dark ground | 7.3:1 | 3:1 |
| Teal on stock | 2.2:1 | Not used for text or focus on stock; the cart's focus ring is ink |

Known limit: a block that is scrolling into view starts at 62% opacity for a fraction of a second.
Against a worst-case bright pixel that is 3.7:1 until it settles. It is off under reduced motion and
when motion is paused.

Other manual checks done in Chromium: 200% root font size at 390 px (header wraps to more rows, nothing
clipped or overlapped: `qa/12-mobile-menu-200pct-text.jpg`); buttons and header controls are 44 px tall or more, and inline
text links are at least 32 px (WCAG 2.2 asks for 24); one `h1` per view; landmarks `header`, `nav`, `main`, `footer`; the comparison table
has a caption and scoped headers and scrolls inside its own focusable region; the artwork is one image
with a text alternative per product; no scroll hijacking, no horizontal scrolling of the page, no
flashing; nothing animates on its own except the water loop, the rotators and the ripple rings, and one
button stops all three.

**Not checked:** real screen readers, voice control, Windows high-contrast mode, focus order by a human
tester, Safari's handling of `zoom`, `overflow: clip`, `<dialog>` and scroll timelines (all are in
current Safari, but I did not run it).

## 3. Performance (lab, not field)

Method: Playwright Chromium, three cold loads each, `PerformanceObserver` for LCP, layout shift and
event timing. Mobile profile: 390×844, CPU slowed 4×, network 1.6 Mbit/s down, 750 kbit/s up, 150 ms
latency. Desktop profile: 1440×900, no throttling. Server is on the same machine, so server time is
near zero; real hosting adds to these numbers.

| Metric | Target | Mobile, throttled | Desktop |
|---|---|---|---|
| LCP | ≤ 2.5 s | 0.87 – 0.90 s (the first goal word) | 0.46 – 0.47 s |
| CLS | ≤ 0.1 | 0.005 | 0.003 |
| Interaction latency (INP stand-in) | ≤ 200 ms | 40 – 112 ms per control in a dedicated pass; in the mixed runs the worst was 128, 136 and 208 ms | 32 – 40 ms; one 440 ms outlier in three mixed runs, not reproduced |
| Transfer, whole page | — | 424 – 432 KB | 701 – 710 KB |
| Requests | — | 14 | 14 |

Before the fixes in section 1 the same runs gave LCP 9.0 s and CLS 0.159 on mobile.

There is **no field data**: the site has no visitors. These are prelaunch diagnostics. Shopify adds its
own scripts and theme code, so they must be re-measured on the real theme.

Media budget in use:

| Asset | Budget | Actual |
|---|---|---|
| Poster (blocks nothing; preloaded) | ≤ 60 KB | 20 KB |
| Loop, phone | ≤ 400 KB | 195 KB |
| Loop, desktop | ≤ 1 MB | 479 KB |
| HTML + CSS + JS + data, gzipped | ≤ 60 KB | 23 KB |
| Loops downloading at once | 1 | 1; fetched only after `load`, never under reduced motion or Save-Data, paused when the tab is hidden |

Console errors: none. Failed requests: none.

## 4. SEO basics

| Item | Prototype | At launch (Shopify) |
|---|---|---|
| Unique titles | Home and per-product titles set | Shopify `page_title` per template |
| Descriptions | Home description written | Product summary sentence as SEO description |
| Canonical, sitemap, robots.txt | Not applicable to a noindex preview | Generated by Shopify; verify after publish |
| Staging out of search | `noindex, nofollow` (tested) | Store password stays on until approval |
| Social preview | `og:` title, description, image present | Add a 1200×630 image from the approved plate |
| Image alt text | Artwork has text alternatives; decorative scene is hidden from assistive tech | Alt text on every packshot |
| Product structured data | **Not added.** A valid Product entry needs a real price and availability. | Shopify's `structured_data` filter once prices exist. No ratings. |
| Analytics and consent | None | Only within the approved privacy setup; not approved yet |

## 5. Screenshots (`docs/qa/`)

`01-desktop-opening` · `02-desktop-story` · `03-desktop-research` · `04-desktop-product` ·
`05-mobile-opening` · `06-mobile-story` · `07-mobile-product-buy` · `08-mobile-cart` (simulated, showing
the honest checkout message) · `09-mobile-reduced-motion` · `10-tablet-compare` · `11-mobile-landscape` ·
`12-mobile-menu-200pct-text`. Taken in Chromium at 2× with web fonts loaded.
