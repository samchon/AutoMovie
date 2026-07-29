import {
  IAutoMovieBenchmarkSubmissionDraft,
  assertAutoMovieBenchmarkBinding,
  austerlitzSignalDraft,
  austerlitzSignalDryRun,
  austerlitzSignalReference,
  austerlitzSignalTask,
  benchmarkComparisonDrift,
  digestBenchmarkValue,
  sealAutoMovieBenchmarkSubmission,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";

const throws = (task: () => unknown, fragment: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/**
 * A sealed submission is evidence rather than a working document: its identity
 * is the digest of everything it claims, and nothing about it can be edited
 * afterwards.
 *
 * Scenarios:
 *
 * 1. Two independent constructions of the same run seal to the same run id, and
 *    one changed archived fact changes it.
 * 2. Sealing resolves the reported lifecycle into the canonical ordered one.
 * 3. The sealed archive is frozen through every nested object and array, so a
 *    scorer that edits it fails instead of rescoring its own edit.
 * 4. A malformed draft is refused with the failing path named.
 * 5. Binding refuses a submission produced for another task, exact task law,
 *    brief, or version tuple, and accepts the matching one.
 * 6. A production and a legacy submission of one dry evaluation differ only in the
 *    surface they drove; comparing a surface with itself is refused, and a
 *    changed controlled condition is named field by field.
 */
export const test_benchmark_submission_seal = (): void => {
  const task = austerlitzSignalTask();
  const reference = austerlitzSignalReference();
  TestValidator.equals(
    "the same archived run seals to the same identity",
    reference.runId,
    austerlitzSignalReference().runId,
  );
  const draft = austerlitzSignalDraft("production");
  const changed = sealAutoMovieBenchmarkSubmission({
    ...draft,
    observations: { ...draft.observations, "production:fps": 30 },
  });
  TestValidator.predicate(
    "one changed archived fact changes the run identity",
    changed.runId !== reference.runId,
  );
  TestValidator.equals(
    "sealing resolves the reported gates into the canonical order",
    reference.lifecycle.map((result) => result.gate),
    [
      "packaged-install",
      "mcp-handshake",
      "project-bootstrap",
      "source-compile",
      "capture-runtime",
      "required-frames",
      "review-queue",
      "deliverable-render",
      "final-compile",
    ],
  );
  TestValidator.predicate(
    "the sealed archive is frozen through its nested evidence",
    Object.isFrozen(reference) &&
      Object.isFrozen(reference.frames) &&
      Object.isFrozen(reference.frames[0]) &&
      Object.isFrozen(reference.repository.artifacts[0]) &&
      Object.isFrozen(reference.observations),
  );
  TestValidator.predicate(
    "a malformed draft is refused with its failing path",
    throws(
      () =>
        sealAutoMovieBenchmarkSubmission(
          {} as IAutoMovieBenchmarkSubmissionDraft,
        ),
      "Invalid AutoMovie benchmark submission",
    ),
  );

  assertAutoMovieBenchmarkBinding(task, reference);
  TestValidator.predicate(
    "binding refuses evidence produced under another law",
    throws(
      () =>
        assertAutoMovieBenchmarkBinding(
          { ...task, taskId: "short/other" },
          reference,
        ),
      "was produced for task",
    ) &&
      throws(
        () =>
          assertAutoMovieBenchmarkBinding(
            {
              ...task,
              weights: {
                historical: 0.1,
                production: 0.3,
                frame: 0.25,
                invariant: 0.2,
                delivery: 0.15,
              },
            },
            reference,
          ),
        "produced under task law",
      ) &&
      throws(
        () =>
          assertAutoMovieBenchmarkBinding(
            {
              ...task,
              brief: { ...task.brief, digest: `sha256:${"9".repeat(64)}` },
            },
            reference,
          ),
        "received brief",
      ) &&
      throws(
        () =>
          assertAutoMovieBenchmarkBinding(
            {
              ...task,
              versions: { ...task.versions, task: "2.0.0", scenarioHelper: 4 },
            },
            reference,
          ),
        "task 1.0.0 against 2.0.0; scenarioHelper 1 against 4",
      ),
  );

  const [production, legacy] = austerlitzSignalDryRun();
  TestValidator.equals(
    "one dry evaluation holds every condition but the surface equal",
    benchmarkComparisonDrift(production!, legacy!),
    [],
  );
  TestValidator.equals(
    "comparing a surface with itself is not a comparison",
    benchmarkComparisonDrift(production!, austerlitzSignalReference()),
    ["surface: both submissions drove production"],
  );
  const legacyDraft = austerlitzSignalDraft("legacy-compact");
  const changedArtifacts = [
    {
      ...legacyDraft.repository.artifacts[0]!,
      digest: `sha256:${"8".repeat(64)}` as const,
    },
    ...legacyDraft.repository.artifacts.slice(1),
  ];
  TestValidator.equals(
    "changed comparison conditions are named field by field",
    benchmarkComparisonDrift(
      production!,
      sealAutoMovieBenchmarkSubmission({
        ...legacyDraft,
        versions: {
          ...legacyDraft.versions,
          reference: "2.0.0",
          scenarioHelper: 2,
        },
        repository: {
          ...legacyDraft.repository,
          commit: "1".repeat(40),
          dirty: true,
          artifacts: changedArtifacts,
        },
        client: {
          ...legacyDraft.client,
          agent: "alternate",
          model: "other-model",
          seed: 7,
        },
        runtime: {
          ...legacyDraft.runtime,
          os: "windows",
          capture: "other-capture",
        },
      }),
    ),
    [
      "referenceVersion: 1.0.0 vs 2.0.0",
      "scenarioHelper: 1 vs 2",
      `commit: ${"0".repeat(40)} vs ${"1".repeat(40)}`,
      "dirty: false vs true",
      `artifacts: ${digestBenchmarkValue(production!.repository.artifacts)} vs ${digestBenchmarkValue(changedArtifacts)}`,
      "agent: default vs alternate",
      "model: claude-opus-5 vs other-model",
      "seed: 1411 vs 7",
      "runtimeOs: linux vs windows",
      "captureRuntime: automovie.capture-runtime.v1 chromium 148 vs other-capture",
    ],
  );
};
