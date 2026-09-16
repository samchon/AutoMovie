/**
 * Shared resident optical construction for the eye's fit, final contact and
 * drawing consumers. Inputs/meshes use head millimetres. Cornea construction
 * precedes gaze rotation; the same dimensions, frame and sampling reach every
 * consumer. Contact combines that cornea with the resident globe or supplied
 * fixed canthal hull. Inputs are read-only and each result is an owned mesh.
 * This module supplies the support surface; the skin owner decides clearance.
 */
import {
  mergeAutoMovieMeshes,
  transformAutoMovieMesh,
} from "@automovie/engine";
import type {
  IAutoMovieMesh,
  IAutoMovieVector3 as Point,
} from "@automovie/interface";

import { buildPortraitCornea } from "../geometry/portraitCornea";
import {
  type IPortraitEyeSphere,
  portraitEyeSphereHeight,
} from "../geometry/portraitEyeSphere";
import { createPortraitOpticalFrame } from "../geometry/portraitOpticalFrame";
import {
  type IPortraitEyePerformance,
  buildPortraitPerformanceGlobe,
  posePortraitOpticalMesh,
} from "./eyePerformance";
import type { IPortraitEyeShape } from "./eyeShape";

/**
 * Build the same closed corneal shell for drawing and optical contact.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs a resident cornea from one eye's metric optical dimensions.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Uses the declared radial/head frame, limbus/aperture extent and gaze transform in both consumers.
 */
// Drawing and contact construct the same closed optical shell. The complete
// limbus is independent of aperture clipping; both consumers retain its sphere,
// gaze centre, radii, thickness and sampling before any eyelid is projected.
export function buildPortraitEyeCornea(
  center: Point,
  sphere: IPortraitEyeSphere,
  shape: IPortraitEyeShape,
  extents: number[],
  performance?: IPortraitEyePerformance,
) {
  const radial =
    shape.opticalFrame === "radial"
      ? createPortraitOpticalFrame(sphere, center)
      : undefined;
  const support = radial?.sphere ?? sphere;
  let mesh = buildPortraitCornea({
    center: radial === undefined ? center : support.center,
    radius: shape.irisRadius,
    curvature: shape.cornealRadius,
    globeRadius: shape.surfaceRadius,
    thickness: shape.cornealThickness,
    rimLift: shape.cornealRimLift,
    extents:
      shape.cornealBoundary === "limbus"
        ? new Array(shape.sampling.irisColumns).fill(shape.irisRadius)
        : extents,
    radialSamples: shape.sampling.irisRows,
    surface: (x, y) => portraitEyeSphereHeight(support, x, y),
  });
  if (radial !== undefined)
    mesh = transformAutoMovieMesh(mesh, radial.transform);
  return performance === undefined
    ? mesh
    : posePortraitOpticalMesh(mesh, sphere.center, performance);
}

/**
 * Combine the cornea and, when resident, the full optical globe for skin contact.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Provides the optical volume against which eyelid attachment is constrained.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Includes the anterior globe for performance or radial optics without changing the drawn corneal construction.
 */
// A resident globe extends beyond the original photographed aperture. Its
// complete forward shell participates in contact, including adjacent orbital
// skin; restricting that check to the named lid group can expose sclera above
// a closed lid even when every corneal triangle is clear.
export function buildPortraitEyeContactBasis(
  center: Point,
  sphere: IPortraitEyeSphere,
  shape: IPortraitEyeShape,
  extents: number[],
  performance?: IPortraitEyePerformance,
  canthal?: IAutoMovieMesh,
) {
  const cornea = buildPortraitEyeCornea(
    center,
    sphere,
    shape,
    extents,
    performance,
  );
  return performance === undefined && shape.opticalFrame !== "radial"
    ? cornea
    : mergeAutoMovieMeshes([
        canthal ??
          buildPortraitPerformanceGlobe(
            sphere,
            Math.max(3, shape.sampling.eyeColumns),
            Math.max(2, shape.sampling.eyeRows),
          ),
        cornea,
      ]);
}
