import {
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentSpaceBoundaries,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { drawingEnvironment } from "../internal/drawingFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

/**
 * A space can be asked what encloses it, and answers with the boundary itself.
 *
 * `IAutoMovieBuiltBoundary` has always carried the fact: a `kind` the interface
 * documents as `wall`, `floor`, `ceiling` or `threshold`, the `spaces` it
 * encloses or separates, and the `elements` realizing it. Nothing read it.
 * `builtEnvironmentAdjacentSpaces` walks those same records and keeps only the
 * far-side space ids, so the boundary, its kind and its elements were discarded
 * on the one path that touched them, and the engine's other space queries answer
 * about contents, populations, support patches, connectors, fidelity and bounds.
 * There was no way to ask a room what stood around it.
 *
 * Two `#1954` benchmark productions made that concrete. On both, every floor
 * slab was assigned to a storey rather than to the rooms beneath it — which is
 * what the record asks for, since a slab between two storeys belongs to neither
 * room alone and {@link IAutoMovieBuiltPopulation.space} states that a room's
 * contents are what stands in it and not what covers it. Every rule behaved as
 * designed, `building:report` exited 0 with thirty-odd declared gaps naming none
 * of it, and the reflected ceiling plan drew over a thousand lines. A room whose
 * ceiling was owned elsewhere on purpose was indistinguishable from a room with
 * no ceiling at all, because the question could not be put to the model.
 *
 * Scenarios:
 *
 * 1. A room answers with its boundary whole. `hall` is enclosed by `north`, and
 *    the row states the `wall` kind and the `north-wall` element realizing it —
 *    the two facts a reduction to ids would have dropped, and the two that
 *    separate a built wall from a declared one.
 * 2. A boundary nothing builds is still returned, and is still distinguishable.
 *    `roof-deck`'s parapet is declared with an empty `elements`, so "the design
 *    says a parapet is here" and "something realizes it" stay separate answers.
 * 3. Matched exactly, not through containment. `site` contains both rooms and
 *    therefore both boundaries, and is enclosed by neither — the rule
 *    `builtEnvironmentAdjacentSpaces` and `builtEnvironmentSpaceConnectors`
 *    already follow, so asking a storey does not return every partition inside
 *    its rooms.
 * 4. The question `#2035` was filed for is now answerable on this design too:
 *    `hall` is enclosed by a wall and by nothing of kind `ceiling`, while the
 *    same design renders a reflected ceiling plan. Adjacency is asserted beside
 *    it as the control — it names the space on the far side and never the
 *    boundary that joined them, which is why the question had no home before.
 *
 *    That case reads `kind` to describe this fixture and not to prescribe a
 *    check. `kind` is typed `string` and documented as an **open** label, so a
 *    third benchmark production spells its separations `interior-partition` and
 *    `floor-opening` without violating anything, and a consumer scanning for
 *    `"ceiling"` would find none and conclude wrongly. Making enclosure readable
 *    is what this query settles; what a reader may key on is `#2035`'s to
 *    decide, and every candidate answer — a canonical vocabulary, the face
 *    normal, the spaces plus geometry — needs this reader first.
 * 5. An unknown space is refused by name rather than answered with an empty
 *    list, which is the difference between "nothing encloses this room" and
 *    "there is no such room".
 */
export const test_architecture_built_environment_enclosure = (): void => {
  const environment = drawingEnvironment();
  const enclosureOf = (space: string) =>
    builtEnvironmentSpaceBoundaries(environment, space);

  const hall = enclosureOf("hall");
  const deck = enclosureOf("roof-deck");

  TestValidator.equals(
    "a space answers with the boundaries it is named on, whole",
    namedFacts([
      ["a room is enclosed by one boundary", () => hall.length === 1],
      ["and it is the wall", () => hall[0]?.id === "north"],
      // The kind is what tells a ceiling from a wall, and the elements are what
      // tell a built separation from a declared one. Both are dropped by any
      // reduction to ids, and both are the reason boundaries come back whole.
      ["stating its kind", () => hall[0]?.kind === "wall"],
      [
        "and the element realizing it",
        () => hall[0]?.elements.join() === "north-wall",
      ],
      // The face is the located surface an opening is measured against. It is
      // not read here, but a caller asking what encloses a room is the caller
      // that needs it, so losing it in transit would be silent.
      ["with its face intact", () => hall[0]?.face !== undefined],
      ["a roof deck is enclosed by one too", () => deck.length === 1],
      ["which is the parapet", () => deck[0]?.id === "parapet"],
      // Declared and unbuilt. The empty list is the answer, not a failure to
      // find one, so it must survive rather than be filtered out.
      ["that nothing realizes", () => deck[0]?.elements.length === 0],
    ]),
    {
      "a room is enclosed by one boundary": true,
      "and it is the wall": true,
      "stating its kind": true,
      "and the element realizing it": true,
      "with its face intact": true,
      "a roof deck is enclosed by one too": true,
      "which is the parapet": true,
      "that nothing realizes": true,
    },
  );

  TestValidator.equals(
    "enclosure is matched exactly, and a missing ceiling is finally askable",
    namedFacts([
      // `site` is the parent of both rooms, so a containment rule would hand it
      // both boundaries and report the building as enclosed by its own interior.
      [
        "the building it all stands in is enclosed by nothing",
        () => enclosureOf("site").length === 0,
      ],
      // #2035 in one line, on this repository's own fixture: the design draws a
      // reflected ceiling plan and no boundary in it is a ceiling. Read as a
      // description of this design; `kind` is an open label and a production
      // may spell the same separation differently without being wrong.
      [
        "no boundary of this design is a ceiling",
        () =>
          environment.boundaries.some(
            (boundary) => boundary.kind === "ceiling",
          ) === false,
      ],
      [
        "and the room can now say so itself",
        () => hall.some((boundary) => boundary.kind === "ceiling") === false,
      ],
      // The control. Adjacency is the only derivation that ever read a
      // boundary, and it reports the space on the far side; the boundary that
      // put the two spaces in the same sentence is not in its answer, so it
      // could never have been asked what stands around a room.
      [
        "adjacency answers with the far space",
        () =>
          builtEnvironmentAdjacentSpaces(environment, "hall").join() ===
          "roof-deck",
      ],
      [
        "and never with the boundary enclosing it",
        () =>
          builtEnvironmentAdjacentSpaces(environment, "hall").includes(
            "north",
          ) === false,
      ],
    ]),
    {
      "the building it all stands in is enclosed by nothing": true,
      "no boundary of this design is a ceiling": true,
      "and the room can now say so itself": true,
      "adjacency answers with the far space": true,
      "and never with the boundary enclosing it": true,
    },
  );

  // Asserted through `throwsError` rather than `TestValidator.error`, which
  // cannot fail for a synchronous task: it raises its own "exception must be
  // thrown" inside the same `try` that then swallows it. The refusal is also
  // read for the space id, so an unrelated throw cannot stand in for it.
  TestValidator.predicate(
    "an unknown space is refused by name",
    throwsError(
      () => builtEnvironmentSpaceBoundaries(environment, "cellar"),
      ["cellar", "no logical space"],
    ),
  );
};
