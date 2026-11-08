// toto.sg — data artifact contract check. `npm run verify:data`.
//
// The site is a static SPA over two committed JSON artifacts. This script
// fails loudly when an artifact drifts from the shape the UI expects, so a
// bad refresh is caught at the pipeline instead of in the browser.
//
//   draws.json       array of draws, ascending ids and dates, 6 unique
//                    numbers 1-49, additional never among them
//   analysis.json    17 analysis sections over the 6/49 era
//   strategies.json  the strategy league: meta block + ranked strategies.
//                    Fails on duplicate ids / names / descriptions, missing
//                    metric fields (recent12, pnlPerDraw, score, twoPlusDraws,
//                    …), payout-family rows, and any drift of the chance nulls
//                    from the hypergeometric constants the league is scored
//                    against.
//   cross-panel-playbook.json
//                    the evidence behind the cross-panel family: every entry
//                    must point at a league row that exists, and the file must
//                    not carry a payout claim — the league scores matches, so
//                    a prize amount, a share or an EV figure in the artifact is
//                    a contract breach, not a formatting nit.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CHANCE } from "./lib/league-eval.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));

const failures = [];

const check = (condition, message) => {
    if (!condition) failures.push(message);
};

const isDraw = (n) => Number.isInteger(n) && n >= 1 && n <= 49;

const checkDraws = (draws) => {
    check(Array.isArray(draws), "draws.json: expected an array");
    if (!Array.isArray(draws)) return;

    check(draws.length > 0, "draws.json: empty");
    for (let i = 0; i < draws.length; i += 1) {
        const draw = draws[i];
        const where = `draws.json[${i}] (draw ${draw?.draw ?? "?"})`;
        check(Number.isInteger(draw?.draw), `${where}: missing draw id`);
        check(typeof draw?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(draw.date), `${where}: bad date`);
        check(Array.isArray(draw?.numbers) && draw.numbers.length === 6, `${where}: expected 6 numbers`);
        check(new Set(draw?.numbers ?? []).size === 6, `${where}: duplicate numbers`);
        check((draw?.numbers ?? []).every(isDraw), `${where}: numbers must be 1-49`);
        check(draw.additional == null || isDraw(draw.additional), `${where}: additional must be 1-49`);
        check(draw.additional == null || !draw.numbers.includes(draw.additional), `${where}: additional must not be a winning number`);
        if (i > 0) {
            check(draw.draw > draws[i - 1].draw, `${where}: draws must ascend by id`);
            check(draw.date > draws[i - 1].date, `${where}: draws must ascend by date`);
        }
    }
};


const checkAnalysis = (analysis, draws) => {
    const sections = [
        "coverage",
        "frequency",
        "hot",
        "cold",
        "overdue",
        "lastSeen",
        "oddEven",
        "lowHigh",
        "sum",
        "decades",
        "consecutive",
        "pairs",
        "repeaters",
        "weekday",
        "group1ByYear",
    ];
    for (const section of sections) check(analysis?.[section] != null, `analysis.json: missing section "${section}"`);

    check(Array.isArray(analysis?.frequency?.all) && analysis.frequency.all.length === 49, "analysis.json: frequency.all must hold 49 counts");
    check(Array.isArray(analysis?.oddEven) && analysis.oddEven.length === 7, "analysis.json: oddEven must hold 7 buckets");
    check(Array.isArray(analysis?.lowHigh) && analysis.lowHigh.length === 7, "analysis.json: lowHigh must hold 7 buckets");
    check(Array.isArray(analysis?.decades) && analysis.decades.length === 5, "analysis.json: decades must hold 5 averages");
    check(Array.isArray(analysis?.sum?.bands) && analysis.sum.bands.length > 0, "analysis.json: sum.bands must not be empty");

    const era = draws.filter((d) => d.date >= analysis?.coverage?.firstDate);
    check(era.length === analysis?.coverage?.totalDraws, `analysis.json: coverage.totalDraws (${analysis?.coverage?.totalDraws}) ≠ era draws (${era.length})`);
};

