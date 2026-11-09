// toto.sg — the platform line-authoring kit.
//
// One place for the sampling / ranking / gating / padding primitives every
// strategy family needs, so a new rule composes these instead of hand-rolling
// a fifth variant of "top-k by score". The numeric kernel stays in
// scripts/lib/cross-panel-stats.mjs and is re-exported here unchanged — never
// duplicate it.
//
// All helpers are pure and rng-injected: no clocks, no globals, no
// Math.random. `rng` is always the league's seeded generator for
// (strategy id, draw number), so reruns are byte-identical.
//
// The ranking helpers (`topByScore`, `maskRanked`) are the exact moves of the
// two implementations the league shipped first (desk-rules.mjs `topByScore`
// and catalog-signal-rules.mjs `maskedRanked`, parameterised over the fold
// context), so migrated call sites keep their ordering semantics bit-for-bit.
import { RANGE49, acValue, consecPairs, distinctTails, lineSum, randInt, sampleK, sortAsc } from "../cross-panel-stats.mjs";

export { RANGE49, acValue, consecPairs, lineSum, randInt, sampleK, sortAsc };

/** Uniform pick from `list` — one rng draw, lower index on ties of the floor. */
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** Digit sum of a non-negative integer (the digitSum ladder / lo-shu helper). */
export const digitSum = (n) => String(n).split("").reduce((acc, d) => acc + Number(d), 0);

/**
 * z-score of an observed count against its Poisson expectation (sd = √expected).
 * Pure z from explicit inputs — each caller computes its own expectation.
 */
export const pairZ = (observed, expected) => (observed - expected) / Math.sqrt(expected);

/**
 * The `count` balls with the highest `score`, ASCENDING. Ties break to the
 * lower ball. `score` is a 49-length array indexed by ball − 1.
 */
export const topByScore = (score, count) =>
    RANGE49.map((b) => [b, score[b - 1]])
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, count)
        .map(([b]) => b)
        .sort((a, b) => a - b);

/**
 * Same ranking restricted to balls absent from `mask`, keeping `count`. Ties
 * break by the all-time frequency `freq` ("form-ranked"), then the lower
 * ball — zero-tied indicator vectors otherwise collapse onto the lowest
 * numbers, whose sampled lines can never reach the default sum band.
 * Returned in rank order (not ascending): the result is a sampling pool.
 */
export const maskRanked = (mask, score, count, freq) =>
    RANGE49.filter((b) => !mask.has(b))
        .sort((a, b) => score[b - 1] - score[a - 1] || freq[b - 1] - freq[a - 1] || a - b)
        .slice(0, count);

/**
 * Top the set up to exactly 6 unique balls from the frequency leaders
 * (freq desc, ties to the higher ball — the curated `padLine` move). Rules
 * are never allowed to return a short line; this is the standard repair.
 */
export const padLine = (freq, line) => {
    const set = new Set(line);
    for (const n of sortAsc(RANGE49).sort((a, b) => freq[b - 1] - freq[a - 1] || b - a)) {
        if (set.size >= 6) break;
        set.add(n);
    }
    return sortAsc([...set]);
};

/** True when lineSum(line) sits in [lo, hi]. */
export const inBand = (line, lo, hi) => lineSum(line) >= lo && lineSum(line) <= hi;

/**
 * Compose a line gate from the constraints that are present, checked in a
 * fixed order (cheap shape first): `sum` [lo, hi], `consec` max adjacent
 * pairs, `ac` min Arithmetic Complexity, `tails` min distinct last digits,
 * then `custom(line)` for anything rule-specific. `(line) => boolean`.
 */
export const makeGate =
    ({ sum, consec, ac, tails, custom } = {}) =>
    (line) => {
        if (sum && !inBand(line, sum[0], sum[1])) return false;
        if (consec !== undefined && consecPairs(line) > consec) return false;
        if (ac !== undefined && acValue(line) < ac) return false;
        if (tails !== undefined && distinctTails(line) < tails) return false;
        if (custom && !custom(line)) return false;
        return true;
    };

/**
 * Draw `sampleK(rng, pool, 6)` up to `tries` times, returning the first line
 * that clears `gate` (ascending), else null. The pool is fixed across tries;
 * a pool shorter than 6 rejects immediately.
 */
export const sampleGated = (rng, pool, gate, { tries = 1 } = {}) => {
    if (pool.length < 6) return null;
    for (let i = 0; i < tries; i += 1) {
        const line = sortAsc(sampleK(rng, pool, 6));
        if (gate(line)) return line;
    }
    return null;
};

/**
 * Widening-budget retry: `stages` is [{ pool, tries }, …]; each stage samples
 * from its own pool via `build(rng, pool) → line | null` for up to `tries`
 * attempts. The first non-null line wins; all stages exhausted → null. Each
 * rule keeps its own budget constants (e.g. 300 = 150 + 150) — the platform
 * never invents them.
 */
export const retryStages = (rng, stages, build) => {
    for (const { pool, tries } of stages) {
        if (!pool || pool.length < 6) continue;
        for (let i = 0; i < tries; i += 1) {
            const line = build(rng, pool);
            if (line != null) return line;
        }
    }
    return null;
};

/**
 * One uniform draw per sorted position from its [lo, hi] band; the line is
 * valid only when strictly ascending, else null (reject-and-retry upstream).
 * Bands are given low→high, e.g. [[1,10],[5,18],[13,29],[22,38],[30,44],[38,49]].
 */
export const bandSample = (rng, bands) => {
    const line = bands.map(([lo, hi]) => randInt(rng, lo, hi));
    for (let i = 1; i < line.length; i += 1) if (line[i] <= line[i - 1]) return null;
    return line;
};
