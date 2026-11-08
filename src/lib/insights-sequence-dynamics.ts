// toto.sg — deep sequence analytics for the two new Insights galleries.
//
// Two structural dimensions of the Singapore Pools 6/49 draw archive:
//
//   ORDER GEOMETRY (gallery 10) — one 6-ball line read as an ordered
//   sequence: multivariate order-statistic typicality, gap curvature and
//   zigzag sign-flips, additive Sidon B2 sumsets, 2D playslip lattice
//   geometry, induced sub-graph cohesion, multiplicative coprimality,
//   cyclic Z_49 ring spacing, and recursive integer resonance.
//
//   STREAM DYNAMICS (gallery 11) — the archive read as a time series:
//   optimal transport between consecutive draws, algorithmic complexity,
//   spectral harmonics with Fisher's exact test, self-exciting point
//   processes, state-space recurrence, multi-draw union depletion, ordinal
//   permutation motifs, and distributional turnover.
//
// Every empirical statistic is paired with an exact analytical or
// combinatorial null. Nothing here is a payout, jackpot, prize-sharing or
// expected-value claim, and nothing here claims the next draw is
// predictable.
//
// This module is compiled into BOTH the browser bundle and the Vite SSR
// bundle behind scripts/export-graph.ts, so it stays runtime-neutral:
// typed arrays and Math only — no fs, no window, no fetch, and no
// Math.random() inside any calculator.
import type { Draw } from "@/lib/data";
import { PICKS, POOL, binomial, percentile } from "@/lib/insights-stats";

/* ================================================================== *
 * PART 0 — Shared constants and deterministic helpers
 * ================================================================== */

/** Chance that one ball appears in one draw. */
const NULL_PROB = PICKS / POOL; // 6 / 49

/** Every valid line has six balls from 1..49. */
const LINE_SIZE = 6;

/** Distinct unordered pairs inside one line. */
const PAIR_COUNT = 15; // C(6, 2)

/** Distinct unordered pairs inside the pool. */
const POOL_PAIR_COUNT = 1176; // C(49, 2)

/* ------------------------------------------------------------------ *
 * Line helpers
 * ------------------------------------------------------------------ */

/** Sorted, de-duplicated, in-pool line. */
export function sortedUniqueLine(line: readonly number[]): number[] {
    return [...new Set(line.filter((n) => Number.isInteger(n) && n >= 1 && n <= POOL))].sort((a, b) => a - b);
}

/** The playslip cell of a ball on the 7x7 grid: row-major, 1-based. */
export const playslipCellOf = (n: number): { row: number; col: number } => ({
    row: Math.floor((n - 1) / 7) + 1,
    col: ((n - 1) % 7) + 1,
});

/* ------------------------------------------------------------------ *
 * Linear algebra — exact 6x6 Gauss-Jordan with partial pivoting
 * ------------------------------------------------------------------ */

/** Invert a 6x6 matrix; null when it is singular. */
export function invert6x6(matrix: readonly (readonly number[])[]): number[][] | null {
    const n = 6;
    const a: number[][] = matrix.map((row) => [...row]);
    const inv: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );

    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
        }
        if (Math.abs(a[pivot][col]) < 1e-12) return null;
        if (pivot !== col) {
            [a[col], a[pivot]] = [a[pivot], a[col]];
            [inv[col], inv[pivot]] = [inv[pivot], inv[col]];
        }

        const scale = a[col][col];
        for (let j = 0; j < n; j += 1) {
            a[col][j] /= scale;
            inv[col][j] /= scale;
        }

        for (let row = 0; row < n; row += 1) {
            if (row === col) continue;
            const factor = a[row][col];
            if (factor === 0) continue;
            for (let j = 0; j < n; j += 1) {
                a[row][j] -= factor * a[col][j];
                inv[row][j] -= factor * inv[col][j];
            }
        }
    }

    return inv;
}

/* ------------------------------------------------------------------ *
 * Special functions — lnGamma, incomplete gamma, chi-square tail
 * ------------------------------------------------------------------ */

/** Lanczos approximation of ln Gamma(z). */
function lnGamma(z: number): number {
    const coefficients = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
        12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);

    let x = coefficients[0];
    const shifted = z - 1;
    const t = shifted + 7.5;
    for (let i = 1; i < 9; i += 1) x += coefficients[i] / (shifted + i);
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized lower incomplete gamma P(a, x) by series. */
function gammaLowerSeries(a: number, x: number): number {
    const gln = lnGamma(a);
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 2000; n += 1) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
}

/** Regularized upper incomplete gamma Q(a, x) by continued fraction. */
function gammaUpperContinuedFraction(a: number, x: number): number {
    const gln = lnGamma(a);
    const floor = 1e-300;
    let b = x + 1 - a;
    let c = 1 / floor;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 2000; i += 1) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < floor) d = floor;
        c = b + an / c;
        if (Math.abs(c) < floor) c = floor;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Regularized upper incomplete gamma Q(a, x) = P(Gamma(a) > x). */
export function gammaUpperRegularized(a: number, x: number): number {
    if (!(a > 0) || x < 0) return Number.NaN;
    if (x === 0) return 1;
    if (x < a + 1) return 1 - gammaLowerSeries(a, x);
    return gammaUpperContinuedFraction(a, x);
}

/** Upper tail of the chi-square distribution: P(X > x) with `df` degrees of freedom. */
export function chiSquareUpperTail(x: number, df: number): number {
    if (!(df > 0)) return Number.NaN;
    if (x <= 0) return 1;
    return gammaUpperRegularized(df / 2, x / 2);
}

/** The chi-square quantile at an upper-tail probability (bisection on the tail). */
export function chiSquareQuantile(p: number, df: number): number {
    if (!(p > 0 && p < 1)) return Number.NaN;
    let lo = 0;
    let hi = Math.max(1, df * 4);
    while (chiSquareUpperTail(hi, df) > p) hi *= 2;
    for (let i = 0; i < 200; i += 1) {
        const mid = (lo + hi) / 2;
        if (chiSquareUpperTail(mid, df) > p) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** The binary entropy H2(p), in bits. */
export const binaryEntropy = (p: number): number => {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
};

/** The inverse binary entropy H2^-1(h) in [0, 0.5], by bisection. */
export function inverseBinaryEntropy(h: number): number {
    if (h <= 0) return 0;
    if (h >= 1) return 0.5;
    let lo = 0;
    let hi = 0.5;
    for (let i = 0; i < 200; i += 1) {
        const mid = (lo + hi) / 2;
        if (binaryEntropy(mid) < h) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/* ------------------------------------------------------------------ *
 * Order-statistic geometry (gallery 10, panel 113)
 * ------------------------------------------------------------------ */

/**
 * The exact mean of the k-th order statistic of a uniform 6-subset of
 * {1..49}: mu_k = k(N+1)/(n+1) = 50k/7.
 */
export const ORDER_STAT_MEAN: readonly number[] = Array.from({ length: LINE_SIZE }, (_, i) => (50 * (i + 1)) / 7);

/**
 * The exact covariance of the order statistics, Cov(X_(j), X_(k)) =
 * (2150/392) * j(7-k) for j <= k.
 *
 * The coefficient is (N+1)(N-n) / ((n+1)^2(n+2)) = 50*43 / (49*8) = 2150/392.
 * It was verified by exact combinatorial enumeration against every 6-subset
 * of {1..49}: with this value the Mahalanobis distance has E[D^2] = 6.0,
 * which is exactly the chi-square(6) null. (A factor-of-two error here
 * silently halves every D^2 and breaks the null, so the constant is
 * asserted below.)
 */
const ORDER_STAT_COV_COEFFICIENT = 2150 / 392;

export const ORDER_STAT_COVARIANCE: readonly (readonly number[])[] = Array.from({ length: LINE_SIZE }, (_, j) =>
    Array.from({ length: LINE_SIZE }, (_, k) => {
        const [lo, hi] = j <= k ? [j + 1, k + 1] : [k + 1, j + 1];
        return ORDER_STAT_COV_COEFFICIENT * lo * (7 - hi);
    }),
);

const ORDER_STAT_PRECISION = invert6x6(ORDER_STAT_COVARIANCE);

/**
 * The joint Mahalanobis distance of one sorted line against the order-stat
 * mean vector: D^2 = (x - mu)^T Sigma^-1 (x - mu).
 */
export function mahalanobisD2(sortedLine: readonly number[]): number {
    if (sortedLine.length !== LINE_SIZE || !ORDER_STAT_PRECISION) return 0;
    const delta = sortedLine.map((value, i) => value - ORDER_STAT_MEAN[i]);
    let total = 0;
    for (let i = 0; i < LINE_SIZE; i += 1) {
        let inner = 0;
        for (let j = 0; j < LINE_SIZE; j += 1) inner += ORDER_STAT_PRECISION[i][j] * delta[j];
        total += delta[i] * inner;
    }
    return total;
}

/** The percentile of a D^2 inside the chi-square(6) null: 100 * P(X^2_6 >= d2). */
export const mahalanobisTypicalPct = (d2: number): number => 100 * chiSquareUpperTail(d2, LINE_SIZE);

/* ------------------------------------------------------------------ *
 * Exact combinatorial null tables
 *
 * A uniform 6-subset of {1..49} is fixed by its five INTERNAL gaps plus a
 * starting offset, and the offset only shifts the set — so |A+A|, the gap
 * curvature and the cyclic spacing all depend on the internal gaps alone.
 * Given internal gaps summing to S there are (44 - S) valid offsets, so
 * enumerating the C(48,5) gap compositions with weight (44 - S) yields the
 * EXACT null over all C(49,6) = 13,983,816 lines. The tables below were
 * produced once by that enumeration and are embedded so the browser never
 * pays for it.
 * ------------------------------------------------------------------ */

// --- BEGIN GENERATED NULL TABLES (scripts/offline-null-tables.mjs) ---
/**
 * The exact distribution of |A+A| over every 6-subset of {1..49}.
 * Index 0 is |A+A| = 11 (an arithmetic progression), index 10 is 21 (a pure
 * Sidon B2 set). The shares sum to exactly 1.
 */
export const SIDON_SUMSET_NULL: readonly number[] = [0.000015446427, 0.000025171956, 0.000090318694, 0.000171197905, 0.002733088021, 0.004703008106, 0.017500873867, 0.08868308908, 0.19578368308, 0.47014119751, 0.220152925353];

/** The exact share of each curvature regime over every 6-subset of {1..49}. */
export const CURVATURE_REGIME_NULL = {
    "Convex Fan": 0.358029381966,
    Balanced: 0.283941236069,
    "Concave Funnel": 0.358029381966,
} as const;

/** The exact share of each zigzag sign-flip count over every 6-subset of {1..49}. */
export const ZIGZAG_FLIP_NULL: readonly number[] = [0.06246392258, 0.290435886742, 0.4207672641, 0.226332926577];

/** The exact distribution of the largest cyclic Z_49 gap over every 6-subset. */
export const TORUS_MAX_GAP_NULL: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0.000147170129, 0.002382754464, 0.011230482438, 0.028330249769, 0.049599837412, 0.069033302498, 0.082695596109, 0.089213130379, 0.08952849494, 0.085428755642, 0.078494239341, 0.070028452892, 0.061058083144, 0.052332996944, 0.044326241135, 0.037234042553, 0.031028368794, 0.025632130743, 0.020971743335, 0.016977125557, 0.013581700446, 0.010722395089, 0.008339640625, 0.006377372242, 0.004783029182, 0.003507554733, 0.002505396238, 0.001734505088, 0.001156336725, 0.000735850643, 0.000441510386, 0.000245283548, 0.000122641774, 0.00005256076, 0.000017520253, 0.000003504051];

/**
 * The exact distribution of the coprime-pair count over every 6-subset of
 * {1..49}. Index 0 is a line with no coprime pair, index 15 is a line whose
 * six balls are pairwise coprime.
 */
export const COPRIME_COUNT_NULL: readonly number[] = [0.010314566496, 0.001818387771, 0.0084381116, 0.016327231422, 0.026529954342, 0.056545938534, 0.038291193191, 0.068491461844, 0.097714529425, 0.133255400386, 0.09347698797, 0.142283265169, 0.131013594572, 0.087638881976, 0.07139803613, 0.016462459174];

/** The exact mean of the AM-GM spread A - G over every 6-subset of {1..49}. */
export const AMGM_SPREAD_MEAN = 4.81484456974;

/** The exact standard deviation of the AM-GM spread over every 6-subset. */
export const AMGM_SPREAD_SD = 2.60418401722;
// --- END GENERATED NULL TABLES ---

/* ------------------------------------------------------------------ *
 * Geometry helpers shared by several panels
 * ------------------------------------------------------------------ */

/** The five internal gaps of a sorted line: x_(i+1) - x_(i) - 1. */
export const internalGaps = (sorted: readonly number[]): number[] => {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1] - 1);
    return gaps;
};

/** Curvature regime of a net curvature kappa. */
export type CurvatureRegime = "Convex Fan" | "Balanced" | "Concave Funnel";

export const curvatureRegimeOf = (kappa: number): CurvatureRegime => {
    if (kappa > 0.5) return "Convex Fan";
    if (kappa < -0.5) return "Concave Funnel";
    return "Balanced";
};

/** The full gap profile of one sorted line. */
export interface GapProfile {
    /** The five slot deltas, Delta_1..Delta_5. */
    deltas: number[];
    /** The four second differences, Delta^2_1..Delta^2_4. */
    secondDiffs: number[];
    /** The net curvature kappa = (Delta_5 - Delta_1) / 4. */
    kappa: number;
    /** Convex Fan / Balanced / Concave Funnel. */
    regime: CurvatureRegime;
    /** The zigzag sign-flip count, 0..3. */
    zigzagFlips: number;
}

export function gapProfileOf(sorted: readonly number[]): GapProfile {
    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) deltas.push(sorted[i] - sorted[i - 1]);
    const secondDiffs: number[] = [];
    for (let i = 0; i < deltas.length - 1; i += 1) secondDiffs.push(deltas[i + 1] - deltas[i]);

    let zigzagFlips = 0;
    for (let i = 0; i < secondDiffs.length - 1; i += 1) {
        if (secondDiffs[i] * secondDiffs[i + 1] < 0) zigzagFlips += 1;
    }

    const kappa = (deltas[deltas.length - 1] - deltas[0]) / 4;
    return { deltas, secondDiffs, kappa, regime: curvatureRegimeOf(kappa), zigzagFlips };
}

