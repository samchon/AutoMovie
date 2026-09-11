import { createAutoMovieMeshDeformer } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createPortraitCheekLayer } from "../../subjects/generated-korean-girl-01/cheeks";
import { createPortraitCheekFixture } from "../internal/createPortraitCheekFixture";
import { nclose } from "../internal/predicates";

/**
 * Nasolabial depth belongs to a continuous skin path, independently of sample
 * density and host translation. The compact kernel has line integral 32r/35.
 *
 * Scenarios:
 * 1. A straight 80 mm path produces a 1 mm central groove within 3 percent.
 *    Its endpoint envelope varies by less than 2.5 percent across the 4 mm
 *    support; the tolerance also covers the midpoint quadrature error.
 * 2. Halving width changes lateral support without doubling depth. A boundary
 *    sample is unchanged and the path's ends have less relief than its centre.
 * 3. Uniformly scaling the host and all lengths scales the resulting relief;
 *    a shorter-than-support path still produces one finite integrated sample.
 * 4. Unevenly spaced anchors on the same straight path retain its physical
 *    midpoint depth instead of moving the maximum to the middle anchor.
 */
export const test_subject_nasolabial_relief = (): void => {
  const { socket, shape, host } = createPortraitCheekFixture();
  shape.foldDepth = 1;
  const sample = (width: number) => {
    const fields = createPortraitCheekLayer(socket, {
      ...shape,
      foldWidth: width,
    }).fields(host);
    return createAutoMovieMeshDeformer(fields)({
      positions: [0, -0.08, 0, 0, -0.08 + width / 1000, 0, -0.04, -0.08, 0],
      indices: [],
      normals: null,
      uvs: null,
      skin: null,
    }).positions;
  };
  const wide = sample(4),
    narrow = sample(2);
  TestValidator.predicate(
    "metric centre depth",
    nclose(wide[2], -0.001, 0.00003) && nclose(narrow[2], -0.001, 0.00003),
  );
  TestValidator.equals(
    "transverse support boundary",
    [wide[5], narrow[5]],
    [0, 0],
  );
  TestValidator.predicate(
    "anatomical endpoints fade",
    Math.abs(wide[8]) < Math.abs(wide[2]) * 0.03,
  );
  const scaled = structuredClone(shape);
  for (const name of ["malar", "medial", "buccal", "modiolus"] as const)
    for (const key of [
      "width",
      "height",
      "reach",
      "projection",
      "lift",
    ] as const)
      scaled[name][key] *= 3;
  scaled.foldWidth *= 3;
  scaled.foldDepth *= 3;
  scaled.foldReach *= 3;
  const changedHost = {
    ...host,
    positions: host.positions.map((p) => p.map((v) => v * 3)),
  };
  const result = createAutoMovieMeshDeformer(
    createPortraitCheekLayer(socket, scaled).fields(changedHost),
  )({
    positions: [0, -0.24, 0],
    indices: [],
    normals: null,
    uvs: null,
    skin: null,
  });
  TestValidator.predicate(
    "metric scaling covariance",
    nclose(result.positions[2], 3 * wide[2]),
  );
  const tiny = {
    ...host,
    positions: host.positions.map((p, i) =>
      i === 5 ? [-39.9, -80, 0] : [...p],
    ),
  };
  const single = createPortraitCheekLayer(socket, shape).fields(tiny);
  TestValidator.equals("sub-support path has one sample", single.length, 1);
  TestValidator.predicate(
    "single sample remains finite",
    Number.isFinite(single[0].displacement.z) && single[0].displacement.z < 0,
  );
  const uneven = { ...host, positions: [...host.positions, [-20, -80, 0]] };
  const unevenFields = createPortraitCheekLayer(
    { ...socket, nasolabial: [4, 6, 5] },
    shape,
  ).fields(uneven);
  const midpoint = createAutoMovieMeshDeformer(unevenFields)({
    positions: [0, -0.08, 0],
    indices: [],
    normals: null,
    uvs: null,
    skin: null,
  });
  TestValidator.predicate(
    "uneven knots preserve physical midpoint depth",
    nclose(midpoint.positions[2], -0.001, 0.00003),
  );
};
