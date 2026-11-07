// toto.sg — 12 deterministic prediction strategies + walk-forward evaluation. Zero deps.

import { scoreLine } from "./toto.mjs";

const WARMUP = 100; // first era draws train features only, never scored

const lastN = (draws, n) => draws.slice(-n);

/** Per-number {number, count, gap} entries over `draws`. */
function entriesOf(draws) {
    const counts = Array(49).fill(0);
    const gaps = Array(49).fill(draws.length);
    draws.forEach((d, i) => {
        for (const n of d.numbers) {
            counts[n - 1]++;
            gaps[n - 1] = draws.length - 1 - i;
        }
    });
    return counts.map((count, i) => ({ number: i + 1, count, gap: gaps[i] }));
}

const hotOrder = (e) => [...e].sort((a, b) => b.count - a.count || a.gap - b.gap || a.number - b.number);
const coldOrder = (e) => [...e].sort((a, b) => a.count - b.count || b.gap - a.gap || a.number - b.number);
const overdueOrder = (e) => [...e].sort((a, b) => b.gap - a.gap || a.number - b.number);
const freqOrder = hotOrder;

const take = (ordered, n, exclude = new Set()) => {
    const out = [];
    for (const e of ordered) {
        if (exclude.has(e.number)) continue;
        out.push(e.number);
        if (out.length === n) break;
    }
    return out;
};

const finalize = (nums) => [...new Set(nums)].sort((a, b) => a - b);

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** All-time co-occurrence count of candidate n with every number in `withSet`. */
function coOccurrence(prior, withSet) {
    const co = Array(49).fill(0);
    const targets = [...withSet];
    for (const d of prior) {
        const present = targets.filter((t) => d.numbers.includes(t)).length;
        if (!present) continue;
        for (const n of d.numbers) if (!withSet.has(n)) co[n - 1] += present;
    }
    return co;
}

