// toto.sg — the edge-verification experiment routes.
//
//   ROUTE 1  biased-pool Bayesian: per-ball Beta-Binomial posterior with
//            shrinkage toward the uniform 6/pool baseline, sampled (or ranked)
//            into lines — always walk-forward: the counts at draw t come from
//            same-era draws strictly before t. Raw frequency is never a
//            weight; the smallest shrinkage cell is w=2 pseudo-trials.
//   ROUTE 4  verification harness: the ceiling probe (M seeded uniform
//            variants), the null-shuffle benchmark (synthetic uniform
//            histories run through the identical pipeline) and the league
//            train/holdout selection audit (winner's curse).
//   ROUTE 2  RNG-family coverage: mulberry32 / MT19937 / Philox4x32 quickpick
//            variants — search-space expansion, never predictive evidence.
//
// Zero deps. Deterministic: every rng is seeded per (variant id, draw no) or
// by an explicit seed; reruns are byte-identical.
import { scoreLine } from "./toto.mjs";
import { rngFor, WARMUP_DRAWS } from "./league-eval.mjs";
import { gumbelTopK, maskOf, matchCount2, popcount2, quickpickMask, quickpickNums, mulberry32 } from "./edge-rng.mjs";
import { chanceNulls, r4 } from "./edge-stats.mjs";

// ---------------------------------------------------------------------------
// Route 1 — the Bayesian biased-pool grid
// ---------------------------------------------------------------------------

/** Shrinkage grid: pseudo-trials added per ball (prior mean = 6/pool). */
export const SHRINK_GRID = [2, 12, 60, 300, 1500];
/** Training windows: the whole same-era history, or the last 250 draws. */
export const WINDOW_MODES = ["expanding", "rolling250"];
const ROLLING = 250;
/** The shrinkage used by the deterministic top-6 ranker. */
const TOP_W = 60;

/** Variant ids for one era, in fixed order. */
export function route1Variants() {
    const ids = [`bpTop-expanding`, `bpTop-rolling250`];
    for (const win of WINDOW_MODES) for (const w of SHRINK_GRID) ids.push(`bpSample-${win}-w${w}`);
    ids.push(`uniformQuickpick`);
    return ids;
}

export const parseVariantId = (id) => {
    if (id === "uniformQuickpick") return { kind: "uniform" };
    const [name, win, w] = id.split("-");
    if (name === "bpTop") return { kind: "top", win, w: TOP_W };
    return { kind: "sample", win, w: Number(w.slice(1)) };
};

/**
 * Walk-forward evaluation of the whole Route 1 grid over one era.
 *
 * For every fold t (era index ≥ warmup) the per-ball hit counts come only
 * from era draws strictly before t — same-era only, so no 6/45 history ever
 * feeds a 6/49 fold. Counts are accumulated once per window mode and shared
 * across the shrinkage grid; the posterior mean is
 *   p̂_i = (hits_i + w·(6/pool)) / (6·n_draws + w).
 *
 * Returns one row per variant: per-fold hit / prize / two-plus arrays (for
 * bootstrap and window slices), prize points, and the line it would play on
 * the next unpublished draw.
 */
