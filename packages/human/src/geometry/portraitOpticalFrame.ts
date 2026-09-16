import {
  type IAutoMovieMeshTransform,
  Vector3,
  rotationBetween,
} from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";

import type { IPortraitEyeSphere } from "./portraitEyeSphere";

/**
 * A rigid radial frame for an iris and cornea authored around local +Z. The
 * axial witness selects a direction from the globe centre, not an in-plane
 * translation of a disc over a head-aligned height field. Shortest-arc rotation
 * carries both optical layers without changing their radii or thickness.
 * All coordinates retain construction millimetres until model conversion.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Orients iris pigment and its corneal shell together on their resident globe.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Supplies one centred spherical support and rigid radial placement for drawing and optical contact.
 */
export function createPortraitOpticalFrame(
  sphere: IPortraitEyeSphere,
  axialWitness: IAutoMovieVector3,
): { sphere: IPortraitEyeSphere; transform: IAutoMovieMeshTransform } {
  const direction = Vector3.subtract(axialWitness, sphere.center);
  if (
    ![
      sphere.radius,
      sphere.center.x,
      sphere.center.y,
      sphere.center.z,
      direction.x,
      direction.y,
      direction.z,
    ].every(Number.isFinite) ||
    sphere.radius <= 0 ||
    Vector3.length(direction) === 0
  )
    throw new Error(
      "Radial optics need a finite positive globe and noncentral axial witness.",
    );
  return {
    sphere: { center: Vector3.create(), radius: sphere.radius },
    transform: {
      translation: { ...sphere.center },
      rotation: rotationBetween(
        Vector3.create(0, 0, 1),
        Vector3.normalize(direction),
      ),
    },
  };
}
