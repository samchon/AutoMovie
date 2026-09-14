import {
  assertPortraitEyePerformance,
  posePortraitLidCurves,
  posePortraitOpticalMesh,
} from "@automovie/human";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError, vclose } from "../internal/predicates";

/**
 * Eyelid closure is an observed-relative tissue motion; gaze is a rigid optical rotation.
 *
 * Scenarios:
 * 1. Open, half-closed, closed and inverted observation use the common 3:1 closure seam.
 * 2. Identity results are owned copies; yaw and pitch preserve the optical radius and rotate normals.
 * 3. Finite bounds are accepted and adjacent closure, sampling and buffer errors refuse.
 */
export const test_subject_eye_performance = (): void => {
  const performance = { blink: 0, observedBlink: 0, yaw: 0, pitch: 0 };
  const upper = [
    { x: -2, y: 0, z: 0 },
    { x: 0, y: 3, z: 0 },
    { x: 2, y: 0, z: 0 },
  ];
  const lower = upper.map((point) => ({ ...point, y: -point.y / 3 }));
  const identity = posePortraitLidCurves(upper, lower, performance);
  TestValidator.equals("observation replay", identity, { upper, lower });
  identity.upper[1].y = 9;
  TestValidator.equals("lid ownership", upper[1].y, 3);
  const half = posePortraitLidCurves(upper, lower, {
    ...performance,
    blink: 0.5,
  });
  TestValidator.equals(
    "half closure",
    [half.upper[1].y, half.lower[1].y],
    [1.5, -0.5],
  );
  const closed = posePortraitLidCurves(upper, lower, {
    ...performance,
    blink: 1,
  });
  TestValidator.equals("shared closed seam", closed.upper, closed.lower);
  const neutral = posePortraitLidCurves(upper, lower, {
    ...performance,
    observedBlink: 0.5,
  });
  TestValidator.equals(
    "neutral from observation",
    [neutral.upper[1].y, neutral.lower[1].y],
    [6, -2],
  );
  for (const band of [
    [],
    upper.slice(1),
    [{ ...upper[0], x: NaN }, ...upper.slice(1)],
  ])
    TestValidator.predicate(
      "invalid pairing",
      throwsError(() => posePortraitLidCurves(band, lower, performance)),
    );
  TestValidator.predicate(
    "unpaired lower curve",
    throwsError(() => posePortraitLidCurves(upper, [], performance)),
  );
  for (const patch of [
    { blink: 1, observedBlink: 0.95, yaw: 50, pitch: 40 },
    { yaw: -50, pitch: -40 },
  ])
    assertPortraitEyePerformance({ ...performance, ...patch });
  for (const patch of [
    { blink: -0.01 },
    { blink: 1.01 },
    { observedBlink: -0.01 },
    { observedBlink: 0.951 },
    { yaw: 50.1 },
    { pitch: -40.1 },
    { blink: NaN },
    { yaw: Infinity },
    { pitch: undefined },
  ])
    TestValidator.predicate(
      "performance guard",
      throwsError(() =>
        assertPortraitEyePerformance({
          ...performance,
          ...patch,
        } as typeof performance),
      ),
    );
  const mesh: IAutoMovieMesh = {
    positions: [10, 20, 32],
    normals: [0, 0, 1],
    indices: [],
    uvs: null,
    skin: null,
  };
  const center = { x: 10, y: 20, z: 30 };
  const copy = posePortraitOpticalMesh(mesh, center, performance);
  TestValidator.equals("zero gaze exact", copy, mesh);
  copy.positions[0] = 0;
  TestValidator.equals("optical ownership", mesh.positions[0], 10);
  const yaw = posePortraitOpticalMesh(mesh, center, {
    ...performance,
    yaw: 30,
  });
  TestValidator.predicate(
    "yaw position",
    vclose(
      { x: yaw.positions[0], y: yaw.positions[1], z: yaw.positions[2] },
      { x: 11, y: 20, z: 30 + Math.sqrt(3) },
    ),
  );
  TestValidator.predicate(
    "yaw normal has no translation",
    nclose(yaw.normals![0], 0.5) && nclose(yaw.normals![2], Math.sqrt(3) / 2),
  );
  const pitch = posePortraitOpticalMesh({ ...mesh, normals: null }, center, {
    ...performance,
    pitch: 30,
  });
  TestValidator.predicate(
    "positive pitch upwards",
    nclose(pitch.positions[1], 21) &&
      nclose(pitch.positions[2], 30 + Math.sqrt(3)),
  );
  for (const patch of [
    { positions: [NaN, 0, 0] },
    { positions: [0] },
    { normals: [0] },
    { normals: [0, Infinity, 0] },
  ])
    TestValidator.predicate(
      "invalid optical buffer",
      throwsError(() =>
        posePortraitOpticalMesh({ ...mesh, ...patch }, center, performance),
      ),
    );
  TestValidator.predicate(
    "invalid optical centre",
    throwsError(() =>
      posePortraitOpticalMesh(mesh, { ...center, z: Infinity }, performance),
    ),
  );
};
