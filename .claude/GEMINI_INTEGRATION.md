# Gemini ↔ Claude Code — two-tier second opinion

This repo is wired so Claude Code can pull an **independent second opinion from
Gemini** without you ever leaving Claude Code. Gemini is a second pair of eyes;
**you make the final call.**

Two commands, mirroring how Roman already works:

| Command | Model | Use it for |
|---|---|---|
| `/gemini-verify <change>` | **Gemini 3.1 Pro, deep thinking** | High-stakes, irreversible calls — dose math, drug/peptide interactions, anything touching the `STATE_Roman.md` **HARD STOPS** |
| `/gemini-quick <question>` | **Gemini 3.5 Flash** | Fast throwaway checks — unit conversions, reconstitution math, "does this look right" |

Both authenticate with your **Gemini Ultra** subscription — **no extra cost to
Google.** The only cost is the Claude tokens spent reading Gemini's reply back,
which is small for a focused check.

## One-time setup (Antigravity CLI)

> ⚠️ The old `gemini` CLI **stops serving Ultra/Pro on 2026-06-18**. Its
> replacement is **Antigravity CLI** (`agy`), which uses the **same Ultra
> subscription and the same Google login**. These commands target `agy`.

1. **Install Antigravity CLI** from <https://antigravity.google> (single native
   binary, no runtime deps). Make sure `agy` is on your `PATH`:
   ```bash
   agy --version
   ```
2. **Authenticate** — run `agy` once with no arguments; it opens your browser for
   Google OAuth. Sign in with the **same Google account as your Gemini Ultra
   subscription**.
3. **(If migrating from the old Gemini CLI)** optionally run
   `agy plugin import gemini` to carry over any prior config.
4. **Allow `agy` in Claude Code** so it doesn't prompt every time. The commands
   already declare `allowed-tools: Bash(agy:*)`; you can also add it project-wide
   in `.claude/settings.json`:
   ```json
   { "permissions": { "allow": ["Bash(agy:*)"] } }
   ```

## How it works

Each command tells Claude to: read the relevant slice of `STATE_Roman.md`, build a
focused prompt, call `agy` with the right model, then reconcile Gemini's answer
against your protocol and report **✅ agreed / ⚠️ worth a look / 🔴 conflict**.
On any 🔴 (dose-math, interaction, or hard-stop conflict), Claude stops and shows
both views instead of endorsing the change.

## Notes / things that may need a tweak

- **Model IDs** (`gemini-3.1-pro`, `gemini-3.5-flash`) and the **deep-thinking
  flag** (`--thinking high`) are best-effort for Antigravity CLI at launch. If a
  call errors, the commands instruct Claude to run `agy --help` and adapt the
  flags — update the two command files in `.claude/commands/` once you confirm the
  exact syntax on your install.
- Antigravity CLI did not ship at full feature parity with Gemini CLI at launch;
  if a flag is missing, the model still answers in its default thinking mode.
