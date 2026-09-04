import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  libraryAuthoring,
  libraryFixture,
} from "../production/libraryFixtures";

/**
 * The common state loader reopens library publication in its declared shape.
 *
 * Scenarios:
 *
 * 1. A normal compiler publication becomes current without timed roots and
 *    exposes its strict owner index, environment, and shared model collection.
 * 2. Omitting graph evidence cannot infer library kind from generated residue.
 * 3. Timed evidence cannot adopt a digest-valid library publication.
 */
export const test_cli_library_project_state = (): void => {
  const fixture = libraryFixture();
  try {
    const currentAuthoringEvidence = () =>
      libraryAuthoring({ root: fixture.root });
    const evidence = currentAuthoringEvidence();
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      evidence,
      currentAuthoringEvidence,
    ).compile({ scope: "source" });
    const current = loadAutoMovieProjectState({
      root: fixture.root,
      authoringEvidence: evidence,
      currentAuthoringEvidence,
    });
    const narrowed = requireCurrentAutoMovieProjectState(current);
    const omitted = loadAutoMovieProjectState({ root: fixture.root });
    const timed = loadAutoMovieProjectState({
      root: fixture.root,
      authoringEvidence: {
        ...evidence,
        manifest: { ...evidence.manifest, kind: "film" },
      },
    });

    TestValidator.equals(
      "library publication reopens only through matching graph evidence",
      namedFacts([
        ["libraryCompileSucceeded", () => compiled.success],
        [
          "matchingLibraryStateIsCurrent",
          () => current.freshness.status === "current",
        ],
        [
          "currentStateNarrowsToLibrary",
          () =>
            narrowed.generated.kind === "library" &&
            narrowed.generated.library.owners.length === 1,
        ],
        [
          "verifiedEnvironmentIsExposed",
          () =>
            narrowed.generated.libraryEnvironments.get("hall-house")?.id ===
            "hall-house",
        ],
        [
          "omittedEvidenceCannotInferLibrary",
          () =>
            omitted.freshness.status === "stale" &&
            omitted.freshness.problems.some(
              (problem) => problem.code === "authoring-evidence-required",
            ),
        ],
        [
          "timedEvidenceRejectsLibraryShape",
          () =>
            timed.freshness.status === "stale" &&
            timed.freshness.problems.some(
              (problem) => problem.code === "generated-shape-mismatch",
            ),
        ],
        [
          "staleLibraryDoesNotNarrow",
          () =>
            throwsError(
              () => requireCurrentAutoMovieProjectState(omitted),
              "authoring-evidence-required",
            ),
        ],
      ]),
      {
        libraryCompileSucceeded: true,
        matchingLibraryStateIsCurrent: true,
        currentStateNarrowsToLibrary: true,
        verifiedEnvironmentIsExposed: true,
        omittedEvidenceCannotInferLibrary: true,
        timedEvidenceRejectsLibraryShape: true,
        staleLibraryDoesNotNarrow: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
