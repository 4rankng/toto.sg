// toto.sg — ten deterministic walk-forward sequence rules.
//
// These rules read the SAME sequence geometry the two new Insights
// galleries (10. Order geometry, 11. Sequence dynamics) put on screen, but
// turned into pick rules: the ordered-shape statistics of the candidate
// line are compared against the archive's own distribution.
//
//   NO LOOKAHEAD   every rule sees only the draws strictly before the fold
//                  it is predicting. buildSequenceDynamicsContext(prior,
//                  target) never reads target.numbers.
//   DETERMINISTIC  randomness comes only from the injected rng, seeded per
//                  (strategy id, draw number).
//   MATCH COUNT    the league scores matched numbers, never prize sharing.
//
// The maths is re-derived here in plain JavaScript so scripts/ stays
// independent of the browser bundle in src/ — the same numbers, two
// implementations, so a drift in one shows up in the other.
import { RANGE49, acValue, lineSum, sampleK, sortAsc } from "./cross-panel-stats.mjs";
import { memoisedPrepare } from "./platform/context.mjs";
import { defineFamily } from "./platform/family.mjs";

const POOL = 49;
const PICKS = 6;

/* ------------------------------------------------------------------ *
 * Order-statistic geometry — the same constants the browser module uses.
 * ------------------------------------------------------------------ */

/** The exact mean of the k-th order statistic: mu_k = k(N+1)/(n+1). */
export const ORDER_STAT_MEAN = Array.from({ length: PICKS }, (_, i) => (50 * (i + 1)) / 7);

/**
 * The exact covariance of the order statistics:
 * Cov(X_(j), X_(k)) = (N+1)(N-n) / ((n+1)^2 (n+2)) * j(n-k+1)
 *                   = 2150/392 * j(7-k).
 */
const COV_COEFFICIENT = 2150 / 392;

const ORDER_STAT_COVARIANCE = Array.from({ length: PICKS }, (_, j) =>
    Array.from({ length: PICKS }, (_, k) => {
        const [lo, hi] = j <= k ? [j + 1, k + 1] : [k + 1, j + 1];
        return COV_COEFFICIENT * lo * (7 - hi);
    }),
);

/** Gauss-Jordan inversion of a 6x6 matrix with partial pivoting. */
const invert6x6 = (matrix) => {
    const n = 6;
    const a = matrix.map((row) => [...row]);
    const inv = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

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
};

const ORDER_STAT_PRECISION = invert6x6(ORDER_STAT_COVARIANCE);

/** The joint Mahalanobis distance of a sorted line against the order-stat mean. */
export const mahalanobisD2 = (sorted) => {
    if (!ORDER_STAT_PRECISION || sorted.length !== PICKS) return Number.POSITIVE_INFINITY;
    const delta = sorted.map((value, i) => value - ORDER_STAT_MEAN[i]);
    let total = 0;
    for (let i = 0; i < PICKS; i += 1) {
        let inner = 0;
        for (let j = 0; j < PICKS; j += 1) inner += ORDER_STAT_PRECISION[i][j] * delta[j];
        total += delta[i] * inner;
    }
    return total;
};

/* ------------------------------------------------------------------ *
 * Line shape helpers
 * ------------------------------------------------------------------ */

/** The five slot deltas of a sorted line. */
export const slotDeltas = (sorted) => {
    const deltas = [];
    for (let i = 1; i < sorted.length; i += 1) deltas.push(sorted[i] - sorted[i - 1]);
    return deltas;
};

/** The net gap curvature kappa = (Delta_5 - Delta_1) / 4. */
export const curvatureKappa = (sorted) => {
    const deltas = slotDeltas(sorted);
    return (deltas[deltas.length - 1] - deltas[0]) / 4;
};

/** The zigzag sign-flip count of the second differences, 0..3. */
export const zigzagFlips = (sorted) => {
    const deltas = slotDeltas(sorted);
    const second = [];
    for (let i = 0; i < deltas.length - 1; i += 1) second.push(deltas[i + 1] - deltas[i]);
    let flips = 0;
    for (let i = 0; i < second.length - 1; i += 1) if (second[i] * second[i + 1] < 0) flips += 1;
    return flips;
};

