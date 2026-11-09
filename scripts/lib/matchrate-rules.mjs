// toto.sg — "match-rate desk" rules (Ten-Match-Rate-Strategies-TOTO.docx).
//
// The document benches ten estimators whose ONLY objective is matched numbers
// against the actual draw; its payout-flavoured sibling document is not
// represented here. Two of the ten already exist as league rows built from
// the same author's earlier document — TWIN-ANALOGUE is scripts/lib/
// desk-rules.mjs twin45 and ERA-BRIDGE is desk-rules eraBridge — so this file
// implements the remaining seven and CONSENSUS STACK, which rank-fuses the
// nine estimators (this file's seven plus twin45 and eraBridge from
// desk-rules, reused through their shared helpers).
//
//   sumPosterior      exact combinatorial P(ball | draw total) blended over a
//                     posterior on the next total (mean + scatter of the last
//                     20 totals)
//   shapeJoint        per-ball excess rate inside the forecast sum-band ×
//                     parity cell of the trailing 300 draws (fallbacks: band
//                     alone, then the posterior blend)
//   lagMixCarry       harmonic-weighted vote over the last six draws
//   gapBandReturn     frozen return-by-skip-band rates measured once on the
//                     first 400 archived draws; balls ranked by their band's
//                     rate, ties by current gap
//   calibratedLogit   rolling logistic model of ball inclusion (8 features,
//                     standardised, ridge-shrunk, refit every 20 draws on the
//                     trailing 400 draws)
//   clusterDensity    densest 6-clique of the pair co-occurrence z-graph:
//                     greedy seed + first-improvement swap search maximising
//                     the fifteen internal pair z-scores
//   coverGreedy       six balls that greedily push the most of the last 150
//                     draws up to ≥3 shared numbers
//   consensusStack    rank fusion: each of the nine estimators votes 1.0 …
//                     0.125 for its top eight; play the six with the most
//                     points
//
// Determinism: no RNG; the logit fits with a fixed-iteration gradient
// descent, so reruns are byte-identical apart from meta.generatedAt.
import { fingerprint, meanVec, sdVec, eraScores, nearestTwins } from "./desk-rules.mjs";
import { fullPrior, memoisedPrepare } from "./platform/context.mjs";
import { defineFamily } from "./platform/family.mjs";
import { RANGE49, pairZ as kitPairZ } from "./platform/kit.mjs";

/**
 * Deterministic ranked top-k from a per-ball score (score desc, ball asc).
 * Kept local on purpose: kit.topByScore returns its balls ASCENDING, but
 * consensusScores consumes the RANK ORDER positionally (vote 1.0 … 0.125),
 * so the two are not interchangeable here.
 */
const topFromScore = (score, k) =>
    RANGE49.map((b) => [b, score[b - 1]])
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, k)
        .map(([b]) => b);

// ---------------------------------------------------------------------------
// SUM-POSTERIOR's static combinatorics: the count of 6-subsets of 1..49 by
// total, and per-ball P(ball | total). Pure arithmetic on the cage, so it is
// computed once per process.
// ---------------------------------------------------------------------------
function buildSumTables() {
    const MAXS = 279; // 44+45+46+47+48+49
    // T6[s] = number of 6-subsets of 1..49 summing to s
    const dp = Array.from({ length: 7 }, () => new Float64Array(MAXS + 1));
    dp[0][0] = 1;
    for (let ball = 1; ball <= 49; ball++)
        for (let k = 6; k >= 1; k--)
            for (let s = MAXS; s >= ball; s--) dp[k][s] += dp[k - 1][s - ball];
    // W5excl[n][t] = 5-subsets of (1..49 \ n) summing to t
    const w5 = [];
    for (let n = 1; n <= 49; n++) {
        const d = Array.from({ length: 6 }, () => new Float64Array(MAXS + 1));
        d[0][0] = 1;
        for (let ball = 1; ball <= 49; ball++) {
            if (ball === n) continue;
            for (let k = 5; k >= 1; k--) for (let s = MAXS; s >= ball; s--) d[k][s] += d[k - 1][s - ball];
        }
        w5[n] = d[5];
    }
    return { T6: dp[6], w5 };
}
const SUM_TABLES = buildSumTables();

/** P(ball n drawn | draw total = s), exact. */
const pBallGivenSum = (n, s) => {
    const total = SUM_TABLES.T6[s];
    if (!total || s - n < 0) return 0;
    return SUM_TABLES.w5[n][s - n] / total;
};

