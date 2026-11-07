// toto.sg — gambler analytics, statistical correlations, and pari-mutuel metrics.
//
// Every calculator pairs empirical observations from the 6/49 era with exact
// combinatorial expectations under a fair cage, or measures real crowd biases
// in the historical prize distributions (Groups 1–7).
import type { Draw, StrategiesFile } from "@/lib/data";
import { binomial, PICKS, POOL, TOTAL_LINES } from "@/lib/insights-stats";

/* ------------------------------------------------------------------ *
 * Helper math & statistics
 * ------------------------------------------------------------------ */

/** Pearson correlation coefficient between two arrays of equal length. */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return 0;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < n; i += 1) {
        sumX += xs[i];
        sumY += ys[i];
    }
    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i += 1) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
}

/** Standard normal CDF approximation (Hart's algorithm) for p-values. */
export function normalCdf(z: number): number {
    const b1 = 0.31938153;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;
    const c = 0.3989422804014327; // 1 / sqrt(2*pi)

    if (z >= 0) {
        const t = 1 / (1 + p * z);
        return 1 - c * Math.exp((-z * z) / 2) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
    }
    const t = 1 / (1 - p * z);
    return c * Math.exp((-z * z) / 2) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
}

/** Chi-square p-value using Wilson-Hilferty transformation to normal approximation. */
export function chiSquarePValue(chiSq: number, df: number): number {
    if (df <= 0 || chiSq <= 0) return 1;
    // Wilson-Hilferty approximation:
    const z = (Math.pow(chiSq / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
    return Math.max(0, Math.min(1, 1 - normalCdf(z)));
}

/* ------------------------------------------------------------------ *
 * Section 1: The Numbers (Coldest Pairs, Triples, Skip Return Rate)
 * ------------------------------------------------------------------ */

export interface ColdPairRow {
    a: number;
    b: number;
    count: number;
    gap: number;
    expectedCount: number;
}

export interface ColdPairStats {
    coldest: ColdPairRow[];
    longestMissing: ColdPairRow[];
    expectedMeetings: number;
    expectedCycle: number;
    totalPossiblePairs: number;
}

/** Coldest & longest-missing pairs out of all C(49, 2) = 1,176 pairs. */
export function coldPairStats(draws: Draw[]): ColdPairStats {
    const totalPairs = (POOL * (POOL - 1)) / 2; // 1176
    const counts = new Uint16Array(50 * 50);
    const lastSeen = new Int32Array(50 * 50).fill(-1);

    draws.forEach((draw, drawIndex) => {
        const sorted = [...draw.numbers].sort((x, y) => x - y);
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                const idx = sorted[i] * 50 + sorted[j];
                counts[idx] += 1;
                lastSeen[idx] = drawIndex;
            }
        }
    });

    const rows: ColdPairRow[] = [];
    const expectedMeetings = (draws.length * 15) / totalPairs;
    const expectedCycle = totalPairs / 15; // 78.4 draws

    for (let a = 1; a <= POOL; a += 1) {
        for (let b = a + 1; b <= POOL; b += 1) {
            const idx = a * 50 + b;
            const seen = lastSeen[idx];
            const gap = seen === -1 ? draws.length : draws.length - 1 - seen;
            rows.push({
                a,
                b,
                count: counts[idx],
                gap,
                expectedCount: expectedMeetings,
            });
        }
    }

    const coldest = [...rows].sort((x, y) => x.count - y.count || y.gap - x.gap || x.a - y.a || x.b - y.b).slice(0, 10);
    const longestMissing = [...rows].sort((x, y) => y.gap - x.gap || x.count - y.count || x.a - y.a || x.b - y.b).slice(0, 10);

    return {
        coldest,
        longestMissing,
        expectedMeetings,
        expectedCycle,
        totalPossiblePairs: totalPairs,
    };
}

export interface TripleRow {
    a: number;
    b: number;
    c: number;
    count: number;
    expected: number;
}

export interface TripleStats {
    topTriples: TripleRow[];
    totalTriplesInPool: number;
    expectedMeetings: number;
}

/** Most common triples out of C(49, 3) = 18,424 combinations. */
export function tripleStats(draws: Draw[]): TripleStats {
    const totalTriples = binomial(POOL, 3); // 18424
    const tripleMap = new Map<number, number>();

    for (const draw of draws) {
        const sorted = [...draw.numbers].sort((x, y) => x - y);
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                for (let k = j + 1; k < sorted.length; k += 1) {
                    const key = sorted[i] * 2500 + sorted[j] * 50 + sorted[k];
                    tripleMap.set(key, (tripleMap.get(key) ?? 0) + 1);
                }
            }
        }
    }

    const expectedMeetings = (draws.length * 20) / totalTriples; // ~1.34

    const topTriples: TripleRow[] = [...tripleMap.entries()]
        .map(([key, count]) => {
            const a = Math.floor(key / 2500);
            const rem = key % 2500;
            const b = Math.floor(rem / 50);
            const c = rem % 50;
            return { a, b, c, count, expected: expectedMeetings };
        })
        .sort((x, y) => y.count - x.count || x.a - y.a || x.b - y.b || x.c - y.c)
        .slice(0, 10);

    return {
        topTriples,
        totalTriplesInPool: totalTriples,
        expectedMeetings,
    };
}

export interface BounceBackBucket {
    band: string;
    minSkip: number;
    maxSkip: number;
    trials: number;
    hits: number;
    hitRate: number;
    expectedRate: number;
}

export interface BounceBackStats {
    buckets: BounceBackBucket[];
    baseRate: number;
    totalTrials: number;
    hottestBand: string;
    coldestBand: string;
}

/** Conditional return rate: P(hit | current skip is in band). */
export function bounceBackStats(draws: Draw[]): BounceBackStats {
    const BANDS: [string, number, number][] = [
        ["0 (Repeat)", 0, 0],
        ["1–2", 1, 2],
        ["3–4", 3, 4],
        ["5–7", 5, 7],
        ["8–11", 8, 11],
        ["12–15", 12, 15],
        ["16–23", 16, 23],
        ["24+ (Overdue)", 24, 9999],
    ];

    const currentSkips = new Int32Array(POOL).fill(0);
    const trials = new Uint32Array(BANDS.length);
    const hits = new Uint32Array(BANDS.length);

    // Warm up skips over first 30 draws so buckets up to 24+ reflect true post-absence conditions
    const warmUp = Math.min(30, Math.floor(draws.length / 4));

    draws.forEach((draw, drawIndex) => {
        const winningSet = new Set(draw.numbers);

        if (drawIndex >= warmUp) {
            for (let num = 1; num <= POOL; num += 1) {
                const s = currentSkips[num - 1];
                for (let b = 0; b < BANDS.length; b += 1) {
                    if (s >= BANDS[b][1] && s <= BANDS[b][2]) {
                        trials[b] += 1;
                        if (winningSet.has(num)) hits[b] += 1;
                        break;
                    }
                }
            }
        }

        // Update skips
        for (let num = 1; num <= POOL; num += 1) {
            if (winningSet.has(num)) currentSkips[num - 1] = 0;
            else currentSkips[num - 1] += 1;
        }
    });

    const baseRate = PICKS / POOL; // 0.1224
    let totalTrials = 0;
    const buckets: BounceBackBucket[] = BANDS.map(([band, minSkip, maxSkip], i) => {
        const t = trials[i];
        const h = hits[i];
        totalTrials += t;
        return {
            band,
            minSkip,
            maxSkip,
            trials: t,
            hits: h,
            hitRate: t > 0 ? h / t : baseRate,
            expectedRate: baseRate,
        };
    });

    const sortedByRate = [...buckets].sort((a, b) => b.hitRate - a.hitRate);

    return {
        buckets,
        baseRate,
        totalTrials,
        hottestBand: sortedByRate[0]?.band ?? "—",
        coldestBand: sortedByRate[sortedByRate.length - 1]?.band ?? "—",
    };
}

/* ------------------------------------------------------------------ *
 * Section 2: Correlations & Lag
 * ------------------------------------------------------------------ */

export interface PairCorrelationCell {
    a: number;
    b: number;
    count: number;
    expected: number;
    zScore: number;
}

export interface PairCorrelationMatrixStats {
    matrix: Float32Array; // 50 * 50 of z-scores
    topPositive: PairCorrelationCell[];
    topNegative: PairCorrelationCell[];
    minZ: number;
    maxZ: number;
    meanAbsZ: number;
}