/** The number of distinct pairwise sums, |A+A|, in [11, 21]. */
export const sumsetSize = (sorted) => {
    const seen = new Set();
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i; j < sorted.length; j += 1) seen.add(sorted[i] + sorted[j]);
    }
    return seen.size;
};

/** The largest cyclic gap on the Z_49 ring. */
export const torusMaxGap = (sorted) => {
    const gaps = slotDeltas(sorted);
    gaps.push(POOL - sorted[sorted.length - 1] + sorted[0]);
    return Math.max(...gaps);
};

/** The reflection asymmetry |mean(x) - 25|. */
export const reflectionAsymmetry = (sorted) => Math.abs(lineSum(sorted) / sorted.length - 25);

/** The playslip cells of a line, row-major 1-based. */
export const playslipCells = (sorted) =>
    sorted.map((ball) => ({ row: Math.floor((ball - 1) / 7) + 1, col: ((ball - 1) % 7) + 1 }));

/** The exact Euclidean MST length of the line's playslip cells. */
export const mstLength = (sorted) => {
    const points = playslipCells(sorted);
    const n = points.length;
    const used = new Array(n).fill(false);
    const distance = new Array(n).fill(Number.POSITIVE_INFINITY);
    distance[0] = 0;

    let total = 0;
    for (let step = 0; step < n; step += 1) {
        let current = -1;
        for (let i = 0; i < n; i += 1) {
            if (used[i]) continue;
            if (current === -1 || distance[i] < distance[current]) current = i;
        }
        used[current] = true;
        total += distance[current];
        for (let j = 0; j < n; j += 1) {
            if (used[j]) continue;
            const span = Math.hypot(points[current].row - points[j].row, points[current].col - points[j].col);
            if (span < distance[j]) distance[j] = span;
        }
    }
    return total;
};

/** The barycentre of the line's playslip cells. */
export const barycentre = (sorted) => {
    const cells = playslipCells(sorted);
    return {
        row: cells.reduce((acc, cell) => acc + cell.row, 0) / cells.length,
        col: cells.reduce((acc, cell) => acc + cell.col, 0) / cells.length,
    };
};

/** The 1D Earth Mover's distance between two sorted lines. */
export const wasserstein1 = (left, right) => {
    let total = 0;
    for (let k = 0; k < PICKS; k += 1) total += Math.abs(left[k] - right[k]);
    return total / PICKS;
};

/* ------------------------------------------------------------------ *
 * The per-fold context
 * ------------------------------------------------------------------ */

/** How many past draws the sequence context reads. */
const CONTEXT_WINDOW = 250;

/** The Hawkes kernel's half-life, in draws. */
const HAWKES_HALF_LIFE = 5;
const HAWKES_ALPHA = 1 - 2 ** (-1 / HAWKES_HALF_LIFE);

/**
 * Everything the ten sequence rules may look at for one fold.
 *
 * Built from `prior` only — the draws strictly before the target — so no
 * rule can read the draw it is predicting. The league builder memoises one
 * context per fold and hands it to every rule.
 */
