import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const { resolveAutoMovieTimedAuthoringKind } = loadSourceModule<{
  resolveAutoMovieTimedAuthoringKind: (
    evidence: IAutoMovieProductionEvidence | undefined,
  ) => {
    kind: "brief" | "film" | "legacy-film";
    ownerBranch: "briefs" | "screenplays";
    screenplayRequired: boolean;
    evidenceBound: boolean;
  } | null;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/timedAuthoringKind.ts",
  ),
);

const evidence = (kind: "brief" | "film" | "library" | null) =>
  ({ manifest: { kind } }) as IAutoMovieProductionEvidence;

/**
 * Timed builder ownership follows the declared production kind.
 *
 * Scenarios:
 *
 * 1. A direct brief uses brief owners without a screenplay prerequisite.
 * 2. A film and the compatible evidence-less path retain screenplay ownership.
 * 3. A library is excluded from the timed builder path.
 * 4. An explicitly blank declaration refuses instead of falling back to legacy film.
 */
export const test_production_timed_authoring_kind = (): void => {
  TestValidator.predicate(
    "an unselected kind cannot borrow legacy film ownership",
    throwsError(() => resolveAutoMovieTimedAuthoringKind(evidence(null))),
  );
  TestValidator.equals(
    "timed authoring ownership is kind-discriminated",
    {
      brief: resolveAutoMovieTimedAuthoringKind(evidence("brief")),
      film: resolveAutoMovieTimedAuthoringKind(evidence("film")),
      compatibleFilm: resolveAutoMovieTimedAuthoringKind(undefined),
      library: resolveAutoMovieTimedAuthoringKind(evidence("library")),
    },
    {
      brief: {
        kind: "brief",
        ownerBranch: "briefs",
        screenplayRequired: false,
        evidenceBound: true,
      },
      film: {
        kind: "film",
        ownerBranch: "screenplays",
        screenplayRequired: true,
        evidenceBound: true,
      },
      compatibleFilm: {
        kind: "legacy-film",
        ownerBranch: "screenplays",
        screenplayRequired: true,
        evidenceBound: false,
      },
      library: null,
    },
  );
};
