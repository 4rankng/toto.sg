// toto.sg — catalog adoption module 3/4: Almanac & Time, Folk & Culture,
// Mark Six Charts, Other. 81 net-new rows; the full adoption manifest and
// encoding conventions live in catalog-signal-rules.mjs.
//
// Step-4 fixed-table decisions (the doc one-liners name the system; these are
// the standard published forms the league implements, deterministic from the
// draw date, anchored at the era start 2014-10-09):
//   * loShuGrid/dateWheel/grandSumWheel style date arithmetic uses the target
//     draw's calendar date (UTC).
//   * dayHexagram: King Wen hexagram h = (day-of-year − 1) mod 64 + 1; yang
//     lines come from the standard 64-hexagram bit table; yang line k seeds
//     ball ((h + 10k − 1) mod 49) + 1; arithmetic completion fills to 6.
//   * dayOfficers: officer k = (days since 2014-10-09 mod 12) + 1 seeds
//     {k, k+12, k+24, k+36, k+48} ∩ 1..49; arithmetic completion.
//   * flyStarAnnual: Period-9 annual chart; center star for year Y is
//     wrap9(2 − (Y − 2024)) (2024=3碧, 2026=1白); palaces descend along the
//     Lo Shu path. Monthly advances the annual center by (month − 1).
//   * mansion28: mansion j = days mod 28; its ball orbit is {j, j+28, j+7, …}
//     (7 balls, stride 28 on the 49 ring) — the doc's "4-5 ball subset" is
//     the 5 most recent unmasked members, recency fill completes.
//   * moonAge/moonList: new moons 2014-2027 are computed with Meeus' truncated
//     lunar-phase series (day-accurate); moon age = days since the most recent
//     new moon; the lunar day's 28-mansion orbit is the affinity set.
//   * plumBlossom: (month + day) mod 8 → upper trigram, (month + day + hour)
//     mod 8 → lower (hour numeral 10 = 酉, the 18:30 SGT draw hour);
//     trigram n (乾1兑2离3震4巽5坎6艮7坤8) maps to {n, n+8, …, n+40} ∩ 1..49.
//   * sunSign: the sign's classical ruler r seeds {r, r+9, r+18, r+27, r+36}.
//   * biorhythm: cycles 23/28/33 from 2014-10-09; ball b is on a cycle's peak
//     when b mod cycle ∈ {5-8 physical, 6-10 emotional, 7-11 intellectual}.
import {
    RANGE49,
    lineSum,
    sortAsc,
    sampleK,
    tailOf,
    TAIL_CLASSES,
} from "./cross-panel-stats.mjs";
import { byRecency, completeLine, ctxMemo, ensFill, ensTop, nameOf, signalLine, signalLineWide, ensembleScore } from "./catalog-signal-rules.mjs";

// ---------------------------------------------------------------------------
// Calendar helpers — era epoch 2014-10-09
// ---------------------------------------------------------------------------

const EPOCH_MS = Date.parse("2014-10-09T00:00:00Z");

/** Whole days since the 6/49 era start (2014-10-09), UTC. */
const eraDays = (dateIso) => Math.floor((Date.parse(`${dateIso}T00:00:00Z`) - EPOCH_MS) / 86400000);

const monthDayOf = (dateIso) => ({ month: Number(dateIso.slice(5, 7)), day: Number(dateIso.slice(8, 10)) });

/** Arithmetic completion to 6 balls, walking ((h + 10k − 1) mod 49) + 1. */
const arithComplete = (h, seeds) => {
    const set = new Set(seeds.filter((b) => b >= 1 && b <= 49));
    for (let k = 1; k <= 49 && set.size < 6; k++) {
        set.add(((h + 10 * k - 1) % 49) + 1);
    }
    return sortAsc([...set].slice(0, 6));
};

// ---------------------------------------------------------------------------
// Fixed tables
// ---------------------------------------------------------------------------

/** Standard King Wen hexagrams as 6-bit line masks, bottom line first (1=yang). */
const KING_WEN = [
    "111111", "000000", "100010", "010001", "111010", "010111", "010000", "000010",
    "111011", "110111", "111000", "000111", "101111", "111101", "001000", "000100",
    "100110", "011001", "110000", "000011", "100101", "101001", "000001", "100000",
    "100111", "111001", "100001", "011110", "010010", "101101", "001110", "011100",
    "001111", "111100", "000101", "101000", "101011", "110101", "001010", "010100",
    "110001", "100011", "111110", "011111", "000110", "011000", "010110", "011010",
    "101110", "011101", "100100", "001001", "001011", "110100", "101100", "001101",
    "011011", "110110", "010011", "110010", "110011", "001100", "101010", "010101",
];
if (new Set(KING_WEN).size !== 64 || KING_WEN.some((m) => m.length !== 6)) {
    throw new Error("King Wen table corrupted");
}

/** Yang line positions (1=bottom..6=top) of hexagram `h` (1..64). */
const yangLines = (h) => {
    const mask = KING_WEN[(h - 1) % 64];
    const out = [];
    for (let k = 0; k < 6; k++) if (mask[k] === "1") out.push(k + 1);
    return out;
};

/** Lo Shu palace stars for a center star `s` (palace L gets wrap9(s + 5 − L)). */
const wrap9 = (x) => ((((x - 1) % 9) + 9) % 9) + 1;
const flyStarChart = (center) => {
    const palaces = [5, 6, 7, 8, 9, 1, 2, 3, 4]; // the Lo Shu flying path
    return palaces.map((L, i) => wrap9(center - i));
};
/** Period-9 annual center star: 2024=3, 2025=2, 2026=1, 2027=9 … */
const annualCenter = (year) => wrap9(2 - (year - 2024));

/** The 28-lunar-mansion orbit of mansion `j` (1..28): stride 28 on the 49 ring. */
const mansionOrbit = (j) => {
    const balls = [];
    for (let k = 0; ; k++) {
        const b = ((j - 1 + 28 * k) % 49) + 1;
        if (balls.includes(b)) break;
        balls.push(b);
    }
    return balls;
};

/** Trigram ball set: number n → {n, n+8, n+16, n+24, n+32, n+40} ∩ 1..49. */
const trigramBalls = (n) => [n, n + 8, n + 16, n + 24, n + 32, n + 40].filter((b) => b >= 1 && b <= 49);

/**
 * New moons 2013-2028 UTC (Meeus, Astronomical Algorithms ch. 49 — truncated
 * periodic series, day-accurate), sorted; day-level moon age reads off it.
 */
