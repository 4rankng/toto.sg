import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface PageHeaderProps {
    /** Small uppercase label that names the surface, e.g. "TOTO · 6/49". */
    kicker?: string;
    title: string;
    /** One-line summary under the title. */
    description?: ReactNode;
    /** Inline facts rendered next to the kicker, e.g. draw number and date. */
    meta?: ReactNode;
    /** Right-aligned links or figures. */
    actions?: ReactNode;
    className?: string;
}

/**
 * The one page-level heading pattern. Compact on purpose: a dashboard title
 * earns one line, not a display block, so the data starts near the top.
 */
export function PageHeader({ kicker, title, description, meta, actions, className }: PageHeaderProps) {
    return (
        <header className={cx("flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5 border-b border-line/70 pb-2.5", className)}>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {kicker && <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">{kicker}</span>}
                    {meta && <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-subtle">{meta}</span>}
                </div>
                <h1 className="mt-0.5 font-display text-lg leading-6 font-semibold tracking-[-0.015em] text-ink md:text-xl md:leading-7">{title}</h1>
                {description && <p className="mt-0.5 max-w-3xl text-xs leading-4 text-ink-muted">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </header>
    );
}
