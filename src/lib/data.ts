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
    /** Display score: raw prize points log-normalised to 1–100 (league leader = 100). */
    score100: number;
    totalPrizes: number;
    effPrizes: number;
    /** The score itself: each prize draw earns 10^(7−group) — G7 1 … G1 1,000,000, a decade per tier (chance ≈ 43.3 per 100). */
    weightedPrizes: number;
    /** Hit depth total: each fold earns 2^(matched−2) — 1/2/4/8/16 for 2–6 matched. */
    depthPoints: number;
    /** Best prize tier hit over the window (1 = jackpot), or null. */
    bestGroup: number | null;
    /** Prize draws per tier over the evaluated folds. */
    tierCounts: Record<"g1" | "g2" | "g3" | "g4" | "g5" | "g6" | "g7", number>;
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
        /** Chance null for depth points per draw (≈0.1717, i.e. 17.17 per 100). */
        depthPointsPer100Draws: number;
        /** Exact per-tier hit probabilities per draw. */
        tierG1: number;
        tierG2: number;
        tierG3: number;
        tierG4: number;
        tierG5: number;
        tierG6: number;
        tierG7: number;
    };
    families: string[];
}


export interface StrategiesFile {
    meta: StrategyMeta;
    strategies: StrategyRow[];
}

/** One prize hit in a strategy's ledger (public/data/prize-events.json). */
export interface PrizeEvent {
    /** The draw the line won on. */
    d: number;
    /** Draw date (ISO). */
    date: string;
    /** The prize tier graded (1 = jackpot … 7). */
    g: number;
    /** The exact 6-ball line that hit. */
    p: number[];
}

/** The prize-hit ledger: per strategy id, every prize fold ascending by draw. */
export interface PrizeEventsFile {
    meta: { generatedAt: string; nextDraw: number; folds: number };
    strategies: Record<string, PrizeEvent[]>;
}

/** An Insights panel a cross-panel strategy was read off. */
export interface CrossPanelPanelRef {
    /** The panel's number in the source document. */
    doc: number;
    /** The live Insights panel id, for a deep link. */
    anchor: string;
    label: string;
}

/** One cross-panel strategy: the rule's evidence plus its live league row. */
export interface CrossPanelStrategy {
    id: string;
    /** The source document's own name for the strategy, in neutral terms. */
    sourceTitle: string;
    summary: string;
    /** The document's illustrative line — an example, never the graded line. */
    specLine: number[];
    specNote: string;
    logic: string;
    differs: string;
    rules: string[];
    panels: CrossPanelPanelRef[];
    row: {
        id: string;
        name: string;
        rank: number;
        score: number;
        totalHits: number;
        meanHits: number;
        twoPlusDraws: number;
        currentPick: number[];
    };
}

/**
 * The cross-panel playbook (public/data/cross-panel-playbook.json): what each
 * of the ten cross-panel strategies selects and why. Documentation only — the
 * league grades the rules themselves on numbers matched.
 */
export interface CrossPanelPlaybook {
    meta: {
        generatedAt: string;
        nextDraw: number;
        family: string;
        source: string;
    };
    strategies: CrossPanelStrategy[];
}

/* ------------------------------------------------------------------ *
 * Edge verification (public/data/edge-verification.json)
 * ------------------------------------------------------------------ */

/** Era label used throughout the edge-verification artifact. */
export type EdgeEra = "e45" | "e49";

/** One walk-forward variant scored by the edge-verification pipeline. */
export interface EdgeVerificationVariant {
    id: string;
    era: EdgeEra;
    folds: number;
    /** Out-of-sample mean main-number hits per ticket. */
    meanHits: number;
    /** The era's exact chance null for meanHits. */
    chanceMeanHits: number;
    /** meanHits − chanceMeanHits, in hits per ticket. */
    edge: number;
    edgeCi95: [number, number];
    edgeCiCoversZero: boolean;
    z: number;
    p: number;
    /** BH-FDR adjusted p-value across the Route 1 grid of the era. */
    q: number;
    significantAtQ05: boolean;
    prizeRate: number;
    chancePrizeRate: number;
    prizeEdgeCi95: [number, number];
    twoPlusRate: number;
    chanceTwoPlusRate: number;
    prizePoints: number;
    bestGroup: number | null;
    /** Prize hits per tier across the era's folds. */
    tiers: Record<PrizeKey, number>;
    /** Sign-stability windows: edge per quarter of the walk-forward run. */
    quarters: { window: string; folds: number; meanHits: number; edge: number }[];
    /** The variant's line for the next draw, when it emits one. */
    lastLine: number[] | null;
}

