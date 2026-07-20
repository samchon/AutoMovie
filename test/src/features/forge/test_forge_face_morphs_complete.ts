import { buildFaceMorphs } from "@automovie/forge";
import { AutoMovieFaceParameterName } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * The morph builder emits exactly the closed parameter menu (one delta array
 * per `AutoMovieFaceParameterName`, each aligned to the canonical vertex count),
 * so a face asset baked from it answers every legal parameter document and
 * nothing else. Paired features (eyes, brows, cheeks) appear once per side.
 *
 * Scenario: default (canonical) build yields the 25 expected keys with
 * 468·3-long deltas.
 */
export const test_forge_face_morphs_complete = (): void => {
  const morphs = buildFaceMorphs();
  const expected: AutoMovieFaceParameterName[] = [
    "browHeightL",
    "browHeightR",
    "cheekFullnessL",
    "cheekFullnessR",
    "chinLength",
    "chinProtrusion",
    "eyeHeightL",
    "eyeHeightR",
    "eyeSizeL",
    "eyeSizeR",
    "eyeSpacingL",
    "eyeSpacingR",
    "eyeTiltL",
    "eyeTiltR",
    "eyeWidthL",
    "eyeWidthR",
    "faceLength",
    "faceWidth",
    "jawWidth",
    "lipFullness",
    "mouthHeight",
    "mouthWidth",
    "noseLength",
    "noseProjection",
    "noseWidth",
  ];
  TestValidator.equals(
    "exactly the closed menu",
    Object.keys(morphs).sort((a, b) => a.localeCompare(b)),
    expected,
  );
  TestValidator.predicate(
    "every delta aligned to the topology",
    expected.every((name) => morphs[name].length === 468 * 3),
  );
};
