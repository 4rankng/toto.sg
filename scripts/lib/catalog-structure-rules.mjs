// toto.sg — catalog adoption module 2/4: Structure, Pattern, Sum Band,
// merged Sequence (doc families "Sequences" + "Sequence"), Numerology,
// Decades, Triples, Controls. 107 net-new rows; the full adoption manifest
// and the encoding conventions live in catalog-signal-rules.mjs.
//
// Module-specific encoding decisions (doc one-liner → implemented form):
//   * ulamLucky: the doc's list is a copy of the Euler lucky numbers, so this
//     rule implements the standard published Ulam sequence instead (U(1)=1,
//     U(2)=2, unique-representation sums) — both rows must stay distinct.
//   * fiboSeq plays the Fibonacci set by recency WITHOUT the mask (the doc
//     reserves "masked" for fibLast6); identical constructions would make the
//     two deterministic rows byte-identical forever.
//   * piDigits: π's digit stream is chunked greedily into the largest tokens
//     ≤49, deduplicated, played in order, ensemble fill.
//   * ladderAnchor: depth-bounded DFS over the six position windows (the
//     window pools are 5-7 wide, so full enumeration is small).
//   * Enumeration-based constructive rules search the top-14 ensemble pool
//     (top-16 for deltaSys), masked; no reject-retry gates on deterministic
//     constructions (conventions header, catalog-signal-rules.mjs).
import {
    RANGE49,
    acValue,
    consecPairs,
    decadeOf,
    distinctTails,
    lineSum,
    oddCount,
    randInt,
    residueOf,
    sampleK,
    sortAsc,
} from "./cross-panel-stats.mjs";
import { byRecency, completeLine, ctxMemo, ensFill, ensTop, maskedRanked, nameOf, signalLine, signalLineWide, triplesOf, ensembleScore, shiftBall } from "./catalog-signal-rules.mjs";

// ---------------------------------------------------------------------------
// Shared machinery
// ---------------------------------------------------------------------------

const inMask = (ctx, b) => ctx.mask.has(b);
const unmasked = (ctx, pool) => pool.filter((b) => !inMask(ctx, b));
const isLow = (b) => b <= 24;
const isHigh = (b) => b >= 25;
const digitSum = (n) => String(n).split("").reduce((a, d) => a + Number(d), 0);
const digitRoot = (n) => 1 + ((n - 1) % 9);
const digitRootSet = (r) => RANGE49.filter((n) => digitRoot(n) === r);
const FIB = new Set([1, 2, 3, 5, 8, 13, 21, 34]);
const PRIMES49 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
const SEMIPRIMES = [4, 6, 9, 10, 14, 15, 21, 22, 25, 26, 33, 34, 35, 38, 39, 46, 49];

/** All k-subsets of `pool` (pool ascending), lexicographic order. */
function* combos(pool, k) {
    const idx = Array.from({ length: k }, (_, i) => i);
    const n = pool.length;
    while (true) {
        yield idx.map((i) => pool[i]);
        let i = k - 1;
        while (i >= 0 && idx[i] === n - k + i) i -= 1;
        if (i < 0) return;
        idx[i] += 1;
        for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
}

/**
 * Best line from enumerated k-subsets of `pool`: `grade(line)` returns a
 * number (higher better) or null to reject. First-best wins, so ties resolve
 * to the lexicographically smallest line.
 */
const bestSubset = (pool, k, grade) => {
    let best = null;
    let bestScore = -Infinity;
    for (const line of combos(pool, k)) {
        const score = grade(line);
        if (score != null && score > bestScore) {
            bestScore = score;
            best = line;
        }
    }
    return best;
};

/** Fixed member list → line: recency/value order, optional mask filter, ensemble fill. */
const setLine = (ctx, members, { masked = false, byRecencyOrder = true } = {}) => {
    const kept = masked ? unmasked(ctx, members) : members.slice();
    const ordered = byRecencyOrder ? byRecency(ctx, kept) : sortAsc(kept);
    if (ordered.length >= 6) return sortAsc(ordered.slice(0, 6));
    return completeLine(ctx, ordered);
};

/** Consecutive-pair (n, n+1) co-occurrence counts over the whole prior (memoised per fold). */
const consecPairCounts = (ctx, prior) =>
    ctxMemo(ctx, "consec", () => {
        const counts = new Array(49).fill(0);
        for (const draw of prior) {
            const set = new Set(draw.numbers);
            for (let n = 1; n <= 48; n++) if (set.has(n) && set.has(n + 1)) counts[n] += 1;
        }
        return counts;
    });

/** Triple co-occurrence counts come from module 1's memoised triplesOf. */

/** Solve A·x = b (square, Gaussian elimination with partial pivoting). */
const solveLinear = (A, b) => {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        if (Math.abs(M[piv][col]) < 1e-12) return null;
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = col + 1; r < n; r++) {
            const f = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
        }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
        x[r] = (M[r][n] - M[r].slice(r + 1, n).reduce((a, v, i) => a + v * x[r + 1 + i], 0)) / M[r][r];
    }
    return x;
};

// ---------------------------------------------------------------------------
// Sequence family (doc "Sequences" merged into "Sequence") — 44
// ---------------------------------------------------------------------------

/** Standard published Ulam sequence inside 1..49. */
const ulamNumbers = (() => {
    const seq = [1, 2];
    for (let c = 3; c <= 49 && seq.length < 19; c++) {
        let reps = 0;
        for (let i = 0; i < seq.length && reps < 2; i++) {
            for (let j = i + 1; j < seq.length && reps < 2; j++) {
                if (seq[i] + seq[j] === c) reps += 1;
            }
        }
        if (reps === 1) seq.push(c);
    }
    return seq;
})();

/** π digit stream chunked greedily into the largest tokens ≤ 49. */
const piBalls = (() => {
    const digits = "3141592653589793238462643383279502884197169399375105820974944592307816406286";
    const out = [];
    let i = 0;
    while (i < digits.length) {
        let len = Math.min(2, digits.length - i);
        while (len > 0 && Number(digits.slice(i, i + len)) > 49) len -= 1;
        if (len === 0) {
            i += 1;
            continue;
        }
        const v = Number(digits.slice(i, i + len));
        if (v >= 1 && !out.includes(v)) out.push(v);
        i += len;
        if (out.length >= 10) break;
    }
    return out;
})();

const fibRankedFill = (ctx, rng, primeCount) => {
    const fibs = unmasked(ctx, [...FIB]).sort((a, b) => ensembleScore(ctx)[b - 1] - ensembleScore(ctx)[a - 1]);
    const seeds = fibs.slice(0, primeCount);
    const rest = ensFill(ctx, rng, 6 - seeds.length, new Set(FIB));
    const line = sortAsc([...seeds, ...rest]);
    const sum = lineSum(line);
    if (sum < 115 || sum > 185) return null;
    return line;
};

