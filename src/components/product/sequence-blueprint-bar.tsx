// toto.sg — interactive sequence blueprint bar for /insights.
//
// Directly bound to LineBuilderProvider (`useLineBuilder()`). Allows the viewer
// to tap candidate balls from any analytics panel, inspect the sequence live
// against the 8 structural sweet-spot filters, and load it into the Play Slip in one click.

import { useMemo } from "react";
import { Link } from "react-router";
import type { Draw, StrategiesFile } from "@/lib/data";
import {
    evaluateCandidateLineEnvelope,
    type MasterConfluenceBoardStats,
    type LatestDrawTriggerStats,
    type GreedyCoverageStats,
} from "@/lib/insights-sequence-blueprint";
import { LINE_SIZES, type LineSize, useLineBuilder } from "@/providers/line-builder-provider";
import { cx } from "@/utils/cx";

interface SequenceBlueprintBarProps {
    latestDraw?: Draw;
    confluence?: MasterConfluenceBoardStats;
    followers?: LatestDrawTriggerStats;
    greedy?: GreedyCoverageStats;
    league?: StrategiesFile;
    className?: string;
}

export function SequenceBlueprintBar({
    latestDraw,
    confluence,
    followers,
    greedy,
    league,
    className,
}: SequenceBlueprintBarProps) {
    const { line, size, setSize, toggle, setLine, clear } = useLineBuilder();

    const evaluation = useMemo(() => {
        return evaluateCandidateLineEnvelope(line, latestDraw);
    }, [line, latestDraw]);

    // Compute 54-bot consensus line
    const botConsensusLine = useMemo(() => {
        if (!league) return [];
        const tally = new Uint8Array(50);
        for (const s of league.strategies) {
            for (const b of s.currentPick) {
                if (b >= 1 && b <= 49) tally[b] += 1;
            }
        }
        const sorted = Array.from({ length: 49 }, (_, i) => i + 1).sort((a, b) => tally[b] - tally[a]);
        return sorted.slice(0, size).sort((a, b) => a - b);
    }, [league, size]);

    const handleLoadConfluence = () => {
        if (!confluence) return;
        const candidate = size === 8
            ? confluence.top8CandidatePool
            : size === 7
                ? confluence.rankedBalls.slice(0, 7).map((r) => r.number).sort((a, b) => a - b)
                : confluence.top6ConfluenceLine;
        setLine(candidate);
    };

    const handleLoadFollowers = () => {
        if (!followers) return;
        const candidate = followers.topFollowers.slice(0, size).map((f) => f.number).sort((a, b) => a - b);
        setLine(candidate);
    };

    const handleLoadGreedy = () => {
        if (!greedy) return;
        const candidate = size === 8 ? greedy.greedy8BallPool : greedy.greedy6BallLine;
        setLine(candidate);
    };

    const handleLoadBotConsensus = () => {
        if (botConsensusLine.length > 0) setLine(botConsensusLine);
    };

    return (
        <section
            aria-label="Sequence Blueprint Console"
            className={cx(
                "sticky top-3 z-30 mb-6 rounded-2xl border border-line bg-surface/95 backdrop-blur-md p-3.5 shadow-float sm:p-4",
                className,
            )}
        >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Left: Active Line Slots & Entry Size */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-inset px-2 py-1 text-xs">
                        <span className="font-mono text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">
                            System
                        </span>
                        {LINE_SIZES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setSize(s as LineSize)}
                                className={cx(
                                    "rounded px-1.5 py-0.5 font-mono text-xs font-semibold transition-colors",
                                    size === s
                                        ? "bg-primary text-canvas"
                                        : "text-ink-subtle hover:text-ink",
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Ball Slots */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {Array.from({ length: size }).map((_, idx) => {
                            const val = line[idx];
                            return val !== undefined ? (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => toggle(val)}
                                    title={`Remove ball ${val}`}
                                    className="group relative flex h-7.5 w-7.5 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-canvas transition-transform hover:scale-105 hover:bg-heat-hot"
                                >
                                    {val}
                                    <span className="absolute -top-1 -right-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-surface text-[8px] text-ink shadow group-hover:flex">
                                        ×
                                    </span>
                                </button>
                            ) : (
                                <div
                                    key={idx}
                                    className="flex h-7.5 w-7.5 items-center justify-center rounded-full border border-dashed border-line font-mono text-[11px] text-ink-faint"
                                >
                                    {idx + 1}
                                </div>
                            );
                        })}
                    </div>

                    {/* Clear Button */}
                    {line.length > 0 && (
                        <button
                            type="button"
                            onClick={clear}
                            className="font-mono text-[11px] text-ink-subtle hover:text-ink underline transition-colors"
                        >
                            Clear ({line.length}/{size})
                        </button>
                    )}
                </div>

                {/* Right: Quick Seed Presets & Play Slip Handoff */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-ink-subtle uppercase tracking-wider">
                        Quick Seed:
                    </span>
                    {confluence && (
                        <button
                            type="button"
                            onClick={handleLoadConfluence}
                            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] font-medium text-ink hover:border-primary transition-colors"
                        >
                            8-Signal Top
                        </button>
                    )}
                    {followers && (
                        <button
                            type="button"
                            onClick={handleLoadFollowers}
                            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] font-medium text-ink hover:border-primary transition-colors"
                        >
                            Lag-1 Followers
                        </button>
                    )}
                    {greedy && (
                        <button
                            type="button"
                            onClick={handleLoadGreedy}
                            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] font-medium text-ink hover:border-primary transition-colors"
                        >
                            Greedy 2+
                        </button>
                    )}
                    {league && (
                        <button
                            type="button"
                            onClick={handleLoadBotConsensus}
                            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] font-medium text-ink hover:border-primary transition-colors"
                        >
                            54-Bot
                        </button>
                    )}

                    <Link
                        to="/"
                        className={cx(
                            "ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs font-semibold transition-all",
                            line.length >= 6
                                ? "bg-primary text-canvas shadow hover:opacity-90"
                                : "border border-line bg-surface-inset text-ink-subtle hover:text-ink",
                        )}
                    >
                        <span>Play Slip</span>
                        <span>→</span>
                    </Link>
                </div>
            </div>

            {/* Live Structural Sweet-Spot Envelope Row */}
            {line.length >= 6 && (
                <div className="mt-3 border-t border-line/70 pt-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span
                                className={cx(
                                    "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                                    evaluation.verdict === "Optimal Sweet-Spot"
                                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                        : evaluation.verdict === "Viable"
                                            ? "bg-surface-3 text-ink ring-1 ring-line"
                                            : "bg-heat-hot/15 text-heat-hot ring-1 ring-heat-hot/30",
                                )}
                            >
                                {evaluation.verdict} ({evaluation.totalPassed}/8 Passed)
                            </span>
                            <span className="hidden sm:inline font-mono text-[11px] text-ink-subtle">
                                (Historical 7+/8 draw capture: ~81.4%)
                            </span>
                        </div>

                        {/* Filter Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {evaluation.filters.map((f) => (
                                <span
                                    key={f.id}
                                    title={`${f.label}: ${f.currentValue} (Target: ${f.targetRange})`}
                                    className={cx(
                                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors",
                                        f.passed
                                            ? "bg-surface-2 text-ink border border-line"
                                            : "bg-heat-hot/10 text-heat-hot border border-heat-hot/30",
                                    )}
                                >
                                    {f.label}: {f.currentValue}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Adjustment Tips if any filter failed */}
                    {evaluation.adjustments.length > 0 && (
                        <p className="mt-1.5 font-mono text-[11px] text-ink-subtle">
                            💡 <span className="text-ink">{evaluation.adjustments[0]}</span>
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}

/**
 * Clickable ball chip for indicator panels.
 * Tapping toggles the ball inside the global LineBuilderProvider line.
 */
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
                    ? "border-primary bg-primary text-canvas shadow-sm"
                    : "border-line bg-surface hover:border-primary hover:bg-surface-2 text-ink",
                className,
            )}
        >
            {rank !== undefined && (
                <span
                    className={cx(
                        "text-[9px] font-bold uppercase",
                        isSelected ? "text-canvas/80" : "text-ink-subtle",
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
                        isSelected ? "text-canvas/90" : "text-ink-muted",
                    )}
                >
                    {score}
                </span>
            )}
            {sublabel && (
                <span
                    className={cx(
                        "text-[9px]",
                        isSelected ? "text-canvas/80" : "text-ink-subtle",
                    )}
                >
                    {sublabel}
                </span>
            )}
        </button>
    );
}
