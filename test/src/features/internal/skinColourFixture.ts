import type { IPortraitSkinColourRegion } from "@automovie/human";
import type { IControlMesh } from "@automovie/human/geometry/subdivideControlMesh";

/** A compact origin-centred pigment with unequal radii and RGB attenuation. */
export const skinColourRegion = (): IPortraitSkinColourRegion => ({
  name: "test-region",
  anchor: 0,
  offset: [0, 0, 0],
  radius: [2, 4, 8],
  gain: [0.8, 0.6, 0.4],
  strength: 0.5,
});

/** Two triangles with a shared diagonal whose midpoint is exactly the origin. */
export const skinColourSquare = (): IControlMesh => ({
  positions: [
    [-2, -2, 0],
    [2, -2, 0],
    [2, 2, 0],
    [-2, 2, 0],
  ],
  indices: [0, 1, 2, 0, 2, 3],
  groups: [0, 0],
});
