// toto.sg — visualizations for the two deep sequence galleries.
//
// Six responsive inline-SVG charts, all built the same way the site's other
// charts are: a viewBox sized to the measured host width, a pointer-driven
// tooltip through useChartTooltip(), role="img" plus an aria-label summary,
// and the semantic theme tokens only.
//
//   ConstellationMstBoardChart   the 7x7 playslip lattice with the latest
//                                 draw's MST and the live candidate overlay
//   CurvatureProfileChart        slot deltas and second-difference curvature
//                                 against the archive's IQR bands
//   PeriodogramSpectrumChart     the DFT spectrum with Fisher's threshold
//   RecurrenceMatrixPlot         the 180x180 state-space recurrence plot
//   UnionPartitionCurveChart     the recycled union vs. the fresh cold pool
//   OrdinalMotifBarChart         the six Bandt-Pompe ordinal motifs
import { useState } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ *
 * 1. Constellation MST board — the 7x7 playslip lattice
 * ------------------------------------------------------------------ */

export interface ConstellationPoint {
    ball: number;
    row: number;
    col: number;
}

export interface ConstellationMstBoardChartProps {
    /** The latest draw's six balls, as lattice points. */
    points: ConstellationPoint[];
    /** The Euclidean MST edges between the points, as point-index pairs. */
    edges: [number, number][];
    /** The barycentre of the points. */
    baryRow: number;
    baryCol: number;
    /** The live candidate's points, overlaid in gold. */
    candidatePoints?: ConstellationPoint[];
    className?: string;
    ariaLabel?: string;
}

export function ConstellationMstBoardChart({
    points,
    edges,
    baryRow,
    baryCol,
    candidatePoints,
    className,
    ariaLabel = "Playslip constellation: the latest draw's balls on the 7x7 grid with its minimum spanning tree",
}: ConstellationMstBoardChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverBall, setHoverBall] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = Math.max(260, Math.min(420, width * 0.72));
    const padLeft = 26;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 22;

    const grid = 7;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const cell = Math.min(plotW, plotH) / grid;
    const boardLeft = padLeft + (plotW - cell * grid) / 2;
    const boardTop = padTop + (plotH - cell * grid) / 2;

    const xOf = (col: number) => boardLeft + (col - 1) * cell + cell / 2;
    const yOf = (row: number) => boardTop + (row - 1) * cell + cell / 2;

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
                {/* The 7x7 lattice */}
                {Array.from({ length: grid }, (_, i) => (
                    <g key={`grid-${i}`}>
                        <line
                            x1={boardLeft + i * cell}
                            y1={boardTop}
                            x2={boardLeft + i * cell}
                            y2={boardTop + grid * cell}
                            stroke="var(--color-line)"
                            strokeWidth={1}
                            strokeOpacity={0.5}
                        />
                        <line
                            x1={boardLeft}
                            y1={boardTop + i * cell}
                            x2={boardLeft + grid * cell}
                            y2={boardTop + i * cell}
                            stroke="var(--color-line)"
                            strokeWidth={1}
                            strokeOpacity={0.5}
                        />
                    </g>
                ))}
                <rect
                    x={boardLeft}
                    y={boardTop}
                    width={grid * cell}
                    height={grid * cell}
                    fill="none"
                    stroke="var(--color-line-strong)"
                    strokeWidth={1}
                />

                {/* The MST edges of the latest draw */}
                {edges.map(([a, b]) => {
                    const from = points[a];
                    const to = points[b];
                    if (!from || !to) return null;
                    return (
                        <line
                            key={`edge-${a}-${b}`}
                            x1={xOf(from.col)}
                            y1={yOf(from.row)}
                            x2={xOf(to.col)}
                            y2={yOf(to.row)}
                            stroke="var(--color-primary)"
                            strokeWidth={1.5}
                            strokeOpacity={0.75}
                        />
                    );
                })}

                {/* The barycentre crosshair */}
                <g stroke="var(--color-gold)" strokeWidth={1} strokeOpacity={0.9}>
                    <line x1={xOf(baryCol) - 7} y1={yOf(baryRow)} x2={xOf(baryCol) + 7} y2={yOf(baryRow)} />
                    <line x1={xOf(baryCol)} y1={yOf(baryRow) - 7} x2={xOf(baryCol)} y2={yOf(baryRow) + 7} />
                </g>

                {/* The candidate's overlay */}
                {(candidatePoints ?? []).map((point) => (
                    <rect
                        key={`cand-${point.ball}`}
                        x={xOf(point.col) - cell * 0.3}
                        y={yOf(point.row) - cell * 0.3}
                        width={cell * 0.6}
                        height={cell * 0.6}
                        rx={2}
                        fill="none"
                        stroke="var(--color-secondary)"
                        strokeWidth={1.5}
                        strokeOpacity={0.9}
                    />
                ))}

                {/* The latest draw's balls */}
                {points.map((point) => {
                    const isHovered = hoverBall === point.ball;
                    return (
                        <g
                            key={point.ball}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverBall(point.ball);
                                show(e, `Ball ${point.ball}`, [
                                    `Cell: row ${point.row}, col ${point.col}`,
                                    `Barycentre: (${baryRow.toFixed(2)}, ${baryCol.toFixed(2)})`,
                                ]);
                            }}
                            onPointerLeave={() => {
                                setHoverBall(null);
                                hide();
                            }}
                        >
                            <circle
                                cx={xOf(point.col)}
                                cy={yOf(point.row)}
                                r={cell * (isHovered ? 0.34 : 0.28)}
                                fill={isHovered ? "var(--color-gold)" : "var(--color-primary)"}
                            />
                            <text
                                x={xOf(point.col)}
                                y={yOf(point.row) + 3.5}
                                textAnchor="middle"
                                fontSize={Math.max(8, cell * 0.26)}
                                fontFamily="var(--font-mono)"
                                fill="var(--color-canvas)"
                                fontWeight={700}
                            >
                                {point.ball}
                            </text>
                        </g>
                    );
                })}

                <text
                    x={padLeft}
                    y={height - 6}
                    fontSize={9}
                    fontFamily="var(--font-mono)"
                    fill="var(--color-ink-subtle)"
                >
                    row-major playslip · barycentre ({baryRow.toFixed(2)}, {baryCol.toFixed(2)})
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 2. Curvature profile — slot deltas and second differences
 * ------------------------------------------------------------------ */

