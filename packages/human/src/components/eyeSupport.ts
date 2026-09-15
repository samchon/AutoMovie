import { Vector3 } from "@automovie/engine";
import type { IAutoMovieVector3 as Point } from "@automovie/interface";

import { fitPortraitCanthalSphere } from "../geometry/fitPortraitCanthalSphere";
import {
  buildPortraitCanthalMesh,
  createPortraitCanthalIntersection,
} from "../geometry/portraitCanthalMesh";
import {
  fitPortraitEyeSphere,
  portraitEyeSphereIntersection,
} from "../geometry/portraitEyeSphere";
import type { IPortraitEyeShape } from "./eyeShape";

/**
 * Establish one eye's fixed optical identity before its lid performance.
 * createPortraitEyeComponent supplies shaped observed curves in construction
 * millimetres and a forward camera ray. Legacy cap fitting keeps its previous
 * arithmetic and a separate unshifted guide sphere. Tangent canthal support
 * instead keeps the original observed seam and joins fixed canthi to the
 * declared optical body. Gaze never participates in either identity fit.
 *
 * The returned intersection owns the same sampled canthal surface used for
 * drawing and later contact. These owned meshes are read-only to consumers;
 * changes of aperture, dimensions or tessellation require a new fit, whereas
 * blink/gaze reuse the identity. This does not settle final skin clearance.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Keeps optical identity and canthal attachment independent of performed visibility.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Selects legacy cap support or a fixed canthal hull before constructing shared eyelid sections.
 */
export function createPortraitEyeSupport(
  upper: readonly Point[],
  lower: readonly Point[],
  direction: Point,
  shape: IPortraitEyeShape,
) {
  if (shape.canthalSupport === "tangent") {
    const sphere = fitPortraitCanthalSphere(
      upper,
      lower,
      direction,
      shape.surfaceRadius,
      shape.globeLift,
    );
    const canthal = buildPortraitCanthalMesh(
      sphere,
      [upper[0], upper[upper.length - 1]],
      Math.max(3, shape.sampling.eyeColumns),
      Math.max(2, shape.sampling.eyeRows),
    );
    return {
      sphere,
      fittedSphere: sphere,
      shifted: false,
      canthal,
      intersect: createPortraitCanthalIntersection(canthal.surface, direction),
    };
  }
  const fittedSphere = fitPortraitEyeSphere(
    [...upper],
    [...lower],
    direction,
    shape.surfaceRadius,
    shape.sphereFit,
  );
  const shifted = shape.globeLift !== undefined && shape.globeLift !== 0;
  const sphere = shifted
    ? {
        ...fittedSphere,
        center: Vector3.add(
          fittedSphere.center,
          Vector3.scale(Vector3.normalize(direction), shape.globeLift!),
        ),
      }
    : fittedSphere;
  return {
    sphere,
    fittedSphere,
    shifted,
    canthal: undefined,
    intersect: (point: Point) =>
      portraitEyeSphereIntersection(sphere, point, direction),
  };
}
