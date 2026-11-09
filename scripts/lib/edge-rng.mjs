// toto.sg — edge-verification RNG + bit-mask primitives.
//
// Plain Node ESM, zero deps. Everything here is deterministic: randomness
// comes only from the seeded generators in this module, never Math.random().
//
//   mulberry32 — the league's own generator (re-exported from league-eval).
//   MT19937    — the classic 32-bit Mersenne Twister, for the Route 2
//                coverage study (RNG-family search, not evidence).
//   Philox4x32 — counter-based Random123-style 10-round Philox, same role.
//
// The 49-ball board is carried as a (lo,hi) 32-bit pair — JS bitwise ops
// are 32-bit, so a single `1 << n` silently corrupts every ball above 32.
import { mulberry32, fnv1a, rngFor } from "./league-eval.mjs";

export { mulberry32, fnv1a, rngFor };

// ---------------------------------------------------------------------------
// MT19937 — Mersenne Twister, 32-bit, standard tempering.
// ---------------------------------------------------------------------------
const MT_N = 624;
const MT_M = 397;
const MT_MATRIX_A = 0x9908b0df;
const MT_UPPER = 0x80000000;
const MT_LOWER = 0x7fffffff;

export function mt19937(seed) {
    const state = new Uint32Array(MT_N);
    let mt = state; // alias for the hot loop below
    let idx = MT_N;
    const init = (s) => {
        mt[0] = s >>> 0;
        for (let i = 1; i < MT_N; i++) {
            mt[i] = (1812433253 * (mt[i - 1] ^ (mt[i - 1] >>> 30)) + i) >>> 0;
        }
        idx = MT_N;
    };
    const twist = () => {
        for (let i = 0; i < MT_N - MT_M; i++) {
            const x = (mt[i] & MT_UPPER) | (mt[i + 1] & MT_LOWER);
            mt[i] = mt[i + MT_M] ^ (x >>> 1) ^ ((x & 1) * MT_MATRIX_A);
        }
        for (let i = MT_N - MT_M; i < MT_N - 1; i++) {
            const x = (mt[i] & MT_UPPER) | (mt[i + 1] & MT_LOWER);
            mt[i] = mt[i + (MT_M - MT_N)] ^ (x >>> 1) ^ ((x & 1) * MT_MATRIX_A);
        }
        const x = (mt[MT_N - 1] & MT_UPPER) | (mt[0] & MT_LOWER);
        mt[MT_N - 1] = mt[MT_M - 1] ^ (x >>> 1) ^ ((x & 1) * MT_MATRIX_A);
        idx = 0;
    };
    init(seed >>> 0);
    return function next() {
        if (idx >= MT_N) twist();
        let y = mt[idx++];
        y ^= y >>> 11;
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= y >>> 18;
        return y >>> 0;
    };
}

// ---------------------------------------------------------------------------
// Philox4x32-10 — counter-based (Random123-style). One call maps a 4×uint32
// counter + 2×uint32 key to 4 fresh uint32s, so parallel variant streams are
// independent by construction (counter = variant id).
// ---------------------------------------------------------------------------
/** 32×32 → (hi, lo) exact, via 16-bit limbs. */
function mulhilo32(a, b) {
    const al = a & 0xffff;
    const ah = a >>> 16;
    const bl = b & 0xffff;
    const bh = b >>> 16;
    const ll = Math.imul(al, bl);
    const lh = Math.imul(al, bh);
    const hl = Math.imul(ah, bl);
    const hh = Math.imul(ah, bh);
    const mid = (ll >>> 16) + (lh & 0xffff) + (hl & 0xffff);
    const lo = (((mid & 0xffff) << 16) | (ll & 0xffff)) >>> 0;
    const hi = (hh + (lh >>> 16) + (hl >>> 16) + (mid >>> 16)) >>> 0;
    return [hi, lo];
}

const PHILOX_M0 = 0xd2511f53;
const PHILOX_M1 = 0xcd9e8d57;
const PHILOX_W0 = 0x9e3779b9;
const PHILOX_W1 = 0xbb67ae85;

/** One Philox4x32 round: 4 state words, 2 key words → 4 new state words. */
function philoxRound(c0, c1, c2, c3, k0, k1) {
    const [p0hi, p0lo] = mulhilo32(PHILOX_M0, c0);
    const [p1hi, p1lo] = mulhilo32(PHILOX_M1, c2);
    return [p1hi ^ c1 ^ k0, p0lo, p0hi ^ c3 ^ k1, p1lo];
}

