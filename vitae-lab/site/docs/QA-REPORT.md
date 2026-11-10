# QA report

Run 10 Nov 2026 against v2 of `vitae-lab/site/` served from a local static server.

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
| 2 | The opening rotates and the rotators, jars and the next section do not move by a pixel | Space is reserved for the longest text |
| 3 | The product names in the opening equal the catalog, in order; the jar on screen always belongs to the product named; every jar image loads and has a text alternative; only the visible product link is in the tab order | Correct artwork; no hidden focus stops |
| 4 | Retired copy is absent ("Explore collection", "Research-informed essentials", "Everyday, considered", the "Protein, creatine, vitamins and minerals…" paragraph); no button in the opening; the FDA disclaimer text is exact; no `aggregateRating`; `robots` is `noindex, nofollow` | The owner's removals hold; no fake ratings; staging stays out of search |
| 5 | In the real state nothing can be added to a cart: six disabled "Not on sale yet" buttons, and the product view says why | Unavailable-product state |
| 6 | Product view: focus moves to the heading, the title changes, label facts and quoted directions are present, the disclaimer is present, "All products" returns | Product details and focus order |
| 7 | Simulated cart: add from a story, increase quantity (focus stays in the dialog), subtotal says prices are not set, checkout says no order was placed and nothing was charged, Escape closes, the cart survives a reload, product-page quantity adds to the existing line, remove empties the cart and hides the footer | Cart add, quantity, persistence, removal, honest handoff |
| 8 | Forced cart failure: an alert is shown, the count does not change, a retry succeeds and clears the alert | Error state and recovery |
| 9 | Motion on: the opening loop starts only after page load, is muted, looped and inline, and the tall file is chosen on a phone. Scrolling to a product frame plays the ledge loop and pauses the opening; scrolling back reverses it; **never more than one video plays**. Pause stops everything, lists every goal and product, is remembered after reload, and nothing is fetched again | Pause control; no content lost; one loop at a time |
| 10 | `prefers-reduced-motion`: no video request at all, poster shown, all goals and products listed, button offers "Play motion" | Reduced motion |
| 11 | Save-Data: no video request, poster shown, six stories render | Data saving |
| 12 | Video blocked at the network: poster stays, page works, no errors | Unavailable video |
| 12b | A browser with no H.264 decoder gets the WebM loop, and only one file is requested | GitHub's CI Chromium cannot play MP4 |
| 13 | Keyboard: first Tab lands on "Skip to content"; Enter opens the menu; Enter opens the cart; Escape closes it and focus returns to the cart button | Keyboard-only use of menu and dialog |

(Checks 2 and 3 are one test; with 12b that makes 13 tests.)

## 2. Accessibility (target WCAG 2.2 AA)

axe-core, rules `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`, web fonts loaded:

| State | Violations | Rules passed |
|---|---|---|
| Home, 390 px | 0 | 55 |
| Home, 1440 px | 0 | 54 |
| Product view, 390 px | 0 | 48 |
| Product view, 1440 px | 0 | 48 |

Two findings from the first v2 pass were fixed: text was dimmed while scrolling in (the scroll effect now
moves position only), and one section label was duplicated.

axe cannot judge text over footage, so that was measured directly: each text block was hidden, the pixels
behind it captured at three moments of the loop, and the **worst single pixel** compared with the text
colour.

| Text | 1440 px | 390 px | Needs |
|---|---|---|---|
| Rotating goal word (large) | 8.7:1 | 7.9:1 | 3:1 |
| Rotating product name (large, 27 px or more) | 6.8:1 | 3.9:1 | 3:1 |
| "Your goals" / "Your solution" labels | 8.0:1 | 10.4:1 | 4.5:1 |
| Product frame text, six frames | 8.1 to 9.6:1 | 14.0:1 (on paper) | 4.5:1 |
| Water stage heading and paragraph | 6.1 and 5.4:1 | 9.4 and 9.0:1 | 4.5:1 |
| Secondary text on paper | 6.1:1 | same | 4.5:1 |
| Link underline and focus ring (deep teal on paper) | 4.5:1 | same | 3:1 |

Also checked in Chromium: one `h1` per view; landmarks; table caption and scoped headers in its own
scrolling region; each jar has a text alternative that reads its label; buttons 44 px or taller; no
scroll hijacking, no horizontal scroll, no flashing; one button stops every moving thing.

**Not re-run for v2:** the 200% text-size check and the cart, menu-open and reduced-motion axe states
(they passed on v1 and their markup is unchanged, but the colours are new). **Never run:** real screen
readers, voice control, Windows high-contrast, Safari or Firefox.

## 3. Performance (lab, not field)

Method: Playwright Chromium, three cold loads each, `PerformanceObserver`. Mobile profile: 390×844, CPU
slowed 4×, 1.6 Mbit/s down, 150 ms latency. Desktop: 1440×900, unthrottled. Local server, so real hosting
adds to these.

| Metric | Target | Mobile, throttled | Desktop |
|---|---|---|---|
| LCP | ≤ 2.5 s | 0.98 – 1.17 s (the opening poster) | 0.31 – 0.46 s |
| CLS | ≤ 0.1 | 0.002 | 0.004 |
| Transfer after 8 s on the page | — | 882 KB | 1,057 KB |

Interaction latency was not re-measured for v2; the handlers are the same code that measured 40 to 112 ms
per control at 4× CPU on v1. There is **no field data**. Re-measure on the Shopify theme.

Media budget:

| Asset | Budget | Actual |
|---|---|---|
| Poster, opening | ≤ 60 KB | 32 KB wide, 42 KB tall |
| Any one loop | ≤ 600 KB | 295 to 426 KB (MP4); 140 to 172 KB (WebM) |
| Jar cut-out | ≤ 80 KB | 41 to 53 KB |
| Videos playing at once | 1 | 1 (tested) |
| Videos fetched before you scroll | 1 | 1 |

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

`01-desktop-opening` · `02-desktop-creatine-dawn` · `03-desktop-magnesium-dusk` · `04-desktop-water-labels` ·
`05-desktop-product` · `06-mobile-opening` · `07-mobile-product-frame` · `08-mobile-cart` (simulated, with
the honest checkout message) · `09-mobile-reduced-motion` · `10-tablet-range`. Chromium, 2×, web fonts
loaded. They are stills; the motion is in the preview.
