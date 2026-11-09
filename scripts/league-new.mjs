// toto.sg — scaffold a new strategy family. `npm run league:new <family>`.
//
//   node scripts/league-new.mjs lunar
//     → scripts/lib/lunar-rules.mjs      (defineFamily, two payout-clean starter rules)
//     → scripts/lib/families.mjs         (import line + BASE_FAMILIES entry inserted)
//
// The starters are honest league-shaped examples of the two commonest rule
// shapes — a masked, gated sample and a deterministic top-k — so the scaffold
// builds and trials out of the box:
//
//   npm run league:try lunarScore --folds 100
//
// Refuses to overwrite an existing module or registry entry.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LIB_DIR = new URL("./lib/", import.meta.url);
const FAMILIES_PATH = new URL("./lib/families.mjs", import.meta.url);

const pascal = (kebab) =>
    kebab
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("");

const titleCase = (kebab) =>
    kebab
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(" ");

const template = (kebab) => {
    const NAME = pascal(kebab);
    const TITLE = titleCase(kebab);
    return `// toto.sg — the ${kebab} family. Scaffolded by npm run league:new.
//
// Replace the two starter rules with the real family, then trial before you
// build:
//
//   npm run league:try ${kebab}Score --folds 100   # scorecard + attempt stats
//
// The league contract (AGENTS.md §5): every rule is
//   rule(prior, target, rng, prepared) → six unique numbers in 1..49, sorted,
//   or null to reject (and retry). Read only \`prior\` — never the target's
//   numbers — and draw randomness only from the injected \`rng\`. Mean
//   attempts per fold must stay well under 1000 (REJECT_CAP is 10000).
// No payout, prize-sharing or expected-value language anywhere — the league
// scores matched numbers only.
//
// Author guide with copy-paste snippets: scripts/lib/platform/README.md.
import { buildFoldStats } from "./cross-panel-stats.mjs";
import { defineFamily } from "./platform/family.mjs";
import { makeGate, maskRanked, sampleGated, topByScore } from "./platform/kit.mjs";

/** Rejection budget for the gated sample — widen the gate before raising this. */
const GATED_TRIES = 300;

export const ${NAME}_STRATEGIES = [
    [
        "${kebab}Score",
        "${TITLE} Score Sample",
        "Momentum",
        "Frequency-plus-velocity composite, sampled from the masked top-18 with the sum held in the 115–185 band.",
    ],
    [
        "${kebab}Due",
        "${TITLE} Due Top",
        "Gap & Due",
        "The six balls longest absent from the draw history — the deterministic due extreme.",
    ],
];

export const ${NAME}_RULES = {
    ${kebab}Score(prior, target, rng, stats) {
        const prev = stats.lastDraw;
        if (!prev) return null;
        // The catalog no-recycle mask: the previous draw's 6 mains + additional.
        const mask = new Set([...prev.numbers, ...(prev.additional != null ? [prev.additional] : [])]);
        const score = stats.freq.map((f, i) => f + 3 * stats.velocity[i]);
        const pool = maskRanked(mask, score, 18, stats.freq);
        return sampleGated(rng, pool, makeGate({ sum: [115, 185] }), { tries: GATED_TRIES });
    },

    ${kebab}Due(prior, target, rng, stats) {
        return topByScore(stats.skips, 6); // deterministic — the rng argument is unused
    },
};

export const ${NAME}_FAMILY = defineFamily({
    rules: ${NAME}_RULES,
    rows: ${NAME}_STRATEGIES,
    prepare: (prior, target) => buildFoldStats(prior, target),
});
`;
};

const main = async () => {
    const kebab = process.argv[2];
    if (!kebab || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(kebab)) {
        console.error("usage: npm run league:new <family>   (kebab-case, e.g. lunar)");
        process.exit(1);
    }
    const NAME = pascal(kebab);
    const modulePath = new URL(`${kebab}-rules.mjs`, LIB_DIR);
    const familiesFile = fileURLToPath(FAMILIES_PATH);

    if (existsSync(modulePath)) {
        console.error(`refusing to overwrite: scripts/lib/${kebab}-rules.mjs already exists`);
        process.exit(1);
    }
    const registry = await readFile(familiesFile, "utf8");
    if (registry.includes(`./${kebab}-rules.mjs`) || registry.includes(`${NAME}_FAMILY`)) {
        console.error(`refusing: scripts/lib/families.mjs already registers the ${kebab} family`);
        process.exit(1);
    }

    await writeFile(fileURLToPath(modulePath), template(kebab), "utf8");

    // Insert the import among the registry's imports, alphabetical by path.
    const importLine = `import { ${NAME}_FAMILY } from "./${kebab}-rules.mjs";`;
    const importRe = /^import .* from "\.\/[a-z0-9-]+\.mjs";$/gm;
    const imports = [...registry.matchAll(importRe)].map((m) => m[0]);
    const anchor = imports.find((line) => line > importLine) ?? null;
    let next = registry;
    if (anchor) {
        next = next.replace(anchor, `${importLine}\n${anchor}`);
    } else {
        // No import sorts after it: place directly after the last import.
        const last = imports[imports.length - 1];
        next = last ? next.replace(last, `${last}\n${importLine}`) : next;
    }
    // Insert the family into BASE_FAMILIES before the array's closing bracket.
    const arrStart = next.indexOf("export const BASE_FAMILIES = [");
    const arrEnd = next.indexOf("];", arrStart);
    if (arrStart === -1 || arrEnd === -1) {
        console.error("refusing: could not find BASE_FAMILIES in scripts/lib/families.mjs — insert manually");
        process.exit(1);
    }
    next = `${next.slice(0, arrEnd)}    ${NAME}_FAMILY,\n${next.slice(arrEnd)}`;
    await writeFile(familiesFile, next, "utf8");

    console.log(`created scripts/lib/${kebab}-rules.mjs and registered ${NAME}_FAMILY in scripts/lib/families.mjs

next steps:
  1. edit the starter rules into the real family (keep the league contract)
  2. npm run league:try ${kebab}Score --folds 100    # trial + attempt stats (read-only)
  3. npm run league && npm run verify:data           # rebuild and audit
  4. commit the module together with the regenerated public/data/ artifacts`);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
