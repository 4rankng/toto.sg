import { cx } from "@/utils/cx";

export type BallSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

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
    xs: "size-5 text-[11px]",
    sm: "size-7 text-xs",
    md: "size-8 text-xs sm:size-9 sm:text-sm",
    lg: "size-9 text-sm sm:size-11 sm:text-base",
    xl: "size-9 text-sm sm:size-12 sm:text-lg",
    "2xl": "size-10 text-base sm:size-12 sm:text-lg md:size-14 md:text-xl",
};

/**
 * A single TOTO ball: a soft white disc for the winning numbers, an accent
 * ring for the additional number. The inset ring keeps the disc visible on
 * both the tinted canvas and a white panel.
 */
export function Ball({ n, size = "md", variant = "solid", className }: BallProps) {
    return (
        <span
            className={cx(
                "grid shrink-0 place-items-center rounded-full font-semibold tabular-nums",
                ballSizes[size],
                variant === "solid"
                    ? "bg-ball text-ball-ink shadow-xs ring-1 ring-line/80 ring-inset"
                    : "border-2 border-accent bg-canvas text-accent",
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
    /** The additional number, rendered as a ring. */
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