export const CATALOG_STRUCTURE_RULES = {
    // --- doc family "Sequences" (24) — merged into "Sequence" ---------------
    catalan: (p, t, r, ctx) => setLine(ctx, [1, 2, 5, 14, 42]),
    eulerLucky: (p, t, r, ctx) => setLine(ctx, [1, 3, 7, 9, 13, 15, 21, 25, 31, 33, 37, 43, 45, 49]),
    factorial: (p, t, r, ctx) => setLine(ctx, [1, 2, 6, 24]),
    fibCount1: (p, t, r, ctx) => fibRankedFill(ctx, r, 1),
    fibLast6: (p, t, r, ctx) => setLine(ctx, [1, 2, 3, 5, 8, 13, 21, 34], { masked: true }),
    fiboSeq: (p, t, r, ctx) => setLine(ctx, [1, 2, 3, 5, 8, 13, 21, 34]),
    hexagonal: (p, t, r, ctx) => setLine(ctx, [1, 6, 15, 28, 45]),
    lucas: (p, t, r, ctx) => setLine(ctx, [1, 3, 4, 7, 11, 18, 29, 47]),
    padovan: (p, t, r, ctx) => setLine(ctx, [1, 2, 3, 5, 7, 9, 12, 16, 21, 28, 37, 49]),
    pell: (p, t, r, ctx) => setLine(ctx, [1, 2, 5, 12, 29]),
    pentagonal: (p, t, r, ctx) => setLine(ctx, [1, 5, 12, 22, 35]),
    piDigits: (p, t, r, ctx) => setLine(ctx, piBalls),
    pow2: (p, t, r, ctx) => setLine(ctx, [1, 2, 4, 8, 16, 32], { masked: true }),
    pow3: (p, t, r, ctx) => setLine(ctx, [1, 3, 9, 27]),
    primeCount2: (p, t, r, ctx) => {
        const primes = unmasked(ctx, PRIMES49).sort((a, b) => ensembleScore(ctx)[b - 1] - ensembleScore(ctx)[a - 1]);
        const seeds = primes.slice(0, 2);
        const rest = ensFill(ctx, r, 4, new Set(PRIMES49));
        const line = sortAsc([...seeds, ...rest]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },
    primeSeq: (p, t, r, ctx) => setLine(ctx, PRIMES49, { masked: true }),
    primesHigh: (p, t, r, ctx) =>
        signalLine(ctx, r, Float64Array.from({ length: 49 }, (_, i) => {
            const b = i + 1;
            return b >= 37 && PRIMES49.includes(b) ? 1000 - ctx.skips[i] : -ctx.skips[i];
        })),
    semiprime: (p, t, r, ctx) => setLine(ctx, SEMIPRIMES),
    squareSeq: (p, t, r, ctx) => {
        const squares = [1, 4, 9, 16, 25, 36, 49];
        const kept = unmasked(ctx, squares);
        const line = new Set(kept.slice(0, 6));
        for (const b of RANGE49) {
            if (line.size >= 6) break;
            if (!squares.includes(b) && !inMask(ctx, b)) line.add(b);
        }
        return sortAsc([...line]);
    },
    squaresB: (p, t, r, ctx) => setLine(ctx, [4, 9, 16, 25, 36, 49], { masked: true }),
    triLast6: (p, t, r, ctx) => setLine(ctx, [10, 15, 21, 28, 36, 45], { masked: true }),
    triangular: (p, t, r, ctx) => setLine(ctx, [1, 3, 6, 10, 15, 21, 28, 36, 45]),
    tribonacci: (p, t, r, ctx) => setLine(ctx, [1, 2, 4, 7, 13, 24, 44], { masked: true }),
    ulamLucky: (p, t, r, ctx) => setLine(ctx, ulamNumbers),

    // --- doc family "Sequence" (20) -----------------------------------------
    antiMarkov: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.cond1, (x) => -x)),
    carryCombo: (p, t, r, ctx) => {
        const last = ctx.last?.numbers ?? [];
        const ens = ensembleScore(ctx);
        const repeat = last.slice().sort((a, b) => ens[b - 1] - ens[a - 1])[0];
        if (repeat == null) return null;
        const halo = unmasked(ctx, [repeat - 1, repeat + 1].filter((b) => b >= 1 && b <= 49));
        const neighbor = halo.sort((a, b) => ens[b - 1] - ens[a - 1])[0] ?? ensFill(ctx, r, 1, new Set([repeat]))[0];
        if (neighbor == null || neighbor === repeat) return null;
        const rest = ensFill(ctx, r, 4, new Set([repeat, neighbor]));
        const line = sortAsc([repeat, neighbor, ...rest]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },
    consecDue200: (p, t, r, ctx) => {
        const counts = consecPairCounts(ctx, p.slice(-200));
        const unseen = [];
        for (let n = 1; n <= 48; n++) unseen.push([n, n + 1, counts[n]]);
        unseen.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
        const [a, b] = unseen[0];
        const rest = ensFill(ctx, r, 4, new Set([a, b]));
        const line = sortAsc([a, b, ...rest]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },
    haloSniper: (p, t, r, ctx) => {
        const last = ctx.last?.numbers ?? [];
        const surge = (b) => ctx.w[50][b - 1] - (50 * 6) / 49 + ensembleScore(ctx)[b - 1];
        const halo = unmasked(ctx, last.flatMap((n) => [n - 1, n + 1]).filter((b) => b >= 1 && b <= 49));
        if (halo.length === 0) return null;
        const pick = halo.sort((a, b) => surge(b) - surge(a))[0];
        const rest = ensFill(ctx, r, 5, new Set([pick]));
        const line = sortAsc([pick, ...rest]);
        const sum = lineSum(line);
        if (sum < 115 || sum > 185) return null;
        return line;
    },
    lag2Mirror: (p, t, r, ctx) => {
        const draw2 = p.length >= 2 ? p[p.length - 2].numbers : [];
        const top30 = new Set(RANGE49.slice().sort((a, b) => ctx.freq[b - 1] - ctx.freq[a - 1] || a - b).slice(0, 30));
        const members = unmasked(ctx, draw2.filter((b) => top30.has(b)));
        return completeLine(ctx, members);
    },
    markov: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.cond1)),
    markov2: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.cond2)),
    markov3: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.cond3)),
    mirror2: (p, t, r, ctx) => {
        const draw2 = p.length >= 2 ? p[p.length - 2].numbers : [];
        return completeLine(ctx, unmasked(ctx, draw2.map((n) => 50 - n)));
    },
    mirror50: (p, t, r, ctx) => completeLine(ctx, unmasked(ctx, (ctx.last?.numbers ?? []).map((n) => 50 - n))),
    neighbor: (p, t, r, ctx) => haloSignal(ctx, r, [2, 3]),
    neighbor2: (p, t, r, ctx) => haloSignal(ctx, r, [2]),
    neighbor3: (p, t, r, ctx) => haloSignal(ctx, r, [3]),
    // closest-allowed echo of the last draw — explicitly NO gates (conventions).
    repeat: (p, t, r, ctx) => sortAsc(maskedRanked(ctx, ensembleScore(ctx), 6)),
    repeat2: (p, t, r, ctx) => lagRepeatSignal(p, ctx, r, 2),
    repeat3: (p, t, r, ctx) => lagRepeatSignal(p, ctx, r, 3),
    shift12: (p, t, r, ctx) => shiftLine(ctx, 12),
    shift24: (p, t, r, ctx) => shiftLine(ctx, 24),
    shift3: (p, t, r, ctx) => shiftLine(ctx, 3),
    shift7: (p, t, r, ctx) => shiftLine(ctx, 7),

    // --- Structure (44) ------------------------------------------------------
    acLock7: (p, t, r, ctx) => acLockLine(ctx, 7),
    acLock9: (p, t, r, ctx) => acLockLine(ctx, 9),
    addlAvoid: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.addlCounts, (x) => -x)),
    addlChase: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.addlCounts)),
    addlRecent: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.addlCounts)),
    codex4: (p, t, r, ctx) => {
        const pool = ensTop(ctx, 18);
        // A fixed top-4 core can deterministically overshoot the band; degrade
        // the core until fills can steer the sum inside it.
        for (let core = 4; core >= 2; core--) {
            const seeds = pool.slice(0, core);
            const rest = ensFill(ctx, r, 6 - core, new Set(seeds));
            const line = sortAsc([...seeds, ...rest]);
            if (new Set(line).size === 6 && inBand(line, 115, 185)) return line;
        }
        return null;
    },
    codexPlaySkip: (p, t, r, ctx) =>
        ctxMemo(ctx, "codexPlaySkip", (c) => {
            const ens = ensembleScore(c);
            const pool = ensTop(c, 14);
            const line = bestSubset(pool, 6, (l) => (oddCount(l) === 3 ? l.reduce((a, b) => a + ens[b - 1], 0) : null));
            return line ?? sortAsc(pool.slice(0, 6));
        }),
    decade: (p, t, r, ctx) =>
        ctxMemo(ctx, "decadeMax", (c) => {
            const ens = ensembleScore(c);
            return bestSubset(ensTop(c, 14), 6, (l) => new Set(l.map(decadeOf)).size * 100 + l.reduce((a, b) => a + ens[b - 1], 0) / 10);
        }),
    deltaSys: (p, t, r, ctx) =>
        ctxMemo(ctx, "deltaSys", (c) => {
            const ens = ensembleScore(c);
            return bestSubset(ensTop(c, 16), 6, (l) => {
                let dev = 0;
                for (let i = 1; i < 6; i++) dev += Math.abs(l[i] - l[i - 1] - 7.2);
                return -dev + l.reduce((a, b) => a + ens[b - 1], 0) / 100;
            });
        }),
    drawParity: (p, t, r, ctx) => {
        const wantEven = ctx.drawNo % 2 === 0;
        const ens = ensembleScore(ctx);
        return signalLine(ctx, r, Float64Array.from({ length: 49 }, (_, i) => (i % 2 === (wantEven ? 0 : 1) ? 1000 : 0) + ens[i]));
    },
    dualRuns: (p, t, r, ctx) => {
        const counts = consecPairCounts(ctx, p);
        const ranked = [];
        for (let n = 1; n <= 48; n++) ranked.push([n, n + 1, counts[n]]);
        ranked.sort((a, b) => b[2] - a[2] || a[0] - b[0]);
        const seeds = [];
        for (const [a, b] of ranked) {
            for (const ball of [a, b]) if (!seeds.includes(ball)) seeds.push(ball);
            if (seeds.length >= 4) break;
        }
        const rest = ensFill(ctx, r, 6 - seeds.length, new Set(seeds));
        return sortAsc([...seeds, ...rest]);
    },
    highLow33: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        const board = unmasked(ctx, RANGE49).sort((a, b) => ens[b - 1] - ens[a - 1]);
        const line = sortAsc([...sampleK(r, board.filter(isLow), 3), ...sampleK(r, board.filter(isHigh), 3)]);
        return inBand(line, 115, 185) ? line : null;
    },
    keyWheel: (p, t, r, ctx) => wheelKeys(ctx, r, "hot"),
    keyWheelCold: (p, t, r, ctx) => wheelKeys(ctx, r, "cold"),
    ladderAnchor: (p, t, r, ctx) =>
        ctxMemo(ctx, "ladderAnchor", (c) => {
            const windows = [
                [3, 4, 5, 6, 7],
                [12, 13, 14, 15, 16, 17, 18],
                [18, 19, 20, 21, 22, 23, 24],
                [27, 28, 29, 30, 31, 32, 33],
                [36, 37, 38, 39, 40, 41, 42],
                [43, 44, 45, 46, 47, 48],
            ];
            const ens = ensembleScore(c);
            let best = null;
            let bestScore = -Infinity;
            const dfs = (depth, line, lastBall) => {
                if (depth === 6) {
                    const span = line[5] - line[0];
                    if (span < 36 || span > 43) return;
                    const score = line.reduce((a, b) => a + ens[b - 1], 0);
                    if (score > bestScore) {
                        bestScore = score;
                        best = [...line];
                    }
                    return;
                }
                for (const b of windows[depth]) {
                    if (b <= lastBall) continue;
                    line.push(b);
                    dfs(depth + 1, line, b);
                    line.pop();
                }
            };
            dfs(0, [], 0);
            return best;
        }),
    loShuGrid: (p, t, r, ctx) => {
        const digits = new Set((ctx.dateIso ?? "").replaceAll("-", "").split("").map(Number).filter((d) => d > 0));
        return completeLine(ctx, [...digits]);
    },
    lockModal33: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        const odds = unmasked(ctx, RANGE49).filter((b) => b % 2 === 1).sort((a, b) => ens[b - 1] - ens[a - 1]);
        const lows = unmasked(ctx, RANGE49).filter(isLow).sort((a, b) => ens[b - 1] - ens[a - 1]);
        let fallback = null;
        for (let attempt = 0; attempt < 24; attempt++) {
            const line = sortAsc([...sampleK(r, odds, 3), ...sampleK(r, lows, 3)]);
            if (new Set(line).size < 6) continue;
            const sum = lineSum(line);
            if (sum >= 140 && sum <= 175) return line;
            if (fallback == null && sum >= 115 && sum <= 185) fallback = line;
        }
        return fallback;
    },
    megaBalance: (p, t, r, ctx) => {
        // ALL locks at once can be jointly infeasible on a skewed top-18 pool
        // (e.g. fewer than 5 decades represented) — fall back to the full
        // unmasked board for the second stage of attempts.
        for (let attempt = 0; attempt < 400; attempt++) {
            const pool = attempt < 200 ? ensTop(ctx, 18) : unmasked(ctx, RANGE49);
            const line = sortAsc(sampleK(r, pool, 6));
            const s = lineSum(line);
            const tails = distinctTails(line);
            const decades = new Set(line.map(decadeOf)).size;
            if (oddCount(line) !== 3 || decades < 5 || tails < 5 || s < 140 || s > 175 || acValue(line) < 7) continue;
            return line;
        }
        return null;
    },
    mirrorPair50: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        let best = null;
        let bestScore = -Infinity;
        for (let n = 2; n <= 24; n++) {
            const m = 50 - n;
            if (inMask(ctx, n) || inMask(ctx, m)) continue;
            const score = ens[n - 1] + ens[m - 1];
            if (score > bestScore) {
                bestScore = score;
                best = [n, m];
            }
        }
        if (best == null) return null;
        const rest = ensFill(ctx, r, 4, new Set(best));
        const line = sortAsc([...best, ...rest]);
        return inBand(line, 115, 185) ? line : null;
    },
    mod10Line: (p, t, r, ctx) => classLine(ctx, r, 10, (n) => n % 10),
    mod11Line: (p, t, r, ctx) => classLine(ctx, r, 11, (n) => n % 11),
    mod16Line: (p, t, r, ctx) => classLine(ctx, r, 16, (n) => n % 16),
    mod6Line: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        const line = [];
        for (let cls = 0; cls < 6; cls++) {
            const member = unmasked(ctx, RANGE49.filter((n) => n % 6 === cls)).sort((a, b) => ens[b - 1] - ens[a - 1] || a - b)[0];
            if (member != null) line.push(member);
        }
        return line.length === 6 ? sortAsc(line) : completeLine(ctx, line);
    },
    mod7Bal: (p, t, r, ctx) => {
        const classFreq = new Array(7).fill(0);
        for (let b = 1; b <= 49; b++) classFreq[b % 7] += ctx.freq[b - 1];
        const drop = classFreq.indexOf(Math.min(...classFreq));
        const line = [];
        for (let cls = 0; cls < 7; cls++) {
            if (cls === drop) continue;
            const member = RANGE49.filter((n) => n % 7 === cls).sort((a, b) => ctx.freq[b - 1] - ctx.freq[a - 1] || a - b)[0];
            line.push(member);
        }
        return sortAsc(line);
    },
    mod9Line: (p, t, r, ctx) => setLine(ctx, [4, 13, 22, 31, 40, 49], { masked: true }),
    odd24high24: (p, t, r, ctx) => oddHighLine(ctx, r, 2, 4),
    odd24high42: (p, t, r, ctx) => oddHighLine(ctx, r, 2, 4),
    odd42high24: (p, t, r, ctx) => oddHighLine(ctx, r, 4, 2),
    odd42high42: (p, t, r, ctx) => oddHighLine(ctx, r, 4, 4),
    odd51: (p, t, r, ctx) => oddHighLine(ctx, r, 5, -1),
    parity33: (p, t, r, ctx) =>
        ctxMemo(ctx, "parity33", (c) => {
            const ens = ensembleScore(c);
            const grade = (l) => (oddCount(l) === 3 ? l.reduce((a, b) => a + ens[b - 1], 0) : null);
            for (const size of [14, 18, 24]) {
                const line = bestSubset(ensTop(c, size), 6, grade);
                if (line) return line;
            }
            return bestSubset(unmasked(c, RANGE49), 6, grade);
        }),
    parityAny: (p, t, r, ctx) => signalLine(ctx, r, ensembleScore(ctx)),
    posEdgeLadder: (p, t, r, ctx) => {
        const posFreq1 = new Array(50).fill(0);
        const posFreq6 = new Array(50).fill(0);
        for (const draw of p) {
            const s = sortAsc(draw.numbers);
            posFreq1[s[0]] += 1;
            posFreq6[s[5]] += 1;
        }
        const star1 = RANGE49.slice().sort((a, b) => posFreq1[b] - posFreq1[a] || a - b)[0];
        const star6 = RANGE49.slice().sort((a, b) => posFreq6[b] - posFreq6[a] || a - b)[0];
        const stars = [...new Set([star1, star6])];
        const rest = ensFill(ctx, r, 6 - stars.length, new Set(stars));
        const line = sortAsc([...stars, ...rest]);
        return inBand(line, 115, 185) ? line : null;
    },
    positional: (p, t, r, ctx) => {
        const windows = [
            [1, 14],
            [7, 21],
            [14, 28],
            [22, 36],
            [29, 43],
            [36, 49],
        ];
        const counts = windows.map(([lo, hi]) => new Map());
        for (const draw of p.slice(-200)) {
            const s = sortAsc(draw.numbers);
            for (let i = 0; i < 6; i++) {
                const [lo, hi] = windows[i];
                if (s[i] >= lo && s[i] <= hi) counts[i].set(s[i], (counts[i].get(s[i]) ?? 0) + 1);
            }
        }
        const line = [];
        const used = new Set();
        for (let i = 0; i < 6; i++) {
            const ranked = [...counts[i].entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([b]) => b);
            const pick = unmasked(ctx, ranked).find((b) => !used.has(b));
            if (pick != null) {
                line.push(pick);
                used.add(pick);
            }
        }
        return line.length === 6 ? sortAsc(line) : completeLine(ctx, line);
    },
    primeCount3: (p, t, r, ctx) => {
        const primePool = unmasked(ctx, PRIMES49);
        const restPool = ensTop(ctx, 18).filter((b) => !PRIMES49.includes(b));
        if (primePool.length < 3 || restPool.length < 3) return null;
        const line = sortAsc([...sampleK(r, primePool, 3), ...sampleK(r, restPool, 3)]);
        return inBand(line, 115, 185) ? line : null;
    },
    sectorDef: (p, t, r, ctx) =>
        signalLineWide(
            ctx,
            r,
            Float64Array.from({ length: 49 }, (_, i) => {
                const size = decadeOf(i + 1) === 4 ? 9 : 10;
                return (50 * 6 * size) / 49 - ctx.dec50[decadeOf(i + 1)];
            }),
        ),
    seg7Due: (p, t, r, ctx) => {
        const segObs = new Array(7).fill(0);
        for (let b = 1; b <= 49; b++) segObs[Math.floor((b - 1) / 7)] += ctx.w[50][b - 1];
        return signalLineWide(
            ctx,
            r,
            Float64Array.from({ length: 49 }, (_, i) => (50 * 6 * 7) / 49 - segObs[Math.floor(i / 7)]),
        );
    },
    tail2Resonance: (p, t, r, ctx) => {
        const cluster = unmasked(ctx, [2, 12, 22, 32]);
        let partner = null;
        let bestZ = 0;
        for (let b = 1; b <= 49; b++) {
            if (cluster.includes(b) || inMask(ctx, b)) continue;
            const z = cluster.reduce((acc, c) => acc + ctx.pairZ[(c - 1) * 49 + (b - 1)], 0) / Math.max(1, cluster.length);
            if (z > bestZ) {
                bestZ = z;
                partner = b;
            }
        }
        const rest = ensFill(ctx, r, 6 - cluster.length - (partner != null ? 1 : 0), new Set([...cluster, ...(partner != null ? [partner] : [])]));
        return sortAsc([...cluster, ...(partner != null ? [partner] : []), ...rest]);
    },
    tail5Modal: (p, t, r, ctx) => tailPatternLine(ctx, r, true),
    tailDeficit30: (p, t, r, ctx) => {
        const deficit = new Array(10).fill(0).map((_, d) => (30 * 6 * tailsClassSize(d)) / 49 - ctx.tail30[d]);
        const worst = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => deficit[b] - deficit[a]).slice(0, 3);
        const ens = ensembleScore(ctx);
        const seeds = [];
        for (const d of worst) {
            const member = unmasked(ctx, RANGE49.filter((b) => b % 10 === d)).sort((a, b) => ens[b - 1] - ens[a - 1])[0];
            if (member != null) seeds.push(member);
        }
        const rest = ensFill(ctx, r, 6 - seeds.length, new Set(seeds));
        return sortAsc([...seeds, ...rest]);
    },
    tailDigit: (p, t, r, ctx) => tailPatternLine(ctx, r, false),
    tailSumModal: (p, t, r, ctx) => {
        for (let attempt = 0; attempt < 400; attempt++) {
            const pool = attempt < 200 ? ensTop(ctx, 18) : unmasked(ctx, RANGE49);
            const line = sortAsc(sampleK(r, pool, 6));
            const tailSum = line.reduce((a, b) => a + (b % 10), 0);
            if (tailSum >= 15 && tailSum <= 27 && inBand(line, 115, 185)) return line;
        }
        return null;
    },
    weekdayLadder: (p, t, r, ctx) => {
        const diff = RANGE49.map((b) => Math.abs(ctx.monRate[b - 1] - ctx.thuRate[b - 1]));
        const star = RANGE49.filter((b) => !inMask(ctx, b)).sort((a, b) => diff[b - 1] - diff[a - 1] || a - b)[0];
        if (star == null) return null;
        const medians = [5, 14, 21, 28, 35, 44];
        const ladder = new Set();
        for (const m of medians) for (let d = -3; d <= 3; d++) if (!inMask(ctx, m + d) && m + d !== star) ladder.add(m + d);
        const rest = sampleK(r, [...ladder], 5);
        const line = sortAsc([star, ...rest]);
        return new Set(line).size === 6 && inBand(line, 115, 185) ? line : null;
    },
    weekdaySplit: (p, t, r, ctx) => {
        const dayRate = ctx.weekday === "Mon" ? ctx.monRate : ctx.thuRate;
        return signalLine(ctx, r, Float64Array.from({ length: 49 }, (_, i) => dayRate[i] - ctx.freq[i] / Math.max(1, ctx.n)));
    },

    // --- Pattern (9) ---------------------------------------------------------
    antiDiag: (p, t, r, ctx) => setLine(ctx, [7, 13, 19, 25, 31, 37, 43], { masked: true }),
    centerCross: (p, t, r, ctx) =>
        setLine(ctx, [22, 29, 36, 43, 4, 11, 18, 25, 32, 39, 46], { masked: true }),
    corners: (p, t, r, ctx) => completeLine(ctx, unmasked(ctx, [1, 7, 43, 49])),
    geoPattern: (p, t, r, ctx) => {
        const start = randInt(r, 1, 9);
        const g = randInt(r, 2, 4);
        const ratio = [1.3, 1.5, 1.7, 2][randInt(r, 0, 3)];
        const line = [start];
        let gap = g;
        while (line.length < 6) {
            const next = Math.round(line[line.length - 1] + gap);
            if (next > 49 || next <= line[line.length - 1]) return null;
            line.push(next);
            gap *= ratio;
        }
        const sorted = sortAsc(line);
        return inBand(sorted, 115, 185) ? sorted : null;
    },
    goldenPhi: (p, t, r, ctx) => {
        const balls = [];
        for (let k = 1; k <= 8 && balls.length < 6; k++) {
            const b = Math.floor(((k * 49 * 0.618) % 49)) + 1;
            if (!balls.includes(b) && !inMask(ctx, b)) balls.push(b);
        }
        return completeLine(ctx, balls);
    },
    lattice6: (p, t, r, ctx) => latticeLine(ctx, 6),
    lattice8: (p, t, r, ctx) => latticeLine(ctx, 8),
    lattice9: (p, t, r, ctx) => latticeLine(ctx, 9),
    phiPhase2: (p, t, r, ctx) => {
        const balls = [];
        for (let k = 1; k <= 8 && balls.length < 6; k++) {
            const b = Math.floor(((k * 49 * 0.618 + 49 * 0.382) % 49)) + 1;
            if (!balls.includes(b) && !inMask(ctx, b)) balls.push(b);
        }
        return completeLine(ctx, balls);
    },

    // --- Sum Band (6) --------------------------------------------------------
    digitRoot: (p, t, r, ctx) => {
        const classFreq = new Array(10).fill(0);
        for (let b = 1; b <= 49; b++) classFreq[digitRoot(b)] += ctx.freq[b - 1];
        return signalLine(ctx, r, Float64Array.from({ length: 49 }, (_, i) => classFreq[digitRoot(i + 1)]));
    },
    mod9Root7: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        const roots = unmasked(ctx, digitRootSet(7)).sort((a, b) => ens[b - 1] - ens[a - 1]);
        const seeds = roots.slice(0, 3);
        const oddSeeds = seeds.filter((b) => b % 2 === 1).length;
        const board = unmasked(ctx, RANGE49).sort((a, b) => ens[b - 1] - ens[a - 1]);
        const oddPool = board.filter((b) => b % 2 === 1);
        const evenPool = board.filter((b) => b % 2 === 0);
        const fillCount = 6 - seeds.length;
        const oddFills = Math.max(0, Math.min(fillCount, 3 - oddSeeds));
        const evenFills = fillCount - oddFills;
        if (oddPool.length < oddFills || evenPool.length < evenFills) return null;
        const fills = [...sampleK(r, oddPool, oddFills), ...sampleK(r, evenPool, evenFills)];
        const line = sortAsc([...seeds, ...fills]);
        if (new Set(line).size < 6) return null;
        return inBand(line, 115, 185) && consecPairs(line) === 0 ? line : null;
    },
    sumBal: (p, t, r, ctx) => {
        const lo = Math.max(100, Math.round(ctx.meanSum20 - ctx.sdSum20));
        const hi = Math.min(190, Math.round(ctx.meanSum20 + ctx.sdSum20));
        return signalLine(ctx, r, ensembleScore(ctx), lo, hi);
    },
    sumMomentum: (p, t, r, ctx) => signalLineWide(ctx, r, ctxMemo(ctx, "sumTrend", (c) => sumTrendScores(p, 60))),
    sumOLS: (p, t, r, ctx) => signalLine(ctx, r, ctxMemo(ctx, "ols", (c) => olsLagScores(p))),
    sumTrendTilt: (p, t, r, ctx) => {
        const mean12 = p.slice(-12).reduce((a, d) => a + lineSum(d.numbers), 0) / Math.max(1, Math.min(12, p.length));
        const lo = mean12 < 149.5 ? 155 : 120;
        const hi = mean12 < 149.5 ? 180 : 145;
        return signalLine(ctx, r, ensembleScore(ctx), lo, hi);
    },

    // --- Numerology / Decades / Triples / Controls ---------------------------
    grandSumWheel: (p, t, r, ctx) => completeLine(ctx, [(ctx.last3Sum % 49) + 1]),
    decadeDeficit50: (p, t, r, ctx) => {
        const deficit = new Array(5).fill(0).map((_, d) => (50 * 6 * (d === 4 ? 9 : 10)) / 49 - ctx.dec50[d]);
        const worst = deficit.indexOf(Math.max(...deficit));
        const ens = ensembleScore(ctx);
        const seeds = unmasked(ctx, RANGE49.filter((b) => decadeOf(b) === worst))
            .sort((a, b) => ens[b - 1] - ens[a - 1])
            .slice(0, 2);
        const rest = ensFill(ctx, r, 6 - seeds.length, new Set(seeds));
        return sortAsc([...seeds, ...rest]);
    },
    tripleAnchor: (p, t, r, ctx) => {
        const tripleCounts = triplesOf(ctx, p);
        const [topKey] = [...tripleCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null];
        const anchor = topKey ? topKey.split("-").map(Number) : [];
        const pool = ensTop(ctx, 18);
        const board = unmasked(ctx, RANGE49);
        const stages = [
            [true, pool, 60],
            [false, pool, 60],
            [false, board, 120],
        ];
        for (const [useAnchor, stagePool, attempts] of stages) {
            for (let attempt = 0; attempt < attempts; attempt++) {
                const seeds = useAnchor ? anchor : [];
                const fills = sampleK(r, stagePool.filter((b) => !seeds.includes(b)), 6 - seeds.length);
                const line = sortAsc([...seeds, ...fills]);
                if (new Set(line).size < 6) continue;
                const s = lineSum(line);
                const residues = new Set(line.map(residueOf)).size;
                if (
                    distinctTails(line) >= 5 &&
                    s >= 115 &&
                    s <= 185 &&
                    oddCount(line) === 3 &&
                    line.filter(isLow).length === 3 &&
                    residues >= 5
                ) {
                    return line;
                }
            }
        }
        return null;
    },
    quickpick: (p, t, r, ctx) => sortAsc(sampleK(r, unmasked(ctx, RANGE49), 6)),
};

