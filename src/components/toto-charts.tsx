// toto.sg — hand-written inline SVG charts for the Insights screen.
//
// No chart library: every chart here is a single <svg> with a viewBox, so it
// scales with the panel it sits in. Per-mark values live in a hover tooltip;
// the wrapper keeps role="img" plus a one-line summary, so a screen reader
// gets the shape of the data in a single stop and the tooltip never has to be
// keyboard-reachable.
import { useMemo } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
import { formatNumber } from "@/lib/data";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ *
 * Frequency
 * ------------------------------------------------------------------ */

interface FrequencyChartProps {
    /** Appearance count per number; index 0 is number 1. */
    counts: number[];
    /** Expected count per number if every draw were uniform. */
    expected: number;
    /** Era draws — the denominator behind the share in the tooltip. */
    totalDraws: number;
    /** Most frequent number, drawn at full strength. */
    hotNumber?: number;
    /** Least frequent number, drawn faint. */
    coldNumber?: number;
    className?: string;
}

/**
 * One bar per number 1–49 with the uniform expectation drawn across them.
 * The hottest and coldest bars carry a different weight so the spread is
 * readable without reading the axes.
 */
export function FrequencyChart({ counts, expected, totalDraws, hotNumber, coldNumber, className }: FrequencyChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 260;
    const padLeft = 46;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 32;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const peak = useMemo(() => Math.max(...counts, 1), [counts]);
    // A multiple of 30 keeps the three gridlines on whole numbers.
    const yMax = Math.ceil(peak / 30) * 30;
    const slot = plotW / counts.length;
    const barW = Math.max(2, slot - 3);

    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const ticks = [0, yMax / 3, (2 * yMax) / 3, yMax];

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Bar chart of how many draws each number from 1 to 49 appeared in, across ${formatNumber(totalDraws)} draws. Expected ${expected.toFixed(1)} per number.`}
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

                {counts.map((count, index) => {
                    const number = index + 1;
                    const barHeight = (count / yMax) * plotH;
                    const title = `Number ${number}`;
                    const lines = [
                        `${formatNumber(count)} draws`,
                        `${((count / totalDraws) * 100).toFixed(1)}% of era draws`,
                        `expected ${expected.toFixed(1)}`,
                    ];

                    return (
                        <rect
                            key={number}
                            x={padLeft + index * slot + (slot - barW) / 2}
                            y={baseline - barHeight}
                            width={barW}
                            height={Math.max(1, barHeight)}
                            rx={1.5}
                            fill="var(--color-primary)"
                            fillOpacity={number === hotNumber ? 1 : number === coldNumber ? 0.3 : 0.55}
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
                        y1={yOf(expected)}
                        y2={yOf(expected)}
                        stroke="var(--color-chart-ref)"
                        strokeWidth={1}
                        strokeDasharray="5 4"
                    />
                    {/* The label sits on a chip of the panel colour so it never
                        reads on top of a bar. */}
                    <rect x={width - padRight - 82} y={yOf(expected) - 21} width={82} height={16} rx={4} fill="var(--color-surface)" />
                    <text x={width - padRight} y={yOf(expected) - 9} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                        expected {expected.toFixed(1)}
                    </text>
                </g>

                {counts.map((_, index) => {
                    const number = index + 1;
                    if (number % 5 !== 0) return null;

                    return (
                        <text
                            key={number}
                            x={padLeft + index * slot + slot / 2}
                            y={baseline + 16}
                            textAnchor="middle"
                            fontSize={11}
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
 * Sum distribution
 * ------------------------------------------------------------------ */

export interface SumBin {
    /** First sum in the bin. */
    lo: number;
    /** Last sum in the bin, inclusive. */
    hi: number;
    count: number;
}

interface SumHistogramProps {
    bins: SumBin[];
    mean: number;
    median: number;
    /** The shaded middle band and the share of draws it holds. */
    band: { lo: number; hi: number; count: number; share: number };
    totalDraws: number;
    className?: string;
}

/**
 * Histogram of the six-number sum on a continuous axis, with the middle band
 * shaded and the mean and median marked.
 */
export function SumHistogram({ bins, mean, median, band, totalDraws, className }: SumHistogramProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 260;
    const padLeft = 46;
    const padRight = 16;
    const padTop = 46;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const xMin = bins.length > 0 ? bins[0].lo : 0;
    const xMax = bins.length > 0 ? bins[bins.length - 1].hi + 1 : 1;
    const xOf = (value: number) => padLeft + ((value - xMin) / (xMax - xMin)) * plotW;

    const peak = useMemo(() => Math.max(...bins.map((bin) => bin.count), 1), [bins]);
    const yMax = Math.ceil(peak / 30) * 30;
    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const ticks = [0, yMax / 3, (2 * yMax) / 3, yMax];

    const xTicks: number[] = [];
    for (let value = Math.ceil(xMin / 20) * 20; value < xMax; value += 20) xTicks.push(value);

    const bandX = xOf(band.lo);
    const bandW = xOf(band.hi + 1) - bandX;

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Histogram of the sum of the six winning numbers across ${formatNumber(totalDraws)} draws. Mean ${mean.toFixed(1)}, median ${median}. The band ${band.lo} to ${band.hi} holds ${Math.round(band.share * 100)}% of draws.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                <rect x={bandX} y={padTop} width={bandW} height={plotH} fill="var(--color-primary)" fillOpacity={0.14} />

                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={1} />
                        <text x={padLeft - 8} y={yOf(tick) + 3.5} textAnchor="end" fontSize={11} fill="var(--color-ink-subtle)">
                            {tick}
                        </text>
                    </g>
                ))}

                {bins.map((bin) => {
                    const barW = Math.max(1, xOf(bin.hi + 1) - xOf(bin.lo) - 2);
                    const barHeight = (bin.count / yMax) * plotH;
                    const title = `Sum ${bin.lo}–${bin.hi}`;
                    const lines = [`${formatNumber(bin.count)} draws`, `${((bin.count / totalDraws) * 100).toFixed(1)}% of era draws`];

                    return (
                        <rect
                            key={bin.lo}
                            x={xOf(bin.lo) + 1}
                            y={baseline - barHeight}
                            width={barW}
                            height={Math.max(1, barHeight)}
                            rx={1.5}
                            fill="var(--color-primary)"
                            fillOpacity={0.6}
                            onPointerEnter={(event) => show(event, title, lines)}
                            onPointerMove={(event) => show(event, title, lines)}
                            onPointerLeave={hide}
                        />
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {xTicks.map((tick) => (
                    <text key={tick} x={xOf(tick)} y={baseline + 16} textAnchor="middle" fontSize={11} fill="var(--color-ink-subtle)">
                        {tick}
                    </text>
                ))}

                <g>
                    <line
                        x1={bandX}
                        x2={bandX}
                        y1={padTop}
                        y2={baseline}
                        stroke="var(--color-primary)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.7}
                    />
                    <line
                        x1={bandX + bandW}
                        x2={bandX + bandW}
                        y1={padTop}
                        y2={baseline}
                        stroke="var(--color-primary)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.7}
                    />
                    <text x={bandX + bandW / 2} y={padTop - 26} textAnchor="middle" fontSize={11} fill="var(--color-primary)">
                        {band.lo}–{band.hi} · {Math.round(band.share * 100)}% of draws
                    </text>
                </g>

                <g>
                    <line x1={xOf(mean)} x2={xOf(mean)} y1={padTop} y2={baseline} stroke="var(--color-ink-muted)" strokeWidth={1} strokeDasharray="4 4" />
                    <text x={xOf(mean) - 5} y={padTop - 8} textAnchor="end" fontSize={11} fill="var(--color-ink-muted)">
                        mean {mean.toFixed(1)}
                    </text>
                </g>

                <g>
                    <line x1={xOf(median)} x2={xOf(median)} y1={padTop} y2={baseline} stroke="var(--color-ink-faint)" strokeWidth={1} strokeDasharray="2 3" />
                    <text x={xOf(median) + 5} y={padTop - 8} textAnchor="start" fontSize={11} fill="var(--color-ink-faint)">
                        median {median}
                    </text>
                </g>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Odd / even and low / high
 * ------------------------------------------------------------------ */

interface CountDistributionChartProps {
    /** Draw count per bucket, 0…6. */
    counts: number[];
    /** What one unit of a bucket means, e.g. "odd numbers". */
    unit: string;
    /** The bucket a uniform draw lands in most often. */
    expectedBucket: number;
    /** Expected count of that unit per draw. */
    expectedValue: number;
    totalDraws: number;
    /** Series colour: the brand violet or the cold end of the data ramp. */
    tone?: "primary" | "secondary";
    className?: string;
}

/** Series colours for the distribution charts. */
const SERIES = { primary: "var(--color-primary)", secondary: "var(--color-secondary)" } as const;

/** Compact distribution over bucket counts 0…6, with the expected bucket marked. */
export function CountDistributionChart({ counts, unit, expectedBucket, expectedValue, totalDraws, tone = "primary", className }: CountDistributionChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const series = SERIES[tone];

    const width = Math.max(measured, 300);
    const height = 220;
    const padLeft = 40;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 54;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const peak = useMemo(() => Math.max(...counts, 1), [counts]);
    const yMax = Math.ceil(peak / 30) * 30;
    const slot = plotW / counts.length;
    const barW = Math.max(2, slot - 12);

    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const ticks = [0, yMax / 3, (2 * yMax) / 3, yMax];

    const peakBucket = counts.indexOf(Math.max(...counts));

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Bar chart of how many draws had zero to six ${unit}. Most common: ${peakBucket}, in ${formatNumber(counts[peakBucket])} draws.`}
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

                {counts.map((count, index) => {
                    const barHeight = (count / yMax) * plotH;
                    const title = `${index} ${unit}`;
                    const lines = [`${formatNumber(count)} draws`, `${((count / totalDraws) * 100).toFixed(1)}% of era draws`];

                    return (
                        <rect
                            key={index}
                            x={padLeft + index * slot + (slot - barW) / 2}
                            y={baseline - barHeight}
                            width={barW}
                            height={Math.max(1, barHeight)}
                            rx={1.5}
                            fill={series}
                            fillOpacity={index === expectedBucket ? 0.95 : 0.5}
                            onPointerEnter={(event) => show(event, title, lines)}
                            onPointerMove={(event) => show(event, title, lines)}
                            onPointerLeave={hide}
                        />
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {counts.map((_, index) => (
                    <text
                        key={index}
                        x={padLeft + index * slot + slot / 2}
                        y={baseline + 16}
                        textAnchor="middle"
                        fontSize={11}
                        fill={index === expectedBucket ? series : "var(--color-ink-subtle)"}
                    >
                        {index}
                    </text>
                ))}

                <g>
                    <line
                        x1={padLeft + expectedBucket * slot + slot / 2}
                        x2={padLeft + expectedBucket * slot + slot / 2}
                        y1={baseline}
                        y2={baseline + 5}
                        stroke={series}
                        strokeWidth={1}
                    />
                    <text x={padLeft + expectedBucket * slot + slot / 2} y={baseline + 28} textAnchor="middle" fontSize={9} fill={series}>
                        expected
                    </text>
                </g>

                <text x={padLeft} y={baseline + 42} fontSize={11} fill="var(--color-ink-subtle)">
                    {unit} per draw · expected {expectedValue.toFixed(2)}
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Decade heatmap
 * ------------------------------------------------------------------ */

export interface HeatmapCell {
    /** Average picks per draw in this cell, or null when the cell has no draws. */
    value: number | null;
    /** Draws behind the average. */
    draws: number;
}

interface DecadeHeatmapProps {
    /** Row labels, top to bottom. */
    rows: string[];
    /** Column labels, left to right. */
    columns: number[];
    /** Cells[row][column]. */
    cells: HeatmapCell[][];
    /** All-time marginal per row, drawn as a column beside the strip. */
    marginal?: number[];
    className?: string;
}

/** Sequential console ramp from the observed minimum to the observed maximum. */
const RAMP = ["var(--color-ramp-1)", "var(--color-ramp-2)", "var(--color-ramp-3)", "var(--color-ramp-4)", "var(--color-ramp-5)", "var(--color-ramp-6)"];

/**
 * Decade-by-year heat strip. Each cell is the average picks per draw in that
 * decade and year, coloured between the observed minimum and maximum.
 */
export function DecadeHeatmap({ rows, columns, cells, marginal, className }: DecadeHeatmapProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    // Thirteen year columns do not fit a phone: the strip drops to narrow
    // cells, every other year label and no marginal column.
    const compact = measured > 0 && measured < 620;
    const cellW = compact ? 22 : 56;
    const cellH = compact ? 24 : 32;
    const gap = compact ? 2 : 3;
    const padLeft = compact ? 42 : 54;
    const padTop = 22;
    const padBottom = 6;
    const marginalW = marginal && !compact ? 46 : 0;
    const marginalGap = marginal && !compact ? 14 : 0;

    const gridW = columns.length * cellW + Math.max(0, columns.length - 1) * gap;
    const gridH = rows.length * cellH + Math.max(0, rows.length - 1) * gap;

    const width = padLeft + gridW + marginalGap + marginalW;
    const height = padTop + gridH + padBottom;

    const { min, max } = useMemo(() => {
        const values = cells.flatMap((row) => row.map((cell) => cell.value)).filter((value): value is number => value !== null);
        if (values.length === 0) return { min: 0, max: 0 };
        return { min: Math.min(...values), max: Math.max(...values) };
    }, [cells]);

    const stepOf = (value: number) => {
        if (max <= min) return RAMP.length - 1;
        const step = Math.round(((value - min) / (max - min)) * (RAMP.length - 1));
        return Math.min(RAMP.length - 1, Math.max(0, step));
    };

    const colourOf = (value: number | null) => {
        if (value === null) return "var(--color-surface-2)";
        return RAMP[stepOf(value)];
    };

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Heatmap of average picks per draw by decade and year, ${columns[0]} to ${columns[columns.length - 1]}. Values run from ${min.toFixed(2)} to ${max.toFixed(2)} picks per draw.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {columns.map((column, columnIndex) => {
                    if (compact && columnIndex % 2 === 1) return null;

                    return (
                        <text
                            key={column}
                            x={padLeft + columnIndex * (cellW + gap) + cellW / 2}
                            y={padTop - 8}
                            textAnchor="middle"
                            fontSize={compact ? 9 : 10}
                            fill="var(--color-ink-faint)"
                        >
                            {column}
                        </text>
                    );
                })}

                {rows.map((row, rowIndex) => (
                    <text
                        key={row}
                        x={padLeft - 10}
                        y={padTop + rowIndex * (cellH + gap) + cellH / 2 + 4}
                        textAnchor="end"
                        fontSize={compact ? 10 : 11}
                        fill="var(--color-ink-muted)"
                    >
                        {row}
                    </text>
                ))}

                {rows.map((row, rowIndex) =>
                    columns.map((column, columnIndex) => {
                        const cell = cells[rowIndex]?.[columnIndex];
                        const title = `${column} · ${row}`;
                        const lines =
                            cell && cell.value !== null ? [`${cell.value.toFixed(2)} picks per draw`, `${formatNumber(cell.draws)} draws`] : ["no draws"];

                        const x = padLeft + columnIndex * (cellW + gap);
                        const y = padTop + rowIndex * (cellH + gap);
                        const step = cell?.value != null ? stepOf(cell.value) : 0;

                        return (
                            <g key={`${row}-${column}`}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={cellW}
                                    height={cellH}
                                    rx={2}
                                    fill={colourOf(cell?.value ?? null)}
                                    onPointerEnter={(event) => show(event, title, lines)}
                                    onPointerMove={(event) => show(event, title, lines)}
                                    onPointerLeave={hide}
                                />
                                {!compact && cell?.value != null && (
                                    <text
                                        x={x + cellW / 2}
                                        y={y + cellH / 2 + 3.5}
                                        textAnchor="middle"
                                        fontSize={10}
                                        fontFamily="var(--font-mono)"
                                        fill={step >= 5 ? "light-dark(var(--color-ink), #04121a)" : "light-dark(var(--color-ink), #ffffff)"}
                                        pointerEvents="none"
                                    >
                                        {cell.value.toFixed(2)}
                                    </text>
                                )}
                            </g>
                        );
                    }),
                )}

                {marginal && !compact && (
                    <g>
                        <line
                            x1={padLeft + gridW + marginalGap / 2}
                            x2={padLeft + gridW + marginalGap / 2}
                            y1={padTop - 4}
                            y2={padTop + gridH}
                            stroke="var(--color-line)"
                            strokeWidth={1}
                        />
                        <text x={padLeft + gridW + marginalGap} y={padTop - 8} fontSize={11} fill="var(--color-ink-subtle)">
                            All-time
                        </text>
                        {rows.map((row, rowIndex) => {
                            const marginalValue = marginal?.[rowIndex];

                            return (
                                <text
                                    key={`marginal-${row}`}
                                    x={padLeft + gridW + marginalGap}
                                    y={padTop + rowIndex * (cellH + gap) + cellH / 2 + 4}
                                    fontSize={11}
                                    fill="var(--color-ink-muted)"
                                    fontFamily="var(--font-mono)"
                                >
                                    {marginalValue !== undefined ? marginalValue.toFixed(2) : "—"}
                                </text>
                            );
                        })}
                    </g>
                )}
            </svg>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                <span className="font-mono tabular-nums">{min.toFixed(2)}</span>
                <span className="flex gap-px">
                    {RAMP.map((colour) => (
                        <span key={colour} className="h-2 w-4 rounded-[1px]" style={{ backgroundColor: colour }} />
                    ))}
                </span>
                <span className="font-mono tabular-nums">{max.toFixed(2)}</span>
                <span>average picks per draw</span>
            </div>

            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Weekday
 * ------------------------------------------------------------------ */

export interface WeekdayDatum {
    label: string;
    count: number;
    meanSum: number;
}

interface WeekdayChartProps {
    /** Every weekday, in display order — days without draws get a flat track. */
    days: WeekdayDatum[];
    className?: string;
}

/** Draws per weekday, with the mean sum printed above each bar that has one. */
export function WeekdayChart({ days, className }: WeekdayChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 300);
    const height = 240;
    const padLeft = 46;
    const padRight = 12;
    const padTop = 26;
    const padBottom = 32;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const peak = useMemo(() => Math.max(...days.map((day) => day.count), 1), [days]);
    const yMax = Math.ceil(peak / 30) * 30;
    const slot = plotW / days.length;
    const barW = Math.max(2, slot - 16);

    const yOf = (value: number) => baseline - (value / yMax) * plotH;
    const ticks = [0, yMax / 3, (2 * yMax) / 3, yMax];

    const drawn = days.filter((day) => day.count > 0);

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Bar chart of draws per weekday. ${drawn.map((day) => `${day.label} ${day.count}`).join(", ")}. No draws on the other weekdays.`}
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

                {days.map((day, index) => {
                    const x = padLeft + index * slot + (slot - barW) / 2;
                    const title = day.label;
                    const lines = day.count > 0 ? [`${formatNumber(day.count)} draws`, `mean sum ${day.meanSum.toFixed(1)}`] : ["no draws"];

                    if (day.count === 0) {
                        return (
                            <rect
                                key={day.label}
                                x={x}
                                y={baseline - 2}
                                width={barW}
                                height={2}
                                rx={1}
                                fill="var(--color-surface-3)"
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                        );
                    }

                    const barHeight = (day.count / yMax) * plotH;

                    return (
                        <g key={day.label}>
                            <text x={x + barW / 2} y={baseline - barHeight - 7} textAnchor="middle" fontSize={11} fill="var(--color-ink-subtle)">
                                {day.meanSum.toFixed(1)}
                            </text>
                            <rect
                                x={x}
                                y={baseline - barHeight}
                                width={barW}
                                height={barHeight}
                                rx={1.5}
                                fill="var(--color-primary)"
                                fillOpacity={0.7}
                                onPointerEnter={(event) => show(event, title, lines)}
                                onPointerMove={(event) => show(event, title, lines)}
                                onPointerLeave={hide}
                            />
                        </g>
                    );
                })}

                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {days.map((day, index) => (
                    <text
                        key={day.label}
                        x={padLeft + index * slot + slot / 2}
                        y={baseline + 17}
                        textAnchor="middle"
                        fontSize={11}
                        fill={day.count > 0 ? "var(--color-ink-muted)" : "var(--color-ink-faint)"}
                    >
                        {day.label}
                    </text>
                ))}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}
