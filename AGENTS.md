# AGENTS.md — working in `toto.sg`

A static Vite SPA over the verified Singapore Pools 6/49 draw archive. Every
heavy computation (archive parsing, analysis, league scoring, graph export)
runs **offline** into committed JSON; the browser only renders.

Read `CLAUDE.md` for the full house style — component conventions, the colour
token system, icon usage, and the panel/chart idioms. This file covers the
things that will break a deploy if you skip them.

---

## 1. Run the offline computation before you deploy

**The exact null tables are computed offline, and `make deploy` recomputes
them first. If you touch anything that changes a null, run `make nulls` and
commit the regenerated block.**

```bash
make nulls          # npm run nulls — recompute the exact null tables
make verify:nulls   # npm run verify:nulls — re-derive them from the archive and fail on drift
```

`scripts/offline-null-tables.mjs` enumerates the exact null distribution of
every line-shape statistic and rewrites the block between the `BEGIN/END
GENERATED NULL TABLES` sentinels in `src/lib/insights-sequence-dynamics.ts`.

**Never hand-edit inside those sentinels** — `make nulls` overwrites them.

### Why offline, and what it costs

| Statistic | Exact null over | Enumeration |
|---|---|---|
| `\|A+A\|` (Sidon sumset), gap curvature, zigzag flips, cyclic `Z₄₉` max gap | all `C(49,6) = 13,983,816` lines | 1,712,304 internal-gap compositions, weighted by `44 − S` |
| coprime-pair count, AM–GM spread | all `C(49,6)` lines | the full 13.98M subset enumeration |

A uniform 6-subset of `{1..49}` is fixed by its five **internal** gaps plus a
starting offset, and the offset only shifts the set — so `|A+A|`, the gap
curvature and the cyclic spacing all depend on the internal gaps alone. Given
internal gaps summing to `S` there are exactly `44 − S` valid offsets, so the
weighted gap enumeration gives the exact null. Coprimality is *not*
translation-invariant, so it needs the full enumeration.

The browser must never pay for that. The tables are embedded as constants.

The whole run takes ~1.7 s. `make verify-nulls` re-derives the nulls from the
archive and fails loudly if any of them drifted — including the guard that
catches a factor-of-two error in the order-statistic covariance (see §3).

---

## 2. The pipeline

```bash
make nulls          # 1. recompute the exact null tables (offline)
make verify:nulls   # 2. re-derive them from the archive, fail on drift
npm run league      # 3. rebuild strategies.json + cross-panel-playbook.json + prize-events.json + data/league-cache.json
npm run graph       # 4. rebuild graph.json + graph-*.csv (Vite SSR bundle)
npm run verify:data # 5. contract audit — unique ids/names, zero payout words, nulls, rank permutation
npm run build       # 6. strict TypeScript (tsc -b) + production Vite bundle
```

`make deploy` runs all six, then pushes the image, ships it and smoke-tests
the live endpoints. **Never hand-edit the artifacts under `public/data/`** —
they are outputs; change the generator and re-run.

---

## 3. The order-statistic covariance constant

`src/lib/insights-sequence-dynamics.ts` and `scripts/lib/sequence-dynamics-rules.mjs`
both hard-code the exact covariance of the order statistics of a uniform
6-subset of `{1..49}`:

```
Cov(X_(j), X_(k)) = (N+1)(N−n) / ((n+1)²(n+2)) · j(n−k+1) = 2150/392 · j(7−k)
```

**`2150/392`, not `4300/392`.** The coefficient is `(N+1)(N−n)/((n+1)²(n+2))`
= `50 × 43 / (49 × 8)`. A factor-of-two error here silently halves every
Mahalanobis distance and breaks the `χ²₆` null — the archive's mean `D²`
would read 3.0 instead of 6.0.

`make verify-nulls` asserts `mean D² = 6.0 ± 0.05` over the archive, so the
mistake cannot reach a deploy. The same constant appears in two places (the
browser module and the league rules module) — change both, or the two
implementations will disagree.

---

## 4. The league cache — scope it, never invalidate it

`data/league-cache.json` maps `(strategy, draw)` → the graded fold, keyed on a
rolling SHA-256 prefix hash of the draw archive.

- **Phase-1 rules** keep the plain key `${spec.id}:${drawNo}` and the plain
  prefix `String(drawNo)`. Their entries stay valid as long as the archive
  prefix is unchanged.
