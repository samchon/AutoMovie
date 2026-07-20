import { forgeCast } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the casting-contract gates of the FORGE consumer, all raised from one
 * incoherent write: entries must name stand-in cast members exactly once, with
 * the model id/origin carrying the join contract.
 *
 * Scenarios (entry per index):
 *
 * 1. `ghost`: not in the cast → `type` on `$input.entries[0].node`.
 * 2. `knightA`: has modelRef "stickman" (imported) → `type` on
 *    `$input.entries[1].node`.
 * 3. `knightB` with model id "wrong-id" → `type` on `$input.entries[2].model.id`.
 * 4. `knightB` again (duplicate) with `origin: "imported"` → `type` on
 *    `$input.entries[3].node` (re-forged) and on
 *    `$input.entries[3].model.origin`.
 */
export const test_film_forge_cast_bad_refs = (): void => {
  const forged = forgeCast(makeScriptWrite(), {
    type: "write",
    entries: [
      forgeEntry("ghost"),
      forgeEntry("knightA"),
      forgeEntry("knightB", { id: "wrong-id" }),
      forgeEntry("knightB", { origin: "imported" }),
    ],
  });
  TestValidator.equals("fails", forged.success, false);
  if (forged.success !== false) return;
  TestValidator.predicate(
    "stranger rejected",
    hasViolation(forged, "type", "$input.entries[0].node"),
  );
  TestValidator.predicate(
    "imported member must not be forged",
    hasViolation(forged, "type", "$input.entries[1].node"),
  );
  TestValidator.predicate(
    "join id mismatch rejected",
    hasViolation(forged, "type", "$input.entries[2].model.id"),
  );
  TestValidator.predicate(
    "duplicate forge rejected",
    hasViolation(forged, "type", "$input.entries[3].node"),
  );
  TestValidator.predicate(
    "non-generated origin rejected",
    hasViolation(forged, "type", "$input.entries[3].model.origin"),
  );
};
