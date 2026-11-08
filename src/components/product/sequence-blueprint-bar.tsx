// toto.sg — clickable ball chip for the insights indicator panels.
//
// Bound to LineBuilderProvider (`useLineBuilder()`): tapping a chip toggles
// that ball in the shared line, which the home page's play slip renders.

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
                "group relative inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs transition-all",
                isSelected
                    ? "border-primary bg-accent text-white dark:text-canvas shadow-sm"
                    : "border-line bg-surface hover:border-primary hover:bg-surface-2 text-ink",
                className,
            )}
        >
            {rank !== undefined && (
                <span
                    className={cx(
                        "text-[9px] font-bold uppercase",
                        isSelected ? "text-white/80 dark:text-canvas/80" : "text-ink-subtle",
                    )}
                >
                    #{rank}
                </span>
            )}
            <span className="font-bold tabular-nums">{number}</span>
            {score !== undefined && (
                <span
                    className={cx(
                        "text-[10px] tabular-nums",
                        isSelected ? "text-white/90 dark:text-canvas/90" : "text-ink-muted",
                    )}
                >
                    {score}
                </span>
            )}
            {sublabel && (
                <span
                    className={cx(
                        "text-[9px]",
                        isSelected ? "text-white/80 dark:text-canvas/80" : "text-ink-subtle",
                    )}
                >
                    {sublabel}
                </span>
            )}
        </button>
    );
}
