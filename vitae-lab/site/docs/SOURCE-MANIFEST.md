# Source and asset manifest

Compiled 9 Nov 2026. "Seen" means I opened the thing itself in this session. "Reported" means the
handoff says so and I could not check.

## 1. Sources

| Source | Purpose | Owner | Freshness | Approval status | Access this session |
|---|---|---|---|---|---|
| `Vitae_Lab_Claude_Handoff.docx` | The brief: direction, corrected catalog, decisions to preserve | Roman | 9 Nov 2026 | Owner's instructions | Seen |
| `/Users/romansemenov/Documents/Codex/Vitae-Lab-Higgsfield` (Mac) | Latest site source with water and hero edits; preview was `127.0.0.1:4173` | Roman | Reported latest (8–9 Nov) | "Looks good for now" was visual feedback, not launch approval | **Not reachable** |
| Shopify theme "Water Cinematic Draft" `186959724767` | Shopify implementation in progress | Roman | Reported: unpublished, static poster, MP4 upload failed 8 Nov | Unpublished draft | **Not reachable** (connector needs sign-in) |
| Shopify store `wh7315-e9`, live theme Horizon | Live storefront | Roman | Reported: no products published | Live but empty | **Not reachable** |
| `https://vitae-lab.pages.dev/` | Named "visual reference" | Roman | Unknown; bundle `index-Fd3myPqV.js` | Not a storefront build. It is a peptide-clinic page with COA and delivery claims. **Do not reuse its copy.** | Seen |
| `vitae-lab/labels/` (repo, `c51d68f`) and its GitHub Pages copy | Ledger label identity: tokens, type, grid, logo cuts | Roman | 9 Nov 2026 in repo | Concept. Quantities are placeholders and conflict with the corrected catalog. Identity only. | Seen |
| Supliful catalog pages (five products) | Supplier's public record: ingredients, amounts, directions, warnings, net quantity | Supliful | Fetched 9 Nov 2026 | Supplier listing, not the approved Vitae Lab label | Seen |
| Supliful page for chocolate blend `JAG42PECH` | Same, sixth product | Supliful | — | — | **Not located** (no URL in the handoff) |
| Gmail thread "clarification of JTP7ADWV whey and RLC4CREA creatine labels" | Open label questions | Roman / Supliful | Last message 5 Nov 2026: Supliful asked for a screenshot. No reply sent since. | Unresolved | Seen (read only) |
| Gmail thread "Help connecting Vitae Lab Shopify store" | Store-connection problem | Roman / Supliful | Sent 5 Nov 2026. No reply in the thread. | Unresolved | Seen (read only) |
| Supliful sample shipments `SPL1250654` (5 Nov), `SPL1250865` (7 Nov) | Samples | Roman | Shipped notices only | Contents and label versions unreconciled | Notices seen |
| `Vitae-Lab-Supliful-Saved-Drafts-2026-11-07.zip` | Six saved label PDFs | Roman | 7 Nov 2026 | Private drafts, nothing applied | **Not provided** |
| `Vitae-Lab-Launch-Deliverables.zip` / `.pdf` | Baseline review pack, six pack visualizations, flat proofs | Roman | 7 Nov 2026 | Partly superseded | **Not provided** |
| `Vitae-Lab-Website-Benchmark.pdf`, `Vitae-Lab-X-Creatine-Protein-Feedback.md` | UX benchmark and small qualitative sample | Roman | 7 Nov 2026 | Reference only | **Not provided** |
| `Vitae-Lab-Fresh-Landing-Page.zip` | Cursor theme export before the water edits | Roman | 8 Nov 2026, superseded | Historical baseline only | **Not provided** (and not wanted as a base) |
| Label proofs and supplier evidence folders on the Mac | Corrected proofs (including chocolate), screenshots for Supliful | Roman | 4–8 Nov 2026 | Drafts | **Not reachable** |
| Google Drive | Searched for Vitae Lab files | Roman | — | Only `Vitae_Lab_Brochure.pdf` (4 Jul 2026) found; unrelated to the store build | Searched |

Conflicts resolved:

- **Ledger quantities vs corrected catalog.** Ledger says creatine 300 g / 60 servings, whey 25 g protein /
  900 g, collagen 10 g scoop, magnesium 200 mg / 120 capsules "bisglycinate", D3 90 softgels. The corrected
  catalog and the supplier pages say otherwise. This build uses the corrected catalog everywhere, including
  on the drawn labels, and uses Ledger for identity only.
- **Corrected catalog vs supplier pages.** They agree on every figure I could compare (table in
  `CLAIMS-REGISTER.md`). Serving counts and scoop sizes are not printed on the public pages, so those rest
  on the handoff alone.
- **pages.dev "visual reference" vs the brief.** The page is a different business (peptides, coaching,
  local delivery) in a different typeface. The brief's own direction (water, Ledger type and palette) wins.

## 2. Products

Six products, none published, none priced, none mapped. NMN is excluded.

| Product | Supplier SKU | Shopify product / variant ID | Supplier mapping | Label artwork status | Launch-approved |
|---|---|---|---|---|---|
| Creatine monohydrate | RLC4CREA | none (unverified) | none | Saved draft, 7 Nov; scoop question open | No |
| Vanilla whey isolate | JTP7ADWV | none (unverified) | none | Saved draft, rechecked 9 Nov; %DV footnote open | No |
| Chocolate performance whey blend | JAG42PECH | none (unverified) | none | Saved draft; cholesterol line open; accent unknown to me | No |
| Collagen peptides | RLC8COLL | none (unverified) | none | Saved draft | No |
| Magnesium glycinate | VOX4MGNE | none (unverified) | none | Saved draft | No |
| Vitamin D3 | RLC3VTD3 | none (unverified) | none | Saved draft | No |

