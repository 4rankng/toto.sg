import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface PanelProps {
    title: string;
    description?: string;
    /** Controls rendered after the title, e.g. a tab switch. */
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** Data panel: the Untitled UI table-card idiom applied to analysis blocks. */
export function Panel({ title, description, actions, className, children }: PanelProps) {
    return (
        <section className={cx("overflow-hidden rounded-xl bg-primary shadow-xs ring-1 ring-secondary", className)}>
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-secondary px-4 py-3 md:px-5">
                <div className="min-w-0">
                    <h2 className="text-md font-semibold text-primary">{title}</h2>
                    {description && <p className="text-sm text-tertiary">{description}</p>}
                </div>
                {actions}
            </header>
            <div className="p-4 md:p-5">{children}</div>
        </section>
    );
}