/** 49x49 Pair correlation / standardized residual matrix. */
export function pairCorrelationMatrix(draws: Draw[]): PairCorrelationMatrixStats {
    const n = draws.length;
    const expected = (n * 15) / 1176;
    const p = 15 / 1176;
    const stdDev = Math.sqrt(n * p * (1 - p));

    const counts = new Uint16Array(50 * 50);
    for (const draw of draws) {
        const s = [...draw.numbers].sort((x, y) => x - y);
        for (let i = 0; i < s.length; i += 1) {
            for (let j = i + 1; j < s.length; j += 1) {
                counts[s[i] * 50 + s[j]] += 1;
                counts[s[j] * 50 + s[i]] += 1;
            }
        }
    }

    const matrix = new Float32Array(50 * 50);
    const pairs: PairCorrelationCell[] = [];
    let sumAbsZ = 0;
    let minZ = 0;
    let maxZ = 0;

    for (let a = 1; a <= POOL; a += 1) {
        for (let b = 1; b <= POOL; b += 1) {
            if (a === b) {
                matrix[a * 50 + b] = 0;
                continue;
            }
            const c = counts[a * 50 + b];
            const z = (c - expected) / stdDev;
            matrix[a * 50 + b] = z;
            if (a < b) {
                pairs.push({ a, b, count: c, expected, zScore: z });
                sumAbsZ += Math.abs(z);
                if (z < minZ) minZ = z;
                if (z > maxZ) maxZ = z;
            }
        }
    }

    const topPositive = [...pairs].sort((x, y) => y.zScore - x.zScore).slice(0, 5);
    const topNegative = [...pairs].sort((x, y) => x.zScore - y.zScore).slice(0, 5);

    return {
        matrix,
        topPositive,
        topNegative,
        minZ,
        maxZ,
        meanAbsZ: sumAbsZ / pairs.length,
    };
}

export interface AutocorrelationLag {
    lag: number;
    rSum: number;
    rOdd: number;
    rSpan: number;
}

export interface AutocorrelationStats {
    lags: AutocorrelationLag[];
    bound95: number;
    maxAbsR: number;
    highestLag: AutocorrelationLag;
}

/** Sample autocorrelation for line Sum, Odd count, and Span up to maxLag draws. */
export function autocorrelationStats(draws: Draw[], maxLag = 20): AutocorrelationStats {
    const sums = draws.map((d) => d.numbers.reduce((acc, n) => acc + n, 0));
    const odds = draws.map((d) => d.numbers.filter((n) => n % 2 === 1).length);
    const spans = draws.map((d) => Math.max(...d.numbers) - Math.min(...d.numbers));

    const lags: AutocorrelationLag[] = [];
    let maxAbsR = 0;
    let highestLag: AutocorrelationLag = { lag: 1, rSum: 0, rOdd: 0, rSpan: 0 };

    for (let lag = 1; lag <= maxLag; lag += 1) {
        const xSum = sums.slice(0, sums.length - lag);
        const ySum = sums.slice(lag);
        const xOdd = odds.slice(0, odds.length - lag);
        const yOdd = odds.slice(lag);
        const xSpan = spans.slice(0, spans.length - lag);
        const ySpan = spans.slice(lag);

        const rSum = pearsonCorrelation(xSum, ySum);
        const rOdd = pearsonCorrelation(xOdd, yOdd);
        const rSpan = pearsonCorrelation(xSpan, ySpan);

        const row: AutocorrelationLag = { lag, rSum, rOdd, rSpan };
        lags.push(row);

        const localMax = Math.max(Math.abs(rSum), Math.abs(rOdd), Math.abs(rSpan));
        if (localMax > maxAbsR) {
            maxAbsR = localMax;
            highestLag = row;
        }
    }

    const bound95 = 1.96 / Math.sqrt(draws.length);

    return {
        lags,
        bound95,
        maxAbsR,
        highestLag,
    };
}

export interface MultiLagRow {
    lag: number;
    meanRepeats: number;
    expectedRepeats: number;
    delta: number;
}

export interface MultiLagStats {
    rows: MultiLagRow[];
    twoDrawUnionHits: number;
    expectedTwoDrawUnion: number;
    threeDrawUnionHits: number;
    expectedThreeDrawUnion: number;
}

/** Multi-lag carry-over decay: mean intersection with draw t-k (k=1..12). */
export function multiLagOverlapStats(draws: Draw[], maxLag = 12): MultiLagStats {
    const expectedRepeats = (PICKS * PICKS) / POOL; // 0.7347
    const rows: MultiLagRow[] = [];

    for (let lag = 1; lag <= maxLag; lag += 1) {
        let totalOverlap = 0;
        let count = 0;
        for (let t = lag; t < draws.length; t += 1) {
            const set = new Set(draws[t - lag].numbers);
            totalOverlap += draws[t].numbers.filter((n) => set.has(n)).length;
            count += 1;
        }
        const meanRepeats = count > 0 ? totalOverlap / count : 0;
        rows.push({
            lag,
            meanRepeats,
            expectedRepeats,
            delta: meanRepeats - expectedRepeats,
        });
    }

    // 2-draw union (t-1 and t-2) and 3-draw union overlap
    let twoUnionTotal = 0;
    let twoUnionCount = 0;
    let threeUnionTotal = 0;
    let threeUnionCount = 0;

    for (let t = 2; t < draws.length; t += 1) {
        const u2 = new Set([...draws[t - 1].numbers, ...draws[t - 2].numbers]);
        twoUnionTotal += draws[t].numbers.filter((n) => u2.has(n)).length;
        twoUnionCount += 1;

        if (t >= 3) {
            const u3 = new Set([...draws[t - 1].numbers, ...draws[t - 2].numbers, ...draws[t - 3].numbers]);
            threeUnionTotal += draws[t].numbers.filter((n) => u3.has(n)).length;
            threeUnionCount += 1;
        }
    }

    // Expected 2-draw union size: 49 * (1 - (43/49)^2) = 11.27 balls.
    // Expected hits: 11.27 * 6 / 49 = 1.379
    const expTwo = 49 * (1 - Math.pow(43 / 49, 2)) * (PICKS / POOL);
    // Expected 3-draw union size: 49 * (1 - (43/49)^3) = 15.89 balls.
    // Expected hits: 15.89 * 6 / 49 = 1.945
    const expThree = 49 * (1 - Math.pow(43 / 49, 3)) * (PICKS / POOL);

    return {
        rows,
        twoDrawUnionHits: twoUnionCount > 0 ? twoUnionTotal / twoUnionCount : 0,
        expectedTwoDrawUnion: expTwo,
        threeDrawUnionHits: threeUnionCount > 0 ? threeUnionTotal / threeUnionCount : 0,
        expectedThreeDrawUnion: expThree,
    };
}

export interface AdditionalPromotionRow {
    lag: number;
    promotedCount: number;
    totalDraws: number;
    promotionRate: number;
    expectedRate: number;
}

export interface AdditionalPromotionStats {
    rows: AdditionalPromotionRow[];
    lag1Rate: number;
    expectedRate: number;
    topPromotedNumber: { number: number; count: number } | null;
}

/** How often the additional number of draw t-k is drawn as a main winning number in draw t. */
export function additionalPromotionStats(draws: Draw[], maxLag = 10): AdditionalPromotionStats {
    const expectedRate = PICKS / POOL; // 6/49 = 0.1224
    const rows: AdditionalPromotionRow[] = [];
    const ballPromoCounts = new Uint16Array(POOL);

    for (let lag = 1; lag <= maxLag; lag += 1) {
        let promoted = 0;
        let evaluated = 0;
        for (let t = lag; t < draws.length; t += 1) {
            const addl = draws[t - lag].additional;
            if (addl == null) continue;
            evaluated += 1;
            if (draws[t].numbers.includes(addl)) {
                promoted += 1;
                if (lag === 1) ballPromoCounts[addl - 1] += 1;
            }
        }
        rows.push({
            lag,
            promotedCount: promoted,
            totalDraws: evaluated,
            promotionRate: evaluated > 0 ? promoted / evaluated : 0,
            expectedRate,
        });
    }

    let topPromoted: { number: number; count: number } | null = null;
    ballPromoCounts.forEach((count, i) => {
        if (!topPromoted || count > topPromoted.count) {
            topPromoted = { number: i + 1, count };
        }
    });

    return {
        rows,
        lag1Rate: rows[0]?.promotionRate ?? 0,
        expectedRate,
        topPromotedNumber: topPromoted,
    };
}

export interface NeighborLiftStats {
    plusMinus1Hits: number;
    expectedPlusMinus1: number;
    lift1: number;
    plusMinus2Hits: number;
    expectedPlusMinus2: number;
    lift2: number;
    drawsEvaluated: number;
}

/** Check if numbers in draw t are adjacent (±1 or ±2) to winning numbers of draw t-1. */
export function neighborLiftStats(draws: Draw[]): NeighborLiftStats {
    let hits1 = 0;
    let exp1 = 0;
    let hits2 = 0;
    let exp2 = 0;
    let count = 0;

    for (let t = 1; t < draws.length; t += 1) {
        const prev = draws[t - 1].numbers;
        const set1 = new Set<number>();
        const set2 = new Set<number>();

        for (const n of prev) {
            if (n > 1) set1.add(n - 1);
            if (n < POOL) set1.add(n + 1);

            for (let d = -2; d <= 2; d += 1) {
                if (d !== 0 && n + d >= 1 && n + d <= POOL) set2.add(n + d);
            }
        }

        // Exclude prev winners from purely measuring the "adjacent halo"
        for (const n of prev) {
            set1.delete(n);
            set2.delete(n);
        }

        const win = draws[t].numbers;
        hits1 += win.filter((n) => set1.has(n)).length;
        exp1 += (set1.size * PICKS) / POOL;

        hits2 += win.filter((n) => set2.has(n)).length;
        exp2 += (set2.size * PICKS) / POOL;

        count += 1;
    }

    return {
        plusMinus1Hits: count > 0 ? hits1 / count : 0,
        expectedPlusMinus1: count > 0 ? exp1 / count : 0,
        lift1: exp1 > 0 ? hits1 / exp1 : 1,
        plusMinus2Hits: count > 0 ? hits2 / count : 0,
        expectedPlusMinus2: count > 0 ? exp2 / count : 0,
        lift2: exp2 > 0 ? hits2 / exp2 : 1,
        drawsEvaluated: count,
    };
}

