// toto.sg — statistical analysis over the 6/49 era draws. Zero deps.

const ROUND2 = (x) => Math.round(x * 100) / 100;
const ROUND4 = (x) => Math.round(x * 10000) / 10000;

/**
 * Toto switched 6/45 → 6/49 on 2014-10-09. Sanity rule: if a draw dated in
 * [switch, 2015) already contains a number > 45, the true boundary is the first
 * such draw — move to it instead of trusting the nominal date.
 */
export function filterEra(draws) {
    const nominal = "2014-10-09";
    const ordered = [...draws].sort((a, b) => a.draw - b.draw);
    const firstOver45 = ordered.find(
        (d) => d.date >= nominal && d.date < "2015-01-01" && d.numbers.some((n) => n > 45),
    );
    const boundary = firstOver45 ? firstOver45.date : nominal;
    return ordered.filter((d) => d.date >= boundary);
}

const freqCounts = (draws) => {
    const f = Array(49).fill(0);
    for (const d of draws) for (const n of d.numbers) f[n - 1]++;
    return f;
};

/** gap[i] = draws since number i+1 was last seen, from the end of `draws`. */
const lastSeenGaps = (draws) => {
    const gap = Array(49).fill(draws.length);
    draws.forEach((d, i) => {
        for (const n of d.numbers) gap[n - 1] = draws.length - 1 - i;
    });
    return gap;
};

const entries = (counts, gaps) =>
    counts.map((count, i) => ({ number: i + 1, count, gap: gaps[i] }));

const topBy = (arr, cmp, n) => [...arr].sort(cmp).slice(0, n);

const hotCmp = (a, b) => b.count - a.count || a.gap - b.gap || a.number - b.number;
const coldCmp = (a, b) => a.count - b.count || b.gap - a.gap || a.number - b.number;
const overdueCmp = (a, b) => b.gap - a.gap || a.number - b.number;

const median = (values) => {
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayOf = (iso) => WEEKDAYS[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7];

export function computeAnalysis(draws49) {
    const draws = [...draws49].sort((a, b) => a.draw - b.draw);
    const total = draws.length;

    const frequencyAll = freqCounts(draws);
    const last50 = draws.slice(-50);
    const frequencyLast50 = freqCounts(last50);
    const gapsAll = lastSeenGaps(draws);
    const gapsLast50 = lastSeenGaps(last50);

    const hot = {
        all: topBy(entries(frequencyAll, gapsAll), hotCmp, 12),
        last50: topBy(entries(frequencyLast50, gapsLast50), hotCmp, 12),
    };
    const cold = {
        all: topBy(entries(frequencyAll, gapsAll), coldCmp, 12),
        last50: topBy(entries(frequencyLast50, gapsLast50), coldCmp, 12),
    };
    const overdue = topBy(entries(frequencyAll, gapsAll), overdueCmp, 12);
    const lastSeen = entries(frequencyAll, gapsAll).map(({ number, gap }) => ({ number, gap }));

    const oddEven = Array(7).fill(0);
    const lowHigh = Array(7).fill(0);
    const sums = [];
    const decades = [0, 0, 0, 0, 0];
    const pairCounts = new Map();
    const consecutivePairCounts = new Map();
    let drawsWithConsecutive = 0;

    for (const d of draws) {
        const odd = d.numbers.filter((n) => n % 2 === 1).length;
        oddEven[odd]++;
        const low = d.numbers.filter((n) => n <= 24).length;
        lowHigh[low]++;
        const sum = d.numbers.reduce((a, b) => a + b, 0);
        sums.push(sum);
        for (const n of d.numbers) decades[Math.min(Math.floor((n - 1) / 10), 4)]++;

        const sorted = [...d.numbers].sort((a, b) => a - b);
        let hasConsecutive = false;
        for (let i = 0; i < sorted.length; i++) {
            const key = `${sorted[i]},${sorted[i] + 1}`;
            if (sorted[i + 1] === sorted[i] + 1) {
                consecutivePairCounts.set(key, (consecutivePairCounts.get(key) ?? 0) + 1);
                hasConsecutive = true;
            }
            for (let j = i + 1; j < sorted.length; j++) {
                const pk = `${sorted[i]},${sorted[j]}`;
                pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + 1);
            }
        }
        if (hasConsecutive) drawsWithConsecutive++;
    }

    const bandEdges = [60, 90, 120, 150, 180, 210, 240, 270, 300];
    const bands = bandEdges.slice(0, -1).map((lo, i) => ({
        band: `${lo}-${bandEdges[i + 1] - 1}`,
        count: sums.filter((s) => s >= lo && s < bandEdges[i + 1]).length,
    }));

    const pairList = [...pairCounts.entries()].map(([key, count]) => {
        const [a, b] = key.split(",").map(Number);
        return { a, b, count };
    });

    const consecutiveTopPairs = [...consecutivePairCounts.entries()].map(([key, count]) => {
        const [a, b] = key.split(",").map(Number);
        return { a, b, count };
    });

    // Repeaters: winning numbers repeating from the previous draw.
    let repeatDraws = 0;
    let repeatTotal = 0;
    for (let i = 1; i < total; i++) {
        const prev = new Set(draws[i - 1].numbers);
        const repeats = draws[i].numbers.filter((n) => prev.has(n)).length;
        repeatTotal += repeats;
        if (repeats > 0) repeatDraws++;
    }
    const repeatEvaluated = Math.max(total - 1, 0);

    const weekday = {};
    for (const day of WEEKDAYS) weekday[day] = { count: 0, sumTotal: 0 };
    for (let i = 0; i < total; i++) {
        const w = weekday[weekdayOf(draws[i].date)];
        w.count++;
        w.sumTotal += sums[i];
    }
    for (const day of WEEKDAYS) {
        const w = weekday[day];
        weekday[day] = { count: w.count, meanSum: w.count ? ROUND2(w.sumTotal / w.count) : 0 };
    }

    const group1ByYear = {};
    for (const d of draws) {
        const g1 = d.prizes?.g1;
        if (!g1) continue;
        const year = d.date.slice(0, 4);
        const slot = (group1ByYear[year] ??= { wins: 0, maxJackpot: 0 });
        slot.wins += g1.winners ?? 0;
        if ((g1.share ?? 0) > slot.maxJackpot) slot.maxJackpot = g1.share;
    }

    return {
        generatedAt: new Date().toISOString(),
        coverage: {
            firstDraw: draws[0]?.draw ?? null,
            lastDraw: draws[total - 1]?.draw ?? null,
            totalDraws: total,
            firstDate: draws[0]?.date ?? null,
            lastDate: draws[total - 1]?.date ?? null,
        },
        frequency: { all: frequencyAll, last50: frequencyLast50 },
        hot,
        cold,
        overdue,
        lastSeen,
        oddEven,
        lowHigh,
        sum: { bands, mean: ROUND2(sums.reduce((a, b) => a + b, 0) / total), median: median(sums) },
        decades: decades.map((c) => ROUND2(c / total)),
        consecutive: {
            drawRate: ROUND4(drawsWithConsecutive / total),
            topPairs: topBy(consecutiveTopPairs, (a, b) => b.count - a.count || a.a - b.a, 5),
        },
        pairs: topBy(pairList, (a, b) => b.count - a.count || a.a - b.a || a.b - b.b, 10),
        repeaters: {
            rate: ROUND4(repeatDraws / repeatEvaluated),
            avgCount: ROUND2(repeatTotal / repeatEvaluated),
        },
        weekday,
        group1ByYear,
    };
}
