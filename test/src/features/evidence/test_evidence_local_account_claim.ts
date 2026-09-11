import {
  type AutoMoviePopulationScope,
  type AutoMovieProductionContractClaim,
  type IAutoMovieProductionObligationClaimProps,
  createAutoMovieAuthoredPopulationFiles,
  createAutoMoviePopulationAccountClaims,
  createAutoMovieProductionObligationClaim,
  createAutoMovieProductionPrincipleClaim,
  createBlankAutoMovieProductionEvidence,
  validateAutoMovieLocalContractClaims,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

type ITtscEvidenceGraphMarkdownReference = Extract<
  Exclude<AutoMovieProductionContractClaim["reference"], unknown[]>,
  { type: "markdown" }
>;

/**
 * A local obligation is covered by relevant H2s in the complete layer, while
 * principles keep their per-unit checklist. Only AutoMovie's configuration
 * output is examined; native evidence evaluation is outside this unit.
 *
 * Scenarios:
 * 1. An obligation emits ordinary coverage over authored and aggregate owners.
 * 2. Every stage controls activation and review, including a pilot exclusion.
 * 3. Film pilot, complete scope, reset, and other authored layers use their
 *    actual canonical file populations rather than caller-selected subsets.
 * 4. Missing, cross-layer, non-normalized, plural, and legacy account inputs
 *    are refused; the alternate flat contract root remains valid.
 * 5. Shared accounts retain family order, ownership, and their input failures.
 * 6. The obligation reference is an explicit error, and canonical admission
 *    refuses claim-level overrides or a weakened target reference.
 */
export const test_evidence_local_account_claim = (): void => {
  const props: IAutoMovieProductionObligationClaimProps = {
    name: "  model population answers its local obligation  ",
    document: "contracts/obligations-models.md",
    account: "accounts/models/local-obligations.md",
    layer: "models",
    stage: "evidence",
    populationScope: { mode: "complete-production" },
  };
  const claim = createAutoMovieProductionObligationClaim(props);
  TestValidator.equals("eligible owners", claim.files, [
    props.account,
    "models/**/*.md",
  ]);
  TestValidator.equals("trimmed diagnostic", claim.name, props.name.trim());
  TestValidator.equals("H2 account owner", claim.symbol, "h2");
  TestValidator.equals("ordinary obligation coverage", claim.reference, [
    {
      type: "markdown",
      severity: "error",
      root: "docs",
      files: [props.document],
      symbol: "h2",
      noEvidenceExclude: true,
      requireReview: false,
    },
  ]);
  const accountGraph = {
    ...createBlankAutoMovieProductionEvidence("/production", "english"),
    models: props.stage,
    claims: [claim],
  };
  validateAutoMovieLocalContractClaims(accountGraph);
  validateAutoMovieLocalContractClaims({
    ...accountGraph,
    claims: [{ ...claim, severity: undefined }],
  });
  for (const severity of ["off", 0, "warning", "error", 2] as const)
    TestValidator.error("canonical claim severity cannot be overridden", () =>
      validateAutoMovieLocalContractClaims({
        ...accountGraph,
        claims: [{ ...claim, severity }],
      }),
    );
  const accountReferences =
    claim.reference as ITtscEvidenceGraphMarkdownReference[];
  TestValidator.equals(
    "account reference levels are explicit",
    accountReferences.map((reference) => reference.severity),
    ["error"],
  );
  TestValidator.error("canonical obligation reference cannot be weakened", () =>
    validateAutoMovieLocalContractClaims({
      ...accountGraph,
      claims: [
        {
          ...claim,
          reference: [{ ...accountReferences[0]!, severity: "warning" }],
        },
      ],
    }),
  );
  for (const stage of ["disabled", "draft", "evidence", "review"] as const) {
    const staged = createAutoMovieProductionObligationClaim({
      ...props,
      stage,
    });
    TestValidator.equals(
      `${stage} activation`,
      staged.disabled,
      stage === "disabled" || stage === "draft",
    );
    TestValidator.equals(
      `${stage} review`,
      (staged.reference as ITtscEvidenceGraphMarkdownReference[]).map(
        (reference) => reference.requireReview,
      ),
      [stage === "review"],
    );
  }
  const pilot: AutoMoviePopulationScope = {
    mode: "first-pilot",
    partitionGroup: "001-opening",
  };
  const script = createAutoMovieProductionObligationClaim({
    ...props,
    layer: "scripts",
    account: "accounts/scripts/local.md",
    stage: "review",
    populationScope: pilot,
    inapplicable: true,
  });
  TestValidator.equals(
    "explicit pilot-only audit",
    script.autoMovieBinding.disposition,
    "inapplicable",
  );
  TestValidator.equals("pilot audit disabled", script.disabled, true);
  TestValidator.equals("pilot denominator retained", script.files.slice(1), [
    "scripts/001-opening/???-*.md",
  ]);
  const reset: AutoMoviePopulationScope = {
    mode: "complete-production-reset",
    owner: "author",
    transition: {
      version: 1,
      kind: "film",
      productionLocation: "/production",
      owner: "author",
      pilotScope: pilot as {
        mode: "first-pilot";
        partitionGroup: "001-opening";
      },
      reviewedBranches: ["treatments", "scripts", "screenplays"],
      retainedHosts: [],
    },
  };
  TestValidator.equals(
    "flat treatments",
    createAutoMovieAuthoredPopulationFiles("treatments", pilot),
    ["treatments/???-*.md"],
  );
  TestValidator.equals(
    "reset complete denominator",
    createAutoMovieAuthoredPopulationFiles("scripts", reset),
    ["scripts/*/???-*.md"],
  );
  TestValidator.equals(
    "complete screenplay",
    createAutoMovieAuthoredPopulationFiles(
      "screenplays",
      props.populationScope,
    ),
    ["screenplays/*/???-*.md"],
  );
  TestValidator.equals(
    "design library pilot",
    createAutoMovieAuthoredPopulationFiles("models", { mode: "first-pilot" }),
    ["models/**/*.md"],
  );
  const alternate = createAutoMovieProductionObligationClaim({
    ...props,
    documentRoot: "docs/contracts",
    document: "obligations-models.md",
  });
  TestValidator.equals(
    "alternate root retained",
    (alternate.reference as ITtscEvidenceGraphMarkdownReference[])[0]!.root,
    "docs/contracts",
  );
  const resetClaim = createAutoMovieProductionObligationClaim({
    ...props,
    stage: "draft",
    populationScope: reset,
  });
  TestValidator.equals(
    "reset is inactive editable material",
    resetClaim.disabled,
    true,
  );
  for (const invalid of [
    { account: undefined },
    { account: "models/local.md" },
    { account: "accounts/spaces/local.md" },
    { account: "accounts/models/nested/local.md" },
    { account: "accounts\\models\\local.md" },
    { account: "accounts/models/../local.md" },
    { document: [props.document] },
    { name: " " },
    { stage: "ready" },
    { layer: "unknown", account: "accounts/unknown/local.md" },
    { inapplicable: true },
    { inapplicable: true, populationScope: reset },
    { document: "contracts/index.md" },
    { document: "contracts/nested/local.md" },
    { documentRoot: "docs\\contracts", document: "local.md" },
    { document: "../contracts/local.md" },
    { documentRoot: "/docs" },
    { documentRoot: "C:/docs" },
    { document: "contracts/*.md" },
  ])
    TestValidator.error("invalid local account declaration", () =>
      createAutoMovieProductionObligationClaim({
        ...props,
        ...invalid,
      } as IAutoMovieProductionObligationClaimProps),
    );
  const principle = createAutoMovieProductionPrincipleClaim({
    ...props,
    files: ["models/**/*.md", "!models/unused.md"],
    symbol: ["h2", "h3", "h4"],
    document: [props.document, "contracts/second.md"],
    stage: "review",
  });
  TestValidator.equals("principles retain authored hosts", principle.files, [
    "models/**/*.md",
    "!models/unused.md",
  ]);
  TestValidator.equals(
    "principles stay independent checklists",
    (principle.reference as ITtscEvidenceGraphMarkdownReference[]).map(
      (reference) => [
        reference.checklist,
        reference.noEvidenceExclude,
        reference.requireReview,
      ],
    ),
    [
      [true, true, true],
      [true, true, true],
    ],
  );
  createAutoMovieProductionPrincipleClaim({
    ...props,
    files: ["models/a.md"],
    symbol: "h2",
  });
  for (const symbol of [[], ["h1"], "file"])
    TestValidator.error("principle excludes ungoverned symbols", () =>
      createAutoMovieProductionPrincipleClaim({
        ...props,
        files: ["models/a.md"],
        symbol: symbol as "h2",
      }),
    );
  const sharedProps = {
    layer: "models",
    populationFiles: ["models/**/*.md"],
    obligationFiles: [
      "obligations/core/common.md",
      "language/obligations/common.md",
    ],
    enabled: true,
    requireReview: true,
  };
  const shared = createAutoMoviePopulationAccountClaims(sharedProps);
  TestValidator.equals(
    "shared family identity and order",
    shared.map((value) => value.files),
    [
      ["accounts/models/core-common.md", "models/**/*.md"],
      ["accounts/models/language-obligations-common.md", "models/**/*.md"],
    ],
  );
  TestValidator.equals(
    "empty shared family",
    createAutoMoviePopulationAccountClaims({
      ...sharedProps,
      obligationFiles: [],
    }),
    [],
  );
  for (const invalid of [
    { layer: "../models" },
    { populationFiles: [] },
    { populationFiles: ["spaces/a.md"] },
    { populationFiles: ["models/a.md", "models/a.md"] },
    { obligationFiles: ["contracts/local.md"] },
    {
      obligationFiles: [
        "obligations/core/common.md",
        "obligations/core/common.md",
      ],
    },
  ])
    TestValidator.error("invalid shared account inputs", () =>
      createAutoMoviePopulationAccountClaims({ ...sharedProps, ...invalid }),
    );
};
