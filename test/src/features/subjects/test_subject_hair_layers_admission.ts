import { buildPortraitHairGroom } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";
import { throwsError } from "../internal/predicates";

/**
 * Layer population and material ownership refuse before face assembly.
 * Scenarios:
 * 1. Eight empty profiles, missing unused finishes and an empty legacy profile admit.
 * 2. Nine layers, blank or duplicate identities refuse even without cards.
 * 3. Invalid empty profile settings still refuse; valid empty layers allocate nothing.
 * 4. Populated layers require resident bases and reject generated-id collisions.
 * 5. A prior layer's generated finish cannot become another layer's base by ordering.
 * 6. Legacy and additional populated profiles coexist without changing legacy ids.
 */
export const test_subject_hair_layers_admission = (): void => {
  const { shape, finish } = portraitHairShadeFixture();
  const empty = { ...shape, cards: [] };
  const layers = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    profile: empty,
  }));
  TestValidator.equals(
    "eight empty",
    buildPortraitHairGroom({ hair: empty, layers, materials: [] }),
    { parts: [], materials: [] },
  );
  for (const rejected of [
    [...layers, { id: "ninth", profile: empty }],
    [{ id: " ", profile: empty }],
    [
      { id: "a", profile: empty },
      { id: "a", profile: empty },
    ],
    [{ id: "a", profile: { ...empty, widthScale: 0 } }],
  ])
    TestValidator.predicate(
      "invalid population",
      throwsError(() =>
        buildPortraitHairGroom({ layers: rejected, materials: [] }),
      ),
    );
  const single = [{ id: "a", profile: shape }];
  TestValidator.predicate(
    "missing base",
    throwsError(
      () => buildPortraitHairGroom({ layers: single, materials: [] }),
      "resident finish",
    ),
  );
  TestValidator.predicate(
    "resident collision",
    throwsError(
      () =>
        buildPortraitHairGroom({
          layers: single,
          materials: [finish, { ...finish, id: "human-hair-layer:a" }],
        }),
      "collides",
    ),
  );
  const dependent = {
    id: "b",
    profile: { ...shape, material: "human-hair-layer:a" },
  };
  for (const ordered of [
    [...single, dependent],
    [dependent, ...single],
  ])
    TestValidator.predicate(
      "no generated base",
      throwsError(
        () => buildPortraitHairGroom({ layers: ordered, materials: [finish] }),
        "resident finish",
      ),
    );
  const both = buildPortraitHairGroom({
    hair: shape,
    layers: single,
    materials: [finish],
  });
  TestValidator.equals(
    "both populations",
    both.parts.map((p) => p.id),
    ["scalp-hair-cards", "scalp-hair-layer:a"],
  );
  const prefixedBase = { ...finish, id: "human-hair-layer:a" };
  const prefixedShape = { ...shape, material: prefixedBase.id };
  TestValidator.predicate(
    "legacy generated collision",
    throwsError(
      () =>
        buildPortraitHairGroom({
          hair: prefixedShape,
          layers: [{ id: "a:hair-cards", profile: prefixedShape }],
          materials: [prefixedBase],
        }),
      "collides",
    ),
  );
};
