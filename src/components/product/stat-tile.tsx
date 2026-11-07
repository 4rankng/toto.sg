import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface StatTileProps {
    label: string;
    value: ReactNode;
    /** Secondary line under the value. */
    hint?: ReactNode;
    /** `primary` for the hot number, `gold` for jackpot-scale figures. */
    tone?: "default" | "primary" | "gold";
    /**
     * `card` is a standalone tile on the canvas. `bare` drops the card chrome
     * for metric strips inside a panel — the top hairline does the separating.
     */
    variant?: "card" | "bare";
    className?: string;
}

/** Compact metric — label, figure, optional hint. Dense by design: no icon chrome. */
export function StatTile({ label, value, hint, tone = "default", variant = "card", className }: StatTileProps) {
    return (
        <div
            className={cx(
                "flex min-w-0 flex-col gap-0.5",
                variant === "card" ? "rounded-lg border border-line bg-surface px-3 py-2 panel-glow" : "border-t border-line/70 pt-2",
                className,
            )}
        >
            <span className="truncate font-mono text-[9px] font-semibold tracking-[0.16em] text-ink-subtle uppercase">{label}</span>
            <span
                className={cx(
                    "font-display text-xl leading-6 font-semibold tracking-tight tabular-nums md:text-2xl md:leading-7",
                    tone === "primary" ? "text-accent" : tone === "gold" ? "text-gold-ink" : "text-ink",
                )}
            >
                {value}
            </span>
            {hint && <span className="truncate text-[10px] leading-3 text-ink-subtle">{hint}</span>}
        </div>
    );
}