/** The six cyclic gaps of a line on the Z_49 ring, including the wrap gap. */
export function cyclicGaps49(sorted: readonly number[]): number[] {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i] - sorted[i - 1]);
    gaps.push(POOL - sorted[sorted.length - 1] + sorted[0]);
    return gaps;
}

/** The additive sumsets of one sorted line. */
export interface SidonSumsetStats {
    /** |A + A| — the number of distinct pairwise sums, 11..21. */
    distinctSums: number;
    /** Excess pair representations: 21 - |A+A|. Zero for a pure Sidon set. */
    collisions: number;
    /** Four-term relations x_a + x_b = x_c + x_d (distinct unordered pairs). */
    fourTermRelations: number;
    /** Symmetric outer-inner relations: an outer pair summing to the inner pair. */
    outerInnerCollisions: number;
    /** True when |A+A| = 21 — a pure Sidon B2 sequence. */
    isPureSidon: boolean;
}

export function sidonSumsetOf(sorted: readonly number[]): SidonSumsetStats {
    const pairs: { sum: number; i: number; j: number }[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i; j < sorted.length; j += 1) pairs.push({ sum: sorted[i] + sorted[j], i, j });
    }

    const distinct = new Set(pairs.map((p) => p.sum)).size;
    let fourTermRelations = 0;
    let outerInnerCollisions = 0;
    for (let a = 0; a < pairs.length; a += 1) {
        for (let b = a + 1; b < pairs.length; b += 1) {
            if (pairs[a].sum !== pairs[b].sum) continue;
            fourTermRelations += 1;
            // "Outer" = the four extreme slots; "inner" = the middle pair.
            const isOuter = (p: { i: number; j: number }) => p.i <= 1 || p.i >= sorted.length - 2;
            const isInner = (p: { i: number; j: number }) => p.i === 2 && p.j === 3;
            if ((isOuter(pairs[a]) && isInner(pairs[b])) || (isOuter(pairs[b]) && isInner(pairs[a]))) {
                outerInnerCollisions += 1;
            }
        }
    }

    const collisions = pairs.length - distinct;
    return {
        distinctSums: distinct,
        collisions,
        fourTermRelations,
        outerInnerCollisions,
        isPureSidon: distinct === pairs.length && fourTermRelations === 0,
    };
}

/** The exact Euclidean minimum spanning tree length of up to six points (Prim). */
export function minimumSpanningTree(points: readonly (readonly [number, number])[]): number {
    return minimumSpanningTreeEdges(points).length;
}

/**
 * The exact Euclidean minimum spanning tree of up to six points: the total
 * edge length plus the edges themselves, as pairs of point indices.
 */
export function minimumSpanningTreeEdges(points: readonly (readonly [number, number])[]): {
    length: number;
    edges: [number, number][];
} {
    const n = points.length;
    if (n < 2) return { length: 0, edges: [] };

    const used = new Uint8Array(n);
    const distance = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(n).fill(-1);
    distance[0] = 0;

    const edges: [number, number][] = [];
    let total = 0;
    for (let step = 0; step < n; step += 1) {
        let current = -1;
        for (let i = 0; i < n; i += 1) {
            if (used[i] === 1) continue;
            if (current === -1 || distance[i] < distance[current]) current = i;
        }
        used[current] = 1;
        total += distance[current];
        if (parent[current] >= 0) edges.push([parent[current], current]);

        const [r1, c1] = points[current];
        for (let j = 0; j < n; j += 1) {
            if (used[j] === 1) continue;
            const [r2, c2] = points[j];
            const span = Math.hypot(r1 - r2, c1 - c2);
            if (span < distance[j]) {
                distance[j] = span;
                parent[j] = current;
            }
        }
    }
    return { length: total, edges };
}

/** The lattice constellation of one sorted line: barycentre, gyration, MST. */
export interface ConstellationStats {
    /** The playslip cells, row-major. */
    cells: { row: number; col: number; ball: number }[];
    /** The 2D barycentre of the six cells. */
    baryRow: number;
    baryCol: number;
    /** The radius of gyration about the barycentre. */
    gyrationRadius: number;
    /** The exact 6-node Euclidean MST length. */
    mstLength: number;
    /** The MST edges, as pairs of cell indices. */
    mstEdges: [number, number][];
}

export function constellationOf(sorted: readonly number[]): ConstellationStats {
    const cells = sorted.map((ball) => ({ ...playslipCellOf(ball), ball }));
    const baryRow = cells.reduce((acc, cell) => acc + cell.row, 0) / cells.length;
    const baryCol = cells.reduce((acc, cell) => acc + cell.col, 0) / cells.length;
    const gyrationRadius = Math.sqrt(
        cells.reduce((acc, cell) => acc + (cell.row - baryRow) ** 2 + (cell.col - baryCol) ** 2, 0) / cells.length,
    );
    const tree = minimumSpanningTreeEdges(cells.map((cell) => [cell.row, cell.col] as const));
    return {
        cells,
        baryRow,
        baryCol,
        gyrationRadius,
        mstLength: tree.length,
        mstEdges: tree.edges,
    };
}

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random source (never Math.random)
 * ------------------------------------------------------------------ */

/** A small deterministic LCG — used only for fixed lattice baselines. */
const seededRandom = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

/**
 * The expected MST length of a uniform 6-point sample on the 7x7 playslip
 * lattice. Because the playslip cell of a ball is a bijection with the 49
 * lattice cells, a uniform 6-subset of balls IS a uniform 6-point lattice
 * sample — so this is the exact null the archive is drawn against,
 * estimated by a fixed-seed sampler so the number never moves.
 */
let latticeBaselineCache: number | null = null;
export const latticeMstBaseline = (): number => {
    if (latticeBaselineCache !== null) return latticeBaselineCache;

    const rng = seededRandom(0x7a11);
    let total = 0;
    const samples = 20000;
    for (let s = 0; s < samples; s += 1) {
        const picked = new Set<number>();
        while (picked.size < LINE_SIZE) picked.add(Math.floor(rng() * POOL));
        const points = [...picked].map((ball) => {
            const cell = playslipCellOf(ball);
            return [cell.row, cell.col] as const;
        });
        total += minimumSpanningTree(points);
    }
    latticeBaselineCache = total / samples;
    return latticeBaselineCache;
};

/* ================================================================== *
 * PART 1 — Order geometry (gallery 10)
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * 1. Multivariate order-statistic Mahalanobis typicality
 * ------------------------------------------------------------------ */

export type MahalanobisRegime = "Typical" | "Elevated" | "Extreme";

export interface MahalanobisOrderRow {
    draw: number;
    date: string;
    /** The draw's sorted line. */
    line: number[];
    /** The joint Mahalanobis distance of the sorted line. */
    d2: number;
    /** 100 * P(chi-square(6) >= d2) — the typicality percentile. */
    typicalPct: number;
    regime: MahalanobisRegime;
}

export interface MahalanobisOrderStats {
    rows: MahalanobisOrderRow[];
    meanD2: number;
    medianD2: number;
    p95D2: number;
    maxD2: number;
    /** The chi-square(6) null mean. */
    expectedD2: number;
    typicalCount: number;
    elevatedCount: number;
    extremeCount: number;
    latest: MahalanobisOrderRow | null;
    mostTypical: MahalanobisOrderRow[];
    leastTypical: MahalanobisOrderRow[];
}

export function computeMahalanobisOrderStats(draws: readonly Draw[]): MahalanobisOrderStats {
    const rows: MahalanobisOrderRow[] = draws.map((draw) => {
        const line = sortedUniqueLine(draw.numbers);
        const d2 = mahalanobisD2(line);
        return {
            draw: draw.draw,
            date: draw.date,
            line,
            d2,
            typicalPct: mahalanobisTypicalPct(d2),
            regime: "Typical" as MahalanobisRegime,
        };
    });

    const values = rows.map((row) => row.d2);
    const median = values.length > 0 ? percentile(values, 0.5) : 0;
    const p95 = values.length > 0 ? percentile(values, 0.95) : 0;

    let typicalCount = 0;
    let elevatedCount = 0;
    let extremeCount = 0;
    for (const row of rows) {
        if (row.d2 <= median) {
            row.regime = "Typical";
            typicalCount += 1;
        } else if (row.d2 <= p95) {
            row.regime = "Elevated";
            elevatedCount += 1;
        } else {
            row.regime = "Extreme";
            extremeCount += 1;
        }
    }

    const byDraw = [...rows].sort((a, b) => a.d2 - b.d2);
    return {
        rows,
        meanD2: values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : 0,
        medianD2: median,
        p95D2: p95,
        maxD2: values.length > 0 ? Math.max(...values) : 0,
        expectedD2: LINE_SIZE,
        typicalCount,
        elevatedCount,
        extremeCount,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
        mostTypical: byDraw.slice(0, 5),
        leastTypical: byDraw.slice(-5).reverse(),
    };
}

