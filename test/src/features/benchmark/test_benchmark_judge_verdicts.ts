import {
  IAutoMovieBenchmarkSubmissionDraft,
  IAutoMovieBenchmarkTask,
  austerlitzSignalDraft,
  austerlitzSignalMutants,
  austerlitzSignalTask,
  judgeAutoMovieBenchmarkSubmission,
  sealAutoMovieBenchmarkSubmission,
  validateAutoMovieBenchmarkTask,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";

const score = (
  task: IAutoMovieBenchmarkTask,
  draft: IAutoMovieBenchmarkSubmissionDraft,
): string | undefined =>
  judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      taskDigest: validateAutoMovieBenchmarkTask(task),
    }),
  ).filmScore?.toFixed(4);

/**
 * The judge answers three different questions with three verdicts and settles
 * every deterministic assertion from one archived evidence address.
 *
 * Scenarios:
 *
 * 1. An infrastructure incident excludes the run before any gate is read, and an
 *    excluded run carries no score at all rather than a zero.
 * 2. A candidate that stopped at a gate scores zero inside the denominator and
 *    names the gate and its evidence sentence.
 * 3. The reference run scores exactly one, and every axis reports the fraction of
 *    its own assertions that passed.
 * 4. Each comparison operator settles on its own terms, tolerance included.
 * 5. Absent evidence settles `unknown` rather than `fail`: a missing observation,
 *    an uncaptured frame, and an unpublished deliverable kind are all silence,
 *    while a captured-but-wrong frame and a probe-invalid file are failures.
 *    Neither ever reads as a pass.
 * 6. Correction attempts may archive multiple captures under the same frame
 *    address; their order cannot change whether the required frame exists or
 *    which failed capture supplies its deterministic diagnostic.
 * 7. An axis a task declares no assertion for scores zero and contributes nothing,
 *    so an unweighted empty axis cannot cap a score.
 */
