import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";
import { Ball } from "@/components/balls";
import { Panel } from "@/components/panel";
import { PageHeader } from "@/components/product/page-header";
import { SectionHeading } from "@/components/product/section-heading";
import { DataLoading, PageHeaderSkeleton, Skeleton } from "@/components/product/skeleton";
import { td, tdNum, th, thNum } from "@/components/product/table";
import { CountDistributionChart, DecadeHeatmap, FrequencyChart, type HeatmapCell, type SumBin, SumHistogram, WeekdayChart } from "@/components/toto-charts";
import { type Analysis, type Draw, drawDecades, drawSum, formatDate, formatNumber, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

/** The six panels, in reading order — the nav links to these ids. */
const PANELS = [
    { id: "frequency", label: "Frequency" },
    { id: "sum-distribution", label: "Sums" },
    { id: "odd-even", label: "Odd / even" },
    { id: "decade-spread", label: "Decades" },
    { id: "pairs", label: "Pairs" },
    { id: "weekday", label: "Weekday" },
] as const;

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

const InsightsSkeleton = () => (
    <DataLoading label="Loading the statistics">
        <PageHeaderSkeleton />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
    </DataLoading>
);

export const InsightsScreen = () => {
    usePageTitle("Insights — what the draws look like");

    const { data: analysis, isLoading: analysisLoading, error: analysisError } = useJson<Analysis>("/data/analysis.json");
    const { data: draws, isLoading: drawsLoading, error: drawsError } = useJson<Draw[]>("/data/draws.json");
    const [activeId, setActiveId] = useState<string>(PANELS[0].id);

    // Scroll spy: the heading nearest the top of the viewport is the section
    // the reader is on. The bottom margin keeps the band to the upper fifth of
    // the screen, so a heading only counts once it is properly in view.
    useEffect(() => {
        const headings = PANELS.map((panel) => document.getElementById(panel.id)).filter((heading): heading is HTMLElement => heading !== null);
        if (headings.length === 0) return;

        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                // The deepest visible heading wins — the one the reader reached.
                let next: string | null = null;
                for (const heading of headings) {
                    if (visible.has(heading.id)) next = heading.id;
                }
                if (next) setActiveId(next);
            },
            { rootMargin: "-96px 0px -78% 0px", threshold: 0 },
        );

        for (const heading of headings) observer.observe(heading);
        return () => observer.disconnect();
        // Re-run once the panels exist: on first mount the data has not landed
        // yet, so there are no headings to observe.
    }, [analysis, draws]);

    const scrollTo = (event: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
        const target = document.getElementById(id);
        if (!target) return;

        event.preventDefault();
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        window.history.replaceState(null, "", `#${id}`);
    };

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
            .slice(0, 15);
    }, [eraDraws]);

    const weekdayDays = useMemo(
        () =>
            WEEKDAY_ORDER.map((label) => {
                const entry = analysis?.weekday[label];
                return { label, count: entry?.count ?? 0, meanSum: entry?.meanSum ?? 0 };
            }),
        [analysis],
    );

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
    const hottest = (entry: { number: number; count: number } | undefined, tone: "primary" | "default", label: string) => {
        if (!entry) return null;
        return (
            <div className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2">
                <Ball n={entry.number} size="md" />
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
                    <p className="text-xs text-ink tabular-nums">{formatNumber(entry.count)} draws</p>
                </div>
                <span className={cx("font-mono text-xs tabular-nums", tone === "primary" ? "text-accent" : "text-ink-muted")}>
                    {((entry.count / total) * 100).toFixed(1)}%
                </span>
            </div>
        );
    };

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
                        <span>6/49 era</span>
                        <span aria-hidden="true">·</span>
                        <span>since {formatDate(coverage.firstDate)}</span>
                    </>
                }
                description="How often each number appeared, how the six added up, and how they split by odd/even, decade, pair and weekday."
            />

            <nav aria-label="Insight panels" className="sticky top-13 z-20 -mx-4 border-b border-line bg-canvas/90 px-4 backdrop-blur-md md:-mx-6 md:px-6">
                <div className="scrollbar-hide flex gap-1 overflow-x-auto">
                    {PANELS.map((panel) => {
                        const active = activeId === panel.id;

                        return (
                            <a
                                key={panel.id}
                                href={`#${panel.id}`}
                                onClick={(event) => scrollTo(event, panel.id)}
                                aria-current={active ? "true" : undefined}
                                className={cx(
                                    "relative shrink-0 px-2.5 py-2 text-[11px] font-semibold whitespace-nowrap transition-colors duration-100 ease-linear",
                                    active ? "text-accent" : "text-ink-subtle hover:text-ink",
                                )}
                            >
                                {panel.label}
                                {active && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-full bg-accent" />}
                            </a>
                        );
                    })}
                </div>
            </nav>

            <Panel>
                <SectionHeading
                    id={PANELS[0].id}
                    kicker="01"
                    title="Frequency"
                    description={`How many of the ${formatNumber(total)} draws each number appeared in. The dashed line is the average.`}
                />
                <FrequencyChart
                    counts={analysis.frequency.all}
                    expected={expectedPerNumber}
                    totalDraws={total}
                    hotNumber={hot?.number}
                    coldNumber={cold?.number}
                    className="mt-3"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {hottest(hot, "primary", "Most seen")}
                    {hottest(cold, "default", "Least seen")}
                </div>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[1].id}
                    kicker="02"
                    title="Sums"
                    description="How often the six numbers added up to each total, in bands of ten."
                />
                <SumHistogram bins={sumBins} mean={analysis.sum.mean} median={analysis.sum.median} band={band} totalDraws={total} className="mt-3" />
                <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                    Mean <span className="font-mono text-ink-muted tabular-nums">{analysis.sum.mean.toFixed(1)}</span> · median{" "}
                    <span className="font-mono text-ink-muted tabular-nums">{analysis.sum.median}</span> ·{" "}
                    <span className="font-mono text-ink-muted tabular-nums">{formatNumber(band.count)}</span> of {formatNumber(total)} draws (
                    {Math.round(band.share * 100)}%) fall between {band.lo} and {band.hi}.
                </p>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[2].id}
                    kicker="03"
                    title="Odd / even and low / high"
                    description="How many of the six are odd or even, and how many are 24 or below."
                />
                <div className="mt-3 grid gap-5 md:grid-cols-2">
                    <div>
                        <p className="text-[11px] font-semibold text-ink-muted">Odd numbers per draw</p>
                        <CountDistributionChart
                            counts={analysis.oddEven}
                            unit="odd numbers"
                            expectedBucket={Math.round(oddExpected)}
                            expectedValue={oddExpected}
                            totalDraws={total}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-ink-muted">Low numbers (≤ 24) per draw</p>
                        <CountDistributionChart
                            counts={analysis.lowHigh}
                            unit="low numbers (≤ 24)"
                            expectedBucket={Math.round(lowExpected)}
                            expectedValue={lowExpected}
                            totalDraws={total}
                            tone="secondary"
                            className="mt-1"
                        />
                    </div>
                </div>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[3].id}
                    kicker="04"
                    title="Decade spread"
                    description="Numbers per draw from each decade, year by year, with the all-time average on the right."
                />
                <DecadeHeatmap rows={DECADE_LABELS} columns={decades.years} cells={decades.cells} marginal={analysis.decades} className="mt-3" />
                <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                    2014 holds only part of the year. Every decade sits between{" "}
                    <span className="font-mono text-ink-muted tabular-nums">{decadeMin.toFixed(2)}</span> and{" "}
                    <span className="font-mono text-ink-muted tabular-nums">{decadeMax.toFixed(2)}</span> numbers per draw.
                </p>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[4].id}
                    kicker="05"
                    title="Pairs"
                    description="Pairs that appeared together most often."
                />
                <div className="mt-3 grid gap-5 md:grid-cols-[1fr_18rem]">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr>
                                <th scope="col" className={cx(th, "static w-10")}>
                                    #
                                </th>
                                <th scope="col" className={cx(th, "static")}>
                                    Pair
                                </th>
                                <th scope="col" className={cx(thNum, "static")}>
                                    Draws
                                </th>
                                <th scope="col" className={cx(thNum, "static")}>
                                    Share
                                </th>
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
                    <div className="flex flex-col gap-2 self-start rounded-lg bg-surface-2 px-3 py-2.5">
                        <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">What to expect</p>
                        <p className="text-[11px] leading-4 text-ink-subtle">
                            A fixed pair meets about <span className="font-mono text-ink-muted tabular-nums">{expectedPairMeetings.toFixed(1)}</span> times in{" "}
                            {formatNumber(total)} draws. The top pair met <span className="font-mono text-ink-muted tabular-nums">{pairs[0]?.count ?? 0}</span> —
                            the most of {formatNumber(PAIRS_IN_POOL)} possible pairs.
                        </p>
                    </div>
                </div>
            </Panel>

            <Panel>
                <SectionHeading id={PANELS[5].id} kicker="06" title="Weekday" description="Draws per weekday, with the mean sum above each bar." />
                <WeekdayChart days={weekdayDays} className="mt-3" />
                <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                    Draws run Monday and Thursday. The {formatNumber(fridayDraws)} Friday draws are special draws, not a third weekly draw.
                </p>
            </Panel>

            <p className="px-1 text-[11px] leading-4 text-ink-subtle">
                TOTO draws are independent and uniform. Every number is equally likely in every draw, so the patterns above describe the past and do not
                predict the next draw.
            </p>
        </div>
    );
};
