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

/** Section header used by the insights panels and their anchor nav. */
export function SectionHeading({ id, kicker, title, description, actions, className }: SectionHeadingProps) {
    return (
        <div className={cx("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
            <div className="min-w-0">
                {kicker && <p className="text-[11px] font-medium tracking-[0.08em] text-ink-faint uppercase">{kicker}</p>}
                <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
                    {title}
                </h2>
                {description && <p className="mt-0.5 max-w-2xl text-xs text-ink-subtle">{description}</p>}
            </div>
            {actions}
        </div>
    );
}
