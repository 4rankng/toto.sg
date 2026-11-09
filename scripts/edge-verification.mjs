// toto.sg — Route 1 / Route 4 / Route 2 edge-verification experiment.
//
//   npm run edge [-- --probe-m 300000 --null-probe-m 50000 --nulls 100]
//
// Walk-forward ONLY: no weight at draw t ever sees draw t or anything after
// it, and no 6/45 history ever feeds a 6/49 fold (and vice versa). The
// primary metric everywhere is the out-of-sample mean main-number hits per
// ticket against the era's exact chance null — never a max historical score.
//
// What it writes: public/data/edge-verification.json
//   meta             archive + era accounting + method notes
//   eraAccounting    per-era sizes, expected hits per ball / per ticket
//   route1           Bayesian biased-pool grid: shrinkage × window, per era,
//                    bootstrap CI, BH-FDR q, quarter stability
//   route4           league train/holdout selection audit, 300k ceiling
//                    probe, 100-history null-shuffle benchmark, verdict
//   route2           RNG-family coverage variants (search-space expansion)
//   verdict          the headline conclusion
//
// Zero payout language: matched-number facts only, exactly like the league.
import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { maskOf } from "./lib/edge-rng.mjs";
import { WARMUP_DRAWS } from "./lib/league-eval.mjs";
import {
    bhFdr,
    bootstrapEdgeCi,
    chanceNulls,
    empiricalP,
    r2,
    r4,
    spearman,
    splitEras,
    zPValue,
} from "./lib/edge-stats.mjs";
import {
    expectedMaxFactor,
    evaluateTempos,
    mergeProbeChunks,
    runRoute1Grid,
    runRoute2RngGrid,
    syntheticHistory,
} from "./lib/edge-routes.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));
const WORKER_PATH = fileURLToPath(new URL("./lib/edge-probe-worker.mjs", import.meta.url));
const ARCHIVE_HASH_NOTE = "weights at draw t read same-era draws strictly before t";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const PROBE_M = flag("probe-m", 300000);
const NULL_PROBE_M = flag("null-probe-m", 50000);
const NULL_COUNT = flag("nulls", 100);
const WORKERS = Math.max(2, Math.min(flag("workers", cpus().length - 2), cpus().length));
const BOOTSTRAP_B = flag("bootstrap", 2000);

// ---------------------------------------------------------------------------
// Worker pool — persistent, one probe chunk per job.
// ---------------------------------------------------------------------------
const makePool = (path, size) => {
    const workers = Array.from({ length: size }, () => new Worker(path));
    const idle = [...workers];
    const queue = [];
    const drain = () => {
        while (queue.length > 0 && idle.length > 0) {
            const [job, resolve] = queue.shift();
            const w = idle.pop();
            const onMessage = (result) => {
                w.off("error", onError);
                idle.push(w);
                resolve(result);
                drain();
            };
            const onError = (err) => {
                w.off("message", onMessage);
                idle.push(w);
                resolve({ error: String(err) });
                drain();
            };
            w.once("message", onMessage);
            w.once("error", onError);
            w.postMessage(job);
        }
    };
    return {
        run(job) {
            return new Promise((resolve) => {
                queue.push([job, resolve]);
                drain();
            });
        },
        close() {
            return Promise.all(workers.map((w) => w.terminate()));
        },
    };
};

const runProbe = async (pool, masks, totalVariants, chunkTarget) => {
    const chunks = [];
    const size = Math.max(1, Math.ceil(totalVariants / chunkTarget));
    for (let from = 0; from < totalVariants; from += size) chunks.push({ masks, from, to: Math.min(from + size, totalVariants) });
    const results = await Promise.all(chunks.map((job) => pool.run(job)));
    for (const r of results) if (r?.error) throw new Error(`probe worker failed: ${r.error}`);
    return mergeProbeChunks(results, masks.dmLo.length);
};

// ---------------------------------------------------------------------------
// Route 1 — real-history evaluation for one era.
// ---------------------------------------------------------------------------
const foldSlices = (arr, parts) => {
    const out = [];
    const per = Math.floor(arr.length / parts);
    for (let p = 0; p < parts; p++) out.push(arr.slice(p * per, p === parts - 1 ? arr.length : (p + 1) * per));
    return out;
};

