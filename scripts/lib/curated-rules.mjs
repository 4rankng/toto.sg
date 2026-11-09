// toto.sg — the 8 curated archetypes as live walk-forward rules.
//
// The original 2026-11 spec shipped these as fixed hindsight lines. The league
// contract now forbids that ("rebuild the line per draw, never apply a fixed
// line to the whole window"), so each archetype is re-encoded as the rule its
// document actually described: every fold regenerates the line from the stats
// of strictly earlier draws only, with rng-seeded tie-breaks among the top
// candidates. The two payout-premium archetypes from the same document
// (Pari-Mutuel EV & Tetraphobia, Anti-Calendar Fortress) are not rebuilt:
// the league optimises match count, not prize sharing.
//
// Every rule runs its gated construction up to GATED_TRIES times, then falls
// back to the same construction without the shape gates — the archetype's
// core line — so no fold can exhaust the evaluator's rejection cap. Rules are
// never allowed to return an invalid line: padLine tops the set up from the
// all-time frequency leaders.
//
// Rule signature: rule(prior, target, rng, stats) where stats is
// buildFoldStats(prior, target) from cross-panel-stats.mjs. Heavy derived tables
// are memoised on the stats object so loops never recompute them.
import { buildFoldStats, RANGE49, acValue, consecPairs, lineSum, oddCount, sampleK, sortAsc } from "./cross-panel-stats.mjs";
import { ctxMemo } from "./platform/context.mjs";
import { defineFamily } from "./platform/family.mjs";
import { padLine as kitPadLine, pairZ as kitPairZ, pick, randInt } from "./platform/kit.mjs";
const GATED_TRIES = 200;

/** z-score of one pair's co-occurrence count under the Poisson null. */
const pairZ = (stats, a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const count = stats.pairCounts.get(key) ?? 0;
    return kitPairZ(count, stats.expectedPairs);
};

/** Balls of `line` sorted by all-time frequency, strongest first. */
const byFreq = (stats, line) => sortAsc(line).sort((a, b) => stats.freq[b - 1] - stats.freq[a - 1] || b - a);

/** Top-k co-occurring pairs by z, strongest first: [{a, b, z}]. */
const topPairs = (stats, k) => {
    const rows = [];
    for (let a = 1; a <= 48; a++) for (let b = a + 1; b <= 49; b++) rows.push({ a, b, z: pairZ(stats, a, b) });
    rows.sort((x, y) => y.z - x.z || x.a - y.a || x.b - y.b);
    return rows.slice(0, k);
};

/** Top-k triplets by lift over the hypergeometric expectation, cached per fold. */
const topTriplets = (prior, stats, k) =>
    ctxMemo(stats, "triplets", (s) => {
        const expected = s.draws * (20 / 18424); // C(6,3)/C(49,3) per draw
        const counts = new Map();
        for (const draw of prior) {
            const nums = draw.numbers;
            for (let i = 0; i < 6; i++)
                for (let j = i + 1; j < 6; j++)
                    for (let l = j + 1; l < 6; l++) {
                        const key = `${nums[i]}-${nums[j]}-${nums[l]}`;
                        counts.set(key, (counts.get(key) ?? 0) + 1);
                    }
        }
        return [...counts.entries()]
            .map(([key, count]) => ({ line: key.split("-").map(Number), lift: count / expected }))
            .sort((x, y) => y.lift - x.lift || x.line[0] - y.line[0]);
    }).slice(0, k);

/** Most frequent consecutive runs (n, n+1) by lift, strongest first. */
const topConsecRuns = (stats, k) => {
    const expected = stats.expectedPairs; // same Poisson null as plain pairs
    const rows = [];
    for (let n = 1; n <= 48; n++) {
        const count = stats.pairCounts.get(`${n}-${n + 1}`) ?? 0;
        if (count > 0) rows.push({ n, lift: count / expected });
    }
    rows.sort((x, y) => y.lift - x.lift || x.n - y.n);
    return rows.slice(0, k);
};