- **Phase-2 rules** (the cross-panel family and `metaVote`) read the base
  rules' fold lines, so their results depend on *which* base rules exist.
  Their entries therefore live under a **base-set fingerprint**:

  ```js
  const baseSetHash = createHash("sha256")
      .update(baseSpecs.map((s) => s.id).sort().join(","))
      .digest("hex")
      .slice(0, 8);
  ```

  and their cache keys become `${spec.id}:${baseSetHash}:${drawNo}`, with
  prefixes `${baseSetHash}:${drawNo}` and next-picks `${spec.id}:${baseSetHash}`.

**When you add or remove a base rule, the Phase-2 folds must recompute.** The
fingerprint does that automatically — do not bump `CACHE_VERSION`, which would
throw away every Phase-1 cache hit as well.

`league-build.mjs` prunes the cache on write, so entries left behind by an
older fingerprint do not accumulate.

---

## 5. The league contract

Every rule in `scripts/lib/*.mjs`:

- is called as `rule(prior, target, rng, prepared)`;
- returns **six unique numbers in 1..49, sorted**, or `null` to reject;
- may only read `prior` — the draws strictly before the fold. **Never read
  `target.numbers`.**
- draws its randomness only from the injected `rng` (seeded per
  `(strategy id, draw number)`) — never `Math.random()`.

Rejection is capped at `REJECT_CAP = 10000` per fold. A rule whose acceptance
region is too narrow will hit the cap and abort the build: check the
acceptance probability before adding a constraint. (The ten sequence rules in
`sequence-dynamics-rules.mjs` average 1–9 attempts per fold, worst case 29.)

`npm run verify:data` fails the build on duplicate strategy ids, names or
descriptions, a `currentPick` that is not six unique balls, a rank that is not
a permutation of `1..N`, a drifted chance null, or a payout-family name.

### Zero payout

The league scores **matched numbers only**. No strategy, caption, tooltip or
artifact may carry prize-sharing, co-winner, jackpot, prize-pool or
expected-value language. `verify-data.mjs` scans
`cross-panel-playbook.json` for those words and fails the build on a hit.
Keep the same discipline everywhere else — it is the project's core promise,
not just a lint rule.

---

## 6. Where things live

| Path | What it is |
|---|---|
| `public/data/draws.json` | the archive — the single source of truth |
| `public/data/analysis.json`, `strategies.json`, `cross-panel-playbook.json`, `prize-events.json`, `graph.json` | **generated** artifacts — never hand-edit |
| `public/data/graph-*.csv` | **generated** CSV exports of `graph.json` |
| `data/league-cache.json` | the evaluation cache — **generated** |
| `src/lib/insights-sequence-dynamics.ts` | the two deep sequence galleries' calculators + the live deep-scan |
| `src/components/insights-sequence-charts.tsx` | the six sequence SVG charts |
| `src/components/product/sequence-blueprint-bar.tsx` | `CandidateBallChip` + `SequenceBlueprintWorkbench` |
| `src/pages/insights-screen.tsx` | the 128-panel gallery index |
| `scripts/offline-null-tables.mjs` | the offline null-table generator |
| `scripts/verify-sequence-nulls.ts` | the numeric self-check for those nulls |
| `scripts/lib/sequence-dynamics-rules.mjs` | the ten walk-forward sequence rules |

`src/lib/insights-sequence-dynamics.ts` is compiled into **both** the browser
bundle and the Vite SSR bundle behind `scripts/export-graph.ts`. It must stay
runtime-neutral: typed arrays and `Math` only — no `fs`, no `window`, no
`fetch`, and no `Math.random()` inside a calculator.

---

## 7. House rules that still apply

- `src/lib/insights-sequence-dynamics.ts` and its sibling analytics modules
  are pure and deterministic. No clocks, no globals.
- The `LineBuilderProvider` stores the line in **tap order**. Any positional
  read of it must sort first (`sortedLine`), or the slot statistics and the
  charts disagree. This bit the slot-quantile panel once already.
- Chart components live in `src/components/insights-*.tsx`, use
  `useChartTooltip()` from `@/components/chart-tooltip`, set `role="img"` plus
  an `aria-label`, and colour only with the semantic theme tokens.
- The conventions in `CLAUDE.md` (kebab-case files, `Aria*` import prefixes,
  the colour token table, the icon rules) apply to new code too.

---

## 8. Before you commit

```bash
make nulls && npm run verify:nulls && npm run league && npm run graph && npm run verify:data && npm run build
```

Then check `git diff` on `public/data/` — the regenerated artifacts should be
the only thing that changed beyond your source edits. If a strategy count, a
panel count or a chance null moved, that is a finding, not a chore: work out
why before committing it.
