import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Ball } from "@/components/balls";
import { Panel } from "@/components/panel";
import { type BoardWindow, type CopyStatus, HeatLegend, LineSlip, NumberBoard } from "@/components/product/number-board";
import { PageHeader } from "@/components/product/page-header";
import { ScoreBar } from "@/components/product/score-bar";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { StatTile } from "@/components/product/stat-tile";
import { useClipboard } from "@/hooks/use-clipboard";
import { useCountdown } from "@/hooks/use-countdown";
import {
    type Analysis,
    type Draw,
    type LatestResult,
    type PrizeKey,
    type StrategiesFile,
    drawLowCount,
    drawOddCount,
    drawSum,
    formatDate,
    formatNumber,
    formatSgd,
    hasConsecutive,
    nextDrawDate,
    useJson,
    weekdayOf,
} from "@/lib/data";
import { quickPick } from "@/lib/quickpick";
import { usePageTitle } from "@/pages/layout";
import { useLineBuilder } from "@/providers/line-builder-provider";

/** How many draws the trailing window covers. */
const TRAILING_WINDOW = 50;

/** The winning numbers in a draw. */
const NUMBERS_PER_DRAW = 6;

/** Prize groups listed under the winning numbers. */
const PRIZE_GROUPS: PrizeKey[] = ["g2", "g3", "g4", "g5", "g6", "g7"];

/** League rows shown on the home page. */
const LEAGUE_ROWS = 6;

/** Recent draws listed beside the countdown. */
const RECENT_DRAWS = 7;

