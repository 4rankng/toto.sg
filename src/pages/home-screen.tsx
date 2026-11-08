import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Hash01, Lightning01 } from "@untitledui/icons";
import { Link } from "react-router";
import { Ball } from "@/components/balls";
import { Panel } from "@/components/panel";
import { type BoardWindow, HeatLegend, heatColour, LineSlip, NumberBoard } from "@/components/product/number-board";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { KpiCard } from "@/components/product/kpi-card";
import { TicketXRay } from "@/components/product/ticket-xray";
import { useCountdown } from "@/hooks/use-countdown";
import {
    type Analysis,
    type Draw,
    type LatestResult,
    type PrizeKey,
    type StrategiesFile,
    drawSum,
    formatDate,
    formatNumber,
    formatSgd,
    nextDrawDate,
    useJson,
    weekdayOf,
} from "@/lib/data";
import { extendPick, quickPick, randBelow } from "@/lib/quickpick";
import { analyzeTicket, computeBoardLenses, computeNextDrawRegime } from "@/lib/ticket-xray";
import { usePageTitle } from "@/pages/layout";
import { useLineBuilder } from "@/providers/line-builder-provider";

/** Prize groups listed under the winning numbers. */
const PRIZE_GROUPS: PrizeKey[] = ["g2", "g3", "g4", "g5", "g6", "g7"];

/** League rows shown on the home page. */
const LEAGUE_ROWS = 5;

