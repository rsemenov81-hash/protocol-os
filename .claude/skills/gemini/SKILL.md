---
name: gemini
description: Ask Google Gemini on demand from inside any Claude Code session — a second-opinion / cross-check tool. Use when the user types /gemini, says "ask Gemini", "what does Gemini think", "get a second opinion from Gemini", or wants an independent model to verify reasoning, math, or a decision. Auto-picks Gemini 3.1 Pro (deep thinking) for hard/high-stakes questions and 3.5 Flash for quick ones. Works in any project on this machine.
---

# gemini — ask Gemini from anywhere in Claude Code

This skill lets the user pull an **independent second opinion from Google Gemini**
without leaving Claude Code, in **any project or folder**. Gemini is a second pair
of eyes — you reconcile its answer and report; the user decides.

It runs **Antigravity CLI (`agy`)**, authenticated with the user's **Gemini Ultra**
account (the legacy `gemini` command stopped serving Ultra on 2026-06-18 — always
use `agy`, never `gemini`).

## Pick the model by the task

| Task | Model | Flag |
|---|---|---|
| Hard / high-stakes / "verify this" / math / interactions / anything irreversible | **Gemini 3.1 Pro, deep thinking** | `-m gemini-3.1-pro --thinking high` |
| Quick / throwaway / unit conversions / "does this look right" | **Gemini 3.5 Flash** | `-m gemini-3.5-flash` |

Default to **3.1 Pro deep-thinking** when in doubt — accuracy over speed. Drop to
Flash only when the user signals it's a quick check.

## Steps

1. **Frame the question.** Take what the user asked. If there's relevant context in
   the current session (a file, a calculation, a decision), include the concrete
   facts/numbers so Gemini reasons on real data, not assumptions. Ask Gemini to be
   terse and lead with any disagreements or red flags.

   - **Protocol-aware bonus:** if a `STATE_Roman.md` exists in the project (the
     health-protocol repo), and the question is about dose math, drug/peptide
     interactions, or a hard-stop, read the relevant slice first and feed those
     exact numbers + hard-stops into the Gemini prompt. Otherwise skip this.

2. **Call Gemini** via Bash:
   ```
   agy -m gemini-3.1-pro --thinking high -p "<your prompt>"     # high-stakes
   agy -m gemini-3.5-flash -p "<your prompt>"                   # quick
   ```
   If a flag errors (the CLI is new), run `agy --help` once, adapt the
   model-select / one-shot / thinking flags, and retry. Never fall back to the
   deprecated `gemini` command.

3. **Reconcile and report:**
   - ✅ **Agreed** — where Gemini and your own reasoning match.
   - ⚠️ **Worth a look** — what Gemini weighted differently or surfaced.
   - 🔴 **Conflict** — any real disagreement; show both views, don't paper over it.
   - **Bottom line:** one or two sentences. On a high-stakes 🔴, recommend holding.

Keep it tight — this is a cross-check, not an essay. Cite specific numbers.

## Requires (one-time on this machine)

- Antigravity CLI installed (`agy --version`) from antigravity.google
- Logged in once: `agy` → browser OAuth with the **Ultra** Google account
- `Bash(agy:*)` allowed (in `~/.claude/settings.json` for global use)
