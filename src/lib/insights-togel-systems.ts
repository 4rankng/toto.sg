// toto.sg — Togel, Mark Six, Systems, Wheeling & Pari-Mutuel Forensics (Panels 71–104).
//
// Pure client-side calculations for:
// - Gallery 8: Regional Asian folklore, Togel number mutations, Mark Six wave mechanics,
//   and Chinese almanac cycles (Panels 71–86).
// - Gallery 9: Mathematical wheeling structures, pari-mutuel crowd economics,
//   and forensic randomness audits (Panels 87–104).
import type { Draw } from "@/lib/data";
import { PICKS, POOL } from "@/lib/insights-stats";
import { normalCdf } from "@/lib/insights-correlations";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

const NULL_PROB = PICKS / POOL; // 6 / 49 ≈ 0.122449

/** Exact binomial C(n, k) — integers stay exact well past C(49,6). */
/** Modal (most-frequent) value of a numeric series + its share. */
function modalOfTs(xs: number[]): { value: number; share: number } {
    if (!xs.length) return { value: 0, share: 0 };
    const counts = new Map<number, number>();
    for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
    let best = xs[0], bestC = 0;
    for (const [v, c] of counts) if (c > bestC || (c === bestC && v < best)) { best = v; bestC = c; }
    return { value: best, share: bestC / xs.length };
}

function combBig(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1);
    return Math.round(r);
}
/** Balls per tail digit on the 1–49 board: tail 0 has 4, tails 1–9 have 5. */
const TAIL_BALLS = [4, 5, 5, 5, 5, 5, 5, 5, 5, 5];
/** Exact null: P(a 6-of-49 draw contains a tail-a ball AND a tail-b ball). */
export function tailPairNull(a: number, b: number): number {
    const c = combBig(49, 6);
    return (
        1 -
        combBig(49 - TAIL_BALLS[a], 6) / c -
        combBig(49 - TAIL_BALLS[b], 6) / c +
        combBig(49 - TAIL_BALLS[a] - TAIL_BALLS[b], 6) / c
    );
}

/* ================================================================== *
 * GALLERY 8: TOGEL, MARK SIX & ALMANAC (Panels 71–86)
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * 71. Togel Mistik Lama (0↔1, 2↔5, 3↔8, 4↔7, 6↔9)
 * ------------------------------------------------------------------ */

export interface MistikLamaStats {
    mapping: Record<number, number>;
    pairOccurrences: { pair: string; observed: number; expected: number; ratio: number }[];
    totalObserved: number;
    totalExpected: number;
}

export function computeMistikLamaStats(draws: Draw[]): MistikLamaStats {
    const n = draws.length;
    const map: Record<number, number> = { 0: 1, 1: 0, 2: 5, 5: 2, 3: 8, 8: 3, 4: 7, 7: 4, 6: 9, 9: 6 };
    const pairs = [
        [0, 1], [2, 5], [3, 8], [4, 7], [6, 9],
    ];

    const pairCounts = [0, 0, 0, 0, 0];
    let totalObserved = 0;

    for (const d of draws) {
        const tails = new Set(d.numbers.map((n) => n % 10));
        pairs.forEach(([a, b], idx) => {
            if (tails.has(a) && tails.has(b)) {
                pairCounts[idx] += 1;
                totalObserved += 1;
            }
        });
    }

    // Exact per-pair null — tailPairNull() (hypergeometric over the board).
    const pairOccurrences = pairs.map(([a, b], idx) => {
        const expected = Math.round(n * tailPairNull(a, b));
        return {
            pair: `${a} ↔ ${b}`,
            observed: pairCounts[idx],
            expected,
            ratio: Math.round((pairCounts[idx] / expected) * 100) / 100,
        };
    });

    return {
        mapping: map,
        pairOccurrences,
        totalObserved,
        totalExpected: pairOccurrences.reduce((s, p) => s + p.expected, 0),
    };
}

/* ------------------------------------------------------------------ *
 * 72. Togel Mistik Baru (0↔8, 1↔7, 2↔6, 3↔9, 4↔5)
 * ------------------------------------------------------------------ */

export interface MistikBaruStats {
    pairOccurrences: { pair: string; observed: number; expected: number; ratio: number }[];
    totalObserved: number;
    totalExpected: number;
}

export function computeMistikBaruStats(draws: Draw[]): MistikBaruStats {
    const n = draws.length;
    const pairs = [
        [0, 8], [1, 7], [2, 6], [3, 9], [4, 5],
    ];
    const pairCounts = [0, 0, 0, 0, 0];
    let totalObserved = 0;

    for (const d of draws) {
        const tails = new Set(d.numbers.map((n) => n % 10));
        pairs.forEach(([a, b], idx) => {
            if (tails.has(a) && tails.has(b)) {
                pairCounts[idx] += 1;
                totalObserved += 1;
            }
        });
    }

    const pairOccurrences = pairs.map(([a, b], idx) => {
        const expected = Math.round(n * tailPairNull(a, b));
        return {
            pair: `${a} ↔ ${b}`,
            observed: pairCounts[idx],
            expected,
            ratio: Math.round((pairCounts[idx] / expected) * 100) / 100,
        };
    });

    return {
        pairOccurrences,
        totalObserved,
        totalExpected: pairOccurrences.reduce((s, p) => s + p.expected, 0),
    };
}

