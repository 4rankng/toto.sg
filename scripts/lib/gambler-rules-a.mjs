// toto.sg — strategies 01–05 of the 10 cross-panel gambler strategies.
//
// Every rule is a pure function of (prior, target, rng, stats): the history
// prefix, the draw being predicted, an injected deterministic rng and the
// fold statistics produced by scripts/lib/gambler-stats.mjs. No I/O, no
// clocks, no Math.random — the rng contract lives in scripts/lib/league-eval.mjs.
//
// The audit behind these rules is toto_10_gambler_strategies.docx; the short
// comments below quote the finding each rule encodes.
import { MOD9_CLASSES, RANGE49, buildFoldStats, lineSum, pairKey, randInt, sampleK, sortAsc } from "./gambler-stats.mjs";

// ---------------------------------------------------------------------------
// 01 — Zero-Bot & Tetraphobia Shield
// ---------------------------------------------------------------------------

// The bot consensus crowds 22, 30, 8, 48, 32, 46 and human superstition
// crowds the digit-8 balls (8, 18, 28, 38, 48) plus the calendar balls ≤ 31.
const ZERO_BOT_BANNED = new Set([8, 18, 22, 28, 30, 32, 38, 46, 48]);
// 13, 20, 34, 40 take ZERO bot picks; 34 and 40 are also tetraphobia (digit 4).
const ZERO_BOT_CORE = [13, 20, 34, 40];
// Uncrowded tetraphobia above 31 (41–45) plus the prime anchors 47 and 49.
const ZERO_BOT_FILL = [41, 42, 43, 44, 45, 47, 49];
// Line-sum window the document calls the high-payout zone for these shapes.
const ZERO_BOT_SUM_MIN = 186;
const ZERO_BOT_SUM_MAX = 205;

// ---------------------------------------------------------------------------
// 02 — Mod-9 Residue Equilibrium & Digital Root 7 Lock
// ---------------------------------------------------------------------------

const MOD9_RESIDUES = MOD9_CLASSES.map((_, r) => r);
// The six-ball classes R1–R4 (residues 1–4); at least three must be present.
const MOD9_SIX_BALL_RESIDUES = new Set([1, 2, 3, 4]);
// Digital root 7 sums sit in the higher-payout zone.
const MOD9_TARGET_SUMS = [160, 169, 178, 187];
const MOD9_DIGITAL_ROOT = 7;
// Bounded internal retries: only 4 of the 84 residue sets satisfy both the
// residue-sum and the R1–R4 conditions, so a single candidate is unlikely to
// qualify. 600 internal draws make one harness attempt succeed with
// probability > 1 − 10⁻⁶.
const MOD9_MAX_ATTEMPTS = 600;

// ---------------------------------------------------------------------------
// 03 — 50-Draw Velocity & 50-n Mirror Twin Confluence
// ---------------------------------------------------------------------------

const VELOCITY_MIRROR_SUM = 50;
const VELOCITY_LEADER_COUNT = 6;
const VELOCITY_VETO_COUNT = 5;
// Prime anchors kept outside the leader set as the top-up pool.
const VELOCITY_EXTRA_FILLS = [41, 47];

// ---------------------------------------------------------------------------
// 04 — Lag-1 Kinetic Carryover & 7th-Ball Promotion Bridge
// ---------------------------------------------------------------------------

// Balls overdue by more than 20 draws are a trap (gambler's fallacy).
const LAG_OVERDUE_LIMIT = 20;

// ---------------------------------------------------------------------------
// 05 — Second-Order Z-Score Graph Filtering
// ---------------------------------------------------------------------------

// Repulsion pairs the ticket must never carry in full.
const DYAD_VETO_PAIRS = [
    [27, 45],
    [14, 34],
    [16, 19],
    [18, 40],
    [13, 33],
    [5, 21],
];
// Documented softening: the literal "all 15 pairs ≥ expected co-occurrence"
// rule is infeasible at this sample size, so at most 2 dead edges are allowed.
const DYAD_MAX_DEAD_EDGES = 2;
const DYAD_MAX_ATTEMPTS = 400;

const dyadVetoKeys = new Set(DYAD_VETO_PAIRS.map(([a, b]) => pairKey(a, b)));

/** Pairwise co-occurrence count of a pair inside the finished line. */
const pairCountIn = (pairCounts, a, b) => pairCounts.get(pairKey(a, b)) ?? 0;

