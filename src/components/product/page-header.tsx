import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface PageHeaderProps {
    /** Small mono label that names the surface. */
    kicker?: string;
    title: string;
    /** One-line summary under the title. */
    description?: ReactNode;
    /** Inline facts rendered next to the kicker. */
    meta?: ReactNode;
    /** Right-aligned links or figures. */
    actions?: ReactNode;
    className?: string;
}

/**
 * The console page header: a signal bar, a mono kicker, a compact display
 * title and one line of context. Everything else is data.
 */
export function PageHeader({ kicker, title, description, meta, actions, className }: PageHeaderProps) {
    return (
        <header className={cx("flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-2.5", className)}>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {kicker && (
                        <span className="flex items-center gap-1.5">
                            <span aria-hidden="true" className="h-3 w-1 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
                            <span className="font-mono text-[9px] font-semibold tracking-[0.2em] text-primary uppercase">{kicker}</span>
                        </span>
                    )}
                    {meta && <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px] text-ink-subtle">{meta}</span>}
                </div>
                <h1 className="mt-1 font-display text-xl leading-7 font-semibold tracking-[-0.02em] text-ink md:text-2xl md:leading-8">{title}</h1>
                {description && <p className="mt-0.5 max-w-3xl text-xs leading-4 text-ink-muted">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
        </header>
    );
}
