// toto.sg — regenerate the custom portion of the strategy league. `npm run league:custom`.
//
// Adds 20 custom strategies (10 curated fixed lines + 10 deterministic generator
// rules) with honestly computed walk-forward metrics, removes the 6 placeholder
// "owner custom six" rows, re-ranks every row and rewrites the committed league
// artifact. Idempotent: reruns upsert the same 20 ids and leave the 204 pipeline
// rows' fields untouched (only `rank` is reassigned league-wide).
//
// Documented choices (the original research pipeline left the repo):
//   - effPrizes = totalPrizes for custom rows. Only 1 of the 210 pre-existing
//     rows diverges between the two counts and the divergence rule is
//     unrecoverable, so the honest reading is that they coincide.
//   - score is a least-squares fit against the 204 pipeline rows
//     (20.4 + 7.8*z + 5.5*effPrizes + 0.6*recent12, mean |error| ≈ 1.5 points).
//     Near-chance rows land around 26–35, matching the observed pipeline rows,
//     so the UI's chance-baseline-45 framing stays meaningful.
//   - The 10 fixed lines are hindsight-curated and evaluated as-is across all
//     100 folds; the league's public disclaimer already frames scores as
//     descriptive, not predictive.
//
// Determinism: every generator draws randomness ONLY from
// rngFor(id, drawNo) = mulberry32(fnv1a(`${id}:${drawNo}`)) — reruns are
// byte-identical apart from meta.generatedAt.
//
// Output format: JSON.stringify(league, 1), no trailing newline (matches the
// committed artifact byte-for-byte).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { scoreLine } from "./lib/toto.mjs";
import { filterEra } from "./lib/analysis.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));
const FOLDS = 100; // matches meta.folds
const STAKE_PER_DRAW = 1; // S$1 Ordinary
const REJECT_CAP = 10000; // per draw; a cap hit means a bug in the rule encoding
// Placeholder rows to remove. All are hand-added litter sharing the identical
// pick [8,22,30,32,46,48] (which actually scores 95 main hits on the last 100
// era draws while these rows claim 60–91 or carry score:null) — duplicates of
// each other and of nothing in the real league. Five research-pipeline rows
// (fibCount1, quickpick, lastDigitFreq, ensemble, consecCap) also happen to
// hold that pick but predate the placeholders in the committed 204-row
// artifact and are left untouched, like every other pipeline row.
const PLACEHOLDER_IDS = [
    "mod9Root7", "matrixPeak", "pmArb", "payHotCold", "weekdayLadder", "zHubMomentum",
    "tail6Distinct", "pairNeutral", "mod9Cover", "ladderAnchor", "zeroRepZeroConsec",
    "residueColdHigh", "velocitySurf", "antiCalendarFortress", "acMaxEntropy",
    "tail2Resonance", "dualRuns",
];

// ---------------------------------------------------------------------------
// Seeded RNG — mulberry32 + FNV-1a string hash (same pattern as the original
// pipeline's scripts/lib/strategies.mjs at 6009183).
// ---------------------------------------------------------------------------
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

const rngFor = (id, drawNo) => mulberry32(fnv1a(`${id}:${drawNo}`));

// ---------------------------------------------------------------------------
// Sampling helpers
// ---------------------------------------------------------------------------
const RANGE49 = Array.from({ length: 49 }, (_, i) => i + 1);
const sortAsc = (arr) => [...arr].sort((a, b) => a - b);

/** Uniform integer in [lo, hi] inclusive. */
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** Uniform k-subset of `pool` via partial Fisher–Yates (unordered semantics). */
function sampleK(rng, pool, k) {
    const a = [...pool];
    for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (a.length - i));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
}

// ---------------------------------------------------------------------------
// Line predicates
// ---------------------------------------------------------------------------
const lineSum = (line) => line.reduce((acc, n) => acc + n, 0);
const oddCount = (line) => line.filter((n) => n % 2 === 1).length;
const consecPairs = (line) => {
    let c = 0;
    for (let i = 1; i < line.length; i++) if (line[i] === line[i - 1] + 1) c++;
    return c;
};
/** AC = distinct pairwise absolute differences − 5 (the 6-number line ceiling is 10). */
function acValue(line) {
    const diffs = new Set();
    for (let i = 0; i < line.length; i++)
        for (let j = i + 1; j < line.length; j++) diffs.add(Math.abs(line[i] - line[j]));
    return diffs.size - 5;
}
const numbersWithResidue = (r) => RANGE49.filter((n) => n % 9 === r);
const numbersWithTail = (d) => RANGE49.filter((n) => n % 10 === d);

