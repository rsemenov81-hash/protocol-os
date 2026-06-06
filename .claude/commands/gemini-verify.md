---
description: Adversarial second-opinion check on a HIGH-STAKES protocol decision (dose math, drug interactions, hard-stops) via Gemini 3.1 Pro deep-thinking
argument-hint: <decision/change to verify, e.g. "move Retatrutide to 3mg this week">
allowed-tools: Bash(agy:*), Read
---

# /gemini-verify — independent high-stakes second opinion

You are running an **adversarial second-opinion verification** of a high-stakes
protocol decision, using **Google Antigravity CLI (`agy`)**, authenticated with
the user's **Gemini Ultra** account, model **Gemini 3.1 Pro with deep thinking**.

The decision/change to verify:

> $ARGUMENTS

Gemini is a *second pair of eyes*, not the authority. Your job is to get its
independent reasoning, then reconcile it against this protocol and report
agreement / disagreement clearly. Roman makes the final call.

## Steps

1. **Read `STATE_Roman.md`** — pull the relevant current dose(s), reconstitution
   reference(s), schedule, and the full **HARD STOPS** list. Extract only what's
   relevant to the decision being verified.

2. **Build a focused verification prompt** for Gemini that asks it to *independently*:
   - Re-derive the **dose math** (mg ↔ U-100 insulin units ↔ mL) from scratch.
   - Check the change against **known drug/peptide interactions** (esp. anything
     touching the hard-stops: serotonin-syndrome with sertraline 150 mg,
     IGF-1 + Dihexa oncogenic synergy, BMP9/10 / ActRIIB toxicity, CJC DAC,
     TMAO/carnitine, HCG-with-TRT, route/manufacturer mismatch).
   - Flag anything it would label **speculation vs working-hypothesis vs established**.
   Include the relevant current-state facts so Gemini reasons on real numbers, not
   assumptions. Ask it to be terse and to lead with any red flags.

3. **Call Gemini** via Bash. Preferred form:
   ```
   agy --model "Gemini 3.1 Pro (High)" -p "<your verification prompt>"
   ```
   The `(High)` in the model name is the deep-thinking level (no separate
   `--thinking` flag). If it errors, run `agy models` to see the exact names on
   this account, adapt, and retry. Do **not** fall back to the deprecated `gemini`
   command — it stopped serving Ultra on 2026-06-18.

4. **Reconcile and report** in this exact shape:
   - ✅ **Agreed** — points where Gemini and this protocol's math/logic match.
   - ⚠️ **Worth a look** — things Gemini weighted differently or surfaced that are
     plausible but not blocking.
   - 🔴 **Conflict** — any disagreement on dose math, an interaction, or a hard-stop.
     STOP here, show both views side by side, and do **not** endorse the change.
   - **Bottom line:** one or two sentences. If anything is 🔴, the verdict is
     "hold and reconcile," never "proceed."

Keep it tight. This is a safety check, not an essay. Cite the specific numbers.
