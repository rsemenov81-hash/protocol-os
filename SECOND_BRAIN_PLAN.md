# Second Brain — Build Plan (v1, for Gemini + GPT review)

**Author:** Claude (Opus) · **Date:** 2026-06-23 · **Status:** DRAFT — awaiting Gemini + GPT review
**Goal:** A single knowledge repository that (1) is updated from research + Claude/Codex chats + raw
data dumps, (2) ingests → indexes → verifies → organizes that input, (3) is used by the agents to give
better output, and (4) is **shared between Codex and Claude**. Build up from what already exists; do
not rip-and-replace.

---

## 1. What you already have (inventory)

You are not starting from zero. You have ~70% of a second brain already — it's just single-purpose
(clinical) and undocumented as a *system*.

| Asset | What it is | Role in the brain |
|---|---|---|
| `STATE_Roman.md` | Living-state clinical doc. "Loads every turn. Answer the delta." Routing to an archive, Calibration Rules, Hard Stops, Phase Gates. | This **IS** a hand-built brain for one domain. Becomes the template + the `context/` seed. |
| `Clinical_Case_Summary` (referenced, external) | Deep archive: reasoning log, error DB, compound matrix. | The "load on demand" layer — proves you already do progressive disclosure. |
| Protocol-OS app + `protocol-sync-worker.js` + `protocol` CLI + MCP tools | Cloudflare-KV sync, adherence/log readers. | Stays as-is. The brain must **not** break the log shape (your standing golden rule). |
| Git repo (`rsemenov81-hash/protocol-os`, GitHub) | Version-controlled, already cloud-synced. | **The sharing substrate.** Git is how Codex and Claude see the same files. |
| `.claude/` — `/gemini`, `/gemini-verify`, `/gemini-quick`, gemini MCP | Independent second-opinion via Antigravity `agy` (Ultra). | The **verify** layer's cross-model checker. |
| Connectors (in your Claude): Oura, HealthEx, Function Health, Gmail, Google Drive, CourtListener | Live data sources. | Feed the **ingest** layer (scheduled pulls). |
| Calibration Rules + Hard Stops (inside STATE) | "Label established/hypothesis/speculation"; "measure before modeling"; 13 hard stops. | Reused verbatim as the **verify rubric** and the **invariants**. |

**Three gaps, and they are the whole project:**
1. **No `CLAUDE.md` and no `AGENTS.md`.** Claude has no routing/voice contract; **Codex reads `AGENTS.md` and you have none** — so today the brain is not actually shared, it's Claude-only and ad hoc.
2. **No ingest/verify/organize loop.** STATE is maintained by hand each session. There's no repeatable "dump raw data → it gets classified, checked, filed."
3. **It's single-domain (health).** The structure doesn't yet hold research, project, or general knowledge.

---

## 2. Design decisions (the "why", so reviewers can attack them)

**D1 — Substrate: a git repo of markdown. No new vendor.**
Both Claude Code and Codex are file-first agents. Point both at the same repo and "shared between Codex
and Claude" is solved by `git pull`/`git push` — which you already do. This is strictly simpler and safer
than Relay/Railway/Notion/NotebookLM, and it keeps your **clinical data in a repo you control** (consistent
with the prior decision not to push PHI into third-party sync/cloud-MCP stacks). Markdown is also the one
format both agents read losslessly.

**D2 — One canonical convention file; thin per-agent pointers.**
`brain/CONVENTIONS.md` is the single source of truth for structure, routing, frontmatter, and the write
protocol. Root `CLAUDE.md` and `AGENTS.md` are **3-line stubs that say "read brain/CONVENTIONS.md
first."** This avoids the classic dual-agent failure where Claude's rules and Codex's rules drift apart.

**D3 — Verify is a first-class layer, not an afterthought.**
Every "second brain" guide (incl. the Ben AI one you sent) skips verification. For you it's mandatory:
the brain will hold health claims, and an unverified contradiction is a safety issue. Verify = (a) tag every
incoming claim **established / hypothesis / speculation** (your existing Calibration Rule), (b) diff against
existing notes for contradictions, (c) for anything high-stakes, cross-check with **Gemini and GPT** before
it's promoted to durable `context/`.

**D4 — Append-only capture, human-gated promotion.**
Raw dumps and chat logs are append-only (cheap, never destructive). Promotion *into* durable `context/`
(the stuff that loads every turn) always requires a flag for your approval — never silent. Mirrors your
STATE rule "if a fact here is wrong, flag it and propose the edit — do not silently work around it."

