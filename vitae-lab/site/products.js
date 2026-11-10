// Vitae Lab storefront data. One source for every product fact the page prints.
//
// STATUS: working facts under supplier review, NOT approved production label copy.
// Sources: handoff "Corrected working product catalog" (7 Nov 2026 report) cross-checked against the
// public Supliful catalog pages on 9 Nov 2026 (see docs/CLAIMS-REGISTER.md). Shopify replaces this file
// at launch: price, availability and variantId come from the store, label facts from product metafields.
//
// available:false + price:null + variantId:null is the real state today (nothing is published or priced).
// `use`, `warnings` and `ingredients` are quoted from the supplier listing; do not paraphrase them.
// dia/bodyH/H are illustrative container sizes from the Ledger concept (mm), not supplier dielines.

window.VITAE_PRODUCTS = [
  {
    handle: 'creatine-monohydrate', time: 'dawn', order: 1, sku: 'RLC4CREA', name: 'Creatine monohydrate',
    no: '01', labelName: ['Creatine'], descriptor: 'Monohydrate', accent: '#4B6480',
    form: 'tub', dia: 90, bodyH: 120, H: 85,
    rows: ['1 scoop (5.6 g)', '5 g creatine monohydrate', '50 servings'], net: 'Net Wt 281 g (9.9 oz)',
    summary: 'Just creatine monohydrate. No flavor, no blend, nothing to decode. One scoop gives you 5 g.',
    consider: 'People who lift, sprint or do other short, hard efforts. Most creatine research uses this form, and most of it pairs the supplement with training.',
    facts: [['Serving size', '1 scoop (5.6 g)'], ['Creatine monohydrate', '5 g (5,000 mg)'], ['Servings per container', '50'], ['Net weight', '281 g (9.9 oz)'], ['Flavor', 'Unflavored']],
    key: '5 g creatine monohydrate', servings: '50', allergens: 'No allergens listed',
    ingredients: 'Creatine monohydrate.',
    use: 'As a dietary supplement, adults take one (1) scoop in eight (8) oz. of water or juice four (4) times daily during the first five (5) days (loading phase). After the loading phase, take one (1) or two (2) times daily or as directed by a health care professional.',
    warnings: 'Keep out of reach of children. Do not use if the safety seal is damaged or missing. Store in a cool, dry place and away from direct light.',
    research: ['creatine-training', 'creatine-older-adults'],
    review: ['The panel lists a 5.6 g scoop and 5 g of creatine monohydrate for a single-ingredient powder. The manufacturer was asked on 4 Nov 2026 what accounts for the 0.6 g difference. No answer yet.'],
    verified: 'Supplier catalog page, 9 Nov 2026', available: false, price: null, variantId: null,
  },
  {
    handle: 'vanilla-whey-isolate', time: 'morning', order: 2, sku: 'JTP7ADWV', name: 'Vanilla whey isolate',
    no: '02', labelName: ['Whey', 'Isolate'], descriptor: 'Vanilla', accent: '#B8923D',
    form: 'tub', dia: 120, bodyH: 160, H: 115,
    rows: ['2 scoops (34 g)', '22 g protein per serving', '24 servings'], net: 'Net Wt 805 g (28.40 oz)',
    summary: 'Whey isolate that tastes like vanilla, sweetened with stevia. Two scoops (34 g) give you 22 g of protein.',
    consider: 'People who want an easier way to reach a daily protein target, especially alongside resistance training. Protein from food counts the same. This is a convenience.',
    facts: [['Serving size', '2 scoops (34 g)'], ['Protein', '22 g'], ['Servings per container', '24'], ['Net weight', '805 g (28.40 oz)'], ['Flavor', 'Vanilla'], ['Sweetener', 'Stevia leaf extract']],
    key: '22 g protein', servings: '24', allergens: 'Contains milk',
    ingredients: 'Whey protein isolate, natural flavors, MCT oil powder, apple pectin powder, sunflower lecithin, stevia extract (leaf), sea salt, silicon dioxide.',
    use: 'As a dietary supplement, adults mix two (2) scoops with 6-8 oz. of water or favorite beverage daily. For best results, take 20-30 minutes before a meal with 8 oz. of water or as directed by your healthcare professional.',
    warnings: 'Do not exceed recommended dose. Pregnant or nursing mothers, children under the age of 18, and individuals with a known medical condition should consult a physician before using this or any dietary supplement. Keep out of the reach of children. Do not use if safety seal is damaged or missing. Store in a cool, dry place.',
    research: ['protein-training'],
    review: ['The panel marks protein with "Daily Value not established". The manufacturer was asked on 4 Nov 2026 to confirm the footnote and the rounding basis. No answer yet.'],
    verified: 'Supplier catalog page, 9 Nov 2026', available: false, price: null, variantId: null,
  },
  {
    handle: 'chocolate-whey-blend', time: 'midmorning', order: 3, sku: 'JAG42PECH', name: 'Chocolate performance whey blend',
    // No. 06, the brown accent, the net weight and the ingredient list are as shown on the owner's review artwork (draft of 9 Nov 2026).
    no: '06', labelName: ['Whey', 'Blend'], descriptor: 'Chocolate', accent: '#8A5A44',
    form: 'tub', dia: 105, bodyH: 150, H: 105,
    rows: ['2 scoops (approx. 35 g)', '22 g protein per serving', '15 servings'], net: 'Net Wt 18.55 oz (525 g)',
    summary: 'Chocolate, and a blend: whey isolate plus whey concentrate, so not a pure isolate. Two scoops (about 35 g) give you 22 g of protein and 130 calories.',
    consider: 'People who want a chocolate shake. The jar holds 15 servings.',
    facts: [['Serving size', '2 scoops (approx. 35 g)'], ['Protein', '22 g'], ['Calories', '130'], ['Servings per container', '15'], ['Net weight', '525 g (18.55 oz)']],
    key: '22 g protein', servings: '15', allergens: 'Contains milk',
    ingredients: 'Whey protein blend (whey protein isolate and whey protein concentrate), Solnul® (resistant potato starch), natural flavors, pink Himalayan crystal salt, guar gum, xanthan gum, stevia leaf extract.',
    use: null, warnings: null,
    research: ['protein-training'],
    review: ['Directions and warnings have not been transcribed from the final supplier label. The ingredient list is from the review artwork, not a supplier page.', 'The panel lists 150 mg cholesterol (50% Daily Value). Unresolved; needs confirmation from the manufacturer.'],
    verified: 'Handoff catalog and review artwork; supplier page not located', available: false, price: null, variantId: null,
  },
  {
    handle: 'collagen-peptides', time: 'noon', order: 4, sku: 'RLC8COLL', name: 'Collagen peptides',
    no: '03', labelName: ['Collagen'], descriptor: 'Peptides', accent: '#6E8A6A',
    form: 'tub', dia: 105, bodyH: 150, H: 105,
    rows: ['1 scoop (20 g)', '18 g protein · bovine hide', '14 servings'], net: 'Net Wt 9.88 oz (280 g)',
    summary: 'Bovine collagen peptides with no flavor, so they disappear into coffee. A 20 g scoop has 18 g of protein. Pair it with whey or your meals for the full set of amino acids.',
    consider: 'People who like to stir collagen into coffee, a shake or food as part of their day.',
    facts: [['Serving size', '1 scoop (20 g)'], ['Protein', '18 g'], ['Servings per container', '14'], ['Net weight', '280 g (0.62 lb)'], ['Source', 'Bovine hide'], ['Flavor', 'Unflavored']],
    key: '18 g protein from 20 g collagen', servings: '14', allergens: 'No allergens listed',
    ingredients: 'Bovine hide collagen peptides.',
    use: 'Add one (1) level scoop to 8-10 oz. (236-295 ml) of chilled water or preferred beverage in a shaker cup and mix for about 5 seconds. Drink and enjoy a shake each day.',
    warnings: 'Keep out of reach of children. Do not use if the safety seal is damaged or missing. Store in a cool, dry place.',
    research: ['collagen-skin'],
    review: ['The supplier calls this product "grass-fed". No document supporting that wording has been seen, so the page does not use it.'],
    verified: 'Supplier catalog page, 9 Nov 2026', available: false, price: null, variantId: null,
  },
  {
    handle: 'magnesium-glycinate', time: 'dusk', order: 6, sku: 'VOX4MGNE', name: 'Magnesium glycinate',
    no: '04', labelName: ['Magnesium'], descriptor: 'Glycinate', accent: '#4E3A5A',
    form: 'bottle', dia: 51, bodyH: 102, H: 65,
    rows: ['3 capsules', '275 mg magnesium', '30 servings'], net: '90 Capsules',
    summary: 'Three capsules, 275 mg of magnesium. The 2,500 mg on the label is the weight of the whole glycinate compound, not of the magnesium in it.',
    consider: 'Anyone whose meals run short on magnesium-rich foods such as nuts, seeds, legumes and leafy greens. It is a simple way to top up.',
    facts: [['Serving size', '3 capsules'], ['Magnesium (elemental)', '275 mg'], ['From magnesium glycinate', '2,500 mg'], ['Servings per container', '30'], ['Count', '90 capsules']],
    key: '275 mg elemental magnesium', servings: '30', allergens: 'No allergens listed',
    ingredients: 'Magnesium (from 2,500 mg magnesium glycinate) 275 mg, hypromellose (capsule), magnesium stearate, silicon dioxide, rice flour.',
    use: 'As a dietary supplement, take three (3) capsules once daily or as directed by your healthcare professional.',
    warnings: 'Do not exceed recommended dose. Pregnant or nursing mothers, children under the age of 18, and individuals with a known medical condition should consult a physician before using this or any dietary supplement. Keep out of reach of children. Do not use if the safety seal is damaged or missing. Store in a cool, dry place.',
    research: ['magnesium-sleep'],
    review: ['The supplier describes the capsules as vegan. Not repeated here until the final label and a supporting document confirm it.'],
    verified: 'Supplier catalog page, 9 Nov 2026', available: false, price: null, variantId: null,
  },
  {
    handle: 'vitamin-d3', time: 'afternoon', order: 5, sku: 'RLC3VTD3', name: 'Vitamin D3',
    no: '05', labelName: ['Vitamin D3'], descriptor: 'Cholecalciferol', accent: '#C65A2E',
    form: 'bottle', dia: 48, bodyH: 82, H: 55,
    rows: ['1 softgel', '50 mcg (2,000 IU)', '100 servings'], net: '100 Softgels',
    summary: 'One small softgel with 50 mcg (2,000 IU) of vitamin D3. There is no K2 in it. It is made with gelatin and soybean oil, so it is not vegan and not soy-free.',
    consider: 'People who get little sun or little vitamin D from food. A blood test for 25-hydroxyvitamin D is the way to know your level. Ask your clinician.',
    facts: [['Serving size', '1 softgel'], ['Vitamin D3 (cholecalciferol)', '50 mcg (2,000 IU)'], ['Servings per container', '100'], ['Count', '100 softgels']],
    key: '50 mcg (2,000 IU) vitamin D3', servings: '100', allergens: 'Made with gelatin and soybean oil',
    ingredients: 'Vitamin D3 (as cholecalciferol), softgel (gelatin, glycerin, water), soybean oil, corn oil.',
    use: 'As a dietary supplement, adults take one (1) softgel capsule daily or as directed by a health care professional.',
    warnings: 'Keep out of reach of children. Do not use if the safety seal is damaged or missing. Store in a cool, dry place and away from direct light.',
    research: ['vitamin-d-vital'],
    review: [],
    verified: 'Supplier catalog page, 9 Nov 2026', available: false, price: null, variantId: null,
  },
];

