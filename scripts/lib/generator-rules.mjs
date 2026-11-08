// toto.sg — the deterministic generator rules (user spec, wave 1).
//
// Each rule is attempt(prior, rng) → sorted 6-number line, or null to reject.
// All randomness flows through the injected rng (seeded per strategy+draw by
// the shared evaluator), so reruns are byte-identical. The two payout-tilted
// rules from the original spec (coldHighTilt, residueColdHybrid) are not part
// of the league: the league's goal is match count, not payout optimisation.
import {
    MOD9_CLASSES,
    RANGE49,
    TAIL_CLASSES,
    acValue,
    consecPairs,
    lineSum,
    oddCount,
    sampleK,
    sortAsc,
} from "./cross-panel-stats.mjs";

export const GENERATOR_STRATEGIES = [
    ["mod9Coverage", "Mod-9 Residue Coverage", "Sum Band", "Draws one number from each of six different mod-9 residue classes — the one structural audit the randomness panels flag — and repairs the sum into the 115–185 band."],
    ["acLock8", "AC Lock at 8", "Structure", "Rejects lines until Arithmetic Complexity is exactly 8 (13 distinct pairwise differences), the historical centre of line complexity, with sum 120–179 and 2–4 odd numbers."],
    ["sixTails", "Six Distinct Tail Digits", "Pattern", "Forces six different last digits — tighter than the modal 5-distinct-endings regime — rejecting lines with more than one consecutive pair or sum below 115."],
    ["medianLadder", "Median-Ladder Span Anchor", "Structure", "Samples each sorted position from a narrow window around its empirical order-statistic median and accepts only spans of 36–43."],
    ["noRepeatClean", "Zero Repeat, Zero Consecutive", "Structure", "Excludes all six numbers of the previous draw and every adjacent pair, keeping the sum inside 115–185 — a line structurally unlike the last result."],
    ["repulsionExclusion", "Repulsion-Pair Exclusion", "Pairs", "Avoids both extremes of the 49×49 pair matrix — the strong repulsion pairs and the crowd-chased attraction pairs — with at most one consecutive pair."],
    ["gapGradient", "Gap-Gradient Construction", "Structure", "Builds the line from gaps upward — one small (1–3), one large (9–14), three medium (4–8) gaps summing to a 33–40 span — matching the empirical delta profile."],
    ["quantileBand", "Sorted-Position Quantile Band", "Structure", "Samples each sorted position from a quantile band around its historical median, rejecting extreme parity (0, 1, 5 or 6 odd) and sums below 115."],
];

/** Pair-exclusion table: strong negative then strong positive co-occurrence extremes. */
const REPULSION_PAIRS = [
    [27, 45],
    [14, 34],
    [16, 19],
    [8, 23],
    [19, 39], // strong negative
    [2, 15],
    [5, 49],
    [8, 17],
    [15, 40],
    [25, 28], // strong positive (crowd-chased)
];

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export const GENERATOR_RULES = {
    mod9Coverage(prior, rng) {
        const line = sampleK(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], 6).map((r) => {
            const cls = MOD9_CLASSES[r];
            return cls[Math.floor(rng() * cls.length)]; // ball 49 ≡ 4 (mod 9)
        });
        line.sort((a, b) => a - b);
        for (let step = 0; step < 10000; step++) {
            const sum = lineSum(line);
            if (sum >= 115 && sum <= 185) return line;
            const raise = sum < 115;
            let repaired = false;
            // Walk candidates smallest-first (raising) / largest-first (lowering);
            // skip numbers whose residue class offers no move toward the band.
            const order = raise ? line.map((_, i) => i) : line.map((_, i) => line.length - 1 - i);
            for (const idx of order) {
                const cls = MOD9_CLASSES[line[idx] % 9].filter((n) => (raise ? n > line[idx] : n < line[idx]));
                if (cls.length === 0) continue;
                line[idx] = cls[Math.floor(rng() * cls.length)]; // strictly moves toward the band
                repaired = true;
                break;
            }
            if (!repaired) return null;
            line.sort((a, b) => a - b);
        }
        return null;
    },

    acLock8(prior, rng) {
        const line = sortAsc(sampleK(rng, RANGE49, 6));
        if (acValue(line) !== 8) return null;
        const sum = lineSum(line);
        if (sum < 120 || sum > 179) return null;
        if (oddCount(line) < 2 || oddCount(line) > 4) return null;
        return line;
    },

    sixTails(prior, rng) {
        const line = sampleK(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 6).map((d) => {
            const cls = TAIL_CLASSES[d];
            return cls[Math.floor(rng() * cls.length)];
        });
        line.sort((a, b) => a - b);
        if (consecPairs(line) > 1) return null;
        if (lineSum(line) < 115) return null;
        return line;
    },

    medianLadder(prior, rng) {
        const bands = [
            [3, 7],
            [12, 18],
            [18, 24],
            [27, 33],
            [36, 42],
            [43, 48],
        ];
        const line = bands.map(([lo, hi]) => randInt(rng, lo, hi));
        for (let i = 1; i < line.length; i++) if (line[i] <= line[i - 1]) return null;
        const span = line[5] - line[0];
        if (span < 36 || span > 43) return null;
        return line;
    },

    noRepeatClean(prior, rng) {
        const prev = prior[prior.length - 1].numbers;
        const pool = RANGE49.filter((n) => !prev.includes(n));
        const line = sortAsc(sampleK(rng, pool, 6));
        if (consecPairs(line) > 0) return null;
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    repulsionExclusion(prior, rng) {
        const line = sortAsc(sampleK(rng, RANGE49, 6));
        for (const [x, y] of REPULSION_PAIRS) if (line.includes(x) && line.includes(y)) return null;
        if (consecPairs(line) > 1) return null;
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },

    gapGradient(prior, rng) {
        const smallSlot = randInt(rng, 0, 4);
        let largeSlot = randInt(rng, 0, 4);
        while (largeSlot === smallSlot) largeSlot = randInt(rng, 0, 4);
        const gaps = [];
        for (let i = 0; i < 5; i++) {
            if (i === smallSlot) gaps.push(randInt(rng, 1, 3));
            else if (i === largeSlot) gaps.push(randInt(rng, 9, 14));
            else gaps.push(randInt(rng, 4, 8));
        }
        const span = lineSum(gaps);
        if (span < 33 || span > 40) return null;
        const start = randInt(rng, 1, 10);
        const line = [start];
        for (const g of gaps) line.push(line[line.length - 1] + g);
        if (line[5] > 49) return null;
        return line; // strictly increasing by construction
    },

    quantileBand(prior, rng) {
        const bands = [
            [4, 8],
            [12, 18],
            [18, 25],
            [26, 34],
            [35, 42],
            [42, 48],
        ];
        const line = bands.map(([lo, hi]) => randInt(rng, lo, hi));
        for (let i = 1; i < line.length; i++) if (line[i] <= line[i - 1]) return null;
        const odds = oddCount(line);
        if (odds === 0 || odds === 1 || odds === 5 || odds === 6) return null;
        if (lineSum(line) < 115) return null;
        return line;
    },
};
