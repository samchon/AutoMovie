import type * as Attachment from "./dentalComponent";
import type * as Dental from "./dentalRow";
import type * as Head from "./head";
import type * as Nasal from "./nose";

/**
 * Last actually inspected complete capture. The active source may be newer;
 * missing source companions remain warnings and no visual acceptance is implied.
 *
 * @evidence {@link Head.buildPortraitHead} Read the shared fit/attach/refine/finish pipeline and inspected 2e4ae6c8 from all nine viewpoints, source pose and three clay views. The recovered neck is continuous; facial likeness remains unaccepted.
 * @evidence {@link Dental.buildPortraitDentalRow} Checked the common arch and gingival plane, ran the rigid-group oracle and opened front, both profiles and clay. The row is coherent; dental appearance remains simplified.
 * @evidence {@link Attachment.createPortraitDentalComponent} Read the no-cut interior protocol and verified translation of the actual refined socket. The exported face contains one dental group behind the upper lip; the photographed smile is not yet matched.
 * @evidence {@link Nasal.createPortraitNoseComponent} Read the shared rim, skin constraints and lining attachment and inspected the actual source comparison and profiles. Aperture exposure and insufficiently distinct tip/alar transitions remain unaccepted.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  gltfSha256:
    "2e4ae6c831a5c82a3db71e9363c7477b12bf550e59fab1cf8530f93eac1bff1c",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
