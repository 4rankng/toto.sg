// toto.sg — data artifact contract check. `npm run verify:data`.
//
// The site is a static SPA over three committed JSON artifacts. This script
// fails loudly when an artifact drifts from the shape the UI expects, so a
// bad refresh is caught at the pipeline instead of in the browser.
//
//   draws.json       array of draws, ascending ids, 6 unique numbers 1-49
//   analysis.json    17 analysis sections over the 6/49 era
//   strategies.json  the strategy league: meta block + ranked strategies
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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
        if (i > 0) check(draw.draw > draws[i - 1].draw, `${where}: draws must ascend by id`);
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
    check(typeof league?.meta?.chance?.expectedHitsPerLine === "number", "strategies.json: meta.chance.expectedHitsPerLine missing");
    check(typeof league?.meta?.chance?.scoreBaseline === "number", "strategies.json: meta.chance.scoreBaseline missing");
    check(Array.isArray(league?.meta?.families) && league.meta.families.length > 0, "strategies.json: meta.families missing");

    check(Array.isArray(league?.strategies) && league.strategies.length > 0, "strategies.json: strategies must be a non-empty array");
    if (!Array.isArray(league?.strategies)) return;

    const ranks = new Set();
    league.strategies.forEach((row, i) => {
        const where = `strategies.json[${i}] (${row?.id ?? "?"})`;
        check(typeof row?.id === "string" && row.id.length > 0, `${where}: missing id`);
        check(typeof row?.name === "string" && row.name.length > 0, `${where}: missing name`);
        check(typeof row?.family === "string" && league.meta.families.includes(row.family), `${where}: family "${row?.family}" not in meta.families`);
        check(typeof row?.description === "string" && row.description.length > 0, `${where}: missing description`);
        check(Number.isInteger(row?.rank) && row.rank >= 1 && row.rank <= league.strategies.length, `${where}: rank out of range`);
        ranks.add(row.rank);
        check(typeof row?.score === "number" && row.score >= 0 && row.score <= 100, `${where}: score must be 0-100`);
        check(Number.isFinite(row?.meanHits) && Number.isFinite(row?.expectedHits) && Number.isFinite(row?.zScore), `${where}: non-finite metrics`);
        check(Number.isInteger(row?.recent12) && row.recent12 >= 0 && row.recent12 <= 72, `${where}: recent12 must be 0-72 (12 draws × 6 numbers)`);
        check(Number.isInteger(row?.totalPrizes) && Number.isInteger(row?.effPrizes), `${where}: prize counts must be integers`);
        check(Number.isFinite(row?.pnlPerDraw), `${where}: pnlPerDraw must be finite`);
        check(Array.isArray(row?.currentPick) && row.currentPick.length === 6, `${where}: currentPick must hold 6 numbers`);
        check(new Set(row?.currentPick ?? []).size === 6, `${where}: currentPick has duplicates`);
        check((row?.currentPick ?? []).every(isDraw), `${where}: currentPick must be 1-49`);
    });
    check(ranks.size === league.strategies.length, "strategies.json: ranks must be a permutation of 1..N");
};

const main = async () => {
    const read = async (name) => JSON.parse(await readFile(`${DATA_DIR}${name}`, "utf8"));

    const draws = await read("draws.json");
    checkDraws(draws);

    const analysis = await read("analysis.json");
    checkAnalysis(analysis, draws);

    const league = await read("strategies.json");
    checkStrategies(league);

    if (failures.length > 0) {
        console.error(`✗ ${failures.length} data contract failure(s):`);
        for (const failure of failures) console.error(`  - ${failure}`);
        process.exit(1);
    }

    console.log(`✓ draws.json      ${draws.length} draws (#${draws[0]?.draw} → #${draws.at(-1)?.draw})`);
    console.log(`✓ analysis.json   ${analysis.coverage.totalDraws} 6/49-era draws, ${Object.keys(analysis).length} sections`);
    console.log(
        `✓ strategies.json ${league.strategies.length} strategies, ${league.meta.families.length} families, baseline ${league.meta.chance.scoreBaseline}`,
    );
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
