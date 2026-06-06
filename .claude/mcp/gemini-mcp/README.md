# gemini-mcp — Gemini inside the Claude **desktop chat app**

A tiny local MCP server that gives the consumer **Claude desktop app** an
`ask_gemini` tool. It shells out to the local **Antigravity CLI (`agy`)**, logged
in with your **Gemini Ultra** account — so it's **free** (no API key, no hosting).

> This is for the **Claude desktop chat app** (the consumer Claude). For *Claude
> Code* you don't need this — use the `/gemini` skill instead. The phone/web apps
> can't use this local server (they'd need a paid hosted connector).

## Prerequisites (one-time)

1. **Node.js** installed (`node --version` — any recent v18+; v22 tested).
2. **Antigravity CLI** installed and logged in:
   ```bash
   agy --version          # confirm installed (from antigravity.google)
   agy                    # log in once → browser OAuth with your Ultra account
   ```

No `npm install` needed — the server has **zero dependencies**.

## Wire it into Claude desktop

Open the Claude desktop app config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add a `gemini` server pointing at this file's **absolute path** (replace the path
with where you cloned this repo):

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/protocol-os/.claude/mcp/gemini-mcp/index.js"]
    }
  }
}
```

> Tip: get the absolute path by running `pwd` inside this folder, then append
> `/index.js`. If you already have other `mcpServers`, just add the `gemini` entry
> alongside them.

**Fully quit and reopen Claude desktop.** You should then see a `gemini` tool
(the 🔌 / tools menu). Try: *"Use ask_gemini to sanity check 2+2, mode quick."*

## How to use it

In any Claude desktop chat, just ask Claude to consult Gemini:

- *"Ask Gemini for a second opinion on this, deep mode."* → Gemini **3.1 Pro**, deep thinking
- *"Quick-check this with Gemini."* → Gemini **3.5 Flash**

The `ask_gemini` tool takes `prompt` and an optional `mode` (`deep` = default,
`quick`).

## Verify the server by hand (optional)

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node index.js
```
You should see an `initialize` result and the `ask_gemini` tool listed.

## Troubleshooting

- **Tool never appears:** check the path in the config is absolute and correct, and
  that you fully quit + reopened Claude desktop. Validate the JSON (no trailing commas).
- **`agy call failed: spawn agy ENOENT`:** `agy` isn't on the PATH Claude launched
  with. Use the full path to `agy` — or set `"command"` to a wrapper script that
  sources your shell profile first.
- **Flag errors from `agy`:** the CLI is new; run `agy --help` and update the
  `MODES` model IDs / thinking flag at the top of `index.js`.