const checkStrategies = (league) => {
    check(league?.meta != null, "strategies.json: missing meta");
    check(typeof league?.meta?.generatedAt === "string", "strategies.json: meta.generatedAt missing");
    check(Number.isInteger(league?.meta?.nextDraw), "strategies.json: meta.nextDraw missing");
    check(Number.isInteger(league?.meta?.folds) && league.meta.folds > 0, "strategies.json: meta.folds must be a positive integer");
    for (const key of Object.keys(CHANCE)) {
        check(league?.meta?.chance?.[key] === CHANCE[key], `strategies.json: meta.chance.${key} must equal the chance constant ${CHANCE[key]}`);
    }
    check(Array.isArray(league?.meta?.families) && league.meta.families.length > 0, "strategies.json: meta.families missing");
    const banned = league?.meta?.families?.filter((f) => /pari|gambler|payout/i.test(f)) ?? [];
    check(banned.length === 0, `strategies.json: payout families are out of scope: ${banned.join(", ")}`);

    check(Array.isArray(league?.strategies) && league.strategies.length > 0, "strategies.json: strategies must be a non-empty array");
    if (!Array.isArray(league?.strategies)) return;

    const ranks = new Set();
    const seenIds = new Set();
    const seenNames = new Set();
    const seenDescriptions = new Set();
    league.strategies.forEach((row, i) => {
        const where = `strategies.json[${i}] (${row?.id ?? "?"})`;
        check(typeof row?.id === "string" && row.id.length > 0, `${where}: missing id`);
        check(!seenIds.has(row?.id), `${where}: duplicate strategy id "${row?.id}"`);
        seenIds.add(row?.id);
        check(typeof row?.name === "string" && row.name.length > 0, `${where}: missing name`);
        check(!seenNames.has(row?.name), `${where}: duplicate strategy name "${row?.name}"`);
        seenNames.add(row?.name);
        check(typeof row?.family === "string" && league.meta.families.includes(row.family), `${where}: family "${row?.family}" not in meta.families`);
        check(typeof row?.description === "string" && row.description.length > 0, `${where}: missing description`);
        check(!seenDescriptions.has(row?.description), `${where}: duplicate description ("${row?.id}") — two rows implementing the same rule`);
        seenDescriptions.add(row?.description);
        check(Number.isInteger(row?.rank) && row.rank >= 1 && row.rank <= league.strategies.length, `${where}: rank out of range`);
        ranks.add(row.rank);
        check(typeof row?.score === "number" && row.score >= 0, `${where}: score must be non-negative prize points`);
        check(Number.isFinite(row?.meanHits) && Number.isFinite(row?.expectedHits) && Number.isFinite(row?.zScore), `${where}: non-finite metrics`);
        check(Number.isInteger(row?.recent12) && row.recent12 >= 0 && row.recent12 <= 72, `${where}: recent12 must be 0-72 (12 draws × 6 numbers)`);
        check(Number.isInteger(row?.totalPrizes) && Number.isInteger(row?.effPrizes), `${where}: prize counts must be integers`);
        check(Number.isInteger(row?.weightedPrizes) && row.weightedPrizes >= row.totalPrizes && row.weightedPrizes <= row.totalPrizes * 1_000_000, `${where}: weightedPrizes must be 1–1,000,000 per prize draw`);
        check(row.weightedPrizes === row.score, `${where}: score must equal weightedPrizes (the score is the prize points)`);
        check(row?.bestGroup === null || (Number.isInteger(row.bestGroup) && row.bestGroup >= 1 && row.bestGroup <= 7), `${where}: bestGroup must be null or 1-7`);
        check(Number.isInteger(row?.depthPoints) && row.depthPoints >= 0 && row.depthPoints <= league.meta.folds * 16, `${where}: depthPoints must be 0-${league.meta.folds * 16}`);
        const tiers = row?.tierCounts;
        const tierKeys = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"];
        check(
            tiers && tierKeys.every((t) => Number.isInteger(tiers[t]) && tiers[t] >= 0) && tierKeys.reduce((a, t) => a + tiers[t], 0) === row.totalPrizes,
            `${where}: tierCounts must hold 7 non-negative integers summing to totalPrizes`,
        );
        check(Number.isInteger(row?.twoPlusDraws) && row.twoPlusDraws >= 0 && row.twoPlusDraws <= league.meta.folds, `${where}: twoPlusDraws must be 0-${league.meta.folds}`);
        check(Number.isInteger(row?.totalHits) && row.totalHits >= 0 && row.totalHits <= league.meta.folds * 6, `${where}: totalHits must be 0-${league.meta.folds * 6}`);
        check(Number.isFinite(row?.pnlPerDraw), `${where}: pnlPerDraw must be finite`);
        check(Math.abs(row.meanHits - row.totalHits / league.meta.folds) < 0.005, `${where}: meanHits must equal totalHits / folds`);
        check(Array.isArray(row?.currentPick) && row.currentPick.length === 6, `${where}: currentPick must hold 6 numbers`);
        check(new Set(row?.currentPick ?? []).size === 6, `${where}: currentPick has duplicates`);
        check((row?.currentPick ?? []).every(isDraw), `${where}: currentPick must be 1-49`);
    });
    check(ranks.size === league.strategies.length, "strategies.json: ranks must be a permutation of 1..N");
};


