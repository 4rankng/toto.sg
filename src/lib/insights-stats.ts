// toto.sg — the arithmetic behind the Insights gallery.
//
// Every panel in the gallery pairs what actually happened with what a fair
// cage would have produced: the observed bar sits next to the expected one,
// and the caption says what the expectation is. All of it is computed here
// from the draws themselves — no new data files, no new dependencies.
//
// The expectations are exact, not eyeballed:
//   • a number's cycle length is 49 ÷ 6 draws;
//   • repeats from the previous draw are hypergeometric over the 6 held-out
//     numbers;
//   • the gap between two consecutive picks follows the uniform-composition
//     law of a random 6-subset of 1…49;
//   • the j-th smallest pick has the exact order-statistic law
//     C(x-1, j-1) · C(49-x, 6-j) ÷ C(49, 6);
//   • the (odd, high) composition is multivariate hypergeometric over the
//     four parity × half pools.
import type { Draw } from "@/lib/data";

/* ------------------------------------------------------------------ *
 * The cage
 * ------------------------------------------------------------------ */

/** Numbers in the pool. */
export const POOL = 49;

/** Numbers drawn per draw. */
export const PICKS = 6;

/** The number of draws per year a 6/49 game runs. */
export const DRAWS_PER_YEAR = 156;

/** Mean cycle length of a number: 49 ÷ 6 draws between two appearances. */
export const EXPECTED_CYCLE = POOL / PICKS;

/** A number is "overdue" once it has been missing this many expected cycles. */
export const DANGER_CYCLES = 3;

/** Draws a number must miss to be considered overdue (24.5 → 25 whole draws). */
export const DANGER_GAP = Math.ceil(EXPECTED_CYCLE * DANGER_CYCLES);

/** Probability that one specific number stays absent for `gap` more draws. */
export const absenceProbability = (gap: number) => Math.pow((POOL - PICKS) / POOL, gap);

/* ------------------------------------------------------------------ *
 * Small combinatorics
 * ------------------------------------------------------------------ */

/** Exact binomial coefficient, integer-safe for the sizes we use. */
export function binomial(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let result = 1;
    for (let i = 1; i <= k; i += 1) {
        result = Math.round((result * (n - k + i)) / i);
    }
    return result;
}

/** C(49, 6) — the odds of one exact line. */
export const TOTAL_LINES = binomial(POOL, PICKS);

/** Linear-interpolation percentile of an unsorted sample. */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) return Number.NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/* ------------------------------------------------------------------ *
 * Gaps — the volcano
 * ------------------------------------------------------------------ */

export interface GapRow {
    number: number;
    /** Draws since this number last appeared; 0 means it came out last draw. */
    gap: number;
    /** How many of the era's draws it appeared in. */
    count: number;
}

export interface GapStats {
    rows: GapRow[];
    /** Expected draws between two appearances of the same number. */
    expectedCycle: number;
    /** Gap at which a number counts as overdue. */
    dangerGap: number;
    /** How many numbers are currently overdue. */
    overdueCount: number;
    /** How many numbers a fair cage would have overdue at this moment. */
    expectedOverdue: number;
    /** The overdue numbers, hottest first. */
    hottest: GapRow[];
}

/**
 * Current gap per number against the fair-cage expectation.
 *
 * `lastSeen` in analysis.json already carries the gap for all 49 numbers; the
 * frequency counts are folded in from the same array so a row never mixes
 * two sources.
 */
export function gapStats(lastSeen: { number: number; gap: number }[], frequency: number[]): GapStats {
    const rows: GapRow[] = lastSeen.map((entry) => ({
        number: entry.number,
        gap: entry.gap,
        count: frequency[entry.number - 1] ?? 0,
    }));

    const overdue = rows.filter((row) => row.gap >= DANGER_GAP);
    const overdueCount = overdue.length;
    // Each number is absent for `gap` draws with probability ((49-6)/49)^gap,
    // so a fair cage leaves this many numbers overdue at any moment.
    const expectedOverdue = POOL * absenceProbability(DANGER_GAP);

    return {
        rows,
        expectedCycle: EXPECTED_CYCLE,
        dangerGap: DANGER_GAP,
        overdueCount,
        expectedOverdue,
        hottest: [...overdue].sort((a, b) => b.gap - a.gap || a.number - b.number),
    };
}

