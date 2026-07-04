import { forgeCast } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the completeness gate: a cast member without a `modelRef` is an actor
 * with no body until forged ??an empty forge is a violation naming exactly that
 * member, not a silent no-op.
 *
 * Scenarios:
 *
 * 1. The duel cast (knightB has no modelRef) with zero forge entries ??a `type`
 *    violation on `$input.entries` carrying "knightB". knightA (imported
 *    "stickman") is NOT demanded ??only the stand-in member is.
 */
export const test_film_forge_cast_missing = (): void => {
  const forged = forgeCast(makeScriptWrite(), { type: "write", entries: [] });
  TestValidator.equals("fails", forged.success, false);
  TestValidator.predicate(
    "names the unforged stand-in member only",
    forged.success === false &&
      hasViolation(forged, "type", "$input.entries") &&
      forged.violations.some((v) => v.value === "knightB") &&
      forged.violations.every((v) => v.value !== "knightA"),
  );
};
