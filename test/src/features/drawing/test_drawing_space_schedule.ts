import {
  AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS,
  deriveAutoMovieDrawingSchedule,
} from "@automovie/engine";
import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { drawingCell, drawingEnvironment } from "../internal/drawingFixtures";
import { namedFacts } from "../internal/predicates";

/**
 * A room schedule is the index a reviewer works a building from.
 *
 * Every number below is hand arithmetic over the fixture's own declarations.
 * The hall is declared 0..10 x 0..3 x 0..6, and its contents run from the
 * footing's underside at y -0.7 to the wall head at y 3, so the declared cell
 * and the content box are not the same box. The roof deck is the opposite
 * case and the one that broke `#1902`: it is declared over the whole 10 x 6
 * plan while the only thing standing on it is a beam over x 0..6, z 2.85..3.15,
 * so an eye placed at the declared cell's far corner frames nothing.
 *
 * Scenarios:
 *
 * 1. Every declared space is one row, the total is the design's own space
 *    count, and the row counts sum to it.
 * 2. A room is located: building, parent, declared cell, content box, volume
 *    fidelity, membership, adjacency and connections all come from the
 *    environment's own declarations rather than from id shape.
 * 3. A space that states no volume is `unmeasured` with null dimensions and a
 *    declared gap, and its contents are still measured.
 * 4. Membership is bounded like any schedule sample, and the omitted count
 *    makes the full population reproducible.
 * 5. A shell-stated space is measured from its own vertices; a chamfered cell
 *    and an unclosed cell are refused rather than approximated.
 * 6. Two identical rooms are two rows, marked in an order the authoring order
 *    cannot reach, and the same design schedules the same bytes twice.
 * 7. The schedule says out loud which subjects it does not yet carry.
 */
