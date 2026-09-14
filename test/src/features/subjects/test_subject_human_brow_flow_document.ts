import {
  type IPortraitEyebrowFlowProfile,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Eyebrow flow is a complete eye-region setting, including independent sides.
 *
 * Scenarios:
 * 1. Three longitudinal flow witnesses and a density seed survive the public
 *    document round trip; a nonnumeric seed refuses at shape admission.
 * 2. Left replacement uses a complete two-witness array while the right and an
 *    unrelated trait remain unchanged. Clearing restores common inheritance.
 * 3. Missing a required upper-root direction refuses at JSON admission.
 */
export const test_subject_human_brow_flow_document = (): void => {
  const source = humanFaceFixture();
  source.controls = { noseWidth: 0.1 };
  const flow: IPortraitEyebrowFlowProfile = {
    sections: [0, 0.5, 1].map((at) => ({
      at,
      lower: { tip: 0.8 - at * 0.4, outwardBend: at * 4 },
      upper: { tip: 0.7 - at * 0.4, outwardBend: at * 3 },
    })),
  };
  const common = replaceHumanFaceRegion({
    document: source,
    basisId: source.basis.id,
    region: "eye",
    value: { browProfile: { flow, densitySeed: 0 } },
  });
  const loaded = parseHumanFaceDocument(serializeHumanFaceDocument(common));
  TestValidator.equals(
    "flow round trip",
    resolveHumanFaceDocument(loaded).recipe.eye.browProfile!.flow,
    flow,
  );
  const left = { sections: [flow.sections[0], flow.sections[2]] };
  TestValidator.equals(
    "density seed round trip",
    resolveHumanFaceDocument(loaded).recipe.eye.browProfile!.densitySeed,
    0,
  );
  const paired = replaceHumanFaceRegion({
    document: loaded,
    basisId: source.basis.id,
    region: "eye",
    side: "left",
    value: { browProfile: { flow: left, densitySeed: 7 } },
  });
  const resolved = resolveHumanFaceDocument(paired);
  TestValidator.equals(
    "independent left density seed",
    resolved.left.eye.browProfile!.densitySeed,
    7,
  );
  TestValidator.equals(
    "right density seed inherits",
    resolved.right.eye.browProfile!.densitySeed,
    0,
  );
  TestValidator.equals(
    "left whole-array replacement",
    resolved.left.eye.browProfile!.flow,
    left,
  );
  TestValidator.equals(
    "right untouched",
    resolved.right.eye.browProfile!.flow,
    flow,
  );
  TestValidator.equals(
    "unrelated trait retained",
    paired.controls,
    source.controls,
  );
  TestValidator.equals("caller unchanged", source.detail, undefined);
  const cleared = replaceHumanFaceRegion({
    document: paired,
    basisId: source.basis.id,
    region: "eye",
    side: "left",
    value: undefined,
  });
  TestValidator.equals(
    "clear inherits common",
    resolveHumanFaceDocument(cleared).left.eye.browProfile!.flow,
    flow,
  );
  const malformed = JSON.parse(serializeHumanFaceDocument(common));
  delete malformed.detail.eye.browProfile.flow.sections[0].upper;
  TestValidator.predicate(
    "incomplete flow rejected",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(malformed))),
  );
  const invalidSeed = JSON.parse(serializeHumanFaceDocument(common));
  invalidSeed.detail.eye.browProfile.densitySeed = "0";
  TestValidator.predicate(
    "nonnumeric saved density seed refuses",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(invalidSeed))),
  );
};
