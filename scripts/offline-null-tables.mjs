// toto.sg — offline generator for the EXACT combinatorial null tables.
//
// Run via `make nulls` (or `node scripts/offline-null-tables.mjs`). The script
// enumerates the exact null distribution of every line-shape statistic and
// rewrites the generated block inside src/lib/insights-sequence-dynamics.ts.
//
// WHY OFFLINE
// ------------
// A uniform 6-subset of {1..49} is fixed by its five INTERNAL gaps plus a
// starting offset, and the offset only shifts the set — so |A+A|, the gap
// curvature and the cyclic spacing all depend on the internal gaps alone.
// Given internal gaps summing to S there are exactly (44 - S) valid offsets,
// so enumerating the C(48,5) gap compositions with weight (44 - S) yields
// the EXACT null over all C(49,6) = 13,983,816 lines.
//
//   C(49,6) = 13,983,816 subsets, but only C(48,5) = 1,712,304 gap shapes.
//
// The browser must not pay for that enumeration on every page load, so the
// tables are computed once here and embedded as constants. The generated
// block is marked with BEGIN/END sentinels — this script rewrites exactly
// that region and leaves the rest of the module untouched.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TARGET = fileURLToPath(new URL("../src/lib/insights-sequence-dynamics.ts", import.meta.url));

const POOL = 49;
const PICKS = 6;
const TOTAL_LINES = 13983816; // C(49, 6)

const BEGIN = "// --- BEGIN GENERATED NULL TABLES (scripts/offline-null-tables.mjs) ---";
const END = "// --- END GENERATED NULL TABLES ---";

/** |A + A| for a sorted 6-set: the number of distinct pairwise sums. */
const sumsetSize = (sorted) => {
    const seen = new Set();
    for (let i = 0; i < 6; i += 1) {
        for (let j = i; j < 6; j += 1) seen.add(sorted[i] + sorted[j]);
    }
    return seen.size;
};

/** The curvature regime of a net curvature kappa. */
const regimeOf = (kappa) => {
    if (kappa > 0.5) return "Convex Fan";
    if (kappa < -0.5) return "Concave Funnel";
    return "Balanced";
};

/** The number of sign flips in the second differences. */
const flipsOf = (second) => {
    let flips = 0;
    for (let i = 0; i < second.length - 1; i += 1) if (second[i] * second[i + 1] < 0) flips += 1;
    return flips;
};

/** The exact null tables. */
const computeTables = () => {
    const sumset = new Map();
    const regime = new Map();
    const flips = new Map();
    const maxGap = new Map();
    let weight = 0;

    const gaps = [0, 0, 0, 0, 0]; // the five internal gaps

    const recurse = (index, remaining, sum) => {
        if (index === 5) {
            const w = 44 - sum;
            if (w <= 0) return;
            weight += w;

            // Anchor at x1 = 1: the offset never changes these statistics.
            const sorted = [1];
            for (let i = 0; i < 5; i += 1) sorted.push(sorted[sorted.length - 1] + gaps[i] + 1);

            const size = sumsetSize(sorted);
            sumset.set(size, (sumset.get(size) ?? 0) + w);

            const deltas = gaps.map((g) => g + 1);
            const second = [];
            for (let i = 0; i < 4; i += 1) second.push(deltas[i + 1] - deltas[i]);
            const kappa = (deltas[4] - deltas[0]) / 4;

            const label = regimeOf(kappa);
            regime.set(label, (regime.get(label) ?? 0) + w);

            const flipCount = flipsOf(second);
            flips.set(flipCount, (flips.get(flipCount) ?? 0) + w);

            // The wrap gap of the cyclic Z_49 ring: 49 - x_(6) + x_(1) = 44 - sum.
            const wrap = 44 - sum;
            const largest = Math.max(...deltas, wrap);
            maxGap.set(largest, (maxGap.get(largest) ?? 0) + w);
            return;
        }
        for (let g = 0; g <= remaining; g += 1) {
            gaps[index] = g;
            recurse(index + 1, remaining - g, sum + g);
        }
    };

    // The seven gaps (before, five internal, after) sum to 49 - 6 = 43, so
    // the internal gaps may sum to at most 43 — with the two boundary gaps
    // then pinned to zero, which is the one offset for that shape.
    recurse(0, POOL - PICKS, 0);

    if (weight !== TOTAL_LINES) {
        throw new Error(`gap enumeration weight ${weight} != C(49,6) = ${TOTAL_LINES}`);
    }

    const series = (hist, lo, hi) => {
        const out = [];
        for (let k = lo; k <= hi; k += 1) out.push((hist.get(k) ?? 0) / TOTAL_LINES);
        return out;
    };

    return {
        sumset: series(sumset, 11, 21),
        regime: {
            "Convex Fan": (regime.get("Convex Fan") ?? 0) / TOTAL_LINES,
            Balanced: (regime.get("Balanced") ?? 0) / TOTAL_LINES,
            "Concave Funnel": (regime.get("Concave Funnel") ?? 0) / TOTAL_LINES,
        },
        flips: series(flips, 0, 3),
        maxGap: series(maxGap, 1, 44),
    };
};

/**
 * The exact nulls of the multiplicative panel.
 *
 * Coprimality is NOT translation-invariant, so the gap-composition trick
 * does not apply here — the null has to come from the full enumeration of
 * all C(49,6) lines. With a 49x49 coprime table the whole pass takes a
 * few seconds, which is exactly why it belongs offline.
 */
