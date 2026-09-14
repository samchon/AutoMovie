import {
  buildPortraitPerformanceGlobe,
  posePortraitLidCurves,
  posePortraitOpticalMesh,
} from "@automovie/human";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Finite optical inputs do not authorize nonfinite derived coordinates.
 *
 * Scenarios:
 * 1. Large representable centres and unchanged lid observations retain finite geometry.
 * 2. Reopening a nearly closed extreme aperture, rotating an overflowing offset/normal and placing an overflowing sphere refuse.
 */
export const test_subject_eye_arithmetic = (): void => {
  const performance = { blink: 0, observedBlink: 0, yaw: 0, pitch: 0 };
  const upper = [-1, 0, 1].map((x) => ({ x, y: 1e308, z: 0 }));
  const lower = upper.map((point) => ({ ...point, y: -1e308 }));
  TestValidator.equals(
    "finite identity remains admitted",
    posePortraitLidCurves(upper, lower, performance),
    { upper, lower },
  );
  TestValidator.predicate(
    "reopened lid overflow refuses",
    throwsError(() =>
      posePortraitLidCurves(upper, lower, {
        ...performance,
        observedBlink: 0.95,
      }),
    ),
  );
  const mesh: IAutoMovieMesh = {
    positions: [1e308, 0, 0],
    normals: null,
    indices: [],
    uvs: null,
    skin: null,
  };
  TestValidator.predicate(
    "large optical identity is finite",
    posePortraitOpticalMesh(
      mesh,
      { x: 0, y: 0, z: 0 },
      performance,
    ).positions.every(Number.isFinite),
  );
  TestValidator.predicate(
    "opposed centre overflow refuses",
    throwsError(() =>
      posePortraitOpticalMesh(
        mesh,
        { x: -1e308, y: 0, z: 0 },
        { ...performance, yaw: 30 },
      ),
    ),
  );
  TestValidator.predicate(
    "normal arithmetic overflow refuses",
    throwsError(() =>
      posePortraitOpticalMesh(
        { ...mesh, positions: [0, 0, 0], normals: [1.7e308, 0, 1.7e308] },
        { x: 0, y: 0, z: 0 },
        { ...performance, yaw: 45 },
      ),
    ),
  );
  const sphere = { center: { x: 0, y: 1e308, z: 0 }, radius: 1e307 };
  TestValidator.predicate(
    "large sphere is representable",
    buildPortraitPerformanceGlobe(sphere, 3, 2).positions.every(
      Number.isFinite,
    ),
  );
  TestValidator.predicate(
    "sphere placement overflow refuses",
    throwsError(() =>
      buildPortraitPerformanceGlobe({ ...sphere, radius: 1e308 }, 3, 2),
    ),
  );
};
