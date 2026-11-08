// toto.sg — live ticket X-ray, multi-combination backtester, indicator lenses, and draw anatomy.
import {
    type Analysis,
    type Draw,
    type StrategiesFile,
    drawLowCount,
    drawOddCount,
    drawSum,
} from "./data";
import { binomial, PICKS, POOL } from "./insights-stats";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface BoardLens {
    id: string;
    label: string;
    counts: number[];
    expected: number;
    draws: number;
    displayValues?: string[];
    zScores?: number[];
    summary: string;
}

export interface CrowdFlag {
    label: string;
    tone: "primary" | "secondary" | "gold" | "down" | "muted";
    hint: string;
}

export interface BacktestMatch {
    draw: number;
    date: string;
    matched: number;
    hasAdditional: boolean;
    group: number | null;
    prizeSgd: number;
}

export interface TicketXRayResult {
    systemSize: number;
    line: number[];
    combinations: number;
    stakeSgd: number;
    meanSum: number;
    sumPercentile: number;
    acValue: number;
    span: number;
    oddCount: number;
    highCount: number;
    birthdayCount: number;
    doubleCalendarCount: number;
    distinctTails: number;
    distinctDecades: number;
    distinctMod9: number;
    digitalRoot: number;
    consecPairs: number;
    hasAp3: boolean;
    onDiagonalCount: number;
    compositionFlags: CrowdFlag[];
    botVoteOverlap: number;
    closestStrategy: { name: string; matchCount: number; score: number } | null;
    backtest: {
        totalDraws: number;
        winningDraws: number;
        tierCounts: Record<string, number>;
        bestMatch: BacktestMatch | null;
        simulatedReturnSgd: number;
        roiPct: number;
    };
}

export interface NextDrawRegime {
    rolloverDepth: number;
    rolloverLabel: string;
    nextWeekday: string;
    weekdayLeaders: { number: number; ratePct: number }[];
    activeSweepCount: number;
    topRsiBall: { number: number; rsi: number };
    topMarkovFollower: { number: number; fromBall: number; count: number } | null;
}

export interface DrawAnatomy {
    sum: number;
    oddCount: number;
    highCount: number;
    span: number;
    acValue: number;
    distinctTails: number;
    digitalRoot: number;
    consecutivePairs: number;
    birthdayCount: number;
    doubleCalendarCount: number;
    repeatsFromPrev: number;
    additionalPromoted: boolean;
    neighborHits: number;
    g3Share: number | null;
    g3DeltaVsEra: number | null;
    impliedTicketsSold: number | null;
    isRollover: boolean;
    isSoloG1: boolean;
    isSplitG1: boolean;
}

/* ------------------------------------------------------------------ *
 * Small Combinatorial & Line Helpers
 * ------------------------------------------------------------------ */

export function sortAsc(nums: number[]): number[] {
    return [...nums].sort((a, b) => a - b);
}

export function lineAcValue(nums: number[]): number {
    const diffs = new Set<number>();
    for (let i = 0; i < nums.length; i += 1) {
        for (let j = i + 1; j < nums.length; j += 1) {
            diffs.add(Math.abs(nums[i] - nums[j]));
        }
    }
    return Math.max(0, diffs.size - (Math.min(6, nums.length) - 1));
}

export function lineHasThreeTermAp(nums: number[]): boolean {
    const s = sortAsc(nums);
    const set = new Set(s);
    for (let i = 0; i < s.length; i += 1) {
        for (let j = i + 1; j < s.length; j += 1) {
            const diff = s[j] - s[i];
            if (set.has(s[j] + diff)) return true;
        }
    }
    return false;
}

const MAIN_DIAGONALS = new Set([1, 9, 17, 25, 33, 41, 49, 7, 13, 19, 31, 37, 43]);

/* ------------------------------------------------------------------ *
 * 1. Board Lenses
 * ------------------------------------------------------------------ */

