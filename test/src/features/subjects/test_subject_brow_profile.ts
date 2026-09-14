import {
  assertPortraitEyebrowProfile,
  portraitEyebrowProfile,
} from "@automovie/human/components/eyebrows";
import { createPortraitEyeComponent } from "@automovie/human/components/eyes";
import { buildPortraitHead } from "@automovie/human/components/head";
import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { throwsError } from "../internal/predicates";

/**
 * Brow dimensions are validated before allocation and remain owned by an eye
 * component after the caller changes its original profile.
 *
 * Scenarios:
 * 1. Zero and maximum counts, zero relief and segment limits are accepted;
 *    adjacent invalid counts, dimensions, taper and overflow refuse.
 * 2. Components built with disabled brows retain copied valid profiles after
 *    the caller corrupts its profile; the composed model still has no brow fibres.
 */
export const test_subject_brow_profile = (): void => {
  const profile = { ...portraitEyebrowProfile };
  for (const count of [0, 1, 4096])
    assertPortraitEyebrowProfile(profile, count);
  for (const segments of [1, 32])
    assertPortraitEyebrowProfile(
      { ...profile, segments, clearance: 0, arch: 0, radiusStep: 0, taper: 0 },
      1,
    );
  for (const count of [-1, 0.5, 4097, NaN])
    TestValidator.predicate(
      "invalid count refuses",
      throwsError(
        () => assertPortraitEyebrowProfile(profile, count),
        "dimensions",
      ),
    );
  for (const patch of [
    { radius: 0 },
    { radius: NaN },
    { radiusStep: -1 },
    { taper: -0.1 },
    { taper: 1 },
    { clearance: -1 },
    { arch: -1 },
    { outwardBend: Infinity },
    { segments: 0 },
    { segments: 33 },
    { segments: 1.5 },
    { radiusStep: Number.MAX_VALUE },
  ])
    TestValidator.predicate(
      "invalid profile refuses",
      throwsError(
        () => assertPortraitEyebrowProfile({ ...profile, ...patch }, 1),
        "dimensions",
      ),
    );
  const missing = { ...profile };
  Reflect.deleteProperty(missing, "radius");
  TestValidator.predicate(
    "missing dimension refuses",
    throwsError(() => assertPortraitEyebrowProfile(missing, 1), "dimensions"),
  );
  const eye = {
    ...portraitEyeShape,
    browProfile: {
      ...profile,
      rootBand: [0.1, 0.22] as [number, number],
      endFade: [0.1, 0.2] as [number, number],
      flow: {
        sections: [0, 1].map((at) => ({
          at,
          lower: { tip: 0.6, outwardBend: 1 },
          upper: { tip: 0.4, outwardBend: 1 },
        })),
      },
    },
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 4, eyeRows: 2, irisColumns: 8, irisRows: 2 },
  };
  const component = createPortraitEyeComponent(portraitEyeSockets[0], eye);
  eye.browProfile.radius = -1;
  eye.browProfile.rootBand[0] = -1;
  eye.browProfile.endFade[0] = -1;
  eye.browProfile.flow.sections[0].upper.tip = 2;
  const model = buildPortraitHead(referenceControlNet, [component], 0);
  TestValidator.predicate(
    "copied profile survives caller mutation",
    model.parts.length > 0 &&
      !model.parts.some((part) => part.id.includes("-brow-hair-")),
  );
};
