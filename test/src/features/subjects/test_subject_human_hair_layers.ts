import {
  humanFaceRegionValue,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";
import { throwsError } from "../internal/predicates";

/**
 * Named hair populations are whole-array overrides in portable documents.
 * Scenarios:
 * 1. Omission remains absent; a basis layer sharing the legacy profile object
 *    resolves the same display defaults as its independently serialized twin.
 * 2. Replacement and an empty override replace all additional layers, never base hair.
 * 3. Inheritance restores the basis and snapshots cannot mutate it.
 * 4. Side replacement and unknown nested profile fields refuse.
 */
export const test_subject_human_hair_layers = (): void => {
  const face = humanFaceFixture();
  TestValidator.equals(
    "absent",
    humanFaceRegionValue(face, "hairLayers"),
    undefined,
  );
  const { shape } = portraitHairShadeFixture();
  face.basis.recipe.hair = shape;
  face.basis.recipe.hairLayers = [{ id: "inner", profile: shape }];
  const before = structuredClone(face);
  TestValidator.equals(
    "shared object and JSON have the same interpretation",
    humanFaceRegionValue(face, "hairLayers"),
    humanFaceRegionValue(
      parseHumanFaceDocument(serializeHumanFaceDocument(face)),
      "hairLayers",
    ),
  );
  TestValidator.equals(
    "portable",
    parseHumanFaceDocument(serializeHumanFaceDocument(face)),
    face,
  );
  const props = {
    document: face,
    basisId: face.basis.id,
    region: "hairLayers" as const,
  };
  const changed = replaceHumanFaceRegion({
    ...props,
    value: [{ id: "outer", profile: { ...shape, coverage: 0.2 } }],
  });
  TestValidator.equals(
    "array replaced",
    humanFaceRegionValue(changed, "hairLayers")!.map((p) => p.id),
    ["outer"],
  );
  const removed = replaceHumanFaceRegion({ ...props, value: [] });
  TestValidator.equals(
    "empty removes layers",
    humanFaceRegionValue(removed, "hairLayers"),
    [],
  );
  TestValidator.equals(
    "base hair retained",
    humanFaceRegionValue(removed, "hair"),
    humanFaceRegionValue(face, "hair"),
  );
  const inherited = replaceHumanFaceRegion({
    ...props,
    document: removed,
    value: undefined,
  });
  TestValidator.equals(
    "inherit",
    humanFaceRegionValue(inherited, "hairLayers"),
    [
      {
        id: "inner",
        profile: {
          ...shape,
          fibreNormalScale: 0,
          taperStart: 0,
          fibreShadeStrength: 1,
        },
      },
    ],
  );
  const explicit = replaceHumanFaceRegion({
    ...props,
    value: [
      {
        id: "explicit",
        profile: {
          ...shape,
          fibreNormalScale: 0.4,
          taperStart: 0.7,
          fibreShadeStrength: 0,
        },
      },
    ],
  });
  TestValidator.equals(
    "explicit defaults retained",
    humanFaceRegionValue(explicit, "hairLayers"),
    explicit.detail!.hairLayers,
  );
  humanFaceRegionValue(face, "hairLayers")![0].id = "mutated";
  TestValidator.equals("caller preserved", face, before);
  TestValidator.predicate(
    "unpaired population",
    throwsError(
      () => replaceHumanFaceRegion({ ...props, side: "left", value: [] }),
      "independent side-profile",
    ),
  );
  TestValidator.predicate(
    "unknown shape field",
    throwsError(() =>
      parseHumanFaceDocument(
        JSON.stringify({
          ...face,
          detail: {
            hairLayers: [{ id: "a", profile: { ...shape, invented: 1 } }],
          },
        }),
      ),
    ),
  );
};
