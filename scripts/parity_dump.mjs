// Dump litNeuralLogit fold lines for parity-check folds.
import { readFile } from "node:fs/promises";
const draws = JSON.parse(await readFile("public/data/draws.json", "utf8"));
const era = draws.filter((d) => d.draw >= 2995).sort((a, b) => a.draw - b.draw);
const { LITERATURE_RULES } = await import("./lib/literature-rules.mjs");
const { rngFor } = await import("./lib/league-eval.mjs");
const folds = JSON.parse(await readFile("/tmp/parity_folds.json", "utf8"));
const out = {};
for (const i of folds) {
    const prior = era.slice(0, i);
    const rng = rngFor("litNeuralLogit", era[i].draw);
    out[i] = LITERATURE_RULES.litNeuralLogit(prior, { draw: era[i].draw, date: era[i].date }, rng);
}
console.log(JSON.stringify(out));
