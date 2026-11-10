# Launch checklist

Status on 10 Nov 2026 (v2): **prototype complete. Not launch-ready.** An Unverified critical item blocks
launch. Owner of every next step is Roman unless noted.

## Blockers, in the order I would clear them

1. **Your sign-off on v2.** It is built from your draft's own assets, but it is a new composition and
   new footage. Nothing else should build on it until you have looked.
2. **Shopify connector is signed out.** Until it is reconnected I cannot read products, policies or the
   draft theme, or write theme files to the unpublished theme.
3. **No products exist in Shopify; no prices are approved.** Nothing can be bought, so no cart or
   checkout test against the store is possible.
4. **Supliful store connection.** Supliful reported the store as linked to another user. Your 5 Nov
   email has no reply in the thread. No mapping, no routing.
5. **Three label questions are open with the supplier** (creatine scoop, vanilla %DV footnote, chocolate
   cholesterol). Supliful asked for a screenshot on 5 Nov; the reply has not been sent.
6. **No approved product imagery or final labels.** The jars are your review visualizations, cut out.
   They are not photographs of stock or approved print labels.
7. **Business identity, contact, address and policies** are not confirmed. Only a Privacy policy is
   known to exist.
8. **Claims have had no qualified review.**
9. **The four new Higgsfield shots are unreviewed.** They were generated at your instruction and need
   your approval like any other asset.

## Design and content

| Item | Status | Evidence | Next step |
|---|---|---|---|
| One continuous world; products sit in it | **Passed** (prototype) | `qa/01`–`07`: terraces, ledge and water joined by mist; jars stand on the filmed ledge | Your review of the footage |
| Desktop and mobile deliberately composed | **Passed** (prototype) | A separate 9:16 opening shot; product frames re-cropped to 4:5 with text on paper | — |
| Type legible throughout the animation | **Passed** | Worst-pixel contrast measured over three moments of each loop, `QA-REPORT.md` §2 | — |
| "Your goals" and "Your solution" work without shifting | **Passed** | e2e check 2; CLS 0.002 | — |
| Pause, reduced-motion and static modes keep all content and buying controls | **Passed** | e2e checks 9–12 | — |
| Keyboard focus never disappears during animation | **Passed** (Chromium) | e2e checks 3, 7, 13 | Human keyboard pass in Safari and Firefox |
| Every string reviewed; no generic AI copy, fake reviews, badges | **Passed** (prototype) | `COPY-DECK.md`; e2e check 4 | Owner read-through |
| No placeholder facts remain | **Failed** | Contact, policies, shipping, prices and the chocolate label copy are marked pending on the page | Supply the facts |
| Removed hero button, quote and retired copy stay removed | **Passed** | e2e check 4 | — |
| Built on the owner's current draft | **Passed** | Draft downloaded 10 Nov; its frames are the reference for every new shot and its jars are used as-is | Blocker 1: your sign-off |

## Products and customer trust

| Item | Status | Evidence | Next step |
|---|---|---|---|
| Products and variants match supplier records | **Unverified** | Five of six cross-checked against public supplier pages; serving counts and scoop weights rest on the handoff | Read the final label PDFs |
| Products match approved labels | **Unverified** | No approved label exists | Blockers 5, 6 |
| Ingredients, warnings, allergens agree across site and supplier | **Unverified** | Quoted from supplier pages for five; chocolate missing | Transcribe from final labels |
| Prices, stock | **Failed** | None set | Owner decision |
| Imagery is the real product | **Failed** | Review visualizations, captioned as such | Approved packshots |
| Claims have evidence and approval | **Unverified** | Evidence in `CLAIMS-REGISTER.md`; approval none | Qualified reviewer |
| Manufacturing, testing, certification statements are specific and verified | **Passed** by omission | The site makes none | Add only with documents in hand |
| FDA disclaimer and safety information accessible | **Passed** | Exact text, three places; e2e check 4 | Reviewer to confirm placement |
| Business identity, contact, policies complete | **Failed** | Not supplied | Owner |
| Samples and supplier label questions resolved | **Unverified** | Two shipments sent 5 and 7 Nov; contents unreconciled | Owner |

