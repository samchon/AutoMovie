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

const program = (): IAutoMovieShotProgram => ({
  script: makeScriptWrite(),
  stage: makeStagingWrite(),
  blocking: makeBlockingWrite(),
  performance: makePerformanceWrite(),
  eventSamples: [],
});

/**
 * A registered source module drives the full film engine without MCP.
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
          response: advice,
          decision: null,
          rationale: null,
        },
      ],
    },
  });
  TestValidator.predicate(
    "registered code reaches the complete engine pipeline",
    compiled.success &&
      compiled.source.shot.id === "SB-012" &&
      compiled.source.shot.scene === "scene-duel" &&
      compiled.continuity.opening.shot === "SB-012" &&
      compiled.continuity.closing.shot === "SB-012" &&
      compiled.realization.camera.every((outcome) => outcome.passed) &&
      compiled.continuity.closing.actors.every(
        (actor) =>
          "gaitPhase" in actor &&
          "rootVelocity" in actor &&
          "footPlants" in actor &&
          "mount" in actor,
      ),
  );
  TestValidator.predicate(
    "D010 response remains optional data",
    compiled.success &&
      compiled.advice[0]?.id === "duel-contact" &&
      compiled.advice[0].decision === null &&
      compiled.advice[0].response.impact.impulse.z !== 0,
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
  TestValidator.predicate(
    "registration mismatch is an actionable diagnostic, not a throw",
    mismatched.success === false &&
      mismatched.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "contract-mismatch" &&
          diagnostic.path === "$program.stage.scene.id" &&
          diagnostic.recovery.includes("defineShot"),
      ),
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
  TestValidator.predicate(
    "source output cannot self-certify an unrealized state contract",
    unrealized.success === false &&
      unrealized.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "contract-realization-failed" &&
          diagnostic.fact.includes("impossible-opening"),
      ) &&
      unrealized.diagnostics.some((diagnostic) =>
        diagnostic.fact.includes('actor "ghost"'),
      ),
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
  TestValidator.predicate(
    "runtime exceptions remain structured at the public authoring boundary",
    runtimeFailure.success === false &&
      runtimeFailure.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "pipeline-failed" &&
          diagnostic.phase === "performance" &&
          diagnostic.fact.includes("synthesizer fixture failed") &&
          diagnostic.impact.length !== 0 &&
          diagnostic.recovery.length !== 0,
      ),
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
  TestValidator.predicate(
    "continuity exceptions remain structured at the public boundary",
    continuityFailure.success === false &&
      continuityFailure.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "pipeline-failed" &&
          diagnostic.phase === "continuity" &&
          diagnostic.fact.includes("duplicated"),
      ),
  );
};