export function computeBoardLenses(eraDraws: Draw[], analysis: Analysis, league?: StrategiesFile): BoardLens[] {
    const eraCount = analysis.coverage.totalDraws;
    const trailingCount = Math.min(50, eraDraws.length);
    const last50Draws = eraDraws.slice(-trailingCount);
    const last10Draws = eraDraws.slice(-10);

    // 1. All Time
    const allCounts = analysis.frequency.all;
    const allExpected = (eraCount * PICKS) / POOL;
    const allSd = Math.sqrt(eraCount * (6 / 49) * (43 / 49));
    const allZ = allCounts.map((c) => (c - allExpected) / allSd);

    // 2. Last 50
    const trailingCounts = new Array(49).fill(0);
    for (const d of last50Draws) {
        for (const n of d.numbers) trailingCounts[n - 1] += 1;
    }
    const trailingExpected = (trailingCount * PICKS) / POOL;
    const trailingSd = Math.sqrt(trailingCount * (6 / 49) * (43 / 49));
    const trailingZ = trailingCounts.map((c) => (c - trailingExpected) / trailingSd);

    // 3. 10-Draw Surge
    const surge10Counts = new Array(49).fill(0);
    for (const d of last10Draws) {
        for (const n of d.numbers) surge10Counts[n - 1] += 1;
    }
    const surge10Expected = (10 * PICKS) / POOL; // 1.22
    const surge10Sd = Math.sqrt(10 * (6 / 49) * (43 / 49)); // ~1.03
    const surge10Z = surge10Counts.map((c) => (c - surge10Expected) / surge10Sd);
    const surge10Display = surge10Counts.map((c) => `${c} /10`);

    // 4. Skips / Gap
    const lastSeenMap = new Map<number, number>();
    eraDraws.forEach((draw, idx) => {
        for (const n of draw.numbers) lastSeenMap.set(n, eraDraws.length - 1 - idx);
    });
    const skipCounts = Array.from({ length: 49 }, (_, i) => lastSeenMap.get(i + 1) ?? eraDraws.length);
    const expCycle = 49 / 6; // 8.16
    const skipZ = skipCounts.map((gap) => (gap - expCycle) / expCycle);
    const skipDisplay = skipCounts.map((gap) => `${gap}d`);

    // 5. RSI-14
    const alpha = 1 / 14;
    const expRate = 6 / 49;
    const rsiEma = new Float64Array(49).fill(expRate);
    for (const d of eraDraws) {
        const hitSet = new Set(d.numbers);
        for (let b = 1; b <= 49; b += 1) {
            const hit = hitSet.has(b) ? 1.0 : 0.0;
            rsiEma[b - 1] = (1 - alpha) * rsiEma[b - 1] + alpha * hit;
        }
    }
    const rsiValues = Array.from(rsiEma, (r) => Math.max(0, Math.min(100, Math.round((r / expRate) * 50))));
    const rsiZ = rsiValues.map((v) => (v - 50) / 20);
    const rsiDisplay = rsiValues.map((v) => `${v}`);


    // 7. Bot Votes
    const votes = new Array(49).fill(0);
    const stratTotal = league?.strategies.length ?? 0;
    if (league) {
        for (const s of league.strategies) {
            for (const b of s.currentPick) {
                if (b >= 1 && b <= 49) votes[b - 1] += 1;
            }
        }
    }
    const expVotes = stratTotal > 0 ? (stratTotal * 6) / 49 : 1;
    const voteZ = votes.map((v) => (stratTotal > 0 ? (v - expVotes) / Math.sqrt(expVotes) : 0));
    const voteDisplay = votes.map((v) => `${v}v`);

    return [
        {
            id: "all",
            label: "All time",
            counts: allCounts,
            expected: allExpected,
            draws: eraCount,
            zScores: allZ,
            summary: `All ${eraCount.toLocaleString("en-SG")} draws (6/49 era). Fair expectation: ${allExpected.toFixed(1)} appearances.`,
        },
        {
            id: "trailing",
            label: "Last 50",
            counts: trailingCounts,
            expected: trailingExpected,
            draws: trailingCount,
            zScores: trailingZ,
            summary: `Trailing ${trailingCount} draws. Fair expectation: ${trailingExpected.toFixed(1)} appearances.`,
        },
        {
            id: "surge10",
            label: "10-Draw Surge",
            counts: surge10Counts,
            expected: surge10Expected,
            draws: 10,
            displayValues: surge10Display,
            zScores: surge10Z,
            summary: "Hits in the last 10 draws. Pink indicates 3+ hits (momentum surge).",
        },
        {
            id: "skip",
            label: "Skip / Due",
            counts: skipCounts,
            expected: expCycle,
            draws: eraCount,
            displayValues: skipDisplay,
            zScores: skipZ,
            summary: `Draws missing since last appearance. Average cycle: ${expCycle.toFixed(1)} draws. 24+ is overdue.`,
        },
        {
            id: "rsi14",
            label: "RSI-14",
            counts: rsiValues,
            expected: 50,
            draws: 14,
            displayValues: rsiDisplay,
            zScores: rsiZ,
            summary: "Wilder 14-draw Relative Strength Index normalized to 50 base. <35 oversold (cyan), >65 hot momentum (pink).",
        },
        {
            id: "botVotes",
            label: "Bot Votes",
            counts: votes,
            expected: expVotes,
            draws: stratTotal,
            displayValues: voteDisplay,
            zScores: voteZ,
            summary: `Number of strategies in the league currently picking this ball (out of ${stratTotal} strategies).`,
        },
    ];
}

