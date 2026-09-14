import type { IAutoMovieMaterial } from "@automovie/interface";

import type { IPortraitHairShape } from "./hairCards";
import {
  createPortraitHairNormalTexture,
  createPortraitHairTexture,
} from "./hairTexture";

/**
 * Derive an owned, two-sided card finish from an admitted base material. Keep
 * its authored mask cutoff, including zero; omission uses 0.45. The independent
 * identity and resident mask leave untextured users of the base unchanged.
 * The model owner validates base material fields and derived-id uniqueness.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Gives numerical hair cards a resident fibre mask while preserving authored finish controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Separates card texture and mask handling from shared untextured finishes without changing geometry.
 */
export function createPortraitHairMaterial(
  finish: IAutoMovieMaterial,
  shape: Pick<
    IPortraitHairShape,
    "seed" | "fibres" | "coverage" | "fibreNormalScale"
  >,
): IAutoMovieMaterial {
  const scale =
    shape.fibreNormalScale === undefined ? 0 : shape.fibreNormalScale;
  if (!Number.isFinite(scale) || scale < 0 || scale > 1)
    throw new Error("Hair fibre-normal strength must be finite in [0,1].");
  const id = finish.id + ":hair-cards";
  return {
    ...structuredClone(finish),
    id,
    name: id,
    doubleSided: true,
    alphaMode: "mask",
    alphaCutoff: finish.alphaCutoff ?? 0.45,
    baseColorTexture: createPortraitHairTexture(
      shape.seed,
      shape.fibres,
      shape.coverage,
    ),
    ...(scale === 0
      ? {}
      : {
          normalTexture: createPortraitHairNormalTexture(
            shape.seed,
            shape.fibres,
            shape.coverage,
          ),
          normalScale: scale,
        }),
  };
}
