import { cx } from "@/utils/cx";

interface ScoreBarProps {
    /** Score on the 0–100 league scale. */
    score: number;
    /** The chance baseline drawn as a marker on the track. */
    baseline?: number;
    /** Highest possible score, used to scale the track. */
    max?: number;
    /** Podium medals are gold / silver / bronze; every other row is emerald. */
    tone?: "primary" | "gold" | "silver" | "bronze" | "muted";
    className?: string;
}

const TONES = {
    primary: "bg-primary",
    gold: "bg-gold",
    silver: "bg-silver",
    bronze: "bg-bronze",
    muted: "bg-ink-faint",
} as const;

/**
 * League score bar: a 0–100 track with the chance baseline marked on it.
 * A marker sitting left of the fill means the strategy beat chance.
 */
export function ScoreBar({ score, baseline = 45, max = 100, tone = "primary", className }: ScoreBarProps) {
    const clamped = Math.max(0, Math.min(score, max));
    const fill = (clamped / max) * 100;
    const marker = (baseline / max) * 100;

    return (
        <div className={cx("relative h-1.5 w-full min-w-16 overflow-visible rounded-full bg-surface-3", className)}>
            <div className={cx("absolute inset-y-0 left-0 rounded-full", TONES[tone])} style={{ width: `${fill}%` }} />
            <div className="absolute -top-1 -bottom-1 w-px bg-chart-ref" style={{ left: `${marker}%` }} title={`Chance baseline ${baseline}`} />
        </div>
    );
}
