import assert from "node:assert/strict";

import {
  createAutoMovieContractBindingManifest,
  createBlankAutoMovieProductionEvidence,
} from "../src";

/** The blank declaration is complete, explicit, and selects no graph branch. */
const blank = createBlankAutoMovieProductionEvidence(
  "/project",
  "english",
);
const entries = Object.entries(blank);
assert.equal(blank.location, "/project");
assert.equal(blank.language, "english");
assert.equal(blank.kind, null);
assert.deepEqual(blank.populationScope, { mode: "complete-production" });
assert.deepEqual(blank.claims, []);
assert.equal(
  entries.filter(([, value]) => value === "disabled").length,
  23,
);
assert.deepEqual(createAutoMovieContractBindingManifest(blank).branches, []);
assert.deepEqual(createAutoMovieContractBindingManifest(blank).bindings, []);
