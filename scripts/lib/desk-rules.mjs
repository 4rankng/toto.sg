// toto.sg — "strategy desk" rules (Ten-Gambler-Strategies-TOTO.docx), the
// subset whose objective is MATCHING numbers against the actual draw.
//
// Scope decision: the document proposes ten strategies; four of them are
// payout/prize-sharing plays (HIGH-ANCHOR ranks balls by Group-3 tax,
// CROWD-SHADOW minimises jackpot sharing, JACKPOT-WINDOW/TICKET-SHAPE/
// PRIZE-TARGET are money architecture) and are deliberately NOT implemented —
// this repo's owner wants match-count strategies only. What remains:
//
//   twin45            forecast the next draw's 7-dimension shape from the
//                     last 20 draws, find the 12 most similar archived draws
//                     and play the six balls that appear in them most above
//                     chance expectation.
//   eraBridge         pool each ball's appearance rate across BOTH ball pools
//                     (6/45 pre-2014, 6/49 after) with a replication bonus
//                     when the two eras independently agree on the direction.
//   shapeConditional  same shape forecast, 10 nearest draws weighted by
//                     inverse distance; play the six balls whose
//                     in-neighbourhood rate most exceeds their global rate.
//   portfolio*        six shape-target lines (high sum, low sum, 3-odd,
//                     all-≥34, wide span, even sum): inside each target the
//                     highest combined all-time frequency, then lines chosen
//                     to minimise overlap so one draw pays across shapes.
//
// Determinism: no RNG anywhere — every rule is a pure function of the prior
// archive, so reruns are byte-identical apart from meta.generatedAt.

import { defineFamily } from "./platform/family.mjs";
import { fullPrior, memoisedPrepare } from "./platform/context.mjs";
import { RANGE49, topByScore } from "./platform/kit.mjs";

/** Seven structural dimensions of a draw, per the desk document. */
export function fingerprint(draw) {
    const n = draw.numbers;
    const sum = n.reduce((a, b) => a + b, 0);
    const odd = n.filter((x) => x % 2 === 1).length;
    const low = n.filter((x) => x <= 24).length;
    const span = n[5] - n[0];
    const decades = new Set(n.map((x) => Math.floor((x - 1) / 10))).size;
    const tails = new Set(n.map((x) => x % 10)).size;
    const gaps = new Set();
    for (let i = 1; i < n.length; i++) gaps.add(n[i] - n[i - 1]);
    return [sum, odd, low, span, decades, tails, gaps.size];
}

export const meanVec = (rows) =>
    rows.reduce((acc, r) => r.map((x, d) => acc[d] + x / rows.length), new Array(rows[0].length).fill(0));

export const sdVec = (rows) => {
    const m = meanVec(rows);
    const out = m.map((_, d) => {
        const ss = rows.reduce((acc, r) => acc + (r[d] - m[d]) ** 2, 0);
        return Math.sqrt(ss / Math.max(1, rows.length - 1)) || 1; // guard 0-sd dims
    });
    return out;
};

/** Standardised Euclidean distance (each dimension divided by its archive sd —
 *  this is what makes sum, the widest-ranging dimension, weigh heaviest). */
export const shapeDistance = (a, b, sds) => {
    let s = 0;
    for (let d = 0; d < a.length; d++) s += ((a[d] - b[d]) / sds[d]) ** 2;
    return Math.sqrt(s);
};

/** Era-split scores: each ball's appearance z across BOTH pools, pooled
 *  properly (different per-draw probabilities: 6/45 vs 6/49), with a +35%
 *  replication bonus when the eras independently agree. */
export function eraScores(prior, boundaryDraw) {
    const oldDraws = prior.filter((d) => d.draw < boundaryDraw);
    const newDraws = prior.filter((d) => d.draw >= boundaryDraw);
    const countIn = (draws, b) => {
        let c = 0;
        for (const d of draws) if (d.numbers.includes(b)) c++;
        return c;
    };
    const score = new Array(49).fill(0);
    for (let b = 1; b <= 49; b++) {
        const pOld = 6 / 45;
        const pNew = 6 / 49;
        const nO = oldDraws.length;
        const nN = newDraws.length;
        const devOld = countIn(oldDraws, b) - nO * pOld; // 0 when the ball never existed there
        const devNew = countIn(newDraws, b) - nN * pNew;
        const den = Math.sqrt(nO * pOld * (1 - pOld) + nN * pNew * (1 - pNew)) || 1;
        const pooled = (devOld + devNew) / den;
        // Replication bonus: both eras point the same way → 1.35x.
        score[b - 1] = devOld * devNew > 0 ? pooled * 1.35 : pooled;
    }
    return score;
}

