// toto.sg — rebuild the ENTIRE strategy league from the real draw archive.
// `npm run league`. The league contract:
//
//   REAL DATA ONLY   every score is computed from public/data/draws.json,
//                    the verified Singapore Pools archive.
//   NO LOOKAHEAD     every line is regenerated per fold from strictly earlier
//                    draws; no fixed line is ever applied to a whole window.
//   EXPANDING WINDOW every 6/49-era draw after a 50-draw warm-up is a fold;
//                    the window grows with every new draw — never a trailing
//                    slice — so each strategy is graded over the full era.
//   REPRODUCIBLE     randomness only via rngFor(id, drawNo); reruns are
//                    byte-identical apart from meta.generatedAt.
//   MATCH COUNT ONLY no payout / prize-sharing strategies: rows exist to
//                    match numbers, not to dodge co-winners.
//
// The output is a full rewrite of public/data/strategies.json — nothing is
// carried over from previous artifacts, so no unverifiable row can survive.
//
// EVALUATION CACHE — data/league-cache.json (committed artifact, not served).
// A fold's result depends only on the draws strictly before it, so a cached
// (strategy, draw) entry stays valid while that history prefix is unchanged.
// Every draw gets a rolling SHA-256 prefix hash; an entry is reused only when
// its recorded prefix hash matches. A new draw appends one fold and recomputes
// nothing else; an edit anywhere in the archive invalidates exactly the folds
// whose prefix changed. The current pick is cached against the hash of the
// whole archive.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CHANCE, evaluateStrategy, WARMUP_DRAWS } from "./lib/league-eval.mjs";
import { filterEra, nextDrawDateIso } from "./lib/analysis.mjs";
import { buildFoldStats } from "./lib/gambler-stats.mjs";
import { CURATED_RULES, CURATED_STRATEGIES } from "./lib/curated-rules.mjs";
import { GENERATOR_RULES, GENERATOR_STRATEGIES } from "./lib/generator-rules.mjs";
import { buildDeskContext, DESK_RULES, DESK_STRATEGIES } from "./lib/desk-rules.mjs";
import { buildMatchrateContext, freezeBandRates, MATCHRATE_RULES, MATCHRATE_STRATEGIES } from "./lib/matchrate-rules.mjs";
import { buildIndicatorFoldStats, INDICATOR_RULES, INDICATOR_STRATEGIES } from "./lib/indicator-rules.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));
const CACHE_PATH = fileURLToPath(new URL("../data/league-cache.json", import.meta.url));
const CACHE_VERSION = 1;

/** Stable serialization of one draw — the unit the rolling prefix hash covers. */
const drawBytes = (draw) =>
    JSON.stringify([draw.draw, draw.date, draw.numbers, draw.additional ?? null, draw.prizes ?? null]);

