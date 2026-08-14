import {
  buildAutoMoviePolyhedron,
  extrudeAutoMovieRegion,
  loftAutoMovieSections,
  mergeAutoMovieMeshes,
  revolveAutoMovieProfile,
} from "@automovie/engine";
import { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/** How many triangles map their corners each way round in the atlas. */
interface IHandedness {
  /** Triangles whose uv corners wind the same way as their positions. */
  positive: number;
  /** Triangles whose uv corners wind the other way: a mirrored patch. */
  negative: number;
  /** Triangles with no uv area to have a handedness at all. */
  degenerate: number;
}

/**
 * Count the sign of each triangle's uv-space cross product.
 *
 * A triangle's tangent basis is recovered from that determinant, so its sign is
 * the handedness of the patch: `T x B` points along the surface normal for one
 * sign and against it for the other. Two signs in one mesh is a mesh whose
 * normal-mapped lighting is inverted on half of itself, and no positional or
 * topological check sees it.
 */
const handedness = (mesh: IAutoMovieMesh): IHandedness => {
  const uvs = mesh.uvs!;
  const indices =
    mesh.indices ??
    Array.from({ length: mesh.positions.length / 3 }, (_v, at) => at);
  const tally: IHandedness = { positive: 0, negative: 0, degenerate: 0 };
  for (let at = 0; at < indices.length; at += 3) {
    const a = indices[at]!;
    const b = indices[at + 1]!;
    const c = indices[at + 2]!;
    const determinant =
      (uvs[b * 2]! - uvs[a * 2]!) * (uvs[c * 2 + 1]! - uvs[a * 2 + 1]!) -
      (uvs[b * 2 + 1]! - uvs[a * 2 + 1]!) * (uvs[c * 2]! - uvs[a * 2]!);
    if (Math.abs(determinant) <= DEGENERATE_UV_AREA) tally.degenerate += 1;
    else if (determinant > 0) tally.positive += 1;
    else tally.negative += 1;
  }
  return tally;
};

/** Below this the triangle covers no atlas area worth assigning a sign. */
const DEGENERATE_UV_AREA = 1e-12;

const corner = (x: number, y: number, z: number): IAutoMovieVector3 => ({
  x,
  y,
  z,
});

const square = (half: number): Array<{ x: number; y: number }> => [
  { x: -half, y: -half },
  { x: half, y: -half },
  { x: half, y: half },
  { x: -half, y: half },
];

/**
 * Every builder must lay its atlas the same way round, and a merge must not
 * put two answers in one buffer.
 *
 * Nothing in this repository measured this before, which is how a revolved
 * surface shipped with all of its triangles mirrored against every other
 * builder while its coordinates measured correct in metres, closed correctly at
 * the seam, and passed topology. The consequence is not only a backwards
 * letter: a `normalTexture` is sampled through the tangent basis this
 * determinant defines, so a mirrored patch is lit as though its surface leaned
 * the other way, and a merge of a mirrored member with a correct one puts both
 * lightings under one material where nothing can separate them again.
 *
 * The expected counts are the topology each builder already declares, so a
 * builder that changes its triangle count fails here rather than silently
 * re-tallying.
 *
 * Scenarios:
 *
 * 1. A three-faced polyhedron, one upright pair and one level face, is entirely
 *    positive: two triangles per quad face.
 * 2. A revolved cylinder of 16 segments is entirely positive across all 32 side
 *    triangles, with no degenerate ones, because no meridian point is on the
 *    axis.
 * 3. A revolved profile that starts on the axis carries exactly the collapsed
 *    pole triangles the operator declares as degenerate, one per segment, and
 *    every remaining triangle is positive. Degenerate is counted rather than
 *    excused: a pole has no atlas area, so it has no handedness to report.
 * 4. The two developed builders, region extrusion and loft, agree with the
 *    projected one.
 * 5. A merge of the projected and revolved builders carries one handedness for
 *    the whole assembly, which is the case that made the defect reachable: the
 *    kernel deliberately keeps coordinates when every member has them.
 * 6. The negative twin: reflecting one mesh's atlas across its U axis flips
 *    every sign, so the check is measuring handedness and not merely counting
 *    triangles.
 */
export const test_geometry_uv_handedness = (): void => {
  const faces = buildAutoMoviePolyhedron([
    [corner(0, 0, 0), corner(4, 0, 0), corner(4, 3, 0), corner(0, 3, 0)],
    [corner(4, 0, 0), corner(4, 0, -3), corner(4, 3, -3), corner(4, 3, 0)],
    [corner(0, 0, 0), corner(0, 0, 2), corner(4, 0, 2), corner(4, 0, 0)],
  ]);
  TestValidator.equals(
    "every polyhedron face lays its atlas the same way round",
    handedness(faces),
    { positive: 6, negative: 0, degenerate: 0 },
  );

  const tube = revolveAutoMovieProfile({
    profile: [
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ],
    segments: 16,
  });
  TestValidator.equals(
    "a revolved surface off the axis is positive on every triangle",
    handedness(tube),
    { positive: 32, negative: 0, degenerate: 0 },
  );

  // A spire: the meridian starts on the axis, so one collapsed triangle per
  // segment is the pole the operator already reports as degenerate.
  const spire = revolveAutoMovieProfile({
    profile: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.6, y: 2 },
    ],
    segments: 12,
  });
  TestValidator.equals(
    "a pole contributes declared degenerates, never a second handedness",
    handedness(spire),
    { positive: 36, negative: 0, degenerate: 12 },
  );

  const region = extrudeAutoMovieRegion({
    outer: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 0, y: 1 },
    ],
    depth: 0.2,
  });
  const lofted = loftAutoMovieSections({
    path: [corner(0, 0, 0), corner(0, 0, 3)],
    sections: [
      { at: 0, outer: square(0.5) },
      { at: 1, outer: square(0.5) },
    ],
  });
  TestValidator.equals(
    "the developed builders agree with the projected one",
    { region: handedness(region), lofted: handedness(lofted) },
    {
      region: { positive: 12, negative: 0, degenerate: 0 },
      lofted: { positive: 12, negative: 0, degenerate: 0 },
    },
  );

  TestValidator.equals(
    "a merged assembly carries one handedness, not one per member",
    {
      projectedWithRevolved: handedness(mergeAutoMovieMeshes([faces, tube])),
      developedPair: handedness(mergeAutoMovieMeshes([region, lofted])),
    },
    {
      projectedWithRevolved: { positive: 38, negative: 0, degenerate: 0 },
      developedPair: { positive: 24, negative: 0, degenerate: 0 },
    },
  );

  // Reflecting U is the exact defect this check exists to catch, so the check
  // must report it. Without this twin an implementation that returned a
  // constant would pass every case above.
  const mirrored: IAutoMovieMesh = {
    ...tube,
    uvs: tube.uvs!.map((value, at) => (at % 2 === 0 ? -value : value)),
  };
  TestValidator.equals(
    "reflecting the atlas across U flips every sign the check reports",
    handedness(mirrored),
    { positive: 0, negative: 32, degenerate: 0 },
  );

  TestValidator.equals(
    "and a mirrored member is exactly what a merge would hide",
    namedFacts([
      [
        "mixedBuffer",
        () => {
          const mixed = handedness(mergeAutoMovieMeshes([faces, mirrored]));
          return mixed.positive === 6 && mixed.negative === 32;
        },
      ],
    ]),
    { mixedBuffer: true },
  );
};
