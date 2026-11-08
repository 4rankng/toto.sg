/**
 * Shared verdict math for the insights panels. Pure and deterministic — typed
 * arrays and `Math` only, safe for both the browser bundle and the Vite SSR
 * bundle behind `scripts/export-graph.ts`.
 */

/** Z-score of an observed count against a binomial-style expected count. */
export const zOf = (observed: number, expected: number): number =>
    (observed - expected) / Math.sqrt(Math.max(expected, 1));

/** ≥2σ above expectation is a signal, ≤−2σ is a watch, anything between is chance-consistent. */
export const toneForZ = (z: number): "signal" | "null" | "watch" =>
    z >= 2 ? "signal" : z <= -2 ? "watch" : "null";

/** Outside the band [lo, hi] is a watch, inside is chance-consistent. */
export const bandTone = (value: number, lo: number, hi: number): "signal" | "null" | "watch" =>
    value < lo || value > hi ? "watch" : "null";

/** Signed sigma with a proper minus sign, e.g. `+2.3σ` / `−1.4σ`. */
export const fmtZ = (z: number): string => `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(1)}σ`;
