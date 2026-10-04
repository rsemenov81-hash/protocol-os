# Protocol OS

A single-file progressive web app for logging a personal peptide and hormone protocol, with cloud sync
through a Cloudflare Worker and read access for Claude through that Worker's MCP tools.

## Layout

| Path | What it is |
|---|---|
| `src/app/main.jsx` | The app (React 18, JSX). The schedule engine sits between `SCHEDULE-ENGINE-BEGIN/END`, the sync rules between `SYNC-CORE-BEGIN/END`. |
| `src/styles.css`, `src/head.html`, `src/vendor/` | Styles, document head, inlined React / ReactDOM / lucide bundles. |
| `tools/build.mjs` | Builds `index.html` from `src/` (esbuild compiles the JSX once; nothing is compiled in the browser). |
| `index.html` | **Generated.** Committed because GitHub Pages serves it. Never edit by hand. |
| `sw.js` | Service worker (network-first, cached fallback for navigations). |
| `protocol-sync-worker.js`, `WORKER-PATCH.md` | The Cloudflare Worker (sync + MCP) and its copy-and-paste deploy guide. |
| `trey/`, `jamal/`, `kris/` | Simplified two-person apps (Roman as admin, the client logs doses), each a single hand-written `index.html` on its own Cloudflare Worker. `kris/worker.js` and `kris/DEPLOY.md` are Kris's worker and its setup steps. |
| `tests/` | Unit tests (`node --test`), the browser walkthrough and the cloud-sync scenarios (Playwright). See `tests/README.md`. |

## Working on it

```
npm ci            # once
npm run build     # src/ → index.html
npm run check     # fails if index.html is stale
npm test          # engine, sync, worker unit tests
npm run e2e       # browser walkthrough + sync scenarios (Chromium)
```

CI (`.github/workflows/ci.yml`) runs check, test and e2e on every push and pull request. Deploy is a
merge to `main`; GitHub Pages serves `index.html`. Worker changes are pasted into the Cloudflare
dashboard by hand (see `WORKER-PATCH.md`).
