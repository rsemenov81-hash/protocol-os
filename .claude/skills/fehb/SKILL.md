---
name: fehb
description: Federal health plan (FEHB) advisor. Captures the user's claims and benefits from their insurer's member portal, audits denied and processed claims against the plan brochure, interviews them about next year's healthcare, then prices every plan available to them and recommends one with the reasoning. Use when the user says "audit my claims", "was this claim denied correctly", "which health plan should I pick", "compare FEHB plans", "Open Season", or runs /fehb.
argument-hint: [capture | audit | compare]
---

# fehb: claims audit, then next year's plan

Workspace: `fehb/` at the repo root. It is gitignored and holds health data.
- **Never** commit, push, paste into a PR, or send to another service anything from `fehb/`.
- **Never** ask for, accept or type the user's portal password or MFA code. They log in themselves.

Scripts in this skill's directory (run from the repo root):
- `capture.mjs`: opens a visible browser; the user logs in and clicks around; it saves what the portal returns.
- `fehb.py`: the arithmetic. `plans`, `audit`, `usage`, `cost`, `selftest`. Stdlib only.

You do the reading and the judgement. The scripts do the sums. Do not do plan arithmetic in your head.

## 1. Plan data

Ask for the user's OPM compare-plans URL if `fehb/plans.json` is missing (opm.gov → Compare Plans →
enter ZIP, employee type, pay period, current plan; copy the results URL). Then:

    python3 .claude/skills/fehb/fehb.py plans '<url>' [Self | "Self Plus One" | "Self & Family"]

It writes every plan open to them next year, plus `current`: this year's terms of the plan they are in.

## 2. Capture (needs the user's own computer: a browser window has to appear on their screen)

    npm ci && npx playwright install chromium     # once
    node .claude/skills/fehb/capture.mjs          # default: member.carefirst.com; pass another URL to override

If you are running on their computer, run these yourself (the second one in the background) and do not
ask them to type commands. In a cloud session you cannot: say so and have them start a Claude Code
session on their computer instead.

Tell them in plain words: a browser window opens, they log in, and they tell you when they are in.
**The only thing they have to do is log in.** You do the clicking.

The script prints `CONTROL http://127.0.0.1:<port>/<token>`. Drive the browser with curl against it:

    curl -s $CONTROL/look            # where am I: URL, numbered clickable things, page text
    curl -s "$CONTROL/click?n=12"    # click item 12 from the last look, then look again
    curl -s "$CONTROL/goto?url=/x"   # same site only
    curl -s $CONTROL/back | scroll | close (closes an extra tab) | done (closes the browser)

Everything the portal returns while you browse is saved for you; you do not need to copy text out of `look`.
Visit, and tick off as you go: every claim's detail page and its EOB for this year (last year too if
offered), benefits and coverage, deductible / out-of-pocket totals, prior authorizations, prescriptions,
plan documents. Scroll or page through long lists until they end. Then `done`.

- You can only navigate. There is no way to type, and the script refuses clicks that look like they
  change something (log out, submit, pay, delete, save, edit...). Do not look for ways around a refusal.
- If a page needs typing, a date range changed, or an MFA prompt answered, ask the user to do that one
  thing in the window, then carry on.
- If `look` says "Login page", wait for the user. Never read or relay anything from a login screen.

Output lands in `fehb/capture/` (`json/`, `docs/`, `text/`, `index.jsonl`).

If the portal blocks the automated browser: they use their normal browser, DevTools → Network →
"Export HAR (sanitized)" while browsing the same pages, and save it plus any downloaded EOB PDFs into
`fehb/capture/`. Read those instead.

## 3. Normalize

Read the capture (start from `index.jsonl`; JSON first, EOB PDFs for detail, page text as a fallback)
and write `fehb/claims.json`, one object per claim line:

    {"id", "date", "patient", "provider", "in_network": true, "status": "paid|denied|pending|adjusted",
     "benefit": "<exact benefit name from plans.json>", "billed", "allowed", "plan_paid",
     "member": {"deductible", "copay", "coinsurance", "not_covered"}, "remarks": "<denial/remark codes and text>"}

`benefit` must be a key of `current.benefits` so the scripts can price it; pick the closest one and say
so in `remarks` when it is a stretch. Also write `fehb/notes.md`: the portal's own deductible and
out-of-pocket totals, prior auths, drugs (name, strength, fills), and anything the capture is missing.
If claims are clearly missing (a month with nothing, an EOB that would not open), tell the user before going on.

## 4. Audit

    python3 .claude/skills/fehb/fehb.py audit

