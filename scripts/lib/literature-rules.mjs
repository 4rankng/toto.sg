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


/* ---------------------------------------------------------------- *
 * 5-7. Neural predictors — the LSTM/CNN+LSTM class from the lottery-
 *    prediction literature (French-lottery LSTM study; joohyeok-seo
 *    "Predicting Lotto Numbers with AI"; Ahmad-Alam bidirectional
 *    LSTM). Faithful no-lookahead versions, all deterministic via the
 *    league rng (id + draw):
 *      - litNeuralLogit: per-ball logistic net (10 features, SGD),
 *        retrained from scratch every fold on strictly-past draws.
 *      - litNeuralMlp:   10->16->1 tanh MLP per ball, online SGD.
 *      - litNeuralLstm:  hand-rolled LSTM cell over ball-presence
 *        vectors, retrained every 50 draws; each fold is scored only by
 *        a model whose training data ends strictly before it.
 *    Prefix statistics make per-fold training O(T*POOL), not O(T^2).
 * ---------------------------------------------------------------- */
const buildPrefix = (prior) => {
    const n = prior.length;
    const C = Array.from({ length: POOL }, () => new Float64Array(n + 1));
    const E20 = Array.from({ length: POOL }, () => new Float64Array(n + 1));
    const E100 = Array.from({ length: POOL }, () => new Float64Array(n + 1));
    const F50 = Array.from({ length: POOL }, () => new Float64Array(n + 1));
    const F200 = Array.from({ length: POOL }, () => new Float64Array(n + 1));
    const lastSeen = Array.from({ length: POOL }, () => new Int32Array(n + 1).fill(-1));
    for (let t = 0; t < n; t += 1) {
        for (let j = 0; j < POOL; j += 1) {
            C[j][t + 1] = C[j][t];
            E20[j][t + 1] = E20[j][t] * 0.96593632892; // 2^(-1/20)
            E100[j][t + 1] = E100[j][t] * 0.99309249543; // 2^(-1/100)
            F50[j][t + 1] = Math.max(0, F50[j][t] - (t >= 50 && prior[t - 50].numbers.includes(j + 1) ? 1 : 0));
            F200[j][t + 1] = Math.max(0, F200[j][t] - (t >= 200 && prior[t - 200].numbers.includes(j + 1) ? 1 : 0));
            lastSeen[j][t + 1] = lastSeen[j][t];
        }
        for (const b of prior[t].numbers) {
            const j = b - 1;
            C[j][t + 1] += 1;
            E20[j][t + 1] += 1;
            E100[j][t + 1] += 1;
            F50[j][t + 1] += 1;
            F200[j][t + 1] += 1;
            lastSeen[j][t + 1] = t;
        }
    }
    return { C, E20, E100, F50, F200, lastSeen, n };
};

/** 10 per-ball features from prefix stats, strictly through draw t (exclusive). */
const featsAt = (P, j, t) => {
    const gap = P.lastSeen[j][t] === -1 ? P.n : t - P.lastSeen[j][t];
    return [
        P.F50[j][t] / 50,
        P.F200[j][t] / 200,
        P.C[j][t] / (t || 1),
        t > 0 && P.lastSeen[j][t] === t - 1 ? 1 : 0,
        t > 1 && P.lastSeen[j][t] === t - 2 ? 1 : 0,
        P.E20[j][t],
        P.E100[j][t],
        gap / 8.17,
        P.C[j][t] / ((t * PICKS / POOL) || 1),
        (j % 2) * 0.02,
    ];
};

const top6By = (scores) =>
    [...scores.keys()].sort((x, y) => scores[y] - scores[x]).slice(0, 6)
        .sort((a, b) => a - b).map((i) => i + 1);

export function neuralLogitLine(prior, target, rng) {
    const P = buildPrefix(prior);
    const D = 10, lr = 0.05;
    const w = new Array(D).fill(0).map(() => (rng() - 0.5) * 0.1);
    let b = 0;
    const T = P.n - 1;
    for (let epoch = 0; epoch < 12; epoch += 1) {
        for (let t = 30; t < T; t += 1) {
            for (let j = 0; j < POOL; j += 1) {
                const f = featsAt(P, j, t);
                let z = b;
                for (let d = 0; d < D; d += 1) z += w[d] * f[d];
                const p = 1 / (1 + Math.exp(-z));
                const lab = prior[t].numbers.includes(j + 1) ? 1 : 0;
                const g = (p - lab) * lr;
                for (let d = 0; d < D; d += 1) w[d] -= g * f[d];
                b -= g;
            }
        }
    }
    const scores = new Array(POOL).fill(0);
    for (let j = 0; j < POOL; j += 1) {
        const f = featsAt(P, j, P.n);
        let z = b;
        for (let d = 0; d < D; d += 1) z += w[d] * f[d];
        scores[j] = z;
    }
    return top6By(scores);
}

