import { Fragment, useEffect, useMemo, useState } from "react";
import { Activity, BarChart01, Calendar, ChevronDown, ChevronRight, Hash01 } from "@untitledui/icons";
import { BallRow, Ball } from "@/components/balls";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Panel } from "@/components/panel";
import { KpiCard } from "@/components/product/kpi-card";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, RowsSkeleton } from "@/components/product/skeleton";
import { td, tdNum, th, thNum } from "@/components/product/table";
import {
    type Draw,
    type PrizeEventsFile,
    drawDecades,
    drawLowCount,
    drawMatchesQuery,
    drawOddCount,
    drawSum,
    formatDate,
    formatNumber,
    formatSgd,
    parseDrawQuery,
    useJson,
    weekdayOf,
} from "@/lib/data";
import { computeDrawAnatomy } from "@/lib/ticket-xray";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

/** Rows per page of the archive table. */
const PAGE_SIZE = 50;

/** Sentinel id for the "no year filter" option in the year select. */
const ALL_YEARS = "all";

/** Decade bands of a draw's detail row — the buckets `drawDecades` counts. */
const DECADE_LABELS = ["1–10", "11–20", "21–30", "31–40", "41–49"];

/** Regime filter chips for isolating historical draw conditions. */
const REGIME_OPTIONS = [
    { id: "all", label: "All draws" },
    { id: "rollover", label: "Rollover (Snowball)" },
    { id: "solo-g1", label: "Solo G1" },
    { id: "split-g1", label: "Split G1" },
    { id: "high-g3", label: "High G3 (≥S$2.2k)" },
    { id: "crowded-g3", label: "Crowded G3 (≤S$1.2k)" },
    { id: "run-3", label: "3+ Consecutive" },
] as const;

type RegimeFilter = (typeof REGIME_OPTIONS)[number]["id"];

const has3Run = (numbers: number[]) => {
    const sorted = [...numbers].sort((a, b) => a - b);
    for (let i = 2; i < sorted.length; i += 1) {
        if (sorted[i] === sorted[i - 1] + 1 && sorted[i - 1] === sorted[i - 2] + 1) return true;
    }
    return false;
};

const matchesRegime = (draw: Draw, regime: RegimeFilter) => {
    if (regime === "all") return true;
    const g1w = draw.prizes?.g1?.winners;
    const g3s = draw.prizes?.g3?.share;
    switch (regime) {
        case "rollover":
            return g1w === 0;
        case "solo-g1":
            return g1w === 1;
        case "split-g1":
            return typeof g1w === "number" && g1w > 1;
        case "high-g3":
            return typeof g3s === "number" && g3s >= 2200;
        case "crowded-g3":
            return typeof g3s === "number" && g3s > 0 && g3s <= 1200;
        case "run-3":
            return has3Run(draw.numbers);
        default:
            return true;
    }
};

/** One strategy's prize hit on a historical draw, from the league ledger. */
interface HistoryWinner {
    id: string;
    name: string;
    tier: number;
    pick: number[];
}

