import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** How much surface a panel owns. Dense pages stay on `default`. */
type PanelEmphasis = "default" | "hero" | "plain";

interface PanelProps {
    /** Small uppercase label above the title. */
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
     * `default` is the standard hairline card. `hero` earns a little more
     * padding for the one block that leads a page. `plain` drops the card
     * chrome entirely (closing notes, inline callouts).
     */
    emphasis?: PanelEmphasis;
    /** Extra classes for the body wrapper. */
    bodyClassName?: string;
    className?: string;
    children: ReactNode;
}

const EMPHASIS: Record<PanelEmphasis, { root: string; body: string }> = {
    default: { root: "border border-line bg-surface", body: "p-4" },
    hero: { root: "border border-line bg-surface", body: "p-4 md:p-5" },
    plain: { root: "bg-transparent", body: "p-0" },
};

/**
 * Data panel: hairline-bordered surface used for every analysis block.
 * No drop shadow — a single hairline is enough to lift a card off the tinted
 * canvas, and it keeps the page quiet when six of them stack.
 */
export function Panel({ kicker, title, description, actions, footer, isFlush = false, emphasis = "default", bodyClassName, className, children }: PanelProps) {
    const tone = EMPHASIS[emphasis];
    const hasHeader = Boolean(kicker || title || actions);

    return (
        <section className={cx("flex min-w-0 flex-col rounded-xl", tone.root, className)}>
            {hasHeader && (
                <header
                    className={cx(
                        "flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-4 py-2.5",
                        emphasis !== "plain" && "border-b border-line/70",
                    )}
                >
                    <div className="min-w-0">
                        {kicker && <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">{kicker}</p>}
                        {title && <h2 className="font-display text-sm leading-5 font-semibold tracking-tight text-ink">{title}</h2>}
                        {description && <p className="mt-0.5 max-w-prose text-xs leading-4 text-ink-subtle">{description}</p>}
                    </div>
                    {actions && <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
                </header>
            )}
            <div className={cx(isFlush ? "" : tone.body, bodyClassName)}>{children}</div>
            {footer && <footer className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-subtle">{footer}</footer>}
        </section>
    );
}