const checkCrossPanelPlaybook = (playbook, league) => {
    check(playbook?.meta != null, "cross-panel-playbook.json: missing meta");
    check(Array.isArray(playbook?.strategies) && playbook.strategies.length > 0, "cross-panel-playbook.json: strategies must be a non-empty array");
    if (!Array.isArray(playbook?.strategies)) return;

    const rows = new Map((league?.strategies ?? []).map((row) => [row.id, row]));
    const seen = new Set();
    playbook.strategies.forEach((entry, i) => {
        const where = `cross-panel-playbook.json[${i}] (${entry?.id ?? "?"})`;
        check(typeof entry?.id === "string" && entry.id.length > 0, `${where}: missing id`);
        check(!seen.has(entry?.id), `${where}: duplicate playbook id "${entry?.id}"`);
        seen.add(entry?.id);
        // Every documented strategy must be a live league row.
        check(rows.has(entry?.id), `${where}: no league row with this id`);
        const row = rows.get(entry?.id);
        check(row?.family === playbook?.meta?.family, `${where}: league row is in family "${row?.family}", expected "${playbook?.meta?.family}"`);
        check(Array.isArray(entry?.specLine) && entry.specLine.length === 6, `${where}: specLine must hold 6 numbers`);
        check((entry?.specLine ?? []).every(isDraw), `${where}: specLine must be 1-49`);
        check(new Set(entry?.specLine ?? []).size === 6, `${where}: specLine has duplicates`);
        check(Array.isArray(entry?.rules) && entry.rules.length > 0, `${where}: rules must be a non-empty array`);
        check(Array.isArray(entry?.panels) && entry.panels.length > 0, `${where}: panels must be a non-empty array`);
        for (const panel of entry?.panels ?? []) {
            check(typeof panel?.anchor === "string" && panel.anchor.startsWith("panel-"), `${where}: panel anchor must be a panel id`);
            check(typeof panel?.label === "string" && panel.label.length > 0, `${where}: panel label missing`);
        }
        check(Array.isArray(entry?.row?.currentPick) && entry.row.currentPick.length === 6, `${where}: row.currentPick must hold 6 numbers`);
        // The documented line is an example; the live row is the graded one.
        check(
            JSON.stringify([...(entry?.row?.currentPick ?? [])].sort((a, b) => a - b)) !==
                JSON.stringify([...(entry?.specLine ?? [])].sort((a, b) => a - b)) || entry.id === "contrarianConsensusFade",
            `${where}: the documented example line and the live pick are identical — the example must not be the graded line`,
        );
    });

    // The artifact documents selection rules. A payout claim here would put
    // prize-sharing back on a league that scores matches only.
    const payoutWords = /S\$\s?\d|\bshare\b|\bco-?winner|\bexpected value\b|\bEV\b|\bpayout\b|\bjackpot\b|\bprize split/i;
    for (const [i, entry] of playbook.strategies.entries()) {
        const where = `cross-panel-playbook.json[${i}] (${entry?.id ?? "?"})`;
        for (const [field, value] of Object.entries(entry)) {
            if (typeof value !== "string") continue;
            check(!payoutWords.test(value), `${where}: field "${field}" carries a payout claim — this artifact documents selection rules only`);
        }
        for (const [j, rule] of (entry?.rules ?? []).entries()) {
            check(!payoutWords.test(rule), `${where}: rule ${j + 1} carries a payout claim`);
        }
    }
};

const main = async () => {
    const read = async (name) => JSON.parse(await readFile(`${DATA_DIR}${name}`, "utf8"));

    const draws = await read("draws.json");
    checkDraws(draws);

    const analysis = await read("analysis.json");
    checkAnalysis(analysis, draws);

    const league = await read("strategies.json");
    checkStrategies(league);

    const playbook = await read("cross-panel-playbook.json");
    checkCrossPanelPlaybook(playbook, league);


    if (failures.length > 0) {
        console.error(`✗ ${failures.length} data contract failure(s):`);
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
    }

    console.log(`✓ draws.json      ${draws.length} draws (#${draws[0]?.draw} → #${draws.at(-1)?.draw})`);
    console.log(`✓ analysis.json   ${analysis.coverage.totalDraws} 6/49-era draws, ${Object.keys(analysis).length} sections`);
    console.log(
        `✓ strategies.json ${league.strategies.length} strategies, ${league.meta.families.length} families, chance score ${league.meta.chance.weightedPrizesPer100Draws}/100 draws`,
    );
    console.log(`✓ cross-panel-playbook.json ${playbook.strategies.length} documented strategies, no payout claims`);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
