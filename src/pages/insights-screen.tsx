import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/panel";
import { SectionHeading } from "@/components/product/section-heading";
import { td, tdNum, th, thNum } from "@/components/product/table";
import { CountDistributionChart, DecadeHeatmap, FrequencyChart, type HeatmapCell, type SumBin, SumHistogram, WeekdayChart } from "@/components/toto-charts";
import { type Analysis, type Draw, drawDecades, drawSum, formatDate, formatNumber, useJson } from "@/lib/data";
import { usePageTitle } from "@/pages/layout";
import { cx } from "@/utils/cx";

/** The six panels, in reading order — the nav links to these ids. */
const PANELS = [
    { id: "frequency", label: "Frequency" },
    { id: "sum-distribution", label: "Sum distribution" },
    { id: "odd-even", label: "Odd / even & low / high" },
    { id: "decade-spread", label: "Decade spread" },
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

export const InsightsScreen = () => {
    usePageTitle("Insights — what the 6/49 era looks like");

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

    if (analysisLoading || drawsLoading) {
        return <div className="py-24 text-center text-sm text-ink-subtle">Loading the analysis artifacts…</div>;
    }

    if (analysisError || drawsError || !analysis || !draws) {
        return (
            <Panel title="Couldn't load the analysis artifacts" description={analysisError?.message ?? drawsError?.message ?? "The JSON files are missing."}>
                <p className="text-sm text-ink-subtle">Run `npm run refresh` to regenerate the data files, then reload.</p>
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
        <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
                <p className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">Learn</p>
                <h1 className="text-xl font-semibold tracking-tight text-ink">Insights</h1>
                <p className="mt-0.5 max-w-2xl text-sm text-ink-subtle">
                    What {formatNumber(total)} draws of 6/49 actually look like — how often each number turned up, how the six added up, and how the draws
                    spread across decades, pairs and weekdays.
                </p>
                <p className="mt-1 max-w-2xl text-xs text-ink-faint">
                    TOTO draws are independent and uniform: every number is equally likely in every draw, so every pattern below is noise, not a signal.
                </p>
            </header>

            <nav aria-label="Insight panels" className="sticky top-13 z-20 -mx-4 border-b border-line bg-canvas px-4 md:-mx-6 md:px-6">
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
                                    "relative shrink-0 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-linear",
                                    active ? "text-accent" : "text-ink-subtle hover:text-ink-muted",
                                )}
                            >
                                {panel.label}
                                {active && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                            </a>
                        );
                    })}
                </div>
            </nav>

            <Panel>
                <SectionHeading
                    id={PANELS[0].id}
                    kicker="Panel 01"
                    title={PANELS[0].label}
                    description={`How many of the ${formatNumber(total)} draws each number from 1 to 49 appeared in.`}
                />
                <FrequencyChart
                    counts={analysis.frequency.all}
                    expected={expectedPerNumber}
                    totalDraws={total}
                    hotNumber={hot?.number}
                    coldNumber={cold?.number}
                    className="mt-4"
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">Hottest</p>
                            <p className="mt-0.5 font-mono text-sm text-accent tabular-nums">Number {hot?.number}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono text-sm text-ink tabular-nums">{formatNumber(hot?.count ?? 0)} draws</p>
                            <p className="text-xs text-ink-faint tabular-nums">{(((hot?.count ?? 0) / total) * 100).toFixed(1)}% of era draws</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                        <div className="min-w-0">
                            <p className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">Coldest</p>
                            <p className="mt-0.5 font-mono text-sm text-ink-muted tabular-nums">Number {cold?.number}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono text-sm text-ink tabular-nums">{formatNumber(cold?.count ?? 0)} draws</p>
                            <p className="text-xs text-ink-faint tabular-nums">{(((cold?.count ?? 0) / total) * 100).toFixed(1)}% of era draws</p>
                        </div>
                    </div>
                </div>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[1].id}
                    kicker="Panel 02"
                    title={PANELS[1].label}
                    description="How often the six winning numbers added up to each total, in bands of ten."
                />
                <SumHistogram bins={sumBins} mean={analysis.sum.mean} median={analysis.sum.median} band={band} totalDraws={total} className="mt-4" />
                <p className="mt-3 text-xs text-ink-subtle">
                    Mean <span className="font-mono text-ink tabular-nums">{analysis.sum.mean.toFixed(1)}</span> · median{" "}
                    <span className="font-mono text-ink tabular-nums">{analysis.sum.median}</span> ·{" "}
                    <span className="font-mono text-ink tabular-nums">{formatNumber(band.count)}</span> of {formatNumber(total)} draws (
                    {Math.round(band.share * 100)}%) landed between {band.lo} and {band.hi}.
                </p>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[2].id}
                    kicker="Panel 03"
                    title={PANELS[2].label}
                    description="How the six numbers split by parity, and by the halfway line at 24."
                />
                <div className="mt-4 grid gap-6 md:grid-cols-2">
                    <div>
                        <p className="text-xs font-medium text-ink-muted">Odd numbers per draw</p>
                        <CountDistributionChart
                            counts={analysis.oddEven}
                            unit="odd numbers"
                            expectedBucket={Math.round(oddExpected)}
                            expectedValue={oddExpected}
                            totalDraws={total}
                            className="mt-2"
                        />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-ink-muted">Low numbers (≤ 24) per draw</p>
                        <CountDistributionChart
                            counts={analysis.lowHigh}
                            unit="low numbers (≤ 24)"
                            expectedBucket={Math.round(lowExpected)}
                            expectedValue={lowExpected}
                            totalDraws={total}
                            className="mt-2"
                        />
                    </div>
                </div>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[3].id}
                    kicker="Panel 04"
                    title={PANELS[3].label}
                    description="Average picks per draw in each decade, year by year, with the all-time average alongside."
                />
                <DecadeHeatmap rows={DECADE_LABELS} columns={decades.years} cells={decades.cells} marginal={analysis.decades} className="mt-4" />
                <p className="mt-3 text-xs text-ink-subtle">
                    The 6/49 era starts on {formatDate(coverage.firstDate)}, so 2014 holds only part of the year. Every decade lands between{" "}
                    <span className="font-mono text-ink tabular-nums">{decadeMin.toFixed(2)}</span> and{" "}
                    <span className="font-mono text-ink tabular-nums">{decadeMax.toFixed(2)}</span> picks per draw — as it must, since the six numbers spread
                    evenly over the five decades.
                </p>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[4].id}
                    kicker="Panel 05"
                    title={PANELS[4].label}
                    description={`The ${pairs.length} number pairs that shared a draw most often across ${formatNumber(total)} draws.`}
                />
                <table className="mt-4 w-full border-collapse text-left">
                    <thead>
                        <tr>
                            <th scope="col" className={cx(th, "static")}>
                                #
                            </th>
                            <th scope="col" className={cx(th, "static")}>
                                Pair
                            </th>
                            <th scope="col" className={cx(thNum, "static")}>
                                Draws together
                            </th>
                            <th scope="col" className={cx(thNum, "static")}>
                                % of era draws
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
                <p className="mt-3 text-xs text-ink-subtle">
                    Any fixed pair should meet in <span className="font-mono text-ink tabular-nums">{expectedPairMeetings.toFixed(1)}</span> of{" "}
                    {formatNumber(total)} draws. The top pair&rsquo;s {pairs[0]?.count ?? 0} is the largest of {formatNumber(PAIRS_IN_POOL)} candidates —
                    picking the maximum of that many always looks impressive.
                </p>
            </Panel>

            <Panel>
                <SectionHeading
                    id={PANELS[5].id}
                    kicker="Panel 06"
                    title={PANELS[5].label}
                    description="How many draws ran on each weekday, with the mean sum of the six numbers above each bar."
                />
                <WeekdayChart days={weekdayDays} className="mt-4" />
                <p className="mt-3 text-xs text-ink-subtle">
                    Draws run Monday and Thursday. The {formatNumber(fridayDraws)} Friday draws are special draws — the eve of Chinese New Year and similar —
                    not a third weekly draw, which is why every other weekday is empty.
                </p>
            </Panel>
        </div>
    );
};