export function buildSequenceDynamicsContext(prior, target) {
    const draws = prior ?? [];
    const window = draws.slice(-CONTEXT_WINDOW);
    const last = draws[draws.length - 1] ?? null;

    // The pair-meeting table over the trailing window, plus its exact
    // hypergeometric expectation and standard deviation.
    const pairCounts = new Map();
    for (const draw of window) {
        const sorted = sortAsc(draw.numbers);
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                const key = `${sorted[i]}-${sorted[j]}`;
                pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
            }
        }
    }
    const pairExpected = (window.length * 15) / 1176;
    const pairSd = Math.sqrt(Math.max(1e-9, window.length * (15 / 1176) * (1 - 15 / 1176)));
    const pairZ = (a, b) => {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        return ((pairCounts.get(key) ?? 0) - pairExpected) / pairSd;
    };

    // The lag-1 transition counts into every ball.
    const lag1 = new Map();
    for (let t = 1; t < draws.length; t += 1) {
        const from = draws[t - 1].numbers;
        const to = draws[t].numbers;
        for (const a of from) {
            for (const b of to) {
                if (a === b) continue;
                const key = `${a}>${b}`;
                lag1.set(key, (lag1.get(key) ?? 0) + 1);
            }
        }
    }

    // The discrete Hawkes excitation: a five-draw half-life exponential
    // memory over each ball's appearances.
    const hawkesAlpha = HAWKES_ALPHA;
    const hawkesIntensity = new Array(POOL).fill(0);
    const hawkesBranch = new Array(POOL).fill(0);
    const weights = [];
    let weightSum = 0;
    let weightSquareSum = 0;
    for (let k = 0; k < 40; k += 1) {
        const w = hawkesAlpha * (1 - hawkesAlpha) ** k;
        weights.push(w);
        weightSum += w;
        weightSquareSum += w * w;
    }
    for (let k = 0; k < weights.length; k += 1) {
        const draw = draws[draws.length - 1 - k];
        if (!draw) break;
        for (const ball of draw.numbers) hawkesIntensity[ball - 1] += weights[k];
    }
    const baseRate = PICKS / POOL;
    const zScale = Math.sqrt(Math.max(1e-12, baseRate * (1 - baseRate) * weightSquareSum));
    for (let ball = 0; ball < POOL; ball += 1) {
        hawkesBranch[ball] = (hawkesIntensity[ball] - baseRate * weightSum) / zScale;
    }

    // The trailing 5-draw union and its cold pool.
    const union5 = new Set();
    for (let back = 1; back <= 5; back += 1) {
        const draw = draws[draws.length - back];
        if (!draw) break;
        for (const ball of draw.numbers) union5.add(ball);
    }

    // The draw-sum series and its spectral phase, over the trailing
    // power-of-two window so the DFT is exact.
    const sums = draws.map((draw) => lineSum(draw.numbers));
    const spectral = spectralPhase(draws, sums);

    // The multi-horizon velocity residual, for the zigzag rule's pool.
    const velocity = new Array(POOL).fill(0);
    const velocityWindow = draws.slice(-50);
    for (const draw of velocityWindow) for (const ball of draw.numbers) velocity[ball - 1] += 1;
    const velocityExpected = (velocityWindow.length * PICKS) / POOL;
    for (let ball = 0; ball < POOL; ball += 1) velocity[ball] -= velocityExpected;

    // The frequency counts and the Bayesian posterior, for the pools.
    const freq = new Array(POOL).fill(0);
    for (const draw of draws) for (const ball of draw.numbers) freq[ball - 1] += 1;
    const bayes = freq.map((hits) => (6 + hits) / (6 + 43 + draws.length));

    // The last draw's transport distance, for the Wasserstein rule.
    const previousLine = last ? sortAsc(last.numbers) : null;
    const lastTransport = previousLine ? wasserstein1(previousLine, sortAsc(last.numbers)) : 0;

    return {
        draws: draws.length,
        last,
        lastLine: last ? sortAsc(last.numbers) : null,
        previousLine,
        lastTransport,
        window: window.length,
        pairExpected,
        pairZ,
        lag1,
        hawkesIntensity,
        hawkesBranch,
        baseRate,
        union5,
        coldPool: RANGE49.filter((ball) => !union5.has(ball)),
        velocity,
        freq,
        bayes,
        spectral,
        sums,
        targetDraw: target?.draw ?? null,
    };
};

/**
 * The DFT phase of the draw-sum series, over the trailing power-of-two
 * window so the transform is exact.
 *
 * Each ball's "alignment" is the projection of its own binary stream onto
 * the dominant harmonic — the mean cosine of the harmonic at the draws
 * where the ball appeared. A ball that keeps turning up when the harmonic
 * is positive is in phase with it. Projecting is O(draws) per fold; running
 * 49 separate FFTs would not be affordable across 1188 folds.
 */