## Commerce and operations

| Item | Status | Evidence | Next step |
|---|---|---|---|
| Correct Shopify and Supliful accounts connected | **Failed** | Supliful reported a link to another user; no reply to 5 Nov email | Follow up with Supliful (needs your approval to send) |
| Product mapping and fulfillment routing verified | **Unverified** | Nothing to map | After products exist |
| Required plans active and approved | **Unverified** | Shopify plan and Supliful membership not checked | Owner to confirm costs; no purchase without approval |
| Cart | **Passed** as a simulation only | e2e checks 7, 8 | Re-test on Shopify |
| Checkout, shipping, taxes, payments, confirmation, cancellations, returns | **Unverified** | No store access, no products | Test-mode order on Shopify |
| Test-mode vs real fulfillment distinguished | **Passed** | `QA-REPORT.md` opening table: neither has been done | — |
| Monitoring, support, stock, exceptions and refunds have an owner | **Unverified** | Not assigned | Owner |
| No test payment mode or storefront restriction left on at launch | **Unverified** | Not applicable yet | Launch-day check |

## Quality and release

| Item | Status | Evidence | Next step |
|---|---|---|---|
| Mobile, desktop, accessibility, reduced-motion, failure-state testing documented | **Passed** for Chromium | `QA-REPORT.md` | — |
| Safari, iOS Safari, Firefox, Edge, Android Chrome | **Unverified** | Engines not available here | Run `npm run e2e:vitae` with WebKit and Firefox in CI or on a Mac; check on two phones |
| Screen reader | **Unverified** | Not run | VoiceOver and NVDA pass |
| Performance targets measured | **Passed** in lab | LCP 1.0 to 1.2 s, CLS 0.002 on the throttled mobile profile; interactions not re-measured for v2 | Re-measure on the Shopify theme; no field data exists |
| No critical console or network errors | **Passed** | e2e check 1 | — |
| Secrets absent from source, bundles, logs, deliverables | **Passed** | No keys, tokens or `.env` in this branch; the site calls no API | Keep it so in Shopify |
| Dependency checks | **Passed** | The site has no dependencies; the test uses the repo's pinned Playwright | — |
| Backups, deployment instructions, rollback | **Passed** for the prototype | `README.md` | Duplicate the Shopify theme before each edit |
| SEO and analytics/consent correct for the live destination | **Unverified** | Preview is noindex; no analytics | At launch, on Shopify |
| Staging restrictions changed only on approval | **Passed** | Nothing published; noindex in place | — |
| Roman reviewed the final preview and approved publication | **Failed** | Not requested | Final step |

## Decisions needed from you

1. **Is v2 the direction?** If yes, I port it to Shopify. If parts miss, tell me which (opening, the
   ledge frames, the water moment, the writing) and I rework those.
2. **The four shots.** Approve, or name the ones to redo. A redo is about $3.70 to $4.62 each.
3. **Shopify.** Reconnect the Shopify connector so I can read the draft theme and write to an unpublished
   copy.
4. **Preview hosting.** Is a public but unlisted, noindex GitHub Pages URL acceptable? If not, the pull
   request stays a draft and the private artifact is the preview.
5. **Supliful.** May I draft the two follow-ups (label screenshots, store connection) for you to send?
6. **Longevity theme.** Keep vitamin D3 listed under it, or only creatine and whey?
7. **Research wording.** Rows 4 to 6 of the claims register name wrinkles, insomnia, cancer and
   cardiovascular events while declining the claims. Keep, soften or cut, on a reviewer's advice.
8. **Facts only you have:** prices; shipping countries and rates; return policy; legal business name,
   mailing address and customer-service contact; the chocolate label's directions and warnings; whether
   "contract manufacturer and fulfillment partner" is the wording you want public.

## Rollback

See `README.md`. In short: nothing live changed. Closing the draft pull request and deleting the
artifact removes everything this work added. At launch, rollback is re-publishing Horizon.