/* ------------------------------------------------------------------ *
 * 2. Second-difference gap curvature & zigzag sign-flips
 * ------------------------------------------------------------------ */

export interface CurvatureRow {
    draw: number;
    date: string;
    profile: GapProfile;
}

export interface CurvatureProfileBands {
    gapMedian: number[];
    gapP25: number[];
    gapP75: number[];
    secondMedian: number[];
    secondP25: number[];
    secondP75: number[];
}

export interface SecondDiffCurvatureStats {
    rows: CurvatureRow[];
    bands: CurvatureProfileBands;
    regimeCounts: Record<CurvatureRegime, number>;
    regimeShares: Record<CurvatureRegime, number>;
    regimeNull: typeof CURVATURE_REGIME_NULL;
    flipCounts: number[];
    flipShares: number[];
    flipNull: readonly number[];
    meanKappa: number;
    latest: CurvatureRow | null;
}

export function computeSecondDiffCurvatureStats(draws: readonly Draw[]): SecondDiffCurvatureStats {
    const rows: CurvatureRow[] = draws.map((draw) => ({
        draw: draw.draw,
        date: draw.date,
        profile: gapProfileOf(sortedUniqueLine(draw.numbers)),
    }));

    const gapColumns = [0, 1, 2, 3, 4].map((i) => rows.map((row) => row.profile.deltas[i]));
    const secondColumns = [0, 1, 2, 3].map((i) => rows.map((row) => row.profile.secondDiffs[i]));

    const bands: CurvatureProfileBands = {
        gapMedian: gapColumns.map((column) => percentile(column, 0.5)),
        gapP25: gapColumns.map((column) => percentile(column, 0.25)),
        gapP75: gapColumns.map((column) => percentile(column, 0.75)),
        secondMedian: secondColumns.map((column) => percentile(column, 0.5)),
        secondP25: secondColumns.map((column) => percentile(column, 0.25)),
        secondP75: secondColumns.map((column) => percentile(column, 0.75)),
    };

    const regimeCounts: Record<CurvatureRegime, number> = { "Convex Fan": 0, Balanced: 0, "Concave Funnel": 0 };
    const flipCounts = [0, 0, 0, 0];
    let kappaTotal = 0;
    for (const row of rows) {
        regimeCounts[row.profile.regime] += 1;
        flipCounts[row.profile.zigzagFlips] += 1;
        kappaTotal += row.profile.kappa;
    }
    const total = rows.length || 1;

    return {
        rows,
        bands,
        regimeCounts,
        regimeShares: {
            "Convex Fan": regimeCounts["Convex Fan"] / total,
            Balanced: regimeCounts.Balanced / total,
            "Concave Funnel": regimeCounts["Concave Funnel"] / total,
        },
        regimeNull: CURVATURE_REGIME_NULL,
        flipCounts,
        flipShares: flipCounts.map((count) => count / total),
        flipNull: ZIGZAG_FLIP_NULL,
        meanKappa: kappaTotal / total,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
    };
}

/* ------------------------------------------------------------------ *
 * 3. Sidon B2 additive sumset cardinality
 * ------------------------------------------------------------------ */

export interface SidonRow {
    draw: number;
    date: string;
    stats: SidonSumsetStats;
}

export interface SidonSumsetStatsResult {
    rows: SidonRow[];
    /** The exact null share of each |A+A| value, 11..21. */
    nullDistribution: readonly number[];
    /** The observed share of each |A+A| value, 11..21. */
    observedDistribution: number[];
    meanSumset: number;
    nullMeanSumset: number;
    pureSidonCount: number;
    pureSidonShare: number;
    latest: SidonRow | null;
    topSidon: SidonRow[];
}

export function computeSidonSumsetStats(draws: readonly Draw[]): SidonSumsetStatsResult {
    const rows: SidonRow[] = draws.map((draw) => ({
        draw: draw.draw,
        date: draw.date,
        stats: sidonSumsetOf(sortedUniqueLine(draw.numbers)),
    }));

    const observed = new Array<number>(11).fill(0);
    let sumsetTotal = 0;
    let pureSidonCount = 0;
    for (const row of rows) {
        const index = row.stats.distinctSums - 11;
        if (index >= 0 && index < observed.length) observed[index] += 1;
        sumsetTotal += row.stats.distinctSums;
        if (row.stats.isPureSidon) pureSidonCount += 1;
    }
    const total = rows.length || 1;

    const nullWeighted = SIDON_SUMSET_NULL.reduce((acc, p, i) => acc + p * (i + 11), 0);

    return {
        rows,
        nullDistribution: SIDON_SUMSET_NULL,
        observedDistribution: observed.map((count) => count / total),
        meanSumset: sumsetTotal / total,
        nullMeanSumset: nullWeighted,
        pureSidonCount,
        pureSidonShare: pureSidonCount / total,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
        topSidon: [...rows].sort((a, b) => b.stats.distinctSums - a.stats.distinctSums).slice(0, 5),
    };
}

/* ------------------------------------------------------------------ *
 * 4. Playslip 7x7 MST constellation
 * ------------------------------------------------------------------ */

export interface ConstellationRow {
    draw: number;
    date: string;
    stats: ConstellationStats;
}

export interface PlayslipConstellationStats {
    rows: ConstellationRow[];
    /** The expected MST length of a uniform 6-point lattice sample. */
    latticeMstMean: number;
    meanMst: number;
    meanGyration: number;
    /** The share of lines whose MST is longer than the lattice expectation. */
    spreadShare: number;
    latest: ConstellationRow | null;
    widest: ConstellationRow[];
    tightest: ConstellationRow[];
}

export function computePlayslipConstellationStats(draws: readonly Draw[]): PlayslipConstellationStats {
    const rows: ConstellationRow[] = draws.map((draw) => ({
        draw: draw.draw,
        date: draw.date,
        stats: constellationOf(sortedUniqueLine(draw.numbers)),
    }));

    const baseline = latticeMstBaseline();
    let mstTotal = 0;
    let gyrationTotal = 0;
    let spreadCount = 0;
    for (const row of rows) {
        mstTotal += row.stats.mstLength;
        gyrationTotal += row.stats.gyrationRadius;
        if (row.stats.mstLength > baseline) spreadCount += 1;
    }
    const total = rows.length || 1;

    const byMst = [...rows].sort((a, b) => b.stats.mstLength - a.stats.mstLength);
    return {
        rows,
        latticeMstMean: baseline,
        meanMst: mstTotal / total,
        meanGyration: gyrationTotal / total,
        spreadShare: spreadCount / total,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
        widest: byMst.slice(0, 5),
        tightest: byMst.slice(-5).reverse(),
    };
}

/* ------------------------------------------------------------------ *
 * 5. Induced sub-graph cohesion & lag-1 Markov lift
 * ------------------------------------------------------------------ */

export interface SubgraphCohesionRow {
    draw: number;
    date: string;
    /** The mean Z over the fifteen internal pair edges. */
    meanPairZ: number;
    /** How many of the fifteen edges carry a positive Z. */
    positiveEdges: number;
    /** The number of connected components over the positive-Z edges. */
    positiveComponents: number;
    /** The 6x6 incoming lag-1 lift from the previous draw into this line. */
    markovLift: number;
}

export interface SubgraphCohesionStats {
    rows: SubgraphCohesionRow[];
    /** The hypergeometric expectation of a pair meeting once per draw. */
    expectedPairMeetings: number;
    meanPairZ: number;
    meanPositiveEdges: number;
    meanComponents: number;
    meanMarkovLift: number;
    /** The zero-lift lag-1 baseline for a single cell. */
    markovCellNull: number;
    latest: SubgraphCohesionRow | null;
    strongest: SubgraphCohesionRow[];
}

/** The pair-meeting table over a window of draws, as a flat 49x49 counter. */
export const pairMeetingTable = (draws: readonly Draw[]): Float64Array => {
    const table = new Float64Array(POOL * POOL);
    for (const draw of draws) {
        const sorted = sortedUniqueLine(draw.numbers);
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                table[(sorted[i] - 1) * POOL + (sorted[j] - 1)] += 1;
                table[(sorted[j] - 1) * POOL + (sorted[i] - 1)] += 1;
            }
        }
    }
    return table;
};

export function computeSubgraphCohesionStats(draws: readonly Draw[]): SubgraphCohesionStats {
    const window = draws.slice(-250);
    const table = pairMeetingTable(window);
    const expected = (window.length * PAIR_COUNT) / POOL_PAIR_COUNT;
    const sd = Math.sqrt(Math.max(1e-9, window.length * (PAIR_COUNT / POOL_PAIR_COUNT) * (1 - PAIR_COUNT / POOL_PAIR_COUNT)));

    const rows: SubgraphCohesionRow[] = [];
    for (let t = 1; t < draws.length; t += 1) {
        const sorted = sortedUniqueLine(draws[t].numbers);
        if (sorted.length !== LINE_SIZE) continue;

        let zTotal = 0;
        let positiveEdges = 0;
        const adjacency: boolean[][] = Array.from({ length: LINE_SIZE }, () => new Array<boolean>(LINE_SIZE).fill(false));
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                const observed = table[(sorted[i] - 1) * POOL + (sorted[j] - 1)];
                const z = (observed - expected) / sd;
                zTotal += z;
                if (z > 0) {
                    positiveEdges += 1;
                    adjacency[i][j] = true;
                    adjacency[j][i] = true;
                }
            }
        }

        // Connected components over the positive-Z edges.
        const seen = new Uint8Array(LINE_SIZE);
        let components = 0;
        for (let start = 0; start < LINE_SIZE; start += 1) {
            if (seen[start] === 1) continue;
            components += 1;
            const stack = [start];
            seen[start] = 1;
            while (stack.length > 0) {
                const node = stack.pop()!;
                for (let other = 0; other < LINE_SIZE; other += 1) {
                    if (adjacency[node][other] && seen[other] === 0) {
                        seen[other] = 1;
                        stack.push(other);
                    }
                }
            }
        }

        // The 6x6 incoming lag-1 lift: from the previous draw's balls into this one.
        const previous = sortedUniqueLine(draws[t - 1].numbers);
        let lift = 0;
        for (const from of previous) {
            for (const to of sorted) {
                if (from !== to) lift += 1;
            }
        }

        rows.push({
            draw: draws[t].draw,
            date: draws[t].date,
            meanPairZ: zTotal / PAIR_COUNT,
            positiveEdges,
            positiveComponents: components,
            markovLift: lift,
        });
    }

    const total = rows.length || 1;
    let zTotal = 0;
    let edgeTotal = 0;
    let componentTotal = 0;
    let liftTotal = 0;
    for (const row of rows) {
        zTotal += row.meanPairZ;
        edgeTotal += row.positiveEdges;
        componentTotal += row.positiveComponents;
        liftTotal += row.markovLift;
    }

    return {
        rows,
        expectedPairMeetings: expected,
        meanPairZ: zTotal / total,
        meanPositiveEdges: edgeTotal / total,
        meanComponents: componentTotal / total,
        meanMarkovLift: liftTotal / total,
        markovCellNull: (POOL * PICKS) / (POOL * POOL),
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
        strongest: [...rows].sort((a, b) => b.meanPairZ - a.meanPairZ).slice(0, 5),
    };
}

/* ------------------------------------------------------------------ *
 * 6. Multiplicative coprimality & AM-GM spread
 * ------------------------------------------------------------------ */

