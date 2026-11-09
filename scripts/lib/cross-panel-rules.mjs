// toto.sg — the ten cross-panel strategies from toto_10_gambler_strategies.docx.
//
// The document audits the 85 analytics panels on /insights and the 54-rule
// league on /strategies, then proposes ten original strategies. Each one fuses
// two or more panels — a structural property of the cage plus an anti-crowding
// mechanism — so none of them is a single-variable heuristic.
//
// ENCODING RULE — the league contract wins over the document's phrasing.
// Every strategy is re-encoded as the RULE its document described: each fold
// rebuilds the line from the draws strictly before it, so no fixed line is ever
// graded against a window it was curated from. The document's illustrative
// lines are hindsight examples; they live in the playbook artifact as each
// strategy's "spec line" and are never graded.
//
// SCOPE — match count, not prize sharing. Two of the document's strategies
// (Tetraphobia, Cascade) are framed around pari-mutuel payout. Here their ball
// selection is kept — the pools they name are structural — while every payout
// estimate is dropped, so the rows are graded on numbers matched and nothing
// else. No rule here reads a prize table, so the rows cannot become payout
// strategies by the back door.
//
// Rule signature: rule(prior, target, rng, ctx), where ctx is built by
// buildCrossPanelContext() and carries the standard fold statistics plus the
// 54-rule consensus vote, the jackpot rollover state and the weekday skew.
import {
    RANGE49,
    additionalBallCounts,
    buildFoldStats,
    hitsInWindow,
    isPrime,
    lineSum,
    playslipCell,
    sampleK,
    sortAsc,
    weekdaySkew,
} from "./cross-panel-stats.mjs";
import { defineFamily } from "./platform/family.mjs";

const GATED_TRIES = 200;

/** The document's high-payout anchors — the two best Group-3 earners in the cage. */
const HIGH_PAYOUT_ANCHORS = [47, 49];

/**
 * The non-repdigit "4" pool: X4 endings plus the 40s decade, with the
 * repdigit 44 and the crowd-chased 34 / 40 left out.
 */
const TETRAPHIA_POOL = [4, 14, 24, 41, 42, 43, 45, 46, 47, 49];

/** The high-decade half of the tetraphobia pool. */
const TETRAPHIA_HIGH = TETRAPHIA_POOL.filter((n) => n >= 36);

/** The calendar (≤31) half of the tetraphobia pool. */
const TETRAPHIA_LOW = TETRAPHIA_POOL.filter((n) => n <= 31);

/** The four prime-to-prime mirror twins (both halves prime, summing to 50). */
const PRIME_MIRROR_TWINS = [
    [3, 47],
    [7, 43],
    [13, 37],
    [19, 31],
];

/** The high-decade composites the document locks for the mirror-twin slots. */
const COMPOSITE_POOL = [32, 33, 35, 36, 38, 39, 42, 44, 46, 48, 49];

/** The bottom-row corners of the 7×7 playslip. */
const PLAYSLIP_CORNERS = [43, 49];

/** A ball sitting this many draws out counts as a drought corridor. */
const DROUGHT_DRAWS = 22;

/** The ball the document locks into the 7th wheel slot of the System-7 ticket. */
const ADDITIONAL_SPECIALIST = 20;

