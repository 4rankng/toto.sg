// toto.sg — evaluate and upsert 24 deterministic indicator & gambler strategies.
// Run via `npm run league:indicators` (or `npm run league`).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { evaluateStrategy, FOLDS } from "./lib/league-eval.mjs";
import { filterEra, nextDrawDateIso } from "./lib/analysis.mjs";
import { isPlaceholderRow } from "./lib/league-clean.mjs";
import { INDICATOR_RULES, buildIndicatorFoldStats } from "./lib/indicator-rules.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));

const INDICATOR_STRATEGIES = [
    {
        id: "rsi14Reversal",
        name: "Wilder RSI-14 Mean-Reversion Oversold",
        family: "Indicators",
        description: "Picks from the oversold RSI-14 tier (<42) with line sum locked to 130–185 and Arithmetic Complexity ≥ 7.",
    },
    {
        id: "rsi14TrendBreakout",
        name: "Wilder RSI-14 Momentum Breakout",
        family: "Indicators",
        description: "Harnesses high relative strength (RSI ≥ 54) with a broad 4+ decade spread to avoid cluster clustering.",
    },
    {
        id: "macdBullCross",
        name: "MACD 12/26/9 Acceleration Crossover",
        family: "Indicators",
        description: "Captures positive MACD histogram divergence where short-term exponential velocity outpaces long-term trend.",
    },
    {
        id: "bollingerMeanRevert",
        name: "Bollinger 20-Draw Counter-Sum Channel",
        family: "Indicators",
        description: "Adaptive sum channel: targets lower sum (115–148) after upper-band exhaustion, and upper sum (152–188) after lower troughs.",
    },
    {
        id: "emaGoldenRibbon",
        name: "EMA 8/34 Golden Ribbon Spread",
        family: "Indicators",
        description: "Ranks balls by EMA-8 minus EMA-34 ribbon spread with high Arithmetic Complexity sieve (AC ≥ 7).",
    },
    {
        id: "hazardPeakWindow",
        name: "Kaplan-Meier Hazard Peak Window",
        family: "Indicators",
        description: "Invests in empirical hazard peaks at skip 0 (repeaters) and skip 5–11; vetoes overdue balls past 22 draws.",
    },
    {
        id: "fanoClockwork",
        name: "Fano Clockwork Interval Regularity",
        family: "Indicators",
        description: "Filters for balls exhibiting clockwork cycle regularity (skips near 6–11 draws) with at most one adjacent pair.",
    },
    {
        id: "hurstRegimeAdapter",
        name: "Hurst Exponent Variance-Ratio Sieve",
        family: "Indicators",
        description: "Sum-variance regime filter requiring centered sum (125–175) and at least 5 distinct ending digits.",
    },
    {
        id: "cusumDriftCounter",
        name: "CUSUM Structural Drift Counter-Tilt",
        family: "Indicators",
        description: "Enforces 3 odd / 3 even parity with modal span (36–44) to correct cumulative sum drift.",
    },
    {
        id: "atrVolatilityChannel",
        name: "ATR Volatility Envelope Target",
        family: "Indicators",
        description: "Pins candidate line sum within ±0.8 standard deviations of the 20-draw mean with AC ≥ 8.",
    },
    {
        id: "zScoreMultiHorizon",
        name: "Multi-Horizon (10d & 50d) Z-Confluence",
        family: "Indicators",
        description: "Demands positive standardized velocity residual simultaneously across 10-draw and 50-draw horizons.",
    },
    {
        id: "togelMistikLama",
        name: "Togel Mistik Lama Echo Sieve",
        family: "Folk & Culture",
        description: "Applies traditional Southeast Asian Mistik Lama permutation (0↔1, 2↔5, 3↔8, 4↔7, 6↔9) to previous draw winners.",
    },
    {
        id: "togelMistikBaru",
        name: "Togel Mistik Baru Shadow Sieve",
        family: "Folk & Culture",
        description: "Applies Mistik Baru shadow shifts (0↔8, 1↔7, 2↔6, 3↔9, 4↔5) with AC ≥ 8 complexity protection.",
    },
    {
        id: "togelIndeksTaysen",
        name: "Togel Indeks & Taysen Bridge",
        family: "Folk & Culture",
        description: "Indeks (±5 mod 10) transform on previous winners combined with anti-crowd high anchors 34, 40, 42, 47.",
    },
    {
        id: "markSixHalfWaveBal",
        name: "Mark Six 6-Half-Wave Balance",
        family: "Mark Six Charts",
        description: "Picks exactly 1 ball from each of the six Colour × Parity half-waves (Red-Odd, Red-Even, Blue-Odd, Blue-Even, Green-Odd, Green-Even).",
    },
    {
        id: "ganzhiStemHarmony",
        name: "Ganzhi Stem Day-Regime Harmony",
        family: "Almanac & Time",
        description: "Calendar-conditional alignment targeting Monday velocity leaders (18, 23, 34, 39, 47) or Thursday anchors (4, 11, 20, 42, 46).",
    },
    {
        id: "kellyAntiCrowdEv",
        name: "Kelly Anti-Crowd EV Shield",
        family: "Pari-mutuel",
        description: "Bans double-calendar balls (≤12), superstition digit-8 balls (8, 18, 28, 38, 48), and slip diagonals to protect solo Group 3 shares.",
    },
    {
        id: "post31Fortress",
        name: "Post-31 High Payout Fortress",
        family: "Pari-mutuel",
        description: "Five balls strictly above 31 with one bridge ball in 19–31; zero consecutive pairs and sum ≥ 185.",
    },
    {
        id: "doubleCalendarVeto",
        name: "Double-Calendar Anti-Crush Sieve",
        family: "Pari-mutuel",
        description: "Complete veto of the crowded 1–12 zone (birth month & day overlap); exactly two in 13–31 and four in 32–49.",
    },
    {
        id: "markovLag1Lift",
        name: "Markov Lag-1 Directed Transition Lift",
        family: "Sequence",
        description: "Harvests empirical 49×49 directed Markov transition counts following the previous draw's winning numbers.",
    },
    {
        id: "couponSweepCompleter",
        name: "Coupon-Collector 49-Ball Sweep Completer",
        family: "Gap & Due",
        description: "Pairs unseen balls from the active 25-draw sweep with short-term velocity leaders to catch the tail of the cycle.",
    },
    {
        id: "cliqueHarmonyTriad",
        name: "Positive Co-Occurrence Clique Triad",
        family: "Pairs",
        description: "Greedy graph clique filtering: picks high-frequency balls with AC ≥ 8 and no arithmetic progressions.",
    },
    {
        id: "orderStatQuantileLock",
        name: "Hypergeometric Order-Statistic Quantile Lock",
        family: "Structure",
        description: "Pins each sorted position x_(1)..x_(6) into its theoretical hypergeometric interquartile range with sum 140–165.",
    },
    {
        id: "multiFactorQuant6",
        name: "Multi-Factor 6-Quant Composite Scorecard",
        family: "Ensemble",
        description: "Linear combination of RSI-14, 10-draw velocity residual, 50-draw velocity, and long-term frequency.",
    },
];

