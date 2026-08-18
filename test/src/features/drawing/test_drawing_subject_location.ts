import { deriveAutoMovieDrawingSchedule } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { drawingEnvironment } from "../internal/drawingFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

/**
 * Every subject a schedule counts states where it is.
 *
 * The requirement asks each subject for a location, and two of the three
 * answered `null` on every path. `IAutoMovieDrawingSchedulePlace` was a room's
 * record — building, parent, declared volume, measured contents, fidelity,
 * contents, adjacency, connectors — and an opening has none of those, so the
 * schedule filed a standing gap instead: *"its location must still be read from
 * the design rather than from the schedule"*.
 *
 * That gap was misfiled first as `not-run`, which says an author could supply
 * an input and has not. A `#1954` authoring agent met that pairing while
 * closing a stage, refused an instruction nothing could satisfy, and filed the
 * gap unmet. `#2032` relabelled it `unsupported` and pointed the remedy at the
 * product, which stopped the harm and left a gap that could never close: the
 * derivation was missing for two reasons, and only one of them was that nobody
 * had written it. The other was that the row had nowhere to put the answer.
 *
 * The design held it the whole time. An opening names its host `boundary`, and
 * a boundary names the one region it encloses or the two it separates. A
 * connector declares its stops. So `place` is a discriminated union now, one
 * variant per subject, and the two gaps are gone rather than relabelled again.
 *
 * Scenarios:
 *
 * 1. An opening states its host boundary and the regions that boundary joins,
 *    under `kind: "opening"`, and the building those regions belong to.
 * 2. A connector states **every** stop it declares and not only its two ends,
 *    which is the rule `builtEnvironmentSpaceConnectors` already follows from
 *    the other direction — a lift serving four floors is in four places.
 * 3. Neither subject owes a location gap any more. Asserted as an absence,
 *    because relabelling a gap and retiring it look identical to a reader who
 *    only checks that the status is no longer wrong.
 * 4. A room's place is unchanged and carries the `space` discriminant, so the
 *    union did not quietly cost the variant that already worked.
 * 5. A boundary citing no region is still refused by validation, which is why
 *    `separates` is never empty and the derivation needs no case for it. The
 *    refusal is asserted here rather than assumed, because the JSDoc on the
 *    field rests on it.
 */
export const test_drawing_subject_location = (): void => {
  const environment = drawingEnvironment();
  const scheduleOf = (subject: "space" | "opening" | "connector") =>
    deriveAutoMovieDrawingSchedule({ environment, subject });

  const openings = scheduleOf("opening");
  const connectors = scheduleOf("connector");

  TestValidator.equals(
    "an opening is located by the separation it is cut into",
    namedFacts([
      [
        "every row states an opening place",
        () => openings.rows.every((row) => row.place?.kind === "opening"),
      ],
      [
        "naming its host boundary",
        () =>
          openings.rows.every(
            (row) =>
              row.place?.kind === "opening" && row.place.boundary === "north",
          ),
      ],
      [
        "and the regions that boundary joins",
        () =>
          openings.rows.every(
            (row) =>
              row.place?.kind === "opening" &&
              row.place.separates.join() === "hall",
          ),
      ],
      [
        "and the building unit those regions belong to",
        () =>
          openings.rows.every(
            (row) =>
              row.place?.kind === "opening" && row.place.building === "unit-a",
          ),
      ],
      // The gap this replaced. Retiring it and relabelling it read the same to
      // anyone who only checks that the status stopped being wrong.
      [
        "and owes no location gap",
        () =>
          openings.gaps.some((gap) => gap.subject === "opening-location") ===
          false,
      ],
    ]),
    {
      "every row states an opening place": true,
      "naming its host boundary": true,
      "and the regions that boundary joins": true,
      "and the building unit those regions belong to": true,
      "and owes no location gap": true,
    },
  );

  TestValidator.equals(
    "a connector is located by the regions its declared stops stand in",
    namedFacts([
      [
        "every row states a connector place",
        () => connectors.rows.every((row) => row.place?.kind === "connector"),
      ],
      // Both ends, ascending. The fixture's runs are two-ended, so this states
      // the pair; the derivation reads landings the same way, which is what
      // makes a lift serving four floors report four rather than two.
      [
        "naming both of its stops",
        () =>
          connectors.rows.every(
            (row) =>
              row.place?.kind === "connector" &&
              row.place.stops.join() === "hall,roof-deck",
          ),
      ],
      [
        "and the building unit they belong to",
        () =>
          connectors.rows.every(
            (row) =>
              row.place?.kind === "connector" &&
              row.place.building === "unit-a",
          ),
      ],
      [
        "and owes no location gap",
        () =>
          connectors.gaps.some(
            (gap) => gap.subject === "connector-location",
          ) === false,
      ],
    ]),
    {
      "every row states a connector place": true,
      "naming both of its stops": true,
      "and the building unit they belong to": true,
      "and owes no location gap": true,
    },
  );

  TestValidator.equals(
    "a room's place is what it always was, and now says so",
    namedFacts([
      [
        "every room row is discriminated as a space",
        () =>
          scheduleOf("space").rows.every((row) => row.place?.kind === "space"),
      ],
      // The union's cost, if it had one, would land here: a variant that lost a
      // field would still satisfy every assertion above.
      [
        "and still carries what a room answers with",
        () =>
          scheduleOf("space").rows.every(
            (row) =>
              row.place?.kind === "space" &&
              typeof row.place.building === "string" &&
              Array.isArray(row.place.contents) &&
              Array.isArray(row.place.adjacent) &&
              Array.isArray(row.place.connectors),
          ),
      ],
    ]),
    {
      "every room row is discriminated as a space": true,
      "and still carries what a room answers with": true,
    },
  );

  // The precondition the opening derivation rests on, asserted rather than
  // assumed: `separates` needs no empty case because a boundary citing no
  // region never reaches the schedule.
  TestValidator.predicate(
    "a boundary that cites no region is refused before a schedule sees it",
    throwsError(
      () =>
        deriveAutoMovieDrawingSchedule({
          environment: {
            ...environment,
            boundaries: environment.boundaries.map((boundary) =>
              boundary.id === "north" ? { ...boundary, spaces: [] } : boundary,
            ),
          },
          subject: "opening",
        }),
      ["boundaries[0].spaces", "enclose one space or separate two"],
    ),
  );
};