export interface CurvatureProfileChartProps {
    /** The archive's median slot delta, Delta_1..Delta_5. */
    gapMedian: number[];
    /** The archive's IQR bounds for the slot deltas. */
    gapP25: number[];
    gapP75: number[];
    /** The archive's median second difference, Delta^2_1..Delta^2_4. */
    secondMedian: number[];
    secondP25: number[];
    secondP75: number[];
    /** The live candidate's five slot deltas. */
    candidateDeltas?: number[];
    /** The live candidate's four second differences. */
    candidateSecondDiffs?: number[];
    className?: string;
    ariaLabel?: string;
}

export function CurvatureProfileChart({
    gapMedian,
    gapP25,
    gapP75,
    secondMedian,
    secondP25,
    secondP75,
    candidateDeltas,
    candidateSecondDiffs,
    className,
    ariaLabel = "Gap curvature profile: slot deltas and second differences against the archive interquartile bands",
}: CurvatureProfileChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 210;
    const padLeft = 38;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 24;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const bandH = plotH / 2 - 12;

    const allValues = [
        ...gapP25,
        ...gapP75,
        ...secondP25,
        ...secondP75,
        ...(candidateDeltas ?? []),
        ...(candidateSecondDiffs ?? []),
    ];
    const maxAbs = Math.max(4, ...allValues.map((v) => Math.abs(v)));
    const scale = (v: number, bandTop: number) => bandTop + bandH * (0.5 - (v / (2 * maxAbs)));

    const gapTop = padTop;
    const secondTop = padTop + bandH + 24;

    const step = plotW / Math.max(1, gapMedian.length);
    const secondStep = plotW / Math.max(1, secondMedian.length);

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
                {/* The upper band: slot deltas */}
                {gapMedian.map((median, i) => {
                    const x = padLeft + i * step + step / 2;
                    const y = scale(median, gapTop);
                    const top = scale(gapP75[i], gapTop);
                    const bottom = scale(gapP25[i], gapTop);
                    const isHovered = hoverIdx === i;
                    return (
                        <g
                            key={`gap-${i}`}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverIdx(i);
                                show(e, `Slot delta ${i + 1}`, [
                                    `Archive median: ${median}`,
                                    `Archive IQR: ${gapP25[i]} – ${gapP75[i]}`,
                                    candidateDeltas?.[i] !== undefined ? `Candidate: ${candidateDeltas[i]}` : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverIdx(null);
                                hide();
                            }}
                        >
                            <rect
                                x={x - step * 0.28}
                                y={Math.min(top, bottom)}
                                width={step * 0.56}
                                height={Math.abs(bottom - top)}
                                fill="var(--color-primary)"
                                fillOpacity={0.12}
                                rx={2}
                            />
                            <line
                                x1={x}
                                y1={y}
                                x2={x}
                                y2={y}
                                stroke="var(--color-primary)"
                                strokeWidth={isHovered ? 3 : 2}
                            />
                            <circle cx={x} cy={y} r={isHovered ? 4 : 2.5} fill="var(--color-primary)" />
                            <text
                                x={x}
                                y={gapTop - 5}
                                textAnchor="middle"
                                fontSize={8.5}
                                fontFamily="var(--font-mono)"
                                fill="var(--color-ink-subtle)"
                            >
                                Δ{i + 1}
                            </text>
                        </g>
                    );
                })}

                {/* The lower band: second differences */}
                {secondMedian.map((median, i) => {
                    const x = padLeft + i * secondStep + secondStep / 2;
                    const y = scale(median, secondTop);
                    const top = scale(secondP75[i], secondTop);
                    const bottom = scale(secondP25[i], secondTop);
                    const isHovered = hoverIdx === 100 + i;
                    return (
                        <g
                            key={`second-${i}`}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverIdx(100 + i);
                                show(e, `Second difference ${i + 1}`, [
                                    `Archive median: ${median}`,
                                    `Archive IQR: ${secondP25[i]} – ${secondP75[i]}`,
                                    candidateSecondDiffs?.[i] !== undefined ? `Candidate: ${candidateSecondDiffs[i]}` : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverIdx(null);
                                hide();
                            }}
                        >
                            <rect
                                x={x - secondStep * 0.28}
                                y={Math.min(top, bottom)}
                                width={secondStep * 0.56}
                                height={Math.abs(bottom - top)}
                                fill="var(--color-secondary)"
                                fillOpacity={0.12}
                                rx={2}
                            />
                            <line x1={x} y1={y} x2={x} y2={y} stroke="var(--color-secondary)" strokeWidth={isHovered ? 3 : 2} />
                            <circle cx={x} cy={y} r={isHovered ? 4 : 2.5} fill="var(--color-secondary)" />
                            <text
                                x={x}
                                y={secondTop - 5}
                                textAnchor="middle"
                                fontSize={8.5}
                                fontFamily="var(--font-mono)"
                                fill="var(--color-ink-subtle)"
                            >
                                Δ²{i + 1}
                            </text>
                        </g>
                    );
                })}

                {/* The candidate's profile */}
                {(candidateDeltas ?? []).map((value, i) => (
                    <circle
                        key={`cand-gap-${i}`}
                        cx={padLeft + i * step + step / 2}
                        cy={scale(value, gapTop)}
                        r={3}
                        fill="var(--color-gold)"
                        stroke="var(--color-canvas)"
                        strokeWidth={1}
                    />
                ))}
                {(candidateSecondDiffs ?? []).map((value, i) => (
                    <circle
                        key={`cand-second-${i}`}
                        cx={padLeft + i * secondStep + secondStep / 2}
                        cy={scale(value, secondTop)}
                        r={3}
                        fill="var(--color-gold)"
                        stroke="var(--color-canvas)"
                        strokeWidth={1}
                    />
                ))}

                {/* The zero lines */}
                <line
                    x1={padLeft}
                    y1={scale(0, gapTop)}
                    x2={padLeft + plotW}
                    y2={scale(0, gapTop)}
                    stroke="var(--color-line-strong)"
                    strokeWidth={1}
                />
                <line
                    x1={padLeft}
                    y1={scale(0, secondTop)}
                    x2={padLeft + plotW}
                    y2={scale(0, secondTop)}
                    stroke="var(--color-line-strong)"
                    strokeWidth={1}
                />

                <text x={padLeft - 6} y={gapTop + 4} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-primary)">
                    Δ
                </text>
                <text x={padLeft - 6} y={secondTop + 4} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-secondary)">
                    Δ²
                </text>
                <text x={padLeft + plotW} y={height - 6} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    archive IQR bands · gold = live candidate
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 3. Periodogram spectrum with Fisher's threshold
 * ------------------------------------------------------------------ */

