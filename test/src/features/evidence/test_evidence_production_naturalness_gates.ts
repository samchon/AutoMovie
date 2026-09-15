import {
  type IAutoMovieEvidenceConfigProps,
  createBlankAutoMovieProductionEvidence,
  validateAutoMovieProductionStages,
} from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Final wording is a separate film-only stage between construction and shots.
 *
 * Scenarios:
 * 1. Blank and selected first layers remain valid without activating final.
 * 2. Each active final stage requires construction review and is forbidden in other shapes.
 * 3. Film shots require final review; brief shots retain their own reviewed parent.
 * 4. A film reset withdraws final and resets all construction branches together.
 * 5. A library reset keeps its independent design/source pair, not film stages.
 */
export const test_evidence_production_naturalness_gates = (): void => {
  const blank = createBlankAutoMovieProductionEvidence(
    "/production",
    "english",
  );
  validateAutoMovieProductionStages(blank);
  for (const kind of ["film", "brief", "library"] as const) {
    validateAutoMovieProductionStages({ ...blank, kind, settings: "draft" });
    validateAutoMovieProductionStages({ ...blank, kind, research: "draft" });
    TestValidator.predicate(
      "a selected kind begins with an authored foundation",
      throwsError(() => validateAutoMovieProductionStages({ ...blank, kind })),
    );
    for (const stage of ["draft", "evidence", "review"] as const)
      if (kind !== "film")
        TestValidator.predicate(
          "non-film shapes forbid final screenplay stages",
          throwsError(() =>
            validateAutoMovieProductionStages({
              ...blank,
              kind,
              settings: "review",
              naturalness: { screenplays: stage },
            }),
          ),
        );
  }
  const film: IAutoMovieEvidenceConfigProps = {
    ...blank,
    kind: "film",
    settings: "review",
    treatments: "review",
    scripts: "review",
    screenplays: "review",
  };
  for (const stage of ["draft", "evidence", "review"] as const) {
    validateAutoMovieProductionStages({
      ...film,
      naturalness: { screenplays: stage },
    });
    TestValidator.predicate(
      "blank cannot activate final",
      throwsError(() =>
        validateAutoMovieProductionStages({
          ...blank,
          naturalness: { screenplays: stage },
        }),
      ),
    );
    for (const parent of ["disabled", "draft", "evidence"] as const)
      TestValidator.predicate(
        "final waits for construction review",
        throwsError(() =>
          validateAutoMovieProductionStages({
            ...film,
            screenplays: parent,
            naturalness: { screenplays: stage },
          }),
        ),
      );
    if (stage !== "review")
      TestValidator.predicate(
        "shots wait for final review",
        throwsError(() =>
          validateAutoMovieProductionStages({
            ...film,
            naturalness: { screenplays: stage },
            shots: "draft",
          }),
        ),
      );
  }
  TestValidator.predicate(
    "disabled final does not open film shots",
    throwsError(() =>
      validateAutoMovieProductionStages({ ...film, shots: "draft" }),
    ),
  );
  validateAutoMovieProductionStages({
    ...film,
    naturalness: { screenplays: "review" },
    shots: "draft",
  });
  validateAutoMovieProductionStages({
    ...blank,
    kind: "brief",
    settings: "review",
    briefs: "review",
    shots: "draft",
  });
  const reset: IAutoMovieEvidenceConfigProps = {
    ...film,
    treatments: "draft",
    scripts: "draft",
    screenplays: "draft",
    populationScope: {
      mode: "complete-production-reset",
      owner: "author",
      transition: {
        version: 1,
        kind: "film",
        productionLocation: "/production",
        owner: "author",
        pilotScope: { mode: "first-pilot", partitionGroup: "001-opening" },
        reviewedBranches: [
          "treatments",
          "scripts",
          "screenplays",
          "screenplayNaturalness",
        ],
        retainedHosts: [],
      },
    },
  };
  // Only stage topology is judged here; the separate receipt validator owns hosts.
  validateAutoMovieProductionStages(reset);
  for (const layer of ["treatments", "scripts", "screenplays"] as const)
    TestValidator.predicate(
      "film reset is synchronized",
      throwsError(() =>
        validateAutoMovieProductionStages({ ...reset, [layer]: "review" }),
      ),
    );
  TestValidator.predicate(
    "film reset withdraws final",
    throwsError(() =>
      validateAutoMovieProductionStages({
        ...reset,
        naturalness: { screenplays: "draft" },
      }),
    ),
  );
  const library: IAutoMovieEvidenceConfigProps = {
    ...blank,
    kind: "library",
    settings: "review",
    models: "draft",
    modelSources: "draft",
    populationScope: {
      mode: "complete-production-reset",
      owner: "author",
      transition: {
        version: 1,
        kind: "library",
        productionLocation: "/production",
        owner: "author",
        pilotScope: { mode: "first-pilot" },
        reviewedPairs: [{ design: "models", source: "modelSources" }],
        retainedHosts: [],
      },
    },
  };
  validateAutoMovieProductionStages(library);
  TestValidator.predicate(
    "library reset needs its matching source",
    throwsError(() =>
      validateAutoMovieProductionStages({
        ...library,
        modelSources: "disabled",
      }),
    ),
  );
};
