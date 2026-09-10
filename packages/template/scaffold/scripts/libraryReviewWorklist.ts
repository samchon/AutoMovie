import type {
  IAutoMovieDiagnostic,
  IAutoMovieLibraryReviewPopulation,
} from "@automovie/interface";

/**
 * Project the compiler's review refusals onto the existing observation plan.
 * This computes no receipt validity and stores no approval. An unaddressed
 * refusal blocks the list instead of making unchecked observations look paid.
 */
export const libraryReviewWorklist = (props: {
  population: IAutoMovieLibraryReviewPopulation;
  diagnostics: readonly IAutoMovieDiagnostic[];
}) => {
  const observations = props.population.owners.flatMap((owner) =>
    owner.observations.map((observation) => ({
      branch: owner.branch,
      owner: owner.owner,
      observation: observation.id,
      evidence: observation.evidence,
      target: `library:${owner.branch}:${owner.owner}:${observation.id}`,
      ownerTarget: `library:${owner.branch}:${owner.owner}`,
      branchTarget: `library:${owner.branch}`,
    })),
  );
  const errors = props.diagnostics.filter(
    (entry) => entry.category === "error",
  );
  const global = errors.filter((entry) =>
    observations.every(
      (observation) =>
        entry.target !== observation.target &&
        entry.target !== observation.ownerTarget &&
        entry.target !== observation.branchTarget,
    ),
  );
  const work = observations.map((observation) => {
    const blockers = [
      ...global,
      ...errors.filter(
        (entry) =>
          entry.target === observation.ownerTarget ||
          entry.target === observation.branchTarget,
      ),
    ];
    const findings = errors.filter(
      (entry) => entry.target === observation.target,
    );
    return {
      ...observation,
      status:
        blockers.length !== 0
          ? "blocked"
          : findings.length !== 0
            ? "pending"
            : "satisfied",
      diagnostics: [...blockers, ...findings],
    };
  });
  return {
    declared: work.length,
    derivedRequired: props.population.required.length,
    satisfied: work.filter((entry) => entry.status === "satisfied").length,
    pending: work.filter((entry) => entry.status === "pending").length,
    blocked: work.filter((entry) => entry.status === "blocked").length,
    work: work.filter((entry) => entry.status !== "satisfied"),
    diagnostics: props.diagnostics,
  };
};