/* ------------------------------------------------------------------ *
 * Timeline and streaks
 * ------------------------------------------------------------------ */

export interface TimelineDraw {
    draw: number;
    date: string;
    /** The six winning numbers. */
    numbers: number[];
    /** The additional number, or null when the draw has none. */
    additional: number | null;
}

/** The last `window` draws, oldest first — the tracking-chart strip. */
export function timelineWindow(draws: Draw[], window = 60): TimelineDraw[] {
    return draws.slice(-window).map((draw) => ({
        draw: draw.draw,
        date: draw.date,
        numbers: [...draw.numbers].sort((a, b) => a - b),
        additional: draw.additional,
    }));
}

export interface StreakRow {
    number: number;
    /** Hit flags over the window, oldest first. */
    hits: boolean[];
    /** Hits in the last 10 draws — the "hot right now" score. */
    hot: number;
    /** Hits across the whole window. */
    total: number;
    /** Runs of consecutive hits, longest first. */
    longestRun: number;
}

/** Per-number hit strips over the last `window` draws, hottest number first. */
export function streakRows(draws: Draw[], window = 30): StreakRow[] {
    const slice = draws.slice(-window);
    const recent = Math.min(10, slice.length);

    const rows: StreakRow[] = [];
    for (let number = 1; number <= POOL; number += 1) {
        const hits = slice.map((draw) => draw.numbers.includes(number));
        let longestRun = 0;
        let run = 0;
        for (const hit of hits) {
            run = hit ? run + 1 : 0;
            if (run > longestRun) longestRun = run;
        }
        rows.push({
            number,
            hits,
            hot: hits.slice(-recent).filter(Boolean).length,
            total: hits.filter(Boolean).length,
            longestRun,
        });
    }

    return rows.sort((a, b) => b.hot - a.hot || b.total - a.total || a.number - b.number);
}

/* ------------------------------------------------------------------ *
 * Sum trend
 * ------------------------------------------------------------------ */

export interface SumPoint {
    index: number;
    date: string;
    sum: number;
    /** Rolling mean over the trailing `window` draws. */
    mean: number;
}

/** Rolling mean of the six-number sum across the whole era. */
export function sumTrend(draws: Draw[], window = 20): SumPoint[] {
    const sums = draws.map((draw) => draw.numbers.reduce((total, n) => total + n, 0));
    let running = 0;

    return draws.map((draw, index) => {
        running += sums[index];
        if (index >= window) running -= sums[index - window];
        const count = Math.min(index + 1, window);
        return { index, date: draw.date, sum: sums[index], mean: running / count };
    });
}

/* ------------------------------------------------------------------ *
 * Composition matrix — odd count × high count
 * ------------------------------------------------------------------ */

export interface CompositionCell {
    odd: number;
    high: number;
    /** Draws observed with this combination. */
    count: number;
    /** Observed share of the era's draws, 0–1. */
    share: number;
    /** Expected share under a fair cage, 0–1. */
    expected: number;
    /** Observed minus expected, in percentage points. */
    delta: number;
}

/** The four parity × half pools inside 1…49. */
const POOL_SPLIT = {
    oddLow: 12, // 1, 3, … 23
    oddHigh: 13, // 25, 27, … 49
    evenLow: 12, // 2, 4, … 24
    evenHigh: 12, // 26, 28, … 48
};

/**
 * Expected share of every (odd count, high count) cell under a fair cage.
 *
 * Oddness and highness are not independent — there are 13 odd high numbers
 * but only 12 even ones — so the expectation is the exact four-pool
 * hypergeometric, not the product of the two marginals.
 */
