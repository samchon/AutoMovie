import { buildHumanFace, createPortraitMaterials } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Hair guides and independent pigment controls reach the real face builder.
 * Scenarios:
 * 1. A complete numeric hair profile emits one masked
 *    card material without replacing the shared base finish or caller data.
 * 2. Authored cutoff, generated normals and their strength reach the finish.
 * 3. Zero shade strength emits white RGB with occupied alpha, rather than a
 *    slider value that is lost before material construction.
 */
export const test_subject_human_hair_model = (): void => {
  const doc = coarseHumanFaceFixture("hair-consumer");
  doc.appearance = createPortraitMaterials().map((finish) =>
    finish.id === "hair"
      ? { ...finish, alphaMode: "mask", alphaCutoff: 0.25 }
      : finish,
  );
  doc.detail = {
    hair: {
      material: "hair",
      cards: [
        {
          guide: [
            [0, 120, 0],
            [0, 110, -10],
          ],
          across: [
            [1, 0, 0],
            [1, 0, 0],
          ],
          width: 2,
        },
      ],
      segments: 2,
      widthScale: 1,
      tipWidth: 0.5,
      seed: 0,
      fibres: 2,
      coverage: 0.7,
      fibreNormalScale: 0.4,
      fibreShadeStrength: 0,
    },
  };
  const before = structuredClone(doc),
    model = buildHumanFace(doc, 0);
  TestValidator.predicate(
    "real consumer emits mask",
    model.parts.some(
      (p) => p.id === "scalp-hair-cards" && p.material === "hair:hair-cards",
    ) &&
      model.materials.some(
        (m) =>
          m.id === "hair:hair-cards" &&
          m.alphaMode === "mask" &&
          typeof m.baseColorTexture === "string",
      ),
  );
  TestValidator.predicate(
    "base finish retained",
    model.materials.find((m) => m.id === "hair")!.baseColorTexture === null,
  );
  TestValidator.equals(
    "authored card cutoff",
    model.materials.find((m) => m.id === "hair:hair-cards")!.alphaCutoff,
    0.25,
  );
  const cardFinish = model.materials.find((m) => m.id === "hair:hair-cards")!;
  TestValidator.equals("authored normal strength", cardFinish.normalScale, 0.4);
  TestValidator.predicate(
    "real consumer emits normal image",
    typeof cardFinish.normalTexture === "string" &&
      cardFinish.normalTexture.startsWith("data:image/png;base64,"),
  );
  const texture = PNG.sync.read(
    Buffer.from((cardFinish.baseColorTexture as string).slice(22), "base64"),
  );
  TestValidator.predicate(
    "shade reaches actual RGB",
    texture.data.every((value, index) => index % 4 === 3 || value === 255),
  );
  TestValidator.predicate(
    "mask remains occupied",
    texture.data.some((value, index) => index % 4 === 3 && value > 0),
  );
  TestValidator.equals("caller retained", doc, before);
};