const newMoons = (() => {
    const rad = (deg) => (deg * Math.PI) / 180;
    const out = [];
    const kStart = Math.floor((2013 - 2000) * 12.3685);
    const kEnd = Math.ceil((2028 - 2000) * 12.3685);
    for (let k = kStart; k <= kEnd; k++) {
        const T = k / 1236.85;
        const T2 = T * T;
        const E = 1 - 0.002516 * T - 0.0000074 * T2;
        const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T ** 3;
        const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
        const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
        const O = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T ** 3;
        let jde =
            2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4 +
            -0.4072 * Math.sin(rad(Mp)) +
            0.17241 * E * Math.sin(rad(M)) +
            0.01608 * Math.sin(rad(2 * Mp)) +
            0.01039 * Math.sin(rad(2 * F)) +
            0.00739 * E * Math.sin(rad(Mp - M)) +
            -0.00514 * E * Math.sin(rad(Mp + M)) +
            0.00208 * E * E * Math.sin(rad(2 * M)) +
            -0.00111 * Math.sin(rad(Mp - 2 * F)) +
            -0.00057 * Math.sin(rad(Mp + 2 * F)) +
            0.00056 * E * Math.sin(rad(2 * Mp + M)) +
            -0.00042 * Math.sin(rad(3 * Mp)) +
            0.00042 * E * Math.sin(rad(M + 2 * F)) +
            0.00038 * E * Math.sin(rad(M - 2 * F)) +
            -0.00024 * E * Math.sin(rad(2 * Mp - M)) +
            -0.00017 * Math.sin(rad(O)) +
            -0.00007 * Math.sin(rad(Mp + 2 * M)) +
            0.00004 * Math.sin(rad(2 * Mp - 2 * F)) +
            0.00004 * Math.sin(rad(3 * M)) +
            0.00003 * Math.sin(rad(Mp + M - F)) +
            0.00003 * Math.sin(rad(2 * Mp + 2 * F)) +
            -0.00003 * Math.sin(rad(Mp + M + F)) +
            0.00003 * Math.sin(rad(Mp - M + F)) +
            -0.00002 * Math.sin(rad(Mp - M - F)) +
            -0.00002 * Math.sin(rad(3 * Mp + M)) +
            0.00002 * Math.sin(rad(4 * Mp));
        out.push((jde - 2440587.5) * 86400000); // JDE (TT) → ms; ΔT ≈ 1 min, day-irrelevant
    }
    out.sort((a, b) => a - b);
    return out;
})();

/** Moon age (whole days) of a UTC date: days since the newest new moon ≤ date. */
const moonAgeDays = (dateIso) => {
    const t = Date.parse(`${dateIso}T00:00:00Z`);
    let age = 0;
    for (const nm of newMoons) {
        if (nm > t) break;
        age = Math.floor((t - nm) / 86400000);
    }
    return age;
};

/** Lunar day (1..30) and its 28-mansion orbit for a UTC date. */
const lunarDayOrbit = (dateIso) => {
    const lunarDay = (moonAgeDays(dateIso) % 30) + 1;
    return { lunarDay, orbit: mansionOrbit(((lunarDay - 1) % 28) + 1) };
};

/** Western sign → classical ruler number, from fixed month/day boundaries. */
const signRuler = (dateIso) => {
    const { month, day } = monthDayOf(dateIso);
    const md = month * 100 + day;
    if (md >= 321 && md <= 419) return 9; // Aries — Mars
    if (md >= 420 && md <= 520) return 6; // Taurus — Venus
    if (md >= 521 && md <= 620) return 5; // Gemini — Mercury
    if (md >= 621 && md <= 721) return 2; // Cancer — Moon
    if (md >= 722 && md <= 822) return 1; // Leo — Sun
    if (md >= 823 && md <= 922) return 5; // Virgo — Mercury
    if (md >= 923 && md <= 1022) return 6; // Libra — Venus
    if (md >= 1023 && md <= 1121) return 9; // Scorpio — Mars
    if (md >= 1122 && md <= 1221) return 3; // Sagittarius — Jupiter
    if (md >= 1222 || md <= 119) return 8; // Capricorn — Saturn
    if (md >= 120 && md <= 218) return 8; // Aquarius — Saturn
    return 3; // Pisces — Jupiter
};

const digitSum = (n) => String(n).split("").reduce((a, d) => a + Number(d), 0);
const inSetScore = (ctx, set) =>
    Float64Array.from({ length: 49 }, (_, i) => (set.has(i + 1) ? 1000 - ctx.skips[i] : -ctx.skips[i]));
