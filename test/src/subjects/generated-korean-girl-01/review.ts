import type * as Attachment from "./dentalComponent";
import type * as Dental from "./dentalRow";
import type * as Head from "./head";
import type * as Nasal from "./nose";
import type * as Ocular from "./ocularTissues";

/**
 * Last actually inspected complete capture. The active source may be newer;
 * missing source companions remain warnings and no visual acceptance is implied.
 *
 * @evidence {@link Head.buildPortraitHead} Read the shared fit/attach/refine/finish pipeline and inspected 2567261f from all nine viewpoints, source pose and three clay views. The recovered neck is continuous; facial likeness remains unaccepted.
 * @evidence {@link Dental.buildPortraitDentalRow} Checked the common arch and gingival plane, ran the rigid-group oracle and opened front, both profiles and clay. The row is coherent; dental appearance remains simplified.
 * @evidence {@link Attachment.createPortraitDentalComponent} Read the no-cut interior protocol and verified translation of the actual refined socket. The exported face contains one dental group behind the upper lip; the photographed smile is not yet matched.
 * @evidence {@link Nasal.createPortraitNoseComponent} Read the shared rim, skin constraints and lining attachment and inspected the actual source comparison and profiles. Aperture exposure and insufficiently distinct tip/alar transitions remain unaccepted.
 * @evidence {@link Ocular.createPortraitOcularTissues} Read the copied profile, medial-side mapping, lid/globe interpolation and clipping; ran mirroring, translation, contact, ownership and refusal scenarios plus a failing side-reversal probe. Opened actual 2567261f comparison, nine views and three clays. Warm medial tissue is visible; overall eye appearance remains unaccepted.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "2567261f720217d9bf4575f9f849d8a4eebf68d0de3e283deeb547dd39dd6d56",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