/** Top the set up to exactly 6 unique balls from the frequency leaders. */
const padLine = (stats, line) => kitPadLine(stats.freq, line);

/** Blended 10- and 50-draw surge ranking, strongest first. */
const blendedSurges = (prior, stats) => {
    const recent = prior.slice(-10);
    const v10 = new Array(49).fill(-recent.length * (6 / 49));
    for (const draw of recent) for (const n of draw.numbers) v10[n - 1] += 1;
    return RANGE49.map((n) => ({ n, v: v10[n - 1] + stats.velocity[n - 1] })).sort((x, y) => y.v - x.v || x.n - y.n);
};

export const CURATED_STRATEGIES = [
    ["zScoreHub", "Z-Score Hub & Momentum Bridge", "Pairs", "Locks the strongest co-occurrence pair by z-score, bridges it through its hub ball into the second-strongest linked pair, and fills the last slots with the fastest 50-draw risers. Sum 115–185, AC ≥ 6."],
    ["bellCurvePeak", "Bell-Curve & Matrix Peak", "Structure", "Sits on the composition-matrix peak — exactly 3 odd and 2 high (25+) balls — embedding the strongest-lift triplet and the hottest consecutive run, near the 150 sum median."],
    ["decadeTwinAnchor", "Decade Dispersion & Twin Anchors", "Structure", "One ball from each of the four low decades plus two from the 40s, each slot drawn from the decade's most frequent balls, with the sum held in 140–175."],
    ["velocitySurfer", "Short-Term Velocity Surfer", "Momentum", "Rides the six strongest blended 10- and 50-draw surges (velocity residuals over chance), holding the sum inside the peak 150–179 tier with at least five distinct tail digits."],
    ["skip0Echo", "Skip-0 Double Echo & All-Time Core", "Gap & Due", "Carries two repeats of the previous draw into the all-time frequency leaders and the strongest partner of the most frequent ball carried. Sum 115–160, at most one consecutive pair."],
    ["maxEntropy", "Max Entropy & Bonus Bridge", "Structure", "Rejects lines until every pairwise difference is unique (AC = 10, the ceiling) while embedding the strongest-lift triplet and all-time frequency leaders, centred on sum 150."],
    ["tailDigit2", "Tail-Digit Resonance", "Pattern", "Anchors on the ending digit with the highest hit mass right now, carries it across three decades, and locks the strongest z-score pair alongside it. Sum 115–155, at least four decades."],
    ["dualConsecRun", "Dual Consecutive-Run Synergizer", "Pattern", "Plays the two hottest disjoint consecutive runs by lift, anchored by the frequency leaders, inside the ~9% two-pair regime with sum 140–180."],
];

const finish = (line, { lo, hi, maxConsec = 1, minAc = 0 }) => {
    const sorted = sortAsc(line);
    if (new Set(sorted).size !== 6) return null;
    const sum = lineSum(sorted);
    if (sum < lo || sum > hi) return null;
    if (consecPairs(sorted) > maxConsec) return null;
    if (acValue(sorted) < minAc) return null;
    return sorted;
};

