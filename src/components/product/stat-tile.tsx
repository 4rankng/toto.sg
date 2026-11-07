import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface StatTileProps {
    label: string;
    value: ReactNode;
    /** Secondary line under the value. */
    hint?: ReactNode;
    /** `primary` for the hot number, `gold` for jackpot-scale figures. */
    tone?: "default" | "primary" | "gold";
    className?: string;
}

/** Compact metric tile — label, big number, optional hint. No icon chrome. */
export function StatTile({ label, value, hint, tone = "default", className }: StatTileProps) {
    return (
        <div className={cx("flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3", className)}>
            <span className="text-xs font-medium tracking-[0.08em] text-ink-subtle uppercase">{label}</span>
            <span
                className={cx(
                    "text-xl font-semibold tracking-tight tabular-nums",
                    tone === "primary" ? "text-accent" : tone === "gold" ? "text-gold-ink" : "text-ink",
                )}
            >
                {value}
            </span>
            {hint && <span className="text-xs text-ink-faint">{hint}</span>}
        </div>
    );
}