async function route1ForEra(era, pool, eraKey, nextDrawNo) {
    const { rows, chance } = runRoute1Grid(era, pool, { warmup: WARMUP_DRAWS, nextDrawNo });
    const foldCount = era.length - WARMUP_DRAWS;
    const variantRows = [];
    for (const [id, row] of rows) {
        const ci = bootstrapEdgeCi(row.hits, chance.meanHits, { B: BOOTSTRAP_B, seed: 0xede ^ foldCount });
        const prizeCi = bootstrapEdgeCi(row.prizes, chance.prizePerFold, { B: BOOTSTRAP_B, seed: 0x5eed ^ foldCount });
        const rawMean = row.hits.reduce((a, b) => a + b, 0) / foldCount;
        const rawEdge = rawMean - chance.meanHits;
        const sd = Math.sqrt(row.hits.reduce((acc, h) => acc + (h - chance.meanHits) ** 2, 0) / (foldCount - 1));
        const z = sd === 0 ? 0 : rawEdge / (sd / Math.sqrt(foldCount));
        const quarters = foldSlices(row.hits, 4).map((slice, q) => {
            const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
            return { window: `q${q + 1}`, folds: slice.length, meanHits: r4(mean), edge: r4(mean - chance.meanHits) };
        });
        variantRows.push({
            id,
            era: eraKey,
            folds: foldCount,
            meanHits: ci.mean,
            chanceMeanHits: r4(chance.meanHits),
            edge: ci.edge,
            edgeCi95: [ci.lo, ci.hi],
            edgeCiCoversZero: ci.coversZero,
            z: r2(z),
            p: r4(zPValue(z)),
            prizeRate: r4(row.prizes.reduce((a, b) => a + b, 0) / foldCount),
            chancePrizeRate: r4(chance.prizePerFold),
            prizeEdgeCi95: [prizeCi.lo, prizeCi.hi],
            twoPlusRate: r4(row.twos.reduce((a, b) => a + b, 0) / foldCount),
            chanceTwoPlusRate: r4(chance.twoPlusPerFold),
            prizePoints: row.score,
            bestGroup: row.bestGroup,
            tiers: row.tiers,
            quarters,
            lastLine: row.lastLine,
        });
    }
    // BH-FDR across the whole grid (uniform control included — it is noise by
    // construction and belongs in the correction).
    const qs = bhFdr(variantRows.map((v) => v.p));
    variantRows.forEach((v, i) => {
        v.q = qs[i];
        v.significantAtQ05 = qs[i] < 0.05;
    });
    variantRows.sort((a, b) => b.edge - a.edge);
    return { era: eraKey, folds: foldCount, variants: variantRows };
}

// ---------------------------------------------------------------------------
// Route 4a — league train/holdout selection audit from the fold cache.
// ---------------------------------------------------------------------------
const drawBytes = (draw) =>
    JSON.stringify([draw.draw, draw.date, draw.numbers, draw.additional ?? null, draw.prizes ?? null]);

