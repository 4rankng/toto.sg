// toto.sg — cross-panel gambler strategies 06–10.
//
// Pure line rules for the walk-forward league. Every candidate line is built
// from the injected `rng` (never Math.random), judged against the draw-history
// prefix, and returned sorted ascending with six unique balls in 1..49.
// A rule returns null to reject the candidate so the caller can retry with a
// fresh rng draw.
//
// Audit behind the constants: toto_10_gambler_strategies.docx.
import {
    RANGE49,
    TAIL_CLASSES,
    acValue,
    consecPairs,
    decadeOf,
    distinctTails,
    hasThreeTermAp,
    lineSum,
    oddCount,
    playslipCell,
    randInt,
    sampleK,
    sortAsc,
    tailOf,
} from "./gambler-stats.mjs";

// ---------------------------------------------------------------------------
// Small local helpers
// ---------------------------------------------------------------------------

/** Every k-subset of `pool` in ascending index order. */
const combinations = (pool, k) => {
    const out = [];
    const acc = [];
    const walk = (start) => {
        if (acc.length === k) {
            out.push([...acc]);
            return;
        }
        for (let i = start; i <= pool.length - (k - acc.length); i += 1) {
            acc.push(pool[i]);
            walk(i + 1);
            acc.pop();
        }
    };
    walk(0);
    return out;
};

/** Like `combinations`, but keeps only the subsets that satisfy `keep`. */
const combinationsWhere = (pool, k, keep) => {
    const out = [];
    const acc = [];
    const walk = (start) => {
        if (acc.length === k) {
            if (keep(acc)) out.push([...acc]);
            return;
        }
        for (let i = start; i <= pool.length - (k - acc.length); i += 1) {
            acc.push(pool[i]);
            walk(i + 1);
            acc.pop();
        }
    };
    walk(0);
    return out;
};

/** One element of a non-empty list, chosen with the injected rng. */
const pickWithRng = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** Sum of a list of balls. */
const sumOf = (list) => list.reduce((acc, n) => acc + n, 0);

// ---------------------------------------------------------------------------
// 06 — Asymmetric Composition Cell (3 Odd / 2 High) + High-AC Sieve
// ---------------------------------------------------------------------------

// The 4 Low balls sit at 24 or below, at least 3 of them in the 19–24 band.
// Picking 4 balls out of the 6-number band 19–24 always creates a consecutive
// pair, so the fourth Low ball necessarily comes from 1–18.
const LOW_BAND = [19, 20, 21, 22, 23, 24];
const LOW_FLOOR = RANGE49.filter((n) => n <= 18);
const HIGH_HALF = RANGE49.filter((n) => n >= 25);

// Only triples that already carry no consecutive pair and no 3-term AP can
// ever survive the sieve, so the sampler skips the other 18 outright.
const LOW_BAND_TRIPLES = combinations(LOW_BAND, 3).filter((triple) => consecPairs(triple) === 0 && !hasThreeTermAp(triple));

const compositionAcNineAccepts = (line) => {
    if (oddCount(line) !== 3) return false;
    const high = line.filter((n) => n > 24);
    if (high.length !== 2) return false;
    const low = line.filter((n) => n <= 24);
    if (low.length !== 4) return false;
    if (low.filter((n) => n >= 19).length < 3) return false;
    if (consecPairs(line) !== 0) return false;
    if (acValue(line) < 9) return false;
    if (hasThreeTermAp(line)) return false;
    const sum = lineSum(line);
    return sum >= 150 && sum <= 190;
};

// ---------------------------------------------------------------------------
// 07 — Calendar-Conditional Regime Switching
// ---------------------------------------------------------------------------

// Monday skews to 23/39/18, Thursday to 46/20/4.
const WEEKDAY_CORE = {
    Mon: [18, 23, 39],
    Thu: [4, 20, 46],
};

// Special (Friday) draws pick their two core balls from the pooled regimes.
const REGIME_POOL = [4, 18, 20, 23, 39, 46];

// The document excludes #40 whenever #18 is active.
const BANNED_WITH_18 = 40;

/** Seasonal sum drift: warmest in March, coldest in June. */
const sumBandForMonth = (month) => {
    if (month >= 1 && month <= 3) return [155, 190];
    if (month === 6) return [142, 172];
    return [145, 185];
};

// ---------------------------------------------------------------------------
// 08 — Cascade Draw 4 Barbell & Span-43 Boundary Lock
// ---------------------------------------------------------------------------