// ---------------------------------------------------------------------------
// Per-fold shared context. `eraPrior` is the 6/49-era history before the
// fold; `full` is both eras. Heavy pieces are memoised by the caller.
// ---------------------------------------------------------------------------
export function buildMatchrateContext(eraPrior, full, boundaryDraw) {
    // --- shape forecast (same construction as desk-rules twin45) ---
    const fps = full.map(fingerprint);
    const sds = sdVec(fps);
    const forecast = meanVec(eraPrior.slice(-20).map(fingerprint));
    const twinCtx = { full, fps, sds, forecast };

    // --- totals for the posterior ---
    const last20Sums = eraPrior.slice(-20).map((d) => d.numbers.reduce((a, b) => a + b, 0));
    const meanSum = last20Sums.reduce((a, b) => a + b, 0) / last20Sums.length;
    const sumSd =
        Math.sqrt(last20Sums.reduce((acc, x) => acc + (x - meanSum) ** 2, 0) / (last20Sums.length - 1)) || 1;

    // --- full-archive counts + pair z (Poisson sd) ---
    const counts = new Array(49).fill(0);
    for (const d of full) for (const x of d.numbers) counts[x - 1]++;
    const pairObs = new Map();
    for (const d of full)
        for (let i = 0; i < 6; i++)
            for (let j = i + 1; j < 6; j++) {
                const key = d.numbers[i] * 100 + d.numbers[j];
                pairObs.set(key, (pairObs.get(key) ?? 0) + 1);
            }
    const n = full.length;
    const pairZ = (a, b) => {
        const exp = (n * (counts[a - 1] / n) * (counts[b - 1] / n)) || 1;
        return kitPairZ(pairObs.get(a * 100 + b) ?? 0, exp);
    };

    // --- current gaps over the era prior ---
    const gaps = new Array(49).fill(eraPrior.length);
    eraPrior.forEach((d, i) => {
        for (const x of d.numbers) gaps[x - 1] = eraPrior.length - 1 - i;
    });

    return {
        eraPrior,
        full,
        counts,
        pairZ,
        gaps,
        twinCtx,
        meanSum,
        sumSd,
        era: eraScores(full, boundaryDraw),
    };
}

// ---------------------------------------------------------------------------
// Frozen skip-band return rates, measured once on the first 400 archived
// draws. Bands per the document: 0, 1-2, 3-4, 5-7, 8-11, 12-15, 16-23, 24+.
// ---------------------------------------------------------------------------
const BAND_EDGES = [0, 1, 3, 5, 8, 12, 16, 24];
const bandIndex = (gap) => {
    let b = BAND_EDGES.length - 1;
    while (b > 0 && gap < BAND_EDGES[b]) b--;
    return b;
};

const FROZEN_BAND_RATES = (() => {
    // Measured lazily against whichever archive the caller loads; see
    // freezeBandRates(draws) below. Kept module-level so every fold shares it.
    return { rates: null };
})();

/** Measure the return-by-band table on the first 400 draws (once per run). */
export function freezeBandRates(sortedDraws) {
    if (FROZEN_BAND_RATES.rates) return FROZEN_BAND_RATES.rates;
    const first = sortedDraws.slice(0, 400);
    const hits = new Array(BAND_EDGES.length).fill(0);
    const opps = new Array(BAND_EDGES.length).fill(0);
    const lastSeen = new Array(49).fill(-1);
    for (let i = 0; i < first.length; i++) {
        const draw = first[i];
        if (i > 0)
            for (let b = 1; b <= 49; b++) {
                const gap = i - 1 - lastSeen[b - 1];
                opps[bandIndex(gap)] += 1;
                if (draw.numbers.includes(b)) hits[bandIndex(gap)] += 1;
            }
        for (const x of draw.numbers) lastSeen[x - 1] = i;
    }
    FROZEN_BAND_RATES.rates = opps.map((o, i) => (o > 0 ? hits[i] / o : 6 / 49));
    return FROZEN_BAND_RATES.rates;
}

// ---------------------------------------------------------------------------
// CALIBRATED LOGIT — rolling logistic regression, refit every 20 draws.
// Features (8 coefficients): bias, in-last-draw, in-draw-before, in-draw-
// before-that, gap capped at 40, all-time rate, ball number, decade.
// Standardised non-bias features, ridge λ=1, fixed 250 gradient steps.
// ---------------------------------------------------------------------------
const logitCache = new Map(); // bucket -> weights (8)