// Research notes. Each one names what was studied, the dose, who took part, what was found and where it
// stops. Citations were checked against PubMed on 9 Nov 2026. Every statement still needs qualified
// regulatory review before publication (docs/CLAIMS-REGISTER.md).
window.VITAE_RESEARCH = [
  {
    id: 'creatine-training', ingredient: 'Creatine monohydrate', title: 'Creatine and hard training',
    says: 'A 2017 position stand from the International Society of Sports Nutrition reviewed the trial record. It reports that creatine supplementation consistently raises the amount of creatine stored in muscle, which may explain the improvements seen in high-intensity exercise and in training results.',
    studied: 'Creatine as an ingredient, mostly creatine monohydrate, usually alongside training. Common study doses are 3 to 5 g a day.',
    limits: 'This is a review written by sports nutrition researchers, not a trial of this product. Results vary from person to person, and the benefit shows up with training, not instead of it.',
    cite: 'Kreider RB et al. J Int Soc Sports Nutr. 2017;14:18.', doi: '10.1186/s12970-017-0173-z',
  },
  {
    id: 'creatine-older-adults', ingredient: 'Creatine monohydrate', title: 'Creatine with resistance training in older adults',
    says: 'A meta-analysis pooled 22 randomized trials with 721 men and women, mean ages 57 to 70. People who took creatine while resistance training two or three days a week gained about 1.4 kg more lean tissue than those who trained with a placebo, with small added gains in chest press and leg press strength.',
    studied: 'Creatine plus supervised resistance training for 7 to 52 weeks.',
    limits: 'Everyone in these trials trained. The results say nothing about creatine without exercise, and lean tissue is not the same as muscle. No trial here measured lifespan.',
    cite: 'Chilibeck PD et al. Open Access J Sports Med. 2017;8:213-226.', doi: '10.2147/OAJSM.S123529',
  },
  {
    id: 'protein-training', ingredient: 'Protein supplements (including whey)', title: 'Extra protein during resistance training',
    says: 'A meta-analysis of 49 randomized trials with 1,863 healthy adults found that adding a protein supplement during at least six weeks of resistance training increased strength and fat-free mass a little more than training alone: about 2.5 kg on a one-rep max and 0.3 kg of fat-free mass.',
    studied: 'Protein supplements of several kinds, not this product. Total daily protein mattered more than the source.',
    limits: 'The extra gain is small next to the training itself. Above roughly 1.6 g of protein per kg of body weight a day, more protein added nothing. The effect was smaller in older participants.',
    cite: 'Morton RW et al. Br J Sports Med. 2018;52(6):376-384.', doi: '10.1136/bjsports-2017-097608',
  },
  {
    id: 'collagen-skin', ingredient: 'Hydrolyzed collagen', title: 'Collagen and skin',
    says: 'A meta-analysis of 19 randomized, placebo-controlled trials with 1,125 participants aged 20 to 70 found better skin hydration and elasticity, and fewer wrinkles, after about 90 days of daily hydrolyzed collagen.',
    studied: 'Various hydrolyzed collagen products taken by mouth. 95% of participants were women.',
    limits: 'The trials used different products, so the result may not carry over to this one. Almost no men were studied. Skin measurements in a trial are not the same as a visible change you would notice.',
    cite: 'de Miranda RB et al. Int J Dermatol. 2021;60(12):1449-1461.', doi: '10.1111/ijd.15518',
  },
  {
    id: 'magnesium-sleep', ingredient: 'Magnesium', title: 'Magnesium and sleep',
    says: 'Magnesium is often sold for sleep. A 2021 systematic review found only three randomized trials, with 151 older adults who had insomnia. People taking magnesium fell asleep about 17 minutes sooner than those on placebo. Total sleep time did not clearly change.',
    studied: 'Oral magnesium in older adults with insomnia. The trials did not use magnesium glycinate specifically.',
    limits: 'The reviewers rated every trial at moderate to high risk of bias and the evidence as low to very low quality. That is why we make no sleep claim for our magnesium.',
    cite: 'Mah J, Pitre T. BMC Complement Med Ther. 2021;21(1):125.', doi: '10.1186/s12906-021-03297-z',
  },
  {
    id: 'vitamin-d-vital', ingredient: 'Vitamin D3', title: 'Vitamin D at 2,000 IU a day',
    says: 'The VITAL trial gave 25,871 U.S. adults (men 50 and older, women 55 and older) either 2,000 IU of vitamin D3 a day or a placebo for a median of 5.3 years. The vitamin D group did not have fewer invasive cancers or major cardiovascular events. The trial found no excess of high blood calcium or other adverse events at that dose.',
    studied: 'The same form and daily amount as our softgel, in generally healthy older adults.',
    limits: 'Vitamin D is a nutrient the body needs, and a supplement can help people who get too little. This trial is the reason we do not present it as protection against disease.',
    cite: 'Manson JE et al. N Engl J Med. 2019;380(1):33-44.', doi: '10.1056/NEJMoa1809944',
  },
];
