// Byte-validation of the JS PCG64 stream port against the python engine's
// ACTUAL line functions (S.line26 for every registered champion) at 160
// random folds. Any mismatch = the port is wrong. Run:
//   node scripts/streampick-validate.mjs
import { readFile } from "node:fs/promises";
import { STREAMPICK_FAMILY } from "../scripts/lib/streampick-rules.mjs";

const cases = JSON.parse(
    await readFile(
        "/Users/dev/.hermes/profiles/buddy/scripts/toto/data/toto/pcg64_validation2.json",
        "utf8",
    ),
);
let pass = 0;
let fail = 0;
for (const c of cases) {
    const rule = STREAMPICK_FAMILY.rules[c.engine];
    const line = rule([], { draw: c.t + 2995 });
    if (JSON.stringify(line) === JSON.stringify(c.line)) pass += 1;
    else {
        fail += 1;
        if (fail <= 3) console.log(`MISMATCH ${c.engine} t${c.t}\n  js ${line}\n  py ${c.line}`);
    }
}
console.log(`streamLine vs python engine: ${pass}/${pass + fail} exact`);
process.exit(fail ? 1 : 0);
