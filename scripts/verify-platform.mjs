// toto.sg — plain node:assert self-check of the platform kit contracts the
// family migration relies on. `npm run verify:platform`.
//
// Author-side tool: not part of `make deploy` (the deploy pipeline stays the
// AGENTS.md §2 six steps). A failure here means a kit primitive changed
// semantics and every migrated call site must be re-probed.
import assert from "node:assert/strict";
import { bandSample, inBand, makeGate, maskRanked, padLine, pick, retryStages, sampleGated, sortAsc, topByScore } from "./lib/platform/kit.mjs";
import { ctxMemo, fullPrior, memoisedPrepare } from "./lib/platform/context.mjs";
import { defineFamily, PAYOUT_WORD_RE } from "./lib/platform/family.mjs";

// Deterministic rng stub: returns a fixed sequence, records every draw.
const seqRng = (seq) => {
    const draws = [];
    let i = 0;
    const rng = () => {
        const v = seq[i % seq.length];
        i += 1;
        draws.push(v);
        return v;
    };
    rng.count = () => i;
    return rng;
};

// --- topByScore: score desc, ties to the lower ball, result ASCENDING -----
{
    const score = Array.from({ length: 49 }, (_, i) => i % 3); // heavy ties
    const top = topByScore(score, 6);
    assert.deepEqual(top, sortAsc(top), "topByScore must return ascending");
    assert.equal(top.length, 6, "topByScore must return exactly count balls");
    // All score-2 balls come first; among equals the lower balls win.
    assert.ok(top.every((b) => score[b - 1] === 2), "ties must resolve inside the top score class");
    const scoreClass = Array.from({ length: 49 }, (_, i) => (i % 3 === 2 ? 2 : 0));
    assert.deepEqual(topByScore(scoreClass, 3), [3, 6, 9], "equal scores → lower balls first");
}

// --- maskRanked: mask excludes, ties → freq → lower ball ------------------
{
    const mask = new Set([2, 3, 49]);
    const score = new Array(49).fill(0);
    score[20] = 5; // ball 21 top by score
    const freq = new Array(49).fill(0);
    freq[10] = 9; // ball 11 wins the zero-score tie by freq
    const ranked = maskRanked(mask, score, 3, freq);
    assert.equal(ranked.length, 3, "maskRanked returns count balls");
    assert.equal(ranked[0], 21, "highest score first");
    assert.equal(ranked[1], 11, "score tie → higher freq first");
    assert.ok(!ranked.includes(2) && !ranked.includes(3) && !ranked.includes(49), "masked balls never appear");
    const allZero = maskRanked(new Set(), new Array(49).fill(0), 4, new Array(49).fill(0));
    assert.deepEqual(allZero, [1, 2, 3, 4], "full tie → freq tie → lowest balls");
}

// --- padLine: exactly 6 unique, frequency leaders --------------------------
{
    const freq = Array.from({ length: 49 }, (_, i) => (i + 1) % 10);
    const line = padLine(freq, [7, 8]);
    assert.equal(new Set(line).size, 6, "padLine yields 6 unique balls");
    assert.deepEqual(line, sortAsc(line), "padLine returns ascending");
    assert.ok(line.includes(7) && line.includes(8), "padLine keeps the seeds");
    assert.deepEqual(padLine(freq, [1, 2, 3, 4, 5, 6]), [1, 2, 3, 4, 5, 6], "a full line passes through untouched");
}

// --- makeGate / inBand: constraint order and presence ----------------------
{
    assert.equal(inBand([1, 2, 3, 40, 41, 42], 100, 200), true);
    assert.equal(inBand([1, 2, 3, 40, 41, 42], 200, 300), false);
    const gate = makeGate({ sum: [100, 130], consec: 1, ac: 7, tails: 4, custom: (l) => !l.includes(49) });
    assert.equal(gate([1, 9, 15, 20, 27, 33]), true, "all constraints satisfiable simultaneously");
    assert.equal(gate([1, 9, 14, 20, 27, 49]), false, "custom veto fires");
    assert.equal(gate([17, 18, 19, 20, 21, 22]), false, "consec constraint fires");
    const sumOnly = makeGate({ sum: [100, 130] });
    assert.equal(sumOnly([17, 18, 19, 20, 21, 22]), true, "absent constraints are not checked");
    assert.equal(makeGate({})(([1, 2, 3, 4, 5, 6])), true, "empty gate accepts");
}