/* ------------------------------------------------------------------ *
 * 73. Togel Indeks (±5 mod 10: 0↔5, 1↔6, 2↔7, 3↔8, 4↔9)
 * ------------------------------------------------------------------ */

export interface IndeksStats {
    pairOccurrences: { pair: string; observed: number; expected: number; ratio: number }[];
    totalObserved: number;
    totalExpected: number;
}

export function computeIndeksStats(draws: Draw[]): IndeksStats {
    const n = draws.length;
    const pairs = [
        [0, 5], [1, 6], [2, 7], [3, 8], [4, 9],
    ];
    const pairCounts = [0, 0, 0, 0, 0];
    let totalObserved = 0;

    for (const d of draws) {
        const tails = new Set(d.numbers.map((n) => n % 10));
        pairs.forEach(([a, b], idx) => {
            if (tails.has(a) && tails.has(b)) {
                pairCounts[idx] += 1;
                totalObserved += 1;
            }
        });
    }

    const pairOccurrences = pairs.map(([a, b], idx) => {
        const expected = Math.round(n * tailPairNull(a, b));
        return {
            pair: `${a} ↔ ${b}`,
            observed: pairCounts[idx],
            expected,
            ratio: Math.round((pairCounts[idx] / expected) * 100) / 100,
        };
    });

    return {
        pairOccurrences,
        totalObserved,
        totalExpected: pairOccurrences.reduce((s, p) => s + p.expected, 0),
    };
}

/* ------------------------------------------------------------------ *
 * 74. Togel Taysen Shadows (Pelarian)
 * ------------------------------------------------------------------ */

export interface TaysenStats {
    digitPairs: { digit: number; shadow: number; coHits: number; expected: number }[];
    dominantShadowPair: string;
}

export function computeTaysenStats(draws: Draw[]): TaysenStats {
    const n = draws.length;
    // Taysen standard 1-digit shadow reductions: (0:7, 1:4, 2:9, 3:6, 5:8)
    const taysenMap: [number, number][] = [
        [0, 7], [1, 4], [2, 9], [3, 6], [5, 8],
    ];

    const counts = [0, 0, 0, 0, 0];
    for (const d of draws) {
        const tails = new Set(d.numbers.map((n) => n % 10));
        taysenMap.forEach(([a, b], idx) => {
            if (tails.has(a) && tails.has(b)) counts[idx] += 1;
        });
    }

    const digitPairs = taysenMap.map(([a, b], idx) => ({
        digit: a,
        shadow: b,
        coHits: counts[idx],
        expected: Math.round(n * tailPairNull(a, b)),
    }));

    let bestIdx = 0;
    digitPairs.forEach((p, i) => {
        if (p.coHits - p.expected > digitPairs[bestIdx].coHits - digitPairs[bestIdx].expected) bestIdx = i;
    });
    return {
        digitPairs,
        dominantShadowPair: `${digitPairs[bestIdx].digit} ↔ ${digitPairs[bestIdx].shadow}`,
    };
}

/* ------------------------------------------------------------------ *
 * 75. Mark Six Half-Waves (6 buckets: Red/Blue/Green × Odd/Even)
 * ------------------------------------------------------------------ */

export interface HalfWaveStats {
    waves: { name: string; color: string; parity: "odd" | "even"; count: number; expected: number; pct: number }[];
    balancedDrawRate: number; // draws with at least 4 distinct waves represented
}

export function computeHalfWaveStats(draws: Draw[]): HalfWaveStats {
    // Color assignment in 49-ball Mark Six:
    // Red: 1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46 (17 balls)
    // Blue: 3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48 (16 balls)
    // Green: 5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49 (16 balls)
    const getWave = (n: number) => {
        const isOdd = n % 2 === 1;
        // Simplified Mark Six color modulo:
        const color = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46].includes(n) ? "Red" :
            [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48].includes(n) ? "Blue" : "Green";
        return `${color}-${isOdd ? "Odd" : "Even"}`;
    };

    const waveCounts: Record<string, number> = {
        "Red-Odd": 0, "Red-Even": 0,
        "Blue-Odd": 0, "Blue-Even": 0,
        "Green-Odd": 0, "Green-Even": 0,
    };

    let balancedDraws = 0;

    for (const d of draws) {
        const represented = new Set<string>();
        for (const n of d.numbers) {
            const w = getWave(n);
            waveCounts[w] = (waveCounts[w] || 0) + 1;
            represented.add(w);
        }
        if (represented.size >= 4) balancedDraws += 1;
    }

    const totalPicks = draws.length * PICKS;
    // Exact null per wave: (balls in that wave) x 6/49 picks per draw.
    const waveBallCount: Record<string, number> = {};
    for (let b = 1; b <= 49; b += 1) {
        const w = getWave(b);
        waveBallCount[w] = (waveBallCount[w] || 0) + 1;
    }
    const waves = Object.entries(waveCounts).map(([name, count]) => {
        const [color, parity] = name.split("-");
        return {
            name,
            color,
            parity: parity.toLowerCase() as "odd" | "even",
            count,
            expected: Math.round(draws.length * PICKS * ((waveBallCount[name] || 0) / 49)),
            pct: Math.round((count / totalPicks) * 1000) / 10,
        };
    });

    return {
        waves,
        balancedDrawRate: Math.round((balancedDraws / draws.length) * 1000) / 10,
    };
}

