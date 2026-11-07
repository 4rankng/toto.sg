import { useMemo, useState } from "react";
import {
    Activity,
    BarChart01,
    Clock,
    Coins01,
    Hash01,
    Lightning01,
    SearchSm,
} from "@untitledui/icons";
import { Ball } from "@/components/balls";
import { Panel } from "@/components/panel";
import { PageHeader } from "@/components/product/page-header";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { DonutChart, Gauge } from "@/components/product/console-charts";
import { InsightPanel } from "@/components/product/insight-panel";
import { KpiCard } from "@/components/product/kpi-card";
import { MasonryGrid } from "@/components/product/masonry-grid";
import { td, tdNum, th, thNum } from "@/components/product/table";
import {
    AdditionalBall,
    CompositionMatrix,
    DeltaProfile,
    GapVolcano,
    JackpotTrend,
    MonthHeatmap,
    PositionLadder,
    RepeatersFlow,
    StreakRibbons,
    SumTrend,
    TimelineStrip,
} from "@/components/insights-charts";
import {
    ButterflySplitChart,
    ChiSquareScorecard,
    CorrelogramChart,
    ObservedExpectedBarChart,
    PairCorrelationHeatmap,
    SmallCorrelationGrid,
} from "@/components/insights-correlation-charts";
import {
    CountDistributionChart,
    DecadeHeatmap,
    FrequencyChart,
    type HeatmapCell,
    type SumBin,
    SumHistogram,
    WeekdayChart,
} from "@/components/toto-charts";
import {
    type Analysis,
    type Draw,
    drawDecades,
    drawSum,
    formatDate,
    formatNumber,
    formatSigned,
    type StrategiesFile,
    useJson,
} from "@/lib/data";
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
import {
    acValueStats,
    additionalPromotionStats,
    autocorrelationStats,
    bounceBackStats,
    chiSquareAuditStats,
    coldPairStats,
    colorWaveStats,
    digitalRootStats,
    featureCorrelationMatrix,
    loShuLunarStats,
    luckyDigitStats,
    mathSequenceStats,
    mirrorCorrelationStats,
    multiLagOverlapStats,
    neighborLiftStats,
    pairCorrelationMatrix,
    playslipGeometryStats,
    runAnatomyStats,
    spreadStats,
    strategyConsensusStats,
    tailDigitStats,
    tripleStats,
    weekdaySplitStats,
    wuXingStats,
    zodiacStats,
} from "@/lib/insights-correlations";
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

