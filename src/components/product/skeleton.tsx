import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** One pulsing placeholder block. */
export function Skeleton({ className }: { className?: string }) {
    return <div aria-hidden="true" className={cx("animate-pulse rounded-md bg-surface-2", className)} />;
}

interface DataLoadingProps {
    /** Announced once while the data files load. */
    label: string;
    className?: string;
    children: ReactNode;
}

/**
 * Loading shell for a data page: keeps the page's shape (header, cards, rows)
 * so the layout does not jump when the JSON lands, and announces the wait to
 * assistive tech through a single status region.
 */
export function DataLoading({ label, className, children }: DataLoadingProps) {
    return (
        <div role="status" aria-busy="true" className={cx("flex flex-col gap-4", className)}>
            <span className="sr-only">{label}</span>
            {children}
        </div>
    );
}

/** A page header placeholder that matches the real `PageHeader` rhythm. */
export function PageHeaderSkeleton() {
    return (
        <div className="flex flex-col gap-1.5 border-b border-line/70 pb-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-56 max-w-full" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
    );
}

/** `count` table-like rows. */
export function RowsSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="divide-y divide-line-soft rounded-xl border border-line bg-surface">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-6 w-32" />
                </div>
            ))}
        </div>
    );
}
