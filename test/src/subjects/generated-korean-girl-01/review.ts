import type * as Dental from "./dentalArc";
import type * as Mouth from "./mouth";

/**
 * Latest inspected capture identity, including a failed overall likeness review.
 * The source review population is incomplete. Missing companions remain warnings
 * until each source and its present rendered consequences have been inspected.
 * This carrier records observed failures as well as the exact capture identity.
 *
 * @evidence {@link Dental.createPortraitDentalArc} Read the cumulative XZ-distance guide and posterior continuations; checked unequal crowns on a 45-degree line, then inspected the rendered dental row from six directions.
 * @evidence {@link Mouth.buildPortraitMouth} Read physical crown widths, explicit clearances and tangent placement, ran the dental spacing scenario, and inspected the current six-view and clay sheets. Crowns stay inside the lip opening but their shapes remain too uniform.
 * @evidence {@link Mouth.createPortraitMouthComponent} Checked retained cut identities and translated refined openings in the mouth test; the rendered lip boundary continues to occlude the dental row after replacing its placement calculation.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "255b45a34ecf225a8ebc5489829a7f844a8ffdbfb00174d3a25f10515eb6264d",
  profileSha256:
    "af197627523f2992c55a12370c3b39dbdd0537d08c81bf1fc92612a6008e87f1",
};
