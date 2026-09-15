import type { IAutoMovieProductionEvidence } from "@automovie/evidence";

/**
 * Compiler ownership mode for one graph-selected timed production.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Distinguishes selected timed shapes from an evidence-less compatibility call.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Exposes the compiler's source-owner and screenplay prerequisite decisions.
 *
 * @author Samchon
 */
export interface IAutoMovieTimedAuthoringKind {
  /** Selected timed-production shape, including the legacy fallback. */
  kind: "brief" | "film" | "legacy-film";
  /** Graph branch that owns the timed source document. */
  ownerBranch: "briefs" | "screenplays";
  /** Whether the film-only screenplay ladder must run. */
  screenplayRequired: boolean;
  /** Whether the selection came from current graph evidence. */
  evidenceBound: boolean;
}

/**
 * Resolve timed builder ownership from the graph declaration, never residue.
 *
 * An explicitly unselected declaration refuses before a project is opened.
 * Only the absent-evidence compatibility API retains the legacy film default.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Keeps direct briefs independent from the film screenplay ladder.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Dispatches screenplay and brief ownership from the selected production kind.
 * @author Samchon
 */
export const resolveAutoMovieTimedAuthoringKind = (
  evidence: IAutoMovieProductionEvidence | undefined,
): IAutoMovieTimedAuthoringKind | null => {
  const kind = evidence?.manifest.kind ?? null;
  if (evidence !== undefined && kind === null)
    throw new Error(
      "Select film, brief, or library in lint.config.ts before building or linting a production.",
    );
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
