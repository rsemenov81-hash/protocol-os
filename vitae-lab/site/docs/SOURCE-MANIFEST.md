# Source and asset manifest

Compiled 9 Nov 2026. "Seen" means I opened the thing itself in this session. "Reported" means the
handoff says so and I could not check.

## 1. Sources

| Source | Purpose | Owner | Freshness | Approval status | Access this session |
|---|---|---|---|---|---|
| Owner's current draft, `https://vitae-lab-storefront-review.rsemenov81.chatgpt.site/` | **The canonical draft**: page, styles, script, hero loop, six label visualizations with cut-out paths | Roman | Seen 10 Nov 2026 | Owner: "I do like it"; a design preview, not launch approval. Its title and FAQ still carry two retired phrases ("Everyday, considered", "research-informed"). | Seen; fully downloaded |
| `Vitae_Lab_Claude_Handoff.docx` | The brief: direction, corrected catalog, decisions to preserve | Roman | 9 Nov 2026 | Owner's instructions | Seen |
| `/Users/romansemenov/Documents/Codex/Vitae-Lab-Higgsfield` (Mac) | Latest site source with water and hero edits; preview was `127.0.0.1:4173` | Roman | Reported latest (8–9 Nov) | "Looks good for now" was visual feedback, not launch approval | **Not reachable** |
| Shopify theme "Water Cinematic Draft" `186959724767` | Shopify implementation in progress | Roman | Reported: unpublished, static poster, MP4 upload failed 8 Nov | Unpublished draft | **Not reachable.** The connector needs sign-in, and the storefront password wall hides the preview. A "Share preview" link from Themes would work. |
| Shopify store `wh7315-e9`, live theme Horizon | Live storefront | Roman | Checked 10 Nov 2026: every URL redirects to the password page ("Opening soon"). Live theme is Horizon 4.4.0, id `186203832543`. | Password-protected; nothing public | Password page only. The link `/?_ab=0&_fd=0&_sc=1` shows the store to a signed-in owner; to anyone else it is the password page. |
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

## 4. Asset manifest: what the prototype ships (v2)

Everything is in `vitae-lab/site/media/`. "Draft" means the owner's draft at the chatgpt.site address.

| File | What | Size | Origin | Approved for the storefront |
|---|---|---|---|---|
| `opening.mp4` / `.webm`, `opening-poster.jpg` | Terraces at first light, 1280×720, 8.8 s seamless loop | 426 / 172 KB, 32 KB | Higgsfield shot `opening-16x9` (below), with the draft's `higgsfield-hero-poster.jpg` as the reference image. Last 1.2 s cross-faded into the first; H.264 CRF 27 and VP9 CRF 39. | **Pending your review.** Generated at your instruction on 10 Nov. |
| `opening-tall.mp4` / `.webm`, `opening-poster-tall.jpg` | The same place composed for phones, 720×1280, 7 s loop | 295 / 140 KB, 42 KB | Shot `opening-9x16`, same reference | Pending your review |
| `ledge.mp4` / `.webm`, `ledge-poster.jpg` | Empty stone ledge, ridges and moving cloud, 1280×720, 8.8 s loop. The stage for all six jars. | 382 / 171 KB, 58 KB | Shot `ledge-16x9`, with the draft's `vitae-ledger-alpine-background-imagine-02.jpg` as reference | Pending your review |
| `water.mp4` / `.webm`, `water-poster.jpg` | Water droplet on slate, 1280×720, 7 s loop | 322 / 169 KB, 66 KB | Shot `water-16x9`, with the draft's `higgsfield-atmosphere.jpg` as reference | Pending your review |
| `pack-<handle>.webp` × 6 | The six jars with transparent background, about 700×1050 | 41–53 KB each | Cut from the draft's `vitae-ledger-*-imagine-01.jpg` using the draft's own SVG outline paths, rendered in Chromium, edge pulled in 1 px. **No model touched the labels.** | They are your review visualizations: not photographs of stock, and not approved print labels. The page says so. |
| `mono-letters.png`, `mono-helix.png`, `wordmark.png` | Logo masks | 5, 4, 9 KB | `vitae-lab/labels/assets/` (same files as the draft) | Yes (identity). No vector master is known to exist. |
| `docs/qa/*.jpg` | Screenshots | 1.4 MB total | Playwright, this session | Evidence only |
| `docs/higgsfield-shots.json` | Exact request body and request ID for each shot | — | This session | Record |

Original 720p masters from Higgsfield are **not** in the repo (5 to 10 MB each). Higgsfield deletes them
seven days after generation (17 Nov 2026). Say if you want them saved somewhere.

Not used from the draft: `higgsfield-hero-web.mp4` (replaced by the new opening loop of the same scene).

## 5. Higgsfield: what was generated and what it cost

Model: **Cinema Studio 4.0** (`higgsfield/cinema-studio/4.0`), Higgsfield's own flagship video model on the
API, chosen because you asked for their most advanced one. It tops out at 720p; Seedance 2.5 goes to
1080p but is not Higgsfield's top tier. All four shots used a locked camera (`static-shot`), one
continuous take (`single-shot`), no audio, and one of your existing frames as the look reference so the
new footage stays in your world.

| Shot | Request ID | Aspect, length | Reference frame | Result |
|---|---|---|---|---|
| `opening-16x9` | `01a1c2f4-7a5d-77cd-b92f-d0bf76d16001` | 16:9, 10 s | hero poster | Used |
| `opening-9x16` | `01a1c2f4-8fc6-7d2f-8663-02df54407196` | 9:16, 8 s | hero poster | Used |
| `ledge-16x9` | `01a1c2f4-93a1-7937-8ae8-7572ba88bacf` | 16:9, 10 s | alpine background | Used |
| `water-16x9` | `01a1c2f4-9893-7437-adad-88e66572d00c` | 16:9, 8 s | atmosphere (droplet) | Used |

Prompts and parameters are in `docs/higgsfield-shots.json`, exactly as sent.

**Cost: about $16.64**, by Higgsfield's published rate for this model on your account ($0.0214 per 1,000
video tokens; 720p works out to about $0.4622 per second): $4.62 + $3.70 + $4.62 + $3.70 for 36 seconds.
I could not read the account's billing record from here, so check the exact charge in the Higgsfield
console. All four were first takes; nothing was regenerated.

Photos: no still images were generated. The posters are frames from the four shots, and the jars are your
existing visualizations. A generated still would have meant inventing product or ingredient imagery,
which the brief rules out.

Not generated, and why: per-product videos with the jar in shot. A video model redraws label text, so the
jar stays a still cut-out and only the world behind it moves.