export function runRoute1Grid(eraDraws, pool, { warmup = WARMUP_DRAWS, nextDrawNo = null } = {}) {
    const chance = chanceNulls(pool);
    const p0 = chance.meanHits / 6;
    const variantIds = route1Variants();
    const parsed = new Map(variantIds.map((id) => [id, parseVariantId(id)]));
    const rows = new Map(
        variantIds.map((id) => [
            id,
            { hits: [], prizes: [], twos: [], score: 0, bestGroup: null, tiers: { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0, g7: 0 }, lastLine: null },
        ]),
    );

    // Per-window incremental hit counts (pool slots, ≤49).
    const counts = { expanding: new Float64Array(pool), rolling250: new Float64Array(pool) };
    const nPrior = { expanding: 0, rolling250: 0 };
    // The rolling window keeps exact counts over the last ROLLING same-era
    // draws: the log stores their number arrays, oldest first, and the
    // outgoing draw's balls are subtracted when it slides out.
    const windowLog = [];
    const weightsBuf = new Float64Array(pool);
    const orderBuf = new Array(pool);

    const grade = (id, line, target) => {
        const row = rows.get(id);
        let matched = 0;
        for (const n of line) if (target.numbers.includes(n)) matched++;
        const group = scoreLine(line, target);
        row.hits.push(matched);
        row.twos.push(matched >= 2 ? 1 : 0);
        row.prizes.push(group > 0 ? 1 : 0);
        if (group > 0) {
            const pts = 10 ** (7 - group);
            row.score += pts;
            row.tiers[`g${group}`] += 1;
            if (row.bestGroup === null || group < row.bestGroup) row.bestGroup = group;
        }
    };

    for (let i = warmup; i < eraDraws.length; i++) {
        const target = eraDraws[i];
        // Advance the two windows to cover eraDraws[0..i).
        while (nPrior.expanding < i) {
            for (const n of eraDraws[nPrior.expanding].numbers) counts.expanding[n - 1] += 1;
            nPrior.expanding += 1;
        }
        while (nPrior.rolling250 < i) {
            const d = eraDraws[nPrior.rolling250];
            nPrior.rolling250 += 1;
            windowLog.push(d.numbers);
            for (const n of d.numbers) counts.rolling250[n - 1] += 1;
            if (windowLog.length > ROLLING) {
                for (const n of windowLog.shift()) counts.rolling250[n - 1] -= 1;
            }
        }

        for (const [id, v] of parsed) {
            let line = null;
            if (v.kind === "uniform") {
                line = quickpickNums(rngFor(id, target.draw), pool);
            } else {
                const c = counts[v.win];
                const nDraws = v.win === "expanding" ? nPrior.expanding : windowLog.length;
                const trials = 6 * nDraws;
                const w = v.w;
                if (v.kind === "top") {
                    for (let b = 0; b < pool; b++) orderBuf[b] = b;
                    orderBuf.sort((a, b) => c[b] - c[a] || a - b);
                    line = orderBuf.slice(0, 6).map((b) => b + 1).sort((a, b) => a - b);
                } else {
                    for (let b = 0; b < pool; b++) weightsBuf[b] = (c[b] + w * p0) / (trials + w);
                    line = gumbelTopK(Array.from(weightsBuf), 6, rngFor(id, target.draw)).sort((a, b) => a - b);
                }
            }
            grade(id, line, target);
        }
    }

    // The line each variant would put on the next (unpublished) draw: same
    // walk-forward discipline, counts as of the end of the era.
    if (nextDrawNo != null) {
        for (const [id, v] of parsed) {
            let line = null;
            if (v.kind === "uniform") {
                line = quickpickNums(rngFor(id, nextDrawNo), pool);
            } else {
                const c = counts[v.win];
                const nDraws = v.win === "expanding" ? nPrior.expanding : windowLog.length;
                const trials = 6 * nDraws;
                if (v.kind === "top") {
                    for (let b = 0; b < pool; b++) orderBuf[b] = b;
                    orderBuf.sort((a, b) => c[b] - c[a] || a - b);
                    line = orderBuf.slice(0, 6).map((b) => b + 1).sort((a, b) => a - b);
                } else {
                    for (let b = 0; b < pool; b++) weightsBuf[b] = (c[b] + v.w * p0) / (trials + v.w);
                    line = gumbelTopK(Array.from(weightsBuf), 6, rngFor(id, nextDrawNo)).sort((a, b) => a - b);
                }
            }
            rows.get(id).lastLine = line;
        }
    }

    return { rows, chance, p0 };
}

// ---------------------------------------------------------------------------
// Ceiling probe — M seeded uniform variants, identical grading to the league.
// ---------------------------------------------------------------------------

/**
 * Probe variants [fromVariant, toVariant) over the mask arrays (one entry per
 * graded fold: draw lo/hi mask + additional lo/hi mask). Streams per-variant
 * aggregates: weighted prize points (the league score), mean hits, prize and
 * two-plus rates, plus the max over the FIRST 50k variants for matched-M
 * comparison against the null-shuffle runs.
 */
