# Vitae Studio

Generate Vitae Lab product shots, protocol app covers and ambient loops with
Higgsfield image and video models. Built from the Higgsfield Studio template;
read `AGENTS.md` before changing it.

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000, click **Connect API key** in the sidebar and paste
the key copied from https://open.higgsfield.ai/api-keys as-is. The key is kept
in an HTTP-only cookie and only the server calls Higgsfield.

`.env.local` sets `HF_API_BASE_URL=https://api.higgsfield.ai`. No other
variables are needed.

Behind an HTTPS proxy, start Node with `NODE_USE_ENV_PROXY=1` (Node 22.21+),
otherwise server-side fetches to Higgsfield fail with `fetch failed`.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm build
```

## Catalog notes

All 38 bundled models stay in the pickers. Settings for models with a
published Input JSON Schema were aligned to it. Image-to-video, reference and
edit/extend endpoints, and models without a reachable model page (Flux 2,
Flux 3, Soul Cinema, DoP, Kling 3.0 variants other than Standard, Seedance 2.0
Fast/Mini), are documented in the template but not verified against
Higgsfield's model docs or live calls.