const computeMultiplicativeTables = () => {
    const coprime = new Uint8Array(POOL * POOL);
    for (let a = 1; a <= POOL; a += 1) {
        for (let b = 1; b <= POOL; b += 1) {
            let x = a;
            let y = b;
            while (y !== 0) {
                const t = y;
                y = x % y;
                x = t;
            }
            coprime[(a - 1) * POOL + (b - 1)] = x === 1 ? 1 : 0;
        }
    }

    const counts = new Array(16).fill(0);
    let spreadTotal = 0;
    let spreadSquareTotal = 0;
    let seen = 0;

    for (let a = 1; a <= 44; a += 1) {
        for (let b = a + 1; b <= 45; b += 1) {
            for (let c = b + 1; c <= 46; c += 1) {
                for (let d = c + 1; d <= 47; d += 1) {
                    for (let e = d + 1; e <= 48; e += 1) {
                        for (let f = e + 1; f <= 49; f += 1) {
                            const line = [a, b, c, d, e, f];
                            let pairs = 0;
                            for (let i = 0; i < 6; i += 1) {
                                for (let j = i + 1; j < 6; j += 1) {
                                    if (coprime[(line[i] - 1) * POOL + (line[j] - 1)] === 1) pairs += 1;
                                }
                            }
                            counts[pairs] += 1;

                            const arithmetic = (a + b + c + d + e + f) / 6;
                            const geometric = (a * b * c * d * e * f) ** (1 / 6);
                            const spread = arithmetic - geometric;
                            spreadTotal += spread;
                            spreadSquareTotal += spread * spread;
                            seen += 1;
                        }
                    }
                }
            }
        }
    }

    if (seen !== TOTAL_LINES) {
        throw new Error(`coprime enumeration saw ${seen} lines, expected ${TOTAL_LINES}`);
    }

    const mean = spreadTotal / seen;
    const variance = Math.max(0, spreadSquareTotal / seen - mean * mean);

    return {
        coprimeCounts: counts.map((count) => count / TOTAL_LINES),
        spreadMean: mean,
        spreadSd: Math.sqrt(variance),
    };
};

/** Format a number so the generated block stays byte-stable across runs. */
const format = (value, digits = 12) => {
    const text = value.toFixed(digits);
    return text.replace(/0+$/, "").replace(/\.$/, "");
};

const renderBlock = (tables, multiplicative) => {
    const sumset = tables.sumset.map((p) => format(p)).join(", ");
    const flips = tables.flips.map((p) => format(p)).join(", ");
    const maxGap = tables.maxGap.map((p) => format(p)).join(", ");
    const coprime = multiplicative.coprimeCounts.map((p) => format(p)).join(", ");
    const regime = tables.regime;

    return `${BEGIN}
/**
 * The exact distribution of |A+A| over every 6-subset of {1..49}.
 * Index 0 is |A+A| = 11 (an arithmetic progression), index 10 is 21 (a pure
 * Sidon B2 set). The shares sum to exactly 1.
 */
export const SIDON_SUMSET_NULL: readonly number[] = [${sumset}];

/** The exact share of each curvature regime over every 6-subset of {1..49}. */
export const CURVATURE_REGIME_NULL = {
    "Convex Fan": ${format(regime["Convex Fan"])},
    Balanced: ${format(regime.Balanced)},
    "Concave Funnel": ${format(regime["Concave Funnel"])},
} as const;

/** The exact share of each zigzag sign-flip count over every 6-subset of {1..49}. */
export const ZIGZAG_FLIP_NULL: readonly number[] = [${flips}];

/** The exact distribution of the largest cyclic Z_49 gap over every 6-subset. */
export const TORUS_MAX_GAP_NULL: readonly number[] = [${maxGap}];

/**
 * The exact distribution of the coprime-pair count over every 6-subset of
 * {1..49}. Index 0 is a line with no coprime pair, index 15 is a line whose
 * six balls are pairwise coprime.
 */
export const COPRIME_COUNT_NULL: readonly number[] = [${coprime}];

/** The exact mean of the AM-GM spread A - G over every 6-subset of {1..49}. */
export const AMGM_SPREAD_MEAN = ${format(multiplicative.spreadMean)};

/** The exact standard deviation of the AM-GM spread over every 6-subset. */
export const AMGM_SPREAD_SD = ${format(multiplicative.spreadSd)};
${END}`;
};

const main = () => {
    const started = Date.now();
    const tables = computeTables();
    const multiplicative = computeMultiplicativeTables();

    const source = readFileSync(TARGET, "utf8");
    const beginIndex = source.indexOf(BEGIN);
    const endIndex = source.indexOf(END);
    if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
        throw new Error(`could not find the generated block markers in ${TARGET}`);
    }

    const next = source.slice(0, beginIndex) + renderBlock(tables, multiplicative) + source.slice(endIndex + END.length);
    writeFileSync(TARGET, next, "utf8");

    const sum = (values) => values.reduce((acc, value) => acc + value, 0);
    console.log(
        `null tables regenerated in ${Date.now() - started} ms — ` +
            `sumset Σ=${format(sum(tables.sumset), 9)} ` +
            `regime Σ=${format(sum(Object.values(tables.regime)), 9)} ` +
            `flips Σ=${format(sum(tables.flips), 9)} ` +
            `maxGap Σ=${format(sum(tables.maxGap), 9)} ` +
            `coprime Σ=${format(sum(multiplicative.coprimeCounts), 9)} ` +
            `spread ${format(multiplicative.spreadMean, 6)} ± ${format(multiplicative.spreadSd, 6)}`,
    );
};

main();
