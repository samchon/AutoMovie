import type {
  AutoMovieHumanFaceOverride,
  IAutoMovieHumanFaceDocument,
  IAutoMovieHumanFaceRecipe,
} from "./IAutoMovieHumanFaceDocument";
import { resolveHumanFaceDocument } from "./resolveHumanFaceDocument";

/**
 * Anatomical profile owners exposed by the document editor, excluding arbitrary
 * source-coordinate editing. Shared surface supplements remain in the document.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Names the numerical editor's replaceable anatomical regions.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Keeps region selection on actual profile owners.
 */
export const humanFaceRegions = [
  "skin",
  "skinColour",
  "hair",
  "hairLayers",
  "frame",
  "eye",
  "nose",
  "mouth",
  "tongue",
  "cheek",
  "cranium",
  "ear",
  "neck",
  "dentition",
  "lowerDentition",
  "orbits",
  "relief",
  "curves",
] as const;

/**
 * Read the actual combined profile, including an explicitly requested side.
 * Missing optional profiles remain absent rather than becoming invented data.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Exposes applied values after traits, details and independent side overrides.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Makes the final interpreted profile inspectable independently of edit history.
 */
export function humanFaceRegionValue<
  K extends (typeof humanFaceRegions)[number],
>(
  document: IAutoMovieHumanFaceDocument,
  region: K,
  side?: "right" | "left",
): IAutoMovieHumanFaceRecipe[K] {
  assertRegion(region, side);
  const face = resolveHumanFaceDocument(document);
  if (
    side !== undefined &&
    (region === "eye" || region === "ear" || region === "cheek")
  )
    return structuredClone(
      face[side][region as "eye" | "ear" | "cheek"],
    ) as IAutoMovieHumanFaceRecipe[K];
  return structuredClone(face.recipe[region]);
}

/**
 * Replace only one exact detailed profile. The incoming profile is bound to the
 * current basis revision; unrelated traits, sides and profiles remain untouched.
 * Undefined removes the selected override and restores inherited interpretation.
 * Geometry and complete schema admission still precede editor publication.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Preserves unrelated settings when a region is replaced or reset to inheritance.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Rejects stale-basis replacement and keeps one explicit override owner.
 */
export function replaceHumanFaceRegion<
  K extends (typeof humanFaceRegions)[number],
>(props: {
  document: IAutoMovieHumanFaceDocument;
  basisId: string;
  region: K;
  side?: "right" | "left";
  value: AutoMovieHumanFaceOverride<IAutoMovieHumanFaceRecipe[K]> | undefined;
}): IAutoMovieHumanFaceDocument {
  assertRegion(props.region, props.side);
  if (props.basisId !== props.document.basis.id)
    throw new Error(
      "Region replacement belongs to a different face basis revision.",
    );
  const document = structuredClone(props.document);
  const value = structuredClone(props.value);
  if (props.side !== undefined) {
    const asymmetry = (document.asymmetry ??= {});
    const selected = (asymmetry[props.side] ??= {});
    // assertRegion restricts this owner to the three independently paired profiles.
    Object.assign(selected, { [props.region]: value });
    if (value === undefined)
      delete selected[props.region as "eye" | "ear" | "cheek"];
  } else {
    const detail = (document.detail ??= {});
    Object.assign(detail, { [props.region]: value });
    if (value === undefined) delete detail[props.region];
  }
  return document;
}

function assertRegion(region: string, side?: string): void {
  if (!(humanFaceRegions as readonly string[]).includes(region))
    throw new Error("Unknown anatomical face region.");
  if (
    side !== undefined &&
    ((side !== "right" && side !== "left") ||
      (region !== "eye" && region !== "ear" && region !== "cheek"))
  )
    throw new Error(
      "Only eyes, cheeks and pinnae have independent side-profile overrides.",
    );
}
