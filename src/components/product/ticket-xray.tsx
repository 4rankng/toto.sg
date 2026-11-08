// toto.sg — live ticket X-ray & 1,892-draw historical archive backtester component.
//
// Displays the 8-metric indicator grid, crowd collision tags, and combinatorial
// multi-tier backtest results for the active play slip line (System 6/7/8).
import { useState } from "react";
import { formatSgd, formatSigned } from "@/lib/data";
import { type TicketXRayResult } from "@/lib/ticket-xray";
import { cx } from "@/utils/cx";

interface TicketXRayProps {
    balls: number[];
    result: TicketXRayResult | null;
    className?: string;
    onClear?: () => void;
    onApplyAntiCrowd?: () => void;
    onApplyConsensus?: () => void;
}

export function TicketXRay({
    balls,
    result,
    className,
    onClear: _onClear,
    onApplyAntiCrowd,
    onApplyConsensus,
}: TicketXRayProps) {
    const [tab, setTab] = useState<"diagnostics" | "backtest">("diagnostics");

    if (balls.length < 6 || !result) {
        return (
            <div className={cx("rounded-xl border border-line bg-surface/80 p-4 backdrop-blur-sm", className)}>
                <div className="flex items-center justify-between text-xs text-text-subtle mb-2">
                    <span className="font-semibold uppercase tracking-wider text-text">Ticket X-Ray Engine</span>
                    <span>{balls.length} / 6 balls tapped</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                    Tap {6 - balls.length} more {balls.length === 5 ? "ball" : "balls"} (or up to 8 for System 7/8) to engage the 8-metric indicator scan, Group 3 crowd-tax estimate, and 1,892-draw combinatorial backtest.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {onApplyAntiCrowd && (
                        <button
                            type="button"
                            onClick={onApplyAntiCrowd}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                        >
                            <span>⚡ +EV Anti-Crowd</span>
                        </button>
                    )}
                    {onApplyConsensus && (
                        <button
                            type="button"
                            onClick={onApplyConsensus}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary hover:bg-secondary/20 transition-colors"
                        >
                            <span>🤖 Bot Consensus</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const {
        systemSize,
        combinations,
        stakeSgd,
        meanSum,
        sumPercentile,
        acValue,
        span,
        oddCount,
        highCount,
        distinctTails,
        distinctDecades,
        digitalRoot,
        estimatedG3Share,
        crowdDeltaPct,
        crowdFlags,
        botVoteOverlap,
        closestStrategy,
        backtest,
    } = result;

    return (
        <div className={cx("rounded-xl border border-line bg-surface/90 p-4 backdrop-blur-md shadow-sm select-none", className)}>
            {/* Header: System label, cost, and presets */}
            <div className="flex items-center justify-between pb-3 border-b border-line gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-secondary/15 px-2 py-0.5 text-xs font-semibold text-secondary ring-1 ring-inset ring-secondary/30">
                        {systemSize === 6 ? "Ordinary Line" : `System ${systemSize}`}
                    </span>
                    <span className="text-xs text-text-subtle font-mono">
                        {combinations} comb ({formatSgd(stakeSgd)})
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setTab("diagnostics")}
                        className={cx(
                            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                            tab === "diagnostics"
                                ? "bg-surface-3 text-text font-semibold shadow-xs"
                                : "text-text-subtle hover:text-text hover:bg-surface-2",
                        )}
                    >
                        Indicators
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("backtest")}
                        className={cx(
                            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                            tab === "backtest"
                                ? "bg-surface-3 text-text font-semibold shadow-xs"
                                : "text-text-subtle hover:text-text hover:bg-surface-2",
                        )}
                    >
                        Backtest
                    </button>
                </div>
            </div>

            {tab === "diagnostics" ? (
                <div className="mt-3 space-y-3">
                    {/* 8-Metric Indicator Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {/* 1. Sum */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Sum Band</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className="font-semibold text-text text-sm">{Math.round(meanSum)}</span>
                                <span className="text-[10px] text-text-subtle">p{sumPercentile}</span>
                            </div>
                        </div>

                        {/* 2. AC Complexity */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">AC Value</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className={cx("font-semibold text-sm", acValue >= 7 ? "text-primary" : "text-heat-hot")}>
                                    {acValue}
                                </span>
                                <span className="text-[10px] text-text-subtle">/ 10</span>
                            </div>
                        </div>

                        {/* 3. Span */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Line Span</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className="font-semibold text-text text-sm">{span}</span>
                                <span className="text-[10px] text-text-subtle">range</span>
                            </div>
                        </div>

                        {/* 4. Parity & Half */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Odd / High</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className="font-semibold text-text text-sm">{oddCount}O {systemSize - oddCount}E</span>
                                <span className="text-[10px] text-text-subtle">· {highCount}H</span>
                            </div>
                        </div>

                        {/* 5. Tails / Decades */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Diversity</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className="font-semibold text-text text-sm">{distinctTails}T</span>
                                <span className="text-[10px] text-text-subtle">· {distinctDecades}D</span>
                            </div>
                        </div>

                        {/* 6. Digital Root */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Digital Root</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className="font-semibold text-text text-sm">{digitalRoot}</span>
                                <span className="text-[10px] text-text-subtle">mod 9</span>
                            </div>
                        </div>

                        {/* 7. Est. G3 EV */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Est. G3 Share</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className={cx("font-semibold text-sm", crowdDeltaPct >= 0 ? "text-primary" : "text-heat-hot")}>
                                    {formatSgd(estimatedG3Share)}
                                </span>
                                <span className="text-[10px] text-text-subtle">{formatSigned(crowdDeltaPct, 0)}%</span>
                            </div>
                        </div>

                        {/* 8. Bot Votes */}
                        <div className="rounded-lg border border-line/60 bg-surface-2/50 p-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider block">Bot Overlap</span>
                            <div className="flex items-baseline gap-1 mt-0.5 font-mono">
                                <span className="font-semibold text-text text-sm">{botVoteOverlap}</span>
                                <span className="text-[10px] text-text-subtle">votes</span>
                            </div>
                        </div>
                    </div>

                    {/* Crowd Flags & Shield Tags */}
                    {crowdFlags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {crowdFlags.map((flag, idx) => {
                                const toneClass = flag.tone === "primary"
                                    ? "bg-primary/10 text-primary border-primary/30"
                                    : flag.tone === "secondary"
                                        ? "bg-secondary/10 text-secondary border-secondary/30"
                                        : flag.tone === "gold"
                                            ? "bg-gold/15 text-gold border-gold/30"
                                            : flag.tone === "down"
                                                ? "bg-heat-hot/10 text-heat-hot border-heat-hot/30"
                                                : "bg-surface-3 text-text-subtle border-line";

                                return (
                                    <span
                                        key={idx}
                                        title={flag.hint}
                                        className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium cursor-help", toneClass)}
                                    >
                                        {flag.label}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Bot Consensus Affinity */}
                    {closestStrategy && (
                        <div className="flex items-center justify-between text-xs text-text-subtle bg-surface-2/30 rounded-lg px-2.5 py-1.5 border border-line/50">
                            <span>Closest Strategy:</span>
                            <span className="font-medium text-text">
                                {closestStrategy.name} ({closestStrategy.matchCount}/6 match)
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-3 space-y-3">
                    {/* Backtest 1,892-Draw Performance */}
                    <div className="rounded-lg border border-line/60 bg-surface-2/40 p-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-text-subtle">1,892-Draw Hit Rate</span>
                            <span className="font-semibold text-text font-mono">
                                {backtest.winningDraws} wins ({((backtest.winningDraws / backtest.totalDraws) * 100).toFixed(1)}%)
                            </span>
                        </div>

                        {/* Tier Breakdown Badges */}
                        <div className="grid grid-cols-4 gap-1.5 mt-2.5 text-center font-mono text-[11px]">
                            <div className="rounded bg-surface-3/80 py-1 border border-line/50">
                                <span className="text-[10px] text-text-subtle block">G1–G3</span>
                                <span className="font-semibold text-gold">
                                    {(backtest.tierCounts.g1 || 0) + (backtest.tierCounts.g2 || 0) + (backtest.tierCounts.g3 || 0)}
                                </span>
                            </div>
                            <div className="rounded bg-surface-3/80 py-1 border border-line/50">
                                <span className="text-[10px] text-text-subtle block">G4</span>
                                <span className="font-semibold text-text">
                                    {backtest.tierCounts.g4 || 0}
                                </span>
                            </div>
                            <div className="rounded bg-surface-3/80 py-1 border border-line/50">
                                <span className="text-[10px] text-text-subtle block">G5</span>
                                <span className="font-semibold text-text">
                                    {backtest.tierCounts.g5 || 0}
                                </span>
                            </div>
                            <div className="rounded bg-surface-3/80 py-1 border border-line/50">
                                <span className="text-[10px] text-text-subtle block">G6–G7</span>
                                <span className="font-semibold text-text">
                                    {(backtest.tierCounts.g6 || 0) + (backtest.tierCounts.g7 || 0)}
                                </span>
                            </div>
                        </div>

                        {/* Best Historical Match */}
                        {backtest.bestMatch && (
                            <div className="mt-3 pt-2.5 border-t border-line/50 flex items-center justify-between text-xs">
                                <span className="text-text-subtle">Best Match:</span>
                                <span className="font-medium text-primary">
                                    Draw {backtest.bestMatch.draw} ({backtest.bestMatch.date}): {backtest.bestMatch.matched} balls {backtest.bestMatch.hasAdditional ? "+ Add'l" : ""}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
