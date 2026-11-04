# Vitae Lab labels v2 — "Ledger"

Front-panel system for the first five supplements, replacing the "Mineral Atelier" concept
(`reference/concept-v0.png`). Open `index.html` for the lineup, the five flat front panels, the
cap discs, the before/after and the token sheet. `renders/` holds the same boards as PNG.

Everything here is a concept built on suggested containers. Nothing is print-ready until the
contract manufacturer's dielines and the supplier confirmations in the last section are in.

## What changed and why

Four specialist briefs were written for this round (`briefs/`): product manager, art director,
customer psychologist, compliance and print. Where they disagreed, the call is recorded here.

| Problem in v0 | Who flagged it | What v2 does |
|---|---|---|
| A nameplate, not a label: no dose, servings, net quantity or "Dietary Supplement" | PM, psychologist, compliance | A ruled ledger field carries dose and timing, form, servings; net quantity sits alone in the bottom band; "Dietary Supplement" in bold completes the statement of identity |
| Pastel concentric arcs read as spa/skincare and are indistinguishable at 2 m | all four | Removed. One solid accent chip per product, repeated on the cap disc and the back-seam stripe |
| Five pastels at the same lightness; colour never reaches the cap | PM, psychologist | Five hue families at five lightness steps (plum 28, slate 41, burnt orange 48, sage 54, ochre 62); the evening product is the darkest; a numeral always sits beside the colour |
| Logo as heavy as the product name; wordmark re-typeset | AD | Original monogram and wordmark kept, cut from the logo file, at 0.36 of label height; the clinic tagline never appears on a label |
| Condensed serif tracked until bowls touch; type sizes drift per SKU | AD, PM | Newsreader 400 names, IBM Plex Sans descriptors, IBM Plex Mono data; every size is a fraction of label height, so a sixth SKU is a text-and-accent swap |
| Silver ribbed caps, cool-white tubs, warm label: three neutrals that disagree | AD, psychologist | Matte bone tubs with same-colour caps; amber bottles with black caps (amber is functional for D3) |
| "Mineral Atelier" and "Vitae Lab" compete on one board | PM | Vitae Lab is the brand; "Ledger" is only the name of this system |
| Nothing verifiable, so trust rests on aesthetics | psychologist | Numbers on the front, lot and best-by window reserved on the back, CoA by QR only if a per-lot CoA exists |

Calls made as lead where the briefs conflicted:

- The art director wanted no dosages on the front. The product manager, the psychologist and
  21 CFR 101 all want them. The ledger field is the compromise: the data reads as record-keeping,
  not as marketing.
- Magnesium takes the darkest accent (plum) because it is the evening product; the art director's
  sage moves to collagen, which avoids the beauty-aisle pink the psychologist warned against.
- Catalogue order is powders first (01 creatine, 02 whey, 03 collagen) then capsules and softgels
  (04 magnesium, 05 D3), so the family lines up by form and by time of day.
- The practitioner cue ("as set by your practitioner") does not fit the bottle fronts and goes on the
  side panel under directions.

## Front-panel copy, locked for this round

Every quantity is PLACEHOLDER-TO-CONFIRM-WITH-SUPPLIER.

| No. | Name | Descriptor | Ledger rows | Net quantity | Accent |
|---|---|---|---|---|---|
| 01 | Creatine | Monohydrate | 1 scoop (5 g) · Daily / Micronized · Unflavored / 60 servings | Net Wt 300 g (10.6 oz) | Slate #4B6480 |
| 02 | Whey Isolate | Vanilla | 1 scoop (30 g) · Daily / 25 g protein per scoop / 30 servings | Net Wt 900 g (1.98 lb) | Ochre #B8923D |
| 03 | Collagen | Peptides | 1 scoop (10 g) · Daily / Bovine · Unflavored / 30 servings | Net Wt 300 g (10.6 oz) | Sage #6E8A6A |
| 04 | Magnesium | Bisglycinate | 2 capsules · Evening / 200 mg magnesium / 60 servings | 120 Capsules | Plum #4E3A5A |
| 05 | Vitamin D3 | Cholecalciferol | 1 softgel · With a meal / 50 mcg (2,000 IU) / 90 servings | 90 Softgels | Burnt orange #C65A2E |

All five carry "Dietary Supplement" under the descriptor. No structure/function claims anywhere,
so no FDA disclaimer and no 30-day notification. D3 is 2,000 IU so one softgel stays under the
4,000 IU adult upper limit and the app can titrate in clean units.

Side and back panel (not drawn): Supplement Facts (or Nutrition Facts for whey, see below),
other ingredients, "Contains: Milk" on whey, suggested use with the practitioner line, cautions
(fluids for creatine, laxative note for magnesium, "do not exceed" for D3), storage, a 15 × 45 mm
blank window for lot and best-by, "Distributed by" with a US address and phone for adverse-event
reports, UPC, QR to the certificate of analysis.

