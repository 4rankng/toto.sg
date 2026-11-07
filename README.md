# toto.sg

Unofficial Singapore TOTO statistics: the latest result, the full draw archive, number stats, 204 number-picking strategies scored against random picks, and a 7×7 heat board with a System 6/7/8 play slip.

Pure static Vite SPA + precomputed JSON. All heavy computation (parsing, analysis, league scoring) runs offline; the client only renders. No backend — the one serverless component is a Netlify Function that keeps the "latest result" panel fresh between rebuilds.

## The four surfaces

| Route         | Surface | What it is                                                                                                 |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `/`           | Monitor | Latest draw as six balls + additional, the full prize table, a next-draw clock, the top 6 strategies, and the 7×7 heat board with its play slip |
| `/history`    | Explore | Searchable, paginated archive of every draw; a row expands to that draw's structure                        |
| `/insights`   | Learn   | Six panels of charts over the 6/49 era: frequency, sum distribution, parity, decade spread, pairs, weekday |
| `/strategies` | Compare | The full 204-strategy list with search, type filter, sorting, expandable details and each pick shown as six balls |

Design language: a dark-first mission-control console — canvas `#041018`, panel surfaces `#07202C`, 1px teal hairlines `#124155`, one signal colour (teal `#2EE6C5`, `#0F9E86` in light mode) with cyan `#35D6FF` as the second data hue, gold for the jackpot, and a cold→hot ramp for the heat board. Type is Sora for display, DM Sans for body, mono for labels and figures. The console is dark by default; the header toggle pins light (`data-theme`).

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
| `public/data/strategies.json` | research pipeline | 204 ranked strategies + a `meta` block (folds, chance baseline, families) |

`strategies.json` is a **committed league artifact**: it is re-scored by the research pipeline, not by `npm run refresh`, so a routine data refresh never clobbers it. `npm run verify:data` checks all three artifacts — draw ordering, number ranges, analysis sections, and the league contract (ranks form a permutation, scores are 0–100, every current pick holds six unique numbers) — and exits non-zero on drift.

Strategy league semantics: each strategy picks six numbers from strictly earlier draws and is scored against the real outcome over 100 walk-forward folds. `meanHits` is compared with the chance expectation (0.7347 hits per line), `zScore` is the standardised difference, and `score` (0–100) is scaled around the chance baseline of 45. `recent12` is the **total** hits over the last 12 draws, not a per-draw count, so it can exceed 12.

## Data sources

- **Historical seed (2008 → 2022)**: [Aloysius-JW/Singapore-ToTo-analysis](https://github.com/Aloysius-JW/Singapore-ToTo-analysis) CSV, draws 2341–3766.
- **Per-draw backfill + live fragment**: [Singapore Pools](https://www.singaporepools.com.sg) (official results pages). Data © Singapore Pools. Reprinted for personal, non-commercial use only.

Analysis and strategy stats use the **6/49 era only** (draws since 9 Oct 2014); the history page shows the full archive back to 2008.

## The number board

`/` carries a 7×7 board of every number from 1 to 49. Each cell shows how often the number turned up and is tinted by the z-score of that count against the expectation for the window — the **All time** window reads `analysis.json` (6/49 era), the **Last 50** window is counted client-side from the trailing 50 draws in `draws.json`. The dot marks the latest draw's numbers.

The play slip beside the board holds six, seven or eight slots — **System 6, 7 or 8**. Tap cells to fill it (re-tap to swap a number out), **Quick pick** loads the current pick of a random strategy (System 7/8 tops it up with random numbers), **Clear** empties it and **Copy line** puts it on the clipboard. Each filled slot takes the same heat tint as the number on the board.

## Deploy to Netlify

1. Push this repo and connect it in Netlify — `netlify.toml` supplies the build command (`npm run build`), publish dir (`dist`), SPA redirect, and picks up `netlify/functions/latest.mjs` automatically.
2. Schedule a daily build (~10:45 UTC, after the Monday/Thursday results settle) so `public/data/*.json` recompute and the analysis stays current. Netlify: **Site configuration → Build & deploy → Scheduled builds**.

The home page calls `/api/latest` (the function) on load. If the function is unavailable it silently falls back to the bundled data, so the site works as pure static hosting too.

## Scope & disclaimer

Unofficial — not affiliated with Singapore Pools. For entertainment and analysis only, 18+.

TOTO draws are independent, identically distributed and uniform over 1–49. Every line carries the same 1-in-13,983,816 chance of Group 1 — including every strategy in the league. The league scores how each rule has walked forward against the chance baseline; it is **not** predictive power, and a high score describes what already happened rather than forecasting what will.
