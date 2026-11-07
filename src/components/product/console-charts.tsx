import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ *
 * Gauge — half-circle, one value
 * ------------------------------------------------------------------ */

type GaugeTone = "primary" | "secondary" | "gold" | "down" | "muted";

const GAUGE_COLOUR: Record<GaugeTone, string> = {
    primary: "var(--color-primary)",
    secondary: "var(--color-secondary)",
    gold: "var(--color-gold)",
    down: "var(--color-down)",
    muted: "var(--color-ink-subtle)",
};

interface GaugeProps {
    /** 0–1 */
    value: number;
    /** Printed in the middle, e.g. "47%". */
    display: string;
    label: string;
    hint?: ReactNode;
    tone?: GaugeTone;
    className?: string;
}

/** Half-circle gauge: track, value arc and a centre reading. */
export function Gauge({ value, display, label, hint, tone = "primary", className }: GaugeProps) {
    const clamped = Math.max(0, Math.min(1, value));
    const length = Math.PI * 40;

    return (
        <div className={cx("flex min-w-0 flex-col items-center", className)}>
            <svg viewBox="0 0 100 58" className="w-full max-w-40" role="img" aria-label={`${label}: ${display}`}>
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--color-surface-3)" strokeWidth={8} strokeLinecap="round" />
                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke={GAUGE_COLOUR[tone]}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={`${clamped * length} ${length}`}
                    style={{ color: GAUGE_COLOUR[tone], filter: "drop-shadow(0 0 5px color-mix(in oklab, currentColor 45%, transparent))" }}
                />
                <text x="50" y="45" textAnchor="middle" fontSize="19" fontWeight="600" fill="var(--color-ink)" fontFamily="var(--font-display)">
                    {display}
                </text>
            </svg>
            <p className="mt-0.5 font-mono text-[9px] font-semibold tracking-[0.16em] text-ink-subtle uppercase">{label}</p>
            {hint && <p className="mt-0.5 text-center text-[10px] leading-3 text-ink-subtle">{hint}</p>}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Donut — categorical share
 * ------------------------------------------------------------------ */

interface DonutSegment {
    label: string;
    value: number;
    colour: string;
}

interface DonutChartProps {
    segments: DonutSegment[];
    centerValue: string;
    centerLabel: string;
    className?: string;
}

/**
 * Ring of categorical shares. The legend is part of the component so the
 * colours and labels stay together at every width.
 */
export function DonutChart({ segments, centerValue, centerLabel, className }: DonutChartProps) {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className={cx("flex flex-col items-center gap-2", className)}>
            <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-32" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
                <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-surface-3)" strokeWidth={10} />
                {segments.map((segment) => {
                    const length = (segment.value / total) * circumference;
                    const dash = `${Math.max(0, length - 1.5)} ${circumference}`;
                    const element = (
                        <circle
                            key={segment.label}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={segment.colour}
                            strokeWidth={10}
                            strokeDasharray={dash}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 50 50)"
                            style={{ color: segment.colour, filter: "drop-shadow(0 0 4px color-mix(in oklab, currentColor 25%, transparent))" }}
                        />
                    );
                    offset += length;
                    return element;
                })}
                <text x="50" y="48" textAnchor="middle" fontSize="17" fontWeight="600" fill="var(--color-ink)" fontFamily="var(--font-display)">
                    {centerValue}
                </text>
                <text x="50" y="59" textAnchor="middle" fontSize="6.5" fill="var(--color-ink-subtle)" fontFamily="var(--font-mono)">
                    {centerLabel.toUpperCase()}
                </text>
            </svg>

            <ul className="flex w-full min-w-0 flex-col gap-1">
                {segments.map((segment) => (
                    <li key={segment.label} className="flex items-center gap-2 text-[11px]">
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: segment.colour }} />
                        <span className="min-w-0 flex-1 truncate text-ink-muted">{segment.label}</span>
                        <span className="shrink-0 font-mono text-[10px] text-ink tabular-nums">{Math.round((segment.value / total) * 100)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
