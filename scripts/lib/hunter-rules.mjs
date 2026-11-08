// toto.sg — the nine Seed Hunters (from G2_Hunters_Strategy_Guide.docx, 8 Nov 2026).
//
// The guide's recipe, per fold (era index t, target draw era[t]):
//   1. NO-RECYCLE POOL  block the previous draw's 6 mains + additional ball;
//                       43 of the 49 balls remain eligible.
//   2. TILT ROLL        rotate the pool by tilt = (v·13 + t·29) mod 43, where
//                       v is the hunter's seed — each hunter explores a
//                       different rotation of the board.
//   3. SEEDED SAMPLE    draw 6 balls without replacement from the rotated
//                       pool with numpy's PCG64 generator seeded at
//                       777,000,000 + v·7919 + t; sort ascending. The seed
//                       formula makes every line reproducible forever: same
//                       variant, same fold, same six numbers.
//
// The nine seeds were found by an exhaustive walk-forward search (12,000
// deterministic variants × 838 folds = 10.06M graded line-draws) that kept
// exactly the variants whose historical line matched 5 mains + the additional
// ball once. Each carries a real Group-2 fold, but the guide is candid about
// what that is worth: at 10.06M draws the expected Group-2 count for random
// play is ≈ 4.3 and the search surfaced 9 — a favourable draw from the search
// space, not a property of the seeds. Draws after #4232 are the honest
// out-of-sample test; per line per draw the base rate stays 1 in 2,330,636.
//
// Bit-exactness: the guide's reference implementation runs on numpy, so this
// module ports the exact numpy pipeline rather than approximating it —
// SeedSequence (O'Neill's seed_seq hash, numpy/random/bit_generator.pyx),
// PCG64 XSL-RR 128/64 with the srandom warm-up (numpy/random/src/pcg64/
// pcg64.h), Generator.integers' 32-bit Lemire sampler over the PCG64
// half-word stream (low half first, high half cached), and Generator.choice's
// Floyd sampling. Verified against numpy 2.0.2: identical (state, inc) and
// identical 6-ball lines on every fold of all nine variants plus 5,000
// random seeds.
//
// The randomness here does not flow through the league's rngFor(id, drawNo) —
// it cannot, or the lines would no longer reproduce the guide's corpus — but
// it is fully deterministic per (seed, fold), so the REPRODUCIBLE contract
// holds: reruns are byte-identical apart from meta.generatedAt.
const M32 = 0xffffffff;
const M64 = (1n << 64n) - 1n;
const M128 = (1n << 128n) - 1n;
const INIT_A = 0x43b0d7e5;
const MULT_A = 0x931e8875;
const INIT_B = 0x8b51f9dd;
const MULT_B = 0x58f38ded;
const MIX_MULT_L = 0xca01f9dd;
const MIX_MULT_R = 0x4973f715;
// PCG_DEFAULT_MULTIPLIER_128 = 0x2360ED051FC65DA44385DF649FCCF645
const PCG_MULT = (0x2360ed051fc65da4n << 64n) | 0x4385df649fccf645n;

const u32 = (x) => x >>> 0;

/** O'Neill hashmix: xor-fold a value through a rolling hash constant. */
function hashmix(value, hc) {
    value = u32(value ^ hc);
    hc = u32(Math.imul(hc, MULT_A));
    value = u32(Math.imul(value, hc));
    return [u32(value ^ (value >>> 16)), hc];
}

/** O'Neill mix of two uint32 words. */
function mix(x, y) {
    const r = u32(u32(Math.imul(MIX_MULT_L, x)) - u32(Math.imul(MIX_MULT_R, y)));
    return u32(r ^ (r >>> 16));
}

/** A non-negative BigInt as little-endian uint32 words (numpy _int_to_uint32_array). */
function intToWords(n) {
    const words = [];
    if (n === 0n) return [0];
    while (n > 0n) {
        words.push(Number(n & 0xffffffffn));
        n >>= 32n;
    }
    return words;
}

/** SeedSequence(int).pool — the 4-word hashed entropy pool. */
function seedPool(seedInt) {
    const entropy = intToWords(BigInt(seedInt));
    let hc = INIT_A;
    const pool = [];
    for (let i = 0; i < 4; i++) {
        const [v, nextHc] = hashmix(i < entropy.length ? entropy[i] : 0, hc);
        pool.push(v);
        hc = nextHc;
    }
    for (let iSrc = 0; iSrc < 4; iSrc++) {
        for (let iDst = 0; iDst < 4; iDst++) {
            if (iSrc !== iDst) {
                const [h, nextHc] = hashmix(pool[iSrc], hc);
                pool[iDst] = mix(pool[iDst], h);
                hc = nextHc;
            }
        }
    }
    return pool;
}

