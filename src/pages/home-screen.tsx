import { useEffect, useMemo, useState } from "react";
import { Ball } from "@/components/balls";
import { Link } from "react-router";
import { Panel } from "@/components/panel";
import { type BoardWindow, HeatLegend, heatColour, heatRingColour, LineSlip, NumberBoard } from "@/components/product/number-board";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { HistoryScreen } from "@/pages/history-screen";
import { useCountdown } from "@/hooks/use-countdown";
import {
    type Analysis,
    type Draw,
    type LatestResult,
    type StrategiesFile,
    formatDate,
    formatNumber,
    nextDrawDate,
    useJson,
    weekdayOf,
} from "@/lib/data";
import { extendPick, quickPick, randBelow } from "@/lib/quickpick";
import { computeBoardLenses } from "@/lib/ticket-xray";
import { usePageTitle } from "@/pages/layout";
import { useLineBuilder } from "@/providers/line-builder-provider";

/** League rows shown on the home page. */
const LEAGUE_ROWS = 5;

/** The countdown reads as one clock line: 02:01:20:41. */
const Countdown = ({ days, hours, minutes, seconds }: { days: number; hours: number; minutes: number; seconds: number }) => {
    const units = [
        { value: days, label: "days" },
        { value: hours, label: "hrs" },
        { value: minutes, label: "min" },
        { value: seconds, label: "sec" },
    ];

    return (
        <div
            role="timer"
            aria-label={`${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds to the next draw`}
            className="flex items-start justify-center gap-0.5 tabular-nums"
        >
            {units.map((unit, index) => (
                <div key={unit.label} className="flex items-start">
                    <div className="flex flex-col items-center">
                        <span className="font-display text-2xl leading-8 font-semibold tracking-tight text-ink md:text-3xl md:leading-9">
                            {String(unit.value).padStart(2, "0")}
                        </span>
                        <span className="text-[9px] font-semibold tracking-[0.12em] text-ink-subtle uppercase">{unit.label}</span>
                    </div>
                    {index < units.length - 1 && (
                        <span aria-hidden="true" className="px-1 font-display text-xl leading-8 font-medium text-ink-faint md:text-2xl md:leading-9">
                            :
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

const HomeSkeleton = () => (
    <DataLoading label="Loading draw data">
        <PageHeaderSkeleton />
        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-12">
            <Skeleton className="h-80 rounded-xl md:col-span-2 lg:col-span-5" />
            <Skeleton className="h-80 rounded-xl lg:col-span-4" />
            <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        </div>
        <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-12">
            <Skeleton className="h-96 rounded-xl lg:col-span-4" />
            <Skeleton className="h-96 rounded-xl lg:col-span-8" />
        </div>
    </DataLoading>
);

export const HomeScreen = () => {
    usePageTitle("Singapore TOTO latest draw");

    const { data: draws, isLoading, error } = useJson<Draw[]>("/data/draws.json");
    const { data: analysis } = useJson<Analysis>("/data/analysis.json");
    const { data: league } = useJson<StrategiesFile>("/data/strategies.json");
    const [live, setLive] = useState<LatestResult | null>(null);
    const { line, size, setSize, toggle, setLine } = useLineBuilder();
    const [period, setPeriod] = useState("all");
    const [quickPickName, setQuickPickName] = useState<string | null>(null);

    // /api/latest is served by server.mjs in the deployed container; local
    // dev has no route, and the bundled head stands in.
    useEffect(() => {
        let cancelled = false;
        fetch("/api/latest")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: LatestResult | null) => {
                if (!cancelled && data?.drawNo) setLive(data);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const latest = useMemo(() => draws?.at(-1) ?? null, [draws]);
    const lastDrawDate = live?.date ?? latest?.date ?? null;

    const nextDraw = useMemo(() => (lastDrawDate ? nextDrawDate(lastDrawDate) : null), [lastDrawDate]);
    const countdown = useCountdown(nextDraw);

    const topStrategies = useMemo(() => (league ? [...league.strategies].sort((a, b) => a.rank - b.rank).slice(0, LEAGUE_ROWS) : []), [league]);

    const windows = useMemo<BoardWindow[]>(() => {
        if (!draws || !analysis) return [];
        return computeBoardLenses(draws, analysis, league ?? undefined);
    }, [draws, analysis, league]);

    const activeWindow = windows.find((window) => window.id === period) ?? windows[0];

    /** Quick pick is one of the strategies — a random one, every tap. */
    const handleQuickPick = () => {
        if (league && league.strategies.length > 0) {
            const strategy = league.strategies[randBelow(league.strategies.length)];
            setLine(extendPick(strategy.currentPick, size));
            setQuickPickName(strategy.name);
            return;
        }
        setLine(quickPick(size));
        setQuickPickName(null);
    };


    const handleSizeChange = (next: typeof size) => {
        setQuickPickName(null);
        setSize(next);
    };

    const handleToggle = (n: number) => {
        setQuickPickName(null);
        toggle(n);
    };

    if (isLoading) return <HomeSkeleton />;

    if (error || !draws || !latest) {
        return (
            <Panel title="Draw archive unavailable" description={error?.message ?? "The draw file is missing."}>
                <p className="text-sm text-ink-muted">Run `npm run refresh`, then reload.</p>
            </Panel>
        );
    }

    const numbers = live?.numbers ?? latest.numbers;
    const drawNo = live?.drawNo ?? latest.draw;
    const date = live?.date ?? latest.date;

    const nextDrawNo = league?.meta.nextDraw ?? 0;
    const nextIso = nextDraw ? nextDraw.toISOString().slice(0, 10) : null;

    /** Shown under the board on tablets and at the foot of the main column
     *  on desktop; rendering the same node twice keeps the reading order
     *  sensible without duplicating the list markup by hand. */
    const longestGapsPanel = (
        <Panel title="Longest gaps" description="Draws since each number last appeared." isFlush>
            <div className="grid grid-cols-2 divide-x divide-line-soft">
                {[analysis?.overdue.slice(0, 6) ?? [], analysis?.overdue.slice(6, 12) ?? []].map((column, columnIndex) => (
                    <ol key={columnIndex} className="px-4 py-1.5">
                        {column.map((entry) => (
                            <li key={entry.number} className="flex items-center justify-between gap-2 py-0.5">
                                <Ball n={entry.number} size="xs" />
                                <span className="font-mono text-[11px] text-ink tabular-nums">{formatNumber(entry.gap)}</span>
                            </li>
                        ))}
                    </ol>
                ))}
            </div>
        </Panel>
    );

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="TOTO · 6/49"
                meta={
                    <>
                        <span>
                            Draw <span className="font-mono text-ink-muted tabular-nums">{drawNo}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(date)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{weekdayOf(date)}</span>
                    </>
                }
                actions={
                    <Link to="/history" className="text-xs font-semibold text-accent transition-colors duration-100 hover:text-accent-strong">
                        All {formatNumber(draws.length)} draws →
                    </Link>
                }
            />

            {/* Slim next-draw clock first — the draw result itself lives in /history. */}
            {nextDraw && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-2.5">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-subtle uppercase">
                        Next draw{nextDrawNo ? ` · ${nextDrawNo}` : ""}
                        {nextIso ? ` · ${formatDate(nextIso)} · ${weekdayOf(nextIso)} · 18:30 SGT` : ""}
                    </p>
                    {countdown.isPast ? (
                        <p className="text-[11px] text-ink-muted">Waiting for the result.</p>
                    ) : (
                        <Countdown days={countdown.days} hours={countdown.hours} minutes={countdown.minutes} seconds={countdown.seconds} />
                    )}
                </div>
            )}

            {/* The play slip is the page's primary action. */}
            <Panel className="mx-auto w-full max-w-3xl">
                <LineSlip
                    line={line}
                    size={size}
                    colourOf={(n) => heatColour(activeWindow, n)}
                    ringOf={(n) => heatRingColour(activeWindow, n)}
                    onSizeChange={handleSizeChange}
                    onQuickPick={handleQuickPick}
                    quickPickLabel={quickPickName}
                />
            </Panel>

            {/*
                The columns end at their natural heights. Stretching a card to
                the taller column only opens a hollow well below its content,
                so the grid is `items-start` and the columns may end unevenly;
                on tablets the gap list moves under the board to keep those
                ends within a few dozen pixels of each other.
            */}
            {/*
                The headline counts join the section grid so they can sit next
                to the board on tablets and return to a full-width strip on
                desktop. That keeps both columns flush at md without leaving a
                bare canvas well under the shorter column.
            */}
            <div className="grid items-start gap-3 md:grid-cols-2 md:items-stretch lg:grid-cols-12">
                <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:col-span-4">
                    <Panel
                        title="Number board"
                        description="How often each number appeared across 7 indicator lenses. Colour shows deviation."
                        footer={
                            <div className="flex flex-col gap-2">
                                <HeatLegend />
                                <p className="text-[11px] leading-4 text-ink-subtle">
                                    Dot = a number in the latest draw. Left dot marks below expectation, pink dot above. Counts describe the past; they do
                                    not alter cage randomness.
                                </p>
                            </div>
                        }
                    >
                        <NumberBoard
                            windows={windows}
                            period={period}
                            onPeriodChange={setPeriod}
                            latestNumbers={numbers}
                            line={line}
                            onToggle={handleToggle}
                        />
                    </Panel>
                </div>

                <div className="flex min-w-0 flex-col gap-3 lg:col-span-8 lg:col-start-5">
                    <Panel title="Most and least seen" description="Counts across the 6/49 era." isFlush>
                            <div className="grid grid-cols-2 divide-x divide-line-soft">
                                {[
                                    { label: "Most", rows: analysis?.hot.all.slice(0, 8) ?? [] },
                                    { label: "Least", rows: analysis?.cold.all.slice(0, 8) ?? [] },
                                ].map((column) => (
                                    <div key={column.label} className="px-4 py-2">
                                        <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">{column.label}</p>
                                        <ol className="mt-1">
                                            {column.rows.map((entry) => (
                                                <li key={entry.number} className="flex items-center justify-between gap-2 py-0.5">
                                                    <Ball n={entry.number} size="xs" />
                                                    <span className="font-mono text-[11px] text-ink tabular-nums">{formatNumber(entry.count)}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ))}
                            </div>
                    </Panel>

                    {longestGapsPanel}
                </div>
            </div>

            {/* League */}
            <Panel
                title="Top strategies"
                description={`Best ${LEAGUE_ROWS} of ${league?.strategies.length ?? 0} on ${league?.meta.folds ?? 0} draws · chance scores ${Math.round(((league?.meta.folds ?? 0) * (league?.meta.chance.weightedPrizesPer100Draws ?? 0)) / 100)}.`}
                actions={
                    <Link to="/strategies" className="text-xs font-semibold text-accent transition-colors duration-100 hover:text-accent-strong">
                        All →
                    </Link>
                }
                isFlush
            >
                <ol className="divide-y divide-line-soft">
                    {topStrategies.map((strategy) => (
                        <li key={strategy.id} className="px-4 py-1">
                            <div className="flex items-baseline gap-2">
                                <span className="w-4 shrink-0 font-mono text-[11px] text-ink-subtle tabular-nums">{strategy.rank}</span>
                                <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-ink">{strategy.name}</span>
                                <span className="shrink-0 font-mono text-xs font-semibold text-ink tabular-nums" title={`Score 1–100, log-scaled from ${formatNumber(strategy.score)} raw prize points`}>{strategy.score100 ?? 1}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1 pl-6" aria-hidden="true">
                                {strategy.currentPick.map((n) => (
                                    <Ball key={n} n={n} size="sm" />
                                ))}
                            </div>
                        </li>
                    ))}
                </ol>
            </Panel>

            {/* The full draw archive — all the history content, at the foot. */}
            <HistoryScreen embedded />
        </div>
    );
};