// --- sampleGated: gate per try, budget respected ---------------------------
{
    // Pool [1..7], k=6: exactly one ball is dropped per sample; the gate
    // demands the dropped ball be 7. Attempt 1 (first draw 0.999) swaps 7
    // in, attempt 2 (all-zero draws) keeps [1..6].
    const rng = seqRng([0.999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const gate = (line) => !line.includes(7);
    const first = sampleGated(rng, [1, 2, 3, 4, 5, 6, 7], gate, { tries: 1 });
    const second = sampleGated(rng, [1, 2, 3, 4, 5, 6, 7], gate, { tries: 1 });
    assert.equal(first, null, "first try rejects when the gate fails");
    assert.deepEqual(second, [1, 2, 3, 4, 5, 6], "second try accepts");
    assert.equal(sampleGated(rng, [1, 2, 3], gate, { tries: 5 }), null, "short pool rejects immediately");
    assert.equal(rng.count(), 12, "exactly one sampleK per try, none for the short pool");
}

// --- retryStages: budgets and first win -------------------------------------
{
    const log = [];
    const build = (rng, pool) => {
        log.push(pool.label);
        return log.length >= 5 ? [1, 2, 3, 4, 5, 6] : null; // wins on the 5th attempt
    };
    const stages = [
        { pool: { label: "a" }, tries: 2 },
        { pool: { label: "b" }, tries: 10 },
    ];
    const rng = seqRng([0.5]);
    assert.deepEqual(retryStages(rng, stages, build), [1, 2, 3, 4, 5, 6], "first non-null wins");
    assert.deepEqual(log, ["a", "a", "b", "b", "b"], "stage budgets consumed in order until the win");
    const none = retryStages(seqRng([0.5]), [{ pool: { label: "x" }, tries: 3 }], () => null);
    assert.equal(none, null, "all stages exhausted → null");
    const skipped = retryStages(seqRng([0.5]), [{ pool: { label: "short" }, tries: 3 }, { pool: [1, 2, 3, 4, 5, 6], tries: 1 }], (r, pool) => (Array.isArray(pool) ? pool : null));
    assert.deepEqual(skipped, [1, 2, 3, 4, 5, 6], "a stage without a viable pool is skipped, not fatal");
}

// --- bandSample: strictly ascending or null ---------------------------------
{
    const asc = seqRng([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    assert.deepEqual(bandSample(asc, [[1, 10], [5, 18], [13, 29], [22, 38], [30, 44], [38, 49]]), [1, 5, 13, 22, 30, 38], "per-position lo draw");
    const hi = seqRng([0.999, 0.999, 0.999, 0.999, 0.999, 0.999]);
    assert.deepEqual(bandSample(hi, [[1, 10], [5, 18], [13, 29], [22, 38], [30, 44], [38, 49]]), [10, 18, 29, 38, 44, 49], "per-position hi draw");
    const clash = seqRng([0.999, 0.0, 0.0, 0.0, 0.0, 0.0]);
    assert.equal(bandSample(clash, [[1, 10], [5, 18], [13, 29], [22, 38], [30, 44], [38, 49]]), null, "non-ascending draw rejects");
    assert.equal(asc.count(), 6, "exactly one rng draw per position");
}

// --- pick: uniform member ----------------------------------------------------
{
    const list = ["x", "y", "z"];
    assert.equal(pick(seqRng([0.5]), list), "y");
    assert.equal(pick(seqRng([0.99]), list), "z");
    assert.equal(pick(seqRng([0.0]), list), "x");
}

// --- memoisedPrepare: once per target.draw ----------------------------------
{
    let builds = 0;
    const prep = memoisedPrepare((prior, target, env) => {
        builds += 1;
        return { draw: target.draw, prior, env };
    });
    const prior = [1, 2, 3];
    const a = prep(prior, { draw: 100 }, { tag: 1 });
    const b = prep([9], { draw: 100 }, { tag: 2 });
    const c = prep(prior, { draw: 101 }, { tag: 1 });
    assert.equal(builds, 2, "one build per distinct draw, none per repeated call");
    assert.equal(a, b, "same target.draw returns the memoised object");
    assert.notEqual(a, c, "a different draw rebuilds");
}

// --- ctxMemo: get-or-compute on one namespaced Map ---------------------------
{
    let calls = 0;
    const ctx = {};
    const compute = () => ++calls;
    assert.equal(ctxMemo(ctx, "k", compute), 1);
    assert.equal(ctxMemo(ctx, "k", compute), 1, "second get does not recompute");
    assert.equal(ctxMemo(ctx, "other", compute), 2, "different key recomputes");
    assert.ok(ctx.__memo instanceof Map, "all slots live on one Map");
}

// --- fullPrior: strict prefix of the full archive ----------------------------
{
    const sorted = [{ draw: 1 }, { draw: 2 }, { draw: 3 }, { draw: 4 }];
    assert.deepEqual(fullPrior(sorted, 3), [{ draw: 1 }, { draw: 2 }], "draws strictly before target");
    assert.deepEqual(fullPrior(sorted, 1), [], "nothing before the first draw");
}

// --- defineFamily: every validation failure mode ------------------------------
{
    const ok = () => null;
    const good = {
        rules: { a: ok },
        rows: [["a", "Name A", "Fam", "Does something honest."]],
    };
    assert.equal(defineFamily(good).ids.length, 1);
    assert.equal(defineFamily({ ...good, prepare: undefined }).phase, 1, "phase defaults to 1");

    const throws = (spec, needle) => {
        assert.throws(() => defineFamily(spec), (err) => err.message.includes(needle) && /\.mjs\]|unknown family module/.test(err.message), `expected "${needle}" with module path`);
    };
    throws({ rules: null, rows: good.rows }, "rules must be an object");
    throws({ rules: good.rules, rows: [] }, "rows must be a non-empty array");
    throws({ rules: { a: 7 }, rows: good.rows }, "not a function");
    throws({ rules: { a: ok }, rows: [["a", "", "Fam", "d"]] }, "empty name");
    throws({ rules: { a: ok }, rows: [["a", "N", "", "d"]] }, "empty family");
    throws({ rules: { a: ok }, rows: [["a", "N", "Fam", "  "]] }, "empty description");
    throws({ rules: { a: ok }, rows: [["a", "N", "Fam", "d"], ["a", "N2", "Fam", "d2"]] }, "duplicate id");
    throws({ rules: { a: ok, b: ok }, rows: [["a", "N", "Fam", "d"], ["b", "N", "Fam", "d2"]] }, "duplicate name");
    throws({ rules: { a: ok, b: ok }, rows: [["a", "N", "Fam", "same"], ["b", "N2", "Fam", "same"]] }, "duplicate description");
    throws({ rules: { a: ok }, rows: [["a", "Row A", "Fam", "Honest."], ["b", "X", "Fam", "Other."]] }, "row without a rule");
    throws({ rules: { a: ok, b: ok }, rows: [["a", "Row A", "Fam", "Honest."]] }, "rule without a row");
    throws({ rules: { a: ok }, rows: [["a", "Jackpot Hunter", "Fam", "Honest."]] }, "payout word in name");
    throws({ rules: { a: ok }, rows: [["a", "N", "Fam", "Chases the payout pool."]] }, "payout word in description");
    throws({ rules: good.rules, rows: good.rows, phase: 3 }, "phase must be 1 or 2");
    throws({ rules: good.rules, rows: good.rows, phase: 2 }, "phase 2 requires votes");
    throws({ rules: good.rules, rows: good.rows, prepare: "x" }, "prepare must be a function");
    // phase 2 with each accepted votes kind passes
    assert.equal(defineFamily({ ...good, phase: 2, votes: "crossPanel" }).phase, 2);
    assert.equal(defineFamily({ ...good, phase: 2, votes: (p, t, v, e) => null }).votes.length, 4);
    // The regex itself: catches the league's banned families of phrasing.
    for (const word of ["S$ 4M", "share the jackpot", "co-winner", "expected value", "high EV", "payout", "jackpot", "prize split"]) {
        assert.ok(PAYOUT_WORD_RE.test(word), `regex must catch "${word}"`);
    }
    for (const clean of ["shark", "invest", "reveal", "devour", "shadow"]) {
        assert.ok(!PAYOUT_WORD_RE.test(clean), `regex must not catch "${clean}"`);
    }
}

console.log("verify:platform — all kit, context and family contracts hold.");