export function expectedComposition(): number[][] {
    const grid: number[][] = Array.from({ length: PICKS + 1 }, () => new Array(PICKS + 1).fill(0));
    const { oddLow, oddHigh, evenLow, evenHigh } = POOL_SPLIT;

    for (let a = 0; a <= PICKS; a += 1) {
        for (let b = 0; b + a <= PICKS; b += 1) {
            for (let c = 0; c + a + b <= PICKS; c += 1) {
                const d = PICKS - a - b - c;
                const weight =
                    (binomial(oddLow, a) * binomial(oddHigh, b) * binomial(evenLow, c) * binomial(evenHigh, d)) / TOTAL_LINES;
                const odd = a + b;
                const high = b + d;
                grid[odd][high] += weight;
            }
        }
    }

    return grid;
}

/** Observed and expected shares for every cell of the composition matrix. */
export function compositionMatrix(draws: Draw[]): CompositionCell[] {
    const counts = Array.from({ length: PICKS + 1 }, () => new Array(PICKS + 1).fill(0));

    for (const draw of draws) {
        const odd = draw.numbers.filter((n) => n % 2 === 1).length;
        const high = draw.numbers.filter((n) => n > 24).length;
        counts[odd][high] += 1;
    }

    const expected = expectedComposition();
    const cells: CompositionCell[] = [];

    for (let odd = 0; odd <= PICKS; odd += 1) {
        for (let high = 0; high <= PICKS; high += 1) {
            const count = counts[odd][high];
            const share = count / draws.length;
            const expectedShare = expected[odd][high];
            cells.push({ odd, high, count, share, expected: expectedShare, delta: (share - expectedShare) * 100 });
        }
    }

    return cells;
}

/* ------------------------------------------------------------------ *
 * Repeaters — numbers carried over from the previous draw
 * ------------------------------------------------------------------ */

export interface RepeaterRow {
    /** 0, 1, 2 or 3 for "three or more". */
    bucket: number;
    label: string;
    /** Draws observed in this bucket. */
    count: number;
    /** Observed share of the evaluated draws. */
    share: number;
    /** Expected share under a fair cage. */
    expected: number;
}

export interface RepeaterStats {
    rows: RepeaterRow[];
    /** Draws evaluated — every era draw with a predecessor inside the era. */
    evaluated: number;
    /** Observed repeats per draw. */
    observedAverage: number;
    /** Expected repeats per draw: 6 held-out numbers × 6 ÷ 49. */
    expectedAverage: number;
}

/**
 * How many numbers carried over from the previous draw, against the
 * hypergeometric expectation. The previous draw's six numbers are six marked
 * balls in the 49, so the count of repeats in the next draw is hypergeometric.
 */
export function repeaterStats(draws: Draw[]): RepeaterStats {
    const counts = [0, 0, 0, 0]; // 0, 1, 2, 3+
    let total = 0;
    let evaluated = 0;

    for (let i = 1; i < draws.length; i += 1) {
        const previous = new Set(draws[i - 1].numbers);
        const repeats = draws[i].numbers.filter((n) => previous.has(n)).length;
        total += repeats;
        evaluated += 1;
        counts[Math.min(repeats, 3)] += 1;
    }

    // P(X = k) with 6 marked balls among 49, drawing 6.
    const probability = (k: number) => (binomial(PICKS, k) * binomial(POOL - PICKS, PICKS - k)) / TOTAL_LINES;

    const labels = ["0", "1", "2", "3 or more"];
    const rows: RepeaterRow[] = [0, 1, 2, 3].map((bucket) => {
        const expected = bucket === 3 ? probability(3) + probability(4) + probability(5) + probability(6) : probability(bucket);
        return {
            bucket,
            label: labels[bucket],
            count: counts[bucket],
            share: evaluated > 0 ? counts[bucket] / evaluated : 0,
            expected,
        };
    });

    return {
        rows,
        evaluated,
        observedAverage: evaluated > 0 ? total / evaluated : 0,
        expectedAverage: (PICKS * PICKS) / POOL,
    };
}

/* ------------------------------------------------------------------ *
 * Delta profile — gaps between adjacent picks
 * ------------------------------------------------------------------ */

export interface DeltaRow {
    /** The gap between two adjacent picks, 1…44. */
    gap: number;
    /** Observed occurrences across the era. */
    count: number;
    /** Expected occurrences under a fair cage. */
    expected: number;
}

