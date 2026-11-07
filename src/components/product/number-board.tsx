import { useMemo, useRef, useState } from "react";
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
}

export type CopyStatus = "idle" | "copied" | "failed";

interface NumberBoardProps {
    /** The windows the reader can compare. */
    windows: BoardWindow[];
    /** The six numbers of the latest draw — marked with a dot. */
    latestNumbers: number[];
    /** The line currently in the builder. */
    line: number[];
    /** Add, remove or swap a number. */
    onToggle: (n: number) => void;
    className?: string;
}

/** The number of winning numbers in a draw. */
const NUMBERS_PER_DRAW = 6;

/** The pool size. */
const POOL_SIZE = 49;

/** Cells are square; the number sits above its appearance count. */
const CELL_CLASS =
    "relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border border-transparent text-ink transition-[background-color,box-shadow] duration-100 ease-linear";

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

/**
 * The 7×7 board: every number from 1 to 49, tinted by how far its appearance
 * count sits from a uniform draw. The tint carries the signal; the text ink is
 * always the same so every count stays readable — the mix is capped at 60%,
 * which keeps ink text above 5:1 in both themes.
 */
export function NumberBoard({ windows, latestNumbers, line, onToggle, className }: NumberBoardProps) {
    const [period, setPeriod] = useState(windows[0]?.id ?? "");
    const active = windows.find((window) => window.id === period) ?? windows[0];
    const gridRef = useRef<HTMLDivElement>(null);
    const [roving, setRoving] = useState(0);

    /** Standard deviation of the appearance count under a uniform draw. */
    const deviation = useMemo(() => {
        if (!active) return 1;
        const p = NUMBERS_PER_DRAW / POOL_SIZE;
        return Math.sqrt(Math.max(active.draws * p * (1 - p), 1e-9));
    }, [active]);

    const zOf = (count: number) => (count - (active?.expected ?? 0)) / deviation;

    /**
     * Heat: a tint toward the hot/cold end, 6%–60% of the ramp. Below 0.35
     * standard deviations the cell stays neutral — a count within noise should
     * look like noise instead of a faint pastel.
     */
    const cellColour = (z: number) => {
        const strength = Math.min(1, Math.max(0, (Math.abs(z) - 0.35) / 2.2));
        if (strength === 0) return "var(--color-heat-neutral)";
        const mix = Math.round(6 + strength * 54);
        const target = z > 0 ? "var(--color-heat-hot)" : "var(--color-heat-cold)";
        return `color-mix(in oklab, ${target} ${mix}%, var(--color-heat-neutral))`;
    };

    if (!active) return null;

    const chosen = new Set(line);

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
                <div role="group" aria-label="Board period" className="inline-flex items-center gap-0.5 rounded-lg bg-surface-inset p-0.5">
                    {windows.map((window) => (
                        <button
                            key={window.id}
                            type="button"
                            aria-pressed={window.id === active.id}
                            onClick={() => setPeriod(window.id)}
                            className={cx(
                                "min-h-8 rounded-md px-2.5 text-[11px] font-semibold transition-colors duration-100",
                                window.id === active.id ? "bg-surface text-ink shadow-xs ring-1 ring-line/70" : "text-ink-subtle hover:text-ink",
                            )}
                        >
                            {window.label}
                        </button>
                    ))}
                </div>
                <p className="font-mono text-[11px] text-ink-subtle tabular-nums">
                    {active.draws.toLocaleString("en-SG")} draws · expected {active.expected.toFixed(1)}
                </p>
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
                    const z = zOf(count);
                    const selected = chosen.has(number);
                    const isLatest = latestNumbers.includes(number);
                    const isExtreme = Math.abs(z) >= 2;

                    return (
                        <button
                            key={number}
                            type="button"
                            data-number={number}
                            tabIndex={index === roving ? 0 : -1}
                            aria-pressed={selected}
                            aria-label={`Number ${number}, ${count} appearances, ${z > 0.05 ? "above" : z < -0.05 ? "below" : "on"} expectation`}
                            onClick={() => onToggle(number)}
                            onFocus={() => setRoving(index)}
                            className={cx(
                                CELL_CLASS,
                                selected
                                    ? "border-accent ring-2 ring-accent ring-inset"
                                    : "hover:ring-1 hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                            )}
                            style={{ backgroundColor: cellColour(z) }}
                        >
                            <span className="font-mono text-sm leading-none font-semibold tabular-nums">{number}</span>
                            <span className="mt-0.5 text-[10px] leading-none tabular-nums opacity-70">{count}</span>
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
    onQuickPick: () => void;
    onClear: () => void;
    onCopy: () => void;
    copyStatus: CopyStatus;
    className?: string;
}

/**
 * The line builder. It sits beside the board rather than under it, so the
 * grid stays the tallest thing in the row and the action is never buried
 * below the fold.
 */
export function LineSlip({ line, onQuickPick, onClear, onCopy, copyStatus, className }: LineSlipProps) {
    return (
        <div className={cx("flex flex-col gap-3", className)}>
            <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 6 }, (_, index) => {
                    const number = line[index];

                    return (
                        <div
                            key={index}
                            className={cx(
                                "grid aspect-square place-items-center rounded-lg border text-sm font-semibold tabular-nums",
                                number === undefined ? "border-dashed border-line-strong text-ink-faint" : "border-accent bg-accent text-white",
                            )}
                        >
                            {number ?? "–"}
                        </div>
                    );
                })}
            </div>

            <p aria-live="polite" className="text-[11px] leading-4 text-ink-subtle">
                {line.length === 0
                    ? "Tap the board to build a line."
                    : line.length < 6
                      ? `${line.length} of 6 chosen — ${6 - line.length} to go.`
                      : "6 of 6 chosen — re-tap a chosen number to swap it out."}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onClick={onQuickPick}
                    className="min-h-9 rounded-lg bg-accent px-3 text-xs font-semibold whitespace-nowrap text-white transition-colors duration-100 hover:bg-accent-strong"
                >
                    Quick pick
                </button>
                <button
                    type="button"
                    onClick={onClear}
                    disabled={line.length === 0}
                    className="min-h-9 rounded-lg border border-line bg-surface px-3 text-xs font-semibold whitespace-nowrap text-ink-muted transition-colors duration-100 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Clear
                </button>
                <button
                    type="button"
                    onClick={onCopy}
                    disabled={line.length === 0}
                    className="min-h-9 rounded-lg border border-line bg-surface px-3 text-xs font-semibold whitespace-nowrap text-ink-muted transition-colors duration-100 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Copy
                </button>
                {copyStatus !== "idle" && (
                    <span role="status" className="text-[11px] leading-4 text-ink-subtle">
                        {copyStatus === "copied" ? "Copied." : "Copy failed — copy manually."}
                    </span>
                )}
            </div>

            <p className="border-t border-line/70 pt-2.5 text-[11px] leading-4 text-ink-subtle">
                Quick pick draws a fresh, exactly-uniform line every tap — Web Crypto randomness with bias-free sampling.
            </p>
        </div>
    );
}