function logitFeatures(era, index, ball, rate) {
    // `index` is the draw being predicted; features use strictly earlier draws.
    const inDraw = (k) => (era[index - k] ? (era[index - k].numbers.includes(ball) ? 1 : 0) : 0);
    let gap = 40;
    for (let k = 1; k <= 40 && index - k >= 0; k++)
        if (era[index - k].numbers.includes(ball)) {
            gap = k - 1;
            break;
        }
    return [1, inDraw(1), inDraw(2), inDraw(3), Math.min(gap, 40), rate, ball, Math.floor((ball - 1) / 10)];
}

function fitLogit(era, endIndex) {
    // endIndex: first draw index NOT in training. Train on the previous 400.
    const start = Math.max(3, endIndex - 400);
    const rows = [];
    for (let i = start; i < endIndex; i++) {

        for (let b = 1; b <= 49; b++) {
            let seen = 0;
            for (let k = i; k >= 0 && k >= i - 60; k--) if (era[k].numbers.includes(b)) seen++;
            const allRate = (seen + 6) / (Math.min(i + 1, 60) + 8); // smoothed appearance rate
            rows.push({ f: logitFeatures(era, i, b, allRate), y: era[i].numbers.includes(b) ? 1 : 0 });
        }
    }
    // Standardise non-bias columns.
    const D = rows[0].f.length;
    const mean = new Array(D).fill(0);
    const sd = new Array(D).fill(1);
    for (let d = 1; d < D; d++) {
        const col = rows.map((r) => r.f[d]);
        mean[d] = col.reduce((a, b) => a + b, 0) / col.length;
        sd[d] = Math.sqrt(col.reduce((acc, x) => acc + (x - mean[d]) ** 2, 0) / col.length) || 1;
    }
    const X = rows.map((r) => r.f.map((x, d) => (d === 0 ? 1 : (x - mean[d]) / sd[d])));
    const w = new Array(D).fill(0);
    const L2 = 1;
    const lr = 1;
    for (let iter = 0; iter < 250; iter++) {
        const grad = new Array(D).fill(0);
        for (let i = 0; i < X.length; i++) {
            let z = 0;
            for (let d = 0; d < D; d++) z += w[d] * X[i][d];
            const p = 1 / (1 + Math.exp(-z));
            const err = p - rows[i].y;
            for (let d = 0; d < D; d++) grad[d] += err * X[i][d];
        }
        for (let d = 0; d < D; d++) w[d] -= (lr * (grad[d] + L2 * w[d])) / X.length;
    }
    return { w, mean, sd };
}

function logitScores(eraPrior) {
    const bucket = Math.floor(eraPrior.length / 20);
    if (!logitCache.has(bucket)) logitCache.set(bucket, fitLogit(eraPrior, eraPrior.length));
    const { w, mean, sd } = logitCache.get(bucket);
    return RANGE49.map((b) => {
        let seen = 0;
        for (let k = eraPrior.length - 1; k >= 0 && k >= eraPrior.length - 60; k--)
            if (eraPrior[k].numbers.includes(b)) seen++;
        const allRate = (seen + 6) / (Math.min(eraPrior.length, 60) + 8);
        const f = logitFeatures(eraPrior, eraPrior.length, b, allRate);
        let z = 0;
        for (let d = 0; d < w.length; d++) z += w[d] * (d === 0 ? 1 : (f[d] - mean[d]) / sd[d]);
        return z; // monotone in inclusion probability — ranking-equivalent
    });
}

