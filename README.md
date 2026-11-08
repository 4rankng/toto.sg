# toto.sg

Unofficial Singapore TOTO statistics: the latest result, the full draw archive, number stats, a ranked strategy league scored against random picks, and a 7×7 heat board with a System 6/7/8 play slip.

Pure static Vite SPA + precomputed JSON. All heavy computation (parsing, analysis, league scoring) runs offline; the client only renders. The deployed container runs a tiny zero-dep Node server (`server.mjs`) that serves the SPA and one live endpoint, `/api/latest`, which keeps the "latest result" panel fresh between rebuilds.

## The four surfaces

| Route         | Surface | What it is                                                                                                 |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `/`           | Monitor | Latest draw with prize table, next-draw countdown & regime briefing strip, top strategies, 6-lens `NumberBoard` (All time, Last 50, 10-Draw Surge, Skip/Due, RSI-14, Bot Votes), and System 6/7/8 play slip with live `TicketXRay` combinatorial backtester |
| `/history`    | Explore | Searchable, paginated archive of every draw with regime filters, expanded draw anatomy (cage metrics, carry-over lag), and "Load in Play Slip →" |
| `/insights`   | Learn   | 128 panels across 11 galleries: the numbers, correlations & lag, the lines, folklore & sequences, the cage, indicators & oscillators (RSI, MACD, Bollinger, Hurst, Entropy, CUSUM, Kaplan-Meier), Togel, Mark Six & almanac, forensics & randomness, sequence blueprint & covering, order geometry & additive structure (Mahalanobis order statistics, gap curvature, Sidon sumsets, playslip MST, coprimality, cyclic Z49 arcs, recursive sets), and sequence dynamics & point processes (Wasserstein transport, Lempel-Ziv complexity, spectral periodograms, Hawkes intensity, recurrence quantification, union depletion, permutation entropy, Jensen-Shannon turnover) — with viewport-lazy section mounting |
| `/strategies` | Compare | 329-strategy league across 25 families with search, type filter, sorting (Score, Prizes), current pick X-Ray diagnostics, chance nulls beside every metric, "Load in Play Slip →", and the cross-panel showcase: the ten multi-panel selection rules, the Insights panels behind each, and the live row each one produces |

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
| `public/data/strategies.json`       | `npm run league`    | the ranked strategy league + a `meta` block (folds, chance nulls, families) |
| `public/data/prize-events.json`     | `npm run league`    | the prize-hit ledger — per strategy, every prize fold (draw, date, tier, line); the tier tiles expand into it |
| `public/data/cross-panel-playbook.json` | `npm run league` | the evidence behind the cross-panel family — the rule, the Insights panels it reads, the source document's example line and the live row |
| `data/league-cache.json`             | `npm run league`    | per-(strategy, draw) fold evaluations with rolling prefix-hash validation |

**The exact null tables are computed offline.** Every empirical statistic in the two deep sequence galleries (10. Order geometry, 11. Sequence dynamics) is paired with the exact null over all `C(49,6) = 13,983,816` possible lines. That enumeration is far too heavy for a browser, so `npm run nulls` (`make nulls`) computes it once and embeds the result in `src/lib/insights-sequence-dynamics.ts`; `npm run verify:nulls` (`make verify-nulls`) re-derives the nulls from the archive and fails the build if any of them drifted — including the guard that the order-statistic Mahalanobis distance averages `6.0` over the archive, the chi-square(6) null. `make deploy` runs both steps first, so the embedded tables can never drift from the code that generates them.

`strategies.json` is a **committed league artifact**: it is fully rebuilt by `npm run league` from `draws.json` alone — nothing is carried over from a previous artifact, so every row is reproducible from source. Fold evaluations are cached in `data/league-cache.json` (a committed artifact, never served): each fold is keyed by (strategy, draw) and validated against a rolling SHA-256 prefix hash of the draws before it, so a rerun recomputes only new folds — an appended draw costs exactly one fold per strategy, and an edit inside the archive invalidates precisely the folds whose history changed. `npm run verify:data` checks every artifact — draw ordering (ids and dates), number ranges, additional never among the winners, analysis sections, and the league contract (unique ids/names/descriptions, no payout families, all metric fields present and non-null including `recent12`/`pnlPerDraw`/`score`/`twoPlusDraws`, ranks a permutation, chance nulls equal the hypergeometric constants) — and exits non-zero on drift. CI (`.github/workflows/verify.yml`) reruns the league, verifies the data, and builds on every push and PR, so a hand-edited or corrupted artifact cannot ship.

