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

## Owner's verdict on the test shot, and two films he asked to add (10 Nov 2026)

He likes the look of the test shot ("I do like"). He asked for two short explainer films, simple enough
for anyone, with the science checked.

### Film 1: "Where it goes" (about 12 s)

What is true and safe to show, for every product in the range:

1. You swallow it. It reaches the stomach and then the small intestine.
2. In the small intestine it is broken down as far as it needs to be and passes through the gut wall.
   Protein and collagen are split into amino acids and small peptides. Creatine, magnesium and vitamin D
   are absorbed largely as they are; vitamin D is fat-soluble and is absorbed along with dietary fat.
3. It enters the bloodstream.
4. Blood carries it around the body, and cells take up what they use. Muscle takes up creatine and amino
   acids. Vitamin D is first converted by the liver and then the kidneys into its active form.

Do not show: a product "targeting" one organ, anything being cured or repaired, speeds or percentages of
absorption (no figure has been verified for these products), or a glow that implies an instant effect.

### Film 2: "How muscle is built" (about 12 s)

1. Training comes first. Lifting stresses muscle fibres; that stress is the signal to rebuild.
2. Amino acids from protein arrive in the blood and enter the muscle cell. They are the building blocks.
3. The cell assembles them into new muscle protein (muscle protein synthesis).
4. Repeated over weeks of training and adequate protein, fibres get thicker. That is muscle growth.
5. Creatine's part is separate and should be shown separately: it is stored in muscle as phosphocreatine
   and helps recycle the cell's quick energy (ATP) during short, hard efforts, so you can do a little
   more work in a session.

Sources already in `CLAIMS-REGISTER.md`: Morton 2018 (protein with resistance training), Kreider 2017
(creatine raises muscle creatine stores; high-intensity performance). The digestion and conversion steps
are standard physiology and still need a named reference (NIH Office of Dietary Supplements fact sheets
for vitamin D and magnesium; a physiology text for protein digestion) before publication.

Rules for both films:

- Stylized 3D, in the bright studio look of the test shot: clean translucent shapes, not surgical
  anatomy. One idea per beat. Captions are real HTML text over the film, not baked in.
- Training must be visibly the trigger in film 2. The film must never suggest powder alone builds muscle.
- These are structure/function statements: the FDA disclaimer shows with them, and a qualified reviewer
  must approve the wording before launch.
- A video model cannot be trusted with biology. Storyboard each beat as a still first, check it, then
  animate from the approved stills (image-to-video with start and end frames).

Budget note: about $50.90 of the $60 approval remains after the test shot. Two 12 s films at 1080p are
about $27 on their own, so the product shots and these films will not all fit at 1080p. Options: make
the explainers at 720p (about $11 for both), or ask the owner for more.

## Update, later on 10 Nov 2026: approval raised, five shots ordered

The owner raised the ceiling for this concept to **$80**. Five product-action shots were submitted
(Seedance 2.5 text-to-video, 1080p, 5 s each, about $5.69 each, $28.43 together): `pour`, `whey`,
`collagen`, `softgel`, `capsules`. Request IDs and exact prompts are in `docs/scoop-shots.json`, with the
opening test shot. Spend on this concept: about $37.53 of $80, leaving about $42.47.

Higgsfield deletes outputs seven days after generation (17 Nov 2026). Fetch each with
`GET https://api.higgsfield.ai/requests/<id>/status` and download `video.url`; the result host
`d3u0tzju9qaucj.cloudfront.net` is allowed in the `protocol-os` environment. None of these six has been
reviewed by the owner except the opening shot, which he liked.

Still to make, in this order: the labelled-jar reveal (image-to-video from a studio composite of the real
jar cut-out, then `relabel.py`), then the two explainer films from approved storyboard stills at 720p
(about $11), keeping about $15 for retakes.

Unrelated but blocking CI: `ubuntu-latest` moved to Ubuntu 26.04 and Playwright 1.56.1 cannot install
there. Proposed fix, not yet approved by the owner: `runs-on: ubuntu-24.04` in `.github/workflows/ci.yml`.

Later still on 10 Nov: the owner asked for the two explainer films ahead of everything else. First takes were ordered straight from text (12 s, 720p, about $5.55 each; IDs in `scoop-shots.json` as `explainer-journey` and `explainer-muscle`), skipping the storyboard step to get him a look quickly. Their biology is unchecked until someone watches them frame by frame. Of the five product shots he was sent, pour and collagen are good, whey lacks the stir, and softgel and capsules came out as spheres and need redoing with exact shapes. Spend on this concept: about $48.62 of $80.

Owner feedback on the product shots: no glass of milk (people use a shaker bottle), and the softgel and capsules must be the right shapes. Re-ordered as `shaker`, `softgel2` and `capsules2` (IDs in `scoop-shots.json`); `whey`, `softgel` and `capsules` are rejected. He asked for no more wasted spend: check every result against its prompt before proposing anything further. Spend on this concept: about $65.69 of $80.

Results, late 10 Nov: CI runner pinned to `ubuntu-24.04` (owner approved). `shaker` and `capsules2` match their prompts and were sent to the owner. `explainer-muscle` has the beats in order (curl, push into biceps, particles arrive, link into strands, pull back) but the particles do not clearly come from the vessels, the fibre does not visibly thicken, and the last second shows a skinless arm. `explainer-journey` was blocked by Higgsfield's content check (status `nsfw`, no video); whether it was charged is unknown. A retake should avoid the torso and start at the intestinal wall. `softgel2` was still rendering. Nothing further ordered.

Built, 11 Nov 2026: the owner said the clips look great, and the page was built from them (README v5 note). Not in it: the labelled-jar reveal (not ordered) and the "where it goes" film (blocked, not re-ordered). Product pages still use the older mountain jar films.
