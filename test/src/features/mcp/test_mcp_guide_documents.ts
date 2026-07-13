import { AutoMovieApplication, AutoMovieGuideName } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();

/** Every corpus key, with a distinctive phrase its content must carry. */
const CORPUS: ReadonlyArray<readonly [AutoMovieGuideName, string]> = [
  ["AUTOMOVIE_OVERALL", "engine enforces, model creates"],
  ["AUTOMOVIE_OVERALL", "surgical, not a reset"],
  ["AUTOMOVIE_OVERALL", "an accepted spec also writes through as"],
  ["AUTOMOVIE_OVERALL", "tool-specific result field"],
  ["AUTOMOVIE_OVERALL", "Render and resident mutation tools carry"],
  ["STAGING", "coherence, not craft"],
  ["BLOCKING", "causal order"],
  ["PERFORMANCE", "One take, one live camera"],
  ["PERFORMANCE", "Motions Are Derived, Not Stored"],
  ["REVIEW", "advice, not gates"],
  ["REVIEW", "ancestors nearest-first"],
  ["REVIEW", "plausibility versus possibility"],
  ["AUTOMOVIE_OVERALL", "an *implausible* one is a suppressible warning"],
  ["AUTOMOVIE_OVERALL", "semantic Euler degrees"],
  ["PROPS", "crude proxy, rich meaning"],
  ["PERFORMANCE", "the whole staged scene stops travelling per beat"],
  ["BLOCKING", "stops re-sending the staged scene every beat"],
  ["BLOCKING", "pass it as `block`'s `previous`"],
  ["FORGE", "an actor with no body"],
  ["FORGE", "silhouette reads as this character"],
  ["FORGE", "a boneless model is a prop, not a castable actor"],
  ["FORGE", "not** written through to the resident project"],
  ["PROPS", "that re-forge is refused"],
  ["PROJECT_MEMORY", "cleared slice's file is removed"],
  ["PROJECT_MEMORY", "still places is refused"],
  ["PROJECT_MEMORY", "sibling beats' files stay byte-identical"],
  ["PROJECT_MEMORY", "byte-writing stays the host adapter's job"],
  ["PROJECT_MEMORY", "lowers the angles to a quaternion"],
  ["PROJECT_MEMORY", "forge a prop once"],
  ["PROJECT_MEMORY", "Compiled motions are not a slice"],
  ["RENDER_GUIDES", "no-capture-adapter"],
  ["RENDER_GUIDES", "omit `slate`"],
  ["RENDER_GUIDES", "planChunkedRender"],
  ["RENDER_GUIDES", "planCaptions"],
];

/**
 * The guide corpus carries the film-authoring doctrine outside the MCP JSDoc
 * caps: getGuideDocument serves each prompts/*.md stem by exact name, generated
 * into the constant at build time. Guides teach the method; tool returns decide
 * correctness.
 *
 * Scenarios:
 *
 * 1. Every declared guide name resolves to non-empty markdown carrying its
 *    distinctive doctrine phrase — the union, the prompts directory, and the
 *    generated constant cannot drift apart silently.
 * 2. An unknown name (reachable through direct API misuse) throws an error that
 *    lists every valid name, instead of returning undefined content.
 * 3. Malformed name fields reject before guide lookup so bad input is not confused
 *    with an unknown guide key.
 * 4. A malformed request root rejects before the guide lookup dereferences request
 *    fields.
 */
export const test_mcp_guide_documents = (): void => {
  for (const [name, phrase] of CORPUS) {
    const output = app.getGuideDocument({ name });
    TestValidator.predicate(
      `${name} resolves with substance ("${phrase}")`,
      output.content.length > 200 && output.content.includes(phrase),
    );
  }

  TestValidator.predicate(
    "unknown name throws listing valid names",
    throwsError(
      () =>
        app.getGuideDocument({
          name: "NOT_A_GUIDE" as AutoMovieGuideName,
        }),
      ["unknown guide document", "AUTOMOVIE_OVERALL", "RENDER_GUIDES"],
    ),
  );

  TestValidator.predicate(
    "malformed name field rejects",
    throwsError(
      () =>
        app.getGuideDocument({
          name: null as unknown as AutoMovieGuideName,
        }),
      ["$input.name", "non-empty string"],
    ) &&
      throwsError(
        () =>
          app.getGuideDocument({
            name: "" as AutoMovieGuideName,
          }),
        ["$input.name", "non-empty string"],
      ),
  );

  TestValidator.predicate(
    "malformed request root rejects",
    throwsError(
      () => app.getGuideDocument(null as never),
      ["$input", "JSON object"],
    ),
  );
};
