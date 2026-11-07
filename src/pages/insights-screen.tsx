import { useMemo } from "react";
import { Activity, BarChart01, Clock, Coins01, Hash01, Lightning01 } from "@untitledui/icons";
import { Ball } from "@/components/balls";
import { Panel } from "@/components/panel";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { DonutChart, Gauge } from "@/components/product/console-charts";
import { InsightPanel } from "@/components/product/insight-panel";
import { KpiCard } from "@/components/product/kpi-card";
import { MasonryGrid } from "@/components/product/masonry-grid";
import { td, tdNum, th, thNum } from "@/components/product/table";
import { AdditionalBall, CompositionMatrix, DeltaProfile, GapVolcano, JackpotTrend, MonthHeatmap, PositionLadder, RepeatersFlow, StreakRibbons, SumTrend, TimelineStrip } from "@/components/insights-charts";
import { CountDistributionChart, DecadeHeatmap, FrequencyChart, type HeatmapCell, type SumBin, SumHistogram, WeekdayChart } from "@/components/toto-charts";
import { type Analysis, type Draw, drawDecades, drawSum, formatDate, formatNumber, formatSigned, useJson } from "@/lib/data";
import {
    additionalStats,
    compositionMatrix,
    deltaStats,
    gapStats,
    jackpotStats,
    monthStats,
    positionLadder,
    repeaterStats,
    streakRows,
    sumTrend,
    timelineWindow,
} from "@/lib/insights-stats";
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

/** Draws in the tracking strip. */
const TIMELINE_WINDOW = 60;

/** Draws in the streak ribbons. */
const STREAK_WINDOW = 30;

/** Draws in the rolling sum mean. */
const SUM_TREND_WINDOW = 20;

/** One panel in the gallery index. */
interface IndexPanel {
    id: string;
    label: string;
}

/** The three galleries, in reading order, with the panels inside each. */
const SECTIONS: { id: string; label: string; panels: IndexPanel[] }[] = [
    {
        id: "the-numbers",
        label: "The numbers",
        panels: [
            { id: "panel-frequency", label: "Frequency" },
            { id: "panel-gap-tracker", label: "Gap tracker" },
            { id: "panel-timeline", label: "Timeline" },
            { id: "panel-streaks", label: "Streaks" },
            { id: "panel-decades", label: "Decades" },
            { id: "panel-pairs", label: "Pairs" },
            { id: "panel-last-50", label: "Last 50" },
        ],
    },
    {
        id: "the-lines",
        label: "The lines",
        panels: [
            { id: "panel-sum", label: "Sum" },
            { id: "panel-sum-trend", label: "Sum trend" },
            { id: "panel-odd", label: "Odd" },
            { id: "panel-low", label: "Low" },
            { id: "panel-composition", label: "Composition" },
            { id: "panel-delta", label: "Deltas" },
            { id: "panel-position", label: "Positions" },
        ],
    },
    {
        id: "the-cage",
        label: "The cage",
        panels: [
            { id: "panel-repeaters", label: "Repeaters" },
            { id: "panel-additional", label: "Additional ball" },
            { id: "panel-month", label: "Month of year" },
            { id: "panel-weekday", label: "Weekday" },
            { id: "panel-jackpot", label: "Jackpots" },
            { id: "panel-patterns", label: "Patterns" },
        ],
    },
];

