# toto.sg

Unofficial Singapore TOTO statistics: the latest result, the full draw archive, number stats, a ranked strategy league scored against random picks, and a 7×7 heat board with a System 6/7/8 play slip.

Pure static Vite SPA + precomputed JSON. All heavy computation (parsing, analysis, league scoring) runs offline; the client only renders. No backend — the one serverless component is a Netlify Function that keeps the "latest result" panel fresh between rebuilds.

## The four surfaces

| Route         | Surface | What it is                                                                                                 |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `/`           | Monitor | Latest draw with prize table, next-draw countdown & regime briefing strip, top strategies, 7-lens `NumberBoard` (All time, Last 50, 10-Draw Surge, Skip/Due, RSI-14, G3 EV, Bot Votes), and System 6/7/8 play slip with live `TicketXRay` combinatorial backtester |
| `/history`    | Explore | Searchable, paginated archive of every draw with payout regime filters (Rollover, Solo G1, Split G1, High/Crowded G3, 3+ Consecutive), expanded draw anatomy (cage metrics, carry-over lag, crowd volume), and "Load in Play Slip →" |
| `/insights`   | Learn   | 104 panels across 9 galleries: frequency, correlations, autocorrelation, geometry, folklore waves, crowd tax, indicators & oscillators (RSI, MACD, Bollinger, Hurst, Entropy, CUSUM, Kaplan-Meier), Togel & Mark Six almanac, and systems & EV forensics, with viewport-lazy section mounting |
| `/strategies` | Compare | 263-strategy league across 26 families (including 24 indicator & oscillator strategies) with search, type filter, sorting (Score, Hits, Prizes, Recent 12, G3 EV), current pick X-Ray diagnostics, and "Load in Play Slip →" |

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

| File                                | Produced by         | Shape                                                                     |
| ----------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `public/data/draws.json`            | `npm run refresh`   | 1,892 draws, #2341–#4232, with prize tables where available               |
| `public/data/analysis.json`         | `npm run refresh`   | 6/49-era statistics (coverage, frequency, hot/cold, sums, pairs, weekday) |
| `public/data/strategies.json`       | `npm run league`    | the ranked strategy league + a `meta` block (folds, chance baseline, families) |
| `public/data/gambler-playbook.json` | `npm run league`    | The 10 cross-panel gambler strategies: rules, evidence panels, spec lines |

`strategies.json` is a **committed league artifact**: it is re-scored by the league scripts, not by `npm run refresh`, so a routine data refresh never clobbers it. `npm run league` regenerates it in three passes — `league:custom` writes the curated lines and generator rules, `league:gambler` adds the 10 cross-panel gambler strategies and rewrites `gambler-playbook.json`, and `league:indicators` evaluates 24 technical indicator and oscillator strategies. `npm run verify:data` checks every artifact — draw ordering, number ranges, analysis sections, and the league contract (ranks form a permutation, scores are 0–100, every current pick holds six unique numbers) — and exits non-zero on drift.

The 10 gambler strategies come from `toto_10_gambler_strategies.docx`: each pairs a statistical cage property with a pari-mutuel anti-collision mechanism, so none of them repeats a single-variable rule. Their rules live in `scripts/lib/gambler-rules-a.mjs` and `scripts/lib/gambler-rules-b.mjs`; the shared vocabulary (velocity residuals, pair counts, skip gaps, residue and tail classes, playslip geometry) is in `scripts/lib/gambler-stats.mjs`. The document's illustrative line is kept in the playbook as the strategy's *spec line*; the league row always carries the rule's own current pick.

Strategy league semantics: each strategy picks six numbers from strictly earlier draws and is scored against the real outcome over 100 walk-forward folds. A draw's matched numbers count only when at least two matched — a lone 1-number match is chance noise and scores zero — so `meanHits` is compared with the chance expectation of 0.3217 per line (0.7347 raw minus the exactly-one-match mass). `zScore` is the standardised difference, and `score` (0–100) is scaled around the chance baseline of 45. `recent12` is the **total** hits over the last 12 draws, not a per-draw count, so it can exceed 12.

## Data sources
- **Historical seed (2008 → 2022)**: [Aloysius-JW/Singapore-ToTo-analysis](https://github.com/Aloysius-JW/Singapore-ToTo-analysis) CSV, draws 2341–3766.
- **Per-draw backfill + live fragment**: [Singapore Pools](https://www.singaporepools.com.sg) (official results pages). Data © Singapore Pools. Reprinted for personal, non-commercial use only.

Analysis and strategy stats use the **6/49 era only** (draws since 9 Oct 2014); the history page shows the full archive back to 2008.

## The number board & play slip

`/` carries a 7×7 board of every number from 1 to 49 with 7 interactive lenses:
- **All time**: 6/49-era frequency from `analysis.json`
- **Last 50**: Trailing 50-draw frequency
- **10-Draw Surge**: Short-term momentum z-score
- **Skip / Due**: Current unhit gap vs median cycle
- **RSI-14**: 14-draw Relative Strength Index
- **G3 EV**: Empirical Group 3 payout premium per ball (S$ vs era mean)
- **Bot Votes**: Consensus selections across all 263 active league strategies

The play slip beside the board supports **System 6, 7 and 8** lines with live **Ticket X-Ray** analytics:
- 8-metric indicator grid: Sum, AC value, Span, Odd/Even, Consecutive pairs, Birthday bias (≤31), 3-Term arithmetic progressions, and Distinct tails.
- Payout forensics: Estimated Group 3 share and crowd collision delta percentage.
- Full 1,892-draw historical archive backtester evaluating simulated prizes and ROI across all 7 winning tiers (C(N, 6) combinations).
- Instant presets: `+EV Anti-Crowd` (maximizes historical Group 3 payouts) and `Consensus Pick` (combines top league votes).

## Deploy to Netlify

1. Push this repo and connect it in Netlify — `netlify.toml` supplies the build command (`npm run build`), publish dir (`dist`), SPA redirect, and picks up `netlify/functions/latest.mjs` automatically.
2. Schedule a daily build (~10:45 UTC, after the Monday/Thursday results settle) so `public/data/*.json` recompute and the analysis stays current. Netlify: **Site configuration → Build & deploy → Scheduled builds**.

The home page calls `/api/latest` (the function) on load. If the function is unavailable it silently falls back to the bundled data, so the site works as pure static hosting too.

## Scope & disclaimer

Unofficial — not affiliated with Singapore Pools. For entertainment and analysis only, 18+.

TOTO draws are independent, identically distributed and uniform over 1–49. Every line carries the same 1-in-13,983,816 chance of Group 1 — including every strategy in the league. The league scores how each rule has walked forward against the chance baseline; it is **not** predictive power, and a high score describes what already happened rather than forecasting what will.
