import {
  AUTOMOVIE_SANDBOX_CAPABILITY_INDEX,
  AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/**
 * The reachable surface is addressable by the question an author is asking.
 *
 * Publishing a name is necessary and not sufficient: `builtEnvironmentSpaceNodes`
 * was on the surface, documented, and read by an observer in the first hour of a
 * campaign, and still went uncalled at the moment it was needed. A sorted list of
 * identifiers is addressed by a name the author already holds, so the index is
 * keyed by the question instead. This pins that the index is a partition of the
 * surface rather than a curated subset of it — the property that makes a family's
 * size derived, which is what `WORLD_BUILDING` got wrong when it called the
 * built-environment queries "the six" while eight were reachable.
 *
 * Scenarios:
 *
 * 1. The index has every published question in the published reading order, so
 *    a question cannot disappear or move through object-key iteration.
 * 2. No entry is empty, so a question that lost its last name goes red instead of
 *    staying in the corpus as a promise the surface no longer keeps.
 * 3. The entries concatenated and sorted are exactly the surface: no name is
 *    unreachable through a question, and none is reachable through two.
 * 4. Each entry holds its names in surface order, because the surface order is a
 *    published fact a guide reads back.
 * 5. The index survives one JSON round trip byte for byte. A `Map` that becomes
 *    `{}` is not a discoverable index across the same boundary the surface uses.
 * 6. The built-environment family holds all nine queries, including the compact
 *    population lookup. That number is asserted from the family's meaning rather
 *    than from whatever the index currently emits.
 */
export const test_mcp_sandbox_capability_question_index = (): void => {
  const index = AUTOMOVIE_SANDBOX_CAPABILITY_INDEX;
  const expectedQuestions: typeof AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS = [
    "How do I write a subject and a shot at all?",
    "How do I turn a profile or a region into geometry?",
    "How do I assemble the parts I built into one thing?",
    "Is the mesh I built well formed?",
    "How do I cover a surface with an element instead of a repeating texture?",
    "What is this built out of, and does that build-up hold?",
    "What does the building I declared actually contain?",
    "Does this building placement rest, float, sink, or overlap?",
    "How do I turn a declared building into the geometry a frame shows?",
    "How do I name a part of something I placed?",
    "How do I derive a placed object's world frame from its relation?",
    "How high is the ground under this point?",
  ];

  TestValidator.equals(
    "the question and index orders are the semantic reading order",
    {
      published: [...AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS],
      indexed: index.map(({ question }) => question),
    },
    { published: [...expectedQuestions], indexed: [...expectedQuestions] },
  );

  TestValidator.equals(
    "no question is published with an empty family",
    index
      .filter(({ names }) => names.length === 0)
      .map(({ question }) => question),
    [],
  );

  TestValidator.equals(
    "the questions partition the reachable surface",
    index.flatMap(({ names }) => [...names]).sort(compareCodeUnits),
    [...AUTOMOVIE_SANDBOX_ENGINE_SURFACE].sort(compareCodeUnits),
  );

  TestValidator.equals(
    "each family keeps the surface's published order",
    namedFacts([
      [
        "families are in surface order",
        () =>
          index.every(({ names }) =>
            names.every(
              (name, index) =>
                index === 0 ||
                AUTOMOVIE_SANDBOX_ENGINE_SURFACE.indexOf(names[index - 1]!) <
                  AUTOMOVIE_SANDBOX_ENGINE_SURFACE.indexOf(name),
            ),
          ),
      ],
    ]),
    { "families are in surface order": true },
  );

  TestValidator.equals(
    "the question index is JSON-safe",
    JSON.parse(JSON.stringify(AUTOMOVIE_SANDBOX_CAPABILITY_INDEX)),
    AUTOMOVIE_SANDBOX_CAPABILITY_INDEX,
  );

  TestValidator.equals(
    "the built-environment family is the nine reachable queries",
    index.find(
      ({ question }) =>
        question === "What does the building I declared actually contain?",
    )?.names,
    [
      "builtEnvironmentAdjacentSpaces",
      "builtEnvironmentBuildingOfSpace",
      "builtEnvironmentContainsPoint",
      "builtEnvironmentSpaceConnectors",
      "builtEnvironmentSpaceContentBounds",
      "builtEnvironmentSpaceFidelity",
      "builtEnvironmentSpaceNodes",
      "builtEnvironmentSpacePopulations",
      "builtEnvironmentSpaceSurfaces",
    ],
  );
};
