import { validateAutoMovieNaturalnessStages } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Final-pass selection is explicit and cannot conceal a misspelled stage key.
 *
 * Scenarios:
 *
 * 1. Each lifecycle state is valid on the sole screenplay key.
 * 2. Omitted, primitive, null, and array declarations are refused.
 * 3. Missing, additional, or misspelled keys and unsupported states are refused.
 */
export const test_evidence_naturalness_stages = (): void => {
  for (const screenplays of ["disabled", "draft", "evidence", "review"])
    validateAutoMovieNaturalnessStages({ screenplays });
  for (const value of [
    undefined,
    null,
    false,
    0,
    "review",
    [],
    {},
    { screenplay: "review" },
    { screenplays: "review", scripts: "review" },
    { screenplays: undefined },
    { screenplays: "final" },
    { screenplays: 1 },
  ])
    TestValidator.error("invalid explicit naturalness map", () =>
      validateAutoMovieNaturalnessStages(value),
    );
};
