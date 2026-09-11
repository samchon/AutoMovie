import { createAutoMovieMeshDeformer } from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * A spatial mask changes the differential of displacement as well as its
 * magnitude. The oracle differentiates f(x)*(1-x²/4)^3 for f=.25+.5*x.
 *
 * Scenarios:
 * 1. At x=0 the masked height is .25 and its slope is .5. At x=1 the
 *    height is .75*27/64 and slope is -.75*27/32+.5*27/64. Normals use
 *    those complete product derivatives, including displacement*mask-gradient.
 * 2. A zero mask is identity, a unit constant mask matches unmasked output,
 *    and invalid sample count, weight or inverse-metre gradient refuses.
 * 3. A mask gradient can reverse a constant-translation map even when the
 *    unfaded field is valid. Its half-strength twin remains oriented, and a
 *    constant mask can moderate a reflected unfaded field into a valid map.
 */
export const test_geometry_mesh_deformation_influence = (): void => {
  const mesh: IAutoMovieMesh = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
    uvs: null,
    skin: null,
  };
  const field = {
    center: { x: 0, y: 0, z: 0 },
    radius: { x: 2, y: 2, z: 2 },
    displacement: { x: 0, y: 0, z: 1 },
    stretch: { x: 0, y: 0, z: 0 },
  };
  const apply = createAutoMovieMeshDeformer([field]);
  const samples = [0.25, 0.75, 0.25].map((weight) => ({
    weight,
    gradient: { x: 0.5, y: 0, z: 0 },
  }));
  const before = structuredClone(samples);
  const result = apply(mesh, samples);
  const slope = (-0.75 * 27) / 32 + (0.5 * 27) / 64;
  TestValidator.predicate(
    "masked analytic heights",
    nclose(result.positions[2], 0.25) &&
      nclose(result.positions[5], (0.75 * 27) / 64),
  );
  TestValidator.predicate(
    "mask gradient contributes at field centre",
    nclose(result.normals![0], -0.5 / Math.hypot(0.5, 1)) &&
      nclose(result.normals![2], 1 / Math.hypot(0.5, 1)),
  );
  TestValidator.predicate(
    "product-rule normal away from centre",
    nclose(result.normals![3], -slope / Math.hypot(slope, 1)) &&
      nclose(result.normals![5], 1 / Math.hypot(slope, 1)),
  );
  TestValidator.equals("influence samples remain owned", samples, before);
  const constant = (weight: number) =>
    Array.from({ length: 3 }, () => ({
      weight,
      gradient: { x: 0, y: 0, z: 0 },
    }));
  TestValidator.equals("zero mask identity", apply(mesh, constant(0)), mesh);
  TestValidator.equals(
    "constant unit mask",
    apply(mesh, constant(1)),
    apply(mesh),
  );
  const moderated = createAutoMovieMeshDeformer([
    {
      ...field,
      displacement: { x: 0, y: 0, z: 0 },
      stretch: { x: -2, y: 0, z: 0 },
    },
  ]);
  TestValidator.predicate(
    "unmasked local reflection refuses",
    throwsError(() => moderated(mesh)),
  );
  TestValidator.predicate(
    "only the final composed map is required to preserve orientation",
    nclose(moderated(mesh, constant(0.25)).positions[3], 1 - (0.5 * 27) / 64),
  );
  for (const invalid of [
    [],
    constant(NaN),
    constant(-0.01),
    constant(1.01),
    constant(0.5).map((sample) => ({
      ...sample,
      gradient: { x: Infinity, y: 0, z: 0 },
    })),
  ])
    TestValidator.predicate(
      "invalid differential samples refuse",
      throwsError(() => apply(mesh, invalid)),
    );
  const translation = createAutoMovieMeshDeformer([
    {
      ...field,
      radius: { x: 1000, y: 1000, z: 1000 },
      displacement: { x: 2, y: 0, z: 0 },
    },
  ]);
  const origin = { ...mesh, positions: [0, 0, 0], normals: null, indices: [] };
  translation(origin);
  translation(origin, [{ weight: 0.5, gradient: { x: -0.25, y: 0, z: 0 } }]);
  TestValidator.predicate(
    "mask derivative reversal refuses",
    throwsError(() =>
      translation(origin, [{ weight: 0.5, gradient: { x: -1, y: 0, z: 0 } }]),
    ),
  );
};