export interface CoprimeRow {
    draw: number;
    date: string;
    /** How many of the fifteen pairs are coprime. */
    coprimePairs: number;
    /** The geometric mean of the six numbers. */
    geometricMean: number;
    /** The arithmetic mean minus the geometric mean. */
    amGmSpread: number;
}

export interface MultiplicativeCoprimeStats {
    rows: CoprimeRow[];
    /** The exact expected number of coprime pairs in a random line. */
    expectedCoprimePairs: number;
    /** The exact coprime-pair rate of the {1..49} pool. */
    poolCoprimeRate: number;
    /** The exact number of coprime pairs inside {1..49}. */
    poolCoprimePairs: number;
    /** The observed share of each coprime-pair count, index 0 = zero pairs. */
    observedDistribution: number[];
    /** The exact null share of each coprime-pair count, index 0 = zero pairs. */
    nullDistribution: readonly number[];
    meanCoprimePairs: number;
    meanSpread: number;
    /** The exact mean of the AM-GM spread over every 6-subset. */
    nullSpreadMean: number;
    /** The exact standard deviation of the AM-GM spread. */
    nullSpreadSd: number;
    latest: CoprimeRow | null;
    mostCoprime: CoprimeRow[];
}

const greatestCommonDivisor = (a: number, b: number): number => {
    let x = a;
    let y = b;
    while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
};

/** The exact coprime-pair count inside {1..49}: 753 of 1176. */
const POOL_COPRIME_PAIRS = 753;

export function computeMultiplicativeCoprimeStats(draws: readonly Draw[]): MultiplicativeCoprimeStats {
    const rows: CoprimeRow[] = draws.map((draw) => {
        const sorted = sortedUniqueLine(draw.numbers);
        let coprimePairs = 0;
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                if (greatestCommonDivisor(sorted[i], sorted[j]) === 1) coprimePairs += 1;
            }
        }
        const arithmeticMean = sorted.reduce((acc, n) => acc + n, 0) / sorted.length;
        const product = sorted.reduce((acc, n) => acc * n, 1);
        const geometricMean = product ** (1 / sorted.length);
        return {
            draw: draw.draw,
            date: draw.date,
            coprimePairs,
            geometricMean,
            amGmSpread: arithmeticMean - geometricMean,
        };
    });

    const total = rows.length || 1;
    const observed = new Array<number>(16).fill(0);
    for (const row of rows) observed[row.coprimePairs] += 1;

    return {
        rows,
        expectedCoprimePairs: (PAIR_COUNT * POOL_COPRIME_PAIRS) / POOL_PAIR_COUNT,
        poolCoprimeRate: POOL_COPRIME_PAIRS / POOL_PAIR_COUNT,
        poolCoprimePairs: POOL_COPRIME_PAIRS,
        observedDistribution: observed.map((count) => count / total),
        nullDistribution: COPRIME_COUNT_NULL,
        meanCoprimePairs: rows.reduce((acc, row) => acc + row.coprimePairs, 0) / total,
        meanSpread: rows.reduce((acc, row) => acc + row.amGmSpread, 0) / total,
        nullSpreadMean: AMGM_SPREAD_MEAN,
        nullSpreadSd: AMGM_SPREAD_SD,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
        mostCoprime: [...rows].sort((a, b) => b.coprimePairs - a.coprimePairs).slice(0, 5),
    };
}

/* ------------------------------------------------------------------ *
 * 7. Cyclic Z_49 torus arcs
 * ------------------------------------------------------------------ */

export interface TorusRow {
    draw: number;
    date: string;
    /** The six cyclic gaps, including the wrap gap. */
    gaps: number[];
    /** The largest cyclic gap. */
    maxGap: number;
    /** 49 - maxGap: the smallest arc covering every ball. */
    coveringArc: number;
    /** |mean(x) - 25| — the reflection asymmetry. */
    reflectionAsymmetry: number;
}

export interface CyclicTorusArcStats {
    rows: TorusRow[];
    /** The exact null distribution of the largest cyclic gap, index 0 = gap 1. */
    nullDistribution: readonly number[];
    /** The observed distribution of the largest cyclic gap, index 0 = gap 1. */
    observedDistribution: number[];
    meanMaxGap: number;
    nullMeanMaxGap: number;
    meanCoveringArc: number;
    meanReflection: number;
    latest: TorusRow | null;
    mostClustered: TorusRow[];
}

export function computeCyclicTorusArcStats(draws: readonly Draw[]): CyclicTorusArcStats {
    const rows: TorusRow[] = draws.map((draw) => {
        const sorted = sortedUniqueLine(draw.numbers);
        const gaps = cyclicGaps49(sorted);
        const maxGap = Math.max(...gaps);
        const sum = sorted.reduce((acc, n) => acc + n, 0);
        return {
            draw: draw.draw,
            date: draw.date,
            gaps,
            maxGap,
            coveringArc: POOL - maxGap,
            reflectionAsymmetry: Math.abs(sum / sorted.length - 25),
        };
    });

    const observed = new Array<number>(TORUS_MAX_GAP_NULL.length).fill(0);
    for (const row of rows) {
        const index = row.maxGap - 1;
        if (index >= 0 && index < observed.length) observed[index] += 1;
    }
    const total = rows.length || 1;

    const nullMean = TORUS_MAX_GAP_NULL.reduce((acc, p, i) => acc + p * (i + 1), 0);

    return {
        rows,
        nullDistribution: TORUS_MAX_GAP_NULL,
        observedDistribution: observed.map((count) => count / total),
        meanMaxGap: rows.reduce((acc, row) => acc + row.maxGap, 0) / total,
        nullMeanMaxGap: nullMean,
        meanCoveringArc: rows.reduce((acc, row) => acc + row.coveringArc, 0) / total,
        meanReflection: rows.reduce((acc, row) => acc + row.reflectionAsymmetry, 0) / total,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
        mostClustered: [...rows].sort((a, b) => b.maxGap - a.maxGap).slice(0, 5),
    };
}

/* ------------------------------------------------------------------ *
 * 8. Recursive & integer-sequence resonance
 * ------------------------------------------------------------------ */

export interface RecursiveSetDefinition {
    id: string;
    label: string;
    members: number[];
}

/** The twelve recursive / integer sets inside {1..49}. */
export const RECURSIVE_SETS: readonly RecursiveSetDefinition[] = [
    { id: "lucas", label: "Lucas", members: [1, 2, 3, 4, 7, 11, 18, 29, 47] },
    { id: "tribonacci", label: "Tribonacci", members: [1, 2, 4, 7, 13, 24, 44] },
    { id: "padovan", label: "Padovan", members: [1, 2, 3, 4, 5, 7, 9, 12, 16, 21, 28, 37, 49] },
    { id: "pell", label: "Pell", members: [1, 2, 5, 12, 29] },
    { id: "catalan", label: "Catalan", members: [1, 2, 5, 14, 42] },
    { id: "ulam", label: "Ulam", members: [1, 2, 3, 4, 6, 8, 11, 13, 16, 18, 26, 28, 36, 38, 47] },
    { id: "lucky", label: "Euler Lucky", members: [1, 3, 7, 9, 13, 15, 21, 25, 31, 33, 37, 43, 49] },
    { id: "semiprime", label: "Semiprimes", members: [4, 6, 9, 10, 14, 15, 21, 22, 25, 26, 33, 34, 35, 38, 39, 46, 49] },
    { id: "pentagonal", label: "Pentagonal", members: [1, 5, 12, 22, 35] },
    { id: "hexagonal", label: "Hexagonal", members: [1, 6, 15, 28, 45] },
    { id: "harshad", label: "Harshad", members: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 20, 21, 24, 27, 30, 36, 40, 42, 45, 48] },
    { id: "abundant", label: "Abundant", members: [12, 18, 20, 24, 30, 36, 40, 42, 48] },
];

export interface RecursiveSetRow {
    id: string;
    label: string;
    /** How many of the six balls fall inside the set (latest draw). */
    hits: number;
    /** The archive-mean hits per draw. */
    meanHits: number;
    /** The exact hypergeometric expectation, 6|S|/49. */
    expected: number;
    /** The binomial z-score of the hit count, averaged over the archive. */
    zScore: number;
    /** The exact binomial upper-tail probability of the observed count. */
    pValue: number;
}

export interface ExtendedSequenceResonanceStats {
    rows: RecursiveSetRow[];
    /** The most resonant set in the latest draw. */
    latest: RecursiveSetRow | null;
    /** The average z-score across the twelve sets. */
    meanZ: number;
    /** The archive-mean hits per set. */
    meanHits: number;
    /** The archive-wide average hits per set, for reference. */
    meanExpected: number;
}

/** The exact binomial upper tail P(X >= k) for n trials at probability p. */
export function binomialUpperTail(n: number, p: number, k: number): number {
    if (k <= 0) return 1;
    if (k > n) return 0;
    let total = 0;
    for (let i = k; i <= n; i += 1) {
        total += binomial(n, i) * p ** i * (1 - p) ** (n - i);
    }
    return Math.min(1, Math.max(0, total));
}

export function computeExtendedSequenceResonanceStats(draws: readonly Draw[]): ExtendedSequenceResonanceStats {
    const memberSets = RECURSIVE_SETS.map((set) => new Set(set.members));

    const rows: RecursiveSetRow[] = RECURSIVE_SETS.map((set, index) => {
        const membership = memberSets[index];
        const probability = set.members.length / POOL;
        const expected = (LINE_SIZE * set.members.length) / POOL;
        const sd = Math.sqrt(Math.max(1e-9, LINE_SIZE * probability * (1 - probability)));

        let hitsTotal = 0;
        let zTotal = 0;
        let lastHits = 0;
        for (const draw of draws) {
            const sorted = sortedUniqueLine(draw.numbers);
            let hits = 0;
            for (const ball of sorted) if (membership.has(ball)) hits += 1;
            hitsTotal += hits;
            zTotal += (hits - expected) / sd;
            lastHits = hits;
        }

        return {
            id: set.id,
            label: set.label,
            hits: lastHits,
            meanHits: draws.length > 0 ? hitsTotal / draws.length : 0,
            expected,
            zScore: draws.length > 0 ? zTotal / draws.length : 0,
            pValue: binomialUpperTail(LINE_SIZE, probability, lastHits),
        };
    });

    const total = rows.length || 1;
    return {
        rows,
        latest: rows.length > 0 ? [...rows].sort((a, b) => b.hits - a.hits || b.zScore - a.zScore)[0] : null,
        meanZ: rows.reduce((acc, row) => acc + row.zScore, 0) / total,
        meanHits: rows.reduce((acc, row) => acc + row.meanHits, 0) / total,
        meanExpected: rows.reduce((acc, row) => acc + row.expected, 0) / total,
    };
}

/* ================================================================== *
 * PART 2 — Stream dynamics (gallery 11)
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * 9. Wasserstein-1 optimal transport between consecutive draws
 * ------------------------------------------------------------------ */

/**
 * The exact E[W1] between two independent uniform 6-subsets of {1..49}:
 * E|X_(k) - Y_(k)| = 2 mu_k - 2 E[min(X_(k), Y_(k))], and
 * E[min(X_(k), Y_(k))] = sum_a P(X_(k) >= a)^2 because X and Y are
 * independent and identically distributed.
 */
