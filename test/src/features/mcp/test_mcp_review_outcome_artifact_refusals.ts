import {
  AutoMovieContentDigest,
  IAutoMovieAcceptanceScenario,
  IAutoMovieDiagnostic,
  IAutoMovieGeneratedManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const SHOT_TARGET = { kind: "shot", id: "opening" } as const;
const FILM_TARGET = { kind: "film", id: "fixture-film" } as const;

type ReviewArtifactDiagnosticCode =
  | "review-outcome-artifact-malformed"
  | "review-outcome-artifact-missing"
  | "review-outcome-contract-mismatch";

const REVIEW_ARTIFACT_CODES = new Set<ReviewArtifactDiagnosticCode>([
  "review-outcome-artifact-malformed",
  "review-outcome-artifact-missing",
  "review-outcome-contract-mismatch",
]);

/**
 * Current compiler-owned review evidence refuses at its actual read boundary.
 *
 * The compiler result is captured before each single artifact mutation. That
 * pins the defect this case guards: these readers run only after compile
 * identity was already accepted as current, so a writer-reader disagreement
 * cannot honestly be reported as an absent outcome fixed by retrying the same
 * compile. Each refusal leaves an independent outcome readable.
 *
 * Scenarios:
 *
 * 1. Current shot, realization and film-timeline artifacts produce their event
 *    and runtime outcomes without an artifact-read diagnostic.
 * 2. A manifest entry absent for the compiled shot, a missing resident
 *    realization, and a timeline path replaced by a directory each report the
 *    distinct missing or unreadable state, once per artifact.
 * 3. Digest divergence, invalid JSON and invalid UTF-8 report malformed bytes
 *    rather than an absent compiler outcome.
 * 4. An exact-schema extra property and type-valid shot or fingerprint identity
 *    disagreement report an internal contract mismatch with the failed path;
 *    the message does not ask the author to recompile unchanged inputs.
 * 5. Every realization refusal preserves the independent shot-runtime outcome,
 *    and every compiled-shot refusal preserves the independent event outcome.
 */
export const test_mcp_review_outcome_artifact_refusals = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    installAcceptanceScenarios(project);
    const compiled = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    if (
      productionCompileSucceeded("review artifact fixture", compiled) === false
    )
      throw new Error("Review artifact fixture did not compile.");
    const review = new AutoMovieProductionReviewService(
      project,
      () => compiled,
    );
    const publication = reviewPublication(project);

    const normalShot = review.prepare({ target: SHOT_TARGET });
    const normalFilm = review.prepare({ target: FILM_TARGET });
    TestValidator.equals(
      "current artifacts produce outcomes without read refusals",
      {
        shotOutcomes: outcomeIds(normalShot.outcomes),
        filmOutcomes: outcomeIds(normalFilm.outcomes),
        shotArtifactDiagnostics: artifactDiagnostics(normalShot.diagnostics),
        filmArtifactDiagnostics: artifactDiagnostics(normalFilm.diagnostics),
      },
      {
        shotOutcomes: [
          "compiled-event",
          "compiled-event-copy",
          "compiled-shot-runtime",
          "compiled-shot-runtime-copy",
        ],
        filmOutcomes: [
          "compiled-event",
          "compiled-event-copy",
          "compiled-film-runtime",
          "compiled-film-runtime-copy",
          "compiled-shot-runtime",
          "compiled-shot-runtime-copy",
        ],
        shotArtifactDiagnostics: [],
        filmArtifactDiagnostics: [],
      },
    );
    const missingRealization = publication.withMutation(
      "realizations/opening.json",
      { kind: "resident-missing" },
      () => review.prepare({ target: SHOT_TARGET }),
    );
    assertRefusal({
      title: "a missing realization remains missing",
      prepared: missingRealization,
      code: "review-outcome-artifact-missing",
      path: "realizations/opening.json",
      message: "absent even though the current manifest owns it",
      preservedOutcome: "compiled-shot-runtime",
    });

    const absentCompiledEntry = publication.withMutation(
      "shots/opening.json",
      { kind: "manifest-missing" },
      () => review.prepare({ target: SHOT_TARGET }),
    );
    assertRefusal({
      title: "a compiled shot absent from the manifest remains missing",
      prepared: absentCompiledEntry,
      code: "review-outcome-artifact-missing",
      path: "shots/opening.json",
      message: "absent from the current generated manifest",
      preservedOutcome: "compiled-event",
    });

    const unreadableTimeline = publication.withMutation(
      "film-timeline.json",
      { kind: "directory" },
      () => review.prepare({ target: FILM_TARGET }),
    );
    assertRefusal({
      title: "a non-file timeline remains an unreadable artifact",
      prepared: unreadableTimeline,
      code: "review-outcome-artifact-malformed",
      path: "film-timeline.json",
      message: "is not a file",
      preservedOutcome: null,
    });

    const divergentCompiled = publication.withMutation(
      "shots/opening.json",
      { kind: "replace", bytes: Buffer.from("{}\n", "utf8"), digest: false },
      () => review.prepare({ target: SHOT_TARGET }),
    );
    assertRefusal({
      title: "digest divergence is damaged publication",
      prepared: divergentCompiled,
      code: "review-outcome-artifact-malformed",
      path: "shots/opening.json",
      message: "disagree with the current manifest digest",
      preservedOutcome: "compiled-event",
    });

    const invalidRealizationJson = publication.withMutation(
      "realizations/opening.json",
      { kind: "replace", bytes: Buffer.from("{", "utf8"), digest: true },
      () => review.prepare({ target: SHOT_TARGET }),
    );
    assertRefusal({
      title: "invalid realization JSON is malformed",
      prepared: invalidRealizationJson,
      code: "review-outcome-artifact-malformed",
      path: "realizations/opening.json",
      message: "not intact UTF-8 JSON",
      preservedOutcome: "compiled-shot-runtime",
    });

    const invalidTimelineUtf8 = publication.withMutation(
      "film-timeline.json",
      { kind: "replace", bytes: Uint8Array.of(0xff), digest: true },
      () => review.prepare({ target: FILM_TARGET }),
    );
    assertRefusal({
      title: "invalid timeline UTF-8 is malformed",
      prepared: invalidTimelineUtf8,
      code: "review-outcome-artifact-malformed",
      path: "film-timeline.json",
      message: "not intact UTF-8 JSON",
      preservedOutcome: null,
    });

    const realizationSchemaMismatch = publication.withJsonMutation(
      "realizations/opening.json",
      (value) => ({
        ...object(value),
        anotherUnexpectedField: 1,
        unexpectedWriterField: true,
      }),
      () => review.prepare({ target: SHOT_TARGET }),
    );
    assertRefusal({
      title: "an exact realization schema mismatch names its typia path",
      prepared: realizationSchemaMismatch,
      code: "review-outcome-contract-mismatch",
      path: "realizations/opening.json",
      message: "$input.unexpectedWriterField",
      preservedOutcome: "compiled-shot-runtime",
    });

    const compiledIdentityMismatch = publication.withJsonMutation(
      "shots/opening.json",
      (value) => ({
        ...object(value),
        shot: { ...object(object(value).shot), id: "other-shot" },
      }),
      () => review.prepare({ target: SHOT_TARGET }),
    );
    assertRefusal({
      title: "a type-valid compiled identity mismatch names its semantic path",
      prepared: compiledIdentityMismatch,
      code: "review-outcome-contract-mismatch",
      path: "shots/opening.json",
      message: "$input.shot.id",
      preservedOutcome: "compiled-event",
    });

    const timelineIdentityMismatch = publication.withJsonMutation(
      "film-timeline.json",
      (value) => ({
        ...object(value),
        inputFingerprint: `sha256:${"0".repeat(64)}` as AutoMovieContentDigest,
      }),
      () => review.prepare({ target: FILM_TARGET }),
    );
    assertRefusal({
      title: "a type-valid timeline identity mismatch names its semantic path",
      prepared: timelineIdentityMismatch,
      code: "review-outcome-contract-mismatch",
      path: "film-timeline.json",
      message: "$input.inputFingerprint",
      preservedOutcome: null,
    });

    const snapshotFiles = new Map(
      publication.manifest.files.map((entry) => [
        entry.path,
        fs.readFileSync(
          path.join(project.generatedRoot(), ...entry.path.split("/")),
        ),
      ]),
    );
    snapshotFiles.delete("realizations/opening.json");
    TestValidator.predicate(
      "a missing snapshot artifact refuses without throwing out the review queue",
      review.queue(compiled, {
        renderContentInputs: project.contentInputs(),
        generatedManifest: publication.manifest,
        generatedFiles: snapshotFiles,
      }).entries.length > 0,
    );
  } finally {
    fixture.dispose();
  }
};

