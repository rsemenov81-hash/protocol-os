# Vitae Lab — Label Redesign · Product Manager Brief

v1 · 2026-11-04 · Scope: front panels, five launch SKUs. Every quantity below is **PLACEHOLDER-TO-CONFIRM-WITH-SUPPLIER**.

## 1. Customer and purchase context

Buyer: the practice's concierge client (roughly 35–60, high income, performance/longevity-minded). Nobody picks this off a shelf; it is placed in their protocol inside Protocol OS and shipped by the practice. Trust is settled, so the front panel's job is **identification and dosing, not persuasion**.

| Moment | Distance | Decision the front must support |
|---|---|---|
| Unboxing | 30 cm | "This is what my practitioner specified": product, form, dose match the app |
| Kitchen counter, daily | 1–2 m, standing, warm light | Grab the right one of five in under 3 s; read the dose without lifting it |
| Gym bag (creatine, whey) | Looking down at the lid | Identify from the cap alone |
| Staff packing orders | Shelf, 1 m | Pick SKU and variant by code and color |
| Reorder | Any | Servings say when; SKU and lot say what |

## 2. Front-panel hierarchy

Top to bottom; nothing else goes on the front.

1. Brand signature (mark + "Vitae Lab"), small, fixed, ≤ 15% of panel height
2. Line number with accent block ("No. 01")
3. Product name: the hero
4. Descriptor: chemical form · dosage form
5. Flavor chip (whey only; powders say "Unflavored" because clients mix them)
6. Spec line: active per serving + servings per container
7. Net quantity, bottom 30% of the panel
8. "Dietary Supplement"

Side/back: Supplement Facts, ingredients with the "Contains:" allergen line, suggested use (directions only), warnings, storage, lot/expiry, distributor name and address, UPC, QR to the Protocol OS product page. No structure/function claims anywhere, so no DSHEA disclaimer or FDA notification is needed.

| No. | Name | Descriptor | Spec line | Net quantity |
|---|---|---|---|---|
| 01 | Creatine | Monohydrate · Unflavored Powder | 5 g creatine monohydrate per scoop · 60 servings | Net Wt 300 g (10.6 oz) |
| 02 | Whey Isolate | Protein Powder · [Vanilla] | 25 g protein per 30 g scoop · 30 servings | Net Wt 900 g (1.98 lb) |
| 03 | Magnesium | Glycinate · Capsules | 200 mg magnesium (as bisglycinate) per 2 capsules · 60 servings | 120 Capsules |
| 04 | Vitamin D3 | Cholecalciferol · Softgels | 50 mcg (2,000 IU) vitamin D3 per softgel · 90 servings | 90 Softgels |
| 05 | Collagen | Bovine Peptides · Unflavored Powder | 10 g collagen peptides per scoop · 30 servings | Net Wt 300 g (10.6 oz) |

**D3 is 2,000 IU, not 5,000**: doses are titrated to labs in the app, so 2,000 is the clean unit (one or two softgels covers the usual range), and one softgel stays under the 4,000 IU adult UL for anyone in the household. Vitamin D leads with mcg because Supplement Facts must declare mcg. Collagen says "collagen peptides", never "protein": a protein claim needs a %DV, and collagen's PDCAAS is zero. "Whey" already signals milk; "Contains: Milk" sits with the ingredients.

## 3. SKU system

- **Line number**: two digits, assigned at launch, never reused. 01 Creatine · 02 Whey Isolate · 03 Magnesium · 04 Vitamin D3 · 05 Collagen. Next: 06 Omega-3, 07 Electrolytes, 08 Zinc.
- **SKU code**: `VL-NN-AAA-SIZE-FLV`, e.g. `VL-02-WHY-900G-VAN`. Flavors and sizes are variants: same number, same accent, different suffix. Printed beside the UPC.
- **Color rule**: one accent per line number, in the same three places on every SKU: cap (or printed lid band), the block beside the number, a spine stripe. 01 deep teal · 02 ochre · 03 slate blue · 04 saffron · 05 terracotta · 06 forest · 07 coral · 08 graphite. Designer delivers a 12-swatch palette now so later SKUs need no redesign. Adjacent numbers differ in lightness as well as hue, and the number always sits beside the color, so color is never the only cue.

## 4. Critique of the current concept, ranked

1. **A nameplate, not a label.** No dose, servings, net quantity or "Dietary Supplement". The one thing a protocol client needs, "5 g per scoop", is absent.
2. **Two brands on one board.** "Mineral Atelier" headlines a family where four of five products are not minerals; the bottles say "Vitae Lab". Kill one before a system is built around it.
3. **Color-coding fails its only job.** Five pastels of near-equal lightness in the same corner: sand, peach and blush blur across a counter, and none reaches the cap, the surface you see from above.
4. **Hierarchy is inverted.** Brand is the largest element; here it is an endorsement, not the decision.
5. **Won't scale.** Type sizes drift per SKU, "Whey isolate" wraps, and whey's flavor sits where other SKUs put the descriptor, so a Chocolate variant needs a re-layout.
6. **The decorative arc occupies the lower-right**, exactly where net quantity must sit.
7. **No zones** for lot/expiry, UPC or QR, and the containers are illustrative: real estate is unknown until dielines arrive.

## 5. Acceptance criteria

- [ ] All eight front elements, in order, on all five SKUs; nothing else on the front
- [ ] Built on supplier dielines; two templates (tub, bottle); no per-SKU type-size changes; a sixth SKU is a text-and-accent swap
- [ ] Product name legible at 2 m (cap height ≥ 7 mm tubs, ≥ 5 mm bottles); spec line at 1 m
- [ ] Net quantity in the bottom 30% of the PDP, type size per 21 CFR 101.105
- [ ] Accent in all three positions; five bottles identified from 2 m within 3 s by someone unfamiliar; passes a grayscale test
- [ ] Flavor is an isolated chip; swapping it moves nothing else
- [ ] Zero claim words (supports, promotes, clinically, pharmaceutical-grade, pure); no certification marks not held
- [ ] Dimensioned side/back zones for lot/expiry, UPC, QR; text contrast ≥ 4.5:1 under warm light

## 6. Confirm with supplier / compliance before print

- Every serving number above; scoop gram weight; scoop included or not
- Creatine: monohydrate only; no "Creapure" unless licensed
- Whey: protein per scoop and PDCAAS (front-panel "25 g protein" triggers a protein %DV); "isolate" at ≥ 90% protein dry basis; characterizing-flavor wording for "Vanilla" (21 CFR 101.22); allergens including soy lecithin; supplement vs conventional-food status
- Magnesium: true bisglycinate vs buffered with oxide; elemental mg per 2 capsules; gelatin vs HPMC
- D3: mcg declaration, lanolin vs lichen source, potency overage
- Collagen: bovine source and country of origin; "grass-fed" or "Types I & III" only with documentation
- Heavy-metal results, then the Prop 65 decision (whey, collagen)
- Distributor legal name and address; "Vitae Lab" trademark; fate of "Mineral Atelier"; GS1 UPCs; lot/expiry coding method
- Containers: colored-cap availability and MOQs (fallback: printed lid band), label stock, moisture-resistant adhesive
- "cGMP" or third-party-tested statements only with certificates in hand; no FDA or NSF logos
