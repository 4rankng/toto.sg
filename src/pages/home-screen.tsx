import { useEffect, useMemo, useState } from "react";
import { Ball } from "@/components/balls";
import { Link } from "react-router";
import { Panel } from "@/components/panel";
import { type BoardWindow, heatColour, heatRingColour, LineSlip, NumberBoard } from "@/components/product/number-board";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { HistoryScreen } from "@/pages/history-screen";
import { useCountdown } from "@/hooks/use-countdown";
import {
    type Analysis,
    type Draw,
    type LatestResult,
    type PrizeEventsFile,
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
import { cx } from "@/utils/cx";

/** League rows shown on the home page. */
const LEAGUE_ROWS = 5;

/** The countdown reads as one instrument: four inset digit tiles with a
 *  blinking colon between them — 02:01:20:41. */
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
            className="flex items-stretch justify-center gap-1 tabular-nums"
        >
            {units.map((unit, index) => (
                <div key={unit.label} className="flex items-stretch">
                    <div className="flex min-w-[3rem] flex-col items-center rounded-lg bg-surface-inset px-2 py-1.5 ring-1 ring-line ring-inset md:min-w-[3.4rem]">
                        <span className="font-display text-2xl leading-7 font-semibold tracking-tight text-ink md:text-3xl md:leading-8">
                            {String(unit.value).padStart(2, "0")}
                        </span>
                        <span className="mt-0.5 text-[9px] font-semibold tracking-[0.16em] text-ink-faint uppercase">{unit.label}</span>
                    </div>
                    {index < units.length - 1 && (
                        <span aria-hidden="true" className="animate-tick self-center px-0.5 font-display text-xl leading-none font-medium text-ink-faint md:text-2xl">
                            :
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

/** Fraction of the current draw window elapsed — one thin accent bar. Draws
 *  run Mon/Thu 18:30 SGT: a Monday target closes the 4-day Thu→Mon window,
 *  a Thursday target the 3-day Mon→Thu one. Renders nothing when the maths
 *  is not trustworthy. */
const WindowGauge = ({ nextDraw, remainingMs }: { nextDraw: Date | null; remainingMs: number }) => {
    const windowMs = useMemo(() => (nextDraw ? (nextDraw.getDay() === 1 ? 4 : 3) * 24 * 3600 * 1000 : null), [nextDraw]);
    if (!windowMs || remainingMs < 0 || remainingMs >= windowMs) return null;
    const pct = Math.min(100, Math.max(0, Math.round((1 - remainingMs / windowMs) * 100)));

    return (
        <div className="flex items-center gap-2" aria-hidden="true">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-inset ring-1 ring-line ring-inset">
                <div className="h-full rounded-full bg-accent shadow-[0_0_10px_0_var(--color-accent)]" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 font-mono text-[9px] font-semibold tracking-[0.12em] text-ink-faint tabular-nums">{pct}%</span>
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
    const { data: prizeEvents } = useJson<PrizeEventsFile>("/data/prize-events.json");
    const [live, setLive] = useState<LatestResult | null>(null);
    const { line, size, setSize, toggle, setLine } = useLineBuilder();
    const [period, setPeriod] = useState("all");
    const [quickPickName, setQuickPickName] = useState<string | null>(null);
    /** The winners panel lists 8 prize draws by default; 21+ rows stretch the column under the board. */
    const [allWinners, setAllWinners] = useState(false);

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

    // The strategies that won a prize on the newest draw the league has
    // graded — the ledger covers every graded rule, including the ones the
    // below-chance cleanup trimmed from the league table.
    const latestWinners = useMemo(() => {
        if (!prizeEvents || !draws) return null;
        const gradedDrawNo = prizeEvents.meta.nextDraw - 1;
        const graded = draws.find((d) => d.draw === gradedDrawNo);
        if (!graded) return null;
        const matched = new Set(graded.numbers);
        const rows = Object.entries(prizeEvents.strategies).flatMap(([id, events]) =>
            events
                .filter((event) => event.d === gradedDrawNo)
                .map((event) => ({
                    id,
                    name: prizeEvents.meta.directory[id]?.name ?? id,
                    kept: prizeEvents.meta.directory[id]?.kept ?? true,
                    tier: event.g,
                    pick: event.p,
                    matched: event.p.filter((n) => matched.has(n)),
                })),
        );
        return { graded, rows: rows.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)) };
    }, [prizeEvents, draws]);

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
            <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2">
                {(analysis?.overdue.slice(0, 12) ?? []).map((entry) => (
                    <li key={entry.number} className="inline-flex" title={`${entry.number}: last drawn ${entry.gap} draws ago`}>
                        <Ball n={entry.number} size="xs" />
                    </li>
                ))}
            </ol>
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
                    <Link to="/history" className="text-xs font-semibold text-accent-strong transition-colors duration-100 hover:text-ink">
                        All {formatNumber(draws.length)} draws →
                    </Link>
                }
            />

            {/* Slim next-draw clock beside the slip on wide screens — the
                draw result itself lives in /history. */}
            <div className={`grid items-stretch gap-3${nextDraw ? " lg:grid-cols-[minmax(280px,360px)_1fr]" : ""}`}>
                {nextDraw && (
                    <div className="hud-corners panel-glow relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-line bg-surface/70 px-4 py-3 lg:flex-col lg:items-stretch lg:justify-center lg:gap-y-3">
                        <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="animate-beacon size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_0_var(--color-accent)]" />
                            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
                                Next draw{nextDrawNo ? ` · ${nextDrawNo}` : ""}
                            </p>
                        </div>
                        <p className="font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">
                            {nextIso ? `${formatDate(nextIso)} · ${weekdayOf(nextIso)} · 18:30 SGT` : ""}
                        </p>
                        {countdown.isPast ? (
                            <p className="text-[11px] text-ink-muted">Waiting for the result.</p>
                        ) : (
                            <>
                                <Countdown days={countdown.days} hours={countdown.hours} minutes={countdown.minutes} seconds={countdown.seconds} />
                                <WindowGauge nextDraw={nextDraw} remainingMs={countdown.remaining} />
                            </>
                        )}
                    </div>
                )}

                {/* The play slip is the page's primary action. */}
                <Panel className="hud-corners">
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
            </div>

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
                <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:col-span-5">
                    <Panel
                        title="Number board"
                        description="How often each number appeared across 7 indicator lenses. Colour shows deviation."
                        className="flex-1"
                        bodyClassName="flex flex-1 flex-col"
                        footer={
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {quickPickName && (
                                    <p aria-live="polite" className="text-[11px] leading-4 text-ink-subtle">
                                        From <span className="text-ink-muted">{quickPickName}</span>
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={handleQuickPick}
                                    className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold whitespace-nowrap text-white transition-colors duration-100 hover:bg-accent-strong dark:text-canvas"
                                >
                                    Quick pick
                                </button>
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

                    {/* League — lives under the board so both grid columns
                        carry real content; the winners list on the right no
                        longer leaves a bare well beside the board. */}
                    <Panel
                        title="Top strategies"
                        description={`Best ${LEAGUE_ROWS} of ${league?.strategies.length ?? 0} on ${league?.meta.folds ?? 0} draws · chance scores ${Math.round(((league?.meta.folds ?? 0) * (league?.meta.chance.weightedPrizesPer100Draws ?? 0)) / 100)}.`}
                        actions={
                            <Link to="/strategies" className="text-xs font-semibold text-accent-strong transition-colors duration-100 hover:text-ink">
                                All →
                            </Link>
                        }
                        bodyClassName="flex flex-col"
                        isFlush
                    >
                        <ol className="flex flex-col justify-around divide-y divide-line-soft">
                            {topStrategies.map((strategy) => (
                                <li key={strategy.id} className="px-4 py-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="w-4 shrink-0 font-mono text-[11px] text-ink-subtle tabular-nums">{strategy.rank}</span>
                                        <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-ink">{strategy.name}</span>
                                        <span className="shrink-0 font-mono text-xs font-semibold text-ink tabular-nums" title={`Prize points on the tier ladder: G7=1 G6=2 G5=3 G4=4 G3=5 G2=8 G1=13`}>{formatNumber(strategy.score ?? 0)}</span>
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

                <div className="flex min-w-0 flex-col gap-3 lg:col-span-7 lg:col-start-6">
                    <Panel title="Most and least seen" isFlush>
                        <div className="flex flex-col divide-y divide-line-soft">
                            {[
                                { label: "Most", rows: analysis?.hot.all.slice(0, 12) ?? [] },
                                { label: "Least", rows: analysis?.cold.all.slice(0, 12) ?? [] },
                            ].map((column) => (
                                <div key={column.label} className="flex items-center gap-2.5 px-3 py-1.5">
                                    <p className="w-12 shrink-0 text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">{column.label}</p>
                                    <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                                        {column.rows.map((entry) => (
                                            <li key={entry.number} className="inline-flex" title={`${entry.number}: ${formatNumber(entry.count)} appearances`}>
                                                <Ball n={entry.number} size="xs" />
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    {longestGapsPanel}

                    {/* The most recent graded draw's winners — every graded
                        rule that hit, trimmed-table rows and below-chance
                        rows alike. Tier chip on line one, the exact hitting
                        line on line two with the matched balls ringed. */}
                    {latestWinners && (
                        <Panel
                            title="Latest draw winners"
                            description={`Prize draws in draw ${latestWinners.graded.draw} · ${formatDate(latestWinners.graded.date)} · ${latestWinners.graded.numbers.join(" ")} + ${latestWinners.graded.additional}`}
                            className="flex-1"
                            bodyClassName="flex flex-1 flex-col"
                            isFlush
                        >
                            {latestWinners.rows.length === 0 ? (
                                <p className="px-4 py-4 text-[13px] text-ink-muted">
                                    No strategy won a prize in draw {latestWinners.graded.draw}.
                                </p>
                            ) : (
                                <>
                                    <ol className="flex flex-col divide-y divide-line-soft">
                                        {(allWinners ? latestWinners.rows : latestWinners.rows.slice(0, 8)).map((winner) => (
                                        <li key={`${winner.id}-${winner.tier}`} className="px-4 py-1.5">
                                            <div className="flex items-baseline gap-2">
                                                <span
                                                    className={cx(
                                                        "w-6 shrink-0 font-mono text-[10px] font-semibold tabular-nums",
                                                        winner.tier === 1 ? "text-gold" : "text-ink-subtle",
                                                    )}
                                                    title={`Group ${winner.tier} prize draw`}
                                                >
                                                    G{winner.tier}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-ink" title={winner.name}>{winner.name}</span>
                                                {!winner.kept && (
                                                    <span
                                                        className="shrink-0 rounded border border-line-soft px-1 py-px font-mono text-[9px] tracking-[0.08em] text-ink-subtle uppercase"
                                                        title="Below the chance baseline overall — trimmed from the league table, kept in the ledger"
                                                    >
                                                        below chance
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className="mt-1 flex items-center gap-1 pl-8"
                                                role="img"
                                                aria-label={`Winning line ${winner.pick.join(", ")}; matched ${winner.matched.length === 0 ? "none" : winner.matched.join(", ")}`}
                                            >
                                                <span aria-hidden="true" className="contents">
                                                    {winner.pick.map((n) => (
                                                        <Ball key={n} n={n} size="sm" className={winner.matched.includes(n) ? "ring-2 ring-accent" : "opacity-40"} />
                                                    ))}
                                                </span>
                                            </div>
                                        </li>
                                        ))}
                                    </ol>
                                    {latestWinners.rows.length > 8 && (
                                        <footer className="border-t border-line/70 px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setAllWinners((v) => !v)}
                                                aria-expanded={allWinners}
                                                className="min-h-7 font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase transition-colors duration-100 hover:text-accent-strong"
                                            >
                                                {allWinners
                                                    ? "Show fewer"
                                                    : `Show all ${latestWinners.rows.length} prize draws`}
                                            </button>
                                        </footer>
                                    )}
                                </>
                            )}
                        </Panel>
                    )}
                </div>
            </div>

            {/* The full draw archive — all the history content, at the foot. */}
            <HistoryScreen embedded />
        </div>
    );
};