export const test_drawing_space_schedule = (): void => {
  const environment = drawingEnvironment();
  const schedule = deriveAutoMovieDrawingSchedule({
    environment,
    subject: "space",
  });

  // 1. One row per zone, reconciled with the design.
  TestValidator.equals(
    "a room schedule lists rooms rather than room types",
    [
      schedule.subject,
      schedule.total,
      schedule.rows.length,
      schedule.rows.reduce((sum, row) => sum + row.count, 0),
      environment.spaces.length,
    ],
    ["space", 3, 3, 3, 3],
  );
  TestValidator.equals(
    "every declared zone is named once, by the id the design gave it",
    schedule.rows.flatMap((row) => row.members).sort(byText),
    ["hall", "roof-deck", "site"],
  );

  // 2. A room is located.
  const hall = row(schedule, "hall");
  TestValidator.equals(
    "a room is scheduled at the size of its own declared volume",
    [hall.mark, hall.kind, hall.model, hall.width, hall.height, hall.basis],
    // Widest horizontal extent against clear height: the cell is 10 by 6 on
    // plan and 3 tall.
    ["room-01", "room", null, 10, 3, "profile"],
  );
  TestValidator.equals(
    "a room states where it is, what is in it, and what reaches it",
    hall.place,
    {
      building: "unit-a",
      parent: "site",
      declared: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 3, z: 6 },
      },
      // The footing hangs 0.7 below the floor the cell starts at, so the
      // contents leave the cell downwards. The cell says how far the room
      // reaches; this says where its content is.
      content: {
        min: { x: 0, y: -0.7, z: 0 },
        max: { x: 10, y: 3, z: 6 },
      },
      fidelity: "exact",
      contents: [
        "atelier/door-leaf",
        "atelier/floor-slab",
        "atelier/footing",
        "atelier/north-wall",
      ],
      omittedContents: 0,
      adjacent: ["roof-deck"],
      connectors: ["roof-stair", "service-ramp"],
    },
  );
  const deck = row(schedule, "roof-deck");
  TestValidator.equals(
    "the zone that broke #1902 reports its cell and its contents separately",
    [deck.place?.declared, deck.place?.content],
    [
      { min: { x: 0, y: 3, z: 0 }, max: { x: 10, y: 3.5, z: 6 } },
      // One beam, nowhere near three of the cell's four plan corners.
      { min: { x: 0, y: 3, z: 2.85 }, max: { x: 6, y: 3.4, z: 3.15 } },
    ],
  );
  TestValidator.equals(
    "a one-way ramp reaches the deck without making the deck reach back",
    [deck.place?.adjacent, deck.place?.parent, deck.place?.building],
    [["hall"], "site", "unit-a"],
  );

  // 3. A zone that states no volume.
  const site = row(schedule, "site");
  TestValidator.equals(
    "a purely semantic container is unmeasured rather than zero-sized",
    [
      site.width,
      site.height,
      site.basis,
      site.place?.declared,
      site.place?.parent,
    ],
    [null, null, "unmeasured", null, null],
  );
  TestValidator.equals(
    "a container with no volume of its own still measures what stands under it",
    [site.place?.content, site.place?.contents.length, site.place?.fidelity],
    [
      { min: { x: 0, y: -0.7, z: 0 }, max: { x: 10, y: 3.4, z: 6 } },
      5,
      "exact",
    ],
  );
  TestValidator.equals(
    "the schedule says which zones it could not bound, and never prints a zero",
    schedule.gaps.map((gap) => [gap.subject, gap.status]),
    [
      ["space-fit-out", "unsupported"],
      ["space-geometry", "not-run"],
    ],
  );
  TestValidator.predicate(
    "the unbounded zone is counted in the gap rather than described as empty",
    schedule.gaps
      .find((gap) => gap.subject === "space-geometry")!
      .reason.startsWith("1 space(s) state no volume"),
  );

  // 4. Bounded membership.
  const crowded = deriveAutoMovieDrawingSchedule({
    environment: withExtraLeaves(environment, 11),
    subject: "space",
  });
  const crowdedHall = row(crowded, "hall")!;
  TestValidator.equals(
    "a crowded zone names the bound's worth and counts the rest",
    [
      crowdedHall.place?.contents.length,
      crowdedHall.place?.omittedContents,
      (crowdedHall.place?.contents.length ?? 0) +
        (crowdedHall.place?.omittedContents ?? 0),
      AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS,
    ],
    [8, 7, 15, 8],
  );

  // 5. Other spellings of a declared volume.
  TestValidator.equals(
    "a zone is measured from whatever spelling it declared, or from neither",
    namedFacts([
      [
        "a shelled zone is measured from its own vertices",
        () => {
          const shelled = row(
            deriveAutoMovieDrawingSchedule({
              environment: withSpace(environment, tetrahedronSpace()),
              subject: "space",
            }),
            "vault",
          );
          return (
            shelled.basis === "profile" &&
            shelled.width === 1 &&
            shelled.height === 1 &&
            shelled.place?.declared?.max.z === 1
          );
        },
      ],
      [
        "a zone stated over two cells reports the box that holds both",
        () => {
          const twin = row(
            deriveAutoMovieDrawingSchedule({
              environment: withSpace(environment, {
                id: "wing",
                kind: "room",
                parent: "site",
                cells: [
                  drawingCell(
                    "wing-a",
                    { x: 0, y: 0, z: 0 },
                    { x: 2, y: 2, z: 2 },
                  ),
                  drawingCell(
                    "wing-b",
                    { x: 4, y: 0, z: 0 },
                    { x: 6, y: 1, z: 2 },
                  ),
                ],
              }),
              subject: "space",
            }),
            "wing",
          );
          return (
            twin.place?.declared?.min.x === 0 &&
            twin.place?.declared?.max.x === 6 &&
            twin.place?.declared?.max.y === 2
          );
        },
      ],
      [
        "a chamfered cell is refused rather than boxed off from a guess",
        () =>
          row(
            deriveAutoMovieDrawingSchedule({
              environment: withSpace(environment, {
                id: "bevel",
                kind: "room",
                parent: "site",
                cells: [
                  {
                    id: "bevel-cell",
                    planes: [
                      ...drawingCell(
                        "square",
                        { x: 0, y: 0, z: 0 },
                        { x: 2, y: 2, z: 2 },
                      ).planes,
                      { normal: { x: 1, y: 0, z: 1 }, offset: 3 },
                    ],
                  },
                ],
              }),
              subject: "space",
            }),
            "bevel",
          ).basis === "unmeasured",
      ],
      [
        "a cell left open on one side is refused for the same reason",
        () =>
          row(
            deriveAutoMovieDrawingSchedule({
              environment: withSpace(environment, {
                id: "open",
                kind: "room",
                parent: "site",
                cells: [
                  {
                    id: "open-cell",
                    planes: drawingCell(
                      "square",
                      { x: 0, y: 0, z: 0 },
                      { x: 2, y: 2, z: 2 },
                    ).planes.slice(1),
                  },
                ],
              }),
              subject: "space",
            }),
            "open",
          ).place?.declared === null,
      ],
      [
        "a zone with nothing in it at any depth measures no content at all",
        () =>
          row(
            deriveAutoMovieDrawingSchedule({
              environment: withSpace(environment, {
                id: "cellar",
                kind: "room",
                parent: "site",
                cells: [
                  drawingCell(
                    "cellar-cell",
                    { x: 0, y: -3, z: 0 },
                    { x: 2, y: -1, z: 2 },
                  ),
                ],
              }),
              subject: "space",
            }),
            "cellar",
          ).place?.content === null,
      ],
      [
        "a zone declaring a faceted approximation says so on its row",
        () =>
          row(
            deriveAutoMovieDrawingSchedule({
              environment: withSpace(environment, {
                id: "apse",
                kind: "room",
                parent: "site",
                fidelity: "faceted",
                cells: [
                  drawingCell(
                    "apse-cell",
                    { x: 0, y: 0, z: 0 },
                    { x: 2, y: 2, z: 2 },
                  ),
                ],
              }),
              subject: "space",
            }),
            "apse",
          ).place?.fidelity === "faceted",
      ],
    ]),
    {
      "a shelled zone is measured from its own vertices": true,
      "a zone stated over two cells reports the box that holds both": true,
      "a chamfered cell is refused rather than boxed off from a guess": true,
      "a cell left open on one side is refused for the same reason": true,
      "a zone with nothing in it at any depth measures no content at all": true,
      "a zone declaring a faceted approximation says so on its row": true,
    },
  );

  // 6. Two rooms that are alike are still two rooms.
  const twins = twinRooms(environment);
  const twinned = deriveAutoMovieDrawingSchedule({
    environment: twins,
    subject: "space",
  });
  TestValidator.equals(
    "identical rooms are separate rows, marked in an order the design cannot set",
    twinned.rows
      .filter((candidate) => candidate.kind === "cell")
      .map((candidate) => [candidate.mark, candidate.members]),
    [
      ["cell-01", ["cell-east"]],
      ["cell-02", ["cell-west"]],
    ],
  );
  TestValidator.equals(
    "the order the design listed its spaces in does not reach the schedule",
    deriveAutoMovieDrawingSchedule({
      environment: { ...twins, spaces: [...twins.spaces].reverse() },
      subject: "space",
    }).digest,
    twinned.digest,
  );
  TestValidator.equals(
    "the same design schedules the same bytes twice",
    deriveAutoMovieDrawingSchedule({
      environment: drawingEnvironment(),
      subject: "space",
    }).digest,
    schedule.digest,
  );
  TestValidator.notEquals(
    "a room that moves is a different schedule",
    deriveAutoMovieDrawingSchedule({
      environment: withSpace(environment, {
        id: "cellar",
        kind: "room",
        parent: "site",
        cells: [
          drawingCell(
            "cellar-cell",
            { x: 0, y: -3, z: 0 },
            { x: 2, y: -1, z: 2 },
          ),
        ],
      }),
      subject: "space",
    }).digest,
    schedule.digest,
  );

  // 7. What the index does not yet carry.
  TestValidator.equals(
    "the seven unscheduled subjects are declared rather than left to assumption",
    schedule.gaps.find((gap) => gap.subject === "space-fit-out")?.reason,
    "finish, furniture, fixture, equipment, light and service terminal are not scheduled subjects yet, so a room row states its identity, extent, contents and relations only",
  );
  TestValidator.equals(
    "an opening and a connector row admit they carry no place yet",
    (["opening", "connector"] as const).map((subject) => {
      const other = deriveAutoMovieDrawingSchedule({ environment, subject });
      return [
        other.rows.every((candidate) => candidate.place === null),
        other.gaps.find((gap) => gap.subject === `${subject}-location`)?.status,
      ];
    }),
    [
      [true, "not-run"],
      [true, "not-run"],
    ],
  );
};

