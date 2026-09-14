import { createPortraitMaterials } from "@automovie/human/components/materials";
import { TestValidator } from "@nestia/e2e";

import { buildReferencePortrait } from "../../subjects/generated-korean-girl-01/model";

/**
 * A subject palette must not mutate the shared construction basis or caller data.
 *
 * Scenarios:
 * 1. Omission retains the basis palette; explicit appearance supplies an owned
 *    complete replacement without changing any generated mesh.
 * 2. Mutating the caller's colour after assembly cannot change its returned model.
 */
export const test_subject_appearance = (): void => {
  const shape = { components: [], subdivisionRounds: 0 };
  const plain = buildReferencePortrait(shape);
  const materials = createPortraitMaterials();
  materials[0].baseColor!.r = 0.2;
  const changed = buildReferencePortrait({ ...shape, materials });
  TestValidator.equals(
    "appearance preserves geometry",
    changed.parts,
    plain.parts,
  );
  TestValidator.equals(
    "omission preserves basis palette",
    plain.materials,
    createPortraitMaterials(),
  );
  TestValidator.equals(
    "explicit palette is selected",
    changed.materials,
    materials,
  );
  materials[0].baseColor!.r = 0.9;
  TestValidator.equals(
    "caller colour remains owned",
    changed.materials[0].baseColor!.r,
    0.2,
  );
};