// ---------------------------------------------------------------------------
// The 10 curated fixed lines (TOTO_10_Custom_Strategies_and_Sequences.docx).
// Evaluated verbatim across all folds; descriptions copied verbatim.
// ---------------------------------------------------------------------------
const FIXED_STRATEGIES = [
    {
        id: "evTetraphobia",
        name: "Pari-Mutuel EV & Tetraphobia",
        family: "Pari-mutuel",
        pick: [4, 18, 34, 39, 42, 47],
        description:
            "Curated line: four digit-4 balls (04, 34, 42, 47) for the tetraphobia payout premium, anchored by #1 payout ball 47; only two calendar numbers (04, 18); pairs Skip-0 repeat 34 with 50-draw surge leader 39. Sum 184 at the top of the 72% band.",
    },
    {
        id: "zScoreHub",
        name: "Z-Score Hub & Momentum Bridge",
        family: "Pairs",
        pick: [8, 11, 17, 22, 36, 48],
        description:
            "Curated line: hub ball 08 links top pairs 08–17 (+3.35σ) and 08–11, plus 22–36 (27 draws); bridges all-time leaders 08 and 22 with the hottest surges 48 (4 hits in 10 draws) and 11 (+5.9). Sum 142, AC 9.",
    },
    {
        id: "bellCurvePeak",
        name: "Bell-Curve & Matrix Peak",
        family: "Structure",
        pick: [6, 18, 23, 24, 35, 49],
        description:
            "Curated line: sits on the 3-odd/2-high composition-matrix peak (+1.2%), embeds the #1 triplet 06–18–35 (8 hits vs 1.34 expected) and consecutive pair 23–24 (20 hits), anchored by 163-hit ball 49. Sum 155 near the 150 median, modal span 43.",
    },
    {
        id: "decadeTwinAnchor",
        name: "Decade Dispersion & Twin Anchors",
        family: "Structure",
        pick: [5, 12, 21, 30, 40, 49],
        description:
            "Curated line: one ball in each decade plus two in the 40s; locks pairs 05–49 (+3.60σ) and 21–30 (27 draws) around all-time leaders 40 (174 hits), 49 (163) and 12 (161). Sum 157.",
    },
    {
        id: "velocitySurfer",
        name: "Short-Term Velocity Surfer",
        family: "Momentum",
        pick: [7, 11, 23, 33, 39, 48],
        description:
            "Curated line: the six strongest 10–50 draw surges — 48 (4 hits in 10), 39 (+6.9), 11 (+5.9), 33 (+3.9), 07 (+2.9), 23 (+2.9). Sum 161 inside the peak 150–179 tier, five distinct tails.",
    },
    {
        id: "antiCalendar",
        name: "Anti-Calendar Fortress",
        family: "Pari-mutuel",
        pick: [13, 32, 37, 41, 44, 47],
        description:
            "Curated line: five post-calendar numbers (≥32) plus Skip-0 repeat 13; three digit-4 balls (41, 44, 47) with #1 payout ball 47; sum 214 rides the sum-to-payout slope (r = +0.58) where ticket density is thinnest.",
    },
    {
        id: "skip0Echo",
        name: "Skip-0 Double Echo & All-Time Core",
        family: "Gap & Due",
        pick: [6, 13, 15, 22, 36, 40],
        description:
            "Curated line: carries two repeats from Draw 4232 (06, 13) into the two most frequent balls — 15 (177 hits) and 40 (174), themselves a +3.09σ pair — plus 166-hit ball 22 and its top partner 36. Sum 132.",
    },
    {
        id: "maxEntropy",
        name: "Max Entropy & Bonus Bridge",
        family: "Structure",
        pick: [3, 10, 20, 32, 39, 46],
        description:
            "Curated line: all 15 pairwise differences unique (AC = 10, the ceiling); converts Draw 4232's additional ball 20 into a main pick, embeds triplet 03–10–32 (7 hits), surge leader 39 and #3 hot ball 46. Sum 150 dead-center.",
    },
    {
        id: "tailDigit2",
        name: "Tail-Digit 2 Resonance",
        family: "Pattern",
        pick: [2, 12, 15, 22, 32, 46],
        description:
            "Curated line: four decades of tail-2 balls (02, 12, 22, 32) around the #1 most frequent ending digit, locked to the top Z-score pair 02–15 (+3.85σ) and #3 hot ball 46. Sum 129.",
    },
    {
        id: "dualConsecRun",
        name: "Dual Consecutive-Run Synergizer",
        family: "Pattern",
        pick: [8, 15, 16, 23, 48, 49],
        description:
            "Curated line: the ~9% two-pair regime via the #1 consecutive run 48–49 (21 draws, uniting surge 48 with 163-hit 49) and 15–16 (19 draws), anchored by hub 08 and riser 23. Sum 159.",
    },
];