const Set64 = (arr) => new Set(arr);
const MARK_SIX_RED = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
const MARK_SIX_BLUE = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
const MARK_SIX_GREEN = [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49];
const ZODIAC_COLUMNS = {
    Rat: [7, 19, 31, 43],
    Ox: [6, 18, 30, 42],
    Tiger: [5, 17, 29, 41],
    Rabbit: [4, 16, 28, 40],
    Dragon: [3, 15, 27, 39],
    Snake: [2, 14, 26, 38],
    Horse: [1, 13, 25, 37, 49],
    Goat: [12, 24, 36, 48],
    Monkey: [11, 23, 35, 47],
    Rooster: [10, 22, 34, 46],
    Dog: [9, 21, 33, 45],
    Pig: [8, 20, 32, 44],
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const CATALOG_ALMANAC_RULES = {
    // --- Almanac & Time (12) -------------------------------------------------
    biorhythm: (p, t, r, ctx) => {
        const peaks = [
            [23, [5, 6, 7, 8]],
            [28, [6, 7, 8, 9, 10]],
            [33, [7, 8, 9, 10, 11]],
        ];
        return signalLine(
            ctx,
            r,
            Float64Array.from({ length: 49 }, (_, i) => {
                const b = i + 1;
                let score = 0;
                for (const [cycle, window] of peaks) if (window.includes(b % cycle)) score += 1;
                return score;
            }),
        );
    },
    dayHexagram: (p, t, r, ctx) => {
        const h = ((ctx.dayOfYear - 1) % 64) + 1;
        const seeds = yangLines(h).map((k) => ((h + 10 * k - 1) % 49) + 1);
        return completeLine(ctx, seeds);
    },
    dayOfficers: (p, t, r, ctx) => {
        const k = (eraDays(ctx.dateIso) % 12) + 1;
        return arithComplete(eraDays(ctx.dateIso) + 1, [k, k + 12, k + 24, k + 36, k + 48]);
    },
    dayRoot: (p, t, r, ctx) => {
        const digits = (ctx.dateIso ?? "").replaceAll("-", "").split("").map(Number);
        const u = ((digitSum(digits.join("")) - 1) % 9) + 1;
        const other = u + 45 <= 49 ? u + 45 : u - 4;
        return arithComplete(eraDays(ctx.dateIso) + 1, [u, other]);
    },
    flyStarAnnual: (p, t, r, ctx) => {
        const year = Number(ctx.dateIso?.slice(0, 4) ?? 2026);
        const stars = flyStarChart(annualCenter(year));
        return completeLine(ctx, stars);
    },
    flyStarMonthly: (p, t, r, ctx) => {
        const year = Number(ctx.dateIso?.slice(0, 4) ?? 2026);
        const month = monthDayOf(ctx.dateIso).month;
        const stars = flyStarChart(wrap9(annualCenter(year) - (month - 1)));
        return completeLine(ctx, stars);
    },
    mansion28: (p, t, r, ctx) => {
        const j = (eraDays(ctx.dateIso) % 28) + 1;
        const kept = byRecency(ctx, mansionOrbit(j)).filter((b) => !ctx.mask.has(b)).slice(0, 5);
        return completeLine(ctx, kept);
    },
    moonAge: (p, t, r, ctx) => {
        const { orbit } = lunarDayOrbit(ctx.dateIso);
        return signalLine(ctx, r, inSetScore(ctx, Set64(orbit)));
    },
    moonList: (p, t, r, ctx) => {
        const { orbit } = lunarDayOrbit(ctx.dateIso);
        const members = byRecency(ctx, orbit).filter((b) => !ctx.mask.has(b));
        return completeLine(ctx, members.slice(0, 6));
    },
    plumBlossom: (p, t, r, ctx) => {
        const { month, day } = monthDayOf(ctx.dateIso);
        const hour = 10; // 酉 — the 18:30 SGT draw hour numeral
        const upper = (((month + day) % 8) || 8);
        const lower = (((month + day + hour) % 8) || 8);
        const balls = [...trigramBalls(upper), ...trigramBalls(lower)];
        const members = byRecency(ctx, balls).filter((b) => !ctx.mask.has(b));
        return completeLine(ctx, members.slice(0, 6));
    },
    sunSign: (p, t, r, ctx) => {
        const ruler = signRuler(ctx.dateIso);
        return completeLine(ctx, [ruler, ruler + 9, ruler + 18, ruler + 27, ruler + 36]);
    },
    wealthGod: (p, t, r, ctx) => completeLine(ctx, [8, 18, 28, 38, 48]),

    // --- Folk & Culture (10) -------------------------------------------------
    angelNum: (p, t, r, ctx) => {
        const a = ((ctx.dayOfYear + 11) % 49) + 1;
        const cls = new Set([a]);
        if (50 - a >= 1 && 50 - a <= 49) cls.add(50 - a);
        const rev = Number(String(a).split("").reverse().join(""));
        if (rev >= 1 && rev <= 49) cls.add(rev);
        if (a % 11 === 0) for (const d of [11, 22, 33, 44]) cls.add(d);
        return signalLine(ctx, r, inSetScore(ctx, cls));
    },
    bolakBalik: (p, t, r, ctx) => {
        const flipped = (ctx.last?.numbers ?? [])
            .map((n) => Number(String(n).split("").reverse().join("")))
            .filter((n) => n >= 1 && n <= 49);
        return completeLine(ctx, flipped);
    },
    digit3: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([3, 13, 23, 33, 43]))),
    digit7: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([7, 17, 27, 37, 47]))),
    digit8: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([8, 18, 28, 38, 48]))),
    fsTrio: (p, t, r, ctx) => completeLine(ctx, unmasked(ctx, [8, 18, 28])),
    lucky8: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([8, 18, 28, 38, 48]))),
    noFour: (p, t, r, ctx) =>
        signalLine(
            ctx,
            r,
            Float64Array.from({ length: 49 }, (_, i) => {
                const b = i + 1;
                const hasFour = String(b).includes("4");
                return hasFour ? -ctx.skips[i] : 1000 - ctx.skips[i];
            }),
        ),
    yearHorse: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64(ZODIAC_COLUMNS.Horse))),
    zodiac2026: (p, t, r, ctx) =>
        signalLine(ctx, r, inSetScore(ctx, Set64([...ZODIAC_COLUMNS.Horse, ...ZODIAC_COLUMNS.Tiger, ...ZODIAC_COLUMNS.Dog]))),

    // --- Mark Six Charts (11) ------------------------------------------------
    colorBlue: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64(MARK_SIX_BLUE))),
    colorFollow: (p, t, r, ctx) => colorFollowLine(ctx, r),
    colorGreen: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64(MARK_SIX_GREEN))),
    colorRed: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64(MARK_SIX_RED))),
    shioFollow: (p, t, r, ctx) => {
        const cols = new Set((ctx.last?.numbers ?? []).map((n) => n % 12));
        const pool = RANGE49.filter((b) => cols.has(b % 12) && !ctx.mask.has(b));
        const ens = ensembleScore(ctx);
        const picks = pool.sort((a, b) => ens[b - 1] - ens[a - 1]).slice(0, 6);
        return picks.length === 6 ? sortAsc(picks) : completeLine(ctx, picks);
    },
    tailFollow: (p, t, r, ctx) => {
        const tails = new Set((ctx.last?.numbers ?? []).map(tailOf));
        const pool = RANGE49.filter((b) => tails.has(tailOf(b)) && !ctx.mask.has(b));
        const ens = ensembleScore(ctx);
        const picks = pool.sort((a, b) => ens[b - 1] - ens[a - 1]).slice(0, 6);
        return picks.length === 6 ? sortAsc(picks) : completeLine(ctx, picks);
    },
    wuxingFire: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([2, 3, 10, 11, 18, 19, 32, 33, 40, 41, 48, 49]))),
    wxEarth: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([5, 10, 15, 20, 25, 30, 35, 40, 45]))),
    wxMetal: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([4, 9, 14, 19, 24, 29, 34, 39, 44, 49]))),
    wxWater: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([1, 14, 15, 22, 23, 30, 31, 44, 45]))),
    wxWood: (p, t, r, ctx) => signalLine(ctx, r, inSetScore(ctx, Set64([3, 8, 13, 18, 23, 28, 33, 38, 43, 48]))),

    // --- Other (48) ----------------------------------------------------------
    addlTailChase: (p, t, r, ctx) => {
        const addl = ctx.last?.additional;
        const tail = addl != null ? tailOf(addl) : null;
        const seed = tail != null ? unmasked(ctx, TAIL_CLASSES[tail])[0] : null;
        return completeLine(ctx, seed != null ? [seed] : []);
    },
    affinityAnchor: (p, t, r, ctx) => {
        let anchor = null;
        let bestZ = 0;
        for (let a = 1; a <= 49; a++) {
            if (ctx.mask.has(a)) continue;
            for (let b = a + 1; b <= 49; b++) {
                if (ctx.mask.has(b)) continue;
                const z = ctx.pairZ[(a - 1) * 49 + (b - 1)];
                if (z > bestZ) {
                    bestZ = z;
                    anchor = [a, b];
                }
            }
        }
        if (anchor == null) return completeLine(ctx, []);
        const neutral = RANGE49.filter(
            (b) =>
                !ctx.mask.has(b) &&
                !anchor.includes(b) &&
                Math.abs(ctx.pairZ[(anchor[0] - 1) * 49 + (b - 1)]) <= 1 &&
                Math.abs(ctx.pairZ[(anchor[1] - 1) * 49 + (b - 1)]) <= 1,
        );
        const neutrals = sampleK(r, neutral, Math.min(4, neutral.length));
        const rest = ensFill(ctx, r, 6 - 2 - neutrals.length, new Set([...anchor, ...neutrals]));
        return sortAsc([...anchor, ...neutrals, ...rest]);
    },
    alternatorChase: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.altRun)),
    apTrio: (p, t, r, ctx) => {
        const start = 1 + Math.floor(r() * 43);
        const d = 2 + Math.floor(r() * 7);
        const trio = [start, start + d, start + 2 * d];
        if (trio[2] > 49) return null;
        const rest = ensFill(ctx, r, 3, new Set(trio));
        const line = sortAsc([...trio, ...rest]);
        return lineSum(line) >= 115 && lineSum(line) <= 185 ? line : null;
    },
    dateWheel: (p, t, r, ctx) => {
        const { month, day } = monthDayOf(ctx.dateIso);
        return completeLine(ctx, [((day + month) % 49) + 1]);
    },
    digitSumLadder: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        const seeds = [];
        for (let s = 1; s <= 6; s++) {
            const member = unmasked(ctx, RANGE49.filter((b) => digitSum(b) === s)).sort((a, b) => ens[b - 1] - ens[a - 1])[0];
            if (member != null) seeds.push(member);
        }
        return completeLine(ctx, seeds);
    },
    drawWheel: (p, t, r, ctx) => completeLine(ctx, [(ctx.drawNo % 49) + 1]),
    equalSpread8: (p, t, r, ctx) => spreadEnumeration(ctx, [6, 7, 8, 9, 10, 11], 19, null, "spread8"),
    ewma10: (p, t, r, ctx) => signalLine(ctx, r, ctx.ewma[10]),
    ewma100: (p, t, r, ctx) => signalLine(ctx, r, ctx.ewma[100]),
    ewma20: (p, t, r, ctx) => signalLine(ctx, r, ctx.ewma[20]),
    ewma200: (p, t, r, ctx) => signalLine(ctx, r, ctx.ewma[200]),
    ewma25: (p, t, r, ctx) => signalLine(ctx, r, ctx.ewma[25]),
    ewma75: (p, t, r, ctx) => signalLine(ctx, r, ctx.ewma[75]),
    fibGaps: (p, t, r, ctx) => spreadEnumeration(ctx, [1, 2, 3, 5, 8], 11, [115, 185], "fibGaps"),
    haloExpand: (p, t, r, ctx) => {
        const last = ctx.last?.numbers ?? [];
        const halo = new Set(last.flatMap((n) => [n === 49 ? 1 : n + 1, n === 1 ? 49 : n - 1]));
        const ens = ensembleScore(ctx);
        const seeds = [...halo].filter((b) => !ctx.mask.has(b)).sort((a, b) => ens[b - 1] - ens[a - 1]).slice(0, 2);
        return completeLine(ctx, seeds);
    },
    heSumParity: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        const pool = ensTop(ctx, 18);
        const odd = pool.filter((b) => digitSum(b) % 2 === 1).slice(0, 3);
        const even = pool.filter((b) => digitSum(b) % 2 === 0).slice(0, 3);
        const line = [...odd, ...even];
        if (new Set(line).size < 6) {
            for (const b of pool) {
                if (line.length >= 6) break;
                if (!line.includes(b)) line.push(b);
            }
        }
        return sortAsc(line.slice(0, 6));
    },
    hitMissEdge: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from(ctx.hitMissEdge)),
    ignition2of10: (p, t, r, ctx) =>
        signalLine(
            ctx,
            r,
            Float64Array.from({ length: 49 }, (_, i) => {
                const hits = ctx.w[10][i];
                return hits === 2 ? 1000 : hits >= 4 ? -5000 : 0;
            }),
        ),
    pairSum51: (p, t, r, ctx) => {
        const ens = ensembleScore(ctx);
        let best = null;
        let bestScore = -Infinity;
        for (let n = 2; n <= 25; n++) {
            const m = 51 - n;
            if (ctx.mask.has(n) || ctx.mask.has(m)) continue;
            const score = ens[n - 1] + ens[m - 1];
            if (score > bestScore) {
                bestScore = score;
                best = [n, m];
            }
        }
        if (best == null) return null;
        const rest = ensFill(ctx, r, 4, new Set(best));
        const line = sortAsc([...best, ...rest]);
        return lineSum(line) >= 115 && lineSum(line) <= 185 ? line : null;
    },
    repeatOfRepeat: (p, t, r, ctx) => {
        const d1 = ctx.last?.numbers ?? [];
        const d2 = p.length >= 2 ? p[p.length - 2].numbers : [];
        return signalLine(ctx, r, Float64Array.from({ length: 49 }, (_, i) => (d1.includes(i + 1) && d2.includes(i + 1) ? 1000 : 0)));
    },
    sandwichLine: (p, t, r, ctx) => {
        const rank = RANGE49.slice().sort((a, b) => ctx.w[100][b - 1] - ctx.w[100][a - 1] || a - b);
        const hot = rank.slice(0, 3);
        const cold = rank.slice(-3).reverse();
        const line = [cold[0], hot[0], cold[1], hot[1], cold[2], hot[2]];
        if (new Set(line).size < 6) {
            for (const b of rank) {
                if (line.length >= 6) break;
                if (!line.includes(b)) line.push(b);
            }
        }
        return sortAsc(line.slice(0, 6));
    },
    shapeAllHigh34: (p, t, r, ctx) => {
        const high = RANGE49.filter((b) => b >= 34).sort((a, b) => ctx.freq[b - 1] - ctx.freq[a - 1] || a - b);
        return sortAsc(high.slice(0, 6));
    },
    shapeHighSum: (p, t, r, ctx) => shapeExtreme(ctx, "high"),
    shapeLift: (p, t, r, ctx) => signalLine(ctx, r, ctxMemo(ctx, "shapeLift", (c) => shapeLiftScores(p, c))),
    shapeLowSum: (p, t, r, ctx) => shapeExtreme(ctx, "low"),
    shapeWideSpan: (p, t, r, ctx) => shapeExtreme(ctx, "wide"),
    skipBounce: (p, t, r, ctx) => {
        const score = (b) => ensembleScore(ctx)[b - 1] + (ctx.w[50][b - 1] - (50 * 6) / 49);
        const line = new Set();
        const repeat = RANGE49.filter((b) => ctx.skips[b - 1] === 0).sort((a, b) => score(b) - score(a))[0];
        if (repeat != null) line.add(repeat);
        let taken = 0;
        for (const b of RANGE49.filter((x) => !ctx.mask.has(x) && ctx.skips[x - 1] >= 1 && ctx.skips[x - 1] <= 7).sort((a, b) => score(b) - score(a))) {
            if (taken >= 3 || line.size >= 6) break;
            line.add(b);
            taken += 1;
        }
        for (const b of RANGE49.filter((x) => !ctx.mask.has(x) && ctx.skips[x - 1] >= 24).sort((a, b) => score(b) - score(a))) {
            if (line.size >= 6) break;
            line.add(b);
            break;
        }
        for (const b of maskedRankedSafe(ctx, 30)) {
            if (line.size >= 6) break;
            line.add(b);
        }
        return sortAsc([...line]);
    },
    spectralComm: (p, t, r, ctx) => {
        const v = ctxMemo(ctx, "spectral", (c) => {
            const M = c.M;
            let vec = new Float64Array(49).fill(1 / 7);
            for (let iter = 0; iter < 60; iter++) {
                const w = new Float64Array(49);
                for (let a = 0; a < 49; a++) {
                    let s = 0;
                    for (let b = 0; b < 49; b++) s += M[a * 49 + b] * vec[b];
                    w[a] = s;
                }
                const norm = Math.sqrt(w.reduce((acc, x) => acc + x * x, 0)) || 1;
                for (let i = 0; i < 49; i++) vec[i] = w[i] / norm;
            }
            return vec;
        });
        return signalLine(ctx, r, v);
    },
    sumTgt120: (p, t, r, ctx) => signalLine(ctx, r, ensembleScore(ctx), 115, 125),
    sumTgt135: (p, t, r, ctx) => signalLine(ctx, r, ensembleScore(ctx), 130, 140),
    sumTgt165: (p, t, r, ctx) => signalLine(ctx, r, ensembleScore(ctx), 160, 170),
    sumTgt180: (p, t, r, ctx) => signalLine(ctx, r, ensembleScore(ctx), 175, 185),
    tailHotPair: (p, t, r, ctx) => {
        const hotTail = ctx.tail20.indexOf(Math.max(...ctx.tail20));
        const ens = ensembleScore(ctx);
        const seeds = unmasked(ctx, TAIL_CLASSES[hotTail]).sort((a, b) => ens[b - 1] - ens[a - 1]).slice(0, 2);
        const rest = ensFill(ctx, r, 6 - seeds.length, new Set(seeds));
        return sortAsc([...seeds, ...rest]);
    },
    twiceFive: (p, t, r, ctx) => signalLine(ctx, r, Float64Array.from({ length: 49 }, (_, i) => (ctx.w[5][i] === 2 ? 1000 : 0))),
    zigzagParity: (p, t, r, ctx) => {
        // strict sorted-parity alternation is rare from a skewed ensemble
        // pool — fall back to the whole masked board after 200 attempts.
        for (let attempt = 0; attempt < 1000; attempt++) {
            const pool = attempt < 200 ? ensTop(ctx, 18) : RANGE49.filter((b) => !ctx.mask.has(b));
            const line = sortAsc(sampleK(r, pool, 6));
            let alt = true;
            for (let i = 1; i < 6; i++) if (line[i] % 2 === line[i - 1] % 2) alt = false;
            const s = lineSum(line);
            if (alt && s >= 115 && s <= 185) return line;
        }
        return null;
    },
    ...zodiacColumnRules(),
};

