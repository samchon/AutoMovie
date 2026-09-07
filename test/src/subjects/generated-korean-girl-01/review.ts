import type * as Cheeks from "./cheeks";
import type * as Dental from "./dentalArc";
import type * as Brows from "./eyebrows";
import type * as Mouth from "./mouth";
import type * as Nasal from "./nostrilRim";

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
 * @evidence {@link Brows.IPortraitEyebrowProfile} Read each dimension's unit, sign and range beside its validator and caller. The profile controls fibre dimensions independently of subject-owned brow boundaries; it does not claim measured hair anatomy.
 * @evidence {@link Brows.portraitEyebrowProfile} Inspected the current values in the exported configuration and the actual GLTF comparison, six yaw views and clay. Fibres follow the skin but the brow shape and density still differ from the photograph.
 * @evidence {@link Brows.assertPortraitEyebrowProfile} Checked zero and maximum counts, segment boundaries, finite dimensions, taper and overflow refusal against the profile tests. The eye factory copies the nested profile and validates it before fitting.
 * @evidence {@link Brows.buildPortraitEyebrow} Read the final-skin depth query, local normal, fibre distribution and metric conversion. The sloping-plane oracle checks normal clearance and translated attachment. Actual GLB samples contain no brow vertex or triangle centre below the skin; this sampled test does not prove absence of every possible surface intersection. Inspected all current required views after rendering.
 * @evidence {@link Nasal.resizePortraitNostrilRim} Reproduced a tilted-aperture height edit that changed its plane, then verified local-plane width/height, the profile-plane guide, retained nonplanarity, translation, exact identity, refusal boundaries and the dependent cavity ring. Inspected the current actual GLTF comparison, six yaw views and clay; the nasal shape remains unaccepted.
 * @evidence {@link Nasal.fitPortraitNostrilRim} Read the shared normalized basis, oriented normal, principal ellipse and centroid correction beside the fitting tests. Zero blend preserves the measured boundary; sizing and explicit rotation remain separate operations. The current source fit uses zero ellipse regularization.
 * @evidenceReview {@link Brows.IPortraitEyebrowProfile} #c3ca9aa Checked the documented millimetre controls, taper/count limits and binding ownership against the validator, tests and configured eye consumer.
 * @evidenceReview {@link Brows.assertPortraitEyebrowProfile} #fc4e44c Read every refusal condition beside the zero/maximum-count, segment-limit, finite-dimension, taper and overflow tests; the profile and component tests passed.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "4f1721b36cb6c866829b7cdc51fe00ddd70b68e6a0bec50edbc153efc92d4951",
  profileSha256:
    "56cb3bed90492a7ce35066843aa15fd78c9375c1d152f4e5ee856ab629c8d777",
};