export const test_benchmark_judge_verdicts = (): void => {
  const task = austerlitzSignalTask();
  const draft = austerlitzSignalDraft("production");

  const excluded = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      lifecycle: [],
      incident: {
        kind: "rate-limit",
        gate: "source-compile",
        detail: "The client hit its hourly limit.",
      },
    }),
  );
  TestValidator.equals(
    "infrastructure excludes the run before any gate is read",
    [excluded.outcome, excluded.filmScore],
    ["infra-excluded", null],
  );

  const blocked = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      lifecycle: [
        { gate: "packaged-install", status: "pass", detail: "9 tarballs." },
        { gate: "mcp-handshake", status: "fail", detail: "No tools listed." },
      ],
    }),
  );
  TestValidator.equals(
    "a candidate that stopped at a gate scores zero inside the denominator",
    blocked.outcome === "gate-failed"
      ? [blocked.failedGate, blocked.detail, blocked.filmScore]
      : [],
    ["mcp-handshake", "No tools listed.", 0],
  );

  const reference = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission(draft),
  );
  TestValidator.equals(
    "the reference run satisfies the whole law",
    reference.filmScore?.toFixed(4),
    "1.0000",
  );
  const repaintWithoutEvidence = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      lane: "repaint",
    }),
  );
  const featureDigest = draft.deliverables.find(
    (file) => file.kind === "feature",
  )!.digest;
  const repaintWithEvidence = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      lane: "repaint",
      repaint: {
        status: "verified",
        adapterIdentity:
          '{"execution":"local","model":"fixture","protocolVersion":"automovie.repaint-runtime.v1","provider":"fixture","version":"1"}',
        shots: [
          {
            shot: "opening",
            receiptDigest: featureDigest,
            outputDigest: featureDigest,
            sourceReviewFingerprint: featureDigest,
            renditionReviewFingerprint: featureDigest,
          },
        ],
        featureDigest,
      },
    }),
  );
  TestValidator.equals(
    "repaint lane requires structured runtime, receipt, review, output, and feature evidence",
    [
      repaintWithoutEvidence.outcome,
      repaintWithoutEvidence.outcome === "gate-failed"
        ? repaintWithoutEvidence.failedGate
        : null,
      repaintWithEvidence.filmScore?.toFixed(4),
    ],
    ["gate-failed", "final-compile", "1.0000"],
  );
  TestValidator.equals(
    "every axis reports the fraction of its own assertions that passed",
    reference.outcome === "scored"
      ? reference.axes.map(
          (axis) => `${axis.axis}:${axis.passed}/${axis.total}`,
        )
      : [],
    [
      "historical:2/2",
      "production:2/2",
      "frame:2/2",
      "invariant:2/2",
      "delivery:4/4",
    ],
  );
  TestValidator.equals(
    "every settled assertion carries its evidence address",
    reference.outcome === "scored"
      ? reference.assertions
          .filter((result) => result.id.startsWith("delivery:") === false)
          .map((result) => result.evidence)
      : [],
    [
      "observation:event-order:column-before-signal",
      "observation:landmark:pratzen-height-meters",
      "observation:formation:allied-column:count",
      "observation:production:fps",
      "archive:evidence/frames/opening-beauty.png",
      "archive:evidence/frames/opening-mask.png",
      "observation:joint:sentinel:leftUpperArm:abduction-deg",
      "observation:physics:max-ground-penetration-m",
    ],
  );

  const operatorTask: IAutoMovieBenchmarkTask = {
    ...task,
    historicalLaw: [
      {
        id: "op/not-equal",
        statement: "The column is not idle.",
        observation: "production:fps",
        operator: "!=",
        value: 0,
        tolerance: 0.5,
      },
      {
        id: "op/greater",
        statement: "The column is strictly deeper than one rank.",
        observation: "production:fps",
        operator: ">",
        value: 23,
        tolerance: 0.5,
      },
    ],
    productionLaw: [
      {
        id: "op/less",
        statement: "The slope is strictly below the summit.",
        observation: "production:fps",
        operator: "<",
        value: 25,
        tolerance: 0.5,
      },
      {
        id: "op/less-equal-fails",
        statement: "A comparand a tolerant equality still refuses.",
        observation: "production:fps",
        operator: "<=",
        value: 20,
        tolerance: 0.5,
      },
    ],
  };
  const operators = judgeAutoMovieBenchmarkSubmission(
    operatorTask,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      taskDigest: validateAutoMovieBenchmarkTask(operatorTask),
    }),
  );
  TestValidator.equals(
    "each comparison operator settles on its own terms",
    operators.outcome === "scored"
      ? operators.assertions
          .filter((result) => result.id.startsWith("op/"))
          .map((result) => `${result.id}:${result.outcome}`)
      : [],
    [
      "op/not-equal:pass",
      "op/greater:pass",
      "op/less:pass",
      "op/less-equal-fails:fail",
    ],
  );

  const silent = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      observations: Object.fromEntries(
        Object.entries(draft.observations).filter(
          ([key]) => key !== "production:fps",
        ),
      ),
      frames: draft.frames.filter((frame) => frame.pass !== "mask"),
      deliverables: draft.deliverables.filter(
        (file) => file.kind !== "captions",
      ),
      finishedRuntimeSeconds: null,
    }),
  );
  TestValidator.equals(
    "absent evidence settles unknown, never pass",
    silent.outcome === "scored"
      ? silent.assertions
          .filter((result) => result.outcome !== "pass")
          .map((result) => `${result.id}:${result.outcome}`)
      : [],
    [
      "production/frame-clock:unknown",
      "frame/signal-apex-mask:unknown",
      "delivery:captions:unknown",
      "delivery:runtime:unknown",
    ],
  );

  const wrong = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...draft,
      frames: draft.frames.map((frame) =>
        frame.pass === "mask" ? { ...frame, width: 640 } : frame,
      ),
      deliverables: draft.deliverables.map((file) =>
        file.kind === "captions" ? { ...file, probeValid: false } : file,
      ),
      finishedRuntimeSeconds: 12,
    }),
  );
  TestValidator.equals(
    "wrong evidence settles fail, and both stay out of the pass count",
    wrong.outcome === "scored"
      ? wrong.assertions
          .filter((result) => result.outcome !== "pass")
          .map((result) => `${result.id}:${result.outcome}`)
      : [],
    [
      "frame/signal-apex-mask:fail",
      "delivery:captions:fail",
      "delivery:runtime:fail",
    ],
  );

  const mask = draft.frames.find((frame) => frame.pass === "mask")!;
  const otherFrames = draft.frames.filter((frame) => frame !== mask);
  const invalidMask = {
    ...mask,
    width: 640,
    bytes: 1,
    probeValid: false,
  };
  const retriedFrames = [
    [invalidMask, mask, ...otherFrames],
    [mask, invalidMask, ...otherFrames],
  ].map((frames) =>
    judgeAutoMovieBenchmarkSubmission(
      task,
      sealAutoMovieBenchmarkSubmission({ ...draft, frames }),
    ),
  );
  TestValidator.equals(
    "a valid retry satisfies the frame law in either archive order",
    retriedFrames.map((verdict) =>
      verdict.outcome === "scored"
        ? verdict.assertions.find(
            (result) => result.id === "frame/signal-apex-mask",
          )?.outcome
        : null,
    ),
    ["pass", "pass"],
  );

  const secondInvalidMask = {
    ...invalidMask,
    bytes: 2,
  };
  const invalidRetries = [
    [secondInvalidMask, invalidMask, ...otherFrames],
    [invalidMask, secondInvalidMask, ...otherFrames],
  ].map((frames) =>
    judgeAutoMovieBenchmarkSubmission(
      task,
      sealAutoMovieBenchmarkSubmission({ ...draft, frames }),
    ),
  );
  TestValidator.equals(
    "failed retries select the same canonical diagnostic in either archive order",
    invalidRetries.map((verdict) => {
      const assertion =
        verdict.outcome === "scored"
          ? verdict.assertions.find(
              (result) => result.id === "frame/signal-apex-mask",
            )
          : undefined;
      return assertion === undefined
        ? null
        : [assertion.outcome, assertion.observed];
    }),
    [
      ["fail", 1],
      ["fail", 1],
    ],
  );

  TestValidator.equals(
    "an unweighted empty axis contributes nothing and caps nothing",
    score(
      {
        ...task,
        physicalInvariants: [],
        weights: { ...task.weights, invariant: 0, delivery: 0.35 },
      },
      draft,
    ),
    "1.0000",
  );

  TestValidator.equals(
    "each fixed mutant earns exactly the score its band pins",
    austerlitzSignalMutants().map((mutant) =>
      Number(
        judgeAutoMovieBenchmarkSubmission(
          task,
          mutant.submission,
        ).filmScore?.toFixed(4),
      ),
    ),
    [0.875, 0.9, 0.9625],
  );
};
