// toto.sg — the 10 cross-panel gambler strategies from
// toto_10_gambler_strategies.docx, as live league rows.
//
// The document audited the 50 analytics panels on /insights across 1,238
// 6/49-era draws and proposed ten original strategies. Each strategy pairs a
// statistical cage property with a pari-mutuel anti-collision mechanism, so
// none of them is a single-variable heuristic.
//
// This script implements each one as a deterministic rule (scripts/lib/
// gambler-rules-*.mjs) that regenerates its line for every walk-forward fold
// from the draws that precede it, scores it with the shared league evaluator,
// and writes the rows into public/data/strategies.json under the family
// "Gambler". It also writes public/data/gambler-playbook.json, the evidence
// and rule summary the /strategies page renders next to each row.
//
// The document's illustrative lines are kept verbatim in the playbook as the
// "spec line" of each strategy. They are hindsight examples from the source
// document and are NOT the rows the rules produce — the league row always
// carries the rule's own current pick.
//
// Determinism: rules draw randomness only from rngFor(id, drawNo) inside the
// shared evaluator, so reruns are byte-identical apart from meta.generatedAt.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { evaluateStrategy, FOLDS } from "./lib/league-eval.mjs";
import { filterEra, nextDrawDateIso } from "./lib/analysis.mjs";
import { buildFoldStats } from "./lib/gambler-stats.mjs";
import { isPlaceholderRow } from "./lib/league-clean.mjs";
import { RULES_A } from "./lib/gambler-rules-a.mjs";
import { RULES_B } from "./lib/gambler-rules-b.mjs";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));

