import { forgeCast } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the rig-contract side of the FORGE consumer: a boneless stand-in cannot
 * perform, and `validateModel`'s own findings surface remapped onto the entry's
 * path so the correction round can locate them in the forge's JSON.
 *
 * Scenarios:
 *
 * 1. KnightB's stand-in has `skeleton: null` → a `type` violation on
 *    `$input.entries[0].model.skeleton`.
 * 2. The same model references material "no-such-mat" on its part →
 *    `validateModel`'s violation resurfaces at
 *    `$input.entries[0].model.parts[0].material` (remapped from `$input`).
 */
export const test_film_forge_cast_boneless = (): void => {
  const entry = forgeEntry("knightB", { skeleton: null });
  entry.model.parts = [{ ...entry.model.parts[0]!, material: "no-such-mat" }];
  const forged = forgeCast(makeScriptWrite(), {
    type: "write",
    entries: [entry],
  });
  TestValidator.equals("fails", forged.success, false);
  TestValidator.predicate(
    "boneless performer rejected",
    forged.success === false &&
      hasViolation(forged, "type", "$input.entries[0].model.skeleton"),
  );
  TestValidator.predicate(
    "validateModel finding remapped onto the entry",
    forged.success === false &&
      hasViolation(forged, "type", "$input.entries[0].model.parts[0].material"),
  );
};
