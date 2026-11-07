import { cx } from "@/utils/cx";

export type BallSize = "xs" | "sm" | "md" | "lg" | "xl";

interface BallProps {
    /** The number on the ball (1–49). */
    n: number;
    size?: BallSize;
    /** `solid` for the six winning numbers, `ring` for the additional number. */
    variant?: "solid" | "ring";
    className?: string;
}

// Sizes step down on narrow screens so a hero row never overflows its panel.
const ballSizes: Record<BallSize, string> = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-7 w-7 text-xs",
    md: "h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm",
    lg: "h-9 w-9 text-sm sm:h-11 sm:w-11 sm:text-base",
    xl: "h-9 w-9 text-sm sm:h-14 sm:w-14 sm:text-xl",
};

/** A single TOTO ball: solid red disc for winners, red ring for the additional number. */
export function Ball({ n, size = "md", variant = "solid", className }: BallProps) {
    return (
        <span
            className={cx(
                "grid shrink-0 place-items-center rounded-full font-semibold tabular-nums",
                ballSizes[size],
                variant === "solid" ? "bg-ball text-ball-ink ring-1 ring-line ring-inset" : "border-2 border-accent bg-canvas text-accent",
                className,
            )}
        >
            {n}
        </span>
    );
}

interface BallRowProps {
    /** The 6 winning numbers. */
    numbers: number[];
    /** The additional number, rendered as a red ring. */
    additional?: number | null;
    size?: BallSize;
    className?: string;
}

/**
 * A draw's balls. Announced as one labelled summary so table rows don't read
 * out seven separate cells.
 */
export function BallRow({ numbers, additional = null, size = "md", className }: BallRowProps) {
    const label = additional != null ? `Winning numbers ${numbers.join(", ")}; additional ${additional}` : `Winning numbers ${numbers.join(", ")}`;

    return (
        <div
            className={cx("flex flex-wrap items-center", size === "xs" ? "gap-0.5" : size === "sm" ? "gap-1" : "gap-1.5", className)}
            role="img"
            aria-label={label}
        >
            <span aria-hidden="true" className="contents">
                {numbers.map((n, i) => (
                    <Ball key={`${n}-${i}`} n={n} size={size} />
                ))}
                {additional != null && <Ball n={additional} size={size} variant="ring" />}
            </span>
        </div>
    );
}