/** The ten strategies, in the order the document presents them. */
const GAMBLER_STRATEGIES = [
    {
        id: "zeroBotTetraphobia",
        name: "Zero-Bot & Tetraphobia Shield",
        description:
            "Dual anti-crowd arbitrage. Bans the bot-consensus leaders (08, 22, 30, 32, 46, 48) and every digit-8 ball, locks the six zero-bot-pick balls' tetraphobia tier (13, 20, 34, 40), and fills from uncrowded >31 tetraphobia and prime anchors so the line clears 186.",
        specLine: [13, 20, 34, 40, 44, 47],
        panels: [18, 35, 38, 39],
        edge: "Dual anti-crowd arbitrage (+S$244–S$445)",
        rules: [
            "Ban the bot-consensus leaders 08, 22, 30, 32, 46, 48 and every digit-8 ball.",
            "Always carry the zero-bot-pick pool 13, 20, 34, 40 — 34 and 40 are tetraphobia above 31.",
            "Fill two more slots from 41, 42, 43, 44, 45, 47, 49 so the sum lands in 186–205.",
        ],
        math: "In a pari-mutuel game the expected return falls with the number of co-winners, so a line is maximised by avoiding both human superstition and algorithmic consensus at once.",
    },
    {
        id: "mod9Root7Lock",
        name: "Mod-9 Residue Equilibrium & Digital Root 7",
        description:
            "Exploits the one structural anomaly the randomness audit flags. Splits the line across six distinct mod-9 residue classes with at least three of them from the six-ball classes, and locks the sum to digital root 7 — 160, 169, 178 or 187.",
        specLine: [11, 23, 33, 37, 40, 43],
        panels: [31, 41, 50],
        edge: "Exploits the χ² = 93.71 mod-9 anomaly",
        rules: [
            "Six balls from six different mod-9 residue classes, at least three from the six-ball classes.",
            "The residue classes must sum to 7 (mod 9).",
            "The line sum must be exactly 160, 169, 178 or 187.",
        ],
        math: "Every other sum rule treats 177, 178 and 179 as equivalent; only a residue-locked line rides the single chi-square failure in 1,238 draws.",
    },
    {
        id: "velocityMirrorTwin",
        name: "50-Draw Velocity & 50-n Mirror Twin",
        description:
            "Anchors the line on the strongest short-term velocity leaders when they happen to form a 50-n mirror pair, vetoes the five fastest-falling balls, and tops up with the remaining risers and the >31 payout anchors.",
        specLine: [11, 23, 33, 39, 41, 47],
        panels: [1, 4, 9, 16],
        edge: "Regime momentum plus mirror symmetry",
        rules: [
            "Take the velocity leaders of the last 50 draws; when two of them sum to 50, that pair is the core.",
            "Veto the five balls with the most negative 50-draw residual.",
            "Fill the rest from the remaining risers and the anchors 41 and 47.",
        ],
        math: "All-time frequencies decay badly inside a cold regime; a short-window residual plus a mirror pair buys momentum and symmetry in two slots.",
    },
    {
        id: "lag1CarryoverBridge",
        name: "Lag-1 Kinetic Carryover & 7th-Ball Bridge",
        description:
            "Anti-gambler's-fallacy engine. Spends one slot on the previous draw's additional (7th) ball, one on a ±1 neighbour of a previous main ball, and fills the rest inside the observed 20-draw gap window — balls overdue by more than 20 draws are rejected outright.",
        specLine: [20, 21, 33, 37, 42, 47],
        panels: [2, 10, 13, 14, 15, 43, 44, 48],
        edge: "Captures the 58% repeater and 12.6% 7th-ball rates",
        rules: [
            "Slot 1: the previous draw's additional ball, else its highest main number.",
            "Slot 2: a ±1 neighbour of one of the previous draw's six main balls.",
            "Slots 3–6: balls seen within the last 20 draws; reject any ball overdue by more.",
        ],
        math: "58% of draws contain a lag-1 repeater and 12.6% promote the 7th ball; the line is shaped to meet that density instead of fighting it.",
    },
    {
        id: "zScoreDyadLock",
        name: "Second-Order Z-Score Graph Filtering",
        description:
            "Builds the line as a six-vertex graph. The anchor is the pair with the strongest standardised co-occurrence residual, the documented repulsion and drought pairs are vetoed outright, and at most two of the fifteen edges may fall below the expected co-occurrence.",
        specLine: [5, 15, 32, 40, 42, 49],
        panels: [6, 7, 8, 11],
        edge: "Second-order graph harmony, no dead edges",
        rules: [
            "Anchor the strongest positive pair from the 49×49 co-occurrence matrix.",
            "Never play 27-45, 14-34, 16-19, 18-40, 13-33 or 5-21 together.",
            "Keep at most two of the fifteen pairs below the expected co-occurrence.",
        ],
        math: "Combining individually strong numbers without a second-order check plants a dead edge inside the ticket; the clique sieve removes it.",
    },
    {
        id: "compositionAcNine",
        name: "Asymmetric Composition Cell & High-AC Sieve",
        description:
            "Plays the composition matrix's strongest cell instead of the recommended symmetric split: three odd and three even, exactly two balls above 24, at least three of the four low balls in the upper-low band 19–24, Arithmetic Complexity of at least 9, no consecutive pair and no three-term progression.",
        specLine: [19, 21, 22, 24, 37, 46],
        panels: [21, 22, 23, 27, 29, 41],
        edge: "#1 matrix cell plus maximum gap dispersion",
        rules: [
            "Exactly 3 odd and 3 even balls, exactly 2 of them above 24.",
            "At least 3 of the 4 low balls inside 19–24.",
            "Arithmetic Complexity ≥ 9, no consecutive pair, no three-term progression.",
        ],
        math: "Human players over-use arithmetic progressions and runs; a high-AC line keeps almost every pairwise gap unique.",
    },
    {
        id: "weekdayRegime",
        name: "Calendar-Conditional Regime Switching",
        description:
            "Switches its core on the draw calendar. Monday draws anchor on the balls that skew Monday (18, 23, 39) with 40 excluded; Thursday draws anchor on 4, 20 and 46. The target sum drifts with the season — higher in the first quarter, lower mid-year.",
        specLine: [18, 23, 34, 39, 41, 47],
        panels: [45, 46, 49],
        edge: "Day-of-week conditional skew (±4.74%)",
        rules: [
            "Monday draws: carry 18, 23 and 39, and exclude 40.",
            "Thursday draws: carry 4, 20 and 46.",
            "Target sum 155–190 in the first quarter, 142–172 in June, 145–185 otherwise.",
        ],
        math: "A static ticket ignores a schedule-conditioned distribution; the weekday split alone spans nearly 9.2% between peak and trough.",
    },
    {
        id: "cascadeBarbellSpan43",
        name: "Cascade Draw 4 Barbell & Span-43 Lock",
        description:
            "A barbell built for cascade draws: one low anchor, five balls at 33 or above, nothing at all between 7 and 32. The span is pinned to the modal 42–44 and the sum to the 190+ band where Group 3 prizes peak.",
        specLine: [5, 34, 39, 41, 44, 48],
        panels: [25, 26, 38, 39, 40, 41, 42],
        edge: "Cascade rollover solo-share protection",
        rules: [
            "Smallest ball 04, 05 or 06; largest ball 47, 48 or 49; span 42–44.",
            "No ball between 07 and 32 — the four middle balls sit in 33–46.",
            "Line sum inside 190–215.",
        ],
        math: "During a cascade frenzy the calendar zone floods; a barbell keeps the jackpot share thin while still riding the 43-mode span.",
    },
    {
        id: "fiveTailMode",
        name: "5-Tail Terminal Digit Architecture",
        description:
            "Matches the modal five-ending shape: six balls carrying exactly five distinct last digits, with the single repeated tail sitting in the strongest tail class (2) or the tetraphobia tail (4), at most one ball ending in 0 and a 1-1-1-2-1 decade spread.",
        specLine: [6, 12, 23, 34, 39, 42],
        panels: [5, 9, 18, 28],
        edge: "Matches the 43% five-tail mode",
        rules: [
            "Exactly five distinct last digits — one homologous pair.",
            "The repeated tail is 2 or 4; at most one ball ends in 0.",
            "Decade spread 1-1-1-2-1 across the five decades.",
        ],
        math: "Players either repeat too many endings or force six different ones; the five-ending mode is what the draw actually produces.",
    },
    {
        id: "playslipAntiGeometry",
        name: "7×7 Playslip Anti-Geometry & Cross-Corner",
        description:
            "Harvests the cage geometry without the retail geometry. Two cells from playslip column 4, one high corner, and three balls off both main diagonals — with no row and no column holding more than two marks.",
        specLine: [11, 20, 34, 39, 41, 43],
        panels: [2, 9, 30, 38],
        edge: "Captures the 160.8% cross rate and avoids the slashes",
        rules: [
            "Two balls from playslip column 4 (04, 11, 18, 32, 39, 46), never row 4.",
            "One high corner, 43 or 49.",
            "The other three balls off both main diagonals; no row or column over two marks.",
        ],
        math: "The centre cross and the corners hit above chance while the diagonals underperform — and diagonals are exactly where retail tickets cluster.",
    },
];

