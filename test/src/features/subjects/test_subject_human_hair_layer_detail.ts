import {
  parseHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceHairLayerDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";
import { throwsError } from "../internal/predicates";

/**
 * A named layer edit owns one scalar without flattening other authored profiles.
 * Scenarios:
 * 1. A basis population becomes a complete override; unrelated omissions, guides,
 *    base hair and basis stay exact even when the source profiles share an object.
 * 2. A subsequent edit uses the override population and can address a nested field.
 * 3. Inclusive scalar/count bounds pass; nonfinite, fractional counts, unknown
 *    channels, non-hair channels and missing or empty populations refuse.
 */
export const test_subject_human_hair_layer_detail = (): void => {
  const face = humanFaceFixture(),
    { shape } = portraitHairShadeFixture();
  shape.fibreCurl = { amplitude: 0.2, cycles: 2, aspectRatio: 1 };
  face.basis.recipe.hair = shape;
  face.basis.recipe.hairLayers = [
    { id: "inner", profile: shape },
    {
      id: "outer: <lock>",
      profile: shape,
    },
  ];
  const before = structuredClone(face);
  const edited = setHumanFaceHairLayerDetail(
    face,
    "outer: <lock>",
    "hair.fibreShadeStrength",
    0,
  );
  const expected = structuredClone(before);
  expected.detail = {
    hairLayers: before.basis.recipe.hairLayers!.map((layer) =>
      structuredClone(layer),
    ),
  };
  expected.detail.hairLayers![1].profile.fibreShadeStrength = 0;
  TestValidator.equals(
    "unselected aliased layer retains omission",
    edited.detail!.hairLayers![0].profile.fibreShadeStrength,
    undefined,
  );
  TestValidator.equals("only named scalar authored", edited, expected);
  TestValidator.equals("caller retained", face, before);
  const nested = setHumanFaceHairLayerDetail(
    edited,
    "outer: <lock>",
    "hair.fibreCurl.cycles",
    16,
  );
  expected.detail.hairLayers![1].profile.fibreCurl!.cycles = 16;
  TestValidator.equals("override and nested path", nested, expected);
  TestValidator.equals(
    "portable",
    parseHumanFaceDocument(serializeHumanFaceDocument(nested)),
    nested,
  );
  for (const value of [2, 64])
    TestValidator.equals(
      "inclusive count",
      setHumanFaceHairLayerDetail(face, "inner", "hair.segments", value).detail!
        .hairLayers![0].profile.segments,
      value,
    );
  for (const value of [-0.01, 1.01, NaN, Infinity])
    TestValidator.predicate(
      "invalid shade",
      throwsError(
        () =>
          setHumanFaceHairLayerDetail(
            face,
            "inner",
            "hair.fibreShadeStrength",
            value,
          ),
        "Invalid numerical detail",
      ),
    );
  TestValidator.predicate(
    "fractional count",
    throwsError(
      () => setHumanFaceHairLayerDetail(face, "inner", "hair.segments", 2.5),
      "Invalid numerical detail",
    ),
  );
  TestValidator.predicate(
    "wrong region",
    throwsError(
      () => setHumanFaceHairLayerDetail(face, "inner", "eye.foldDepth", 0),
      "only hair detail",
    ),
  );
  TestValidator.predicate(
    "unknown channel",
    throwsError(
      () => setHumanFaceHairLayerDetail(face, "inner", "hair.unknown", 0),
      "Unknown anatomical detail",
    ),
  );
  TestValidator.predicate(
    "missing id",
    throwsError(
      () => setHumanFaceHairLayerDetail(face, "missing", "hair.coverage", 1),
      "does not exist",
    ),
  );
  for (const document of [
    humanFaceFixture(),
    { ...face, detail: { hairLayers: [] } },
  ])
    TestValidator.predicate(
      "missing population",
      throwsError(
        () =>
          setHumanFaceHairLayerDetail(document, "inner", "hair.coverage", 1),
        "does not exist",
      ),
    );
};
