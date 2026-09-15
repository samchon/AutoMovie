import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";

/**
 * Additional hair layers reach the full anatomical model without legacy hair.
 * Scenarios:
 * 1. A named additional profile emits its own part and resident mask without legacy hair.
 * 2. Its authored pigment control persists without changing the caller's document.
 */
export const test_subject_human_hair_layers_model = (): void => {
  const face = coarseHumanFaceFixture("layer-consumer"),
    { shape } = portraitHairShadeFixture();
  face.detail = {
    hairLayers: [
      {
        id: "outer",
        profile: { ...shape, material: "hair", fibreShadeStrength: 0 },
      },
    ],
  };
  const before = structuredClone(face),
    model = buildHumanFace(face, 0);
  TestValidator.predicate(
    "connected outer layer",
    model.parts.some(
      (p) =>
        p.id === "scalp-hair-layer:outer" &&
        p.material === "human-hair-layer:outer",
    ),
  );
  TestValidator.predicate(
    "owned resident texture",
    typeof model.materials.find((m) => m.id === "human-hair-layer:outer")!
      .baseColorTexture === "string",
  );
  TestValidator.equals("caller retained", face, before);
  const texture = model.materials.find(
    (m) => m.id === "human-hair-layer:outer",
  )!.baseColorTexture as string;
  const pixels = PNG.sync.read(Buffer.from(texture.slice(22), "base64")).data;
  TestValidator.predicate(
    "unit pigment reaches full model",
    pixels.every((value, index) => index % 4 === 3 || value === 255),
  );
};
