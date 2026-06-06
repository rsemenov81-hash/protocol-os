# FLGR242 — Final Protocol Analysis (for second-opinion review)

**Date:** 2026-06-06 · **Status:** Protocol locked, run started 6/6 · **Purpose:** Self-directed n=1 trial of a follistatin/myostatin-pathway compound for body recomposition. This document compiles the full reasoning trail for adversarial second-opinion review.

> Evidence drawn from **PubMed** (cited with DOIs) and **ClinicalTrials.gov**. This is a self-directed research protocol on a research-use-only compound — not medical advice.

---

## 1. Subject & supply

- 45M, ~77.5 kg, ~7–9% BF, trained, extensive concurrent peptide/hormone protocol (see §9).
- Supply: **10 mg total** FLGR242 (2 × 5 mg lyophilized vials), Biolongevity Labs (RUO).
- Goal: measurable lean-mass gain with a tightly monitored, reversible n=1, getting a real dataset rather than an anecdote.

## 2. Compound identity & claims — verified vs marketing

| Item | Status |
|---|---|
| Recombinant truncated Follistatin-344 (FST344) + albumin-binding linker, ~40 kDa | Plausible per label/MS; **identity not independently verified** |
| "Activin-sparing" (ablated activin binding → no FSH suppression) | **Vendor claim, unverified.** This is the historical Achilles' heel of follistatin; must be tested (FSH lab) |
| Half-life ~10–19 d via albumin/FcRn recycling | **Vendor/podcast claim, unverified.** Biologically plausible for an ABD fusion, but no PK data for this product |
| Purity 99.74%, endotoxin <0.05 EU/mL | Per CoA — **but CoA names the product "FLGR232," not FLGR242.** Treated as a genuine identity caveat, not clerical |

**Working stance:** half-life and activin-sparing are *hypotheses to be tested by the Wk4 labs*, not design inputs to be trusted.

## 3. Evidence base — comparator trials (what actually happens in humans)

Across every rigorously studied agent that blocks this pathway, the consistent finding is **modest lean-mass gains that do not reliably convert to strength/function**:

- **Taldefgrobep alfa** (anti-myostatin protein, closest analog): increased thigh muscle volume + dose-dependent free-myostatin suppression in healthy adults, but **failed futility in DMD and the program was terminated (2019).** *According to PubMed:* [DOI: 10.1007/s40120-023-00570-w](https://doi.org/10.1007/s40120-023-00570-w)
- **ACE-031** (ActRIIB ligand trap): trial **stopped early for safety** — epistaxis + telangiectasias (BMP9/10 vascular off-target). [DOI: 10.1002/mus.25268](https://doi.org/10.1002/mus.25268)
- **Domagrozumab** (anti-myostatin mAb): safe but **no efficacy** on strength/function. [DOI: 10.1002/mus.27259](https://doi.org/10.1002/mus.27259)
- **Bimagrumab** (ActRII mAb): reliably ↑ lean / ↓ fat — now developed by Lilly **for obesity, not athletic hypertrophy** (ClinicalTrials.gov: NCT05616013; obesity combo NCT06901349 later withdrawn).
- **Systematic review (myostatin modulation, 2025):** favorable safety, but **large trials have not shown robust efficacy.** [DOI: 10.3390/ijms26125858](https://doi.org/10.3390/ijms26125858)
- **Follistatin specifically:** only human data are intramuscular **gene therapy** in Becker MD (activin→FSH flagged as the central concern) [DOI: 10.3233/JND-150083](https://doi.org/10.3233/JND-150083), and a single offshore healthy-population **plasmid** study (ClinicalTrials.gov NCT06411366, Minicircle, n=43, open-label, **no posted results**). Systemic follistatin in healthy adults is essentially at the frontier of published evidence.

**Realistic expectation set:** a small, biomarker-confirmable lean-mass change ± some fat loss; unreliable strength effect. **Not** the "16 lb / 12 wk" podcast claim (unmeasured scale weight, commercially-interested source, ~30 mg over 12 wk — not reproducible on a 10 mg supply).

## 4. Mechanistic reasoning behind the dose

**Follistatin is a ligand trap, not a receptor agonist** — this is the key distinction and it inverts the usual "more is better" intuition (e.g. retatrutide, where 0.5 vs 4 mg matters because effect tracks receptor occupancy on a steep sigmoid).

- A trap neutralizes a **finite, continuously-produced** pool of myostatin → dose-response is **threshold + ceiling**, not a smooth occupancy curve.
- **Below threshold:** little effect. **At threshold:** brake removed. **Above threshold:** more drug binds nothing useful (no myostatin left) → only adds off-target (activin/BMP) and immunogenic load.
- Myostatin blockade is **permissive** (removes a brake), not driving. The hypertrophy ceiling is set downstream by training + protein synthesis — confirmed by trials where maximal myostatin suppression still gave modest muscle.
- Because the target is produced non-stop, **trough above threshold** matters more than peak → favors frequent, low dosing.

**Therefore:** optimize for *lowest dose that clears threshold, held continuously for adequate duration* — not maximal dose.

## 5. The locked protocol

- **Reconstitution:** one 5 mg vial + **2.0 mL bacteriostatic water → 2.5 mg/mL.** Solvent against glass wall, no shaking; store 2–8 °C. Second vial stays frozen until needed.
- **Dose:** **0.5 mg (20u on U-100) SubQ, twice weekly — Wed + Sat** (= 1 mg/week).
- **Run:** **10 weeks** (1 mg/wk × 10 = 10 mg = full supply).
- **Test dose:** 0.2 mg observed screen was recommended; **waived by user.** First exposure is the full 0.5 mg → first-dose safeguards: not alone, antihistamine on hand, ~2–4 h watch.
- **Timing:** AM/PM, fed/fasted, peri-workout all **pharmacologically irrelevant** at this half-life (flat serum levels). Fixed days chosen purely for adherence + side-effect attribution.

## 6. Decision trail (options considered and rejected)

| Option | Verdict | Why |
|---|---|---|
| **2.5 mg/wk** (from podcast) | Rejected | Trap ceiling → no extra muscle; 10 mg lasts only 4 wk, below steady-state at long t½; can't reach the *duration* that drove the anecdote (which used ~30 mg/12 wk) |
| **5 mg every 2 wk** | Rejected | 2.5× avg exposure, ~3× peak, trough falls below threshold between doses (bad for a trap), no abort room |
| **1 mg once weekly** | Viable alt | Slightly deeper trough + larger single bolus; weakly dominated by the split |
| **0.5 mg ×2/wk (chosen)** | **Selected** | Keeps trough above threshold continuously, halves per-shot antigenic load + peak; weakly dominates once-weekly on efficacy at equal total dose; cost = one extra injection (trivial here) |
| **Evening "GH-aligned" timing** | Rejected | Acute-paracrine logic misapplied to a long-half-life systemic biologic |

## 7. Monitoring & decision gate

**Labs: baseline → Wk4 → Wk8 → Wk14 (clearance).**
- **Tier 1 (efficacy/engagement):** serum **myostatin/GDF-8** (the arbiter), **DXA** (baseline + ~Wk10–12), strength (3–5RM core lifts + grip dynamometer). InBody = hydration/glycogen trend only — early "gains" are water, not fiber.
- **Tier 2 (off-target safety):** **FSH + LH** (activin-sparing validator — FSH drop = claim false), **CBC w/ diff** (HCT/Hgb/platelets), CMP (ALT/AST, eGFR, glucose), CK, hs-CRP, fasting insulin + HbA1c.
- **Tier 3 (clinical watch):** epistaxis/gum bleed/telangiectasia; injection-site/flush/wheeze; libido/erectile; edema; tendon/joint pain; weekly BP + RHR; Oura HRV/RHR trend (no arbitrary cutoffs).

**Decision gate — Wk4 GDF-8:** suppressed → stay the course; flat *and* Tier-2 clean → justified to titrate up (e.g., 0.75 mg ×2/wk) as evidence of under-potency/sub-threshold, not impatience.

## 8. Hard stops

- Acute hypersensitivity post-dose → **STOP.**
- Spontaneous mucosal bleeding (epistaxis/gums) or new telangiectasia → **STOP** (BMP9/10-type signal).
- Unexplained tachycardia / exertional dyspnea / peripheral edema → **STOP.**
- FSH below reference range, or ALT/AST/CK >3× baseline, or significant HCT shift → **HOLD + reassess.**
- **NEVER concurrent with ACE-031** (separate global hard-stop; the entire reason follistatin was chosen is that it avoids the BMP9/10 vascular toxicity that halted ACE-031).

## 9. Subject-specific context (material to a second opinion)

- **Unresolved CBC finding:** HGB 12.6 (L) / HCT 37.8 (L), dropped from 13.8/41.7 — cause not yet established (retic/haptoglobin/LDH pending). **Baseline CBC for this trial doubles as the anemia workup; full dosing should not outrun that draw.** Any further HCT drop on-trial makes FLGR242 a prime suspect.
- **Concurrent stack (relevant interactions):** TRT monotherapy (daily SubQ) + HCG; retatrutide on taper; broad peptide stack. TRT/erythropoiesis vs the paradoxical HCT drop is an open puzzle that this trial's CBC monitoring intersects.
- **Baseline-labs caveat:** if GDF-8/FSH/CBC were not banked **pre-injection**, the Wk4 gate loses its denominators.

## 10. Assumptions to challenge (second-opinion targets)

1. **Is 0.5 mg ×2/wk likely above the myostatin-neutralization threshold for a ~40 kDa follistatin construct?** Threshold is unknown; is there a better first-guess dose or a way to estimate it?
2. **Ligand-trap "threshold + ceiling" framing** — is this the right pharmacodynamic model for follistatin, or does sequestration of multiple TGF-β ligands (GDF-11, activins) create a more graded dose-response?
3. **Is the unverified 10–19 d half-life load-bearing?** If true t½ is much shorter, twice-weekly may leave sub-threshold troughs — would that argue for higher frequency (e.g., EOD)?
4. **Skipping the test dose** with a foreign recombinant protein — acceptable risk, or meaningful given no anti-drug-antibody assay is available?
5. **Dosing started before baseline labs confirmed** — how much does this compromise interpretability, and is a delayed-baseline salvage possible?
6. **HCT interaction** — given an unexplained falling hematocrit, is any myostatin/activin-pathway agent advisable right now, even the BMP-sparing follistatin route?
7. **Expected effect size** — is "modest lean mass, unreliable strength" the right prior, or is there a reason a gray-market construct would outperform the failed clinical agents?

---

## 11. Second-opinion reconciliation (Gemini adversarial review, 6/6)

**ACCEPTED — protocol changed:**
- **FSH is invalid as the activin-sparing readout (strong catch).** On TRT+HCG, gonadotropins are already suppressed (HCG gives an LH-like signal but does not rescue FSH), so FSH cannot fall further to flag off-target activin binding. Replaced with **bidirectional Hgb/HCT trend** + optional serum activin A.
- **GDF-8 must be drawn at trough, pre-injection (Wed/Sat AM)** — directly tests whether the albumin-linker survived proteolysis (real half-life). Adopted.
- **Dose may be sub-threshold by a large margin.** Comparator TGF-β trap biologics are weight-dosed in the tens of mg (per PubMed: luspatercept ~1–1.25 mg/kg SC q3wk [DOI: 10.1002/jcph.1696](https://doi.org/10.1002/jcph.1696); bimagrumab 10 mg/kg; ACE-031 1–3 mg/kg). 1 mg/wk ≈ 0.013 mg/kg → the **entire 10 mg supply may be sub-therapeutic**, and titration to engagement could exceed supply. (Partly offset by follistatin's high myostatin affinity + small circulating pool, and by the fact those comparators are *receptor* traps with a larger sink to saturate.) GDF-8 trough is the arbiter; accept the run may be underpowered.
- **ADA monitoring** (test dose waived): watch GDF-8 rebound Wk4→Wk8, injection-site induration, arthralgia.
- **Hematology workup precedes the protocol** (retic/haptoglobin/LDH/FOBT); HCT <36.5% or any mucosal bleed = hard stop. Sound clinical prioritization.
- **GDF-11 promiscuity / graded off-target toxicity** — valid refinement; reinforces lowest-effective-dose.
- **TRT synergy** — plausible working-hypothesis upside vs the (non-TRT) clinical cohorts.

**CORRECTED — Gemini errors (per PubMed):**
- **Erythropoiesis direction is backwards.** Gemini claimed off-target activin binding would *suppress* RBC maturation and worsen the anemia. The established pharmacology is the **opposite**: activin/GDF-11 ligand traps are erythroid-maturation / erythropoiesis-stimulating agents that **raise** hemoglobin — luspatercept is "a first-in-class erythroid maturation agent" approved for anemia [DOI: 10.1002/jcph.1696](https://doi.org/10.1002/jcph.1696), and sotatercept (ACE-011, ActRIIA-Fc) "stimulates erythropoiesis" [DOI: 10.1002/dta.2093](https://doi.org/10.1002/dta.2093). So if FLGR242 is *not* activin-sparing, expect **HCT to rise** (which becomes our replacement activin readout), not fall. A continued fall implicates a separate cause (bleed/marrow).
- **BMP9/10 attribution overstated.** The ACE-031 vascular-bleeding liability comes from ActRIIB-Fc trapping BMP9/10; follistatin does **not** meaningfully bind BMP9/10 — which is the entire reason it was chosen as the safer route. Importing that liability wholesale onto FLGR242 double-counts ACE-031's specific risk. (Monitor capillary integrity anyway; mechanistic basis is weaker than stated.)
- **Loose specifics:** the "~38 mg/wk taldefgrobep-scaled dose" is an unverified cross-mechanism mg/kg extrapolation (direction stands, the number does not); GS linkers are chosen for *relative* protease resistance (not "highly susceptible"); ADA is a humoral (B-cell) response, not "Type IV hypersensitivity" (and serum sickness is Type III). Substance retained, labels corrected.

---
*Compiled from a multi-source review (PubMed + ClinicalTrials.gov) for n=1 protocol design. All PK and activin-sparing claims about FLGR242 remain unverified pending the Wk4 labs.*
