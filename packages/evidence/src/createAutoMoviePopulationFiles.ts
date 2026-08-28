import type { AutoMoviePopulationLayer } from "./AutoMoviePopulationLayer";
import type { AutoMoviePopulationScope } from "./AutoMoviePopulationScope";

const FIRST_DELIVERY_GROUP = /^001-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * Selects authored unit files for one film narrative layer.
 *
 * The returned globs are relative to a claim rooted at `docs` and always use
 * POSIX separators. Treatments are a flat event sequence in every mode. A
 * film pilot narrows the two delivery-partitioned layers to one exact `001-*`
 * directory; complete production and its post-pilot reset select every group.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Selects the real unit-file population before evidence cardinality is evaluated.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Implements deterministic complete and first-pilot file populations without selecting group indexes.
 * @author Samchon
 */
export function createAutoMoviePopulationFiles(
  layer: AutoMoviePopulationLayer,
  scope: AutoMoviePopulationScope,
): string[] {
  if (layer === "treatments") return ["treatments/???-*.md"];
  if (layer !== "scripts" && layer !== "screenplays")
    throw new Error(`Unsupported scoped authored layer ${String(layer)}.`);

  if (
    scope.mode === "complete-production" ||
    scope.mode === "complete-production-reset"
  )
    return [`${layer}/*/???-*.md`];
  if (scope.mode !== "first-pilot")
    throw new Error(
      `Unsupported authored population scope ${String((scope as { mode?: unknown }).mode)}.`,
    );
  if (
    scope.partitionGroup === undefined ||
    !FIRST_DELIVERY_GROUP.test(scope.partitionGroup)
  )
    throw new Error(
      "A film pilot requires one exact 001-lower-kebab-case script and screenplay partition-group directory.",
    );
  return [`${layer}/${scope.partitionGroup}/???-*.md`];
}