export function probeChunk({ dmLo, dmHi, adLo, adHi }, fromVariant, toVariant) {
    const folds = dmLo.length;
    let sum = 0;
    let sumSq = 0;
    let hits = 0;
    let prizes = 0;
    let twos = 0;
    let maxScore = -1;
    let maxScoreSeed = -1;
    let maxScoreFirst50k = -1;
    let maxHits = -1;
    let maxHitsSeed = -1;
    let maxHitsFirst50k = -1;
    const top = []; // top-10 by score: [score, seed, hits]
    const push = (score, seed, h) => {
        if (top.length < 10) {
            top.push([score, seed, h]);
            top.sort((a, b) => b[0] - a[0]);
        } else if (score > top[9][0]) {
            top[9] = [score, seed, h];
            top.sort((a, b) => b[0] - a[0]);
        }
    };
    for (let v = fromVariant; v < toVariant; v++) {
        const rng = mulberry32((Math.imul(v, 2654435761) + 0x1234567) >>> 0);
        let score = 0;
        let h = 0;
        for (let f = 0; f < folds; f++) {
            const [lo, hi] = quickpickMask(rng, 49);
            const m = matchCount2(lo, hi, dmLo[f], dmHi[f]);
            h += m;
            let g = 0;
            if (m >= 3) {
                const addHit = (lo & adLo[f]) !== 0 || (hi & adHi[f]) !== 0;
                g = m === 6 ? 1 : m === 5 ? (addHit ? 2 : 3) : m === 4 ? (addHit ? 4 : 5) : addHit ? 6 : 7;
            }
            if (g) score += 10 ** (7 - g);
            if (m >= 2) twos += 1;
            if (g) prizes += 1;
        }
        sum += score;
        sumSq += score * score;
        hits += h;
        if (score > maxScore) {
            maxScore = score;
            maxScoreSeed = v;
        }
        if (v < 50000 && score > maxScoreFirst50k) maxScoreFirst50k = score;
        const meanH = h / folds;
        if (meanH > maxHits) {
            maxHits = meanH;
            maxHitsSeed = v;
        }
        if (v < 50000 && meanH > maxHitsFirst50k) maxHitsFirst50k = meanH;
        push(score, v, meanH);
    }
    return {
        fromVariant,
        toVariant,
        sum,
        sumSq,
        hits,
        prizes,
        twos,
        maxScore,
        maxScoreSeed,
        maxScoreFirst50k,
        maxHits,
        maxHitsSeed,
        maxHitsFirst50k,
        top,
    };
}

export function mergeProbeChunks(chunks, folds) {
    let sum = 0;
    let sumSq = 0;
    let hits = 0;
    let prizes = 0;
    let twos = 0;
    let maxScore = -1;
    let maxScoreSeed = -1;
    let maxScoreFirst50k = -1;
    let maxHits = -1;
    let maxHitsSeed = -1;
    let maxHitsFirst50k = -1;
    let variants = 0;
    for (const c of chunks) {
        sum += c.sum;
        sumSq += c.sumSq;
        hits += c.hits;
        prizes += c.prizes;
        twos += c.twos;
        variants += c.toVariant - c.fromVariant;
        if (c.maxScore > maxScore) {
            maxScore = c.maxScore;
            maxScoreSeed = c.maxScoreSeed;
        }
        if (c.maxScoreFirst50k > maxScoreFirst50k) maxScoreFirst50k = c.maxScoreFirst50k;
        if (c.maxHits > maxHits) {
            maxHits = c.maxHits;
            maxHitsSeed = c.maxHitsSeed;
        }
        if (c.maxHitsFirst50k > maxHitsFirst50k) maxHitsFirst50k = c.maxHitsFirst50k;
    }
    const mean = sum / variants;
    const sd = Math.sqrt(Math.max(sumSq / variants - mean * mean, 0));
    const top = chunks
        .flatMap((c) => c.top)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 10)
        .map(([score, seed, h]) => ({ seed, score, meanHits: Math.round(h * 10000) / 10000 }));
    return {
        variants,
        folds,
        meanScore: Math.round(mean * 100) / 100,
        sdScore: Math.round(sd * 100) / 100,
        maxScore,
        maxScoreSeed,
        maxScoreFirst50k,
        maxMeanHits: Math.round((maxHits) * 10000) / 10000,
        maxMeanHitsSeed: maxHitsSeed,
        maxMeanHitsFirst50k: Math.round(maxHitsFirst50k * 10000) / 10000,
        meanHits: Math.round((hits / (variants * folds)) * 10000) / 10000,
        prizeRate: Math.round((prizes / (variants * folds)) * 10000) / 10000,
        twoPlusRate: Math.round((twos / (variants * folds)) * 10000) / 10000,
        topScores: top,
    };
}

/** The √(2·ln M) expected max of M unit-normal tails, in score-sd units. */
export const expectedMaxFactor = (m) => Math.sqrt(2 * Math.log(m));

// ---------------------------------------------------------------------------
// Null-shuffle benchmark — synthetic uniform histories.
// ---------------------------------------------------------------------------

/** Fisher–Yates with a seeded rng. */
const shuffled = (arr, rng) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const uniformDraw = (rng, pool) => {
    const poolArr = Array.from({ length: pool }, (_, i) => i + 1);
    const line = shuffled(poolArr, rng).slice(0, 6).sort((a, b) => a - b);
    const rest = poolArr.filter((n) => !line.includes(n));
    const additional = rest[(rng() * rest.length) | 0];
    return { numbers: line, additional };
};

