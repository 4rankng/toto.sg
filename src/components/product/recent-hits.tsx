import { cx } from "@/utils/cx";

interface RecentHitsProps {
    /** Hits recorded in the window. */
    hits: number;
    /** Draws in the window (12 for the league's recent-12 column). */
    draws: number;
    /** Chance expectation of hits per line. */
    expectedPerLine: number;
    className?: string;
}

/**
 * Recent-form comparison: hits in the last N draws against the chance
 * expectation for the same window. The league's `recent12` field is a total
 * over the window, not a per-draw count, so it can exceed the number of draws.
 */
export function RecentHits({ hits, draws, expectedPerLine, className }: RecentHitsProps) {
    const expected = expectedPerLine * draws;
    const scale = Math.max(expected * 2, hits);
    const marker = (expected / scale) * 100;

    return (
        <div className={cx("flex items-center gap-2", className)}>
            <div className="relative h-1.5 w-24 overflow-visible rounded-full bg-surface-3">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(hits / scale) * 100}%` }} />
                <div className="absolute -top-1 -bottom-1 w-px bg-chart-ref" style={{ left: `${marker}%` }} />
            </div>
            <span className="font-mono text-xs whitespace-nowrap text-ink-muted tabular-nums">
                {hits}
                <span className="text-ink-faint"> vs {expected.toFixed(1)}</span>
            </span>
        </div>
    );
}
