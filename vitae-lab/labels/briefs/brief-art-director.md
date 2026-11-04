# Vitae Lab — Art Director brief: label family redesign

Reviewed: "Mineral Atelier" concept board (3 tubs + 2 bottles) and `scott/assets/vitae-logo.png`.

## 1. Critique of the current concept (ranked, worst first)

1. **The pastel arc device fails its one job.** Concentric arcs bleeding off a corner are the current wellness-DTC default (Golde / Hum / Moon Juice territory), not ownable, and the five tints all sit at L≈85–90: from 2 m they are one beige smudge and the ruled arcs moiré. They also occupy the space net-quantity and regulatory copy will need.
2. **The logo fights the product name.** The lockup runs ~50% of the front-panel width, as heavy as the name, and wider than it on the bottles. The name face is an Instrument-Serif-style condensed serif, DTC's most over-used face, tracked until bowls touch ("Magnesium"). Tiers are inconsistent (D3 has no descriptor; Whey runs four tiers at three sizes), case drifts ("Whey isolate" vs "Vitamin D3"), and the ochre rule is an orphan.
3. **Materials contradict "quiet premium."** Cool-white HDPE, cool silver ribbed caps and a warm cream label are three neutrals that disagree; the silver cap says "protein tub," and the label reads as a sticker.
4. **Proportions and family.** The tub label starts too close to the shoulder; logo scale and top margin differ between tubs and bottles. The five cohere only by repeating a layout, not by a system that could absorb SKU 06.
5. **Legibility.** At 2 m: tub names read, bottle names are marginal, descriptors vanish, accents are indistinguishable. At 30 cm: adequate, but with no data block (form, net quantity, lot) it feels unfinished rather than restrained.
6. **Logo handling.** Dropping the teal is defensible, but the redraw is heavier than the asset, and the only asset is a 512 px cream-and-teal PNG, invisible on bone stock; vector and an ink-colour version are prerequisites. The tagline "PEPTIDES | HORMONES | OPTIMIZE | LONGEVITY" must never appear on a supplement label.
7. **Benchmarks.** Thorne and Momentous win on clinical clarity (big functional sans, high contrast); Ritual and Seed on the container itself (tinted glass, refills); Aesop on typographic density plus restraint; Le Labo on the hand-finished lab ledger. This concept sits in none of these: it is soft pastel wellness, the opposite of quiet.

## 2. Direction: "Ledger"

The label is a page from a meticulous lab notebook: a ruled field, a catalogue number, a specimen name in a serif, a tipped-in colour chip. Nothing is decorated; everything is recorded. Premium is felt before it is read: paper with tooth, ink sitting in it, a number you find with your thumb.

"A quieter kind of premium" means one typeface pair, one brand colour at under 2% of the area, large unprinted areas, no gloss, no foil, no gradients. Material does the talking: textured stock, one blind deboss, matte caps. Left-aligned and numbered, so SKU 06 slots in without a redesign. Known risk: Le Labo adjacency; the serif name, chip and deboss keep it apothecary-science rather than perfumery.

## 3. Design system

### Colour tokens
| Token | Hex | Use |
|---|---|---|
| Stock (bone) | #F1EDE4 | unprinted label stock; render base |
| Ink | #14231D | all type, monogram letters, wordmark |
| Ink 60 | #5E6661 | secondary copy |
| Rule | #C9C3B6 | ledger hairlines |
| Helix teal | #2DB5A1 | the helix stroke of the monogram only (≈ Pantone 3268–3272 C; confirm on swatch) |
| 01 Creatine — Slate | #4B6480 | chip + cap disc |
| 02 Whey — Ochre | #B8923D | chip + cap disc |
| 03 Magnesium — Sage | #6E8A6A | chip + cap disc |
| 04 Vitamin D3 — Burnt orange | #C65A2E | chip + cap disc |
| 05 Collagen — Mauve | #8E6A8C | chip + cap disc |

Five hue families (blue, yellow, green, orange, violet), mid-value, low chroma, all solid on #F1EDE4. Teal is never a product accent. No tints; every colour prints at 100%.

### Typography (all on Google Fonts)
- Display serif: **Newsreader**, optical size Display (opsz 72), weight 400. Product name and deboss numeral only.
- Functional sans: **IBM Plex Sans** 500. Descriptor and back-panel headings.
- Data mono: **IBM Plex Mono** 400. Catalogue number, ledger fields, lot, best-before.
- Wordmark: the logo's own serif from vector (request it; if none exists, trace once and lock). Never re-typeset.

Sizes as cap height ÷ label height H:
| Element | Cap height | Case / tracking |
|---|---|---|
| Logo lockup | width 0.36 H (wordmark cap ≈ 0.055 H) | as drawn; helix teal, rest Ink |
| Product name | tubs 0.09 H; bottles 0.065 H. Fit rule: longest word ≤ column width; never hyphenate | Title Case, −0.01 em, leading 1.0 |
| Descriptor | 0.035 H | ALL CAPS, +0.10 em |
| Catalogue number "No. 03" | 0.035 H | mono, caps |
| Ledger data | 0.028 H | mono, ALL CAPS, +0.02 em |
| Deboss numeral | 0.16 H | Newsreader 400, blind, no ink |

Mandatory copy never below 1.2 mm x-height (EU/UK) or 1.6 mm (FDA); check jurisdiction.