/** The six galleries in reading order with their panels. */
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
            { id: "panel-cold-pairs", label: "Coldest pairs" },
            { id: "panel-triples", label: "Triples" },
            { id: "panel-last-50", label: "Last 50" },
            { id: "panel-bounce-back", label: "Return by skip" },
        ],
    },
    {
        id: "correlations",
        label: "Correlations & lag",
        panels: [
            { id: "panel-pair-correlation", label: "49×49 Pair correlation" },
            { id: "panel-autocorrelation", label: "Autocorrelation" },
            { id: "panel-multi-lag", label: "Multi-lag overlap" },
            { id: "panel-additional-promotion", label: "7th Ball promotion" },
            { id: "panel-neighbors", label: "Neighbor pull" },
            { id: "panel-mirrors", label: "Mirror twins & cermin" },
            { id: "panel-feature-correlation", label: "Feature correlation" },
            { id: "panel-strategy-consensus", label: "Strategy consensus" },
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
            { id: "panel-span", label: "Line span" },
            { id: "panel-ac-value", label: "Complexity (AC)" },
            { id: "panel-tail-digits", label: "Tail digits" },
            { id: "panel-runs", label: "Run anatomy" },
            { id: "panel-playslip-geometry", label: "Playslip geometry" },
            { id: "panel-digital-root", label: "Digital root" },
        ],
    },
    {
        id: "folklore",
        label: "Folklore & sequences",
        panels: [
            { id: "panel-color-waves", label: "Colour waves" },
            { id: "panel-wuxing", label: "Five elements" },
            { id: "panel-zodiac", label: "12 Zodiacs" },
            { id: "panel-lucky-digits", label: "Lucky digits" },
            { id: "panel-math-sequences", label: "Math sequences" },
            { id: "panel-lunar", label: "Lo Shu & Moon" },
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
            { id: "panel-weekday-split", label: "Mon vs Thu" },
            { id: "panel-chi-square", label: "Randomness audit" },
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

    const [activeSection, setActiveSection] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const { data: analysis, isLoading: analysisLoading, error: analysisError } = useJson<Analysis>("/data/analysis.json");
    const { data: draws, isLoading: drawsLoading, error: drawsError } = useJson<Draw[]>("/data/draws.json");
    const { data: league, isLoading: leagueLoading, error: leagueError } = useJson<StrategiesFile>("/data/strategies.json");

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

    /** Standard baseline calculators. */
    const gaps = useMemo(() => (analysis ? gapStats(analysis.lastSeen, analysis.frequency.all) : null), [analysis]);
    const timeline = useMemo(() => timelineWindow(eraDraws, TIMELINE_WINDOW), [eraDraws]);
    const streaks = useMemo(() => streakRows(eraDraws, STREAK_WINDOW), [eraDraws]);
    const sums = useMemo(() => sumTrend(eraDraws, SUM_TREND_WINDOW), [eraDraws]);
    const composition = useMemo(() => compositionMatrix(eraDraws), [eraDraws]);
    const repeaters = useMemo(() => repeaterStats(eraDraws), [eraDraws]);
    const deltas = useMemo(() => deltaStats(eraDraws), [eraDraws]);
    const positions = useMemo(() => positionLadder(eraDraws), [eraDraws]);
    const months = useMemo(() => monthStats(eraDraws), [eraDraws]);
    const additional = useMemo(() => additionalStats(eraDraws), [eraDraws]);
    const group1 = useMemo(() => (analysis ? jackpotStats(analysis.group1ByYear) : null), [analysis]);

    /** New gambler analytics & correlation calculators. */
    const coldPairs = useMemo(() => coldPairStats(eraDraws), [eraDraws]);
    const triples = useMemo(() => tripleStats(eraDraws), [eraDraws]);
    const bounceBack = useMemo(() => bounceBackStats(eraDraws), [eraDraws]);

    const pairCorr = useMemo(() => pairCorrelationMatrix(eraDraws), [eraDraws]);
    const autocorr = useMemo(() => autocorrelationStats(eraDraws), [eraDraws]);
    const multiLag = useMemo(() => multiLagOverlapStats(eraDraws), [eraDraws]);
    const promo = useMemo(() => additionalPromotionStats(eraDraws), [eraDraws]);
    const neighbors = useMemo(() => neighborLiftStats(eraDraws), [eraDraws]);
    const mirrors = useMemo(() => mirrorCorrelationStats(eraDraws), [eraDraws]);
    const featureCorr = useMemo(() => featureCorrelationMatrix(eraDraws), [eraDraws]);
    const stratConsensus = useMemo(() => (league ? strategyConsensusStats(league) : null), [league]);

    const spans = useMemo(() => spreadStats(eraDraws), [eraDraws]);
    const acValues = useMemo(() => acValueStats(eraDraws), [eraDraws]);
    const tailDigits = useMemo(() => tailDigitStats(eraDraws), [eraDraws]);
    const runs = useMemo(() => runAnatomyStats(eraDraws), [eraDraws]);
    const slipGeo = useMemo(() => playslipGeometryStats(eraDraws), [eraDraws]);
    const digiRoots = useMemo(() => digitalRootStats(eraDraws), [eraDraws]);

    const colorWaves = useMemo(() => colorWaveStats(eraDraws), [eraDraws]);
    const wuXing = useMemo(() => wuXingStats(eraDraws), [eraDraws]);
    const zodiacs = useMemo(() => zodiacStats(eraDraws), [eraDraws]);
    const luckyDigits = useMemo(() => luckyDigitStats(eraDraws), [eraDraws]);
    const mathSeqs = useMemo(() => mathSequenceStats(eraDraws), [eraDraws]);
    const loShu = useMemo(() => loShuLunarStats(eraDraws), [eraDraws]);

    const weekdaySplit = useMemo(() => weekdaySplitStats(eraDraws), [eraDraws]);
    const chiSquare = useMemo(() => chiSquareAuditStats(eraDraws), [eraDraws]);

    const compositionMisses = useMemo(() => {
        return [...composition].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
    }, [composition]);

    const compositionAbove = useMemo(() => composition.filter((cell) => cell.delta > 0).length, [composition]);

    const monthExtremes = useMemo(() => {
        const withDraws = months.monthlyMean.filter((row) => row.draws > 0);
        if (withDraws.length === 0) return null;
        return {
            highest: [...withDraws].sort((a, b) => b.mean - a.mean)[0],
            lowest: [...withDraws].sort((a, b) => a.mean - b.mean)[0],
        };
    }, [months]);

    if (analysisLoading || drawsLoading || leagueLoading) return <InsightsSkeleton />;

    if (analysisError || drawsError || leagueError || !analysis || !draws || !league || !gaps || !group1 || !stratConsensus) {
        return (
            <Panel title="Statistics unavailable" description={analysisError?.message ?? drawsError?.message ?? leagueError?.message ?? "An analysis file is missing."}>
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

    /** Query-filtered panels check. */
    const isVisible = (panelId: string, sectionId: string) => {
        if (activeSection !== "all" && activeSection !== sectionId) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const p = PANEL_INDEX.find((x) => x.id === panelId);
        return p ? p.label.toLowerCase().includes(q) || panelId.toLowerCase().includes(q) : true;
    };

    return (
        <div className="flex flex-col gap-3">
            <PageHeader
                kicker="Analytics & Correlation"
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
                        <span aria-hidden="true">·</span>
                        <span>50 analytics panels</span>
                    </>
                }
                description={""}
            />

            {/* The headline numbers: 8 console KPI cards. */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard label="Draws" value={formatNumber(total)} hint="6/49 era" icon={Hash01} tone="primary" />
                <KpiCard label="Mean sum" value={analysis.sum.mean.toFixed(1)} hint={`median ${analysis.sum.median}`} icon={BarChart01} tone="secondary" />
                <KpiCard label="Most seen" value={hot?.number ?? "—"} hint={hot ? `${formatNumber(hot.count)} draws` : undefined} icon={Lightning01} tone="gold" />
                <KpiCard label="Least seen" value={cold?.number ?? "—"} hint={cold ? `${formatNumber(cold.count)} draws` : undefined} icon={Activity} tone="neutral" />
                <KpiCard label="Overdue" value={gaps.overdueCount} hint="of 49 numbers" icon={Clock} tone="primary" />
                <KpiCard label="Top jackpot" value={`S$${(group1.peak.max / 1_000_000).toFixed(1)}M`} hint={`${group1.peak.year} · biggest`} icon={Coins01} tone="gold" />
                
                
            </div>

            {/* The interactive gallery navigation bar with search and pills. */}
            <nav aria-label="Insights sections" className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setActiveSection("all")}
                            className={cx(
                                "cursor-pointer shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100",
                                activeSection === "all"
                                    ? "bg-primary-soft text-primary border border-primary-line"
                                    : "border border-line bg-surface-2 text-ink-muted hover:text-ink hover:border-line-strong",
                            )}
                        >
                            All 50 Panels
                        </button>
                        {SECTIONS.map((section) => (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => setActiveSection(section.id)}
                                className={cx(
                                    "cursor-pointer shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors duration-100",
                                    activeSection === section.id
                                        ? "bg-primary-soft text-primary border border-primary-line"
                                        : "border border-line bg-surface-2 text-ink-muted hover:text-ink hover:border-line-strong",
                                )}
                            >
                                {section.label} ({section.panels.length})
                            </button>
                        ))}
                    </div>

                    <div className="relative min-w-44 max-w-xs">
                        <SearchSm className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-subtle" />
                        <input
                            type="text"
                            placeholder="Filter panels..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-md border border-line bg-surface-inset py-1 pl-8 pr-2 text-xs text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                        />
                    </div>
                </div>

                <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto border-t border-line/60 pt-2">
                    {PANEL_INDEX.filter((p) => !searchQuery || p.label.toLowerCase().includes(searchQuery.toLowerCase())).map((panel) => (
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
             * 1. The numbers — what each of the 49 has been doing.
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "the-numbers") && (
                <section id="the-numbers" className="flex flex-col gap-3">
                    <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">1. The numbers</h2>
                    <MasonryGrid>
                        {isVisible("panel-frequency", "the-numbers") && (
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
                        )}

                        {isVisible("panel-gap-tracker", "the-numbers") && (
                            <InsightPanel
                                number={2}
                                section="The numbers"
                                title="Gap tracker"
                                caption="Draws since each number last came up"
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
                        )}

                        {isVisible("panel-timeline", "the-numbers") && (
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
                        )}

                        {isVisible("panel-streaks", "the-numbers") && (
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
                        )}

                        {isVisible("panel-decades", "the-numbers") && (
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
                        )}

                        {isVisible("panel-pairs", "the-numbers") && (
                            <InsightPanel
                                number={6}
                                section="The numbers"
                                title="Most common pairs"
                                caption="The 10 pairs that appeared in the same draw most often."
                                id="panel-pairs"
                                family="Pairs"
                                className="lg:col-span-6"
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
                        )}

                        {isVisible("panel-cold-pairs", "the-numbers") && (
                            <InsightPanel
                                number={7}
                                section="The numbers"
                                title="Coldest & missing pairs"
                                caption="The pairs that rarely or haven't appeared together for the longest absence."
                                id="panel-cold-pairs"
                                family="Pairs"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Coldest", value: `${coldPairs.coldest[0]?.a}–${coldPairs.coldest[0]?.b}`, hint: `${coldPairs.coldest[0]?.count} hits` },
                                    { label: "Longest gap", value: `${coldPairs.longestMissing[0]?.gap} draws`, hint: `Pair ${coldPairs.longestMissing[0]?.a}–${coldPairs.longestMissing[0]?.b}` },
                                    { label: "Pair cycle", value: `${coldPairs.expectedCycle.toFixed(1)} draws`, hint: "expected" },
                                ]}
                            >
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr>
                                            <th className={cx(th, "static")}>Longest Missing</th>
                                            <th className={cx(thNum, "static")}>Gap</th>
                                            <th className={cx(th, "static")}>Coldest Pair</th>
                                            <th className={cx(thNum, "static")}>Hits</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {coldPairs.longestMissing.slice(0, 5).map((p, i) => (
                                            <tr key={`cold-${p.a}-${p.b}`}>
                                                <td className={td}>
                                                    <span className="font-mono text-ink tabular-nums">{p.a} – {p.b}</span>
                                                </td>
                                                <td className={tdNum}>{p.gap}d</td>
                                                <td className={td}>
                                                    <span className="font-mono text-ink tabular-nums">
                                                        {coldPairs.coldest[i]?.a} – {coldPairs.coldest[i]?.b}
                                                    </span>
                                                </td>
                                                <td className={tdNum}>{coldPairs.coldest[i]?.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </InsightPanel>
                        )}

                        {isVisible("panel-triples", "the-numbers") && (
                            <InsightPanel
                                number={8}
                                section="The numbers"
                                title="Most common triples"
                                caption="3-number combinations sharing the same draw most often"
                                id="panel-triples"
                                family="Pairs"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top triple", value: triples.topTriples[0] ? `${triples.topTriples[0].a}-${triples.topTriples[0].b}-${triples.topTriples[0].c}` : "—", hint: `${triples.topTriples[0]?.count} times` },
                                    { label: "Expected", value: triples.expectedMeetings.toFixed(2), hint: "meetings" },
                                    { label: "Triples pool", value: formatNumber(triples.totalTriplesInPool), hint: "C(49, 3)" },
                                ]}
                            >
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr>
                                            <th className={cx(th, "static w-10")}>#</th>
                                            <th className={cx(th, "static")}>Triple</th>
                                            <th className={cx(thNum, "static")}>Draws</th>
                                            <th className={cx(thNum, "static")}>vs Exp ({triples.expectedMeetings.toFixed(1)})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {triples.topTriples.slice(0, 6).map((t, idx) => (
                                            <tr key={`${t.a}-${t.b}-${t.c}`}>
                                                <td className={tdNum}>{idx + 1}</td>
                                                <td className={td}>
                                                    <span className="font-mono text-ink tabular-nums">{t.a} – {t.b} – {t.c}</span>
                                                </td>
                                                <td className={tdNum}>{t.count}</td>
                                                <td className={cx(tdNum, "text-up")}>+{(t.count - triples.expectedMeetings).toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </InsightPanel>
                        )}

                        {isVisible("panel-last-50", "the-numbers") && (
                            <InsightPanel
                                number={9}
                                section="The numbers"
                                title="Last 50 vs all time"
                                caption={`Appearances in the last ${RECENT_WINDOW} draws against ${movement.expected.toFixed(1)} expected.`}
                                id="panel-last-50"
                                family="Hot & Cold"
                                className="lg:col-span-6"
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
                        )}

                        {isVisible("panel-bounce-back", "the-numbers") && (
                            <InsightPanel
                                number={10}
                                section="The numbers"
                                title="Return rate by skip (Bounce-back)"
                                caption="Empirical probability P(hit | current skip band)."
                                id="panel-bounce-back"
                                family="Gap & Due"
                                className="lg:col-span-12"
                                stats={[
                                    { label: "Hottest skip", value: bounceBack.hottestBand, hint: "highest return rate" },
                                    { label: "Base rate", value: "12.24%", hint: "6 / 49 null" },
                                    { label: "Coldest skip", value: bounceBack.coldestBand, hint: "lowest return rate" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={bounceBack.buckets.map((b) => ({
                                        label: b.band,
                                        observedValue: b.hitRate * 100,
                                        expectedValue: b.expectedRate * 100,
                                        formattedObserved: `${(b.hitRate * 100).toFixed(1)}% (${b.hits}/${b.trials})`,
                                        formattedExpected: `${(b.expectedRate * 100).toFixed(1)}%`,
                                        tone: b.hitRate >= b.expectedRate ? "primary" : "secondary",
                                    }))}
                                    maxValue={18}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}
                    </MasonryGrid>
                </section>
            )}

            {/* ---------------------------------------------------------------- *
             * 2. Correlations & lag
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "correlations") && (
                <section id="correlations" className="flex flex-col gap-3">
                    <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">2. Correlations & lag</h2>
                    <MasonryGrid>
                        {isVisible("panel-pair-correlation", "correlations") && (
                            <InsightPanel
                                number={11}
                                section="Correlations"
                                title="49×49 Pair correlation matrix"
                                caption="Standardized residual z-scores for all 1,176 pairs: pink sits above chance, blue below."
                                id="panel-pair-correlation"
                                family="Pairs"
                                className="lg:col-span-12"
                                layout="split"
                                aside={
                                    <div className="flex flex-col gap-2 text-xs">
                                        <p className="font-mono text-[9px] font-semibold tracking-wider text-ink-subtle uppercase">Strongest positive pairs</p>
                                        <ol className="space-y-1">
                                            {pairCorr.topPositive.map((p) => (
                                                <li key={`${p.a}-${p.b}`} className="flex justify-between border-b border-line/60 pb-0.5">
                                                    <span className="font-mono text-ink">{p.a} – {p.b}</span>
                                                    <span className="font-mono text-up">{formatSigned(p.zScore, 2)}σ ({p.count}x)</span>
                                                </li>
                                            ))}
                                        </ol>
                                        <p className="font-mono text-[9px] font-semibold tracking-wider text-ink-subtle uppercase mt-2">Strongest negative pairs</p>
                                        <ol className="space-y-1">
                                            {pairCorr.topNegative.map((p) => (
                                                <li key={`neg-${p.a}-${p.b}`} className="flex justify-between border-b border-line/60 pb-0.5">
                                                    <span className="font-mono text-ink">{p.a} – {p.b}</span>
                                                    <span className="font-mono text-down">{formatSigned(p.zScore, 2)}σ ({p.count}x)</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                }
                                stats={[
                                    { label: "Max z-score", value: `+${pairCorr.maxZ.toFixed(2)}σ`, hint: "strongest affinity" },
                                    { label: "Min z-score", value: `${pairCorr.minZ.toFixed(2)}σ`, hint: "strongest repulsion" },
                                    { label: "Mean |z|", value: `${pairCorr.meanAbsZ.toFixed(2)}σ`, hint: "overall deviation" },
                                ]}
                            >
                                <PairCorrelationHeatmap stats={pairCorr} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-autocorrelation", "correlations") && (
                            <InsightPanel
                                number={12}
                                section="Correlations"
                                title="Draw autocorrelation (Lags 1–20)"
                                caption="Correlation of draw sum with previous draws up to 20 draws back."
                                id="panel-autocorrelation"
                                family="Momentum"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Lag 1 r", value: formatSigned(autocorr.lags[0]?.rSum ?? 0, 3), hint: "sum vs prev draw" },
                                    { label: "Max |r|", value: autocorr.maxAbsR.toFixed(3), hint: `at lag ${autocorr.highestLag.lag}` },
                                    { label: "95% Bound", value: `±${autocorr.bound95.toFixed(3)}`, hint: "white-noise threshold" },
                                ]}
                            >
                                <CorrelogramChart stats={autocorr} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-multi-lag", "correlations") && (
                            <InsightPanel
                                number={13}
                                section="Correlations"
                                title="Multi-lag carry-over decay"
                                caption="Mean count of numbers repeating from draws 1 to 12 steps back vs expected 0.735."
                                id="panel-multi-lag"
                                family="Sequence"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Lag 1 repeat", value: multiLag.rows[0]?.meanRepeats.toFixed(3) ?? "—", hint: "vs 0.735 expected" },
                                    { label: "2-Draw Union", value: `${multiLag.twoDrawUnionHits.toFixed(2)} hits`, hint: `vs ${multiLag.expectedTwoDrawUnion.toFixed(2)} exp` },
                                    { label: "3-Draw Union", value: `${multiLag.threeDrawUnionHits.toFixed(2)} hits`, hint: `vs ${multiLag.expectedThreeDrawUnion.toFixed(2)} exp` },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={multiLag.rows.map((r) => ({
                                        label: `L${r.lag}`,
                                        observedValue: r.meanRepeats,
                                        expectedValue: r.expectedRepeats,
                                        formattedObserved: `${r.meanRepeats.toFixed(3)} hits`,
                                        formattedExpected: `${r.expectedRepeats.toFixed(3)} exp`,
                                    }))}
                                    maxValue={1.1}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-additional-promotion", "correlations") && (
                            <InsightPanel
                                number={14}
                                section="Correlations"
                                title="7th Ball promotion rate"
                                caption="How often the previous draw's additional ball is drawn as a main winning number in the next draw."
                                id="panel-additional-promotion"
                                family="Frequency"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Lag 1 rate", value: `${(promo.lag1Rate * 100).toFixed(1)}%`, hint: "observed" },
                                    { label: "Expected", value: `${(promo.expectedRate * 100).toFixed(1)}%`, hint: "6 / 49 chance" },
                                    { label: "Top promoted", value: promo.topPromotedNumber ? `Ball ${promo.topPromotedNumber.number}` : "—", hint: `${promo.topPromotedNumber?.count} times` },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={promo.rows.slice(0, 8).map((r) => ({
                                        label: `Lag ${r.lag}`,
                                        observedValue: r.promotionRate * 100,
                                        expectedValue: r.expectedRate * 100,
                                        formattedObserved: `${(r.promotionRate * 100).toFixed(1)}% (${r.promotedCount})`,
                                        formattedExpected: `${(r.expectedRate * 100).toFixed(1)}%`,
                                        tone: "secondary",
                                    }))}
                                    maxValue={20}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-neighbors", "correlations") && (
                            <InsightPanel
                                number={15}
                                section="Correlations"
                                title="Neighbor pull (±1, ±2)"
                                caption="Hits landed on numbers immediately adjacent to the previous draw's winning balls."
                                id="panel-neighbors"
                                family="Sequence"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "±1 Halo hits", value: neighbors.plusMinus1Hits.toFixed(2), hint: `exp ${neighbors.expectedPlusMinus1.toFixed(2)}` },
                                    { label: "±1 Lift", value: `${neighbors.lift1.toFixed(2)}x`, hint: "observed / expected" },
                                    { label: "±2 Lift", value: `${neighbors.lift2.toFixed(2)}x`, hint: "observed / expected" },
                                ]}
                            >
                                <div className="grid grid-cols-2 gap-3 p-2">
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface-2 p-3 text-center">
                                        <p className="text-[10px] font-semibold text-ink-subtle uppercase">±1 Adjacent Halo</p>
                                        <p className="mt-1 font-mono text-2xl font-bold text-primary">{neighbors.lift1.toFixed(3)}x</p>
                                        <p className="text-[11px] text-ink-muted mt-1">{neighbors.plusMinus1Hits.toFixed(2)} hits vs {neighbors.expectedPlusMinus1.toFixed(2)} exp</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface-2 p-3 text-center">
                                        <p className="text-[10px] font-semibold text-ink-subtle uppercase">±2 Wide Halo</p>
                                        <p className="mt-1 font-mono text-2xl font-bold text-secondary">{neighbors.lift2.toFixed(3)}x</p>
                                        <p className="text-[11px] text-ink-muted mt-1">{neighbors.plusMinus2Hits.toFixed(2)} hits vs {neighbors.expectedPlusMinus2.toFixed(2)} exp</p>
                                    </div>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-mirrors", "correlations") && (
                            <InsightPanel
                                number={16}
                                section="Correlations"
                                title="Mirror twins (50−n) & Bolak-Balik"
                                caption="Symmetric pairs (n + m = 50) and Indonesian Togel digit swaps (cermin)."
                                id="panel-mirrors"
                                family="Folk & Culture"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Same-draw mirror", value: mirrors.sameDrawMirrorPairs.toFixed(3), hint: `exp ${mirrors.expectedSameDrawMirror.toFixed(3)}` },
                                    { label: "Lag 1 mirror", value: mirrors.lag1MirrorHits.toFixed(3), hint: `exp ${mirrors.expectedLag1Mirror.toFixed(3)}` },
                                    { label: "Top pair", value: mirrors.topMirrorPair ? `${mirrors.topMirrorPair.a}–${mirrors.topMirrorPair.b}` : "—", hint: `${mirrors.topMirrorPair?.count} draws` },
                                ]}
                            >
                                <div className="space-y-2 p-2">
                                    <div className="flex justify-between items-center border-b border-line pb-1.5 text-xs">
                                        <span className="text-ink">Same-draw (50−n) pairs</span>
                                        <span className="font-mono text-ink-muted">{mirrors.sameDrawMirrorPairs.toFixed(3)} / draw (exp {mirrors.expectedSameDrawMirror.toFixed(3)})</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-line pb-1.5 text-xs">
                                        <span className="text-ink">Carry-over of (50−n) at Lag 1</span>
                                        <span className="font-mono text-ink-muted">{mirrors.lag1MirrorHits.toFixed(3)} / draw (exp {mirrors.expectedLag1Mirror.toFixed(3)})</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-ink">Bolak-Balik (12↔21, etc.)</span>
                                        <span className="font-mono text-ink-muted">{mirrors.bolakBalikPairsSeen} times (exp {mirrors.expectedBolakBalik.toFixed(1)})</span>
                                    </div>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-feature-correlation", "correlations") && (
                            <InsightPanel
                                number={17}
                                section="Correlations"
                                title="Within-draw feature correlation"
                                caption="Pearson correlation r between structural properties of the same draw."
                                id="panel-feature-correlation"
                                family="Structure"
                                className="lg:col-span-6"
                            >
                                <SmallCorrelationGrid labels={featureCorr.features} matrix={featureCorr.matrix} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-strategy-consensus", "correlations") && (
                            <InsightPanel
                                number={18}
                                section="Correlations"
                                title="204-Strategy consensus & family z-score"
                                caption="Wisdom of the crowd across 204 strategies, and mean z-score walk-forward performance by family."
                                id="panel-strategy-consensus"
                                family="Ensemble"
                                className="lg:col-span-12"
                                layout="split"
                                aside={
                                    <div className="text-xs space-y-2">
                                        <p className="font-mono text-[9px] font-semibold text-ink-subtle uppercase">Top crowd-picked balls</p>
                                        <div className="flex flex-wrap gap-1">
                                            {stratConsensus.topVoted.map((b) => (
                                                <span key={b.number} className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink">
                                                    Ball {b.number} <span className="text-primary font-bold">({b.votes})</span>
                                                </span>
                                            ))}
                                        </div>
                                        <p className="font-mono text-[9px] font-semibold text-ink-subtle uppercase mt-2">Least crowd-picked balls</p>
                                        <div className="flex flex-wrap gap-1">
                                            {stratConsensus.leastVoted.map((b) => (
                                                <span key={b.number} className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                                                    Ball {b.number} ({b.votes})
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                }
                                stats={[
                                    { label: "Top family", value: stratConsensus.familyScores[0]?.family ?? "—", hint: `mean score ${stratConsensus.familyScores[0]?.meanScore.toFixed(1)}` },
                                    { label: "Best z-score", value: `+${stratConsensus.familyScores[0]?.meanZ.toFixed(2)}σ`, hint: stratConsensus.familyScores[0]?.bestStrategy },
                                    { label: "Total families", value: stratConsensus.familyScores.length, hint: "204 rules scored" },
                                ]}
                            >
                                <ButterflySplitChart
                                    rows={stratConsensus.familyScores.slice(0, 10).map((f) => ({
                                        label: f.family,
                                        value: f.meanZ,
                                        subLabel: `best: ${f.bestStrategy}`,
                                    }))}
                                    centerLabel="0.0σ"
                                    maxAbs={1.2}
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}
                    </MasonryGrid>
                </section>
            )}

            {/* ---------------------------------------------------------------- *
             * 3. The lines — the shape of a single draw.
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "the-lines") && (
                <section id="the-lines" className="flex flex-col gap-3">
                    <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">3. The lines</h2>
                    <MasonryGrid>
                        {isVisible("panel-sum", "the-lines") && (
                            <InsightPanel
                                number={19}
                                section="The lines"
                                title="Sum of the six numbers"
                                caption="How often each total came up, in bands of ten. Shaded band holds most draws."
                                id="panel-sum"
                                family="Sum Band"
                                className="lg:col-span-6"
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
                        )}

                        {isVisible("panel-sum-trend", "the-lines") && (
                            <InsightPanel
                                number={20}
                                section="The lines"
                                title="Sum trend"
                                caption={`Rolling ${SUM_TREND_WINDOW}-draw mean of the draw sum.`}
                                id="panel-sum-trend"
                                family="Momentum"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Era mean", value: analysis.sum.mean.toFixed(1), hint: "all draws" },
                                    { label: "Band", value: `${band.lo}–${band.hi}`, hint: "most draws" },
                                    { label: "Longest run", value: formatNumber(analysis.consecutive.drawRate * total), hint: "draws with a pair" },
                                ]}
                            >
                                <SumTrend points={sums} band={{ lo: band.lo, hi: band.hi }} mean={analysis.sum.mean} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-odd", "the-lines") && (
                            <InsightPanel
                                number={21}
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
                        )}

                        {isVisible("panel-low", "the-lines") && (
                            <InsightPanel
                                number={22}
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
                        )}

                        {isVisible("panel-composition", "the-lines") && (
                            <InsightPanel
                                number={23}
                                section="The lines"
                                title="Composition matrix"
                                caption="Odd count against high count. Pink sits above the fair share, blue below it."
                                id="panel-composition"
                                family="Structure"
                                className="lg:col-span-12"
                                layout="split"
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
                        )}

                        {isVisible("panel-delta", "the-lines") && (
                            <InsightPanel
                                number={24}
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
                        )}

                        {isVisible("panel-position", "the-lines") && (
                            <InsightPanel
                                number={25}
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
                        )}

                        {isVisible("panel-span", "the-lines") && (
                            <InsightPanel
                                number={26}
                                section="The lines"
                                title="Line span (max − min)"
                                caption="Difference between the highest and lowest winning ball."
                                id="panel-span"
                                family="Structure"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Observed mean", value: spans.observedMean.toFixed(1), hint: "span size" },
                                    { label: "Expected mean", value: spans.expectedMean.toFixed(1), hint: "theory 35.7" },
                                    { label: "Modal span", value: spans.mostCommonSpan, hint: "most frequent" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={spans.rows.filter((r) => r.span >= 20 && r.span % 3 === 0).map((r) => ({
                                        label: `${r.span}`,
                                        observedValue: r.share * 100,
                                        expectedValue: r.expectedShare * 100,
                                        formattedObserved: `${(r.share * 100).toFixed(1)}% (${r.count})`,
                                        formattedExpected: `${(r.expectedShare * 100).toFixed(1)}%`,
                                    }))}
                                    maxValue={8}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-ac-value", "the-lines") && (
                            <InsightPanel
                                number={27}
                                section="The lines"
                                title="Arithmetic Complexity (AC value)"
                                caption="Distinct differences among picks minus 5. Values 7–9 hold 80%+ of random draws."
                                id="panel-ac-value"
                                family="Structure"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Observed mean", value: acValues.observedMean.toFixed(2), hint: "AC value" },
                                    { label: "Expected mean", value: acValues.expectedMean.toFixed(2), hint: "theory 8.16" },
                                    { label: "AC ≥ 7 share", value: `${(acValues.rateAbove6 * 100).toFixed(1)}%`, hint: "complex lines" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={acValues.rows.map((r) => ({
                                        label: `AC ${r.ac}`,
                                        observedValue: r.share * 100,
                                        expectedValue: r.expectedShare * 100,
                                        formattedObserved: `${(r.share * 100).toFixed(1)}% (${r.count})`,
                                        formattedExpected: `${(r.expectedShare * 100).toFixed(1)}%`,
                                        tone: r.ac >= 7 ? "primary" : "secondary",
                                    }))}
                                    maxValue={40}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-tail-digits", "the-lines") && (
                            <InsightPanel
                                number={28}
                                section="The lines"
                                title="Tail digits & distinct endings"
                                caption="Frequency of last digits (0–9) and how many distinct endings occur per draw."
                                id="panel-tail-digits"
                                family="Structure"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top tail", value: `Ending in ${tailDigits.mostCommonTail}`, hint: "most frequent" },
                                    { label: "Modal distinct", value: "5 endings", hint: "43% of draws" },
                                    { label: "Digit 0 pool", value: "4 balls", hint: "vs 5 for 1–9" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={tailDigits.distinctTailCounts.map((r) => ({
                                        label: `${r.distinct} Endings`,
                                        observedValue: r.share * 100,
                                        expectedValue: r.expectedShare * 100,
                                        formattedObserved: `${(r.share * 100).toFixed(1)}% (${r.count})`,
                                        formattedExpected: `${(r.expectedShare * 100).toFixed(1)}%`,
                                    }))}
                                    maxValue={50}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-runs", "the-lines") && (
                            <InsightPanel
                                number={29}
                                section="The lines"
                                title="Run anatomy & arithmetic progressions"
                                caption="Consecutive pair occurrences (50% have none, 40% have one) and 3-term AP sequences."
                                id="panel-runs"
                                family="Structure"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Triple run", value: `${runs.tripleConsecutiveDraws} draws`, hint: `exp ${runs.expectedTripleConsecutive.toFixed(0)}` },
                                    { label: "3-Term AP", value: `${((runs.ap3Draws / total) * 100).toFixed(1)}%`, hint: `exp ${((runs.expectedAp3 / total) * 100).toFixed(1)}%` },
                                    { label: "No adjacent", value: `${(runs.adjacentPairCounts[0].share * 100).toFixed(1)}%`, hint: "of all draws" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={runs.adjacentPairCounts.map((r) => ({
                                        label: r.label,
                                        observedValue: r.share * 100,
                                        expectedValue: r.expectedShare * 100,
                                        formattedObserved: `${(r.share * 100).toFixed(1)}% (${r.count})`,
                                        formattedExpected: `${(r.expectedShare * 100).toFixed(1)}%`,
                                        tone: r.pairs === 0 ? "secondary" : "primary",
                                    }))}
                                    maxValue={60}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-playslip-geometry", "the-lines") && (
                            <InsightPanel
                                number={30}
                                section="The lines"
                                title="7×7 Playslip geometry"
                                caption="Observed hits on slip diagonals, 4 corners, and center cross vs fair expectation."
                                id="panel-playslip-geometry"
                                family="Pattern"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Diagonal hit", value: `${(slipGeo.diagonalHits[0].observedRate * 100).toFixed(1)}%`, hint: `exp ${(slipGeo.diagonalHits[0].expectedRate * 100).toFixed(1)}%` },
                                    { label: "Corners hit", value: `${(slipGeo.diagonalHits[2].observedRate * 100).toFixed(1)}%`, hint: `exp ${(slipGeo.diagonalHits[2].expectedRate * 100).toFixed(1)}%` },
                                    { label: "Cross hit", value: `${(slipGeo.diagonalHits[3].observedRate * 100).toFixed(1)}%`, hint: `exp ${(slipGeo.diagonalHits[3].expectedRate * 100).toFixed(1)}%` },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={slipGeo.diagonalHits.map((h) => ({
                                        label: h.name,
                                        observedValue: h.observedRate,
                                        expectedValue: h.expectedRate,
                                        formattedObserved: `${h.observedRate.toFixed(2)} hits/draw`,
                                        formattedExpected: `${h.expectedRate.toFixed(2)} exp`,
                                    }))}
                                    maxValue={2.0}
                                    orientation="horizontal"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-digital-root", "the-lines") && (
                            <InsightPanel
                                number={31}
                                section="The lines"
                                title="Digital root & mod 9 balance"
                                caption="Sum digital root (1–9) and ball mod 9 residue shares vs uniform 11.1% expectation."
                                id="panel-digital-root"
                                family="Sum Band"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Modal root", value: `Root ${digiRoots.modalRoot}`, hint: "most frequent" },
                                    { label: "Expected share", value: "11.1%", hint: "1 in 9" },
                                    { label: "Pool residue", value: "Balanced", hint: "5 or 6 balls each" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={digiRoots.roots.map((r) => ({
                                        label: `Root ${r.root}`,
                                        observedValue: r.share * 100,
                                        expectedValue: r.expectedShare * 100,
                                        formattedObserved: `${(r.share * 100).toFixed(1)}% (${r.count})`,
                                        formattedExpected: "11.1%",
                                        tone: "primary",
                                    }))}
                                    maxValue={18}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}
                    </MasonryGrid>
                </section>
            )}

            {/* ---------------------------------------------------------------- *
             * 4. Folklore & sequences
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "folklore") && (
                <section id="folklore" className="flex flex-col gap-3">
                    <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">4. Folklore & sequences</h2>
                    <MasonryGrid>
                        {isVisible("panel-color-waves", "folklore") && (
                            <InsightPanel
                                number={32}
                                section="Folklore"
                                title="Mark Six colour waves (紅藍綠波)"
                                caption="Red wave (17 balls), Blue wave (16 balls) and Green wave (16 balls) hit counts."
                                id="panel-color-waves"
                                family="Mark Six Charts"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Red balls", value: "17", hint: "expected 2.08" },
                                    { label: "Blue balls", value: "16", hint: "expected 1.96" },
                                    { label: "Green balls", value: "16", hint: "expected 1.96" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={colorWaves.waves.map((w) => ({
                                        label: w.name,
                                        observedValue: w.observedHits,
                                        expectedValue: w.expectedHits,
                                        formattedObserved: `${w.observedHits.toFixed(2)} hits/draw`,
                                        formattedExpected: `${w.expectedHits.toFixed(2)} exp`,
                                    }))}
                                    maxValue={2.5}
                                    orientation="horizontal"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-wuxing", "folklore") && (
                            <InsightPanel
                                number={33}
                                section="Folklore"
                                title="2026 Na-Yin Five Elements (五行)"
                                caption="Bing-Wu Fire Horse element sets (Metal, Wood, Water, Fire, Earth) vs fair share."
                                id="panel-wuxing"
                                family="Mark Six Charts"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Fire (火)", value: `${wuXing.elements[0].balls} balls`, hint: `${wuXing.elements[0].observedRate.toFixed(2)} hits` },
                                    { label: "Metal (金)", value: `${wuXing.elements[1].balls} balls`, hint: `${wuXing.elements[1].observedRate.toFixed(2)} hits` },
                                    { label: "Water (水)", value: `${wuXing.elements[2].balls} balls`, hint: `${wuXing.elements[2].observedRate.toFixed(2)} hits` },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={wuXing.elements.map((e) => ({
                                        label: e.name,
                                        observedValue: e.observedRate,
                                        expectedValue: e.expectedRate,
                                        formattedObserved: `${e.observedRate.toFixed(2)} hits/draw`,
                                        formattedExpected: `${e.expectedRate.toFixed(2)} exp`,
                                    }))}
                                    maxValue={1.8}
                                    orientation="horizontal"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-zodiac", "folklore") && (
                            <InsightPanel
                                number={34}
                                section="Folklore"
                                title="12 Zodiac / Togel Shio columns"
                                caption="Zodiac columns (Horse holds 5 balls in 2026; others hold 4) vs fair share."
                                id="panel-zodiac"
                                family="Folk & Culture"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Zodiac", value: zodiacs.topAnimal, hint: "highest hits" },
                                    { label: "Horse (马)", value: "5 balls", hint: "ruling year" },
                                    { label: "Clash Rat (鼠)", value: "4 balls", hint: "clash animal" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={zodiacs.zodiacs.map((z) => ({
                                        label: z.animal.split(" ")[0],
                                        observedValue: z.observedHits,
                                        expectedValue: z.expectedHits,
                                        formattedObserved: `${z.observedHits.toFixed(2)} hits`,
                                        formattedExpected: `${z.expectedHits.toFixed(2)} exp`,
                                    }))}
                                    maxValue={0.9}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-lucky-digits", "folklore") && (
                            <InsightPanel
                                number={35}
                                section="Folklore"
                                title="Lucky digits vs Tetraphobia (4)"
                                caption="Cage hit rates and Group 3 payout impact for Asian folklore numbers."
                                id="panel-lucky-digits"
                                family="Folk & Culture"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Digit 4 Payout", value: `S$${Math.round(luckyDigits.digit4Stats.meanG3)}`, hint: "Tetraphobia" },
                                    { label: "Digit 8 Payout", value: `S$${Math.round(luckyDigits.digit8Stats.meanG3)}`, hint: "Cantonese Fa" },
                                    { label: "Digit 4 Delta", value: `+S$${Math.round(luckyDigits.digit4Stats.meanG3 - luckyDigits.digit8Stats.meanG3)}`, hint: "4 pays higher!" },
                                ]}
                            >
                                <div className="space-y-2 p-2">
                                    {[luckyDigits.digit4Stats, luckyDigits.digit8Stats, luckyDigits.digit7Stats, luckyDigits.repdigitsStats].map((st) => (
                                        <div key={st.name} className="flex justify-between items-center border-b border-line pb-1 text-xs">
                                            <span className="text-ink">{st.name} ({st.balls} balls)</span>
                                            <div className="font-mono text-right">
                                                <span className="text-ink font-semibold">S${Math.round(st.meanG3)}</span>
                                                <span className="text-ink-subtle ml-2">({st.observedRate.toFixed(2)} hits vs {st.expectedRate.toFixed(2)} exp)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-math-sequences", "folklore") && (
                            <InsightPanel
                                number={36}
                                section="Folklore"
                                title="Math sequences (Primes, Fib, Squares)"
                                caption="Appearances of famous sequences in TOTO draws vs expected random density."
                                id="panel-math-sequences"
                                family="Sequences"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Primes (15)", value: `${mathSeqs.sequences[0].observedRate.toFixed(2)} hits`, hint: `exp ${mathSeqs.sequences[0].expectedRate.toFixed(2)}` },
                                    { label: "Fibonacci (8)", value: `${mathSeqs.sequences[1].observedRate.toFixed(2)} hits`, hint: `exp ${mathSeqs.sequences[1].expectedRate.toFixed(2)}` },
                                    { label: "Squares (7)", value: `${mathSeqs.sequences[2].observedRate.toFixed(2)} hits`, hint: `exp ${mathSeqs.sequences[2].expectedRate.toFixed(2)}` },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={mathSeqs.sequences.map((s) => ({
                                        label: s.name,
                                        observedValue: s.observedRate,
                                        expectedValue: s.expectedRate,
                                        formattedObserved: `${s.observedRate.toFixed(2)} hits/draw`,
                                        formattedExpected: `${s.expectedRate.toFixed(2)} exp`,
                                    }))}
                                    maxValue={2.2}
                                    orientation="horizontal"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-lunar", "folklore") && (
                            <InsightPanel
                                number={37}
                                section="Folklore"
                                title="Lo Shu 9-palace & Moon phases"
                                caption="Lo Shu magic square palace density and mean sum by astronomical synodic moon phase."
                                id="panel-lunar"
                                family="Almanac & Time"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Full Moon sum", value: loShu.moonPhases[4]?.meanSum.toFixed(1) ?? "—", hint: "vs 150 exp" },
                                    { label: "New Moon sum", value: loShu.moonPhases[0]?.meanSum.toFixed(1) ?? "—", hint: "vs 150 exp" },
                                    { label: "Lunar Cycle", value: "29.53 days", hint: "synodic period" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={loShu.moonPhases.map((m) => ({
                                        label: m.phase.split(" ")[0],
                                        observedValue: m.meanSum,
                                        expectedValue: 150,
                                        formattedObserved: `Sum ${m.meanSum.toFixed(1)} (${m.draws}d)`,
                                        formattedExpected: "150.0 exp",
                                    }))}
                                    maxValue={165}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}
                    </MasonryGrid>
                </section>
            )}

            {/* ---------------------------------------------------------------- *
             * 5. Pari-mutuel & crowd psychology
             * ---------------------------------------------------------------- */}
            {/* ---------------------------------------------------------------- *
             * 6. The cage — the machine that produced it.
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "the-cage") && (
                <section id="the-cage" className="flex flex-col gap-3">
                    <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">6. The cage</h2>
                    <MasonryGrid>
                        {isVisible("panel-repeaters", "the-cage") && (
                            <InsightPanel
                                number={43}
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
                        )}

                        {isVisible("panel-additional", "the-cage") && (
                            <InsightPanel
                                number={44}
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
                        )}

                        {isVisible("panel-month", "the-cage") && (
                            <InsightPanel
                                number={45}
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
                        )}

                        {isVisible("panel-weekday", "the-cage") && (
                            <InsightPanel
                                number={46}
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
                        )}

                        {isVisible("panel-jackpot", "the-cage") && (
                            <InsightPanel
                                number={47}
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
                                <JackpotTrend stats={group1} height={284} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-patterns", "the-cage") && (
                            <InsightPanel
                                number={48}
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
                        )}

                        {isVisible("panel-weekday-split", "the-cage") && (
                            <InsightPanel
                                number={49}
                                section="The cage"
                                title="Monday vs Thursday ball split"
                                caption="Hit rate differential between Monday and Thursday draws across all 49 numbers."
                                id="panel-weekday-split"
                                family="Almanac & Time"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Monday", value: `Ball ${weekdaySplit.topMonBiased[0]?.number}`, hint: `${formatSigned(weekdaySplit.topMonBiased[0]?.delta * 100, 1)}%` },
                                    { label: "Top Thursday", value: `Ball ${weekdaySplit.topThuBiased[0]?.number}`, hint: `${formatSigned(-weekdaySplit.topThuBiased[0]?.delta * 100, 1)}%` },
                                    { label: "Odd/Even Draw", value: `${weekdaySplit.oddDrawSumMean.toFixed(1)} / ${weekdaySplit.evenDrawSumMean.toFixed(1)}`, hint: "mean sums" },
                                ]}
                            >
                                <ButterflySplitChart
                                    rows={weekdaySplit.topMonBiased.slice(0, 3).concat(weekdaySplit.topThuBiased.slice(0, 3)).map((r) => ({
                                        label: `Ball ${r.number}`,
                                        value: r.delta * 100,
                                        subLabel: `${(r.monRate * 100).toFixed(1)}% Mon vs ${(r.thuRate * 100).toFixed(1)}% Thu`,
                                    }))}
                                    centerLabel="0.0%"
                                    maxAbs={6.0}
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-chi-square", "the-cage") && (
                            <InsightPanel
                                number={50}
                                section="The cage"
                                title="Chi-square (χ²) randomness audit"
                                caption="Standard statistical goodness-of-fit tests verifying cage randomness across 5 orthogonal dimensions."
                                id="panel-chi-square"
                                family="Controls"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Overall Verdict", value: chiSquare.overallFair ? "FAIR" : "ANOMALOUS", hint: "all p ≥ 0.01" },
                                    { label: "Ball Uniformity", value: `p = ${chiSquare.tests[0].pValue.toFixed(2)}`, hint: `χ² = ${chiSquare.tests[0].chiSq.toFixed(1)}` },
                                    { label: "Parity Test", value: `p = ${chiSquare.tests[1].pValue.toFixed(2)}`, hint: `χ² = ${chiSquare.tests[1].chiSq.toFixed(1)}` },
                                ]}
                            >
                                <ChiSquareScorecard stats={chiSquare} className="mt-2" />
                            </InsightPanel>
                        )}
                    </MasonryGrid>
                </section>
            )}

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                Every number is equally likely in every draw. The correlations and patterns above describe the historical empirical archive and do not predict future draws. Play for entertainment, never to recover a loss.
            </p>
        </div>
    );
};
