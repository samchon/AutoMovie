import {
  createAutoMovieProductionObligationClaim,
  createAutoMovieProductionPrincipleClaim,
  createBlankAutoMovieProductionEvidence,
  validateAutoMovieEvidenceAccounts,
  validateAutoMoviePopulationAccountHosts,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Admission depends on declared ownership and supplied physical facts, never
 * on a file's presence alone or an operating-system fixture.
 *
 * Scenarios:
 * 1. One or several H2 obligations require the same number of account owners.
 * 2. Missing targets, missing files, empty or unequal owners, undeclared files,
 *    cross-layer paths, and duplicate targets/accounts fail at their identity.
 * 3. Draft and pilot audits retain declaration without demanding physical
 *    accounts; disabled layers refuse retained accounts.
 * 4. The production factory combines shared and local owners, admits a valid
 *    local extension, and refuses shared/local or special-owner collisions.
 */
export const test_evidence_local_account_admission = (): void => {
  const entry = {
    layer: "models",
    stage: "evidence" as const,
    account: "accounts/models/local.md",
    target: "docs/contracts/local.md",
    enabled: true,
  };
  const props = {
    accounts: [entry],
    residents: [entry.account],
    supplemental: [],
    readH2Count: (_file: string): number | undefined => 2,
  };
  validateAutoMoviePopulationAccountHosts(props);
  validateAutoMoviePopulationAccountHosts({ ...props, readH2Count: () => 1 });
  validateAutoMoviePopulationAccountHosts({
    ...props,
    accounts: [
      entry,
      {
        ...entry,
        account: "accounts/models/other.md",
        target: "docs/contracts/other.md",
      },
    ],
    residents: [entry.account, "accounts/models/other.md"],
  });
  for (const counts of [
    {},
    { ["docs/" + entry.account]: 1 },
    { ["docs/" + entry.account]: 0, [entry.target]: 1 },
    { ["docs/" + entry.account]: 2, [entry.target]: 1 },
    { ["docs/" + entry.account]: 1, [entry.target]: 2 },
    { ["docs/" + entry.account]: 0, [entry.target]: 0 },
  ])
    TestValidator.error("missing or mismatched account facts", () =>
      validateAutoMoviePopulationAccountHosts({
        ...props,
        readH2Count: (file) => (counts as Record<string, number>)[file],
      }),
    );
  for (const resident of [
    "accounts/models/undeclared.md",
    "accounts/spaces/local.md",
    "accounts/unknown/local.md",
    "accounts/local.md",
  ])
    TestValidator.error("undeclared physical account", () =>
      validateAutoMoviePopulationAccountHosts({
        ...props,
        residents: [resident],
      }),
    );
  TestValidator.error("duplicate file", () =>
    validateAutoMoviePopulationAccountHosts({
      ...props,
      accounts: [entry, entry],
    }),
  );
  TestValidator.error("duplicate target", () =>
    validateAutoMoviePopulationAccountHosts({
      ...props,
      accounts: [entry, { ...entry, account: "accounts/models/second.md" }],
    }),
  );
  TestValidator.error("reserved collision", () =>
    validateAutoMoviePopulationAccountHosts({
      ...props,
      supplemental: [{ file: entry.account, stage: "evidence" }],
    }),
  );
  TestValidator.error("disabled residue", () =>
    validateAutoMoviePopulationAccountHosts({
      ...props,
      accounts: [{ ...entry, enabled: false, stage: "disabled" }],
    }),
  );
  for (const stage of ["draft", "review"] as const)
    validateAutoMoviePopulationAccountHosts({
      ...props,
      accounts: [{ ...entry, enabled: false, stage }],
      residents: [],
      readH2Count: () => {
        throw new Error("An inactive claim must not demand a file.");
      },
    });
  validateAutoMoviePopulationAccountHosts({
    accounts: [],
    residents: [],
    supplemental: [],
    readH2Count: () => undefined,
  });
  const blank = createBlankAutoMovieProductionEvidence(
    "/production",
    "english",
  );
  const local = createAutoMovieProductionObligationClaim({
    name: "local model duty",
    account: entry.account,
    document: "contracts/local.md",
    layer: "models",
    stage: "evidence",
    populationScope: blank.populationScope,
  });
  const graph = {
    ...blank,
    kind: "library" as const,
    settings: "review" as const,
    models: "evidence" as const,
    claims: [
      local,
      createAutoMovieProductionPrincipleClaim({
        name: "principle",
        document: "contracts/principles.md",
        files: ["models/**/*.md"],
        symbol: "h2",
        layer: "models",
        stage: "evidence",
        populationScope: blank.populationScope,
      }),
      {
        type: "markdown" as const,
        files: ["models/**/*.md"],
        symbol: "h2" as const,
        reference: {
          type: "markdown" as const,
          files: ["contracts/native.md"],
          symbol: "h2" as const,
        },
      },
    ],
  };
  const read: string[] = [];
  validateAutoMovieEvidenceAccounts(graph, {
    residents: [entry.account],
    readH2Count: (file) => {
      read.push(file);
      return 1;
    },
  });
  TestValidator.predicate(
    "factory reads declared local owner",
    read.includes("docs/" + entry.account),
  );
  TestValidator.predicate(
    "factory reads local target",
    read.includes(entry.target),
  );
  TestValidator.predicate(
    "factory retains common owner",
    read.includes("docs/accounts/models/core-common.md"),
  );
  validateAutoMovieEvidenceAccounts(
    { ...blank, claims: undefined },
    {
      residents: [],
      readH2Count: () => {
        throw new Error("Blank project has no active account.");
      },
    },
  );
  const filmReads: string[] = [];
  validateAutoMovieEvidenceAccounts(
    { ...graph, kind: "film" },
    {
      residents: ["accounts/settings/story-subjects.md"],
      readH2Count: (file) => {
        filmReads.push(file);
        return 1;
      },
    },
  );
  TestValidator.equals(
    "film subject account is declared once",
    filmReads.filter(
      (file) => file === "docs/accounts/settings/story-subjects.md",
    ).length,
    1,
  );
  validateAutoMovieEvidenceAccounts(
    { ...blank, models: "draft", claims: [] },
    {
      residents: ["accounts/models/core-common.md"],
      readH2Count: () => {
        throw new Error("Draft accounts are not enforced.");
      },
    },
  );
  const pilot = {
    ...graph,
    populationScope: { mode: "first-pilot" as const },
    claims: [
      createAutoMovieProductionObligationClaim({
        name: "pilot audit",
        account: entry.account,
        document: "contracts/local.md",
        layer: "models",
        stage: "evidence",
        populationScope: { mode: "first-pilot" },
        inapplicable: true,
      }),
    ],
  };
  validateAutoMovieEvidenceAccounts(pilot, {
    residents: [],
    readH2Count: (file) =>
      file === entry.target || file === "docs/" + entry.account ? undefined : 1,
  });
  const collision = createAutoMovieProductionObligationClaim({
    name: "collision",
    account: "accounts/models/core-common.md",
    document: "contracts/local.md",
    layer: "models",
    stage: "evidence",
    populationScope: blank.populationScope,
  });
  TestValidator.error("factory shared/local collision", () =>
    validateAutoMovieEvidenceAccounts(
      { ...graph, claims: [collision] },
      { residents: [], readH2Count: () => 1 },
    ),
  );
  TestValidator.error("factory rejects undeclared account", () =>
    validateAutoMovieEvidenceAccounts(
      { ...graph, claims: [] },
      { residents: [entry.account], readH2Count: () => 1 },
    ),
  );
  const disabledCollision = createAutoMovieProductionObligationClaim({
    name: "reserved even before activation",
    account: "accounts/models/core-common.md",
    document: "contracts/local.md",
    layer: "models",
    stage: "disabled",
    populationScope: blank.populationScope,
  });
  TestValidator.error("disabled shared name stays reserved", () =>
    validateAutoMovieEvidenceAccounts(
      { ...blank, claims: [disabledCollision] },
      { residents: [], readH2Count: () => undefined },
    ),
  );
};
