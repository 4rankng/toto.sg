// toto.sg — SkipGate Anchor: the documented single-line construction
// (doc "Toto_Single_Line_Strategy.txt", the app-implementation pipeline §4).
//
//   Ball 1  carry-over anchor  — 1 of the previous draw's 7 balls
//   Ball 2  neighbour hit      — ±1 of a DIFFERENT prior-draw ball
//   Balls 3–5 peak velocity    — 3 balls at skip 3–8, distinct decades
//   Ball 6  cycle reversion    — 1 ball at skip 9–15 that completes the
//                                line under all 5 bounding-box gates
//
// Gates on the completed line: sum 125–175, odd count 2–4, low (1–24)
// count 2–4, ≥4 decades covered with no decade carrying ≥3 balls, ≤1
// consecutive pair. A failed gate swaps Ball 6 (the balancer) first, then
// the whole construction re-samples — the evaluator's retry loop.
import { decadeOf, oddCount, skipGaps } from "./cross-panel-stats.mjs";
import { RANGE49, makeGate, pick, sortAsc } from "./platform/kit.mjs";
import { memoisedPrepare } from "./platform/context.mjs";
import { defineFamily } from "./platform/family.mjs";

// ---------------------------------------------------------------------------
// Fold context — the four candidate sets of the doc's Step 1–4, from `prior`
// only. Skips follow the league's skipGaps convention (0 = drawn in the
// immediately preceding draw).
// ---------------------------------------------------------------------------

export const buildSkipGateContext = (prior) => {
    const last = prior[prior.length - 1] ?? null;
    if (!last) return { c1: [], c2: [], c3: [], c4: [] };

    const c1Set = new Set(last.numbers);
    if (last.additional != null) c1Set.add(last.additional);
    const c1 = [...c1Set].sort((a, b) => a - b);

    const c2Set = new Set();
    for (const w of c1) {
        for (const d of [-1, 1]) {
            const x = w + d;
            if (x >= 1 && x <= 49 && !c1Set.has(x)) c2Set.add(x);
        }
    }

    const skips = skipGaps(prior);
    const band = (lo, hi) => RANGE49.filter((b) => skips[b - 1] >= lo && skips[b - 1] <= hi);
    return { c1, c2: [...c2Set].sort((a, b) => a - b), c3: band(3, 8), c4: band(9, 15) };
};

/** The doc's five bounding-box gates on one completed six-ball line. */
export const skipGateGate = makeGate({
    sum: [125, 175],
    consec: 1,
    custom: (line) => {
        const odd = oddCount(line);
        if (odd < 2 || odd > 4) return false;
        const low = line.filter((n) => n <= 24).length;
        if (low < 2 || low > 4) return false;
        const decades = new Array(5).fill(0);
        for (const n of line) decades[decadeOf(n)] += 1;
        let distinct = 0;
        for (const count of decades) {
            if (count > 2) return false;
            if (count > 0) distinct += 1;
        }
        return distinct >= 4;
    },
});

/**
 * One construction attempt: anchor, neighbour and core first, then EVERY
 * viable balancer is scanned so an attempt only rejects when no Ball 6 can
 * rescue the line — the doc's "swap Ball 6 or Ball 5 until validated".
 */
export const skipGateAnchor = (prior, target, rng, ctx) => {
    const { c1, c2, c3, c4 } = ctx;
    if (c1.length === 0 || c2.length === 0 || c3.length < 3 || c4.length === 0) return null;

    const b1 = pick(rng, c1);
    const neighbours = c2.filter((x) => Math.abs(x - b1) > 1);
    if (neighbours.length === 0) return null;
    const b2 = pick(rng, neighbours);

    const used = new Set([b1, b2]);
    const core = [];
    const coreDecades = new Set();
    let pool = c3.filter((b) => !used.has(b));
    for (let i = 0; i < 3; i += 1) {
        const fresh = pool.filter((b) => !coreDecades.has(decadeOf(b)));
        if (fresh.length === 0) return null;
        const b = pick(rng, fresh);
        core.push(b);
        used.add(b);
        coreDecades.add(decadeOf(b));
        pool = pool.filter((x) => x !== b);
    }

    const base = [b1, b2, ...core];
    const viable = c4.filter((b) => !used.has(b) && skipGateGate(sortAsc([...base, b])));
    if (viable.length === 0) return null;
    return sortAsc([...base, pick(rng, viable)]);
};

export const SKIPGATE_FAMILY = defineFamily({
    rules: { skipGateAnchor },
    rows: [
        [
            "skipGateAnchor",
            "SkipGate Anchor",
            "Skip",
            "Carry-over anchor: 1 ball repeats from the previous draw's 7, 1 neighbour (±1) of a different prior ball, 3 balls at skip 3–8 on distinct decades, and a skip 9–15 balancer; the line must pass all 5 gates — sum 125–175, odd 2–4, low 2–4, ≥4 decades with none ≥3 balls, ≤1 consecutive pair.",
        ],
    ],
    prepare: memoisedPrepare(buildSkipGateContext),
});
