import { forgeCast } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Forge joins entries to the script cast by `node`. Duplicate script cast nodes
 * are ambiguous, especially when one duplicate imports a model and another asks
 * for a generated stand-in.
 *
 * Scenario: `knightA` appears twice in the script cast with conflicting
 * `modelRef` values; forging that node fails at the duplicate script source
 * path instead of silently using the later cast member.
 */
export const test_film_forge_cast_duplicate_script_nodes = (): void => {
  const forged = forgeCast(
    makeScriptWrite({
      cast: [
        {
          node: "knightA",
          character: "the imported challenger",
          modelRef: "stickman",
        },
        {
          node: "knightA",
          character: "the generated impostor",
          modelRef: null,
        },
      ],
    }),
    { type: "write", entries: [forgeEntry("knightA")] },
  );

  TestValidator.equals(
    "duplicate script cast nodes fail",
    forged.success,
    false,
  );
  TestValidator.predicate(
    "duplicate script cast node violation",
    forged.success === false &&
      hasViolation(forged, "type", "$script.cast[1].node"),
  );
};
