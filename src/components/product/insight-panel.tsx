// toto.sg — the frame every Insights panel sits in.
//
// A panel carries a gallery number, a title, one honest line about what it
// shows, the chart, the fair-cage expectation spelled out, and — where it
// helps — two or three stat chips. The expectation line is the site's
// signature: the gamblers get their dots AND the null.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Panel } from "@/components/panel";
import { cx } from "@/utils/cx";

export interface InsightStat {
    label: string;
    value: ReactNode;
    hint?: string;
}

interface InsightPanelProps {
    /** Gallery number, shown next to the section in the kicker. */
    number: number;
    /** The section this panel belongs to. */
    section: string;
    title: string;
    /** One honest line about what the panel shows. */
    caption: string;
    /** The expectation under a fair cage, in full. */
    expectation?: string;
    /** Strategy family to cross-link, e.g. "Gap & Due". */
    family?: string;
    /** Two or three inline stat chips, under the chart. */
    stats?: InsightStat[];
    /** Anchor id, for deep links. */
    id?: string;
    className?: string;
    children: ReactNode;
}

/** A compact figure that sits under a chart. */
function StatChip({ stat }: { stat: InsightStat }) {
    return (
        <div className="min-w-0 border-t border-line/70 pt-1.5">
            <p className="font-mono text-[9px] leading-3 font-semibold tracking-[0.14em] text-ink-subtle uppercase">{stat.label}</p>
            <p className="mt-0.5 font-mono text-[13px] leading-4 text-ink tabular-nums">{stat.value}</p>
            {stat.hint && <p className="text-[10px] leading-3 text-ink-subtle">{stat.hint}</p>}
        </div>
    );
}

export function InsightPanel({
    number,
    section,
    title,
    caption,
    expectation,
    family,
    stats,
    id,
    className,
    children,
}: InsightPanelProps) {
    return (
        <Panel
            id={id}
            kicker={`${section} · ${String(number).padStart(2, "0")}`}
            title={title}
            description={caption}
            actions={
                family ? (
                    <Link
                        to={`/strategies?family=${encodeURIComponent(family)}`}
                        className="text-[11px] text-ink-subtle transition-colors duration-100 hover:text-accent"
                    >
                        {family} strategies →
                    </Link>
                ) : undefined
            }
            className={className}
        >
            {children}

            {expectation && (
                <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
                    <span className="text-ink-faint">expected under a fair cage:</span> {expectation}
                </p>
            )}

            {stats && stats.length > 0 && (
                <div className={cx("mt-2 grid gap-2", stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                    {stats.map((stat) => (
                        <StatChip key={stat.label} stat={stat} />
                    ))}
                </div>
            )}
        </Panel>
    );
}
