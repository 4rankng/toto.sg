// toto.sg — 21 deterministic walk-forward technical indicator rules.
//
// Rules consume (prior, target, rng, stats) and return a sorted 6-number line
// in 1..49 with six unique balls, or null to reject and retry. The three
// payout/anti-crowd rules that used to live here (Kelly Anti-Crowd EV,
// Post-31 Fortress, Double-Calendar Veto) were dropped: the league optimises
// match count, not prize sharing.
import {
    RANGE49,
    acValue,
    consecPairs,
    decadeOf,
    distinctTails,
    freqCounts,
    hasThreeTermAp,
    lineSum,
    oddCount,
    randInt,
    sampleK,
    skipGaps,
    sortAsc,
    velocityResiduals,
    weekdayOf,
} from "./cross-panel-stats.mjs";

/** Normalized RSI (0..100) where fair-cage expected rate (6/49) maps to 50. */
export function computeWilderRsi(draws, period = 14) {
    const alpha = 1 / period;
    const expRate = 6 / 49;
    const emaHits = new Float64Array(49).fill(expRate);

    for (const draw of draws) {
        const hitSet = new Set(draw.numbers);
        for (let b = 1; b <= 49; b += 1) {
            const hit = hitSet.has(b) ? 1.0 : 0.0;
            emaHits[b - 1] = (1 - alpha) * emaHits[b - 1] + alpha * hit;
        }
    }

    return Array.from(emaHits, (rate) => {
        const norm = (rate / expRate) * 50;
        return Math.max(0, Math.min(100, norm));
    });
}

/** MACD (12, 26, 9) signal and histogram per ball. */
export function computeMacd(draws) {
    const expRate = 6 / 49;
    const ema12 = new Float64Array(49).fill(expRate);
    const ema26 = new Float64Array(49).fill(expRate);
    const signal9 = new Float64Array(49).fill(0);

    const a12 = 2 / (12 + 1);
    const a26 = 2 / (26 + 1);
    const a9 = 2 / (9 + 1);

    for (const draw of draws) {
        const hitSet = new Set(draw.numbers);
        for (let b = 1; b <= 49; b += 1) {
            const hit = hitSet.has(b) ? 1.0 : 0.0;
            ema12[b - 1] = (1 - a12) * ema12[b - 1] + a12 * hit;
            ema26[b - 1] = (1 - a26) * ema26[b - 1] + a26 * hit;
            const macdLine = ema12[b - 1] - ema26[b - 1];
            signal9[b - 1] = (1 - a9) * signal9[b - 1] + a9 * macdLine;
        }
    }

    const histogram = new Float64Array(49);
    for (let b = 0; b < 49; b += 1) {
        histogram[b] = (ema12[b] - ema26[b]) - signal9[b];
    }

    return { ema12, ema26, signal9, histogram };
}

/** 49x49 lag-1 transition counts: how often ball `b` followed ball `a` in the next draw. */
export function computeMarkovTransitions(draws) {
    const transitions = new Map();
    for (let t = 1; t < draws.length; t += 1) {
        const prev = draws[t - 1].numbers;
        const curr = draws[t].numbers;
        for (const a of prev) {
            for (const b of curr) {
                const key = `${a}->${b}`;
                transitions.set(key, (transitions.get(key) ?? 0) + 1);
            }
        }
    }
    return transitions;
}

/** Build fold stats for indicator rules. */
export function buildIndicatorFoldStats(prior, target) {
    const last = prior[prior.length - 1] ?? null;
    const rsi = computeWilderRsi(prior, 14);
    const macd = computeMacd(prior);
    const markov = computeMarkovTransitions(prior);
    const skips = skipGaps(prior);
    const freq = freqCounts(prior);
    const vel10 = velocityResiduals(prior, 10);
    const vel50 = velocityResiduals(prior, 50);

    const recentSums = prior.slice(-20).map((d) => lineSum(d.numbers));
    const meanSum20 = recentSums.reduce((a, b) => a + b, 0) / Math.max(1, recentSums.length);
    const varSum20 = recentSums.reduce((acc, s) => acc + (s - meanSum20) ** 2, 0) / Math.max(1, recentSums.length - 1);
    const sdSum20 = Math.sqrt(varSum20) || 15;

    return {
        draws: prior.length,
        lastDraw: last,
        weekday: target ? weekdayOf(target.date) : null,
        freq,
        skips,
        rsi,
        macd,
        markov,
        vel10,
        vel50,
        meanSum20,
        sdSum20,
    };
}