const median = (values) => {
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const sumOf = (d) => d.numbers.reduce((a, b) => a + b, 0);

const STRATEGIES = [
    {
        id: "hot-50",
        name: "Hot 50",
        description: "The 6 numbers drawn most often across the last 50 draws.",
        fn: (prior) => take(hotOrder(entriesOf(lastN(prior, 50))), 6),
    },
    {
        id: "hot-all",
        name: "Hot All-Time",
        description: "The 6 numbers drawn most often across the whole 6/49 era.",
        fn: (prior) => take(hotOrder(entriesOf(prior)), 6),
    },
    {
        id: "cold-50",
        name: "Cold 50",
        description: "The 6 numbers drawn least often in the last 50 draws (never-drawn first).",
        fn: (prior) => take(coldOrder(entriesOf(lastN(prior, 50))), 6),
    },
    {
        id: "cold-all",
        name: "Cold All-Time",
        description: "The 6 numbers drawn least often across the whole 6/49 era.",
        fn: (prior) => take(coldOrder(entriesOf(prior)), 6),
    },
    {
        id: "overdue",
        name: "Overdue",
        description: "The 6 numbers unseen for the longest time.",
        fn: (prior) => take(overdueOrder(entriesOf(prior)), 6),
    },
    {
        id: "hot-cold-mix",
        name: "Hot–Cold Mix",
        description: "3 hottest + 3 coldest of the last 50 draws; overlaps skip to the next cold number.",
        fn: (prior) => {
            const e = entriesOf(lastN(prior, 50));
            const hot = take(hotOrder(e), 3);
            return finalize([...hot, ...take(coldOrder(e), 3, new Set(hot))]);
        },
    },
    {
        id: "hot-overdue-mix",
        name: "Hot–Overdue Mix",
        description: "3 hottest of the last 50 draws + 3 most overdue, deduplicated.",
        fn: (prior) => {
            const hot = take(hotOrder(entriesOf(lastN(prior, 50))), 3);
            return finalize([...hot, ...take(overdueOrder(entriesOf(prior)), 3, new Set(hot))]);
        },
    },
    {
        id: "repeaters",
        name: "Repeaters",
        description: "Exactly the previous draw's 6 winning numbers.",
        fn: (prior) => finalize(prior[prior.length - 1].numbers),
    },
    {
        id: "follow-hot",
        name: "Follow the Hot",
        description: "Numbers with the highest historical co-occurrence with the previous draw's numbers (previous numbers excluded).",
        fn: (prior) => {
            const prev = new Set(prior[prior.length - 1].numbers);
            const co = coOccurrence(prior, prev);
            const withCo = entriesOf(prior)
                .filter((e) => !prev.has(e.number))
                .map((e) => ({ ...e, co: co[e.number - 1] }))
                .sort((a, b) => b.co - a.co || b.count - a.count || a.number - b.number);
            return take(withCo, 6);
        },
    },
    {
        id: "balanced-oddeven",
        name: "Balanced Odd/Even",
        description: "All-time frequency order, greedy pick keeping at most 3 odd and 3 even numbers.",
        fn: (prior) => {
            let odd = 0;
            let even = 0;
            const out = [];
            for (const e of freqOrder(entriesOf(prior))) {
                if (e.number % 2 === 1) {
                    if (odd >= 3) continue;
                    odd++;
                } else {
                    if (even >= 3) continue;
                    even++;
                }
                out.push(e.number);
                if (out.length === 6) break;
            }
            return finalize(out);
        },
    },
    {
        id: "sum-band-hot",
        name: "Sum-Band Hot",
        description: "Of the top 14 all-time numbers, the 6-number combination whose sum sits closest to the historical median sum.",
        fn: (prior) => {
            const top14 = take(hotOrder(entriesOf(prior)), 14);
            const target = median(prior.map(sumOf));
            const freqByNumber = new Map(entriesOf(prior).map((e) => [e.number, e.count]));
            let best = null;
            for (let i = 0; i < 14; i++)
                for (let j = i + 1; j < 14; j++)
                    for (let k = j + 1; k < 14; k++)
                        for (let l = k + 1; l < 14; l++)
                            for (let m = l + 1; m < 14; m++)
                                for (let n = m + 1; n < 14; n++) {
                                    const combo = [top14[i], top14[j], top14[k], top14[l], top14[m], top14[n]];
                                    const sum = combo.reduce((a, b) => a + b, 0);
                                    const totalFreq = combo.reduce((a, b) => a + freqByNumber.get(b), 0);
                                    const score = [Math.abs(sum - target), -totalFreq, combo[0], combo[1], combo[2], combo[3], combo[4], combo[5]];
                                    if (!best || score < best.score) best = { combo, score };
                                }
            return best.combo;
        },
    },
    {
        id: "decade-spread",
        name: "Decade Spread",
        description: "Most frequent number of each decade (1-9 … 40-49), plus the most frequent remaining number.",
        fn: (prior) => {
            const freq = entriesOf(prior);
            const decades = [
                [1, 9],
                [10, 19],
                [20, 29],
                [30, 39],
                [40, 49],
            ];
            const picked = new Set();
            for (const [lo, hi] of decades) {
                const inDecade = freq.filter((e) => e.number >= lo && e.number <= hi);
                const pick = inDecade.sort((a, b) => b.count - a.count || a.number - b.number)[0];
                picked.add(pick.number);
            }
            const [sixth] = take(freqOrder(freq), 1, picked);
            return finalize([...picked, sixth]);
        },
    },
    {
        id: "random-seeded",
        name: "Random (Seeded)",
        description: "Uniform random line, seeded with the target draw number so results are reproducible.",
        fn: (_prior, targetDrawNo) => {
            const rand = mulberry32(targetDrawNo);
            const pool = Array.from({ length: 49 }, (_, i) => i + 1);
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            return finalize(pool.slice(0, 6));
        },
    },
];

const emptyStats = () => ({
    evaluatedDraws: 0,
    wins: 0,
    prizeCounts: { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0, g7: 0 },
    totalWinnings: 0,
    winDrawsWithAmounts: 0,
    anyAmountsSeen: false,
});

/**
 * Walk-forward evaluation: for each draw after the warm-up, every strategy picks
 * from strictly earlier draws and is scored against the real outcome. No lookahead.
 */
export function runStrategies(draws49) {
    const draws = [...draws49].sort((a, b) => a.draw - b.draw);
    const stats = new Map(STRATEGIES.map((s) => [s.id, emptyStats()]));

    for (let i = WARMUP; i < draws.length; i++) {
        const prior = draws.slice(0, i);
        const target = draws[i];
        const hasAmounts = (target.prizes?.g1?.share ?? null) != null;
        if (hasAmounts) for (const s of STRATEGIES) stats.get(s.id).anyAmountsSeen = true;

        for (const s of STRATEGIES) {
            const pick = s.fn(prior, target.draw);
            if (pick.length !== 6 || new Set(pick).size !== 6) {
                throw new Error(`Strategy ${s.id} returned an invalid pick for draw ${target.draw}: ${JSON.stringify(pick)}`);
            }
            const g = scoreLine(pick, target);
            const st = stats.get(s.id);
            st.evaluatedDraws++;
            if (g === 0) continue;
            st.wins++;
            st.prizeCounts[`g${g}`]++;
            const share = target.prizes?.[`g${g}`]?.share ?? null;
            if (share != null) {
                st.totalWinnings += share;
                st.winDrawsWithAmounts++;
            }
        }
    }

    const last = draws[draws.length - 1];
    const nextDrawNo = last.draw + 1;

    const rows = STRATEGIES.map((s) => {
        const st = stats.get(s.id);
        return {
            id: s.id,
            name: s.name,
            description: s.description,
            evaluatedDraws: st.evaluatedDraws,
            hitRate: st.evaluatedDraws ? Math.round((st.wins / st.evaluatedDraws) * 10000) / 10000 : 0,
            prizeCounts: st.prizeCounts,
            totalPrizes: st.wins,
            totalWinnings: st.anyAmountsSeen && st.winDrawsWithAmounts > 0 ? st.totalWinnings : null,
            drawsWithAmounts: st.winDrawsWithAmounts,
            currentPick: s.fn(draws, nextDrawNo),
        };
    });

    rows.sort(
        (a, b) =>
            b.hitRate - a.hitRate ||
            b.totalPrizes - a.totalPrizes ||
            (b.totalWinnings ?? -1) - (a.totalWinnings ?? -1) ||
            a.id.localeCompare(b.id),
    );
    return rows;
}

export { STRATEGIES };
