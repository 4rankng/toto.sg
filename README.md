# toto.sg

Unofficial Singapore TOTO statistics: latest result, full draw history, statistical insights, and walk-forward strategy rankings.

Pure static Vite SPA + precomputed JSON. All heavy computation (parsing, analysis, strategy simulation) runs offline in a Node refresh script; the client only renders. No backend — the one serverless component is a Netlify Function that keeps the "latest result" panel fresh between rebuilds.

## Quickstart

```bash
npm install
npm run refresh   # fetch + parse all draws, write public/data/*.json (~15 min on first run)
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build to dist/
```

Node ≥ 18 required. `npm run refresh` is idempotent: it keeps `public/data/draws.json`, fetches only missing draws (rate-limited at 1.2 s), then refreshes the 6 latest draws from the official fragment and regenerates `analysis.json` / `strategies.json`.

## Data sources

- **Historical seed (2008 → 2022)**: [Aloysius-JW/Singapore-ToTo-analysis](https://github.com/Aloysius-JW/Singapore-ToTo-analysis) CSV, draws 2341–3766.
- **Per-draw backfill + live fragment**: [Singapore Pools](https://www.singaporepools.com.sg) (official results pages). Data © Singapore Pools. Reprinted for personal, non-commercial use only.

Analysis and strategy stats use the **6/49 era only** (draws since 9 Oct 2014); the history page shows the full archive with 6/45 rows marked.

## Deploy to Netlify

1. Push this repo and connect it in Netlify — `netlify.toml` supplies the build command (`npm run build`), publish dir (`dist`), SPA redirect, and picks up `netlify/functions/latest.mjs` automatically.
2. Schedule a daily build (~10:45 UTC, after the Monday/Thursday results settle) so `public/data/*.json` recompute and the analysis stays current. Netlify: **Site configuration → Build & deploy → Scheduled builds**.

The home page calls `/api/latest` (the function) on load. If the function is unavailable it silently falls back to the bundled data, so the site works as pure static hosting too.

## Scope & disclaimer

Unofficial — not affiliated with Singapore Pools. For information only, 18+. TOTO draws are random; strategy differences are small and not predictive.
