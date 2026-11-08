import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** How much surface a panel owns. */
type PanelEmphasis = "default" | "hero" | "plain";

interface PanelProps {
    /** Anchor id — the insights nav links to it. */
    id?: string;
    /** Small mono label above the title. */
    kicker?: string;
    title?: string;
    description?: string;
    /** Controls rendered after the title, e.g. a filter row. */
    actions?: ReactNode;
    /** Rendered below the body, separated by a hairline. */
    footer?: ReactNode;
    /** Remove the body padding — for edge-to-edge tables. */
    isFlush?: boolean;
    /**
     * `default` is the console cell. `hero` adds the signal glow for the one
     * block that leads a page. `plain` drops the cell chrome.
     */
    emphasis?: PanelEmphasis;
    /** Extra classes for the body wrapper. */
    bodyClassName?: string;
    className?: string;
    children: ReactNode;
}

const EMPHASIS: Record<PanelEmphasis, { root: string; body: string; header: string }> = {
    default: {
        root: "border border-line bg-surface panel-glow",
        body: "p-3",
        header: "border-b border-line/80 bg-surface-2",
    },
    hero: {
        root: "border border-primary-line bg-surface shadow-[0_0_60px_-28px_var(--color-primary)]",
        body: "p-3 md:p-3.5",
        header: "border-b border-line/80 bg-surface-2",
    },
    plain: { root: "bg-transparent", body: "p-0", header: "" },
};

/**
 * Console cell: a hairline panel with a mono header strip. No drop shadows
 * except the signal glow; density comes from tight padding, not chrome.
 */
export function Panel({ id, kicker, title, description, actions, footer, isFlush = false, emphasis = "default", bodyClassName, className, children }: PanelProps) {
    const tone = EMPHASIS[emphasis];
    const hasHeader = Boolean(kicker || title || actions);

    return (
        <section id={id} className={cx("flex min-w-0 flex-col rounded-lg", tone.root, className)}>
            {hasHeader && (
                <header
                    className={cx(
                        "flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 rounded-t-lg px-3 py-2",
                        tone.header,
                    )}
                >
                    <div className="min-w-0">
                        {kicker && (
                            <p className="font-mono text-[9px] leading-3 font-semibold tracking-[0.18em] text-primary uppercase">{kicker}</p>
                        )}
                        {title && <h2 className={cx("font-display text-[13px] leading-5 font-semibold tracking-tight text-ink", kicker && "mt-0.5")}>{title}</h2>}
                        {description && <p className="mt-0.5 max-w-prose text-[11px] leading-4 text-ink-subtle">{description}</p>}
                    </div>
                    {actions && <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
                </header>
            )}
            <div className={cx(isFlush ? "" : tone.body, bodyClassName)}>{children}</div>
            {footer && <footer className="border-t border-line/70 px-3 py-2 text-[11px] leading-4 text-ink-subtle">{footer}</footer>}
        </section>
    );
}