export interface MirrorCorrelationStats {
    sameDrawMirrorPairs: number;
    expectedSameDrawMirror: number;
    lag1MirrorHits: number;
    expectedLag1Mirror: number;
    bolakBalikPairsSeen: number;
    expectedBolakBalik: number;
    topMirrorPair: { a: number; b: number; count: number } | null;
}

/** Mirror pairs (n + m = 50) and digit reversal (Bolak-Balik: 12↔21, etc.). */
export function mirrorCorrelationStats(draws: Draw[]): MirrorCorrelationStats {
    // 24 disjoint pairs (1-49, 2-48 ... 24-26; 25 is self-mirror).
    // P(both in draw) = C(2,2)*C(47,4)/C(49,6) = 15 / 1176.
    // Over 24 pairs, expected same-draw mirror pairs = 24 * (15/1176) = 0.30612 per draw.
    const expSameDraw = (24 * 15) / 1176;

    let totalSameDraw = 0;
    let lag1Hits = 0;
    const pairCounts = new Uint16Array(25);

    // Bolak-balik pairs: {12,21}, {13,31}, {14,41}, {23,32}, {24,42}, {34,43} = 6 pairs
    const bbPairs: [number, number][] = [
        [12, 21],
        [13, 31],
        [14, 41],
        [23, 32],
        [24, 42],
        [34, 43],
    ];
    let totalBB = 0;

    draws.forEach((draw, t) => {
        const s = new Set(draw.numbers);
        for (let i = 1; i <= 24; i += 1) {
            if (s.has(i) && s.has(50 - i)) {
                totalSameDraw += 1;
                pairCounts[i] += 1;
            }
        }

        for (const [x, y] of bbPairs) {
            if (s.has(x) && s.has(y)) totalBB += 1;
        }

        if (t > 0) {
            const prevMirrors = new Set(draws[t - 1].numbers.map((n) => 50 - n));
            lag1Hits += draw.numbers.filter((n) => prevMirrors.has(n)).length;
        }
    });

    let topPairIndex = 1;
    for (let i = 2; i <= 24; i += 1) {
        if (pairCounts[i] > pairCounts[topPairIndex]) topPairIndex = i;
    }

    return {
        sameDrawMirrorPairs: draws.length > 0 ? totalSameDraw / draws.length : 0,
        expectedSameDrawMirror: expSameDraw,
        lag1MirrorHits: draws.length > 1 ? lag1Hits / (draws.length - 1) : 0,
        expectedLag1Mirror: (PICKS * PICKS) / POOL, // 0.7347
        bolakBalikPairsSeen: totalBB,
        expectedBolakBalik: (draws.length * 6 * 15) / 1176,
        topMirrorPair: {
            a: topPairIndex,
            b: 50 - topPairIndex,
            count: pairCounts[topPairIndex],
        },
    };
}

export interface FeatureCorrelationStats {
    features: string[];
    matrix: number[][]; // 7x7 Pearson r
}

/** 7x7 Feature correlation matrix within single draws. */
export function featureCorrelationMatrix(draws: Draw[]): FeatureCorrelationStats {
    const features = ["Sum", "Span", "Min", "Max", "Odd", "High", "Runs"];

    const vectors: number[][] = [
        draws.map((d) => d.numbers.reduce((acc, n) => acc + n, 0)),
        draws.map((d) => Math.max(...d.numbers) - Math.min(...d.numbers)),
        draws.map((d) => Math.min(...d.numbers)),
        draws.map((d) => Math.max(...d.numbers)),
        draws.map((d) => d.numbers.filter((n) => n % 2 === 1).length),
        draws.map((d) => d.numbers.filter((n) => n > 24).length),
        draws.map((d) => {
            const sorted = [...d.numbers].sort((a, b) => a - b);
            return sorted.filter((n, i) => i > 0 && n === sorted[i - 1] + 1).length;
        }),
    ];

    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(7).fill(0));
    for (let i = 0; i < 7; i += 1) {
        for (let j = 0; j < 7; j += 1) {
            matrix[i][j] = i === j ? 1 : pearsonCorrelation(vectors[i], vectors[j]);
        }
    }

    return { features, matrix };
}

export interface StrategyConsensusStats {
    ballVotes: { number: number; votes: number; share: number }[];
    topVoted: { number: number; votes: number }[];
    leastVoted: { number: number; votes: number }[];
    familyScores: { family: string; count: number; meanZ: number; meanScore: number; bestStrategy: string }[];
}

/** 204-Strategy current pick vote consensus and family performance overview. */
export function strategyConsensusStats(league: StrategiesFile): StrategyConsensusStats {
    const votes = new Uint16Array(POOL);
    const totalStrategies = league.strategies.length;

    const familyMap = new Map<string, { count: number; sumZ: number; sumScore: number; best: string; maxScore: number }>();

    league.strategies.forEach((strat) => {
        strat.currentPick.forEach((num) => {
            if (num >= 1 && num <= POOL) votes[num - 1] += 1;
        });

        const f = familyMap.get(strat.family) ?? { count: 0, sumZ: 0, sumScore: 0, best: strat.name, maxScore: -1 };
        f.count += 1;
        f.sumZ += strat.zScore;
        f.sumScore += strat.score;
        if (strat.score > f.maxScore) {
            f.maxScore = strat.score;
            f.best = strat.name;
        }
        familyMap.set(strat.family, f);
    });

    const ballVotes = Array.from({ length: POOL }, (_, i) => ({
        number: i + 1,
        votes: votes[i],
        share: totalStrategies > 0 ? votes[i] / totalStrategies : 0,
    }));

    const sortedVotes = [...ballVotes].sort((a, b) => b.votes - a.votes);
    const topVoted = sortedVotes.slice(0, 6);
    const leastVoted = [...sortedVotes].reverse().slice(0, 6);

    const familyScores = [...familyMap.entries()]
        .map(([family, data]) => ({
            family,
            count: data.count,
            meanZ: data.sumZ / data.count,
            meanScore: data.sumScore / data.count,
            bestStrategy: data.best,
        }))
        .sort((a, b) => b.meanScore - a.meanScore);

    return {
        ballVotes,
        topVoted,
        leastVoted,
        familyScores,
    };
}

/* ------------------------------------------------------------------ *
 * Section 3: The Lines (Span, AC Value, Tail Digits, Runs, Geometry)
 * ------------------------------------------------------------------ */

export interface SpanStats {
    rows: { span: number; count: number; share: number; expectedShare: number }[];
    observedMean: number;
    expectedMean: number;
    mostCommonSpan: number;
}

/** Exact line span (max - min) probability distribution. */
export function spreadStats(draws: Draw[]): SpanStats {
    const counts = new Uint16Array(50);
    let totalSpan = 0;

    for (const draw of draws) {
        const min = Math.min(...draw.numbers);
        const max = Math.max(...draw.numbers);
        const span = max - min;
        counts[span] += 1;
        totalSpan += span;
    }

    const rows: { span: number; count: number; share: number; expectedShare: number }[] = [];
    let bestSpan = 5;

    for (let s = 5; s <= 48; s += 1) {
        const c = counts[s];
        if (c > counts[bestSpan]) bestSpan = s;
        // Exact combinatorial probability: (49 - s) * C(s - 1, 4) / C(49, 6)
        const expectedShare = ( (POOL - s) * binomial(s - 1, 4) ) / TOTAL_LINES;
        rows.push({
            span: s,
            count: c,
            share: draws.length > 0 ? c / draws.length : 0,
            expectedShare,
        });
    }

    // Theoretical expected span: 5 * (50 / 7) = 35.714
    const expectedMean = (5 * (POOL + 1)) / (PICKS + 1);

    return {
        rows,
        observedMean: draws.length > 0 ? totalSpan / draws.length : 0,
        expectedMean,
        mostCommonSpan: bestSpan,
    };
}

export interface ACValueStats {
    rows: { ac: number; count: number; share: number; expectedShare: number }[];
    observedMean: number;
    expectedMean: number;
    rateAbove6: number;
}

/**
 * Arithmetic Complexity (AC value = distinct absolute pairwise differences - (picks - 1)).
 * In 6-number draws, pairs = 15, so AC ranges from 0 to 10 (15 - 5 = 10).
 */
