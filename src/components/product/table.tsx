import { cx } from "@/utils/cx";

/**
 * Shared table classes. The league and history tables use the same rhythm:
 * hairline rows, no zebra, numbers right-aligned in the mono face. Density is
 * deliberate — a 36px row shows roughly 40% more of the archive per screen
 * than the old 48px rhythm.
 */

/**
 * Header cell. Not sticky: the tables sit inside horizontal rails, and a
 * sticky head there is offset against the rail rather than the viewport —
 * which renders it over the first rows. The header stays with the table.
 */
export const th =
    "border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase";

/** Header cell for numeric columns. */
export const thNum = cx(th, "text-right");

/** Body cell. */
export const td = "border-b border-line-soft px-3 py-2 align-middle text-[13px] leading-5 text-ink-muted";

/** Body cell for numeric columns — mono, right aligned, tabular-nums. */
export const tdNum = cx(td, "text-right font-mono text-xs tabular-nums");
