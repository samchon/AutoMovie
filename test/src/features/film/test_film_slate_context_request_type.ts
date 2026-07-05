import { readSlateContext } from "@automovie/engine";
import { IAutoMovieSlate } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const slate: IAutoMovieSlate = {
  brief: "empty slate",
  script: null,
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
};

/**
 * Stored-context reads are a runtime engine boundary. A caller that forges an
 * unsupported context request must fail explicitly instead of receiving an
 * undefined value outside the stored-context result contract.
 *
 * Scenario: an unknown request type throws before any slate lookup is
 * attempted.
 */
export const test_film_slate_context_request_type = (): void => {
  TestValidator.predicate(
    "unknown slate context request rejects",
    throwsError(
      () => readSlateContext(slate, { type: "getWeather" } as never),
      ["unknown slate context request", "getWeather"],
    ),
  );
};
