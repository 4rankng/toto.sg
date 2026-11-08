// toto.sg — catalog adoption module 4/4: Machine Learning + Ensemble, the
// final 5 net-new rows. Manifest and conventions: catalog-signal-rules.mjs.
//
// Step-5 ML decisions:
//   * geneticOpt: population 24, 12 generations, tournament(2) selection,
//     uniform crossover, single-ball mutation p=0.15, fitness = Σ ensemble
//     score + 0.5 when ≥4 decades touched + 0.5 when ≥5 distinct tails; all
//     randomness through the league's seeded rng; best-seen line returned.
//   * simAnneal: start from the ensemble top-6; 2000 iterations; temperature
//     1.0 → 0.01 exponential; propose 1-2 ball swaps; Metropolis accept;
//     fitness = plain Σ ensemble score; best-seen line returned.
//   * metaVote is a SECOND-PHASE spec: it reads the league's own fold-line
//     vote from the cross-panel context (ctx.votes) and is wired with
//     crossPanelPrepare in scripts/league-build.mjs, not with the catalog
//     prepare. Ties resolve to the lower ball; the no-recycle mask applies.
import { RANGE49, lineSum, sortAsc, sampleK } from "./cross-panel-stats.mjs";
import { ensFill, ensTop, ensembleScore, nameOf, signalLine } from "./catalog-signal-rules.mjs";

const FFG_STAR = Math.log(2) / (6 / 49);
const FENG_SHUI_SET = [6, 8, 9, 16, 18, 19, 26, 28, 29, 36, 38, 39, 46, 48, 49];

const lineFitness = (ctx, line) => {
    const ens = ensembleScore(ctx);
    let f = line.reduce((a, b) => a + ens[b - 1], 0);
    if (new Set(line.map((b) => Math.floor((b - 1) / 10))).size >= 4) f += 0.5;
    if (new Set(line.map((b) => b % 10)).size >= 5) f += 0.5;
    return f;
};

/** Repair a genome to 6 unique 1..49 balls, rng-filled. */
const repair = (rng, genome) => {
    const set = [...new Set(genome.filter((b) => b >= 1 && b <= 49))];
    while (set.length < 6) {
        const b = 1 + Math.floor(rng() * 49);
        if (!set.includes(b)) set.push(b);
    }
    return sortAsc(set.slice(0, 6));
};

const randomLine = (rng) => sortAsc(sampleK(rng, RANGE49, 6));

export const CATALOG_ML_RULES = {
    geneticOpt(prior, target, rng, ctx) {
        const POP = 24;
        const GENS = 12;
        let pop = Array.from({ length: POP }, () => randomLine(rng));
        let best = null;
        let bestFit = -Infinity;
        for (let g = 0; g < GENS; g++) {
            const fits = pop.map((l) => {
                const f = lineFitness(ctx, l);
                if (f > bestFit) {
                    bestFit = f;
                    best = l;
                }
                return f;
            });
            const next = [];
            for (let c = 0; c < POP; c++) {
                // tournament(2) selection, twice, for two parents
                const pick = () => {
                    const i = Math.floor(rng() * POP);
                    const j = Math.floor(rng() * POP);
                    return fits[i] >= fits[j] ? pop[i] : pop[j];
                };
                const p1 = pick();
                const p2 = pick();
                const child = [];
                for (let slot = 0; slot < 6; slot++) {
                    // uniform crossover + single-ball mutation p=0.15
                    const gene = rng() < 0.5 ? p1[slot] : p2[slot];
                    child.push(rng() < 0.15 ? 1 + Math.floor(rng() * 49) : gene);
                }
                next.push(repair(rng, child));
            }
            pop = next;
        }
        for (const l of pop) {
            const f = lineFitness(ctx, l);
            if (f > bestFit) {
                bestFit = f;
                best = l;
            }
        }
        return best;
    },

    simAnneal(prior, target, rng, ctx) {
        const ens = ensembleScore(ctx);
        const fitness = (l) => l.reduce((a, b) => a + ens[b - 1], 0);
        let cur = ensTop(ctx, 6);
        let curFit = fitness(cur);
        let best = cur;
        let bestFit = curFit;
        const ITERS = 2000;
        for (let i = 0; i < ITERS; i++) {
            const temp = 1.0 * Math.pow(0.01, i / ITERS);
            const proposal = [...cur];
            const swaps = 1 + (rng() < 0.5 ? 1 : 0);
            for (let s = 0; s < swaps; s++) {
                const pos = Math.floor(rng() * 6);
                let b = 1 + Math.floor(rng() * 49);
                while (proposal.includes(b)) b = 1 + Math.floor(rng() * 49);
                proposal[pos] = b;
            }
            const cand = sortAsc(proposal);
            const candFit = fitness(cand);
            const delta = candFit - curFit;
            if (delta >= 0 || rng() < Math.exp(delta / Math.max(1e-9, temp))) {
                cur = cand;
                curFit = candFit;
                if (curFit > bestFit) {
                    bestFit = curFit;
                    best = cand;
                }
            }
        }
        return best;
    },

    ensemble: (prior, target, rng, ctx) => signalLine(ctx, rng, ensembleScore(ctx)),

    hybridFSB(prior, target, rng, ctx) {
        // feng-shui set ∩ FFG skip-band filter: rank the wealth-number set by
        // how close each ball's skip sits to its theoretical average gap
        const seeds = FENG_SHUI_SET.slice()
            .sort((a, b) => Math.abs(ctx.skips[a - 1] - FFG_STAR) - Math.abs(ctx.skips[b - 1] - FFG_STAR) || a - b)
            .slice(0, 3);
        const fill = ensFill(ctx, rng, 3, new Set(seeds));
        const line = sortAsc([...seeds, ...fill]);
        const s = lineSum(line);
        return s >= 115 && s <= 185 ? line : null;
    },

    // Second phase: ctx.votes is the league's own fold-line consensus. The
    // cross-panel context carries no catalog fold state, so the no-recycle
    // mask is rebuilt here from the prior (last draw's mains + additional).
    metaVote(prior, target, rng, ctx) {
        const votes = ctx.votes;
        const last = prior[prior.length - 1];
        const mask = new Set(last ? [...last.numbers, ...(last.additional != null ? [last.additional] : [])] : []);
        const line = RANGE49.filter((b) => !mask.has(b))
            .sort((a, b) => votes[b - 1] - votes[a - 1] || a - b)
            .slice(0, 6);
        return sortAsc(line);
    },
};

