// toto.sg — the 276-strategy catalog adoption (waves: doc of 8 Nov 2026).
//
// Source of truth: /Users/dev/Downloads/TOTO_All_276_Strategy_Specifications.docx
// ("TOTO Strategy Library — Complete Working Specifications", 276 strategies in
// 23 families). This module is the FIRST of four catalog modules and carries the
// adoption manifest that is the count authority for the whole adoption:
// the final league must hold 64 existing rows + 246 net-new rows = 310.
//
// SKIP-LIST — 30 doc strategies NOT ported (already in the league under the
// same or a renamed id; the plan prose says 31, the enumerated list below is
// definitive and yields 276 − 30 = 246 net-new):
//   same id: gapBandReturn, skip0Echo, twin45, shapeJoint, clusterDensity,
//            coverGreedy, sumPosterior, acLock8, eraBridge, quantileBand,
//            gapGradient, decadeTwinAnchor
//   renamed: hollowBarbell→hollowMiddleBarbell, acMaxEntropy→maxEntropy,
//            logitCal→calibratedLogit, velocitySurf→velocitySurfer,
//            droughtBorder→droughtBorderStraddle, mistikBaru→togelMistikBaru,
//            rook6→playslipSixRooks, zHubMomentum→zScoreHub,
//            rankFusion→consensusStack, antiEns→contrarianConsensusFade,
//            lagMix→lagMixCarry, zeroRepZeroConsec→noRepeatClean,
//            weekdayRegime→weekdayRegimeSwitch, tail6Distinct→sixTails,
//            mod9Cover→mod9Coverage, matrixPeak→bellCurvePeak,
//            primeTwins→primeMirrorComposite, pairNeutral→repulsionExclusion
//
// ADOPTION MANIFEST — every net-new id in document order, family → module
//   [S] = this module (catalog-signal-rules.mjs, 53)
//   [T] = catalog-structure-rules.mjs (107)
//   [A] = catalog-almanac-rules.mjs (81)
//   [M] = catalog-ml-rules.mjs (5)
//
//   Other (48) [A]: addlTailChase affinityAnchor alternatorChase apTrio dateWheel
//     digitSumLadder drawWheel equalSpread8 ewma10 ewma100 ewma20 ewma200 ewma25
//     ewma75 fibGaps haloExpand heSumParity hitMissEdge ignition2of10 pairSum51
//     repeatOfRepeat sandwichLine shapeAllHigh34 shapeHighSum shapeLift shapeLowSum
//     shapeWideSpan skipBounce spectralComm sumTgt120 sumTgt135 sumTgt165 sumTgt180
//     tailHotPair twiceFive zigzagParity zodBuffalo zodCat zodDog zodDragon
//     zodGoat zodHorse zodMonkey zodPig zodRat zodRooster zodSnake zodTiger
//   Structure (44) [T]: acLock7 acLock9 addlAvoid addlChase addlRecent codex4
//     codexPlaySkip decade deltaSys drawParity dualRuns highLow33 keyWheel
//     keyWheelCold ladderAnchor loShuGrid lockModal33 megaBalance mirrorPair50
//     mod10Line mod11Line mod16Line mod6Line mod7Bal mod9Line odd24high24
//     odd24high42 odd42high24 odd42high42 odd51 parity33 parityAny posEdgeLadder
//     positional primeCount3 sectorDef seg7Due tail2Resonance tail5Modal
//     tailDeficit30 tailDigit tailSumModal weekdayLadder weekdaySplit
//   Sequences → merged into family "Sequence" (24) [T]: catalan eulerLucky
//     factorial fibCount1 fibLast6 fiboSeq hexagonal lucas padovan pell pentagonal
//     piDigits pow2 pow3 primeCount2 primeSeq primesHigh semiprime squareSeq
//     squaresB triLast6 triangular tribonacci ulamLucky
//   Sequence (20) [T]: antiMarkov carryCombo consecDue200 haloSniper lag2Mirror
//     markov markov2 markov3 mirror2 mirror50 neighbor neighbor2 neighbor3 repeat
//     repeat2 repeat3 shift12 shift24 shift3 shift7
//   Hot & Cold (16) [S]: cold100 cold200 cold30 cold500 coldAll hot10 hot100
//     hot150 hot20 hot200 hot30 hot300 hot40 hot500 hot60 hotEWMA
//   Almanac & Time (12) [A]: biorhythm dayHexagram dayOfficers dayRoot
//     flyStarAnnual flyStarMonthly mansion28 moonAge moonList plumBlossom sunSign
//     wealthGod
//   Gap & Due (9) [S]: bounceBack gapHarm gapOwn gapZ overdue skip12_20 skip2_4
//     skip8_12 skipFFG
//   Folk & Culture (10) [A]: angelNum bolakBalik digit3 digit7 digit8 fsTrio
//     lucky8 noFour yearHorse zodiac2026
//   Mark Six Charts (11) [A]: colorBlue colorFollow colorGreen colorRed shioFollow
//     tailFollow wuxingFire wxEarth wxMetal wxWater wxWood
//   Pairs (7) [S]: antiPairs1 pairChase pairs1 pairs10 pairs3 pairs5 tripleChase
//   Momentum (8) [S]: antiMom30 mom10 mom120 mom20 mom30 mom60 streakChase2
//     velocityFade
//   Pattern (9) [T]: antiDiag centerCross corners geoPattern goldenPhi lattice6
//     lattice8 lattice9 phiPhase2
//   Sum Band (6) [T]: digitRoot mod9Root7 sumBal sumMomentum sumOLS sumTrendTilt
//   Blends (6) [S]: barbellHotCold coldZoneRot hotCold33 hotcold15 hotcold24
//     hotcold42
//   Ensemble (3) [M]: ensemble hybridFSB metaVote
//   Frequency (2) [S]: decadeSkewCol freqAll
//   Machine Learning (2) [M]: geneticOpt simAnneal
//   Skip (3) [S]: eliteOverdue gapOwnNear skipBandLoad
//   Streaks (2) [S]: hotHand streakZig
//   Controls (1) [T]: quickpick
//   Triples (1) [T]: tripleAnchor
//   Decades (1) [T]: decadeDeficit50
//   Numerology (1) [T]: grandSumWheel
//   TOTAL: 53 + 107 + 81 + 5 = 246. League assert: rows === 64 + 246 = 310.
//
// ENCODING CONVENTIONS (doc → league contract, applied by all four modules)
//   * Every rule is deterministic per fold and strictly walk-forward; rng comes
//     only from the league (rngFor(id, drawNo)) via sampleK/randInt.
//   * SIGNAL/SCORE rules: per-ball score vector → mask-filtered rank (top-18;
//     ties break by all-time frequency, then the lower ball — zero-tied
//     indicator vectors otherwise collapse onto the lowest numbers and can
//     never reach the sum band) → sampleK(rng, pool, 6) → gates → line | null.
//   * No-recycle mask = the previous draw's 6 mains + additional ball. Applied
//     wherever the doc's PROCEDURE says so; LINE/CONSTRUCTIVE rules apply it
//     exactly where the doc says ("masked fill" = ensemble pool minus masked).
//   * Gates: doc-stated bands only; unstated bands default to lineSum 115..185
//     for rng-sampled lines. Fully deterministic constructions (fixed sets,
//     transforms, enumerations) carry NO reject-retry gate — a fixed line that
//     failed a gate would trip the 10000-rejection cap (e.g. pow2 sums to 63).
//   * "Ensemble" (the doc references the external wave-1 blend) = ensembleScore
//     below: mean of five z-normalised vectors (due, all-time freq, 30-draw
//     momentum, lag-1 Markov lift, pair affinity M @ last draw).
//   * SET/cultural one-liners are implemented in their standard published form
//     (fixed tables in catalog-almanac-rules.mjs; decisions stated per rule).
//   * Descriptions are the doc one-liners verbatim (fallacy editorialising
//     dropped), except lucky8, whose doc line is identical to digit8's and
//     carries a minimal disambiguator (verify-data.mjs requires unique text).
import {
    RANGE49,
    additionalBallCounts,
    decadeOf,
    expectedPairCoOccurrences,
    freqCounts,
    hitsInWindow,
    lineSum,
    sampleK,
    skipGaps,
    sortAsc,
    tailOf,
    TAIL_CLASSES,
    weekdayOf,
} from "./cross-panel-stats.mjs";

