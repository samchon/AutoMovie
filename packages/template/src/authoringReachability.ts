/**
 * Production shapes whose authoring routes are published by the scaffold.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Keeps the shape selector inside the same public route inventory the author queries.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Types the closed shape dimension of every capability row.
 */
export type AutoMovieAuthoringProductionKind = "film" | "brief" | "library";

/**
 * Closed camera-action vocabulary consumed by the shot compiler.
 *
 * @evidence requirements/product/authorability.md#product-explicit-control Gives the author the exact executable camera literals instead of broader film terminology.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Publishes the compiler-supported camera choices through the authoring route.
 */
export const AUTO_MOVIE_CAMERA_ACTIONS = [
  "static",
  "follow",
  "orbit",
  "push-in",
  "truck",
  "whip",
] as const;

/**
 * One public capability's complete route from author decision to consumer.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Carries the fields needed to prove that a capability is reachable.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Distinguishes a complete route from a truthful inapplicability reason.
 */
export interface IAutoMovieAuthoringReachabilityRow {
  capability:
    | "settings"
    | "design-branches"
    | "production-design"
    | "production-sources"
    | "film-sources"
    | "external-motions"
    | "acceptance"
    | "examples"
    | "camera-actions";
  consumer: string | null;
  inapplicableReason: string | null;
  kind: AutoMovieAuthoringProductionKind;
  owner: string | null;
  route: string | null;
  serializer: string | null;
}

const applicable = (
  kind: AutoMovieAuthoringProductionKind,
  capability: IAutoMovieAuthoringReachabilityRow["capability"],
  owner: string,
  serializer: string,
  consumer: string,
  route: string,
): IAutoMovieAuthoringReachabilityRow => ({
  capability,
  consumer,
  inapplicableReason: null,
  kind,
  owner,
  route,
  serializer,
});

const inapplicable = (
  kind: AutoMovieAuthoringProductionKind,
  capability: IAutoMovieAuthoringReachabilityRow["capability"],
  reason: string,
): IAutoMovieAuthoringReachabilityRow => ({
  capability,
  consumer: null,
  inapplicableReason: reason,
  kind,
  owner: null,
  route: null,
  serializer: null,
});

const shared = (
  kind: AutoMovieAuthoringProductionKind,
): IAutoMovieAuthoringReachabilityRow[] => [
  applicable(
    kind,
    "settings",
    "docs/settings",
    "Markdown evidence hosts",
    "@automovie/evidence production graph",
    ".agents/skills/production-lifecycle/settings.md",
  ),
  applicable(
    kind,
    "design-branches",
    "docs/{maps,models,spaces,materials,instances,motions,systems}",
    "production-owned scripts/emitDesign.ts",
    "AutoMovieProductionCompiler source scope",
    ".agents/skills/source-authoring/design-branches.md",
  ),
  applicable(
    kind,
    "production-design",
    "reviewed production source",
    "AutoMovieProductionProject design setters",
    "AutoMovieProductionCompiler",
    ".agents/skills/production-lifecycle/configuration.md",
  ),
  applicable(
    kind,
    "production-sources",
    "reviewed production source exports",
    "source-owner binding manifest",
    "AutoMovieProductionCompiler",
    ".agents/skills/source-authoring/compilation.md",
  ),
  applicable(
    kind,
    "external-motions",
    "production design externalMotions",
    "inspect-external plus explicit adoption receipt",
    "AutoMovieProductionCompiler external motion admission",
    ".agents/skills/source-authoring/models-and-motions.md",
  ),
  applicable(
    kind,
    "acceptance",
    "authored acceptance and review evidence",
    "evidence graph and production design",
    "review-scope compiler and final verifier",
    ".agents/skills/review-verification/review.md",
  ),
  applicable(
    kind,
    "examples",
    "packages/template/scaffold/src/examples",
    "typed TypeScript exports",
    "production-owned source imports",
    ".agents/skills/source-authoring/SKILL.md",
  ),
];

/**
 * Canonical production-kind capability matrix shipped to every author.
 *
 * @evidence requirements/product/authorability.md#product-discoverable-control Makes every supported capability reachable through a named author route rather than package archaeology.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery Publishes owner, serializer, consumer, and truthful inapplicability as one typed answer.
 */
export const AUTO_MOVIE_AUTHORING_REACHABILITY: readonly IAutoMovieAuthoringReachabilityRow[] =
  (["film", "brief", "library"] as const).flatMap((kind) => [
    ...shared(kind),
    ...(kind === "library"
      ? [
          inapplicable(
            kind,
            "film-sources",
            "A library has no timed edit or film-source population.",
          ),
          inapplicable(
            kind,
            "camera-actions",
            "A library has no shot camera; neutral inspection owns its views.",
          ),
        ]
      : [
          applicable(
            kind,
            "film-sources",
            kind === "film" ? "reviewed screenplays" : "reviewed briefs",
            "production-owned shot and film source exports",
            "AutoMovieProductionCompiler edit assembly",
            kind === "film"
              ? ".agents/skills/production-lifecycle/screenplays.md"
              : ".agents/skills/production-lifecycle/briefs.md",
          ),
          applicable(
            kind,
            "camera-actions",
            "shot source frame actions",
            "IAutoMovieActionCall frame move",
            "compileCameraMove",
            ".agents/skills/source-authoring/cinematography.md",
          ),
        ]),
  ]);

/**
 * Reject a capability matrix that hides a missing route as applicability.
 *
 * @evidence requirements/product/authorability.md#product-hidden-inference-refusal Refuses rows whose missing owner or consumer would force the author to guess.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure Returns stable, located route diagnostics.
 */
export const inspectAutoMovieAuthoringReachability = (
  rows: readonly IAutoMovieAuthoringReachabilityRow[],
): string[] => {
  const findings: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.kind}:${row.capability}`;
    if (seen.has(key)) findings.push(`${key} is duplicated.`);
    seen.add(key);
    if (row.inapplicableReason === null) {
      for (const [field, value] of [
        ["owner", row.owner],
        ["serializer", row.serializer],
        ["consumer", row.consumer],
        ["route", row.route],
      ] as const)
        if (value === null || value.trim().length === 0)
          findings.push(`${key} has no ${field}.`);
    } else {
      if (row.inapplicableReason.trim().length === 0)
        findings.push(`${key} has a blank inapplicable reason.`);
      if (
        row.owner !== null ||
        row.serializer !== null ||
        row.consumer !== null ||
        row.route !== null
      )
        findings.push(`${key} mixes an inapplicable reason with a route.`);
    }
  }
  return findings;
};
