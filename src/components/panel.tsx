import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface PanelProps {
    title?: string;
    description?: string;
    /** Controls rendered after the title, e.g. a filter row. */
    actions?: ReactNode;
    /** Rendered below the body, separated by a hairline. */
    footer?: ReactNode;
    /** Remove the body padding — for edge-to-edge tables. */
    isFlush?: boolean;
    className?: string;
    children: ReactNode;
}

/** Data panel: hairline-bordered surface used for every analysis block. */
export function Panel({ title, description, actions, footer, isFlush = false, className, children }: PanelProps) {
    return (
        <section className={cx("flex flex-col rounded-xl border border-line bg-surface", className)}>
            {(title || actions) && (
                <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-t-xl border-b border-line px-4 py-3 md:px-5">
                    <div className="min-w-0">
                        {title && <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>}
                        {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
                    </div>
                    {actions}
                </header>
            )}
            <div className={cx(isFlush ? "" : "p-4 md:p-5")}>{children}</div>
            {footer && <footer className="border-t border-line px-4 py-3 text-xs text-ink-subtle md:px-5">{footer}</footer>}
        </section>
    );
}