## 3. Deployments

| Deployment | Controls | State |
|---|---|---|
| GitHub Pages for `protocol-os` (`main`) | `/vitae-lab/labels/` today; would also serve `/vitae-lab/site/` after a merge | Public. This branch is not merged. |
| Private Claude artifact | This prototype's preview | Private to the owner |
| Cloudflare Pages `vitae-lab` | The old peptide page | Public; outside this work |
| Shopify `wh7315-e9` | Live store and draft theme | Not touched |

## 4. Asset manifest: what the prototype ships

| File | Dimensions / length | Size | Origin | Model, job, prompt | Rights | Approved for Vitae Lab storefront |
|---|---|---|---|---|---|---|
| `media/water-960.mp4` | 960×540, 5.0 s loop, H.264, no audio | 479 KB | Re-encode of `scott/assets/water-motion.mp4`: last second cross-faded into the first for a seamless loop, highlights rolled off (`curves`), CRF 27 | Higgsfield `seedance_2_5`, job `e0f649fe-846d-4b19-a507-3e935190fd6c`, 14 Oct 2026 (recorded in `scott/DEPLOY.md`; the prompt is not recorded there) | Generated on Roman's Higgsfield account | **No.** It was made for the Scott app. Used here as a placeholder plate. |
| `media/water-640.mp4` | 640×360, 5.0 s loop | 195 KB | Same, scaled, CRF 29. Served under 700 px. | same | same | No |
| `media/water-960.webm`, `media/water-640.webm` | same loops, VP9 | 335 KB, 179 KB | Same pipeline, encoded from the source. Used only by browsers without H.264 (Playwright's CI Chromium is one). | same | same | No |
| `media/water-poster.jpg` | 960×540 | 20 KB | First frame of the graded loop | same | same | No |
| `media/mono-letters.png`, `mono-helix.png`, `wordmark.png` | 154×161, 154×161, 329×64 | 5, 4, 9 KB | Copied from `vitae-lab/labels/assets/` (cut from the 520 px logo PNG) | Not generated | Roman's logo | Yes (identity). **No vector master is known to exist.** |
| Pack art | Drawn live in HTML/CSS | 0 KB | `packHTML()` in `site.js`, ported from `vitae-lab/labels/index.html`, fed with corrected working facts | Not generated | — | **No.** Illustrative containers and concept labels. Replace with approved packshots before launch. |
| `docs/qa/*.jpg` | Screenshots | 1.6 MB total | Playwright, this session | — | — | Evidence only |

What is missing against the handoff's delivery checklist: an approved water plate composed for this
store (desktop and mobile), original masters, approved product packshots with final labels, and a
recorded prompt for the plate in use.

### Existing Higgsfield history (account workspace `7a0a649f…`, read 9 Nov 2026)

Nine videos and at least 24 images, 10 Oct to 4 Nov 2026. I downloaded the twelve most recent and looked
at them. **None is a Vitae Lab water scene or product still.** They are Geneva dashboard studies for
the Trey app, a pop-art plan for the Scott app, and abstract paper sculptures. The "eight-second
Seedance 2.5 video and one still" named in the handoff are not in this workspace's history (the Seedance
2.5 clips here are 6 s). They were made elsewhere and live only in the Mac folder. Balance: 3.75
credits, Pro plan.

## 5. Proposed Higgsfield shot list (nothing was generated or spent)

Model catalog and inputs were read from the account on 9 Nov 2026. Prices are the Higgsfield API's own
estimate for `bytedance/seedance-2.5/text-to-video` on this account: about **$0.4622 per second at 720p**
and **$1.1372 per second at 1080p** for 16:9 output, before any discount. A second estimate call returned
1.5 credits = $0.094, so one credit is roughly $0.063. Treat credit figures as approximate.

| # | Shot | Model and mode | Aspect | Length | Resolution | Audio | Prompt | Estimated cost |
|---|---|---|---|---|---|---|---|---|
| 1 | Desktop water plate (test first) | `seedance_2_5`, `t2v` | 16:9 | 10 s | 720p | off | Handoff Prompt A | **$4.62** (about 74 credits) |
| 2 | Mobile water plate | `seedance_2_5`, `omni_reference` with the approved poster from shot 1 as `start_image` | 9:16 | 10 s | 720p | off | Handoff Prompt C | **$4.62** (about 74 credits) |
| 3 | Desktop master, only if shot 1 is approved and softness shows | same as 1 | 16:9 | 10 s | 1080p | off | Prompt A, same seed frame as `start_image` | **$11.37** (about 181 credits) |
| — | Posters and static fallback | Frame grabs from the approved clips | — | — | — | — | — | $0 |
| — | Product in scene (Prompt B) | **Not proposed yet.** There is no approved packshot to protect. When there is, generate the lighting plate only and composite the real packshot. | — | — | — | — | — | — |

Totals: shots 1+2 = **$9.24** (about 148 credits). With the 1080p master, **$20.61** (about 329
credits). Allow the same again for one retake each. Seedance 2.5 accepts 4 to 30 s, 480p/720p/1080p,
and `start_image` / `end_image` references; using the same frame as start and end is the route to a
clean loop, with an editor cross-fade as the fallback (already implemented in the encode step above).

Why 720p is enough to start: the plate sits behind a 50–90% veil and is never the subject. The loop in
use today is 540p.

What it needs from you: approval of the spend, and credits. The account holds 3.75. The connector in
this session can read the catalog and history but cannot submit jobs; the environment's API key can, and
I did not use it for anything paid.
