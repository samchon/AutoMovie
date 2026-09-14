import {
  buildHumanFace,
  createPortraitMaterials,
  parseHumanFaceDocument,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Hair guides reach the real face builder and portable document parser.
 * Scenarios:
 * 1. A complete numeric hair profile survives save/load and emits one masked
 *    card material without replacing the shared base finish or caller data.
 * 2. A missing finish and a generated-finish collision refuse before head build.
 * 3. An authored mask cutoff reaches the card finish through JSON save/load.
 * 4. Generated fibre normals and their strength reach the actual owned finish.
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
    },
  };
  const before = serializeHumanFaceDocument(doc),
    model = buildHumanFace(parseHumanFaceDocument(before), 0);
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
  TestValidator.equals(
    "caller retained",
    serializeHumanFaceDocument(doc),
    before,
  );
  const missing = structuredClone(doc);
  missing.detail!.hair!.material = "absent";
  TestValidator.predicate(
    "missing finish",
    throwsError(() => buildHumanFace(missing, 0), "named resident"),
  );
  const collision = structuredClone(doc);
  collision.appearance = [...model.materials];
  TestValidator.predicate(
    "material identity collision",
    throwsError(() => buildHumanFace(collision, 0), "collides"),
  );
};
