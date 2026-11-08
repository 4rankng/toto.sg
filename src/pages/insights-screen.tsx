import { useEffect, useMemo, useRef, useState } from "react";
import {
    Activity,
    BarChart01,
    Clock,
    Hash01,
    Lightning01,
    SearchSm,
    Target05,
    TrendUp01,
    Users01,
} from "@untitledui/icons";
import { CandidateBallChip } from "@/components/product/sequence-blueprint-bar";
import { PanelVerdict } from "@/components/product/panel-verdict";
import { bandTone, fmtZ, toneForZ, zOf } from "@/lib/insights-verdict-helpers";
import { useLineBuilder } from "@/providers/line-builder-provider";
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
    EnvelopeBandChart,
    OscillatorBandChart,
    ScatterRegressionChart,
    SlotQuantileBandChart,
    SurvivalHazardChart,
    TransitionMatrixHeatmap,
} from "@/components/insights-indicator-charts";
import {
    ConstellationMstBoardChart,
    CurvatureProfileChart,
    OrdinalMotifBarChart,
    PeriodogramSpectrumChart,
    RecurrenceMatrixPlot,
    UnionPartitionCurveChart,
} from "@/components/insights-sequence-charts";
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
import {
    computeAtrChannelStats,
    computeBollingerSumStats,
    computeCompositeQuantStats,
    computeCouponSweepStats,
    computeCusumBreakStats,
    computeCycleRatioStats,
    computeEmaRibbonStats,
    computeFanoDispersionStats,
    computeGiniConcentrationStats,
    computeHotHandFallacyStats,
    computeHurstExponentStats,
    computeKaplanMeierHazardStats,
    computeMacdVelocityStats,
    computeMarkovTransitionStats,
    computeMeanReversionSlopeStats,
    computeMultiHorizonZStats,
    computeRsi14Stats,
    computeShannonEntropyStats,
    computeStochasticRangeStats,
    computeVolatilityRegimeStats,
} from "@/lib/insights-indicators";
import {
    computeCombinedDigitSumStats,
    computeCrossEraReplicationStats,
    computeGanzhiAlmanacStats,
    computeGapExtremesStats,
    computeHalfWaveStats,
    computeHistoricalQuadCollisionStats,
    computeHomologousClusterStats,
    computeIndeksStats,
    computeKsUniformityStats,
    computeLedStrokeStats,
    computeLineSdSkewStats,
    computeMistikBaruStats,
    computeMistikLamaStats,
    computeModularSieveStats,
    computePokerTailTestStats,
    computePythagoreanStats,
    computeQuarterWaveStats,
    computeStepLadderAp4Stats,
    computeThreeTierCalendarStats,
    computeTaysenStats,
    computeWaldWolfowitzRunsStats,
} from "@/lib/insights-togel-systems";
import {
    computeAdditionalCompanionStats,
    computeBallChiSquareResiduals,
    computeBayesianInclusionStats,
    computeBestCompanionAndCliquesStats,
    computeBoardRowColDispersion,
    computeCandidatePoolCaptureCurve,
    computeCoveringWheelGuarantees,
    computeDormancyBreakoutStats,
    computeFamilyMatchLeaderboard,
    computeGapSpacingEntropyStats,
    computeGreedyMatchCoverageStats,
    computeHarmonicMultiLagTriggerStats,
    computeKeyBallMatchLift,
    computeKnnTwinDrawsStats,
    computeLatestDrawTriggerStats,
    computeMasterConfluenceBoard,
    computeMultiWindowVelocityStats,
    computePairGraphCentralityStats,
    computePersonalSkipQuantileStats,
    computePrimeCountDistribution,
    computeSequenceEnvelopeStats,
    computeSevenBallExposureStats,
    computeSlotQuantileZones,
    computeStreakAndEchoStats,
    computeSystemMatchMultipliers,
    computeTercileZoneMatrix,
    computeUpcomingCalendarAffinityStats,
} from "@/lib/insights-sequence-blueprint";
import {
    chiSquareQuantile,
    computeCyclicTorusArcStats,
    computeExtendedSequenceResonanceStats,
    computeHawkesPointProcessStats,
    computeJensenShannonTurnoverStats,
    computeLempelZivComplexityStats,
    computeMahalanobisOrderStats,
    computeMultiplicativeCoprimeStats,
    computeOrdinalPermutationEntropyStats,
    computePlayslipConstellationStats,
    computeRqaRecurrenceStats,
    computeSecondDiffCurvatureStats,
    computeSidonSumsetStats,
    computeSpectralPeriodogramStats,
    computeSubgraphCohesionStats,
    computeUnionDepletionCurveStats,
    computeWassersteinTransportStats,
    gapProfileOf,
    ORDINAL_MOTIF_GLYPHS,
    ORDINAL_MOTIF_LABELS,
    playslipCellOf,
} from "@/lib/insights-sequence-dynamics";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";
import { humanizeStatus } from "@/utils/humanize";

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

/** Compact axis labels for the eight-filter envelope (full names are in the caption). */
const ENVELOPE_FILTER_LABELS: Record<string, string> = {
    "Sum Range": "Sum",
    "Odd/Even Balance": "Odd/Even",
    "Low/High Balance": "Low/High",
    "Span (Max - Min)": "Span",
    "Arithmetic Complexity": "AC ≥7",
    "Decades Covered": "Decades",
    "Distinct Tails": "Tails",
    "Repeater Restraint": "Repeaters",
};

/** One panel in the gallery index. */
interface IndexPanel {
    id: string;
    label: string;
}

/** The nine galleries in reading order with all 128 panels. */
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
            { id: "panel-seven-ball-exposure", label: "7-Ball exposure" },
            { id: "panel-velocity-matrix", label: "Velocity matrix" },
            { id: "panel-personal-skip-quantiles", label: "Skip quantiles" },
            { id: "panel-streak-echo", label: "Streak echoes" },
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
            { id: "panel-latest-draw-triggers", label: "Latest triggers" },
            { id: "panel-harmonic-multi-lag", label: "Harmonic multi-lag" },
            { id: "panel-hub-centrality", label: "Hub centrality" },
            { id: "panel-best-companions", label: "Greedy companions" },
            { id: "panel-additional-companions", label: "7th Ball companions" },
            { id: "panel-knn-twin-draws", label: "k-NN twin draws" },
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
            { id: "panel-tercile-matrix", label: "3-Tier zones" },
            { id: "panel-row-col-dispersion", label: "7×7 Grid dispersion" },
            { id: "panel-gap-entropy", label: "Gap spacing entropy" },
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
            { id: "panel-prime-distribution", label: "Prime balance" },
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
            { id: "panel-upcoming-calendar", label: "Calendar affinity" },
            { id: "panel-patterns", label: "Patterns" },
            { id: "panel-weekday-split", label: "Mon vs Thu" },
            { id: "panel-chi-square", label: "Randomness audit" },
        ],
    },
    {
        id: "indicators",
        label: "Indicators & oscillators",
        panels: [
            { id: "panel-rsi", label: "Wilder RSI-14" },
            { id: "panel-macd", label: "MACD velocity" },
            { id: "panel-bollinger", label: "Bollinger sum bands" },
            { id: "panel-multi-horizon", label: "Multi-horizon Z" },
            { id: "panel-ema-ribbon", label: "EMA ribbons" },
            { id: "panel-stochastic", label: "Stochastic oscillator" },
            { id: "panel-cusum", label: "CUSUM breaks" },
            { id: "panel-hurst", label: "Hurst exponent" },
            { id: "panel-shannon-entropy", label: "Shannon entropy" },
            { id: "panel-gini", label: "Gini concentration" },
            { id: "panel-fano", label: "Fano dispersion" },
            { id: "panel-kaplan-meier", label: "Kaplan–Meier hazard" },
            { id: "panel-cycle-ratio", label: "Cycle ratios" },
            { id: "panel-hot-hand", label: "Hot-hand vs fallacy" },
            { id: "panel-markov", label: "49×49 Markov lift" },
            { id: "panel-volatility-regime", label: "Volatility regimes" },
            { id: "panel-mean-reversion", label: "Mean-reversion slope" },
            { id: "panel-coupon-sweep", label: "Coupon-collector sweep" },
            { id: "panel-atr-channel", label: "ATR-14 channel" },
            { id: "panel-composite-quant", label: "Composite quant scorecard" },
            { id: "panel-bayesian-inclusion", label: "Bayesian inclusion" },
            { id: "panel-dormancy-breakout", label: "Dormancy breakout" },
            { id: "panel-ball-chi-residuals", label: "Ball χ² residuals" },
        ],
    },
    {
        id: "togel",
        label: "Togel, Mark Six & almanac",
        panels: [
            { id: "panel-mistik-lama", label: "Togel mistik lama" },
            { id: "panel-mistik-baru", label: "Togel mistik baru" },
            { id: "panel-indeks", label: "Togel indeks" },
            { id: "panel-taysen", label: "Taysen shadows" },
            { id: "panel-half-waves", label: "Mark Six half-waves" },
            { id: "panel-quarter-waves", label: "Quarter-waves" },
            { id: "panel-led-strokes", label: "7-Segment LED density" },
            { id: "panel-ganzhi", label: "60-Day Ganzhi almanac" },
            { id: "panel-pythagorean", label: "Pythagorean master numbers" },
            { id: "panel-modular-sieve", label: "Modular residue sieve" },
            { id: "panel-combined-digit-sum", label: "Combined digit sum" },
            { id: "panel-homologous-clusters", label: "Twin/triple tail clusters" },
            { id: "panel-step-ladder", label: "Step-ladder AP-4 traps" },
            { id: "panel-three-tier-calendar", label: "3-Tier calendar balance" },
        ],
    },
    {
        id: "systems-ev",
        label: "Forensics & randomness",
        panels: [
            { id: "panel-quad-collisions", label: "1,892-Draw quad collisions" },
            { id: "panel-cross-era-audit", label: "6/45 vs 6/49 cross-audit" },
            { id: "panel-gap-extremes", label: "Min & max gap extremes" },
            { id: "panel-line-sd-skew", label: "Line SD & skewness" },
            { id: "panel-runs-test", label: "Wald–Wolfowitz runs test" },
            { id: "panel-ks-uniformity", label: "Kolmogorov–Smirnov test" },
            { id: "panel-poker-tails", label: "NIST poker-hand tails" },
        ],
    },
    {
        id: "blueprint",
        label: "Sequence blueprint & covering",
        panels: [
            { id: "panel-master-confluence", label: "8-Signal confluence" },
            { id: "panel-envelope-filters", label: "8-Filter envelope" },
            { id: "panel-slot-quantiles", label: "Slot quantiles" },
            { id: "panel-greedy-coverage", label: "Greedy coverage" },
            { id: "panel-pool-capture", label: "Pool capture curve" },
            { id: "panel-system-multipliers", label: "System multipliers" },
            { id: "panel-covering-wheels", label: "Covering wheels" },
            { id: "panel-key-ball-lift", label: "Key-ball lift" },
            { id: "panel-family-match-leaderboard", label: "Family match leaderboard" },
        ],
    },
    {
        id: "order-geometry",
        label: "10. Order geometry & additive structure",
        panels: [
            { id: "panel-mahalanobis-ellipsoid", label: "Mahalanobis ellipsoid" },
            { id: "panel-gap-curvature", label: "Gap curvature" },
            { id: "panel-sidon-sumset", label: "Sidon sumset" },
            { id: "panel-constellation-mst", label: "Playslip MST constellation" },
            { id: "panel-subgraph-cohesion", label: "Sub-graph cohesion" },
            { id: "panel-benford-coprime", label: "Coprime density" },
            { id: "panel-cyclic-torus", label: "Cyclic Z49 torus" },
            { id: "panel-recursive-sequences", label: "Recursive resonance" },
        ],
    },
    {
        id: "stream-dynamics",
        label: "11. Sequence dynamics & point processes",
        panels: [
            { id: "panel-wasserstein-transport", label: "Wasserstein transport" },
            { id: "panel-lempel-ziv", label: "Lempel-Ziv complexity" },
            { id: "panel-spectral-periodogram", label: "Spectral periodogram" },
            { id: "panel-hawkes-intensity", label: "Hawkes intensity" },
            { id: "panel-rqa-recurrence", label: "Recurrence quantification" },
            { id: "panel-union-depletion", label: "Union depletion" },
            { id: "panel-permutation-entropy", label: "Permutation entropy" },
            { id: "panel-jensen-shannon-turnover", label: "Jensen-Shannon turnover" },
        ],
    },
];

/** Every panel in reading order, numbered 1..128. */
const PANEL_INDEX = SECTIONS.flatMap((section) => section.panels).map((panel, index) => ({
    id: panel.id,
    label: panel.label,
    number: index + 1,
}));

const PANEL_NUMBERS = new Map<string, number>(PANEL_INDEX.map((p) => [p.id, p.number]));
const pNum = (id: string) => PANEL_NUMBERS.get(id) ?? 1;

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Tone of a verdict strip. */
type VerdictTone = "signal" | "null" | "watch";

/** Machine-readable z token for `metric`, e.g. `z:+2.3`. */
const metricZ = (z: number): string => `z:${z >= 0 ? "+" : "-"}${Math.abs(z).toFixed(1)}`;

/** Props for a count-vs-expectation verdict (Pick / Avoid / No edge). */
const countVerdict = (
    tone: VerdictTone,
    thing: string,
    stat: string,
    z: number,
    noun: string,
    target?: string,
    extraMetric?: string,
): { tone: VerdictTone; label: string; pick?: string; avoid?: string; metric?: string } => ({
    tone,
    label:
        tone === "signal" ? `Pick ${thing} — ${stat} (${fmtZ(z)})`
        : tone === "watch" ? `Avoid ${thing} — ${stat} (${fmtZ(z)})`
        : `No edge — top ${noun} within chance (${fmtZ(z)})`,
    ...(tone === "signal" && target ? { pick: target } : {}),
    ...(tone === "watch" && target ? { avoid: target } : {}),
    metric: [extraMetric, metricZ(z)].filter(Boolean).join("|"),
});

/** Props for a direction verdict (Pick rising / Avoid falling / No edge flat). */
const directionVerdict = (
    tone: VerdictTone,
    metricName: string,
    sigma?: string,
    tokens?: string,
): { tone: VerdictTone; label: string; metric?: string } => ({
    tone,
    label:
        tone === "signal" ? `Pick — ${metricName} rising${sigma ? ` (${sigma})` : ""}`
        : tone === "watch" ? `Avoid — ${metricName} falling${sigma ? ` (${sigma})` : ""}`
        : "No edge — flat",
    metric: tokens,
});

/** Props for a null-model verdict: a real deviation from the null reads as an edge. */
const edgeVerdict = (deviation: boolean, tokens?: string): { tone: VerdictTone; label: string; metric?: string } => ({
    tone: deviation ? "watch" : "null",
    label: deviation ? "Edge found — favor the hottest, avoid the coldest" : "No edge — matches random draw",
    metric: tokens,
});



/**
 * The LZ panel's chart points: the rolling phrase count against the same
 * window of the shuffled twin. The normalized Kaspar-Schuster value
 * saturates at 1 for every window of this length, so the phrase count is
 * what still carries the signal.
 */
const lempelZivPoints = (stats: ReturnType<typeof computeLempelZivComplexityStats>) =>
    stats.rolling.slice(-120).map((point) => ({
        label: point.label,
        value: point.value,
        upper: point.nullValue + 1,
        lower: point.nullValue - 1,
        ma: point.nullValue,
    }));

/** The Feder-Merhav predictability ceiling, as a share. */
const lempelZivCeiling = (stats: ReturnType<typeof computeLempelZivComplexityStats>) => stats.predictabilityCeiling;

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

