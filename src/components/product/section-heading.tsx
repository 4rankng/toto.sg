import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface SectionHeadingProps {
    /** Anchor id — the insights nav links to it. */
    id?: string;
    /** Small uppercase kicker above the title. */
    kicker?: string;
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

/** Section header used inside multi-block panels. */
export function SectionHeading({ id, kicker, title, description, actions, className }: SectionHeadingProps) {
    return (
        <div className={cx("flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1", className)}>
            <div className="min-w-0">
                {kicker && <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">{kicker}</p>}
                <h2 id={id} className="font-display text-base leading-6 font-semibold tracking-tight text-ink">
                    {title}
                </h2>
                {description && <p className="mt-0.5 max-w-3xl text-xs leading-4 text-ink-subtle">{description}</p>}
            </div>
            {actions}
        </div>
    );
}
