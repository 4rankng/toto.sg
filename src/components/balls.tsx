import { cx } from "@/utils/cx";

interface BallsProps {
    /** The 6 winning numbers. */
    numbers: number[];
    /** The additional number, rendered in the muted ball style. */
    additional?: number | null;
    /** `md` for hero panels, `sm` for tables and strips. */
    size?: "md" | "sm";
    className?: string;
}

const ballStyles = {
    md: "h-12 w-12 text-lg",
    sm: "h-8 w-8 text-sm",
};

/**
 * Toto ball row — the one domain-specific UI primitive (no Untitled UI
 * equivalent). Announced to assistive tech as a single labelled summary so
 * table rows don't read out seven separate cells.
 */
export function Balls({ numbers, additional = null, size = "md", className }: BallsProps) {
    const label =
        additional != null
            ? `Winning numbers ${numbers.join(", ")}; additional ${additional}`
            : `Winning numbers ${numbers.join(", ")}`;

    return (
        <div
            className={cx(size === "sm" ? "flex items-center gap-1" : "flex flex-wrap items-center gap-1.5", className)}
            role="img"
            aria-label={label}
        >
            <span aria-hidden="true" className="contents">
                {numbers.map((n, i) => (
                    <span
                        key={`${n}-${i}`}
                        className={cx(
                            "grid place-items-center rounded-full bg-primary-solid font-semibold text-white tabular-nums",
                            ballStyles[size],
                        )}
                    >
                        {n}
                    </span>
                ))}
                {additional != null && (
                    <span
                        className={cx(
                            "grid place-items-center rounded-full bg-secondary-solid font-semibold text-white tabular-nums",
                            ballStyles[size],
                        )}
                    >
                        {additional}
                    </span>
                )}
            </span>
        </div>
    );
}
