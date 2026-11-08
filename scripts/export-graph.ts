// toto-graph-export — structured attributed graph artifact for LLM agents / GNN adapters.
//
// Run via `npm run graph` (Vite SSR bundle). All paths resolve from
// process.cwd() because the bundle is relocated to node_modules/.cache/graph-build/.
//
// The exporter adds no new statistics: every number comes from the same
// compute functions that render the Insights panels. Row indexing always keys
// on each row's `number` field — several stats blocks return rows sorted by
// their own metric, not ball order.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterEra } from "./lib/analysis.mjs";
import { acValue, isPrime, playslipCell } from "./lib/cross-panel-stats.mjs";
import {
    computeEmaRibbonStats,
    computeMarkovTransitionStats,
    computeMultiHorizonZStats,
    computeRsi14Stats,
} from "../src/lib/insights-indicators";
import { pairCorrelationMatrix } from "../src/lib/insights-correlations";
import {
    computeBayesianInclusionStats,
    computeBestCompanionAndCliquesStats,
    computeMasterConfluenceBoard,
    computeMultiWindowVelocityStats,
    computePairGraphCentralityStats,
} from "../src/lib/insights-sequence-blueprint";
import {
    computeHawkesPointProcessStats,
    computeMahalanobisOrderStats,
    computePlayslipConstellationStats,
    computeSidonSumsetStats,
    computeSpectralPeriodogramStats,
    computeUnionDepletionCurveStats,
    computeWassersteinTransportStats,
} from "../src/lib/insights-sequence-dynamics";
import type { Analysis, Draw } from "../src/lib/data";
import type { StrategiesFile } from "../src/lib/data";

const r2 = (x: number) => Math.round(x * 100) / 100;

const root = process.cwd();
const dataDir = resolve(root, "public/data");

const allDraws: Draw[] = JSON.parse(readFileSync(resolve(dataDir, "draws.json"), "utf8"));
const league: StrategiesFile = JSON.parse(readFileSync(resolve(dataDir, "strategies.json"), "utf8"));
const era = filterEra(allDraws);

if (era.length < 100) throw new Error(`era too small: ${era.length} draws`);

/* ------------------------------------------------------------------ *
 * Compute blocks (same functions the Insights panels render)
 * ------------------------------------------------------------------ */

const velocity = computeMultiWindowVelocityStats(era);
const horizonZ = computeMultiHorizonZStats(era);
const rsi = computeRsi14Stats(era);
const ema = computeEmaRibbonStats(era);
const bayes = computeBayesianInclusionStats(era);
const hubs = computePairGraphCentralityStats(era);
const confluence = computeMasterConfluenceBoard(era, {} as Analysis, league);
const markov = computeMarkovTransitionStats(era);
const pairCorr = pairCorrelationMatrix(era);
const cliques = computeBestCompanionAndCliquesStats(era, 25);

// The sequence-dynamics block: the same calculators the two new Insights
// galleries render. Their scalars ride along as FLAT attributes so the
// NetworkX loader keeps working without a schema change.
const hawkes = computeHawkesPointProcessStats(era);
const spectral = computeSpectralPeriodogramStats(era);
const unionDepletion = computeUnionDepletionCurveStats(era);
const mahalanobis = computeMahalanobisOrderStats(era);
const sidon = computeSidonSumsetStats(era);
const constellation = computePlayslipConstellationStats(era);
const wasserstein = computeWassersteinTransportStats(era);

// These rows key on `ball`, not `number` — the sequence block names the
// ball field differently from the rest of the graph.
const hawkesBy = new Map(hawkes.rows.map((row) => [row.ball, row]));
const spectralBy = new Map(spectral.balls.map((row) => [row.ball, row]));
const unionFive = new Set(unionDepletion.liveUnion5);

// Per-draw sequence scalars, keyed by the draw id.
const mahalanobisBy = new Map(mahalanobis.rows.map((row) => [row.draw, row.d2]));
const sidonBy = new Map(sidon.rows.map((row) => [row.draw, row.stats.distinctSums]));
const mstBy = new Map(constellation.rows.map((row) => [row.draw, row.stats.mstLength]));
const wassersteinBy = new Map(wasserstein.rows.map((row) => [row.draw, row.w1]));

