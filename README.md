# toto.sg

Unofficial Singapore TOTO statistics: the latest result, the full draw archive, statistical insights, and a walk-forward league of 203 number-picking strategies scored against chance.

Pure static Vite SPA + precomputed JSON. All heavy computation (parsing, analysis, league scoring) runs offline; the client only renders. No backend — the one serverless component is a Netlify Function that keeps the "latest result" panel fresh between rebuilds.

## The four surfaces

| Route         | Surface | What it is                                                                                                 |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `/`           | Monitor | Latest draw as six balls + additional, countdown to the next draw, four stat tiles, league top-5           |
| `/history`    | Explore | Searchable, paginated archive of every draw; a row expands to that draw's structure                        |
| `/insights`   | Learn   | Six panels of charts over the 6/49 era: frequency, sum distribution, parity, decade spread, pairs, weekday |
| `/strategies` | Compare | The full 203-row strategy league with filters, sorting and expandable rows                                 |

Design language: dark data product (near-black canvas, hairline borders), one accent (TOTO red), gold reserved for jackpot and rank-1 highlights, tabular numerals throughout.

## Quickstart

```bash
npm install
npm run refresh      # fetch + parse all draws, write public/data/draws.json + analysis.json
npm run verify:data  # check every artifact against the contract the UI expects
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build to dist/
```

Node ≥ 18 required. `npm run refresh` is idempotent: it keeps `public/data/draws.json`, fetches only missing draws (rate-limited at 1.2 s), then refreshes the 6 latest draws from the official fragment and regenerates `analysis.json`.

## Data artifacts

| File                          | Produced by       | Shape                                                                     |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `public/data/draws.json`      | `npm run refresh` | 1,892 draws, #2341–#4232, with prize tables where available               |
| `public/data/analysis.json`   | `npm run refresh` | 6/49-era statistics (coverage, frequency, hot/cold, sums, pairs, weekday) |
| `public/data/strategies.json` | research pipeline | 203 ranked strategies + a `meta` block (folds, chance baseline, families) |

`strategies.json` is a **committed league artifact**: it is re-scored by the research pipeline, not by `npm run refresh`, so a routine data refresh never clobbers it. `npm run verify:data` checks all three artifacts — draw ordering, number ranges, analysis sections, and the league contract (ranks form a permutation, scores are 0–100, every current pick holds six unique numbers) — and exits non-zero on drift.

Strategy league semantics: each strategy picks six numbers from strictly earlier draws and is scored against the real outcome over 100 walk-forward folds. `meanHits` is compared with the chance expectation (0.7347 hits per line), `zScore` is the standardised difference, and `score` (0–100) is scaled around the chance baseline of 45. `recent12` is the **total** hits over the last 12 draws, not a per-draw count, so it can exceed 12.

## Data sources

- **Historical seed (2008 → 2022)**: [Aloysius-JW/Singapore-ToTo-analysis](https://github.com/Aloysius-JW/Singapore-ToTo-analysis) CSV, draws 2341–3766.
- **Per-draw backfill + live fragment**: [Singapore Pools](https://www.singaporepools.com.sg) (official results pages). Data © Singapore Pools. Reprinted for personal, non-commercial use only.

Analysis and strategy stats use the **6/49 era only** (draws since 9 Oct 2014); the history page shows the full archive back to 2008.

## Deploy to Netlify

1. Push this repo and connect it in Netlify — `netlify.toml` supplies the build command (`npm run build`), publish dir (`dist`), SPA redirect, and picks up `netlify/functions/latest.mjs` automatically.
2. Schedule a daily build (~10:45 UTC, after the Monday/Thursday results settle) so `public/data/*.json` recompute and the analysis stays current. Netlify: **Site configuration → Build & deploy → Scheduled builds**.

The home page calls `/api/latest` (the function) on load. If the function is unavailable it silently falls back to the bundled data, so the site works as pure static hosting too.

## Scope & disclaimer

Unofficial — not affiliated with Singapore Pools. For entertainment and analysis only, 18+.

TOTO draws are independent, identically distributed and uniform over 1–49. Every line carries the same 1-in-13,983,816 chance of Group 1 — including every strategy in the league. The league scores how each rule has walked forward against the chance baseline; it is **not** predictive power, and a high score describes what already happened rather than forecasting what will.
