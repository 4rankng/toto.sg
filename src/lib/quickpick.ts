// Unbiased k-of-49 Quick Pick for toto.sg (k = 6, 7 or 8)
// Stack: Web Crypto CSPRNG -> Lemire rejection (no modulo bias) -> Floyd F2.
// Every k-subset gets probability exactly 1 / C(49,k).
// Research: research/2026-11-07_quickpick_rng_research.md (deleg_1b9a8c3b)

const RAND32 = new Uint32Array(1);

// Uniform integer in [0, n) from crypto.getRandomValues (OS CSPRNG).
// Lemire multiply-shift with rejection (ACM TOMS 2019): m = x*n as exact
// 64-bit product; reject when (m mod 2^32) < (2^32 mod n); return m >> 32.
// For n = 49 the rejection probability is 39/2^32 = 9.1e-9.
export function randBelow(n: number): number {
    const t = Number(4294967296n % BigInt(n));
    for (;;) {
        crypto.getRandomValues(RAND32);
        const m = BigInt(RAND32[0]) * BigInt(n);
        if ((m & 0xffffffffn) >= t) return Number(m >> 32n);
    }
}

// Floyd's F2 (Bentley & Floyd, CACM 30(9), 1987): exactly one randBelow call
// per selected number, provably uniform over every k-subset. k is 6 for a
// standard line, 7 or 8 for a System 7 / System 8 entry.
export function quickPick(count = 6): number[] {
    const k = Math.min(Math.max(Math.trunc(count), 1), 49);
    const S = new Set<number>();
    for (let j = 49 - k; j < 49; j++) {
        const t = randBelow(j + 1);
        S.add(S.has(t) ? j : t);
    }
    return [...S].map((x) => x + 1).sort((a, b) => a - b);
}

// Optional honest EV tweak: redraw on famously popular tuples (raises the
// conditional prize share when a win happens; win probability unchanged).
const POPULAR: string[] = ["1,2,3,4,5,6", "5,10,15,20,25,30", "1,3,5,7,9,11", "2,4,6,8,10,12"];
export function quickPickUnpopular(count = 6): number[] {
    for (;;) {
        const line = quickPick(count);
        if (!POPULAR.includes(line.join(","))) return line;
    }
}
