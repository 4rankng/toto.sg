// toto.sg — numeric self-check for the deep sequence analytics.
//
// Run via `make verify:nulls` (or `npm run verify:nulls`). It re-derives the
// nulls the two new Insights galleries rest on, straight from the archive,
// and fails loudly when one of them drifts.
//
// The checks that matter:
//   * the order-statistic Mahalanobis distance must average 6.0 over the
//     archive — that is the chi-square(6) null. A factor-of-two error in the
//     covariance constant halves this number, so it is the guard against
//     that class of bug.
//   * the chi-square tail must agree with published quantiles.
//   * the exact null tables must still sum to 1.
//   * every line's additive sumset must stay inside [11, 21].
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    CURVATURE_REGIME_NULL,
    ORDER_STAT_COVARIANCE,
    ORDER_STAT_MEAN,
    SIDON_SUMSET_NULL,
    TORUS_MAX_GAP_NULL,
    ZIGZAG_FLIP_NULL,
    chiSquareQuantile,
    chiSquareUpperTail,
    computeMahalanobisOrderStats,
    computeUnionDepletionCurveStats,
    expectedWasserstein1,
    evaluateCandidateSequenceDeepScan,
    mahalanobisD2,
    sidonSumsetOf,
    sortedUniqueLine,
} from "../src/lib/insights-sequence-dynamics";
import type { Draw } from "../src/lib/data";

const root = process.cwd();
const dataDir = resolve(root, "public/data");

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
    if (!condition) failures.push(message);
};

const draws: Draw[] = JSON.parse(readFileSync(resolve(dataDir, "draws.json"), "utf8"));
const era = draws.filter((draw) => draw.date >= "2014-10-09");

/* --- 1. The Mahalanobis null: E[D^2] must be 6.0 ---------------------- */

const mahalanobis = computeMahalanobisOrderStats(era);
check(
    Math.abs(mahalanobis.meanD2 - 6) < 0.05,
    `mean Mahalanobis D^2 is ${mahalanobis.meanD2.toFixed(4)}, expected 6.0 +/- 0.05`,
);

// The covariance constant itself: (N+1)(N-n) / ((n+1)^2 (n+2)) = 2150/392.
// The diagonal entry Cov(X_(1), X_(1)) is the coefficient times 1 * (7-1).
const expectedCoefficient = (50 * 43) / (49 * 8);
const actualCoefficient = ORDER_STAT_COVARIANCE[0][0] / 6;
check(
    Math.abs(actualCoefficient - expectedCoefficient) < 1e-12,
    `covariance coefficient is ${actualCoefficient}, expected ${expectedCoefficient}`,
);

// A line at the exact order-statistic mean must sit at D^2 = 0.
check(
    Math.abs(mahalanobisD2(ORDER_STAT_MEAN)) < 1e-6,
    `D^2 at the order-statistic mean is ${mahalanobisD2(ORDER_STAT_MEAN)}, expected 0`,
);

/* --- 2. The chi-square tail must match published quantiles ------------- */

const chiSq6At5 = chiSquareQuantile(0.05, 6);
check(
    Math.abs(chiSq6At5 - 12.5916) < 0.01,
    `chi-square(6) 95th percentile is ${chiSq6At5.toFixed(4)}, expected 12.5916`,
);
check(Math.abs(chiSquareUpperTail(12.5916, 6) - 0.05) < 1e-6, "chi-square(6) upper tail drifted at 12.5916");
// P(X^2_6 >= 6) = Q(3, 3) = e^-3 * (1 + 3 + 9/2) = 0.42319.
check(Math.abs(chiSquareUpperTail(6, 6) - 0.42319) < 1e-4, `P(X^2_6 >= 6) is ${chiSquareUpperTail(6, 6).toFixed(5)}, expected 0.42319`);

/* --- 3. The exact null tables must still sum to 1 ---------------------- */