const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="rounded-lg bg-surface-inset px-2 py-1.5 text-center">
        <span className="block font-mono text-xl leading-6 font-semibold tracking-tight text-ink tabular-nums">{String(value).padStart(2, "0")}</span>
        <span className="block text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">{label}</span>
    </div>
);

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
    const { line, toggle, setLine, clear } = useLineBuilder();
    const { copy } = useClipboard();
    const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
    const copyTimer = useRef<number | null>(null);

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

    useEffect(
        () => () => {
            if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
        },
        [],
    );

    const latest = useMemo(() => draws?.at(-1) ?? null, [draws]);
    const lastDrawDate = live?.date ?? latest?.date ?? null;

    const nextDraw = useMemo(() => (lastDrawDate ? nextDrawDate(lastDrawDate) : null), [lastDrawDate]);
    const countdown = useCountdown(nextDraw);

    const topStrategies = useMemo(() => (league ? [...league.strategies].sort((a, b) => a.rank - b.rank).slice(0, LEAGUE_ROWS) : []), [league]);
    const recentDraws = useMemo(() => (draws ? draws.slice(-(RECENT_DRAWS + 1), -1).reverse() : []), [draws]);

    /** Appearance counts over the trailing window, counted client-side. */
    const trailingCounts = useMemo(() => {
        const counts = new Array(49).fill(0);
        if (!draws) return counts;

        for (const draw of draws.slice(-TRAILING_WINDOW)) {
            for (const number of draw.numbers) counts[number - 1] += 1;
        }
        return counts;
    }, [draws]);

    const windows = useMemo<BoardWindow[]>(() => {
        if (!analysis) return [];

        const eraDraws = analysis.coverage.totalDraws;
        return [
            {
                id: "all",
                label: "All time",
                counts: analysis.frequency.all,
                expected: (eraDraws * NUMBERS_PER_DRAW) / 49,
                draws: eraDraws,
            },
            {
                id: "trailing",
                label: `Last ${TRAILING_WINDOW}`,
                counts: trailingCounts,
                expected: (TRAILING_WINDOW * NUMBERS_PER_DRAW) / 49,
                draws: TRAILING_WINDOW,
            },
        ];
    }, [analysis, trailingCounts]);

    const handleCopy = async () => {
        const result = await copy(line.join(" "), "line");
        setCopyStatus(result.success ? "copied" : "failed");

        if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopyStatus("idle"), 2500);
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
    const baseline = league?.meta.chance.scoreBaseline ?? 45;

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

            <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-12">
                {/* Result */}
                <Panel emphasis="hero" className="md:col-span-2 lg:col-span-5">
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

                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={`Winning numbers ${numbers.join(", ")}`}>
                            {numbers.map((n, index) => (
                                <span key={n} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                                    <Ball n={n} size="xl" />
                                </span>
                            ))}
                        </div>
                        <span aria-hidden="true" className="hidden h-9 w-px bg-line sm:block" />
                        <div className="flex items-center gap-2">
                            {additional != null && <Ball n={additional} size="xl" variant="ring" />}
                            <span className="text-[10px] leading-3 font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                                Add.
                            </span>
                        </div>
                    </div>

                    <table className="mt-4 w-full border-collapse text-xs">
                        <caption className="sr-only">Prize per share and winners for groups 2 to 7</caption>
                        <thead>
                            <tr className="border-y border-line/70 text-[10px] tracking-[0.08em] text-ink-subtle uppercase">
                                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                                    Group
                                </th>
                                <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                                    Prize
                                </th>
                                <th scope="col" className="py-1.5 pl-2 text-right font-semibold">
                                    Winners
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {PRIZE_GROUPS.map((group) => {
                                const prize = prizes?.[group];
                                return (
                                    <tr key={group} className="border-b border-line-soft last:border-0">
                                        <td className="py-1 pr-2 font-medium text-ink-subtle uppercase">{group.replace("g", "G")}</td>
                                        <td className="px-2 py-1 text-right font-mono text-ink tabular-nums">
                                            {prize?.share ? formatSgd(prize.share) : "—"}
                                        </td>
                                        <td className="py-1 pl-2 text-right font-mono text-ink-muted tabular-nums">{prize?.winners ?? "—"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line/70 pt-2.5">
                        {[
                            { label: "Sum", value: drawSum(numbers) },
                            { label: "Odd", value: drawOddCount(numbers) },
                            { label: "Low", value: drawLowCount(numbers) },
                            { label: "Run", value: hasConsecutive(numbers) ? "Yes" : "No" },
                        ].map((fact) => (
                            <div key={fact.label} className="min-w-0">
                                <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">{fact.label}</dt>
                                <dd className="mt-0.5 font-mono text-xs font-medium text-ink tabular-nums">{fact.value}</dd>
                            </div>
                        ))}
                    </dl>
                </Panel>

                {/* League */}
                <Panel
                    className="lg:col-span-4"
                    title="Top rules"
                    description={`Best ${LEAGUE_ROWS} of ${league?.strategies.length ?? 0} on 100 past draws. 45 = a random pick; higher = more hits.`}
                    actions={
                        <Link to="/strategies" className="text-xs font-semibold text-accent transition-colors duration-100 hover:text-accent-strong">
                            All →
                        </Link>
                    }
                    isFlush
                >
                    <ol className="divide-y divide-line-soft">
                        {topStrategies.map((strategy) => (
                            <li key={strategy.id} className="px-4 py-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="w-4 shrink-0 font-mono text-[11px] text-ink-subtle tabular-nums">{strategy.rank}</span>
                                    <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-ink">{strategy.name}</span>
                                    <span className="shrink-0 font-mono text-xs font-semibold text-ink tabular-nums">{strategy.score.toFixed(1)}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 pl-6">
                                    <ScoreBar
                                        score={strategy.score}
                                        baseline={baseline}
                                        tone={strategy.rank === 1 ? "gold" : "primary"}
                                        className="min-w-0 flex-1"
                                    />
                                    <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                                        {strategy.currentPick.map((n) => (
                                            <Ball key={n} n={n} size="xs" />
                                        ))}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </Panel>

                {/* Next draw + recent draws */}
                <Panel className="lg:col-span-3" title="Next draw" description={nextDrawNo ? `Draw ${nextDrawNo}` : undefined} isFlush>
                    <div className="flex flex-col gap-3 px-4 pt-3">
                        {nextDraw && !countdown.isPast ? (
                            <>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <CountdownUnit value={countdown.days} label="days" />
                                    <CountdownUnit value={countdown.hours} label="hrs" />
                                    <CountdownUnit value={countdown.minutes} label="min" />
                                    <CountdownUnit value={countdown.seconds} label="sec" />
                                </div>
                                <p className="text-[11px] leading-4 text-ink-subtle">
                                    {nextIso ? `${formatDate(nextIso)} · ${weekdayOf(nextIso)}` : "—"} · 18:30 SGT
                                </p>
                            </>
                        ) : (
                            <p className="rounded-lg bg-surface-inset px-3 py-2 text-xs text-ink-muted">Waiting for the result.</p>
                        )}
                    </div>

                    <div className="mt-3 border-t border-line/70">
                        <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">Recent draws</p>
                        <ol>
                            {recentDraws.map((draw) => (
                                <li key={draw.draw}>
                                    <Link
                                        to="/history"
                                        className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-2 px-4 py-1 text-xs transition-colors duration-100 hover:bg-surface-2/70"
                                    >
                                        <span className="font-mono text-ink-muted tabular-nums">{draw.draw}</span>
                                        <span className="truncate text-ink-subtle">{formatDate(draw.date)}</span>
                                        <span className="font-mono text-ink tabular-nums">{drawSum(draw.numbers)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </div>
                </Panel>
            </div>

            <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-12">
                <Panel
                    className="lg:col-span-4"
                    title="Number board"
                    description="How often each number appeared. Colour shows the gap from random."
                    footer={
                        <div className="flex flex-col gap-2">
                            <HeatLegend />
                            <p className="text-[11px] leading-4 text-ink-subtle">
                                Dot = a number in the latest draw. A left dot marks a number far below random, a pink dot far above. Counts describe the past; they do
                                not change the next draw.
                            </p>
                        </div>
                    }
                >
                    <NumberBoard windows={windows} latestNumbers={numbers} line={line} onToggle={toggle} />
                </Panel>

                <div className="flex flex-col gap-3 xl:col-span-8">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile variant="bare" label="Draws" value={formatNumber(draws.length)} hint="Since 3 Jul 2008" />
                        <StatTile
                            variant="bare"
                            label="6/49 era"
                            value={formatNumber(era?.totalDraws ?? 0)}
                            hint={era?.firstDate ? `Since ${formatDate(era.firstDate)}` : undefined}
                        />
                        <StatTile
                            variant="bare"
                            label="Most seen"
                            value={hotBall ? hotBall.number : "—"}
                            hint={hotBall ? `${formatNumber(hotBall.count)} times` : undefined}
                            tone="primary"
                        />
                        <StatTile
                            variant="bare"
                            label="Longest gap"
                            value={longestGap ? longestGap.number : "—"}
                            hint={longestGap ? `${formatNumber(longestGap.gap)} draws` : undefined}
                        />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <Panel title="Play slip" description="Six numbers. Tap the board to fill it.">
                            <LineSlip
                                line={line}
                                onQuickPick={() => setLine(quickPick())}
                                onClear={clear}
                                onCopy={handleCopy}
                                copyStatus={copyStatus}
                            />
                        </Panel>

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
                        TOTO draws are independent and uniform. Every line has the same chance of Group 1, whatever the board, the rules or the history say.
                    </p>
                </div>
            </div>
        </div>
    );
};