/** metaVote's catalog-style mask when invoked through catalogPrepare. */
export const META_VOTE_ID = "metaVote";

/** Curated reader-friendly names, keyed by doc id (fallback: mechanical nameOf). */
const NAME_MAP = {
    geneticOpt: "Genetic Optimiser",
    simAnneal: "Simulated Annealing",
    ensemble: "Full Ensemble Blend",
    hybridFSB: "Feng-Shui × FFG",
    metaVote: "League Meta Vote",
};

const tuples = (rows) => rows.map(([id, family, description]) => [id, NAME_MAP[id] ?? nameOf(id), family, description]);

export const CATALOG_ML_ROWS = tuples([
    ["geneticOpt", "Machine Learning", "Genetic algorithm — population 24 lines, 12 generations, tournament selection + crossover + mutation, fitness = ensemble score + structural bonuses; deterministic seed per fold (20261000-style)."],
    ["simAnneal", "Machine Learning", "Simulated annealing over the ensemble score (seeded per fold): random 1-2 ball swaps with a falling temperature schedule, deterministic rng(t)."],
    ["ensemble", "Ensemble", "Z-score-normalised average of ALL wave-1 score vectors (overdue, hot windows, cold, markov, pairs, momentum, gap) — the consensus blend."],
    ["hybridFSB", "Ensemble", "Feng-shui set ∩ skip-band (FFG) filter + ensemble fill."],
    ["metaVote", "Ensemble", "Every wave-1..4 strategy contributes its own fold line; count ball frequencies across all those lines; play the 6 most-voted (masked)."],
]);

/** The league rows this module evaluates. */
export const CATALOG_ML_STRATEGIES = CATALOG_ML_ROWS;

// Module 4 = 5 net-new rows; rules and rows must stay in lockstep.
if (CATALOG_ML_STRATEGIES.length !== 5) {
    throw new Error(`catalog-ml manifest drift: ${CATALOG_ML_STRATEGIES.length} ≠ 5`);
}
const ruleIds4 = Object.keys(CATALOG_ML_RULES);
if (ruleIds4.length !== CATALOG_ML_STRATEGIES.length) {
    throw new Error(`catalog-ml rule/strategy drift: ${ruleIds4.length} rules vs ${CATALOG_ML_STRATEGIES.length} rows`);
}
for (const [id] of CATALOG_ML_STRATEGIES) {
    if (!CATALOG_ML_RULES[id]) throw new Error(`catalog-ml missing rule: ${id}`);
}
