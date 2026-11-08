import { type CSSProperties, useRef, useState } from "react";
import { LINE_SIZES, type LineSize } from "@/providers/line-builder-provider";
import { cx } from "@/utils/cx";

/** One window of the board: a period and the appearance counts it covers. */
export interface BoardWindow {
    id: string;
    label: string;
    /** Appearance count per number; index 0 is number 1. */
    counts: number[];
    /** Expected appearances per number over the window. */
    expected: number;
    /** Draws in the window. */
    draws: number;
    /** Formatted display value per cell (e.g. "RSI 62", "Skip 14", "EV +18%"). */
    displayValues?: string[];
    /** Precomputed z-score or normalized distance [-3..+3] per ball. */
    zScores?: number[];
    /** Descriptive summary strip (e.g. "1,238 draws · Wilder RSI-14 oscillator"). */
    summary?: string;
}

/** The number of winning numbers in a draw. */
const NUMBERS_PER_DRAW = 6;

/** The pool size. */
const POOL_SIZE = 49;

/** Standard deviation of a number's appearance count under a uniform draw. */
export const boardDeviation = (window: BoardWindow) => {
    const p = NUMBERS_PER_DRAW / POOL_SIZE;
    return Math.sqrt(Math.max(window.draws * p * (1 - p), 1e-9));
};

/**
 * Heat tint for one number in a window: 6%–60% of the ramp. Counts within
 * 0.35 standard deviations stay neutral — a gap inside the noise should not
 * read as a colour.
 */
export const heatColour = (window: BoardWindow, number: number) => {
    let z = 0;
    if (window.zScores && window.zScores[number - 1] !== undefined) {
        z = window.zScores[number - 1];
    } else {
        const count = window.counts[number - 1] ?? 0;
        z = (count - window.expected) / boardDeviation(window);
    }
    const strength = Math.min(1, Math.max(0, (Math.abs(z) - 0.35) / 2.2));
    if (strength === 0) return "var(--color-heat-neutral)";
    const mix = Math.round(6 + strength * 54);
    const target = z > 0 ? "var(--color-heat-hot)" : "var(--color-heat-cold)";
    return `color-mix(in oklab, ${target} ${mix}%, var(--color-heat-neutral))`;
};

/** Deeper tone of the same heat ramp — the ring around a slip ball, so the
 *  ring stays visible over the pastel fill. */
export const heatRingColour = (window: BoardWindow, number: number) => {
    let z = 0;
    if (window.zScores && window.zScores[number - 1] !== undefined) {
        z = window.zScores[number - 1];
    } else {
        const count = window.counts[number - 1] ?? 0;
        z = (count - window.expected) / boardDeviation(window);
    }
    const strength = Math.min(1, Math.max(0, (Math.abs(z) - 0.35) / 2.2));
    if (strength === 0) return "color-mix(in srgb, var(--color-ink) 30%, transparent)";
    const mix = Math.round(35 + strength * 50);
    const target = z > 0 ? "var(--color-heat-hot)" : "var(--color-heat-cold)";
    return `color-mix(in oklab, ${target} ${mix}%, var(--color-heat-neutral))`;
};

/** The ramp legend: what the cell colours mean. */
export function HeatLegend({ className }: { className?: string }) {
    return (
        <div className={cx("flex flex-col gap-1", className)}>
            <div
                aria-hidden="true"
                className="h-1.5 w-full rounded-full"
                style={{ backgroundImage: "linear-gradient(to right, var(--color-heat-cold), var(--color-heat-neutral), var(--color-heat-hot))" }}
            />
            <div className="flex items-center justify-between text-[11px] leading-4 text-ink-subtle">
                <span>cold</span>
                <span>even</span>
                <span>hot</span>
            </div>
        </div>
    );
}

interface NumberBoardProps {
    /** The windows the reader can compare. */
    windows: BoardWindow[];
    /** The active window id — owned by the page so the play slip can share the tint. */
    period: string;
    onPeriodChange: (id: string) => void;
    /** The six numbers of the latest draw — marked with a dot. */
    latestNumbers: number[];
    /** The line currently in the builder. */
    line: number[];
    /** Add, remove or swap a number. */
    onToggle: (n: number) => void;
    /** Fill the line with a quick pick. */
    onQuickPick?: () => void;
    /** The strategy a quick pick came from, shown as feedback. */
    quickPickLabel?: string | null;
    className?: string;
}

