import { AutoMovieApplication, AutoMovieGuideName } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const app = new AutoMovieApplication();

/** Every corpus key, with a distinctive phrase its content must carry. */
const CORPUS: ReadonlyArray<readonly [AutoMovieGuideName, string]> = [
  ["AUTOMOVIE_OVERALL", "engine enforces, model creates"],
  ["AUTOMOVIE_OVERALL", "surgical, not a reset"],
  ["AUTOMOVIE_OVERALL", "an accepted spec also writes through as"],
  ["STAGING", "coherence, not craft"],
  ["BLOCKING", "causal order"],
  ["PERFORMANCE", "One take, one live camera"],
  ["PERFORMANCE", "Motions Are Derived, Not Stored"],
  ["REVIEW", "advice, not gates"],
  ["REVIEW", "ancestors nearest-first"],
  ["REVIEW", "plausibility versus possibility"],
  ["AUTOMOVIE_OVERALL", "an *implausible* one is a suppressible warning"],
  ["PROPS", "crude proxy, rich meaning"],
  ["PROJECT_MEMORY", "cleared slice's file is removed"],
  ["PROJECT_MEMORY", "sibling beats' files stay byte-identical"],
  ["PROJECT_MEMORY", "byte-writing stays the host adapter's job"],
  ["PROJECT_MEMORY", "forge a prop once"],
  ["PROJECT_MEMORY", "Compiled motions are not a slice"],
  ["RENDER_GUIDES", "no-capture-adapter"],
  ["RENDER_GUIDES", "omit `slate`"],
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
};