export interface DeltaStats {
    rows: DeltaRow[];
    /** Observed mean gap between adjacent picks. */
    observedAverage: number;
    /** Theoretical mean gap: (49 + 1) ÷ (6 + 1). */
    expectedAverage: number;
    /** Most frequent adjacent gap (owner rule: modal indicators only). */
    modeGap: number;
    modeGapCount: number;
}

/**
 * The distribution of the gaps between adjacent picks.
 *
 * A random 6-subset of 1…49 is in bijection with the weak compositions of
 * 43 into 7 parts, and those compositions are uniform — so the marginal law
 * of one internal gap g is P(g) = C(49-g, 5) ÷ C(49, 6).
 */
export function deltaStats(draws: Draw[], maxGap = 25): DeltaStats {
    const counts = new Map<number, number>();
    let total = 0;

    for (const draw of draws) {
        const sorted = [...draw.numbers].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i += 1) {
            const gap = sorted[i] - sorted[i - 1];
            counts.set(gap, (counts.get(gap) ?? 0) + 1);
            total += 1;
        }
    }

    const rows: DeltaRow[] = [];
    for (let gap = 1; gap <= maxGap; gap += 1) {
        const expected = (binomial(POOL - gap, PICKS - 1) / TOTAL_LINES) * total;
        rows.push({ gap, count: counts.get(gap) ?? 0, expected });
    }

    // Owner rule 2026-11-15: modal indicator for display; mean stays internal.
    let modeGap = 1, modeGapCount = 0;
    for (const r of rows) if (r.count > modeGapCount) { modeGap = r.gap; modeGapCount = r.count; }
    return {
        rows,
        observedAverage: total > 0 ? sumOfGaps(draws) / total : 0,
        expectedAverage: (POOL + 1) / (PICKS + 1),
        modeGap,
        modeGapCount,
    };
}

/** Sum of all adjacent gaps — for the mean only. */
function sumOfGaps(draws: Draw[]): number {
    let total = 0;
    for (const draw of draws) {
        const sorted = [...draw.numbers].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i += 1) total += sorted[i] - sorted[i - 1];
    }
    return total;
}

/* ------------------------------------------------------------------ *
 * Sorted-position ladder
 * ------------------------------------------------------------------ */

export interface PositionRow {
    /** 1…6 — the sorted position in the draw. */
    position: number;
    /** Observed 5th percentile of that position across the era. */
    observedLow: number;
    /** Observed median. */
    observedMedian: number;
    /** Observed 95th percentile. */
    observedHigh: number;
    /** Theoretical 5th percentile under a fair cage. */
    expectedLow: number;
    /** Theoretical median. */
    expectedMedian: number;
    /** Theoretical 95th percentile. */
    expectedHigh: number;
    /** Theoretical mean of that order statistic. */
    expectedMean: number;
}

/** Exact law of the j-th smallest pick: C(x-1, j-1) · C(49-x, 6-j) ÷ C(49, 6). */
function orderStatisticLaw(position: number): number[] {
    const law = new Array(POOL + 1).fill(0);
    for (let x = position; x <= POOL - (PICKS - position); x += 1) {
        law[x] = (binomial(x - 1, position - 1) * binomial(POOL - x, PICKS - position)) / TOTAL_LINES;
    }
    return law;
}

/** Quantile of the exact order-statistic law. */
function lawQuantile(law: number[], p: number): number {
    let cumulative = 0;
    for (let x = 1; x < law.length; x += 1) {
        cumulative += law[x];
        if (cumulative >= p) return x;
    }
    return law.length - 1;
}

/** Observed and theoretical spread of each sorted position in the draw. */
export function positionLadder(draws: Draw[]): PositionRow[] {
    const columns: number[][] = Array.from({ length: PICKS }, () => []);

    for (const draw of draws) {
        const sorted = [...draw.numbers].sort((a, b) => a - b);
        for (let i = 0; i < PICKS; i += 1) columns[i].push(sorted[i]);
    }

    return columns.map((column, index) => {
        const position = index + 1;
        const law = orderStatisticLaw(position);
        return {
            position,
            observedLow: percentile(column, 0.05),
            observedMedian: percentile(column, 0.5),
            observedHigh: percentile(column, 0.95),
            expectedLow: lawQuantile(law, 0.05),
            expectedMedian: lawQuantile(law, 0.5),
            expectedHigh: lawQuantile(law, 0.95),
            expectedMean: (position * (POOL + 1)) / (PICKS + 1),
        };
    });
}

