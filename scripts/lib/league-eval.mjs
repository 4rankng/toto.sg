// toto.sg — shared walk-forward evaluation for league rows.
//
// One implementation of "how a strategy is scored", used by every script that
// writes rows into public/data/strategies.json:
//   - scripts/strategies-custom.mjs  (the curated lines + generator rules)
//   - scripts/strategies-gambler.mjs (the 10 cross-panel gambler strategies)
//
// Semantics (unchanged from the original research pipeline):
//   * FOLDS = 100 walk-forward folds over the 6/49 era, oldest first.
//   * A rule-based strategy regenerates its line for every fold using only
//     draws that precede that fold; a fixed strategy reuses its curated line.
//   * meanHits is compared with the chance expectation; zScore is the
//     standardised difference of the per-fold hit counts; score is the
//     least-squares fit used across the league (baseline 45 = random picking).
//   * The current pick is the line the strategy would play for the next draw.
//
// Determinism: every rule draws randomness ONLY from
// rngFor(id, drawNo) = mulberry32(fnv1a(`${id}:${drawNo}`)), so reruns are
// byte-identical apart from meta.generatedAt.
import { scoreLine } from "./toto.mjs";

export const FOLDS = 100; // matches meta.folds
export const STAKE_PER_DRAW = 1; // S$1 Ordinary
export const REJECT_CAP = 10000; // per draw; a cap hit means a bug in the rule encoding

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
 * Score one strategy over the last FOLDS draws of the era.
 *
 * `spec` is {id, name, family, description, pick?} for a fixed strategy or
 * {id, name, family, description, rule} for a generator rule. `prepare`
 * optionally returns the fourth argument handed to the rule (computed once
 * per fold, never per attempt).
 */
export function evaluateStrategy(spec, era, foldStart, expectedHits, { prepare, nextTarget } = {}) {
    const rule = spec.rule ?? null;
    const perFoldHits = [];
    let totalHits = 0;
    let totalPrizes = 0;
    let totalWinnings = 0;
    for (let j = 0; j < FOLDS; j++) {
        const i = foldStart + j;
        const draw = era[i];
        const prior = era.slice(0, i);
        const pick = rule ? generateLine(spec.id, rule, prior, draw, prepare ? prepare(prior, draw) : undefined) : spec.pick;
        // Match metric: numbers matched count only in draws where the line
        // matched at least two — a lone 1-number match is chance noise
        // (P(exactly 1) ≈ 0.413) and scores zero. Prize groups are computed
        // separately from the real winning rules and are unaffected.
        const matched = draw.numbers.filter((n) => pick.includes(n)).length; // main numbers only
        const hits = matched >= 2 ? matched : 0;
        perFoldHits.push(hits);
        totalHits += hits;
        const group = scoreLine(pick, draw);
        if (group > 0) {
            totalPrizes += 1;
            const share = draw.prizes?.[`g${group}`]?.share;
            if (share != null) totalWinnings += share;
        }
    }
    const meanHits = totalHits / FOLDS;
    const sd = sampleSd(perFoldHits);
    // se of the mean over 100 folds; the exact pipeline se is unrecoverable but
    // per-strategy sample sd reproduces the z magnitudes of the pipeline rows.
    const zScore = sd === 0 ? 0 : round2((meanHits - expectedHits) / (sd / 10));
    const effPrizes = totalPrizes;
    const pnlPerDraw = round2((totalWinnings - FOLDS * STAKE_PER_DRAW) / FOLDS);
    const recent12 = perFoldHits.slice(-12).reduce((a, b) => a + b, 0);
    const score = round1(Math.min(100, Math.max(0, 20.4 + 7.8 * zScore + 5.5 * effPrizes + 0.6 * recent12)));
    const currentPick = rule
        ? generateLine(spec.id, rule, era, nextTarget, prepare ? prepare(era, nextTarget) : undefined)
        : spec.pick;
    return {
        id: spec.id,
        name: spec.name,
        family: spec.family,
        description: spec.description,
        evaluatedDraws: FOLDS,
        totalHits,
        meanHits: round2(meanHits),
        expectedHits,
        zScore,
        score,
        totalPrizes,
        effPrizes,
        pnlPerDraw,
        recent12,
        rank: 0, // assigned by the league-wide re-rank
        currentPick,
    };
}
