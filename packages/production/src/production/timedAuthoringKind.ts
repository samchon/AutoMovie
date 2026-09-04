import type { IAutoMovieProductionEvidence } from "@automovie/evidence";

/**
 * Compiler ownership mode for one graph-selected timed production.
 *
 * @author Samchon
 */
export interface IAutoMovieTimedAuthoringKind {
  kind: "brief" | "film" | "legacy-film";
  ownerBranch: "briefs" | "screenplays";
  screenplayRequired: boolean;
  evidenceBound: boolean;
}

/**
 * Resolve timed compiler ownership from the graph declaration, never residue.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Keeps direct briefs independent from the film screenplay ladder.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Dispatches screenplay and brief ownership from the selected production kind.
 * @author Samchon
 */
export const resolveAutoMovieTimedAuthoringKind = (
  evidence: IAutoMovieProductionEvidence | undefined,
): IAutoMovieTimedAuthoringKind | null => {
  const kind = evidence?.manifest.kind ?? null;
  if (kind === "library") return null;
  if (kind === "brief")
    return {
      kind,
      ownerBranch: "briefs",
      screenplayRequired: false,
      evidenceBound: true,
    };
  return kind === "film"
    ? {
        kind,
        ownerBranch: "screenplays",
        screenplayRequired: true,
        evidenceBound: true,
      }
    : {
        kind: "legacy-film",
        ownerBranch: "screenplays",
        screenplayRequired: true,
        evidenceBound: false,
      };
};
