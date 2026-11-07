// toto.sg — shared statistics primitives for the 10 gambler strategies.
//
// Pure functions over a draw-history prefix. No I/O, no clocks, no globals.
// The strategy rules (scripts/lib/gambler-rules-*.mjs) import only from here
// so that every rule reads the same definitions of "velocity", "pair affinity",
// "playslip cell" and "residue class" — the audit behind
// toto_10_gambler_strategies.docx.

/** Every ball number, 1..49. */
export const RANGE49 = Array.from({ length: 49 }, (_, i) => i + 1);

/** Weekday labels, Monday first (Singapore Pools draws on Mon and Thu). */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** ISO date → "Mon".."Sun". */
export const weekdayOf = (iso) => WEEKDAYS[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7];

/** ISO date → month number, 1..12. */
export const monthOf = (iso) => Number(iso.slice(5, 7));

/** The next Mon/Thu draw date strictly after `lastIso` (18:30 SGT = 10:30 UTC). */
export { nextDrawDateIso } from "./analysis.mjs";

// ---------------------------------------------------------------------------
// Line shape
// ---------------------------------------------------------------------------

export const sortAsc = (arr) => [...arr].sort((a, b) => a - b);

export const lineSum = (line) => line.reduce((acc, n) => acc + n, 0);

export const oddCount = (line) => line.filter((n) => n % 2 === 1).length;

/** Number of adjacent pairs (n, n+1) inside a sorted line. */
export const consecPairs = (line) => {
    const s = sortAsc(line);
    let n = 0;
    for (let i = 1; i < s.length; i += 1) if (s[i] === s[i - 1] + 1) n += 1;
    return n;
};

/** Arithmetic Complexity: distinct pairwise absolute differences − 5 (ceiling 10). */
export const acValue = (line) => {
    const diffs = new Set();
    for (let i = 0; i < line.length; i += 1) {
        for (let j = i + 1; j < line.length; j += 1) diffs.add(Math.abs(line[i] - line[j]));
    }
    return diffs.size - 5;
};

/** True when the line contains a 3-term arithmetic progression (a, a+d, a+2d). */
export const hasThreeTermAp = (line) => {
    const s = sortAsc(line);
    for (let i = 0; i < s.length; i += 1) {
        for (let j = i + 1; j < s.length; j += 1) {
            const d = s[j] - s[i];
            if (s.includes(s[j] + d)) return true;
        }
    }
    return false;
};

/** Distinct last digits (mod 10) inside a line. */
export const distinctTails = (line) => new Set(line.map(tailOf)).size;

// ---------------------------------------------------------------------------
// Number classes
// ---------------------------------------------------------------------------

/** Mod-9 residue class of a ball (0..8). */
export const residueOf = (n) => n % 9;

/** Last digit of a ball (0..9). */
export const tailOf = (n) => n % 10;

/** Decade band index (0..4): 1–10, 11–20, 21–30, 31–40, 41–49. */
export const decadeOf = (n) => Math.floor((n - 1) / 10);

/** Ball → its cell on the 7×7 Singapore Pools playslip (row-major, 1-based). */
export const playslipCell = (n) => ({ row: Math.floor((n - 1) / 7) + 1, col: ((n - 1) % 7) + 1 });

/** The nine mod-9 residue classes, each listing its balls ascending. */
export const MOD9_CLASSES = Array.from({ length: 9 }, (_, r) => RANGE49.filter((n) => residueOf(n) === r));

/** The ten tail-digit classes, each listing its balls ascending. */
export const TAIL_CLASSES = Array.from({ length: 10 }, (_, d) => RANGE49.filter((n) => tailOf(n) === d));

// ---------------------------------------------------------------------------
// Sampling (rng injected; never Math.random)
// ---------------------------------------------------------------------------

/** Uniform integer in [lo, hi]. */
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Uniform k-subset of `pool` via partial Fisher–Yates. */
export const sampleK = (rng, pool, k) => {
    const arr = [...pool];
    const out = [];
    for (let i = 0; i < k; i += 1) {
        const j = i + Math.floor(rng() * (arr.length - i));
        [arr[i], arr[j]] = [arr[j], arr[i]];
        out.push(arr[i]);
    }
    return out;
};

// ---------------------------------------------------------------------------
// History statistics
// ---------------------------------------------------------------------------

/** All-time hit counts per ball (index 0 = ball 1). */
export const freqCounts = (draws) => {
    const counts = new Array(49).fill(0);
    for (const draw of draws) for (const n of draw.numbers) counts[n - 1] += 1;
    return counts;
};

/**
 * Last-window velocity residual per ball: hits in the trailing `window` draws
 * minus the expected hits (window × 6/49). Positive = running hot.
 */
export const velocityResiduals = (draws, window = 50) => {
    const counts = freqCounts(draws.slice(-window));
    const expected = (Math.min(window, draws.length) * 6) / 49;
    return counts.map((c) => c - expected);
};

/** Draws since each ball was last seen (index 0 = ball 1). */
export const skipGaps = (draws) => {
    const gaps = new Array(49).fill(draws.length);
    draws.forEach((draw, i) => {
        for (const n of draw.numbers) gaps[n - 1] = draws.length - 1 - i;
    });
    return gaps;
};

/** Co-occurrence counts for every unordered ball pair. Key is "a-b" with a < b. */
export const pairCounts = (draws) => {
    const counts = new Map();
    for (const draw of draws) {
        const nums = sortAsc(draw.numbers);
        for (let i = 0; i < nums.length; i += 1) {
            for (let j = i + 1; j < nums.length; j += 1) {
                const key = `${nums[i]}-${nums[j]}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
    }
    return counts;
};

/** Expected co-occurrence of one specific pair over `draws` draws. */
export const expectedPairCoOccurrences = (draws) => (draws.length * 30) / (49 * 48);

/** Pair key for two distinct balls. */
export const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * Everything a strategy rule may look at for one fold: the history prefix and
 * the statistics derived from it, plus the draw being predicted.
 */
export const buildFoldStats = (prior, target) => {
    const last = prior[prior.length - 1] ?? null;
    return {
        draws: prior.length,
        freq: freqCounts(prior),
        velocity: velocityResiduals(prior, 50),
        skips: skipGaps(prior),
        pairCounts: pairCounts(prior),
        expectedPairs: expectedPairCoOccurrences(prior),
        lastDraw: last,
        weekday: target ? weekdayOf(target.date) : null,
        month: target ? monthOf(target.date) : null,
    };
};
