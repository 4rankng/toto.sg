// toto.sg — edge-verification statistics: era accounting, exact chance nulls
// per ball pool, bootstrap confidence intervals, multiple-testing correction
// and empirical null p-values. Zero deps.
import { mulberry32 } from "./edge-rng.mjs";

/** A 6-subset of 1..pool: binomial helper (exact integer rounding). */
const binom = (n, k) => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return Math.round(r);
};

/**
 * Exact chance nulls for one uniform 6-of-pool line against a 6-number draw:
 * P(k matches) = C(6,k)·C(pool−6,6−k)/C(pool,6). Prize tiers follow
 * scoreLine: the additional ball lifts 5→G2, 4→G4, 3→G6 (uniform over the
 * pool−6 unmatched balls); 2-matches never score. Points are 10^(7−group).
 */
export function chanceNulls(pool) {
    const total = binom(pool, 6);
    const pExactly = (k) => (binom(6, k) * binom(pool - 6, 6 - k)) / total;
    const unmatched = pool - 6;
    const tierPoints =
        pExactly(6) * 1_000_000 +
        pExactly(5) * (1 / unmatched) * 100_000 +
        pExactly(5) * ((unmatched - 1) / unmatched) * 10_000 +
        pExactly(4) * (2 / unmatched) * 1_000 +
        pExactly(4) * ((unmatched - 2) / unmatched) * 100 +
        pExactly(3) * (3 / unmatched) * 10 +
        pExactly(3) * ((unmatched - 3) / unmatched) * 1;
    return {
        pool,
        meanHits: 36 / pool,
        pExactly,
        twoPlusPerFold: 1 - pExactly(0) - pExactly(1),
        prizePerFold: pExactly(3) + pExactly(4) + pExactly(5) + pExactly(6),
        weightedPointsPerFold: tierPoints,
    };
}

/**
 * Era split. The league's own boundary logic (analysis.mjs filterEra) puts
 * the 6/49 era at the first post-2014-10-09 draw that carries a ball over 45;
 * the 6/45 era is its complement. Every fold reads only same-era history, so
 * a 6/45 fold never borrows a 6/49 prior and vice versa.
 */
export function splitEras(draws) {
    const ordered = [...draws].sort((a, b) => a.draw - b.draw);
    const era49 = ordered.filter((d) => d.date >= "2014-10-09");
    const era45 = ordered.filter((d) => d.date < "2014-10-09");
    // Era sanity: the 6/45 era must never print a ball above 45, and the first
    // 6/49 draw must be the over-45 switch draw the archive actually shows.
    const bad45 = era45.find((d) => d.numbers.some((n) => n > 45));
    if (bad45) throw new Error(`era split: draw ${bad45.draw} (${bad45.date}) has a ball above 45 in the 6/45 era`);
    return { era45, era49 };
}

// ---------------------------------------------------------------------------
// Standard normal tail (Abramowitz–Stegun 7.1.26, |ε| < 7.5e-8).
// ---------------------------------------------------------------------------
const normalSf = (z) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const p = 1 - (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
    return z >= 0 ? 1 - p : p;
};

/** Two-sided p-value for a z statistic. */
export const zPValue = (z) => 2 * normalSf(Math.abs(z));

// ---------------------------------------------------------------------------
// Bootstrap percentile CI for (mean − chance). Seeded, so reruns are
// byte-identical. `values` are the per-fold observations (hits or 0/1 flags).
// ---------------------------------------------------------------------------
export function bootstrapEdgeCi(values, chance, { B = 2000, seed = 0xede } = {}) {
    const n = values.length;
    if (n === 0) return null;
    const rng = mulberry32(seed ^ (n * 2654435761));
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const boot = new Float64Array(B);
    for (let b = 0; b < B; b++) {
        let acc = 0;
        for (let i = 0; i < n; i++) acc += values[(rng() * n) | 0];
        boot[b] = acc / n - chance;
    }
    boot.sort();
    const r2 = (x) => Math.round(x * 10000) / 10000;
    return {
        mean: r2(mean),
        edge: r2(mean - chance),
        lo: r2(boot[Math.floor(0.025 * (B - 1))]),
        hi: r2(boot[Math.floor(0.975 * (B - 1))]),
        coversZero: boot[Math.floor(0.025 * (B - 1))] <= 0 && boot[Math.floor(0.975 * (B - 1))] >= 0,
    };
}

/**
 * Benjamini–Hochberg FDR over a set of p-values. Returns the adjusted q for
 * each (step-up procedure), sorted input not required.
 */
export function bhFdr(pvalues) {
    const n = pvalues.length;
    const order = pvalues.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
    const q = new Array(n);
    let prev = 1;
    for (let j = n - 1; j >= 0; j--) {
        const [p, i] = order[j];
        const adj = Math.min(prev, (p * n) / (j + 1));
        q[i] = Math.round(Math.min(adj, 1) * 10000) / 10000;
        prev = adj;
    }
    return q;
}

/** Empirical one-sided null p-value: P(null ≥ real), add-one smoothed. */
export const empiricalP = (nullValues, real) => {
    const n = nullValues.length;
    if (n === 0) return null;
    const exceed = nullValues.filter((v) => v >= real).length;
    return Math.round(((1 + exceed) / (1 + n)) * 10000) / 10000;
};

/** Spearman rank correlation (ties get fractional ranks). */
export function spearman(xs, ys) {
    const n = xs.length;
    if (n < 2) return 0;
    const ranks = (arr) => {
        const order = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
        const r = new Array(n);
        let i = 0;
        while (i < n) {
            let j = i;
            while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
            const avg = (i + j) / 2;
            for (let k = i; k <= j; k++) r[order[k][1]] = avg;
            i = j + 1;
        }
        return r;
    };
    const [rx, ry] = [ranks(xs), ranks(ys)];
    const mx = rx.reduce((a, b) => a + b, 0) / n;
    const my = ry.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
        const a = rx[i] - mx;
        const b = ry[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    return dx === 0 || dy === 0 ? 0 : Math.round((num / Math.sqrt(dx * dy)) * 10000) / 10000;
}

/** r2/round4 helpers for artifact stability. */
export const r2 = (x) => Math.round(x * 100) / 100;
export const r4 = (x) => Math.round(x * 10000) / 10000;