// ---------------------------------------------------------------------------
// Shared fold context — built once per fold, memoised by the league builder.
// Everything is computed from `prior` only (walk-forward).
// ---------------------------------------------------------------------------

/** Skip-band boundaries: {0; 1-2; 3-4; 5-7; 8-11; 12-15; 16-23; 24+}. */
export const SKIP_BANDS = [
    [0, 0],
    [1, 2],
    [3, 4],
    [5, 7],
    [8, 11],
    [12, 15],
    [16, 23],
    [24, Infinity],
];

export const bandIndexOf = (gap) => SKIP_BANDS.findIndex(([lo, hi]) => gap >= lo && gap <= hi);

const EXP_RATE = 6 / 49;
/** FFG peak: the ball's theoretical average gap is ln(2)/p draws. */
const FFG_STAR = Math.log(2) / EXP_RATE;

export const buildCatalogContext = (prior, target) => {
    const n = prior.length;
    const last = prior[n - 1] ?? null;
    const sets = prior.map((d) => new Set(d.numbers));
    const skips = skipGaps(prior);
    const freq = freqCounts(prior);

    const mask = new Set();
    if (last) {
        for (const num of last.numbers) mask.add(num);
        if (last.additional != null) mask.add(last.additional);
    }

    // Window hit counts + previous-period blocks (for momentum).
    const w = {};
    for (const k of [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 60, 100, 120, 150, 200, 250, 300, 500]) {
        w[k] = hitsInWindow(prior, k);
    }
    const prevBlock = (size) => {
        const from = Math.max(0, n - 2 * size);
        const to = Math.max(0, n - size);
        return { counts: freqCounts(prior.slice(from, to)), draws: to - from };
    };
    const prev = {
        10: prevBlock(10),
        20: prevBlock(20),
        30: prevBlock(30),
        60: prevBlock(60),
        120: prevBlock(120),
    };

    // EWMAs of hits, half-lives 10..200 — one backward pass, weights < 2^-30 dropped.
    const HLS = [10, 20, 25, 30, 75, 100, 200];
    const ewma = {};
    for (const h of HLS) ewma[h] = new Float64Array(49);
    for (let d = 0; d < n; d++) {
        for (const num of sets[n - 1 - d]) {
            for (const h of HLS) {
                if (d <= 30 * h) ewma[h][num - 1] += 2 ** (-d / h);
            }
        }
    }

    // Gap history (inter-arrival = index difference, ≥1), own mean/sd (last 400
    // gaps), harmonic mean, current streak, alternation run.
    const gapList = Array.from({ length: 49 }, () => []);
    const lastSeen = new Array(49).fill(-1);
    for (let t = 0; t < n; t++) {
        for (const num of sets[t]) {
            gapList[num - 1].push(lastSeen[num - 1] === -1 ? t + 1 : t - lastSeen[num - 1]);
            lastSeen[num - 1] = t;
        }
    }
    const gapMean = new Array(49).fill(1);
    const gapSd = new Array(49).fill(1);
    const harmGap = new Array(49).fill(1);
    for (let b = 0; b < 49; b++) {
        const g = gapList[b].slice(-400);
        if (g.length > 0) {
            const mean = g.reduce((a, x) => a + x, 0) / g.length;
            gapMean[b] = mean;
            gapSd[b] = g.length > 1 ? Math.sqrt(g.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (g.length - 1)) : 1;
            harmGap[b] = g.length / g.reduce((acc, x) => acc + 1 / Math.max(1, x), 0);
        }
    }
    const streakLen = new Array(49).fill(0);
    for (let b = 1; b <= 49; b++) {
        let s = 0;
        for (let t = n - 1; t >= 0 && sets[t].has(b); t--) s += 1;
        streakLen[b - 1] = s;
    }
    const altRun = new Float64Array(49); // signed: positive when currently absent
    for (let b = 1; b <= 49; b++) {
        let run = 1;
        let prev = sets[n - 1].has(b) ? 1 : 0;
        for (let t = n - 2; t >= 0; t--) {
            const cur = sets[t].has(b) ? 1 : 0;
            if (cur === prev) break;
            run += 1;
            prev = cur;
        }
        altRun[b - 1] = (sets[n - 1].has(b) ? -1 : 1) * run;
    }

    // Markov conditional rates, lags 1-3 (full history), hit/miss edge, hot-hand.
    const trials = [new Array(49).fill(0), new Array(49).fill(0), new Array(49).fill(0)];
    const lagHits = [new Array(49).fill(0), new Array(49).fill(0), new Array(49).fill(0)];
    for (let t = 1; t < n; t++) {
        for (let k = 1; k <= 3; k++) {
            if (t - k < 0) break;
            for (const a of sets[t - k]) {
                trials[k - 1][a - 1] += 1;
                if (sets[t].has(a)) lagHits[k - 1][a - 1] += 1;
            }
        }
    }
    const condK = (k) =>
        Array.from({ length: 49 }, (_, i) => (trials[k - 1][i] > 0 ? lagHits[k - 1][i] / trials[k - 1][i] : EXP_RATE));
    const cond1 = condK(1);
    const cond2 = condK(2);
    const cond3 = condK(3);
    // P(hit | missed t−1) − P(hit | hit t−1): the raw transition edge.
    const appearT1 = Array.from({ length: 49 }, (_, i) => freq[i] - (sets[0].has(i + 1) ? 1 : 0));
    const missTrials = Array.from({ length: 49 }, (_, i) => Math.max(0, n - 1 - trials[0][i]));
    const missHits = Array.from({ length: 49 }, (_, i) => Math.max(0, appearT1[i] - lagHits[0][i]));
    const cond0 = Array.from({ length: 49 }, (_, i) => (missTrials[i] > 0 ? missHits[i] / missTrials[i] : EXP_RATE));
    const hitMissEdge = Array.from({ length: 49 }, (_, i) => cond0[i] - cond1[i]);
    // Hot-hand: trailing-100 conditional, min 5 trials.
    const hhTrials = new Array(49).fill(0);
    const hhHits = new Array(49).fill(0);
    const hhSpan = Math.min(100, n - 1);
    for (let t = n - 1; t >= n - hhSpan && t >= 1; t--) {
        for (const a of sets[t - 1]) {
            hhTrials[a - 1] += 1;
            if (sets[t].has(a)) hhHits[a - 1] += 1;
        }
    }
    const hotHand = Array.from({ length: 49 }, (_, i) => (hhTrials[i] >= 5 ? hhHits[i] / hhTrials[i] : EXP_RATE));

    // Co-occurrence matrix (symmetric, zero diagonal) + projections.
    const M = new Float64Array(49 * 49);
    for (const draw of prior) {
        const nums = sortAsc(draw.numbers);
        for (let i = 0; i < nums.length; i++) {
            for (let j = i + 1; j < nums.length; j++) {
                M[(nums[i] - 1) * 49 + (nums[j] - 1)] += 1;
                M[(nums[j] - 1) * 49 + (nums[i] - 1)] += 1;
            }
        }
    }
    const mProj = (k) => {
        const v = w[k];
        const out = new Float64Array(49);
        for (let a = 0; a < 49; a++) {
            let s = 0;
            for (let b = 0; b < 49; b++) s += M[a * 49 + b] * v[b];
            out[a] = s;
        }
        return out;
    };

    // Pair z-scores (binomial null p = 30/2352).
    const pExp = expectedPairCoOccurrences(prior);
    const pP = 30 / (49 * 48);
    const pSd = Math.sqrt(Math.max(1e-9, n * pP * (1 - pP)));
    const pairZ = new Float64Array(49 * 49);
    for (let a = 1; a <= 49; a++) {
        for (let b = a + 1; b <= 49; b++) {
            const z = (M[(a - 1) * 49 + (b - 1)] - pExp) / pSd;
            pairZ[(a - 1) * 49 + (b - 1)] = z;
            pairZ[(b - 1) * 49 + (a - 1)] = z;
        }
    }

    // Recent tail/decade counts + deficits inputs.
    const tailCount = (win) => {
        const t = new Array(10).fill(0);
        for (let b = 1; b <= 49; b++) t[tailOf(b)] += w[win][b - 1];
        return t;
    };
    const tail20 = tailCount(20);
    const tail30 = tailCount(30);
    const tail3 = tailCount(3);
    const dec50 = new Array(5).fill(0);
    for (let b = 1; b <= 49; b++) dec50[decadeOf(b)] += w[50][b - 1];

    const addlCounts = additionalBallCounts(prior);

    // Weekday rates (Mon/Thu) per ball.
    const monCount = new Array(49).fill(0);
    const thuCount = new Array(49).fill(0);
    let monDraws = 0;
    let thuDraws = 0;
    for (const draw of prior) {
        const wd = weekdayOf(draw.date);
        if (wd === "Mon") {
            monDraws += 1;
            for (const num of draw.numbers) monCount[num - 1] += 1;
        } else if (wd === "Thu") {
            thuDraws += 1;
            for (const num of draw.numbers) thuCount[num - 1] += 1;
        }
    }
    const monRate = monCount.map((c) => (monDraws > 0 ? c / monDraws : 0));
    const thuRate = thuCount.map((c) => (thuDraws > 0 ? c / thuDraws : 0));

    // Walk-forward skip-band return table: at each t, band the ball's current
    // skip, record whether it appeared at t.
    const bandTrials = new Array(8).fill(0);
    const bandHits = new Array(8).fill(0);
    const ls = new Array(49).fill(-1);
    for (let t = 0; t < n; t++) {
        if (t > 0) {
            for (let b = 1; b <= 49; b++) {
                const band = bandIndexOf(t - 1 - ls[b - 1]);
                if (band >= 0) {
                    bandTrials[band] += 1;
                    if (sets[t].has(b)) bandHits[band] += 1;
                }
            }
        }
        for (const num of sets[t]) ls[num - 1] = t;
    }
    const bandReturn = bandTrials.map((t, i) => (t > 0 ? bandHits[i] / t : EXP_RATE));

    // Draw-sum series.
    const recentSums = prior.slice(-20).map((d) => lineSum(d.numbers));
    const meanSum20 = recentSums.reduce((a, b) => a + b, 0) / Math.max(1, recentSums.length);
    const varSum20 =
        recentSums.length > 1
            ? recentSums.reduce((acc, s) => acc + (s - meanSum20) ** 2, 0) / (recentSums.length - 1)
            : 225;
    const sdSum20 = Math.sqrt(varSum20) || 15;
    const last3Sum = prior.slice(-3).reduce((acc, d) => acc + lineSum(d.numbers), 0);

    // Calendar.
    const dateIso = target?.date ?? null;
    const dayOfYear = dateIso
        ? Math.floor((Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${dateIso.slice(0, 4)}-01-01T00:00:00Z`)) / 86400000) + 1
        : null;

    const ctx = {
        n,
        last,
        mask,
        skips,
        freq,
        w,
        prev,
        ewma,
        gapMean,
        gapSd,
        harmGap,
        streakLen,
        altRun,
        cond1,
        cond2,
        cond3,
        cond0,
        hitMissEdge,
        hotHand,
        M,
        pairZ,
        mLast: mProj(1),
        m3: mProj(3),
        m5: mProj(5),
        m10: mProj(10),
        tail20,
        tail30,
        tail3,
        dec50,
        addlCounts,
        monRate,
        thuRate,
        bandReturn,
        meanSum20,
        sdSum20,
        last3Sum,
        dateIso,
        dayOfYear,
        weekday: dateIso ? weekdayOf(dateIso) : null,
        drawNo: target?.draw ?? null,
    };
    return ctx;
};

// ---------------------------------------------------------------------------
// Shared rule machinery
// ---------------------------------------------------------------------------

const neg = (v) => Float64Array.from(v, (x) => -x);
const zVec = (v) => {
    const mean = v.reduce((a, x) => a + x, 0) / v.length;
    const sd = Math.sqrt(v.reduce((acc, x) => acc + (x - mean) ** 2, 0) / v.length) || 1;
    return Float64Array.from(v, (x) => (x - mean) / sd);
};

/**
 * The one ensemble substitute used everywhere the doc says "ensemble": mean of
 * five z-normalised vectors — due (skip ÷ own mean gap), all-time frequency,
 * 30-draw momentum, lag-1 Markov lift, pair affinity M @ last draw.
 */
export const ensembleScore = (ctx) => {
    if (ctx.__ens) return ctx.__ens;
    const due = Float64Array.from({ length: 49 }, (_, i) => ctx.skips[i] / Math.max(1, ctx.gapMean[i]));
    const mom = Float64Array.from({ length: 49 }, (_, i) => {
        const len = Math.min(30, ctx.n);
        const prevLen = Math.max(1, ctx.prev[30].draws);
        return ctx.w[30][i] / Math.max(1, len) - ctx.prev[30].counts[i] / prevLen;
    });
    const lift = Float64Array.from(ctx.cond1, (x) => x / EXP_RATE);
    const parts = [due, Float64Array.from(ctx.freq), mom, lift, ctx.mLast].map(zVec);
    const ens = new Float64Array(49);
    for (const p of parts) for (let i = 0; i < 49; i++) ens[i] += p[i] / parts.length;
    ctx.__ens = ens;
    return ens;
};

/**
 * Balls ranked by `scores` desc, mask-filtered, top `size`. Ties break by
 * all-time frequency (the doc's "form-ranked" idiom), then the lower ball —
 * zero-tied indicator vectors otherwise collapse onto the lowest numbers,
 * whose sampled lines can never reach the default sum band.
 */
export const maskedRanked = (ctx, scores, size = 18) =>
    RANGE49.filter((b) => !ctx.mask.has(b))
        .sort((a, b) => scores[b - 1] - scores[a - 1] || ctx.freq[b - 1] - ctx.freq[a - 1] || a - b)
        .slice(0, size);

/** The SIGNAL convention: top-18 masked pool → sampleK → default band gates. */
export const signalLine = (ctx, rng, scores, lo = 115, hi = 185) => {
    const pool = maskedRanked(ctx, scores);
    if (pool.length < 6) return null;
    const line = sortAsc(sampleK(rng, pool, 6));
    const sum = lineSum(line);
    if (sum < lo || sum > hi) return null;
    return line;
};

/**
 * signalLine with a feasibility fallback for sector-constant score vectors
 * (decade/segment deficits): a contiguous-sector pool may be unable to reach
 * the sum band at all, so the second stage samples the whole masked board.
 */
export const signalLineWide = (ctx, rng, scores, lo = 115, hi = 185) => {
    for (let attempt = 0; attempt < 300; attempt++) {
        const pool = attempt < 150 ? maskedRanked(ctx, scores) : RANGE49.filter((b) => !ctx.mask.has(b));
        if (pool.length < 6) return null;
        const line = sortAsc(sampleK(rng, pool, 6));
        const sum = lineSum(line);
        if (sum >= lo && sum <= hi) return line;
    }
    return null;
};

/**
 * Per-fold memoisation for deterministic rule invariants (enumerations,
 * regression fits, spectra): a gated rule's body runs once per rejection
 * retry, so fold-invariant work must be computed once, not per attempt.
 * `key` namespaces the slot on the fold context; `fn` receives the context.
 */
export const ctxMemo = (ctx, key, fn) => {
    const slot = `__m_${key}`;
    if (ctx[slot] === undefined) ctx[slot] = fn(ctx);
    return ctx[slot];
};

/** Triple co-occurrence counts over the whole prior, memoised per fold. */
export const triplesOf = (ctx, prior) =>
    ctxMemo(ctx, "triples", () => {
        const counts = new Map();
        for (const draw of prior) {
            const nums = sortAsc(draw.numbers);
            for (let i = 0; i < nums.length; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    for (let k = j + 1; k < nums.length; k++) {
                        const key = `${nums[i]}-${nums[j]}-${nums[k]}`;
                        counts.set(key, (counts.get(key) ?? 0) + 1);
                    }
                }
            }
        }
        return counts;
    });

/** Fill `k` slots from the ensemble top pool, masked, minus `taken`. */
export const ensFill = (ctx, rng, k, taken = new Set()) => {
    const pool = maskedRanked(ctx, ensembleScore(ctx)).filter((b) => !taken.has(b));
    return sampleK(rng, pool, Math.min(k, pool.length));
};

/** Ensemble top slice, masked. */
export const ensTop = (ctx, size = 14) => maskedRanked(ctx, ensembleScore(ctx), size);

/**
 * Complete fixed seeds to a 6-ball line: keep unmasked seeds (doc thesis),
 * fill the rest from the ensemble pool, masked. Deterministic seeds only —
 * callers that gate must consume rng via the fill.
 */
export const completeLine = (ctx, seeds) => {
    const set = new Set();
    for (const s of seeds) if (s >= 1 && s <= 49) set.add(s);
    for (const b of ensTop(ctx, 30)) {
        if (set.size >= 6) break;
        set.add(b);
    }
    return sortAsc([...set].slice(0, 6));
};

/** Wrap-shift one ball on the 1..49 ring. */
export const shiftBall = (n, k) => ((n - 1 + k) % 49) + 1;

/** Member list ordered by recency (most recently drawn first, ties to lower ball). */
export const byRecency = (ctx, members) =>
    [...members].sort((a, b) => ctx.skips[a - 1] - ctx.skips[b - 1] || a - b);

/** Humanised display name from a camelCase doc id (AC/FFG/EWMA/OLS/ML uppercased). */
export const nameOf = (id) => {
    const ACRONYMS = new Set(["ac", "ffg", "ewma", "ols", "ml"]);
    return id
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .replace(/(\d)([A-Za-z])/g, "$1 $2")
        .split(/\s+/)
        .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
        .join(" ");
};

// ---------------------------------------------------------------------------
// Hot & Cold — 16 (doc family "Hot & Cold")
// ---------------------------------------------------------------------------

const windowRule = (scoreOf, lo, hi) => (prior, target, rng, ctx) => signalLine(ctx, rng, scoreOf(ctx), lo, hi);

export const CATALOG_SIGNAL_RULES = {
    cold100: windowRule((c) => neg(c.w[100])),
    cold200: windowRule((c) => neg(c.w[200])),
    cold30: windowRule((c) => neg(c.w[30])),
    cold500: windowRule((c) => neg(c.w[500])),
    coldAll: windowRule((c) => neg(Float64Array.from(c.freq))),
    hot10: windowRule((c) => c.w[10]),
    hot100: windowRule((c) => c.w[100]),
    hot150: windowRule((c) => c.w[150]),
    hot20: windowRule((c) => c.w[20]),
    hot200: windowRule((c) => c.w[200]),
    hot30: windowRule((c) => c.w[30]),
    hot300: windowRule((c) => c.w[300]),
    hot40: windowRule((c) => c.w[40]),
    hot500: windowRule((c) => c.w[500]),
    hot60: windowRule((c) => c.w[60]),
    // hotEWMA uses the half-life-30 EWMA (doc: "half-life ~30 draws").
    hotEWMA: windowRule((c) => c.ewma[30]),

    // -----------------------------------------------------------------------
    // Skip — 3
    // -----------------------------------------------------------------------

    // quality × overdue-by-own-clock indicator.
    eliteOverdue: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.freq[i] * (c.skips[i] > c.gapMean[i] ? 1 : 0)),
    ),
    // sitting exactly at the own-cycle point.
    gapOwnNear: windowRule((c) => Float64Array.from({ length: 49 }, (_, i) => -Math.abs(c.skips[i] - c.gapMean[i]))),
    // 1×skip-0 repeat (deliberate mask bypass) + 3×skip 1-7 + ≤1×skip 24+, rest free.
    skipBandLoad(prior, target, rng, ctx) {
        const score = (b) => ensembleScore(ctx)[b - 1] + (ctx.w[50][b - 1] - (50 * 6) / 49);
        const line = new Set();
        const repeat = RANGE49.filter((b) => ctx.skips[b - 1] === 0).sort((a, b) => score(b) - score(a))[0];
        if (repeat != null) line.add(repeat);
        let taken = 0;
        for (const b of RANGE49.filter((x) => !ctx.mask.has(x) && ctx.skips[x - 1] >= 1 && ctx.skips[x - 1] <= 7).sort(
            (a, b) => score(b) - score(a),
        )) {
            if (taken >= 3 || line.size >= 6) break;
            line.add(b);
            taken += 1;
        }
        for (const b of RANGE49.filter((x) => !ctx.mask.has(x) && ctx.skips[x - 1] >= 24).sort((a, b) => score(b) - score(a))) {
            if (line.size >= 6) break;
            line.add(b);
            break;
        }
        for (const b of maskedRanked(ctx, ensembleScore(ctx), 30)) {
            if (line.size >= 6) break;
            line.add(b);
        }
        return sortAsc([...line]);
    },

    // -----------------------------------------------------------------------
    // Streaks — 2
    // -----------------------------------------------------------------------

    hotHand: windowRule((c) => Float64Array.from(c.hotHand)),
    streakZig: windowRule((c) => Float64Array.from(c.streakLen)),

    // -----------------------------------------------------------------------
    // Blends — 6
    // -----------------------------------------------------------------------

    // 3 hottest + 3 coldest of the last 100 draws (deterministic — no gate).
    barbellHotCold(prior, target, rng, ctx) {
        const hot = RANGE49.slice().sort((a, b) => ctx.w[100][b - 1] - ctx.w[100][a - 1] || a - b);
        const line = [...hot.slice(0, 3), ...hot.slice(-3)];
        if (new Set(line).size < 6) {
            for (const b of hot) {
                if (new Set(line).size >= 6) break;
                line.push(b);
            }
        }
        return sortAsc(line.slice(0, 6));
    },
    // hottest decade + coldest decade by 30-draw count; no-recycle refill from the rest.
    coldZoneRot(prior, target, rng, ctx) {
        const decCount = new Array(5).fill(0);
        for (let b = 1; b <= 49; b++) decCount[decadeOf(b)] += ctx.w[30][b - 1];
        const hotDec = decCount.indexOf(Math.max(...decCount));
        const coldDec = decCount.indexOf(Math.min(...decCount));
        const byCount = (pool) => pool.slice().sort((a, b) => ctx.w[30][b - 1] - ctx.w[30][a - 1] || a - b);
        const inDec = (d) => RANGE49.filter((b) => decadeOf(b) === d);
        const line = [...byCount(inDec(hotDec)).slice(0, 3), ...byCount(inDec(coldDec)).reverse().slice(0, 3)];
        if (new Set(line).size < 6) {
            for (const b of maskedRanked(ctx, ctx.w[30], 30)) {
                if (new Set(line).size >= 6) break;
                line.push(b);
            }
        }
        return sortAsc(line.slice(0, 6));
    },
    // 3 hottest + 3 coldest of the trailing window (30 — repo modal window) with banding.
    hotCold33(prior, target, rng, ctx) {
        const rank = RANGE49.slice().sort((a, b) => ctx.w[30][b - 1] - ctx.w[30][a - 1] || a - b);
        const line = [...rank.slice(0, 3), ...rank.slice(-3)];
        // Structural banding: swap the value-extreme seed for the nearest
        // free ball in the steering direction until the modal band holds.
        for (let guard = 0; guard < 24; guard++) {
            const sum = lineSum(line);
            if (sum >= 115 && sum <= 185) break;
            const sorted = sortAsc(line);
            if (sum < 115) {
                const out = sorted[0];
                const inBall = RANGE49.slice().reverse().find((b) => !line.includes(b) && b > out);
                if (inBall == null) break;
                line.splice(line.indexOf(out), 1, inBall);
            } else {
                const out = sorted[5];
                const inBall = RANGE49.find((b) => !line.includes(b) && b < out);
                if (inBall == null) break;
                line.splice(line.indexOf(out), 1, inBall);
            }
        }
        return sortAsc(line);
    },

    // -----------------------------------------------------------------------
    // Gap & Due — 9
    // -----------------------------------------------------------------------

    bounceBack: windowRule((c) => Float64Array.from({ length: 49 }, (_, i) => c.bandReturn[bandIndexOf(c.skips[i])])),
    gapHarm: windowRule((c) => Float64Array.from(c.harmGap, (x) => -x)),
    gapOwn: windowRule((c) => Float64Array.from({ length: 49 }, (_, i) => c.skips[i] / Math.max(1, c.gapMean[i]))),
    gapZ: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => (c.skips[i] - c.gapMean[i]) / Math.max(0.5, c.gapSd[i])),
    ),
    overdue: windowRule((c) => Float64Array.from(c.skips)),
    skip12_20: windowRule((c) => Float64Array.from({ length: 49 }, (_, i) => (c.skips[i] >= 12 && c.skips[i] <= 20 ? 1000 : 0))),
    skip2_4: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => (c.skips[i] >= 2 && c.skips[i] <= 4 ? 1000 : 0) + c.skips[i] * 0.001),
    ),
    skip8_12: windowRule((c) => Float64Array.from({ length: 49 }, (_, i) => (c.skips[i] >= 8 && c.skips[i] <= 12 ? 1000 : 0))),
    skipFFG: windowRule((c) => Float64Array.from({ length: 49 }, (_, i) => -Math.abs(c.skips[i] - FFG_STAR))),

    // -----------------------------------------------------------------------
    // Momentum — 8
    // -----------------------------------------------------------------------

    antiMom30: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.prev[30].counts[i] / Math.max(1, c.prev[30].draws) - c.w[30][i] / Math.max(1, Math.min(30, c.n))),
    ),
    mom10: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.w[10][i] / Math.max(1, Math.min(10, c.n)) - c.prev[10].counts[i] / Math.max(1, c.prev[10].draws)),
    ),
    mom120: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.w[120][i] / Math.max(1, Math.min(120, c.n)) - c.prev[120].counts[i] / Math.max(1, c.prev[120].draws)),
    ),
    mom20: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.w[20][i] / Math.max(1, Math.min(20, c.n)) - c.prev[20].counts[i] / Math.max(1, c.prev[20].draws)),
    ),
    mom30: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.w[30][i] / Math.max(1, Math.min(30, c.n)) - c.prev[30].counts[i] / Math.max(1, c.prev[30].draws)),
    ),
    mom60: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => c.w[60][i] / Math.max(1, Math.min(60, c.n)) - c.prev[60].counts[i] / Math.max(1, c.prev[60].draws)),
    ),
    // ≥2-draw streaks, topped with 1-draw risers, ensemble-ranked, masked.
    streakChase2: windowRule((c) =>
        Float64Array.from({ length: 49 }, (_, i) => (c.streakLen[i] >= 2 ? 1000 : 0) + ensembleScore(c)[i]),
    ),
    velocityFade: windowRule((c) =>
        Float64Array.from(
            { length: 49 },
            (_, i) => 2 * (c.freq[i] / Math.max(1, c.n)) - c.w[50][i] / Math.max(1, Math.min(50, c.n)) - c.w[10][i] / Math.max(1, Math.min(10, c.n)),
        ),
    ),

    // -----------------------------------------------------------------------
    // Frequency — 2
    // -----------------------------------------------------------------------

    // All-time leader of each of the 6 strongest last-digit columns (deterministic).
    decadeSkewCol(prior, target, rng, ctx) {
        const tailFreq = new Array(10).fill(0);
        for (let b = 1; b <= 49; b++) tailFreq[tailOf(b)] += ctx.freq[b - 1];
        const tails = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => tailFreq[b] - tailFreq[a]).slice(0, 6);
        const line = tails.map((t) => TAIL_CLASSES[t].slice().sort((a, b) => ctx.freq[b - 1] - ctx.freq[a - 1] || a - b)[0]);
        return sortAsc(line);
    },
    freqAll: windowRule((c) => Float64Array.from(c.freq)),

    // -----------------------------------------------------------------------
    // Pairs — 7
    // -----------------------------------------------------------------------

    antiPairs1: windowRule((c) => neg(c.mLast)),
    // membership strength of the top positive-z co-occurrence pairs.
    pairChase: windowRule((c) => {
        const scores = new Float64Array(49);
        const pairs = [];
        for (let a = 1; a <= 49; a++) {
            for (let b = a + 1; b <= 49; b++) {
                const z = c.pairZ[(a - 1) * 49 + (b - 1)];
                if (z > 0) pairs.push([a, b, z]);
            }
        }
        pairs.sort((x, y) => y[2] - x[2]).slice(0, 40).forEach(([a, b, z]) => {
            scores[a - 1] += z;
            scores[b - 1] += z;
        });
        return scores;
    }),
    pairs1: windowRule((c) => c.mLast),
    pairs10: windowRule((c) => c.m10),
    pairs3: windowRule((c) => c.m3),
    pairs5: windowRule((c) => c.m5),
    // membership of the most frequent historical triples.
    tripleChase(prior, target, rng, ctx) {
        const scores = new Float64Array(49);
        const top = [...triplesOf(ctx, prior).entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
        for (const [key, count] of top) {
            for (const part of key.split("-")) scores[Number(part) - 1] += count;
        }
        return signalLine(ctx, rng, scores);
    },
};

// hotcold blends: z-normalised hot window rank + cold window rank.
{
    const blend = (hotWin, coldWin) => (prior, target, rng, ctx) => {
        const hot = zVec(ctx.w[hotWin]);
        const cold = zVec(neg(ctx.w[coldWin]));
        const scores = new Float64Array(49);
        for (let i = 0; i < 49; i++) scores[i] = hot[i] + cold[i];
        return signalLine(ctx, rng, scores);
    };
    CATALOG_SIGNAL_RULES.hotcold15 = blend(1, 5);
    CATALOG_SIGNAL_RULES.hotcold24 = blend(2, 4);
    CATALOG_SIGNAL_RULES.hotcold42 = blend(4, 2);
}

// ---------------------------------------------------------------------------
// Row metadata — [id, name, family, description]; descriptions are the doc
// one-liners verbatim (gambler's-fallacy editorialising dropped).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row metadata — [id, name, family, description]; descriptions are the doc
// one-liners verbatim (gambler's-fallacy editorialising dropped), names are
// derived from the doc id by nameOf.
// ---------------------------------------------------------------------------

/** Build the tuple list from (id, family, description) triples, with curated reader-friendly names. */
/** Curated reader-friendly names, keyed by doc id (fallback: mechanical nameOf). */
const NAME_MAP = {
    cold100: "Cold 100-Draw Fade",
    cold200: "Cold 200-Draw Fade",
    cold30: "Cold 30-Draw Fade",
    cold500: "Cold 500-Draw Fade",
    coldAll: "All-Time Coldest Six",
    hot10: "Hot 10-Draw Streak",
    hot100: "Hot 100-Draw Streak",
    hot150: "Hot 150-Draw Streak",
    hot20: "Hot 20-Draw Streak",
    hot200: "Hot 200-Draw Streak",
    hot30: "Hot 30-Draw Streak",
    hot300: "Hot 300-Draw Streak",
    hot40: "Hot 40-Draw Streak",
    hot500: "Hot 500-Draw Streak",
    hot60: "Hot 60-Draw Streak",
    hotEWMA: "Hot EWMA (HL 30)",
    eliteOverdue: "Elite Overdue",
    gapOwnNear: "Own-Cycle Peak",
    skipBandLoad: "Skip-Band Loader",
    hotHand: "Hot Hand",
    streakZig: "Longest Streak",
    barbellHotCold: "Hot–Cold Barbell",
    coldZoneRot: "Cold Zone Rotation",
    hotCold33: "Hot–Cold 3/3 Split",
    hotcold15: "Hot 1 · Cold 5",
    hotcold24: "Hot 2 · Cold 4",
    hotcold42: "Hot 4 · Cold 2",
    bounceBack: "Skip-Band Bounce-Back",
    gapHarm: "Harmonic Gap Rhythm",
    gapOwn: "Own-Clock Overdue",
    gapZ: "Personal Gap Z-Score",
    overdue: "Longest Overdue",
    skip12_20: "Skip 12–20 Window",
    skip2_4: "Skip 2–4 Window",
    skip8_12: "Skip 8–12 Window",
    skipFFG: "FFG Peak Gap",
    antiMom30: "30-Draw Momentum Fade",
    mom10: "10-Draw Momentum",
    mom120: "120-Draw Momentum",
    mom20: "20-Draw Momentum",
    mom30: "30-Draw Momentum",
    mom60: "60-Draw Momentum",
    streakChase2: "Streak Rider",
    velocityFade: "Velocity Fade",
    decadeSkewCol: "Tail-Column Leaders",
    freqAll: "All-Time Frequency",
    antiPairs1: "Partner Fade",
    pairChase: "Pair-Z Chase",
    pairs1: "Yesterday's Partners",
    pairs10: "Pair Chase ×10",
    pairs3: "Pair Chase ×3",
    pairs5: "Pair Chase ×5",
    tripleChase: "Triple Hunt",
};

const tuples = (rows) => rows.map(([id, family, description]) => [id, NAME_MAP[id] ?? nameOf(id), family, description]);

export const CATALOG_SIGNAL_ROWS = tuples([
    // Hot & Cold — 16
    ["cold100", "Hot & Cold", "NEGATIVE hit count over trailing 100 draws — the 6 coldest recent balls."],
    ["cold200", "Hot & Cold", "NEGATIVE hit count over the trailing 200 draws."],
    ["cold30", "Hot & Cold", "NEGATIVE hit count over the trailing 30 draws."],
    ["cold500", "Hot & Cold", "NEGATIVE hit count over the trailing 500 draws."],
    ["coldAll", "Hot & Cold", "NEGATIVE all-time hit count — the 6 coldest balls in history."],
    ["hot10", "Hot & Cold", "Raw hit count over the trailing 10 draws."],
    ["hot100", "Hot & Cold", "Raw hit count over the trailing 100 draws."],
    ["hot150", "Hot & Cold", "Raw hit count over the trailing 150 draws."],
    ["hot20", "Hot & Cold", "Raw hit count over the trailing 20 draws."],
    ["hot200", "Hot & Cold", "Raw hit count over the trailing 200 draws."],
    ["hot30", "Hot & Cold", "Raw hit count over the trailing 30 draws."],
    ["hot300", "Hot & Cold", "Raw hit count over the trailing 300 draws."],
    ["hot40", "Hot & Cold", "Raw hit count over the trailing 40 draws."],
    ["hot500", "Hot & Cold", "Raw hit count over the trailing 500 draws (≈ whole era)."],
    ["hot60", "Hot & Cold", "Raw hit count over the trailing 60 draws."],
    ["hotEWMA", "Hot & Cold", "Exponentially-weighted moving average of hits with half-life ~30 draws: score[x] = Σ hit·2^(−Δt/30). Recency-weighted frequency."],
    // Skip — 3
    ["eliteOverdue", "Skip", "All-time frequency × indicator(current gap > own mean gap) — quality balls that are overdue by their own clock."],
    ["gapOwnNear", "Skip", "−|current gap − own mean gap| — balls sitting exactly at their own typical cycle point."],
    ["skipBandLoad", "Skip", "1 ball from skip band 0 (a repeat — deliberate mask bypass), 3 from skip 1-7, ≤1 from skip 24+, rest free; ranked by ensemble + 50-draw surge."],
    // Streaks — 2
    ["hotHand", "Streaks", "Hot-hand: P(hit | hit previous draw) per ball (same as markov but windowed)."],
    ["streakZig", "Streaks", "Hit-streak length (consecutive draws appeared); play the longest active streaks."],
    // Blends — 6
    ["barbellHotCold", "Blends", "3 hottest + 3 coldest of the last 100 draws."],
    ["coldZoneRot", "Blends", "Hottest decade and coldest decade by 30-draw count; 3 hottest balls from the hot decade + 3 coldest from the cold decade; no-recycle refill from the hottest unblocked rest."],
    ["hotCold33", "Blends", "3 hottest + 3 coldest of the trailing window with structural banding."],
    ["hotcold15", "Blends", "Hot-1 + cold-5 blend."],
    ["hotcold24", "Blends", "Blend: hot-2-window rank + cold-4-window rank."],
    ["hotcold42", "Blends", "Hot-4 + cold-2 blend."],
    // Gap & Due — 9
    ["bounceBack", "Gap & Due", "Empirical return rate of the ball's current skip band (measured over the full trailing history) — the measured bounce-back curve."],
    ["gapHarm", "Gap & Due", "Harmonic mean of the ball's inter-arrival gaps — shortest typical cycle wins."],
    ["gapOwn", "Gap & Due", "Current gap ÷ the ball's own mean gap — due-by-own-clock ratio."],
    ["gapZ", "Gap & Due", "(current gap − own mean gap) ÷ own gap std — standardized personal clock, computed over a 400-draw gap history."],
    ["overdue", "Gap & Due", "Current skip (draws since the ball last appeared) — the 6 longest-absent balls."],
    ["skip12_20", "Gap & Due", "Indicator of current skip ∈ [12,20]."],
    ["skip2_4", "Gap & Due", "Indicator of current skip ∈ [2,4] (FFG mid-band) + tiny gap tilt."],
    ["skip8_12", "Gap & Due", "Indicator of current skip ∈ [8,12]."],
    ["skipFFG", "Gap & Due", "FFG: expected-hit score when current gap ≈ the ball's theoretical average gap (n·ln2 style FFG curve)."],
    // Momentum — 8
    ["antiMom30", "Momentum", "NEGATIVE 30-draw momentum — fade the fastest risers."],
    ["mom10", "Momentum", "Rate(last 10) − rate(previous 10) — 10-draw momentum."],
    ["mom120", "Momentum", "Rate(last 120) − rate(previous 120) — 120-draw momentum."],
    ["mom20", "Momentum", "Rate(last 20) − rate(previous 20) — 20-draw momentum."],
    ["mom30", "Momentum", "Momentum: rate(last 30 draws) − rate(the 30 before that)."],
    ["mom60", "Momentum", "Rate(last 60) − rate(previous 60) — 60-draw momentum."],
    ["streakChase2", "Momentum", "Balls on ≥2-draw hit streaks (hit in each of the last 2+ consecutive draws), topped up with the best 1-draw risers; ensemble-ranked, masked."],
    ["velocityFade", "Momentum", "(long-run − rate50) + (long-run − rate10) — the fastest fallers."],
    // Frequency — 2
    ["decadeSkewCol", "Frequency", "The all-time leader of each of the 6 strongest last-digit columns (balls grouped by n mod 10)."],
    ["freqAll", "Frequency", "All-time hit count since era start (draw #2995, Oct 2014)."],
    // Pairs — 7
    ["antiPairs1", "Pairs", "NEGATIVE of M @ last_draw — avoid partners of yesterday's balls."],
    ["pairChase", "Pairs", "Membership strength of the top positive co-occurrence pairs."],
    ["pairs1", "Pairs", "Co-occurrence matrix M (49x49, counts of balls appearing in the same draw) projected onto the last draw: score = M @ last_draw_vector. Partners of what just appeared."],
    ["pairs10", "Pairs", "M @ (sum of last 10 draws' vectors)."],
    ["pairs3", "Pairs", "M @ (sum of last 3 draws' ball vectors) — short-window pair chase."],
    ["pairs5", "Pairs", "M @ (sum of last 5 draws' vectors)."],
    ["tripleChase", "Pairs", "Membership of the most frequent historical triples."],
]);

/** The league rows this module evaluates. */
export const CATALOG_SIGNAL_STRATEGIES = CATALOG_SIGNAL_ROWS;

// Manifest count authority: module 1 = 53 net-new rows.
if (CATALOG_SIGNAL_STRATEGIES.length !== 53) {
    throw new Error(`catalog-signal manifest drift: ${CATALOG_SIGNAL_STRATEGIES.length} ≠ 53`);
}
const ruleIds = Object.keys(CATALOG_SIGNAL_RULES);
if (ruleIds.length !== CATALOG_SIGNAL_STRATEGIES.length) {
    throw new Error(`catalog-signal rule/strategy drift: ${ruleIds.length} rules vs ${CATALOG_SIGNAL_STRATEGIES.length} rows`);
}
for (const [id] of CATALOG_SIGNAL_STRATEGIES) {
    if (!CATALOG_SIGNAL_RULES[id]) throw new Error(`catalog-signal missing rule: ${id}`);
}
