import {
  IAutoMovieBenchmarkSubmission,
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

import { namedFacts } from "../internal/predicates";

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
 * 4. A malformed draft and every physically impossible numeric claim are refused
 *    before they can enter scoring or aggregate generation health.
 * 5. Every public scoring boundary revalidates serialized archive shape, physical
 *    claims, canonical lifecycle order, and the content-addressed run id
 *    instead of trusting an in-memory freeze that serialization removes.
 * 6. Binding refuses a submission produced for another task, exact task law,
 *    brief, or version tuple, and accepts the matching one.
 * 7. A production and a legacy submission of one dry evaluation differ only in the
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
  TestValidator.equals(
    "the sealed archive is frozen through its nested evidence",
    namedFacts([
      ["isFrozenReference", () => Object.isFrozen(reference)],
      ["isFrozenReferenceFrames", () => Object.isFrozen(reference.frames)],
      ["isFrozenReferenceFrames2", () => Object.isFrozen(reference.frames[0])],
      [
        "isFrozenReferenceRepository",
        () => Object.isFrozen(reference.repository.artifacts[0]),
      ],
      [
        "isFrozenReferenceObservations",
        () => Object.isFrozen(reference.observations),
      ],
    ]),
    {
      isFrozenReference: true,
      isFrozenReferenceFrames: true,
      isFrozenReferenceFrames2: true,
      isFrozenReferenceRepository: true,
      isFrozenReferenceObservations: true,
    },
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
  TestValidator.equals(
    "physically impossible archive numbers are refused before sealing",
    namedFacts([
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                client: { ...draft.client, seed: 0.5 },
              }),
            "client seed",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft2",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                repository: {
                  ...draft.repository,
                  artifacts: [
                    { ...draft.repository.artifacts[0]!, bytes: 0.5 },
                    ...draft.repository.artifacts.slice(1),
                  ],
                },
              }),
            "positive safe integer",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft3",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                repository: {
                  ...draft.repository,
                  artifacts: [
                    { ...draft.repository.artifacts[0]!, bytes: 0 },
                    ...draft.repository.artifacts.slice(1),
                  ],
                },
              }),
            "positive safe integer",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft4",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                versions: { ...draft.versions, scenarioHelper: 0.5 },
              }),
            "scenario-helper revision",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft5",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                versions: { ...draft.versions, scenarioHelper: -1 },
              }),
            "scenario-helper revision",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft6",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                generation: { ...draft.generation, toolCalls: 0.5 },
              }),
            "non-negative safe integer",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft7",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                generation: { ...draft.generation, corrections: -1 },
              }),
            "non-negative safe integer",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft8",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                observations: {
                  ...draft.observations,
                  "production:fps": Number.NaN,
                },
              }),
            "finite number",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft9",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                frames: [
                  { ...draft.frames[0]!, timeSeconds: Number.NaN },
                  ...draft.frames.slice(1),
                ],
              }),
            "non-negative finite number",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft10",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                frames: [
                  { ...draft.frames[0]!, timeSeconds: -1 },
                  ...draft.frames.slice(1),
                ],
              }),
            "non-negative finite number",
          ),
      ],
      [
        "evidenceFramesEscape",
        () =>
          [
            "evidence\\frames\\escape.png",
            "evidence/frames/folder\\escape.png",
            "evidence/frames//escape.png",
            "evidence/frames/./escape.png",
            "evidence/frames/../escape.png",
            "evidence/frames/\0escape.png",
          ].every((evidencePath) =>
            throws(
              () =>
                sealAutoMovieBenchmarkSubmission({
                  ...draft,
                  frames: [
                    {
                      ...draft.frames[0]!,
                      path: evidencePath,
                    },
                    ...draft.frames.slice(1),
                  ],
                }),
              "normalized archive-relative path",
            ),
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft11",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                frames: [
                  draft.frames[0]!,
                  { ...draft.frames[1]!, path: draft.frames[0]!.path },
                ],
              }),
            "owned more than once",
          ),
      ],
    ]),
    {
      throwsSealAutoMovieBenchmarkSubmissionDraft: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft2: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft3: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft4: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft5: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft6: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft7: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft8: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft9: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft10: true,
      evidenceFramesEscape: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft11: true,
    },
  );
  const repaintAdapterIdentity =
    '{"execution":"local","model":"fixture","protocolVersion":"automovie.repaint-runtime.v1","provider":"fixture","version":"1"}';
  TestValidator.equals(
    "repaint evidence requires canonical structured runtime identity and concrete shot receipts",
    namedFacts([
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                lane: "repaint",
                repaint: {
                  status: "not-produced",
                  adapterIdentity: "nominal-capability-label",
                },
              }),
            "not canonical JSON",
          ),
      ],
      [
        "throwsSealAutoMovieBenchmarkSubmissionDraft2",
        () =>
          throws(
            () =>
              sealAutoMovieBenchmarkSubmission({
                ...draft,
                lane: "repaint",
                repaint: {
                  status: "verified",
                  adapterIdentity: repaintAdapterIdentity,
                  shots: [],
                  featureDigest: draft.deliverables[0]!.digest,
                },
              }),
            "unique non-blank shot receipts",
          ),
      ],
    ]),
    {
      throwsSealAutoMovieBenchmarkSubmissionDraft: true,
      throwsSealAutoMovieBenchmarkSubmissionDraft2: true,
    },
  );

  const reloaded = JSON.parse(
    JSON.stringify(reference),
  ) as IAutoMovieBenchmarkSubmission;
  assertAutoMovieBenchmarkBinding(task, reloaded);
  const forgedObservation = {
    ...reloaded,
    observations: {
      ...reloaded.observations,
      "production:fps": reloaded.observations["production:fps"]! + 1,
    },
  };
  const nonCanonicalLifecycle = {
    ...reloaded,
    lifecycle: [...reloaded.lifecycle].reverse(),
  };
  TestValidator.equals(
    "public scoring revalidates serialized archive integrity",
    namedFacts([
      ["isFrozenReloaded", () => Object.isFrozen(reloaded) === false],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask",
        () =>
          throws(
            () =>
              assertAutoMovieBenchmarkBinding(
                task,
                {} as IAutoMovieBenchmarkSubmission,
              ),
            "Invalid sealed AutoMovie benchmark submission",
          ),
      ],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask2",
        () =>
          throws(
            () =>
              assertAutoMovieBenchmarkBinding(task, {
                ...reloaded,
                generation: { ...reloaded.generation, costUsd: -1 },
              }),
            "generation cost",
          ),
      ],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask3",
        () =>
          throws(
            () => assertAutoMovieBenchmarkBinding(task, nonCanonicalLifecycle),
            "canonical lifecycle order",
          ),
      ],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask4",
        () =>
          throws(
            () => assertAutoMovieBenchmarkBinding(task, forgedObservation),
            "does not match its archived evidence digest",
          ),
      ],
      [
        "throwsBenchmarkComparisonDriftForgedObservation",
        () =>
          throws(
            () => benchmarkComparisonDrift(forgedObservation, reloaded),
            "does not match its archived evidence digest",
          ),
      ],
      [
        "throwsBenchmarkComparisonDriftReloaded",
        () =>
          throws(
            () => benchmarkComparisonDrift(reloaded, forgedObservation),
            "does not match its archived evidence digest",
          ),
      ],
    ]),
    {
      isFrozenReloaded: true,
      throwsAssertAutoMovieBenchmarkBindingTask: true,
      throwsAssertAutoMovieBenchmarkBindingTask2: true,
      throwsAssertAutoMovieBenchmarkBindingTask3: true,
      throwsAssertAutoMovieBenchmarkBindingTask4: true,
      throwsBenchmarkComparisonDriftForgedObservation: true,
      throwsBenchmarkComparisonDriftReloaded: true,
    },
  );
  TestValidator.equals(
    "binding refuses evidence produced under another law",
    namedFacts([
      [
        "throwsAssertAutoMovieBenchmarkBindingTask",
        () =>
          throws(
            () =>
              assertAutoMovieBenchmarkBinding(
                { ...task, taskId: "short/other" },
                reference,
              ),
            "was produced for task",
          ),
      ],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask2",
        () =>
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
          ),
      ],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask3",
        () =>
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
          ),
      ],
      [
        "throwsAssertAutoMovieBenchmarkBindingTask4",
        () =>
          throws(
            () =>
              assertAutoMovieBenchmarkBinding(
                {
                  ...task,
                  versions: {
                    ...task.versions,
                    task: "2.0.0",
                    scenarioHelper: 4,
                  },
                },
                reference,
              ),
            "task 1.0.0 against 2.0.0; scenarioHelper 1 against 4",
          ),
      ],
    ]),
    {
      throwsAssertAutoMovieBenchmarkBindingTask: true,
      throwsAssertAutoMovieBenchmarkBindingTask2: true,
      throwsAssertAutoMovieBenchmarkBindingTask3: true,
      throwsAssertAutoMovieBenchmarkBindingTask4: true,
    },
  );
  const overBudget = (
    generation: Partial<IAutoMovieBenchmarkSubmissionDraft["generation"]>,
  ): IAutoMovieBenchmarkSubmission =>
    sealAutoMovieBenchmarkSubmission({
      ...austerlitzSignalDraft("production"),
      generation: {
        ...austerlitzSignalDraft("production").generation,
        ...generation,
      },
    });
  TestValidator.predicate(
    "binding refuses every task sandbox budget overrun",
    [
      {
        submission: overBudget({
          elapsedSeconds: task.sandbox.maxElapsedSeconds + 0.001,
        }),
        field: "elapsedSeconds",
      },
      {
        submission: overBudget({
          costUsd: task.sandbox.maxCostUsd + 0.001,
        }),
        field: "costUsd",
      },
      {
        submission: overBudget({
          corrections: task.sandbox.maxCorrections + 1,
        }),
        field: "corrections",
      },
    ].every(({ submission, field }) =>
      throws(
        () => assertAutoMovieBenchmarkBinding(task, submission),
        `${field} `,
      ),
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
  TestValidator.equals(
    "comparison drift separates deterministic and repaint delivery lanes",
    benchmarkComparisonDrift(
      production!,
      sealAutoMovieBenchmarkSubmission({
        ...legacyDraft,
        lane: "repaint",
      }),
    ),
    ["lane: deterministic vs repaint"],
  );
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
