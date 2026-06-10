import { buildFaceMorphs } from "@autofilm/forge";
import { AutoFilmFaceParameterName } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * The morph builder emits exactly the closed parameter menu — one delta array
 * per `AutoFilmFaceParameterName`, each aligned to the canonical vertex count —
 * so a face asset baked from it answers every legal parameter document and
 * nothing else.
 *
 * Scenario: default (canonical) build yields the 17 expected keys with
 * 468·3-long deltas.
 */
export const test_forge_face_morphs_complete = (): void => {
  const morphs = buildFaceMorphs();
  const expected: AutoFilmFaceParameterName[] = [
    "browHeight",
    "cheekFullness",
    "chinLength",
    "chinProtrusion",
    "eyeHeight",
    "eyeSize",
    "eyeSpacing",
    "eyeTilt",
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
    Object.keys(morphs).sort(),
    expected,
  );
  TestValidator.predicate(
    "every delta aligned to the topology",
    expected.every((name) => morphs[name].length === 468 * 3),
  );
};
