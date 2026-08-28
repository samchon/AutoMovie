import {
  evaluateAutoMovieCameraDepthPrecision,
  realizeShotContract,
} from "@automovie/engine";
import type {
  IAutoMovieCamera,
  IAutoMovieFormationDesign,
  IAutoMovieModel,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const transform = (z = 0) => ({
  translation: { x: 0, y: 0, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const model: IAutoMovieModel = {
  id: "required-box-model",
  name: null,
  origin: "generated",
  parts: [
    {
      id: "box",
      name: null,
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 2, height: 2, depth: 4 },
      },
      material: null,
      attachedBone: null,
      transform: transform(),
    },
  ],
  skeleton: null,
  body: null,
  materials: [],
  asset: null,
};

const contract: IAutoMovieShotContract = {
  id: "shot-depth",
  beat: "beat",
  source: { module: "src/shots/depth.ts", export: "shot" },
  durationSeconds: 2,
  participants: [],
  opening: [],
  closing: [],
  camera: {
    intent: "hold the required environment box",
    requiredSubjects: ["required-box"],
    maxOcclusionRatio: 1,
  },
  events: [],
  reviewFrames: [{ id: "middle", time: 1, passes: ["beauty"] }],
};

const camera = (
  overrides: Partial<IAutoMovieCamera> = {},
): IAutoMovieCamera => {
  const value: IAutoMovieCamera = {
    id: "camera-main",
    transform: transform(10),
    fovY: 90,
    near: 1,
    far: 100,
    depthPrecision: { minimumDepthBits: 8, maximumStepMeters: 1 },
    ...overrides,
  };
  value.depthPrecision = overrides.depthPrecision ?? value.depthPrecision;
  return value;
};

const realize = (resolvedCamera: IAutoMovieCamera) =>
  realizeShotContract({
    contract,
    production: null,
    frameFormat: { width: 100, height: 100 },
    world: null,
    formations: new Map<string, IAutoMovieFormationDesign>(),
    compiled: {
      eventSamples: [],
      scene: {
        id: "scene-depth",
        name: null,
        nodes: [
          {
            id: "required-box",
            model: model.id,
            transform: transform(),
            pose: null,
            motion: null,
          },
        ],
        cameras: [resolvedCamera],
        lights: [],
      },
      motions: [],
      shot: {
        id: contract.id,
        name: null,
        scene: "scene-depth",
        camera: resolvedCamera.id,
        duration: contract.durationSeconds,
        performances: [],
        objectMotions: [],
        cameraMotion: null,
      },
      models: [model],
    },
    collisions: [],
  });

/** Realization derives precision from the current required geometry bounds. */
export const test_film_camera_depth_precision_realization = (): void => {
  const expected = evaluateAutoMovieCameraDepthPrecision({
    camera: "camera-main",
    time: 0,
    near: 1,
    far: 100,
    requiredNear: 8,
    requiredFar: 12,
    constraint: { minimumDepthBits: 8, maximumStepMeters: 1 },
  });
  const accepted = realize(camera());
  TestValidator.equals(
    "every addressed sample reports the exact current box depth range",
    namedFacts([
      ["diagnostics", () => accepted.diagnostics.length === 0],
      ["samples", () => accepted.realization.camera.length === 3],
      [
        "range",
        () =>
          accepted.realization.camera.every(
            (sample) =>
              sample.depthPrecision.requiredNear === 8 &&
              sample.depthPrecision.requiredFar === 12,
          ),
      ],
      [
        "measurement",
        () =>
          accepted.realization.camera.every(
            (sample) =>
              sample.depthPrecision.measuredStepMeters ===
                expected.measuredStepMeters && sample.depthPrecision.passed,
          ),
      ],
      [
        "identity",
        () =>
          accepted.realization.camera
            .map((sample) => sample.depthPrecision.time)
            .join(",") === "0,1,2",
      ],
    ]),
    {
      diagnostics: true,
      samples: true,
      range: true,
      measurement: true,
      identity: true,
    },
  );

  const outside = realize(camera({ far: 10 }));
  TestValidator.predicate(
    "a partly visible box outside the full required clip interval is refused",
    outside.realization.camera.every(
      (sample) =>
        sample.readableSubjects === 1 &&
        sample.depthPrecision.status === "outside-clipping-range" &&
        sample.passed === false,
    ) && outside.diagnostics.length === 3,
  );

  const insufficient = realize(
    camera({
      depthPrecision: {
        minimumDepthBits: 8,
        maximumStepMeters: expected.measuredStepMeters! / 2,
      },
    }),
  );
  TestValidator.predicate(
    "a precision-only negative twin fails every addressed realization sample",
    insufficient.realization.camera.every(
      (sample) =>
        sample.depthPrecision.status === "insufficient-precision" &&
        sample.passed === false,
    ) && insufficient.diagnostics.length === 3,
  );

  TestValidator.equals(
    "repeat realization is byte-stable",
    JSON.stringify(realize(camera()).realization.camera),
    JSON.stringify(accepted.realization.camera),
  );
};