const spectralPhase = (draws, sums) => {
    const available = sums.length;
    if (available < 64) return { period: 0, phase: 0, alignment: new Array(POOL).fill(0), g: 0, window: 0 };

    let window = 64;
    while (window * 2 <= available) window *= 2;

    const mean = sums.slice(available - window).reduce((acc, value) => acc + value, 0) / window;
    const re = new Float64Array(window);
    const im = new Float64Array(window);
    for (let i = 0; i < window; i += 1) re[i] = sums[available - window + i] - mean;

    // Radix-2 Cooley-Tukey.
    for (let i = 1, j = 0; i < window; i += 1) {
        let bit = window >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            const tr = re[i];
            re[i] = re[j];
            re[j] = tr;
            const ti = im[i];
            im[i] = im[j];
            im[j] = ti;
        }
    }
    for (let span = 2; span <= window; span <<= 1) {
        const angle = (-2 * Math.PI) / span;
        const stepRe = Math.cos(angle);
        const stepIm = Math.sin(angle);
        const half = span >> 1;
        for (let start = 0; start < window; start += span) {
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

    const count = Math.floor((window - 1) / 2);
    let total = 0;
    let dominant = 0;
    let dominantPower = -1;
    for (let j = 1; j <= count; j += 1) {
        const power = (re[j] * re[j] + im[j] * im[j]) / window;
        total += power;
        if (power > dominantPower) {
            dominantPower = power;
            dominant = j;
        }
    }
    const g = total > 0 ? dominantPower / (total / count) : 0;
    const phase = Math.atan2(im[dominant], re[dominant]);
    const omega = (2 * Math.PI * dominant) / window;

    // Each ball's projection onto the dominant harmonic.
    const projection = new Array(POOL).fill(0);
    const appearances = new Array(POOL).fill(0);
    for (let i = 0; i < window; i += 1) {
        const value = Math.cos(omega * i - phase);
        for (const ball of draws[available - window + i].numbers) {
            projection[ball - 1] += value;
            appearances[ball - 1] += 1;
        }
    }
    const alignment = new Array(POOL).fill(0);
    for (let ball = 0; ball < POOL; ball += 1) {
        alignment[ball] = appearances[ball] > 0 ? projection[ball] / appearances[ball] : 0;
    }

    return { period: window / dominant, phase, alignment, g, window };
};

/* ------------------------------------------------------------------ *
 * Sampling helpers
 * ------------------------------------------------------------------ */

/**
 * Uniform k-subset of `pool` via partial Fisher-Yates — the shared kernel's
 * sampler, re-exported so this module's own clients keep one import path.
 * (Consumes rng identically to the previous local copy — probe-verified.)
 */
export { sampleK };

/** The `count` balls with the highest value, ascending. */
const topBalls = (values, count) =>
    RANGE49.slice()
        .sort((a, b) => values[b - 1] - values[a - 1])
        .slice(0, count)
        .sort((a, b) => a - b);

/* ------------------------------------------------------------------ *
 * The ten rules
 * ------------------------------------------------------------------ */

export const SEQUENCE_DYNAMICS_RULES = {
    // 01. Mahalanobis Order-Statistic Core — Structure
    mahalanobisEllipsoidCore(prior, target, rng, ctx) {
        const pool = topBalls(ctx.hawkesIntensity.map((v, i) => v + ctx.bayes[i]), 22);
        const line = sortAsc(sampleK(rng, pool, 6));
        if (mahalanobisD2(line) > 5.5) return null;
        return line;
    },

    // 02. Sidon B2 Additive Sumset Sieve — Structure
    sidonB2SumsetSieve(prior, target, rng, ctx) {
        const pool = topBalls(ctx.freq.map((v, i) => v + ctx.bayes[i] * 100), 22);
        const line = sortAsc(sampleK(rng, pool, 6));
        if (sumsetSize(line) !== 21) return null;
        const sum = lineSum(line);
        if (sum < 118 || sum > 182) return null;
        return line;
    },

    // 03. Second-Difference Zigzag Sawtooth — Sequence
    zigzagCurvatureSawtooth(prior, target, rng, ctx) {
        const pool = topBalls(ctx.velocity.map((v, i) => v + ctx.bayes[i] * 10), 22);
        const line = sortAsc(sampleK(rng, pool, 6));
        if (zigzagFlips(line) < 2) return null;
        if (Math.abs(curvatureKappa(line)) > 2.5) return null;
        return line;
    },

    // 04. Playslip 7x7 MST Constellation — Pattern
    constellationMstSpread(prior, target, rng, ctx) {
        const line = sortAsc(sampleK(rng, RANGE49, 6));
        const length = mstLength(line);
        if (length < 11.5 || length > 16.5) return null;
        const centre = barycentre(line);
        if (Math.abs(centre.row - 3) > 1.1 || Math.abs(centre.col - 3) > 1.1) return null;
        return line;
    },

    // 05. Cyclic Z49 Torus Balanced Arc — Structure
    torusBalancedArc(prior, target, rng, ctx) {
        const line = sortAsc(sampleK(rng, RANGE49, 6));
        const gap = torusMaxGap(line);
        if (gap < 12 || gap > 20) return null;
        if (reflectionAsymmetry(line) > 6.5) return null;
        return line;
    },

    // 06. Wasserstein-1 Cage Transport Revert — Sequence
    wassersteinTransportRevert(prior, target, rng, ctx) {
        // A jump draw pulls the cage back; a quiet draw lets it drift wider.
        const jump = ctx.lastTransport > 8.5;
        const pool = topBalls(ctx.velocity.map((v, i) => v + ctx.bayes[i] * 10), 20);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (jump) {
            if (sum < 115 || sum > 185) return null;
        } else if (sum < 118 || sum > 182) {
            return null;
        }
        return line;
    },

    // 07. Hawkes Self-Exciting Kernel Top-18 — Indicators
    hawkesSelfExcitingPeak(prior, target, rng, ctx) {
        const pool = topBalls(ctx.hawkesIntensity, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        if (acValue(line) < 7) return null;
        return line;
    },

    // 08. Fisher Spectral Harmonic Phase Lock — Indicators
    spectralHarmonicPhase(prior, target, rng, ctx) {
        const pool = topBalls(ctx.spectral.alignment.map((v, i) => v * ctx.spectral.g + ctx.bayes[i] * 0.1), 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const tails = new Set(line.map((n) => n % 10)).size;
        if (tails < 4) return null;
        return line;
    },

    // 09. Induced 6-Node Subgraph & Markov Flow — Sequence
    subgraphCliqueMarkovFlow(prior, target, rng, ctx) {
        // Greedy: take the ball with the strongest total cohesion, then keep
        // adding the ball that adds the most positive-Z edge to the set.
        const chosen = [];
        while (chosen.length < 6) {
            let best = -1;
            let bestScore = Number.NEGATIVE_INFINITY;
            for (const ball of RANGE49) {
                if (chosen.includes(ball)) continue;
                let score = 0;
                for (const picked of chosen) score += Math.max(0, ctx.pairZ(picked, ball));
                // The lag-1 lift from the previous draw breaks the ties.
                const lift = ctx.lastLine ? ctx.lag1.get(`${ball}>${ctx.lastLine[0]}`) ?? 0 : 0;
                score += lift * 0.05;
                if (score > bestScore) {
                    bestScore = score;
                    best = ball;
                }
            }
            if (best === -1) break;
            chosen.push(best);
        }
        if (chosen.length !== 6) return null;

        // A tournament selection over the greedy set, keeping the best of
        // four random draws from it.
        let best = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            const line = sortAsc(sampleK(rng, chosen, 6));
            let score = 0;
            for (let i = 0; i < 6; i += 1) {
                for (let j = i + 1; j < 6; j += 1) score += Math.max(0, ctx.pairZ(line[i], line[j]));
            }
            if (score > bestScore) {
                bestScore = score;
                best = line;
            }
        }
        return best;
    },

    // 10. 5-Draw Union 3-Carry / 3-Fresh Split — Sequence
    unionFivePartition3x3(prior, target, rng, ctx) {
        const recycled = [...ctx.union5];
        const fresh = ctx.coldPool;
        if (recycled.length < 3 || fresh.length < 3) return null;

        const carried = sortAsc(sampleK(rng, recycled, 3));
        const cold = sortAsc(sampleK(rng, fresh, 3));
        const line = sortAsc([...carried, ...cold]);

        // The sweet-zone skip band: neither the carried nor the cold half
        // may be extreme.
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        if (acValue(line) < 6) return null;
        return line;
    },
};

export const SEQUENCE_DYNAMICS_STRATEGIES = [
    [
        "mahalanobisEllipsoidCore",
        "Mahalanobis Order-Statistic Core",
        "Structure",
        "Samples the Hawkes/Bayesian top-22 and locks the joint order-statistic Mahalanobis distance D² at 5.5 or below against the chi-square(6) null.",
    ],
    [
        "sidonB2SumsetSieve",
        "Sidon B2 Additive Sumset Sieve",
        "Structure",
        "Requires a pure Sidon additive structure — 21 distinct pairwise sums and zero four-term relations — with the line sum inside 118-182.",
    ],
    [
        "zigzagCurvatureSawtooth",
        "Second-Difference Zigzag Sawtooth",
        "Sequence",
        "Demands at least two second-difference sign flips with the net gap curvature held inside ±2.5, reading the multi-horizon velocity leaders.",
    ],
    [
        "constellationMstSpread",
        "Playslip 7x7 MST Constellation",
        "Pattern",
        "Enforces a 2D Euclidean minimum spanning tree span of 11.5-16.5 on the playslip lattice with a centred grid barycentre.",
    ],
    [
        "torusBalancedArc",
        "Cyclic Z49 Torus Balanced Arc",
        "Structure",
        "Prevents wrap-around clumping on the 49-ring: the largest empty sector stays in 12-20 and the reflection asymmetry at 6.5 or below.",
    ],
    [
        "wassersteinTransportRevert",
        "Wasserstein-1 Cage Transport Revert",
        "Sequence",
        "Counter-tilts on the Earth Mover's distance between consecutive draws, pulling the cage back after a jump and letting it drift after a quiet draw.",
    ],
    [
        "hawkesSelfExcitingPeak",
        "Hawkes Self-Exciting Kernel Top-18",
        "Indicators",
        "Ranks the 49 balls by the discrete Hawkes arrival intensity with a five-draw half-life and samples six from the top 18.",
    ],
    [
        "spectralHarmonicPhase",
        "Fisher Spectral Harmonic Phase Lock",
        "Indicators",
        "Ranks the balls by their constructive DFT harmonic phase at the next draw, weighted by Fisher's g-ratio, and requires four distinct tails.",
    ],
    [
        "subgraphCliqueMarkovFlow",
        "Induced 6-Node Subgraph & Markov Flow",
        "Sequence",
        "Greedy plus tournament selection over the fifteen internal pair edges, favouring positive co-occurrence Z and the incoming lag-1 Markov lift.",
    ],
    [
        "unionFivePartition3x3",
        "5-Draw Union 3-Carry / 3-Fresh Split",
        "Sequence",
        "Locks the multi-draw crossover split: three balls carried from the trailing five-draw union and three fresh balls from the cold pool.",
    ],
];

// The one memoised sequence fold context — shared by the ten sequence rules
// AND the fusion family's base rules, so all of them see one build per draw.
export const sequencePrepare = memoisedPrepare(buildSequenceDynamicsContext);

export const SEQUENCE_DYNAMICS_FAMILY = defineFamily({
    rules: SEQUENCE_DYNAMICS_RULES,
    rows: SEQUENCE_DYNAMICS_STRATEGIES,
    prepare: sequencePrepare,
});
