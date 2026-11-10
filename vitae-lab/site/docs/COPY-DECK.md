# Copy deck (v2)

"Before" is the owner's draft at `vitae-lab-storefront-review.rsemenov81.chatgpt.site`, read on 10 Nov
2026. "After" is what the prototype says now. Where the supplier's catalog copy is the relevant "before",
it is marked (supplier).

Marks: **[V]** a factual claim to verify before publication (see `CLAIMS-REGISTER.md`). **[O]** needs
the owner's facts. **[P]** preview-only, deleted at launch.

## What made the draft read as machine-written, and what changed

| Pattern in the draft | Examples | What v2 does |
|---|---|---|
| Two-beat slogans as headings, over and over | "Clear facts. Thoughtful choices." · "Good questions. Clear answers." · "Your routine. Your rhythm." · "Everyday essentials. Thoughtfully considered." | One heading keeps that shape, because it is the owner's own line ("What the research says. What it doesn't."). The rest are plain: "The range", "Start from a goal", "Questions", "Who makes it". |
| Soft words standing in for facts | "thoughtful", "considered", "for the rhythm of everyday life", "a thoughtful place to begin" | Cut. Sentences carry a number or a refusal instead. |
| Numbers spelled out to sound literary | "Twenty-two grams of protein per two-scoop serving" | Digits: "Two scoops (34 g) give you 22 g of protein." |
| The page describing itself | "Each product has its own place. Start with the facts." · "We keep that distinction clear." | It just does it. |
| A section for something that does not exist | "A future possibility: a simpler way to replenish" (refill concept) | Removed. Bundles and subscriptions are not approved offers. |
| Retired phrases still present | Title "Everyday, considered."; "research-informed" in the description and the first FAQ | Gone, and a test fails if they return. |

## Opening

| Where | Before | After |
|---|---|---|
| Label | Your goals: | Your goals |
| Rotating word | Strength / Longevity / Everyday vitality / Wellness | Same four words, set large in italic |
| Small caps list under it | STRENGTH LONGEVITY EVERYDAY VITALITY WELLNESS | Removed (it repeated the rotator) |
| Label | Your solution: | Your solution |
| Rotating names | Creatine Monohydrate / Whey Isolate / Collagen / Magnesium Glycinate / Vitamin D3 / Chocolate Performance Whey | Creatine monohydrate / Vanilla whey isolate / Chocolate performance whey blend / Collagen peptides / Vitamin D3 / Magnesium glycinate. Each is a link, and its jar stands below it. |
| Lines under the rotators | "Different goals. A thoughtful place to begin." · "Your goals are personal. Explore the facts. Find your own starting point." · "For the rhythm of everyday life." · "Discover below ↓" | Removed. The opening is the two labels, the two rotators and the jar. |

## Below the opening

| Where | Before | After |
|---|---|---|
| Heading | "Find what fits your routine." | Understand what you’re taking. |
| Line | "Get to know the ingredients, serving sizes and formats in our current range. Each product has its own place. Start with the facts." | Find the facts, compare the options, and choose what fits your routine. |
| Image note | "Product facts reflect supplied review artwork and remain subject to final label approval. Pack images are AI visualizations, not photographs of manufactured stock or approved print labels." | The jars on this page are visualizations of review artwork. They are not photographs of manufactured stock. |

## Start from a goal (new; the draft had no goal browsing)

| Theme | After |
|---|---|
| Note | A way to browse the range. Not medical advice, and not a recommendation for you. |
| Strength | Lifting is the part that works. Creatine and protein are the two additions with decades of trials behind them, and in those trials people were training. **[V]** |
| Longevity | Nothing on this shelf makes you live longer. What is in your hands is narrower: staying strong and getting enough of the basics as the years go by. **[V]** |
| Everyday vitality | The plain ones. You take them most days, you can read the amount on the front, and now and then you check whether you still need them. |
| Wellness | A vague word. Here it means things people add for general nutrition, not to fix a medical problem. |

## The range

| Where | Before | After |
|---|---|---|
| Kicker / heading | "The Ledger collection" / "No. 01 / Ledger collection" | The range · "Short on purpose. It grows when there is something worth adding." |
| Creatine | "Creatine monohydrate powder. One scoop, 5 g creatine monohydrate." | Just creatine monohydrate. No flavor, no blend, nothing to decode. One scoop gives you 5 g. **[V]** |
| Vanilla whey | "Vanilla whey protein isolate. Twenty-two grams of protein per two-scoop serving." | Whey isolate that tastes like vanilla, sweetened with stevia. Two scoops (34 g) give you 22 g of protein. **[V]** |
| Chocolate whey | "Chocolate whey protein blend. Twenty-two grams of protein per two-scoop serving." | Chocolate, and a blend: whey isolate plus whey concentrate, so not a pure isolate. Two scoops (about 35 g) give you 22 g of protein and 130 calories. **[V]** |
| Collagen | "Bovine hide collagen peptides. Twenty grams of collagen per scoop; eighteen grams of protein." | Bovine collagen peptides with no flavor, so they disappear into coffee. A 20 g scoop has 18 g of protein. It is not a complete protein and does not stand in for whey. **[V]** |
| Vitamin D3 | "Cholecalciferol softgels. Fifty micrograms (2,000 IU) of vitamin D3 per softgel." | One small softgel with 50 mcg (2,000 IU) of vitamin D3. There is no K2 in it. It is made with gelatin and soybean oil, so it is not vegan and not soy-free. **[V]** |
| Magnesium | "Magnesium glycinate capsules. Two hundred seventy-five milligrams of elemental magnesium per three-capsule serving." | Three capsules, 275 mg of magnesium. The 2,500 mg on the label is the weight of the whole glycinate compound, not of the magnesium in it. **[V]** |
| Actions | "Facts & ingredients +" (a disclosure) | Read the label (opens the product page) · Add to cart / Not on sale yet |