/** Cells are square; the number sits above its appearance count. */
const CELL_CLASS =
    "relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border border-transparent text-ink transition-[background-color,box-shadow] duration-100 ease-linear";

/**
 * The 7×7 board: every number from 1 to 49, tinted by how far its appearance
 * count sits from a uniform draw. The tint carries the signal; the text ink is
 * always the same so every count stays readable.
 */
export function NumberBoard({ windows, period, onPeriodChange, latestNumbers, line, onToggle, onQuickPick, quickPickLabel, className }: NumberBoardProps) {
    const active = windows.find((window) => window.id === period) ?? windows[0];
    const gridRef = useRef<HTMLDivElement>(null);
    const [roving, setRoving] = useState(0);

    if (!active) return null;

    const chosen = new Set(line);
    const deviation = boardDeviation(active);
    const zOf = (count: number) => (count - active.expected) / deviation;

    const focusCell = (index: number) => {
        const next = Math.min(Math.max(index, 0), POOL_SIZE - 1);
        setRoving(next);
        gridRef.current?.querySelector<HTMLButtonElement>(`[data-number="${next + 1}"]`)?.focus();
    };

    /** Roving tabindex: one Tab stop, arrows walk the grid. */
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        let next = roving;

        switch (event.key) {
            case "ArrowRight":
                next = roving + 1;
                break;
            case "ArrowLeft":
                next = roving - 1;
                break;
            case "ArrowUp":
                next = roving - 7;
                break;
            case "ArrowDown":
                next = roving + 7;
                break;
            case "Home":
                next = 0;
                break;
            case "End":
                next = POOL_SIZE - 1;
                break;
            default:
                return;
        }

        event.preventDefault();
        focusCell(next);
    };

    return (
        <div className={cx("flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* The lens row wraps rather than scrolls: a half-visible
                    "RSI" tab at 1024–1279px read as a clipped label and hid
                    the last two lenses behind an invisible scroller. */}
                <div role="group" aria-label="Board lens" className="flex min-w-0 max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-surface-inset p-0.5">
                    {windows.map((window) => (
                        <button
                            key={window.id}
                            type="button"
                            aria-pressed={window.id === active.id}
                            onClick={() => onPeriodChange(window.id)}
                            className={cx(
                                "min-h-8 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition-colors duration-100",
                                window.id === active.id ? "bg-surface text-ink shadow-xs ring-1 ring-line/70" : "text-ink-subtle hover:text-ink",
                            )}
                        >
                            {window.label}
                        </button>
                    ))}
                </div>
                {onQuickPick && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onQuickPick}
                            className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold whitespace-nowrap text-white transition-colors duration-100 hover:bg-accent-strong dark:text-canvas"
                        >
                            Quick pick
                        </button>
                        {quickPickLabel && (
                            <p aria-live="polite" className="text-[11px] leading-4 text-ink-subtle">
                                From <span className="text-ink-muted">{quickPickLabel}</span>
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div
                ref={gridRef}
                role="group"
                aria-label="Number board — use the arrow keys to move between numbers"
                onKeyDown={handleKeyDown}
                className="grid grid-cols-7 gap-1 sm:gap-1.5"
            >
                {active.counts.slice(0, POOL_SIZE).map((count, index) => {
                    const number = index + 1;
                    const z = active.zScores?.[index] !== undefined ? active.zScores[index] : zOf(count);
                    const selected = chosen.has(number);
                    const isLatest = latestNumbers.includes(number);
                    const isExtreme = Math.abs(z) >= 2;
                    const displayVal = active.displayValues?.[index] ?? String(count);

                    return (
                        <button
                            key={number}
                            type="button"
                            data-number={number}
                            tabIndex={index === roving ? 0 : -1}
                            aria-pressed={selected}
                            aria-label={`Number ${number}, ${displayVal}, ${z > 0.05 ? "above" : z < -0.05 ? "below" : "on"} expectation`}
                            onClick={() => onToggle(number)}
                            onFocus={() => setRoving(index)}
                            className={cx(
                                CELL_CLASS,
                                selected
                                    ? "border-accent ring-2 ring-accent ring-inset"
                                    : "hover:ring-1 hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                            )}
                            style={{ backgroundColor: heatColour(active, number) }}
                        >
                            <span className="font-mono text-sm leading-none font-semibold tabular-nums">{number}</span>
                            <span className="mt-0.5 text-[10px] leading-none tabular-nums opacity-70 truncate max-w-full px-0.5">{displayVal}</span>
                            {isLatest && <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-ink" />}
                            {isExtreme && (
                                <span
                                    aria-hidden="true"
                                    className="absolute bottom-1 left-1 size-1 rounded-full"
                                    style={{ backgroundColor: z > 0 ? "var(--color-heat-hot)" : "var(--color-heat-cold)" }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Play slip
 * ------------------------------------------------------------------ */

interface LineSlipProps {
    line: number[];
    /** 6, 7 or 8 numbers — Ordinary, System 7 or System 8. */
    size: LineSize;
    /** Heat tint for one number — same ramp the board cells wear. */
    colourOf: (n: number) => string;
    /** Deeper tone of the same ramp — the ring around a slip ball. */
    ringOf: (n: number) => string;
    onSizeChange: (size: LineSize) => void;
    onQuickPick: () => void;
    /** The strategy a quick pick came from, shown as feedback. */
    quickPickLabel?: string | null;
    className?: string;
}

/**
 * The line builder. Slots take the heat tint of the number they hold, so the
 * slip and the board read as one surface. System 6, 7 and 8 are supported.
 */
export function LineSlip({ line, size, colourOf, ringOf, onSizeChange, onQuickPick, quickPickLabel, className }: LineSlipProps) {
    return (
        <div className={cx("flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="Line size" className="inline-flex items-center gap-0.5 rounded-lg bg-surface-inset p-0.5">
                    {LINE_SIZES.map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={size === option}
                            onClick={() => onSizeChange(option)}
                            className={cx(
                                "min-h-8 rounded-md px-2 text-[11px] font-semibold transition-colors duration-100",
                                size === option ? "bg-surface text-ink shadow-xs ring-1 ring-line/70" : "text-ink-subtle hover:text-ink",
                            )}
                        >
                            {option === 6 ? "Ordinary" : `System ${option}`}
                        </button>
                    ))}
                </div>
                <span className="font-mono text-[11px] text-ink-subtle tabular-nums">
                    {line.length}/{size}
                </span>
            </div>

            <div className="slip-rack grid w-full" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
                {Array.from({ length: size }, (_, index) => {
                    const number = line[index];

                    return (
                        <div key={index} className="grid aspect-square @container place-items-center">
                            {number === undefined ? (
                                <span className="grid aspect-square w-[88%] place-items-center rounded-full border border-dashed border-line-strong font-mono text-[34cqi] leading-none font-semibold text-ink-faint tabular-nums">
                                    –
                                </span>
                            ) : (
                                <span
                                    key={number}
                                    className="slip-ball aspect-square w-[88%]"
                                    style={
                                        {
                                            "--slip-c": ringOf(number),
                                            "--slip-fill": colourOf(number),
                                            "--slip-d": `${index * 90}ms`,
                                        } as CSSProperties
                                    }
                                >
                                    <i>{number}</i>
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={onQuickPick}
                    className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold whitespace-nowrap text-white transition-colors duration-100 hover:bg-accent-strong dark:text-canvas"
                >
                    Quick pick
                </button>
                {quickPickLabel && (
                    <p aria-live="polite" className="text-[11px] leading-4 text-ink-subtle">
                        From <span className="text-ink-muted">{quickPickLabel}</span>
                        {size > 6 ? ` + ${size - 6} random` : ""}
                    </p>
                )}
            </div>
        </div>
    );
}
