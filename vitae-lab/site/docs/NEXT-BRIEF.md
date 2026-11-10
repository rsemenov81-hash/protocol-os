# Next build: "The Scoop"

Written 10 Nov 2026 at the end of a long session, so a fresh session can start from here.

## Why a new concept

Four versions in `vitae-lab/site/` all put jars on a backdrop. The owner's verdicts, in order: "very
very bad" (v1, dark stones, drawn jars); "you copied design… moving pieces, photo realistic, 3d" (v2);
"no longer feels like one flowing environment… like Apple does" (v3); "products are too big, transition
is not smooth, special effects are gone, no animation" (v4). Then: "don't lock yourself in what we have.
Be creative. Goal: best website for a supplement company startup." He approved up to **$60** of
Higgsfield generation for this concept, on the condition that the quality is outstanding.

## The concept

The homepage follows one serving from jar to glass as a single macro film that scrolling plays forward
and backward (scroll-scrubbed, the way Apple scrubs a product film). Bright, warm studio look. No
mountains.

1. Opens inside the material: a macro drift across white powder like a landscape. "Your goals" over it.
2. Pulls back: the powder is a level scoop above an open jar; the labelled jar is revealed last.
3. One move per product: creatine pours, whey swirls into milk, collagen dissolves in coffee, a softgel
   catches light, capsules tumble.
4. Facts arrive with the action (serving size as the scoop levels; "22 g protein" as the shake finishes).
5. Short page: film, one comparison strip, buy. Research stays on product pages.

## What must hold (from the owner's handoff and feedback)

- Centered opening: "Your goals" (Strength, Longevity, Everyday vitality, Wellness), then "Your
  solution" with real product names. No hero button, no retired copy (a test enforces this).
- Normal scrolling only. Reduced-motion, Save-Data and paused modes must keep all content.
- Exact labels: never let a model redraw label text. `relabel.py` (method described in
  `SOURCE-MANIFEST.md`, section 4) re-applies the true label to each frame; it lost lock on larger camera
  moves, so keep the jar's move small or keep the jar out of shot.
- Warm, positive copy; no defensive lines. Product facts only from `products.js`.
- Artwork disclosure stays small, beside product facts and in the footer.
- Scroll-scrubbing needs footage encoded with every frame a keyframe, or an image sequence on a canvas.
  Judge motion from a recorded scroll, not from stills: stills were how the earlier versions were
  misjudged.

## State of the test shot

One shot was submitted on 10 Nov 2026 to check the look before ordering the rest:
Seedance 2.5 text-to-video, 1080p, 8 s, request `01a1c595-01eb-7726-a152-bcd17b459135`, about $9.10 by
the published rate. Prompt: powder landscape macro pulling back to a level scoop over an open, unlabelled
white jar, bright warm studio. Spend so far on this concept: about $9.10 of $60. Earlier rounds: about
$38.83.

## What is reusable

`products.js` (facts, research notes), the cart and router in `site.js`, the 13 checks in
`tests/vitae-site-e2e.mjs`, the six jar cut-outs and six product films in `media/`, and every document
in `docs/`.