const RULES = { ...RULES_A, ...RULES_B };

const main = async () => {
    const draws = JSON.parse(await readFile(`${DATA_DIR}draws.json`, "utf8"));
    const league = JSON.parse(await readFile(`${DATA_DIR}strategies.json`, "utf8"));

    const expectedHits = league.meta?.chance?.expectedHitsPerLine;
    if (typeof expectedHits !== "number") throw new Error("strategies.json: meta.chance.expectedHitsPerLine missing");

    const era = filterEra(draws);
    if (era.length < FOLDS + 1) throw new Error(`era too short for ${FOLDS} folds: ${era.length}`);
    const foldStart = era.length - FOLDS;
    const nextDrawNo = era[era.length - 1].draw + 1;
    const nextTarget = { draw: nextDrawNo, date: nextDrawDateIso(era[era.length - 1].date) };

    for (const strategy of GAMBLER_STRATEGIES) {
        if (typeof RULES[strategy.id] !== "function") throw new Error(`${strategy.id}: missing rule`);
    }

    // The fold statistics (velocity, pair counts, skips) are computed once per
    // fold, never once per attempt.
    const prepare = (prior, target) => buildFoldStats(prior, target);

    const newRows = GAMBLER_STRATEGIES.map((strategy) =>
        evaluateStrategy(
            {
                id: strategy.id,
                name: strategy.name,
                family: "Gambler",
                description: strategy.description,
                rule: (prior, target, rng, stats) => RULES[strategy.id](prior, target, rng, stats),
            },
            era,
            foldStart,
            expectedHits,
            { prepare, nextTarget },
        ),
    );

    // Merge: drop placeholder litter, upsert the 10 gambler rows, keep the rest.
    const kept = league.strategies.filter((row) => !isPlaceholderRow(row));
    const purged = league.strategies.length - kept.length;
    const byId = new Map(kept.map((row) => [row.id, row]));
    for (const row of newRows) byId.set(row.id, row);

    const ranked = [...byId.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    ranked.forEach((row, i) => {
        row.rank = i + 1;
    });
    league.strategies = ranked;

    if (!league.meta.families.includes("Gambler")) {
        league.meta.families = [...league.meta.families, "Gambler"].sort((a, b) => a.localeCompare(b));
    }
    league.meta.generatedAt = new Date(Date.now() + 8 * 3600e3).toISOString().replace("Z", "+08:00");
    league.meta.nextDraw = nextDrawNo;

    await writeFile(`${DATA_DIR}strategies.json`, JSON.stringify(league, 1), "utf8");

    const playbook = {
        meta: {
            generatedAt: league.meta.generatedAt,
            nextDraw: nextDrawNo,
            source: "toto_10_gambler_strategies.docx",
            folds: FOLDS,
        },
        strategies: GAMBLER_STRATEGIES.map((strategy, index) => ({
            index: index + 1,
            id: strategy.id,
            name: strategy.name,
            family: "Gambler",
            description: strategy.description,
            specLine: strategy.specLine,
            panels: strategy.panels,
            edge: strategy.edge,
            rules: strategy.rules,
            math: strategy.math,
        })),
    };
    await writeFile(`${DATA_DIR}gambler-playbook.json`, JSON.stringify(playbook, 1), "utf8");

    console.log(
        "id".padEnd(20) +
            "pick".padEnd(18) +
            "ev".padStart(3) +
            "hits".padStart(5) +
            "prizes".padStart(7) +
            "z".padStart(6) +
            "score".padStart(7) +
            "rank".padStart(5),
    );
    for (const row of newRows) {
        console.log(
            row.id.padEnd(20) +
                row.currentPick.map((n) => String(n).padStart(2, "0")).join(" ").padEnd(18) +
                String(row.evaluatedDraws).padStart(3) +
                String(row.totalHits).padStart(5) +
                String(row.totalPrizes).padStart(7) +
                String(row.zScore).padStart(6) +
                String(row.score).padStart(7) +
                String(row.rank).padStart(5),
        );
    }
    console.log(
        `\n${newRows.length} gambler strategies (removed ${purged} placeholder rows), league size ${league.strategies.length}, nextDraw ${nextDrawNo}.`,
    );
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