/** The expanded details of one draw: its cage structure, lag, and crowd forensics. */
const DrawDetail = ({
    draw,
    prevDraw,
    eraMeanG3,
    winners,
    gradedFrom,
}: {
    draw: Draw;
    prevDraw: Draw | null;
    eraMeanG3: number;
    /** Every league strategy that won a prize on this draw, tier then name. */
    winners: HistoryWinner[] | null;
    /** First draw the league grades — older draws have no ledger coverage. */
    gradedFrom: number | null;
}) => {
    const anatomy = useMemo(() => computeDrawAnatomy(draw, prevDraw, eraMeanG3), [draw, prevDraw, eraMeanG3]);
    const spread = drawDecades(draw.numbers);

    return (
        <div className="flex flex-col gap-3">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. Cage Structure */}
                <div className="rounded-lg border border-line-soft bg-surface-2/40 p-3">
                    <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">Cage Structure</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                            <dt className="text-[10px] text-ink-muted">Sum</dt>
                            <dd className="font-mono text-xs font-semibold text-ink tabular-nums">{anatomy.sum}</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">AC Value</dt>
                            <dd className="font-mono text-xs font-semibold text-primary tabular-nums">{anatomy.acValue} / 10</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">Span</dt>
                            <dd className="font-mono text-xs font-semibold text-ink tabular-nums">{anatomy.span}</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">Odd / Even</dt>
                            <dd className="font-mono text-xs text-ink tabular-nums">{anatomy.oddCount} / {draw.numbers.length - anatomy.oddCount}</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">Digital Root</dt>
                            <dd className="font-mono text-xs font-semibold text-accent-strong tabular-nums">{anatomy.digitalRoot}</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">Distinct Tails</dt>
                            <dd className="font-mono text-xs text-ink tabular-nums">{anatomy.distinctTails} / 6</dd>
                        </div>
                    </dl>
                </div>

                {/* 2. Lag & Carry-over */}
                <div className="rounded-lg border border-line-soft bg-surface-2/40 p-3">
                    <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">Lag & Carry-over</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                            <dt className="text-[10px] text-ink-muted">Repeats from Prev</dt>
                            <dd className="font-mono text-xs font-semibold text-ink tabular-nums">{anatomy.repeatsFromPrev} balls</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">7th-Ball Promotion</dt>
                            <dd className={cx("font-mono text-xs font-semibold tabular-nums", anatomy.additionalPromoted ? "text-heat-hot" : "text-ink-muted")}>
                                {anatomy.additionalPromoted ? "Yes (Bonus promoted)" : "None"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">Neighbor Hits (±1)</dt>
                            <dd className="font-mono text-xs text-ink tabular-nums">{anatomy.neighborHits} balls</dd>
                        </div>
                        <div>
                            <dt className="text-[10px] text-ink-muted">Consecutive</dt>
                            <dd className="font-mono text-xs text-ink tabular-nums">
                                {anatomy.consecutivePairs > 0 ? `${anatomy.consecutivePairs} pair(s)` : "None"}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* 3. Calendar Bias */}
                <div className="rounded-lg border border-line-soft bg-surface-2/40 p-3 sm:col-span-2 lg:col-span-1">
                    <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">Calendar Bias</p>
                    <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-2 text-xs">
                        <div>
                            <dt className="text-[10px] text-ink-muted">Balls within day-of-month range (≤31)</dt>
                            <dd className="font-mono text-xs font-semibold text-ink tabular-nums">{anatomy.birthdayCount} / 6 balls</dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Bottom Bar: Decades */}
            <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-2">
                <div className="flex items-center gap-1 overflow-x-auto">
                    <span className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase mr-1">Decades:</span>
                    {DECADE_LABELS.map((label, index) => {
                        const count = spread[index];
                        const empty = count === 0;
                        return (
                            <div
                                key={label}
                                className={cx("rounded border px-1.5 py-0.5 text-center text-[10px]", empty ? "border-line-soft text-ink-faint" : "border-line bg-surface-3 text-ink")}
                            >
                                <span className="text-ink-subtle mr-1">{label}:</span>
                                <span className="font-mono font-semibold tabular-nums">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* League winners: every strategy that hit a prize on this draw,
                tier chip first, then the exact hitting line with the matched
                balls accent-ringed. Draws before the graded window carry one
                hint line instead. */}
            {winners && winners.length > 0 && (
                <div className="rounded-lg border border-line-soft bg-surface-2/40 p-3">
                    <p className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">
                        League winners · {winners.length} prize {winners.length === 1 ? "draw" : "draws"}
                    </p>
                    <ol className="mt-1.5 flex flex-col divide-y divide-line-soft/60">
                        {winners.map((winner) => {
                            const matched = winner.pick.filter((n) => draw.numbers.includes(n));
                            return (
                                <li key={`${winner.id}-${winner.tier}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 first:pt-0 last:pb-0">
                                    <span
                                        className={cx("w-6 shrink-0 font-mono text-[10px] font-semibold tabular-nums", winner.tier === 1 ? "text-gold" : "text-ink-subtle")}
                                        title={`Group ${winner.tier} prize draw`}
                                    >
                                        G{winner.tier}
                                    </span>
                                    <span className="min-w-0 max-w-52 truncate text-xs font-medium text-ink" title={winner.name}>
                                        {winner.name}
                                    </span>
                                    <span
                                        className="flex items-center gap-1"
                                        role="img"
                                        aria-label={`Winning line ${winner.pick.join(", ")}; matched ${matched.length === 0 ? "none" : matched.join(", ")}`}
                                    >
                                        <span aria-hidden="true" className="contents">
                                            {winner.pick.map((n) => (
                                                <Ball key={n} n={n} size="xs" className={matched.includes(n) ? "ring-2 ring-accent" : "opacity-40"} />
                                            ))}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
            {(!winners || winners.length === 0) && gradedFrom != null && draw.draw < gradedFrom && (
                <p className="text-[11px] text-ink-subtle">No league grading this far back — walk-forward folds start at draw {gradedFrom}.</p>
            )}
        </div>
    );
};

const ArchiveSkeleton = () => (
    <DataLoading label="Loading draws">
        <PageHeaderSkeleton />
        <RowsSkeleton count={10} />
    </DataLoading>
);

export const HistoryScreen = ({ embedded = false }: { embedded?: boolean } = {}) => {
    // Embedded at the foot of the home page, the home page keeps its title.
    usePageTitle(embedded ? "Singapore TOTO latest draw" : "Draw history — every TOTO draw");


    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
    const { data: prizeEvents } = useJson<PrizeEventsFile>("/data/prize-events.json");
    const [search, setSearch] = useState("");
    const [year, setYear] = useState<string>(ALL_YEARS);
    const [regime, setRegime] = useState<RegimeFilter>("all");
    const [page, setPage] = useState(1);
    const [expanded, setExpanded] = useState<number | null>(null);

    /** Every draw, newest first. */
    const newestFirst = useMemo(() => [...(draws ?? [])].sort((a, b) => b.draw - a.draw), [draws]);

    const drawMap = useMemo(() => new Map((draws ?? []).map((d) => [d.draw, d])), [draws]);

    // The league ledger inverted: prize events grouped by draw, each sorted
    // tier first then name. The ledger covers every graded rule, including
    // the rows the below-chance trim keeps out of the league table.
    const winnersByDraw = useMemo(() => {
        if (!prizeEvents) return null;
        const byDraw = new Map<number, HistoryWinner[]>();
        for (const [id, events] of Object.entries(prizeEvents.strategies)) {
            const name = prizeEvents.meta.directory[id]?.name ?? id;
            for (const event of events) {
                const list = byDraw.get(event.d);
                const winner = { id, name, tier: event.g, pick: event.p };
                if (list) list.push(winner);
                else byDraw.set(event.d, [winner]);
            }
        }
        for (const list of byDraw.values()) list.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
        return byDraw;
    }, [prizeEvents]);
    const gradedFrom = prizeEvents ? prizeEvents.meta.nextDraw - prizeEvents.meta.folds : null;

    const eraMeanG3 = useMemo(() => {
        if (!draws) return 1750;
        let sum = 0;
        let count = 0;
        for (const d of draws) {
            const g3 = d.prizes?.g3?.share;
            if (g3 && g3 > 0) {
                sum += g3;
                count += 1;
            }
        }
        return count > 0 ? Math.round(sum / count) : 1750;
    }, [draws]);


    const yearOptions = useMemo(() => {
        const seen: Record<string, true> = {};
        for (const draw of newestFirst) seen[draw.date.slice(0, 4)] = true;

        const years = Object.keys(seen).sort((a, b) => b.localeCompare(a));
        return [{ id: ALL_YEARS, label: "All years" }, ...years.map((y) => ({ id: y, label: y }))];
    }, [newestFirst]);

    const query = useMemo(() => parseDrawQuery(search), [search]);

    const filtered = useMemo(
        () =>
            newestFirst.filter(
                (draw) =>
                    (year === ALL_YEARS || draw.date.startsWith(year)) &&
                    matchesRegime(draw, regime) &&
                    drawMatchesQuery(draw, query),
            ),
        [newestFirst, query, regime, year],
    );

    const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
    const safePage = Math.min(Math.max(page, 1), pageCount);
    const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // The result set can shrink under the current page — fall back to the last
    // page that still holds rows.
    useEffect(() => {
        if (page !== safePage) setPage(safePage);
    }, [page, safePage]);

    /** Human summary of the filters in force, e.g. "Rollover · contains 7, 23 · 2024". */
    const filterSummary = useMemo(() => {
        const parts: string[] = [];
        if (regime !== "all") {
            const label = REGIME_OPTIONS.find((r) => r.id === regime)?.label;
            if (label) parts.push(label);
        }
        if (query.numbers.length > 0) parts.push(`contains ${query.numbers.join(", ")}`);
        if (query.draw !== null) parts.push(`draw ${query.draw}`);
        if (query.date !== null) parts.push(query.date);
        if (year !== ALL_YEARS) parts.push(year);
        return parts;
    }, [query, regime, year]);

    const hasFilter = search.trim().length > 0 || year !== ALL_YEARS || regime !== "all";

    const applySearch = (value: string) => {
        setSearch(value);
        setPage(1);
        setExpanded(null);
    };

    const applyYear = (value: string) => {
        setYear(value);
        setPage(1);
        setExpanded(null);
    };

    const clearFilters = () => {
        setSearch("");
        setYear(ALL_YEARS);
        setRegime("all");
        setPage(1);
        setExpanded(null);
    };

    if (isLoading) return <ArchiveSkeleton />;

    if (error || !draws) {
        return (
            <Panel title="Draw archive unavailable" description={error?.message ?? "The draw file is missing."}>
                <p className="text-sm text-ink-muted">Run `npm run refresh`, then reload.</p>
            </Panel>
        );
    }

    const oldest = newestFirst[newestFirst.length - 1];
    const newest = newestFirst[0];

    const firstRow = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const lastRow = Math.min(safePage * PAGE_SIZE, filtered.length);

    const panelDescription =
        filterSummary.length > 0 ? `${formatNumber(filtered.length)} matches · ${filterSummary.join(" · ")}` : `${formatNumber(draws.length)} draws · newest first`;

    const filters = (
        <div className="scrollbar-hide flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto sm:w-auto">
            <Input
                value={search}
                onChange={applySearch}
                placeholder="Search: 7 and 23, or 4232"
                size="sm"
                className="min-w-36 flex-1 sm:w-60 sm:flex-none"
                aria-label="Search draws"
            />
            <Select
                items={yearOptions}
                selectedKey={year}
                onSelectionChange={(key) => applyYear(key === null ? ALL_YEARS : String(key))}
                placeholder="All years"
                size="sm"
                className="w-28 shrink-0"
                aria-label="Filter by year"
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
            {hasFilter && (
                <Button color="secondary" size="sm" onPress={clearFilters} className="shrink-0">
                    Clear
                </Button>
            )}
        </div>
    );

    const pagination = (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="font-mono text-[11px] text-ink-subtle tabular-nums">
                {firstRow}–{lastRow} of {formatNumber(filtered.length)} · page {safePage}/{pageCount}
            </p>
            <div role="group" aria-label="Archive pages" className="flex items-center gap-1">
                <Button color="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(1)} className="max-md:h-11">
                    First
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage <= 1} onPress={() => setPage(safePage - 1)} className="max-md:h-11">
                    Prev
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage >= pageCount} onPress={() => setPage(safePage + 1)} className="max-md:h-11">
                    Next
                </Button>
                <Button color="secondary" size="sm" isDisabled={safePage >= pageCount} onPress={() => setPage(pageCount)} className="max-md:h-11">
                    Last
                </Button>
            </div>
        </div>
    );

    const toggle = (drawNo: number) => setExpanded((current) => (current === drawNo ? null : drawNo));

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="Archive"
                title="Draw history"
                meta={
                    <>
                        <span>
                            <span className="font-mono text-ink-muted tabular-nums">{formatNumber(draws.length)}</span> draws
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                            {oldest ? formatDate(oldest.date) : "—"} → {newest ? formatDate(newest.date) : "—"}
                        </span>
                    </>
                }
                actions={
                    <span className="text-[11px] text-ink-subtle">Tap a row for forensics and league winners</span>
                }
            />

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <KpiCard label="Draws" value={formatNumber(draws.length)} hint="2008 → now" icon={Hash01} tone="primary" />
                <KpiCard
                    label="Span"
                    value={`${Number(newest.date.slice(0, 4)) - Number(oldest.date.slice(0, 4))} yrs`}
                    hint={oldest ? formatDate(oldest.date) : undefined}
                    icon={Calendar}
                    tone="secondary"
                />
                <KpiCard label="Latest draw" value={newest.draw} hint={formatDate(newest.date)} icon={Activity} tone="neutral" />
                <KpiCard label="Latest sum" value={drawSum(newest.numbers)} hint="six numbers" icon={BarChart01} tone="gold" />
            </div>

            <Panel isFlush title="All draws" description={panelDescription} actions={filters} footer={filtered.length > 0 ? pagination : undefined}>
                {/* Regime Filter Chips */}
                <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto border-b border-line-soft bg-surface-2/30 px-3 py-2">
                    <span className="shrink-0 text-[10px] font-semibold tracking-wider text-ink-subtle uppercase mr-1">Regime:</span>
                    {REGIME_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                                setRegime(opt.id);
                                setPage(1);
                                setExpanded(null);
                            }}
                            className={cx(
                                "rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                                regime === opt.id
                                    ? "bg-accent text-canvas font-semibold shadow-xs"
                                    : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink",
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {rows.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
                        <p className="text-sm text-ink-muted">No draw matches that search.</p>
                        <Button color="secondary" size="sm" onPress={clearFilters}>
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Phone: one card per draw. */}
                        <div className="md:hidden">
                            {rows.map((draw) => {
                                const isOpen = expanded === draw.draw;
                                const odd = drawOddCount(draw.numbers);
                                const low = drawLowCount(draw.numbers);
                                const drawWinners = winnersByDraw?.get(draw.draw) ?? null;

                                return (
                                    <article key={draw.draw} className={cx("border-b border-line-soft last:border-0", isOpen && "bg-surface-2/50")}>
                                        <button
                                            type="button"
                                            aria-expanded={isOpen}
                                            onClick={() => toggle(draw.draw)}
                                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                                        >
                                            <div className="min-w-0">
                                                <p className="flex items-baseline gap-2">
                                                    <span className="font-mono text-sm font-semibold text-ink tabular-nums">{draw.draw}</span>
                                                    <span className="truncate text-xs text-ink-subtle">
                                                        {formatDate(draw.date)} · {weekdayOf(draw.date)}
                                                    </span>
                                                </p>
                                                <div className="mt-1.5">
                                                    <BallRow numbers={draw.numbers} additional={draw.additional} size="sm" />
                                                </div>
                                                <p className="mt-1.5 font-mono text-[11px] text-ink-subtle tabular-nums">
                                                    sum {drawSum(draw.numbers)} · odd {odd} · ≤ 24: {low}
                                                    {drawWinners != null && ` · ${drawWinners.length} league won`}
                                                </p>
                                            </div>
                                            {isOpen ? (
                                                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
                                            ) : (
                                                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
                                            )}
                                        </button>
                                        {isOpen && (
                                            <div className="border-t border-line-soft bg-surface-2/40 px-3 py-3">
                                                <DrawDetail
                                                    draw={draw}
                                                    prevDraw={drawMap.get(draw.draw - 1) ?? null}
                                                    eraMeanG3={eraMeanG3}
                                                    winners={drawWinners}
                                                    gradedFrom={gradedFrom}
                                                />
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>

                        {/* Tablet and up: the dense table. */}
                        <div className="hidden min-w-0 md:block">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr>
                                        <th className={cx(th, "w-20 pl-3")}>Draw</th>
                                        <th className={th}>Date</th>
                                        <th className={cx(th, "hidden lg:table-cell")}>Day</th>
                                        <th className={th}>Numbers</th>
                                        <th className={thNum}>Sum</th>
                                        <th className={thNum}>Odd</th>
                                        <th className={thNum}>≤ 24</th>
                                        <th className={cx(thNum, "hidden lg:table-cell")} title="League strategies that won a prize on this draw">Won</th>
                                        <th className={cx(th, "w-10 pr-3 text-right last:rounded-tr-xl")}>
                                            <span className="sr-only">Detail</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((draw) => {
                                        const isOpen = expanded === draw.draw;
                                        const detailId = `draw-detail-${draw.draw}`;
                                        const drawWinners = winnersByDraw?.get(draw.draw) ?? null;

                                        return (
                                            <Fragment key={draw.draw}>
                                                <tr
                                                    onClick={() => toggle(draw.draw)}
                                                    className={cx(
                                                        "cursor-pointer border-b border-line-soft bg-surface transition-colors duration-100 hover:bg-surface-2/60",
                                                        isOpen && "bg-surface-2/60",
                                                    )}
                                                >
                                                    <td className={cx(td, "pl-3")}>
                                                        <button
                                                            type="button"
                                                            aria-expanded={isOpen}
                                                            aria-controls={isOpen ? detailId : undefined}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                toggle(draw.draw);
                                                            }}
                                                            className="rounded font-mono text-[13px] font-semibold text-ink tabular-nums transition-colors duration-100 hover:text-accent-strong"
                                                        >
                                                            {draw.draw}
                                                        </button>
                                                    </td>
                                                    <td className={td}>{formatDate(draw.date)}</td>
                                                    <td className={cx(td, "hidden text-ink-subtle lg:table-cell")}>{weekdayOf(draw.date)}</td>
                                                    <td className={td}>
                                                        <BallRow numbers={draw.numbers} additional={draw.additional} size="sm" />
                                                    </td>
                                                    <td className={tdNum}>{drawSum(draw.numbers)}</td>
                                                    <td className={tdNum}>{drawOddCount(draw.numbers)}</td>
                                                    <td className={tdNum}>{drawLowCount(draw.numbers)}</td>
                                                    <td className={cx(tdNum, "hidden text-ink-subtle lg:table-cell")} title={drawWinners != null ? `${drawWinners.length} league strategies won a prize` : undefined}>
                                                        {drawWinners?.length ?? "—"}
                                                    </td>
                                                    <td className={cx(td, "pr-3 text-right")}>
                                                        <span
                                                            aria-hidden="true"
                                                            className="inline-grid size-7 place-items-center rounded-md text-ink-subtle"
                                                        >
                                                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr id={detailId} className="border-b border-line-soft bg-surface-2/40">
                                                        <td colSpan={9} className="px-3 py-3">
                                                            <DrawDetail
                                                                draw={draw}
                                                                prevDraw={drawMap.get(draw.draw - 1) ?? null}
                                                                eraMeanG3={eraMeanG3}
                                                                winners={drawWinners}
                                                                gradedFrom={gradedFrom}
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Panel>
        </div>
    );
};
