import { useMemo, useState } from "react";
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
    /** Fill the line with the seeded random pick. */
    onQuickPick: () => void;
    /** Empty the line. */
    onClear: () => void;
    /** Copy the line to the clipboard. */
    onCopy: () => void;
    /** Result of the last copy attempt. */
    copyStatus: CopyStatus;
    className?: string;
}

/** The number of winning numbers in a draw. */
const NUMBERS_PER_DRAW = 6;

/** The pool size. */
const POOL_SIZE = 49;

/** Cells are square; the number sits above its appearance count. */
const CELL_CLASS = "relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg text-center transition-colors duration-150";

/** The ramp legend: what the cell colours mean. */
export function HeatLegend({ className }: { className?: string }) {
    return (
        <div className={cx("flex flex-col gap-1.5", className)}>
            <div
                aria-hidden="true"
                className="h-2 w-full rounded-full"
                style={{ backgroundImage: "linear-gradient(to right, var(--color-heat-cold), var(--color-heat-neutral), var(--color-heat-hot))" }}
            />
            <div className="flex items-center justify-between text-xs text-ink-subtle">
                <span>cold · fewer than expected</span>
                <span>as expected</span>
                <span>hot · more than expected</span>
            </div>
        </div>
    );
}

/**
 * The 7×7 board: every number from 1 to 49, heat-coloured by how far its
 * appearance count sits from what a uniform draw would give.
 */
export function NumberBoard({ windows, latestNumbers, line, onToggle, onQuickPick, onClear, onCopy, copyStatus, className }: NumberBoardProps) {
    const [period, setPeriod] = useState(windows[0]?.id ?? "");
    const active = windows.find((window) => window.id === period) ?? windows[0];

    /** Standard deviation of the appearance count under a uniform draw. */
    const deviation = useMemo(() => {
        if (!active) return 1;
        const p = NUMBERS_PER_DRAW / POOL_SIZE;
        return Math.sqrt(Math.max(active.draws * p * (1 - p), 1e-9));
    }, [active]);

    const zOf = (count: number) => (count - (active?.expected ?? 0)) / deviation;

    /** Heat colour: cold below expectation, neutral on it, hot above. */
    const cellColour = (z: number) => {
        const strength = Math.min(1, Math.abs(z) / 3);
        if (strength === 0) return "var(--color-heat-neutral)";
        const target = z > 0 ? "var(--color-heat-hot)" : "var(--color-heat-cold)";
        return `color-mix(in oklab, ${target} ${Math.round(Math.min(strength, 0.88) * 100)}%, var(--color-heat-neutral))`;
    };

    const cellInk = (z: number) => (Math.min(1, Math.abs(z) / 3) > 0.5 ? "text-white" : "text-ink");

    if (!active) return null;

    const chosen = new Set(line);

    return (
        <div className={cx("flex flex-col gap-4", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="Board period" className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
                    {windows.map((window) => (
                        <button
                            key={window.id}
                            type="button"
                            aria-pressed={window.id === active.id}
                            onClick={() => setPeriod(window.id)}
                            className={cx(
                                "min-h-9 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                                window.id === active.id ? "bg-accent text-white" : "text-ink-subtle hover:bg-surface-2 hover:text-ink",
                            )}
                        >
                            {window.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-ink-subtle">
                    {active.draws.toLocaleString("en-SG")} draws · expected {active.expected.toFixed(1)}
                </p>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {active.counts.slice(0, POOL_SIZE).map((count, index) => {
                    const number = index + 1;
                    const z = zOf(count);
                    const selected = chosen.has(number);
                    const isLatest = latestNumbers.includes(number);

                    return (
                        <button
                            key={number}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Number ${number}, ${count} appearances, ${z > 0.05 ? "above" : z < -0.05 ? "below" : "on"} expectation`}
                            onClick={() => onToggle(number)}
                            className={cx(
                                CELL_CLASS,
                                cellInk(z),
                                "border border-transparent",
                                selected ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-surface" : "hover:ring-1 hover:ring-line-strong",
                            )}
                            style={{ backgroundColor: cellColour(z) }}
                        >
                            <span className="font-mono text-sm leading-none font-semibold tabular-nums">{number}</span>
                            <span className="mt-0.5 text-xs leading-none tabular-nums opacity-80">{count}</span>
                            {isLatest && <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-current" />}
                        </button>
                    );
                })}
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-3">
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

                <p aria-live="polite" className="mt-3 text-xs text-ink-subtle">
                    {line.length === 0
                        ? "No numbers chosen yet — tap the board to build a line."
                        : line.length < 6
                          ? `${line.length} of 6 chosen — ${6 - line.length} to go.`
                          : "6 of 6 chosen — re-tap a chosen number to swap it out."}
                </p>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
                    <button
                        type="button"
                        onClick={onQuickPick}
                        className="min-h-10 shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold whitespace-nowrap text-white transition-colors duration-150 hover:bg-accent-strong"
                    >
                        Quick pick
                    </button>
                    <button
                        type="button"
                        onClick={onClear}
                        disabled={line.length === 0}
                        className="min-h-10 shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold whitespace-nowrap text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={onCopy}
                        disabled={line.length === 0}
                        className="min-h-10 shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold whitespace-nowrap text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Copy line
                    </button>
                    {copyStatus !== "idle" && (
                        <span role="status" className="self-center text-xs whitespace-nowrap text-ink-subtle">
                            {copyStatus === "copied" ? "Line copied." : "Copy failed — select the numbers and copy them by hand."}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