const sum = (values: readonly number[]) => values.reduce((acc, value) => acc + value, 0);
check(Math.abs(sum(SIDON_SUMSET_NULL) - 1) < 1e-9, "the Sidon sumset null does not sum to 1");
check(Math.abs(sum(ZIGZAG_FLIP_NULL) - 1) < 1e-9, "the zigzag flip null does not sum to 1");
check(Math.abs(sum(TORUS_MAX_GAP_NULL) - 1) < 1e-9, "the torus max-gap null does not sum to 1");
check(
    Math.abs(sum(Object.values(CURVATURE_REGIME_NULL)) - 1) < 1e-9,
    "the curvature regime null does not sum to 1",
);

/* --- 4. Every line's additive sumset stays inside [11, 21] -------------- */

let sumsetLow = Number.POSITIVE_INFINITY;
let sumsetHigh = Number.NEGATIVE_INFINITY;
for (const draw of era) {
    const size = sidonSumsetOf(sortedUniqueLine(draw.numbers)).distinctSums;
    sumsetLow = Math.min(sumsetLow, size);
    sumsetHigh = Math.max(sumsetHigh, size);
}
check(sumsetLow >= 11 && sumsetHigh <= 21, `the archive sumset range is ${sumsetLow}-${sumsetHigh}, expected 11-21`);

/* --- 5. The union-depletion crossover and the deep-scan invariants ----- */

const union = computeUnionDepletionCurveStats(era);
check(
    union.crossoverHorizon >= 1 && union.crossoverHorizon <= 15,
    `the union crossover horizon is ${union.crossoverHorizon}, expected 1-15`,
);
check(
    Math.abs(union.crossoverAnalytic - 5.3066) < 0.01,
    `the analytic union crossover is ${union.crossoverAnalytic.toFixed(4)}, expected 5.3066`,
);
check(
    union.liveColdPool.length + union.liveUnion.length === 49,
    "the live union and its cold pool must partition the 49 balls",
);

const deepScan = evaluateCandidateSequenceDeepScan([3, 9, 17, 24, 33, 41], era);
check(deepScan.isReady, "the deep scan did not report a ready line");
check(deepScan.union5Carry + deepScan.union5Fresh === 6, "the union carry and fresh counts must add up to 6");
check(deepScan.sidonSumset >= 11 && deepScan.sidonSumset <= 21, "the deep-scan sumset left the [11, 21] band");
check(deepScan.torusMaxGap >= 1 && deepScan.torusMaxGap <= 44, "the deep-scan torus gap left the [1, 44] band");

const notReady = evaluateCandidateSequenceDeepScan([3, 9, 17], era);
check(!notReady.isReady, "a three-ball line must not report ready");
check(notReady.mahalanobisD2 === 0, "an incomplete line must not report a Mahalanobis distance");

/* --- 6. The Wasserstein null ------------------------------------------- */

const expectedW1 = expectedWasserstein1();
// Cross-checked against a 200k-sample Monte Carlo over independent uniform
// 6-subsets, which lands at 7.906.
check(
    Math.abs(expectedW1 - 7.8969) < 0.02,
    `the analytical E[W1] is ${expectedW1.toFixed(4)}, expected 7.8969 +/- 0.02`,
);

/* --- Report ------------------------------------------------------------- */

if (failures.length > 0) {
    console.error(`✗ ${failures.length} sequence-null failure(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}

console.log(`✓ Mahalanobis null   mean D^2 = ${mahalanobis.meanD2.toFixed(4)} (chi-square(6) target 6.0)`);
console.log(`✓ Chi-square tail    P(X^2_6 >= 6) = ${chiSquareUpperTail(6, 6).toFixed(4)}, 95th pct = ${chiSq6At5.toFixed(4)}`);
console.log(`✓ Null tables        sumset / regime / flips / max-gap all sum to 1`);
console.log(`✓ Additive sumsets   archive range ${sumsetLow}-${sumsetHigh} (theory 11-21)`);
console.log(`✓ Union depletion    crossover horizon L* = ${union.crossoverHorizon}, cold pool ${union.liveColdPool.length} balls`);
console.log(`✓ Wasserstein null   E[W1] = ${expectedW1.toFixed(4)} for two independent draws`);