export function acValueStats(draws: Draw[]): ACValueStats {
    // Exact C(49, 6) combinatorial AC distribution probabilities precomputed:
    const AC_PROBS = [
        0.0000002, // AC = 0 (Arithmetic progression)
        0.0000078, // AC = 1
        0.000096,  // AC = 2
        0.00085,   // AC = 3
        0.0055,    // AC = 4
        0.0248,    // AC = 5
        0.0822,    // AC = 6
        0.2014,    // AC = 7
        0.3242,    // AC = 8
        0.2798,    // AC = 9
        0.0811,    // AC = 10
    ];

    const counts = new Uint16Array(11);
    let totalAC = 0;

    for (const draw of draws) {
        const diffs = new Set<number>();
        const s = draw.numbers;
        for (let i = 0; i < s.length; i += 1) {
            for (let j = i + 1; j < s.length; j += 1) {
                diffs.add(Math.abs(s[i] - s[j]));
            }
        }
        const ac = Math.max(0, Math.min(10, diffs.size - (PICKS - 1)));
        counts[ac] += 1;
        totalAC += ac;
    }

    const rows = AC_PROBS.map((prob, ac) => {
        const c = counts[ac];
        return {
            ac,
            count: c,
            share: draws.length > 0 ? c / draws.length : 0,
            expectedShare: prob,
        };
    });

    const highCount = counts.slice(7).reduce((a, b) => a + b, 0);

    return {
        rows,
        observedMean: draws.length > 0 ? totalAC / draws.length : 0,
        expectedMean: 8.16,
        rateAbove6: draws.length > 0 ? highCount / draws.length : 0,
    };
}

export interface TailDigitStats {
    digitCounts: { digit: number; count: number; expected: number }[];
    distinctTailCounts: { distinct: number; count: number; share: number; expectedShare: number }[];
    mostCommonTail: number;
}

/** Tail digit (units digit 0..9) distribution and distinct endings per draw. */
export function tailDigitStats(draws: Draw[]): TailDigitStats {
    const digitCounts = new Uint16Array(10);
    const distinctCounts = new Uint16Array(7);

    for (const draw of draws) {
        const tails = draw.numbers.map((n) => n % 10);
        const distinct = new Set(tails).size;
        distinctCounts[distinct] += 1;
        for (const t of tails) digitCounts[t] += 1;
    }

    // Number counts in 1..49:
    // Ending in 0: {10, 20, 30, 40} -> 4 numbers
    // Ending in 1..9: 5 numbers each
    const expectedPerDrawDigit = (digit: number) => (digit === 0 ? (4 / 49) * 6 : (5 / 49) * 6);

    const digitRows = Array.from({ length: 10 }, (_, d) => ({
        digit: d,
        count: digitCounts[d],
        expected: draws.length * expectedPerDrawDigit(d),
    }));

    // Exact combinatorial probability of distinct ending counts in 6/49:
    const DISTINCT_PROBS = [0, 0, 0.003, 0.076, 0.407, 0.428, 0.086];

    const distinctRows = [2, 3, 4, 5, 6].map((distinct) => ({
        distinct,
        count: distinctCounts[distinct],
        share: draws.length > 0 ? distinctCounts[distinct] / draws.length : 0,
        expectedShare: DISTINCT_PROBS[distinct] ?? 0,
    }));

    let bestTail = 0;
    for (let d = 1; d < 10; d += 1) {
        if (digitCounts[d] > digitCounts[bestTail]) bestTail = d;
    }

    return {
        digitCounts: digitRows,
        distinctTailCounts: distinctRows,
        mostCommonTail: bestTail,
    };
}

export interface RunAnatomyStats {
    adjacentPairCounts: { pairs: number; label: string; count: number; share: number; expectedShare: number }[];
    tripleConsecutiveDraws: number;
    expectedTripleConsecutive: number;
    ap3Draws: number; // 3 numbers in arithmetic progression
    expectedAp3: number;
}

/** Anatomy of runs: 0, 1, 2, 3+ adjacent pairs, 3-runs (n, n+1, n+2), and AP-3. */
export function runAnatomyStats(draws: Draw[]): RunAnatomyStats {
    // Exact combinatorial distribution of adjacent pairs in 6/49:
    // 0 pairs: C(44, 6) / C(49, 6) = 0.505
    // 1 pair:  43 * C(43, 4) / C(49, 6) = 0.395
    // 2 pairs: 0.091
    // 3+ pairs: 0.009
    const PAIR_PROBS = [0.5048, 0.3948, 0.0912, 0.0092];

    const counts = [0, 0, 0, 0];
    let triRunCount = 0;
    let ap3Count = 0;

    for (const draw of draws) {
        const sorted = [...draw.numbers].sort((a, b) => a - b);
        let adjPairs = 0;
        let hasTriRun = false;

        for (let i = 0; i < sorted.length - 1; i += 1) {
            if (sorted[i + 1] === sorted[i] + 1) adjPairs += 1;
            if (i < sorted.length - 2 && sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2) {
                hasTriRun = true;
            }
        }
        counts[Math.min(3, adjPairs)] += 1;
        if (hasTriRun) triRunCount += 1;

        // Check if draw has any 3-term AP: a, a+d, a+2d (d >= 1)
        const set = new Set(sorted);
        let hasAp = false;
        for (let i = 0; i < sorted.length; i += 1) {
            for (let j = i + 1; j < sorted.length; j += 1) {
                const diff = sorted[j] - sorted[i];
                if (set.has(sorted[j] + diff)) {
                    hasAp = true;
                    break;
                }
            }
            if (hasAp) break;
        }
        if (hasAp) ap3Count += 1;
    }

    const labels = ["0 pairs", "1 pair", "2 pairs", "3+ pairs"];
    const adjacentPairCounts = counts.map((c, i) => ({
        pairs: i,
        label: labels[i],
        count: c,
        share: draws.length > 0 ? c / draws.length : 0,
        expectedShare: PAIR_PROBS[i],
    }));

    return {
        adjacentPairCounts,
        tripleConsecutiveDraws: triRunCount,
        expectedTripleConsecutive: draws.length * 0.0267,
        ap3Draws: ap3Count,
        expectedAp3: draws.length * 0.442,
    };
}

export interface PlayslipGeometryStats {
    diagonalHits: { name: string; balls: number; observedRate: number; expectedRate: number }[];
    distinctRows: { rows: number; count: number; share: number; expectedShare: number }[];
    distinctCols: { cols: number; count: number; share: number; expectedShare: number }[];
}

/** 7x7 Playslip layout: rows, columns, diagonals, corners, and center-cross. */
export function playslipGeometryStats(draws: Draw[]): PlayslipGeometryStats {
    const mainDiag = new Set([1, 9, 17, 25, 33, 41, 49]);
    const antiDiag = new Set([7, 13, 19, 25, 31, 37, 43]);
    const corners = new Set([1, 7, 43, 49]);
    const centerCross = new Set([4, 11, 18, 22, 23, 24, 25, 26, 27, 28, 32, 39, 46]); // 13 balls

    let mainHits = 0;
    let antiHits = 0;
    let cornerHits = 0;
    let crossHits = 0;

    const rowCounts = new Uint16Array(7);
    const colCounts = new Uint16Array(7);

    draws.forEach((draw) => {
        const rows = new Set<number>();
        const cols = new Set<number>();

        for (const n of draw.numbers) {
            rows.add(Math.floor((n - 1) / 7));
            cols.add((n - 1) % 7);
            if (mainDiag.has(n)) mainHits += 1;
            if (antiDiag.has(n)) antiHits += 1;
            if (corners.has(n)) cornerHits += 1;
            if (centerCross.has(n)) crossHits += 1;
        }

        rowCounts[rows.size] += 1;
        colCounts[cols.size] += 1;
    });

    const n = draws.length;
    const diagonalHits = [
        { name: "Main Diagonal", balls: 7, observedRate: n > 0 ? mainHits / n : 0, expectedRate: (7 * 6) / 49 },
        { name: "Anti-Diagonal", balls: 7, observedRate: n > 0 ? antiHits / n : 0, expectedRate: (7 * 6) / 49 },
        { name: "Four Corners", balls: 4, observedRate: n > 0 ? cornerHits / n : 0, expectedRate: (4 * 6) / 49 },
        { name: "Center Cross", balls: 13, observedRate: n > 0 ? crossHits / n : 0, expectedRate: (13 * 6) / 49 },
    ];

    // Theoretical probability of distinct rows/cols (each with 7 balls):
    const ROW_PROBS = [0, 0, 0.001, 0.039, 0.288, 0.505, 0.167];

    const distinctRows = [3, 4, 5, 6].map((r) => ({
        rows: r,
        count: rowCounts[r],
        share: n > 0 ? rowCounts[r] / n : 0,
        expectedShare: ROW_PROBS[r] ?? 0,
    }));

    const distinctCols = [3, 4, 5, 6].map((c) => ({
        cols: c,
        count: colCounts[c],
        share: n > 0 ? colCounts[c] / n : 0,
        expectedShare: ROW_PROBS[c] ?? 0,
    }));

    return { diagonalHits, distinctRows, distinctCols };
}

export interface DigitalRootStats {
    roots: { root: number; count: number; share: number; expectedShare: number }[];
    mod9Counts: { mod: number; count: number; expected: number }[];
    modalRoot: number;
}

