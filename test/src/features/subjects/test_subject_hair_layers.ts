import {
  buildPortraitHairCards,
  buildPortraitHairGroom,
  createPortraitHairMaterial,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";

/**
 * Independent populations retain exact guide geometry and owned finishes.
 * Scenarios:
 * 1. Omitted hair and layers emit no parts and preserve a copied base palette.
 * 2. A legacy profile retains its existing part and material identities.
 * 3. Two named layers sharing a base keep independent pigment masks and normals.
 * 4. Reordering changes population order, never either layer's resolved output.
 * 5. Caller and returned palette mutations cannot cross the ownership boundary.
 */
export const test_subject_hair_layers = (): void => {
  const { shape, finish } = portraitHairShadeFixture();
  const empty = buildPortraitHairGroom({ materials: [finish] });
  TestValidator.equals("empty parts", empty.parts, []);
  TestValidator.equals("base palette", empty.materials, [finish]);
  empty.materials[0].name = "changed";
  TestValidator.predicate("owned palette", finish.name !== "changed");
  const legacy = buildPortraitHairGroom({ hair: shape, materials: [finish] });
  const expected = buildPortraitHairCards(shape);
  expected[0].material = finish.id + ":hair-cards";
  TestValidator.equals("legacy geometry", legacy.parts, expected);
  TestValidator.equals("legacy finishes", legacy.materials, [
    finish,
    createPortraitHairMaterial(finish, shape),
  ]);
  const layers = [
    { id: "inner", profile: shape },
    {
      id: "outer",
      profile: { ...shape, fibreShadeStrength: 0, fibreNormalScale: 0.4 },
    },
  ];
  const before = structuredClone({ layers, finish });
  const result = buildPortraitHairGroom({ layers, materials: [finish] });
  TestValidator.equals(
    "named parts",
    result.parts.map((p) => [p.id, p.material]),
    [
      ["scalp-hair-layer:inner", "human-hair-layer:inner"],
      ["scalp-hair-layer:outer", "human-hair-layer:outer"],
    ],
  );
  TestValidator.equals(
    "same guide geometry",
    result.parts[0].geometry,
    result.parts[1].geometry,
  );
  TestValidator.predicate(
    "independent RGB",
    result.materials[1].baseColorTexture !==
      result.materials[2].baseColorTexture,
  );
  TestValidator.predicate(
    "independent normal",
    result.materials[1].normalTexture !== result.materials[2].normalTexture,
  );
  const reversed = buildPortraitHairGroom({
    layers: [...layers].reverse(),
    materials: [finish],
  });
  TestValidator.equals(
    "order independent parts",
    reversed.parts,
    [...result.parts].reverse(),
  );
  TestValidator.equals("order independent finishes", reversed.materials, [
    finish,
    ...result.materials.slice(1).reverse(),
  ]);
  TestValidator.equals("caller preserved", { layers, finish }, before);
};