const installAcceptanceScenarios = (
  project: AutoMovieProductionProject,
): void => {
  const scenarios: IAutoMovieAcceptanceScenario[] = [
    {
      id: "compiled-event",
      target: SHOT_TARGET,
      criterion: {
        kind: "event",
        event: "cue-raised",
        expectation: "The compiler realizes the declared raised-cue event.",
      },
      required: true,
    },
    {
      id: "compiled-event-copy",
      target: SHOT_TARGET,
      criterion: {
        kind: "event",
        event: "cue-raised",
        expectation:
          "A second criterion reads the same compiler-owned realization without duplicating its artifact diagnostic.",
      },
      required: true,
    },
    {
      id: "compiled-shot-runtime",
      target: SHOT_TARGET,
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: 6,
      },
      required: true,
    },
    {
      id: "compiled-shot-runtime-copy",
      target: SHOT_TARGET,
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: ">=",
        value: 6,
      },
      required: true,
    },
    {
      id: "compiled-film-runtime",
      target: FILM_TARGET,
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: 6,
      },
      required: true,
    },
    {
      id: "compiled-film-runtime-copy",
      target: FILM_TARGET,
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: ">=",
        value: 6,
      },
      required: true,
    },
  ];
  for (const scenario of scenarios) {
    const result = project.setAcceptanceScenario(scenario);
    if (result.accepted === false)
      throw new Error(
        `Acceptance scenario "${scenario.id}" was refused: ${JSON.stringify(result.diagnostics)}`,
      );
  }
};