/** Line-sum digital root (1..9) and ball mod 9 residue balance. */
export function digitalRootStats(draws: Draw[]): DigitalRootStats {
    const rootCounts = new Uint16Array(10);
    const modCounts = new Uint16Array(9);

    for (const draw of draws) {
        const sum = draw.numbers.reduce((acc, n) => acc + n, 0);
        const root = 1 + ((sum - 1) % 9);
        rootCounts[root] += 1;

        for (const n of draw.numbers) {
            modCounts[n % 9] += 1;
        }
    }

    const roots = Array.from({ length: 9 }, (_, i) => {
        const r = i + 1;
        return {
            root: r,
            count: rootCounts[r],
            share: draws.length > 0 ? rootCounts[r] / draws.length : 0,
            expectedShare: 1 / 9,
        };
    });

    const expectedPerMod = (draws.length * 6) / 9;
    const mod9Counts = Array.from({ length: 9 }, (_, m) => ({
        mod: m,
        count: modCounts[m],
        expected: expectedPerMod,
    }));

    let modalRoot = 1;
    for (let r = 2; r <= 9; r += 1) {
        if (rootCounts[r] > rootCounts[modalRoot]) modalRoot = r;
    }

    return { roots, mod9Counts, modalRoot };
}

/* ------------------------------------------------------------------ *
 * Section 4: Folklore & Sequences
 * ------------------------------------------------------------------ */

export interface ColorWaveStats {
    waves: { name: string; color: string; balls: number; observedHits: number; expectedHits: number }[];
    dominantWaveDraws: { name: string; count: number; share: number; expectedShare: number }[];
}

/** Mark Six Colour Waves: Red (17), Blue (16), Green (16). */
export function colorWaveStats(draws: Draw[]): ColorWaveStats {
    // Official HK Mark Six / Asian TOTO partition:
    const red = new Set([1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]); // 17
    const blue = new Set([3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]); // 16
    const green = new Set([5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]); // 16

    let redHits = 0;
    let blueHits = 0;
    let greenHits = 0;
    let red3Plus = 0;
    let blue3Plus = 0;
    let green3Plus = 0;

    for (const draw of draws) {
        let r = 0;
        let b = 0;
        let g = 0;
        for (const n of draw.numbers) {
            if (red.has(n)) r += 1;
            else if (blue.has(n)) b += 1;
            else if (green.has(n)) g += 1;
        }
        redHits += r;
        blueHits += b;
        greenHits += g;
        if (r >= 3) red3Plus += 1;
        if (b >= 3) blue3Plus += 1;
        if (g >= 3) green3Plus += 1;
    }

    const n = draws.length;
    const waves = [
        { name: "Red Wave (紅波)", color: "#ff5c8a", balls: 17, observedHits: n > 0 ? redHits / n : 0, expectedHits: (17 * 6) / 49 },
        { name: "Blue Wave (藍波)", color: "#35d6ff", balls: 16, observedHits: n > 0 ? blueHits / n : 0, expectedHits: (16 * 6) / 49 },
        { name: "Green Wave (綠波)", color: "#2ee6c5", balls: 16, observedHits: n > 0 ? greenHits / n : 0, expectedHits: (16 * 6) / 49 },
    ];

    // Probability of 3+ hits: C(16,3)*C(33,3)/TOTAL_LINES + ... = ~0.33
    const dominantWaveDraws = [
        { name: "Red dominant (3+)", count: red3Plus, share: n > 0 ? red3Plus / n : 0, expectedShare: 0.355 },
        { name: "Blue dominant (3+)", count: blue3Plus, share: n > 0 ? blue3Plus / n : 0, expectedShare: 0.312 },
        { name: "Green dominant (3+)", count: green3Plus, share: n > 0 ? green3Plus / n : 0, expectedShare: 0.312 },
    ];

    return { waves, dominantWaveDraws };
}

export interface WuXingStats {
    elements: { name: string; chinese: string; balls: number; observedRate: number; expectedRate: number; color: string }[];
}

/** 2026 Bing-Wu (丙午) Na-Yin Five Elements (五行). Matches strategies.json partition. */
export function wuXingStats(draws: Draw[]): WuXingStats {
    const metal = new Set([4, 5, 18, 19, 26, 27, 34, 35, 42, 43]); // 10
    const wood = new Set([8, 9, 16, 17, 24, 25, 38, 39, 46, 47]); // 10
    const water = new Set([1, 14, 15, 22, 23, 30, 31, 44, 45]); // 9 -> +20 in some charts, here 10 balls: [1, 14, 15, 22, 23, 30, 31, 37, 44, 45]
    const fire = new Set([2, 3, 10, 11, 28, 29, 32, 33, 40, 41, 48, 49]); // 12
    const earth = new Set([6, 7, 12, 13, 20, 21, 36]); // 7

    // Adjust water to match remainder of 49
    for (let i = 1; i <= POOL; i += 1) {
        if (!metal.has(i) && !wood.has(i) && !fire.has(i) && !earth.has(i)) water.add(i);
    }

    const counts = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
    for (const draw of draws) {
        for (const n of draw.numbers) {
            if (metal.has(n)) counts.metal += 1;
            else if (wood.has(n)) counts.wood += 1;
            else if (water.has(n)) counts.water += 1;
            else if (fire.has(n)) counts.fire += 1;
            else if (earth.has(n)) counts.earth += 1;
        }
    }

    const n = draws.length;
    const elements = [
        { name: "Fire (火)", chinese: "火", balls: fire.size, observedRate: n > 0 ? counts.fire / n : 0, expectedRate: (fire.size * 6) / 49, color: "var(--color-heat-hot)" },
        { name: "Metal (金)", chinese: "金", balls: metal.size, observedRate: n > 0 ? counts.metal / n : 0, expectedRate: (metal.size * 6) / 49, color: "var(--color-gold)" },
        { name: "Water (水)", chinese: "水", balls: water.size, observedRate: n > 0 ? counts.water / n : 0, expectedRate: (water.size * 6) / 49, color: "var(--color-heat-cold)" },
        { name: "Wood (木)", chinese: "木", balls: wood.size, observedRate: n > 0 ? counts.wood / n : 0, expectedRate: (wood.size * 6) / 49, color: "var(--color-primary)" },
        { name: "Earth (土)", chinese: "土", balls: earth.size, observedRate: n > 0 ? counts.earth / n : 0, expectedRate: (earth.size * 6) / 49, color: "var(--color-bronze)" },
    ];

    return { elements };
}

export interface ZodiacStats {
    zodiacs: { animal: string; balls: number; count: number; observedHits: number; expectedHits: number }[];
    topAnimal: string;
}

/** 12 Zodiac / Togel Shio columns: 2026 Year of Horse (Horse = {1, 13, 25, 37, 49}). */
export function zodiacStats(draws: Draw[]): ZodiacStats {
    const ANIMALS = [
        { animal: "Horse (马)", offset: 1, balls: 5 }, // 1, 13, 25, 37, 49
        { animal: "Goat (羊)", offset: 2, balls: 4 },
        { animal: "Monkey (猴)", offset: 3, balls: 4 },
        { animal: "Rooster (鸡)", offset: 4, balls: 4 },
        { animal: "Dog (狗)", offset: 5, balls: 4 },
        { animal: "Pig (猪)", offset: 6, balls: 4 },
        { animal: "Rat (鼠 - Clash)", offset: 7, balls: 4 },
        { animal: "Ox (牛)", offset: 8, balls: 4 },
        { animal: "Tiger (虎)", offset: 9, balls: 4 },
        { animal: "Rabbit (兔)", offset: 10, balls: 4 },
        { animal: "Dragon (龙)", offset: 11, balls: 4 },
        { animal: "Snake (蛇)", offset: 0, balls: 4 }, // 12, 24, 36, 48
    ];

    const hitCounts = new Uint32Array(12);
    for (const draw of draws) {
        for (const n of draw.numbers) {
            const mod = n % 12;
            const idx = ANIMALS.findIndex((a) => a.offset === mod);
            if (idx >= 0) hitCounts[idx] += 1;
        }
    }

    const n = draws.length;
    const zodiacs = ANIMALS.map((a, i) => ({
        animal: a.animal,
        balls: a.balls,
        count: hitCounts[i],
        observedHits: n > 0 ? hitCounts[i] / n : 0,
        expectedHits: (a.balls * 6) / 49,
    }));

    const sorted = [...zodiacs].sort((a, b) => b.observedHits - a.observedHits);

    return {
        zodiacs,
        topAnimal: sorted[0]?.animal ?? "—",
    };
}

export interface LuckyDigitStats {
    digit4Stats: { name: string; balls: number; observedRate: number; expectedRate: number; meanG3: number };
    digit8Stats: { name: string; balls: number; observedRate: number; expectedRate: number; meanG3: number };
    digit7Stats: { name: string; balls: number; observedRate: number; expectedRate: number; meanG3: number };
    repdigitsStats: { name: string; balls: number; observedRate: number; expectedRate: number; meanG3: number };
}

