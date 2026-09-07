import type * as Cheeks from "./cheeks";
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
 * @evidence {@link Cheeks.createPortraitCheekLayer} Read the copied anatomical bindings, metric volume fields and arc-distance groove integration. Ran neutral, translated, scaled, unequal-knot and refusal cases, then inspected the actual current GLTF comparison and all six yaw views plus clay. Cheek relief is present, while likeness and the detailed perioral transition remain unaccepted.
 * @evidenceReview {@link Cheeks.createPortraitCheekLayer} #c945f20 Read the complete factory and its scalar/binding guards, reproduced the unequal-knot depth failure and verified the arc-distance correction with unit scenarios. Inspected GLTF 853bfa15 in the source comparison, six yaw views and clay; retained the failed likeness verdict and remaining contour differences.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "853bfa15de16fb85bd6432694b99f99c3e9a79014b322e7b38042aa24735093d",
  profileSha256:
    "af197627523f2992c55a12370c3b39dbdd0537d08c81bf1fc92612a6008e87f1",
};
