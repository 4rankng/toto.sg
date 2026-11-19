// toto.sg — StreamPick family: fixed-slot lines from a deterministic PCG64
// random stream, numpy-exact. Registered MEGA-search champions live here so
// the canonical JS pipeline generates their fold lines itself — no python
// merge step, no frozen picks.
//
// Mechanism (mirrors the python engine's _mega34b_line and siblings exactly):
//   rng = numpy default_rng(424242 + W*1000003)   [state seeded once]
//   per fold with era index t (draw number - 2995):
//     rng.bit_generator.advance((t - 50) * STRIDE + SLOT * 49)
//     u = rng.random(49)                           // 49 consecutive doubles
//     line = the six balls with the largest u, sorted
// numpy's PCG64 (XSL-RR 128/64) is reproduced below with BigInt 128-bit
// arithmetic. Byte-validated against numpy by scripts/streampick-validate.mjs
// (240 random stream positions, exact match required).

const MASK = (1n << 128n) - 1n;
const MUL = 0x2360ed051fc65da44385df649fccf645n;

const rotr64 = (x, r) => ((x >> BigInt(r)) | (x << BigInt(64 - r))) & 0xffffffffffffffffn;
const mod128 = (x) => x & MASK;

/** numpy PCG64 XSL-RR output for an already-stepped state. */
const output = (state) => {
    const hi = state >> 64n;
    const lo = state & 0xffffffffffffffffn;
    return rotr64(hi ^ lo, Number((state >> 122n) & 63n));
};

/** Exact LCG jump-ahead: state after n steps (numpy pcg64 advance). */
const advanceState = (state, inc, n) => {
    let curMult = MUL;
    let curPlus = inc;
    let accMult = 1n;
    let accPlus = 0n;
    let k = n;
    while (k > 0n) {
        if (k & 1n) {
            accMult = mod128(accMult * curMult);
            accPlus = mod128(accPlus * curMult + curPlus);
        }
        curPlus = mod128((curMult + 1n) * curPlus);
        curMult = mod128(curMult * curMult);
        k >>= 1n;
    }
    return mod128(accMult * state + accPlus);
};

/**
 * Six balls from 49 doubles. The MEGA-32/33/34 champions sampled gumbels
 * (numpy gumbel = -log(-log(1-u)), DECREASING in u), so their six gumbel
 * maxima are the six SMALLEST uniforms. Streams registered from
 * rng.random()-based scans (MEGA-36 onward) take the six largest.
 */
const pick6 = (u, largest) => {
    const idx = [...Array(49).keys()];
    idx.sort((a, b) => (largest ? u[b] - u[a] : u[a] - u[b]));
    return idx.slice(0, 6).sort((a, b) => a - b).map((x) => x + 1);
};

/** Absolute-position line: fresh stream from the seed state, one jump. */
export const streamLine = (state0, inc, slot, stride, t, largest = false) => {
    const state = advanceState(state0, inc, BigInt((t - 50) * stride + slot * 49));
    const u = new Array(49);
    let s = state;
    for (let j = 0; j < 49; j += 1) {
        s = mod128(s * MUL + inc);
        u[j] = Number(output(s) >> 11n) * (1 / 9007199254740992);
    }
    return pick6(u, largest);
};

// numpy default_rng(424242 + W*1000003) initial states (extracted from numpy).
const STATES = {
    mega_w2: { state: 82820688505574697695474246552906012893n, inc: 113902292224768455653071620519066879647n },
    mega_w3: { state: 121374928524957014780080823958709212189n, inc: 51136865500434423896892558805633777843n },
    mega_w4: { state: 194685380810890170331625692295296274947n, inc: 254232255206055042922283271949073612153n },
    mega_w5: { state: 269302603639346370048895616226815513539n, inc: 231386501703529214630510043932958768423n },
    mega_w9: { state: 203406063850978418364239451503387824460n, inc: 40456897739721364067122742433154127321n },
};

// Registered champions: [id, stateKey, slot, stride, description]
const CHAMPIONS = [
    ["StreamPick Prime", "mega_w3", 8598530, 490000000,
        "MEGA-32 search exhibit: reads its six balls from slot 8598530 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Apex", "mega_w4", 9500288, 490000000,
        "MEGA-32 search exhibit: slot 9500288 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Regalia", "mega_w2", 3449359, 490000000,
        "MEGA-32 search exhibit: slot 3449359 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Scepter", "mega_w9", 4594472, 490000000,
        "MEGA-32 search exhibit: slot 4594472 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Laurel", "mega_w5", 398747, 490000000,
        "MEGA-32 search exhibit: slot 398747 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Tribute", "mega_w2", 6268924, 490000000,
        "MEGA-32 search exhibit: slot 6268924 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Nova", "mega_w5", 1207358, 1470000000,
        "MEGA-33 search exhibit: slot 1207358 of a fixed PCG64 random stream — one line per draw, no history input."],
    ["StreamPick Zenith", "mega_w9", 40754318, 2450000000,
        "MEGA-34b search champion (deepest scan): slot 40754318 of a fixed PCG64 random stream — one line per draw, no history input. In-sample record."],
];

const rules = {};
const rows = [];
for (const [id, key, slot, stride, desc] of CHAMPIONS) {
    const st = STATES[key];
    // gumbel-era champions: six smallest uniforms (see pick6).
    rules[id] = (prior, target) =>
        streamLine(st.state, st.inc, slot, stride, target.draw - 2995, false);
    rows.push([id, id.replace("StreamPick ", "Stream Slot "), "StreamPick", desc]);
}

export const STREAMPICK_FAMILY = { rules, rows };
