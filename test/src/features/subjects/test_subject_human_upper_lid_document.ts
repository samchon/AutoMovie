import {
  type IPortraitUpperLidProfile,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Upper lid sections survive the same complete-region and JSON editor paths as
 * other anatomy. A side-specific population replaces, rather than splices, it.
 *
 * Scenarios:
 * 1. Common three-station detail round-trips all six roles and signed depths.
 * 2. A left two-station replacement retains the right profile and unrelated
 *    nose trait. Clearing the side restores the common section population.
 * 3. Missing a required crease point refuses at JSON admission.
 */
export const test_subject_human_upper_lid_document = (): void => {
  const source = humanFaceFixture();
  source.controls = { noseWidth: 0.1 };
  const profile: IPortraitUpperLidProfile = {
    sections: [0, 0.5, 1].map((at) => ({
      at,
      section: {
        margin: { offset: 0.2, projection: 0.1 },
        tarsal: { offset: 1.5, projection: 0.3 },
        creaseInner: { offset: 3, projection: -0.2 },
        creaseOuter: { offset: 3.5, projection: -0.1 },
        hood: { offset: 4.5, projection: 0.2 },
        preseptal: { offset: 6, projection: 0 },
        attachment: 8,
      },
    })),
  };
  const common = replaceHumanFaceRegion({
    document: source,
    basisId: source.basis.id,
    region: "eye",
    value: { upperLidProfile: profile },
  });
  const loaded = parseHumanFaceDocument(serializeHumanFaceDocument(common));
  TestValidator.equals(
    "complete profile survives JSON",
    resolveHumanFaceDocument(loaded).recipe.eye.upperLidProfile,
    profile,
  );
  const left = { sections: [profile.sections[0], profile.sections[2]] };
  const paired = replaceHumanFaceRegion({
    document: loaded,
    basisId: source.basis.id,
    region: "eye",
    side: "left",
    value: { upperLidProfile: left },
  });
  const resolved = resolveHumanFaceDocument(paired);
  TestValidator.equals(
    "left array replaces complete population",
    resolved.left.eye.upperLidProfile,
    left,
  );
  TestValidator.equals(
    "right inherits untouched common",
    resolved.right.eye.upperLidProfile,
    profile,
  );
  TestValidator.equals(
    "other trait retained",
    paired.controls,
    source.controls,
  );
  TestValidator.equals("source remains untouched", source.detail, undefined);
  const reset = replaceHumanFaceRegion({
    document: paired,
    basisId: source.basis.id,
    region: "eye",
    side: "left",
    value: undefined,
  });
  TestValidator.equals(
    "side clear restores inheritance",
    resolveHumanFaceDocument(reset).left.eye.upperLidProfile,
    profile,
  );
  const malformed = JSON.parse(serializeHumanFaceDocument(common));
  delete malformed.detail.eye.upperLidProfile.sections[0].section.creaseOuter;
  TestValidator.predicate(
    "missing required upper point refuses",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(malformed))),
  );
};
