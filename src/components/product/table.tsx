import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Shared table classes. The league and history tables use the same rhythm:
 * hairline rows, no zebra, numbers right-aligned in the mono face. Density is
 * deliberate — a 36px row shows roughly 40% more of the archive per screen
 * than the old 48px rhythm.
 */

/** Header cell. Sticks to the viewport on wide screens (`top-13` clears the nav). */
export const th =
    "sticky top-13 z-10 border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-subtle uppercase max-md:static";

/** Header cell for numeric columns. */
export const thNum = cx(th, "text-right");

/** Body cell. */
export const td = "border-b border-line-soft px-3 py-2 align-middle text-[13px] leading-5 text-ink-muted";

/** Body cell for numeric columns — mono, right aligned, tabular. */
export const tdNum = cx(td, "text-right font-mono text-xs tabular-nums");

/** Sticky first column of a horizontally scrolling table. */
export const tdSticky = cx(td, "sticky left-0 z-[5] bg-inherit");

/** Sticky first column, numeric variant. */
export const tdStickyNum = cx(tdSticky, "text-right font-mono text-xs tabular-nums");

/**
 * Horizontal rail for wide tables. Below `xl` the table scrolls sideways; at
 * `xl` and up the rail is transparent so the sticky header can stick to the
 * viewport instead of to this box.
 */
export const tableRail = "min-w-0 overflow-x-auto xl:overflow-visible";

interface TableFrameProps {
    children: ReactNode;
    className?: string;
}

/** Table shell: the rail plus the table element itself. */
export function TableFrame({ children, className }: TableFrameProps) {
    return (
        <div className={cx(tableRail, className)}>
            <table className="w-full min-w-[1180px] border-collapse text-left">{children}</table>
        </div>
    );
}
