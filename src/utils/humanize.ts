// toto.sg — internal enum values never reach the reader raw.
//
// The analytics layer speaks in snake_case because the values are identifiers
// in the data files, not prose. This maps them to the words the site shows.

/** The enums that reach the UI, spelled out. */
const LABELS: Record<string, string> = {
    // Skip quantiles
    sweet_zone: "Sweet zone",
    underdue: "Underdue",
    dormant: "Dormant",

    // Oscillator regimes
    overbought: "Overbought",
    oversold: "Oversold",
    inside: "Inside band",
    neutral: "Neutral",

    // Fano dispersion
    sub_poisson: "Sub-Poisson",
    poisson: "Poisson",
    super_poisson: "Super-Poisson",

    // Hurst regime
    persistent_trending: "Persistent trending",
    anti_persistent_mean_reverting: "Anti-persistent (mean-reverting)",
    pure_random_walk: "Pure random walk",

    // Inequality
    perfectly_uniform: "Perfectly uniform",
    slight_variance: "Slight variance",
    heavy_clustering: "Heavy clustering",

    // Hot hand
    balanced_null: "Balanced vs null",
    slight_momentum: "Slight momentum",
    slight_reversion: "Slight reversion",

    // Mean reversion
    strong_reversion: "Strong reversion",
    moderate: "Moderate",
    none: "None",
};

/**
 * "sweet_zone" → "Sweet zone", "sub_poisson" → "Sub-Poisson".
 *
 * Unknown values fall back to a title-cased form so a new enum still reads
 * as prose rather than leaking a raw identifier.
 */
export const humanizeStatus = (value: string): string => {
    const known = LABELS[value];
    if (known) return known;
    const words = value.replace(/_/g, " ").trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
