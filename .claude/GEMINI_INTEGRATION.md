# Gemini ↔ Claude Code — second opinion, anywhere

This repo is wired so Claude Code can pull an **independent second opinion from
Gemini** without you ever leaving Claude Code. Gemini is a second pair of eyes;
**you make the final call.**

## Use Gemini in EVERY project — the `/gemini` skill (recommended)

To call Gemini **anywhere in Claude Code** — any folder, any project, not just
this repo — install the `gemini` **skill** globally:

```bash
bash .claude/install-gemini-global.sh
```

This copies `.claude/skills/gemini/SKILL.md` to `~/.claude/skills/gemini/`, making
`/gemini` available in every Claude Code session on this machine. It auto-picks
**3.1 Pro deep-thinking** for hard questions and **3.5 Flash** for quick ones, and
if it sees a `STATE_Roman.md` it cross-checks dose math / interactions against it.

> **Scope note — what "anywhere" can and can't mean.** The skill runs the local
> `agy` CLI, so it works in any **Claude Code** session on this laptop (CLI or
> desktop). It does **not** run inside the consumer **Claude apps** (Claude.ai web,
> the Claude chat desktop app, or the iPhone app) — those can't execute local CLIs.
> Reaching Gemini there needs a **remote MCP connector** backed by a Gemini **API
> key** (paid per-use, not your Ultra OAuth). See "Cross-app reality" below.

## Project-scoped commands (this repo)

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

## Cross-app reality — where "anywhere" actually reaches

There are two different "Claudes," and they integrate Gemini in different ways:

| Surface | Can it run the `/gemini` skill (local `agy`)? | How to get Gemini there |
|---|---|---|
| **Claude Code** — terminal CLI + desktop coding sessions | ✅ Yes | The `/gemini` skill (this repo). Free under Ultra OAuth. |
| **Claude.ai (web)** | ❌ No — can't run local CLIs | Remote **MCP connector** backed by a Gemini **API key** |
| **Claude desktop chat app** (the consumer Claude, not Claude Code) | ❌ No | Same remote MCP connector |
| **Claude iPhone app** | ❌ No | Custom connectors are configured on web/desktop and have **limited mobile support**; availability depends on plan |

**Why:** the skill works by shelling out to `agy` on your machine. The consumer
Claude apps (web/desktop-chat/iPhone) are sandboxed — they don't execute local
commands. The only bridge into them is **MCP**: a small server that wraps the
Gemini **API** and is added as a custom connector. That path uses a **paid Gemini
API key** (billed per-use), **not** your Ultra subscription, because a server can't
ride your personal OAuth login. iPhone support for custom connectors is partial.

**Net:** the `/gemini` skill gives you Gemini in **all your Claude Code** work today,
free. True "in every Claude app including the phone" requires the MCP-connector +
API-key route, which is a separate (paid) build.

## Notes / things that may need a tweak

- **Model IDs** (`gemini-3.1-pro`, `gemini-3.5-flash`) and the **deep-thinking
  flag** (`--thinking high`) are best-effort for Antigravity CLI at launch. If a
  call errors, the commands instruct Claude to run `agy --help` and adapt the
  flags — update the two command files in `.claude/commands/` once you confirm the
  exact syntax on your install.
- Antigravity CLI did not ship at full feature parity with Gemini CLI at launch;
  if a flag is missing, the model still answers in its default thinking mode.
