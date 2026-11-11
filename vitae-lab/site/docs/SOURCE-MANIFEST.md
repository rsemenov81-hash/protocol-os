# Source and asset manifest

> **v5 note (11 Nov 2026).** New media, all generated with Higgsfield (Seedance 2.5 text-to-video; prompts and request IDs in `scoop-shots.json`): `scrub-open`, `scrub-pour`, `scrub-shaker`, `scrub-collagen`, `scrub-softgel`, `scrub-capsules` (1280×720, 24 fps, a keyframe every 4 frames so they can be scrubbed, `.mp4` + `.webm` + poster) and `how-muscle` (first 10.2 s of the `explainer-muscle` take). They show generic, unlabelled items and are disclosed on the page as illustrations, not footage of the products. `world.*` was removed. The jar cut-outs and product-page jar films are unchanged.

> **v4 note (10 Nov 2026).** The homepage now uses one fixed scene, `world.*` / `world-tall.*`: these are the v2 shots `opening-16x9` and `opening-9x16` (static terraces). The flight, powder, softgel, water and empty-ledge loops are no longer shipped; they were paid for and are unused. The six product films are used on product pages only. No new generations were made for v4, so the spend is unchanged.

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

## 4. Asset manifest: what the prototype ships (v3)

Everything is in `vitae-lab/site/media/`. "Draft" means the owner's draft at the chatgpt.site address.
Every generated asset below is **pending your review**; none is approved for launch.

**Product films (the main change in v3).** One per product: the real jar on the stone ledge with the
camera arcing around it, mist passing in front and behind, light moving across it.

| File | Size | Higgsfield request |
|---|---|---|
| `jar-creatine-monohydrate.mp4` / `.webm` / `-poster.jpg` | 673 KB / 333 KB | `01a1c331-9b93-707f-9652-75db97433238` |
| `jar-vanilla-whey-isolate.mp4` / `.webm` / `-poster.jpg` | 417 KB / 202 KB | `01a1c337-efa0-7ac9-ab5c-15f7b67ab824` |
| `jar-chocolate-whey-blend.mp4` / `.webm` / `-poster.jpg` | 620 KB / 269 KB | `01a1c337-f5e3-7f7d-b2d3-6eb8fa936271` |
| `jar-collagen-peptides.mp4` / `.webm` / `-poster.jpg` | 340 KB / 160 KB | `01a1c337-fc1b-7d41-999c-8d033f7901ee` |
| `jar-vitamin-d3.mp4` / `.webm` / `-poster.jpg` | 429 KB / 220 KB | `01a1c338-0223-745a-afe7-40d17b7f7b96` |
| `jar-magnesium-glycinate.mp4` / `.webm` / `-poster.jpg` | 648 KB / 297 KB | `01a1c338-081d-73b9-b234-85ed1358df6c` |

How each was made, so the label stays yours:

1. **First frame.** The jar cut-out (from the draft's image, using the draft's own outline path) is
   composited onto a still of the filmed ledge with a contact shadow. The label in that frame is exactly
   your artwork.
2. **Motion.** Seedance 2.5 image-to-video, 5 s, 720p, starting from that exact frame. Prompt in
   `docs/higgsfield-shots.json`.
3. **Label put back.** The model keeps the jar and the large type but garbles small print ("DIETARY"
   became "DEETARY" mid-shot). So for every frame the sharp first-frame label is aligned to the moving jar
   (ECC homography) and re-applied, keeping that frame's lighting. If the alignment score drops below 0.6
   the clip is cut there instead of showing a wrong label: creatine, chocolate and magnesium kept all 5 s;
   vanilla kept 3.2 s, vitamin D3 3.0 s, collagen 2.2 s.
4. **Loop.** Forward then reversed, so the camera arcs out and back with no jump. H.264 CRF 27, VP9 CRF 39.

I checked the last frame of all six by eye: every label reads correctly. I did not check every frame of
every clip. Small print is a few pixels tall at 720p, so treat these as visualizations, as the page says.

**Other footage**

| File | What | Size | Origin |
|---|---|---|---|
| `opening.mp4` / `.webm`, `opening-poster.jpg` | Flight through mist down to the terraces, 1280×720, 16 s (8 s out and back) | 1203 KB / 632 KB | Cinema Studio 4.0 shot `flight-16x9`, draft's hero poster as reference |
| `opening-tall.mp4` / `.webm`, `opening-poster-tall.jpg` | Terraces composed for phones, 720×1280, 7 s | 287 KB / 136 KB | Cinema Studio 4.0 shot `opening-9x16` (v2) |
| `water.mp4` / `.webm`, `water-poster.jpg` | Water droplet on slate, 7 s | 314 KB / 165 KB | Cinema Studio 4.0 shot `water-16x9` (v2) |
| `powder.mp4` / `.webm`, `powder-poster.jpg` | White powder pouring onto slate in slow motion | 883 KB / 669 KB | Cinema Studio 4.0 shot `powder-16x9`. **Illustrative; not film of a product.** Captioned as such. |
| `softgels.mp4` / `.webm`, `softgels-poster.jpg` | One golden softgel and one white capsule on slate, camera sliding past | 626 KB / 478 KB | Cinema Studio 4.0 shot `softgels-16x9`. Illustrative; same caption. |
| `pack-<handle>.webp` × 6 | Jar cut-outs (transparent), used under the rotating product name and as the source of every first frame | 41–53 KB each | Draft images + draft outline paths. No model touched these. |
| logo masks, `docs/qa/*.jpg`, `docs/higgsfield-shots.json` | as before | — | — |

Generated in v2 but no longer used: the static opening (`opening-16x9`) and the empty ledge loop
(`ledge-16x9`); the ledge still survives as the background of every jar's first frame. Higgsfield
deletes its copies seven days after generation. Masters are not in the repo.

## 5. Higgsfield: what was generated and what it cost

| Round | Shots | Model | Seconds | Estimated cost |
|---|---|---|---|---|
| v2 | opening 16:9, opening 9:16, ledge, water | Cinema Studio 4.0, 720p | 36 | $16.64 |
| v3 | flight, powder, softgels | Cinema Studio 4.0, 720p | 18 | $8.32 |
| v3 | six jar films | Seedance 2.5 image-to-video, 720p | 30 | $13.87 |
| | **13 shots** | | **84** | **about $38.83** |

Cost is Higgsfield's published rate for both models on this account (about $0.4622 per second at 720p).
The jar films were sent with `bitrate_mode: high`; if that carries a surcharge the total is higher. I
cannot read the billing record from here: **check the exact charge in the Higgsfield console.** Every
shot was a first take.

Why two models: Cinema Studio 4.0 is Higgsfield's flagship and made every scene shot. It works from
reference images and restages what it sees, which would redraw the jar. Seedance 2.5 image-to-video
starts from an exact first frame, so it was used only where the real jar had to be in shot.

Photos: no still images were generated. Posters are frames from the shots.
