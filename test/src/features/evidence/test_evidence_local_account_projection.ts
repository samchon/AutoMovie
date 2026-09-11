import {
  type AutoMovieProductionContractClaim,
  type IAutoMovieEvidenceConfigProps,
  createAutoMovieProductionObligationClaim,
  createAutoMovieProductionPrincipleClaim,
  createBlankAutoMovieProductionEvidence,
  projectAutoMovieLocalContractClaims,
  validateAutoMovieLocalContractClaims,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Local account metadata is a checked declaration, and its manifest keeps
 * contract addresses distinct from the authored population being compared.
 *
 * Scenarios:
 * 1. Positive account and principle bindings preserve exact host, target,
 *    stage, and population scope; native claims without metadata stay native.
 * 2. Pilot-only inapplicable accounts become audits without losing their
 *    denominator, while draft bindings remain visible and unenforced.
 * 3. Wrong type, layer, stage, scope, disposition, activation, target count,
 *    cardinality, host, and denominator are refused before projection.
 * 4. Legacy authored obligation metadata fails with a migration requirement.
 */
export const test_evidence_local_account_projection = (): void => {
  const blank = createBlankAutoMovieProductionEvidence(
    "/production",
    "english",
  );
  const props = {
    name: "local obligation",
    account: "accounts/models/local.md",
    document: "contracts/obligations-models.md",
    layer: "models" as const,
    stage: "review" as const,
    populationScope: blank.populationScope,
  };
  const account = createAutoMovieProductionObligationClaim(props);
  const principle = createAutoMovieProductionPrincipleClaim({
    ...props,
    name: "local principle",
    document: "contracts/principles-models.md",
    files: ["models/**/*.md"],
    symbol: ["h2", "h3", "h4"],
  });
  const native = {
    name: "native",
    type: "markdown" as const,
    files: ["models/**/*.md"],
    symbol: "h2" as const,
    reference: {
      type: "markdown" as const,
      files: ["contracts/native.md"],
      symbol: "h2" as const,
    },
  };
  const graph: IAutoMovieEvidenceConfigProps = {
    ...blank,
    models: "review",
    claims: [account, principle, native],
  };
  validateAutoMovieLocalContractClaims(graph);
  validateAutoMovieLocalContractClaims({ ...blank, claims: undefined });
  const projected = projectAutoMovieLocalContractClaims(graph.claims!);
  TestValidator.equals(
    "only typed bindings projected",
    projected.localBindings.length,
    2,
  );
  TestValidator.equals("account projection", projected.localBindings[0], {
    claim: props.name,
    layer: "models",
    stage: "review",
    enforced: true,
    populationScope: blank.populationScope,
    relationship: "distributed-coverage",
    host: {
      root: "docs",
      files: [props.account, "models/**/*.md"],
      symbols: ["h2"],
    },
    targets: [{ root: "docs", files: [props.document], symbols: ["h2"] }],
    population: { root: "docs", files: ["models/**/*.md"], symbols: ["h2"] },
  });
  TestValidator.equals(
    "principle host symbols preserved",
    projected.localBindings[1]!.host.symbols,
    ["h2", "h3", "h4"],
  );
  TestValidator.equals(
    "aggregate projection preserves native defaults",
    projectAutoMovieLocalContractClaims([
      { ...account, root: undefined, symbol: undefined },
    ]).localBindings[0]!.population,
    { root: ".", files: ["models/**/*.md"], symbols: [] },
  );
  TestValidator.equals(
    "principle has no compared population",
    projected.localBindings[1]!.population,
    undefined,
  );
  TestValidator.equals(
    "positive bindings do not create audits",
    projected.localAudits,
    [],
  );
  const scope = { mode: "first-pilot" as const };
  const audit = createAutoMovieProductionObligationClaim({
    ...props,
    populationScope: scope,
    inapplicable: true,
  });
  validateAutoMovieLocalContractClaims({
    ...graph,
    populationScope: scope,
    claims: [audit],
  });
  const audits = projectAutoMovieLocalContractClaims([audit]);
  TestValidator.equals("pilot audit only", audits.localBindings, []);
  TestValidator.equals(
    "audit retains denominator",
    audits.localAudits[0]!.population?.files,
    ["models/**/*.md"],
  );
  TestValidator.equals(
    "audit does not enforce",
    audits.localAudits[0]!.enforced,
    false,
  );
  const draft = createAutoMovieProductionObligationClaim({
    ...props,
    stage: "draft",
  });
  validateAutoMovieLocalContractClaims({
    ...graph,
    models: "draft",
    claims: [draft],
  });
  const disabled = createAutoMovieProductionObligationClaim({
    ...props,
    stage: "disabled",
  });
  validateAutoMovieLocalContractClaims({ ...blank, claims: [disabled] });
  const mixedReferences = {
    ...principle,
    reference: [
      ...(Array.isArray(principle.reference)
        ? principle.reference
        : [principle.reference]),
      {
        type: "typescript" as const,
        files: ["src/constraints.ts"],
        symbol: "type" as const,
      },
    ],
  };
  validateAutoMovieLocalContractClaims({ ...graph, claims: [mixedReferences] });
  TestValidator.equals(
    "non-Markdown references do not become local contract targets",
    projectAutoMovieLocalContractClaims([mixedReferences]).localBindings[0]!
      .targets.length,
    1,
  );
  TestValidator.equals(
    "draft remains declared",
    projectAutoMovieLocalContractClaims([draft]).localBindings[0]!.enforced,
    false,
  );
  const references = Array.isArray(account.reference)
    ? account.reference
    : [account.reference];
  for (const broken of [
    { ...account, type: "typescript" },
    { ...account, autoMovieBinding: null },
    { ...account, autoMovieBinding: "models" },
    {
      ...account,
      autoMovieBinding: { ...account.autoMovieBinding, layer: "missing" },
    },
    {
      ...account,
      autoMovieBinding: { ...account.autoMovieBinding, stage: "draft" },
    },
    {
      ...account,
      autoMovieBinding: { ...account.autoMovieBinding, populationScope: scope },
    },
    {
      ...account,
      autoMovieBinding: { ...account.autoMovieBinding, disposition: "other" },
    },
    { ...account, disabled: true },
    {
      ...account,
      disabled: true,
      autoMovieBinding: {
        ...account.autoMovieBinding,
        disposition: "inapplicable",
      },
    },
    { ...account, reference: [] },
    { ...account, reference: { type: "typescript", files: ["src/a.ts"] } },
    { ...account, reference: [{ ...references[0], files: [] }] },
    {
      ...account,
      reference: [
        { ...references[0], files: [props.document, "contracts/second.md"] },
      ],
    },
    {
      ...account,
      reference: [{ ...references[0], checklist: true }],
    },
    {
      ...account,
      files: [props.account, "models/one.md"],
    },
    { ...account, files: ["accounts/models/other.md"] },
    { ...account, symbol: "h3" },
    { ...account, root: "." },
    { ...account, name: undefined },
    {
      ...account,
      autoMovieBinding: { ...account.autoMovieBinding, account: undefined },
    },
  ])
    TestValidator.error("detached or weakened account", () =>
      validateAutoMovieLocalContractClaims({
        ...graph,
        claims: [broken as AutoMovieProductionContractClaim],
      }),
    );
  const scalar = {
    ...principle,
    name: undefined,
    root: undefined,
    symbol: undefined,
    reference: {
      type: "markdown" as const,
      files: ["contracts/principles-models.md"],
      checklist: true,
      symbol: undefined,
    },
  };
  validateAutoMovieLocalContractClaims({ ...graph, claims: [scalar] });
  TestValidator.equals(
    "native defaults remain explicit in projection",
    projectAutoMovieLocalContractClaims([scalar]).localBindings[0],
    {
      claim: "",
      layer: "models",
      stage: "review",
      enforced: true,
      populationScope: blank.populationScope,
      relationship: "checklist",
      host: { root: ".", files: ["models/**/*.md"], symbols: [] },
      targets: [
        { root: ".", files: ["contracts/principles-models.md"], symbols: [] },
      ],
    },
  );
};