export const expectedWasserstein1 = (): number => {
    const total = binomial(POOL, LINE_SIZE);
    let sum = 0;
    for (let k = 1; k <= LINE_SIZE; k += 1) {
        let minExpectation = 0;
        for (let a = 1; a <= POOL; a += 1) {
            // P(X_(k) >= a): fewer than k of the six draws fall inside {1..a-1}.
            let tail = 0;
            for (let j = 0; j < k; j += 1) {
                tail += (binomial(a - 1, j) * binomial(POOL - a + 1, LINE_SIZE - j)) / total;
            }
            minExpectation += tail * tail;
        }
        sum += 2 * ORDER_STAT_MEAN[k - 1] - 2 * minExpectation;
    }
    return sum / LINE_SIZE;
};

export interface WassersteinRow {
    draw: number;
    date: string;
    /** The Earth Mover's distance between this draw and the previous one. */
    w1: number;
}

export interface WassersteinTransportStats {
    rows: WassersteinRow[];
    /** The exact analytical E[W1] for two independent draws. */
    expectedW1: number;
    /** The mean W1 over the archive's transitions. */
    meanW1: number;
    medianW1: number;
    p05W1: number;
    p95W1: number;
    /** How many transitions stayed inside the quiet band. */
    quietCount: number;
    /** How many transitions jumped past the envelope. */
    jumpCount: number;
    /** The lag-1 reversion correlation of W1 with its own next value. */
    reversionCorrelation: number;
    /** The 15-draw rolling envelope: min / max / median per step. */
    envelope: { label: string; value: number; upper: number; lower: number }[];
    latest: WassersteinRow | null;
}

export function computeWassersteinTransportStats(draws: readonly Draw[]): WassersteinTransportStats {
    const rows: WassersteinRow[] = [];
    for (let t = 1; t < draws.length; t += 1) {
        const previous = sortedUniqueLine(draws[t - 1].numbers);
        const current = sortedUniqueLine(draws[t].numbers);
        if (previous.length !== LINE_SIZE || current.length !== LINE_SIZE) continue;
        let total = 0;
        for (let k = 0; k < LINE_SIZE; k += 1) total += Math.abs(current[k] - previous[k]);
        rows.push({ draw: draws[t].draw, date: draws[t].date, w1: total / LINE_SIZE });
    }

    const values = rows.map((row) => row.w1);
    const expected = expectedWasserstein1();
    const median = values.length > 0 ? percentile(values, 0.5) : 0;
    const p05 = values.length > 0 ? percentile(values, 0.05) : 0;
    const p95 = values.length > 0 ? percentile(values, 0.95) : 0;

    const quietCount = values.filter((v) => v <= median).length;
    const jumpCount = values.filter((v) => v > p95).length;

    // Lag-1 reversion: does a big jump pull the next step back down?
    let covariance = 0;
    let pairs = 0;
    for (let i = 0; i + 1 < values.length; i += 1) {
        covariance += (values[i] - median) * (values[i + 1] - median);
        pairs += 1;
    }
    let varianceA = 0;
    let varianceB = 0;
    for (let i = 0; i + 1 < values.length; i += 1) {
        varianceA += (values[i] - median) ** 2;
        varianceB += (values[i + 1] - median) ** 2;
    }
    const reversionCorrelation =
        pairs > 0 && varianceA > 0 && varianceB > 0 ? covariance / Math.sqrt(varianceA * varianceB) : 0;

    const envelope: { label: string; value: number; upper: number; lower: number }[] = rows.map((row, i) => {
        const window = values.slice(Math.max(0, i - 14), i + 1);
        return {
            label: String(row.draw),
            value: row.w1,
            upper: window.length > 0 ? percentile(window, 0.95) : row.w1,
            lower: window.length > 0 ? percentile(window, 0.05) : row.w1,
        };
    });

    return {
        rows,
        expectedW1: expected,
        meanW1: values.length > 0 ? values.reduce((acc, v) => acc + v, 0) / values.length : 0,
        medianW1: median,
        p05W1: p05,
        p95W1: p95,
        quietCount,
        jumpCount,
        reversionCorrelation,
        envelope,
        latest: rows.length > 0 ? rows[rows.length - 1] : null,
    };
}

/* ------------------------------------------------------------------ *
 * 10. Lempel-Ziv algorithmic complexity
 * ------------------------------------------------------------------ */

/**
 * The Kaspar-Schuster normalized LZ76 complexity of a binary stream:
 * c(n) is the number of phrases in the shortest-phrase parse, and
 * c_norm(n) = c(n) * (1 + 0.5 log2 n) / n, clamped to [0, 1].
 *
 * The parse is the classical one: at every position the shortest phrase
 * that is not a prefix of an already-used phrase is taken. Tracking every
 * used prefix in a set keeps the whole parse linear in the stream length.
 */
/**
 * The number of phrases in the Kaspar-Schuster parse — the finite-sample
 * algorithmic complexity of a binary stream.
 *
 * The normalized form (below) saturates at 1 for any stream short enough to
 * parse, because the normalization factor 1 + ½·log2(n) already accounts for
 * the whole phrase count a random binary stream of length n produces. The
 * raw count is the part that still moves.
 */
export function kasparSchusterPhraseCount(stream: readonly number[]): number {
    const n = stream.length;
    if (n <= 1) return n;

    const bits = stream.map((v) => (v > 0 ? "1" : "0"));
    const used = new Set<string>();
    let phraseCount = 0;
    let position = 0;

    while (position < n) {
        let best = n - position;
        for (let length = 1; length <= n - position; length += 1) {
            const candidate = bits.slice(position, position + length).join("");
            if (!used.has(candidate)) {
                best = length;
                break;
            }
        }
        const phrase = bits.slice(position, position + best).join("");
        for (let k = 1; k <= best; k += 1) used.add(phrase.slice(0, k));
        phraseCount += 1;
        position += best;
    }

    return phraseCount;
}

export function kasparSchusterComplexity(stream: readonly number[]): number {
    const n = stream.length;
    if (n === 0) return 0;
    if (n === 1) return 1;

    const phraseCount = kasparSchusterPhraseCount(stream);
    const normalized = (phraseCount * (1 + 0.5 * Math.log2(n))) / n;
    return Math.min(1, Math.max(0, normalized));
}

export interface LempelZivStats {
    /** The normalized complexity of the sum-vs-median stream, per draw. */
    sumStream: number[];
    /** The normalized complexity of the parity stream, per draw. */
    parityStream: number[];
    /** The shuffled baselines for the same two streams. */
    shuffledBaseline: number;
    /** The Feder-Merhav predictability ceiling of the parity stream. */
    predictabilityCeiling: number;
    /**
     * The rolling 100-draw window of the sum stream's algorithmic
     * complexity, in phrases, against the same window of the shuffled twin.
     */
    rolling: { label: string; value: number; nullValue: number; normalized: number }[];
    /** The mean phrase count per 100-draw window in the archive. */
    meanPhraseCount: number;
    /** The mean phrase count per 100-draw window of the shuffled twin. */
    nullPhraseCount: number;
    /** The mean normalized complexity of both streams. */
    meanComplexity: number;
    /** The asymptotic Bernoulli(1/2) target. */
    asymptoticTarget: number;
}

export function computeLempelZivComplexityStats(draws: readonly Draw[]): LempelZivStats {
    const sums = draws.map((draw) => draw.numbers.reduce((acc, n) => acc + n, 0));
    const medianSum = sums.length > 0 ? percentile(sums, 0.5) : 0;

    const sumStream: number[] = sums.map((sum) => (sum > medianSum ? 1 : 0));
    const parityStream: number[] = sums.map((sum) => (sum % 2 === 0 ? 1 : 0));

    // A deterministic shuffle for the null baseline. The same shuffle gives
    // the rolling null: the shuffled twin's window at the same place.
    const rng = seededRandom(0x1e3a);
    const shuffled = [...sumStream];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // The phrase count is the part of the measure that still moves: the
    // normalized form saturates at 1 for every window of this length.
    const rolling: { label: string; value: number; nullValue: number; normalized: number }[] = [];
    const windowSize = 100;
    for (let end = windowSize; end <= sumStream.length; end += 1) {
        rolling.push({
            label: String(draws[end - 1].draw),
            value: kasparSchusterPhraseCount(sumStream.slice(end - windowSize, end)),
            nullValue: kasparSchusterPhraseCount(shuffled.slice(end - windowSize, end)),
            normalized: kasparSchusterComplexity(sumStream.slice(end - windowSize, end)),
        });
    }

    // The Feder-Merhav ceiling: the best achievable prediction error of a
    // stationary binary source is the inverse binary entropy of its entropy
    // rate, so the ceiling on predictability is 1 - H2^-1(h).
    const ones: number = parityStream.reduce((acc, v) => acc + v, 0);
    const rate = parityStream.length > 0 ? ones / parityStream.length : 0.5;
    const entropyRate = binaryEntropy(rate);
    const predictabilityCeiling = 1 - inverseBinaryEntropy(entropyRate);

    const meanComplexity =
        rolling.length > 0 ? rolling.reduce((acc, point) => acc + point.normalized, 0) / rolling.length : 0;
    const meanPhraseCount =
        rolling.length > 0 ? rolling.reduce((acc, point) => acc + point.value, 0) / rolling.length : 0;
    const nullPhraseCount =
        rolling.length > 0 ? rolling.reduce((acc, point) => acc + point.nullValue, 0) / rolling.length : 0;

    return {
        sumStream,
        parityStream,
        shuffledBaseline: kasparSchusterComplexity(shuffled),
        predictabilityCeiling,
        rolling,
        meanPhraseCount,
        nullPhraseCount,
        meanComplexity,
        asymptoticTarget: 1,
    };
}

/* ------------------------------------------------------------------ *
 * 11. Spectral periodogram & Fisher's exact test
 * ------------------------------------------------------------------ */

export interface PeriodogramResult {
    /** The periodogram ordinates, index 0 = the first frequency. */
    power: Float64Array;
    /** The number of ordinates. */
    count: number;
    /** The length of the transformed window. */
    windowLength: number;
    /** The dominant cycle length in draws. */
    dominantPeriod: number;
    /** The index of the dominant ordinate. */
    dominantIndex: number;
    /** The dominant frequency bin, 1-based. */
    dominantFrequency: number;
    /** Fisher's g statistic: the largest ordinate over the mean ordinate. */
    g: number;
    /** Fisher's p-value for periodicity under the white-noise null. */
    pValue: number;
    /** The g threshold at p = 0.05. */
    gThreshold: number;
    /** The mean ordinate — the white-noise reference level of the spectrum. */
    meanOrdinate: number;
    /**
     * The power level a dominant ordinate would need to clear to be
     * significant: the g threshold expressed back on the power axis.
     */
    significancePower: number;
    /** The phase of the dominant harmonic, in radians. */
    dominantPhase: number;
}

/**
 * Fisher's g critical value at a given p, for `count` ordinates.
 *
 * Under the white-noise null the periodogram ordinates are i.i.d.
 * Exponential(1), so the largest one exceeds the mean by a factor g only
 * when P(max > g · mean) = p. With the mean at its expectation that is
 * 1 − (1 − e^(−g))^count = p, which solves to
 *
 *   g_c = −ln(1 − (1 − p)^(1/count))
 *
 * A Monte Carlo over 20,000 exponential draws puts the empirical 95th
 * percentile at 9.162 for 512 ordinates against the 9.209 this formula
 * returns.
 */
export const fisherGThreshold = (count: number, p = 0.05): number => {
    if (count < 2) return Number.NaN;
    return -Math.log(1 - (1 - p) ** (1 / count));
};

/**
 * The p-value of an observed Fisher g under the same white-noise null:
 * P(g ≥ g_obs) = 1 − (1 − e^(−g_obs))^count.
 */