// ---------------------------------------------------------------------------
// Helpers that close over the rules above (declared after use is fine for
// function declarations, but these are consts — declared here, used in the
// object literal above via hoisting-safe arrow indirection).
// ---------------------------------------------------------------------------

function inBand(line, lo, hi) {
    const s = lineSum(line);
    return s >= lo && s <= hi;
}

/**
 * AC-exact constructive search: widen the ensemble pool stepwise until a
 * qualifying subset exists — the doc's "ensemble top pool" is unbounded, and
 * a deterministic search that returns null would trip the rejection cap.
 */
function acLockLine(ctx, targetAc) {
    return ctxMemo(ctx, `ac${targetAc}`, (c) => {
        const ens = ensembleScore(c);
        const grade = (l) => (acValue(l) === targetAc && inBand(l, 115, 185) ? l.reduce((a, b) => a + ens[b - 1], 0) : null);
        for (const size of [14, 18, 24]) {
            const line = bestSubset(ensTop(c, size), 6, grade);
            if (line) return line;
        }
        return bestSubset(unmasked(c, RANGE49), 6, grade);
    });
}

function haloSignal(ctx, rng, distances) {
    const last = ctx.last?.numbers ?? [];
    const lastSet = new Set(last);
    const scores = new Float64Array(49);
    for (let b = 1; b <= 49; b++) {
        let inHalo = false;
        for (const n of last) {
            const d = Math.abs(b - n);
            if (distances.includes(d) && !lastSet.has(b)) {
                inHalo = true;
                break;
            }
        }
        scores[b - 1] = inHalo ? ctx.freq[b - 1] : 0;
    }
    return signalLine(ctx, rng, scores);
}

