import type * as Brows from "./eyebrows";
import type * as Fitted from "./fittedModel";
import type * as Mouth from "./mouth";

/**
 * Identity of the last actually opened complete capture, including its failed
 * likeness and attachment review. New construction may be newer than this
 * receipt. Missing source-review companions remain warnings, never acceptance.
 *
 * @evidence {@link Fitted.buildFittedReferencePortrait} Opened the actual source comparison, nine views and three clay frames after pushing f29a79a8. Continuous skin is present, but lids, nasal/cheek/lip depth, dentition, neck and hair attachments remain unaccepted.
 * @evidence {@link Mouth.buildPortraitMouth} Read the metric arch and crown placement and inspected both profiles. The active fit supplies invalid posterior oral correspondence depths to this attachment; crowns project ahead of the lips. Isolated spacing tests do not validate this assembly.
 * @evidence {@link Brows.buildPortraitEyebrow} Read final-skin depth/normal attachment and inspected the current source pose and front. Coarse brows are visible; detailed shape/density remains deferred. Older sampled contact counts do not describe this fitted capture.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "19d73354215e0c5ae7f41aff7953f0b0d2b50d6d9829879640b184fbbde6a8b8",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
