import { polygonIsSimple } from "@automovie/engine";

import {
  type IPortraitEyePerformance,
  assertPortraitEyePerformance,
} from "./eyePerformance";
import { createPortraitLidSectionSampler } from "./lidSection";

const roles = [
  "margin",
  "tarsal",
  "creaseInner",
  "creaseOuter",
  "hood",
  "preseptal",
] as const;

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
 * crease into the hood and preseptal transition. The ordinary profile orders
 * all offsets strictly. A profile with explicit closed sections can return
 * the hood across the crease, while retaining a simple transverse skin curve.
 * Relief replaces the basic fold depth and volume rather than adding them twice.
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Names independent margin, tarsal, crease, hood and preseptal surface controls.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines six named upper tissue stations with a live host-skin attachment and an explicit folded-profile alternative.
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
  /** Visible hood edge; only an explicitly unfolding profile permits its inward return. */
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
  /**
   * Optional fully closed, unfolded sections at exactly the same witnesses and
   * with unchanged attachment distances. Selecting them admits an inward hood
   * return in the observed sections. Current closure interpolates from those
   * observed sections; opening farther extrapolates and must remain valid.
   * Omission retains strictly ordered observed sections and prior performance.
   */
  closedSections?: IPortraitUpperLidProfile["sections"];
}

/**
 * Own and interpolate upper tissue without duplicating the lower lid's numerical
 * interpolation. Shared smoothstep interpolates each longitudinal witness.
 * Explicit closed sections permit a returning hood and supply its unfolding
 * target without changing the outer skin attachment or station identities.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Supplies the eye's independent upper tissue section from authored anatomical witnesses.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Keeps the ordinary ordered sampler and validates explicit folded transverse sections with a fixed outer attachment.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-expression Unfolds the same named upper tissue stations from observed closure toward an authored closed section.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression Uses observed-relative closure without changing optical dimensions or inferring hidden tissue from a photograph.
 */
export function createPortraitUpperLidProfile(
  input: IPortraitUpperLidProfile,
  performance?: IPortraitEyePerformance,
): (at: number) => IPortraitUpperLidSection {
  if (input.closedSections === undefined)
    return createPortraitLidSectionSampler(input.sections, roles, "Upper-lid");
  if (performance !== undefined) assertPortraitEyePerformance(performance);
  const observed = createPortraitLidSectionSampler(
    input.sections,
    roles,
    "Upper-lid",
    assertFoldedSection,
  );
  const closed = createPortraitLidSectionSampler(
    input.closedSections,
    roles,
    "Upper-lid",
  );
  if (
    input.sections.length !== input.closedSections.length ||
    input.sections.some(
      (witness, i) =>
        witness.at !== input.closedSections![i].at ||
        witness.section.attachment !==
          input.closedSections![i].section.attachment,
    )
  )
    throw new Error(
      "Upper-lid unfolding needs the same witnesses and fixed attachment distances.",
    );
  const closure =
    performance === undefined
      ? 0
      : (performance.blink - performance.observedBlink) /
        (1 - performance.observedBlink);
  if (closure === 0) return observed;
  return (at) => {
    const from = observed(at),
      to = closed(at);
    for (const role of roles) {
      from[role].offset += closure * (to[role].offset - from[role].offset);
      from[role].projection +=
        closure * (to[role].projection - from[role].projection);
    }
    assertFoldedSection(from);
    return from;
  };
}

/** Check the explicit transverse skin curve, not a head-wide collision claim. */
function assertFoldedSection(section: IPortraitUpperLidSection): void {
  let previous = 0;
  for (const role of roles) {
    const point = section[role];
    if (
      !Number.isFinite(point.offset) ||
      !Number.isFinite(point.projection) ||
      point.offset <= 0 ||
      point.offset >= section.attachment
    )
      throw new Error(
        "Upper-lid folded tissue must remain finite inside its attachment.",
      );
    if (role === "hood") continue;
    if (point.offset <= previous)
      throw new Error(
        "Upper-lid folding only permits the hood to return inward.",
      );
    previous = point.offset;
  }
  if (
    section.hood.offset <= section.margin.offset ||
    section.hood.offset >= section.preseptal.offset
  )
    throw new Error(
      "Upper-lid hood must remain between margin and preseptal skin.",
    );
  const floor =
    Math.min(0, ...roles.map((role) => section[role].projection)) - 1;
  // Close below the entire tissue curve. This auxiliary edge is only for the
  // engine's shared metre-space intersection predicate; it is never rendered.
  const polygon = [
    { x: 0, y: 0 },
    ...roles.map((role) => ({
      x: section[role].offset / 1000,
      y: section[role].projection / 1000,
    })),
    { x: section.attachment / 1000, y: 0 },
    { x: section.attachment / 1000, y: floor / 1000 },
    { x: 0, y: floor / 1000 },
  ];
  if (!polygonIsSimple(polygon))
    throw new Error("Upper-lid folded tissue must not cross or touch itself.");
}