/** Recent draws listed beside the countdown. */
const RECENT_DRAWS = 10;

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

    // On Netlify the function serves /api/latest; local dev has no function,
    // and the bundled head stands in.
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
    const recentDraws = useMemo(() => (draws ? draws.slice(-(RECENT_DRAWS + 1), -1).reverse() : []), [draws]);

    const regime = useMemo(() => (draws ? computeNextDrawRegime(draws, draws.at(-1) ?? null) : null), [draws]);

    const windows = useMemo<BoardWindow[]>(() => {
        if (!draws || !analysis) return [];
        return computeBoardLenses(draws, analysis, league ?? undefined);
    }, [draws, analysis, league]);

    const activeWindow = windows.find((window) => window.id === period) ?? windows[0];

    const ticketAnalysis = useMemo(
        () => (draws && line.length >= 6 ? analyzeTicket(line, draws, league ?? undefined) : null),
        [line, draws, league],
    );

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


    const handleApplyConsensus = () => {
        if (!league) return;
        const votes = new Uint16Array(50);
        for (const s of league.strategies) {
            for (const n of s.currentPick) votes[n] += 1;
        }
        const sortedBalls = Array.from({ length: 49 }, (_, i) => i + 1).sort((a, b) => votes[b] - votes[a]);
        setLine(sortedBalls.slice(0, size).sort((a, b) => a - b));
        setQuickPickName("Consensus Top-Picks");
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
    const additional = live?.additional ?? latest.additional;
    const drawNo = live?.drawNo ?? latest.draw;
    const date = live?.date ?? latest.date;
    const prizes = live?.prizes ?? latest.prizes;

    const hotBall = analysis?.hot.all[0];
    const longestGap = analysis?.overdue[0];
    const era = analysis?.coverage;
    const nextDrawNo = league?.meta.nextDraw ?? 0;
    const nextIso = nextDraw ? nextDraw.toISOString().slice(0, 10) : null;
    const winners = prizes?.g1?.winners ?? (prizes?.g1?.share ? 1 : null);

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="TOTO · 6/49"
                title="Latest draw"
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

            <div className="grid gap-3 lg:grid-cols-12">
                {/* The draw: result, prize table and the next-draw clock. */}
                <Panel emphasis="hero" className="lg:col-span-8" bodyClassName="flex flex-1 flex-col">
                    <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:gap-5 lg:flex-1">
                        <div className="min-w-0 lg:flex lg:flex-col">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-subtle uppercase">Group 1 prize</p>
                                    <p className="mt-0.5 font-display text-2xl leading-8 font-semibold tracking-tight text-gold-ink tabular-nums md:text-3xl md:leading-9">
                                        {prizes?.g1?.share ? formatSgd(prizes.g1.share) : "—"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    {live && (
                                        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-accent uppercase ring-1 ring-accent-line ring-inset">
                                            Live
                                        </span>
                                    )}
                                    <span className="text-[11px] text-ink-subtle">{winners != null ? `${winners} winner${winners === 1 ? "" : "s"}` : "—"}</span>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                                <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={`Winning numbers ${numbers.join(", ")}`}>
                                    {numbers.map((n, index) => (
                                        <span key={n} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                                            <Ball n={n} size="xl" />
                                        </span>
                                    ))}
                                </div>
                                <span aria-hidden="true" className="hidden h-9 w-px bg-line sm:block" />
                                {additional != null && (
                                    <span role="img" aria-label={`Additional number ${additional}`}>
                                        <Ball n={additional} size="xl" variant="ring" />
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-x-5 sm:grid-cols-2 lg:mt-auto lg:grid-cols-1">
                                {PRIZE_GROUPS.map((group) => {
                                    const prize = prizes?.[group];
                                    return (
                                        <div
                                            key={group}
                                            className="grid grid-cols-[1.5rem_auto_1fr] items-baseline gap-x-2 border-b border-line-soft py-2 last:border-0"
                                        >
                                            <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-subtle uppercase">
                                                {group.replace("g", "G")}
                                            </span>
                                            <span className="font-mono text-[11px] text-ink tabular-nums">{prize?.share ? formatSgd(prize.share) : "—"}</span>
                                            <span className="text-right font-mono text-[10px] text-ink-subtle tabular-nums">{prize?.winners ?? "—"} winners</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-w-0 border-t border-line/70 pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-5 lg:flex lg:flex-col">
                            <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-subtle uppercase">
                                Next draw{nextDrawNo ? ` · ${nextDrawNo}` : ""}
                            </p>
                            {nextDraw && !countdown.isPast ? (
                                <>
                                    <div className="mt-1">
                                        <Countdown
                                            days={countdown.days}
                                            hours={countdown.hours}
                                            minutes={countdown.minutes}
                                            seconds={countdown.seconds}
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] leading-4 text-ink-subtle">
                                        {nextIso ? `${formatDate(nextIso)} · ${weekdayOf(nextIso)}` : "—"} · 18:30 SGT
                                    </p>
                                </>
                            ) : (
                                <p className="mt-2 rounded-lg bg-surface-inset px-2.5 py-1.5 text-[11px] text-ink-muted">Waiting for the result.</p>
                            )}

                            <div className="mt-3 border-t border-line/70 pt-2 lg:mt-auto">
                                <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">Recent draws</p>
                                <ol className="mt-0.5">
                                    {recentDraws.map((draw) => (
                                        <li key={draw.draw}>
                                            <Link
                                                to="/history"
                                                className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 rounded py-0.5 text-[11px] transition-colors duration-100 hover:bg-surface-2/70"
                                            >
                                                <span className="font-mono text-ink-muted tabular-nums">{draw.draw}</span>
                                                <span className="truncate text-ink-subtle">{formatDate(draw.date)}</span>
                                                <span className="font-mono text-ink tabular-nums">{drawSum(draw.numbers)}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    </div>
                </Panel>

                {/* League */}
                <Panel
                    className="lg:col-span-4"
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
                                    <span className="shrink-0 font-mono text-xs font-semibold text-ink tabular-nums">{strategy.score.toFixed(1)}</span>
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
            </div>

            {/* Next-Draw Regime Briefing Strip */}
            {regime && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-xs backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                        <span className="font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-accent animate-pulse" />
                            Regime Briefing
                        </span>
                        <span className="text-text-subtle">·</span>
                        <span className="text-text font-medium">
                            {regime.rolloverLabel}
                        </span>
                        <span className="text-text-subtle">·</span>
                        <span className="text-text-muted">
                            {regime.nextWeekday} Skew: <strong className="text-text font-mono font-semibold">{regime.weekdayLeaders.map((l) => l.number).join(", ")}</strong>
                        </span>
                        <span className="text-text-subtle">·</span>
                        <span className="text-text-muted">
                            49-Ball Sweep: <strong className="text-primary font-mono">{regime.activeSweepCount}/49</strong> seen
                        </span>
                        <span className="text-text-subtle">·</span>
                        <span className="text-text-muted">
                            RSI-14 High: <strong className="text-heat-hot font-mono">Ball {regime.topRsiBall.number} ({regime.topRsiBall.rsi})</strong>
                        </span>
                    </div>
                    {regime.topMarkovFollower && (
                        <div className="text-[11px] font-mono text-secondary">
                            Markov Trigger: {regime.topMarkovFollower.fromBall} → {regime.topMarkovFollower.number} ({regime.topMarkovFollower.count}x)
                        </div>
                    )}
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
                <Panel
                    className="lg:col-span-4"
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
                    <NumberBoard windows={windows} period={period} onPeriodChange={setPeriod} latestNumbers={numbers} line={line} onToggle={handleToggle} />
                </Panel>

                <div className="flex flex-col gap-3 lg:col-span-8">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <KpiCard label="Draws" value={formatNumber(draws.length)} hint="Since 3 Jul 2008" icon={Hash01} tone="primary" />
                        <KpiCard
                            label="6/49 era"
                            value={formatNumber(era?.totalDraws ?? 0)}
                            hint={era?.firstDate ? `Since ${formatDate(era.firstDate)}` : undefined}
                            icon={Calendar}
                            tone="secondary"
                        />
                        <KpiCard
                            label="Most seen"
                            value={hotBall ? hotBall.number : "—"}
                            hint={hotBall ? `${formatNumber(hotBall.count)} times` : undefined}
                            icon={Lightning01}
                            tone="gold"
                        />
                        <KpiCard
                            label="Longest gap"
                            value={longestGap ? longestGap.number : "—"}
                            hint={longestGap ? `${formatNumber(longestGap.gap)} draws` : undefined}
                            icon={Clock}
                            tone="neutral"
                        />
                    </div>

                    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <div className="flex flex-col gap-3">
                            <Panel title="Play slip" description="Pick 6, 7 or 8 numbers. Tap the board to fill it.">
                                <LineSlip
                                    line={line}
                                    size={size}
                                    colourOf={(n) => (activeWindow ? heatColour(activeWindow, n) : "var(--color-surface-2)")}
                                    onSizeChange={handleSizeChange}
                                    onQuickPick={handleQuickPick}
                                    quickPickLabel={quickPickName}
                                />
                            </Panel>

                            {/* Live Ticket X-Ray Engine & 1,892-Draw Backtester */}
                            <TicketXRay balls={line} result={ticketAnalysis} onApplyConsensus={handleApplyConsensus} />
                        </div>

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
                    </div>

                    <Panel title="Longest gaps" description="Draws since each number last appeared." isFlush>
                        <div className="grid grid-cols-2 divide-x divide-line-soft">
                            {[
                                analysis?.overdue.slice(0, 6) ?? [],
                                analysis?.overdue.slice(6, 12) ?? [],
                            ].map((column, columnIndex) => (
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

                    <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                        Every number is equally likely in every draw. Every line has the same chance of Group 1, whatever the board or the history says.
                    </p>
                </div>
            </div>
        </div>
    );
};
