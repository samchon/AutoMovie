import {
  extrudeAutoMovieRegion,
  transformAutoMovieMesh,
  validateTextureScale,
} from "@automovie/engine";
import type {
  IAutoMovieMaterial,
  IAutoMovieMesh,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieValidation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, violationCount } from "../internal/predicates";

/**
 * Atlas area over surface area, least and greatest across a mesh.
 *
 * A metric set claims one unit is one metre of surface, so this ratio is 1
 * exactly while the claim holds and reads `1 / s ** 2` once a scale `s` has
 * stretched the surface out from under coordinates that did not move.
 */
const density = (mesh: IAutoMovieMesh): { least: number; most: number } => {
  const indices = mesh.indices!;
  let least = Number.POSITIVE_INFINITY;
  let most = Number.NEGATIVE_INFINITY;
  for (let at = 0; at < indices.length; at += 3) {
    const corner = (
      offset: number,
    ): { at: readonly number[]; uv: number[] } => {
      const index = indices[at + offset]!;
      return {
        at: [
          mesh.positions[index * 3]!,
          mesh.positions[index * 3 + 1]!,
          mesh.positions[index * 3 + 2]!,
        ],
        uv: [mesh.uvs![index * 2]!, mesh.uvs![index * 2 + 1]!],
      };
    };
    const origin = corner(0);
    const alpha = corner(1);
    const beta = corner(2);
    const first = alpha.at.map((value, axis) => value - origin.at[axis]!);
    const second = beta.at.map((value, axis) => value - origin.at[axis]!);
    const surface =
      Math.hypot(
        first[1]! * second[2]! - first[2]! * second[1]!,
        first[2]! * second[0]! - first[0]! * second[2]!,
        first[0]! * second[1]! - first[1]! * second[0]!,
      ) / 2;
    if (surface <= 1e-12) continue;
    const atlas =
      Math.abs(
        (alpha.uv[0]! - origin.uv[0]!) * (beta.uv[1]! - origin.uv[1]!) -
          (alpha.uv[1]! - origin.uv[1]!) * (beta.uv[0]! - origin.uv[0]!),
      ) / 2;
    least = Math.min(least, atlas / surface);
    most = Math.max(most, atlas / surface);
  }
  return { least, most };
};

/**
 * Advisory warnings a validation carries, or `-1` when it failed outright.
 *
 * Only the success arm of the result union has a warning list, and collapsing
 * a failure to zero warnings would let a refused model compare equal to a clean
 * one. `-1` keeps the two apart in the comparison below.
 */
const warningCount = (validation: IAutoMovieValidation): number =>
  validation.success === true ? (validation.warnings ?? []).length : -1;

/** A 1 m square section extruded 4 m: one atlas-bearing member at unit size. */
const member = (): IAutoMovieMesh =>
  extrudeAutoMovieRegion({
    outer: [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
    ],
    depth: 4,
  });

/**
 * One model whose single part declares a coordinate source and may be scaled.
 *
 * `source` exists so the case can prove the validator examined this exact
 * fixture rather than returning clean because something about the shape made it
 * say nothing. A `"normalized"` declaration over a span of 4 is refused, so the
 * same model differing only in that word is the positive control.
 */
const declaredModel = (
  scale: number | null,
  source: "surface-metres" | "normalized" = "surface-metres",
): IAutoMovieModel => {
  const part: IAutoMovieModelPart = {
    id: "shaft",
    name: null,
    geometry: { type: "mesh", mesh: member() },
    material: "oak",
    attachedBone: null,
    transform:
      scale === null
        ? null
        : ({
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: scale, y: scale, z: scale },
          } as IAutoMovieModelPart["transform"]),
  };
  return {
    parts: [part],
    materials: [
      {
        id: "oak",
        baseColorTexture: {
          asset: "public/textures/oak.png",
          texCoord: 0,
          colorSpace: "srgb",
          coordinateSource: source,
          transform: {
            offset: { x: 0, y: 0 },
            scale: { x: 2, y: 2 },
            rotationDeg: 0,
          },
        },
      } as IAutoMovieMaterial,
    ],
  } as IAutoMovieModel;
};