async function main() {
    const draws = JSON.parse(await readFile(`${DATA_DIR}draws.json`, "utf8"));
    const league = JSON.parse(await readFile(`${DATA_DIR}strategies.json`, "utf8"));

    const expectedHits = league.meta?.chance?.expectedHitsPerLine;
    if (typeof expectedHits !== "number") throw new Error("strategies.json: meta.chance.expectedHitsPerLine missing");

    const era = filterEra(draws);
    if (era.length < FOLDS + 1) throw new Error(`era too short for ${FOLDS} folds: ${era.length}`);
    const foldStart = era.length - FOLDS;
    const nextDrawNo = era[era.length - 1].draw + 1;
    const nextTarget = { draw: nextDrawNo, date: nextDrawDateIso(era[era.length - 1].date) };

    const prepare = (prior, target) => buildIndicatorFoldStats(prior, target);

    const newRows = INDICATOR_STRATEGIES.map((strategy) => {
        const ruleFn = INDICATOR_RULES[strategy.id];
        if (!ruleFn) throw new Error(`Missing indicator rule: ${strategy.id}`);
        return evaluateStrategy(
            {
                id: strategy.id,
                name: strategy.name,
                family: strategy.family,
                description: strategy.description,
                rule: (prior, target, rng, stats) => ruleFn(prior, target, rng, stats),
            },
            era,
            foldStart,
            expectedHits,
            { prepare, nextTarget },
        );
    });

    // Merge: drop placeholder litter, upsert indicator rows
    const kept = league.strategies.filter((row) => !isPlaceholderRow(row));
    const byId = new Map(kept.map((row) => [row.id, row]));
    for (const row of newRows) byId.set(row.id, row);

    const ranked = [...byId.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    ranked.forEach((row, i) => {
        row.rank = i + 1;
    });
    league.strategies = ranked;

    const familiesSet = new Set(league.meta.families);
    familiesSet.add("Indicators");
    league.meta.families = Array.from(familiesSet).sort((a, b) => a.localeCompare(b));
    league.meta.generatedAt = new Date(Date.now() + 8 * 3600e3).toISOString().replace("Z", "+08:00");
    league.meta.nextDraw = nextDrawNo;

    await writeFile(`${DATA_DIR}strategies.json`, JSON.stringify(league, 1), "utf8");
    console.log(`✓ strategies-indicators: upserted ${newRows.length} indicator strategies. Total league: ${league.strategies.length} strategies.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
