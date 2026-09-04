import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

import { resolveAutoMovieTimedAuthoringKind } from "../../../../packages/production/src/production/timedAuthoringKind";

const evidence = (kind: "brief" | "film" | "library") =>
  ({ manifest: { kind } }) as IAutoMovieProductionEvidence;

/**
 * Timed compiler ownership follows the declared production kind.
 *
 * Scenarios:
 *
 * 1. A direct brief uses brief owners without a screenplay prerequisite.
 * 2. A film and the compatible evidence-less path retain screenplay ownership.
 * 3. A library is excluded from the timed compiler path.
 */
export const test_production_timed_authoring_kind = (): void => {
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
