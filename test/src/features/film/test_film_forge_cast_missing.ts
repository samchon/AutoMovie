import { forgeCast } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

/**
 * Pins the completeness gate: a cast member without a `modelRef` is an actor
 * with no body until forged: an empty forge is a violation naming exactly that
 * member, not a silent no-op.
 *
 * Scenarios:
 *
 * 1. The duel cast (knightB has no modelRef) with zero forge entries → a `type`
 *    violation on `$input.entries` carrying "knightB". knightA (imported
 *    "stickman") is NOT demanded: only the stand-in member is.
 */
export const test_film_forge_cast_missing = (): void => {
  const forged = forgeCast(makeScriptWrite(), { entries: [] });
  TestValidator.equals("fails", forged.success, false);
  TestValidator.equals(
    "names the unforged stand-in member only",
    namedFacts([
      ["forgedSuccess", () => forged.success === false],
      [
        "hasViolationForged",
        () => hasViolation(forged, "type", "$input.entries"),
      ],
      [
        "forgedViolations",
        () => forged.violations.some((v) => v.value === "knightB"),
      ],
      [
        "forgedViolations2",
        () => forged.violations.every((v) => v.value !== "knightA"),
      ],
    ]),
    {
      forgedSuccess: true,
      hasViolationForged: true,
      forgedViolations: true,
      forgedViolations2: true,
    },
  );
};