/** SeedSequence.generate_state(n, uint64) — little-endian uint32 pairs. */
function generateState64(pool, n64) {
    let hc = INIT_B;
    const words = [];
    for (let i = 0; i < n64 * 2; i++) {
        let v = u32(pool[i % 4] ^ hc);
        hc = u32(Math.imul(hc, MULT_B));
        v = u32(Math.imul(v, hc));
        words.push(u32(v ^ (v >>> 16)));
    }
    const out = [];
    for (let k = 0; k < n64; k++) out.push(BigInt(words[2 * k]) | (BigInt(words[2 * k + 1]) << 32n));
    return out;
}

const rotr64 = (v, r) => { const n = BigInt(r); return n === 0n ? v : ((v >> n) | (v << (64n - n))) & M64; };

/** numpy PCG64 (XSL-RR 128/64) seeded from a SeedSequence-style int. */
class Pcg64 {
    constructor(seedInt) {
        const w = generateState64(seedPool(seedInt), 4); // seed = w0,w1; stream = w2,w3
        const initstate = (w[0] << 64n) | w[1];
        const initseq = (w[2] << 64n) | w[3];
        this.state = 0n;
        this.inc = ((initseq << 1n) | 1n) & M128;
        this.step();
        this.state = (this.state + initstate) & M128;
        this.step();
        this.has32 = false;
        this.uinteger = 0;
    }

    step() {
        this.state = (this.state * PCG_MULT + this.inc) & M128;
    }

    next64() {
        this.step();
        const hi = this.state >> 64n;
        const lo = this.state & M64;
        return rotr64(hi ^ lo, Number(hi >> 58n));
    }

    next32() {
        if (this.has32) {
            this.has32 = false;
            return this.uinteger;
        }
        const w = this.next64();
        this.has32 = true;
        this.uinteger = Number(w >> 32n);
        return Number(w & 0xffffffffn);
    }
}

/** Generator.integers(0, n) — Lemire on the 32-bit stream, low-word threshold. */
function lemireIntegers(rng, n) {
    for (;;) {
        const x = rng.next32();
        const prod = x * n;
        const m = Math.floor(prod / 0x100000000);
        const l = prod % 0x100000000;
        if (l >= n) return m;
        if (l >= 0x100000000 % n) return m;
    }
}

/** Generator.choice(pop, 6, replace=False) — Floyd's algorithm. */
function choice6(rng, pop) {
    const chosen = new Set();
    for (let i = pop - 6; i < pop; i++) {
        const v = lemireIntegers(rng, i + 1);
        chosen.add(chosen.has(v) ? i : v);
    }
    return chosen;
}

/**
 * The guide's line for seed `v` at era index `t`. The no-recycle family
 * blocks era[t-1]'s 6 mains + additional ball (43 eligible; t = 0 has nothing
 * to block); the full-board family spins over all 49. The tilt stays mod 43
 * in both — the reference code applies that shift literally, even on the
 * 49-ball pool (43 < 49, so the mod-43 shift is always in range).
 */
export function fleetLine(v, t, { fullBoard = false, lastDraw = null } = {}) {
    const blocked = new Set(!fullBoard && t && lastDraw ? [...lastDraw.numbers, lastDraw.additional] : []);
    const pool = [];
    for (let n = 1; n <= 49; n++) if (!blocked.has(n)) pool.push(n); // 1-based, ascending
    const tilt = (v * 13 + t * 29) % 43;
    const rolled = [];
    for (let i = 0; i < pool.length; i++) rolled.push(pool[(i - tilt + pool.length) % pool.length]);
    const rng = new Pcg64(777_000_000 + v * 7919 + t);
    return [...choice6(rng, pool.length)].map((i) => rolled[i]).sort((a, b) => a - b);
}

/** The original no-recycle line — kept as the nine's public name. */
export const hunterLine = (v, t, lastDraw) => fleetLine(v, t, { lastDraw });

/** The nine no-recycle hunters: id, name, seed v. */
const HUNTERS = [
    ["hunterEclipse", "Eclipse Hunter", 928],
    ["hunterNova", "Nova Hunter", 10677],
    ["hunterVega", "Vega Hunter", 6436],
    ["hunterSirius", "Sirius Hunter", 4756],
    ["hunterOrion", "Orion Hunter", 2612],
    ["hunterAurora", "Aurora Hunter", 3142],
    ["hunterComet", "Comet Hunter", 11145],
    ["hunterLyra", "Lyra Hunter", 9682],
    ["hunterPhoenix", "Phoenix Hunter", 1542],
];

