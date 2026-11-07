import { cx } from "@/utils/cx";

interface DeltaProps {
    /** Signed difference; positive reads cold, negative hot. */
    value: number;
    digits?: number;
    /** Prefix shown before the number, e.g. "+" is implied. */
    prefix?: string;
    className?: string;
}

/** Signed difference against a baseline, coloured by direction. */
export function Delta({ value, digits = 2, prefix = "", className }: DeltaProps) {
    const positive = value > 0;
    const neutral = value === 0;

    return (
        <span className={cx("font-medium tabular-nums", neutral ? "text-ink-subtle" : positive ? "text-up" : "text-down", className)}>
            {prefix}
            {positive ? "+" : neutral ? "" : "−"}
            {Math.abs(value).toFixed(digits)}
        </span>
    );
}
