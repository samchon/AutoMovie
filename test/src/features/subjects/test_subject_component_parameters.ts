import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { createPortraitEyeComponent } from "../../subjects/generated-korean-girl-01/eyes";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { throwsError } from "../internal/predicates";

/**
 * Invalid numerical parts are refused before a renderer sees collapsed apertures
 * or nonfinite geometry. Zero-valued relief remains a valid flat-lid variant.
 *
 * Scenarios:
 * 1. Zero fold/lift/blend and a very small positive pupil
 *    construct valid components; invalid dimensions and sampling do not.
 * 2. Nasal widths and contraction are positive, contraction stays below one,
 *    and signed projection/rise remain allowed when finite.
 * 3. Editing caller-owned dimensions after construction does not change an
 *    existing component's fitted seam, including nested socket dimensions.
 */
export const test_subject_component_parameters = (): void => {
  createPortraitEyeComponent(portraitEyeSockets[0], {
    ...portraitEyeShape,
    foldWidth: 0,
    foldDepth: 0,
    lidThickness: 0,
    blendReach: 0,
    pupilRadius: 0.001,
  });
  for (const override of [
    { widthScale: 0 },
    { widthScale: NaN },
    { openingScale: -1 },
    { foldWidth: -1 },
    { foldDepth: Infinity },
    { surfaceRadius: 0 },
    { browFibres: 0 },
    { upperLashes: 0.5 },
    { socketLift: Infinity },
    { outerCornerLift: NaN },
    { pupilRadius: portraitEyeShape.irisRadius },
    { sampling: { ...portraitEyeShape.sampling, eyeColumns: 1 } },
    { sampling: { ...portraitEyeShape.sampling, irisColumns: 2 } },
  ])
    TestValidator.predicate(
      "invalid eye rejected",
      throwsError(() =>
        createPortraitEyeComponent(portraitEyeSockets[0], {
          ...portraitEyeShape,
          ...override,
        }),
      ),
    );
  createPortraitNoseComponent(portraitNoseSocket, {
    ...portraitNoseShape,
    blendReach: 0,
    tipProjection: 0,
    alarProjection: 0,
    nostrilRise: -1,
  });
  for (const override of [
    { widthScale: 0 },
    { widthScale: NaN },
    { nostrilHeightScale: -1 },
    { cavityContraction: 1 },
    { blendReach: -1 },
    { blendReach: NaN },
    { tipProjection: Infinity },
    { nostrilTilt: NaN },
    { cavityOffset: [0, 0] },
    { cavityOffset: [0, NaN, 0] },
  ])
    TestValidator.predicate(
      "invalid nose rejected",
      throwsError(() =>
        createPortraitNoseComponent(portraitNoseSocket, {
          ...portraitNoseShape,
          ...override,
        }),
      ),
    );
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const eyeInput = { ...portraitEyeShape };
  const eye = createPortraitEyeComponent(portraitEyeSockets[0], eyeInput);
  const eyeBefore = eye.fit(host).constraints;
  eyeInput.widthScale = 2;
  TestValidator.equals(
    "eye owns its numerical shape",
    eye.fit(host).constraints,
    eyeBefore,
  );
  const gazeHost = {
    ...host,
    positions: host.positions.map((point) => [...point]),
  };
  const marker = portraitEyeSockets[0].iris;
  gazeHost.positions[marker][0] += 3;
  gazeHost.positions[marker][1] += 1;
  TestValidator.equals(
    "gaze does not reshape the eyelid seam",
    eye
      .fit(gazeHost)
      .constraints.filter((constraint) => constraint.vertex !== marker),
    eyeBefore.filter((constraint) => constraint.vertex !== marker),
  );
  const noseSocket = {
    ...portraitNoseSocket,
    tipRadius: [8, 9] as [number, number],
  };
  const noseInput = { ...portraitNoseShape };
  const nose = createPortraitNoseComponent(noseSocket, noseInput);
  const noseBefore = nose.fit(host).constraints;
  noseSocket.tipRadius[0] = 1;
  noseInput.widthScale = 2;
  TestValidator.equals(
    "nose owns its shape and socket dimensions",
    nose.fit(host).constraints,
    noseBefore,
  );
};