**D5 — Progressive disclosure for retrieval.**
Root context stays small (loads every turn). Detail lives in folders, pulled on demand via an index/MOC
(map-of-content). This is how you already use STATE → Clinical_Case_Summary. Keeps token cost down and
fights context-rot (relevant: Chroma's context-rot research).

**D6 — Build on STATE, don't move it yet.**
Phase 1 wraps STATE in the new structure by reference; it does not relocate it. The Protocol-OS sync/log
shape is untouched. Nothing that works today breaks.

---

## 3. Target structure

```
protocol-os/                      # existing repo = the brain's home
├── CLAUDE.md                     # NEW — 3-line stub → brain/CONVENTIONS.md (Claude entry)
├── AGENTS.md                     # NEW — 3-line stub → brain/CONVENTIONS.md (Codex entry)
├── brain/
│   ├── CONVENTIONS.md            # canonical: structure, routing table, frontmatter, write protocol
│   ├── index.md                  # map-of-content: what's in the brain, where, freshness
│   ├── context/                  # DURABLE, loads-on-demand. The "answer the delta" layer
│   │   ├── identity.md           # you: goals, working style, decision style
│   │   ├── protocol.md           # → references STATE_Roman.md (single source for clinical)
│   │   └── <domain>.md           # research domains as they appear
│   ├── sources/                  # INBOX for raw dumps (PDFs→text, pastes, links). Unprocessed.
│   ├── notes/                    # PROCESSED atomic notes (one idea/file, wikilinked, frontmatter)
│   ├── log/                      # daily notes + captured Claude/Codex session summaries (append-only)
│   └── verify/                   # contradiction reports, cross-model check records, open questions
├── STATE_Roman.md                # unchanged (referenced by context/protocol.md)
└── (app, worker, CLI — unchanged)
```

Each of `context/ notes/ log/ sources/` gets a one-screen `README.md` describing what belongs there
(the per-folder routing the agents read).

**Frontmatter contract (every note):**
```yaml
---
type: note|source|daily|context|verify
status: raw|verified|durable
confidence: established|hypothesis|speculation   # your Calibration vocabulary
tags: [..]
source: <url|chat|file>
created: YYYY-MM-DD
---
```

---

## 4. The loop, as four skills (the actual product)

| Skill | Trigger | Does |
|---|---|---|
| `/brain-capture` | end of a Claude/Codex session, or `/goal`-style | Append a dated summary (decisions, facts learned, open questions) to `log/`. Tag durable items as promotion candidates. |
| `/brain-ingest` | you drop a file/paste/link into `sources/` | Classify → route → split into atomic `notes/` → add frontmatter + `[[wikilinks]]` → set `confidence` → leave a one-line entry in `index.md`. |
| `/brain-verify` | new notes with `status: raw`; always before promotion to `context/` | Tag each claim established/hypothesis/speculation; diff vs existing brain for contradictions → write `verify/` report; for high-stakes, fan out to **Gemini (`/gemini-verify`) + GPT (Codex)** and record ✅/⚠️/🔴. |
| `/brain-organize` | weekly | Dedupe (merge 3+ overlapping notes → canonical, repoint wikilinks), prune dead links, promote durable knowledge log→context (human-gated), refresh `index.md`, lint contradictions. Outputs a report; semantic changes are walk-confirmed, mechanical ones auto-applied. |

**Dual-agent write protocol** (in `CONVENTIONS.md`, enforced for both Claude and Codex):
- Append-only to `log/` and `sources/`; atomic files in `notes/`; **never edit `context/` without a flagged proposal**.
- One note = one file = one idea (no clobbering; merge-friendly for git).
- Always commit brain changes in their own commit with a `brain:` prefix, so either agent can see what the other did via `git log`.
- Honor `STATE_Roman.md` Hard Stops as invariants — same as the app rule.

---

## 5. Phased build (each phase independently shippable)

- **P0 — Contract (½ day).** Create `brain/CONVENTIONS.md`, root `CLAUDE.md` + `AGENTS.md` stubs, empty folder tree with READMEs, `index.md`. *Verify:* open a Codex session in the repo → it reads `AGENTS.md` → describes the structure correctly. Same for Claude.
- **P1 — Capture + Ingest (1 day).** `/brain-capture` and `/brain-ingest` skills. Seed `context/identity.md` and `context/protocol.md` (→STATE). *Verify:* drop a research PDF in `sources/` → ingest produces atomic notes with correct frontmatter + index entry.
- **P2 — Verify (1 day).** `/brain-verify` + the Gemini/GPT cross-check path, reusing `.claude/` gemini commands. *Verify:* feed a note that contradicts STATE → it's caught and reported in `verify/`, not silently filed.
- **P3 — Organize (½ day).** `/brain-organize` weekly optimizer. *Verify:* create 3 overlapping notes → organize merges to one canonical, repoints links, logs the decision.
- **P4 — Retrieval polish (½ day).** Tune `index.md` as a real MOC + progressive-disclosure rules so agents pull the *right* slice, not everything. *Verify:* a question answerable from one note loads that note, not the whole brain.
- **P5 — Automation (optional, later).** A scheduled "operator" that pulls Oura/labs/Gmail into `sources/` nightly and runs ingest+verify, flag-don't-fix. **PHI stays in your private repo**; no third-party cloud. (This is the one genuinely-new capability from the Ben AI guide, built natively.)

---

## 6. Risks / open questions (for reviewers to pressure-test)

1. **Two agents, one repo, concurrent writes.** Mitigation = atomic files + append-only + `brain:` commits. Is that enough, or do we need a lightweight lock/branch convention for Codex?
2. **Private vs shareable.** The brain mixes PHI (clinical) with general research. Keep one private repo? Or split `brain/context/protocol.md` clinical content behind a separate private submodule so research notes could later be shared without leaking health data?
3. **Verify cost.** Cross-model checks on every promotion could be slow/expensive. Proposal: only high-stakes (`confidence: established` claims headed for `context/`, or anything touching Hard Stops) get the Gemini+GPT fan-out; everything else is single-pass. Right threshold?
4. **STATE migration.** Leave STATE in place forever (P1), or eventually fold it into `brain/context/` as the structure proves out? Recommend: leave it; it works.
5. **Codex specifics.** `AGENTS.md` is the right entry file for Codex — confirm there's nothing Codex-specific (e.g., tool perms) we should encode there too.

---

## 7. What gets built first if approved

P0 + P1: the contract files and the capture/ingest skills. That alone makes the brain real and shared,
and everything else compounds on it — matching how you already run STATE.
