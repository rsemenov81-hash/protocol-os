# AGENTS.md

This repo hosts a shared (Claude + Codex) second brain. **Before doing anything, read
`brain/CONVENTIONS.md`** — it is the canonical contract for structure, the ingest/verify/organize
loop (§3), and the write protocol hard rules (§4). You follow the same procedures Claude does; they are
written as plain prose so any agent can execute them. Honor `STATE_Roman.md` Hard Stops as invariants.

Key rules you MUST follow (full text in brain/CONVENTIONS.md §4):
- Pull before write; commit + push each `brain:` change separately.
- `brain/index.md` is generated — never hand-edit it.
- Append-only to `log/` and `sources/`; atomic one-idea files in `notes/`.
- Never edit `context/` without a flagged, human-approved proposal.
- Never commit secrets; review PHI before commit.

(Provisional P0 scaffold — pending Gemini + GPT sign-off of SECOND_BRAIN_PLAN.md.)
