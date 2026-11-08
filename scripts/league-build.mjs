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
import { buildCatalogContext, CATALOG_SIGNAL_RULES, CATALOG_SIGNAL_STRATEGIES } from "./lib/catalog-signal-rules.mjs";
import { CATALOG_STRUCTURE_RULES, CATALOG_STRUCTURE_STRATEGIES } from "./lib/catalog-structure-rules.mjs";
import { CATALOG_ALMANAC_RULES, CATALOG_ALMANAC_STRATEGIES } from "./lib/catalog-almanac-rules.mjs";
import { CATALOG_ML_RULES, CATALOG_ML_STRATEGIES, META_VOTE_ID } from "./lib/catalog-ml-rules.mjs";
import { buildFoldStats } from "./lib/cross-panel-stats.mjs";
import { CROSS_PANEL_RULES, CROSS_PANEL_STRATEGIES, buildCrossPanelContext } from "./lib/cross-panel-rules.mjs";
import { CROSS_PANEL_PLAYBOOK } from "./lib/cross-panel-playbook.mjs";
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
    const catMemo = new Map();
    const catalogPrepare = (eraPrior, target) => {
        if (!catMemo.has(target.draw)) catMemo.set(target.draw, buildCatalogContext(eraPrior, target));
        return catMemo.get(target.draw);
    };

    const specOf = ([id, name, family, description], rule, prepare) => ({ id, name, family, description, rule, prepare });
    const baseSpecs = [
        ...CURATED_STRATEGIES.map((s) => specOf(s, (prior, target, rng, stats) => CURATED_RULES[s[0]](prior, target, rng, stats), (prior, target) => buildFoldStats(prior, target))),
        ...GENERATOR_STRATEGIES.map((s) => specOf(s, (prior, _target, rng) => GENERATOR_RULES[s[0]](prior, rng))),
        ...DESK_STRATEGIES.map((s) => specOf(s, (prior, target, rng, prepared) => DESK_RULES[s[0]](prior, target, rng, prepared), deskPrepare)),
        ...MATCHRATE_STRATEGIES.map((s) => specOf(s, (prior, target, rng, prepared) => MATCHRATE_RULES[s[0]](prior, target, rng, prepared), mrPrepare)),
        ...INDICATOR_STRATEGIES.map((s) => specOf(s, (prior, target, rng, stats) => INDICATOR_RULES[s[0]](prior, target, rng, stats), (prior, target) => buildIndicatorFoldStats(prior, target))),
        ...CATALOG_SIGNAL_STRATEGIES.map((s) => specOf(s, (prior, target, rng, ctx) => CATALOG_SIGNAL_RULES[s[0]](prior, target, rng, ctx), catalogPrepare)),
        ...CATALOG_STRUCTURE_STRATEGIES.map((s) => specOf(s, (prior, target, rng, ctx) => CATALOG_STRUCTURE_RULES[s[0]](prior, target, rng, ctx), catalogPrepare)),
        ...CATALOG_ALMANAC_STRATEGIES.map((s) => specOf(s, (prior, target, rng, ctx) => CATALOG_ALMANAC_RULES[s[0]](prior, target, rng, ctx), catalogPrepare)),
        // metaVote is not here: it is a second-phase spec wired below.
        ...CATALOG_ML_STRATEGIES.filter(([id]) => id !== META_VOTE_ID).map((s) => specOf(s, (prior, target, rng, ctx) => CATALOG_ML_RULES[s[0]](prior, target, rng, ctx), catalogPrepare)),
    ];

    // The cross-panel family reads the league's own vote, so it runs in a
    // second phase: once every base rule has produced its line for a fold, the
    // consensus for that fold is known and the contrarian strategy can fade it.
    // The context is memoised per fold, so all ten rules share one build.
    const picksByDraw = new Map();
    const crossPanelMemo = new Map();
    const votesFor = (drawNo) => {
        let votes = crossPanelMemo.get(`votes:${drawNo}`);
        if (!votes) {
            votes = new Uint16Array(49);
            for (const pick of picksByDraw.get(drawNo) ?? []) for (const n of pick) votes[n - 1] += 1;
            crossPanelMemo.set(`votes:${drawNo}`, votes);
        }
        return votes;
    };
    const nowVotes = new Uint16Array(49);
    const crossPanelPrepare = (prior, target) => {
        const key = `ctx:${target.draw}`;
        let ctx = crossPanelMemo.get(key);
        if (!ctx) {
            const votes = target.draw === nextDrawNo ? nowVotes : votesFor(target.draw);
            ctx = buildCrossPanelContext(prior, target, votes);
            crossPanelMemo.set(key, ctx);
        }
        return ctx;
    };
    const crossPanelSpecs = [
        ...CROSS_PANEL_STRATEGIES.map((s) =>
            specOf(s, (prior, target, rng, ctx) => CROSS_PANEL_RULES[s[0]](prior, target, rng, ctx), crossPanelPrepare),
        ),
        // The catalog's metaVote joins the second phase: it votes the league's
        // own fold lines (Step 5 of the adoption plan), so it needs the same
        // assembled consensus the contrarian strategies read.
        ...CATALOG_ML_STRATEGIES.filter(([id]) => id === META_VOTE_ID).map((s) =>
            specOf(s, (prior, target, rng, ctx) => CATALOG_ML_RULES[s[0]](prior, target, rng, ctx), crossPanelPrepare),
        ),
    ];

    const specs = [...baseSpecs, ...crossPanelSpecs];
    const ids = new Set(specs.map((s) => s.id));
    if (ids.size !== specs.length) {
        for (const s of specs) {
            if (ids.has(s.id)) throw new Error(`duplicate strategy id: ${s.id}`);
        }
    }
    const families = [...new Set(specs.map((s) => s.family))].sort((a, b) => a.localeCompare(b));

    const evaluate = (spec, onPick) => {
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
            onPick,
        });
    };

    // Phase 1 — the base league. Every fold's pick is recorded so the
    // consensus vote can be assembled without re-running a single rule.
    const rows = [];
    for (const spec of baseSpecs) {
        rows.push(
            evaluate(spec, (drawNo, pick) => {
                let list = picksByDraw.get(drawNo);
                if (!list) {
                    list = [];
                    picksByDraw.set(drawNo, list);
                }
                list.push(pick);
            }),
        );
    }
    // The current (next-draw) consensus uses every base rule's next pick.
    for (const row of rows) for (const n of row.currentPick) nowVotes[n - 1] += 1;

    // Phase 2 — the cross-panel family, now that the vote is known.
    for (const spec of crossPanelSpecs) rows.push(evaluate(spec));
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

    // The playbook pairs each cross-panel strategy's document evidence with
    // the live league row it produced.
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const playbook = {
        meta: {
            generatedAt: league.meta.generatedAt,
            nextDraw: nextDrawNo,
            family: "Cross-Panel",
            source: "toto_10_gambler_strategies.docx",
        },
        strategies: CROSS_PANEL_PLAYBOOK.map((entry) => {
            const row = rowById.get(entry.id);
            if (!row) throw new Error(`playbook entry without a league row: ${entry.id}`);
            return {
                ...entry,
                row: {
                    id: row.id,
                    name: row.name,
                    rank: row.rank,
                    score: row.score,
                    totalHits: row.totalHits,
                    meanHits: row.meanHits,
                    twoPlusDraws: row.twoPlusDraws,
                    currentPick: row.currentPick,
                },
            };
        }),
    };
    await writeFile(`${DATA_DIR}cross-panel-playbook.json`, JSON.stringify(playbook, 1), "utf8");

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