const main = async () => {
    const draws = JSON.parse(await readFile(`${DATA_DIR}draws.json`, "utf8"));
    const era = filterEra(draws);
    if (era.length < WARMUP_DRAWS + 12) throw new Error(`era too short after warm-up: ${era.length}`);
    const foldStart = WARMUP_DRAWS;
    const foldEnd = era.length;
    const nextDrawNo = era[era.length - 1].draw + 1;
    const nextTarget = { draw: nextDrawNo, date: nextDrawDateIso(era[era.length - 1].date) };
    const expectedHits = CHANCE.expectedHitsPerLine;

    // Rolling prefix hashes: prefixes.get(n) = hash of every draw before n.
    const prefixes = new Map();
    let rolling = "";
    for (const draw of draws) {
        prefixes.set(draw.draw, rolling = createHash("sha256").update(rolling + drawBytes(draw)).digest("hex").slice(0, 16));
    }
    const archiveHash = prefixes.get(nextDrawNo);

    // Load the evaluation cache; any structural drift means a full recompute.
    let cache;
    try {
        const parsed = JSON.parse(await readFile(CACHE_PATH, "utf8"));
        cache = parsed?.version === CACHE_VERSION && parsed.prefixes && parsed.entries && parsed.nextPicks ? parsed : null;
    } catch {
        cache = null;
    }
    if (!cache) cache = { version: CACHE_VERSION, prefixes: {}, entries: {}, nextPicks: {} };
    let hits = 0;
    let misses = 0;
    let pickHits = 0;

    // The desk and match-rate desks read the FULL archive — both ball pools —
    // not just the 6/49 era. Their per-fold contexts are memoised per target
    // draw; the skip-band table is frozen once on the first 400 archived
    // draws, exactly as its document specifies.
    const sorted = [...draws].sort((a, b) => a.draw - b.draw);
    const boundaryDraw = era[0].draw;
    freezeBandRates(sorted);
    const deskMemo = new Map();
    const deskPrepare = (eraPrior, target) => {
        if (!deskMemo.has(target.draw)) {
            const fullPrior = sorted.filter((d) => d.draw < target.draw);
            deskMemo.set(target.draw, buildDeskContext(eraPrior, fullPrior, target.draw, boundaryDraw));
        }
        return deskMemo.get(target.draw);
    };
    const mrMemo = new Map();
    const mrPrepare = (eraPrior, target) => {
        if (!mrMemo.has(target.draw)) {
            const fullPrior = sorted.filter((d) => d.draw < target.draw);
            mrMemo.set(target.draw, buildMatchrateContext(eraPrior, fullPrior, boundaryDraw));
        }
        return mrMemo.get(target.draw);
    };

    const specOf = ([id, name, family, description], rule, prepare) => ({ id, name, family, description, rule, prepare });
    const specs = [
        ...CURATED_STRATEGIES.map((s) => specOf(s, (prior, target, rng, stats) => CURATED_RULES[s[0]](prior, target, rng, stats), (prior, target) => buildFoldStats(prior, target))),
        ...GENERATOR_STRATEGIES.map((s) => specOf(s, (prior, _target, rng) => GENERATOR_RULES[s[0]](prior, rng))),
        ...DESK_STRATEGIES.map((s) => specOf(s, (prior, target, rng, prepared) => DESK_RULES[s[0]](prior, target, rng, prepared), deskPrepare)),
        ...MATCHRATE_STRATEGIES.map((s) => specOf(s, (prior, target, rng, prepared) => MATCHRATE_RULES[s[0]](prior, target, rng, prepared), mrPrepare)),
        ...INDICATOR_STRATEGIES.map((s) => specOf(s, (prior, target, rng, stats) => INDICATOR_RULES[s[0]](prior, target, rng, stats), (prior, target) => buildIndicatorFoldStats(prior, target))),
    ];

    const ids = new Set(specs.map((s) => s.id));
    if (ids.size !== specs.length) {
        for (const s of specs) {
            if (ids.has(s.id)) throw new Error(`duplicate strategy id: ${s.id}`);
        }
    }
    const families = [...new Set(specs.map((s) => s.family))].sort((a, b) => a.localeCompare(b));

    const rows = specs.map((spec) => {
        const key = (drawNo) => `${spec.id}:${drawNo}`;
        const foldCache = {
            get: (drawNo) => {
                const entry = cache.entries[key(drawNo)];
                if (!entry || cache.prefixes[String(drawNo)] !== prefixes.get(drawNo)) return undefined;
                hits += 1;
                return entry;
            },
            set: (drawNo, entry) => {
                misses += 1;
                cache.entries[key(drawNo)] = entry;
                cache.prefixes[String(drawNo)] = prefixes.get(drawNo);
            },
        };
        const nextPickCache = {
            get: () => {
                const entry = cache.nextPicks[spec.id];
                if (!entry || entry.h !== archiveHash) return undefined;
                pickHits += 1;
                return entry.p;
            },
            set: (pick) => {
                cache.nextPicks[spec.id] = { h: archiveHash, p: pick };
            },
        };
        return evaluateStrategy(spec, era, foldStart, foldEnd, expectedHits, {
            prepare: spec.prepare,
            nextTarget,
            foldCache,
            nextPickCache,
        });
    });
    rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    rows.forEach((row, i) => {
        row.rank = i + 1;
    });

    const league = {
        meta: {
            generatedAt: new Date(Date.now() + 8 * 3600e3).toISOString().replace("Z", "+08:00"),
            nextDraw: nextDrawNo,
            folds: foldEnd - foldStart,
            chance: CHANCE,
            families,
        },
        strategies: rows,
    };
    await writeFile(`${DATA_DIR}strategies.json`, JSON.stringify(league, 1), "utf8");
    await mkdir(fileURLToPath(new URL("..", import.meta.url)) + "data", { recursive: true });
    await writeFile(CACHE_PATH, `${JSON.stringify(cache, 1)}\n`, "utf8");

    console.log(
        "id".padEnd(21) +
            "family".padEnd(16) +
            "pick".padEnd(19) +
            "hits".padStart(5) +
            "2+".padStart(4) +
            "prz".padStart(4) +
            "z".padStart(6) +
            "score".padStart(7) +
            "rank".padStart(5),
    );
    for (const row of rows) {
        console.log(
            row.id.padEnd(21) +
                row.family.padEnd(16) +
                row.currentPick.map((n) => String(n).padStart(2, "0")).join(" ").padEnd(19) +
                String(row.totalHits).padStart(5) +
                String(row.twoPlusDraws).padStart(4) +
                String(row.totalPrizes).padStart(4) +
                String(row.zScore).padStart(6) +
                String(row.score).padStart(7) +
                String(row.rank).padStart(5),
        );
    }
    console.log(
        `\n${rows.length} strategies over ${foldEnd - foldStart} expanding walk-forward folds ` +
            `(chance: ${CHANCE.hitsPer100Draws} hits, ${CHANCE.twoPlusPer100Draws} draws with 2+, ${CHANCE.prizesPer100Draws} prizes per 100). ` +
            `Next draw ${nextDrawNo}. Cache: ${hits} fold hits / ${misses} misses, ${pickHits}/${rows.length} current picks reused.`,
    );
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