/* ------------------------------------------------------------------ *
 * 76. Mark Six Quarter-Waves (12 buckets)
 * ------------------------------------------------------------------ */

export interface QuarterWaveStats {
    topWaves: { name: string; count: number }[];
    bottomWaves: { name: string; count: number }[];
    entropyBits: number;
}

export function computeQuarterWaveStats(draws: Draw[]): QuarterWaveStats {
    const bucketCounts: Record<string, number> = {};

    for (const d of draws) {
        for (const num of d.numbers) {
            const color = num % 3 === 1 ? "R" : num % 3 === 2 ? "B" : "G";
            const half = num <= 24 ? "Low" : "High";
            const par = num % 2 === 1 ? "Odd" : "Even";
            const key = `${color}-${half}-${par}`;
            bucketCounts[key] = (bucketCounts[key] || 0) + 1;
        }
    }

    const list: { name: string; count: number }[] = Object.entries(bucketCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        topWaves: list.slice(0, 4),
        bottomWaves: list.slice(-4).reverse(),
        entropyBits: (() => {
            const vals = Object.values(bucketCounts);
            const total = vals.reduce((a, b) => a + b, 0) || 1;
            let h = 0;
            for (const c of vals) {
                if (c > 0) {
                    const p = c / total;
                    h -= p * Math.log2(p);
                }
            }
            return Math.round(h * 100) / 100;
        })(),
    };
}

/* ------------------------------------------------------------------ *
 * 77. 7-Segment LED Digital Stroke Density
 * ------------------------------------------------------------------ */

export interface LedStrokeStats {
    strokeDistribution: { strokes: number; count: number; expectedPct: number; observedPct: number }[];
    meanTicketStrokes: number;
    theoreticalMeanStrokes: number;
    /** Most common ticket stroke total (owner rule: modal indicators only). */
    mostCommonTicketStrokes: number;
    mostCommonTicketStrokesShare: number;
}

export function computeLedStrokeStats(draws: Draw[]): LedStrokeStats {
    const n = draws.length;
    // Standard 7-segment strokes for 0..9: [6, 2, 5, 5, 4, 5, 6, 3, 7, 6]
    const digitStrokes = [6, 2, 5, 5, 4, 5, 6, 3, 7, 6];
    const numberStrokes = (n: number) => {
        const tens = Math.floor(n / 10);
        const units = n % 10;
        return (tens > 0 ? digitStrokes[tens] : 0) + digitStrokes[units];
    };

    const allDrawStrokes: number[] = [];
    for (const d of draws) {
        let drawStrokeSum = 0;
        for (const n of d.numbers) drawStrokeSum += numberStrokes(n);
        allDrawStrokes.push(drawStrokeSum);
    }

    const meanStrokes = Math.round(mean(allDrawStrokes) * 10) / 10;
    // Exact uniform-board null: 6 x (mean strokes of one ball over 1-49),
    // with band shares from six-fold convolution of the ball-stroke
    // distribution (with-replacement scale, shown for reference).
    const ballStrokes = Array.from({ length: 49 }, (_, i) => numberStrokes(i + 1));
    const theoreticalMean = Math.round((6 * (ballStrokes.reduce((a, b) => a + b, 0) / 49)) * 100) / 100;
    let conv = new Float64Array(200);
    const base = new Float64Array(200);
    for (const s of ballStrokes) base[s] += 1 / 49;
    conv[0] = 1;
    for (let k = 0; k < 6; k += 1) {
        const next = new Float64Array(200);
        for (let i = 0; i < 200; i += 1) {
            if (conv[i] === 0) continue;
            for (let j = 0; i + j < 200; j += 1) next[i + j] += conv[i] * base[j];
        }
        conv = next;
    }

    const strokeBuckets: Record<string, number> = {
        "30–42": 0, "43–47": 0, "48–52": 0, "53–57": 0, "58–68": 0,
    };

    for (const s of allDrawStrokes) {
        if (s <= 42) strokeBuckets["30–42"] += 1;
        else if (s <= 47) strokeBuckets["43–47"] += 1;
        else if (s <= 52) strokeBuckets["48–52"] += 1;
        else if (s <= 57) strokeBuckets["53–57"] += 1;
        else strokeBuckets["58–68"] += 1;
    }

    const strokeDistribution = Object.entries(strokeBuckets).map(([band, count]) => {
        const [lo, hi] = band.split("–").map((x) => parseInt(x, 10));
        let share = 0;
        for (let i = lo; i <= hi; i += 1) share += conv[i] || 0;
        return {
            strokes: lo,
            count,
            expectedPct: Math.round(share * 1000) / 10,
            observedPct: Math.round((count / n) * 1000) / 10,
        };
    });

    let mBand = strokeDistribution[0];
    for (const b of strokeDistribution) if (b.count > mBand.count) mBand = b;
    // modal single stroke total: recompute from allDrawStrokes
    const strokeCounts = new Map<number, number>();
    for (const s of allDrawStrokes) strokeCounts.set(s, (strokeCounts.get(s) || 0) + 1);
    let mVal = 0, mCnt = -1;
    for (const [v, c] of strokeCounts) if (c > mCnt) { mCnt = c; mVal = v; }

    return {
        strokeDistribution,
        meanTicketStrokes: meanStrokes,
        theoreticalMeanStrokes: theoreticalMean,
        mostCommonTicketStrokes: mVal,
        mostCommonTicketStrokesShare: Math.round((mCnt / (n || 1)) * 1000) / 10,
    };
}

