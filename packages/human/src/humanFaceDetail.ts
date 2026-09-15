/**
 * Resolve and immutably edit detailed anatomical document overrides. Domain
 * inventories own each numerical envelope; this module retains their display
 * order and owns channel admission, inherited reads and detached path writes.
 * Edits preserve the caller, sibling aliases and omitted optional components.
 * The resulting document still requires full component geometry admission.
 */
import type { IAutoMovieHumanFaceDocument } from "./IAutoMovieHumanFaceDocument";
import type { IAutoMovieHumanFaceDetailChannel } from "./humanFaceDetailChannel";
import {
  humanFaceCheekChannels,
  humanFaceEarChannels,
  humanFaceFrameChannels,
  humanFaceNeckChannels,
} from "./humanFaceEnvelopeChannels";
import { humanFaceNasalChannels } from "./humanFaceNasalChannels";
import {
  humanFaceLashChannels,
  humanFaceOcularChannels,
} from "./humanFaceOcularChannels";
import {
  humanFaceCavityChannels,
  humanFaceLipChannels,
  humanFaceLowerDentalChannels,
  humanFaceTongueChannels,
  humanFaceUpperDentalChannels,
} from "./humanFaceOralChannels";
import { humanFaceRegionValue } from "./humanFaceRegion";
import {
  humanFaceHairChannels,
  humanFaceSkinChannels,
} from "./humanFaceSurfaceChannels";
import { mergeHumanFaceSettings } from "./mergeHumanFaceSettings";

export type { IAutoMovieHumanFaceDetailChannel } from "./humanFaceDetailChannel";

/**
 * Scalar controls on the component profiles. Array and complete-object profiles
 * remain independently replaceable through the same region document editor.
 * Ranges are editing envelopes; the part's coupled validator remains decisive.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Connects numerical sliders to actual detailed shape settings.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Provides field meaning, applied-value inspection and anatomical attachment context.
 */
export const humanFaceDetailChannels: readonly IAutoMovieHumanFaceDetailChannel[] =
  [
    ...humanFaceNeckChannels,
    ...humanFaceCavityChannels,
    ...humanFaceTongueChannels,
    ...humanFaceLashChannels,
    ...humanFaceSkinChannels,
    ...humanFaceHairChannels,
    ...humanFaceLowerDentalChannels,
    ...humanFaceFrameChannels,
    ...humanFaceOcularChannels,
    ...humanFaceNasalChannels,
    ...humanFaceLipChannels,
    ...humanFaceCheekChannels,
    ...humanFaceEarChannels,
    ...humanFaceUpperDentalChannels,
  ];

/**
 * Read one present scalar from the final applied anatomical profile.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Displays actual combined values rather than echoing a slider's requested number.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Resolves side-aware scalar display through the document interpreter.
 */
export function humanFaceDetailValue(
  document: IAutoMovieHumanFaceDocument,
  id: string,
  side?: "right" | "left",
): number | undefined {
  const definition = definitionOf(id);
  let value: unknown = humanFaceRegionValue(document, definition.region, side);
  for (const key of definition.path) {
    if (value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value as number | undefined;
}

/**
 * Write or remove one exact scalar override without flattening the rest of a
 * profile into explicit values. Subsequent trait edits retain every other edit.
 * Removal never creates a missing path. Empty ancestors of the removed leaf
 * return to omission, so an inherited optional component stays optional.
 * Shared authored objects are detached along the edited path, so neither a
 * write nor removal can alter another owner through a caller-supplied alias.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Separates one user detail from inherited settings and independent sides.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Preserves override intent rather than serializing a derived combined profile.
 */
export function setHumanFaceDetail(
  document: IAutoMovieHumanFaceDocument,
  id: string,
  value: number | undefined,
  side?: "right" | "left",
): IAutoMovieHumanFaceDocument {
  const definition = definitionOf(id);
  assertDetailValue(definition, value);
  if (
    side !== undefined &&
    (!definition.paired || (side !== "right" && side !== "left"))
  )
    throw new Error("This detail does not have that independent side owner.");
  const next = structuredClone(document);
  const path = [
    ...(side === undefined ? ["detail"] : ["asymmetry", side]),
    definition.region,
    ...definition.path,
  ];
  return writeDetail(next, path, value);
}

/**
 * Edit one named additional hair layer with the existing hair scalar vocabulary.
 * The selected authored population becomes a whole-array override, preserving
 * every other layer and the separate legacy hair owner. Clearing one scalar is
 * deliberately absent: inheritance resets the entire additional-layer region.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Edits a named layer's numeric profile without requiring its guide array to be re-entered.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Uses the same hair channel bounds and units while retaining complete-array replacement semantics.
 */
export function setHumanFaceHairLayerDetail(
  document: IAutoMovieHumanFaceDocument,
  layerId: string,
  id: string,
  value: number,
): IAutoMovieHumanFaceDocument {
  const definition = definitionOf(id);
  if (definition.region !== "hair")
    throw new Error("A hair layer accepts only hair detail channels.");
  assertDetailValue(definition, value);
  const layers = mergeHumanFaceSettings(
    document.basis.recipe.hairLayers,
    document.detail?.hairLayers,
  );
  const index = layers?.findIndex((layer) => layer.id === layerId) ?? -1;
  if (index < 0) throw new Error("The selected hair layer does not exist.");
  const next = structuredClone(document);
  (next.detail ??= {}).hairLayers = layers;
  return writeDetail(
    next,
    ["detail", "hairLayers", String(index), "profile", ...definition.path],
    value,
  );
}

function assertDetailValue(
  definition: IAutoMovieHumanFaceDetailChannel,
  value: number | undefined,
): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) ||
      value < definition.minimum ||
      value > definition.maximum ||
      (definition.unit === "count" && !Number.isInteger(value)))
  )
    throw new Error(`Invalid numerical detail: ${definition.id}.`);
}

function writeDetail(
  next: IAutoMovieHumanFaceDocument,
  path: readonly string[],
  value: number | undefined,
): IAutoMovieHumanFaceDocument {
  let object = next as unknown as Record<string, unknown>;
  const ancestors: { object: Record<string, unknown>; key: string }[] = [];
  for (const key of path.slice(0, -1)) {
    if (object[key] === undefined) {
      if (value === undefined) return next;
      object[key] = {};
    } else {
      // structuredClone preserves aliases. Detach only the containers on this
      // path so a selected side/layer cannot also edit its basis or sibling.
      const child = object[key] as Record<string, unknown> | unknown[];
      object[key] = Array.isArray(child) ? [...child] : { ...child };
    }
    ancestors.push({ object, key });
    object = object[key] as Record<string, unknown>;
  }
  const key = path[path.length - 1];
  if (value === undefined) {
    if (!Object.hasOwn(object, key)) return next;
    delete object[key];
    for (const parent of ancestors.reverse()) {
      if (Object.keys(object).length !== 0) break;
      delete parent.object[parent.key];
      object = parent.object;
    }
  } else object[key] = value;
  return next;
}

function definitionOf(id: string): IAutoMovieHumanFaceDetailChannel {
  const definition = humanFaceDetailChannels.find(
    (channel) => channel.id === id,
  );
  if (definition === undefined)
    throw new Error(`Unknown anatomical detail: ${id}.`);
  return definition;
}