/** True when the line carries both members of a veto (repulsion) pair. */
const completesVetoPair = (line) => {
    const sorted = sortAsc(line);
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
            if (dyadVetoKeys.has(pairKey(sorted[i], sorted[j]))) return true;
        }
    }
    return false;
};

/** Count the "dead edges" of a finished line: pairs below the expected co-occurrence. */
const deadEdgeCount = (line, pairCounts, expectedPairs) => {
    const sorted = sortAsc(line);
    let dead = 0;
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
            if (pairCountIn(pairCounts, sorted[i], sorted[j]) < expectedPairs) dead += 1;
        }
    }
    return dead;
};

export const RULES_A = {
    /**
     * 01 — Zero-Bot & Tetraphobia Shield.
     * The four zero-bot-pick balls are always present; the line is completed
     * from the uncrowded tetraphobia pool so the crowded balls stay out.
     */
    zeroBotTetraphobia(prior, target, rng, stats) {
        const coreSum = lineSum(ZERO_BOT_CORE);
        const pairs = [];
        for (let i = 0; i < ZERO_BOT_FILL.length; i += 1) {
            for (let j = i + 1; j < ZERO_BOT_FILL.length; j += 1) {
                const total = coreSum + ZERO_BOT_FILL[i] + ZERO_BOT_FILL[j];
                if (total >= ZERO_BOT_SUM_MIN && total <= ZERO_BOT_SUM_MAX) pairs.push([ZERO_BOT_FILL[i], ZERO_BOT_FILL[j]]);
            }
        }
        if (pairs.length === 0) return null;
        const [a, b] = pairs[randInt(rng, 0, pairs.length - 1)];
        const line = sortAsc([...ZERO_BOT_CORE, a, b]);
        if (line.some((n) => ZERO_BOT_BANNED.has(n))) return null;
        return line;
    },

    /**
     * 02 — Mod-9 Residue Equilibrium & Digital Root 7 Lock.
     * Six distinct residue classes (at least three of them R1–R4) whose
     * residues sum to 7 mod 9; one ball per class, then ±9 steps inside each
     * class until the line sum lands on 160, 169, 178 or 187.
     */
    mod9Root7Lock(prior, target, rng, stats) {
        for (let attempt = 0; attempt < MOD9_MAX_ATTEMPTS; attempt += 1) {
            const classes = sampleK(rng, MOD9_RESIDUES, 6);
            const residueSum = classes.reduce((acc, r) => acc + r, 0);
            if (residueSum % 9 !== MOD9_DIGITAL_ROOT) continue;
            const sixBallCount = classes.filter((r) => MOD9_SIX_BALL_RESIDUES.has(r)).length;
            if (sixBallCount < 3) continue;

            // One ball per class, drawn uniformly from that class.
            const lists = classes.map((r) => MOD9_CLASSES[r]);
            const picks = lists.map((list) => randInt(rng, 0, list.length - 1));
            const sum = picks.reduce((acc, index, i) => acc + lists[i][index], 0);

            // Every ball stays congruent to its residue mod 9, so the line sum
            // is 7 mod 9 as well and only these four sums are possible. The
            // target is the smallest one at or above the current sum; a pick
            // above the largest target is walked back down to it.
            const target = MOD9_TARGET_SUMS.find((t) => t >= sum) ?? MOD9_TARGET_SUMS[MOD9_TARGET_SUMS.length - 1];
            const steps = (target - sum) / 9;
            if (!Number.isInteger(steps)) continue;

            // Room each ball has inside its own class, in the direction of travel.
            const caps = lists.map((list, i) => (steps >= 0 ? list.length - 1 - picks[i] : picks[i]));
            const order = sampleK(
                rng,
                caps.map((_, i) => i),
                caps.length,
            );
            let remaining = Math.abs(steps);
            const moved = new Array(lists.length).fill(0);
            for (const i of order) {
                const take = Math.min(remaining, caps[i]);
                remaining -= take;
                moved[i] = take;
            }
            if (remaining !== 0) continue;

            const line = lists.map((list, i) => list[steps >= 0 ? picks[i] + moved[i] : picks[i] - moved[i]]);
            if (lineSum(line) !== target) continue;
            return sortAsc(line);
        }
        return null;
    },

    /**
     * 03 — 50-Draw Velocity & 50-n Mirror Twin Confluence.
     * The two hottest balls that are exact 50-n mirror twins anchor the line;
     * the five coldest balls are vetoed outright.
     */
    velocityMirrorTwin(prior, target, rng, stats) {
        const st = stats ?? buildFoldStats(prior, target);
        const ranked = RANGE49.map((ball) => ({ ball, velocity: st.velocity[ball - 1] })).sort((x, y) => y.velocity - x.velocity || x.ball - y.ball);
        const leaders = ranked.slice(0, VELOCITY_LEADER_COUNT);
        const veto = new Set(ranked.slice(-VELOCITY_VETO_COUNT).map((entry) => entry.ball));

        let core = null;
        let bestCombined = -Infinity;
        for (let i = 0; i < leaders.length; i += 1) {
            for (let j = i + 1; j < leaders.length; j += 1) {
                if (leaders[i].ball + leaders[j].ball !== VELOCITY_MIRROR_SUM) continue;
                const combined = leaders[i].velocity + leaders[j].velocity;
                if (combined > bestCombined) {
                    bestCombined = combined;
                    core = [leaders[i].ball, leaders[j].ball];
                }
            }
        }
        if (core === null) core = [leaders[0].ball, leaders[1].ball];

        const coreSet = new Set(core);
        const pool = [];
        for (const leader of leaders) {
            if (!coreSet.has(leader.ball) && !veto.has(leader.ball)) pool.push(leader.ball);
        }
        for (const ball of VELOCITY_EXTRA_FILLS) {
            if (!coreSet.has(ball) && !veto.has(ball) && !pool.includes(ball)) pool.push(ball);
        }
        if (pool.length < 4) return null;

        const fills = sampleK(rng, pool, 4);
        return sortAsc([...core, ...fills]);
    },

    /**
     * 04 — Lag-1 Kinetic Carryover & 7th-Ball Promotion Bridge.
     * The previous draw's 7th ball is promoted, a ±1 neighbour carries over
     * and the remaining four come from balls seen within the last 20 draws.
     */
    lag1CarryoverBridge(prior, target, rng, stats) {
        const st = stats ?? buildFoldStats(prior, target);
        const last = st.lastDraw;
        if (!last || !Array.isArray(last.numbers) || last.numbers.length === 0) return null;
        const mains = last.numbers;

        const additional = Number(last.additional);
        const slot1 = Number.isInteger(additional) && additional >= 1 && additional <= 49 ? additional : Math.max(...mains);

        const base = mains[randInt(rng, 0, mains.length - 1)];
        const step = rng() < 0.5 ? -1 : 1;
        let slot2 = base + step;
        if (slot2 < 1 || slot2 > 49 || slot2 === slot1) {
            const alt = base - step;
            slot2 = alt >= 1 && alt <= 49 && alt !== slot1 ? alt : null;
        }
        if (slot2 === null) return null;

        const used = new Set([slot1, slot2]);
        const eligible = RANGE49.filter((ball) => !used.has(ball) && st.skips[ball - 1] <= LAG_OVERDUE_LIMIT);
        if (eligible.length < 4) return null;

        const fills = sampleK(rng, eligible, 4);
        return sortAsc([slot1, slot2, ...fills]);
    },

    /**
     * 05 — Second-Order Z-Score Graph Filtering (Positive Dyad & Repulsion Veto).
     * The strongest positive-affinity pair anchors the line; the four
     * remaining balls must not complete a repulsion pair and may leave at
     * most two dead edges (pairs below the expected co-occurrence).
     */
    zScoreDyadLock(prior, target, rng, stats) {
        const st = stats ?? buildFoldStats(prior, target);
        const expected = st.expectedPairs;
        if (!(expected > 0)) return null;

        // The anchor is the pair with the highest standardised residual
        // z = (count − expected) / sqrt(expected). Veto (repulsion) pairs are
        // excluded from the candidacy so the "never both" invariant holds.
        let anchorKey = null;
        let bestZ = -Infinity;
        for (const [key, count] of st.pairCounts) {
            if (dyadVetoKeys.has(key)) continue;
            const z = (count - expected) / Math.sqrt(expected);
            if (z > bestZ) {
                bestZ = z;
                anchorKey = key;
            }
        }
        if (anchorKey === null) return null;
        const [anchorA, anchorB] = anchorKey.split("-").map(Number);

        const pool = RANGE49.filter((ball) => ball !== anchorA && ball !== anchorB);
        for (let attempt = 0; attempt < DYAD_MAX_ATTEMPTS; attempt += 1) {
            const fills = sampleK(rng, pool, 4);
            const line = [anchorA, anchorB, ...fills];
            if (completesVetoPair(line)) continue;
            if (deadEdgeCount(line, st.pairCounts, expected) > DYAD_MAX_DEAD_EDGES) continue;
            return sortAsc(line);
        }
        return null;
    },
};
