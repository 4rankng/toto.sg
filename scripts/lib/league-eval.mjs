// toto.sg — shared walk-forward evaluation for league rows.
//
// One implementation of "how a strategy is scored", used by the league
// builder that writes public/data/strategies.json.
//
// Semantics:
//   * FOLDS = 100 walk-forward folds over the 6/49 era, oldest first. A rule
//     regenerates its line for every fold using only draws that precede it;
//     the rng is seeded per (strategy id, draw number), so reruns are
//     byte-identical apart from meta.generatedAt.
//   * totalHits counts every matched main number; chance is 6·6/49 = 0.7347
//     per draw (73.5 per 100 draws).
//   * twoPlusDraws counts the draws where at least two numbers matched — the
//     league's hit-rate metric, because a lone 1-number match is chance noise.
//     Chance is P(≥2) = 15.1% of draws.
//   * totalPrizes counts prize draws (≥3 matched, or 2 with the additional);
//     chance is P(prize) ≈ 1.86 per 100 draws. effPrizes = totalPrizes.
//   * zScore standardises meanHits against chance; score is a 0–100 index
//     anchored so a chance-performing row scores exactly 45.
import { scoreLine } from "./toto.mjs";

export const STAKE_PER_DRAW = 1; // S$1 Ordinary
export const REJECT_CAP = 10000; // per draw; a cap hit means a bug in the rule encoding

/**
 * The fold window is EXPANDING: every era draw after the warm-up is graded
 * against the full history that preceded it, and the window grows with every
 * new draw — never a fixed trailing slice. The warm-up only skips the era's
 * first draws, where 50-draw velocity and Bollinger-20 windows have no data.
 */
export const WARMUP_DRAWS = 50;

// ---------------------------------------------------------------------------
// Chance nulls for a uniform random 6-of-49 line vs a 6-number draw.
// P(k) = C(6,k)·C(43,6−k)/C(49,6).
// ---------------------------------------------------------------------------
const binom = (n, k) => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return Math.round(r);
};
const TOTAL_LINES = binom(49, 6);
const pExactly = (k) => (binom(6, k) * binom(43, 6 - k)) / TOTAL_LINES;

/** Chance that one random line matches k numbers. */
export const CHANCE = {
    expectedHitsPerLine: Math.round((36 / 49) * 10000) / 10000, // 0.7347
    hitsPer100Draws: Math.round((3600 / 49) * 10) / 10, // 73.5
    twoPlusPer100Draws: Math.round((1 - pExactly(0) - pExactly(1)) * 1000) / 10, // 15.1
    prizesPer100Draws: Math.round((1 - pExactly(0) - pExactly(1) - pExactly(2)) * 10000) / 100, // 1.86
    // Prize quality, weighted by matched numbers − 2: a 3-match draw is worth
    // 1 point, a 4-match 2, a 5-match (G2/G3) 3 and a jackpot (G1) 4 — so the
    // score rewards deep tiers, not just prize frequency. The additional ball
    // never changes the weight: G2 weighs like G3, G6 like G7.
    weightedPrizesPer100Draws:
        Math.round((pExactly(3) * 1 + pExactly(4) * 2 + pExactly(5) * 3 + pExactly(6) * 4) * 10000) / 100, // 1.96
    scoreBaseline: 45,
};
/**
 * Score index, anchored at 45 = chance, built from chance-relative terms so it
 * reads the same at any fold count: hit strength (z), prize quality per 100
 * draws above the weighted chance, and recent form above its 12-draw null.
 */
const chanceScore = (zScore, weightedPrizes, folds, recent12) =>
    CHANCE.scoreBaseline +
    7.8 * zScore +
    5.5 * ((weightedPrizes / folds) * 100 - CHANCE.weightedPrizesPer100Draws) +
    0.6 * (recent12 - CHANCE.expectedHitsPerLine * 12);

/** mulberry32 PRNG. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** FNV-1a 32-bit string hash. */
export function fnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** The deterministic rng for one (strategy id, draw number) pair. */
export const rngFor = (id, drawNo) => mulberry32(fnv1a(`${id}:${drawNo}`));

export const round2 = (x) => Math.round(x * 100) / 100;
export const round1 = (x) => Math.round(x * 10) / 10;

/** Sample standard deviation (ddd = 1) of the per-fold hit counts. */
export function sampleSd(counts) {
    if (counts.length < 2) return 0;
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const ss = counts.reduce((acc, x) => acc + (x - mean) ** 2, 0);
    return Math.sqrt(ss / (counts.length - 1));
}