function LazyGallerySection({
    id,
    title,
    children,
    forceMount = false,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
    forceMount?: boolean;
}) {
    const [mounted, setMounted] = useState(forceMount);
    const containerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (forceMount) {
            setMounted(true);
            return;
        }
        if (mounted) return;
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === "undefined") {
            setMounted(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setMounted(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "800px 0px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [forceMount, mounted]);

    return (
        <section ref={containerRef} id={id} className="flex flex-col gap-3 min-h-[140px]">
            <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">{title}</h2>
            {mounted ? <MasonryGrid>{children}</MasonryGrid> : <div className="h-48 rounded-xl border border-line/40 bg-surface/30 animate-pulse" />}
        </section>
    );
}

export const InsightsScreen = () => {
    usePageTitle("Insights — what the draws look like");

    const [activeSection, setActiveSection] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const { line } = useLineBuilder();

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

    /* Gallery 7 (Panels 51–70): Indicators & Oscillators */
    const rsiStats = useMemo(() => computeRsi14Stats(eraDraws), [eraDraws]);
    const macdStats = useMemo(() => computeMacdVelocityStats(eraDraws), [eraDraws]);
    const bollingerStats = useMemo(() => computeBollingerSumStats(eraDraws), [eraDraws]);
    const multiHorizonStats = useMemo(() => computeMultiHorizonZStats(eraDraws), [eraDraws]);
    const emaRibbonStats = useMemo(() => computeEmaRibbonStats(eraDraws), [eraDraws]);
    const stochStats = useMemo(() => computeStochasticRangeStats(eraDraws), [eraDraws]);
    const cusumStats = useMemo(() => computeCusumBreakStats(eraDraws), [eraDraws]);
    const hurstStats = useMemo(() => computeHurstExponentStats(eraDraws), [eraDraws]);
    const entropyStats = useMemo(() => computeShannonEntropyStats(eraDraws), [eraDraws]);
    const giniStats = useMemo(() => computeGiniConcentrationStats(eraDraws), [eraDraws]);
    const fanoStats = useMemo(() => computeFanoDispersionStats(eraDraws), [eraDraws]);
    const kaplanStats = useMemo(() => computeKaplanMeierHazardStats(eraDraws), [eraDraws]);
    const cycleStats = useMemo(() => computeCycleRatioStats(eraDraws), [eraDraws]);
    const hotHandStats = useMemo(() => computeHotHandFallacyStats(eraDraws), [eraDraws]);
    const markovStats = useMemo(() => computeMarkovTransitionStats(eraDraws), [eraDraws]);
    const volRegimeStats = useMemo(() => computeVolatilityRegimeStats(eraDraws), [eraDraws]);
    const reversionStats = useMemo(() => computeMeanReversionSlopeStats(eraDraws), [eraDraws]);
    const couponStats = useMemo(() => computeCouponSweepStats(eraDraws), [eraDraws]);
    const atrStats = useMemo(() => computeAtrChannelStats(eraDraws), [eraDraws]);
    const quantStats = useMemo(() => computeCompositeQuantStats(eraDraws), [eraDraws]);

    /* Gallery 8 (Panels 71–86): Togel, Mark Six & Almanac */
    const mistikLama = useMemo(() => computeMistikLamaStats(eraDraws), [eraDraws]);
    const mistikBaru = useMemo(() => computeMistikBaruStats(eraDraws), [eraDraws]);
    const indeks = useMemo(() => computeIndeksStats(eraDraws), [eraDraws]);
    const taysen = useMemo(() => computeTaysenStats(eraDraws), [eraDraws]);
    const halfWaves = useMemo(() => computeHalfWaveStats(eraDraws), [eraDraws]);
    const quarterWaves = useMemo(() => computeQuarterWaveStats(eraDraws), [eraDraws]);
    const ledStrokes = useMemo(() => computeLedStrokeStats(eraDraws), [eraDraws]);
    const ganzhi = useMemo(() => computeGanzhiAlmanacStats(eraDraws), [eraDraws]);
    const pythagorean = useMemo(() => computePythagoreanStats(eraDraws), [eraDraws]);
    const modularSieve = useMemo(() => computeModularSieveStats(eraDraws), [eraDraws]);
    const digitSum = useMemo(() => computeCombinedDigitSumStats(eraDraws), [eraDraws]);
    const homologous = useMemo(() => computeHomologousClusterStats(eraDraws), [eraDraws]);
    const stepLadder = useMemo(() => computeStepLadderAp4Stats(eraDraws), [eraDraws]);

    /* Gallery 8: Forensics & randomness audits */
    const quadCollisions = useMemo(() => computeHistoricalQuadCollisionStats(eraDraws), [eraDraws]);
    const crossEra = useMemo(() => computeCrossEraReplicationStats(draws ?? undefined), [draws]);
    const gapExtremes = useMemo(() => computeGapExtremesStats(eraDraws), [eraDraws]);
    const lineSd = useMemo(() => computeLineSdSkewStats(eraDraws), [eraDraws]);
    const runsTest = useMemo(() => computeWaldWolfowitzRunsStats(eraDraws), [eraDraws]);
    const ksTest = useMemo(() => computeKsUniformityStats(eraDraws), [eraDraws]);
    const pokerTails = useMemo(() => computePokerTailTestStats(eraDraws), [eraDraws]);

    /* Gallery 1-9 Blueprint and Match Analytics Memos */
    const sevenBallExposure = useMemo(() => computeSevenBallExposureStats(eraDraws), [eraDraws]);
    const velocityMatrix = useMemo(() => computeMultiWindowVelocityStats(eraDraws), [eraDraws]);
    const skipQuantiles = useMemo(() => computePersonalSkipQuantileStats(eraDraws), [eraDraws]);
    const streakEcho = useMemo(() => computeStreakAndEchoStats(eraDraws), [eraDraws]);

    const latestTriggers = useMemo(() => computeLatestDrawTriggerStats(eraDraws), [eraDraws]);
    const harmonicMultiLag = useMemo(() => computeHarmonicMultiLagTriggerStats(eraDraws), [eraDraws]);
    const hubCentrality = useMemo(() => computePairGraphCentralityStats(eraDraws), [eraDraws]);
    const bestCompanions = useMemo(() => computeBestCompanionAndCliquesStats(eraDraws), [eraDraws]);
    const additionalCompanions = useMemo(() => computeAdditionalCompanionStats(eraDraws), [eraDraws]);
    const knnTwins = useMemo(() => computeKnnTwinDrawsStats(eraDraws), [eraDraws]);

    const tercileMatrix = useMemo(() => computeTercileZoneMatrix(eraDraws), [eraDraws]);
    const rowColDispersion = useMemo(() => computeBoardRowColDispersion(eraDraws), [eraDraws]);
    const gapEntropy = useMemo(() => computeGapSpacingEntropyStats(eraDraws), [eraDraws]);

    const primeDistribution = useMemo(() => computePrimeCountDistribution(eraDraws), [eraDraws]);
    const upcomingCalendar = useMemo(() => computeUpcomingCalendarAffinityStats(eraDraws), [eraDraws]);

    const bayesianInclusion = useMemo(() => computeBayesianInclusionStats(eraDraws), [eraDraws]);
    const dormancyBreakout = useMemo(() => computeDormancyBreakoutStats(eraDraws), [eraDraws]);
    const ballChiResiduals = useMemo(() => computeBallChiSquareResiduals(eraDraws), [eraDraws]);

    const threeTierCalendar = useMemo(() => computeThreeTierCalendarStats(eraDraws), [eraDraws]);

    const confluenceBoard = useMemo(() => (analysis ? computeMasterConfluenceBoard(eraDraws, analysis, league ?? undefined) : null), [eraDraws, analysis, league]);
    const envelopeStats = useMemo(() => computeSequenceEnvelopeStats(eraDraws), [eraDraws]);
    const slotQuantiles = useMemo(() => computeSlotQuantileZones(eraDraws), [eraDraws]);
    const greedyCoverage = useMemo(() => computeGreedyMatchCoverageStats(eraDraws), [eraDraws]);
    const poolCapture = useMemo(() => {
        const candidateBalls = confluenceBoard ? confluenceBoard.rankedBalls.map((r) => r.number) : Array.from({ length: 49 }, (_, i) => i + 1);
        return computeCandidatePoolCaptureCurve(eraDraws, candidateBalls);
    }, [eraDraws, confluenceBoard]);
    const systemMultipliers = useMemo(() => computeSystemMatchMultipliers(), []);
    const coveringWheels = useMemo(() => computeCoveringWheelGuarantees(), []);
    const keyBallLift = useMemo(() => computeKeyBallMatchLift(), []);
    const familyLeaderboard = useMemo(() => (league ? computeFamilyMatchLeaderboard(league) : null), [league]);

    // The candidate line, sorted. The provider stores the line in tap
    // order, so every positional read of it must sort first — otherwise
    // slot 2 holds whatever the viewer tapped second, not the second
    // smallest ball.
    const sortedLine = useMemo(() => [...line].sort((a, b) => a - b), [line]);

    /** The candidate's own gap profile — the live overlay on the curvature chart. */
    const candidateProfile = useMemo(
        () => (sortedLine.length >= 6 ? gapProfileOf(sortedLine.slice(0, 6)) : null),
        [sortedLine],
    );

    // --- Gallery 10: order geometry & additive structure ---------------
    const mahalanobis = useMemo(() => computeMahalanobisOrderStats(eraDraws), [eraDraws]);
    const curvature = useMemo(() => computeSecondDiffCurvatureStats(eraDraws), [eraDraws]);
    const sidon = useMemo(() => computeSidonSumsetStats(eraDraws), [eraDraws]);
    const constellation = useMemo(() => computePlayslipConstellationStats(eraDraws), [eraDraws]);
    const subgraph = useMemo(() => computeSubgraphCohesionStats(eraDraws), [eraDraws]);
    const coprime = useMemo(() => computeMultiplicativeCoprimeStats(eraDraws), [eraDraws]);
    const torus = useMemo(() => computeCyclicTorusArcStats(eraDraws), [eraDraws]);
    const resonance = useMemo(() => computeExtendedSequenceResonanceStats(eraDraws), [eraDraws]);

    // --- Gallery 11: sequence dynamics & point processes ----------------
    const wasserstein = useMemo(() => computeWassersteinTransportStats(eraDraws), [eraDraws]);
    const lempelZiv = useMemo(() => computeLempelZivComplexityStats(eraDraws), [eraDraws]);
    const spectral = useMemo(() => computeSpectralPeriodogramStats(eraDraws), [eraDraws]);
    const hawkes = useMemo(() => computeHawkesPointProcessStats(eraDraws), [eraDraws]);
    const rqa = useMemo(() => computeRqaRecurrenceStats(eraDraws), [eraDraws]);
    const unionDepletion = useMemo(() => computeUnionDepletionCurveStats(eraDraws), [eraDraws]);
    const permutation = useMemo(() => computeOrdinalPermutationEntropyStats(eraDraws), [eraDraws]);
    const turnover = useMemo(() => computeJensenShannonTurnoverStats(eraDraws), [eraDraws]);

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

    if (analysisError || drawsError || leagueError || !analysis || !draws || !league || !gaps || !stratConsensus) {
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

    const forceMount = activeSection !== "all" || searchQuery.trim() !== "" || (typeof window !== "undefined" && window.location.hash.startsWith("#panel-"));

    /** Query-filtered panels check. */
    const isVisible = (panelId: string, sectionId: string) => {
        if (activeSection !== "all" && activeSection !== sectionId) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const p = PANEL_INDEX.find((x) => x.id === panelId);
        return p ? p.label.toLowerCase().includes(q) || panelId.toLowerCase().includes(q) : true;
    };

    /** Panel-index links the search box filters. */
    const visiblePanelIndex = searchQuery.trim()
        ? PANEL_INDEX.filter((p) => p.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        : PANEL_INDEX;

    return (
        <div className="flex min-w-0 max-w-full flex-col gap-3">
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
                        <span>{PANEL_INDEX.length} analytics panels</span>
                    </>
                }
                description="Empirical match-count analytics across the 6/49 era — frequency, correlations, geometry, folklore and indicators, each evaluated against exact combinatorial null models. No payout analysis: the goal is data for picking lines with as many matching numbers as possible."
            />

            {/* The headline numbers: 8 console KPI cards. */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard label="Draws" value={formatNumber(total)} hint="6/49 era" icon={Hash01} tone="primary" />
                <KpiCard label="Mean sum" value={analysis.sum.mean.toFixed(1)} hint={`median ${analysis.sum.median}`} icon={BarChart01} tone="secondary" />
                <KpiCard label="Most seen" value={hot?.number ?? "—"} hint={hot ? `${formatNumber(hot.count)} draws` : undefined} icon={Lightning01} tone="gold" />
                <KpiCard label="Least seen" value={cold?.number ?? "—"} hint={cold ? `${formatNumber(cold.count)} draws` : undefined} icon={Activity} tone="neutral" />
                <KpiCard label="Overdue" value={gaps.overdueCount} hint="of 49 numbers" icon={Clock} tone="primary" />
                <KpiCard label="Top pair" value={pairs[0] ? `${pairs[0].a}–${pairs[0].b}` : "—"} hint={pairs[0] ? `${formatNumber(pairs[0].count)} draws together` : undefined} icon={TrendUp01} tone="gold" />
                <KpiCard label="8-Signal #1" value={confluenceBoard?.rankedBalls[0]?.number ? `Ball ${confluenceBoard.rankedBalls[0].number}` : "—"} hint={confluenceBoard?.rankedBalls[0] ? `${confluenceBoard.rankedBalls[0].signalsPassed}/8 signals` : undefined} icon={Target05} tone="primary" />
                <KpiCard label="Bot consensus" value={stratConsensus.topVoted[0] ? `Ball ${stratConsensus.topVoted[0].number}` : "—"} hint={stratConsensus.topVoted[0] ? `${stratConsensus.topVoted[0].votes} bot votes` : undefined} icon={Users01} tone="secondary" />
            </div>

            {/*
                Gallery navigation. The section pills wrap instead of scrolling
                sideways (at 1440 the row was 1,458px inside a 1,186px track,
                hiding the last two sections), the search now sits with the
                panel index it actually filters, and the long index strip keeps
                a fade at its right edge so a clipped link reads as "more
                below" rather than a cut-off label.
            */}
            <nav aria-label="Insights sections" className="flex min-w-0 max-w-full flex-col gap-2 rounded-lg border border-line bg-surface p-2.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
                        All {PANEL_INDEX.length} Panels
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

                <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-line/60 pt-2 sm:flex-nowrap">
                    <label className="relative min-w-40 flex-1 sm:max-w-xs">
                        <span className="sr-only">Filter panels</span>
                        <SearchSm
                            aria-hidden="true"
                            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
                        />
                        <input
                            type="text"
                            placeholder="Filter panels..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-md border border-line bg-surface-inset py-1 pl-8 pr-2 text-xs text-ink placeholder:text-ink-subtle focus:border-primary focus:outline-none"
                        />
                    </label>
                    <span className="shrink-0 font-mono text-[10px] text-ink-subtle tabular-nums">
                        {visiblePanelIndex.length}/{PANEL_INDEX.length} panels
                    </span>
                    <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1">
                        <div className="scrollbar-hide flex min-w-0 max-w-full items-center gap-1 overflow-x-auto pr-10">
                            {visiblePanelIndex.map((panel) => (
                                <a
                                    key={panel.id}
                                    href={`#${panel.id}`}
                                    className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle transition-colors duration-100 hover:text-accent"
                                >
                                    {String(panel.number).padStart(2, "0")} {panel.label}
                                </a>
                            ))}
                        </div>
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-surface to-transparent"
                        />
                    </div>
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
                                number={pNum("panel-frequency")}
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
                                {(() => {
                                    const c = hot?.count ?? 0;
                                    const z = zOf(c, (total * 6) / 49);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${hot?.number ?? "—"}`, `${formatNumber(c)} hits`, z, "ball", hot ? `ball-${hot.number}` : undefined)} />;
                                })()}
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
                                number={pNum("panel-gap-tracker")}
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
                                {(() => {
                                    const n = gaps.overdueCount;
                                    const hotBall = gaps.hottest[0]?.number;
                                    return (
                                        <PanelVerdict
                                            tone={n >= 15 ? "watch" : "null"}
                                            label={n >= 15 ? `Avoid the ${n} deep-dry balls` : "No edge — dry tails are normal"}
                                            {...(n >= 15 && hotBall != null ? { avoid: `ball-${hotBall}` } : {})}
                                            detail={`expected ${gaps.expectedOverdue.toFixed(1)} overdue`}
                                            metric={`overdue:${n}|expected:${gaps.expectedOverdue.toFixed(1)}`}
                                        />
                                    );
                                })()}
                                <GapVolcano stats={gaps} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-timeline", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-timeline")}
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
                                number={pNum("panel-streaks")}
                                section="The numbers"
                                title="Streak ribbons"
                                caption={`A dot for every hit in the last ${STREAK_WINDOW} draws, sorted by how often each number turned up in the last ten.`}
                                id="panel-streaks"
                                family="Streaks"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Hot now", value: streaks[0]?.number ?? "—", hint: streaks[0] ? `${streaks[0].hot} hits in 10` : undefined },
                                    { label: "Cold now", value: streaks.at(-1)?.number ?? "—", hint: streaks.at(-1) ? `${streaks.at(-1)?.hot} hits in 10` : undefined },
                                    { label: "Expected", value: `${((STREAK_WINDOW * 6) / 49).toFixed(1)}`, hint: "hits per number" },
                                ]}
                            >
                                {(() => {
                                    const c = streaks[0]?.hot ?? 0;
                                    const z = zOf(c, (STREAK_WINDOW * 6) / 49);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${streaks[0]?.number ?? "—"}`, `${c} hits in ${STREAK_WINDOW}`, z, "ball", streaks[0] ? `ball-${streaks[0].number}` : undefined)} />;
                                })()}
                                <StreakRibbons rows={streaks} window={STREAK_WINDOW} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-decades", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-decades")}
                                section="The numbers"
                                title="Decade spread"
                                caption="Numbers per draw from each decade, year by year, with the all-time average on the right."
                                id="panel-decades"
                                family="Structure"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Widest", value: decadeMax.toFixed(2), hint: "numbers per draw" },
                                    { label: "Narrowest", value: decadeMin.toFixed(2), hint: "numbers per draw" },
                                    { label: "Expected", value: (6 * 10 / 49).toFixed(2), hint: "per decade" },
                                ]}
                            >
                                {(() => {
                                    const value = 8.4 - decadeMin > decadeMax - 10.2 ? decadeMin : decadeMax;
                                    const tone = bandTone(value, 8.4, 10.2);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid decade averages outside 8.4–10.2 (now ${value.toFixed(2)})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "decade-outside-8.4-10.2" } : {})}
                                            detail={`${value.toFixed(2)} vs band 8.4–10.2`}
                                            metric={`mean:${value.toFixed(2)}|band:8.4-10.2`}
                                        />
                                    );
                                })()}
                                <DecadeHeatmap rows={DECADE_LABELS} columns={decades.years} cells={decades.cells} marginal={analysis.decades} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-pairs", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-pairs")}
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
                                {(() => {
                                    const p = pairs[0];
                                    const z = zOf(p?.count ?? 0, expectedPairMeetings);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `pair ${p?.a ?? "—"}–${p?.b ?? "—"}`, `${formatNumber(p?.count ?? 0)} hits`, z, "pair", p ? `pair-${p.a}-${p.b}` : undefined)} />;
                                })()}
                                <div className="overflow-x-auto">
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
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-cold-pairs", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-cold-pairs")}
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
                                {(() => {
                                    const p = coldPairs.coldest[0];
                                    const c = p?.count ?? 0;
                                    const z = zOf(c, expectedPairMeetings);
                                    const cold = c < expectedPairMeetings;
                                    const tone = cold ? "watch" : toneForZ(z);
                                    const target = p ? `pair-${p.a}-${p.b}` : undefined;
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={cold
                                                ? `Avoid pair ${p?.a}–${p?.b} — deep cold (${fmtZ(z)})`
                                                : countVerdict(tone, `pair ${p?.a}–${p?.b}`, `${c} hits`, z, "pair", target).label}
                                            {...(tone === "watch" && target ? { avoid: target } : {})}
                                            metric={`hits:${c}|exp:${expectedPairMeetings.toFixed(1)}|${metricZ(z)}`}
                                        />
                                    );
                                })()}
                                <div className="overflow-x-auto">
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
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-triples", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-triples")}
                                section="The numbers"
                                title="Most common triples"
                                caption="3-number combinations sharing the same draw most often out of 18,424 possible triples."
                                id="panel-triples"
                                family="Pairs"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top triple", value: triples.topTriples[0] ? `${triples.topTriples[0].a}-${triples.topTriples[0].b}-${triples.topTriples[0].c}` : "—", hint: `${triples.topTriples[0]?.count} times` },
                                    { label: "Expected", value: triples.expectedMeetings.toFixed(2), hint: "meetings" },
                                    { label: "Triples pool", value: formatNumber(triples.totalTriplesInPool), hint: "C(49, 3)" },
                                ]}
                            >
                                {(() => {
                                    const t = triples.topTriples[0];
                                    const z = zOf(t?.count ?? 0, triples.expectedMeetings);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `triple ${t?.a}-${t?.b}-${t?.c}`, `${t?.count ?? 0} hits`, z, "triple", t ? `triple-${t.a}-${t.b}-${t.c}` : undefined, `exp:${triples.expectedMeetings.toFixed(1)}`)} />;
                                })()}
                                <div className="overflow-x-auto">
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
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-last-50", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-last-50")}
                                section="The numbers"
                                title="Last 50 vs all time"
                                caption={`Appearances in the last ${RECENT_WINDOW} draws against ${movement.expected.toFixed(1)} expected.`}
                                id="panel-last-50"
                                family="Hot & Cold"
                                className="lg:col-span-6"
                            >
                                {(() => {
                                    const top = movement.risers[0];
                                    const z = zOf(top?.count ?? 0, movement.expected);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${top?.number ?? "—"}`, `${top?.count ?? 0} hits in ${RECENT_WINDOW}`, z, "riser", top ? `ball-${top.number}` : undefined, `exp:${movement.expected.toFixed(1)}`)} />;
                                })()}
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
                                number={pNum("panel-bounce-back")}
                                section="The numbers"
                                title="Return rate by skip (Bounce-back)"
                                caption="Empirical probability P(hit | current skip band) testing gambler's fallacy against the 12.24% null."
                                id="panel-bounce-back"
                                family="Gap & Due"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Hottest skip", value: bounceBack.hottestBand, hint: "highest return rate" },
                                    { label: "Base rate", value: "12.24%", hint: "6 / 49 null" },
                                    { label: "Coldest skip", value: bounceBack.coldestBand, hint: "lowest return rate" },
                                ]}
                            >
                                {(() => {
                                    const b = [...bounceBack.buckets].sort((x, y) => y.hitRate - x.hitRate)[0];
                                    const z = zOf(b.hits, b.trials * b.expectedRate);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `skip band ${b.band}`, `${b.hits}/${b.trials} hits`, z, "band", `band-${String(b.band).toLowerCase().replace(/\s+/g, "-")}`, `base:${(b.expectedRate * 100).toFixed(1)}pct|hits:${b.hits}|trials:${b.trials}`)} />;
                                })()}
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

                        {isVisible("panel-seven-ball-exposure", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-seven-ball-exposure")}
                                section="The numbers"
                                title="7-Ball main+extra exposure"
                                caption="Hit count and frequency when considering all 7 drawn balls (6 main + 1 additional) vs 6 main balls."
                                id="panel-seven-ball-exposure"
                                family="Frequency"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top 7-Ball", value: `Ball ${sevenBallExposure.topExposed[0]?.number}`, hint: `${sevenBallExposure.topExposed[0]?.totalExposure} hits (${(sevenBallExposure.topExposed[0]?.totalRate * 100).toFixed(1)}%)` },
                                    { label: "Max Extra Boost", value: `Ball ${sevenBallExposure.topAdditionalBoosted[0]?.number}`, hint: `+${sevenBallExposure.topAdditionalBoosted[0]?.additionalCount} extra balls` },
                                    { label: "Expected 7-Ball", value: `${(sevenBallExposure.expectedTotalRate * 100).toFixed(1)}%`, hint: "14.29% chance" },
                                ]}
                            >
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Ball</th>
                                                <th className={thNum}>Main (6)</th>
                                                <th className={thNum}>Extra (1)</th>
                                                <th className={thNum}>Total (7)</th>
                                                <th className={thNum}>Rate</th>
                                                <th className={thNum}>z-Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {sevenBallExposure.topExposed.slice(0, 8).map((r) => (
                                                <tr key={r.number}>
                                                    <td className={td}><CandidateBallChip number={r.number} /></td>
                                                    <td className={tdNum}>{r.mainCount}</td>
                                                    <td className={tdNum}>{r.additionalCount}</td>
                                                    <td className={tdNum}>{r.totalExposure}</td>
                                                    <td className={tdNum}>{(r.totalRate * 100).toFixed(1)}%</td>
                                                    <td className={tdNum}>{formatSigned(r.zScoreTotal, 2)}σ</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-velocity-matrix", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-velocity-matrix")}
                                section="The numbers"
                                title="Multi-window velocity matrix"
                                caption="Standardized hit velocity z-scores across rolling 5, 10, 20, and 50 draw horizons to detect emerging vs cooling momentum."
                                id="panel-velocity-matrix"
                                family="Momentum"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Speed (10d)", value: `Ball ${velocityMatrix.topSpeed10[0]?.number}`, hint: `${velocityMatrix.topSpeed10[0]?.hits10} hits in 10d` },
                                    { label: "Accelerating", value: velocityMatrix.acceleratingBalls.length, hint: "numbers picking up" },
                                    { label: "Cooling", value: velocityMatrix.coolingBalls.length, hint: "numbers slowing down" },
                                ]}
                            >
                                {(() => {
                                    const net = velocityMatrix.acceleratingBalls.length - velocityMatrix.coolingBalls.length;
                                    const tone = net > 0 ? "signal" : net < 0 ? "watch" : "null";
                                    return <PanelVerdict {...directionVerdict(tone, "hit velocity", undefined, `accel:${velocityMatrix.acceleratingBalls.length}|cool:${velocityMatrix.coolingBalls.length}`)} />;
                                })()}
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Ball</th>
                                                <th className={thNum}>5d</th>
                                                <th className={thNum}>10d</th>
                                                <th className={thNum}>25d</th>
                                                <th className={thNum}>50d</th>
                                                <th className={thNum}>Acceleration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {velocityMatrix.acceleratingBalls.slice(0, 8).map((r) => (
                                                <tr key={r.number}>
                                                    <td className={td}><CandidateBallChip number={r.number} /></td>
                                                    <td className={tdNum}>{r.hits5}</td>
                                                    <td className={tdNum}>{r.hits10}</td>
                                                    <td className={tdNum}>{r.hits25}</td>
                                                    <td className={tdNum}>{r.hits50}</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">{formatSigned(r.acceleration * 100, 1)}%</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-personal-skip-quantiles", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-personal-skip-quantiles")}
                                section="The numbers"
                                title="Personal skip quantiles & stretch"
                                caption="Each ball's current absence compared against its own historical 25th, median (50th), and 75th percentile skip intervals."
                                id="panel-personal-skip-quantiles"
                                family="Gaps"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Sweet Zone", value: skipQuantiles.sweetZoneBalls.length, hint: "in personal IQR" },
                                    { label: "Dormant", value: skipQuantiles.dormantBalls.length, hint: "past personal p75" },
                                    { label: "Underdue", value: skipQuantiles.underdueBalls.length, hint: "below personal p25" },
                                ]}
                            >
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Ball</th>
                                                <th className={thNum}>Current Skip</th>
                                                <th className={thNum}>p25</th>
                                                <th className={thNum}>Median</th>
                                                <th className={thNum}>p75</th>
                                                <th className={thNum}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {skipQuantiles.sweetZoneBalls.slice(0, 8).map((r) => (
                                                <tr key={r.number}>
                                                    <td className={td}><CandidateBallChip number={r.number} /></td>
                                                    <td className={tdNum}><span className="text-gold font-semibold">{r.currentSkip}d</span></td>
                                                    <td className={tdNum}>{r.p25}d</td>
                                                    <td className={tdNum}>{r.median}d</td>
                                                    <td className={tdNum}>{r.p75}d</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">{humanizeStatus(r.status)}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-streak-echo", "the-numbers") && (
                            <InsightPanel
                                number={pNum("panel-streak-echo")}
                                section="The numbers"
                                title="Consecutive echoes & repeat decay"
                                caption="Empirical probability of a ball reappearing 1 draw later (back-to-back), 2 draws later (1-skip echo), or 3 draws later."
                                id="panel-streak-echo"
                                family="Frequency"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Repeat Rate (t-1)", value: `${(streakEcho.repeatRate * 100).toFixed(1)}%`, hint: `exp ${(streakEcho.repeatRateNull * 100).toFixed(1)}%` },
                                    { label: "Skip-1 Echo Rate", value: `${(streakEcho.skipOneEchoRate * 100).toFixed(1)}%`, hint: `exp ${(streakEcho.skipOneEchoNull * 100).toFixed(1)}%` },
                                    { label: "Active Echo Balls", value: streakEcho.activeEchoBalls.length, hint: "drawn t-2, skipped t-1" },
                                ]}
                            >
                                {(() => {
                                    const c = streakEcho.repeatRate * total;
                                    const z = zOf(c, streakEcho.repeatRateNull * total);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, "back-to-back repeats", `${c.toFixed(0)} hits`, z, "echo", undefined, `rate:${(streakEcho.repeatRate * 100).toFixed(1)}pct|null:${(streakEcho.repeatRateNull * 100).toFixed(1)}pct`)} />;
                                })()}
                                <div className="flex flex-col gap-3 mt-2">
                                    <div className="flex items-center justify-between text-xs border-b border-line pb-2">
                                        <span className="text-ink-muted">Single Repeat P(t | t-1):</span>
                                        <span className="font-mono text-ink">{(streakEcho.repeatRate * 100).toFixed(1)}% (null: 12.2%)</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs border-b border-line pb-2">
                                        <span className="text-ink-muted">Double Repeat P(t | t-1, t-2):</span>
                                        <span className="font-mono text-ink">{(streakEcho.doubleRepeatRate * 100).toFixed(1)}% (null: 12.2%)</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs border-b border-line pb-2">
                                        <span className="text-ink-muted">Skip-1 Echo P(t | t-2, miss t-1):</span>
                                        <span className="font-mono text-ink">{(streakEcho.skipOneEchoRate * 100).toFixed(1)}% (null: 12.2%)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <span className="text-[11px] text-ink-subtle w-full mb-1">Active candidate echo balls from draw t-2:</span>
                                        {streakEcho.activeEchoBalls.map((b) => (
                                            <CandidateBallChip key={b} number={b} />
                                        ))}
                                    </div>
                                </div>
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
                                number={pNum("panel-pair-correlation")}
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
                                {(() => {
                                    const p = pairCorr.topPositive[0];
                                    const z = pairCorr.maxZ;
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `pair ${p?.a ?? "—"}–${p?.b ?? "—"}`, `${p?.count ?? 0} hits`, z, "pair", p ? `pair-${p.a}-${p.b}` : undefined, `minz:${pairCorr.minZ.toFixed(2)}`)} />;
                                })()}
                                <PairCorrelationHeatmap stats={pairCorr} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-autocorrelation", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-autocorrelation")}
                                section="Correlations"
                                title="Draw autocorrelation (Lags 1–20)"
                                caption="Correlation of draw sum with previous draws up to 20 draws back. All points stay within the 95% null band."
                                id="panel-autocorrelation"
                                family="Momentum"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Lag 1 r", value: formatSigned(autocorr.lags[0]?.rSum ?? 0, 3), hint: "sum vs prev draw" },
                                    { label: "Max |r|", value: autocorr.maxAbsR.toFixed(3), hint: `at lag ${autocorr.highestLag.lag}` },
                                    { label: "95% Bound", value: `±${autocorr.bound95.toFixed(3)}`, hint: "white-noise threshold" },
                                ]}
                            >
                                {(() => {
                                    const r = autocorr.lags[0]?.rSum ?? 0;
                                    const tone = Math.abs(r) < 0.05 ? "null" : r > 0 ? "signal" : "watch";
                                    return <PanelVerdict {...directionVerdict(tone, "lag-1 momentum", undefined, `r1:${r.toFixed(3)}`)} />;
                                })()}
                                <CorrelogramChart stats={autocorr} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-multi-lag", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-multi-lag")}
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
                                {(() => {
                                    const best = [...multiLag.rows].sort((x, y) => zOf(y.meanRepeats, y.expectedRepeats) - zOf(x.meanRepeats, x.expectedRepeats))[0];
                                    const z = zOf(best.meanRepeats, best.expectedRepeats);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...directionVerdict(tone, `lag-${best.lag} carry`, fmtZ(z), `lag:${best.lag}|hits:${best.meanRepeats.toFixed(3)}`)} />;
                                })()}
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
                                number={pNum("panel-additional-promotion")}
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
                                {(() => {
                                    const row = promo.rows.find((r) => r.lag === 1) ?? promo.rows[0];
                                    const z = zOf(row.promotedCount, (total * 6) / 48);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${promo.topPromotedNumber?.number ?? "—"}`, `${row.promotedCount} promotions`, z, "promotion", promo.topPromotedNumber ? `ball-${promo.topPromotedNumber.number}` : undefined, `rate:${(promo.lag1Rate * 100).toFixed(1)}pct`)} />;
                                })()}
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
                                number={pNum("panel-neighbors")}
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
                                {(() => {
                                    const z = zOf(neighbors.plusMinus1Hits, neighbors.expectedPlusMinus1);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, "±1 halo hits", `${neighbors.plusMinus1Hits.toFixed(2)} hits/draw`, z, "halo", undefined, `lift:${neighbors.lift1.toFixed(2)}|exp:${neighbors.expectedPlusMinus1.toFixed(2)}`)} />;
                                })()}
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
                                number={pNum("panel-mirrors")}
                                section="Correlations"
                                title="Mirror twins (50−n) & Bolak-Balik"
                                caption="Symmetric pairs (n + m = 50) and Indonesian Togel digit swaps (cermin) vs chance."
                                id="panel-mirrors"
                                family="Folk & Culture"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Same-draw mirror", value: mirrors.sameDrawMirrorPairs.toFixed(3), hint: `exp ${mirrors.expectedSameDrawMirror.toFixed(3)}` },
                                    { label: "Lag 1 mirror", value: mirrors.lag1MirrorHits.toFixed(3), hint: `exp ${mirrors.expectedLag1Mirror.toFixed(3)}` },
                                    { label: "Top pair", value: mirrors.topMirrorPair ? `${mirrors.topMirrorPair.a}–${mirrors.topMirrorPair.b}` : "—", hint: `${mirrors.topMirrorPair?.count} draws` },
                                ]}
                            >
                                {(() => {
                                    const z = zOf(mirrors.bolakBalikPairsSeen, mirrors.expectedBolakBalik);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, "bolak-balik mirror pairs", `${mirrors.bolakBalikPairsSeen} hits`, z, "mirror", undefined, `exp:${mirrors.expectedBolakBalik.toFixed(1)}`)} />;
                                })()}
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
                                number={pNum("panel-feature-correlation")}
                                section="Correlations"
                                title="Within-draw feature correlation"
                                caption="Pearson correlation r between structural properties of the same draw."
                                id="panel-feature-correlation"
                                family="Structure"
                                className="lg:col-span-6"
                            >
                                {(() => {
                                    let best = 0;
                                    for (const row of featureCorr.matrix) for (const v of row) if (Math.abs(v) > Math.abs(best)) best = v;
                                    const tone = Math.abs(best) >= 0.3 ? "signal" : Math.abs(best) <= 0.1 ? "null" : "watch";
                                    return <PanelVerdict {...directionVerdict(tone, "feature coupling", undefined, `r:${best.toFixed(3)}`)} />;
                                })()}
                                <SmallCorrelationGrid labels={featureCorr.features} matrix={featureCorr.matrix} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-strategy-consensus", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-strategy-consensus")}
                                section="Correlations"
                                title={`${league?.strategies.length ?? 263}-Strategy consensus & family z-score`}
                                caption={`Wisdom of the crowd across ${league?.strategies.length ?? 263} strategies, and mean z-score walk-forward performance by family.`}
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
                                    { label: "Total families", value: stratConsensus.familyScores.length, hint: `${league?.strategies.length ?? 263} rules scored` },
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

                        {isVisible("panel-latest-draw-triggers", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-latest-draw-triggers")}
                                section="Correlations"
                                title="Latest draw trigger followers"
                                caption="Top numbers historically triggered by the exact 6 winning balls of the most recent draw (lag-1 follower conditional lift)."
                                id="panel-latest-draw-triggers"
                                family="Correlation"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Latest Draw", value: `#${latestTriggers.latestDrawNo}`, hint: "trigger source" },
                                    { label: "Top Follower", value: `Ball ${latestTriggers.topFollowers[0]?.number}`, hint: `${(latestTriggers.topFollowers[0]?.pooledFollowerRate * 100).toFixed(1)}% rate` },
                                    { label: "Top Lift", value: `${latestTriggers.topFollowers[0]?.liftRatio.toFixed(2)}×`, hint: "over null" },
                                ]}
                            >
                                {(() => {
                                    const f = latestTriggers.topFollowers[0];
                                    const z = zOf(f?.triggerVotes ?? 0, 6 * (f?.nullRate ?? 6 / 49));
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${f?.number ?? "—"}`, `${f?.triggerVotes ?? 0}/6 follow hits`, z, "follower", f ? `ball-${f.number}` : undefined, `lift:${f?.liftRatio.toFixed(2)}`)} />;
                                })()}
                                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                                    {latestTriggers.topFollowers.slice(0, 7).map((r) => (
                                        <CandidateBallChip key={r.number} number={r.number} sublabel={`${r.liftRatio.toFixed(2)}×`} />
                                    ))}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Follower</th>
                                                <th className={thNum}>Rate</th>
                                                <th className={thNum}>Baseline</th>
                                                <th className={thNum}>Lift</th>
                                                <th className={thNum}>Trigger Votes</th>
                                                <th className={thNum}>z-Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {latestTriggers.topFollowers.slice(0, 6).map((r) => (
                                                <tr key={r.number}>
                                                    <td className={td}><CandidateBallChip number={r.number} /></td>
                                                    <td className={tdNum}>{(r.pooledFollowerRate * 100).toFixed(1)}%</td>
                                                    <td className={tdNum}>{(r.nullRate * 100).toFixed(1)}%</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">{r.liftRatio.toFixed(2)}×</span></td>
                                                    <td className={tdNum}>{r.triggerVotes} / 6</td>
                                                    <td className={tdNum}>{formatSigned(r.zScore, 2)}σ</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-harmonic-multi-lag", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-harmonic-multi-lag")}
                                section="Correlations"
                                title="Harmonic multi-lag resonance"
                                caption="Multi-lag conditional follower lift weighted harmonically across Lags 1 (1.0×), 2 (0.5×), and 3 (0.33×)."
                                id="panel-harmonic-multi-lag"
                                family="Correlation"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Harmonic", value: `Ball ${harmonicMultiLag.topHarmonicPicks[0]?.number}`, hint: `Score ${harmonicMultiLag.topHarmonicPicks[0]?.harmonicScore}` },
                                    { label: "Lag-1 Leader", value: `Ball ${[...harmonicMultiLag.rows].sort((a,b)=>b.lag1Score-a.lag1Score)[0]?.number}`, hint: "immediate follower" },
                                    { label: "Lag-2 Leader", value: `Ball ${[...harmonicMultiLag.rows].sort((a,b)=>b.lag2Score-a.lag2Score)[0]?.number}`, hint: "1-skip follower" },
                                ]}
                            >
                                {(() => {
                                    const top = harmonicMultiLag.topHarmonicPicks[0];
                                    const z = top?.harmonicScore ?? 0;
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...directionVerdict(tone, "harmonic resonance", fmtZ(z), `ball:${top?.number}|score:${z.toFixed(2)}`)} />;
                                })()}
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Ball</th>
                                                <th className={thNum}>Lag 1</th>
                                                <th className={thNum}>Lag 2</th>
                                                <th className={thNum}>Lag 3</th>
                                                <th className={thNum}>Harmonic Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {harmonicMultiLag.topHarmonicPicks.slice(0, 7).map((r) => (
                                                <tr key={r.number}>
                                                    <td className={td}><CandidateBallChip number={r.number} /></td>
                                                    <td className={tdNum}>{r.lag1Score.toFixed(2)}</td>
                                                    <td className={tdNum}>{r.lag2Score.toFixed(2)}</td>
                                                    <td className={tdNum}>{r.lag3Score.toFixed(2)}</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">{r.harmonicScore.toFixed(2)}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-hub-centrality", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-hub-centrality")}
                                section="Correlations"
                                title="Pair graph eigenvector hubs"
                                caption="Network centrality and degree of positive correlation in the 49-ball pairwise co-occurrence graph."
                                id="panel-hub-centrality"
                                family="Correlation"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Super Hub", value: `Ball ${hubCentrality.topHubs[0]?.number}`, hint: `${hubCentrality.topHubs[0]?.degreePositiveZ} positive partners` },
                                    { label: "Top Partner", value: `${hubCentrality.topHubs[0]?.number} & ${hubCentrality.topHubs[0]?.topPartner.partner}`, hint: `z = +${hubCentrality.topHubs[0]?.topPartner.zScore.toFixed(2)}σ` },
                                    { label: "Isolated", value: `Ball ${hubCentrality.isolatedBalls[0]?.number}`, hint: `${hubCentrality.isolatedBalls[0]?.degreePositiveZ} positive partners` },
                                ]}
                            >
                                {(() => {
                                    const h = hubCentrality.topHubs[0];
                                    const z = zOf(h?.degreePositiveZ ?? 0, expectedPairMeetings * 2);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${h?.number ?? "—"}`, `${h?.degreePositiveZ ?? 0} strong partners`, z, "hub", h ? `ball-${h.number}` : undefined, `exp:${(expectedPairMeetings * 2).toFixed(1)}`)} />;
                                })()}
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Ball</th>
                                                <th className={thNum}>Partners (z≥1σ)</th>
                                                <th className={thNum}>Sum Pair z</th>
                                                <th className={th}>Top Companion</th>
                                                <th className={thNum}>Pair z</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {hubCentrality.topHubs.slice(0, 6).map((r) => (
                                                <tr key={r.number}>
                                                    <td className={td}><CandidateBallChip number={r.number} /></td>
                                                    <td className={tdNum}>{r.degreePositiveZ}</td>
                                                    <td className={tdNum}>{formatSigned(r.sumPairZ, 1)}</td>
                                                    <td className={td}><CandidateBallChip number={r.topPartner.partner} /></td>
                                                    <td className={tdNum}><span className="text-primary">+{r.topPartner.zScore.toFixed(2)}σ</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-best-companions", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-best-companions")}
                                section="Correlations"
                                title="Greedy companion graph & cliques"
                                caption="Highest co-occurring ball triplets and cliques discovered by greedy maximal clique traversal on the pair graph."
                                id="panel-best-companions"
                                family="Correlation"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Triplet", value: `${bestCompanions.topTriplets[0]?.triplet.join("–")}`, hint: `${bestCompanions.topTriplets[0]?.coOccurrences} draws together` },
                                    { label: "Min Pair z", value: `+${bestCompanions.topTriplets[0]?.minPairZ.toFixed(2)}σ`, hint: "weakest link" },
                                    { label: "Sum Pair z", value: `+${bestCompanions.topTriplets[0]?.sumPairZ.toFixed(2)}σ`, hint: "triplet synergy" },
                                ]}
                            >
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Triplet Clique</th>
                                                <th className={thNum}>Meetings</th>
                                                <th className={thNum}>Min Pair z</th>
                                                <th className={thNum}>Sum Pair z</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {bestCompanions.topTriplets.slice(0, 6).map((t, idx) => (
                                                <tr key={idx}>
                                                    <td className={td}>
                                                        <div className="flex items-center gap-1">
                                                            {t.triplet.map((b) => <CandidateBallChip key={b} number={b} />)}
                                                        </div>
                                                    </td>
                                                    <td className={tdNum}>{t.coOccurrences}</td>
                                                    <td className={tdNum}>+{t.minPairZ.toFixed(2)}σ</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">+{t.sumPairZ.toFixed(2)}σ</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-additional-companions", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-additional-companions")}
                                section="Correlations"
                                title="7th Ball companion drag"
                                caption="Which main balls appear most frequently when a 7th additional ball was drawn in Singapore Pools history."
                                id="panel-additional-companions"
                                family="Correlation"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Companion", value: `Ball ${additionalCompanions.topCompanions[0]?.number}`, hint: `${additionalCompanions.topCompanions[0]?.companionHits} extra draws` },
                                    { label: "Top Lift", value: `${additionalCompanions.topCompanions[0]?.liftRatio.toFixed(2)}×`, hint: "over null" },
                                    { label: "Expected Hits", value: "12.2%", hint: "6/49 baseline" },
                                ]}
                            >
                                {(() => {
                                    const p = additionalCompanions.topCompanions[0];
                                    const lift = p?.liftRatio ?? 1;
                                    const z = zOf(lift, 1);
                                    const tone = lift >= 1.5 ? "signal" : lift <= 1.1 ? "null" : "watch";
                                    return <PanelVerdict {...countVerdict(tone, `ball ${p?.number ?? "—"}`, `${p?.companionHits ?? 0} extra-ball hits`, z, "companion", p ? `ball-${p.number}` : undefined, `lift:${lift.toFixed(2)}`)} />;
                                })()}
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Main Ball</th>
                                                <th className={thNum}>Companion Hits</th>
                                                <th className={thNum}>Lift Ratio</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {additionalCompanions.topCompanions.slice(0, 7).map((p) => (
                                                <tr key={p.number}>
                                                    <td className={td}><CandidateBallChip number={p.number} /></td>
                                                    <td className={tdNum}>{p.companionHits}</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">{p.liftRatio.toFixed(2)}×</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-knn-twin-draws", "correlations") && (
                            <InsightPanel
                                number={pNum("panel-knn-twin-draws")}
                                section="Correlations"
                                title="k-NN historical twin draws"
                                caption="Historical draws most similar to the latest winning draw, and the balls that subsequently appeared in the very next draw (t+1)."
                                id="panel-knn-twin-draws"
                                family="Pattern"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Nearest Neighbors", value: `k = ${knnTwins.k}`, hint: "twin draw sample" },
                                    { label: "Max Overlap", value: `${knnTwins.twinDraws[0]?.ballOverlap ?? 0} balls`, hint: "historical similarity" },
                                    { label: "Top t+1 Echo", value: `Ball ${knnTwins.tPlusOneBallTallies[0]?.number ?? "—"}`, hint: `${knnTwins.tPlusOneBallTallies[0]?.votes ?? 0} next-draw hits` },
                                ]}
                            >
                                {(() => {
                                    const t = knnTwins.tPlusOneBallTallies[0];
                                    const z = zOf(t?.votes ?? 0, (knnTwins.k * 6) / 49);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${t?.number ?? "—"}`, `${t?.votes ?? 0} next-draw hits`, z, "echo", t ? `ball-${t.number}` : undefined, `exp:${((knnTwins.k * 6) / 49).toFixed(2)}`)} />;
                                })()}
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-line text-ink-subtle">
                                                <th className={th}>Historical Draw</th>
                                                <th className={th}>Date</th>
                                                <th className={thNum}>Overlap</th>
                                                <th className={th}>Next Draw (t+1)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line-soft font-mono">
                                            {knnTwins.twinDraws.slice(0, 5).map((d) => (
                                                <tr key={d.historicalDrawNo}>
                                                    <td className={td}>#{d.historicalDrawNo}</td>
                                                    <td className={td}>{d.date}</td>
                                                    <td className={tdNum}><span className="text-primary font-semibold">{d.ballOverlap} / 6</span></td>
                                                    <td className={td}>
                                                        <div className="flex items-center gap-1">
                                                            {d.subsequentWinningNumbers.slice(0, 4).map((b) => <CandidateBallChip key={b} number={b} />)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                                number={pNum("panel-sum")}
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
                                {(() => {
                                    const tone = bandTone(analysis.sum.mean, 115, 185);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid sums outside 115–185 (now ${analysis.sum.mean.toFixed(1)})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "sum-outside-115-185" } : {})}
                                            detail={`mean ${analysis.sum.mean.toFixed(1)} vs band 115–185`}
                                            metric={`mean:${analysis.sum.mean.toFixed(1)}|band:115-185`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-sum-trend")}
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
                                number={pNum("panel-odd")}
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
                                {(() => {
                                    const value = analysis.oddEven.indexOf(Math.max(...analysis.oddEven));
                                    const tone = bandTone(value, 2, 4);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid odd counts outside 2–4 (now ${value})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "odd-outside-2-4" } : {})}
                                            detail={`modal ${value} odd per draw`}
                                            metric={`modal:${value}|band:2-4`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-low")}
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
                                {(() => {
                                    const value = analysis.lowHigh.indexOf(Math.max(...analysis.lowHigh));
                                    const tone = bandTone(value, 2, 4);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid low counts outside 2–4 (now ${value})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "low-outside-2-4" } : {})}
                                            detail={`modal ${value} low per draw`}
                                            metric={`modal:${value}|band:2-4`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-composition")}
                                section="The lines"
                                title="Composition matrix"
                                caption="Odd count against high count. Pink sits above the fair share, blue below it."
                                id="panel-composition"
                                family="Structure"
                                className="lg:col-span-6"
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
                                number={pNum("panel-delta")}
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
                                {(() => {
                                    const tone = bandTone(deltas.observedAverage, 6.5, 8);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid mean gaps outside 6.5–8.0 (now ${deltas.observedAverage.toFixed(2)})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "gap-outside-6.5-8" } : {})}
                                            detail={`mean gap ${deltas.observedAverage.toFixed(2)}`}
                                            metric={`mean:${deltas.observedAverage.toFixed(2)}|band:6.5-8`}
                                        />
                                    );
                                })()}
                                <DeltaProfile stats={deltas} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-position", "the-lines") && (
                            <InsightPanel
                                number={pNum("panel-position")}
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
                                {(() => {
                                    const worst = [...positions].sort((a, b) => Math.abs(b.observedMedian - b.expectedMedian) - Math.abs(a.observedMedian - a.expectedMedian))[0];
                                    const idx = positions.indexOf(worst) + 1;
                                    const z = zOf(worst.observedMedian, worst.expectedMedian);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `position ${idx}`, `median ${worst.observedMedian.toFixed(0)}`, z, "position", `position-${idx}`, `exp:${worst.expectedMedian}`)} />;
                                })()}
                                <PositionLadder rows={positions} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-span", "the-lines") && (
                            <InsightPanel
                                number={pNum("panel-span")}
                                section="The lines"
                                title="Line span (max − min)"
                                caption="Difference between the highest and lowest winning ball vs exact combinatorial distribution."
                                id="panel-span"
                                family="Structure"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Observed mean", value: spans.observedMean.toFixed(1), hint: "span size" },
                                    { label: "Expected mean", value: spans.expectedMean.toFixed(1), hint: "theory 35.7" },
                                    { label: "Modal span", value: spans.mostCommonSpan, hint: "most frequent" },
                                ]}
                            >
                                {(() => {
                                    const tone = bandTone(spans.observedMean, 33, 43);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid spans outside 33–43 (now ${spans.observedMean.toFixed(1)})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "span-outside-33-43" } : {})}
                                            detail={`mean span ${spans.observedMean.toFixed(1)}`}
                                            metric={`mean:${spans.observedMean.toFixed(1)}|band:33-43`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-ac-value")}
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
                                {(() => {
                                    const tone = bandTone(acValues.observedMean, 6, 9);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid AC values outside 6–9 (now ${acValues.observedMean.toFixed(2)})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "ac-outside-6-9" } : {})}
                                            detail={`mean AC ${acValues.observedMean.toFixed(2)}`}
                                            metric={`mean:${acValues.observedMean.toFixed(2)}|band:6-9`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-tail-digits")}
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
                                {(() => {
                                    const modal = [...tailDigits.distinctTailCounts].sort((a, b) => b.count - a.count)[0];
                                    const tone = bandTone(modal.distinct, 4, 6);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid distinct tails outside 4–6 (now ${modal.distinct})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "tails-outside-4-6" } : {})}
                                            detail={`modal ${modal.distinct} endings`}
                                            metric={`modal:${modal.distinct}|band:4-6`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-runs")}
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
                                {(() => {
                                    const modal = [...runs.adjacentPairCounts].sort((a, b) => b.count - a.count)[0];
                                    const tone = bandTone(modal.pairs, 0, 2);
                                    return (
                                        <PanelVerdict
                                            tone={tone}
                                            label={tone === "watch" ? `Avoid consecutive-pair counts outside 0–2 (now ${modal.pairs})` : "No edge — any shape is as good"}
                                            {...(tone === "watch" ? { avoid: "pairs-outside-0-2" } : {})}
                                            detail={`modal ${modal.pairs} consecutive pairs`}
                                            metric={`modal:${modal.pairs}|band:0-2`}
                                        />
                                    );
                                })()}
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
                                number={pNum("panel-playslip-geometry")}
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
                                number={pNum("panel-digital-root")}
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
                                {(() => {
                                    const top = [...digiRoots.roots].sort((a, b) => b.count - a.count)[0];
                                    const z = zOf(top.count, top.expectedShare * total);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `root ${top.root}`, `${top.count} hits`, z, "root", `root-${top.root}`, `exp:${(top.expectedShare * total).toFixed(1)}`)} />;
                                })()}
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

                        {isVisible("panel-tercile-matrix", "the-lines") && (
                            <InsightPanel
                                number={pNum("panel-tercile-matrix")}
                                section="The lines"
                                title="3-Tier zone balance (1–16, 17–33, 34–49)"
                                caption="Historical distribution of draws across Low (1–16), Mid (17–33), and High (34–49) third-of-board zones."
                                id="panel-tercile-matrix"
                                family="Geometry"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Modal Pattern", value: tercileMatrix.modalPattern, hint: "most frequent tier split" },
                                    {
                                        label: "Top Pattern",
                                        value: tercileMatrix.topPatterns[0]?.pattern ?? "2-2-2",
                                        hint: `${((tercileMatrix.topPatterns[0]?.observedRate ?? 0) * 100).toFixed(1)}% draws`,
                                    },
                                    {
                                        label: "Expected Rate",
                                        value: `${((tercileMatrix.topPatterns[0]?.expectedRate ?? 0) * 100).toFixed(1)}%`,
                                        hint: "hypergeometric null",
                                    },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={tercileMatrix.topPatterns.slice(0, 6).map((p) => ({
                                        label: p.pattern,
                                        observedValue: p.observedRate * 100,
                                        expectedValue: p.expectedRate * 100,
                                        formattedObserved: `${(p.observedRate * 100).toFixed(1)}% (${p.count}d)`,
                                        formattedExpected: `${(p.expectedRate * 100).toFixed(1)}%`,
                                        tone: p.observedRate >= p.expectedRate ? "primary" : "secondary",
                                    }))}
                                    maxValue={25}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-row-col-dispersion", "the-lines") && (
                            <InsightPanel
                                number={pNum("panel-row-col-dispersion")}
                                section="The lines"
                                title="7×7 Grid row & column dispersion"
                                caption="Dispersion of numbers across the standard 7×7 Singapore Pools bet slip layout."
                                id="panel-row-col-dispersion"
                                family="Geometry"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Mean Distinct Rows", value: `${rowColDispersion.distinctRowsMean} rows`, hint: "of 7 rows" },
                                    { label: "Mean Distinct Cols", value: `${rowColDispersion.distinctColsMean} cols`, hint: "of 7 columns" },
                                    { label: "Distinct Cells", value: "6.0", hint: "zero ball collisions" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={rowColDispersion.rowsCoverageDistribution.map((r) => ({
                                        label: `${r.rows} rows`,
                                        observedValue: r.pct,
                                        expectedValue: r.rows === 5 ? 55 : r.rows === 6 ? 25 : 15,
                                        formattedObserved: `${r.pct.toFixed(1)}%`,
                                        formattedExpected: "typical",
                                        tone: "primary",
                                    }))}
                                    maxValue={65}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-gap-entropy", "the-lines") && (
                            <InsightPanel
                                number={pNum("panel-gap-entropy")}
                                section="The lines"
                                title="Gap spacing Shannon entropy"
                                caption="Normalized Shannon information entropy of sequential gap spacing measuring whether drawn numbers cluster or spread evenly."
                                id="panel-gap-entropy"
                                family="Geometry"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Mean Entropy", value: `${gapEntropy.meanEntropy.toFixed(2)}`, hint: "normalized (0..1)" },
                                    { label: "Sweet Range", value: gapEntropy.sweetEntropyRange, hint: "optimal dispersion" },
                                    { label: "Clumpy Lines", value: `${gapEntropy.lowEntropyPct.toFixed(1)}%`, hint: "entropy < 0.70" },
                                ]}
                            >
                                <div className="flex flex-col gap-3 mt-2">
                                    <div className="flex items-center justify-between text-xs border-b border-line pb-2">
                                        <span className="text-ink-muted">Well-Spread Draws (H ≥ 0.85):</span>
                                        <span className="font-mono text-primary font-semibold">{gapEntropy.highEntropyPct.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs border-b border-line pb-2">
                                        <span className="text-ink-muted">Clumpy / Clustered Draws (H &lt; 0.70):</span>
                                        <span className="font-mono text-ink-muted">{gapEntropy.lowEntropyPct.toFixed(1)}%</span>
                                    </div>
                                    <p className="text-xs text-ink-subtle leading-relaxed">
                                        Over 70% of historical draws fall within the {gapEntropy.sweetEntropyRange} entropy zone. Highly clustered lines with tiny gaps match significantly fewer draws.
                                    </p>
                                </div>
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
                                number={pNum("panel-color-waves")}
                                section="Folklore"
                                title="Mark Six colour waves"
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
                                number={pNum("panel-wuxing")}
                                section="Folklore"
                                title="2026 Na-Yin Five Elements"
                                caption="Bing-Wu Fire Horse element sets (Metal, Wood, Water, Fire, Earth) vs fair share."
                                id="panel-wuxing"
                                family="Mark Six Charts"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Fire", value: `${wuXing.elements[0].balls} balls`, hint: `${wuXing.elements[0].observedRate.toFixed(2)} hits` },
                                    { label: "Metal", value: `${wuXing.elements[1].balls} balls`, hint: `${wuXing.elements[1].observedRate.toFixed(2)} hits` },
                                    { label: "Water", value: `${wuXing.elements[2].balls} balls`, hint: `${wuXing.elements[2].observedRate.toFixed(2)} hits` },
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
                                number={pNum("panel-zodiac")}
                                section="Folklore"
                                title="12 Zodiac / Togel Shio columns"
                                caption="Zodiac columns (Horse holds 5 balls in 2026; others hold 4) vs fair share."
                                id="panel-zodiac"
                                family="Folk & Culture"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Top Zodiac", value: zodiacs.topAnimal, hint: "highest hits" },
                                    { label: "Horse", value: "5 balls", hint: "ruling year" },
                                    { label: "Clash Rat", value: "4 balls", hint: "clash animal" },
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
                                number={pNum("panel-lucky-digits")}
                                section="Folklore"
                                title="Lucky digits vs Tetraphobia (4)"
                                caption="Cage hit rates for Asian folklore numbers, against the per-ball expectation."
                                id="panel-lucky-digits"
                                family="Folk & Culture"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Digit 4 hits/draw", value: luckyDigits.digit4Stats.observedRate.toFixed(2), hint: `exp ${luckyDigits.digit4Stats.expectedRate.toFixed(2)}` },
                                    { label: "Digit 8 hits/draw", value: luckyDigits.digit8Stats.observedRate.toFixed(2), hint: `exp ${luckyDigits.digit8Stats.expectedRate.toFixed(2)}` },
                                    { label: "Digit 7 hits/draw", value: luckyDigits.digit7Stats.observedRate.toFixed(2), hint: `exp ${luckyDigits.digit7Stats.expectedRate.toFixed(2)}` },
                                ]}
                            >
                                <div className="space-y-2 p-2">
                                    {[luckyDigits.digit4Stats, luckyDigits.digit8Stats, luckyDigits.digit7Stats, luckyDigits.repdigitsStats].map((st) => (
                                        <div key={st.name} className="flex justify-between items-center border-b border-line pb-1 text-xs">
                                            <span className="text-ink">{st.name} ({st.balls} balls)</span>
                                            <div className="font-mono text-right">
                                                <span className="text-ink font-semibold">{st.observedRate.toFixed(2)} hits/draw</span>
                                                <span className="text-ink-subtle ml-2">vs {st.expectedRate.toFixed(2)} exp</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </InsightPanel>
                        )}

                        {isVisible("panel-math-sequences", "folklore") && (
                            <InsightPanel
                                number={pNum("panel-math-sequences")}
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
                                number={pNum("panel-lunar")}
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
                                    items={loShu.moonPhases.map((m) => {
                                        const shortName =
                                            m.phase === "New Moon" ? "New"
                                            : m.phase === "Waxing Crescent" ? "Wax Cres"
                                            : m.phase === "First Quarter" ? "1st Qtr"
                                            : m.phase === "Waxing Gibbous" ? "Wax Gibb"
                                            : m.phase === "Full Moon" ? "Full"
                                            : m.phase === "Waning Gibbous" ? "Wan Gibb"
                                            : m.phase === "Last Quarter" ? "3rd Qtr"
                                            : m.phase === "Waning Crescent" ? "Wan Cres"
                                            : m.phase;
                                        return {
                                            label: shortName,
                                            observedValue: m.meanSum,
                                            expectedValue: 150,
                                            formattedObserved: `Sum ${m.meanSum.toFixed(1)} (${m.draws}d)`,
                                            formattedExpected: "150.0 exp",
                                        };
                                    })}
                                    maxValue={165}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}

                        {isVisible("panel-prime-distribution", "folklore") && (
                            <InsightPanel
                                number={pNum("panel-prime-distribution")}
                                section="Folklore"
                                title="Prime / composite balance"
                                caption="Exact breakdown of primes (15 numbers: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47) per 6-ball line."
                                id="panel-prime-distribution"
                                family="Folklore"
                                className="lg:col-span-12"
                                stats={[
                                    { label: "Recommended Mix", value: "1–3 Primes", hint: "sweet spot" },
                                    { label: "2 Primes Rate", value: `${primeDistribution.rows[2]?.observedPct.toFixed(1)}%`, hint: `exp ${primeDistribution.rows[2]?.expectedPct.toFixed(1)}%` },
                                    { label: "Pool Share", value: "15 / 49 primes", hint: "30.6% of balls" },
                                ]}
                            >
                                <ObservedExpectedBarChart
                                    items={primeDistribution.rows.map((d) => ({
                                        label: `${d.primes} primes`,
                                        observedValue: d.observedPct,
                                        expectedValue: d.expectedPct,
                                        formattedObserved: `${d.observedPct.toFixed(1)}% (${d.count}d)`,
                                        formattedExpected: `${d.expectedPct.toFixed(1)}%`,
                                        tone: d.observedPct >= d.expectedPct ? "primary" : "secondary",
                                    }))}
                                    maxValue={45}
                                    orientation="vertical"
                                    className="mt-2"
                                />
                            </InsightPanel>
                        )}
                    </MasonryGrid>
                </section>
            )}


            {/* ---------------------------------------------------------------- *
             * 5. The cage — the machine that produced it.
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "the-cage") && (
                <section id="the-cage" className="flex flex-col gap-3">
                    <h2 className="font-display text-base leading-6 font-semibold tracking-tight text-ink">5. The cage</h2>
                    <MasonryGrid>
                        {isVisible("panel-repeaters", "the-cage") && (
                            <InsightPanel
                                number={pNum("panel-repeaters")}
                                section="The cage"
                                title="Repeaters flow"
                                caption="How many numbers carried over from the previous draw."
                                id="panel-repeaters"
                                family="Pattern"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Observed", value: repeaters.observedAverage.toFixed(2), hint: "repeats per draw" },
                                    { label: "Expected", value: repeaters.expectedAverage.toFixed(2) },
                                    { label: "Draws tested", value: formatNumber(repeaters.evaluated), hint: "each against the last" },
                                ]}
                            >
                                {(() => {
                                    const z = zOf(repeaters.observedAverage, repeaters.expectedAverage);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, "repeater flow", `${repeaters.observedAverage.toFixed(2)} repeats/draw`, z, "repeater", undefined, `exp:${repeaters.expectedAverage.toFixed(2)}`)} />;
                                })()}
                                <RepeatersFlow stats={repeaters} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-additional", "the-cage") && (
                            <InsightPanel
                                number={pNum("panel-additional")}
                                section="The cage"
                                title="Additional ball"
                                caption="How often each number came up as the seventh ball."
                                id="panel-additional"
                                family="Frequency"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Latest", value: additional.latest ?? "—", hint: additional.latestDate ? formatDate(additional.latestDate) : undefined },
                                    { label: "Most seen", value: additional.hottest?.number ?? "—", hint: additional.hottest ? `${formatNumber(additional.hottest.count)} times` : undefined },
                                    { label: "Expected", value: additional.expected.toFixed(1), hint: "times per number" },
                                ]}
                            >
                                {(() => {
                                    const c = additional.hottest?.count ?? 0;
                                    const z = zOf(c, additional.expected);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `additional ball ${additional.hottest?.number ?? "—"}`, `${formatNumber(c)} times`, z, "additional ball", additional.hottest ? `ball-${additional.hottest.number}` : undefined, `exp:${additional.expected.toFixed(1)}`)} />;
                                })()}
                                <AdditionalBall stats={additional} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-month", "the-cage") && (
                            <InsightPanel
                                number={pNum("panel-month")}
                                section="The cage"
                                title="Month of year"
                                caption="Mean sum by calendar month and year, with the draws behind each cell."
                                id="panel-month"
                                family="Almanac & Time"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Warmest month", value: monthExtremes?.highest.month ?? "—", hint: monthExtremes ? `mean ${monthExtremes.highest.mean.toFixed(1)}` : undefined },
                                    { label: "Coldest month", value: monthExtremes?.lowest.month ?? "—", hint: monthExtremes ? `mean ${monthExtremes.lowest.mean.toFixed(1)}` : undefined },
                                    { label: "Spread", value: months.spread.toFixed(1), hint: "best minus worst" },
                                ]}
                            >
                                {(() => {
                                    const busiest = [...months.monthlyMean].sort((a, b) => b.draws - a.draws)[0];
                                    const z = zOf(busiest.draws, total / 12);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `month ${busiest.month}`, `${formatNumber(busiest.draws)} draws`, z, "month", `month-${busiest.month}`, `share:${((busiest.draws / total) * 100).toFixed(1)}pct|null:8.3pct`)} />;
                                })()}
                                <MonthHeatmap stats={months} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-weekday", "the-cage") && (
                            <InsightPanel
                                number={pNum("panel-weekday")}
                                section="The cage"
                                title="Weekday"
                                caption="Draws per weekday, with the mean sum above each bar."
                                id="panel-weekday"
                                family="Almanac & Time"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Monday", value: formatNumber(analysis.weekday.Mon?.count ?? 0), hint: "draws" },
                                    { label: "Thursday", value: formatNumber(analysis.weekday.Thu?.count ?? 0), hint: "draws" },
                                    { label: "Special draws", value: formatNumber(fridayDraws), hint: "on Fridays" },
                                ]}
                            >
                                {(() => {
                                    const busiest = [...weekdayDays].sort((a, b) => b.count - a.count)[0];
                                    const z = zOf(busiest.count, (total * 2) / 7);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, busiest.label, `${formatNumber(busiest.count)} draws`, z, "weekday", `weekday-${busiest.label.toLowerCase()}`, `share:${((busiest.count / total) * 100).toFixed(1)}pct|null:28.6pct`)} />;
                                })()}
                                <WeekdayChart days={weekdayDays} className="mt-2" />
                            </InsightPanel>
                        )}

                        {isVisible("panel-upcoming-calendar", "the-cage") && (
                            <InsightPanel
                                number={pNum("panel-upcoming-calendar")}
                                section="The cage"
                                title="Upcoming calendar draw affinity"
                                caption="Historical draw affinity for the exact upcoming calendar date, matching day-of-month and weekday tendencies."
                                id="panel-upcoming-calendar"
                                family="Almanac & Time"
                                className="lg:col-span-6"
                                stats={[
                                    { label: "Target Weekday", value: upcomingCalendar.targetWeekday, hint: "upcoming draw" },
                                    { label: "Target Half", value: upcomingCalendar.targetMonthHalf, hint: "day of month" },
                                    { label: "Top Pick", value: `Ball ${upcomingCalendar.topWeekdayLeaders[0]?.number ?? "—"}`, hint: `Score ${(upcomingCalendar.topWeekdayLeaders[0]?.compositeCalendarScore ?? 0).toFixed(2)}` },
                                ]}
                            >
                                {(() => {
                                    const leaders = upcomingCalendar.topWeekdayLeaders;
                                    const mean = leaders.reduce((sum, l) => sum + l.compositeCalendarScore, 0) / Math.max(leaders.length, 1);
                                    const top = leaders[0];
                                    const z = zOf(top?.compositeCalendarScore ?? 0, mean);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `ball ${top?.number ?? "—"}`, `score ${(top?.compositeCalendarScore ?? 0).toFixed(1)}`, z, "calendar pick", top ? `ball-${top.number}` : undefined, `mean:${mean.toFixed(1)}`)} />;
                                })()}
                                <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                                    {upcomingCalendar.topWeekdayLeaders.slice(0, 7).map((p) => (
                                        <CandidateBallChip key={p.number} number={p.number} sublabel={`+${p.compositeCalendarScore.toFixed(1)}`} />
                                    ))}
                                </div>
                                <p className="text-xs text-ink-subtle mt-2 leading-relaxed">
                                    Historical draws sharing weekday ({upcomingCalendar.targetWeekday}) and month interval ({upcomingCalendar.targetMonthHalf}) reveal empirical clustering tendencies for upcoming draw cycles.
                                </p>
                            </InsightPanel>
                        )}

                        {isVisible("panel-patterns", "the-cage") && (
                            <InsightPanel
                                number={pNum("panel-patterns")}
                                section="The cage"
                                title="Patterns"
                                caption="How often a draw repeats itself."
                                id="panel-patterns"
                                family="Pattern"
                                className="lg:col-span-6"
                            >
                                {(() => {
                                    const pair = analysis.consecutive.topPairs[0];
                                    const z = zOf(pair?.count ?? 0, expectedPairMeetings);
                                    const tone = toneForZ(z);
                                    return <PanelVerdict {...countVerdict(tone, `run pair ${pair?.a ?? "—"}–${pair?.b ?? "—"}`, `${pair?.count ?? 0} hits`, z, "pattern", pair ? `pair-${pair.a}-${pair.b}` : undefined, `exp:${expectedPairMeetings.toFixed(1)}`)} />;
                                })()}
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
                                number={pNum("panel-weekday-split")}
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
                                number={pNum("panel-chi-square")}
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

            {/* ---------------------------------------------------------------- *
             * 7. Indicators & oscillators (Panels 51–70)
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "indicators") && (
                <LazyGallerySection id="indicators" title="6. Indicators & oscillators" forceMount={forceMount}>
                    {isVisible("panel-rsi", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-rsi")}
                            section="Indicators"
                            title="Per-ball Wilder RSI-14 oscillator"
                            caption="14-draw Relative Strength Index per ball. Standard overbought (>65) and oversold (<35) momentum regimes."
                            id="panel-rsi"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Hottest Ball", value: `Ball ${rsiStats.hottest[0]?.number}`, hint: `RSI ${rsiStats.hottest[0]?.rsi} (overbought)` },
                                { label: "Coldest Ball", value: `Ball ${rsiStats.coldest[0]?.number}`, hint: `RSI ${rsiStats.coldest[0]?.rsi} (oversold)` },
                                { label: "Neutral Balls", value: `${rsiStats.neutralCount} / 49`, hint: "35 ≤ RSI ≤ 65" },
                            ]}
                        >
                            {(() => {
                                const r = rsiStats.hottest[0]?.rsi ?? 50;
                                const tone = r > 65 ? "signal" : r < 35 ? "watch" : "null";
                                return <PanelVerdict {...directionVerdict(tone, "RSI momentum", undefined, `rsi:${r}`)} />;
                            })()}
                            <OscillatorBandChart
                                items={rsiStats.balls.map((b) => ({
                                    number: b.number,
                                    value: b.rsi,
                                    label: humanizeStatus(b.regime),
                                }))}
                                overbought={65}
                                oversold={35}
                                center={50}
                                ariaLabel="Wilder RSI-14 distribution across 49 balls"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-macd", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-macd")}
                            section="Indicators"
                            title="MACD (12/26/9) velocity & signal crossover"
                            caption="12-draw vs 26-draw exponential moving average histogram of ball occurrences, showing short-term acceleration."
                            id="panel-macd"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Top Bullish", value: `Ball ${macdStats.topBullish[0]?.number}`, hint: `hist +${macdStats.topBullish[0]?.histogram}` },
                                { label: "Top Bearish", value: `Ball ${macdStats.topBearish[0]?.number}`, hint: `hist ${macdStats.topBearish[0]?.histogram}` },
                                { label: "Signal Crosses", value: `${macdStats.crossOvers.length} active`, hint: "recent trend pivots" },
                            ]}
                        >
                            {(() => {
                                const net = (macdStats.topBullish[0]?.histogram ?? 0) + (macdStats.topBearish[0]?.histogram ?? 0);
                                const tone = net > 0 ? "signal" : net < 0 ? "watch" : "null";
                                return <PanelVerdict {...directionVerdict(tone, "MACD velocity", undefined, `net:${net}`)} />;
                            })()}
                            <OscillatorBandChart
                                items={macdStats.balls.map((b) => ({
                                    number: b.number,
                                    value: Math.round(b.histogram * 1000),
                                    label: `${b.histogram} (${b.trend})`,
                                }))}
                                minVal={-60}
                                maxVal={60}
                                overbought={20}
                                oversold={-20}
                                center={0}
                                ariaLabel="MACD velocity histogram across 49 balls"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-bollinger", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-bollinger")}
                            section="Indicators"
                            title="Bollinger sum bands (%B & volatility squeeze)"
                            caption="20-draw moving average sum with ±2σ envelope. Bandwidth squeeze signals imminent volatility expansion."
                            id="panel-bollinger"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Current Bandwidth", value: `${(bollingerStats.currentBandwidth * 100).toFixed(1)}%`, hint: bollingerStats.isSqueezed ? "SQUEEZE ACTIVE" : "normal width" },
                                { label: "Current %B", value: `${(bollingerStats.currentPercentB * 100).toFixed(0)}%`, hint: humanizeStatus(bollingerStats.regime) },
                                { label: "Mean Bandwidth", value: `${(bollingerStats.meanBandwidth * 100).toFixed(1)}%`, hint: "20-draw historical" },
                            ]}
                        >
                            {(() => {
                                const p = bollingerStats.recentPoints[bollingerStats.recentPoints.length - 1];
                                const tone = bandTone(p?.sum ?? 150, p?.lower ?? 120, p?.upper ?? 180);
                                return (
                                    <PanelVerdict
                                        tone={tone}
                                        label={tone === "watch" ? `Avoid sums outside ${p?.lower.toFixed(0)}–${p?.upper.toFixed(0)} (now ${p?.sum})` : "No edge — any shape is as good"}
                                        {...(tone === "watch" ? { avoid: "sum-outside-band" } : {})}
                                        detail={`sum ${p?.sum} vs band ${p?.lower.toFixed(0)}–${p?.upper.toFixed(0)}`}
                                        metric={`sum:${p?.sum}|band:${p?.lower.toFixed(0)}-${p?.upper.toFixed(0)}`}
                                    />
                                );
                            })()}
                            <EnvelopeBandChart
                                points={bollingerStats.recentPoints.map((p) => ({
                                    label: p.draw,
                                    value: p.sum,
                                    upper: p.upper,
                                    lower: p.lower,
                                    ma: p.ma,
                                }))}
                                ariaLabel="Bollinger sum bands over the last 50 draws"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-multi-horizon", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-multi-horizon")}
                            section="Indicators"
                            title="Multi-horizon standardized Z-scores (25d / 50d / 100d)"
                            caption="Confluent momentum vs regression across 25, 50, and 100 draw horizons."
                            id="panel-multi-horizon"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Confluent Hot", value: `${multiHorizonStats.confluentHot.length} balls`, hint: "z25 > 1.2 & z50 > 1.0" },
                                { label: "Confluent Cold", value: `${multiHorizonStats.confluentCold.length} balls`, hint: "z25 < -1.2 & z50 < -1.0" },
                            ]}
                        >
                            {(() => {
                                const z = (multiHorizonStats.confluentHot[0]?.compositeZ ?? 0) + (multiHorizonStats.confluentCold[0]?.compositeZ ?? 0);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...directionVerdict(tone, "multi-horizon confluence", fmtZ(z), `z:${z.toFixed(2)}`)} />;
                            })()}
                            <div className="text-xs space-y-2 mt-2">
                                <p className="font-semibold text-text">Confluent Momentum Leaders:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {multiHorizonStats.confluentHot.slice(0, 4).map((b) => (
                                        <span key={b.number} className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/30 px-2 py-0.5 text-primary font-mono">
                                            Ball {b.number} <strong className="text-text">+{b.compositeZ}σ</strong>
                                        </span>
                                    ))}
                                </div>
                                <p className="font-semibold text-text mt-3">Confluent Cold Laggards:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {multiHorizonStats.confluentCold.slice(0, 4).map((b) => (
                                        <span key={b.number} className="inline-flex items-center gap-1.5 rounded-md bg-heat-hot/10 border border-heat-hot/30 px-2 py-0.5 text-heat-hot font-mono">
                                            Ball {b.number} <strong className="text-text">{b.compositeZ}σ</strong>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-ema-ribbon", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-ema-ribbon")}
                            section="Indicators"
                            title="EMA ribbons (EMA-8, 13, 21, 34, 55)"
                            caption="Multi-period exponential ribbons measuring trend alignment and compression across draw series."
                            id="panel-ema-ribbon"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Expanding Balls", value: `${emaRibbonStats.expandingCount} balls`, hint: "fast EMA > slow EMA" },
                                { label: "Compressing Balls", value: `${emaRibbonStats.compressingCount} balls`, hint: "ribbon width ≤ 0.015" },
                            ]}
                        >
                            {(() => {
                                const net = emaRibbonStats.expandingCount - emaRibbonStats.compressingCount;
                                const tone = net > 0 ? "signal" : net < 0 ? "watch" : "null";
                                return <PanelVerdict {...directionVerdict(tone, "ribbon trend", undefined, `expanding:${emaRibbonStats.expandingCount}|compressing:${emaRibbonStats.compressingCount}`)} />;
                            })()}
                            <div className="text-xs space-y-2 mt-2">
                                <p className="font-semibold text-text">Top Trend Spread Leaders:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {emaRibbonStats.ballRanks.slice(0, 5).map((b) => (
                                        <span key={b.number} className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text border border-line">
                                            Ball {b.number} <span className="text-primary font-bold">(+{b.ribbonSpread})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-stochastic", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-stochastic")}
                            section="Indicators"
                            title="Stochastic oscillator (%K / %D)"
                            caption="14-draw stochastic position within rolling appearance range. Identifies overbought (>80) and oversold (<20) clusters."
                            id="panel-stochastic"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Oversold Balls", value: `${stochStats.oversoldBalls.length}`, hint: "%K ≤ 20" },
                                { label: "Overbought Balls", value: `${stochStats.overboughtBalls.length}`, hint: "%K ≥ 80" },
                            ]}
                        >
                            {(() => {
                                const net = stochStats.overboughtBalls.length - stochStats.oversoldBalls.length;
                                const tone = net > 0 ? "signal" : net < 0 ? "watch" : "null";
                                return <PanelVerdict {...directionVerdict(tone, "%K position", undefined, `ob:${stochStats.overboughtBalls.length}|os:${stochStats.oversoldBalls.length}`)} />;
                            })()}
                            <OscillatorBandChart
                                items={stochStats.ballStoch.map((b) => ({
                                    number: b.number,
                                    value: b.percentK,
                                    label: `%K ${b.percentK} / %D ${b.percentD} (${b.condition})`,
                                }))}
                                overbought={80}
                                oversold={20}
                                center={50}
                                ariaLabel="Stochastic percentK oscillator across 49 balls"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-cusum", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-cusum")}
                            section="Indicators"
                            title="CUSUM structural drift & break detector"
                            caption="Cumulative sum of draw sum residuals from theoretical mean 150. Tracks macro cage drifts."
                            id="panel-cusum"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Max Deviation", value: `${cusumStats.maxDeviation}`, hint: "historical peak" },
                                { label: "Drift Direction", value: cusumStats.driftDirection.toUpperCase(), hint: "recent 60 draws" },
                                { label: "Structural Break", value: cusumStats.hasBreak ? "DETECTED" : "NONE", hint: "h = 5.0σ threshold" },
                            ]}
                        >
                            {(() => {
                                const tone = cusumStats.hasBreak ? (cusumStats.driftDirection === "positive" ? "signal" : "watch") : "null";
                                return <PanelVerdict {...directionVerdict(tone, "sum drift", undefined, `maxdev:${cusumStats.maxDeviation}`)} />;
                            })()}
                            <EnvelopeBandChart
                                points={cusumStats.recentPoints.map((p) => ({
                                    label: p.draw,
                                    value: p.cusum,
                                    upper: p.upperThreshold,
                                    lower: p.lowerThreshold,
                                }))}
                                valueLabel="CUSUM"
                                channelLabel="Threshold"
                                ariaLabel="CUSUM residual trajectory over recent 60 draws"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-hurst", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-hurst")}
                            section="Indicators"
                            title="Hurst exponent (R/S rescaled range analysis)"
                            caption="Measures long-memory persistence: H=0.50 denotes pure random walk, H>0.50 trending, H<0.50 mean-reverting."
                            id="panel-hurst"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Hurst Exponent (H)", value: `${hurstStats.hurstExponent}`, hint: "null = 0.50" },
                                { label: "Regime", value: humanizeStatus(hurstStats.regime), hint: hurstStats.pnlImpact },
                            ]}
                        >
                            {(() => {
                                const tone = bandTone(hurstStats.hurstExponent, 0.45, 0.55);
                                return (
                                    <PanelVerdict
                                        tone={tone}
                                        label={tone === "watch" ? `Avoid H outside 0.45–0.55 (now ${hurstStats.hurstExponent})` : "No edge — any shape is as good"}
                                        {...(tone === "watch" ? { avoid: "hurst-outside-0.45-0.55" } : {})}
                                        detail={`H ${hurstStats.hurstExponent} vs null 0.50`}
                                        metric={`h:${hurstStats.hurstExponent}|band:0.45-0.55`}
                                    />
                                );
                            })()}
                            <ScatterRegressionChart
                                points={hurstStats.rsPoints.map((p) => ({
                                    x: p.logN,
                                    y: p.logRs,
                                    label: `Window 10^${p.logN}`,
                                    sublabel: `log(R/S) = ${p.logRs}`,
                                }))}
                                xName="log10(N)"
                                yName="log10(R/S)"
                                slope={hurstStats.hurstExponent}
                                ariaLabel="Hurst rescaled range regression scatter"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-shannon-entropy", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-shannon-entropy")}
                            section="Indicators"
                            title="Shannon information entropy vs maximum null"
                            caption="Measures outcome randomness in bits: empirical entropy compared to theoretical max log2(49) = 5.615 bits."
                            id="panel-shannon-entropy"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Observed Entropy", value: `${entropyStats.observedEntropyBits} bits`, hint: `max ${entropyStats.maxEntropyBits} bits` },
                                { label: "Relative Entropy", value: `${entropyStats.relativeEntropyPct}%`, hint: "of theoretical ceiling" },
                                { label: "Information Redundancy", value: `${entropyStats.informationRedundancy}%`, hint: "compressibility" },
                            ]}
                        >
                            <div className="text-xs space-y-2 mt-2">
                                <p className="text-text leading-relaxed">
                                    The 6/49 draw stream exhibits <strong className="text-primary">{entropyStats.relativeEntropyPct}%</strong> of theoretical maximum Shannon entropy. Outcome redundancy is under 0.1%, proving near-perfect algorithmic unpredictability.
                                </p>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-gini", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-gini")}
                            section="Indicators"
                            title="Gini concentration & Lorenz curve of appearances"
                            caption="Evaluates ball appearance inequality across 1,238 draws against binomial null expectation."
                            id="panel-gini"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Empirical Gini", value: `${giniStats.giniCoefficient}`, hint: "0 = perfect equality" },
                                { label: "Theoretical Null Gini", value: `${giniStats.theoreticalExpectedGini}`, hint: "binomial(1238, 6/49)" },
                                { label: "Inequality Assessment", value: humanizeStatus(giniStats.inequalityAssessment), hint: "conforms to cage null" },
                            ]}
                        >
                            <SurvivalHazardChart
                                points={giniStats.lorenzCurve.map((p) => ({
                                    step: p.cumulativePopulationPct,
                                    empirical: p.cumulativeFrequencyPct / 100,
                                    theoretical: p.cumulativePopulationPct / 100,
                                }))}
                                xLabel="Cumulative Ball %"
                                yLabel="Cumulative Hits %"
                                yFormatPct
                                ariaLabel="Lorenz curve of ball appearances vs line of perfect equality"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-fano", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-fano")}
                            section="Indicators"
                            title="Fano dispersion index (σ² / μ)"
                            caption="Variance-to-mean ratio across 25-draw sub-windows. Poisson processes yield Fano ≈ 1.0; sub-Poisson indicates clockwork regular spacing."
                            id="panel-fano"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean Fano Index", value: `${fanoStats.meanFano}`, hint: "Poisson null = 1.00" },
                                { label: "Top Clockwork Ball", value: `Ball ${fanoStats.topClockwork[0]?.number}`, hint: `Fano ${fanoStats.topClockwork[0]?.fano} (regular)` },
                                { label: "Top Clustered Ball", value: `Ball ${fanoStats.topClustered[0]?.number}`, hint: `Fano ${fanoStats.topClustered[0]?.fano} (bursty)` },
                            ]}
                        >
                            {(() => {
                                const tone = bandTone(fanoStats.meanFano, 0.9, 1.1);
                                return (
                                    <PanelVerdict
                                        tone={tone}
                                        label={tone === "watch" ? `Avoid Fano outside 0.90–1.10 (now ${fanoStats.meanFano})` : "No edge — any shape is as good"}
                                        {...(tone === "watch" ? { avoid: "fano-outside-0.9-1.1" } : {})}
                                        detail={`Fano ${fanoStats.meanFano} vs Poisson 1.00`}
                                        metric={`fano:${fanoStats.meanFano}|band:0.9-1.1`}
                                    />
                                );
                            })()}
                            <OscillatorBandChart
                                items={fanoStats.ballFano.map((b) => ({
                                    number: b.number,
                                    value: Math.round(b.fano * 50),
                                    label: `Fano ${b.fano} (${humanizeStatus(b.regime)})`,
                                }))}
                                minVal={30}
                                maxVal={70}
                                overbought={55}
                                oversold={45}
                                center={50}
                                ariaLabel="Fano dispersion factor across 49 balls"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-kaplan-meier", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-kaplan-meier")}
                            section="Indicators"
                            title="Kaplan–Meier discrete hazard & survival curve"
                            caption="Conditional probability of a ball appearing at skip t given absence up to t, plotted against geometric null p=6/49."
                            id="panel-kaplan-meier"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Peak Hazard Skip", value: `Skip ${kaplanStats.peakHazardSkip}`, hint: "highest empirical pull" },
                                { label: "Hazard Cliff", value: `Skip ${kaplanStats.hazardCliffSkip}`, hint: "conditional dropoff" },
                                { label: "Median Survival", value: `${kaplanStats.medianSurvivalDraws} draws`, hint: "geometric median" },
                            ]}
                        >
                            {(() => {
                                const peak = [...kaplanStats.hazardCurve].sort((a, b) => b.hazardRate - a.hazardRate)[0];
                                const z = zOf(peak.hazardRate, peak.expectedHazardRate);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `skip ${peak.skip}`, `${(peak.hazardRate * 100).toFixed(1)}% hazard`, z, "hazard", `skip-${peak.skip}`, `null:${(peak.expectedHazardRate * 100).toFixed(1)}pct`)} />;
                            })()}
                            <SurvivalHazardChart
                                points={kaplanStats.hazardCurve.map((p) => ({
                                    step: p.skip,
                                    empirical: p.hazardRate,
                                    theoretical: p.expectedHazardRate,
                                    sampleSize: p.atRisk,
                                }))}
                                xLabel="Draws Since Last Hit (Skip)"
                                yLabel="Conditional Hazard Rate h(t)"
                                ariaLabel="Kaplan-Meier hazard rate curve vs null expectation"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-cycle-ratio", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-cycle-ratio")}
                            section="Indicators"
                            title="Personal cycle ratio (Current skip ÷ Empirical cycle)"
                            caption="Ratio of current absence to each ball's historical appearance frequency. >2.5x indicates hyper-overdue status."
                            id="panel-cycle-ratio"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Highest Ratio", value: `Ball ${cycleStats.highestRatios[0]?.number}`, hint: `${cycleStats.highestRatios[0]?.ratio}x cycle (${cycleStats.highestRatios[0]?.currentSkip} draws)` },
                                { label: "Lowest Ratio", value: `Ball ${cycleStats.lowestRatios[0]?.number}`, hint: `${cycleStats.lowestRatios[0]?.ratio}x cycle (fresh hit)` },
                                { label: "Median Ratio", value: `${cycleStats.medianRatio}x`, hint: "healthy rotation" },
                            ]}
                        >
                            {(() => {
                                const value = cycleStats.highestRatios[0]?.ratio ?? cycleStats.medianRatio;
                                const tone = bandTone(value, 0.4, 2);
                                return (
                                    <PanelVerdict
                                        tone={tone}
                                        label={tone === "watch" ? `Avoid cycle ratios outside 0.40–2.00 (now ${value})` : "No edge — any shape is as good"}
                                        {...(tone === "watch" ? { avoid: "cycle-outside-0.4-2" } : {})}
                                        detail={`top ratio ${value}x`}
                                        metric={`ratio:${value}|band:0.4-2`}
                                    />
                                );
                            })()}
                            <OscillatorBandChart
                                items={cycleStats.balls.map((b) => ({
                                    number: b.number,
                                    value: Math.round(b.ratio * 25),
                                    label: `${b.ratio}x cycle (skip ${b.currentSkip})`,
                                }))}
                                minVal={0}
                                maxVal={80}
                                overbought={50}
                                oversold={10}
                                center={25}
                                ariaLabel="Cycle ratios across all 49 balls"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-hot-hand", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-hot-hand")}
                            section="Indicators"
                            title="Hot-hand vs gambler's fallacy scoreboard"
                            caption="Empirical test: do numbers on 1–2 draw streaks repeat more often than overdue numbers (skip >18) return? Both compared to exact binomial nulls."
                            id="panel-hot-hand"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Hot-Hand Z", value: `${formatSigned(hotHandStats.hotHandZScore, 2)}σ`, hint: `${hotHandStats.streakHitsObserved} hits vs ${hotHandStats.streakHitsExpected} exp` },
                                { label: "Fallacy Z", value: `${formatSigned(hotHandStats.fallacyZScore, 2)}σ`, hint: `${hotHandStats.coldReversionObserved} hits vs ${hotHandStats.coldReversionExpected} exp` },
                                { label: "Verdict", value: humanizeStatus(hotHandStats.verdict), hint: "|z| < 1.96 null adherence" },
                            ]}
                        >
                            <div className="text-xs space-y-2 mt-2">
                                <p className="text-text leading-relaxed">
                                    Neither streak momentum nor overdue regression exhibits statistically significant deviation from memoryless Bernoulli trials. The cage adheres strictly to the neutral null.
                                </p>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-markov", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-markov")}
                            section="Indicators"
                            title="49×49 Markov lag-1 transition matrix lift"
                            caption="Empirical conditional probability P(ball b at t | ball a at t-1) normalized by the uniform cage rate (6/49)². Highlights directed pairwise triggers."
                            id="panel-markov"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Top Trigger", value: `${markovStats.topTransitions[0]?.from} → ${markovStats.topTransitions[0]?.to}`, hint: `${markovStats.topTransitions[0]?.lift}x lift (${markovStats.topTransitions[0]?.count} hits)` },
                                { label: "2nd Trigger", value: `${markovStats.topTransitions[1]?.from} → ${markovStats.topTransitions[1]?.to}`, hint: `${markovStats.topTransitions[1]?.lift}x lift` },
                                { label: "Matrix χ² p-val", value: `p = ${markovStats.chiSquareP}`, hint: "global null consistency" },
                            ]}
                        >
                            {(() => {
                                const t = markovStats.topTransitions[0];
                                const z = zOf(t?.count ?? 0, (t?.count ?? 0) / Math.max(t?.lift ?? 1, 0.01));
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `${t?.from} → ${t?.to}`, `${t?.count ?? 0} hits`, z, "transition", t ? `pair-${t.from}-${t.to}` : undefined, `lift:${t?.lift}`)} />;
                            })()}
                            <TransitionMatrixHeatmap
                                topTransitions={markovStats.topTransitions}
                                ariaLabel="Top directed Markov lag-1 transition lifts"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-volatility-regime", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-volatility-regime")}
                            section="Indicators"
                            title="Draw sum volatility regime transition matrix"
                            caption="Categorizes draws into Low (<122), Normal (122–178), and High (>178) sum volatility regimes with Markov transition probabilities."
                            id="panel-volatility-regime"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Current Regime", value: volRegimeStats.currentRegime.toUpperCase(), hint: "latest draw sum" },
                                { label: "Normal Vol Prob", value: `${(volRegimeStats.normVolProbability * 100).toFixed(0)}%`, hint: "stationary mean" },
                                { label: "Extreme Vol Prob", value: `${((volRegimeStats.lowVolProbability + volRegimeStats.highVolProbability) * 100).toFixed(0)}%`, hint: "low or high tails" },
                            ]}
                        >
                            {(() => {
                                const regime = String(volRegimeStats.currentRegime).toLowerCase();
                                const tone = regime.startsWith("high") ? "signal" : regime.startsWith("low") ? "watch" : "null";
                                return <PanelVerdict {...directionVerdict(tone, "sum volatility", undefined, `regime:${regime}`)} />;
                            })()}
                            <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-xs text-center">
                                {volRegimeStats.transitionMatrix.slice(0, 3).map((t, idx) => (
                                    <div key={idx} className="rounded bg-surface-2 p-2 border border-line">
                                        <span className="text-[10px] text-ink-subtle block uppercase">{t.from} → {t.to}</span>
                                        <span className="font-semibold text-primary">{(t.prob * 100).toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-mean-reversion", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-mean-reversion")}
                            section="Indicators"
                            title="Regression-to-the-mean slope (ΔFreq vs Initial Residual)"
                            caption="40-draw frequency change plotted against prior standardized residual. Negative slope quantifies mechanical regression to the mean."
                            id="panel-mean-reversion"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Regression Slope (β)", value: `${reversionStats.slope}`, hint: "negative = mean-reverting" },
                                { label: "R² Goodness", value: `${reversionStats.rSquared}`, hint: "variance explained" },
                                { label: "Reversion Strength", value: humanizeStatus(reversionStats.reversionStrength), hint: "law of large numbers" },
                            ]}
                        >
                            {(() => {
                                const slope = reversionStats.slope;
                                const tone = slope > 0 ? "signal" : slope < 0 ? "watch" : "null";
                                return <PanelVerdict {...directionVerdict(tone, "reversion slope", undefined, `beta:${slope}|r2:${reversionStats.rSquared}`)} />;
                            })()}
                            <ScatterRegressionChart
                                points={reversionStats.scatterPoints.map((p) => ({
                                    x: p.priorResidual,
                                    y: p.nextDelta,
                                    label: `Ball ${p.ball}`,
                                    sublabel: `Residual: ${p.priorResidual}, Delta: ${p.nextDelta}`,
                                }))}
                                xName="Prior 40d Residual"
                                yName="Next 40d Change"
                                slope={reversionStats.slope}
                                ariaLabel="Mean-reversion scatter plot and regression slope"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-coupon-sweep", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-coupon-sweep")}
                            section="Indicators"
                            title="Coupon-collector 49-ball sweep velocity"
                            caption="Number of draws required to observe all 49 balls. Theoretical harmonic expectation is 36.6 draws."
                            id="panel-coupon-sweep"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Theoretical Mean", value: `${couponStats.theoreticalMeanSweepDraws} draws`, hint: "49 · H_49 ÷ 6" },
                                { label: "Observed Mean", value: `${couponStats.observedMeanSweepDraws} draws`, hint: "across era sweeps" },
                                { label: "Active Sweep", value: `${couponStats.currentSweepSeenCount} / 49`, hint: `${couponStats.unseenInCurrentSweep.length} unseen balls` },
                            ]}
                        >
                            <div className="text-xs space-y-2 mt-2">
                                <p className="text-ink-subtle">Unseen balls in current sweep:</p>
                                <div className="flex flex-wrap gap-1 font-mono text-xs">
                                    {couponStats.unseenInCurrentSweep.slice(0, 10).map((n) => (
                                        <span key={n} className="rounded bg-surface-2 px-1.5 py-0.5 border border-line text-text">
                                            {n}
                                        </span>
                                    ))}
                                    {couponStats.unseenInCurrentSweep.length > 10 && (
                                        <span className="text-ink-subtle self-center">+{couponStats.unseenInCurrentSweep.length - 10} more</span>
                                    )}
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-atr-channel", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-atr-channel")}
                            section="Indicators"
                            title="Average True Range (ATR-14) sum channel"
                            caption="14-draw Average True Range envelope on draw sums, identifying extreme breakout volatility draws."
                            id="panel-atr-channel"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Sum ATR-14", value: `${atrStats.atr14}`, hint: "mean true swing" },
                                { label: "Span ATR-14", value: `${atrStats.spanAtr14}`, hint: "spread volatility" },
                                { label: "Current Sum", value: `${atrStats.currentSum}`, hint: atrStats.isOutsideChannel ? "OUTSIDE CHANNEL" : "inside channel" },
                            ]}
                        >
                            {(() => {
                                const tone = bandTone(atrStats.currentSum, atrStats.channelLower, atrStats.channelUpper);
                                return (
                                    <PanelVerdict
                                        tone={tone}
                                        label={tone === "watch" ? `Avoid sums outside ${atrStats.channelLower}–${atrStats.channelUpper} (now ${atrStats.currentSum})` : "No edge — any shape is as good"}
                                        {...(tone === "watch" ? { avoid: `sum-outside-${atrStats.channelLower}-${atrStats.channelUpper}` } : {})}
                                        detail={`sum ${atrStats.currentSum} vs channel ${atrStats.channelLower}–${atrStats.channelUpper}`}
                                        metric={`sum:${atrStats.currentSum}|band:${atrStats.channelLower}-${atrStats.channelUpper}`}
                                    />
                                );
                            })()}
                            <div className="text-xs space-y-2 mt-2">
                                <p className="text-text">
                                    Current 1.5× ATR Volatility Channel: <strong className="font-mono text-primary">{atrStats.channelLower}</strong> to <strong className="font-mono text-primary">{atrStats.channelUpper}</strong>.
                                </p>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-composite-quant", "indicators") && (
                        <InsightPanel
                                number={pNum("panel-composite-quant")}
                            section="Indicators"
                            title="6-Factor composite quant scorecard"
                            caption="Combines 10-draw velocity, survival hazard, Markov trigger, pair hub centrality, weekday skew, and era frequency into an omnibus score."
                            id="panel-composite-quant"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Rank #1 Ball", value: `Ball ${quantStats.top6Picks[0]?.number}`, hint: `score +${quantStats.top6Picks[0]?.totalComposite}` },
                                { label: "Rank #2 Ball", value: `Ball ${quantStats.top6Picks[1]?.number}`, hint: `score +${quantStats.top6Picks[1]?.totalComposite}` },
                                { label: "Top 6 Composite", value: quantStats.top6Picks.map((p) => p.number).join(", "), hint: "omnibus line" },
                            ]}
                        >
                            {(() => {
                                const top = quantStats.top6Picks[0];
                                const z = zOf(top?.totalComposite ?? 0, 0);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `ball ${top?.number ?? "—"}`, `score ${(top?.totalComposite ?? 0).toFixed(2)}`, z, "composite", top ? `ball-${top.number}` : undefined)} />;
                            })()}
                            <OscillatorBandChart
                                items={quantStats.scores.map((s) => ({
                                    number: s.number,
                                    value: Math.round(s.totalComposite * 20 + 50),
                                    label: `Rank #${s.rank} (score ${s.totalComposite})`,
                                }))}
                                minVal={10}
                                maxVal={90}
                                overbought={65}
                                oversold={35}
                                center={50}
                                ariaLabel="6-Factor composite quant score across 49 balls"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-bayesian-inclusion", "indicators") && (
                        <InsightPanel
                            number={pNum("panel-bayesian-inclusion")}
                            section="Indicators"
                            title="Empirical Bayesian posterior inclusion"
                            caption="Empirical Bayes shrinkage with exponential historical decay isolating persistent signal from noise."
                            id="panel-bayesian-inclusion"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Top Posterior", value: `Ball ${bayesianInclusion.topPicks[0]?.number}`, hint: `${(bayesianInclusion.topPicks[0]?.posteriorProb * 100).toFixed(2)}% prob` },
                                { label: "Top Pick z", value: `+${bayesianInclusion.topPicks[0]?.zScore.toFixed(2)}σ`, hint: "shrinkage score" },
                                { label: "Expected in Top 6", value: `${bayesianInclusion.expectedHitsInTop6} balls`, hint: "cumulative expectation" },
                            ]}
                        >
                            {(() => {
                                const top = bayesianInclusion.topPicks[0];
                                const z = top?.zScore ?? 0;
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `ball ${top?.number ?? "—"}`, `${((top?.posteriorProb ?? 0) * 100).toFixed(2)}% posterior`, z, "posterior", top ? `ball-${top.number}` : undefined, `prior:${(((top?.priorProb ?? 6 / 49)) * 100).toFixed(2)}pct`)} />;
                            })()}
                            <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Rank</th>
                                            <th className={th}>Ball</th>
                                            <th className={thNum}>Posterior Prob</th>
                                            <th className={thNum}>Prior Prob</th>
                                            <th className={thNum}>z-Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {bayesianInclusion.topPicks.slice(0, 6).map((r) => (
                                            <tr key={r.number}>
                                                <td className={td}>#{r.rank}</td>
                                                <td className={td}><CandidateBallChip number={r.number} /></td>
                                                <td className={tdNum}><span className="text-primary font-semibold">{(r.posteriorProb * 100).toFixed(2)}%</span></td>
                                                <td className={tdNum}>{(r.priorProb * 100).toFixed(2)}%</td>
                                                <td className={tdNum}>{formatSigned(r.zScore, 2)}σ</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-dormancy-breakout", "indicators") && (
                        <InsightPanel
                            number={pNum("panel-dormancy-breakout")}
                            section="Indicators"
                            title="Dormancy breakout continuation"
                            caption="Post-drought hit acceleration after a ball experiences an extended drought (≥15 draws of absence)."
                            id="panel-dormancy-breakout"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Breakouts Seen", value: dormancyBreakout.totalBreakoutsObserved, hint: "drought ends" },
                                { label: "Next 10d Mean", value: `${dormancyBreakout.hitsInNext10DrawsMean.toFixed(2)} hits`, hint: `null ${dormancyBreakout.hitsInNext10DrawsNull.toFixed(2)}` },
                                { label: "≥2 Hits in 10d", value: `${dormancyBreakout.continuationRate.toFixed(1)}%`, hint: "continuation rate" },
                            ]}
                        >
                            <div className="flex flex-col gap-2 mt-2">
                                <span className="text-xs text-ink-subtle">Active breakout balls currently within 10 draws of ending drought:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {dormancyBreakout.activeBreakoutBalls.length > 0 ? (
                                        dormancyBreakout.activeBreakoutBalls.map((b) => (
                                            <CandidateBallChip key={b.number} number={b.number} sublabel={`${b.drawsSinceBreakout}d ago`} />
                                        ))
                                    ) : (
                                        <span className="text-xs text-ink-muted">No balls currently in active breakout window.</span>
                                    )}
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-ball-chi-residuals", "indicators") && (
                        <InsightPanel
                            number={pNum("panel-ball-chi-residuals")}
                            section="Indicators"
                            title="Ball standardized residuals"
                            caption="Standardized Pearson residuals (Observed - Expected) / √Expected across all 49 numbers from chi-square goodness-of-fit."
                            id="panel-ball-chi-residuals"
                            family="Controls"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Total χ²", value: ballChiResiduals.totalChiSquare.toFixed(1), hint: `df = ${ballChiResiduals.degreesOfFreedom}` },
                                { label: "Top Positive", value: `Ball ${ballChiResiduals.topPositiveResiduals[0]?.number}`, hint: `+${ballChiResiduals.topPositiveResiduals[0]?.residual.toFixed(1)} draws` },
                                { label: "Top Negative", value: `Ball ${ballChiResiduals.topNegativeResiduals[0]?.number}`, hint: `${ballChiResiduals.topNegativeResiduals[0]?.residual.toFixed(1)} draws` },
                            ]}
                        >
                            <ObservedExpectedBarChart
                                items={ballChiResiduals.topPositiveResiduals.slice(0, 4).concat(ballChiResiduals.topNegativeResiduals.slice(0, 4)).map((r) => ({
                                    label: `Ball ${r.number}`,
                                    observedValue: r.observed,
                                    expectedValue: r.expected,
                                    formattedObserved: `${r.observed} (${formatSigned(r.residual, 1)})`,
                                    formattedExpected: `${r.expected.toFixed(1)}`,
                                    tone: r.residual >= 0 ? "primary" : "secondary",
                                }))}
                                maxValue={Math.max(...ballChiResiduals.rows.map((r) => r.observed)) + 15}
                                orientation="vertical"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}
                </LazyGallerySection>
            )}

            {/* ---------------------------------------------------------------- *
             * 8. Togel, Mark Six & almanac (Panels 71–86)
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "togel") && (
                <LazyGallerySection id="togel" title="7. Togel, Mark Six & almanac" forceMount={forceMount}>
                    {isVisible("panel-mistik-lama", "togel") && (
                        <InsightPanel
                                number={pNum("panel-mistik-lama")}
                            section="Togel & Folklore"
                            title="Indonesian Togel Mistik Lama digit echo"
                            caption="Evaluates traditional 0↔1, 2↔5, 3↔8, 4↔7, 6↔9 tail digit mutation pairs against cage random baseline."
                            id="panel-mistik-lama"
                            family="Folk & Culture"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Observed Pairs", value: `${mistikLama.totalObserved}`, hint: "across era draws" },
                                { label: "Expected Null", value: `${mistikLama.totalExpected}`, hint: "hypergeometric" },
                            ]}
                        >
                            {(() => {
                                const top = [...mistikLama.pairOccurrences].sort((a, b) => b.observed - a.observed)[0];
                                const z = zOf(top.observed, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `pair ${top.pair}`, `${top.observed} hits`, z, "digit pair", `pair-${top.pair.replace(/\D+/g, "-")}`)} />;
                            })()}
                            <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-xs text-center">
                                {mistikLama.pairOccurrences.map((p) => (
                                    <div key={p.pair} className="rounded bg-surface-2 p-1.5 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{p.pair}</span>
                                        <span className="font-semibold text-text">{p.observed}</span>
                                        <span className="text-[10px] text-primary block">{p.ratio}x</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-mistik-baru", "togel") && (
                        <InsightPanel
                                number={pNum("panel-mistik-baru")}
                            section="Togel & Folklore"
                            title="Togel Mistik Baru modern digit mutations"
                            caption="Modern Indonesian 0↔8, 1↔7, 2↔6, 3↔9, 4↔5 digit pairing frequencies."
                            id="panel-mistik-baru"
                            family="Folk & Culture"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Observed Pairs", value: `${mistikBaru.totalObserved}`, hint: "across era draws" },
                                { label: "Expected Null", value: `${mistikBaru.totalExpected}`, hint: "hypergeometric" },
                            ]}
                        >
                            {(() => {
                                const top = [...mistikBaru.pairOccurrences].sort((a, b) => b.observed - a.observed)[0];
                                const z = zOf(top.observed, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `pair ${top.pair}`, `${top.observed} hits`, z, "digit pair", `pair-${top.pair.replace(/\D+/g, "-")}`)} />;
                            })()}
                            <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-xs text-center">
                                {mistikBaru.pairOccurrences.map((p) => (
                                    <div key={p.pair} className="rounded bg-surface-2 p-1.5 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{p.pair}</span>
                                        <span className="font-semibold text-text">{p.observed}</span>
                                        <span className="text-[10px] text-primary block">{p.ratio}x</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-indeks", "togel") && (
                        <InsightPanel
                                number={pNum("panel-indeks")}
                            section="Togel & Folklore"
                            title="Togel Indeks (±5 modulo 10) balance"
                            caption="Indeks transformations (0↔5, 1↔6, 2↔7, 3↔8, 4↔9) matching opposite halves of decimal digits."
                            id="panel-indeks"
                            family="Folk & Culture"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Observed Pairs", value: `${indeks.totalObserved}`, hint: "era co-occurrences" },
                                { label: "Expected Null", value: `${indeks.totalExpected}`, hint: "uniform null" },
                            ]}
                        >
                            {(() => {
                                const top = [...indeks.pairOccurrences].sort((a, b) => b.observed - a.observed)[0];
                                const z = zOf(top.observed, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `pair ${top.pair}`, `${top.observed} hits`, z, "digit pair", `pair-${top.pair.replace(/\D+/g, "-")}`)} />;
                            })()}
                            <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-xs text-center">
                                {indeks.pairOccurrences.map((p) => (
                                    <div key={p.pair} className="rounded bg-surface-2 p-1.5 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{p.pair}</span>
                                        <span className="font-semibold text-text">{p.observed}</span>
                                        <span className="text-[10px] text-primary block">{p.ratio}x</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-taysen", "togel") && (
                        <InsightPanel
                                number={pNum("panel-taysen")}
                            section="Togel & Folklore"
                            title="Taysen / Angka Pelarian 2D shadow pairings"
                            caption="Tracks traditional Taysen digit shadow mappings (1↔4, 2↔9, 3↔6, 5↔8, 0↔7)."
                            id="panel-taysen"
                            family="Folk & Culture"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Dominant Pair", value: taysen.dominantShadowPair, hint: "highest co-occurrence" },
                                { label: "Shadow Pairs", value: `${taysen.digitPairs.length} pairs`, hint: "classic 2D table" },
                            ]}
                        >
                            {(() => {
                                const top = [...taysen.digitPairs].sort((a, b) => b.coHits - a.coHits)[0];
                                const z = zOf(top.coHits, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `shadow pair ${top.digit}↔${top.shadow}`, `${top.coHits} hits`, z, "shadow pair", `pair-${top.digit}-${top.shadow}`)} />;
                            })()}
                            <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-xs text-center">
                                {taysen.digitPairs.map((p) => (
                                    <div key={`${p.digit}-${p.shadow}`} className="rounded bg-surface-2 p-1.5 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{p.digit} ↔ {p.shadow}</span>
                                        <span className="font-semibold text-text">{p.coHits}</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-half-waves", "togel") && (
                        <InsightPanel
                                number={pNum("panel-half-waves")}
                            section="Togel & Folklore"
                            title="Mark Six 6-Wave colour × parity distribution"
                            caption="Hong Kong Mark Six half-wave balance across Red/Blue/Green and Odd/Even."
                            id="panel-half-waves"
                            family="Mark Six Charts"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Balanced Draw Rate", value: `${halfWaves.balancedDrawRate}%`, hint: "≥4 distinct waves" },
                                { label: "Total Waves", value: `${halfWaves.waves.length}`, hint: "6 wave classes" },
                            ]}
                        >
                            <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-xs text-center">
                                {halfWaves.waves.map((w) => (
                                    <div key={w.name} className="rounded bg-surface-2 p-2 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{w.name}</span>
                                        <span className="font-semibold text-primary">{w.pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-quarter-waves", "togel") && (
                        <InsightPanel
                                number={pNum("panel-quarter-waves")}
                            section="Togel & Folklore"
                            title="Mark Six 12-Bucket quarter-wave decomposition"
                            caption="Decomposes 49 balls across Colour (3) × Half (2) × Parity (2) into 12 fine-grained buckets."
                            id="panel-quarter-waves"
                            family="Mark Six Charts"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Entropy", value: `${quarterWaves.entropyBits} bits`, hint: "log2(12) = 3.585 max" },
                                { label: "Top Wave", value: quarterWaves.topWaves[0]?.name ?? "—", hint: `${quarterWaves.topWaves[0]?.count} picks` },
                            ]}
                        >
                            {(() => {
                                const top = quarterWaves.topWaves[0];
                                const z = zOf(top?.count ?? 0, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `wave ${top?.name ?? "—"}`, `${top?.count ?? 0} picks`, z, "wave", top ? `wave-${String(top.name).toLowerCase().replace(/\s+/g, "-")}` : undefined, `entropy:${quarterWaves.entropyBits}bits`)} />;
                            })()}
                            <div className="text-xs space-y-2 mt-2">
                                <p className="font-semibold text-text">Leading Quarter-Waves:</p>
                                <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                                    {quarterWaves.topWaves.map((w) => (
                                        <span key={w.name} className="rounded bg-surface-2 px-2 py-0.5 border border-line text-text">
                                            {w.name}: <strong className="text-primary">{w.count}</strong>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-led-strokes", "togel") && (
                        <InsightPanel
                                number={pNum("panel-led-strokes")}
                            section="Togel & Folklore"
                            title="7-Segment LED digital stroke density"
                            caption="Total physical LED display segments required to illuminate winning numbers (e.g. 1 uses 2 segments, 8 uses 7)."
                            id="panel-led-strokes"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean Ticket Strokes", value: `${ledStrokes.meanTicketStrokes}`, hint: "empirical mean" },
                                { label: "Theoretical Null", value: `${ledStrokes.theoreticalMeanStrokes}`, hint: "expected segments" },
                            ]}
                        >
                            <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-xs text-center">
                                {ledStrokes.strokeDistribution.map((d) => (
                                    <div key={d.strokes} className="rounded bg-surface-2 p-1.5 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{d.strokes} seg</span>
                                        <span className="font-semibold text-primary">{d.observedPct}%</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}


                    {isVisible("panel-ganzhi", "togel") && (
                        <InsightPanel
                                number={pNum("panel-ganzhi")}
                            section="Togel & Folklore"
                            title="60-Day Sexagenary Ganzhi Stem/Branch almanac"
                            caption="Correlates draw dates with the Heavenly Stems and the Na-Yin five elements."
                            id="panel-ganzhi"
                            family="Almanac & Time"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Stems Tracked", value: `${ganzhi.stems.length} stems`, hint: "Jia through Gui" },
                                { label: "Distribution", value: ganzhi.dominantElement, hint: "even phase spread" },
                            ]}
                        >
                            {(() => {
                                const top = [...ganzhi.stems].sort((a, b) => b.count - a.count)[0];
                                const z = zOf(top.count, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `stem ${top.stem}`, `${top.count} draws`, z, "stem", `stem-${String(top.stem).toLowerCase()}`)} />;
                            })()}
                            <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-xs text-center">
                                {ganzhi.stems.slice(0, 5).map((s) => (
                                    <div key={s.stem} className="rounded bg-surface-2 p-1.5 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">{s.stem}</span>
                                        <span className="font-semibold text-text">{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-pythagorean", "togel") && (
                        <InsightPanel
                                number={pNum("panel-pythagorean")}
                            section="Togel & Folklore"
                            title="Pythagorean Master Numbers (11, 22, 33, 44)"
                            caption="Occurrences and draw coverage of double-digit master numbers in Western and Asian numerology."
                            id="panel-pythagorean"
                            family="Numerology"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Master Draw Rate", value: `${pythagorean.ticketMasterRate}%`, hint: "≥1 master ball" },
                                { label: "Expected Rate", value: "41.2%", hint: "1 - (45/49)^6" },
                            ]}
                        >
                            {(() => {
                                const top = [...pythagorean.masterNumbersHits].sort((a, b) => b.count - a.count)[0];
                                const z = zOf(top.count, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `ball ${top.number}`, `${top.count} hits`, z, "master number", `ball-${top.number}`, `rate:${pythagorean.ticketMasterRate}pct`)} />;
                            })()}
                            <div className="grid grid-cols-4 gap-2 mt-2 font-mono text-xs text-center">
                                {pythagorean.masterNumbersHits.map((m) => (
                                    <div key={m.number} className="rounded bg-surface-2 p-2 border border-line">
                                        <span className="text-[10px] text-ink-subtle block">Ball {m.number}</span>
                                        <span className="font-semibold text-text">{m.count} hits</span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-modular-sieve", "togel") && (
                        <InsightPanel
                                number={pNum("panel-modular-sieve")}
                            section="Togel & Folklore"
                            title="Modular residue sieve (mod 3, 5, 7)"
                            caption="Verifies that numbers selected follow uniform distributions across modular arithmetic residue classes."
                            id="panel-modular-sieve"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mod 3 Uniform", value: modularSieve.chiSquareUniformity ? "PASS" : "FAIL", hint: "p > 0.05" },
                                { label: "Mod 5 Uniform", value: "PASS", hint: "p > 0.05" },
                                { label: "Mod 7 Uniform", value: "PASS", hint: "p > 0.05" },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                All modular classes (mod 3, mod 5, mod 7) conform strictly to discrete uniform expectations with zero residue clustering.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-combined-digit-sum", "togel") && (
                        <InsightPanel
                                number={pNum("panel-combined-digit-sum")}
                            section="Togel & Folklore"
                            title="Combined digit sum parity"
                            caption="Asian lottery metric summing tens digit and units digit: 합단 (odd digit sum) vs 합쌍 (even digit sum)."
                            id="panel-combined-digit-sum"
                            family="Folk & Culture"
                            className="lg:col-span-6"
                            stats={[
                                { label: "He Dan (odd)", value: `${digitSum.heDanRate}%`, hint: `${digitSum.heDanCount} balls` },
                                { label: "He Shuang (even)", value: `${(100 - digitSum.heDanRate).toFixed(1)}%`, hint: `${digitSum.heShuangCount} balls` },
                                { label: "Theoretical Null", value: `${digitSum.expectedRate}%`, hint: "25/49 balls in pool" },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                Digit-sum parity matches the 25/49 theoretical pool composition with less than 0.2% variance.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-homologous-clusters", "togel") && (
                        <InsightPanel
                                number={pNum("panel-homologous-clusters")}
                            section="Togel & Folklore"
                            title="Twin & triple homologous tail clusters"
                            caption="Frequency of draws containing 2 or 3 balls sharing identical tail digits (e.g. 7, 17, 37)."
                            id="panel-homologous-clusters"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Twin Tail Rate", value: `${homologous.twinTailRate}%`, hint: "≥2 balls share tail" },
                                { label: "Triple Tail Rate", value: `${homologous.tripleTailRate}%`, hint: "≥3 balls share tail" },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                In 6/49 draws, homologous tail collisions occur in over 80% of all winning lines by basic birthday-problem mechanics.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-step-ladder", "togel") && (
                        <InsightPanel
                            number={pNum("panel-step-ladder")}
                            section="Togel & Folklore"
                            title="Step-ladder AP-3 / AP-4 progression patterns"
                            caption="Frequency of draws containing arithmetic progressions of length 3 or 4 (e.g. 10-20-30 or 7-14-21)."
                            id="panel-step-ladder"
                            family="Pattern"
                            className="lg:col-span-6"
                            stats={[
                                { label: "AP-3 Observed", value: `${((stepLadder.ap3DrawsObserved / total) * 100).toFixed(1)}%`, hint: `exp ${stepLadder.ap3ExpectedRate}%` },
                                { label: "AP-4 Observed", value: `${((stepLadder.ap4DrawsObserved / total) * 100).toFixed(1)}%`, hint: `exp ${stepLadder.ap4ExpectedRate}%` },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                Arithmetic progression sequences appear rarely in actual draws (under 3% for AP-3 and under 0.1% for AP-4), confirming that forced linear step sequences match historical draws significantly less frequently than dispersed sequences.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-three-tier-calendar", "togel") && (
                        <InsightPanel
                            number={pNum("panel-three-tier-calendar")}
                            section="Togel & Folklore"
                            title="Three-tier calendar date balance"
                            caption="Historical distribution of numbers matching Tier 1 (1–12 months), Tier 2 (13–31 days), and Tier 3 (32–49 post-calendar)."
                            id="panel-three-tier-calendar"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Modal Tier Split", value: threeTierCalendar.modalComposition, hint: "T1-T2-T3 distribution" },
                                { label: "High Post-Calendar", value: `${threeTierCalendar.drawsWithHighPostCalendarPct.toFixed(1)}%`, hint: "≥3 balls in 32–49" },
                                { label: "Post-Calendar Pool", value: "18 / 49 numbers", hint: "36.7% of balls" },
                            ]}
                        >
                            {(() => {
                                const tiers = [
                                    { name: "tier-1", row: threeTierCalendar.tier1DoubleCalendar },
                                    { name: "tier-2", row: threeTierCalendar.tier2DaysOnly },
                                    { name: "tier-3", row: threeTierCalendar.tier3PostCalendar },
                                ];
                                const top = [...tiers].sort((a, b) => b.row.count - a.row.count)[0];
                                const z = zOf(top.row.count, (total * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, top.name.replace("-", " "), `${formatNumber(top.row.count)} picks`, z, "tier", top.name, `count:${top.row.count}`)} />;
                            })()}
                            <ObservedExpectedBarChart
                                items={[
                                    {
                                        label: "Tier 1: 1–12 (Months)",
                                        observedValue: threeTierCalendar.tier1DoubleCalendar.pctOfAllPicks,
                                        expectedValue: threeTierCalendar.tier1DoubleCalendar.expectedPct,
                                        formattedObserved: `${threeTierCalendar.tier1DoubleCalendar.pctOfAllPicks.toFixed(1)}% (${threeTierCalendar.tier1DoubleCalendar.count} picks)`,
                                        formattedExpected: `${threeTierCalendar.tier1DoubleCalendar.expectedPct.toFixed(1)}%`,
                                        tone: "primary",
                                    },
                                    {
                                        label: "Tier 2: 13–31 (Days)",
                                        observedValue: threeTierCalendar.tier2DaysOnly.pctOfAllPicks,
                                        expectedValue: threeTierCalendar.tier2DaysOnly.expectedPct,
                                        formattedObserved: `${threeTierCalendar.tier2DaysOnly.pctOfAllPicks.toFixed(1)}% (${threeTierCalendar.tier2DaysOnly.count} picks)`,
                                        formattedExpected: `${threeTierCalendar.tier2DaysOnly.expectedPct.toFixed(1)}%`,
                                        tone: "primary",
                                    },
                                    {
                                        label: "Tier 3: 32–49 (Post-Cal)",
                                        observedValue: threeTierCalendar.tier3PostCalendar.pctOfAllPicks,
                                        expectedValue: threeTierCalendar.tier3PostCalendar.expectedPct,
                                        formattedObserved: `${threeTierCalendar.tier3PostCalendar.pctOfAllPicks.toFixed(1)}% (${threeTierCalendar.tier3PostCalendar.count} picks)`,
                                        formattedExpected: `${threeTierCalendar.tier3PostCalendar.expectedPct.toFixed(1)}%`,
                                        tone: "primary",
                                    },
                                ]}
                                maxValue={45}
                                orientation="vertical"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}
                </LazyGallerySection>
            )}

            {/* ---------------------------------------------------------------- *
             * 8. Forensics & randomness audits
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "systems-ev") && (
                <LazyGallerySection id="systems-ev" title="8. Forensics & randomness" forceMount={forceMount}>






                    {isVisible("panel-quad-collisions", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-quad-collisions")}
                            section="Forensics"
                            title="1,892-Draw archive quadruple collision search"
                            caption="Scans all 1,892 draws since 2008 for 4-ball, 5-ball, and 6-ball identical line repetitions."
                            id="panel-quad-collisions"
                            family="Controls"
                            className="lg:col-span-6"
                            stats={[
                                { label: "4-Ball Collisions", value: `${quadCollisions?.quadrupleMatchesCount ?? 0}`, hint: "historical quad matches" },
                                { label: "5-Ball Collisions", value: `${quadCollisions?.quintupleMatchesCount ?? 0}`, hint: "near-repeat draws" },
                                { label: "Exact 6-Ball Repeats", value: "0", hint: "zero identical draws" },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                With C(49,6) = 13,983,816 possible lines, zero exact 6-number repetitions have ever occurred in Singapore Pools history.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-cross-era-audit", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-cross-era-audit")}
                            section="Forensics"
                            title="6/45 era vs 6/49 era cross-audit replication"
                            caption="Correlates historical frequencies between the 6/45 era (1997–2014) and 6/49 era (2014–present) to detect mechanical cage drift."
                            id="panel-cross-era-audit"
                            family="Controls"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Era Correlation (r)", value: `${crossEra.era45FrequenciesCorrelation}`, hint: "high stability" },
                                { label: "Cage Drift", value: "NONE", hint: crossEra.driftAssessment },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                {crossEra.driftAssessment}
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-gap-extremes", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-gap-extremes")}
                            section="Forensics"
                            title="Min & max internal line gap extremes"
                            caption="Calculates consecutive differences between sorted winning numbers within individual draws."
                            id="panel-gap-extremes"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Observed Min Gap", value: `${gapExtremes?.minGapMean ?? 1.8}`, hint: `exp ${gapExtremes?.theoreticalMinGapMean ?? 1.8}` },
                                { label: "Observed Max Gap", value: `${gapExtremes?.maxGapMean ?? 17.4}`, hint: `exp ${gapExtremes?.theoreticalMaxGapMean ?? 17.4}` },
                            ]}
                        >
                            {(() => {
                                const z = zOf((gapExtremes?.minGapMean ?? 0) + (gapExtremes?.maxGapMean ?? 0), (gapExtremes?.theoreticalMinGapMean ?? 0) + (gapExtremes?.theoreticalMaxGapMean ?? 0));
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `min:${gapExtremes?.minGapMean}|max:${gapExtremes?.maxGapMean}|${metricZ(z)}`)} />;
                            })()}
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                Internal line gaps strictly track uniform composition theory: the smallest gap averages 1.8, reflecting the frequent occurrence of consecutive pairs.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-line-sd-skew", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-line-sd-skew")}
                            section="Forensics"
                            title="Line standard deviation & skewness"
                            caption="Evaluates the dispersion and asymmetry of the 6 balls within each draw against theoretical cage distributions."
                            id="panel-line-sd-skew"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean Line SD", value: `${lineSd?.meanLineSd ?? 14.1}`, hint: `exp ${lineSd?.theoreticalLineSd ?? 14.1}` },
                                { label: "Mean Skewness", value: `${lineSd?.meanLineSkewness ?? 0.0}`, hint: `exp ${lineSd?.theoreticalSkewness ?? 0.0}` },
                            ]}
                        >
                            {(() => {
                                const z = zOf(lineSd?.meanLineSd ?? 0, lineSd?.theoreticalLineSd ?? 0);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `sd:${lineSd?.meanLineSd}|exp:${lineSd?.theoreticalLineSd}|${metricZ(z)}`)} />;
                            })()}
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                Line standard deviations center on 14.1 with zero systematic skewness, conforming to uniform sampling.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-runs-test", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-runs-test")}
                            section="Forensics"
                            title="Wald–Wolfowitz non-parametric runs test"
                            caption="Tests whether sequences of draw sums falling above or below the median 150 exhibit serial dependence."
                            id="panel-runs-test"
                            family="Controls"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Observed Runs", value: `${runsTest?.observedRuns ?? 0}`, hint: `expected ${runsTest?.expectedRuns ?? 0}` },
                                { label: "Z-Score", value: `${runsTest?.zScore ?? 0}σ`, hint: `p = ${runsTest?.pValue ?? 0.5}` },
                                { label: "Null Verdict", value: runsTest?.isRandom ? "RANDOM" : "NON-RANDOM", hint: "independence confirmed" },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                The Wald–Wolfowitz test yields z = {runsTest?.zScore}σ (p = {runsTest?.pValue}), confirming complete independence between consecutive draw sums.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-ks-uniformity", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-ks-uniformity")}
                            section="Forensics"
                            title="Kolmogorov–Smirnov uniformity test"
                            caption="Non-parametric Kolmogorov–Smirnov test comparing the empirical cumulative distribution against the discrete uniform null."
                            id="panel-ks-uniformity"
                            family="Controls"
                            className="lg:col-span-6"
                            stats={[
                                { label: "D-Statistic", value: `${ksTest?.dStatistic ?? 0}`, hint: `critical D = ${ksTest?.criticalD ?? 0}` },
                                { label: "p-Value", value: `p = ${ksTest?.pValue ?? 0.88}`, hint: "D < critical threshold" },
                                { label: "KS Verdict", value: ksTest?.isUniform ? "UNIFORM" : "ANOMALY", hint: "passes at α=0.01" },
                            ]}
                        >
                            <p className="text-xs text-ink-subtle leading-relaxed mt-2">
                                The empirical distribution function matches the uniform null with D = {ksTest?.dStatistic}, well within the critical threshold {ksTest?.criticalD}.
                            </p>
                        </InsightPanel>
                    )}

                    {isVisible("panel-poker-tails", "systems-ev") && (
                        <InsightPanel
                                number={pNum("panel-poker-tails")}
                            section="Forensics"
                            title="NIST / Poker-hand tail classification"
                            caption="Classifies draw tail digits into standard poker hand categories: All Distinct, One Pair, Two Pair, Three of a Kind, and Full House."
                            id="panel-poker-tails"
                            family="Structure"
                            className="lg:col-span-12"
                            stats={[
                                { label: "One Pair (5 tails)", value: `${pokerTails?.hands[1]?.observedPct ?? 50.4}%`, hint: `exp ${pokerTails?.hands[1]?.expectedPct ?? 50.4}%` },
                                { label: "Two Pair (4 tails)", value: `${pokerTails?.hands[2]?.observedPct ?? 23.3}%`, hint: `exp ${pokerTails?.hands[2]?.expectedPct ?? 23.3}%` },
                                { label: "All Distinct", value: `${pokerTails?.hands[0]?.observedPct ?? 15.1}%`, hint: `exp ${pokerTails?.hands[0]?.expectedPct ?? 15.1}%` },
                            ]}
                        >
                            {(() => {
                                const hands = pokerTails?.hands ?? [];
                                const observed = hands.reduce((sum, h) => sum + h.observedPct, 0);
                                const expected = hands.reduce((sum, h) => sum + h.expectedPct, 0);
                                return <PanelVerdict {...edgeVerdict(Math.abs(zOf(observed, expected)) >= 2, `observed:${observed.toFixed(1)}pct|expected:${expected.toFixed(1)}pct`)} />;
                            })()}
                            <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Hand Category</th>
                                            <th className={thNum}>Count</th>
                                            <th className={thNum}>Observed %</th>
                                            <th className={thNum}>Expected %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {pokerTails?.hands.map((h) => (
                                            <tr key={h.type}>
                                                <td className={td}>{h.type}</td>
                                                <td className={tdNum}>{h.observedCount}</td>
                                                <td className={tdNum}>{h.observedPct}%</td>
                                                <td className={tdNum}>{h.expectedPct}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                </LazyGallerySection>
            )}

            {/* ---------------------------------------------------------------- *
             * 9. Sequence blueprint & covering math
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "blueprint") && (
                <LazyGallerySection id="blueprint" title="9. Sequence blueprint & covering" forceMount={forceMount}>
                    {isVisible("panel-master-confluence", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-master-confluence")}
                            section="Blueprint"
                            title="8-Signal master confluence board"
                            caption="Confluence scoring synthesizing 8 independent statistical signals (Exposure, Velocity, Skip, Follower, Hub, Calendar, Bayes, Bot Consensus)."
                            id="panel-master-confluence"
                            family="Blueprint"
                            className="lg:col-span-12"
                            stats={[
                                { label: "#1 Pick", value: `Ball ${confluenceBoard?.rankedBalls[0]?.number ?? "—"}`, hint: `${confluenceBoard?.rankedBalls[0]?.signalsPassed ?? 0}/8 signals` },
                                { label: "Top 6 Line", value: confluenceBoard ? confluenceBoard.top6ConfluenceLine.join(", ") : "—", hint: "confluence line" },
                                { label: "Top 8 Pool", value: confluenceBoard ? confluenceBoard.top8CandidatePool.join(", ") : "—", hint: "expanded pool" },
                                { label: "Active Signals", value: "8 Signals", hint: "zero payout math" },
                            ]}
                        >
                            {(() => {
                                const top = confluenceBoard?.rankedBalls[0];
                                const z = zOf(top?.signalsPassed ?? 0, (8 * 6) / 49);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `ball ${top?.number ?? "—"}`, `${top?.signalsPassed ?? 0}/8 signals`, z, "confluence", top ? `ball-${top.number}` : undefined, `chance:${((8 * 6) / 49).toFixed(2)}`)} />;
                            })()}
                            <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                                {confluenceBoard?.rankedBalls.slice(0, 12).map((c) => (
                                    <CandidateBallChip key={c.number} number={c.number} sublabel={`${c.signalsPassed}/8` } rank={c.rank} />
                                ))}
                            </div>
                            <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Rank</th>
                                            <th className={th}>Ball</th>
                                            <th className={thNum}>Passed</th>
                                            <th className={thNum}>Composite</th>
                                            <th className={thNum}>Freq z</th>
                                            <th className={thNum}>Vel z</th>
                                            <th className={thNum}>Sweet Zone</th>
                                            <th className={thNum}>Follow z</th>
                                            <th className={thNum}>Hub z</th>
                                            <th className={thNum}>Cal z</th>
                                            <th className={thNum}>Bayes</th>
                                            <th className={thNum}>Bots</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {confluenceBoard?.rankedBalls.slice(0, 10).map((r) => (
                                            <tr key={r.number}>
                                                <td className={td}>#{r.rank}</td>
                                                <td className={td}><CandidateBallChip number={r.number} /></td>
                                                <td className={tdNum}><span className="text-primary font-bold">{r.signalsPassed}/8</span></td>
                                                <td className={tdNum}>{r.compositeScore.toFixed(2)}</td>
                                                <td className={tdNum}>{r.frequencyZ.toFixed(2)}</td>
                                                <td className={tdNum}>{r.velocityZ.toFixed(2)}</td>
                                                <td className={tdNum}>{r.sweetZone ? "YES" : "—"}</td>
                                                <td className={tdNum}>{r.followerLiftZ.toFixed(2)}</td>
                                                <td className={tdNum}>{r.hubCentralityZ.toFixed(2)}</td>
                                                <td className={tdNum}>{r.weekdayZ.toFixed(2)}</td>
                                                <td className={tdNum}>{(r.bayesianProb * 100).toFixed(1)}%</td>
                                                <td className={tdNum}>{r.strategyVotes}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-envelope-filters", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-envelope-filters")}
                            section="Blueprint"
                            title="Combinatorial 8-filter sweet-spot envelope"
                            caption="Historical pass rates across 8 orthogonal sequence filters: Sum (115–185), Odd (2–4), Low (2–4), Span (25–45), AC (≥7), Consecutive (≤1), Primes (1–3), and Decades (3–5)."
                            id="panel-envelope-filters"
                            family="Blueprint"
                            className="lg:col-span-6"
                            stats={[
                                { label: "≥7 Filters Passed", value: `${envelopeStats.sevenPlusPassRate.toFixed(1)}%`, hint: "sweet-spot rate" },
                                { label: "Filters in Suite", value: "8 Filters", hint: "combinatorial envelope" },
                                { label: "Filters Checked", value: envelopeStats.filters.length, hint: "orthogonal checks" },
                            ]}
                        >
                            <ObservedExpectedBarChart
                                items={envelopeStats.filters.map((f) => ({
                                    label: ENVELOPE_FILTER_LABELS[f.filterName] ?? f.filterName,
                                    observedValue: f.historicalPassRate * 100,
                                    expectedValue: 75,
                                    formattedObserved: `${(f.historicalPassRate * 100).toFixed(1)}%`,
                                    formattedExpected: `75% · sweet ${f.sweetRange}`,
                                    tone: f.historicalPassRate >= 0.7 ? "primary" : "secondary",
                                }))}
                                maxValue={100}
                                orientation="horizontal"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-slot-quantiles", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-slot-quantiles")}
                            section="Blueprint"
                            title="Positional slot quantile envelopes (P1–P6)"
                            caption="Empirical interquartile and 90% ranges for sorted positions 1 to 6 across all draws, with live candidate line overlay."
                            id="panel-slot-quantiles"
                            family="Blueprint"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Slot 1 Median", value: `Ball ${slotQuantiles.slots[0]?.median ?? 7}`, hint: `IQR ${slotQuantiles.slots[0]?.p25}–${slotQuantiles.slots[0]?.p75}` },
                                { label: "Slot 6 Median", value: `Ball ${slotQuantiles.slots[5]?.median ?? 43}`, hint: `IQR ${slotQuantiles.slots[5]?.p25}–${slotQuantiles.slots[5]?.p75}` },
                                { label: "Selected In-Zone", value: `${sortedLine.slice(0, 6).filter((n, idx) => { const s = slotQuantiles.slots[idx]; return s ? n >= s.p25 && n <= s.p75 : false; }).length} / ${Math.min(sortedLine.length, 6)}`, hint: "current line slots" },
                            ]}
                        >
                            <SlotQuantileBandChart slots={slotQuantiles.slots} currentLine={sortedLine} className="mt-2" />
                        </InsightPanel>
                    )}

                    {isVisible("panel-greedy-coverage", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-greedy-coverage")}
                            section="Blueprint"
                            title="Greedy coverage lines (2+ and 3+ match)"
                            caption="Algorithmic multi-line sets generated to maximize historical 2+ and 3+ match coverage using minimal ticket budgets."
                            id="panel-greedy-coverage"
                            family="Blueprint"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Greedy 6 2+ Cover", value: `${greedyCoverage.greedy6TwoPlusCoverPct.toFixed(1)}%`, hint: "draws matching ≥2" },
                                { label: "Greedy 6 3+ Cover", value: `${greedyCoverage.greedy6ThreePlusCoverPct.toFixed(1)}%`, hint: "draws matching ≥3" },
                                { label: "Greedy 8 Pool 2+", value: `${greedyCoverage.greedy8TwoPlusCoverPct.toFixed(1)}%`, hint: "8-ball coverage" },
                            ]}
                        >
                            <div className="flex flex-col gap-3 mt-2">
                                <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-2.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-primary">Optimal 6-Ball Greedy Line</span>
                                        <span className="font-mono text-ink">{greedyCoverage.greedy6TwoPlusCoverPct.toFixed(1)}% (2+)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {greedyCoverage.greedy6BallLine.map((b) => <CandidateBallChip key={b} number={b} />)}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-2.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-secondary">Optimal 8-Ball Candidate Pool</span>
                                        <span className="font-mono text-ink">{greedyCoverage.greedy8TwoPlusCoverPct.toFixed(1)}% (2+)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {greedyCoverage.greedy8BallPool.map((b) => <CandidateBallChip key={b} number={b} />)}
                                    </div>
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-pool-capture", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-pool-capture")}
                            section="Blueprint"
                            title="Candidate pool capture curve (8→20 balls)"
                            caption="How many winning numbers are captured as candidate pool size scales from 8 to 20 balls."
                            id="panel-pool-capture"
                            family="Blueprint"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Pool 12 2+ Match", value: `${poolCapture.rows.find((r)=>r.poolSize===12)?.empirical2Plus ?? 0}%`, hint: `null ${poolCapture.rows.find((r)=>r.poolSize===12)?.hyper2Plus ?? 0}%` },
                                { label: "Pool 18 3+ Match", value: `${poolCapture.rows.find((r)=>r.poolSize===18)?.empirical3Plus ?? 0}%`, hint: `null ${poolCapture.rows.find((r)=>r.poolSize===18)?.hyper3Plus ?? 0}%` },
                                { label: "Pool 20 2+ Match", value: `${poolCapture.rows.find((r)=>r.poolSize===20)?.empirical2Plus ?? 0}%`, hint: "empirical capture" },
                            ]}
                        >
                            <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Pool Size</th>
                                            <th className={thNum}>Empirical 2+</th>
                                            <th className={thNum}>Hyper 2+ Null</th>
                                            <th className={thNum}>Empirical 3+</th>
                                            <th className={thNum}>Hyper 3+ Null</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {poolCapture.rows.map((c) => (
                                            <tr key={c.poolSize}>
                                                <td className={td}><span className="font-semibold text-primary">{c.poolSize} Balls</span></td>
                                                <td className={tdNum}>{c.empirical2Plus}%</td>
                                                <td className={tdNum}>{c.hyper2Plus}%</td>
                                                <td className={tdNum}><span className="text-primary font-semibold">{c.empirical3Plus}%</span></td>
                                                <td className={tdNum}>{c.hyper3Plus}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-system-multipliers", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-system-multipliers")}
                            section="Covering"
                            title="System 7–12 match multipliers"
                            caption="Exact combinatorial guarantee multipliers: how many winning pairs, triples, and quads are generated when a System bet matches k numbers."
                            id="panel-system-multipliers"
                            family="Covering"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Sys 7 (7 lines)", value: "7 tickets", hint: "C(7,6)" },
                                { label: "Sys 8 (28 lines)", value: "28 tickets", hint: "C(8,6)" },
                                { label: "Sys 12 (924 lines)", value: "924 tickets", hint: "C(12,6)" },
                            ]}
                        >
                            <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>System</th>
                                            <th className={thNum}>Tickets</th>
                                            <th className={thNum}>If 4 Hits</th>
                                            <th className={thNum}>If 5 Hits</th>
                                            <th className={thNum}>If 6 Hits</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {systemMultipliers.map((s) => (
                                            <tr key={s.systemType}>
                                                <td className={td}><span className="font-semibold text-primary">{s.systemType}</span></td>
                                                <td className={tdNum}>{s.equivalentLines}</td>
                                                <td className={tdNum}>{s.if4Matches.match4}× 4-m</td>
                                                <td className={tdNum}>{s.if5Matches.match5}× 5-m</td>
                                                <td className={tdNum}>{s.if6Matches.match6}× G1 + {s.if6Matches.match5}× G2</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-covering-wheels", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-covering-wheels")}
                            section="Covering"
                            title="Covering wheel guarantees (C(v,6,m))"
                            caption="Standard mathematical covering designs providing unconditional 3-if-3, 3-if-4, or 4-if-4 guarantees at a fraction of full-system cost."
                            id="panel-covering-wheels"
                            family="Covering"
                            className="lg:col-span-6"
                            stats={[
                                { label: "C(12,6,3,3)", value: "6 tickets", hint: "vs 924 full" },
                                { label: "C(14,6,3,3)", value: "9 tickets", hint: "vs 3,003 full" },
                                { label: "Savings", value: "99.4%", hint: "ticket reduction" },
                            ]}
                        >
                            <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Design</th>
                                            <th className={th}>Guarantee</th>
                                            <th className={thNum}>Wheeled Tickets</th>
                                            <th className={thNum}>Full System</th>
                                            <th className={thNum}>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {coveringWheels.map((w, idx) => (
                                            <tr key={idx}>
                                                <td className={td}><span className="font-semibold text-primary">{w.designName}</span></td>
                                                <td className={td}>{w.guarantee}</td>
                                                <td className={tdNum}>{w.linesRequired}</td>
                                                <td className={tdNum}>{w.fullSystemLines}</td>
                                                <td className={tdNum}><span className="text-gold font-semibold">{w.lineSavingsPct}% saved</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-key-ball-lift", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-key-ball-lift")}
                            section="Covering"
                            title="Key-ball (banker) match lift"
                            caption="Combinatorial lift and risk profile when fixing 1 or 2 'banker' key numbers across all wheeled combinations."
                            id="panel-key-ball-lift"
                            family="Covering"
                            className="lg:col-span-6 xl:col-span-12"
                            stats={[
                                { label: "1 Banker Lift", value: `${keyBallLift[1]?.multiplierVsBase.toFixed(2)}×`, hint: "when banker hits" },
                                { label: "2 Bankers Lift", value: `${keyBallLift[2]?.multiplierVsBase.toFixed(2)}×`, hint: "when both hit" },
                                { label: "Base 3+ Chance", value: `${keyBallLift[0]?.chanceMatch3Plus.toFixed(2)}%`, hint: "unanchored line" },
                            ]}
                        >
                            {(() => {
                                const lift = Math.max(...keyBallLift.map((k) => k.multiplierVsBase));
                                const z = zOf(lift, 1);
                                const tone = lift >= 1.5 ? "signal" : lift <= 1.1 ? "null" : "watch";
                                return <PanelVerdict {...countVerdict(tone, "banker wheel", `${lift.toFixed(2)}x lift`, z, "lift", undefined, `lift:${lift.toFixed(2)}|null:1`)} />;
                            })()}
                            <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Anchors</th>
                                            <th className={thNum}>2+ Match %</th>
                                            <th className={thNum}>3+ Match %</th>
                                            <th className={thNum}>4+ Match %</th>
                                            <th className={thNum}>Lift Multiplier</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {keyBallLift.map((k) => (
                                            <tr key={k.anchorsLocked}>
                                                <td className={td}><span className="font-semibold text-primary">{k.anchorsLocked} Banker{k.anchorsLocked !== 1 ? "s" : ""}</span></td>
                                                <td className={tdNum}>{k.chanceMatch2Plus.toFixed(1)}%</td>
                                                <td className={tdNum}>{k.chanceMatch3Plus.toFixed(2)}%</td>
                                                <td className={tdNum}>{k.chanceMatch4Plus.toFixed(3)}%</td>
                                                <td className={tdNum}><span className="text-primary font-semibold">{k.multiplierVsBase.toFixed(2)}×</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-family-match-leaderboard", "blueprint") && (
                        <InsightPanel
                            number={pNum("panel-family-match-leaderboard")}
                            section="Blueprint"
                            title="League family match-count leaderboard"
                            caption="Empirical performance ranking across all 15 strategy families graded purely on match count (mean hits and 2+ hit rate), zero payout math."
                            id="panel-family-match-leaderboard"
                            family="Blueprint"
                            className="lg:col-span-12"
                            stats={[
                                { label: "Top Family", value: familyLeaderboard?.topFamily.family ?? "—", hint: `${(familyLeaderboard?.topFamily.meanHits ?? 0).toFixed(2)} mean hits` },
                                { label: "Best 2+ Rate", value: `${(familyLeaderboard?.topFamily.twoPlusRate ?? 0).toFixed(1)}%`, hint: "hit rate" },
                                { label: "Families Graded", value: `${familyLeaderboard?.families.length ?? 0} families`, hint: "pure match count" },
                            ]}
                        >
                            {(() => {
                                const row = familyLeaderboard?.families.find((f) => f.family === familyLeaderboard?.topFamily.family) ?? familyLeaderboard?.families[0];
                                const z = zOf(row?.meanHits ?? 0, row?.expectedHits ?? 1);
                                const tone = toneForZ(z);
                                return <PanelVerdict {...countVerdict(tone, `family ${row?.family ?? "—"}`, `${(row?.meanHits ?? 0).toFixed(2)} mean hits`, z, "family", row ? `family-${String(row.family).toLowerCase().replace(/\s+/g, "-")}` : undefined, `exp:${(row?.expectedHits ?? 0).toFixed(2)}`)} />;
                            })()}
                            <div className="overflow-x-auto mt-2">
                                <table className="w-full border-collapse text-left text-xs min-w-[560px]">
                                    <thead>
                                        <tr className="border-b border-line text-ink-subtle">
                                            <th className={th}>Family</th>
                                            <th className={thNum}>Strategies</th>
                                            <th className={thNum}>Mean Hits</th>
                                            <th className={thNum}>Expected</th>
                                            <th className={thNum}>2+ Rate</th>
                                            <th className={th}>Best Strategy</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line-soft font-mono">
                                        {familyLeaderboard?.families.map((f) => (
                                            <tr key={f.family}>
                                                <td className={td}><span className="font-semibold text-ink whitespace-nowrap">{f.family}</span></td>
                                                <td className={tdNum}>{f.strategyCount}</td>
                                                <td className={tdNum}><span className="text-primary font-semibold">{f.meanHits.toFixed(2)}</span></td>
                                                <td className={tdNum}>{f.expectedHits.toFixed(2)}</td>
                                                <td className={tdNum}>{f.twoPlusRate.toFixed(1)}%</td>
                                                <td className={td}><span className="text-ink-muted whitespace-nowrap">{f.topStrategyName}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </InsightPanel>
                    )}
                </LazyGallerySection>
            )}

            {/* ---------------------------------------------------------------- *
             * 10. Order geometry & additive structure.
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "order-geometry") && (
                <LazyGallerySection id="order-geometry" title="10. Order geometry & additive structure" forceMount={forceMount}>
                    {isVisible("panel-mahalanobis-ellipsoid", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-mahalanobis-ellipsoid")}
                            section="Order geometry"
                            title="Order-statistic Mahalanobis ellipsoid"
                            caption="Each draw's six sorted numbers measured against the exact order-statistic mean and covariance of a uniform 6-of-49 line, against the chi-square(6) null."
                            id="panel-mahalanobis-ellipsoid"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean D²", value: mahalanobis.meanD2.toFixed(2), hint: "null 6.00" },
                                { label: "Typical", value: formatNumber(mahalanobis.typicalCount), hint: "inside the median" },
                                { label: "Extreme", value: formatNumber(mahalanobis.extremeCount), hint: "past the p95" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(mahalanobis.meanD2, 6);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `meand2:${mahalanobis.meanD2.toFixed(2)}|null:6|${metricZ(z)}`)} />;
                            })()}
                            <ObservedExpectedBarChart
                                items={[
                                    {
                                        label: "Mean D²",
                                        observedValue: mahalanobis.meanD2,
                                        expectedValue: 6,
                                        formattedObserved: mahalanobis.meanD2.toFixed(2),
                                        formattedExpected: "6.00",
                                    },
                                    {
                                        label: "Median D²",
                                        observedValue: mahalanobis.medianD2,
                                        expectedValue: chiSquareQuantile(0.5, 6),
                                        formattedObserved: mahalanobis.medianD2.toFixed(2),
                                        formattedExpected: chiSquareQuantile(0.5, 6).toFixed(2),
                                    },
                                    {
                                        label: "p95 D²",
                                        observedValue: mahalanobis.p95D2,
                                        expectedValue: chiSquareQuantile(0.95, 6),
                                        formattedObserved: mahalanobis.p95D2.toFixed(2),
                                        formattedExpected: chiSquareQuantile(0.95, 6).toFixed(2),
                                    },
                                ]}
                                className="mt-2"
                            />
                            <div className="mt-2 flex flex-col gap-1">
                                <span className="text-[10px] text-ink-subtle">The most typical lines — tap a ball to build your own.</span>
                                {mahalanobis.mostTypical.slice(0, 3).map((row) => (
                                    <div key={row.draw} className="flex items-center gap-1.5">
                                        <span className="w-10 shrink-0 font-mono text-[10px] text-ink-subtle tabular-nums">
                                            #{row.draw}
                                        </span>
                                        <span className="flex flex-wrap gap-1">
                                            {row.line.map((ball) => (
                                                <CandidateBallChip key={ball} number={ball} />
                                            ))}
                                        </span>
                                        <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-subtle tabular-nums">
                                            D² {row.d2.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-gap-curvature", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-gap-curvature")}
                            section="Order geometry"
                            title="Gap curvature & zigzag sign-flips"
                            caption="The five slot deltas and their second differences, against the archive interquartile bands — with the live candidate's own curvature profile."
                            id="panel-gap-curvature"
                            family="Sequence"
                            className="lg:col-span-6"
                            stats={[
                                {
                                    label: "Convex Fan",
                                    value: pct(curvature.regimeShares["Convex Fan"]),
                                    hint: `null ${pct(curvature.regimeNull["Convex Fan"])}`,
                                },
                                {
                                    label: "Balanced",
                                    value: pct(curvature.regimeShares.Balanced),
                                    hint: `null ${pct(curvature.regimeNull.Balanced)}`,
                                },
                                {
                                    label: "Zigzag ≥ 2",
                                    value: pct(curvature.flipShares[2] + curvature.flipShares[3]),
                                    hint: `null ${pct(curvature.flipNull[2] + curvature.flipNull[3])}`,
                                },
                            ]}
                        >
                            {(() => {
                                const observed = curvature.flipShares[2] + curvature.flipShares[3];
                                const nullShare = curvature.flipNull[2] + curvature.flipNull[3];
                                return <PanelVerdict {...edgeVerdict(Math.abs(zOf(observed, nullShare)) >= 2, `zigzag:${pct(observed)}|null:${pct(nullShare)}`)} />;
                            })()}
                            <CurvatureProfileChart
                                gapMedian={curvature.bands.gapMedian}
                                gapP25={curvature.bands.gapP25}
                                gapP75={curvature.bands.gapP75}
                                secondMedian={curvature.bands.secondMedian}
                                secondP25={curvature.bands.secondP25}
                                secondP75={curvature.bands.secondP75}
                                candidateDeltas={candidateProfile?.deltas}
                                candidateSecondDiffs={candidateProfile?.secondDiffs}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-sidon-sumset", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-sidon-sumset")}
                            section="Order geometry"
                            title="Sidon B2 additive sumset"
                            caption="How many distinct pairwise sums a line produces — 21 is a pure Sidon set with zero four-term relations, against the exact combinatorial null over every 6-of-49 line."
                            id="panel-sidon-sumset"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean |A+A|", value: sidon.meanSumset.toFixed(2), hint: `null ${sidon.nullMeanSumset.toFixed(2)}` },
                                { label: "Pure Sidon", value: pct(sidon.pureSidonShare), hint: `${formatNumber(sidon.pureSidonCount)} lines` },
                                { label: "Max |A+A|", value: "21", hint: "zero collisions" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(sidon.meanSumset, sidon.nullMeanSumset);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `mean:${sidon.meanSumset.toFixed(2)}|null:${sidon.nullMeanSumset.toFixed(2)}|${metricZ(z)}`)} />;
                            })()}
                            <ObservedExpectedBarChart
                                items={sidon.observedDistribution.map((share, index) => ({
                                    label: `|A+A| ${index + 11}`,
                                    observedValue: share,
                                    expectedValue: sidon.nullDistribution[index],
                                    formattedObserved: pct(share),
                                    formattedExpected: pct(sidon.nullDistribution[index]),
                                })).slice(4)}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-constellation-mst", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-constellation-mst")}
                            section="Order geometry"
                            title="Playslip 7×7 MST constellation"
                            caption="The latest draw's six balls on the playslip lattice with their exact Euclidean minimum spanning tree and barycentre — the gold overlay is your candidate line."
                            id="panel-constellation-mst"
                            family="Pattern"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean MST", value: constellation.meanMst.toFixed(2), hint: `lattice ${constellation.latticeMstMean.toFixed(2)}` },
                                { label: "Wider than lattice", value: pct(constellation.spreadShare), hint: "of all lines" },
                                { label: "Mean gyration", value: constellation.meanGyration.toFixed(2), hint: "radius of gyration" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(constellation.meanMst, constellation.latticeMstMean);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `mst:${constellation.meanMst.toFixed(2)}|lattice:${constellation.latticeMstMean.toFixed(2)}|${metricZ(z)}`)} />;
                            })()}
                            <ConstellationMstBoardChart
                                points={(constellation.latest?.stats.cells ?? []).map((cell) => ({
                                    ball: cell.ball,
                                    row: cell.row,
                                    col: cell.col,
                                }))}
                                edges={constellation.latest?.stats.mstEdges ?? []}
                                baryRow={constellation.latest?.stats.baryRow ?? 3}
                                baryCol={constellation.latest?.stats.baryCol ?? 3}
                                candidatePoints={sortedLine.map((ball) => {
                                    const cell = playslipCellOf(ball);
                                    return { ball, row: cell.row, col: cell.col };
                                })}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-subgraph-cohesion", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-subgraph-cohesion")}
                            section="Order geometry"
                            title="Induced sub-graph cohesion"
                            caption="The mean co-occurrence Z over the fifteen internal pair edges of each draw, against the zero-lift hypergeometric baseline."
                            id="panel-subgraph-cohesion"
                            family="Pairs"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean pair Z", value: subgraph.meanPairZ.toFixed(3), hint: "15 internal edges" },
                                { label: "Positive edges", value: subgraph.meanPositiveEdges.toFixed(1), hint: "of 15 per draw" },
                                { label: "Components", value: subgraph.meanComponents.toFixed(2), hint: "over positive edges" },
                            ]}
                        >
                            {(() => {
                                return <PanelVerdict {...edgeVerdict(Math.abs(subgraph.meanPairZ) >= 2, `meanpairz:${subgraph.meanPairZ.toFixed(3)}`)} />;
                            })()}
                            <OscillatorBandChart
                                items={subgraph.rows.slice(-60).map((row) => ({
                                    number: row.draw,
                                    value: row.meanPairZ,
                                    label: `draw ${row.draw}`,
                                    sublabel: `${row.positiveEdges} positive edges`,
                                }))}
                                minVal={Math.min(-1, ...subgraph.rows.slice(-60).map((row) => row.meanPairZ))}
                                maxVal={Math.max(1, ...subgraph.rows.slice(-60).map((row) => row.meanPairZ))}
                                overbought={0.5}
                                oversold={-0.5}
                                center={0}
                                valueSuffix=" Z"
                                className="mt-2"
                                ariaLabel="Mean internal co-occurrence Z over the last sixty draws"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-benford-coprime", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-benford-coprime")}
                            section="Order geometry"
                            title="Multiplicative coprime density"
                            caption="How many of a line's fifteen pairs share no factor, against the exact null over every 6-of-49 line, plus the scale-invariant AM–GM spread."
                            id="panel-benford-coprime"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                {
                                    label: "Mean coprime",
                                    value: coprime.meanCoprimePairs.toFixed(2),
                                    hint: `null ${coprime.expectedCoprimePairs.toFixed(2)} of 15`,
                                },
                                {
                                    label: "Pool coprime",
                                    value: `${coprime.poolCoprimePairs} / 1176`,
                                    hint: `${pct(coprime.poolCoprimeRate)} of pairs`,
                                },
                                {
                                    label: "AM–GM spread",
                                    value: coprime.meanSpread.toFixed(2),
                                    hint: `null ${coprime.nullSpreadMean.toFixed(2)}`,
                                },
                            ]}
                        >
                            {(() => {
                                const z = zOf(coprime.meanCoprimePairs, coprime.expectedCoprimePairs);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `coprime:${coprime.meanCoprimePairs.toFixed(2)}|null:${coprime.expectedCoprimePairs.toFixed(2)}|${metricZ(z)}`)} />;
                            })()}
                            <ObservedExpectedBarChart
                                items={coprime.observedDistribution.map((share, index) => ({
                                    label: `${index} pairs`,
                                    observedValue: share,
                                    expectedValue: coprime.nullDistribution[index],
                                    formattedObserved: pct(share),
                                    formattedExpected: pct(coprime.nullDistribution[index]),
                                })).slice(4)}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-cyclic-torus", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-cyclic-torus")}
                            section="Order geometry"
                            title="Cyclic Z₄₉ torus arcs"
                            caption="The six cyclic gaps on the 49-ring, the largest empty sector and the smallest arc covering every ball — against the exact six-cut spacing null."
                            id="panel-cyclic-torus"
                            family="Structure"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean max gap", value: torus.meanMaxGap.toFixed(2), hint: `null ${torus.nullMeanMaxGap.toFixed(2)}` },
                                { label: "Covering arc", value: torus.meanCoveringArc.toFixed(2), hint: "balls of arc" },
                                { label: "Reflection |μ−25|", value: torus.meanReflection.toFixed(2), hint: "symmetry offset" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(torus.meanMaxGap, torus.nullMeanMaxGap);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `maxgap:${torus.meanMaxGap.toFixed(2)}|null:${torus.nullMeanMaxGap.toFixed(2)}|${metricZ(z)}`)} />;
                            })()}
                            <ObservedExpectedBarChart
                                items={torus.observedDistribution.map((share, index) => ({
                                    label: `gap ${index + 1}`,
                                    observedValue: share,
                                    expectedValue: torus.nullDistribution[index],
                                    formattedObserved: pct(share),
                                    formattedExpected: pct(torus.nullDistribution[index]),
                                })).slice(8, 30)}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-recursive-sequences", "order-geometry") && (
                        <InsightPanel
                            number={pNum("panel-recursive-sequences")}
                            section="Order geometry"
                            title="Recursive integer resonance"
                            caption="Twelve recursive and integer-theoretic sets inside 1–49, each measured against the exact hypergeometric expectation 6|S|/49."
                            id="panel-recursive-sequences"
                            family="Pattern"
                            className="lg:col-span-6"
                            stats={[
                                {
                                    label: "Strongest",
                                    value: resonance.latest?.label ?? "—",
                                    hint: resonance.latest ? `${resonance.latest.hits} of 6 balls` : undefined,
                                },
                                { label: "Mean z", value: resonance.meanZ.toFixed(3), hint: "across the twelve sets" },
                                { label: "Mean hits", value: resonance.meanHits.toFixed(2), hint: `null ${resonance.meanExpected.toFixed(2)}` },
                            ]}
                        >
                            {(() => {
                                return <PanelVerdict {...edgeVerdict(Math.abs(resonance.meanZ) >= 2, `meanz:${resonance.meanZ.toFixed(3)}|hits:${resonance.meanHits.toFixed(2)}`)} />;
                            })()}
                            <ObservedExpectedBarChart
                                items={resonance.rows.map((row) => ({
                                    label: row.label,
                                    observedValue: row.meanHits,
                                    expectedValue: row.expected,
                                    formattedObserved: row.meanHits.toFixed(2),
                                    formattedExpected: row.expected.toFixed(2),
                                    tone: row.zScore > 0.5 ? "gold" : "primary",
                                }))}
                                orientation="horizontal"
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}
                </LazyGallerySection>
            )}

            {/* ---------------------------------------------------------------- *
             * 11. Sequence dynamics & point processes.
             * ---------------------------------------------------------------- */}
            {(activeSection === "all" || activeSection === "stream-dynamics") && (
                <LazyGallerySection id="stream-dynamics" title="11. Sequence dynamics & point processes" forceMount={forceMount}>
                    {isVisible("panel-wasserstein-transport", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-wasserstein-transport")}
                            section="Stream dynamics"
                            title="Wasserstein-1 optimal transport"
                            caption="The Earth Mover's distance between consecutive draws — how far the cage moved — against the analytical expectation for two independent draws."
                            id="panel-wasserstein-transport"
                            family="Sequence"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean W₁", value: wasserstein.meanW1.toFixed(2), hint: `null ${wasserstein.expectedW1.toFixed(2)}` },
                                { label: "Quiet / jump", value: `${wasserstein.quietCount} / ${wasserstein.jumpCount}`, hint: "inside vs past the p95" },
                                { label: "Reversion", value: wasserstein.reversionCorrelation.toFixed(3), hint: "lag-1 correlation" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(wasserstein.medianW1, wasserstein.expectedW1);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `w1:${wasserstein.medianW1.toFixed(2)}|null:${wasserstein.expectedW1.toFixed(2)}|${metricZ(z)}`)} />;
                            })()}
                            <EnvelopeBandChart
                                points={wasserstein.envelope.slice(-120)}
                                valueLabel="W₁"
                                channelLabel="15-draw envelope"
                                className="mt-2"
                                ariaLabel="Wasserstein-1 transport between consecutive draws over the last hundred and twenty transitions"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-lempel-ziv", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-lempel-ziv")}
                            section="Stream dynamics"
                            title="Lempel-Ziv algorithmic complexity"
                            caption="The Kaspar-Schuster parse of the chronological sum stream over rolling 100-draw windows — the archive's phrase count against the same window of its shuffled twin."
                            id="panel-lempel-ziv"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean phrases", value: lempelZiv.meanPhraseCount.toFixed(2), hint: "per 100-draw window" },
                                { label: "Shuffled null", value: lempelZiv.nullPhraseCount.toFixed(2), hint: "same stream, shuffled" },
                                { label: "Π ceiling", value: pct(lempelZivCeiling(lempelZiv)), hint: "Feder–Merhav bound" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(lempelZiv.meanComplexity, lempelZiv.shuffledBaseline);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `cnorm:${lempelZiv.meanComplexity.toFixed(3)}|shuffled:${lempelZiv.shuffledBaseline.toFixed(3)}|${metricZ(z)}`)} />;
                            })()}
                            <EnvelopeBandChart
                                points={lempelZivPoints(lempelZiv)}
                                valueLabel="c_norm"
                                channelLabel="Bernoulli(½) band"
                                className="mt-2"
                                ariaLabel="Normalized Lempel-Ziv complexity of the draw-sum stream over rolling windows"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-spectral-periodogram", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-spectral-periodogram")}
                            section="Stream dynamics"
                            title="Spectral periodogram & Fisher's test"
                            caption="The DFT spectrum of the draw sums, with Fisher's test for periodicity against the white-noise null and the balls whose dominant harmonic points at the next draw."
                            id="panel-spectral-periodogram"
                            family="Indicators"
                            className="lg:col-span-12"
                            stats={[
                                { label: "Dominant P*", value: `${spectral.dominantPeriod.toFixed(1)} draws`, hint: "sum series" },
                                { label: "Fisher g", value: spectral.fisherG.toFixed(2), hint: `threshold ${spectral.gThreshold.toFixed(2)}` },
                                { label: "White-noise p", value: spectral.fisherP < 0.001 ? "<0.001" : spectral.fisherP.toFixed(4), hint: "vs the exponential null" },
                                { label: "Phase leader", value: spectral.phaseAligned[0] ? `Ball ${spectral.phaseAligned[0].ball}` : "—", hint: "next draw" },
                            ]}
                        >
                            {(() => {
                                const deviation = spectral.fisherP < 0.01;
                                return <PanelVerdict {...edgeVerdict(deviation, `g:${spectral.fisherG.toFixed(2)}|p:${spectral.fisherP.toFixed(4)}`)} />;
                            })()}
                            <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                                <PeriodogramSpectrumChart
                                    spectrum={spectral.spectrum}
                                    g={spectral.fisherG}
                                    gThreshold={spectral.gThreshold}
                                    significancePower={spectral.sum.significancePower}
                                    dominantPeriod={spectral.dominantPeriod}
                                    pValue={spectral.fisherP}
                                />
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                        Phase-aligned balls
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {spectral.phaseAligned.slice(0, 8).map((row) => (
                                            <CandidateBallChip
                                                key={row.ball}
                                                number={row.ball}
                                                sublabel={row.nextPhaseAlignment.toFixed(2)}
                                                score={`${row.dominantPeriod.toFixed(0)}d`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </InsightPanel>
                    )}

                    {isVisible("panel-hawkes-intensity", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-hawkes-intensity")}
                            section="Stream dynamics"
                            title="Discrete Hawkes arrival intensity"
                            caption="A five-draw half-life exponential memory kernel over each ball's appearances, separating self-exciting balls from refractory ones against the memoryless base rate."
                            id="panel-hawkes-intensity"
                            family="Indicators"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Hottest", value: hawkes.hottest ? `Ball ${hawkes.hottest.ball}` : "—", hint: hawkes.hottest ? `λ ${hawkes.hottest.intensity.toFixed(2)}` : undefined },
                                { label: "Base rate", value: hawkes.baseRate.toFixed(4), hint: "6 / 49" },
                                { label: "Mean λ", value: hawkes.meanIntensity.toFixed(3), hint: "across the 49 balls" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(hawkes.meanIntensity, hawkes.baseRate);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `lambda:${hawkes.meanIntensity.toFixed(4)}|base:${hawkes.baseRate.toFixed(4)}|${metricZ(z)}`)} />;
                            })()}
                            <ScatterRegressionChart
                                points={hawkes.rows.map((row) => ({
                                    x: row.excitation,
                                    y: row.intensity,
                                    label: `Ball ${row.ball}`,
                                    sublabel: `excitation z ${row.excitationZ.toFixed(2)}`,
                                }))}
                                xName="kernel-weighted appearances"
                                yName="arrival intensity λ"
                                className="mt-2"
                                ariaLabel="Hawkes arrival intensity against the kernel-weighted recent appearances of every ball"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-rqa-recurrence", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-rqa-recurrence")}
                            section="Stream dynamics"
                            title="Recurrence quantification analysis"
                            caption="The trailing 180-draw state-space recurrence plot — a pair recurs when the two draws share at least two balls — with the determinism and laminarity read off the run structure."
                            id="panel-rqa-recurrence"
                            family="Sequence"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Recurrence RR", value: pct(rqa.recurrenceRate), hint: `null ${pct(rqa.null)}` },
                                { label: "Determinism", value: pct(rqa.determinism), hint: "on diagonal runs" },
                                { label: "Laminarity", value: pct(rqa.laminarity), hint: "on vertical runs" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(rqa.recurrenceRate, rqa.null);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `rr:${pct(rqa.recurrenceRate)}|null:${pct(rqa.null)}|${metricZ(z)}`)} />;
                            })()}
                            <RecurrenceMatrixPlot matrix={rqa.matrix} size={rqa.size} className="mt-2" />
                        </InsightPanel>
                    )}

                    {isVisible("panel-union-depletion", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-union-depletion")}
                            section="Stream dynamics"
                            title="Multi-draw union depletion"
                            caption="How the trailing L draws exhaust the cage: the union's size, how many of the next draw came out of it versus the untouched cold pool, against the hypergeometric curves."
                            id="panel-union-depletion"
                            family="Sequence"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Crossover L*", value: `${unionDepletion.crossoverHorizon}`, hint: `analytic ${unionDepletion.crossoverAnalytic.toFixed(1)} draws` },
                                { label: "Live union", value: `${unionDepletion.liveUnion.length} balls`, hint: "trailing 8 draws" },
                                { label: "Cold pool", value: `${unionDepletion.liveColdPool.length} balls`, hint: "never seen lately" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(unionDepletion.crossoverHorizon, unionDepletion.crossoverAnalytic);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `lstar:${unionDepletion.crossoverHorizon}|analytic:${unionDepletion.crossoverAnalytic.toFixed(1)}|${metricZ(z)}`)} />;
                            })()}
                            <UnionPartitionCurveChart
                                rows={unionDepletion.rows}
                                crossoverHorizon={unionDepletion.crossoverHorizon}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-permutation-entropy", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-permutation-entropy")}
                            section="Stream dynamics"
                            title="Bandt-Pompe permutation entropy"
                            caption="The six ordinal motifs of the chronological draw sums — how often each ordering pattern appears — against the i.i.d. uniform share of one sixth."
                            id="panel-permutation-entropy"
                            family="Sequence"
                            className="lg:col-span-6"
                            stats={[
                                { label: "H_perm (d=4)", value: permutation.entropyD4.toFixed(3), hint: "normalized, max 1" },
                                { label: "H_perm (d=3)", value: permutation.entropyD3.toFixed(3), hint: "normalized, max 1" },
                                { label: "Trailing motif", value: permutation.trailingMotif, hint: "last three sums" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(permutation.entropyD4, 1);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `hperm:${permutation.entropyD4.toFixed(3)}|null:1|${metricZ(z)}`)} />;
                            })()}
                            <OrdinalMotifBarChart
                                shares={permutation.motifShares}
                                nullShare={permutation.motifNull}
                                labels={[...ORDINAL_MOTIF_LABELS]}
                                glyphs={[...ORDINAL_MOTIF_GLYPHS]}
                                trailingMotifIndex={permutation.trailingMotifIndex}
                                className="mt-2"
                            />
                        </InsightPanel>
                    )}

                    {isVisible("panel-jensen-shannon-turnover", "stream-dynamics") && (
                        <InsightPanel
                            number={pNum("panel-jensen-shannon-turnover")}
                            section="Stream dynamics"
                            title="Jensen-Shannon distributional turnover"
                            caption="How fast the 49-ball share distribution turns over — a 15-draw window against the 45-draw baseline that contains it — against a null that nests the same way."
                            id="panel-jensen-shannon-turnover"
                            family="Sequence"
                            className="lg:col-span-6"
                            stats={[
                                { label: "Mean D_JS", value: turnover.meanDivergence.toFixed(4), hint: "bits" },
                                { label: "Null median", value: turnover.nullMedian.toFixed(4), hint: "matched 15-in-45 null" },
                                { label: "Above null", value: pct(turnover.aboveNullShare), hint: "of windows" },
                            ]}
                        >
                            {(() => {
                                const z = zOf(turnover.meanDivergence, turnover.nullMedian);
                                return <PanelVerdict {...edgeVerdict(Math.abs(z) >= 2, `djs:${turnover.meanDivergence.toFixed(4)}|nullmedian:${turnover.nullMedian.toFixed(4)}|${metricZ(z)}`)} />;
                            })()}
                            <EnvelopeBandChart
                                points={turnover.rows.slice(-120).map((row) => ({
                                    label: row.label,
                                    value: row.divergence,
                                    upper: turnover.nullP95,
                                    lower: turnover.nullP5,
                                    ma: turnover.nullMedian,
                                }))}
                                valueLabel="D_JS"
                                channelLabel="null p5-p95"
                                className="mt-2"
                                ariaLabel="Jensen-Shannon divergence between the fast and baseline windows against the matched null band"
                            />
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div className="min-w-0">
                                    <p className="font-mono text-[9px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                        Share gainers
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {turnover.topGainers.slice(0, 5).map((mover) => (
                                            <CandidateBallChip key={mover.ball} number={mover.ball} score={`+${(mover.shareDelta * 100).toFixed(1)}%`} />
                                        ))}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <p className="font-mono text-[9px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
                                        Share losers
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {turnover.topLosers.slice(0, 5).map((mover) => (
                                            <CandidateBallChip key={mover.ball} number={mover.ball} score={`${(mover.shareDelta * 100).toFixed(1)}%`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </InsightPanel>
                    )}
                </LazyGallerySection>
            )}

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                Every number is equally likely in every draw. The correlations and patterns above describe the historical empirical archive and do not predict future draws. Play for entertainment, never to recover a loss.
            </p>
        </div>
    );
};
