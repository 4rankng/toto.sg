// toto.sg — data refresh orchestrator. `npm run refresh`. Zero deps, Node >= 18.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { computeAnalysis, filterEra } from "./lib/analysis.mjs";
import { BROWSER_UA, parseCsvDraws, parseDrawHtml, parseFragment, srUrl } from "./lib/toto.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));
const DRAW_PATH = `${DATA_DIR}draws.json`;
const ANALYSIS_PATH = `${DATA_DIR}analysis.json`;

const CSV_URL = "https://raw.githubusercontent.com/Aloysius-JW/Singapore-ToTo-analysis/main/Initial%20file%20-%20Toto%20Winning%20Numbers.csv";
const FRAGMENT_URL = "https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html";
const CSV_SEED_END = 3766; // last draw covered by the seed CSV (19/5/2022)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

const merge = (current, incoming) => {
    const byDraw = new Map(current.map((d) => [d.draw, d]));
    for (const d of incoming) byDraw.set(d.draw, d);
    return [...byDraw.values()].sort((a, b) => a.draw - b.draw);
};

async function main() {
    await mkdir(DATA_DIR, { recursive: true });

    let draws = [];
    try {
        draws = JSON.parse(await readFile(DRAW_PATH, "utf8"));
    } catch {
        /* first run */
    }
    const startCount = draws.length;

    // 1. Seed from the historical CSV when any draw <= CSV_SEED_END is missing.
    const missingSeed = (ds) => {
        const have = new Set(ds.map((d) => d.draw));
        for (let n = 2341; n <= CSV_SEED_END; n++) if (!have.has(n)) return n;
        return null;
    };
    if (missingSeed(draws) != null) {
        console.log("Seeding from historical CSV…");
        draws = merge(draws, parseCsvDraws(await fetchText(CSV_URL)));
        console.log(`  CSV seed: ${draws.length} draws after merge`);
    }

    // 2. Freshness first: the fragment bounds the backfill range.
    let fragmentDraws = [];
    try {
        fragmentDraws = parseFragment(await fetchText(FRAGMENT_URL));
        console.log(`Fragment: parsed ${fragmentDraws.length} draws (latest ${Math.max(...fragmentDraws.map((d) => d.draw))})`);
    } catch (err) {
        console.warn(`Fragment fetch/parse failed: ${err.message}`);
    }

    // 3. Backfill every missing draw from (lowest missing <= CSV_SEED_END, else its successor) to max(draws ∪ fragment) - 1.
    const present = new Set(draws.map((d) => d.draw));
    const maxKnown = Math.max(0, ...draws.map((d) => d.draw), ...fragmentDraws.map((d) => d.draw));
    const lowestMissingSeed = missingSeed(draws);
    const backfillStart = lowestMissingSeed != null ? lowestMissingSeed : CSV_SEED_END + 1;
    const missing = [];
    for (let n = backfillStart; n < maxKnown; n++) if (!present.has(n)) missing.push(n);
    console.log(`Backfill: ${missing.length} missing draws in [${backfillStart} … ${maxKnown - 1}]`);

    const failed = [];
    for (const n of missing) {
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
            try {
                if (attempt > 0) await sleep(3000);
                draws.push({ ...parseDrawHtml(await fetchText(srUrl(n)), n) });
                ok = true;
            } catch (err) {
                if (attempt === 1) {
                    failed.push(n);
                    console.warn(`  draw ${n}: FAILED twice (${err.message.split("\n")[0]})`);
                }
            }
        }
        if (n !== missing[missing.length - 1]) await sleep(1200);
    }
    draws = merge(draws, fragmentDraws); // fragment carries full prize tables; overwrites older entries
    draws.sort((a, b) => a.draw - b.draw);

    // 4. Write artifacts.
    await writeFile(DRAW_PATH, `${JSON.stringify(draws, null, 2)}\n`);
    const era = filterEra(draws);
    const analysis = computeAnalysis(era);
    await writeFile(ANALYSIS_PATH, `${JSON.stringify(analysis, null, 2)}\n`);
    // strategies.json is the committed strategy league. It is NOT regenerated
    // here: `npm run league` rebuilds it fully from this draws.json artifact.

    // 5. Summary.
    const noPrize = draws.filter((d) => !d.prizes).length;
    const noDate = draws.filter((d) => !d.date).length;
    console.log(
        `\nCoverage: ${draws.length} draws (${draws[0]?.draw} → ${draws.at(-1)?.draw}, ${draws[0]?.date} → ${draws.at(-1)?.date}); ` +
            `${startCount} pre-existing; ${noPrize} without prize data; ${noDate} without date; failed backfill: ${failed.length ? failed.join(",") : "none"}`,
    );
    console.log(`6/49 era for analysis: ${era.length} draws from ${era[0]?.draw} (${era[0]?.date})`);
    console.log("strategies.json left untouched (league artifact — run `npm run verify:data` to check it)");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