function unmasked(ctx, pool) {
    return pool.filter((b) => !ctx.mask.has(b));
}

function maskedRankedSafe(ctx, size) {
    const ens = ensembleScore(ctx);
    return RANGE49.filter((b) => !ctx.mask.has(b)).sort((a, b) => ens[b - 1] - ens[a - 1] || ctx.freq[b - 1] - ctx.freq[a - 1]).slice(0, size);
}

function zodiacColumnRules() {
    const rules = {};
    for (const [animal, column] of Object.entries(ZODIAC_COLUMNS)) {
        const id = `zod${animal}`;
        rules[id] = (p, t, r, ctx) => {
            const members = byRecency(ctx, column).filter((b) => !ctx.mask.has(b));
            return completeLine(ctx, members);
        };
    }
    return rules;
}

function colorFollowLine(ctx, rng) {
    const addl = ctx.last?.additional;
    if (addl == null) return completeLine(ctx, []);
    const color = MARK_SIX_RED.includes(addl) ? MARK_SIX_RED : MARK_SIX_BLUE.includes(addl) ? MARK_SIX_BLUE : MARK_SIX_GREEN;
    const ens = ensembleScore(ctx);
    const picks = unmasked(ctx, color).sort((a, b) => ens[b - 1] - ens[a - 1]).slice(0, 6);
    return picks.length === 6 ? sortAsc(picks) : completeLine(ctx, picks);
}

