# The strategy platform — author guide

Everything you need to add a strategy family or a single rule to the league
without touching `scripts/league-build.mjs`. The league contract first, the
SDK tour second, the paved-road checklist third.

## The league contract

Every rule is

```js
rule(prior, target, rng, prepared) → six unique numbers in 1..49, sorted,
                                     or null to reject (the evaluator retries)
```

- **`prior` only.** The draws strictly before the fold. Never read
  `target.numbers` — that is the answer you are being graded against.
- **`rng` only.** All randomness comes from the injected generator, seeded per
  `(strategy id, draw number)` by `league-eval.mjs`. Never `Math.random()`.
  A rule that ignores `rng` is fine (deterministic rules are welcome).
- **Six unique sorted balls or `null`.** A short or unsorted line throws.
  `padLine` tops a partial set up from the frequency leaders.
- **REJECT_CAP is 10000 per fold.** Rejection is the error channel for "this
  candidate missed my gate". A rule whose acceptance region is so narrow that
  a fold needs thousands of attempts is a bug in the rule, not a tuning knob —
  check with `npm run league:try` before you build.
- **No payout language.** No prize-sharing, co-winner, jackpot, prize-pool or
  expected-value wording in any name or description — the league scores
  **matched numbers only**. `defineFamily` enforces this at import time with
  the same regex `verify:data` runs against the artifacts.

## The SDK tour

The platform lives in `scripts/lib/platform/`:

| Module | What it owns |
|---|---|
| `kit.mjs` | line-authoring primitives — sampling, ranking, gates, padding |
| `context.mjs` | `memoisedPrepare`, `fullPrior`, `ctxMemo` — per-fold caching |
| `family.mjs` | `defineFamily` — the family manifest and its import-time validation |

`kit.mjs` re-exports the numeric kernel (`RANGE49`, `sortAsc`, `randInt`,
`sampleK`, `lineSum`, `acValue`, `consecPairs`) from
`scripts/lib/cross-panel-stats.mjs` — import the kernel through the kit; never
duplicate it.

### A gated sample (the commonest shape)

```js
import { makeGate, maskRanked, sampleGated } from "./platform/kit.mjs";

const prev = stats.lastDraw;
const mask = new Set([...prev.numbers, ...(prev.additional != null ? [prev.additional] : [])]);
const score = stats.freq.map((f, i) => f + 3 * stats.velocity[i]);
const pool = maskRanked(mask, score, 18, stats.freq); // score desc → freq → lower ball
return sampleGated(rng, pool, makeGate({ sum: [115, 185], consec: 1 }), { tries: 300 });
```

### A deterministic top-k

```js
import { topByScore } from "./platform/kit.mjs";
return topByScore(stats.skips, 6); // ascending, ties to the lower ball
```

### Widening budgets

When the doc you are encoding says "fall back to the whole board after N
attempts", that is `retryStages` — each rule keeps its own stage split and
budget constants:

```js
import { retryStages } from "./platform/kit.mjs";

retryStages(
    rng,
    [
        { pool: ensTop(ctx, 18), tries: 150 },
        { pool: unmaskedBoard, tries: 150 },
    ],
    (r, pool) => {
        const line = sortAsc(sampleK(r, pool, 6));
        return inBand(line, 115, 185) ? line : null;
    },
);
```

### Memoising fold-invariant work

`prepare` runs once per fold; a gated rule body runs once per **attempt**.
Anything deterministic and expensive the rule recomputes on every retry goes
through `ctxMemo`:

```js
import { ctxMemo } from "./platform/context.mjs";
const table = ctxMemo(prepared, "myEnum", (p) => expensiveEnumeration(p));
```

`memoisedPrepare` wraps a context builder the same way, once per
`target.draw`, shared by every rule of the family. The desk/match-rate
families read the **full archive** (both ball pools) through
`fullPrior(env.sorted, target.draw)` inside their prepare — `env` is
`{ sorted, boundaryDraw }`, handed to every prepare by the evaluator.

### Declaring the family

```js
export const LUNAR_FAMILY = defineFamily({
    rules: LUNAR_RULES,           // { [id]: rule }
    rows: LUNAR_STRATEGIES,       // [id, name, displayFamily, description][]
    prepare: memoisedPrepare(buildLunarContext), // optional
    phase: 2, votes: "crossPanel",               // only for vote-reading rules
});
```

