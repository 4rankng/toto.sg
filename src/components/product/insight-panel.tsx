// toto.sg — the frame every Insights panel sits in.
//
// A panel carries a gallery number, a title, one honest line about what it
// shows, the chart, and — where it helps — two or three stat chips.
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
    /** Strategy family to cross-link, e.g. "Gap & Due". */
    family?: string;
    /** Two or three inline stat chips, under the chart. */
    stats?: InsightStat[];
    /** Extra content for the side column of a split panel, above the stat chips. */
    aside?: ReactNode;
    /**
     * `stacked` (the default) puts the chart above the stat chips. `split`
     * places them beside the chart instead — for a panel that owns a
     * full-width row, where a tall chart would otherwise leave empty page
     * underneath it.
     */
    layout?: "stacked" | "split";
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

function StatRow({ stats, className }: { stats: InsightStat[]; className?: string }) {
    return (
        <div className={cx("grid gap-2", stats.length === 2 ? "grid-cols-2" : "grid-cols-3", className)}>
            {stats.map((stat) => (
                <StatChip key={stat.label} stat={stat} />
            ))}
        </div>
    );
}

export function InsightPanel({ number, section, title, caption, family, stats, aside, layout = "stacked", id, className, children }: InsightPanelProps) {
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
                        className="text-[11px] text-ink-subtle transition-colors duration-100 hover:text-accent-strong"
                    >
                        {family} strategies →
                    </Link>
                ) : undefined
            }
            className={className}
        >
            {layout === "split" ? (
                <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-center">
                    <div className="min-w-0">{children}</div>
                    <div className="flex min-w-0 flex-col justify-between gap-3">
                        {aside}
                        {stats && stats.length > 0 && <StatRow stats={stats} />}
                    </div>
                </div>
            ) : (
                <>
                    {children}
                    {aside}
                    {stats && stats.length > 0 && <StatRow stats={stats} className="mt-2" />}
                </>
            )}
        </Panel>
    );
}
