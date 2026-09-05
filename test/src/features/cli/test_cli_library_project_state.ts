import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import {
  type IAutoMovieProjectState,
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import fs from "node:fs";
import path from "node:path";

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
 * 4. A digest-verified generated record whose bytes are malformed UTF-8 or
 *    carry a duplicate member is refused by the shared structured JSON
 *    admission and reported against its own path, so no replacement character
 *    or shadowed member reaches the typed state.
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
    const forgeGenerated = (bytes: Buffer): IAutoMovieProjectState => {
      const project = AutoMovieProductionProject.open(fixture.root);
      const manifest = project.generatedManifest()!;
      fs.writeFileSync(
        path.join(project.generatedRoot(), "library", "index.json"),
        bytes,
      );
      fs.writeFileSync(
        project.trackedStatePath("generated-manifest.json"),
        JSON.stringify({
          ...manifest,
          files: manifest.files.map((file) =>
            file.path === "library/index.json"
              ? { ...file, digest: digestAutoMovieBytes(bytes) }
              : file,
          ),
        }),
      );
      return loadAutoMovieProjectState({
        root: fixture.root,
        authoringEvidence: evidence,
        currentAuthoringEvidence,
      });
    };
    const indexProblem = (
      state: IAutoMovieProjectState,
      fragment: string,
    ): boolean =>
      state.freshness.problems.some(
        (problem) =>
          problem.code === "library-index-invalid" &&
          problem.path === "library/index.json" &&
          problem.message.includes(fragment),
      );
    const malformedEncoding = forgeGenerated(
      Buffer.concat([
        Buffer.from('{"version":"'),
        Buffer.from([0x80]),
        Buffer.from('"}'),
      ]),
    );
    const duplicateMember = forgeGenerated(
      Buffer.from('{"version":2,"version":2}'),
    );
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
          "malformedGeneratedEncodingIsRefusedByRecord",
          () =>
            indexProblem(malformedEncoding, "encoding admission") &&
            malformedEncoding.freshness.status !== "current",
        ],
        [
          "duplicateGeneratedMemberIsRefusedByRecord",
          () =>
            indexProblem(duplicateMember, "duplicate member") &&
            duplicateMember.freshness.status !== "current",
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
        malformedGeneratedEncodingIsRefusedByRecord: true,
        duplicateGeneratedMemberIsRefusedByRecord: true,
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
