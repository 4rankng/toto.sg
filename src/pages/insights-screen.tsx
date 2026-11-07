import { useMemo } from "react";
import { Ball } from "@/components/balls";
import { Panel } from "@/components/panel";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { StatTile } from "@/components/product/stat-tile";
import { td, tdNum, th, thNum } from "@/components/product/table";
import { CountDistributionChart, DecadeHeatmap, FrequencyChart, type HeatmapCell, type SumBin, SumHistogram, WeekdayChart } from "@/components/toto-charts";
import { type Analysis, type Draw, drawDecades, drawSum, formatDate, formatNumber, formatSgd, formatSigned, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

/** Decade buckets as `drawDecades` counts them: floor((n - 1) / 10). */
const DECADE_LABELS = ["1–10", "11–20", "21–30", "31–40", "41–49"];

/** Monday first, then the rest of the week. */
const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The sum band that holds most draws. */
const BAND_LO = 115;
const BAND_HI = 185;

/** Width of one sum histogram bin. */
const SUM_BIN_WIDTH = 10;

/** Numbers 1–49: 25 of them are odd, 24 of them are at or below 24. */
const ODD_POOL = 25;
const LOW_POOL = 24;

/** Number pairs per draw, and number pairs in the pool. */
const PAIRS_PER_DRAW = 15;
const PAIRS_IN_POOL = 1176;

/** The trailing window compared against the all-time rate. */
const RECENT_WINDOW = 50;

const pct = (value: number) => `${Math.round(value * 100)}%`;

const InsightsSkeleton = () => (
    <DataLoading label="Loading the statistics">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
            ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
            <Skeleton className="h-80 rounded-xl lg:col-span-8" />
            <Skeleton className="h-80 rounded-xl lg:col-span-4" />
            <Skeleton className="h-80 rounded-xl lg:col-span-7" />
            <Skeleton className="h-80 rounded-xl lg:col-span-5" />
        </div>
    </DataLoading>
);

export const InsightsScreen = () => {
    usePageTitle("Insights — what the draws look like");

    const { data: analysis, isLoading: analysisLoading, error: analysisError } = useJson<Analysis>("/data/analysis.json");
    const { data: draws, isLoading: drawsLoading, error: drawsError } = useJson<Draw[]>("/data/draws.json");

    /** The 6/49 era: every draw from the coverage date onwards. */
    const eraDraws = useMemo(() => {
        if (!draws || !analysis) return [];
        return draws.filter((draw) => draw.date >= analysis.coverage.firstDate);
    }, [draws, analysis]);

    const sumBins = useMemo<SumBin[]>(() => {
        if (eraDraws.length === 0) return [];

        const sums = eraDraws.map((draw) => drawSum(draw.numbers));
        const start = Math.floor(Math.min(...sums) / SUM_BIN_WIDTH) * SUM_BIN_WIDTH;
        const last = Math.max(...sums);

        const bins: SumBin[] = [];
        for (let lo = start; lo <= last; lo += SUM_BIN_WIDTH) {
            const hi = lo + SUM_BIN_WIDTH - 1;
            let count = 0;
            for (const sum of sums) {
                if (sum >= lo && sum <= hi) count += 1;
            }
            bins.push({ lo, hi, count });
        }
        return bins;
    }, [eraDraws]);

    const band = useMemo(() => {
        if (eraDraws.length === 0) return { lo: BAND_LO, hi: BAND_HI, count: 0, share: 0 };

        let count = 0;
        for (const draw of eraDraws) {
            const sum = drawSum(draw.numbers);
            if (sum >= BAND_LO && sum <= BAND_HI) count += 1;
        }
        return { lo: BAND_LO, hi: BAND_HI, count, share: count / eraDraws.length };
    }, [eraDraws]);

    /** Decade by year: average picks per draw in each cell of the strip. */
    const decades = useMemo(() => {
        const years = [...new Set(eraDraws.map((draw) => draw.date.slice(0, 4)))].sort();
        const picks: number[][] = Array.from({ length: DECADE_LABELS.length }, () => years.map(() => 0));
        const drawCounts: number[][] = Array.from({ length: DECADE_LABELS.length }, () => years.map(() => 0));

        for (const draw of eraDraws) {
            const column = years.indexOf(draw.date.slice(0, 4));
            if (column < 0) continue;

            const decadeCounts = drawDecades(draw.numbers);
            for (let row = 0; row < DECADE_LABELS.length; row += 1) {
                picks[row][column] += decadeCounts[row];
                drawCounts[row][column] += 1;
            }
        }

        const cells: HeatmapCell[][] = picks.map((row, rowIndex) =>
            row.map((picksInCell, columnIndex) => {
                const drawCount = drawCounts[rowIndex][columnIndex];
                return { value: drawCount > 0 ? picksInCell / drawCount : null, draws: drawCount };
            }),
        );

        return { years: years.map(Number), cells };
    }, [eraDraws]);

    /** The pairs that shared a draw most often. */
    const pairs = useMemo(() => {
        const counts = new Map<number, number>();

        for (const draw of eraDraws) {
            const numbers = [...draw.numbers].sort((a, b) => a - b);
            for (let i = 0; i < numbers.length; i += 1) {
                for (let j = i + 1; j < numbers.length; j += 1) {
                    const key = numbers[i] * 50 + numbers[j];
                    counts.set(key, (counts.get(key) ?? 0) + 1);
                }
            }
        }

        return [...counts.entries()]
            .map(([key, count]) => ({ a: Math.floor(key / 50), b: key % 50, count }))
            .sort((x, y) => y.count - x.count || x.a - y.a || x.b - y.b)
            .slice(0, 10);
    }, [eraDraws]);

    const weekdayDays = useMemo(
        () =>
            WEEKDAY_ORDER.map((label) => {
                const entry = analysis?.weekday[label];
                return { label, count: entry?.count ?? 0, meanSum: entry?.meanSum ?? 0 };
            }),
        [analysis],
    );

    /** The last 50 draws against the all-time rate: who is heating up. */
    const movement = useMemo(() => {
        if (!analysis) return { risers: [], fallers: [], expected: 0 };
        const expected = (RECENT_WINDOW * 6) / 49;
        const rows = analysis.frequency.last50.map((count, index) => ({ number: index + 1, count, delta: count - expected }));
        return {
            expected,
            risers: [...rows].sort((a, b) => b.delta - a.delta).slice(0, 5),
            fallers: [...rows].sort((a, b) => a.delta - b.delta).slice(0, 5),
        };
    }, [analysis]);

    /** Group 1 wins and the biggest jackpot per year. */
    const group1 = useMemo(() => {
        if (!analysis) return { years: [] as { year: string; wins: number; max: number }[], totalWins: 0, top: { year: "", max: 0 }, maxWins: 1 };
        const years = Object.entries(analysis.group1ByYear)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, value]) => ({ year, wins: value.wins, max: value.maxJackpot }));
        return {
            years,
            totalWins: years.reduce((sum, row) => sum + row.wins, 0),
            top: years.reduce((best, row) => (row.max > best.max ? { year: row.year, max: row.max } : best), { year: "", max: 0 }),
            maxWins: Math.max(...years.map((row) => row.wins), 1),
        };
    }, [analysis]);

    if (analysisLoading || drawsLoading) return <InsightsSkeleton />;

    if (analysisError || drawsError || !analysis || !draws) {
        return (
            <Panel title="Statistics unavailable" description={analysisError?.message ?? drawsError?.message ?? "An analysis file is missing."}>
                <p className="text-sm text-ink-muted">Run `npm run refresh`, then reload.</p>
            </Panel>
        );
    }

    const coverage = analysis.coverage;
    const total = eraDraws.length;
    const expectedPerNumber = (coverage.totalDraws * 6) / 49;
    const hot = analysis.hot.all[0];
    const cold = analysis.cold.all[0];
    const oddExpected = (6 * ODD_POOL) / 49;
    const lowExpected = (6 * LOW_POOL) / 49;
    const expectedPairMeetings = (total * PAIRS_PER_DRAW) / PAIRS_IN_POOL;
    const fridayDraws = analysis.weekday.Fri?.count ?? 0;
    const decadeMin = Math.min(...analysis.decades);
    const decadeMax = Math.max(...analysis.decades);
    const gapMax = Math.max(...analysis.overdue.map((entry) => entry.gap), 1);

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="Stats"
                title="Insights"
                meta={
                    <>
                        <span>
                            <span className="font-mono text-ink-muted tabular-nums">{formatNumber(total)}</span> draws
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                            {formatDate(coverage.firstDate)} → {formatDate(coverage.lastDate)}
                        </span>
                    </>
                }
                description="The 6/49 era in numbers: frequency, sums, parity, decades, pairs, runs, gaps, weekdays and jackpots."
            />

            {/* The headline numbers, all in one strip. */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4 xl:grid-cols-8">
                <StatTile variant="bare" label="Draws" value={formatNumber(total)} hint="6/49 era" />
                <StatTile variant="bare" label="Mean sum" value={analysis.sum.mean.toFixed(1)} hint={`median ${analysis.sum.median}`} />
                <StatTile variant="bare" label="Most seen" value={hot?.number ?? "—"} hint={hot ? `${formatNumber(hot.count)} draws` : undefined} tone="primary" />
                <StatTile variant="bare" label="Least seen" value={cold?.number ?? "—"} hint={cold ? `${formatNumber(cold.count)} draws` : undefined} />
                <StatTile variant="bare" label="Consecutive" value={pct(analysis.consecutive.drawRate)} hint="of draws" />
                <StatTile variant="bare" label="Repeats" value={pct(analysis.repeaters.rate)} hint={`${analysis.repeaters.avgCount.toFixed(2)} per draw`} />
                <StatTile variant="bare" label="Group 1 wins" value={formatNumber(group1.totalWins)} hint="since 2014" />
                <StatTile variant="bare" label="Top jackpot" value={formatSgd(group1.top.max)} hint={group1.top.year} tone="gold" />
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-12">
                <Panel
                    className="lg:col-span-8"
                    title="Number frequency"
                    description={`How many of the ${formatNumber(total)} draws each number appeared in. The dashed line is the average.`}
                >
                    <FrequencyChart
                        counts={analysis.frequency.all}
                        expected={expectedPerNumber}
                        totalDraws={total}
                        hotNumber={hot?.number}
                        coldNumber={cold?.number}
                        className="mt-2"
                    />
                </Panel>

                <Panel
                    className="lg:col-span-4"
                    title="Last 50 vs all time"
                    description={`Appearances in the last ${RECENT_WINDOW} draws against ${movement.expected.toFixed(1)} expected.`}
                    isFlush
                >
                    <div className="grid grid-cols-2 divide-x divide-line-soft">
                        {[
                            { label: "Rising", rows: movement.risers, tone: "text-up" },
                            { label: "Falling", rows: movement.fallers, tone: "text-down" },
                        ].map((column) => (
                            <div key={column.label} className="px-4 py-2">
                                <p className="text-[10px] font-semibold tracking-[0.1em] text-ink-subtle uppercase">{column.label}</p>
                                <ol className="mt-1">
                                    {column.rows.map((row) => (
                                        <li key={row.number} className="flex items-center justify-between gap-2 py-0.5">
                                            <Ball n={row.number} size="sm" />
                                            <span className={cx("font-mono text-[11px] tabular-nums", column.tone)}>{formatSigned(row.delta, 1)}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel
                    className="lg:col-span-7"
                    title="Sum of the six numbers"
                    description="How often each total came up, in bands of ten. Shaded band holds most draws."
                >
                    <SumHistogram bins={sumBins} mean={analysis.sum.mean} median={analysis.sum.median} band={band} totalDraws={total} className="mt-2" />
                    <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                        Mean <span className="font-mono text-ink-muted tabular-nums">{analysis.sum.mean.toFixed(1)}</span> · median{" "}
                        <span className="font-mono text-ink-muted tabular-nums">{analysis.sum.median}</span> ·{" "}
                        <span className="font-mono text-ink-muted tabular-nums">{formatNumber(band.count)}</span> of {formatNumber(total)} draws (
                        {Math.round(band.share * 100)}%) fall between {band.lo} and {band.hi}.
                    </p>
                </Panel>

                <Panel className="lg:col-span-5" title="Odd numbers per draw" description={`Average ${oddExpected.toFixed(2)} of the six are odd.`}>
                    <CountDistributionChart
                        counts={analysis.oddEven}
                        unit="odd numbers"
                        expectedBucket={Math.round(oddExpected)}
                        expectedValue={oddExpected}
                        totalDraws={total}
                        className="mt-2"
                    />
                </Panel>

                <Panel className="lg:col-span-4" title="Low numbers per draw" description={`Number 24 or below. Average ${lowExpected.toFixed(2)} of six.`}>
                    <CountDistributionChart
                        counts={analysis.lowHigh}
                        unit="low numbers (≤ 24)"
                        expectedBucket={Math.round(lowExpected)}
                        expectedValue={lowExpected}
                        totalDraws={total}
                        tone="secondary"
                        className="mt-2"
                    />
                </Panel>

                <Panel
                    className="lg:col-span-8"
                    title="Decade spread"
                    description="Numbers per draw from each decade, year by year, with the all-time average on the right."
                >
                    <DecadeHeatmap rows={DECADE_LABELS} columns={decades.years} cells={decades.cells} marginal={analysis.decades} className="mt-2" />
                    <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                        2014 holds only part of the year. Every decade sits between{" "}
                        <span className="font-mono text-ink-muted tabular-nums">{decadeMin.toFixed(2)}</span> and{" "}
                        <span className="font-mono text-ink-muted tabular-nums">{decadeMax.toFixed(2)}</span> numbers per draw.
                    </p>
                </Panel>

                <Panel className="lg:col-span-7" title="Most common pairs" description="The 10 pairs that appeared in the same draw most often." isFlush>
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr>
                                <th className={cx(th, "static w-10")}>#</th>
                                <th className={cx(th, "static")}>Pair</th>
                                <th className={cx(thNum, "static")}>Draws</th>
                                <th className={cx(thNum, "static")}>Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pairs.map((pair, index) => (
                                <tr key={`${pair.a}-${pair.b}`}>
                                    <td className={tdNum}>{index + 1}</td>
                                    <td className={td}>
                                        <span className="font-mono text-ink tabular-nums">
                                            {pair.a} – {pair.b}
                                        </span>
                                    </td>
                                    <td className={tdNum}>{formatNumber(pair.count)}</td>
                                    <td className={tdNum}>{((pair.count / total) * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mt-2 px-3 text-[11px] leading-4 text-ink-subtle">
                        A fixed pair meets about <span className="font-mono text-ink-muted tabular-nums">{expectedPairMeetings.toFixed(1)}</span> times in{" "}
                        {formatNumber(total)} draws. The top pair met{" "}
                        <span className="font-mono text-ink-muted tabular-nums">{pairs[0]?.count ?? 0}</span> — the most of{" "}
                        {formatNumber(PAIRS_IN_POOL)} possible pairs.
                    </p>
                </Panel>

                <Panel className="lg:col-span-5" title="Weekday" description="Draws per weekday, with the mean sum above each bar.">
                    <WeekdayChart days={weekdayDays} className="mt-2" />
                    <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                        Draws run Monday and Thursday. The {formatNumber(fridayDraws)} Friday draws are special draws, not a third weekly draw.
                    </p>
                </Panel>

                <Panel className="lg:col-span-4" title="Group 1 by year" description="Winning tickets and the biggest jackpot in each year." isFlush>
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr>
                                <th className={cx(th, "static w-16")}>Year</th>
                                <th className={cx(th, "static")}>Wins</th>
                                <th className={cx(thNum, "static")}>Biggest jackpot</th>
                            </tr>
                        </thead>
                        <tbody>
                            {group1.years.map((row) => (
                                <tr key={row.year}>
                                    <td className={cx(tdNum, "text-left")}>{row.year}</td>
                                    <td className={td}>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 min-w-16 flex-1 rounded-full bg-surface-3">
                                                <div
                                                    className="h-full rounded-full bg-accent"
                                                    style={{ width: `${(row.wins / group1.maxWins) * 100}%` }}
                                                />
                                            </div>
                                            <span className="w-7 text-right font-mono text-[11px] text-ink-muted tabular-nums">{row.wins}</span>
                                        </div>
                                    </td>
                                    <td className={tdNum}>{formatSgd(row.max)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <Panel className="lg:col-span-4" title="Patterns" description="How often a draw repeats itself.">
                    <dl className="grid grid-cols-2 gap-3">
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Consecutive</dt>
                            <dd className="font-display text-xl font-semibold text-ink tabular-nums">{pct(analysis.consecutive.drawRate)}</dd>
                            <p className="text-[10px] text-ink-subtle">of draws have a run</p>
                        </div>
                        <div>
                            <dt className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Repeats</dt>
                            <dd className="font-display text-xl font-semibold text-ink tabular-nums">{pct(analysis.repeaters.rate)}</dd>
                            <p className="text-[10px] text-ink-subtle">{analysis.repeaters.avgCount.toFixed(2)} per draw</p>
                        </div>
                    </dl>
                    <p className="mt-3 border-t border-line/70 pt-2 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">Most common runs</p>
                    <ol className="mt-1">
                        {analysis.consecutive.topPairs.slice(0, 4).map((pair) => (
                            <li key={`${pair.a}-${pair.b}`} className="flex items-center justify-between gap-2 py-0.5 text-[11px]">
                                <span className="font-mono text-ink-muted tabular-nums">
                                    {pair.a} – {pair.b}
                                </span>
                                <span className="font-mono text-ink tabular-nums">{pair.count}</span>
                            </li>
                        ))}
                    </ol>
                </Panel>

                <Panel className="lg:col-span-4" title="Longest gaps" description="Draws since each number last appeared." isFlush>
                    <ol className="px-4 py-1">
                        {analysis.overdue.map((entry) => (
                            <li key={entry.number} className="flex items-center gap-2 py-1">
                                <Ball n={entry.number} size="xs" />
                                <div className="h-1.5 flex-1 rounded-full bg-surface-3">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${(entry.gap / gapMax) * 100}%`, backgroundColor: "var(--color-heat-cold)" }}
                                    />
                                </div>
                                <span className="w-6 text-right font-mono text-[11px] text-ink tabular-nums">{entry.gap}</span>
                            </li>
                        ))}
                    </ol>
                </Panel>
            </div>

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                Every number is equally likely in every draw. The patterns above describe the past and do not predict the next draw.
            </p>
        </div>
    );
};
