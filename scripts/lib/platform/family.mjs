// toto.sg — the family manifest contract.
//
// Every strategy family module ends with `export const X_FAMILY =
// defineFamily({ rules, rows, prepare, phase, votes })`. defineFamily is the
// ONE place that validates a family manifest at import time, so a rule/row
// mismatch, a duplicate id/name/description or a payout-word leak fails the
// build immediately with the offending module in the message — before a
// single fold is evaluated.
//
// The rule contract (league-eval.mjs calls every rule the same way):
//   rule(prior, target, rng, prepared) → six unique numbers in 1..49,
//   sorted, or null to reject. Rules may only read `prior` (the draws
// strictly before the fold) and draw randomness only from `rng`.
export const PAYOUT_WORD_RE = /S\$\s?\d|\bshare\b|\bco-?winner|\bexpected value\b|\bEV\b|\bpayout\b|\bjackpot\b|\bprize split/i;

/** The importing family module's path, for error messages. Best effort. */
const callerModule = () => {
    const frames = (new Error().stack ?? "").split("\n");
    for (const frame of frames.slice(1)) {
        const hit = frame.match(/(?:file:\/\/)?(\/[^\s():]+\.mjs):\d+:\d+/);
        if (hit && !hit[1].endsWith("/platform/family.mjs")) return hit[1];
    }
    return "<unknown family module>";
};

const fail = (detail) => {
    throw new Error(`defineFamily [${callerModule()}]: ${detail}`);
};

/**
 * Declare one strategy family.
 *
 *   rules   { [id]: (prior, target, rng, prepared) => line | null } — the one
 *           rule contract; narrower signatures ignore the extra arguments.
 *   rows    [id, name, family, description][] — the league table rows, in
 *           family-internal order.
 *   prepare optional (prior, target, env) => prepared — the fold context
 *           handed to every rule as its fourth argument (memoise it with
 *           memoisedPrepare when it is expensive).
 *   phase   1 | 2. Phase 2 rules read the base league's fold votes and run
 *           after every base family has produced its line; they cache under
 *           the base-set fingerprint (league-build.mjs).
 *   votes   required when phase is 2: "crossPanel" | "fusion" (the known
 *           vote-context kinds league-build assembles) or a custom
 *           (prior, target, votes, env) => prepared.
 */
export function defineFamily({ rules, rows, prepare, phase = 1, votes = null } = {}) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) fail("rules must be an object keyed by id");
    if (!Array.isArray(rows) || rows.length === 0) fail("rows must be a non-empty array of [id, name, family, description]");
    if (prepare !== undefined && prepare !== null && typeof prepare !== "function") fail("prepare must be a function");
    if (phase !== 1 && phase !== 2) fail(`phase must be 1 or 2, got ${phase}`);
    if (phase === 2 && votes == null) fail("phase 2 requires votes: \"crossPanel\" | \"fusion\" or a custom (prior, target, votes, env) => prepared");

    for (const [id, rule] of Object.entries(rules)) {
        if (typeof rule !== "function") fail(`rule "${id}" is a ${typeof rule}, not a function`);
    }

    const seenIds = new Set();
    const seenNames = new Set();
    const seenDescriptions = new Set();
    const rowIds = new Set();
    for (const row of rows) {
        if (!Array.isArray(row) || row.length !== 4) fail(`row must be [id, name, family, description], got ${JSON.stringify(row)}`);
        const [id, name, family, description] = row;
        if (typeof id !== "string" || id === "") fail(`row id must be a non-empty string, got ${JSON.stringify(id)}`);
        for (const field of [name, family, description]) {
            if (typeof field !== "string" || field.trim() === "") fail(`row "${id}" has an empty ${field === name ? "name" : field === family ? "family" : "description"}`);
        }
        if (seenIds.has(id)) fail(`duplicate id within family: "${id}"`);
        seenIds.add(id);
        if (seenNames.has(name)) fail(`duplicate name within family: "${name}" (${id})`);
        seenNames.add(name);
        if (seenDescriptions.has(description)) fail(`duplicate description within family: "${description.slice(0, 60)}…" (${id})`);
        seenDescriptions.add(description);
        if (PAYOUT_WORD_RE.test(name)) fail(`payout word in name of "${id}": "${name}"`);
        if (PAYOUT_WORD_RE.test(description)) fail(`payout word in description of "${id}": "${description}"`);
        if (!(id in rules)) fail(`row without a rule: "${id}"`);
        rowIds.add(id);
    }
    for (const id of Object.keys(rules)) {
        if (!rowIds.has(id)) fail(`rule without a row: "${id}"`);
    }

    return { rules, rows, prepare, phase, votes, ids: rows.map(([id]) => id) };
}