/**
 * Enumerate sorted-gap multisets from `gapPool` with starts 1..`startMax`,
 * keeping the highest-ensemble line — optionally restricted to a sum band,
 * falling back to the line closest to sum 150 when the band is unreachable.
 */
function spreadEnumeration(ctx, gapPool, startMax, band, key) {
    return ctxMemo(ctx, key, (c) => spreadEnumerationCompute(c, gapPool, startMax, band));
}

function spreadEnumerationCompute(ctx, gapPool, startMax, band) {
    const ens = ensembleScore(ctx);
    let best = null;
    let bestKey = -Infinity;
    const gapsSorted = [...gapPool].sort((a, b) => a - b);
    const emit = (gaps) => {
        for (let start = 1; start <= startMax; start++) {
            const line = [start];
            for (const g of gaps) line.push(line[line.length - 1] + g);
            if (line[5] > 49) continue;
            const sum = lineSum(line);
            const ensSum = line.reduce((a, b) => a + ens[b - 1], 0);
            // band members always win; without any band line, closest-to-150 wins
            const key =
                band == null ? ensSum : sum >= band[0] && sum <= band[1] ? 10000 + ensSum : ensSum - Math.abs(sum - 150) / 100;
            if (key > bestKey) {
                bestKey = key;
                best = [...line];
            }
        }
    };
    // non-decreasing gap multisets of size 5 (combinations with repetition)
    const recurse = (prefix, remaining, minIdx) => {
        if (remaining === 0) {
            emit(prefix);
            return;
        }
        for (let i = minIdx; i < gapsSorted.length; i++) recurse([...prefix, gapsSorted[i]], remaining - 1, i);
    };
    recurse([], 5, 0);
    return best ? sortAsc(best) : completeLine(ctx, []);
}

