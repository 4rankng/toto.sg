// toto.sg — live ticket X-ray & historical-archive backtester component.
//
// Reads the active play slip line (System 6/7/8) in plain words and shows
// everything on screen at once — no tabs.
import { formatSgd } from "@/lib/data";
import { type TicketXRayResult } from "@/lib/ticket-xray";
import { cx } from "@/utils/cx";

interface TicketXRayProps {
    balls: number[];
    result: TicketXRayResult | null;
    className?: string;
    onApplyConsensus?: () => void;
}

export function TicketXRay({ balls, result, className, onApplyConsensus }: TicketXRayProps) {

    if (balls.length < 6 || !result) {
        return (
            <div className={cx("rounded-xl border border-line bg-surface/80 p-4 backdrop-blur-sm", className)}>
                <div className="flex items-center justify-between text-xs text-text-subtle mb-2">
                    <span className="font-semibold uppercase tracking-wider text-text">Ticket X-Ray Engine</span>
                    <span>{balls.length} / 6 balls tapped</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                    Tap {6 - balls.length} more {balls.length === 5 ? "ball" : "balls"} (or up to 8 for System 7/8) to engage the indicator scan and 1,892-draw combinatorial backtest.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
        compositionFlags,
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
                        {combinations} {combinations === 1 ? "combination" : "combinations"} ({formatSgd(stakeSgd)} per draw)
                    </span>
                </div>
            </div>

            <div className="mt-4 space-y-4">
                {/* The line, in plain words */}
                <section>
                    <p className="text-[10px] font-semibold tracking-[0.1em] text-text-subtle uppercase">Your line, in plain words</p>
                    <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-text-muted">
                        <li>
                            The numbers add up to <strong className="font-mono font-semibold text-text">{Math.round(meanSum)}</strong> — heavier than {sumPercentile}% of past winning lines.
                        </li>
                        <li>
                            Spread score <strong className={cx("font-mono font-semibold", acValue >= 7 ? "text-primary" : "text-text")}>{acValue} / 10</strong> — {acValue >= 7 ? "nicely scattered across the board" : "the numbers sit somewhat close together"}.
                        </li>
                        <li>
                            Smallest to biggest number: <strong className="font-mono font-semibold text-text">{span}</strong> apart.
                        </li>
                        <li>
                            <strong className="font-mono font-semibold text-text">
                                {oddCount} odd, {systemSize - oddCount} even
                            </strong>{" "}
                            — and {highCount} of them are high numbers (25–49).
                        </li>
                        <li>
                            <strong className="font-mono font-semibold text-text">{distinctTails} different last digits</strong>, covering {distinctDecades} of the five number groups (1–10, 11–20, 21–30, 31–40, 41–49).
                        </li>
                        <li>
                            All digits added together leave <strong className="font-mono font-semibold text-text">{digitalRoot}</strong>.
                        </li>
                    </ul>
                    {compositionFlags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            {compositionFlags.map((flag, idx) => {
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
                </section>

                {/* What the bots think */}
                <section>
                    <p className="text-[10px] font-semibold tracking-[0.1em] text-text-subtle uppercase">What the bots think</p>
                    <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-text-muted">
                        <li>
                            <strong className="font-mono font-semibold text-text">{botVoteOverlap}</strong> bot votes include these numbers.
                        </li>
                        {closestStrategy && (
                            <li>
                                Your line looks most like <strong className="font-semibold text-text">{closestStrategy.name}</strong> — {closestStrategy.matchCount} of 6 numbers shared.
                            </li>
                        )}
                    </ul>
                </section>

                {/* Replayed history */}
                <section>
                    <p className="text-[10px] font-semibold tracking-[0.1em] text-text-subtle uppercase">If you had played this exact line before</p>
                    <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-text-muted">
                        <li>
                            Over the last <strong className="font-mono font-semibold text-text">{backtest.totalDraws}</strong> draws it would have won a prize{" "}
                            <strong className="font-mono font-semibold text-text">
                                {backtest.winningDraws} times ({((backtest.winningDraws / backtest.totalDraws) * 100).toFixed(1)}%)
                            </strong>
                            .
                        </li>
                        {backtest.bestMatch && (
                            <li>
                                Best night: draw <strong className="font-mono font-semibold text-text">{backtest.bestMatch.draw}</strong> ({backtest.bestMatch.date}) — {backtest.bestMatch.matched} balls matched
                                {backtest.bestMatch.hasAdditional ? ", plus the additional ball" : ""}.
                            </li>
                        )}
                    </ul>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 text-center font-mono text-[11px]">
                        <div className="rounded bg-surface-3 py-1 border border-line/50">
                            <span className="text-[10px] text-text-subtle block">Big prizes (G1–G3)</span>
                            <span className="font-semibold text-gold">{(backtest.tierCounts.g1 || 0) + (backtest.tierCounts.g2 || 0) + (backtest.tierCounts.g3 || 0)}</span>
                        </div>
                        <div className="rounded bg-surface-3 py-1 border border-line/50">
                            <span className="text-[10px] text-text-subtle block">G4</span>
                            <span className="font-semibold text-text">{backtest.tierCounts.g4 || 0}</span>
                        </div>
                        <div className="rounded bg-surface-3 py-1 border border-line/50">
                            <span className="text-[10px] text-text-subtle block">G5</span>
                            <span className="font-semibold text-text">{backtest.tierCounts.g5 || 0}</span>
                        </div>
                        <div className="rounded bg-surface-3 py-1 border border-line/50">
                            <span className="text-[10px] text-text-subtle block">Small prizes (G6–G7)</span>
                            <span className="font-semibold text-text">{(backtest.tierCounts.g6 || 0) + (backtest.tierCounts.g7 || 0)}</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
