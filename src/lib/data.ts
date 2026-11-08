// toto.sg — client data layer: JSON artifact types, draw maths, one-shot fetch hook.
import { useEffect, useState } from "react";

export type PrizeKey = "g1" | "g2" | "g3" | "g4" | "g5" | "g6" | "g7";

export interface PrizeShare {
    share: number | null;
    winners: number | null;
}

export interface Draw {
    draw: number;
    date: string;
    numbers: number[];
    additional: number | null;
    prizes?: Record<PrizeKey, PrizeShare>;
}

export interface LatestResult {
    drawNo: number;
    date: string;
    numbers: number[];
    additional: number | null;
    prizes: Record<PrizeKey, PrizeShare> | null;
    fetchedAt: string;
}

export interface CountEntry {
    number: number;
    count: number;
}

export interface GapEntry {
    number: number;
    gap: number;
}

export interface HotColdEntry extends CountEntry {
    gap: number;
}

export interface PairEntry {
    a: number;
    b: number;
    count: number;
}

export interface Analysis {
    generatedAt: string;
    coverage: {
        firstDraw: number;
        lastDraw: number;
        totalDraws: number;
        firstDate: string;
        lastDate: string;
    };
    frequency: {
        all: number[];
        last50: number[];
    };
    hot: { all: HotColdEntry[]; last50: HotColdEntry[] };
    cold: { all: HotColdEntry[]; last50: HotColdEntry[] };
    overdue: GapEntry[];
    lastSeen: GapEntry[];
    oddEven: number[];
    lowHigh: number[];
    sum: {
        bands: { band: string; count: number }[];
        mean: number;
        median: number;
    };
    decades: number[];
    consecutive: {
        drawRate: number;
        topPairs: PairEntry[];
    };
    pairs: PairEntry[];
    repeaters: {
        rate: number;
        avgCount: number;
    };
    weekday: Record<string, { count: number; meanSum: number }>;
    group1ByYear: Record<string, { wins: number; maxJackpot: number }>;
}

/** One row of the strategy league (public/data/strategies.json). */
export interface StrategyRow {
    id: string;
    name: string;
    family: string;
    description: string;
    evaluatedDraws: number;
    /** Total main numbers matched over the evaluated draws (chance: 73.5 per 100). */
    totalHits: number;
    meanHits: number;
    expectedHits: number;
    zScore: number;
    /** Draws where at least two numbers matched — the hit rate (chance: 15.1 per 100). */
    twoPlusDraws: number;
    score: number;
    totalPrizes: number;
    effPrizes: number;
    /** Prize quality: matched−2 points per prize draw (chance: 1.96 per 100). */
    weightedPrizes: number;
    /** Best prize tier hit over the window (1 = jackpot), or null. */
    bestGroup: number | null;
    pnlPerDraw: number;
    recent12: number;
    rank: number;
    currentPick: number[];
}

export interface StrategyMeta {
    generatedAt: string;
    nextDraw: number;
    folds: number;
    /** The chance nulls every league metric is rendered against. */
    chance: {
        expectedHitsPerLine: number;
        hitsPer100Draws: number;
        twoPlusPer100Draws: number;
        prizesPer100Draws: number;
        weightedPrizesPer100Draws: number;
        scoreBaseline: number;
    };
    families: string[];
}


export interface StrategiesFile {
    meta: StrategyMeta;
    strategies: StrategyRow[];
}


const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const numberFmt = new Intl.NumberFormat("en-SG");

/** "2026-11-05" → "05 Nov 2026". */
export const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export const formatNumber = (n: number) => numberFmt.format(n);

export const formatSgd = (n: number) => `S$${numberFmt.format(n)}`;

export const formatPercent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

/** Signed number with a fixed sign, e.g. "+0.12" / "-0.05". */
export const formatSigned = (n: number, digits = 2) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

/* ------------------------------------------------------------------ *
 * Draw maths
 * ------------------------------------------------------------------ */

export const drawSum = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0);

export const drawOddCount = (numbers: number[]) => numbers.filter((n) => n % 2 === 1).length;

export const drawLowCount = (numbers: number[]) => numbers.filter((n) => n <= 24).length;