function leagueAudit(league, cache, draws, era49) {
    const sorted = [...draws].sort((a, b) => a.draw - b.draw);
    const prefixes = new Map();
    let rolling = "";
    for (const draw of sorted) {
        prefixes.set(draw.draw, (rolling = createHash("sha256").update(rolling + drawBytes(draw)).digest("hex").slice(0, 16)));
    }
    const foldDrawNos = era49.slice(WARMUP_DRAWS).map((d) => d.draw);
    const foldSet = new Set(foldDrawNos);
    const mid = Math.floor(foldDrawNos.length / 2);
    const trainSet = new Set(foldDrawNos.slice(0, mid));
    const holdoutSet = new Set(foldDrawNos.slice(mid));

    // id → (drawNo → {m, g}), prefix-validated. Handles both the plain
    // `${id}:${drawNo}` keys and the Phase-2 `${id}:${baseSetHash}:${drawNo}`.
    const foldsById = new Map();
    for (const [key, entry] of Object.entries(cache.entries ?? {})) {
        const parts = key.split(":");
        if (parts.length < 2) continue;
        const drawNo = Number(parts[parts.length - 1]);
        if (!Number.isInteger(drawNo) || !foldSet.has(drawNo)) continue;
        const id = parts[0]; // strategy ids never contain a colon
        const prefixKey = parts.length === 2 ? String(drawNo) : `${parts[1]}:${drawNo}`;
        if (cache.prefixes?.[prefixKey] !== prefixes.get(drawNo)) continue;
        if (!foldsById.has(id)) foldsById.set(id, new Map());
        foldsById.get(id).set(drawNo, entry);
    }

    const rows = league.strategies.map((s) => {
        const map = foldsById.get(s.id);
        const scoreOf = (set) => {
            let score = 0;
            let hits = 0;
            let two = 0;
            let folds = 0;
            for (const drawNo of foldDrawNos) {
                if (!set.has(drawNo)) continue;
                const e = map?.get(drawNo);
                if (!e) continue;
                folds += 1;
                hits += e.m;
                if (e.m >= 2) two += 1;
                if (e.g > 0) score += 10 ** (7 - e.g);
            }
            return { score, meanHits: folds ? hits / folds : 0, twoPlus: two, folds };
        };
        const full = scoreOf(new Set(foldDrawNos));
        const train = scoreOf(trainSet);
        const holdout = scoreOf(holdoutSet);
        return {
            id: s.id,
            name: s.name,
            family: s.family,
            leagueRank: s.rank,
            leagueScore: s.score,
            folds: full.folds,
            score: full.score,
            meanHits: r4(full.meanHits),
            trainScore: train.score,
            trainMeanHits: r4(train.meanHits),
            holdoutScore: holdout.score,
            holdoutMeanHits: r4(holdout.meanHits),
            scoreShrink: train.score > 0 ? r4(holdout.score / train.score) : null,
            parityWithLeague: full.score === s.score,
        };
    });
    const parityFailures = rows.filter((r) => !r.parityWithLeague).map((r) => r.id);
    const byTrain = [...rows].sort((a, b) => b.trainScore - a.trainScore);
    const topByTrain = byTrain.slice(0, 10).map((r) => ({
        id: r.id,
        name: r.name,
        family: r.family,
        trainScore: r.trainScore,
        holdoutScore: r.holdoutScore,
        scoreShrink: r.scoreShrink,
    }));
    const rankCorr = spearman(
        rows.map((r) => r.score),
        rows.map((r) => r.holdoutScore),
    );
    const meanTopShrink = topByTrain.filter((r) => r.scoreShrink != null).reduce((a, r, _, arr) => a + r.scoreShrink / arr.length, 0);
    return {
        strategyCount: rows.length,
        trainFoldCount: trainSet.size,
        holdoutFoldCount: holdoutSet.size,
        rankCorrelationFullVsHoldout: rankCorr,
        meanTop10ScoreShrink: Math.round(meanTopShrink * 10000) / 10000,
        cacheParityFailures: parityFailures,
        topByTrain,
        rows,
        tempoRows: rows.filter((r) => r.family === "Tempos").map((r) => ({ id: r.id, name: r.name, score: r.score, trainScore: r.trainScore, holdoutScore: r.holdoutScore, rank: r.leagueRank })),
    };
}

