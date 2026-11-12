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
//   * zScore standardises meanHits against chance; score is pure prize
//     points — each prize hit earns its tier's weight on the fixed ladder
//     G7=1 … G1=13, nothing else moves it.
import { scoreLine } from "./toto.mjs";

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
    // Prize points — the score itself: each prize draw earns its tier's
    // weight on the fixed ladder G7=1, G6=2, G5=3, G4=4, G3=5, G2=8, G1=13
    // (owner-specified scoring system, 2026-11-12). The additional ball
    // never changes the tier: G2 weighs like G3, G6 like G7. Chance null =
    // Σ P(tier)·weight(tier) ≈ 2.11 per 100 draws.
    weightedPrizesPer100Draws:
        Math.round(
            (pExactly(6) * 13 +
                (pExactly(5) * 8) / 43 +
                (pExactly(5) * 42 * 5) / 43 +
                (pExactly(4) * 4) / 43 +
                (pExactly(4) * 42 * 3) / 43 +
                (pExactly(3) * 2) / 43 +
                (pExactly(3) * 42) / 43) *
                10000,
        ) / 100, // 2.11
    // Per-tier hit probabilities. The additional ball is uniform over the 43
    // unmatched numbers, so G2/G4/G6 (with additional) = P(k matches)/43 and
    // G3/G5/G7 = P(k matches)·42/43. Exact floats — no rounding.
    tierG1: pExactly(6),
    tierG2: (pExactly(5) * 1) / 43,
    tierG3: (pExactly(5) * 42) / 43,
    tierG4: (pExactly(4) * 1) / 43,
    tierG5: (pExactly(4) * 42) / 43,
    tierG6: (pExactly(3) * 1) / 43,
    tierG7: (pExactly(3) * 42) / 43,
    // Hit depth, reader's scale: a draw earns 2^(matched−2) points — 2-match
    // = 1, 3 = 2, 4 = 4, 5 = 8, 6 = 16 — so matching more numbers always
    // scores exponentially more than matching fewer. A lone 1-match is noise
    // and earns nothing. Chance null = Σ P(k)·2^(k−2) over the hypergeometric.
    depthPointsPer100Draws:
        Math.round(
            (pExactly(2) * 1 + pExactly(3) * 2 + pExactly(4) * 4 + pExactly(5) * 8 + pExactly(6) * 16) * 10000,
        ) / 100, // 17.17
};
/**
 * The tier→points ladder the league scores on (owner-specified, 2026-11-12):
 * G7=1, G6=2, G5=3, G4=4, G3=5, G2=8, G1=13. The score is Σ weights over
 * prize folds — nothing else moves it.
 */
export const TIER_WEIGHTS = { 1: 13, 2: 8, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1 };

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
 * attempt); it receives `(prior, target, prepareEnv)`, where `prepareEnv` is
 * caller-supplied fold-invariant context (the full sorted archive and the
 * era boundary — see league-build.mjs).
 *
 * `foldCache`/{get,set} lets the builder reuse a persisted (strategy, draw)
 * evaluation — pick, matched count, prize group and share — so reruns never
 * regenerate a fold whose history prefix is unchanged. `nextPickCache` does
 * the same for the current pick, whose validity the builder ties to the whole
 * archive.
 *
 * `onPick(drawNo, pick)` fires once per fold — for cached folds too — so the
 * builder can assemble cross-strategy views (the consensus vote) from the
 * picks without re-running any rule. `onCurrentPick(pick)` fires once with
 * the pick for the next draw.
 */
export function evaluateStrategy(
    spec,
    era,
    foldStart,
    foldEnd,
    expectedHits,
    { prepare, nextTarget, foldCache, nextPickCache, onPick, onCurrentPick, prepareEnv } = {},
) {
    const perFoldHits = [];
    let totalHits = 0;
    let twoPlusDraws = 0;
    let totalPrizes = 0;
    let weightedPrizes = 0;
    let depthPoints = 0;
    let bestGroup = null;
    const tierCounts = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0, g7: 0 };
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
            pick = generateLine(spec.id, spec.rule, prior, draw, prepare ? prepare(prior, draw, prepareEnv) : undefined);
            // Raw match count: every matched main number counts (chance 0.7347/draw).
            matched = draw.numbers.filter((n) => pick.includes(n)).length; // main numbers only
            group = scoreLine(pick, draw);
            foldCache?.set(draw.draw, { p: pick, m: matched, g: group });
        }
        onPick?.(draw.draw, pick);
        perFoldHits.push(matched);
        totalHits += matched;
        if (matched >= 2) twoPlusDraws += 1; // hit-rate metric: a lone 1-match is noise
        if (matched >= 2) depthPoints += 2 ** (matched - 2); // 1/2/4/8/16 for 2/3/4/5/6 matched
        if (group > 0) {
            totalPrizes += 1;
            // The score IS the weighted prize points: each prize fold earns
            // its tier's weight on the ladder G7=1, G6=2, G5=3, G4=4, G3=5,
            // G2=8, G1=13 (TIER_WEIGHTS). Prize money never enters the
            // league: a hit counts, whatever it paid.
            weightedPrizes += TIER_WEIGHTS[group];
            if (bestGroup === null || group < bestGroup) bestGroup = group;
            tierCounts[`g${group}`] += 1;
        }
    }
    const folds = foldEnd - foldStart;
    const meanHits = totalHits / folds;
    const sd = sampleSd(perFoldHits);
    // se of the mean over the actual fold count.
    const zScore = sd === 0 ? 0 : round2((meanHits - expectedHits) / (sd / Math.sqrt(folds)));
    const effPrizes = totalPrizes;
    const recent12 = perFoldHits.slice(-12).reduce((a, b) => a + b, 0);
    // The score is the weighted prize points alone — G7=1 … G1=13
    // (TIER_WEIGHTS). Nothing else moves it.
    const score = weightedPrizes;
    const currentPick =
        nextPickCache?.get() ??
        generateLine(spec.id, spec.rule, era, nextTarget, prepare ? prepare(era, nextTarget, prepareEnv) : undefined);
    nextPickCache?.set(currentPick);
    onCurrentPick?.(currentPick);
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
        depthPoints,
        bestGroup,
        tierCounts,
        twoPlusDraws,
        recent12,
        rank: 0, // assigned by the league-wide re-rank
        currentPick,
    };
}