// ---------------------------------------------------------------------------
// The scoring cores. Each returns a 49-length score array; MATCHRATE_RULES
// wraps them into league rules and CONSENSUS STACK fuses their top-eight
// rankings.
// ---------------------------------------------------------------------------
export const MATCH_SCORES = {
    sumPosterior(ctx) {
        const scores = new Array(49).fill(0);
        // Normal posterior over integer totals, mean/scatter of last 20.
        let wSum = 0;
        const weights = new Float64Array(280);
        for (let s = 21; s <= 279; s++) {
            const z = (s - ctx.meanSum) / ctx.sumSd;
            const w = Math.exp(-0.5 * z * z);
            weights[s] = w;
            wSum += w;
        }
        for (let s = 21; s <= 279; s++)
            if (weights[s] > 0) {
                const p = weights[s] / wSum;
                for (let b = 1; b <= 49; b++) scores[b - 1] += p * pBallGivenSum(b, s);
            }
        return scores;
    },

    shapeJoint(ctx) {
        const band = Math.floor(ctx.meanSum / 20);
        const last20 = ctx.eraPrior.slice(-20);
        const oddTarget = Math.round(last20.reduce((a, d) => a + d.numbers.filter((x) => x % 2 === 1).length, 0) / last20.length);
        const trailing = ctx.eraPrior.slice(-300);
        const inBand = (d) => Math.floor(d.numbers.reduce((a, b) => a + b, 0) / 20) === band;
        const cell = trailing.filter((d) => inBand(d) && d.numbers.filter((x) => x % 2 === 1).length === oddTarget);
        let pool = cell;
        if (cell.length < 25) {
            pool = trailing.filter(inBand);
            if (pool.length < 25) return MATCH_SCORES.sumPosterior(ctx); // documented fallback
        }
        const votes = new Array(49).fill(0);
        for (const d of pool) for (const x of d.numbers) votes[x - 1]++;
        return votes.map((v) => v - (pool.length * 6) / 49);
    },

    lagMixCarry(ctx) {
        const scores = new Array(49).fill(0);
        const last6 = ctx.eraPrior.slice(-6);
        last6.forEach((d, i) => {
            const weight = 1 / (last6.length - i); // most recent draw weighs 1
            for (const x of d.numbers) scores[x - 1] += weight;
        });
        return scores;
    },

    gapBandReturn(ctx, frozenRates) {
        const rates = frozenRates ?? FROZEN_BAND_RATES.rates;
        if (!rates) throw new Error("gapBandReturn: band rates not frozen");
        // Band rate first, then current gap (shorter gap wins), then ball asc.
        return RANGE49.map((b) => {
            const band = bandIndex(ctx.gaps[b - 1]);
            return rates[band] * 100000 - Math.min(ctx.gaps[b - 1], 99); // gap as deterministic tie-break
        });
    },

    calibratedLogit(ctx) {
        return logitScores(ctx.eraPrior);
    },

    clusterDensity(ctx) {
        const z = ctx.pairZ;
        const count = (b) => ctx.counts[b - 1];
        // Seed with the most frequent ball, greedily maximise internal affinity.
        let line = [RANGE49.reduce((best, b) => (count(b) > count(best) ? b : best), 1)];
        while (line.length < 6) {
            let best = null;
            let bestScore = -Infinity;
            for (const b of RANGE49) {
                if (line.includes(b)) continue;
                const s = line.reduce((acc, x) => acc + z(Math.min(b, x), Math.max(b, x)), 0);
                if (s > bestScore + 1e-12) {
                    best = b;
                    bestScore = s;
                }
            }
            line.push(best);
        }
        const internal = (l) => {
            let s = 0;
            for (let i = 0; i < l.length; i++)
                for (let j = i + 1; j < l.length; j++) s += z(Math.min(l[i], l[j]), Math.max(l[i], l[j]));
            return s;
        };
        // First-improvement single-ball swaps, deterministic order, capped passes.
        for (let pass = 0; pass < 10; pass++) {
            let improved = false;
            for (const c of [...line]) {
                for (const x of RANGE49) {
                    if (line.includes(x)) continue;
                    const swapped = line.map((v) => (v === c ? x : v));
                    if (internal(swapped) > internal(line) + 1e-12) {
                        line = swapped;
                        improved = true;
                        break;
                    }
                }
                if (improved) break;
            }
            if (!improved) break;
        }
        const scores = new Array(49).fill(-Infinity);
        for (const b of line) scores[b - 1] = 1;
        return scores;
    },

    coverGreedy(ctx) {
        const ref = ctx.eraPrior.slice(-150);
        const overlap = (draw, line) => draw.numbers.filter((x) => line.includes(x)).length;
        const line = [];
        while (line.length < 6) {
            let best = null;
            let bestKey = null;
            for (const b of RANGE49) {
                if (line.includes(b)) continue;
                const withB = [...line, b];
                let newlyCovered = 0;
                let totalOverlap = 0;
                for (const d of ref) {
                    const o = overlap(d, withB);
                    if (o >= 3 && overlap(d, line) < 3) newlyCovered++;
                    totalOverlap += o;
                }
                const key = [newlyCovered, totalOverlap];
                if (
                    bestKey === null ||
                    key[0] > bestKey[0] ||
                    (key[0] === bestKey[0] && key[1] > bestKey[1])
                ) {
                    best = b;
                    bestKey = key;
                }
            }
            line.push(best);
        }
        const scores = new Array(49).fill(-Infinity);
        line.forEach((b, i) => {
            scores[b - 1] = 100 - i; // preserve greedy order as ranking
        });
        return scores;
    },

    twinAnalogue(ctx) {
        // Ranking twin of desk-rules twin45 (same construction, exposed for
        // CONSENSUS STACK's top-eight vote).
        const twins = nearestTwins(ctx.twinCtx, 12);
        const votes = new Array(49).fill(0);
        for (const t of twins) for (const x of t.d.numbers) votes[x - 1]++;
        return votes.map((v) => v - (12 * 6) / 49);
    },

    eraBridgeRank(ctx) {
        return ctx.era;
    },
};

