import { cx } from "@/utils/cx";

interface ScoreBarProps {
    /** Score on the 0–100 league scale. 45 is a random pick. */
    score: number;
    /** The random-pick baseline drawn as a marker on the track. */
    baseline?: number;
    /** Highest possible score, used to scale the track. */
    max?: number;
    /** Podium medals are gold / silver / bronze; every other row is the brand violet. */
    tone?: "primary" | "gold" | "silver" | "bronze" | "muted";
    className?: string;
}

const TONES = {
    primary: "bg-accent",
    gold: "bg-gold",
    silver: "bg-silver",
    bronze: "bg-bronze",
    muted: "bg-ink-faint",
} as const;

/**
 * League score bar: a 0–100 track with the random-pick mark on it. A marker
 * left of the fill means the rule picked up more hits than random.
 */
export function ScoreBar({ score, baseline = 45, max = 100, tone = "primary", className }: ScoreBarProps) {
    const clamped = Math.max(0, Math.min(score, max));
    const fill = (clamped / max) * 100;
    const marker = (baseline / max) * 100;

    return (
        <div className={cx("relative h-1 w-full min-w-16 overflow-visible rounded-full bg-surface-3", className)}>
            <div className={cx("absolute inset-y-0 left-0 rounded-full", TONES[tone])} style={{ width: `${fill}%` }} />
            <div className="absolute -top-1 -bottom-1 w-px bg-chart-ref" style={{ left: `${marker}%` }} title={`Random pick = ${baseline}`} />
        </div>
    );
}