const outcomeIds = (outcomes: readonly { scenario: string }[]): string[] =>
  outcomes.map((outcome) => outcome.scenario).sort(compareCodeUnits);

const artifactDiagnostics = (
  diagnostics: readonly IAutoMovieDiagnostic[],
): Array<{ code: string; path: string | null; message: string }> =>
  diagnostics
    .filter((diagnostic) =>
      REVIEW_ARTIFACT_CODES.has(
        diagnostic.code as ReviewArtifactDiagnosticCode,
      ),
    )
    .map(({ code, path, message }) => ({ code, path, message }));

const assertRefusal = (props: {
  title: string;
  prepared: ReturnType<AutoMovieProductionReviewService["prepare"]>;
  code: ReviewArtifactDiagnosticCode;
  path: string;
  message: string;
  preservedOutcome: string | null;
}): void => {
  const diagnostics = artifactDiagnostics(props.prepared.diagnostics);
  TestValidator.equals(
    `${props.title}: identity`,
    {
      count: diagnostics.length,
      code: diagnostics[0]?.code,
      path: diagnostics[0]?.path,
      messageNamesCause: diagnostics[0]?.message.includes(props.message),
      preservesIndependentOutcome:
        props.preservedOutcome === null ||
        props.prepared.outcomes.some(
          (outcome) => outcome.scenario === props.preservedOutcome,
        ),
    },
    {
      count: 1,
      code: props.code,
      path: props.path,
      messageNamesCause: true,
      preservesIndependentOutcome: true,
    },
  );
  if (props.code === "review-outcome-contract-mismatch")
    TestValidator.predicate(
      `${props.title}: unchanged recompilation is not presented as user recovery`,
      diagnostics[0]?.message.includes(
        "unchanged recompilation is not a user recovery",
      ) === true,
    );
};

type PublicationMutation =
  | { kind: "manifest-missing" }
  | { kind: "resident-missing" }
  | { kind: "directory" }
  | { kind: "replace"; bytes: Uint8Array; digest: boolean };

const reviewPublication = (project: AutoMovieProductionProject) => {
  const manifestPath = project.trackedStatePath("generated-manifest.json");
  const root = project.generatedRoot();
  const originalManifest = fs.readFileSync(manifestPath);
  const original = JSON.parse(
    originalManifest.toString("utf8"),
  ) as IAutoMovieGeneratedManifest;
  const originalFiles = new Map(
    original.files.map((entry) => [
      entry.path,
      fs.readFileSync(path.join(root, ...entry.path.split("/"))),
    ]),
  );
  const restore = (relativePath: string): void => {
    const file = path.join(root, ...relativePath.split("/"));
    if (fs.existsSync(file)) fs.rmSync(file, { force: true, recursive: true });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, originalFiles.get(relativePath)!);
    fs.writeFileSync(manifestPath, originalManifest);
  };
  const apply = (relativePath: string, mutation: PublicationMutation): void => {
    const file = path.join(root, ...relativePath.split("/"));
    const manifest = structuredClone(original);
    if (mutation.kind === "manifest-missing") {
      manifest.files = manifest.files.filter(
        (entry) => entry.path !== relativePath,
      );
    } else if (mutation.kind === "resident-missing") {
      fs.rmSync(file, { force: true });
    } else if (mutation.kind === "directory") {
      fs.rmSync(file, { force: true });
      fs.mkdirSync(file);
    } else {
      fs.writeFileSync(file, mutation.bytes);
      if (mutation.digest)
        manifest.files.find((entry) => entry.path === relativePath)!.digest =
          digestAutoMovieBytes(mutation.bytes);
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  };
  return {
    manifest: original,
    withMutation: <T>(
      relativePath: string,
      mutation: PublicationMutation,
      run: () => T,
    ): T => {
      try {
        apply(relativePath, mutation);
        return run();
      } finally {
        restore(relativePath);
      }
    },
    withJsonMutation: <T>(
      relativePath: string,
      mutate: (input: unknown) => unknown,
      run: () => T,
    ): T => {
      const bytes = Buffer.from(
        `${JSON.stringify(
          mutate(JSON.parse(originalFiles.get(relativePath)!.toString("utf8"))),
        )}\n`,
        "utf8",
      );
      try {
        apply(relativePath, { kind: "replace", bytes, digest: true });
        return run();
      } finally {
        restore(relativePath);
      }
    },
  };
};

const object = (input: unknown): Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error("Expected a JSON object in the compiled fixture artifact.");
  return input as Record<string, unknown>;
};