export const fisherGPValue = (g: number, count: number): number => {
    if (count < 2 || !(g > 0)) return 1;
    return 1 - (1 - Math.exp(-g)) ** count;
};

/**
 * An in-place radix-2 Cooley-Tukey FFT. The length must be a power of two.
 */
function radix2Fft(re: Float64Array, im: Float64Array): void {
    const n = re.length;

    // Bit-reversal permutation.
    for (let i = 1, j = 0; i < n; i += 1) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            const tempRe = re[i];
            re[i] = re[j];
            re[j] = tempRe;
            const tempIm = im[i];
            im[i] = im[j];
            im[j] = tempIm;
        }
    }

    for (let span = 2; span <= n; span <<= 1) {
        const angle = (-2 * Math.PI) / span;
        const stepRe = Math.cos(angle);
        const stepIm = Math.sin(angle);
        const half = span >> 1;

        for (let start = 0; start < n; start += span) {
            let twiddleRe = 1;
            let twiddleIm = 0;
            for (let k = 0; k < half; k += 1) {
                const evenRe = re[start + k];
                const evenIm = im[start + k];
                const oddRe = re[start + k + half] * twiddleRe - im[start + k + half] * twiddleIm;
                const oddIm = re[start + k + half] * twiddleIm + im[start + k + half] * twiddleRe;

                re[start + k] = evenRe + oddRe;
                im[start + k] = evenIm + oddIm;
                re[start + k + half] = evenRe - oddRe;
                im[start + k + half] = evenIm - oddIm;

                const nextRe = twiddleRe * stepRe - twiddleIm * stepIm;
                twiddleIm = twiddleRe * stepIm + twiddleIm * stepRe;
                twiddleRe = nextRe;
            }
        }
    }
}

/** The largest power of two that is at most `length`. */
const largestPowerOfTwo = (length: number): number => {
    let power = 64;
    while (power * 2 <= length) power *= 2;
    return power;
};

/**
 * The exact periodogram of a centred series.
 *
 * The transform runs on the trailing power-of-two window of the series, so
 * the radix-2 FFT covers it exactly and the ordinates land on the true
 * frequencies 2*pi*j/N. The full era is 1238 draws — 2 x 619, with 619
 * prime — so no power-of-two transform spans it; the trailing 1024 draws
 * are the largest exact window.
 */
export function periodogramOf(signal: ArrayLike<number>): PeriodogramResult {
    const available = signal.length;
    const window = Math.min(available, largestPowerOfTwo(available));
    const count = Math.max(0, Math.floor((window - 1) / 2));

    const re = new Float64Array(window);
    const im = new Float64Array(window);

    let mean = 0;
    for (let i = 0; i < window; i += 1) mean += signal[available - window + i];
    mean /= window;

    for (let i = 0; i < window; i += 1) re[i] = signal[available - window + i] - mean;

    const power = new Float64Array(count);
    if (count === 0) {
        return {
            power,
            count: 0,
            windowLength: window,
            dominantPeriod: 0,
            dominantIndex: 0,
            dominantFrequency: 0,
            g: 0,
            pValue: 1,
            gThreshold: Number.NaN,
            meanOrdinate: 0,
            significancePower: Number.NaN,
            dominantPhase: 0,
        };
    }

    radix2Fft(re, im);

    let total = 0;
    let dominantIndex = 0;
    let dominantPower = -1;
    for (let j = 1; j <= count; j += 1) {
        const ordinate = (re[j] * re[j] + im[j] * im[j]) / window;
        power[j - 1] = ordinate;
        total += ordinate;
        if (ordinate > dominantPower) {
            dominantPower = ordinate;
            dominantIndex = j - 1;
        }
    }

    const meanOrdinate = total / count;
    const g = meanOrdinate > 0 ? dominantPower / meanOrdinate : 0;
    // Fisher's test for white noise: under the null the ordinates are i.i.d.
    // Exponential(1), so the largest ordinate's factor over the mean carries
    // the periodicity evidence.
    const pValue = fisherGPValue(g, count);

    return {
        power,
        count,
        windowLength: window,
        dominantPeriod: window / (dominantIndex + 1),
        dominantIndex,
        dominantFrequency: dominantIndex + 1,
        g,
        pValue,
        gThreshold: fisherGThreshold(count, 0.05),
        meanOrdinate,
        significancePower: fisherGThreshold(count, 0.05) * meanOrdinate,
        dominantPhase: Math.atan2(im[dominantIndex + 1], re[dominantIndex + 1]),
    };
}

export interface SpectralBallRow {
    ball: number;
    /** The dominant cycle length of the ball's binary stream. */
    dominantPeriod: number;
    /** Fisher's g statistic for that ball. */
    g: number;
    /** Fisher's exact p-value for that ball. */
    pValue: number;
    /** The constructive phase alignment of the ball at the next draw. */
    nextPhaseAlignment: number;
}

export interface SpectralPeriodogramStats {
    /** The periodogram of the draw-sum series. */
    sum: PeriodogramResult;
    /** The periodogram of the repeater-count series. */
    repeaters: PeriodogramResult;
    /** Per-ball spectral rows, ball order. */
    balls: SpectralBallRow[];
    /** The balls whose dominant harmonic points at the next draw. */
    phaseAligned: SpectralBallRow[];
    /** The dominant cycle period of the draw-sum series, in draws. */
    dominantPeriod: number;
    /** Fisher's g of the draw-sum series. */
    fisherG: number;
    /** Fisher's exact p-value for the draw-sum series. */
    fisherP: number;
    /** The g threshold at p = 0.05. */
    gThreshold: number;
    /** The spectrum of the draw-sum series, for the chart. */
    spectrum: { period: number; power: number }[];
}

export function computeSpectralPeriodogramStats(draws: readonly Draw[]): SpectralPeriodogramStats {
    const sums = draws.map((draw) => draw.numbers.reduce((acc, n) => acc + n, 0));
    const repeaters = draws.map((draw, index) => {
        if (index === 0) return 0;
        const previous = new Set(draws[index - 1].numbers);
        return draw.numbers.filter((n) => previous.has(n)).length;
    });

    const sumResult = periodogramOf(sums);
    const repeaterResult = periodogramOf(repeaters);

    const n = draws.length;
    const balls: SpectralBallRow[] = [];
    for (let ball = 1; ball <= POOL; ball += 1) {
        const stream = new Float64Array(n);
        for (let t = 0; t < n; t += 1) stream[t] = draws[t].numbers.includes(ball) ? 1 : 0;
        const result = periodogramOf(stream);

        // The constructive phase alignment of the dominant harmonic at the
        // next draw: the window-relative index one past the last sample.
        let alignment = 0;
        if (result.count > 0 && result.dominantFrequency > 0) {
            const omega = (2 * Math.PI * result.dominantFrequency) / result.windowLength;
            alignment = Math.cos(omega * result.windowLength - result.dominantPhase);
        }

        balls.push({
            ball,
            dominantPeriod: result.dominantPeriod,
            g: result.g,
            pValue: result.pValue,
            nextPhaseAlignment: alignment,
        });
    }

    const phaseAligned = [...balls]
        .sort((a, b) => b.nextPhaseAlignment * b.g - a.nextPhaseAlignment * a.g)
        .slice(0, 12);

    const windowLength = sumResult.windowLength;
    const spectrum: { period: number; power: number }[] = [];
    for (let j = 0; j < sumResult.count; j += 1) {
        spectrum.push({ period: windowLength / (j + 1), power: sumResult.power[j] });
    }

    return {
        sum: sumResult,
        repeaters: repeaterResult,
        balls,
        phaseAligned,
        dominantPeriod: sumResult.dominantPeriod,
        fisherG: sumResult.g,
        fisherP: sumResult.pValue,
        gThreshold: sumResult.gThreshold,
        spectrum,
    };
}

/* ------------------------------------------------------------------ *
 * 12. Discrete Hawkes self-excitation
 * ------------------------------------------------------------------ */

/** The Hawkes kernel weight at lag k, with a five-draw half-life. */
const HAWKES_ALPHA = 1 - 2 ** (-1 / 5);

/** How many past draws the Hawkes memory spans. */
const HAWKES_MEMORY = 40;

export interface HawkesBallRow {
    ball: number;
    /** The live arrival intensity at the next draw. */
    intensity: number;
    /** The self-excitation z-score: positive = exciting, negative = refractory. */
    excitationZ: number;
    /** The kernel-weighted recent appearances. */
    excitation: number;
}

export interface HawkesPointProcessStats {
    rows: HawkesBallRow[];
    /** The memoryless Bernoulli base rate, 6/49. */
    baseRate: number;
    /** The mean live intensity. */
    meanIntensity: number;
    /** The most self-exciting ball. */
    hottest: HawkesBallRow | null;
    /** The most refractory ball. */
    coldest: HawkesBallRow | null;
}

/**
 * The discrete Hawkes intensity of every ball at the next draw:
 * lambda_i = mu0 + 6 * sum_k alpha (1-alpha)^k 1[ball i was in draw T-k],
 * with a normalised exponential kernel whose half-life is five draws.
 */
export function computeHawkesPointProcessStats(draws: readonly Draw[]): HawkesPointProcessStats {
    const n = draws.length;
    const weights: number[] = [];
    let weightSum = 0;
    let weightSquareSum = 0;
    for (let k = 0; k < HAWKES_MEMORY; k += 1) {
        const w = HAWKES_ALPHA * (1 - HAWKES_ALPHA) ** k;
        weights.push(w);
        weightSum += w;
        weightSquareSum += w * w;
    }

    const hits = new Float64Array(POOL);
    for (let k = 0; k < HAWKES_MEMORY; k += 1) {
        const draw = draws[n - 1 - k];
        if (!draw) break;
        for (const ball of draw.numbers) hits[ball - 1] += weights[k];
    }

    const baseRate = NULL_PROB;
    const zScale = Math.sqrt(Math.max(1e-12, baseRate * (1 - baseRate) * weightSquareSum));

    const rows: HawkesBallRow[] = [];
    for (let ball = 1; ball <= POOL; ball += 1) {
        const excitation = hits[ball - 1];
        rows.push({
            ball,
            // The intensity is the marginal appearance rate plus what the
            // recent history adds — no second factor of PICKS, which would
            // inflate it six-fold.
            intensity: baseRate + excitation,
            excitationZ: (excitation - baseRate * weightSum) / zScale,
            excitation,
        });
    }

    const byIntensity = [...rows].sort((a, b) => b.intensity - a.intensity);
    return {
        rows,
        baseRate,
        meanIntensity: rows.reduce((acc, row) => acc + row.intensity, 0) / rows.length,
        hottest: byIntensity[0] ?? null,
        coldest: byIntensity[byIntensity.length - 1] ?? null,
    };
}

/* ------------------------------------------------------------------ *
 * 13. Recurrence quantification analysis
 * ------------------------------------------------------------------ */

/** The exact P(|D_s AND D_t| >= 2) for two independent draws: 15.1016%. */
export const RECURRENCE_NULL = 0.151016;

export interface RqaRecurrenceStats {
    /** The recurrence matrix as a flat 180x180 array. */
    matrix: Uint8Array;
    /** The matrix side length. */
    size: number;
    /** The recurrence rate: the share of off-diagonal pairs that recur. */
    recurrenceRate: number;
    /** The determinism: the share of recurrence points on runs of length >= 2. */
    determinism: number;
    /** The laminarity: the share of recurrence points on vertical runs of length >= 2. */
    laminarity: number;
    /** The longest diagonal run. */
    longestDiagonal: number;
    /** The longest vertical run. */
    longestVertical: number;
    /** The exact hypergeometric null. */
    null: number;
    /** The number of recurrence points. */
    points: number;
}

