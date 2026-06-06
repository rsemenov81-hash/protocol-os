---
description: Fast, throwaway sanity check (unit conversions, reconstitution math, quick "does this look right") via Gemini 3.5 Flash
argument-hint: <quick question, e.g. "10mg + 2mL, what's 500mcg in units?">
allowed-tools: Bash(agy:*), Read
---

# /gemini-quick — fast sanity check

You are running a **quick, low-stakes sanity check** using **Google Antigravity
CLI (`agy`)**, authenticated with the user's **Gemini Ultra** account, model
**Gemini 3.5 Flash** (fast, cheap-thinking — for easy tasks).

The question:

> $ARGUMENTS

Use this lane for arithmetic, unit conversions, reconstitution checks, and other
quick "does this look right" questions — **not** for interaction or hard-stop
decisions (those belong in `/gemini-verify`).

## Steps

1. If the question references a current compound/dose, glance at `STATE_Roman.md`
   for the reconstitution reference — otherwise skip straight to the call.

2. **Call Gemini Flash** via Bash:
   ```
   agy -m gemini-3.5-flash -p "<the question, with any needed numbers>"
   ```
   If that errors, run `agy --help` once, adapt the model/prompt flags, and retry.
   Do **not** use the deprecated `gemini` command.

3. **Report briefly:** Gemini's answer, plus a one-line ✅/⚠️ on whether it matches
   your own quick check. If the question turns out to be high-stakes (an
   interaction, a hard-stop, an irreversible dose change), say so and recommend
   re-running it through `/gemini-verify` instead.

Keep it to a few lines.
