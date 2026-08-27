import {
  compileDefinedShot,
  defineShot,
  suggestCollisionResponse,
} from "@automovie/engine";
import { IAutoMovieShotProgram } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const program = (): IAutoMovieShotProgram => {
  const blocking = makeBlockingWrite();
  const performance = makePerformanceWrite();
  blocking.camera.framing = "full";
  blocking.rationale =
    "full static keeps both required actor roots readable throughout the duel.";
  for (const action of performance.draft)
    if (action.verb === "frame") action.framing = "full";
  return {
    actors: [
      { node: "knightA", model: "knightA", speed: 1, eyeHeight: 1.6 },
      { node: "knightB", model: "knightB", speed: 1, eyeHeight: 1.6 },
    ],
    script: makeScriptWrite(),
    stage: makeStagingWrite(),
    blocking,
    performance,
    eventSamples: [],
  };
};

/**
 * A registered source module drives the full film engine without aP.
 *
 * The registration owns the emitted shot id and scene/contract identity; the
 * engine runs stage, blocking, thin-verb synthesis, ROM/artifact gates and
 * opening/closing continuity measurement. D010 collision output remains data
 * beside the result and is never silently applied to the compiled motions.
 */
export const test_film_defined_shot = (): void => {
  const shot = defineShot("SB-012", {
    scene: "scene-duel",
    contract: {
      beat: "beat-1",
      durationSeconds: 2,
      participants: [
        { kind: "actor", id: "knightA" },
        { kind: "actor", id: "knightB" },
      ],
      opening: [],
      closing: [],
      camera: {
        intent: "Keep the duel readable.",
        requiredSubjects: ["knightA", "knightB"],
        maxOcclusionRatio: 0.2,
      },
      events: [],
      reviewFrames: [{ id: "impact", time: 1, passes: ["beauty"] }],
    },
    build: program,
  });
  const advice = suggestCollisionResponse({
    a: {
      mass: 80,
      velocity: { x: 0, y: 0, z: 3 },
      restitution: 0.1,
      hardness: 0.6,
      penetrability: 0,
    },
    b: {
      mass: 75,
      velocity: { x: 0, y: 0, z: 0 },
      restitution: 0.1,
      hardness: 0.4,
      penetrability: 0,
    },
    normal: { x: 0, y: 0, z: 1 },
    gainDegPerImpulse: 0.2,
  });
  const compiled = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      advice: [
        {
          id: "duel-contact",
          proposal: advice,
          decision: null,
          selected: null,
          rationale: null,
        },
      ],
    },
  });
  TestValidator.equals(
    "registered code reaches the complete engine pipeline",
    namedFacts([
      ["compiledSuccess", () => compiled.success],
      [
        "compiledSourceShot",
        () => compiled.success && compiled.source.shot.id === "SB-012",
      ],
      [
        "compiledSourceShot2",
        () => compiled.success && compiled.source.shot.scene === "scene-duel",
      ],
      [
        "compiledContinuityOpening",
        () => compiled.success && compiled.continuity.opening.shot === "SB-012",
      ],
      [
        "compiledContinuityClosing",
        () => compiled.success && compiled.continuity.closing.shot === "SB-012",
      ],
      [
        "compiledRealizationCamera",
        () =>
          compiled.success &&
          compiled.realization.camera.every((outcome) => outcome.passed),
      ],
      [
        "compiledContinuityClosing2",
        () =>
          compiled.success &&
          compiled.continuity.closing.actors.every(
            (actor) =>
              "gaitPhase" in actor &&
              "rootVelocity" in actor &&
              "footPlants" in actor &&
              "mount" in actor,
          ),
      ],
    ]),
    {
      compiledSuccess: true,
      compiledSourceShot: true,
      compiledSourceShot2: true,
      compiledContinuityOpening: true,
      compiledContinuityClosing: true,
      compiledRealizationCamera: true,
      compiledContinuityClosing2: true,
    },
  );
  TestValidator.equals(
    "D010 response remains optional data",
    namedFacts([
      ["compiledSuccess", () => compiled.success],
      [
        "compiledAdviceId",
        () => compiled.success && compiled.advice[0]?.id === "duel-contact",
      ],
      [
        "compiledAdviceDecision",
        () => compiled.success && compiled.advice[0].decision === null,
      ],
      [
        "compiledAdviceProposal",
        () =>
          compiled.success &&
          compiled.advice[0].decision === null &&
          compiled.advice[0].proposal.impact.impulse.z !== 0,
      ],
      [
        "compiledAdviceSelected",
        () =>
          compiled.success &&
          compiled.advice[0].decision === null &&
          compiled.advice[0].selected === null,
      ],
    ]),
    {
      compiledSuccess: true,
      compiledAdviceId: true,
      compiledAdviceDecision: true,
      compiledAdviceProposal: true,
      compiledAdviceSelected: true,
    },
  );

  const modifiedResponse = structuredClone(advice);
  modifiedResponse.push.flexion = (modifiedResponse.push.flexion ?? 0) + 1;
  const decisions = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      advice: [
        {
          id: "accepted",
          proposal: advice,
          decision: "accepted",
          selected: {
            recoil: structuredClone(advice.recoil),
            push: structuredClone(advice.push),
            impact: structuredClone(advice.impact),
          },
          rationale: "The measured exchange serves the grounded hit.",
        },
        {
          id: "modified",
          proposal: advice,
          decision: "modified",
          selected: modifiedResponse,
          rationale: "The stylized recoil needs one more degree.",
        },
        {
          id: "rejected",
          proposal: advice,
          decision: "rejected",
          selected: null,
          rationale: "The contact is intentionally supernatural.",
        },
      ],
    },
  });
  TestValidator.equals(
    "D010 accepted, modified, and rejected decisions remain distinguishable",
    namedFacts([
      ["decisionsSuccess", () => decisions.success],
      [
        "decisionsAdviceDecision",
        () => decisions.success && decisions.advice[0]?.decision === "accepted",
      ],
      [
        "decisionsAdviceDecision2",
        () => decisions.success && decisions.advice[1]?.decision === "modified",
      ],
      [
        "decisionsAdviceSelected",
        () =>
          decisions.success &&
          decisions.advice[1].selected?.push.flexion ===
            modifiedResponse.push.flexion,
      ],
      [
        "decisionsAdviceDecision3",
        () => decisions.success && decisions.advice[2]?.decision === "rejected",
      ],
      [
        "decisionsAdviceSelected2",
        () => decisions.success && decisions.advice[2].selected === null,
      ],
    ]),
    {
      decisionsSuccess: true,
      decisionsAdviceDecision: true,
      decisionsAdviceDecision2: true,
      decisionsAdviceSelected: true,
      decisionsAdviceDecision3: true,
      decisionsAdviceSelected2: true,
    },
  );

  const mismatched = compileDefinedShot({
    shot: defineShot("SB-013", {
      scene: "another-scene",
      contract: shot.contract,
      build: program,
    }),
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
    },
  });
  TestValidator.equals(
    "registration mismatch is an actionable diagnostic, not a throw",
    namedFacts([
      ["refused", () => mismatched.success === false],
      [
        "violated",
        () =>
          mismatched.success === false &&
          mismatched.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "contract-mismatch" &&
              diagnostic.path === "$program.stage.scene.id" &&
              diagnostic.recovery.includes("defineShot"),
          ),
      ],
    ]),
    { refused: true, violated: true },
  );

  const unrealized = compileDefinedShot({
    shot: defineShot("SB-014", {
      scene: "scene-duel",
      contract: {
        ...shot.contract,
        participants: [
          ...shot.contract.participants,
          { kind: "actor", id: "ghost" },
        ],
        opening: [
          {
            id: "impossible-opening",
            description: "The authored actor must be far outside this scene.",
            predicates: [
              {
                kind: "position",
                subject: { kind: "node", id: "knightA" },
                axis: "x",
                operator: ">=",
                value: 99,
                tolerance: 0,
              },
            ],
          },
        ],
      },
      build: program,
    }),
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
    },
  });
  TestValidator.equals(
    "source output cannot self-certify an unrealized state contract",
    namedFacts([
      ["unrealizedSuccess", () => unrealized.success === false],
      [
        "unrealizedDiagnosticsDiagnostic",
        () =>
          unrealized.success === false &&
          unrealized.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "contract-realization-failed" &&
              diagnostic.fact.includes("impossible-opening"),
          ),
      ],
      [
        "unrealizedDiagnosticsDiagnostic2",
        () =>
          unrealized.success === false &&
          unrealized.diagnostics.some((diagnostic) =>
            diagnostic.fact.includes('actor "ghost"'),
          ),
      ],
    ]),
    {
      unrealizedSuccess: true,
      unrealizedDiagnosticsDiagnostic: true,
      unrealizedDiagnosticsDiagnostic2: true,
    },
  );

  const runtimeFailure = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: () => {
        throw new Error("synthesizer fixture failed");
      },
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
    },
  });
  TestValidator.equals(
    "runtime exceptions remain structured at the public authoring boundary",
    namedFacts([
      ["refused", () => runtimeFailure.success === false],
      [
        "violated",
        () =>
          runtimeFailure.success === false &&
          runtimeFailure.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "pipeline-failed" &&
              diagnostic.phase === "performance" &&
              diagnostic.fact.includes("synthesizer fixture failed") &&
              diagnostic.impact.length !== 0 &&
              diagnostic.recovery.length !== 0,
          ),
      ],
    ]),
    { refused: true, violated: true },
  );

  const continuityFailure = compileDefinedShot({
    shot,
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      plants: [
        { node: "knightA", plants: [] },
        { node: "knightA", plants: [] },
      ],
    },
  });
  TestValidator.equals(
    "continuity exceptions remain structured at the public boundary",
    namedFacts([
      ["refused", () => continuityFailure.success === false],
      [
        "violated",
        () =>
          continuityFailure.success === false &&
          continuityFailure.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "pipeline-failed" &&
              diagnostic.phase === "continuity" &&
              diagnostic.fact.includes("duplicated"),
          ),
      ],
    ]),
    { refused: true, violated: true },
  );
};