/**
 * What a placement's scale does to a metric atlas, and what nothing does about it.
 *
 * A placement carries its member's coordinates through untouched, which is the
 * stated rule and the right one for a rotation: a board turned on its side
 * keeps the grain it was cut with. A scale takes the same path and arrives
 * somewhere else. The surface stretches while the numbers stay where they
 * were, so the set goes on claiming metres it no longer measures, and the
 * finish comes out wrong by the scale factor with nothing in the frame to say
 * why.
 *
 * The contract answers this by telling an author to build an atlas-bearing
 * member at the size it will be seen at rather than by rescaling coordinates,
 * because rescaling would rewrite every surface already authored and could not
 * be done at all for a non-uniform factor. What that leaves is a stated trap,
 * and a stated trap has to be pinned or the statement is the only thing holding
 * it. Every expected number is the placement's own arithmetic: area scales as
 * the square of a uniform factor, so the ratio an unmoved atlas reads is its
 * reciprocal.
 *
 * Scenarios:
 *
 * 1. A rotation and a translation cost nothing. The uv buffer comes back
 *    element for element and the metric claim still reads exactly 1, which is
 *    the positive case the scale is measured against.
 * 2. A uniform scale of 3 leaves that same uv buffer untouched while the
 *    surface grows nine times in area, so every triangle reads 1 / 9 and one
 *    atlas unit now spans three metres.
 * 3. A non-uniform scale is not wrong by one number. Scaling one axis by 3
 *    leaves the faces across it at 1 and drives the faces along it to 1 / 3, so
 *    no single correction restores the set.
 * 4. Nothing downstream sees it. `validateTextureScale` reads a binding against
 *    the part's own coordinate span and never the part's transform, so the
 *    scaled part and the unscaled one return the identical clean verdict for
 *    the same `"surface-metres"` declaration. A control declaring `"normalized"`
 *    over the same span is refused, which is what makes the two clean verdicts
 *    evidence that the validator looked rather than evidence that it skipped.
 */
export const test_geometry_placement_scale_atlas = (): void => {
  const built = member();
  const placed = transformAutoMovieMesh(built, {
    translation: { x: 7, y: -2, z: 3 },
    rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
  });
  TestValidator.equals(
    "a rotation and a translation keep both the atlas and what it means",
    namedFacts([
      [
        "uvBufferIsElementForElement",
        () =>
          placed.uvs!.length === built.uvs!.length &&
          placed.uvs!.every((value, at) => value === built.uvs![at]),
      ],
      ["andStillReadsOneMetrePerUnit", () => nclose(density(placed).least, 1)],
      ["onEveryTriangle", () => nclose(density(placed).most, 1)],
    ]),
    {
      uvBufferIsElementForElement: true,
      andStillReadsOneMetrePerUnit: true,
      onEveryTriangle: true,
    },
  );

  const enlarged = transformAutoMovieMesh(built, {
    scale: { x: 3, y: 3, z: 3 },
  });
  const grown = density(enlarged);
  TestValidator.equals(
    "a uniform scale of 3 leaves the atlas alone and makes every unit 3 m",
    namedFacts([
      [
        "uvBufferIsStillElementForElement",
        () => enlarged.uvs!.every((value, at) => value === built.uvs![at]),
      ],
      ["yetTheDensityIsOneNinth", () => nclose(grown.least, 1 / 9)],
      ["uniformlySo", () => nclose(grown.most, 1 / 9)],
    ]),
    {
      uvBufferIsStillElementForElement: true,
      yetTheDensityIsOneNinth: true,
      uniformlySo: true,
    },
  );

  const stretched = density(
    transformAutoMovieMesh(built, { scale: { x: 3, y: 1, z: 1 } }),
  );
  TestValidator.equals(
    "a non-uniform scale is not wrong by one number, so nothing corrects it",
    namedFacts([
      ["facesAlongTheScaledAxis", () => nclose(stretched.least, 1 / 3)],
      ["facesAcrossItAreUntouched", () => nclose(stretched.most, 1)],
      ["soOneFactorCannotServeBoth", () => stretched.most !== stretched.least],
    ]),
    {
      facesAlongTheScaledAxis: true,
      facesAcrossItAreUntouched: true,
      soOneFactorCannotServeBoth: true,
    },
  );

  const asBuilt = validateTextureScale({ models: [declaredModel(null)] });
  const asScaled = validateTextureScale({ models: [declaredModel(3)] });
  const control = validateTextureScale({
    models: [declaredModel(null, "normalized")],
  });
  TestValidator.equals(
    "the declaration is never checked against the placement that falsified it",
    namedFacts([
      // The control first: a clean verdict below means nothing unless this
      // fixture is one the validator actually reads and can refuse.
      ["theValidatorDoesReadThisFixture", () => violationCount(control) > 0],
      ["theUnscaledPartIsClean", () => violationCount(asBuilt) === 0],
      ["andSoIsTheScaledOne", () => violationCount(asScaled) === 0],
      [
        "withTheSameWarnings",
        () => warningCount(asBuilt) === warningCount(asScaled),
      ],
    ]),
    {
      theValidatorDoesReadThisFixture: true,
      theUnscaledPartIsClean: true,
      andSoIsTheScaledOne: true,
      withTheSameWarnings: true,
    },
  );
};
