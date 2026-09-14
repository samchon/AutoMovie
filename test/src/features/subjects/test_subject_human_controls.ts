import {
  applyHumanFaceControls,
  humanFaceControlDefinitions,
} from "@automovie/human";
import { portraitNeckShape } from "@automovie/human/components/cranium";
import { resolvePortraitCraniumShape } from "@automovie/human/components/craniumShape";
import { portraitEarShape } from "@automovie/human/components/ears";
import { TestValidator } from "@nestia/e2e";

import { portraitCheekShape } from "../../subjects/generated-korean-girl-01/configuration";
import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Intermediate controls are signed trait offsets, not accumulated edit history.
 *
 * Scenarios:
 * 1. Omitted and explicit zero controls preserve the basis without aliasing it.
 * 2. Every trait reaches its named shape field with the specified ratio or mm rule.
 * 3. Optional cranial, pinna and cervical defaults resolve before those traits apply.
 * 4. Both range endpoints are admitted; out-of-range, unknown and nonfinite values refuse.
 * 5. A nonzero cheek control without a cheek profile refuses instead of becoming inactive.
 */
export const test_subject_human_controls = (): void => {
  const basis = humanFaceFixture().basis.recipe;
  basis.cheek = structuredClone(portraitCheekShape);
  const original = structuredClone(basis);
  const omitted = applyHumanFaceControls(basis, -80);
  TestValidator.equals("omission identity", omitted, basis);
  omitted.eye.widthScale = 99;
  TestValidator.equals("basis not aliased", basis, original);
  const changed = applyHumanFaceControls(basis, -80, {
    eyeWidth: 0.2,
    eyeHeight: -0.2,
    eyeTilt: 2,
    noseWidth: -0.1,
    noseProjection: 3,
    mouthWidth: 0.1,
    upperLipProjection: 1,
    lowerLipProjection: -1,
    cheekProjection: 2,
    craniumWidth: 0.1,
    craniumHeight: 5,
    earHeight: 0.1,
    neckWidth: 0.1,
  });
  TestValidator.predicate(
    "eye width ratio",
    nclose(changed.eye.widthScale, basis.eye.widthScale * 1.2),
  );
  TestValidator.predicate(
    "eye height ratio",
    nclose(changed.eye.openingScale, basis.eye.openingScale * 0.8),
  );
  TestValidator.equals(
    "canthus elevation",
    changed.eye.outerCornerLift,
    basis.eye.outerCornerLift + 2,
  );
  TestValidator.predicate(
    "nose width ratio",
    nclose(changed.nose.widthScale, basis.nose.widthScale * 0.9),
  );
  TestValidator.equals(
    "nasal projection",
    changed.nose.tipProjection,
    basis.nose.tipProjection + 3,
  );
  TestValidator.predicate(
    "mouth width ratio",
    nclose(changed.mouth.widthScale, basis.mouth.widthScale * 1.1),
  );
  TestValidator.equals(
    "upper lip projection",
    changed.mouth.upperLipProjection,
    basis.mouth.upperLipProjection + 1,
  );
  TestValidator.equals(
    "lower lip projection",
    changed.mouth.lowerLipProjection,
    basis.mouth.lowerLipProjection - 1,
  );
  TestValidator.equals(
    "malar and medial projection",
    [changed.cheek!.malar.projection, changed.cheek!.medial.projection],
    [basis.cheek.malar.projection + 2, basis.cheek.medial.projection + 2],
  );
  const cranium = resolvePortraitCraniumShape(-80, changed.cranium);
  TestValidator.predicate(
    "cranial width",
    nclose(cranium.stations[0].width, 75 * 1.1),
  );
  TestValidator.equals("crown elevation", cranium.stations[0].crown, 130);
  TestValidator.equals(
    "relative floor is not applied twice",
    cranium.stations[0].floor,
    -84.5,
  );
  TestValidator.predicate(
    "ear default reaches trait",
    nclose(changed.ear!.heightScale, portraitEarShape.heightScale * 1.1),
  );
  TestValidator.predicate(
    "neck default reaches trait",
    nclose(changed.neck!.upper.width, portraitNeckShape.upper.width * 1.1),
  );
  const explicit = applyHumanFaceControls(changed, -80, {
    earHeight: 0,
    neckWidth: 0,
    craniumHeight: 0,
    cheekProjection: 0,
    eyeWidth: undefined,
  });
  TestValidator.equals(
    "explicit profile defaults preserve shape",
    explicit,
    changed,
  );
  for (const definition of humanFaceControlDefinitions) {
    for (const value of [definition.minimum, definition.maximum])
      applyHumanFaceControls(basis, -80, { [definition.id]: value });
    for (const value of [
      definition.minimum - 1,
      definition.maximum + 1,
      NaN,
      Infinity,
    ])
      TestValidator.predicate(
        "invalid trait value",
        throwsError(() =>
          applyHumanFaceControls(basis, -80, { [definition.id]: value }),
        ),
      );
  }
  TestValidator.predicate(
    "unknown trait",
    throwsError(() =>
      applyHumanFaceControls(basis, -80, JSON.parse('{"unrecognised":1}')),
    ),
  );
  delete basis.cheek;
  applyHumanFaceControls(basis, -80, { cheekProjection: 0 });
  TestValidator.predicate(
    "inactive cheek control refuses",
    throwsError(() =>
      applyHumanFaceControls(basis, -80, { cheekProjection: 1 }),
    ),
  );
};