export interface PeriodogramSpectrumChartProps {
    /** The spectrum, ordered by period. */
    spectrum: { period: number; power: number }[];
    /** Fisher's observed g — the dominant ordinate over the mean ordinate. */
    g: number;
    /** Fisher's g critical value at p = 0.05. */
    gThreshold: number;
    /**
     * The power level a dominant ordinate has to clear to be significant —
     * the g threshold expressed back on the power axis.
     */
    significancePower: number;
    /** The dominant cycle length. */
    dominantPeriod: number;
    /** Fisher's p-value under the white-noise null. */
    pValue: number;
    className?: string;
    ariaLabel?: string;
}

export function PeriodogramSpectrumChart({
    spectrum,
    g,
    gThreshold,
    significancePower,
    dominantPeriod,
    pValue,
    className,
    ariaLabel = "DFT periodogram of the draw sums with Fisher's significance threshold",
}: PeriodogramSpectrumChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 200;
    const padLeft = 40;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Only the short cycles matter for the chart; the tail is flat noise.
    // The spectrum arrives in DECREASING period order (the bin index runs
    // against the cycle length), so the visible window is sorted back into
    // ascending period before it is scaled.
    const maxPeriod = 60;
    const visible = spectrum.filter((point) => point.period <= maxPeriod).sort((a, b) => a.period - b.period);
    const points = visible.length > 0 ? visible : [...spectrum].sort((a, b) => a.period - b.period).slice(0, 60);

    // The threshold has to fit on the axis, or the line it marks never shows.
    const maxPower = Math.max(1e-9, ...points.map((point) => point.power), significancePower > 0 ? significancePower : 0);
    const axisMax = points.length > 0 ? points[points.length - 1].period : maxPeriod;
    const xOf = (period: number) => padLeft + (period / Math.max(1, axisMax)) * plotW;
    const yOf = (power: number) => padTop + plotH * (1 - power / maxPower);

    const line = points.map((point, i) => `${i === 0 ? "M" : "L"}${xOf(point.period).toFixed(1)},${yOf(point.power).toFixed(1)}`).join(" ");

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
                <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
                <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />

                {/* The spectrum */}
                <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth={1.6} />

                {points.map((point, i) => (
                    <g
                        key={`p-${i}`}
                        className="cursor-pointer"
                        onPointerEnter={(e) => {
                            setHoverIdx(i);
                            show(e, `Period ${point.period.toFixed(1)} draws`, [
                                `Power: ${point.power.toFixed(3)}`,
                                `Fisher g: ${g.toFixed(2)} (threshold ${gThreshold.toFixed(2)})`,
                                `White-noise p: ${pValue < 0.001 ? "<0.001" : pValue.toFixed(4)}`,
                            ]);
                        }}
                        onPointerLeave={() => {
                            setHoverIdx(null);
                            hide();
                        }}
                    >
                        <circle
                            cx={xOf(point.period)}
                            cy={yOf(point.power)}
                            r={hoverIdx === i ? 3.5 : 2}
                            fill={hoverIdx === i ? "var(--color-gold)" : "var(--color-primary)"}
                        />
                    </g>
                ))}

                {/* The dominant cycle */}
                <line
                    x1={xOf(dominantPeriod)}
                    y1={padTop}
                    x2={xOf(dominantPeriod)}
                    y2={padTop + plotH}
                    stroke="var(--color-gold)"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                />
                <text
                    x={xOf(dominantPeriod)}
                    y={padTop - 4}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontFamily="var(--font-mono)"
                    fill="var(--color-gold)"
                >
                    P* {dominantPeriod.toFixed(1)}
                </text>

                {/* Fisher's significance threshold, expressed on the power axis */}
                {significancePower > 0 && significancePower <= maxPower && (
                    <>
                        <line
                            x1={padLeft}
                            y1={yOf(significancePower)}
                            x2={padLeft + plotW}
                            y2={yOf(significancePower)}
                            stroke="var(--color-heat-hot)"
                            strokeWidth={1}
                            strokeDasharray="5 4"
                            strokeOpacity={0.85}
                        />
                        <text
                            x={padLeft + plotW}
                            y={yOf(significancePower) + 11}
                            textAnchor="end"
                            fontSize={8.5}
                            fontFamily="var(--font-mono)"
                            fill="var(--color-heat-hot)"
                        >
                            p = 0.05 threshold
                        </text>
                    </>
                )}

                <text x={padLeft - 6} y={padTop + 4} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    {maxPower.toFixed(1)}
                </text>
                <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    0
                </text>
                {[2, 10, 20, 30, 40, 60].map((tick) => (
                    <text
                        key={tick}
                        x={xOf(tick)}
                        y={height - 8}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontFamily="var(--font-mono)"
                        fill="var(--color-ink-subtle)"
                    >
                        {tick}
                    </text>
                ))}
                <text x={padLeft + plotW} y={padTop - 4} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-faint)">
                    cycle length (draws)
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 4. Recurrence matrix plot
 * ------------------------------------------------------------------ */