/**
 * Generate one line for `id`/`target.draw`, rejecting up to REJECT_CAP
 * candidates. `rule` is called as rule(prior, target, rng, prepared).
 */
export function generateLine(id, rule, prior, target, prepared) {
    const rng = rngFor(id, target.draw);
    for (let attempt = 0; attempt < REJECT_CAP; attempt++) {
        const line = rule(prior, target, rng, prepared);
        if (line != null) {
            if (line.length !== 6 || new Set(line).size !== 6 || line.some((n) => n < 1 || n > 49)) {
                throw new Error(`${id}: rule produced an invalid line on draw ${target.draw}`);
            }
            return line;
        }
    }
    throw new Error(`${id}: rejection cap on draw ${target.draw}`);
}

/**
 * Score one strategy over an expanding walk-forward window: era[foldStart..foldEnd).
 *
 * `spec` is {id, name, family, description, rule}. `prepare` optionally returns
 * the fourth argument handed to the rule (computed once per fold, never per
 * attempt). `expectedHits` is the chance null for the mean match count.
 *
 * `foldCache`/{get,set} lets the builder reuse a persisted (strategy, draw)
 * evaluation — pick, matched count, prize group and share — so reruns never
 * regenerate a fold whose history prefix is unchanged. `nextPickCache` does
 * the same for the current pick, whose validity the builder ties to the whole
 * archive.
 */
export function evaluateStrategy(
    spec,
    era,
    foldStart,
    foldEnd,
    expectedHits,
    { prepare, nextTarget, foldCache, nextPickCache } = {},
) {
    const perFoldHits = [];
    let totalHits = 0;
    let twoPlusDraws = 0;
    let totalPrizes = 0;
    let weightedPrizes = 0;
    let bestGroup = null;
    let totalWinnings = 0;
    for (let i = foldStart; i < foldEnd; i++) {
        const draw = era[i];
        const cached = foldCache?.get(draw.draw);
        let pick;
        let matched;
        let group;
        if (cached) {
            pick = cached.p;
            matched = cached.m;
            group = cached.g;
        } else {
            const prior = era.slice(0, i);
            pick = generateLine(spec.id, spec.rule, prior, draw, prepare ? prepare(prior, draw) : undefined);
            // Raw match count: every matched main number counts (chance 0.7347/draw).
            matched = draw.numbers.filter((n) => pick.includes(n)).length; // main numbers only
            group = scoreLine(pick, draw);
            foldCache?.set(draw.draw, { p: pick, m: matched, g: group, s: group > 0 ? draw.prizes?.[`g${group}`]?.share ?? null : null });
        }
        perFoldHits.push(matched);
        totalHits += matched;
        if (matched >= 2) twoPlusDraws += 1; // hit-rate metric: a lone 1-match is noise
        if (group > 0) {
            totalPrizes += 1;
            weightedPrizes += matched - 2; // 3-match=1 … 6-match=4: deep tiers weigh more
            if (bestGroup === null || group < bestGroup) bestGroup = group;
            if (cached) {
                if (cached.s != null) totalWinnings += cached.s;
            } else {
                const share = draw.prizes?.[`g${group}`]?.share;
                if (share != null) totalWinnings += share;
            }
        }
    }
    const folds = foldEnd - foldStart;
    const meanHits = totalHits / folds;
    const sd = sampleSd(perFoldHits);
    // se of the mean over the actual fold count.
    const zScore = sd === 0 ? 0 : round2((meanHits - expectedHits) / (sd / Math.sqrt(folds)));
    const effPrizes = totalPrizes;
    const pnlPerDraw = round2((totalWinnings - folds * STAKE_PER_DRAW) / folds);
    const recent12 = perFoldHits.slice(-12).reduce((a, b) => a + b, 0);
    const score = round1(Math.min(100, Math.max(0, chanceScore(zScore, weightedPrizes, folds, recent12))));
    const currentPick =
        nextPickCache?.get() ??
        generateLine(spec.id, spec.rule, era, nextTarget, prepare ? prepare(era, nextTarget) : undefined);
    nextPickCache?.set(currentPick);
    return {
        id: spec.id,
        name: spec.name,
        family: spec.family,
        description: spec.description,
        evaluatedDraws: folds,
        totalHits,
        meanHits: round2(meanHits),
        expectedHits,
        zScore,
        score,
        totalPrizes,
        effPrizes,
        weightedPrizes,
        bestGroup,
        pnlPerDraw,
        twoPlusDraws,
        recent12,
        rank: 0, // assigned by the league-wide re-rank
        currentPick,
    };
}