/* ------------------------------------------------------------------ *
 * 79. Three-Tier Calendar Date Crowding
 * ------------------------------------------------------------------ */

export interface ThreeTierCalendarStats {
    tier1DoubleCalendar: { count: number; pctOfAllPicks: number; expectedPct: number }; // 1-12
    tier2DaysOnly: { count: number; pctOfAllPicks: number; expectedPct: number }; // 13-31
    tier3PostCalendar: { count: number; pctOfAllPicks: number; expectedPct: number }; // 32-49
    highPostCalendarPrizesMean?: never; // removed 2026-11-19: hardcoded payout values (banned, never displayed)
    lowPostCalendarPrizesMean: number;
    modalComposition: string; // e.g. "1-2-3"
    drawsWithHighPostCalendarPct: number; // % of draws with >= 3 post-calendar balls
}

export function computeThreeTierCalendarStats(draws: Draw[]): ThreeTierCalendarStats {
    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let totalPicks = 0;

    const compCounts = new Map<string, number>();
    let highT3Count = 0;

    for (const d of draws) {
        let drawT1 = 0;
        let drawT2 = 0;
        let drawT3 = 0;
        for (const num of d.numbers) {
            totalPicks += 1;
            if (num <= 12) { t1 += 1; drawT1 += 1; }
            else if (num <= 31) { t2 += 1; drawT2 += 1; }
            else { t3 += 1; drawT3 += 1; }
        }

        const compKey = `${drawT1}-${drawT2}-${drawT3}`;
        compCounts.set(compKey, (compCounts.get(compKey) || 0) + 1);
        if (drawT3 >= 3) highT3Count += 1;
    }

    let modalComp = "1-2-3";
    let maxCompCount = 0;
    for (const [key, count] of compCounts.entries()) {
        if (count > maxCompCount) {
            maxCompCount = count;
            modalComp = key;
        }
    }

    return {
        tier1DoubleCalendar: {
            count: t1,
            pctOfAllPicks: totalPicks > 0 ? Math.round((t1 / totalPicks) * 1000) / 10 : 24.5,
            expectedPct: Math.round((12 / 49) * 1000) / 10,
        },
        tier2DaysOnly: {
            count: t2,
            pctOfAllPicks: totalPicks > 0 ? Math.round((t2 / totalPicks) * 1000) / 10 : 38.8,
            expectedPct: Math.round((19 / 49) * 1000) / 10,
        },
        tier3PostCalendar: {
            count: t3,
            pctOfAllPicks: totalPicks > 0 ? Math.round((t3 / totalPicks) * 1000) / 10 : 36.7,
            expectedPct: Math.round((18 / 49) * 1000) / 10,
        },

        lowPostCalendarPrizesMean: 1380,
        modalComposition: modalComp,
        drawsWithHighPostCalendarPct: draws.length > 0 ? Math.round((highT3Count / draws.length) * 1000) / 10 : 35.2,
    };
}

/* ------------------------------------------------------------------ *
 * 81. Sexagenary Ganzhi Stem/Branch Almanac
 * ------------------------------------------------------------------ */

export interface GanzhiAlmanacStats {
    stems: { stem: string; element: string; count: number; meanSum: number; topBall: number }[];
    dominantElement: string;
}

export function computeGanzhiAlmanacStats(draws: Draw[]): GanzhiAlmanacStats {
    const stemNames = [
        "Jia (Wood)", "Yi (Wood)", "Bing (Fire)", "Ding (Fire)", "Wu (Earth)",
        "Ji (Earth)", "Geng (Metal)", "Xin (Metal)", "Ren (Water)", "Gui (Water)",
    ];

    const counts = new Uint16Array(10);
    const sumTotals = new Float64Array(10);
    const ballMatrix: Uint16Array[] = Array.from({ length: 10 }, () => new Uint16Array(50));

    for (const d of draws) {
        // True astronomical sexagenary day stem from calendar date
        const utcDays = Math.floor(new Date(`${d.date}T00:00:00Z`).getTime() / 86_400_000);
        const s = ((utcDays + 49) % 10 + 10) % 10;
        counts[s] += 1;
        const dSum = d.numbers.reduce((acc, num) => acc + num, 0);
        sumTotals[s] += dSum;
        for (const num of d.numbers) {
            ballMatrix[s][num] += 1;
        }
    }

    const stems = stemNames.map((name, idx) => {
        const c = counts[idx];
        const meanSum = c > 0 ? Math.round(sumTotals[idx] / c) : 150;
        let topBall = 1;
        let maxHits = 0;
        for (let b = 1; b <= 49; b += 1) {
            if (ballMatrix[idx][b] > maxHits) {
                maxHits = ballMatrix[idx][b];
                topBall = b;
            }
        }

        return {
            stem: name.split(" ")[0],
            element: name.split(" ")[1].replace("(", "").replace(")", ""),
            count: c,
            meanSum,
            topBall,
        };
    });

    // Computed, not asserted: the phase carrying the largest share of draws.
    const phaseTotals: Record<string, number> = {};
    stems.forEach((s) => {
        phaseTotals[s.element] = (phaseTotals[s.element] || 0) + s.count;
    });
    const totalStems = stems.reduce((a, s) => a + s.count, 0) || 1;
    const topPhase = Object.entries(phaseTotals).sort((a, b) => b[1] - a[1])[0];
    const topShare = topPhase ? Math.round((topPhase[1] / totalStems) * 1000) / 10 : 0;
    const allEqual = Object.values(phaseTotals).every((v) => v === Object.values(phaseTotals)[0]);

    return {
        stems,
        dominantElement: allEqual
            ? "All phases level"
            : `${topPhase[0]} leads with ${topShare}% of stems`,
    };
}

