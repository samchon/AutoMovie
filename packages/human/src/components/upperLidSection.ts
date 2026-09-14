import { createPortraitLidSectionSampler } from "./lidSection";

/**
 * One visible upper-lid tissue station over the ocular-to-skin support bridge.
 * It describes surface shape, not a measured muscle or fat-layer thickness.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates upper-lid transverse placement from anterior tissue relief.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Measures outward offset and signed anterior relief in construction millimetres.
 */
export interface IPortraitUpperLidPoint {
  /** Positive distance from the aperture along its planar outward normal, in mm. */
  offset: number;
  /** Signed anterior relief over the common contact-to-host bridge, in mm. */
  projection: number;
}

/**
 * Upper tissue from the dry margin through the tarsal body and supratarsal
 * crease into the hood and preseptal transition. Offsets increase strictly in
 * this order; separate projections control a shallow fold or a prominent hood
 * without adding the basic fold depth or tarsal volume a second time.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Names independent margin, tarsal, crease, hood and preseptal surface controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines six ordered upper tissue stations ending at a live host-skin attachment.
 */
export interface IPortraitUpperLidSection {
  /** Narrow dry margin outside the ocular contact rim. */
  margin: IPortraitUpperLidPoint;
  /** Exposed pretarsal body below the supratarsal crease. */
  tarsal: IPortraitUpperLidPoint;
  /** Lower bank of the crease, distinct from tarsal fullness. */
  creaseInner: IPortraitUpperLidPoint;
  /** Upper bank of the crease before the overlying hood. */
  creaseOuter: IPortraitUpperLidPoint;
  /** Visible hood edge above the crease. */
  hood: IPortraitUpperLidPoint;
  /** Broader continuation toward orbital skin. */
  preseptal: IPortraitUpperLidPoint;
  /** Outer skin-query distance, greater than all six tissue offsets, in mm. */
  attachment: number;
}

/**
 * Independently authored medial-to-lateral upper-lid sections. The eye blends
 * these into the basic canthi with a sine envelope and retains the same wet
 * aperture, optical identity and shared skin attachment during performance.
 * A supplied section population replaces its predecessor; omission is handled
 * by the eye and preserves the original basic upper-lid formulas.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Allows medial and lateral upper folds to have different transverse tissue profiles.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Requires two through 32 ordered witnesses spanning anatomical medial zero to lateral one.
 */
export interface IPortraitUpperLidProfile {
  /** Two through 32 complete sections, strictly ordered and including both ends. */
  sections: readonly {
    /** Anatomical medial-to-lateral progress in [0,1], independent of head-X side. */
    at: number;
    /** Complete transverse tissue section at this witness. */
    section: IPortraitUpperLidSection;
  }[];
}

/**
 * Own and interpolate upper tissue without duplicating the lower lid's numerical
 * interpolation. Shared convex smoothstep preserves the order of all six rows;
 * the eye consumes each returned section for attachment and visible geometry.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies the eye's independent upper tissue section from authored anatomical witnesses.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Validates and copies the upper profile through the common order-preserving lid sampler.
 */
export function createPortraitUpperLidProfile(
  input: IPortraitUpperLidProfile,
): (at: number) => IPortraitUpperLidSection {
  return createPortraitLidSectionSampler(
    input.sections,
    ["margin", "tarsal", "creaseInner", "creaseOuter", "hood", "preseptal"],
    "Upper-lid",
  );
}