function shapeExtreme(ctx, kind) {
    return ctxMemo(ctx, `shape_${kind}`, (c) => shapeExtremeCompute(c, kind));
}

function shapeExtremeCompute(ctx, kind) {
    const ens = ensTop(ctx, 14);
    const freq = (l) => l.reduce((a, b) => a + ctx.freq[b - 1], 0);
    const grade = (l) => {
        const s = lineSum(l);
        const span = l[5] - l[0];
        if (kind === "high" && s >= 185) return freq(l);
        if (kind === "low" && s <= 120) return freq(l);
        if (kind === "wide" && span >= 40) return freq(l);
        return null;
    };
    const pool = [...ens].sort((a, b) => a - b);
    let best = null;
    let bestScore = -Infinity;
    const n = pool.length;
    for (let a = 0; a < n - 5; a++) {
        for (let b = a + 1; b < n - 4; b++) {
            for (let c = b + 1; c < n - 3; c++) {
                for (let d = c + 1; d < n - 2; d++) {
                    for (let e = d + 1; e < n - 1; e++) {
                        for (let f = e + 1; f < n; f++) {
                            const line = [pool[a], pool[b], pool[c], pool[d], pool[e], pool[f]];
                            const score = grade(line);
                            if (score != null && score > bestScore) {
                                bestScore = score;
                                best = line;
                            }
                        }
                    }
                }
            }
        }
    }
    if (best) return sortAsc(best);
    // fallbacks: extreme-value lines keep the shape thesis when the pool
    // cannot satisfy the constraint
    if (kind === "low") return sortAsc(pool.slice(0, 6));
    if (kind === "high") return sortAsc(pool.slice(-6));
    const wide = ensTop(ctx, 30);
    const lo = Math.min(...wide);
    const hi = Math.max(...wide);
    const fill = wide.slice().sort((a, b) => ctx.freq[b - 1] - ctx.freq[a - 1]).filter((b) => b !== lo && b !== hi).slice(0, 4);
    return sortAsc([lo, ...fill, hi]);
}

/** ML-style twin fingerprint: shapeLift's conditional lift vs global rate. */
function shapeLiftScores(p, ctx) {
    const fingerprint = (draw) => {
        const s = sortAsc(draw.numbers);
        return [
            lineSum(s),
            s.filter((b) => b % 2 === 1).length,
            s.filter((b) => b <= 24).length,
            s[5] - s[0],
            new Set(s.map((b) => Math.floor((b - 1) / 10))).size,
            new Set(s.map(tailOf)).size,
            new Set(s.slice(1).map((b, i) => b - s[i])).size,
        ];
    };
    const weight = [3, 1, 1, 1, 1, 1, 1];
    const recent = p.slice(-20).map(fingerprint);
    const target = [0, 0, 0, 0, 0, 0, 0].map((_, i) => recent.reduce((a, f) => a + f[i], 0) / Math.max(1, recent.length));
    const scored = p.slice(0, -1).map((draw, i) => {
        const f = fingerprint(draw);
        const dist = Math.sqrt(f.reduce((a, v, j) => a + weight[j] * (v - target[j]) ** 2, 0));
        return { i, dist };
    });
    const twins = scored.sort((a, b) => a.dist - b.dist).slice(0, 12);
    const scores = new Float64Array(49);
    let wSum = 0;
    for (const twin of twins) {
        const w = 1 / Math.max(1e-9, twin.dist);
        wSum += w;
        for (const b of p[twin.i].numbers) scores[b - 1] += w;
    }
    for (let i = 0; i < 49; i++) scores[i] = scores[i] / Math.max(1e-9, wSum) / Math.max(1e-9, ctx.freq[i] / Math.max(1, ctx.n));
    return scores;
}

// ---------------------------------------------------------------------------
// Row metadata
// ---------------------------------------------------------------------------

/** Curated reader-friendly names, keyed by doc id (fallback: mechanical nameOf). */
const NAME_MAP = {
    biorhythm: "Biorhythm Peaks",
    dayHexagram: "I-Ching Hexagram",
    dayOfficers: "Twelve Day-Officers",
    dayRoot: "Day Root",
    flyStarAnnual: "Annual Flying Star",
    flyStarMonthly: "Monthly Flying Star",
    mansion28: "28 Lunar Mansions",
    moonAge: "Moon Age",
    moonList: "Lunar Calendar List",
    plumBlossom: "Plum Blossom Reading",
    sunSign: "Zodiac Sign Ruler",
    wealthGod: "Wealth God Set",
    angelNum: "Angel Numbers",
    bolakBalik: "Bolak-Balik Digit Flip",
    digit3: "Digit-3 Set",
    digit7: "Digit-7 Set",
    digit8: "Digit-8 Set",
    fsTrio: "Feng-Shui Trio",
    lucky8: "Lucky Eights",
    noFour: "No-Four (Tetraphobia)",
    yearHorse: "Horse-Year Set",
    zodiac2026: "Horse-Year Allies",
    colorBlue: "Blue Number Group",
    colorFollow: "Colour Follow (7th Ball)",
    colorGreen: "Green Number Group",
    colorRed: "Red Number Group",
    shioFollow: "Shio Column Follow",
    tailFollow: "Tail Follow",
    wuxingFire: "Fire Element Set",
    wxEarth: "Earth Element Set",
    wxMetal: "Metal Element Set",
    wxWater: "Water Element Set",
    wxWood: "Wood Element Set",
    addlTailChase: "Additional-Tail Chase",
    affinityAnchor: "Pair-Affinity Anchor",
    alternatorChase: "Alternation Chase",
    apTrio: "Arithmetic Trio",
    dateWheel: "Date Wheel",
    digitSumLadder: "Digit-Sum Ladder",
    drawWheel: "Draw-Number Wheel",
    equalSpread8: "Even-Fan Spread",
    ewma10: "EWMA 10",
    ewma100: "EWMA 100",
    ewma20: "EWMA 20",
    ewma200: "EWMA 200",
    ewma25: "EWMA 25",
    ewma75: "EWMA 75",
    fibGaps: "Fibonacci Gaps",
    haloExpand: "Halo Expand",
    heSumParity: "He-Sum Parity Balance",
    hitMissEdge: "Hit–Miss Edge",
    ignition2of10: "Ignition 2-of-10",
    pairSum51: "Sum-51 Pair",
    repeatOfRepeat: "Repeat of Repeat",
    sandwichLine: "Hot–Cold Sandwich",
    shapeAllHigh34: "All-High Shape",
    shapeHighSum: "High-Sum Shape",
    shapeLift: "Shape-Twin Lift",
    shapeLowSum: "Low-Sum Shape",
    shapeWideSpan: "Wide-Span Shape",
    skipBounce: "Skip Bounce",
    spectralComm: "Spectral Centrality",
    sumTgt120: "Sum Target 120",
    sumTgt135: "Sum Target 135",
    sumTgt165: "Sum Target 165",
    sumTgt180: "Sum Target 180",
    tailHotPair: "Hot-Tail Pair",
    twiceFive: "Twice-in-Five",
    zigzagParity: "Zigzag Parity",
    zodDog: "Dog Column",
    zodDragon: "Dragon Column",
    zodGoat: "Goat Column",
    zodHorse: "Horse Column",
    zodMonkey: "Monkey Column",
    zodOx: "Ox Column",
    zodPig: "Pig Column",
    zodRabbit: "Rabbit Column",
    zodRat: "Rat Column",
    zodRooster: "Rooster Column",
    zodSnake: "Snake Column",
    zodTiger: "Tiger Column",
};

