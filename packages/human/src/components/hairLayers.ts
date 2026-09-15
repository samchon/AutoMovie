import type {
  IAutoMovieMaterial,
  IAutoMovieModelPart,
} from "@automovie/interface";

import { type IPortraitHairShape, buildPortraitHairCards } from "./hairCards";
import { createPortraitHairMaterial } from "./hairMaterial";

/**
 * An independently authored static groom layer. Density, guides, pigment mask
 * and normals belong to this profile, not to another layer or a camera angle.
 * Layer names are author-owned identities, not built-in hairstyle selectors.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates inner coverage and outer locks into independently owned surface populations.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Gives each additional hair layer a complete profile and unique identity.
 * @author Samchon
 */
export interface IPortraitHairLayer {
  /** Nonblank identity, unique among additional layers, including empty ones. */
  id: string;
  /** Complete guide and finish profile; empty cards emit neither mesh nor material. */
  profile: IPortraitHairShape;
}

/**
 * Assemble legacy hair and up to eight additional independent surface layers.
 * Each populated profile owns one derived finish and one merged mesh. Base
 * finishes are resolved only from the caller's resident palette, never from a
 * preceding layer's generated material. Omitted layers preserve legacy output.
 * The layer limit bounds authoring cost, not anatomical density. Invalid empty
 * profiles still refuse; no texture or unused finish is allocated for them.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs separately shaded scalp populations without changing the face or shared base finishes.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Keeps additional layer identities, texture ownership and base-finish lookup independent of ordering.
 */
export function buildPortraitHairGroom(props: {
  hair?: IPortraitHairShape;
  layers?: readonly IPortraitHairLayer[];
  materials: readonly IAutoMovieMaterial[];
}): { parts: IAutoMovieModelPart[]; materials: IAutoMovieMaterial[] } {
  const layers = props.layers ?? [];
  if (layers.length > 8)
    throw new Error("A face accepts at most eight additional hair layers.");
  const identities = new Set<string>();
  for (const layer of layers) {
    if (layer.id.trim().length === 0 || identities.has(layer.id))
      throw new Error("Hair layer identities must be nonblank and unique.");
    identities.add(layer.id);
  }
  const parts: IAutoMovieModelPart[] = [];
  const materials = structuredClone([...props.materials]);
  const append = (shape: IPortraitHairShape, layerId?: string): void => {
    const cards = buildPortraitHairCards(shape);
    if (cards.length === 0) return;
    const finish = props.materials.find((item) => item.id === shape.material);
    if (finish === undefined)
      throw new Error("Hair cards require their named resident finish.");
    const material = createPortraitHairMaterial(finish, shape);
    if (layerId !== undefined) {
      material.id = `human-hair-layer:${layerId}`;
      material.name = material.id;
      for (const part of cards) {
        part.id = `scalp-hair-layer:${layerId}`;
        part.name = part.id;
      }
    }
    if (materials.some((item) => item.id === material.id))
      throw new Error(
        "Generated hair finish identity collides with a resident material.",
      );
    materials.push(material);
    for (const part of cards) part.material = material.id;
    parts.push(...cards);
  };
  if (props.hair !== undefined) append(props.hair);
  for (const layer of layers) append(layer.profile, layer.id);
  return { parts, materials };
}
