import type {
  ITtscEvidenceGraphClaim,
  ITtscEvidenceGraphMarkdownReference,
  ITtscEvidenceGraphReference,
} from "@ttsc/evidence";

import type { AutoMovieAuthoredDocumentLayer } from "./AutoMovieAuthoredDocumentLayer";
import type { AutoMovieProductionKind } from "./createAutoMovieEvidenceConfig";

/**
 * Selects shared contracts by the work an authored layer actually produces.
 *
 * Prose composition and language style govern the narrative ladder. Research,
 * settings, and design select their technical contracts in every production
 * shape. The complete inventory still ships with every production.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Limits each contract family to the authored role that owes it across all production shapes.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Gives graph claims and account admission the same deterministic applicability selection.
 */
export function selectAutoMovieAuthoredContractFiles(
  kind: AutoMovieProductionKind | null,
  layer: AutoMovieAuthoredDocumentLayer,
): { discovery: string[]; principles: string[]; obligations: string[] } {
  const narrative = ["treatments", "scripts", "screenplays"].includes(layer);
  const foundation = layer === "settings" || layer === "research";
  const domain = foundation
    ? "core"
    : narrative
      ? "story"
      : layer === "briefs"
        ? "delivery"
        : "design";
  return {
    discovery: [
      "discovery/core/common.md",
      ...(domain === "design" ? ["discovery/design/designs.md"] : []),
      ...(narrative ? ["discovery/story/films.md"] : []),
      ...(layer === "research" ? [] : [`discovery/${domain}/${layer}.md`]),
      ...(narrative ? ["language/discovery/signals.md"] : []),
    ],
    principles: [
      "principles/core/common.md",
      ...(narrative
        ? [
            "principles/core/defaults.md",
            "language/principles/common.md",
            "principles/story/narratives.md",
          ]
        : []),
      ...(!foundation && !narrative
        ? ["principles/core/inherited-units.md"]
        : []),
      `principles/${domain}/${layer}.md`,
    ],
    obligations: [
      "obligations/core/common.md",
      ...(narrative
        ? [
            "obligations/core/defaults.md",
            "language/obligations/common.md",
            "obligations/story/narratives.md",
          ]
        : []),
      ...(layer === "research" ? [] : [`obligations/${domain}/${layer}.md`]),
      ...(layer === "settings" && kind === "film"
        ? ["obligations/story/subjects.md"]
        : []),
    ],
  };
}

/**
 * Binds a layer's open searches to its work-specific contract hosts.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-discovery Selects common and specialist discovery duties for the authored role, including language searches for narrative layers.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-discovery Emits ordinary discovery coverage with current review flags and permitted truthful no-result exclusions.
 */
export function createAutoMovieAuthoredDiscoveryReferences(
  kind: AutoMovieProductionKind | null,
  layer: AutoMovieAuthoredDocumentLayer,
  review: boolean,
): ITtscEvidenceGraphMarkdownReference[] {
  return selectAutoMovieAuthoredContractFiles(kind, layer).discovery.map(
    (file) => ({
      type: "markdown",
      root: "docs",
      files: [file],
      symbol: "h2",
      requireReview: review,
    }),
  );
}

/**
 * Binds each applicable principle to every selected authored unit.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Preserves independent per-unit principle answers after role selection.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Emits the selected principle files with no-exclusion checklist and current stage review flags.
 */
export function createAutoMovieAuthoredPrincipleReferences(
  kind: AutoMovieProductionKind | null,
  layer: AutoMovieAuthoredDocumentLayer,
  review: boolean,
): ITtscEvidenceGraphMarkdownReference[] {
  return selectAutoMovieAuthoredContractFiles(kind, layer).principles.map(
    (file) => ({
      type: "markdown",
      root: "docs",
      files: [file],
      symbol: "h2",
      checklist: true,
      noEvidenceExclude: true,
      requireReview: review,
    }),
  );
}

/**
 * Binds whole narrative and delivery documents to their inherited parents.
 *
 * Technical design relationships belong to their consuming H2 units. A second
 * file host would duplicate the same foundation coverage without another owner.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Places technical foundation answers on their consuming units while preserving narrative and delivery document parentage.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Emits file claims only for narrative and delivery roles with inherited references, preserving their stage and population.
 */
export function createAutoMovieAuthoredFileClaims(
  layer: AutoMovieAuthoredDocumentLayer,
  populationFiles: string[],
  references: ITtscEvidenceGraphReference[],
  enabled: boolean,
): ITtscEvidenceGraphClaim[] {
  if (
    !["treatments", "scripts", "screenplays", "briefs"].includes(layer) ||
    references.length === 0
  )
    return [];
  return [
    {
      name: `${layer} files account for inherited settings, designs, and parent files`,
      type: "markdown",
      root: "docs",
      files: populationFiles,
      symbol: "file",
      disabled: !enabled,
      reference: references,
    },
  ];
}
