// toto.sg — visualization components for technical indicators, oscillators, hazard curves and Markov matrices.
//
// Follows the same responsive SVG architecture:
//   - Inline SVG with viewBox, scaling smoothly with panel width.
//   - Pointer-driven tooltip via useChartTooltip().
//   - role="img" + aria-label summarizing key metrics.
//   - Diverging ramp (teal/cyan for positive/high, pink for negative/oversold, gold for highlights).
import { useState } from "react";
import { ChartTooltip, useChartTooltip } from "@/components/chart-tooltip";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ *
 * 1. Oscillator Band Chart (49-ball strip with overbought/oversold bands)
 * ------------------------------------------------------------------ */

export interface OscillatorItem {
    number: number;
    value: number;
    label?: string;
    sublabel?: string;
}

interface OscillatorBandChartProps {
    items: OscillatorItem[];
    minVal?: number;
    maxVal?: number;
    overbought?: number;
    oversold?: number;
    center?: number;
    valueSuffix?: string;
    className?: string;
    ariaLabel: string;
}

export function OscillatorBandChart({
    items,
    minVal = 0,
    maxVal = 100,
    overbought = 65,
    oversold = 35,
    center = 50,
    valueSuffix = "",
    className,
    ariaLabel,
}: OscillatorBandChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverNum, setHoverNum] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 180;
    const padLeft = 32;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const valToY = (v: number) => {
        const clamped = Math.max(minVal, Math.min(maxVal, v));
        const ratio = (clamped - minVal) / (maxVal - minVal || 1);
        return padTop + plotH * (1 - ratio);
    };

    const yCenter = valToY(center);
    const yOverbought = valToY(overbought);
    const yOversold = valToY(oversold);

    const barW = Math.max(2, (plotW / items.length) * 0.7);

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto block"
                role="img"
                aria-label={ariaLabel}
            >
                {/* Shaded Overbought Zone */}
                <rect
                    x={padLeft}
                    y={padTop}
                    width={plotW}
                    height={Math.max(0, yOverbought - padTop)}
                    fill="var(--color-heat-hot)"
                    fillOpacity={0.08}
                />
                {/* Shaded Oversold Zone */}
                <rect
                    x={padLeft}
                    y={yOversold}
                    width={plotW}
                    height={Math.max(0, padTop + plotH - yOversold)}
                    fill="var(--color-secondary)"
                    fillOpacity={0.08}
                />

                {/* Reference Lines */}
                <line
                    x1={padLeft}
                    y1={yOverbought}
                    x2={padLeft + plotW}
                    y2={yOverbought}
                    stroke="var(--color-heat-hot)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    strokeOpacity={0.4}
                />
                <line
                    x1={padLeft}
                    y1={yCenter}
                    x2={padLeft + plotW}
                    y2={yCenter}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                />
                <line
                    x1={padLeft}
                    y1={yOversold}
                    x2={padLeft + plotW}
                    y2={yOversold}
                    stroke="var(--color-secondary)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    strokeOpacity={0.4}
                />

                {/* Y-axis Labels */}
                <text x={padLeft - 6} y={yOverbought + 3} textAnchor="end" fill="var(--color-heat-hot)" fontSize={9} fontFamily="var(--font-mono)">
                    {overbought}
                </text>
                <text x={padLeft - 6} y={yCenter + 3} textAnchor="end" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    {center}
                </text>
                <text x={padLeft - 6} y={yOversold + 3} textAnchor="end" fill="var(--color-secondary)" fontSize={9} fontFamily="var(--font-mono)">
                    {oversold}
                </text>

                {/* Bars / Lollipops */}
                {items.map((item, idx) => {
                    const x = padLeft + (idx + 0.5) * (plotW / items.length);
                    const y = valToY(item.value);
                    const isHot = item.value >= overbought;
                    const isCold = item.value <= oversold;
                    const isHovered = hoverNum === item.number;

                    const color = isHot
                        ? "var(--color-heat-hot)"
                        : isCold
                            ? "var(--color-secondary)"
                            : "var(--color-text-subtle)";

                    return (
                        <g
                            key={item.number}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverNum(item.number);
                                show(e, `Ball ${item.number}`, [
                                    `Value: ${item.value}${valueSuffix}`,
                                    item.label ? `Status: ${item.label}` : "",
                                    item.sublabel ? item.sublabel : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverNum(null);
                                hide();
                            }}
                        >
                            <line
                                x1={x}
                                y1={yCenter}
                                x2={x}
                                y2={y}
                                stroke={color}
                                strokeWidth={isHovered ? barW + 1.5 : barW}
                                strokeOpacity={isHovered ? 1 : 0.8}
                            />
                            <circle
                                cx={x}
                                cy={y}
                                r={isHovered ? 3.5 : 2}
                                fill={isHovered ? "var(--color-gold)" : color}
                            />
                            {/* Every 10th ball label on x-axis */}
                            {(item.number === 1 || item.number % 10 === 0 || item.number === 49) && (
                                <text
                                    x={x}
                                    y={padTop + plotH + 14}
                                    textAnchor="middle"
                                    fill="var(--color-text-subtle)"
                                    fontSize={8.5}
                                    fontFamily="var(--font-mono)"
                                >
                                    {item.number}
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
 * 2. Envelope Band Chart (Time-series line with Upper/Lower Channel)
 * ------------------------------------------------------------------ */

export interface EnvelopePoint {
    label: string | number;
    value: number;
    upper: number;
    lower: number;
    ma?: number;
}

interface EnvelopeBandChartProps {
    points: EnvelopePoint[];
    valueLabel?: string;
    channelLabel?: string;
    className?: string;
    ariaLabel: string;
}

export function EnvelopeBandChart({
    points,
    valueLabel = "Sum",
    channelLabel = "Band",
    className,
    ariaLabel,
}: EnvelopeBandChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 180;
    const padLeft = 36;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (points.length < 2) {
        return <div className="text-sm text-text-subtle p-4">Insufficient data points</div>;
    }

    const allVals = points.flatMap((p) => [p.value, p.upper, p.lower]);
    const minVal = Math.min(...allVals) - 5;
    const maxVal = Math.max(...allVals) + 5;

    const valToY = (v: number) => {
        const ratio = (v - minVal) / (maxVal - minVal || 1);
        return padTop + plotH * (1 - ratio);
    };

    const xCoord = (idx: number) => padLeft + (idx / (points.length - 1)) * plotW;

    // Generate SVG path for upper/lower fill area
    const upperPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.upper)}`).join(" ");
    const lowerReversed = [...points]
        .reverse()
        .map((p, i) => `L ${xCoord(points.length - 1 - i)} ${valToY(p.lower)}`)
        .join(" ");
    const areaD = `${upperPath} ${lowerReversed} Z`;

    const seriesD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.value)}`).join(" ");
    const maD = points[0].ma !== undefined
        ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.ma!)}`).join(" ")
        : "";

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto block"
                role="img"
                aria-label={ariaLabel}
            >
                {/* Channel Fill */}
                <path d={areaD} fill="var(--color-primary)" fillOpacity={0.08} />

                {/* Upper and Lower Boundary Lines */}
                <path
                    d={points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.upper)}`).join(" ")}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                />
                <path
                    d={points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.lower)}`).join(" ")}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeOpacity={0.5}
                />

                {/* Moving Average Line if present */}
                {maD && (
                    <path
                        d={maD}
                        fill="none"
                        stroke="var(--color-text-subtle)"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        strokeOpacity={0.6}
                    />
                )}

                {/* Series Line */}
                <path
                    d={seriesD}
                    fill="none"
                    stroke="var(--color-secondary)"
                    strokeWidth={1.8}
                />

                {/* Interactive Points */}
                {points.map((p, i) => {
                    const cxVal = xCoord(i);
                    const cyVal = valToY(p.value);
                    const isHovered = hoverIdx === i;

                    return (
                        <g
                            key={i}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverIdx(i);
                                show(e, `Draw ${p.label}`, [
                                    `${valueLabel}: ${p.value}`,
                                    `${channelLabel} Upper: ${p.upper}`,
                                    `${channelLabel} Lower: ${p.lower}`,
                                    p.ma !== undefined ? `Mean: ${p.ma}` : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverIdx(null);
                                hide();
                            }}
                        >
                            <circle
                                cx={cxVal}
                                cy={cyVal}
                                r={isHovered ? 4 : 2}
                                fill={isHovered ? "var(--color-gold)" : "var(--color-secondary)"}
                            />
                        </g>
                    );
                })}

                {/* X-axis tick labels */}
                <text x={padLeft} y={height - 8} textAnchor="start" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    {points[0].label}
                </text>
                <text x={padLeft + plotW} y={height - 8} textAnchor="end" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    {points[points.length - 1].label}
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 3. Survival Hazard Chart (Observed Step/Curve vs Theoretical Null)
 * ------------------------------------------------------------------ */

export interface SurvivalPoint {
    step: number;
    empirical: number;
    theoretical: number;
    sampleSize?: number;
}

interface SurvivalHazardChartProps {
    points: SurvivalPoint[];
    xLabel?: string;
    yLabel?: string;
    yFormatPct?: boolean;
    className?: string;
    ariaLabel: string;
}

export function SurvivalHazardChart({
    points,
    xLabel = "Skip",
    yLabel: _yLabel = "Hazard Rate",
    yFormatPct = false,
    className,
    ariaLabel,
}: SurvivalHazardChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 180;
    const padLeft = 40;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const allY = points.flatMap((p) => [p.empirical, p.theoretical]);
    const maxVal = Math.max(0.15, ...allY) * 1.05;

    const valToY = (v: number) => padTop + plotH * (1 - v / maxVal);
    const xCoord = (idx: number) => padLeft + (idx / (points.length - 1 || 1)) * plotW;

    const empD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.empirical)}`).join(" ");
    const theoD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xCoord(i)} ${valToY(p.theoretical)}`).join(" ");

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto block"
                role="img"
                aria-label={ariaLabel}
            >
                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map((frac) => {
                    const y = valToY(maxVal * frac);
                    return (
                        <line
                            key={frac}
                            x1={padLeft}
                            y1={y}
                            x2={padLeft + plotW}
                            y2={y}
                            stroke="var(--color-border)"
                            strokeDasharray="2 3"
                            strokeWidth={1}
                        />
                    );
                })}

                {/* Theoretical Baseline Curve (Teal/Neutral Dash) */}
                <path
                    d={theoD}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.7}
                />

                {/* Empirical Step Curve (Pink/Cyan) */}
                <path
                    d={empD}
                    fill="none"
                    stroke="var(--color-heat-hot)"
                    strokeWidth={2}
                />

                {/* Interactive Points */}
                {points.map((p, i) => {
                    const cxVal = xCoord(i);
                    const cyVal = valToY(p.empirical);
                    const isHovered = hoverIdx === i;

                    return (
                        <g
                            key={i}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverIdx(i);
                                show(e, `${xLabel}: ${p.step}`, [
                                    `Observed: ${yFormatPct ? `${(p.empirical * 100).toFixed(1)}%` : p.empirical.toFixed(3)}`,
                                    `Theoretical Null: ${yFormatPct ? `${(p.theoretical * 100).toFixed(1)}%` : p.theoretical.toFixed(3)}`,
                                    p.sampleSize ? `Sample At Risk: ${p.sampleSize}` : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverIdx(null);
                                hide();
                            }}
                        >
                            <circle
                                cx={cxVal}
                                cy={cyVal}
                                r={isHovered ? 4.5 : 2.5}
                                fill={isHovered ? "var(--color-gold)" : "var(--color-heat-hot)"}
                            />
                        </g>
                    );
                })}

                {/* Legend at Top Right */}
                <g transform={`translate(${width - padRight - 120}, ${padTop + 4})`}>
                    <line x1={0} y1={0} x2={16} y2={0} stroke="var(--color-heat-hot)" strokeWidth={2} />
                    <text x={20} y={3} fill="var(--color-text-subtle)" fontSize={8.5} fontFamily="var(--font-mono)">
                        Observed
                    </text>
                    <line x1={0} y1={12} x2={16} y2={12} stroke="var(--color-primary)" strokeWidth={1.5} strokeDasharray="3 2" />
                    <text x={20} y={15} fill="var(--color-text-subtle)" fontSize={8.5} fontFamily="var(--font-mono)">
                        Theoretical
                    </text>
                </g>

                {/* Axis Labels */}
                <text x={padLeft} y={height - 8} textAnchor="start" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    0
                </text>
                <text x={padLeft + plotW} y={height - 8} textAnchor="end" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    {points[points.length - 1]?.step}
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 4. Scatter Regression Chart (Bivariate Point Cloud + Trend Line)
 * ------------------------------------------------------------------ */

export interface ScatterPoint {
    x: number;
    y: number;
    label?: string;
    sublabel?: string;
}

interface ScatterRegressionChartProps {
    points: ScatterPoint[];
    xName?: string;
    yName?: string;
    slope?: number;
    className?: string;
    ariaLabel: string;
}

export function ScatterRegressionChart({
    points,
    xName = "X",
    yName = "Y",
    slope,
    className,
    ariaLabel,
}: ScatterRegressionChartProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const width = Math.max(measured, 320);
    const height = 180;
    const padLeft = 36;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 26;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (points.length === 0) return null;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const scaleX = (x: number) => padLeft + ((x - minX) / (maxX - minX || 1)) * plotW;
    const scaleY = (y: number) => padTop + (1 - (y - minY) / (maxY - minY || 1)) * plotH;

    // Zero axes if within range
    const hasZeroX = minX <= 0 && maxX >= 0;
    const hasZeroY = minY <= 0 && maxY >= 0;

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto block"
                role="img"
                aria-label={ariaLabel}
            >
                {/* Zero Cross Axes */}
                {hasZeroX && (
                    <line
                        x1={scaleX(0)}
                        y1={padTop}
                        x2={scaleX(0)}
                        y2={padTop + plotH}
                        stroke="var(--color-border)"
                        strokeWidth={1}
                    />
                )}
                {hasZeroY && (
                    <line
                        x1={padLeft}
                        y1={scaleY(0)}
                        x2={padLeft + plotW}
                        y2={scaleY(0)}
                        stroke="var(--color-border)"
                        strokeWidth={1}
                    />
                )}

                {/* Fitted regression line if slope provided */}
                {slope !== undefined && (
                    <line
                        x1={scaleX(minX)}
                        y1={scaleY(minY + (minX - minX) * slope)}
                        x2={scaleX(maxX)}
                        y2={scaleY(minY + (maxX - minX) * slope)}
                        stroke="var(--color-gold)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                    />
                )}

                {/* Scatter Points */}
                {points.map((p, idx) => {
                    const cxVal = scaleX(p.x);
                    const cyVal = scaleY(p.y);
                    const isHovered = hoverIdx === idx;

                    return (
                        <circle
                            key={idx}
                            cx={cxVal}
                            cy={cyVal}
                            r={isHovered ? 4.5 : 2.5}
                            fill={isHovered ? "var(--color-gold)" : "var(--color-secondary)"}
                            fillOpacity={isHovered ? 1 : 0.75}
                            className="cursor-pointer transition-all"
                            onPointerEnter={(e) => {
                                setHoverIdx(idx);
                                show(e, p.label || `Point ${idx + 1}`, [
                                    `${xName}: ${p.x}`,
                                    `${yName}: ${p.y}`,
                                    p.sublabel ? p.sublabel : "",
                                ].filter(Boolean));
                            }}
                            onPointerLeave={() => {
                                setHoverIdx(null);
                                hide();
                            }}
                        />
                    );
                })}

                {/* Axis Extrema */}
                <text x={padLeft} y={height - 8} textAnchor="start" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    {minX}
                </text>
                <text x={padLeft + plotW} y={height - 8} textAnchor="end" fill="var(--color-text-subtle)" fontSize={9} fontFamily="var(--font-mono)">
                    {maxX}
                </text>
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * 5. Transition Matrix Heatmap (Interactive 49x49 Markov Grid)
 * ------------------------------------------------------------------ */

interface TransitionHeatmapProps {
    topTransitions: { from: number; to: number; lift: number; count: number }[];
    className?: string;
    ariaLabel: string;
}

export function TransitionMatrixHeatmap({
    topTransitions,
    className,
    ariaLabel,
}: TransitionHeatmapProps) {
    const { hostRef, tip, show, hide, width: measured } = useChartTooltip();
    const [hoverPair, setHoverPair] = useState<string | null>(null);

    const width = Math.max(measured, 320);
    const height = 180;
    const padLeft = 32;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 20;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Display top 10 transitions as a styled mini-grid or ranked lane
    const maxLift = Math.max(1.5, ...topTransitions.map((t) => t.lift));

    return (
        <div ref={hostRef} className={cx("relative w-full overflow-hidden select-none", className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto block"
                role="img"
                aria-label={ariaLabel}
            >
                {topTransitions.slice(0, 8).map((t, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const cellW = (plotW - 24) / 4;
                    const cellH = (plotH - 12) / 2;
                    const x = padLeft + col * (cellW + 8);
                    const y = padTop + row * (cellH + 12);
                    const key = `${t.from}->${t.to}`;
                    const isHovered = hoverPair === key;
                    const liftRatio = Math.min(1, (t.lift - 1) / (maxLift - 1 || 1)); // TODO: shade cells by lift
                    void liftRatio;
                    const fillColor = t.lift >= 1.25
                        ? "var(--color-primary)"
                        : "var(--color-secondary)";

                    return (
                        <g
                            key={key}
                            className="cursor-pointer"
                            onPointerEnter={(e) => {
                                setHoverPair(key);
                                show(e, `Transition ${t.from} → ${t.to}`, [
                                    `Markov Lift: ${t.lift}x`,
                                    `Historical Hits: ${t.count} times`,
                                    `Null Expectation: 1.0x`,
                                ]);
                            }}
                            onPointerLeave={() => {
                                setHoverPair(null);
                                hide();
                            }}
                        >
                            <rect
                                x={x}
                                y={y}
                                width={cellW}
                                height={cellH}
                                rx={4}
                                fill={fillColor}
                                fillOpacity={isHovered ? 0.35 : 0.15}
                                stroke={isHovered ? "var(--color-gold)" : fillColor}
                                strokeWidth={isHovered ? 1.5 : 1}
                            />
                            <text
                                x={x + cellW / 2}
                                y={y + cellH / 2 - 3}
                                textAnchor="middle"
                                fill="var(--color-text)"
                                fontSize={11}
                                fontWeight={600}
                                fontFamily="var(--font-mono)"
                            >
                                {t.from} → {t.to}
                            </text>
                            <text
                                x={x + cellW / 2}
                                y={y + cellH / 2 + 10}
                                textAnchor="middle"
                                fill={fillColor}
                                fontSize={9.5}
                                fontFamily="var(--font-mono)"
                            >
                                {t.lift}x lift
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip tip={tip} />}
        </div>
    );
}