/**
 * How many picks a draw had in each decade band: 1–10, 11–20, 21–30, 31–40,
 * 41–49. Matches the buckets behind `analysis.decades`.
 */
export const drawDecades = (numbers: number[]) => {
    const counts = [0, 0, 0, 0, 0];
    for (const n of numbers) counts[Math.floor((n - 1) / 10)] += 1;
    return counts;
};

export const hasConsecutive = (numbers: number[]) => {
    const sorted = [...numbers].sort((a, b) => a - b);
    return sorted.some((n, i) => i > 0 && n === sorted[i - 1] + 1);
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const weekdayOf = (iso: string) => WEEKDAY_LABELS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

/* ------------------------------------------------------------------ *
 * Next draw
 * ------------------------------------------------------------------ */

/** TOTO draws run Monday and Thursday, 18:30 SGT (10:30 UTC). */
const DRAW_WEEKDAYS = [1, 4];
const DRAW_HOUR_UTC = 10;
const DRAW_MINUTE_UTC = 30;

/**
 * The next Mon/Thu 18:30 SGT instant strictly after `lastDrawDate`.
 * `now` is injectable for tests; defaults to the wall clock.
 */
export const nextDrawDate = (lastDrawDate: string, now: Date = new Date()): Date => {
    const last = new Date(`${lastDrawDate}T00:00:00Z`);
    let candidate = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate(), DRAW_HOUR_UTC, DRAW_MINUTE_UTC));

    for (let i = 0; i < 21; i += 1) {
        if (DRAW_WEEKDAYS.includes(candidate.getUTCDay()) && candidate.getTime() > now.getTime()) return candidate;
        candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    }

    return candidate;
};

/* ------------------------------------------------------------------ *
 * History search
 * ------------------------------------------------------------------ */

export interface DrawQuery {
    /** Numbers the draw must contain (all of them). */
    numbers: number[];
    /** Exact draw id. */
    draw: number | null;
    /** Exact ISO date, e.g. "2026-11-05". */
    date: string | null;
    /** Raw query text, echoed back in the UI. */
    text: string;
}

/**
 * Parse a history search box query.
 * "7 and 23" → must contain both; "4232" → draw id; "2026-11-05" → date.
 */
export const parseDrawQuery = (raw: string): DrawQuery => {
    const text = raw.trim();
    const query: DrawQuery = { numbers: [], draw: null, date: null, text };

    if (!text) return query;

    for (const token of text.split(/[\s,]+/).filter(Boolean)) {
        const bare = token.startsWith("#") ? token.slice(1) : token;

        if (/^\d{4}-\d{2}-\d{2}$/.test(bare)) {
            query.date = bare;
            continue;
        }

        if (!/^\d+$/.test(bare)) continue;

        const value = Number(bare);
        if (value >= 1 && value <= 49) query.numbers.push(value);
        else if (value >= 1000) query.draw = value;
    }

    return query;
};

/** Does a draw satisfy a parsed query? */
export const drawMatchesQuery = (draw: Draw, query: DrawQuery) => {
    if (query.draw !== null && draw.draw !== query.draw) return false;
    if (query.date !== null && draw.date !== query.date) return false;
    if (query.numbers.length > 0 && !query.numbers.every((n) => draw.numbers.includes(n))) return false;
    return true;
};

/* ------------------------------------------------------------------ *
 * Fetch
 * ------------------------------------------------------------------ */

export interface UseJsonResult<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

/** Fetch a JSON artifact once per mount. No external data library. */
export function useJson<T>(url: string): UseJsonResult<T> {
    const [state, setState] = useState<UseJsonResult<T>>({ data: null, isLoading: true, error: null });

    useEffect(() => {
        // The result is ignored once the effect is stale, but the request is
        // left to finish: aborting it would log a network error on every
        // StrictMode double-mount.
        let stale = false;
        setState({ data: null, isLoading: true, error: null });
        fetch(url)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return (await res.json()) as T;
            })
            .then((data) => {
                if (!stale) setState({ data, isLoading: false, error: null });
            })
            .catch((err: unknown) => {
                if (!stale) setState({ data: null, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) });
            });
        return () => {
            stale = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    return state;
}