function lagRepeatSignal(p, ctx, rng, lag) {
    const draw = p.length >= lag ? p[p.length - lag].numbers : [];
    return signalLine(ctx, rng, Float64Array.from({ length: 49 }, (_, i) => (draw.includes(i + 1) ? 1000 : 0)));
}

function shiftLine(ctx, k) {
    return completeLine(ctx, unmasked(ctx, (ctx.last?.numbers ?? []).map((n) => shiftBall(n, k))));
}

function wheelKeys(ctx, rng, kind) {
    const ranked = RANGE49.slice().sort((a, b) => (kind === "hot" ? ctx.freq[b - 1] - ctx.freq[a - 1] : ctx.freq[a - 1] - ctx.freq[b - 1]) || a - b);
    const keys = unmasked(ctx, ranked).slice(0, 3);
    if (keys.length < 3) return null;
    const rest = ensFill(ctx, rng, 3, new Set(keys));
    const line = sortAsc([...keys, ...rest]);
    return inBand(line, 115, 185) ? line : null;
}

function oddHighLine(ctx, rng, oddN, highN) {
    const ens = ensembleScore(ctx);
    const board = unmasked(ctx, RANGE49).sort((a, b) => ens[b - 1] - ens[a - 1]);
    const odds = board.filter((b) => b % 2 === 1);
    const highs = board.filter(isHigh);
    const picks = [...sampleK(rng, odds, Math.min(oddN, odds.length))];
    if (highN > 0) picks.push(...sampleK(rng, highs.filter((b) => !picks.includes(b)), Math.min(highN, 6 - picks.length)));
    const line = sortAsc(picks);
    if (new Set(line).size < 6) {
        const rest = ensFill(ctx, rng, 6 - new Set(line).size, new Set(line));
        line.push(...rest);
        line.sort((a, b) => a - b);
    }
    return inBand(line, 115, 185) ? line : null;
}

