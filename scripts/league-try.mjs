// toto.sg — read-only trial harness for league strategies. `npm run league:try`.
//
//   node scripts/league-try.mjs <ruleId> [--folds 100] [--verbose]
//   node scripts/league-try.mjs --family "Sequence" [--folds 50]
//
// Trials ONE rule (or every rule of a display family) over the trailing
// `--folds` walk-forward folds and prints a scorecard plus attempt stats —
// the acceptance tool AGENTS.md §5 asks for before adding a constraint.
//
// READ-ONLY: this tool never reads or writes data/league-cache.json and never
// writes any artifact. It reuses the exact evaluation path of the build
// (evaluateStrategy over the era, family prepares, env) with no caches.
//
// COST NOTE (--help): a PHASE-2 target (crossPanel, metaVote, fusionConsensus)
// reads the base league's assembled fold votes, so its trial first evaluates
// EVERY base rule over the window — 348 rules × folds fold evaluations —
// before the requested rule runs. Same for --family runs over many rules.
import { readFile } from "node:fs/promises";
import { CHANCE, evaluateStrategy, WARMUP_DRAWS } from "./lib/league-eval.mjs";
import { filterEra, nextDrawDateIso } from "./lib/analysis.mjs";
import { BASE_FAMILIES, PHASE2_FAMILIES } from "./lib/families.mjs";
import { buildCrossPanelContext } from "./lib/cross-panel-rules.mjs";
import { freezeBandRates } from "./lib/matchrate-rules.mjs";
import { sequencePrepare } from "./lib/sequence-dynamics-rules.mjs";
import { memoisedPrepare } from "./lib/platform/context.mjs";
import { scoreLine } from "./lib/toto.mjs";

const USAGE = `league:try — trial a league strategy read-only over trailing folds

  node scripts/league-try.mjs <ruleId> [--folds 100] [--verbose]
  node scripts/league-try.mjs --family "<display family>" [--folds 50]

  --folds N     trailing walk-forward folds to grade (default 100; the build
                itself grades every era draw after the ${WARMUP_DRAWS}-draw warm-up)
  --verbose     one line per fold: draw no, pick, matched, group, attempts
  --family X    trial every rule whose display family is X (e.g. "Sequence")

Cost: phase-2 rules (CROSS_PANEL, metaVote, fusionConsensus) read the base
league's fold votes, so their trial first evaluates every base rule over the
window — no cache reads or writes, expect the full base pass to dominate the
runtime. --family runs grade each matching rule separately.`;

const parseArgs = (argv) => {
    const out = { ruleId: null, family: null, folds: 100, verbose: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === "--folds") out.folds = Number(argv[++i]);
        else if (a === "--verbose") out.verbose = true;
        else if (a === "--family") out.family = argv[++i];
        else if (a === "--help" || a === "-h") {
            console.log(USAGE);
            process.exit(0);
        } else out.ruleId = a;
    }
    return out;
};

const pct = (x) => `${Math.round(x * 1000) / 10}%`;

/** Per-fold attempt counts around one rule: invocations until non-null. */
const instrument = (rule) => {
    const attempts = new Map();
    const wrapped = (prior, target, rng, prepared) => {
        attempts.set(target.draw, (attempts.get(target.draw) ?? 0) + 1);
        return rule(prior, target, rng, prepared);
    };
    return { wrapped, attempts };
};