/* ------------------------------------------------------------------ *
 * Month of year
 * ------------------------------------------------------------------ */

export interface MonthCell {
    month: number;
    year: number;
    /** Mean sum of the draws in that month, or null when there were none. */
    meanSum: number | null;
    /** Draws behind that mean. */
    draws: number;
}

export interface MonthStats {
    /** Rows are months (1…12), columns are years, oldest year first. */
    years: number[];
    cells: MonthCell[][];
    /** Mean sum per calendar month across the whole era. */
    monthlyMean: { month: number; mean: number; draws: number }[];
    /** Era-wide mean sum, the reference line. */
    overallMean: number;
    /** Spread between the best and worst calendar month. */
    spread: number;
}

/** Mean sum and draw count by calendar month. */
export function monthStats(draws: Draw[]): MonthStats {
    const years = [...new Set(draws.map((draw) => Number(draw.date.slice(0, 4))))].sort();
    const buckets = new Map<string, { sum: number; count: number }>();
    let totalSum = 0;

    for (const draw of draws) {
        const year = Number(draw.date.slice(0, 4));
        const month = Number(draw.date.slice(5, 7));
        const sum = draw.numbers.reduce((acc, n) => acc + n, 0);
        totalSum += sum;
        const key = `${year}-${month}`;
        const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
        bucket.sum += sum;
        bucket.count += 1;
        buckets.set(key, bucket);
    }

    const cells: MonthCell[][] = [];
    for (let month = 1; month <= 12; month += 1) {
        cells.push(
            years.map((year) => {
                const bucket = buckets.get(`${year}-${month}`);
                return {
                    month,
                    year,
                    meanSum: bucket && bucket.count > 0 ? bucket.sum / bucket.count : null,
                    draws: bucket?.count ?? 0,
                };
            }),
        );
    }

    const monthlyMean = cells.map((row, index) => {
        const month = index + 1;
        const withDraws = row.filter((cell) => cell.meanSum !== null);
        const draws = withDraws.reduce((acc, cell) => acc + cell.draws, 0);
        const sum = withDraws.reduce((acc, cell) => acc + (cell.meanSum ?? 0) * cell.draws, 0);
        return { month, mean: draws > 0 ? sum / draws : 0, draws };
    });

    const means = monthlyMean.filter((row) => row.draws > 0).map((row) => row.mean);

    return {
        years,
        cells,
        monthlyMean,
        overallMean: draws.length > 0 ? totalSum / draws.length : 0,
        spread: means.length > 0 ? Math.max(...means) - Math.min(...means) : 0,
    };
}

/* ------------------------------------------------------------------ *
 * Additional ball
 * ------------------------------------------------------------------ */

export interface AdditionalStats {
    /** Appearances of each additional number, index 0 is number 1. */
    counts: number[];
    /** Draws that carried an additional number. */
    evaluated: number;
    /** Expected appearances of each number: draws ÷ 49. */
    expected: number;
    /** The additional number in the latest draw, if it had one. */
    latest: number | null;
    /** Date of the latest draw. */
    latestDate: string | null;
    /** The additional number seen most often. */
    hottest: { number: number; count: number } | null;
}

/** How often each number came up as the additional ball. */
export function additionalStats(draws: Draw[]): AdditionalStats {
    const counts = new Array(POOL).fill(0);
    let evaluated = 0;

    for (const draw of draws) {
        if (draw.additional == null) continue;
        evaluated += 1;
        if (draw.additional >= 1 && draw.additional <= POOL) counts[draw.additional - 1] += 1;
    }

    let hottest: { number: number; count: number } | null = null;
    counts.forEach((count, index) => {
        if (!hottest || count > hottest.count) hottest = { number: index + 1, count };
    });

    const last = draws.at(-1);

    return {
        counts,
        evaluated,
        expected: evaluated / POOL,
        latest: last?.additional ?? null,
        latestDate: last?.date ?? null,
        hottest,
    };
}