// Keyed by ball number — REQUIRED: bayes rows are posterior-sorted, ema rows
// spread-sorted, confluence rows rank-sorted.
const byNumber = <T extends { number: number }>(rows: T[]): Map<number, T> =>
    new Map(rows.map((row) => [row.number, row]));
const velocityBy = byNumber(velocity.rows);
const zBy = byNumber(horizonZ.balls);
const rsiBy = byNumber(rsi.balls);
const emaBy = byNumber(ema.ballRanks);
const bayesBy = byNumber(bayes.rows);
const hubBy = byNumber(hubs.rows);
const confluenceBy = byNumber(confluence.rankedBalls);

/** Draws since the ball was last seen, counting back from era end (never-seen → era.length). */
const currentGap = (num: number): number => {
    for (let i = era.length - 1; i >= 0; i -= 1) {
        if (era[i].numbers.includes(num)) return era.length - 1 - i;
    }
    return era.length;
};

/* ------------------------------------------------------------------ *
 * Nodes — 49 balls with the full feature vector
 * ------------------------------------------------------------------ */

const nodes = Array.from({ length: 49 }, (_, i) => {
    const num = i + 1;
    const cell = playslipCell(num);
    const vel = velocityBy.get(num)!;
    const z = zBy.get(num)!;
    const r = rsiBy.get(num)!;
    const e = emaBy.get(num)!;
    const b = bayesBy.get(num)!;
    const h = hubBy.get(num)!;
    const c = confluenceBy.get(num)!;
    return {
        id: num,
        coords: [cell.row, cell.col],
        parity: num % 2,
        decade_tier: Math.floor((num - 1) / 10),
        is_prime: isPrime(num),
        current_gap: currentGap(num),
        velocity: {
            hits5: vel.hits5,
            hits10: vel.hits10,
            hits25: vel.hits25,
            hits50: vel.hits50,
            hits100: vel.hits100,
            rate10: r2(vel.rate10),
            rate50: r2(vel.rate50),
            acceleration: r2(vel.acceleration),
            momentum: vel.momentum,
        },
        z_horizon: { z25: z.z25, z50: z.z50, z100: z.z100, composite: z.compositeZ, state: z.state },
        rsi_14: r.rsi,
        rsi_regime: r.regime,
        ema: { fast: e.fastEma, slow: e.slowEma, spread: e.ribbonSpread },
        bayes_posterior: Math.round(b.posteriorProb * 10000) / 10000,
        bayes_z: r2(b.zScore),
        confluence_passed: c.signalsPassed,
        confluence_score: c.compositeScore,
        bot_votes: c.strategyVotes,
        hub_centrality: h.centralityScore,
        hub_degree_pos_z: h.degreePositiveZ,
        hub_top_partner: h.topPartner.partner,
        // The sequence-dynamics scalars — flat, so NetworkX reads them as
        // ordinary node attributes.
        hawkes_intensity: r2(hawkesBy.get(num)!.intensity),
        hawkes_branching: r2(hawkesBy.get(num)!.branching),
        spectral_period: r2(spectralBy.get(num)!.dominantPeriod),
        spectral_fisher_g: r2(spectralBy.get(num)!.g),
        in_union_5: unionFive.has(num) ? 1 : 0,
    };
});

/* ------------------------------------------------------------------ *
 * Edges
 * ------------------------------------------------------------------ */

const markovEdges = markov.allTransitions.slice(0, 200).map((t) => ({
    from: t.from,
    to: t.to,
    lift: t.lift,
    count: t.count,
}));

const cooccurrenceEdges = pairCorr.cells
    .filter((cell) => Math.abs(cell.zScore) >= 2.0)
    .map((cell) => ({
        a: cell.a,
        b: cell.b,
        count: cell.count,
        expected: r2(cell.expected),
        z: r2(cell.zScore),
    }));

