# gemini-remote — Gemini in **Claude.ai web + iPhone app**

A hosted MCP server (Streamable HTTP) that adds an `ask_gemini` tool to the
consumer Claude **web** and **iPhone** apps, the only Claude surfaces that can't
run a local CLI.

> ⚠️ **This one is not free.** A hosted server can't use your Ultra login, so it
> calls the Gemini **REST API with an API key billed per-use by Google** — *not*
> your Ultra subscription. This is the unavoidable cost of the web/phone surfaces.
> Leave it un-deployed until you decide it's worth it. For free Gemini, use the
> `/gemini` skill (Claude Code) and the local `gemini-mcp` server (desktop app).

## What you need

1. A **Gemini API key** from Google AI Studio (this is what gets billed).
2. A place to host a tiny Node service reachable over HTTPS — e.g. Google Cloud
   Run, Fly.io, Render, Railway, a small VPS. Zero dependencies, Node 18+.
3. A **Claude plan that supports custom connectors** (Pro/Max/Team/Enterprise).

## Run / deploy

Locally (to test):
```bash
GEMINI_API_KEY=your_studio_key \
MCP_AUTH_TOKEN=$(openssl rand -hex 16) \
node server.js          # listens on :8080
```

Set these env vars on your host:

| Var | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio key (billed) |
| `MCP_AUTH_TOKEN` | strongly rec. | bearer token so only you can spend the key |
| `PORT` | — | default 8080 |
| `DEEP_MODEL` / `QUICK_MODEL` | — | default `gemini-3.1-pro` / `gemini-3.5-flash` |

Example (Cloud Run): containerize with a `node:20-slim` base running
`node server.js`, set the env vars as secrets, deploy, note the HTTPS URL.

## Connect it to Claude

In Claude.ai (web) → **Settings → Connectors → Add custom connector** → paste your
HTTPS URL. If you set `MCP_AUTH_TOKEN`, provide it as the `Authorization: Bearer
<token>` header the connector sends. Once added on web, it also appears in the
**iPhone** app (mobile connector support is partial/plan-dependent).

Then in any chat: *"Use ask_gemini to get a second opinion on this, deep mode."*

## Verify by hand

```bash
curl -s -X POST http://127.0.0.1:8080/ -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Should list the `ask_gemini` tool.

## Caveats

- **Cost:** every call bills your API key. Set budget alerts in Google Cloud.
- **Security:** always set `MCP_AUTH_TOKEN` and use HTTPS — an open endpoint with
  your key is a blank check.
- **Model IDs:** `gemini-3.1-pro` / `gemini-3.5-flash` are defaults; adjust via env
  if the API names differ on your account.
- **iPhone:** custom-connector support on mobile is limited and changes over time;
  it may require configuring on web first and may not expose every feature.
- **Transport:** this implements request/response JSON over Streamable HTTP (no
  SSE streaming). Fine for tool calls; if a future Claude client demands SSE, that
  would be a small addition.
