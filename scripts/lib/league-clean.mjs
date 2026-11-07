// toto.sg — one definition of "placeholder litter" for the strategy league.
//
// Rows have been hand-added to public/data/strategies.json in batches. Some
// of those batches never produced a real line: they reused the same
// placeholder pick [8,22,30,32,46,48] (which scores 95 main hits over the last
// 100 era draws) while claiming scores of 60–91, and the newest batch also
// shipped the placeholder description "Documented strategy.". Such rows are
// duplicates of each other and of nothing in the real league, so every script
// that writes league rows drops them.
//
// The five research-pipeline rows that historically shared that pick
// (fibCount1, quickpick, lastDigitFreq, ensemble, consecCap) fall under the
// same rule now: without a rule of their own in this repo their current pick
// cannot be made distinct, and a league that compares lines cannot carry
// twenty rows playing the same six numbers.

// Placeholder ids replaced by scripts/strategies-custom.mjs with its own rows.
export const PLACEHOLDER_IDS = [
    "mod9Root7", "matrixPeak", "pmArb", "payHotCold", "weekdayLadder", "zHubMomentum",
    "tail6Distinct", "pairNeutral", "mod9Cover", "ladderAnchor", "zeroRepZeroConsec",
    "residueColdHigh", "velocitySurf", "antiCalendarFortress", "acMaxEntropy",
    "tail2Resonance", "dualRuns",
];

export const PLACEHOLDER_PICK = [8, 22, 30, 32, 46, 48];
export const PLACEHOLDER_DESCRIPTION = "Documented strategy.";

/** True when a league row is litter rather than a scored strategy. */
export const isPlaceholderRow = (row) =>
    PLACEHOLDER_IDS.includes(row.id) ||
    row.description?.trim() === PLACEHOLDER_DESCRIPTION ||
    (Array.isArray(row.currentPick) &&
        row.currentPick.length === PLACEHOLDER_PICK.length &&
        PLACEHOLDER_PICK.every((n) => row.currentPick.includes(n)));