// Barbell anchors: the modal span is 43, so the extremes are pinned and every
// other ball leaves the crowded 7–32 calendar zone.
const BARBELL_ANCHORS = [];
for (const p1 of [4, 5, 6]) {
    for (const p6 of [47, 48, 49]) {
        if (p6 - p1 >= 42 && p6 - p1 <= 44) BARBELL_ANCHORS.push([p1, p6]);
    }
}
const BARBELL_MIDDLE = RANGE49.filter((n) => n >= 33 && n <= 46);

const cascadeBarbellSpan43Accepts = (line) => {
    const sorted = sortAsc(line);
    const p1 = sorted[0];
    const p6 = sorted[5];
    if (![4, 5, 6].includes(p1)) return false;
    if (![47, 48, 49].includes(p6)) return false;
    if (p6 - p1 < 42 || p6 - p1 > 44) return false;
    if (sorted.some((n) => n >= 7 && n <= 32)) return false;
    if (!sorted.slice(1, 5).every((n) => n >= 33 && n <= 46)) return false;
    const sum = lineSum(sorted);
    return sum >= 190 && sum <= 215;
};

// ---------------------------------------------------------------------------
// 09 — 5-Tail Terminal Digit Architecture & Zero-Ending Throttle
// ---------------------------------------------------------------------------

// The homologous pair sits in tail 2 (strongest) or tail 4 (tetraphobia).
const HOMOLOGOUS_TAILS = [2, 4];
const TAIL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const fiveTailModeAccepts = (line) => {
    if (distinctTails(line) !== 5) return false;
    const tailCounts = new Map();
    for (const n of line) tailCounts.set(tailOf(n), (tailCounts.get(tailOf(n)) ?? 0) + 1);
    const doubled = [...tailCounts.entries()].filter(([, count]) => count === 2).map(([tail]) => tail);
    if (doubled.length !== 1 || !HOMOLOGOUS_TAILS.includes(doubled[0])) return false;
    // The tail-0 pool holds only 4 balls, so at most one ball may end in 0.
    if (line.filter((n) => tailOf(n) === 0).length > 1) return false;
    const decades = new Array(5).fill(0);
    for (const n of line) decades[decadeOf(n)] += 1;
    if (decades.some((count) => count === 0)) return false;
    if (decades.filter((count) => count === 2).length !== 1) return false;
    const sum = lineSum(line);
    return sum >= 115 && sum <= 185;
};

// ---------------------------------------------------------------------------
// 10 — 7×7 Playslip Anti-Geometry & Cross-Corner Harvesting
// ---------------------------------------------------------------------------

// The playslip centre cross: column 4, minus the crowded row-4 ball 25.
const PLAYSLIP_COLUMN4 = [4, 11, 18, 32, 39, 46];
// Cross-corner harvest: the two corners opposite the centre.
const PLAYSLIP_CORNERS = [43, 49];
// The main diagonals attract human geometric betting and underperform.
const MAIN_DIAGONAL = new Set([1, 9, 17, 25, 33, 41, 49]);
const ANTI_DIAGONAL = new Set([7, 13, 19, 25, 31, 37, 43]);
const DIAGONALS = new Set([...MAIN_DIAGONAL, ...ANTI_DIAGONAL]);

// The three free balls: off column 4 (that column is already full at two) and
// off both diagonals. The corner ball is exempt from the diagonal ban.
const PLAYSLIP_FREE = RANGE49.filter((n) => !PLAYSLIP_COLUMN4.includes(n) && !DIAGONALS.has(n) && !PLAYSLIP_CORNERS.includes(n));