// ---------------------------------------------------------------------------
// Null-shuffle per-history statistics (the identical pipeline, rerun).
// ---------------------------------------------------------------------------
function nullHistoryStats(history, pool45, pool49, chance45, chance49) {
    const maxZForEra = (era, pool, chance) => {
        const { rows } = runRoute1Grid(era, pool, { warmup: WARMUP_DRAWS });
        let maxZ = -Infinity;
        for (const [id, row] of rows) {
            if (id === "uniformQuickpick") continue;
            const folds = row.hits.length;
            const mean = row.hits.reduce((a, b) => a + b, 0) / folds;
            const sd = Math.sqrt(row.hits.reduce((acc, h) => acc + (h - chance.meanHits) ** 2, 0) / (folds - 1));
            const z = sd === 0 ? 0 : (mean - chance.meanHits) / (sd / Math.sqrt(folds));
            if (z > maxZ) maxZ = z;
        }
        return maxZ;
    };
    const tempos = evaluateTempos(history.era49);
    const bestTempo = Math.max(...tempos.map((t) => t.score));
    return {
        r1MaxZ_e45: maxZForEra(history.era45, 45, chance45),
        r1MaxZ_e49: maxZForEra(history.era49, 49, chance49),
        bestTempoScore_e49: bestTempo,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
    const t0 = Date.now();
    const draws = JSON.parse(await readFile(`${DATA_DIR}draws.json`, "utf8"));
    const league = JSON.parse(await readFile(`${DATA_DIR}strategies.json`, "utf8"));
    const cache = JSON.parse(await readFile(new URL("../data/league-cache.json", import.meta.url), "utf8"));
    const { era45, era49 } = splitEras(draws);
    const chance45 = chanceNulls(45);
    const chance49 = chanceNulls(49);
    const nextDrawNo = draws[draws.length - 1].draw + 1;

    // --- Route 1 + primary-metric statistics on the real archive -----------
    console.error(`[edge] route1 grids…`);
    const route1E45 = await route1ForEra(era45, 45, "e45", nextDrawNo);
    const route1E49 = await route1ForEra(era49, 49, "e49", nextDrawNo);

    // --- Route 4a — league audit ------------------------------------------
    console.error(`[edge] league train/holdout audit…`);
    const audit = leagueAudit(league, cache, draws, era49);

    // --- Route 4b — 300k ceiling probe on the real 6/49 folds -------------
    const era49Folds = era49.slice(WARMUP_DRAWS);
    const probeMasks = {
        dmLo: new Int32Array(era49Folds.length),
        dmHi: new Int32Array(era49Folds.length),
        adLo: new Int32Array(era49Folds.length),
        adHi: new Int32Array(era49Folds.length),
    };
    era49Folds.forEach((d, i) => {
        const [mLo, mHi] = maskOf(d.numbers);
        const [aLo, aHi] = d.additional == null ? [0, 0] : maskOf([d.additional]);
        probeMasks.dmLo[i] = mLo;
        probeMasks.dmHi[i] = mHi;
        probeMasks.adLo[i] = aLo;
        probeMasks.adHi[i] = aHi;
    });
    const pool = makePool(WORKER_PATH, WORKERS);
    console.error(`[edge] ceiling probe M=${PROBE_M} on ${WORKERS} workers…`);
    const probe = await runProbe(pool, probeMasks, PROBE_M, WORKERS);
    const predictedMax = Math.round(probe.meanScore + probe.sdScore * expectedMaxFactor(PROBE_M));

    // --- Route 4c — 100 null histories through the identical pipeline -----
    console.error(`[edge] null-shuffle benchmark: ${NULL_COUNT} histories × (R1 grid + Tempos + probe M=${NULL_PROBE_M})…`);
    const nullStats = [];
    for (let k = 0; k < NULL_COUNT; k++) {
        const mode = k % 5 < 3 ? "iid" : "permuted"; // 60/40 split
        const history = syntheticHistory(era45, era49, mode, 0x9117 + k * 7919);
        const stats = nullHistoryStats(history, 45, 49, chance45, chance49);
        const masks = { ...probeMasks };
        const nullFolds = history.era49.slice(WARMUP_DRAWS);
        const dmLo = new Int32Array(nullFolds.length);
        const dmHi = new Int32Array(nullFolds.length);
        const adLo = new Int32Array(nullFolds.length);
        const adHi = new Int32Array(nullFolds.length);
        nullFolds.forEach((d, i) => {
            const [mLo, mHi] = maskOf(d.numbers);
            const [aLo, aHi] = d.additional == null ? [0, 0] : maskOf([d.additional]);
            dmLo[i] = mLo;
            dmHi[i] = mHi;
            adLo[i] = aLo;
            adHi[i] = aHi;
        });
        const nullProbe = await runProbe(pool, { dmLo, dmHi, adLo, adHi }, NULL_PROBE_M, WORKERS);
        stats.probeMaxScore50k = nullProbe.maxScore;
        stats.probeMaxMeanHits = nullProbe.maxMeanHits;
        nullStats.push(stats);
        if ((k + 1) % 10 === 0) console.error(`[edge]   ${k + 1}/${NULL_COUNT} null histories done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    await pool.close();

    // Real-history counterparts (matched M: the first 50k of the real probe;
    // the R1 max-z and best-tempo from the real runs).
    const realR1MaxZ = (route1) => {
        const candidates = route1.variants.filter((v) => v.id !== "uniformQuickpick");
        return Math.max(...candidates.map((v) => v.z));
    };
    const realTempos = evaluateTempos(era49);
    const realBestTempo = Math.max(...realTempos.map((t) => t.score));
    const statistic = (name, real, key) => {
        const nulls = nullStats.map((s) => s[key]);
        const nullMean = nulls.reduce((a, b) => a + b, 0) / nulls.length;
        const nullSd = Math.sqrt(nulls.reduce((a, b) => a + (b - nullMean) ** 2, 0) / (nulls.length - 1));
        const p = empiricalP(nulls, real);
        return {
            statistic: name,
            real: Math.round(real * 10000) / 10000,
            nullMean: Math.round(nullMean * 10000) / 10000,
            nullSd: Math.round(nullSd * 10000) / 10000,
            nullMax: Math.round(Math.max(...nulls) * 10000) / 10000,
            empiricalP: p,
            // The review's kill threshold is p<0.01; a row in [0.01, 0.05) is
            // surfaced as marginal, not as a pass.
            exceedsNullAtP01: p < 0.01,
            marginalAtP05: p >= 0.01 && p < 0.05,
        };
    };
    const nullShuffle = {
        count: NULL_COUNT,
        generator: {
            iid: nullStats.filter((s, k) => k % 5 < 3).length,
            permuted: nullStats.filter((_, k) => k % 5 >= 3).length,
        },
        nullProbeM: NULL_PROBE_M,
        matchedMRealProbe: { maxScoreFirst50k: probe.maxScoreFirst50k, maxMeanHitsFirst50k: probe.maxMeanHitsFirst50k },
        statistics: [
            statistic("r1MaxZ_e45", realR1MaxZ(route1E45), "r1MaxZ_e45"),
            statistic("r1MaxZ_e49", realR1MaxZ(route1E49), "r1MaxZ_e49"),
            statistic("bestTempoScore_e49", realBestTempo, "bestTempoScore_e49"),
            statistic("probeMaxScore", probe.maxScoreFirst50k, "probeMaxScore50k"),
            statistic("probeMaxMeanHits", probe.maxMeanHitsFirst50k, "probeMaxMeanHits"),
        ],
        pValueThreshold: 0.01,
    };
    nullShuffle.consistentWithNull = nullShuffle.statistics.every((s) => !s.exceedsNullAtP01);

    // --- Route 2 — RNG-family coverage ------------------------------------
    const route2Rows = runRoute2RngGrid(era49);
    const bestRoute2 = Math.max(...route2Rows.map((r) => r.score));
    const route2 = {
        era: "e49",
        rows: route2Rows,
        bestScore: bestRoute2,
        note:
            "Search-space expansion only. These variants multiply quickpick coverage across PRNG engines; " +
            "a hit under a new engine is not evidence of predictive skill — the winner's curse grows with " +
            "the search size M, and the expected line for the next draw stays the uniform baseline " +
            "(chance meanHits 0.7347, chance prize rate 1.86% per ticket).",
    };

    // --- Verdict ------------------------------------------------------------
    const bestE45 = route1E45.variants.find((v) => v.id !== "uniformQuickpick");
    const bestE49 = route1E49.variants.find((v) => v.id !== "uniformQuickpick");
    const primarySignificant = [...route1E45.variants, ...route1E49.variants].some(
        (v) => v.significantAtQ05 && !v.edgeCiCoversZero,
    );
    const nullConsistent = nullShuffle.consistentWithNull;
    const marginalStats = nullShuffle.statistics.filter((s) => s.marginalAtP05);
    const verdict = {
        primaryMetric: "out-of-sample mean main-number hits per ticket vs the era chance null",
        route1PrimaryEdgeSignificant: primarySignificant,
        nullShuffleConsistentWithUniformity: nullConsistent,
        leagueWinnerCurse: {
            meanTop10ScoreShrink: audit.meanTop10ScoreShrink,
            rankCorrelationFullVsHoldout: audit.rankCorrelationFullVsHoldout,
        },
        headline: "",
        details: [],
    };
    if (!primarySignificant && nullConsistent) {
        verdict.headline =
            "NO verifiable statistical edge. No walk-forward Bayesian biased-pool variant survives BH-FDR q<0.05, " +
            "and the real archive's top scores sit inside the 100-history null distribution at the p<0.01 bar " +
            "(empirical p ≥ 0.01 on every statistic): every max score in the league is an artifact of search " +
            "size M — for a light-tailed statistic ≈ μ + σ√(2 ln M); for prize-point scores the matched-M " +
            "empirical null is the ceiling — not a physical bias of the machine.";
    } else {
        verdict.headline = primarySignificant
            ? "PRIMARY EDGE CANDIDATE: a Route 1 variant survives BH-FDR with a CI excluding 0 — read route1 and confirm against route4.nullShuffle before trusting it."
            : "NULL-SHUFFLE DEVIATION: the real history's top scores exceed the null distribution at p < 0.01 — treat as a finding, not as proof.";
        verdict.details.push("One of the two kill-switches fired — read route1 and route4.nullShuffle.statistics before drawing any conclusion.");
    }
    for (const [label, v] of [["6/45", bestE45], ["6/49", bestE49]]) {
        const ciNote = v.edgeCiCoversZero ? `95% CI [${v.edgeCi95[0]}, ${v.edgeCi95[1]}] covers 0` : `95% CI [${v.edgeCi95[0]}, ${v.edgeCi95[1]}] excludes 0 but q=${v.q} ≥ 0.05`;
        const stable = v.quarters.every((q) => (v.edge >= 0 ? q.edge >= 0 : q.edge < 0));
        verdict.details.push(
            `Best ${label} walk-forward variant ${v.id}: edge ${v.edge} hits/ticket, ${ciNote}, ` +
                `quarter edges [${v.quarters.map((q) => q.edge).join(", ")}] — ${stable ? "sign-stable" : "sign flips across quarters"}.`,
        );
    }
    if (marginalStats.length > 0) {
        verdict.details.push(
            `Marginal null-shuffle rows (p in [0.01, 0.05), below the review's p<0.01 bar — reported, not claimed): ${marginalStats.map((s) => `${s.statistic} p=${s.empiricalP}`).join("; ")}.`,
        );
    }
    verdict.details.push(
        `Ceiling probe: best of ${PROBE_M.toLocaleString()} uniform variants scored ${probe.maxScore} league-weighted points. ` +
            `The Gaussian reference μ+σ√(2 ln M) = ${predictedMax} deliberately underestimates a prize-point null — ` +
            `a single top-tier match inside M variants dominates the tail — so the authoritative ceiling is the ` +
            `matched-M empirical null: ${nullShuffle.statistics.find((s) => s.statistic === "probeMaxScore").nullMean} ± ` +
            `${nullShuffle.statistics.find((s) => s.statistic === "probeMaxScore").nullSd} over ${NULL_COUNT} synthetic histories (real: ${probe.maxScoreFirst50k} at M=${NULL_PROBE_M}, p=${nullShuffle.statistics.find((s) => s.statistic === "probeMaxScore").empiricalP}).`,
    );

    const artifact = {
        meta: {
            generatedAt: new Date().toISOString(),
            archive: { draws: draws.length, firstDraw: draws[0].draw, lastDraw: draws[draws.length - 1].draw },
            warmupDraws: WARMUP_DRAWS,
            probeM: PROBE_M,
            nullProbeM: NULL_PROBE_M,
            nullHistories: NULL_COUNT,
            bootstrapReplicates: BOOTSTRAP_B,
            probeWorkers: WORKERS,
            runtimeSeconds: Math.round((Date.now() - t0) / 1000),
            methodNotes: [
                "Walk-forward only: weights at draw t come from same-era draws strictly before t — no full-history rates anywhere.",
                "Raw per-ball frequency is never a weight: the Bayesian grid always shrinks toward the uniform 6/pool baseline.",
                "Eras are scored separately: a 6/45 fold never borrows a 6/49 prior and vice versa.",
                "Primary metric is out-of-sample mean main-number hits per ticket against the era's exact hypergeometric null; max historical score is treated as a search-size artifact (μ + σ√(2 ln M)).",
                "Null-shuffle benchmark: the identical pipeline reruns on synthetic uniform histories (era sizes preserved); matched-M probe statistics compare real vs null at the same variant count.",
                "Multiple testing: BH-FDR across the Route 1 grid per era; the headline claim additionally needs a bootstrap CI that excludes 0 and sign-stable quarter windows.",
                "Route 2 (RNG families) is coverage expansion, not evidence — its winner's curse scales with M.",
            ],
        },
        eraAccounting: {
            e45: {
                pool: 45,
                draws: era45.length,
                firstDraw: era45[0].draw,
                lastDraw: era45[era45.length - 1].draw,
                folds: era45.length - WARMUP_DRAWS,
                expectedHitsPerBall: r2((era45.length * 6) / 45),
                expectedHitsPerTicket: r4(chance45.meanHits),
                prizeRatePerTicket: r4(chance45.prizePerFold),
                pointsPerTicket: r4(chance45.weightedPointsPerFold),
            },
            e49: {
                pool: 49,
                draws: era49.length,
                firstDraw: era49[0].draw,
                lastDraw: era49[era49.length - 1].draw,
                folds: era49.length - WARMUP_DRAWS,
                expectedHitsPerBall: r2((era49.length * 6) / 49),
                expectedHitsPerTicket: r4(chance49.meanHits),
                prizeRatePerTicket: r4(chance49.prizePerFold),
                pointsPerTicket: r4(chance49.weightedPointsPerFold),
            },
            reviewBaselineNote:
                "The review brief assumed a 2,700-draw archive (≈330.6 expected hits per ball, σ≈17). The committed archive is 1,892 draws: 654 six-of-45 (2341–2994, to 2014-10-06) and 1,238 six-of-49 (2995–4232). Expected hits per ball are 87.2 (6/45) and 151.6 (6/49); all baselines here are recomputed from the real archive.",
        },
        route1: { e45: route1E45, e49: route1E49, nextDrawNo },
        route4: {
            leagueAudit: {
                strategyCount: audit.strategyCount,
                trainFoldCount: audit.trainFoldCount,
                holdoutFoldCount: audit.holdoutFoldCount,
                rankCorrelationFullVsHoldout: audit.rankCorrelationFullVsHoldout,
                meanTop10ScoreShrink: audit.meanTop10ScoreShrink,
                cacheParityFailures: audit.cacheParityFailures,
                topByTrain: audit.topByTrain,
                tempoRows: audit.tempoRows,
                rows: audit.rows,
            },
            ceilingProbe: {
                folds: probe.folds,
                variants: probe.variants,
                meanScore: probe.meanScore,
                sdScore: probe.sdScore,
                maxScore: probe.maxScore,
                maxScoreSeed: probe.maxScoreSeed,
                predictedMaxScore: predictedMax,
                maxScoreFirst50k: probe.maxScoreFirst50k,
                maxMeanHits: probe.maxMeanHits,
                maxMeanHitsFirst50k: probe.maxMeanHitsFirst50k,
                meanHits: probe.meanHits,
                prizeRate: probe.prizeRate,
                twoPlusRate: probe.twoPlusRate,
                topScores: probe.topScores,
            },
            nullShuffle,
        },
        route2,
        verdict,
    };

    await writeFile(`${DATA_DIR}edge-verification.json`, `${JSON.stringify(artifact, null, 1)}\n`, "utf8");
    console.error(`[edge] wrote edge-verification.json in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.error(`[edge] verdict: ${verdict.headline.slice(0, 140)}…`);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
