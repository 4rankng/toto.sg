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
 * The guide's g2hunter_line: the deterministic 6-ball line for seed `v` at
 * era index `t`. `lastDraw` is era[t-1] (null when t = 0 — then all 49 balls
 * are eligible, matching the reference implementation's unblocked pool).
 */
export function hunterLine(v, t, lastDraw) {
    const blocked = new Set(t ? [...lastDraw.numbers, lastDraw.additional] : []);
    const pool = [];
    for (let n = 1; n <= 49; n++) if (!blocked.has(n)) pool.push(n); // 1-based, ascending
    const tilt = ((v * 13 + t * 29) % 43) % pool.length; // np.roll shift
    const rolled = [];
    for (let i = 0; i < pool.length; i++) rolled.push(pool[(i - tilt + pool.length) % pool.length]);
    const rng = new Pcg64(777_000_000 + v * 7919 + t);
    return [...choice6(rng, pool.length)].map((i) => rolled[i]).sort((a, b) => a - b);
}

/** The nine registered hunters: id, name, family, description, seed v. */
const HUNTERS = [
    ["hunterEclipse", "Eclipse Hunter", 928, "Draw #3924 (23 Nov 2023) — tilt-rolled PCG64 seed v=928, the top of the searched pack (22 prizes)."],
    ["hunterNova", "Nova Hunter", 10677, "Draw #3815 (7 Nov 2022) — tilt-rolled PCG64 seed v=10677 (20 prizes)."],
    ["hunterVega", "Vega Hunter", 6436, "Draw #3468 (22 Apr 2019) — tilt-rolled PCG64 seed v=6436 (18 prizes)."],
    ["hunterSirius", "Sirius Hunter", 4756, "Draw #3483 (13 Jun 2019) — tilt-rolled PCG64 seed v=4756 (18 prizes)."],
    ["hunterOrion", "Orion Hunter", 2612, "Draw #3437 (3 Jan 2019) — tilt-rolled PCG64 seed v=2612 (16 prizes)."],
    ["hunterAurora", "Aurora Hunter", 3142, "Draw #4150 (22 Jan 2026) — tilt-rolled PCG64 seed v=3142 (16 prizes)."],
    ["hunterComet", "Comet Hunter", 11145, "Draw #3513 (26 Sep 2019) — tilt-rolled PCG64 seed v=11145 (15 prizes)."],
    ["hunterLyra", "Lyra Hunter", 9682, "Draw #4210 (20 Aug 2026) — tilt-rolled PCG64 seed v=9682 (12 prizes)."],
    ["hunterPhoenix", "Phoenix Hunter", 1542, "Draw #3514 (30 Sep 2019) — tilt-rolled PCG64 seed v=1542 (10 prizes)."],
];

const HUNTER_FAMILY = "Seed Hunters";
const HUNTER_PREFIX = "Blocks the previous draw's seven balls, tilt-rolls the remaining 43 and PCG64-samples six at a per-fold seed — a mined seed, not a method: 12,000 variants were searched over the archive for their one Group-2 fold";

export const HUNTER_STRATEGIES = HUNTERS.map(([id, name, v, note]) => [
    id,
    name,
    HUNTER_FAMILY,
    `${HUNTER_PREFIX} (${note}). Searched-in hits carry no out-of-sample power; from draw #4233 every hunter plays live at the 1-in-2,330,636 base rate.`,
]);

export const HUNTER_RULES = Object.fromEntries(
    HUNTERS.map(([id, , v]) => [
        id,
        (prior) => hunterLine(v, prior.length, prior.length ? prior[prior.length - 1] : null),
    ]),
);
