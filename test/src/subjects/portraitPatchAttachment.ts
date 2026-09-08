import { Vector3, createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieModelPart } from "@automovie/interface";

import {
  portraitPart,
  portraitPoint,
  portraitRayIntersection,
} from "./geometry";
import type {
  IPortraitComponentHost,
  IPortraitSkinConstraint,
} from "./portraitComponents";
import type { IControlMesh } from "./subdivideControlMesh";

/** Optional source-surface attachment of a patch's outer host boundary. */
export interface IPortraitPatchAttachment {
  /** Nonnegative skin adaptation distance beyond the boundary, in mm. */
  reach: number;
  /** Positive search distance in either direction on the unit view ray, in mm. */
  travel: number;
}

/**
 * Match an outer host boundary to the same surface that supplies its inner patch.
 * Each target moves on the recorded view ray, preserving image-plane position.
 * The existing ray/surface intersection owns the depth solution; the existing
 * host skin blender later spreads these constraints through connected skin.
 * No second local smoothing field or independent boundary-depth guess is used.
 * The source must include supporting surface outside its selected inner patch.
 */
export function fitPortraitPatchBoundary(
  host: IPortraitComponentHost,
  boundary: readonly number[],
  source: IControlMesh,
  shape: IPortraitPatchAttachment,
): IPortraitSkinConstraint[] {
  if (
    !Number.isFinite(shape.reach) ||
    shape.reach < 0 ||
    !Number.isFinite(shape.travel) ||
    shape.travel <= 0 ||
    host.viewRay.length !== 3 ||
    !host.viewRay.every(Number.isFinite) ||
    boundary.some(
      (id) =>
        !Number.isInteger(id) ||
        id < 0 ||
        host.positions[id] === undefined ||
        host.positions[id].length !== 3 ||
        !host.positions[id].every(Number.isFinite),
    )
  )
    throw new Error(
      "Patch attachment needs resident points, a finite view ray and valid millimetre distances.",
    );
  const direction = Vector3.normalize(
    Vector3.create(...(host.viewRay as [number, number, number])),
  );
  if (Vector3.length(direction) === 0)
    throw new Error("Patch attachment needs a nonzero view ray.");
  const geometry = portraitPart(
    "patch-attachment-basis",
    {
      positions: source.positions.flat(),
      indices: source.indices,
      normals: null,
      uvs: null,
      skin: null,
    },
    "skin",
  ).geometry as Extract<IAutoMovieModelPart["geometry"], { type: "mesh" }>;
  const sample = createAutoMovieMeshDepthSampler(geometry.mesh, "z");
  return boundary.map((vertex) => {
    const point = host.positions[vertex];
    const target = portraitRayIntersection(
      portraitPoint(...(point as [number, number, number])),
      direction,
      (x, y) => {
        const hit = sample(x / 1000, y / 1000);
        if (hit === null)
          throw new Error(
            "Patch attachment ray leaves the source supporting surface.",
          );
        return hit.maximum * 1000;
      },
      [-shape.travel, shape.travel],
    );
    return {
      vertex,
      target: [target.x, target.y, target.z],
      reach: shape.reach,
    };
  });
}