export interface RecurrenceMatrixPlotProps {
    /** The recurrence matrix, row-major, side x side. */
    matrix: Uint8Array;
    /** The matrix side length. */
    size: number;
    className?: string;
    ariaLabel?: string;
}

export function RecurrenceMatrixPlot({
    matrix,
    size,
    className,
    ariaLabel = "State-space recurrence plot of the trailing draws",
}: RecurrenceMatrixPlotProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const side = Math.min(width - 44, 380);
    const height = side + 34;
    const padLeft = 34;
    const padTop = 10;

    const cell = side / Math.max(1, size);

    // A diagonal run of two or more is a deterministic trajectory; an
    // isolated point is a plain pair-overlap recurrence.
    const runLength = (i: number, j: number): number => {
        let length = 1;
        for (let step = 1; step < size; step += 1) {
            const a = i + step;
            const b = j + step;
            if (a >= size || b >= size) break;
            if (matrix[a * size + b] !== 1) break;
            length += 1;
        }
        return length;
    };

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
                <rect x={padLeft} y={padTop} width={side} height={side} fill="var(--color-surface-2)" />

                {Array.from({ length: size }, (_, i) => (
                    <g key={`cell-${i}`}>
                        {Array.from({ length: size }, (_, j) => {
                            if (matrix[i * size + j] !== 1) return null;
                            const length = runLength(i, j);
                            const isDeterministic = length >= 2;
                            const color = isDeterministic ? "var(--color-gold)" : "var(--color-secondary)";
                            const opacity = isDeterministic ? 0.55 + Math.min(0.4, length * 0.08) : 0.45;
                            return (
                                <rect
                                    key={`dot-${i}-${j}`}
                                    x={padLeft + j * cell}
                                    y={padTop + i * cell}
                                    width={Math.max(0.7, cell)}
                                    height={Math.max(0.7, cell)}
                                    fill={color}
                                    fillOpacity={opacity}
                                    className="cursor-pointer"
                                    onPointerEnter={(e) =>
                                        show(e, `Recurrence ${i + 1} → ${j + 1}`, [
                                            `Shared balls: ≥ 2`,
                                            `Run length: ${length}`,
                                            isDeterministic ? "Deterministic trajectory" : "Isolated overlap",
                                        ])
                                    }
                                    onPointerLeave={hide}
                                />
                            );
                        })}
                    </g>
                ))}

                <rect
                    x={padLeft}
                    y={padTop}
                    width={side}
                    height={side}
                    fill="none"
                    stroke="var(--color-line-strong)"
                    strokeWidth={1}
                />

                <text x={padLeft - 6} y={padTop + 8} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    {size}
                </text>
                <text x={padLeft - 6} y={padTop + side} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    1
                </text>
                <text x={padLeft} y={height - 4} fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-faint)">
                    cyan = isolated overlap · gold = deterministic run
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 5. Union partition curve
 * ------------------------------------------------------------------ */

