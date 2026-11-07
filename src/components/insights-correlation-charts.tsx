// toto.sg — visualization components for gambler analytics, statistical correlations and pari-mutuel metrics.
//
// Every chart follows the same architecture as insights-charts.tsx:
//   - Inline SVG with viewBox, scaling smoothly with panel width.
//   - Pointer-driven tooltip via useChartTooltip().
//   - role="img" + aria-label summarizing the key metric.
//   - Diverging ramp (cyan / heat-cold for positive/high, pink / heat-hot for negative/low)
//     and zero green/red chrome.
import { useState } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
import { formatSigned } from "@/lib/data";
import {
    type AutocorrelationStats,
    type BallPayoutStats,
    type BirthdayPayoutStats,
    type ChiSquareAuditStats,
    type PairCorrelationMatrixStats,
} from "@/lib/insights-correlations";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ *
 * 1. 49x49 Pair Correlation Heatmap
 * ------------------------------------------------------------------ */

interface PairCorrelationHeatmapProps {
    stats: PairCorrelationMatrixStats;
    className?: string;
}

export function PairCorrelationHeatmap({ stats, className }: PairCorrelationHeatmapProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverPos, setHoverPos] = useState<{ a: number; b: number } | null>(null);

    const width = Math.max(measured, 320);
    const padLeft = 32;
    const padRight = 10;
    const padTop = 24;
    const padBottom = 24;

    const plotW = width - padLeft - padRight;
    const cellSize = Math.max(2, Math.min(10, plotW / 49));
    const gridDim = cellSize * 49;
    const height = padTop + gridDim + padBottom;

    const absMaxZ = Math.max(2.5, Math.abs(stats.minZ), Math.abs(stats.maxZ));

    const getColor = (z: number) => {
        if (Math.abs(z) < 0.3) return "var(--color-surface-2)";
        if (z > 0) {
            const intensity = Math.min(1, z / absMaxZ);
            return `color-mix(in srgb, var(--color-heat-hot) ${Math.round(intensity * 100)}%, var(--color-surface-2))`;
        }
        const intensity = Math.min(1, Math.abs(z) / absMaxZ);
        return `color-mix(in srgb, var(--color-heat-cold) ${Math.round(intensity * 100)}%, var(--color-surface-2))`;
    };

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label="49 by 49 pairwise correlation matrix of all 1,176 pairs, showing standardized residuals vs fair-cage expectation."
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {/* Number axis markers at 1, 10, 20, 30, 40, 49 */}
                {[1, 10, 20, 30, 40, 49].map((n) => {
                    const offset = (n - 1) * cellSize + cellSize / 2;
                    return (
                        <g key={n}>
                            <text
                                x={padLeft + offset}
                                y={padTop - 6}
                                textAnchor="middle"
                                fontSize={8}
                                fill="var(--color-ink-faint)"
                                fontFamily="var(--font-mono)"
                            >
                                {n}
                            </text>
                            <text
                                x={padLeft - 6}
                                y={padTop + offset + 3}
                                textAnchor="end"
                                fontSize={8}
                                fill="var(--color-ink-faint)"
                                fontFamily="var(--font-mono)"
                            >
                                {n}
                            </text>
                        </g>
                    );
                })}

                {/* Render the 49x49 grid */}
                {Array.from({ length: 49 }, (_, row) => {
                    const a = row + 1;
                    return Array.from({ length: 49 }, (_, col) => {
                        const b = col + 1;
                        if (a === b) {
                            return (
                                <rect
                                    key={`${a}-${b}`}
                                    x={padLeft + col * cellSize}
                                    y={padTop + row * cellSize}
                                    width={cellSize}
                                    height={cellSize}
                                    fill="var(--color-surface-3)"
                                />
                            );
                        }
                        const z = stats.matrix[a * 50 + b] ?? 0;
                        const fill = getColor(z);

                        return (
                            <rect
                                key={`${a}-${b}`}
                                x={padLeft + col * cellSize}
                                y={padTop + row * cellSize}
                                width={cellSize}
                                height={cellSize}
                                fill={fill}
                            />
                        );
                    });
                })}

                {/* Hover crosshairs */}
                {hoverPos && (
                    <g pointerEvents="none">
                        <rect
                            x={padLeft + (hoverPos.b - 1) * cellSize}
                            y={padTop}
                            width={cellSize}
                            height={gridDim}
                            fill="none"
                            stroke="var(--color-ink)"
                            strokeWidth={1}
                            strokeOpacity={0.6}
                        />
                        <rect
                            x={padLeft}
                            y={padTop + (hoverPos.a - 1) * cellSize}
                            width={gridDim}
                            height={cellSize}
                            fill="none"
                            stroke="var(--color-ink)"
                            strokeWidth={1}
                            strokeOpacity={0.6}
                        />
                    </g>
                )}

                {/* Single interactive tracking layer to prevent 2,401 DOM listeners */}
                <rect
                    x={padLeft}
                    y={padTop}
                    width={gridDim}
                    height={gridDim}
                    fill="transparent"
                    onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = e.clientX - rect.left;
                        const relY = e.clientY - rect.top;
                        const col = Math.min(48, Math.max(0, Math.floor((relX / rect.width) * 49)));
                        const row = Math.min(48, Math.max(0, Math.floor((relY / rect.height) * 49)));
                        const a = row + 1;
                        const b = col + 1;
                        setHoverPos({ a, b });

                        if (a === b) {
                            show(e, `Number ${a}`, ["diagonal identity (same ball)"]);
                        } else {
                            const z = stats.matrix[a * 50 + b] ?? 0;
                            show(e, `Pair ${Math.min(a, b)} – ${Math.max(a, b)}`, [
                                `residual z-score: ${formatSigned(z, 2)}σ`,
                                z > 0 ? "appears together more than chance" : "appears together less than chance",
                            ]);
                        }
                    }}
                    onPointerLeave={() => {
                        setHoverPos(null);
                        hide();
                    }}
                />
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 2. Small Annotated Correlation Matrix (7x7 / 3x3)
 * ------------------------------------------------------------------ */