// Playslip 8-neighborhood: unique undirected adjacency on the 7×7 grid,
// scanning right / down / down-right / down-left to stay unique.
const gridEdges: { a: number; b: number }[] = [];
const cellToBall = new Map<string, number>();
for (const node of nodes) cellToBall.set(`${node.coords[0]},${node.coords[1]}`, node.id);
const neighborOffsets: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
];
for (let row = 1; row <= 7; row += 1) {
    for (let col = 1; col <= 7; col += 1) {
        const a = cellToBall.get(`${row},${col}`)!;
        for (const [dr, dc] of neighborOffsets) {
            const b = cellToBall.get(`${row + dr},${col + dc}`);
            if (b !== undefined) gridEdges.push({ a, b });
        }
    }
}

/* ------------------------------------------------------------------ *
 * Hyperedges
 * ------------------------------------------------------------------ */

const tripletHyperedges = cliques.topTriplets.map((t) => ({
    nodes: [...t.triplet],
    count: t.coOccurrences,
    min_pair_z: t.minPairZ,
    sum_pair_z: t.sumPairZ,
}));

const drawHyperedges = era.map((d: Draw) => {
    const nums = [...d.numbers].sort((x, y) => x - y);
    return {
        id: d.draw,
        date: d.date,
        nodes: nums,
        sum: nums.reduce((s, n) => s + n, 0),
        odd: nums.filter((n) => n % 2 === 1).length,
        low: nums.filter((n) => n <= 24).length,
        ac: acValue(nums),
        // The per-draw sequence scalars.
        mahalanobis_d2: r2(mahalanobisBy.get(d.draw) ?? 0),
        sidon_sumset: sidonBy.get(d.draw) ?? 0,
        mst_length: r2(mstBy.get(d.draw) ?? 0),
        wasserstein_prev: r2(wassersteinBy.get(d.draw) ?? 0),
    };
});

/* ------------------------------------------------------------------ *
 * Matrices — 49×49 row-major, index (a-1)*49 + (b-1), diagonal 0
 * ------------------------------------------------------------------ */

const pairZMatrix = new Array(49 * 49).fill(0);
for (let a = 1; a <= 49; a += 1) {
    for (let b = 1; b <= 49; b += 1) {
        if (a !== b) pairZMatrix[(a - 1) * 49 + (b - 1)] = r2(pairCorr.matrix[a * 50 + b]);
    }
}

const markovLiftMatrix = new Array(49 * 49).fill(0);
for (const t of markov.allTransitions) {
    if (t.from !== t.to) markovLiftMatrix[(t.from - 1) * 49 + (t.to - 1)] = t.lift;
}

/* ------------------------------------------------------------------ *
 * Artifact + CSVs
 * ------------------------------------------------------------------ */

const graph = {
    meta: {
        artifact: "toto-graph",
        version: 1,
        generatedAt: new Date().toISOString(),
        era: {
            firstDate: era[0].date,
            lastDate: era[era.length - 1].date,
            draws: era.length,
        },
        counts: {
            nodes: nodes.length,
            markov_lag1: markovEdges.length,
            cooccurrence: cooccurrenceEdges.length,
            grid_topology: gridEdges.length,
            triplets: tripletHyperedges.length,
            draws: drawHyperedges.length,
        },
    },
    nodes,
    edges: {
        markov_lag1: markovEdges,
        cooccurrence: cooccurrenceEdges,
        grid_topology: gridEdges,
    },
    hyperedges: {
        triplets: tripletHyperedges,
        draws: drawHyperedges,
    },
    matrices: {
        pair_z: pairZMatrix,
        markov_lift: markovLiftMatrix,
    },
};

writeFileSync(resolve(dataDir, "graph.json"), `${JSON.stringify(graph)}\n`);

