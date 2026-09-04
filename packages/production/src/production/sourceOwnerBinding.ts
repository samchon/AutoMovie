import type { IAutoMovieProductionEvidenceSourceOwnerBinding } from "@automovie/evidence";

/**
 * Resolve one executed export to its exact graph-selected authored owner.
 *
 * Source path and export name choose the candidate edge. The runtime-provided
 * owner is then checked against that edge rather than against a global target
 * population, and the source digest is checked against the bytes about to run.
 * Review and final callers additionally require the current reviewed edge.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Binds execution and result attribution to the exact reviewed source export and refuses a stale or mismatched owner edge.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage Preserves the exact source and authored-target edge that compilation admits and derived output carries.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Resolves target, source path, export, and source digest as one current identity and fails closed when it is absent, ambiguous, stale, mismatched, or unreviewed.
 * @author Samchon
 */
export const resolveAutoMovieSourceOwnerBinding = (props: {
  bindings:
    | readonly IAutoMovieProductionEvidenceSourceOwnerBinding[]
    | undefined;
  branch: string;
  sourcePath: string;
  exportName: string;
  /** Runtime owner claim, when this entry protocol carries one. */
  owner?: string;
  sourceDigest: string;
  requireReviewed: boolean;
}) => {
  const candidates = (props.bindings ?? []).filter(
    (binding) =>
      binding.branch === props.branch &&
      binding.sourcePath === props.sourcePath &&
      binding.exportName === props.exportName,
  );
  const address = `${props.sourcePath}#${props.exportName}`;
  if (candidates.length === 0)
    return {
      success: false as const,
      binding: null,
      reason: "missing" as const,
      message: `Source export "${address}" has no graph-selected owner edge in branch "${props.branch}".`,
    };
  if (candidates.length !== 1)
    return {
      success: false as const,
      binding: null,
      reason: "ambiguous" as const,
      message: `Source export "${address}" has ${candidates.length} graph-selected owner edges in branch "${props.branch}". Keep one exact authored target on the executed export.`,
    };
  const binding = candidates[0]!;
  const selectedOwner = `${binding.targetPath}#${binding.targetAnchor}`;
  if (props.owner !== undefined && selectedOwner !== props.owner)
    return {
      success: false as const,
      binding: null,
      reason: "owner" as const,
      message: `Source export "${address}" is graph-bound to "${selectedOwner}", not runtime owner "${props.owner}".`,
    };
  if (binding.sourceDigest !== props.sourceDigest)
    return {
      success: false as const,
      binding: null,
      reason: "digest" as const,
      message: `Source export "${address}" is bound at source digest ${binding.sourceDigest}, but execution supplied ${props.sourceDigest}.`,
    };
  if (props.requireReviewed && binding.reviewed === false)
    return {
      success: false as const,
      binding: null,
      reason: "review" as const,
      message: `Source export "${address}" has no current reviewed owner edge for "${selectedOwner}".`,
    };
  return {
    success: true as const,
    binding,
    reason: null,
    message: null,
  };
};
