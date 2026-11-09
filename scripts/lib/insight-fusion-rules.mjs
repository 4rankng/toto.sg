// toto.sg — three deterministic walk-forward insight-fusion rules.
//
// Where every other league family is built on ONE signal family, these rules
// FUSE several archive signals into a single composite per-ball score, rank
// the 49 balls by it and sample the top pool under shared shape gates. The
// signals come from the same sequence-dynamics context the ten sequence
// rules read (buildSequenceDynamicsContext, memoised per fold by the league
// builder), plus — for fusionConsensus — the league's own per-ball fold vote.
//
//   NO LOOKAHEAD   every rule sees only the draws strictly before the fold
//                  it is predicting. The weight vectors below are a-priori
//                  constants documented here, never fitted on history.
//   DETERMINISTIC  randomness comes only from the injected rng, seeded per
//                  (strategy id, draw number).
//   MATCH COUNT    the league scores matched numbers, never prize sharing.
//
// Scoring: each signal is turned into a percentile rank over the 49 balls
// (values sorted ascending, percentile = index/48, ties broken stably by
// ball number) and the composite is a fixed weighted sum of those ranks. A
// fully tied signal — the spectral alignment is all zeros before draw 64 —
// therefore degenerates to a deterministic low→high ball ramp, never to
// noise; only the earliest warm-up folds see it. union5Has stays a raw 0/1
// membership flag: fusionMomentum wants the flag itself, not its rank.
//
// The composites (a-priori weights, pools sized per rule):
//
//   fusionEquipoise  top 16   0.20 hawkesBranch + 0.20 bayes + 0.20 velocity
//                              + 0.20 spectral alignment + 0.20 markovIn
//   fusionMomentum   top 14   0.45 hawkesBranch + 0.30 markovIn
//                              + 0.25 union5Has
//   fusionConsensus  top 16   0.30 hawkesBranch + 0.30 markovIn
//                              + 0.40 league votes
//
// Signals (ctx = the fold's sequence-dynamics context):
//   hawkesBranch[b-1]        the discrete Hawkes branching z-score of ball b
//   bayes[b-1]               the Bayesian posterior frequency of ball b
//   velocity[b-1]            the 50-draw velocity residual of ball b
//   spectral.alignment[b-1]  the dominant-harmonic phase alignment of ball b
//   markovIn(b)              Σ over a in ctx.lastLine of lag1["a>b"] — the
//                            lag-1 transition mass flowing INTO ball b from
//                            the last drawn line
//   union5Has(b)             1 when ball b sits in the trailing five-draw
//                            union, else 0
//   votes[b-1]               how many base league rules picked ball b for the
//                            fold (Phase-2 only, supplied by the builder)
//
// Every sampled line must clear the three shape gates: lineSum in [115, 185],
// acValue >= 6 and mahalanobisD2 <= 12.6 — the 95% quantile of the
// chi-square(6) order-statistic null. Combined acceptance is of order 0.5
// per attempt, far under the league's 10000-attempt rejection cap.
import { RANGE49, acValue, lineSum, sortAsc } from "./cross-panel-stats.mjs";
import { mahalanobisD2, sampleK, sequencePrepare } from "./sequence-dynamics-rules.mjs";
import { defineFamily } from "./platform/family.mjs";
import { topByScore } from "./platform/kit.mjs";

const POOL = 49;

/* ------------------------------------------------------------------ *
 * Percentile fusion
 * ------------------------------------------------------------------ */

/**
 * Percentile rank of every ball over one 49-value signal: the balls sorted
 * ascending by value, percentile = index/48, ties broken stably by ball
 * number so the result is fully deterministic.
 */
const percentileRanks = (values) => {
    const order = RANGE49.slice().sort((a, b) => values[a - 1] - values[b - 1] || a - b);
    const ranks = new Float64Array(POOL);
    for (let i = 0; i < POOL; i += 1) ranks[order[i] - 1] = i / (POOL - 1);
    return ranks;
};

/**
 * The fused signal bundle of one fold, in percentile space.
 *
 * `ctx` is the fold's sequence-dynamics context; `votes`, when given, is the
 * league's per-ball vote count for the same fold.
 */
export const fusionScores = (ctx, votes) => {
    const markovIn = new Float64Array(POOL);
    if (ctx.lastLine) {
        for (const b of RANGE49) {
            let inflow = 0;
            for (const a of ctx.lastLine) inflow += ctx.lag1.get(`${a}>${b}`) ?? 0;
            markovIn[b - 1] = inflow;
        }
    }
    const union5Has = new Float64Array(POOL);
    for (const b of RANGE49) if (ctx.union5.has(b)) union5Has[b - 1] = 1;
    return {
        hawkesBranch: percentileRanks(ctx.hawkesBranch),
        bayes: percentileRanks(ctx.bayes),
        velocity: percentileRanks(ctx.velocity),
        spectralAlignment: percentileRanks(ctx.spectral.alignment),
        markovIn: percentileRanks(markovIn),
        union5Has,
        votes: votes ? percentileRanks(votes) : null,
    };
};