/** The nine estimators CONSENSUS STACK fuses, in document order. */
const CONSENSUS_MEMBERS = [
    "sumPosterior",
    "twinAnalogue",
    "lagMixCarry",
    "gapBandReturn",
    "eraBridgeRank",
    "calibratedLogit",
    "clusterDensity",
    "coverGreedy",
    "shapeJoint",
];

function consensusScores(ctx, frozenRates) {
    const points = new Array(49).fill(0);
    for (const member of CONSENSUS_MEMBERS) {
        const scores =
            member === "gapBandReturn" ? MATCH_SCORES.gapBandReturn(ctx, frozenRates) : MATCH_SCORES[member](ctx);
        const top8 = topFromScore(scores, 8);
        top8.forEach((b, rank) => {
            points[b - 1] += (8 - rank) / 8; // 1.0 … 0.125
        });
    }
    return points;
}

// ---------------------------------------------------------------------------
// League rules: rule(prior, target, rng, ctx) -> sorted 6-number line.
// ---------------------------------------------------------------------------
const asLine = (score) => topFromScore(score, 6).sort((a, b) => a - b);

export const MATCHRATE_RULES = {
    sumPosterior(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.sumPosterior(ctx));
    },
    shapeJoint(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.shapeJoint(ctx));
    },
    lagMixCarry(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.lagMixCarry(ctx));
    },
    gapBandReturn(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.gapBandReturn(ctx));
    },
    calibratedLogit(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.calibratedLogit(ctx));
    },
    clusterDensity(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.clusterDensity(ctx));
    },
    coverGreedy(prior, target, rng, ctx) {
        return asLine(MATCH_SCORES.coverGreedy(ctx));
    },
    consensusStack(prior, target, rng, ctx) {
        return asLine(consensusScores(ctx));
    },
};

// ---------------------------------------------------------------------------
// Row metadata: id, display name, family (existing meta.families only),
// one-line description.
// ---------------------------------------------------------------------------
export const MATCHRATE_STRATEGIES = [
    ["sumPosterior", "SUM-POSTERIOR Total Conditioning", "Sum Band", "Conditions each ball's probability on the draw's total — the exact combinatorial table over all 13,983,816 six-sets — blended over a posterior on the next total from the last 20 draws."],
    ["shapeJoint", "SHAPE-JOINT Band × Parity Cell", "Structure", "Rates every ball inside the sum band and odd-count cell the trailing 300 draws point to, falling back to the band alone and then the total posterior when the cell is thin."],
    ["lagMixCarry", "LAG-MIX Carry Vote", "Momentum", "A harmonic-weighted vote over the last six draws — the previous draw weighs 1, the one before a half — pooling six lags of the thin carry-over effect."],
    ["gapBandReturn", "GAP-BAND Return Curve", "Gap & Due", "Plays the measured return rate of each ball's skip band — frozen on the first 400 archived draws and never refit — following the curve instead of the gambler's fallacy."],
    ["calibratedLogit", "CALIBRATED LOGIT Inclusion Model", "Machine Learning", "A ridge-shrunk logistic model of ball inclusion (recency, gap, rate, number, decade) refit every 20 draws on the trailing 400, scored walk-forward."],
    ["clusterDensity", "CLUSTER-DENSITY Pair Graph", "Pairs", "Greedy seed plus swap search for the six numbers with the densest co-occurrence z-scores across all 1,176 pairs — a set-level objective no per-ball estimator expresses."],
    ["coverGreedy", "COVER-GREEDY Recent Coverage", "Ensemble", "Six balls that greedily push the most of the last 150 draws up to three or more shared numbers — maximum set coverage of the recent draws."],
    ["consensusStack", "CONSENSUS STACK Rank Fusion", "Ensemble", "Runs all nine estimators, lets each vote 1.0 down to 0.125 for its top eight, and plays the six balls the whole desk agrees on most."],
];

// The match-rate desk reads the FULL archive (both ball pools), so its
// prepare needs the whole sorted archive and the era boundary from prepareEnv.
export const MATCHRATE_FAMILY = defineFamily({
    rules: MATCHRATE_RULES,
    rows: MATCHRATE_STRATEGIES,
    prepare: memoisedPrepare((prior, target, env) =>
        buildMatchrateContext(prior, fullPrior(env.sorted, target.draw), env.boundaryDraw),
    ),
});
