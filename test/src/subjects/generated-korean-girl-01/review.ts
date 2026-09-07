import type * as Brows from "./eyebrows";
import type * as Fitted from "./fittedModel";
import type * as Mouth from "./mouth";

/**
 * Identity of the last actually opened complete capture, including its failed
 * likeness and attachment review. New construction may be newer than this
 * receipt. Missing source-review companions remain warnings, never acceptance.
 *
 * @evidence {@link Fitted.buildFittedReferencePortrait} Opened the actual source comparison, nine views and three clay frames after pushing 204ff1ec. Continuous skin is present, but lids, nasal/cheek/lip depth, dentition, neck and hair attachments remain unaccepted.
 * @evidence {@link Mouth.buildPortraitMouth} Read the metric arch and crown placement and inspected both profiles. Posterior oral correspondences are excluded in this capture; the lip-derived per-crown placement still projects the row ahead of the lips. Isolated spacing tests do not validate this assembly.
 * @evidence {@link Brows.buildPortraitEyebrow} Read final-skin depth/normal attachment and inspected the current source pose and front. Coarse brows are visible; detailed shape/density remains deferred. Older sampled contact counts do not describe this fitted capture.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "f01dbf343250ad76ca1be5067ab709f3531fc8f4475c51c93258f2879cb26962",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