/** The thirteen full-board hunters: id, name, seed v. */
const BOARD_HUNTERS = [
    ["boardTrident", "Trident Hunter", 756885],
    ["boardLonginus", "Longinus Hunter", 742996],
    ["boardExcalibur", "Excalibur Hunter", 976976],
    ["boardGungnir", "Gungnir Hunter", 1357203],
    ["boardMjolnir", "Mjolnir Hunter", 824842],
    ["boardZulfiqar", "Zulfiqar Hunter", 276091],
    ["boardKusanagi", "Kusanagi Hunter", 549982],
    ["boardGram", "Gram Hunter", 392238],
    ["boardDurandal", "Durandal Hunter", 957889],
    ["boardBalmung", "Balmung Hunter", 837872],
    ["boardTizona", "Tizona Hunter", 1331464],
    ["boardArondight", "Arondight Hunter", 1257656],
    ["boardJoyeuse", "Joyeuse Hunter", 1055603],
];

/** The two crowned full-board lines: id, name, seed v. */
const CROWN_KINGS = [
    ["crownRegis", "Crown Regis", 1033843],
    ["crownAstra", "Crown Astra", 534156],
];

const HUNTER_FAMILY = "Seed Hunters";
const BOARD_FAMILY = "Board Hunters";
const CROWN_FAMILY = "Crown Kings";

/** Plain-language line per strategy — the "lucky dial" is the seed v. */
const DIAL_TEXT = {
    hunterEclipse: "Sets aside the previous draw's seven balls, then its lucky dial (928) picks six of the survivors.",
    hunterNova: "After parking the previous draw's seven balls, its lucky dial (10677) points to the six it plays.",
    hunterVega: "Plays six balls its lucky dial (6436) picks from everything the previous draw missed.",
    hunterSirius: "Its lucky dial (4756) chooses six from the 43 balls the previous draw left behind.",
    hunterOrion: "Skips every ball the previous draw used, then its lucky dial (2612) picks six.",
    hunterAurora: "Turns away from the previous draw's numbers and reads six from its lucky dial (3142).",
    hunterComet: "A fresh spin of its lucky dial (11145) over the balls the previous draw did not touch.",
    hunterLyra: "The previous draw's seven sit out; its lucky dial (9682) fills the line with six of the rest.",
    hunterPhoenix: "Rises from the previous draw's leftovers — its lucky dial (1542) picks six of the 43.",
    boardTrident: "Spins its lucky dial (756885) across the full 1–49 board and plays the six it points to.",
    boardLonginus: "One fixed spin of its lucky dial (742996) over the whole board decides the line.",
    boardExcalibur: "The whole board, one lucky dial (976976), six balls — nothing else gets a say.",
    boardGungnir: "Its lucky dial (1357203) shows up every round: full board in, six balls out.",
    boardMjolnir: "Brings the same lucky dial (824842) down on the full board every single draw.",
    boardZulfiqar: "The full 1–49 board is its field; its lucky dial (276091) marks the six it plays.",
    boardKusanagi: "Its lucky dial (549982) sweeps the entire board and plays whatever six it rests on.",
    boardGram: "A fixed lucky dial (392238) turns over the full board once per draw and picks six.",
    boardDurandal: "The board never changes and neither does its lucky dial (957889) — six balls per spin.",
    boardBalmung: "Reads the full 1–49 board through its own lucky dial (837872) and plays six.",
    boardTizona: "Its lucky dial (1331464) takes the whole board for a spin before naming six.",
    boardArondight: "Every round its lucky dial (1257656) walks the full board and stops on six.",
    boardJoyeuse: "The full board spins past its lucky dial (1055603); six balls stay in the line.",
    crownRegis: "Its lucky dial (1033843) has landed a perfect six before — full board, fresh spin every round.",
    crownAstra: "A perfect six on its record; its lucky dial (534156) keeps spinning over the full board.",
};

const isBoardOrCrown = new Set([...BOARD_HUNTERS, ...CROWN_KINGS].map(([id]) => id));

export const HUNTER_STRATEGIES = [
    ...HUNTERS.map(([id, name, v]) => [id, name, HUNTER_FAMILY, DIAL_TEXT[id]]),
    ...BOARD_HUNTERS.map(([id, name, v]) => [id, name, BOARD_FAMILY, DIAL_TEXT[id]]),
    ...CROWN_KINGS.map(([id, name, v]) => [id, name, CROWN_FAMILY, DIAL_TEXT[id]]),
];

// Manifest: 9 no-recycle + 13 full-board hunters + 2 crowns = 24 rows.
if (HUNTER_STRATEGIES.length !== 24 || new Set(HUNTER_STRATEGIES.map((s) => s[0])).size !== 24) {
    throw new Error(`fleet manifest drift: ${HUNTER_STRATEGIES.length} rows`);
}

export const HUNTER_RULES = Object.fromEntries(
    [...HUNTERS, ...BOARD_HUNTERS, ...CROWN_KINGS].map(([id, , v]) => [
        id,
        (prior) =>
            fleetLine(v, prior.length, {
                fullBoard: isBoardOrCrown.has(id),
                lastDraw: prior.length ? prior[prior.length - 1] : null,
            }),
    ]),
);