const byText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** The one row a zone owns, since a room schedule gives each zone its own. */
const row = (
  schedule: ReturnType<typeof deriveAutoMovieDrawingSchedule>,
  space: string,
) => schedule.rows.find((candidate) => candidate.members.includes(space))!;

/** The same design with one more logical space under the building root. */
const withSpace = (
  environment: IAutoMovieBuiltEnvironment,
  space: IAutoMovieBuiltSpace,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  spaces: [...environment.spaces, space],
});

/** A closed four-faced volume, wound counter-clockwise seen from outside. */
const tetrahedronSpace = (): IAutoMovieBuiltSpace => ({
  id: "vault",
  kind: "room",
  parent: "site",
  cells: [],
  shell: {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 },
    ],
    triangles: [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2],
  },
});

/** The same design with two rooms alike in every scheduled column. */
const twinRooms = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  spaces: [
    ...environment.spaces,
    {
      id: "cell-west",
      kind: "cell",
      parent: "site",
      cells: [
        drawingCell("west-cell", { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }),
      ],
    },
    {
      id: "cell-east",
      kind: "cell",
      parent: "site",
      cells: [
        drawingCell("east-cell", { x: 8, y: 0, z: 0 }, { x: 10, y: 2, z: 2 }),
      ],
    },
  ],
});

/** The same design with `count` more staged leaves standing in the hall. */
const withExtraLeaves = (
  environment: IAutoMovieBuiltEnvironment,
  count: number,
): IAutoMovieBuiltEnvironment => ({
  ...environment,
  elements: [
    ...environment.elements,
    ...Array.from({ length: count }, (_, index) => ({
      id: `crate-${String(index).padStart(2, "0")}`,
      kind: "prop",
      parent: "shell",
      transform: {
        translation: { x: 1 + index * 0.1, y: 0.5, z: 1 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: "leaf",
      space: "hall",
    })),
  ],
});