function classLine(ctx, rng, modulus, classOf) {
    const classes = [...new Set(RANGE49.map(classOf))];
    const ens = ensembleScore(ctx);
    const picks = sampleK(rng, classes, 6);
    const line = [];
    for (const cls of picks) {
        // sample among the class's top-3 ensemble members — the single
        // ens-best member makes the line deterministic per class set, which
        // can miss the sum band for every one of the C(k,6) class choices.
        const members = unmasked(ctx, RANGE49.filter((n) => classOf(n) === cls))
            .sort((a, b) => ens[b - 1] - ens[a - 1])
            .slice(0, 3);
        const member = members.length > 0 ? members[Math.floor(rng() * members.length)] : null;
        if (member != null) line.push(member);
    }
    if (new Set(line).size < 6) return null;
    return inBand(sortAsc(line), 115, 185) ? sortAsc(line) : null;
}

function tailPatternLine(ctx, rng, avoidHot) {
    const tails = sampleK(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
    let dup = tails[0];
    if (avoidHot) {
        const cold = tails.filter((d) => ctx.tail3[d] === 0);
        const pool = cold.length > 0 ? cold : tails.slice().sort((a, b) => ctx.tail3[a] - ctx.tail3[b]);
        dup = pool[0];
    } else {
        dup = tails[Math.floor(rng() * tails.length)];
    }
    const ens = ensembleScore(ctx);
    const picks = [];
    for (const d of tails) {
        const members = unmasked(ctx, RANGE49.filter((b) => b % 10 === d))
            .sort((a, b) => ens[b - 1] - ens[a - 1])
            .slice(0, 3);
        const take = d === dup ? 2 : 1;
        picks.push(...sampleK(rng, members, Math.min(take, members.length)));
    }
    const line = sortAsc(picks);
    if (new Set(line).size < 6) return null;
    const tailCounts = new Map(line.map((b) => [b % 10, 0]));
    for (const b of line) tailCounts.set(b % 10, tailCounts.get(b % 10) + 1);
    const pattern = [...tailCounts.values()].sort((a, b) => b - a).join("");
    if (pattern !== "21111") return null;
    return inBand(line, 115, 185) ? line : null;
}

function latticeLine(ctx, step) {
    const ens = ensembleScore(ctx);
    const anchor = unmasked(ctx, RANGE49).sort((a, b) => ens[b - 1] - ens[a - 1])[0];
    if (anchor == null) return null;
    const balls = [];
    for (let k = 0; k < 6; k++) {
        const b = shiftBall(anchor, k * step);
        if (!balls.includes(b)) balls.push(b);
    }
    return completeLine(ctx, unmasked(ctx, balls));
}

function sumTrendScores(p, window) {
    const draws = p.slice(-window);
    const sums = draws.map((d) => lineSum(d.numbers));
    const meanSum = sums.reduce((a, b) => a + b, 0) / Math.max(1, sums.length);
    const scores = new Float64Array(49);
    for (let b = 1; b <= 49; b++) {
        const hits = draws.map((d) => (d.numbers.includes(b) ? 1 : 0));
        const meanHit = hits.reduce((a, x) => a + x, 0) / Math.max(1, hits.length);
        let cov = 0;
        let varH = 0;
        let varS = 0;
        for (let i = 0; i < draws.length; i++) {
            const dh = hits[i] - meanHit;
            const ds = sums[i] - meanSum;
            cov += dh * ds;
            varH += dh * dh;
            varS += ds * ds;
        }
        scores[b - 1] = varH > 0 && varS > 0 ? cov / Math.sqrt(varH * varS) : 0;
    }
    return scores;
}

/** Ridge OLS (λ=1e-6): per-ball hit indicator on its five lag indicators. */
function olsLagScores(p) {
    const n = p.length;
    if (n < 8) return new Float64Array(49);
    const window = Math.min(n - 5, 300);
    // present[b][t] = 1 when ball b+1 hit draw t — built in one pass.
    const present = Array.from({ length: 49 }, () => new Uint8Array(n));
    for (let t = 0; t < n; t++) for (const num of p[t].numbers) present[num - 1][t] = 1;
    const scores = new Float64Array(49);
    const lambda = 1e-6;
    for (let b = 0; b < 49; b++) {
        const hit = present[b];
        const XtX = Array.from({ length: 5 }, () => new Array(5).fill(0));
        const Xty = new Array(5).fill(0);
        const cur = new Array(5).fill(0);
        for (let t = n - window; t < n; t++) {
            const x0 = hit[t - 1];
            const x1 = hit[t - 2];
            const x2 = hit[t - 3];
            const x3 = hit[t - 4];
            const x4 = hit[t - 5];
            const x = [x0, x1, x2, x3, x4];
            const y = hit[t];
            for (let i = 0; i < 5; i++) {
                if (x[i] === 0) continue;
                Xty[i] += y;
                for (let j = 0; j < 5; j++) XtX[i][j] += x[j];
            }
            if (t === n - 1) for (let i = 0; i < 5; i++) cur[i] = x[i];
        }
        for (let i = 0; i < 5; i++) XtX[i][i] += lambda;
        const beta = solveLinear(XtX, Xty);
        if (beta) scores[b] = beta.reduce((a, v, i) => a + v * cur[i], 0);
    }
    return scores;
}

function tailsClassSize(d) {
    return RANGE49.filter((b) => b % 10 === d).length;
}

export const CATALOG_STRUCTURE_ROWS = [
    // Sequences → merged family "Sequence" (24)
    ["catalan", "Sequence", "Catalan {1,2,5,14,42} + fill."],
    ["eulerLucky", "Sequence", "Euler lucky [1, 3, 7, 9, 13, 15, 21, 25, 31, 33, 37, 43, 45, 49] by recency."],
    ["factorial", "Sequence", "{1,2,6,24} + fill."],
    ["fibCount1", "Sequence", "Exactly 1 Fibonacci member, ensemble-ranked."],
    ["fibLast6", "Sequence", "The Fibonacci set [1, 2, 3, 5, 8, 13, 21, 34] (8 members) — last 6 by recency, masked."],
    ["fiboSeq", "Sequence", "Fibonacci [1, 2, 3, 5, 8, 13, 21, 34] by recency."],
    ["hexagonal", "Sequence", "Hexagonal {1,6,15,28,45} + fill."],
    ["lucas", "Sequence", "Lucas {1,3,4,7,11,18,29,47} by recency."],
    ["padovan", "Sequence", "Padovan [1, 2, 3, 5, 7, 9, 12, 16, 21, 28, 37, 49] by recency."],
    ["pell", "Sequence", "Pell {1,2,5,12,29} + fill."],
    ["pentagonal", "Sequence", "Pentagonal {1,5,12,22,35} + fill."],
    ["piDigits", "Sequence", "Digits of π = 3.14159... read as ball numbers (3,14,15,9,2,6 style chunking), masked fill."],
    ["pow2", "Sequence", "Powers of two {1,2,4,8,16,32} — masked fill only if a member was drawn last (rare)."],
    ["pow3", "Sequence", "{1,3,9,27} + ensemble fill."],
    ["primeCount2", "Sequence", "Exactly 2 primes in the line, ensemble-ranked."],
    ["primeSeq", "Sequence", "Primes [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47] by recency, top-6 masked."],
    ["primesHigh", "Sequence", "High primes {37,41,43,47} extended by recency ranking."],
    ["semiprime", "Sequence", "Semiprimes [4, 6, 9, 10, 14, 15, 21, 22, 25, 26, 33, 34, 35, 38, 39, 46, 49] by recency."],
    ["squareSeq", "Sequence", "Squares {1,4,9,16,25,36,49} with lowest-unblocked fill (dry-list fallback)."],
    ["squaresB", "Sequence", "Squares variant B + fill."],
    ["triLast6", "Sequence", "Last 6 triangulars ≤49 from [1, 3, 6, 10, 15, 21, 28, 36, 45]."],
    ["triangular", "Sequence", "Triangular numbers [1, 3, 6, 10, 15, 21, 28, 36, 45] by recency."],
    ["tribonacci", "Sequence", "Tribonacci sequence (each term = sum of previous three: 1,2,4,7,13,24,44) projected onto the board, recency-ranked, masked fill."],
    ["ulamLucky", "Sequence", "Ulam lucky numbers [1, 3, 7, 9, 13, 15, 21, 25, 31, 33, 37, 43, 45, 49] by recency."],
    // Sequence (20)
    ["antiMarkov", "Sequence", "NEGATIVE lag-1 Markov lift — fade the conditional risers."],
    ["carryCombo", "Sequence", "1 repeater from the last draw (mask bypass by thesis) + 1 ±1-halo neighbor + 4 structural fills."],
    ["consecDue200", "Sequence", "The consecutive pair longest unseen in the last 200 draws seeds the line; ensemble fill."],
    ["haloSniper", "Sequence", "Exactly one ball from the ±1 halo of the previous draw (surge+ensemble ranked), the rest ensemble."],
    ["lag2Mirror", "Sequence", "Members of the draw 2 back that sit in the all-time top-30 frequency; masked fill."],
    ["markov", "Sequence", "Lag-1 Markov lift per ball: P(ball hits | it hit in the previous draw), estimated over all history: count(hit at t AND hit at t-1) / count(hit at t-1)."],
    ["markov2", "Sequence", "Lag-2 Markov lift: P(hit | ball hit exactly 2 draws ago)."],
    ["markov3", "Sequence", "Lag-3 Markov lift: P(hit | ball hit exactly 3 draws ago)."],
    ["mirror2", "Sequence", "50 − n of the draw 2 back."],
    ["mirror50", "Sequence", "50 − n for each of the previous draw's balls; masked fill."],
    ["neighbor", "Sequence", "Hit frequency inside the ±2/±3 halo (balls at distance 2-3 from any previous-draw ball)."],
    ["neighbor2", "Sequence", "Hit rate inside the ±2 halo of the previous draw."],
    ["neighbor3", "Sequence", "Hit rate inside the ±3 halo of the previous draw."],
    ["repeat", "Sequence", "Start from the previous draw's exact 6 balls; the no-recycle mask then replaces every one of them with the next-highest ensemble ball — effectively the closest-allowed echo of the last draw."],
    ["repeat2", "Sequence", "Balls that hit exactly 2 draws ago (lag-2 repeat candidates)."],
    ["repeat3", "Sequence", "Balls that hit exactly 3 draws ago."],
    ["shift12", "Sequence", "Previous draw's balls +12 (wrap)."],
    ["shift24", "Sequence", "Previous draw's balls +24 (wrap)."],
    ["shift3", "Sequence", "Previous draw's balls +3 (wrap 1-49)."],
    ["shift7", "Sequence", "Previous draw's balls +7 (wrap)."],
    // Structure (44)
    ["acLock7", "Structure", "AC value (distinct pairwise differences − 5) exactly 7; sum 115-185."],
    ["acLock9", "Structure", "AC exactly 9; sum 115-185."],
    ["addlAvoid", "Structure", "NEGATIVE of addlRecent."],
    ["addlChase", "Structure", "Era count of each ball appearing as the ADDITIONAL number — chase the most frequent 7th balls."],
    ["addlRecent", "Structure", "Recent additional balls (era additional-ball counts) as main candidates."],
    ["codex4", "Structure", "4-ball codex core (top-4 ensemble) + 2 structural fills inside the sum band."],
    ["codexPlaySkip", "Structure", "From the top-14 ensemble pool pick the 6-ball line maximising ensemble score subject to a target odd-count parity template; if no line matches the parity target, fall back to the plain top-6."],
    ["decade", "Structure", "From the ensemble top pool, maximise number of decades (0-9,10-19,20-29,30-39,40-49) touched, then ensemble score."],
    ["deltaSys", "Structure", "Choose 6 balls whose 5 sorted gaps minimise total deviation from the empirical mean delta profile (mean gap 7.2); ensemble tiebreak."],
    ["drawParity", "Structure", "Parity class of the draw number mapped onto the board (draw# mod 2 selects two complementary half-boards, ranked)."],
    ["dualRuns", "Structure", "The two highest-count historical consecutive pairs (e.g. 22-23, 48-49) + 2 ensemble fills."],
    ["highLow33", "Structure", "Exactly 3 low (≤24) / 3 high."],
    ["keyWheel", "Structure", "2-3 key balls (frequency core) wheeled with coverage blocks inside the sum band."],
    ["keyWheelCold", "Structure", "Wheel anchored on the COLDEST key balls."],
    ["ladderAnchor", "Structure", "Narrow windows around the empirical sorted-position medians — P1∈3-7, P2∈12-18, P3∈18-24, P4∈27-33, P5∈36-42, P6∈43-48 — depth-4 DFS for the highest-ensemble line with span 36-43."],
    ["loShuGrid", "Structure", "Lo Shu magic square cells of the draw date's digits; the corresponding board positions."],
    ["lockModal33", "Structure", "Exactly 3 odd AND exactly 3 low (≤24); sum 115-185 with a preference weighting for 140-175."],
    ["megaBalance", "Structure", "ALL locks at once — 3 odd/3 even, ≥5 decades, ≥5 tails, sum 140-175, AC ≥7, ensemble-ranked."],
    ["mirrorPair50", "Structure", "One mirror pair (n, 50−n) from the ensemble top + structural fill."],
    ["mod10Line", "Structure", "One ball per distinct last digit (mod-10)."],
    ["mod11Line", "Structure", "One ball per mod-11 class."],
    ["mod16Line", "Structure", "One ball per mod-16 class."],
    ["mod6Line", "Structure", "One ball per mod-6 class (6,12,18,... steps)."],
    ["mod7Bal", "Structure", "7 mod-7 classes; drop the coldest class by all-time count, take the hottest member of each remaining class."],
    ["mod9Line", "Structure", "The residue-4 class {4,13,22,31,40,49} by recency, masked fill."],
    ["odd24high24", "Structure", "Exactly 2 odd / 4 high (≥25)."],
    ["odd24high42", "Structure", "2 odd / 4 high variant B."],
    ["odd42high24", "Structure", "4 odd / 2 high."],
    ["odd42high42", "Structure", "4 odd / 4 high."],
    ["odd51", "Structure", "5 odd / 1 even."],
    ["parity33", "Structure", "Enumerate C(k,6) from the ensemble's top pool; keep lines with exactly 3 odd / 3 even; pick the highest summed ensemble score."],
    ["parityAny", "Structure", "Plain ensemble ranking, no parity constraint (control for the parity family)."],
    ["posEdgeLadder", "Structure", "The all-time hottest ball in sorted position 1 (lowest ball of draws) + hottest in position 6 + ensemble ladder fill."],
    ["positional", "Structure", "For each sorted position i=1..6, take the most frequent ball in that position's window (P1:1-14, P2:7-21, P3:14-28, P4:22-36, P5:29-43, P6:36-49) over the last 200 draws; masked."],
    ["primeCount3", "Structure", "Exactly 3 primes — the modal prime count; sum 115-185."],
    ["sectorDef", "Structure", "Decade deficit: (expected − observed) appearances per decade over the trailing window — load the most under-drawn sector."],
    ["seg7Due", "Structure", "Segment deficit: for each of 7 board segments, (expected − observed) appearances over the trailing 50 draws, normalised per segment width — load the most under-drawn segment."],
    ["tail2Resonance", "Structure", "The tail-2 cluster {2,12,22,32} (unblocked members) + the highest-z partner + ensemble fill."],
    ["tail5Modal", "Structure", "Exactly 5 distinct tails (one duplicated pair — the modal 43% pattern); the duplicated tail must not be hot in the last 3 draws."],
    ["tailDeficit30", "Structure", "One ball from each of the 3 most under-drawn tail digits in the last 30 draws + ensemble fill."],
    ["tailDigit", "Structure", "Line with exactly one doubled last digit (tail pattern 2-1-1-1-1), ensemble-ranked otherwise."],
    ["tailSumModal", "Structure", "Last-digit sum inside the modal 15-27 band, sum 115-185."],
    ["weekdayLadder", "Structure", "The weekday-favoured star ball (max Mon-vs-Thu rate differential, walk-forward) + fills near the sorted-position medians (5,14,21,28,35,44) ±3."],
    ["weekdaySplit", "Structure", "Appearance rate conditioned on weekday (Mon vs Thu) differential — play the next-weekday's historically stronger balls."],
    // Pattern (9)
    ["antiDiag", "Pattern", "The anti-diagonal cells of the 7x7 board mapped to balls, + masked fill."],
    ["centerCross", "Pattern", "Center row 4 ∪ column 4 of the 7x7 grid {22,29,36,43, 4,11,18,25,32,39,46} — 6 by recency, masked."],
    ["corners", "Pattern", "Board corners {1,7,43,49} + ensemble fill."],
    ["geoPattern", "Pattern", "Geometric-progression gaps between sorted picks."],
    ["goldenPhi", "Pattern", "φ-spaced positions 49·k·0.618 mapped to balls."],
    ["lattice6", "Pattern", "6-step lattice spacing anchored at frequency leaders."],
    ["lattice8", "Pattern", "8-step lattice anchored at ensemble leaders."],
    ["lattice9", "Pattern", "9-step lattice."],
    ["phiPhase2", "Pattern", "φ phase-2 spacing variant."],
    // Sum Band (6)
    ["digitRoot", "Sum Band", "Digital-root frequency: balls grouped by digit root (1-9); play the hottest root class members; fallback sumMomentum."],
    ["mod9Root7", "Sum Band", "3 balls from the digital-root-7 set {7,16,25,34,43} (ensemble-ranked, mask may drop members) + parity-balanced ensemble fills; no consecutive pairs."],
    ["sumBal", "Sum Band", "Frequency-ranked with sum steered to the historical mean band."],
    ["sumMomentum", "Sum Band", "Momentum of the draw-sum time series — balls whose appearances co-move with rising draw sums (hit-weighted sum trend correlation)."],
    ["sumOLS", "Sum Band", "Ordinary-least-squares fit: next-draw appearance vector regressed on recent-window features (hit rates at lags) — the regression's fitted propensity."],
    ["sumTrendTilt", "Sum Band", "If the last-12-draw mean sum < 149.5 target 155-180, else target 120-145 — anti-trend sum tilt."],
    // Numerology / Decades / Triples / Controls
    ["grandSumWheel", "Numerology", "Seed = (sum of the last 3 draws' main balls) mod 49 + 1; ensemble fill."],
    ["decadeDeficit50", "Decades", "The decade most under-drawn over the last 50 draws vs expectation contributes 2 seeds; the rest ensemble fill."],
    ["tripleAnchor", "Triples", "Seed the top historical triple (count-based, walk-forward); fill 3 to satisfy 5 distinct tails + sum 115-185 + 3odd/3low + ≥5 residues; discard anchor if impossible."],
    ["quickpick", "Controls", "Seeded uniform random 6-of-49 from balls not in the last draw. The honest chance baseline."],
];

/** The league rows this module evaluates. */
export const CATALOG_STRUCTURE_STRATEGIES = CATALOG_STRUCTURE_ROWS.map(([id, family, description]) => [id, nameOf(id), family, description]);

// Module 2 = 107 net-new rows; rules and rows must stay in lockstep.
if (CATALOG_STRUCTURE_STRATEGIES.length !== 107) {
    throw new Error(`catalog-structure manifest drift: ${CATALOG_STRUCTURE_STRATEGIES.length} ≠ 107`);
}
const ruleIds2 = Object.keys(CATALOG_STRUCTURE_RULES);
if (ruleIds2.length !== CATALOG_STRUCTURE_STRATEGIES.length) {
    throw new Error(`catalog-structure rule/strategy drift: ${ruleIds2.length} rules vs ${CATALOG_STRUCTURE_STRATEGIES.length} rows`);
}
for (const [id] of CATALOG_STRUCTURE_STRATEGIES) {
    if (!CATALOG_STRUCTURE_RULES[id]) throw new Error(`catalog-structure missing rule: ${id}`);
}
