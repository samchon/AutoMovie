import assert from "node:assert/strict";

import { createAutoMoviePopulationAccountClaims } from "../src/createAutoMoviePopulationAccountClaims";

const claims = createAutoMoviePopulationAccountClaims({
  layer: "treatments",
  populationFiles: ["treatments/*.md"],
  obligationFiles: [
    "obligations/core/common.md",
    "obligations/story/treatments.md",
  ],
  enabled: true,
  requireReview: true,
});
assert.equal(claims.length, 2);
assert.deepEqual(claims[0]!.files, ["accounts/treatments/core-common.md"]);
assert.equal(claims[0]!.disabled, false);
const references = claims[0]!.reference;
assert(Array.isArray(references));
assert.equal(references.length, 2);
assert.deepEqual(references[0], {
  type: "markdown",
  root: "docs",
  files: ["obligations/core/common.md"],
  symbol: "h2",
  noEvidenceExclude: true,
  uniqueEvidence: true,
  singleEvidencePerSymbol: true,
  requireReview: true,
});
assert.deepEqual(references[1], {
  type: "markdown",
  root: "docs",
  files: ["treatments/*.md"],
  symbol: "h2",
  checklist: true,
  noEvidenceExclude: true,
  requireReview: true,
});
assert.equal(
  createAutoMoviePopulationAccountClaims({
    layer: "settings",
    populationFiles: ["settings/**/*.md"],
    obligationFiles: ["obligations/core/settings.md"],
    enabled: false,
    requireReview: false,
  })[0]!.disabled,
  true,
);
assert.throws(
  () =>
    createAutoMoviePopulationAccountClaims({
      layer: "bad/layer",
      populationFiles: ["settings/**/*.md"],
      obligationFiles: [],
      enabled: true,
      requireReview: false,
    }),
  /Invalid population account layer/u,
);
assert.throws(
  () =>
    createAutoMoviePopulationAccountClaims({
      layer: "settings",
      populationFiles: [],
      obligationFiles: [],
      enabled: true,
      requireReview: false,
    }),
  /require authored H2 files/u,
);
assert.throws(
  () =>
    createAutoMoviePopulationAccountClaims({
      layer: "settings",
      populationFiles: ["settings/**/*.md"],
      obligationFiles: ["principles/core/common.md"],
      enabled: true,
      requireReview: false,
    }),
  /Invalid population obligation path/u,
);
assert.throws(
  () =>
    createAutoMoviePopulationAccountClaims({
      layer: "settings",
      populationFiles: ["settings/**/*.md"],
      obligationFiles: [
        "obligations/core/common.md",
        "obligations/core/common.md",
      ],
      enabled: true,
      requireReview: false,
    }),
  /repeats population obligation/u,
);