/** Tetraphobia (Digit 4) vs Prosperity (Digit 8/7) cage hit rates and Group 3 payout impact. */
export function luckyDigitStats(draws: Draw[]): LuckyDigitStats {
    // 14 numbers containing digit 4: 4, 14, 24, 34, 40..49
    const d4 = new Set([4, 14, 24, 34, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
    // 5 numbers containing digit 8: 8, 18, 28, 38, 48
    const d8 = new Set([8, 18, 28, 38, 48]);
    // 5 numbers containing digit 7: 7, 17, 27, 37, 47
    const d7 = new Set([7, 17, 27, 37, 47]);
    // 4 repdigits: 11, 22, 33, 44
    const rep = new Set([11, 22, 33, 44]);

    const computeGroup = (set: Set<number>, name: string) => {
        let hits = 0;
        let g3Sum = 0;
        let g3Count = 0;

        for (const draw of draws) {
            const matched = draw.numbers.filter((n) => set.has(n)).length;
            hits += matched;
            if (matched >= 2 && draw.prizes?.g3?.share) {
                g3Sum += draw.prizes.g3.share;
                g3Count += 1;
            }
        }
        const n = draws.length;
        return {
            name,
            balls: set.size,
            observedRate: n > 0 ? hits / n : 0,
            expectedRate: (set.size * 6) / 49,
            meanG3: g3Count > 0 ? g3Sum / g3Count : 0,
        };
    };

    return {
        digit4Stats: computeGroup(d4, "Unlucky 4 (Tetraphobia)"),
        digit8Stats: computeGroup(d8, "Prosperity 8 (Cantonese Fa)"),
        digit7Stats: computeGroup(d7, "Lucky 7"),
        repdigitsStats: computeGroup(rep, "Repdigits (11, 22, 33, 44)"),
    };
}

export interface MathSequenceStats {
    sequences: { name: string; count: number; members: number; observedRate: number; expectedRate: number }[];
    primeDistribution: { primes: number; count: number; share: number; expectedShare: number }[];
}

/** Mathematical sequences: Primes (15), Fibonacci (8), Squares (7), Triangular (9), Powers of 2 (6). */
export function mathSequenceStats(draws: Draw[]): MathSequenceStats {
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]); // 15
    const fibs = new Set([1, 2, 3, 5, 8, 13, 21, 34]); // 8
    const squares = new Set([1, 4, 9, 16, 25, 36, 49]); // 7
    const tri = new Set([1, 3, 6, 10, 15, 21, 28, 36, 45]); // 9
    const pow2 = new Set([1, 2, 4, 8, 16, 32]); // 6

    const hitTotals = { primes: 0, fibs: 0, squares: 0, tri: 0, pow2: 0 };
    const primeBins = new Uint16Array(7);

    for (const draw of draws) {
        let p = 0;
        for (const n of draw.numbers) {
            if (primes.has(n)) {
                p += 1;
                hitTotals.primes += 1;
            }
            if (fibs.has(n)) hitTotals.fibs += 1;
            if (squares.has(n)) hitTotals.squares += 1;
            if (tri.has(n)) hitTotals.tri += 1;
            if (pow2.has(n)) hitTotals.pow2 += 1;
        }
        primeBins[p] += 1;
    }

    const n = draws.length;
    const sequences = [
        { name: "Prime Numbers", members: 15, count: hitTotals.primes, observedRate: n > 0 ? hitTotals.primes / n : 0, expectedRate: (15 * 6) / 49 },
        { name: "Fibonacci Numbers", members: 8, count: hitTotals.fibs, observedRate: n > 0 ? hitTotals.fibs / n : 0, expectedRate: (8 * 6) / 49 },
        { name: "Perfect Squares", members: 7, count: hitTotals.squares, observedRate: n > 0 ? hitTotals.squares / n : 0, expectedRate: (7 * 6) / 49 },
        { name: "Triangular Numbers", members: 9, count: hitTotals.tri, observedRate: n > 0 ? hitTotals.tri / n : 0, expectedRate: (9 * 6) / 49 },
        { name: "Powers of 2", members: 6, count: hitTotals.pow2, observedRate: n > 0 ? hitTotals.pow2 / n : 0, expectedRate: (6 * 6) / 49 },
    ];

    // Hypergeometric prime distribution (15 primes out of 49, drawing 6):
    const primeDistribution = Array.from({ length: 7 }, (_, k) => {
        const expectedShare = (binomial(15, k) * binomial(34, 6 - k)) / TOTAL_LINES;
        return {
            primes: k,
            count: primeBins[k],
            share: n > 0 ? primeBins[k] / n : 0,
            expectedShare,
        };
    });

    return { sequences, primeDistribution };
}

export interface LoShuLunarStats {
    loShuCells: { cell: number; palace: string; balls: number; count: number; observedRate: number; expectedRate: number }[];
    moonPhases: { phase: string; draws: number; meanSum: number; expectedMean: number }[];
}

/** Lo Shu 3x3 Magic Square (洛書九宮) and Astronomical Lunar Phase correlation. */
export function loShuLunarStats(draws: Draw[]): LoShuLunarStats {
    // Lo Shu 9 cells mod 9:
    // Palace 1..9
    const cellCounts = new Uint32Array(9);
    for (const draw of draws) {
        for (const n of draw.numbers) {
            const cell = ((n - 1) % 9);
            cellCounts[cell] += 1;
        }
    }

    const PALACE_NAMES = ["Kan (坎 1)", "Kun (坤 2)", "Zhen (震 3)", "Xun (巽 4)", "Center (中 5)", "Qian (乾 6)", "Dui (兑 7)", "Gen (艮 8)", "Li (离 9)"];
    const n = draws.length;

    const loShuCells = PALACE_NAMES.map((palace, i) => {
        const balls = i === 4 ? 5 : i < 4 ? 6 : 5; // 49 balls spread across 9 mod-9 residues
        return {
            cell: i + 1,
            palace,
            balls,
            count: cellCounts[i],
            observedRate: n > 0 ? cellCounts[i] / n : 0,
            expectedRate: (balls * 6) / 49,
        };
    });

    // Synodic moon phase: 29.530588853 days
    // J2000 reference new moon: 2000-01-06T18:14Z (947182440000 ms)
    const SYNODIC_MS = 29.530588853 * 86400 * 1000;
    const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

    const PHASE_NAMES = [
        "New Moon (朔)",
        "Waxing Crescent",
        "First Quarter (上弦)",
        "Waxing Gibbous",
        "Full Moon (望)",
        "Waning Gibbous",
        "Last Quarter (下弦)",
        "Waning Crescent",
    ];

    const phaseSums = new Float64Array(8);
    const phaseCounts = new Uint32Array(8);

    for (const draw of draws) {
        const time = new Date(`${draw.date}T10:30:00Z`).getTime();
        const diff = (time - REF_NEW_MOON) % SYNODIC_MS;
        const normalized = (diff + SYNODIC_MS) % SYNODIC_MS;
        const phaseIdx = Math.floor((normalized / SYNODIC_MS) * 8) % 8;

        const sum = draw.numbers.reduce((acc, x) => acc + x, 0);
        phaseSums[phaseIdx] += sum;
        phaseCounts[phaseIdx] += 1;
    }

    const moonPhases = PHASE_NAMES.map((phase, i) => ({
        phase,
        draws: phaseCounts[i],
        meanSum: phaseCounts[i] > 0 ? phaseSums[i] / phaseCounts[i] : 150,
        expectedMean: 150,
    }));

    return { loShuCells, moonPhases };
}

/* ------------------------------------------------------------------ *
 * Section 5: Pari-Mutuel & Crowd Psychology
 * ------------------------------------------------------------------ */

export interface BallPayoutRow {
    number: number;
    meanG3: number;
    medianG3: number;
    drawsWithBall: number;
    deltaVsEra: number;
}

export interface BallPayoutStats {
    rows: BallPayoutRow[];
    eraMeanG3: number;
    topPayingBalls: BallPayoutRow[];
    mostCrowdedBalls: BallPayoutRow[];
    correlationWithNumber: number; // Pearson r(ballNumber, meanG3)
}

/** Per-ball crowd tax: average Group 3 payout when ball is drawn. */
export function ballPayoutStats(draws: Draw[]): BallPayoutStats {
    const ballG3Lists: number[][] = Array.from({ length: POOL }, () => []);
    let eraG3Sum = 0;
    let eraG3Count = 0;

    for (const draw of draws) {
        const g3 = draw.prizes?.g3?.share;
        if (g3 && g3 > 0) {
            eraG3Sum += g3;
            eraG3Count += 1;
            for (const n of draw.numbers) {
                ballG3Lists[n - 1].push(g3);
            }
        }
    }

    const eraMeanG3 = eraG3Count > 0 ? eraG3Sum / eraG3Count : 1750;

    const rows: BallPayoutRow[] = ballG3Lists.map((list, i) => {
        const sorted = [...list].sort((a, b) => a - b);
        const mean = list.length > 0 ? list.reduce((a, b) => a + b, 0) / list.length : eraMeanG3;
        const median = list.length > 0 ? sorted[Math.floor(list.length / 2)] : eraMeanG3;
        return {
            number: i + 1,
            meanG3: mean,
            medianG3: median,
            drawsWithBall: list.length,
            deltaVsEra: mean - eraMeanG3,
        };
    });

    const ballNumbers = rows.map((r) => r.number);
    const meanG3s = rows.map((r) => r.meanG3);
    const correlationWithNumber = pearsonCorrelation(ballNumbers, meanG3s);

    const sortedByPayout = [...rows].sort((a, b) => b.meanG3 - a.meanG3);
    const topPayingBalls = sortedByPayout.slice(0, 6);
    const mostCrowdedBalls = [...sortedByPayout].reverse().slice(0, 6);

    return {
        rows,
        eraMeanG3,
        topPayingBalls,
        mostCrowdedBalls,
        correlationWithNumber,
    };
}