export interface UnionPartitionCurveChartProps {
    /** One row per horizon, 1..15. */
    rows: {
        horizon: number;
        unionSize: number;
        unionNull: number;
        recycledHits: number;
        recycledNull: number;
        freshHits: number;
        freshNull: number;
    }[];
    /** The horizon where the union reaches half the pool. */
    crossoverHorizon: number;
    className?: string;
    ariaLabel?: string;
}

export function UnionPartitionCurveChart({
    rows,
    crossoverHorizon,
    className,
    ariaLabel = "Recycled union versus fresh cold pool hits across union horizons",
}: UnionPartitionCurveChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 200;
    const padLeft = 38;
    const padRight = 18;
    const padTop = 18;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxValue = Math.max(1e-9, ...rows.flatMap((row) => [row.recycledHits, row.freshHits, row.recycledNull, row.freshNull]));
    const xOf = (horizon: number) => padLeft + ((horizon - 1) / Math.max(1, rows.length - 1)) * plotW;
    const yOf = (value: number) => padTop + plotH * (1 - value / maxValue);

    const path = (accessor: (row: UnionPartitionCurveChartProps["rows"][number]) => number) =>
        rows.map((row, i) => `${i === 0 ? "M" : "L"}${xOf(row.horizon).toFixed(1)},${yOf(accessor(row)).toFixed(1)}`).join(" ");

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
                <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
                <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />

                {/* The analytical hypergeometric curves */}
                <path d={path((row) => row.recycledNull)} fill="none" stroke="var(--color-primary)" strokeWidth={1.2} strokeDasharray="4 3" strokeOpacity={0.7} />
                <path d={path((row) => row.freshNull)} fill="none" stroke="var(--color-secondary)" strokeWidth={1.2} strokeDasharray="4 3" strokeOpacity={0.7} />

                {/* The empirical curves */}
                <path d={path((row) => row.recycledHits)} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
                <path d={path((row) => row.freshHits)} fill="none" stroke="var(--color-secondary)" strokeWidth={2} />

                {/* The crossover */}
                <line
                    x1={xOf(crossoverHorizon)}
                    y1={padTop}
                    x2={xOf(crossoverHorizon)}
                    y2={padTop + plotH}
                    stroke="var(--color-gold)"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                />
                <text
                    x={xOf(crossoverHorizon)}
                    y={padTop - 4}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontFamily="var(--font-mono)"
                    fill="var(--color-gold)"
                >
                    L* {crossoverHorizon}
                </text>

                {rows.map((row, i) => (
                    <g
                        key={`h-${row.horizon}`}
                        className="cursor-pointer"
                        onPointerEnter={(e) => {
                            setHoverIdx(i);
                            show(e, `Horizon L = ${row.horizon}`, [
                                `Union |U_L|: ${row.unionSize.toFixed(2)} (null ${row.unionNull.toFixed(2)})`,
                                `Recycled hits: ${row.recycledHits.toFixed(3)} (null ${row.recycledNull.toFixed(3)})`,
                                `Fresh hits: ${row.freshHits.toFixed(3)} (null ${row.freshNull.toFixed(3)})`,
                            ]);
                        }}
                        onPointerLeave={() => {
                            setHoverIdx(null);
                            hide();
                        }}
                    >
                        <circle
                            cx={xOf(row.horizon)}
                            cy={yOf(row.recycledHits)}
                            r={hoverIdx === i ? 3.5 : 2}
                            fill="var(--color-primary)"
                        />
                        <circle
                            cx={xOf(row.horizon)}
                            cy={yOf(row.freshHits)}
                            r={hoverIdx === i ? 3.5 : 2}
                            fill="var(--color-secondary)"
                        />
                    </g>
                ))}

                <text x={padLeft - 6} y={padTop + 4} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    {maxValue.toFixed(1)}
                </text>
                <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    0
                </text>
                {[1, 5, 10, 15].map((tick) => (
                    <text
                        key={tick}
                        x={xOf(tick)}
                        y={height - 8}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontFamily="var(--font-mono)"
                        fill="var(--color-ink-subtle)"
                    >
                        L{tick}
                    </text>
                ))}
                <text x={padLeft + plotW} y={height - 8} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-faint)">
                    recycled vs fresh · solid = observed, dashed = null
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 6. Ordinal motif bars
 * ------------------------------------------------------------------ */