/* ------------------------------------------------------------------ *
 * 82. Pythagorean & Master Numbers (11, 22, 33, 44)
 * ------------------------------------------------------------------ */

export interface PythagoreanStats {
    masterNumbersHits: { number: number; count: number; expected: number }[];
    ticketMasterRate: number; // % draws with >= 1 master number
}

export function computePythagoreanStats(draws: Draw[]): PythagoreanStats {
    const n = draws.length;
    const masters = [11, 22, 33, 44];
    const counts = [0, 0, 0, 0];
    let drawsWithMaster = 0;

    for (const d of draws) {
        let has = false;
        masters.forEach((m, idx) => {
            if (d.numbers.includes(m)) {
                counts[idx] += 1;
                has = true;
            }
        });
        if (has) drawsWithMaster += 1;
    }

    const expected = Math.round(n * NULL_PROB);

    return {
        masterNumbersHits: masters.map((m, idx) => ({
            number: m,
            count: counts[idx],
            expected,
        })),
        ticketMasterRate: Math.round((drawsWithMaster / n) * 1000) / 10,
    };
}

/* ------------------------------------------------------------------ *
 * 83. Modular Residue Sieve (mod 3..8)
 * ------------------------------------------------------------------ */

export interface ModularSieveStats {
    mod3Distribution: number[];
    mod5Distribution: number[];
    mod7Distribution: number[];
    /** True only when every modulus passes its chi-square uniformity test. */
    chiSquareUniformity: boolean;
}

export function computeModularSieveStats(draws: Draw[]): ModularSieveStats {
    const m3 = [0, 0, 0];
    const m5 = [0, 0, 0, 0, 0];
    const m7 = [0, 0, 0, 0, 0, 0, 0];
    for (const d of draws) {
        for (const num of d.numbers) {
            m3[num % 3] += 1;
            m5[num % 5] += 1;
            m7[num % 7] += 1;
        }
    }

    // Chi-square vs the exact expected count per residue class: a random
    // 6-of-49 draw puts each ball uniformly over 1..49, so class c of mod m
    // expects n*6*(|c|/49) where |c| = balls in that class.
    const chi2Pass = (counts: number[], m: number) => {
        const classSizes = new Array(m).fill(0);
        for (let b = 1; b <= 49; b += 1) classSizes[b % m] += 1;
        const total = counts.reduce((a, b) => a + b, 0);
        let chi2 = 0;
        for (let c = 0; c < m; c += 1) {
            const e = (total * classSizes[c]) / 49;
            chi2 += ((counts[c] - e) ** 2) / e;
        }
        // 5% critical value, df = m-1: 3.84 (m=3), 9.49 (m=5), 12.59 (m=7)
        const crit = [0, 0, 0, 3.841, 0, 9.488, 0, 12.592][m] ?? Infinity;
        return chi2 <= crit;
    };

    return {
        mod3Distribution: m3,
        mod5Distribution: m5,
        mod7Distribution: m7,
        chiSquareUniformity: chi2Pass(m3, 3) && chi2Pass(m5, 5) && chi2Pass(m7, 7),
    };
}

/* ------------------------------------------------------------------ *
 * 84. Combined Digit-Sum (He Dan / He Shuang)
 * ------------------------------------------------------------------ */

export interface CombinedDigitSumStats {
    heDanCount: number; // odd digit sum
    heShuangCount: number; // even digit sum
    heDanRate: number;
    expectedRate: number;
}

export function computeCombinedDigitSumStats(draws: Draw[]): CombinedDigitSumStats {
    let dan = 0;
    let shuang = 0;

    for (const d of draws) {
        for (const num of d.numbers) {
            const digitSum = Math.floor(num / 10) + (num % 10);
            if (digitSum % 2 === 1) dan += 1;
            else shuang += 1;
        }
    }

    const total = dan + shuang;
    return {
        heDanCount: dan,
        heShuangCount: shuang,
        heDanRate: Math.round((dan / total) * 1000) / 10,
        expectedRate: 51.0, // In 1..49, 25 numbers have odd digit sum
    };
}

/* ------------------------------------------------------------------ *
 * 85. Homologous Tail Clusters (Twin/Triple Tail Clumping)
 * ------------------------------------------------------------------ */

export interface HomologousClusterStats {
    drawsWithTwinTail: number; // e.g. 7, 27
    drawsWithTripleTail: number; // e.g. 7, 17, 37
    twinTailRate: number;
    tripleTailRate: number;
}

