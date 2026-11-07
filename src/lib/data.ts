// toto.sg — client data layer: JSON artifact types + one-shot fetch hook.

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

export interface StrategyRow {
    id: string;
    name: string;
    description: string;
    evaluatedDraws: number;
    hitRate: number;
    prizeCounts: Record<PrizeKey, number>;
    totalPrizes: number;
    totalWinnings: number | null;
    drawsWithAmounts: number;
    currentPick: number[];
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const numberFmt = new Intl.NumberFormat("en-SG");

/** "2026-11-05" → "05 Nov 2026". */
export const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export const formatNumber = (n: number) => numberFmt.format(n);

export const formatSgd = (n: number) => `S$${numberFmt.format(n)}`;

export const formatPercent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

export interface UseJsonResult<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

/** Fetch a JSON artifact once per mount. No external data library. */
export function useJson<T>(url: string): UseJsonResult<T> {
    const [state, setState] = useState<UseJsonResult<T>>({ data: null, isLoading: true, error: null });

    useEffect(() => {
        const controller = new AbortController();
        setState({ data: null, isLoading: true, error: null });
        fetch(url, { signal: controller.signal })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return (await res.json()) as T;
            })
            .then((data) => setState({ data, isLoading: false, error: null }))
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setState({ data: null, isLoading: false, error: err instanceof Error ? err : new Error(String(err)) });
            });
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    return state;
}