Strategy league semantics — the contract every row satisfies:
- **Real data only.** Every score is computed from the archived Singapore Pools draws in `draws.json`.
- **No lookahead.** Each fold regenerates the line from strictly earlier draws; no fixed line is ever graded against a window it was curated from.
- **Reproducible.** Rules draw randomness only from `rngFor(id, drawNo)` (mulberry32 seeded by FNV-1a of `id:draw`), so reruns are byte-identical apart from `meta.generatedAt`.
- **Expanding window.** Every 6/49-era draw after a 50-draw warm-up is a fold (1,188 folds today, growing with every draw) — the full era, never a trailing slice. The warm-up only gives the 50-draw velocity and Bollinger-20 windows their minimum history.
- **Match count is the goal.** No payout or prize-sharing strategies: rows exist to match numbers, not to dodge co-winners. Prize **money** never enters the league — no profit, stake or share metric anywhere; a hit is a hit whatever it paid.
- **Every metric renders with its chance null.** `totalHits` counts matched numbers (chance 73.5 per 100 draws, 0.7347 per draw); `twoPlusDraws` is the hit rate — draws where at least two numbers matched, because a lone 1-number match is chance noise (chance 15.1 per 100 draws); `totalPrizes` counts prize draws, i.e. 3+ matched (chance 1.86 per 100); `weightedPrizes` is the score itself — prize points, where each prize draw earns 10^(7−group): G7 1, G6 10, G5 100, G4 1k, G3 10k, G2 100k, G1 1M — a decade per tier, so one Group 1 outweighs any number of Group 7s (chance ≈ 43.3 prize points per 100 draws); `bestGroup` records the best tier hit; `recent12` is the total matched over the last 12 folds (chance ≈ 8.8); `score` equals `weightedPrizes` — the prize points alone, nothing else moves it. The displayed 1–100 score is the raw points log-scaled against the theoretical ceiling (every fold a Group 1), never against the current leader — 100 is the perfect league, the leader sits near 54.

The rule families live in `scripts/lib/`: `curated-rules.mjs` (8 curated archetypes re-encoded as per-fold rules), `generator-rules.mjs` (8 deterministic generator rules), `hunter-rules.mjs` (9 seed hunters — no-recycle, tilt-rolled PCG64 lines whose numpy-seeded corpus from the hunters guide is reproduced bit-for-bit), `desk-rules.mjs` (9 desk strategies), `matchrate-rules.mjs` (8 match-rate desk strategies), `indicator-rules.mjs` (21 technical-indicator rules), `cross-panel-rules.mjs` (10 multi-panel selection rules), and `sequence-dynamics-rules.mjs` (10 walk-forward rules built on the archive's order geometry and stream dynamics). The shared walk-forward evaluator and chance constants are `scripts/lib/league-eval.mjs`; `scripts/league-build.mjs` rebuilds the whole league in one pass.

**The cross-panel family.** Ten strategies that fuse two or more Insights panels into one line — a structural property of the cage (span, playslip geometry, prime/composite quota, digit pool, weekday regime) plus how the balls are selected (velocity, gap, skip, the league's own vote). Each is re-encoded as the *rule* its source described, never as a fixed line, so it is graded on the same footing as every other row. Two are deliberate inverses of a built-in rule — the contrarian strategy fades the vote that `consensusStack` chases, and the climax-fade strategy fades the burst the Momentum family buys — and the hollow-middle barbell is the repair the source proposed for `portfolioHighSix` and `medianLadder`. The league evaluates in **two phases** so the vote the contrarian rule fades is real: every base rule's fold line is known before the cross-panel family runs, and the consensus is recomputed per fold. `cross-panel-playbook.json` documents the ten rules — the panels each reads, the source document's example line (labelled, never graded) and the live row — and `npm run verify:data` fails the build if it carries a payout claim, because the artifact documents selection rules only.

## Data sources
- **Historical seed (2008 → 2022)**: [Aloysius-JW/Singapore-ToTo-analysis](https://github.com/Aloysius-JW/Singapore-ToTo-analysis) CSV, draws 2341–3766.
- **Per-draw backfill + live fragment**: [Singapore Pools](https://www.singaporepools.com.sg) (official results pages). Data © Singapore Pools. Reprinted for personal, non-commercial use only.

Analysis and strategy stats use the **6/49 era only** (draws since 9 Oct 2014); the history page shows the full archive back to 2008.

## The number board & play slip

`/` carries a 7×7 board of every number from 1 to 49 with 6 interactive lenses:
- **All time**: 6/49-era frequency from `analysis.json`
- **Last 50**: Trailing 50-draw frequency
- **10-Draw Surge**: Short-term momentum z-score
- **Skip / Due**: Current unhit gap vs median cycle
- **RSI-14**: 14-draw Relative Strength Index
- **Bot Votes**: Consensus selections across every active league strategy

The play slip beside the board supports **System 6, 7 and 8** lines with live **Ticket X-Ray** analytics:
- 7-metric indicator grid: Sum, AC value, Span, Odd/Even, Consecutive pairs, 3-Term arithmetic progressions, and Distinct tails, plus composition flags for rare line shapes.
- Full 1,892-draw historical backtester: how many numbers the line would have matched in every archived draw, and the prize tiers those matches hit (C(N, 6) combinations).
- Instant preset: `Bot Consensus` in the X-Ray empty state loads the league-wide vote line into the slip.

## Deploy

Self-hosted via Docker — `make deploy` regenerates the league, verifies the data, builds, pushes the `ghcr.io/4rankng/toto.sg:main` image, restarts the `toto-web` container on the server, and smoke-tests the live endpoints. Live at **https://toto.tingting.vip**; `make check` runs the live checks on its own.

The home page calls `/api/latest` (served by `server.mjs` in the container) on load. If the endpoint is unavailable it silently falls back to the bundled data, so the site works as pure static hosting too.

## Scope & disclaimer

Unofficial — not affiliated with Singapore Pools. For entertainment and analysis only, 18+.

TOTO draws are independent, identically distributed and uniform over 1–49. Every line carries the same 1-in-13,983,816 chance of Group 1 — including every strategy in the league. The league scores how each rule has walked forward against the chance baseline; it is **not** predictive power, and a high score describes what already happened rather than forecasting what will.
