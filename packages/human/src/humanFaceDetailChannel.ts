/**
 * Shared scalar-channel schema and constructor. Domain inventories supply field
 * semantics and numeric envelopes; this owner derives stable IDs, field paths,
 * paired ownership and skin attachment context once. It has no mutable state or
 * subject dependency. humanFaceDetail resolves and edits the resulting channels.
 */
import type { humanFaceRegions } from "./humanFaceRegion";

/**
 * A numerical anatomical channel. Identity neutral is the versioned basis
 * value, not a universal person's dimension. Coupled geometry still requires
 * successful construction; these scalar envelopes cannot prove attachment.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Gives detailed editor channels stable anatomical semantics and signed units.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Declares scalar editing envelopes separately from coupled geometry admission.
 * @author Samchon
 */
export interface IAutoMovieHumanFaceDetailChannel {
  /** Stable path beneath the detailed profile, independent of the person. */
  id: string;
  /** Anatomical profile owning this channel. */
  region: (typeof humanFaceRegions)[number];
  /** Field path beneath that profile. */
  path: readonly string[];
  /** Anatomical meaning, also shown by the editor. */
  meaning: string;
  /** Millimetres, degrees, a dimensionless ratio or a discrete count. */
  unit: string;
  /** Inclusive authoring-envelope minimum. */
  minimum: number;
  /** Inclusive authoring-envelope maximum. */
  maximum: number;
  /** Slider interval; numeric entry may retain finer valid precision. */
  step: number;
  /** The exact neutral is read from this document's inherited basis. */
  neutral: "basis";
  /** Positive and negative changes keep this interpretation for every person. */
  effect: string;
  /** Whether right and left can override this profile independently. */
  paired: boolean;
  /** Shared geometry reference used when the value is constructed. */
  attachment: string;
}

/**
 * Construct one independently documented scalar channel without admitting geometry.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Keeps numerical authoring channels tied to their anatomical profile and units.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls Supplies scalar editing envelopes while leaving coupled geometry admission to the component.
 */
export const createHumanFaceDetailChannel = (
  region: Exclude<
    IAutoMovieHumanFaceDetailChannel["region"],
    "hairLayers" | "skinColour"
  >,
  path: string,
  meaning: string,
  unit: string,
  minimum: number,
  maximum: number,
  step: number,
  effect: string,
): IAutoMovieHumanFaceDetailChannel => ({
  id: `${region}.${path}`,
  region,
  path: path.split("."),
  meaning,
  unit,
  minimum,
  maximum,
  step,
  neutral: "basis",
  effect,
  paired: region === "eye" || region === "cheek" || region === "ear",
  attachment: {
    skin: "live bilateral eye/brow and oral attachments on the shared skin",
    hair: "authored scalp-root guides in head millimetres",
    frame:
      "basis.host: nasion, gonial, gnathion, pogonion, frontal and temporal supports; basis.bindings.eyes: bilateral brow foundation",
    eye: "basis.bindings.eyes: shared skin margin and identity optical centre",
    nose: "basis.bindings.nose: exterior support and shared cavity rims",
    mouth: "basis.bindings.mouth: common vermilion and oral margins",
    tongue:
      "basis.bindings.mouth.lower and jawHinge: observed oral frame with posterior anchoring",
    cheek: "basis.bindings.cheeks: malar, medial, buccal and modiolus anchors",
    cranium:
      "basis.host facial oval: shared forehead, temple and mandibular boundary",
    ear: "resolved temporal skin: embedded pinna root",
    neck: "cranial collar: continuous cervical sections",
    dentition: "basis.bindings.dentition: fixed maxillary frame",
    lowerDentition:
      "basis.bindings.mouth.lower and jawHinge: observed mandibular frame",
    orbits: "recipe.orbits: retained superior-orbit anchors",
    relief: "named supplemental skin supports",
    curves: "named supplemental anatomical curves",
  }[region],
});