/**
 * One synthetic history. `mode`:
 *   "iid"      — every draw is a fresh uniform 6-of-pool + additional, real
 *                draw numbers and dates, era sizes preserved.
 *   "permuted" — the real draws of each era, order-shuffled and ball-relabelled
 *                by a seeded permutation of 1..pool (marginals preserved,
 *                temporal structure destroyed).
 */
export function syntheticHistory(era45, era49, mode, seed) {
    const rng = mulberry32(seed);
    const build = (era, pool) => {
        if (mode === "iid") {
            return era.map((d) => ({ draw: d.draw, date: d.date, ...uniformDraw(rng, pool) }));
        }
        const perm = shuffled(Array.from({ length: pool }, (_, i) => i + 1), rng);
        const relabel = (d) => ({
            draw: d.draw,
            date: d.date,
            numbers: d.numbers.map((n) => perm[n - 1]).sort((a, b) => a - b),
            additional: d.additional == null ? null : perm[d.additional - 1],
        });
        return shuffled(era, rng).map(relabel);
    };
    return { era45: build(era45, 45), era49: build(era49, 49) };
}

// ---------------------------------------------------------------------------
// The five Tempo rules, evaluated over any history (real or synthetic).
// They are full-board lucky-dial lines: fixed seeds, no history input, so the
// identical rule runs unchanged on every null history.
// ---------------------------------------------------------------------------
import { HUNTER_RULES } from "./hunter-rules.mjs";

export const TEMPO_IDS = ["tempoFortissimo", "tempoAllegro", "tempoVivace", "tempoPresto", "tempoAndante"];

export function evaluateTempos(eraDraws, { warmup = WARMUP_DRAWS } = {}) {
    return TEMPO_IDS.map((id) => {
        const rule = HUNTER_RULES[id];
        let score = 0;
        let hits = 0;
        let prizes = 0;
        let bestGroup = null;
        const tiers = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0, g7: 0 };
        for (let i = warmup; i < eraDraws.length; i++) {
            const target = eraDraws[i];
            const prior = eraDraws.slice(0, i);
            const line = rule(prior, target, rngFor(id, target.draw));
            let matched = 0;
            for (const n of line) if (target.numbers.includes(n)) matched++;
            const group = scoreLine(line, target);
            hits += matched;
            if (group > 0) {
                score += 10 ** (7 - group);
                prizes += 1;
                tiers[`g${group}`] += 1;
                if (bestGroup === null || group < bestGroup) bestGroup = group;
            }
        }
        const folds = eraDraws.length - warmup;
        return { id, folds, score, meanHits: Math.round((hits / folds) * 10000) / 10000, prizes, bestGroup, tiers };
    });
}

// ---------------------------------------------------------------------------
// Route 2 — RNG-family coverage variants (uniform quickpicks, three engines).
// ---------------------------------------------------------------------------

import { RNG_FAMILIES } from "./edge-rng.mjs";

export function runRoute2RngGrid(eraDraws, { warmup = WARMUP_DRAWS } = {}) {
    const seedLabels = ["a", "b", "c"];
    const rows = [];
    for (const [family, make] of Object.entries(RNG_FAMILIES)) {
        for (const label of seedLabels) {
            const baseSeed = family.length * 1000003 + label.charCodeAt(0) * 7919;
            const id = `rng-${family}-${label}`;
            let score = 0;
            let hits = 0;
            let prizes = 0;
            let twos = 0;
            let bestGroup = null;
            for (let i = warmup; i < eraDraws.length; i++) {
                const target = eraDraws[i];
                const rng = make((baseSeed + target.draw) >>> 0);
                const line = quickpickNums(rng, 49);
                let matched = 0;
                for (const n of line) if (target.numbers.includes(n)) matched++;
                const group = scoreLine(line, target);
                hits += matched;
                if (matched >= 2) twos += 1;
                if (group > 0) {
                    score += 10 ** (7 - group);
                    prizes += 1;
                    if (bestGroup === null || group < bestGroup) bestGroup = group;
                }
            }
            const folds = eraDraws.length - warmup;
            rows.push({
                id,
                family,
                seedLabel: label,
                folds,
                score,
                meanHits: Math.round((hits / folds) * 10000) / 10000,
                prizeRate: Math.round((prizes / folds) * 10000) / 10000,
                twoPlusRate: Math.round((twos / folds) * 10000) / 10000,
                bestGroup,
            });
        }
    }
    return rows;
}
