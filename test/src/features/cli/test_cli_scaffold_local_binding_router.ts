import { renderAutoMovieProductionRouter } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * The router distinguishes contract targets from the account's compared population.
 *
 * Scenarios:
 * 1. An enforced account renders its dedicated host, contract and full population.
 * 2. Draft and first-pilot audit rows remain visible without claiming enforcement.
 * 3. Native error/warning and required/not-required/inherited review stay distinct.
 */
export const test_cli_scaffold_local_binding_router = (): void => {
  type Input = Parameters<typeof renderAutoMovieProductionRouter>[0];
  const account: Input["manifest"]["localBindings"][number] = {
    claim: "population account",
    layer: "models",
    stage: "review",
    enforced: true,
    populationScope: { mode: "first-pilot" },
    relationship: "distributed-coverage",
    host: {
      root: "docs",
      files: ["accounts/models/local.md", "models/**/*.md"],
      symbols: ["h2"],
    },
    targets: [{ root: "docs", files: ["contracts/local.md"], symbols: ["h2"] }],
    population: { root: "docs", files: ["models/**/*.md"], symbols: ["h2"] },
  };
  const binding: Input["manifest"]["bindings"][number] = {
    branch: "modelSources",
    claim: "rendered owner",
    stage: "review",
    enforced: true,
    relationship: "lineage",
    host: {
      root: ".",
      type: "typescript",
      files: ["src/models/**/*.ts"],
      symbols: ["property"],
    },
    target: {
      type: "population",
      root: "docs",
      files: ["models/**/*.md"],
      symbols: ["h2"],
    },
  };
  const text = renderAutoMovieProductionRouter({
    packageName: "local-contract",
    description: "",
    contracts: [],
    designOwners: [],
    manifest: {
      kind: "library",
      language: "english",
      populationScope: { mode: "first-pilot" },
      branches: [],
      localBindings: [
        account,
        {
          ...account,
          claim: "draft contract",
          stage: "draft",
          enforced: false,
          relationship: "checklist",
          population: undefined,
        },
      ],
      localAudits: [
        {
          ...account,
          claim: "pilot audit",
          enforced: false,
          population: undefined,
        },
      ],
      bindings: [
        { ...binding, severity: "error", requireReview: false },
        { ...binding, severity: "warning", requireReview: true },
        binding,
      ],
    },
  });
  for (const expected of [
    "Local binding `population account`",
    "host root `docs`, files `accounts/models/local.md`",
    "contract targets root `docs`, files `contracts/local.md`",
    "authored population root `docs`, files `models/**/*.md`",
    "`draft`, not enforced",
    "Local inapplicable audit `pilot audit`",
    "severity `error`, review not required",
    "severity `warning`, review required",
    "severity `inherited error`, review inherited",
    "get_index_of_layer",
    "npm run reference",
  ])
    TestValidator.predicate(expected, text.includes(expected));
  const draft = text
    .split("\n")
    .find((line) => line.includes("draft contract"))!;
  TestValidator.predicate(
    "plain checklist has no population invented",
    !draft.includes("authored population"),
  );
};
