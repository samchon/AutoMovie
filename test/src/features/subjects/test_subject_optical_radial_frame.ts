import { Quaternion, Vector3, transformAutoMovieMesh } from "@automovie/engine";
import { buildPortraitCornea } from "@automovie/human/geometry/portraitCornea";
import { portraitEyeSphereHeight } from "@automovie/human/geometry/portraitEyeSphere";
import { createPortraitOpticalFrame } from "@automovie/human/geometry/portraitOpticalFrame";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError, vclose } from "../internal/predicates";

/**
 * A radial optical shell retains its local circular dimensions even when a
 * head-plane disc would leave its spherical support.
 *
 * Scenarios:
 * 1. A ten-mm globe aimed along +X maps local Z to X and local X to -Z.
 *    Its corneal pole and shell thickness follow hand-computed sphere sag.
 * 2. A head-plane shell at X=10 refuses beside the admitted radial shell;
 *    antiparallel, axial and extreme finite witnesses retain their directions.
 * 3. Caller mutation cannot move a retained frame. Zero/negative/nonfinite
 *    radius, nonfinite coordinates and a central witness refuse.
 */
export const test_subject_optical_radial_frame = (): void => {
  const sphere = { center: { x: 1, y: 2, z: 3 }, radius: 10 };
  const frame = createPortraitOpticalFrame(sphere, { x: 11, y: 2, z: 3 });
  const options = {
    center: { x: 0, y: 0 },
    radius: 2,
    curvature: 4,
    globeRadius: 10,
    thickness: 0.1,
    rimLift: 0.2,
    extents: [2, 2, 2, 2],
    radialSamples: 1,
  };
  const local = buildPortraitCornea({
    ...options,
    surface: (x, y) => portraitEyeSphereHeight(frame.sphere, x, y),
  });
  const posed = transformAutoMovieMesh(local, frame.transform);
  const pole = 0.2 + 4 - Math.sqrt(12) + Math.sqrt(96);
  TestValidator.predicate(
    "radial pole hand position",
    vclose(
      { x: posed.positions[0], y: posed.positions[1], z: posed.positions[2] },
      { x: 1 + pole, y: 2, z: 3 },
    ),
  );
  TestValidator.predicate(
    "axial thickness follows rotated axis",
    nclose(posed.positions[0] - posed.positions[15], 0.1),
  );
  TestValidator.equals(
    "rigid placement retains topology",
    posed.indices,
    local.indices,
  );
  TestValidator.predicate(
    "old height field cannot support off-axis disc",
    throwsError(
      () =>
        buildPortraitCornea({
          ...options,
          center: { x: 11, y: 2 },
          surface: (x, y) => portraitEyeSphereHeight(sphere, x, y),
        }),
      "inside the fitted sphere",
    ),
  );
  for (const direction of [
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 1e300, y: 1e300, z: 1e300 },
    { x: 1e-300, y: 0, z: 1e-300 },
  ]) {
    const aligned = createPortraitOpticalFrame(
      { center: Vector3.create(), radius: 10 },
      direction,
    );
    TestValidator.predicate(
      "finite axial direction",
      vclose(
        Quaternion.rotateVector(aligned.transform.rotation!, {
          x: 0,
          y: 0,
          z: 1,
        }),
        Vector3.normalize(direction),
      ),
    );
  }
  sphere.center.x = 100;
  TestValidator.equals("frame owns translation", frame.transform.translation, {
    x: 1,
    y: 2,
    z: 3,
  });
  TestValidator.equals("local sphere owns centre", frame.sphere.center, {
    x: 0,
    y: 0,
    z: 0,
  });
  for (const invalid of [
    { center: Vector3.create(), radius: 0 },
    { center: Vector3.create(), radius: -1 },
    { center: Vector3.create(), radius: NaN },
    { center: { x: Infinity, y: 0, z: 0 }, radius: 10 },
  ])
    TestValidator.predicate(
      "invalid globe refuses",
      throwsError(
        () => createPortraitOpticalFrame(invalid, { x: 0, y: 0, z: 10 }),
        "Radial optics",
      ),
    );
  for (const witness of [Vector3.create(), { x: NaN, y: 0, z: 0 }])
    TestValidator.predicate(
      "invalid witness refuses",
      throwsError(
        () =>
          createPortraitOpticalFrame(
            { center: Vector3.create(), radius: 10 },
            witness,
          ),
        "Radial optics",
      ),
    );
};