/* ------------------------------------------------------------------ *
 * 2. Next Draw Regime Briefing
 * ------------------------------------------------------------------ */

export function computeNextDrawRegime(eraDraws: Draw[], lastDraw: Draw | null): NextDrawRegime {
    // 1. Rollover depth
    let depth = 0;
    for (let i = eraDraws.length - 1; i >= 0; i -= 1) {
        const g1w = eraDraws[i].prizes?.g1?.winners ?? 0;
        if (g1w > 0) break;
        depth += 1;
    }
    const rolloverLabel = depth === 0 ? "Base Draw (S$1M)" : depth === 3 ? "Draw 4 Cascade Fever!" : `Rollover ${depth} (Snowball)`;

    // 2. Next weekday
    const nextDate = lastDraw ? new Date(`${lastDraw.date}T00:00:00Z`) : new Date();
    // Monday (1) or Thursday (4)
    const nextDay = nextDate.getUTCDay() === 1 ? "Thu" : "Mon";

    // Weekday skew leaders
    const monCounts = new Uint16Array(POOL);
    const thuCounts = new Uint16Array(POOL);
    let monDraws = 0;
    let thuDraws = 0;
    for (const d of eraDraws) {
        const day = new Date(`${d.date}T00:00:00Z`).getUTCDay();
        if (day === 1) {
            monDraws += 1;
            for (const n of d.numbers) monCounts[n - 1] += 1;
        } else if (day === 4) {
            thuDraws += 1;
            for (const n of d.numbers) thuCounts[n - 1] += 1;
        }
    }
    const targetCounts = nextDay === "Mon" ? monCounts : thuCounts;
    const targetDraws = nextDay === "Mon" ? monDraws : thuDraws;
    const weekdayLeaders = Array.from({ length: POOL }, (_, i) => ({
        number: i + 1,
        ratePct: targetDraws > 0 ? (targetCounts[i] / targetDraws) * 100 : 12.24,
    }))
        .sort((a, b) => b.ratePct - a.ratePct)
        .slice(0, 3);

    // 3. Active 25-draw sweep
    const recent25 = new Set(eraDraws.slice(-25).flatMap((d) => d.numbers));
    const activeSweepCount = recent25.size;

    // 4. Top RSI
    const alpha = 1 / 14;
    const expRate = 6 / 49;
    const rsiEma = new Float64Array(49).fill(expRate);
    for (const d of eraDraws) {
        const hitSet = new Set(d.numbers);
        for (let b = 1; b <= 49; b += 1) {
            const hit = hitSet.has(b) ? 1.0 : 0.0;
            rsiEma[b - 1] = (1 - alpha) * rsiEma[b - 1] + alpha * hit;
        }
    }
    let topRsiBall = { number: 1, rsi: 50 };
    rsiEma.forEach((rate, i) => {
        const rsi = Math.round((rate / expRate) * 50);
        if (rsi > topRsiBall.rsi) topRsiBall = { number: i + 1, rsi };
    });

    // 5. Markov top follower from last draw's highest number
    let topMarkov: { number: number; fromBall: number; count: number } | null = null;
    if (lastDraw && lastDraw.numbers.length > 0) {
        const highestBall = Math.max(...lastDraw.numbers);
        const trans = new Map<number, number>();
        for (let t = 1; t < eraDraws.length; t += 1) {
            if (eraDraws[t - 1].numbers.includes(highestBall)) {
                for (const b of eraDraws[t].numbers) {
                    trans.set(b, (trans.get(b) ?? 0) + 1);
                }
            }
        }
        let bestTarget = 1;
        let maxCount = 0;
        trans.forEach((cnt, b) => {
            if (cnt > maxCount) {
                maxCount = cnt;
                bestTarget = b;
            }
        });
        topMarkov = { number: bestTarget, fromBall: highestBall, count: maxCount };
    }

    return {
        rolloverDepth: depth,
        rolloverLabel,
        nextWeekday: nextDay,
        weekdayLeaders,
        activeSweepCount,
        topRsiBall,
        topMarkovFollower: topMarkov,
    };
}