Each flag is a question, not a verdict. For every flag **and every denied claim**, read the relevant
part of this year's brochure (below) and give one of:
- **Correct**: quote the brochure line that supports how it was processed.
- **Looks wrong**: quote the line it contradicts, state the dollar difference, and what to ask for.
- **Cannot tell**: say what document or fact is missing (medical records, prior-auth letter, network status on the date of service).

Things the script cannot see, so check them yourself: preventive care billed as diagnostic, an
in-network facility with an out-of-network clinician (No Surprises Act), timely-filing and
missing-information denials that the provider must fix rather than the member, prior-auth denials for
services the brochure does not list as needing one, claims missing from the accumulators in `notes.md`.

Brochures: `https://www.opm.gov/healthcare-insurance/healthcare/plan-information/plans/pdf/<year>/brochures/<brochure number>.pdf`
(curl needs a browser User-Agent). Section 5 is benefits, Section 3 is prior approval, Section 7 is
filing, Section 8 is the disputed-claims process. Take appeal steps and deadlines **from Section 8 of
that brochure**, and work out each claim's deadline from its denial date. Draft an appeal letter only if asked.

## 5. Interview

`python3 .claude/skills/fehb/fehb.py usage` gives this year as a baseline. Show it to them in plain
words first ("you saw a specialist 6 times, about $240 each"). Then ask, a few questions at a time,
skipping what the claims already answer:
- Who is covered next year: any marriage, birth, child aging out, spouse's coverage changing?
- Planned or likely: surgery, pregnancy or fertility treatment, a new diagnosis being worked up, therapy, PT, new specialists?
- Drugs: staying on the current ones? Any new, especially brand or specialty (name and dose)?
- Doctors and hospitals they will not give up. Care outside the DC area, or travel abroad?
- Money: could they cover a bad year's out-of-pocket maximum from savings? Want an HSA and would fund it? Marginal tax rate (federal + state)? Using an FSA?
- Eligibility: Medicare within the year? Member of, or willing to join, APWU / GEHA / SAMBA? Eligible for Compass Rose or Foreign Service plans?
- Dental and vision needs (FEHB plans differ; FEDVIP is separate).

If the HealthEx tools are connected, offer to pull their medication and condition lists instead of asking them to recall.

## 6. Price

Write `fehb/scenarios.json`. Three scenarios, each a list of services with a count and an average allowed amount:

    {"tax_rate": 0.30, "exclude": ["401", "431"],
     "scenarios": {"low": [...], "expected": [{"benefit": "Specialist Office Visit", "n": 6, "allowed": 240}, ...], "high": [...]}}

- `expected`: baseline adjusted by the interview. `low`: a quiet year. `high`: expected plus the worst plausible event they named (or one hospital admission if they named none).
- `exclude`: plan codes they cannot join.
- Allowed amounts come from their own claims where they have them. Say so when you had to estimate.

Then `python3 .claude/skills/fehb/fehb.py cost`. It prints total yearly cost per plan per scenario
(premiums after tax + cost sharing + uncovered − HSA/HRA money) and the worst case, and writes `fehb/comparison.json`.

## 7. Verify the finalists

OPM's summary data is coarse. For the top five by `expected`, plus their current plan, open next year's
brochure and check, then record corrections in `fehb/overrides.json` and re-run `cost`:

    {"B61": {"ded_before_copay": true, "deductible": 1750, "benefits": {"Primary Care Office Visit": "$0 Copayment"}}}

- Does the deductible apply before copays? (The script assumes yes for HSA plans, no for the rest.)
- Anything `cost` printed as `GUESSED`.
- Their actual drugs on that plan's formulary: tier, prior auth, step therapy.
- Their must-keep doctors and hospital in that plan's directory. Out of network on an HMO means not covered.
- Referral rules, visit limits (PT, chiro, mental health), and whether it needs a membership fee.

Never recommend a plan whose terms you have not checked in its brochure.

## 8. Report

Write `fehb/report.md` and summarise it in chat:
1. **Recommendation** and runner-up, each with the yearly cost in all three scenarios and the worst case.
2. **Why**, in terms of their own answers: what they use, what they are protecting against, what they refuse to give up.
3. **What would change the answer** (e.g. "if the surgery does not happen, plan X is $900 cheaper").
4. What changes in their current plan next year (premium, deductible, out-of-pocket maximum, benefits).
5. The comparison table for every priced plan, with assumptions and anything still unverified.
6. **Claims audit**: each finding, its verdict, the brochure quote, dollars at stake, the deadline and next step.

Say plainly that this is an estimate from their data, not professional benefits or legal advice, and that
they should confirm the premium and the two or three deciding terms in the brochure before electing.