const tuples = (rows) => rows.map(([id, family, description]) => [id, NAME_MAP[id] ?? nameOf(id), family, description]);

export const CATALOG_ALMANAC_ROWS = tuples([
    // Almanac & Time (12)
    ["biorhythm", "Almanac & Time", "Three biorhythm cycles (physical 23d, emotional 28d, intellectual 33d) from a fixed epoch; balls mapped to the cycle days at peak."],
    ["dayHexagram", "Almanac & Time", "Hexagram h = (day-of-year − 1) mod 64 + 1; its yang-line ball set from the I-Ching table seeds the line; arithmetic completion ((h + 10k − 1) mod 49 + 1)."],
    ["dayOfficers", "Almanac & Time", "The 建除十二神 (12 day-officers) officer of the draw date maps to a fixed ball set; arithmetic completion."],
    ["dayRoot", "Almanac & Time", "Root u = digit-sum of the date dd.mm.yyyy reduced to one digit; seeds u and u+45 (or u−4), arithmetic completion."],
    ["flyStarAnnual", "Almanac & Time", "The annual Flying Star (玄空飞星) chart of the current year — star numbers mapped to balls."],
    ["flyStarMonthly", "Almanac & Time", "The MONTHLY flying-star chart layered on the annual — the visiting star's set."],
    ["mansion28", "Almanac & Time", "The 28 lunar mansions mapped onto 1-49; play the current date's mansion set."],
    ["moonAge", "Almanac & Time", "Moon age (days since new moon) of the draw date; each moon-day has an affinity set (lunar 28-mansion sub-sets); form-ranked."],
    ["moonList", "Almanac & Time", "Lunar-calendar number list for the draw date."],
    ["plumBlossom", "Almanac & Time", "梅花易数 plum-blossom divination for the draw timestamp: hour+day+month numerals reduced, mapped to trigram ball sets."],
    ["sunSign", "Almanac & Time", "The current Western zodiac sign's traditional ruler numbers."],
    ["wealthGod", "Almanac & Time", "财神 wealth-god auspicious set (8-tilted numerology)."],
    // Folk & Culture (10)
    ["angelNum", "Folk & Culture", "Angel-number numerology: balls whose number or digit-pattern matches the day's angel number class, form-ranked."],
    ["bolakBalik", "Folk & Culture", "Reverse the digits of each of the last draw's balls (e.g. 26→62, 7→70→ rejected, 13→31); keep valid 1-49 transforms; ensemble fill."],
    ["digit3", "Folk & Culture", "Digit-3 balls {3,13,23,33,43}, form-ranked."],
    ["digit7", "Folk & Culture", "Digit-7 balls {7,17,27,37,47}, form-ranked."],
    ["digit8", "Folk & Culture", "Digit-8 balls {8,18,28,38,48}, form-ranked."],
    ["fsTrio", "Folk & Culture", "Feng-shui wealth trio seed + ensemble fill."],
    ["lucky8", "Folk & Culture", "Digit-8 balls {8,18,28,38,48}, form-ranked — the wealth-number control on the digit-8 set."],
    ["noFour", "Folk & Culture", "All balls WITHOUT the digit 4 (tetraphobia set), form-ranked."],
    ["yearHorse", "Folk & Culture", "Horse-year affinity set (same as zodiac2026 core)."],
    ["zodiac2026", "Folk & Culture", "2026 Horse-year affinity: the Horse column {1, 13, 25, 37, 49} plus allied/triangle columns (Tiger {5, 17, 29, 41}, Dog {9, 21, 33, 45}), form-ranked."],
    // Mark Six Charts (11)
    ["colorBlue", "Mark Six Charts", "Membership of the BLUE group [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48], ranked by form."],
    ["colorFollow", "Mark Six Charts", "The last ADDITIONAL ball's Mark-Six color decides the pool (RED/BLUE/GREEN groups); top-6 ensemble members inside that color."],
    ["colorGreen", "Mark Six Charts", "Membership of the GREEN group [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49], ranked by form."],
    ["colorRed", "Mark Six Charts", "Membership of the Mark-Six RED group [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46], ranked by form."],
    ["shioFollow", "Mark Six Charts", "Take the last draw's 6 balls' shio columns (n mod 12); every ball in those same columns is a candidate; ensemble-rank to 6."],
    ["tailFollow", "Mark Six Charts", "All balls carrying the last draw's unit digits, ensemble-ranked to 6."],
    ["wuxingFire", "Mark Six Charts", "Fire element set [2, 3, 10, 11, 18, 19, 32, 33, 40, 41, 48, 49], form-ranked."],
    ["wxEarth", "Mark Six Charts", "Earth element set (5,0 stems: {5,10,15,20,25,30,35,40,45}), form-ranked."],
    ["wxMetal", "Mark Six Charts", "Metal element set (4,9 stems: {4,9,14,19,24,29,34,39,44,49}), form-ranked."],
    ["wxWater", "Mark Six Charts", "Water element set [1, 14, 15, 22, 23, 30, 31, 44, 45], form-ranked."],
    ["wxWood", "Mark Six Charts", "Wood element set (3,8 mod-10 stems: {3,8,13,18,23,28,33,38,43,48}), form-ranked."],
    // Other (48)
    ["addlTailChase", "Other", "One ball sharing the last ADDITIONAL ball's last digit + ensemble fill."],
    ["affinityAnchor", "Other", "Anchor one of the top-5 positive-z pairs; fill 4 slots with balls whose pair-z with BOTH anchors lies in [−1,+1] (neutral); ensemble fill the rest."],
    ["alternatorChase", "Other", "Length of the trailing hit/miss alternation run (positive when currently absent — the due side of an alternating rhythm)."],
    ["apTrio", "Other", "An arithmetic progression (n, n+d, n+2d) embedded in the line; sum banded."],
    ["dateWheel", "Other", "Seed = (next draw day + month) mod 49 + 1; ensemble fill."],
    ["digitSumLadder", "Other", "Six balls carrying distinct digit-sums 1,2,3,4,5,6 + ensemble fill."],
    ["drawWheel", "Other", "Seed = draw number mod 49 + 1; ensemble fill."],
    ["equalSpread8", "Other", "Every sorted gap in 6-11 — the even fan; deterministic enumeration of start + 5 gaps."],
    ["ewma10", "Other", "EWMA of hits with half-life 10 draws."],
    ["ewma100", "Other", "EWMA of hits with half-life 100 draws."],
    ["ewma20", "Other", "EWMA of hits with half-life 20 draws."],
    ["ewma200", "Other", "EWMA of hits with half-life 200 draws."],
    ["ewma25", "Other", "EWMA of hits with half-life 25 draws."],
    ["ewma75", "Other", "EWMA of hits with half-life 75 draws."],
    ["fibGaps", "Other", "Sorted gaps drawn from {1,2,3,5,8} (Fibonacci), start 1-11, span fit to sum band."],
    ["haloExpand", "Other", "Two balls from the ±1 WRAPAROUND halo (1↔49 wrap) of the previous draw, ensemble fill."],
    ["heSumParity", "Other", "Compute each candidate ball's digit-sum parity; from the ensemble top pool take the 3 highest odd-digit-sum balls + the 3 highest even-digit-sum balls — the Chinese he-sum (合数) parity balance."],
    ["hitMissEdge", "Other", "Per-ball P(hit | missed previous) − P(hit | hit previous) — the raw transition edge."],
    ["ignition2of10", "Other", "Indicator of exactly 2 hits in the last 10 draws (early ignition); balls with ≥4 hits in 10 are banned."],
    ["pairSum51", "Other", "One pair summing to 51 + structural fill."],
    ["repeatOfRepeat", "Other", "Indicator of hitting at BOTH t−1 and t−2 — balls that were already repeaters."],
    ["sandwichLine", "Other", "Cold,hot,cold,hot,cold,hot — alternate the coldest and hottest balls of the last 100 draws."],
    ["shapeAllHigh34", "Other", "Every ball ≥34, maximise all-time frequency — the all-high shape bet."],
    ["shapeHighSum", "Other", "Among ensemble top-pool lines with sum ≥185, maximise summed all-time frequency — the high-sum shape bet."],
    ["shapeLift", "Other", "The 10 nearest shape twins weighted by inverse distance; score = weighted appearance rate ÷ the ball's global rate — conditional lift."],
    ["shapeLowSum", "Other", "Same construction with sum ≤120 — the low-sum shape bet."],
    ["shapeWideSpan", "Other", "Span (max−min) ≥40, maximise all-time frequency — the wide-span shape bet."],
    ["skipBounce", "Other", "1×skip-0 (mask bypass by thesis) + 3×skip(1-7) + ≤1×skip(24+), ensemble+surge ranked."],
    ["spectralComm", "Other", "Leading eigenvector of the co-occurrence matrix — spectral centrality of the pair graph."],
    ["sumTgt120", "Other", "Ensemble-ranked line with sum steered into the 120 band."],
    ["sumTgt135", "Other", "Sum steered to the 135 band (dense region)."],
    ["sumTgt165", "Other", "Sum steered to 165."],
    ["sumTgt180", "Other", "Sum steered to 180 (upper band)."],
    ["tailHotPair", "Other", "2 balls from the hottest tail digit of the last 20 draws + ensemble fill."],
    ["twiceFive", "Other", "Indicator of exactly 2 hits in the last 5 draws."],
    ["zigzagParity", "Other", "Strictly alternating odd/even when sorted (parities 010101 or 101010), sum 115-185."],
    ["zodDog", "Other", "The Dog zodiac column of the Mark-Six board {9, 21, 33, 45} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodDragon", "Other", "The Dragon zodiac column of the Mark-Six board {3, 15, 27, 39} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodGoat", "Other", "The Goat zodiac column of the Mark-Six board {12, 24, 36, 48} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodHorse", "Other", "The Horse zodiac column of the Mark-Six board {1, 13, 25, 37, 49} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodMonkey", "Other", "The Monkey zodiac column of the Mark-Six board {11, 23, 35, 47} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodOx", "Other", "The Ox zodiac column of the Mark-Six board {6, 18, 30, 42} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodPig", "Other", "The Pig zodiac column of the Mark-Six board {8, 20, 32, 44} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodRabbit", "Other", "The Rabbit zodiac column of the Mark-Six board {4, 16, 28, 40} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodRat", "Other", "The Rat zodiac column of the Mark-Six board {7, 19, 31, 43} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodRooster", "Other", "The Rooster zodiac column of the Mark-Six board {10, 22, 34, 46} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodSnake", "Other", "The Snake zodiac column of the Mark-Six board {2, 14, 26, 38} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
    ["zodTiger", "Other", "The Tiger zodiac column of the Mark-Six board {5, 17, 29, 41} (balls ≡ column mod 12) — members by recency, masked ensemble fill to 6."],
]);

/** The league rows this module evaluates. */
export const CATALOG_ALMANAC_STRATEGIES = CATALOG_ALMANAC_ROWS;

// Module 3 = 81 net-new rows; rules and rows must stay in lockstep.
if (CATALOG_ALMANAC_STRATEGIES.length !== 81) {
    throw new Error(`catalog-almanac manifest drift: ${CATALOG_ALMANAC_STRATEGIES.length} ≠ 81`);
}
const ruleIds3 = Object.keys(CATALOG_ALMANAC_RULES);
if (ruleIds3.length !== CATALOG_ALMANAC_STRATEGIES.length) {
    throw new Error(`catalog-almanac rule/strategy drift: ${ruleIds3.length} rules vs ${CATALOG_ALMANAC_STRATEGIES.length} rows`);
}
for (const [id] of CATALOG_ALMANAC_STRATEGIES) {
    if (!CATALOG_ALMANAC_RULES[id]) throw new Error(`catalog-almanac missing rule: ${id}`);
}