/** Every panel in reading order, numbered the way the panels are numbered. */
const PANEL_INDEX = SECTIONS.flatMap((section) => section.panels).map((panel, index) => ({
    id: panel.id,
    label: panel.label,
    number: index + 1,
}));

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

    /** The gap volcano: how long every number has been missing. */
    const gaps = useMemo(() => (analysis ? gapStats(analysis.lastSeen, analysis.frequency.all) : null), [analysis]);

    /** The tracking strip and the streak ribbons. */
    const timeline = useMemo(() => timelineWindow(eraDraws, TIMELINE_WINDOW), [eraDraws]);
    const streaks = useMemo(() => streakRows(eraDraws, STREAK_WINDOW), [eraDraws]);

    /** The rolling sum mean across the era. */
    const sums = useMemo(() => sumTrend(eraDraws, SUM_TREND_WINDOW), [eraDraws]);

    /** Odd × high composition, repeats, deltas, positions, months, additional. */
    const composition = useMemo(() => compositionMatrix(eraDraws), [eraDraws]);
    const repeaters = useMemo(() => repeaterStats(eraDraws), [eraDraws]);
    const deltas = useMemo(() => deltaStats(eraDraws), [eraDraws]);
    const positions = useMemo(() => positionLadder(eraDraws), [eraDraws]);
    const months = useMemo(() => monthStats(eraDraws), [eraDraws]);
    const additional = useMemo(() => additionalStats(eraDraws), [eraDraws]);

    /** Group 1 wins and the biggest jackpot per year. */
    const group1 = useMemo(() => (analysis ? jackpotStats(analysis.group1ByYear) : null), [analysis]);

    /** The cells that sit furthest from the fair share, widest miss first. */
    const compositionMisses = useMemo(() => {
        return [...composition].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
    }, [composition]);

    /** How many cells sit above or below their fair share. */
    const compositionAbove = useMemo(() => composition.filter((cell) => cell.delta > 0).length, [composition]);

    /** The calendar month with the highest and lowest mean sum. */
    const monthExtremes = useMemo(() => {
        const withDraws = months.monthlyMean.filter((row) => row.draws > 0);
        if (withDraws.length === 0) return null;
        return {
            highest: [...withDraws].sort((a, b) => b.mean - a.mean)[0],
            lowest: [...withDraws].sort((a, b) => a.mean - b.mean)[0],
        };
    }, [months]);

    if (analysisLoading || drawsLoading) return <InsightsSkeleton />;

    if (analysisError || drawsError || !analysis || !draws || !gaps || !group1) {
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
                description="The 6/49 era in numbers: frequency, gaps, sums, parity, deltas, positions, runs, weekdays and jackpots — each one against what a fair cage would have produced."
            />

            {/* The headline numbers, in console cards. */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="Draws" value={formatNumber(total)} hint="6/49 era" icon={Hash01} tone="primary" />
                <KpiCard label="Mean sum" value={analysis.sum.mean.toFixed(1)} hint={`median ${analysis.sum.median}`} icon={BarChart01} tone="secondary" />
                <KpiCard label="Most seen" value={hot?.number ?? "—"} hint={hot ? `${formatNumber(hot.count)} draws` : undefined} icon={Lightning01} tone="gold" />
                <KpiCard label="Least seen" value={cold?.number ?? "—"} hint={cold ? `${formatNumber(cold.count)} draws` : undefined} icon={Activity} tone="neutral" />
                <KpiCard label="Overdue" value={gaps.overdueCount} hint={`of 49 numbers`} icon={Clock} tone="primary" />
                <KpiCard label="Top jackpot" value={`S$${(group1.peak.max / 1_000_000).toFixed(1)}M`} hint={`${group1.peak.year} · biggest ever`} icon={Coins01} tone="gold" />
            </div>

            {/* The gallery index — three sections, twenty panels. */}
            <nav aria-label="Insights sections" className="scrollbar-hide flex flex-col gap-1.5">
                <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto">
                    {SECTIONS.map((section) => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition-colors duration-100 hover:border-line-strong hover:text-ink"
                        >
                            {section.label}
                        </a>
                    ))}
                </div>
                <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto">
                    {PANEL_INDEX.map((panel) => (
                        <a
                            key={panel.id}
                            href={`#${panel.id}`}
                            className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle transition-colors duration-100 hover:text-accent"
                        >
                            {String(panel.number).padStart(2, "0")} {panel.label}
                        </a>
                    ))}
                </div>
            </nav>

            {/* ---------------------------------------------------------------- *
             * The numbers — what each of the 49 has been doing.
             * ---------------------------------------------------------------- */}
            <section id="the-numbers" className="flex flex-col gap-3">
                <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">The numbers</h2>
                <MasonryGrid>
                    <InsightPanel
                        number={1}
                        section="The numbers"
                        title="Number frequency"
                        caption={`How many of the ${formatNumber(total)} draws each number appeared in.`}
                        id="panel-frequency"
                        family="Frequency"
                        className="lg:col-span-6"
                        stats={[
                            { label: "Hottest", value: hot?.number ?? "—", hint: hot ? `${formatNumber(hot.count)} draws` : undefined },
                            { label: "Coldest", value: cold?.number ?? "—", hint: cold ? `${formatNumber(cold.count)} draws` : undefined },
                            { label: "Spread", value: `${(hot?.count ?? 0) - (cold?.count ?? 0)} draws`, hint: "hottest minus coldest" },
                        ]}
                    >
                        <FrequencyChart
                            counts={analysis.frequency.all}
                            expected={expectedPerNumber}
                            totalDraws={total}
                            hotNumber={hot?.number}
                            coldNumber={cold?.number}
                            className="mt-2"
                        />
                    </InsightPanel>

                    <InsightPanel
                        number={2}
                        section="The numbers"
                        title="Gap tracker"
                        caption="Draws since each number last came up — the longer the bar, the longer the wait."
                        id="panel-gap-tracker"
                        family="Gap & Due"
                        className="lg:col-span-6"
                        stats={[
                            { label: "Overdue now", value: gaps.overdueCount, hint: `past ${gaps.dangerGap} draws` },
                            { label: "Fair cage", value: gaps.expectedOverdue.toFixed(1), hint: "numbers overdue" },
                            { label: "Hottest", value: gaps.hottest[0]?.number ?? "—", hint: gaps.hottest[0] ? `${gaps.hottest[0].gap} draws out` : undefined },
                        ]}
                    >
                        <GapVolcano stats={gaps} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={3}
                        section="The numbers"
                        title="Timeline heat strip"
                        caption={`The last ${TIMELINE_WINDOW} draws against all 49 numbers, newest on the right. The ringed cell is the additional number.`}
                        id="panel-timeline"
                        family="Sequence"
                        className="lg:col-span-12"
                    >
                        <TimelineStrip draws={timeline} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={4}
                        section="The numbers"
                        title="Streak ribbons"
                        caption={`A dot for every hit in the last ${STREAK_WINDOW} draws, sorted by how often each number turned up in the last ten.`}
                        id="panel-streaks"
                        family="Streaks"
                        className="lg:col-span-5"
                        stats={[
                            { label: "Hot now", value: streaks[0]?.number ?? "—", hint: streaks[0] ? `${streaks[0].hot} hits in 10` : undefined },
                            { label: "Cold now", value: streaks.at(-1)?.number ?? "—", hint: streaks.at(-1) ? `${streaks.at(-1)?.hot} hits in 10` : undefined },
                            { label: "Expected", value: `${((STREAK_WINDOW * 6) / 49).toFixed(1)}`, hint: "hits per number" },
                        ]}
                    >
                        <StreakRibbons rows={streaks} window={STREAK_WINDOW} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={5}
                        section="The numbers"
                        title="Decade spread"
                        caption="Numbers per draw from each decade, year by year, with the all-time average on the right."
                        id="panel-decades"
                        family="Structure"
                        className="lg:col-span-7"
                        stats={[
                            { label: "Widest", value: decadeMax.toFixed(2), hint: "numbers per draw" },
                            { label: "Narrowest", value: decadeMin.toFixed(2), hint: "numbers per draw" },
                            { label: "Expected", value: (6 * 10 / 49).toFixed(2), hint: "per decade" },
                        ]}
                    >
                        <DecadeHeatmap rows={DECADE_LABELS} columns={decades.years} cells={decades.cells} marginal={analysis.decades} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={6}
                        section="The numbers"
                        title="Most common pairs"
                        caption="The 10 pairs that appeared in the same draw most often."
                        id="panel-pairs"
                        family="Pairs"
                        className="lg:col-span-7"
                        stats={[
                            { label: "Top pair", value: pairs[0] ? `${pairs[0].a}–${pairs[0].b}` : "—", hint: `${formatNumber(pairs[0]?.count ?? 0)} draws` },
                            { label: "Possible pairs", value: formatNumber(PAIRS_IN_POOL), hint: "in the pool" },
                            { label: "Expected", value: expectedPairMeetings.toFixed(1), hint: "meetings" },
                        ]}
                    >
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
                    </InsightPanel>

                    <InsightPanel
                        number={7}
                        section="The numbers"
                        title="Last 50 vs all time"
                        caption={`Appearances in the last ${RECENT_WINDOW} draws against ${movement.expected.toFixed(1)} expected.`}
                        id="panel-last-50"
                        family="Hot & Cold"
                        className="lg:col-span-5"
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
                    </InsightPanel>
                </MasonryGrid>
            </section>

            {/* ---------------------------------------------------------------- *
             * The lines — the shape of a single draw.
             * ---------------------------------------------------------------- */}
            <section id="the-lines" className="flex flex-col gap-3">
                <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">The lines</h2>
                <MasonryGrid>
                    <InsightPanel
                        number={8}
                        section="The lines"
                        title="Sum of the six numbers"
                        caption="How often each total came up, in bands of ten. Shaded band holds most draws."
                        id="panel-sum"
                        family="Sum Band"
                        className="lg:col-span-7 xl:col-span-6"
                        stats={[
                            { label: "Mean", value: analysis.sum.mean.toFixed(1), hint: `median ${analysis.sum.median}` },
                            { label: "In band", value: pct(band.share), hint: `${band.lo}–${band.hi}` },
                            { label: "Draws in band", value: formatNumber(band.count), hint: `of ${formatNumber(total)}` },
                        ]}
                    >
                        <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
                            <SumHistogram bins={sumBins} mean={analysis.sum.mean} median={analysis.sum.median} band={band} totalDraws={total} />
                            <DonutChart
                                segments={[
                                    { label: "under 120", value: analysis.sum.bands.slice(0, 2).reduce((sum, b) => sum + b.count, 0), colour: "var(--color-secondary)" },
                                    { label: "120–149", value: analysis.sum.bands[2]?.count ?? 0, colour: "var(--color-primary)" },
                                    { label: "150–179", value: analysis.sum.bands[3]?.count ?? 0, colour: "var(--color-heat-hot)" },
                                    { label: "180 and over", value: analysis.sum.bands.slice(4).reduce((sum, b) => sum + b.count, 0), colour: "var(--color-gold)" },
                                ]}
                                centerValue={analysis.sum.mean.toFixed(0)}
                                centerLabel="mean sum"
                            />
                        </div>
                    </InsightPanel>

                    <InsightPanel
                        number={9}
                        section="The lines"
                        title="Sum trend"
                        caption={`Rolling ${SUM_TREND_WINDOW}-draw mean of the draw sum.`}
                        id="panel-sum-trend"
                        family="Momentum"
                        className="lg:col-span-5 xl:col-span-6"
                        stats={[
                            { label: "Era mean", value: analysis.sum.mean.toFixed(1), hint: "all draws" },
                            { label: "Band", value: `${band.lo}–${band.hi}`, hint: "most draws" },
                            { label: "Longest run", value: formatNumber(analysis.consecutive.drawRate * total), hint: "draws with a pair" },
                        ]}
                    >
                        <SumTrend points={sums} band={{ lo: band.lo, hi: band.hi }} mean={analysis.sum.mean} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={10}
                        section="The lines"
                        title="Odd numbers per draw"
                        caption={`Average ${oddExpected.toFixed(2)} of the six are odd.`}
                        id="panel-odd"
                        family="Structure"
                        className="lg:col-span-6"
                        stats={[
                            { label: "Most common", value: analysis.oddEven.indexOf(Math.max(...analysis.oddEven)), hint: "odd numbers" },
                            { label: "Expected", value: oddExpected.toFixed(2), hint: "per draw" },
                            { label: "Odd in pool", value: ODD_POOL, hint: "of 49 numbers" },
                        ]}
                    >
                        <CountDistributionChart
                            counts={analysis.oddEven}
                            unit="odd numbers"
                            expectedBucket={Math.round(oddExpected)}
                            expectedValue={oddExpected}
                            totalDraws={total}
                            className="mt-2"
                        />
                    </InsightPanel>

                    <InsightPanel
                        number={11}
                        section="The lines"
                        title="Low numbers per draw"
                        caption={`Number 24 or below. Average ${lowExpected.toFixed(2)} of six.`}
                        id="panel-low"
                        family="Structure"
                        className="lg:col-span-6"
                        stats={[
                            { label: "Most common", value: analysis.lowHigh.indexOf(Math.max(...analysis.lowHigh)), hint: "low numbers" },
                            { label: "Expected", value: lowExpected.toFixed(2), hint: "per draw" },
                            { label: "Low in pool", value: LOW_POOL, hint: "of 49 numbers" },
                        ]}
                    >
                        <CountDistributionChart
                            counts={analysis.lowHigh}
                            unit="low numbers (≤ 24)"
                            expectedBucket={Math.round(lowExpected)}
                            expectedValue={lowExpected}
                            totalDraws={total}
                            tone="secondary"
                            className="mt-2"
                        />
                    </InsightPanel>

                    <InsightPanel
                        number={12}
                        section="The lines"
                        title="Composition matrix"
                        caption="Odd count against high count. Pink sits above the fair share, blue below it."
                        id="panel-composition"
                        family="Structure"
                        className="lg:col-span-12" layout="split"
                        aside={
                            <div className="min-w-0 max-w-sm">
                                <p className="font-mono text-[9px] leading-3 font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                    furthest from the fair share
                                </p>
                                <ol className="mt-1">
                                    {compositionMisses.map((cell) => (
                                        <li
                                            key={`${cell.odd}-${cell.high}`}
                                            className="flex items-baseline justify-between gap-3 border-b border-line/60 py-0.5 last:border-0"
                                        >
                                            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                                                {cell.odd} odd · {cell.high} high
                                            </span>
                                            <span className="font-mono text-[11px] text-ink tabular-nums">
                                                {cell.delta >= 0 ? "+" : "−"}
                                                {Math.abs(cell.delta).toFixed(1)}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        }
                        stats={[
                            { label: "Above fair share", value: compositionAbove, hint: `of ${composition.length} cells` },
                            { label: "Below fair share", value: composition.length - compositionAbove, hint: `of ${composition.length} cells` },
                            { label: "Cells", value: 49, hint: "odd × high" },
                        ]}
                    >
                        <CompositionMatrix cells={composition} />
                    </InsightPanel>

                    <InsightPanel
                        number={13}
                        section="The lines"
                        title="Delta profile"
                        caption="The gaps between adjacent picks inside a single draw."
                        id="panel-delta"
                        family="Structure"
                        className="lg:col-span-6"
                        stats={[
                            { label: "Mean gap", value: deltas.observedAverage.toFixed(2), hint: "observed" },
                            { label: "Expected", value: deltas.expectedAverage.toFixed(2) },
                            { label: "Most common", value: deltas.rows.reduce((best, row) => (row.count > best.count ? row : best), deltas.rows[0])?.gap ?? "—", hint: "gap size" },
                        ]}
                    >
                        <DeltaProfile stats={deltas} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={14}
                        section="The lines"
                        title="Sorted-position ladder"
                        caption="Where each sorted position lands in the draw. The pale band is the fair-cage range."
                        id="panel-position"
                        family="Structure"
                        className="lg:col-span-6"
                        stats={[
                            { label: "Lowest median", value: positions[0]?.observedMedian.toFixed(0) ?? "—", hint: "position 1" },
                            { label: "Highest median", value: positions[5]?.observedMedian.toFixed(0) ?? "—", hint: "position 6" },
                            { label: "Expected mid", value: positions[2]?.expectedMedian ?? "—", hint: "position 3" },
                        ]}
                    >
                        <PositionLadder rows={positions} className="mt-2" />
                    </InsightPanel>
                </MasonryGrid>
            </section>

            {/* ---------------------------------------------------------------- *
             * The cage — the machine that produced it.
             * ---------------------------------------------------------------- */}
            <section id="the-cage" className="flex flex-col gap-3">
                <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">The cage</h2>
                <MasonryGrid>
                    <InsightPanel
                        number={15}
                        section="The cage"
                        title="Repeaters flow"
                        caption="How many numbers carried over from the previous draw."
                        id="panel-repeaters"
                        family="Pattern"
                        className="lg:col-span-4"
                        stats={[
                            { label: "Observed", value: repeaters.observedAverage.toFixed(2), hint: "repeats per draw" },
                            { label: "Expected", value: repeaters.expectedAverage.toFixed(2) },
                            { label: "Draws tested", value: formatNumber(repeaters.evaluated), hint: "each against the last" },
                        ]}
                    >
                        <RepeatersFlow stats={repeaters} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={16}
                        section="The cage"
                        title="Additional ball"
                        caption="How often each number came up as the seventh ball."
                        id="panel-additional"
                        family="Frequency"
                        className="lg:col-span-8"
                        stats={[
                            { label: "Latest", value: additional.latest ?? "—", hint: additional.latestDate ? formatDate(additional.latestDate) : undefined },
                            { label: "Most seen", value: additional.hottest?.number ?? "—", hint: additional.hottest ? `${formatNumber(additional.hottest.count)} times` : undefined },
                            { label: "Expected", value: additional.expected.toFixed(1), hint: "times per number" },
                        ]}
                    >
                        <AdditionalBall stats={additional} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={17}
                        section="The cage"
                        title="Month of year"
                        caption="Mean sum by calendar month and year, with the draws behind each cell."
                        id="panel-month"
                        family="Almanac & Time"
                        className="lg:col-span-8"
                        stats={[
                            { label: "Warmest month", value: monthExtremes?.highest.month ?? "—", hint: monthExtremes ? `mean ${monthExtremes.highest.mean.toFixed(1)}` : undefined },
                            { label: "Coldest month", value: monthExtremes?.lowest.month ?? "—", hint: monthExtremes ? `mean ${monthExtremes.lowest.mean.toFixed(1)}` : undefined },
                            { label: "Spread", value: months.spread.toFixed(1), hint: "best minus worst" },
                        ]}
                    >
                        <MonthHeatmap stats={months} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={18}
                        section="The cage"
                        title="Weekday"
                        caption="Draws per weekday, with the mean sum above each bar."
                        id="panel-weekday"
                        family="Almanac & Time"
                        className="lg:col-span-4"
                        stats={[
                            { label: "Monday", value: formatNumber(analysis.weekday.Mon?.count ?? 0), hint: "draws" },
                            { label: "Thursday", value: formatNumber(analysis.weekday.Thu?.count ?? 0), hint: "draws" },
                            { label: "Special draws", value: formatNumber(fridayDraws), hint: "on Fridays" },
                        ]}
                    >
                        <WeekdayChart days={weekdayDays} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={19}
                        section="The cage"
                        title="Group 1 by year"
                        caption="Winning tickets per year, with the three biggest jackpots marked in gold."
                        id="panel-jackpot"
                        family="Pari-mutuel"
                        className="lg:col-span-4"
                        stats={[
                            { label: "Total wins", value: formatNumber(group1.totalWins), hint: "Group 1 tickets" },
                            { label: "Biggest", value: `S$${(group1.peak.max / 1_000_000).toFixed(1)}M`, hint: group1.peak.year },
                            { label: "Years", value: group1.years.length, hint: "with a Group 1" },
                        ]}
                    >
                        {/* Taller than the default so the cage's left rail closes level with the right. */}
                        <JackpotTrend stats={group1} height={284} className="mt-2" />
                    </InsightPanel>

                    <InsightPanel
                        number={20}
                        section="The cage"
                        title="Patterns"
                        caption="How often a draw repeats itself."
                        id="panel-patterns"
                        family="Pattern"
                        className="lg:col-span-8"
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <Gauge
                                value={analysis.consecutive.drawRate}
                                display={pct(analysis.consecutive.drawRate)}
                                label="Consecutive"
                                hint="of draws have a run"
                                tone="primary"
                            />
                            <Gauge
                                value={analysis.repeaters.rate}
                                display={pct(analysis.repeaters.rate)}
                                label="Repeats"
                                hint={`${analysis.repeaters.avgCount.toFixed(2)} per draw`}
                                tone="secondary"
                            />
                        </div>
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
                    </InsightPanel>
                </MasonryGrid>
            </section>

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                Every number is equally likely in every draw. The patterns above describe the past and do not predict the next draw. Play for entertainment, never to recover a loss.
            </p>
        </div>
    );
};
