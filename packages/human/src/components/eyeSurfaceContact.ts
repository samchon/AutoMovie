import type { IAutoMovieVector3 } from "@automovie/interface";

import { blendPortraitSkin } from "../geometry/blendPortraitSkin";
import { portraitPoint as p, portraitPart } from "../geometry/geometry";
import { portraitDirectionalSurfaceTargets } from "../geometry/portraitDirectionalContact";
import {
  type IPortraitEyeSphere,
  portraitEyeSphereIntersection,
} from "../geometry/portraitEyeSphere";
import type { IPortraitFinalSurface } from "../geometry/portraitFinalSurface";
import { buildPortraitEyeContactBasis } from "./eyeOpticalSurface";
import type { IPortraitEyePerformance } from "./eyePerformance";
import type { IPortraitEyeShape } from "./eyeShape";

/**
 * Resolve final shared skin against this eye's actual optical volume.
 * Closed margins share the foremost correction along the observation ray,
 * so independent triangle contacts cannot reopen their coincident seam.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Preserves shared eyelid attachment while clearing the resident ocular volume.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Uses triangle overlap, geodesic propagation and closed-rim correspondence after common refinement.
 */
export function createPortraitEyeSurfaceContact({
  iris,
  sphere,
  shape,
  direction,
  lidGroup,
  performance,
}: {
  iris: number;
  sphere: IPortraitEyeSphere;
  shape: IPortraitEyeShape;
  direction: IAutoMovieVector3;
  lidGroup: number;
  performance?: IPortraitEyePerformance;
}): IPortraitFinalSurface {
  return (final) => {
    const gaze = final.positions[iris];
    const center = portraitEyeSphereIntersection(
      sphere,
      p(gaze[0], gaze[1], gaze[2]),
      direction,
    );
    const optical = portraitPart(
      "corneal-contact-basis",
      buildPortraitEyeContactBasis(center, sphere, shape, [], performance),
      "skin",
    ).geometry.mesh;
    const indices: number[] = [];
    for (let i = 0; i < final.groups.length; i++)
      if (
        final.groups[i] === lidGroup ||
        ((performance !== undefined || shape.opticalFrame === "radial") &&
          final.indices
            .slice(3 * i, 3 * i + 3)
            .some((id) => final.positions[id][2] > sphere.center.z))
      )
        indices.push(...final.indices.slice(3 * i, 3 * i + 3));
    // Full triangle overlap catches an optical bulge between
    // clear lid vertices. Retain host IDs so all neighbouring
    // skin receives one shared contact target and normal field.
    const constraints = portraitDirectionalSurfaceTargets(
      {
        positions: final.positions.flatMap((point) =>
          point.map((v) => v / 1000),
        ),
        indices,
        normals: null,
        uvs: null,
        skin: null,
      },
      optical,
      direction,
      shape.lidThickness / 1000,
    ).map(({ vertex, target }) => ({
      vertex,
      reach: shape.lidContactReach ?? 3,
      target: [target.x * 1000, target.y * 1000, target.z * 1000],
    }));
    // Contact fixes the required points; the same geodesic skin
    // adapter used by initial component fitting carries their
    // movement into surrounding tissue. A pointwise clamp alone
    // leaves a hard platform at the optical footprint boundary.
    const adapted = blendPortraitSkin(
      final.positions.map((point) => [...point]),
      [...final.indices],
      constraints,
    );
    if (performance?.blink === 1) {
      // Both margins start on the same closed seam. Triangle
      // contact on either side may need a different clearance;
      // share the farther forward target rather than reopening
      // their coincident edge during the collision correction.
      const pairs = new Map<string, number[]>();
      const vertices = new Set<number>();
      for (let i = 0; i < final.groups.length; i++)
        if (final.groups[i] === lidGroup)
          final.indices
            .slice(3 * i, 3 * i + 3)
            .forEach((id) => vertices.add(id));
      for (const id of vertices) {
        const key = final.positions[id].join("/");
        pairs.set(key, [...(pairs.get(key) ?? []), id]);
      }
      for (const ids of pairs.values()) {
        const depth = (id: number) =>
          adapted[id][0] * direction.x +
          adapted[id][1] * direction.y +
          adapted[id][2] * direction.z;
        const winner = ids.reduce((best, id) =>
          depth(id) > depth(best) ? id : best,
        );
        for (const id of ids) adapted[id] = [...adapted[winner]];
      }
    }
    return adapted.flatMap((target, vertex) =>
      target.some((value, axis) => value !== final.positions[vertex][axis])
        ? [{ vertex, target }]
        : [],
    );
  };
}