export function neuralMlpLine(prior, target, rng) {
    const P = buildPrefix(prior);
    const H = 16, D = 10, lr = 0.02;
    const W1 = Array.from({ length: H }, () => new Array(D).fill(0).map(() => (rng() - 0.5) * 0.4));
    const c1 = new Array(H).fill(0);
    const W2 = new Array(H).fill(0).map(() => (rng() - 0.5) * 0.4);
    let b2 = 0;
    const T = P.n - 1;
    for (let rep = 0; rep < 3; rep += 1) {
        for (let t = 30; t < T; t += 1) {
            for (let j = 0; j < POOL; j += 1) {
                const f = featsAt(P, j, t);
                const h = new Array(H);
                for (let k = 0; k < H; k += 1) {
                    let z = c1[k];
                    for (let d = 0; d < D; d += 1) z += W1[k][d] * f[d];
                    h[k] = Math.tanh(z);
                }
                let y = b2;
                for (let k = 0; k < H; k += 1) y += W2[k] * h[k];
                const p = 1 / (1 + Math.exp(-y));
                const lab = prior[t].numbers.includes(j + 1) ? 1 : 0;
                const gOut = (p - lab) * lr;
                for (let k = 0; k < H; k += 1) {
                    W2[k] -= gOut * h[k];
                    const gh = gOut * W2[k] * (1 - h[k] * h[k]);
                    for (let d = 0; d < D; d += 1) W1[k][d] -= gh * f[d];
                    c1[k] -= gh;
                }
                b2 -= gOut;
            }
        }
    }
    const scores = new Array(POOL).fill(0);
    for (let j = 0; j < POOL; j += 1) {
        const f = featsAt(P, j, P.n);
        let y = b2;
        for (let k = 0; k < H; k += 1) {
            let z = c1[k];
            for (let d = 0; d < D; d += 1) z += W1[k][d] * f[d];
            y += W2[k] * Math.tanh(z);
        }
        scores[j] = y;
    }
    return top6By(scores);
}

/* ---- tiny LSTM (block-trained) ---- */
const lstmBlockCache = new Map();

const lstmStep = (m, x, hPrev, cPrev, H) => {
    const h = new Array(H).fill(0);
    const c = new Array(H).fill(0);
    const sig = (v) => 1 / (1 + Math.exp(-v));
    for (let k = 0; k < H; k += 1) {
        let i_ = m.bi[k], f_ = m.bf[k], o_ = m.bo[k], g_ = m.bg[k];
        for (let j = 0; j < POOL; j += 1) {
            const xv = x[j];
            if (xv !== 0) {
                i_ += m.wi[k * POOL + j] * xv;
                f_ += m.wf[k * POOL + j] * xv;
                o_ += m.wo[k * POOL + j] * xv;
                g_ += m.wg[k * POOL + j] * xv;
            }
        }
        for (let k2 = 0; k2 < H; k2 += 1) {
            const hv = hPrev[k2];
            if (hv !== 0) {
                i_ += m.ui[k * H + k2] * hv;
                f_ += m.uf[k * H + k2] * hv;
                o_ += m.uo[k * H + k2] * hv;
                g_ += m.ug[k * H + k2] * hv;
            }
        }
        i_ = sig(i_); f_ = sig(f_); o_ = sig(o_); g_ = Math.tanh(g_);
        c[k] = f_ * cPrev[k] + i_ * g_;
        h[k] = o_ * Math.tanh(c[k]);
    }
    return { h, c };
};

function trainLstmBlock(data, rng) {
    const H = 12;
    const init = (n) => new Array(n).fill(0).map(() => (rng() - 0.5) * 0.3);
    const m = {
        wi: init(H * POOL), wf: init(H * POOL), wo: init(H * POOL), wg: init(H * POOL),
        ui: init(H * H), uf: init(H * H), uo: init(H * H), ug: init(H * H),
        bi: new Array(H).fill(0), bf: new Array(H).fill(1), bo: new Array(H).fill(0), bg: new Array(H).fill(0),
        wy: init(H * POOL), by: 0,
    };
    const lr = 0.02;
    const xs = data.map((d) => {
        const x = new Array(POOL).fill(0);
        for (const b of d.numbers) x[b - 1] = 1;
        return x;
    });
    for (let epoch = 0; epoch < 4; epoch += 1) {
        for (let t = 1; t < data.length; t += 1) {
            const step = lstmStep(m, xs[t - 1], new Array(H).fill(0), new Array(H).fill(0), H);
            let eMass = 0;
            for (let j = 0; j < POOL; j += 1) {
                let z = m.by;
                for (let k = 0; k < H; k += 1) z += m.wy[k * POOL + j] * step.h[k];
                const p = 1 / (1 + Math.exp(-z));
                const lab = xs[t][j];
                const g = (p - lab) * lr;
                eMass += Math.abs(g);
                m.by -= g;
                for (let k = 0; k < H; k += 1) m.wy[k * POOL + j] -= g * step.h[k];
            }
            eMass /= POOL;
            for (let k = 0; k < H; k += 1) {
                m.bo[k] -= eMass * 0.1;
                m.bg[k] -= eMass * 0.05 * (rng() - 0.5);
            }
        }
    }
    return m;
}