### Grid (front panel, both formats)
- Front panel width F = 0.78 × container diameter (the readable chord), centred opposite the label seam. Margin m = 0.08 H on tubs, 0.06 H on bottles. Baseline unit u = 0.04 H. One left-aligned column; nothing is centred.
- Logo: top-left at (m, m).
- Name block anchored from the bottom: descriptor baseline fixed at 0.64 H; name last-line baseline at 0.55 H; a two-line name ("Whey / Isolate") grows upward, first baseline ≈ 0.41 H. The space between logo and name stays empty. That gap is the quiet.
- Deboss: catalogue numeral, cap 0.16 H, right-aligned to the column, baseline 0.42 H, in the empty upper-right. Visible only in raking light.
- Ledger zone 0.70–1.00 H: 0.3 pt hairlines in Rule every u from 0.72 H to 0.96 H, full label width, continuing around the back. Colour chip 0.08 H square, top-left at (m, 0.72 H), overprinting the rules like a tipped-in swatch; "No. 03" to its right, baseline on the 0.80 H rule; FORM · CAPSULES / NET · [pending] / LOT · [blank] on the 0.84 / 0.88 / 0.92 rules. Regulatory panel on the back, same ruling.
- Cap disc: 30 mm (tub) / 20 mm (bottle) circle in the accent, numeral in Stock colour. Counters are seen from above; this is the 2 m cue.

### Name and descriptor rules
Line 1 (serif) is the substance: Creatine / Whey Isolate / Magnesium / Vitamin D3 / Collagen. Line 2 (sans caps) is the form or qualifier: MONOHYDRATE / VANILLA / GLYCINATE / CHOLECALCIFEROL / PEPTIDES. Powder, capsules, softgels live only in the ledger. No dosages, claims or certifications on the front, ever.

## 4. Per-product specs (containers and dimensions are suggestions pending supplier dielines)
| No. | Product | Accent | Container | Label W × H | Name cap | Notes |
|---|---|---|---|---|---|---|
| 01 | Creatine Monohydrate | Slate #4B6480 | 600 ml HDPE tub, ≈90 × 120 mm, matte white cap | 270 × 85 mm wrap, 6 mm back gap | 7.7 mm | 300 g fill |
| 02 | Whey Isolate Vanilla | Ochre #B8923D | 1.4 L HDPE tub, ≈120 × 160 mm | 355 × 115 mm wrap | 10.4 mm, two-line name | 500 g; 1 kg needs ≈2.8 L |
| 03 | Magnesium Glycinate | Sage #6E8A6A | 150 cc amber glass or amber PET packer, ≈51 × 102 mm, matte black cap | 142 × 65 mm wrap | 4.2 mm | 120 size-00 capsules |
| 04 | Vitamin D3 | Burnt orange #C65A2E | 100 cc amber packer, same family, ≈48 × 82 mm | 135 × 55 mm wrap | 3.6 mm | 90–120 softgels; amber doubles as UV protection |
| 05 | Collagen Peptides | Mauve #8E6A8C | 1 L HDPE tub, ≈105 × 150 mm | 310 × 105 mm wrap | 9.5 mm | 300 g |

Tubs use m = 0.08 H and name cap 0.09 H; bottles m = 0.06 H and 0.065 H, fit-limited by "Magnesium" at ≈30 mm in a 32 mm column. Everything else is identical. Silver ribbed caps go; caps are matte and match the container. Amber on the bottles is the one material difference, and it is functional.

## 5. Print finishes
- Stock: textured wet-strength self-adhesive paper (Fedrigoni Manter Tintoretto Gesso, UPM Raflatac Gesso, or Avery Fasson Rustique equivalents) with a full-coverage matte water-resistant varnish. Powder tubs live next to the blender.
- Print: HP Indigo for runs under 500 per SKU. Ink as a rich black build, not 100 K. Teal as an Indigo spot if offered, else CMYK-matched to the swatch.
- The one finish: blind deboss of the numeral, one die per SKU. No foil, no spot UV. The design must stand with zero finishes.
- Caps: matte, same colour as the container; accent disc applied after capping.
- Avoid: soft-touch laminate (kills the texture, shows skin oil, lifts at tub edges), gloss, metallic foils, silver caps, clear no-label-look PP, pastel tints, gradients, drop shadows, full-bleed colour fields, any second accent colour.

## 6. Renders for the concept board
1. Five front panels, flat vector, true relative scale, 10 mm scale bar; deboss shown as a separate 10% Ink "finish" layer.
2. Family lineup: 01 to 05 left to right, tubs then bottles, equal 40 mm gaps, one surface, straight-on.
3. Hero: 03 Magnesium bottle in front, 01 Creatine tub behind-left, 3/4 view, raking light to show the deboss and the paper tooth.
4. Macro: chip, ledger text and deboss at 2 cm.
5. Top-down of three tubs showing the cap discs.

Packshot brief (AI-rendered): 90 mm equivalent lens, camera at label mid-height tilted 6° down, 1.2 m away, f/8 so the label is sharp edge to edge and the background falls off. One 1.2 m softbox camera-left at 45°, 30° elevation; white bounce card camera-right; one soft highlight band on the cylinder, no hotspot on the matte label. Surface: honed limestone or warm grey plaster (#D9D5CC), seamless backdrop one stop darker at the top. Contact shadow soft, dark at the contact line, 12 cm spread. 5200 K, ISO 200 grain, slightly desaturated, paper texture visible at 100%, label seam faintly visible on the 3/4 view. No mirror reflections, no perfect symmetry, no HDR glow, no floating products.