// ---------------------------------------------------------------------------
// The 10 deterministic generator rules. Each attempt(prior, rng) returns a
// sorted 6-number line, or null to reject. All randomness flows through rng.
// ---------------------------------------------------------------------------
const COLD_SET = [13, 20, 31, 34, 40, 45]; // least crowd-picked, per the spec
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

const GENERATOR_RULES = {
    mod9Coverage(prior, rng) {
        const line = sampleK(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], 6).map((r) => {
            const cls = numbersWithResidue(r);
            return cls[Math.floor(rng() * cls.length)]; // ball 49 ≡ 4 (mod 9)
        });
        line.sort((a, b) => a - b);
        for (let step = 0; step < REJECT_CAP; step++) {
            const sum = lineSum(line);
            if (sum >= 115 && sum <= 185) return line;
            const raise = sum < 115;
            let repaired = false;
            // Walk candidates smallest-first (raising) / largest-first (lowering);
            // skip numbers whose residue class offers no move toward the band.
            const order = raise ? line.map((_, i) => i) : line.map((_, i) => line.length - 1 - i);
            for (const idx of order) {
                const cls = numbersWithResidue(line[idx] % 9).filter((n) =>
                    raise ? n > line[idx] : n < line[idx],
                );
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
            const cls = numbersWithTail(d);
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

    coldHighTilt(prior, rng) {
        const core = sampleK(rng, COLD_SET, 3);
        const pool = RANGE49.filter((n) => !core.includes(n));
        const rest = sampleK(rng, pool, 3);
        if (rest.filter((n) => n > 31).length < 2) return null;
        const line = sortAsc([...core, ...rest]);
        if (oddCount(line) < 2 || oddCount(line) > 4) return null;
        const sum = lineSum(line);
        if (sum < 140 || sum > 180) return null;
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

    residueColdHybrid(prior, rng) {
        const core = sampleK(rng, COLD_SET, 2);
        const pool = RANGE49.filter((n) => !core.includes(n));
        const rest = sampleK(rng, pool, 4);
        const line = sortAsc([...core, ...rest]);
        if (new Set(line.map((n) => n % 9)).size < 5) return null;
        if (line.filter((n) => n > 31).length < 3) return null;
        if (oddCount(line) < 2 || oddCount(line) > 4) return null;
        const sum = lineSum(line);
        if (sum < 135 || sum > 185) return null;
        return line;
    },
};

const GENERATOR_STRATEGIES = [
    ["mod9Coverage", "Mod-9 Residue Coverage", "Sum Band", "Draws one number from each of six different mod-9 residue classes — the one structural audit the randomness panels flag — and repairs the sum into the 115–185 band."],
    ["acLock8", "AC Lock at 8", "Structure", "Rejects lines until Arithmetic Complexity is exactly 8 (13 distinct pairwise differences), the historical centre of line complexity, with sum 120–179 and 2–4 odd numbers."],
    ["sixTails", "Six Distinct Tail Digits", "Pattern", "Forces six different last digits — tighter than the modal 5-distinct-endings regime — rejecting lines with more than one consecutive pair or sum below 115."],
    ["medianLadder", "Median-Ladder Span Anchor", "Structure", "Samples each sorted position from a narrow window around its empirical order-statistic median and accepts only spans of 36–43."],
    ["noRepeatClean", "Zero Repeat, Zero Consecutive", "Structure", "Excludes all six numbers of the previous draw and every adjacent pair, keeping the sum inside 115–185 — a line structurally unlike the last result."],
    ["repulsionExclusion", "Repulsion-Pair Exclusion", "Pairs", "Avoids both extremes of the 49×49 pair matrix — the strong repulsion pairs and the crowd-chased attraction pairs — with at most one consecutive pair."],
    ["coldHighTilt", "Cold-High Payout Tilt", "Hot & Cold", "Three balls from the least crowd-picked set {13, 20, 31, 34, 40, 45} plus three more tilted above 31, targeting the +29% high-ball payout premium."],
    ["gapGradient", "Gap-Gradient Construction", "Structure", "Builds the line from gaps upward — one small (1–3), one large (9–14), three medium (4–8) gaps summing to a 33–40 span — matching the empirical delta profile."],
    ["quantileBand", "Sorted-Position Quantile Band", "Structure", "Samples each sorted position from a quantile band around its historical median, rejecting extreme parity (0, 1, 5 or 6 odd) and sums below 115."],
    ["residueColdHybrid", "Residue-Diverse Cold-High Hybrid", "Blends", "Two crowd-cold balls plus four others covering at least five mod-9 residue classes with three balls above 31 — spreading risk across two independent structural signals."],
];

/** Generate a line for `id`/`drawNo`, rejecting up to REJECT_CAP candidates. */
function generateLine(id, rule, prior, drawNo) {
    const rng = rngFor(id, drawNo);
    for (let attempt = 0; attempt < REJECT_CAP; attempt++) {
        const line = rule(prior, rng);
        if (line != null) {
            if (line.length !== 6 || new Set(line).size !== 6 || line.some((n) => n < 1 || n > 49)) {
                throw new Error(`${id}: rule produced an invalid line on draw ${drawNo}`);
            }
            return line;
        }
    }
    throw new Error(`${id}: rejection cap on draw ${drawNo}`);
}

// ---------------------------------------------------------------------------
// Walk-forward evaluation
// ---------------------------------------------------------------------------
const round2 = (x) => Math.round(x * 100) / 100;
const round1 = (x) => Math.round(x * 10) / 10;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Sample standard deviation (ddof = 1) of the per-fold hit counts. */
function sampleSd(counts) {
    if (counts.length < 2) return 0;
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const ss = counts.reduce((acc, x) => acc + (x - mean) ** 2, 0);
    return Math.sqrt(ss / (counts.length - 1));
}

function evaluateStrategy(spec, era, foldStart, expectedHits) {
    const rule = spec.rule ?? null;
    const perFoldHits = [];
    let totalHits = 0;
    let totalPrizes = 0;
    let totalWinnings = 0;
    for (let j = 0; j < FOLDS; j++) {
        const i = foldStart + j;
        const draw = era[i];
        const pick = rule ? generateLine(spec.id, rule, era.slice(0, i), draw.draw) : spec.pick;
        const hits = draw.numbers.filter((n) => pick.includes(n)).length; // main numbers only
        perFoldHits.push(hits);
        totalHits += hits;
        const group = scoreLine(pick, draw);
        if (group > 0) {
            totalPrizes += 1;
            const share = draw.prizes?.[`g${group}`]?.share;
            if (share != null) totalWinnings += share;
        }
    }
    const meanHits = totalHits / FOLDS;
    const sd = sampleSd(perFoldHits);
    // se of the mean over 100 folds; the exact pipeline se is unrecoverable but
    // per-strategy sample sd reproduces the z magnitudes of the pipeline rows.
    const zScore = sd === 0 ? 0 : round2((meanHits - expectedHits) / (sd / 10));
    const effPrizes = totalPrizes;
    const pnlPerDraw = round2((totalWinnings - FOLDS * STAKE_PER_DRAW) / FOLDS);
    const recent12 = perFoldHits.slice(-12).reduce((a, b) => a + b, 0);
    const score = round1(clamp(20.4 + 7.8 * zScore + 5.5 * effPrizes + 0.6 * recent12, 0, 100));
    const currentPick = rule
        ? generateLine(spec.id, rule, era, era[era.length - 1].draw + 1)
        : spec.pick;
    return {
        id: spec.id,
        name: spec.name,
        family: spec.family,
        description: spec.description,
        evaluatedDraws: FOLDS,
        totalHits,
        meanHits: round2(meanHits),
        expectedHits,
        zScore,
        score,
        totalPrizes,
        effPrizes,
        pnlPerDraw,
        recent12,
        rank: 0, // assigned by the league-wide re-rank
        currentPick,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
    const draws = JSON.parse(await readFile(`${DATA_DIR}draws.json`, "utf8"));
    const league = JSON.parse(await readFile(`${DATA_DIR}strategies.json`, "utf8"));

    const expectedHits = league.meta?.chance?.expectedHitsPerLine;
    if (typeof expectedHits !== "number") throw new Error("strategies.json: meta.chance.expectedHitsPerLine missing");

    const era = filterEra(draws);
    if (era.length < FOLDS + 1) throw new Error(`era too short for ${FOLDS} folds: ${era.length}`);
    const foldStart = era.length - FOLDS;
    const nextDrawNo = era[era.length - 1].draw + 1;

    for (const fixed of FIXED_STRATEGIES) {
        if (fixed.pick.length !== 6 || new Set(fixed.pick).size !== 6) throw new Error(`${fixed.id}: bad curated line`);
        if (!league.meta.families.includes(fixed.family)) throw new Error(`${fixed.id}: family "${fixed.family}" not in meta.families`);
    }
    for (const [id, , family] of GENERATOR_STRATEGIES) {
        if (typeof GENERATOR_RULES[id] !== "function") throw new Error(`${id}: missing rule`);
        if (!league.meta.families.includes(family)) throw new Error(`${id}: family "${family}" not in meta.families`);
    }

    const specs = [
        ...FIXED_STRATEGIES.map(({ id, name, family, pick, description }) => ({
            id,
            name,
            family,
            description,
            pick,
        })),
        ...GENERATOR_STRATEGIES.map(([id, name, family, description]) => ({
            id,
            name,
            family,
            description,
            rule: GENERATOR_RULES[id],
        })),
    ];
    const newRows = specs.map((spec) => evaluateStrategy(spec, era, foldStart, expectedHits));

    // Merge: drop placeholders, upsert the 20 custom rows, keep pipeline fields.
    const kept = league.strategies.filter((row) => !PLACEHOLDER_IDS.includes(row.id));
    const byId = new Map(kept.map((row) => [row.id, row]));
    for (const row of newRows) byId.set(row.id, row);

    const ranked = [...byId.values()].sort(
        (a, b) => b.score - a.score || a.id.localeCompare(b.id),
    );
    ranked.forEach((row, i) => {
        row.rank = i + 1;
    });
    league.strategies = ranked;
    league.meta.generatedAt = new Date(Date.now() + 8 * 3600e3).toISOString().replace("Z", "+08:00");
    league.meta.nextDraw = nextDrawNo;

    await writeFile(`${DATA_DIR}strategies.json`, JSON.stringify(league, 1), "utf8");

    const pickStr = (pick) => pick.map((n) => String(n).padStart(2, "0")).join(" ");
    console.log(
        "id".padEnd(19) +
            "family".padEnd(12) +
            "pick".padEnd(18) +
            "ev".padStart(3) +
            "hits".padStart(5) +
            "prizes".padStart(7) +
            "z".padStart(6) +
            "score".padStart(7) +
            "rank".padStart(5),
    );
    for (const row of newRows) {
        console.log(
            row.id.padEnd(19) +
                row.family.padEnd(12) +
                pickStr(row.currentPick).padEnd(18) +
                String(row.evaluatedDraws).padStart(3) +
                String(row.totalHits).padStart(5) +
                String(row.totalPrizes).padStart(7) +
                String(row.zScore).padStart(6) +
                String(row.score).padStart(7) +
                String(row.rank).padStart(5),
        );
    }
    console.log(
        `\n${newRows.length} custom strategies (removed ${PLACEHOLDER_IDS.length} placeholders), league size ${league.strategies.length}, nextDraw ${nextDrawNo}.`,
    );
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
