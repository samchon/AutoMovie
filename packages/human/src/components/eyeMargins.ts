import type { IControlMesh } from "../geometry/subdivideControlMesh";
import { portraitEyeLidRows, portraitEyeLoop } from "./eyeLidRows";
import type { IPortraitEyeShape, IPortraitEyeSocket } from "./eyeShape";
import { createPortraitLowerLidProfile } from "./lowerLidSection";
import { createPortraitUpperLidProfile } from "./upperLidSection";

/**
 * Attach the lid rows to the already fitted shared outer rim. New inner vertex
 * identities are returned for the eyeball to read after common subdivision.
 * The optional group is a registered host skin region; omission retains zero.
 * An optional sphere-projected guide retains the gaze-independent outer seam
 * while the supplied aperture carries the inner ocular contact. Their XY
 * difference fades to zero across the same section bridge as its depth.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Joins upper and lower tissue rows to the already fitted common eye boundary.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Adds seven shared lid rings and oriented triangles, retains registered skin-region ownership and returns the inner rim's resident identities.
 */
export function appendPortraitEyeMargins(
  cage: IControlMesh,
  aperture: number[][],
  socket: IPortraitEyeSocket,
  shape: IPortraitEyeShape,
  group = 0,
  lowerProfile = shape.lowerLidProfile === undefined
    ? undefined
    : createPortraitLowerLidProfile(shape.lowerLidProfile),
  guide?: readonly (readonly number[])[],
  upperProfile = shape.upperLidProfile === undefined
    ? undefined
    : createPortraitUpperLidProfile(shape.upperLidProfile),
): Map<number, number> {
  const rows = portraitEyeLidRows(
    aperture,
    socket,
    shape,
    new Map(portraitEyeLoop(socket).map((id) => [id, cage.positions[id][2]])),
    lowerProfile,
    guide,
    upperProfile,
  );
  const margins = new Map<number, number>();
  const rings = [rows.map((row) => row.id)];
  for (const name of [
    "hoodUpper",
    "hoodEdge",
    "creaseOuter",
    "creaseInner",
    "tarsal",
    "ridge",
    "inner",
  ] as const)
    rings.push(rows.map((row) => cage.positions.push(row[name]) - 1));
  for (let i = 0; i < rows.length; i++)
    margins.set(rows[i].id, rings[rings.length - 1][i]);
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let i = 0; i < rows.length; i++) {
      const j = (i + 1) % rows.length;
      cage.indices.push(
        rings[ring][i],
        rings[ring][j],
        rings[ring + 1][i],
        rings[ring][j],
        rings[ring + 1][j],
        rings[ring + 1][i],
      );
      cage.groups.push(group, group);
    }
  return margins;
}
