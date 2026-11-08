// toto.sg — 24 deterministic walk-forward technical indicator & gambler rules.
//
// Rules consume (prior, target, rng, stats) and return a sorted 6-number line
// in 1..49 with six unique balls, or null to reject and retry.
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
} from "./gambler-stats.mjs";

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

    // 17. Kelly Anti-Crowd EV Shield
    kellyAntiCrowdEv(prior, target, rng, stats) {
        const banned = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 28, 38, 48, 17, 25, 33, 41, 49, 13, 19, 31, 37, 43]);
        const pool = RANGE49.filter((n) => !banned.has(n));
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum < 160 || sum > 215) return null;
        return line;
    },

    // 18. Post-31 High Payout Fortress
    post31Fortress(prior, target, rng, stats) {
        const highPool = RANGE49.filter((n) => n > 31);
        const midPool = RANGE49.filter((n) => n >= 19 && n <= 31);
        const line = sortAsc([...sampleK(rng, highPool, 5), ...sampleK(rng, midPool, 1)]);
        if (consecPairs(line) > 1) return null;
        const sum = lineSum(line);
        if (sum < 175) return null;
        return line;
    },

    // 19. Double-Calendar Anti-Crush Sieve
    doubleCalendarVeto(prior, target, rng, stats) {
        const midPool = RANGE49.filter((n) => n >= 13 && n <= 31);
        const highPool = RANGE49.filter((n) => n >= 32);
        const line = sortAsc([...sampleK(rng, midPool, 2), ...sampleK(rng, highPool, 4)]);
        const sum = lineSum(line);
        if (sum < 165 || sum > 215) return null;
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