const csvEscape = (v: unknown) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replaceAll('"', '""')}"` : s;
};
const toCsv = (header: string[], rows: unknown[][]) =>
    [header.join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n") + "\n";

writeFileSync(
    resolve(dataDir, "graph-nodes.csv"),
    toCsv(
        [
            "id", "row", "col", "parity", "decade_tier", "is_prime", "current_gap",
            "hits5", "hits10", "hits25", "hits50", "hits100", "rate10", "rate50", "acceleration",
            "z25", "z50", "z100", "composite_z", "rsi14", "ema_fast", "ema_slow", "ema_spread",
            "bayes_posterior", "bayes_z", "confluence_passed", "confluence_score", "bot_votes",
            "hub_centrality", "hub_degree_pos_z",
            "hawkes_intensity", "hawkes_branching", "spectral_period", "spectral_fisher_g", "in_union_5",
        ],
        nodes.map((n) => [
            n.id, n.coords[0], n.coords[1], n.parity, n.decade_tier, n.is_prime, n.current_gap,
            n.velocity.hits5, n.velocity.hits10, n.velocity.hits25, n.velocity.hits50, n.velocity.hits100,
            n.velocity.rate10, n.velocity.rate50, n.velocity.acceleration,
            n.z_horizon.z25, n.z_horizon.z50, n.z_horizon.z100, n.z_horizon.composite,
            n.rsi_14, n.ema.fast, n.ema.slow, n.ema.spread,
            n.bayes_posterior, n.bayes_z, n.confluence_passed, n.confluence_score, n.bot_votes,
            n.hub_centrality, n.hub_degree_pos_z,
            n.hawkes_intensity, n.hawkes_branching, n.spectral_period, n.spectral_fisher_g, n.in_union_5,
        ]),
    ),
);

const matrixHeader = Array.from({ length: 49 }, (_, i) => String(i + 1));
const matrixRows = (matrix: number[]) =>
    Array.from({ length: 49 }, (_, a) =>
        Array.from({ length: 49 }, (_, b) => matrix[a * 49 + b]),
    );
writeFileSync(
    resolve(dataDir, "graph-pair-z.csv"),
    toCsv(matrixHeader, matrixRows(pairZMatrix)),
);
writeFileSync(
    resolve(dataDir, "graph-markov-lift.csv"),
    toCsv(matrixHeader, matrixRows(markovLiftMatrix)),
);

const edgeRows: unknown[][] = [
    ...markovEdges.map((e) => ["markov_lag1", e.from, e.to, e.lift, e.count, ""]),
    ...cooccurrenceEdges.map((e) => ["cooccurrence", e.a, e.b, "", e.count, e.z]),
    ...gridEdges.map((e) => ["grid_topology", e.a, e.b, "", "", ""]),
];
writeFileSync(
    resolve(dataDir, "graph-edges.csv"),
    toCsv(["type", "source", "target", "weight", "count", "z"], edgeRows),
);

writeFileSync(
    resolve(dataDir, "graph-triplets.csv"),
    toCsv(
        ["a", "b", "c", "count", "min_pair_z", "sum_pair_z"],
        tripletHyperedges.map((t) => [t.nodes[0], t.nodes[1], t.nodes[2], t.count, t.min_pair_z, t.sum_pair_z]),
    ),
);

writeFileSync(
    resolve(dataDir, "graph-draws.csv"),
    toCsv(
        ["draw", "date", "n1", "n2", "n3", "n4", "n5", "n6", "sum", "odd", "low", "ac",
            "mahalanobis_d2", "sidon_sumset", "mst_length", "wasserstein_prev"],
        drawHyperedges.map((d) => [
            d.id, d.date, d.nodes[0], d.nodes[1], d.nodes[2], d.nodes[3], d.nodes[4], d.nodes[5],
            d.sum, d.odd, d.low, d.ac,
            d.mahalanobis_d2, d.sidon_sumset, d.mst_length, d.wasserstein_prev,
        ]),
    ),
);

console.log(
    `toto-graph: era ${graph.meta.era.firstDate}..${graph.meta.era.lastDate} (${graph.meta.era.draws} draws); ` +
    `nodes=${graph.meta.counts.nodes} markov=${graph.meta.counts.markov_lag1} ` +
    `coocc=${graph.meta.counts.cooccurrence} grid=${graph.meta.counts.grid_topology} ` +
    `triplets=${graph.meta.counts.triplets} draws=${graph.meta.counts.draws}`,
);
