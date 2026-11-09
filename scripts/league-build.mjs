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
import { CHANCE, evaluateStrategy, round2, WARMUP_DRAWS } from "./lib/league-eval.mjs";
import { filterEra, nextDrawDateIso } from "./lib/analysis.mjs";
import { scoreLine } from "./lib/toto.mjs";
import { memoisedPrepare } from "./lib/platform/context.mjs";
import { BASE_FAMILIES, PHASE2_FAMILIES } from "./lib/families.mjs";
import { buildCrossPanelContext } from "./lib/cross-panel-rules.mjs";
import { CROSS_PANEL_PLAYBOOK } from "./lib/cross-panel-playbook.mjs";
import { freezeBandRates } from "./lib/matchrate-rules.mjs";
import { sequencePrepare } from "./lib/sequence-dynamics-rules.mjs";

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
    // The fold-invariant environment handed to every family prepare via
    // evaluateStrategy's prepareEnv: the FULL sorted archive (both ball
    // pools — the desk and match-rate desks read it) and the 6/49 era
    // boundary. Family prepares memoise themselves; nothing here rebuilds
    // per fold.
    const env = { sorted, boundaryDraw };

    // Prize-hit events per strategy: every fold where the line won a prize
    // tier. onPick fires once per fold (cached folds included), so the events
    // assemble without re-running a single rule; the group is recomputed from
    // the pick and the draw, exactly as the evaluator graded it. Hit facts
    // only — which draw, which line, which tier — never prize money.
    const drawByNo = new Map(era.map((draw) => [draw.draw, draw]));
    const prizeEvents = new Map();
    const collectEvent = (specId, drawNo, pick) => {
        const draw = drawByNo.get(drawNo);
        if (!draw) return; // the next-draw pick has no archived draw yet
        const group = scoreLine(pick, draw);
        if (group === 0) return;
        let list = prizeEvents.get(specId);
        if (!list) prizeEvents.set(specId, (list = []));
        list.push({ d: drawNo, date: draw.date, g: group, p: pick });
    };

    // Every spec derives from the family registry: one row tuple → one spec,
    // with the family's own prepare (memoised inside the family module).
    const specsOf = (family, prepare) =>
        family.rows.map(([id, name, rowFamily, description]) => ({
            id,
            name,
            family: rowFamily,
            description,
            rule: family.rules[id],
            prepare,
        }));
    const baseSpecs = BASE_FAMILIES.flatMap((family) => specsOf(family, family.prepare));

    // The phase-2 families read the league's own vote, so they run in a
    // second phase: once every base rule has produced its line for a fold,
    // the consensus for that fold is known and the contrarian strategies can
    // fade it. Vote assembly lives here because it owns the phase-2 runtime
    // state (the recorded base picks); a family only declares which vote
    // context kind it wants.
    const picksByDraw = new Map();
    const voteMemo = new Map();
    const votesFor = (drawNo) => {
        let votes = voteMemo.get(drawNo);
        if (!votes) {
            votes = new Uint16Array(49);
            for (const pick of picksByDraw.get(drawNo) ?? []) for (const n of pick) votes[n - 1] += 1;
            voteMemo.set(drawNo, votes);
        }
        return votes;
    };
    const nowVotes = new Uint16Array(49);
    const votePrepares = {
        crossPanel: memoisedPrepare((prior, target) =>
            buildCrossPanelContext(prior, target, target.draw === nextDrawNo ? nowVotes : votesFor(target.draw)),
        ),
        // fusionConsensus reads the sequence context AND the fold's league
        // votes; the sequence family's shared memo supplies one build per draw.
        fusion: memoisedPrepare((prior, target) => ({
            seq: sequencePrepare(prior, target),
            votes: target.draw === nextDrawNo ? nowVotes : votesFor(target.draw),
        })),
    };
    const crossPanelSpecs = PHASE2_FAMILIES.flatMap((family) =>
        specsOf(
            family,
            typeof family.votes === "function"
                ? (prior, target, prepareEnv) => family.votes(prior, target, votesFor(target.draw), prepareEnv)
                : votePrepares[family.votes],
        ),
    );

    const specs = [...baseSpecs, ...crossPanelSpecs];
    const ids = new Set(specs.map((s) => s.id));
    if (ids.size !== specs.length) {
        for (const s of specs) {
            if (ids.has(s.id)) throw new Error(`duplicate strategy id: ${s.id}`);
        }
    }
    // Two rows with the same name or the same description are the same rule
    // written twice — verify:data fails on them, so catch it here first.
    for (const field of ["name", "description"]) {
        const seen = new Set();
        for (const s of specs) {
            if (seen.has(s[field])) throw new Error(`duplicate strategy ${field}: "${s[field]}" (${s.id})`);
            seen.add(s[field]);
        }
    }
    // The Phase-2 consensus rules read the base rules' fold lines, so their
    // results depend on WHICH base rules exist. The base set's fingerprint
    // scopes their cache entries: when a base rule is added or removed the
    // hash changes and the Phase-2 folds recompute, while the base rules'
    // own entries keep their exact keys and stay cache hits.
    const baseSetHash = createHash("sha256")
        .update(baseSpecs.map((s) => s.id).sort().join(","))
        .digest("hex")
        .slice(0, 8);

    const evaluate = (spec, onPick, scope = "") => {
        const key = (drawNo) => (scope ? `${spec.id}:${scope}:${drawNo}` : `${spec.id}:${drawNo}`);
        const prefixKey = (drawNo) => (scope ? `${scope}:${drawNo}` : String(drawNo));
        const nextKey = () => (scope ? `${spec.id}:${scope}` : spec.id);
        const foldCache = {
            get: (drawNo) => {
                const entry = cache.entries[key(drawNo)];
                if (!entry || cache.prefixes[prefixKey(drawNo)] !== prefixes.get(drawNo)) return undefined;
                hits += 1;
                return entry;
            },
            set: (drawNo, entry) => {
                misses += 1;
                cache.entries[key(drawNo)] = entry;
                cache.prefixes[prefixKey(drawNo)] = prefixes.get(drawNo);
            },
        };
        const nextPickCache = {
            get: () => {
                const entry = cache.nextPicks[nextKey()];
                if (!entry || entry.h !== archiveHash) return undefined;
                pickHits += 1;
                return entry.p;
            },
            set: (pick) => {
                cache.nextPicks[nextKey()] = { h: archiveHash, p: pick };
            },
        };
        return evaluateStrategy(spec, era, foldStart, foldEnd, expectedHits, {
            prepare: spec.prepare,
            nextTarget,
            foldCache,
            nextPickCache,
            onPick,
            prepareEnv: env,
        });
    };

    // Phase 1 — the base league. Every fold's pick is recorded so the
    // consensus vote can be assembled without re-running a single rule.
    const rows = [];
    for (const spec of baseSpecs) {
        rows.push(
            evaluate(spec, (drawNo, pick) => {
                collectEvent(spec.id, drawNo, pick);
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

    // Phase 2 — the cross-panel family, now that the vote is known. Their
    // cache entries live under the base-set fingerprint, so a change to the
    // base rules invalidates exactly these and nothing else.
    for (const spec of crossPanelSpecs) {
        rows.push(evaluate(spec, (drawNo, pick) => collectEvent(spec.id, drawNo, pick), baseSetHash));
    }

    // The hot score — "who is winning NOW": every prize fold contributes
    // 0.5^(draws since / half-life), so a prize in the last graded draw
    // counts 1.0 and one from 100 draws ago 0.5. rank/score stay the
    // all-window metrics; this is the recency ranking the league table's
    // Hot sort reads.
    const HOT_HALF_LIFE = 100;
    const decay = (drawNo) => 0.5 ** ((nextDrawNo - drawNo) / HOT_HALF_LIFE);
    const chanceHotScore = round2(
        (CHANCE.prizesPer100Draws / 100) *
            Array.from({ length: foldEnd - foldStart }, (_, i) => decay(era[foldStart + i].draw)).reduce((a, b) => a + b, 0),
    );
    for (const row of rows) {
        row.hotScore = round2((prizeEvents.get(row.id) ?? []).reduce((acc, event) => acc + decay(event.d), 0));
    }

    // Below-chance cleanup: any strategy that performs worse than the honest
    // chance baseline (quickpick — seeded uniform 6-of-49) on EITHER axis —
    // raw match score or prize-fold count — is dropped from the league table
    // instead of riding along as filler. Every rule still ran, so the
    // Phase-2 consensus stays whole; only the report is trimmed.
    const baseline = rows.find((row) => row.id === "quickpick");
    if (!baseline) throw new Error("chance baseline row missing: quickpick");
    const belowBaseline = rows.filter(
        (row) => row.score < baseline.score || row.totalPrizes < baseline.totalPrizes,
    );
    const kept = rows.filter((row) => row.score >= baseline.score && row.totalPrizes >= baseline.totalPrizes);
    const keptIds = new Set(kept.map((row) => row.id));

    kept.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    kept.forEach((row, i) => {
        row.rank = i + 1;
    });

    // Display score: raw prize points are decade-weighted (one G3 = 10,000), so
    // a single mid-tier hit makes five-digit scores while the rest sit near 0.
    // Normalise on a log scale against the league's THEORETICAL CEILING — every
    // fold a Group 1, folds × 1,000,000 points — not against the current
    // leader. The absolute anchor keeps 100 an impossible perfect league
    // instead of a badge the leader gets for free: today the top sits at ~54,
    // a chance-grade row at ~30, zero-score rows floor at 1, and the number
    // stays comparable as the fold count grows.
    const ceiling = (foldEnd - foldStart) * 1_000_000;
    for (const row of kept) row.score100 = Math.max(1, 1 + Math.round((99 * Math.log1p(row.score)) / Math.log1p(ceiling)));

    const league = {
        meta: {
            generatedAt: new Date(Date.now() + 8 * 3600e3).toISOString().replace("Z", "+08:00"),
            nextDraw: nextDrawNo,
            folds: foldEnd - foldStart,
            chance: CHANCE,
            hot: { halfLifeDraws: HOT_HALF_LIFE, chanceHotScore },
            families: [...new Set(kept.map((row) => row.family))].sort((a, b) => a.localeCompare(b)),
        },
        strategies: kept,
    };
    await writeFile(`${DATA_DIR}strategies.json`, JSON.stringify(league, 1), "utf8");

    // The prize-hit ledger: per strategy, every fold that won a prize — the
    // draw, its date, the tier and the exact line. Pure hit facts; the UI's
    // tier tiles expand to show them.
    const eventLedger = {
        meta: { generatedAt: league.meta.generatedAt, nextDraw: nextDrawNo, folds: foldEnd - foldStart },
        strategies: Object.fromEntries(
            specs
                .filter((spec) => keptIds.has(spec.id))
                .map((spec) => [spec.id, (prizeEvents.get(spec.id) ?? []).sort((a, b) => a.d - b.d)]),
        ),
    };
    await writeFile(`${DATA_DIR}prize-events.json`, JSON.stringify(eventLedger, 1), "utf8");

    // The playbook pairs each cross-panel strategy's document evidence with
    // the live league row it produced.
    const rowById = new Map(kept.map((row) => [row.id, row]));
    const playbook = {
        meta: {
            generatedAt: league.meta.generatedAt,
            nextDraw: nextDrawNo,
            family: "Cross-Panel",
            source: "toto_10_gambler_strategies.docx",
        },
        strategies: CROSS_PANEL_PLAYBOOK.filter((entry) => keptIds.has(entry.id)).map((entry) => {
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

    // Prune the cache down to the keys the current rule set actually uses.
    // A base rule that was removed, or a Phase-2 entry left behind by an
    // older base-set fingerprint, would otherwise sit in the file forever.
    const validEntryKeys = new Set();
    const validNextPickKeys = new Set();
    for (const spec of baseSpecs) {
        validNextPickKeys.add(spec.id);
        for (let i = foldStart; i < foldEnd; i += 1) validEntryKeys.add(`${spec.id}:${era[i].draw}`);
    }
    for (const spec of crossPanelSpecs) {
        validNextPickKeys.add(`${spec.id}:${baseSetHash}`);
        for (let i = foldStart; i < foldEnd; i += 1) {
            validEntryKeys.add(`${spec.id}:${baseSetHash}:${era[i].draw}`);
        }
    }
    for (const entryKey of Object.keys(cache.entries)) {
        if (!validEntryKeys.has(entryKey)) delete cache.entries[entryKey];
    }
    for (const pickKey of Object.keys(cache.nextPicks)) {
        if (!validNextPickKeys.has(pickKey)) delete cache.nextPicks[pickKey];
    }

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
    for (const row of kept) {
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
        `\n${kept.length} strategies over ${foldEnd - foldStart} expanding walk-forward folds ` +
            `(chance: ${CHANCE.hitsPer100Draws} hits, ${CHANCE.twoPlusPer100Draws} draws with 2+, ${CHANCE.prizesPer100Draws} prizes per 100). ` +
            `${belowBaseline.length} rows below the chance baseline (quickpick — score ${baseline.score}, ${baseline.totalPrizes} prize folds) dropped. ` +
            `Next draw ${nextDrawNo}. Cache: ${hits} fold hits / ${misses} misses, ${pickHits}/${kept.length} current picks reused.`,
    );
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
