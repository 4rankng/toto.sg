// toto.sg — the family registry: every strategy family the league evaluates.
//
// Adding a family is exactly three touches: create scripts/lib/<x>-rules.mjs
// (npm run league:new scaffolds it), add one import here, add one entry to
// BASE_FAMILIES or PHASE2_FAMILIES. Nothing else in the pipeline changes —
// league-build derives every spec from this registry.
//
// Phase 1 (BASE_FAMILIES) runs first; phase 2 (PHASE2_FAMILIES) runs after
// every base rule has produced its fold line, because those rules read the
// league's own per-ball fold vote.
import { CURATED_FAMILY } from "./curated-rules.mjs";
import { GENERATOR_FAMILY } from "./generator-rules.mjs";
import { HUNTER_FAMILY } from "./hunter-rules.mjs";
import { DESK_FAMILY } from "./desk-rules.mjs";
import { MATCHRATE_FAMILY } from "./matchrate-rules.mjs";
import { INDICATOR_FAMILY } from "./indicator-rules.mjs";
import { CATALOG_SIGNAL_FAMILY } from "./catalog-signal-rules.mjs";
import { CATALOG_STRUCTURE_FAMILY } from "./catalog-structure-rules.mjs";
import { CATALOG_ALMANAC_FAMILY } from "./catalog-almanac-rules.mjs";
import { CATALOG_ML_FAMILY, META_VOTE_FAMILY } from "./catalog-ml-rules.mjs";
import { SEQUENCE_DYNAMICS_FAMILY } from "./sequence-dynamics-rules.mjs";
import { SKIPGATE_FAMILY } from "./skipgate-rules.mjs";
import { INSIGHT_FUSION_FAMILY } from "./insight-fusion-rules.mjs";
import { CROSS_PANEL_FAMILY } from "./cross-panel-rules.mjs";
import { FUSION_CONSENSUS_FAMILY } from "./insight-fusion-rules.mjs";

/** Phase-1 families: every fold is graded as it is produced. */
export const BASE_FAMILIES = [
    CURATED_FAMILY,
    GENERATOR_FAMILY,
    HUNTER_FAMILY,
    DESK_FAMILY,
    MATCHRATE_FAMILY,
    INDICATOR_FAMILY,
    CATALOG_SIGNAL_FAMILY,
    CATALOG_STRUCTURE_FAMILY,
    CATALOG_ALMANAC_FAMILY,
    CATALOG_ML_FAMILY,
    SEQUENCE_DYNAMICS_FAMILY,
    SKIPGATE_FAMILY,
    INSIGHT_FUSION_FAMILY,
];

/** Phase-2 families: they read the base league's assembled fold votes. */
export const PHASE2_FAMILIES = [CROSS_PANEL_FAMILY, META_VOTE_FAMILY, FUSION_CONSENSUS_FAMILY];
