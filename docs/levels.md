# Levels tab

The personal root app has a read-only Levels tab based on persisted dose logs. It displays **estimated dose equivalents remaining**, never blood concentrations, measured values, therapeutic ranges or redosing advice. For nandrolone decanoate the available 6-day reference describes depot release, so the result is explicitly labeled depot remaining.

## Calculation and provenance

`src/app/levels.js` contains the pure engine and a deliberately limited, sourced reference catalog. Each eligible dose contributes `dose × 2^(−elapsedHours / halfLifeHours)`. Repeated doses add; logs older than the displayed chart window still contribute. All calculations use the recorded dose, never the current planned dose. Cagrilintide uses the midpoint of the published 159–195 hour interval and shows both endpoints as a band, not a confidence interval.

Sources are FDA/HPRA product labels or original human studies, linked in each model. References reviewed October 14, 2026. Population means are not individual estimates of clearance. Route, preparation, absorption, bioavailability, metabolites, organ function, endogenous hormone production and duration of effects limit interpretation. No active-moiety or volume-of-distribution conversion is performed.

## Historical-data rules

- Skips, future timestamps, invalid timestamps and nonpositive/invalid amounts are excluded. Duplicate IDs use the latest edited record.
- A missing profile is resolved only from the owning protocol, never from whichever profile is selected.
- Archived/deleted protocols do not remove existing logged exposure.
- Mass is canonically stored in `doseMcg` even with an mg/g display tag. IU stays an independent dimension. Untagged hCG cannot be guessed as either mass or IU.
- Only a historical record's explicit route or route-bearing name can auto-match a model. Current protocol routes do not rewrite past doses. Unknown routes require the user to select a reference assumption. Explicit incompatible routes cannot be overridden by the selector.
- Blends and pens are visible but not assigned one half-life or split using today's formulation. Unmodeled research compounds remain visible with a precise unavailable state.
- Legacy timestamps without offsets use device-local time and show that limitation. Backfilled entries and `needsReview` flags are surfaced.
- The legacy Roman backfill migration requires matching history from before its original correction date. Empty installs and newly created regimens cannot generate historical doses; the intended legacy correction is retained.

## UI and storage

Reference choices are saved locally under `protocol_os_levels_models_v1`, scoped by profile, compound, historical route and unit. They never modify logs, plans or cloud data. Storage failure produces an explicit session-only message. The existing forget-device action clears these choices too.

The tab recomputes every 30 seconds while visible, and on focus/foreground. Charts cover 7, 30 or 90 days with exact dose steps, a keyboard/touch time scrubber and an accessible text readout. The sample sweep is O(logs + samples); no chart library or external runtime request is added. Filters and source/history disclosures keep large histories usable.

## Verification

`tests/levels.test.mjs`: decay, accumulation, invalid/future/skipped records, identities, units, DST, reference matching, uncertainty bounds, blends, profile isolation and large history.

`tests/levels-e2e.mjs`: Chromium and WebKit navigation, mobile/desktop widths, search/filter, chart range and keyboard scrub, sources, reference persistence, read-only records, live clock refresh and first-run empty state. Included in `npm run e2e` and CI.