const attemptStats = (attempts, drawNos) => {
    const rows = drawNos.map((d) => attempts.get(d) ?? 0).sort((a, b) => a - b);
    const n = rows.length || 1;
    const p95 = rows[Math.min(rows.length - 1, Math.ceil(0.95 * n) - 1)];
    const mean = rows.reduce((a, b) => a + b, 0) / n;
    const over100 = rows.filter((x) => x > 100).length;
    const max = rows[rows.length - 1] ?? 0;
    return { mean, p95, max, over100, folds: rows.length };
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (!args.ruleId && !args.family) {
        console.error(USAGE);
        process.exit(1);
    }

    const draws = JSON.parse(await readFile(new URL("../public/data/draws.json", import.meta.url), "utf8"));
    const era = filterEra(draws);
    const maxFolds = era.length - WARMUP_DRAWS;
    const folds = Math.max(1, Math.min(args.folds, maxFolds));
    const foldStart = era.length - folds;
    const foldEnd = era.length;
    const nextDrawNo = era[era.length - 1].draw + 1;
    const nextTarget = { draw: nextDrawNo, date: nextDrawDateIso(era[era.length - 1].date) };
    const expectedHits = CHANCE.expectedHitsPerLine;

    // Exactly the build's fold-invariant environment: the full sorted archive
    // (desk/matchrate read both eras) and the era boundary, with the
    // skip-band table frozen once on the first 400 archived draws.
    const sorted = [...draws].sort((a, b) => a.draw - b.draw);
    const boundaryDraw = era[0].draw;
    freezeBandRates(sorted);
    const env = { sorted, boundaryDraw };

    const allFamilies = [...BASE_FAMILIES, ...PHASE2_FAMILIES];
    const specsOf = (family, prepare) =>
        family.rows.map(([id, name, rowFamily, description]) => ({
            id,
            name,
            family: rowFamily,
            description,
            rule: family.rules[id],
            prepare,
            phase: family.phase,
        }));

    // Which specs to trial.
    let targets;
    let listed = "";
    if (args.ruleId) {
        const spec = allFamilies.flatMap((f) => specsOf(f, f.prepare)).find((s) => s.id === args.ruleId);
        if (!spec) {
            const ids = allFamilies.flatMap((f) => f.ids);
            console.error(`unknown rule id: "${args.ruleId}"\n\navailable ids:\n${ids.join(", ")}`);
            process.exit(1);
        }
        targets = [spec];
        listed = spec.id;
    } else {
        targets = allFamilies.flatMap((f) => specsOf(f, f.prepare)).filter((s) => s.family.toLowerCase() === args.family.toLowerCase());
        if (targets.length === 0) {
            const families = [...new Set(allFamilies.flatMap((f) => f.rows.map((r) => r[2])))].sort();
            console.error(`no rules with display family "${args.family}"\n\navailable display families:\n${families.join(", ")}`);
            process.exit(1);
        }
        listed = `${targets.length} rules of "${args.family}"`;
    }

    // Phase-2 targets need the base league's votes over the window: run every
    // base spec once (no caches), record picks, then assemble votes exactly as
    // the build does. Base-only runs skip this pass entirely.
    const needsVotes = targets.some((t) => t.phase === 2);
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
    if (needsVotes) {
        process.stderr.write(`assembling base-league votes over ${folds} folds (every base rule evaluated; read-only)…\n`);
        const baseSpecs = BASE_FAMILIES.flatMap((f) => specsOf(f, f.prepare));
        for (const spec of baseSpecs) {
            evaluateStrategy(spec, era, foldStart, foldEnd, expectedHits, {
                prepare: spec.prepare,
                prepareEnv: env,
                nextTarget,
                onPick: (drawNo, pick) => {
                    let list = picksByDraw.get(drawNo);
                    if (!list) picksByDraw.set(drawNo, (list = []));
                    list.push(pick);
                },
                onCurrentPick: (pick) => {
                    for (const n of pick) nowVotes[n - 1] += 1;
                },
            });
        }
    }
    const votePrepares = {
        crossPanel: memoisedPrepare((prior, target) =>
            buildCrossPanelContext(prior, target, target.draw === nextDrawNo ? nowVotes : votesFor(target.draw)),
        ),
        fusion: memoisedPrepare((prior, target) => ({
            seq: sequencePrepare(prior, target),
            votes: target.draw === nextDrawNo ? nowVotes : votesFor(target.draw),
        })),
    };
    const prepareOf = (spec) => {
        if (spec.phase !== 2) return spec.prepare;
        const family = PHASE2_FAMILIES.find((f) => f.ids.includes(spec.id));
        return typeof family.votes === "function"
            ? (prior, target, prepareEnv) => family.votes(prior, target, votesFor(target.draw), prepareEnv)
            : votePrepares[family.votes];
    };

    console.log(`league:try — ${listed} · ${folds} trailing folds (draws ${era[foldStart].draw}..${era[foldEnd - 1].draw}) · next draw ${nextDrawNo}\n`);

    const drawNos = [];
    for (let i = foldStart; i < foldEnd; i += 1) drawNos.push(era[i].draw);

    for (const spec of targets) {
        const { wrapped, attempts } = instrument(spec.rule);
        const perFold = [];
        const row = evaluateStrategy({ ...spec, rule: wrapped }, era, foldStart, foldEnd, expectedHits, {
            prepare: prepareOf(spec),
            prepareEnv: env,
            nextTarget,
            onPick: (drawNo, pick) => {
                const draw = era.find((d) => d.draw === drawNo);
                perFold.push({ drawNo, pick, matched: draw.numbers.filter((n) => pick.includes(n)).length, group: scoreLine(pick, draw) });
            },
        });
        const stats = attemptStats(attempts, [...drawNos, nextDrawNo]);
        const t = row.tierCounts;
        console.log(`${spec.id}  (${spec.name} · ${spec.family}${spec.phase === 2 ? " · phase-2" : ""})`);
        console.log(
            `  totalHits ${row.totalHits} · mean ${row.meanHits}/fold (chance ${CHANCE.expectedHitsPerLine}) · z ${row.zScore}`,
        );
        console.log(
            `  2+ draws ${row.twoPlusDraws} (${pct(row.twoPlusDraws / folds)}, chance ${CHANCE.twoPlusPer100Draws / 100}) · prize draws ${row.totalPrizes} (${pct(row.totalPrizes / folds)}) · depthPoints ${row.depthPoints} · score ${row.score}`,
        );
        console.log(
            `  tiers G1..G7 ${t.g1}/${t.g2}/${t.g3}/${t.g4}/${t.g5}/${t.g6}/${t.g7} · bestGroup ${row.bestGroup ?? "-"} · recent12 ${row.recent12}`,
        );
        console.log(`  currentPick (draw ${nextDrawNo}): ${row.currentPick.map((n) => String(n).padStart(2, "0")).join(" ")}`);
        console.log(
            `  attempts/fold mean ${Math.round(stats.mean * 100) / 100} · p95 ${stats.p95} · max ${stats.max} · folds >100 attempts ${pct(stats.over100 / stats.folds)}`,
        );
        if (stats.max > 1000) {
            console.log(`  ⚠ a fold needed ${stats.max} attempts — REJECT_CAP is 10000; the acceptance region is too narrow (AGENTS.md §5).`);
        }
        if (args.verbose && targets.length === 1) {
            console.log("  per fold:");
            for (const f of perFold) {
                console.log(
                    `    #${f.drawNo}  ${f.pick.map((n) => String(n).padStart(2, "0")).join(" ")}  matched ${f.matched}  group ${f.group}  attempts ${attempts.get(f.drawNo) ?? 0}`,
                );
            }
            console.log(`    #${nextDrawNo} (next)  attempts ${attempts.get(nextDrawNo) ?? 0}`);
        }
        console.log("");
    }
    process.stderr.write("read-only run: no cache or artifact was read or written.\n");
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