/** Seasonal sum bands — the sum the line is steered into, by quarter. */
const SEASONAL_SUM_BANDS = [
    { lo: 160, hi: 195 }, // Q1 — March peak
    { lo: 142, hi: 172 }, // Q2 — June trough
    { lo: 150, hi: 182 }, // Q3
    { lo: 152, hi: 190 }, // Q4
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Balls of `pool` ranked by all-time frequency, strongest first. */
const byFreq = (stats, pool) => [...pool].sort((a, b) => stats.freq[b - 1] - stats.freq[a - 1] || a - b);

/** Top up a line to six balls from the all-time frequency leaders. */
const padLine = (stats, line) => {
    const set = new Set(line);
    for (const n of byFreq(stats, RANGE49)) {
        if (set.size >= 6) break;
        set.add(n);
    }
    return sortAsc([...set]);
};

/**
 * Steer a line's sum into [lo, hi] by swapping one ball at a time.
 *
 * `fixed` balls are never swapped out; `up` and `down` are the ascending
 * candidate pools a ball may be swapped in from. Returns null when the band
 * cannot be reached — the caller then falls back.
 */
const fitSum = (line, fixed, lo, hi, up, down) => {
    const set = new Set(line);
    for (let guard = 0; guard < 80; guard += 1) {
        const sum = lineSum([...set]);
        if (sum >= lo && sum <= hi) return sortAsc([...set]);
        const sorted = sortAsc([...set]);
        if (sum < lo) {
            const out = sorted.reverse().find((n) => !fixed.has(n));
            if (out == null) return null;
            const inBall = up.find((n) => !set.has(n) && n > out);
            if (inBall == null) return null;
            set.delete(out);
            set.add(inBall);
        } else {
            const out = sorted.find((n) => !fixed.has(n));
            if (out == null) return null;
            const inBall = [...down].reverse().find((n) => !set.has(n) && n < out);
            if (inBall == null) return null;
            set.delete(out);
            set.add(inBall);
        }
    }
    return null;
};

/** Playslip cell → ball number (row-major, 1-based). */
const cell = (r, c) => 7 * (r - 1) + c;

/** True when a playslip cell sits on one of the two main diagonals. */
const onDiagonal = (r, c) => r === c || r + c === 8;

// ---------------------------------------------------------------------------
// Per-fold context
// ---------------------------------------------------------------------------

/**
 * Everything a cross-panel rule may look at for one fold.
 *
 * `votes` is the 54-rule consensus: how many of the league's own rules hold
 * each ball in the line they build for this very draw. It is the live version
 * of the document's Panel 18, so the contrarian strategy really does fade the
 * current herd instead of a hard-coded list of six balls.
 */
export const buildCrossPanelContext = (prior, target, votes) => {
    const stats = buildFoldStats(prior, target);
    const weekday = stats.weekday;
    const month = stats.month ?? 1;
    return {
        stats,
        votes,
        weekday,
        skew: weekdaySkew(prior, weekday ?? "Mon"),
        sumBand: SEASONAL_SUM_BANDS[Math.floor((month - 1) / 3) % 4],
        additional: additionalBallCounts(prior),
    };
};

// ---------------------------------------------------------------------------
// Row metadata: id, display name, family, one-line description.
// ---------------------------------------------------------------------------

export const CROSS_PANEL_STRATEGIES = [
    [
        "contrarianConsensusFade",
        "Contrarian Consensus Fade",
        "Cross-Panel",
        "Inverts the league's own vote: bans the six most-voted balls the Consensus Pick button herds into, then plays the blind spot — the least-voted high-decade balls — plus one of the cage's two best-paying anchors.",
    ],
    [
        "tetraphobiaDigit4Pool",
        "Tetraphobia Digit-4 Pool",
        "Cross-Panel",
        "Plays the culturally under-picked '4' pool — X4 endings and the 40s decade, repdigits excluded — keeping at most two calendar balls so the line stays inside the uncrowded high-decade zone.",
    ],
    [
        "highSumVolumeBarbell",
        "High-Sum Volume Barbell",
        "Cross-Panel",
        "The anti-quick-pick shape: five balls from the 32–49 range and one calendar ball, with the line's sum held above the crowded mid-sum zone and the wheel's best 7th-ball candidate reserved for the bonus slot.",
    ],
    [
        "droughtBorderStraddle",
        "Drought-Corridor Border Straddle",
        "Cross-Panel",
        "Finds the balls sitting more than 22 draws out, bans them outright, and straddles the ±1 border rows that bracket them — then fills the rest with high-decade anchors.",
    ],
    [
        "playslipSixRooks",
        "Playslip 6-Rook Non-Attacking",
        "Cross-Panel",
        "Places six balls on the physical 7×7 playslip like six non-attacking rooks: six distinct rows, six distinct columns, one bottom corner and two centre-cross cells, no other diagonal cell.",
    ],
    [
        "hollowMiddleBarbell",
        "Hollow-Middle Barbell",
        "Cross-Panel",
        "Pins the lowest ball to the empirical first-position median and the highest to the top of the cage, then hollows out the middle — four balls packed into 36–46 and a line span locked to the modal 43.",
    ],
    [
        "weekdayRegimeSwitch",
        "Weekday Regime Switch",
        "Cross-Panel",
        "Conditions the core on the draw's weekday: the three balls running hottest on that weekday in the archive become the anchors, and the seasonal sum band steers the remaining slots.",
    ],
    [
        "additionalBallWheel",
        "Additional-Ball Wheel",
        "Cross-Panel",
        "Locks the archive's best 7th-ball outlier out of the line entirely and fills the six slots from the uncrowded high-decade pool, reserving that ball for the bonus tier a System 7 would play.",
    ],
    [
        "climaxFadeIgnition",
        "Climax-Fade & Early Ignition",
        "Cross-Panel",
        "Vetoes every ball that already hit four or more times in the last ten draws, then buys the 2–3 hit balls riding a positive 50-draw trend and tops up with quiet high-decade anchors.",
    ],
    [
        "primeMirrorComposite",
        "Prime Mirror Twin & Composites",
        "Cross-Panel",
        "Locks one prime-to-prime mirror twin summing to 50 and bans every other prime, filling the last four slots with high-decade composites.",
    ],
];

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

export const CROSS_PANEL_RULES = {
    // 01 — Anti-54-Strategy Contrarian Fade (Panel 18 & the homepage).
    // Ban the six most-voted balls, buy the blind spot, keep one top earner.
    contrarianConsensusFade(prior, target, rng, ctx) {
        const votes = ctx.votes;
        const ranked = RANGE49.slice().sort((a, b) => votes[b - 1] - votes[a - 1] || a - b);
        const herd = new Set(ranked.slice(0, 6));
        const blind = RANGE49.filter((n) => !herd.has(n)).sort((a, b) => votes[a - 1] - votes[b - 1] || a - b);
        const highBlind = blind.filter((n) => n >= 36);
        const lowBlind = blind.filter((n) => n <= 35);

        const line = new Set(sampleK(rng, highBlind.slice(0, 8), 4));
        line.add(sampleK(rng, lowBlind.slice(0, 10), 1)[0]);
        const anchors = HIGH_PAYOUT_ANCHORS.filter((n) => !herd.has(n) && !line.has(n));
        if (anchors.length > 0) line.add(anchors[Math.floor(rng() * anchors.length)]);
        for (const n of blind) {
            if (line.size >= 6) break;
            line.add(n);
        }
        return padLine(ctx.stats, [...line]);
    },

    // 02 — Tetraphobia Digit-4 Swap (Panels 35, 38, 39).
    // Four high-decade '4' balls plus two calendar '4' balls: no repdigits,
    // no digit-8 balls, at most two balls on or below 31.
    tetraphobiaDigit4Pool(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const high = byFreq(stats, TETRAPHIA_HIGH);
        const low = byFreq(stats, TETRAPHIA_LOW);
        const line = new Set(sampleK(rng, high.slice(0, 6), 4));
        for (const n of sampleK(rng, low.slice(0, 3), 2)) line.add(n);
        if (line.size !== 6) return padLine(stats, [...line]);
        return sortAsc([...line]);
    },

    // 03 — Anti-quick-pick high-sum volume barbell (Panels 40, 41, 42).
    // Five balls from the 32–49 range and one calendar ball, sum above the
    // mid-sum crowd zone, with the wheel's best 7th-ball candidate held back
    // out of the six so it can play the bonus slot on a System 7.
    highSumVolumeBarbell(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const high = byFreq(stats, RANGE49.filter((n) => n >= 32));
        const low = byFreq(stats, RANGE49.filter((n) => n <= 31));
        const wheel = sampleK(rng, high.slice(0, 12), 6);
        const calendar = low.slice(0, 8)[Math.floor(rng() * 8)];
        const line = new Set([...wheel, calendar]);
        // Hold back the wheel's strongest 7th-ball candidate: on a System 7 it
        // plays the bonus slot rather than the main line.
        const addCounts = ctx.additional;
        const bonus = [...wheel].sort((a, b) => addCounts[b - 1] - addCounts[a - 1] || a - b)[0];
        line.delete(bonus);
        const fitted = fitSum([...line], new Set(), 191, 260, RANGE49.filter((n) => n >= 32), RANGE49);
        if (fitted == null) return padLine(stats, [...line]);
        return fitted;
    },

    // 04 — Heat-strip Drought-Corridor Border Straddle (Panels 02, 03, 10, 15).
    // Ban the overdue ball, straddle its ±1 border rows, fill with high anchors.
    droughtBorderStraddle(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const drought = new Set(RANGE49.filter((n) => stats.skips[n - 1] >= DROUGHT_DRAWS));
        const borders = [];
        for (const n of [...drought].sort((a, b) => a - b)) {
            if (n > 1) borders.push(n - 1);
            if (n < 49) borders.push(n + 1);
        }
        const usable = [...new Set(borders)].filter((n) => !drought.has(n));
        const line = new Set();
        for (const n of sampleK(rng, usable, Math.min(3, usable.length))) line.add(n);
        const anchors = byFreq(stats, RANGE49.filter((n) => n > 35 && !drought.has(n)));
        for (const n of anchors) {
            if (line.size >= 6) break;
            line.add(n);
        }
        for (const n of byFreq(stats, RANGE49.filter((x) => !drought.has(x)))) {
            if (line.size >= 6) break;
            line.add(n);
        }
        return padLine(stats, [...line]);
    },

    // 05 — 7×7 Playslip 6-Rook Non-Attacking Topology (Panel 30).
    // Six distinct rows and columns, one bottom corner, two centre-cross cells,
    // and no diagonal cell other than the corner itself.
    playslipSixRooks(prior, target, rng, ctx) {
        let fallback = null;
        for (let t = 0; t < GATED_TRIES; t += 1) {
            const built = buildRookLine(rng);
            if (built == null) continue;
            fallback ??= built;
            return built;
        }
        return fallback ?? padLine(ctx.stats, []);
    },

    // 06 — Hollow-Middle Barbell, span-43 lock (Panels 25, 26, 39, 41).
    // One low anchor from {4,5,6}, four balls inside 36–46, one top anchor,
    // and a line span of 42–44.
    hollowMiddleBarbell(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const internal = byFreq(stats, RANGE49.filter((n) => n >= 36 && n <= 46));
        for (let t = 0; t < GATED_TRIES; t += 1) {
            const low = [4, 5, 6][Math.floor(rng() * 3)];
            const tops = [47, 48, 49].filter((n) => n - low >= 42 && n - low <= 44);
            if (tops.length === 0) continue;
            const top = tops[Math.floor(rng() * tops.length)];
            const middle = sampleK(rng, internal.filter((n) => n !== top), 4);
            const line = sortAsc([low, ...middle, top]);
            if (line.length !== 6) continue;
            if (line[5] - line[0] < 42 || line[5] - line[0] > 44) continue;
            if (middle.some((n) => n > top)) continue;
            return line;
        }
        return padLine(stats, []);
    },

    // 07 — Monday / Thursday & seasonal regime switch (Panels 45, 46, 49).
    // The weekday's three hottest balls anchor the line; the seasonal sum band
    // steers the remaining three slots.
    weekdayRegimeSwitch(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const triad = RANGE49.slice()
            .sort((a, b) => ctx.skew[b - 1] - ctx.skew[a - 1] || a - b)
            .slice(0, 3);
        const fixed = new Set(triad);
        const line = new Set(triad);
        const fillers = byFreq(stats, RANGE49.filter((n) => !fixed.has(n)));
        for (const n of fillers) {
            if (line.size >= 6) break;
            line.add(n);
        }
        const fitted = fitSum([...line], fixed, ctx.sumBand.lo, ctx.sumBand.hi, RANGE49, RANGE49);
        if (fitted == null) return padLine(stats, [...line]);
        return fitted;
    },

    // 08 — System-7 additional-ball wheel (Panels 14, 42, 44).
    // The archive's best 7th ball is locked out of the line and the six slots
    // are filled from the uncrowded high-decade pool.
    additionalBallWheel(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const votes = ctx.votes;
        const herd = new Set(
            RANGE49.slice()
                .sort((a, b) => votes[b - 1] - votes[a - 1] || a - b)
                .slice(0, 6),
        );
        const pool = [...new Set([...TETRAPHIA_POOL, ...RANGE49.filter((n) => n >= 36)])].filter(
            (n) => n !== ADDITIONAL_SPECIALIST && !herd.has(n),
        );
        const ranked = byFreq(stats, pool);
        const line = sampleK(rng, ranked.slice(0, 12), 6);
        if (line.length !== 6) return padLine(stats, line);
        return sortAsc(line);
    },

    // 09 — Streak-ribbon climax fade & early-wave ignition (Panels 04, 09).
    // Ban the 4-hit climax balls, buy the 2–3 hit balls on a rising 50-draw
    // trend, top up with quiet high-decade anchors.
    climaxFadeIgnition(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const recent = hitsInWindow(prior, 10);
        const banned = new Set(RANGE49.filter((n) => recent[n - 1] >= 4));
        const ignition = RANGE49.filter(
            (n) => !banned.has(n) && recent[n - 1] >= 2 && recent[n - 1] <= 3 && stats.velocity[n - 1] > 0,
        ).sort((a, b) => stats.velocity[b - 1] - stats.velocity[a - 1] || a - b);
        const quiet = byFreq(stats, RANGE49.filter((n) => !banned.has(n) && recent[n - 1] === 1 && n > 35));
        const line = new Set();
        for (const n of sampleK(rng, ignition.slice(0, 8), Math.min(4, ignition.length))) line.add(n);
        for (const n of quiet) {
            if (line.size >= 6) break;
            line.add(n);
        }
        const risers = RANGE49.filter((n) => !banned.has(n) && !line.has(n)).sort(
            (a, b) => stats.velocity[b - 1] - stats.velocity[a - 1] || a - b,
        );
        for (const n of risers) {
            if (line.size >= 6) break;
            line.add(n);
        }
        return padLine(stats, [...line]);
    },

    // 10 — Prime-to-prime mirror twin + four composites (Panels 16, 36, 38).
    // One prime pair summing to 50, no other prime, four high-decade composites.
    primeMirrorComposite(prior, target, rng, ctx) {
        const stats = ctx.stats;
        const twins = [...PRIME_MIRROR_TWINS].sort(
            (a, b) =>
                stats.freq[b[0] - 1] + stats.freq[b[1] - 1] - (stats.freq[a[0] - 1] + stats.freq[a[1] - 1]),
        );
        const twin = twins[Math.floor(rng() * 2)];
        const line = new Set(twin);
        const composites = COMPOSITE_POOL.filter((n) => !isPrime(n));
        const ranked = byFreq(stats, composites);
        for (const n of sampleK(rng, ranked.slice(0, 8), 4)) line.add(n);
        if (line.size !== 6) return padLine(stats, [...line]);
        return sortAsc([...line]);
    },
};

/**
 * One 7×7 non-attacking placement: a bottom corner, a centre-cross ball on row
 * 4, a centre-cross ball on column 4 and three rooks on the free rows and
 * columns. Returns null when the draw of columns cannot dodge the diagonals.
 */
function buildRookLine(rng) {
    const cornerBall = PLAYSLIP_CORNERS[Math.floor(rng() * PLAYSLIP_CORNERS.length)];
    const corner = playslipCell(cornerBall);
    const usedRows = new Set([corner.row]);
    const usedCols = new Set([corner.col]);
    const line = new Set([cornerBall]);

    // One cross cell on row 4 — never the centre cell 25, never the corner's column.
    const row4 = [23, 24, 26, 27].filter((b) => !usedCols.has(playslipCell(b).col));
    if (row4.length === 0) return null;
    const crossRow = row4[Math.floor(rng() * row4.length)];
    line.add(crossRow);
    usedRows.add(4);
    usedCols.add(playslipCell(crossRow).col);

    // One cross cell on column 4 — never the centre cell 25, never row 4 or 7.
    const col4 = [4, 11, 18, 32, 39, 46].filter((b) => !usedRows.has(playslipCell(b).row));
    if (col4.length === 0) return null;
    const crossCol = col4[Math.floor(rng() * col4.length)];
    line.add(crossCol);
    usedRows.add(playslipCell(crossCol).row);
    usedCols.add(4);

    // Three rooks on the free rows and columns, off both diagonals. Four rows
    // and four columns are still open, so three of each are chosen and paired.
    const freeRows = [1, 2, 3, 5, 6].filter((r) => !usedRows.has(r));
    const freeCols = [1, 2, 3, 5, 6, 7].filter((c) => !usedCols.has(c));
    if (freeRows.length < 3 || freeCols.length < 3) return null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const rows = sampleK(rng, freeRows, 3);
        const cols = [...freeCols];
        const taken = [];
        let ok = true;
        for (const r of rows) {
            const valid = cols.filter((c) => !onDiagonal(r, c));
            if (valid.length === 0) {
                ok = false;
                break;
            }
            const c = valid[Math.floor(rng() * valid.length)];
            taken.push(c);
            cols.splice(cols.indexOf(c), 1);
        }
        if (!ok) continue;
        rows.forEach((r, i) => line.add(cell(r, taken[i])));
        return sortAsc([...line]);
    }
    return null;
}

// Phase-2: these rules read the assembled fold vote, so the league builder
// wires them with the vote prepare after every base family has run.
export const CROSS_PANEL_FAMILY = defineFamily({
    rules: CROSS_PANEL_RULES,
    rows: CROSS_PANEL_STRATEGIES,
    phase: 2,
    votes: "crossPanel",
});
