// toto.sg — per-fold context plumbing shared by every family module.
//
// Two memoisation shapes the league needs:
//   * prepare-level — the fold context a family builds once per target draw
//     (memoisedPrepare, replacing each family's hand-rolled Map);
//   * rule-level — deterministic fold-invariant work inside a gated rule body
//     that would otherwise recompute on every rejection retry (ctxMemo,
//     replacing the ad-hoc `ctx.__m_<key>` / `ctx.__ens` / `stats.__triplets`
//     magic slots with one namespaced Map).
//
// Both are pure per-fold caches: same draw, same inputs, same answer. They
// must never be used to cache anything that varies per attempt.

/**
 * Wrap a fold-context builder as a prepare function memoised on
 * target.draw: `(prior, target, env) => builder(prior, target, env)`,
 * computed once per draw. All rules of a family share one build.
 */
export const memoisedPrepare = (builder) => {
    const memo = new Map();
    return (prior, target, env) => {
        if (!memo.has(target.draw)) memo.set(target.draw, builder(prior, target, env));
        return memo.get(target.draw);
    };
};

/**
 * The archive draws strictly before `targetDraw`, drawn from the FULL sorted
 * archive (`sorted`, both ball-pool eras) — what the desk/match-rate
 * families read, unlike the era-scoped prior the evaluator hands rules.
 */
export const fullPrior = (sorted, targetDraw) => sorted.filter((d) => d.draw < targetDraw);

/**
 * Get-or-compute on one fold context: `ctx.__memo` is a single Map namespaced
 * by `key`; `fn` receives the context. For deterministic fold invariants
 * (enumerations, regression fits, spectra) whose rule body runs once per
 * rejection retry.
 */
export const ctxMemo = (ctx, key, fn) => {
    let memo = ctx.__memo;
    if (!memo) memo = ctx.__memo = new Map();
    if (!memo.has(key)) memo.set(key, fn(ctx));
    return memo.get(key);
};