const playslipAntiGeometryAccepts = (line) => {
    if (line.length !== 6 || new Set(line).size !== 6) return false;
    const column4 = line.filter((n) => PLAYSLIP_COLUMN4.includes(n));
    if (column4.length !== 2) return false;
    const corners = line.filter((n) => PLAYSLIP_CORNERS.includes(n));
    if (corners.length !== 1) return false;
    const free = line.filter((n) => !PLAYSLIP_COLUMN4.includes(n) && !PLAYSLIP_CORNERS.includes(n));
    if (free.length !== 3) return false;
    if (free.some((n) => DIAGONALS.has(n))) return false;
    const rows = new Array(8).fill(0);
    const columns = new Array(8).fill(0);
    for (const n of line) {
        const cell = playslipCell(n);
        rows[cell.row] += 1;
        columns[cell.col] += 1;
    }
    if (rows.some((count) => count > 2)) return false;
    if (columns.some((count) => count > 2)) return false;
    return true;
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * Strategy rules 06–10. Each rule builds one 6-number line for the draw
 * `target`.
 *
 * @param {Array} prior  past draws ascending: {draw, date, numbers[6], additional}
 * @param {Object} target {draw, date} — the draw being predicted
 * @param {Function} rng  () => float in [0,1), seeded per (rule id, draw no)
 * @param {Object} stats  buildFoldStats(prior, target) output
 * @returns {number[]|null} sorted ascending, 6 unique numbers in 1..49, or null
 */
export const RULES_B = {
    /**
     * 06 — Asymmetric Composition Cell (3 Odd / 2 High) + High-AC Sieve.
     * Samples the four Low balls (3 from the 19–24 band, 1 from 1–18) and the
     * two High balls (25–49) directly, then sieves on the full predicate.
     */
    compositionAcNine(prior, target, rng, stats) {
        for (let attempt = 0; attempt < 2000; attempt += 1) {
            const triple = pickWithRng(rng, LOW_BAND_TRIPLES);
            const fourthLow = LOW_FLOOR[randInt(rng, 0, LOW_FLOOR.length - 1)];
            const highs = sampleK(rng, HIGH_HALF, 2);
            const line = sortAsc([...triple, fourthLow, ...highs]);
            if (compositionAcNineAccepts(line)) return line;
        }
        return null;
    },

    /**
     * 07 — Calendar-Conditional Regime Switching (Monday/Thursday & Seasonal
     * Drift). The line carries every regime CORE ball; the remaining slots are
     * filled so the seasonal sum band is met. Candidates are enumerated and one
     * is drawn with the rng — never left to luck.
     */
    weekdayRegime(prior, target, rng, stats) {
        const weekday = stats.weekday;
        const core = WEEKDAY_CORE[weekday] ? [...WEEKDAY_CORE[weekday]] : sampleK(rng, REGIME_POOL, 2);
        const banned = core.includes(18) ? [BANNED_WITH_18] : [];
        const pool = RANGE49.filter((n) => !core.includes(n) && !banned.includes(n));
        const need = 6 - core.length;
        const coreSum = sumOf(core);
        const [lo, hi] = sumBandForMonth(stats.month);
        const fills = combinationsWhere(pool, need, (fill) => {
            const sum = coreSum + sumOf(fill);
            return sum >= lo && sum <= hi;
        });
        if (fills.length === 0) return null;
        return sortAsc([...core, ...pickWithRng(rng, fills)]);
    },

    /**
     * 08 — Cascade Draw 4 Barbell & Span-43 Boundary Lock. The anchors
     * (P1 ∈ {4,5,6}, P6 ∈ {47,48,49}, span 42–44) are enumerated; the four
     * middle balls are sampled from 33–46 and checked against the payout band.
     */
    cascadeBarbellSpan43(prior, target, rng, stats) {
        for (let attempt = 0; attempt < 2000; attempt += 1) {
            const [p1, p6] = pickWithRng(rng, BARBELL_ANCHORS);
            const middles = sampleK(rng, BARBELL_MIDDLE, 4);
            const line = sortAsc([p1, ...middles, p6]);
            if (cascadeBarbellSpan43Accepts(line)) return line;
        }
        return null;
    },

    /**
     * 09 — 5-Tail Terminal Digit Architecture & Zero-Ending Throttle. One tail
     * (2 or 4) is used twice, the other four tails appear once each; the
     * decade spread must read 1-1-1-2-1.
     */
    fiveTailMode(prior, target, rng, stats) {
        for (let attempt = 0; attempt < 2000; attempt += 1) {
            const homologous = HOMOLOGOUS_TAILS[randInt(rng, 0, HOMOLOGOUS_TAILS.length - 1)];
            const otherTails = sampleK(
                rng,
                TAIL_DIGITS.filter((digit) => digit !== homologous),
                4,
            );
            const line = sortAsc([...sampleK(rng, TAIL_CLASSES[homologous], 2), ...otherTails.map((digit) => pickWithRng(rng, TAIL_CLASSES[digit]))]);
            if (fiveTailModeAccepts(line)) return line;
        }
        return null;
    },

    /**
     * 10 — 7×7 Playslip Anti-Geometry & Cross-Corner Harvesting. Two balls from
     * playslip column 4 (never 25), one high corner, three free balls kept off
     * both main diagonals and off any crowded row or column.
     */
    playslipAntiGeometry(prior, target, rng, stats) {
        for (let attempt = 0; attempt < 2000; attempt += 1) {
            const column4 = sampleK(rng, PLAYSLIP_COLUMN4, 2);
            const corner = pickWithRng(rng, PLAYSLIP_CORNERS);
            const free = sampleK(rng, PLAYSLIP_FREE, 3);
            const line = sortAsc([...column4, corner, ...free]);
            if (playslipAntiGeometryAccepts(line)) return line;
        }
        return null;
    },
};