// ---------------------------------------------------------------------------
// Per-fold shared context (built once per fold draw, memoised by the caller).
// `eraPrior` drives the 20-draw forecast; `full` (both eras) drives everything
// else, exactly as the desk document specifies.
// ---------------------------------------------------------------------------
export function buildDeskContext(eraPrior, full, targetDraw, boundaryDraw) {
    const fps = full.map(fingerprint);
    const sds = sdVec(fps);
    const forecast = meanVec(eraPrior.slice(-20).map(fingerprint));
    const counts = new Array(49).fill(0);
    for (const d of full) for (const x of d.numbers) counts[x - 1]++;
    return {
        full,
        fps,
        sds,
        forecast,
        counts,
        era: eraScores(full, boundaryDraw),
    };
}

/** The k archived draws nearest the forecast shape (ties: lower draw no). */
export function nearestTwins(ctx, k) {
    return ctx.full
        .map((d, i) => ({ d, dist: shapeDistance(ctx.fps[i], ctx.forecast, ctx.sds) }))
        .sort((a, b) => a.dist - b.dist || a.d.draw - b.d.draw)
        .slice(0, k);
}

// ---------------------------------------------------------------------------
// The rules. Each is rule(prior, target, rng, ctx) -> sorted 6-number line.
// ---------------------------------------------------------------------------


/** Enumerate 6-subsets of `pool` lazily; keep it allocation-light. */
function* combos6(pool) {
    const n = pool.length;
    const idx = [0, 1, 2, 3, 4, 5];
    for (;;) {
        yield idx.map((i) => pool[i]);
        let p = 5;
        while (p >= 0 && idx[p] === n - 6 + p) p--;
        if (p < 0) return;
        idx[p]++;
        for (let q = p + 1; q < 6; q++) idx[q] = idx[q - 1] + 1;
    }
}

export const DESK_RULES = {
    // 1. TWIN-45 — shape-analogue vote over the 12 nearest archived draws.
    twin45(prior, target, rng, ctx) {
        const twins = nearestTwins(ctx, 12);
        const votes = new Array(49).fill(0);
        for (const t of twins) for (const x of t.d.numbers) votes[x - 1]++;
        const excess = votes.map((v, i) => v - (12 * 6) / 49);
        return topByScore(excess, 6);
    },

    // 2. ERA-BRIDGE — pooled two-era rate with a 35% replication bonus.
    eraBridge(prior, target, rng, ctx) {
        return topByScore(ctx.era, 6);
    },

    // 5. SHAPE-CONDITIONAL — inverse-distance lift inside the 10 nearest twins.
    shapeConditional(prior, target, rng, ctx) {
        const twins = nearestTwins(ctx, 10);
        let wTotal = 0;
        const wBall = new Array(49).fill(0);
        for (const t of twins) {
            const w = 1 / (t.dist + 1e-9);
            wTotal += w;
            for (const x of t.d.numbers) wBall[x - 1] += w;
        }
        const lift = wBall.map((w, i) => w / wTotal / (ctx.counts[i] / ctx.full.length));
        return topByScore(lift, 6);
    },

    // 10. PORTFOLIO-COVER — six shape-target lines, frequency-ranked inside
    // each target, chosen with minimal mutual overlap. Candidate pools: the
    // full constraint space for all-≥34 (16 balls), the 14 most frequent
    // balls otherwise (the frequency objective makes richer pool irrelevant —
    // lower-frequency candidates can never outscore them).
    portfolioHighSum(prior, target, rng, ctx) {
        return portfolioLine(ctx, (l) => l.reduce((a, b) => a + b, 0) >= 190, []);
    },
    portfolioLowSum(prior, target, rng, ctx) {
        return portfolioLine(ctx, (l) => l.reduce((a, b) => a + b, 0) <= 120, []);
    },
    portfolioOddSplit(prior, target, rng, ctx) {
        return portfolioLine(ctx, (l) => l.filter((x) => x % 2 === 1).length === 3, []);
    },
    portfolioHighSix(prior, target, rng, ctx) {
        return portfolioLine(ctx, () => true, RANGE49.filter((x) => x >= 34));
    },
    portfolioWideSpan(prior, target, rng, ctx) {
        return portfolioLine(ctx, (l) => l[5] - l[0] >= 40, []);
    },
    portfolioEvenSum(prior, target, rng, ctx) {
        return portfolioLine(ctx, (l) => l.reduce((a, b) => a + b, 0) % 2 === 0, []);
    },
};