/** Full 10-round Philox4x32 — key bumped after every round (Random123 order). */
export function philox4x32(c0, c1, c2, c3, k0, k1) {
    let key0 = k0 >>> 0;
    let key1 = k1 >>> 0;
    let out = [c0, c1, c2, c3];
    for (let r = 0; r < 10; r++) {
        out = philoxRound(out[0], out[1], out[2], out[3], key0, key1);
        key0 = (key0 + PHILOX_W0) >>> 0;
        key1 = (key1 + PHILOX_W1) >>> 0;
    }
    return out;
}

/** Philox as a uniform-float generator: counter = (i, s0, s1, s2). */
export function philoxFloatStream(s0, s1, s2) {
    let i = 0;
    let buf = philox4x32(i++, s0 >>> 0, s1 >>> 0, s2 >>> 0, 0, 0);
    let j = 4;
    return function next() {
        while (j >= 4) {
            buf = philox4x32(i++, s0 >>> 0, s1 >>> 0, s2 >>> 0, 0, 0);
            j = 0;
        }
        return buf[j++] / 4294967296;
    };
}

/** The Route 2 RNG families, by name. All take a uint32 seed → float[0,1). */
export const RNG_FAMILIES = {
    mulberry32: (seed) => mulberry32(seed),
    mt19937: (seed) => {
        const next = mt19937(seed);
        return () => next() / 4294967296;
    },
    philox: (seed) => philoxFloatStream(seed, 0x6d2b79f5, 0x1a2b3c4d),
};

// ---------------------------------------------------------------------------
// Board masks — the pool (≤49 balls) as a (lo,hi) uint32 pair.
// ---------------------------------------------------------------------------
export const maskBit = (n) => (n <= 32 ? [1 << (n - 1), 0] : [0, 1 << (n - 33)]);

export function maskOf(nums) {
    let lo = 0;
    let hi = 0;
    for (const n of nums) {
        if (n <= 32) lo |= 1 << (n - 1);
        else hi |= 1 << (n - 33);
    }
    return [lo, hi];
}

// 16-bit popcount table, shared.
const POP16 = new Uint8Array(1 << 16);
for (let i = 1; i < POP16.length; i++) POP16[i] = POP16[i >> 1] + (i & 1);

export const popcount2 = (lo, hi) => POP16[lo & 0xffff] + POP16[lo >>> 16] + POP16[hi & 0xffff] + POP16[hi >>> 16];

/** popcount of the intersection of two (lo,hi) masks. */
export const matchCount2 = (aLo, aHi, bLo, bHi) =>
    POP16[(aLo & bLo) & 0xffff] + POP16[(aLo & bLo) >>> 16] + POP16[(aHi & bHi) & 0xffff] + POP16[(aHi & bHi) >>> 16];

/**
 * Quickpick: k distinct balls 1..pool via bitmask rejection sampling.
 * Returns the (lo,hi) mask; `nums` (optional array) receives the sorted balls.
 */
export function quickpickMask(rng, pool, k = 6) {
    let lo = 0;
    let hi = 0;
    let count = 0;
    while (count < k) {
        const r = (rng() * pool) | 0;
        if (r < 32) {
            const b = 1 << r;
            if (!(lo & b)) {
                lo |= b;
                count++;
            }
        } else {
            const b = 1 << (r - 32);
            if (!(hi & b)) {
                hi |= b;
                count++;
            }
        }
    }
    return [lo, hi];
}

/** Quickpick as a sorted ball array (allocation path, for the rule API). */
export function quickpickNums(rng, pool, k = 6) {
    const [lo, hi] = quickpickMask(rng, pool, k);
    const out = [];
    for (let n = 1; n <= pool; n++) {
        const bit = n <= 32 ? lo & (1 << (n - 1)) : hi & (1 << (n - 33));
        if (bit) out.push(n);
    }
    return out;
}

/**
 * Weighted sampling without replacement — the Gumbel top-k trick (each key is
 * log w_i + Gumbel_i; the top-k keys are a Plackett–Luce sample). Weights must
 * be positive; zeros are floored at 1e-12. Returns the k chosen ball numbers
 * (1-based), unsorted.
 */
export function gumbelTopK(weights, k, rng) {
    const keys = weights.map((w) => Math.log(Math.max(w, 1e-12)) - Math.log(-Math.log(Math.max(rng(), 1e-12))));
    const idx = weights.map((_, i) => i);
    idx.sort((a, b) => keys[b] - keys[a]);
    return idx.slice(0, k).map((i) => i + 1);
}