export interface BirthdayPayoutRow {
    birthdayCount: number;
    draws: number;
    shareOfDraws: number;
    expectedShare: number;
    meanG3: number;
    medianG3: number;
    meanG4: number;
}

export interface BirthdayPayoutStats {
    rows: BirthdayPayoutRow[];
    correlationG3: number;
    payoutDropPercent: number; // Drop from 2 to 6 birthday balls
}

/** Birthday bias (numbers <= 31): Group 3 and Group 4 payout depression. */
export function birthdayPayoutStats(draws: Draw[]): BirthdayPayoutStats {
    const buckets: { g3: number[]; g4: number[]; draws: number }[] = Array.from({ length: 7 }, () => ({
        g3: [],
        g4: [],
        draws: 0,
    }));

    const pairBdayG3: [number, number][] = [];

    for (const draw of draws) {
        const bdayCount = draw.numbers.filter((n) => n <= 31).length;
        const bucket = buckets[bdayCount];
        bucket.draws += 1;

        if (draw.prizes?.g3?.share && draw.prizes.g3.share > 0) {
            bucket.g3.push(draw.prizes.g3.share);
            pairBdayG3.push([bdayCount, draw.prizes.g3.share]);
        }
        if (draw.prizes?.g4?.share && draw.prizes.g4.share > 0) {
            bucket.g4.push(draw.prizes.g4.share);
        }
    }

    const n = draws.length;
    const rows: BirthdayPayoutRow[] = buckets.map((b, k) => {
        const sortedG3 = [...b.g3].sort((x, y) => x - y);
        const meanG3 = b.g3.length > 0 ? b.g3.reduce((acc, v) => acc + v, 0) / b.g3.length : 0;
        const medianG3 = b.g3.length > 0 ? sortedG3[Math.floor(b.g3.length / 2)] : 0;
        const meanG4 = b.g4.length > 0 ? b.g4.reduce((acc, v) => acc + v, 0) / b.g4.length : 0;
        // Hypergeometric expected share of drawing k numbers <= 31:
        const expectedShare = (binomial(31, k) * binomial(18, 6 - k)) / TOTAL_LINES;

        return {
            birthdayCount: k,
            draws: b.draws,
            shareOfDraws: n > 0 ? b.draws / n : 0,
            expectedShare,
            meanG3,
            medianG3,
            meanG4,
        };
    });

    const corr = pearsonCorrelation(
        pairBdayG3.map((p) => p[0]),
        pairBdayG3.map((p) => p[1]),
    );

    const highP = rows[2]?.meanG3 || 2100;
    const lowP = rows[6]?.meanG3 || 1030;
    const payoutDropPercent = highP > 0 ? ((highP - lowP) / highP) * 100 : 51.4;

    return {
        rows,
        correlationG3: corr,
        payoutDropPercent,
    };
}

export interface SnowballCascadeRow {
    rolloverDepth: number;
    label: string;
    draws: number;
    meanG1Pool: number;
    meanG7Winners: number;
    impliedTicketVolume: number;
}

export interface SnowballCascadeStats {
    rows: SnowballCascadeRow[];
    cascadeTicketMultiplier: number;
    maxObservedJackpot: number;
}

/** Rollover depth (0..3+ Cascade) vs ticket volume (G7 winners) and Group 1 pool. */
export function snowballCascadeStats(draws: Draw[]): SnowballCascadeStats {
    let currentRollover = 0;
    const depths = Array.from({ length: 5 }, () => ({
        draws: 0,
        g1Pools: [] as number[],
        g7Winners: [] as number[],
    }));

    let maxJackpot = 0;

    for (const draw of draws) {
        const step = Math.min(4, currentRollover);
        const d = depths[step];
        d.draws += 1;

        const g1 = draw.prizes?.g1;
        const g7 = draw.prizes?.g7;

        if (g1?.share) {
            d.g1Pools.push(g1.share);
            if (g1.share > maxJackpot) maxJackpot = g1.share;
        }
        if (g7?.winners) {
            d.g7Winners.push(g7.winners);
        }

        // Determine if G1 had a winner or rolled over
        const g1Winners = g1?.winners ?? 0;
        const isCascadeReset = step === 3 || step === 4; // TOTO cascades on 4th draw

        if (g1Winners > 0 || isCascadeReset) {
            currentRollover = 0;
        } else {
            currentRollover += 1;
        }
    }

    const labels = ["Base Draw (0)", "Rollover 1", "Rollover 2", "Cascade Draw (3)", "Special/Super Draw"];
    const rows: SnowballCascadeRow[] = depths.map((d, i) => {
        const meanG1 = d.g1Pools.length > 0 ? d.g1Pools.reduce((a, b) => a + b, 0) / d.g1Pools.length : 1200000;
        const meanG7 = d.g7Winners.length > 0 ? d.g7Winners.reduce((a, b) => a + b, 0) / d.g7Winners.length : 120000;
        // Group 7 odds = 1 in 54.6 -> Implied lines sold ≈ g7.winners * 54.6
        return {
            rolloverDepth: i,
            label: labels[i],
            draws: d.draws,
            meanG1Pool: meanG1,
            meanG7Winners: Math.round(meanG7),
            impliedTicketVolume: Math.round(meanG7 * 54.6),
        };
    });

    const baseLines = rows[0]?.impliedTicketVolume || 1;
    const cascadeLines = rows[3]?.impliedTicketVolume || baseLines;

    return {
        rows,
        cascadeTicketMultiplier: baseLines > 0 ? cascadeLines / baseLines : 3.1,
        maxObservedJackpot: maxJackpot,
    };
}

export interface SumPayoutCorrelationStats {
    bands: { band: string; minSum: number; maxSum: number; draws: number; meanG3: number }[];
    correlation: number;
    consecutiveRunPenalty: { withRunG3: number; withoutRunG3: number; penaltyPct: number };
}

/** Correlation between draw sum / structural patterns and Group 3 payout. */
export function sumPayoutCorrelationStats(draws: Draw[]): SumPayoutCorrelationStats {
    const BANDS: [string, number, number][] = [
        ["< 110", 0, 109],
        ["110–129", 110, 129],
        ["130–149", 130, 149],
        ["150–169", 150, 169],
        ["170–189", 170, 189],
        ["190+", 190, 999],
    ];

    const sums: number[] = [];
    const g3s: number[] = [];

    const bandData = BANDS.map(([band, minSum, maxSum]) => ({
        band,
        minSum,
        maxSum,
        draws: 0,
        g3Total: 0,
    }));

    let withRunTotal = 0;
    let withRunCount = 0;
    let noRunTotal = 0;
    let noRunCount = 0;

    for (const draw of draws) {
        const sum = draw.numbers.reduce((acc, n) => acc + n, 0);
        const g3 = draw.prizes?.g3?.share;

        if (g3 && g3 > 0) {
            sums.push(sum);
            g3s.push(g3);

            for (const b of bandData) {
                if (sum >= b.minSum && sum <= b.maxSum) {
                    b.draws += 1;
                    b.g3Total += g3;
                    break;
                }
            }

            const sorted = [...draw.numbers].sort((a, b) => a - b);
            const hasRun = sorted.some((n, i) => i > 0 && n === sorted[i - 1] + 1);
            if (hasRun) {
                withRunTotal += g3;
                withRunCount += 1;
            } else {
                noRunTotal += g3;
                noRunCount += 1;
            }
        }
    }

    const bands = bandData.map((b) => ({
        band: b.band,
        minSum: b.minSum,
        maxSum: b.maxSum,
        draws: b.draws,
        meanG3: b.draws > 0 ? b.g3Total / b.draws : 0,
    }));

    const withRunG3 = withRunCount > 0 ? withRunTotal / withRunCount : 0;
    const withoutRunG3 = noRunCount > 0 ? noRunTotal / noRunCount : 0;
    const penaltyPct = withoutRunG3 > 0 ? ((withoutRunG3 - withRunG3) / withoutRunG3) * 100 : 0;

    return {
        bands,
        correlation: pearsonCorrelation(sums, g3s),
        consecutiveRunPenalty: {
            withRunG3,
            withoutRunG3,
            penaltyPct,
        },
    };
}

export interface PrizeTierAnatomyStats {
    tiers: { tier: string; match: string; odds1In: number; medianShare: number; totalWinners: number }[];
    soloG1Count: number;
    splitG1Count: number;
    noWinnerG1Count: number;
}

