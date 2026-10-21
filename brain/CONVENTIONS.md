# brain/CONVENTIONS.md — the canonical contract

> **Status:** PROVISIONAL (P0 scaffold). The design behind this passed an internal adversarial review
> (see `SECOND_BRAIN_PLAN.md` §8) but is **pending Gemini + GPT sign-off**. Revise if they object.
>
> **This file is the single source of truth** for how the second brain is structured and how agents
> (Claude *and* Codex) read and write it. `CLAUDE.md` and `AGENTS.md` are thin pointers to this file.
> If something here is wrong or stale, **flag it and propose the edit — never silently work around it.**

## 0. What this is

A git-backed markdown knowledge base, shared by Claude and Codex, that ingests raw input
(research, chat summaries, dumps), verifies it, organizes it, and is read back to give better answers.
No third-party vendor; your data — including clinical/PHI — stays in this repo you control.

## 1. Structure

```
brain/
├── CONVENTIONS.md   # this file — the contract
├── index.md         # GENERATED map-of-content. Do not hand-edit (see §4).
├── context/         # DURABLE, loads-on-demand. Identity + per-domain durable knowledge.
├── sources/         # INBOX: raw, unprocessed dumps (pasted text, link notes, PDF→text).
├── notes/           # PROCESSED atomic notes: one idea per file, wikilinked, frontmatter.
├── log/             # Append-only daily notes + captured Claude/Codex session summaries.
└── verify/          # claims.md (deterministic claims index) + contradiction/cross-model reports.
```

Clinical state stays in `STATE_Roman.md` at repo root; `context/protocol.md` references it (single source).

## 2. Frontmatter contract (every file in notes/ context/ sources/)

```yaml
---
type: note|source|daily|context|verify
status: raw|verified|durable
confidence: established|hypothesis|speculation   # Calibration vocabulary from STATE
tags: [..]
source: <url|chat|file|connector>
created: YYYY-MM-DD
---
```

## 3. The loop — agent-agnostic procedures (any agent follows by reading these)

These are plain-prose steps. Claude *may* run the optional `/brain-*` skills as an accelerator; Codex runs
the same steps as a checklist from `AGENTS.md`. The procedures — not the skills — are the product.

**CAPTURE** (end of a working session): append a dated block to today's `log/YYYY-MM-DD.md` — decisions,
facts learned, open questions. Tag anything durable as a promotion candidate. Never edit `context/` here.

**INGEST** (a file/paste/link lands in `sources/`): classify → route → split into atomic `notes/` files →
add frontmatter + `[[wikilinks]]` → set `confidence` → record each claim in `verify/claims.md` (§5).

**VERIFY** (any `status: raw` note; always before promotion to `context/`): run §5. Tag each claim's
confidence; diff against the claims index for contradictions; high-stakes claims get the cross-model pass.

**ORGANIZE** (periodic): dedupe overlapping notes → canonical + repoint links; prune dead links; promote
durable knowledge log→context (**human-gated**); regenerate `index.md`. Mechanical fixes auto-apply;
semantic merges/repoints are confirmed per item.

## 4. Write protocol — HARD RULES (both agents)

1. **Single-writer assumption:** do not run Claude and Codex against the brain at the same time.
2. **Pull before write, commit + push after every `brain:` change** — so the other agent always rebases
   on current state. Commit brain edits separately, prefixed `brain:`.
3. **`index.md` and any rollups are GENERATED, never hand-edited** (removes the guaranteed hot-file
   conflict). Regenerate from `notes/` + `verify/claims.md`.
4. **Atomic files** in `notes/` (one idea = one file); **append-only** to `log/` and `sources/`.
5. **Never edit `context/` without a flagged, human-approved proposal.** Promotion is always gated.
6. **Honor `STATE_Roman.md` Hard Stops as invariants.** Never silently work around them.
7. **No secrets in git:** never commit raw tokens/API keys; PHI pulled from connectors is reviewed
   before commit. (See `.gitignore` + the redaction note before any automated ingest.)

## 5. VERIFY, specified (the safety layer — not hand-wavy)

Two stages, deterministic first:

1. **Deterministic claims index** (`verify/claims.md`): every claim is recorded as
   `key | claim | confidence | source | note-file`, where `key` is the entity/compound/topic. A new claim
   **must be diffed against all prior claims sharing its key.** A key-collision with a differing assertion =
   a flagged contradiction → write a `verify/` report; do not silently file.
2. **LLM / cross-model judgment** runs only on the flagged collisions, and on any `confidence: established`
   claim headed for `context/` or touching a Hard Stop. Cross-check with Gemini (`/gemini-verify`) and
   GPT/Codex; record ✅ agreed / ⚠️ worth a look / 🔴 conflict. On 🔴, hold — do not promote.

**P0 acceptance gate:** reconcile the contradictions already present in `STATE_Roman.md` that the review
found (Hard Stop #7 ALCAR "in use" vs removed 5/29; #11 "vault" vs body's "cycled use"; #10 injectable
glutathione forbidden vs inventory "RUN — user override"). #10 is an intentional documented override —
record it as such, not as a contradiction. #7/#11 need Roman's decision. *(Awaiting go-ahead.)*

## 6. Retrieval

`index.md` is the human-readable MOC, regenerated from the notes. For scale beyond ~50 notes, a local
embedding index (sqlite + on-device model, PHI stays local) backs "what should I load for this question?"
— added in build phase P4. Until then, the brain is a curated digest navigated by folder + wikilinks.