/* ------------------------------------------------------------------ *
 * 3. Live Ticket X-Ray & Multi-Combination Backtester
 * ------------------------------------------------------------------ */

export function analyzeTicket(line: number[], allDraws: Draw[], league?: StrategiesFile): TicketXRayResult {
    const sorted = sortAsc(line);
    const size = sorted.length;
    const combinations = size >= 6 ? binomial(size, 6) : 0;
    const stakeSgd = combinations;

    // Line basic structural math
    const meanSum = size > 0 ? (sorted.reduce((a, b) => a + b, 0) / size) * 6 : 150;
    // Expected sum is 150, SD is ~23.98
    const sumZ = (meanSum - 150) / 23.98;
    const sumPercentile = Math.round(Math.max(1, Math.min(99, (sumZ * 0.34 + 0.5) * 100)));

    const acValue = size >= 6 ? lineAcValue(sorted) : 0;
    const span = size >= 2 ? sorted[sorted.length - 1] - sorted[0] : 0;
    const oddCount = sorted.filter((n) => n % 2 === 1).length;
    const highCount = sorted.filter((n) => n > 24).length;
    const birthdayCount = sorted.filter((n) => n <= 31).length;
    const doubleCalendarCount = sorted.filter((n) => n <= 12).length;
    const distinctTails = new Set(sorted.map((n) => n % 10)).size;
    const distinctDecades = new Set(sorted.map((n) => Math.floor((n - 1) / 10))).size;
    const distinctMod9 = new Set(sorted.map((n) => n % 9)).size;
    const totalSum = sorted.reduce((a, b) => a + b, 0);
    const digitalRoot = 1 + ((totalSum - 1) % 9);

    let consecPairs = 0;
    for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i] === sorted[i - 1] + 1) consecPairs += 1;
    }
    const hasAp3 = lineHasThreeTermAp(sorted);
    const onDiagonalCount = sorted.filter((n) => MAIN_DIAGONALS.has(n)).length;


    // Composition flags — match-structure warnings, no payout estimation.
    const compositionFlags: CrowdFlag[] = [];
    if (birthdayCount >= 5) {
        compositionFlags.push({ label: "Calendar-Heavy", tone: "down", hint: `${birthdayCount} numbers ≤ 31 — the most-crowded half of the pool` });
    }
    if (consecPairs >= 2) {
        compositionFlags.push({ label: `${consecPairs} Runs`, tone: "muted", hint: "Multiple consecutive pairs — a rare line shape" });
    }
    if (acValue >= 9) {
        compositionFlags.push({ label: "Max Complexity", tone: "gold", hint: `AC value ${acValue} (clean gap dispersion)` });
    }
    if (onDiagonalCount >= 3) {
        compositionFlags.push({ label: "Diagonal Mark", tone: "muted", hint: `${onDiagonalCount} numbers on playslip diagonals` });
    }

    // Bot Consensus Overlap
    let botVoteOverlap = 0;
    let closestStrategy: { name: string; matchCount: number; score: number } | null = null;
    if (league) {
        const ticketSet = new Set(sorted);
        let maxMatches = 0;
        for (const s of league.strategies) {
            let matched = 0;
            for (const b of s.currentPick) {
                if (ticketSet.has(b)) {
                    botVoteOverlap += 1;
                    matched += 1;
                }
            }
            if (matched > maxMatches) {
                maxMatches = matched;
                closestStrategy = { name: s.name, matchCount: matched, score: s.score };
            }
        }
    }

    // Archive Backtest (across all 1,892 draws)
    const tierCounts: Record<string, number> = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0, g7: 0 };
    let winningDraws = 0;
    let simulatedReturnSgd = 0;
    let bestMatch: BacktestMatch | null = null;

    const ticketSet = new Set(sorted);

    // Helper to evaluate Group 1..7 for one 6-subset
    const evalSingle6 = (matchMain: number, matchAddl: boolean) => {
        if (matchMain === 6) return 1;
        if (matchMain === 5 && matchAddl) return 2;
        if (matchMain === 5) return 3;
        if (matchMain === 4 && matchAddl) return 4;
        if (matchMain === 4) return 5;
        if (matchMain === 3 && matchAddl) return 6;
        if (matchMain === 3) return 7;
        return null;
    };

    allDraws.forEach((draw) => {
        let matchedMain = 0;
        for (const n of draw.numbers) {
            if (ticketSet.has(n)) matchedMain += 1;
        }
        const hasAddl = draw.additional != null && ticketSet.has(draw.additional);

        let drawWon = false;
        let bestGroupInDraw: number | null = null;
        let drawPrizeSgd = 0;

        if (size === 6) {
            const group = evalSingle6(matchedMain, hasAddl);
            if (group !== null) {
                drawWon = true;
                bestGroupInDraw = group;
                tierCounts[`g${group}`] = (tierCounts[`g${group}`] ?? 0) + 1;
                const share = draw.prizes?.[`g${group}` as keyof typeof draw.prizes]?.share ?? 10;
                drawPrizeSgd += share;
            }
        } else if (size === 7) {
            // System 7 (C(7,6) = 7 sub-lines)
            // Combinations matching k main balls: C(matchedMain, k) * C(7 - matchedMain, 6 - k)
            for (let k = 3; k <= Math.min(6, matchedMain); k += 1) {
                const waysWithoutAddl = binomial(matchedMain, k) * binomial(7 - matchedMain - (hasAddl ? 1 : 0), 6 - k);
                const waysWithAddl = hasAddl && 6 - k - 1 >= 0
                    ? binomial(matchedMain, k) * binomial(7 - matchedMain - 1, 6 - k - 1)
                    : 0;

                if (waysWithAddl > 0) {
                    const g = evalSingle6(k, true);
                    if (g !== null) {
                        drawWon = true;
                        if (!bestGroupInDraw || g < bestGroupInDraw) bestGroupInDraw = g;
                        tierCounts[`g${g}`] = (tierCounts[`g${g}`] ?? 0) + waysWithAddl;
                        const share = draw.prizes?.[`g${g}` as keyof typeof draw.prizes]?.share ?? 10;
                        drawPrizeSgd += share * waysWithAddl;
                    }
                }
                if (waysWithoutAddl > 0) {
                    const g = evalSingle6(k, false);
                    if (g !== null) {
                        drawWon = true;
                        if (!bestGroupInDraw || g < bestGroupInDraw) bestGroupInDraw = g;
                        tierCounts[`g${g}`] = (tierCounts[`g${g}`] ?? 0) + waysWithoutAddl;
                        const share = draw.prizes?.[`g${g}` as keyof typeof draw.prizes]?.share ?? 10;
                        drawPrizeSgd += share * waysWithoutAddl;
                    }
                }
            }
        } else if (size === 8) {
            // System 8 (C(8,6) = 28 sub-lines)
            for (let k = 3; k <= Math.min(6, matchedMain); k += 1) {
                const waysWithoutAddl = binomial(matchedMain, k) * binomial(8 - matchedMain - (hasAddl ? 1 : 0), 6 - k);
                const waysWithAddl = hasAddl && 6 - k - 1 >= 0
                    ? binomial(matchedMain, k) * binomial(8 - matchedMain - 1, 6 - k - 1)
                    : 0;

                if (waysWithAddl > 0) {
                    const g = evalSingle6(k, true);
                    if (g !== null) {
                        drawWon = true;
                        if (!bestGroupInDraw || g < bestGroupInDraw) bestGroupInDraw = g;
                        tierCounts[`g${g}`] = (tierCounts[`g${g}`] ?? 0) + waysWithAddl;
                        const share = draw.prizes?.[`g${g}` as keyof typeof draw.prizes]?.share ?? 10;
                        drawPrizeSgd += share * waysWithAddl;
                    }
                }
                if (waysWithoutAddl > 0) {
                    const g = evalSingle6(k, false);
                    if (g !== null) {
                        drawWon = true;
                        if (!bestGroupInDraw || g < bestGroupInDraw) bestGroupInDraw = g;
                        tierCounts[`g${g}`] = (tierCounts[`g${g}`] ?? 0) + waysWithoutAddl;
                        const share = draw.prizes?.[`g${g}` as keyof typeof draw.prizes]?.share ?? 10;
                        drawPrizeSgd += share * waysWithoutAddl;
                    }
                }
            }
        }

        if (drawWon) {
            winningDraws += 1;
            simulatedReturnSgd += drawPrizeSgd;
            if (!bestMatch || (bestGroupInDraw !== null && bestGroupInDraw < (bestMatch.group ?? 99))) {
                bestMatch = {
                    draw: draw.draw,
                    date: draw.date,
                    matched: matchedMain,
                    hasAdditional: hasAddl,
                    group: bestGroupInDraw,
                    prizeSgd: drawPrizeSgd,
                };
            }
        }
    });

    const totalStake = allDraws.length * stakeSgd;
    const roiPct = totalStake > 0 ? ((simulatedReturnSgd - totalStake) / totalStake) * 100 : -100;

    return {
        systemSize: size,
        line: sorted,
        combinations,
        stakeSgd,
        meanSum: Math.round(meanSum),
        sumPercentile,
        acValue,
        span,
        oddCount,
        highCount,
        birthdayCount,
        doubleCalendarCount,
        distinctTails,
        distinctDecades,
        distinctMod9,
        digitalRoot,
        consecPairs,
        hasAp3,
        onDiagonalCount,
        compositionFlags,
        botVoteOverlap,
        closestStrategy,
        backtest: {
            totalDraws: allDraws.length,
            winningDraws,
            tierCounts,
            bestMatch,
            simulatedReturnSgd: Math.round(simulatedReturnSgd),
            roiPct: Math.round(roiPct),
        },
    };
}

