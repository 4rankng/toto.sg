// toto.sg — Literature family: line-generation mechanisms taken from
// published lottery-prediction research (owner directive 2026-11-19:
// "find research paper with strategies that generate new sequences from
// existing ones"). Sources in scripts/literature-sources.md.
//
// Every rule gets (prior, target, rng, prepared) and may only read draws
// strictly before target.draw. Determinism: the only randomness is the
// league's rngFor(id, draw) — used for k-means seeding and tie-breaks.
const POOL = 49;
const PICKS = 6;

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/* ---------------------------------------------------------------- *
 * 1. CDM — Compound-Dirichlet-Multinomial posterior prediction
 *    Nkomozake, "Predicting Winning Lottery Numbers" (arXiv:2403.12836).
 *    Pred(x_{n+1,j}) ∝ (α_j + n_j); α estimated by Dirichlet method of
 *    moments over the count vector, so close counts can reorder under
 *    shrinkage (this is what separates it from a plain frequency rank).
 * ---------------------------------------------------------------- */
export function cdmPosteriorLine(prior) {
    const counts = new Array(POOL).fill(0);
    for (const d of prior) for (const n of d.numbers) counts[n - 1] += 1;
    const N = prior.length * PICKS || 1;
    const p = counts.map((c) => c / N);
    const pBar = sum(p) / POOL;
    // Minka-style moment estimate of the concentration α0 (few fixed-point
    // steps, pure arithmetic — deterministic).
    let alpha0 = 1;
    for (let it = 0; it < 5; it += 1) {
        let num = 0;
        let den = 0;
        for (let j = 0; j < POOL; j += 1) {
            num += (p[j] - pBar) ** 2;
            den += p[j] * (1 - p[j]) / (N + alpha0);
        }
        if (den <= 0) break;
        const inv = (num / den) - 1; // inverse of alpha0+1 form
        if (inv <= 0) break;
        alpha0 = Math.max(1, inv / POOL);
    }
    const a = alpha0 / POOL;
    const score = counts.map((c, j) => a + c + p[j] * 1e-9);
    return [...score.keys()].sort((x, y) => score[y] - score[x]).slice(0, 6)
        .sort((a2, b2) => a2 - b2).map((i) => i + 1);
}

/* ---------------------------------------------------------------- *
 * 2. Markov superposition — He et al., "Markov-chain Based Lottery
 *    Analysis System" (ICAMCS 2016, DOI 10.2991/icamcs-16.2016.32):
 *    one-step and two-step transition matrices SUMMED, then the
 *    highest-mass numbers form the next set.
 * ---------------------------------------------------------------- */
export function markovSuperLine(prior) {
    const t1 = Array.from({ length: POOL }, () => new Float64Array(POOL));
    const t2 = Array.from({ length: POOL }, () => new Float64Array(POOL));
    for (let t = 2; t < prior.length; t += 1) {
        for (const a of prior[t - 1].numbers) for (const b of prior[t].numbers) t1[a - 1][b - 1] += 1;
        for (const a of prior[t - 2].numbers) for (const b of prior[t].numbers) t2[a - 1][b - 1] += 1;
    }
    const mass = new Float64Array(POOL);
    const last = prior[prior.length - 1];
    const prev = prior[prior.length - 2];
    if (last) for (const a of last.numbers) for (let b = 0; b < POOL; b += 1) mass[b] += t1[a - 1][b];
    if (prev) for (const a of prev.numbers) for (let b = 0; b < POOL; b += 1) mass[b] += t2[a - 1][b];
    return [...mass.keys()].sort((x, y) => mass[y] - mass[x]).slice(0, 6)
        .sort((a2, b2) => a2 - b2).map((i) => i + 1);
}

/* ---------------------------------------------------------------- *
 * 3. Apriori consequent — Zhang et al., "FP-growth for Lottery Analysis"
 *    (LISS 2013, DOI 10.1007/978-3-642-40660-7_184) and the R/Apriori
 *    replication (supp/conf thresholds): mine ball→ball association
 *    rules, then score every ball by the summed confidence of rules
 *    fired by the LAST draw's numbers.
 * ---------------------------------------------------------------- */
export function aprioriConsequentLine(prior) {
    const co = Array.from({ length: POOL }, () => new Float64Array(POOL));
    const solo = new Float64Array(POOL);
    for (const d of prior) {
        for (const a of d.numbers) {
            solo[a - 1] += 1;
            for (const b of d.numbers) if (b !== a) co[a - 1][b - 1] += 1;
        }
    }
    const last = prior[prior.length - 1];
    const score = new Float64Array(POOL);
    if (last) {
        for (const a of last.numbers) {
            const sa = solo[a - 1] || 1;
            for (let b = 0; b < POOL; b += 1) {
                if (co[a - 1][b] > 0 && !last.numbers.includes(b + 1)) {
                    // confidence × log support — the classic interestingness
                    score[b] += (co[a - 1][b] / sa) * Math.log1p(co[a - 1][b]);
                }
            }
        }
    }
    return [...score.keys()].sort((x, y) => score[y] - score[x]).slice(0, 6)
        .sort((a2, b2) => a2 - b2).map((i) => i + 1);
}

