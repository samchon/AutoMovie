import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Scaling a compact field and its sample together preserves the normalized
 * displacement and unit normal. The independent derivative at half radius is
 * -6*(3/4)^2*(1/2)*(1/10) = -27/160, at every representable scale tested.
 *
 * Scenarios:
 * 1. Unit, 1e-200 and 1e160 radii give height/radius=27/640 and the same
 *    normal, without squaring the physical radius into zero or infinity.
 * 2. Zero displacement is identity, including at a tiny field's centre.
 */
export const test_geometry_mesh_deformation_scale = (): void => {
  for (const radius of [1, 1e-200, 1e160]) {
    for (const amount of [0, 0.1]) {
      const apply = createAutoMovieMeshDeformer([
        {
          center: { x: 0, y: 0, z: 0 },
          radius: { x: radius, y: radius, z: radius },
          displacement: { x: 0, y: 0, z: amount * radius },
          stretch: { x: 0, y: 0, z: 0 },
        },
      ]);
      const result = apply({
        positions: [radius / 2, 0, 0, 0, 0, 0],
        indices: [],
        normals: [0, 0, 1, 0, 0, 1],
        uvs: null,
        skin: null,
      });
      const slope = (amount * 27) / 16;
      TestValidator.predicate(
        "scale-independent normalized displacement",
        nclose(result.positions[2] / radius, (amount * 27) / 64),
      );
      TestValidator.predicate(
        "scale-independent field normal",
        nclose(result.normals![0], slope / Math.hypot(slope, 1)) &&
          nclose(result.normals![2], 1 / Math.hypot(slope, 1)),
      );
      TestValidator.equals(
        "centre retains zero slope",
        result.normals!.slice(3),
        [0, 0, 1],
      );
    }
  }
};
