// toto.sg — the Insights gallery charts.
//
// Every chart here follows the same contract as the older ones in
// toto-charts.tsx: one inline <svg> with a viewBox, so it scales with the
// panel it sits in; per-mark values in a hover tooltip; role="img" plus a
// one-line summary on the wrapper, so a screen reader gets the shape of the
// data in a single stop.
//
// The gallery rule: every chart shows the OBSERVED next to the EXPECTATION
// under a fair cage — a dashed reference line or band. The gamblers get their
// dots and the null, without a paragraph spelling it out under every panel.
import { useMemo, useState } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
import { type AdditionalStats, type CompositionCell, type DeltaStats, type GapStats, type JackpotStats, type MonthStats, type PositionRow, type RepeaterStats, type StreakRow, type SumPoint, type TimelineDraw } from "@/lib/insights-stats";
import { formatNumber } from "@/lib/data";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ *
 * Gap tracker — the volcano
 * ------------------------------------------------------------------ */

interface GapVolcanoProps {
    stats: GapStats;
    className?: string;
}

/**
 * One bar per number showing how many draws it has been missing, with the
 * fair-cage cycle length drawn across them and the overdue zone shaded.
 */
export function GapVolcano({ stats, className }: GapVolcanoProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 270;
    const padLeft = 42;
    const padRight = 14;
    const padTop = 34;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const maxGap = Math.max(stats.dangerGap + 6, ...stats.rows.map((row) => row.gap));
    const yOf = (value: number) => baseline - (value / maxGap) * plotH;
    const slot = plotW / stats.rows.length;
    const barW = Math.max(2, slot - 3);

    const ticks = [0, Math.round(maxGap / 2), maxGap];

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Bar chart of how many draws each number from 1 to 49 has been missing. Expected cycle ${stats.expectedCycle.toFixed(1)} draws; ${stats.overdueCount} numbers are past ${stats.dangerGap} draws.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {/* The overdue zone: three expected cycles and beyond. */}
                <rect x={padLeft} y={padTop} width={plotW} height={Math.max(0, yOf(stats.dangerGap) - padTop)} fill="var(--color-heat-hot)" fillOpacity={0.1} />

                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={padLeft - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                            {tick}
                        </text>
                    </g>
                ))}

                {stats.rows.map((row, index) => {
                    const barHeight = (row.gap / maxGap) * plotH;
                    const overdue = row.gap >= stats.dangerGap;
                    const title = `Number ${row.number}`;
                    const lines = [
                        `${row.gap} draws missing`,
                        `${formatNumber(row.count)} draws seen`,
                        `expected cycle ${stats.expectedCycle.toFixed(1)}`,
                    ];

                    return (
                        <rect
                            key={row.number}
                            x={padLeft + index * slot + (slot - barW) / 2}
                            y={baseline - barHeight}
                            width={barW}
                            height={Math.max(1, barHeight)}
                            rx={1.5}
                            fill={overdue ? "var(--color-heat-hot)" : "var(--color-primary)"}
                            fillOpacity={overdue ? 0.95 : 0.6}
                            onPointerEnter={(event) => show(event, title, lines)}
                            onPointerMove={(event) => show(event, title, lines)}
                            onPointerLeave={hide}
                        />
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {/* The fair-cage cycle length. */}
                <g>
                    <line
                        x1={padLeft}
                        x2={width - padRight}
                        y1={yOf(stats.expectedCycle)}
                        y2={yOf(stats.expectedCycle)}
                        stroke="var(--color-chart-ref)"
                        strokeWidth={1}
                        strokeDasharray="5 4"
                    />
                    <rect x={padLeft + 4} y={yOf(stats.expectedCycle) - 19} width={96} height={16} rx={4} fill="var(--color-surface)" />
                    <text x={padLeft + 10} y={yOf(stats.expectedCycle) - 7} fontSize={11} fill="var(--color-ink-subtle)">
                        expected {stats.expectedCycle.toFixed(1)}
                    </text>
                </g>

                {/* The overdue threshold. */}
                <g>
                    <line
                        x1={padLeft}
                        x2={width - padRight}
                        y1={yOf(stats.dangerGap)}
                        y2={yOf(stats.dangerGap)}
                        stroke="var(--color-heat-hot)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.8}
                    />
                    <text x={width - padRight} y={yOf(stats.dangerGap) - 6} textAnchor="end" fontSize={10} fill="var(--color-heat-hot)">
                        3× expected
                    </text>
                </g>

                {stats.rows.map((row, index) => {
                    if (row.number % 10 !== 0) return null;
                    return (
                        <text
                            key={row.number}
                            x={padLeft + index * slot + slot / 2}
                            y={baseline + 16}
                            textAnchor="middle"
                            fontSize={11}
                            fill="var(--color-ink-subtle)"
                        >
                            {row.number}
                        </text>
                    );
                })}

                {/* The hottest overdue numbers carry their number above the bar. */}
                {stats.hottest.map((row) => {
                    const index = stats.rows.findIndex((entry) => entry.number === row.number);
                    if (index < 0) return null;
                    const x = padLeft + index * slot + slot / 2;
                    const y = yOf(row.gap) - 5;
                    return (
                        <text
                            key={`hot-${row.number}`}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            fontSize={10}
                            fontFamily="var(--font-mono)"
                            fill="var(--color-heat-hot)"
                        >
                            {row.number}
                        </text>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Timeline heat strip
 * ------------------------------------------------------------------ */

interface TimelineStripProps {
    draws: TimelineDraw[];
    className?: string;
}

/**
 * The classic tracking chart: one row per number, one column per draw, with
 * the newest draw on the right. A hit is a filled cell; the additional number
 * is ringed.
 */
export function TimelineStrip({ draws, className }: TimelineStripProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const padLeft = 34;
    const padRight = 8;
    const padTop = 20;
    const padBottom = 24;

    const compact = measured > 0 && measured < 620;
    const gap = compact ? 1 : 2;
    const rowH = compact ? 4.4 : 6.2;

    // The cells grow to fill the panel, but never past a readable width.
    const plotW = width - padLeft - padRight;
    const cell = Math.max(2, Math.min(compact ? 8 : 16, (plotW - Math.max(0, draws.length - 1) * gap) / Math.max(1, draws.length)));

    const gridH = 49 * rowH;
    const height = padTop + gridH + padBottom;

    // Only some draws get a label, so the strip stays readable.
    const labelEvery = Math.max(1, Math.ceil(draws.length / (compact ? 4 : 7)));


    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Tracking grid of the last ${draws.length} draws against all 49 numbers, newest draw on the right.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {draws.map((draw, column) => {
                    if (column % labelEvery !== 0) return null;
                    const x = padLeft + column * (cell + gap);
                    return (
                        <text
                            key={draw.draw}
                            x={x}
                            y={padTop - 8}
                            fontSize={10}
                            fill="var(--color-ink-faint)"
                            fontFamily="var(--font-mono)"
                        >
                            #{draw.draw}
                        </text>
                    );
                })}

                {Array.from({ length: 49 }, (_, index) => index + 1).map((number) => (
                    <text
                        key={number}
                        x={padLeft - 7}
                        y={padTop + (number - 1) * rowH + rowH / 2 + 3}
                        textAnchor="end"
                        fontSize={compact ? 7 : 8}
                        fill="var(--color-ink-faint)"
                        fontFamily="var(--font-mono)"
                    >
                        {number % 5 === 0 ? number : ""}
                    </text>
                ))}

                {draws.map((draw, column) => {
                    const x = padLeft + column * (cell + gap);

                    return (
                        <g key={draw.draw}>
                            {draw.numbers.map((number) => {
                                const y = padTop + (number - 1) * rowH;
                                const isAdditional = draw.additional === number;
                                const title = `Number ${number}`;
                                const lines = [`draw #${draw.draw}`, draw.date, isAdditional ? "additional number" : "winning number"];

                                return (
                                    <rect
                                        key={number}
                                        x={x}
                                        y={y}
                                        width={cell}
                                        height={Math.max(1.5, rowH - 1)}
                                        rx={1}
                                        fill={isAdditional ? "var(--color-surface)" : "var(--color-primary)"}
                                        fillOpacity={isAdditional ? 0 : 0.85}
                                        stroke={isAdditional ? "var(--color-secondary)" : "none"}
                                        strokeWidth={isAdditional ? 1.2 : 0}
                                        onPointerEnter={(event) => show(event, title, lines)}
                                        onPointerMove={(event) => show(event, title, lines)}
                                        onPointerLeave={hide}
                                    />
                                );
                            })}
                        </g>
                    );
                })}

                {/* Date markers along the bottom edge. */}
                {draws.map((draw, column) => {
                    if (column % labelEvery !== 0) return null;
                    const x = padLeft + column * (cell + gap);
                    return (
                        <text
                            key={`date-${draw.draw}`}
                            x={x}
                            y={padTop + gridH + 14}
                            fontSize={9}
                            fill="var(--color-ink-faint)"
                            fontFamily="var(--font-mono)"
                        >
                            {draw.date.slice(2).replace(/-/g, "/")}
                        </text>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Streak ribbons
 * ------------------------------------------------------------------ */

interface StreakRibbonsProps {
    rows: StreakRow[];
    /** Draws covered by the window, for the caption. */
    window: number;
    className?: string;
}

/**
 * One ribbon per number over the recent window, hottest number first. A dot
 * is a hit; the ordering is by hits in the last ten draws, so the hot cluster
 * and the cold cluster separate at a glance.
 */
export function StreakRibbons({ rows, window, className }: StreakRibbonsProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const padLeft = 40;
    const padRight = 10;
    const padTop = 14;
    const padBottom = 18;

    const rowH = 8;
    const gridH = rows.length * rowH;
    const height = padTop + gridH + padBottom;

    const plotW = width - padLeft - padRight;
    const dotR = Math.max(1.6, Math.min(3.2, plotW / rows[0]?.hits.length / 3));

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Hit ribbons for all 49 numbers over the last ${window} draws, ordered by hits in the last ten.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {rows.map((row, index) => {
                    const y = padTop + index * rowH + rowH / 2;
                    const isHot = row.hot >= 3;
                    // Forty-nine rows at eight pixels cannot carry a label on
                    // every row, so every fifth row is named. The rows are
                    // sorted, so the labels walk down the hot-to-cold order.
                    const label = index % 5 === 0;

                    return (
                        <g key={row.number}>
                            {label && (
                                <text
                                    x={padLeft - 7}
                                    y={y + 3}
                                    textAnchor="end"
                                    fontSize={9}
                                    fill={isHot ? "var(--color-ink)" : "var(--color-ink-faint)"}
                                    fontFamily="var(--font-mono)"
                                >
                                    {row.number}
                                </text>
                            )}
                            <line
                                x1={padLeft}
                                x2={width - padRight}
                                y1={y}
                                y2={y}
                                stroke="var(--color-line)"
                                strokeWidth={0.6}
                            />
                            {row.hits.map((hit, index2) => {
                                if (!hit) return null;
                                const x = padLeft + (index2 / Math.max(1, rows[0].hits.length - 1)) * plotW;
                                const title = `Number ${row.number}`;
                                const lines = [`hit in the last ${window} draws`, `${row.hot} in the last 10`, `longest run ${row.longestRun}`];

                                return (
                                    <circle
                                        key={index2}
                                        cx={x}
                                        cy={y}
                                        r={dotR}
                                        fill={isHot ? "var(--color-heat-hot)" : "var(--color-primary)"}
                                        fillOpacity={isHot ? 0.95 : 0.7}
                                        onPointerEnter={(event) => show(event, title, lines)}
                                        onPointerMove={(event) => show(event, title, lines)}
                                        onPointerLeave={hide}
                                    />
                                );
                            })}
                        </g>
                    );
                })}
                <text x={padLeft} y={padTop + gridH + 14} fontSize={10} fill="var(--color-ink-faint)">
                    oldest
                </text>
                <text x={width - padRight} y={padTop + gridH + 14} textAnchor="end" fontSize={10} fill="var(--color-ink-faint)">
                    newest
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Sum trend
 * ------------------------------------------------------------------ */

interface SumTrendProps {
    points: SumPoint[];
    /** The band that holds most draws. */
    band: { lo: number; hi: number };
    /** Era-wide mean sum, drawn as the reference line. */
    mean: number;
    className?: string;
}

/** Rolling mean of the six-number sum across the era, with the modal band. */
export function SumTrend({ points, band, mean, className }: SumTrendProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIndex, setHoverIndex] = useState(-1);

    const width = Math.max(measured, 320);
    // 12px taller so the rolling mean closes level with the sum histogram
    // beside it.
    const height = 252;
    const padLeft = 44;
    const padRight = 14;
    const padTop = 18;
    const padBottom = 28;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const minValue = Math.min(band.lo - 10, ...points.map((point) => point.mean));
    const maxValue = Math.max(band.hi + 10, ...points.map((point) => point.mean));
    const yOf = (value: number) => baseline - ((value - minValue) / (maxValue - minValue)) * plotH;
    const xOf = (index: number) => padLeft + (index / Math.max(1, points.length - 1)) * plotW;

    // Year ticks along the bottom: the first draw of each year.
    const yearTicks = useMemo(() => {
        const ticks: { index: number; year: string }[] = [];
        let last = "";
        points.forEach((point, index) => {
            const year = point.date.slice(0, 4);
            if (year !== last) {
                ticks.push({ index, year });
                last = year;
            }
        });
        return ticks;
    }, [points]);

    const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${xOf(index).toFixed(1)},${yOf(point.mean).toFixed(1)}`).join(" ");

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Rolling 20-draw mean of the six-number sum across ${formatNumber(points.length)} draws. Era mean ${mean.toFixed(1)}.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                <rect x={padLeft} y={yOf(band.hi)} width={plotW} height={Math.max(0, yOf(band.lo) - yOf(band.hi))} fill="var(--color-primary)" fillOpacity={0.1} />

                <g>
                    <line x1={padLeft} x2={width - padRight} y1={yOf(mean)} y2={yOf(mean)} stroke="var(--color-chart-ref)" strokeWidth={1} strokeDasharray="5 4" />
                    <text x={padLeft + 4} y={yOf(mean) - 7} fontSize={11} fill="var(--color-ink-subtle)">
                        era mean {mean.toFixed(1)}
                    </text>
                </g>

                <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />

                {/* The marker on the draw under the pointer. */}
                {hoverIndex >= 0 && points[hoverIndex] && (
                    <circle cx={xOf(hoverIndex)} cy={yOf(points[hoverIndex].mean)} r={3} fill="var(--color-primary)" />
                )}

                {/* One overlay catches the pointer and snaps to the nearest draw —
                    a thousand invisible hit targets would not. */}
                <rect
                    x={padLeft}
                    y={padTop}
                    width={plotW}
                    height={plotH}
                    fill="transparent"
                    onPointerMove={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
                        const index = Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
                        setHoverIndex(index);
                        const point = points[index];
                        show(event, point.date, [`rolling mean ${point.mean.toFixed(1)}`, `draw sum ${point.sum}`]);
                    }}
                    onPointerLeave={() => {
                        setHoverIndex(-1);
                        hide();
                    }}
                />

                {yearTicks.map((tick) => (
                    <text
                        key={tick.year}
                        x={xOf(tick.index)}
                        y={baseline + 16}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--color-ink-faint)"
                        fontFamily="var(--font-mono)"
                    >
                        {tick.year}
                    </text>
                ))}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Composition matrix
 * ------------------------------------------------------------------ */

interface CompositionMatrixProps {
    cells: CompositionCell[];
    className?: string;
}

/**
 * Odd count against high count, one cell per combination. Blue sits below the
 * fair-cage expectation, pink above it, and the intensity is the size of the
 * miss.
 */
export function CompositionMatrix({ cells, className }: CompositionMatrixProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 300);
    const padLeft = 40;
    const padRight = 10;
    const padTop = 22;
    const padBottom = 26;

    const size = Math.min((width - padLeft - padRight) / 7, 46);
    const gridW = size * 7;
    const height = padTop + gridW + padBottom;

    const maxDelta = useMemo(() => {
        const deltas = cells.map((cell) => Math.abs(cell.delta));
        return Math.max(0.5, ...deltas);
    }, [cells]);

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label="Matrix of odd-count against high-count for every draw, compared with the fair-cage expectation."
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {Array.from({ length: 7 }, (_, index) => index).map((index) => (
                    <text
                        key={`x-${index}`}
                        x={padLeft + index * size + size / 2}
                        y={padTop - 8}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--color-ink-faint)"
                    >
                        {index}
                    </text>
                ))}
                {Array.from({ length: 7 }, (_, index) => index).map((index) => (
                    <text
                        key={`y-${index}`}
                        x={padLeft - 8}
                        y={padTop + index * size + size / 2 + 3.5}
                        textAnchor="end"
                        fontSize={10}
                        fill="var(--color-ink-faint)"
                    >
                        {index}
                    </text>
                ))}

                {cells.map((cell) => {
                    const intensity = Math.min(1, Math.abs(cell.delta) / maxDelta);
                    const above = cell.delta > 0;
                    const x = padLeft + cell.high * size;
                    const y = padTop + cell.odd * size;
                    const title = `${cell.odd} odd · ${cell.high} high`;
                    const lines = [
                        `${formatNumber(cell.count)} draws · ${(cell.share * 100).toFixed(1)}%`,
                        `expected ${(cell.expected * 100).toFixed(1)}%`,
                        `${cell.delta >= 0 ? "+" : "−"}${Math.abs(cell.delta).toFixed(1)} points`,
                    ];

                    return (
                        <g key={`${cell.odd}-${cell.high}`}>
                            <rect
                                x={x + 1}
                                y={y + 1}
                                width={size - 2}
                                height={size - 2}
                                rx={2}
                                fill={above ? "var(--color-heat-hot)" : "var(--color-heat-cold)"}
                                fillOpacity={Math.abs(cell.delta) < 0.05 ? 0.05 : 0.15 + intensity * 0.6}
                                stroke={above ? "var(--color-heat-hot)" : "var(--color-heat-cold)"}
                                strokeWidth={Math.abs(cell.delta) < 0.05 ? 0.5 : 0}
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                            {size >= 34 && Math.abs(cell.delta) >= 0.05 && (
                                <text
                                    x={x + size / 2}
                                    y={y + size / 2 + 3.5}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fontFamily="var(--font-mono)"
                                    fill={intensity > 0.55 ? "var(--color-ink)" : "var(--color-ink-subtle)"}
                                    pointerEvents="none"
                                >
                                    {cell.delta >= 0 ? "+" : "−"}
                                    {Math.abs(cell.delta).toFixed(1)}
                                </text>
                            )}
                        </g>
                    );
                })}

                <text x={padLeft} y={padTop + gridW + 18} fontSize={10} fill="var(--color-ink-faint)">
                    high count →
                </text>
                <text x={padLeft - 30} y={padTop - 8} textAnchor="middle" fontSize={10} fill="var(--color-ink-faint)">
                    odd
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Repeaters flow
 * ------------------------------------------------------------------ */

interface RepeatersFlowProps {
    stats: RepeaterStats;
    className?: string;
}

/** How many numbers carried over from the previous draw, against the null. */
export function RepeatersFlow({ stats, className }: RepeatersFlowProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 300);
    const height = 230;
    const padLeft = 44;
    const padRight = 12;
    const padTop = 20;
    const padBottom = 44;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    // The axis is a share of draws, so it runs from 0 to the biggest bucket.
    const peakShare = Math.max(...stats.rows.map((row) => row.share), 0.05);
    const yMax = Math.ceil(peakShare * 20) / 20;
    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const slot = plotW / stats.rows.length;
    const barW = Math.max(4, slot / 2 - 14);

    const ticks = [0, yMax / 2, yMax];

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Bar chart of how many numbers repeated from the previous draw across ${formatNumber(stats.evaluated)} draws, compared with the fair-cage expectation.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={padLeft - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                            {(tick * 100).toFixed(tick * 100 < 10 ? 1 : 0)}%
                        </text>
                    </g>
                ))}

                {stats.rows.map((row, index) => {
                    const x = padLeft + index * slot + (slot - barW) / 2;
                    const barHeight = (row.share / yMax) * plotH;
                    const expectedY = yOf(row.expected);
                    const title = `${row.label} repeated`;
                    const lines = [
                        `${formatNumber(row.count)} draws · ${(row.share * 100).toFixed(1)}%`,
                        `expected ${(row.expected * 100).toFixed(1)}%`,
                    ];

                    return (
                        <g key={row.bucket}>
                            <rect
                                x={x}
                                y={baseline - barHeight}
                                width={barW}
                                height={Math.max(1, barHeight)}
                                rx={1.5}
                                fill="var(--color-primary)"
                                fillOpacity={0.65}
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                            {/* The fair-cage expectation, as a marker on the same axis. */}
                            <line
                                x1={x - 3}
                                x2={x + barW + 3}
                                y1={expectedY}
                                y2={expectedY}
                                stroke="var(--color-chart-ref)"
                                strokeWidth={2}
                                strokeDasharray="4 3"
                            />
                            <text x={x + barW / 2} y={baseline + 16} textAnchor="middle" fontSize={11} fill="var(--color-ink-muted)">
                                {row.label}
                            </text>
                        </g>
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                <text x={padLeft} y={baseline + 34} fontSize={10} fill="var(--color-ink-faint)">
                    solid bar = observed · dashed mark = expected
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Delta profile
 * ------------------------------------------------------------------ */

interface DeltaProfileProps {
    stats: DeltaStats;
    className?: string;
}

/** The gaps between adjacent picks, against the theoretical law. */
export function DeltaProfile({ stats, className }: DeltaProfileProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 230;
    const padLeft = 44;
    const padRight = 12;
    const padTop = 18;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const peak = Math.max(...stats.rows.map((row) => Math.max(row.count, row.expected)), 1);
    const yMax = Math.ceil(peak / 50) * 50;
    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const slot = plotW / stats.rows.length;
    const barW = Math.max(2, slot - 2);

    const ticks = [0, yMax / 2, yMax];

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Histogram of the gap between adjacent picks, observed against the fair-cage law. Mean gap ${stats.observedAverage.toFixed(2)} against ${stats.expectedAverage.toFixed(2)} expected.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={padLeft - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                            {formatNumber(tick)}
                        </text>
                    </g>
                ))}

                {stats.rows.map((row, index) => {
                    const barHeight = (row.count / yMax) * plotH;
                    const expectedY = yOf(row.expected);
                    const title = `Gap of ${row.gap}`;
                    const lines = [`${formatNumber(row.count)} observed`, `${formatNumber(Math.round(row.expected))} expected`];

                    return (
                        <g key={row.gap}>
                            <rect
                                x={padLeft + index * slot}
                                y={baseline - barHeight}
                                width={barW}
                                height={Math.max(1, barHeight)}
                                rx={1}
                                fill="var(--color-primary)"
                                fillOpacity={0.65}
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                            <line
                                x1={padLeft + index * slot}
                                x2={padLeft + index * slot + barW}
                                y1={expectedY}
                                y2={expectedY}
                                stroke="var(--color-chart-ref)"
                                strokeWidth={1.6}
                                strokeDasharray="3 2"
                            />
                        </g>
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {stats.rows.map((row, index) => {
                    if (row.gap % 5 !== 0) return null;
                    return (
                        <text
                            key={row.gap}
                            x={padLeft + index * slot + slot / 2}
                            y={baseline + 16}
                            textAnchor="middle"
                            fontSize={10}
                            fill="var(--color-ink-subtle)"
                        >
                            {row.gap}
                        </text>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Sorted-position ladder
 * ------------------------------------------------------------------ */

interface PositionLadderProps {
    rows: PositionRow[];
    className?: string;
}

/**
 * Where each sorted position lands. The pale band is the fair-cage range
 * (5th to 95th percentile), the solid bar the observed one, and the tick the
 * median.
 */
export function PositionLadder({ rows, className }: PositionLadderProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 240;
    const padLeft = 40;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 28;

    const plotW = width - padLeft - padRight;
    const rowH = (height - padTop - padBottom) / rows.length;
    const xOf = (value: number) => padLeft + ((value - 1) / 48) * plotW;

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label="Range of each sorted position in the draw, observed against the fair-cage order-statistic range."
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {[1, 13, 25, 37, 49].map((tick) => (
                    <g key={tick}>
                        <line x1={xOf(tick)} x2={xOf(tick)} y1={padTop} y2={height - padBottom} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={xOf(tick)} y={height - padBottom + 16} textAnchor="middle" fontSize={10} fill="var(--color-ink-faint)">
                            {tick}
                        </text>
                    </g>
                ))}

                {rows.map((row, index) => {
                    const y = padTop + index * rowH + rowH / 2;
                    const barH = Math.max(6, rowH * 0.42);
                    const title = `Position ${row.position}`;
                    const lines = [
                        `observed ${row.observedLow.toFixed(0)}–${row.observedHigh.toFixed(0)}`,
                        `median ${row.observedMedian.toFixed(0)}`,
                        `expected ${row.expectedLow}–${row.expectedHigh}`,
                    ];

                    return (
                        <g key={row.position}>
                            <text x={padLeft - 8} y={y + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-muted)">
                                {row.position}
                            </text>
                            {/* The fair-cage band. */}
                            <rect
                                x={xOf(row.expectedLow)}
                                y={y - barH / 2 - 4}
                                width={Math.max(2, xOf(row.expectedHigh) - xOf(row.expectedLow))}
                                height={barH + 8}
                                rx={3}
                                fill="var(--color-primary)"
                                fillOpacity={0.14}
                            />
                            {/* The observed band. */}
                            <rect
                                x={xOf(row.observedLow)}
                                y={y - barH / 2}
                                width={Math.max(2, xOf(row.observedHigh) - xOf(row.observedLow))}
                                height={barH}
                                rx={2}
                                fill="var(--color-primary)"
                                fillOpacity={0.75}
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                            {/* Observed median. */}
                            <line
                                x1={xOf(row.observedMedian)}
                                x2={xOf(row.observedMedian)}
                                y1={y - barH / 2 - 2}
                                y2={y + barH / 2 + 2}
                                stroke="var(--color-ink)"
                                strokeWidth={1.6}
                            />
                            {/* The fair-cage median, as a hollow tick. */}
                            <line
                                x1={xOf(row.expectedMedian)}
                                x2={xOf(row.expectedMedian)}
                                y1={y - barH / 2 + 1}
                                y2={y + barH / 2 - 1}
                                stroke="var(--color-chart-ref)"
                                strokeWidth={1.4}
                                strokeDasharray="2 2"
                            />
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Month of year
 * ------------------------------------------------------------------ */

interface MonthHeatmapProps {
    stats: MonthStats;
    className?: string;
}

/** Mean sum by calendar month against the era mean — the December question. */
export function MonthHeatmap({ stats, className }: MonthHeatmapProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const padLeft = 38;
    const padRight = 8;
    const padTop = 20;
    const padBottom = 24;

    const compact = measured > 0 && measured < 620;
    const cellH = compact ? 16 : 22;
    const gap = 2;

    const plotWidth = width - padLeft - padRight;
    // The columns shrink to fit the panel rather than overflow it.
    const cellW = Math.max(8, Math.min(compact ? 26 : 48, (plotWidth - Math.max(0, stats.years.length - 1) * gap) / Math.max(1, stats.years.length)));

    const gridH = 12 * cellH + 11 * gap;

    // The hit-count strip: how many draws each calendar month holds, against
    // the fair share (the game runs twice a week, so months are near-even).
    const stripH = 40;
    const stripTop = padTop + gridH + 40;
    const height = stripTop + stripH + padBottom;

    const countPeak = Math.max(...stats.monthlyMean.map((row) => row.draws), 1);
    const expectedPerMonth = stats.monthlyMean.reduce((sum, row) => sum + row.draws, 0) / 12;

    // Colour scale: how far the month's mean sits from the era mean.
    const spread = Math.max(1, ...stats.monthlyMean.map((row) => Math.abs(row.mean - stats.overallMean)));

    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Mean sum by calendar month and year, against the era mean of ${stats.overallMean.toFixed(1)}.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {stats.years.map((year, column) => {
                    if (compact && column % 2 === 1) return null;
                    return (
                        <text
                            key={year}
                            x={padLeft + column * (cellW + gap) + cellW / 2}
                            y={padTop - 7}
                            textAnchor="middle"
                            fontSize={10}
                            fill="var(--color-ink-faint)"
                            fontFamily="var(--font-mono)"
                        >
                            {year}
                        </text>
                    );
                })}

                {stats.cells.map((row, monthIndex) => (
                    <g key={monthIndex}>
                        <text
                            x={padLeft - 8}
                            y={padTop + monthIndex * (cellH + gap) + cellH / 2 + 3.5}
                            textAnchor="end"
                            fontSize={10}
                            fill="var(--color-ink-muted)"
                        >
                            {MONTH_LABELS[monthIndex]}
                        </text>
                        {row.map((cell, column) => {
                            const x = padLeft + column * (cellW + gap);
                            const y = padTop + monthIndex * (cellH + gap);
                            if (cell.meanSum === null) {
                                return (
                                    <rect
                                        key={cell.year}
                                        x={x}
                                        y={y}
                                        width={cellW}
                                        height={cellH}
                                        rx={2}
                                        fill="var(--color-surface-2)"
                                        onPointerEnter={(event) => show(event, `${MONTH_LABELS[monthIndex]} ${cell.year}`, ["no draws"])}
                                        onPointerMove={(event) => show(event, `${MONTH_LABELS[monthIndex]} ${cell.year}`, ["no draws"])}
                                        onPointerLeave={hide}
                                    />
                                );
                            }

                            const deviation = cell.meanSum - stats.overallMean;
                            const intensity = Math.min(1, Math.abs(deviation) / spread);
                            const above = deviation > 0;
                            const title = `${MONTH_LABELS[monthIndex]} ${cell.year}`;
                            const lines = [
                                `mean sum ${cell.meanSum.toFixed(1)}`,
                                `${cell.draws} draw${cell.draws === 1 ? "" : "s"}`,
                                `era mean ${stats.overallMean.toFixed(1)}`,
                            ];

                            return (
                                <rect
                                    key={cell.year}
                                    x={x}
                                    y={y}
                                    width={cellW}
                                    height={cellH}
                                    rx={2}
                                    fill={above ? "var(--color-heat-hot)" : "var(--color-heat-cold)"}
                                    fillOpacity={0.12 + intensity * 0.6}
                                    onPointerEnter={(event) => show(event, title, lines)}
                                    onPointerMove={(event) => show(event, title, lines)}
                                    onPointerLeave={hide}
                                />
                            );
                        })}
                    </g>
                ))}

                <text x={padLeft} y={padTop + gridH + 16} fontSize={10} fill="var(--color-ink-faint)">
                    cooler than the era mean → warmer
                </text>

                <text x={padLeft} y={stripTop - 8} fontSize={10} fill="var(--color-ink-subtle)">
                    draws per calendar month · expected {Math.round(expectedPerMonth)}
                </text>

                {/* The hit-count strip: draws per calendar month against the even share. */}
                <g>
                    {stats.monthlyMean.map((row, index) => {
                        const slot = plotWidth / 12;
                        const barW = Math.max(4, slot * 0.5);
                        const x = padLeft + index * slot + (slot - barW) / 2;
                        const barHeight = (row.draws / countPeak) * (stripH - 12);
                        const title = `${MONTH_LABELS[index]}`;
                        const lines = [`${formatNumber(row.draws)} draws`, `mean sum ${row.mean.toFixed(1)}`];

                        return (
                            <g key={row.month}>
                                <rect
                                    x={x}
                                    y={stripTop + (stripH - 12) - barHeight}
                                    width={barW}
                                    height={Math.max(1, barHeight)}
                                    rx={1.5}
                                    fill="var(--color-primary)"
                                    fillOpacity={0.6}
                                    onPointerEnter={(event) => show(event, title, lines)}
                                    onPointerMove={(event) => show(event, title, lines)}
                                    onPointerLeave={hide}
                                />
                                <text
                                    x={x + barW / 2}
                                    y={stripTop + stripH + 2}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fill="var(--color-ink-faint)"
                                >
                                    {MONTH_LABELS[index]}
                                </text>
                            </g>
                        );
                    })}

                    <line
                        x1={padLeft}
                        x2={padLeft + plotWidth}
                        y1={stripTop + (stripH - 12) - (expectedPerMonth / countPeak) * (stripH - 12)}
                        y2={stripTop + (stripH - 12) - (expectedPerMonth / countPeak) * (stripH - 12)}
                        stroke="var(--color-chart-ref)"
                        strokeWidth={1}
                        strokeDasharray="5 4"
                    />
                </g>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Additional ball
 * ------------------------------------------------------------------ */

interface AdditionalBallProps {
    stats: AdditionalStats;
    className?: string;
}

/** How often each number came up as the additional ball. */
export function AdditionalBall({ stats, className }: AdditionalBallProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 220;
    const padLeft = 40;
    const padRight = 14;
    const padTop = 20;
    const padBottom = 28;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const peak = Math.max(...stats.counts, 1);
    const yMax = Math.ceil(peak / 5) * 5;
    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const slot = plotW / stats.counts.length;
    const barW = Math.max(2, slot - 3);

    const ticks = [0, yMax / 2, yMax];

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Bar chart of how often each number came up as the additional ball across ${formatNumber(stats.evaluated)} draws, against the expected ${stats.expected.toFixed(1)}.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={padLeft - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                            {tick}
                        </text>
                    </g>
                ))}

                {stats.counts.map((count, index) => {
                    const number = index + 1;
                    const barHeight = (count / yMax) * plotH;
                    const isLatest = stats.latest === number;
                    const title = `Number ${number}`;
                    const lines = [
                        `${formatNumber(count)} times as additional`,
                        `expected ${stats.expected.toFixed(1)}`,
                        isLatest ? "additional in the latest draw" : "",
                    ].filter(Boolean);

                    return (
                        <rect
                            key={number}
                            x={padLeft + index * slot + (slot - barW) / 2}
                            y={baseline - barHeight}
                            width={barW}
                            height={Math.max(1, barHeight)}
                            rx={1.5}
                            fill={isLatest ? "var(--color-secondary)" : "var(--color-primary)"}
                            fillOpacity={isLatest ? 1 : 0.6}
                            onPointerEnter={(event) => show(event, title, lines)}
                            onPointerMove={(event) => show(event, title, lines)}
                            onPointerLeave={hide}
                        />
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                <g>
                    <line
                        x1={padLeft}
                        x2={width - padRight}
                        y1={yOf(stats.expected)}
                        y2={yOf(stats.expected)}
                        stroke="var(--color-chart-ref)"
                        strokeWidth={1}
                        strokeDasharray="5 4"
                    />
                    <rect x={width - padRight - 84} y={yOf(stats.expected) - 19} width={84} height={16} rx={4} fill="var(--color-surface)" />
                    <text x={width - padRight} y={yOf(stats.expected) - 7} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                        expected {stats.expected.toFixed(1)}
                    </text>
                </g>

                {stats.counts.map((_, index) => {
                    const number = index + 1;
                    if (number % 10 !== 0) return null;
                    return (
                        <text
                            key={number}
                            x={padLeft + index * slot + slot / 2}
                            y={baseline + 16}
                            textAnchor="middle"
                            fontSize={10}
                            fill="var(--color-ink-subtle)"
                        >
                            {number}
                        </text>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Jackpot trend
 * ------------------------------------------------------------------ */

interface JackpotTrendProps {
    stats: JackpotStats;
    /**
     * Chart height in pixels. The default suits a half-width panel; a panel
     * that has to close a taller neighbouring column asks for a little more.
     */
    height?: number;
    className?: string;
}

/** Group 1 wins per year, with the biggest jackpot of each year marked. */
export function JackpotTrend({ stats, height = 240, className }: JackpotTrendProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const padLeft = 42;
    const padRight = 14;
    const padTop = 24;
    const padBottom = 34;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const peakWins = Math.max(...stats.years.map((row) => row.wins), 1);
    const yMax = Math.ceil(peakWins / 20) * 20;
    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const slot = plotW / stats.years.length;
    const barW = Math.max(4, slot - 10);

    const ticks = [0, yMax / 2, yMax];

    // The snowball years: the three biggest jackpots, marked on the bar.
    const snowballs = useMemo(
        () =>
            [...stats.years]
                .sort((a, b) => b.max - a.max)
                .slice(0, 3)
                .map((row) => row.year),
        [stats.years],
    );

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Group 1 wins per year across ${stats.years.length} years, with the biggest jackpot of each year marked. ${formatNumber(stats.totalWins)} wins in total.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={padLeft - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                            {tick}
                        </text>
                    </g>
                ))}

                {stats.years.map((row, index) => {
                    const x = padLeft + index * slot + (slot - barW) / 2;
                    const barHeight = (row.wins / yMax) * plotH;
                    const isPeak = row.year === stats.peak.year;
                    const isSnowball = snowballs.includes(row.year);
                    const title = row.year;
                    const lines = [`${formatNumber(row.wins)} Group 1 wins`, `biggest jackpot S$${formatNumber(row.max)}`];

                    return (
                        <g key={row.year}>
                            <rect
                                x={x}
                                y={baseline - barHeight}
                                width={barW}
                                height={Math.max(1, barHeight)}
                                rx={1.5}
                                fill={isSnowball ? "var(--color-gold)" : "var(--color-primary)"}
                                fillOpacity={isSnowball ? 0.55 + (isPeak ? 0.45 : 0.2) : 0.6}
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                            {isSnowball && (
                                <>
                                    <text
                                        x={x + barW / 2}
                                        y={baseline - barHeight - 7}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fill="var(--color-gold-ink)"
                                        pointerEvents="none"
                                    >
                                        S${(row.max / 1_000_000).toFixed(1)}M
                                    </text>
                                    {/* The snowball marker: a gold cap on the bar. */}
                                    <rect
                                        x={x}
                                        y={baseline - barHeight - 3}
                                        width={barW}
                                        height={3}
                                        rx={1.5}
                                        fill="var(--color-gold)"
                                        pointerEvents="none"
                                    />
                                </>
                            )}
                            <text
                                x={x + barW / 2}
                                y={baseline + 15}
                                textAnchor="middle"
                                fontSize={10}
                                fill={isSnowball ? "var(--color-ink-muted)" : "var(--color-ink-faint)"}
                                fontFamily="var(--font-mono)"
                                pointerEvents="none"
                            >
                                {row.year.slice(2)}
                            </text>
                        </g>
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}