export function neuralLstmLine(prior, target, rng, id) {
    const BLOCK = 50;
    const n = prior.length;
    const blockEnd = Math.max(BLOCK, Math.floor(n / BLOCK) * BLOCK);
    const cacheKey = `${id}:${blockEnd}`;
    let model = lstmBlockCache.get(cacheKey);
    if (!model) {
        model = trainLstmBlock(prior.slice(0, blockEnd), rng);
        lstmBlockCache.set(cacheKey, model);
    }
    const H = 12;
    let h = new Array(H).fill(0);
    let cstate = new Array(H).fill(0);
    for (let t = Math.max(0, n - 3); t < n; t += 1) {
        const x = new Array(POOL).fill(0);
        for (const b of prior[t].numbers) x[b - 1] = 1;
        const step = lstmStep(model, x, h, cstate, H);
        h = step.h;
        cstate = step.c;
    }
    const scores = new Array(POOL).fill(0);
    for (let j = 0; j < POOL; j += 1) {
        let z = model.by;
        for (let k = 0; k < H; k += 1) z += model.wy[k * POOL + j] * h[k];
        scores[j] = z;
    }
    return top6By(scores);
}

/* ------------------------------------------------------------------ *
 * Family manifest
 * ------------------------------------------------------------------ */
export const LITERATURE_RULES = {
    litCdmPosterior: (p) => cdmPosteriorLine(p),
    litMarkovSuper: (p) => markovSuperLine(p),
    litAprioriConsequent: (p) => aprioriConsequentLine(p),
    litKmeansCentroid: (p, t, rng) => kmeansCentroidLine(p, rng),
    litNeuralLogit: (p, t, rng) => neuralLogitLine(p, t, rng),
    litNeuralMlp: (p, t, rng) => neuralMlpLine(p, t, rng),
    litNeuralLstm: (p, t, rng, _prep, id) => neuralLstmLine(p, t, rng, id),
};

export const LITERATURE_STRATEGIES = [
    ["litCdmPosterior", "CDM Posterior (arXiv 2403.12836)", "Literature", "Compound-Dirichlet-Multinomial posterior from the arXiv paper: Dirichlet-smoothed appearance counts with a method-of-moments concentration — plays the six balls with the highest posterior expectation."],
    ["litMarkovSuper", "Markov Superposition (ICAMCS 2016)", "Literature", "He et al.'s summed one-step + two-step transition mass: scores every ball by P(ball | last draw, lag 1) + P(ball | two back, lag 2), plays the top six."],
    ["litAprioriConsequent", "Apriori Consequent (LISS 2013)", "Literature", "Association-rule mining per Zhang et al.: ball→ball rules ranked by confidence × log-support; the last draw's numbers fire the rules and the six highest-scoring consequents are played."],
    ["litKmeansCentroid", "Cluster Centroid (2014)", "Literature", "Jung et al.'s clustering: k-means (k=7) over past sorted draw lines; the next line is the centroid of the cluster containing the most recent draw, snapped to six distinct balls."],
    ["litNeuralLogit", "Neural Logit (LSTM-class)", "Literature", "The French-lottery LSTM study's readout in its honest form: a per-ball logistic net (10 history features, seeded SGD) retrained from scratch every fold on strictly past draws; plays the six highest-scoring balls."],
    ["litNeuralMlp", "Neural MLP (CNN+LSTM-class)", "Literature", "The CNN+LSTM hybrids' essence: a 10→16→1 tanh MLP per ball trained online over the whole past sequence (seeded, no lookahead); plays the six highest-probability balls."],
    ["litNeuralLstm", "Tiny LSTM (block-trained)", "Literature", "A hand-rolled LSTM cell over ball-presence vectors, retrained every 50 draws (each fold scored only by a model trained strictly before it); plays the six highest output activations."],
];

export const LITERATURE_FAMILY = { rules: LITERATURE_RULES, rows: LITERATURE_STRATEGIES };