/* ------------------------------------------------------------------ *
 * Pool sampling under the shared shape gates
 * ------------------------------------------------------------------ */

/** The three gates every fusion line must clear. */
const clearsGates = (line) => {
    const sum = lineSum(line);
    if (sum < 115 || sum > 185) return false;
    if (acValue(line) < 6) return false;
    return mahalanobisD2(line) <= 12.6; // 95% of the chi-square(6) null
};

/** Sample six balls from the composite's top `count` pool, gated on shape. */
const fusionPick = (rng, composite, count) => {
    const line = sortAsc(sampleK(rng, topByScore(composite, count), 6));
    return clearsGates(line) ? line : null;
};

/** The fixed weighted sum of percentile signals — one composite per ball. */
const weightedComposite = (terms) => {
    const composite = new Float64Array(POOL);
    for (const b of RANGE49) {
        let total = 0;
        for (const [signal, weight] of terms) total += weight * signal[b - 1];
        composite[b - 1] = total;
    }
    return composite;
};

/* ------------------------------------------------------------------ *
 * The three rules
 * ------------------------------------------------------------------ */

export const INSIGHT_FUSION_RULES = {
    // 01. Fusion Equipoise — five signals at equal weight.
    fusionEquipoise(prior, target, rng, ctx) {
        const s = fusionScores(ctx);
        return fusionPick(
            rng,
            weightedComposite([
                [s.hawkesBranch, 0.2],
                [s.bayes, 0.2],
                [s.velocity, 0.2],
                [s.spectralAlignment, 0.2],
                [s.markovIn, 0.2],
            ]),
            16,
        );
    },

    // 02. Fusion Momentum — the hot trio, weighted 45/30/25.
    fusionMomentum(prior, target, rng, ctx) {
        const s = fusionScores(ctx);
        return fusionPick(
            rng,
            weightedComposite([
                [s.hawkesBranch, 0.45],
                [s.markovIn, 0.3],
                [s.union5Has, 0.25],
            ]),
            14,
        );
    },

    // 03. Fusion Consensus — the league's own fold vote. Phase-2: `prepared`
    // is { seq, votes } — the fold's sequence context plus the base league's
    // per-ball vote counts for the same fold, wired by the league builder.
    fusionConsensus(prior, target, rng, prepared) {
        const s = fusionScores(prepared.seq, prepared.votes);
        return fusionPick(
            rng,
            weightedComposite([
                [s.hawkesBranch, 0.3],
                [s.markovIn, 0.3],
                [s.votes, 0.4],
            ]),
            16,
        );
    },
};

export const INSIGHT_FUSION_STRATEGIES = [
    [
        "fusionEquipoise",
        "Fusion Equipoise",
        "Fusion",
        "Five archive signals — Hawkes branch, Bayesian frequency, 50-draw velocity, spectral phase alignment, lag-1 inflow — ranked per ball and fused at equal weight; the top pool is sampled under sum, complexity and order-statistic shape gates.",
    ],
    [
        "fusionMomentum",
        "Fusion Momentum",
        "Fusion",
        "Hawkes excitation, lag-1 inflow and trailing five-draw union membership fused 45/30/25; rides the hottest pool under the same shape gates.",
    ],
    [
        "fusionConsensus",
        "Fusion Consensus",
        "Fusion",
        "The league's own fold votes blended with Hawkes branch and lag-1 inflow; the combined ranking drives a shape-gated six-ball sample.",
    ],
];

// Equipoise/Momentum are base rules sharing the sequence family's memoised
// context; Consensus is phase-2 — it reads the fold's league votes and is
// wired with the fusion vote prepare in league-build.mjs.
export const INSIGHT_FUSION_FAMILY = defineFamily({
    rules: { fusionEquipoise: INSIGHT_FUSION_RULES.fusionEquipoise, fusionMomentum: INSIGHT_FUSION_RULES.fusionMomentum },
    rows: INSIGHT_FUSION_STRATEGIES.filter(([id]) => id !== "fusionConsensus"),
    prepare: sequencePrepare,
});

export const FUSION_CONSENSUS_FAMILY = defineFamily({
    rules: { fusionConsensus: INSIGHT_FUSION_RULES.fusionConsensus },
    rows: INSIGHT_FUSION_STRATEGIES.filter(([id]) => id === "fusionConsensus"),
    phase: 2,
    votes: "fusion",
});
