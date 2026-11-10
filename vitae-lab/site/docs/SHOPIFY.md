# Shopify implementation notes

**Nothing here has been run against the store.** The Shopify connector was signed out during this work
and no products exist. This file is the plan and the exact mapping, so the port is mechanical once
access is back.

## Platform choice

Stay on the existing Shopify theme architecture. The design needs nothing Shopify cannot do: one fixed
scene, static sections, a product template and the Ajax cart. A custom (headless) frontend would add a
host to run, a Storefront API token to guard, and a second place for product data to drift, for no
visual gain. Not recommended.

Shopify stays the source of truth for products, variants, prices, availability, cart, checkout, order
confirmation, taxes and shipping. The site never captures payment and never reports fulfillment.

## What maps to what

| Prototype | Shopify |
|---|---|
| `site.css`, `site.js`, `media/*` | `assets/vitae.css`, `assets/vitae.js`, theme assets (or Files for the video; see below) |
| Header + footer | `layout/theme.liquid` and the header/footer section group |
| `.stage` plates (opening, water) and the per-product `.frame` | Section markup; loops and posters as theme assets or Files; jar cut-outs as each product's first image (transparent WebP or PNG) |
| Home sections in `index.html` (opening, lede, themes, stories, labels, research, about, faq) | One section file each under `sections/`, listed in `templates/index.json`. Copy lives in section settings so it can be edited without code. |
| `products.js` product array | Real products. The opening rotator and "The range" become `{% for product in collections.all.products %}` (or a chosen collection). |
| Product view (`renderProduct`) | `sections/vitae-product.liquid` in `templates/product.json` |
| `#handle` links | `{{ product.url }}` (`/products/<handle>`). Handles in `products.js` are the proposed Shopify handles. |
| `local` cart adapter | Removed. `site.js` already switches to the `shopify` adapter when `window.Shopify` exists: `/cart.js`, `/cart/add.js`, `/cart/change.js`, then `location.href = '/checkout'`. |
| `available: false`, `price: null`, `variantId: null` | `product.available`, `product.price \| money`, `product.selected_or_first_available_variant.id` |
| "Not on sale yet" state | Same markup when `product.available` is false; reword to "Sold out" once the product has been on sale |
| Preview bar, preview notes, simulate switch | Deleted |
| `noindex` meta | Deleted at the approved launch only. Before that the store password does this job. |
| Order confirmation | Shopify's checkout and notification emails. Nothing to build. |
| Policies in the footer | `{{ shop.privacy_policy.url }}`, `shop.terms_of_service`, `shop.shipping_policy`, `shop.refund_policy`; print a link only when the policy exists |
| Product structured data | `{{ product \| structured_data }}` once prices exist. No ratings. |

## Label facts as product metafields

So that the label copy lives with the product and not in theme code. Namespace `label`:

| Key | Type | Holds |
|---|---|---|
| `label.facts` | JSON | Ordered pairs for "In a serving" (`[["Serving size","1 scoop (5.6 g)"], …]`) |
| `label.summary` | Single line text | The one-paragraph "what it is" |
| `label.consider` | Multi-line text | "Who might consider it" |
| `label.directions` | Multi-line text | Directions exactly as on the approved label |
| `label.ingredients` | Multi-line text | Full ingredient list as on the approved label |
| `label.allergens` | Single line text | Allergen statement |
| `label.warnings` | Multi-line text | Warnings exactly as on the approved label |
| `label.research` | List of single line text | IDs of the research notes to show |
| `label.accent` | Color | Ledger accent |
| `label.status` | Single line text | `concept`, `proof`, `supplier-approved` or `production`; the template can refuse to show a buy button unless this is `production` |

Research notes become a metaobject definition `research_note` with fields `ingredient`, `title`, `says`,
`studied`, `limits`, `cite`, `doi`. Values are in `products.js`.

## Video

The handoff records one failed MP4 upload on 8 Nov and is right that this proves nothing general. Two
supported routes: upload to **Content → Files** and reference it with a `video` section setting
(`{{ section.settings.loop | video_tag }}` or the file's CDN URL), or ship it as a theme asset (theme
assets are limited in size; the loops here are 300 to 430 KB each). Keep the loading rules from
`site.js`: poster first, `preload="none"`, set `src` after `load`, one size only, nothing under reduced
motion or Save-Data.

## Order of work once access is back

1. Read the store: plan, products, policies, the draft theme's files. Duplicate "Water Cinematic Draft".
2. Create the six products as **drafts** with supplier SKUs and the metafields above. No prices until
   approved.
3. Add the assets and sections to the duplicate (unpublished) theme. Never write to the live theme.
4. Verify the Supliful app connection on the right account, then map each product. An installed app is
   not proof; a mapped product with a supplier SKU is.
5. Password-protected preview. Run the checks in `QA-REPORT.md` again on the theme.
6. Bogus-gateway test order: success, decline, and an abandoned checkout. Confirm tax and shipping
   display. This is a **test-mode** order.
7. With your written go-ahead only: one real order to your own address to verify supplier routing end to
   end.
8. Publish only on your explicit approval. Rollback is re-publishing Horizon.

## Settings and secrets

The storefront needs **no secret** of its own: the Ajax cart and checkout run on the store's own
origin. Do not add a Storefront or Admin token to theme code.

If scripts are ever used for the port (Shopify CLI), keep these out of the repo and out of chat.
Names only:

```
SHOPIFY_FLAG_STORE          # store domain
SHOPIFY_CLI_THEME_TOKEN     # Theme Access password, least privilege (themes only)
```

Supliful has no credential in this codebase; it connects through its Shopify app.
