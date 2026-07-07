import {
  AutoMoviePrimitiveShape,
  IAutoMovieModel,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * Analytic solid volume of a primitive, in cubic meters.
 *
 * These are the true solid volumes (a cone is `1/3 π r² h`, a capsule is a
 * cylinder plus a full sphere), not the render tessellation's approximations —
 * the physics layer weighs real shapes. A `plane` is a degenerate solid and
 * contributes no volume.
 *
 * @author Samchon
 */
export const primitiveVolume = (shape: AutoMoviePrimitiveShape): number => {
  switch (shape.type) {
    case "box":
      return shape.width * shape.height * shape.depth;
    case "plane":
      return 0;
    case "sphere":
      return (4 / 3) * Math.PI * shape.radius ** 3;
    case "cylinder":
      return Math.PI * shape.radius ** 2 * shape.height;
    case "cone":
      return (1 / 3) * Math.PI * shape.radius ** 2 * shape.height;
    case "capsule":
      return (
        Math.PI * shape.radius ** 2 * shape.height +
        (4 / 3) * Math.PI * shape.radius ** 3
      );
  }
};

/**
 * Centroid of a primitive in its own local frame (meters).
 *
 * Only the cone is asymmetric along its axis: a solid cone's centroid sits a
 * quarter of its height from the base toward the apex. The engine tessellates a
 * cone with its wide base at `+Y` and apex at `-Y`, so that centroid is at
 * `+height/4`. Every other primitive is centered on its origin.
 *
 * @author Samchon
 */
export const primitiveCentroid = (
  shape: AutoMoviePrimitiveShape,
): IAutoMovieVector3 => {
  if (shape.type === "cone") return { x: 0, y: shape.height / 4, z: 0 };
  return { x: 0, y: 0, z: 0 };
};

/**
 * Volume-weighted center of mass of a model's primitive geometry, in the
 * model's local frame — the fallback the engine uses when
 * {@link IAutoMovieBody.centerOfMass} is left `null`.
 *
 * Uniform density is assumed: each primitive part contributes its analytic
 * solid volume (scaled by its part transform) at its transformed centroid. Mesh
 * parts and zero-volume primitives (a plane, or a non-positive scale)
 * contribute nothing. Returns `null` when the model has no primitive volume to
 * weigh — a mesh-only or all-degenerate model — which is the caller's signal
 * that `centerOfMass` must be declared explicitly.
 *
 * @author Samchon
 */
export const deriveCenterOfMass = (
  model: IAutoMovieModel,
): IAutoMovieVector3 | null => {
  let total = 0;
  let weighted: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };
  for (const part of model.parts) {
    if (part.geometry.type !== "primitive") continue;
    const transform = part.transform ?? IDENTITY;
    const volume =
      primitiveVolume(part.geometry.shape) * scaleVolume(transform);
    if (volume <= 0) continue;
    const centroid = applyTransform(
      transform,
      primitiveCentroid(part.geometry.shape),
    );
    weighted = Vector3.add(weighted, Vector3.scale(centroid, volume));
    total += volume;
  }
  return total > 0 ? Vector3.scale(weighted, 1 / total) : null;
};

const IDENTITY: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** How much a transform's scale multiplies a solid's volume. */
const scaleVolume = (t: IAutoMovieTransform): number =>
  t.scale.x * t.scale.y * t.scale.z;

/** Apply a full TRS transform to a local point. */
const applyTransform = (
  t: IAutoMovieTransform,
  p: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.add(
    t.translation,
    Quaternion.rotateVector(t.rotation, {
      x: p.x * t.scale.x,
      y: p.y * t.scale.y,
      z: p.z * t.scale.z,
    }),
  );
