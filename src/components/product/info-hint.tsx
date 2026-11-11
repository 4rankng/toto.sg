import { useState } from "react";

/**
 * Small "?" affordance beside a technical metric. Tap (mobile) or hover
 * (desktop) reveals a plain-English explanation: what the math is and
 * how a player should read it. Keyboard accessible.
 */
export const InfoHint = ({ text, label }: { text: string; label?: string }) => {
    const [open, setOpen] = useState(false);
    return (
        <span className="relative inline-flex items-center">
            <button
                type="button"
                aria-label={label ? `About ${label}` : "About this metric"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onBlur={() => setOpen(false)}
                className="ml-1 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-line text-[8px] font-semibold leading-none text-ink-subtle transition-colors hover:border-accent hover:text-accent-strong"
            >
                ?
            </button>
            {open && (
                <span
                    role="tooltip"
                    className="absolute bottom-full left-1/2 z-50 mb-1.5 w-52 -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-4 tracking-normal text-ink-muted shadow-lg"
                >
                    {text}
                </span>
            )}
        </span>
    );
};

/** Plain-English explanations for the site's technical metrics. */
export const METRIC_HINTS = {
    sum: "All six numbers added together. Most draws land between 115 and 185 — lines outside that band are betting on a rarer draw shape.",
    ac: "Arithmetic Complexity: how many DIFFERENT gaps exist between the six numbers. AC 7-9 is the common crowd; below 7 means the numbers are evenly spaced — historically rare.",
    span: "Biggest number minus smallest. Typical draws span 30-45; a narrow span means all six numbers came from one corner of the board.",
    oddEven: "Count of odd numbers. Most draws show 2-4 odd; an all-odd or all-even line is a long-shot shape bet.",
    tails: "How many different last digits the six numbers have. Six distinct tails = maximum spread; repeated tails (e.g. 12, 22) cluster.",
    consecutive: "Adjacent numbers sitting next to each other (like 46-47). About half of all draws contain at least one pair; three-in-a-row happens in only ~5%.",
    score: "Prize points across every graded draw, log-scaled to 1-100 against a perfect-league ceiling. Higher = better prize history.",
    score100: "Prize points across every graded draw, log-scaled to 1-100 against a perfect-league ceiling. Higher = better prize history.",
    hot: "Recency-weighted prizes: a win last draw counts 1.0, and halves every 100 draws. High hot = winning recently, not just often.",
    rsi14: "RSI-14: a 0-100 momentum gauge borrowed from trading. Above 70 = ball has been drawn unusually often lately (hot streak); below 30 = unusually quiet. In a fair cage both revert — treat as descriptive, not predictive.",
    macd: "MACD: the gap between a short and long moving average of a ball's appearances. Rising = appearing more often than its recent norm. Borrowed from trading; descriptive only.",
    ema: "Exponential Moving Average: a smoothed hit-rate that weights recent draws more. Shows current form versus all-time form.",
    digitalRoot: "Digital root: a number reduced to a single digit by summing (47 → 11 → 2). Groups the board into 9 residue classes; useful for spotting whether one digit class dominates.",
    regimeSpan: "Regime span: how many draws the current pattern (e.g. a hot or cold stretch) has lasted. Long regimes are streaks — the cage has no memory, so ends are unannounced.",
    velocity: "How fast a ball's appearance rate is changing — risers are appearing more often than their own baseline, fallers less.",
    zScore: "How far a count sits from its fair-cage expectation, in standard deviations. Beyond ±2 is notable; beyond ±3 is rare — but with 49 balls, a few outliers are always expected.",
} as const;

export type MetricHintKey = keyof typeof METRIC_HINTS;