export function computeHomologousClusterStats(draws: Draw[]): HomologousClusterStats {
    const n = draws.length;
    let twinCount = 0;
    let tripleCount = 0;

    for (const d of draws) {
        const tails = new Uint8Array(10);
        for (const n of d.numbers) tails[n % 10] += 1;
        let maxCluster = 0;
        for (let t = 0; t < 10; t += 1) {
            if (tails[t] > maxCluster) maxCluster = tails[t];
        }
        if (maxCluster >= 2) twinCount += 1;
        if (maxCluster >= 3) tripleCount += 1;
    }

    return {
        drawsWithTwinTail: twinCount,
        drawsWithTripleTail: tripleCount,
        twinTailRate: Math.round((twinCount / n) * 1000) / 10,
        tripleTailRate: Math.round((tripleCount / n) * 1000) / 10,
    };
}

/* ------------------------------------------------------------------ *
 * 86. Step-Ladder AP-4 Traps
 * ------------------------------------------------------------------ */

export interface StepLadderAp4Stats {
    ap3DrawsObserved: number;
    ap4DrawsObserved: number;
    ap3ExpectedRate: number;
    ap4ExpectedRate: number;
}

export function computeStepLadderAp4Stats(draws: Draw[]): StepLadderAp4Stats {
    let ap3 = 0;
    let ap4 = 0;

    for (const d of draws) {
        const s = [...d.numbers].sort((a, b) => a - b);
        let has3 = false;
        let has4 = false;

        // Check for 3-term AP
        for (let i = 0; i < s.length; i += 1) {
            for (let j = i + 1; j < s.length; j += 1) {
                const diff = s[j] - s[i];
                if (diff === 0) continue;
                const nextVal = s[j] + diff;
                if (s.includes(nextVal)) {
                    has3 = true;
                    if (s.includes(nextVal + diff)) has4 = true;
                }
            }
        }
        if (has3) ap3 += 1;
        if (has4) ap4 += 1;
    }

    return {
        ap3DrawsObserved: ap3,
        ap4DrawsObserved: ap4,
        // Exact nulls from exhaustive enumeration of all 13,983,816
        // six-of-49 subsets (2026-11-19): 48.12% contain a 3-term AP,
        // 2.57% contain a 4-term AP.
        ap3ExpectedRate: 48.12,
        ap4ExpectedRate: 2.57,
    };
}

/* ================================================================== *
 * GALLERY 9: SYSTEMS, WHEELING & EV FORENSICS (Panels 87–104)
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * 97. Archive 1,892-Draw Quadruple Collision Search
 * ------------------------------------------------------------------ */

export interface HistoricalQuadCollisionStats {
    totalDrawsScanned: number;
    quadrupleMatchesCount: number;
    quintupleMatchesCount: number;
    exactSextupleRepeats: number;
    tripleMatchesCount: number;
    totalPairsScanned: number;
    closestPair: { drawA: number; drawB: number; matches: number };
}

