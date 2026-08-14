import {
  buildAutoMoviePolyhedron,
  extrudeAutoMovieRegion,
  loftAutoMovieSections,
  revolveAutoMovieProfile,
} from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** How hard one triangle's atlas stretches, and by how much it changes area. */
interface IStretch {
  /** Ratio of the larger to the smaller singular value; 1 is a rigid frame. */
  anisotropy: number;
  /** Emitted uv area over surface area; 1 is equiareal. */
  areaScale: number;
}

/**
 * Measure the affine map that carries one triangle's surface onto its atlas.
 *
 * The triangle is expressed in an orthonormal basis of its own plane, which is
 * what makes the reading independent of how the mesh happens to sit in space,
 * and the resulting `2 x 2` matrix is decomposed through the eigenvalues of
 * `M^T M`. Degenerate triangles carry no frame and are reported as such.
 */
const stretchOf = (mesh: IAutoMovieMesh, triangle: number): IStretch | null => {
  const corner = (
    at: number,
  ): readonly [readonly number[], readonly number[]] => {
    const index = mesh.indices![triangle * 3 + at]!;
    return [
      [
        mesh.positions[index * 3]!,
        mesh.positions[index * 3 + 1]!,
        mesh.positions[index * 3 + 2]!,
      ],
      [mesh.uvs![index * 2]!, mesh.uvs![index * 2 + 1]!],
    ];
  };
  const [origin, atlas] = corner(0);
  const [alpha, alphaUv] = corner(1);
  const [beta, betaUv] = corner(2);
  const first = alpha.map((value, axis) => value - origin[axis]!);
  const second = beta.map((value, axis) => value - origin[axis]!);
  const spanA = Math.hypot(...first);
  if (spanA === 0) return null;
  const unit = first.map((value) => value / spanA);
  const along = second.reduce(
    (sum, value, axis) => sum + value * unit[axis]!,
    0,
  );
  const spanB = Math.hypot(
    ...second.map((value, axis) => value - along * unit[axis]!),
  );
  if (spanB === 0) return null;
  // Surface edges in that basis are (spanA, 0) and (along, spanB); the atlas
  // edges are the uv differences, so M solves M * [surface] = [atlas].
  const uvA = alphaUv.map((value, axis) => value - atlas[axis]!);
  const uvB = betaUv.map((value, axis) => value - atlas[axis]!);
  const column = (row: number): readonly [number, number] => [
    uvA[row]! / spanA,
    (uvB[row]! - (uvA[row]! * along) / spanA) / spanB,
  ];
  const [ux, uy] = column(0);
  const [vx, vy] = column(1);
  const xx = ux * ux + vx * vx;
  const xy = ux * uy + vx * vy;
  const yy = uy * uy + vy * vy;
  const half = (xx + yy) / 2;
  const gap = Math.sqrt(Math.max(0, half * half - (xx * yy - xy * xy)));
  return {
    anisotropy:
      Math.sqrt(half + gap) / Math.sqrt(Math.max(half - gap, Number.MIN_VALUE)),
    areaScale: Math.abs(ux * vy - uy * vx),
  };
};

/** The worst anisotropy any non-degenerate triangle of a mesh carries. */
const worstAnisotropy = (mesh: IAutoMovieMesh): number => {
  let worst = 0;
  for (let triangle = 0; triangle * 3 < mesh.indices!.length; ++triangle) {
    const stretch = stretchOf(mesh, triangle);
    if (stretch !== null && stretch.anisotropy > worst)
      worst = stretch.anisotropy;
  }
  return worst;
};

/** A meridian one metre long leaning `degrees` away from the axis. */
const leaningCone = (degrees: number): IAutoMovieMesh =>
  revolveAutoMovieProfile({
    profile: [
      { x: 1, y: 0 },
      {
        x: 1 + Math.sin((degrees * Math.PI) / 180),
        y: Math.cos((degrees * Math.PI) / 180),
      },
    ],
    segments: 96,
  });

/** The closed form the operator's contract states, at a given meridian slope. */
const statedWorst = (degrees: number): number => {
  const k = 2 * Math.PI * Math.abs(Math.sin((degrees * Math.PI) / 180));
  return (Math.sqrt(k * k + 4) + k) / (Math.sqrt(k * k + 4) - k);
};

const ring = (radius: number): { x: number; y: number }[] =>
  Array.from({ length: 24 }, (_point, at) => ({
    x: radius * Math.cos((at / 24) * Math.PI * 2),
    y: radius * Math.sin((at / 24) * Math.PI * 2),
  }));

/**
 * The shear a revolved metric atlas costs, and where a directional finish may go.
 *
 * `revolveAutoMovieProfile` measures true arc around each parallel, so `u`
 * carries the radius and therefore changes along the meridian wherever the
 * radius does. That coupling is pure shear rather than any stretch of area, and
 * on a steep meridian it is severe enough that slate, boarding, or any grain
 * with a direction reads as a spiral. The operator's contract states the limit
 * and names what an author reaches for instead; this pins both, so the limit
 * cannot drift and the stated alternatives cannot quietly stop being exact.
 *
 * Every expected number comes from the geometry rather than from the builder.
 * The worst anisotropy over a full turn of a meridian at slope `dr / ds` is the
 * condition number of a shear by `k = 2 * pi * |dr / ds|`, which is
 * `(sqrt(k * k + 4) + k) / (sqrt(k * k + 4) - k)`; the mesh is only asked to
 * agree with that within the error its own tessellation admits.
 *
 * Scenarios:
 *
 * 1. A constant radius shears not at all, so a drum carries a directional
 *    finish exactly; the atlas is rigid there rather than merely close.
 * 2. The shear follows meridian slope and nothing else, matching the stated
 *    closed form at 6.5, 13.8, 45 and 89.9 degrees off the axis, which are the
 *    2, 4, 21.5 and 41 the contract quotes.
 * 3. Distortion is entirely shear: every triangle's uv area equals its surface
 *    area, so no author can diagnose this by looking at texel density.
 * 4. The pole is not the cause. A cone with its tip cut away has no pole, no
 *    degenerate triangle and the same worst shear as the cone it came from, so
 *    a fix aimed at the pole band would leave the flank exactly as it is.
 * 5. The shear varies around the surface rather than sitting uniformly on it:
 *    beside the seam a wedge is near rigid while its opposite is at the worst,
 *    which is why a constant-`u` curve spirals.
 * 6. The stated alternatives are exact. A faceted spire through
 *    `buildAutoMoviePolyhedron` and a flat cap through `extrudeAutoMovieRegion`
 *    are rigid, while `loftAutoMovieSections` measures the same pair and a
 *    tapered loft shears with it, so it is not an escape from this.
 */
