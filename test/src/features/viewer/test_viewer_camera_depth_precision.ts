import type { IAutoMovieCamera, IAutoMovieScene } from "@automovie/interface";
import {
  assertAutoMovieViewerCameraDepthPrecision,
  buildScene,
  evaluateAutoMovieViewerCameraDepthPrecision,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, throwsError } from "../internal/predicates";

const sourceCamera = (
  overrides: Partial<IAutoMovieCamera> = {},
): IAutoMovieCamera => {
  const camera: IAutoMovieCamera = {
    id: "camera-main",
    transform: {
      translation: { x: 0, y: 1, z: 10 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    fovY: 45,
    near: 0.25,
    far: 250,
    depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 0.1 },
    ...overrides,
  };
  camera.depthPrecision = overrides.depthPrecision ?? camera.depthPrecision;
  return camera;
};

const realizedCamera = (
  source: IAutoMovieCamera = sourceCamera(),
): THREE.PerspectiveCamera => {
  const scene: IAutoMovieScene = {
    id: "scene",
    name: null,
    nodes: [],
    cameras: [source],
    lights: [],
  };
  return buildScene(scene, () => undefined).cameras[0]!;
};

const renderer = (
  bits: unknown,
  logarithmic = false,
  reversed = false,
): THREE.WebGLRenderer => {
  const depthBits = 0x0d56;
  return {
    capabilities: {
      logarithmicDepthBuffer: logarithmic,
      reverseDepthBuffer: reversed,
    },
    getContext: () => ({
      DEPTH_BITS: depthBits,
      getParameter: (parameter: number) =>
        parameter === depthBits ? bits : null,
    }),
  } as unknown as THREE.WebGLRenderer;
};

const evaluate = (props: {
  source?: IAutoMovieCamera;
  realized?: THREE.PerspectiveCamera;
  bits?: unknown;
  logarithmic?: boolean;
  reversed?: boolean;
}) => {
  const source = props.source ?? sourceCamera();
  return evaluateAutoMovieViewerCameraDepthPrecision({
    renderer: renderer(props.bits ?? 24, props.logarithmic, props.reversed),
    source,
    realized: props.realized ?? realizedCamera(source),
  });
};

/** Three camera clips and the actual WebGL depth capability stay in parity. */
export const test_viewer_camera_depth_precision = (): void => {
  const accepted = evaluate({});
  TestValidator.equals(
    "buildScene and a standard 24-bit framebuffer preserve the declaration",
    accepted,
    {
      camera: "camera-main",
      sourceNear: 0.25,
      sourceFar: 250,
      realizedNear: 0.25,
      realizedFar: 250,
      minimumDepthBits: 24,
      observedDepthBits: 24,
      projection: "standard",
      status: "satisfied",
      passed: true,
    },
  );

  const mismatched = realizedCamera();
  mismatched.far = 251;
  TestValidator.equals(
    "near/far mismatch and insufficient actual bits are distinct refusals",
    [evaluate({ realized: mismatched }).status, evaluate({ bits: 23 }).status],
    ["projection-mismatch", "insufficient-capability"],
  );

  TestValidator.equals(
    "non-standard depth modes cannot impersonate the fixed-point metric",
    [
      evaluate({ logarithmic: true }).projection,
      evaluate({ reversed: true }).projection,
      evaluate({ logarithmic: true, reversed: true }).projection,
    ],
    ["logarithmic", "reversed", "logarithmic-reversed"],
  );

  TestValidator.equals(
    "invalid default-framebuffer observations stay addressed",
    [
      evaluate({ bits: "24" }),
      evaluate({ bits: 1.5 }),
      evaluate({ bits: -1 }),
    ].map((report) => report.status),
    ["invalid-capability", "invalid-capability", "invalid-capability"],
  );

  const invalidSources = [
    sourceCamera({ id: " " }),
    sourceCamera({ near: Number.NaN }),
    sourceCamera({ near: 0 }),
    sourceCamera({ far: Number.POSITIVE_INFINITY }),
    sourceCamera({ near: 1, far: 1 }),
    sourceCamera({
      depthPrecision: { minimumDepthBits: 1.5, maximumStepMeters: 1 },
    }),
    sourceCamera({
      depthPrecision: { minimumDepthBits: 0, maximumStepMeters: 1 },
    }),
    sourceCamera({
      depthPrecision: { minimumDepthBits: 54, maximumStepMeters: 1 },
    }),
    sourceCamera({
      depthPrecision: {
        minimumDepthBits: 24,
        maximumStepMeters: Number.NaN,
      },
    }),
    sourceCamera({
      depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 0 },
    }),
  ];
  TestValidator.predicate(
    "malformed portable camera operands never become viewer capability passes",
    invalidSources.every(
      (source) => evaluate({ source }).status === "invalid-source",
    ),
  );

  const nonFinite = sourceCamera({ near: Number.NaN });
  const nonFiniteRealized = realizedCamera();
  nonFiniteRealized.far = Number.POSITIVE_INFINITY;
  const serializable = evaluate({
    source: nonFinite,
    realized: nonFiniteRealized,
    bits: "unknown",
  });
  TestValidator.equals(
    "non-finite and non-numeric observations serialize as null",
    [
      serializable.sourceNear,
      serializable.realizedFar,
      serializable.observedDepthBits,
    ],
    [null, null, null],
  );

  TestValidator.equals(
    "assertion returns the passing report and throws the exact negative twin",
    namedFacts([
      [
        "pass",
        () =>
          assertAutoMovieViewerCameraDepthPrecision({
            renderer: renderer(24),
            source: sourceCamera(),
            realized: realizedCamera(),
          }).passed,
      ],
      [
        "refuse",
        () =>
          throwsError(() =>
            assertAutoMovieViewerCameraDepthPrecision({
              renderer: renderer(16),
              source: sourceCamera(),
              realized: realizedCamera(),
            }),
          ),
      ],
    ]),
    { pass: true, refuse: true },
  );
};