export function computeRqaRecurrenceStats(draws: readonly Draw[]): RqaRecurrenceStats {
    const size = Math.min(180, draws.length);
    const window = draws.slice(-size);
    const sets = window.map((draw) => sortedUniqueLine(draw.numbers));
    const matrix = new Uint8Array(size * size);

    let points = 0;
    for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
            if (i === j) continue;
            let overlap = 0;
            const left = sets[i];
            const right = sets[j];
            for (const ball of left) if (right.includes(ball)) overlap += 1;
            if (overlap >= 2) {
                matrix[i * size + j] = 1;
                points += 1;
            }
        }
    }

    // Diagonal runs of length >= 2 (determinism) and vertical runs (laminarity).
    const diagonalRuns: number[] = [];
    const verticalRuns: number[] = [];
    let diagonalPoints = 0;
    let verticalPoints = 0;

    for (let i = 0; i < size; i += 1) {
        let run = 0;
        for (let j = 0; j < size; j += 1) {
            const onDiagonal = matrix[i * size + j] === 1 && i !== j;
            if (onDiagonal) {
                run += 1;
            } else {
                if (run > 0) diagonalRuns.push(run);
                run = 0;
            }
        }
        if (run > 0) diagonalRuns.push(run);
    }

    for (let j = 0; j < size; j += 1) {
        let run = 0;
        for (let i = 0; i < size; i += 1) {
            const onDiagonal = matrix[i * size + j] === 1 && i !== j;
            if (onDiagonal) {
                run += 1;
            } else {
                if (run > 0) verticalRuns.push(run);
                run = 0;
            }
        }
        if (run > 0) verticalRuns.push(run);
    }

    for (const run of diagonalRuns) if (run >= 2) diagonalPoints += run;
    for (const run of verticalRuns) if (run >= 2) verticalPoints += run;

    const offDiagonal = size * (size - 1);
    return {
        matrix,
        size,
        recurrenceRate: offDiagonal > 0 ? points / offDiagonal : 0,
        determinism: points > 0 ? diagonalPoints / points : 0,
        laminarity: points > 0 ? verticalPoints / points : 0,
        longestDiagonal: diagonalRuns.length > 0 ? Math.max(...diagonalRuns) : 0,
        longestVertical: verticalRuns.length > 0 ? Math.max(...verticalRuns) : 0,
        null: RECURRENCE_NULL,
        points,
    };
}

/* ------------------------------------------------------------------ *
 * 14. Multi-draw union depletion
 * ------------------------------------------------------------------ */

export interface UnionDepletionRow {
    /** The horizon, 1..15. */
    horizon: number;
    /** The mean union size of the trailing L draws. */
    unionSize: number;
    /** The exact expectation, 49(1 - (43/49)^L). */
    unionNull: number;
    /** How many of the next draw's balls came out of the recycled union. */
    recycledHits: number;
    /** The exact expectation, 6|U_L|/49. */
    recycledNull: number;
    /** How many of the next draw's balls came from the untouched cold pool. */
    freshHits: number;
    /** The exact expectation, 6(49-|U_L|)/49. */
    freshNull: number;
    /** How much of the union carries over when the horizon grows by one draw. */
    reuseRate: number;
}

export interface UnionDepletionCurveStats {
    rows: UnionDepletionRow[];
    /**
     * The horizon at which the trailing union first covers at least half of
     * the 49-ball pool — the point where the fresh cold pool stops being the
     * larger source of numbers.
     */
    crossoverHorizon: number;
    /** The same crossover in closed form: ln(1/2) / ln(43/49) = 5.31 draws. */
    crossoverAnalytic: number;
    /** The live untouched pool after the trailing eight draws. */
    liveColdPool: number[];
    /** The live recycled union after the trailing eight draws. */
    liveUnion: number[];
    /** The live recycled union after the trailing five draws. */
    liveUnion5: number[];
    /** The mean union size at the crossover horizon. */
    crossoverUnionSize: number;
}

export function computeUnionDepletionCurveStats(draws: readonly Draw[]): UnionDepletionCurveStats {
    const maxHorizon = 15;
    const rows: UnionDepletionRow[] = [];

    for (let horizon = 1; horizon <= maxHorizon; horizon += 1) {
        let unionTotal = 0;
        let recycledTotal = 0;
        let freshTotal = 0;
        let reuseTotal = 0;
        let samples = 0;

        for (let t = horizon; t < draws.length; t += 1) {
            const union = new Set<number>();
            for (let back = 1; back <= horizon; back += 1) {
                const draw = draws[t - back];
                if (!draw) break;
                for (const ball of draw.numbers) union.add(ball);
            }
            const next = draws[t].numbers;
            const recycled = next.filter((ball) => union.has(ball)).length;
            const fresh = next.length - recycled;
            const unionSize = union.size;

            // How much of the shorter union survives into this one.
            const shorter = new Set<number>();
            for (let back = 1; back <= horizon - 1; back += 1) {
                const draw = draws[t - back];
                if (!draw) break;
                for (const ball of draw.numbers) shorter.add(ball);
            }
            let carried = 0;
            for (const ball of shorter) if (union.has(ball)) carried += 1;

            unionTotal += unionSize;
            recycledTotal += recycled;
            freshTotal += fresh;
            reuseTotal += shorter.size > 0 ? carried / shorter.size : 0;
            samples += 1;
        }

        const count = samples || 1;
        const unionNull = POOL * (1 - ((POOL - PICKS) / POOL) ** horizon);
        rows.push({
            horizon,
            unionSize: unionTotal / count,
            unionNull,
            recycledHits: recycledTotal / count,
            recycledNull: (PICKS * unionNull) / POOL,
            freshHits: freshTotal / count,
            freshNull: (PICKS * (POOL - unionNull)) / POOL,
            reuseRate: reuseTotal / count,
        });
    }

    // The crossover: the trailing union reaches parity with the cold pool
    // when it covers half of the 49 balls. In closed form that is
    // 49(1 - (43/49)^L) = 24.5, i.e. L = ln(1/2) / ln(43/49) = 5.31 draws.
    let crossoverHorizon = maxHorizon;
    for (const row of rows) {
        if (row.unionSize >= POOL - row.unionSize) {
            crossoverHorizon = row.horizon;
            break;
        }
    }
    const crossoverAnalytic = Math.log(0.5) / Math.log((POOL - PICKS) / POOL);

    const liveUnion = new Set<number>();
    for (let back = 1; back <= 8; back += 1) {
        const draw = draws[draws.length - back];
        if (!draw) break;
        for (const ball of draw.numbers) liveUnion.add(ball);
    }
    const liveUnionList = [...liveUnion].sort((a, b) => a - b);

    const liveUnion5 = new Set<number>();
    for (let back = 1; back <= 5; back += 1) {
        const draw = draws[draws.length - back];
        if (!draw) break;
        for (const ball of draw.numbers) liveUnion5.add(ball);
    }

    return {
        rows,
        crossoverHorizon,
        crossoverAnalytic,
        liveColdPool: Array.from({ length: POOL }, (_, i) => i + 1).filter((ball) => !liveUnion.has(ball)),
        liveUnion: liveUnionList,
        liveUnion5: [...liveUnion5].sort((a, b) => a - b),
        crossoverUnionSize: rows.find((row) => row.horizon === crossoverHorizon)?.unionSize ?? 0,
    };
}

/* ------------------------------------------------------------------ *
 * 15. Bandt-Pompe ordinal permutation motifs
 * ------------------------------------------------------------------ */

/** The six ordinal motifs of a three-symbol window, in lexicographic order. */
export const ORDINAL_MOTIF_LABELS = ["123", "132", "213", "231", "312", "321"] as const;

export const ORDINAL_MOTIF_GLYPHS = ["↗↗↗", "↗↗↘", "↗↘↗", "↘↗↗", "↗↘↘", "↘↘↘"] as const;

/** The rank of a permutation of `d` distinct values, in lexicographic order. */
const factorial = (n: number): number => {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
};

/** The Lehmer code of a permutation — its index in lexicographic order. */
const lehmerRank = (pattern: readonly number[]): number => {
    let rank = 0;
    for (let i = 0; i < pattern.length; i += 1) {
        let smaller = 0;
        for (let j = i + 1; j < pattern.length; j += 1) if (pattern[j] < pattern[i]) smaller += 1;
        rank += smaller * factorial(pattern.length - i - 1);
    }
    return rank;
};

/** The ordinal pattern of a window: which position holds the smallest value. */
const ordinalPattern = (values: readonly number[]): number[] => {
    const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const pattern = new Array<number>(values.length);
    order.forEach((entry, rank) => {
        pattern[entry.index] = rank;
    });
    return pattern;
};

/** The rank of a window's ordinal pattern, in lexicographic order. */
const permutationRank = (values: readonly number[]): number => lehmerRank(ordinalPattern(values));

/** The counts of every d-length ordinal motif in a stream. */
export function bandtPompeMotifs(stream: readonly number[], d: number): number[] {
    const counts = new Array<number>(factorial(d)).fill(0);
    for (let i = 0; i + d <= stream.length; i += 1) {
        const window = stream.slice(i, i + d);
        if (new Set(window).size !== d) continue;
        counts[permutationRank(window)] += 1;
    }
    return counts;
}

export interface OrdinalPermutationEntropyStats {
    /** The motif counts for d = 3, in lexicographic order. */
    motifCounts: number[];
    /** The observed share of each d = 3 motif. */
    motifShares: number[];
    /** The exact i.i.d. share of each d = 3 motif, 1/6. */
    motifNull: number;
    /** The normalized d = 4 permutation entropy, in [0, 1]. */
    entropyD4: number;
    /** The normalized d = 3 permutation entropy, in [0, 1]. */
    entropyD3: number;
    /** The ordinal state of the latest three draws, as a 6-way label. */
    trailingMotif: string;
    /** The trailing motif index, 0..5. */
    trailingMotifIndex: number;
}

export function computeOrdinalPermutationEntropyStats(draws: readonly Draw[]): OrdinalPermutationEntropyStats {
    const sums = draws.map((draw) => draw.numbers.reduce((acc, n) => acc + n, 0));
    const motifCounts = bandtPompeMotifs(sums, 3);
    const total = motifCounts.reduce((acc, count) => acc + count, 0) || 1;

    const d4Counts = bandtPompeMotifs(sums, 4);
    const entropyOf = (counts: number[], count: number): number => {
        if (count === 0) return 0;
        const totalCount = counts.reduce((acc, value) => acc + value, 0);
        if (totalCount === 0) return 0;
        let entropy = 0;
        for (const value of counts) {
            if (value === 0) continue;
            const p = value / totalCount;
            entropy -= p * Math.log(p);
        }
        return entropy / Math.log(count);
    };

    // The trailing state: the ordinal motif of the last three draw sums.
    let trailingMotifIndex = 0;
    if (sums.length >= 3) {
        const window = sums.slice(-3);
        trailingMotifIndex = new Set(window).size === 3 ? permutationRank(window) : 0;
    }

    return {
        motifCounts,
        motifShares: motifCounts.map((count) => count / total),
        motifNull: 1 / 6,
        entropyD4: entropyOf(d4Counts, 24),
        entropyD3: entropyOf(motifCounts, 6),
        trailingMotif: ORDINAL_MOTIF_LABELS[trailingMotifIndex],
        trailingMotifIndex,
    };
}

/* ------------------------------------------------------------------ *
 * 16. Jensen-Shannon distributional turnover
 * ------------------------------------------------------------------ */

