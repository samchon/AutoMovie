import { buildFaceMorphs } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * `noseProjection` pushes pure +z from the nose tip: at the tip the delta is
 * exactly the recipe's 0.9 cm (the gaussian is 1 at its own center), x/y never
 * move, and the falloff dies before the chin ??the sign every profile edit
 * relies on (positive weight = more projection).
 *
 * Scenario: tip dz = 0.009 exactly, all dx/dy zero, chin dz ??0.
 */
export const test_forge_face_morphs_nose_projection = (): void => {
  const delta = buildFaceMorphs().noseProjection;
  TestValidator.predicate("tip dz is 0.9cm", nclose(delta[1 * 3 + 2]!, 0.009));
  TestValidator.predicate(
    "z-only motion",
    Array.from({ length: 468 }, (_, i) => i).every(
      (i) => delta[i * 3] === 0 && delta[i * 3 + 1] === 0,
    ),
  );
  TestValidator.predicate(
    "chin out of reach",
    Math.abs(delta[152 * 3 + 2]!) < 1e-6,
  );
};