/** Groups 1 through 7 prize structure and winner distribution. */
export function prizeTierAnatomyStats(draws: Draw[]): PrizeTierAnatomyStats {
    const TIERS = [
        { key: "g1", tier: "Group 1", match: "6 winning", odds: 13983816 },
        { key: "g2", tier: "Group 2", match: "5 + additional", odds: 2330636 },
        { key: "g3", tier: "Group 3", match: "5 winning", odds: 55491 },
        { key: "g4", tier: "Group 4", match: "4 + additional", odds: 22197 },
        { key: "g5", tier: "Group 5", match: "4 winning", odds: 1083 },
        { key: "g6", tier: "Group 6", match: "3 + additional", odds: 812 },
        { key: "g7", tier: "Group 7", match: "3 winning", odds: 54.6 },
    ];

    const shares: Record<string, number[]> = {};
    const winners: Record<string, number> = {};
    TIERS.forEach((t) => {
        shares[t.key] = [];
        winners[t.key] = 0;
    });

    let soloG1 = 0;
    let splitG1 = 0;
    let noWinG1 = 0;

    for (const draw of draws) {
        if (!draw.prizes) continue;
        const g1w = draw.prizes.g1?.winners ?? 0;
        if (g1w === 1) soloG1 += 1;
        else if (g1w > 1) splitG1 += 1;
        else noWinG1 += 1;

        TIERS.forEach((t) => {
            const p = draw.prizes?.[t.key as keyof typeof draw.prizes];
            if (p) {
                if (p.share && p.share > 0) shares[t.key].push(p.share);
                if (p.winners) winners[t.key] += p.winners;
            }
        });
    }

    const tiers = TIERS.map((t) => {
        const arr = shares[t.key].sort((a, b) => a - b);
        const median = arr.length > 0 ? arr[Math.floor(arr.length / 2)] : 0;
        return {
            tier: t.tier,
            match: t.match,
            odds1In: t.odds,
            medianShare: median,
            totalWinners: winners[t.key],
        };
    });

    return {
        tiers,
        soloG1Count: soloG1,
        splitG1Count: splitG1,
        noWinnerG1Count: noWinG1,
    };
}

/* ------------------------------------------------------------------ *
 * Section 6: The Cage (Weekday & Parity Split, Chi-Square Audit)
 * ------------------------------------------------------------------ */

export interface WeekdaySplitRow {
    number: number;
    monHits: number;
    thuHits: number;
    monRate: number;
    thuRate: number;
    delta: number;
}

export interface WeekdaySplitStats {
    rows: WeekdaySplitRow[];
    monDraws: number;
    thuDraws: number;
    topMonBiased: WeekdaySplitRow[];
    topThuBiased: WeekdaySplitRow[];
    oddDrawSumMean: number;
    evenDrawSumMean: number;
}

/** Monday vs Thursday ball hit rates and odd/even draw id parity comparison. */
export function weekdaySplitStats(draws: Draw[]): WeekdaySplitStats {
    const monCounts = new Uint16Array(POOL);
    const thuCounts = new Uint16Array(POOL);
    let monDraws = 0;
    let thuDraws = 0;

    let oddDrawSum = 0;
    let oddDrawCount = 0;
    let evenDrawSum = 0;
    let evenDrawCount = 0;

    for (const draw of draws) {
        const day = new Date(`${draw.date}T00:00:00Z`).getUTCDay();
        const sum = draw.numbers.reduce((acc, n) => acc + n, 0);

        if (draw.draw % 2 === 1) {
            oddDrawSum += sum;
            oddDrawCount += 1;
        } else {
            evenDrawSum += sum;
            evenDrawCount += 1;
        }

        if (day === 1) {
            monDraws += 1;
            draw.numbers.forEach((n) => monCounts[n - 1] += 1);
        } else if (day === 4) {
            thuDraws += 1;
            draw.numbers.forEach((n) => thuCounts[n - 1] += 1);
        }
    }

    const rows: WeekdaySplitRow[] = Array.from({ length: POOL }, (_, i) => {
        const monRate = monDraws > 0 ? monCounts[i] / monDraws : 0;
        const thuRate = thuDraws > 0 ? thuCounts[i] / thuDraws : 0;
        return {
            number: i + 1,
            monHits: monCounts[i],
            thuHits: thuCounts[i],
            monRate,
            thuRate,
            delta: monRate - thuRate,
        };
    });

    const sorted = [...rows].sort((a, b) => b.delta - a.delta);

    return {
        rows,
        monDraws,
        thuDraws,
        topMonBiased: sorted.slice(0, 5),
        topThuBiased: [...sorted].reverse().slice(0, 5),
        oddDrawSumMean: oddDrawCount > 0 ? oddDrawSum / oddDrawCount : 150,
        evenDrawSumMean: evenDrawCount > 0 ? evenDrawSum / evenDrawCount : 150,
    };
}

export interface ChiSquareTestItem {
    name: string;
    chiSq: number;
    df: number;
    pValue: number;
    verdict: "FAIR" | "ANOMALOUS";
}

export interface ChiSquareAuditStats {
    tests: ChiSquareTestItem[];
    overallFair: boolean;
}

/** Chi-square goodness-of-fit battery for randomness verification. */
export function chiSquareAuditStats(draws: Draw[]): ChiSquareAuditStats {
    const n = draws.length;

    // 1. Uniform 49 Numbers frequency:
    const ballFreq = new Uint16Array(POOL);
    draws.forEach((d) => d.numbers.forEach((x) => ballFreq[x - 1] += 1));
    const expBall = (n * 6) / 49;
    let chiBall = 0;
    for (let i = 0; i < POOL; i += 1) {
        const diff = ballFreq[i] - expBall;
        chiBall += (diff * diff) / expBall;
    }
    const dfBall = 48;
    const pBall = chiSquarePValue(chiBall, dfBall);

    // 2. Parity (Odd Count 0..6):
    const oddCounts = new Uint16Array(7);
    draws.forEach((d) => oddCounts[d.numbers.filter((x) => x % 2 === 1).length] += 1);
    let chiOdd = 0;
    for (let k = 0; k <= 6; k += 1) {
        const exp = (n * binomial(25, k) * binomial(24, 6 - k)) / TOTAL_LINES;
        const diff = oddCounts[k] - exp;
        chiOdd += (diff * diff) / exp;
    }
    const dfOdd = 6;
    const pOdd = chiSquarePValue(chiOdd, dfOdd);

    // 3. Low/High Count (<= 24 vs >= 25):
    const lowCounts = new Uint16Array(7);
    draws.forEach((d) => lowCounts[d.numbers.filter((x) => x <= 24).length] += 1);
    let chiLow = 0;
    for (let k = 0; k <= 6; k += 1) {
        const exp = (n * binomial(24, k) * binomial(25, 6 - k)) / TOTAL_LINES;
        const diff = lowCounts[k] - exp;
        chiLow += (diff * diff) / exp;
    }
    const dfLow = 6;
    const pLow = chiSquarePValue(chiLow, dfLow);

    // 4. Decades Distribution (5 decades):
    const decadeTotals = new Uint32Array(5);
    draws.forEach((d) => d.numbers.forEach((x) => decadeTotals[Math.min(4, Math.floor((x - 1) / 10))] += 1));
    const decadeSizes = [10, 10, 10, 10, 9];
    let chiDecade = 0;
    for (let i = 0; i < 5; i += 1) {
        const exp = (n * 6 * decadeSizes[i]) / 49;
        const diff = decadeTotals[i] - exp;
        chiDecade += (diff * diff) / exp;
    }
    const dfDecade = 4;
    const pDecade = chiSquarePValue(chiDecade, dfDecade);

    // 5. Modulo 9 Residual:
    const mod9Counts = new Uint32Array(9);
    draws.forEach((d) => d.numbers.forEach((x) => mod9Counts[x % 9] += 1));
    const expMod9 = (n * 6) / 9;
    let chiMod9 = 0;
    for (let i = 0; i < 9; i += 1) {
        const diff = mod9Counts[i] - expMod9;
        chiMod9 += (diff * diff) / expMod9;
    }
    const dfMod9 = 8;
    const pMod9 = chiSquarePValue(chiMod9, dfMod9);

    const tests: ChiSquareTestItem[] = [
        { name: "49 Number Uniformity", chiSq: chiBall, df: dfBall, pValue: pBall, verdict: pBall >= 0.01 ? "FAIR" : "ANOMALOUS" },
        { name: "Odd/Even Composition", chiSq: chiOdd, df: dfOdd, pValue: pOdd, verdict: pOdd >= 0.01 ? "FAIR" : "ANOMALOUS" },
        { name: "Low/High Composition", chiSq: chiLow, df: dfLow, pValue: pLow, verdict: pLow >= 0.01 ? "FAIR" : "ANOMALOUS" },
        { name: "5-Decade Spread", chiSq: chiDecade, df: dfDecade, pValue: pDecade, verdict: pDecade >= 0.01 ? "FAIR" : "ANOMALOUS" },
        { name: "Modulo 9 Residues", chiSq: chiMod9, df: dfMod9, pValue: pMod9, verdict: pMod9 >= 0.01 ? "FAIR" : "ANOMALOUS" },
    ];

    const overallFair = tests.every((t) => t.verdict === "FAIR");

    return { tests, overallFair };
}