/* ------------------------------------------------------------------ *
 * 4. Draw Anatomy Breakdown (for History page)
 * ------------------------------------------------------------------ */

export function computeDrawAnatomy(draw: Draw, prevDraw: Draw | null, eraMeanG3: number): DrawAnatomy {
    const s = sortAsc(draw.numbers);
    const sum = drawSum(s);
    const odd = drawOddCount(s);
    const high = drawLowCount(s);
    const span = s[5] - s[0];
    const ac = lineAcValue(s);
    const tails = new Set(s.map((n) => n % 10)).size;
    const digitalRoot = 1 + ((sum - 1) % 9);

    let consec = 0;
    for (let i = 1; i < s.length; i += 1) {
        if (s[i] === s[i - 1] + 1) consec += 1;
    }

    const bdays = s.filter((n) => n <= 31).length;
    const doubleCal = s.filter((n) => n <= 12).length;

    let repeats = 0;
    let addlPromoted = false;
    let neighborHits = 0;

    if (prevDraw) {
        const prevSet = new Set(prevDraw.numbers);
        repeats = s.filter((n) => prevSet.has(n)).length;
        if (prevDraw.additional != null && s.includes(prevDraw.additional)) {
            addlPromoted = true;
        }

        const neighborSet = new Set<number>();
        for (const n of prevDraw.numbers) {
            if (n > 1) neighborSet.add(n - 1);
            if (n < 49) neighborSet.add(n + 1);
        }
        for (const n of prevDraw.numbers) neighborSet.delete(n);
        neighborHits = s.filter((n) => neighborSet.has(n)).length;
    }

    const g1w = draw.prizes?.g1?.winners ?? 0;
    const isRollover = g1w === 0;
    const isSoloG1 = g1w === 1;
    const isSplitG1 = g1w > 1;

    const g3 = draw.prizes?.g3?.share ?? null;
    const g3DeltaVsEra = g3 !== null ? Math.round(g3 - eraMeanG3) : null;

    const g7Winners = draw.prizes?.g7?.winners ?? null;
    const impliedTicketsSold = g7Winners !== null ? Math.round(g7Winners * 54.6) : null;

    return {
        sum,
        oddCount: odd,
        highCount: high,
        span,
        acValue: ac,
        distinctTails: tails,
        digitalRoot,
        consecutivePairs: consec,
        birthdayCount: bdays,
        doubleCalendarCount: doubleCal,
        repeatsFromPrev: repeats,
        additionalPromoted: addlPromoted,
        neighborHits,
        g3Share: g3,
        g3DeltaVsEra,
        impliedTicketsSold,
        isRollover,
        isSoloG1,
        isSplitG1,
    };
}