export interface JensenShannonRow {
    label: string;
    /** The divergence between the fast and baseline windows, in bits. */
    divergence: number;
    /** The Jaccard distance between the two windows' ball sets. */
    jaccard: number;
}

export interface BallMover {
    ball: number;
    /** The share change between the fast and the baseline window. */
    shareDelta: number;
}

export interface JensenShannonTurnoverStats {
    rows: JensenShannonRow[];
    /** The mean divergence over the sliding windows. */
    meanDivergence: number;
    /** The median divergence of the structurally matched null. */
    nullMedian: number;
    /** The 5th percentile of the null. */
    nullP5: number;
    /** The 95th percentile of the null. */
    nullP95: number;
    /** The share of windows whose divergence exceeds the null median. */
    aboveNullShare: number;
    /** The Jaccard turnover rate. */
    jaccardRate: number;
    /** The balls whose share rose most in the fast window. */
    topGainers: BallMover[];
    /** The balls whose share fell most in the fast window. */
    topLosers: BallMover[];
    /** The live divergence. */
    latestDivergence: number;
}

/** The Jensen-Shannon divergence of two 49-bucket distributions, in bits. */
export function jensenShannonBits(left: Float64Array, right: Float64Array): number {
    let divergence = 0;
    for (let i = 0; i < POOL; i += 1) {
        const p = left[i];
        const q = right[i];
        const m = (p + q) / 2;
        if (p > 0 && m > 0) divergence += 0.5 * p * Math.log2(p / m);
        if (q > 0 && m > 0) divergence += 0.5 * q * Math.log2(q / m);
    }
    return divergence;
}

export function computeJensenShannonTurnoverStats(draws: readonly Draw[]): JensenShannonTurnoverStats {
    const fastWindow = 15;
    const baseWindow = 45;

    const sharesOf = (window: readonly Draw[]): Float64Array => {
        const counts = new Float64Array(POOL);
        for (const draw of window) for (const ball of draw.numbers) counts[ball - 1] += 1;
        const total = window.length * PICKS || 1;
        for (let i = 0; i < POOL; i += 1) counts[i] /= total;
        return counts;
    };

    const rows: JensenShannonRow[] = [];
    let jaccardTotal = 0;
    let divergenceTotal = 0;

    for (let t = baseWindow; t < draws.length; t += 1) {
        const fast = draws.slice(t - fastWindow, t);
        const base = draws.slice(t - baseWindow, t);
        const fastShares = sharesOf(fast);
        const baseShares = sharesOf(base);
        const divergence = jensenShannonBits(fastShares, baseShares);

        const fastSet = new Set(fast.flatMap((draw) => draw.numbers));
        const baseSet = new Set(base.flatMap((draw) => draw.numbers));
        const union = new Set([...fastSet, ...baseSet]);
        const intersection = [...fastSet].filter((ball) => baseSet.has(ball)).length;
        const jaccard = union.size > 0 ? 1 - intersection / union.size : 0;

        rows.push({ label: String(draws[t - 1].draw), divergence, jaccard });
        jaccardTotal += jaccard;
        divergenceTotal += divergence;
    }

    // The finite-window null. The observed statistic compares the last 15
    // draws against the 45 that contain them, so the null has to nest the
    // same way: 45 draws sampled from the archive's own pooled distribution,
    // with the last 15 of them compared against all 45. Sampling two
    // INDEPENDENT windows instead would put the null on a different scale
    // than the observation, and the gap between them would mean nothing.
    const pooled = sharesOf(draws);
    const rng = seededRandom(0x51f7);
    const nulls: number[] = [];
    for (let trial = 0; trial < 400; trial += 1) {
        const baseCounts = new Float64Array(POOL);
        const fastCounts = new Float64Array(POOL);
        for (let k = 0; k < baseWindow; k += 1) {
            const drawCounts = new Float64Array(POOL);
            for (let i = 0; i < PICKS; i += 1) {
                let u = rng();
                let ball = 1;
                for (; ball < POOL; ball += 1) {
                    u -= pooled[ball - 1];
                    if (u <= 0) break;
                }
                drawCounts[Math.min(ball, POOL) - 1] += 1;
                baseCounts[Math.min(ball, POOL) - 1] += 1;
            }
            if (k >= baseWindow - fastWindow) {
                for (let i = 0; i < POOL; i += 1) fastCounts[i] += drawCounts[i];
            }
        }
        const baseShares = new Float64Array(POOL);
        for (let i = 0; i < POOL; i += 1) baseShares[i] = baseCounts[i] / (baseWindow * PICKS);
        const fastShares = new Float64Array(POOL);
        for (let i = 0; i < POOL; i += 1) fastShares[i] = fastCounts[i] / (fastWindow * PICKS);
        nulls.push(jensenShannonBits(fastShares, baseShares));
    }
    nulls.sort((a, b) => a - b);
    const nullQuantile = (q: number): number => nulls[Math.min(nulls.length - 1, Math.floor(q * nulls.length))] ?? 0;
    const nullP5 = nullQuantile(0.05);
    const nullMedian = nullQuantile(0.5);
    const nullP95 = nullQuantile(0.95);

    // The live movers: the fast window against the baseline window.
    const liveFast = sharesOf(draws.slice(-fastWindow));
    const liveBase = sharesOf(draws.slice(-baseWindow));
    const movers: BallMover[] = [];
    for (let ball = 1; ball <= POOL; ball += 1) {
        movers.push({ ball, shareDelta: liveFast[ball - 1] - liveBase[ball - 1] });
    }

    const count = rows.length || 1;
    const aboveNullShare = count > 0 ? rows.filter((row) => row.divergence > nullMedian).length / count : 0;
    return {
        rows,
        meanDivergence: divergenceTotal / count,
        nullMedian,
        nullP5,
        nullP95,
        aboveNullShare,
        jaccardRate: jaccardTotal / count,
        topGainers: [...movers].sort((a, b) => b.shareDelta - a.shareDelta).slice(0, 6),
        topLosers: [...movers].sort((a, b) => a.shareDelta - b.shareDelta).slice(0, 6),
        latestDivergence: rows.length > 0 ? rows[rows.length - 1].divergence : 0,
    };
}

/* ================================================================== *
 * PART 3 — The live candidate deep-scan
 * ================================================================== */

export interface CandidateSequenceDeepScan {
    /** True once six balls are selected. */
    isReady: boolean;
    /** The sorted, de-duplicated candidate line. */
    sortedLine: number[];
    /** The joint Mahalanobis distance of the six core balls. */
    mahalanobisD2: number;
    /** 100 * P(chi-square(6) >= D^2). */
    mahalanobisTypicalPct: number;
    /** The net gap curvature. */
    curvatureKappa: number;
    /** Convex Fan / Balanced / Concave Funnel. */
    curvatureRegime: CurvatureRegime;
    /** The zigzag sign-flip count, 0..3. */
    zigzagFlips: number;
    /** |A+A|. */
    sidonSumset: number;
    /** The additive collisions, 21 - |A+A|. */
    sidonCollisions: number;
    /** The exact 6-node Euclidean MST length. */
    mstLength: number;
    /** The radius of gyration on the 7x7 playslip. */
    gyrationRadius: number;
    /** How many of the fifteen pairs are coprime. */
    coprimePairs: number;
    /** The largest cyclic Z_49 gap. */
    torusMaxGap: number;
    /** The mean internal co-occurrence Z of the line. */
    subgraphPairZ: number;
    /** The 6x6 incoming lag-1 lift from the previous draw. */
    incomingMarkovLift: number;
    /** How many of the six balls came out of the trailing five-draw union. */
    union5Carry: number;
    /** How many of the six balls came from the untouched cold pool. */
    union5Fresh: number;
}

/** How many past draws the live deep-scan reads for its archive fields. */
const DEEP_SCAN_WINDOW = 250;

/**
 * The live sequence deep-scan of a candidate line: six geometry metrics
 * from the line itself plus four archive metrics read from the tail of the
 * archive. The archive fields read a bounded trailing window only, so the
 * whole scan stays under a millisecond.
 */
export function evaluateCandidateSequenceDeepScan(
    line: readonly number[],
    draws: readonly Draw[] = [],
): CandidateSequenceDeepScan {
    const sortedLine = sortedUniqueLine(line);
    const empty: CandidateSequenceDeepScan = {
        isReady: false,
        sortedLine,
        mahalanobisD2: 0,
        mahalanobisTypicalPct: 0,
        curvatureKappa: 0,
        curvatureRegime: "Balanced",
        zigzagFlips: 0,
        sidonSumset: 0,
        sidonCollisions: 0,
        mstLength: 0,
        gyrationRadius: 0,
        coprimePairs: 0,
        torusMaxGap: 0,
        subgraphPairZ: 0,
        incomingMarkovLift: 0,
        union5Carry: 0,
        union5Fresh: 0,
    };

    if (sortedLine.length < LINE_SIZE) return empty;
    const core = sortedLine.slice(0, LINE_SIZE);

    const profile = gapProfileOf(core);
    const sidon = sidonSumsetOf(core);
    const constellation = constellationOf(core);

    let coprimePairs = 0;
    for (let i = 0; i < core.length; i += 1) {
        for (let j = i + 1; j < core.length; j += 1) {
            if (greatestCommonDivisor(core[i], core[j]) === 1) coprimePairs += 1;
        }
    }

    const d2 = mahalanobisD2(core);

    // The archive fields — bounded trailing window only.
    const window = draws.slice(-DEEP_SCAN_WINDOW);
    let subgraphPairZ = 0;
    let incomingMarkovLift = 0;
    if (window.length >= 2) {
        const table = pairMeetingTable(window);
        const expected = (window.length * PAIR_COUNT) / POOL_PAIR_COUNT;
        const sd = Math.sqrt(
            Math.max(1e-9, window.length * (PAIR_COUNT / POOL_PAIR_COUNT) * (1 - PAIR_COUNT / POOL_PAIR_COUNT)),
        );
        let zTotal = 0;
        for (let i = 0; i < core.length; i += 1) {
            for (let j = i + 1; j < core.length; j += 1) {
                const observed = table[(core[i] - 1) * POOL + (core[j] - 1)];
                zTotal += (observed - expected) / sd;
            }
        }
        subgraphPairZ = zTotal / PAIR_COUNT;

        const previous = sortedUniqueLine(draws[draws.length - 1].numbers);
        for (const from of previous) {
            for (const to of core) {
                if (from !== to) incomingMarkovLift += 1;
            }
        }
    }

    // The trailing five-draw union: how much of the candidate is recycled.
    const union5 = new Set<number>();
    for (let back = 1; back <= 5; back += 1) {
        const draw = draws[draws.length - back];
        if (!draw) break;
        for (const ball of draw.numbers) union5.add(ball);
    }
    let union5Carry = 0;
    for (const ball of core) if (union5.has(ball)) union5Carry += 1;

    return {
        isReady: true,
        sortedLine: core,
        mahalanobisD2: d2,
        mahalanobisTypicalPct: mahalanobisTypicalPct(d2),
        curvatureKappa: profile.kappa,
        curvatureRegime: profile.regime,
        zigzagFlips: profile.zigzagFlips,
        sidonSumset: sidon.distinctSums,
        sidonCollisions: sidon.collisions,
        mstLength: constellation.mstLength,
        gyrationRadius: constellation.gyrationRadius,
        coprimePairs,
        torusMaxGap: Math.max(...cyclicGaps49(core)),
        subgraphPairZ,
        incomingMarkovLift,
        union5Carry,
        union5Fresh: LINE_SIZE - union5Carry,
    };
}