/** Shared per-fold portfolio state: the six lines are chosen sequentially,
 *  each minimising overlap with the ones already fixed this fold. */
const portfolioState = new Map(); // targetDraw -> { chosen: number[][] }

function portfolioLine(ctx, satisfies, forcedPool) {
    let state = portfolioState.get(ctx.full.length);
    if (!state) {
        state = { chosen: [] };
        portfolioState.set(ctx.full.length, state);
    }
    const freq = (line) => line.reduce((acc, x) => acc + ctx.counts[x - 1], 0);
    // Candidate pools, richest first: a forced constraint space (all-≥34),
    // then the 14, 24 and finally all 49 balls by descending all-time
    // frequency. Widening only kicks in when no candidate satisfies the
    // shape target — the frequency objective makes the extra candidates
    // unable to win otherwise.
    const byFreq = RANGE49.slice().sort((a, b) => ctx.counts[b - 1] - ctx.counts[a - 1] || a - b);
    const pools = forcedPool.length > 0 ? [forcedPool] : [byFreq.slice(0, 14), byFreq.slice(0, 24), byFreq];
    for (const pool of pools) {
        let best = null;
        let bestKey = null;
        for (const line of combos6([...pool].sort((a, b) => a - b))) {
            if (!satisfies(line)) continue;
            const overlap = state.chosen.reduce(
                (acc, prev) => acc + line.filter((x) => prev.includes(x)).length,
                0,
            );
            // Primary: combined frequency. Overlap breaks near-ties and keeps
            // the six lines spread across shapes (doc step 3).
            const key = [freq(line), -overlap];
            if (
                bestKey === null ||
                key[0] > bestKey[0] + 1e-9 ||
                (Math.abs(key[0] - bestKey[0]) <= 1e-9 && key[1] > bestKey[1])
            ) {
                best = line;
                bestKey = key;
            }
        }
        if (best) {
            state.chosen.push(best);
            return [...best].sort((a, b) => a - b);
        }
    }
    throw new Error("portfolio: no candidate satisfies the shape target");
}

// ---------------------------------------------------------------------------
// Row metadata: id, display name, family, one-line description. Families are
// existing meta.families entries only.
// ---------------------------------------------------------------------------
export const DESK_STRATEGIES = [
    ["twin45", "TWIN-45 Shape-Analogue", "Machine Learning", "Forecasts the next draw's seven-dimension shape from the last 20 draws, finds the 12 closest archived draws and plays the six balls that out-appear chance inside them."],
    ["eraBridge", "ERA-BRIDGE Two-Era Pooled Rate", "Frequency", "Pools every ball's appearance rate across both ball pools (6/45 and 6/49) with a 35% bonus when the two eras independently agree — eighteen years of evidence per ball."],
    ["shapeConditional", "SHAPE-CONDITIONAL Lift", "Machine Learning", "Weights the ten nearest shape-twins by inverse distance and plays the six balls whose in-neighbourhood rate most exceeds their own long-run rate."],
    ["portfolioHighSum", "Portfolio High-Sum Shape", "Structure", "Portfolio line 1: the highest combined all-time frequency among lines summing ≥190 — coverage for the wide, high tail of the sum distribution."],
    ["portfolioLowSum", "Portfolio Low-Sum Shape", "Structure", "Portfolio line 2: the highest combined all-time frequency among lines summing ≤120 — coverage for the tight, low tail of the sum distribution."],
    ["portfolioOddSplit", "Portfolio 3-Odd Shape", "Structure", "Portfolio line 3: the highest combined all-time frequency among exactly three-odd lines — the modal parity composition."],
    ["portfolioHighSix", "Portfolio All-≥34 Shape", "Structure", "Portfolio line 4: the highest combined all-time frequency among lines drawn entirely from 34–49 — coverage for all-high draws."],
    ["portfolioWideSpan", "Portfolio Wide-Span Shape", "Structure", "Portfolio line 5: the highest combined all-time frequency among lines spanning ≥40 — coverage for spread-out draws."],
    ["portfolioEvenSum", "Portfolio Even-Sum Shape", "Structure", "Portfolio line 6: the highest combined all-time frequency among even-sum lines — the marginally modal sum parity."],
];

// The desk reads the FULL archive (both ball pools), so its prepare needs the
// whole sorted archive and the era boundary from the caller's prepareEnv.
export const DESK_FAMILY = defineFamily({
    rules: DESK_RULES,
    rows: DESK_STRATEGIES,
    prepare: memoisedPrepare((prior, target, env) =>
        buildDeskContext(prior, fullPrior(env.sorted, target.draw), target.draw, env.boundaryDraw),
    ),
});
