import { createPortraitLidSectionSampler } from "./lidSection";

/**
 * A point in the lower lid's transverse section. Offset runs outward from the
 * aperture in its local image-plane normal; projection is signed anterior
 * relief over the common globe-to-skin depth bridge. Both use millimetres.
 * These describe visible tissue, not measured muscle thickness.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Names lower-lid tissue offsets separately from anterior surface relief.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Carries millimetre distance from the wet aperture and signed projection over the common depth bridge.
 */
export interface IPortraitLowerLidPoint {
  /** Positive distance from the aperture, in millimetres. */
  offset: number;
  /** Signed anterior relief relative to the section's support bridge, in mm. */
  projection: number;
}

/**
 * A complete lower-lid section from its margin through pretarsal fullness and
 * the subtarsal boundary to preseptal skin. The attachment is a live skin query,
 * so its depth is owned by the host rather than supplied a second time here.
 * Internal sample positions increase strictly in the order listed below.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Distinguishes margin, pretarsal roll, subtarsal boundary and preseptal continuation in one eyelid section.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Requires six ordered tissue stations and an outer live-skin attachment beyond them.
 */
export interface IPortraitLowerLidSection {
  /** Narrow skin margin outside the wet opening. */
  margin: IPortraitLowerLidPoint;
  /** Crest of the pretarsal roll, distinct from optical contact displacement. */
  pretarsalCrest: IPortraitLowerLidPoint;
  /** Lower shoulder of the pretarsal body. */
  pretarsalLower: IPortraitLowerLidPoint;
  /** Inner side of the boundary below the pretarsal roll. */
  subtarsalInner: IPortraitLowerLidPoint;
  /** Outer side of that boundary, before the broader preseptal transition. */
  subtarsalOuter: IPortraitLowerLidPoint;
  /** Broader skin section beyond the pretarsal roll. */
  preseptal: IPortraitLowerLidPoint;
  /** Outer skin attachment distance, greater than every internal offset. */
  attachment: number;
}

/**
 * Optional longitudinal detail for one eye. Sections progress from anatomical
 * medial zero to lateral one, independently of the head-X ordering of an eye.
 * Omission is handled by the eye and retains its complete basic row formulas.
 * A supplied list replaces this detailed population and must span both ends.
 * The eye blends the detailed section into its basic canthi with a declared
 * sine weight; it does not add the new projections to the old lower roll.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Allows a complete sequence of lower-lid sections to replace the basic tissue profile.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines two-to-32 medial-to-lateral witnesses spanning both canthi without assuming head-X handedness.
 */
export interface IPortraitLowerLidProfile {
  /** Two through 32 strictly ordered section witnesses, including zero and one. */
  sections: readonly {
    /** Medial-to-lateral progress in [0,1]. */
    at: number;
    /** Complete transverse tissue section at this progress. */
    section: IPortraitLowerLidSection;
  }[];
}

const roles = [
  "margin",
  "pretarsalCrest",
  "pretarsalLower",
  "subtarsalInner",
  "subtarsalOuter",
  "preseptal",
] as const;

/**
 * Own and interpolate the full lower-lid section. Cubic smoothstep between
 * witnesses keeps each scalar within its endpoints and gives zero longitudinal
 * derivative at a witness. Ordered offsets remain ordered under the same
 * convex weights, so a fold cannot cross its neighbouring tissue row.
 * The consumer still owns shared skin attachment, canthal fade and contact.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Constructs a continuous lower-lid tissue section from complete authored witnesses.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Copies and validates ordered offsets, then uses shared convex smoothstep weights so adjacent tissue rows retain their order.
 */
export function createPortraitLowerLidProfile(
  input: IPortraitLowerLidProfile,
): (at: number) => IPortraitLowerLidSection {
  return createPortraitLidSectionSampler(input.sections, roles, "Lower-lid");
}