## Higgsfield generation pack

The Higgsfield connector available in this session is read-only (model catalogue, credits,
history); it cannot submit generations, and the result host is not reachable from here, so the
three images generated on the account earlier today could not be reviewed. The workspace shows
4 credits on the Pro plan, which is not enough for the set below; top up first.

Attach the flat panel PNGs in `renders/` as references so the label text is reproduced rather than
hallucinated. Models that handle text and references well in the catalogue: `gpt_image_2_5`
(quality high, resolution 2k, the account's usual choice), `nano_banana_pro` (2k, image
references), `openai_hazel` (typography and logos), `seedream_v5_pro` (instruction edits of a
reference). Avoid `soul_*`, `z_image` and `grok_image` for this: they restyle text.

Shared prompt stem, to paste before each shot:

> Product photograph of a supplement container with the attached label artwork applied exactly as
> shown, text unchanged and legible, label on textured matte bone paper with visible tooth, no
> gloss. 90 mm lens equivalent, camera at label mid-height tilted 6 degrees down, 1.2 m away, f/8.
> One 1.2 m softbox camera-left at 45 degrees and 30 degrees elevation, white bounce card
> camera-right, one soft highlight band on the cylinder, no hotspot on the label. Surface honed
> limestone or warm grey plaster (#D9D5CC), seamless backdrop one stop darker at the top, soft
> contact shadow dark at the contact line. 5200 K, ISO 200 grain, slightly desaturated. No mirror
> reflections, no HDR glow, no floating products, no extra text, no badges, no people.

| Shot | References | Add to the stem | Model, ratio |
|---|---|---|---|
| Family lineup | `panel-01` to `panel-05` | Five containers left to right in catalogue order: three matte bone HDPE tubs (90, 120, 105 mm diameter) with same-colour matte caps, then two amber glass packer bottles (51, 48 mm) with matte black caps; a 30 mm accent disc on each tub cap and 20 mm on each bottle cap in the label's chip colour; straight-on, equal 40 mm gaps | `gpt_image_2_5`, 21:9, 2k |
| Hero | `panel-04`, `panel-01` | Magnesium bottle in front, creatine tub behind-left, three-quarter view, raking light from the left so the blind-debossed "04" and the paper texture read | `nano_banana_pro`, 4:5, 2k |
| Macro | `panel-02` | 2 cm macro of the colour chip, the ruled ledger rows and the debossed numeral on the whey tub; shallow depth of field | `nano_banana_pro`, 1:1, 2k |
| Caps from above | `caps.png` | Top-down of the three tubs showing the accent discs with their numerals, soft shadow | `gpt_image_2_5`, 3:2, 2k |
| Counter scene | `lineup.png` | The three tubs beside an espresso machine on a kitchen counter in morning light, product reads as considered, not clinical, not gym | `seedream_v5_pro`, 3:2, 2k |

Send no protocol, client or health data in any prompt. Record each job id in this file the way
`scott/DEPLOY.md` does.

## Confirm with the manufacturer and a regulatory reviewer before print

- Serving sizes, scoop weights, servings per container and net quantities for all five.
- Whey: Supplement Facts (DSHEA, matches the family) versus Nutrition Facts (conventional food,
  needed if it is ever sold as a shake or meal replacement); protein %DV by PDCAAS once "25 g
  protein" appears on the front; the correct natural or artificial qualifier for "Vanilla";
  allergens including soy lecithin.
- Magnesium: true bisglycinate, not buffered oxide; elemental mg per two capsules; gelatin or HPMC.
- D3: mcg declaration; lanolin or lichen source; overage.
- Collagen: bovine source and country; "collagen peptides", never "protein".
- Heavy-metal results, then the Prop 65 decision for whey and collagen.
- Net-quantity numeral height by panel area (3.2 mm, 4.8 mm on the 2.8 L whey tub): recompute
  on the real containers.
- Distributor legal name (a separate entity from the medical practice), address and US phone;
  trademark status of "Vitae Lab"; GS1 UPCs; lot and date coding method and window position.
- Containers: 56 mm bottles would give the ledger rows more room than the 51 and 48 mm packers
  drawn here; coloured-cap minimums or a printed disc; label stock, adhesive and matte varnish.
- Any "cGMP", "third-party tested" or "Made in USA" line only with the certificates in hand.
- The logo exists only as a 520 px PNG; request the vector file before any print work.

## Rebuilding the renders

```
node tools/render-labels.cjs vitae-lab/labels/index.html vitae-lab/labels/renders 2
```

Chromium loads Newsreader, IBM Plex Sans and IBM Plex Mono from Google Fonts; the logo masks are
embedded in the page, cut from `scott/assets/vitae-logo.png` (see `assets/`).