export const CURATED_RULES = {
    zScoreHub(prior, target, rng, stats) {
        let fallback = null;
        for (let t = 0; t < GATED_TRIES; t++) {
            const strong = pick(rng, topPairs(stats, 3));
            const hub = byFreq(stats, [strong.a, strong.b])[0]; // the pair's more frequent ball is the hub
            const linked = topPairs(stats, 12)
                .filter((p) => (p.a === hub || p.b === hub) && p.a !== strong.a + strong.b - hub && p.b !== strong.a + strong.b - hub)
                .slice(0, 3);
            if (linked.length === 0) continue;
            const bridge = pick(rng, linked);
            const line = new Set([strong.a, strong.b, bridge.a, bridge.b]); // 4 slots, 3 distinct: the bridge shares the hub
            const risers = RANGE49.map((n) => ({ n, v: stats.velocity[n - 1] }))
                .sort((x, y) => y.v - x.v || x.n - y.n)
                .filter((r) => !line.has(r.n))
                .slice(0, 12);
            for (const r of sampleK(rng, risers, 3)) line.add(r.n);
            if (line.size !== 6) continue;
            fallback ??= sortAsc([...line]);
            const gated = finish([...line], { lo: 115, hi: 185, minAc: 6 });
            if (gated) return gated;
        }
        return fallback ?? padLine(stats, []);
    },

    bellCurvePeak(prior, target, rng, stats) {
        for (let t = 0; t < GATED_TRIES; t++) {
            const triplet = pick(rng, topTriplets(prior, stats, 3)).line;
            const run = pick(rng, topConsecRuns(stats, 3)).n;
            const line = new Set([...triplet, run, run + 1]);
            if (line.size < 4) continue;
            const leaders = byFreq(stats, RANGE49).filter((n) => !line.has(n));
            while (line.size < 6) line.add(pick(rng, leaders.slice(0, 8)));
            const sorted = [...line];
            if (oddCount(sorted) !== 3) continue;
            if (sorted.filter((n) => n >= 25).length !== 2) continue;
            const gated = finish(sorted, { lo: 138, hi: 165 });
            if (gated) return gated;
        }
        // Fallback: the peak composition built from frequency leaders alone.
        const lows = byFreq(stats, RANGE49.filter((n) => n < 25)).slice(0, 8);
        const highs = byFreq(stats, RANGE49.filter((n) => n >= 25)).slice(0, 8);
        const line = [];
        for (const n of sampleK(rng, lows, 4)) line.push(n);
        for (const n of sampleK(rng, highs, 2)) line.push(n);
        return padLine(stats, line);
    },

    decadeTwinAnchor(prior, target, rng, stats) {
        const decades = [
            [1, 10],
            [11, 20],
            [21, 30],
            [31, 40],
        ];
        for (let t = 0; t < GATED_TRIES; t++) {
            const line = new Set();
            for (const [lo, hi] of decades) {
                const rank = byFreq(stats, RANGE49.filter((n) => n >= lo && n <= hi)).slice(0, 3);
                line.add(pick(rng, rank));
            }
            const forties = byFreq(stats, RANGE49.filter((n) => n >= 41)).slice(0, 4);
            for (const n of sampleK(rng, forties, 2)) line.add(n);
            const gated = finish([...line], { lo: 140, hi: 175 });
            if (gated) return gated;
        }
        // Fallback: the leading ball of every decade plus the two hottest 40s.
        const line = decades.map(([lo, hi]) => byFreq(stats, RANGE49.filter((n) => n >= lo && n <= hi))[0]);
        for (const n of byFreq(stats, RANGE49.filter((n) => n >= 41)).slice(0, 2)) line.push(n);
        return padLine(stats, line);
    },

    velocitySurfer(prior, target, rng, stats) {
        const surges = blendedSurges(prior, stats);
        for (let t = 0; t < GATED_TRIES; t++) {
            const line = new Set(sampleK(rng, surges.slice(0, 12), 6).map((r) => r.n));
            if (new Set([...line].map((n) => n % 10)).size < 5) continue;
            const gated = finish([...line], { lo: 150, hi: 179 });
            if (gated) return gated;
        }
        // Fallback: the six strongest surges as-is.
        return padLine(stats, surges.slice(0, 6).map((r) => r.n));
    },

    skip0Echo(prior, target, rng, stats) {
        const last = stats.lastDraw;
        if (!last) return padLine(stats, []);
        for (let t = 0; t < GATED_TRIES; t++) {
            const echoes = sampleK(rng, last.numbers, 2);
            const line = new Set(echoes);
            const leaders = byFreq(stats, RANGE49).filter((n) => !line.has(n));
            for (const n of sampleK(rng, leaders.slice(0, 6), 4)) line.add(n);
            if (line.size !== 6) continue;
            const top = byFreq(stats, [...line])[0];
            const partner = RANGE49.filter((n) => !line.has(n))
                .sort((a, b) => pairZ(stats, top, b) - pairZ(stats, top, a) || b - a)
                .slice(0, 3);
            line.delete(echoes[randInt(rng, 0, 1)]);
            line.add(pick(rng, partner));
            const gated = finish([...line], { lo: 115, hi: 160 });
            if (gated) return gated;
        }
        // Fallback: both echoes plus the four hottest balls.
        return padLine(stats, [...last.numbers.slice(0, 2), ...byFreq(stats, RANGE49).slice(0, 4)]);
    },

    maxEntropy(prior, target, rng, stats) {
        const triplet = pick(rng, topTriplets(prior, stats, 3)).line;
        const leaders = byFreq(stats, RANGE49.filter((n) => !triplet.includes(n)));
        for (let step = 0; step < 500; step++) {
            const line = new Set(triplet);
            for (const n of sampleK(rng, leaders.slice(0, 10), 3)) line.add(n);
            if (line.size !== 6) continue;
            const sorted = sortAsc([...line]);
            if (acValue(sorted) !== 10) continue;
            if (lineSum(sorted) < 135 || lineSum(sorted) > 165) continue;
            return sorted;
        }
        // Fallback: the triplet plus the three hottest leaders.
        return padLine(stats, [...triplet, ...leaders.slice(0, 3)]);
    },

    tailDigit2(prior, target, rng, stats) {
        const tailMass = new Array(10).fill(0);
        stats.freq.forEach((c, i) => {
            tailMass[i % 10] += c;
        });
        const ranked = tailMass.map((mass, d) => ({ d, mass })).sort((x, y) => y.mass - x.mass || x.d - y.d);
        for (let t = 0; t < GATED_TRIES; t++) {
            const digit = pick(rng, ranked.slice(0, 2)).d;
            const sameTail = RANGE49.filter((n) => n % 10 === digit);
            const decades = [
                [1, 10],
                [11, 20],
                [21, 30],
                [31, 40],
            ];
            const line = new Set();
            for (const [lo, hi] of sampleK(rng, decades, 3)) {
                const inDecade = sameTail.filter((n) => n >= lo && n <= hi);
                if (inDecade.length === 0) continue;
                line.add(pick(rng, inDecade));
            }
            if (line.size < 3) continue;
            const pair = pick(rng, topPairs(stats, 4));
            line.add(pair.a);
            line.add(pair.b);
            const leaders = byFreq(stats, RANGE49.filter((n) => !line.has(n))).slice(0, 3);
            line.add(pick(rng, leaders));
            const gated = finish([...line], { lo: 115, hi: 155 });
            if (gated) return gated;
        }
        // Fallback: the top tail digit's three hottest balls plus the strongest pair and leader.
        const digit = ranked[0].d;
        const core = byFreq(stats, RANGE49.filter((n) => n % 10 === digit)).slice(0, 3);
        const pair = topPairs(stats, 1)[0];
        return padLine(stats, [...core, pair.a, pair.b]);
    },

    dualConsecRun(prior, target, rng, stats) {
        let fallback = null;
        for (let t = 0; t < GATED_TRIES; t++) {
            const first = pick(rng, topConsecRuns(stats, 3));
            const second = pick(
                rng,
                topConsecRuns(stats, 8).filter((r) => r.n !== first.n && r.n !== first.n + 1 && r.n !== first.n - 1),
            );
            if (!second) continue;
            const line = new Set([first.n, first.n + 1, second.n, second.n + 1]);
            const leaders = byFreq(stats, RANGE49.filter((n) => !line.has(n)));
            for (const n of sampleK(rng, leaders.slice(0, 6), 2)) line.add(n);
            if (line.size !== 6) continue;
            fallback ??= sortAsc([...line]);
            const gated = finish([...line], { lo: 140, hi: 180, maxConsec: 2 });
            if (gated) return gated;
        }
        return fallback ?? padLine(stats, []);
    },
};

export const CURATED_FAMILY = defineFamily({
    rules: CURATED_RULES,
    rows: CURATED_STRATEGIES,
    // Deliberately unmemoised, as before: buildFoldStats is cheap and the
    // eight rules memoise their own derived tables on the stats object.
    prepare: (prior, target) => buildFoldStats(prior, target),
});
