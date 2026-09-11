import { TestValidator } from "@nestia/e2e";

import {
  portraitMouthShape,
  portraitMouthSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { createPortraitMouthComponent } from "../../subjects/generated-korean-girl-01/mouth";
import { nclose } from "../internal/predicates";

/**
 * Mouth projection follows anatomical band identity at raised smile corners.
 * Section relief keeps existing aperture and cutaneous boundary positions exact.
 * Scenarios:
 * 1. Every interior lower-rim point receives negative lower projection and every
 *    upper-rim point positive upper projection, including raised lateral points.
 * 2. A section changes internal band depth while preserving both boundary loops,
 *    XY, cut identities and copied profile settings; neutral is exact identity.
 */
export const test_subject_lip_projection = (): void => {
  const plain = {
    ...portraitMouthShape,
    section: undefined,
    upperLipProjection: 0,
    lowerLipProjection: 0,
  };
  const plan = createPortraitMouthComponent(portraitMouthSocket, {
    ...plain,
    upperLipProjection: 1,
    lowerLipProjection: -1,
  }).fit(referenceControlNet);
  const pins = new Map(plan.constraints.map((p) => [p.vertex, p.target]));
  for (const [ids, sign] of [
    [portraitMouthSocket.upper, 1],
    [portraitMouthSocket.lower, -1],
  ] as const)
    TestValidator.predicate(
      "projection follows anatomical band",
      ids
        .slice(1, -1)
        .every(
          (id) =>
            (pins.get(id)![2] - referenceControlNet.positions[id][2]) * sign >
            0,
        ),
    );
  const profile = { ...portraitMouthShape.section! };
  const component = createPortraitMouthComponent(portraitMouthSocket, {
    ...plain,
    section: profile,
  });
  const before = component.fit(referenceControlNet);
  const neutral = createPortraitMouthComponent(portraitMouthSocket, plain).fit(
    referenceControlNet,
  );
  const base = new Map(neutral.constraints.map((p) => [p.vertex, p.target]));
  const borders = new Set([
    ...portraitMouthSocket.outer,
    ...portraitMouthSocket.upper,
    ...portraitMouthSocket.lower,
  ]);
  let changed = false;
  for (const pin of before.constraints) {
    const original = base.get(pin.vertex)!;
    TestValidator.equals(
      "section retains planar position",
      pin.target.slice(0, 2),
      original.slice(0, 2),
    );
    if (borders.has(pin.vertex))
      TestValidator.equals(
        "section retains boundary exactly",
        pin.target,
        original,
      );
    else changed ||= !nclose(pin.target[2], original[2]);
  }
  TestValidator.equals("interior section changes", changed, true);
  TestValidator.equals(
    "section keeps cut identities",
    before.cutFaces,
    neutral.cutFaces,
  );
  profile.upperBody = 99;
  TestValidator.equals(
    "mouth owns its section",
    component.fit(referenceControlNet).constraints,
    before.constraints,
  );
  const zero = createPortraitMouthComponent(portraitMouthSocket, {
    ...plain,
    section: {
      ...profile,
      upperBody: 0,
      upperTubercle: 0,
      lowerBody: 0,
      lowerPads: 0,
    },
  }).fit(referenceControlNet);
  TestValidator.equals(
    "neutral section identity",
    zero.constraints,
    neutral.constraints,
  );
};