export interface OrdinalMotifBarChartProps {
    /** The observed share of each of the six motifs. */
    shares: number[];
    /** The exact i.i.d. share, 1/6. */
    nullShare: number;
    /** The six motif labels. */
    labels: string[];
    /** The six motif glyphs. */
    glyphs: string[];
    /** The trailing motif index, 0..5. */
    trailingMotifIndex: number;
    className?: string;
    ariaLabel?: string;
}

export function OrdinalMotifBarChart({
    shares,
    nullShare,
    labels,
    glyphs,
    trailingMotifIndex,
    className,
    ariaLabel = "Bandt-Pompe ordinal motif shares against the i.i.d. baseline",
}: OrdinalMotifBarChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 190;
    const padLeft = 38;
    const padRight = 18;
    const padTop = 22;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxShare = Math.max(nullShare * 1.4, ...shares);
    const step = plotW / Math.max(1, shares.length);
    const barW = step * 0.58;
    const yOf = (value: number) => padTop + plotH * (1 - value / maxShare);

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={ariaLabel}>
                <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />

                {shares.map((share, i) => {
                    const x = padLeft + i * step + (step - barW) / 2;
                    const y = yOf(share);
                    const isTrailing = i === trailingMotifIndex;
                    const isHovered = hoverIdx === i;
                    return (
                        <g
                            key={`m-${i}`}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverIdx(i);
                                show(e, `Motif ${labels[i]}`, [
                                    `Observed: ${(share * 100).toFixed(2)}%`,
                                    `i.i.d. null: ${(nullShare * 100).toFixed(2)}%`,
                                    isTrailing ? "Current trailing state" : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverIdx(null);
                                hide();
                            }}
                        >
                            <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={Math.max(0, padTop + plotH - y)}
                                rx={2}
                                fill={isTrailing ? "var(--color-gold)" : "var(--color-primary)"}
                                fillOpacity={isHovered ? 0.95 : 0.72}
                            />
                            <text
                                x={x + barW / 2}
                                y={y - 4}
                                textAnchor="middle"
                                fontSize={8.5}
                                fontFamily="var(--font-mono)"
                                fill="var(--color-ink-muted)"
                            >
                                {(share * 100).toFixed(1)}
                            </text>
                            <text
                                x={x + barW / 2}
                                y={padTop + plotH + 13}
                                textAnchor="middle"
                                fontSize={11}
                                fill="var(--color-ink-subtle)"
                            >
                                {glyphs[i]}
                            </text>
                            <text
                                x={x + barW / 2}
                                y={padTop + plotH + 25}
                                textAnchor="middle"
                                fontSize={8.5}
                                fontFamily="var(--font-mono)"
                                fill={isTrailing ? "var(--color-gold)" : "var(--color-ink-faint)"}
                            >
                                {labels[i]}
                            </text>
                        </g>
                    );
                })}

                {/* The i.i.d. baseline, with its legend in the corner — the
                    last bar's own value label sits on this line. */}
                <line
                    x1={padLeft}
                    y1={yOf(nullShare)}
                    x2={padLeft + plotW}
                    y2={yOf(nullShare)}
                    stroke="var(--color-heat-hot)"
                    strokeWidth={1.2}
                    strokeDasharray="5 4"
                />
                <line
                    x1={padLeft + 2}
                    y1={padTop + 6}
                    x2={padLeft + 16}
                    y2={padTop + 6}
                    stroke="var(--color-heat-hot)"
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                />
                <text
                    x={padLeft + 20}
                    y={padTop + 9}
                    textAnchor="start"
                    fontSize={8.5}
                    fontFamily="var(--font-mono)"
                    fill="var(--color-heat-hot)"
                >
                    i.i.d. {(nullShare * 100).toFixed(2)}%
                </text>

                <text x={padLeft - 6} y={padTop + 4} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    {(maxShare * 100).toFixed(0)}%
                </text>
                <text x={padLeft - 6} y={padTop + plotH} textAnchor="end" fontSize={8.5} fontFamily="var(--font-mono)" fill="var(--color-ink-subtle)">
                    0
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}
