import assert from "node:assert/strict";

import {
  createAutoMovieProductionObligationClaim,
  createAutoMovieProductionPrincipleClaim,
} from "../src/createAutoMovieProductionContractClaim";

/**
 * Production-local contract helpers preserve the graph's two cardinalities.
 *
 * Scenarios:
 *
 * 1. A reviewed principle over H2 and H3 hosts becomes one no-exclusion
 *    checklist reference per contract document with review required.
 * 2. An evidence-stage obligation becomes ordinary no-exclusion H2 population
 *    coverage rather than a checklist.
 * 3. Draft, disabled, and explicitly inapplicable hosts keep their local claim
 *    declared but disabled.
 * 4. Blank names, empty or purely negative populations, blank patterns, and an
 *    invalid runtime stage fail before a malformed claim reaches the graph.
 */
const principle = createAutoMovieProductionPrincipleClaim({
  name: "  every screenplay unit preserves the work's local visual grammar  ",
  document: [
    "contracts/principles-visual-grammar.md",
    "contracts/principles-dialogue-register.md",
  ],
  files: ["screenplays/**/*.md"],
  symbol: ["h2", "h3"],
  stage: "review",
});
assert.deepEqual(principle, {
  name: "every screenplay unit preserves the work's local visual grammar",
  type: "markdown",
  root: "docs",
  files: ["screenplays/**/*.md"],
  symbol: ["h2", "h3"],
  disabled: false,
  reference: [
    {
      type: "markdown",
      root: "docs",
      files: ["contracts/principles-visual-grammar.md"],
      symbol: "h2",
      checklist: true,
      noEvidenceExclude: true,
      requireReview: true,
    },
    {
      type: "markdown",
      root: "docs",
      files: ["contracts/principles-dialogue-register.md"],
      symbol: "h2",
      checklist: true,
      noEvidenceExclude: true,
      requireReview: true,
    },
  ],
});

const obligation = createAutoMovieProductionObligationClaim({
  name: "the settings population establishes the local delivery roles",
  document: "delivery-roles.md",
  documentRoot: "docs/contracts",
  files: ["settings/**/*.md"],
  symbol: "h2",
  stage: "evidence",
});
assert.deepEqual(obligation, {
  name: "the settings population establishes the local delivery roles",
  type: "markdown",
  root: "docs",
  files: ["settings/**/*.md"],
  symbol: "h2",
  disabled: false,
  reference: [
    {
      type: "markdown",
      root: "docs/contracts",
      files: ["delivery-roles.md"],
      symbol: "h2",
      noEvidenceExclude: true,
      requireReview: false,
    },
  ],
});

for (const stage of ["disabled", "draft"] as const)
  assert.equal(
    createAutoMovieProductionPrincipleClaim({
      name: `${stage} local principle`,
      document: "contracts/principles-local.md",
      files: ["models/**/*.md"],
      stage,
    }).disabled,
    true,
  );
assert.equal(
  createAutoMovieProductionObligationClaim({
    name: "scope-inapplicable local obligation",
    document: "contracts/obligations-scale.md",
    files: ["spaces/**/*.md"],
    stage: "review",
    inapplicable: true,
  }).disabled,
  true,
);

const base = {
  name: "local contract",
  document: "contracts/local.md",
  files: ["settings/**/*.md"],
  stage: "evidence" as const,
};
assert.throws(
  () => createAutoMovieProductionPrincipleClaim({ ...base, name: "  " }),
  /requires a name/u,
);
assert.throws(
  () =>
    createAutoMovieProductionPrincipleClaim({
      ...base,
      files: [],
    }),
  /positive host population/u,
);
assert.throws(
  () =>
    createAutoMovieProductionPrincipleClaim({
      ...base,
      files: ["!settings/private.md"],
    }),
  /positive host population/u,
);
assert.throws(
  () =>
    createAutoMovieProductionPrincipleClaim({
      ...base,
      files: ["settings/**/*.md", "  "],
    }),
  /host population contains a blank pattern/u,
);
assert.throws(
  () =>
    createAutoMovieProductionObligationClaim({
      ...base,
      document: [],
    }),
  /positive contract population/u,
);
assert.throws(
  () =>
    createAutoMovieProductionObligationClaim({
      ...base,
      document: ["contracts/local.md", ""],
    }),
  /contract population contains a blank pattern/u,
);
assert.throws(
  () =>
    createAutoMovieProductionObligationClaim({
      ...base,
      stage: "complete",
    } as unknown as Parameters<
      typeof createAutoMovieProductionObligationClaim
    >[0]),
  /unsupported host stage "complete"/u,
);

process.stdout.write("production-local contract claim helpers passed\n");
