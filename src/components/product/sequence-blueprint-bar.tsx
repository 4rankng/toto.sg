// toto.sg — clickable ball chip for the insights indicator panels.
//
// Bound to LineBuilderProvider (`useLineBuilder()`): tapping a chip toggles
// that ball in the shared line, which the home page's play slip renders.

import type { CSSProperties } from "react";

import { useLineBuilder } from "@/providers/line-builder-provider";
import { cx } from "@/utils/cx";

interface CandidateBallChipProps {
    number: number;
    sublabel?: string;
    score?: string | number;
    rank?: number;
    className?: string;
}

export function CandidateBallChip({
    number,
    sublabel,
    score,
    rank,
    className,
}: CandidateBallChipProps) {
    const { line, toggle } = useLineBuilder();
    const isSelected = line.includes(number);

    return (
        <button
            type="button"
            onClick={() => toggle(number)}
            title={`Toggle ball ${number} in sequence builder`}
            className={cx(
                "inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 font-mono text-xs transition-all hover:opacity-90",
                className,
            )}
        >
            <span
                className="slip-ball size-9 shrink-0"
                style={
                    {
                        "--slip-c": isSelected ? "var(--color-accent)" : "var(--color-line-strong)",
                        "--slip-fill": isSelected
                            ? "color-mix(in srgb, var(--color-accent) 18%, var(--color-surface))"
                            : "var(--color-surface)",
                    } as CSSProperties
                }
            >
                <i>{number}</i>
            </span>
            {rank !== undefined && (
                <span className="text-[9px] font-bold uppercase text-ink-subtle">#{rank}</span>
            )}
            {score !== undefined && (
                <span className="text-[10px] tabular-nums text-ink-muted">{score}</span>
            )}
            {sublabel && (
                <span className="text-[9px] text-ink-subtle">{sublabel}</span>
            )}
        </button>
    );
}