/** Route 1 walk-forward results for one era. Variants are sorted by edge, best first. */
export interface EdgeVerificationRouteEra {
    era: EdgeEra;
    folds: number;
    variants: EdgeVerificationVariant[];
}

/** One strategy-league row audited under the train/holdout split. */
export interface EdgeVerificationLeagueRow {
    id: string;
    name: string;
    family: string;
    leagueRank: number;
    leagueScore: number;
    folds: number;
    score: number;
    meanHits: number;
    trainScore: number;
    trainMeanHits: number;
    holdoutScore: number;
    holdoutMeanHits: number;
    scoreShrink: number;
    parityWithLeague: boolean;
}

export interface EdgeVerificationLeagueAudit {
    strategyCount: number;
    trainFoldCount: number;
    holdoutFoldCount: number;
    rankCorrelationFullVsHoldout: number;
    meanTop10ScoreShrink: number;
    cacheParityFailures: string[];
    topByTrain: { id: string; name: string; family: string; trainScore: number; holdoutScore: number; scoreShrink: number }[];
    tempoRows: { id: string; name: string; score: number; trainScore: number; holdoutScore: number; rank: number }[];
    rows: EdgeVerificationLeagueRow[];
}

/** Search-size ceiling probe: M uniform variants against the μ + σ√(2 ln M) noise ceiling. */
export interface EdgeVerificationCeilingProbe {
    folds: number;
    variants: number;
    meanScore: number;
    sdScore: number;
    maxScore: number;
    maxScoreSeed: number;
    predictedMaxScore: number;
    maxScoreFirst50k: number;
    maxMeanHits: number;
    maxMeanHitsFirst50k: number;
    meanHits: number;
    prizeRate: number;
    twoPlusRate: number;
    topScores: { seed: number; score: number; meanHits: number }[];
}

export interface EdgeVerificationNullShuffle {
    count: number;
    generator: { iid: number; permuted: number };
    nullProbeM: number;
    matchedMRealProbe: { maxScoreFirst50k: number; maxMeanHitsFirst50k: number };
    statistics: {
        statistic: string;
        real: number;
        nullMean: number;
        nullSd: number;
        nullMax: number;
        empiricalP: number;
        exceedsNullAtP01: boolean;
        /** Below the review's p<0.05 bar but above its p<0.01 kill bar — reported, not claimed. */
        marginalAtP05?: boolean;
    }[];
    pValueThreshold: number;
    consistentWithNull: boolean;
}

export interface EdgeVerificationRoute2 {
    era: EdgeEra;
    rows: {
        id: string;
        family: string;
        seedLabel: string;
        folds: number;
        score: number;
        meanHits: number;
        prizeRate: number;
        twoPlusRate: number;
        bestGroup: number | null;
    }[];
    bestScore: number;
    note: string;
}

export interface EdgeVerificationVerdict {
    primaryMetric: string;
    route1PrimaryEdgeSignificant: boolean;
    nullShuffleConsistentWithUniformity: boolean;
    leagueWinnerCurse: { meanTop10ScoreShrink: number; rankCorrelationFullVsHoldout: number };
    headline: string;
    details: string[];
}

/** Recomputed per-era baselines from the committed archive. */
export interface EdgeVerificationEraEntry {
    pool: number;
    draws: number;
    firstDraw: number;
    lastDraw: number;
    folds: number;
    expectedHitsPerBall: number;
    expectedHitsPerTicket: number;
    prizeRatePerTicket: number;
    pointsPerTicket: number;
}

/**
 * The offline edge-verification experiment (scripts/edge-verification.mjs →
 * public/data/edge-verification.json): walk-forward Route 1, the league
 * winner's-curse audit, the search-size ceiling probe, the null-shuffle
 * benchmark and the headline verdict. Matched-number facts only.
 */
export interface EdgeVerification {
    meta: {
        generatedAt: string;
        archive: { draws: number; firstDraw: number; lastDraw: number };
        warmupDraws: number;
        probeM: number;
        nullProbeM: number;
        nullHistories: number;
        bootstrapReplicates: number;
        probeWorkers: number;
        runtimeSeconds: number;
        methodNotes: string[];
    };
    eraAccounting: {
        e45: EdgeVerificationEraEntry;
        e49: EdgeVerificationEraEntry;
        reviewBaselineNote: string;
    };
    route1: { e45: EdgeVerificationRouteEra; e49: EdgeVerificationRouteEra; nextDrawNo: number };
    route4: {
        leagueAudit: EdgeVerificationLeagueAudit;
        ceilingProbe: EdgeVerificationCeilingProbe;
        nullShuffle: EdgeVerificationNullShuffle;
    };
    route2: EdgeVerificationRoute2;
    verdict: EdgeVerificationVerdict;
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