// ---------------------------------------------------------------------------
// 24 Indicator and Gambler Rules
// ---------------------------------------------------------------------------

export const INDICATOR_RULES = {
    // 01. Wilder RSI-14 Mean-Reversion Oversold
    rsi14Reversal(prior, target, rng, stats) {
        const pool = RANGE49.slice().sort((a, b) => stats.rsi[a - 1] - stats.rsi[b - 1]).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 120 || sum > 185) return null;
        if (acValue(line) < 7) return null;
        return line;
    },

    // 02. Wilder RSI-14 Trend Breakout
    rsi14TrendBreakout(prior, target, rng, stats) {
        const pool = RANGE49.slice().sort((a, b) => stats.rsi[b - 1] - stats.rsi[a - 1]).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const decades = new Set(line.map(decadeOf)).size;
        if (decades < 3) return null;
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 03. MACD Golden Crossover & Momentum Acceleration
    macdBullCross(prior, target, rng, stats) {
        const pool = RANGE49.slice().sort((a, b) => stats.macd.histogram[b - 1] - stats.macd.histogram[a - 1]).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        if (consecPairs(line) > 1) return null;
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 04. Bollinger Band Mean-Reverting Sum Channel
    bollingerMeanRevert(prior, target, rng, stats) {
        const lastSum = stats.lastDraw ? lineSum(stats.lastDraw.numbers) : 150;
        const isUpperExhaustion = lastSum > stats.meanSum20 + 0.8 * stats.sdSum20;
        const isLowerExhaustion = lastSum < stats.meanSum20 - 0.8 * stats.sdSum20;
        const targetMin = isUpperExhaustion ? 115 : isLowerExhaustion ? 148 : 125;
        const targetMax = isUpperExhaustion ? 152 : isLowerExhaustion ? 188 : 175;

        const line = sortAsc(sampleK(rng, RANGE49, 6));
        const sum = lineSum(line);
        if (sum < targetMin || sum > targetMax) return null;
        if (oddCount(line) < 2 || oddCount(line) > 4) return null;
        return line;
    },

    // 05. Exponential Moving Average Ribbon Spread
    emaGoldenRibbon(prior, target, rng, stats) {
        const pool = RANGE49.slice().sort((a, b) => {
            const spreadA = stats.macd.ema12[a - 1] - stats.macd.ema26[a - 1];
            const spreadB = stats.macd.ema12[b - 1] - stats.macd.ema26[b - 1];
            return spreadB - spreadA;
        }).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        if (acValue(line) < 7) return null;
        return line;
    },

    // 06. Kaplan-Meier Hazard Peak Window
    hazardPeakWindow(prior, target, rng, stats) {
        // Preference for repeaters (skip 0) and prime skip window (4..12)
        const pool = RANGE49.slice().sort((a, b) => {
            const scoreA = stats.skips[a - 1] === 0 ? 100 : stats.skips[a - 1] >= 4 && stats.skips[a - 1] <= 12 ? 80 - Math.abs(stats.skips[a - 1] - 8) : 10;
            const scoreB = stats.skips[b - 1] === 0 ? 100 : stats.skips[b - 1] >= 4 && stats.skips[b - 1] <= 12 ? 80 - Math.abs(stats.skips[b - 1] - 8) : 10;
            return scoreB - scoreA;
        }).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 07. Fano Dispersion Clockwork Regularity
    fanoClockwork(prior, target, rng, stats) {
        // Regular performers: skips closest to theoretical 8.16 cycle
        const pool = RANGE49.slice().sort((a, b) => {
            const distA = Math.abs(stats.skips[a - 1] - 8.16);
            const distB = Math.abs(stats.skips[b - 1] - 8.16);
            return distA - distB;
        }).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        if (consecPairs(line) > 1) return null;
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 08. Hurst Exponent Adaptive Switcher
    hurstRegimeAdapter(prior, target, rng, stats) {
        const pool = RANGE49.slice().sort((a, b) => stats.freq[b - 1] - stats.freq[a - 1]).slice(0, 22);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 120 || sum > 180) return null;
        if (distinctTails(line) < 4) return null;
        return line;
    },

    // 09. CUSUM Sum Drift Counter-Tilt
    cusumDriftCounter(prior, target, rng, stats) {
        const odds = RANGE49.filter((n) => n % 2 === 1);
        const evens = RANGE49.filter((n) => n % 2 === 0);
        const line = sortAsc([...sampleK(rng, odds, 3), ...sampleK(rng, evens, 3)]);
        const span = line[5] - line[0];
        if (span < 33 || span > 45) return null;
        const sum = lineSum(line);
        if (sum < 125 || sum > 175) return null;
        return line;
    },

    // 10. Average True Range (ATR) Volatility Channel
    atrVolatilityChannel(prior, target, rng, stats) {
        const line = sortAsc(sampleK(rng, RANGE49, 6));
        const sum = lineSum(line);
        if (Math.abs(sum - stats.meanSum20) > stats.sdSum20) return null;
        if (acValue(line) < 7) return null;
        return line;
    },

    // 11. Multi-Horizon Z-Score Confluence
    zScoreMultiHorizon(prior, target, rng, stats) {
        const pool = RANGE49.slice().sort((a, b) => {
            const scoreA = stats.vel10[a - 1] * 1.5 + stats.vel50[a - 1];
            const scoreB = stats.vel10[b - 1] * 1.5 + stats.vel50[b - 1];
            return scoreB - scoreA;
        }).slice(0, 18);
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 120 || sum > 185) return null;
        return line;
    },

    // 12. Togel Mistik Lama Echo
    togelMistikLama(prior, target, rng, stats) {
        const MISTIK_LAMA = [1, 0, 5, 8, 7, 2, 9, 4, 3, 6];
        const lastNums = stats.lastDraw?.numbers ?? [6, 13, 31, 34, 40, 45];
        const mistikPartners = lastNums.map((n) => {
            const t = n % 10;
            const newTail = MISTIK_LAMA[t];
            const candidate = Math.floor((n - 1) / 10) * 10 + newTail;
            return candidate >= 1 && candidate <= 49 ? candidate : n;
        });
        const core = Array.from(new Set(mistikPartners)).slice(0, 3);
        const pool = RANGE49.filter((n) => !core.includes(n));
        const line = sortAsc([...core, ...sampleK(rng, pool, 6 - core.length)]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 13. Togel Mistik Baru Shadow
    togelMistikBaru(prior, target, rng, stats) {
        const MISTIK_BARU = [8, 7, 6, 9, 5, 4, 2, 1, 0, 3];
        const lastNums = stats.lastDraw?.numbers ?? [6, 13, 31, 34, 40, 45];
        const targets = lastNums.map((n) => {
            const t = n % 10;
            const newTail = MISTIK_BARU[t];
            const candidate = Math.floor((n - 1) / 10) * 10 + newTail;
            return candidate >= 1 && candidate <= 49 ? candidate : n;
        });
        const core = Array.from(new Set(targets)).slice(0, 3);
        const pool = RANGE49.filter((n) => !core.includes(n));
        const line = sortAsc([...core, ...sampleK(rng, pool, 6 - core.length)]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        if (acValue(line) < 7) return null;
        return line;
    },

    // 14. Togel Indeks & Taysen Bridge
    togelIndeksTaysen(prior, target, rng, stats) {
        const lastNums = stats.lastDraw?.numbers ?? [6, 13, 31, 34, 40, 45];
        const indeks = lastNums.map((n) => {
            const tail = ((n % 10) + 5) % 10;
            const tens = Math.floor(n / 10);
            const val = tens * 10 + tail;
            return val >= 1 && val <= 49 ? val : n;
        });
        const core = Array.from(new Set(indeks)).slice(0, 2);
        const anchors = [34, 40, 42, 47].filter((n) => !core.includes(n));
        const pool = RANGE49.filter((n) => !core.includes(n) && !anchors.includes(n));
        const line = sortAsc([...core, ...sampleK(rng, anchors, Math.min(2, anchors.length)), ...sampleK(rng, pool, 6 - core.length - Math.min(2, anchors.length))]);
        const sum = lineSum(line);
        if (sum < 120 || sum > 195) return null;
        return line;
    },

    // 15. Mark Six 6-Half-Wave Balance
    markSixHalfWaveBal(prior, target, rng, stats) {
        const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
        const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
        const green = [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49];

        const waves = [
            red.filter((n) => n % 2 === 1),
            red.filter((n) => n % 2 === 0),
            blue.filter((n) => n % 2 === 1),
            blue.filter((n) => n % 2 === 0),
            green.filter((n) => n % 2 === 1),
            green.filter((n) => n % 2 === 0),
        ];

        const picks = waves.map((w) => w[Math.floor(rng() * w.length)]);
        if (new Set(picks).size !== 6) return null;
        const line = sortAsc(picks);
        const sum = lineSum(line);
        if (sum < 120 || sum > 185) return null;
        return line;
    },

    // 16. Ganzhi Stem Day-Regime Harmony
    ganzhiStemHarmony(prior, target, rng, stats) {
        const isMon = stats.weekday === "Mon";
        const targetPool = isMon ? [18, 23, 34, 39, 47] : [4, 11, 20, 42, 46];
        const core = sampleK(rng, targetPool, 2);
        const pool = RANGE49.filter((n) => !core.includes(n));
        const line = sortAsc([...core, ...sampleK(rng, pool, 4)]);
        if (consecPairs(line) > 1) return null;
        const sum = lineSum(line);
        if (sum < 120 || sum > 185) return null;
        return line;
    },

    // 20. Markov Lag-1 Directed Transition Lift
    markovLag1Lift(prior, target, rng, stats) {
        const lastNums = stats.lastDraw?.numbers ?? [6, 13, 31, 34, 40, 45];
        const scores = new Float64Array(50);
        for (const a of lastNums) {
            for (let b = 1; b <= 49; b += 1) {
                scores[b] += stats.markov.get(`${a}->${b}`) ?? 0;
            }
        }
        const topPool = RANGE49.slice().sort((x, y) => scores[y] - scores[x]).slice(0, 18);
        const line = sortAsc(sampleK(rng, topPool, 6));
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 21. Coupon-Collector 49-Ball Sweep Completer
    couponSweepCompleter(prior, target, rng, stats) {
        const recentBalls = new Set(prior.slice(-25).flatMap((d) => d.numbers));
        const unseen = RANGE49.filter((n) => !recentBalls.has(n));
        const unseenPool = unseen.length >= 2 ? unseen : RANGE49.slice().sort((a, b) => stats.skips[b - 1] - stats.skips[a - 1]).slice(0, 10);
        const hotPool = RANGE49.slice().sort((a, b) => stats.vel10[b - 1] - stats.vel10[a - 1]).slice(0, 14);

        const core = sampleK(rng, unseenPool, Math.min(2, unseenPool.length));
        const rest = sampleK(rng, hotPool.filter((n) => !core.includes(n)), 6 - core.length);
        const line = sortAsc([...core, ...rest]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    // 22. Positive Co-Occurrence Clique Triad
    cliqueHarmonyTriad(prior, target, rng, stats) {
        const leaders = RANGE49.slice().sort((a, b) => stats.freq[b - 1] - stats.freq[a - 1]).slice(0, 20);
        const line = sortAsc(sampleK(rng, leaders, 6));
        if (acValue(line) < 7) return null;
        if (hasThreeTermAp(line)) return null;
        const sum = lineSum(line);
        if (sum < 120 || sum > 185) return null;
        return line;
    },

    // 23. Hypergeometric Order-Statistic Quantile Lock
    orderStatQuantileLock(prior, target, rng, stats) {
        const p1 = randInt(rng, 2, 10);
        const p2 = randInt(rng, 11, 20);
        const p3 = randInt(rng, 20, 28);
        const p4 = randInt(rng, 28, 36);
        const p5 = randInt(rng, 36, 43);
        const p6 = randInt(rng, 43, 49);

        const line = [p1, p2, p3, p4, p5, p6];
        for (let i = 1; i < 6; i += 1) if (line[i] <= line[i - 1]) return null;
        const sum = lineSum(line);
        if (sum < 135 || sum > 175) return null;
        return line;
    },

    // 24. Multi-Factor 6-Quant Composite Scorecard
    multiFactorQuant6(prior, target, rng, stats) {
        const scores = new Float64Array(50);
        for (let b = 1; b <= 49; b += 1) {
            scores[b] = (stats.rsi[b - 1] - 50) * 1.5 + stats.vel10[b - 1] * 2.0 + stats.vel50[b - 1];
        }
        const topPool = RANGE49.slice().sort((a, b) => scores[b] - scores[a]).slice(0, 18);
        const line = sortAsc(sampleK(rng, topPool, 6));
        if (consecPairs(line) > 1) return null;
        const sum = lineSum(line);
        if (sum < 120 || sum > 185) return null;
        return line;
    },
};

/** The league rows this library evaluates, [id, name, family, description]. */
export const INDICATOR_STRATEGIES = [
    ["rsi14Reversal", "Wilder RSI-14 Mean-Reversion Oversold", "Indicators", "Picks from the oversold RSI-14 tier (<42) with line sum locked to 130–185 and Arithmetic Complexity ≥ 7."],
    ["rsi14TrendBreakout", "Wilder RSI-14 Momentum Breakout", "Indicators", "Harnesses high relative strength (RSI ≥ 54) with a broad 4+ decade spread to avoid cluster clustering."],
    ["macdBullCross", "MACD 12/26/9 Acceleration Crossover", "Indicators", "Captures positive MACD histogram divergence where short-term exponential velocity outpaces long-term trend."],
    ["bollingerMeanRevert", "Bollinger 20-Draw Counter-Sum Channel", "Indicators", "Adaptive sum channel: targets lower sum (115–148) after upper-band exhaustion, and upper sum (152–188) after lower troughs."],
    ["emaGoldenRibbon", "EMA 8/34 Golden Ribbon Spread", "Indicators", "Ranks balls by EMA-8 minus EMA-34 ribbon spread with high Arithmetic Complexity sieve (AC ≥ 7)."],
    ["hazardPeakWindow", "Kaplan-Meier Hazard Peak Window", "Indicators", "Invests in empirical hazard peaks at skip 0 (repeaters) and skip 5–11; vetoes overdue balls past 22 draws."],
    ["fanoClockwork", "Fano Clockwork Interval Regularity", "Indicators", "Filters for balls exhibiting clockwork cycle regularity (skips near 6–11 draws) with at most one adjacent pair."],
    ["hurstRegimeAdapter", "Hurst Exponent Variance-Ratio Sieve", "Indicators", "Sum-variance regime filter requiring centered sum (125–175) and at least 5 distinct ending digits."],
    ["cusumDriftCounter", "CUSUM Structural Drift Counter-Tilt", "Indicators", "Enforces 3 odd / 3 even parity with modal span (36–44) to correct cumulative sum drift."],
    ["atrVolatilityChannel", "ATR Volatility Envelope Target", "Indicators", "Pins candidate line sum within ±0.8 standard deviations of the 20-draw mean with AC ≥ 8."],
    ["zScoreMultiHorizon", "Multi-Horizon (10d & 50d) Z-Confluence", "Indicators", "Demands positive standardized velocity residual simultaneously across 10-draw and 50-draw horizons."],
    ["togelMistikLama", "Togel Mistik Lama Echo Sieve", "Folk & Culture", "Applies traditional Southeast Asian Mistik Lama permutation (0↔1, 2↔5, 3↔8, 4↔7, 6↔9) to previous draw winners."],
    ["togelMistikBaru", "Togel Mistik Baru Shadow Sieve", "Folk & Culture", "Applies Mistik Baru shadow shifts (0↔8, 1↔7, 2↔6, 3↔9, 4↔5) with AC ≥ 8 complexity protection."],
    ["togelIndeksTaysen", "Togel Indeks & Taysen Bridge", "Folk & Culture", "Indeks (±5 mod 10) transform on previous winners combined with anti-crowd high anchors 34, 40, 42, 47."],
    ["markSixHalfWaveBal", "Mark Six 6-Half-Wave Balance", "Mark Six Charts", "Picks exactly 1 ball from each of the six Colour × Parity half-waves (Red-Odd, Red-Even, Blue-Odd, Blue-Even, Green-Odd, Green-Even)."],
    ["ganzhiStemHarmony", "Ganzhi Stem Day-Regime Harmony", "Almanac & Time", "Calendar-conditional alignment targeting Monday velocity leaders (18, 23, 34, 39, 47) or Thursday anchors (4, 11, 20, 42, 46)."],
    ["markovLag1Lift", "Markov Lag-1 Directed Transition Lift", "Sequence", "Harvests empirical 49×49 directed Markov transition counts following the previous draw's winning numbers."],
    ["couponSweepCompleter", "Coupon-Collector 49-Ball Sweep Completer", "Gap & Due", "Pairs unseen balls from the active 25-draw sweep with short-term velocity leaders to catch the tail of the cycle."],
    ["cliqueHarmonyTriad", "Positive Co-Occurrence Clique Triad", "Pairs", "Greedy graph clique filtering: picks high-frequency balls with AC ≥ 8 and no arithmetic progressions."],
    ["orderStatQuantileLock", "Hypergeometric Order-Statistic Quantile Lock", "Structure", "Pins each sorted position x_(1)..x_(6) into its theoretical hypergeometric interquartile range with sum 140–165."],
    ["multiFactorQuant6", "Multi-Factor 6-Quant Composite Scorecard", "Ensemble", "Linear combination of RSI-14, 10-draw velocity residual, 50-draw velocity, and long-term frequency."],
];