Supplier marketing copy ("for busy minds", "seasonal depression", "boosts muscle mass" and the disease
language in its science sections) is not used anywhere.

## Product page

Order: jar on the ledge → name → what it is → price and buy → In a serving → Who might consider it → How
to use it → Ingredients → Allergens and warnings → Evidence and limits → FDA disclaimer.

| Section | After |
|---|---|
| Price **[O]** | Price not set |
| Buy, unavailable | Not on sale yet · This product is not available to buy yet. The label is still being finalized with the manufacturer. |
| Shipping line **[O]** | Shipping and returns details will be published before the store opens. |
| Who might consider it | One or two plain sentences per product (in `products.js`). Magnesium's says: "We do not sell this as a sleep aid. The evidence for that is weak." **[V]** |
| How to use it · Ingredients · Warnings | The supplier's label text, quoted exactly, then "Directions as printed on the manufacturer’s current label." Missing label copy is stated as missing. |
| Image note | The jar shown is a visualization of review artwork, not a photograph of manufactured stock. |

## Labels

| Where | Before | After |
|---|---|---|
| Heading | "Clear facts. Thoughtful choices." | Know what’s in your routine. |
| Body | "Know what’s inside. Serving sizes, ingredient forms and amounts, without making you hunt for the details." | Every product page carries the serving, the full ingredient list, the directions and the warnings, word for word from the label. |
| Note | — | One thing to watch: a jar is not a month. At a serving a day the creatine lasts 50 days and the collagen lasts 14. **[V]** |
| Table | — | Compare the range: Product · Serving · Per serving · Servings · Allergens and suitability |

## Research

| Where | Before | After |
|---|---|---|
| Heading | "Keep evidence in context." | What the research says. What it doesn’t. |
| Body | "Research on an ingredient is not the same as a trial of a finished product. We keep that distinction clear." | We read the trials so this page can be straight about them. They studied ingredients, not our jars, and each note says where the finding stops. |
| Notes | none | Six notes, each in three parts: What it says · What was studied · Where it stops, with citation and DOI **[V]** |
| Disclaimer | none on the page | The exact FDA text, boxed, in Research, on every product page and in the footer |
| Who makes it **[O]** | — | A contract manufacturer makes these products and a fulfillment partner ships them. We don’t own a factory. We haven’t published test results yet, so you won’t find a “lab tested” badge here. When we hold a certificate for a specific lot, it goes on that product’s page. |

## About

| Before | After |
|---|---|
| "Begin with everyday habits. Supplements belong alongside food, movement, sleep and consistency." | **Good habits do most of the work.** *Supplements should have a clear place alongside them.* Sleep, food and training do the heavy lifting. A supplement earns a spot when you can say what it is for and how much you are taking. That is the idea behind Vitae Lab: a short range, the amounts printed on the front, and nothing promised that the evidence can’t back. **[O]** |

## Questions

| Before | After |
|---|---|
| "Good questions. Clear answers." | Questions |
| "What does Vitae Lab make? Research-informed dietary supplements for everyday routines…" | Removed (retired phrase; the page already answers it) |
| "Can I start a refill plan today?" | Removed with the refill section |
| Creatine, magnesium, collagen, whey and D3 questions | Kept, in plainer wording. Added: Can I buy these now? **[P]** · How long does one container last? **[V]** · Who should check with a clinician first? · Where do you ship, and what is the return policy? **[O]** |

## Cart, footer, titles

| Where | After |
|---|---|
| Cart | Your cart · Close · Remove · Your cart is empty. · Browse products · Subtotal · Shown once prices are set · Shipping and taxes are calculated at checkout. · Go to checkout |
| Checkout in preview **[P]** | Checkout runs on Shopify. This preview is not connected to the store, so no order was placed and nothing was charged. |
| Cart error | We couldn’t update your cart. Check your connection and try again. |
| Footer **[O]** | Contact and policies are marked as not yet published. Fine print: "Dietary supplements are not a substitute for a varied diet. Keep out of reach of children. The mountain scenery is decorative and says nothing about where ingredients come from." |
| Footer slogan | "Everyday essentials. Thoughtfully considered." → removed |
| Page title | "Vitae Lab — Everyday, considered." → Vitae Lab \| Supplements with the amounts on the label |