export const test_geometry_revolve_atlas_shear = (): void => {
  const drum = revolveAutoMovieProfile({
    profile: [
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ],
    segments: 96,
  });
  TestValidator.predicate(
    "a constant radius carries a rigid atlas, so a drum takes any grain",
    worstAnisotropy(drum) < 1.01,
  );

  TestValidator.equals(
    "shear follows meridian slope and matches the stated closed form",
    namedFacts(
      [6.5, 13.8, 45, 89.9].map(
        (degrees) =>
          [
            `at${degrees}`,
            () => {
              const measured = worstAnisotropy(leaningCone(degrees));
              return (
                Math.abs(measured - statedWorst(degrees)) <
                statedWorst(degrees) * 0.02
              );
            },
          ] as const,
      ),
    ),
    { "at6.5": true, "at13.8": true, at45: true, "at89.9": true },
  );

  const steep = leaningCone(45);
  TestValidator.predicate(
    "the distortion is pure shear: every triangle keeps its area",
    Array.from({ length: steep.indices!.length / 3 }, (_triangle, at) =>
      stretchOf(steep, at),
    ).every(
      (stretch) => stretch === null || nclose(stretch.areaScale, 1, 1e-3),
    ),
  );

  // A 45-degree cone standing on its point, and the same cone with the top
  // metre of its meridian cut away so that no vertex sits on the axis at all.
  const cone = revolveAutoMovieProfile({
    profile: [
      { x: 0, y: 2 },
      { x: 2, y: 0 },
    ],
    segments: 96,
  });
  const frustum = revolveAutoMovieProfile({
    profile: [
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ],
    segments: 96,
  });
  const withPole = worstAnisotropy(cone);
  const without = worstAnisotropy(frustum);
  TestValidator.equals(
    "cutting the pole away changes nothing: the flank shears just as hard",
    namedFacts([
      [
        "frustumHasNoPole",
        () =>
          Array.from({ length: frustum.positions.length / 3 }, (_vertex, at) =>
            Math.hypot(
              frustum.positions[at * 3]!,
              frustum.positions[at * 3 + 2]!,
            ),
          ).every((radius) => radius > 0),
      ],
      ["sameWorstShear", () => Math.abs(withPole - without) < withPole * 0.01],
      ["andItIsSevere", () => without > 20],
    ]),
    { frustumHasNoPole: true, sameWorstShear: true, andItIsSevere: true },
  );

  // Triangle 0 sits at theta = 0, where `2 * pi - theta` is at its largest, and
  // the last pair sits at the closing segment, where it has run down to zero.
  const last = frustum.indices!.length / 3 - 1;
  TestValidator.equals(
    "the shear sweeps around the surface, which is why constant u spirals",
    namedFacts([
      [
        "seamSideIsNearlyRigid",
        () => stretchOf(frustum, last)!.anisotropy < 1.2,
      ],
      ["oppositeIsAtTheWorst", () => stretchOf(frustum, 0)!.anisotropy > 20],
    ]),
    { seamSideIsNearlyRigid: true, oppositeIsAtTheWorst: true },
  );

  // A square pyramid: the faceted spire the contract sends an author to.
  const spire = buildAutoMoviePolyhedron([
    [
      { x: -1, y: 0, z: -1 },
      { x: 1, y: 0, z: -1 },
      { x: 0, y: 2, z: 0 },
    ],
    [
      { x: 1, y: 0, z: -1 },
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 2, z: 0 },
    ],
    [
      { x: 1, y: 0, z: 1 },
      { x: -1, y: 0, z: 1 },
      { x: 0, y: 2, z: 0 },
    ],
    [
      { x: -1, y: 0, z: 1 },
      { x: -1, y: 0, z: -1 },
      { x: 0, y: 2, z: 0 },
    ],
  ]);
  const cap = extrudeAutoMovieRegion({
    outer: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ],
    depth: 0.1,
  });
  const taper = loftAutoMovieSections({
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 2 },
    ],
    sections: [
      { at: 0, outer: ring(2) },
      { at: 1, outer: ring(0.05) },
    ],
  });
  TestValidator.equals(
    "the named alternatives are rigid, and a tapered loft is not one of them",
    namedFacts([
      ["facetedSpire", () => nclose(worstAnisotropy(spire), 1, 1e-6)],
      ["flatCap", () => nclose(worstAnisotropy(cap), 1, 1e-6)],
      ["taperedLoftSharesTheDefect", () => worstAnisotropy(taper) > 20],
    ]),
    { facetedSpire: true, flatCap: true, taperedLoftSharesTheDefect: true },
  );
};