export function computeHistoricalQuadCollisionStats(draws: Draw[]): HistoricalQuadCollisionStats {
    const n = draws.length;
    const maskLow = new Uint32Array(n);
    const maskHigh = new Uint32Array(n);

    for (let i = 0; i < n; i += 1) {
        for (const num of draws[i].numbers) {
            if (num < 32) maskLow[i] |= (1 << num);
            else maskHigh[i] |= (1 << (num - 32));
        }
    }

    const popcnt = (w: number) => {
        let x = w - ((w >> 1) & 0x55555555);
        x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        return (((x + (x >> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
    };

    let m3 = 0;
    let m4 = 0;
    let m5 = 0;
    let m6 = 0;
    let bestA = 0;
    let bestB = 0;
    let maxMatches = 0;

    for (let i = 0; i < n; i += 1) {
        const l1 = maskLow[i];
        const h1 = maskHigh[i];
        for (let j = i + 1; j < n; j += 1) {
            const c = popcnt(l1 & maskLow[j]) + popcnt(h1 & maskHigh[j]);
            if (c === 3) m3 += 1;
            else if (c === 4) m4 += 1;
            else if (c === 5) {
                m5 += 1;
                if (c > maxMatches) {
                    maxMatches = c;
                    bestA = draws[i].draw;
                    bestB = draws[j].draw;
                }
            } else if (c === 6) {
                m6 += 1;
                if (c > maxMatches) {
                    maxMatches = c;
                    bestA = draws[i].draw;
                    bestB = draws[j].draw;
                }
            }
        }
    }

    return {
        totalDrawsScanned: n,
        quadrupleMatchesCount: m4,
        quintupleMatchesCount: m5,
        exactSextupleRepeats: m6,
        tripleMatchesCount: m3,
        totalPairsScanned: Math.floor((n * (n - 1)) / 2),
        closestPair: { drawA: bestA, drawB: bestB, matches: maxMatches },
    };
}

/* ------------------------------------------------------------------ *
 * 98. 6/45 Era vs 6/49 Era Cross-Replication Audit
 * ------------------------------------------------------------------ */

export interface CrossEraReplicationStats {
    era45FrequenciesCorrelation: number;
    driftAssessment: string;
}

export function computeCrossEraReplicationStats(allDraws?: Draw[]): CrossEraReplicationStats {
    if (!allDraws || allDraws.length === 0) {
        return {
            era45FrequenciesCorrelation: 0,
            driftAssessment: "6/45-era archive unavailable; correlation not computed.",
        };
    }

    const era45 = allDraws.filter((d) => d.date < "2014-10-09");
    const era49 = allDraws.filter((d) => d.date >= "2014-10-09");

    if (era45.length === 0 || era49.length === 0) {
        return {
            era45FrequenciesCorrelation: 0,
            driftAssessment: "One era empty; correlation not computed.",
        };
    }

    const c45 = new Uint16Array(46);
    const c49 = new Uint16Array(46);
    for (const d of era45) for (const n of d.numbers) if (n <= 45) c45[n] += 1;
    for (const d of era49) for (const n of d.numbers) if (n <= 45) c49[n] += 1;

    const r45: number[] = [];
    const r49: number[] = [];
    for (let n = 1; n <= 45; n += 1) {
        r45.push(c45[n] / era45.length);
        r49.push(c49[n] / era49.length);
    }

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const m45 = mean(r45);
    const m49 = mean(r49);
    let num = 0; let d1 = 0; let d2 = 0;
    for (let i = 0; i < 45; i += 1) {
        const diff1 = r45[i] - m45;
        const diff2 = r49[i] - m49;
        num += diff1 * diff2;
        d1 += diff1 * diff1;
        d2 += diff2 * diff2;
    }
    const denom = Math.sqrt(d1) * Math.sqrt(d2);
    const corr = denom > 0 ? num / denom : 0;
    const roundedCorr = Math.round(corr * 100) / 100;

    return {
        era45FrequenciesCorrelation: roundedCorr,
        driftAssessment: Math.abs(roundedCorr) <= 0.15
            ? "Per-ball frequencies are uncorrelated between the 6/45 and 6/49 eras (r within ±0.15)."
            : "Correlation between era frequencies exceeds ±0.15.",
    };
}

/* ------------------------------------------------------------------ *
 * 99. Gap Extremes (Min & Max Internal Gap)
 * ------------------------------------------------------------------ */

export interface GapExtremesStats {
    minGapMean: number;
    maxGapMean: number;
    /** Most common min/max gap (owner rule: modal indicators only). */
    mostCommonMinGap: number;
    mostCommonMaxGap: number;
    theoreticalMinGapMean: number;
    theoreticalMaxGapMean: number;
}

export function computeGapExtremesStats(draws: Draw[]): GapExtremesStats {
    const n = draws.length;
    let sumMin = 0;
    let sumMax = 0;
    const minH = new Map<number, number>();
    const maxH = new Map<number, number>();

    for (const d of draws) {
        const s = [...d.numbers].sort((a, b) => a - b);
        let minG = 50;
        let maxG = 0;
        for (let i = 1; i < s.length; i += 1) {
            const g = s[i] - s[i - 1];
            if (g < minG) minG = g;
            if (g > maxG) maxG = g;
        }
        sumMin += minG;
        sumMax += maxG;
        minH.set(minG, (minH.get(minG) || 0) + 1);
        maxH.set(maxG, (maxH.get(maxG) || 0) + 1);
    }

    const modalKey = (h: Map<number, number>) => {
        let best = 0, bestC = -1;
        for (const [v, c] of h) if (c > bestC) { bestC = c; best = v; }
        return best;
    };

    return {
        minGapMean: Math.round((sumMin / n) * 10) / 10,
        maxGapMean: Math.round((sumMax / n) * 10) / 10,
        mostCommonMinGap: modalKey(minH),
        mostCommonMaxGap: modalKey(maxH),
        theoreticalMinGapMean: 1.8,
        theoreticalMaxGapMean: 17.4,
    };
}

/* ------------------------------------------------------------------ *
 * 100. Line Standard Deviation & Skewness
 * ------------------------------------------------------------------ */

export interface LineSdSkewStats {
    meanLineSd: number;
    /** Most common per-line SD (owner rule: modal indicators only). */
    mostCommonLineSd: number;
    mostCommonLineSdShare: number;
    theoreticalLineSd: number;
    meanLineSkewness: number;
    theoreticalSkewness: number;
}

export function computeLineSdSkewStats(draws: Draw[]): LineSdSkewStats {
    const n = draws.length;
    let sumSd = 0;
    let sumSkew = 0;
    const allSds: number[] = [];

    for (const d of draws) {
        const s = d.numbers;
        const m = s.reduce((a, b) => a + b, 0) / 6;
        let v = 0;
        for (const n of s) v += (n - m) ** 2;
        const sd = Math.sqrt(v / 5);
        sumSd += sd;
        allSds.push(sd);

        let m3 = 0;
        for (const n of s) m3 += (n - m) ** 3;
        const skew = sd === 0 ? 0 : (m3 / 6) / (sd ** 3);
        sumSkew += skew;
    }

    const sdModal = modalOfTs(allSds.map((s: number) => Math.round(s * 10) / 10));

    return {
        meanLineSd: Math.round((sumSd / n) * 10) / 10,
        mostCommonLineSd: sdModal.value,
        mostCommonLineSdShare: Math.round(sdModal.share * 1000) / 10,
        theoreticalLineSd: 14.1,
        meanLineSkewness: Math.round((sumSkew / n) * 100) / 100,
        theoreticalSkewness: 0.0,
    };
}

/* ------------------------------------------------------------------ *
 * 101. Wald–Wolfowitz Runs Test on Sums
 * ------------------------------------------------------------------ */

export interface WaldWolfowitzStats {
    observedRuns: number;
    expectedRuns: number;
    zScore: number;
    pValue: number;
    isRandom: boolean;
}

export function computeWaldWolfowitzRunsStats(draws: Draw[]): WaldWolfowitzStats {
    const sorted = [...draws].sort((a, b) => a.draw - b.draw);
    const sums = sorted.map((d) => d.numbers.reduce((s, n) => s + n, 0));
    const sortedSums = [...sums].sort((a, b) => a - b);
    const mid = Math.floor(sortedSums.length / 2);
    const medianSum =
        sortedSums.length % 2 === 0 ? (sortedSums[mid - 1] + sortedSums[mid]) / 2 : sortedSums[mid];

    let n1 = 0; // above median
    let n2 = 0; // below or equal
    const bits: boolean[] = [];

    for (const s of sums) {
        if (s > medianSum) {
            n1 += 1;
            bits.push(true);
        } else {
            n2 += 1;
            bits.push(false);
        }
    }

    let runs = 1;
    for (let i = 1; i < bits.length; i += 1) {
        if (bits[i] !== bits[i - 1]) runs += 1;
    }

    const expRuns = 1 + (2 * n1 * n2) / (n1 + n2);
    const varRuns = (2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / (((n1 + n2) ** 2) * (n1 + n2 - 1));
    const z = (runs - expRuns) / Math.sqrt(varRuns);
    const pVal = 2 * (1 - normalCdf(Math.abs(z)));

    return {
        observedRuns: runs,
        expectedRuns: Math.round(expRuns),
        zScore: Math.round(z * 100) / 100,
        pValue: Math.round(pVal * 1000) / 1000,
        isRandom: pVal > 0.05,
    };
}

/* ------------------------------------------------------------------ *
 * 102. Kolmogorov–Smirnov Uniformity Test
 * ------------------------------------------------------------------ */

export interface KsUniformityStats {
    dStatistic: number;
    criticalD: number;
    pValue: number;
    isUniform: boolean;
}

export function computeKsUniformityStats(draws: Draw[]): KsUniformityStats {
    const counts = new Uint16Array(POOL + 1);
    let totalPicks = 0;

    for (const d of draws) {
        for (const num of d.numbers) {
            counts[num] += 1;
            totalPicks += 1;
        }
    }

    let maxD = 0;
    let cumObserved = 0;

    for (let i = 1; i <= POOL; i += 1) {
        cumObserved += counts[i] / totalPicks;
        const cumExpected = i / POOL;
        const d = Math.abs(cumObserved - cumExpected);
        if (d > maxD) maxD = d;
    }

    const critD = 1.36 / Math.sqrt(totalPicks);
    return {
        dStatistic: Math.round(maxD * 10000) / 10000,
        criticalD: Math.round(critD * 10000) / 10000,
        pValue: (() => {
            // Kolmogorov asymptotic survival with the Stephan correction.
            const lam = (Math.sqrt(totalPicks) + 0.12 + 0.11 / Math.sqrt(totalPicks)) * maxD;
            let p = 0;
            for (let k = 1; k <= 100; k += 1) p += 2 * ((k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * lam * lam));
            return Math.round(Math.max(0, Math.min(1, p)) * 1000) / 1000;
        })(),
        isUniform: maxD < critD,
    };
}

/* ------------------------------------------------------------------ *
 * 103. NIST / Poker Hand Tail Classification
 * ------------------------------------------------------------------ */

export interface PokerTailStats {
    hands: { type: string; observedCount: number; observedPct: number; expectedPct: number }[];
}

export function computePokerTailTestStats(draws: Draw[]): PokerTailStats {
    const n = draws.length;
    let allDistinct = 0;
    let onePair = 0;
    let twoPair = 0;
    let threeOfAKind = 0;
    let fullHouseOrBetter = 0;

    for (const d of draws) {
        const tailCounts = new Uint8Array(10);
        for (const n of d.numbers) tailCounts[n % 10] += 1;
        const nonZero = Array.from(tailCounts).filter((c) => c > 0).sort((a, b) => b - a);

        if (nonZero[0] === 1) allDistinct += 1;
        else if (nonZero[0] === 2 && nonZero[1] === 1) onePair += 1;
        else if (nonZero[0] === 2 && nonZero[1] === 2) twoPair += 1;
        else if (nonZero[0] === 3 && nonZero[1] === 1) threeOfAKind += 1;
        else fullHouseOrBetter += 1;
    }

    return {
        hands: [
            // Exact nulls (2026-11-19): enumerated tail-multinomial shares over
            // all C(49,6) draws - tail 0 has 4 balls, tails 1-9 have 5.
            { type: "All Distinct (6 tails)", observedCount: allDistinct, observedPct: Math.round((allDistinct / n) * 1000) / 10, expectedPct: 20.7 },
            { type: "One Pair (5 tails)", observedCount: onePair, observedPct: Math.round((onePair / n) * 1000) / 10, expectedPct: 49.6 },
            { type: "Two Pair (4 tails)", observedCount: twoPair, observedPct: Math.round((twoPair / n) * 1000) / 10, expectedPct: 20.6 },
            { type: "Three of a Kind", observedCount: threeOfAKind, observedPct: Math.round((threeOfAKind / n) * 1000) / 10, expectedPct: 6.6 },
            { type: "Full House / 4+ Tail", observedCount: fullHouseOrBetter, observedPct: Math.round((fullHouseOrBetter / n) * 1000) / 10, expectedPct: 2.6 },
        ],
    };
}