/* ---------------------------------------------------------------- *
 * 4. Cluster centroid — Jung/Han/Kim, "Pattern Analysis ... of Lottery
 *    Winning Numbers" (Korea Science, 2014): k-means over past draw
 *    lines; the next line is the centroid of the cluster the most
 *    recent draw belongs to, snapped to distinct unused balls.
 * ---------------------------------------------------------------- */
export function kmeansCentroidLine(prior, rng) {
    const K = 7;
    const lines = prior.map((d) => [...d.numbers].sort((a, b) => a - b));
    if (lines.length < K * 2) return null;
    // seeded init: K distinct draws picked by the league rng
    const picks = new Set();
    while (picks.size < K) picks.add(Math.floor(rng() * lines.length));
    let centers = [...picks].map((i) => [...lines[i]]);
    let assign = new Array(lines.length).fill(0);
    for (let iter = 0; iter < 12; iter += 1) {
        let moved = false;
        lines.forEach((ln, i) => {
            let best = 0;
            let bestD = Infinity;
            centers.forEach((c, k) => {
                let dsum = 0;
                for (let j = 0; j < PICKS; j += 1) dsum += (ln[j] - c[j]) ** 2;
                if (dsum < bestD - 1e-9) { bestD = dsum; best = k; }
            });
            if (assign[i] !== best) { assign[i] = best; moved = true; }
        });
        centers = centers.map((c, k) => {
            const members = lines.filter((_, i) => assign[i] === k);
            if (!members.length) return c;
            return c.map((_, j) => sum(members.map((m) => m[j])) / members.length);
        });
        if (!moved && iter > 0) break;
    }
    const lastLine = lines[lines.length - 1];
    let best = 0;
    let bestD = Infinity;
    centers.forEach((c, k) => {
        let dsum = 0;
        for (let j = 0; j < PICKS; j += 1) dsum += (lastLine[j] - c[j]) ** 2;
        if (dsum < bestD - 1e-9) { bestD = dsum; best = k; }
    });
    // snap centroid to the 6 closest DISTINCT balls (projection, not rounding)
    const centroid = centers[best];
    const order = [...Array(POOL).keys()].sort((a, b) => Math.abs(a + 1 - centroid[2.5]) - Math.abs(b + 1 - centroid[2.5]));
    void order;
    const chosen = [];
    const byDist = [...Array(POOL).keys()]
        .map((b) => ({ b: b + 1, d: Math.min(...centroid.map((c) => Math.abs(c - (b + 1)))) }))
        .sort((x, y) => x.d - y.d || x.b - y.b);
    for (const cand of byDist) {
        if (chosen.length === PICKS) break;
        if (!chosen.includes(cand.b)) chosen.push(cand.b);
    }
    return chosen.sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ *
 * Family manifest
 * ------------------------------------------------------------------ */
export const LITERATURE_RULES = {
    litCdmPosterior: (p) => cdmPosteriorLine(p),
    litMarkovSuper: (p) => markovSuperLine(p),
    litAprioriConsequent: (p) => aprioriConsequentLine(p),
    litKmeansCentroid: (p, t, rng) => kmeansCentroidLine(p, rng),
};

export const LITERATURE_STRATEGIES = [
    ["litCdmPosterior", "CDM Posterior (arXiv 2403.12836)", "Literature", "Compound-Dirichlet-Multinomial posterior from the arXiv paper: Dirichlet-smoothed appearance counts with a method-of-moments concentration — plays the six balls with the highest posterior expectation."],
    ["litMarkovSuper", "Markov Superposition (ICAMCS 2016)", "Literature", "He et al.'s summed one-step + two-step transition mass: scores every ball by P(ball | last draw, lag 1) + P(ball | two back, lag 2), plays the top six."],
    ["litAprioriConsequent", "Apriori Consequent (LISS 2013)", "Literature", "Association-rule mining per Zhang et al.: ball→ball rules ranked by confidence × log-support; the last draw's numbers fire the rules and the six highest-scoring consequents are played."],
    ["litKmeansCentroid", "Cluster Centroid (2014)", "Literature", "Jung et al.'s clustering: k-means (k=7) over past sorted draw lines; the next line is the centroid of the cluster containing the most recent draw, snapped to six distinct balls."],
];

export const LITERATURE_FAMILY = { rules: LITERATURE_RULES, rows: LITERATURE_STRATEGIES };