`defineFamily` validates at import time: every row has a rule and vice-versa,
no duplicate id/name/description, no empty fields, no payout words, every
rule is a function, phase-2 families declare a vote context. It throws with
the family module's path.

## Adding a family — the checklist

1. `npm run league:new <family>` scaffolds
   `scripts/lib/<family>-rules.mjs` (two starter rules) and registers it in
   `scripts/lib/families.mjs`. For one more rule in an existing family, edit
   that family's module instead.
2. Write the rules against the kit. Never hand-roll sampling, ranking, gates
   or memoisation, and never duplicate `cross-panel-stats.mjs`.
3. Trial before you build:
   `npm run league:try <ruleId> --folds 100` — read-only scorecard plus
   per-fold attempt stats. Mean attempts per fold must stay **well under
   1000**; a fold approaching REJECT_CAP (10000) is a bug in the acceptance
   region. `--verbose` prints one line per fold (pick, matched, group,
   attempts); `--family "<display family>"` trials a whole display family.
4. `npm run league && npm run verify:data`, then commit the module together
   with the regenerated artifacts under `public/data/`.

## Phase-2 rules and votes

A rule that reads the base league's own fold lines (the per-ball vote of what
every base rule picked) declares `phase: 2` and a vote context:

- `votes: "crossPanel"` — the prepared context is
  `buildCrossPanelContext(prior, target, votes)` (the cross-panel family and
  `metaVote`).
- `votes: "fusion"` — the prepared context is
  `{ seq: <sequence context>, votes }` (the fusion family's consensus rule).
- `votes: (prior, target, votes, env) => prepared` — a custom assembly.

Phase-2 families run **after** every base rule has produced its line for each
fold; their current (next-draw) votes come from every base rule's next pick.
Trialing one (`npm run league:try`) pays a full base-league pass over the
window — the harness prints a cost note.

## Cache scoping (why adding a base rule is cheap)

`data/league-cache.json` keys a fold on `(strategy id, draw)` plus the
archive prefix hash. Phase-2 entries additionally live under the **base-set
fingerprint** — the SHA-256 of the sorted base-rule ids — so adding or
removing a base rule recomputes exactly the phase-2 folds and nothing else.
Never bump `CACHE_VERSION` for a rule change; the build prunes stale keys on
write. (Full detail: AGENTS.md §4.)

## Kept divergent (probe-failed or by-design, do not "fix")

These look like duplicates and are not. Equality probes ran before every
Step-3 swap; anything that failed its probe stayed local:

- **`topFromScore` (matchrate-rules.mjs)** — `kit.topByScore` returns its
  balls **ascending**, but `consensusScores` consumes the **rank order**
  positionally (vote 1.0 … 0.125 for the top eight). The probe passed at the
  `asLine` call site and failed at the consensus site, so the whole helper
  stays local.
- **`solveLinear` (matchrate) vs `invert6x6` (sequence-dynamics)** — different
  operations (solve vs invert), each single-use. Not unifiable.
- **Pair-z expectations** — curated and matchrate compute their own Poisson
  expectation from different inputs; only the terminal z formula is shared
  (`kit.pairZ(observed, expected)`).
- **Context builders** (`buildCatalogContext`, `buildSequenceDynamicsContext`,
  `buildDeskContext`, …) are domain code and stay in their modules.
- **`skipBandLine` lives in catalog-signal-rules.mjs, not the kit** — it is
  the byte-identical body shared by `skipBandLoad` and `skipBounce`, but it
  closes over the catalog's `ensembleScore`, so it stays with the domain it
  serves rather than in the generic kit.

Probe-verified merges that DID land: `maskedRankedSafe` ≡ `maskedRanked`
(stable-sort tie-break), `skipBounce` ≡ `skipBandLoad` (0 differences over 300
real folds), the desk/fusion top-k variants → `kit.topByScore`, the seq-dyn
`sampleK` → the kernel sampler (identical rng consumption), the retry loops of
`signalLineWide` / `zigzagParity` / `megaBalance` / `tailSumModal` →
`retryStages`, and the five hand-rolled memo Maps → `memoisedPrepare`.
