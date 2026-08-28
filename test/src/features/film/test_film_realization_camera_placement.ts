import {
  compileDefinedShot,
  defineShot,
  resolveCameraAt,
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
import { namedFacts, qclose, vclose } from "../internal/predicates";

/**
 * The duel program with the camera framed exactly as `framed` asks. Dropping
 * the `frame` action leaves the beat locked off on the staged camera, which is
 * the shape every artifact carried before a placement existed to record.
 */
const program = (framed: boolean): IAutoMovieShotProgram => {
  const blocking = makeBlockingWrite();
  const performance = makePerformanceWrite();
  blocking.camera.framing = "full";
  blocking.rationale =
    "full static keeps both required actor roots readable throughout the duel.";
  for (const action of performance.draft)
    if (action.verb === "frame") action.framing = "full";
  if (framed === false)
    performance.draft = performance.draft.filter(
      (action) => action.verb !== "frame",
    );
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

const compile = (framed: boolean) =>
  compileDefinedShot({
    shot: defineShot(framed ? "SB-FRAMED" : "SB-LOCKED", {
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
          requiredSubjects: ["knightA"],
          maxOcclusionRatio: 0.2,
        },
        events: [],
        reviewFrames: [{ id: "impact", time: 1, passes: ["beauty"] }],
      },
      build: () => program(framed),
    }),
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      advice: [],
    },
  });

/**
 * A compiled realization states the camera it measured whenever a `frame`
 * action moved the shot off its staged camera.
 *
 * The staged transform and the action are not rivals: `compileCameraMove` keeps
 * the staged bearing and replaces the distance with the one the framing demands,
 * so a camera staged for a wide can be solved to a fraction of that stand-off
 * while `scene.cameras[i].transform` in the same artifact still reads exactly as
 * authored. Every static camera fact the artifact carried therefore described
 * the solve's input rather than the frame, and an author reading it concluded
 * the camera was fine. The placement is that missing fact, recorded at each
 * sample the realization already measured.
 *
 * Scenarios:
 *
 * 1. A framed beat carries a placement at every camera sample, and it is exactly
 *    the camera `resolveCameraAt` gives the renderer at that instant.
 * 2. That placement is a different point from the staged transform, which is
 *    what makes the record worth writing.
 * 3. A beat with no `frame` action compiles no move and records no placement, so
 *    its realization adds only the addressed depth report to the pre-existing
 *    locked-camera record.
 */
export const test_film_realization_camera_placement = (): void => {
  const framed = compile(true);
  const locked = compile(false);
  const staged = { x: 2, y: 1.5, z: 0.35 };
  TestValidator.equals(
    "a realization records the camera a compiled move actually renders",
    namedFacts([
      ["framedSuccess", () => framed.success],
      ["lockedSuccess", () => locked.success],
      [
        "framedHasMove",
        () => framed.success && framed.source.shot.cameraMotion !== null,
      ],
      [
        "lockedHasNoMove",
        () => locked.success && locked.source.shot.cameraMotion === null,
      ],
      [
        "framedSamplesCarryPlacement",
        () =>
          framed.success &&
          framed.realization.camera.length > 0 &&
          framed.realization.camera.every(
            (outcome) => outcome.placement !== undefined,
          ),
      ],
      [
        "framedPlacementIsTheRenderedCamera",
        () =>
          framed.success &&
          framed.realization.camera.every((outcome) => {
            const camera = framed.source.scene.cameras.find(
              (candidate) => candidate.id === framed.source.shot.camera,
            )!;
            const rendered = resolveCameraAt(
              camera.transform,
              framed.source.shot.cameraMotion,
              camera.id,
              outcome.time,
            );
            return (
              outcome.placement !== undefined &&
              vclose(outcome.placement.position, rendered.position, 0) &&
              qclose(outcome.placement.rotation, rendered.rotation, 0)
            );
          }),
      ],
      [
        "framedStagedCameraIsUnchanged",
        () =>
          framed.success &&
          vclose(
            framed.source.scene.cameras.find(
              (candidate) => candidate.id === framed.source.shot.camera,
            )!.transform.translation,
            staged,
          ),
      ],
      [
        "framedPlacementLeavesTheStagedPoint",
        () =>
          framed.success &&
          framed.realization.camera.every(
            (outcome) =>
              outcome.placement !== undefined &&
              vclose(outcome.placement.position, staged) === false,
          ),
      ],
      [
        "lockedSamplesCarryNoPlacement",
        () =>
          locked.success &&
          locked.realization.camera.length > 0 &&
          locked.realization.camera.every(
            (outcome) => "placement" in outcome === false,
          ),
      ],
      [
        "lockedRecordHasOnlyDepthReportAddition",
        () =>
          locked.success &&
          JSON.stringify(locked.realization.camera) ===
            // The contract samples its opening, its one review frame and its
            // closing, and states one required subject the staged camera holds
            // throughout. Spelling the whole record out is what makes this a
            // byte guard for the one intentional depth-report addition.
            JSON.stringify(
              [0, 1, 2].map((time) => ({
                time,
                depthPrecision: {
                  camera: "cam-main",
                  time,
                  metric: "maximum-adjacent-depth-step",
                  unit: "meters",
                  near: 0.1,
                  far: 1000,
                  requiredNear: 1.8113350546673495,
                  requiredFar: 2.5243811122728674,
                  minimumDepthBits: 24,
                  maximumStepMeters: 100,
                  lowerCode: 16114219,
                  upperCode: 16114220,
                  measuredStepMeters: 0.0000037979279130517796,
                  status: "satisfied",
                  passed: true,
                },
                requiredSubjects: 1,
                resolvedSubjects: 1,
                readableSubjects: 1,
                passed: true,
              })),
            ),
      ],
    ]),
    {
      framedSuccess: true,
      lockedSuccess: true,
      framedHasMove: true,
      lockedHasNoMove: true,
      framedSamplesCarryPlacement: true,
      framedPlacementIsTheRenderedCamera: true,
      framedStagedCameraIsUnchanged: true,
      framedPlacementLeavesTheStagedPoint: true,
      lockedSamplesCarryNoPlacement: true,
      lockedRecordHasOnlyDepthReportAddition: true,
    },
  );
};