interface SmallCorrelationGridProps {
    labels: string[];
    matrix: number[][];
    className?: string;
}

export function SmallCorrelationGrid({ labels, matrix, className }: SmallCorrelationGridProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const dim = labels.length;
    const width = Math.max(measured, 300);
    const padLeft = 44;
    const padRight = 10;
    const padTop = 26;
    const padBottom = 20;

    const plotW = width - padLeft - padRight;
    const cellSize = Math.min(40, plotW / dim);
    const height = padTop + cellSize * dim + padBottom;

    const getColor = (r: number) => {
        if (Math.abs(r) < 0.05) return "var(--color-surface-2)";
        if (r > 0) {
            const intensity = Math.min(1, r);
            return `color-mix(in srgb, var(--color-primary) ${Math.round(intensity * 100)}%, var(--color-surface-2))`;
        }
        const intensity = Math.min(1, Math.abs(r));
        return `color-mix(in srgb, var(--color-down) ${Math.round(intensity * 100)}%, var(--color-surface-2))`;
    };

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`${dim} by ${dim} feature correlation matrix.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {labels.map((lbl, i) => (
                    <g key={lbl}>
                        <text
                            x={padLeft + i * cellSize + cellSize / 2}
                            y={padTop - 8}
                            textAnchor="middle"
                            fontSize={9}
                            fill="var(--color-ink-subtle)"
                            fontFamily="var(--font-mono)"
                        >
                            {lbl}
                        </text>
                        <text
                            x={padLeft - 6}
                            y={padTop + i * cellSize + cellSize / 2 + 3}
                            textAnchor="end"
                            fontSize={9}
                            fill="var(--color-ink-subtle)"
                            fontFamily="var(--font-mono)"
                        >
                            {lbl}
                        </text>
                    </g>
                ))}

                {matrix.map((row, r) =>
                    row.map((val, c) => {
                        const x = padLeft + c * cellSize;
                        const y = padTop + r * cellSize;
                        const title = `${labels[r]} × ${labels[c]}`;
                        const lines = [`Pearson correlation r = ${formatSigned(val, 3)}`];

                        return (
                            <g key={`${r}-${c}`}>
                                <rect
                                    x={x + 1}
                                    y={y + 1}
                                    width={cellSize - 2}
                                    height={cellSize - 2}
                                    rx={2}
                                    fill={r === c ? "var(--color-surface-3)" : getColor(val)}
                                    onPointerEnter={(e) => show(e, title, lines)}
                                    onPointerMove={(e) => show(e, title, lines)}
                                    onPointerLeave={hide}
                                />
                                {cellSize >= 30 && (
                                    <text
                                        x={x + cellSize / 2}
                                        y={y + cellSize / 2 + 3.5}
                                        textAnchor="middle"
                                        fontSize={8.5}
                                        fontFamily="var(--font-mono)"
                                        fill={r === c ? "var(--color-ink-muted)" : "var(--color-ink)"}
                                        pointerEvents="none"
                                    >
                                        {r === c ? "1.00" : formatSigned(val, 2)}
                                    </text>
                                )}
                            </g>
                        );
                    }),
                )}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 3. Correlogram (Autocorrelation Lags 1–20)
 * ------------------------------------------------------------------ */

interface CorrelogramChartProps {
    stats: AutocorrelationStats;
    className?: string;
}

export function CorrelogramChart({ stats, className }: CorrelogramChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 220;
    const padLeft = 40;
    const padRight = 14;
    const padTop = 20;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const midY = padTop + plotH / 2;

    const maxR = Math.max(0.12, stats.maxAbsR * 1.2);
    const yOf = (r: number) => midY - (r / maxR) * (plotH / 2);
    const slot = plotW / stats.lags.length;

    const boundYTop = yOf(stats.bound95);
    const boundYBot = yOf(-stats.bound95);

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label="Autocorrelation function of draw sum and odd count for lags 1 through 20 with 95% confidence bounds."
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                {/* 95% white noise confidence band */}
                <rect
                    x={padLeft}
                    y={boundYTop}
                    width={plotW}
                    height={Math.max(1, boundYBot - boundYTop)}
                    fill="var(--color-primary)"
                    fillOpacity={0.07}
                />
                <line
                    x1={padLeft}
                    x2={width - padRight}
                    y1={boundYTop}
                    y2={boundYTop}
                    stroke="var(--color-chart-ref)"
                    strokeWidth={0.8}
                    strokeDasharray="3 3"
                />
                <line
                    x1={padLeft}
                    x2={width - padRight}
                    y1={boundYBot}
                    y2={boundYBot}
                    stroke="var(--color-chart-ref)"
                    strokeWidth={0.8}
                    strokeDasharray="3 3"
                />
                <line x1={padLeft} x2={width - padRight} y1={midY} y2={midY} stroke="var(--color-line-strong)" strokeWidth={1} />

                {/* Y Axis labels */}
                <text x={padLeft - 6} y={yOf(maxR) + 4} textAnchor="end" fontSize={9} fill="var(--color-ink-subtle)">
                    +{maxR.toFixed(2)}
                </text>
                <text x={padLeft - 6} y={midY + 3} textAnchor="end" fontSize={9} fill="var(--color-ink-subtle)">
                    0
                </text>
                <text x={padLeft - 6} y={yOf(-maxR) + 2} textAnchor="end" fontSize={9} fill="var(--color-ink-subtle)">
                    -{maxR.toFixed(2)}
                </text>

                {/* Stem points for each lag */}
                {stats.lags.map((lag, i) => {
                    const x = padLeft + i * slot + slot / 2;
                    const y = yOf(lag.rSum);
                    const title = `Lag ${lag.lag} (${lag.lag} draw${lag.lag === 1 ? "" : "s"} ago)`;
                    const lines = [
                        `Sum correlation r = ${formatSigned(lag.rSum, 3)}`,
                        `Odd count correlation r = ${formatSigned(lag.rOdd, 3)}`,
                        `95% white-noise bound: ±${stats.bound95.toFixed(3)}`,
                    ];

                    return (
                        <g key={lag.lag}>
                            <line x1={x} x2={x} y1={midY} y2={y} stroke="var(--color-primary)" strokeWidth={1.5} />
                            <circle
                                cx={x}
                                cy={y}
                                r={3}
                                fill="var(--color-primary)"
                                onPointerEnter={(e) => show(e, title, lines)}
                                onPointerMove={(e) => show(e, title, lines)}
                                onPointerLeave={hide}
                            />
                            {lag.lag % 2 === 0 && (
                                <text
                                    x={x}
                                    y={padTop + plotH + 16}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fill="var(--color-ink-faint)"
                                    fontFamily="var(--font-mono)"
                                >
                                    {lag.lag}
                                </text>
                            )}
                        </g>
                    );
                })}

                <text x={width - padRight} y={boundYTop - 4} textAnchor="end" fontSize={9} fill="var(--color-chart-ref)">
                    95% null bound (±{stats.bound95.toFixed(2)})
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 4. Observed vs Expected Bar Chart (Reusable)
 * ------------------------------------------------------------------ */

export interface ObservedExpectedBarItem {
    label: string;
    subLabel?: string;
    observedValue: number;
    expectedValue: number;
    formattedObserved?: string;
    formattedExpected?: string;
    tone?: "primary" | "secondary" | "gold" | "hot";
}

interface ObservedExpectedBarChartProps {
    items: ObservedExpectedBarItem[];
    maxValue?: number;
    orientation?: "vertical" | "horizontal";
    className?: string;
}

export function ObservedExpectedBarChart({
    items,
    maxValue,
    orientation = "vertical",
    className,
}: ObservedExpectedBarChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);

    const getToneColor = (tone?: string) => {
        if (tone === "secondary") return "var(--color-secondary)";
        if (tone === "gold") return "var(--color-gold)";
        if (tone === "hot") return "var(--color-heat-hot)";
        return "var(--color-primary)";
    };

    if (orientation === "horizontal") {
        const rowH = 22;
        const padLeft = 88;
        const padRight = 36;
        const padTop = 14;
        const padBottom = 20;
        const height = padTop + items.length * rowH + padBottom;
        const plotW = width - padLeft - padRight;

        const max = maxValue ?? Math.max(...items.flatMap((it) => [it.observedValue, it.expectedValue]), 0.01) * 1.15;
        const xOf = (v: number) => padLeft + Math.min(plotW, (v / max) * plotW);

        return (
            <div ref={hostRef} className={cx("relative", className)} role="img" aria-label="Comparison of observed vs expected bars.">
                <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                    <line x1={padLeft} x2={padLeft} y1={padTop} y2={height - padBottom} stroke="var(--color-line-strong)" strokeWidth={1} />

                    {items.map((item, i) => {
                        const y = padTop + i * rowH;
                        const barW = Math.max(2, (item.observedValue / max) * plotW);
                        const expX = xOf(item.expectedValue);
                        const color = getToneColor(item.tone);

                        const title = item.label;
                        const lines = [
                            `observed: ${item.formattedObserved ?? item.observedValue.toFixed(2)}`,
                            `expected: ${item.formattedExpected ?? item.expectedValue.toFixed(2)}`,
                        ];

                        return (
                            <g key={item.label}>
                                <text
                                    x={padLeft - 8}
                                    y={y + rowH / 2 + 3}
                                    textAnchor="end"
                                    fontSize={10}
                                    fill="var(--color-ink-muted)"
                                >
                                    {item.label}
                                </text>
                                <rect
                                    x={padLeft}
                                    y={y + 3}
                                    width={barW}
                                    height={rowH - 6}
                                    rx={1.5}
                                    fill={color}
                                    fillOpacity={0.7}
                                    onPointerEnter={(e) => show(e, title, lines)}
                                    onPointerMove={(e) => show(e, title, lines)}
                                    onPointerLeave={hide}
                                />
                                {/* Expected line tick */}
                                <line
                                    x1={expX}
                                    x2={expX}
                                    y1={y + 1}
                                    y2={y + rowH - 3}
                                    stroke="var(--color-chart-ref)"
                                    strokeWidth={1.8}
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

    // Vertical
    const height = 210;
    const padLeft = 40;
    const padRight = 12;
    const padTop = 18;
    const padBottom = 32;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const max = maxValue ?? Math.max(...items.flatMap((it) => [it.observedValue, it.expectedValue]), 0.01) * 1.15;
    const yOf = (v: number) => baseline - (v / max) * plotH;
    const slot = plotW / items.length;
    const barW = Math.max(3, slot - 10);

    return (
        <div ref={hostRef} className={cx("relative", className)} role="img" aria-label="Comparison of observed vs expected bars.">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {items.map((item, i) => {
                    const x = padLeft + i * slot + (slot - barW) / 2;
                    const barH = (item.observedValue / max) * plotH;
                    const expY = yOf(item.expectedValue);
                    const color = getToneColor(item.tone);

                    const title = item.label;
                    const lines = [
                        `observed: ${item.formattedObserved ?? item.observedValue.toFixed(2)}`,
                        `expected: ${item.formattedExpected ?? item.expectedValue.toFixed(2)}`,
                    ];

                    return (
                        <g key={item.label}>
                            <rect
                                x={x}
                                y={baseline - barH}
                                width={barW}
                                height={Math.max(1, barH)}
                                rx={1.5}
                                fill={color}
                                fillOpacity={0.7}
                                onPointerEnter={(e) => show(e, title, lines)}
                                onPointerMove={(e) => show(e, title, lines)}
                                onPointerLeave={hide}
                            />
                            {/* Expected dashed tick */}
                            <line
                                x1={x - 2}
                                x2={x + barW + 2}
                                y1={expY}
                                y2={expY}
                                stroke="var(--color-chart-ref)"
                                strokeWidth={1.8}
                                strokeDasharray="3 2"
                            />
                            <text
                                x={x + barW / 2}
                                y={baseline + 16}
                                textAnchor="middle"
                                fontSize={9.5}
                                fill="var(--color-ink-muted)"
                            >
                                {item.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 5. Ball Payout Chart (1–49 Crowd Tax)
 * ------------------------------------------------------------------ */

interface BallPayoutChartProps {
    stats: BallPayoutStats;
    className?: string;
}

export function BallPayoutChart({ stats, className }: BallPayoutChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 240;
    const padLeft = 46;
    const padRight = 14;
    const padTop = 22;
    const padBottom = 30;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const minP = Math.min(...stats.rows.map((r) => r.meanG3), 1400);
    const maxP = Math.max(...stats.rows.map((r) => r.meanG3), 2100);

    const yOf = (v: number) => baseline - ((v - minP) / (maxP - minP)) * plotH;
    const slot = plotW / stats.rows.length;
    const barW = Math.max(2, slot - 3);

    const eraY = yOf(stats.eraMeanG3);

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Per-ball Group 3 payout tax across numbers 1 to 49. Mean payout S$${Math.round(stats.eraMeanG3)}.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {/* Reference line for Era Mean Payout */}
                <line
                    x1={padLeft}
                    x2={width - padRight}
                    y1={eraY}
                    y2={eraY}
                    stroke="var(--color-chart-ref)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                />
                <text x={width - padRight} y={eraY - 6} textAnchor="end" fontSize={9.5} fill="var(--color-chart-ref)">
                    era mean S${Math.round(stats.eraMeanG3)}
                </text>

                {/* Y Axis ticks */}
                <text x={padLeft - 6} y={yOf(maxP) + 4} textAnchor="end" fontSize={9} fill="var(--color-ink-subtle)">
                    S${Math.round(maxP)}
                </text>
                <text x={padLeft - 6} y={yOf(minP) + 2} textAnchor="end" fontSize={9} fill="var(--color-ink-subtle)">
                    S${Math.round(minP)}
                </text>

                {stats.rows.map((row, i) => {
                    const x = padLeft + i * slot + (slot - barW) / 2;
                    const y = yOf(row.meanG3);
                    const isAbove = row.meanG3 >= stats.eraMeanG3;
                    const barH = Math.abs(y - eraY);
                    const color = isAbove ? "var(--color-up)" : "var(--color-down)";

                    const title = `Number ${row.number}`;
                    const lines = [
                        `mean Group 3 payout: S$${Math.round(row.meanG3)}`,
                        `delta vs era: ${formatSigned(row.deltaVsEra, 0)}`,
                        `${row.drawsWithBall} draws with this ball`,
                    ];

                    return (
                        <g key={row.number}>
                            <rect
                                x={x}
                                y={isAbove ? y : eraY}
                                width={barW}
                                height={Math.max(1, barH)}
                                rx={1}
                                fill={color}
                                fillOpacity={0.75}
                                onPointerEnter={(e) => show(e, title, lines)}
                                onPointerMove={(e) => show(e, title, lines)}
                                onPointerLeave={hide}
                            />
                            {row.number % 5 === 0 && (
                                <text
                                    x={x + barW / 2}
                                    y={baseline + 16}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fill="var(--color-ink-faint)"
                                    fontFamily="var(--font-mono)"
                                >
                                    {row.number}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 6. Birthday & Payout Curve Chart
 * ------------------------------------------------------------------ */

interface BirthdayPayoutChartProps {
    stats: BirthdayPayoutStats;
    className?: string;
}

export function BirthdayPayoutChart({ stats, className }: BirthdayPayoutChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const height = 220;
    const padLeft = 44;
    const padRight = 16;
    const padTop = 22;
    const padBottom = 32;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const maxY = 2400;
    const yOf = (v: number) => baseline - (v / maxY) * plotH;
    const slot = plotW / stats.rows.length;
    const barW = Math.max(4, slot - 16);

    return (
        <div
            ref={hostRef}
            className={cx("relative", className)}
            role="img"
            aria-label={`Group 3 payout vs birthday ball count. Drops ${stats.payoutDropPercent.toFixed(0)}% from 2 to 6 birthday numbers.`}
        >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} stroke="var(--color-line-strong)" strokeWidth={1} />

                {/* Y ticks */}
                {[500, 1000, 1500, 2000].map((tick) => (
                    <g key={tick}>
                        <line x1={padLeft} x2={width - padRight} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-line)" strokeWidth={0.8} />
                        <text x={padLeft - 6} y={yOf(tick) + 3} textAnchor="end" fontSize={9} fill="var(--color-ink-subtle)">
                            ${tick}
                        </text>
                    </g>
                ))}

                {stats.rows.map((row, i) => {
                    const x = padLeft + i * slot + (slot - barW) / 2;
                    const barH = (row.meanG3 / maxY) * plotH;
                    const isCrowded = row.birthdayCount >= 5;

                    const title = `${row.birthdayCount} Birthday Balls (≤ 31)`;
                    const lines = [
                        `mean Group 3 share: S$${Math.round(row.meanG3)}`,
                        `median Group 3 share: S$${Math.round(row.medianG3)}`,
                        `observed in ${row.draws} draws (${(row.shareOfDraws * 100).toFixed(1)}%)`,
                        `expected ${(row.expectedShare * 100).toFixed(1)}% of draws`,
                    ];

                    return (
                        <g key={row.birthdayCount}>
                            <rect
                                x={x}
                                y={baseline - barH}
                                width={barW}
                                height={Math.max(1, barH)}
                                rx={2}
                                fill={isCrowded ? "var(--color-down)" : "var(--color-primary)"}
                                fillOpacity={0.8}
                                onPointerEnter={(e) => show(e, title, lines)}
                                onPointerMove={(e) => show(e, title, lines)}
                                onPointerLeave={hide}
                            />
                            <text
                                x={x + barW / 2}
                                y={baseline - barH - 5}
                                textAnchor="middle"
                                fontSize={9}
                                fontFamily="var(--font-mono)"
                                fill="var(--color-ink-muted)"
                            >
                                ${Math.round(row.meanG3)}
                            </text>
                            <text
                                x={x + barW / 2}
                                y={baseline + 16}
                                textAnchor="middle"
                                fontSize={10}
                                fill="var(--color-ink-muted)"
                            >
                                {row.birthdayCount}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 7. Butterfly / Diverging Bar Chart (Weekday split or Family z-score)
 * ------------------------------------------------------------------ */

interface ButterflySplitRow {
    label: string;
    subLabel?: string;
    value: number; // Signed value: positive -> right, negative -> left
    leftText?: string;
    rightText?: string;
}

interface ButterflySplitChartProps {
    rows: ButterflySplitRow[];
    centerLabel?: string;
    maxAbs?: number;
    className?: string;
}

export function ButterflySplitChart({ rows, centerLabel = "0.0", maxAbs, className }: ButterflySplitChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();

    const width = Math.max(measured, 320);
    const rowH = 20;
    const padLeft = 84;
    const padRight = 50;
    const padTop = 16;
    const padBottom = 16;

    const height = padTop + rows.length * rowH + padBottom;
    const plotW = width - padLeft - padRight;
    const centerX = padLeft + plotW / 2;

    const peak = maxAbs ?? Math.max(...rows.map((r) => Math.abs(r.value)), 0.05);

    return (
        <div ref={hostRef} className={cx("relative", className)} role="img" aria-label="Diverging butterfly bar chart.">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" aria-hidden="true">
                <line x1={centerX} x2={centerX} y1={padTop} y2={height - padBottom} stroke="var(--color-line-strong)" strokeWidth={1} />
                <text x={centerX} y={padTop - 5} textAnchor="middle" fontSize={8} fill="var(--color-ink-faint)" fontFamily="var(--font-mono)">
                    {centerLabel}
                </text>

                {rows.map((row, i) => {
                    const y = padTop + i * rowH;
                    const w = Math.min(plotW / 2, (Math.abs(row.value) / peak) * (plotW / 2));
                    const isRight = row.value >= 0;
                    const x = isRight ? centerX : centerX - w;
                    const color = isRight ? "var(--color-primary)" : "var(--color-secondary)";

                    const title = row.label;
                    const lines = [`value: ${formatSigned(row.value, 2)}`, row.subLabel ?? ""].filter(Boolean);

                    return (
                        <g key={row.label}>
                            <text
                                x={padLeft - 8}
                                y={y + rowH / 2 + 3}
                                textAnchor="end"
                                fontSize={9.5}
                                fill="var(--color-ink-muted)"
                            >
                                {row.label}
                            </text>
                            <rect
                                x={x}
                                y={y + 3}
                                width={Math.max(1, w)}
                                height={rowH - 6}
                                rx={1.5}
                                fill={color}
                                fillOpacity={0.75}
                                onPointerEnter={(e) => show(e, title, lines)}
                                onPointerMove={(e) => show(e, title, lines)}
                                onPointerLeave={hide}
                            />
                            <text
                                x={isRight ? x + w + 4 : x - 4}
                                y={y + rowH / 2 + 3}
                                textAnchor={isRight ? "start" : "end"}
                                fontSize={8.5}
                                fontFamily="var(--font-mono)"
                                fill="var(--color-ink-subtle)"
                            >
                                {formatSigned(row.value, 2)}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 8. Chi-Square Scorecard Chart
 * ------------------------------------------------------------------ */

interface ChiSquareScorecardProps {
    stats: ChiSquareAuditStats;
    className?: string;
}

export function ChiSquareScorecard({ stats, className }: ChiSquareScorecardProps) {
    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <div className="grid grid-cols-1 divide-y divide-line-soft">
                {stats.tests.map((test) => {
                    const isFair = test.verdict === "FAIR";
                    return (
                        <div key={test.name} className="flex items-center justify-between py-2 text-xs">
                            <div className="min-w-0">
                                <p className="font-medium text-ink">{test.name}</p>
                                <p className="font-mono text-[10px] text-ink-subtle">
                                    χ² = {test.chiSq.toFixed(2)} · df = {test.df} · p = {test.pValue.toFixed(3)}
                                </p>
                            </div>
                            <span
                                className={cx(
                                    "rounded px-2 py-0.5 font-mono text-[10px] font-semibold",
                                    isFair ? "bg-surface-2 text-primary" : "bg-down/20 text-down",
                                )}
                            >
                                {test.verdict}
                            </span>
                        </div>
                    );
                })}
            </div>
            <p className="mt-1 text-[11px] text-ink-subtle">
                A p-value ≥ 0.01 confirms the observed counts are statistically indistinguishable from a uniform, independent random cage.
            </p>
        </div>
    );
}
