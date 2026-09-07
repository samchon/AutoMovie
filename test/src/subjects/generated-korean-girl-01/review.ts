import type * as Cheeks from "./cheeks";
import type * as Dental from "./dentalArc";
import type * as Brows from "./eyebrows";
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
 * @evidence {@link Brows.IPortraitEyebrowProfile} Read each dimension's unit, sign and range beside its validator and caller. The profile controls fibre dimensions independently of subject-owned brow boundaries; it does not claim measured hair anatomy.
 * @evidence {@link Brows.portraitEyebrowProfile} Inspected the current values in the exported configuration and the actual GLTF comparison, six yaw views and clay. Fibres follow the skin but the brow shape and density still differ from the photograph.
 * @evidence {@link Brows.assertPortraitEyebrowProfile} Checked zero and maximum counts, segment boundaries, finite dimensions, taper and overflow refusal against the profile tests. The eye factory copies the nested profile and validates it before fitting.
 * @evidence {@link Brows.buildPortraitEyebrow} Read the final-skin depth query, local normal, fibre distribution and metric conversion. The sloping-plane oracle checks normal clearance and translated attachment. Actual GLB samples contain no brow vertex or triangle centre below the skin; this sampled test does not prove absence of every possible surface intersection. Inspected all current required views after rendering.
 * @evidenceReview {@link Brows.IPortraitEyebrowProfile} #c3ca9aa Checked the documented millimetre controls, taper/count limits and binding ownership against the validator, tests and configured eye consumer.
 * @evidenceReview {@link Brows.portraitEyebrowProfile} #718eee1 Read the current fibre dimensions and inspected their actual GLTF in the source comparison, six yaw views and clay; brow likeness remains unaccepted.
 * @evidenceReview {@link Brows.assertPortraitEyebrowProfile} #fc4e44c Read every refusal condition beside the zero/maximum-count, segment-limit, finite-dimension, taper and overflow tests; the profile and component tests passed.
 * @evidenceReview {@link Brows.buildPortraitEyebrow} #a7ad6ee Checked copied input, disabled output, side bindings, normal clearance, translation and unsupported paths in the tests; inspected the current GLTF and measured its brow vertices and triangle centres against its skin.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "637612287ddea222ea5cb1e092b493dc14c465d59c6a4f459037aeef7c8d2439",
  profileSha256:
    "7e11eb6c57c725b24f624b428319a11fa219f42f4fdf67691504ac5bcb5887ec",
};
